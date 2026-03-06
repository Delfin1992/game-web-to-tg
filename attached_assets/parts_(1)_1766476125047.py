from typing import Dict, List
import json
from jobs import CITIES

# Уровни редкости и их множители цены
RARITY_LEVELS = {
    "Common": {"multiplier": 1.0, "icon": "⚪"},
    "Rare": {"multiplier": 2.0, "icon": "🔵"},
    "Epic": {"multiplier": 4.0, "icon": "🟣"},
    "Legendary": {"multiplier": 8.0, "icon": "🟡"}
}

# Типы устройств
DEVICE_TYPES = {
    "asic": "ASIC майнер",
    "smartphone": "Смартфон",
    "smartwatch": "Смарт часы",
    "tablet": "Планшет",
    "laptop": "Ноутбук"
}

# Базовые характеристики для типов запчастей
PART_STATS = {
    "processor": {"coding": 0.2, "analytics": 0.1},
    "memory": {"coding": 0.1, "analytics": 0.2},
    "display": {"design": 0.2, "attention": 0.1},
    "battery": {"attention": 0.1},
    "motherboard": {"coding": 0.1, "testing": 0.1},
    "case": {"design": 0.1},
    "cooling": {"attention": 0.2},
    "controller": {"coding": 0.1, "testing": 0.1},
    "asic_chip": {"coding": 0.3, "analytics": 0.2}
}

