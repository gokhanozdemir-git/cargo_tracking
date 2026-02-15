"""
Clarke-Wright Savings Algoritması ile Araç Rotalama (VRP)

Bu modül:
1. Clarke-Wright Savings algoritması ile optimum rotaları hesaplar
2. Araç kapasitelerini dikkate alır
3. Multi-trip (birden fazla sefer) desteği sağlar
4. Araç başlangıç noktalarını optimize eder
"""

from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass, field
from .distance_matrix import (
    DISTRICTS, 
    DISTANCE_MATRIX,
    DEPOT_DISTANCES, 
    DEPOT_NAME,
    DEPOT_COORDS,
    DISTRICT_COORDS,
    get_distance,
    get_district_index
)
@dataclass
class Cargo:
    """Kargo bilgisi"""
    id: int
    station_name: str
    weight: float
    quantity: int
    sender_id: int
    sender_name: str = ""
@dataclass
class RouteStop:
    """Rota durağı"""
    station_name: str
    cargo_ids: List[int] = field(default_factory=list)
    total_weight: float = 0.0
    coords: Tuple[float, float] = (0.0, 0.0)


@dataclass
class VehicleRoute:
    """Araç rotası"""
    vehicle_id: int
    vehicle_capacity: float
    is_rented: bool = False
    rental_cost: float = 0.0
    start_station: str = ""  # Başlangıç istasyonu
    stops: List[RouteStop] = field(default_factory=list)
    total_distance: float = 0.0
    fuel_cost: float = 0.0
    total_cost: float = 0.0
    trip_number: int = 1  # Kaçıncı sefer


@dataclass 
class RoutingResult:
    """Rota hesaplama sonucu"""
    success: bool
    routes: List[VehicleRoute] = field(default_factory=list)
    total_distance: float = 0.0
    total_fuel_cost: float = 0.0
    total_rental_cost: float = 0.0
    total_cost: float = 0.0
    unassigned_cargos: List[Cargo] = field(default_factory=list)
    needs_rental: bool = False
    rental_count_needed: int = 0
    needs_multi_trip: bool = False
    message: str = ""
    warnings: List[str] = field(default_factory=list)

