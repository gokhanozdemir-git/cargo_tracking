import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  MapPin,
  Route,
  BarChart3,
  LogOut,
  Menu,
  X,
  Truck,
  Package,
  DollarSign,
  Plus,
  Play,
  Settings,
  Users,
  Calendar,
  Target,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  Layers,
  Trash2,
  PieChart,
  Activity,
  TrendingDown,
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
} from 'recharts';

// Leaflet marker fix
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Kocaeli merkez koordinatları
const KOCAELI_CENTER = { lat: 40.7654, lng: 29.9408 };
const API_BASE = 'http://localhost:8000/yonetici';

// Rota renkleri (her araç için farklı renk)
const ROUTE_COLORS = ['#ff6b00', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];

const Yonetici = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');

  // Auth
  const sessionToken = localStorage.getItem('token');
  const authHeaders = sessionToken ? { Authorization: `Session ${sessionToken}` } : {};

  // Dashboard State
  const [dashboardStats, setDashboardStats] = useState(null);
  const [scenarios, setScenarios] = useState([]);

  // İstasyon Yönetimi State
  const [yeniIstasyon, setYeniIstasyon] = useState({ name: '', lat: '', lng: '' });
  const [istasyonlar, setIstasyonlar] = useState([]);
  const [istasyonLoading, setIstasyonLoading] = useState(false);
  
  // Dashboard İstasyon Kartları State
  const [istasyonlarWithStats, setIstasyonlarWithStats] = useState([]);
  const [selectedIstasyon, setSelectedIstasyon] = useState(null);

  // Araç Yönetimi State
  const [araclar, setAraclar] = useState([]);

  // Kargo State
  const [kargolar, setKargolar] = useState([]);

  // Rota Planlama State
  const [planlamaTarihi, setPlanlamaTarihi] = useState(
    new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split('T')[0]
  );
  const [rotaHesaplaniyor, setRotaHesaplaniyor] = useState(false);
  const [hesaplananRotalar, setHesaplananRotalar] = useState([]);
  const [rotaSonucu, setRotaSonucu] = useState(null);
  const [cargoSummary, setCargoSummary] = useState(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [routePolylines, setRoutePolylines] = useState([]);

  // Operasyonel Takip State
  const [aktifRotalar, setAktifRotalar] = useState([]);
  const [trips, setTrips] = useState([]);
  const [operasyonelTarih, setOperasyonelTarih] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [operasyonelTrips, setOperasyonelTrips] = useState([]);
  const [simulasyonAktif, setSimulasyonAktif] = useState(false);
  const [simulasyonProgress, setSimulasyonProgress] = useState(0);
  const [vehiclePositions, setVehiclePositions] = useState({});
  const [operasyonelPolylines, setOperasyonelPolylines] = useState([]);

  // Analiz State
  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const user = JSON.parse(localStorage.getItem('user')) || { firstName: 'Yönetici', lastName: '' };

  // ==================== API CALLS ====================

  const fetchDashboardStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/dashboard/`, {
        headers: { ...authHeaders },
      });
      if (res.ok) {
        const data = await res.json();
        setDashboardStats(data);
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    }
  };

  const fetchScenarios = async () => {
    try {
      const res = await fetch(`${API_BASE}/scenarios/`, {
        headers: { ...authHeaders },
      });
      if (res.ok) {
        const data = await res.json();
        setScenarios(data.scenarios || []);
      }
    } catch (err) {
      console.error('Scenarios fetch error:', err);
    }
  };

  const fetchIstasyonlar = async () => {
    setIstasyonLoading(true);
    try {
      const res = await fetch(`${API_BASE}/stations/`, {
        headers: { ...authHeaders },
      });
      if (res.ok) {
        const data = await res.json();
        setIstasyonlar(data.stations || []);
      }
    } catch (err) {
      console.error('Stations fetch error:', err);
    } finally {
      setIstasyonLoading(false);
    }
  };

  const fetchIstasyonlarWithStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/stations/with-stats/`, {
        headers: { ...authHeaders },
      });
      if (res.ok) {
        const data = await res.json();
        setIstasyonlarWithStats(data.stations || []);
      }
    } catch (err) {
      console.error('Stations with stats fetch error:', err);
    }
  };

  const fetchAraclar = async () => {
    try {
      const res = await fetch(`${API_BASE}/vehicles/`, {
        headers: { ...authHeaders },
      });
      if (res.ok) {
        const data = await res.json();
        setAraclar(data.vehicles || []);
      }
    } catch (err) {
      console.error('Vehicles fetch error:', err);
    }
  };

  const fetchKargolar = async () => {
    try {
      const res = await fetch(`${API_BASE}/cargoes/`, {
        headers: { ...authHeaders },
      });
      if (res.ok) {
        const data = await res.json();
        setKargolar(data.cargoes || []);
      }
    } catch (err) {
      console.error('Cargoes fetch error:', err);
    }
  };

  const fetchTrips = async () => {
    try {
      const res = await fetch(`${API_BASE}/trips/`, {
        headers: { ...authHeaders },
      });
      if (res.ok) {
        const data = await res.json();
        setTrips(data.trips || []);
        // Aktif rotaları trips'ten oluştur
        const aktif = (data.trips || []).map((t, idx) => ({
          ...t,
          points: t.route_data?.coordinates || [],
          color: ROUTE_COLORS[idx % ROUTE_COLORS.length],
        }));
        setAktifRotalar(aktif);
      }
    } catch (err) {
      console.error('Trips fetch error:', err);
    }
  };

  // Analytics verilerini getir
  const fetchAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/analytics/`, {
        headers: { ...authHeaders },
      });
      if (res.ok) {
        const data = await res.json();
        setAnalyticsData(data);
      }
    } catch (err) {
      console.error('Analytics fetch error:', err);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  // Operasyonel Takip - Tarih bazlı seferleri getir
  const fetchOperasyonelTrips = async (date) => {
    try {
      const res = await fetch(`${API_BASE}/trips/details/?date=${date}`, {
        headers: { ...authHeaders },
      });
      if (res.ok) {
        const data = await res.json();
        setOperasyonelTrips(data.trips || []);
        
        if (data.trips && data.trips.length > 0) {
          const depot = [40.8225, 29.9250]; // Umuttepe
          const polylines = await Promise.all(
            data.trips.map(async (trip, idx) => {
              const stopCoords = trip.stops?.map(s => s.coords) || [];
              if (stopCoords.length === 0) return null;
              
              const allCoords = [...stopCoords, depot];
              const realPath = await fetchRouteFromBackend(allCoords);
              
              return {
                tripId: trip.trip_id,
                path: realPath,
                color: ROUTE_COLORS[idx % ROUTE_COLORS.length],
                vehicle: trip.vehicle,
                stops: trip.stops
              };
            })
          );
          setOperasyonelPolylines(polylines.filter(p => p !== null));
          
          // Başlangıç pozisyonları ayarla (ilk durak)
          const initialPositions = {};
          data.trips.forEach((trip) => {
            if (trip.stops && trip.stops.length > 0) {
              initialPositions[trip.trip_id] = trip.stops[0].coords;
            }
          });
          setVehiclePositions(initialPositions);
        }
      }
    } catch (err) {
      console.error('Operasyonel trips fetch error:', err);
    }
  };

  // Simülasyonu başlat
  const handleStartSimulation = async () => {
    if (operasyonelTrips.length === 0) {
      alert('Simüle edilecek sefer yok!');
      return;
    }

    const tripIds = operasyonelTrips.map(t => t.trip_id);
    
    try {
      // Backend'e bildir - kargoları in_transit yap
      const res = await fetch(`${API_BASE}/simulation/start/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({ trip_ids: tripIds }),
      });

      if (res.ok) {
        setSimulasyonAktif(true);
        setSimulasyonProgress(0);
        
        // Animasyonu başlat
        animateVehicles();
      }
    } catch (err) {
      console.error('Simulation start error:', err);
    }
  };

  // Araç animasyonu
  const animateVehicles = () => {
    const duration = 15000; // 15 saniye
    const startTime = Date.now();
    const depot = [40.8225, 29.9250];
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      setSimulasyonProgress(Math.round(progress * 100));
      
      // Her araç için pozisyon hesapla
      const newPositions = {};
      operasyonelPolylines.forEach((polyline) => {
        if (polyline && polyline.path && polyline.path.length > 1) {
          const pathLength = polyline.path.length;
          const currentIndex = Math.floor(progress * (pathLength - 1));
          newPositions[polyline.tripId] = polyline.path[currentIndex];
        }
      });
      setVehiclePositions(newPositions);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Simülasyon tamamlandı
        completeSimulation();
      }
    };
    
    requestAnimationFrame(animate);
  };

  // Simülasyonu tamamla
  const completeSimulation = async () => {
    const tripIds = operasyonelTrips.map(t => t.trip_id);
    
    try {
      const res = await fetch(`${API_BASE}/simulation/complete/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({ trip_ids: tripIds }),
      });

      if (res.ok) {
        const data = await res.json();
        setSimulasyonAktif(false);
        alert(`✅ ${data.message}`);
        
        // Listeyi yenile
        fetchOperasyonelTrips(operasyonelTarih);
        fetchKargolar();
        fetchDashboardStats();
      }
    } catch (err) {
      console.error('Simulation complete error:', err);
    }
  };

  useEffect(() => {
    fetchDashboardStats();
    fetchScenarios();
    fetchIstasyonlar();
    fetchIstasyonlarWithStats();
    fetchAraclar();
    fetchKargolar();
    fetchTrips();
    fetchAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Operasyonel tarih değişince seferleri getir
  useEffect(() => {
    if (activeTab === 'operasyonel') {
      fetchOperasyonelTrips(operasyonelTarih);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operasyonelTarih, activeTab]);

  // ==================== HANDLERS ====================

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

  const handleIstasyonChange = (e) => {
    const { name, value } = e.target;
    setYeniIstasyon(prev => ({ ...prev, [name]: value }));
  };

  const handleIstasyonEkle = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/stations/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify(yeniIstasyon),
      });
      const data = await res.json();
      if (res.ok) {
        setIstasyonlar(prev => [...prev, data.station]);
        setYeniIstasyon({ name: '', lat: '', lng: '' });
      } else {
        alert(data.message || 'İstasyon eklenemedi');
      }
    } catch (err) {
      alert('Sunucu hatası');
    }
  };

  const handleIstasyonSil = async (stationId) => {
    if (!window.confirm('Bu istasyonu silmek istediğinize emin misiniz?')) return;
    try {
      const res = await fetch(`${API_BASE}/stations/${stationId}/`, {
        method: 'DELETE',
        headers: { ...authHeaders },
      });
      if (res.ok) {
        setIstasyonlar(prev => prev.filter(s => s.id !== stationId));
      }
    } catch (err) {
      alert('Silme hatası');
    }
  };

  // Kargo özeti getir
  const fetchCargoSummary = async (date) => {
    try {
      const res = await fetch(`${API_BASE}/cargo-summary/?date=${date}`, {
        headers: { ...authHeaders },
      });
      if (res.ok) {
        const data = await res.json();
        setCargoSummary(data);
      }
    } catch (err) {
      console.error('Cargo summary error:', err);
    }
  };

  const fetchRouteFromBackend = async (coordinates) => {
    try {
      const coordString = coordinates.map(c => `${c[1]},${c[0]}`).join(';');
      const url = `https://router.project-osrm.org/route/v1/driving/${coordString}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.routes && data.routes[0]) {
          return data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
        }
      }
    } catch (err) {
      console.error('backend error:', err);
    }
    return coordinates; // Fallback: düz çizgi
  };

  // Rota hesapla
  const handleRotaHesapla = async () => {
    setRotaHesaplaniyor(true);
    setRotaSonucu(null);
    setHesaplananRotalar([]);
    setRoutePolylines([]);

    try {
      // Önce kargo özeti al
      await fetchCargoSummary(planlamaTarihi);

      // Rota hesapla
      const res = await fetch(`${API_BASE}/calculate-route/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({
          target_date: planlamaTarihi,
          allow_rental: true,
          allow_multi_trip: true,
        }),
      });

      const data = await res.json();
      setRotaSonucu(data);

      if (data.success && data.routes) {
        setHesaplananRotalar(data.routes);

        // Her rota için algoritmadan gerçek yol çek
        const polylines = await Promise.all(
          data.routes.map(async (route, idx) => {
            const depot = data.depot?.coords || [40.8225, 29.9250];
            const stopCoords = route.stops.map(s => s.coords);
            
            // YENİ MANTIK: İstasyonlardan başla, Umuttepe'ye gel (TEK YÖN)
            // Eski: [depot, ...stopCoords, depot] (gidiş-dönüş)
            // Yeni: [...stopCoords, depot] (tek yön - istasyondan Umuttepe'ye)
            const allCoords = [...stopCoords, depot];
            
            const realPath = await fetchRouteFromBackend(allCoords);
            return {
              id: route.vehicle_id,
              path: realPath,
              color: ROUTE_COLORS[idx % ROUTE_COLORS.length],
              vehicleCapacity: route.vehicle_capacity,
              isRented: route.is_rented,
            };
          })
        );
        setRoutePolylines(polylines);
      }

      // Kapasite yetersizse dialog göster
      if (data.needs_rental) {
        setShowConfirmDialog(true);
      }
    } catch (err) {
      console.error('Rota hesaplama hatası:', err);
      setRotaSonucu({ success: false, message: 'Sunucu hatası' });
    } finally {
      setRotaHesaplaniyor(false);
    }
  };

  // Rotayı onayla
  const handleRotaOnayla = async () => {
    try {
      const res = await fetch(`${API_BASE}/confirm-route/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({
          target_date: planlamaTarihi,
          routes: hesaplananRotalar,
        }),
      });

      const data = await res.json();
      if (data.success) {
        alert(`✅ ${data.message}`);
        setShowConfirmDialog(false);
        fetchTrips();
      } else {
        alert(data.message || 'Onay hatası');
      }
    } catch (err) {
      alert('Sunucu hatası');
    }
  };

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'istasyon', label: 'İstasyon Yönetimi', icon: MapPin },
    { id: 'rota', label: 'Rota Planlama', icon: Route },
    { id: 'operasyonel', label: 'Operasyonel Takip', icon: Truck },
    { id: 'analizler', label: 'Analizler', icon: PieChart },
  ];

  return (
    <div className="flex h-screen bg-[#0a0a0a]">
      {/* ==================== SIDEBAR ==================== */}
      <aside className={`${sidebarOpen ? 'w-72' : 'w-20'} bg-[#111111] border-r border-[#2a2a2a] flex flex-col transition-all duration-300`}>
        {/* Logo */}
        <div className="p-4 border-b border-[#2a2a2a] flex items-center justify-between">
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#ff6b00] to-[#ff8533] flex items-center justify-center">
                <Settings className="w-5 h-5 text-black" />
              </div>
              <div>
                <span className="text-white font-bold text-lg block">YÖNETİCİ</span>
                <span className="text-gray-500 text-xs">Kontrol Paneli</span>
              </div>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg hover:bg-[#1a1a1a] text-gray-400 hover:text-white transition-colors"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* User Info */}
        <div className={`p-4 border-b border-[#2a2a2a] ${!sidebarOpen && 'flex justify-center'}`}>
          <div className={`flex items-center gap-3 ${!sidebarOpen && 'justify-center'}`}>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center flex-shrink-0">
              <Users className="w-5 h-5 text-white" />
            </div>
            {sidebarOpen && (
              <div className="overflow-hidden">
                <p className="text-white font-medium truncate">{user.firstName} {user.lastName}</p>
                <p className="text-purple-400 text-sm font-medium">Admin</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {menuItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 w-full ${
                activeTab === item.id
                  ? 'bg-[#ff6b00] text-black font-semibold shadow-lg shadow-[#ff6b00]/20'
                  : 'text-gray-400 hover:bg-[#1a1a1a] hover:text-white'
              } ${!sidebarOpen && 'justify-center px-3'}`}
            >
              <item.icon size={20} className="flex-shrink-0" />
              {sidebarOpen && <span>{item.label}</span>}
            </button>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-[#2a2a2a]">
          <button
            onClick={handleLogout}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-gray-400 hover:bg-red-500/10 hover:text-red-500 transition-all duration-200 w-full ${!sidebarOpen && 'justify-center px-3'}`}
          >
            <LogOut size={20} className="flex-shrink-0" />
            {sidebarOpen && <span>Çıkış Yap</span>}
          </button>
        </div>
      </aside>

      {/* ==================== MAIN CONTENT ==================== */}
      <main className="flex-1 overflow-auto p-6 lg:p-8">

        {/* ==================== DASHBOARD ==================== */}
        {activeTab === 'dashboard' && (
          <div>
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <LayoutDashboard className="w-8 h-8 text-[#ff6b00]" />
                Dashboard
              </h1>
              <p className="text-gray-500 mt-2">Genel sistem durumu ve özet bilgiler</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                    <Truck className="w-6 h-6 text-blue-400" />
                  </div>
                  <span className="text-green-400 text-sm font-medium flex items-center gap-1">
                    <TrendingUp size={14} /> Aktif
                  </span>
                </div>
                <h3 className="text-gray-400 text-sm mb-1">Toplam Araç</h3>
                <p className="text-3xl font-bold text-white">{dashboardStats?.vehicles?.total ?? '--'}</p>
                <p className="text-gray-500 text-xs mt-2">Özmal: {dashboardStats?.vehicles?.owned ?? '--'} | Kiralık: {dashboardStats?.vehicles?.rented ?? '--'}</p>
              </div>

              <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center">
                    <Package className="w-6 h-6 text-orange-400" />
                  </div>
                  <span className="text-yellow-400 text-sm font-medium flex items-center gap-1">
                    <Clock size={14} /> Bekliyor
                  </span>
                </div>
                <h3 className="text-gray-400 text-sm mb-1">Bekleyen Kargo</h3>
                <p className="text-3xl font-bold text-white">{dashboardStats?.cargo?.pending_weight ?? '--'} kg</p>
                <p className="text-gray-500 text-xs mt-2">Toplam {dashboardStats?.cargo?.pending_count ?? '--'} talep</p>
              </div>

              <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                    <DollarSign className="w-6 h-6 text-green-400" />
                  </div>
                  <span className="text-gray-400 text-sm font-medium flex items-center gap-1">
                    <Target size={14} /> Günlük
                  </span>
                </div>
                <h3 className="text-gray-400 text-sm mb-1">Toplam Maliyet</h3>
                <p className="text-3xl font-bold text-white">{dashboardStats?.costs?.total ?? '--'} ₺</p>
                <p className="text-gray-500 text-xs mt-2">Yakıt: {dashboardStats?.costs?.fuel ?? '--'} | Kiralama: {dashboardStats?.costs?.rental ?? '--'}</p>
              </div>

              <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                    <MapPin className="w-6 h-6 text-purple-400" />
                  </div>
                  <span className="text-blue-400 text-sm font-medium flex items-center gap-1">
                    <CheckCircle2 size={14} /> Aktif
                  </span>
                </div>
                <h3 className="text-gray-400 text-sm mb-1">İstasyon Sayısı</h3>
                <p className="text-3xl font-bold text-white">{dashboardStats?.stations ?? '--'}</p>
                <p className="text-gray-500 text-xs mt-2">Kocaeli ilçeleri</p>
              </div>
            </div>

            {/* Günlük Özet */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-6">
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-[#ff6b00]" />
                  Günlük Özet
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-[#0a0a0a] rounded-xl border border-[#2a2a2a]">
                    <span className="text-gray-400">Teslim Edilen</span>
                    <span className="text-green-400 font-medium">{dashboardStats?.cargo?.delivered ?? '--'} kargo</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-[#0a0a0a] rounded-xl border border-[#2a2a2a]">
                    <span className="text-gray-400">Yolda Olan</span>
                    <span className="text-blue-400 font-medium">{dashboardStats?.cargo?.in_transit ?? '--'} kargo</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-[#0a0a0a] rounded-xl border border-[#2a2a2a]">
                    <span className="text-gray-400">Bekleyen</span>
                    <span className="text-yellow-400 font-medium">{dashboardStats?.cargo?.pending_count ?? '--'} kargo</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-[#0a0a0a] rounded-xl border border-[#2a2a2a]">
                    <span className="text-gray-400">Kat Edilen Mesafe</span>
                    <span className="text-purple-400 font-medium">{dashboardStats?.distance ?? '--'} km</span>
                  </div>
                </div>
              </div>

              
              <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-6">
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-yellow-400" />
                  Bekleyen Kargolar
                </h3>
                {dashboardStats?.pending_by_date && dashboardStats.pending_by_date.length > 0 ? (
                  <div className="space-y-2 max-h-[280px] overflow-y-auto">
                    {dashboardStats.pending_by_date.map((item, idx) => (
                      <div key={idx} className="p-2 bg-[#0a0a0a] rounded-lg border border-[#2a2a2a] hover:border-yellow-500/50 transition-colors">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3 h-3 text-yellow-400" />
                            <span className="text-white text-sm font-medium">{item.date_display}</span>
                          </div>
                          <span className="text-yellow-400 text-xs font-semibold">{item.count} kargo</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">Ağırlık</span>
                          <span className="text-gray-300">{item.weight} kg</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-green-500/20 flex items-center justify-center">
                      <CheckCircle2 className="w-6 h-6 text-green-400" />
                    </div>
                    <p className="text-gray-500 text-sm">Bekleyen kargo bulunmuyor</p>
                  </div>
                )}
              </div>
            </div>

            {/* Yolda Olan Kargolar - Tarih Bazlı */}
            {dashboardStats?.in_transit_by_date && dashboardStats.in_transit_by_date.length > 0 && (
              <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-6 mb-8">
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <Truck className="w-5 h-5 text-blue-400" />
                  Yolda Olan Kargolar
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {dashboardStats.in_transit_by_date.map((item, idx) => (
                    <div key={idx} className="p-3 bg-[#0a0a0a] rounded-xl border border-[#2a2a2a] hover:border-blue-500/50 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-blue-400" />
                          <span className="text-white font-medium">{item.date_display}</span>
                        </div>
                        <span className="text-blue-400 text-sm font-semibold">{item.count} kargo</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Ağırlık</span>
                        <span className="text-gray-300">{item.weight} kg</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Uyarılar */}
            <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-6">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-[#ff6b00]" />
                İstasyon Bazlı Kargo Durumu
                <span className="text-gray-500 text-sm font-normal ml-2">
                  (Bir sonraki gün için planlama verileri)
                </span>
              </h3>
              
              {istasyonlarWithStats.length === 0 ? (
                <div className="text-gray-500 text-sm text-center py-8">
                  Henüz istasyon bulunmuyor
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {istasyonlarWithStats.map((ist) => (
                    <div
                      key={ist.id}
                      onClick={() => setSelectedIstasyon(selectedIstasyon?.id === ist.id ? null : ist)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all duration-300 ${
                        selectedIstasyon?.id === ist.id
                          ? 'bg-[#ff6b00]/10 border-[#ff6b00] shadow-lg shadow-[#ff6b00]/10'
                          : 'bg-[#0a0a0a] border-[#2a2a2a] hover:border-[#ff6b00]/50 hover:bg-[#1a1a1a]'
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          ist.pending_cargo_count > 0 ? 'bg-orange-500/20' : 'bg-green-500/20'
                        }`}>
                          <MapPin className={`w-5 h-5 ${
                            ist.pending_cargo_count > 0 ? 'text-orange-400' : 'text-green-400'
                          }`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-white font-medium truncate">{ist.name}</h4>
                          <p className="text-gray-500 text-xs">ID: {ist.id}</p>
                        </div>
                      </div>
                      
                      {/* Kargo Bilgileri - Her zaman göster */}
                      <div className="space-y-2 pt-3 border-t border-[#2a2a2a]">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-500 text-sm flex items-center gap-1">
                            <Package size={14} /> Kargo Sayısı
                          </span>
                          <span className={`font-semibold ${
                            ist.pending_cargo_count > 0 ? 'text-orange-400' : 'text-gray-400'
                          }`}>
                            {ist.pending_cargo_count}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-500 text-sm flex items-center gap-1">
                            <Target size={14} /> Toplam Ağırlık
                          </span>
                          <span className={`font-semibold ${
                            ist.pending_total_weight > 0 ? 'text-blue-400' : 'text-gray-400'
                          }`}>
                            {ist.pending_total_weight} kg
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-500 text-sm flex items-center gap-1">
                            <Layers size={14} /> Toplam Adet
                          </span>
                          <span className={`font-semibold ${
                            ist.pending_total_quantity > 0 ? 'text-purple-400' : 'text-gray-400'
                          }`}>
                            {ist.pending_total_quantity}
                          </span>
                        </div>
                      </div>

                      {/* Genişletilmiş Detay */}
                      {selectedIstasyon?.id === ist.id && (
                        <div className="mt-3 pt-3 border-t border-[#ff6b00]/30">
                          <div className="text-xs text-gray-400 space-y-1">
                            <p>📍 Koordinat: {ist.lat}, {ist.lng}</p>
                            <p className="text-[#ff6b00]">
                              {ist.pending_cargo_count > 0 
                                ? '⚠️ Bu istasyonda bekleyen kargo var'
                                : '✅ Bu istasyonda bekleyen kargo yok'}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Toplam Özet */}
              {istasyonlarWithStats.length > 0 && (
                <div className="mt-6 pt-4 border-t border-[#2a2a2a] flex flex-wrap gap-6 justify-center">
                  <div className="text-center">
                    <p className="text-gray-500 text-sm">Toplam İstasyon</p>
                    <p className="text-2xl font-bold text-white">{istasyonlarWithStats.length}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-500 text-sm">Toplam Bekleyen Kargo</p>
                    <p className="text-2xl font-bold text-orange-400">
                      {istasyonlarWithStats.reduce((acc, ist) => acc + ist.pending_cargo_count, 0)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-500 text-sm">Toplam Ağırlık</p>
                    <p className="text-2xl font-bold text-blue-400">
                      {istasyonlarWithStats.reduce((acc, ist) => acc + parseFloat(ist.pending_total_weight?.toFixed(1)), 0)} kg
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-500 text-sm">Kargo Olan İstasyon</p>
                    <p className="text-2xl font-bold text-purple-400">
                      {istasyonlarWithStats.filter(ist => ist.pending_cargo_count > 0).length}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================== İSTASYON YÖNETİMİ ==================== */}
        {activeTab === 'istasyon' && (
          <div>
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <MapPin className="w-8 h-8 text-[#ff6b00]" />
                İstasyon Yönetimi
              </h1>
              <p className="text-gray-500 mt-2">İstasyonları görüntüleyin ve yeni istasyon ekleyin</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Harita */}
              <div className="lg:col-span-2 bg-[#111111] border border-[#2a2a2a] rounded-2xl p-6">
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-[#ff6b00]" />
                  Kocaeli Haritası
                </h3>
                <div className="h-[500px] rounded-xl overflow-hidden">
                  <MapContainer
                    center={[KOCAELI_CENTER.lat, KOCAELI_CENTER.lng]}
                    zoom={10}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <TileLayer
                      attribution='&copy; OpenStreetMap'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    {istasyonlar.map((ist, idx) => (
                      <Marker key={idx} position={[ist.lat, ist.lng]}>
                        <Popup>{ist.name}</Popup>
                      </Marker>
                    ))}
                  </MapContainer>
                </div>
              </div>

              {/* Yeni İstasyon Formu */}
              <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-6">
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <Plus className="w-5 h-5 text-[#ff6b00]" />
                  Yeni İstasyon Ekle
                </h3>
                <form onSubmit={handleIstasyonEkle} className="space-y-4">
                  <div>
                    <label className="text-gray-300 text-sm mb-2 block">İstasyon Adı</label>
                    <input
                      type="text"
                      name="name"
                      value={yeniIstasyon.name}
                      onChange={handleIstasyonChange}
                      placeholder="Örn: Yeni İlçe"
                      className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-[#ff6b00] transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-gray-300 text-sm mb-2 block">Enlem (Latitude)</label>
                    <input
                      type="number"
                      name="lat"
                      value={yeniIstasyon.lat}
                      onChange={handleIstasyonChange}
                      placeholder="Örn: 40.7654"
                      step="0.0001"
                      className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-[#ff6b00] transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-gray-300 text-sm mb-2 block">Boylam (Longitude)</label>
                    <input
                      type="number"
                      name="lng"
                      value={yeniIstasyon.lng}
                      onChange={handleIstasyonChange}
                      placeholder="Örn: 29.9408"
                      step="0.0001"
                      className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-[#ff6b00] transition-all"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-3 bg-gradient-to-r from-[#ff6b00] to-[#ff8533] text-black font-semibold rounded-xl hover:shadow-lg hover:shadow-[#ff6b00]/30 transition-all duration-300 flex items-center justify-center gap-2"
                  >
                    <Plus size={18} />
                    İstasyon Ekle
                  </button>
                </form>

                {/* İstasyon Listesi */}
                <div className="mt-6 pt-6 border-t border-[#2a2a2a]">
                  <h4 className="text-gray-400 text-sm mb-3">Mevcut İstasyonlar ({istasyonlar.length})</h4>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {istasyonLoading ? (
                      <p className="text-gray-500 text-sm text-center py-4">Yükleniyor...</p>
                    ) : istasyonlar.length === 0 ? (
                      <p className="text-gray-500 text-sm text-center py-4">
                        Henüz istasyon bulunmuyor
                      </p>
                    ) : (
                      istasyonlar.map((ist) => (
                        <div key={ist.id} className="flex items-center justify-between p-3 bg-[#0a0a0a] rounded-lg border border-[#2a2a2a] group">
                          <div>
                            <span className="text-white text-sm">{ist.name}</span>
                            <span className="text-gray-500 text-xs ml-2">({ist.lat}, {ist.lng})</span>
                          </div>
                          <button
                            onClick={() => handleIstasyonSil(ist.id)}
                            className="p-1 text-gray-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================== ROTA PLANLAMA ==================== */}
        {activeTab === 'rota' && (
          <div>
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <Route className="w-8 h-8 text-[#ff6b00]" />
                Rota Planlama Merkezi
              </h1>
              <p className="text-gray-500 mt-2">Clarke-Wright Savings algoritması ile optimum rotaları hesaplayın</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Kontrol Paneli */}
              <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-6">
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-[#ff6b00]" />
                  Planlama Ayarları
                </h3>

                {/* Tarih Seçimi */}
                <div className="mb-6">
                  <label className="text-gray-300 text-sm mb-2 block">Planlama Tarihi</label>
                  <input
                    type="date"
                    value={planlamaTarihi}
                    onChange={(e) => setPlanlamaTarihi(e.target.value)}
                    className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white focus:outline-none focus:border-[#ff6b00] transition-all [color-scheme:dark]"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Senaryo 1: 21.12.2025 | Senaryo 2: 22.12.2025 | Senaryo 3: 23.12.2025 | Senaryo 4: 24.12.2025
                  </p>
                </div>

                {/* Kargo Özeti */}
                {cargoSummary && (
                  <div className="mb-6 p-4 bg-[#0a0a0a] rounded-xl border border-[#2a2a2a]">
                    <h4 className="text-gray-300 text-sm mb-3 flex items-center gap-2">
                      <Package size={16} className="text-[#ff6b00]" />
                      Kargo Özeti ({cargoSummary.date})
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Toplam Kargo:</span>
                        <span className="text-white">{cargoSummary.total_cargo_count} adet</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Toplam Ağırlık:</span>
                        <span className="text-white">{cargoSummary.total_weight?.toFixed(1)} kg</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Araç Kapasitesi:</span>
                        <span className="text-white">{cargoSummary.vehicle_capacity} kg</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Durum:</span>
                        <span className={cargoSummary.capacity_sufficient ? 'text-green-400' : 'text-red-400'}>
                          {cargoSummary.capacity_sufficient ? '✓ Kapasite Yeterli' : `⚠ ${cargoSummary.shortage?.toFixed(0)} kg eksik`}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Hesapla Butonu */}
                <button
                  onClick={handleRotaHesapla}
                  disabled={rotaHesaplaniyor}
                  className="w-full py-4 bg-gradient-to-r from-[#ff6b00] to-[#ff8533] text-black font-semibold rounded-xl hover:shadow-lg hover:shadow-[#ff6b00]/30 transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {rotaHesaplaniyor ? (
                    <>
                      <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      Hesaplanıyor...
                    </>
                  ) : (
                    <>
                      <Play size={18} />
                      Rotayı Hesapla
                    </>
                  )}
                </button>

                {/* Sonuç Mesajı */}
                {rotaSonucu && (
                  <div className={`mt-4 p-4 rounded-xl border ${rotaSonucu.success ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                    <p className={rotaSonucu.success ? 'text-green-400 text-sm' : 'text-red-400 text-sm'}>
                      {rotaSonucu.message}
                    </p>
                    {rotaSonucu.warnings?.map((w, i) => (
                      <p key={i} className="text-yellow-400 text-xs mt-1">⚠ {w}</p>
                    ))}
                  </div>
                )}

                {/* Hesaplama Sonucu */}
                {rotaSonucu?.success && (
                  <div className="mt-6 p-4 bg-[#0a0a0a] rounded-xl border border-[#2a2a2a]">
                    <h4 className="text-gray-300 text-sm mb-3">Hesaplama Sonucu</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Kullanılan Araç:</span>
                        <span className="text-white">{rotaSonucu.routes?.length || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Toplam Mesafe:</span>
                        <span className="text-white">{rotaSonucu.total_distance?.toFixed(1)} km</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Yakıt Maliyeti:</span>
                        <span className="text-white">{rotaSonucu.total_fuel_cost?.toFixed(0)} ₺</span>
                      </div>
                      {rotaSonucu.total_rental_cost > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Kiralama Maliyeti:</span>
                          <span className="text-yellow-400">{rotaSonucu.total_rental_cost?.toFixed(0)} ₺</span>
                        </div>
                      )}
                      <div className="flex justify-between pt-2 border-t border-[#2a2a2a]">
                        <span className="text-gray-300 font-medium">Toplam Maliyet:</span>
                        <span className="text-[#ff6b00] font-bold">{rotaSonucu.total_cost?.toFixed(0)} ₺</span>
                      </div>
                    </div>

                    {/* Onayla Butonu */}
                    <button
                      onClick={handleRotaOnayla}
                      className="w-full mt-4 py-3 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 size={18} />
                      Rotayı Onayla ve Kaydet
                    </button>
                  </div>
                )}
              </div>

              {/* Rota Haritası */}
              <div className="lg:col-span-2 bg-[#111111] border border-[#2a2a2a] rounded-2xl p-6">
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-[#ff6b00]" />
                  Hesaplanan Rotalar
                </h3>
                
                {/* Renk Açıklaması */}
                {routePolylines.length > 0 && (
                  <div className="mb-4 flex flex-wrap gap-3">
                    {routePolylines.map((route, idx) => (
                      <div key={idx} className="flex items-center gap-2 px-3 py-1 bg-[#0a0a0a] rounded-lg">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: route.color }}></div>
                        <span className="text-gray-300 text-xs">
                          {route.isRented ? '🔑 Kiralık' : `Araç #${route.id}`} ({route.vehicleCapacity}kg)
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="h-[450px] rounded-xl overflow-hidden mb-4">
                  <MapContainer
                    center={[KOCAELI_CENTER.lat, KOCAELI_CENTER.lng]}
                    zoom={10}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <TileLayer
                      attribution='&copy; OpenStreetMap'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    
                    {/* Umuttepe Deposu - Son Varış Noktası */}
                    {rotaSonucu?.depot && (
                      <Marker position={rotaSonucu.depot.coords}>
                        <Popup>
                          <strong>🏭 {rotaSonucu.depot.name}</strong><br/>
                          <span style={{color: '#10b981'}}>✅ Son Varış Noktası</span><br/>
                          <small style={{color: '#888'}}>Tüm araçlar buraya gelir</small>
                        </Popup>
                      </Marker>
                    )}

                    {/* Algoritmadan Gelen Rotalar */}
                    {routePolylines.map((route, idx) => (
                      <Polyline
                        key={idx}
                        positions={route.path}
                        color={route.color}
                        weight={4}
                        opacity={0.8}
                      />
                    ))}

                    {/* Durak Markerları */}
                    {hesaplananRotalar.map((rota, rotaIdx) =>
                      rota.stops?.map((stop, stopIdx) => (
                        <Marker key={`${rotaIdx}-${stopIdx}`} position={stop.coords}>
                          <Popup>
                            <strong>{stop.station_name}</strong>
                            {stopIdx === 0 && <span style={{color: '#ff6b00'}}> 🚀 (Başlangıç)</span>}
                            <br/>
                            Ağırlık: {stop.total_weight?.toFixed(1)} kg<br/>
                            Kargo: {stop.cargo_ids?.length || 0} adet
                            {stopIdx === 0 && <><br/><small style={{color: '#888'}}>Araç buradan hareket eder</small></>}
                          </Popup>
                        </Marker>
                      ))
                    )}
                  </MapContainer>
                </div>

                {/* Araç Rotaları Detay Tablosu */}
                <div className="bg-[#0a0a0a] rounded-xl border border-[#2a2a2a] overflow-hidden">
                  <div className="p-4 border-b border-[#2a2a2a]">
                    <h4 className="text-white font-medium">Araç Güzergah Detayları</h4>
                  </div>
                  <div className="max-h-[250px] overflow-y-auto">
                    {hesaplananRotalar.length === 0 ? (
                      <div className="p-8 text-center text-gray-500 text-sm">
                        Rota hesaplandığında araç güzergahları burada listelenecek
                      </div>
                    ) : (
                      <div className="divide-y divide-[#2a2a2a]">
                        {hesaplananRotalar.map((rota, idx) => (
                          <div key={idx} className="p-4">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div 
                                  className="w-3 h-3 rounded-full" 
                                  style={{ backgroundColor: ROUTE_COLORS[idx % ROUTE_COLORS.length] }}
                                ></div>
                                <span className="text-white font-medium">
                                  {rota.is_rented ? '🔑 Kiralık Araç' : `Araç #${rota.vehicle_id}`}
                                </span>
                                <span className="text-gray-500 text-xs">({rota.vehicle_capacity} kg)</span>
                              </div>
                              <span className="text-[#ff6b00] font-medium">{rota.total_cost?.toFixed(0)} ₺</span>
                            </div>
                            <div className="text-gray-400 text-sm">
                              <p>� Başlangıç: {rota.start_station}</p>
                              <p>🛣️ Güzergah: {rota.stops?.map(s => s.station_name).join(' → ')} → <span className="text-green-500">Umuttepe</span></p>
                              <p>📏 Mesafe: {rota.total_distance?.toFixed(1)} km <span className="text-gray-500">(tek yön)</span></p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================== OPERASYONEL TAKİP ==================== */}
        {activeTab === 'operasyonel' && (
          <div>
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <BarChart3 className="w-8 h-8 text-[#ff6b00]" />
                Operasyonel Takip
              </h1>
              <p className="text-gray-500 mt-2">Teslimat simülasyonu ve canlı araç takibi</p>
            </div>

            {/* Tarih Seçici ve Kontroller */}
            <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-4 mb-6">
              <div className="flex items-center gap-6 flex-wrap justify-between">
                <div className="flex items-center gap-4">
                  <label className="text-gray-400 text-sm">Teslimat Tarihi:</label>
                  <input
                    type="date"
                    value={operasyonelTarih}
                    onChange={(e) => setOperasyonelTarih(e.target.value)}
                    className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-4 py-2 text-white"
                  />
                </div>
                
                <div className="flex items-center gap-4">
                  {simulasyonAktif ? (
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
                      <span className="text-green-400">Simülasyon Aktif: %{simulasyonProgress}</span>
                      <div className="w-32 h-2 bg-[#2a2a2a] rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-[#ff6b00] transition-all duration-100"
                          style={{ width: `${simulasyonProgress}%` }}
                        ></div>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={handleStartSimulation}
                      disabled={operasyonelTrips.length === 0}
                      className="px-6 py-2 bg-gradient-to-r from-[#ff6b00] to-[#ff8533] text-white rounded-lg hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <Truck className="w-4 h-4" />
                      Simülasyonu Başlat
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Renk Anahtarı */}
            {operasyonelPolylines.length > 0 && (
              <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-4 mb-6">
                <div className="flex items-center gap-6 flex-wrap">
                  <span className="text-gray-400 text-sm">Araç Rotaları:</span>
                  {operasyonelPolylines.map((polyline, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded" style={{ backgroundColor: polyline.color }}></div>
                      <span className="text-gray-300 text-sm">{polyline.vehicle?.plate || `Araç ${idx + 1}`}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Büyük Harita */}
              <div className="lg:col-span-3 bg-[#111111] border border-[#2a2a2a] rounded-2xl p-6">
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-[#ff6b00]" />
                  Canlı Rota Haritası
                </h3>
                <div className="h-[600px] rounded-xl overflow-hidden">
                  <MapContainer
                    center={[KOCAELI_CENTER.lat, KOCAELI_CENTER.lng]}
                    zoom={10}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <TileLayer
                      attribution='&copy; OpenStreetMap'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    
                    {/* Rota çizgileri */}
                    {operasyonelPolylines.map((polyline, idx) => (
                      <Polyline
                        key={idx}
                        positions={polyline.path}
                        color={polyline.color}
                        weight={4}
                      />
                    ))}

                    {/* Durak noktaları */}
                    {operasyonelTrips.map((trip, tIdx) =>
                      trip.stops?.map((stop, sIdx) => (
                        <Marker
                          key={`${tIdx}-${sIdx}`}
                          position={stop.coords}
                          icon={L.divIcon({
                            className: 'custom-marker',
                            html: `<div style="background-color: ${ROUTE_COLORS[tIdx % ROUTE_COLORS.length]}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center; color: white; font-size: 10px; font-weight: bold;">${sIdx + 1}</div>`,
                            iconSize: [24, 24],
                            iconAnchor: [12, 12],
                          })}
                        >
                          <Popup>
                            <div className="text-sm">
                              <strong>{stop.station_name}</strong>
                              <p>Kargo: {stop.total_weight} kg</p>
                              <p>Gönderen: {stop.senders?.join(', ') || '-'}</p>
                            </div>
                          </Popup>
                        </Marker>
                      ))
                    )}

                    {/* Depo noktası */}
                    <Marker
                      position={[40.8225, 29.9250]}
                      icon={L.divIcon({
                        className: 'depot-marker',
                        html: `<div style="background-color: #10b981; width: 30px; height: 30px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: bold;">🏢</div>`,
                        iconSize: [30, 30],
                        iconAnchor: [15, 15],
                      })}
                    >
                      <Popup>
                        <strong>Umuttepe Deposu</strong>
                        <p>Ana Dağıtım Merkezi</p>
                      </Popup>
                    </Marker>

                    {/* Hareketli araç ikonları */}
                    {simulasyonAktif && Object.entries(vehiclePositions).map(([tripId, position], idx) => (
                      <Marker
                        key={`vehicle-${tripId}`}
                        position={position}
                        icon={L.divIcon({
                          className: 'vehicle-marker',
                          html: `<div style="background-color: #ff6b00; width: 35px; height: 35px; border-radius: 50%; border: 4px solid white; display: flex; align-items: center; justify-content: center; font-size: 16px; box-shadow: 0 2px 10px rgba(255,107,0,0.5);">🚚</div>`,
                          iconSize: [35, 35],
                          iconAnchor: [17, 17],
                        })}
                      />
                    ))}
                  </MapContainer>
                </div>
              </div>

              {/* Sefer Detayları */}
              <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-6 max-h-[700px] overflow-y-auto">
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <Truck className="w-5 h-5 text-[#ff6b00]" />
                  Sefer Detayları
                </h3>
                <div className="space-y-4">
                  {operasyonelTrips.length === 0 ? (
                    <div className="text-gray-500 text-sm text-center py-8">
                      Bu tarihe ait sefer bulunmuyor
                    </div>
                  ) : (
                    operasyonelTrips.map((trip, idx) => (
                      <div key={trip.trip_id} className="p-4 bg-[#0a0a0a] rounded-xl border border-[#2a2a2a]">
                        <div className="flex items-center gap-3 mb-3">
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: ROUTE_COLORS[idx % ROUTE_COLORS.length] }}
                          ></div>
                          <span className="text-white font-medium">{trip.vehicle?.plate || 'Araç'}</span>
                          {trip.vehicle?.is_rental && (
                            <span className="text-xs bg-yellow-600 text-white px-2 py-0.5 rounded">Kiralık</span>
                          )}
                        </div>
                        
                        <div className="text-gray-400 text-xs mb-3">
                          <p>Kapasite: {trip.vehicle?.capacity_kg || '-'} kg</p>
                          <p>Toplam Yük: {trip.total_weight || 0} kg</p>
                          <p>Mesafe: {trip.distance?.toFixed(1) || '-'} km</p>
                        </div>
                        
                        <div className="border-t border-[#2a2a2a] pt-3 space-y-2">
                          <p className="text-gray-500 text-xs font-medium mb-2">Duraklar:</p>
                          {trip.stops?.map((stop, sIdx) => (
                            <div key={sIdx} className="text-xs p-2 bg-[#111111] rounded-lg">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs" style={{ backgroundColor: ROUTE_COLORS[idx % ROUTE_COLORS.length] }}>
                                  {sIdx + 1}
                                </span>
                                <span className="text-white font-medium">{stop.station_name}</span>
                              </div>
                              <div className="ml-7 text-gray-500">
                                <p>Ağırlık: {stop.total_weight} kg</p>
                                <p>Gönderen: {stop.senders?.join(', ') || '-'}</p>
                                <p className={`${stop.status === 'delivered' ? 'text-green-400' : stop.status === 'in_transit' ? 'text-yellow-400' : 'text-gray-400'}`}>
                                  Durum: {stop.status === 'delivered' ? '✅ Teslim Edildi' : stop.status === 'in_transit' ? '🚚 Yolda' : '⏳ Bekliyor'}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Özet İstatistikler */}
                {operasyonelTrips.length > 0 && (
                  <div className="mt-6 pt-6 border-t border-[#2a2a2a] space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Toplam Sefer:</span>
                      <span className="text-white">{operasyonelTrips.length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Toplam Kargo:</span>
                      <span className="text-white">
                        {operasyonelTrips.reduce((sum, t) => sum + (t.cargo_count || 0), 0)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Toplam Mesafe:</span>
                      <span className="text-[#ff6b00]">
                        {operasyonelTrips.reduce((sum, t) => sum + (t.distance || 0), 0).toFixed(1)} km
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================== ANALİZLER ==================== */}
        {activeTab === 'analizler' && (
          <div>
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <PieChart className="w-8 h-8 text-[#ff6b00]" />
                Analizler
              </h1>
              <p className="text-gray-500 mt-2">Sistem performans metrikleri ve istatistiksel analizler</p>
            </div>

            {analyticsLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-4 border-[#ff6b00] border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : analyticsData ? (
              <>
                {/* Haftalık Özet Kartları */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                  <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                        <Package className="w-6 h-6 text-blue-400" />
                      </div>
                      <span className={`text-sm font-medium flex items-center gap-1 ${analyticsData.weekly_summary?.cargo_change_percent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {analyticsData.weekly_summary?.cargo_change_percent >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                        {Math.abs(analyticsData.weekly_summary?.cargo_change_percent || 0)}%
                      </span>
                    </div>
                    <h3 className="text-gray-400 text-sm mb-1">Bu Hafta Kargo</h3>
                    <p className="text-3xl font-bold text-white">{analyticsData.weekly_summary?.this_week_cargo || 0}</p>
                    <p className="text-gray-500 text-xs mt-2">Geçen hafta: {analyticsData.weekly_summary?.last_week_cargo || 0}</p>
                  </div>

                  <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                        <CheckCircle2 className="w-6 h-6 text-green-400" />
                      </div>
                      <span className="text-green-400 text-sm font-medium">Teslim</span>
                    </div>
                    <h3 className="text-gray-400 text-sm mb-1">Teslim Edilen</h3>
                    <p className="text-3xl font-bold text-white">{analyticsData.weekly_summary?.this_week_delivered || 0}</p>
                    <p className="text-gray-500 text-xs mt-2">Bu hafta</p>
                  </div>

                  <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                        <Route className="w-6 h-6 text-purple-400" />
                      </div>
                      <span className="text-purple-400 text-sm font-medium">Sefer</span>
                    </div>
                    <h3 className="text-gray-400 text-sm mb-1">Toplam Sefer</h3>
                    <p className="text-3xl font-bold text-white">{analyticsData.weekly_summary?.this_week_trips || 0}</p>
                    <p className="text-gray-500 text-xs mt-2">Bu hafta</p>
                  </div>

                  <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center">
                        <DollarSign className="w-6 h-6 text-orange-400" />
                      </div>
                      <span className="text-orange-400 text-sm font-medium">Maliyet</span>
                    </div>
                    <h3 className="text-gray-400 text-sm mb-1">Haftalık Maliyet</h3>
                    <p className="text-3xl font-bold text-white">{analyticsData.weekly_summary?.this_week_cost || 0} ₺</p>
                    <p className="text-gray-500 text-xs mt-2">Bu hafta</p>
                  </div>
                </div>

                {/* Grafik Satırı 1 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                  {/* Tarih Bazlı Kargo Sayısı */}
                  <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-6">
                    <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                      <Activity className="w-5 h-5 text-[#ff6b00]" />
                      Günlük Kargo Trendleri
                    </h3>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={analyticsData.cargo_by_date || []}>
                          <defs>
                            <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#ff6b00" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#ff6b00" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                          <XAxis dataKey="date" stroke="#666" tick={{ fill: '#888', fontSize: 11 }} />
                          <YAxis stroke="#666" tick={{ fill: '#888', fontSize: 11 }} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '8px' }}
                            labelStyle={{ color: '#fff' }}
                            itemStyle={{ color: '#ff6b00' }}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="count" 
                            stroke="#ff6b00" 
                            strokeWidth={2}
                            fillOpacity={1} 
                            fill="url(#colorCount)" 
                            name="Kargo Sayısı"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Kargo Durumu Dağılımı - Pie Chart */}
                  <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-6">
                    <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                      <PieChart className="w-5 h-5 text-[#ff6b00]" />
                      Kargo Durumu Dağılımı
                    </h3>
                    <div className="h-[300px] flex items-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPieChart>
                          <Pie
                            data={analyticsData.status_distribution || []}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={5}
                            dataKey="count"
                            nameKey="name"
                            label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                            labelLine={{ stroke: '#666' }}
                          >
                            {(analyticsData.status_distribution || []).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '8px' }}
                            labelStyle={{ color: '#fff' }}
                          />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex justify-center gap-6 mt-4">
                      {(analyticsData.status_distribution || []).map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                          <span className="text-gray-400 text-sm">{item.name}: {item.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Grafik Satırı 2 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                  {/* Maliyet Dağılımı - Pie Chart */}
                  <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-6">
                    <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-[#ff6b00]" />
                      Maliyet Dağılımı
                    </h3>
                    <div className="h-[300px] flex items-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPieChart>
                          <Pie
                            data={analyticsData.cost_distribution || []}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={5}
                            dataKey="value"
                            nameKey="name"
                            label={({ name, value }) => `${name}: ${value}₺`}
                            labelLine={{ stroke: '#666' }}
                          >
                            {(analyticsData.cost_distribution || []).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '8px' }}
                            formatter={(value) => [`${value} ₺`, '']}
                          />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex justify-center gap-6 mt-4">
                      {(analyticsData.cost_distribution || []).map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                          <span className="text-gray-400 text-sm">{item.name}: {item.value} ₺</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* İstasyon Bazlı Kargo - Bar Chart */}
                  <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-6">
                    <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-[#ff6b00]" />
                      İstasyon Bazlı Kargo
                    </h3>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={analyticsData.station_cargo || []} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                          <XAxis type="number" stroke="#666" tick={{ fill: '#888', fontSize: 11 }} />
                          <YAxis 
                            dataKey="station_name" 
                            type="category" 
                            width={80} 
                            stroke="#666" 
                            tick={{ fill: '#888', fontSize: 10 }} 
                          />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '8px' }}
                            labelStyle={{ color: '#fff' }}
                          />
                          <Legend />
                          <Bar dataKey="pending" name="Beklemede" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                          <Bar dataKey="delivered" name="Teslim" fill="#10b981" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Grafik Satırı 3 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                  {/* Günlük Sefer ve Maliyet */}
                  <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-6">
                    <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                      <Truck className="w-5 h-5 text-[#ff6b00]" />
                      Günlük Sefer ve Maliyet (Son 14 Gün)
                    </h3>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={analyticsData.trips_by_date || []}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                          <XAxis dataKey="date" stroke="#666" tick={{ fill: '#888', fontSize: 11 }} />
                          <YAxis yAxisId="left" stroke="#666" tick={{ fill: '#888', fontSize: 11 }} />
                          <YAxis yAxisId="right" orientation="right" stroke="#666" tick={{ fill: '#888', fontSize: 11 }} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '8px' }}
                            labelStyle={{ color: '#fff' }}
                          />
                          <Legend />
                          <Bar yAxisId="left" dataKey="trip_count" name="Sefer Sayısı" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                          <Line yAxisId="right" type="monotone" dataKey="cost" name="Maliyet (₺)" stroke="#ff6b00" strokeWidth={2} dot={{ fill: '#ff6b00' }} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Ağırlık Aralığı Dağılımı */}
                  <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-6">
                    <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                      <Target className="w-5 h-5 text-[#ff6b00]" />
                      Kargo Ağırlık Dağılımı
                    </h3>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={analyticsData.weight_distribution || []}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                          <XAxis dataKey="range" stroke="#666" tick={{ fill: '#888', fontSize: 11 }} />
                          <YAxis stroke="#666" tick={{ fill: '#888', fontSize: 11 }} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '8px' }}
                            labelStyle={{ color: '#fff' }}
                          />
                          <Bar dataKey="count" name="Kargo Sayısı" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                            {(analyticsData.weight_distribution || []).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'][index % 5]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Araç Kullanım İstatistikleri Tablosu */}
                <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-6">
                  <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <Truck className="w-5 h-5 text-[#ff6b00]" />
                    Araç Kullanım İstatistikleri
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[#2a2a2a]">
                          <th className="text-left text-gray-400 text-sm py-3 px-4">Araç ID</th>
                          <th className="text-left text-gray-400 text-sm py-3 px-4">Kapasite</th>
                          <th className="text-left text-gray-400 text-sm py-3 px-4">Tip</th>
                          <th className="text-left text-gray-400 text-sm py-3 px-4">Sefer Sayısı</th>
                          <th className="text-left text-gray-400 text-sm py-3 px-4">Toplam Mesafe</th>
                          <th className="text-left text-gray-400 text-sm py-3 px-4">Toplam Maliyet</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(analyticsData.vehicle_stats || []).map((vehicle, idx) => (
                          <tr key={idx} className="border-b border-[#2a2a2a] hover:bg-[#1a1a1a] transition-colors">
                            <td className="text-white py-3 px-4">#{vehicle.vehicle_id}</td>
                            <td className="text-gray-300 py-3 px-4">{vehicle.capacity} kg</td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-1 rounded text-xs ${vehicle.is_rented ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'}`}>
                                {vehicle.is_rented ? 'Kiralık' : 'Özmal'}
                              </span>
                            </td>
                            <td className="text-gray-300 py-3 px-4">{vehicle.trip_count}</td>
                            <td className="text-blue-400 py-3 px-4">{vehicle.total_distance} km</td>
                            <td className="text-[#ff6b00] py-3 px-4">{vehicle.total_cost} ₺</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-8 text-center">
                <p className="text-gray-500">Analiz verileri yüklenemedi</p>
                <button 
                  onClick={fetchAnalytics}
                  className="mt-4 px-4 py-2 bg-[#ff6b00] text-white rounded-lg hover:bg-[#ff8533] transition"
                >
                  Yeniden Dene
                </button>
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
};

export default Yonetici;