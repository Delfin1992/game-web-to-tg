from typing import Dict
from company import Company, COMPANY_LEVELS

# Чертежи гаджетов и требования для их разработки
GADGET_BLUEPRINTS = {
   "smartphones": {
       "Basic Phone": {
           "requirements": {"coding": 1000, "design": 5000},
           "time": 24,  # часы на разработку
           "description": "Базовая модель смартфона",
           "stats": {
               "coding": 1,
               "design": 1
           },
           "bonuses": {
               "work_fail_reduction": 2  # Уменьшает шанс провала на 2%
           },
           "production": {
               "cost_gram": 100,
               "parts": {
                   "processor": 1,
                   "display": 1,
                   "camera": 1,
                   "battery": 1,
                   "case": 1
               }
           }
       },
       "Smart Plus": {
           "requirements": {"coding": 150, "design": 75, "analytics": 50},
           "time": 48,
           "description": "Улучшенная версия с продвинутыми функциями",
           "stats": {
               "coding": 2,
               "design": 1,
               "analytics": 1
           },
           "bonuses": {
               "work_fail_reduction": 3,
               "rare_parts_chance": 5  # Увеличивает шанс получения редких деталей на 5%
           },
           "production": {
               "cost_gram": 200,
               "parts": {
                   "processor": 1,
                   "display": 1,
                   "camera": 2,
                   "battery": 1,
                   "case": 1
               }
           }
       },
       "Pro Model": {
           "requirements": {"coding": 200, "design": 100, "analytics": 75},
           "time": 72,
           "description": "Профессиональная модель",
           "stats": {
               "coding": 2,
               "design": 2,
               "analytics": 2
           },
           "bonuses": {
               "work_fail_reduction": 5,
               "rare_parts_chance": 7,
               "work_money_boost": 3  # Увеличивает получение денег при работе на 3%
           },
           "production": {
               "cost_gram": 300,
               "parts": {
                   "processor": 2,
                   "display": 1,
                   "camera": 2,
                   "battery": 1,
                   "case": 1
               }
           }
       },
       "Ultra Edition": {
           "requirements": {"coding": 250, "design": 150, "analytics": 100},
           "time": 96,
           "description": "Премиальная версия с максимальной производительностью"
       },
       "Gaming Phone": {
           "requirements": {"coding": 300, "design": 200, "analytics": 150},
           "time": 120,
           "description": "Специализированная модель для геймеров"
       },
       "Business Elite": {
           "requirements": {"coding": 350, "design": 250, "analytics": 200},
           "time": 144,
           "description": "Модель для бизнес-пользователей"
       },
       "Camera Master": {
           "requirements": {"coding": 400, "design": 300, "analytics": 250},
           "time": 168,
           "description": "Специализированная модель для фотографии"
       },
       "Security Plus": {
           "requirements": {"coding": 450, "design": 350, "analytics": 300},
           "time": 192,
           "description": "Модель с повышенной безопасностью"
       },
       "Foldable Pro": {
           "requirements": {"coding": 500, "design": 400, "analytics": 350},
           "time": 216,
           "description": "Складная модель премиум-класса"
       },
       "AI Master": {
           "requirements": {"coding": 550, "design": 450, "analytics": 400},
           "time": 240,
           "description": "Модель с продвинутым ИИ"
       }
   },
   "smartwatches": {
       "Basic Watch": {
           "requirements": {"coding": 75, "design": 50},
           "time": 24,
           "description": "Базовая модель смарт-часов",
           "stats": {
               "design": 1,
               "analytics": 1
           },
           "bonuses": {
               "work_exp_boost": 2  # Увеличивает получение опыта на 2%
           },
           "production": {
               "cost_gram": 80,
               "parts": {
                   "processor": 1,
                   "display": 1,
                   "sensors": 1,
                   "battery": 1,
                   "case": 1
               }
           }
       },
       "Fitness Tracker": {
           "requirements": {"coding": 100, "design": 75, "analytics": 50},
           "time": 48,
           "description": "Модель для фитнеса",
           "stats": {
               "design": 2,
               "analytics": 1,
               "attention": 1
           },
           "bonuses": {
               "work_exp_boost": 3,
               "legendary_parts_chance": 2  # Увеличивает шанс получения легендарных деталей на 2%
           },
           "production": {
               "cost_gram": 150,
               "parts": {
                   "processor": 1,
                   "display": 1,
                   "sensors": 2,
                   "battery": 1,
                   "case": 1
               }
           }
       },
       "Health Monitor": {
           "requirements": {"coding": 150, "design": 100, "analytics": 75},
           "time": 72,
           "description": "Часы с расширенным мониторингом здоровья"
       },
       "Sport Edition": {
           "requirements": {"coding": 200, "design": 150, "analytics": 100},
           "time": 96,
           "description": "Спортивная версия"
       },
       "Premium Watch": {
           "requirements": {"coding": 250, "design": 200, "analytics": 150},
           "time": 120,
           "description": "Премиальная модель"
       },
       "Business Time": {
           "requirements": {"coding": 300, "design": 250, "analytics": 200},
           "time": 144,
           "description": "Бизнес-модель"
       },
       "Adventure Pro": {
           "requirements": {"coding": 350, "design": 300, "analytics": 250},
           "time": 168,
           "description": "Модель для активного отдыха"
       },
       "Luxury Edition": {
           "requirements": {"coding": 400, "design": 350, "analytics": 300},
           "time": 192,
           "description": "Люксовая версия"
       },
       "Smart Coach": {
           "requirements": {"coding": 450, "design": 400, "analytics": 350},
           "time": 216,
           "description": "Модель с функцией персонального тренера"
       },
       "Health Master": {
           "requirements": {"coding": 500, "design": 450, "analytics": 400},
           "time": 240,
           "description": "Продвинутая модель для мониторинга здоровья"
       }
   },
   "tablets": {
       "Basic Tablet": {
           "requirements": {"coding": 150, "design": 100},
           "time": 36,
           "description": "Базовая модель планшета",
           "stats": {
               "design": 2,
               "modeling": 1
           },
           "bonuses": {
               "work_money_boost": 5,
               "work_fail_reduction": 3
           },
           "production": {
               "cost_gram": 200,
               "parts": {
                   "processor": 1,
                   "display": 1,
                   "camera": 1,
                   "battery": 2,
                   "case": 1
               }
           }
       },
       "Media Plus": {
           "requirements": {"coding": 200, "design": 150, "analytics": 100},
           "time": 60,
           "description": "Мультимедийная модель",
           "stats": {
               "design": 3,
               "modeling": 2,
               "analytics": 1
           },
           "bonuses": {
               "work_money_boost": 7,
               "work_fail_reduction": 4,
               "rare_parts_chance": 5
           },
           "production": {
               "cost_gram": 300,
               "parts": {
                   "processor": 2,
                   "display": 1,
                   "camera": 2,
                   "battery": 2,
                   "case": 1
               }
           }
       },
       "Pro Tablet": {
           "requirements": {"coding": 250, "design": 200, "analytics": 150},
           "time": 84,
           "description": "Профессиональная модель"
       },
       "Art Studio": {
           "requirements": {"coding": 300, "design": 250, "analytics": 200},
           "time": 108,
           "description": "Модель для художников"
       },
       "Business Tab": {
           "requirements": {"coding": 350, "design": 300, "analytics": 250},
           "time": 132,
           "description": "Бизнес-модель"
       },
       "Education Pro": {
           "requirements": {"coding": 400, "design": 350, "analytics": 300},
           "time": 156,
           "description": "Модель для образования"
       },
       "Gaming Tab": {
           "requirements": {"coding": 450, "design": 400, "analytics": 350},
           "time": 180,
           "description": "Игровая модель"
       },
       "Cinema Plus": {
           "requirements": {"coding": 500, "design": 450, "analytics": 400},
           "time": 204,
           "description": "Модель для просмотра видео"
       },
       "Designer Pro": {
           "requirements": {"coding": 550, "design": 500, "analytics": 450},
           "time": 228,
           "description": "Модель для дизайнеров"
       },
       "Ultimate Tab": {
           "requirements": {"coding": 600, "design": 550, "analytics": 500},
           "time": 252,
           "description": "Максимальная комплектация"
       }
   },
   "asic_miners": {
       "Basic Miner": {
           "requirements": {"coding": 200, "design": 100},
           "time": 48,
           "description": "Базовый ASIC майнер",
           "stats": {
               "coding": 3,
               "analytics": 1
           },
           "bonuses": {
               "gram_mining_boost": 5  # Увеличивает добычу Gram на 5%
           },
           "production": {
               "cost_gram": 500,
               "parts": {
                   "asic_chip": 2,
                   "cooling": 1,
                   "power": 1,
                   "case": 1
               }
           }
       },
       "Efficient Miner": {
           "requirements": {"coding": 250, "design": 150, "analytics": 100},
           "time": 72,
           "description": "Энергоэффективный майнер",
           "stats": {
               "coding": 4,
               "analytics": 2,
               "attention": 1
           },
           "bonuses": {
               "gram_mining_boost": 8,
               "work_exp_boost": 5
           },
           "production": {
               "cost_gram": 800,
               "parts": {
                   "asic_chip": 4,
                   "cooling": 2,
                   "power": 1,
                   "case": 1
               }
           }
       },
       "Pro Miner": {
           "requirements": {"coding": 300, "design": 200, "analytics": 150},
           "time": 96,
           "description": "Профессиональный майнер"
       },
       "Industrial Miner": {
           "requirements": {"coding": 350, "design": 250, "analytics": 200},
           "time": 120,
           "description": "Промышленный майнер"
       },
       "Quantum Miner": {
           "requirements": {"coding": 400, "design": 300, "analytics": 250},
           "time": 144,
           "description": "Квантовый майнер"
       },
       "Smart Miner": {
           "requirements": {"coding": 450, "design": 350, "analytics": 300},
           "time": 168,
           "description": "Умный майнер с автонастройкой"
       },
       "Eco Miner": {
           "requirements": {"coding": 500, "design": 400, "analytics": 350},
           "time": 192,
           "description": "Экологичный майнер"
       },
       "Multi-Algorithm": {
           "requirements": {"coding": 550, "design": 450, "analytics": 400},
           "time": 216,
           "description": "Мультиалгоритмический майнер"
       },
       "Cloud Miner": {
           "requirements": {"coding": 600, "design": 500, "analytics": 450},
           "time": 240,
           "description": "Облачный майнер"
       },
       "AI Miner": {
           "requirements": {"coding": 650, "design": 550, "analytics": 500},
           "time": 264,
           "description": "Майнер с ИИ оптимизацией"
       }
   },
   "laptops": {
       "Basic Laptop": {
           "requirements": {"coding": 250, "design": 150},
           "time": 48,
           "description": "Базовая модель ноутбука",
           "stats": {
               "coding": 2,
               "design": 2,
               "analytics": 1
           },
           "bonuses": {
               "work_money_boost": 5,
               "work_exp_boost": 5
           },
           "production": {
               "cost_gram": 400,
               "parts": {
                   "processor": 1,
                   "memory": 2,
                   "display": 1,
                   "battery": 1,
                   "motherboard": 1,
                   "case": 1,
                   "cooling": 1
               }
           }
       },
       "Student Edition": {
           "requirements": {"coding": 300, "design": 200, "analytics": 150},
           "time": 72,
           "description": "Модель для студентов",
           "stats": {
               "coding": 3,
               "design": 2,
               "analytics": 2,
               "attention": 1
           },
           "bonuses": {
               "work_money_boost": 7,
               "work_exp_boost": 7,
               "rare_parts_chance": 5
           },
           "production": {
               "cost_gram": 600,
               "parts": {
                   "processor": 1,
                   "memory": 4,
                   "display": 1,
                   "battery": 1,
                   "motherboard": 1,
                   "case": 1,
                   "cooling": 2
               }
           }
       },
       "Business Pro": {
           "requirements": {"coding": 350, "design": 250, "analytics": 200},
           "time": 96,
           "description": "Бизнес-ноутбук"
       },
       "Developer Station": {
           "requirements": {"coding": 400, "design": 300, "analytics": 250},
           "time": 120,
           "description": "Ноутбук для разработчиков"
       },
       "Gaming Beast": {
           "requirements": {"coding": 450, "design": 350, "analytics": 300},
           "time": 144,
           "description": "Игровой ноутбук"
       },
       "Creator Studio": {
           "requirements": {"coding": 500, "design": 400, "analytics": 350},
           "time": 168,
           "description": "Ноутбук для творчества"
       },
       "Workstation Pro": {
           "requirements": {"coding": 550, "design": 450, "analytics": 400},
           "time": 192,
           "description": "Профессиональная рабочая станция"
       },
       "Ultra Slim": {
           "requirements": {"coding": 600, "design": 500, "analytics": 450},
           "time": 216,
           "description": "Ультратонкий ноутбук"
       },
       "AI Powerhouse": {
           "requirements": {"coding": 650, "design": 550, "analytics": 500},
           "time": 240,
           "description": "Ноутбук для работы с ИИ"
       },
       "Quantum Book": {
           "requirements": {"coding": 700, "design": 600, "analytics": 550},
           "time": 264,
           "description": "Ноутбук с квантовым процессором"
       }
   }
}

