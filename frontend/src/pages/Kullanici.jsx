import React, { useEffect, useState } from 'react';
import { 
  Truck, 
  MapPin, 
  Package, 
  LogOut, 
  Menu, 
  X,
  User,
  Scale,
  Hash,
  Send,
  CheckCircle,
  Eye
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Leaflet marker fix
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Kocaeli ilçeleri (istasyonlar)
const ISTASYONLAR = [
  { id: 1, name: 'İzmit', lat: 40.7654, lng: 29.9408 },
  { id: 2, name: 'Gebze', lat: 40.8027, lng: 29.4307 },
  { id: 3, name: 'Darıca', lat: 40.7694, lng: 29.3753 },
  { id: 4, name: 'Çayırova', lat: 40.8261, lng: 29.3711 },
  { id: 5, name: 'Dilovası', lat: 40.7847, lng: 29.5375 },
  { id: 6, name: 'Körfez', lat: 40.7539, lng: 29.7644 },
  { id: 7, name: 'Derince', lat: 40.7553, lng: 29.8147 },
  { id: 8, name: 'Gölcük', lat: 40.7167, lng: 29.8333 },
  { id: 9, name: 'Karamürsel', lat: 40.6917, lng: 29.6167 },
  { id: 10, name: 'Kandıra', lat: 41.0694, lng: 30.1528 },
  { id: 11, name: 'Kartepe', lat: 40.7500, lng: 30.0333 },
  { id: 12, name: 'Başiskele', lat: 40.7167, lng: 29.9167 },
];
const HUB_COORDS = { lat: 40.8225, lng: 29.9250 };
const API_BASE = 'http://localhost:8000/api';

const Kullanici = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('kargo-yolla');
  const user = JSON.parse(localStorage.getItem('user')) || { firstName: 'Kullanıcı', lastName: '' };

  // Ortak API state
  const sessionToken = localStorage.getItem('token');
  const authHeaders = sessionToken ? { Authorization: `Session ${sessionToken}` } : {};
  const [stations, setStations] = useState(ISTASYONLAR);
  const [stationsLoading, setStationsLoading] = useState(true);

  // Kargo Yolla State
  const [formData, setFormData] = useState({ istasyon: '', agirlik: '', adet: '', tarih: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Kargo İzleme State
  const [cargoes, setCargoes] = useState([]);
  const [cargoLoading, setCargoLoading] = useState(false);
  const [selectedKargo, setSelectedKargo] = useState(null);
  const [routePoints, setRoutePoints] = useState([]);
  const [tripInfo, setTripInfo] = useState(null);
  const [vehiclePosition, setVehiclePosition] = useState(null);
  const [simulasyonAktif, setSimulasyonAktif] = useState(false);
  const [simulasyonProgress, setSimulasyonProgress] = useState(0);

  useEffect(() => {
    fetchStations();
    fetchCargoes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchStations = async () => {
    setStationsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/stations/`);
      if (!res.ok) throw new Error('Stations fetch failed');
      const data = await res.json();
      setStations(data.stations || ISTASYONLAR);
    } catch (err) {
      setStations(ISTASYONLAR);
    } finally {
      setStationsLoading(false);
    }
  };

  const fetchCargoes = async () => {
    if (!sessionToken) {
      setCargoes([]);
      return;
    }
    setCargoLoading(true);
    try {
      const res = await fetch(`${API_BASE}/cargo/`, {
        headers: {
          Accept: 'application/json',
          ...authHeaders,
        },
      });
      const data = await res.json();
      if (res.ok) {
        setCargoes(data.cargoes || []);
      } else {
        setError(data.message || 'Kargolar alınamadı.');
      }
    } catch (err) {
      setError('Kargolar alınamadı.');
    } finally {
      setCargoLoading(false);
    }
  };
  //dijkstra ile gerçek yol rotası çek
  const fetchRouteFromBackend = async (coordinates) => {
    if (!coordinates || coordinates.length < 2) return coordinates;
    try {
      const coordString = coordinates.map(c => `${c[1]},${c[0]}`).join(';');
      const url = `https://router.project-osrm.org/route/v1/driving/${coordString}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.routes && data.routes[0]) {
        return data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
      }
    } catch (err) {
      console.error('backend error:', err);
    }
    return coordinates;
  };

  // Kargo seçildiğinde trip bilgisini çek
  const fetchCargoRoute = async (cargo) => {
    try {
      const res = await fetch(`${API_BASE}/cargo/${cargo.id}/route/`, {
        headers: { ...authHeaders },
      });
      const data = await res.json();
      if (res.ok) {
        // Eğer trip varsa backend ile gerçek yolu çek
        if (data.route && data.route.length > 0) {
          const realPath = await fetchRouteFromBackend(data.route);
          setRoutePoints(realPath);
        }
        setTripInfo(data.trip || null);
        
        // Eğer kargo yolda ise araç pozisyonunu başlangıçta ilk durağa koy
        if (data.trip && cargo.status === 'in_transit') {
          setVehiclePosition(data.route[0]);
        } else {
          setVehiclePosition(null);
        }
      }
    } catch (err) {
      console.error('Kargo route fetch error:', err);
      // Fallback basit rota
      if (cargo?.station) {
        setRoutePoints([
          [cargo.station.lat, cargo.station.lng],
          [HUB_COORDS.lat, HUB_COORDS.lng],
        ]);
      }
    }
  };

  // Simülasyon animasyonu başlat
  const startTrackingSimulation = () => {
    if (!routePoints || routePoints.length < 2 || !tripInfo) return;
    
    setSimulasyonAktif(true);
    setSimulasyonProgress(0);
    
    const duration = 10000; // 10 saniye
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      setSimulasyonProgress(Math.round(progress * 100));
      
      // Araç pozisyonunu hesapla
      const pathLength = routePoints.length;
      const currentIndex = Math.floor(progress * (pathLength - 1));
      setVehiclePosition(routePoints[currentIndex]);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setSimulasyonAktif(false);
      }
    };
    
    requestAnimationFrame(animate);
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (!formData.istasyon) {
      setError('Lütfen bir istasyon seçin.');
      setIsLoading(false);
      return;
    }
    if (!formData.agirlik || parseFloat(formData.agirlik) <= 0) {
      setError('Geçerli bir ağırlık girin.');
      setIsLoading(false);
      return;
    }
    if (!formData.adet || parseInt(formData.adet) <= 0) {
      setError('Geçerli bir adet girin.');
      setIsLoading(false);
      return;
    }
    if (!formData.tarih) {
      setError('Lütfen bir tarih seçin.');
      setIsLoading(false);
      return;
    }

    try {
      const payload = {
        station_id: parseInt(formData.istasyon, 10),
        weight: parseFloat(formData.agirlik),
        quantity: parseInt(formData.adet, 10),
        target_date: formData.tarih,
      };

      const res = await fetch(`${API_BASE}/cargo/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || 'Kargo gönderilirken bir hata oluştu.');
        return;
      }

      const newCargo = data.cargo;
      setSuccess(true);
      setFormData({ istasyon: '', agirlik: '', adet: '', tarih: '' });
      fetchCargoes();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError('Sunucu hatası.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectCargo = (cargo) => {
    setSelectedKargo(cargo);
    setTripInfo(null);
    setVehiclePosition(null);
    setSimulasyonAktif(false);
    setSimulasyonProgress(0);
    
    // Kargo yolda veya teslim edildiyse trip bilgisini çek
    if (cargo.status === 'in_transit' || cargo.status === 'delivered') {
      fetchCargoRoute(cargo);
    } else {
      // Bekleyen kargo için basit rota göster
      if (cargo?.station) {
        setRoutePoints([
          [cargo.station.lat, cargo.station.lng],
          [HUB_COORDS.lat, HUB_COORDS.lng],
        ]);
      }
    }
  };

  const selectedStation = stations.find(i => i.id === parseInt(formData.istasyon, 10));

  const statusBadgeClass = (status) => {
    const normalized = (status || '').toLowerCase();
    if (normalized.includes('deliver')) return 'bg-green-500/20 text-green-400';
    if (normalized.includes('yolda') || normalized.includes('transit')) return 'bg-blue-500/20 text-blue-400';
    if (normalized.includes('bekle') || normalized.includes('pending')) return 'bg-yellow-500/20 text-yellow-400';
    return 'bg-gray-500/20 text-gray-300';
  };

  const formatStatus = (status) => {
    const normalized = (status || '').toLowerCase();
    if (normalized.includes('deliver')) return '✅ Teslim Edildi';
    if (normalized.includes('yolda') || normalized.includes('transit')) return '🚚 Yolda';
    if (normalized.includes('bekle') || normalized.includes('pending')) return '⏳ Beklemede';
    return status || 'Beklemede';
  };

  return (
    <div className="flex h-screen bg-[#0a0a0a]">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-[#111111] border-r border-[#2a2a2a] flex flex-col transition-all duration-300`}>
        {/* Logo */}
        <div className="p-4 border-b border-[#2a2a2a] flex items-center justify-between">
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <Truck className="w-8 h-8 text-[#ff6b00]" />
              <span className="text-white font-bold text-lg">KARGO</span>
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
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#ff6b00] to-[#ff8533] flex items-center justify-center flex-shrink-0">
              <User className="w-5 h-5 text-black" />
            </div>
            {sidebarOpen && (
              <div className="overflow-hidden">
                <p className="text-white font-medium truncate">{user.firstName} {user.lastName}</p>
                <p className="text-gray-500 text-sm">Müşteri</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={() => setActiveTab('kargo-yolla')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 w-full ${
              activeTab === 'kargo-yolla'
                ? 'bg-[#ff6b00] text-black font-semibold shadow-lg shadow-[#ff6b00]/20'
                : 'text-gray-400 hover:bg-[#1a1a1a] hover:text-white'
            } ${!sidebarOpen && 'justify-center px-3'}`}
          >
            <Package size={20} className="flex-shrink-0" />
            {sidebarOpen && <span>Kargo Yolla</span>}
          </button>
          <button
            onClick={() => setActiveTab('kargo-izleme')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 w-full ${
              activeTab === 'kargo-izleme'
                ? 'bg-[#ff6b00] text-black font-semibold shadow-lg shadow-[#ff6b00]/20'
                : 'text-gray-400 hover:bg-[#1a1a1a] hover:text-white'
            } ${!sidebarOpen && 'justify-center px-3'}`}
          >
            <MapPin size={20} className="flex-shrink-0" />
            {sidebarOpen && <span>Kargo İzleme</span>}
          </button>
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

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-6 lg:p-8">
        {activeTab === 'kargo-yolla' ? (
          /* ========== KARGO YOLLA ========== */
          <div>
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <Package className="w-8 h-8 text-[#ff6b00]" />
                Kargo Yolla
              </h1>
              <p className="text-gray-500 mt-2">Yeni kargo talebinizi oluşturun</p>
            </div>

            <div className="max-w-2xl">
              <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-6 lg:p-8">
                {success && (
                  <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-xl flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="text-green-500">Kargo talebiniz başarıyla oluşturuldu!</span>
                  </div>
                )}
                {error && (
                  <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                    <span className="text-red-500">{error}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label className="flex items-center gap-2 text-gray-300 font-medium mb-3">
                      <MapPin className="w-4 h-4 text-[#ff6b00]" />
                      Teslim İstasyonu
                    </label>
                    <select
                      name="istasyon"
                      value={formData.istasyon}
                      onChange={handleChange}
                      className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white focus:outline-none focus:border-[#ff6b00] transition-all"
                    >
                      <option value="">İlçe seçin...</option>
                      {stations.map(ist => (
                        <option key={ist.id} value={ist.id}>{ist.name}</option>
                      ))}
                    </select>
                    {stationsLoading && (
                      <p className="text-xs text-gray-500 mt-2">İstasyonlar yükleniyor...</p>
                    )}
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-gray-300 font-medium mb-3">
                      <Scale className="w-4 h-4 text-[#ff6b00]" />
                      Kargo Ağırlığı (kg)
                    </label>
                    <input
                      type="number"
                      name="agirlik"
                      value={formData.agirlik}
                      onChange={handleChange}
                      placeholder="Örn: 5.5"
                      step="0.1"
                      min="0.1"
                      className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-[#ff6b00] transition-all"
                    />
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-gray-300 font-medium mb-3">
                      <Hash className="w-4 h-4 text-[#ff6b00]" />
                      Kargo Adedi
                    </label>
                    <input
                      type="number"
                      name="adet"
                      value={formData.adet}
                      onChange={handleChange}
                      placeholder="Örn: 3"
                      min="1"
                      className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-[#ff6b00] transition-all"
                    />
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-gray-300 font-medium mb-3">
                      <Truck className="w-4 h-4 text-[#ff6b00]" />
                      Talep Tarihi
                    </label>
                    <input
                      type="date"
                      name="tarih"
                      value={formData.tarih}
                      onChange={handleChange}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-[#ff6b00] transition-all [color-scheme:dark]"
                    />
                    <p className="text-xs text-gray-500 mt-2">Kargonuzun teslim alınmasını istediğiniz tarih</p>
                  </div>

                  {formData.istasyon && formData.agirlik && formData.adet && (
                    <div className="p-4 bg-[#ff6b00]/10 border border-[#ff6b00]/30 rounded-xl">
                      <h4 className="text-[#ff6b00] font-medium mb-2">Kargo Özeti</h4>
                      <div className="text-gray-400 text-sm space-y-1">
                        <p><span className="text-gray-500">Teslim Noktası:</span> {selectedStation?.name}</p>
                        <p><span className="text-gray-500">Toplam Ağırlık:</span> {(parseFloat(formData.agirlik) * parseInt(formData.adet)).toFixed(1)} kg</p>
                        <p><span className="text-gray-500">Adet:</span> {formData.adet} paket</p>
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-4 bg-gradient-to-r from-[#ff6b00] to-[#ff8533] text-black font-semibold rounded-xl hover:shadow-lg hover:shadow-[#ff6b00]/30 transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isLoading ? (
                      <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        Kargo Gönder
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          </div>
        ) : (
          /* ========== KARGO İZLEME ========== */
          <div>
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <MapPin className="w-8 h-8 text-[#ff6b00]" />
                Kargo İzleme
              </h1>
              <p className="text-gray-500 mt-2">Kargolarınızın durumunu takip edin</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Kargo Listesi */}
              <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-6">
                <h3 className="text-white font-semibold mb-4">Kargolarım</h3>
                <div className="space-y-3">
                  {cargoLoading && <p className="text-gray-500 text-sm">Kargolar yükleniyor...</p>}
                  {!cargoLoading && cargoes.length === 0 && (
                    <p className="text-gray-500 text-sm">Henüz bir kargo oluşturmadınız.</p>
                  )}
                  {cargoes.map(kargo => (
                    <div
                      key={kargo.id}
                      onClick={() => handleSelectCargo(kargo)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${
                        selectedKargo?.id === kargo.id
                          ? 'bg-[#ff6b00]/10 border-[#ff6b00]'
                          : 'bg-[#0a0a0a] border-[#2a2a2a] hover:border-[#ff6b00]/50'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-white font-medium">{kargo.station?.name || 'İstasyon'}</span>
                        <span className={`text-xs px-2 py-1 rounded-full ${statusBadgeClass(kargo.status)}`}>
                          {formatStatus(kargo.status)}
                        </span>
                      </div>
                      <div className="text-gray-500 text-sm">
                        <span>{kargo.weight} kg • {kargo.quantity} adet</span>
                        <span className="ml-3">Teslimat: {kargo.targetDate ? new Date(kargo.targetDate).toLocaleDateString('tr-TR') : '-'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Harita ve Takip */}
              <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-6">
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <Eye className="w-4 h-4 text-[#ff6b00]" />
                  Kargo Takibi
                </h3>

                {/* Araç bilgisi (yolda veya teslim edildiyse) */}
                {selectedKargo && tripInfo && (
                  <div className="mb-4 p-4 bg-[#0a0a0a] rounded-xl border border-[#2a2a2a]">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Truck className="w-5 h-5 text-[#ff6b00]" />
                        <span className="text-white font-medium">{tripInfo.vehicle?.plate}</span>
                        {tripInfo.vehicle?.is_rental && (
                          <span className="text-xs bg-yellow-600 text-white px-2 py-0.5 rounded">Kiralık</span>
                        )}
                      </div>
                      <span className="text-gray-400 text-sm">{tripInfo.total_distance?.toFixed(1)} km</span>
                    </div>
                    
                    {/* Duraklar */}
                    <div className="space-y-2 mb-4">
                      {tripInfo.stops?.map((stop, idx) => (
                        <div 
                          key={idx} 
                          className={`flex items-center gap-2 text-sm ${stop.is_my_cargo ? 'text-[#ff6b00]' : 'text-gray-400'}`}
                        >
                          <span className="w-5 h-5 rounded-full bg-[#2a2a2a] flex items-center justify-center text-xs">
                            {idx + 1}
                          </span>
                          <span>{stop.station_name}</span>
                          {stop.is_my_cargo && <span className="text-xs bg-[#ff6b00]/20 text-[#ff6b00] px-2 rounded">Kargonuz</span>}
                        </div>
                      ))}
                      <div className="flex items-center gap-2 text-sm text-green-400">
                        <span className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center text-xs">🏢</span>
                        <span>Umuttepe Deposu</span>
                      </div>
                    </div>

                    {/* Simülasyon Butonu */}
                    {selectedKargo.status === 'in_transit' && (
                      <div className="flex items-center gap-3">
                        {simulasyonAktif ? (
                          <div className="flex items-center gap-3 w-full">
                            <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
                            <span className="text-green-400 text-sm">Takip: %{simulasyonProgress}</span>
                            <div className="flex-1 h-2 bg-[#2a2a2a] rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-[#ff6b00] transition-all duration-100"
                                style={{ width: `${simulasyonProgress}%` }}
                              ></div>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={startTrackingSimulation}
                            className="w-full py-2 bg-gradient-to-r from-[#ff6b00] to-[#ff8533] text-black font-semibold rounded-lg hover:opacity-90 transition flex items-center justify-center gap-2"
                          >
                            <Truck className="w-4 h-4" />
                            Canlı Takip Başlat
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="h-[350px] rounded-xl overflow-hidden">
                  <MapContainer
                    center={[40.7654, 29.7]}
                    zoom={10}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <TileLayer
                      attribution='&copy; OpenStreetMap'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    
                    {/* Rota çizgisi */}
                    {selectedKargo && routePoints.length > 1 && (
                      <Polyline positions={routePoints} color="#ff6b00" weight={4} />
                    )}
                    
                    {/* Depo */}
                    <Marker 
                      position={[HUB_COORDS.lat, HUB_COORDS.lng]}
                      icon={L.divIcon({
                        className: 'depot-marker',
                        html: `<div style="background-color: #10b981; width: 28px; height: 28px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center; font-size: 12px;">🏢</div>`,
                        iconSize: [28, 28],
                        iconAnchor: [14, 14],
                      })}
                    >
                      <Popup>Umuttepe Deposu</Popup>
                    </Marker>

                    {/* Trip durakları */}
                    {tripInfo?.stops?.map((stop, idx) => (
                      <Marker
                        key={idx}
                        position={stop.coords}
                        icon={L.divIcon({
                          className: 'stop-marker',
                          html: `<div style="background-color: ${stop.is_my_cargo ? '#ff6b00' : '#6b7280'}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center; color: white; font-size: 10px; font-weight: bold;">${idx + 1}</div>`,
                          iconSize: [24, 24],
                          iconAnchor: [12, 12],
                        })}
                      >
                        <Popup>
                          <strong>{stop.station_name}</strong>
                          {stop.is_my_cargo && <p className="text-[#ff6b00]">📦 Kargonuzun durağı</p>}
                        </Popup>
                      </Marker>
                    ))}

                    {/* Trip yoksa sadece seçilen kargo istasyonunu göster */}
                    {!tripInfo && selectedKargo && (
                      <Marker position={[selectedKargo.station.lat, selectedKargo.station.lng]}>
                        <Popup>{selectedKargo.station.name}</Popup>
                      </Marker>
                    )}

                    {/* Hareketli araç ikonu */}
                    {vehiclePosition && simulasyonAktif && (
                      <Marker
                        position={vehiclePosition}
                        icon={L.divIcon({
                          className: 'vehicle-marker',
                          html: `<div style="background-color: #ff6b00; width: 35px; height: 35px; border-radius: 50%; border: 4px solid white; display: flex; align-items: center; justify-content: center; font-size: 16px; box-shadow: 0 2px 10px rgba(255,107,0,0.5);">🚚</div>`,
                          iconSize: [35, 35],
                          iconAnchor: [17, 17],
                        })}
                      />
                    )}
                  </MapContainer>
                </div>
                
                {!selectedKargo && (
                  <p className="text-gray-500 text-sm mt-4 text-center">
                    Rotayı görmek için listeden bir kargo seçin
                  </p>
                )}
                {selectedKargo && routePoints.length === 0 && (
                  <p className="text-gray-500 text-sm mt-4 text-center">
                    Rota bilgisi hazırlanıyor...
                  </p>
                )}
                {selectedKargo && selectedKargo.status === 'pending' && (
                  <p className="text-yellow-500 text-sm mt-4 text-center">
                    ⏳ Kargonuz henüz planlamaya alınmadı. Yönetici onayı bekleniyor.
                  </p>
                )}
                {selectedKargo && selectedKargo.status === 'delivered' && (
                  <p className="text-green-500 text-sm mt-4 text-center">
                    ✅ Kargonuz teslim edildi!
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Kullanici;
