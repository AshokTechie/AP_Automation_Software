from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # Templegate AP Modular REST APIs
    path('api/v1/core/', include('apps.core.urls')),
    path('api/v1/vendors/', include('apps.vendors.urls')),
    path('api/v1/procurement/', include('apps.procurement.urls')),
    path('api/v1/invoices/', include('apps.invoices.urls')),
    path('api/v1/matching/', include('apps.matching.urls')),
    path('api/v1/exceptions-mgmt/', include('apps.exceptions_mgmt.urls')),
    path('api/v1/workflows/', include('apps.workflows.urls')),
    path('api/v1/payments/', include('apps.payments.urls')),
    path('api/v1/analytics/', include('apps.analytics.urls')),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
