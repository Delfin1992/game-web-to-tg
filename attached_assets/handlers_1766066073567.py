import logging
import json
import sqlite3
from datetime import datetime, timedelta
from aiogram import types
from aiogram.dispatcher import FSMContext
from aiogram.dispatcher.filters.state import State, StatesGroup
from database import get_db_connection, get_player_data
from profile_formatters import format_full_profile, format_inventory, format_parts_storage, format_equipped_gadgets

logger = logging.getLogger(__name__)

class ExchangeStates(StatesGroup):
    waiting_for_amount = State()

async def cmd_start(message: types.Message):
    """Обработчик команды /start"""
    user = message.from_user
    conn = get_db_connection()
    try:
        # Проверяем, существует ли игрок
        cursor = conn.cursor()
        cursor.execute('SELECT user_id FROM players WHERE user_id = ?', (user.id,))
        player = cursor.fetchone()
        
        if not player:
            # Создаем нового игрока
            cursor.execute('''
                INSERT INTO players (
                    user_id, username, display_name, character_type, 
                    current_city, balance, gram_balance, level, exp, 
                    stats, work_time, work_time_left, study_time, 
                    study_time_left, last_work_update, last_study_update,
                    inventory, parts_storage, equipped_gadgets, specialization
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                user.id,
                user.username or "unknown",
                user.full_name or user.username or "Неизвестный игрок",
                "Новичок",  # character_type
                "Новосибирск",  # current_city
                1000,  # balance
                0.0,  # gram_balance
                1,  # level
                0,  # exp
                json.dumps({
                    "strength": 1,
                    "agility": 1,
                    "intelligence": 1,
                    "stamina": 1,
                    "luck": 1
                }),  # stats
                0,  # work_time
                0,  # work_time_left
                0,  # study_time
                0,  # study_time_left
                datetime.now().isoformat(),  # last_work_update
                datetime.now().isoformat(),  # last_study_update
                json.dumps([]),  # inventory
                json.dumps([]),  # parts_storage
                json.dumps({}),  # equipped_gadgets
                "Нет"  # specialization
            ))
            conn.commit()
            await message.reply(
                "Добро пожаловать в игру! Вы получили 1000 кредитов для начала.\n"
                "Используйте /help для просмотра доступных команд."
            )
        else:
            await message.reply(
                "С возвращением! Используйте /help для просмотра доступных команд."
            )
        
        # Получаем данные игрока для отображения профиля
        player = get_player_data(user.id, conn)
        if player:
            display_name, balance, exp, level, stats, current_city, \
            character_type, work_time, study_time, last_work_update, \
            last_study_update, inventory, parts_storage, equipped_gadgets, \
            gram_balance = player
            
            # Отладочный вывод
            print(f"\nОтладка cmd_start:")
            print(f"Тип gram_balance: {type(gram_balance)}")
            print(f"Значение gram_balance: {gram_balance}")
            
            # Преобразуем gram_balance в float и округляем до двух знаков после запятой
            try:
                gram_balance = float(gram_balance) if gram_balance is not None else 0.0
                gram_balance = round(gram_balance, 2)
            except (ValueError, TypeError) as e:
                print(f"Ошибка преобразования gram_balance: {e}")
                gram_balance = 0.0
            
            # Обновляем время
            work_time, study_time = update_player_time(user.id, conn)
            
            # Форматируем и отправляем профиль
            profile_text = format_full_profile(
                display_name=display_name,
                character_type=character_type,
                city=current_city,
                balance=float(balance),
                exp=exp,
                level=level,
                stats=json.loads(stats),
                work_time=work_time,
                study_time=study_time,
                inventory=json.loads(inventory),
                parts_storage=json.loads(parts_storage),
                equipped_gadgets=json.loads(equipped_gadgets) if equipped_gadgets else {},
                gram_balance=gram_balance
            )
            await message.reply(profile_text)
            
    except Exception as e:
        logger.error(f"Ошибка при обработке команды /start: {e}")
        await message.reply("Произошла ошибка при инициализации игрока. Попробуйте позже.")
    finally:
        conn.close()

async def cmd_profile(message: types.Message):
    """Обработчик команды /profile"""
    user = message.from_user
    conn = get_db_connection()
    try:
        # Получаем данные игрока
        player = get_player_data(user.id, conn)
        if not player:
            await message.reply("Ошибка: игрок не найден")
            return
            
        display_name, balance, exp, level, stats, current_city, \
        character_type, work_time, study_time, last_work_update, \
        last_study_update, inventory, parts_storage, equipped_gadgets, \
        gram_balance = player
        
        # Отладочный вывод
        print(f"\nОтладка cmd_profile:")
        print(f"Тип gram_balance: {type(gram_balance)}")
        print(f"Значение gram_balance: {gram_balance}")
        
        # Преобразуем gram_balance в float
        try:
            gram_balance = float(gram_balance) if gram_balance is not None else 0.0
            print(f"После преобразования:")
            print(f"Тип gram_balance: {type(gram_balance)}")
            print(f"Значение gram_balance: {gram_balance}")
        except (ValueError, TypeError) as e:
            print(f"Ошибка преобразования gram_balance: {e}")
            gram_balance = 0.0
        
        # Округляем gram_balance до двух знаков после запятой
        gram_balance = round(gram_balance, 2)
        
        # Обновляем время
        work_time, study_time = update_player_time(user.id, conn)
        
        # Форматируем профиль
        profile_text = format_full_profile(
            display_name=display_name,
            character_type=character_type,
            city=current_city,
            balance=float(balance),
            exp=exp,
            level=level,
            stats=json.loads(stats),
            work_time=work_time,
            study_time=study_time,
            inventory=json.loads(inventory),
            parts_storage=json.loads(parts_storage),
            equipped_gadgets=json.loads(equipped_gadgets) if equipped_gadgets else {},
            gram_balance=gram_balance
        )
        
        await message.reply(profile_text)
        
    except sqlite3.Error as e:
        logger.error(f"Ошибка базы данных при обработке команды /profile: {e}")
        await message.reply("Произошла ошибка при получении данных профиля. Попробуйте позже.")
    except Exception as e:
        logger.error(f"Ошибка при обработке команды /profile: {e}")
        await message.reply("Произошла непредвиденная ошибка при формировании профиля. Попробуйте позже.")
        logger.error(f"Детали ошибки: {str(e)}")
    finally:
        conn.close()

async def cmd_inventory(message: types.Message):
    """Обработчик команды /inventory"""
    user = message.from_user
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute('SELECT inventory FROM players WHERE user_id = ?', (user.id,))
        result = cursor.fetchone()
        
        if not result:
            await message.reply("Ошибка: игрок не найден")
            return
            
        inventory = json.loads(result[0])
        inventory_text = format_inventory(inventory)
        await message.reply(inventory_text)
        
    except sqlite3.Error as e:
        logger.error(f"Ошибка базы данных при обработке команды /inventory: {e}")
        await message.reply("Произошла ошибка при получении инвентаря. Попробуйте позже.")
    except Exception as e:
        logger.error(f"Ошибка при обработке команды /inventory: {e}")
        await message.reply("Произошла ошибка при формировании инвентаря. Попробуйте позже.")
    finally:
        conn.close()

async def cmd_parts(message: types.Message):
    """Обработчик команды /parts"""
    user = message.from_user
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute('SELECT parts_storage FROM players WHERE user_id = ?', (user.id,))
        result = cursor.fetchone()
        
        if not result:
            await message.reply("Ошибка: игрок не найден")
            return
            
        parts_storage = json.loads(result[0])
        parts_text = format_parts_storage(parts_storage)
        await message.reply(parts_text)
        
    except sqlite3.Error as e:
        logger.error(f"Ошибка базы данных при обработке команды /parts: {e}")
        await message.reply("Произошла ошибка при получении хранилища деталей. Попробуйте позже.")
    except Exception as e:
        logger.error(f"Ошибка при обработке команды /parts: {e}")
        await message.reply("Произошла ошибка при формировании хранилища деталей. Попробуйте позже.")
    finally:
        conn.close()

async def cmd_equipped(message: types.Message):
    """Обработчик команды /equipped"""
    user = message.from_user
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute('SELECT equipped_gadgets FROM players WHERE user_id = ?', (user.id,))
        result = cursor.fetchone()
        
        if not result:
            await message.reply("Ошибка: игрок не найден")
            return
            
        equipped_gadgets = json.loads(result[0]) if result[0] else {}
        equipped_text = format_equipped_gadgets(equipped_gadgets)
        await message.reply(equipped_text)
        
    except sqlite3.Error as e:
        logger.error(f"Ошибка базы данных при обработке команды /equipped: {e}")
        await message.reply("Произошла ошибка при получении экипированных гаджетов. Попробуйте позже.")
    except Exception as e:
        logger.error(f"Ошибка при обработке команды /equipped: {e}")
        await message.reply("Произошла ошибка при формировании списка экипированных гаджетов. Попробуйте позже.")
    finally:
        conn.close()

async def cmd_exchange(message: types.Message):
    """Обработчик команды /exchange"""
    user = message.from_user
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute('SELECT balance, gram_balance FROM players WHERE user_id = ?', (user.id,))
        result = cursor.fetchone()
        
        if not result:
            await message.reply("Ошибка: игрок не найден")
            return
            
        balance, gram_balance = result
        await message.reply(
            f"💳 Ваш баланс: {balance:.2f} кредитов\n"
            f"💎 Ваш баланс в грам: {gram_balance:.2f}\n\n"
            "Выберите действие:\n"
            "1️⃣ /buy_gram - Купить грам\n"
            "2️⃣ /sell_gram - Продать грам"
        )
        
    except sqlite3.Error as e:
        logger.error(f"Ошибка базы данных при обработке команды /exchange: {e}")
        await message.reply("Произошла ошибка при получении баланса. Попробуйте позже.")
    except Exception as e:
        logger.error(f"Ошибка при обработке команды /exchange: {e}")
        await message.reply("Произошла ошибка при формировании информации об обмене. Попробуйте позже.")
    finally:
        conn.close()

async def cmd_buy_gram(message: types.Message, state: FSMContext):
    """Обработчик команды /buy_gram"""
    user = message.from_user
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute('SELECT balance FROM players WHERE user_id = ?', (user.id,))
        result = cursor.fetchone()
        
        if not result:
            await message.reply("Ошибка: игрок не найден")
            return
            
        balance = result[0]
        await message.reply(
            f"💳 Ваш баланс: {balance:.2f} кредитов\n"
            f"💎 Курс: 1 грам = 100 кредитов\n\n"
            "Введите количество грам, которое хотите купить:"
        )
        await state.set_state(ExchangeStates.waiting_for_amount.state)
        
    except sqlite3.Error as e:
        logger.error(f"Ошибка базы данных при обработке команды /buy_gram: {e}")
        await message.reply("Произошла ошибка при получении баланса. Попробуйте позже.")
    except Exception as e:
        logger.error(f"Ошибка при обработке команды /buy_gram: {e}")
        await message.reply("Произошла ошибка при обработке команды. Попробуйте позже.")
    finally:
        conn.close()

async def process_buy_gram_amount(message: types.Message, state: FSMContext):
    """Обработчик ввода суммы для покупки грам"""
    user = message.from_user
    try:
        amount = float(message.text)
        if amount <= 0:
            await message.reply("Сумма должна быть больше 0")
            return
            
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT balance, gram_balance FROM players WHERE user_id = ?', (user.id,))
        result = cursor.fetchone()
        
        if not result:
            await message.reply("Ошибка: игрок не найден")
            return
            
        balance, gram_balance = result
        cost = amount * 100  # 1 грам = 100 кредитов
        
        if balance < cost:
            await message.reply(f"Недостаточно кредитов. Необходимо: {cost:.2f}, у вас: {balance:.2f}")
            return
            
        # Обновляем балансы
        cursor.execute('''
            UPDATE players 
            SET balance = balance - ?, 
                gram_balance = gram_balance + ? 
            WHERE user_id = ?
        ''', (cost, amount, user.id))
        conn.commit()
        
        await message.reply(
            f"✅ Успешно куплено {amount:.2f} грам\n"
            f"💳 Списано: {cost:.2f} кредитов\n"
            f"💎 Новый баланс в грам: {(gram_balance + amount):.2f}"
        )
        await state.finish()
        
    except ValueError:
        await message.reply("Пожалуйста, введите корректное число")
    except sqlite3.Error as e:
        logger.error(f"Ошибка базы данных при покупке грам: {e}")
        await message.reply("Произошла ошибка при обновлении баланса. Попробуйте позже.")
    except Exception as e:
        logger.error(f"Ошибка при покупке грам: {e}")
        await message.reply("Произошла ошибка при обработке операции. Попробуйте позже.")
    finally:
        conn.close()

async def cmd_sell_gram(message: types.Message, state: FSMContext):
    """Обработчик команды /sell_gram"""
    user = message.from_user
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute('SELECT gram_balance FROM players WHERE user_id = ?', (user.id,))
        result = cursor.fetchone()
        
        if not result:
            await message.reply("Ошибка: игрок не найден")
            return
            
        gram_balance = result[0]
        await message.reply(
            f"💎 Ваш баланс в грам: {gram_balance:.2f}\n"
            f"💳 Курс: 1 грам = 100 кредитов\n\n"
            "Введите количество грам, которое хотите продать:"
        )
        await state.set_state(ExchangeStates.waiting_for_amount.state)
        
    except sqlite3.Error as e:
        logger.error(f"Ошибка базы данных при обработке команды /sell_gram: {e}")
        await message.reply("Произошла ошибка при получении баланса. Попробуйте позже.")
    except Exception as e:
        logger.error(f"Ошибка при обработке команды /sell_gram: {e}")
        await message.reply("Произошла ошибка при обработке команды. Попробуйте позже.")
    finally:
        conn.close()

async def process_sell_gram_amount(message: types.Message, state: FSMContext):
    """Обработчик ввода суммы для продажи грам"""
    user = message.from_user
    try:
        amount = float(message.text)
        if amount <= 0:
            await message.reply("Сумма должна быть больше 0")
            return
            
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT balance, gram_balance FROM players WHERE user_id = ?', (user.id,))
        result = cursor.fetchone()
        
        if not result:
            await message.reply("Ошибка: игрок не найден")
            return
            
        balance, gram_balance = result
        
        if gram_balance < amount:
            await message.reply(f"Недостаточно грам. У вас: {gram_balance:.2f}, запрошено: {amount:.2f}")
            return
            
        # Обновляем балансы
        cursor.execute('''
            UPDATE players 
            SET balance = balance + ?, 
                gram_balance = gram_balance - ? 
            WHERE user_id = ?
        ''', (amount * 100, amount, user.id))
        conn.commit()
        
        await message.reply(
            f"✅ Успешно продано {amount:.2f} грам\n"
            f"💳 Получено: {amount * 100:.2f} кредитов\n"
            f"💎 Новый баланс в грам: {(gram_balance - amount):.2f}"
        )
        await state.finish()
        
    except ValueError:
        await message.reply("Пожалуйста, введите корректное число")
    except sqlite3.Error as e:
        logger.error(f"Ошибка базы данных при продаже грам: {e}")
        await message.reply("Произошла ошибка при обновлении баланса. Попробуйте позже.")
    except Exception as e:
        logger.error(f"Ошибка при продаже грам: {e}")
        await message.reply("Произошла ошибка при обработке операции. Попробуйте позже.")
    finally:
        conn.close()

async def cmd_add_gram(message: types.Message):
    """Обработчик команды /add_gram (только для админов)"""
    user = message.from_user
    if user.id not in ADMIN_IDS:
        await message.reply("У вас нет прав для использования этой команды")
        return
        
    try:
        # Парсим аргументы команды
        args = message.get_args().split()
        if len(args) != 2:
            await message.reply("Использование: /add_gram <user_id> <amount>")
            return
            
        target_id = int(args[0])
        amount = float(args[1])
        
        if amount <= 0:
            await message.reply("Сумма должна быть больше 0")
            return
            
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Проверяем существование игрока
        cursor.execute('SELECT gram_balance FROM players WHERE user_id = ?', (target_id,))
        result = cursor.fetchone()
        
        if not result:
            await message.reply("Игрок не найден")
            return
            
        # Обновляем баланс
        cursor.execute('''
            UPDATE players 
            SET gram_balance = gram_balance + ? 
            WHERE user_id = ?
        ''', (amount, target_id))
        conn.commit()
        
        await message.reply(f"✅ Успешно добавлено {amount:.2f} грам игроку {target_id}")
        
    except ValueError:
        await message.reply("Неверный формат данных")
    except sqlite3.Error as e:
        logger.error(f"Ошибка базы данных при добавлении грам: {e}")
        await message.reply("Произошла ошибка при обновлении баланса. Попробуйте позже.")
    except Exception as e:
        logger.error(f"Ошибка при добавлении грам: {e}")
        await message.reply("Произошла ошибка при обработке команды. Попробуйте позже.")
    finally:
        conn.close() 