from datetime import datetime, timezone
from db.client import get_audit_logs_collection  # type: ignore


async def log_action(
    action: str,
    user: dict,
    content_id: str,
    content_title: str,
    changes: dict | None = None,
    ip: str | None = None,
):
    """
    Insert an audit log entry into the audit_logs collection.

    action        — One of CREATE, UPDATE, DELETE, DOWNLOAD, EXPORT
    user          — JWT payload dict with user_id, username
    content_id    — Presentation ObjectId as string
    content_title — Snapshot of the title at time of action
    changes       — Optional dict of {field: {before, after}} for UPDATE actions
    ip            — Optional client IP address
    """
    coll = get_audit_logs_collection()
    try:
        await coll.insert_one({
            "action": action.upper(),
            "user_id": user.get("user_id"),
            "username": user.get("username", user.get("user_id")),
            "content_id": content_id,
            "content_title": content_title,
            "timestamp": datetime.now(timezone.utc),
            "changes": changes or {},
            "ip_address": ip,
        })
    except Exception:
        # Audit logging must never break the main request
        pass
