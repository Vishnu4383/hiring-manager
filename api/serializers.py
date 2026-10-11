from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import Application, Debrief, Deadline, Document, Profile, Project, Question, StatusEvent


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


class QuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Question
        fields = ["text", "topic", "result"]


def clean_topic(user, raw):
    topic = " ".join(raw.split())
    known = Question.objects.filter(debrief__user=user, topic__iexact=topic).values_list("topic", flat=True)
    return known.first() or topic


class DebriefSerializer(OwnedLinkSerializer):
    questions = QuestionSerializer(many=True, required=False)

    class Meta:
        model = Debrief
        exclude = ["user"]

    def validate(self, data):
        app = data.get("application", getattr(self.instance, "application", None))
        company = data.get("company", getattr(self.instance, "company", "")).strip()
        if app and not company:
            company = app.company
        if not company:
            raise serializers.ValidationError({"company": "Add a company or link an application."})
        data["company"] = company
        return data

    def save_questions(self, debrief, items):
        for q in items:
            topic = clean_topic(debrief.user, q["topic"])
            Question.objects.create(debrief=debrief, text=q["text"], topic=topic, result=q["result"])

    def create(self, data):
        items = data.pop("questions", [])
        debrief = super().create(data)
        self.save_questions(debrief, items)
        return debrief

    def update(self, debrief, data):
        items = data.pop("questions", None)
        debrief = super().update(debrief, data)
        if items is not None:
            debrief.questions.all().delete()
            self.save_questions(debrief, items)
        return debrief


class ProfileSerializer(serializers.ModelSerializer):
    skills = serializers.ListField(child=serializers.CharField(max_length=40), max_length=30, required=False)

    class Meta:
        model = Profile
        exclude = ["id", "user"]


class ProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        exclude = ["user"]
