import logging

TOKEN = '841643155:AAF6uunKFO--8_qcdLD3KVoLPOwHk0ztYaE'  # Замените на ваш токен от @BotFather

# Database settings
DATABASE_NAME = 'players.db'

# Admin settings
ADMIN_ID = '118861170'  # Замените на ваш ID в Telegram

# Game settings
INITIAL_BALANCE = 1000
INITIAL_STATS = {
    "coding": 1,
    "testing": 1,
    "analytics": 1,
    "drawing": 1,
    "modeling": 1,
    "design": 1,
    "attention": 1
}

# Характеристики и их отображение
STAT_TRANSLATIONS = {
    "coding": "Кодинг ⌨️",
    "testing": "Тестинг 🔍",
    "analytics": "Аналитика 📊",
    "drawing": "Рисование 🎨",
    "modeling": "Моделинг 🌐",
    "design": "Дизайн 🖌️",
    "attention": "Внимательность 👀"
}

# Ранги и уровни
RANKS = {
    "Intern": {"min_level": 1, "max_level": 5},
    "Junior": {"min_level": 6, "max_level": 15},
    "Middle": {"min_level": 16, "max_level": 25},
    "Senior": {"min_level": 26, "max_level": 35},
    "Lead": {"min_level": 36, "max_level": 45},
    "Architect": {"min_level": 46, "max_level": 60},
    "Tech Director": {"min_level": 61, "max_level": float('inf')},
    "CEO": {
        "min_level": 1,
        "max_level": float('inf'),
        "requires_company_ownership": True  # Добавляем требование владения компанией
    }
}

RANK_EMOJIS = {
    "Intern": "🎓",
    "Junior": "👶",
    "Middle": "👨‍💻",
    "Senior": "👨‍🔬",
    "Lead": "👨‍💼",
    "Architect": "🎯",
    "Tech Director": "👑",
    "CEO": "💼"
}

# Time settings
WORK_COOLDOWN = 60  # 1 minute in seconds (changed from 0.1)
DAILY_RESET_TIME = "00:00"  # UTC

# Experience settings
BASE_EXP_REWARD = 10
EXP_MULTIPLIER = 1.5

# Game mechanics settings
MAX_WORK_TIME = 1200  # 20 minutes in seconds
MAX_STUDY_TIME = 1200  # 20 minutes in seconds
TIME_RESTORE_RATE = 360  # 6 minutes game time per 1 minute real time

