# Предметы первого уровня (базовые)
tier_1_items = {
    "Учебник по программированию": {
        "price": 100,
        "stats": {"coding": 1},
        "description": "Повышает навык кодинга на 1"
    },
    "Курс по тестированию": {
        "price": 100,
        "stats": {"testing": 1},
        "description": "Повышает навык тестирования на 1"
    },
    "Книга по аналитике": {
        "price": 100,
        "stats": {"analytics": 1},
        "description": "Повышает навык аналитики на 1"
    },
    "Альбом для рисования": {
        "price": 100,
        "stats": {"drawing": 1},
        "description": "Повышает навык рисования на 1"
    },
    'G1': {
        'name': 'ASIC майнер',
        'rarity': 'Обычный',
        'price': 1000,
        'stats': {
            'coding': 1,
            'design': 0,
            'testing': 0,
            'analytics': 0,
            'modeling': 0
        }
    },
    'G2': {
        'name': 'Смартфон',
        'rarity': 'Обычный',
        'price': 800,
        'stats': {
            'coding': 0,
            'design': 1,
            'testing': 0,
            'analytics': 0,
            'modeling': 0
        }
    },
    'G3': {
        'name': 'Смарт часы',
        'rarity': 'Обычный',
        'price': 600,
        'stats': {
            'coding': 0,
            'design': 0,
            'testing': 1,
            'analytics': 0,
            'modeling': 0
        }
    }
}

# Предметы второго уровня (продвинутые)
tier_2_items = {
    "Продвинутый курс программирования": {
        "price": 500,
        "stats": {"coding": 3},
        "description": "Повышает навык кодинга на 3"
    },
    "Профессиональный курс тестирования": {
        "price": 500,
        "stats": {"testing": 3},
        "description": "Повышает навык тестирования на 3"
    },
    "Мастер-класс по аналитике": {
        "price": 500,
        "stats": {"analytics": 3},
        "description": "Повышает навык аналитики на 3"
    },
    "Профессиональные материалы для рисования": {
        "price": 500,
        "stats": {"drawing": 3},
        "description": "Повышает навык рисования на 3"
    },
    'G4': {
        'name': 'Планшет',
        'rarity': 'Редкий',
        'price': 2000,
        'stats': {
            'coding': 2,
            'design': 2,
            'testing': 1,
            'analytics': 1,
            'modeling': 1
        }
    },
    'G5': {
        'name': 'Ноутбук',
        'rarity': 'Редкий',
        'price': 3000,
        'stats': {
            'coding': 3,
            'design': 2,
            'testing': 2,
            'analytics': 2,
            'modeling': 2
        }
    }
}

# Начальные гаджеты для каждого города
INITIAL_GADGETS = {
    "Сан-Франциско": {
        "S": {  # Смартфон
            "name": "iPhone 15 Pro",
            "rarity": "Legendary",
            "price": 1000,
            "stats": {
                "coding": 0.3,
                "design": 0.2,
                "analytics": 0.1
            }
        },
        "W": {  # Смарт часы
            "name": "Apple Watch Series 9",
            "rarity": "Epic",
            "price": 500,
            "stats": {
                "coding": 0.1,
                "design": 0.2,
                "testing": 0.1
            }
        },
        "T": {  # Планшет
            "name": "iPad Pro M2",
            "rarity": "Epic",
            "price": 800,
            "stats": {
                "coding": 0.2,
                "design": 0.3,
                "analytics": 0.2
            }
        },
        "L": {  # Ноутбук
            "name": "MacBook Pro M3",
            "rarity": "Legendary",
            "price": 2000,
            "stats": {
                "coding": 0.4,
                "design": 0.3,
                "analytics": 0.3
            }
        }
    },
    "Сингапур": {
        "S": {  # Смартфон
            "name": "Samsung Galaxy S24 Ultra",
            "rarity": "Legendary",
            "price": 1200,
            "stats": {
                "testing": 0.3,
                "analytics": 0.2,
                "coding": 0.1
            }
        },
        "W": {  # Смарт часы
            "name": "Samsung Galaxy Watch 6",
            "rarity": "Epic",
            "price": 400,
            "stats": {
                "testing": 0.1,
                "analytics": 0.2,
                "modeling": 0.1
            }
        },
        "T": {  # Планшет
            "name": "Samsung Galaxy Tab S9",
            "rarity": "Epic",
            "price": 900,
            "stats": {
                "testing": 0.2,
                "analytics": 0.3,
                "modeling": 0.2
            }
        },
        "L": {  # Ноутбук
            "name": "Samsung Galaxy Book 4",
            "rarity": "Legendary",
            "price": 1800,
            "stats": {
                "testing": 0.4,
                "analytics": 0.3,
                "modeling": 0.3
            }
        }
    },
    "Санкт-Петербург": {
        "S": {  # Смартфон
            "name": "Xiaomi 14 Pro",
            "rarity": "Legendary",
            "price": 800,
            "stats": {
                "design": 0.3,
                "modeling": 0.2,
                "coding": 0.1
            }
        },
        "W": {  # Смарт часы
            "name": "Xiaomi Watch 2",
            "rarity": "Epic",
            "price": 300,
            "stats": {
                "design": 0.1,
                "modeling": 0.2,
                "testing": 0.1
            }
        },
        "T": {  # Планшет
            "name": "Xiaomi Pad 7",
            "rarity": "Epic",
            "price": 600,
            "stats": {
                "design": 0.2,
                "modeling": 0.3,
                "testing": 0.2
            }
        },
        "L": {  # Ноутбук
            "name": "Xiaomi Book Pro 16",
            "rarity": "Legendary",
            "price": 1500,
            "stats": {
                "design": 0.4,
                "modeling": 0.3,
                "testing": 0.3
            }
        }
    }
} 