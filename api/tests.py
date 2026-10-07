from unittest.mock import MagicMock, patch

import pytest
from botocore.exceptions import ClientError
from rest_framework.test import APIClient

from .models import StatusEvent

pytestmark = pytest.mark.django_db


def signup(email="a@x.com"):
    c = APIClient()
    r = c.post("/api/auth/register/", {"email": email, "password": "correct-horse-9"})
    assert r.status_code == 201
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {r.data['access']}")
    return c


def add_app(c, **extra):
    r = c.post("/api/applications/", {"company": "Acme", "role": "SWE", **extra})
    assert r.status_code == 201
    return r.data


def test_auth_cycle():
    c = APIClient()
    c.post("/api/auth/register/", {"email": "a@x.com", "password": "correct-horse-9"})
    assert c.post("/api/auth/login/", {"email": "a@x.com", "password": "nope"}).status_code == 401

    r = c.post("/api/auth/login/", {"email": "A@x.com", "password": "correct-horse-9"})
    assert r.status_code == 200
    assert r.cookies["refresh"]["httponly"]

    r = c.post("/api/auth/refresh/")
    assert r.status_code == 200 and "access" in r.data

    old = r.cookies["refresh"].value
    c.post("/api/auth/logout/")
    c.cookies["refresh"] = old
    assert c.post("/api/auth/refresh/").status_code == 401


def test_requires_login():
    assert APIClient().get("/api/applications/").status_code == 401


def test_status_change_writes_event():
    c = signup()
    app = add_app(c)
    c.patch(f"/api/applications/{app['id']}/", {"status": "applied"})
    c.patch(f"/api/applications/{app['id']}/", {"notes": "referred"})
    moves = list(StatusEvent.objects.values_list("old", "new"))
    assert moves == [("", "wishlist"), ("wishlist", "applied")]


def test_users_cannot_touch_each_others_data():
    a, b = signup("a@x.com"), signup("b@x.com")
    app = add_app(a)
    assert b.get("/api/applications/").data == []
    assert b.patch(f"/api/applications/{app['id']}/", {"company": "x"}).status_code == 404
    r = b.post("/api/deadlines/", {"title": "t", "due_at": "2026-11-01T10:00:00Z", "application": app["id"]})
    assert r.status_code == 400


@patch("api.views.r2")
def test_vault_flow(r2):
    r2.return_value = MagicMock()
    r2.return_value.generate_presigned_url.return_value = "https://signed"
    r2.return_value.head_object.return_value = {"ContentLength": 1200}
    a, b = signup("a@x.com"), signup("b@x.com")

    assert a.post("/api/documents/upload-url/", {"content_type": "text/html"}).status_code == 400
    up = a.post("/api/documents/upload-url/", {"content_type": "application/pdf"}).data
    assert up["url"] == "https://signed"

    r = a.post("/api/documents/", {"name": "cv", "kind": "resume", "key": up["key"]})
    assert r.status_code == 201 and r.data["size"] == 1200

    assert b.post("/api/documents/", {"name": "steal", "key": up["key"]}).status_code == 400
    assert b.get(f"/api/documents/{r.data['id']}/download/").status_code == 404
    assert a.get(f"/api/documents/{r.data['id']}/download/").data["url"] == "https://signed"


@patch("api.views.r2")
def test_vault_rejects_missing_or_huge_upload(r2):
    c = signup()
    key = "u1/abc.pdf"
    err = ClientError({"Error": {"Code": "404"}}, "HeadObject")
    r2.return_value.head_object.side_effect = err
    assert c.post("/api/documents/", {"name": "cv", "key": key}).status_code == 400

    r2.return_value.head_object.side_effect = None
    r2.return_value.head_object.return_value = {"ContentLength": 50 * 1024 * 1024}
    assert c.post("/api/documents/", {"name": "cv", "key": key}).status_code == 400
    r2.return_value.delete_object.assert_called_once()


def test_stats():
    c = signup()
    one, two = add_app(c), add_app(c)
    for app in (one, two):
        c.patch(f"/api/applications/{app['id']}/", {"status": "applied"})
    c.patch(f"/api/applications/{one['id']}/", {"status": "interview"})
    data = c.get("/api/stats/").data
    assert data["reached"]["wishlist"] == 2
    assert data["reached"]["applied"] == 2
    assert data["reached"]["interview"] == 1
    assert data["avg_days_to_response"] is not None
    assert sum(w["n"] for w in data["per_week"]) == 2
