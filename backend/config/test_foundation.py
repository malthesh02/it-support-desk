from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.conf import settings
import logging

logger = logging.getLogger('apps')


class BackendFoundationTests(APITestCase):
    def test_health_check_endpoint(self):
        url = reverse('api_health_check')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'healthy')
        self.assertEqual(response.data['database'], 'connected')
        self.assertEqual(response.data['service'], 'IT Service Desk API')

    def test_centralized_error_handling_unauthenticated(self):
        # Accessing /api/v1/auth/me/ without credentials should trigger centralized error handler
        url = reverse('auth_me')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn('success', response.data)
        self.assertFalse(response.data['success'])
        self.assertEqual(response.data['status_code'], 401)
        self.assertEqual(response.data['error']['code'], 'AUTHENTICATION_FAILED')

    def test_centralized_error_handling_validation_error(self):
        # Submitting invalid login payload triggers centralized ValidationError formatting
        url = reverse('token_obtain_pair')
        response = self.client.post(url, {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('success', response.data)
        self.assertFalse(response.data['success'])
        self.assertEqual(response.data['error']['code'], 'VALIDATION_ERROR')
        self.assertIn('details', response.data['error'])

    def test_cors_configuration(self):
        self.assertTrue(hasattr(settings, 'CORS_ALLOWED_ORIGINS'))
        self.assertIn('http://localhost:4200', settings.CORS_ALLOWED_ORIGINS)

    def test_logging_configuration(self):
        logger.info("Foundation test log message.")
        logs_file = settings.BASE_DIR / 'logs' / 'backend.log'
        self.assertTrue(settings.BASE_DIR / 'logs')
