"""
Senaryo verilerini veritabanına yükler.
Kullanım: python manage.py seed_scenarios

Tarih Eşleştirmesi:
- 21.12.2025 → Senaryo 1
- 22.12.2025 → Senaryo 2
- 23.12.2025 → Senaryo 3
- 24.12.2025 → Senaryo 4
"""

from datetime import date
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from yoneticiekrani.models import Station, Cargo

User = get_user_model()

# Senaryo verileri: {istasyon_adı: (kargo_sayısı, toplam_ağırlık)}
SENARYO_1 = {
    "Başiskele": (10, 120),
    "Çayırova": (8, 80),
    "Darıca": (15, 200),
    "Derince": (10, 150),
    "Dilovası": (12, 180),
    "Gebze": (5, 70),
    "Gölcük": (7, 90),
    "Kandıra": (6, 60),
    "Karamürsel": (9, 110),
    "Kartepe": (11, 130),
    "Körfez": (6, 75),
    "İzmit": (14, 160),
}

SENARYO_2 = {
    "Başiskele": (40, 200),
    "Çayırova": (35, 175),
    "Darıca": (10, 150),
    "Derince": (5, 100),
    "Dilovası": (0, 0),
    "Gebze": (8, 120),
    "Gölcük": (0, 0),
    "Kandıra": (0, 0),
    "Karamürsel": (0, 0),
    "Kartepe": (0, 0),
    "Körfez": (0, 0),
    "İzmit": (20, 160),
}

SENARYO_3 = {
    "Başiskele": (0, 0),
    "Çayırova": (3, 700),
    "Darıca": (0, 0),
    "Derince": (0, 0),
    "Dilovası": (4, 800),
    "Gebze": (5, 900),
    "Gölcük": (0, 0),
    "Kandıra": (0, 0),
    "Karamürsel": (0, 0),
    "Kartepe": (0, 0),
    "Körfez": (0, 0),
    "İzmit": (5, 300),
}

SENARYO_4 = {
    "Başiskele": (30, 300),
    "Çayırova": (0, 0),
    "Darıca": (0, 0),
    "Derince": (0, 0),
    "Dilovası": (0, 0),
    "Gebze": (0, 0),
    "Gölcük": (15, 220),
    "Kandıra": (5, 250),
    "Karamürsel": (20, 180),
    "Kartepe": (10, 200),
    "Körfez": (8, 400),
    "İzmit": (0, 0),
}

# Tarih eşleştirmesi
SCENARIO_DATES = {
    1: date(2025, 12, 21),
    2: date(2025, 12, 22),
    3: date(2025, 12, 23),
    4: date(2025, 12, 24),
}


class Command(BaseCommand):
    help = "Senaryo 1-4 için test kargo verilerini yükler"

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Mevcut tüm kargoları sil ve yeniden oluştur',
        )
        parser.add_argument(
            '--scenario',
            type=int,
            choices=[1, 2, 3, 4],
            help='Sadece belirli bir senaryoyu yükle (1, 2, 3 veya 4)',
        )

    def handle(self, *args, **options):
        # Admin kullanıcıyı bul veya oluştur (kargo sender için gerekli)
        admin_user = User.objects.filter(role='admin').first()
        if not admin_user:
            admin_user = User.objects.filter(is_superuser=True).first()
        if not admin_user:
            self.stdout.write(self.style.ERROR(
                "Admin kullanıcı bulunamadı! Önce 'python manage.py createsuperuser' çalıştırın."
            ))
            return

        # İstasyonları kontrol et
        if not Station.objects.exists():
            self.stdout.write(self.style.ERROR(
                "İstasyon bulunamadı! Önce backend'i çalıştırın veya istasyonları ekleyin."
            ))
            return

        if options['clear']:
            # Senaryo tarihlerine ait kargoları sil
            for scenario_num, target_date in SCENARIO_DATES.items():
                deleted, _ = Cargo.objects.filter(target_date=target_date).delete()
                self.stdout.write(f"Senaryo {scenario_num} ({target_date}): {deleted} kargo silindi")

        scenarios_to_load = [options['scenario']] if options['scenario'] else [1, 2, 3, 4]
        
        scenario_data = {
            1: SENARYO_1,
            2: SENARYO_2,
            3: SENARYO_3,
            4: SENARYO_4,
        }

        for scenario_num in scenarios_to_load:
            target_date = SCENARIO_DATES[scenario_num]
            data = scenario_data[scenario_num]
            
            # Bu tarih için zaten kargo var mı kontrol et
            existing = Cargo.objects.filter(target_date=target_date).count()
            if existing > 0 and not options['clear']:
                self.stdout.write(self.style.WARNING(
                    f"Senaryo {scenario_num} ({target_date}): Zaten {existing} kargo var. --clear ile temizleyebilirsiniz."
                ))
                continue

            created_count = 0
            for station_name, (cargo_count, total_weight) in data.items():
                if cargo_count == 0:
                    continue

                station = Station.objects.filter(name=station_name).first()
                if not station:
                    self.stdout.write(self.style.WARNING(f"İstasyon bulunamadı: {station_name}"))
                    continue

                # Her kargo için ağırlık = toplam_ağırlık / kargo_sayısı
                weight_per_cargo = total_weight / cargo_count if cargo_count > 0 else 0

                for i in range(cargo_count):
                    Cargo.objects.create(
                        sender=admin_user,
                        station=station,
                        weight=round(weight_per_cargo, 2),
                        quantity=1,
                        status='pending',
                        target_date=target_date,
                    )
                    created_count += 1

            self.stdout.write(self.style.SUCCESS(
                f"✅ Senaryo {scenario_num} ({target_date}): {created_count} kargo oluşturuldu"
            ))

        self.stdout.write(self.style.SUCCESS("\n🎉 Senaryo verileri başarıyla yüklendi!"))
        self.stdout.write("\nTarih - Senaryo Eşleştirmesi:")
        self.stdout.write("  21.12.2025 → Senaryo 1 (Dengeli dağılım, hafif kargolar)")
        self.stdout.write("  22.12.2025 → Senaryo 2 (Yoğun batı bölgesi)")
        self.stdout.write("  23.12.2025 → Senaryo 3 (Az sayıda ağır kargo)")
        self.stdout.write("  24.12.2025 → Senaryo 4 (Yoğun doğu bölgesi)")
