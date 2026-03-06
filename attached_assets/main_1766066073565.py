import logging
import sqlite3
from datetime import datetime, timedelta
import json
import asyncio
from typing import Dict, Any
import random
from blueprints import GADGET_BLUEPRINTS, BLUEPRINT_STATUSES, GADGET_STATS, PRODUCTION_REQUIREMENTS, get_available_blueprints
from config import STAT_TRANSLATIONS
from aiogram.enums import ParseMode
from aiogram.client.default import DefaultBotProperties
from blueprint_development import (
    auto_update_company_blueprints, 
    get_lab_message_and_keyboard, 
    start_blueprint_development, 
    update_blueprint_progress,
    handle_develop_callback,
    handle_join_development_callback,
    update_progress_message,
    update_lab_messages_table,
    handle_refresh_lab
)
from aiogram import Bot, Dispatcher, Router, F
from aiogram.filters import Command, CommandStart, StateFilter
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import (
    Message, 
    CallbackQuery,
    InlineKeyboardMarkup,
    InlineKeyboardButton,
    ReplyKeyboardMarkup,
    KeyboardButton,
    ReplyKeyboardRemove
)
from aiogram.utils.keyboard import InlineKeyboardBuilder
from aiogram.fsm.storage.memory import MemoryStorage

import config
from database import get_db_connection, get_player_data, update_player_time, init_db, check_database_connection
from characters import CHARACTER_TYPES
from company import (
    Company, COMPANY_TYPES, WEEKLY_TASKS, PRODUCTION_LINES,
    HACKATHONS, create_company_tables, COMPANY_CREATION_COST, COMPANY_LEVELS
)
from parts import RARITY_LEVELS, ALL_PARTS
from items import tier_1_items, tier_2_items, INITIAL_GADGETS
from jobs import JOBS, CITIES
from bank import (
    BankAccount, BANK_OPERATIONS, exchange_to_gram, exchange_from_gram,
    create_bank_tables, can_create_credit, can_create_deposit, EXCHANGE_RATES
)
from bank_operations import (
    process_credit_operation,
    process_deposit_operation,
    calculate_credit_payment,
    calculate_deposit_income
)
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from bank_daily import process_daily_bank_operations, repay_credit_early
from scheduler import create_scheduler
from apscheduler.triggers.interval import IntervalTrigger
from stop_development_handler import router as stop_development_router
from blueprint_handlers import router as blueprint_handlers_router
from hackathon import HackathonManager

# Настройка логирования
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO,
    filename='bot_debug.log'
)
logger = logging.getLogger(__name__)

# Состояния FSM
class UserStates(StatesGroup):
    MAIN_MENU = State()
    ENTERING_NAME = State()
    CHOOSING_CITY = State()
    CHOOSING_CHARACTER = State()
    CHOOSING_JOB = State()
    CHOOSING_STUDY = State()
    CHANGING_CITY = State()
    CONFIRM_CITY_CHANGE = State()
    BANK_OPERATION = State()
    ENTERING_AMOUNT = State()
    ENTERING_DAYS = State()
    CHOOSING_CREDIT_TYPE = State()
    CHOOSING_DEPOSIT_TYPE = State()
    CONFIRM_OPERATION = State()
    COMPANY_MENU = State()
    CREATING_COMPANY = State()
    JOINING_COMPANY = State()
    ENTERING_COMPANY_NAME = State()
    COMPANY_ADD_FUNDS = State()  # Новое состояние для пополнения баланса компании
    SETTING_SALARY = State()  # Новое состояние для установки зарплаты
    ENTERING_SALARY = State()  # Состояние для ввода суммы зарплаты

# Кнопки главного меню
BUTTON_WORK = "💼 Работа"
BUTTON_STUDY = "📚 Учеба"
BUTTON_CITY = "🌆 Город"
BUTTON_COMPANY = "🏢 Компания"
BUTTON_BANK = "🏦 Банк"

def get_main_keyboard() -> ReplyKeyboardMarkup:
    """Возвращает основную клавиатуру"""
    keyboard = [
        [KeyboardButton(text=BUTTON_WORK), KeyboardButton(text=BUTTON_STUDY)],
        [KeyboardButton(text=BUTTON_CITY), KeyboardButton(text=BUTTON_COMPANY)],
        [KeyboardButton(text=BUTTON_BANK)]
    ]
    return ReplyKeyboardMarkup(keyboard=keyboard, resize_keyboard=True)

# Роутер для основных команд
router = Router()

@router.message(CommandStart())
async def cmd_start(message: Message, state: FSMContext) -> None:
    """Начало разговора и создание профиля пользователя"""
    user = message.from_user
    
    # Проверяем подключение к базе данных
    if not check_database_connection():
        await message.reply(
            "Извините, сервис временно недоступен. Попробуйте позже."
        )
        return
    
    conn = None
    try:
        conn = sqlite3.connect(config.DATABASE_NAME)
        cursor = conn.cursor()
        
        # Проверяем существование игрока
        cursor.execute('''
        SELECT display_name, balance, exp, level, stats, current_city,
               character_type, work_time_left, study_time_left, last_work_update,
               last_study_update, inventory, parts_storage, equipped_gadgets
        FROM players WHERE user_id = ?
        ''', (user.id,))
        player = cursor.fetchone()
        
        if not player:
            await message.reply(
                "Добро пожаловать в игру! 🎮\n"
                "Давайте начнем регистрацию.\n\n"
                "Как вас зовут? Введите ваше имя:"
            )
            await state.set_state(UserStates.ENTERING_NAME)
        else:
            display_name, balance, exp, level, stats_json, city, \
            character_type, work_time, study_time, last_work_update, \
            last_study_update, inventory_json, parts_storage_json, equipped_gadgets_json = player
            
            # Обновляем время перед показом
            work_time, study_time = update_player_time(user.id, conn)
            
            # Форматируем профиль
            profile_text = format_full_profile(
                display_name=display_name,
                character_type=character_type,
                city=city,
                balance=balance,
                level=level,
                exp=exp,
                stats=json.loads(stats_json),
                work_time=work_time,
                study_time=study_time,
                inventory=json.loads(inventory_json),
                parts_storage=json.loads(parts_storage_json),
                equipped_gadgets=json.loads(equipped_gadgets_json) if equipped_gadgets_json else {},
                gram_balance=0
            )
            
            await message.reply(
                f"С возвращением!\n\n{profile_text}",
                reply_markup=get_main_keyboard()
            )
            await state.set_state(UserStates.MAIN_MENU)
            
    except sqlite3.Error as e:
        logger.error(f"Database error in start command: {e}")
        await message.reply(
            "Произошла ошибка при работе с базой данных. Попробуйте позже."
        )
    except Exception as e:
        logger.error(f"Error in start command: {e}")
        await message.reply(
            "Произошла непредвиденная ошибка. Попробуйте позже."
        )
    finally:
        if conn:
            conn.close()

@router.message(UserStates.ENTERING_NAME)
async def process_name(message: Message, state: FSMContext) -> None:
    """Обработка введенного имени"""
    display_name = message.text
    await state.update_data(display_name=display_name)
    
    # Создаем клавиатуру с городами
    builder = InlineKeyboardBuilder()
    for city, city_info in CITIES.items():
        builder.button(
            text=f"{city} ({city_info['currency_symbol']})",
            callback_data=f"reg_city_{city}"
        )
    builder.adjust(1)
    
    await message.reply(
        f"Приятно познакомиться, {display_name}! 👋\n"
        "Теперь выберите город, в котором хотите начать свой путь:\n\n"
        "Доступные города:",
        reply_markup=builder.as_markup()
    )
    await state.set_state(UserStates.CHOOSING_CITY)

@router.callback_query(UserStates.CHOOSING_CITY, F.data.startswith("reg_city_"))
async def process_city_selection(callback: CallbackQuery, state: FSMContext) -> None:
    """Обработка выбора города"""
    await callback.answer()
    city = callback.data.replace("reg_city_", "")
    await state.update_data(city=city)
    
    # Создаем клавиатуру с характерами
    builder = InlineKeyboardBuilder()
    for char_name, char_info in CHARACTER_TYPES.items():
        builder.button(
            text=f"{char_info['icon']} {char_name}",
            callback_data=f"char_{char_name}"
        )
    builder.adjust(1)
    
    character_text = "\n".join([
        f"{info['icon']} {name}: {info['description']}"
        for name, info in CHARACTER_TYPES.items()
    ])
    
    await callback.message.edit_text(
        f"Отличный выбор! Вы будете жить в городе {city}.\n\n"
        "Теперь выберите свой характер:\n\n"
        f"{character_text}",
        reply_markup=builder.as_markup()
    )
    await state.set_state(UserStates.CHOOSING_CHARACTER)

