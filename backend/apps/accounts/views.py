from rest_framework import generics, status, viewsets
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView
from django.contrib.auth import get_user_model

from apps.accounts.models import Department
from apps.accounts.permissions import IsAdmin
from apps.accounts.serializers import (
    ChangePasswordSerializer,
    CustomTokenObtainPairSerializer,
    DepartmentSerializer,
    LogoutSerializer,
    UserDetailSerializer,
    UserMinimalSerializer,
    UserProfileUpdateSerializer,
    UserRegistrationSerializer,
)

User = get_user_model()


class UserRegistrationView(APIView):
    """
    User registration endpoint. Publicly accessible.
    Strictly registers new users with the EMPLOYEE role.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = UserRegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        # Generate JWT token pair immediately upon successful registration
        refresh = RefreshToken.for_user(user)

        return Response(
            {
                "message": "User registered successfully.",
                "user": UserDetailSerializer(user).data,
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "tokens": {
                    "refresh": str(refresh),
                    "access": str(refresh.access_token),
                },
            },
            status=status.HTTP_201_CREATED,
        )


class CustomTokenObtainPairView(TokenObtainPairView):
    """
    Login endpoint. Supports authentication via username or email.
    """
    serializer_class = CustomTokenObtainPairSerializer
    permission_classes = [AllowAny]


class CurrentUserView(generics.RetrieveUpdateAPIView):
    """
    Current user profile endpoint.
    GET: Retrieve authenticated user profile.
    PATCH/PUT: Update editable profile fields (first_name, last_name, phone_number).
    """
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user

    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return UserProfileUpdateSerializer
        return UserDetailSerializer

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', True)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response(UserDetailSerializer(instance).data)


class ChangePasswordView(APIView):
    """
    Secure password change endpoint.
    Verifies old password and validates new password strength.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)

        user = request.user
        user.set_password(serializer.validated_data['new_password'])
        user.save()

        return Response(
            {"message": "Password changed successfully. Please use your new password for subsequent logins."},
            status=status.HTTP_200_OK,
        )


class LogoutView(APIView):
    """
    Logout endpoint. Blacklists the provided refresh token.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = LogoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            token = RefreshToken(serializer.validated_data['refresh'])
            token.blacklist()
            return Response(
                {"message": "Successfully logged out. Token has been blacklisted."},
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            return Response(
                {"error": "Invalid or expired token.", "details": str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )


class UserViewSet(viewsets.ModelViewSet):
    """
    User management endpoint. Strictly restricted to Administrators.
    """
    queryset = User.objects.select_related('department').all()
    permission_classes = [IsAdmin]
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['username', 'email', 'first_name', 'last_name']
    ordering_fields = ['created_at', 'username', 'role']
    ordering = ['-created_at']

    def get_serializer_class(self):
        if self.action == 'list':
            return UserMinimalSerializer
        return UserDetailSerializer


class DepartmentViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Department taxonomy listing. Publicly accessible for user registration.
    """
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    permission_classes = [AllowAny]
    pagination_class = None
