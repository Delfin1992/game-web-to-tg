from aiogram import F, Router
from aiogram.types import CallbackQuery
from aiogram.utils.keyboard import InlineKeyboardBuilder
from aiogram.fsm.context import FSMContext
from blueprint_development import check_development_access, stop_blueprint_development

router = Router()

@router.callback_query(F.data.startswith("stop_development_"))
async def stop_development(callback: CallbackQuery, state: FSMContext):
    """Остановка разработки чертежа"""
    user_id = callback.from_user.id
    blueprint_name = callback.data.replace("stop_development_", "")
    
    # Проверяем доступ и роль пользователя
    has_access, company_id, role = await check_development_access(user_id, blueprint_name)
    
    if not has_access or role != 'CEO':
        await callback.answer("Только CEO может остановить разработку чертежа.", show_alert=True)
        return
    
    # Останавливаем разработку
    if await stop_blueprint_development(company_id, blueprint_name):
        builder = InlineKeyboardBuilder()
        builder.button(text="🔙 Назад в лабораторию", callback_data="company_lab")
        await callback.message.edit_text(
            f"❌ Разработка чертежа '{blueprint_name}' остановлена.",
            reply_markup=builder.as_markup()
        )
    else:
        await callback.answer("Произошла ошибка при остановке разработки.", show_alert=True) 