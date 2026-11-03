from apps.core.models import UserProfile

class PersonaRoleMiddleware:
    """
    Middleware that reads the X-Persona-Role header from frontend requests
    and sets request.user to the corresponding User instance, allowing
    frictionless persona role switching for demonstration and evaluation.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        role_header = request.headers.get('X-Persona-Role')
        if role_header:
            try:
                profile = UserProfile.objects.filter(role=role_header).select_related('user').first()
                if profile and profile.user:
                    request.user = profile.user
            except Exception:
                pass
        return self.get_response(request)
