# Полный список работ по городам
JOBS = {
    "Сан-Франциско": {
        "Стажер iOS разработчик (Intern)": {
            "min_stats": {"coding": 0},
            "rank_required": "Intern",
            "time_cost": 180,  # 3 minutes in seconds
            "reward": 10,
            "exp_reward": 20,
            "description": "Разработка простых функций для iOS приложений"
        },
        "Junior iOS разработчик (Junior)": {
            "min_stats": {"coding": 2, "design": 1},
            "rank_required": "Junior",
            "time_cost": 180,
            "reward": 25,
            "exp_reward": 30,
            "description": "Разработка компонентов iOS приложений"
        },
        "Middle iOS разработчик (Middle)": {
            "min_stats": {"coding": 4, "design": 2, "analytics": 2},
            "rank_required": "Middle",
            "time_cost": 180,
            "reward": 45,
            "exp_reward": 40,
            "description": "Разработка сложных функций и оптимизация приложений"
        },
        "Senior iOS разработчик (Senior)": {
            "min_stats": {"coding": 6, "design": 3, "analytics": 3},
            "rank_required": "Senior",
            "time_cost": 180,
            "reward": 70,
            "exp_reward": 50,
            "description": "Разработка архитектуры приложений и менторство"
        },
        "Lead iOS разработчик (Lead)": {
            "min_stats": {"coding": 8, "analytics": 4, "attention": 3},
            "rank_required": "Lead",
            "time_cost": 180,
            "reward": 100,
            "exp_reward": 60,
            "description": "Руководство командой iOS разработки"
        },
        "iOS Архитектор (Architect)": {
            "min_stats": {"coding": 10, "analytics": 6, "attention": 4},
            "rank_required": "Architect",
            "time_cost": 180,
            "reward": 150,
            "exp_reward": 70,
            "description": "Проектирование экосистемы iOS устройств"
        }
    },
    "Сингапур": {
        "Стажер QA (Intern)": {
            "min_stats": {"testing": 0},
            "rank_required": "Intern",
            "time_cost": 180,
            "reward": 15,
            "exp_reward": 20,
            "description": "Базовое тестирование мобильных устройств"
        },
        "Junior QA инженер (Junior)": {
            "min_stats": {"testing": 2, "attention": 1},
            "rank_required": "Junior",
            "time_cost": 180,
            "reward": 30,
            "exp_reward": 30,
            "description": "Тестирование функционала устройств"
        },
        "Middle QA инженер (Middle)": {
            "min_stats": {"testing": 4, "attention": 2, "analytics": 2},
            "rank_required": "Middle",
            "time_cost": 180,
            "reward": 50,
            "exp_reward": 40,
            "description": "Автоматизация тестирования устройств"
        },
        "Senior QA инженер (Senior)": {
            "min_stats": {"testing": 6, "attention": 3, "analytics": 3},
            "rank_required": "Senior",
            "time_cost": 180,
            "reward": 80,
            "exp_reward": 50,
            "description": "Разработка стратегий тестирования"
        },
        "Lead QA инженер (Lead)": {
            "min_stats": {"testing": 8, "analytics": 4, "attention": 4},
            "rank_required": "Lead",
            "time_cost": 180,
            "reward": 120,
            "exp_reward": 60,
            "description": "Управление процессами тестирования"
        },
        "QA Архитектор (Architect)": {
            "min_stats": {"testing": 10, "analytics": 6, "attention": 5},
            "rank_required": "Architect",
            "time_cost": 180,
            "reward": 180,
            "exp_reward": 70,
            "description": "Проектирование систем контроля качества"
        }
    },
    "Санкт-Петербург": {
        "Стажер UI/UX (Intern)": {
            "min_stats": {"design": 0},
            "rank_required": "Intern",
            "time_cost": 10,
            "reward": 1000,
            "exp_reward": 45,
            "description": "Создание простых элементов интерфейса"
        },
        "Junior UI/UX дизайнер (Junior)": {
            "min_stats": {"design": 0, "attention": 0},
            "rank_required": "Junior",
            "time_cost": 10,
            "reward": 2000,
            "exp_reward": 45,
            "description": "Разработка интерфейсов приложений"
        },
        "Middle UI/UX дизайнер (Middle)": {
            "min_stats": {"design": 4, "attention": 2, "drawing": 2},
            "rank_required": "Middle",
            "time_cost": 180,
            "reward": 48,
            "exp_reward": 40,
            "description": "Создание сложных интерфейсов"
        },
        "Senior UI/UX дизайнер (Senior)": {
            "min_stats": {"design": 6, "attention": 3, "drawing": 3},
            "rank_required": "Senior",
            "time_cost": 180,
            "reward": 75,
            "exp_reward": 50,
            "description": "Разработка дизайн-систем"
        }
    }
}

# Информация о городах
CITIES = {
    "Сан-Франциско": {
        "currency": "USD",
        "currency_symbol": "$",
        "exchange_rate": 1.0,
        "specialization": "iOS разработка",
        "description": "Технологическая столица мира"
    },
    "Сингапур": {
        "currency": "SGD",
        "currency_symbol": "S$",
        "exchange_rate": 0.74,
        "specialization": "QA и тестирование",
        "description": "Азиатский технологический хаб"
    },
    "Санкт-Петербург": {
        "currency": "RUB",
        "currency_symbol": "₽",
        "exchange_rate": 0.011,
        "specialization": "UI/UX дизайн",
        "description": "Культурная столица России"
    }
} 