from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import Application, Deadline, Document, StatusEvent


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    # is_valid() runs any method below starting as validate_...()

    def validate_email(self, value):
        value = value.lower()
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("That email is already registered.")
        return value

    def validate_password(self, value):
        validate_password(value)
        return value

    def create(self, data):
        return User.objects.create_user(data["email"], data["email"], data["password"])


class EventSerializer(serializers.ModelSerializer):
    class Meta:
        model = StatusEvent
        fields = ["old", "new", "at"]


class ApplicationSerializer(serializers.ModelSerializer):
    events = EventSerializer(many=True, read_only=True)

    class Meta:
        model = Application
        exclude = ["user"]

    def create(self, data):
        app = super().create(data)
        StatusEvent.objects.create(application=app, new=app.status)
        return app

    def update(self, app, data):
        before = app.status
        app = super().update(app, data)
        if app.status != before:
            StatusEvent.objects.create(application=app, old=before, new=app.status)
        return app


class OwnedLinkSerializer(serializers.ModelSerializer):
    def validate_application(self, app):
        if app and app.user_id != self.context["request"].user.id:
            raise serializers.ValidationError("Application not found.")
        return app


class DeadlineSerializer(OwnedLinkSerializer):
    class Meta:
        model = Deadline
        exclude = ["user"]


class DocumentSerializer(OwnedLinkSerializer):
    class Meta:
        model = Document
        exclude = ["user"]
        read_only_fields = ["size"]

    def validate_key(self, key):
        if not key.startswith(f"u{self.context['request'].user.id}/"):
            raise serializers.ValidationError("Invalid key.")
        return key

    def update(self, doc, data):
        data.pop("key", None)
        return super().update(doc, data)
