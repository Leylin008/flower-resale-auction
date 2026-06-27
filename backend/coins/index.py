"""Баллы «Лепестки» 🌸 — гибридная система: покупка за деньги + начисление за активность.
Траты: поднятие в топ (boost), выделение цветом/значком (highlight), продление аукциона.
Скидки на комиссию НЕТ — убрана по требованию.
"""
import json
import os
import psycopg2
from datetime import datetime, timedelta

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p84229990_flower_resale_auctio")

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Authorization, Authorization",
}

# Курс покупки: 1 ₽ = 1 балл (пакеты на фронте)
# Стоимость трат в баллах
SPEND = {
    "boost":     {"cost": 100, "hours": 24,  "label": "Поднятие в топ на 24 ч"},
    "boost_72":  {"cost": 250, "hours": 72,  "label": "Поднятие в топ на 72 ч"},
    "highlight": {"cost": 150, "hours": 48,  "label": "Выделение цветом и значком на 48 ч"},
    "extend":    {"cost": 80,  "hours": 24,  "label": "Продление аукциона на 24 ч"},
}

# Начисления за активность (type -> баллы)
EARN_RULES = {
    "welcome":        {"amount": 50,  "reason": "Бонус за регистрацию"},
    "first_sale":     {"amount": 100, "reason": "Первая продажа"},
    "sale":           {"amount": 20,  "reason": "Завершённая продажа"},
    "review":         {"amount": 10,  "reason": "Оставлен отзыв"},
    "referral_join":  {"amount": 30,  "reason": "Приглашённый друг зарегистрировался"},
    "vk_subscribe":   {"amount": 40,  "reason": "Подписка на группу ВКонтакте"},
    "tg_subscribe":   {"amount": 40,  "reason": "Подписка на Telegram-канал"},
}

VK_BONUS = 40
TG_BONUS = 40


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def get_user(conn, token: str):
    if not token:
        return None
    with conn.cursor() as cur:
        cur.execute(
            f"SELECT u.id, u.name, u.coins, u.coins_welcome_given, u.vk_bonus_given, u.tg_bonus_given "
            f"FROM {SCHEMA}.sessions s JOIN {SCHEMA}.users u ON u.id = s.user_id "
            f"WHERE s.token = %s AND s.expires_at > NOW()", (token,)
        )
        row = cur.fetchone()
    if not row:
        return None
    return {"id": row[0], "name": row[1], "coins": int(row[2]),
            "welcome_given": bool(row[3]), "vk_bonus_given": bool(row[4]), "tg_bonus_given": bool(row[5])}


def add_coins(conn, user_id: int, amount: int, ttype: str, reason: str, ref_id=None) -> int:
    """Начисляет/списывает баллы и пишет транзакцию. amount может быть отрицательным."""
    with conn.cursor() as cur:
        cur.execute(
            f"UPDATE {SCHEMA}.users SET coins = coins + %s WHERE id = %s RETURNING coins",
            (amount, user_id)
        )
        new_balance = int(cur.fetchone()[0])
        cur.execute(
            f"INSERT INTO {SCHEMA}.coin_transactions (user_id, amount, balance_after, type, reason, ref_id) "
            f"VALUES (%s, %s, %s, %s, %s, %s)",
            (user_id, amount, new_balance, ttype, reason, ref_id)
        )
    return new_balance


def resp(code: int, body: dict):
    return {"statusCode": code, "headers": CORS, "body": json.dumps(body, default=str)}


