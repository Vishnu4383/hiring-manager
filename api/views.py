import uuid
from functools import lru_cache
from urllib.parse import quote

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from django.conf import settings
from django.contrib.auth import authenticate
from django.db import connection
from django.db.models import Count
from django.db.models.functions import TruncWeek
from rest_framework import generics, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Application, Debrief, Deadline, Document, Profile, Project, Question, Status, StatusEvent
from .serializers import (
    ApplicationSerializer,
    DeadlineSerializer,
    DebriefSerializer,
    DocumentSerializer,
    ProfileSerializer,
    ProjectSerializer,
    RegisterSerializer,
)

COOKIE = "refresh"
MAX_UPLOAD = 5 * 1024 * 1024
UPLOAD_TYPES = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "image/png": "png",
    "image/jpeg": "jpg",
}


@lru_cache
def r2():
    return boto3.client(
        "s3",
        endpoint_url=f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        region_name="auto",
        config=Config(
            signature_version="s3v4",
            request_checksum_calculation="when_required",
            response_checksum_validation="when_required",
        ),
    )


def with_cookie(response, refresh):
    response.set_cookie(
        COOKIE,
        str(refresh),
        max_age=int(settings.REFRESH_LIFETIME.total_seconds()),
        httponly=True,
        secure=not settings.DEBUG,
        samesite="Strict",
        path="/api/auth/",
    )
    return response


def issue(user, status=200):
    refresh = RefreshToken.for_user(user)
    body = {"access": str(refresh.access_token), "email": user.username}
    return with_cookie(Response(body, status=status), refresh)


class AuthView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [AnonRateThrottle]


class Register(AuthView):
    def post(self, request):
        ser = RegisterSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        return issue(ser.save(), 201)


class Login(AuthView):
    def post(self, request):
        email = str(request.data.get("email", "")).lower()
        user = authenticate(username=email, password=request.data.get("password", ""))
        if user is None:
            raise AuthenticationFailed("Wrong email or password.")
        return issue(user)


class Refresh(AuthView):
    def post(self, request):
        ser = TokenRefreshSerializer(data={"refresh": request.COOKIES.get(COOKIE, "")})
        try:
            ser.is_valid(raise_exception=True)
        except (TokenError, serializers.ValidationError, AuthenticationFailed):
            raise AuthenticationFailed("Session expired.")
        data = ser.validated_data
        return with_cookie(Response({"access": data["access"]}), data["refresh"])


class Logout(AuthView):
    def post(self, request):
        try:
            RefreshToken(request.COOKIES.get(COOKIE, "")).blacklist()
        except TokenError:
            pass
        response = Response(status=204)
        response.delete_cookie(COOKIE, path="/api/auth/")
        return response


