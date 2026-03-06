from datetime import datetime, timedelta
import asyncio
from typing import Dict, List, Optional
import json
from aiogram import Bot
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
from aiogram.utils.keyboard import InlineKeyboardBuilder

# Конфигурация хакатона
HACKATHON_CONFIG = {
    "days": [1, 4],  # Вторник (1) и Пятница (4)
    "start_time": "17:42",
    "notification_time": "17:40",
    "duration_minutes": 5,
    "rewards": {
        "first_place": {
            "gram": 50000,
            "exp": 2000,
            "blueprint": "premium_device"
        },
        "second_place": {
            "gram": 30000,
            "exp": 1500,
            "blueprint": "advanced_device"
        },
        "third_place": {
            "gram": 20000,
            "exp": 1000,
            "blueprint": "basic_device"
        }
    }
}

class HackathonManager:
    def __init__(self, bot: Bot, db_connection):
        self.bot = bot
        self.db = db_connection
        self.active_hackathon = None
        self.participants = {}  # {company_id: {user_id: stats}}
        self.company_scores = {}  # {company_id: total_score}
        self.is_running = False

    async def check_hackathon_schedule(self):
        """Проверяет расписание хакатона и запускает его при необходимости"""
        while True:
            now = datetime.now()
            current_time = now.strftime("%H:%M")
            current_day = now.weekday()

            # Проверяем, нужно ли отправить уведомление
            if (current_day in HACKATHON_CONFIG["days"] and 
                current_time == HACKATHON_CONFIG["notification_time"]):
                await self.send_hackathon_notification()

            # Проверяем, нужно ли начать хакатон
            if (current_day in HACKATHON_CONFIG["days"] and 
                current_time == HACKATHON_CONFIG["start_time"]):
                await self.start_hackathon()

            await asyncio.sleep(30)  # Проверяем каждые 30 секунд

    async def send_hackathon_notification(self):
        """Отправляет уведомление о предстоящем хакатоне"""
        cursor = self.db.cursor()
        cursor.execute('''
            SELECT DISTINCT ce.user_id, c.company_id
            FROM company_employees ce
            JOIN companies c ON ce.company_id = c.company_id
            WHERE ce.status = 'active'
        ''')
        
        for user_id, company_id in cursor.fetchall():
            keyboard = InlineKeyboardBuilder()
            keyboard.button(text="Участвовать в хакатоне 🏆", callback_data=f"hackathon_join_{company_id}")
            keyboard.adjust(1)
            
            await self.bot.send_message(
                user_id,
                "⚠️ Внимание! Через 10 минут начнется хакатон!\n"
                "Успейте присоединиться, чтобы побороться за призы!",
                reply_markup=keyboard.as_markup()
            )

    async def start_hackathon(self):
        """Начинает хакатон"""
        if self.is_running:
            return

        self.is_running = True
        self.participants = {}
        self.company_scores = {}
        start_time = datetime.now()
        
        # Отправляем сообщение о начале
        cursor = self.db.cursor()
        cursor.execute('''
            SELECT DISTINCT ce.user_id
            FROM company_employees ce
            WHERE ce.status = 'active'
        ''')
        
        for user_id, in cursor.fetchall():
            await self.bot.send_message(
                user_id,
                "🏆 Хакатон начался!\n"
                "В течение часа будут собираться характеристики всех участников.\n"
                "Удачи!"
            )

        # Запускаем сбор характеристик
        await self.collect_stats(start_time)

    async def collect_stats(self, start_time: datetime):
        """Собирает характеристики участников каждую минуту"""
        duration = timedelta(minutes=HACKATHON_CONFIG["duration_minutes"])
        end_time = start_time + duration

        while datetime.now() < end_time:
            cursor = self.db.cursor()
            cursor.execute('''
                SELECT ce.user_id, ce.company_id, p.coding, p.testing, p.analytics, p.design, p.modeling
                FROM company_employees ce
                JOIN players p ON ce.user_id = p.user_id
                WHERE ce.status = 'active'
            ''')
            
            for user_id, company_id, coding, testing, analytics, design, modeling in cursor.fetchall():
                if company_id not in self.participants:
                    self.participants[company_id] = {}
                
                self.participants[company_id][user_id] = {
                    "coding": coding,
                    "testing": testing,
                    "analytics": analytics,
                    "design": design,
                    "modeling": modeling
                }

            await asyncio.sleep(60)  # Ждем 1 минуту

        # Завершаем хакатон
        await self.end_hackathon()

    async def end_hackathon(self):
        """Завершает хакатон и определяет победителей"""
        # Подсчитываем общие баллы для каждой компании
        for company_id, users in self.participants.items():
            total_score = 0
            for user_stats in users.values():
                total_score += sum(user_stats.values())
            self.company_scores[company_id] = total_score

        # Сортируем компании по баллам
        sorted_companies = sorted(
            self.company_scores.items(),
            key=lambda x: x[1],
            reverse=True
        )

        # Определяем победителей
        winners = []
        for i, (company_id, score) in enumerate(sorted_companies[:3]):
            cursor = self.db.cursor()
            cursor.execute('''
                SELECT c.company_data, ce.user_id
                FROM companies c
                JOIN company_employees ce ON c.company_id = ce.company_id
                WHERE c.company_id = ? AND ce.role = 'CEO'
            ''', (company_id,))
            
            company_data, ceo_id = cursor.fetchone()
            company = json.loads(company_data)
            
            # Начисляем награды
            reward = HACKATHON_CONFIG["rewards"][f"{i+1}_place"]
            company["balance"] += reward["gram"]
            company["experience"] += reward["exp"]
            
            # Обновляем данные компании
            cursor.execute('''
                UPDATE companies 
                SET company_data = ?
                WHERE company_id = ?
            ''', (json.dumps(company), company_id))
            
            winners.append({
                "company_name": company["name"],
                "ceo_id": ceo_id,
                "score": score,
                "reward": reward
            })

        # Отправляем результаты
        await self.send_hackathon_results(winners)
        
        self.is_running = False
        self.participants = {}
        self.company_scores = {}

    async def send_hackathon_results(self, winners: List[Dict]):
        """Отправляет результаты хакатона"""
        # Отправляем результаты всем участникам
        cursor = self.db.cursor()
        cursor.execute('''
            SELECT DISTINCT ce.user_id
            FROM company_employees ce
            WHERE ce.status = 'active'
        ''')
        
        results_text = "🏆 Результаты хакатона:\n\n"
        for i, winner in enumerate(winners, 1):
            results_text += f"{i}. {winner['company_name']} - {winner['score']} баллов\n"
            results_text += f"   Награда: {winner['reward']['gram']} Gram, {winner['reward']['exp']} опыта\n\n"
        
        for user_id, in cursor.fetchall():
            await self.bot.send_message(user_id, results_text)

    def get_hackathon_keyboard(self, company_id: int, is_ceo: bool) -> InlineKeyboardMarkup:
        """Создает клавиатуру для хакатона"""
        builder = InlineKeyboardBuilder()
        
        if is_ceo:
            builder.button(
                text="Участвовать в хакатоне 🏆",
                callback_data=f"hackathon_join_{company_id}"
            )
        elif company_id in self.participants:
            builder.button(
                text="Участвовать в хакатоне 🏆",
                callback_data=f"hackathon_join_{company_id}"
            )
        
        builder.button(text="🔙 Назад", callback_data="company_back")
        builder.adjust(1)
        
        return builder.as_markup()

    async def handle_hackathon_callback(self, callback_data: str, user_id: int):
        """Обрабатывает callback-запросы хакатона"""
        if not callback_data.startswith("hackathon_"):
            return

        action = callback_data.split("_")[1]
        company_id = int(callback_data.split("_")[2])

        if action == "join":
            if self.is_running:
                await self.bot.answer_callback_query(
                    callback_data,
                    "Хакатон уже начался!",
                    show_alert=True
                )
                return

            cursor = self.db.cursor()
            cursor.execute('''
                SELECT role 
                FROM company_employees 
                WHERE user_id = ? AND company_id = ? AND status = 'active'
            ''', (user_id, company_id))
            
            role = cursor.fetchone()
            if not role:
                await self.bot.answer_callback_query(
                    callback_data,
                    "Вы не являетесь сотрудником этой компании!",
                    show_alert=True
                )
                return

            is_ceo = role[0] == "CEO"
            if not is_ceo:
                await self.bot.answer_callback_query(
                    callback_data,
                    "Только CEO может зарегистрировать компанию на хакатон!",
                    show_alert=True
                )
                return

            # Регистрируем компанию на хакатон
            if company_id not in self.participants:
                self.participants[company_id] = {}
                await self.bot.answer_callback_query(
                    callback_data,
                    "Компания успешно зарегистрирована на хакатон!",
                    show_alert=True
                )
            else:
                await self.bot.answer_callback_query(
                    callback_data,
                    "Компания уже зарегистрирована на хакатон!",
                    show_alert=True
                ) 