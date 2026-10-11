from django.contrib.auth.models import User
from django.core.validators import MaxValueValidator, MinValueValidator
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


class Debrief(models.Model):
    class Round(models.TextChoices):
        RESUME = "resume", "Resume rejection"
        OA = "oa", "OA"
        THEORY = "theory", "Technical (theory)"
        PROJECT = "project", "Technical (project review)"
        HR = "hr", "HR"
        GD = "gd", "Group discussion"
        HACKATHON = "hackathon", "Hackathon"

    class Outcome(models.TextChoices):
        CLEARED = "cleared"
        FAILED = "failed"
        WAITING = "waiting"

    user = models.ForeignKey(User, on_delete=models.CASCADE)
    application = models.ForeignKey(Application, null=True, blank=True, on_delete=models.SET_NULL)
    company = models.CharField(max_length=120, blank=True)
    round_type = models.CharField(max_length=12, choices=Round.choices)
    round_no = models.PositiveSmallIntegerField(default=1)
    date = models.DateField()
    outcome = models.CharField(max_length=10, choices=Outcome.choices, default=Outcome.WAITING)
    went_well = models.TextField(blank=True)
    to_improve = models.TextField(blank=True)


class Question(models.Model):
    class Result(models.TextChoices):
        UNKNOWN = "unknown"
        PARTIAL = "partial"
        SOLVED = "solved"

    debrief = models.ForeignKey(Debrief, on_delete=models.CASCADE, related_name="questions")
    text = models.CharField(max_length=300)
    topic = models.CharField(max_length=80)
    result = models.CharField(max_length=8, choices=Result.choices)


class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    full_name = models.CharField(max_length=120, blank=True)
    intro = models.TextField(blank=True)
    university = models.CharField(max_length=160, blank=True)
    degree = models.CharField(max_length=160, blank=True)
    gpa = models.DecimalField(
        max_digits=4, decimal_places=2, null=True, blank=True,
        validators=[MinValueValidator(0), MaxValueValidator(10)],
    )
    skills = models.JSONField(default=list, blank=True)
    github = models.URLField(blank=True)
    linkedin = models.URLField(blank=True)
    leetcode = models.URLField(blank=True)
    email = models.EmailField(blank=True)


class Project(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    title = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    tech = models.CharField(max_length=200, blank=True)
    repo_url = models.URLField(blank=True)
    live_url = models.URLField(blank=True)
