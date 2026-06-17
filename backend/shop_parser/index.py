"""Парсер магазинов через Mistral: по городу/запросу собирает контакты цветочных магазинов
и свадебных агентств (название, телефон, email, сайт, instagram, адрес). Экспорт в CSV.
"""
import json
import os
import io
import csv
import urllib.request
import urllib.error
import psycopg2

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p84229990_flower_resale_auctio")
MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions"
MODEL = "mistral-small-latest"

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
            f"SELECT u.id, u.is_admin FROM {SCHEMA}.sessions s "
            f"JOIN {SCHEMA}.users u ON u.id = s.user_id "
            f"WHERE s.token = %s AND s.expires_at > NOW()", (token,)
        )
        row = cur.fetchone()
    if not row or not row[1]:
        return None
    return {"id": row[0]}


def call_mistral(messages, temperature=0.4, max_tokens=2000, json_mode=True):
    api_key = os.environ.get("MISTRAL_API_KEY", "")
    if not api_key:
        raise RuntimeError("MISTRAL_API_KEY not set")
    payload = {"model": MODEL, "messages": messages, "temperature": temperature, "max_tokens": max_tokens}
    if json_mode:
        payload["response_format"] = {"type": "json_object"}
    req = urllib.request.Request(
        MISTRAL_URL, data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=28) as r:
        data = json.loads(r.read().decode("utf-8"))
    return data["choices"][0]["message"]["content"]


def resp(code, body):
    return {"statusCode": code, "headers": CORS, "body": json.dumps(body, ensure_ascii=False, default=str)}


def handler(event: dict, context) -> dict:
    """Парсер контактов цветочных магазинов через Mistral (только для админа) + экспорт CSV."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    qs = event.get("queryStringParameters") or {}
    body = json.loads(event.get("body") or "{}")
    action = qs.get("action") or body.get("action", "")
    token = (event.get("headers") or {}).get("X-Authorization", "").replace("Bearer ", "")

    conn = get_conn()
    try:
        admin = get_admin(conn, token)
        if not admin:
            return resp(403, {"error": "Доступ только для администратора"})

        # Список собранных контактов
        if action == "list":
            city = (qs.get("city") or "").strip()
            where = ""
            params = []
            if city:
                where = "WHERE city ILIKE %s"
                params.append(f"%{city}%")
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT id, name, city, phone, email, website, instagram, address, contacted, created_at "
                    f"FROM {SCHEMA}.parsed_shops {where} ORDER BY created_at DESC LIMIT 500",
                    tuple(params)
                )
                rows = cur.fetchall()
            items = [{"id": r[0], "name": r[1], "city": r[2], "phone": r[3], "email": r[4],
                      "website": r[5], "instagram": r[6], "address": r[7],
                      "contacted": bool(r[8]), "created_at": str(r[9])} for r in rows]
            return resp(200, {"shops": items})

        # Запустить парсинг через Mistral
        if action == "parse" and event.get("httpMethod") == "POST":
            city = (body.get("city") or "").strip()
            kind = body.get("kind", "цветочные магазины")
            count = min(int(body.get("count", 15)), 30)
            if not city:
                return resp(400, {"error": "Укажите город"})
            system = (
                "Ты — ассистент по сбору открытых бизнес-контактов. "
                f"Собери список из {count} реальных {kind} в городе {city} (Россия). "
                "Для каждого укажи известные открытые контакты. "
                "Верни строго JSON вида: {\"shops\": [{\"name\":\"...\",\"phone\":\"...\",\"email\":\"...\","
                "\"website\":\"...\",\"instagram\":\"...\",\"address\":\"...\"}]}. "
                "Если какого-то контакта не знаешь — оставь пустую строку. Не выдумывай телефоны и email, "
                "указывай только те, в которых уверен; при сомнении оставляй поле пустым."
            )
            raw = call_mistral(
                [{"role": "system", "content": system},
                 {"role": "user", "content": f"Город: {city}. Тип: {kind}."}],
                temperature=0.3, max_tokens=2500, json_mode=True
            )
            try:
                data = json.loads(raw)
                shops = data.get("shops", [])
            except Exception:
                return resp(502, {"error": "AI вернул некорректный ответ, попробуйте ещё раз"})

            saved = 0
            with conn.cursor() as cur:
                for s in shops[:count]:
                    name = (s.get("name") or "").strip()
                    if not name:
                        continue
                    cur.execute(
                        f"INSERT INTO {SCHEMA}.parsed_shops (name, city, phone, email, website, instagram, address) "
                        f"VALUES (%s,%s,%s,%s,%s,%s,%s)",
                        (name, city, s.get("phone", ""), s.get("email", ""),
                         s.get("website", ""), s.get("instagram", ""), s.get("address", ""))
                    )
                    saved += 1
            conn.commit()
            return resp(200, {"ok": True, "saved": saved})

        # Пометить «связались» / снять
        if action == "toggle_contacted" and event.get("httpMethod") == "POST":
            sid = int(body.get("id", 0))
            with conn.cursor() as cur:
                cur.execute(f"UPDATE {SCHEMA}.parsed_shops SET contacted = NOT contacted WHERE id = %s", (sid,))
            conn.commit()
            return resp(200, {"ok": True})

        if action == "delete" and event.get("httpMethod") == "POST":
            sid = int(body.get("id", 0))
            with conn.cursor() as cur:
                cur.execute(f"DELETE FROM {SCHEMA}.parsed_shops WHERE id = %s", (sid,))
            conn.commit()
            return resp(200, {"ok": True})

        # Экспорт CSV
        if action == "export":
            city = (qs.get("city") or "").strip()
            where = ""
            params = []
            if city:
                where = "WHERE city ILIKE %s"
                params.append(f"%{city}%")
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT name, city, phone, email, website, instagram, address "
                    f"FROM {SCHEMA}.parsed_shops {where} ORDER BY city, name", tuple(params)
                )
                rows = cur.fetchall()
            buf = io.StringIO()
            w = csv.writer(buf)
            w.writerow(["Название", "Город", "Телефон", "Email", "Сайт", "Instagram", "Адрес"])
            for r in rows:
                w.writerow([x or "" for x in r])
            csv_text = "\ufeff" + buf.getvalue()
            return {
                "statusCode": 200,
                "headers": {**CORS, "Content-Type": "text/csv; charset=utf-8",
                            "Content-Disposition": "attachment; filename=shops.csv"},
                "body": csv_text,
            }

        return resp(400, {"error": "Неизвестное действие"})
    except urllib.error.HTTPError as e:
        return resp(502, {"error": "AI временно недоступен", "detail": str(e.code)})
    except Exception as e:
        return resp(500, {"error": str(e)})
    finally:
        conn.close()
