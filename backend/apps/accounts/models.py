from django.contrib.auth.models import AbstractUser
from django.db import models


class Department(models.Model):
    name = models.CharField(max_length=100, unique=True)
    code = models.CharField(max_length=20, unique=True)
    description = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'accounts_department'
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.code})"


class UserRole(models.TextChoices):
    EMPLOYEE = 'EMPLOYEE', 'Employee'
    SUPPORT_AGENT = 'SUPPORT_AGENT', 'Support Agent'
    ADMIN = 'ADMIN', 'Administrator'

UserRole.AGENT = UserRole.SUPPORT_AGENT


class User(AbstractUser):
    email = models.EmailField(unique=True, db_index=True)
    role = models.CharField(
        max_length=20,
        choices=UserRole.choices,
        default=UserRole.EMPLOYEE,
        db_index=True,
    )
    department = models.ForeignKey(
        Department,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='users',
    )
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    REQUIRED_FIELDS = ['email', 'first_name', 'last_name']

    class Meta:
        db_table = 'accounts_user'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.get_full_name() or self.username} <{self.email}> ({self.role})"

    @property
    def is_admin_role(self):
        return self.role == UserRole.ADMIN or self.is_superuser

    @property
    def is_support_agent_role(self):
        return self.role in (UserRole.SUPPORT_AGENT, UserRole.ADMIN, 'AGENT') or self.is_staff

    @property
    def is_agent_role(self):
        return self.is_support_agent_role

    @property
    def is_employee_role(self):
        return self.role == UserRole.EMPLOYEE
