import { randomUUID } from "crypto";
import {
  STOCK_ASSET_CATALOG,
  type FutureIpoWatchView,
  type StockAssetDefinition,
  type StockAssetWeeklyReportView,
  type StockDividendPayoutView,
  type StockHoldingView,
  type StockMarketNewsView,
  type StockMarketSnapshot,
  type StockQuoteView,
  type StockSectorPhase,
  type StockSectorReportView,
  type StockWeeklyMarketReportView,
} from "../shared/stock-exchange";
import { applyGameStatePatch, getUserWithGameState } from "./game-engine";
import { storage } from "./storage";

type StockAssetRuntime = {
  definition: StockAssetDefinition;
  currentPrice: number;
  previousPrice: number;
};

type UserHoldingRuntime = {
  quantity: number;
  averagePrice: number;
  firstBoughtAtMs: number;
  lastDividendWeekKey?: string;
};

const STOCK_TICK_MS = 60_000;
const STOCK_NEWS_DURATION_MS = 2 * 60 * 60_000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const stockAssetsByTicker = new Map<string, StockAssetRuntime>();
const stockHoldingsByUserId = new Map<string, Map<string, UserHoldingRuntime>>();
const recentDividendPayoutsByUserId = new Map<string, StockDividendPayoutView[]>();

let lastAdvancedAtMs: number | null = null;
let activeNews: StockMarketNewsView | null = null;
let lastBroadcastedNewsId: string | null = null;

const STOCK_NEWS_POOL: Array<{
  title: string;
  description: string;
  affectedSectors: StockAssetDefinition["sector"][];
  mood: "bullish" | "bearish" | "neutral";
  impact: number;
}> = [
  {
    title: "AI снова в фокусе фондов",
    description: "Крупные фонды возвращают интерес к AI-стекам. Ростовые бумаги получают дополнительный приток капитала.",
    affectedSectors: ["ai", "cloud"],
    mood: "bullish",
    impact: 0.018,
  },
  {
    title: "Перебои в цепочках поставок",
    description: "Поставки железа и компонентов буксуют. Hardware-сектор чувствует давление и повышенную нервозность.",
    affectedSectors: ["hardware"],
    mood: "bearish",
    impact: -0.018,
  },
  {
    title: "Инвесторы фиксируют прибыль",
    description: "После сильного роста игроки осторожничают. Волатильность растёт, а движения становятся резче.",
    affectedSectors: ["ai", "cloud", "hardware"],
    mood: "bearish",
    impact: -0.012,
  },
  {
    title: "Корпоративный спрос на cloud растёт",
    description: "B2B-клиенты активнее переносят сервисы в облако. Cloud-сектор получает устойчивый драйвер.",
    affectedSectors: ["cloud", "tech"],
    mood: "bullish",
    impact: 0.014,
  },
  {
    title: "Рынок в режиме ожидания",
    description: "Крупного драйвера пока нет. Бумаги двигаются умеренно, а игроки ждут новых сигналов недели.",
    affectedSectors: ["ai", "cloud", "hardware"],
    mood: "neutral",
    impact: 0,
  },
];

const SECTOR_LABELS: Record<StockAssetDefinition["sector"], string> = {
  tech: "Tech",
  hardware: "Hardware",
  cloud: "Cloud",
  design: "Design",
  ai: "AI",
  consumer: "Consumer",
  index: "Index",
};

const PHASE_BIAS: Record<StockSectorPhase, { drift: number; volatility: number; growth: number; peak: number; crash: number }> = {
  accumulation: { drift: 0.0015, volatility: 0.85, growth: 56, peak: 14, crash: 10 },
  growth: { drift: 0.0045, volatility: 1.05, growth: 68, peak: 22, crash: 12 },
  hype: { drift: 0.0085, volatility: 1.35, growth: 58, peak: 34, crash: 20 },
  peak_risk: { drift: 0.001, volatility: 1.25, growth: 34, peak: 44, crash: 36 },
  correction: { drift: -0.0065, volatility: 1.15, growth: 22, peak: 18, crash: 54 },
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function hashStringToUnit(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 10_000) / 10_000;
}

