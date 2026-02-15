"""
Kocaeli İlçeleri Arası Mesafe Matrisi (km)
Google Maps'ten alınan gerçek yol mesafeleri.

İlçeler:
0: İzmit (Merkez/Umuttepe)
1: Gebze
2: Darıca
3: Çayırova
4: Dilovası
5: Körfez
6: Derince
7: Gölcük
8: Karamürsel
9: Kandıra
10: Kartepe
11: Başiskele
"""

# İlçe isimleri ve indeksleri
DISTRICTS = [
    "İzmit",      # 0 - Merkez (Umuttepe burada)
    "Gebze",      # 1
    "Darıca",     # 2
    "Çayırova",   # 3
    "Dilovası",   # 4
    "Körfez",     # 5
    "Derince",    # 6
    "Gölcük",     # 7
    "Karamürsel", # 8
    "Kandıra",    # 9
    "Kartepe",    # 10
    "Başiskele",  # 11
]

# İlçe koordinatları (merkez noktaları)
DISTRICT_COORDS = {
    "İzmit": (40.7654, 29.9408),
    "Gebze": (40.8027, 29.4307),
    "Darıca": (40.7694, 29.3753),
    "Çayırova": (40.8261, 29.3711),
    "Dilovası": (40.7847, 29.5375),
    "Körfez": (40.7539, 29.7644),
    "Derince": (40.7553, 29.8147),
    "Gölcük": (40.7167, 29.8333),
    "Karamürsel": (40.6917, 29.6167),
    "Kandıra": (41.0694, 30.1528),
    "Kartepe": (40.7500, 30.0333),
    "Başiskele": (40.7167, 29.9167),
}

# Umuttepe (KOÜ) koordinatları - Tüm araçların son durağı
DEPOT_COORDS = (40.8225, 29.9250)  # Kocaeli Üniversitesi Umuttepe Kampüsü
DEPOT_NAME = "Umuttepe (KOÜ)"

# Mesafe Matrisi (km) - Google Maps'ten alınan değerler
# Her satır bir ilçeden diğer tüm ilçelere olan mesafeyi gösterir
# DISTANCE_MATRIX[i][j] = i ilçesinden j ilçesine mesafe
DISTANCE_MATRIX = [
    #    İzmit  Gebze Darıca Çayır Dilov Körfez Derin Gölcük Karam Kandı Karte Başis
    [      0,    45,    52,    50,    35,    18,    12,    20,    38,    45,    12,     8],  # İzmit
    [     45,     0,     8,     6,    15,    28,    35,    55,    65,    90,    55,    50],  # Gebze
    [     52,     8,     0,     4,    18,    32,    40,    60,    68,    95,    60,    55],  # Darıca
    [     50,     6,     4,     0,    16,    30,    38,    58,    66,    93,    58,    53],  # Çayırova
    [     35,    15,    18,    16,     0,    18,    25,    45,    52,    80,    45,    40],  # Dilovası
    [     18,    28,    32,    30,    18,     0,     8,    22,    30,    60,    28,    22],  # Körfez
    [     12,    35,    40,    38,    25,     8,     0,    18,    35,    55,    22,    15],  # Derince
    [     20,    55,    60,    58,    45,    22,    18,     0,    20,    65,    32,    25],  # Gölcük
    [     38,    65,    68,    66,    52,    30,    35,    20,     0,    80,    50,    42],  # Karamürsel
    [     45,    90,    95,    93,    80,    60,    55,    65,    80,     0,    35,    40],  # Kandıra
    [     12,    55,    60,    58,    45,    28,    22,    32,    50,    35,     0,    10],  # Kartepe
    [      8,    50,    55,    53,    40,    22,    15,    25,    42,    40,    10,     0],  # Başiskele
]

# Umuttepe'den her ilçeye mesafe (km)
DEPOT_DISTANCES = {
    "İzmit": 5,
    "Gebze": 48,
    "Darıca": 55,
    "Çayırova": 53,
    "Dilovası": 38,
    "Körfez": 20,
    "Derince": 14,
    "Gölcük": 22,
    "Karamürsel": 40,
    "Kandıra": 42,
    "Kartepe": 8,
    "Başiskele": 6,
}


def get_distance(from_district: str, to_district: str) -> float:
    """İki ilçe arasındaki mesafeyi döndürür."""
    if from_district == DEPOT_NAME:
        return DEPOT_DISTANCES.get(to_district, 0)
    if to_district == DEPOT_NAME:
        return DEPOT_DISTANCES.get(from_district, 0)
    
    try:
        i = DISTRICTS.index(from_district)
        j = DISTRICTS.index(to_district)
        return DISTANCE_MATRIX[i][j]
    except (ValueError, IndexError):
        return 0


def get_district_index(name: str) -> int:
    """İlçe adından indeks döndürür."""
    try:
        return DISTRICTS.index(name)
    except ValueError:
        return -1


def get_all_distances_from_depot() -> dict:
    """Umuttepe'den tüm ilçelere mesafeleri döndürür."""
    return DEPOT_DISTANCES.copy()
