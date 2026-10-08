from django.db import connection
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework import status


class HealthCheckView(APIView):
    """
    Health check endpoint validating API readiness and database connectivity.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        db_status = "connected"
        http_status = status.HTTP_200_OK

        try:
            connection.ensure_connection()
        except Exception as e:
            db_status = f"database_error: {str(e)}"
            http_status = status.HTTP_503_SERVICE_UNAVAILABLE

        return Response(
            {
                "status": "healthy" if http_status == status.HTTP_200_OK else "unhealthy",
                "database": db_status,
                "timestamp": timezone.now().isoformat(),
                "service": "IT Service Desk API",
                "version": "1.0.0",
            },
            status=http_status,
        )
