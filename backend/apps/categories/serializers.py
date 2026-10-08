from rest_framework import serializers
from apps.categories.models import Category, SubCategory, SlaPolicy


class SubCategorySerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)

    class Meta:
        model = SubCategory
        fields = [
            'id', 'category', 'category_name', 'name',
            'default_priority', 'is_active', 'created_at'
        ]
        read_only_fields = ['created_at']


class CategorySerializer(serializers.ModelSerializer):
    subcategories = SubCategorySerializer(many=True, read_only=True)

    class Meta:
        model = Category
        fields = [
            'id', 'name', 'description', 'is_active',
            'subcategories', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']


class SlaPolicySerializer(serializers.ModelSerializer):
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)

    class Meta:
        model = SlaPolicy
        fields = [
            'id', 'name', 'priority', 'priority_display',
            'response_time_minutes', 'resolution_time_minutes',
            'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']