def handler(event: dict, context) -> dict:
    """Баллы «Лепестки»: баланс, история, покупка, начисление за активность, траты на продвижение букетов."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    qs = event.get("queryStringParameters") or {}
    body = json.loads(event.get("body") or "{}")
    action = qs.get("action") or body.get("action", "")
    token = (event.get("headers") or {}).get("X-Authorization", "").replace("Bearer ", "")

    conn = get_conn()
    try:
        user = get_user(conn, token)
        if not user:
            return resp(401, {"error": "Не авторизован"})

        # Баланс + тарифы трат
        if action == "balance":
            # выдаём приветственный бонус один раз
            if not user["welcome_given"]:
                with conn.cursor() as cur:
                    cur.execute(
                        f"UPDATE {SCHEMA}.users SET coins_welcome_given = TRUE WHERE id = %s AND coins_welcome_given = FALSE RETURNING id",
                        (user["id"],)
                    )
                    given = cur.fetchone()
                if given:
                    new_bal = add_coins(conn, user["id"], EARN_RULES["welcome"]["amount"], "welcome", EARN_RULES["welcome"]["reason"])
                    conn.commit()
                    user["coins"] = new_bal
            return resp(200, {"coins": user["coins"], "spend_options": SPEND,
                              "vk_bonus_given": user["vk_bonus_given"], "vk_bonus": VK_BONUS,
                              "tg_bonus_given": user["tg_bonus_given"], "tg_bonus": TG_BONUS})

        # Бонус за подписку на группу ВКонтакте (один раз)
        if action == "vk_subscribe":
            if user["vk_bonus_given"]:
                return resp(200, {"ok": False, "already": True, "coins": user["coins"],
                                  "message": "Бонус за подписку уже получен"})
            with conn.cursor() as cur:
                cur.execute(
                    f"UPDATE {SCHEMA}.users SET vk_bonus_given = TRUE WHERE id = %s AND vk_bonus_given = FALSE RETURNING id",
                    (user["id"],)
                )
                given = cur.fetchone()
            if not given:
                return resp(200, {"ok": False, "already": True, "coins": user["coins"]})
            new_bal = add_coins(conn, user["id"], VK_BONUS, "vk_subscribe", EARN_RULES["vk_subscribe"]["reason"])
            conn.commit()
            return resp(200, {"ok": True, "coins": new_bal, "earned": VK_BONUS})

        # Бонус за подписку на Telegram-канал (один раз)
        if action == "tg_subscribe":
            if user["tg_bonus_given"]:
                return resp(200, {"ok": False, "already": True, "coins": user["coins"],
                                  "message": "Бонус за подписку уже получен"})
            with conn.cursor() as cur:
                cur.execute(
                    f"UPDATE {SCHEMA}.users SET tg_bonus_given = TRUE WHERE id = %s AND tg_bonus_given = FALSE RETURNING id",
                    (user["id"],)
                )
                given = cur.fetchone()
            if not given:
                return resp(200, {"ok": False, "already": True, "coins": user["coins"]})
            new_bal = add_coins(conn, user["id"], TG_BONUS, "tg_subscribe", EARN_RULES["tg_subscribe"]["reason"])
            conn.commit()
            return resp(200, {"ok": True, "coins": new_bal, "earned": TG_BONUS})

        # История транзакций
        if action == "history":
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT amount, balance_after, type, reason, created_at "
                    f"FROM {SCHEMA}.coin_transactions WHERE user_id = %s ORDER BY id DESC LIMIT 100",
                    (user["id"],)
                )
                rows = cur.fetchall()
            items = [{"amount": r[0], "balance_after": r[1], "type": r[2], "reason": r[3], "created_at": str(r[4])} for r in rows]
            return resp(200, {"items": items})

        # Покупка баллов за деньги с баланса (1 ₽ = 1 балл)
        if action == "purchase":
            pkg = int(body.get("amount", 0))
            if pkg < 50:
                return resp(400, {"error": "Минимальный пакет — 50 баллов"})
            with conn.cursor() as cur:
                cur.execute(f"SELECT balance FROM {SCHEMA}.users WHERE id = %s", (user["id"],))
                rub_balance = float(cur.fetchone()[0])
                if rub_balance < pkg:
                    return resp(400, {"error": f"Недостаточно средств. Нужно {pkg} ₽, у вас {rub_balance:.0f} ₽"})
                cur.execute(f"UPDATE {SCHEMA}.users SET balance = balance - %s WHERE id = %s", (pkg, user["id"]))
            new_bal = add_coins(conn, user["id"], pkg, "purchase", f"Покупка {pkg} баллов")
            conn.commit()
            return resp(200, {"ok": True, "coins": new_bal})

        # Трата баллов на продвижение букета
        if action == "spend":
            kind = body.get("kind", "")
            bouquet_id = int(body.get("bouquet_id", 0))
            if kind not in SPEND:
                return resp(400, {"error": "Неизвестная опция"})
            opt = SPEND[kind]
            if user["coins"] < opt["cost"]:
                return resp(400, {"error": f"Недостаточно баллов. Нужно {opt['cost']} 🌸, у вас {user['coins']}"})

            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT seller_id, status, ends_at FROM {SCHEMA}.bouquets WHERE id = %s",
                    (bouquet_id,)
                )
                br = cur.fetchone()
                if not br:
                    return resp(404, {"error": "Букет не найден"})
                if br[0] != user["id"]:
                    return resp(403, {"error": "Это не ваш букет"})

                now = datetime.now()
                until = now + timedelta(hours=opt["hours"])
                if kind in ("boost", "boost_72"):
                    cur.execute(f"UPDATE {SCHEMA}.bouquets SET boosted_until = %s WHERE id = %s", (until, bouquet_id))
                elif kind == "highlight":
                    cur.execute(f"UPDATE {SCHEMA}.bouquets SET highlighted_until = %s WHERE id = %s", (until, bouquet_id))
                elif kind == "extend":
                    cur.execute(
                        f"UPDATE {SCHEMA}.bouquets SET ends_at = ends_at + INTERVAL '{opt['hours']} hours' WHERE id = %s",
                        (bouquet_id,)
                    )

            new_bal = add_coins(conn, user["id"], -opt["cost"], "spend", opt["label"], ref_id=bouquet_id)
            conn.commit()
            return resp(200, {"ok": True, "coins": new_bal, "applied": opt["label"]})

        # Внутреннее начисление за активность (для вызова другими функциями/админом)
        if action == "earn":
            rule = body.get("rule", "")
            if rule not in EARN_RULES:
                return resp(400, {"error": "Неизвестное правило начисления"})
            r = EARN_RULES[rule]
            new_bal = add_coins(conn, user["id"], r["amount"], rule, r["reason"])
            conn.commit()
            return resp(200, {"ok": True, "coins": new_bal})

        return resp(400, {"error": "Неизвестное действие"})
    finally:
        conn.close()