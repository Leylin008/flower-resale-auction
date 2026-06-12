"""Профили магазинов цветов: создание, редактирование, подписка, букеты магазина"""
import json
import os
import psycopg2

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p84229990_flower_resale_auctio")
CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Authorization, Authorization",
}
SUBSCRIPTION_PRICE = 1990
BANNER_ADDON_PRICE = 990

# Скидки по количеству месяцев: месяц → процент скидки
DISCOUNTS = {1: 0, 2: 5, 3: 10, 6: 15, 12: 25}


def calc_price(base_price: int, months: int) -> int:
    """Итоговая цена с учётом скидки за количество месяцев"""
    discount = DISCOUNTS.get(months, 0)
    total = base_price * months * (100 - discount) // 100
    return total


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def get_user_by_token(conn, token: str):
    if not token:
        return None
    with conn.cursor() as cur:
        cur.execute(
            f"SELECT u.id, u.name, u.email, u.is_admin FROM {SCHEMA}.sessions s "
            f"JOIN {SCHEMA}.users u ON u.id = s.user_id "
            f"WHERE s.token = %s AND s.expires_at > NOW()", (token,)
        )
        row = cur.fetchone()
    if not row:
        return None
    return {"id": row[0], "name": row[1], "email": row[2], "is_admin": bool(row[3])}


def get_subscription(conn, user_id: int):
    with conn.cursor() as cur:
        cur.execute(
            f"SELECT id, plan, status, started_at, expires_at, banner_addon "
            f"FROM {SCHEMA}.shop_subscriptions WHERE user_id = %s", (user_id,)
        )
        row = cur.fetchone()
    if not row:
        return None
    return {
        "id": row[0], "plan": row[1], "status": row[2],
        "started_at": str(row[3]), "expires_at": str(row[4]) if row[4] else None,
        "banner_addon": bool(row[5]),
        "is_active": row[2] == "active"
    }


