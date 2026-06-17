"""Статьи: публичная лента + генерация через Mistral + админ-CRUD (редактирование, картинки, удаление).
Темы: истории про цветы и романтику + описание функций сайта, с ссылкой-приглашением.
"""
import json
import os
import re
import urllib.request
import urllib.error
import psycopg2

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p84229990_flower_resale_auctio")
MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions"
MODEL = "mistral-small-latest"
SITE_URL = "https://flowerflip.ru"

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


def call_mistral(messages, temperature=0.7, max_tokens=1500, json_mode=False):
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
    with urllib.request.urlopen(req, timeout=28) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return data["choices"][0]["message"]["content"]


def slugify(title: str) -> str:
    translit = {
        'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e','ж':'zh','з':'z','и':'i','й':'y',
        'к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f',
        'х':'h','ц':'c','ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya',' ':'-'
    }
    s = "".join(translit.get(ch, ch) for ch in title.lower())
    s = re.sub(r'[^a-z0-9\-]', '', s)
    s = re.sub(r'\-+', '-', s).strip('-')
    return (s or "article")[:120]


def resp(code, body):
    return {"statusCode": code, "headers": CORS, "body": json.dumps(body, ensure_ascii=False, default=str)}


def handler(event: dict, context) -> dict:
    """Публичная лента статей + генерация через Mistral и управление для админа."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    qs = event.get("queryStringParameters") or {}
    body = json.loads(event.get("body") or "{}")
    action = qs.get("action") or body.get("action", "")
    token = (event.get("headers") or {}).get("X-Authorization", "").replace("Bearer ", "")

    conn = get_conn()
    try:
        # ───── ПУБЛИЧНОЕ ─────
        if action == "list":
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT id, slug, title, excerpt, cover_url, category, views, created_at "
                    f"FROM {SCHEMA}.articles WHERE is_published = TRUE ORDER BY created_at DESC LIMIT 100"
                )
                rows = cur.fetchall()
            items = [{"id": r[0], "slug": r[1], "title": r[2], "excerpt": r[3], "cover_url": r[4],
                      "category": r[5], "views": r[6], "created_at": str(r[7])} for r in rows]
            return resp(200, {"articles": items})

        if action == "get":
            slug = qs.get("slug", "")
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT id, slug, title, excerpt, body, cover_url, category, views, created_at "
                    f"FROM {SCHEMA}.articles WHERE slug = %s AND is_published = TRUE", (slug,)
                )
                r = cur.fetchone()
                if not r:
                    return resp(404, {"error": "Статья не найдена"})
                cur.execute(f"UPDATE {SCHEMA}.articles SET views = views + 1 WHERE id = %s", (r[0],))
            conn.commit()
            return resp(200, {"article": {
                "id": r[0], "slug": r[1], "title": r[2], "excerpt": r[3], "body": r[4],
                "cover_url": r[5], "category": r[6], "views": r[7], "created_at": str(r[8])}})

        # ───── АДМИН ─────
        admin = get_admin(conn, token)
        if not admin:
            return resp(403, {"error": "Доступ только для администратора"})

        if action == "admin_list":
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT id, slug, title, excerpt, cover_url, category, is_published, views, created_at "
                    f"FROM {SCHEMA}.articles ORDER BY created_at DESC LIMIT 200"
                )
                rows = cur.fetchall()
            items = [{"id": r[0], "slug": r[1], "title": r[2], "excerpt": r[3], "cover_url": r[4],
                      "category": r[5], "is_published": bool(r[6]), "views": r[7], "created_at": str(r[8])} for r in rows]
            return resp(200, {"articles": items})

        # Сгенерировать черновик статьи через Mistral
        if action == "generate" and event.get("httpMethod") == "POST":
            topic = (body.get("topic") or "").strip()
            category = body.get("category", "Цветы и романтика")
            if not topic:
                return resp(400, {"error": "Укажите тему статьи"})
            invite = f"{SITE_URL}/?ref=invite"
            system = (
                "Ты — копирайтер платформы FlowerFlip (перепродажа свежих букетов через аукцион). "
                "Пиши тёплые, душевные статьи про цветы и романтику на русском языке. "
                "Верни строго JSON: {\"title\": \"...\", \"excerpt\": \"короткое описание 1-2 предложения\", "
                "\"body\": \"текст статьи в формате Markdown, 4-7 абзацев, с подзаголовками ## \"}. "
                "В конце статьи обязательно добавь призыв присоединиться к FlowerFlip и ссылку-приглашение "
                f"{invite} . Не выдумывай несуществующих фактов о платформе."
            )
            raw = call_mistral(
                [{"role": "system", "content": system},
                 {"role": "user", "content": f"Тема: {topic}. Категория: {category}."}],
                temperature=0.8, max_tokens=1800, json_mode=True
            )
            try:
                data = json.loads(raw)
            except Exception:
                return resp(502, {"error": "AI вернул некорректный ответ, попробуйте ещё раз"})
            return resp(200, {
                "draft": {
                    "title": data.get("title", topic),
                    "excerpt": data.get("excerpt", ""),
                    "body": data.get("body", ""),
                    "category": category,
                }
            })

        # Создать/сохранить статью
        if action == "save" and event.get("httpMethod") == "POST":
            title = (body.get("title") or "").strip()
            if not title:
                return resp(400, {"error": "Заголовок обязателен"})
            article_id = body.get("id")
            excerpt = body.get("excerpt", "")
            text = body.get("body", "")
            cover_url = body.get("cover_url", "")
            category = body.get("category", "Цветы")
            is_published = bool(body.get("is_published", True))
            with conn.cursor() as cur:
                if article_id:
                    cur.execute(
                        f"UPDATE {SCHEMA}.articles SET title=%s, excerpt=%s, body=%s, content=%s, cover_url=%s, "
                        f"category=%s, is_published=%s, updated_at=NOW() WHERE id=%s RETURNING id, slug",
                        (title, excerpt, text, text, cover_url, category, is_published, int(article_id))
                    )
                    row = cur.fetchone()
                else:
                    slug = slugify(title)
                    cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.articles WHERE slug = %s OR slug LIKE %s", (slug, slug + "-%"))
                    cnt = cur.fetchone()[0]
                    if cnt:
                        slug = f"{slug}-{cnt+1}"
                    cur.execute(
                        f"INSERT INTO {SCHEMA}.articles (slug, title, excerpt, body, content, cover_url, category, is_published) "
                        f"VALUES (%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id, slug",
                        (slug, title, excerpt, text, text, cover_url, category, is_published)
                    )
                    row = cur.fetchone()
            conn.commit()
            return resp(200, {"ok": True, "id": row[0], "slug": row[1]})

        if action == "delete" and event.get("httpMethod") == "POST":
            article_id = int(body.get("id", 0))
            with conn.cursor() as cur:
                cur.execute(f"DELETE FROM {SCHEMA}.articles WHERE id = %s", (article_id,))
            conn.commit()
            return resp(200, {"ok": True})

        return resp(400, {"error": "Неизвестное действие"})
    except urllib.error.HTTPError as e:
        return resp(502, {"error": "AI временно недоступен", "detail": str(e.code)})
    except Exception as e:
        return resp(500, {"error": str(e)})
    finally:
        conn.close()