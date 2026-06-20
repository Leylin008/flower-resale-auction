"""Тестовая выплата через ЮKassa Payouts API — только для отладки v4"""
import json
import os
import uuid
import urllib.request
import urllib.error
import base64


def try_payout(url: str, payload: bytes, creds: str, idempotence_key: str) -> dict:
    req = urllib.request.Request(
        url, data=payload,
        headers={
            "Authorization": f"Basic {creds}",
            "Idempotence-Key": idempotence_key,
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read().decode())
            return {"ok": True, "status_code": 200, "data": data}
    except urllib.error.HTTPError as e:
        try:
            raw = e.read().decode()
            err_body = json.loads(raw) if raw else {}
        except Exception:
            err_body = {}
            raw = ""
        return {"ok": False, "status_code": e.code, "err_body": err_body, "raw": raw}
    except Exception as ex:
        return {"ok": False, "status_code": 0, "err_body": {}, "raw": str(ex)}


def handler(event: dict, context) -> dict:
    """Тест выплаты ЮKassa v4: пробует оба endpoint и возвращает детали"""
    CORS = {"Access-Control-Allow-Origin": "*"}

    agent_id = os.environ.get("YOOKASSA_PAYOUT_SHOP_ID", "").strip()
    secret = os.environ.get("YOOKASSA_PAYOUT_SECRET_KEY", "").strip()

    if not agent_id or not secret:
        return {"statusCode": 200, "headers": CORS, "body": json.dumps({
            "error": "Секреты не найдены",
            "agent_id_set": bool(agent_id),
            "secret_set": bool(secret),
        })}

    payload = json.dumps({
        "amount": {"value": "2.00", "currency": "RUB"},
        "payout_destination_data": {
            "type": "bank_card",
            "card": {"number": "4111111111111111"},
        },
        "description": "Тестовая выплата FlowerFlip",
    }).encode("utf-8")

    ikey = str(uuid.uuid4())
    creds = base64.b64encode(f"{agent_id}:{secret}".encode()).decode()

    # Пробуем оба endpoint
    r1 = try_payout("https://payouts.yookassa.ru/v3/payouts", payload, creds, ikey)
    r2 = try_payout("https://api.yookassa.ru/v3/payouts", payload, creds, str(uuid.uuid4()))

    return {"statusCode": 200, "headers": CORS, "body": json.dumps({
        "agent_id": agent_id,
        "secret_prefix": secret[:12] + "...",
        "payouts_yookassa_ru": r1,
        "api_yookassa_ru": r2,
    })}