# Bank settings
BANK_SETTINGS = {
    "credits": {
        "programs": {
            "Стандартный": {
                "min_level": 1,
                "min_amount": {
                    "Санкт-Петербург": 1_000_000,  # 1,000 Garm
                    "Сан-Франциско": 10_000,       # 1,000 Garm
                    "Сингапур": 14_285             # 1,000 Garm
                },
                "max_amount": {
                    "Санкт-Петербург": 10_000_000,  # 10,000 Garm
                    "Сан-Франциско": 100_000,       # 10,000 Garm
                    "Сингапур": 142_857             # 10,000 Garm
                },
                "min_days": 7,
                "max_days": 30,
                "interest_rate": 0.15,  # 15% годовых
                "penalty_rate": 0.2,    # 20% штраф за просрочку
            },
            "Премиум": {
                "min_level": 10,
                "min_amount": {
                    "Санкт-Петербург": 5_000_000,   # 5,000 Garm
                    "Сан-Франциско": 50_000,        # 5,000 Garm
                    "Сингапур": 71_428              # 5,000 Garm
                },
                "max_amount": {
                    "Санкт-Петербург": 50_000_000,  # 50,000 Garm
                    "Сан-Франциско": 500_000,       # 50,000 Garm
                    "Сингапур": 714_285             # 50,000 Garm
                },
                "min_days": 14,
                "max_days": 60,
                "interest_rate": 0.12,  # 12% годовых
                "penalty_rate": 0.15,   # 15% штраф за просрочку
            },
            "VIP": {
                "min_level": 25,
                "min_amount": {
                    "Санкт-Петербург": 20_000_000,  # 20,000 Garm
                    "Сан-Франциско": 200_000,       # 20,000 Garm
                    "Сингапур": 285_714             # 20,000 Garm
                },
                "max_amount": {
                    "Санкт-Петербург": 200_000_000, # 200,000 Garm
                    "Сан-Франциско": 2_000_000,     # 200,000 Garm
                    "Сингапур": 2_857_142           # 200,000 Garm
                },
                "min_days": 30,
                "max_days": 90,
                "interest_rate": 0.10,  # 10% годовых
                "penalty_rate": 0.12,   # 12% штраф за просрочку
            },
            "Бизнес": {
                "min_level": 40,
                "min_amount": {
                    "Санкт-Петербург": 100_000_000, # 100,000 Garm
                    "Сан-Франциско": 1_000_000,     # 100,000 Garm
                    "Сингапур": 14_285_714          # 100,000 Garm
                },
                "max_amount": {
                    "Санкт-Петербург": 1_000_000_000, # 1,000,000 Garm
                    "Сан-Франциско": 10_000_000,      # 1,000,000 Garm
                    "Сингапур": 142_857_142           # 1,000,000 Garm
                },
                "min_days": 60,
                "max_days": 180,
                "interest_rate": 0.08,  # 8% годовых
                "penalty_rate": 0.10,   # 10% штраф за просрочку
            }
        },
        "max_active": 3  # Максимум активных кредитов
    },
    "deposits": {
        "programs": {
            "Сберегательный": {
                "min_level": 1,
                "min_amount": {
                    "Санкт-Петербург": 100_000,     # 100 Garm
                    "Сан-Франциско": 1_000,         # 100 Garm
                    "Сингапур": 1_428               # 100 Garm
                },
                "max_amount": {
                    "Санкт-Петербург": 10_000_000,  # 10,000 Garm
                    "Сан-Франциско": 100_000,       # 10,000 Garm
                    "Сингапур": 142_857             # 10,000 Garm
                },
                "min_days": 7,
                "max_days": 30,
                "interest_rate": 0.10,  # 10% годовых
            },
            "Накопительный": {
                "min_level": 10,
                "min_amount": {
                    "Санкт-Петербург": 5_000_000,   # 5,000 Garm
                    "Сан-Франциско": 50_000,        # 5,000 Garm
                    "Сингапур": 71_428              # 5,000 Garm
                },
                "max_amount": {
                    "Санкт-Петербург": 50_000_000,  # 50,000 Garm
                    "Сан-Франциско": 500_000,       # 50,000 Garm
                    "Сингапур": 714_285             # 50,000 Garm
                },
                "min_days": 14,
                "max_days": 60,
                "interest_rate": 0.12,  # 12% годовых
            },
            "Премиум": {
                "min_level": 25,
                "min_amount": {
                    "Санкт-Петербург": 20_000_000,  # 20,000 Garm
                    "Сан-Франциско": 200_000,       # 20,000 Garm
                    "Сингапур": 285_714             # 20,000 Garm
                },
                "max_amount": {
                    "Санкт-Петербург": 200_000_000, # 200,000 Garm
                    "Сан-Франциско": 2_000_000,     # 200,000 Garm
                    "Сингапур": 2_857_142           # 200,000 Garm
                },
                "min_days": 30,
                "max_days": 90,
                "interest_rate": 0.15,  # 15% годовых
            },
            "VIP": {
                "min_level": 40,
                "min_amount": {
                    "Санкт-Петербург": 100_000_000, # 100,000 Garm
                    "Сан-Франциско": 1_000_000,     # 100,000 Garm
                    "Сингапур": 14_285_714          # 100,000 Garm
                },
                "max_amount": {
                    "Санкт-Петербург": 1_000_000_000, # 1,000,000 Garm
                    "Сан-Франциско": 10_000_000,      # 1,000,000 Garm
                    "Сингапур": 142_857_142           # 1,000,000 Garm
                },
                "min_days": 60,
                "max_days": 180,
                "interest_rate": 0.18,  # 18% годовых
            }
        },
        "max_active": 3  # Максимум активных вкладов
    }
}

