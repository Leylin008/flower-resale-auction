"""Серверная отдача OG-превью для реферальных приглашений.
Боты соцсетей (VK, Telegram, WhatsApp) получают HTML с OG-тегами и картинкой приглашения.
Обычные пользователи получают редирект на сайт с применением реферального кода.
"""
import json
import os
import psycopg2

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p84229990_flower_resale_auctio")
SITE_URL = "https://flowerflip.ru"
OG_IMAGE = "https://cdn.poehali.dev/projects/c3c15f66-a71a-4790-a1f7-f67719eb241e/files/6e80bb24-7891-4a2f-a0a3-6bffd37bf150.jpg"

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}

# Боты-парсеры превью соцсетей
BOT_AGENTS = [
    "vkshare", "vkontakte", "telegrambot", "whatsapp", "facebookexternalhit",
    "twitterbot", "slackbot", "discordbot", "skypeuripreview", "viber",
    "linkedinbot", "pinterest", "googlebot", "yandexbot", "telegram",
    "facebot", "applebot", "embedly", "developers.google.com/+/web/snippet",
]


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def is_bot(user_agent: str) -> bool:
    ua = (user_agent or "").lower()
    return any(b in ua for b in BOT_AGENTS)


def referrer_name(code: str) -> str:
    if not code:
        return ""
    try:
        conn = get_conn()
        with conn.cursor() as cur:
            cur.execute(f"SELECT name FROM {SCHEMA}.users WHERE ref_code = %s", (code.upper(),))
            row = cur.fetchone()
        conn.close()
        return row[0] if row else ""
    except Exception:
        return ""


def og_html(code: str, name: str) -> str:
    target = f"{SITE_URL}/?ref={code}"
    title = f"{name} приглашает вас в FlowerFlip 🌸" if name else "🌸 Тебя пригласили в FlowerFlip!"
    desc = "Аукцион живых букетов — свежие цветы дешевле магазина. Заходи и забирай красивые букеты выгодно!"
    return f"""<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>{title}</title>
<meta name="description" content="{desc}"/>
<meta property="og:type" content="website"/>
<meta property="og:title" content="{title}"/>
<meta property="og:description" content="{desc}"/>
<meta property="og:url" content="{target}"/>
<meta property="og:site_name" content="FlowerFlip"/>
<meta property="og:locale" content="ru_RU"/>
<meta property="og:image" content="{OG_IMAGE}"/>
<meta property="og:image:secure_url" content="{OG_IMAGE}"/>
<meta property="og:image:type" content="image/jpeg"/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>
<meta property="og:image:alt" content="Приглашение в FlowerFlip"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="{title}"/>
<meta name="twitter:description" content="{desc}"/>
<meta name="twitter:image" content="{OG_IMAGE}"/>
<meta http-equiv="refresh" content="0; url={target}"/>
</head>
<body style="background:#0f0a18;color:#fff;font-family:sans-serif;text-align:center;padding-top:80px;">
<p style="font-size:48px;">🌸</p>
<p>Открываем FlowerFlip...</p>
<a href="{target}" style="color:#ff3d8b;">Перейти на сайт</a>
</body>
</html>"""


def handler(event: dict, context) -> dict:
    """Отдаёт OG-превью приглашения ботам соцсетей и редиректит пользователей на сайт."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    qs = event.get("queryStringParameters") or {}
    code = (qs.get("code") or "").strip().upper()
    # Код может прийти из пути: i.flowerflip.ru/КОД
    if not code:
        path = (event.get("path") or event.get("rawPath") or "").strip("/")
        code = path.split("/")[-1].strip().upper() if path else ""
    headers = event.get("headers") or {}
    user_agent = headers.get("User-Agent") or headers.get("user-agent") or ""

    target = f"{SITE_URL}/?ref={code}" if code else SITE_URL

    # Боты соцсетей — отдаём HTML с OG-тегами
    if is_bot(user_agent):
        name = referrer_name(code)
        return {
            "statusCode": 200,
            "headers": {"Content-Type": "text/html; charset=utf-8", "Access-Control-Allow-Origin": "*"},
            "body": og_html(code, name),
        }

    # Обычный пользователь — редирект на сайт с реф-кодом
    return {
        "statusCode": 302,
        "headers": {"Location": target, "Access-Control-Allow-Origin": "*"},
        "body": "",
    }