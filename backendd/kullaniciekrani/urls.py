from django.urls import path

from . import views

urlpatterns = [
	path("register/", views.register, name="api-register"),
	path("login/", views.login, name="api-login"),
	path("stations/", views.stations, name="api-stations"),
	path("cargo/", views.cargo, name="api-cargo"),
	path("cargo/<int:cargo_id>/route/", views.cargo_route, name="api-cargo-route"),
]
