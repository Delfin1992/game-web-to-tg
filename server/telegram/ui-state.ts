import { lastTelegramMenuByUserId, playerLocationByUserId } from "./state";
import { HIDE_REPLY_KEYBOARD_MARKUP } from "./keyboards/shared";

export type PlayerHubLocation = "home" | "city" | "company";
export type EducationLevelKey = "school" | "college" | "university";
export type ShopMenuTab = "all" | "parts" | "gadgets" | "sell";
export type TelegramMenuLike =
  | { menu: "home" }
  | { menu: string }
  | null
  | undefined;
export type TelegramMenuState =
  | { menu: "home" }
  | { menu: "extras" }
  | { menu: "city" }
  | { menu: "repair_service" }
  | { menu: "housing" }
  | { menu: "jobs" }
  | { menu: "study_levels" }
  | { menu: "study_courses"; levelKey: EducationLevelKey }
  | { menu: "shop"; tab: ShopMenuTab }
  | { menu: "bank" }
  | { menu: "company"; section: string };

/**
 * Home keyboard must only be shown on the real home screen.
 */
export function shouldShowHomeKeyboard(location: PlayerHubLocation | null | undefined) {
  return (location ?? "home") === "home";
}

export function shouldShowHomeKeyboardForMenu(state: TelegramMenuLike) {
  return (state?.menu ?? "home") === "home";
}

export function rememberTelegramMenu(userId: string, state: TelegramMenuState) {
  lastTelegramMenuByUserId.set(userId, state);
}

export function getLastTelegramMenuState(userId: string) {
  return lastTelegramMenuByUserId.get(userId);
}

export function getPlayerHubLocation(userId: string): PlayerHubLocation {
  return playerLocationByUserId.get(userId) ?? "home";
}

export function setPlayerHubLocation(userId: string, location: PlayerHubLocation) {
  playerLocationByUserId.set(userId, location);
}

/**
 * Universal fallback for non-home screens where we must not leak the home keyboard.
 */
export function getHiddenKeyboardMarkup() {
  return HIDE_REPLY_KEYBOARD_MARKUP;
}
