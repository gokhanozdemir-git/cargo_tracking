import json
from datetime import date, timedelta
from collections import defaultdict

from django.contrib.auth import get_user_model
from django.contrib.sessions.models import Session
from django.db.models import Sum, Count
from django.db.models.functions import TruncDate
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .models import Station, Vehicle, Cargo, Trip

User = get_user_model()


# ==================== YARDIMCI FONKSİYONLAR ====================

def _json_body(request):
    """Request body'den JSON parse et."""
    try:
        return json.loads(request.body.decode("utf-8") or "{}")
    except (json.JSONDecodeError, UnicodeDecodeError):
        return None


def _get_authenticated_admin(request):
    """Session token ile admin kullanıcıyı doğrula."""
    # Cookie-based session kontrolü
    if getattr(request, "user", None) and request.user.is_authenticated:
        if getattr(request.user, "role", None) == "admin":
            return request.user
        return None

    # Header-based session kontrolü
    auth_header = request.headers.get("Authorization", "") or ""
    token = None
    if auth_header.lower().startswith("session "):
        token = auth_header.split(None, 1)[1].strip()
    elif request.headers.get("X-Session-Key"):
        token = request.headers["X-Session-Key"].strip()

    if not token:
        return None

    try:
        session = Session.objects.get(session_key=token, expire_date__gt=timezone.now())
        data = session.get_decoded()
        user_id = data.get("_auth_user_id")
        if not user_id:
            return None
        user = User.objects.filter(id=user_id).first()
        if user and getattr(user, "role", None) == "admin":
            return user
        return None
    except Session.DoesNotExist:
        return None


# ==================== DASHBOARD ====================

@csrf_exempt
@require_http_methods(["GET"])
def dashboard_stats(request):
    """Dashboard için özet istatistikler."""
    admin = _get_authenticated_admin(request)
    if admin is None:
        return JsonResponse({"message": "Yetki gerekiyor."}, status=403)

    # Araç istatistikleri
    total_vehicles = Vehicle.objects.count()
    owned_vehicles = Vehicle.objects.filter(is_rented=False).count()
    rented_vehicles = Vehicle.objects.filter(is_rented=True).count()

    # Kargo istatistikleri
    pending_cargoes = Cargo.objects.filter(status="pending")
    pending_count = pending_cargoes.count()
    pending_weight = pending_cargoes.aggregate(total=Sum("weight"))["total"] or 0

    in_transit_count = Cargo.objects.filter(status="in_transit").count()
    delivered_count = Cargo.objects.filter(status="delivered").count()

    # İstasyon sayısı
    station_count = Station.objects.count()

    # Bugünkü maliyet (Trip'lerden)
    today = date.today()
    today_trips = Trip.objects.filter(planned_date=today)
    total_cost = today_trips.aggregate(total=Sum("total_cost"))["total"] or 0
    total_distance = today_trips.aggregate(total=Sum("total_distance"))["total"] or 0

    # Yakıt ve kiralama maliyeti ayrımı (yakıt = mesafe * 1 birim)
    fuel_cost = total_distance
    rental_cost = total_cost - fuel_cost if total_cost > fuel_cost else 0

    # Bekleyen kargoların tarih bazlı dağılımı (TÜM TARİHLER)
    pending_by_date = []
    pending_cargoes_all = Cargo.objects.filter(status="pending").exclude(target_date__isnull=True)
    
    # Tarihe göre grupla
    pending_grouped = {}
    for cargo in pending_cargoes_all:
        date_key = cargo.target_date.isoformat()
        if date_key not in pending_grouped:
            pending_grouped[date_key] = {
                "date": date_key,
                "date_display": cargo.target_date.strftime("%d.%m.%Y"),
                "count": 0,
                "weight": 0.0
            }
        pending_grouped[date_key]["count"] += 1
        pending_grouped[date_key]["weight"] += cargo.weight * cargo.quantity
    
    # Tarihe göre sırala (en yakından en uzağa)
    pending_by_date = sorted(
        [{"date": v["date"], "date_display": v["date_display"], "count": v["count"], "weight": round(v["weight"], 1)} 
         for v in pending_grouped.values()],
        key=lambda x: x["date"]
    )
    
    # Yolda olan kargoların tarih bazlı dağılımı (TÜM TARİHLER)
    in_transit_by_date = []
    in_transit_cargoes_all = Cargo.objects.filter(status="in_transit").exclude(target_date__isnull=True)
    
    # Tarihe göre grupla
    in_transit_grouped = {}
    for cargo in in_transit_cargoes_all:
        date_key = cargo.target_date.isoformat()
        if date_key not in in_transit_grouped:
            in_transit_grouped[date_key] = {
                "date": date_key,
                "date_display": cargo.target_date.strftime("%d.%m.%Y"),
                "count": 0,
                "weight": 0.0
            }
        in_transit_grouped[date_key]["count"] += 1
        in_transit_grouped[date_key]["weight"] += cargo.weight * cargo.quantity
    
    # Tarihe göre sırala (en yakından en uzağa)
    in_transit_by_date = sorted(
        [{"date": v["date"], "date_display": v["date_display"], "count": v["count"], "weight": round(v["weight"], 1)} 
         for v in in_transit_grouped.values()],
        key=lambda x: x["date"]
    )

    return JsonResponse({
        "vehicles": {
            "total": total_vehicles,
            "owned": owned_vehicles,
            "rented": rented_vehicles,
        },
        "cargo": {
            "pending_count": pending_count,
            "pending_weight": round(pending_weight, 2),
            "in_transit": in_transit_count,
            "delivered": delivered_count,
        },
        "stations": station_count,
        "costs": {
            "total": round(total_cost, 2),
            "fuel": round(fuel_cost, 2),
            "rental": round(rental_cost, 2),
        },
        "distance": round(total_distance, 2),
        "pending_by_date": pending_by_date,
        "in_transit_by_date": in_transit_by_date,
    }, status=200)


