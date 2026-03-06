from typing import Dict, List
import json
import sqlite3
from datetime import datetime, timedelta

COMPANY_CREATION_COST = 10000

# Опыт за различные действия компании
COMPANY_EXPERIENCE = {
    "blueprint_completion": 500,  # За завершение разработки чертежа
    "gadget_production": 100,    # За производство гаджета
    "hackathon_success": 1000,   # За успешное участие в хакатоне
    "weekly_task": 300,          # За выполнение еженедельного задания
    "employee_daily": 50         # За ежедневную активность сотрудника
}

# Требования и бонусы для каждого уровня компании
COMPANY_LEVELS = {
    1: {
        "name": "Стартап",
        "required_exp": 0,
        "required_gram": 0,
        "max_employees": 10,
        "storage_capacity": 100,
        "dev_speed_bonus": 0,
        "production_discount": 0,
        "max_blueprints": 1,
        "features": ["Доступ к базовым чертежам"]
    },
    2: {
        "name": "Малое предприятие",
        "required_exp": 5000,
        "required_gram": 10000,
        "max_employees": 15,
        "storage_capacity": 150,
        "dev_speed_bonus": 5,
        "production_discount": 2,
        "max_blueprints": 2,
        "features": [
            "Доступ к улучшенным чертежам",
            "Бонус к скорости разработки +5%",
            "Скидка на производство 2%"
        ]
    },
    3: {
        "name": "Средняя компания",
        "required_exp": 15000,
        "required_gram": 50000,
        "max_employees": 20,
        "storage_capacity": 200,
        "dev_speed_bonus": 10,
        "production_discount": 5,
        "max_blueprints": 3,
        "features": [
            "Доступ к продвинутым чертежам",
            "Бонус к скорости разработки +10%",
            "Скидка на производство 5%",
            "Участие в городских хакатонах"
        ]
    },
    4: {
        "name": "Крупная компания",
        "required_exp": 50000,
        "required_gram": 200000,
        "max_employees": 25,
        "storage_capacity": 250,
        "dev_speed_bonus": 15,
        "production_discount": 10,
        "max_blueprints": 4,
        "features": [
            "Доступ к премиум чертежам",
            "Бонус к скорости разработки +15%",
            "Скидка на производство 10%",
            "Доступ к международным хакатонам",
            "Создание филиалов"
        ]
    },
    5: {
        "name": "Корпорация",
        "required_exp": 150000,
        "required_gram": 1000000,
        "max_employees": 30,
        "storage_capacity": 300,
        "dev_speed_bonus": 20,
        "production_discount": 15,
        "max_blueprints": 5,
        "features": [
            "Доступ ко всем чертежам",
            "Бонус к скорости разработки +20%",
            "Скидка на производство 15%",
            "Эксклюзивные хакатоны",
            "Создание альянсов",
            "Специальные корпоративные задания"
        ]
    }
}

# Бонусный опыт сотрудникам при повышении уровня компании
COMPANY_LEVEL_UP_EMPLOYEE_BONUS = {
    2: 1000,  # Опыт каждому сотруднику при достижении компанией 2 уровня
    3: 2000,
    4: 5000,
    5: 10000
}

COMPANY_TYPES = {
    "Мобильная разработка": {
        "description": "Разработка мобильных приложений",
        "required_stats": {"coding": 5, "design": 3},
        "production": ["phone", "tablet"]
    },
    "Носимые устройства": {
        "description": "Разработка умных часов и фитнес-трекеров",
        "required_stats": {"modeling": 5, "design": 3},
        "production": ["watch"]
    }
}

PRODUCTION_LINES = {
    "phone": {
        "setup_cost": 5000,
        "daily_maintenance": 100,
        "production_time": 3600,  # 1 час
        "required_parts": ["Процессор", "Дисплей", "Камера", "Батарея", "Корпус"]
    },
    "watch": {
        "setup_cost": 3000,
        "daily_maintenance": 50,
        "production_time": 1800,  # 30 минут
        "required_parts": ["Процессор", "Экран", "Датчики", "Батарея", "Ремешок"]
    },
    "tablet": {
        "setup_cost": 7000,
        "daily_maintenance": 150,
        "production_time": 5400,  # 1.5 часа
        "required_parts": ["Процессор", "Дисплей", "Камера", "Батарея", "Корпус"]
    }
}

