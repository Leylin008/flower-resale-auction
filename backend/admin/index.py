"""Админ-панель: заявки на вывод средств, подтверждение/отклонение, статистика комиссии"""
import json
import os
import psycopg2

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
                    f"w.created_at, w.processed_at, u.id, u.name, u.phone "
                    f"FROM {SCHEMA}.withdrawals w "
                    f"JOIN {SCHEMA}.users u ON u.id = w.user_id "
                    f"{where} ORDER BY w.created_at DESC LIMIT 100",
                    tuple(params)
                )
                rows = cur.fetchall()
            items = [{"id": r[0], "amount": float(r[1]), "method": r[2], "details": r[3],
                      "status": r[4], "admin_comment": r[5],
                      "created_at": str(r[6]), "processed_at": str(r[7]) if r[7] else None,
                      "user_id": r[8], "user_name": r[9], "user_phone": r[10]} for r in rows]
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"withdrawals": items})}

        # Подтвердить вывод (деньги уже списаны при создании заявки — просто помечаем выплаченным)
        if action == "approve" and method == "POST":
            wid = int(body.get("withdrawal_id", 0))
            comment = body.get("comment", "")
            with conn.cursor() as cur:
                cur.execute(f"SELECT status FROM {SCHEMA}.withdrawals WHERE id = %s", (wid,))
                row = cur.fetchone()
                if not row:
                    return {"statusCode": 404, "headers": CORS, "body": json.dumps({"error": "Заявка не найдена"})}
                if row[0] != "pending":
                    return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Заявка уже обработана"})}
                cur.execute(
                    f"UPDATE {SCHEMA}.withdrawals SET status = 'paid', admin_comment = %s, "
                    f"processed_by = %s, processed_at = NOW() WHERE id = %s",
                    (comment, admin["id"], wid)
                )
            conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True, "message": "Вывод подтверждён"})}

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

        return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Unknown action"})}
    finally:
        conn.close()