from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin

# 1. YÖNETİCİ (MANAGER) SINIFI - createsuperuser'ın ne yapacağını söyler
class CustomUserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('E-posta adresi zorunludur')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password) # Şifreyi şifreleyerek kaydeder
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('role', 'admin')
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(email, password, **extra_fields)

# 2. ÖZEL KULLANICI TABLOSU
class User(AbstractBaseUser, PermissionsMixin):
    ROLE_CHOICES = [
        ('admin', 'Yönetici'),
        ('customer', 'Müşteri'),
    ]
    
    first_name = models.CharField(max_length=50)
    last_name = models.CharField(max_length=50)
    email = models.EmailField(unique=True) # Gmail adresi login için kullanılacak
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='customer')
    
    # Django'nun iç mekanizması için gereken alanlar
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False) 
    is_superuser = models.BooleanField(default=False)

    objects = CustomUserManager()

    USERNAME_FIELD = 'email' # Terminalde kullanıcı adı yerine email soracak
    REQUIRED_FIELDS = ['first_name', 'last_name'] # createsuperuser sırasında sorulacak ek alanlar

    def __str__(self):
        return f"{self.email} ({self.role})"

# 2. İSTASYON (İLÇE) TABLOSU
class Station(models.Model):
    name = models.CharField(max_length=100) # Başiskele, Gebze vb. [cite: 26]
    latitude = models.FloatField() # Enlem [cite: 23]
    longitude = models.FloatField() # Boylam [cite: 23]

    def __str__(self):
        return self.name

# 3. ARAÇ TABLOSU
class Vehicle(models.Model):
    # Kapasiteler: 500, 750, 1000 kg [cite: 39]
    capacity = models.PositiveIntegerField() 
    is_rented = models.BooleanField(default=False) # Kiralık mı? [cite: 31]
    rental_cost = models.FloatField(default=0.0) # Kiralama maliyeti (200 birim) [cite: 40]

    def __str__(self):
        return f"{self.capacity}kg {'Kiralık' if self.is_rented else 'Özmal'}"

# 4. KARGO (TALEP) TABLOSU
class Cargo(models.Model):
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='cargoes')
    station = models.ForeignKey(Station, on_delete=models.CASCADE) # [cite: 13]
    weight = models.FloatField() # [cite: 15]
    quantity = models.PositiveIntegerField() # [cite: 15]
    status = models.CharField(max_length=20, default='pending')
    target_date = models.DateField(null=True, blank=True) # Hangi gün taşınacak?
    created_at = models.DateTimeField(auto_now_add=True)

# 5. SEFER / ROTA TABLOSU
class Trip(models.Model):
    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE)
    total_distance = models.FloatField(default=0.0)
    total_cost = models.FloatField(default=0.0) # Yakıt (km başı 1 birim) + Kiralama [cite: 37, 40]
    route_data = models.JSONField() # Durak sırası: ["İzmit", "Körfez", "KOÜ"] [cite: 16]
    planned_date = models.DateField()