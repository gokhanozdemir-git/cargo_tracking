"""
Başlangıç araçlarını veritabanına yükler.
Kullanım: python manage.py seed_vehicles

Başlangıç Araçları (Özmal):
- 500 kg kapasiteli
- 750 kg kapasiteli
- 1000 kg kapasiteli
"""

from django.core.management.base import BaseCommand
from yoneticiekrani.models import Vehicle


# Başlangıç araçları (özmal, kiralama maliyeti 0)
INITIAL_VEHICLES = [
    {"capacity": 500, "is_rented": False, "rental_cost": 0},
    {"capacity": 750, "is_rented": False, "rental_cost": 0},
    {"capacity": 1000, "is_rented": False, "rental_cost": 0},
]


class Command(BaseCommand):
    help = "Başlangıç araçlarını (500kg, 750kg, 1000kg) veritabanına yükler"

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Mevcut tüm araçları sil ve yeniden oluştur',
        )

    def handle(self, *args, **options):
        if options['clear']:
            deleted, _ = Vehicle.objects.all().delete()
            self.stdout.write(f"🗑️  {deleted} araç silindi")

        # Mevcut araçları kontrol et
        existing = Vehicle.objects.filter(is_rented=False).count()
        if existing > 0 and not options['clear']:
            self.stdout.write(self.style.WARNING(
                f"Zaten {existing} özmal araç mevcut. --clear ile temizleyebilirsiniz."
            ))
            return

        created_count = 0
        for vehicle_data in INITIAL_VEHICLES:
            vehicle = Vehicle.objects.create(**vehicle_data)
            self.stdout.write(
                f"  ✅ Araç oluşturuldu: {vehicle.capacity} kg (Özmal)"
            )
            created_count += 1

        self.stdout.write(self.style.SUCCESS(
            f"\n🚚 {created_count} başlangıç aracı oluşturuldu!"
        ))
        self.stdout.write("\nAraç Listesi:")
        self.stdout.write("  • 500 kg  - Özmal (Kiralama: 0₺)")
        self.stdout.write("  • 750 kg  - Özmal (Kiralama: 0₺)")
        self.stdout.write("  • 1000 kg - Özmal (Kiralama: 0₺)")
        self.stdout.write("\n💡 Not: Kiralık araçlar gerektiğinde sistem tarafından eklenebilir (200₺/araç)")