# Статусы разработки чертежей
BLUEPRINT_STATUSES = {
    "not_started": "Не начат",
    "in_progress": "В разработке",
    "completed": "Завершен",
    "production_ready": "Готов к производству"
}

# Характеристики гаджетов
GADGET_STATS = {
    "smartphones": {
        "base_stats": {"performance": 10, "camera": 8, "battery": 12},
        "upgrade_multiplier": 1.2
    },
    "smartwatches": {
        "base_stats": {"sensors": 10, "battery": 15, "display": 8},
        "upgrade_multiplier": 1.15
    },
    "tablets": {
        "base_stats": {"performance": 12, "display": 15, "battery": 20},
        "upgrade_multiplier": 1.25
    },
    "asic_miners": {
        "base_stats": {"hashrate": 20, "efficiency": 15, "cooling": 10},
        "upgrade_multiplier": 1.3
    },
    "laptops": {
        "base_stats": {"performance": 15, "battery": 12, "display": 10},
        "upgrade_multiplier": 1.25
    }
}

# Требования к производству
PRODUCTION_REQUIREMENTS = {
    "smartphones": {
        "min_level": 1,
        "production_cost_gram": 50,
        "parts": {
            "processor": {"min_rarity": "Common", "quantity": 1},
            "display": {"min_rarity": "Common", "quantity": 1},
            "camera": {"min_rarity": "Common", "quantity": 2},  # Основная и фронтальная
            "battery": {"min_rarity": "Common", "quantity": 1},
            "case": {"min_rarity": "Common", "quantity": 1}
        }
    },
    "smartwatches": {
        "min_level": 1,
        "production_cost_gram": 30,
        "parts": {
            "processor": {"min_rarity": "Common", "quantity": 1},
            "display": {"min_rarity": "Common", "quantity": 1},
            "sensors": {"min_rarity": "Common", "quantity": 3},  # Пульсометр, гироскоп, акселерометр
            "battery": {"min_rarity": "Common", "quantity": 1},
            "case": {"min_rarity": "Common", "quantity": 1}
        }
    },
    "tablets": {
        "min_level": 2,
        "production_cost_gram": 80,
        "parts": {
            "processor": {"min_rarity": "Rare", "quantity": 1},
            "display": {"min_rarity": "Rare", "quantity": 1},
            "camera": {"min_rarity": "Common", "quantity": 2},
            "battery": {"min_rarity": "Rare", "quantity": 1},
            "case": {"min_rarity": "Common", "quantity": 1}
        }
    },
    "asic_miners": {
        "min_level": 3,
        "production_cost_gram": 150,
        "parts": {
            "asic_chip": {"min_rarity": "Rare", "quantity": 4},
            "cooling": {"min_rarity": "Rare", "quantity": 2},
            "power": {"min_rarity": "Rare", "quantity": 1},
            "case": {"min_rarity": "Common", "quantity": 1}
        }
    },
    "laptops": {
        "min_level": 2,
        "production_cost_gram": 120,
        "parts": {
            "processor": {"min_rarity": "Rare", "quantity": 1},
            "memory": {"min_rarity": "Rare", "quantity": 2},
            "display": {"min_rarity": "Rare", "quantity": 1},
            "battery": {"min_rarity": "Common", "quantity": 1},
            "motherboard": {"min_rarity": "Rare", "quantity": 1},
            "case": {"min_rarity": "Common", "quantity": 1},
            "cooling": {"min_rarity": "Common", "quantity": 1}
        }
    }
}

