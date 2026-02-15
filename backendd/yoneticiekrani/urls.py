from django.urls import path

from . import views

urlpatterns = [
    # Dashboard
    path("dashboard/", views.dashboard_stats, name="admin-dashboard"),
    
    # İstasyon Yönetimi
    path("stations/", views.stations, name="admin-stations"),
    path("stations/<int:station_id>/", views.station_detail, name="admin-station-detail"),
    path("stations/<int:station_id>/stats/", views.station_cargo_stats, name="admin-station-stats"),
    path("stations/with-stats/", views.stations_with_cargo_stats, name="admin-stations-with-stats"),
    
    # Araç Yönetimi
    path("vehicles/", views.vehicles, name="admin-vehicles"),
    path("vehicles/<int:vehicle_id>/", views.vehicle_detail, name="admin-vehicle-detail"),
    
    # Kargo Yönetimi
    path("cargoes/", views.cargoes, name="admin-cargoes"),
    path("cargoes/<int:cargo_id>/status/", views.cargo_status, name="admin-cargo-status"),
    
    # Sefer/Rota Yönetimi
    path("trips/", views.trips, name="admin-trips"),
    path("trips/<int:trip_id>/", views.trip_detail, name="admin-trip-detail"),
    path("trips/details/", views.get_trips_with_details, name="admin-trips-details"),
    
    # Senaryo Karşılaştırma
    path("scenarios/", views.scenario_comparison, name="admin-scenarios"),
    
    # Rota Hesaplama
    path("calculate-route/", views.calculate_route, name="admin-calculate-route"),
    path("cargo-summary/", views.get_cargo_summary, name="admin-cargo-summary"),
    path("confirm-route/", views.confirm_route, name="admin-confirm-route"),
    
    # Simülasyon
    path("simulation/start/", views.start_simulation, name="admin-simulation-start"),
    path("simulation/complete/", views.complete_simulation, name="admin-simulation-complete"),
    
    # Analiz / Grafikler
    path("analytics/", views.analytics_overview, name="admin-analytics"),
    path("analytics/daily/", views.analytics_daily_details, name="admin-analytics-daily"),
]