# ==================== İSTASYON YÖNETİMİ ====================

@csrf_exempt
@require_http_methods(["GET", "POST"])
def stations(request):
    """İstasyonları listele veya yeni istasyon ekle."""
    admin = _get_authenticated_admin(request)
    if admin is None:
        return JsonResponse({"message": "Yetki gerekiyor."}, status=403)

    if request.method == "GET":
        data = [
            {
                "id": s.id,
                "name": s.name,
                "lat": s.latitude,
                "lng": s.longitude,
            }
            for s in Station.objects.all().order_by("id")
        ]
        return JsonResponse({"stations": data}, status=200)

    # POST - Yeni istasyon ekle
    data = _json_body(request)
    if data is None:
        return JsonResponse({"message": "Geçersiz JSON."}, status=400)

    name = (data.get("name") or "").strip()
    try:
        lat = float(data.get("lat"))
        lng = float(data.get("lng"))
    except (TypeError, ValueError):
        return JsonResponse({"message": "Geçerli koordinat girin."}, status=400)

    if not name:
        return JsonResponse({"message": "İstasyon adı zorunludur."}, status=400)

    if Station.objects.filter(name=name).exists():
        return JsonResponse({"message": "Bu isimde istasyon zaten var."}, status=409)

    station = Station.objects.create(name=name, latitude=lat, longitude=lng)

    return JsonResponse({
        "message": "İstasyon eklendi.",
        "station": {
            "id": station.id,
            "name": station.name,
            "lat": station.latitude,
            "lng": station.longitude,
        }
    }, status=201)


@csrf_exempt
@require_http_methods(["DELETE"])
def station_detail(request, station_id):
    """İstasyon sil."""
    admin = _get_authenticated_admin(request)
    if admin is None:
        return JsonResponse({"message": "Yetki gerekiyor."}, status=403)

    try:
        station = Station.objects.get(id=station_id)
    except Station.DoesNotExist:
        return JsonResponse({"message": "İstasyon bulunamadı."}, status=404)

    station.delete()
    return JsonResponse({"message": "İstasyon silindi."}, status=200)


@csrf_exempt
@require_http_methods(["GET"])
def station_cargo_stats(request, station_id):
    """Belirli bir istasyondaki kargo istatistiklerini getir."""
    admin = _get_authenticated_admin(request)
    if admin is None:
        return JsonResponse({"message": "Yetki gerekiyor."}, status=403)

    try:
        station = Station.objects.get(id=station_id)
    except Station.DoesNotExist:
        return JsonResponse({"message": "İstasyon bulunamadı."}, status=404)

    # Bekleyen kargolar (bir sonraki gün için planlanacak)
    pending_cargoes = Cargo.objects.filter(station=station, status="pending")
    pending_count = pending_cargoes.count()
    pending_weight = pending_cargoes.aggregate(total=Sum("weight"))["total"] or 0
    
    # Toplam miktar (quantity)
    pending_quantity = pending_cargoes.aggregate(total=Sum("quantity"))["total"] or 0

    return JsonResponse({
        "station_id": station.id,
        "station_name": station.name,
        "pending_cargo_count": pending_count,
        "pending_total_weight": pending_weight,
        "pending_total_quantity": pending_quantity,
    }, status=200)


@csrf_exempt
@require_http_methods(["GET"])
def stations_with_cargo_stats(request):
    """Tüm istasyonları kargo istatistikleriyle birlikte getir."""
    admin = _get_authenticated_admin(request)
    if admin is None:
        return JsonResponse({"message": "Yetki gerekiyor."}, status=403)

    stations_data = []
    for station in Station.objects.all().order_by("id"):
        pending_cargoes = Cargo.objects.filter(station=station, status="pending")
        pending_count = pending_cargoes.count()
        pending_weight = pending_cargoes.aggregate(total=Sum("weight"))["total"] or 0
        pending_quantity = pending_cargoes.aggregate(total=Sum("quantity"))["total"] or 0

        stations_data.append({
            "id": station.id,
            "name": station.name,
            "lat": station.latitude,
            "lng": station.longitude,
            "pending_cargo_count": pending_count,
            "pending_total_weight": pending_weight,
            "pending_total_quantity": pending_quantity,
        })

    return JsonResponse({"stations": stations_data}, status=200)


# ==================== ARAÇ YÖNETİMİ ====================

