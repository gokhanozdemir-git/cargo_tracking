import json

from django.contrib.auth import authenticate, get_user_model, login as django_login
from django.contrib.sessions.models import Session
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods, require_POST

from yoneticiekrani.models import Cargo, Station

# Varsayılan istasyon listesi (DB boşsa otomatik doldurulacak)
STATION_SEED = [
	{"name": "İzmit", "lat": 40.7654, "lng": 29.9408},
	{"name": "Gebze", "lat": 40.8027, "lng": 29.4307},
	{"name": "Darıca", "lat": 40.7694, "lng": 29.3753},
	{"name": "Çayırova", "lat": 40.8261, "lng": 29.3711},
	{"name": "Dilovası", "lat": 40.7847, "lng": 29.5375},
	{"name": "Körfez", "lat": 40.7539, "lng": 29.7644},
	{"name": "Derince", "lat": 40.7553, "lng": 29.8147},
	{"name": "Gölcük", "lat": 40.7167, "lng": 29.8333},
	{"name": "Karamürsel", "lat": 40.6917, "lng": 29.6167},
	{"name": "Kandıra", "lat": 41.0694, "lng": 30.1528},
	{"name": "Kartepe", "lat": 40.75, "lng": 30.0333},
	{"name": "Başiskele", "lat": 40.7167, "lng": 29.9167},
]


def _json_body(request):
	try:
		return json.loads(request.body.decode("utf-8") or "{}")
	except (json.JSONDecodeError, UnicodeDecodeError):
		return None


def _user_payload(user):
	payload = {
		"id": getattr(user, "id", None),
		"email": getattr(user, "email", ""),
		"firstName": getattr(user, "first_name", ""),
		"lastName": getattr(user, "last_name", ""),
	}
	if hasattr(user, "role"):
		payload["role"] = getattr(user, "role", None)
	return payload


@csrf_exempt
@require_POST
def register(request):
	data = _json_body(request)
	if data is None:
		return JsonResponse({"message": "Geçersiz JSON."}, status=400)

	first_name = (data.get("first_name") or "").strip()
	last_name = (data.get("last_name") or "").strip()
	email = (data.get("email") or "").strip().lower()
	password = data.get("password") or ""

	if not first_name or not last_name or not email or not password:
		return JsonResponse({"message": "Tüm alanlar zorunludur."}, status=400)

	User = get_user_model()

	# Email unique kontrolü (custom user model'de email unique)
	if User.objects.filter(email=email).exists():
		return JsonResponse({"message": "Bu e-posta zaten kayıtlı."}, status=409)

	create_kwargs = {
		"email": email,
		"password": password,
		"first_name": first_name,
		"last_name": last_name,
	}
	# Custom modelde role varsa default customer ata
	if hasattr(User, "role"):
		create_kwargs["role"] = "customer"

	try:
		# Custom user manager: create_user(email, password, **extra_fields)
		user = User.objects.create_user(**create_kwargs)
	except TypeError:
		# role alanı yoksa veya create_user imzası farklıysa role'u çıkarıp tekrar dene
		create_kwargs.pop("role", None)
		user = User.objects.create_user(**create_kwargs)

	return JsonResponse(
		{
			"message": "Kayıt başarılı.",
			"user": _user_payload(user),
		},
		status=201,
	)


@csrf_exempt
@require_POST
def login(request):
	data = _json_body(request)
	if data is None:
		return JsonResponse({"message": "Geçersiz JSON."}, status=400)

	email = (data.get("email") or "").strip().lower()
	password = data.get("password") or ""

	if not email or not password:
		return JsonResponse({"message": "E-posta ve şifre zorunludur."}, status=400)

	# Önce username paramıyla dene, sonra email paramıyla dene.
	user = authenticate(request, username=email, password=password)
	if user is None:
		user = authenticate(request, email=email, password=password)

	if user is None:
		return JsonResponse({"message": "E-posta veya şifre hatalı."}, status=401)

	if not user.is_active:
		return JsonResponse({"message": "Hesap pasif."}, status=403)

	django_login(request, user)
	# session_key'nin oluşmasını garanti et
	if not request.session.session_key:
		request.session.save()

	return JsonResponse(
		{
			"message": "Giriş başarılı.",
			"token": request.session.session_key,
			"user": _user_payload(user),
		},
		status=200,
	)


def _ensure_stations_seeded():
	if Station.objects.exists():
		return
	Station.objects.bulk_create(
		[
			Station(name=item["name"], latitude=item["lat"], longitude=item["lng"])
			for item in STATION_SEED
		],
		ignore_conflicts=True,
	)

def _get_authenticated_user(request):
	# Önce mevcut session/cookie doğrulamasını dene.
	if getattr(request, "user", None) and request.user.is_authenticated:
		return request.user

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
		User = get_user_model()
		return User.objects.filter(id=user_id).first()
	except Session.DoesNotExist:
		return None


def _cargo_payload(cargo):
	# target_date string veya date objesi olabilir
	target_date_str = None
	if cargo.target_date:
		if hasattr(cargo.target_date, 'isoformat'):
			target_date_str = cargo.target_date.isoformat()
		else:
			target_date_str = str(cargo.target_date)
	
	return {
		"id": cargo.id,
		"status": cargo.status,
		"weight": cargo.weight,
		"quantity": cargo.quantity,
		"targetDate": target_date_str,
		"createdAt": cargo.created_at.isoformat(),
		"station": {
			"id": cargo.station.id,
			"name": cargo.station.name,
			"lat": cargo.station.latitude,
			"lng": cargo.station.longitude,
		},
	}