class Health(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        with connection.cursor() as cur:
            cur.execute("SELECT 1")
        return Response({"ok": True})


class Me(APIView):
    def get(self, request):
        return Response({"email": request.user.username})


class Mine(viewsets.ModelViewSet):
    def get_queryset(self):
        return self.queryset.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class ApplicationViewSet(Mine):
    queryset = Application.objects.prefetch_related("events").order_by("-created_at")
    serializer_class = ApplicationSerializer


class DeadlineViewSet(Mine):
    queryset = Deadline.objects.order_by("due_at")
    serializer_class = DeadlineSerializer


class DocumentViewSet(Mine):
    queryset = Document.objects.order_by("-created_at")
    serializer_class = DocumentSerializer

    def perform_create(self, serializer):
        key = serializer.validated_data["key"]
        try:
            size = r2().head_object(Bucket=settings.R2_BUCKET, Key=key)["ContentLength"]
        except ClientError:
            raise serializers.ValidationError({"key": "Upload not found."})
        if size > MAX_UPLOAD:
            r2().delete_object(Bucket=settings.R2_BUCKET, Key=key)
            raise serializers.ValidationError({"key": "File is too large."})
        serializer.save(user=self.request.user, size=size)

    def perform_destroy(self, doc):
        r2().delete_object(Bucket=settings.R2_BUCKET, Key=doc.key)
        doc.delete()

    @action(detail=False, methods=["post"], url_path="upload-url")
    def upload_url(self, request):
        kind = request.data.get("content_type")
        if kind not in UPLOAD_TYPES:
            raise serializers.ValidationError({"content_type": "Only PDF, DOCX, PNG or JPEG."})
        key = f"u{request.user.id}/{uuid.uuid4().hex}.{UPLOAD_TYPES[kind]}"
        url = r2().generate_presigned_url(
            "put_object",
            Params={"Bucket": settings.R2_BUCKET, "Key": key, "ContentType": kind},
            ExpiresIn=300,
        )
        return Response({"url": url, "key": key})

    @action(detail=True, methods=["get"])
    def download(self, request, pk=None):
        doc = self.get_object()
        ext = doc.key.rsplit(".", 1)[-1]
        name = doc.name if doc.name.lower().endswith("." + ext) else f"{doc.name}.{ext}"
        url = r2().generate_presigned_url(
            "get_object",
            Params={
                "Bucket": settings.R2_BUCKET,
                "Key": doc.key,
                "ResponseContentDisposition": f"inline; filename*=UTF-8''{quote(name, safe='')}",
            },
            ExpiresIn=300,
        )
        return Response({"url": url})


class DebriefViewSet(Mine):
    queryset = Debrief.objects.prefetch_related("questions").order_by("-date", "-id")
    serializer_class = DebriefSerializer


class ProjectViewSet(Mine):
    queryset = Project.objects.order_by("id")
    serializer_class = ProjectSerializer


class ProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = ProfileSerializer

    def get_object(self):
        profile, _ = Profile.objects.get_or_create(
            user=self.request.user, defaults={"email": self.request.user.username}
        )
        return profile


RANK = {"unknown": 0, "partial": 1, "solved": 2}


class Topics(APIView):
    def get(self, request):
        rows = (
            Question.objects.filter(debrief__user=request.user)
            .select_related("debrief")
            .order_by("debrief__date", "debrief_id", "id")
        )
        topics = {}
        for q in rows:
            t = topics.setdefault(
                q.topic.lower(),
                {"topic": q.topic, "counts": {r: 0 for r in RANK}, "questions": []},
            )
            t["counts"][q.result] += 1
            t["latest"] = q.result
            t["questions"].append(
                {
                    "text": q.text,
                    "result": q.result,
                    "company": q.debrief.company,
                    "round_type": q.debrief.round_type,
                    "date": q.debrief.date,
                }
            )
        ranked = sorted(
            topics.values(),
            key=lambda t: (RANK[t["latest"]], -t["counts"]["unknown"], t["topic"].lower()),
        )
        return Response(ranked)


class Stats(APIView):
    def get(self, request):
        events = StatusEvent.objects.filter(application__user=request.user)

        reached = {s: 0 for s in Status.values}
        rows = events.values("new").annotate(n=Count("application", distinct=True))
        for row in rows:
            reached[row["new"]] = row["n"]

        applied_at, waits = {}, {}
        for e in events:
            if e.new == Status.APPLIED:
                applied_at.setdefault(e.application_id, e.at)
            elif e.new != Status.WISHLIST and e.application_id in applied_at:
                days = (e.at - applied_at[e.application_id]).total_seconds() / 86400
                waits.setdefault(e.application_id, days)

        weekly = (
            events.filter(new=Status.APPLIED)
            .annotate(week=TruncWeek("at"))
            .values("week")
            .annotate(n=Count("application", distinct=True))
            .order_by("week")
        )
        return Response(
            {
                "total": Application.objects.filter(user=request.user).count(),
                "reached": reached,
                "avg_days_to_response": sum(waits.values()) / len(waits) if waits else None,
                "per_week": [{"week": w["week"].date(), "n": w["n"]} for w in weekly],
            }
        )
