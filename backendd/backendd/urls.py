"""backendd URL Configuration."""

from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("yonetici/", include("yoneticiekrani.urls")),
    path("api/", include("kullaniciekrani.urls")),
]
