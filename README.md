# Cargo Tracking System

Kargo takip ve rota optimizasyonu sistemi. Django backend ve React frontend ile geliştirilmiştir.

## Özellikler

- 🚚 Kargo takibi ve yönetimi
- 📍 Rota optimizasyonu
- 👤 Kullanıcı ve yönetici panelleri
- 🗺️ Mesafe matrisi hesaplaması
- 📦 Araç ve kargo senaryoları

## Teknolojiler

### Backend
- Django 5.2
- Django REST Framework
- CORS Headers
- SQLite

### Frontend
- React
- Tailwind CSS
- React Router

## Kurulum

### Backend Kurulumu

1. Virtual environment oluşturun:
```bash
cd backendd
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac
```

2. Bağımlılıkları yükleyin:
```bash
pip install -r requirements.txt
```

3. `.env` dosyası oluşturun:
```bash
cp ../.env.example .env
# .env dosyasını düzenleyip SECRET_KEY ekleyin
```

4. Veritabanını oluşturun:
```bash
python manage.py migrate
```

5. Seed verilerini yükleyin (opsiyonel):
```bash
python manage.py seed_vehicles
python manage.py seed_scenarios
```

6. Sunucuyu başlatın:
```bash
python manage.py runserver
```

### Frontend Kurulumu

1. Bağımlılıkları yükleyin:
```bash
cd frontend
npm install
```

2. Geliştirme sunucusunu başlatın:
```bash
npm start
```

## Kullanım

- Backend: http://localhost:8000
- Frontend: http://localhost:3000

## Proje Yapısı

```
├── backendd/              # Django backend
│   ├── yoneticiekrani/    # Yönetici uygulaması
│   ├── kullaniciekrani/   # Kullanıcı uygulaması
│   └── manage.py
├── frontend/              # React frontend
│   ├── src/
│   │   ├── components/
│   │   └── pages/
│   └── package.json
└── README.md
```

## Güvenlik Notları

⚠️ **Önemli:** Production ortamında:
- `DEBUG = False` yapın
- `SECRET_KEY`'i güvenli bir şekilde saklayın
- `ALLOWED_HOSTS` ayarını yapın
- HTTPS kullanın

## Lisans

Bu proje eğitim amaçlıdır.
