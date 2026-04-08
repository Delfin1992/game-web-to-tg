import { randomUUID } from "crypto";
import type { PartType } from "../client/src/lib/parts";
import type { Company } from "../shared/schema";
import { storage } from "./storage";
import {
  applyGameStatePatch,
  getCurrencySymbol,
  getUserWithGameState,
  type GameInventoryItem,
} from "./game-engine";
import { trackDailyQuestEvent } from "./daily-quests/service";
import { createNotification } from "./notifications/service";
import {
  calculateCompanySkillContribution,
  getTaskContributions,
  markCompanyRepairCompleted,
  recordCompanyTaskContribution,
  type CompanyContributionSkillType,
} from "./company-coop";

export type GadgetRepairStatus = "none" | "queued" | "accepted" | "in_progress" | "completed";
export type RepairOrderStatus = "queued" | "accepted" | "in_progress" | "completed" | "failed" | "cancelled";

export type RepairPartRequirement = {
  type: PartType;
  label: string;
  quantity: number;
};

export type RepairStage = {
  index: number;
  title: string;
  skillOptions: CompanyContributionSkillType[];
  skillType: CompanyContributionSkillType;
  target: number;
  progress: number;
  completedAt?: number | null;
  contributions: Array<{
    id: string;
    userId: string;
    username: string;
    value: number;
    skillType: CompanyContributionSkillType;
    createdAt: number;
  }>;
};

export type RepairOrder = {
  id: string;
  city: string;
  playerId: string;
  gadgetId: string;
  gadgetName: string;
  rarity: string;
  condition: number;
  maxCondition: number;
  minPrice: number;
  maxPrice: number;
  finalPrice: number;
  requiredParts: RepairPartRequirement[];
  repairTimeMs: number;
  status: RepairOrderStatus;
  assignedCompanyId: string | null;
  acceptedBy: string | null;
  acceptedAt: number | null;
  dueAt: number | null;
  completedAt: number | null;
  companyChatId: number | null;
  playerChatId: number | null;
  failureReason?: string;
  rewardGranted?: boolean;
  paymentProcessed?: boolean;
  currentStageIndex?: number;
  stages?: RepairStage[];
  createdAt: number;
  updatedAt: number;
};

export type RepairSweepEvent =
  | { type: "completed"; order: RepairOrder; charged: number }
  | { type: "failed"; order: RepairOrder; reason: string }
  | { type: "recovered"; orderId: string; playerId: string; gadgetId: string; reason: string };

const repairOrdersById = new Map<string, RepairOrder>();
const acceptedStartTimeoutMs = 10 * 60 * 1000;

const PART_LABELS: Record<PartType, string> = {
  processor: "процессор",
  memory: "оперативная память",
  display: "дисплей",
  battery: "батарея",
  motherboard: "материнская плата",
  case: "корпус",
  cooling: "система охлаждения",
  controller: "контроллер",
  asic_chip: "ASIC-чип",
  camera: "камера",
  storage: "накопитель",
  strap: "ремешок",
  power: "блок питания",
};

const REPAIR_STAGE_DEFINITIONS: Array<{
  title: string;
  skillOptions: CompanyContributionSkillType[];
  targetShare: number;
}> = [
  { title: "Диагностика", skillOptions: ["analytics", "testing"], targetShare: 0.28 },
  { title: "Исправление", skillOptions: ["coding"], targetShare: 0.46 },
  { title: "Проверка", skillOptions: ["testing"], targetShare: 0.26 },
];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function getRepairOrderStatusLabel(status: RepairOrderStatus) {
  switch (status) {
    case "queued":
      return "в очереди";
    case "accepted":
      return "принят";
    case "in_progress":
      return "в ремонте";
    case "completed":
      return "завершён";
    case "failed":
      return "провален";
    case "cancelled":
      return "отменён";
    default:
      return "неизвестно";
  }
}

function getGadgetRarityMultiplier(rarityRaw: string) {
  const rarity = String(rarityRaw || "Common").trim().toLowerCase();
  if (rarity === "exclusive") return 2.4;
  if (rarity === "legendary") return 2.1;
  if (rarity === "epic") return 1.7;
  if (rarity === "rare") return 1.35;
  if (rarity === "uncommon") return 1.12;
  return 1;
}