function getWeekStartMs(nowMs: number) {
  const date = new Date(nowMs);
  const day = date.getUTCDay() || 7;
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - (day - 1));
  return date.getTime();
}

function getWeekKey(nowMs: number) {
  const start = new Date(getWeekStartMs(nowMs));
  const year = start.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(year, 0, 4));
  const firstWeekStart = getWeekStartMs(firstThursday.getTime());
  const weekNumber = Math.floor((start.getTime() - firstWeekStart) / WEEK_MS) + 1;
  return `${year}-W${String(Math.max(1, weekNumber)).padStart(2, "0")}`;
}

function getNextWeekMs(nowMs: number) {
  return getWeekStartMs(nowMs) + WEEK_MS;
}

function ensureStockRuntime() {
  if (stockAssetsByTicker.size > 0) return;
  for (const asset of STOCK_ASSET_CATALOG) {
    stockAssetsByTicker.set(asset.ticker, {
      definition: asset,
      currentPrice: asset.basePrice,
      previousPrice: asset.basePrice,
    });
  }
}

function getSectorPhase(sector: StockAssetDefinition["sector"], weekKey: string): StockSectorPhase {
  const roll = hashStringToUnit(`${weekKey}:${sector}:phase`);
  if (roll < 0.18) return "accumulation";
  if (roll < 0.46) return "growth";
  if (roll < 0.64) return "hype";
  if (roll < 0.82) return "peak_risk";
  return "correction";
}

function getSectorOutlook(sector: StockAssetDefinition["sector"], weekKey: string) {
  const phase = getSectorPhase(sector, weekKey);
  const phaseBias = PHASE_BIAS[phase];
  return {
    sector,
    phase,
    ...phaseBias,
  };
}

function getCurrentSectorOutlook(sector: StockAssetDefinition["sector"], nowMs: number) {
  return getSectorOutlook(sector, getWeekKey(nowMs));
}

function pickNextNews(nowMs: number) {
  const roll = hashStringToUnit(`${Math.floor(nowMs / STOCK_NEWS_DURATION_MS)}:news`);
  const index = Math.floor(roll * STOCK_NEWS_POOL.length) % STOCK_NEWS_POOL.length;
  const template = STOCK_NEWS_POOL[index] ?? STOCK_NEWS_POOL[0];
  activeNews = {
    id: randomUUID(),
    title: template.title,
    description: template.description,
    affectedSectors: [...template.affectedSectors],
    mood: template.mood,
    startedAtMs: nowMs,
    endsAtMs: nowMs + STOCK_NEWS_DURATION_MS,
  };
}

function getNewsImpactForSector(sector: StockAssetDefinition["sector"], nowMs: number) {
  if (!activeNews || activeNews.endsAtMs <= nowMs) return 0;
  const template = STOCK_NEWS_POOL.find((item) => item.title === activeNews?.title);
  if (!template) return 0;
  return template.affectedSectors.includes(sector) ? template.impact : 0;
}

function advanceOneTick(nowMs: number) {
  if (!activeNews || activeNews.endsAtMs <= nowMs) {
    pickNextNews(nowMs);
  }

  for (const asset of stockAssetsByTicker.values()) {
    asset.previousPrice = asset.currentPrice;
  }

  const weekKey = getWeekKey(nowMs);

  for (const asset of STOCK_ASSET_CATALOG) {
    const runtime = stockAssetsByTicker.get(asset.ticker);
    if (!runtime) continue;
    const sectorOutlook = getSectorOutlook(asset.sector, weekKey);
    const newsImpact = getNewsImpactForSector(asset.sector, nowMs);
    const randomSwing = (Math.random() - 0.5) * asset.volatility * sectorOutlook.volatility * 2;
    const nextMultiplier = 1 + asset.drift + sectorOutlook.drift + randomSwing + newsImpact;
    runtime.currentPrice = clamp(
      Number((runtime.currentPrice * nextMultiplier).toFixed(2)),
      Number((asset.basePrice * 0.6).toFixed(2)),
      Number((asset.basePrice * 2.8).toFixed(2)),
    );
  }
}

