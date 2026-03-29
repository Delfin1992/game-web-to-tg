/**
 * Shared reply keyboard helpers.
 */

export function buildReplyKeyboard(rows: string[][]) {
  return {
    keyboard: rows.map((row) => row.map((text) => ({ text }))),
    resize_keyboard: true,
  };
}

export const HIDE_REPLY_KEYBOARD_MARKUP = {
  remove_keyboard: true,
};
