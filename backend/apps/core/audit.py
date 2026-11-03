from apps.core.models import AuditLog


def log_event(action, entity_type, entity_id, user=None, old_values=None, new_values=None, reason=None, details=None, ip_address=None):
    """
    Standardized logger for system audit trail.
    Ensures every change complies with Templegate audit specifications.
    """
    try:
        user_display = "System Automation"
        if user and user.is_authenticated:
            role = getattr(user.profile, 'role', 'USER') if hasattr(user, 'profile') else 'USER'
            user_display = f"{user.get_full_name() or user.username} [{role}]"

        return AuditLog.objects.create(
            user=user if user and user.is_authenticated else None,
            user_display=user_display,
            action=action,
            entity_type=entity_type,
            entity_id=str(entity_id),
            old_values=old_values,
            new_values=new_values,
            reason=reason,
            details=details,
            ip_address=ip_address
        )
    except Exception as e:
        print(f"Error creating audit log: {e}")
        return None