export function ensureStockExchangeAdvanced(nowMs: number = Date.now()) {
  ensureStockRuntime();
  if (lastAdvancedAtMs === null) {
    lastAdvancedAtMs = nowMs;
    pickNextNews(nowMs);
    return;
  }

  const ticks = Math.max(0, Math.floor((nowMs - lastAdvancedAtMs) / STOCK_TICK_MS));
  if (ticks <= 0) return;
  for (let tick = 0; tick < ticks; tick += 1) {
    advanceOneTick(lastAdvancedAtMs + STOCK_TICK_MS * (tick + 1));
  }
  lastAdvancedAtMs += ticks * STOCK_TICK_MS;
}

function getUserHoldingMap(userId: string) {
  let map = stockHoldingsByUserId.get(userId);
  if (!map) {
    map = new Map<string, UserHoldingRuntime>();
    stockHoldingsByUserId.set(userId, map);
  }
  return map;
}

function buildQuoteView(asset: StockAssetRuntime): StockQuoteView {
  const changeLocal = Number((asset.currentPrice - asset.previousPrice).toFixed(2));
  const base = Math.max(0.01, asset.previousPrice);
  const changePercent = Number((((asset.currentPrice - asset.previousPrice) / base) * 100).toFixed(2));
  return {
    ticker: asset.definition.ticker,
    name: asset.definition.name,
    sector: asset.definition.sector,
    type: asset.definition.type,
    description: asset.definition.description,
    currentPrice: Number(asset.currentPrice.toFixed(2)),
    previousPrice: Number(asset.previousPrice.toFixed(2)),
    changeLocal,
    changePercent,
    dividendYield: asset.definition.dividendYield,
  };
}

function getWeeksHeld(firstBoughtAtMs: number, nowMs: number) {
  if (!Number.isFinite(firstBoughtAtMs) || firstBoughtAtMs <= 0) return 0;
  return Math.max(0, Math.floor((getWeekStartMs(nowMs) - getWeekStartMs(firstBoughtAtMs)) / WEEK_MS));
}

function buildHoldingViews(userId: string, nowMs: number): StockHoldingView[] {
  const holdingMap = stockHoldingsByUserId.get(userId) ?? new Map<string, UserHoldingRuntime>();
  const holdings: StockHoldingView[] = [];

  for (const [ticker, holding] of holdingMap.entries()) {
    const asset = stockAssetsByTicker.get(ticker);
    if (!asset || holding.quantity <= 0) continue;
    const marketValue = Number((asset.currentPrice * holding.quantity).toFixed(2));
    const invested = Number((holding.averagePrice * holding.quantity).toFixed(2));
    const profitLocal = Number((marketValue - invested).toFixed(2));
    const profitPercent = invested > 0 ? Number(((profitLocal / invested) * 100).toFixed(2)) : 0;
    const weeksHeld = getWeeksHeld(holding.firstBoughtAtMs, nowMs);
    holdings.push({
      ticker,
      name: asset.definition.name,
      quantity: holding.quantity,
      averagePrice: Number(holding.averagePrice.toFixed(2)),
      currentPrice: Number(asset.currentPrice.toFixed(2)),
      marketValue,
      profitLocal,
      profitPercent,
      heldSinceMs: holding.firstBoughtAtMs,
      weeksHeld,
      nextDividendEligible: weeksHeld >= 1,
    });
  }

  return holdings.sort((left, right) => right.marketValue - left.marketValue);
}