def handler(event: dict, context) -> dict:
    """Управление профилями магазинов цветов и подписками"""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    qs = event.get("queryStringParameters") or {}
    body = json.loads(event.get("body") or "{}")
    action = qs.get("action") or body.get("action", "")
    token = (event.get("headers") or {}).get("X-Authorization", "").replace("Bearer ", "")

    conn = get_conn()
    try:
        user = get_user_by_token(conn, token)

        # GET profile — получить профиль магазина текущего пользователя или по user_id
        if action == "profile":
            uid = qs.get("user_id") or (user["id"] if user else None)
            if not uid:
                return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Не авторизован"})}
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT sp.id, sp.user_id, sp.shop_name, sp.logo_url, sp.description, sp.address, sp.phone, sp.created_at, "
                    f"u.name, u.rating, u.reviews_count "
                    f"FROM {SCHEMA}.shop_profiles sp "
                    f"JOIN {SCHEMA}.users u ON u.id = sp.user_id "
                    f"WHERE sp.user_id = %s", (uid,)
                )
                row = cur.fetchone()
            if not row:
                return {"statusCode": 200, "headers": CORS, "body": json.dumps({"profile": None})}
            sub = get_subscription(conn, int(uid))
            profile = {
                "id": row[0], "user_id": row[1], "shop_name": row[2], "logo_url": row[3],
                "description": row[4], "address": row[5], "phone": row[6],
                "created_at": str(row[7]), "owner_name": row[8], "rating": float(row[9]),
                "reviews_count": row[10], "subscription": sub
            }
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"profile": profile})}

        # POST save_profile — создать или обновить профиль магазина
        if action == "save_profile" and method == "POST":
            if not user:
                return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Не авторизован"})}
            sub = get_subscription(conn, user["id"])
            if not sub or not sub["is_active"]:
                return {"statusCode": 403, "headers": CORS, "body": json.dumps({"error": "Для создания магазина нужна активная подписка", "need_subscription": True})}
            shop_name = body.get("shop_name", "").strip()
            logo_url = body.get("logo_url", "").strip() or None
            description = body.get("description", "").strip() or None
            address = body.get("address", "").strip() or None
            phone = body.get("phone", "").strip() or None
            city = body.get("city", "").strip() or None
            if not shop_name:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Укажите название магазина"})}
            with conn.cursor() as cur:
                cur.execute(
                    f"INSERT INTO {SCHEMA}.shop_profiles (user_id, shop_name, logo_url, description, address, phone, city) "
                    f"VALUES (%s, %s, %s, %s, %s, %s, %s) "
                    f"ON CONFLICT (user_id) DO UPDATE SET shop_name = EXCLUDED.shop_name, logo_url = EXCLUDED.logo_url, "
                    f"description = EXCLUDED.description, address = EXCLUDED.address, phone = EXCLUDED.phone, city = EXCLUDED.city "
                    f"RETURNING id",
                    (user["id"], shop_name, logo_url, description, address, phone, city)
                )
                profile_id = cur.fetchone()[0]
            conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True, "id": profile_id})}

        # POST save_location — добавить/обновить адрес магазина в городе
        if action == "save_location" and method == "POST":
            if not user:
                return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Не авторизован"})}
            with conn.cursor() as cur:
                cur.execute(f"SELECT id FROM {SCHEMA}.shop_profiles WHERE user_id = {user['id']}")
                sp = cur.fetchone()
            if not sp:
                return {"statusCode": 404, "headers": CORS, "body": json.dumps({"error": "Создайте профиль магазина сначала"})}
            shop_id = sp[0]
            loc_id = body.get("id")
            loc_city = (body.get("city") or "").strip()
            loc_address = (body.get("address") or "").strip()
            loc_phone = (body.get("phone") or "").strip() or None
            is_main = bool(body.get("is_main", False))
            if not loc_city or not loc_address:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Укажите город и адрес"})}
            with conn.cursor() as cur:
                if loc_id:
                    cur.execute(
                        f"UPDATE {SCHEMA}.shop_locations SET city = %s, address = %s, phone = %s, is_main = %s "
                        f"WHERE id = %s AND shop_id = %s RETURNING id",
                        (loc_city, loc_address, loc_phone, is_main, int(loc_id), shop_id)
                    )
                    row = cur.fetchone()
                    if not row:
                        return {"statusCode": 403, "headers": CORS, "body": json.dumps({"error": "Нет доступа"})}
                    new_id = row[0]
                else:
                    cur.execute(
                        f"INSERT INTO {SCHEMA}.shop_locations (shop_id, city, address, phone, is_main) "
                        f"VALUES (%s, %s, %s, %s, %s) RETURNING id",
                        (shop_id, loc_city, loc_address, loc_phone, is_main)
                    )
                    new_id = cur.fetchone()[0]
                if is_main:
                    cur.execute(
                        f"UPDATE {SCHEMA}.shop_locations SET is_main = FALSE WHERE shop_id = %s AND id != %s",
                        (shop_id, new_id)
                    )
            conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True, "id": new_id})}

        # POST delete_location — удалить адрес (пометить неактивным)
        if action == "delete_location" and method == "POST":
            if not user:
                return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Не авторизован"})}
            loc_id = int(body.get("id", 0))
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT sl.id FROM {SCHEMA}.shop_locations sl "
                    f"JOIN {SCHEMA}.shop_profiles sp ON sp.id = sl.shop_id "
                    f"WHERE sl.id = %s AND sp.user_id = %s",
                    (loc_id, user["id"])
                )
                if not cur.fetchone():
                    return {"statusCode": 403, "headers": CORS, "body": json.dumps({"error": "Нет доступа"})}
                cur.execute(
                    f"UPDATE {SCHEMA}.shop_locations SET address = '[удалено] ' || address WHERE id = %s",
                    (loc_id,)
                )
            conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}

        # GET locations — список адресов магазина
        if action == "locations":
            uid = qs.get("user_id") or (user["id"] if user else None)
            if not uid:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "user_id required"})}
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT sl.id, sl.city, sl.address, sl.phone, sl.is_main "
                    f"FROM {SCHEMA}.shop_locations sl "
                    f"JOIN {SCHEMA}.shop_profiles sp ON sp.id = sl.shop_id "
                    f"WHERE sp.user_id = %s AND sl.address NOT LIKE '[удалено]%%' "
                    f"ORDER BY sl.is_main DESC, sl.id ASC",
                    (uid,)
                )
                rows = cur.fetchall()
            locs = [{"id": r[0], "city": r[1], "address": r[2], "phone": r[3], "is_main": bool(r[4])} for r in rows]
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"locations": locs})}

        # GET my_status — подписка + профиль текущего пользователя
        if action == "my_status":
            if not user:
                return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Не авторизован"})}
            sub = get_subscription(conn, user["id"])
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT id, shop_name, logo_url FROM {SCHEMA}.shop_profiles WHERE user_id = %s",
                    (user["id"],)
                )
                row = cur.fetchone()
            profile = {"id": row[0], "shop_name": row[1], "logo_url": row[2]} if row else None
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({
                "subscription": sub,
                "profile": profile,
                "subscription_price": SUBSCRIPTION_PRICE,
                "banner_addon_price": BANNER_ADDON_PRICE,
                "discounts": DISCOUNTS,
            })}

        # POST activate_subscription — активировать подписку и списать баланс
        if action == "activate_subscription" and method == "POST":
            if not user or not user["is_admin"]:
                return {"statusCode": 403, "headers": CORS, "body": json.dumps({"error": "Только для администратора"})}
            target_user_id = int(body.get("user_id", 0))
            plan = body.get("plan", "basic")
            months = int(body.get("months", 1))
            banner_addon = bool(body.get("banner_addon", False))
            deduct_balance = bool(body.get("deduct_balance", False))

            # Рассчитываем сумму к списанию
            total = calc_price(SUBSCRIPTION_PRICE, months)
            if banner_addon:
                total += calc_price(BANNER_ADDON_PRICE, months)

            banner_sql = "TRUE" if banner_addon else "FALSE"

            with conn.cursor() as cur:
                # Проверяем баланс если нужно списать
                if deduct_balance:
                    cur.execute(f"SELECT balance FROM {SCHEMA}.users WHERE id = {target_user_id}")
                    row = cur.fetchone()
                    if not row:
                        return {"statusCode": 404, "headers": CORS, "body": json.dumps({"error": "Пользователь не найден"})}
                    current_balance = float(row[0])
                    if current_balance < total:
                        return {"statusCode": 400, "headers": CORS, "body": json.dumps({
                            "error": f"Недостаточно средств. Нужно {total} ₽, на балансе {current_balance:.2f} ₽"
                        })}
                    cur.execute(
                        f"UPDATE {SCHEMA}.users SET balance = balance - {total} WHERE id = {target_user_id}"
                    )
                    cur.execute(
                        f"INSERT INTO {SCHEMA}.platform_earnings (order_id, amount) VALUES (0, {total})"
                    )

                # Активируем подписку
                cur.execute(
                    f"INSERT INTO {SCHEMA}.shop_subscriptions (user_id, plan, status, expires_at, banner_addon) "
                    f"VALUES ({target_user_id}, 'basic', 'active', NOW() + INTERVAL '{months} months', {banner_sql}) "
                    f"ON CONFLICT (user_id) DO UPDATE SET plan = 'basic', status = 'active', "
                    f"expires_at = NOW() + INTERVAL '{months} months', banner_addon = {banner_sql}"
                )

                # Уведомление пользователю
                banner_text = " + рекламные баннеры" if banner_addon else ""
                notif_title = "🏪 Подписка магазина активирована!"
                notif_body_text = f"Ваш магазин открыт на {months} мес.{banner_text}. Оформите профиль и начните продавать."
                if deduct_balance:
                    notif_body_text += f" Списано {total:,} ₽.".replace(",", " ")
                notif_title_safe = notif_title.replace("'", "''")
                notif_body_safe = notif_body_text.replace("'", "''")
                cur.execute(
                    f"INSERT INTO {SCHEMA}.notifications (user_id, type, title, body) "
                    f"VALUES ({target_user_id}, 'shop', '{notif_title_safe}', '{notif_body_safe}')"
                )

            conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({
                "ok": True,
                "deducted": total if deduct_balance else 0,
                "months": months,
            })}

        # GET shop_bouquets — букеты конкретного магазина
        if action == "shop_bouquets":
            uid = qs.get("user_id")
            if not uid:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "user_id required"})}
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT b.id, b.title, b.image_urls, b.current_price, b.fixed_price, b.sale_type, "
                    f"b.status, b.ends_at, b.bids_count, b.reserve_enabled "
                    f"FROM {SCHEMA}.bouquets b "
                    f"WHERE b.seller_id = %s AND b.status = 'active' "
                    f"ORDER BY b.created_at DESC LIMIT 50", (uid,)
                )
                rows = cur.fetchall()
            items = [{
                "id": r[0], "title": r[1], "image_urls": r[2],
                "current_price": float(r[3]) if r[3] else None,
                "fixed_price": float(r[4]) if r[4] else None,
                "sale_type": r[5], "status": r[6],
                "ends_at": str(r[7]) if r[7] else None,
                "bids_count": r[8], "reserve_enabled": bool(r[9])
            } for r in rows]
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"bouquets": items})}

        # GET list — список всех активных магазинов
        if action == "list":
            city_filter = qs.get("city", "").strip()
            where_extra = f"AND sp.city = '{city_filter.replace(chr(39), chr(39)+chr(39))}'" if city_filter else ""
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT sp.id, sp.user_id, sp.shop_name, sp.logo_url, sp.description, "
                    f"u.rating, u.reviews_count, u.sales_count, "
                    f"COALESCE(sp.city, u.city) as city "
                    f"FROM {SCHEMA}.shop_profiles sp "
                    f"JOIN {SCHEMA}.users u ON u.id = sp.user_id "
                    f"JOIN {SCHEMA}.shop_subscriptions ss ON ss.user_id = sp.user_id "
                    f"WHERE ss.status = 'active' {where_extra} "
                    f"ORDER BY u.rating DESC LIMIT 50"
                )
                rows = cur.fetchall()
            shops = [{
                "id": r[0], "user_id": r[1], "shop_name": r[2], "logo_url": r[3],
                "description": r[4], "rating": float(r[5]), "reviews_count": r[6], "sales_count": r[7],
                "city": r[8]
            } for r in rows]
            # Собираем уникальные города из всех локаций магазинов
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT DISTINCT sl.city FROM {SCHEMA}.shop_locations sl "
                    f"JOIN {SCHEMA}.shop_profiles sp2 ON sp2.id = sl.shop_id "
                    f"JOIN {SCHEMA}.shop_subscriptions ss2 ON ss2.user_id = sp2.user_id "
                    f"WHERE ss2.status = 'active' AND sl.address NOT LIKE '[удалено]%%' "
                    f"ORDER BY sl.city"
                )
                loc_cities = [r[0] for r in cur.fetchall()]
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"shops": shops, "cities": loc_cities})}

        return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Unknown action"})}
    finally:
        conn.close()