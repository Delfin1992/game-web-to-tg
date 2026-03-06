def format_full_profile(display_name: str, character_type: str, city: str,
                       balance: float, exp: int, level: int, stats: dict,
                       work_time: float, study_time: float, inventory: list,
                       parts_storage: list, equipped_gadgets: dict,
                       gram_balance: float) -> str:
    """Форматирует полный профиль игрока"""
    # Отладочный вывод
    print(f"\nОтладка format_full_profile:")
    print(f"Тип gram_balance: {type(gram_balance)}")
    print(f"Значение gram_balance: {gram_balance}")
    
    # Форматируем gram_balance с разделителями тысяч и тремя знаками после запятой
    try:
        formatted_gram = "{:,.2f}".format(float(gram_balance))
        print(f"Отформатированное значение gram_balance: {formatted_gram}")
    except (ValueError, TypeError) as e:
        print(f"Ошибка форматирования gram_balance: {e}")
        formatted_gram = "0.000"
    
    profile_text = (
        f"👤 Профиль игрока: {display_name}\n"
        f"🎭 Тип персонажа: {character_type}\n"
        f"🏙 Город: {city}\n"
        f"💳 Баланс: {balance:,.2f} кредитов\n"
        f"💎 Баланс в грам: {formatted_gram}\n"
        f"⭐️ Уровень: {level}\n"
        f"📊 Опыт: {exp}\n\n"
        f"📈 Характеристики:\n"
        f"💪 Сила: {stats['strength']}\n"
        f"⚡️ Ловкость: {stats['agility']}\n"
        f"🧠 Интеллект: {stats['intelligence']}\n"
        f"❤️ Выносливость: {stats['stamina']}\n"
        f"🍀 Удача: {stats['luck']}\n\n"
        f"⏰ Время работы: {work_time:.1f} часов\n"
        f"📚 Время учебы: {study_time:.1f} часов\n\n"
        f"🎒 Инвентарь:\n{format_inventory(inventory)}\n\n"
        f"🔧 Хранилище деталей:\n{format_parts_storage(parts_storage)}\n\n"
        f"⚡️ Экипированные гаджеты:\n{format_equipped_gadgets(equipped_gadgets)}"
    )
    return profile_text

def format_inventory(inventory: list) -> str:
    """Форматирует инвентарь игрока"""
    if not inventory:
        return "Пусто"
    
    inventory_text = ""
    for item in inventory:
        inventory_text += f"- {item['name']} (x{item['quantity']})\n"
    return inventory_text

def format_parts_storage(parts_storage: list) -> str:
    """Форматирует хранилище деталей игрока"""
    if not parts_storage:
        return "Пусто"
    
    parts_text = ""
    for part in parts_storage:
        parts_text += f"- {part['name']} (x{part['quantity']})\n"
    return parts_text

def format_equipped_gadgets(equipped_gadgets: dict) -> str:
    """Форматирует экипированные гаджеты игрока"""
    if not equipped_gadgets:
        return "Нет экипированных гаджетов"
    
    gadgets_text = ""
    for slot, gadget in equipped_gadgets.items():
        gadgets_text += f"- {slot}: {gadget['name']}\n"
    return gadgets_text 