# Добавляем множители качества для разных уровней редкости
RARITY_QUALITY_MULTIPLIERS = {
    "Common": 1.0,
    "Rare": 1.5,
    "Epic": 2.0,
    "Legendary": 3.0
}

def get_available_blueprints(company_level: int) -> Dict[str, dict]:
    """Возвращает доступные чертежи для заданного уровня компании"""
    available_blueprints = {}
    
    for category, blueprints in GADGET_BLUEPRINTS.items():
        category_blueprints = {}
        # Для уровня 1 берем только базовые чертежи
        if company_level == 1:
            for name, data in blueprints.items():
                if "Basic" in name:
                    category_blueprints[name] = data
        # Для уровня 2 добавляем улучшенные чертежи
        elif company_level == 2:
            for name, data in blueprints.items():
                if "Plus" in name or "Smart" in name:
                    category_blueprints[name] = data
        # Для уровня 3 и выше добавляем продвинутые чертежи
        elif company_level >= 3:
            for name, data in blueprints.items():
                if "Pro" in name or "Premium" in name:
                    category_blueprints[name] = data
        
        if category_blueprints:
            available_blueprints[category] = category_blueprints
    
    return available_blueprints


def display_company_blueprints(company: Company) -> str:
    """Отображает доступные и будущие чертежи для компании"""
    available_blueprints = get_available_blueprints(company.level)
    next_level_blueprints = get_available_blueprints(company.level + 1)

    output = [f"Уровень компании: {company.level}", "Чертежи в разработке:"]
    for blueprint in company.blueprints:
        output.append(f"- {blueprint}")

    # Инициализация переменной
    available_blueprints_text = "\nДоступные чертежи для разработки:\n"
    for blueprint_name, blueprint_data in available_blueprints.items():
        description = blueprint_data.get("description", "")
        requirements = blueprint_data.get("requirements", {})
        requirements_text = ", ".join([f"{key}: {value}" for key, value in blueprint_data.get("requirements", {}).items()])
        available_blueprints_text += f"- {blueprint_name}: {description} (Требования: {requirements_text})\n"

    future_blueprints = get_available_blueprints(company.level + 1)
    future_blueprints_text = "\nЧертежи, доступные на следующем уровне:\n"
    for blueprint_name, blueprint_data in future_blueprints.items():
        description = blueprint_data.get("description", "")
        future_blueprints_text += f"- {blueprint_name}: {description}\n"

    return (
        f"Компания {company.level} уровня: {company.name}\n"
        f"Текущий баланс: {company.balance} Gram\n"
        f"Максимум сотрудников: {COMPANY_LEVELS[company.level]['max_employees']}\n"
        f"Вместимость хранилища: {COMPANY_LEVELS[company.level]['storage_capacity']}\n"
        f"\nДоступные чертежи:\n{available_blueprints_text}"
        f"{future_blueprints_text}"
    )

# Пример использования
company = Company(name="Tech Innovators", owner_id=1, company_type="Мобильная разработка")
company.level = 1
print(display_company_blueprints(company)) 