function normalizeGadget(item: GameInventoryItem) {
  const maxCondition = Math.max(1, Math.round(Number(item.maxCondition ?? item.maxDurability ?? 100) || 100));
  const condition = clamp(Math.round(Number(item.condition ?? item.durability ?? maxCondition) || maxCondition), 0, maxCondition);
  return {
    ...item,
    condition,
    maxCondition,
    isBroken: Boolean(item.isBroken) || condition <= 0,
    repairStatus: item.repairStatus ?? "none",
    repairLocked: Boolean(item.repairLocked),
  };
}

function getGadgetDeviceHint(item: Pick<GameInventoryItem, "id" | "name" | "stats">) {
  const label = `${item.id} ${item.name}`.toLowerCase();
  if (label.includes("asic")) return "asic";
  if (label.includes("watch") || label.includes("час")) return "watch";
  if (label.includes("laptop") || label.includes("macbook") || label.includes("ноут")) return "laptop";
  if (label.includes("tablet") || label.includes("tab") || label.includes("планш")) return "tablet";
  return "phone";
}

function buildRepairRequiredParts(gadget: Pick<GameInventoryItem, "id" | "name" | "stats" | "condition" | "maxCondition">): RepairPartRequirement[] {
  const stats = Object.entries(gadget.stats || {}).sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0));
  const damageRatio = 1 - (Math.max(0, Number(gadget.condition || 0)) / Math.max(1, Number(gadget.maxCondition || 100)));
  const deviceHint = getGadgetDeviceHint(gadget);
  const required = new Map<PartType, number>();
  const push = (type: PartType, qty = 1) => {
    if (qty > 0) required.set(type, Math.max(qty, required.get(type) ?? 0));
  };

  if (deviceHint === "asic") {
    push("asic_chip", 1);
    push("cooling", damageRatio > 0.55 ? 2 : 1);
    push("power", 1);
  } else if (deviceHint === "watch") {
    push("display", 1);
    push("battery", 1);
    push("strap", damageRatio > 0.65 ? 1 : 0);
  } else if (deviceHint === "laptop") {
    push("processor", 1);
    push("memory", 1);
    push("storage", 1);
    push("cooling", damageRatio > 0.45 ? 1 : 0);
  } else if (deviceHint === "tablet") {
    push("display", 1);
    push("battery", 1);
    push("memory", 1);
  } else {
    push("processor", 1);
    push("display", 1);
    push("battery", 1);
  }

  for (const [skill] of stats.slice(0, 2)) {
    if (skill === "coding") push("processor", 1);
    if (skill === "testing") push("controller", 1);
    if (skill === "analytics") push("memory", 1);
    if (skill === "design" || skill === "drawing") push("display", 1);
    if (skill === "attention") push("battery", 1);
    if (skill === "modeling") push("camera", 1);
  }

  return Array.from(required.entries())
    .filter(([, quantity]) => quantity > 0)
    .slice(0, 4)
    .map(([type, quantity]) => ({ type, quantity, label: PART_LABELS[type] }));
}

function chooseBestRepairSkill(
  skillOptions: CompanyContributionSkillType[],
  skills: Partial<Record<CompanyContributionSkillType, number>>,
) {
  return [...skillOptions].sort((left, right) => Number(skills[right] || 0) - Number(skills[left] || 0))[0] ?? skillOptions[0];
}

function buildRepairStages(
  gadget: Pick<GameInventoryItem, "stats" | "condition" | "maxCondition" | "isBroken">,
  repairTimeMs: number,
): RepairStage[] {
  const normalized = normalizeGadget(gadget as GameInventoryItem);
  const damageRatio = 1 - normalized.condition / Math.max(1, normalized.maxCondition);
  const statPower = Object.values(normalized.stats || {}).reduce((sum, value) => sum + Math.max(0, Number(value || 0)), 0);
  const totalTarget = Math.max(
    60,
    Math.round(statPower * 3.2 + damageRatio * 220 + repairTimeMs / 60000 * 4 + (normalized.isBroken ? 90 : 0)),
  );
  return REPAIR_STAGE_DEFINITIONS.map((stage, index) => ({
    index,
    title: stage.title,
    skillOptions: [...stage.skillOptions],
    skillType: stage.skillOptions[0],
    target: Math.max(20, Math.round(totalTarget * stage.targetShare)),
    progress: 0,
    completedAt: null,
    contributions: [],
  }));
}

