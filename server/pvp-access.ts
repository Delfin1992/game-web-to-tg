import type { User } from "../shared/schema";
import { PROFESSION_UNLOCK_LEVEL, type ProfessionId } from "../shared/professions";
import { getPlayerProfessionId } from "./player-meta";

export type PvpAccessReason = "level" | "no_profession";

export type PvpAccessResult =
  | { ok: true; professionId: ProfessionId }
  | { ok: false; reason: PvpAccessReason };

export function canEnterPvp(user: Pick<User, "level" | "tutorialState">): PvpAccessResult {
  if (Number(user.level || 0) < PROFESSION_UNLOCK_LEVEL) {
    return { ok: false, reason: "level" };
  }
  const professionId = getPlayerProfessionId(user);
  if (!professionId) {
    return { ok: false, reason: "no_profession" };
  }
  return { ok: true, professionId };
}

export function getPvpAccessMessage(reason: PvpAccessReason) {
  if (reason === "level") {
    return `PvP откроется на ${PROFESSION_UNLOCK_LEVEL} уровне.\nПродолжай прокачку, чтобы открыть выбор профессии и получить доступ к боям.`;
  }
  return [
    "Для участия в PvP нужно выбрать профессию.",
    "Профессия определяет твой стиль развития, бонусы к навыкам и сильные стороны в бою.",
  ].join("\n");
}
