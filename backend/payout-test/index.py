"""Тестовая выплата через ЮKassa Payouts API — только для отладки v2"""
import json
import os
import uuid
import urllib.request
import urllib.error
import base64


def handler(event: dict, context) -> dict:
    """Тест выплаты ЮKassa: отправляет 2 рубля на тестовую карту"""
    CORS = {"Access-Control-Allow-Origin": "*"}

    agent_id = os.environ.get("YOOKASSA_PAYOUT_SHOP_ID", "").strip()
    secret = os.environ.get("YOOKASSA_PAYOUT_SECRET_KEY", "").strip()

    if not agent_id or not secret:
        return {"statusCode": 500, "headers": CORS, "body": json.dumps({
            "error": "Секреты не найдены",
            "agent_id_set": bool(agent_id),
            "secret_set": bool(secret),
        })}

    # Тестовая карта ЮKassa для выплат
    payload = json.dumps({
        "amount": {"value": "2.00", "currency": "RUB"},
        "payout_destination_data": {
            "type": "bank_card",
            "card": {"number": "5536913776755303"},
        },
        "description": "Тестовая выплата FlowerFlip",
    }).encode("utf-8")

    idempotence_key = str(uuid.uuid4())
    creds = base64.b64encode(f"{agent_id}:{secret}".encode()).decode()

    req = urllib.request.Request(
        "https://payouts.yookassa.ru/v3/payouts",
        data=payload,
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
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({
                "ok": True,
                "payout_id": data.get("id"),
                "status": data.get("status"),
                "amount": data.get("amount"),
                "raw": data,
            })}
    except urllib.error.HTTPError as e:
        try:
            err_body = json.loads(e.read().decode())
        except Exception:
            err_body = {}
        return {"statusCode": e.code, "headers": CORS, "body": json.dumps({
            "ok": False,
            "http_code": e.code,
            "error": err_body.get("description") or err_body.get("message") or str(e),
            "yookassa_code": err_body.get("code"),
            "raw": err_body,
            "agent_id_used": agent_id,
            "idempotence_key": idempotence_key,
        })}
    except Exception as e:
        return {"statusCode": 500, "headers": CORS, "body": json.dumps({"ok": False, "error": str(e)})}