function getCurrentRepairStage(order: RepairOrder | null | undefined) {
  if (!order || !Array.isArray(order.stages) || !order.stages.length) return null;
  const index = Math.max(0, Number(order.currentStageIndex || 0));
  return order.stages[index] ?? null;
}

function isRepairStageComplete(stage: RepairStage | null | undefined) {
  if (!stage) return false;
  return Number(stage.progress || 0) >= Number(stage.target || 0);
}

export function calculateRepairEstimate(gadget: Pick<GameInventoryItem, "id" | "name" | "stats" | "rarity" | "condition" | "maxCondition" | "isBroken">) {
  const normalized = normalizeGadget(gadget as GameInventoryItem);
  const damageRatio = 1 - (normalized.condition / Math.max(1, normalized.maxCondition));
  const statPower = Object.values(normalized.stats || {}).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
  const rarityMultiplier = getGadgetRarityMultiplier(normalized.rarity);
  const brokenExtra = normalized.isBroken ? 1.25 : 1;
  const basePrice = (180 + statPower * 65) * rarityMultiplier * (1 + damageRatio * 1.6) * brokenExtra;
  const minPrice = Math.max(50, Math.round(basePrice * 0.92));
  const maxPrice = Math.max(minPrice, Math.round(basePrice * 1.08));
  const finalPrice = Math.round((minPrice + maxPrice) / 2);
  const repairTimeMs = (4 + Math.ceil(damageRatio * 8) + (normalized.isBroken ? 4 : 0)) * 60 * 1000;
  const requiredParts = buildRepairRequiredParts(normalized);
  return { minPrice, maxPrice, finalPrice, repairTimeMs, requiredParts };
}

async function updateGadgetRepairFields(userId: string, gadgetId: string, patch: Partial<GameInventoryItem>) {
  const snapshot = await getUserWithGameState(userId);
  if (!snapshot) return false;
  const inventory = [...snapshot.game.inventory];
  const index = inventory.findIndex((item) => String(item.id) === String(gadgetId));
  if (index < 0) return false;
  inventory[index] = { ...inventory[index], ...patch };
  applyGameStatePatch(userId, { inventory });
  return true;
}

async function resetGadgetRepairState(userId: string, gadgetId: string) {
  await updateGadgetRepairFields(userId, gadgetId, {
    repairStatus: "none",
    repairOrderId: undefined,
    repairLocked: false,
  });
}

export async function listRepairableGadgets(userId: string) {
  const snapshot = await getUserWithGameState(userId);
  if (!snapshot) return [];
  return (snapshot.game.inventory || [])
    .filter((item) => item.type === "gadget" || item.type === "gear")
    .map((item) => normalizeGadget(item))
    .filter((item) => item.condition < item.maxCondition || item.isBroken);
}

export function getRepairOrder(orderId: string) {
  return repairOrdersById.get(String(orderId || "").trim()) ?? null;
}

export function listRepairOrdersForCity(city: string) {
  return Array.from(repairOrdersById.values())
    .filter((order) => order.city === city && (order.status === "queued" || order.status === "accepted" || order.status === "in_progress"))
    .sort((a, b) => a.createdAt - b.createdAt);
}