WEEKLY_TASKS = {
    "Разработка нового продукта": {
        "reward": 5000,
        "exp": 1000,
        "required_stats": {"coding": 3, "design": 2},
        "description": "Разработать новый продукт для компании"
    },
    "Оптимизация производства": {
        "reward": 3000,
        "exp": 800,
        "required_stats": {"analytics": 3, "attention": 2},
        "description": "Улучшить эффективность производственных линий"
    },
    "Маркетинговая кампания": {
        "reward": 4000,
        "exp": 900,
        "required_stats": {"design": 3, "analytics": 2},
        "description": "Провести успешную маркетинговую кампанию"
    },
    "Обучение персонала": {
        "reward": 2500,
        "exp": 700,
        "required_stats": {"teaching": 3, "attention": 2},
        "description": "Провести обучение новых сотрудников"
    },
    "Исследование рынка": {
        "reward": 3500,
        "exp": 850,
        "required_stats": {"analytics": 4, "research": 2},
        "description": "Провести анализ рынка и конкурентов"
    },
    "Улучшение качества": {
        "reward": 4500,
        "exp": 950,
        "required_stats": {"testing": 3, "attention": 3},
        "description": "Повысить качество производимой продукции"
    },
    "Разработка прототипа": {
        "reward": 6000,
        "exp": 1200,
        "required_stats": {"coding": 4, "design": 3},
        "description": "Создать прототип нового устройства"
    },
    "Оптимизация расходов": {
        "reward": 4000,
        "exp": 900,
        "required_stats": {"analytics": 3, "management": 2},
        "description": "Снизить производственные расходы"
    },
    "Расширение производства": {
        "reward": 7000,
        "exp": 1500,
        "required_stats": {"management": 4, "analytics": 3},
        "description": "Увеличить производственные мощности"
    },
    "Инновационный проект": {
        "reward": 8000,
        "exp": 2000,
        "required_stats": {"innovation": 4, "coding": 3},
        "description": "Разработать инновационное решение"
    }
}

HACKATHONS = {
    "Мобильные инновации": {
        "reward": 10000,
        "exp": 2000,
        "required_stats": {"coding": 5, "innovation": 3}
    },
    "Умные устройства": {
        "reward": 8000,
        "exp": 1500,
        "required_stats": {"modeling": 4, "design": 3}
    }
}

