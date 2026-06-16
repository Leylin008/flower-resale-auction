"""Рекламные баннеры: список активных, трекинг кликов. Управление через admin."""
import json
import os
import psycopg2

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p84229990_flower_resale_auctio")
CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Authorization, Authorization",
}
CONTACT_EMAIL = "flowerflip@flowerflip.ru"


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def get_user_by_token(conn, token: str):
    if not token:
        return None
    with conn.cursor() as cur:
        cur.execute(
            f"SELECT u.id, u.is_admin FROM {SCHEMA}.sessions s "
            f"JOIN {SCHEMA}.users u ON u.id = s.user_id "
            f"WHERE s.token = %s AND s.expires_at > NOW()", (token,)
        )
        row = cur.fetchone()
    if not row:
        return None
    return {"id": row[0], "is_admin": bool(row[1])}


def handler(event: dict, context) -> dict:
    """Рекламные баннеры: получение активных и трекинг кликов"""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    qs = event.get("queryStringParameters") or {}
    body = json.loads(event.get("body") or "{}")
    action = qs.get("action") or body.get("action", "list")
    token = (event.get("headers") or {}).get("X-Authorization", "").replace("Bearer ", "")
    ip = (event.get("requestContext") or {}).get("identity", {}).get("sourceIp", "")

    conn = get_conn()
    try:
        user = get_user_by_token(conn, token)

        # GET list — активные баннеры для показа на главной
        if action == "list":
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT id, title, media_url, media_type, link_url, description, duration_seconds, contact_email "
                    f"FROM {SCHEMA}.banners "
                    f"WHERE is_active = TRUE "
                    f"ORDER BY sort_order ASC, id ASC"
                )
                rows = cur.fetchall()
            banners = [{
                "id": r[0], "title": r[1], "media_url": r[2], "media_type": r[3],
                "link_url": r[4], "description": r[5], "duration_seconds": r[6],
                "contact_email": r[7] or CONTACT_EMAIL
            } for r in rows]
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({
                "banners": banners,
                "contact_email": CONTACT_EMAIL
            })}

        # POST click — трекинг клика по баннеру
        if action == "click" and method == "POST":
            banner_id = int(body.get("banner_id", 0))
            if not banner_id:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "banner_id required"})}
            user_id = user["id"] if user else None
            with conn.cursor() as cur:
                cur.execute(
                    f"INSERT INTO {SCHEMA}.banner_clicks (banner_id, user_id, ip) VALUES (%s, %s, %s)",
                    (banner_id, user_id, ip)
                )
            conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}

        # --- ADMIN ACTIONS ---

        # GET admin_list — все баннеры для админа (включая неактивные)
        if action == "admin_list":
            if not user or not user["is_admin"]:
                return {"statusCode": 403, "headers": CORS, "body": json.dumps({"error": "Только для администратора"})}
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT b.id, b.title, b.media_url, b.media_type, b.link_url, b.description, "
                    f"b.duration_seconds, b.is_active, b.sort_order, b.contact_email, b.created_at, "
                    f"(SELECT COUNT(*) FROM {SCHEMA}.banner_clicks bc WHERE bc.banner_id = b.id) as clicks "
                    f"FROM {SCHEMA}.banners b ORDER BY b.sort_order ASC, b.id ASC"
                )
                rows = cur.fetchall()
            banners = [{
                "id": r[0], "title": r[1], "media_url": r[2], "media_type": r[3],
                "link_url": r[4], "description": r[5], "duration_seconds": r[6],
                "is_active": bool(r[7]), "sort_order": r[8], "contact_email": r[9],
                "created_at": str(r[10]), "clicks": r[11]
            } for r in rows]
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"banners": banners})}

        # POST create_banner — создать баннер
        if action == "create_banner" and method == "POST":
            if not user or not user["is_admin"]:
                return {"statusCode": 403, "headers": CORS, "body": json.dumps({"error": "Только для администратора"})}
            title = body.get("title", "").strip()
            media_url = body.get("media_url", "").strip()
            media_type = body.get("media_type", "image")
            link_url = body.get("link_url", "").strip() or None
            description = body.get("description", "").strip() or None
            duration_seconds = int(body.get("duration_seconds", 5))
            is_active = bool(body.get("is_active", True))
            sort_order = int(body.get("sort_order", 0))
            contact_email = body.get("contact_email", "").strip() or None
            if not title or not media_url:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Укажите название и медиафайл"})}
            with conn.cursor() as cur:
                cur.execute(
                    f"INSERT INTO {SCHEMA}.banners (title, media_url, media_type, link_url, description, duration_seconds, is_active, sort_order, contact_email) "
                    f"VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id",
                    (title, media_url, media_type, link_url, description, duration_seconds, is_active, sort_order, contact_email)
                )
                new_id = cur.fetchone()[0]
            conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True, "id": new_id})}

        # POST update_banner — обновить баннер
        if action == "update_banner" and method == "POST":
            if not user or not user["is_admin"]:
                return {"statusCode": 403, "headers": CORS, "body": json.dumps({"error": "Только для администратора"})}
            banner_id = int(body.get("id", 0))
            fields = {}
            for key in ["title", "media_url", "media_type", "link_url", "description", "contact_email"]:
                if key in body:
                    fields[key] = body[key] or None
            for key in ["duration_seconds", "sort_order"]:
                if key in body:
                    fields[key] = int(body[key])
            if "is_active" in body:
                fields["is_active"] = bool(body["is_active"])
            if not fields:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Нет данных для обновления"})}
            set_parts = ", ".join([f"{k} = %s" for k in fields])
            vals = list(fields.values()) + [banner_id]
            with conn.cursor() as cur:
                cur.execute(f"UPDATE {SCHEMA}.banners SET {set_parts}, updated_at = NOW() WHERE id = %s", vals)
            conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}

        # POST delete_banner — удалить баннер
        if action == "delete_banner" and method == "POST":
            if not user or not user["is_admin"]:
                return {"statusCode": 403, "headers": CORS, "body": json.dumps({"error": "Только для администратора"})}
            banner_id = int(body.get("id", 0))
            with conn.cursor() as cur:
                cur.execute(f"DELETE FROM {SCHEMA}.banner_clicks WHERE banner_id = %s", (banner_id,))
                cur.execute(f"DELETE FROM {SCHEMA}.banners WHERE id = %s", (banner_id,))
            conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}

        # GET banner_stats — статистика кликов по баннеру
        if action == "banner_stats":
            if not user or not user["is_admin"]:
                return {"statusCode": 403, "headers": CORS, "body": json.dumps({"error": "Только для администратора"})}
            banner_id = qs.get("banner_id")
            with conn.cursor() as cur:
                if banner_id:
                    cur.execute(
                        f"SELECT DATE(clicked_at), COUNT(*) FROM {SCHEMA}.banner_clicks "
                        f"WHERE banner_id = %s GROUP BY DATE(clicked_at) ORDER BY 1 DESC LIMIT 30",
                        (banner_id,)
                    )
                else:
                    cur.execute(
                        f"SELECT banner_id, COUNT(*) FROM {SCHEMA}.banner_clicks "
                        f"GROUP BY banner_id ORDER BY 2 DESC"
                    )
                rows = cur.fetchall()
            data = [{"date" if banner_id else "banner_id": str(r[0]), "clicks": r[1]} for r in rows]
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"stats": data})}

        return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Unknown action"})}
    finally:
        conn.close()