function formatPhaseSummary(phase: StockSectorPhase) {
  switch (phase) {
    case "accumulation":
      return "Капитал аккуратно заходит в сектор. Вероятнее плавный рост без резких перегревов.";
    case "growth":
      return "Сектор в устойчивом ап-тренде. Ростовые отчёты и позитивные новости получают лучший отклик.";
    case "hype":
      return "Игроки активно разгоняют бумаги. Рост возможен, но риск перегрева уже заметен.";
    case "peak_risk":
      return "Сектор у пика. Любой слабый отчёт может резко включить коррекцию.";
    case "correction":
      return "Идёт охлаждение. Давление на котировки выше обычного, но постепенно формируется новая база.";
  }
}

function buildSectorReport(sector: StockAssetDefinition["sector"], nowMs: number): StockSectorReportView {
  const currentWeekKey = getWeekKey(nowMs);
  const nextWeekKey = getWeekKey(getNextWeekMs(nowMs));
  const current = getSectorOutlook(sector, currentWeekKey);
  const next = getSectorOutlook(sector, nextWeekKey);
  return {
    sector,
    phase: current.phase,
    currentSummary: formatPhaseSummary(current.phase),
    nextWeekSummary: formatPhaseSummary(next.phase),
    growthChance: next.growth,
    peakChance: next.peak,
    crashChance: next.crash,
  };
}

function getDividendPhaseMultiplier(phase: StockSectorPhase) {
  switch (phase) {
    case "accumulation":
      return 0.9;
    case "growth":
      return 1;
    case "hype":
      return 0.75;
    case "peak_risk":
      return 0.7;
    case "correction":
      return 0.85;
  }
}

function buildWeeklyReport(nowMs: number): StockWeeklyMarketReportView {
  const weekKey = getWeekKey(nowMs);
  const sectorUniverse = Array.from(new Set(STOCK_ASSET_CATALOG.map((item) => item.sector)));
  const sectorReports = sectorUniverse.map((sector) => buildSectorReport(sector, nowMs));
  const assetReports: StockAssetWeeklyReportView[] = STOCK_ASSET_CATALOG.map((asset) => {
    const sectorReport = sectorReports.find((item) => item.sector === asset.sector)!;
    const dividendForecastGram = Number((asset.dividendYield * getDividendPhaseMultiplier(sectorReport.phase)).toFixed(2));
    const weeklyBias =
      sectorReport.phase === "growth" || sectorReport.phase === "hype"
        ? "bullish"
        : sectorReport.phase === "correction" || sectorReport.phase === "peak_risk"
          ? "bearish"
          : "neutral";
    const headline =
      weeklyBias === "bullish"
        ? `${asset.name} выглядит сильнее рынка и может стать драйвером недели.`
        : weeklyBias === "bearish"
          ? `${asset.name} под давлением сектора и чувствительна к слабым отчётам.`
          : `${asset.name} торгуется без перегрева и ждёт нового драйвера.`;
    return {
      ticker: asset.ticker,
      name: asset.name,
      sector: asset.sector,
      headline,
      weeklyBias,
      dividendForecastGram,
    };
  });

  const hottest = [...sectorReports].sort((left, right) => right.growthChance - left.growthChance)[0];
  const riskiest = [...sectorReports].sort((left, right) => right.crashChance - left.crashChance)[0];

  return {
    weekKey,
    title: `Рыночный отчёт ${weekKey}`,
    summary: `Текущий фаворит недели: ${SECTOR_LABELS[hottest.sector]}. Самый высокий риск коррекции у сектора ${SECTOR_LABELS[riskiest.sector]}.`,
    sectorReports,
    assetReports,
  };
}