class Company:
    def __init__(self, name: str, owner_id: int, company_type: str):
        self.name = name
        self.owner_id = owner_id
        self.company_type = company_type
        self.balance = 0
        self.level = 1
        self.experience = 0  # Добавляем опыт компании
        self.rating = 0
        self.max_employees = COMPANY_LEVELS[1]["max_employees"]
        self.storage_capacity = COMPANY_LEVELS[1]["storage_capacity"]
        self.storage_used = 0
        self.production_lines = []
        self.employees = []
        self.employee_salaries = {}
        self.blueprints = []
        self.production_queue = []
        self.hackathon_participation = False
        self.founded_date = datetime.now()
        self.last_maintenance_check = datetime.now()
        self.last_salary_payment = datetime.now()
        self.total_gadgets_sold = 0
        self.total_revenue = 0
        self.employee_contributions = {}

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "owner_id": self.owner_id,
            "company_type": self.company_type,
            "balance": self.balance,
            "level": self.level,
            "experience": self.experience,  # Добавляем опыт в сериализацию
            "rating": self.rating,
            "max_employees": self.max_employees,
            "storage_capacity": self.storage_capacity,
            "storage_used": self.storage_used,
            "production_lines": self.production_lines,
            "employees": self.employees,
            "employee_salaries": self.employee_salaries,
            "blueprints": self.blueprints,
            "production_queue": self.production_queue,
            "hackathon_participation": self.hackathon_participation,
            "founded_date": self.founded_date.isoformat(),
            "last_maintenance_check": self.last_maintenance_check.isoformat(),
            "last_salary_payment": self.last_salary_payment.isoformat(),
            "total_gadgets_sold": self.total_gadgets_sold,
            "total_revenue": self.total_revenue,
            "employee_contributions": self.employee_contributions
        }

    @classmethod
    def from_dict(cls, data: dict) -> 'Company':
        company = cls(data["name"], data["owner_id"], data["company_type"])
        company.balance = data["balance"]
        company.level = data.get("level", 1)
        company.experience = data.get("experience", 0)  # Добавляем загрузку опыта
        company.rating = data.get("rating", 0)
        company.max_employees = data.get("max_employees", COMPANY_LEVELS[1]["max_employees"])
        company.storage_capacity = data.get("storage_capacity", COMPANY_LEVELS[1]["storage_capacity"])
        company.storage_used = data.get("storage_used", 0)
        company.production_lines = data["production_lines"]
        company.employees = data["employees"]
        company.employee_salaries = data.get("employee_salaries", {})
        company.blueprints = data.get("blueprints", [])
        company.production_queue = data.get("production_queue", [])
        company.hackathon_participation = data.get("hackathon_participation", False)
        company.founded_date = datetime.fromisoformat(data["founded_date"])
        company.last_maintenance_check = datetime.fromisoformat(data["last_maintenance_check"])
        company.last_salary_payment = datetime.fromisoformat(data.get("last_salary_payment", company.founded_date.isoformat()))
        company.total_gadgets_sold = data.get("total_gadgets_sold", 0)
        company.total_revenue = data.get("total_revenue", 0)
        company.employee_contributions = data.get("employee_contributions", {})
        return company

    def add_experience(self, exp_type: str) -> tuple[int, bool]:
        """
        Добавляет опыт компании и проверяет возможность повышения уровня
        
        Args:
            exp_type: Тип действия, за которое начисляется опыт
            
        Returns:
            tuple[int, bool]: (количество полученного опыта, произошло ли повышение уровня)
        """
        if exp_type not in COMPANY_EXPERIENCE:
            return 0, False
            
        exp_gained = COMPANY_EXPERIENCE[exp_type]
        self.experience += exp_gained
        
        # Проверяем возможность повышения уровня
        level_up = self.check_level_up()
        return exp_gained, level_up

    def check_level_up(self) -> bool:
        """
        Проверяет возможность повышения уровня компании
        
        Returns:
            bool: True если уровень был повышен, False в противном случае
        """
        if self.level >= 5:  # Максимальный уровень
            return False
            
        next_level = self.level + 1
        level_data = COMPANY_LEVELS[next_level]
        
        if (self.experience >= level_data["required_exp"] and 
            self.balance >= level_data["required_gram"]):
            
            # Списываем требуемое количество gram
            self.balance -= level_data["required_gram"]
            
            # Обновляем параметры компании
            self.level = next_level
            self.max_employees = level_data["max_employees"]
            self.storage_capacity = level_data["storage_capacity"]
            
            return True
        return False

    def get_level_progress(self) -> dict:
        """
        Возвращает информацию о прогрессе до следующего уровня
        
        Returns:
            dict: Информация о прогрессе
        """
        if self.level >= 5:
            return {
                "current_level": self.level,
                "exp_progress": 100,
                "gram_progress": 100,
                "next_level_name": None,
                "features": COMPANY_LEVELS[self.level]["features"]
            }
            
        next_level = self.level + 1
        level_data = COMPANY_LEVELS[next_level]
        
        exp_progress = min(100, (self.experience / level_data["required_exp"]) * 100)
        gram_progress = min(100, (self.balance / level_data["required_gram"]) * 100)
        
        return {
            "current_level": self.level,
            "current_level_name": COMPANY_LEVELS[self.level]["name"],
            "next_level_name": level_data["name"],
            "exp_progress": exp_progress,
            "gram_progress": gram_progress,
            "exp_required": level_data["required_exp"],
            "gram_required": level_data["required_gram"],
            "current_features": COMPANY_LEVELS[self.level]["features"],
            "next_features": level_data["features"]
        }

    def get_development_bonus(self) -> float:
        """Возвращает бонус к скорости разработки"""
        return COMPANY_LEVELS[self.level]["dev_speed_bonus"] / 100.0

    def get_production_discount(self) -> float:
        """Возвращает скидку на производство"""
        return COMPANY_LEVELS[self.level]["production_discount"] / 100.0

    def complete_weekly_task(self, task_name: str) -> tuple[bool, str]:
        """
        Завершает еженедельное задание и начисляет награды
        
        Args:
            task_name: Название выполненного задания
            
        Returns:
            tuple[bool, str]: (успех операции, сообщение о результате)
        """
        if task_name not in WEEKLY_TASKS:
            return False, "Задание не найдено"
            
        task_data = WEEKLY_TASKS[task_name]
        
        # Проверяем, есть ли это задание в списке активных
        if "weekly_tasks" not in self.__dict__:
            self.weekly_tasks = []
            
        task = next((t for t in self.weekly_tasks if t.get("name") == task_name), None)
        if not task:
            return False, "Это задание не является активным"
            
        # Начисляем награды
        self.balance += task_data["reward"]
        exp_gained, level_up = self.add_experience("weekly_task")
        
        # Удаляем задание из списка активных
        self.weekly_tasks.remove(task)
        
        # Формируем сообщение о наградах
        message = (
            f"✅ Задание '{task_name}' выполнено!\n"
            f"💰 Получено: {task_data['reward']} Gram\n"
            f"⭐️ Опыт: {exp_gained}"
        )
        
        if level_up:
            message += "\n🎉 Компания повысила уровень!"
            
        return True, message

    def add_weekly_task(self, task_name: str) -> tuple[bool, str]:
        """
        Добавляет новое еженедельное задание
        
        Args:
            task_name: Название задания
            
        Returns:
            tuple[bool, str]: (успех операции, сообщение о результате)
        """
        if task_name not in WEEKLY_TASKS:
            return False, "Задание не найдено"
            
        if "weekly_tasks" not in self.__dict__:
            self.weekly_tasks = []
            
        # Проверяем, не добавлено ли уже это задание
        if any(t.get("name") == task_name for t in self.weekly_tasks):
            return False, "Это задание уже добавлено"
            
        # Добавляем новое задание
        task_data = WEEKLY_TASKS[task_name]
        self.weekly_tasks.append({
            "name": task_name,
            "progress": 0,
            "reward": task_data["reward"],
            "exp": task_data["exp"],
            "description": task_data["description"],
            "required_stats": task_data["required_stats"]
        })
        
        return True, f"✅ Задание '{task_name}' добавлено"