export function listRepairOrdersForCompany(companyId: string) {
  return Array.from(repairOrdersById.values())
    .filter((order) => order.assignedCompanyId === companyId && (order.status === "accepted" || order.status === "in_progress"))
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function createRepairOrder(input: {
  userId: string;
  gadgetRef: string;
  playerChatId?: number | null;
  requestedPrice?: number | null;
}) {
  const snapshot = await getUserWithGameState(input.userId);
  if (!snapshot) throw new Error("Игрок не найден");
  const user = snapshot.user;
  const trimmed = String(input.gadgetRef || "").trim();
  const gadget = (snapshot.game.inventory || [])
    .find((item, index) => String(item.id) === trimmed || String(index + 1) === trimmed);
  if (!gadget || (gadget.type !== "gadget" && gadget.type !== "gear")) {
    throw new Error("Гаджет не найден");
  }

  const normalized = normalizeGadget(gadget);
  if (!(normalized.condition < normalized.maxCondition || normalized.isBroken)) {
    throw new Error("Этот гаджет не нуждается в ремонте");
  }
  if (normalized.repairLocked || (normalized.repairStatus && normalized.repairStatus !== "none")) {
    throw new Error("У этого гаджета уже есть активный заказ на ремонт");
  }

  const estimate = calculateRepairEstimate(normalized);
  if (Number(user.balance || 0) < estimate.maxPrice) {
    throw new Error(`Для отправки в сервис нужно минимум ${getCurrencySymbol(user.city)}${estimate.maxPrice}`);
  }

  const requestedPrice = input.requestedPrice == null ? estimate.finalPrice : Math.round(Number(input.requestedPrice));
  if (!Number.isFinite(requestedPrice)) {
    throw new Error("Укажи корректную цену ремонта");
  }
  if (requestedPrice < estimate.minPrice || requestedPrice > estimate.maxPrice) {
    throw new Error(`Цена ремонта должна быть в диапазоне ${getCurrencySymbol(user.city)}${estimate.minPrice}-${estimate.maxPrice}`);
  }

  const order: RepairOrder = {
    id: randomUUID(),
    city: user.city,
    playerId: user.id,
    gadgetId: normalized.id,
    gadgetName: normalized.name,
    rarity: normalized.rarity,
    condition: normalized.condition,
    maxCondition: normalized.maxCondition,
    minPrice: estimate.minPrice,
    maxPrice: estimate.maxPrice,
    finalPrice: requestedPrice,
    requiredParts: estimate.requiredParts,
    repairTimeMs: estimate.repairTimeMs,
    status: "queued",
    assignedCompanyId: null,
    acceptedBy: null,
    acceptedAt: null,
    dueAt: null,
    completedAt: null,
    companyChatId: null,
    playerChatId: input.playerChatId ?? null,
    currentStageIndex: 0,
    stages: buildRepairStages(normalized, estimate.repairTimeMs),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  repairOrdersById.set(order.id, order);
  await updateGadgetRepairFields(user.id, normalized.id, {
    repairStatus: "queued",
    repairOrderId: order.id,
    repairLocked: true,
    isEquipped: false,
  });
  const questProgress = await trackDailyQuestEvent(user.id, { type: "repair_gadget", value: 1 });
  console.log(`[repair] created order=${order.id} player=${user.id} gadget=${normalized.id}`);
  return { ...order, notices: questProgress.notices };
}

export async function cancelRepairOrderByPlayer(userId: string, orderId: string) {
  const order = getRepairOrder(orderId);
  if (!order || order.playerId !== userId) throw new Error("Заказ не найден");
  if (order.status !== "queued") throw new Error("Этот заказ уже нельзя отменить");
  order.status = "cancelled";
  order.updatedAt = Date.now();
  await resetGadgetRepairState(order.playerId, order.gadgetId);
  console.log(`[repair] cancelled order=${order.id} player=${userId}`);
  return order;
}

export async function acceptRepairOrder(input: {
  orderId: string;
  company: Company;
  acceptedBy: string;
  companyChatId?: number | null;
}) {
  const order = getRepairOrder(input.orderId);
  if (!order) throw new Error("Заказ не найден");
  if (order.status !== "queued") throw new Error("Заказ уже недоступен");
  order.status = "accepted";
  order.assignedCompanyId = input.company.id;
  order.acceptedBy = input.acceptedBy;
  order.acceptedAt = Date.now();
  order.companyChatId = input.companyChatId ?? null;
  order.updatedAt = Date.now();
  await updateGadgetRepairFields(order.playerId, order.gadgetId, {
    repairStatus: "accepted",
    repairOrderId: order.id,
    repairLocked: true,
  });
  console.log(`[repair] accepted order=${order.id} company=${input.company.id} by=${input.acceptedBy}`);
  return order;
}

export async function startRepairOrder(input: {
  orderId: string;
  companyId: string;
  startedBy: string;
}) {
  const order = getRepairOrder(input.orderId);
  if (!order) throw new Error("Заказ не найден");
  if (order.status !== "accepted") throw new Error("Заказ ещё не принят");
  if (order.assignedCompanyId !== input.companyId) throw new Error("Заказ закреплён за другой компанией");
  order.status = "in_progress";
  order.dueAt = null;
  order.updatedAt = Date.now();
  await updateGadgetRepairFields(order.playerId, order.gadgetId, {
    repairStatus: "in_progress",
    repairLocked: true,
  });
  console.log(`[repair] started order=${order.id} company=${input.companyId} by=${input.startedBy}`);
  return order;
}

export async function contributeRepairOrder(input: {
  orderId: string;
  companyId: string;
  userId: string;
}) {
  const order = getRepairOrder(input.orderId);
  if (!order) throw new Error("Заказ не найден");
  if (order.assignedCompanyId !== input.companyId) throw new Error("Заказ закреплён за другой компанией");
  if (order.status === "completed") throw new Error("Заказ уже завершён");
  if (order.status === "failed" || order.status === "cancelled") throw new Error("Заказ больше недоступен");
  if (order.status === "accepted") {
    await startRepairOrder({ orderId: order.id, companyId: input.companyId, startedBy: input.userId });
  }
  if (order.status !== "in_progress") throw new Error("Ремонт ещё не запущен");

  const snapshot = await getUserWithGameState(input.userId);
  if (!snapshot) throw new Error("Игрок не найден");

  const currentStage = getCurrentRepairStage(order);
  if (!currentStage) throw new Error("У ремонта не найден текущий этап");
  const chosenSkill = chooseBestRepairSkill(currentStage.skillOptions, (snapshot.game as any)?.skills ?? {});
  const calculation = await calculateCompanySkillContribution({
    companyId: input.companyId,
    userId: input.userId,
    skillType: chosenSkill,
  });

  const contribution = recordCompanyTaskContribution({
    companyId: input.companyId,
    userId: calculation.userId,
    username: calculation.username,
    taskId: order.id,
    source: "repair",
    skillType: chosenSkill,
    value: calculation.value,
    professionBonus: calculation.professionBonus,
    departmentEfficiency: calculation.departmentEfficiency,
    randomMultiplier: calculation.randomMultiplier,
    stageIndex: currentStage.index,
  });

  currentStage.skillType = chosenSkill;
  currentStage.progress = Number((currentStage.progress + contribution.value).toFixed(2));
  currentStage.contributions.push({
    id: contribution.id,
    userId: contribution.userId,
    username: contribution.username,
    value: contribution.value,
    skillType: contribution.skillType,
    createdAt: contribution.createdAt,
  });

  let completed = false;
  if (isRepairStageComplete(currentStage)) {
    currentStage.progress = Math.max(currentStage.progress, currentStage.target);
    currentStage.completedAt = Date.now();
    order.currentStageIndex = Math.max(0, Number(order.currentStageIndex || 0)) + 1;
    if ((order.currentStageIndex ?? 0) >= (order.stages?.length ?? 0)) {
      await completeRepairOrder(order.id);
      completed = true;
    }
  }
  order.updatedAt = Date.now();

  return {
    order: getRepairOrder(order.id),
    stage: getCurrentRepairStage(order),
    contribution,
    contributions: getTaskContributions(order.id),
    completed,
  };
}

export async function completeRepairOrder(orderId: string) {
  const order = getRepairOrder(orderId);
  if (!order) throw new Error("Заказ не найден");
  if (order.status !== "in_progress") throw new Error("Заказ ещё не в работе");

  const snapshot = await getUserWithGameState(order.playerId);
  if (!snapshot) throw new Error("Игрок не найден");
  const gadget = snapshot.game.inventory.find((item) => String(item.id) === String(order.gadgetId));
  if (!gadget || (gadget.type !== "gadget" && gadget.type !== "gear")) {
    throw new Error("Связанный гаджет не найден");
  }
  const normalized = normalizeGadget(gadget);

  const payable = Math.max(0, Number(order.finalPrice || 0));
  const currentBalance = Math.max(0, Number(snapshot.user.balance || 0));
  const charged = Math.min(currentBalance, payable);
  if (!order.paymentProcessed) {
    await storage.updateUser(order.playerId, { balance: currentBalance - charged });
    order.paymentProcessed = true;
  }

  if (order.assignedCompanyId && !order.rewardGranted) {
    const company = await storage.getCompany(order.assignedCompanyId);
    if (company) {
      const companyRewardGrm = Math.max(40, Math.round(Number(order.finalPrice || 0) / 8));
      const complexityXp = Math.max(1, Math.ceil(order.requiredParts.length + (order.maxPrice - order.minPrice) / 800));
      await storage.updateCompany(company.id, {
        balance: Number(company.balance || 0) + companyRewardGrm,
        ork: Number(company.ork || 0) + complexityXp,
      });
      order.rewardGranted = true;
    }
  }

  await updateGadgetRepairFields(order.playerId, order.gadgetId, {
    condition: normalized.maxCondition,
    maxCondition: normalized.maxCondition,
    durability: normalized.maxCondition,
    maxDurability: normalized.maxCondition,
    isBroken: false,
    repairStatus: "none",
    repairOrderId: undefined,
    repairLocked: false,
  });

  order.status = "completed";
  order.completedAt = Date.now();
  order.updatedAt = Date.now();
  createNotification(order.playerId, {
    type: "REPAIR_COMPLETED",
    title: "🔧 Ремонт завершён",
    message: `Гаджет «${order.gadgetName}» отремонтирован. Списано: ${getCurrencySymbol(order.city)}${charged}.`,
    dataJson: {
      orderId: order.id,
      gadgetId: order.gadgetId,
      gadgetName: order.gadgetName,
      charged,
      companyId: order.assignedCompanyId,
    },
  });

  if (order.assignedCompanyId) {
    const participants = new Map<string, string>();
    for (const contribution of getTaskContributions(order.id)) {
      participants.set(contribution.userId, contribution.username);
    }
    for (const [userId, username] of participants.entries()) {
      markCompanyRepairCompleted({
        companyId: order.assignedCompanyId,
        userId,
        username,
      });
      createNotification(userId, {
        type: "REPAIR_REWARD_AVAILABLE",
        title: "🛠 Вклад в ремонт засчитан",
        message: `Заказ «${order.gadgetName}» завершён. Твой вклад добавлен в статистику компании.`,
        dataJson: {
          orderId: order.id,
          gadgetName: order.gadgetName,
          companyId: order.assignedCompanyId,
        },
      });
    }
  }

  console.log(`[repair] completed order=${order.id} charged=${charged}`);
  return { order, charged };
}

export async function failRepairOrder(orderId: string, reason: string) {
  const order = getRepairOrder(orderId);
  if (!order) throw new Error("Заказ не найден");
  if (order.status === "completed" || order.status === "failed" || order.status === "cancelled") {
    return order;
  }
  order.status = "failed";
  order.failureReason = reason;
  order.updatedAt = Date.now();
  await resetGadgetRepairState(order.playerId, order.gadgetId);
  console.warn(`[repair] failed order=${order.id} reason=${reason}`);
  return order;
}

export async function sweepRepairOrders(nowMs: number = Date.now()) {
  const events: RepairSweepEvent[] = [];
  for (const order of repairOrdersById.values()) {
    const snapshot = await getUserWithGameState(order.playerId);
    const gadget = snapshot?.game.inventory.find((item) => String(item.id) === String(order.gadgetId));
    if (!gadget) {
      console.warn(`[repair] recovered order=${order.id} gadget missing`);
      events.push({
        type: "recovered",
        orderId: order.id,
        playerId: order.playerId,
        gadgetId: order.gadgetId,
        reason: "Гаджет пропал из инвентаря",
      });
      repairOrdersById.delete(order.id);
      continue;
    }

    const normalized = normalizeGadget(gadget);
    if ((order.status === "queued" || order.status === "accepted" || order.status === "in_progress") && normalized.repairOrderId !== order.id) {
      await resetGadgetRepairState(order.playerId, order.gadgetId);
      order.status = "failed";
      order.failureReason = "Связь заказа с гаджетом была нарушена";
      order.updatedAt = nowMs;
      events.push({ type: "failed", order, reason: order.failureReason });
      continue;
    }

    if ((order.status === "accepted" || order.status === "in_progress") && order.assignedCompanyId) {
      const company = await storage.getCompany(order.assignedCompanyId);
      if (!company) {
        await failRepairOrder(order.id, "Компания-исполнитель больше не найдена");
        events.push({ type: "failed", order: { ...order }, reason: "Компания-исполнитель больше не найдена" });
        continue;
      }
    }

    if (order.status === "accepted" && order.acceptedAt && nowMs > order.acceptedAt + acceptedStartTimeoutMs) {
      await failRepairOrder(order.id, "Компания не начала ремонт вовремя");
      events.push({ type: "failed", order: { ...order }, reason: "Компания не начала ремонт вовремя" });
      continue;
    }
  }
  return events;
}
