from rest_framework.authentication import SessionAuthentication

class CsrfExemptSessionAuthentication(SessionAuthentication):
    """
    SessionAuthentication without CSRF enforcement for REST API clients.
    Permits seamless POST/PUT/DELETE requests from decoupled React SPA frontend.
    """
    def enforce_csrf(self, request):
        return  # CSRF validation skipped for API calls