@csrf_exempt
@require_http_methods(["GET", "POST"])
def vehicles(request):
    """Araçları listele veya yeni araç ekle."""
    admin = _get_authenticated_admin(request)
    if admin is None:
        return JsonResponse({"message": "Yetki gerekiyor."}, status=403)

    if request.method == "GET":
        data = [
            {
                "id": v.id,
                "capacity": v.capacity,
                "is_rented": v.is_rented,
                "rental_cost": v.rental_cost,
            }
            for v in Vehicle.objects.all().order_by("id")
        ]
        return JsonResponse({"vehicles": data}, status=200)

    # POST - Yeni araç ekle
    data = _json_body(request)
    if data is None:
        return JsonResponse({"message": "Geçersiz JSON."}, status=400)

    try:
        capacity = int(data.get("capacity"))
    except (TypeError, ValueError):
        return JsonResponse({"message": "Geçerli kapasite girin."}, status=400)

    is_rented = bool(data.get("is_rented", False))
    rental_cost = float(data.get("rental_cost", 200.0)) if is_rented else 0.0

    vehicle = Vehicle.objects.create(
        capacity=capacity,
        is_rented=is_rented,
        rental_cost=rental_cost,
    )

    return JsonResponse({
        "message": "Araç eklendi.",
        "vehicle": {
            "id": vehicle.id,
            "capacity": vehicle.capacity,
            "is_rented": vehicle.is_rented,
            "rental_cost": vehicle.rental_cost,
        }
    }, status=201)


@csrf_exempt
@require_http_methods(["DELETE"])
def vehicle_detail(request, vehicle_id):
    """Araç sil."""
    admin = _get_authenticated_admin(request)
    if admin is None:
        return JsonResponse({"message": "Yetki gerekiyor."}, status=403)

    try:
        vehicle = Vehicle.objects.get(id=vehicle_id)
    except Vehicle.DoesNotExist:
        return JsonResponse({"message": "Araç bulunamadı."}, status=404)

    vehicle.delete()
    return JsonResponse({"message": "Araç silindi."}, status=200)


# ==================== KARGO YÖNETİMİ ====================

@csrf_exempt
@require_http_methods(["GET"])
def cargoes(request):
    """Tüm kargoları listele (admin için)."""
    admin = _get_authenticated_admin(request)
    if admin is None:
        return JsonResponse({"message": "Yetki gerekiyor."}, status=403)

    status_filter = request.GET.get("status")
    qs = Cargo.objects.select_related("sender", "station").order_by("-created_at")

    if status_filter:
        qs = qs.filter(status=status_filter)

    data = [
        {
            "id": c.id,
            "sender": {
                "id": c.sender.id,
                "email": c.sender.email,
                "firstName": c.sender.first_name,
                "lastName": c.sender.last_name,
            },
            "station": {
                "id": c.station.id,
                "name": c.station.name,
                "lat": c.station.latitude,
                "lng": c.station.longitude,
            },
            "weight": c.weight,
            "quantity": c.quantity,
            "status": c.status,
            "createdAt": c.created_at.isoformat(),
        }
        for c in qs
    ]

    return JsonResponse({"cargoes": data}, status=200)


@csrf_exempt
@require_http_methods(["PATCH"])
def cargo_status(request, cargo_id):
    """Kargo durumunu güncelle."""
    admin = _get_authenticated_admin(request)
    if admin is None:
        return JsonResponse({"message": "Yetki gerekiyor."}, status=403)

    try:
        cargo = Cargo.objects.get(id=cargo_id)
    except Cargo.DoesNotExist:
        return JsonResponse({"message": "Kargo bulunamadı."}, status=404)

    data = _json_body(request)
    if data is None:
        return JsonResponse({"message": "Geçersiz JSON."}, status=400)

    new_status = data.get("status")
    valid_statuses = ["pending", "in_transit", "delivered", "cancelled"]
    if new_status not in valid_statuses:
        return JsonResponse({"message": f"Geçersiz durum. Geçerli: {valid_statuses}"}, status=400)

    cargo.status = new_status
    cargo.save()

    return JsonResponse({
        "message": "Kargo durumu güncellendi.",
        "cargo": {
            "id": cargo.id,
            "status": cargo.status,
        }
    }, status=200)


# ==================== SEFER/ROTA YÖNETİMİ ====================

