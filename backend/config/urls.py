from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)
from config.views import HealthCheckView

urlpatterns = [
    path('admin/', admin.site.urls),

    # OpenAPI Schema & Interactive Docs
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),

    # Health Check API
    path('api/v1/health/', HealthCheckView.as_view(), name='api_health_check'),
    path('api/health/', HealthCheckView.as_view(), name='api_health_check_direct'),

    # API v1 Domain Routes
    path('api/v1/', include('apps.accounts.urls')),
    path('api/v1/', include('apps.categories.urls')),
    path('api/v1/', include('apps.tickets.urls')),
    path('api/v1/', include('apps.notifications.urls')),
    path('api/v1/', include('apps.audit.urls')),

    # Direct /api/ Domain Routes (aliases for client compatibility)
    path('api/', include('apps.accounts.urls')),
    path('api/', include('apps.categories.urls')),
    path('api/', include('apps.tickets.urls')),
    path('api/', include('apps.notifications.urls')),
    path('api/', include('apps.audit.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
