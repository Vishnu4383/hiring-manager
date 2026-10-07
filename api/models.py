from django.contrib.auth.models import User
from django.db import models


class Status(models.TextChoices):
    WISHLIST = "wishlist"
    APPLIED = "applied"
    OA = "oa"
    INTERVIEW = "interview"
    OFFER = "offer"
    REJECTED = "rejected"


class Application(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    company = models.CharField(max_length=120)
    role = models.CharField(max_length=120)
    link = models.URLField(blank=True)
    notes = models.TextField(blank=True)
    contact_name = models.CharField(max_length=120, blank=True)
    contact_email = models.EmailField(blank=True)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.WISHLIST)
    created_at = models.DateTimeField(auto_now_add=True)


class StatusEvent(models.Model):
    application = models.ForeignKey(Application, on_delete=models.CASCADE, related_name="events")
    old = models.CharField(max_length=12, blank=True)
    new = models.CharField(max_length=12, choices=Status.choices)
    at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["at", "id"]


class Deadline(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    application = models.ForeignKey(Application, null=True, blank=True, on_delete=models.SET_NULL)
    title = models.CharField(max_length=160)
    due_at = models.DateTimeField()
    done = models.BooleanField(default=False)


class Document(models.Model):
    class Kind(models.TextChoices):
        RESUME = "resume"
        TRANSCRIPT = "transcript"
        OTHER = "other"

    user = models.ForeignKey(User, on_delete=models.CASCADE)
    application = models.ForeignKey(Application, null=True, blank=True, on_delete=models.SET_NULL)
    name = models.CharField(max_length=160)
    kind = models.CharField(max_length=12, choices=Kind.choices, default=Kind.OTHER)
    key = models.CharField(max_length=200, unique=True)
    size = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)
