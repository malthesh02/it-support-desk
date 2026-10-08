from django.db import models


class PriorityLevel(models.TextChoices):
    LOW = 'LOW', 'Low'
    MEDIUM = 'MEDIUM', 'Medium'
    HIGH = 'HIGH', 'High'
    CRITICAL = 'CRITICAL', 'Critical'


class Category(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'categories_category'
        verbose_name_plural = 'categories'
        ordering = ['name']

    def __str__(self):
        return self.name


class SubCategory(models.Model):
    category = models.ForeignKey(
        Category,
        on_delete=models.CASCADE,
        related_name='subcategories'
    )
    name = models.CharField(max_length=100)
    default_priority = models.CharField(
        max_length=20,
        choices=PriorityLevel.choices,
        default=PriorityLevel.MEDIUM
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'categories_subcategory'
        unique_together = ('category', 'name')
        ordering = ['category', 'name']

    def __str__(self):
        return f"{self.category.name} -> {self.name}"


class SlaPolicy(models.Model):
    name = models.CharField(max_length=100)
    priority = models.CharField(
        max_length=20,
        choices=PriorityLevel.choices,
        unique=True,
        db_index=True
    )
    response_time_minutes = models.PositiveIntegerField(
        help_text="Target response time in minutes for initial agent response"
    )
    resolution_time_minutes = models.PositiveIntegerField(
        help_text="Target resolution time in minutes"
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'categories_slapolicy'
        verbose_name_plural = 'SLA Policies'
        ordering = ['priority']

    def __str__(self):
        return f"SLA: {self.get_priority_display()} (Resp: {self.response_time_minutes}m, Res: {self.resolution_time_minutes}m)"