@csrf_exempt
@require_http_methods(["GET"])
def stations(request):
	_ensure_stations_seeded()
	data = [
		{"id": s.id, "name": s.name, "lat": s.latitude, "lng": s.longitude}
		for s in Station.objects.all().order_by("id")
	]
	return JsonResponse({"stations": data}, status=200)


@csrf_exempt
@require_http_methods(["GET", "POST"])
def cargo(request):
	user = _get_authenticated_user(request)
	if user is None:
		return JsonResponse({"message": "Kimlik doğrulama gerekiyor."}, status=401)

	_ensure_stations_seeded()

	if request.method == "GET":
		items = [
			_cargo_payload(c)
			for c in Cargo.objects.filter(sender=user)
			.select_related("station")
			.order_by("-created_at")
		]
		return JsonResponse({"cargoes": items}, status=200)

	data = _json_body(request)
	if data is None:
		return JsonResponse({"message": "Geçersiz JSON."}, status=400)

	try:
		station_id = int(data.get("station_id"))
	except (TypeError, ValueError):
		return JsonResponse({"message": "Geçerli bir istasyon seçin."}, status=400)

	station = Station.objects.filter(id=station_id).first()
	if station is None:
		return JsonResponse({"message": "İstasyon bulunamadı."}, status=404)

	try:
		weight = float(data.get("weight"))
	except (TypeError, ValueError):
		return JsonResponse({"message": "Geçerli bir ağırlık girin."}, status=400)

	try:
		quantity = int(data.get("quantity"))
	except (TypeError, ValueError):
		return JsonResponse({"message": "Geçerli bir adet girin."}, status=400)

	if weight <= 0 or quantity <= 0:
		return JsonResponse({"message": "Ağırlık ve adet sıfırdan büyük olmalı."}, status=400)

	# Tarih kontrolü
	target_date = data.get("target_date")
	if not target_date:
		# Tarih seçilmediyse yarına ata
		target_date = (timezone.now() + timezone.timedelta(days=1)).date()

	cargo_obj = Cargo.objects.create(
		sender=user,
		station=station,
		weight=weight,
		quantity=quantity,
		status="pending",
		target_date=target_date,
	)

	return JsonResponse(
		{"message": "Kargo oluşturuldu.", "cargo": _cargo_payload(cargo_obj)}, status=201
	)


@csrf_exempt
@require_http_methods(["GET"])
def cargo_route(request, cargo_id):
	user = _get_authenticated_user(request)
	if user is None:
		return JsonResponse({"message": "Kimlik doğrulama gerekiyor."}, status=401)

	try:
		cargo_obj = Cargo.objects.select_related("station").get(id=cargo_id, sender=user)
	except Cargo.DoesNotExist:
		return JsonResponse({"message": "Kargo bulunamadı."}, status=404)

	# Umuttepe deposu koordinatları
	depot = {"lat": 40.8225, "lng": 29.9250}
	
	# Kargo bir trip'e atanmış mı kontrol et
	from yoneticiekrani.models import Trip, Vehicle
	
	trip_info = None
	route_coords = []
	
	# Kargo yolda veya teslim edildi ise trip bilgisini bul
	if cargo_obj.status in ["in_transit", "delivered"]:
		# Trip'leri tara, route_data içinde bu cargo_id var mı?
		trips = Trip.objects.all()
		for trip in trips:
			route_data = trip.route_data or {}
			stops = route_data.get("stops", [])
			for stop in stops:
				if cargo_obj.id in stop.get("cargo_ids", []):
					# Bu trip'te bu kargo var
					vehicle = trip.vehicle
					
					# Tüm rota koordinatlarını al
					route_coords = []
					for s in stops:
						coords = s.get("coords", [0, 0])
						if coords and len(coords) == 2:
							route_coords.append(coords)
					
					# Sona depoyu ekle
					route_coords.append([depot["lat"], depot["lng"]])
					
					trip_info = {
						"trip_id": trip.id,
						"vehicle": {
							"id": vehicle.id,
							"plate": vehicle.plate if hasattr(vehicle, 'plate') else f"Araç-{vehicle.id}",
							"capacity": vehicle.capacity,
							"is_rental": vehicle.is_rented,
						},
						"total_distance": trip.total_distance,
						"stops": [
							{
								"station_name": s.get("station_name"),
								"coords": s.get("coords", [0, 0]),
								"is_my_cargo": cargo_obj.id in s.get("cargo_ids", [])
							}
							for s in stops
						],
						"my_stop_index": next(
							(i for i, s in enumerate(stops) if cargo_obj.id in s.get("cargo_ids", [])),
							-1
						)
					}
					break
			if trip_info:
				break
	
	# Eğer trip bulunamadıysa basit rota göster
	if not route_coords:
		route_coords = [
			[cargo_obj.station.latitude, cargo_obj.station.longitude],
			[depot["lat"], depot["lng"]],
		]

	return JsonResponse({
		"route": route_coords,
		"cargo": _cargo_payload(cargo_obj),
		"trip": trip_info
	}, status=200)