@csrf_exempt
@require_http_methods(["GET", "POST"])
def trips(request):
    """Seferleri listele veya yeni sefer oluştur."""
    admin = _get_authenticated_admin(request)
    if admin is None:
        return JsonResponse({"message": "Yetki gerekiyor."}, status=403)

    if request.method == "GET":
        date_filter = request.GET.get("date")
        qs = Trip.objects.select_related("vehicle").order_by("-planned_date", "-id")

        if date_filter:
            try:
                filter_date = date.fromisoformat(date_filter)
                qs = qs.filter(planned_date=filter_date)
            except ValueError:
                pass

        data = [
            {
                "id": t.id,
                "vehicle": {
                    "id": t.vehicle.id,
                    "capacity": t.vehicle.capacity,
                    "is_rented": t.vehicle.is_rented,
                },
                "total_distance": t.total_distance,
                "total_cost": t.total_cost,
                "route_data": t.route_data,
                "planned_date": t.planned_date.isoformat(),
            }
            for t in qs
        ]

        return JsonResponse({"trips": data}, status=200)

    # POST - Yeni sefer oluştur (manuel veya algoritma sonucu)
    data = _json_body(request)
    if data is None:
        return JsonResponse({"message": "Geçersiz JSON."}, status=400)

    try:
        vehicle_id = int(data.get("vehicle_id"))
        vehicle = Vehicle.objects.get(id=vehicle_id)
    except (TypeError, ValueError, Vehicle.DoesNotExist):
        return JsonResponse({"message": "Geçerli araç seçin."}, status=400)

    try:
        total_distance = float(data.get("total_distance", 0))
        total_cost = float(data.get("total_cost", 0))
    except (TypeError, ValueError):
        return JsonResponse({"message": "Geçersiz mesafe/maliyet."}, status=400)

    route_data = data.get("route_data", [])
    planned_date_str = data.get("planned_date")

    try:
        planned_date_val = date.fromisoformat(planned_date_str) if planned_date_str else date.today()
    except ValueError:
        planned_date_val = date.today()

    trip = Trip.objects.create(
        vehicle=vehicle,
        total_distance=total_distance,
        total_cost=total_cost,
        route_data=route_data,
        planned_date=planned_date_val,
    )

    return JsonResponse({
        "message": "Sefer oluşturuldu.",
        "trip": {
            "id": trip.id,
            "vehicle": {
                "id": trip.vehicle.id,
                "capacity": trip.vehicle.capacity,
            },
            "total_distance": trip.total_distance,
            "total_cost": trip.total_cost,
            "route_data": trip.route_data,
            "planned_date": trip.planned_date.isoformat(),
        }
    }, status=201)


@csrf_exempt
@require_http_methods(["DELETE"])
def trip_detail(request, trip_id):
    """Sefer sil."""
    admin = _get_authenticated_admin(request)
    if admin is None:
        return JsonResponse({"message": "Yetki gerekiyor."}, status=403)

    try:
        trip = Trip.objects.get(id=trip_id)
    except Trip.DoesNotExist:
        return JsonResponse({"message": "Sefer bulunamadı."}, status=404)

    trip.delete()
    return JsonResponse({"message": "Sefer silindi."}, status=200)


# ==================== SENARYO KARŞILAŞTIRMA ====================

@csrf_exempt
@require_http_methods(["GET"])
def scenario_comparison(request):
    """4 senaryo için maliyet karşılaştırması (placeholder - algoritma entegrasyonu sonra)."""
    admin = _get_authenticated_admin(request)
    if admin is None:
        return JsonResponse({"message": "Yetki gerekiyor."}, status=403)

    # Bu kısım algoritma entegrasyonunda doldurulacak
    # Şimdilik boş/placeholder değerler dönüyor
    scenarios = [
        {"id": 1, "name": "Senaryo 1", "description": "Sınırsız araç, 500kg kapasite", "cost": None, "distance": None},
        {"id": 2, "name": "Senaryo 2", "description": "Sınırsız araç, karışık kapasite", "cost": None, "distance": None},
        {"id": 3, "name": "Senaryo 3", "description": "3 araç limiti, 500kg kapasite", "cost": None, "distance": None},
        {"id": 4, "name": "Senaryo 4", "description": "3 araç limiti, karışık kapasite", "cost": None, "distance": None},
    ]

    return JsonResponse({"scenarios": scenarios}, status=200)


# ==================== ROTA HESAPLAMA ====================

@csrf_exempt
@require_http_methods(["POST"])
def calculate_route(request):
    """
    Belirli bir tarih için rota hesapla.
    Clarke-Wright Savings algoritması kullanır.
    """
    admin = _get_authenticated_admin(request)
    if admin is None:
        return JsonResponse({"message": "Yetki gerekiyor."}, status=403)

    data = _json_body(request)
    if data is None:
        return JsonResponse({"message": "Geçersiz JSON."}, status=400)

    # Tarih al
    target_date_str = data.get("target_date")
    if not target_date_str:
        return JsonResponse({"message": "Tarih gerekli."}, status=400)

    try:
        from datetime import datetime
        target_date = datetime.strptime(target_date_str, "%Y-%m-%d").date()
    except ValueError:
        return JsonResponse({"message": "Geçersiz tarih formatı. YYYY-MM-DD kullanın."}, status=400)

    # Opsiyonlar
    allow_rental = data.get("allow_rental", True)
    allow_multi_trip = data.get("allow_multi_trip", True)

    # O tarihteki kargoları çek
    cargos = Cargo.objects.filter(
        target_date=target_date,
        status="pending"
    ).select_related("station", "sender")

    if not cargos.exists():
        return JsonResponse({
            "success": True,
            "message": f"{target_date_str} tarihinde taşınacak kargo bulunmuyor.",
            "routes": [],
            "total_cost": 0
        }, status=200)

    # Kargo verilerini hazırla
    cargo_list = [
        {
            "id": c.id,
            "station_name": c.station.name,
            "weight": c.weight,
            "quantity": c.quantity,
            "sender_id": c.sender.id,
            "sender_name": f"{c.sender.first_name} {c.sender.last_name}"
        }
        for c in cargos
    ]

    # Araçları çek
    vehicles = Vehicle.objects.all()
    vehicle_list = [
        {
            "id": v.id,
            "capacity": v.capacity,
            "is_rented": v.is_rented,
            "rental_cost": v.rental_cost
        }
        for v in vehicles
    ]

    if not vehicle_list:
        return JsonResponse({
            "success": False,
            "message": "Sistemde araç bulunmuyor. Önce araç ekleyin.",
        }, status=400)

    # Rota hesapla
    from .routing_algorithm import calculate_routes
    result = calculate_routes(
        vehicles=vehicle_list,
        cargos=cargo_list,
        allow_rental=allow_rental,
        allow_multi_trip=allow_multi_trip
    )

    return JsonResponse(result, status=200)