@router.callback_query(UserStates.CHOOSING_CHARACTER, F.data.startswith("char_"))
async def process_character_selection(callback: CallbackQuery, state: FSMContext) -> None:
    """Обработка выбора характера и завершение регистрации"""
    await callback.answer()
    
    # Получаем данные из состояния
    data = await state.get_data()
    display_name = data['display_name']
    city = data['city']
    character = callback.data.replace("char_", "")
    
    # Создаем начальные характеристики с учетом характера
    initial_stats = config.INITIAL_STATS.copy()
    if character == "Гений":
        initial_stats = {k: int(v * CHARACTER_TYPES[character]["bonus"]["stats_multiplier"]) 
                        for k, v in initial_stats.items()}
    
    conn = sqlite3.connect(config.DATABASE_NAME)
    cursor = conn.cursor()
    
    try:
        # Создаем нового игрока
        initial_stats_json = json.dumps(initial_stats)
        initial_inventory = json.dumps({})
        initial_parts = json.dumps({})
        initial_equipped_gadgets = json.dumps({})
        current_time = datetime.now().isoformat()
        
        cursor.execute('''
        INSERT INTO players (
            user_id, username, display_name, balance, exp, level,
            stats, inventory, parts_storage, equipped_gadgets,
            work_time_left, current_city, character_type,
            specialization, study_time_left, last_work_update,
            last_study_update
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            callback.from_user.id,
            callback.from_user.username,
            display_name,
            1000,  # начальный баланс
            0,     # начальный опыт
            1,     # начальный уровень
            initial_stats_json,
            initial_inventory,
            initial_parts,
            initial_equipped_gadgets,
            1200,   # 20 минут на работу
            city,
            character,
            None,   # специализация
            1200,   # 20 минут на учебу
            current_time,
            current_time
        ))
        
        conn.commit()
        
        # Форматируем профиль
        profile_text = format_full_profile(
            display_name=display_name,
            character_type=character,
            city=city,
            balance=1000,
            level=1,
            exp=0,
            stats=initial_stats,
            work_time=1200,
            study_time=1200,
            inventory=json.loads(initial_inventory),
            parts_storage=json.loads(initial_parts)
        )
        
        # Отправляем сообщение с профилем и клавиатурой
        await callback.message.answer(
            "Регистрация завершена! Вот ваш профиль:\n\n" + profile_text,
            reply_markup=get_main_keyboard()
        )
        await callback.message.edit_text("✅ Регистрация успешно завершена!")
        
        await state.set_state(UserStates.MAIN_MENU)
        
        logger.info(f"New player registered: {display_name} (ID: {callback.from_user.id})")
        
    except Exception as e:
        logger.error(f"Error during character selection: {e}")
        await callback.message.edit_text(
            "Произошла ошибка при создании профиля. Пожалуйста, попробуйте /start снова."
        )
    finally:
        conn.close()

def format_full_profile(
    display_name: str,
    character_type: str,
    city: str,
    balance: int,
    level: int,
    exp: int,
    stats: dict,
    work_time: int,
    study_time: int,
    inventory: dict = None,
    parts_storage: dict = None,
    equipped_gadgets: dict = None,
    gram_balance: float = 0.0
) -> str:
    """Форматирует полный профиль игрока"""
    rank = get_rank(level)
    city_info = CITIES[city]
    currency_symbol = city_info["currency_symbol"]
    
    current_level_exp = calculate_exp_for_level(level)
    next_level_exp = calculate_exp_for_level(level + 1)
    
    level_exp_diff = next_level_exp - current_level_exp
    current_level_progress = exp - current_level_exp
    exp_percentage = max(0, min(100, (current_level_progress / level_exp_diff) * 100))
    
    progress_count = int((exp_percentage / 100) * 20)
    exp_bar = "■" * progress_count + "□" * (20 - progress_count)
    
    work_minutes = work_time // 60
    work_seconds = work_time % 60
    study_minutes = study_time // 60
    study_seconds = study_time % 60
    
    gadget_count = 0
    parts_count = 0
    if inventory:
        for item_id in inventory:
            if item_id.startswith('G'):  # Гаджеты
                gadget_count += inventory[item_id]
            else:  # Запчасти
                parts_count += inventory[item_id]
    
    profile_text = f"""👤 Профиль игрока: {display_name}

🎭 Характер: {character_type} {CHARACTER_TYPES[character_type]['icon']}
🌆 Текущий город: {city_info['description']}
💰 Баланс: {balance} {currency_symbol}
💎 Gram: {gram_balance:,.3f}

📊 Прогресс уровня:
Уровень {level} {config.RANK_EMOJIS[rank]}
🟡 [{exp_bar}] {exp_percentage:.1f}%
⭐️ Опыт: {exp}/{next_level_exp}
🎖️ Ранг: {rank}

⏰ Оставшееся время:
📚 Учеба: {study_minutes:02d}:{study_seconds:02d}
💼 Работа: {work_minutes:02d}:{work_seconds:02d}

🎒 Инвентарь:
📱 Гаджеты: {gadget_count}/5
🔧 Запчасти: {parts_count}/20"""

    if inventory:
        profile_text += "\n/inv"
    
    profile_text += """

🎯 Характеристики:"""

    # Добавляем базовые характеристики
    for stat, value in stats.items():
        profile_text += f"\n{config.STAT_TRANSLATIONS[stat]}: {value}"
    
    # Добавляем бонусы от надетых гаджетов
    if equipped_gadgets:
        profile_text += "\n\n📱 Бонусы от гаджетов:"
        for gadget_id, gadget_info in equipped_gadgets.items():
            profile_text += f"\n{gadget_info['name']}:"
            for stat, value in gadget_info['stats'].items():
                profile_text += f"\n  • {config.STAT_TRANSLATIONS[stat]}: +{value}"
    
    profile_text += f"\n\n💫 Бонус характера:\n{CHARACTER_TYPES[character_type]['description']}"
    
    return profile_text

def format_gadget_info(blueprint_name: str, gadget_type: str, completion_date: str) -> str:
    """Форматирует информацию о гаджете для отображения"""
    blueprint_data = GADGET_BLUEPRINTS.get(gadget_type, {}).get(blueprint_name, {})
    
    # Форматируем характеристики
    stats = blueprint_data.get("stats", {})
    stats_text = ", ".join([f"{stat} +{value}" for stat, value in stats.items()])
    
    # Форматируем бонусы
    bonuses = blueprint_data.get("bonuses", {})
    bonuses_text = ", ".join([f"{bonus} +{value}%" for bonus, value in bonuses.items()])
    
    # Форматируем детали
    parts = blueprint_data.get("production", {}).get("parts", {})
    parts_text = ", ".join([f"{part}({qty})" for part, qty in parts.items()])
    
    # Форматируем стоимость
    cost = blueprint_data.get("production", {}).get("cost_gram", 0)
    
    return (
        f"🔹 {blueprint_name}\n"
        f"📱 Тип: {gadget_type} | 📅 {completion_date}\n"
        f"📊 Хар-ки: {stats_text}\n"
        f"🎁 Бонусы: {bonuses_text}\n"
        f"🛠 Производство: {cost} Gram\n"
        f"📦 Детали: {parts_text}"
    )

def format_work_profile(
    display_name: str,
    balance: int,
    level: int,
    exp: int,
    work_time: int,
    inventory: dict,
    parts_storage: dict,
    currency_symbol: str
) -> str:
    """Форматирует профиль игрока после выполнения работы"""
    rank = get_rank(level)
    current_level_exp = calculate_exp_for_level(level)
    next_level_exp = calculate_exp_for_level(level + 1)
    
    level_exp_diff = next_level_exp - current_level_exp
    current_level_progress = exp - current_level_exp
    exp_percentage = max(0, min(100, (current_level_progress / level_exp_diff) * 100))
    
    progress_count = int((exp_percentage / 100) * 20)
    exp_bar = "■" * progress_count + "□" * (20 - progress_count)
    
    work_minutes = work_time // 60
    work_seconds = work_time % 60
    
    gadget_count = 0
    parts_count = 0
    if inventory:
        for item_id in inventory:
            if item_id.startswith('G'):  # Гаджеты
                gadget_count += inventory[item_id]
            else:  # Запчасти
                parts_count += inventory[item_id]
    
    profile_text = f"""👤 Профиль после работы:

💰 Баланс: {balance} {currency_symbol}
📊 Прогресс уровня:
Уровень {level} {config.RANK_EMOJIS[rank]}
🟡 [{exp_bar}] {exp_percentage:.1f}%
⭐️ Опыт: {exp}/{next_level_exp}
🎖️ Ранг: {rank}

⏰ Оставшееся время работы:
💼 {work_minutes:02d}:{work_seconds:02d}

🎒 Инвентарь:
📱 Гаджеты: {gadget_count}/5
🔧 Запчасти: {parts_count}/20"""
    
    return profile_text

def format_study_profile(
    display_name: str,
    balance: int,
    work_time: int,
    stats: dict,
    currency_symbol: str
) -> str:
    """Форматирует профиль игрока после обучения"""
    work_minutes = work_time // 60
    work_seconds = work_time % 60
    
    profile_text = f"""👤 Профиль после обучения:

💰 Баланс: {balance} {currency_symbol}

⏰ Оставшееся время работы:
💼 {work_minutes:02d}:{work_seconds:02d}

🎯 Характеристики:"""

    for stat, value in stats.items():
        stat_percentage = (value % 1) * 100 if value >= 1 else (value * 100)
        stat_progress = int((stat_percentage / 100) * 10)
        stat_bar = "■" * stat_progress + "□" * (10 - stat_progress)
        color = "🟢" if stat_percentage == 100 else "🟡"
        
        profile_text += f"\n{config.STAT_TRANSLATIONS[stat]}: {value}"
        profile_text += f"\n{color} [{stat_bar}] {stat_percentage:.1f}%"
    
    return profile_text

@router.message(Command("profile"))
async def cmd_profile(message: Message) -> None:
    """Показывает профиль игрока"""
    user = message.from_user
    
    if not check_database_connection():
        await message.reply(
            "Извините, сервис временно недоступен. Попробуйте позже."
        )
        return
    
    conn = None
    try:
        conn = sqlite3.connect(config.DATABASE_NAME)
        cursor = conn.cursor()
        
        # Получаем данные игрока
        cursor.execute('''
        SELECT display_name, balance, exp, level, stats, current_city,
               character_type, work_time_left, study_time_left, last_work_update,
               last_study_update, inventory, parts_storage, equipped_gadgets,
               gram_balance
        FROM players WHERE user_id = ?
        ''', (user.id,))
        player = cursor.fetchone()
        
        if not player:
            await message.reply(
                "Профиль не найден. Используйте /start для создания персонажа."
            )
            return
            
        display_name, balance, exp, level, stats_json, city, \
        character_type, work_time, study_time, last_work_update, \
        last_study_update, inventory_json, parts_storage_json, equipped_gadgets_json, \
        gram_balance = player
        
        work_time, study_time = update_player_time(user.id, conn)
        
        profile_text = format_full_profile(
            display_name=display_name,
            character_type=character_type,
            city=city,
            balance=balance,
            level=level,
            exp=exp,
            stats=json.loads(stats_json),
            work_time=work_time,
            study_time=study_time,
            inventory=json.loads(inventory_json),
            parts_storage=json.loads(parts_storage_json),
            equipped_gadgets=json.loads(equipped_gadgets_json) if equipped_gadgets_json else {},
            gram_balance=gram_balance
        )
        
        await message.reply(profile_text)
        
    except sqlite3.Error as e:
        logger.error(f"Database error in profile command: {e}")
        await message.reply(
            "Произошла ошибка при работе с базой данных. Попробуйте позже."
        )
    except Exception as e:
        logger.error(f"Error in profile command: {e}")
        await message.reply(
            "Произошла непредвиденная ошибка. Попробуйте позже."
        )
    finally:
        if conn:
            conn.close()

@router.message(Command("inventory"))
async def cmd_inventory(message: Message) -> None:
    """Показывает инвентарь игрока"""
    user = message.from_user
    
    conn = sqlite3.connect(config.DATABASE_NAME)
    cursor = conn.cursor()
    
    try:
        cursor.execute('''
        SELECT inventory, parts_storage, equipped_gadgets, current_city
        FROM players WHERE user_id = ?
        ''', (user.id,))
        player = cursor.fetchone()
        
        if not player:
            await message.reply(
                "Профиль не найден. Используйте /start для создания персонажа."
            )
            return
            
        inventory_json, parts_storage_json, equipped_gadgets_json, current_city = player
        inventory = json.loads(inventory_json)
        parts_storage = json.loads(parts_storage_json)
        equipped_gadgets = json.loads(equipped_gadgets_json) if equipped_gadgets_json else {}
        
        # Разделяем инвентарь на гаджеты и запчасти
        gadgets = []
        parts = []
        
        for item_id, count in inventory.items():
            item_info = parts_storage.get(item_id, {})
            if item_id.startswith('G'):  # Гаджеты
                is_equipped = item_id in equipped_gadgets
                action = "/rem" if is_equipped else "/eq"
                gadgets.append(f"📱 {item_info.get('name', 'Неизвестный гаджет')} ({item_info.get('rarity', 'Unknown')}) x{count} {action}")
            else:  # Все остальное - запчасти
                parts.append(f"🔧 {item_info.get('name', 'Неизвестная запчасть')} ({item_info.get('rarity', 'Unknown')}) x{count}")
        
        # Подсчитываем общее количество
        total_gadgets = sum(inventory.get(item_id, 0) for item_id in inventory 
                          if item_id.startswith('G'))
        total_parts = sum(inventory.get(item_id, 0) for item_id in inventory 
                         if not item_id.startswith('G'))
        
        inventory_text = f"""🎒 Инвентарь игрока:

📱 Гаджеты ({total_gadgets}/5):
{"Нет гаджетов" if not gadgets else "\n".join(gadgets)}

🔧 Запчасти ({total_parts}/20):
{"Нет запчастей" if not parts else "\n".join(parts)}"""
        
        await message.reply(inventory_text)
        
    except Exception as e:
        logger.error(f"Error in inventory command: {e}")
        await message.reply("Произошла ошибка при получении инвентаря. Попробуйте позже.")
    finally:
        conn.close()

@router.message(Command("inv"))
async def cmd_inv(message: Message) -> None:
    """Алиас для команды /inventory"""
    await cmd_inventory(message)
@router.message(Command("eq"))
async def cmd_equip(message: Message) -> None:
    """Надевает гаджет"""
    user = message.from_user
    
    conn = sqlite3.connect(config.DATABASE_NAME)
    cursor = conn.cursor()
    
    try:
        # Получаем данные игрока
        cursor.execute('''
        SELECT inventory, parts_storage, equipped_gadgets, stats
        FROM players WHERE user_id = ?
        ''', (user.id,))
        inventory_json, parts_storage_json, equipped_gadgets_json, stats_json = cursor.fetchone()
        
        inventory = json.loads(inventory_json)
        parts_storage = json.loads(parts_storage_json)
        equipped_gadgets = json.loads(equipped_gadgets_json) if equipped_gadgets_json else {}
        stats = json.loads(stats_json)
        
        # Находим первый ненадетый гаджет
        gadget_to_equip = None
        for item_id, count in inventory.items():
            if item_id.startswith('G') and item_id not in equipped_gadgets:
                gadget_to_equip = item_id
                break
        
        if not gadget_to_equip:
            await message.reply("У вас нет доступных гаджетов для надевания!")
            return
        
        # Получаем информацию о гаджете
        gadget_info = parts_storage.get(gadget_to_equip, {})
        
        # Добавляем гаджет в надетые
        equipped_gadgets[gadget_to_equip] = gadget_info
        
        # Добавляем характеристики гаджета к характеристикам игрока
        for stat, value in gadget_info['stats'].items():
            if stat not in stats:
                stats[stat] = 0
            stats[stat] += value
        
        # Обновляем данные в базе
        cursor.execute('''
        UPDATE players 
        SET equipped_gadgets = ?,
            stats = ?
        WHERE user_id = ?
        ''', (json.dumps(equipped_gadgets), json.dumps(stats), user.id))
        
        conn.commit()
        
        await message.reply(f"✅ Гаджет {gadget_info['name']} успешно надет!")
        
    except Exception as e:
        logger.error(f"Error in equip command: {e}")
        await message.reply("Произошла ошибка при надевании гаджета. Попробуйте позже.")
    finally:
        conn.close()

@router.message(Command("rem"))
async def cmd_remove(message: Message) -> None:
    """Снимает гаджет"""
    user = message.from_user
    
    conn = sqlite3.connect(config.DATABASE_NAME)
    cursor = conn.cursor()
    
    try:
        # Получаем данные игрока
        cursor.execute('''
        SELECT inventory, parts_storage, equipped_gadgets, stats
        FROM players WHERE user_id = ?
        ''', (user.id,))
        inventory_json, parts_storage_json, equipped_gadgets_json, stats_json = cursor.fetchone()
        
        inventory = json.loads(inventory_json)
        parts_storage = json.loads(parts_storage_json)
        equipped_gadgets = json.loads(equipped_gadgets_json) if equipped_gadgets_json else {}
        stats = json.loads(stats_json)
        
        # Находим первый надетый гаджет
        gadget_to_remove = None
        for item_id in equipped_gadgets:
            if item_id.startswith('G'):
                gadget_to_remove = item_id
                break
        
        if not gadget_to_remove:
            await message.reply("У вас нет надетых гаджетов!")
            return
        
        # Получаем информацию о гаджете
        gadget_info = parts_storage.get(gadget_to_remove, {})
        
        # Удаляем гаджет из надетых
        del equipped_gadgets[gadget_to_remove]
        
        # Убираем характеристики гаджета из характеристик игрока
        for stat, value in gadget_info['stats'].items():
            if stat in stats:
                stats[stat] -= value
        
        # Обновляем данные в базе
        cursor.execute('''
        UPDATE players 
        SET equipped_gadgets = ?,
            stats = ?
        WHERE user_id = ?
        ''', (json.dumps(equipped_gadgets), json.dumps(stats), user.id))
        
        conn.commit()
        
        await message.reply(f"✅ Гаджет {gadget_info['name']} успешно снят!")
        
    except Exception as e:
        logger.error(f"Error in remove command: {e}")
        await message.reply("Произошла ошибка при снятии гаджета. Попробуйте позже.")
    finally:
        conn.close()

# Обработчик кнопок главного меню
@router.message(UserStates.MAIN_MENU)
async def handle_menu_button(message: Message, state: FSMContext) -> None:
    """Обрабатывает нажатия на кнопки главного меню"""
    text = message.text
    
    if text == BUTTON_WORK:
        await work_command(message, state)
    elif text == BUTTON_STUDY:
        await study_command(message, state)
    elif text == BUTTON_CITY:
        await change_city_command(message, state)
    elif text == BUTTON_COMPANY:
        await company_command(message, state)
    elif text == BUTTON_BANK:
        await bank_command(message, state)

async def work_command(message: Message, state: FSMContext) -> None:
    """Показывает список доступных работ в текущем городе игрока"""
    user = message.from_user
    
    # Проверяем существование профиля игрока
    conn = sqlite3.connect(config.DATABASE_NAME)
    cursor = conn.cursor()
    
    cursor.execute('SELECT current_city, level FROM players WHERE user_id = ?', (user.id,))
    player = cursor.fetchone()
    
    if not player:
        await message.reply(
            "Для начала работы необходимо создать профиль. Используйте /start",
            reply_markup=get_main_keyboard()
        )
        await state.set_state(UserStates.MAIN_MENU)
        conn.close()
        return
    
    current_city, player_level = player
    city_info = CITIES[current_city]
    city_jobs = JOBS[current_city]
    rank = get_rank(player_level)
    
    # Создаем клавиатуру с работами текущего города
    builder = InlineKeyboardBuilder()
    for job_title, job_info in city_jobs.items():
        # Добавляем работу только если ранг подходит
        if job_info["rank_required"] == rank:
            builder.button(
                text=f"{job_title} ({job_info['reward']} {city_info['currency_symbol']})",
                callback_data=f"job_{job_title}"
            )
    builder.adjust(1)
    
    if not builder.buttons:
        await message.reply(
            f"В городе {current_city} нет работ для вашего ранга ({rank})",
            reply_markup=get_main_keyboard()
        )
        await state.set_state(UserStates.MAIN_MENU)
        conn.close()
        return
    
    await message.reply(
        f"💼 Доступные вакансии в городе {current_city}:\n"
        f"Специализация города: {city_info['specialization']}\n"
        f"Валюта: {city_info['currency_symbol']}\n"
        f"Ваш ранг: {rank} {config.RANK_EMOJIS[rank]}",
        reply_markup=builder.as_markup()
    )
    
    conn.close()
    await state.set_state(UserStates.CHOOSING_JOB)

@router.callback_query(UserStates.CHOOSING_JOB, F.data.startswith("job_"))
async def process_job_selection(callback: CallbackQuery, state: FSMContext) -> None:
    """Обработка выбора работы"""
    try:
        await callback.answer()
        
        job_title = callback.data.replace("job_", "")
        if job_title == "repeat":
            data = await state.get_data()
            if 'last_job' not in data:
                await callback.message.answer(
                    "Не найдена предыдущая работа",
                    reply_markup=get_main_keyboard()
                )
                await state.set_state(UserStates.MAIN_MENU)
                return
            job_title = data['last_job']
        else:
            await state.update_data(last_job=job_title)
        
        conn = sqlite3.connect(config.DATABASE_NAME)
        cursor = conn.cursor()
        
        try:
            cursor.execute('''
            SELECT level, stats, character_type, current_city, inventory, parts_storage 
            FROM players WHERE user_id = ?
            ''', (callback.from_user.id,))
            player_data = cursor.fetchone()
            
            if not player_data:
                logger.error(f"Player not found for user_id: {callback.from_user.id}")
                await callback.message.answer(
                    "Ошибка: профиль не найден",
                    reply_markup=get_main_keyboard()
                )
                await state.set_state(UserStates.MAIN_MENU)
                return
                
            player_level, stats_json, character_type, current_city, inventory_json, parts_storage_json = player_data
            
            if current_city not in JOBS:
                logger.error(f"City {current_city} not found in JOBS")
                await callback.message.answer(
                    f"Ошибка: город {current_city} не найден в списке работ",
                    reply_markup=get_main_keyboard()
                )
                await state.set_state(UserStates.MAIN_MENU)
                return
                
            if job_title not in JOBS[current_city]:
                logger.error(f"Job {job_title} not found in city {current_city}")
                await callback.message.answer(
                    f"Ошибка: работа '{job_title}' не найдена в городе {current_city}",
                    reply_markup=get_main_keyboard()
                )
                await state.set_state(UserStates.MAIN_MENU)
                return
                
            job_info = JOBS[current_city][job_title]
            stats = json.loads(stats_json)
            rank = get_rank(player_level)
            
            if job_info["rank_required"] != rank:
                await callback.message.answer(
                    f"Для этой работы требуется ранг {job_info['rank_required']}, а у вас {rank}",
                    reply_markup=get_main_keyboard()
                )
                await state.set_state(UserStates.MAIN_MENU)
                return
            
            for stat, required_value in job_info["min_stats"].items():
                if stats.get(stat, 0) < required_value:
                    await callback.message.answer(
                        f"Для этой работы требуется {config.STAT_TRANSLATIONS[stat]} не менее {required_value}",
                        reply_markup=get_main_keyboard()
                    )
                    await state.set_state(UserStates.MAIN_MENU)
                    return
            
            if not consume_work_time(callback.from_user.id, 180, conn):
                await callback.message.answer(
                    "У вас недостаточно рабочего времени! ⏰\n"
                    "Время восстанавливается автоматически: 6 минут игрового времени за 1 минуту реального.",
                    reply_markup=get_main_keyboard()
                )
                await state.set_state(UserStates.MAIN_MENU)
                return

            failure_chance = 0.1
            for stat, required_value in job_info["min_stats"].items():
                current_value = stats.get(stat, 0)
                if current_value > required_value:
                    failure_chance -= 0.02 * (current_value - required_value)
            failure_chance = max(0.01, min(0.5, failure_chance))

            if random.random() < failure_chance:
                # Получаем обновленные данные для профиля
                cursor.execute('''
                SELECT display_name, balance, exp, level, work_time_left,
                       inventory, parts_storage
                FROM players WHERE user_id = ?
                ''', (callback.from_user.id,))
                player = cursor.fetchone()
                
                display_name, balance, exp, level, work_time, inventory_json, parts_storage_json = player
                
                # Форматируем профиль после неудачи
                profile_text = format_work_profile(
                    display_name=display_name,
                    balance=balance,
                    level=level,
                    exp=exp,
                    work_time=work_time,
                    inventory=json.loads(inventory_json),
                    parts_storage=json.loads(parts_storage_json),
                    currency_symbol=CITIES[current_city]["currency_symbol"]
                )
                
                # Добавляем кнопки
                builder = InlineKeyboardBuilder()
                builder.button(text="🔄 Еще раз", callback_data="job_repeat")
                builder.button(text="🔙 В меню", callback_data="return_to_menu")
                builder.adjust(2)
                
                await callback.message.answer(
                    f"❌ Вы не справились с работой!\n"
                    f"Шанс провала был: {failure_chance:.0%}\n"
                    "Попробуйте улучшить свои характеристики или выбрать работу попроще.\n\n"
                    f"{profile_text}",
                    reply_markup=builder.as_markup()
                )
                await callback.message.answer(
                    "Выберите действие:",
                    reply_markup=get_main_keyboard()
                )
                return

            reward = job_info["reward"]
            exp_reward = job_info["exp_reward"]
            
            if character_type == "Трудоголик":
                exp_reward = int(exp_reward * CHARACTER_TYPES[character_type]["bonus"]["exp_multiplier"])
            elif character_type == "Бизнесмен":
                reward = int(reward * CHARACTER_TYPES[character_type]["bonus"]["money_multiplier"])
            elif character_type == "Счастливчик" and random.random() < 0.2:
                reward = int(reward * CHARACTER_TYPES[character_type]["bonus"]["luck_multiplier"])
                exp_reward = int(exp_reward * CHARACTER_TYPES[character_type]["bonus"]["luck_multiplier"])

            available_parts = []
            for part_id, part_info in ALL_PARTS.items():
                if random.random() * 100 <= part_info["drop_chance"]:
                    available_parts.append((part_id, part_info))

            part_reward = None
            if available_parts:
                part_id, part_info = random.choice(available_parts)
                
                inventory = json.loads(inventory_json)
                parts_storage = json.loads(parts_storage_json)
                
                # Подсчитываем текущее количество предметов
                gadget_count = sum(inventory.get(item_id, 0) for item_id in inventory 
                                 if item_id.startswith('G'))
                parts_count = sum(inventory.get(item_id, 0) for item_id in inventory 
                                if not item_id.startswith('G'))
                
                can_add = False
                if part_id.startswith('G'):
                    if gadget_count < 5:
                        can_add = True
                else:
                    if parts_count < 20:
                        can_add = True
                
                if can_add:
                    if part_id not in inventory:
                        inventory[part_id] = 0
                    inventory[part_id] += 1
                    
                    if part_id not in parts_storage:
                        parts_storage[part_id] = part_info
                    
                    part_reward = part_info
                else:
                    # Добавляем сообщение о потере предмета
                    result_text = f"""❌ Вы получили {part_info['name']} ({part_info['rarity']}), 
но ваш инвентарь переполнен! Предмет потерян."""
            
            cursor.execute('''
            UPDATE players 
            SET balance = balance + ?,
                exp = exp + ?,
                inventory = ?,
                parts_storage = ?
            WHERE user_id = ?
            ''', (reward, exp_reward, 
                  json.dumps(inventory), json.dumps(parts_storage),
                  callback.from_user.id))
            
            cursor.execute('''
            SELECT display_name, exp, balance, level, work_time_left,
                   inventory, parts_storage
            FROM players WHERE user_id = ?
            ''', (callback.from_user.id,))
            player = cursor.fetchone()
            
            display_name, current_exp, current_balance, current_level, work_time, \
            inventory_json, parts_storage_json = player
            
            next_level_exp = calculate_exp_for_level(current_level + 1)
            
            leveled_up, level_data = update_player_level(callback.from_user.id, current_exp, conn)
            
            conn.commit()
            
            city_info = CITIES[current_city]
            currency_symbol = city_info["currency_symbol"]
            
            # Формируем сообщение о результате работы
            result_text = f"""✅ Вы успешно справились с работой!
Получено: {reward} {currency_symbol}
Опыт: +{exp_reward} ⭐️
Ваш опыт: {current_exp}/{next_level_exp}
Ваш баланс: {current_balance} {currency_symbol}"""

            if part_reward:
                result_text += f"\n\n🎁 Вы получили запчасть:\n{part_reward['name']} ({part_reward['rarity']})"
            
            if leveled_up:
                result_text += f"""

🎉 Поздравляем! Вы достигли уровня {level_data['level']}!

Получены бонусы:
💰 Деньги: +{level_data['money_bonus']} {currency_symbol}
📊 Все характеристики: +{level_data['stats_increase']}
⏰ Время работы и учебы полностью восстановлено!"""
            
            # Форматируем профиль после работы
            profile_text = format_work_profile(
                display_name=display_name,
                balance=current_balance,
                level=current_level,
                exp=current_exp,
                work_time=work_time,
                inventory=json.loads(inventory_json),
                parts_storage=json.loads(parts_storage_json),
                currency_symbol=currency_symbol
            )
            
            # Добавляем кнопки
            builder = InlineKeyboardBuilder()
            builder.button(text="🔄 Еще раз", callback_data="job_repeat")
            builder.button(text="🔙 В меню", callback_data="return_to_menu")
            builder.adjust(2)
            
            # Отправляем сообщение с результатом и профилем
            await callback.message.answer(
                f"{result_text}\n\n{profile_text}",
                reply_markup=builder.as_markup()
            )
            await callback.message.answer(
                "Выберите действие:",
                reply_markup=get_main_keyboard()
            )
            
        except Exception as e:
            logger.error(f"Error in process_job_selection: {e}")
            await callback.message.answer(
                "Произошла ошибка при выполнении работы. Попробуйте еще раз.",
                reply_markup=get_main_keyboard()
            )
        finally:
            conn.close()            
    except Exception as e:
        logger.error(f"Critical error in process_job_selection: {e}")
        await callback.message.answer(
            "Произошла критическая ошибка. Пожалуйста, попробуйте позже.",
            reply_markup=get_main_keyboard()
        )

async def study_command(message: Message, state: FSMContext) -> None:
    """Показывает доступные варианты учебы"""
    user = message.from_user
    conn = sqlite3.connect(config.DATABASE_NAME)
    cursor = conn.cursor()
    
    # Получаем текущий город игрока
    cursor.execute('SELECT current_city, stats FROM players WHERE user_id = ?', (user.id,))
    current_city, stats_json = cursor.fetchone()
    stats = json.loads(stats_json)
    
    # Создаем клавиатуру с вариантами учебы
    builder = InlineKeyboardBuilder()
    study_options = []
    
    # Добавляем варианты учебы в зависимости от города
    if current_city == "Сан-Франциско":
        study_options = [
            ("Курсы iOS разработки", "coding", 2),
            ("Курсы UI/UX дизайна", "design", 1)
        ]
    elif current_city == "Сингапур":
        study_options = [
            ("Курсы тестирования", "testing", 2),
            ("Курсы аналитики", "analytics", 1)
        ]
    elif current_city == "Санкт-Петербург":
        study_options = [
            ("Курсы дизайна", "design", 2),
            ("Курсы моделирования", "modeling", 1)
        ]
    
    for name, stat, cost in study_options:
        current_level = stats.get(stat, 0)
        builder.button(
            text=f"{name} (Уровень {current_level}) - {cost} мин",
            callback_data=f"study_{stat}_{cost}"
        )
    builder.adjust(1)
    
    await message.reply(
        f"📚 Доступные курсы в городе {current_city}:",
        reply_markup=builder.as_markup()
    )
    
    conn.close()
    await state.set_state(UserStates.CHOOSING_STUDY)

@router.callback_query(UserStates.CHOOSING_STUDY, F.data.startswith("study_"))
async def process_study_selection(callback: CallbackQuery, state: FSMContext) -> None:
    """Обработка выбора учебы"""
    await callback.answer()
    
    _, stat, minutes = callback.data.split("_")
    time_cost = int(minutes) * 60
    
    conn = sqlite3.connect(config.DATABASE_NAME)
    cursor = conn.cursor()
    
    try:
        if not consume_study_time(callback.from_user.id, time_cost, conn):
            # Создаем inline клавиатуру для возврата в меню
            builder = InlineKeyboardBuilder()
            builder.button(text="🔙 В меню", callback_data="return_to_menu")
            builder.adjust(1)
            
            await callback.message.edit_text(
                "У вас недостаточно учебного времени! ⏰\n"
                "Время восстанавливается автоматически: 6 минут игрового времени за 1 минуту реального.",
                reply_markup=builder.as_markup()
            )
            await callback.message.answer(
                "Выберите действие:",
                reply_markup=get_main_keyboard()
            )
            await state.set_state(UserStates.MAIN_MENU)
            return
        
        cursor.execute('SELECT stats, character_type, current_city FROM players WHERE user_id = ?', 
                      (callback.from_user.id,))
        stats_json, character_type, current_city = cursor.fetchone()
        stats = json.loads(stats_json)
        
        stats[stat] = stats.get(stat, 0) + 1
        
        cursor.execute('''
        UPDATE players 
        SET stats = ?
        WHERE user_id = ?
        ''', (json.dumps(stats), callback.from_user.id))
        
        # Получаем обновленные данные для профиля
        cursor.execute('''
        SELECT display_name, balance, work_time_left
        FROM players WHERE user_id = ?
        ''', (callback.from_user.id,))
        display_name, balance, work_time = cursor.fetchone()
        
        conn.commit()
        
        # Форматируем профиль после учебы
        profile_text = format_study_profile(
            display_name=display_name,
            balance=balance,
            work_time=work_time,
            stats=stats,
            currency_symbol=CITIES[current_city]["currency_symbol"]
        )
        
        # Создаем клавиатуру для возврата к учебе или в меню
        builder = InlineKeyboardBuilder()
        builder.button(text="📚 Продолжить обучение", callback_data="continue_study")
        builder.button(text="🔙 Вернуться в меню", callback_data="return_to_menu")
        builder.adjust(2)
        
        await callback.message.edit_text(
            f"Обучение завершено!\n"
            f"Характеристика {config.STAT_TRANSLATIONS[stat]} повышена на 1\n\n"
            f"{profile_text}",
            reply_markup=builder.as_markup()
        )
        await callback.message.answer(
            "Выберите действие:",
            reply_markup=get_main_keyboard()
        )
        
    except Exception as e:
        logger.error(f"Error in process_study_selection: {e}")
        # Создаем inline клавиатуру для возврата в меню
        builder = InlineKeyboardBuilder()
        builder.button(text="🔙 В меню", callback_data="return_to_menu")
        builder.adjust(1)
        
        await callback.message.edit_text(
            "Произошла ошибка при обучении. Попробуйте еще раз.",
            reply_markup=builder.as_markup()
        )
        await callback.message.answer(
            "Выберите действие:",
            reply_markup=get_main_keyboard()
        )
        await state.set_state(UserStates.MAIN_MENU)
    finally:
        conn.close()

@router.callback_query(F.data == "company_lab")
async def company_lab(callback: CallbackQuery, state: FSMContext):
    """Обработка нажатия кнопки лаборатории компании"""
    try:
        # Используем функцию из blueprint_development.py
        message, markup = await get_lab_message_and_keyboard(callback.from_user.id)
        await callback.message.edit_text(message, reply_markup=markup)
    except Exception as e:
        logger.error(f"Error in company_lab: {e}")
        await callback.answer("Произошла ошибка при открытии лаборатории", show_alert=True)

def get_blueprint_data(blueprint_name: str) -> Dict:
    """Получает данные чертежа по его имени"""
    from blueprints import GADGET_BLUEPRINTS
    for category, blueprints in GADGET_BLUEPRINTS.items():
        if blueprint_name in blueprints:
            return blueprints[blueprint_name]
    return None


@router.callback_query(F.data == "continue_study")
async def continue_study(callback: CallbackQuery, state: FSMContext) -> None:
    """Обработка кнопки продолжения обучения"""
    await callback.answer()
    
    conn = get_db_connection()
    if not conn:
        logger.error("Failed to connect to database in continue study")
        await callback.message.answer(
            "Произошла ошибка при работе с базой данных. Попробуйте позже.",
            reply_markup=get_main_keyboard()
        )
        await state.set_state(UserStates.MAIN_MENU)
        return
    
    try:
        cursor = conn.cursor()
        cursor.execute('SELECT current_city, stats FROM players WHERE user_id = ?', (callback.from_user.id,))
        current_city, stats_json = cursor.fetchone()
        stats = json.loads(stats_json)
        
        # Создаем клавиатуру с вариантами учебы
        builder = InlineKeyboardBuilder()
        study_options = []
        
        # Добавляем варианты учебы в зависимости от города
        if current_city == "Сан-Франциско":
            study_options = [
                ("Курсы iOS разработки", "coding", 2),
                ("Курсы UI/UX дизайна", "design", 1)
            ]
        elif current_city == "Сингапур":
            study_options = [
                ("Курсы тестирования", "testing", 2),
                ("Курсы аналитики", "analytics", 1)
            ]
        elif current_city == "Санкт-Петербург":
            study_options = [
                ("Курсы дизайна", "design", 2),
                ("Курсы моделирования", "modeling", 1)
            ]
        
        for name, stat, cost in study_options:
            current_level = stats.get(stat, 0)
            builder.button(
                text=f"{name} (Уровень {current_level}) - {cost} мин",
                callback_data=f"study_{stat}_{cost}"
            )
        builder.adjust(1)
        
        await callback.message.edit_text(
            f"📚 Доступные курсы в городе {current_city}:",
            reply_markup=builder.as_markup()
        )
        
        logger.info(f"Continue study processed for user ID: {callback.from_user.id}")
    finally:
        if conn:
            conn.close()

@router.callback_query(F.data == "return_to_menu")
async def return_to_menu(callback: CallbackQuery, state: FSMContext) -> None:
    """Обработка возврата в главное меню"""
    await callback.answer()
    await callback.message.edit_text(
        "Вы вернулись в главное меню",
        reply_markup=get_main_keyboard()
    )
    await state.set_state(UserStates.MAIN_MENU)
    logger.info(f"User ID: {callback.from_user.id} returned to main menu")

def get_rank(level: int) -> str:
    """Определяет ранг игрока на основе уровня"""
    for rank, data in config.RANKS.items():
        if data["min_level"] <= level <= data["max_level"]:
            return rank
    return "Intern"  # Значение по умолчанию

def calculate_exp_for_level(level: int) -> int:
    """Вычисляет необходимое количество опыта для достижения уровня"""
    return int(100 * (level ** 1.5))

def get_level_from_exp(exp: int) -> int:
    """Определяет уровень на основе количества опыта"""
    level = 1
    while calculate_exp_for_level(level + 1) <= exp:
        level += 1
    return level

def update_player_level(user_id: int, exp: int, conn: sqlite3.Connection) -> tuple:
    """Обновляет уровень игрока на основе опыта и возвращает информацию о повышении"""
    cursor = conn.cursor()
    
    # Получаем текущий уровень, опыт и другие данные игрока
    cursor.execute('''
    SELECT level, exp, stats, balance, character_type 
    FROM players WHERE user_id = ?
    ''', (user_id,))
    current_level, total_exp, stats_json, balance, character_type = cursor.fetchone()
    
    # Вычисляем новый уровень на основе общего опыта
    new_level = 1
    while calculate_exp_for_level(new_level + 1) <= total_exp:
        new_level += 1
    
    if new_level > current_level:
        # Рассчитываем бонусы за уровень
        money_bonus = 1000 * new_level  # Бонус денег зависит от нового уровня
        
        # Загружаем текущие характеристики
        stats = json.loads(stats_json)
        
        # Увеличиваем каждую характеристику на 0.1
        for stat in stats:
            stats[stat] = round(stats[stat] + 0.1, 1)
        
        # Обновляем данные игрока в базе
        cursor.execute('''
        UPDATE players 
        SET level = ?,
            balance = balance + ?,
            stats = ?,
            work_time_left = 1200,
            study_time_left = 1200
        WHERE user_id = ?
        ''', (new_level, money_bonus, json.dumps(stats), user_id))
        
        conn.commit()
        
        # Возвращаем True, новый уровень и информацию о бонусах
        return True, {
            "level": new_level,
            "money_bonus": money_bonus,
            "stats_increase": 0.1,
            "time_restored": True
        }
    return False, None

def calculate_time_restore(last_update: str) -> int:
    """Вычисляет количество восстановленного времени с момента последнего обновления"""
    last_time = datetime.fromisoformat(last_update)
    current_time = datetime.now()
    
    # Разница в минутах
    minutes_passed = (current_time - last_time).total_seconds() / 60
    # За каждую реальную минуту восстанавливается 6 минут игрового времени (360 секунд)
    restored_seconds = int(minutes_passed * 360)
    
    return restored_seconds

def update_player_time(user_id: int, conn: sqlite3.Connection) -> tuple:
    """Обновляет время работы и учебы игрока"""
    try:
        cursor = conn.cursor()
        
        # Получаем текущее время и данные игрока
        current_time = datetime.now()
        cursor.execute('''
        SELECT work_time_left, study_time_left, last_work_update, last_study_update
        FROM players WHERE user_id = ?
        ''', (user_id,))
        result = cursor.fetchone()
        
        if not result:
            return 0, 0
            
        work_time_left, study_time_left, last_work_update, last_study_update = result
        
        # Конвертируем строки в datetime
        last_work_update = datetime.fromisoformat(last_work_update)
        last_study_update = datetime.fromisoformat(last_study_update)
        
        # Вычисляем прошедшее время
        work_time_passed = (current_time - last_work_update).total_seconds()
        study_time_passed = (current_time - last_study_update).total_seconds()
        
        # Восстанавливаем время
        work_time_restored = int(work_time_passed * config.TIME_RESTORE_RATE / 60)
        study_time_restored = int(study_time_passed * config.TIME_RESTORE_RATE / 60)
        
        # Обновляем значения времени
        new_work_time = min(config.MAX_WORK_TIME, work_time_left + work_time_restored)
        new_study_time = min(config.MAX_STUDY_TIME, study_time_left + study_time_restored)
        
        # Обновляем данные в базе
        cursor.execute('''
        UPDATE players 
        SET work_time_left = ?, study_time_left = ?, 
            last_work_update = ?, last_study_update = ?
        WHERE user_id = ?
        ''', (
            new_work_time,
            new_study_time,
            current_time.isoformat(),
            current_time.isoformat(),
            user_id
        ))
        conn.commit()
        
        return new_work_time, new_study_time
        
    except Exception as e:
        logger.error(f"Error updating player time: {e}")
        return 0, 0

def consume_work_time(user_id: int, time_cost: int, conn: sqlite3.Connection) -> bool:
    """Расходует рабочее время игрока"""
    cursor = conn.cursor()
    
    # Обновляем время перед проверкой
    work_time, _ = update_player_time(user_id, conn)
    
    # Проверяем, достаточно ли времени
    if work_time < time_cost:
        return False
    
    # Уменьшаем доступное время
    cursor.execute('''
    UPDATE players
    SET work_time_left = work_time_left - ?
    WHERE user_id = ?
    ''', (time_cost, user_id))
    
    conn.commit()
    return True

def consume_study_time(user_id: int, time_cost: int, conn: sqlite3.Connection) -> bool:
    """Расходует учебное время игрока"""
    cursor = conn.cursor()
    
    # Обновляем время перед проверкой
    _, study_time = update_player_time(user_id, conn)
    
    # Проверяем, достаточно ли времени
    if study_time < time_cost:
        return False
    
    # Уменьшаем доступное время
    cursor.execute('''
    UPDATE players
    SET study_time_left = study_time_left - ?
    WHERE user_id = ?
    ''', (time_cost, user_id))
    
    conn.commit()
    return True

async def bank_command(message: Message, state: FSMContext) -> None:
    """Показывает банковское меню"""
    user = message.from_user
    
    conn = get_db_connection()
    if not conn:
        logger.error("Failed to connect to database in bank command")
        await message.reply(
            "Произошла ошибка при работе с базой данных. Попробуйте позже.",
            reply_markup=get_main_keyboard()
        )
        await state.set_state(UserStates.MAIN_MENU)
        return
    
    try:
        cursor = conn.cursor()
        cursor.execute('SELECT current_city, balance, gram_balance FROM players WHERE user_id = ?', (user.id,))
        result = cursor.fetchone()
        
        if not result:
            await message.reply("Ошибка: игрок не найден")
            return
            
        current_city, balance, gram_balance = result
        
        # Преобразуем gram_balance в float и форматируем
        try:
            gram_balance = float(gram_balance) if gram_balance is not None else 0.0
            formatted_gram = "{:,.3f}".format(gram_balance)
        except (ValueError, TypeError):
            formatted_gram = "0.000"
        
        # Получаем информацию о городе
        city_info = CITIES.get(current_city, {"currency_symbol": "$"})
        currency_symbol = city_info.get("currency_symbol", "$")
        
        # Форматируем баланс с разделителями тысяч
        formatted_balance = "{:,.2f}".format(float(balance))
        
        await message.reply(
            f"🏦 Добро пожаловать в банк!\n\n"
            f"💰 Ваш баланс: {formatted_balance} {currency_symbol}\n"
            f"💎 Gram: {formatted_gram}\n\n"
            "Выберите операцию:",
            reply_markup=get_bank_keyboard()
        )
        await state.set_state(UserStates.BANK_OPERATION)
        
        logger.info(f"Bank command processed for user ID: {user.id}")
        
    except Exception as e:
        logger.error(f"Ошибка при открытии банковского меню: {e}")
        await message.reply("Произошла ошибка при открытии банка. Попробуйте позже.")
    finally:
        conn.close()

@router.callback_query(UserStates.BANK_OPERATION, F.data.startswith("bank_"))
async def process_bank_operation(callback: CallbackQuery, state: FSMContext) -> None:
    """Обработка выбора банковской операции"""
    conn = get_db_connection()
    if not conn:
        logger.error("Failed to connect to database in bank operation")
        await callback.message.answer(
            "Произошла ошибка при работе с базой данных. Попробуйте позже.",
            reply_markup=InlineKeyboardBuilder().button(
                text="🔙 Назад",
                callback_data="bank_back"
            ).as_markup()
        )
        await state.set_state(UserStates.MAIN_MENU)
        return
    
    try:
        operation = callback.data.split('_')[1]
        
        # Получаем текущий город игрока
        cursor = conn.cursor()
        cursor.execute('SELECT current_city, balance FROM players WHERE user_id = ?', (callback.from_user.id,))
        current_city, balance = cursor.fetchone()
        
        currency_symbol = CITIES[current_city]['currency_symbol']
        
        if operation == "exchange":
            # Получаем курс обмена для текущего города
            if current_city == "Сан-Франциско":
                rate = EXCHANGE_RATES["USD"]
                rate_text = "1 USD = 0.1 Gram"
            elif current_city == "Сингапур":
                rate = EXCHANGE_RATES["SGD"]
                rate_text = "1 SGD = 0.07 Gram"
            else:  # Санкт-Петербург
                rate = EXCHANGE_RATES["RUB"]
                rate_text = "1 RUB = 0.001 Gram"
            
            await callback.message.edit_text(
                f"💱 Введите сумму для обмена в {currency_symbol}:\n\n"
                f"Ваш баланс: {balance:,} {currency_symbol}\n"
                f"Курс обмена: {rate_text}",
                reply_markup=InlineKeyboardBuilder().button(
                    text="🔙 Назад",
                    callback_data="bank_back"
                ).as_markup()
            )
            await state.set_state(UserStates.ENTERING_AMOUNT)
            await state.update_data(operation_type="exchange", current_city=current_city, rate=rate)
            
        elif operation == "credit":
            # Проверяем возможность создания нового кредита
            cursor.execute('SELECT account_data FROM bank_accounts WHERE user_id = ?', (callback.from_user.id,))
            account_data = cursor.fetchone()
            
            if account_data:
                account = BankAccount.from_dict(json.loads(account_data[0]))
                if not can_create_credit(account):
                    await callback.message.edit_text(
                        f"❌ У вас уже есть максимальное количество активных кредитов ({config.BANK_SETTINGS['credits']['max_active']})\n"
                        f"Пожалуйста, погасите существующие кредиты перед взятием нового.",
                        reply_markup=InlineKeyboardBuilder().button(
                            text="🔙 Назад",
                            callback_data="bank_back"
                        ).as_markup()
                    )
                    return
            
            # Создаем клавиатуру с типами кредитов
            keyboard = InlineKeyboardBuilder()
            for credit_type, program in config.BANK_SETTINGS['credits']['programs'].items():
                keyboard.button(
                    text=f"{credit_type}",
                    callback_data=f"credit_{credit_type}"
                )
            keyboard.button(text="🔙 Назад", callback_data="bank_back")
            keyboard.adjust(1)
            
            await callback.message.edit_text(
                "💳 Выберите тип кредита:",
                reply_markup=keyboard.as_markup()
            )
            await state.set_state(UserStates.CHOOSING_CREDIT_TYPE)
            
        elif operation == "deposit":
            # Проверяем возможность создания нового вклада
            cursor.execute('SELECT account_data FROM bank_accounts WHERE user_id = ?', (callback.from_user.id,))
            account_data = cursor.fetchone()
            
            if account_data:
                account = BankAccount.from_dict(json.loads(account_data[0]))
                if not can_create_deposit(account):
                    await callback.message.edit_text(
                        f"❌ У вас уже есть максимальное количество активных вкладов ({config.BANK_SETTINGS['deposits']['max_active']})\n"
                        f"Пожалуйста, закройте существующие вклады перед открытием нового.",
                        reply_markup=InlineKeyboardBuilder().button(
                            text="🔙 Назад",
                            callback_data="bank_back"
                        ).as_markup()
                    )
                    return
            
            # Создаем клавиатуру с типами вкладов
            keyboard = InlineKeyboardBuilder()
            for deposit_type, program in config.BANK_SETTINGS['deposits']['programs'].items():
                keyboard.button(
                    text=f"{deposit_type}",
                    callback_data=f"deposit_{deposit_type}"
                )
            keyboard.button(text="🔙 Назад", callback_data="bank_back")
            keyboard.adjust(1)
            
            await callback.message.edit_text(
                "💰 Выберите тип вклада:",
                reply_markup=keyboard.as_markup()
            )
            await state.set_state(UserStates.CHOOSING_DEPOSIT_TYPE)
        
        logger.info(f"Bank operation processed for user ID: {callback.from_user.id}")
        
    except Exception as e:
        logger.error(f"Error in process_bank_operation: {e}")
        await callback.message.edit_text(
            "Произошла ошибка при обработке операции. Попробуйте позже.",
            reply_markup=InlineKeyboardBuilder().button(
                text="🔙 Назад",
                callback_data="bank_back"
            ).as_markup()
        )
    finally:
        if conn:
            conn.close()

@router.callback_query(UserStates.CHOOSING_CREDIT_TYPE, F.data.startswith("credit_"))
async def process_credit_type_selection(callback: CallbackQuery, state: FSMContext) -> None:
    """Обработка выбора типа кредита"""
    try:
        credit_type = callback.data.split('_')[1]
        conn = sqlite3.connect(config.DATABASE_NAME)
        cursor = conn.cursor()
        
        # Получаем текущий город и уровень игрока
        cursor.execute('SELECT current_city, level FROM players WHERE user_id = ?', (callback.from_user.id,))
        current_city, player_level = cursor.fetchone()
        currency_symbol = CITIES[current_city]['currency_symbol']
        
        # Получаем данные программы кредита
        credit_program = config.BANK_SETTINGS['credits']['programs'][credit_type]
        
        # Проверяем уровень игрока
        if player_level < credit_program['min_level']:
            await callback.message.edit_text(
                f"❌ Для получения кредита типа '{credit_type}' требуется уровень {credit_program['min_level']}.\n"
                f"Ваш текущий уровень: {player_level}",
                reply_markup=InlineKeyboardBuilder().button(
                    text="🔙 Назад",
                    callback_data="bank_back"
                ).as_markup()
            )
            return
        
        # Получаем минимальную и максимальную суммы для города
        min_amount = credit_program['min_amount'][current_city]
        max_amount = credit_program['max_amount'][current_city]
        
        # Сохраняем данные операции
        await state.update_data(
            operation_type="credit",
            credit_type=credit_type,
            min_amount=min_amount,
            max_amount=max_amount,
            min_days=credit_program['min_days'],
            max_days=credit_program['max_days'],
            interest_rate=credit_program['interest_rate'],
            current_city=current_city
        )
        
        # Создаем сообщение с информацией о кредите
        message_text = (
            f"💳 Выбран тип кредита: {credit_type}\n\n"
            f"📊 Параметры кредита:\n"
            f"• Минимальная сумма: {min_amount:,} {currency_symbol}\n"
            f"• Максимальная сумма: {max_amount:,} {currency_symbol}\n"
            f"• Срок: от {credit_program['min_days']} до {credit_program['max_days']} дней\n"
            f"• Процентная ставка: {credit_program['interest_rate']*100}% годовых\n"
            f"• Штраф за просрочку: {credit_program['penalty_rate']*100}%\n\n"
            f"Введите сумму кредита:"
        )
        
        # Создаем клавиатуру с кнопкой "Назад"
        keyboard = InlineKeyboardBuilder()
        keyboard.button(text="🔙 Назад", callback_data="bank_back")
        
        await callback.message.edit_text(
            message_text,
            reply_markup=keyboard.as_markup()
        )
        await state.set_state(UserStates.ENTERING_AMOUNT)
        
    except Exception as e:
        logger.error(f"Error in process_credit_type_selection: {e}")
        await callback.message.edit_text(
            "Произошла ошибка при выборе типа кредита. Попробуйте позже.",
            reply_markup=InlineKeyboardBuilder().button(
                text="🔙 Назад",
                callback_data="bank_back"
            ).as_markup()
        )
    finally:
        conn.close()

@router.callback_query(UserStates.CHOOSING_DEPOSIT_TYPE, F.data.startswith("deposit_"))
async def process_deposit_type_selection(callback: CallbackQuery, state: FSMContext) -> None:
    """Обработка выбора типа вклада"""
    conn = get_db_connection()
    if not conn:
        logger.error("Failed to connect to database in deposit type selection")
        await callback.message.answer(
            "Произошла ошибка при работе с базой данных. Попробуйте позже.",
            reply_markup=InlineKeyboardBuilder().button(
                text="🔙 Назад",
                callback_data="bank_back"
            ).as_markup()
        )
        await state.set_state(UserStates.MAIN_MENU)
        return
    
    try:
        deposit_type = callback.data.split('_')[1]
        conn = sqlite3.connect(config.DATABASE_NAME)
        cursor = conn.cursor()
        
        # Получаем текущий город и уровень игрока
        cursor.execute('SELECT current_city, level FROM players WHERE user_id = ?', (callback.from_user.id,))
        current_city, player_level = cursor.fetchone()
        currency_symbol = CITIES[current_city]['currency_symbol']
        
        # Получаем данные программы вклада
        deposit_program = config.BANK_SETTINGS['deposits']['programs'][deposit_type]
        
        # Проверяем уровень игрока
        if player_level < deposit_program['min_level']:
            await callback.message.edit_text(
                f"❌ Для открытия вклада типа '{deposit_type}' требуется уровень {deposit_program['min_level']}.\n"
                f"Ваш текущий уровень: {player_level}",
                reply_markup=InlineKeyboardBuilder().button(
                    text="🔙 Назад",
                    callback_data="bank_back"
                ).as_markup()
            )
            return
        
        # Получаем минимальную и максимальную суммы для города
        min_amount = deposit_program['min_amount'][current_city]
        max_amount = deposit_program['max_amount'][current_city]
        
        # Сохраняем данные операции
        await state.update_data(
            operation_type="deposit",
            deposit_type=deposit_type,
            min_amount=min_amount,
            max_amount=max_amount,
            min_days=deposit_program['min_days'],
            max_days=deposit_program['max_days'],
            interest_rate=deposit_program['interest_rate'],
            current_city=current_city
        )
        
        # Создаем сообщение с информацией о вкладе
        message_text = (
            f"💰 Выбран тип вклада: {deposit_type}\n\n"
            f"📊 Параметры вклада:\n"
            f"• Минимальная сумма: {min_amount:,} {currency_symbol}\n"
            f"• Максимальная сумма: {max_amount:,} {currency_symbol}\n"
            f"• Срок: от {deposit_program['min_days']} до {deposit_program['max_days']} дней\n"
            f"• Процентная ставка: {deposit_program['interest_rate']*100}% годовых\n\n"
            f"Введите сумму вклада:"
        )
        
        # Создаем клавиатуру с кнопкой "Назад"
        keyboard = InlineKeyboardBuilder()
        keyboard.button(text="🔙 Назад", callback_data="bank_back")
        
        await callback.message.edit_text(
            message_text,
            reply_markup=keyboard.as_markup()
        )
        await state.set_state(UserStates.ENTERING_AMOUNT)
        
        logger.info(f"Deposit type selection processed for user ID: {callback.from_user.id}")
    except Exception as e:
        logger.error(f"Error in process_deposit_type_selection: {e}")
        await callback.message.edit_text(
            "Произошла ошибка при выборе типа вклада. Попробуйте позже.",
            reply_markup=InlineKeyboardBuilder().button(
                text="🔙 Назад",
                callback_data="bank_back"
            ).as_markup()
        )
    finally:
        if conn:
            conn.close()

@router.callback_query(F.data == "bank_back")
async def bank_back(callback: CallbackQuery, state: FSMContext) -> None:
    """Обработка возврата в банковское меню"""
    try:
        await state.clear()
        await state.set_state(UserStates.BANK_OPERATION)
        
        builder = InlineKeyboardBuilder()
        for operation_id, operation in BANK_OPERATIONS.items():
            builder.button(
                text=operation["name"],
                callback_data=f"bank_{operation_id}"
            )
        builder.button(text="Назад", callback_data="return_to_menu")
        builder.adjust(1)
        
        await callback.message.edit_text(
            "Выберите операцию:",
            reply_markup=builder.as_markup()
        )
        logger.info(f"User ID: {callback.from_user.id} returned to bank menu")
    except Exception as e:
        logging.error(f"Error in bank_back: {e}")
        await callback.message.edit_text(
            "Произошла ошибка. Попробуйте позже.",
            reply_markup=InlineKeyboardBuilder().button(
                text="В меню",
                callback_data="return_to_menu"
            ).as_markup()
        )

def check_company_blueprints_table():
    """Проверяет и создает таблицу чертежей компании"""
    conn = None
    try:
        conn = get_db_connection()
        if not conn:
            logger.error("Failed to connect to database in check_company_blueprints_table")
            return False
            
        cursor = conn.cursor()
        
        # Проверяем существование таблицы
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='company_blueprints'
        """)
        
        if not cursor.fetchone():
            # Создаем таблицу, если она не существует
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS company_blueprints (
                    blueprint_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    company_id INTEGER,
                    gadget_type TEXT NOT NULL,
                    blueprint_name TEXT NOT NULL,
                    status TEXT DEFAULT 'in_progress',
                    progress_coding INTEGER DEFAULT 0,
                    progress_design INTEGER DEFAULT 0,
                    progress_analytics INTEGER DEFAULT 0,
                    development_started TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (company_id) REFERENCES companies (company_id)
                )
            ''')
            
            # Создаем индекс для оптимизации поиска
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_company_blueprints 
                ON company_blueprints(company_id, status)
            ''')
            
            conn.commit()
            logger.info("Created company_blueprints table")
        else:
            # Проверяем структуру таблицы
            cursor.execute("PRAGMA table_info(company_blueprints)")
            columns = {row[1] for row in cursor.fetchall()}
            expected_columns = {
                'blueprint_id', 'company_id', 'gadget_type', 'blueprint_name',
                'status', 'progress_coding', 'progress_design', 'progress_analytics',
                'development_started'
            }
            
            if not expected_columns.issubset(columns):
                logger.warning("company_blueprints table structure is incorrect")
                missing_columns = expected_columns - columns
                logger.warning(f"Missing columns: {missing_columns}")
                return False
                
        return True
        
    except sqlite3.Error as e:
        logger.error(f"Database error in check_company_blueprints_table: {e}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error in check_company_blueprints_table: {e}")
        return False
    finally:
        if conn:
            conn.close()

async def init_database():
    """Инициализирует базу данных"""
    if not check_database_connection():
        logger.error("Не удалось подключиться к базе данных")
        return False
        
    # Обновляем структуру таблицы company_blueprints
    if not update_company_blueprints_table():
        logger.error("Не удалось обновить структуру таблицы company_blueprints")
        return False
        
    return True

def check_database_connection():
    """Проверяет подключение к базе данных и наличие всех необходимых таблиц"""
    conn = None
    try:
        conn = get_db_connection()
        if not conn:
            logger.error("Failed to establish database connection")
            return False
            
        cursor = conn.cursor()
        
        # Проверяем наличие всех необходимых таблиц
        required_tables = [
            'players',
            'companies',
            'company_employees',
            'company_blueprints',
            'company_storage'
        ]
        
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        existing_tables = {row[0] for row in cursor.fetchall()}
        
        missing_tables = set(required_tables) - existing_tables
        if missing_tables:
            logger.error(f"Missing required tables: {missing_tables}")
            return False
            
        logger.info("Database connection and structure verified successfully")
        return True
        
    except sqlite3.Error as e:
        logger.error(f"Database error in check_database_connection: {e}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error in check_database_connection: {e}")
        return False
    finally:
        if conn:
            conn.close()

# Инициализация бота и диспетчера
bot = Bot(
    token=config.TOKEN,
    default=DefaultBotProperties(parse_mode=ParseMode.HTML)
)
storage = MemoryStorage()
dp = Dispatcher(storage=storage)

# Инициализация менеджера хакатона
hackathon_manager = None

@dp.startup()
async def startup_event():
    global hackathon_manager
    hackathon_manager = HackathonManager(bot, get_db_connection())
    asyncio.create_task(hackathon_manager.check_hackathon_schedule())

async def main():
    # Инициализируем базу данных
    if not await init_database():
        logger.error("Failed to initialize database")
        return

    # Создаем таблицу для сообщений лаборатории
    update_lab_messages_table()

    # Создаем планировщик
    scheduler = AsyncIOScheduler()
    
    # Добавляем задачу на автоматическое обновление прогресса чертежей каждые 10 секунд
    scheduler.add_job(
        auto_update_company_blueprints,
        'interval',
        seconds=10,
        id='blueprint_update',
        name='Blueprint Progress Update'
    )
    logger.info("Scheduled blueprint update job")
    
    # Добавляем задачу на обновление сообщений с прогрессом каждые 10 секунд
    scheduler.add_job(
        update_progress_message,
        'interval',
        seconds=5,
        args=[bot],
        id='message_update',
        name='Progress Message Update'
    )
    logger.info("Scheduled message update job")
    
    # Добавляем задачу для сброса еженедельных заданий каждый понедельник в 00:00
    scheduler.add_job(
        reset_weekly_tasks,
        trigger='cron',
        day_of_week='mon',
        hour=0,
        minute=0,
        id='weekly_reset',
        name='Weekly Tasks Reset'
    )
    
    # Добавляем задачу для отправки зарплат
    scheduler.add_job(
        send_salary_notifications,
        trigger='interval',
        hours=24,
        start_date=datetime.now().replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1),
        id='salary_notifications',
        name='Daily Salary Notifications'
    )
    
    # Запускаем планировщик
    scheduler.start()
    logger.info("Scheduler started")
    
    # Register all routers from handlers package
    dp.include_router(router)
    dp.include_router(stop_development_router)  # Добавляем роутер для обработки остановки разработки
    dp.include_router(blueprint_handlers_router)  # Добавляем роутер для обработки чертежей
    
    # Регистрируем обработчики для лаборатории
    dp.callback_query.register(handle_develop_callback, F.data.startswith("develop_"))
    dp.callback_query.register(handle_join_development_callback, F.data.startswith("join_development_"))
    dp.callback_query.register(handle_refresh_lab, F.data == "refresh_lab")
    
    # Start polling with proper error handling
    try:
        logger.info("Starting bot polling")
        await dp.start_polling(bot, allowed_updates=dp.resolve_used_update_types())
    except Exception as e:
        logger.error(f"Error during polling: {e}")
    finally:
        await bot.session.close()
        scheduler.shutdown()

@router.callback_query(UserStates.CONFIRM_OPERATION, F.data == "confirm_operation")
async def process_operation_confirmation(callback: CallbackQuery, state: FSMContext) -> None:
    """Обработка подтверждения банковской операции"""
    try:
        # Получаем данные операции
        data = await state.get_data()
        operation_type = data.get('operation_type')
        amount = data.get('amount')
        days = data.get('days')
        current_city = data.get('current_city')
        
        if not all([operation_type, amount, days, current_city]):
            await callback.message.edit_text(
                "❌ Ошибка: данные операции не найдены. Попробуйте начать операцию заново.",
                reply_markup=InlineKeyboardBuilder().button(
                    text="🔙 Назад",
                    callback_data="bank_back"
                ).as_markup()
            )
            return
        
        conn = sqlite3.connect(config.DATABASE_NAME)
        
        try:
            if operation_type == "credit":
                success, message = process_credit_operation(
                    callback.from_user.id,
                    amount,
                    days,
                    data['credit_type'],
                    current_city,
                    conn
                )
            elif operation_type == "deposit":
                success, message = process_deposit_operation(
                    callback.from_user.id,
                    amount,
                    days,
                    data['deposit_type'],
                    current_city,
                    conn
                )
            else:
                success = False
                message = "Неизвестный тип операции"
            
            if success:
                await callback.message.edit_text(
                    f"✅ {message}",
                    reply_markup=InlineKeyboardBuilder().button(
                        text="🔙 В меню",
                        callback_data="bank_back"
                    ).as_markup()
                )
            else:
                await callback.message.edit_text(
                    f"❌ {message}",
                    reply_markup=InlineKeyboardBuilder().button(
                        text="🔙 Назад",
                        callback_data="bank_back"
                    ).as_markup()
                )
                
        except Exception as e:
            logger.error(f"Error in process_operation_confirmation: {e}")
            await callback.message.edit_text(
                "Произошла ошибка при выполнении операции. Попробуйте позже.",
                reply_markup=InlineKeyboardBuilder().button(
                    text="🔙 Назад",
                    callback_data="bank_back"
                ).as_markup()
            )
        finally:
            conn.close()
            
    except Exception as e:
        logger.error(f"Critical error in process_operation_confirmation: {e}")
        await callback.message.edit_text(
            "Произошла критическая ошибка. Пожалуйста, попробуйте позже.",
            reply_markup=InlineKeyboardBuilder().button(
                text="🔙 Назад",
                callback_data="bank_back"
            ).as_markup()
        )

@router.message(UserStates.ENTERING_AMOUNT)
async def process_amount(message: Message, state: FSMContext) -> None:
    """Обработка ввода суммы для банковской операции"""
    try:
        amount = float(message.text.replace(',', '.'))
        state_data = await state.get_data()
        operation_type = state_data.get('operation_type')
        current_city = state_data.get('current_city')
        
        conn = sqlite3.connect(config.DATABASE_NAME)
        cursor = conn.cursor()
        
        # Получаем текущий баланс
        cursor.execute('SELECT balance, gram_balance FROM players WHERE user_id = ?', (message.from_user.id,))
        result = cursor.fetchone()
        if result is None:
            await message.reply("❌ Ваш профиль не найден. Используйте /start для создания профиля.")
            return
        current_balance, current_gram = result
        
        if operation_type == "exchange":
            # Логика обмена валюты
            if amount > current_balance:
                await message.reply("❌ Недостаточно средств для обмена")
                return
            
            # Определяем валюту для обмена
            if current_city == "Сан-Франциско":
                from_currency = "USD"
            elif current_city == "Сингапур":
                from_currency = "SGD"
            else:  # Санкт-Петербург
                from_currency = "RUB"
            
            # Конвертируем в Gram
            gram_amount = exchange_to_gram(amount, from_currency)
            
            # Обновляем оба баланса только для операции обмена
            cursor.execute('''
                UPDATE players 
                SET balance = balance - ?,
                    gram_balance = gram_balance + ?
                WHERE user_id = ?
            ''', (amount, gram_amount, message.from_user.id))
            
            # Создаем запись об операции
            operation_id = generate_operation_id()
            cursor.execute('''
                INSERT INTO bank_operations 
                (operation_id, user_id, operation_type, amount, details, created_at)
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ''', (
                operation_id,
                message.from_user.id,
                "exchange",
                amount,
                json.dumps({
                    "from_currency": CITIES[current_city]['currency_symbol'],
                    "to_currency": "Gram",
                    "rate": EXCHANGE_RATES[from_currency],
                    "gram_amount": gram_amount
                })
            ))
            
            conn.commit()
            
            # Получаем обновленные балансы
            cursor.execute('SELECT balance, gram_balance FROM players WHERE user_id = ?', (message.from_user.id,))
            new_balance, new_gram = cursor.fetchone()
            
            await message.reply(
                f"✅ Обмен валюты успешно выполнен!\n"
                f"Списано: {amount:,.0f} {CITIES[current_city]['currency_symbol']}\n"
                f"Получено: {gram_amount:,.3f} Gram\n\n"
                f"Новый баланс: {new_balance:,.0f} {CITIES[current_city]['currency_symbol']}\n"
                f"Баланс Gram: {new_gram:,.3f}"
            )
            await state.finish()
            
        elif operation_type in ["credit", "deposit"]:
            # Для кредитов и вкладов не трогаем gram_balance
            min_amount = state_data.get('min_amount', 0)
            max_amount = state_data.get('max_amount', float('inf'))
            
            if amount < min_amount:
                await message.reply(
                    f"❌ Минимальная сумма составляет {min_amount:,} {CITIES[current_city]['currency_symbol']}",
                    reply_markup=InlineKeyboardBuilder().button(
                        text="🔙 Назад",
                        callback_data="bank_back"
                    ).as_markup()
                )
                return
            
            if amount > max_amount:
                await message.reply(
                    f"❌ Максимальная сумма составляет {max_amount:,} {CITIES[current_city]['currency_symbol']}",
                    reply_markup=InlineKeyboardBuilder().button(
                        text="🔙 Назад",
                        callback_data="bank_back"
                    ).as_markup()
                )
                return
            
            # Сохраняем сумму и переходим к вводу срока
            await state.update_data(amount=amount)
            
            # Получаем параметры из state_data
            min_days = state_data.get('min_days')
            max_days = state_data.get('max_days')
            
            await message.reply(
                f"Введите срок в днях (от {min_days} до {max_days}):",
                reply_markup=InlineKeyboardBuilder().button(
                    text="🔙 Назад",
                    callback_data="bank_back"
                ).as_markup()
            )
            await state.set_state(UserStates.ENTERING_DAYS)
            
    except ValueError:
        await message.reply("❌ Пожалуйста, введите корректное число")
    except Exception as e:
        logger.error(f"Error in process_amount: {e}")
        await message.reply(
            "Произошла ошибка при обработке суммы. Попробуйте позже.",
            reply_markup=InlineKeyboardBuilder().button(
                text="🔙 Назад",
                callback_data="bank_back"
            ).as_markup()
        )
    finally:
        if 'conn' in locals():
            conn.close()

def generate_operation_id() -> str:
    """Генерирует уникальный ID для банковской операции"""
    return f"op_{int(time.time())}_{random.randint(1000, 9999)}"

@router.message(UserStates.ENTERING_DAYS)
async def process_days(message: Message, state: FSMContext) -> None:
    """Обработка ввода срока для кредита/вклада"""
    try:
        days = int(message.text)
        state_data = await state.get_data()
        operation_type = state_data.get('operation_type')
        amount = state_data.get('amount')
        current_city = state_data.get('current_city')
        min_days = state_data.get('min_days')
        max_days = state_data.get('max_days')
        
        if days < min_days or days > max_days:
            await message.reply(
                f"❌ Срок должен быть от {min_days} до {max_days} дней",
                reply_markup=InlineKeyboardBuilder().button(
                    text="🔙 Назад",
                    callback_data="bank_back"
                ).as_markup()
            )
            return
        
        await state.update_data(days=days)
        
        if operation_type == "credit":
            payment = calculate_credit_payment(amount, days, state_data.get('interest_rate'))
            total_payment = payment * days
            overpayment = total_payment - amount
            
            confirm_message = (
                f"💳 Подтвердите условия кредита:\n\n"
                f"Сумма: {amount:,.0f} {CITIES[current_city]['currency_symbol']}\n"
                f"Срок: {days} дней\n"
                f"Ставка: {state_data.get('interest_rate')*100}% годовых\n"
                f"Ежедневный платеж: {payment:,.0f} {CITIES[current_city]['currency_symbol']}\n"
                f"Общая сумма выплат: {total_payment:,.0f} {CITIES[current_city]['currency_symbol']}\n"
                f"Переплата: {overpayment:,.0f} {CITIES[current_city]['currency_symbol']}"
            )
        else:
            income = calculate_deposit_income(amount, days, state_data.get('interest_rate'))
            total_amount = amount + income
            
            confirm_message = (
                f"💰 Подтвердите условия вклада:\n\n"
                f"Сумма: {amount:,.0f} {CITIES[current_city]['currency_symbol']}\n"
                f"Срок: {days} дней\n"
                f"Ставка: {state_data.get('interest_rate')*100}% годовых\n"
                f"Доход: {income:,.0f} {CITIES[current_city]['currency_symbol']}\n"
                f"Сумма к получению: {total_amount:,.0f} {CITIES[current_city]['currency_symbol']}"
            )
        
        builder = InlineKeyboardBuilder()
        builder.button(text="✅ Подтвердить", callback_data="confirm_operation")
        builder.button(text="❌ Отменить", callback_data="bank_back")
        builder.adjust(2)
        
        await message.reply(confirm_message, reply_markup=builder.as_markup())
        await state.set_state(UserStates.CONFIRM_OPERATION)
        
    except ValueError:
        await message.reply(
            "❌ Пожалуйста, введите корректное целое число",
            reply_markup=InlineKeyboardBuilder().button(
                text="🔙 Назад",
                callback_data="bank_back"
            ).as_markup()
        )
    except Exception as e:
        logger.error(f"Error in process_days: {e}")
        await message.reply(
            "Произошла ошибка при обработке срока. Попробуйте позже.",
            reply_markup=InlineKeyboardBuilder().button(
                text="🔙 Назад",
                callback_data="bank_back"
            ).as_markup()
        )

async def change_city_command(message: Message, state: FSMContext) -> None:
    """Показывает меню города"""
    user = message.from_user
    
    conn = sqlite3.connect(config.DATABASE_NAME)
    cursor = conn.cursor()
    
    try:
        # Получаем текущий город игрока
        cursor.execute('SELECT current_city FROM players WHERE user_id = ?', (user.id,))
        current_city = cursor.fetchone()[0]
        
        # Создаем клавиатуру с действиями в городе
        builder = InlineKeyboardBuilder()
        builder.button(text="🏪 Магазин", callback_data="city_shop")
        builder.button(text="🔄 Сменить город", callback_data="city_change")
        builder.button(text="🔙 Назад", callback_data="return_to_menu")
        builder.adjust(1)
        
        city_info = CITIES[current_city]
        await message.reply(
            f"🌆 Город: {current_city}\n"
            f"Специализация: {city_info['specialization']}\n"
            f"Валюта: {city_info['currency_symbol']}\n\n"
            "Выберите действие:",
            reply_markup=builder.as_markup()
        )
        await state.set_state(UserStates.CHANGING_CITY)
        
    except Exception as e:
        logger.error(f"Error in change_city_command: {e}")
        await message.reply(
            "Произошла ошибка при открытии меню города. Попробуйте позже.",
            reply_markup=get_main_keyboard()
        )
    finally:
        conn.close()

@router.callback_query(UserStates.CHANGING_CITY, F.data == "city_shop")
async def show_shop(callback: CallbackQuery, state: FSMContext) -> None:
    """Показывает магазин гаджетов"""
    await callback.answer()
    
    conn = sqlite3.connect(config.DATABASE_NAME)
    cursor = conn.cursor()
    
    try:
        # Получаем текущий город и баланс игрока
        cursor.execute('SELECT current_city, balance FROM players WHERE user_id = ?', (callback.from_user.id,))
        current_city, balance = cursor.fetchone()
        city_info = CITIES[current_city]
        currency_symbol = city_info['currency_symbol']
        
        # Получаем гаджеты для текущего города
        city_gadgets = INITIAL_GADGETS[current_city]
        
        # Создаем клавиатуру с гаджетами
        builder = InlineKeyboardBuilder()
        for gadget_id, gadget_info in city_gadgets.items():
            # Добавляем префикс 'G' к ID гаджета, если его нет
            if not gadget_id.startswith('G'):
                gadget_id = f"G{gadget_id}"
            
            # Формируем текст кнопки с информацией о гаджете
            button_text = (
                f"{gadget_info['name']} ({gadget_info['rarity']})\n"
                f"💰 {gadget_info['price']} {currency_symbol}"
            )
            builder.button(
                text=button_text,
                callback_data=f"buy_{gadget_id}"
            )
        
        # Добавляем кнопку для продажи предметов
        builder.button(text="💰 Продать предметы", callback_data="sell_items")
        builder.button(text="🔙 Назад", callback_data="city_back")
        builder.adjust(1)
        
        # Формируем сообщение с информацией о магазине
        shop_text = (
            f"🏪 Магазин гаджетов в городе {current_city}\n\n"
            f"💰 Ваш баланс: {balance} {currency_symbol}\n\n"
            "Доступные гаджеты:\n"
        )
        
        for gadget_id, gadget_info in city_gadgets.items():
            shop_text += f"\n📱 {gadget_info['name']} ({gadget_info['rarity']})"
            shop_text += f"\n💰 Цена: {gadget_info['price']} {currency_symbol}"
            shop_text += "\n📊 Характеристики:"
            for stat, value in gadget_info['stats'].items():
                shop_text += f"\n  • {config.STAT_TRANSLATIONS[stat]}: +{value}"
            shop_text += "\n"
        
        await callback.message.edit_text(
            shop_text,
            reply_markup=builder.as_markup()
        )
        
    except Exception as e:
        logger.error(f"Error in show_shop: {e}")
        await callback.message.edit_text(
            "Произошла ошибка при открытии магазина. Попробуйте позже.",
            reply_markup=InlineKeyboardBuilder().button(
                text="🔙 Назад",
                callback_data="city_back"
            ).as_markup()
        )
    finally:
        conn.close()

@router.callback_query(UserStates.CHANGING_CITY, F.data == "sell_items")
async def show_sell_items(callback: CallbackQuery, state: FSMContext) -> None:
    """Показывает список предметов для продажи"""
    await callback.answer()
    
    conn = sqlite3.connect(config.DATABASE_NAME)
    cursor = conn.cursor()
    
    try:
        # Получаем данные игрока
        cursor.execute('''
        SELECT inventory, parts_storage, equipped_gadgets, current_city
        FROM players WHERE user_id = ?
        ''', (callback.from_user.id,))
        inventory_json, parts_storage_json, equipped_gadgets_json, current_city = cursor.fetchone()
        
        inventory = json.loads(inventory_json)
        parts_storage = json.loads(parts_storage_json)
        equipped_gadgets = json.loads(equipped_gadgets_json) if equipped_gadgets_json else {}
        
        # Создаем клавиатуру с предметами для продажи
        builder = InlineKeyboardBuilder()
        sellable_items = []
        
        for item_id, count in inventory.items():
            item_info = parts_storage.get(item_id, {})
            if not item_info:
                continue
                
            # Проверяем, можно ли продать предмет
            can_sell = True
            if item_id.startswith('G'):  # Для гаджетов
                if item_id in equipped_gadgets:
                    can_sell = False
            
            if can_sell:
                # Вычисляем цену продажи
                if item_id.startswith('G'):  # Для гаджетов
                    sell_price = int(item_info.get('price', 0) * 0.5)
                else:  # Для запчастей
                    base_price = ALL_PARTS.get(item_id, {}).get('base_price', 0)
                    rarity_multiplier = {
                        "Common": 1,
                        "Rare": 1.5,
                        "Epic": 2,
                        "Legendary": 3
                    }.get(item_info.get('rarity', 'Common'), 1)
                    sell_price = int(base_price * rarity_multiplier * 0.5)
                
                sellable_items.append((item_id, item_info, count, sell_price))
                
                # Формируем текст кнопки
                button_text = (
                    f"{item_info['name']} ({item_info['rarity']})\n"
                    f"💰 Цена продажи: {sell_price} {CITIES[current_city]['currency_symbol']}\n"
                    f"📦 Количество: x{count}"
                )
                builder.button(
                    text=button_text,
                    callback_data=f"sell_{item_id}"
                )
        
        if not sellable_items:
            builder.button(text="🔙 Назад", callback_data="city_shop")
            await callback.message.edit_text(
                "У вас нет предметов для продажи!",
                reply_markup=builder.as_markup()
            )
            return
        
        builder.button(text="🔙 Назад", callback_data="city_shop")
        builder.adjust(1)
        
        # Формируем сообщение
        sell_text = (
            f"💰 Продажа предметов\n\n"
            f"Выберите предмет для продажи:\n"
            f"(Цены указаны за единицу)\n\n"
        )
        
        for item_id, item_info, count, sell_price in sellable_items:
            sell_text += f"\n📦 {item_info['name']} ({item_info['rarity']})"
            sell_text += f"\n💰 Цена продажи: {sell_price} {CITIES[current_city]['currency_symbol']}"
            sell_text += f"\n📦 Количество: x{count}\n"
        
        await callback.message.edit_text(
            sell_text,
            reply_markup=builder.as_markup()
        )
        
    except Exception as e:
        logger.error(f"Error in show_sell_items: {e}")
        await callback.message.edit_text(
            "Произошла ошибка при открытии списка продажи. Попробуйте позже.",
            reply_markup=InlineKeyboardBuilder().button(
                text="🔙 Назад",
                callback_data="city_shop"
            ).as_markup()
        )
    finally:
        conn.close()

@router.callback_query(UserStates.CHANGING_CITY, F.data.startswith("sell_"))
async def process_item_sale(callback: CallbackQuery, state: FSMContext) -> None:
    """Обработка продажи предмета"""
    await callback.answer()
    
    conn = sqlite3.connect(config.DATABASE_NAME)
    cursor = conn.cursor()
    
    try:
        # Получаем ID предмета из callback_data
        item_id = callback.data.split('_')[1]
        
        # Получаем данные игрока
        cursor.execute('''
        SELECT inventory, parts_storage, equipped_gadgets, current_city, balance
        FROM players WHERE user_id = ?
        ''', (callback.from_user.id,))
        inventory_json, parts_storage_json, equipped_gadgets_json, current_city, balance = cursor.fetchone()
        
        inventory = json.loads(inventory_json)
        parts_storage = json.loads(parts_storage_json)
        equipped_gadgets = json.loads(equipped_gadgets_json) if equipped_gadgets_json else {}
        
        # Проверяем наличие предмета
        if item_id not in inventory or inventory[item_id] <= 0:
            await callback.message.edit_text(
                "❌ У вас нет этого предмета!",
                reply_markup=InlineKeyboardBuilder().button(
                    text="🔙 Назад",
                    callback_data="sell_items"
                ).as_markup()
            )
            return
        
        # Проверяем, не надет ли гаджет
        if item_id.startswith('G') and item_id in equipped_gadgets:
            await callback.message.edit_text(
                "❌ Нельзя продать надетый гаджет!",
                reply_markup=InlineKeyboardBuilder().button(
                    text="🔙 Назад",
                    callback_data="sell_items"
                ).as_markup()
            )
            return
        
        # Получаем информацию о предмете
        item_info = parts_storage.get(item_id, {})
        if not item_info:
            await callback.message.edit_text(
                "❌ Ошибка: информация о предмете не найдена",
                reply_markup=InlineKeyboardBuilder().button(
                    text="🔙 Назад",
                    callback_data="sell_items"
                ).as_markup()
            )
            return
        
        # Вычисляем цену продажи
        if item_id.startswith('G'):  # Для гаджетов
            sell_price = int(item_info.get('price', 0) * 0.5)
        else:  # Для запчастей
            base_price = ALL_PARTS.get(item_id, {}).get('base_price', 0)
            rarity_multiplier = {
                "Common": 1,
                "Rare": 1.5,
                "Epic": 2,
                "Legendary": 3
            }.get(item_info.get('rarity', 'Common'), 1)
            sell_price = int(base_price * rarity_multiplier * 0.5)
        
        # Уменьшаем количество предметов
        inventory[item_id] -= 1
        
        # Если предметов не осталось, удаляем запись
        if inventory[item_id] <= 0:
            del inventory[item_id]
        
        # Обновляем баланс и инвентарь
        cursor.execute('''
        UPDATE players 
        SET balance = balance + ?,
            inventory = ?
        WHERE user_id = ?
        ''', (sell_price, json.dumps(inventory), callback.from_user.id))
        
        conn.commit()
        
        # Получаем обновленный баланс
        cursor.execute('SELECT balance FROM players WHERE user_id = ?', (callback.from_user.id,))
        new_balance = cursor.fetchone()[0]
        
        # Создаем клавиатуру для возврата к продаже
        builder = InlineKeyboardBuilder()
        builder.button(text="💰 Продолжить продажу", callback_data="sell_items")
        builder.button(text="🔙 В магазин", callback_data="city_shop")
        builder.adjust(2)
        
        await callback.message.edit_text(
            f"✅ Предмет успешно продан!\n\n"
            f"📦 Продан предмет: {item_info['name']} ({item_info['rarity']})\n"
            f"💰 Получено: {sell_price} {CITIES[current_city]['currency_symbol']}\n"
            f"💵 Баланс: {new_balance} {CITIES[current_city]['currency_symbol']}",
            reply_markup=builder.as_markup()
        )
        
    except Exception as e:
        logger.error(f"Error in process_item_sale: {e}")
        await callback.message.edit_text(
            "Произошла ошибка при продаже предмета. Попробуйте позже.",
            reply_markup=InlineKeyboardBuilder().button(
                text="🔙 Назад",
                callback_data="sell_items"
            ).as_markup()
        )
    finally:
        conn.close()

@router.callback_query(UserStates.CHANGING_CITY, F.data == "city_back")
async def city_back(callback: CallbackQuery, state: FSMContext) -> None:
    """Обработка возврата в меню города"""
    await callback.answer()
    
    conn = sqlite3.connect(config.DATABASE_NAME)
    cursor = conn.cursor()
    
    try:
        # Получаем текущий город игрока
        cursor.execute('SELECT current_city FROM players WHERE user_id = ?', (callback.from_user.id,))
        current_city = cursor.fetchone()[0]
        
        # Создаем клавиатуру с действиями в городе
        builder = InlineKeyboardBuilder()
        builder.button(text="🏪 Магазин", callback_data="city_shop")
        builder.button(text="🔄 Сменить город", callback_data="city_change")
        builder.button(text="🔙 Назад", callback_data="return_to_menu")
        builder.adjust(1)
        
        city_info = CITIES[current_city]
        await callback.message.edit_text(
            f"🌆 Город: {current_city}\n"
            f"Специализация: {city_info['specialization']}\n"
            f"Валюта: {city_info['currency_symbol']}\n\n"
            "Выберите действие:",
            reply_markup=builder.as_markup()
        )
        
    except Exception as e:
        logger.error(f"Error in city_back: {e}")
        await callback.message.edit_text(
            "Произошла ошибка. Попробуйте позже.",
            reply_markup=InlineKeyboardBuilder().button(
                text="В меню",
                callback_data="return_to_menu"
            ).as_markup()
        )
    finally:
        conn.close()

@router.message(Command("gadgets"))
async def cmd_gadgets(message: Message) -> None:
    """Показывает надетые гаджеты и позволяет управлять ими"""
    user = message.from_user
    
    conn = sqlite3.connect(config.DATABASE_NAME)
    cursor = conn.cursor()
    
    try:
        cursor.execute('''
        SELECT inventory, parts_storage, equipped_gadgets, stats
        FROM players WHERE user_id = ?
        ''', (user.id,))
        player = cursor.fetchone()
        
        if not player:
            await message.reply(
                "Профиль не найден. Используйте /start для создания персонажа."
            )
            return
            
        inventory_json, parts_storage_json, equipped_gadgets_json, stats_json = player
        inventory = json.loads(inventory_json)
        parts_storage = json.loads(parts_storage_json)
        equipped_gadgets = json.loads(equipped_gadgets_json) if equipped_gadgets_json else {}
        stats = json.loads(stats_json)
        
        # Разделяем инвентарь на гаджеты и запчасти
        gadgets = []
        parts = []
        
        for item_id, count in inventory.items():
            item_info = parts_storage.get(item_id, {})
            if item_id.startswith('G'):  # Гаджеты
                is_equipped = item_id in equipped_gadgets
                status = "✅ Надет" if is_equipped else "❌ Не надет"
                gadgets.append(f"📱 {item_info.get('name', 'Неизвестный гаджет')} ({item_info.get('rarity', 'Unknown')}) x{count} {status}")
            else:  # Все остальное - запчасти
                parts.append(f"🔧 {item_info.get('name', 'Неизвестная запчасть')} ({item_info.get('rarity', 'Unknown')}) x{count}")
        
        # Подсчитываем общее количество
        total_gadgets = sum(inventory.get(item_id, 0) for item_id in inventory 
                          if item_id.startswith('G'))
        total_parts = sum(inventory.get(item_id, 0) for item_id in inventory 
                         if not item_id.startswith('G'))
        
        gadgets_text = f"""🎒 Управление гаджетами:

📱 Гаджеты ({total_gadgets}/5):
{"Нет гаджетов" if not gadgets else "\n".join(gadgets)}

🔧 Запчасти ({total_parts}/20):
{"Нет запчастей" if not parts else "\n".join(parts)}

🎯 Текущие характеристики:"""
        
        for stat, value in stats.items():
            gadgets_text += f"\n{config.STAT_TRANSLATIONS[stat]}: {value}"
        
        # Создаем клавиатуру с кнопками для управления гаджетами
        builder = InlineKeyboardBuilder()
        for item_id, count in inventory.items():
            if item_id.startswith('G'):  # Только для гаджетов
                item_info = parts_storage.get(item_id, {})
                is_equipped = item_id in equipped_gadgets
                action = "unequip" if is_equipped else "equip"
                button_text = f"{'❌ Снять' if is_equipped else '✅ Надеть'} {item_info.get('name', 'Неизвестный гаджет')}"
                builder.button(
                    text=button_text,
                    callback_data=f"gadget_{action}_{item_id}"
                )
        builder.adjust(1)
        
        await message.reply(gadgets_text, reply_markup=builder.as_markup())
        
    except Exception as e:
        logger.error(f"Error in gadgets command: {e}")
        await message.reply("Произошла ошибка при получении списка гаджетов. Попробуйте позже.")
    finally:
        conn.close()

@router.callback_query(F.data.startswith("gadget_"))
async def process_gadget_action(callback: CallbackQuery) -> None:
    """Обработка действий с гаджетами (надевание/снятие)"""
    await callback.answer()
    
    conn = sqlite3.connect(config.DATABASE_NAME)
    cursor = conn.cursor()
    
    try:
        _, action, gadget_id = callback.data.split('_')
        
        # Получаем данные игрока
        cursor.execute('''
        SELECT inventory, parts_storage, equipped_gadgets, stats
        FROM players WHERE user_id = ?
        ''', (callback.from_user.id,))
        inventory_json, parts_storage_json, equipped_gadgets_json, stats_json = cursor.fetchone()
        
        inventory = json.loads(inventory_json)
        parts_storage = json.loads(parts_storage_json)
        equipped_gadgets = json.loads(equipped_gadgets_json) if equipped_gadgets_json else {}
        stats = json.loads(stats_json)
        
        # Получаем информацию о гаджете
        gadget_info = parts_storage.get(gadget_id, {})
        if not gadget_info:
            await callback.message.edit_text("Ошибка: гаджет не найден")
            return
        
        if action == "equip":
            # Проверяем, есть ли гаджет в инвентаре
            if gadget_id not in inventory or inventory[gadget_id] <= 0:
                await callback.message.edit_text("Ошибка: гаджет отсутствует в инвентаре")
                return
            
            # Добавляем гаджет в надетые
            equipped_gadgets[gadget_id] = gadget_info
            
            # Добавляем характеристики гаджета к характеристикам игрока
            for stat, value in gadget_info['stats'].items():
                if stat not in stats:
                    stats[stat] = 0
                stats[stat] += value
            
            success_message = f"✅ Гаджет {gadget_info['name']} успешно надет!"
            
        else:  # unequip
            # Проверяем, надет ли гаджет
            if gadget_id not in equipped_gadgets:
                await callback.message.edit_text("Ошибка: гаджет не надет")
                return
            
            # Удаляем гаджет из надетых
            del equipped_gadgets[gadget_id]
            
            # Убираем характеристики гаджета из характеристик игрока
            for stat, value in gadget_info['stats'].items():
                if stat in stats:
                    stats[stat] -= value
            
            success_message = f"✅ Гаджет {gadget_info['name']} успешно снят!"
        
        # Обновляем данные в базе
        cursor.execute('''
        UPDATE players 
        SET equipped_gadgets = ?,
            stats = ?
        WHERE user_id = ?
        ''', (json.dumps(equipped_gadgets), json.dumps(stats), callback.from_user.id))
        
        conn.commit()
        
        # Обновляем сообщение с новым списком гаджетов
        await cmd_gadgets(callback.message)
        
        # Отправляем сообщение об успехе
        await callback.message.answer(success_message)
        
    except Exception as e:
        logger.error(f"Error in process_gadget_action: {e}")
        await callback.message.edit_text("Произошла ошибка при выполнении действия с гаджетом")
    finally:
        conn.close()

@router.message(Command("g"))
async def cmd_g(message: Message) -> None:
    """Алиас для команды /gadgets"""
    await cmd_gadgets(message)

def is_company_ceo(user_id: int, conn: sqlite3.Connection) -> bool:
    """Проверяет, является ли пользователь CEO компании"""
    cursor = conn.cursor()
    cursor.execute('''
        SELECT role 
        FROM company_employees 
        WHERE user_id = ? AND status = 'active' AND role = 'CEO'
    ''', (user_id,))
    return cursor.fetchone() is not None

@router.message(Command("company"))
async def company_command(message: Message, state: FSMContext):
    """Обработчик команды /company"""
    user_id = message.from_user.id
    conn = None
    try:
        conn = get_db_connection()
        if not conn:
            await message.reply("Ошибка подключения к базе данных")
            return

        cursor = conn.cursor()
        
        # Получаем информацию о компании пользователя
        cursor.execute('''
            SELECT c.company_id, c.name, c.level, c.experience, c.balance,
                   ce.role, (SELECT COUNT(*) FROM company_employees 
                            WHERE company_id = c.company_id AND status = 'active') as employee_count
            FROM companies c
            JOIN company_employees ce ON c.company_id = ce.company_id
            WHERE ce.user_id = ? AND ce.status = 'active'
        ''', (user_id,))
        
        company_data = cursor.fetchone()
        
        if not company_data:
            # Если у пользователя нет компании, показываем меню создания/вступления
            builder = InlineKeyboardBuilder()
            builder.button(text="Создать компанию 🏢", callback_data="create_company")
            builder.button(text="Вступить в компанию 👥", callback_data="join_company")
            builder.button(text="🔙 Назад", callback_data="return_to_menu")
            builder.adjust(1)
            
            await message.reply(
                "У вас пока нет компании. Выберите действие:",
                reply_markup=builder.as_markup()
            )
            await state.set_state(UserStates.COMPANY_MENU)
            return
            
        # Распаковываем данные компании
        company_id, company_name, level, experience, balance, role, employee_count = company_data
        
        # Формируем сообщение
        message_text = f"🏢 Компания: {company_name}\n"
        message_text += f"🎊 Уровень: {level}\n"
        message_text += f"📈 Опыт: {experience}\n"
        message_text += f"💰 Баланс: {balance:,} Gram\n"
        message_text += f"👥 Сотрудники: {employee_count}/10\n"
        message_text += f"🎯 Ваша роль: {role}\n"
        
        # Создаем клавиатуру
        builder = InlineKeyboardBuilder()
        builder.button(text="Финансы 💰", callback_data="company_finances")
        builder.button(text="Управление 👥", callback_data="company_management")
        builder.button(text="Производство 🏭", callback_data="company_production")
        builder.button(text="Склад 📦", callback_data="company_storage")
        builder.button(text="Лаборатория 🔬", callback_data="company_lab")
        builder.button(text="Хакатон 🏆", callback_data="company_hackathon")
        builder.button(text="Еженедельные задания 📋", callback_data="company_weekly")
        builder.button(text="🔙 Назад", callback_data="return_to_menu")
        builder.adjust(2)
        
        await message.reply(message_text, reply_markup=builder.as_markup())
        await state.set_state(UserStates.COMPANY_MENU)
        
    except Exception as e:
        logger.error(f"Database error in company_command for user {user_id}: {e}")
        await message.reply("Произошла ошибка при получении информации о компании")
    finally:
        if conn:
            conn.close()

@router.message(F.text == BUTTON_COMPANY)
async def handle_company_button(message: Message, state: FSMContext):
    """Обработчик кнопки Компания"""
    try:
        await company_command(message, state)
    except Exception as e:
        user_id = message.from_user.id
        logger.error(f"Error in handle_company_button for user {user_id}: {e}")
        await message.answer("❌ Произошла ошибка при открытии меню компании")

@router.callback_query(F.data == "add_company_funds")
async def company_add_funds(callback: CallbackQuery, state: FSMContext):
    """Обработчик кнопки Пополнить баланс"""
    user = callback.from_user
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        
        # Проверяем, является ли пользователь CEO
        if not is_company_ceo(user.id, conn):
            await callback.answer("У вас нет прав для пополнения баланса компании")
            return
        
        # Получаем данные о компании и балансе игрока
        cursor.execute('''
            SELECT c.company_id, c.company_data, p.gram_balance
            FROM companies c
            JOIN company_employees ce ON c.company_id = ce.company_id
            JOIN players p ON p.user_id = ?
            WHERE ce.user_id = ? AND ce.status = 'active' AND ce.role = 'CEO'
        ''', (user.id, user.id))
        result = cursor.fetchone()
        
        if not result:
            await callback.answer("Компания не найдена")
            return
            
        company_id, company_data, player_balance = result
        company = Company.from_dict(json.loads(company_data))
        
        # Создаем клавиатуру
        builder = InlineKeyboardBuilder()
        builder.button(text="◀️ Назад", callback_data="company_finances")
        
        await state.set_state(UserStates.COMPANY_ADD_FUNDS)
        await callback.message.edit_text(
            f"💰 Пополнение баланса компании\n\n"
            f"Ваш баланс: {player_balance:,.0f} Gram\n"
            f"Баланс компании: {company.balance:,.0f} Gram\n\n"
            f"Введите сумму для пополнения баланса компании:",
            reply_markup=builder.as_markup()
        )
        
    except Exception as e:
        logger.error(f"Ошибка при открытии пополнения баланса: {e}")
        await callback.answer("Произошла ошибка при получении данных")
    finally:
        conn.close()

@router.callback_query(F.data == "company_back")
async def company_back(callback: CallbackQuery, state: FSMContext):
    """Обработка возврата в меню компании"""
    await state.set_state(UserStates.COMPANY_MENU)
    keyboard = get_company_menu_keyboard()
    await callback.message.edit_text(
        "🏢 Меню компании",
        reply_markup=keyboard
    )

@router.callback_query(F.data == "company_management")
async def company_management(callback: CallbackQuery, state: FSMContext):
    """Обработчик кнопки Управление"""
    user = callback.from_user
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        logger.debug(f"Пользователь {user.id} пытается открыть меню управления")
        
        # Проверяем, является ли пользователь CEO
        if not is_company_ceo(user.id, conn):
            await callback.answer("У вас нет прав для управления компанией")
            return
            
        # Получаем данные о компании
        cursor.execute('''
            SELECT c.company_id, c.company_data
            FROM companies c
            JOIN company_employees ce ON c.company_id = ce.company_id
            WHERE ce.user_id = ? AND ce.status = 'active' AND ce.role = 'CEO'
        ''', (user.id,))
        result = cursor.fetchone()
        
        logger.debug(f"Результат запроса компании: {result}")
        
        if not result:
            await callback.answer("Компания не найдена")
            return
            
        company_id, company_data = result
        company = Company.from_dict(json.loads(company_data))
        
        logger.debug(f"Данные компании: {company.to_dict()}")
        
        # Получаем список заявок на вступление
        cursor.execute('''
            SELECT user_id, created_at 
            FROM company_applications 
            WHERE company_id = ? AND status = 'pending'
        ''', (company_id,))
        applications = cursor.fetchall()
        
        logger.debug(f"Заявки на вступление: {applications}")
        
        # Форматируем информацию о сотрудниках и заявках
        management_info = f"👥 Сотрудники ({len(company.employees)}/{company.max_employees}):\n\n"
        
        for employee_id in company.employees:
            cursor.execute('SELECT display_name FROM players WHERE user_id = ?', (employee_id,))
            employee_name = cursor.fetchone()[0]
            salary = company.employee_salaries.get(str(employee_id), 0)
            management_info += f"- {employee_name} | Зарплата: {salary:,.0f} Gram/нед | /fire_{employee_id}\n"
        
        if applications:
            management_info += "\n📝 Заявки на вступление:\n"
            for user_id, created_at in applications:
                cursor.execute('SELECT display_name FROM players WHERE user_id = ?', (user_id,))
                applicant_name = cursor.fetchone()[0]
                management_info += f"- {applicant_name} | /accept_{user_id} | /reject_{user_id}\n"
        
        # Создаем клавиатуру
        builder = InlineKeyboardBuilder()
        builder.button(text="Установить зарплату 💰", callback_data="company_set_salary")
        builder.button(text="Назад ↩️", callback_data="company_back")
        
        await callback.message.edit_text(
            management_info,
            reply_markup=builder.as_markup()
        )
        
    except Exception as e:
        logger.error(f"Ошибка при открытии меню управления: {e}")
        await callback.answer("Произошла ошибка при загрузке информации об управлении")
    finally:
        conn.close()

@router.callback_query(F.data == "company_stats")
async def company_stats(callback: CallbackQuery, state: FSMContext):
    """Отображает статистику компании"""
    try:
        conn = get_db_connection()
        if not conn:
            await callback.message.edit_text(
                "Ошибка подключения к базе данных. Попробуйте позже.",
                reply_markup=InlineKeyboardBuilder().button(
                    text="🔙 Назад", callback_data="company_back"
                ).as_markup()
            )
            return

        cursor = conn.cursor()
        
        # Получаем данные о компании
        cursor.execute('''
            SELECT c.company_data,
                   COUNT(DISTINCT ce.user_id) as employee_count,
                   COUNT(DISTINCT cb.blueprint_id) as blueprints_count,
                   COUNT(DISTINCT cs.item_name) as storage_count
            FROM companies c
            LEFT JOIN company_employees ce ON c.company_id = ce.company_id
            LEFT JOIN company_blueprints cb ON c.company_id = cb.company_id
            LEFT JOIN company_storage cs ON c.company_id = cs.company_id
            WHERE c.company_id = (
                SELECT company_id 
                FROM company_employees 
                WHERE user_id = ?
            )
            GROUP BY c.company_id
        ''', (callback.from_user.id,))
        
        result = cursor.fetchone()
        if not result:
            await callback.message.edit_text(
                "Компания не найдена.",
                reply_markup=InlineKeyboardBuilder().button(
                    text="🔙 Назад", callback_data="company_back"
                ).as_markup()
            )
            return
            
        company_data, emp_count, blueprint_count, storage_count = result
        company = Company.from_dict(json.loads(company_data))
        
        # Получаем информацию о следующем уровне
        next_level_data = COMPANY_LEVELS.get(company.level + 1, None)
        level_progress = ""
        if next_level_data:
            exp_progress = (company.experience / next_level_data["required_exp"]) * 100
            gram_progress = (company.balance / next_level_data["required_gram"]) * 100
            level_progress = f"\n📊 Прогресс до следующего уровня:\n" \
                           f"- Опыт: {company.experience}/{next_level_data['required_exp']} ({exp_progress:.1f}%)\n" \
                           f"- Gram: {company.balance:,.0f}/{next_level_data['required_gram']:,.0f} ({gram_progress:.1f}%)"
        
        stats_text = (
            f"📊 Статистика компании {company.name}\n\n"
            f"🎖 Уровень: {company.level}\n"
            f"⭐️ Опыт: {company.experience:,}\n"
            f"💰 Баланс: {company.balance:,.0f} Gram\n"
            f"👥 Сотрудников: {emp_count}/{company.max_employees}\n"
            f"📋 Чертежей: {blueprint_count}\n"
            f"📦 Предметов на складе: {storage_count}/{company.storage_capacity}\n"
            f"{level_progress}"
        )
        
        await callback.message.edit_text(
            stats_text,
            reply_markup=InlineKeyboardBuilder().button(
                text="🔙 Назад", callback_data="company_back"
            ).as_markup()
        )
        
    except Exception as e:
        logger.error(f"Error in company_stats: {e}")
        await callback.message.edit_text(
            "Произошла ошибка при получении статистики.",
            reply_markup=InlineKeyboardBuilder().button(
                text="🔙 Назад", callback_data="company_back"
            ).as_markup()
        )
    finally:
        if conn:
            conn.close()

# Инициализация менеджера хакатона
hackathon_manager = None

@router.startup()
async def startup_event():
    global hackathon_manager
    hackathon_manager = HackathonManager(bot, get_db_connection())
    asyncio.create_task(hackathon_manager.check_hackathon_schedule())

@router.callback_query(F.data == "company_hackathon")
async def company_hackathon(callback: CallbackQuery, state: FSMContext):
    """Обработчик кнопки Хакатон"""
    user = callback.from_user
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        
        # Проверяем, является ли пользователь CEO
        cursor.execute('''
            SELECT ce.company_id, ce.role
            FROM company_employees ce
            WHERE ce.user_id = ? AND ce.status = 'active'
        ''', (user.id,))
        
        result = cursor.fetchone()
        if not result:
            await callback.answer("Вы не являетесь сотрудником компании")
            return
            
        company_id, role = result
        is_ceo = role == "CEO"
        
        # Получаем данные о компании
        cursor.execute('''
            SELECT c.company_data
            FROM companies c
            WHERE c.company_id = ?
        ''', (company_id,))
        
        result = cursor.fetchone()
        if not result:
            await callback.answer("Компания не найдена")
            return
            
        company = json.loads(result[0])
        
        # Формируем сообщение
        message_text = (
            "🏆 Хакатон\n\n"
            "Хакатон проводится дважды в неделю:\n"
            "📅 Вторник и Пятница\n"
            "🕐 Начало в 12:10\n\n"
            "Правила:\n"
            "1. Только CEO может зарегистрировать компанию\n"
            "2. После регистрации все сотрудники могут участвовать\n"
            "3. В течение часа собираются характеристики всех участников\n"
            "4. Победители получают награды:\n"
            "   🥇 1 место: 50,000 Gram, 2,000 опыта\n"
            "   🥈 2 место: 30,000 Gram, 1,500 опыта\n"
            "   🥉 3 место: 20,000 Gram, 1,000 опыта\n\n"
            f"Статус: {'✅ Участвуем' if company_id in hackathon_manager.participants else '❌ Не участвуем'}"
        )
        
        # Создаем клавиатуру
        keyboard = hackathon_manager.get_hackathon_keyboard(company_id, is_ceo)
        
        await callback.message.edit_text(
            message_text,
            reply_markup=keyboard
        )
        
    except Exception as e:
        logger.error(f"Ошибка при открытии меню хакатона: {e}")
        await callback.answer("Произошла ошибка при загрузке информации о хакатоне")
    finally:
        conn.close()

@router.callback_query(F.data.startswith("hackathon_"))
async def handle_hackathon_callback(callback: CallbackQuery):
    """Обработчик callback-запросов хакатона"""
    await hackathon_manager.handle_hackathon_callback(callback.data, callback.from_user.id)

async def move_blueprint_to_storage(company_id: int, blueprint_name: str, conn: sqlite3.Connection) -> bool:
    """Перемещает завершенный чертеж в хранилище"""
    try:
        cursor = conn.cursor()
        
        # Получаем информацию о чертеже
        cursor.execute('''
            SELECT gadget_type, progress_data
            FROM company_blueprints
            WHERE company_id = ? AND blueprint_name = ? AND status = 'in_progress'
        ''', (company_id, blueprint_name))
        result = cursor.fetchone()
        
        if not result:
            return False
            
        gadget_type, progress_data = result
        progress_data = json.loads(progress_data) if progress_data else {}
        
        # Проверяем, что все характеристики достигли 100%
        blueprint_data = GADGET_BLUEPRINTS.get(gadget_type, {}).get(blueprint_name, {})
        requirements = blueprint_data.get("requirements", {})
        
        if not all(progress_data.get(stat, 0) >= 100 for stat in requirements.keys()):
            return False
            
        # Перемещаем чертеж в хранилище
        cursor.execute('''
            INSERT INTO company_storage (company_id, blueprint_id, gadget_type, blueprint_name)
            SELECT company_id, blueprint_id, gadget_type, blueprint_name
            FROM company_blueprints
            WHERE company_id = ? AND blueprint_name = ? AND status = 'in_progress'
        ''', (company_id, blueprint_name))
        
        # Обновляем статус чертежа
        cursor.execute('''
            UPDATE company_blueprints
            SET status = 'completed'
            WHERE company_id = ? AND blueprint_name = ? AND status = 'in_progress'
        ''', (company_id, blueprint_name))
        
        conn.commit()
        return True
        
    except Exception as e:
        logger.error(f"Ошибка в move_blueprint_to_storage: {e}")
        return False



@router.callback_query(F.data.startswith("start_blueprint_"))
async def handle_start_blueprint_development(callback: CallbackQuery, state: FSMContext):
    """Начинает разработку выбранного чертежа"""
    try:
        user_id = callback.from_user.id
        blueprint_name = callback.data.replace("start_blueprint_", "")
        
        # Используем функцию из blueprint_development.py
        success, message = await start_blueprint_dev(user_id, blueprint_name)
        if success:
            # Если разработка успешно начата, показываем прогресс
            message, markup = await update_blueprint_progress(user_id, blueprint_name)
            await callback.message.edit_text(message, reply_markup=markup)
        else:
            # Если произошла ошибка, показываем сообщение об ошибке
            await callback.answer(message, show_alert=True)
            
    except Exception as e:
        logger.error(f"Ошибка в start_blueprint_development: {e}")
        await callback.answer("Произошла ошибка при начале разработки чертежа", show_alert=True)

@router.callback_query(UserStates.JOINING_COMPANY, F.data.startswith("apply_company_"))
async def apply_to_company(callback: CallbackQuery, state: FSMContext) -> None:
    """Обработка заявки на вступление в компанию"""
    try:
        company_id = int(callback.data.split('_')[2])
        
        conn = sqlite3.connect(config.DATABASE_NAME)
        cursor = conn.cursor()
        
        # Проверяем, не состоит ли игрок уже в компании
        cursor.execute('''
            SELECT company_id FROM company_members
            WHERE user_id = ?
        ''', (callback.from_user.id,))
        
        if cursor.fetchone():
            await callback.message.edit_text(
                "❌ Вы уже состоите в компании!",
                reply_markup=InlineKeyboardBuilder()
                .button(text="🔙 Назад", callback_data="return_to_menu")
                .as_markup()
            )
            return
        
        # Проверяем существование компании
        cursor.execute('SELECT name FROM companies WHERE company_id = ?',
                      (company_id,))
        company = cursor.fetchone()
        
        if not company:
            await callback.message.edit_text(
                "❌ Компания не найдена.",
                reply_markup=InlineKeyboardBuilder()
                .button(text="🔙 Назад", callback_data="return_to_menu")
                .as_markup()
            )
            return
        
        # Создаём заявку на вступление
        cursor.execute('''
            INSERT INTO company_applications 
            (company_id, user_id, status, created_at)
            VALUES (?, ?, 'pending', ?)
        ''', (company_id, callback.from_user.id, datetime.now().isoformat()))
        
        conn.commit()
        conn.close()
        
        await state.set_state(UserStates.MAIN_MENU)
        await callback.message.edit_text(
            f"✅ Заявка на вступление в компанию «{company[0]}» отправлена!\n"
            "Ожидайте решения руководства.",
            reply_markup=InlineKeyboardBuilder()
            .button(text="🔙 В меню", callback_data="return_to_menu")
            .as_markup()
        )
        
    except Exception as e:
        logger.error(f"Error in apply_to_company: {e}")
        await callback.message.edit_text(
            "❌ Произошла ошибка при подаче заявки.",
            reply_markup=InlineKeyboardBuilder()
            .button(text="🔙 Назад", callback_data="return_to_menu")
            .as_markup()
        )

@router.message(UserStates.COMPANY_ADD_FUNDS)
async def process_company_add_funds(message: Message, state: FSMContext):
    """Обработчик ввода суммы пополнения баланса компании"""
    user = message.from_user
    try:
        amount = float(message.text)
        if amount <= 0:
            await message.reply("❌ Сумма должна быть больше 0")
            return
            
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Проверяем баланс игрока и получаем данные компании
        cursor.execute('''
            SELECT c.company_id, c.company_data, p.gram_balance
            FROM companies c
            JOIN players p ON p.user_id = ?
            WHERE c.owner_id = ?
        ''', (user.id, user.id))
        result = cursor.fetchone()
        
        if not result:
            await message.reply("❌ Компания не найдена или вы не являетесь владельцем")
            return
            
        company_id, company_data, player_balance = result
        
        if player_balance < amount:
            await message.reply(
                f"❌ Недостаточно средств!\n"
                f"Требуется: {amount:,.0f} Gram\n"
                f"Доступно: {player_balance:,.0f} Gram"
            )
            return
            
        company = Company.from_dict(json.loads(company_data))
        
        # Обновляем балансы
        company.balance += amount
        cursor.execute('''
            UPDATE players 
            SET gram_balance = gram_balance - ? 
            WHERE user_id = ?
        ''', (amount, user.id))
        
        cursor.execute('''
            UPDATE companies 
            SET company_data = ? 
            WHERE company_id = ?
        ''', (json.dumps(company.to_dict()), company_id))
        
        conn.commit()
        
        # Создаем клавиатуру
        builder = InlineKeyboardBuilder()
        builder.button(text="◀️ Назад в финансы", callback_data="company_finances")
        
        await message.reply(
            f"✅ Баланс компании успешно пополнен!\n\n"
            f"💰 Сумма пополнения: {amount:,.0f} Gram\n"
            f"💳 Новый баланс компании: {company.balance:,.0f} Gram",
            reply_markup=builder.as_markup()
        )
        
        await state.set_state(UserStates.COMPANY_MENU)
        
    except ValueError:
        await message.reply("❌ Пожалуйста, введите корректное число")
    except Exception as e:
        logger.error(f"Ошибка при пополнении баланса компании: {e}")
        await message.reply("❌ Произошла ошибка при пополнении баланса")
    finally:
        if 'conn' in locals():
            conn.close()

@router.callback_query(F.data == "company_set_salary")
async def company_set_salary(callback: CallbackQuery, state: FSMContext):
    """Обработчик кнопки установки зарплаты"""
    user_id = callback.from_user.id
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        
        # Проверяем, является ли пользователь владельцем компании
        cursor.execute('''
            SELECT c.company_id, c.company_data 
            FROM companies c 
            WHERE c.owner_id = ?
        ''', (user_id,))
        result = cursor.fetchone()
        
        if not result:
            await callback.message.edit_text(
                "У вас нет прав для установки зарплаты!",
                reply_markup=InlineKeyboardMarkup(inline_keyboard=[
                    [InlineKeyboardButton(text="◀️ Назад", callback_data="company_finances")]
                ])
            )
            return
            
        company_id, company_data = result
        company = Company.from_dict(json.loads(company_data))
        
        # Получаем список сотрудников компании, включая CEO
        cursor.execute('''
            SELECT u.user_id, u.display_name, ce.role
            FROM company_employees ce
            JOIN players u ON ce.user_id = u.user_id
            WHERE ce.company_id = ?
        ''', (company_id,))
        employees = cursor.fetchall()
        
        if not employees:
            await callback.message.edit_text(
                "В компании нет сотрудников для установки зарплаты!",
                reply_markup=InlineKeyboardMarkup(inline_keyboard=[
                    [InlineKeyboardButton(text="◀️ Назад", callback_data="company_finances")]
                ])
            )
            return
        
        # Создаем клавиатуру со списком сотрудников, включая CEO
        keyboard = []
        for emp_id, emp_name, role in employees:
            current_salary = company.employee_salaries.get(str(emp_id), 0)
            keyboard.append([
                InlineKeyboardButton(
                    text=f"{emp_name} - {current_salary:,.0f} Gram/день",
                    callback_data=f"salary_{emp_id}"
                )
            ])
        
        keyboard.append([InlineKeyboardButton(text="◀️ Назад", callback_data="company_finances")])
        
        await callback.message.edit_text(
            "👥 Выберите сотрудника для установки зарплаты:",
            reply_markup=InlineKeyboardMarkup(inline_keyboard=keyboard)
        )
        
    except Exception as e:
        logger.error(f"Ошибка при открытии меню установки зарплаты: {e}")
        await callback.message.edit_text(
            "Произошла ошибка при получении списка сотрудников",
            reply_markup=InlineKeyboardMarkup(inline_keyboard=[
                [InlineKeyboardButton(text="◀️ Назад", callback_data="company_finances")]
            ])
        )
    finally:
        conn.close()

@router.callback_query(F.data.startswith("salary_"))
async def select_employee_salary(callback: CallbackQuery, state: FSMContext):
    """Обработчик выбора сотрудника для установки зарплаты"""
    user_id = callback.from_user.id
    employee_id = int(callback.data.split('_')[1])
    
    # Сохраняем ID сотрудника в состоянии
    await state.update_data(selected_employee_id=employee_id)
    await state.set_state(UserStates.ENTERING_SALARY)
    
    await callback.message.edit_text(
        "💰 Введите сумму ежедневной зарплаты в Gram для сотрудника:\n"
        "Минимальная зарплата: 1 Gram/день\n"
        "Максимальная зарплата: 1000 Gram/день",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="◀️ Назад", callback_data="company_set_salary")]
        ])
    )

@router.message(UserStates.ENTERING_SALARY)
async def process_salary_input(message: Message, state: FSMContext):
    """Обработчик ввода суммы зарплаты"""
    user_id = message.from_user.id
    conn = get_db_connection()
    try:
        # Получаем ID выбранного сотрудника из состояния
        state_data = await state.get_data()
        employee_id = state_data.get('selected_employee_id')
        
        # Проверяем корректность введенной суммы
        try:
            salary = float(message.text)
            if salary < 1 or salary > 1000:
                await message.reply(
                    "❌ Зарплата должна быть от 1 до 1000 Gram в день!",
                    reply_markup=InlineKeyboardMarkup(inline_keyboard=[
                        [InlineKeyboardButton(text="◀️ Назад", callback_data="company_set_salary")]
                    ])
                )
                return
        except ValueError:
            await message.reply(
                "❌ Пожалуйста, введите корректное число!",
                reply_markup=InlineKeyboardMarkup(inline_keyboard=[
                    [InlineKeyboardButton(text="◀️ Назад", callback_data="company_set_salary")]
                ])
            )
            return
        
        cursor = conn.cursor()
        
        # Получаем данные компании
        cursor.execute('''
            SELECT c.company_id, c.company_data 
            FROM companies c 
            WHERE c.owner_id = ?
        ''', (user_id,))
        result = cursor.fetchone()
        
        if not result:
            await message.reply(
                "❌ У вас нет прав для установки зарплаты!",
                reply_markup=InlineKeyboardMarkup(inline_keyboard=[
                    [InlineKeyboardButton(text="◀️ Назад", callback_data="company_finances")]
                ])
            )
            return
            
        company_id, company_data = result
        company = Company.from_dict(json.loads(company_data))
        
        # Проверяем, достаточно ли средств для выплаты зарплаты
        if company.balance < salary:
            await message.reply(
                "❌ На счету компании недостаточно средств для установки такой зарплаты!",
                reply_markup=InlineKeyboardMarkup(inline_keyboard=[
                    [InlineKeyboardButton(text="◀️ Назад", callback_data="company_set_salary")]
                ])
            )
            return
        
        # Устанавливаем зарплату
        company.employee_salaries[str(employee_id)] = salary
        
        # Сохраняем обновленные данные компании
        cursor.execute('''
            UPDATE companies 
            SET company_data = ? 
            WHERE company_id = ?
        ''', (json.dumps(company.to_dict()), company_id))
        conn.commit()
        
        # Получаем имя сотрудника
        cursor.execute('SELECT display_name FROM players WHERE user_id = ?', (employee_id,))
        employee_name = cursor.fetchone()[0]
        
        # Создаем клавиатуру
        builder = InlineKeyboardBuilder()
        builder.button(text="◀️ Назад к финансам", callback_data="company_finances")
        builder.button(text="Установить другую зарплату", callback_data="company_set_salary")
        builder.adjust(1)
        
        await message.reply(
            f"✅ Зарплата для сотрудника {employee_name} установлена: {salary:,.0f} Gram/день",
            reply_markup=builder.as_markup()
        )
        
        await state.set_state(UserStates.COMPANY_MENU)
        
    except Exception as e:
        logger.error(f"Ошибка при установке зарплаты: {e}")
        await message.reply(
            "❌ Произошла ошибка при установке зарплаты",
            reply_markup=InlineKeyboardMarkup(inline_keyboard=[
                [InlineKeyboardButton(text="◀️ Назад", callback_data="company_finances")]
            ])
        )
    finally:
        conn.close()

@router.callback_query(F.data == "company_storage")
async def company_storage(callback: CallbackQuery, state: FSMContext):
    """Показывает склад компании"""
    conn = None
    try:
        conn = get_db_connection()
        if not conn:
            await callback.answer("Ошибка подключения к базе данных")
            return

        cursor = conn.cursor()
        
        # Получаем информацию о компании
        cursor.execute('''
            SELECT c.company_id, c.name, c.company_data
            FROM companies c
            WHERE c.company_id IN (
                SELECT company_id 
                FROM company_employees 
                WHERE user_id = ?
            )
        ''', (callback.from_user.id,))
        company_data = cursor.fetchone()
        
        if not company_data:
            await callback.answer("Вы не состоите в компании")
            return
            
        company_id, company_name, company_json = company_data
        company = Company.from_dict(json.loads(company_json))
        
        # Получаем информацию о предметах на складе
        cursor.execute('''
            SELECT item_type, item_name, added_date
            FROM company_storage
            WHERE company_id = ?
        ''', (company_id,))
        storage_items = cursor.fetchall()
        
        # Формируем сообщение
        storage_message = (
            f"📦 Склад компании {company_name}🔧\n\n"
            f"Использовано места: {company.storage_used}/{company.storage_capacity}\n\n"
            f"Предметы на складе:\n"
        )
        
        if storage_items:
            for item_type, item_name, added_date in storage_items:
                storage_message += format_gadget_info(item_name, item_type, added_date)
        else:
            storage_message += "\nСклад пуст"
        
        # Создаем клавиатуру
        builder = InlineKeyboardBuilder()
        builder.button(text="🔄 Продать предметы", callback_data="sell_items")
        builder.button(text="Назад ↩️", callback_data="company_back")
        builder.adjust(1)
        
        await callback.message.edit_text(
            storage_message,
            reply_markup=builder.as_markup()
        )
        
    except Exception as e:
        logger.error(f"Error in company_storage: {e}")
        await callback.answer("Произошла ошибка при получении данных склада")
    finally:
        if conn:
            conn.close()

async def update_all_progress_messages():
    """Обновляет все сообщения о прогрессе разработки"""
    conn = None
    try:
        conn = get_db_connection()
        if not conn:
            logger.error("Failed to connect to database in update_all_progress_messages")
            return

        cursor = conn.cursor()
        
        # Получаем все активные чертежи в разработке
        cursor.execute('''
            SELECT blueprint_id 
            FROM company_blueprints 
            WHERE status = 'in_progress'
        ''')
        active_blueprints = cursor.fetchall()
        
        # Обновляем прогресс для каждого чертежа
        for (blueprint_id,) in active_blueprints:
            await auto_update_blueprint_progress(blueprint_id, conn)
            
    except Exception as e:
        logger.error(f"Error in update_all_progress_messages: {e}")
    finally:
        if conn:
            conn.close()

async def reset_weekly_tasks():
    """Сбрасывает и обновляет еженедельные задания для всех компаний"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Получаем все компании
        cursor.execute("SELECT company_id, company_data FROM companies")
        companies = cursor.fetchall()
        
        for company_id, company_data in companies:
            try:
                company = Company.from_dict(json.loads(company_data))
                
                # Очищаем старые задания
                company.weekly_tasks = []
                
                # Добавляем новые случайные задания (3-5 заданий)
                available_tasks = list(WEEKLY_TASKS.keys())
                num_tasks = random.randint(3, 5)
                selected_tasks = random.sample(available_tasks, num_tasks)
                
                for task_name in selected_tasks:
                    company.add_weekly_task(task_name)
                
                # Сохраняем обновленные данные компании
                updated_data = json.dumps(company.to_dict())
                cursor.execute(
                    "UPDATE companies SET company_data = ? WHERE company_id = ?",
                    (updated_data, company_id)
                )
                
            except Exception as e:
                logger.error(f"Ошибка при обновлении заданий для компании {company_id}: {e}")
                continue
        
        conn.commit()
        logger.info("Еженедельные задания успешно обновлены")
        
    except Exception as e:
        logger.error(f"Ошибка при обновлении еженедельных заданий: {e}")
    finally:
        if 'conn' in locals():
            conn.close()

async def send_salary_notifications():
    """Отправляет зарплаты сотрудникам компаний и обновляет прогресс еженедельных заданий."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Получаем всех активных сотрудников и их компании
        cur.execute("""
            SELECT ce.user_id, ce.company_id, ce.salary, c.company_data, p.display_name
            FROM company_employees ce
            JOIN companies c ON ce.company_id = c.id
            JOIN players p ON ce.user_id = p.user_id
            WHERE ce.status = 'active' AND ce.salary > 0
        """)
        employees = cur.fetchall()
        
        # Группируем сотрудников по компаниям
        company_employees = {}
        for user_id, company_id, salary, company_data, display_name in employees:
            if company_id not in company_employees:
                company_employees[company_id] = []
            company_employees[company_id].append((user_id, salary, display_name))
            
        # Обрабатываем каждую компанию
        for company_id, employees_data in company_employees.items():
            try:
                company_data = json.loads(company_data)
                total_salary = sum(salary for _, salary, _ in employees_data)
                
                # Проверяем баланс компании
                if company_data.get('balance', 0) < total_salary:
                    continue
                    
                # Считаем количество активных сотрудников
                active_employees = len(employees_data)
                
                # Обновляем прогресс задания "Оптимизация производства"
                if 'weekly_tasks' not in company_data:
                    company_data['weekly_tasks'] = {
                        "Разработка нового продукта": 0,
                        "Оптимизация производства": 0
                    }
                
                # Увеличиваем прогресс на 10% за каждого активного сотрудника
                company_data['weekly_tasks']['Оптимизация производства'] = min(
                    100,
                    company_data['weekly_tasks']['Оптимизация производства'] + (active_employees * 10)
                )
                
                # Если задание выполнено, начисляем награду
                if company_data['weekly_tasks']['Оптимизация производства'] >= 100:
                    company_data['balance'] += WEEKLY_TASKS['Оптимизация производства']['reward']
                    company_data['experience'] += WEEKLY_TASKS['Оптимизация производства']['exp']
                
                # Обновляем баланс компании и отправляем зарплаты
                company_data['balance'] -= total_salary
                
                # Обновляем данные компании в БД
                cur.execute(
                    "UPDATE companies SET company_data = ? WHERE id = ?",
                    (json.dumps(company_data), company_id)
                )
                
                # Отправляем зарплату каждому сотруднику
                for user_id, salary, display_name in employees_data:
                    cur.execute(
                        "UPDATE players SET balance = balance + ? WHERE user_id = ?",
                        (salary, user_id)
                    )
                    try:
                        await bot.send_message(
                            user_id,
                            f"💰 Получена зарплата: {salary:,} кредитов"
                        )
                    except Exception as e:
                        logging.error(f"Error sending salary notification to user {user_id}: {e}")
                
                conn.commit()
                
            except Exception as e:
                logging.error(f"Error processing company {company_id}: {e}")
                continue
                
    except Exception as e:
        logging.error(f"Error in send_salary_notifications: {e}")
    finally:
        if conn:
            conn.close()

@router.callback_query(F.data == "company_weekly")
async def company_weekly_tasks(callback: CallbackQuery, state: FSMContext):
    """Обработчик для отображения еженедельных заданий компании"""
    try:
        conn = get_db_connection()
        if not conn:
            await callback.answer("Ошибка подключения к базе данных", show_alert=True)
            return
            
        cursor = conn.cursor()
        
        # Получаем ID компании пользователя
        cursor.execute('''
            SELECT c.company_id, c.name, c.company_data, c.owner_id
            FROM companies c
            JOIN company_employees ce ON c.company_id = ce.company_id
            WHERE ce.user_id = ? AND ce.status = 'active'
            LIMIT 1
        ''', (callback.from_user.id,))
        
        result = cursor.fetchone()
        if not result:
            await callback.answer("Вы не являетесь сотрудником компании", show_alert=True)
            return
            
        company_id, company_name, company_json, owner_id = result
        company_data = json.loads(company_json) if company_json else {}
        
        # Получаем текущие задания
        weekly_tasks = company_data.get("weekly_tasks", [])
        
        # Формируем сообщение
        message = f"📋 Еженедельные задания компании {company_name}\n\n"
        
        if weekly_tasks:
            for i, task in enumerate(weekly_tasks, 1):
                task_name = task.get("name", "Неизвестное задание")
                task_progress = task.get("progress", 0)
                task_reward = task.get("reward", 0)
                task_exp = task.get("exp", 0)
                task_description = task.get("description", "")
                task_requirements = task.get("required_stats", {})
                
                message += (
                    f"{i}. {task_name}\n"
                    f"   📝 {task_description}\n"
                    f"   📈 Прогресс: {task_progress}%\n"
                    f"   💰 Награда: {task_reward} Gram\n"
                    f"   ⭐️ Опыт: {task_exp}\n"
                    f"   📊 Требования: {', '.join(f'{k}: {v}' for k, v in task_requirements.items())}\n\n"
                )
        else:
            message += "У компании пока нет активных заданий.\n"
            message += "Задания обновляются каждую неделю.\n\n"
            
            # Если пользователь является владельцем компании, показываем кнопку для выбора заданий
            if callback.from_user.id == owner_id:
                message += "Как CEO компании, вы можете выбрать задания для вашей компании."
        
        message += "\nℹ️ Задания обновляются каждую неделю."
        
        # Создаем клавиатуру
        builder = InlineKeyboardBuilder()
        
        # Если пользователь является владельцем компании и нет активных заданий, добавляем кнопку для выбора заданий
        if callback.from_user.id == owner_id and not weekly_tasks:
            builder.button(text="🎯 Выбрать задания", callback_data="select_company_tasks")
            
        builder.button(text="🔙 Назад", callback_data="company_back")
        builder.adjust(1)
        
        # Отправляем сообщение
        await callback.message.edit_text(
            message,
            reply_markup=builder.as_markup()
        )
        
    except Exception as e:
        logger.error(f"Ошибка в company_weekly_tasks: {e}")
        await callback.answer("Произошла ошибка при получении заданий", show_alert=True)
    finally:
        if conn:
            conn.close()

@router.callback_query(F.data.startswith("select_company_tasks"))
async def select_company_tasks(callback: CallbackQuery, state: FSMContext):
    """Обработчик для выбора заданий компании CEO"""
    try:
        conn = get_db_connection()
        if not conn:
            await callback.answer("Ошибка подключения к базе данных", show_alert=True)
            return
            
        cursor = conn.cursor()
        
        # Получаем ID компании пользователя и проверяем, является ли он владельцем
        cursor.execute('''
            SELECT c.company_id, c.name, c.company_data, c.owner_id
            FROM companies c
            JOIN company_employees ce ON c.company_id = ce.company_id
            WHERE ce.user_id = ? AND ce.status = 'active'
            LIMIT 1
        ''', (callback.from_user.id,))
        
        result = cursor.fetchone()
        if not result:
            await callback.answer("Вы не являетесь сотрудником компании", show_alert=True)
            return
            
        company_id, company_name, company_json, owner_id = result
        
        # Проверяем, является ли пользователь владельцем компании
        if callback.from_user.id != owner_id:
            await callback.answer("Только CEO компании может выбирать задания", show_alert=True)
            return
            
        company_data = json.loads(company_json) if company_json else {}
        
        # Формируем сообщение
        message = f"🎯 Выберите задания для компании {company_name}\n\n"
        message += "Выберите 3 задания, которые будут активны для вашей компании на этой неделе:\n\n"
        
        # Создаем клавиатуру с доступными заданиями
        builder = InlineKeyboardBuilder()
        
        for task_name, task_data in WEEKLY_TASKS.items():
            builder.button(
                text=f"{task_name} ({task_data['reward']} Gram)",
                callback_data=f"add_task_{task_name}"
            )
        
        builder.button(text="🔙 Назад", callback_data="company_weekly")
        builder.adjust(1)
        
        # Отправляем сообщение
        await callback.message.edit_text(
            message,
            reply_markup=builder.as_markup()
        )
        
    except Exception as e:
        logger.error(f"Ошибка в select_company_tasks: {e}")
        await callback.answer("Произошла ошибка при выборе заданий", show_alert=True)
    finally:
        if conn:
            conn.close()           

@router.callback_query(F.data.startswith("add_task_"))
async def add_company_task(callback: CallbackQuery, state: FSMContext):
    """Обработчик для добавления задания компании"""
    try:
        task_name = callback.data.replace("add_task_", "")
        
        conn = get_db_connection()
        if not conn:
            await callback.answer("Ошибка подключения к базе данных", show_alert=True)
            return
            
        cursor = conn.cursor()
        
        # Получаем ID компании пользователя и проверяем, является ли он владельцем
        cursor.execute('''
            SELECT c.company_id, c.name, c.company_data, c.owner_id
            FROM companies c
            JOIN company_employees ce ON c.company_id = ce.company_id
            WHERE ce.user_id = ? AND ce.status = 'active'
            LIMIT 1
        ''', (callback.from_user.id,))
        
        result = cursor.fetchone()
        if not result:
            await callback.answer("Вы не являетесь сотрудником компании", show_alert=True)
            return
            
        company_id, company_name, company_json, owner_id = result
        
        # Проверяем, является ли пользователь владельцем компании
        if callback.from_user.id != owner_id:
            await callback.answer("Только CEO компании может выбирать задания", show_alert=True)
            return
            
        company_data = json.loads(company_json) if company_json else {}
        
        # Получаем текущие задания или создаем пустой список
        if "weekly_tasks" not in company_data:
            company_data["weekly_tasks"] = []
        
        weekly_tasks = company_data["weekly_tasks"]
        
        # Проверяем, не выбрано ли уже 3 задания
        if len(weekly_tasks) >= 3:
            await callback.answer("Вы уже выбрали максимальное количество заданий (3)", show_alert=True)
            return
        
        # Проверяем, не выбрано ли уже это задание
        if any(task.get("name") == task_name for task in weekly_tasks):
            await callback.answer("Это задание уже выбрано", show_alert=True)
            return
        
        # Добавляем задание
        task_data = WEEKLY_TASKS[task_name]
        weekly_tasks.append({
            "name": task_name,
            "progress": 0,
            "reward": task_data["reward"],
            "exp": task_data["exp"],
            "description": task_data["description"],
            "required_stats": task_data["required_stats"]
        })
        
        # Сохраняем обновленные данные компании
        company_data["weekly_tasks"] = weekly_tasks
        cursor.execute(
            "UPDATE companies SET company_data = ? WHERE company_id = ?",
            (json.dumps(company_data), company_id)
        )
        conn.commit()
        
        # Отправляем уведомление
        await callback.answer(f"Задание '{task_name}' добавлено", show_alert=True)
        
        # Если выбрано 3 задания, возвращаемся к списку заданий
        if len(weekly_tasks) >= 3:
            await company_weekly_tasks(callback, state)
        else:
            # Иначе обновляем список доступных заданий
            await select_company_tasks(callback, state)
        
    except Exception as e:
        logger.error(f"Ошибка в add_company_task: {e}")
        await callback.answer("Произошла ошибка при добавлении задания", show_alert=True)
    finally:
        if conn:
            conn.close()



@router.callback_query(F.data.startswith("complete_task_"))
async def complete_weekly_task(callback: CallbackQuery, state: FSMContext):
    """Обработчик завершения еженедельного задания"""
    try:
        task_name = callback.data.replace("complete_task_", "")
        
        # Получаем данные компании
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT company_id FROM users WHERE user_id = ?", (callback.from_user.id,))
        result = cursor.fetchone()
        
        if not result:
            await callback.answer("Ошибка: компания не найдена", show_alert=True)
            return
            
        company_id = result[0]
        company = Company.load(company_id)
        
        # Проверяем, является ли пользователь владельцем или менеджером
        if callback.from_user.id not in [company.owner_id] + company.managers:
            await callback.answer("У вас нет прав для выполнения этого действия", show_alert=True)
            return
            
        # Завершаем задание
        success, message = company.complete_weekly_task(task_name)
        
        if success:
            # Сохраняем изменения
            company.save()
            
            # Обновляем сообщение с заданиями
            await company_weekly_tasks(callback, state)
            await callback.answer(message, show_alert=True)
        else:
            await callback.answer(message, show_alert=True)
            
    except Exception as e:
        logger.error(f"Ошибка при завершении задания: {e}")
        await callback.answer("Произошла ошибка при завершении задания", show_alert=True)
    finally:
        if 'conn' in locals():
            conn.close()



@router.callback_query(UserStates.COMPANY_MENU, F.data == "create_company")
async def create_company_handler(callback: CallbackQuery, state: FSMContext) -> None:
    """Обработчик создания компании"""
    user_id = callback.from_user.id
    conn = None
    try:
        conn = get_db_connection()
        if not conn:
            builder = InlineKeyboardBuilder()
            builder.button(text="🔙 Назад", callback_data="return_to_menu")
            await callback.message.edit_text(
                "Ошибка подключения к базе данных. Попробуйте позже.",
                reply_markup=builder.as_markup()
            )
            return

        cursor = conn.cursor()
        logger.info(f"Попытка создания компании пользователем {user_id}")
        
        # Проверяем, есть ли у пользователя уже компания
        cursor.execute('''
            SELECT c.company_id 
            FROM companies c
            WHERE c.owner_id = ?
            UNION
            SELECT c.company_id 
            FROM companies c
            JOIN company_employees ce ON c.company_id = ce.company_id 
            WHERE ce.user_id = ?
        ''', (user_id, user_id))
        
        if cursor.fetchone():
            builder = InlineKeyboardBuilder()
            builder.button(text="🔙 Назад", callback_data="return_to_menu")
            await callback.message.edit_text(
                "У вас уже есть компания!",
                reply_markup=builder.as_markup()
            )
            return
        
        # Проверяем баланс пользователя
        cursor.execute('SELECT gram_balance FROM players WHERE user_id = ?', (user_id,))
        result = cursor.fetchone()
        
        if not result or result[0] < 10000:  # Стоимость создания компании - 10000 Gram
            builder = InlineKeyboardBuilder()
            builder.button(text="🔙 Назад", callback_data="return_to_menu")
            await callback.message.edit_text(
                "Недостаточно средств для создания компании!\n"
                "Необходимо: 10,000 Gram",
                reply_markup=builder.as_markup()
            )
            return
        
        await state.set_state(UserStates.ENTERING_COMPANY_NAME)
        await callback.message.edit_text(
            "Введите название для вашей компании:"
        )
        
    except Exception as e:
        logger.error(f"Ошибка при обработке создания компании: {e}")
        builder = InlineKeyboardBuilder()
        builder.button(text="🔙 Назад", callback_data="return_to_menu")
        await callback.message.edit_text(
            "Произошла ошибка при создании компании",
            reply_markup=builder.as_markup()
        )
    finally:
        if conn:
            conn.close()

@router.message(UserStates.ENTERING_COMPANY_NAME)
async def process_company_name(message: Message, state: FSMContext) -> None:
    """Обработчик ввода имени компании"""
    user_id = message.from_user.id
    company_name = message.text.strip()
    conn = None
    
    try:
        conn = get_db_connection()
        if not conn:
            await message.reply(
                "Ошибка подключения к базе данных. Попробуйте позже.",
                reply_markup=InlineKeyboardBuilder()
                .button(text="🔙 Назад", callback_data="return_to_menu")
                .as_markup()
            )
            return

        cursor = conn.cursor()
        
        # Проверяем длину названия
        if len(company_name) < 3 or len(company_name) > 50:
            await message.reply(
                "Название компании должно быть от 3 до 50 символов.",
                reply_markup=InlineKeyboardBuilder()
                .button(text="🔙 Назад", callback_data="return_to_menu")
                .as_markup()
            )
            return
            
        # Проверяем, не занято ли название
        cursor.execute('SELECT company_id FROM companies WHERE name = ?', (company_name,))
        if cursor.fetchone():
            await message.reply(
                "Это название уже занято. Пожалуйста, выберите другое.",
                reply_markup=InlineKeyboardBuilder()
                .button(text="🔙 Назад", callback_data="return_to_menu")
                .as_markup()
            )
            return
            
        # Создаем новую компанию
        cursor.execute('''
            INSERT INTO companies (name, owner_id, level, experience, balance)
            VALUES (?, ?, 1, 0, 0)
        ''', (company_name, user_id))
        
        company_id = cursor.lastrowid
        
        # Списываем стоимость создания компании
        cursor.execute('''
            UPDATE players 
            SET gram_balance = gram_balance - ?
            WHERE user_id = ?
        ''', (COMPANY_CREATION_COST, user_id))
        
        # Добавляем владельца как CEO
        cursor.execute('''
            INSERT INTO company_employees (company_id, user_id, role)
            VALUES (?, ?, 'CEO')
        ''', (company_id, user_id))
        
        # Обновляем ранг игрока на CEO
        cursor.execute('''
            UPDATE players 
            SET rank = 'CEO',
                specialization = 'CEO'
            WHERE user_id = ?
        ''', (user_id,))
        
        conn.commit()
        logger.info(f"Компания '{company_name}' успешно создана для пользователя {user_id}")
        
        # Создаем клавиатуру
        builder = InlineKeyboardBuilder()
        builder.button(text="Финансы 💰", callback_data="company_finances")
        builder.button(text="Управление 👥", callback_data="company_management")
        builder.button(text="Производство 🏭", callback_data="company_production")
        builder.button(text="Склад 📦", callback_data="company_storage")
        builder.button(text="Лаборатория 🔬", callback_data="company_lab")
        builder.button(text="Хакатон 🏆", callback_data="company_hackathon")
        builder.button(text="Еженедельные задания 📋", callback_data="company_weekly")
        builder.adjust(2)
        
        await message.reply(
            f"🎉 Поздравляем! Компания {company_name} успешно создана!\n\n"
            f"🏢 Компания: {company_name}\n"
            f"🎊 Уровень компании: 1\n"
            f"🏆 Рейтинг компании: #1\n"
            f"💰 Баланс компании: 0 Gram\n"
            f"👥 Сотрудники: 1/10\n"
            f"📦 Склад: 0/100\n\n"
            f"🎯 Ваш ранг изменен на: CEO",
            reply_markup=builder.as_markup()
        )
        
        await state.clear()
        
    except Exception as e:
        logger.error(f"Error in process_company_name: {e}")
        await message.reply(
            "Произошла ошибка при создании компании. Попробуйте позже.",
            reply_markup=InlineKeyboardBuilder()
            .button(text="🔙 Назад", callback_data="return_to_menu")
            .as_markup()
        )
    finally:
        if conn:
            conn.close()

@router.callback_query(UserStates.COMPANY_MENU, F.data == "join_company")
async def show_companies(callback: CallbackQuery, state: FSMContext) -> None:
    """Показывает список доступных компаний"""
    conn = None
    try:
        conn = get_db_connection()
        if not conn:
            builder = InlineKeyboardBuilder()
            builder.button(text="🔙 Назад", callback_data="return_to_menu")
            await callback.message.edit_text(
                "Ошибка подключения к базе данных. Попробуйте позже.",
                reply_markup=builder.as_markup()
            )
            return

        cursor = conn.cursor()
        
        # Получаем список компаний
        cursor.execute('''
            SELECT c.company_id, c.name, c.company_data,
                   p.display_name as owner_name
            FROM companies c
            INNER JOIN players p ON c.owner_id = p.user_id
        ''')
        companies = cursor.fetchall()
        
        if not companies:
            builder = InlineKeyboardBuilder()
            builder.button(text="📝 Создать компанию", callback_data="create_company")
            builder.button(text="🔙 Назад", callback_data="return_to_menu")
            builder.adjust(1)
            await callback.message.edit_text(
                "😔 Пока нет доступных компаний.\n"
                "Вы можете создать свою!",
                reply_markup=builder.as_markup()
            )
            return
        
        builder = InlineKeyboardBuilder()
        companies_text = "🏢 Доступные компании:\n\n"
        
        for company_id, name, company_data, owner_name in companies:
            company_info = json.loads(company_data)
            companies_text += (
                f"📋 «{name}»\n"
                f"👤 CEO: {owner_name}\n"
                f"👥 Сотрудников: {company_info.get('member_count', 1)}\n"
                "➖➖➖➖➖➖➖➖\n"
            )
            builder.button(
                text=f"📝 Подать заявку в {name}",
                callback_data=f"apply_company_{company_id}"
            )
        
        builder.button(text="🔙 Назад", callback_data="company_back")
        builder.adjust(1)
        
        await callback.message.edit_text(
            companies_text,
            reply_markup=builder.as_markup()
        )
        
    except Exception as e:
        logger.error(f"Error in show_companies: {e}")
        builder = InlineKeyboardBuilder()
        builder.button(text="🔙 Назад", callback_data="return_to_menu")
        await callback.message.edit_text(
            "Произошла ошибка при получении списка компаний.",
            reply_markup=builder.as_markup()
        )
    finally:
        if conn:
            conn.close()

@router.callback_query(F.data == "company_finances")
async def company_finances(callback: CallbackQuery, state: FSMContext):
    """Обработчик кнопки Финансы компании"""
    user_id = callback.from_user.id
    conn = None
    try:
        conn = get_db_connection()
        if not conn:
            builder = InlineKeyboardBuilder()
            builder.button(text="🔙 Назад", callback_data="company_back")
            await callback.message.edit_text(
                "Ошибка подключения к базе данных. Попробуйте позже.",
                reply_markup=builder.as_markup()
            )
            return

        cursor = conn.cursor()
        
        # Получаем информацию о компании пользователя
        cursor.execute('''
            SELECT c.company_id, c.name, c.company_data
            FROM companies c
            JOIN company_employees ce ON c.company_id = ce.company_id
            WHERE ce.user_id = ?
        ''', (user_id,))
        company_data = cursor.fetchone()
        
        if not company_data:
            builder = InlineKeyboardBuilder()
            builder.button(text="🔙 Назад", callback_data="company_back")
            await callback.message.edit_text(
                "Вы не состоите в компании.",
                reply_markup=builder.as_markup()
            )
            return
            
        company_id, company_name, company_json = company_data
        company = Company.from_dict(json.loads(company_json))
        
        # Получаем информацию о сотрудниках и их зарплатах
        cursor.execute('''
            SELECT ce.user_id, p.display_name, ce.role
            FROM company_employees ce
            JOIN players p ON ce.user_id = p.user_id
            WHERE ce.company_id = ? AND ce.status = 'active'
        ''', (company_id,))
        employees = cursor.fetchall()
        
        # Считаем общую сумму зарплат
        total_salary = 0
        employees_info = []
        for emp_id, emp_name, role in employees:
            if role != 'CEO':  # CEO не получает зарплату
                salary = company.employee_salaries.get(str(emp_id), 0)
                total_salary += salary
                employees_info.append(f"👤 {emp_name} ({role}): {salary:,.0f} Gram/день")
        
        # Получаем информацию о производственных линиях
        cursor.execute('''
            SELECT COUNT(*), SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END)
            FROM production_lines
            WHERE company_id = ?
        ''', (company_id,))
        total_lines, active_lines = cursor.fetchone() or (0, 0)
        
        # Получаем информацию о расходах на производство
        production_costs = active_lines * 100 if active_lines else 0  # 100 Gram в день на линию
        
        # Формируем сообщение
        finances_message = (
            f"💰 Финансы компании {company_name}\n\n"
            f"💳 Текущий баланс: {company.balance:,.0f} Gram\n\n"
            f"👥 Зарплаты сотрудников:\n"
        )
        
        if employees_info:
            finances_message += "\n".join(employees_info) + "\n"
        else:
            finances_message += "Нет активных сотрудников\n"
            
        finances_message += f"\n💵 Общие расходы на зарплаты: {total_salary:,.0f} Gram/день\n"
        finances_message += f"🏭 Производственные линии: {active_lines}/{total_lines}\n"
        finances_message += f"💸 Расходы на производство: {production_costs:,.0f} Gram/день\n"
        finances_message += f"📊 Общие расходы: {(total_salary + production_costs):,.0f} Gram/день\n\n"
        
        # Создаем клавиатуру
        builder = InlineKeyboardBuilder()
        
        # Добавляем кнопку установки зарплаты только для CEO
        if is_company_ceo(user_id, conn):
            builder.button(text="💰 Установить зарплаты", callback_data="company_set_salary")
        
        builder.button(text="💵 Пополнить баланс", callback_data="add_company_funds")
        builder.button(text="📊 Статистика", callback_data="company_stats")
        builder.button(text="🔙 Назад", callback_data="company_back")
        builder.adjust(1)
        
        await callback.message.edit_text(
            finances_message,
            reply_markup=builder.as_markup()
        )
        
    except Exception as e:
        logger.error(f"Error in company_finances: {e}")
        builder = InlineKeyboardBuilder()
        builder.button(text="🔙 Назад", callback_data="company_back")
        await callback.message.edit_text(
            "Произошла ошибка при получении финансовой информации.",
            reply_markup=builder.as_markup()
        )
    finally:
        if conn:
            conn.close()

def get_company_menu_keyboard() -> InlineKeyboardMarkup:
    """Создает единую клавиатуру для меню компании"""
    builder = InlineKeyboardBuilder()
    builder.button(text="Финансы 💰", callback_data="company_finances")
    builder.button(text="Статистика 📊", callback_data="company_stats")
    builder.button(text="Еженедельные задания 📋", callback_data="company_weekly")
    builder.button(text="Склад 📦", callback_data="company_storage")
    builder.button(text="Управление 👥", callback_data="company_management")
    builder.button(text="Лаборатория 🔬", callback_data="company_lab")
    builder.button(text="Хакатон 🏆", callback_data="company_hackathon")
    builder.button(text="Производство 🏭", callback_data="company_production")
    builder.button(text="Назад ↩️", callback_data="company_back")
    builder.adjust(2)
    return builder.as_markup()


def update_company_blueprints_table():
    """Обновляет структуру таблицы company_blueprints"""
    conn = None
    try:
        conn = get_db_connection()
        if not conn:
            logger.error("Не удалось подключиться к базе данных в update_company_blueprints_table")
            return False
            
        cursor = conn.cursor()
        
        # Проверяем существование колонки progress_data
        cursor.execute("PRAGMA table_info(company_blueprints)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'progress_data' not in columns:
            logger.info("Обновляем структуру таблицы company_blueprints")
            
            # Создаем временную таблицу с новой структурой
            cursor.execute('''
                CREATE TABLE company_blueprints_new (
                    blueprint_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    company_id INTEGER NOT NULL,
                    gadget_type TEXT NOT NULL,
                    blueprint_name TEXT NOT NULL,
                    status TEXT DEFAULT 'in_progress',
                    progress_data JSON DEFAULT '{}',
                    development_started TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (company_id) REFERENCES companies (company_id)
                )
            ''')
            
            # Копируем данные из старой таблицы
            cursor.execute('''
                INSERT INTO company_blueprints_new 
                (blueprint_id, company_id, gadget_type, blueprint_name, status, development_started)
                SELECT blueprint_id, company_id, gadget_type, blueprint_name, status, development_started
                FROM company_blueprints
            ''')
            
            # Обновляем progress_data на основе существующих данных
            cursor.execute('''
                SELECT blueprint_id, company_id, gadget_type, blueprint_name, 
                       progress_coding, progress_design, progress_analytics
                FROM company_blueprints
                WHERE status = 'in_progress'
            ''')
            
            for row in cursor.fetchall():
                blueprint_id, company_id, gadget_type, blueprint_name, prog_code, prog_design, prog_analytics = row
                
                # Создаем JSON с прогрессом
                progress_data = {
                    "coding": prog_code if prog_code is not None else 0,
                    "design": prog_design if prog_design is not None else 0,
                    "analytics": prog_analytics if prog_analytics is not None else 0
                }
                
                # Обновляем запись в новой таблице
                cursor.execute('''
                    UPDATE company_blueprints_new
                    SET progress_data = ?
                    WHERE blueprint_id = ?
                ''', (json.dumps(progress_data), blueprint_id))
            
            # Удаляем старую таблицу
            cursor.execute('DROP TABLE company_blueprints')
            
            # Переименовываем новую таблицу
            cursor.execute('ALTER TABLE company_blueprints_new RENAME TO company_blueprints')
            
            # Создаем индекс
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_company_blueprints_status 
                ON company_blueprints(company_id, status)
            ''')
            
            conn.commit()
            logger.info("Структура таблицы company_blueprints успешно обновлена")
            
        return True
        
    except Exception as e:
        logger.error(f"Ошибка при обновлении таблицы company_blueprints: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    asyncio.run(main()) 