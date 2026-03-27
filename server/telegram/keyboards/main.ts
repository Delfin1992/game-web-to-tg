/**
 * Compatibility barrel for legacy imports from telegram.ts.
 * New code should import from feature-specific keyboard modules.
 */

export { ADMIN_MENU_REPLY_MARKUP } from "./admin";
export {
  BANK_MENU_REPLY_MARKUP,
  buildBankSelectionReplyMarkup,
  buildEducationCoursesReplyMarkup,
  buildEducationLevelsReplyMarkup,
  buildNumericSelectionReplyMarkup,
  CITY_MENU_REPLY_MARKUP,
  CITY_REPLY_MARKUP,
  JOB_RESULT_REPLY_MARKUP,
  SHOP_MENU_REPLY_MARKUP,
  STUDY_RESULT_REPLY_MARKUP,
} from "./city";
export { buildCompanyReplyMarkup } from "./company";
export { EXTRAS_MENU_REPLY_MARKUP, buildMainMenuReplyMarkup, MAIN_MENU_REPLY_MARKUP } from "./home";
export { PVP_MENU_REPLY_MARKUP } from "./pvp";
export { buildReplyKeyboard, HIDE_REPLY_KEYBOARD_MARKUP } from "./shared";
