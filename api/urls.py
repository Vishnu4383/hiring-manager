from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("applications", views.ApplicationViewSet, basename="application")
router.register("deadlines", views.DeadlineViewSet, basename="deadline")
router.register("documents", views.DocumentViewSet, basename="document")
router.register("debriefs", views.DebriefViewSet, basename="debrief")
router.register("projects", views.ProjectViewSet, basename="project")

urlpatterns = [
    path("auth/register/", views.Register.as_view()),
    path("auth/login/", views.Login.as_view()),
    path("auth/refresh/", views.Refresh.as_view()),
    path("auth/logout/", views.Logout.as_view()),
    path("health/", views.Health.as_view()),
    path("me/", views.Me.as_view()),
    path("profile/", views.ProfileView.as_view()),
    path("topics/", views.Topics.as_view()),
    path("stats/", views.Stats.as_view()),
] + router.urls