@csrf_exempt
@require_http_methods(["GET"])
def get_cargo_summary(request):
    """Belirli bir tarih için kargo özeti getir."""
    admin = _get_authenticated_admin(request)
    if admin is None:
        return JsonResponse({"message": "Yetki gerekiyor."}, status=403)

    target_date_str = request.GET.get("date")
    if not target_date_str:
        return JsonResponse({"message": "Tarih gerekli (?date=YYYY-MM-DD)."}, status=400)

    try:
        from datetime import datetime
        target_date = datetime.strptime(target_date_str, "%Y-%m-%d").date()
    except ValueError:
        return JsonResponse({"message": "Geçersiz tarih formatı."}, status=400)

    # O tarihteki kargoları çek
    cargos = Cargo.objects.filter(
        target_date=target_date,
        status="pending"
    ).select_related("station")

    # İstasyon bazlı grupla
    station_summary = {}
    for cargo in cargos:
        station_name = cargo.station.name
        if station_name not in station_summary:
            station_summary[station_name] = {
                "cargo_count": 0,
                "total_weight": 0,
                "coords": [cargo.station.latitude, cargo.station.longitude]
            }
        station_summary[station_name]["cargo_count"] += cargo.quantity
        station_summary[station_name]["total_weight"] += cargo.weight * cargo.quantity

    # Araç kapasitesi
    vehicles = Vehicle.objects.filter(is_rented=False)
    total_capacity = sum(v.capacity for v in vehicles)
    total_demand = sum(s["total_weight"] for s in station_summary.values())

    return JsonResponse({
        "date": target_date_str,
        "stations": station_summary,
        "total_cargo_count": sum(s["cargo_count"] for s in station_summary.values()),
        "total_weight": total_demand,
        "vehicle_capacity": total_capacity,
        "capacity_sufficient": total_demand <= total_capacity,
        "shortage": max(0, total_demand - total_capacity)
    }, status=200)