async function applyWeeklyDividends(userId: string, nowMs: number) {
  const holdingMap = stockHoldingsByUserId.get(userId);
  if (!holdingMap || holdingMap.size <= 0) {
    recentDividendPayoutsByUserId.delete(userId);
    return [];
  }

  const weekKey = getWeekKey(nowMs);
  const weekStartMs = getWeekStartMs(nowMs);
  const payouts: StockDividendPayoutView[] = [];

  for (const [ticker, holding] of holdingMap.entries()) {
    if (holding.quantity <= 0) continue;
    if (holding.lastDividendWeekKey === weekKey) continue;
    if (holding.firstBoughtAtMs >= weekStartMs) continue;
    const asset = stockAssetsByTicker.get(ticker);
    if (!asset) continue;
    const weeksHeld = getWeeksHeld(holding.firstBoughtAtMs, nowMs);
    if (weeksHeld < 1) continue;
    const outlook = getCurrentSectorOutlook(asset.definition.sector, nowMs);
    const holdMultiplier = Math.min(1.35, 1 + Math.max(0, weeksHeld - 1) * 0.08);
    const phaseMultiplier = getDividendPhaseMultiplier(outlook.phase);
    const amountGram = Number((holding.quantity * asset.definition.dividendYield * holdMultiplier * phaseMultiplier).toFixed(2));
    if (amountGram <= 0) continue;
    payouts.push({
      ticker,
      name: asset.definition.name,
      quantity: holding.quantity,
      amountGram,
      weekKey,
    });
    holding.lastDividendWeekKey = weekKey;
  }

  if (!payouts.length) {
    recentDividendPayoutsByUserId.delete(userId);
    return [];
  }

  const snapshot = await getUserWithGameState(userId);
  if (!snapshot) return [];
  const currentGram = Number(snapshot.game.gramBalance || 0);
  const totalGram = Number(payouts.reduce((sum, item) => sum + item.amountGram, 0).toFixed(2));
  applyGameStatePatch(userId, { gramBalance: Number((currentGram + totalGram).toFixed(2)) });
  recentDividendPayoutsByUserId.set(userId, payouts);
  return payouts;
}

export async function getFutureIpoWatchlist(): Promise<FutureIpoWatchView[]> {
  const companies = await storage.getAllCompanies();
  return companies
    .filter((company) => !company.isTutorial)
    .map((company) => {
      const rawCompany = company as typeof company & { stage?: string; companyStage?: string };
      const stage = String(rawCompany.stage || rawCompany.companyStage || "private");
      let note = "Компания пока закрыта и только готовит внутренние метрики.";
      if (stage === "pre_ipo") {
        note = "Почти готова к IPO. После активации live-рынка сможет выйти на биржу.";
      } else if (stage === "public") {
        note = "Уже публична во внутренней экономике и станет кандидатом на live-торги.";
      }
      return {
        companyId: String(company.id),
        companyName: String(company.name),
        city: String(company.city),
        stage,
        note,
      };
    })
    .filter((item) => item.stage === "pre_ipo" || item.stage === "public")
    .slice(0, 6);
}

export function popStockMarketAnnouncement(nowMs: number = Date.now()) {
  ensureStockExchangeAdvanced(nowMs);
  if (!activeNews || activeNews.id === lastBroadcastedNewsId) return null;
  lastBroadcastedNewsId = activeNews.id;
  return activeNews;
}

export async function getStockMarketSnapshot(userId: string, nowMs: number = Date.now()): Promise<StockMarketSnapshot> {
  ensureStockExchangeAdvanced(nowMs);
  const user = await storage.getUser(userId);
  if (!user) throw new Error("User not found");
  const recentDividendPayouts = await applyWeeklyDividends(userId, nowMs);
  const quotes = Array.from(stockAssetsByTicker.values()).map(buildQuoteView);
  const holdings = buildHoldingViews(userId, nowMs);
  const portfolioValue = Number(holdings.reduce((sum, item) => sum + item.marketValue, 0).toFixed(2));
  const cashBalance = Math.max(0, Number(user.balance || 0));
  return {
    updatedAtMs: nowMs,
    quotes: quotes.sort((left, right) => left.ticker.localeCompare(right.ticker)),
    holdings,
    cashBalance,
    portfolioValue,
    totalValue: Number((cashBalance + portfolioValue).toFixed(2)),
    activeNews,
    watchlist: await getFutureIpoWatchlist(),
    weeklyReport: buildWeeklyReport(nowMs),
    recentDividendPayouts,
  };
}

