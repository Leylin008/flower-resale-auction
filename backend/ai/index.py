"""AI на Mistral: консультант по подбору букетов и модерация сообщений чатов"""
import json
import os
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


def get_user_by_token(conn, token: str):
    if not token:
        return None
    with conn.cursor() as cur:
        cur.execute(
            f"SELECT u.id, u.name FROM {SCHEMA}.sessions s "
            f"JOIN {SCHEMA}.users u ON u.id = s.user_id "
            f"WHERE s.token = %s AND s.expires_at > NOW()", (token,)
        )
        row = cur.fetchone()
    if not row:
        return None
    return {"id": row[0], "name": row[1]}


def call_mistral(messages: list, temperature: float = 0.4, max_tokens: int = 700, json_mode: bool = False) -> str:
    api_key = os.environ.get("MISTRAL_API_KEY", "")
    if not api_key:
        raise RuntimeError("MISTRAL_API_KEY not set")
    payload = {"model": MODEL, "messages": messages, "temperature": temperature, "max_tokens": max_tokens}
    if json_mode:
        payload["response_format"] = {"type": "json_object"}
    req = urllib.request.Request(
        MISTRAL_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=25) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return data["choices"][0]["message"]["content"]


def fetch_active_bouquets(conn, city: str = "", limit: int = 25):
    where = "WHERE b.status = 'active'"
    params = []
    if city:
        where += " AND LOWER(b.city) = LOWER(%s)"
        params.append(city)
    with conn.cursor() as cur:
        cur.execute(
            f"SELECT b.id, b.title, b.description, b.flowers, b.current_price, b.fixed_price, "
            f"b.sale_type, b.city, b.shop_id, sp.shop_name, ss.ai_recommend "
            f"FROM {SCHEMA}.bouquets b "
            f"LEFT JOIN {SCHEMA}.shop_profiles sp ON sp.user_id = b.shop_id "
            f"LEFT JOIN {SCHEMA}.shop_subscriptions ss ON ss.user_id = b.shop_id "
            f"AND ss.status = 'active' AND (ss.expires_at IS NULL OR ss.expires_at > NOW()) "
            f"{where} ORDER BY b.created_at DESC LIMIT {int(limit)}",
            tuple(params)
        )
        rows = cur.fetchall()
    items = []
    for r in rows:
        items.append({
            "id": r[0], "title": r[1], "description": (r[2] or "")[:200],
            "flowers": r[3] or [], "current_price": float(r[4]) if r[4] else None,
            "fixed_price": float(r[5]) if r[5] else None, "sale_type": r[6],
            "city": r[7], "shop_id": r[8], "shop_name": r[9],
            "ai_recommend": bool(r[10]),
        })
    return items


def handle_consult(conn, body):
    user_message = (body.get("message") or "").strip()
    history = body.get("history") or []
    city = (body.get("city") or "").strip()
    if not user_message:
        return {"error": "Пустое сообщение"}, 400

    bouquets = fetch_active_bouquets(conn, city)
    # приоритет магазинам с подпиской ai_recommend
    bouquets.sort(key=lambda b: (not b["ai_recommend"]))
    catalog = [{
        "id": b["id"], "title": b["title"], "flowers": b["flowers"],
        "price": b["fixed_price"] or b["current_price"], "type": b["sale_type"],
        "city": b["city"], "shop": b["shop_name"], "promoted": b["ai_recommend"],
    } for b in bouquets[:20]]

    system = (
        "Ты — дружелюбный консультант платформы FlowerFlip по перепродаже букетов. "
        "Помогаешь подобрать букет по поводу, бюджету и предпочтениям, отвечаешь на вопросы о платформе "
        "(аукцион, фиксированная цена, бронь, эскроу-оплата, доставка/самовывоз). "
        "Отвечай кратко и по-русски, тёпло и по делу. "
        "Если в каталоге есть подходящие букеты — рекомендуй 1-3 из них, называя точное название и цену. "
        "Букеты с флагом promoted=true рекомендуй в первую очередь, если они подходят запросу. "
        "Не выдумывай букеты, которых нет в каталоге. Если ничего не подходит — честно скажи об этом. "
        "Каталог активных букетов (JSON): " + json.dumps(catalog, ensure_ascii=False)
    )
    messages = [{"role": "system", "content": system}]
    for h in history[-6:]:
        role = "assistant" if h.get("role") == "assistant" else "user"
        messages.append({"role": role, "content": str(h.get("content", ""))[:1000]})
    messages.append({"role": "user", "content": user_message[:1000]})

    reply = call_mistral(messages, temperature=0.5, max_tokens=600)

    # какие букеты упомянуты — отдадим карточки на фронт
    recommended = [b for b in bouquets if str(b["id"]) in reply or b["title"] in reply][:3]
    cards = [{
        "id": b["id"], "title": b["title"], "price": b["fixed_price"] or b["current_price"],
        "sale_type": b["sale_type"], "shop_name": b["shop_name"],
    } for b in recommended]
    return {"reply": reply, "bouquets": cards}, 200


def moderate_text(text: str):
    system = (
        "Ты — модератор сообщений на торговой площадке цветов. Проверь сообщение пользователя. "
        "Верни строго JSON: {\"verdict\": \"clean|warn|block\", \"reason\": \"кратко на русском\", \"category\": \"...\"}. "
        "block — мат с оскорблениями, угрозы, мошенничество, продажа запрещённого (наркотики, оружие), "
        "разжигание ненависти, попытка увести оплату мимо площадки на сторонние реквизиты обманом. "
        "warn — подозрительно: обмен контактами для обхода эскроу, лёгкая грубость, спам/реклама. "
        "clean — обычное вежливое общение по сделке. Если сомневаешься между clean и warn — выбирай warn."
    )
    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": text[:2000]},
    ]
    raw = call_mistral(messages, temperature=0.0, max_tokens=150, json_mode=True)
    try:
        data = json.loads(raw)
    except Exception:
        return {"verdict": "clean", "reason": "", "category": ""}
    verdict = data.get("verdict", "clean")
    if verdict not in ("clean", "warn", "block"):
        verdict = "clean"
    return {"verdict": verdict, "reason": data.get("reason", ""), "category": data.get("category", "")}


def handler(event: dict, context) -> dict:
    """AI-консультант по букетам и AI-модерация сообщений чата (Mistral)"""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    qs = event.get("queryStringParameters") or {}
    body = json.loads(event.get("body") or "{}")
    action = qs.get("action") or body.get("action", "")
    token = (event.get("headers") or {}).get("X-Authorization", "").replace("Bearer ", "")

    conn = get_conn()
    try:
        if action == "consult":
            result, status = handle_consult(conn, body)
            return {"statusCode": status, "headers": CORS, "body": json.dumps(result, ensure_ascii=False)}

        if action == "moderate":
            # внутренняя проверка текста (используется и фронтом, и profile-функцией)
            text = (body.get("text") or "").strip()
            if not text:
                return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Пустой текст"})}
            res = moderate_text(text)
            return {"statusCode": 200, "headers": CORS, "body": json.dumps(res, ensure_ascii=False)}

        return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Неизвестное действие"})}
    except urllib.error.HTTPError as e:
        return {"statusCode": 502, "headers": CORS, "body": json.dumps({"error": "AI временно недоступен", "detail": str(e.code)})}
    except Exception as e:
        return {"statusCode": 500, "headers": CORS, "body": json.dumps({"error": str(e)})}
    finally:
        conn.close()