@csrf_exempt
@require_http_methods(["POST"])
def confirm_route(request):
    """Hesaplanan rotayı onayla ve Trip olarak kaydet."""
    admin = _get_authenticated_admin(request)
    if admin is None:
        return JsonResponse({"message": "Yetki gerekiyor."}, status=403)

    data = _json_body(request)
    if data is None:
        return JsonResponse({"message": "Geçersiz JSON."}, status=400)

    routes = data.get("routes", [])
    target_date_str = data.get("target_date")

    if not routes:
        return JsonResponse({"message": "Kaydedilecek rota yok."}, status=400)

    try:
        from datetime import datetime
        target_date = datetime.strptime(target_date_str, "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return JsonResponse({"message": "Geçersiz tarih."}, status=400)

    created_trips = []
    
    for route in routes:
        vehicle_id = route.get("vehicle_id")
        
        # Kiralık araç ise yeni araç oluştur
        if route.get("is_rented"):
            vehicle = Vehicle.objects.create(
                capacity=route.get("vehicle_capacity", 500),
                is_rented=True,
                rental_cost=route.get("rental_cost", 200)
            )
        else:
            try:
                vehicle = Vehicle.objects.get(id=vehicle_id)
            except Vehicle.DoesNotExist:
                continue

        # Trip oluştur
        trip = Trip.objects.create(
            vehicle=vehicle,
            total_distance=route.get("total_distance", 0),
            total_cost=route.get("total_cost", 0),
            route_data={
                "start_station": route.get("start_station"),
                "stops": route.get("stops", []),
                "depot": route.get("depot")
            },
            planned_date=target_date
        )
        
        # İlgili kargoların durumunu güncelle
        for stop in route.get("stops", []):
            cargo_ids = stop.get("cargo_ids", [])
            Cargo.objects.filter(id__in=cargo_ids).update(status="in_transit")
        
        created_trips.append({
            "trip_id": trip.id,
            "vehicle_id": vehicle.id,
            "distance": trip.total_distance,
            "cost": trip.total_cost
        })

    return JsonResponse({
        "success": True,
        "message": f"{len(created_trips)} sefer oluşturuldu.",
        "trips": created_trips
    }, status=201)


# ==================== SİMÜLASYON ====================

@csrf_exempt
@require_http_methods(["GET"])
def get_trips_with_details(request):
    """Belirli bir tarih için seferleri kargo detaylarıyla birlikte getir."""
    admin = _get_authenticated_admin(request)
    if admin is None:
        return JsonResponse({"message": "Yetki gerekiyor."}, status=403)

    target_date_str = request.GET.get("date")
    if not target_date_str:
        return JsonResponse({"message": "Tarih gerekli."}, status=400)

    try:
        from datetime import datetime
        target_date = datetime.strptime(target_date_str, "%Y-%m-%d").date()
    except ValueError:
        return JsonResponse({"message": "Geçersiz tarih formatı."}, status=400)

    # O tarihteki trip'leri çek
    trips = Trip.objects.filter(planned_date=target_date).select_related("vehicle")
    
    if not trips.exists():
        return JsonResponse({
            "success": True,
            "date": target_date_str,
            "trips": [],
            "message": "Bu tarih için planlanmış sefer yok."
        }, status=200)

    trips_data = []
    for trip in trips:
        route_data = trip.route_data or {}
        stops = route_data.get("stops", [])
        
        # Her durak için kargo detaylarını çek
        stops_with_cargo_details = []
        for stop in stops:
            cargo_ids = stop.get("cargo_ids", [])
            
            # Kargoları ve gönderici bilgilerini çek
            cargos = Cargo.objects.filter(id__in=cargo_ids).select_related("sender", "station")
            cargo_details = [
                {
                    "cargo_id": c.id,
                    "weight": c.weight,
                    "quantity": c.quantity,
                    "status": c.status,
                    "sender": {
                        "id": c.sender.id,
                        "name": f"{c.sender.first_name} {c.sender.last_name}",
                        "email": c.sender.email
                    }
                }
                for c in cargos
            ]
            
            stops_with_cargo_details.append({
                "station_name": stop.get("station_name"),
                "total_weight": stop.get("total_weight", 0),
                "coords": stop.get("coords", [0, 0]),
                "cargo_count": len(cargo_details),
                "cargos": cargo_details
            })
        
        trips_data.append({
            "trip_id": trip.id,
            "vehicle": {
                "id": trip.vehicle.id,
                "plate": trip.vehicle.plate if hasattr(trip.vehicle, 'plate') else f"Araç-{trip.vehicle.id}",
                "capacity_kg": trip.vehicle.capacity,
                "is_rental": trip.vehicle.is_rented,
            },
            "start_station": route_data.get("start_station", ""),
            "distance": trip.total_distance,
            "total_cost": trip.total_cost,
            "total_weight": sum(stop.get("total_weight", 0) for stop in stops_with_cargo_details),
            "cargo_count": sum(stop.get("cargo_count", 0) for stop in stops_with_cargo_details),
            "stops": [
                {
                    "station_name": stop.get("station_name"),
                    "total_weight": stop.get("total_weight", 0),
                    "coords": stop.get("coords", [0, 0]),
                    "cargo_count": stop.get("cargo_count", 0),
                    "senders": [c.get("sender", {}).get("name", "") for c in stop.get("cargos", [])],
                    "status": stop.get("cargos", [{}])[0].get("status", "pending") if stop.get("cargos") else "pending"
                }
                for stop in stops_with_cargo_details
            ],
            "status": _get_trip_status(stops_with_cargo_details)
        })
    
    return JsonResponse({
        "success": True,
        "date": target_date_str,
        "trips": trips_data
    }, status=200)


def _get_trip_status(stops):
    """Trip'in genel durumunu hesapla."""
    if not stops:
        return "empty"
    
    all_cargos = []
    for stop in stops:
        all_cargos.extend(stop.get("cargos", []))
    
    if not all_cargos:
        return "empty"
    
    statuses = [c.get("status") for c in all_cargos]
    
    if all(s == "delivered" for s in statuses):
        return "completed"
    elif all(s == "pending" for s in statuses):
        return "pending"
    elif any(s == "in_transit" for s in statuses):
        return "in_transit"
    else:
        return "partial"


@csrf_exempt
@require_http_methods(["POST"])
def start_simulation(request):
    """Simülasyonu başlat - kargoları 'in_transit' yap."""
    admin = _get_authenticated_admin(request)
    if admin is None:
        return JsonResponse({"message": "Yetki gerekiyor."}, status=403)

    data = _json_body(request)
    if data is None:
        return JsonResponse({"message": "Geçersiz JSON."}, status=400)

    trip_ids = data.get("trip_ids", [])
    
    if not trip_ids:
        return JsonResponse({"message": "Sefer ID'leri gerekli."}, status=400)
    
    updated_cargo_count = 0
    
    for trip_id in trip_ids:
        try:
            trip = Trip.objects.get(id=trip_id)
            route_data = trip.route_data or {}
            stops = route_data.get("stops", [])
            
            for stop in stops:
                cargo_ids = stop.get("cargo_ids", [])
                count = Cargo.objects.filter(
                    id__in=cargo_ids, 
                    status="pending"
                ).update(status="in_transit")
                updated_cargo_count += count
                
        except Trip.DoesNotExist:
            continue
    
    return JsonResponse({
        "success": True,
        "message": f"Simülasyon başlatıldı! {updated_cargo_count} kargo yola çıktı.",
        "updated_cargo_count": updated_cargo_count
    }, status=200)


@csrf_exempt
@require_http_methods(["POST"])
def complete_simulation(request):
    """Simülasyonu tamamla - kargoları 'delivered' yap."""
    admin = _get_authenticated_admin(request)
    if admin is None:
        return JsonResponse({"message": "Yetki gerekiyor."}, status=403)

    data = _json_body(request)
    if data is None:
        return JsonResponse({"message": "Geçersiz JSON."}, status=400)

    trip_ids = data.get("trip_ids", [])
    
    if not trip_ids:
        return JsonResponse({"message": "Sefer ID'leri gerekli."}, status=400)
    
    updated_cargo_count = 0
    
    for trip_id in trip_ids:
        try:
            trip = Trip.objects.get(id=trip_id)
            route_data = trip.route_data or {}
            stops = route_data.get("stops", [])
            
            for stop in stops:
                cargo_ids = stop.get("cargo_ids", [])
                count = Cargo.objects.filter(
                    id__in=cargo_ids,
                    status="in_transit"
                ).update(status="delivered")
                updated_cargo_count += count
                
        except Trip.DoesNotExist:
            continue
    
    return JsonResponse({
        "success": True,
        "message": f"Simülasyon tamamlandı! {updated_cargo_count} kargo teslim edildi.",
        "updated_cargo_count": updated_cargo_count
    }, status=200)


# ==================== ANALİZ / GRAFİK VERİLERİ ====================

@csrf_exempt
@require_http_methods(["GET"])
def analytics_overview(request):
    """Genel analiz verileri - tüm grafikler için özet."""
    admin = _get_authenticated_admin(request)
    if admin is None:
        return JsonResponse({"message": "Yetki gerekiyor."}, status=403)

    # Tarih bazlı kargo sayıları (son 14 gün)
    today = date.today()
    date_range = [today - timedelta(days=i) for i in range(13, -1, -1)]
    
    cargo_by_date = []
    for d in date_range:
        daily_cargoes = Cargo.objects.filter(created_at__date=d)
        cargo_by_date.append({
            "date": d.strftime("%d.%m"),
            "full_date": d.isoformat(),
            "count": daily_cargoes.count(),
            "weight": round(daily_cargoes.aggregate(total=Sum("weight"))["total"] or 0, 1)
        })

    # Kargo durumu dağılımı
    status_counts = Cargo.objects.values("status").annotate(count=Count("id"))
    status_distribution = []
    status_names = {
        "pending": "Beklemede",
        "in_transit": "Yolda",
        "delivered": "Teslim Edildi"
    }
    status_colors = {
        "pending": "#f59e0b",
        "in_transit": "#3b82f6",
        "delivered": "#10b981"
    }
    for item in status_counts:
        status_distribution.append({
            "status": item["status"],
            "name": status_names.get(item["status"], item["status"]),
            "count": item["count"],
            "color": status_colors.get(item["status"], "#6b7280")
        })

    # İstasyon bazlı kargo dağılımı
    station_cargo = []
    for station in Station.objects.all().order_by("name"):
        cargo_count = Cargo.objects.filter(station=station).count()
        pending_count = Cargo.objects.filter(station=station, status="pending").count()
        delivered_count = Cargo.objects.filter(station=station, status="delivered").count()
        total_weight = Cargo.objects.filter(station=station).aggregate(total=Sum("weight"))["total"] or 0
        
        station_cargo.append({
            "station_id": station.id,
            "station_name": station.name,
            "total_cargo": cargo_count,
            "pending": pending_count,
            "delivered": delivered_count,
            "total_weight": round(total_weight, 1)
        })

    # Maliyet dağılımı
    all_trips = Trip.objects.all()
    total_distance = all_trips.aggregate(total=Sum("total_distance"))["total"] or 0
    total_cost = all_trips.aggregate(total=Sum("total_cost"))["total"] or 0
    fuel_cost = total_distance  # 1 km = 1 birim
    rental_cost = max(0, total_cost - fuel_cost)
    
    cost_distribution = [
        {"name": "Yakıt Maliyeti", "value": round(fuel_cost, 0), "color": "#3b82f6"},
        {"name": "Kiralama Maliyeti", "value": round(rental_cost, 0), "color": "#f59e0b"}
    ]

    # Tarih bazlı sefer ve maliyet (son 14 gün)
    trips_by_date = []
    for d in date_range:
        daily_trips = Trip.objects.filter(planned_date=d)
        trip_count = daily_trips.count()
        daily_cost = daily_trips.aggregate(total=Sum("total_cost"))["total"] or 0
        daily_distance = daily_trips.aggregate(total=Sum("total_distance"))["total"] or 0
        
        trips_by_date.append({
            "date": d.strftime("%d.%m"),
            "full_date": d.isoformat(),
            "trip_count": trip_count,
            "cost": round(daily_cost, 0),
            "distance": round(daily_distance, 1)
        })

    # Araç kullanım istatistikleri
    vehicle_stats = []
    for vehicle in Vehicle.objects.all().order_by("id"):
        trip_count = Trip.objects.filter(vehicle=vehicle).count()
        total_vehicle_distance = Trip.objects.filter(vehicle=vehicle).aggregate(total=Sum("total_distance"))["total"] or 0
        total_vehicle_cost = Trip.objects.filter(vehicle=vehicle).aggregate(total=Sum("total_cost"))["total"] or 0
        
        vehicle_stats.append({
            "vehicle_id": vehicle.id,
            "capacity": vehicle.capacity,
            "is_rented": vehicle.is_rented,
            "trip_count": trip_count,
            "total_distance": round(total_vehicle_distance, 1),
            "total_cost": round(total_vehicle_cost, 0)
        })

    # Ağırlık aralığı dağılımı
    weight_ranges = [
        {"min": 0, "max": 50, "label": "0-50 kg"},
        {"min": 50, "max": 100, "label": "50-100 kg"},
        {"min": 100, "max": 200, "label": "100-200 kg"},
        {"min": 200, "max": 500, "label": "200-500 kg"},
        {"min": 500, "max": 10000, "label": "500+ kg"}
    ]
    weight_distribution = []
    for wr in weight_ranges:
        count = Cargo.objects.filter(weight__gte=wr["min"], weight__lt=wr["max"]).count()
        weight_distribution.append({
            "range": wr["label"],
            "count": count
        })

    # Haftalık performans özeti
    this_week_start = today - timedelta(days=today.weekday())
    last_week_start = this_week_start - timedelta(days=7)
    
    this_week_cargoes = Cargo.objects.filter(created_at__date__gte=this_week_start).count()
    last_week_cargoes = Cargo.objects.filter(
        created_at__date__gte=last_week_start,
        created_at__date__lt=this_week_start
    ).count()
    
    this_week_delivered = Cargo.objects.filter(
        status="delivered",
        created_at__date__gte=this_week_start
    ).count()
    
    this_week_trips = Trip.objects.filter(planned_date__gte=this_week_start).count()
    this_week_cost = Trip.objects.filter(planned_date__gte=this_week_start).aggregate(
        total=Sum("total_cost")
    )["total"] or 0

    weekly_summary = {
        "this_week_cargo": this_week_cargoes,
        "last_week_cargo": last_week_cargoes,
        "cargo_change_percent": round(
            ((this_week_cargoes - last_week_cargoes) / max(last_week_cargoes, 1)) * 100, 1
        ),
        "this_week_delivered": this_week_delivered,
        "this_week_trips": this_week_trips,
        "this_week_cost": round(this_week_cost, 0)
    }

    return JsonResponse({
        "cargo_by_date": cargo_by_date,
        "status_distribution": status_distribution,
        "station_cargo": station_cargo,
        "cost_distribution": cost_distribution,
        "trips_by_date": trips_by_date,
        "vehicle_stats": vehicle_stats,
        "weight_distribution": weight_distribution,
        "weekly_summary": weekly_summary
    }, status=200)


@csrf_exempt
@require_http_methods(["GET"])
def analytics_daily_details(request):
    """Belirli bir gün için detaylı analiz."""
    admin = _get_authenticated_admin(request)
    if admin is None:
        return JsonResponse({"message": "Yetki gerekiyor."}, status=403)

    target_date_str = request.GET.get("date")
    if target_date_str:
        try:
            target_date = date.fromisoformat(target_date_str)
        except ValueError:
            return JsonResponse({"message": "Geçersiz tarih formatı."}, status=400)
    else:
        target_date = date.today()

    # O günkü kargolar
    daily_cargoes = Cargo.objects.filter(target_date=target_date)
    
    # Durum bazlı sayılar
    status_breakdown = {
        "pending": daily_cargoes.filter(status="pending").count(),
        "in_transit": daily_cargoes.filter(status="in_transit").count(),
        "delivered": daily_cargoes.filter(status="delivered").count()
    }

    # İstasyon bazlı dağılım
    station_breakdown = []
    for station in Station.objects.all():
        station_cargoes = daily_cargoes.filter(station=station)
        if station_cargoes.exists():
            station_breakdown.append({
                "station_name": station.name,
                "cargo_count": station_cargoes.count(),
                "total_weight": round(
                    station_cargoes.aggregate(total=Sum("weight"))["total"] or 0, 1
                )
            })

    # O günkü seferler
    daily_trips = Trip.objects.filter(planned_date=target_date)
    trip_summary = {
        "count": daily_trips.count(),
        "total_distance": round(
            daily_trips.aggregate(total=Sum("total_distance"))["total"] or 0, 1
        ),
        "total_cost": round(
            daily_trips.aggregate(total=Sum("total_cost"))["total"] or 0, 0
        )
    }

    return JsonResponse({
        "date": target_date.isoformat(),
        "cargo_count": daily_cargoes.count(),
        "total_weight": round(
            daily_cargoes.aggregate(total=Sum("weight"))["total"] or 0, 1
        ),
        "status_breakdown": status_breakdown,
        "station_breakdown": station_breakdown,
        "trip_summary": trip_summary
    }, status=200)