# Все запчасти с их вариациями
ALL_PARTS = {
    # ASIC майнер - Базовая серия
    "A001": {
        "name": "Базовый ASIC чип A1",
        "type": "asic_chip",
        "rarity": "Common",
        "base_price": 100,
        "stats": {"coding": 0.3, "analytics": 0.4},
        "compatible_with": ["asic"],
        "description": "Простой ASIC чип начального уровня",
        "drop_chance": 20.0  # 20% шанс
    },
    "A002": {
        "name": "Базовый ASIC чип A1+",
        "type": "asic_chip",
        "rarity": "Rare",
        "base_price": 150,
        "stats": {"coding": 0.8, "analytics": 0.9},
        "compatible_with": ["asic"],
        "description": "Улучшенная версия базового чипа",
        "drop_chance": 10.0  # 10% шанс
    },
    "A003": {
        "name": "Базовый ASIC чип A1 Pro",
        "type": "asic_chip",
        "rarity": "Epic",
        "base_price": 200,
        "stats": {"coding": 1.1, "analytics": 1.8},
        "compatible_with": ["asic"],
        "description": "Профессиональная версия базового чипа",
        "drop_chance": 5.0  # 5% шанс
    },
    "A004": {
        "name": "Базовый ASIC чип A1 Max",
        "type": "asic_chip",
        "rarity": "Legendary",
        "base_price": 250,
        "stats": {"coding": 1.7, "analytics": 2.1},
        "compatible_with": ["asic"],
        "description": "Максимальная версия базового чипа",
        "drop_chance": 1.0  # 1% шанс
    },
    
    # ASIC майнер - Продвинутая серия
    "A005": {
        "name": "Продвинутый ASIC чип A2",
        "type": "asic_chip",
        "rarity": "Common",
        "base_price": 250,
        "stats": {"coding": 1.2, "analytics": 1.4},
        "compatible_with": ["asic"],
        "description": "Продвинутый ASIC чип второго поколения",
        "drop_chance": 15.0  # 15% шанс
    },
    "A006": {
        "name": "Продвинутый ASIC чип A2+",
        "type": "asic_chip",
        "rarity": "Rare",
        "base_price": 350,
        "stats": {"coding": 1.8, "analytics": 1.9},
        "compatible_with": ["asic"],
        "description": "Улучшенная версия продвинутого чипа",
        "drop_chance": 8.0  # 8% шанс
    },
    "A007": {
        "name": "Продвинутый ASIC чип A2 Pro",
        "type": "asic_chip",
        "rarity": "Epic",
        "base_price": 450,
        "stats": {"coding": 1.6, "analytics": 2.2},
        "compatible_with": ["asic"],
        "description": "Профессиональная версия продвинутого чипа",
        "drop_chance": 4.0  # 4% шанс
    },
    "A008": {
        "name": "Продвинутый ASIC чип A2 Max",
        "type": "asic_chip",
        "rarity": "Legendary",
        "base_price": 550,
        "stats": {"coding": 2.2, "analytics": 2.4},
        "compatible_with": ["asic"],
        "description": "Максимальная версия продвинутого чипа",
        "drop_chance": 0.8  # 0.8% шанс
    },
    
    # ASIC майнер - Профессиональная серия
    "A009": {
        "name": "Профессиональный ASIC чип A3",
        "type": "asic_chip",
        "rarity": "Common",
        "base_price": 550,
        "stats": {"coding": 2.6, "analytics": 2.9},
        "compatible_with": ["asic"],
        "description": "Профессиональный ASIC чип третьего поколения",
        "drop_chance": 10.0  # 10% шанс
    },
    "A010": {
        "name": "Профессиональный ASIC чип A3+",
        "type": "asic_chip",
        "rarity": "Rare",
        "base_price": 650,
        "stats": {"coding": 3.2, "analytics": 3.4},
        "compatible_with": ["asic"],
        "description": "Улучшенная версия профессионального чипа",
        "drop_chance": 6.0  # 6% шанс
    },
    "A011": {
        "name": "Профессиональный ASIC чип A3 Pro",
        "type": "asic_chip",
        "rarity": "Epic",
        "base_price": 750,
        "stats": {"coding": 3.6, "analytics": 3.8},
        "compatible_with": ["asic"],
        "description": "Продвинутая версия профессионального чипа",
        "drop_chance": 3.0  # 3% шанс
    },
    "A012": {
        "name": "Профессиональный ASIC чип A3 Max",
        "type": "asic_chip",
        "rarity": "Legendary",
        "base_price": 850,
        "stats": {"coding": 4.1, "analytics": 4.3},
        "compatible_with": ["asic"],
        "description": "Максимальная версия профессионального чипа",
        "drop_chance": 0.6  # 0.6% шанс
    },
    
    # ASIC майнер - Экспертная серия
    "A013": {
        "name": "Экспертный ASIC чип A4",
        "type": "asic_chip",
        "rarity": "Common",
        "base_price": 900,
        "stats": {"coding": 4.3, "analytics": 4.6},
        "compatible_with": ["asic"],
        "description": "Экспертный ASIC чип четвертого поколения",
        "drop_chance": 5.0  # 5% шанс
    },
    "A014": {
        "name": "Экспертный ASIC чип A4+",
        "type": "asic_chip",
        "rarity": "Rare",
        "base_price": 1000,
        "stats": {"coding": 4.7, "analytics": 4.9},
        "compatible_with": ["asic"],
        "description": "Улучшенная версия экспертного чипа",
        "drop_chance": 3.0  # 3% шанс
    },
    "A015": {
        "name": "Экспертный ASIC чип A4 Pro",
        "type": "asic_chip",
        "rarity": "Epic",
        "base_price": 1200,
        "stats": {"coding": 5.0, "analytics": 5.2},
        "compatible_with": ["asic"],
        "description": "Продвинутая версия экспертного чипа",
        "drop_chance": 1.0  # 1% шанс
    },
    "A016": {
        "name": "Экспертный ASIC чип A4 Max",
        "type": "asic_chip",
        "rarity": "Legendary",
        "base_price": 1400,
        "stats": {"coding": 5.3, "analytics": 5.6},
        "compatible_with": ["asic"],
        "description": "Максимальная версия экспертного чипа",
        "drop_chance": 0.2  # 0.2% шанс
    },
    
    # ASIC майнер - система охлаждения
    "A017": {
        "name": "Базовая система охлаждения C1",
        "type": "cooling",
        "rarity": "Common",
        "base_price": 150,
        "stats": {"attention": 0.3},
        "compatibility": ["asic"],
        "description": "Базовая система охлаждения для ASIC майнера",
        "drop_chance": 20.0
    },
    "A018": {
        "name": "Базовая система охлаждения C1+",
        "type": "cooling",
        "rarity": "Rare",
        "base_price": 250,
        "stats": {"attention": 0.6},
        "compatibility": ["asic"],
        "description": "Улучшенная система охлаждения для ASIC майнера",
        "drop_chance": 10.0
    },
    "A019": {
        "name": "Базовая система охлаждения C1 Pro",
        "type": "cooling",
        "rarity": "Epic",
        "base_price": 350,
        "stats": {"attention": 0.9},
        "compatibility": ["asic"],
        "description": "Продвинутая система охлаждения для ASIC майнера",
        "drop_chance": 5.0
    },
    "A020": {
        "name": "Базовая система охлаждения C1 Max",
        "type": "cooling",
        "rarity": "Legendary",
        "base_price": 450,
        "stats": {"attention": 1.2},
        "compatibility": ["asic"],
        "description": "Максимально эффективная система охлаждения для ASIC майнера",
        "drop_chance": 1.0
    },

    # ASIC майнер - блок питания
    "A021": {
        "name": "Блок питания P1",
        "type": "power",
        "rarity": "Common",
        "base_price": 200,
        "stats": {"attention": 0.4},
        "compatibility": ["asic"],
        "description": "Базовый блок питания для ASIC майнера",
        "drop_chance": 20.0
    },
    "A022": {
        "name": "Блок питания P1+",
        "type": "power",
        "rarity": "Rare",
        "base_price": 300,
        "stats": {"attention": 0.8},
        "compatibility": ["asic"],
        "description": "Улучшенный блок питания для ASIC майнера",
        "drop_chance": 10.0
    },
    "A023": {
        "name": "Блок питания P1 Pro",
        "type": "power",
        "rarity": "Epic",
        "base_price": 400,
        "stats": {"attention": 1.2},
        "compatibility": ["asic"],
        "description": "Продвинутый блок питания для ASIC майнера",
        "drop_chance": 5.0
    },
    "A024": {
        "name": "Блок питания P1 Max",
        "type": "power",
        "rarity": "Legendary",
        "base_price": 500,
        "stats": {"attention": 1.6},
        "compatibility": ["asic"],
        "description": "Максимально мощный блок питания для ASIC майнера",
        "drop_chance": 1.0
    },

    # ASIC майнер - контроллер управления
    "A025": {
        "name": "Контроллер управления U1",
        "type": "controller",
        "rarity": "Common",
        "base_price": 180,
        "stats": {"coding": 0.3, "analytics": 0.2},
        "compatibility": ["asic"],
        "description": "Базовый контроллер управления для ASIC майнера",
        "drop_chance": 20.0
    },
    "A026": {
        "name": "Контроллер управления U1+",
        "type": "controller",
        "rarity": "Rare",
        "base_price": 280,
        "stats": {"coding": 0.6, "analytics": 0.4},
        "compatibility": ["asic"],
        "description": "Улучшенный контроллер управления для ASIC майнера",
        "drop_chance": 10.0
    },
    "A027": {
        "name": "Контроллер управления U1 Pro",
        "type": "controller",
        "rarity": "Epic",
        "base_price": 380,
        "stats": {"coding": 0.9, "analytics": 0.6},
        "compatibility": ["asic"],
        "description": "Продвинутый контроллер управления для ASIC майнера",
        "drop_chance": 5.0
    },
    "A028": {
        "name": "Контроллер управления U1 Max",
        "type": "controller",
        "rarity": "Legendary",
        "base_price": 480,
        "stats": {"coding": 1.2, "analytics": 0.8},
        "compatibility": ["asic"],
        "description": "Максимально эффективный контроллер управления для ASIC майнера",
        "drop_chance": 1.0
    },

    # ASIC майнер - материнская плата
    "A029": {
        "name": "Плата управления M1",
        "type": "motherboard",
        "rarity": "Common",
        "base_price": 250,
        "stats": {"coding": 0.3, "testing": 0.3},
        "compatible_with": ["asic"],
        "description": "Базовая плата управления для ASIC майнера",
        "drop_chance": 20.0
    },
    "A030": {
        "name": "Плата управления M1+",
        "type": "motherboard",
        "rarity": "Rare",
        "base_price": 350,
        "stats": {"coding": 0.6, "testing": 0.6},
        "compatible_with": ["asic"],
        "description": "Улучшенная плата управления для ASIC майнера",
        "drop_chance": 10.0
    },
    "A031": {
        "name": "Плата управления M1 Pro",
        "type": "motherboard",
        "rarity": "Epic",
        "base_price": 450,
        "stats": {"coding": 0.9, "testing": 0.9},
        "compatible_with": ["asic"],
        "description": "Продвинутая плата управления для ASIC майнера",
        "drop_chance": 5.0
    },
    "A032": {
        "name": "Плата управления M1 Max",
        "type": "motherboard",
        "rarity": "Legendary",
        "base_price": 550,
        "stats": {"coding": 1.2, "testing": 1.2},
        "compatible_with": ["asic"],
        "description": "Максимально эффективная плата управления для ASIC майнера",
        "drop_chance": 1.0
    },

    # ASIC майнер - корпус
    "A033": {
        "name": "Корпус H1",
        "type": "case",
        "rarity": "Common",
        "base_price": 120,
        "stats": {"design": 0.2},
        "compatible_with": ["asic"],
        "description": "Базовый корпус для ASIC майнера",
        "drop_chance": 20.0
    },
    "A034": {
        "name": "Корпус H1+",
        "type": "case",
        "rarity": "Rare",
        "base_price": 180,
        "stats": {"design": 0.4},
        "compatible_with": ["asic"],
        "description": "Улучшенный корпус для ASIC майнера",
        "drop_chance": 10.0
    },
    "A035": {
        "name": "Корпус H1 Pro",
        "type": "case",
        "rarity": "Epic",
        "base_price": 240,
        "stats": {"design": 0.6},
        "compatible_with": ["asic"],
        "description": "Продвинутый корпус для ASIC майнера",
        "drop_chance": 5.0
    },
    "A036": {
        "name": "Корпус H1 Max",
        "type": "case",
        "rarity": "Legendary",
        "base_price": 300,
        "stats": {"design": 0.8},
        "compatible_with": ["asic"],
        "description": "Максимально эффективный корпус для ASIC майнера",
        "drop_chance": 1.0
    },

    # Смартфон - Процессоры
    "S001": {
        "name": "Базовый процессор S1",
        "type": "processor",
        "rarity": "Common",
        "base_price": 100,
        "stats": {"coding": 0.3, "analytics": 0.2},
        "compatible_with": ["smartphone"],
        "description": "Базовый процессор первого поколения",
        "drop_chance": 20.0
    },
    "S002": {
        "name": "Базовый процессор S1+",
        "type": "processor",
        "rarity": "Rare",
        "base_price": 150,
        "stats": {"coding": 0.6, "analytics": 0.4},
        "compatible_with": ["smartphone"],
        "description": "Улучшенная версия базового процессора",
        "drop_chance": 10.0
    },
    "S003": {
        "name": "Базовый процессор S1 Pro",
        "type": "processor",
        "rarity": "Epic",
        "base_price": 200,
        "stats": {"coding": 0.9, "analytics": 0.6},
        "compatible_with": ["smartphone"],
        "description": "Профессиональная версия базового процессора",
        "drop_chance": 5.0
    },
    "S004": {
        "name": "Базовый процессор S1 Max",
        "type": "processor",
        "rarity": "Legendary",
        "base_price": 250,
        "stats": {"coding": 1.2, "analytics": 0.8},
        "compatible_with": ["smartphone"],
        "description": "Максимальная версия базового процессора",
        "drop_chance": 1.0
    },

    "S005": {
        "name": "Продвинутый процессор S2",
        "type": "processor",
        "rarity": "Common",
        "base_price": 250,
        "stats": {"coding": 0.8, "analytics": 0.6},
        "compatible_with": ["smartphone"],
        "description": "Продвинутый процессор второго поколения",
        "drop_chance": 15.0
    },
    "S006": {
        "name": "Продвинутый процессор S2+",
        "type": "processor",
        "rarity": "Rare",
        "base_price": 350,
        "stats": {"coding": 1.2, "analytics": 0.9},
        "compatible_with": ["smartphone"],
        "description": "Улучшенная версия продвинутого процессора",
        "drop_chance": 8.0
    },
    "S007": {
        "name": "Продвинутый процессор S2 Pro",
        "type": "processor",
        "rarity": "Epic",
        "base_price": 450,
        "stats": {"coding": 1.6, "analytics": 1.2},
        "compatible_with": ["smartphone"],
        "description": "Профессиональная версия продвинутого процессора",
        "drop_chance": 4.0
    },
    "S008": {
        "name": "Продвинутый процессор S2 Max",
        "type": "processor",
        "rarity": "Legendary",
        "base_price": 550,
        "stats": {"coding": 2.0, "analytics": 1.5},
        "compatible_with": ["smartphone"],
        "description": "Максимальная версия продвинутого процессора",
        "drop_chance": 0.8
    },

    "S009": {
        "name": "Профессиональный процессор S3",
        "type": "processor",
        "rarity": "Common",
        "base_price": 550,
        "stats": {"coding": 1.5, "analytics": 1.2},
        "compatible_with": ["smartphone"],
        "description": "Профессиональный процессор третьего поколения",
        "drop_chance": 10.0
    },
    "S010": {
        "name": "Профессиональный процессор S3+",
        "type": "processor",
        "rarity": "Rare",
        "base_price": 650,
        "stats": {"coding": 2.0, "analytics": 1.6},
        "compatible_with": ["smartphone"],
        "description": "Улучшенная версия профессионального процессора",
        "drop_chance": 6.0
    },
    "S011": {
        "name": "Профессиональный процессор S3 Pro",
        "type": "processor",
        "rarity": "Epic",
        "base_price": 750,
        "stats": {"coding": 2.5, "analytics": 2.0},
        "compatible_with": ["smartphone"],
        "description": "Продвинутая версия профессионального процессора",
        "drop_chance": 3.0
    },
    "S012": {
        "name": "Профессиональный процессор S3 Max",
        "type": "processor",
        "rarity": "Legendary",
        "base_price": 850,
        "stats": {"coding": 3.0, "analytics": 2.4},
        "compatible_with": ["smartphone"],
        "description": "Максимальная версия профессионального процессора",
        "drop_chance": 0.6
    },

    "S013": {
        "name": "Экспертный процессор S4",
        "type": "processor",
        "rarity": "Common",
        "base_price": 900,
        "stats": {"coding": 2.4, "analytics": 2.0},
        "compatible_with": ["smartphone"],
        "description": "Экспертный процессор четвертого поколения",
        "drop_chance": 5.0
    },
    "S014": {
        "name": "Экспертный процессор S4+",
        "type": "processor",
        "rarity": "Rare",
        "base_price": 1000,
        "stats": {"coding": 3.0, "analytics": 2.5},
        "compatible_with": ["smartphone"],
        "description": "Улучшенная версия экспертного процессора",
        "drop_chance": 3.0
    },
    "S015": {
        "name": "Экспертный процессор S4 Pro",
        "type": "processor",
        "rarity": "Epic",
        "base_price": 1200,
        "stats": {"coding": 3.6, "analytics": 3.0},
        "compatible_with": ["smartphone"],
        "description": "Продвинутая версия экспертного процессора",
        "drop_chance": 1.0
    },
    "S016": {
        "name": "Экспертный процессор S4 Max",
        "type": "processor",
        "rarity": "Legendary",
        "base_price": 1400,
        "stats": {"coding": 4.2, "analytics": 3.5},
        "compatible_with": ["smartphone"],
        "description": "Максимальная версия экспертного процессора",
        "drop_chance": 0.2
    },

    # Смартфон - Оперативная память
    "S017": {
        "name": "Базовая RAM M1",
        "type": "memory",
        "rarity": "Common",
        "base_price": 80,
        "stats": {"coding": 0.2, "analytics": 0.3},
        "compatible_with": ["smartphone"],
        "description": "Базовая оперативная память первого поколения",
        "drop_chance": 20.0
    },
    "S018": {
        "name": "Базовая RAM M1+",
        "type": "memory",
        "rarity": "Rare",
        "base_price": 120,
        "stats": {"coding": 0.4, "analytics": 0.6},
        "compatible_with": ["smartphone"],
        "description": "Улучшенная версия базовой памяти",
        "drop_chance": 10.0
    },
    "S019": {
        "name": "Базовая RAM M1 Pro",
        "type": "memory",
        "rarity": "Epic",
        "base_price": 160,
        "stats": {"coding": 0.6, "analytics": 0.9},
        "compatible_with": ["smartphone"],
        "description": "Профессиональная версия базовой памяти",
        "drop_chance": 5.0
    },
    "S020": {
        "name": "Базовая RAM M1 Max",
        "type": "memory",
        "rarity": "Legendary",
        "base_price": 200,
        "stats": {"coding": 0.8, "analytics": 1.2},
        "compatible_with": ["smartphone"],
        "description": "Максимальная версия базовой памяти",
        "drop_chance": 1.0
    },

    "S021": {
        "name": "Продвинутая RAM M2",
        "type": "memory",
        "rarity": "Common",
        "base_price": 200,
        "stats": {"coding": 0.6, "analytics": 0.8},
        "compatible_with": ["smartphone"],
        "description": "Продвинутая оперативная память второго поколения",
        "drop_chance": 15.0
    },
    "S022": {
        "name": "Продвинутая RAM M2+",
        "type": "memory",
        "rarity": "Rare",
        "base_price": 300,
        "stats": {"coding": 0.9, "analytics": 1.2},
        "compatible_with": ["smartphone"],
        "description": "Улучшенная версия продвинутой памяти",
        "drop_chance": 8.0
    },
    "S023": {
        "name": "Продвинутая RAM M2 Pro",
        "type": "memory",
        "rarity": "Epic",
        "base_price": 400,
        "stats": {"coding": 1.2, "analytics": 1.6},
        "compatible_with": ["smartphone"],
        "description": "Профессиональная версия продвинутой памяти",
        "drop_chance": 4.0
    },
    "S024": {
        "name": "Продвинутая RAM M2 Max",
        "type": "memory",
        "rarity": "Legendary",
        "base_price": 500,
        "stats": {"coding": 1.5, "analytics": 2.0},
        "compatible_with": ["smartphone"],
        "description": "Максимальная версия продвинутой памяти",
        "drop_chance": 0.8
    },

    # Смартфон - Дисплеи
    "S025": {
        "name": "Базовый дисплей D1",
        "type": "display",
        "rarity": "Common",
        "base_price": 150,
        "stats": {"design": 0.3, "attention": 0.2},
        "compatible_with": ["smartphone"],
        "description": "Базовый LCD дисплей первого поколения",
        "drop_chance": 20.0
    },
    "S026": {
        "name": "Базовый дисплей D1+",
        "type": "display",
        "rarity": "Rare",
        "base_price": 250,
        "stats": {"design": 0.6, "attention": 0.4},
        "compatible_with": ["smartphone"],
        "description": "Улучшенный LCD дисплей",
        "drop_chance": 10.0
    },
    "S027": {
        "name": "Базовый дисплей D1 Pro",
        "type": "display",
        "rarity": "Epic",
        "base_price": 350,
        "stats": {"design": 0.9, "attention": 0.6},
        "compatible_with": ["smartphone"],
        "description": "Профессиональный LCD дисплей",
        "drop_chance": 5.0
    },
    "S028": {
        "name": "Базовый дисплей D1 Max",
        "type": "display",
        "rarity": "Legendary",
        "base_price": 450,
        "stats": {"design": 1.2, "attention": 0.8},
        "compatible_with": ["smartphone"],
        "description": "Максимальная версия LCD дисплея",
        "drop_chance": 1.0
    },

    "S029": {
        "name": "OLED дисплей D2",
        "type": "display",
        "rarity": "Common",
        "base_price": 400,
        "stats": {"design": 0.8, "attention": 0.6},
        "compatible_with": ["smartphone"],
        "description": "OLED дисплей второго поколения",
        "drop_chance": 15.0
    },
    "S030": {
        "name": "OLED дисплей D2+",
        "type": "display",
        "rarity": "Rare",
        "base_price": 600,
        "stats": {"design": 1.2, "attention": 0.9},
        "compatible_with": ["smartphone"],
        "description": "Улучшенный OLED дисплей",
        "drop_chance": 8.0
    },
    "S031": {
        "name": "OLED дисплей D2 Pro",
        "type": "display",
        "rarity": "Epic",
        "base_price": 800,
        "stats": {"design": 1.6, "attention": 1.2},
        "compatible_with": ["smartphone"],
        "description": "Профессиональный OLED дисплей",
        "drop_chance": 4.0
    },
    "S032": {
        "name": "OLED дисплей D2 Max",
        "type": "display",
        "rarity": "Legendary",
        "base_price": 1000,
        "stats": {"design": 2.0, "attention": 1.5},
        "compatible_with": ["smartphone"],
        "description": "Максимальная версия OLED дисплея",
        "drop_chance": 0.8
    },

    # Смарт часы
    "W001": {
        "name": "Базовый процессор часов W1",
        "type": "processor",
        "rarity": "Common",
        "base_price": 80,
        "stats": {"coding": 0.2, "analytics": 0.1},
        "compatible_with": ["smartwatch"],
        "description": "Базовый процессор часов первого поколения",
        "drop_chance": 20.0
    },
    "W002": {
        "name": "Базовый процессор часов W1+",
        "type": "processor",
        "rarity": "Rare",
        "base_price": 120,
        "stats": {"coding": 0.4, "analytics": 0.2},
        "compatible_with": ["smartwatch"],
        "description": "Улучшенная версия базового процессора",
        "drop_chance": 10.0
    },
    "W003": {
        "name": "Базовый процессор часов W1 Pro",
        "type": "processor",
        "rarity": "Epic",
        "base_price": 160,
        "stats": {"coding": 0.6, "analytics": 0.3},
        "compatible_with": ["smartwatch"],
        "description": "Профессиональная версия базового процессора",
        "drop_chance": 5.0
    },
    "W004": {
        "name": "Базовый процессор часов W1 Max",
        "type": "processor",
        "rarity": "Legendary",
        "base_price": 200,
        "stats": {"coding": 0.8, "analytics": 0.4},
        "compatible_with": ["smartwatch"],
        "description": "Максимальная версия базового процессора",
        "drop_chance": 1.0
    },

    "W005": {
        "name": "Продвинутый процессор часов W2",
        "type": "processor",
        "rarity": "Common",
        "base_price": 200,
        "stats": {"coding": 0.5, "analytics": 0.3},
        "compatible_with": ["smartwatch"],
        "description": "Продвинутый процессор часов второго поколения",
        "drop_chance": 15.0
    },
    "W006": {
        "name": "Продвинутый процессор часов W2+",
        "type": "processor",
        "rarity": "Rare",
        "base_price": 300,
        "stats": {"coding": 0.8, "analytics": 0.5},
        "compatible_with": ["smartwatch"],
        "description": "Улучшенная версия продвинутого процессора",
        "drop_chance": 8.0
    },
    "W007": {
        "name": "Продвинутый процессор часов W2 Pro",
        "type": "processor",
        "rarity": "Epic",
        "base_price": 400,
        "stats": {"coding": 1.1, "analytics": 0.7},
        "compatible_with": ["smartwatch"],
        "description": "Профессиональная версия продвинутого процессора",
        "drop_chance": 4.0
    },
    "W008": {
        "name": "Продвинутый процессор часов W2 Max",
        "type": "processor",
        "rarity": "Legendary",
        "base_price": 500,
        "stats": {"coding": 1.4, "analytics": 0.9},
        "compatible_with": ["smartwatch"],
        "description": "Максимальная версия продвинутого процессора",
        "drop_chance": 0.8
    },

    # Смарт часы - Дисплеи
    "W009": {
        "name": "Базовый дисплей часов D1",
        "type": "display",
        "rarity": "Common",
        "base_price": 100,
        "stats": {"design": 0.2, "attention": 0.1},
        "compatible_with": ["smartwatch"],
        "description": "Базовый дисплей часов первого поколения",
        "drop_chance": 20.0
    },
    "W010": {
        "name": "Базовый дисплей часов D1+",
        "type": "display",
        "rarity": "Rare",
        "base_price": 150,
        "stats": {"design": 0.4, "attention": 0.2},
        "compatible_with": ["smartwatch"],
        "description": "Улучшенная версия базового дисплея",
        "drop_chance": 10.0
    },
    "W011": {
        "name": "Базовый дисплей часов D1 Pro",
        "type": "display",
        "rarity": "Epic",
        "base_price": 200,
        "stats": {"design": 0.6, "attention": 0.3},
        "compatible_with": ["smartwatch"],
        "description": "Профессиональная версия базового дисплея",
        "drop_chance": 5.0
    },
    "W012": {
        "name": "Базовый дисплей часов D1 Max",
        "type": "display",
        "rarity": "Legendary",
        "base_price": 250,
        "stats": {"design": 0.8, "attention": 0.4},
        "compatible_with": ["smartwatch"],
        "description": "Максимальная версия базового дисплея",
        "drop_chance": 1.0
    },

    # Смарт часы - Батареи
    "W013": {
        "name": "Базовая батарея часов B1",
        "type": "battery",
        "rarity": "Common",
        "base_price": 60,
        "stats": {"attention": 0.2},
        "compatible_with": ["smartwatch"],
        "description": "Базовая батарея часов первого поколения",
        "drop_chance": 20.0
    },
    "W014": {
        "name": "Базовая батарея часов B1+",
        "type": "battery",
        "rarity": "Rare",
        "base_price": 90,
        "stats": {"attention": 0.4},
        "compatible_with": ["smartwatch"],
        "description": "Улучшенная версия базовой батареи",
        "drop_chance": 10.0
    },
    "W015": {
        "name": "Базовая батарея часов B1 Pro",
        "type": "battery",
        "rarity": "Epic",
        "base_price": 120,
        "stats": {"attention": 0.6},
        "compatible_with": ["smartwatch"],
        "description": "Профессиональная версия базовой батареи",
        "drop_chance": 5.0
    },
    "W016": {
        "name": "Базовая батарея часов B1 Max",
        "type": "battery",
        "rarity": "Legendary",
        "base_price": 150,
        "stats": {"attention": 0.8},
        "compatible_with": ["smartwatch"],
        "description": "Максимальная версия базовой батареи",
        "drop_chance": 1.0
    },

    # Планшет - Процессоры
    "T001": {
        "name": "Базовый процессор планшета T1",
        "type": "processor",
        "rarity": "Common",
        "base_price": 200,
        "stats": {"coding": 0.4, "analytics": 0.3},
        "compatible_with": ["tablet"],
        "description": "Базовый процессор планшета первого поколения",
        "drop_chance": 20.0
    },
    "T002": {
        "name": "Базовый процессор планшета T1+",
        "type": "processor",
        "rarity": "Rare",
        "base_price": 300,
        "stats": {"coding": 0.8, "analytics": 0.6},
        "compatible_with": ["tablet"],
        "description": "Улучшенная версия базового процессора",
        "drop_chance": 10.0
    },
    "T003": {
        "name": "Базовый процессор планшета T1 Pro",
        "type": "processor",
        "rarity": "Epic",
        "base_price": 400,
        "stats": {"coding": 1.2, "analytics": 0.9},
        "compatible_with": ["tablet"],
        "description": "Профессиональная версия базового процессора",
        "drop_chance": 5.0
    },
    "T004": {
        "name": "Базовый процессор планшета T1 Max",
        "type": "processor",
        "rarity": "Legendary",
        "base_price": 500,
        "stats": {"coding": 1.6, "analytics": 1.2},
        "compatible_with": ["tablet"],
        "description": "Максимальная версия базового процессора",
        "drop_chance": 1.0
    },

    "T005": {
        "name": "Продвинутый процессор планшета T2",
        "type": "processor",
        "rarity": "Common",
        "base_price": 500,
        "stats": {"coding": 1.0, "analytics": 0.8},
        "compatible_with": ["tablet"],
        "description": "Продвинутый процессор планшета второго поколения",
        "drop_chance": 15.0
    },
    "T006": {
        "name": "Продвинутый процессор планшета T2+",
        "type": "processor",
        "rarity": "Rare",
        "base_price": 700,
        "stats": {"coding": 1.5, "analytics": 1.2},
        "compatible_with": ["tablet"],
        "description": "Улучшенная версия продвинутого процессора",
        "drop_chance": 8.0
    },
    "T007": {
        "name": "Продвинутый процессор планшета T2 Pro",
        "type": "processor",
        "rarity": "Epic",
        "base_price": 900,
        "stats": {"coding": 2.0, "analytics": 1.6},
        "compatible_with": ["tablet"],
        "description": "Профессиональная версия продвинутого процессора",
        "drop_chance": 4.0
    },
    "T008": {
        "name": "Продвинутый процессор планшета T2 Max",
        "type": "processor",
        "rarity": "Legendary",
        "base_price": 1100,
        "stats": {"coding": 2.5, "analytics": 2.0},
        "compatible_with": ["tablet"],
        "description": "Максимальная версия продвинутого процессора",
        "drop_chance": 0.8
    },

    # Планшет - Оперативная память
    "T009": {
        "name": "Базовая RAM планшета M1",
        "type": "memory",
        "rarity": "Common",
        "base_price": 150,
        "stats": {"coding": 0.3, "analytics": 0.4},
        "compatible_with": ["tablet"],
        "description": "Базовая оперативная память первого поколения",
        "drop_chance": 20.0
    },
    "T010": {
        "name": "Базовая RAM планшета M1+",
        "type": "memory",
        "rarity": "Rare",
        "base_price": 250,
        "stats": {"coding": 0.6, "analytics": 0.8},
        "compatible_with": ["tablet"],
        "description": "Улучшенная версия базовой памяти",
        "drop_chance": 10.0
    },
    "T011": {
        "name": "Базовая RAM планшета M1 Pro",
        "type": "memory",
        "rarity": "Epic",
        "base_price": 350,
        "stats": {"coding": 0.9, "analytics": 1.2},
        "compatible_with": ["tablet"],
        "description": "Профессиональная версия базовой памяти",
        "drop_chance": 5.0
    },
    "T012": {
        "name": "Базовая RAM планшета M1 Max",
        "type": "memory",
        "rarity": "Legendary",
        "base_price": 450,
        "stats": {"coding": 1.2, "analytics": 1.6},
        "compatible_with": ["tablet"],
        "description": "Максимальная версия базовой памяти",
        "drop_chance": 1.0
    },

    # Планшет - Дисплеи
    "T013": {
        "name": "Базовый дисплей планшета D1",
        "type": "display",
        "rarity": "Common",
        "base_price": 200,
        "stats": {"design": 0.4, "attention": 0.3},
        "compatible_with": ["tablet"],
        "description": "Базовый LCD дисплей планшета первого поколения",
        "drop_chance": 20.0
    },
    "T014": {
        "name": "Базовый дисплей планшета D1+",
        "type": "display",
        "rarity": "Rare",
        "base_price": 300,
        "stats": {"design": 0.8, "attention": 0.6},
        "compatible_with": ["tablet"],
        "description": "Улучшенный LCD дисплей планшета",
        "drop_chance": 10.0
    },
    "T015": {
        "name": "Базовый дисплей планшета D1 Pro",
        "type": "display",
        "rarity": "Epic",
        "base_price": 400,
        "stats": {"design": 1.2, "attention": 0.9},
        "compatible_with": ["tablet"],
        "description": "Профессиональный LCD дисплей планшета",
        "drop_chance": 5.0
    },
    "T016": {
        "name": "Базовый дисплей планшета D1 Max",
        "type": "display",
        "rarity": "Legendary",
        "base_price": 500,
        "stats": {"design": 1.6, "attention": 1.2},
        "compatible_with": ["tablet"],
        "description": "Максимальная версия LCD дисплея планшета",
        "drop_chance": 1.0
    },

    # Ноутбук - Процессоры
    "L001": {
        "name": "Базовый процессор ноутбука L1",
        "type": "processor",
        "rarity": "Common",
        "base_price": 300,
        "stats": {"coding": 0.5, "analytics": 0.4},
        "compatible_with": ["laptop"],
        "description": "Базовый процессор ноутбука первого поколения",
        "drop_chance": 20.0
    },
    "L002": {
        "name": "Базовый процессор ноутбука L1+",
        "type": "processor",
        "rarity": "Rare",
        "base_price": 450,
        "stats": {"coding": 1.0, "analytics": 0.8},
        "compatible_with": ["laptop"],
        "description": "Улучшенная версия базового процессора",
        "drop_chance": 10.0
    },
    "L003": {
        "name": "Базовый процессор ноутбука L1 Pro",
        "type": "processor",
        "rarity": "Epic",
        "base_price": 600,
        "stats": {"coding": 1.5, "analytics": 1.2},
        "compatible_with": ["laptop"],
        "description": "Профессиональная версия базового процессора",
        "drop_chance": 5.0
    },
    "L004": {
        "name": "Базовый процессор ноутбука L1 Max",
        "type": "processor",
        "rarity": "Legendary",
        "base_price": 750,
        "stats": {"coding": 2.0, "analytics": 1.6},
        "compatible_with": ["laptop"],
        "description": "Максимальная версия базового процессора",
        "drop_chance": 1.0
    },

    "L005": {
        "name": "Продвинутый процессор ноутбука L2",
        "type": "processor",
        "rarity": "Common",
        "base_price": 750,
        "stats": {"coding": 1.2, "analytics": 1.0},
        "compatible_with": ["laptop"],
        "description": "Продвинутый процессор ноутбука второго поколения",
        "drop_chance": 15.0
    },
    "L006": {
        "name": "Продвинутый процессор ноутбука L2+",
        "type": "processor",
        "rarity": "Rare",
        "base_price": 1000,
        "stats": {"coding": 1.8, "analytics": 1.5},
        "compatible_with": ["laptop"],
        "description": "Улучшенная версия продвинутого процессора",
        "drop_chance": 8.0
    },
    "L007": {
        "name": "Продвинутый процессор ноутбука L2 Pro",
        "type": "processor",
        "rarity": "Epic",
        "base_price": 1250,
        "stats": {"coding": 2.4, "analytics": 2.0},
        "compatible_with": ["laptop"],
        "description": "Профессиональная версия продвинутого процессора",
        "drop_chance": 4.0
    },
    "L008": {
        "name": "Продвинутый процессор ноутбука L2 Max",
        "type": "processor",
        "rarity": "Legendary",
        "base_price": 1500,
        "stats": {"coding": 3.0, "analytics": 2.5},
        "compatible_with": ["laptop"],
        "description": "Максимальная версия продвинутого процессора",
        "drop_chance": 0.8
    },

    # Ноутбук - Оперативная память
    "L009": {
        "name": "Базовая RAM ноутбука M1",
        "type": "memory",
        "rarity": "Common",
        "base_price": 200,
        "stats": {"coding": 0.4, "analytics": 0.5},
        "compatible_with": ["laptop"],
        "description": "Базовая оперативная память первого поколения",
        "drop_chance": 20.0
    },
    "L010": {
        "name": "Базовая RAM ноутбука M1+",
        "type": "memory",
        "rarity": "Rare",
        "base_price": 300,
        "stats": {"coding": 0.8, "analytics": 1.0},
        "compatible_with": ["laptop"],
        "description": "Улучшенная версия базовой памяти",
        "drop_chance": 10.0
    },
    "L011": {
        "name": "Базовая RAM ноутбука M1 Pro",
        "type": "memory",
        "rarity": "Epic",
        "base_price": 400,
        "stats": {"coding": 1.2, "analytics": 1.5},
        "compatible_with": ["laptop"],
        "description": "Профессиональная версия базовой памяти",
        "drop_chance": 5.0
    },
    "L012": {
        "name": "Базовая RAM ноутбука M1 Max",
        "type": "memory",
        "rarity": "Legendary",
        "base_price": 500,
        "stats": {"coding": 1.6, "analytics": 2.0},
        "compatible_with": ["laptop"],
        "description": "Максимальная версия базовой памяти",
        "drop_chance": 1.0
    },

    # Ноутбук - SSD накопители
    "L013": {
        "name": "Базовый SSD S1",
        "type": "storage",
        "rarity": "Common",
        "base_price": 150,
        "stats": {"coding": 0.3, "attention": 0.2},
        "compatible_with": ["laptop"],
        "description": "Базовый SSD накопитель первого поколения",
        "drop_chance": 20.0
    },
    "L014": {
        "name": "Базовый SSD S1+",
        "type": "storage",
        "rarity": "Rare",
        "base_price": 250,
        "stats": {"coding": 0.6, "attention": 0.4},
        "compatible_with": ["laptop"],
        "description": "Улучшенная версия базового SSD",
        "drop_chance": 10.0
    },
    "L015": {
        "name": "Базовый SSD S1 Pro",
        "type": "storage",
        "rarity": "Epic",
        "base_price": 350,
        "stats": {"coding": 0.9, "attention": 0.6},
        "compatible_with": ["laptop"],
        "description": "Профессиональная версия базового SSD",
        "drop_chance": 5.0
    },
    "L016": {
        "name": "Базовый SSD S1 Max",
        "type": "storage",
        "rarity": "Legendary",
        "base_price": 450,
        "stats": {"coding": 1.2, "attention": 0.8},
        "compatible_with": ["laptop"],
        "description": "Максимальная версия базового SSD",
        "drop_chance": 1.0
    },

    # Ноутбук - Системы охлаждения
    "L017": {
        "name": "Базовая система охлаждения C1",
        "type": "cooling",
        "rarity": "Common",
        "base_price": 100,
        "stats": {"attention": 0.3},
        "compatible_with": ["laptop"],
        "description": "Базовая система охлаждения первого поколения",
        "drop_chance": 20.0
    },
    "L018": {
        "name": "Базовая система охлаждения C1+",
        "type": "cooling",
        "rarity": "Rare",
        "base_price": 200,
        "stats": {"attention": 0.6},
        "compatible_with": ["laptop"],
        "description": "Улучшенная версия базовой системы охлаждения",
        "drop_chance": 10.0
    },
    "L019": {
        "name": "Базовая система охлаждения C1 Pro",
        "type": "cooling",
        "rarity": "Epic",
        "base_price": 300,
        "stats": {"attention": 0.9},
        "compatible_with": ["laptop"],
        "description": "Профессиональная версия базовой системы охлаждения",
        "drop_chance": 5.0
    },
    "L020": {
        "name": "Базовая система охлаждения C1 Max",
        "type": "cooling",
        "rarity": "Legendary",
        "base_price": 400,
        "stats": {"attention": 1.2},
        "compatible_with": ["laptop"],
        "description": "Максимальная версия базовой системы охлаждения",
        "drop_chance": 1.0
    },

    # Смартфон - основная камера
    "S033": {
        "name": "Основная камера C1",
        "type": "camera",
        "rarity": "Common",
        "base_price": 200,
        "stats": {"design": 0.4},
        "compatibility": ["smartphone"],
        "description": "Базовая основная камера для смартфона",
        "drop_chance": 20.0
    },
    "S034": {
        "name": "Основная камера C1+",
        "type": "camera",
        "rarity": "Rare",
        "base_price": 300,
        "stats": {"design": 0.8},
        "compatibility": ["smartphone"],
        "description": "Улучшенная основная камера для смартфона",
        "drop_chance": 10.0
    },
    "S035": {
        "name": "Основная камера C1 Pro",
        "type": "camera",
        "rarity": "Epic",
        "base_price": 400,
        "stats": {"design": 1.2},
        "compatibility": ["smartphone"],
        "description": "Продвинутая основная камера для смартфона",
        "drop_chance": 5.0
    },
    "S036": {
        "name": "Основная камера C1 Max",
        "type": "camera",
        "rarity": "Legendary",
        "base_price": 500,
        "stats": {"design": 1.6},
        "compatibility": ["smartphone"],
        "description": "Максимально качественная основная камера для смартфона",
        "drop_chance": 1.0
    },

    # Смартфон - батарея
    "S037": {
        "name": "Батарея B1",
        "type": "battery",
        "rarity": "Common",
        "base_price": 150,
        "stats": {"attention": 0.3},
        "compatibility": ["smartphone"],
        "description": "Базовая батарея для смартфона",
        "drop_chance": 20.0
    },
    "S038": {
        "name": "Батарея B1+",
        "type": "battery",
        "rarity": "Rare",
        "base_price": 250,
        "stats": {"attention": 0.6},
        "compatibility": ["smartphone"],
        "description": "Улучшенная батарея для смартфона",
        "drop_chance": 10.0
    },
    "S039": {
        "name": "Батарея B1 Pro",
        "type": "battery",
        "rarity": "Epic",
        "base_price": 350,
        "stats": {"attention": 0.9},
        "compatibility": ["smartphone"],
        "description": "Продвинутая батарея для смартфона",
        "drop_chance": 5.0
    },
    "S040": {
        "name": "Батарея B1 Max",
        "type": "battery",
        "rarity": "Legendary",
        "base_price": 450,
        "stats": {"attention": 1.2},
        "compatibility": ["smartphone"],
        "description": "Максимально емкая батарея для смартфона",
        "drop_chance": 1.0
    },

    # Смартфон - материнская плата
    "S041": {
        "name": "Материнская плата M1",
        "type": "motherboard",
        "rarity": "Common",
        "base_price": 200,
        "stats": {"coding": 0.3, "testing": 0.3},
        "compatible_with": ["smartphone"],
        "description": "Базовая материнская плата для смартфона",
        "drop_chance": 20.0
    },
    "S042": {
        "name": "Материнская плата M1+",
        "type": "motherboard",
        "rarity": "Rare",
        "base_price": 300,
        "stats": {"coding": 0.6, "testing": 0.6},
        "compatible_with": ["smartphone"],
        "description": "Улучшенная материнская плата для смартфона",
        "drop_chance": 10.0
    },
    "S043": {
        "name": "Материнская плата M1 Pro",
        "type": "motherboard",
        "rarity": "Epic",
        "base_price": 400,
        "stats": {"coding": 0.9, "testing": 0.9},
        "compatible_with": ["smartphone"],
        "description": "Продвинутая материнская плата для смартфона",
        "drop_chance": 5.0
    },
    "S044": {
        "name": "Материнская плата M1 Max",
        "type": "motherboard",
        "rarity": "Legendary",
        "base_price": 500,
        "stats": {"coding": 1.2, "testing": 1.2},
        "compatible_with": ["smartphone"],
        "description": "Максимально производительная материнская плата для смартфона",
        "drop_chance": 1.0
    },

    # Смартфон - корпус
    "S045": {
        "name": "Корпус H1",
        "type": "case",
        "rarity": "Common",
        "base_price": 100,
        "stats": {"design": 0.3},
        "compatible_with": ["smartphone"],
        "description": "Базовый корпус для смартфона",
        "drop_chance": 20.0
    },
    "S046": {
        "name": "Корпус H1+",
        "type": "case",
        "rarity": "Rare",
        "base_price": 200,
        "stats": {"design": 0.6},
        "compatible_with": ["smartphone"],
        "description": "Улучшенный корпус для смартфона",
        "drop_chance": 10.0
    },
    "S047": {
        "name": "Корпус H1 Pro",
        "type": "case",
        "rarity": "Epic",
        "base_price": 300,
        "stats": {"design": 0.9},
        "compatible_with": ["smartphone"],
        "description": "Продвинутый корпус для смартфона",
        "drop_chance": 5.0
    },
    "S048": {
        "name": "Корпус H1 Max",
        "type": "case",
        "rarity": "Legendary",
        "base_price": 400,
        "stats": {"design": 1.2},
        "compatible_with": ["smartphone"],
        "description": "Максимально стильный корпус для смартфона",
        "drop_chance": 1.0
    },

    # Смарт часы - корпус
    "W017": {
        "name": "Корпус часов H1",
        "type": "case",
        "rarity": "Common",
        "base_price": 80,
        "stats": {"design": 0.2},
        "compatible_with": ["smartwatch"],
        "description": "Базовый корпус для смарт часов",
        "drop_chance": 20.0
    },
    "W018": {
        "name": "Корпус часов H1+",
        "type": "case",
        "rarity": "Rare",
        "base_price": 120,
        "stats": {"design": 0.4},
        "compatible_with": ["smartwatch"],
        "description": "Улучшенный корпус для смарт часов",
        "drop_chance": 10.0
    },
    "W019": {
        "name": "Корпус часов H1 Pro",
        "type": "case",
        "rarity": "Epic",
        "base_price": 160,
        "stats": {"design": 0.6},
        "compatible_with": ["smartwatch"],
        "description": "Продвинутый корпус для смарт часов",
        "drop_chance": 5.0
    },
    "W020": {
        "name": "Корпус часов H1 Max",
        "type": "case",
        "rarity": "Legendary",
        "base_price": 200,
        "stats": {"design": 0.8},
        "compatible_with": ["smartwatch"],
        "description": "Максимально стильный корпус для смарт часов",
        "drop_chance": 1.0
    },

    # Смарт часы - ремешок
    "W021": {
        "name": "Ремешок R1",
        "type": "strap",
        "rarity": "Common",
        "base_price": 40,
        "stats": {"design": 0.1},
        "compatible_with": ["smartwatch"],
        "description": "Базовый ремешок для смарт часов",
        "drop_chance": 20.0
    },
    "W022": {
        "name": "Ремешок R1+",
        "type": "strap",
        "rarity": "Rare",
        "base_price": 60,
        "stats": {"design": 0.2},
        "compatible_with": ["smartwatch"],
        "description": "Улучшенный ремешок для смарт часов",
        "drop_chance": 10.0
    },
    "W023": {
        "name": "Ремешок R1 Pro",
        "type": "strap",
        "rarity": "Epic",
        "base_price": 80,
        "stats": {"design": 0.3},
        "compatible_with": ["smartwatch"],
        "description": "Продвинутый ремешок для смарт часов",
        "drop_chance": 5.0
    },
    "W024": {
        "name": "Ремешок R1 Max",
        "type": "strap",
        "rarity": "Legendary",
        "base_price": 100,
        "stats": {"design": 0.4},
        "compatible_with": ["smartwatch"],
        "description": "Максимально стильный ремешок для смарт часов",
        "drop_chance": 1.0
    },

    # Планшет - флеш-память
    "T017": {
        "name": "Флеш-память F1",
        "type": "storage",
        "rarity": "Common",
        "base_price": 150,
        "stats": {"coding": 0.2, "attention": 0.2},
        "compatible_with": ["tablet"],
        "description": "Базовая флеш-память для планшета",
        "drop_chance": 20.0
    },
    "T018": {
        "name": "Флеш-память F1+",
        "type": "storage",
        "rarity": "Rare",
        "base_price": 250,
        "stats": {"coding": 0.4, "attention": 0.4},
        "compatible_with": ["tablet"],
        "description": "Улучшенная флеш-память для планшета",
        "drop_chance": 10.0
    },
    "T019": {
        "name": "Флеш-память F1 Pro",
        "type": "storage",
        "rarity": "Epic",
        "base_price": 350,
        "stats": {"coding": 0.6, "attention": 0.6},
        "compatible_with": ["tablet"],
        "description": "Продвинутая флеш-память для планшета",
        "drop_chance": 5.0
    },
    "T020": {
        "name": "Флеш-память F1 Max",
        "type": "storage",
        "rarity": "Legendary",
        "base_price": 450,
        "stats": {"coding": 0.8, "attention": 0.8},
        "compatible_with": ["tablet"],
        "description": "Максимально быстрая флеш-память для планшета",
        "drop_chance": 1.0
    },

    # Планшет - батарея увеличенной ёмкости
    "T021": {
        "name": "Батарея увеличенной ёмкости B2",
        "type": "battery",
        "rarity": "Common",
        "base_price": 200,
        "stats": {"attention": 0.4},
        "compatible_with": ["tablet"],
        "description": "Базовая батарея увеличенной ёмкости для планшета",
        "drop_chance": 20.0
    },
    "T022": {
        "name": "Батарея увеличенной ёмкости B2+",
        "type": "battery",
        "rarity": "Rare",
        "base_price": 300,
        "stats": {"attention": 0.8},
        "compatible_with": ["tablet"],
        "description": "Улучшенная батарея увеличенной ёмкости для планшета",
        "drop_chance": 10.0
    },
    "T023": {
        "name": "Батарея увеличенной ёмкости B2 Pro",
        "type": "battery",
        "rarity": "Epic",
        "base_price": 400,
        "stats": {"attention": 1.2},
        "compatible_with": ["tablet"],
        "description": "Продвинутая батарея увеличенной ёмкости для планшета",
        "drop_chance": 5.0
    },
    "T024": {
        "name": "Батарея увеличенной ёмкости B2 Max",
        "type": "battery",
        "rarity": "Legendary",
        "base_price": 500,
        "stats": {"attention": 1.6},
        "compatible_with": ["tablet"],
        "description": "Максимально ёмкая батарея для планшета",
        "drop_chance": 1.0
    },

    # Планшет - материнская плата
    "T025": {
        "name": "Материнская плата планшета M1",
        "type": "motherboard",
        "rarity": "Common",
        "base_price": 250,
        "stats": {"coding": 0.4, "testing": 0.4},
        "compatible_with": ["tablet"],
        "description": "Базовая материнская плата для планшета",
        "drop_chance": 20.0
    },
    "T026": {
        "name": "Материнская плата планшета M1+",
        "type": "motherboard",
        "rarity": "Rare",
        "base_price": 350,
        "stats": {"coding": 0.8, "testing": 0.8},
        "compatible_with": ["tablet"],
        "description": "Улучшенная материнская плата для планшета",
        "drop_chance": 10.0
    },
    "T027": {
        "name": "Материнская плата планшета M1 Pro",
        "type": "motherboard",
        "rarity": "Epic",
        "base_price": 450,
        "stats": {"coding": 1.2, "testing": 1.2},
        "compatible_with": ["tablet"],
        "description": "Продвинутая материнская плата для планшета",
        "drop_chance": 5.0
    },
    "T028": {
        "name": "Материнская плата планшета M1 Max",
        "type": "motherboard",
        "rarity": "Legendary",
        "base_price": 550,
        "stats": {"coding": 1.6, "testing": 1.6},
        "compatible_with": ["tablet"],
        "description": "Максимально производительная материнская плата для планшета",
        "drop_chance": 1.0
    },

    # Планшет - корпус
    "T029": {
        "name": "Корпус планшета H1",
        "type": "case",
        "rarity": "Common",
        "base_price": 150,
        "stats": {"design": 0.3},
        "compatible_with": ["tablet"],
        "description": "Базовый корпус для планшета",
        "drop_chance": 20.0
    },
    "T030": {
        "name": "Корпус планшета H1+",
        "type": "case",
        "rarity": "Rare",
        "base_price": 250,
        "stats": {"design": 0.6},
        "compatible_with": ["tablet"],
        "description": "Улучшенный корпус для планшета",
        "drop_chance": 10.0
    },
    "T031": {
        "name": "Корпус планшета H1 Pro",
        "type": "case",
        "rarity": "Epic",
        "base_price": 350,
        "stats": {"design": 0.9},
        "compatible_with": ["tablet"],
        "description": "Продвинутый корпус для планшета",
        "drop_chance": 5.0
    },
    "T032": {
        "name": "Корпус планшета H1 Max",
        "type": "case",
        "rarity": "Legendary",
        "base_price": 450,
        "stats": {"design": 1.2},
        "compatible_with": ["tablet"],
        "description": "Максимально стильный корпус для планшета",
        "drop_chance": 1.0
    },

    # Ноутбук - дисплей
    "L021": {
        "name": "Дисплей ноутбука D1",
        "type": "display",
        "rarity": "Common",
        "base_price": 300,
        "stats": {"design": 0.5, "attention": 0.4},
        "compatible_with": ["laptop"],
        "description": "Базовый дисплей для ноутбука",
        "drop_chance": 20.0
    },
    "L022": {
        "name": "Дисплей ноутбука D1+",
        "type": "display",
        "rarity": "Rare",
        "base_price": 450,
        "stats": {"design": 1.0, "attention": 0.8},
        "compatible_with": ["laptop"],
        "description": "Улучшенный дисплей для ноутбука",
        "drop_chance": 10.0
    },
    "L023": {
        "name": "Дисплей ноутбука D1 Pro",
        "type": "display",
        "rarity": "Epic",
        "base_price": 600,
        "stats": {"design": 1.5, "attention": 1.2},
        "compatible_with": ["laptop"],
        "description": "Продвинутый дисплей для ноутбука",
        "drop_chance": 5.0
    },
    "L024": {
        "name": "Дисплей ноутбука D1 Max",
        "type": "display",
        "rarity": "Legendary",
        "base_price": 750,
        "stats": {"design": 2.0, "attention": 1.6},
        "compatible_with": ["laptop"],
        "description": "Максимально качественный дисплей для ноутбука",
        "drop_chance": 1.0
    },

    # Ноутбук - материнская плата
    "L025": {
        "name": "Материнская плата ноутбука M1",
        "type": "motherboard",
        "rarity": "Common",
        "base_price": 400,
        "stats": {"coding": 0.5, "testing": 0.5},
        "compatible_with": ["laptop"],
        "description": "Базовая материнская плата для ноутбука",
        "drop_chance": 20.0
    },
    "L026": {
        "name": "Материнская плата ноутбука M1+",
        "type": "motherboard",
        "rarity": "Rare",
        "base_price": 600,
        "stats": {"coding": 1.0, "testing": 1.0},
        "compatible_with": ["laptop"],
        "description": "Улучшенная материнская плата для ноутбука",
        "drop_chance": 10.0
    },
    "L027": {
        "name": "Материнская плата ноутбука M1 Pro",
        "type": "motherboard",
        "rarity": "Epic",
        "base_price": 800,
        "stats": {"coding": 1.5, "testing": 1.5},
        "compatible_with": ["laptop"],
        "description": "Продвинутая материнская плата для ноутбука",
        "drop_chance": 5.0
    },
    "L028": {
        "name": "Материнская плата ноутбука M1 Max",
        "type": "motherboard",
        "rarity": "Legendary",
        "base_price": 1000,
        "stats": {"coding": 2.0, "testing": 2.0},
        "compatible_with": ["laptop"],
        "description": "Максимально производительная материнская плата для ноутбука",
        "drop_chance": 1.0
    },

    # Ноутбук - батарея
    "L029": {
        "name": "Батарея ноутбука B1",
        "type": "battery",
        "rarity": "Common",
        "base_price": 200,
        "stats": {"attention": 0.4},
        "compatible_with": ["laptop"],
        "description": "Базовая батарея для ноутбука",
        "drop_chance": 20.0
    },
    "L030": {
        "name": "Батарея ноутбука B1+",
        "type": "battery",
        "rarity": "Rare",
        "base_price": 300,
        "stats": {"attention": 0.8},
        "compatible_with": ["laptop"],
        "description": "Улучшенная батарея для ноутбука",
        "drop_chance": 10.0
    },
    "L031": {
        "name": "Батарея ноутбука B1 Pro",
        "type": "battery",
        "rarity": "Epic",
        "base_price": 400,
        "stats": {"attention": 1.2},
        "compatible_with": ["laptop"],
        "description": "Продвинутая батарея для ноутбука",
        "drop_chance": 5.0
    },
    "L032": {
        "name": "Батарея ноутбука B1 Max",
        "type": "battery",
        "rarity": "Legendary",
        "base_price": 500,
        "stats": {"attention": 1.6},
        "compatible_with": ["laptop"],
        "description": "Максимально ёмкая батарея для ноутбука",
        "drop_chance": 1.0
    },

    # Ноутбук - корпус
    "L033": {
        "name": "Корпус ноутбука H1",
        "type": "case",
        "rarity": "Common",
        "base_price": 250,
        "stats": {"design": 0.4},
        "compatible_with": ["laptop"],
        "description": "Базовый корпус для ноутбука",
        "drop_chance": 20.0
    },
    "L034": {
        "name": "Корпус ноутбука H1+",
        "type": "case",
        "rarity": "Rare",
        "base_price": 375,
        "stats": {"design": 0.8},
        "compatible_with": ["laptop"],
        "description": "Улучшенный корпус для ноутбука",
        "drop_chance": 10.0
    },
    "L035": {
        "name": "Корпус ноутбука H1 Pro",
        "type": "case",
        "rarity": "Epic",
        "base_price": 500,
        "stats": {"design": 1.2},
        "compatible_with": ["laptop"],
        "description": "Продвинутый корпус для ноутбука",
        "drop_chance": 5.0
    },
    "L036": {
        "name": "Корпус ноутбука H1 Max",
        "type": "case",
        "rarity": "Legendary",
        "base_price": 625,
        "stats": {"design": 1.6},
        "compatible_with": ["laptop"],
        "description": "Максимально стильный корпус для ноутбука",
        "drop_chance": 1.0
    }
}

def get_part_price(part_id: str, city: str) -> float:
    """Вычисляет цену детали с учетом города и редкости"""
    if part_id not in ALL_PARTS:
        return 0
    
    part = ALL_PARTS[part_id]
    base_price = part["base_price"]
    rarity_multiplier = RARITY_LEVELS[part["rarity"]]["multiplier"]
    city_rate = CITIES[city]["exchange_rate"]
    
    return base_price * rarity_multiplier * city_rate

def get_compatible_parts(device_type: str) -> List[Dict]:
    """Возвращает список совместимых запчастей для устройства"""
    return [
        {"id": part_id, **part_data}
        for part_id, part_data in ALL_PARTS.items()
        if device_type in part_data["compatible_with"]
    ]

def get_part_stats(part_id: str) -> Dict:
    """Возвращает характеристики запчасти с учетом редкости"""
    if part_id not in ALL_PARTS:
        return {}
    
    part = ALL_PARTS[part_id]
    rarity_multiplier = RARITY_LEVELS[part["rarity"]]["multiplier"]
    
    return {
        stat: value * rarity_multiplier
        for stat, value in part["stats"].items()
    } 