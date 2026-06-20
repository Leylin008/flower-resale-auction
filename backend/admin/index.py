"""Админ-панель: заявки на вывод средств, автовыплаты через ЮKassa, статистика комиссии"""
import json
import os
import uuid
import urllib.request
import urllib.error
import base64
import psycopg2


def yookassa_payout(amount: float, method: str, details: str, bank_name: str = "") -> dict:
    """Отправить выплату через ЮKassa Payouts API (агентская схема). Возвращает {"ok": True/False, "id": ..., "error": ...}"""
    agent_id = os.environ.get("YOOKASSA_PAYOUT_SHOP_ID", "").strip()
    secret = os.environ.get("YOOKASSA_PAYOUT_SECRET_KEY", "").strip()
    if not agent_id or not secret:
        return {"ok": False, "error": "Не настроены ключи ЮKassa Выплаты (YOOKASSA_PAYOUT_SHOP_ID / YOOKASSA_PAYOUT_SECRET_KEY)"}

    # Формируем назначение выплаты
    if method == "sbp":
        phone = details.strip().replace(" ", "").replace("-", "")
        if not phone.startswith("+"):
            phone = "+7" + phone.lstrip("7").lstrip("8")
        payout_destination = {"type": "sbp", "phone": phone}
        if bank_name:
            payout_destination["bank_id"] = bank_name
    elif method == "card":
        card_number = details.strip().replace(" ", "")
        payout_destination = {"type": "bank_card", "card": {"number": card_number}}
    else:
        return {"ok": False, "error": f"Неподдерживаемый метод выплаты: {method}"}

    payload = json.dumps({
        "amount": {"value": f"{amount:.2f}", "currency": "RUB"},
        "payout_destination_data": payout_destination,
        "description": "Выплата продавцу FlowerFlip",
        "metadata": {"platform": "flowerflip"},
    }).encode("utf-8")

    # Авторизация: AgentID:SecretKey в Base64
    creds = base64.b64encode(f"{agent_id}:{secret}".encode()).decode()
    http_req = urllib.request.Request(
        "https://api.yookassa.ru/v3/payouts",
        data=payload,
        headers={
            "Authorization": f"Basic {creds}",
            "Idempotence-Key": str(uuid.uuid4()),
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(http_req, timeout=20) as resp:
            data = json.loads(resp.read().decode())
            return {"ok": True, "id": data.get("id"), "status": data.get("status")}
    except urllib.error.HTTPError as e:
        try:
            err_body = json.loads(e.read().decode())
            err_msg = err_body.get("description") or err_body.get("message") or str(err_body)
        except Exception:
            err_msg = f"HTTP {e.code}"
        return {"ok": False, "error": err_msg}
    except Exception as e:
        return {"ok": False, "error": str(e)}

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p84229990_flower_resale_auctio")
CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Authorization, Authorization",
}


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def get_admin(conn, token: str):
    if not token:
        return None
    with conn.cursor() as cur:
        cur.execute(
            f"SELECT u.id, u.name, u.is_admin FROM {SCHEMA}.sessions s "
            f"JOIN {SCHEMA}.users u ON u.id = s.user_id "
            f"WHERE s.token = %s AND s.expires_at > NOW()", (token,)
        )
        row = cur.fetchone()
    if not row or not row[2]:
        return None
    return {"id": row[0], "name": row[1]}


def handler(event: dict, context) -> dict:
    """Управление выводами и статистикой для администратора платформы"""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    qs = event.get("queryStringParameters") or {}
    body = json.loads(event.get("body") or "{}")
    action = qs.get("action") or body.get("action", "")
    token = (event.get("headers") or {}).get("X-Authorization", "").replace("Bearer ", "")

    conn = get_conn()
    try:
        # Публичное чтение флага режима доработки (без авторизации)
        if action == "public_settings":
            with conn.cursor() as cur:
                cur.execute(f"SELECT value FROM {SCHEMA}.app_settings WHERE key = 'maintenance_mode'")
                row = cur.fetchone()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({
                "maintenance_mode": (row[0] if row else "false") == "true"
            })}

        admin = get_admin(conn, token)
        if not admin:
            return {"statusCode": 403, "headers": CORS, "body": json.dumps({"error": "Доступ только для администратора"})}

        # Список заявок на вывод (с фильтром по статусу)
        if action == "withdrawals":
            status_filter = qs.get("status", "")
            where = ""
            params = []
            if status_filter:
                where = "WHERE w.status = %s"
                params.append(status_filter)
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT w.id, w.amount, w.method, w.details, w.status, w.admin_comment, "
                    f"w.created_at, w.processed_at, u.id, u.name, u.phone, w.bank_name, w.payout_id "
                    f"FROM {SCHEMA}.withdrawals w "
                    f"JOIN {SCHEMA}.users u ON u.id = w.user_id "
                    f"{where} ORDER BY w.created_at DESC LIMIT 100",
                    tuple(params)
                )
                rows = cur.fetchall()
            items = [{"id": r[0], "amount": float(r[1]), "method": r[2], "details": r[3],
                      "status": r[4], "admin_comment": r[5],
                      "created_at": str(r[6]), "processed_at": str(r[7]) if r[7] else None,
                      "user_id": r[8], "user_name": r[9], "user_phone": r[10],
                      "bank_name": r[11], "payout_id": r[12]} for r in rows]
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"withdrawals": items})}

        # Подтвердить вывод — автовыплата через ЮKassa Payouts API
        if action == "approve" and method == "POST":
            wid = int(body.get("withdrawal_id", 0))
            comment = body.get("comment", "")
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT w.status, w.amount, w.method, w.details, w.bank_name, u.name "
                    f"FROM {SCHEMA}.withdrawals w JOIN {SCHEMA}.users u ON u.id = w.user_id "
                    f"WHERE w.id = %s", (wid,)
                )
                row = cur.fetchone()
            if not row:
                return {"statusCode": 404, "headers": CORS, "body": json.dumps({"error": "Заявка не найдена"})}
            if row[0] != "pending":
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Заявка уже обработана"})}

            w_status, w_amount, w_method, w_details, w_bank, u_name = row

            # Отправляем выплату через ЮKassa
            result = yookassa_payout(float(w_amount), w_method, w_details, w_bank or "")

            if not result["ok"]:
                return {"statusCode": 502, "headers": CORS, "body": json.dumps({
                    "error": f"Ошибка ЮKassa: {result['error']}"
                })}

            # Помечаем как выплаченное, сохраняем payout_id из ЮKassa
            with conn.cursor() as cur:
                cur.execute(
                    f"UPDATE {SCHEMA}.withdrawals SET status = 'paid', admin_comment = %s, "
                    f"processed_by = %s, processed_at = NOW(), payout_id = %s, payout_status = %s "
                    f"WHERE id = %s",
                    (comment or f"Автовыплата ЮKassa #{result.get('id','')}", admin["id"],
                     result.get("id"), result.get("status"), wid)
                )
            conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({
                "ok": True,
                "message": f"Выплата {float(w_amount):.0f} ₽ отправлена через ЮKassa",
                "payout_id": result.get("id"),
            })}

        # Отклонить вывод (возвращаем деньги на баланс пользователя)
        if action == "reject" and method == "POST":
            wid = int(body.get("withdrawal_id", 0))
            comment = body.get("comment", "")
            with conn.cursor() as cur:
                cur.execute(f"SELECT status, user_id, amount FROM {SCHEMA}.withdrawals WHERE id = %s", (wid,))
                row = cur.fetchone()
                if not row:
                    return {"statusCode": 404, "headers": CORS, "body": json.dumps({"error": "Заявка не найдена"})}
                if row[0] != "pending":
                    return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Заявка уже обработана"})}
                # Возвращаем замороженные деньги обратно
                cur.execute(f"UPDATE {SCHEMA}.users SET balance = balance + %s WHERE id = %s", (row[2], row[1]))
                cur.execute(
                    f"UPDATE {SCHEMA}.withdrawals SET status = 'rejected', admin_comment = %s, "
                    f"processed_by = %s, processed_at = NOW() WHERE id = %s",
                    (comment, admin["id"], wid)
                )
            conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True, "message": "Заявка отклонена, деньги возвращены пользователю"})}

        # Статистика платформы
        if action == "stats":
            with conn.cursor() as cur:
                cur.execute(f"SELECT COALESCE(SUM(amount), 0) FROM {SCHEMA}.platform_earnings")
                total_commission = float(cur.fetchone()[0])
                cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.withdrawals WHERE status = 'pending'")
                pending_count = cur.fetchone()[0]
                cur.execute(f"SELECT COALESCE(SUM(amount), 0) FROM {SCHEMA}.withdrawals WHERE status = 'pending'")
                pending_amount = float(cur.fetchone()[0])
                cur.execute(f"SELECT COALESCE(SUM(amount), 0) FROM {SCHEMA}.withdrawals WHERE status = 'paid'")
                paid_total = float(cur.fetchone()[0])
                cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.users")
                users_count = cur.fetchone()[0]
                cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.orders WHERE escrow_status = 'completed'")
                completed_orders = cur.fetchone()[0]
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({
                "total_commission": total_commission,
                "pending_count": pending_count,
                "pending_amount": pending_amount,
                "paid_total": paid_total,
                "users_count": users_count,
                "completed_orders": completed_orders,
            })}

        # Вывод комиссии платформы на баланс администратора
        if action == "withdraw_platform":
            with conn.cursor() as cur:
                cur.execute(f"SELECT COALESCE(SUM(amount), 0) FROM {SCHEMA}.platform_earnings")
                total = float(cur.fetchone()[0])
                if total <= 0:
                    return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Нет средств для вывода"})}
                # Зачисляем комиссию на баланс администратора и обнуляем platform_earnings
                cur.execute(
                    f"UPDATE {SCHEMA}.users SET balance = balance + %s WHERE id = %s",
                    (total, admin["id"])
                )
                cur.execute(f"DELETE FROM {SCHEMA}.platform_earnings")
            conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True, "amount": total})}

        # GET subscriptions — список подписок магазинов
        if action == "subscriptions":
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT ss.id, ss.user_id, ss.plan, ss.status, ss.started_at, ss.expires_at, ss.banner_addon, "
                    f"u.name, u.email, u.phone, "
                    f"sp.shop_name, sp.logo_url, ss.ai_recommend "
                    f"FROM {SCHEMA}.shop_subscriptions ss "
                    f"JOIN {SCHEMA}.users u ON u.id = ss.user_id "
                    f"LEFT JOIN {SCHEMA}.shop_profiles sp ON sp.user_id = ss.user_id "
                    f"ORDER BY ss.created_at DESC LIMIT 100"
                )
                rows = cur.fetchall()
            items = [{
                "id": r[0], "user_id": r[1], "plan": r[2], "status": r[3],
                "started_at": str(r[4]), "expires_at": str(r[5]) if r[5] else None,
                "banner_addon": bool(r[6]), "user_name": r[7], "user_email": r[8],
                "user_phone": r[9], "shop_name": r[10], "logo_url": r[11],
                "ai_recommend": bool(r[12])
            } for r in rows]
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"subscriptions": items})}

        # POST activate_subscription — активировать подписку магазину
        if action == "activate_subscription" and method == "POST":
            target_user_id = int(body.get("user_id", 0))
            plan = body.get("plan", "basic")
            months = int(body.get("months", 1))
            banner_addon = bool(body.get("banner_addon", False))
            ai_recommend = bool(body.get("ai_recommend", False))
            with conn.cursor() as cur:
                cur.execute(
                    f"INSERT INTO {SCHEMA}.shop_subscriptions (user_id, plan, status, expires_at, banner_addon, ai_recommend) "
                    f"VALUES (%s, %s, 'active', NOW() + INTERVAL '{months} months', %s, %s) "
                    f"ON CONFLICT (user_id) DO UPDATE SET plan = EXCLUDED.plan, status = 'active', "
                    f"expires_at = NOW() + INTERVAL '{months} months', banner_addon = EXCLUDED.banner_addon, "
                    f"ai_recommend = EXCLUDED.ai_recommend",
                    (target_user_id, plan, banner_addon, ai_recommend)
                )
            conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True, "message": "Подписка активирована"})}

        # POST deactivate_subscription — деактивировать подписку
        if action == "deactivate_subscription" and method == "POST":
            target_user_id = int(body.get("user_id", 0))
            with conn.cursor() as cur:
                cur.execute(
                    f"UPDATE {SCHEMA}.shop_subscriptions SET status = 'inactive' WHERE user_id = %s",
                    (target_user_id,)
                )
            conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}

        # GET full_stats — расширенная статистика включая магазины и баннеры
        if action == "full_stats":
            with conn.cursor() as cur:
                cur.execute(f"SELECT COALESCE(SUM(amount), 0) FROM {SCHEMA}.platform_earnings")
                total_commission = float(cur.fetchone()[0])
                cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.withdrawals WHERE status = 'pending'")
                pending_count = cur.fetchone()[0]
                cur.execute(f"SELECT COALESCE(SUM(amount), 0) FROM {SCHEMA}.withdrawals WHERE status = 'pending'")
                pending_amount = float(cur.fetchone()[0])
                cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.users")
                users_count = cur.fetchone()[0]
                cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.orders WHERE escrow_status = 'completed'")
                completed_orders = cur.fetchone()[0]
                cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.shop_subscriptions WHERE status = 'active'")
                active_shops = cur.fetchone()[0]
                cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.banners WHERE is_active = TRUE")
                active_banners = cur.fetchone()[0]
                cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.banner_clicks WHERE clicked_at > NOW() - INTERVAL '30 days'")
                banner_clicks_month = cur.fetchone()[0]
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({
                "total_commission": total_commission,
                "pending_count": pending_count,
                "pending_amount": pending_amount,
                "users_count": users_count,
                "completed_orders": completed_orders,
                "active_shops": active_shops,
                "active_banners": active_banners,
                "banner_clicks_month": banner_clicks_month,
            })}

        # GET chats — список всех диалогов между пользователями (для модерации)
        if action == "chats":
            only_flagged = qs.get("flagged") == "1"
            flag_cond = "AND m.is_flagged = true" if only_flagged else ""
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT DISTINCT ON (LEAST(m.sender_id, m.receiver_id), GREATEST(m.sender_id, m.receiver_id)) "
                    f"LEAST(m.sender_id, m.receiver_id) AS a, GREATEST(m.sender_id, m.receiver_id) AS b, "
                    f"m.text, m.created_at, "
                    f"ua.name, ub.name, "
                    f"(SELECT COUNT(*) FROM {SCHEMA}.messages mm "
                    f" WHERE LEAST(mm.sender_id, mm.receiver_id) = LEAST(m.sender_id, m.receiver_id) "
                    f" AND GREATEST(mm.sender_id, mm.receiver_id) = GREATEST(m.sender_id, m.receiver_id)), "
                    f"(SELECT COUNT(*) FROM {SCHEMA}.messages mm "
                    f" WHERE LEAST(mm.sender_id, mm.receiver_id) = LEAST(m.sender_id, m.receiver_id) "
                    f" AND GREATEST(mm.sender_id, mm.receiver_id) = GREATEST(m.sender_id, m.receiver_id) "
                    f" AND mm.is_flagged = true) "
                    f"FROM {SCHEMA}.messages m "
                    f"JOIN {SCHEMA}.users ua ON ua.id = LEAST(m.sender_id, m.receiver_id) "
                    f"JOIN {SCHEMA}.users ub ON ub.id = GREATEST(m.sender_id, m.receiver_id) "
                    f"WHERE 1=1 {flag_cond} "
                    f"ORDER BY LEAST(m.sender_id, m.receiver_id), GREATEST(m.sender_id, m.receiver_id), m.created_at DESC "
                    f"LIMIT 200"
                )
                rows = cur.fetchall()
            chats = [{
                "user_a_id": r[0], "user_b_id": r[1], "last_message": r[2],
                "last_at": str(r[3]), "user_a_name": r[4], "user_b_name": r[5],
                "total": r[6], "flagged_count": r[7],
            } for r in rows]
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"chats": chats})}

        # GET chat_messages — все сообщения диалога двух пользователей + id связанных сделок
        if action == "chat_messages":
            ua = int(qs.get("user_a_id", 0))
            ub = int(qs.get("user_b_id", 0))
            if not ua or not ub:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "user_a_id и user_b_id обязательны"})}
            lo, hi = min(ua, ub), max(ua, ub)
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT m.id, m.sender_id, m.receiver_id, m.text, m.created_at, "
                    f"m.is_flagged, m.moderation_status, m.moderation_reason, "
                    f"m.bouquet_id, b.title, "
                    f"(SELECT o.id FROM {SCHEMA}.orders o WHERE o.bouquet_id = m.bouquet_id "
                    f" AND ((o.buyer_id = %s AND o.seller_id = %s) OR (o.buyer_id = %s AND o.seller_id = %s)) "
                    f" ORDER BY o.created_at DESC LIMIT 1) AS deal_id "
                    f"FROM {SCHEMA}.messages m "
                    f"LEFT JOIN {SCHEMA}.bouquets b ON b.id = m.bouquet_id "
                    f"WHERE LEAST(m.sender_id, m.receiver_id) = %s AND GREATEST(m.sender_id, m.receiver_id) = %s "
                    f"ORDER BY m.created_at ASC LIMIT 500",
                    (lo, hi, hi, lo, lo, hi)
                )
                rows = cur.fetchall()
            msgs = [{
                "id": r[0], "sender_id": r[1], "receiver_id": r[2], "text": r[3],
                "created_at": str(r[4]), "is_flagged": bool(r[5]),
                "moderation_status": r[6], "moderation_reason": r[7],
                "bouquet_id": r[8], "bouquet_title": r[9], "deal_id": r[10],
            } for r in rows]
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"messages": msgs})}

        # GET settings — текущие настройки платформы
        if action == "settings":
            with conn.cursor() as cur:
                cur.execute(f"SELECT key, value FROM {SCHEMA}.app_settings")
                rows = cur.fetchall()
            settings = {r[0]: r[1] for r in rows}
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({
                "maintenance_mode": settings.get("maintenance_mode", "false") == "true"
            })}

        # POST set_maintenance — включить/выключить режим доработки (блокировка денег)
        if action == "set_maintenance" and method == "POST":
            enabled = bool(body.get("enabled", False))
            with conn.cursor() as cur:
                cur.execute(
                    f"INSERT INTO {SCHEMA}.app_settings (key, value, updated_at) "
                    f"VALUES ('maintenance_mode', %s, NOW()) "
                    f"ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()",
                    ("true" if enabled else "false",)
                )
            conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True, "maintenance_mode": enabled})}

        # ───────── УПРАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯМИ ─────────
        # GET users — поиск по имени / email / телефону
        if action == "users":
            q = (qs.get("q") or "").strip()
            where = ""
            params = []
            if q:
                where = "WHERE u.name ILIKE %s OR u.email ILIKE %s OR u.phone ILIKE %s"
                like = f"%{q}%"
                params = [like, like, like]
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT u.id, u.name, u.email, u.phone, u.city, u.balance, u.coins, "
                    f"u.is_blocked, u.is_admin, u.created_at, u.sales_count, u.purchases_count, u.ref_code "
                    f"FROM {SCHEMA}.users u {where} ORDER BY u.created_at DESC LIMIT 100",
                    tuple(params)
                )
                rows = cur.fetchall()
            users = [{
                "id": r[0], "name": r[1], "email": r[2], "phone": r[3], "city": r[4],
                "balance": float(r[5]) if r[5] is not None else 0, "coins": r[6],
                "is_blocked": bool(r[7]), "is_admin": bool(r[8]), "created_at": str(r[9]),
                "sales_count": r[10], "purchases_count": r[11], "ref_code": r[12],
            } for r in rows]
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"users": users})}

        # GET user_detail — полная карточка: подписка, букеты, продажи, баланс, рефералы
        if action == "user_detail":
            uid = int(qs.get("user_id", 0))
            if not uid:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "user_id обязателен"})}
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT id, name, email, phone, city, balance, coins, is_blocked, block_reason, "
                    f"blocked_at, is_admin, created_at, sales_count, purchases_count, rating, "
                    f"ref_code, ref_earnings, referred_by FROM {SCHEMA}.users WHERE id = %s", (uid,)
                )
                u = cur.fetchone()
                if not u:
                    return {"statusCode": 404, "headers": CORS, "body": json.dumps({"error": "Пользователь не найден"})}
                profile = {
                    "id": u[0], "name": u[1], "email": u[2], "phone": u[3], "city": u[4],
                    "balance": float(u[5]) if u[5] is not None else 0, "coins": u[6],
                    "is_blocked": bool(u[7]), "block_reason": u[8], "blocked_at": str(u[9]) if u[9] else None,
                    "is_admin": bool(u[10]), "created_at": str(u[11]), "sales_count": u[12],
                    "purchases_count": u[13], "rating": float(u[14]) if u[14] else 0,
                    "ref_code": u[15], "ref_earnings": float(u[16]) if u[16] else 0,
                }
                # подписка магазина
                cur.execute(
                    f"SELECT plan, status, expires_at, ai_recommend FROM {SCHEMA}.shop_subscriptions WHERE user_id = %s", (uid,)
                )
                sr = cur.fetchone()
                subscription = {"plan": sr[0], "status": sr[1], "expires_at": str(sr[2]) if sr[2] else None,
                                "ai_recommend": bool(sr[3])} if sr else None
                # букеты
                cur.execute(
                    f"SELECT id, title, status, current_price, fixed_price, sale_type, created_at "
                    f"FROM {SCHEMA}.bouquets WHERE seller_id = %s ORDER BY created_at DESC LIMIT 50", (uid,)
                )
                bouquets = [{"id": r[0], "title": r[1], "status": r[2],
                             "current_price": float(r[3]) if r[3] else None,
                             "fixed_price": float(r[4]) if r[4] else None,
                             "sale_type": r[5], "created_at": str(r[6])} for r in cur.fetchall()]
                # продажи и покупки
                cur.execute(
                    f"SELECT id, amount, escrow_status, seller_id, buyer_id, created_at "
                    f"FROM {SCHEMA}.orders WHERE seller_id = %s OR buyer_id = %s ORDER BY created_at DESC LIMIT 50",
                    (uid, uid)
                )
                deals = [{"id": r[0], "amount": float(r[1]) if r[1] else 0, "status": r[2],
                          "role": "Продавец" if r[3] == uid else "Покупатель",
                          "created_at": str(r[5])} for r in cur.fetchall()]
                # рефералы (кого привёл)
                cur.execute(
                    f"SELECT id, name, created_at FROM {SCHEMA}.users WHERE referred_by = %s ORDER BY created_at DESC", (uid,)
                )
                referrals = [{"id": r[0], "name": r[1], "created_at": str(r[2])} for r in cur.fetchall()]
                # переписки (диалоги пользователя)
                cur.execute(
                    f"SELECT DISTINCT CASE WHEN m.sender_id = %s THEN m.receiver_id ELSE m.sender_id END AS other_id, "
                    f"u2.name FROM {SCHEMA}.messages m "
                    f"JOIN {SCHEMA}.users u2 ON u2.id = CASE WHEN m.sender_id = %s THEN m.receiver_id ELSE m.sender_id END "
                    f"WHERE m.sender_id = %s OR m.receiver_id = %s LIMIT 50",
                    (uid, uid, uid, uid)
                )
                chats = [{"other_id": r[0], "other_name": r[1]} for r in cur.fetchall()]
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({
                "profile": profile, "subscription": subscription, "bouquets": bouquets,
                "deals": deals, "referrals": referrals, "chats": chats,
            })}

        # POST block_user / unblock_user
        if action == "block_user" and method == "POST":
            uid = int(body.get("user_id", 0))
            reason = body.get("reason", "")
            with conn.cursor() as cur:
                cur.execute(
                    f"UPDATE {SCHEMA}.users SET is_blocked = TRUE, block_reason = %s, blocked_at = NOW() "
                    f"WHERE id = %s AND is_admin = FALSE RETURNING id", (reason, uid)
                )
                ok = cur.fetchone()
                if ok:
                    cur.execute(f"DELETE FROM {SCHEMA}.sessions WHERE user_id = %s", (uid,))
            conn.commit()
            if not ok:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Нельзя заблокировать администратора или пользователь не найден"})}
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True, "message": "Пользователь заблокирован"})}

        if action == "unblock_user" and method == "POST":
            uid = int(body.get("user_id", 0))
            with conn.cursor() as cur:
                cur.execute(
                    f"UPDATE {SCHEMA}.users SET is_blocked = FALSE, block_reason = NULL, blocked_at = NULL WHERE id = %s", (uid,)
                )
            conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True, "message": "Пользователь разблокирован"})}

        # POST delete_user — удаление (мягкое: блок + пометка)
        if action == "delete_user" and method == "POST":
            uid = int(body.get("user_id", 0))
            with conn.cursor() as cur:
                cur.execute(f"SELECT is_admin FROM {SCHEMA}.users WHERE id = %s", (uid,))
                ur = cur.fetchone()
                if not ur:
                    return {"statusCode": 404, "headers": CORS, "body": json.dumps({"error": "Пользователь не найден"})}
                if ur[0]:
                    return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Нельзя удалить администратора"})}
                cur.execute(f"DELETE FROM {SCHEMA}.sessions WHERE user_id = %s", (uid,))
                cur.execute(f"UPDATE {SCHEMA}.bouquets SET status = 'removed' WHERE seller_id = %s", (uid,))
                cur.execute(
                    f"UPDATE {SCHEMA}.users SET is_blocked = TRUE, block_reason = 'Аккаунт удалён администратором', "
                    f"blocked_at = NOW(), name = 'Удалённый пользователь', email = NULL, phone = CONCAT('deleted_', id) "
                    f"WHERE id = %s", (uid,)
                )
            conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True, "message": "Пользователь удалён"})}

        # GET referral_pool — состояние общего реферального пула по годам
        if action == "referral_pool":
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT year, amount, distributed, distributed_at FROM {SCHEMA}.referral_pool ORDER BY year DESC"
                )
                pools = [{"year": r[0], "amount": float(r[1]), "distributed": bool(r[2]),
                          "distributed_at": str(r[3]) if r[3] else None} for r in cur.fetchall()]
                cur.execute(
                    f"SELECT COUNT(DISTINCT referred_by) FROM {SCHEMA}.users WHERE referred_by IS NOT NULL"
                )
                eligible = cur.fetchone()[0]
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"pools": pools, "eligible_referrers": eligible})}

        return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Unknown action"})}
    finally:
        conn.close()