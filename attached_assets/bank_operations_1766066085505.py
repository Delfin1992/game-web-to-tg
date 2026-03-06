import sqlite3
from datetime import datetime, timedelta
import json
import logging
from typing import Dict, Any, Tuple

from config import BANK_SETTINGS
from jobs import CITIES
from bank import BankAccount

logger = logging.getLogger(__name__)

def process_credit_operation(
    user_id: int,
    amount: int,
    days: int,
    credit_type: str,
    current_city: str,
    conn: sqlite3.Connection
) -> Tuple[bool, str]:
    """Обрабатывает операцию создания кредита"""
    try:
        cursor = conn.cursor()
        
        # Получаем данные программы кредита
        credit_program = BANK_SETTINGS['credits']['programs'][credit_type]
        
        # Проверяем лимиты суммы
        min_amount = credit_program['min_amount'][current_city]
        max_amount = credit_program['max_amount'][current_city]
        if amount < min_amount or amount > max_amount:
            return False, f"Сумма должна быть от {min_amount:,} до {max_amount:,} {CITIES[current_city]['currency_symbol']}"
        
        # Проверяем сроки
        if days < credit_program['min_days'] or days > credit_program['max_days']:
            return False, f"Срок должен быть от {credit_program['min_days']} до {credit_program['max_days']} дней"
        
        # Получаем банковский счет
        cursor.execute('SELECT account_data FROM bank_accounts WHERE user_id = ?', (user_id,))
        account_data = cursor.fetchone()
        
        if not account_data:
            return False, "Банковский счет не найден"
            
        account = BankAccount.from_dict(json.loads(account_data[0]))
        
        # Создаем кредит
        credit_data = {
            "amount": amount,
            "days": days,
            "interest_rate": credit_program['interest_rate'],
            "penalty_rate": credit_program['penalty_rate'],
            "start_date": datetime.now().isoformat(),
            "end_date": (datetime.now() + timedelta(days=days)).isoformat(),
            "type": credit_type,
            "status": "active"
        }
        
        # Добавляем кредит в аккаунт
        account.credits.append(credit_data)
        
        # Обновляем только баланс в местной валюте, не трогая gram_balance
        cursor.execute('''
        UPDATE players 
        SET balance = balance + ?
        WHERE user_id = ?
        ''', (amount, user_id))
        
        # Обновляем данные аккаунта
        cursor.execute('''
        UPDATE bank_accounts 
        SET account_data = ?
        WHERE user_id = ?
        ''', (json.dumps(account.to_dict()), user_id))
        
        conn.commit()
        return True, "Кредит успешно оформлен"
        
    except Exception as e:
        logger.error(f"Error in process_credit_operation: {e}")
        conn.rollback()
        return False, "Произошла ошибка при оформлении кредита"

def process_deposit_operation(
    user_id: int,
    amount: int,
    days: int,
    deposit_type: str,
    current_city: str,
    conn: sqlite3.Connection
) -> Tuple[bool, str]:
    """Обрабатывает операцию создания вклада"""
    try:
        cursor = conn.cursor()
        
        # Получаем данные программы вклада
        deposit_program = BANK_SETTINGS['deposits']['programs'][deposit_type]
        
        # Проверяем лимиты суммы
        min_amount = deposit_program['min_amount'][current_city]
        max_amount = deposit_program['max_amount'][current_city]
        if amount < min_amount or amount > max_amount:
            return False, f"Сумма должна быть от {min_amount:,} до {max_amount:,} {CITIES[current_city]['currency_symbol']}"
        
        # Проверяем сроки
        if days < deposit_program['min_days'] or days > deposit_program['max_days']:
            return False, f"Срок должен быть от {deposit_program['min_days']} до {deposit_program['max_days']} дней"
        
        # Проверяем достаточность средств
        cursor.execute('SELECT balance FROM players WHERE user_id = ?', (user_id,))
        current_balance = cursor.fetchone()[0]
        
        if current_balance < amount:
            return False, f"Недостаточно средств. Ваш баланс: {current_balance:,} {CITIES[current_city]['currency_symbol']}"
        
        # Получаем банковский счет
        cursor.execute('SELECT account_data FROM bank_accounts WHERE user_id = ?', (user_id,))
        account_data = cursor.fetchone()
        
        if not account_data:
            return False, "Банковский счет не найден"
            
        account = BankAccount.from_dict(json.loads(account_data[0]))
        
        # Создаем вклад
        deposit_data = {
            "amount": amount,
            "days": days,
            "interest_rate": deposit_program['interest_rate'],
            "start_date": datetime.now().isoformat(),
            "end_date": (datetime.now() + timedelta(days=days)).isoformat(),
            "type": deposit_type,
            "status": "active"
        }
        
        # Добавляем вклад в аккаунт
        account.deposits.append(deposit_data)
        
        # Обновляем баланс игрока
        cursor.execute('''
        UPDATE players 
        SET balance = balance - ?
        WHERE user_id = ?
        ''', (amount, user_id))
        
        # Обновляем данные аккаунта
        cursor.execute('''
        UPDATE bank_accounts 
        SET account_data = ?
        WHERE user_id = ?
        ''', (json.dumps(account.to_dict()), user_id))
        
        conn.commit()
        return True, "Вклад успешно открыт"
        
    except Exception as e:
        logger.error(f"Error in process_deposit_operation: {e}")
        conn.rollback()
        return False, "Произошла ошибка при открытии вклада"

def calculate_credit_payment(amount: int, days: int, interest_rate: float) -> int:
    """Рассчитывает ежемесячный платеж по кредиту"""
    # Простой расчет с учетом годовой процентной ставки
    total_interest = amount * interest_rate * (days / 365)
    total_amount = amount + total_interest
    return int(total_amount / (days / 30))  # Делим на количество месяцев

def calculate_deposit_income(amount: int, days: int, interest_rate: float) -> int:
    """Рассчитывает доход по вкладу"""
    # Простой расчет дохода с учетом годовой процентной ставки
    return int(amount * interest_rate * (days / 365)) 