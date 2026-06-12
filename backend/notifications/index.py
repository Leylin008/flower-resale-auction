"""Уведомления: список, отметка прочитанных, push-подписки"""
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


def get_user_by_token(conn, token: str):
    if not token:
        return None
    safe_token = token.replace("'", "''")
    with conn.cursor() as cur:
        cur.execute(
            f"SELECT u.id, u.name, u.is_admin FROM {SCHEMA}.sessions s "
            f"JOIN {SCHEMA}.users u ON u.id = s.user_id "
            f"WHERE s.token = '{safe_token}' AND s.expires_at > NOW()"
        )
        row = cur.fetchone()
    if not row:
        return None
    return {"id": row[0], "name": row[1], "is_admin": bool(row[2])}


def handler(event: dict, context) -> dict:
    """Уведомления пользователя и push-подписки"""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    qs = event.get("queryStringParameters") or {}
    body = json.loads(event.get("body") or "{}")
    action = qs.get("action") or body.get("action", "list")
    token = (event.get("headers") or {}).get("X-Authorization", "").replace("Bearer ", "")

    conn = get_conn()
    try:
        user = get_user_by_token(conn, token)
        if not user:
            return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Не авторизован"})}

        uid = user["id"]

        # GET list — список уведомлений
        if action == "list":
            limit = int(qs.get("limit", 30))
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT id, type, title, body, data, is_read, created_at "
                    f"FROM {SCHEMA}.notifications "
                    f"WHERE user_id = {uid} ORDER BY created_at DESC LIMIT {limit}"
                )
                rows = cur.fetchall()
                cur.execute(
                    f"SELECT COUNT(*) FROM {SCHEMA}.notifications WHERE user_id = {uid} AND is_read = FALSE"
                )
                unread = cur.fetchone()[0]
            items = [{
                "id": r[0], "type": r[1], "title": r[2], "body": r[3],
                "data": r[4], "is_read": bool(r[5]), "created_at": str(r[6])
            } for r in rows]
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"notifications": items, "unread": unread})}

        # POST read — отметить прочитанным (одно или все)
        if action == "read" and method == "POST":
            notif_id = body.get("id")
            with conn.cursor() as cur:
                if notif_id:
                    cur.execute(
                        f"UPDATE {SCHEMA}.notifications SET is_read = TRUE WHERE id = {int(notif_id)} AND user_id = {uid}"
                    )
                else:
                    cur.execute(
                        f"UPDATE {SCHEMA}.notifications SET is_read = TRUE WHERE user_id = {uid}"
                    )
            conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}

        # POST subscribe_push — сохранить push-подписку браузера
        if action == "subscribe_push" and method == "POST":
            endpoint = body.get("endpoint", "").replace("'", "''")
            p256dh = (body.get("p256dh") or "").replace("'", "''")
            auth_key = (body.get("auth") or "").replace("'", "''")
            if not endpoint:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "endpoint required"})}
            with conn.cursor() as cur:
                cur.execute(
                    f"INSERT INTO {SCHEMA}.push_subscriptions (user_id, endpoint, p256dh, auth) "
                    f"VALUES ({uid}, '{endpoint}', '{p256dh}', '{auth_key}') "
                    f"ON CONFLICT (user_id, endpoint) DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth"
                )
            conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}

        # POST send — создать уведомление (только для админа)
        if action == "send" and method == "POST":
            if not user["is_admin"]:
                return {"statusCode": 403, "headers": CORS, "body": json.dumps({"error": "Только для администратора"})}
            target_user_id = body.get("user_id")
            notif_type = (body.get("type", "info") or "info").replace("'", "''")
            title = (body.get("title", "") or "").replace("'", "''")
            notif_body = (body.get("body", "") or "").replace("'", "''")
            data = body.get("data")
            broadcast = bool(body.get("broadcast", False))
            data_val = f"'{json.dumps(data).replace(chr(39), chr(39)+chr(39))}'" if data else "NULL"

            with conn.cursor() as cur:
                if broadcast:
                    cur.execute(
                        f"INSERT INTO {SCHEMA}.notifications (user_id, type, title, body, data) "
                        f"SELECT id, '{notif_type}', '{title}', '{notif_body}', {data_val} FROM {SCHEMA}.users"
                    )
                    affected = cur.rowcount
                elif target_user_id:
                    cur.execute(
                        f"INSERT INTO {SCHEMA}.notifications (user_id, type, title, body, data) "
                        f"VALUES ({int(target_user_id)}, '{notif_type}', '{title}', '{notif_body}', {data_val})"
                    )
                    affected = 1
                else:
                    return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "user_id или broadcast обязательны"})}
            conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True, "sent": affected})}

        return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Unknown action"})}
    finally:
        conn.close()