class ClarkeWrightVRP:
    """Clarke-Wright Savings algoritması ile VRP çözücü"""
    
    FUEL_COST_PER_KM = 1.0  # Yakıt maliyeti (birim/km)
    RENTAL_COST = 200.0     # Kiralık araç maliyeti
    RENTAL_CAPACITY = 500   # Kiralık araç kapasitesi
    
    def __init__(self, vehicles: List[Dict], cargos: List[Cargo]):
        """
        Args:
            vehicles: Araç listesi [{"id": 1, "capacity": 500, "is_rented": False}, ...]
            cargos: Kargo listesi
        """
        self.vehicles = sorted(vehicles, key=lambda v: v["capacity"], reverse=True)
        self.cargos = cargos
        self.stations_with_cargo = self._group_cargos_by_station()
        
    def _group_cargos_by_station(self) -> Dict[str, List[Cargo]]:
        """Kargoları istasyonlara göre grupla"""
        grouped = {}
        for cargo in self.cargos:
            if cargo.station_name not in grouped:
                grouped[cargo.station_name] = []
            grouped[cargo.station_name].append(cargo)
        return grouped
    
    def _calculate_savings(self) -> List[Tuple[str, str, float]]:
        """
        Clarke-Wright Savings hesapla.
        Savings(i,j) = d(depot,i) + d(depot,j) - d(i,j)
        
        İki müşteriyi aynı rotada birleştirmenin kazancı.
        """
        stations = list(self.stations_with_cargo.keys())
        savings = []
        
        for i, station_i in enumerate(stations):
            for j, station_j in enumerate(stations):
                if i >= j:
                    continue
                    
                d_depot_i = DEPOT_DISTANCES.get(station_i, 0)
                d_depot_j = DEPOT_DISTANCES.get(station_j, 0)
                d_i_j = get_distance(station_i, station_j)
                
                saving = d_depot_i + d_depot_j - d_i_j
                if saving > 0:
                    savings.append((station_i, station_j, saving))
        
        # Savings'i büyükten küçüğe sırala
        savings.sort(key=lambda x: x[2], reverse=True)
        return savings
    
    def _get_station_demand(self, station_name: str) -> float:
        """İstasyondaki toplam kargo ağırlığı"""
        cargos = self.stations_with_cargo.get(station_name, [])
        return sum(c.weight * c.quantity for c in cargos)
    
    def _calculate_route_distance(self, route_stations: List[str]) -> float:
        """
        Rota mesafesini hesapla.
        YENİ MANTIK: Araç ilk istasyondan başlar, diğer istasyonları ziyaret eder,
        son olarak Umuttepe'ye gelir (TEK YÖN - gidiş yok!)
        
        Örnek: Darıca(başlangıç) -> Gölcük -> Umuttepe
        Mesafe = Darıca-Gölcük + Gölcük-Umuttepe
        """
        if not route_stations:
            return 0.0
            
        total = 0.0
        
        # Duraklar arası mesafe
        for i in range(len(route_stations) - 1):
            total += get_distance(route_stations[i], route_stations[i + 1])
        
        # Son duraktan Umuttepe'ye (depoya) mesafe
        total += DEPOT_DISTANCES.get(route_stations[-1], 0)
        
        return total
    
    def _find_optimal_start_station(self, stations: List[str]) -> str:
        """
        Rota için optimal başlangıç istasyonunu bul.
        
        MANTIK: Umuttepe'ye en uzak istasyondan başla!
        Çünkü araç oradan başlayıp diğer istasyonları toplayıp
        Umuttepe'ye doğru ilerleyecek.
        
        Örnek: Gebze(48km), İzmit(5km), Derince(14km) varsa
        -> Gebze'den başla, İzmit'e uğra, Umuttepe'ye gel
        """
        if not stations:
            return DEPOT_NAME
        
        if len(stations) == 1:
            return stations[0]
        
        # Umuttepe'ye en uzak istasyonu bul
        max_distance = 0
        best_start = stations[0]
        
        for station in stations:
            dist = DEPOT_DISTANCES.get(station, 0)
            if dist > max_distance:
                max_distance = dist
                best_start = station
        
        return best_start
    
    def _find_optimal_start_positions(self, routes: List[List[str]]) -> List[str]:
        """
        Her rota için optimal başlangıç noktasını bul.
        Araçların hangi istasyondan başlaması toplam mesafeyi minimize eder?
        """
        optimal_starts = []
        
        for route in routes:
            if not route:
                optimal_starts.append(DEPOT_NAME)
                continue
            
            # En uzak noktadan başlamak genelde daha iyi
            # Çünkü araç dolu giderken uzağa, boşalırken depoya yaklaşır
            max_distance = 0
            best_start = route[0]
            
            for station in route:
                dist = DEPOT_DISTANCES.get(station, 0)
                if dist > max_distance:
                    max_distance = dist
                    best_start = station
            
            optimal_starts.append(best_start)
        
        return optimal_starts
    
    def _split_route_by_capacity(self, route_stations: List[str], max_capacity: float) -> List[List[str]]:
        """
        Rotayı kapasite kısıtına göre böl.
        Önce en ağır istasyonları ayır, sonra yakın istasyonları grupla.
        """
        if not route_stations:
            return []
            
        # İstasyon talepleri
        station_demands = [(station, self._get_station_demand(station)) for station in route_stations]
        station_demands.sort(key=lambda x: x[1], reverse=True)  # Ağır istasyonları öne al
        
        sub_routes = []
        current_route = []
        current_load = 0.0
        
        for station, demand in station_demands:
            # Bu istasyon tek başına kapasite aşıyorsa, ayrı rota yap
            if demand > max_capacity:
                if current_route:
                    sub_routes.append(current_route)
                    current_route = []
                    current_load = 0.0
                sub_routes.append([station])  # Tek istasyonlu rota
                continue
                
            # Mevcut rotaya sığar mı?
            if current_load + demand <= max_capacity:
                current_route.append(station)
                current_load += demand
            else:
                # Yeni rota başlat
                if current_route:
                    sub_routes.append(current_route)
                current_route = [station]
                current_load = demand
        
        # Son rotayı ekle
        if current_route:
            sub_routes.append(current_route)
            
        return sub_routes
    
    def _get_region_for_station(self, station: str) -> str:
        """
        İstasyonun hangi coğrafi bölgede olduğunu belirle.
        Umuttepe'ye göre yön bazlı kümeleme.
        """
        # Bölge tanımları (Umuttepe merkezli)
        regions = {
            "kuzey": ["Kandıra"],  # Kuzeyde, tek başına
            "kuzey_bati": ["Gebze", "Darıca", "Çayırova", "Dilovası"],  # Batı tarafı
            "merkez": ["İzmit", "Derince", "Körfez", "Kartepe", "Başiskele"],  # Merkez
            "guney": ["Karamürsel", "Gölcük"],  # Güney tarafı
        }
        
        for region, stations in regions.items():
            if station in stations:
                return region
        return "merkez"  # Default
    
    def _calculate_route_compatibility(self, existing_stations: List[str], new_station: str) -> float:
        """
        Yeni istasyonun mevcut rotayla ne kadar uyumlu olduğunu hesapla.
        Düşük skor = daha uyumlu
        """
        if not existing_stations:
            return 0.0
        
        # 1. Bölge uyumu kontrolü
        new_region = self._get_region_for_station(new_station)
        existing_regions = [self._get_region_for_station(s) for s in existing_stations]
        
        # Farklı bölgeden ise ceza ver
        region_penalty = 0
        if new_region not in existing_regions:
            # Çok farklı bölgeler için yüksek ceza
            region_distances = {
                ("kuzey", "guney"): 100,
                ("kuzey", "kuzey_bati"): 50,
                ("guney", "kuzey_bati"): 40,
                ("merkez", "kuzey"): 30,
                ("merkez", "guney"): 20,
                ("merkez", "kuzey_bati"): 15,
            }
            for (r1, r2), penalty in region_distances.items():
                if (new_region == r1 and r2 in existing_regions) or \
                   (new_region == r2 and r1 in existing_regions):
                    region_penalty = penalty
                    break
        
        # 2. Mesafe uyumu - mevcut rotaya ne kadar uzaklık ekler?
        # En yakın istasyona mesafe
        min_distance = min(get_distance(new_station, s) for s in existing_stations)
        
        # 3. Umuttepe'ye göre yön uyumu
        new_depot_dist = DEPOT_DISTANCES.get(new_station, 0)
        avg_depot_dist = sum(DEPOT_DISTANCES.get(s, 0) for s in existing_stations) / len(existing_stations)
        direction_diff = abs(new_depot_dist - avg_depot_dist)
        
        # Toplam uyumsuzluk skoru
        return region_penalty + min_distance * 0.5 + direction_diff * 0.3
    
    def _optimize_route_order(self, stations: List[str], start_station: str) -> List[str]:
        """
        Rota sırasını optimize et.
        
        YENİ MANTIK: Başlangıç istasyonundan başla, 
        Umuttepe'ye doğru ilerleyecek şekilde sırala.
        
        Örnek: Gebze'den başla -> Dilovası -> Körfez -> Umuttepe
        (Umuttepe'ye giderek yaklaşan bir rota)
        """
        if len(stations) <= 1:
            return stations
        
        if len(stations) == 2:
            # 2 istasyon varsa, Umuttepe'ye uzak olanı öne al
            dist0 = DEPOT_DISTANCES.get(stations[0], 0)
            dist1 = DEPOT_DISTANCES.get(stations[1], 0)
            if dist0 >= dist1:
                return stations
            else:
                return [stations[1], stations[0]]
        
        # Başlangıç istasyonunu öne al
        remaining = [s for s in stations if s != start_station]
        route = [start_station]
        
        # Nearest Neighbor - ama Umuttepe'ye yaklaşacak şekilde
        # Her adımda: ya en yakın istasyona git, ya da Umuttepe'ye yaklaş
        while remaining:
            current = route[-1]
            current_depot_dist = DEPOT_DISTANCES.get(current, 0)
            
            # En iyi sonraki durağı bul
            best_next = None
            best_score = float('inf')
            
            for candidate in remaining:
                # Mesafe skoru: mevcut noktadan candidate'a mesafe
                dist_to_candidate = get_distance(current, candidate)
                candidate_depot_dist = DEPOT_DISTANCES.get(candidate, 0)
                
                # Skor: kısa mesafe + Umuttepe'ye yaklaşma bonusu
                # Umuttepe'ye yaklaşıyorsa bonus ver
                approach_bonus = max(0, current_depot_dist - candidate_depot_dist) * 0.5
                score = dist_to_candidate - approach_bonus
                
                if score < best_score:
                    best_score = score
                    best_next = candidate
            
            if best_next:
                route.append(best_next)
                remaining.remove(best_next)
        
        # Son kontrol: Rota Umuttepe'ye doğru mu gidiyor?
        # Son durak Umuttepe'ye en yakın olmalı
        if len(route) > 2:
            # Son iki durağı kontrol et
            last_dist = DEPOT_DISTANCES.get(route[-1], 0)
            second_last_dist = DEPOT_DISTANCES.get(route[-2], 0)
            
            # Eğer son durak daha uzaksa, ters çevir
            if last_dist > second_last_dist:
                # Sadece son kısmı değil, tamamını yeniden değerlendir
                # Umuttepe mesafesine göre sırala (uzaktan yakına)
                route_sorted = sorted(route, key=lambda s: DEPOT_DISTANCES.get(s, 0), reverse=True)
                
                # Eğer bu sıralama daha kısa mesafe veriyorsa kullan
                old_dist = self._calculate_route_distance(route)
                new_dist = self._calculate_route_distance(route_sorted)
                
                if new_dist < old_dist:
                    route = route_sorted
        
        return route
    
    def solve(self, allow_rental: bool = True, allow_multi_trip: bool = True) -> RoutingResult:
        """
        ÖNCE KAPASİTE, SONRA COĞRAFİ OPTİMİZASYON:
        1. Tüm mevcut araçları maksimum doldur (First Fit Decreasing)
        2. Coğrafi uyum sadece sıralama için kullanılsın
        3. Sadece gerçekten taşamayan kargo için kiralık araç
        """
        result = RoutingResult(success=False)
        
        if not self.cargos:
            result.success = True
            result.message = "Taşınacak kargo bulunmuyor."
            return result
        
        # Toplam talep ve kapasite hesapla
        total_demand = sum(self._get_station_demand(s) for s in self.stations_with_cargo)
        total_capacity = sum(v["capacity"] for v in self.vehicles)
        
        # Kapasite eksikliği varsa kaç kiralık araç gerektiğini hesapla
        shortage = max(0, total_demand - total_capacity)
        if shortage > 0:
            rental_needed = int(shortage // self.RENTAL_CAPACITY) + (1 if shortage % self.RENTAL_CAPACITY > 0 else 1)
            result.needs_rental = True
            result.rental_count_needed = rental_needed
            result.warnings.append(f"Kapasite eksik: {shortage:.0f} kg, {rental_needed} kiralık araç gerekli")
        
        # ============================================
        # ADIM 1: İstasyonları ağırlığa göre sırala (FFD - First Fit Decreasing)
        # ============================================
        station_list = []
        for station_name, cargos in self.stations_with_cargo.items():
            demand = self._get_station_demand(station_name)
            cargo_ids = [c.id for c in cargos]
            station_list.append({
                "station": station_name,
                "demand": demand,
                "cargo_ids": cargo_ids,
                "assigned": False,
                "region": self._get_region_for_station(station_name),
                "depot_distance": DEPOT_DISTANCES.get(station_name, 0)
            })
        
        # AĞIRLIĞA GÖRE SIRALA (en ağır önce) - First Fit Decreasing
        station_list.sort(key=lambda x: -x["demand"])
        
        # ============================================
        # ADIM 2: FIRST FIT DECREASING - Mevcut araçlara at
        # ============================================
        assigned_routes: List[VehicleRoute] = []
        
        # Araçları kapasiteye göre sırala (büyükten küçüğe)
        available_vehicles = sorted(self.vehicles, key=lambda v: v["capacity"], reverse=True)
        
        # Her araç için bir "kutu" oluştur
        vehicle_bins = []
        for v in available_vehicles:
            vehicle_bins.append({
                "vehicle": v,
                "stations": [],
                "current_load": 0.0,
            })
        
        # HER İSTASYONU SIRAYLA ATA (FIRST FIT)
        for station_info in station_list:
            station_demand = station_info["demand"]
            placed = False
            
            # İlk sığan araca at (First Fit)
            for vbin in vehicle_bins:
                remaining_capacity = vbin["vehicle"]["capacity"] - vbin["current_load"]
                
                if station_demand <= remaining_capacity:
                    vbin["stations"].append(station_info)
                    vbin["current_load"] += station_demand
                    station_info["assigned"] = True
                    placed = True
                    break
            
            # Hiçbir mevcut araca sığmadı - daha sonra kiralık araçla halledelim
            if not placed:
                pass  # Atanamayan olarak bırak
        
        # ============================================
        # ADIM 3: Atanan araçlardan rota oluştur
        # ============================================
        for vbin in vehicle_bins:
            if not vbin["stations"]:
                continue  # Bu araç boş, atla
            
            vehicle = vbin["vehicle"]
            route_stations = [s["station"] for s in vbin["stations"]]
            
            # Rota sırasını optimize et (coğrafi optimizasyon burada)
            if len(route_stations) > 1:
                optimal_starts = self._find_optimal_start_positions([route_stations])
                start_station = optimal_starts[0]
                optimized_route = self._optimize_route_order(route_stations, start_station)
            else:
                start_station = route_stations[0]
                optimized_route = route_stations
            
            # Mesafe hesapla
            distance = self._calculate_route_distance(optimized_route)
            fuel_cost = distance * self.FUEL_COST_PER_KM
            
            # Durakları oluştur
            stops = []
            for station in optimized_route:
                station_cargos = self.stations_with_cargo.get(station, [])
                stop = RouteStop(
                    station_name=station,
                    cargo_ids=[c.id for c in station_cargos],
                    total_weight=self._get_station_demand(station),
                    coords=DISTRICT_COORDS.get(station, (0, 0))
                )
                stops.append(stop)
            
            vehicle_route = VehicleRoute(
                vehicle_id=vehicle["id"],
                vehicle_capacity=vehicle["capacity"],
                is_rented=vehicle.get("is_rented", False),
                rental_cost=vehicle.get("rental_cost", 0),
                start_station=start_station,
                stops=stops,
                total_distance=distance,
                fuel_cost=fuel_cost,
                total_cost=fuel_cost + vehicle.get("rental_cost", 0)
            )
            assigned_routes.append(vehicle_route)
        
        # ============================================
        # ADIM 4: Atanamayan istasyonlar için kiralık araç
        # ============================================
        unassigned_stations = [s for s in station_list if not s["assigned"]]
        
        if unassigned_stations and allow_rental:
            # Kiralık araç için bin packing
            rental_bins = []
            
            for station_info in unassigned_stations:
                station_demand = station_info["demand"]
                placed = False
                
                # Mevcut kiralık araçlara sığıyor mu?
                for rbin in rental_bins:
                    remaining = self.RENTAL_CAPACITY - rbin["current_load"]
                    if station_demand <= remaining:
                        rbin["stations"].append(station_info)
                        rbin["current_load"] += station_demand
                        station_info["assigned"] = True
                        placed = True
                        break
                
                # Sığmadıysa yeni kiralık araç ekle
                if not placed:
                    rental_bins.append({
                        "stations": [station_info],
                        "current_load": station_demand
                    })
                    station_info["assigned"] = True
            
            # Kiralık araçlardan rota oluştur
            rental_id_start = 1000
            for idx, rbin in enumerate(rental_bins):
                route_stations = [s["station"] for s in rbin["stations"]]
                
                if len(route_stations) > 1:
                    optimal_starts = self._find_optimal_start_positions([route_stations])
                    start_station = optimal_starts[0]
                    optimized_route = self._optimize_route_order(route_stations, start_station)
                else:
                    start_station = route_stations[0]
                    optimized_route = route_stations
                
                distance = self._calculate_route_distance(optimized_route)
                fuel_cost = distance * self.FUEL_COST_PER_KM
                
                stops = []
                for station in optimized_route:
                    station_cargos = self.stations_with_cargo.get(station, [])
                    stop = RouteStop(
                        station_name=station,
                        cargo_ids=[c.id for c in station_cargos],
                        total_weight=self._get_station_demand(station),
                        coords=DISTRICT_COORDS.get(station, (0, 0))
                    )
                    stops.append(stop)
                
                vehicle_route = VehicleRoute(
                    vehicle_id=rental_id_start + idx,
                    vehicle_capacity=self.RENTAL_CAPACITY,
                    is_rented=True,
                    rental_cost=self.RENTAL_COST,
                    start_station=start_station,
                    stops=stops,
                    total_distance=distance,
                    fuel_cost=fuel_cost,
                    total_cost=fuel_cost + self.RENTAL_COST,
                    trip_number=idx + 1
                )
                assigned_routes.append(vehicle_route)
            
            if rental_bins:
                result.warnings.append(f"{len(rental_bins)} kiralık araç eklendi")
        
        # Hala atanamayan var mı kontrol et
        still_unassigned = [s for s in station_list if not s["assigned"]]
        if still_unassigned:
            for s in still_unassigned:
                result.warnings.append(f"UYARI: {s['station']} istasyonu atanamadı ({s['demand']:.0f} kg)")
        
        
        # ============================================
        # ADIM 5: Sonuçları hesapla
        # ============================================
        result.success = True
        result.routes = assigned_routes
        result.total_distance = sum(r.total_distance for r in assigned_routes)
        result.total_fuel_cost = sum(r.fuel_cost for r in assigned_routes)
        result.total_rental_cost = sum(r.rental_cost for r in assigned_routes)
        result.total_cost = result.total_fuel_cost + result.total_rental_cost
        
        # Araç özeti çıkar
        owned_vehicles = [r for r in assigned_routes if not r.is_rented]
        rented_vehicles = [r for r in assigned_routes if r.is_rented]
        
        # Mesaj oluştur
        message_parts = ["✅ Rota hesaplandı!"]
        
        if owned_vehicles:
            message_parts.append(f"{len(owned_vehicles)} mevcut araç")
        
        if rented_vehicles:
            message_parts.append(f"{len(rented_vehicles)} kiralık araç")
            
        message_parts.extend([
            f"{result.total_distance:.1f} km toplam mesafe",
            f"{result.total_cost:.1f}₺ toplam maliyet"
        ])
        
        if result.total_rental_cost > 0:
            message_parts.append(f"(Kiralık: {result.total_rental_cost:.1f}₺)")
        
        result.message = ", ".join(message_parts)
        
        return result


def calculate_routes(vehicles: List[Dict], cargos: List[Dict], 
                    allow_rental: bool = True, 
                    allow_multi_trip: bool = True) -> Dict:
    """
    Rota hesaplama ana fonksiyonu.
    
    Args:
        vehicles: [{"id": 1, "capacity": 500, "is_rented": False}, ...]
        cargos: [{"id": 1, "station_name": "İzmit", "weight": 10, "quantity": 1, "sender_id": 1}, ...]
        allow_rental: Araç kiralama izni
        allow_multi_trip: Çoklu sefer izni
    
    Returns:
        Rota sonuçları dict olarak
    """
    # Cargo objelerine dönüştür
    cargo_objects = [
        Cargo(
            id=c["id"],
            station_name=c["station_name"],
            weight=c["weight"],
            quantity=c["quantity"],
            sender_id=c["sender_id"],
            sender_name=c.get("sender_name", "")
        )
        for c in cargos
    ]
    
    # VRP çöz
    solver = ClarkeWrightVRP(vehicles, cargo_objects)
    result = solver.solve(allow_rental=allow_rental, allow_multi_trip=allow_multi_trip)
    
    # Dict'e dönüştür
    return {
        "success": result.success,
        "message": result.message,
        "warnings": result.warnings,
        "total_distance": result.total_distance,
        "total_fuel_cost": result.total_fuel_cost,
        "total_rental_cost": result.total_rental_cost,
        "total_cost": result.total_cost,
        "needs_rental": result.needs_rental,
        "rental_count_needed": result.rental_count_needed,
        "needs_multi_trip": result.needs_multi_trip,
        "routes": [
            {
                "vehicle_id": r.vehicle_id,
                "vehicle_capacity": r.vehicle_capacity,
                "is_rented": r.is_rented,
                "rental_cost": r.rental_cost,
                "start_station": r.start_station,
                "total_distance": r.total_distance,
                "fuel_cost": r.fuel_cost,
                "total_cost": r.total_cost,
                "trip_number": r.trip_number,
                "stops": [
                    {
                        "station_name": s.station_name,
                        "cargo_ids": s.cargo_ids,
                        "total_weight": s.total_weight,
                        "coords": list(s.coords)
                    }
                    for s in r.stops
                ]
            }
            for r in result.routes
        ],
        "unassigned_cargos": [
            {"id": c.id, "station_name": c.station_name, "weight": c.weight}
            for c in result.unassigned_cargos
        ],
        "depot": {
            "name": DEPOT_NAME,
            "coords": list(DEPOT_COORDS)
        }
    }
