import { randomUUID } from "crypto";
import { findBestPvpBotTarget, generateBalancedBotForTarget, leavePvpQueue, queuePlayerForPvp, updatePvpHeartbeat } from "./pvp-duel";
import { applyGameStatePatch, getUserWithGameState } from "./game-engine";
import { storage } from "./storage";

const TEST_BOT_USERNAME = process.env.PVP_TEST_BOT_USERNAME || "pvp_test_bot";
const TEST_BOT_ENABLED = String(process.env.PVP_TEST_BOT_ENABLED ?? "true").toLowerCase() !== "false";
const TEST_BOT_TICK_MS = Math.max(2_000, Number(process.env.PVP_TEST_BOT_TICK_MS || 5_000));
const TEST_BOT_COUNT = Math.max(1, Math.min(8, Number(process.env.PVP_TEST_BOT_COUNT || 4)));

let timer: NodeJS.Timeout | null = null;

function applyXpProgress(level: number, experience: number, gain: number) {
  let nextLevel = Math.max(1, Number(level || 1));
  let nextExperience = Math.max(0, Number(experience || 0)) + Math.max(0, Math.floor(gain));
  while (nextExperience >= 100) {
    nextLevel += 1;
    nextExperience -= 100;
  }
  return { level: nextLevel, experience: nextExperience };
}

function normalizeDuelSkills(skills: Record<string, number> | undefined) {
  const analytics = Math.max(0, Number(skills?.analytics || 0));
  const design = Math.max(0, Number(skills?.design || 0));
  const drawing = Math.max(0, Number(skills?.drawing || 0));
  const coding = Math.max(0, Number(skills?.coding || 0));
  const modeling = Math.max(0, Number(skills?.modeling || 0));
  const testing = Math.max(0, Number(skills?.testing || 0));
  const attention = Math.max(0, Number(skills?.attention || 0));
  const skillSum = analytics + design + drawing + coding + modeling + testing + attention;
  return { analytics, design, drawing, coding, modeling, testing, attention, skillSum };
}

async function ensureTestBotUser(index: number) {
  const username = `${TEST_BOT_USERNAME}_${index + 1}`;
  const existing = await storage.getUserByUsername(username);
  if (existing) return existing;
  return await storage.createUser({
    username,
    password: `test_bot_${randomUUID()}`,
    city: "Сан-Франциско",
    personality: "workaholic",
    gender: "male",
  });
}

async function tickSinglePvpTestBot(index: number, reservedTargets: Set<string>) {
  const user = await ensureTestBotUser(index);
  const snapshot = await getUserWithGameState(user.id);
  if (!snapshot) return;

  const target = findBestPvpBotTarget(user.id, Date.now(), [...reservedTargets]);
  const xpGain = target ? 1 : 0;
  const levelState = applyXpProgress(Number(user.level || 1), Number(user.experience || 0), xpGain);
  const skills = { ...(snapshot.game.skills ?? {}) } as Record<string, number>;

  if (!target) {
    leavePvpQueue(user.id);
    await storage.updateUser(user.id, {
      experience: levelState.experience,
      lastActiveAt: Math.floor(Date.now() / 1000),
      pvpRating: Math.max(0, Number(user.pvpRating || 1000)),
    });
    return;
  }

  reservedTargets.add(target.userId);
  const balancedBot = generateBalancedBotForTarget({
    userId: target.userId,
    username: target.username,
    level: target.level,
    rating: target.rating,
    skills: target.skills,
    skillSum: target.skillSum,
    pvpPowerScore: target.pvpPowerScore,
    gadget: target.gadget ?? null,
    isBot: false,
  }, user.id, user.username);

  skills.analytics = balancedBot.skills.analytics;
  skills.design = balancedBot.skills.design;
  skills.drawing = balancedBot.skills.drawing;
  skills.coding = balancedBot.skills.coding;
  skills.modeling = balancedBot.skills.modeling;
  skills.testing = balancedBot.skills.testing;
  skills.attention = balancedBot.skills.attention;

  const nextLevel = Math.max(1, Math.round(Number(target.level || levelState.level) * (0.99 + Math.random() * 0.02)));
  const nextRating = Math.max(0, Math.round(Number(target.rating || user.pvpRating || 1000) * (0.99 + Math.random() * 0.02)));
  await storage.updateUser(user.id, {
    level: nextLevel,
    experience: levelState.experience,
    lastActiveAt: Math.floor(Date.now() / 1000),
    pvpRating: nextRating,
  });
  applyGameStatePatch(user.id, { skills });

  const duelSkills = normalizeDuelSkills(skills);
  const pvpPowerScore = duelSkills.skillSum + nextLevel * 2;
  queuePlayerForPvp({
    userId: user.id,
    username: user.username,
    level: nextLevel,
    rating: nextRating,
    skills: {
      analytics: duelSkills.analytics,
      design: duelSkills.design,
      drawing: duelSkills.drawing,
      coding: duelSkills.coding,
      modeling: duelSkills.modeling,
      testing: duelSkills.testing,
      attention: duelSkills.attention,
    },
    skillSum: duelSkills.skillSum,
    pvpPowerScore,
    gadget: null,
    isBot: true,
  });
  updatePvpHeartbeat(user.id);
}

async function tickPvpTestBots() {
  const reservedTargets = new Set<string>();
  for (let index = 0; index < TEST_BOT_COUNT; index += 1) {
    await tickSinglePvpTestBot(index, reservedTargets);
  }
}

export function startPvpTestBotLoop() {
  if (!TEST_BOT_ENABLED || timer) return;
  timer = setInterval(() => {
    void tickPvpTestBots().catch((error) => {
      console.error("pvp-test-bot tick failed:", error);
    });
  }, TEST_BOT_TICK_MS);
  timer.unref?.();
}

export function stopPvpTestBotLoop() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}