export async function buyStockAsset(userId: string, ticker: string, quantity: number) {
  ensureStockExchangeAdvanced();
  const user = await storage.getUser(userId);
  if (!user) throw new Error("User not found");
  const normalizedTicker = String(ticker || "").trim().toUpperCase();
  const normalizedQty = Math.max(0, Math.floor(Number(quantity || 0)));
  if (!normalizedTicker) throw new Error("Ticker is required");
  if (normalizedQty <= 0) throw new Error("Quantity must be greater than zero");
  const asset = stockAssetsByTicker.get(normalizedTicker);
  if (!asset) throw new Error("Asset not found");

  const totalCost = Number((asset.currentPrice * normalizedQty).toFixed(2));
  if (Number(user.balance || 0) < totalCost) throw new Error("Not enough funds");

  const holdingMap = getUserHoldingMap(userId);
  const existing = holdingMap.get(normalizedTicker);
  const totalQty = (existing?.quantity || 0) + normalizedQty;
  const totalInvested = Number((((existing?.averagePrice || 0) * (existing?.quantity || 0)) + totalCost).toFixed(2));
  holdingMap.set(normalizedTicker, {
    quantity: totalQty,
    averagePrice: totalQty > 0 ? Number((totalInvested / totalQty).toFixed(2)) : asset.currentPrice,
    firstBoughtAtMs: existing?.firstBoughtAtMs || Date.now(),
    lastDividendWeekKey: existing?.lastDividendWeekKey,
  });

  const updatedUser = await storage.updateUser(userId, {
    balance: Number((Number(user.balance || 0) - totalCost).toFixed(2)),
  });

  return {
    user: updatedUser,
    ticker: normalizedTicker,
    quantity: normalizedQty,
    pricePerShare: Number(asset.currentPrice.toFixed(2)),
    totalCost,
    snapshot: await getStockMarketSnapshot(userId),
  };
}

export async function sellStockAsset(userId: string, ticker: string, quantity: number) {
  ensureStockExchangeAdvanced();
  const user = await storage.getUser(userId);
  if (!user) throw new Error("User not found");
  const normalizedTicker = String(ticker || "").trim().toUpperCase();
  const normalizedQty = Math.max(0, Math.floor(Number(quantity || 0)));
  if (!normalizedTicker) throw new Error("Ticker is required");
  if (normalizedQty <= 0) throw new Error("Quantity must be greater than zero");
  const asset = stockAssetsByTicker.get(normalizedTicker);
  if (!asset) throw new Error("Asset not found");

  const holdingMap = getUserHoldingMap(userId);
  const existing = holdingMap.get(normalizedTicker);
  if (!existing || existing.quantity < normalizedQty) throw new Error("Not enough shares");

  const totalRevenue = Number((asset.currentPrice * normalizedQty).toFixed(2));
  const nextQuantity = existing.quantity - normalizedQty;
  if (nextQuantity <= 0) {
    holdingMap.delete(normalizedTicker);
  } else {
    holdingMap.set(normalizedTicker, {
      quantity: nextQuantity,
      averagePrice: existing.averagePrice,
      firstBoughtAtMs: existing.firstBoughtAtMs,
      lastDividendWeekKey: existing.lastDividendWeekKey,
    });
  }

  const updatedUser = await storage.updateUser(userId, {
    balance: Number((Number(user.balance || 0) + totalRevenue).toFixed(2)),
  });

  return {
    user: updatedUser,
    ticker: normalizedTicker,
    quantity: normalizedQty,
    pricePerShare: Number(asset.currentPrice.toFixed(2)),
    totalRevenue,
    snapshot: await getStockMarketSnapshot(userId),
  };
}