def create_company_tables(conn: sqlite3.Connection):
    """Создает необходимые таблицы для компаний в базе данных"""
    cursor = conn.cursor()
    
    # Таблица компаний
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS companies (
        company_id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        owner_id INTEGER NOT NULL,
        company_data TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')
    
    # Таблица сотрудников компании
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS company_employees (
        employee_id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        role TEXT DEFAULT 'employee',
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (company_id) REFERENCES companies (company_id),
        UNIQUE(company_id, user_id)
    )
    ''')
    
    # Таблица заявок на вступление
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS company_applications (
        application_id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (company_id) REFERENCES companies (company_id)
    )
    ''')
    
    # Таблица производственных линий
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS production_lines (
        line_id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (company_id) REFERENCES companies (company_id)
    )
    ''')
    
    # Таблица чертежей компании
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS company_blueprints (
        blueprint_id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER NOT NULL,
        gadget_type TEXT NOT NULL,
        status TEXT NOT NULL,
        completion_percentage REAL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (company_id) REFERENCES companies (company_id)
    )
    ''')
    
    # Таблица производства
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS company_production (
        production_id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER NOT NULL,
        gadget_type TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        status TEXT NOT NULL,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP,
        FOREIGN KEY (company_id) REFERENCES companies (company_id)
    )
    ''')
    
    conn.commit()

HACKATHON_REQUIREMENTS = {
    "Мобильные инновации": {
        "total_coding": 100,
        "total_innovation": 50,
        "reward": {
            "gram": 1000,
            "exp": 5000,
            "blueprint": "premium_phone"
        }
    },
    "Умные устройства": {
        "total_modeling": 80,
        "total_design": 60,
        "reward": {
            "gram": 800,
            "exp": 4000,
            "blueprint": "premium_watch"
        }
    }
}

PRODUCTION_SETTINGS = {
    "phone": {
        "time": 3600,  # 1 час
        "parts_required": {"processor": 1, "display": 1, "camera": 1, "battery": 1, "case": 1},
        "min_quality": 80
    },
    "watch": {
        "time": 1800,  # 30 минут
        "parts_required": {"processor": 1, "display": 1, "sensors": 1, "battery": 1, "strap": 1},
        "min_quality": 75
    },
    "tablet": {
        "time": 5400,  # 1.5 часа
        "parts_required": {"processor": 1, "display": 1, "camera": 1, "battery": 1, "case": 1},
        "min_quality": 85
    }
} 