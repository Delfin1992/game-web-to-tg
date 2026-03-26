import { randomUUID } from "crypto";
import type { Server } from "http";
import { resolve } from "node:path";
import type { User } from "../shared/schema";
import { BLUEPRINT_STATUSES, GADGET_BLUEPRINTS } from "../shared/gadgets";
import {
  COMPANY_MINING_PLANS,
  getCompanyMiningPlan,
  type CompanyMiningRewardView,
  type CompanyMiningPlanId,
  type CompanyMiningStatus,
} from "../shared/company-mining";
import {
  TUTORIAL_DEMO_BLUEPRINT,
  TUTORIAL_STEP_CONTENT,
  TUTORIAL_TOTAL_STEPS,
  getTutorialActiveStep,
  getTutorialProgressText,
  type TutorialStepContent,
  type TutorialState,
} from "../shared/tutorial";
import {
  getAdminPassword,
  getServerBaseUrl,
  isAdminEnabled,
  warnIfAdminPasswordMissing,
} from "./shared/env";
import {
  BALANCE_CONFIG,
  getCityProfile,
  getCompanyCreateCostLocal,
  getEducationCourseCostLocalForProfession,
  getStudyEnergyCostForProfession as getStudyEnergyCostByBalance,
} from "../shared/balance-config";
import {
  ADVANCED_PERSONALITIES,
  ADVANCED_PERSONALITY_UNLOCK_LEVEL,
  getAdvancedPersonalityById,
  type AdvancedPersonalityId,
} from "../shared/advanced-personality";
import {
  PROFESSIONS,
  PROFESSION_UNLOCK_LEVEL,
  getProfessionById,
  type ProfessionId,
} from "../shared/professions";
import { ALL_PARTS, RARITY_LEVELS, type RarityName } from "../client/src/lib/parts";
import {
  applyGameStatePatch,
  buyShopItem,
  clearPlayerGameState,
  closeBankProduct,
  completeJob,
  exchangeCurrencyToGram,
  exchangeGramToCurrency,
  estimateInventorySellPrice,
  getGadgetConditionStatusLabel,
  getCurrencySymbol,
  getConsumableTrainingUseLimitForLevel,
  getJobWorkEnergyCost,
  getLocalToGramRate,
  getTrainingSkillCapForLevel,
  getUserWithGameState,
  spendGram,
  listCreditPrograms,
  listDepositPrograms,
  listJobsByCity,
  listShopItems,
  openBankProduct,
  serviceGadgetItem,
  sellInventoryItem,
  scrapBrokenGadgetItem,
  TUTORIAL_MEDAL_ITEM_ID,
  toggleGearItem,
  useInventoryItem,
  type BankProductType,
  type GameBankProduct,
  type GameInventoryItem,
  type SkillName,
} from "./game-engine";
import {
  acceptRepairOrder,
  calculateRepairEstimate,
  cancelRepairOrderByPlayer,
  completeRepairOrder,
  createRepairOrder,
  failRepairOrder,
  getRepairOrder,
  getRepairOrderStatusLabel,
  listRepairOrdersForCity,
  listRepairOrdersForCompany,
  listRepairableGadgets,
  startRepairOrder,
  sweepRepairOrders,
  type RepairOrder,
  type RepairPartRequirement,
} from "./repair-service";
import {
  canRunIPO,
  COMPANY_STAGE_LABELS,
  DEPARTMENT_LABELS,
  depositLocalToCompany,
  getDepartmentBonusText,
  getDepartmentEffects,
  getDepartmentNextCost,
  getDepartmentUpgradeCheck,
  getIPOProgress,
  getLocalToGRMRate,
  reconcileCompanyEconomy,
  runIPO,
  upgradeDepartment,
  type CompanyDepartmentKey,
  type CompanyEconomyLike,
  type CompanyEconomyState,
} from "../client/src/lib/companySystem";
import {
  bindTelegramIdToUser,
  getTelegramIdByUserId,
  getUserIdByTelegramId,
  unbindTelegramByTelegramId,
  unbindTelegramByUserId,
} from "./routes";
import {
  REGISTRATION_CITIES,
  REGISTRATION_INTERVIEW_QUESTIONS,
  buildPlayerRegistrationState,
  isCompletedRegistration,
  resolveSkillsFromAnswers,
  saveRegistrationProgress,
} from "./registration";
import { storage } from "./storage";
import {
  canSelectAdvancedPersonality,
  canSelectProfession,
  getAdvancedPersonalityId,
  getActiveHousing,
  getInventoryCapacityForUser,
  getOwnedHousingIdsForCity,
  getTrainingConsumablesUsedAtLevel,
  purchaseHousing,
  getPlayerProfessionId,
  grantStarterHousing,
  setActiveHousing,
  setAdvancedPersonality,
  setPlayerProfession,
} from "./player-meta";
import {
  WEEKLY_HACKATHON_CONFIG,
  type HackathonPartType,
} from "../shared/weekly-hackathon";
import { resolveCity } from "../shared/registration";
import {
  contributeGrmToWeeklyHackathon,
  contributePartToWeeklyHackathon,
  contributeSkillToWeeklyHackathon,
  formatWeeklyHackathonTop,
  getPendingPoachOffersForUser,
  getWeeklyHackathonCompanyScore,
  getWeeklyHackathonPlayerStats,
  getWeeklyHackathonSabotageState,
  getWeeklyHackathonState,
  launchWeeklyHackathonSabotage,
  popWeeklyHackathonAnnouncements,
  registerCompanyForWeeklyHackathon,
  resolveHackathonPoachOffer,
  setHackathonCompanySecurityLevel,
} from "./weekly-hackathon";
import { popGlobalEventAnnouncements } from "./game/events/event-engine";
import {
  buyStockAsset,
  getStockMarketSnapshot,
  popStockMarketAnnouncement,
  sellStockAsset,
} from "./stock-exchange";
import {
  EXCLUSIVE_RESEARCH_SKILLS,
  getExclusiveResearchLabel,
  getExclusiveResearchState,
} from "../shared/exclusive-gadgets";
import {
  getHousingById,
  getStarterHousingForCity,
  listHousesForCity,
  type HousingDefinition,
} from "../shared/housing";
import {
  adminAuthByChatId,
  companyBlueprintContribByCompanyId,
  companyBlueprintProgressMessageByChatId,
  companyBlueprintProgressTimerByChatId,
  companyBlueprintRefsByChatId,
  companyBlueprintWarehouseByCompanyId,
  companyContractPartPageByChatId,
  companyContractPartRefsByChatId,
  companyContractRefsByChatId,
  companyEconomyByCompanyId,
  companyExclusivePartRefsByChatId,
  companyExclusivePartPageByChatId,
  companyExclusiveSelectedPartRefsByChatId,
  companyListByChatId,
  companyMemberRefsByChatId,
  companyMenuSectionByChatId,
  companyMiningNotifyTimerByChatId,
  companyPartDepositRefsByChatId,
  companyRepairOrderRefsByChatId,
  companyRequestsByChatId,
  companySalaryByCompanyId,
  companySalaryClaimAtByCompanyId,
  companyContractSelectedPartRefsByChatId,
  companyWarehouseGadgetRefsByChatId,
  companyWarehousePartRefsByChatId,
  companyWarehousePartsByCompanyId,
  hackathonPartRefsByChatId,
  hackathonSabotageTargetRefsByChatId,
  hackathonSkillProgressByChatId,
  inventoryRefsByChatId,
  lastInlineMessageByChatId,
  lastTelegramMenuByUserId,
  marketListingRefsByChatId,
  pendingActionByChatId,
  playerLocationByUserId,
  playerTravelByUserId,
  pvpDuelProgressMessageByChatId,
  pvpDuelStageKeyByChatId,
  pvpQueuePollTimerByChatId,
  referralChildrenByUserId,
  referralCodeByUserId,
  referralOwnerByCode,
  referredByUserId,
  registrationDraftByChatId,
  registrationInterviewFeedbackMessageByChatId,
  registrationInterviewMessageByChatId,
  registrationTutorialAnimationByChatId,
  repairGadgetRefsByChatId,
  repairOrderRefsByChatId,
  shopBuyRefsByChatId,
  shopSellRefsByChatId,
  weeklyQuestStateByUserId,
} from "./telegram/state";
import {
  ADMIN_MENU_REPLY_MARKUP,
  BANK_MENU_REPLY_MARKUP,
  buildBankSelectionReplyMarkup as buildBankSelectionReplyMarkupBase,
  buildReplyKeyboard,
  buildCompanyReplyMarkup as buildCompanyReplyMarkupBase,
  buildEducationCoursesReplyMarkup as buildEducationCoursesReplyMarkupBase,
  buildEducationLevelsReplyMarkup as buildEducationLevelsReplyMarkupBase,
  buildMainMenuReplyMarkup,
  buildNumericSelectionReplyMarkup as buildNumericSelectionReplyMarkupBase,
  CITY_MENU_REPLY_MARKUP,
  CITY_REPLY_MARKUP,
  EXTRAS_MENU_REPLY_MARKUP,
  JOB_RESULT_REPLY_MARKUP,
  MAIN_MENU_REPLY_MARKUP,
  PVP_MENU_REPLY_MARKUP,
  SHOP_MENU_REPLY_MARKUP,
  STUDY_RESULT_REPLY_MARKUP,
} from "./telegram/keyboards/main";
import {
  extractErrorMessage,
  parseBankOpenInput,
  parseDecimalInput,
  repairMojibake,
  sleep,
  trimTrailingSlash,
} from "./telegram/helpers";
import {
  answerCallbackQuery,
  callTelegramApi,
  sendMessage,
  sendPhoto,
  sendPhotoFile,
} from "./telegram/transport";
import {
  sendWithAdminKeyboard as sendWithAdminKeyboardBase,
  sendWithBankKeyboard as sendWithBankKeyboardBase,
  sendWithCityHubKeyboard as sendWithCityHubKeyboardBase,
  sendWithCurrentHubKeyboard as sendWithCurrentHubKeyboardBase,
  sendWithExtrasKeyboard as sendWithExtrasKeyboardBase,
  sendWithMainKeyboard as sendWithMainKeyboardBase,
} from "./telegram/handlers/main-menu";
import {
  sendCompanyDepartmentsSection as sendCompanyDepartmentsSectionBase,
  sendCompanyEconomySection as sendCompanyEconomySectionBase,
  sendCompanyIpoSection as sendCompanyIpoSectionBase,
  sendCompanyManagementSection as sendCompanyManagementSectionBase,
  sendCompanyRequestsSection as sendCompanyRequestsSectionBase,
  sendCompanyRootMenu as sendCompanyRootMenuBase,
  sendCompanyWarehouseSection as sendCompanyWarehouseSectionBase,
  sendCompanyWorkSection as sendCompanyWorkSectionBase,
  sendCompanyBureauSection as sendCompanyBureauSectionBase,
  sendOrEditCompanyBureauSection as sendOrEditCompanyBureauSectionBase,
} from "./telegram/company";
import {
  buildCompanyRepairServiceInlineMarkup as buildCompanyRepairServiceInlineMarkupBase,
  buildRepairServiceInlineMarkup as buildRepairServiceInlineMarkupBase,
  formatCompanyRepairServiceMenu as formatCompanyRepairServiceMenuBase,
  formatRepairDuration as formatRepairDurationBase,
  formatRepairServiceMenu as formatRepairServiceMenuBase,
  sendCompanyRepairServiceMenu as sendCompanyRepairServiceMenuBase,
  sendRepairServiceMenu as sendRepairServiceMenuBase,
} from "./telegram/handlers/repair";
import {
  getDraftRegistrationSkillPointsLeft as getDraftRegistrationSkillPointsLeftBase,
  getDraftRegistrationSkills as getDraftRegistrationSkillsBase,
  normalizeCitySlideIndex as normalizeCitySlideIndexBase,
  normalizeGenderSlideIndex as normalizeGenderSlideIndexBase,
  normalizePersonalitySlideIndex as normalizePersonalitySlideIndexBase,
  sendRegistrationCityPicker as sendRegistrationCityPickerBase,
  sendRegistrationGenderPicker as sendRegistrationGenderPickerBase,
  sendRegistrationPersonalityPicker as sendRegistrationPersonalityPickerBase,
  sendRegistrationSkillsPicker as sendRegistrationSkillsPickerBase,
  sendTelegramRegistrationStepPrompt as sendTelegramRegistrationStepPromptBase,
} from "./telegram/registration";
import { handleRegistrationCallback } from "./telegram/handlers/registration-callbacks";
import { handleRepairCallback } from "./telegram/handlers/repair-callbacks";
import { handleRegistrationPendingAction } from "./telegram/handlers/registration-messages";
import { handleRepairMessage } from "./telegram/handlers/repair-messages";
import { handleEconomyMessage } from "./telegram/handlers/economy-messages";
import { handleInventoryMessage } from "./telegram/handlers/inventory-messages";
import { handleCompanyNavigationMessage } from "./telegram/handlers/company-navigation-messages";

type TelegramUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
};

type TelegramMessage = {
  chat?: { id: number };
  text?: string;
  from?: TelegramUser;
};

type TelegramCallbackQuery = {
  id: string;
  data?: string;
  from?: TelegramUser;
  message?: {
    message_id?: number;
    chat?: { id: number };
  };
};

type PendingAction =
  | { type: "registration_intro" }
  | { type: "registration_city" }
  | { type: "registration_aptitude" }
  | { type: "registration_first_craft" }
  | { type: "register_username" }
  | { type: "register_city" }
  | { type: "register_personality" }
  | { type: "register_gender" }
  | { type: "change_city" }
  | { type: "job_select" }
  | { type: "repair_service_select" }
  | { type: "shop_buy" }
  | { type: "shop_sell" }
  | { type: "open_bank_product"; productType: BankProductType }
  | { type: "exchange_to_gram" }
  | { type: "exchange_from_gram" }
  | { type: "stocks_buy_select" }
  | { type: "stocks_buy_qty"; ticker: string }
  | { type: "stocks_sell_select" }
  | { type: "stocks_sell_qty"; ticker: string }
  | { type: "company_create"; companyName?: string }
  | { type: "company_part_deposit" }
  | { type: "company_part_deposit_qty"; partRef: string }
  | { type: "company_contract_parts"; contractId: string; requiredPartType: string; requiredQuantity: number }
  | { type: "company_topup"; companyId: string }
  | { type: "company_set_salary_amount"; companyId: string; memberUserId: string; memberUsername: string }
  | { type: "auction_bid_amount"; listingId: string }
  | { type: "company_exclusive_name" }
  | { type: "company_exclusive_parts"; gadgetName: string }
  | { type: "company_bp_produce_qty"; blueprintId: string; blueprintName: string; maxQuantity: number }
  | { type: "company_bp_produce_confirm"; blueprintId: string; blueprintName: string; quantity: number }
  | { type: "company_exclusive_produce_select" }
  | { type: "company_exclusive_produce_qty"; blueprintId: string; blueprintName: string }
  | { type: "company_exclusive_produce_confirm"; blueprintId: string; blueprintName: string; quantity: number }
  | { type: "study_level_select" }
  | { type: "study_course_select"; levelKey: EducationLevelKey }
  | { type: "advanced_personality_select" }
  | { type: "admin_auth" }
  | { type: "admin_add_money" }
  | { type: "admin_add_exp" };

type CompanyMenuSection =
  | "root"
  | "work"
  | "service"
  | "warehouse"
  | "bureau"
  | "bureau_exclusive"
  | "management"
  | "management_hr"
  | "management_departments"
  | "hackathon"
  | "hackathon_event"
  | "hackathon_sabotage";

type RegistrationStep =
  | "registration_intro"
  | "registration_city"
  | "registration_aptitude"
  | "registration_first_craft"
  | "register_username"
  | "register_city"
  | "register_personality"
  | "register_gender";

type Snapshot = NonNullable<Awaited<ReturnType<typeof getUserWithGameState>>>;

type EducationLevelKey = "school" | "college" | "university";

type ShopMenuTab = "all" | "parts" | "gadgets" | "sell";

type TelegramMenuState =
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
  | { menu: "company"; section: CompanyMenuSection };

type InventoryActionKind = "use" | "equip" | "service" | "scrap";

type InventoryAction = {
  kind: InventoryActionKind;
  index: number;
  ref: string;
  itemName: string;
  isEquipped?: boolean;
};

type InventoryMenuView = {
  text: string;
  refs: string[];
  actions: InventoryAction[];
};

type WeeklyQuestMetric = "jobs" | "study" | "shop";

type WeeklyQuestTemplate = {
  id: string;
  title: string;
  description: string;
  rewardLabel: string;
  rewardMoney: number;
  rewardExp: number;
  target: number;
  metric: WeeklyQuestMetric;
};

type WeeklyQuestState = {
  weekKey: string;
  city: string;
  questId: string;
  progress: number;
  claimed: boolean;
};

type WeeklyQuestProgressUpdate = {
  template: WeeklyQuestTemplate;
  state: WeeklyQuestState;
  updated: boolean;
  completedNow: boolean;
};

type WeeklyQuestMenuView = {
  text: string;
  canClaim: boolean;
};

type RatingEntity = "players" | "companies";
type PlayerRatingSort = "level" | "reputation" | "wealth" | "pvp";
type CompanyRatingSort = "level" | "wealth" | "blueprints";
type RatingSort = PlayerRatingSort | CompanyRatingSort;

type EducationCourse = {
  id: string;
  name: string;
  description: string;
  baseGrmCost: number;
  skillBoosts: Partial<Record<SkillName, number>>;
  failureChance: number;
  icon: string;
};

type GameView = {
  skills: Record<SkillName, number>;
  inventory: GameInventoryItem[];
  workTime: number;
  studyTime: number;
  gramBalance: number;
  activeBankProduct: GameBankProduct | null;
};

type CompanyBlueprintSnapshot = {
  available: Array<{
    id: string;
    name: string;
    requirements?: Partial<Record<"coding" | "design" | "analytics", number>>;
    production?: { costGram?: number; parts?: Record<string, number> };
    time?: number;
  }>;
  active: {
    blueprintId: string;
    status: string;
    progressHours: number;
  } | null;
  productionOrder?: {
    id: string;
    kind: "standard" | "exclusive";
    blueprintId: string;
    blueprintName: string;
    category: string;
    quantity: number;
    startedAt: number;
    readyAt: number;
    status: "in_progress" | "ready_to_claim";
    quality: number;
    gramCost: number;
    isExclusive?: boolean;
    exclusiveBonusLabel?: string;
  } | null;
  produced: Array<{
    id: string;
    blueprintId?: string;
    name: string;
    category: string;
    stats?: Record<string, number>;
    quality: number;
    minPrice: number;
    maxPrice: number;
    isExclusive?: boolean;
    exclusiveBonusLabel?: string;
  }>;
};

type CityContractView = {
  id: string;
  title: string;
  customer: string;
  kind?: "gadget_delivery" | "parts_supply" | "skill_research";
  category: string;
  requiredQuantity: number;
  minQuality: number;
  requiredPartType?: string;
  requiredSkill?: "coding" | "design" | "analytics" | "testing";
  requiredSkillPoints?: number;
  rewardMoney: number;
  rewardOrk: number;
  status: "open" | "in_progress" | "completed";
  assignedCompanyId?: string;
};

type CompanyContext = {
  company: any;
  role: string;
  membersCount: number;
};

type CompanyMiningStatusView = {
  status: CompanyMiningStatus;
  startedAt: number | null;
  endsAt: number | null;
  remainingSeconds: number;
  planId: CompanyMiningPlanId | null;
  planLabel: string | null;
  minRewardQty: number | null;
  maxRewardQty: number | null;
  rewardPreview: CompanyMiningRewardView | null;
};

type HackathonSkillProgressState = {
  chatId: number;
  userId: string;
  companyId: string;
  messageId: number;
  startedAt: number;
  ticksDone: number;
  totalTicks: number;
  failAtTick: number | null;
  accumulated: number;
  basePerTick: number;
  fixedRandomBonus: number;
  timer: NodeJS.Timeout;
};

type CompanyWarehousePartItem = {
  id: string;
  name: string;
  type: string;
  rarity: RarityName;
  quantity: number;
};

type CompanyBlueprintContributionState = {
  blueprintId: string;
  required: Partial<Record<"coding" | "design" | "analytics", number>>;
  invested: Partial<Record<"coding" | "design" | "analytics", number>>;
  participants: Set<string>;
  completed: boolean;
};

type CompanyEconomyRuntimeState = CompanyEconomyState & {
  companyId: string;
  companyName: string;
  city: string;
};

type CompanyLocalTopUpResult = {
  ok: boolean;
  reason?: string;
  spentLocal: number;
  receivedGRM: number;
  playerBalanceAfter: number;
  company: CompanyEconomyRuntimeState;
};

type TutorialApiSnapshot = {
  state: TutorialState;
  activeStep: number;
  progressText: string;
  stepContent: TutorialStepContent;
};

type TutorialEventApiResult = TutorialApiSnapshot & {
  advanced: boolean;
  reward?: {
    money: number;
    xp: number;
    reputation: number;
  };
};

const TUTORIAL_MEDAL_IMAGE_PATH = resolve(process.cwd(), "assets", "tutorial", "med_1.png");

type PlayerHubLocation = "home" | "city" | "company";
type PlayerTravelState = {
  target: PlayerHubLocation;
  arrivesAtMs: number;
  timer: NodeJS.Timeout;
  chatId: number;
};
type ExclusiveActionIntent = "job" | "study" | "development" | "travel" | "pvp";

const TELEGRAM_PUBLIC_COMMANDS: Array<{ command: string; description: string }> = [
  { command: "start", description: "Открыть Mini App" },
  { command: "starttg", description: "Текстовый режим" },
  { command: "menu", description: "Главное меню" },
  { command: "profile", description: "Профиль игрока" },
  { command: "jobs", description: "Вакансии" },
  { command: "study", description: "Обучение" },
  { command: "shop", description: "Магазин" },
  { command: "repair_service", description: "Сервис гаджетов" },
  { command: "housing", description: "Недвижимость" },
  { command: "sell", description: "Продать запчасти/гаджеты" },
  { command: "bank", description: "Банк" },
  { command: "quests", description: "Еженедельный квест" },
  { command: "rating", description: "Рейтинг" },
  { command: "company", description: "Компания" },
  { command: "hackathon", description: "Weekly Hackathon" },
  { command: "sabotage", description: "Sabotage (Hackathon)" },
  { command: "events", description: "Глобальные события" },
  { command: "pvp", description: "PvP Arena" },
  { command: "city", description: "Сменить город" },
  { command: "help", description: "Справка" },
];
const CITY_OPTIONS = ["Санкт-Петербург", "Сеул", "Сингапур", "Сан-Франциско"] as const;
const TEMPORARILY_OPEN_CITY = "Сан-Франциско" as const;
const CITY_CAPACITY_MESSAGE = `⚠️ Остальные города временно переполнены.\nСейчас доступен только ${TEMPORARILY_OPEN_CITY}.`;
const REGISTRATION_CITY_SLIDES: Record<typeof CITY_OPTIONS[number], {
  title: string;
  subtitle: string;
  description: string[];
  bonusTitle: string;
  bonuses: string[];
}> = {
  "Санкт-Петербург": {
    title: "🎓 Saint Petersburg",
    subtitle: "Культурная столица знаний",
    description: [
      "Санкт-Петербург — город университетов, исследований и сильных специалистов.",
      "Здесь ценят образование, дисциплину и глубокие знания. Многие успешные инженеры и предприниматели начинали свой путь именно здесь.",
      "Если вы хотите уверенно прокачивать навыки и реже сталкиваться с неудачами, Санкт-Петербург станет отличным стартом для вашей карьеры.",
    ],
    bonusTitle: "📚 Бонус города",
    bonuses: [
      "снижение риска провала до −25%",
      "рост навыков до +5% (зависит от репутации)",
    ],
  },
  "Сеул": {
    title: "⚡ Seoul",
    subtitle: "K-Tech столица инноваций",
    description: [
      "Сеул — город высоких технологий, игровых студий и крупнейших производителей электроники.",
      "Здесь ценят скорость, эффективность и постоянное развитие.",
      "В этом городе легко расти профессионально и быстро прокачивать свои навыки, если вы готовы работать в динамичной технологической среде.",
    ],
    bonusTitle: "🚀 Бонус города",
    bonuses: [
      "зарплата до +10%",
      "навыки до +7%",
      "опыт до +5% (зависит от репутации)",
    ],
  },
  "Сингапур": {
    title: "💼 Singapore",
    subtitle: "Финансовый и технологический центр Азии",
    description: [
      "Сингапур — один из самых стабильных и богатых городов мира.",
      "Здесь сосредоточены крупнейшие банки, финтех-компании и международные корпорации.",
      "Если вы хотите развивать карьеру в бизнесе и технологиях, этот город даст отличные возможности для роста.",
    ],
    bonusTitle: "💰 Бонус города",
    bonuses: [
      "доход до +6%",
      "навыки до +9%",
      "снижение риска провала до −18% (зависит от репутации)",
    ],
  },
  "Сан-Франциско": {
    title: "🌉 San Francisco",
    subtitle: "Сердце Кремниевой долины",
    description: [
      "Сан-Франциско — место, где создаются стартапы и рождаются технологические гиганты.",
      "Именно здесь начинались компании, которые изменили цифровой мир.",
      "Если вы мечтаете строить карьеру в технологической индустрии и быстро расти в доходах — этот город может стать вашим лучшим выбором.",
    ],
    bonusTitle: "💡 Бонус города",
    bonuses: [
      "зарплата до +15%",
      "опыт до +12% (зависит от репутации)",
    ],
  },
};
function getCompanyCreateCostForPlayer(city: string) {
  return getCompanyCreateCostLocal(city);
}
const COMPANY_DEFAULT_MEMBER_SALARY_GRM = 40;
const COMPANY_SALARY_CLAIM_COOLDOWN_MS = 12 * 60 * 60 * 1000;
const ADMIN_PASSWORD = getAdminPassword();
let telegramBotUsername = (process.env.TELEGRAM_BOT_USERNAME || "").replace("@", "").trim();
const REFERRAL_INVITER_REWARD = 200;
const REFERRAL_NEW_PLAYER_REWARD = 100;
const TELEGRAM_PENDING_PASSWORD_PREFIX = "pending_tg_";
const TELEGRAM_REGISTERED_PASSWORD_PREFIX = "tg_reg_";
const WEEKLY_QUEST_REPUTATION_REWARD = 10;
const TRAVEL_TO_CITY_MS = 3_000;
const TRAVEL_TO_COMPANY_MS = 10_000;
const COMPANY_DEPARTMENT_ORDER: CompanyDepartmentKey[] = [
  "researchAndDevelopment",
  "production",
  "marketing",
  "finance",
  "infrastructure",
];
const COMPANY_DEPARTMENT_EMOJIS: Record<CompanyDepartmentKey, string> = {
  researchAndDevelopment: "🧪",
  production: "🏭",
  marketing: "📣",
  finance: "💼",
  infrastructure: "🏗",
};
const PERSONALITY_OPTIONS = [
  { id: "workaholic", label: "💪 Трудоголик", bonus: "+20% XP за работу" },
  { id: "businessman", label: "💼 Бизнесмен", bonus: "+15% денег за работу" },
  { id: "lucky", label: "🍀 Счастливчик", bonus: "шанс доп. бонусов" },
] as const;
const REGISTRATION_PERSONALITY_SLIDES: Record<typeof PERSONALITY_OPTIONS[number]["id"], {
  title: string;
  subtitle: string;
  description: string[];
  bonusTitle: string;
  bonuses: string[];
  fitTitle: string;
  fitItems: string[];
}> = {
  workaholic: {
    title: "💪 Трудоголик",
    subtitle: "Мастер упорной работы",
    description: [
      "Вы готовы работать больше других и не боитесь сложных задач.",
      "Постоянное развитие и дисциплина позволяют вам быстрее накапливать опыт и становиться настоящим профессионалом своего дела.",
      "Такие люди часто становятся ведущими специалистами и быстро растут по карьерной лестнице.",
    ],
    bonusTitle: "⚡ Бонус характера",
    bonuses: [
      "+20% опыта за работу",
    ],
    fitTitle: "📈 Лучше всего подходит для",
    fitItems: [
      "быстрого роста навыков",
      "раннего развития персонажа",
      "достижения высоких уровней",
    ],
  },
  businessman: {
    title: "💼 Бизнесмен",
    subtitle: "Человек возможностей",
    description: [
      "Вы умеете видеть прибыль там, где другие её не замечают.",
      "Деловая хватка, умение договариваться и принимать правильные решения помогают вам зарабатывать больше.",
      "Этот характер отлично подходит тем, кто хочет быстрее накопить капитал и открыть собственную компанию.",
    ],
    bonusTitle: "💰 Бонус характера",
    bonuses: [
      "+15% денег за работу",
    ],
    fitTitle: "📈 Лучше всего подходит для",
    fitItems: [
      "накопления капитала",
      "открытия компании",
      "инвестиций и торговли",
    ],
  },
  lucky: {
    title: "🍀 Счастливчик",
    subtitle: "Любимец удачи",
    description: [
      "Иногда успех зависит не только от навыков, но и от удачи.",
      "Счастливчики часто получают неожиданные бонусы, редкие награды и выгодные возможности.",
      "Если вам нравится риск и неожиданные события — этот характер может принести много приятных сюрпризов.",
    ],
    bonusTitle: "🎲 Бонус характера",
    bonuses: [
      "шанс получить дополнительные бонусы",
      "Примеры бонусов: дополнительные деньги, больше опыта, редкие предметы, уникальные события",
    ],
    fitTitle: "📈 Лучше всего подходит для",
    fitItems: [
      "игроков, которые любят случайные награды",
      "поиска редких возможностей",
      "рискованных стратегий",
    ],
  },
};
const GENDER_OPTIONS = [
  { id: "male", label: "👨 Мужской" },
  { id: "female", label: "👩 Женский" },
] as const;
const REGISTRATION_SKILL_POINTS_TOTAL = 10;
const WEEKLY_QUESTS_BY_CITY: Record<string, WeeklyQuestTemplate[]> = {
  "Санкт-Петербург": [
    {
      id: "spb-1",
      title: "Первый блин — не баг",
      description: "Выполни 5 рабочих заданий в Санкт-Петербурге.",
      rewardLabel: "800 ₽ + 300 XP + 10 репутации",
      rewardMoney: 800,
      rewardExp: 300,
      target: 5,
      metric: "jobs",
    },
    {
      id: "spb-2",
      title: "Студент ГУАПа",
      description: "Заверши 3 учебных курса (Школа/Колледж).",
      rewardLabel: "500 ₽ + 400 XP + 10 репутации",
      rewardMoney: 500,
      rewardExp: 400,
      target: 3,
      metric: "study",
    },
    {
      id: "spb-3",
      title: "Купи хлеба!",
      description: "Заработай 500 ₽ и купи любой предмет в магазине.",
      rewardLabel: "300 ₽ + Булка программиста + 10 репутации",
      rewardMoney: 300,
      rewardExp: 0,
      target: 1,
      metric: "shop",
    },
  ],
  "Сеул": [
    {
      id: "seoul-1",
      title: "Seoul Commute",
      description: "Выполни 5 рабочих заданий в Сеуле.",
      rewardLabel: "₩15 000 + 300 XP + 10 репутации",
      rewardMoney: 15000,
      rewardExp: 300,
      target: 5,
      metric: "jobs",
    },
    {
      id: "seoul-2",
      title: "High School Grad",
      description: "Заверши 3 учебных курса (Школа/Колледж).",
      rewardLabel: "₩10 000 + 400 XP + 10 репутации",
      rewardMoney: 10000,
      rewardExp: 400,
      target: 3,
      metric: "study",
    },
    {
      id: "seoul-3",
      title: "Bungeo-ppang Break",
      description: "Заработай ₩12 000 и купи любой предмет в магазине.",
      rewardLabel: "₩8 000 + Бунгеоппанг + 10 репутации",
      rewardMoney: 8000,
      rewardExp: 0,
      target: 1,
      metric: "shop",
    },
  ],
  "Сан-Франциско": [
    {
      id: "sf-1",
      title: "Hello, Silicon Valley!",
      description: "Выполни 5 рабочих заданий в Сан-Франциско.",
      rewardLabel: "$12 + 300 XP + 10 репутации",
      rewardMoney: 12,
      rewardExp: 300,
      target: 5,
      metric: "jobs",
    },
    {
      id: "sf-2",
      title: "Coding Bootcamp Grad",
      description: "Заверши 3 учебных курса (Школа/Колледж).",
      rewardLabel: "$8 + 400 XP + 10 репутации",
      rewardMoney: 8,
      rewardExp: 400,
      target: 3,
      metric: "study",
    },
    {
      id: "sf-3",
      title: "First Coffee Run",
      description: "Заработай $10 и купи любой предмет в магазине.",
      rewardLabel: "$5 + Blue Bottle Coffee + 10 репутации",
      rewardMoney: 5,
      rewardExp: 0,
      target: 1,
      metric: "shop",
    },
  ],
  "Сингапур": [
    {
      id: "sg-1",
      title: "MRT to Work",
      description: "Выполни 5 рабочих заданий в Сингапуре.",
      rewardLabel: "S$15 + 300 XP + 10 репутации",
      rewardMoney: 15,
      rewardExp: 300,
      target: 5,
      metric: "jobs",
    },
    {
      id: "sg-2",
      title: "Poly Grad",
      description: "Заверши 3 учебных курса (Школа/Колледж).",
      rewardLabel: "S$10 + 400 XP + 10 репутации",
      rewardMoney: 10,
      rewardExp: 400,
      target: 3,
      metric: "study",
    },
    {
      id: "sg-3",
      title: "Hawker Meal",
      description: "Заработай S$12 и купи любой предмет в магазине.",
      rewardLabel: "S$8 + Chicken Rice + 10 репутации",
      rewardMoney: 8,
      rewardExp: 0,
      target: 1,
      metric: "shop",
    },
  ],
};
const SKILL_ORDER: SkillName[] = ["coding", "testing", "analytics", "drawing", "modeling", "design", "attention"];
const SKILL_LABELS: Record<SkillName, string> = {
  coding: "Кодинг",
  testing: "Тестирование",
  analytics: "Аналитика",
  drawing: "Рисование",
  modeling: "3D-моделирование",
  design: "Дизайн",
  attention: "Внимание",
};

const ITEM_TYPE_LABELS: Record<GameInventoryItem["type"], string> = {
  consumable: "Расходник",
  gear: "Экипировка",
  part: "Запчасть",
  gadget: "Гаджет",
};

const EDUCATION_LEVELS: Record<EducationLevelKey, { name: string; minLevel: number; maxLevel: number; courses: EducationCourse[] }> = {
  school: {
    name: BALANCE_CONFIG.education.levels.school.name,
    minLevel: BALANCE_CONFIG.education.levels.school.minLevel,
    maxLevel: BALANCE_CONFIG.education.levels.school.maxLevel,
    courses: BALANCE_CONFIG.education.levels.school.courses.map((course) => ({ ...course })),
  },
  college: {
    name: BALANCE_CONFIG.education.levels.college.name,
    minLevel: BALANCE_CONFIG.education.levels.college.minLevel,
    maxLevel: BALANCE_CONFIG.education.levels.college.maxLevel,
    courses: BALANCE_CONFIG.education.levels.college.courses.map((course) => ({ ...course })),
  },
  university: {
    name: BALANCE_CONFIG.education.levels.university.name,
    minLevel: BALANCE_CONFIG.education.levels.university.minLevel,
    maxLevel: BALANCE_CONFIG.education.levels.university.maxLevel,
    courses: BALANCE_CONFIG.education.levels.university.courses.map((course) => ({ ...course })),
  },
};

function canUseTelegramWebAppButton(url: string) {
  return /^https:\/\//i.test(url);
}

function normalizeCommand(rawText: string) {
  const repaired = repairMojibake(rawText);
  const [rawCommand, ...args] = repaired.trim().split(/\s+/);
  const command = rawCommand.split("@")[0].toLowerCase().replace(/[.,!?;:]+$/g, "");
  return { command, args };
}

function resolvePlainTextAlias(text: string, chatId?: number) {
  const normalized = repairMojibake(text).toLowerCase().trim().replace(/[.,!?;:]+$/g, "");
  const companySection = typeof chatId === "number" ? getCompanyMenuSection(chatId) : "root";
  if (normalized.endsWith("назад")) {
    return companySection !== "root" ? "/company_back" : "/cancel";
  }
  if (normalized === "🏁 хакатон" || normalized === "хакатон") {
    if (companySection === "hackathon") return "/company_menu_hackathon_event";
  }
  if (normalized === "🕶 саботаж" || normalized === "саботаж") {
    if (companySection === "hackathon") return "/company_menu_hackathon_sabotage";
  }
  const aliases = new Map<string, string>([
    ["starttg", "/starttg"],
    ["menu", "/menu"],
    ["🏠 главное меню", "/menu"],
    ["🏠 домой", "/menu"],
    ["👤 профиль", "/profile"],
    ["🎒 инвентарь", "/inventory"],
    ["🧩 допы", "/extras"],
    ["🏙 город", "/city_hub"],
    ["⚔️ pvp arena", "/pvp"],
    ["🏢 компания", "/company"],
    ["🏢 профиль компании", "/company"],
    ["🎓 обучение", "/tutorial"],
    ["🛠 админ", "/admin"],
    ["💼 вакансии", "/jobs"],
    ["📚 учеба", "/study"],
    ["📚 учёба", "/study"],
    ["🛍 магазин", "/shop"],
    ["🔧 сервис", "/repair_service"],
    ["сервис", "/repair_service"],
    ["🏘 недвижимость", "/housing"],
    ["недвижимость", "/housing"],
    ["жилье", "/housing"],
    ["жильё", "/housing"],
    ["📚 курсы", "/shop_courses"],
    ["курсы", "/shop_courses"],
    ["🧩 запчасти", "/shop_courses"],
    ["запчасти", "/shop_courses"],
    ["📱 гаджеты", "/shop_gadgets"],
    ["гаджеты", "/shop_gadgets"],
    ["💱 продажа", "/sell"],
    ["продажа", "/sell"],
    ["🏦 банк", "/bank"],
    ["🏷 аукцион", "/auction"],
    ["🏆 рейтинг", "/rating"],
    ["🗓 квесты", "/quests"],
    ["🏅 репутация", "/reputation"],
    ["👥 рефералы", "/ref"],
    ["💱 продать", "/sell"],
    ["📉 кредиты", "/credits"],
    ["📈 вклады", "/deposits"],
    ["💳 погасить кредит", "/repay"],
    ["🏧 снять вклад", "/withdraw"],
    ["💵 продать gram", "/exchange_from_gram"],
    ["💵 продать grm", "/exchange_from_gram"],
    ["🪙 купить gram", "/exchange_to_gram"],
    ["🪙 купить grm", "/exchange_to_gram"],
    ["📊 биржа", "/stocks"],
    ["🛒 купить бумаги", "/stocks_buy"],
    ["💸 продать бумаги", "/stocks_sell"],
    ["📰 новости рынка", "/stocks_news"],
    ["🏦 назад в банк", "/bank"],
    ["➕ создать компанию", "/company_create"],
    ["📨 вступить в компанию", "/company"],
    ["🏢 профиль", "/company"],
    ["💼 работа", "/company_menu_work"],
    ["📦 склад", "/company_menu_warehouse"],
    ["🧪 бюро", "/company_menu_bureau"],
    ["🛠 сервис", "/company_service"],
    ["🛠 сервис компании", "/company_service"],
    ["🛠 управление", "/company_menu_management"],
    ["🏁 хакатон", "/company_menu_hackathon"],
    ["🏠 домой", "/menu"],
    ["📋 контракты города", "/company_work"],
    ["⛏ добыча запчастей", "/company_mining"],
    ["📦 склад компании", "/company_warehouse"],
    ["📥 передать запчасти", "/company_part_deposit"],
    ["🧪 разработка базовых чертежей", "/company_bureau"],
    ["🌟 разработка редких гаджетов", "/company_exclusive"],
    ["🪄 старт", "/company_exclusive_start"],
    ["📈 прогресс", "/company_exclusive_progress"],
    ["🏭 выпуск", "/company_exclusive_produce"],
    ["🏭 производство гаджетов", "/company_bp_produce"],
    ["👥 hr", "/company_menu_management_hr"],
    ["🧑‍💼 назначение сотрудников на должности", "/company_staffing"],
    ["📥 заявки на вступление", "/company_requests"],
    ["🏛 прокачка отделов", "/company_departments"],
    ["📦 прокачка склада", "/company_expand"],
    ["⬆️ legacy апгрейд", "/company_upgrade"],
    ["🏁 участие в хакатоне", "/company_menu_hackathon_event"],
    ["✅ присоединиться", "/hackathon_join"],
    ["🧠 вложить навыки", "/hackathon_skill"],
    ["💰 вложить grm", "/hackathon_grm_menu"],
    ["🧩 вложить запчасти", "/hackathon_part"],
    ["🛡 security", "/sabotage_security_menu"],
    ["🎯 атака", "/sabotage"],
    ["📨 офферы", "/poach_menu"],
    ["📥 заявки", "/company_requests"],
    ["💱 пополнить grm", "/company_topup"],
    ["🏛 отделы", "/company_departments"],
    ["🚀 ipo / акции", "/company_ipo"],
    ["🚀 ipo", "/company_ipo_stub"],
    ["💸 зарплаты", "/company_salaries"],
    ["💰 получить зарплату", "/company_salary_claim"],
    ["➖ удалить компанию", "/company_delete"],
    ["🚪 выйти из компании", "/company_leave"],
    ["💸 выдать деньги", "/admin_add_money"],
    ["⭐ выдать опыт", "/admin_add_exp"],
    ["♻️ сброс игрока", "/admin_reset_player"],
    ["♻ сброс игрока", "/admin_reset_player"],
    ["🔄 рестарт игры", "/admin_restart"],
    ["🏁 старт хакатона", "/admin_hackathon_start"],
    ["🛑 финиш хакатона", "/admin_hackathon_end"],
    ["♻️ сброс хакатона", "/admin_hackathon_reset"],
    ["♻ сброс хакатона", "/admin_hackathon_reset"],
    ["🌍 глобальное событие", "/admin_global_event"],
    ["🚪 выйти из админки", "/admin_logout"],
    ["1. работа", "/company_work"],
    ["2. склад", "/company_warehouse"],
    ["3. бюро", "/company_bureau"],
    ["4. управление", "/company_management"],
    ["5. экономика", "/company_economy"],
    ["6. отделы", "/company_departments"],
    ["⛏ добыча", "/company_mining"],
    ["добыча", "/company_mining"],
    ["📥 на склад компании", "/company_part_deposit"],
    ["на склад компании", "/company_part_deposit"],
    ["перенести запчасти", "/company_part_deposit"],
    ["профиль компании", "/company"],
    ["⬅️ назад", "/company_back"],
    ["вакансии", "/jobs"],
    ["работа", "/jobs"],
    ["jobs", "/jobs"],
    ["work", "/jobs"],
    ["магазин", "/shop"],
    ["shop", "/shop"],
    ["продать", "/sell"],
    ["продажа", "/sell"],
    ["sell", "/sell"],
    ["инвентарь", "/inventory"],
    ["inventory", "/inventory"],
    ["банк", "/bank"],
    ["в банк", "/bank"],
    ["bank", "/bank"],
    ["биржа", "/stocks"],
    ["акции", "/stocks"],
    ["stocks", "/stocks"],
    ["грам", "/gram"],
    ["gram", "/gram"],
    ["grm", "/gram"],
    ["обмен", "/gram"],
    ["обмен gram", "/gram"],
    ["обмен grm", "/gram"],
    ["купить gram", "/exchange_to_gram"],
    ["купить grm", "/exchange_to_gram"],
    ["рейтинг", "/rating"],
    ["rating", "/rating"],
    ["рефералы", "/ref"],
    ["реф", "/ref"],
    ["referrals", "/ref"],
    ["ref", "/ref"],
    ["квесты", "/quests"],
    ["quests", "/quests"],
    ["quest", "/quests"],
    ["обучение", "/tutorial"],
    ["tutorial", "/tutorial"],
    ["репутация", "/reputation"],
    ["reputation", "/reputation"],
    ["компания", "/company"],
    ["компании", "/company"],
    ["company", "/company"],
    ["🕶 саботаж", "/sabotage"],
    ["город", "/city_hub"],
    ["cityhub", "/city_hub"],
    ["смена города", "/city"],
    ["city", "/city"],
    ["хакатон", "/hackathon"],
    ["hackathon", "/hackathon"],
    ["события", "/events"],
    ["events", "/events"],
    ["pvp", "/pvp"],
    ["арена", "/pvp"],
    ["pvp arena", "/pvp"],
    ["найти соперника", "/pvp_find"],
    ["pvp find", "/pvp_find"],
    ["⚔️ найти соперника", "/pvp_find"],
    ["🚪 выйти из pvp", "/pvp_leave"],
    ["🧾 история pvp", "/pvp_history"],
    ["саботаж", "/sabotage"],
    ["sabotage", "/sabotage"],
    ["зарплата", "/company_salary_claim"],
    ["salary", "/company_salary_claim"],
    ["экономика", "/company_economy"],
    ["economy", "/company_economy"],
    ["отделы", "/company_departments"],
    ["ipo", "/company_ipo"],
    ["админ", "/admin"],
    ["admin", "/admin"],
    ["restart", "/admin_restart"],
    ["reset", "/admin_reset_player"],
    ["кредиты", "/credits"],
    ["credits", "/credits"],
    ["вклады", "/deposits"],
    ["deposits", "/deposits"],
    ["топ", "/top"],
    ["top", "/top"],
    ["help", "/help"],
    ["помощь", "/help"],
    ["🚫 отмена", "/cancel"],
    ["cancel", "/cancel"],
    ["отмена", "/cancel"],
  ]);
  return aliases.get(normalized);
}

function resolveCityName(input: string) {
  const normalized = repairMojibake(input).trim().toLowerCase().replace(/\s+/g, " ");
  if (!normalized) return null;
  if (normalized === "1") return CITY_OPTIONS[0];
  if (normalized === "2") return CITY_OPTIONS[1];
  if (normalized === "3") return CITY_OPTIONS[2];
  if (normalized === "4") return CITY_OPTIONS[3];

  const token = normalized.replace(/[^A-Za-zА-Яа-яЁё0-9]+/g, "").replace(/ё/g, "е");
  if (
    token === "санктпетербург"
    || token === "питер"
    || token === "spb"
    || token === "stpetersburg"
    || token === "saintpetersburg"
    || token === "petersburg"
  ) {
    return CITY_OPTIONS[0];
  }
  if (token === "сеул" || token === "seoul") return CITY_OPTIONS[1];
  if (token === "сингапур" || token === "singapore") return CITY_OPTIONS[2];
  if (token === "санфранциско" || token === "sanfrancisco" || token === "sf") return CITY_OPTIONS[3];

  const byName = CITY_OPTIONS.find((city) => city.toLowerCase() === normalized);
  if (byName) return byName;
  const byShortName = CITY_OPTIONS.find((city) => city.toLowerCase().includes(normalized));
  if (byShortName) return byShortName;
  return null;
}

function normalizeExclusiveDraftName(value: string) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 40);
}

function isCityTemporarilyAvailable(city: string) {
  return city === TEMPORARILY_OPEN_CITY;
}

function formatNumber(value: number) {
  if (!Number.isFinite(value)) return "0";
  const normalized = Number(value || 0);
  const abs = Math.abs(normalized);
  const units = [
    { threshold: 1_000_000_000_000, suffix: "t" },
    { threshold: 1_000_000_000, suffix: "b" },
    { threshold: 1_000_000, suffix: "m" },
    { threshold: 1_000, suffix: "k" },
  ];
  const rounded = (input: number) => Number(input.toFixed(1)).toString();

  for (const unit of units) {
    if (abs >= unit.threshold) {
      return `${rounded(normalized / unit.threshold)}${unit.suffix}`;
    }
  }

  return rounded(normalized);
}

function formatRate(value: number) {
  if (!Number.isFinite(value)) return "0";
  if (Math.abs(value) >= 1) return formatNumber(value);
  return Number(value.toFixed(4)).toString();
}

function formatGramValue(value: number) {
  return formatNumber(Number(value || 0));
}

function isTelegramRegistrationPending(user: User) {
  return String(user.password || "").startsWith(TELEGRAM_PENDING_PASSWORD_PREFIX);
}

function isTelegramRegistrationCompleted(user: User) {
  return String(user.password || "").startsWith(TELEGRAM_REGISTERED_PASSWORD_PREFIX);
}

function normalizeTelegramRegistrationName(value: string) {
  return value.trim();
}

function isValidTelegramRegistrationName(value: string) {
  if (value.length < 3 || value.length > 10) return false;
  if (value.startsWith("/")) return false;
  if (!/^[\p{Script=Latin}\p{Script=Cyrillic}0-9_-]+$/u.test(value)) return false;
  return true;
}

const companyEmojiSegmenter = typeof Intl !== "undefined" && typeof Intl.Segmenter !== "undefined"
  ? new Intl.Segmenter("ru", { granularity: "grapheme" })
  : null;

function normalizeTelegramCompanyName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeTelegramCompanyEmoji(value: string) {
  return value.trim().replace(/\s+/g, "");
}

function isValidTelegramCompanyEmoji(value: string) {
  if (!value || value.length > 16) return false;
  const graphemes = companyEmojiSegmenter
    ? Array.from(companyEmojiSegmenter.segment(value), (part) => part.segment)
    : Array.from(value);
  if (graphemes.length !== 1) return false;
  return /[\p{Extended_Pictographic}\p{Regional_Indicator}\u200d\uFE0F]/u.test(value);
}

function formatTelegramCompanyDisplayName(name: string, emoji: string) {
  return `${emoji} ${name}`.trim();
}

function isAutoGeneratedTelegramUsername(value: string) {
  return /^tg_[a-z0-9_]+$/i.test(value.trim());
}

function isRegistrationUsernameFilled(value?: string) {
  const normalized = normalizeTelegramRegistrationName(String(value ?? ""));
  if (!isValidTelegramRegistrationName(normalized)) return false;
  if (isAutoGeneratedTelegramUsername(normalized)) return false;
  return true;
}

function isValidRegistrationCity(value?: string) {
  return !!resolveCityName(String(value ?? ""));
}

function resolvePersonality(input: string) {
  const normalized = repairMojibake(input).trim().toLowerCase().replace(/[.,!?;:]+$/g, "");
  if (!normalized) return null;
  if (normalized === "1") return PERSONALITY_OPTIONS[0].id;
  if (normalized === "2") return PERSONALITY_OPTIONS[1].id;
  if (normalized === "3") return PERSONALITY_OPTIONS[2].id;
  const token = normalized.replace(/[^A-Za-zА-Яа-яЁё0-9]+/g, "").replace(/ё/g, "е");
  if (token.includes("трудоголик") || token.includes("workaholic")) return "workaholic";
  if (token.includes("бизнес") || token.includes("business") || token.includes("businessman")) return "businessman";
  if (token.includes("счастлив") || token.includes("lucky")) return "lucky";
  return null;
}

function isValidRegistrationPersonality(value?: string) {
  return PERSONALITY_OPTIONS.some((option) => option.id === value);
}

function resolveGender(input: string) {
  const normalized = repairMojibake(input).trim().toLowerCase().replace(/[.,!?;:]+$/g, "");
  if (!normalized) return null;
  if (normalized === "1") return "male";
  if (normalized === "2") return "female";
  const token = normalized.replace(/[^A-Za-zА-Яа-яЁё0-9]+/g, "").replace(/ё/g, "е");
  if (token.includes("муж") || token.includes("male")) return "male";
  if (token.includes("жен") || token.includes("female")) return "female";
  return null;
}

function isValidRegistrationGender(value?: string) {
  return GENDER_OPTIONS.some((option) => option.id === value);
}

function normalizePersonalitySlideIndex(indexRaw: number) {
  return normalizePersonalitySlideIndexBase(indexRaw, PERSONALITY_OPTIONS.length);
}

function buildRegistrationPersonalityInlineMarkup(indexRaw: number) {
  const index = normalizePersonalitySlideIndex(indexRaw);
  return {
    inline_keyboard: [
      [
        { text: "⬅️", callback_data: `reg_personality:nav:${normalizePersonalitySlideIndex(index - 1)}` },
        { text: `${index + 1}/${PERSONALITY_OPTIONS.length}`, callback_data: "reg_personality:noop" },
        { text: "➡️", callback_data: `reg_personality:nav:${normalizePersonalitySlideIndex(index + 1)}` },
      ],
      [
        { text: "✅ Выбрать характер", callback_data: `reg_personality:pick:${index}` },
      ],
    ],
  };
}

async function formatRegistrationPersonalitySlide(indexRaw: number) {
  const index = normalizePersonalitySlideIndex(indexRaw);
  const personalityId = PERSONALITY_OPTIONS[index].id;
  const slide = REGISTRATION_PERSONALITY_SLIDES[personalityId];
  return [
    "🧬 Шаг 3/5. Выбери характер стажёра:",
    "",
    "Характер даёт постоянный пассивный бонус и влияет на стиль развития.",
    "",
    slide.title,
    "",
    slide.subtitle,
    "",
    ...slide.description,
    "",
    slide.bonusTitle,
    ...slide.bonuses.map((line) => `• ${line}`),
    "",
    slide.fitTitle,
    ...slide.fitItems.map((line) => `• ${line}`),
  ].join("\n");
}

function getDraftPersonalitySlideIndex(chatId: number) {
  const draft = registrationDraftByChatId.get(chatId);
  const personalityId = draft?.personality;
  const index = PERSONALITY_OPTIONS.findIndex((option) => option.id === personalityId);
  return index >= 0 ? index : 0;
}

async function sendRegistrationPersonalityPicker(token: string, chatId: number, indexRaw: number) {
  await sendRegistrationPersonalityPickerBase({
    token,
    chatId,
    indexRaw,
    total: PERSONALITY_OPTIONS.length,
    formatter: formatRegistrationPersonalitySlide,
    buildMarkup: buildRegistrationPersonalityInlineMarkup,
    sendMessage,
  });
}

function normalizeGenderSlideIndex(indexRaw: number) {
  return normalizeGenderSlideIndexBase(indexRaw, GENDER_OPTIONS.length);
}

function buildRegistrationGenderInlineMarkup(indexRaw: number) {
  const index = normalizeGenderSlideIndex(indexRaw);
  return {
    inline_keyboard: [
      [
        { text: "⬅️", callback_data: `reg_gender:nav:${normalizeGenderSlideIndex(index - 1)}` },
        { text: `${index + 1}/${GENDER_OPTIONS.length}`, callback_data: "reg_gender:noop" },
        { text: "➡️", callback_data: `reg_gender:nav:${normalizeGenderSlideIndex(index + 1)}` },
      ],
      [
        { text: "✅ Выбрать пол", callback_data: `reg_gender:pick:${index}` },
      ],
    ],
  };
}

function formatRegistrationGenderSlide(indexRaw: number) {
  const index = normalizeGenderSlideIndex(indexRaw);
  const selected = GENDER_OPTIONS[index];
  return [
    "4/5. Выбери пол игрока:",
    "",
    selected.label,
    "",
    "Пол можно будет поменять позже в профиле.",
  ].join("\n");
}

function getDraftGenderSlideIndex(chatId: number) {
  const draft = registrationDraftByChatId.get(chatId);
  const index = GENDER_OPTIONS.findIndex((option) => option.id === draft?.gender);
  return index >= 0 ? index : 0;
}

async function sendRegistrationGenderPicker(token: string, chatId: number, indexRaw: number) {
  await sendRegistrationGenderPickerBase({
    token,
    chatId,
    indexRaw,
    total: GENDER_OPTIONS.length,
    formatter: formatRegistrationGenderSlide,
    buildMarkup: buildRegistrationGenderInlineMarkup,
    sendMessage,
  });
}

function getDraftRegistrationSkills(chatId: number) {
  return getDraftRegistrationSkillsBase({
    chatId,
    registrationDraftByChatId,
    skillOrder: SKILL_ORDER,
  }) as Record<SkillName, number>;
}

function getDraftRegistrationSkillPointsLeft(chatId: number) {
  return getDraftRegistrationSkillPointsLeftBase({
    chatId,
    registrationDraftByChatId,
    skillOrder: SKILL_ORDER,
    totalPoints: REGISTRATION_SKILL_POINTS_TOTAL,
  });
}

function buildRegistrationSkillsInlineMarkup(chatId: number) {
  const left = getDraftRegistrationSkillPointsLeft(chatId);
  const rows = SKILL_ORDER.map((skill) => [
    { text: `➖ ${SKILL_LABELS[skill]}`, callback_data: `reg_skills:sub:${skill}` },
    { text: `➕ ${SKILL_LABELS[skill]}`, callback_data: `reg_skills:add:${skill}` },
  ]);
  rows.push([{ text: `✅ Подтвердить (${REGISTRATION_SKILL_POINTS_TOTAL - left}/${REGISTRATION_SKILL_POINTS_TOTAL})`, callback_data: "reg_skills:confirm" }]);
  return { inline_keyboard: rows };
}

function formatRegistrationSkillsMessage(chatId: number) {
  const skills = getDraftRegistrationSkills(chatId);
  const left = getDraftRegistrationSkillPointsLeft(chatId);
  return [
    "5/5. Распредели 10 очков навыков:",
    "",
    "Эти очки пригодятся в работе компании и в PvP.",
    "",
    ...SKILL_ORDER.map((skill) => `• ${SKILL_LABELS[skill]}: ${skills[skill]}`),
    "",
    `Осталось очков: ${left}`,
  ].join("\n");
}

async function sendRegistrationSkillsPicker(token: string, chatId: number) {
  await sendRegistrationSkillsPickerBase({
    token,
    chatId,
    sendMessage,
    registrationDraftByChatId,
    skillOrder: SKILL_ORDER,
    skillLabels: SKILL_LABELS,
    totalPoints: REGISTRATION_SKILL_POINTS_TOTAL,
  });
}

function normalizeCitySlideIndex(indexRaw: number) {
  return normalizeCitySlideIndexBase(indexRaw, CITY_OPTIONS.length);
}

function buildRegistrationCityInlineMarkup(indexRaw: number) {
  const index = normalizeCitySlideIndex(indexRaw);
  return {
    inline_keyboard: [
      [
        { text: "⬅️", callback_data: `reg_city:nav:${normalizeCitySlideIndex(index - 1)}` },
        { text: `${index + 1}/${CITY_OPTIONS.length}`, callback_data: "reg_city:noop" },
        { text: "➡️", callback_data: `reg_city:nav:${normalizeCitySlideIndex(index + 1)}` },
      ],
      [
        { text: "✅ Выбрать город", callback_data: `reg_city:pick:${index}` },
      ],
    ],
  };
}

async function formatRegistrationCitySlide(indexRaw: number) {
  const index = normalizeCitySlideIndex(indexRaw);
  const city = CITY_OPTIONS[index];
  const slide = REGISTRATION_CITY_SLIDES[city];
  const users = await storage.getUsers();
  const companies = (await storage.getAllCompanies()).filter((company) => !company.isTutorial);
  const playersCount = users.filter((user) => resolveCityName(String(user.city ?? "")) === city).length;
  const companiesCount = companies.filter((company) => resolveCityName(String(company.city ?? "")) === city).length;
  return [
    "2/5. Выбери город:",
    "",
    slide.title,
    "",
    slide.subtitle,
    "",
    ...slide.description,
    "",
    slide.bonusTitle,
    ...slide.bonuses.map((line) => `• ${line}`),
    "",
    "📊 Статистика города",
    `• 👥 Игроков: ${playersCount}`,
    `• 🏢 Компаний: ${companiesCount}`,
  ].join("\n");
}

function getDraftCitySlideIndex(chatId: number) {
  const draft = registrationDraftByChatId.get(chatId);
  const city = resolveCityName(draft?.city ?? "");
  const index = city ? CITY_OPTIONS.indexOf(city) : -1;
  return index >= 0 ? index : 0;
}

async function sendRegistrationCityPicker(token: string, chatId: number, indexRaw: number) {
  await sendRegistrationCityPickerBase({
    token,
    chatId,
    indexRaw,
    total: CITY_OPTIONS.length,
    formatter: formatRegistrationCitySlide,
    buildMarkup: buildRegistrationCityInlineMarkup,
    sendMessage,
  });
}

function buildRegistrationCityChoiceMarkup() {
  const labelMap: Record<string, string> = {
    saint_petersburg: "🎓 Питер",
    seoul: "⚡ Seoul",
    singapore: "💼 Singapore",
    san_francisco: "🌉 SF",
  };
  const rows: Array<Array<{ text: string; callback_data: string }>> = REGISTRATION_CITIES
    .filter((city) => city.id === "san_francisco")
    .map((city) => [{
      text: labelMap[city.id] ?? `${city.emoji} ${city.title}`,
      callback_data: `reg_tutorial:city:${city.id}`,
    }]);
  return { inline_keyboard: rows };
}

function formatInterviewSkillHint(skillWeights?: Record<string, number>) {
  const top = Object.entries(skillWeights ?? {})
    .filter(([, value]) => Number(value) > 0)
    .sort((left, right) => Number(right[1]) - Number(left[1]))
    .slice(0, 2)
    .map(([skill]) => SKILL_LABELS[skill as SkillName] ?? skill);
  return top.length ? `Буст: ${top.join(" + ")}` : "Без явного бонуса";
}

function formatInterviewOptionButtonLabel(questionId: string, optionId: string) {
  const labels: Record<string, Record<string, string>> = {
    bugfix_priority: {
      reproduce_and_log: "Логи и анализ",
      rollback_then_review: "Откат и разбор",
      patch_fast: "Быстрый хотфикс",
    },
    product_tradeoff: {
      usability_first: "UX сначала",
      ship_and_measure: "Релиз и метрики",
      follow_marketing: "Сроки важнее",
    },
    team_incident: {
      triage_with_team: "Созвать triage",
      fix_solo: "Фиксить самому",
      delay_feature: "Снять фичу",
    },
    first_prototype: {
      stable_core: "Надёжная база",
      beautiful_pitch: "Красивый питч",
      fastest_possible: "Максимум скорости",
    },
  };
  return labels[questionId]?.[optionId] ?? optionId;
}

function buildProgressBar(current: number, total: number, width = 10) {
  const safeTotal = Math.max(1, total);
  const ratio = Math.max(0, Math.min(1, current / safeTotal));
  const filled = Math.round(ratio * width);
  return `[${"█".repeat(filled)}${"░".repeat(Math.max(0, width - filled))}] ${Math.round(ratio * 100)}%`;
}

function formatRegistrationTutorialBlueprintProgress(secondsDone: number, totalSeconds: number) {
  return [
    "📐 Разработка чертежа",
    `Проект: ${TUTORIAL_DEMO_BLUEPRINT.name}`,
    `Прогресс: ${secondsDone.toFixed(0)} / ${totalSeconds.toFixed(0)} сек`,
    buildProgressBar(secondsDone, totalSeconds, 12),
    "",
    secondsDone >= totalSeconds
      ? "✅ Чертёж готов. Можно запускать сборку первого гаджета."
      : "Лог: > Сборка спецификации, проверка схемы и подготовка к производству...",
  ].join("\n");
}

function formatRegistrationTutorialProduceProgress(secondsDone: number, totalSeconds: number) {
  return [
    "🏭 Сборка первого гаджета",
    `Модель: ${TUTORIAL_DEMO_BLUEPRINT.name}`,
    `Прогресс: ${secondsDone.toFixed(0)} / ${totalSeconds.toFixed(0)} сек`,
    buildProgressBar(secondsDone, totalSeconds, 12),
    "",
    secondsDone >= totalSeconds
      ? "✅ Сборка завершена. Готовим перенос гаджета в инвентарь..."
      : "Лог: > Монтаж деталей, прошивка базовой системы и финальная проверка...",
  ].join("\n");
}

async function runRegistrationTutorialProgressAnimation(input: {
  token: string;
  chatId: number;
  phase: "blueprint" | "produce";
  durationSeconds: number;
  formatter: (secondsDone: number, totalSeconds: number) => string;
  completeReplyMarkup?: Record<string, unknown>;
}) {
  registrationTutorialAnimationByChatId.set(input.chatId, {
    phase: input.phase,
    untilMs: Date.now() + input.durationSeconds * 1000,
  });
  const sent = await sendMessage(input.token, input.chatId, input.formatter(0, input.durationSeconds));
  const messageId = Number(sent?.message_id || 0);
  for (let elapsed = 1; elapsed <= input.durationSeconds; elapsed += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    if (!messageId) continue;
    await callTelegramApi(input.token, "editMessageText", {
      chat_id: input.chatId,
      message_id: messageId,
      text: input.formatter(elapsed, input.durationSeconds),
      ...(elapsed >= input.durationSeconds && input.completeReplyMarkup ? { reply_markup: input.completeReplyMarkup } : {}),
    });
  }
  registrationTutorialAnimationByChatId.delete(input.chatId);
}

function formatInterviewSkillDelta(skillWeights?: Record<string, number>) {
  const items = Object.entries(skillWeights ?? {})
    .filter(([, value]) => Number(value) > 0)
    .sort((left, right) => Number(right[1]) - Number(left[1]))
    .map(([skill, value]) => `+${value} ${SKILL_LABELS[skill as SkillName] ?? skill}`);
  return items.length ? items.join(", ") : "Без бонуса";
}

function calculateProjectedInterviewSkillDelta(
  allAnswers: Record<string, string>,
  questionId: string,
): Partial<Record<SkillName, number>> {
  const previousAnswers = { ...allAnswers };
  delete previousAnswers[questionId];
  const previous = resolveSkillsFromAnswers(previousAnswers);
  const current = resolveSkillsFromAnswers(allAnswers);
  const delta: Partial<Record<SkillName, number>> = {};
  for (const skill of SKILL_ORDER) {
    const difference = Math.max(0, Number(current.skills?.[skill] || 0) - Number(previous.skills?.[skill] || 0));
    if (difference > 0) {
      delta[skill] = difference;
    }
  }
  return delta;
}

function formatProjectedRegistrationSkills(skills?: Partial<Record<SkillName, number>>) {
  return SKILL_ORDER
    .map((skill) => `${SKILL_LABELS[skill]} ${Math.max(0, Math.floor(Number(skills?.[skill] || 0)))}`)
    .join(" • ");
}

function buildInterviewSkillPool(answers: Record<string, string>) {
  const pool: Partial<Record<SkillName, number>> = {};
  for (const skill of SKILL_ORDER) {
    pool[skill] = 0;
  }
  for (const question of REGISTRATION_INTERVIEW_QUESTIONS) {
    const selected = question.options.find((option) => option.id === answers[question.id]);
    if (!selected) continue;
    for (const skill of SKILL_ORDER) {
      pool[skill] = Number(pool[skill] || 0) + Number(selected.skillWeights?.[skill] || 0);
    }
  }
  return pool;
}

function buildInterviewAnswerFeedback(user: User, questionId: string, answerId: string) {
  const question = REGISTRATION_INTERVIEW_QUESTIONS.find((item) => item.id === questionId);
  const option = question?.options.find((item) => item.id === answerId);
  const registration = buildPlayerRegistrationState(user);
  const answers = registration.registrationFlow.answers ?? {};
  const answeredCount = REGISTRATION_INTERVIEW_QUESTIONS.filter((item) => answers[item.id]).length;
  const projection = buildInterviewSkillPool(answers);
  return [
    `✅ Решение принято (${answeredCount}/${REGISTRATION_INTERVIEW_QUESTIONS.length})`,
    question ? `Сцена: ${question.title}` : "",
    option?.summary ? option.summary : "",
    "",
    `Этот ответ добавил: ${formatInterviewSkillDelta(option?.skillWeights as Record<string, number> | undefined)}`,
    "",
    "Текущий профиль собеседования:",
    formatProjectedRegistrationSkills(projection),
    resolveSkillsFromAnswers(answers).perfectInterview ? "🏆 Пока идёшь на идеальное интервью." : "",
  ].filter(Boolean).join("\n");
}

function getTelegramRegistrationQuestion(user: User) {
  const registration = buildPlayerRegistrationState(user);
  const answers = registration.registrationFlow.answers ?? {};
  return REGISTRATION_INTERVIEW_QUESTIONS.find((question) => !answers[question.id]) ?? null;
}

function resolveRegistrationStepFromValues(values: {
  username?: string;
  city?: string;
  personality?: string;
  gender?: string;
  skills?: Partial<Record<SkillName, number>>;
  requireSkills?: boolean;
}) {
  if (!isValidRegistrationCity(values.city)) return "register_city" as const;
  if (!isRegistrationUsernameFilled(values.username)) return "register_username" as const;
  if (!isValidRegistrationPersonality(values.personality)) return "register_personality" as const;
  return "registration_aptitude" as const;
}

function resolveTelegramRegistrationStep(user: User, chatId: number): RegistrationStep | null {
  const registration = buildPlayerRegistrationState(user);
  const actualStep =
    registration.registrationStep === "intro"
      ? "registration_intro"
      : registration.registrationStep === "name"
        ? "register_username"
      : registration.registrationStep === "city_selection"
        ? "registration_city"
        : registration.registrationStep === "personality"
          ? "register_personality"
          : registration.registrationStep === "aptitude_test"
            ? "registration_aptitude"
            : registration.registrationStep === "first_craft"
              ? "registration_first_craft"
              : null;
  const pendingAction = pendingActionByChatId.get(chatId);
  if (
    pendingAction?.type === "registration_intro"
    || pendingAction?.type === "register_username"
    || pendingAction?.type === "registration_city"
    || pendingAction?.type === "registration_aptitude"
    || pendingAction?.type === "register_personality"
    || pendingAction?.type === "registration_first_craft"
  ) {
    if (pendingAction.type === actualStep) {
      return pendingAction.type;
    }
    pendingActionByChatId.delete(chatId);
  }

  return actualStep;
}

async function sendTelegramRegistrationStepPrompt(token: string, chatId: number, step: RegistrationStep) {
  if (
    step === "registration_intro"
    || step === "register_username"
    || step === "registration_city"
    || step === "registration_aptitude"
    || step === "registration_first_craft"
  ) {
    await sendTelegramRegistrationStepPromptBase({
      token,
      chatId,
      step,
      registrationDraftByChatId,
      registrationInterviewMessageByChatId,
      registrationInterviewFeedbackMessageByChatId,
      pendingActionByChatId,
      storage,
      callTelegramApi,
      sendMessage,
      sendWithMainKeyboard,
      getTelegramRegistrationQuestion,
      buildPlayerRegistrationState,
      registrationInterviewQuestions: REGISTRATION_INTERVIEW_QUESTIONS,
      formatInterviewOptionButtonLabel,
      formatInterviewSkillHint,
      tutorialDemoBlueprint: TUTORIAL_DEMO_BLUEPRINT,
      cityCapacityMessage: CITY_CAPACITY_MESSAGE,
      buildRegistrationCityChoiceMarkup,
    });
    return;
  }

  if (step === "register_city") {
    await sendRegistrationCityPicker(token, chatId, getDraftCitySlideIndex(chatId));
    return;
  }

  if (step === "register_personality") {
    pendingActionByChatId.set(chatId, { type: "register_personality" });
    await sendRegistrationPersonalityPicker(token, chatId, getDraftPersonalitySlideIndex(chatId));
    return;
  }

  if (step === "register_gender") {
    await sendRegistrationGenderPicker(token, chatId, getDraftGenderSlideIndex(chatId));
    return;
  }

  await sendMessage(
    token,
    chatId,
    [
      "🆕 Регистрация игрока",
      "Впиши ник игрока (3-10 символов).",
      "Разрешены только русские/латинские буквы, цифры, _ и -",
    ].join("\n"),
    { reply_markup: { remove_keyboard: true } },
  );
}

function formatStats(stats: Record<string, number>) {
  const entries = Object.entries(stats ?? {});
  if (!entries.length) return "без бонусов";
  return entries
    .map(([stat, value]) => `+${formatNumber(value)} ${SKILL_LABELS[stat as SkillName] ?? stat}`)
    .join(", ");
}

function formatRarityBadge(rarity: string) {
  const normalized = normalizePartRarity(rarity);
  const icon = RARITY_LEVELS[normalized]?.icon ?? "⚪";
  return `${icon} ${normalized}`;
}

function stripLeadingRarityBadgeFromName(name: string) {
  return String(name || "")
    .replace(/^[⚪🔵🟣🟡]\s*/u, "")
    .trim();
}

function formatWarehousePartLine(
  item: { name: string; quantity?: number; rarity?: string },
  index?: number,
) {
  const prefix = Number.isFinite(index) ? `${Number(index) + 1}. ` : "";
  const name = stripLeadingRarityBadgeFromName(String(item.name || ""));
  const qty = Math.max(1, Number(item.quantity || 1));
  return `${prefix}${name} x${qty} (${formatRarityBadge(String(item.rarity || "Common"))})`;
}

function formatNotices(notices: string[]) {
  return notices.length ? `🔔 События:\n${notices.map((notice) => `• ${notice}`).join("\n")}` : "";
}

async function shouldSuppressNonRegistrationMessages(userId: string) {
  const user = await storage.getUser(userId);
  return user ? !isCompletedRegistration(user) : false;
}

function formatDurationShort(ms: number) {
  const totalMinutes = Math.max(0, Math.ceil(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}м`;
  if (minutes === 0) return `${hours}ч`;
  return `${hours}ч ${minutes}м`;
}

function formatBankProduct(product: GameBankProduct | null, city: string, gramBalance: number) {
  if (!product) return `🏦 Банк: нет активных продуктов\n🪙 GRM: ${formatGramValue(gramBalance)} GRM`;
  const currency = getCurrencySymbol(city);
  return [
    `🏦 ${product.type === "credit" ? "Кредит" : "Вклад"}: ${product.name}`,
    `Сумма: ${currency}${Math.round(product.amount)}, дней: ${Math.ceil(product.daysLeft)}`,
    `${product.type === "credit" ? "К возврату" : "К получению"}: ${currency}${Math.round(product.totalReturn)}`,
    `🪙 GRM: ${formatGramValue(gramBalance)} GRM`,
  ].join("\n");
}

function getHousingImageUrl(house: HousingDefinition) {
  return `${trimTrailingSlash(getServerBaseUrl())}${house.imagePath}`;
}

function getHousingLocalImagePath(house: HousingDefinition) {
  return resolve(process.cwd(), "client", "public", house.imagePath.replace(/^\/+/, ""));
}

function canUseTelegramRemotePhoto(url: string) {
  if (!/^https?:\/\//i.test(url)) return false;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host === "127.0.0.1" || host === "localhost" || host === "0.0.0.0") return false;
    if (/^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return false;
    return true;
  } catch {
    return false;
  }
}

function formatHousingBonuses(house: HousingDefinition) {
  const lines: string[] = [];
  if (house.bonuses.inventorySlots > 0) {
    lines.push(`🎒 +${house.bonuses.inventorySlots} слотов инвентаря`);
  }
  if (house.bonuses.workEnergyMultiplier < 1) {
    lines.push(`💼 Работа тратит на ${Math.round((1 - house.bonuses.workEnergyMultiplier) * 100)}% меньше энергии`);
  }
  if (house.bonuses.studyEnergyMultiplier < 1) {
    lines.push(`📚 Учёба тратит на ${Math.round((1 - house.bonuses.studyEnergyMultiplier) * 100)}% меньше энергии`);
  }
  if (house.bonuses.travelTimeMultiplier < 1) {
    lines.push(`🚶 Путь в город и компанию быстрее на ${Math.round((1 - house.bonuses.travelTimeMultiplier) * 100)}%`);
  }
  if (house.bonuses.asicSlots > 0 && house.bonuses.asicGramPerHour > 0) {
    lines.push(`🪙 Домашний ASIC: до ${house.bonuses.asicSlots} шт. по ${house.bonuses.asicGramPerHour} GRM/ч`);
  }
  return lines;
}

function buildHousingInlineMarkup(user: User, selectedHouse: HousingDefinition) {
  const houses = listHousesForCity(user.city);
  const owned = new Set(getOwnedHousingIdsForCity(user));
  const activeHouse = getActiveHousing(user);
  const rows = houses.map((house) => [{
    text: `${house.id === selectedHouse.id ? "• " : ""}${house.shortName}${activeHouse?.id === house.id ? " 🏠" : owned.has(house.id) ? " ✅" : ""}`,
    callback_data: `housing:view:${house.id}`,
  }]);

  if (!owned.has(selectedHouse.id)) {
    rows.push([{ text: `🛒 Купить за ${getCurrencySymbol(user.city)}${selectedHouse.priceLocal}`, callback_data: `housing:buy:${selectedHouse.id}` }]);
  } else if (activeHouse?.id !== selectedHouse.id) {
    rows.push([{ text: "🏠 Сделать активным", callback_data: `housing:activate:${selectedHouse.id}` }]);
  }

  rows.push([{ text: "🔄 Обновить", callback_data: `housing:view:${selectedHouse.id}` }]);
  return { inline_keyboard: rows };
}

function formatHousingCard(user: User, house: HousingDefinition) {
  const owned = new Set(getOwnedHousingIdsForCity(user));
  const activeHouse = getActiveHousing(user);
  const status = house.id === activeHouse?.id ? "🏠 Активный дом" : owned.has(house.id) ? "✅ Уже куплен" : `💵 Цена: ${getCurrencySymbol(user.city)}${house.priceLocal}`;
  return [
    "🏘 НЕДВИЖИМОСТЬ",
    `${house.name}`,
    "",
    house.description,
    "",
    status,
    "",
    "Бонусы:",
    ...formatHousingBonuses(house).map((line) => `• ${line}`),
  ].join("\n");
}

function formatHousingMenuText(user: User) {
  const houses = listHousesForCity(user.city);
  const activeHouse = getActiveHousing(user);
  if (!houses.length) {
    return [
      "🏘 НЕДВИЖИМОСТЬ",
      `В городе ${user.city} рынок жилья ещё готовится.`,
    ].join("\n");
  }
  return [
    "🏘 НЕДВИЖИМОСТЬ",
    `Город: ${user.city}`,
    `Текущий дом: ${activeHouse?.name ?? "не выбран"}`,
    "",
    "Здесь можно посмотреть жильё, увидеть бонусы и купить новый дом.",
    "Покупка сразу делает дом активным.",
  ].join("\n");
}

async function sendHousingCard(token: string, chatId: number, user: User, house: HousingDefinition, prefix?: string) {
  const caption = [prefix, formatHousingCard(user, house)].filter(Boolean).join("\n\n");
  await sendPhotoFile(
    token,
    chatId,
    getHousingLocalImagePath(house),
    caption,
    {
      reply_markup: buildHousingInlineMarkup(user, house),
    },
  );
}

async function replaceHousingCardMessage(
  token: string,
  chatId: number,
  messageId: number | undefined,
  user: User,
  house: HousingDefinition,
  prefix?: string,
) {
  if (messageId) {
    try {
      await callTelegramApi(token, "deleteMessage", {
        chat_id: chatId,
        message_id: messageId,
      });
      const tracked = lastInlineMessageByChatId.get(chatId);
      if (tracked && tracked === messageId) {
        lastInlineMessageByChatId.delete(chatId);
      }
    } catch {
      // ignore delete errors
    }
  }
  await sendHousingCard(token, chatId, user, house, prefix);
}

function formatCompanyRole(role: string) {
  if (role === "owner") return "CEO";
  if (role === "manager") return "Менеджер";
  return "Участник";
}

function getCompanySalaryMap(companyId: string) {
  let salaryMap = companySalaryByCompanyId.get(companyId);
  if (!salaryMap) {
    salaryMap = new Map<string, number>();
    companySalaryByCompanyId.set(companyId, salaryMap);
  }
  return salaryMap;
}

function getCompanySalaryClaimMap(companyId: string) {
  let claimMap = companySalaryClaimAtByCompanyId.get(companyId);
  if (!claimMap) {
    claimMap = new Map<string, number>();
    companySalaryClaimAtByCompanyId.set(companyId, claimMap);
  }
  return claimMap;
}

function getCompanyMemberSalary(companyId: string, userId: string, role: string) {
  const salaryMap = getCompanySalaryMap(companyId);
  return Math.max(0, Math.floor(Number(salaryMap.get(userId) ?? COMPANY_DEFAULT_MEMBER_SALARY_GRM)));
}

function setCompanyMemberSalary(companyId: string, userId: string, amountGRM: number) {
  const salaryMap = getCompanySalaryMap(companyId);
  salaryMap.set(userId, Math.max(0, Math.floor(Number(amountGRM) || 0)));
}

function getBaseSkillValues(game: GameView) {
  const baseSkills = { ...(game.skills || {}) } as Record<SkillName, number>;
  for (const skill of SKILL_ORDER) {
    baseSkills[skill] = Number(baseSkills[skill] || 0);
  }
  for (const item of game.inventory || []) {
    if ((item.type !== "gear" && item.type !== "gadget") || !item.isEquipped) continue;
    for (const [key, rawValue] of Object.entries(item.stats || {})) {
      if (!(key in baseSkills)) continue;
      const skill = key as SkillName;
      baseSkills[skill] = Number(Math.max(0, Number(baseSkills[skill] || 0) - Number(rawValue || 0)).toFixed(2));
    }
  }
  return baseSkills;
}

async function formatPlayerProfileFrom(
  user: User,
  game: GameView,
  membership?: { company: any; role: string } | null,
) {
  const advancedPersonality = getAdvancedPersonalityById(getAdvancedPersonalityId(user) || "");
  const profession = getProfessionById(getPlayerProfessionId(user) || "");
  const activeHouse = getActiveHousing(user);
  const stockSnapshot = await getStockMarketSnapshot(user.id);
  const holdings = stockSnapshot.holdings.slice(0, 5);
  const skills = SKILL_ORDER.map((skill) => `${SKILL_LABELS[skill]}: ${formatNumber(game.skills[skill] ?? 0)}`).join(" | ");
  const inventoryCount = game.inventory.reduce((sum, item) => sum + Math.max(1, item.quantity || 1), 0);
  const inventoryCapacity = getInventoryCapacityForUser(user);
  const companyLine = membership
    ? `🏢 Компания: ${membership.company.name} (${formatCompanyRole(membership.role)})`
    : "🏢 Компания: нет";
  const stocksLine = holdings.length
    ? [
        `📈 Ценные бумаги: ${getCurrencySymbol(user.city)}${formatNumber(stockSnapshot.portfolioValue)}`,
        ...holdings.map((holding) =>
          `• ${holding.name} (${holding.ticker}) x${holding.quantity} = ${getCurrencySymbol(user.city)}${formatNumber(holding.marketValue)}`
        ),
      ].join("\n")
    : "📈 Ценные бумаги: нет";
  return [
    "🎮 ПРОФИЛЬ ИГРОКА",
    "━━━━━━━━━━━━━━",
    `👤 Ник: ${user.username}`,
    `🏙 Город: ${user.city}`,
    profession ? `🎓 Профессия: ${profession.emoji} ${profession.name}` : Number(user.level || 0) >= PROFESSION_UNLOCK_LEVEL ? "🎓 Профессия: не выбрана" : "",
    companyLine,
    "━━━━━━━━━━━━━━",
    `⭐ Уровень: ${user.level}   📈 Опыт: ${user.experience}/100`,
    advancedPersonality ? `✨ Второй характер: ${advancedPersonality.emoji} ${advancedPersonality.name}` : "",
    `💰 Баланс: ${getCurrencySymbol(user.city)}${formatNumber(user.balance)}   🏅 Репутация: ${formatNumber(user.reputation)}`,
    `🪙 GRM: ${formatGramValue(game.gramBalance)} GRM`,
    `🏠 Дом: ${activeHouse?.shortName ?? "нет"}`,
    `⚡ Энергия: Работа ${Math.round(game.workTime * 100)}% | Учёба ${Math.round(game.studyTime * 100)}%`,
    stocksLine,
    "━━━━━━━━━━━━━━",
    `🎒 Инвентарь: ${inventoryCount}/${inventoryCapacity} слотов`,
    formatBankProduct(game.activeBankProduct, user.city, game.gramBalance),
    "🧠 Навыки:",
    skills,
  ].join("\n");
}

function buildAdvancedPersonalitySelectText() {
  return [
    `🎉 Поздравляем! Ты достиг ${ADVANCED_PERSONALITY_UNLOCK_LEVEL} уровня.`,
    "Выбери второй характер:",
    "",
    ...ADVANCED_PERSONALITIES.map((item, index) => [
      `${index + 1}. ${item.emoji} ${item.name}`,
      item.subtitle,
      item.bonusTitle,
      ...item.bonusList.map((bonus) => `• ${bonus}`),
    ].join("\n")),
  ].join("\n\n");
}

function buildAdvancedPersonalitySelectInlineMarkup() {
  return buildCompanyInlineMenu(
    ADVANCED_PERSONALITIES.map((item) => [
      { text: `${item.emoji} ${item.name}`, callback_data: `adv_personality:pick:${item.id}` },
    ]),
  );
}

async function maybePromptAdvancedPersonality(token: string, chatId: number, user: User) {
  if (!canSelectAdvancedPersonality(user)) return false;
  if (pendingActionByChatId.get(chatId)?.type === "advanced_personality_select") return true;

  pendingActionByChatId.set(chatId, { type: "advanced_personality_select" });
  await sendMessage(token, chatId, buildAdvancedPersonalitySelectText(), {
    reply_markup: buildAdvancedPersonalitySelectInlineMarkup(),
  });
  return true;
}

function buildProfessionSelectText() {
  return [
    `🎓 Ты достиг ${PROFESSION_UNLOCK_LEVEL} уровня.`,
    "Выбери профессию:",
    "",
    ...PROFESSIONS.map((item, index) => [
      `${index + 1}. ${item.emoji} ${item.name}`,
      item.subtitle,
      `Фокус: ${item.focusSkills.join(", ")}`,
    ].join("\n")),
  ].join("\n\n");
}

function buildProfessionSelectInlineMarkup() {
  return buildCompanyInlineMenu(
    PROFESSIONS.map((item) => [
      { text: `${item.emoji} ${item.name}`, callback_data: `profession:pick:${item.id}` },
    ]),
  );
}

async function maybePromptProfession(token: string, chatId: number, user: User) {
  if (!canSelectProfession(user)) return false;
  await sendMessage(token, chatId, buildProfessionSelectText(), {
    reply_markup: buildProfessionSelectInlineMarkup(),
  });
  return true;
}

async function formatPlayerProfile(snapshot: Snapshot) {
  const membership = await getPlayerCompanyContext(snapshot.user.id);
  return await formatPlayerProfileFrom(snapshot.user, snapshot.game as GameView, membership);
}

async function formatLiveProfile(user: User, game: GameView) {
  const membership = await getPlayerCompanyContext(user.id);
  return await formatPlayerProfileFrom(user, game, membership);
}

function getJobDropChance(expReward: number, pity: number) {
  const baseChance = expReward >= 45 ? 50 : expReward >= 30 ? 38 : 28;
  return Math.min(85, baseChance + pity * 15);
}

function formatEnergyPercent(value: number) {
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
}

function getStudyEnergyCostForPlayer(levelKey: EducationLevelKey, course: EducationCourse, user: User) {
  const activeHouse = getActiveHousing(user);
  const baseCost = getStudyEnergyCostByBalance(levelKey, course, getPlayerProfessionId(user));
  return Number((baseCost * Math.max(0.5, Number(activeHouse?.bonuses.studyEnergyMultiplier ?? 1))).toFixed(4));
}

function getStudyCourseCostForPlayer(course: EducationCourse, user: User) {
  return getEducationCourseCostLocalForProfession(user.city, course, getPlayerProfessionId(user));
}

function formatJobsMenu(snapshot: Snapshot) {
  const jobs = listJobsByCity(snapshot.user.city, getPlayerProfessionId(snapshot.user), snapshot.user.level);
  if (!jobs.length) return "В вашем городе нет вакансий.";
  const currency = getCurrencySymbol(snapshot.user.city);
  return [
    `💼 Вакансии: ${snapshot.user.city}`,
    ...jobs.map((job, index) => {
      const money = snapshot.user.personality === "businessman" ? Math.floor(job.reward * 1.15) : job.reward;
      const exp = snapshot.user.personality === "workaholic" ? Math.floor(job.expReward * 1.2) : job.expReward;
      const dropChance = getJobDropChance(job.expReward, snapshot.game.jobDropPity);
      const energyCost = getJobWorkEnergyCost(job);
      return `${index + 1}. ${job.name}\nНаграда: ${currency}${money}, XP: ${exp}, 🎁 ${dropChance}%\nТребования: ${formatStats(job.minStats)}\n⚡ Энергия работы: -${Math.round(energyCost * 100)}`;
    }),
    "",
    `Текущая энергия работы: ${formatEnergyPercent(snapshot.game.workTime)}`,
    "Выбери вакансию кнопкой ниже.",
  ].join("\n\n");
}

function buildJobsInlineMarkup(snapshot: Snapshot) {
  const jobs = listJobsByCity(snapshot.user.city, getPlayerProfessionId(snapshot.user), snapshot.user.level);
  const rows = jobs.map((job, index) => ([{
    text: `💼 ${index + 1}. ${job.name}`,
    callback_data: `job:pick:${index + 1}`,
  }]));
  rows.push([{
    text: "⬅️ Назад",
    callback_data: "job:back",
  }]);
  return { inline_keyboard: rows };
}

async function sendJobsSelectionMenu(
  token: string,
  chatId: number,
  player: User,
  snapshot: Snapshot,
  prefix?: string,
) {
  pendingActionByChatId.set(chatId, { type: "job_select" });
  rememberTelegramMenu(player.id, { menu: "jobs" });
  await sendMessage(token, chatId, [prefix, formatJobsMenu(snapshot)].filter(Boolean).join("\n\n"), {
    reply_markup: buildJobsInlineMarkup(snapshot),
  });
}

async function runJobSelection(
  token: string,
  chatId: number,
  player: User,
  ref: string,
) {
  try {
    const result = await completeJob(player.id, ref);
    const currency = getCurrencySymbol(result.user.city);
    const lines = result.failed
      ? [
          `❌ Вакансия провалена: ${result.job.name}`,
          `Риск провала: ${Math.round(Number(result.failureChance ?? 0))}%`,
          `-${currency}${Math.max(0, Number(result.penaltyMoney ?? 0))} (штраф)`,
          `⚡ Потрачено энергии работы: ${Math.round(Number(result.energyCost ?? 0) * 100)}`,
          `⚡ Остаток энергии работы: ${formatEnergyPercent(result.state.workTime)}`,
          `💰 Итого денег: ${currency}${formatNumber(result.user.balance)}`,
          `⭐ Итого опыта: ур. ${result.user.level}, ${result.user.experience}/100 XP`,
        ]
      : [
          `✅ Вакансия выполнена: ${result.job.name}`,
          `+${currency}${result.finalMoney}, +${result.finalExp} XP, +${Math.max(0, Number(result.reputationGain ?? 2))} репутации`,
          `⚡ Потрачено энергии работы: ${Math.round(Number(result.energyCost ?? 0) * 100)}`,
          `⚡ Остаток энергии работы: ${formatEnergyPercent(result.state.workTime)}`,
          `💰 Итого денег: ${currency}${formatNumber(result.user.balance)}`,
          `⭐ Итого опыта: ур. ${result.user.level}, ${result.user.experience}/100 XP`,
        ];
    if (!result.failed) {
      await tryApplyTutorialEvent(player.id, "first_job_done");
      updateWeeklyQuestProgress(result.user, "jobs", 1);
    }
    if (!result.failed && result.droppedPart) lines.push(`🎁 Деталь: ${result.droppedPart.name} (${result.droppedPart.rarity})`);
    const lostPartNotice = result.notices.find((line) => line.includes("Инвентарь полон") && line.includes("потеряна"));
    if (!result.failed && lostPartNotice) lines.push(lostPartNotice);
    if (!result.failed) {
      const tutorialContinueLine = await getTutorialContinueLine(player.id);
      if (tutorialContinueLine) lines.push("", tutorialContinueLine);
    }
    await sendMessage(token, chatId, lines.join("\n"), { reply_markup: JOB_RESULT_REPLY_MARKUP });
    const nextSnapshot = {
      user: result.user,
      game: result.state,
      notices: result.notices,
    } as Snapshot;
    await sendJobsSelectionMenu(token, chatId, result.user, nextSnapshot);
    if (!result.failed && player.level < ADVANCED_PERSONALITY_UNLOCK_LEVEL && result.user.level >= ADVANCED_PERSONALITY_UNLOCK_LEVEL) {
      await maybePromptAdvancedPersonality(token, chatId, result.user);
    }
    if (!result.failed && player.level < PROFESSION_UNLOCK_LEVEL && result.user.level >= PROFESSION_UNLOCK_LEVEL) {
      await maybePromptProfession(token, chatId, result.user);
    }
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, message: extractErrorMessage(error) };
  }
}

function mapPartTypeToHackathonType(partType?: string): HackathonPartType | null {
  if (!partType) return null;
  if (partType === "processor" || partType === "asic_chip") return "CPU";
  if (partType === "memory") return "Memory";
  if (partType === "camera") return "Camera";
  if (partType === "battery" || partType === "power") return "Battery";
  if (partType === "controller" || partType === "motherboard") return "Security chip";
  return null;
}

async function formatHackathonMenu(user: User) {
  const membership = await getPlayerCompanyContext(user.id);
  const state = getWeeklyHackathonState();
  const top = formatWeeklyHackathonTop(10);
  const companyScore = membership ? getWeeklyHackathonCompanyScore(membership.company.id) : null;
  const playerStats = membership ? getWeeklyHackathonPlayerStats(user.id, membership.company.id) : null;
  const pendingPoachOffers = getPendingPoachOffersForUser(user.id);
  const endsInSec = state.endsAt ? Math.max(0, Math.ceil((state.endsAt - Date.now()) / 1000)) : 0;

  return [
    "🏁 WEEKLY HACKATHON",
    "━━━━━━━━━━━━━━",
    `Статус: ${state.status}`,
    state.endsAt ? `До конца: ~${endsInSec} сек.` : "",
    membership
      ? `Компания: ${membership.company.name} (${membership.role === "owner" ? "CEO" : "Сотрудник"})`
      : "Компания: не найдена",
    companyScore ? `Счёт компании: ${companyScore.score.toFixed(2)}` : "Счёт компании: компания не зарегистрирована",
    playerStats
      ? `Ваш вклад: действий ${playerStats.dailyActions}/${WEEKLY_HACKATHON_CONFIG.playerDailyContributionLimit}, детали ${playerStats.totalParts}/${WEEKLY_HACKATHON_CONFIG.playerPartLimit}, GRM ${playerStats.totalGrm}/${WEEKLY_HACKATHON_CONFIG.playerGrmLimit}`
      : "Ваш вклад: пока нет",
    pendingPoachOffers.length ? `⚠️ Talent Poaching предложений: ${pendingPoachOffers.length} (/poach_accept <id> | /poach_decline <id>)` : "",
    "",
    "Действия через кнопки ниже:",
    "• Присоединиться",
    "• Вложить навыки",
    "• Вложить GRM",
    "• Вложить запчасти",
    "• /hpartN (быстрый вклад деталью из списка)",
    "",
    "Top Companies:",
    ...(top.length
      ? top.map((row) => `${row.place}. ${row.companyName} (${row.city}) — ${Number(row.score).toFixed(2)}`)
      : ["Пока нет участников"]),
  ].filter(Boolean).join("\n");
}

function formatProgressBar(current: number, total: number, size: number = 12) {
  const safeTotal = Math.max(1, total);
  const filled = Math.max(0, Math.min(size, Math.round((current / safeTotal) * size)));
  return `[${"=".repeat(filled)}${"-".repeat(Math.max(0, size - filled))}]`;
}

function buildHackathonSkillProgressText(input: {
  username: string;
  companyName: string;
  accumulated: number;
  ticksDone: number;
  totalTicks: number;
  failAtTick: number | null;
}) {
  const stage = input.failAtTick !== null
    ? "❌ Поток вклада сорвался"
    : input.ticksDone >= input.totalTicks
    ? "✅ Навыки успешно упакованы"
    : "🧠 Идёт накопление навыков";
  const eventLine = input.failAtTick !== null
    ? `Сбой на такте ${input.failAtTick}/${input.totalTicks}: часть наработки потеряна.`
    : input.ticksDone > 0
    ? `Каждую секунду добавляются все навыки игрока.`
    : "Подготовка skill-вклада...";
  return [
    "🏁 ВКЛАД НАВЫКОВ",
    "━━━━━━━━━━━━━━",
    `Игрок: ${input.username}`,
    `Компания: ${input.companyName}`,
    `Статус: ${stage}`,
    `Прогресс: ${formatProgressBar(input.ticksDone, input.totalTicks)} ${input.ticksDone}/${input.totalTicks}`,
    `Накоплено очков: ${input.accumulated.toFixed(2)}`,
    eventLine,
  ].join("\n");
}

async function startHackathonSkillProgress(
  token: string,
  chatId: number,
  user: User,
  membership: CompanyContext,
  game: GameView,
) {
  const existing = hackathonSkillProgressByChatId.get(chatId);
  if (existing) {
    throw new Error("Вклад навыков уже обрабатывается. Дождись завершения текущего цикла.");
  }

  const totalSkills = Math.max(0, Number(game.skills.coding || 0))
    + Math.max(0, Number(game.skills.analytics || 0))
    + Math.max(0, Number(game.skills.design || 0))
    + Math.max(0, Number(game.skills.testing || 0));
  const totalTicks = 5;
  const fixedRandomBonus = Number(
    (
      WEEKLY_HACKATHON_CONFIG.skillRandomMin
      + Math.random() * (WEEKLY_HACKATHON_CONFIG.skillRandomMax - WEEKLY_HACKATHON_CONFIG.skillRandomMin)
    ).toFixed(2)
  );
  const estimatedContribution = Math.max(1, Number((totalSkills + fixedRandomBonus).toFixed(2)));
  const basePerTick = Number((estimatedContribution / totalTicks).toFixed(2));
  const failAtTick = Math.random() < 0.24 ? Math.floor(Math.random() * totalTicks) + 1 : null;

  applyGameStatePatch(user.id, {
    workTime: Math.max(0, Number((Number(game.workTime || 0) - WEEKLY_HACKATHON_CONFIG.skillEnergyCost).toFixed(4))),
  });

  const initialMessage = await sendMessage(
    token,
    chatId,
    buildHackathonSkillProgressText({
      username: user.username,
      companyName: membership.company.name,
      accumulated: 0,
      ticksDone: 0,
      totalTicks,
      failAtTick: null,
    }),
    { reply_markup: buildCompanyReplyMarkup(membership.role, chatId) },
  ) as { message_id?: number };

  const messageId = Number(initialMessage.message_id || 0);
  const tick = async () => {
    const state = hackathonSkillProgressByChatId.get(chatId);
    if (!state) return;
    state.ticksDone += 1;
    const isFailureTick = state.failAtTick !== null && state.ticksDone === state.failAtTick;
    if (!isFailureTick) {
      state.accumulated = Number((state.accumulated + state.basePerTick).toFixed(2));
    }

    try {
      await callTelegramApi(token, "editMessageText", {
        chat_id: chatId,
        message_id: state.messageId,
        text: buildHackathonSkillProgressText({
          username: user.username,
          companyName: membership.company.name,
          accumulated: state.accumulated,
          ticksDone: state.ticksDone,
          totalTicks: state.totalTicks,
          failAtTick: isFailureTick ? state.failAtTick : null,
        }),
      });
    } catch {
      // ignore visual update errors
    }

    if (isFailureTick) {
      clearTimeout(state.timer);
      hackathonSkillProgressByChatId.delete(chatId);
      await sendMessage(token, chatId, "❌ Вклад навыков сорвался. Энергия потрачена, но очки в хакатон не ушли.", {
        reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
      });
      return;
    }

    if (state.ticksDone >= state.totalTicks) {
      clearTimeout(state.timer);
      hackathonSkillProgressByChatId.delete(chatId);
      const result = contributeSkillToWeeklyHackathon({
        userId: user.id,
        companyId: membership.company.id,
        skills: {
          coding: Number(game.skills.coding || 0),
          analytics: Number(game.skills.analytics || 0),
          design: Number(game.skills.design || 0),
          testing: Number(game.skills.testing || 0),
        },
        fixedRandomBonus: state.fixedRandomBonus,
      });
      await sendMessage(
        token,
        chatId,
        `✅ Skill-вклад завершён: +${result.contribution.toFixed(2)} очков\nСчёт компании: ${result.score.toFixed(2)}`,
        { reply_markup: buildCompanyReplyMarkup(membership.role, chatId) },
      );
      return;
    }

    state.timer = setTimeout(tick, 1000);
    hackathonSkillProgressByChatId.set(chatId, state);
  };

  const state: HackathonSkillProgressState = {
    chatId,
    userId: user.id,
    companyId: membership.company.id,
    messageId,
    startedAt: Date.now(),
    ticksDone: 0,
    totalTicks,
    failAtTick,
    accumulated: 0,
    basePerTick,
    fixedRandomBonus,
    timer: setTimeout(tick, 1000),
  };
  hackathonSkillProgressByChatId.set(chatId, state);
}

function formatHackathonGrmMenu() {
  return [
    "💰 ВКЛАД GRM",
    "━━━━━━━━━━━━━━",
    "Доступные пакеты:",
    ...WEEKLY_HACKATHON_CONFIG.grmPackages.map((amount) => `/hackathon_grm ${amount}`),
  ].join("\n");
}

function formatMiningPlansMenu(status: CompanyMiningStatusView) {
  const header = [
    "⛏ ДОБЫЧА ЗАПЧАСТЕЙ",
    "━━━━━━━━━━━━━━",
  ];
  if (status.status === "in_progress") {
    header.push(
      `Текущая смена: ${status.planLabel ?? "добыча"}`,
      `Осталось: ~${status.remainingSeconds} сек.`,
      `Ожидаемая добыча: ${status.minRewardQty ?? 1}-${status.maxRewardQty ?? 1} запчастей`,
      "",
      "Дождись завершения текущей смены или обнови статус кнопкой ниже.",
    );
    return header.join("\n");
  }
  if (status.status === "ready_to_claim") {
    header.push(
      `Текущая смена: ${status.planLabel ?? "добыча"}`,
      `Награда готова: ${status.rewardPreview?.partName ?? "запчасти"} x${status.rewardPreview?.quantity ?? 1}`,
      "Награда готова к получению.",
    );
    return header.join("\n");
  }
  return [
    ...header,
    "Выбери смену:",
    ...COMPANY_MINING_PLANS.map((plan, index) =>
      `${index + 1}. ${plan.label} — ${Math.floor(plan.durationSeconds / 60)} мин., ${plan.minRewardQty}-${plan.maxRewardQty} запчастей`
    ),
  ].join("\n");
}

function buildCompanyMiningInlineButtons(status: CompanyMiningStatusView) {
  if (status.status === "ready_to_claim") {
    return buildCompanyInlineMenu([
      [{ text: "🎁 Забрать добычу", callback_data: "company:mining_claim" }],
      [{ text: "🔄 Обновить", callback_data: "company:mining_refresh" }],
    ]);
  }
  if (status.status === "in_progress") {
    return buildCompanyInlineMenu([
      [{ text: "🔄 Обновить", callback_data: "company:mining_refresh" }],
    ]);
  }
  return buildCompanyInlineMenu(
    COMPANY_MINING_PLANS.map((plan) => ([
      {
        text: `${plan.label} · ${Math.floor(plan.durationSeconds / 60)}м`,
        callback_data: `company:mining_pick:${plan.id}`,
      },
    ])),
  );
}

function scheduleCompanyMiningReadyNotification(
  token: string,
  chatId: number,
  membership: CompanyContext,
  userId: string,
  delaySeconds: number,
) {
  const oldTimer = companyMiningNotifyTimerByChatId.get(chatId);
  if (oldTimer) clearTimeout(oldTimer);
  const timer = setTimeout(async () => {
    try {
      const status = await getCompanyMiningStatus(membership.company.id, userId);
      if (status.status !== "ready_to_claim") return;
      await sendMessage(
        token,
        chatId,
        `✅ Добыча завершена.\nГотово: ${status.rewardPreview?.partName ?? "запчасти"} x${status.rewardPreview?.quantity ?? 1}`,
        { reply_markup: buildCompanyMiningInlineButtons(status) },
      );
    } catch {
      // ignore notification failures
    } finally {
      companyMiningNotifyTimerByChatId.delete(chatId);
    }
  }, Math.max(1, delaySeconds) * 1000 + 300);
  companyMiningNotifyTimerByChatId.set(chatId, timer);
}

async function formatGlobalEventsMenu(player?: User | null) {
  try {
    const current = await callInternalApi("GET", "/api/events/current") as Array<any>;
    const history = await callInternalApi("GET", "/api/events/history?limit=5") as Array<any>;
    const now = Date.now();
    const cityLabel = player?.city ? `Твой город: ${player.city}` : "";
    const formatCity = (city?: string) => {
      if (!city || city === "global") return "весь мир";
      if (city === "san_francisco") return "Сан-Франциско";
      if (city === "saint_petersburg") return "Санкт-Петербург";
      if (city === "seoul") return "Сеул";
      if (city === "singapore") return "Сингапур";
      return city;
    };
    const effectLabelMap: Record<string, string> = {
      price_modifier: "цены",
      demand_modifier: "спрос",
      salary_modifier: "зарплаты",
      research_modifier: "исследования",
      production_modifier: "производство",
      currency_modifier: "валюта",
    };
    return [
      "🌍 События мира и городов",
      cityLabel,
      current.length
        ? current.map((event, idx) => {
          const leftSec = Math.max(0, Math.ceil((Number(event.endsAt || 0) - now) / 1000));
          const effects = Array.isArray(event.effects)
            ? event.effects.map((effect: any) => {
              const label = effectLabelMap[String(effect.type)] || String(effect.type);
              const target = String(effect.target || "all") === "all" ? "везде" : String(effect.target || "all");
              return `${label} (${target}): ${Number(effect.value || 0) >= 0 ? "+" : ""}${Math.round(Number(effect.value || 0) * 100)}%`;
            }).join("; ")
            : "нет";
          const cityLine = `Локация: ${formatCity(String(event.city || "global"))}`;
          const priority = player?.city && String(event.city || "global") === String(resolveCity(player.city)?.id || "") ? "⭐ Влияет на твой город" : "";
          return `${idx + 1}. ${event.title}\n${cityLine}${priority ? `\n${priority}` : ""}\n${event.description}\nЭффекты: ${effects}\nДо конца: ~${leftSec} сек.`;
        }).join("\n\n")
        : "Сейчас активных событий нет.",
      "",
      "Последние события:",
      ...(history.length
        ? history.slice(0, 5).map((event, idx) => `${idx + 1}) ${event.title}`)
        : ["—"]),
    ].join("\n");
  } catch (error) {
    return `❌ Не удалось загрузить события: ${extractErrorMessage(error)}`;
  }
}

function formatPvpResultText(result: any) {
  const rounds = Array.isArray(result?.rounds) ? result.rounds : [];
  const labelMap: Record<string, string> = { concept: "Концепт", core: "Ядро", tests: "Тесты" };
  const roundsText = rounds.map((round: any, idx: number) => {
    const isPlayerA = String(round.playerAUserId || "") === String(result?.userId || "");
    const myScore = isPlayerA ? Number(round.scoreA || 0) : Number(round.scoreB || 0);
    const oppScore = isPlayerA ? Number(round.scoreB || 0) : Number(round.scoreA || 0);
    const mark = round.winnerUserId === result?.userId ? "🏆" : round.winnerUserId ? "💥" : "🤝";
    return `${idx + 1}. ${labelMap[String(round.round || "")] || String(round.round || "Этап")}: ты ${myScore.toFixed(1)} / ${Number(round.targetScore || 0).toFixed(1)} | соперник ${oppScore.toFixed(1)} ${mark}`;
  });
  const resultHeadline = result?.isDraw
    ? "🤝 ИТОГ: НИЧЬЯ"
    : result?.isWinner
      ? "🏆 ИТОГ: ТЫ ПОБЕДИЛ"
      : "💥 ИТОГ: ПОРАЖЕНИЕ";
  const ratingLine = result?.isDraw
    ? "Рейтинг: без изменений"
    : `Рейтинг: ${result?.ratingBefore ?? "?"} → ${result?.ratingAfter ?? "?"} (${Number(result?.ratingDelta || 0) >= 0 ? "+" : ""}${Number(result?.ratingDelta || 0)})`;
  const rewardLine = result?.isDraw
    ? "Награда: нет"
    : `Награда: +${Math.max(0, Number(result?.xpReward || 0))} XP${Number(result?.reputationReward || 0) > 0 ? `, +${Number(result.reputationReward)} репутации` : ""}`;
  return [
    "⚔️ PvP duel result",
    `Соперник: ${result?.opponentName || "—"}`,
    resultHeadline,
    ratingLine,
    rewardLine,
    `⚡ Энергия дуэли: -${Math.round(Number(result?.energyCost || 0) * 100)}%`,
    "",
    ...roundsText,
    ...(result?.gadgetWear?.summary ? ["", String(result.gadgetWear.summary)] : []),
  ].join("\n");
}

function buildPvpProgressBar(percent: number) {
  const normalized = Math.max(0, Math.min(100, Math.round(percent)));
  const filled = Math.max(0, Math.min(10, Math.floor(normalized / 10)));
  return `${"=".repeat(filled)}${"-".repeat(10 - filled)}`;
}

function formatPvpEventLine(activeDuel: any) {
  const kind = String(activeDuel?.latestEventKind || "");
  const actorName = String(activeDuel?.latestEventActorName || "");
  const title = String(activeDuel?.latestEventTitle || "");
  const details = String(activeDuel?.latestEventDetails || "");
  const actorLabel = actorName
    ? actorName === String(activeDuel?.myName || "") ? "Ты" : actorName
    : "Система";
  if (kind === "positive") {
    return `${actorLabel}: 🟢 ${title}${details ? `\n✨ ${details}` : ""}`;
  }
  if (kind === "negative") {
    return `${actorLabel}: 🔴 ${title}${details ? `\n⚠️ ${details}` : ""}`;
  }
  return `🧾 ЛОГ: ${activeDuel?.latestLog || "Команды синхронизируют билд..."}`;
}

function formatParticipantPvpEventBlock(input: {
  actorLabel: string;
  kind?: string;
  title?: string;
  details?: string;
  progressLabel: string;
  progressBar: string;
  progressValue: string;
}) {
  const lines = [""];
  if (input.kind === "positive") {
    lines.push(`${input.actorLabel}: 🟢 ${input.title || "Пойман хороший темп"}`);
    if (input.details) lines.push(`✨ ${input.details}`);
  } else if (input.kind === "negative") {
    lines.push(`${input.actorLabel}: 🔴 ${input.title || "Сбой"}`);
    if (input.details) lines.push(`⚠️ ${input.details}`);
  }
  lines.push(`${input.progressLabel}: ${input.progressBar} ${input.progressValue}`);
  return lines.join("\n");
}

function formatPvpStageSnapshotText(activeDuel: any, stageView: any) {
  const myPercent = Number(stageView?.myCompleted ? 100 : stageView?.myPercent || 0);
  const opponentPercent = Number(stageView?.opponentCompleted ? 100 : stageView?.opponentPercent || 0);
  return [
    "[BUILD LOG]",
    `${activeDuel?.myName || "Ты"} vs ${activeDuel?.opponentName || "Соперник"}`,
    `Фаза: ${stageView?.label || activeDuel?.currentStageLabel || "Подготовка"}`,
    formatParticipantPvpEventBlock({
      actorLabel: "Ты",
      kind: activeDuel?.myLatestEventKind,
      title: activeDuel?.myLatestEventTitle,
      details: activeDuel?.myLatestEventDetails,
      progressLabel: "Ты",
      progressBar: `[${buildPvpProgressBar(myPercent)}]`,
      progressValue: `${Number(stageView?.myProgress || 0).toFixed(1)}/${Number(stageView?.targetScore || 0).toFixed(1)}`,
    }),
    formatParticipantPvpEventBlock({
      actorLabel: String(activeDuel?.opponentName || "Соперник"),
      kind: activeDuel?.opponentLatestEventKind,
      title: activeDuel?.opponentLatestEventTitle,
      details: activeDuel?.opponentLatestEventDetails,
      progressLabel: "Соперник",
      progressBar: `[${buildPvpProgressBar(opponentPercent)}]`,
      progressValue: `${Number(stageView?.opponentProgress || 0).toFixed(1)}/${Number(stageView?.targetScore || 0).toFixed(1)}`,
    }),
    activeDuel?.myFreezeTicks > 0 ? `⏸ Ты заморожен: ${Number(activeDuel.myFreezeTicks)} сек.` : "",
    activeDuel?.opponentFreezeTicks > 0 ? `⏸ Соперник заморожен: ${Number(activeDuel.opponentFreezeTicks)} сек.` : "",
    Array.isArray(activeDuel?.myBoosts) && activeDuel.myBoosts.length ? `Boosts: ${activeDuel.myBoosts.join(", ")}` : "",
  ].filter(Boolean).join("\n");
}

function buildPvpBoostInlineKeyboard(activeDuel?: any) {
  const myBoosts = new Set(Array.isArray(activeDuel?.myBoosts) ? activeDuel.myBoosts : []);
  return {
    inline_keyboard: [
      [
        { text: myBoosts.has("overclock_cpu") ? "CPU ✓" : "CPU 50 GRAM", callback_data: "pvp_boost:buy:overclock_cpu" },
        { text: myBoosts.has("qa_outsource") ? "Debugger ✓" : "Debugger 100 GRAM", callback_data: "pvp_boost:buy:qa_outsource" },
      ],
      [
        { text: myBoosts.has("energy_drink") ? "Serum ✓" : "Serum 30 GRAM", callback_data: "pvp_boost:buy:energy_drink" },
      ],
      [
        { text: "▶️ Старт", callback_data: "pvp_boost:start" },
      ],
    ],
  };
}

function formatPvpActiveDuelText(activeDuel: any) {
  if (activeDuel?.awaitingStart) {
    const remainingSec = Math.max(0, Math.ceil(Number(activeDuel?.preparationRemainingMs || 0) / 1000));
    return [
      "[PRE-DUEL SHOP]",
      `${activeDuel?.myName || "Ты"} vs ${activeDuel?.opponentName || "Соперник"}`,
      "Матч найден. Перед стартом можно докупить boosts за GRAM.",
      `Автостарт через: ${remainingSec} сек.`,
      `CPU: +20% к Coding`,
      `Debugger: иммунитет к негативным событиям`,
      `Serum: снижает расход энергии`,
      "",
      `Текущий лог: > ${activeDuel?.latestLog || "Команды готовят окружение..."}`,
    ].join("\n");
  }

  const currentStage = Array.isArray(activeDuel?.stages)
    ? activeDuel.stages.find((stage: any) => stage?.isCurrent) ?? activeDuel.stages.at(-1)
    : null;
  return formatPvpStageSnapshotText(activeDuel, currentStage);
}

function formatPvpCompletedDuelText(result: any) {
  const stageMeta: Record<string, { label: string; description: string }> = {
    concept: {
      label: "Концепт",
      description: "Идея собрана и прототип утверждён.",
    },
    core: {
      label: "Ядро",
      description: "Основная разработка завершена.",
    },
    tests: {
      label: "Тесты и релиз",
      description: "Финальный билд проверен и отправлен в релиз.",
    },
  };

  const rounds = Array.isArray(result?.rounds) ? result.rounds : [];
  const stageLines = rounds.map((round: any, index: number) => {
    const isPlayerA = String(round?.playerAUserId || "") === String(result?.userId || "");
    const myScore = Number(isPlayerA ? round?.scoreA || 0 : round?.scoreB || 0);
    const opponentScore = Number(isPlayerA ? round?.scoreB || 0 : round?.scoreA || 0);
    const meta = stageMeta[String(round?.round || "")] ?? { label: String(round?.round || "Этап"), description: "Этап завершён." };
    return [
      `${index + 1}. ${meta.label} [${buildPvpProgressBar(100)}] готово`,
      `   Ты: ${myScore.toFixed(1)}/${Number(round?.targetScore || 0).toFixed(1)} | Соперник: ${opponentScore.toFixed(1)}`,
    ].join("\n");
  });

  return [
    "[BUILD LOG]",
    `${result?.userName || "Ты"} vs ${result?.opponentName || "Соперник"}`,
    result?.isDraw ? "🤝 Финал: ничья" : result?.isWinner ? "🏆 Финал: победа" : "💥 Финал: поражение",
    "Финальный билд собран. Итоги дуэли готовы.",
    `Общий прогресс: [${buildPvpProgressBar(100)}] 100%`,
    "",
    ...stageLines,
  ].join("\n");
}

async function formatPvpMenu(user: User) {
  try {
    const status = await callInternalApi("GET", `/api/pvp/status?userId=${encodeURIComponent(user.id)}`) as any;
    const queueLine = status?.activeDuel
      ? `идёт дуэль: ${status.activeDuel.currentStageLabel} (${Number(status.activeDuel.overallProgress || 0)}%)`
      : status?.inQueue
        ? `в поиске (${Number(status?.queueWaitSec || 0)} сек.)`
        : "не активна";
    return [
      "⚔️ HACKATHON DUEL (PvP 1v1)",
      "━━━━━━━━━━━━━━",
      `Рейтинг: ${Number(status?.rating || user.pvpRating || 1000)}`,
      `Бои: ${Number(status?.matches || user.pvpMatches || 0)} | Победы: ${Number(status?.wins || user.pvpWins || 0)} | Поражения: ${Number(status?.losses || user.pvpLosses || 0)}`,
      `Лимит в день: ${Number(status?.dailyMatches || 0)}/${Number(status?.dailyLimit || 10)}`,
      `Очередь: ${queueLine}`,
      "",
      "Команды:",
      "• /pvp_find — найти соперника",
      "• /pvp_leave — выйти из очереди",
      "• /pvp_history — история боёв",
    ].join("\n");
  } catch (error) {
    return `❌ Не удалось загрузить PvP: ${extractErrorMessage(error)}`;
  }
}

function stopPvpQueuePolling(chatId: number) {
  const timer = pvpQueuePollTimerByChatId.get(chatId);
  if (timer) {
    clearInterval(timer);
    pvpQueuePollTimerByChatId.delete(chatId);
  }
  pvpDuelProgressMessageByChatId.delete(chatId);
  pvpDuelStageKeyByChatId.delete(chatId);
}

async function syncPvpDuelMessages(token: string, chatId: number, activeDuel: any) {
  const logText = formatPvpActiveDuelText(activeDuel);
  const extra = activeDuel?.awaitingStart ? { reply_markup: buildPvpBoostInlineKeyboard(activeDuel) } : {};
  const progressMessageId = pvpDuelProgressMessageByChatId.get(chatId);
  const stageKey = String(activeDuel?.currentStageKey || "unknown");
  const previousStageKey = pvpDuelStageKeyByChatId.get(chatId);
  const shouldCreateNewStageMessage = !progressMessageId || (!activeDuel?.awaitingStart && previousStageKey && previousStageKey !== stageKey);

  if (progressMessageId && !shouldCreateNewStageMessage) {
    await callTelegramApi(token, "editMessageText", {
      chat_id: chatId,
      message_id: progressMessageId,
      text: logText,
      ...extra,
    });
  } else {
    if (progressMessageId && previousStageKey && previousStageKey !== stageKey) {
      const previousStage = Array.isArray(activeDuel?.stages)
        ? activeDuel.stages.find((stage: any) => String(stage?.key || "") === previousStageKey)
        : null;
      if (previousStage) {
        await callTelegramApi(token, "editMessageText", {
          chat_id: chatId,
          message_id: progressMessageId,
          text: formatPvpStageSnapshotText(activeDuel, previousStage),
        });
      }
    }
    const message = await sendMessage(token, chatId, logText, extra);
    if (Number(message?.message_id)) {
      pvpDuelProgressMessageByChatId.set(chatId, Number(message.message_id));
    }
  }
  if (!activeDuel?.awaitingStart) {
    pvpDuelStageKeyByChatId.set(chatId, stageKey);
  }
}

function startPvpQueuePolling(token: string, chatId: number, userId: string) {
  stopPvpQueuePolling(chatId);
  const startedAt = Date.now();
  const timer = setInterval(async () => {
    try {
      await callInternalApi("POST", "/api/pvp/heartbeat", { userId });
      const claim = await callInternalApi("POST", "/api/pvp/result/claim", { userId }) as any;
      if (claim?.result) {
        claim.result.userId = userId;
        claim.result.userName = "Ты";
        const progressMessageId = pvpDuelProgressMessageByChatId.get(chatId);
        if (progressMessageId) {
          await callTelegramApi(token, "editMessageText", {
            chat_id: chatId,
            message_id: progressMessageId,
            text: formatPvpCompletedDuelText(claim.result),
          });
        }
        await sendMessage(token, chatId, formatPvpResultText(claim.result), { reply_markup: PVP_MENU_REPLY_MARKUP });
        stopPvpQueuePolling(chatId);
        return;
      }
      const status = await callInternalApi("GET", `/api/pvp/status?userId=${encodeURIComponent(userId)}`) as any;
      if (status?.activeDuel) {
        await syncPvpDuelMessages(token, chatId, status.activeDuel);
      }
      if (!status?.inQueue) {
        if (!status?.activeDuel) stopPvpQueuePolling(chatId);
        return;
      }
      if (Date.now() - startedAt > 2 * 60 * 1000) {
        await callInternalApi("POST", "/api/pvp/queue/leave", { userId });
        await sendMessage(token, chatId, "⌛ Поиск соперника остановлен (таймаут). Попробуй /pvp_find снова.", { reply_markup: PVP_MENU_REPLY_MARKUP });
        stopPvpQueuePolling(chatId);
      }
    } catch {
      // silent retry
    }
  }, 3000);
  pvpQueuePollTimerByChatId.set(chatId, timer);
}

function resolveHackathonSabotageType(raw: string) {
  const token = String(raw || "").trim().toLowerCase();
  const map: Record<string, "tech_leak" | "market_rumor" | "parts_sabotage" | "talent_poaching" | "cyber_attack"> = {
    tech: "tech_leak",
    tech_leak: "tech_leak",
    rumor: "market_rumor",
    market_rumor: "market_rumor",
    parts: "parts_sabotage",
    parts_sabotage: "parts_sabotage",
    poach: "talent_poaching",
    talent_poaching: "talent_poaching",
    cyber: "cyber_attack",
    cyber_attack: "cyber_attack",
  };
  return map[token] ?? null;
}

async function formatSabotageMenu(user: User) {
  const membership = await getPlayerCompanyContext(user.id);
  if (!membership) {
    return "Ты не состоишь в компании. Открой /company.";
  }
  const state = getWeeklyHackathonState();
  const sabotageState = getWeeklyHackathonSabotageState(membership.company.id);
  const top = formatWeeklyHackathonTop(15).filter((row) => row.companyId !== membership.company.id);
  const refs = top.map((row) => row.companyId);
  return {
    refs,
    text: [
      "🕶 САБОТАЖ — WEEKLY HACKATHON",
      "━━━━━━━━━━━━━━",
      `Статус хакатона: ${state.status}`,
      `Роль: ${membership.role}`,
      `Лимит компании: ${sabotageState.usedByCompany}/${sabotageState.maxPerCompanyPerEvent}`,
      `Security level: ${Number(getWeeklyHackathonCompanyScore(membership.company.id)?.securityLevel || 1)}`,
      "",
      "Типы:",
      "• tech_leak (300 GRM, base 35%)",
      "• market_rumor (200 GRM, -10% вклад на 2ч)",
      "• parts_sabotage (400 GRM, -30% очков за 5 деталей)",
      "• talent_poaching (500 GRM, нужен targetUserId)",
      "• cyber_attack (800 GRM, base 25%)",
      "",
      "Цели:",
      ...(top.length ? top.map((row, idx) => `${idx + 1}. ${row.companyName} (${row.city}) id=${row.companyId}`) : ["Нет целей"]),
      "",
      "Команды:",
      "• /sabotage_security <1|2|3>",
      "• /sabotage_attack <type> <targetCompanyId|номер> [targetUserId]",
      "• /poach_accept <offerId> | /poach_decline <offerId>",
    ].join("\n"),
  };
}

function formatShopMenu(snapshot: Snapshot, tab: ShopMenuTab = "all") {
  const currency = getCurrencySymbol(snapshot.user.city);
  const items = listShopItems();
  const trainingItems = items.filter((item) => item.type === "consumable");
  const gadgetItems = items.filter((item) => item.type === "gear");
  const consumableUseLimit = getConsumableTrainingUseLimitForLevel(snapshot.user.level);
  const consumableUsed = getTrainingConsumablesUsedAtLevel(snapshot.user);
  const skillCap = getTrainingSkillCapForLevel(snapshot.user.level);
  if (tab === "all") {
    return [
      `🛍 Магазин города`,
      `Баланс: ${currency}${formatNumber(snapshot.user.balance)}`,
      "",
      "Здесь можно:",
      "• купить курс для прокачки навыков",
      "• купить гаджет с бонусами",
      "• продать предметы из инвентаря",
      "",
      "Выбери раздел кнопками ниже: Курсы, Гаджеты или Продажа.",
    ].join("\n");
  }

  const sectionItems = tab === "parts" ? trainingItems : gadgetItems;
  const title = tab === "parts" ? "📚 Курсы" : "📱 Гаджеты";
  return [
    `${title}`,
    `Баланс: ${currency}${formatNumber(snapshot.user.balance)}`,
    ...(tab === "parts"
      ? [
        `Лимит учебных предметов на уровне ${formatNumber(snapshot.user.level)}: ${formatNumber(consumableUsed)}/${formatNumber(consumableUseLimit)}`,
        `Потолок навыков от курсов и учёбы: ${skillCap}`,
      ]
      : []),
    "",
    ...sectionItems.map((item, index) => {
      const afford = snapshot.user.balance >= item.price ? "✅" : "❌";
      const minLevelLine = tab === "parts" && String(item.rarity || "").toLowerCase() !== "common"
        ? `\nМин. уровень: ${String(item.rarity || "").toLowerCase() === "rare" ? 3 : 5}`
        : "";
      return `${index + 1}. ${item.name}  /buy_${index + 1}\n${currency}${item.price} (${item.rarity}) ${afford}${minLevelLine}\n${formatStats(item.stats)}`;
    }),
    "",
    "Покупка: отправь номер товара, /buy <номер> или нажми быстрый /buy_N рядом с позицией.",
  ].join("\n\n");
}

function buildShopSellMenu(snapshot: Snapshot) {
  const currency = getCurrencySymbol(snapshot.user.city);
  const sellable = snapshot.game.inventory.filter(
    (item) => item.type === "part" || item.type === "gadget" || item.id === TUTORIAL_MEDAL_ITEM_ID,
  );
  if (!sellable.length) {
    return { text: "💱 Продавать нечего: инвентарь пуст или в нём нет предметов для продажи.", refs: [] as string[] };
  }

  const refs = sellable.map((item) => item.id);
  const lines = [
    `💱 Продажа: баланс ${currency}${formatNumber(snapshot.user.balance)}`,
    "Список позиций из инвентаря, которые можно продать:",
    ...sellable.map((item, index) => {
      const qty = Math.max(1, item.quantity || 1);
      const price = estimateInventorySellPrice(item);
      const durability = item.type === "gadget"
        ? `, состояние ${Math.max(0, Math.round(item.condition ?? item.durability ?? 0))}/${Math.max(1, Math.round(item.maxCondition ?? item.maxDurability ?? 100))}, ${getGadgetConditionStatusLabel(item)}`
        : "";
      return `${index + 1}. ${item.name} x${qty}  /sell_${index + 1}\n[${ITEM_TYPE_LABELS[item.type]}${durability}]\nЦена выкупа: ${currency}${price}`;
    }),
    "",
    "Отправь номер из списка, /sell <номер> или нажми быстрый /sell_N рядом с позицией.",
  ];
  return { text: lines.join("\n\n"), refs };
}

function buildInventoryMenu(snapshot: Snapshot) {
  const items = [...snapshot.game.inventory];
  if (!items.length) {
    return { text: "🎒 Инвентарь пуст.", refs: [] as string[], actions: [] as InventoryAction[] };
  }

  const order: Record<GameInventoryItem["type"], number> = { consumable: 1, gear: 2, gadget: 3, part: 4 };
  items.sort((a, b) => (order[a.type] - order[b.type]) || a.name.localeCompare(b.name, "ru"));

  const refs = items.map((item) => item.id);
  const actions: InventoryAction[] = [];

  const text = [
    "🎒 Инвентарь:",
    ...items.map((item, index) => {
      const itemIndex = index + 1;
      const equipped = (item.type === "gear" || item.type === "gadget") && item.isEquipped ? " (надето)" : "";
      const durability = item.type === "gadget"
        ? `, состояние: ${Math.max(0, Math.round(item.condition ?? item.durability ?? 0))}/${Math.max(1, Math.round(item.maxCondition ?? item.maxDurability ?? 100))}, статус: ${getGadgetConditionStatusLabel(item)}, надёжность: ${Math.round(Number(item.reliability ?? 1) * 100)}%${item.isBroken ? ", сломан" : ""}`
        : "";
      let actionLine = "";
      if (item.type === "gear") {
        actions.push({
          kind: "equip",
          index: itemIndex,
          ref: item.id,
          itemName: item.name,
          isEquipped: !!item.isEquipped,
        });
        actionLine = item.isEquipped
          ? `⚪ /equip_${itemIndex}`
          : `🟢 /equip_${itemIndex}`;
      } else if (item.type === "consumable") {
        actions.push({
          kind: "use",
          index: itemIndex,
          ref: item.id,
          itemName: item.name,
        });
        actionLine = `⚡ /use_${itemIndex}`;
      } else if (item.type === "gadget") {
        const maxDurability = Math.max(1, Math.round(item.maxCondition ?? item.maxDurability ?? 100));
        const durabilityNow = Math.max(0, Math.round(item.condition ?? item.durability ?? maxDurability));
        if (item.isBroken) {
          actionLine = "💥 сломан";
        } else {
          actions.push({
            kind: "equip",
            index: itemIndex,
            ref: item.id,
            itemName: item.name,
            isEquipped: !!item.isEquipped,
          });
          actionLine = item.isEquipped
            ? `⚪ /equip_${itemIndex}`
            : `🟢 /equip_${itemIndex}`;
        }
        if (durabilityNow < maxDurability) {
          actions.push({
            kind: "service",
            index: itemIndex,
            ref: item.id,
            itemName: item.name,
          });
          actionLine = `${actionLine}  🔧 /service_${itemIndex}`;
        }
        if (item.isBroken) {
          actions.push({
            kind: "scrap",
            index: itemIndex,
            ref: item.id,
            itemName: item.name,
          });
          actionLine = `${actionLine}  ♻️ /scrap_${itemIndex}`;
        }
      }
      return [
        `${itemIndex}. ${item.name} x${Math.max(1, item.quantity || 1)} [${ITEM_TYPE_LABELS[item.type]}${equipped}]${durability}${actionLine ? `  ${actionLine}` : ""}`,
        `${formatStats(item.stats)}`,
      ].join("\n");
    }),
    "",
    "ℹ️ Надеть можно только один предмет каждого типа одновременно.",
    "Также доступны: /use <номер>, /equip <номер>, /service <номер>, /scrap <номер>",
  ].join("\n\n");

  return { text, refs, actions };
}

function getInventoryActionButtonText(action: InventoryAction) {
  if (action.kind === "use") return `${action.index}. ⚡ Использовать`;
  if (action.kind === "service") return `${action.index}. 🔧 Обслужить`;
  if (action.kind === "scrap") return `${action.index}. ♻️ Разобрать`;
  return action.isEquipped
    ? `${action.index}. ⚪ Снять`
    : `${action.index}. 🟢 Надеть`;
}

function buildInventoryInlineButtons(view: InventoryMenuView) {
  const rows: Array<Array<{ text: string; callback_data: string }>> = [];
  const maxButtons = 12;

  for (const action of view.actions.slice(0, maxButtons)) {
    rows.push([
      {
        text: getInventoryActionButtonText(action),
        callback_data: `inv:${action.kind}:${action.index}`,
      },
    ]);
  }

  rows.push([{ text: "🔄 Обновить инвентарь", callback_data: "inv:open" }]);
  return { inline_keyboard: rows };
}

function buildShopPurchaseInlineMarkup(item: Pick<GameInventoryItem, "id" | "type" | "name">) {
  if (item.type === "consumable") {
    return {
      inline_keyboard: [[{ text: `⚡ Использовать ${item.name}`, callback_data: `shopbuy:use:${item.id}` }]],
    };
  }
  if (item.type === "gear") {
    return {
      inline_keyboard: [[{ text: `🟢 Надеть ${item.name}`, callback_data: `shopbuy:equip:${item.id}` }]],
    };
  }
  return undefined;
}

function buildQuestInlineButtons(canClaim: boolean) {
  const rows: Array<Array<{ text: string; callback_data: string }>> = [];
  if (canClaim) {
    rows.push([{ text: "🎁 Забрать награду", callback_data: "quest:claim" }]);
  }
  rows.push([
    { text: "🔄 Обновить", callback_data: "quest:refresh" },
    { text: "🏅 Репутация", callback_data: "quest:reputation" },
  ]);
  rows.push([{ text: "🏆 Рейтинг", callback_data: "quest:rating" }]);
  return { inline_keyboard: rows };
}

function buildRatingInlineButtons(entity: RatingEntity, sort: RatingSort) {
  const selected = (scope: RatingEntity, value: RatingSort, label: string) => {
    return entity === scope && sort === value ? `✅ ${label}` : label;
  };

  return {
    inline_keyboard: [
      [
        { text: selected("players", "level", "👤 Игроки: ур"), callback_data: "rating:players:level" },
        { text: selected("players", "reputation", "👤 Игроки: реп"), callback_data: "rating:players:reputation" },
        { text: selected("players", "wealth", "👤 Игроки: ₽"), callback_data: "rating:players:wealth" },
      ],
      [
        { text: selected("players", "pvp", "👤 Игроки: PvP"), callback_data: "rating:players:pvp" },
      ],
      [
        { text: selected("companies", "level", "🏢 Компании: ур"), callback_data: "rating:companies:level" },
        { text: selected("companies", "wealth", "🏢 Компании: GRM"), callback_data: "rating:companies:wealth" },
        { text: selected("companies", "blueprints", "🏢 Компании: 📐"), callback_data: "rating:companies:blueprints" },
      ],
    ],
  };
}

function formatBankProgramsMenu(type: BankProductType, snapshot: Snapshot) {
  const programs = type === "credit" ? listCreditPrograms() : listDepositPrograms();
  const currency = getCurrencySymbol(snapshot.user.city);
  return [
    type === "credit" ? "🏦 Кредитные программы" : "🏦 Депозитные программы",
    ...programs.map((program, index) =>
      `${index + 1}. ${program.name}\nУровень: ${program.minLevel}+ | ${program.interest}%\nСумма: ${currency}${program.minAmount}-${currency}${program.maxAmount}\n${program.description}`
    ),
    "",
    "Выбери программу кнопкой или ответь сообщением: <номер> <сумма> <дни>",
    "Пример ответа: 1 10000 14",
  ].join("\n\n");
}

function formatTopPlayers(users: User[]) {
  const top = [...users].sort((a, b) => (b.level - a.level) || (b.balance - a.balance)).slice(0, 10);
  return top.length
    ? `🏆 Топ игроков\n${top.map((user, index) => `${index + 1}. ${user.username} — lvl ${formatNumber(user.level)}, 💰 ${formatNumber(user.balance)}`).join("\n")}`
    : "🏆 Пока нет игроков в рейтинге";
}

function buildRuntimeCompanyEconomyState(
  company: any,
  economy: CompanyEconomyState,
): CompanyEconomyRuntimeState {
  return {
    ...economy,
    companyId: String(company.id),
    companyName: String(company.name),
    city: String(company.city),
  };
}

function mergeCompanyWithEconomy(company: any, economy: CompanyEconomyRuntimeState) {
  return {
    ...company,
    ...economy,
    balance: Math.max(0, Math.round(economy.capitalGRM)),
  };
}

async function getCompanyProducedStats(companyId: string) {
  try {
    const snapshot = await getCompanyBlueprintSnapshot(companyId);
    const uniqueGadgets = new Set(snapshot.produced.map((item) => item.name)).size;
    return {
      producedCount: snapshot.produced.length,
      uniqueGadgets,
    };
  } catch {
    return {
      producedCount: 0,
      uniqueGadgets: 0,
    };
  }
}

async function ensureCompanyEconomyState(company: any, membersCount: number): Promise<CompanyEconomyRuntimeState> {
  const current = companyEconomyByCompanyId.get(String(company.id));
  const producedStats = await getCompanyProducedStats(String(company.id));
  const storageBalance = Math.max(0, Number(company.balance ?? 0));
  let inferredCapital = Math.max(500, Number(current?.capitalGRM ?? storageBalance ?? 500));
  if (!current && storageBalance > 0) {
    inferredCapital = storageBalance;
  }
  if (current && storageBalance > 0) {
    const roundedCurrent = Math.round(current.capitalGRM);
    const storageDelta = storageBalance - roundedCurrent;
    if (Math.abs(storageDelta) >= 1) {
      inferredCapital = Math.max(0, current.capitalGRM + storageDelta);
    }
  }

  const seed: CompanyEconomyLike = {
    stage: current?.stage ?? "startup",
    capitalGRM: inferredCapital,
    profitGRM: Number(current?.profitGRM ?? 0),
    assetsGRM: Number(current?.assetsGRM ?? inferredCapital),
    brand: Number(current?.brand ?? 1),
    techLevel: Number(current?.techLevel ?? 1),
    employeeCount: Math.max(1, membersCount),
    uniqueGadgets: Math.max(
      Number(current?.uniqueGadgets ?? 0),
      producedStats.uniqueGadgets,
    ),
    gadgetsSold: Math.max(
      Number(current?.gadgetsSold ?? 0),
      producedStats.producedCount,
    ),
    departments: current?.departments,
    shares: current?.shares,
    balance: inferredCapital,
  };

  const normalized = reconcileCompanyEconomy(seed);
  const runtime = buildRuntimeCompanyEconomyState(company, normalized);
  companyEconomyByCompanyId.set(String(company.id), runtime);
  return runtime;
}

async function saveCompanyEconomyState(
  company: any,
  economy: CompanyEconomyState,
): Promise<CompanyEconomyRuntimeState> {
  const normalized = reconcileCompanyEconomy(economy);
  const runtime = buildRuntimeCompanyEconomyState(company, normalized);
  companyEconomyByCompanyId.set(String(company.id), runtime);

  const nextBalance = Math.max(0, Math.round(runtime.capitalGRM));
  if (Number(company.balance ?? 0) !== nextBalance) {
    await storage.updateCompany(String(company.id), { balance: nextBalance });
  }
  return runtime;
}

async function applyCompanyTopUpFromPlayer(
  player: User,
  company: any,
  economy: CompanyEconomyRuntimeState,
  amountLocal: number,
): Promise<CompanyLocalTopUpResult> {
  const result = depositLocalToCompany(economy, amountLocal, player.city);
  if (!result.ok) {
    return {
      ok: false,
      reason: result.reason ?? "Не удалось пополнить компанию",
      spentLocal: 0,
      receivedGRM: 0,
      playerBalanceAfter: player.balance,
      company: economy,
    };
  }

  if (player.balance < result.amountLocalSpent) {
    return {
      ok: false,
      reason: "Недостаточно локальной валюты для обмена",
      spentLocal: 0,
      receivedGRM: 0,
      playerBalanceAfter: player.balance,
      company: economy,
    };
  }

  const updatedUser = await storage.updateUser(player.id, {
    balance: player.balance - result.amountLocalSpent,
  });
  let saved: CompanyEconomyRuntimeState;
  try {
    saved = await saveCompanyEconomyState(company, result.company);
  } catch (error) {
    await storage.updateUser(player.id, { balance: player.balance });
    return {
      ok: false,
      reason: extractErrorMessage(error),
      spentLocal: 0,
      receivedGRM: 0,
      playerBalanceAfter: player.balance,
      company: economy,
    };
  }
  return {
    ok: true,
    spentLocal: result.amountLocalSpent,
    receivedGRM: result.amountGRMReceived,
    playerBalanceAfter: updatedUser.balance,
    company: saved,
  };
}

function formatIpoMetricLine(label: string, current: number, target: number) {
  return `${label}: ${Math.floor(current)} / ${target}`;
}

function formatCompanyDepartmentStatus(
  companyEconomy: CompanyEconomyState,
  department: CompanyDepartmentKey,
) {
  const currentLevel = companyEconomy.departments[department];
  const nextLevel = Math.min(4, currentLevel + 1);
  const nextCost = getDepartmentNextCost(department, currentLevel);
  const nextBonus = currentLevel >= 4
    ? "Максимальный уровень"
    : getDepartmentBonusText(department, nextLevel);
  const check = getDepartmentUpgradeCheck(companyEconomy, department);
  const status = check.canUpgrade ? "✅ Доступно" : `в›” ${check.reason ?? "РќРµРґРѕСЃС‚СѓРїРЅРѕ"}`;
  return {
    currentLevel,
    nextCost,
    nextBonus,
    status,
  };
}

async function getPlayerCompanyContext(userId: string) {
  const companies = await storage.getAllCompanies();
  for (const company of companies) {
    if (company.isTutorial) continue;
    if (company.ownerId === userId) {
      const members = await storage.getCompanyMembers(company.id);
      const economy = await ensureCompanyEconomyState(company, members.length);
      return { company: mergeCompanyWithEconomy(company, economy), role: "owner", membersCount: members.length };
    }
    const member = await storage.getMemberByUserId(company.id, userId);
    if (member) {
      const members = await storage.getCompanyMembers(company.id);
      const economy = await ensureCompanyEconomyState(company, members.length);
      return { company: mergeCompanyWithEconomy(company, economy), role: member.role, membersCount: members.length };
    }
  }
  return null;
}

async function callInternalApi(method: "GET" | "POST", path: string, body?: Record<string, unknown>) {
  const response = await fetch(`${getServerBaseUrl()}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

  const raw = await response.text();
  let json: any = null;
  if (raw) {
    try {
      json = JSON.parse(raw);
    } catch {
      json = null;
    }
  }

  if (!response.ok) {
    const errorMessage = json?.error || json?.message || raw || `HTTP ${response.status}`;
    throw new Error(String(errorMessage));
  }

  return json;
}

async function callInternalAdminApi(method: "GET" | "POST" | "PATCH", path: string, body?: Record<string, unknown>) {
  if (!ADMIN_PASSWORD) {
    throw new Error("Admin API disabled: ADMIN_PASSWORD is not configured.");
  }
  const response = await fetch(`${getServerBaseUrl()}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-admin-password": ADMIN_PASSWORD,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const raw = await response.text();
  let json: any = null;
  if (raw) {
    try {
      json = JSON.parse(raw);
    } catch {
      json = null;
    }
  }

  if (!response.ok) {
    const errorMessage = json?.error || json?.message || raw || `HTTP ${response.status}`;
    throw new Error(String(errorMessage));
  }

  return json;
}

async function getTutorialSnapshotByUser(userId: string): Promise<TutorialApiSnapshot> {
  return await callInternalApi("GET", `/api/tutorial/${userId}`) as TutorialApiSnapshot;
}

async function sendTutorialMenu(token: string, chatId: number, userId: string) {
  const tutorial = await getTutorialSnapshotByUser(userId);
  const user = await storage.getUser(userId);
  await sendMessage(token, chatId, formatTutorialMenuText(tutorial, user?.city), {
    reply_markup: buildTutorialInlineButtons(tutorial),
  });
}

async function tryApplyTutorialEvent(userId: string, eventType: string): Promise<TutorialEventApiResult | null> {
  try {
    return await callInternalApi("POST", `/api/tutorial/${userId}/event`, {
      eventType,
    }) as TutorialEventApiResult;
  } catch {
    return null;
  }
}

function formatTutorialRewardText(stepContent: TutorialStepContent, city?: string | null) {
  const reward = stepContent.reward;
  const parts: string[] = [];
  const currency = getCurrencySymbol(city || "Сан-Франциско");
  if (reward.money > 0) parts.push(`+${currency}${reward.money}`);
  if (reward.xp > 0) parts.push(`+${reward.xp} XP`);
  if (reward.reputation > 0) parts.push(`+${reward.reputation} репутации`);
  return parts.length ? parts.join(", ") : "без награды";
}

function formatTutorialMenuText(snapshot: TutorialApiSnapshot, city?: string | null) {
  const step = Math.max(1, Math.min(TUTORIAL_TOTAL_STEPS, Number(snapshot.activeStep || getTutorialActiveStep(snapshot.state))));
  const stepContent = snapshot.stepContent ?? TUTORIAL_STEP_CONTENT[step] ?? TUTORIAL_STEP_CONTENT[1];
  const progress = snapshot.progressText || getTutorialProgressText(snapshot.state);
  const status = snapshot.state.isCompleted
    ? "✅ Обучение завершено"
    : snapshot.state.isActive
    ? "🟢 Обучение активно"
    : "🟡 Обучение не начато";
  const mentorText = step === 7
    ? `${stepContent.mentorText}\n\n🏦 Подсказка: биржа находится в банке.`
    : stepContent.mentorText;

  return [
    "👨‍🏫 НАСТАВНИК",
    "━━━━━━━━━━━━━━",
    status,
    progress,
    `Шаг ${step}/${TUTORIAL_TOTAL_STEPS}: ${stepContent.title}`,
    "",
    mentorText,
    "",
    `🎯 Задача: ${stepContent.task}`,
    `🎁 Награда: ${formatTutorialRewardText(stepContent, city)}`,
  ].join("\n");
}

function buildTutorialInlineButtons(snapshot: TutorialApiSnapshot) {
  const rows: Array<Array<{ text: string; callback_data: string }>> = [];

  if (snapshot.state.isCompleted) {
    return { inline_keyboard: rows };
  }

  if (!snapshot.state.isActive) {
    rows.push([{ text: "Начать обучение", callback_data: "tutorial:start" }]);
    return { inline_keyboard: rows };
  }

  const step = Math.max(1, Math.min(TUTORIAL_TOTAL_STEPS, Number(snapshot.activeStep || getTutorialActiveStep(snapshot.state))));
  if (step === 2) {
    rows.push([{ text: "💼 Начать работу", callback_data: "tutorial:open_jobs" }]);
  } else if (step === 3) {
    rows.push([{ text: "🛍 Открыть курсы", callback_data: "tutorial:open_shop_courses" }]);
  } else if (step === 4) {
    rows.push([{ text: "🎒 Открыть инвентарь", callback_data: "tutorial:open_inventory" }]);
  } else if (step === 5) {
    rows.push([{ text: "📱 Открыть гаджеты", callback_data: "tutorial:open_shop_gadgets" }]);
  } else if (step === 6) {
    rows.push([{ text: "🎒 Открыть инвентарь", callback_data: "tutorial:open_inventory" }]);
  } else if (step === 7) {
    rows.push([{ text: "📊 Открыть инвестиции", callback_data: "tutorial:open_stocks" }]);
  } else if (step === 8) {
    rows.push([{ text: "🏁 Завершить обучение", callback_data: "tutorial:complete" }]);
  }

  return { inline_keyboard: rows };
}

async function ensureHiddenTutorialWorkshop(userId: string) {
  const snapshot = await getTutorialSnapshotByUser(userId);
  if (snapshot.state.demoCompanyId) return snapshot.state.demoCompanyId;
  await callInternalApi("POST", `/api/tutorial/${userId}/demo-company`, {});
  await ensureTutorialStarterParts(userId);
  const refreshed = await getTutorialSnapshotByUser(userId);
  return refreshed.state.demoCompanyId;
}

function formatTutorialAdvanceNotice(event: TutorialEventApiResult | null, city?: string | null) {
  if (!event?.advanced) return "";
  const reward = event.reward ?? { money: 0, xp: 0, reputation: 0 };
  const rewardParts: string[] = [];
  const currency = getCurrencySymbol(city || "Сан-Франциско");
  if (reward.money > 0) rewardParts.push(`+${currency}${reward.money}`);
  if (reward.xp > 0) rewardParts.push(`+${reward.xp} XP`);
  if (reward.reputation > 0) rewardParts.push(`+${reward.reputation} репутации`);
  const rewardText = rewardParts.length ? ` Награда: ${rewardParts.join(", ")}.` : "";
  return `🎓 Обучение: ${event.progressText}. Следующий шаг: ${event.stepContent?.title ?? "см. /tutorial"}.${rewardText} Продолжи: /tutorial`;
}

async function getTutorialContinueLine(userId: string): Promise<string | null> {
  try {
    const snapshot = await getTutorialSnapshotByUser(userId);
    if (snapshot.state.isCompleted) return null;
    return "‼️ Обучение не завершено: продолжи /tutorial";
  } catch {
    return null;
  }
}

async function sendTutorialCompletionCelebration(token: string, chatId: number) {
  const caption = [
    "🏅 Обучение завершено!",
    "Ты прошёл базовый курс и получил награды за tutorial.",
    "В инвентарь добавлена медаль за обучение.",
    "Продать её можно после 5 уровня.",
  ].join("\n");

  try {
    await sendPhotoFile(token, chatId, TUTORIAL_MEDAL_IMAGE_PATH, caption);
  } catch {
    await sendMessage(token, chatId, caption);
  }
}

async function getCompanyBlueprintSnapshot(companyId: string): Promise<CompanyBlueprintSnapshot> {
  return await callInternalApi("GET", `/api/companies/${companyId}/blueprints`) as CompanyBlueprintSnapshot;
}

async function getCompanyExclusiveSnapshot(companyId: string) {
  return await callInternalApi("GET", `/api/companies/${companyId}/exclusive`) as {
    active: any;
    catalog: any[];
    produced: any[];
    productionOrder?: CompanyBlueprintSnapshot["productionOrder"] | null;
  };
}

async function getCityContracts(city: string): Promise<CityContractView[]> {
  return await callInternalApi("GET", `/api/city-contracts/${encodeURIComponent(city)}`) as CityContractView[];
}

async function getCompanyMiningStatus(companyId: string, userId: string): Promise<CompanyMiningStatusView> {
  return await callInternalApi(
    "GET",
    `/api/companies/${encodeURIComponent(companyId)}/mining/status?userId=${encodeURIComponent(userId)}`,
  ) as CompanyMiningStatusView;
}

async function startCompanyMining(companyId: string, userId: string): Promise<CompanyMiningStatusView> {
  return await callInternalApi("POST", `/api/companies/${companyId}/mining/start`, { userId }) as CompanyMiningStatusView;
}

async function claimCompanyMining(companyId: string, userId: string): Promise<{ ok: boolean; reward: CompanyMiningRewardView }> {
  return await callInternalApi("POST", `/api/companies/${companyId}/mining/claim`, { userId }) as {
    ok: boolean;
    reward: CompanyMiningRewardView;
  };
}

async function formatCompanyMenuWithMembership(input: CompanyContext) {
  const roleLabel = formatCompanyRole(input.role);
  const companyEconomy = reconcileCompanyEconomy(input.company as CompanyEconomyLike);
  const ipoProgress = getIPOProgress({
    valuationGRM: companyEconomy.valuationGRM,
    employeeCount: companyEconomy.employeeCount,
    uniqueGadgets: companyEconomy.uniqueGadgets,
    profitGRM: companyEconomy.profitGRM,
  });
  const departmentEffects = getDepartmentEffects(companyEconomy.departments);
  const capacity = Math.max(0, Number(input.company.warehouseCapacity) || 50);
  let used = 0;

  try {
    const snapshot = await getCompanyBlueprintSnapshot(input.company.id);
    used = getCompanyWarehouseUsedSlots(input.company.id, snapshot.produced.length);
  } catch {
    used = 0;
  }

  return [
    "🏢 ПРОФИЛЬ КОМПАНИИ",
    "━━━━━━━━━━━━━━",
    `🏢 Название: ${input.company.name}`,
    `🏙 Город: ${input.company.city}`,
    `👤 Ваша роль: ${roleLabel}`,
    `📍 Стадия: ${COMPANY_STAGE_LABELS[companyEconomy.stage]}`,
    "━━━━━━━━━━━━━━",
    `💰 Капитал: ${formatNumber(companyEconomy.capitalGRM)} GRM`,
    `📈 Company Level: ${companyEconomy.companyLevel} | XP: ${formatNumber(companyEconomy.companyXP)}`,
    `🏦 Valuation: ${formatNumber(companyEconomy.valuationGRM)} GRM`,
    `💹 Profit: ${formatNumber(companyEconomy.profitGRM)} GRM`,
    `👥 Сотрудники: ${companyEconomy.employeeCount}/${companyEconomy.employeeLimit}`,
    `🧩 Уникальные гаджеты: ${companyEconomy.uniqueGadgets} | Продано: ${companyEconomy.gadgetsSold}`,
    `🏭 Склад: ${used}/${capacity}`,
    `🧬 Legacy ORK: ${input.company.ork} | Legacy Level: ${input.company.level}`,
    "━━━━━━━━━━━━━━",
    `IPO: ${companyEconomy.shares.isPublic ? "Публичная компания" : companyEconomy.shares.isIPOAvailable ? "Готово к IPO" : "Подготовка"}`,
    formatIpoMetricLine("Valuation", ipoProgress.valuation.current, ipoProgress.valuation.target),
    formatIpoMetricLine("Employees", ipoProgress.employees.current, ipoProgress.employees.target),
    formatIpoMetricLine("Unique gadgets", ipoProgress.uniqueGadgets.current, ipoProgress.uniqueGadgets.target),
    formatIpoMetricLine("Profit", ipoProgress.profit.current, ipoProgress.profit.target),
    "━━━━━━━━━━━━━━",
    `Finance: инвестиции ${departmentEffects.allowsInvestments ? "доступны" : "закрыты"}, подготовка IPO ${departmentEffects.allowsIpoPreparation ? "доступна" : "закрыта"}`,
    !companyEconomy.shares.isPublic
      ? "📝 Акции: будут доступны после IPO"
      : `📊 Акции: всего ${companyEconomy.shares.totalShares}, free-float ${companyEconomy.shares.freeFloatShares}, цена ${formatNumber(companyEconomy.shares.sharePriceGRM)} GRM`,
  ].filter(Boolean).join("\n");
}

function getTopCompanies(companies: any[]) {
  return [...companies]
    .sort((a, b) => {
      const econA = reconcileCompanyEconomy(a as CompanyEconomyLike);
      const econB = reconcileCompanyEconomy(b as CompanyEconomyLike);
      return (econB.companyLevel - econA.companyLevel) || (econB.capitalGRM - econA.capitalGRM);
    })
    .slice(0, 8);
}

function formatCompanyMenuWithoutMembership(companies: any[], city: string) {
  const createCost = getCompanyCreateCostForPlayer(city);
  if (!companies.length) {
    return [
      "🏢 РЕЕСТР КОМПАНИЙ",
      "━━━━━━━━━━━━━━",
      "Пока нет ни одной компании.",
      "Создай первую и стань CEO.",
      `💸 Стоимость создания: ${createCost}`,
      "Нажми кнопку «Создать компанию».",
      "Потом бот попросит название и эмоджи компании.",
    ].join("\n");
  }

  const top = getTopCompanies(companies);

  return [
    "🏢 РЕЕСТР КОМПАНИЙ",
    "━━━━━━━━━━━━━━",
    ...top.map((company, index) => {
      const economy = reconcileCompanyEconomy(company as CompanyEconomyLike);
      return `${index + 1}. ${company.name} — company lvl ${economy.companyLevel}, ${company.city}, ${formatNumber(economy.capitalGRM)} GRM`;
    }),
    "",
    `💸 Стоимость создания: ${createCost}`,
    "Выбери компанию кнопкой ниже или нажми «Создать компанию».",
  ].join("\n");
}

function buildCompanyRegistryInlineMarkup(companies: any[]) {
  const top = getTopCompanies(companies);
  return {
    inline_keyboard: [
      ...top.map((company, index) => ([{
        text: `${index + 1}. ${company.name}`,
        callback_data: `company:join:${company.id}`,
      }])),
      [{ text: "➕ Создать компанию", callback_data: "company:create_start" }],
    ],
  };
}

function formatContractStatus(contract: CityContractView, companyId: string) {
  if (contract.status === "open") return "Открыт";
  if (contract.status === "completed") return "Завершен";
  return contract.assignedCompanyId === companyId ? "В работе (ваша компания)" : "В работе (другая компания)";
}

function formatWorkContractRequirement(contract: CityContractView) {
  if (contract.kind === "parts_supply") {
    return `Требование: ${contract.requiredPartType || "part"} x${contract.requiredQuantity} со склада компании`;
  }
  if (contract.kind === "skill_research") {
    const label = contract.requiredSkill ? (SKILL_LABELS[contract.requiredSkill] ?? contract.requiredSkill) : "навык";
    return `Требование: суммарный навык команды ${label} ${formatNumber(contract.requiredSkillPoints ?? 0)}`;
  }
  return `Категория: ${contract.category} | Нужно: ${contract.requiredQuantity} шт.\nМин. качество: ${contract.minQuality}`;
}

function buildCompanyInlineMenu(extraRows: Array<Array<{ text: string; callback_data: string }>> = []) {
  return {
    inline_keyboard: [...extraRows],
  };
}

function buildCompanyWorkInlineButtons(
  contracts: CityContractView[],
  companyId: string,
) {
  const rows: Array<Array<{ text: string; callback_data: string }>> = [];
  const actionRows = contracts
    .map((contract, index) => {
      if (contract.status === "open") {
        return [{ text: `✅ Принять #${index + 1}`, callback_data: `company:contract_accept:${index + 1}` }];
      }
      if (contract.status === "in_progress" && contract.assignedCompanyId === companyId) {
        return [{ text: `📦 Сдать #${index + 1}`, callback_data: `company:contract_deliver:${index + 1}` }];
      }
      return null;
    })
    .filter(Boolean) as Array<Array<{ text: string; callback_data: string }>>;

  rows.push(...actionRows.slice(0, 10));
  rows.push([{ text: "🔄 Обновить", callback_data: "company:work" }]);
  return buildCompanyInlineMenu(rows);
}

function buildCompanyManagementInlineButtons(isOwner: boolean) {
  const rows: Array<Array<{ text: string; callback_data: string }>> = [];
  if (isOwner) {
    rows.push([{ text: "📥 Заявки", callback_data: "company:requests" }]);
    rows.push([{ text: "💸 Зарплаты", callback_data: "company:salary_setup" }]);
    rows.push([{ text: "⬆️ Legacy апгрейд", callback_data: "company:upgrade" }, { text: "📦 Legacy склад +", callback_data: "company:expand" }]);
    rows.push([{ text: "🏛 Отделы", callback_data: "company:departments" }, { text: "🚀 IPO", callback_data: "company:ipo" }]);
    rows.push([{ text: "🗑 Удалить", callback_data: "company:delete" }]);
  } else {
    rows.push([{ text: "💰 Получить зарплату", callback_data: "company:salary_claim" }]);
    rows.push([{ text: "🚪 Выйти из компании", callback_data: "company:leave" }]);
  }
  rows.push([{ text: "🏁 Weekly Hackathon", callback_data: "company:hackathon" }]);
  return buildCompanyInlineMenu(rows);
}

function buildCompanyBureauInlineButtons(
  isOwner: boolean,
  activeStatus: string | undefined,
  miningStatus: CompanyMiningStatusView | null,
  blueprintRefs: string[] = [],
) {
  const rows: Array<Array<{ text: string; callback_data: string }>> = [];
  rows.push([{ text: "🧪 Разработка", callback_data: "company:bureau" }]);
  if (isOwner && !activeStatus && blueprintRefs.length) {
    rows.push(...blueprintRefs.slice(0, 12).map((blueprintId, index) => ([{
      text: `🪄 Чертёж ${index + 1}`,
      callback_data: `company:bp_start:${blueprintId}`,
    }])));
  }
  if (isOwner) {
    rows.push([{ text: "⚙️ Производство", callback_data: "company:bp_produce" }]);
  }
  if (miningStatus?.status === "ready_to_claim") {
    rows.push([{ text: "🎁 Добыча: забрать", callback_data: "company:mining_claim" }]);
  } else if (miningStatus?.status === "in_progress") {
    rows.push([{ text: "⏱ Добыча: проверить", callback_data: "company:mining_check" }]);
  } else {
    rows.push([{ text: "⛏ Добыча: старт", callback_data: "company:mining_start" }]);
  }
  rows.push([{ text: "🔄 Обновить бюро", callback_data: "company:bureau" }]);
  if (isOwner && activeStatus === "in_progress") {
    rows.push([{ text: "📈 Прогресс", callback_data: "company:bp_progress_live" }]);
  }
  return buildCompanyInlineMenu(rows);
}

function buildCompanyExclusiveProduceInlineMarkup(
  snapshot: Awaited<ReturnType<typeof getCompanyExclusiveSnapshot>>,
  role: string | null | undefined,
  chatId: number,
) {
  const catalog = snapshot.catalog ?? [];
  const pickRows = catalog.slice(0, 12).map((item, index) => ([{
    text: `🏭 ${index + 1}. ${item.name}`,
    callback_data: `company:exclusive_produce_pick:${item.id}`,
  }]));
  const baseInline = ((buildCompanyReplyMarkup(role, chatId) as any)?.inline_keyboard ?? []) as any[];
  return {
    inline_keyboard: [...pickRows, ...baseInline],
  };
}

function buildCompanyProductionConfirmInlineMarkup(kind: "standard" | "exclusive") {
  return {
    inline_keyboard: [
      [{ text: "✅ Запустить партию", callback_data: kind === "standard" ? "company:bp_confirm_start" : "company:exclusive_confirm_start" }],
      [{ text: "⬅️ Изменить количество", callback_data: kind === "standard" ? "company:bp_confirm_back" : "company:exclusive_confirm_back" }],
    ],
  };
}

function buildCompanyRequestsInlineButtons(requests: Array<{ id: string; username: string }>) {
  const rows = requests.slice(0, 20).map((request, index) => ([
    { text: `✅ #${index + 1}`, callback_data: `company:request_accept:${request.id}` },
    { text: `❌ #${index + 1}`, callback_data: `company:request_decline:${request.id}` },
  ]));
  rows.push([{ text: "⬅️ Назад в управление", callback_data: "company:management" }]);
  return buildCompanyInlineMenu(rows);
}

async function sendCompanyProfile(token: string, chatId: number, membership: CompanyContext) {
  await sendMessage(token, chatId, await formatCompanyMenuWithMembership(membership), {
    reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
  });
}

async function formatCompanyWorkSection(input: CompanyContext, chatId: number) {
  const contracts = await getCityContracts(input.company.city);
  companyContractRefsByChatId.set(chatId, contracts.map((contract) => contract.id));

  if (!contracts.length) {
    return {
      text: [
      "💼 РАБОТА КОМПАНИИ",
      "━━━━━━━━━━━━━━",
      "В вашем городе пока нет активных контрактов.",
      ].join("\n"),
      contracts,
    };
  }

  return {
    text: [
    "💼 РАБОТА КОМПАНИИ",
    "━━━━━━━━━━━━━━",
    `🏙 Город: ${input.company.city}`,
    ...contracts.map((contract, index) => [
      `${index + 1}. ${contract.title} — ${contract.customer}`,
      `${formatWorkContractRequirement(contract)}`,
      `Награда: ${contract.rewardMoney} GRM +${contract.rewardOrk} ORK`,
      `Статус: ${formatContractStatus(contract, input.company.id)}`,
      contract.status === "open"
        ? "Действие: принять кнопкой под сообщением."
        : contract.assignedCompanyId === input.company.id
          ? contract.kind === "parts_supply"
            ? "Действие: CEO выбирает детали кнопкой «Сдать»."
            : "Действие: сдать кнопкой под сообщением."
          : "Действие: контракт занят другой компанией.",
    ].join("\n")),
  ].join("\n\n"),
    contracts,
  };
}

async function formatCompanyWarehouseSection(input: CompanyContext, chatId?: number) {
  const snapshot = await getCompanyBlueprintSnapshot(input.company.id);
  if (snapshot.active?.status === "production_ready" && snapshot.active.blueprintId) {
    storeCompanyBlueprint(input.company.id, snapshot.active.blueprintId);
  }
  const capacity = Math.max(0, Number(input.company.warehouseCapacity) || 50);
  const warehouseParts = getCompanyWarehouseParts(input.company.id);
  const storedBlueprintIds = Array.from(getCompanyStoredBlueprintIds(input.company.id));
  const used = getCompanyWarehouseUsedSlots(input.company.id, snapshot.produced.length);
  const groupedGadgets = groupCompanyProducedGadgets(snapshot.produced ?? []);
  if (Number.isFinite(chatId)) {
    companyWarehouseGadgetRefsByChatId.set(
      Number(chatId),
      groupedGadgets.map(({ representative }) => representative.id),
    );
    companyWarehousePartRefsByChatId.set(
      Number(chatId),
      warehouseParts.map((part, index) => `p${index + 1}`),
    );
  }
  const partLabel = warehouseParts.length
    ? warehouseParts.map((part, index) => [
        formatWarehousePartLine(part, index),
        input.role === "owner" || input.role === "manager"
          ? `Аукцион: /company_auction_list p${index + 1} <цена> [часы]`
          : "",
      ].filter(Boolean).join("\n")).join("\n")
    : "Запчастей на складе нет.";
  const blueprintLabel = storedBlueprintIds.length
    ? storedBlueprintIds.map((id, index) => `${index + 1}. ${id}`).join("\n")
    : "Разработанных чертежей на складе нет.";

  return {
    text: [
    "📦 СКЛАД КОМПАНИИ",
    "━━━━━━━━━━━━━━",
    `Вместимость: ${used}/${capacity}`,
    "",
    groupedGadgets.length
      ? groupedGadgets.map(({ representative, quantity }, index) =>
          [
            `${index + 1}. ${representative.name} x${quantity}`,
            `Категория: ${representative.category} | Качество: x${formatNumber(representative.quality)}`,
            formatGadgetStatLine(representative.stats) ? `Характеристики: ${formatGadgetStatLine(representative.stats)}` : "",
            representative.exclusiveBonusLabel ? `Бонус: ${representative.exclusiveBonusLabel}` : "",
            `Цена: ${representative.minPrice}-${representative.maxPrice}`,
            input.role === "owner" || input.role === "manager"
              ? `Аукцион: /company_auction_list ${index + 1} <цена> [часы]`
              : "",
          ].filter(Boolean).join("\n")
        ).join("\n\n")
      : "Гаджетов на складе нет.",
    "",
    "🧩 Запчасти:",
    partLabel,
    "",
    "📐 Разработанные чертежи:",
    blueprintLabel,
    "",
    "Открыть перенос: /company_part_deposit",
    "Быстрый пример: /company_part_deposit 1 3",
  ].join("\n"),
    snapshot,
  };
}

async function formatCompanyBureauSection(input: CompanyContext, chatId: number, userId: string) {
  // TODO: РџРѕРґРґРµСЂР¶Р°С‚СЊ СЂРµРґРєРёРµ С‡РµСЂС‚РµР¶Рё РёР· API РЅР° РѕСЃРЅРѕРІРµ R&D lvl 4 (unlocksRareBlueprints).
  const snapshot = await getCompanyBlueprintSnapshot(input.company.id);
  if (snapshot.active?.status === "production_ready" && snapshot.active.blueprintId) {
    storeCompanyBlueprint(input.company.id, snapshot.active.blueprintId);
  }
  const companyEconomy = reconcileCompanyEconomy(input.company as CompanyEconomyLike);
  const effects = getDepartmentEffects(companyEconomy.departments);
  const developed = getDevelopedBlueprintIds(input.company.id, snapshot);
  const unlockedBlueprints = getUnlockedBlueprints(snapshot.available, developed);
  const availableIds = unlockedBlueprints.map((blueprint) => blueprint.id);
  companyBlueprintRefsByChatId.set(chatId, availableIds);

  const activeBlueprint = snapshot.active
    ? snapshot.available.find((item) => item.id === snapshot.active?.blueprintId) ?? null
    : null;
  let miningStatus: CompanyMiningStatusView | null = null;
  let exclusiveSnapshot: Awaited<ReturnType<typeof getCompanyExclusiveSnapshot>> | null = null;
  try {
    miningStatus = await getCompanyMiningStatus(input.company.id, userId);
  } catch {
    miningStatus = null;
  }
  try {
    exclusiveSnapshot = await getCompanyExclusiveSnapshot(input.company.id);
  } catch {
    exclusiveSnapshot = null;
  }
  const statusLabel = snapshot.active
    ? BLUEPRINT_STATUSES[snapshot.active.status as keyof typeof BLUEPRINT_STATUSES] ?? snapshot.active.status
    : "Не выбран";

  const requirementsLabel = (requirements: Partial<Record<"coding" | "design" | "analytics", number>> = {}) =>
    [
      requirements.coding ? `Кодинг ${requirements.coding}` : "",
      requirements.design ? `Дизайн ${requirements.design}` : "",
      requirements.analytics ? `Аналитика ${requirements.analytics}` : "",
    ].filter(Boolean).join(", ") || "без требований";

  return {
    text: [
    "🧪 БЮРО РАЗРАБОТОК",
    "━━━━━━━━━━━━━━",
    `Стадия: ${COMPANY_STAGE_LABELS[companyEconomy.stage]}`,
    `Бонус скорости Production: x${formatNumber(effects.productionSpeedMultiplier)}`,
    `Скидка Production cost: ${effects.productionCostMultiplier < 1 ? `${Math.round((1 - effects.productionCostMultiplier) * 100)}%` : "нет"}`,
    `Активный чертеж: ${activeBlueprint?.name ?? "нет"}`,
    `Статус: ${statusLabel}`,
    snapshot.productionOrder
      ? `Производство: ${snapshot.productionOrder.blueprintName} x${snapshot.productionOrder.quantity} (${snapshot.productionOrder.status === "ready_to_claim" ? "готово к выдаче" : `ещё ${formatProductionOrderRemaining(snapshot.productionOrder)}`})`
      : "Производство: нет активной партии",
    exclusiveSnapshot?.active
      ? `Эксклюзив: ${exclusiveSnapshot.active.blueprint?.name ?? "прототип"} (${exclusiveSnapshot.active.status})`
      : "Эксклюзив: нет активного прототипа",
    snapshot.active ? `Прогресс: ${snapshot.active.progressHours}ч` : "",
    activeBlueprint?.time ? `Нужно: ${activeBlueprint.time}ч` : "",
    "",
    unlockedBlueprints.length
      ? [
          "Доступные чертежи:",
          ...unlockedBlueprints.map((bp, index) =>
            `${index + 1}. ${bp.name} (${requirementsLabel(bp.requirements)})`
          ),
        ].join("\n")
      : "Нет доступных чертежей. Разработай базовую модель, чтобы открыть следующее поколение.",
    "",
    input.role === "owner"
      ? "Выбери чертёж кнопкой ниже. Эксклюзивы открываются в отдельном разделе компании."
      : "Бюро в режиме просмотра. Управление доступно CEO.",
  ].filter(Boolean).join("\n"),
    snapshot,
    miningStatus,
    blueprintRefs: availableIds,
  };
}

async function formatCompanyManagementSection(input: CompanyContext) {
  const companyEconomy = reconcileCompanyEconomy(input.company as CompanyEconomyLike);
  const members = await storage.getCompanyMembers(input.company.id);
  const memberLines = members.length
    ? members.map((member, index) => {
      const salaryLabel = `зарплата: ${getCompanyMemberSalary(String(input.company.id), member.userId, member.role)} GRM`;
      return `${index + 1}. ${member.username} (${formatCompanyRole(member.role)}, ${salaryLabel})`;
    })
    : ["Участников пока нет."];

  return {
    text: [
    "🛠 УПРАВЛЕНИЕ КОМПАНИЕЙ",
    "━━━━━━━━━━━━━━",
    `Компания: ${input.company.name}`,
    `Роль: ${formatCompanyRole(input.role)}`,
    `Лимит сотрудников: ${companyEconomy.employeeLimit}`,
    `Капитал: ${formatNumber(companyEconomy.capitalGRM)} GRM`,
    "",
    "👥 Состав:",
    ...memberLines,
    "",
    input.role === "owner"
      ? "Разделы: HR, зарплаты, отделы, пополнение GRM и IPO."
      : "В этом разделе доступны зарплата и обзор компании.",
  ].join("\n"),
    members,
  };
}

async function formatCompanySalariesSection(input: CompanyContext, chatId: number) {
  const members = await storage.getCompanyMembers(input.company.id);
  companyMemberRefsByChatId.set(chatId, members.map((member) => member.userId));
  const lines = members.length
    ? members.map((member, index) => {
      const salary = getCompanyMemberSalary(String(input.company.id), member.userId, member.role);
      return `${index + 1}. ${member.username} (${formatCompanyRole(member.role)})\nЗарплата: ${salary} GRM`;
    })
    : ["Сотрудников пока нет."];

  return [
    "💸 ЗАРПЛАТЫ КОМПАНИИ",
    "━━━━━━━━━━━━━━",
    `Компания: ${input.company.name}`,
    ...lines,
    "",
    input.role === "owner"
      ? "Выбери сотрудника кнопкой ниже, затем бот попросит сумму."
      : "Получить выплату можно кнопкой ниже.",
  ].join("\n\n");
}

function buildCompanySalariesInlineMarkup(input: CompanyContext, chatId: number) {
  const memberRefs = companyMemberRefsByChatId.get(chatId) ?? [];
  const rows = memberRefs
    .map((userId, index) => ({ userId, index }))
    .filter(({ userId }) => Boolean(userId));

  const memberButtons = rows.map(({ userId, index }) => [{
    text: `💸 ${index + 1}`,
    callback_data: `company:salary_pick:${userId}`,
  }]);

  const baseInline = ((buildCompanyReplyMarkup(input.role, chatId) as any)?.inline_keyboard ?? []) as any[];
  const extraRows = input.role === "owner"
    ? memberButtons
    : [[{ text: "💰 Получить зарплату", callback_data: "company:salary_claim" }]];
  return {
    inline_keyboard: [...extraRows, ...baseInline],
  };
}

async function formatCompanyStaffingSection(input: CompanyContext, chatId: number) {
  const payload = await callInternalApi("GET", `/api/companies/${input.company.id}/staffing`) as {
    staffing: {
      members: Array<{
        userId: string;
        username: string;
        professionId?: string | null;
        assignedDepartment?: string | null;
        preferredDepartment?: string | null;
      }>;
    };
  };
  const members = payload.staffing?.members ?? [];
  companyMemberRefsByChatId.set(chatId, members.map((member) => member.userId));
  return [
    "👥 HR / ДОЛЖНОСТИ",
    "━━━━━━━━━━━━━━",
    ...members.map((member, index) => {
      const profession = getProfessionById(member.professionId ?? undefined);
      const departmentKey = member.assignedDepartment || member.preferredDepartment || "";
      const department = departmentKey && isCompanyDepartmentKey(departmentKey)
        ? DEPARTMENT_LABELS[departmentKey]
        : "не назначен";
      return `${index + 1}. ${member.username}\nПрофессия: ${profession ? `${profession.emoji} ${profession.name}` : "не выбрана"}\nОтдел: ${department}`;
    }),
    "",
    "Выбери сотрудника кнопкой ниже, затем выбери отдел.",
  ].join("\n\n");
}

function buildCompanyStaffingInlineMarkup(chatId: number, role: string | null | undefined) {
  const memberRefs = companyMemberRefsByChatId.get(chatId) ?? [];
  const memberButtons = memberRefs.map((userId, index) => ([{
    text: `👤 ${index + 1}`,
    callback_data: `company:staff_pick:${userId}`,
  }]));
  const baseInline = ((buildCompanyReplyMarkup(role, chatId) as any)?.inline_keyboard ?? []) as any[];
  return {
    inline_keyboard: [...memberButtons, ...baseInline],
  };
}

function buildCompanyDepartmentSelectInlineMarkup(userId: string, role: string | null | undefined, chatId: number) {
  const deptRows = COMPANY_DEPARTMENT_ORDER.map((departmentKey) => ([{
    text: `${COMPANY_DEPARTMENT_EMOJIS[departmentKey]} ${DEPARTMENT_LABELS[departmentKey]}`,
    callback_data: `company:staff_assign:${userId}:${departmentKey}`,
  }]));
  const baseInline = ((buildCompanyReplyMarkup(role, chatId) as any)?.inline_keyboard ?? []) as any[];
  return {
    inline_keyboard: [...deptRows, ...baseInline],
  };
}

const COMPANY_CONTRACT_PARTS_PAGE_SIZE = 12;
const COMPANY_EXCLUSIVE_PARTS_PAGE_SIZE = 12;

function buildCompanyContractPartsSummary(contract: CityContractView, companyId: string, chatId: number) {
  const unitRefs = getCompanyWarehousePartUnitRefs(companyId, contract.requiredPartType);
  companyContractPartRefsByChatId.set(chatId, unitRefs.map((item) => item.ref));
  const selectedRefs = (companyContractSelectedPartRefsByChatId.get(chatId) ?? []).filter((ref) =>
    unitRefs.some((item) => item.ref === ref),
  );
  companyContractSelectedPartRefsByChatId.set(chatId, selectedRefs);
  const totalPages = Math.max(1, Math.ceil(unitRefs.length / COMPANY_CONTRACT_PARTS_PAGE_SIZE));
  const currentPage = Math.max(0, Math.min(totalPages - 1, companyContractPartPageByChatId.get(chatId) ?? 0));
  companyContractPartPageByChatId.set(chatId, currentPage);
  const pageStart = currentPage * COMPANY_CONTRACT_PARTS_PAGE_SIZE;
  const pageItems = unitRefs.slice(pageStart, pageStart + COMPANY_CONTRACT_PARTS_PAGE_SIZE);
  const selectedText = selectedRefs.length
    ? selectedRefs.map((ref, index) => {
        const item = unitRefs.find((entry) => entry.ref === ref);
        return item ? `${index + 1}. ${formatWarehousePartLine({ ...item, quantity: 1 })}` : `${index + 1}. ${ref}`;
      }).join("\n")
    : "Пока ничего не выбрано.";

  return {
    unitRefs,
    selectedRefs,
    totalPages,
    currentPage,
    pageStart,
    pageItems,
    selectedText,
  };
}

function buildCompanyContractPartsInlineMarkup(chatId: number, requiredQuantity: number) {
  const refs = companyContractPartRefsByChatId.get(chatId) ?? [];
  const selectedRefs = companyContractSelectedPartRefsByChatId.get(chatId) ?? [];
  const totalPages = Math.max(1, Math.ceil(refs.length / COMPANY_CONTRACT_PARTS_PAGE_SIZE));
  const currentPage = Math.max(0, Math.min(totalPages - 1, companyContractPartPageByChatId.get(chatId) ?? 0));
  const pageStart = currentPage * COMPANY_CONTRACT_PARTS_PAGE_SIZE;
  const pageRefs = refs.slice(pageStart, pageStart + COMPANY_CONTRACT_PARTS_PAGE_SIZE);
  const rows: Array<Array<{ text: string; callback_data: string }>> = [];

  for (let index = 0; index < pageRefs.length; index += 2) {
    const slice = pageRefs.slice(index, index + 2);
    rows.push(
      slice.map((ref, localIndex) => {
        const partNumber = pageStart + index + localIndex + 1;
        return {
          text: `${selectedRefs.includes(ref) ? "✅" : "▫️"} Деталь ${partNumber}`,
          callback_data: `company:contract_part_toggle:${partNumber}`,
        };
      }),
    );
  }

  if (totalPages > 1) {
    rows.push([
      { text: "⬅️", callback_data: `company:contract_part_page:${Math.max(0, currentPage - 1)}` },
      { text: `📄 ${currentPage + 1}/${totalPages}`, callback_data: "company:contract_part_page:stay" },
      { text: "➡️", callback_data: `company:contract_part_page:${Math.min(totalPages - 1, currentPage + 1)}` },
    ]);
  }

  rows.push([
    { text: `📦 Сдать детали (${selectedRefs.length}/${requiredQuantity})`, callback_data: "company:contract_part_done" },
    { text: "♻️ Сброс", callback_data: "company:contract_part_reset" },
  ]);
  rows.push([{ text: "⬅️ Назад", callback_data: "company:contract_part_back" }]);

  return { inline_keyboard: rows };
}

async function sendCompanyContractPartsPicker(
  token: string,
  chatId: number,
  membership: CompanyContext,
  contract: CityContractView,
  messageId?: number,
) {
  const summary = buildCompanyContractPartsSummary(contract, membership.company.id, chatId);
  const partsText = summary.pageItems.length
    ? summary.pageItems.map((item, index) => formatWarehousePartLine({ ...item, quantity: 1 }, summary.pageStart + index)).join("\n")
    : "На складе компании нет подходящих запчастей.";
  const text = [
    `📦 СДАЧА КОНТРАКТА: ${contract.title}`,
    `Нужно сдать: ${contract.requiredQuantity} шт. типа ${contract.requiredPartType || "part"}`,
    "CEO сам выбирает, какие запчасти отправить со склада компании.",
    "",
    "Подходящие детали:",
    partsText,
    summary.unitRefs.length > COMPANY_CONTRACT_PARTS_PAGE_SIZE ? `Страница: ${summary.currentPage + 1}/${summary.totalPages}` : "",
    "",
    `Выбрано: ${summary.selectedRefs.length}/${contract.requiredQuantity}`,
    summary.selectedText,
    "",
    `Награда: ${formatNumber(contract.rewardMoney)} GRM +${contract.rewardOrk} ORK`,
  ].filter(Boolean).join("\n");

  const reply_markup = buildCompanyContractPartsInlineMarkup(chatId, contract.requiredQuantity);
  if (messageId) {
    await callTelegramApi(token, "editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text,
      reply_markup,
    });
    return;
  }
  await sendMessage(token, chatId, text, { reply_markup });
}

async function formatCompanyExclusiveSection(input: CompanyContext, playerId: string, chatId: number) {
  const snapshot = await getCompanyExclusiveSnapshot(input.company.id);
  const warehouseParts = getCompanyWarehouseParts(input.company.id);
  const refs = warehouseParts.map((item) => `${item.id}::${item.rarity}`);
  companyExclusivePartRefsByChatId.set(chatId, refs);
  const selectedRefs = (companyExclusiveSelectedPartRefsByChatId.get(chatId) ?? []).filter((ref) => refs.includes(ref));
  companyExclusiveSelectedPartRefsByChatId.set(chatId, selectedRefs);
  const totalPages = Math.max(1, Math.ceil(warehouseParts.length / COMPANY_EXCLUSIVE_PARTS_PAGE_SIZE));
  const currentPage = Math.max(0, Math.min(totalPages - 1, companyExclusivePartPageByChatId.get(chatId) ?? 0));
  companyExclusivePartPageByChatId.set(chatId, currentPage);
  const pageStart = currentPage * COMPANY_EXCLUSIVE_PARTS_PAGE_SIZE;
  const pageItems = warehouseParts.slice(pageStart, pageStart + COMPANY_EXCLUSIVE_PARTS_PAGE_SIZE);
  const isPickingParts = pendingActionByChatId.get(chatId)?.type === "company_exclusive_parts";
  const research = getExclusiveResearchState(snapshot.active);

  const activeText = snapshot.active
    ? [
        `Активный прототип: ${snapshot.active.blueprint?.name ?? "без имени"}`,
        `Статус: ${snapshot.active.status === "in_progress" ? "идёт исследование" : snapshot.active.status === "production_ready" ? "готов к выпуску" : "провал"}`,
        `Общая готовность: ${research.percent}%`,
        `Участники исследования: ${Array.isArray(snapshot.active.participantUserIds) ? snapshot.active.participantUserIds.length : 1}`,
        ...EXCLUSIVE_RESEARCH_SKILLS.map((skill) => {
          const required = Math.max(0, Number(research.required[skill] ?? 0));
          if (required <= 0) return "";
          const invested = Math.min(required, Math.max(0, Number(research.invested[skill] ?? 0)));
          return `${getExclusiveResearchLabel(skill)}: ${formatNumber(invested)}/${formatNumber(required)}`;
        }).filter(Boolean),
        `Шанс успеха: ${Math.round(Number(snapshot.active.blueprint?.successChance || 0) * 100)}%`,
        `Стоимость запуска: ${formatNumber(Number(snapshot.active.blueprint?.developmentCostGrm || 0))} GRM`,
        `Бонус: ${snapshot.active.blueprint?.bonusLabel ?? "—"}`,
      ].join("\n")
    : "Активной эксклюзивной разработки нет.";

  const productionText = snapshot.productionOrder?.isExclusive
    ? `Активная партия: ${snapshot.productionOrder.blueprintName} x${snapshot.productionOrder.quantity} (${snapshot.productionOrder.status === "ready_to_claim" ? "готово к выдаче" : `ещё ${formatProductionOrderRemaining(snapshot.productionOrder)}`})`
    : "Активной партии эксклюзивов нет.";

  const catalogText = snapshot.catalog?.length
    ? snapshot.catalog.map((item, index) =>
        `${index + 1}. ${item.name}\n${item.flavor}\nБонус: ${item.bonusLabel}\nЛимит: ${item.remainingUnits}/${item.totalUnits} | Выпуск: ${item.productionCostGram} GRM`
      ).join("\n\n")
    : "Готовых эксклюзивных чертежей пока нет.";

  const partsText = warehouseParts.length
    ? pageItems.map((item, index) => formatWarehousePartLine(item, pageStart + index)).join("\n")
    : "На складе компании нет деталей.";
  const selectedText = selectedRefs.length
    ? selectedRefs
      .map((ref) => {
        const index = refs.indexOf(ref);
        const item = index >= 0 ? warehouseParts[index] : null;
        return item ? `${index + 1}. ${item.name}` : ref;
      })
      .join("\n")
    : "Пока ничего не выбрано.";

  return [
    "🌟 ЭКСКЛЮЗИВНЫЕ ГАДЖЕТЫ",
    "━━━━━━━━━━━━━━",
    activeText,
    "",
    productionText,
    "",
    "Лимитная линейка:",
    catalogText,
    "",
    `Баланс компании: ${formatNumber(Number(input.company.balance || 0))} GRM`,
    "",
    "Детали склада компании:",
    partsText,
    warehouseParts.length > COMPANY_EXCLUSIVE_PARTS_PAGE_SIZE ? `Страница: ${currentPage + 1}/${totalPages}` : "",
    "",
    `Выбрано деталей: ${selectedRefs.length}/6`,
    selectedText,
    "",
    isPickingParts
      ? "Выбор деталей: кнопками под сообщением."
      : "Кнопки ниже: Старт / Прогресс / Выпуск",
    isPickingParts
      ? "Когда выберешь 3-6 деталей, нажми «🚀 Готово» или «⬅️ Назад»."
      : "Для запуска разработки сначала укажи название прототипа.",
  ].join("\n");
}

function formatExclusiveBlueprintSummary(blueprint: any) {
  if (!blueprint) return "Характеристики: —";
  const statLabels: Record<string, string> = {
    performance: "Производительность",
    efficiency: "Эффективность",
    design: "Дизайн",
    reliability: "Надёжность",
  };
  const statText = Object.entries(blueprint.baseStats || {})
    .map(([key, value]) => `+${formatNumber(Number(value || 0))} ${statLabels[key] || key}`)
    .join(", ");
  return [
    `Характеристики: ${statText || "—"}`,
    `Бонус: ${blueprint.bonusLabel || "—"}`,
    `Шанс успеха: ${Math.round(Number(blueprint.successChance || 0) * 100)}%`,
    `Запуск: ${formatNumber(Number(blueprint.developmentCostGrm || 0))} GRM компании`,
    `Нужно вложить навыков: ${formatNumber(Number(getExclusiveResearchState({ blueprint, status: "in_progress", progressHours: 0, startedAt: Date.now() }).totalRequired || 0))}`,
  ].join("\n");
}

function formatExclusiveProgressLiveText(project: any) {
  const research = getExclusiveResearchState(project);
  const total = Math.max(1, Number(research.totalRequired || 1));
  const done = Math.max(0, Number(research.totalInvested || 0));
  const lastContribution = project?.lastContribution || {};
  return [
    "🌟 РАЗРАБОТКА РЕДКОГО ГАДЖЕТА",
    "━━━━━━━━━━━━━━",
    `Прототип: ${project?.blueprint?.name ?? "без имени"}`,
    `Прогресс: ${formatProgressBar(done, total)} ${formatNumber(done)}/${formatNumber(total)}`,
    ...EXCLUSIVE_RESEARCH_SKILLS.map((skill) => {
      const required = Math.max(0, Number(research.required[skill] ?? 0));
      if (required <= 0) return "";
      const invested = Math.min(required, Math.max(0, Number(research.invested[skill] ?? 0)));
      const delta = Math.max(0, Number(lastContribution[skill] ?? 0));
      return `${getExclusiveResearchLabel(skill)}: ${formatNumber(invested)}/${formatNumber(required)}${delta > 0 ? ` (+${formatNumber(delta)})` : ""}`;
    }).filter(Boolean),
    `Участники исследования: ${Array.isArray(project?.participantUserIds) ? project.participantUserIds.length : 1}`,
    `Вкладов сделано: ${Math.max(0, Number(project?.progressTicks || 0))}`,
    formatExclusiveBlueprintSummary(project?.blueprint),
  ].join("\n");
}

function buildCompanyExclusivePartsInlineMarkup(chatId: number) {
  const refs = companyExclusivePartRefsByChatId.get(chatId) ?? [];
  const selectedRefs = companyExclusiveSelectedPartRefsByChatId.get(chatId) ?? [];
  const totalPages = Math.max(1, Math.ceil(refs.length / COMPANY_EXCLUSIVE_PARTS_PAGE_SIZE));
  const currentPage = Math.max(0, Math.min(totalPages - 1, companyExclusivePartPageByChatId.get(chatId) ?? 0));
  const pageStart = currentPage * COMPANY_EXCLUSIVE_PARTS_PAGE_SIZE;
  const pageRefs = refs.slice(pageStart, pageStart + COMPANY_EXCLUSIVE_PARTS_PAGE_SIZE);
  const rows: Array<Array<{ text: string; callback_data: string }>> = [];

  for (let index = 0; index < pageRefs.length; index += 2) {
    const slice = pageRefs.slice(index, index + 2);
    rows.push(
      slice.map((ref, localIndex) => {
        const partNumber = pageStart + index + localIndex + 1;
        const selected = selectedRefs.includes(ref);
        return {
          text: `${selected ? "✅" : "▫️"} Деталь ${partNumber}`,
          callback_data: `company:exclusive_part_toggle:${partNumber}`,
        };
      }),
    );
  }

  if (totalPages > 1) {
    rows.push([
      { text: "⬅️", callback_data: `company:exclusive_part_page:${Math.max(0, currentPage - 1)}` },
      { text: `📄 ${currentPage + 1}/${totalPages}`, callback_data: "company:exclusive_part_page:stay" },
      { text: "➡️", callback_data: `company:exclusive_part_page:${Math.min(totalPages - 1, currentPage + 1)}` },
    ]);
  }

  rows.push([
    { text: "🚀 Готово", callback_data: "company:exclusive_part_done" },
    { text: "♻️ Сброс", callback_data: "company:exclusive_part_reset" },
  ]);
  rows.push([{ text: "⬅️ Назад", callback_data: "company:exclusive_part_back" }]);

  return { inline_keyboard: rows };
}

function buildExclusiveJoinInlineMarkup(companyId: string) {
  return {
    inline_keyboard: [[{ text: "🤝 Присоединиться к разработке", callback_data: `company:exclusive_join:${companyId}` }]],
  };
}

async function sendCompanyExclusivePartsPicker(
  token: string,
  chatId: number,
  membership: CompanyContext,
  playerId: string,
  gadgetName: string,
  messageId?: number,
) {
  const text = [
    `🧩 Прототип: ${gadgetName}`,
    "Выбирай детали кнопками ниже.",
    "Когда наберёшь 3-6 деталей, нажми «Готово».",
    "",
    await formatCompanyExclusiveSection(membership, playerId, chatId),
  ].join("\n");

  const reply_markup = buildCompanyExclusivePartsInlineMarkup(chatId);

  if (messageId) {
    await callTelegramApi(token, "editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text,
      reply_markup,
    });
    return;
  }

  await sendMessage(token, chatId, text, { reply_markup });
}

async function startCompanyExclusiveDevelopment(
  token: string,
  chatId: number,
  membership: CompanyContext,
  playerId: string,
  gadgetName: string,
  selectedRefs: string[],
) {
  let selectedSeedParts: Array<{ id: string; rarity: RarityName; type: any; name: string }> = [];
  try {
    selectedSeedParts = removeCompanyWarehousePartsByRefs(membership.company.id, selectedRefs);
  } catch (error) {
    await sendMessage(token, chatId, `❌ ${extractErrorMessage(error)}`, {
      reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
    });
    return;
  }

  pendingActionByChatId.delete(chatId);
  companyExclusiveSelectedPartRefsByChatId.delete(chatId);
  companyExclusivePartRefsByChatId.delete(chatId);
  companyExclusivePartPageByChatId.delete(chatId);

  await sendMessage(
    token,
    chatId,
    `🧠 Анализируем детали для "${gadgetName}"...\nСобираем будущие характеристики прототипа.`,
    { reply_markup: buildCompanyReplyMarkup(membership.role, chatId) },
  );

  try {
    const project = await callInternalApi("POST", `/api/companies/${membership.company.id}/exclusive/start`, {
      userId: playerId,
      name: gadgetName,
      partRefs: selectedRefs,
      seedParts: selectedSeedParts,
    }) as any;
    await sendMessage(
      token,
      chatId,
      `🧠 Анализ завершён для "${gadgetName}".\nДля эксклюзивного гаджета рассчитаны тяжёлые требования по навыкам. Нажимай «Прогресс», чтобы вкладывать экспертизу CEO в исследование.\n\n${formatExclusiveProgressLiveText(project)}`,
      { reply_markup: buildCompanyReplyMarkup(membership.role, chatId) },
    ) as { message_id?: number };
    const members = await storage.getCompanyMembers(membership.company.id);
    for (const member of members) {
      if (member.userId === playerId) continue;
      const telegramId = Number(getTelegramIdByUserId(member.userId) || 0);
      if (!telegramId) continue;
      try {
        await sendMessage(
          token,
          telegramId,
          [
            "🌟 В компании началась разработка эксклюзивного гаджета",
            `Компания: ${membership.company.name}`,
            `Прототип: ${gadgetName}`,
            "CEO запустил исследование. Можешь присоединиться и вложить свои навыки в разработку.",
          ].join("\n"),
          { reply_markup: buildExclusiveJoinInlineMarkup(membership.company.id) },
        );
      } catch {
        // ignore per-user delivery issues
      }
    }
  } catch (error) {
    restoreCompanyWarehouseSeedParts(membership.company.id, selectedSeedParts);
    await sendMessage(token, chatId, `❌ ${extractErrorMessage(error)}`, {
      reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
    });
  }
}

async function startCompanyBlueprintDevelopment(
  token: string,
  chatId: number,
  membership: CompanyContext,
  player: User,
  ref: string,
) {
  const snapshot = await getCompanyBlueprintSnapshot(membership.company.id);
  const developed = getDevelopedBlueprintIds(membership.company.id, snapshot);
  const unlockedBlueprints = getUnlockedBlueprints(snapshot.available, developed);
  companyBlueprintRefsByChatId.set(chatId, unlockedBlueprints.map((item) => item.id));
  const blueprint = resolveBlueprintRef(chatId, ref, unlockedBlueprints);
  if (!blueprint) {
    await sendMessage(token, chatId, "Чертеж не найден или пока не разблокирован. Открой раздел «Бюро» и выбери вариант кнопкой.", {
      reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
    });
    return;
  }
  const ceoSnapshot = await getUserWithGameState(player.id);
  const ceoSkills = (((ceoSnapshot?.game as GameView | undefined)?.skills) ?? {}) as Partial<Record<"coding" | "design" | "analytics", number>>;
  const required = {
    coding: Math.max(0, Number(blueprint.requirements?.coding ?? 0)),
    design: Math.max(0, Number(blueprint.requirements?.design ?? 0)),
    analytics: Math.max(0, Number(blueprint.requirements?.analytics ?? 0)),
  };
  const participants = new Set<string>();
  if (
    (required.coding > 0 && Number(ceoSkills?.coding ?? 0) > 0)
    || (required.design > 0 && Number(ceoSkills?.design ?? 0) > 0)
    || (required.analytics > 0 && Number(ceoSkills?.analytics ?? 0) > 0)
  ) {
    participants.add(player.id);
  }
  companyBlueprintContribByCompanyId.set(membership.company.id, {
    blueprintId: blueprint.id,
    required,
    invested: { coding: 0, design: 0, analytics: 0 },
    participants,
    completed: false,
  });

  try {
    const started = await callInternalApi("POST", `/api/companies/${membership.company.id}/blueprints/start`, {
      userId: player.id,
      blueprintId: blueprint.id,
    }) as { status?: string };

    const progressMessage = await sendMessage(
      token,
      chatId,
      [
        `✅ Запущена разработка: ${blueprint.name}`,
        "Участники компании могут присоединиться и вкладывать навыки каждую секунду.",
      ].join("\n"),
    );
    const progressMessageId = Number(progressMessage?.message_id);
    if (Number.isFinite(progressMessageId)) {
      companyBlueprintProgressMessageByChatId.set(chatId, progressMessageId);
      await updateCompanyBlueprintProgressMessage(
        token,
        chatId,
        membership.company.name,
        membership.company.id,
        player.id,
      );
      if ((started?.status || "in_progress") === "in_progress") {
        startCompanyBlueprintProgressTicker(
          token,
          chatId,
          membership.company.name,
          membership.company.id,
          player.id,
        );
        await notifyCompanyMembersAboutBlueprintStart(
          token,
          membership.company.id,
          membership.company.name,
          blueprint.name,
        );
      }
    }
  } catch (error) {
    companyBlueprintContribByCompanyId.delete(membership.company.id);
    await sendMessage(token, chatId, `❌ ${extractErrorMessage(error)}`);
  }
}

function formatExclusiveProduceMenu(snapshot: Awaited<ReturnType<typeof getCompanyExclusiveSnapshot>>) {
  const catalog = snapshot.catalog ?? [];
  if (!catalog.length) {
    return "🏭 ВЫПУСК ЭКСКЛЮЗИВОВ\n━━━━━━━━━━━━━━\nГотовых эксклюзивных чертежей пока нет.";
  }
  return [
    "🏭 ВЫПУСК ЭКСКЛЮЗИВОВ",
    "━━━━━━━━━━━━━━",
    ...catalog.map((item, index) => [
      `${index + 1}. ${item.name}`,
      `Нужно запчастей: ${Math.max(1, Number(item.seedParts?.length || 0))}`,
      `Нужно GRM компании: ${item.productionCostGram}`,
      `Время производства: ~${Math.max(5, Math.floor(Number(item.seedParts?.length || 1) * 6))} сек.`,
      `Лимит: ${item.remainingUnits}/${item.totalUnits}`,
    ].join("\n")),
    "",
    "Выбери чертёж кнопкой ниже.",
  ].join("\n\n");
}

function resolveWarehouseGadgetRefFromChat(chatId: number, ref: string) {
  const trimmed = ref.trim();
  if (!/^\d+$/.test(trimmed)) return trimmed;
  const refs = companyWarehouseGadgetRefsByChatId.get(chatId) ?? [];
  const index = Number(trimmed) - 1;
  return index >= 0 && index < refs.length ? refs[index] : trimmed;
}

function resolveWarehousePartRefFromChat(chatId: number, ref: string) {
  const trimmed = ref.trim().toLowerCase();
  const match = trimmed.match(/^p(\d+)$/i);
  if (!match) return null;
  const refs = companyWarehousePartRefsByChatId.get(chatId) ?? [];
  const index = Number(match[1]) - 1;
  return index >= 0 && index < refs.length ? refs[index] : null;
}

function resolveMarketListingRefFromChat(chatId: number, ref: string) {
  const trimmed = ref.trim();
  if (!/^\d+$/.test(trimmed)) return trimmed;
  const refs = marketListingRefsByChatId.get(chatId) ?? [];
  const index = Number(trimmed) - 1;
  return index >= 0 && index < refs.length ? refs[index] : trimmed;
}

async function formatAuctionSection(userId: string, chatId: number) {
  const listings = await callInternalApi("GET", "/api/market") as any[];
  marketListingRefsByChatId.set(chatId, listings.map((listing) => String(listing.id)));
  if (!listings.length) {
    return "🏷 АУКЦИОН\n━━━━━━━━━━━━━━\nАктивных лотов пока нет.";
  }
  const membership = await getPlayerCompanyContext(userId);
  return [
    "🏷 АУКЦИОН",
    "━━━━━━━━━━━━━━",
    ...listings.map((listing, index) => {
      const ownEarlyAccess = Date.now() - Number(listing.createdAt || 0) < 5 * 60 * 1000;
      const lockedText = ownEarlyAccess && membership?.company?.id !== listing.companyId
        ? "Первые 5 минут: только для компании-разработчика"
        : "";
      const title = listing.listingKind === "part"
        ? stripLeadingRarityBadgeFromName(String(listing.part?.name || listing.partName || "Запчасть"))
        : String(listing.gadget?.name || "Гаджет");
      return [
        `${index + 1}. ${title}`,
        `Компания: ${listing.companyName}`,
        listing.listingKind === "part"
          ? `Лот: запчасть ${formatRarityBadge(String(listing.part?.rarity || listing.partRarity || "Common"))}`
          : `Качество: x${formatNumber(Number(listing.gadget?.quality || 1))}`,
        `Тип: ${listing.saleType === "auction" ? "Аукцион" : "Фиксированная цена"}`,
        formatGadgetStatLine(listing.gadget?.stats) ? `Характеристики: ${formatGadgetStatLine(listing.gadget?.stats)}` : "",
        listing.listingKind === "part" && listing.part?.type ? `Категория: ${listing.part.type}` : "",
        listing.gadget?.exclusiveBonusLabel ? `Бонус: ${listing.gadget.exclusiveBonusLabel}` : "",
        listing.saleType === "auction"
          ? `Текущая ставка: ${formatNumber(Number(listing.currentBid || listing.startingPrice || 0))} GRM`
          : `Цена: ${formatNumber(Number(listing.price || 0))} GRM`,
        lockedText,
        listing.saleType === "auction"
          ? "Сделать ставку можно через кнопку или диалог аукциона."
          : "Покупка доступна через кнопку или диалог аукциона.",
      ].filter(Boolean).join("\n");
    }),
  ].join("\n\n");
}

async function buildAuctionInlineMarkup(userId: string, chatId: number) {
  const listings = await callInternalApi("GET", "/api/market") as any[];
  marketListingRefsByChatId.set(chatId, listings.map((listing) => String(listing.id)));
  const membership = await getPlayerCompanyContext(userId);
  const rows = listings.flatMap((listing, index) => {
    const ownEarlyAccess = Date.now() - Number(listing.createdAt || 0) < 5 * 60 * 1000;
    const locked = ownEarlyAccess && membership?.company?.id !== listing.companyId;
    if (locked) return [[{ text: `🔒 ${index + 1}. Недоступно`, callback_data: "auction:locked" }]];
    if (listing.saleType === "auction") {
      return [[{ text: `💸 Ставка на лот ${index + 1}`, callback_data: `auction:bid:${listing.id}` }]];
    }
    return [[{ text: `🛒 Купить лот ${index + 1}`, callback_data: `auction:buy:${listing.id}` }]];
  });
  return { inline_keyboard: rows };
}

async function formatCompanyDepartmentsSection(input: CompanyContext) {
  const companyEconomy = reconcileCompanyEconomy(input.company as CompanyEconomyLike);
  const lines = COMPANY_DEPARTMENT_ORDER.map((departmentKey, index) => {
    const status = formatCompanyDepartmentStatus(companyEconomy, departmentKey);
    const nextCostLabel = status.nextCost === null ? "макс" : `${formatNumber(status.nextCost)} GRM`;
    return [
      `${index + 1}. ${COMPANY_DEPARTMENT_EMOJIS[departmentKey]} ${DEPARTMENT_LABELS[departmentKey]} — ур. ${status.currentLevel}/4`,
      `След. бонус: ${status.nextBonus}`,
      `Стоимость: ${nextCostLabel}`,
      `Статус: ${status.status}`,
      "Апгрейд: кнопкой ниже",
    ].join("\n");
  });

  return {
    text: [
      "🏛 ОТДЕЛЫ КОМПАНИИ",
      "━━━━━━━━━━━━━━",
      `Стадия: ${COMPANY_STAGE_LABELS[companyEconomy.stage]} (макс уровень отдела ${companyEconomy.stage === "startup" ? 1 : companyEconomy.stage === "private" ? 2 : companyEconomy.stage === "pre_ipo" ? 3 : 4})`,
      `Капитал: ${formatNumber(companyEconomy.capitalGRM)} GRM`,
      "",
      ...lines,
      "",
      input.role === "owner"
        ? "Апгрейды доступны кнопками ниже."
        : "Управление отделами доступно CEO.",
    ].join("\n\n"),
    companyEconomy,
  };
}

function buildCompanyDepartmentsInlineButtons(
  companyEconomy: CompanyEconomyState,
  isOwner: boolean,
) {
  const rows: Array<Array<{ text: string; callback_data: string }>> = [];
  if (isOwner) {
    for (const departmentKey of COMPANY_DEPARTMENT_ORDER) {
      const check = getDepartmentUpgradeCheck(companyEconomy, departmentKey);
      const currentLevel = companyEconomy.departments[departmentKey];
      const buttonLabel = check.canUpgrade
        ? `⬆️ ${DEPARTMENT_LABELS[departmentKey]} (${currentLevel}→${currentLevel + 1})`
        : `⛔ ${DEPARTMENT_LABELS[departmentKey]} (${currentLevel}/4)`;
      rows.push([{ text: buttonLabel, callback_data: `company:dept_upgrade:${departmentKey}` }]);
    }
  }
  rows.push([{ text: "🔄 Обновить отделы", callback_data: "company:departments" }]);
  return buildCompanyInlineMenu(rows);
}

async function formatCompanyIpoSection(input: CompanyContext) {
  const companyEconomy = reconcileCompanyEconomy(input.company as CompanyEconomyLike);
  // TODO: Р”РѕР±Р°РІРёС‚СЊ РѕС‚РґРµР»СЊРЅС‹Р№ СЂР°Р·РґРµР» Р±РёСЂР¶Рё СЃ РїРѕРєСѓРїРєРѕР№/РїСЂРѕРґР°Р¶РµР№ Р°РєС†РёР№ РІ С‚РµРєСЃС‚РѕРІРѕРј Р±РѕС‚Рµ.
  const ipoProgress = getIPOProgress({
    valuationGRM: companyEconomy.valuationGRM,
    employeeCount: companyEconomy.employeeCount,
    uniqueGadgets: companyEconomy.uniqueGadgets,
    profitGRM: companyEconomy.profitGRM,
  });
  const ipoCheck = canRunIPO(companyEconomy);
  const isPublic = companyEconomy.shares.isPublic || companyEconomy.stage === "public";

  return {
    text: [
      "🚀 IPO И АКЦИИ",
      "━━━━━━━━━━━━━━",
      `Стадия: ${COMPANY_STAGE_LABELS[companyEconomy.stage]}`,
      `Valuation: ${formatNumber(companyEconomy.valuationGRM)} GRM`,
      `Profit: ${formatNumber(companyEconomy.profitGRM)} GRM`,
      `Сотрудники: ${companyEconomy.employeeCount}/${companyEconomy.employeeLimit}`,
      `Уникальные гаджеты: ${companyEconomy.uniqueGadgets}`,
      "",
      formatIpoMetricLine("Valuation", ipoProgress.valuation.current, ipoProgress.valuation.target),
      formatIpoMetricLine("Employees", ipoProgress.employees.current, ipoProgress.employees.target),
      formatIpoMetricLine("Unique gadgets", ipoProgress.uniqueGadgets.current, ipoProgress.uniqueGadgets.target),
      formatIpoMetricLine("Profit", ipoProgress.profit.current, ipoProgress.profit.target),
      "",
      isPublic
        ? "✅ Компания публичная"
        : ipoCheck.allowed
        ? "✅ IPO можно запускать"
        : `⛔ IPO недоступно: ${ipoCheck.reason ?? "не выполнены условия"}`,
      "",
      isPublic
        ? `📊 Акции: total ${companyEconomy.shares.totalShares}, free-float ${companyEconomy.shares.freeFloatShares}, цена ${formatNumber(companyEconomy.shares.sharePriceGRM)} GRM`
        : "📊 Акции откроются после IPO",
    ].join("\n"),
    companyEconomy,
    ipoAllowed: ipoCheck.allowed,
    isPublic,
  };
}

function buildCompanyIpoInlineButtons(isOwner: boolean, ipoAllowed: boolean, isPublic: boolean) {
  const rows: Array<Array<{ text: string; callback_data: string }>> = [];
  if (isOwner && !isPublic) {
    rows.push([
      {
        text: ipoAllowed ? "🚀 Провести IPO" : "⛔ IPO пока недоступно",
        callback_data: ipoAllowed ? "company:ipo_run" : "company:ipo",
      },
    ]);
  }
  rows.push([{ text: "🔄 Обновить IPO", callback_data: "company:ipo" }]);
  return buildCompanyInlineMenu(rows);
}

function formatBlueprintContributionLines(companyId: string) {
  const contrib = companyBlueprintContribByCompanyId.get(companyId);
  if (!contrib) return [] as string[];
  const skillOrder: Array<"coding" | "design" | "analytics"> = ["coding", "design", "analytics"];
  const labels: Record<"coding" | "design" | "analytics", string> = {
    coding: "Кодинг",
    design: "Дизайн",
    analytics: "Аналитика",
  };
  const progressLines: string[] = [];
  for (const skill of skillOrder) {
    const required = Math.max(0, Number(contrib.required[skill] ?? 0));
    if (required <= 0) continue;
    const invested = Math.min(required, Math.max(0, Number(contrib.invested[skill] ?? 0)));
    const percent = Math.max(0, Math.min(100, Math.round((invested / required) * 100)));
    progressLines.push(`${labels[skill]}: ${formatNumber(invested)}/${formatNumber(required)} (${percent}%)`);
  }
  return [
    "🧠 Вклад навыков:",
    ...progressLines,
    `👥 Участники разработки: ${contrib.participants.size}`,
  ];
}

async function computeBlueprintSkillContribution(
  companyId: string,
  required: Partial<Record<"coding" | "design" | "analytics", number>>,
  participants: Set<string>,
) {
  const tick: Record<"coding" | "design" | "analytics", number> = {
    coding: 0,
    design: 0,
    analytics: 0,
  };
  const memberUserIds = new Set((await storage.getCompanyMembers(companyId)).map((member) => member.userId));

  for (const userId of Array.from(participants)) {
    if (!memberUserIds.has(userId)) continue;
    const snapshot = await getUserWithGameState(userId);
    const advanced = snapshot ? getAdvancedPersonalityId(snapshot.user) : null;
    const engineerMultiplier = advanced === "engineer" ? 1.15 : 1;
    const skills = (snapshot?.game as GameView | undefined)?.skills;
    if (!skills) continue;
    if (Number(required.coding ?? 0) > 0) tick.coding += Math.max(0, Number(skills.coding ?? 0)) * engineerMultiplier;
    if (Number(required.design ?? 0) > 0) tick.design += Math.max(0, Number(skills.design ?? 0)) * engineerMultiplier;
    if (Number(required.analytics ?? 0) > 0) tick.analytics += Math.max(0, Number(skills.analytics ?? 0)) * engineerMultiplier;
  }

  return tick;
}

function formatBlueprintProgressText(companyName: string, companyId: string, snapshot: CompanyBlueprintSnapshot) {
  const active = snapshot.active;
  const activeBlueprint = active
    ? snapshot.available.find((item) => item.id === active.blueprintId) ?? null
    : null;
  const totalHours = Math.max(1, Number(activeBlueprint?.time ?? 1));
  const progressHours = Math.max(0, Number(active?.progressHours ?? 0));
  const percent = Math.max(0, Math.min(100, Math.round((progressHours / totalHours) * 100)));
  const filled = Math.max(0, Math.min(10, Math.round(percent / 10)));
  const bar = `${"=".repeat(filled)}${"-".repeat(10 - filled)}`;
  const statusLabel = active
    ? BLUEPRINT_STATUSES[active.status as keyof typeof BLUEPRINT_STATUSES] ?? active.status
    : "Не выбран";

  return [
    "🧪 ПРОЦЕСС РАЗРАБОТКИ",
    "━━━━━━━━━━━━━━",
    `🏢 Компания: ${companyName}`,
    `Чертеж: ${activeBlueprint?.name ?? "нет"}`,
    `Статус: ${statusLabel}`,
    `Прогресс: [${bar}] ${percent}%`,
    `Часы: ${progressHours}/${totalHours}`,
    ...formatBlueprintContributionLines(companyId),
    active?.status === "production_ready" ? "✅ Чертеж готов к производству." : "",
  ].filter(Boolean).join("\n");
}

function formatProductionOrderRemaining(order?: CompanyBlueprintSnapshot["productionOrder"] | null) {
  if (!order) return "—";
  const remainingSeconds = Math.max(0, Math.ceil((Number(order.readyAt || 0) - Date.now()) / 1000));
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  if (minutes <= 0) return `${seconds} сек`;
  return `${minutes} мин ${seconds} сек`;
}

function parseCompanyBlueprintTierFromId(blueprintId: string) {
  const match = String(blueprintId || "").match(/(?:^|[_-])t(\d+)(?:$|[_-])/i);
  const tier = match ? Number(match[1]) : NaN;
  return Number.isFinite(tier) && tier > 0 ? tier : 1;
}

function getCompanyBlueprintTierMultiplier(blueprintId: string) {
  const tier = parseCompanyBlueprintTierFromId(blueprintId);
  if (tier <= 2) return 1;
  if (tier <= 4) return 1.25;
  if (tier <= 6) return 1.55;
  if (tier <= 8) return 1.9;
  return 2.3;
}

function getCompanyProductionQuantityMultiplier(quantity: number) {
  return 1 + Math.max(0, quantity - 1) * 0.7;
}

function calculateCompanyStandardProductionPreviewMs(input: {
  blueprintId: string;
  category: string;
  quantity: number;
  departmentEffects: ReturnType<typeof getDepartmentEffects>;
  advancedPersonalityId: string | null;
}) {
  const baseSecondsByCategory: Record<string, number> = {
    smartphones: 12 * 60,
    smartwatches: 10 * 60,
    tablets: 16 * 60,
    laptops: 22 * 60,
    asic_miners: 28 * 60,
  };
  const baseSeconds = baseSecondsByCategory[input.category] ?? 12 * 60;
  const engineerSpeed = input.advancedPersonalityId === "engineer" ? 1.05 : 1;
  const speedDivisor = Math.max(0.1, Number(input.departmentEffects.productionSpeedMultiplier || 1) * engineerSpeed);
  const seconds = Math.max(
    6 * 60,
    Math.ceil(
      (baseSeconds
        * getCompanyBlueprintTierMultiplier(input.blueprintId)
        * getCompanyProductionQuantityMultiplier(input.quantity))
      / speedDivisor,
    ),
  );
  return seconds * 1000;
}

function calculateCompanyExclusiveProductionPreviewMs(input: {
  category: string;
  quantity: number;
  departmentEffects: ReturnType<typeof getDepartmentEffects>;
  advancedPersonalityId: string | null;
}) {
  const baseSecondsByCategory: Record<string, number> = {
    smartphones: 18 * 60,
    smartwatches: 15 * 60,
    tablets: 24 * 60,
    laptops: 30 * 60,
    asic_miners: 36 * 60,
  };
  const baseSeconds = baseSecondsByCategory[input.category] ?? 18 * 60;
  const engineerSpeed = input.advancedPersonalityId === "engineer" ? 1.08 : 1;
  const speedDivisor = Math.max(0.1, Number(input.departmentEffects.productionSpeedMultiplier || 1) * engineerSpeed);
  const seconds = Math.max(
    8 * 60,
    Math.ceil((baseSeconds * getCompanyProductionQuantityMultiplier(input.quantity)) / speedDivisor),
  );
  return seconds * 1000;
}

function stopCompanyBlueprintProgressTicker(chatId: number) {
  const timer = companyBlueprintProgressTimerByChatId.get(chatId);
  if (timer) {
    clearTimeout(timer);
    companyBlueprintProgressTimerByChatId.delete(chatId);
  }
}

async function updateCompanyBlueprintProgressMessage(
  token: string,
  chatId: number,
  companyName: string,
  companyId: string,
  userId: string,
) {
  const messageId = companyBlueprintProgressMessageByChatId.get(chatId);
  if (!messageId) return;

  try {
    const snapshot = await getCompanyBlueprintSnapshot(companyId);
    if (snapshot.active?.status === "production_ready" && snapshot.active.blueprintId) {
      storeCompanyBlueprint(companyId, snapshot.active.blueprintId);
    }
    const text = formatBlueprintProgressText(companyName, companyId, snapshot);
    await callTelegramApi(token, "editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text,
      reply_markup: buildCompanyBureauInlineButtons(true, snapshot.active?.status, null),
    });

    if (!snapshot.active || snapshot.active.status !== "in_progress") {
      stopCompanyBlueprintProgressTicker(chatId);
    }
  } catch (error) {
    console.warn("⚠️ Не удалось обновить прогресс чертежа:", error);
    stopCompanyBlueprintProgressTicker(chatId);
  }
}

function startCompanyBlueprintProgressTicker(
  token: string,
  chatId: number,
  companyName: string,
  companyId: string,
  userId: string,
) {
  stopCompanyBlueprintProgressTicker(chatId);

  const tick = async () => {
    try {
      const current = await getCompanyBlueprintSnapshot(companyId);
      if (!current.active || current.active.status !== "in_progress") {
        await updateCompanyBlueprintProgressMessage(token, chatId, companyName, companyId, userId);
        return;
      }
      const contribState = companyBlueprintContribByCompanyId.get(companyId);
      if (contribState && !contribState.completed && contribState.blueprintId === current.active.blueprintId) {
        const wasCompleted = contribState.completed;
        const tickContribution = await computeBlueprintSkillContribution(companyId, contribState.required, contribState.participants);
        contribState.invested.coding = Math.max(0, Number(contribState.invested.coding ?? 0)) + tickContribution.coding;
        contribState.invested.design = Math.max(0, Number(contribState.invested.design ?? 0)) + tickContribution.design;
        contribState.invested.analytics = Math.max(0, Number(contribState.invested.analytics ?? 0)) + tickContribution.analytics;

        const codingDone = Number(contribState.invested.coding ?? 0) >= Math.max(0, Number(contribState.required.coding ?? 0));
        const designDone = Number(contribState.invested.design ?? 0) >= Math.max(0, Number(contribState.required.design ?? 0));
        const analyticsDone = Number(contribState.invested.analytics ?? 0) >= Math.max(0, Number(contribState.required.analytics ?? 0));
        const requiredCoding = Number(contribState.required.coding ?? 0) <= 0 || codingDone;
        const requiredDesign = Number(contribState.required.design ?? 0) <= 0 || designDone;
        const requiredAnalytics = Number(contribState.required.analytics ?? 0) <= 0 || analyticsDone;
        contribState.completed = requiredCoding && requiredDesign && requiredAnalytics;
        companyBlueprintContribByCompanyId.set(companyId, contribState);

        if (contribState.completed) {
          const activeBlueprint = current.available.find((item) => item.id === current.active?.blueprintId);
          const hoursToAdd = Math.max(1, Number(activeBlueprint?.time ?? 24));
          await callInternalApi("POST", `/api/companies/${companyId}/blueprints/progress`, {
            userId,
            hours: hoursToAdd,
          });
          if (!wasCompleted && current.active?.blueprintId) {
            storeCompanyBlueprint(companyId, current.active.blueprintId);
            await notifyCompanyMembersBlueprintReady(
              token,
              companyId,
              activeBlueprint?.name ?? current.active.blueprintId,
            );
          }
        }
      } else if (!contribState) {
        await callInternalApi("POST", `/api/companies/${companyId}/blueprints/progress`, {
          userId,
          hours: 1,
        });
      }
      await updateCompanyBlueprintProgressMessage(token, chatId, companyName, companyId, userId);

      const timer = setTimeout(tick, 1000);
      companyBlueprintProgressTimerByChatId.set(chatId, timer);
    } catch (error) {
      console.warn("⚠️ Автопрогресс чертежа остановлен:", error);
      stopCompanyBlueprintProgressTicker(chatId);
    }
  };

  const timer = setTimeout(tick, 1000);
  companyBlueprintProgressTimerByChatId.set(chatId, timer);
}

function buildCompanyBlueprintJoinInlineButtons() {
  return buildCompanyInlineMenu([
    [{ text: "🤝 Присоединиться к разработке", callback_data: "company:bp_join" }],
  ]);
}

async function notifyCompanyMembersAboutBlueprintStart(
  token: string,
  companyId: string,
  companyName: string,
  blueprintName: string,
) {
  const members = await storage.getCompanyMembers(companyId);
  for (const member of members) {
    const telegramId = Number(getTelegramIdByUserId(member.userId) || 0);
    if (!telegramId) continue;
    try {
      await sendMessage(
        token,
        telegramId,
        [
          `🧪 CEO запустил разработку: ${blueprintName}`,
          `🏢 Компания: ${companyName}`,
          "Нажми кнопку ниже, чтобы присоединиться к разработке и вкладывать навыки каждую секунду.",
        ].join("\n"),
        { reply_markup: buildCompanyBlueprintJoinInlineButtons() },
      );
    } catch (error) {
      console.warn("⚠️ Не удалось отправить уведомление участнику разработки:", error);
    }
  }
}

async function notifyCompanyMembersBlueprintReady(
  token: string,
  companyId: string,
  blueprintName: string,
) {
  const members = await storage.getCompanyMembers(companyId);
  for (const member of members) {
    const telegramId = Number(getTelegramIdByUserId(member.userId) || 0);
    if (!telegramId) continue;
    try {
      await sendMessage(
        token,
        telegramId,
        `✅ Чертёж «${blueprintName}» разработан и перемещён на склад компании.`,
      );
    } catch (error) {
      console.warn("⚠️ Не удалось отправить уведомление о завершении разработки:", error);
    }
  }
}

async function sendCompanyWorkSection(token: string, chatId: number, membership: CompanyContext) {
  await sendCompanyWorkSectionBase({
    token,
    chatId,
    membership,
    formatCompanyWorkSection,
    buildCompanyReplyMarkup,
    sendMessage,
  });
}

async function sendCompanyWarehouseSection(token: string, chatId: number, membership: CompanyContext, playerId?: string) {
  await sendCompanyWarehouseSectionBase({
    token,
    chatId,
    membership,
    playerId,
    formatCompanyWarehouseSection,
    getUserWithGameState,
    pendingActionByChatId,
    formatCompanyPartDepositList,
    sendMessage,
  });
}

async function sendCompanyBureauSection(token: string, chatId: number, membership: CompanyContext, userId: string) {
  await sendCompanyBureauSectionBase({
    token,
    chatId,
    membership,
    userId,
    formatCompanyBureauSection,
    buildCompanyBureauInlineButtons,
    sendMessage,
  });
}

async function sendOrEditCompanyBureauSection(
  token: string,
  chatId: number,
  membership: CompanyContext,
  userId: string,
  messageId?: number,
  prefix?: string,
) {
  await sendOrEditCompanyBureauSectionBase({
    token,
    chatId,
    membership,
    userId,
    messageId,
    prefix,
    formatCompanyBureauSection,
    buildCompanyBureauInlineButtons,
    callTelegramApi,
    sendMessage,
  });
}

async function sendCompanyManagementSection(token: string, chatId: number, membership: CompanyContext) {
  await sendCompanyManagementSectionBase({
    token,
    chatId,
    membership,
    formatCompanyManagementSection,
    companyMemberRefsByChatId,
    buildCompanyReplyMarkup,
    sendMessage,
  });
}

async function sendCompanyEconomySection(token: string, chatId: number, membership: CompanyContext) {
  await sendCompanyEconomySectionBase({
    token,
    chatId,
    membership,
    formatCompanyMenuWithMembership,
    buildCompanyReplyMarkup,
    sendMessage,
  });
}

async function sendCompanyDepartmentsSection(token: string, chatId: number, membership: CompanyContext) {
  await sendCompanyDepartmentsSectionBase({
    token,
    chatId,
    membership,
    formatCompanyDepartmentsSection,
    buildCompanyReplyMarkup,
    sendMessage,
  });
}

async function sendCompanyIpoSection(token: string, chatId: number, membership: CompanyContext) {
  await sendCompanyIpoSectionBase({
    token,
    chatId,
    membership,
    formatCompanyIpoSection,
    buildCompanyReplyMarkup,
    sendMessage,
  });
}

async function sendCompanyRequestsSection(token: string, chatId: number, membership: CompanyContext) {
  await sendCompanyRequestsSectionBase({
    token,
    chatId,
    membership,
    storage,
    companyRequestsByChatId,
    buildCompanyReplyMarkup,
    sendMessage,
  });
}

function resolveContractRef(chatId: number, ref: string, contracts: CityContractView[]) {
  const trimmed = ref.trim();
  if (!trimmed) return null;

  if (/^\d+$/.test(trimmed)) {
    const refs = companyContractRefsByChatId.get(chatId) ?? contracts.map((contract) => contract.id);
    const index = Number(trimmed) - 1;
    const contractId = index >= 0 && index < refs.length ? refs[index] : "";
    return contracts.find((contract) => contract.id === contractId) ?? null;
  }

  return contracts.find((contract) => contract.id === trimmed)
    ?? contracts.find((contract) => contract.id.startsWith(trimmed))
    ?? null;
}

function resolveCompanyMemberRef(chatId: number, ref: string, members: Array<{ userId: string; username: string }>) {
  const trimmed = ref.trim();
  if (!trimmed) return null;

  if (/^\d+$/.test(trimmed)) {
    const refs = companyMemberRefsByChatId.get(chatId) ?? members.map((member) => member.userId);
    const index = Number(trimmed) - 1;
    const userId = index >= 0 && index < refs.length ? refs[index] : "";
    return members.find((member) => member.userId === userId) ?? null;
  }

  const normalized = trimmed.replace(/^@/, "").toLowerCase();
  return members.find((member) => member.userId === trimmed)
    ?? members.find((member) => member.userId.startsWith(trimmed))
    ?? members.find((member) => member.username.toLowerCase() === normalized)
    ?? null;
}

async function completeCompanyContractDelivery(
  token: string,
  chatId: number,
  membership: CompanyContext,
  contract: CityContractView,
  userId: string,
  options?: { partRefs?: string[] },
) {
  const result = await callInternalApi("POST", `/api/city-contracts/${contract.id}/deliver`, {
    userId,
    companyId: membership.company.id,
    partRefs: options?.partRefs,
  }) as {
    contract?: {
      rewardMoney?: number;
      requiredQuantity?: number;
    };
    company?: any;
  };

  const latestCompany = result.company ?? membership.company;
  const currentMembers = await storage.getCompanyMembers(membership.company.id);
  const companyEconomy = await ensureCompanyEconomyState(latestCompany, currentMembers.length);
  const departmentEffects = getDepartmentEffects(companyEconomy.departments);

  const baseReward = Math.max(0, Number(result.contract?.rewardMoney ?? 0));
  const deliveredQuantity = Math.max(0, Math.floor(Number(result.contract?.requiredQuantity ?? 0)));
  const marketingBonus = baseReward * Math.max(0, departmentEffects.priceMultiplier - 1);
  const financeBonus = baseReward * Math.max(0, departmentEffects.profitMultiplier - 1);
  const bonusCapital = marketingBonus + financeBonus;
  const demandSalesBonus = Math.max(0, Math.floor(deliveredQuantity * Math.max(0, departmentEffects.demandMultiplier - 1)));

  const updatedEconomy = reconcileCompanyEconomy({
    ...companyEconomy,
    capitalGRM: companyEconomy.capitalGRM + bonusCapital,
    profitGRM: companyEconomy.profitGRM + baseReward + bonusCapital,
    assetsGRM: companyEconomy.assetsGRM + bonusCapital * 0.25,
    gadgetsSold: companyEconomy.gadgetsSold + deliveredQuantity + demandSalesBonus,
  });
  await saveCompanyEconomyState(latestCompany, updatedEconomy);

  await sendMessage(
    token,
    chatId,
    [
      "✅ Контракт сдан.",
      `База: +${formatNumber(baseReward)} GRM`,
      bonusCapital > 0
        ? `Бонус отделов (Marketing/Finance): +${formatNumber(bonusCapital)} GRM`
        : "Бонус отделов: нет",
      demandSalesBonus > 0
        ? `Доп. продажи по спросу: +${demandSalesBonus}`
        : "Доп. продажи по спросу: нет",
    ].join("\n"),
  );
}

async function startCompanyContractPartSelection(
  token: string,
  chatId: number,
  membership: CompanyContext,
  playerId: string,
  contract: CityContractView,
  messageId?: number,
) {
  if (membership.role !== "owner") {
    await sendMessage(token, chatId, "Для контрактов на запчасти детали со склада выбирает CEO компании.", {
      reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
    });
    return;
  }

  const availableRefs = getCompanyWarehousePartUnitRefs(membership.company.id, contract.requiredPartType);
  if (availableRefs.length < Math.max(1, Number(contract.requiredQuantity || 0))) {
    await sendMessage(
      token,
      chatId,
      `❌ На складе компании не хватает нужных запчастей. Нужно ${contract.requiredQuantity}, доступно ${availableRefs.length}.`,
      { reply_markup: buildCompanyReplyMarkup(membership.role, chatId) },
    );
    return;
  }

  setCompanyMenuSection(chatId, "work");
  rememberTelegramMenu(playerId, { menu: "company", section: "work" });
  companyContractPartRefsByChatId.set(chatId, availableRefs.map((item) => item.ref));
  companyContractSelectedPartRefsByChatId.set(chatId, []);
  companyContractPartPageByChatId.set(chatId, 0);
  pendingActionByChatId.set(chatId, {
    type: "company_contract_parts",
    contractId: contract.id,
    requiredPartType: String(contract.requiredPartType || ""),
    requiredQuantity: Math.max(1, Number(contract.requiredQuantity || 1)),
  });
  await sendCompanyContractPartsPicker(token, chatId, membership, contract, messageId);
}

function resolveBlueprintRef(chatId: number, ref: string, available: CompanyBlueprintSnapshot["available"]) {
  const trimmed = ref.trim();
  if (!trimmed) return null;

  if (/^\d+$/.test(trimmed)) {
    const refs = companyBlueprintRefsByChatId.get(chatId) ?? available.map((item) => item.id);
    const index = Number(trimmed) - 1;
    const blueprintId = index >= 0 && index < refs.length ? refs[index] : "";
    return available.find((item) => item.id === blueprintId) ?? null;
  }

  return available.find((item) => item.id === trimmed)
    ?? available.find((item) => item.id.startsWith(trimmed))
    ?? available.find((item) => item.name.toLowerCase() === trimmed.toLowerCase())
    ?? null;
}

function normalizePartRarity(value: string): RarityName {
  if (value === "Common" || value === "Rare" || value === "Epic" || value === "Legendary") {
    return value;
  }
  return "Common";
}

function consumeInventoryParts(inventory: GameInventoryItem[], consumedPartIds: string[]) {
  const consumeCounter = new Map<string, number>();
  for (const id of consumedPartIds) {
    consumeCounter.set(id, (consumeCounter.get(id) ?? 0) + 1);
  }

  const next: GameInventoryItem[] = [];
  for (const item of inventory) {
    const clone = { ...item };
    if (clone.type !== "part") {
      next.push(clone);
      continue;
    }

    const toConsume = consumeCounter.get(clone.id) ?? 0;
    if (toConsume <= 0) {
      next.push(clone);
      continue;
    }

    const left = Math.max(0, Math.max(1, clone.quantity || 1) - toConsume);
    consumeCounter.set(clone.id, Math.max(0, toConsume - Math.max(1, clone.quantity || 1)));
    if (left > 0) {
      clone.quantity = left;
      next.push(clone);
    }
  }

  return next;
}

function parseBlueprintFamilyAndTier(blueprintId: string): { family: string; tier: number } | null {
  const trimmed = String(blueprintId || "").trim();
  const match = trimmed.match(/^(.+)-(\d+)$/);
  if (!match) return null;
  const tier = Number(match[2]);
  if (!Number.isFinite(tier) || tier <= 0) return null;
  return { family: match[1], tier };
}

function getCompanyWarehouseParts(companyId: string) {
  return companyWarehousePartsByCompanyId.get(companyId) ?? [];
}

function getCompanyWarehousePartUnitRefs(companyId: string, filterType?: string | null) {
  const refs: Array<{ ref: string; id: string; rarity: RarityName; type: string; name: string }> = [];
  for (const item of getCompanyWarehouseParts(companyId)) {
    const partType = String(item.type || ALL_PARTS[item.id]?.type || "");
    if (filterType && partType !== filterType) continue;
    const quantity = Math.max(1, Number(item.quantity || 1));
    const rarity = normalizePartRarity(String(item.rarity || ALL_PARTS[item.id]?.rarity || "Common"));
    for (let unitIndex = 0; unitIndex < quantity; unitIndex += 1) {
      refs.push({
        ref: `${item.id}::${rarity}::${unitIndex + 1}`,
        id: item.id,
        rarity,
        type: partType,
        name: String(item.name || ALL_PARTS[item.id]?.name || item.id),
      });
    }
  }
  return refs;
}

function setCompanyWarehouseParts(companyId: string, parts: CompanyWarehousePartItem[]) {
  companyWarehousePartsByCompanyId.set(companyId, parts);
}

function addPartToCompanyWarehouse(companyId: string, reward: CompanyMiningRewardView) {
  const next = [...getCompanyWarehouseParts(companyId)];
  const partDef = ALL_PARTS[reward.partId];
  const rarity = normalizePartRarity(String(reward.rarity || partDef?.rarity || "Common"));
  const qty = Math.max(1, Number(reward.quantity) || 1);
  const existingIndex = next.findIndex((item) => item.id === reward.partId && item.rarity === rarity);
  if (existingIndex >= 0) {
    next[existingIndex] = {
      ...next[existingIndex],
      quantity: Math.max(0, Number(next[existingIndex].quantity) || 0) + qty,
    };
  } else {
    next.push({
      id: reward.partId,
      name: reward.partName,
      type: reward.partType || partDef?.type || "unknown",
      rarity,
      quantity: qty,
    });
  }
  setCompanyWarehouseParts(companyId, next);
}

async function ensureCompanyWarehouseCanStoreMiningReward(company: any, rewardQty: number) {
  const snapshot = await getCompanyBlueprintSnapshot(company.id);
  const capacity = Math.max(0, Number(company.warehouseCapacity) || 50);
  const used = getCompanyWarehouseUsedSlots(company.id, snapshot.produced.length);
  const free = Math.max(0, capacity - used);
  return {
    ok: free >= Math.max(1, rewardQty),
    free,
  };
}

function getCompanyStoredBlueprintIds(companyId: string) {
  return companyBlueprintWarehouseByCompanyId.get(companyId) ?? new Set<string>();
}

function storeCompanyBlueprint(companyId: string, blueprintId: string) {
  const normalizedId = String(blueprintId || "").trim();
  if (!normalizedId) return;
  const stored = new Set(getCompanyStoredBlueprintIds(companyId));
  stored.add(normalizedId);
  companyBlueprintWarehouseByCompanyId.set(companyId, stored);
}

function getDevelopedBlueprintIds(companyId: string, snapshot: CompanyBlueprintSnapshot) {
  const developed = new Set<string>(getCompanyStoredBlueprintIds(companyId));
  for (const gadget of snapshot.produced ?? []) {
    const blueprintId = String(gadget.blueprintId || "").trim();
    if (blueprintId) developed.add(blueprintId);
  }
  return developed;
}

function getUnlockedBlueprints(available: CompanyBlueprintSnapshot["available"], developed: Set<string>) {
  return available.filter((blueprint) => {
    const parsed = parseBlueprintFamilyAndTier(blueprint.id);
    if (!parsed) return true;
    if (parsed.tier <= 1) return true;
    return developed.has(`${parsed.family}-${parsed.tier - 1}`);
  });
}

function getCompanyWarehouseUsedSlots(companyId: string, producedCount: number) {
  const parts = getCompanyWarehouseParts(companyId);
  const partSlots = parts.reduce((sum, item) => sum + Math.max(0, Math.floor(Number(item.quantity) || 0)), 0);
  const blueprintSlots = getCompanyStoredBlueprintIds(companyId).size;
  return Math.max(0, producedCount) + partSlots + blueprintSlots;
}

function removeCompanyWarehousePartsByRefs(companyId: string, partRefs: string[]) {
  const next = [...getCompanyWarehouseParts(companyId)];
  const selectedSeedParts: Array<{ id: string; rarity: RarityName; type: any; name: string }> = [];
  for (const ref of partRefs) {
    const index = next.findIndex((item) => `${item.id}::${item.rarity}` === ref);
    if (index < 0) {
      throw new Error(`Деталь ${ref} не найдена на складе компании`);
    }
    const item = next[index];
    selectedSeedParts.push({
      id: item.id,
      rarity: item.rarity,
      type: String(ALL_PARTS[item.id]?.type || item.type) as any,
      name: item.name,
    });
    if (Number(item.quantity || 0) <= 1) next.splice(index, 1);
    else next[index] = { ...item, quantity: Number(item.quantity || 0) - 1 };
  }
  setCompanyWarehouseParts(companyId, next);
  return selectedSeedParts;
}

function restoreCompanyWarehouseSeedParts(companyId: string, seedParts: Array<{ id: string; rarity: RarityName; type?: string; name?: string }>) {
  const next = [...getCompanyWarehouseParts(companyId)];
  for (const seedPart of seedParts) {
    const existingIndex = next.findIndex((item) => item.id === seedPart.id && item.rarity === seedPart.rarity);
    if (existingIndex >= 0) {
      next[existingIndex] = { ...next[existingIndex], quantity: Number(next[existingIndex].quantity || 0) + 1 };
      continue;
    }
    next.push({
      id: seedPart.id,
      name: String(seedPart.name || ALL_PARTS[seedPart.id]?.name || seedPart.id),
      type: String(seedPart.type || ALL_PARTS[seedPart.id]?.type || "unknown"),
      rarity: seedPart.rarity,
      quantity: 1,
    });
  }
  setCompanyWarehouseParts(companyId, next);
}

function buildWarehouseGadgetGroupKey(gadget: CompanyBlueprintSnapshot["produced"][number]) {
  return JSON.stringify({
    name: gadget.name,
    category: gadget.category,
    quality: Number(gadget.quality || 0).toFixed(2),
    stats: gadget.stats || {},
    bonus: gadget.exclusiveBonusLabel || "",
  });
}

function groupCompanyProducedGadgets(produced: CompanyBlueprintSnapshot["produced"]) {
  const groups = new Map<string, { representative: CompanyBlueprintSnapshot["produced"][number]; quantity: number }>();
  for (const gadget of produced ?? []) {
    const key = buildWarehouseGadgetGroupKey(gadget);
    const current = groups.get(key);
    if (current) {
      current.quantity += 1;
      continue;
    }
    groups.set(key, { representative: gadget, quantity: 1 });
  }
  return Array.from(groups.values());
}

function formatGadgetStatLine(stats?: Record<string, number>) {
  return Object.entries(stats || {})
    .map(([key, value]) => `${key}: ${formatNumber(Number(value || 0))}`)
    .join(", ");
}

function resolveCompanyPartDepositRefFromChat(chatId: number, ref: string) {
  const trimmed = ref.trim();
  if (!/^\d+$/.test(trimmed)) return trimmed;
  const refs = companyPartDepositRefsByChatId.get(chatId) ?? [];
  const index = Number(trimmed) - 1;
  if (index >= 0 && index < refs.length) return refs[index];
  return trimmed;
}

function resolveHackathonPartRefFromChat(chatId: number, ref: string) {
  const trimmed = ref.trim();
  if (!/^\d+$/.test(trimmed)) return trimmed;
  const refs = hackathonPartRefsByChatId.get(chatId) ?? [];
  const index = Number(trimmed) - 1;
  if (index >= 0 && index < refs.length) return refs[index];
  return trimmed;
}

function resolveHackathonSabotageTargetRef(chatId: number, ref: string) {
  const trimmed = ref.trim();
  if (!/^\d+$/.test(trimmed)) return trimmed;
  const refs = hackathonSabotageTargetRefsByChatId.get(chatId) ?? [];
  const index = Number(trimmed) - 1;
  if (index >= 0 && index < refs.length) return refs[index];
  return trimmed;
}

async function transferCompanyPartToWarehouse(
  playerId: string,
  membership: CompanyContext,
  partRef: string,
  qtyInput?: string,
): Promise<{ ok: true; partName: string; moveQty: number } | { ok: false; error: string }> {
  const snapshot = await getUserWithGameState(playerId);
  if (!snapshot) return { ok: false, error: "Профиль игрока не найден." };
  const inventory = [...(((snapshot.game as GameView).inventory) ?? [])];
  const partItem = inventory.find((item) => item.type === "part" && item.id === partRef);
  if (!partItem) {
    return { ok: false, error: "Запчасть не найдена в инвентаре." };
  }

  const availableQty = Math.max(1, Number(partItem.quantity) || 1);
  const requestedQty = qtyInput && qtyInput.toLowerCase() !== "all"
    ? Math.floor(Number(qtyInput))
    : availableQty;
  if (!Number.isFinite(requestedQty) || requestedQty <= 0) {
    return { ok: false, error: "Неверное количество. Введите число или all." };
  }
  const moveQty = Math.min(availableQty, requestedQty);

  const companySnapshot = await getCompanyBlueprintSnapshot(membership.company.id);
  const capacity = Math.max(0, Number(membership.company.warehouseCapacity) || 50);
  const used = getCompanyWarehouseUsedSlots(membership.company.id, companySnapshot.produced.length);
  const free = Math.max(0, capacity - used);
  if (moveQty > free) {
    return { ok: false, error: `Склад заполнен, добавить невозможно. Свободно слотов: ${free}.` };
  }

  const nextInventory = inventory.flatMap((item) => {
    if (item.type !== "part" || item.id !== partItem.id) return [item];
    const left = availableQty - moveQty;
    if (left <= 0) return [];
    return [{ ...item, quantity: left }];
  });
  applyGameStatePatch(playerId, { inventory: nextInventory });

  const partDef = ALL_PARTS[partItem.id];
  const nextWarehouseParts = [...getCompanyWarehouseParts(membership.company.id)];
  const existingIndex = nextWarehouseParts.findIndex((item) => item.id === partItem.id);
  if (existingIndex >= 0) {
    nextWarehouseParts[existingIndex] = {
      ...nextWarehouseParts[existingIndex],
      quantity: Math.max(0, Number(nextWarehouseParts[existingIndex].quantity) || 0) + moveQty,
    };
  } else {
    nextWarehouseParts.push({
      id: partItem.id,
      name: partItem.name,
      type: partDef?.type ?? "unknown",
      rarity: normalizePartRarity(String(partItem.rarity || partDef?.rarity || "Common")),
      quantity: moveQty,
    });
  }
  setCompanyWarehouseParts(membership.company.id, nextWarehouseParts);

  return { ok: true, partName: partItem.name, moveQty };
}

function getEducationFailureReduction(city: string, reputation: number) {
  const repReduction =
    reputation >= 1000 ? 8 :
      reputation >= 600 ? 6 :
        reputation >= 300 ? 4 :
          reputation >= 100 ? 2 : 0;
  return repReduction + getCityProfile(city).failChanceFlatReduction;
}

function getReputationStatus(reputation: number) {
  if (reputation >= 1000) return "Легенда";
  if (reputation >= 600) return "Икона IT";
  if (reputation >= 300) return "Уважаемый";
  if (reputation >= 100) return "Местный";
  return "Незнакомец";
}

function getNextReputationThreshold(reputation: number) {
  const milestones = [100, 300, 600, 1000];
  for (const threshold of milestones) {
    if (reputation < threshold) return threshold;
  }
  return null;
}

function getCityReputationBonus(city: string, reputation: number) {
  const profile = getCityProfile(city);
  const bonus = {
    failureRateReduction: getEducationFailureReduction(city, reputation),
    salaryBoost:
      (reputation >= 1000 ? 6 : reputation >= 600 ? 4 : reputation >= 300 ? 2 : 0),
    skillGrowthBoost: Math.max(0, Math.round((profile.skillGrowthMultiplier - 1) * 100)),
    xpBoost:
      (reputation >= 1000 ? 6 : reputation >= 600 ? 4 : reputation >= 300 ? 2 : 0),
  };
  return bonus;
}

function formatReputationMenu(user: User) {
  const reputation = user.reputation || 0;
  const status = getReputationStatus(reputation);
  const next = getNextReputationThreshold(reputation);
  const bonus = getCityReputationBonus(user.city, reputation);

  const bonusLines = [
    bonus.failureRateReduction > 0 ? `• Снижение риска провала: -${bonus.failureRateReduction}%` : "",
    bonus.salaryBoost > 0 ? `• Бонус к зарплате: +${bonus.salaryBoost}%` : "",
    bonus.skillGrowthBoost > 0 ? `• Рост навыков: +${bonus.skillGrowthBoost}%` : "",
    bonus.xpBoost > 0 ? `• Бонус к XP: +${bonus.xpBoost}%` : "",
  ].filter(Boolean);

  const cityTierLines = [
    "• 100+: базовые городские эффекты + ранговый бонус",
    "• 300+: усиленные бонусы развития",
    "• 600+: mid-game усиление эффективности",
    "• 1000+: максимальный профиль города для late-game",
  ];

  return [
    "🏅 РЕПУТАЦИЯ ИГРОКА",
    "━━━━━━━━━━━━━━",
    `Город: ${user.city}`,
    `Статус: ${status}`,
    `Очки репутации: ${reputation}`,
    next ? `До следующего ранга: ${next - reputation} (порог: ${next})` : "Максимальный ранг достигнут.",
    "━━━━━━━━━━━━━━",
    "Бонусы города при текущей репутации:",
    ...(bonusLines.length ? bonusLines : ["• Пока активных бонусов нет"]),
    "",
    "Пороги репутации для твоего города:",
    ...cityTierLines,
    "",
    "Команды: /quests, /rating",
  ].join("\n");
}

function getIsoWeekKey(date = new Date()) {
  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((utcDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${utcDate.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function hashString(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash * 31) + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function createSeededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let temp = value;
    temp = Math.imul(temp ^ (temp >>> 15), temp | 1);
    temp ^= temp + Math.imul(temp ^ (temp >>> 7), temp | 61);
    return ((temp ^ (temp >>> 14)) >>> 0) / 4294967296;
  };
}

function pickQuestRewardMoney(city: string, metric: WeeklyQuestMetric, rng: () => number) {
  const ranges: Record<string, Record<WeeklyQuestMetric, [number, number]>> = {
    "Сан-Франциско": { jobs: [8, 16], study: [6, 12], shop: [4, 9] },
    "Сингапур": { jobs: [12, 20], study: [10, 16], shop: [6, 12] },
    "Сеул": { jobs: [12000, 22000], study: [9000, 16000], shop: [7000, 13000] },
    "Санкт-Петербург": { jobs: [700, 1400], study: [500, 900], shop: [300, 700] },
  };
  const [min, max] = ranges[city]?.[metric] ?? ranges["Сан-Франциско"][metric];
  return Math.round(min + rng() * (max - min));
}

function getWeeklyQuestTitlePool(metric: WeeklyQuestMetric, city: string) {
  const cityLabel = city === "Сан-Франциско" ? "Silicon Sprint" : city;
  if (metric === "jobs") {
    return [
      `Рабочая неделя: ${cityLabel}`,
      "Первый спринт",
      "Смена без багов",
      "Трудовой марафон",
    ];
  }
  if (metric === "study") {
    return [
      "Учёба без пропусков",
      "Апгрейд навыков",
      "Интенсив недели",
      "Лаборатория знаний",
    ];
  }
  return [
    "Обновить снаряжение",
    "Шопинг для карьеры",
    "Инвестиция в рост",
    "Полка новичка",
  ];
}

function buildWeeklyQuestTemplates(city: string, weekKey: string): WeeklyQuestTemplate[] {
  const rng = createSeededRandom(hashString(`${city}:${weekKey}:weekly-quests`));
  const currency = getCurrencySymbol(city);
  const jobsTarget = 4 + Math.floor(rng() * 3);
  const studyTarget = 2 + Math.floor(rng() * 3);
  const shopTarget = 1 + Math.floor(rng() * 2);
  const jobsReward = pickQuestRewardMoney(city, "jobs", rng);
  const studyReward = pickQuestRewardMoney(city, "study", rng);
  const shopReward = pickQuestRewardMoney(city, "shop", rng);
  const jobsTitles = getWeeklyQuestTitlePool("jobs", city);
  const studyTitles = getWeeklyQuestTitlePool("study", city);
  const shopTitles = getWeeklyQuestTitlePool("shop", city);

  return [
    {
      id: `${weekKey}:${city}:jobs`,
      title: jobsTitles[Math.floor(rng() * jobsTitles.length)] ?? "Рабочая неделя",
      description: `Выполни ${jobsTarget} рабочих заданий в городе ${city}.`,
      rewardLabel: `${currency}${jobsReward} + 300 XP + 10 репутации`,
      rewardMoney: jobsReward,
      rewardExp: 300,
      target: jobsTarget,
      metric: "jobs",
    },
    {
      id: `${weekKey}:${city}:study`,
      title: studyTitles[Math.floor(rng() * studyTitles.length)] ?? "Интенсив недели",
      description: `Заверши ${studyTarget} учебных курса на этой неделе.`,
      rewardLabel: `${currency}${studyReward} + 400 XP + 10 репутации`,
      rewardMoney: studyReward,
      rewardExp: 400,
      target: studyTarget,
      metric: "study",
    },
    {
      id: `${weekKey}:${city}:shop`,
      title: shopTitles[Math.floor(rng() * shopTitles.length)] ?? "Шопинг для карьеры",
      description: `Купи ${shopTarget} предмет${shopTarget > 1 ? "а" : ""} в магазине своего города.`,
      rewardLabel: `${currency}${shopReward} + 200 XP + 10 репутации`,
      rewardMoney: shopReward,
      rewardExp: 200,
      target: shopTarget,
      metric: "shop",
    },
  ];
}

function getWeeklyQuestTemplatesByCity(city: string) {
  return buildWeeklyQuestTemplates(city, getIsoWeekKey());
}

function getWeeklyQuestTemplateForUser(userId: string, city: string, weekKey: string) {
  const templates = buildWeeklyQuestTemplates(city, weekKey);
  const index = hashString(`${userId}:${city}:${weekKey}`) % templates.length;
  return templates[index];
}

function ensureWeeklyQuestState(user: User) {
  const weekKey = getIsoWeekKey();
  const city = user.city;
  const templates = buildWeeklyQuestTemplates(city, weekKey);
  const existing = weeklyQuestStateByUserId.get(user.id);

  if (existing && existing.weekKey === weekKey && existing.city === city) {
    const existingTemplate = templates.find((quest) => quest.id === existing.questId);
    if (existingTemplate) {
      return { state: existing, template: existingTemplate };
    }
  }

  const template = getWeeklyQuestTemplateForUser(user.id, city, weekKey);
  const state: WeeklyQuestState = {
    weekKey,
    city,
    questId: template.id,
    progress: 0,
    claimed: false,
  };
  weeklyQuestStateByUserId.set(user.id, state);
  return { state, template };
}

function formatWeeklyQuestMenu(user: User): WeeklyQuestMenuView {
  const { state, template } = ensureWeeklyQuestState(user);
  const progress = Math.max(0, Math.min(template.target, state.progress));
  const percent = Math.max(0, Math.min(100, Math.round((progress / Math.max(1, template.target)) * 100)));
  const filled = Math.max(0, Math.min(10, Math.round(percent / 10)));
  const bar = `${"=".repeat(filled)}${"-".repeat(10 - filled)}`;
  const completed = progress >= template.target;
  const canClaim = completed && !state.claimed;
  const statusLabel = state.claimed
    ? "Награда получена"
    : canClaim
    ? "Готово к получению"
    : "В процессе";

  return {
    canClaim,
    text: [
      "🗓 ЕЖЕНЕДЕЛЬНОЕ ЗАДАНИЕ",
      "━━━━━━━━━━━━━━",
      `Неделя: ${state.weekKey}`,
      `Город: ${state.city}`,
      "",
      `Квест: ${template.title}`,
      template.description,
      "",
      `Прогресс: [${bar}] ${progress}/${template.target} (${percent}%)`,
      `Статус: ${statusLabel}`,
      `Награда: ${template.rewardLabel}`,
      "",
      canClaim ? "Забери награду: /quest_claim" : "Команды: /quest_claim, /reputation",
    ].join("\n"),
  };
}

function updateWeeklyQuestProgress(user: User, metric: WeeklyQuestMetric, amount = 1): WeeklyQuestProgressUpdate | null {
  const safeAmount = Math.max(0, Math.floor(amount));
  if (safeAmount <= 0) return null;

  const { state, template } = ensureWeeklyQuestState(user);
  if (template.metric !== metric) return null;
  if (state.claimed) return { template, state, updated: false, completedNow: false };

  const before = Math.max(0, state.progress);
  if (before >= template.target) return { template, state, updated: false, completedNow: false };

  state.progress = Math.min(template.target, before + safeAmount);
  const completedNow = before < template.target && state.progress >= template.target;
  weeklyQuestStateByUserId.set(user.id, state);

  return {
    template,
    state,
    updated: state.progress !== before,
    completedNow,
  };
}

function formatWeeklyQuestProgressNotice(progress: WeeklyQuestProgressUpdate | null) {
  if (!progress || !progress.updated) return "";
  const lines = [
    `🗓 Квест: ${progress.template.title} (${progress.state.progress}/${progress.template.target})`,
  ];
  if (progress.completedNow) {
    lines.push("🎯 Еженедельный квест выполнен! Забери награду: /quest_claim");
  }
  return lines.join("\n");
}

async function claimWeeklyQuestReward(userId: string) {
  const user = await storage.getUser(userId);
  if (!user) throw new Error("Пользователь не найден");

  const { state, template } = ensureWeeklyQuestState(user);
  if (state.claimed) throw new Error("Награда по этому квесту уже получена");
  if (state.progress < template.target) {
    throw new Error(`РљРІРµСЃС‚ РµС‰Рµ РЅРµ РІС‹РїРѕР»РЅРµРЅ: ${state.progress}/${template.target}`);
  }

  const expState = applyExperienceGain(user, template.rewardExp);
  const updatedUser = await storage.updateUser(user.id, {
    balance: user.balance + template.rewardMoney,
    reputation: (user.reputation || 0) + WEEKLY_QUEST_REPUTATION_REWARD,
    level: expState.level,
    experience: expState.experience,
  });
  state.claimed = true;
  weeklyQuestStateByUserId.set(user.id, state);

  return {
    user: updatedUser,
    state,
    template,
    rewardMoney: template.rewardMoney,
    rewardExp: template.rewardExp,
    rewardReputation: WEEKLY_QUEST_REPUTATION_REWARD,
  };
}

function normalizeRatingEntity(value?: string): RatingEntity {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["companies", "company", "компании", "компания", "c"].includes(normalized)) return "companies";
  return "players";
}

function isRatingEntityToken(value?: string) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return ["players", "player", "игроки", "игрок", "p", "companies", "company", "компании", "компания", "c"].includes(normalized);
}

function normalizePlayerRatingSort(value?: string): PlayerRatingSort {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["pvp", "duel", "arena", "пвп"].includes(normalized)) return "pvp";
  if (["reputation", "rep", "репутация", "реп"].includes(normalized)) return "reputation";
  if (["wealth", "money", "balance", "богатство", "деньги", "баланс"].includes(normalized)) return "wealth";
  return "level";
}

function normalizeCompanyRatingSort(value?: string): CompanyRatingSort {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["wealth", "money", "balance", "богатство", "деньги", "баланс"].includes(normalized)) return "wealth";
  if (["blueprints", "bp", "чертежи", "чертеж", "орк", "ork"].includes(normalized)) return "blueprints";
  return "level";
}

async function formatRatingMenu(entity: RatingEntity, sortInput?: string) {
  if (entity === "players") {
    const sort = normalizePlayerRatingSort(sortInput);
    const users = await storage.getUsers();
    const sorted = [...users].sort((a, b) => {
      if (sort === "pvp") return Number(b.pvpRating || 1000) - Number(a.pvpRating || 1000);
      if (sort === "reputation") return b.reputation - a.reputation;
      if (sort === "wealth") return b.balance - a.balance;
      return b.level - a.level;
    }).slice(0, 10);

    return {
      entity,
      sort: sort as RatingSort,
      text: sorted.length
        ? [
            "🏆 РЕЙТИНГ ИГРОКОВ",
            "━━━━━━━━━━━━━━",
            `Сортировка: ${sort === "level" ? "уровень" : sort === "reputation" ? "репутация" : sort === "wealth" ? "богатство" : "PvP рейтинг"}`,
            ...sorted.map((item, index) => (
              `${index + 1}. ${item.username} (${item.city})\n` +
              `   lvl ${item.level} • rep ${item.reputation} • PvP ${Number(item.pvpRating || 1000)} • ${getCurrencySymbol(item.city)}${item.balance}`
            )),
          ].join("\n")
        : "🏆 Рейтинг игроков пока пуст.",
    };
  }

  const sort = normalizeCompanyRatingSort(sortInput);
  const companies = (await storage.getAllCompanies()).filter((company) => !company.isTutorial);
  const enriched = await Promise.all(companies.map(async (company) => {
    const members = await storage.getCompanyMembers(company.id);
    const economy = await ensureCompanyEconomyState(company, members.length);
    return { company, economy };
  }));
  const sorted = [...enriched].sort((a, b) => {
    if (sort === "wealth") return b.economy.capitalGRM - a.economy.capitalGRM;
    if (sort === "blueprints") return b.company.ork - a.company.ork;
    return b.economy.companyLevel - a.economy.companyLevel;
  }).slice(0, 10);

  return {
    entity,
    sort: sort as RatingSort,
    text: sorted.length
      ? [
          "🏢 РЕЙТИНГ КОМПАНИЙ",
          "━━━━━━━━━━━━━━",
          `Сортировка: ${sort === "level" ? "уровень компании" : sort === "wealth" ? "капитал GRM" : "чертежи / ORK"}`,
          ...sorted.map((item, index) => (
            `${index + 1}. ${item.company.name} (${item.company.city})\n` +
            `   company lvl ${item.economy.companyLevel} • ORK ${item.company.ork} • ${formatNumber(item.economy.capitalGRM)} GRM`
          )),
        ].join("\n")
      : "🏢 Рейтинг компаний пока пуст.",
  };
}

function getAvailableEducationLevels(level: number) {
  return (Object.keys(EDUCATION_LEVELS) as EducationLevelKey[])
    .filter((key) => level >= EDUCATION_LEVELS[key].minLevel);
}

function resolveEducationLevel(input: string, userLevel: number): EducationLevelKey | null {
  const available = getAvailableEducationLevels(userLevel);
  const allLevels = Object.keys(EDUCATION_LEVELS) as EducationLevelKey[];
  const normalized = input.trim().toLowerCase();
  if (!normalized) return null;

  if (/^\d+$/.test(normalized)) {
    const index = Number(normalized) - 1;
    const selected = allLevels[index];
    if (!selected) return null;
    return available.includes(selected) ? selected : null;
  }
  if (["school", "школа", "🏫школа", "🏫 школа"].includes(normalized)) return available.includes("school") ? "school" : null;
  if (["college", "колледж", "🎓колледж", "🎓 колледж"].includes(normalized)) return available.includes("college") ? "college" : null;
  if (["university", "университет", "🏛университет", "🏛 университет"].includes(normalized)) return available.includes("university") ? "university" : null;
  return null;
}

function resolveEducationCourse(levelKey: EducationLevelKey, input: string) {
  const courses = EDUCATION_LEVELS[levelKey].courses;
  const normalized = input.trim().toLowerCase();
  if (!normalized) return null;
  if (/^\d+$/.test(normalized)) {
    const index = Number(normalized) - 1;
    return index >= 0 && index < courses.length ? courses[index] : null;
  }
  return courses.find((course) => course.id === normalized || course.name.toLowerCase() === normalized) ?? null;
}

function formatEducationLevelsMenu(user: User) {
  const allLevels = Object.keys(EDUCATION_LEVELS) as EducationLevelKey[];
  return [
    "📚 УРОВНИ ОБУЧЕНИЯ",
    "━━━━━━━━━━━━━━",
    ...allLevels.map((key, index) => {
      const level = EDUCATION_LEVELS[key];
      const isAvailable = user.level >= level.minLevel;
      const accessLabel = isAvailable ? "✅ Доступно" : `🔒 С ур. ${level.minLevel}`;
      return `${index + 1}. ${level.name} (ур. ${level.minLevel}-${level.maxLevel})\nКурсов: ${level.courses.length} • ${accessLabel}`;
    }),
    "",
    "Выбери уровень: отправь номер или название.",
  ].join("\n\n");
}

function formatGramExchangeMenu(snapshot: Snapshot) {
  const currency = getCurrencySymbol(snapshot.user.city);
  const localToGrmRate = getLocalToGramRate(snapshot.user.city);
  const grmToLocalRate = localToGrmRate > 0 ? 1 / localToGrmRate : 0;
  return [
    "💱 ОБМЕН ВАЛЮТЫ В GRM",
    "━━━━━━━━━━━━━━",
    `Курс покупки: 1 локальная единица = ${formatRate(localToGrmRate)} GRM`,
    `Курс продажи: 1 GRM = ${currency}${formatRate(grmToLocalRate)}`,
    `Баланс: ${currency}${formatNumber(snapshot.user.balance)}`,
    `GRM: ${formatGramValue((snapshot.game as GameView).gramBalance)} GRM`,
    "",
    "Используй кнопки ниже:",
    "🪙 Купить GRM / 💵 Продать GRM",
  ].join("\n");
}

function formatBankMenu(snapshot: Snapshot) {
  const user = snapshot.user;
  const game = snapshot.game as GameView;
  const currency = getCurrencySymbol(user.city);
  const active = game.activeBankProduct
    ? [
        game.activeBankProduct.type === "credit" ? "🔴 Активный кредит" : "🟢 Активный вклад",
        `• ${game.activeBankProduct.name}`,
        `• Сумма: ${currency}${Math.round(game.activeBankProduct.amount)}`,
        `• Осталось дней: ${Math.ceil(game.activeBankProduct.daysLeft)}`,
        `• ${game.activeBankProduct.type === "credit" ? "К возврату" : "К получению"}: ${currency}${Math.round(game.activeBankProduct.totalReturn)}`,
      ].join("\n")
    : "⚪ Активных банковских продуктов нет";

  return [
    "🏦 БАНКОВСКИЙ ЦЕНТР",
    "━━━━━━━━━━━━━━",
    `💰 Баланс: ${currency}${formatNumber(user.balance)}`,
    `🪙 GRM: ${formatGramValue(game.gramBalance)} GRM`,
    `💱 Курс: 1 локальная единица = ${formatRate(getLocalToGramRate(user.city))} GRM`,
    "━━━━━━━━━━━━━━",
    active,
    "",
    "🚧 Вклады и кредиты пока временно недоступны в городе.",
    "",
    "Выбери действие кнопками ниже.",
    "Для пополнения компании: /company_topup",
  ].join("\n");
}

async function formatStocksMenu(userId: string) {
  const snapshot = await getStockMarketSnapshot(userId);
  const user = await storage.getUser(userId);
  const currency = getCurrencySymbol(user?.city || "Сан-Франциско");
  const topQuotes = snapshot.quotes.slice(0, 3);
  const holdings = snapshot.holdings.slice(0, 5);

  return [
    "📊 БИРЖА",
    `💵 Свободный кэш: ${currency}${Math.round(snapshot.cashBalance)}`,
    `💼 Портфель: ${currency}${Math.round(snapshot.portfolioValue)}`,
    `🏦 Общая стоимость: ${currency}${Math.round(snapshot.totalValue)}`,
    snapshot.recentDividendPayouts.length
      ? `💸 Дивиденды недели: +${snapshot.recentDividendPayouts.reduce((sum, item) => sum + item.amountGram, 0).toFixed(2)} GRM`
      : "💸 Дивиденды: удерживай бумаги до следующего недельного отчёта, чтобы получать GRM.",
    snapshot.activeNews
      ? `📰 Рынок: ${snapshot.activeNews.title}\n${snapshot.activeNews.description}`
      : "📰 Рынок спокоен: без сильных новостей.",
    "",
    `Валюта торгов: ${currency}`,
    "",
    "Бумаги:",
    ...topQuotes.map((quote, index) => {
      const arrow = quote.changePercent > 0 ? "📈" : quote.changePercent < 0 ? "📉" : "➖";
      const sign = quote.changePercent > 0 ? "+" : "";
      return `${index + 1}. ${quote.ticker} · ${quote.name}\nЦена: ${currency}${quote.currentPrice.toFixed(2)} ${arrow} ${sign}${quote.changeLocal.toFixed(2)} (${sign}${quote.changePercent.toFixed(2)}%)`;
    }),
    "",
    holdings.length
      ? `Твои позиции:\n${holdings.map((holding) => {
          const sign = holding.profitPercent > 0 ? "+" : "";
          return `• ${holding.ticker} x${holding.quantity} · ${currency}${Math.round(holding.marketValue)} (${sign}${holding.profitPercent.toFixed(2)}%) · недель владения: ${holding.weeksHeld}`;
        }).join("\n")}`
      : "Твои позиции: пока пусто.",
    "",
    snapshot.watchlist.length
      ? `Будущие IPO:\n${snapshot.watchlist.map((item) => `• ${item.companyName} (${item.city}) — ${item.note}`).join("\n")}`
      : "Будущие IPO: как только компании игроков дорастут до pre-IPO, они появятся здесь.",
    "",
    "Быстрые сделки доступны кнопками ниже.",
  ].join("\n");
}

async function formatStocksNewsMenu(userId: string) {
  const snapshot = await getStockMarketSnapshot(userId);
  const sectorLines = snapshot.weeklyReport.sectorReports.map((report) => [
    `• ${report.sector.toUpperCase()} — фаза: ${report.phase}`,
    `Сейчас: ${report.currentSummary}`,
    `Следующая неделя: ${report.nextWeekSummary}`,
    `Шансы: рост ${report.growthChance}% · пик ${report.peakChance}% · падение ${report.crashChance}%`,
  ].join("\n"));
  const assetLines = snapshot.weeklyReport.assetReports.map((report) => {
    const mood = report.weeklyBias === "bullish" ? "📈" : report.weeklyBias === "bearish" ? "📉" : "➖";
    return `${mood} ${report.ticker} · ${report.name}\n${report.headline}\nОжидаемый дивиденд: ~${report.dividendForecastGram.toFixed(2)} GRM на акцию`;
  });

  return [
    `📰 ${snapshot.weeklyReport.title}`,
    snapshot.weeklyReport.summary,
    "",
    "Сектора:",
    ...sectorLines,
    "",
    "Бумаги недели:",
    ...assetLines,
    "",
    "Прогноз следующей недели не декоративный: именно эти секторные фазы будут влиять на реальные шансы роста, перегрева и коррекции в следующем цикле рынка.",
  ].join("\n\n");
}

function buildStocksHomeReplyMarkup() {
  return buildReplyKeyboard([
    ["🛒 Купить бумаги", "💸 Продать бумаги"],
    ["📰 Новости рынка"],
    ["🏦 Назад в банк"],
  ]);
}

function buildStocksQuantityReplyMarkup() {
  return buildReplyKeyboard([
    ["1", "5", "10"],
    ["🏦 Назад в банк"],
  ]);
}

function buildStocksTickerReplyMarkup(
  snapshot: Awaited<ReturnType<typeof getStockMarketSnapshot>>,
  action: "buy" | "sell",
) {
  const source = action === "buy"
    ? snapshot.quotes.slice(0, 6).map((quote) => quote.ticker)
    : snapshot.holdings.slice(0, 6).map((holding) => holding.ticker);
  const rows: string[][] = [];
  for (let index = 0; index < source.length; index += 2) {
    rows.push(source.slice(index, index + 2));
  }
  rows.push(["🏦 Назад в банк"]);
  return buildReplyKeyboard(rows);
}

function normalizeReferralCode(value: string) {
  return value.trim().toUpperCase();
}

function generateReferralCodeForUser(user: User) {
  const usernamePart = user.username.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 6) || "PLAYER";
  const idPart = user.id.replace(/-/g, "").slice(0, 6).toUpperCase();
  return normalizeReferralCode(`${usernamePart}${idPart}`);
}

function ensureReferralCodeForUser(user: User) {
  const existing = referralCodeByUserId.get(user.id);
  if (existing) return existing;

  let code = generateReferralCodeForUser(user);
  if (referralOwnerByCode.has(code) && referralOwnerByCode.get(code) !== user.id) {
    code = normalizeReferralCode(`${code}${Math.random().toString(36).slice(2, 4).toUpperCase()}`);
  }

  referralCodeByUserId.set(user.id, code);
  referralOwnerByCode.set(code, user.id);
  return code;
}

async function applyReferralFromStartPayload(player: User, startPayload?: string) {
  if (!startPayload || !startPayload.startsWith("ref_")) return null;

  const rawCode = startPayload.slice(4);
  const code = normalizeReferralCode(rawCode);
  let inviterId = referralOwnerByCode.get(code);
  if (!inviterId) {
    const users = await storage.getUsers();
    for (const candidate of users) {
      ensureReferralCodeForUser(candidate);
    }
    inviterId = referralOwnerByCode.get(code);
  }
  if (!inviterId) return { status: "invalid" as const };
  if (inviterId === player.id) return { status: "self" as const };
  if (referredByUserId.has(player.id)) return { status: "already" as const };

  const inviter = await storage.getUser(inviterId);
  if (!inviter) return { status: "invalid" as const };

  const updatedInviter = await storage.updateUser(inviter.id, {
    balance: inviter.balance + REFERRAL_INVITER_REWARD,
  });
  const updatedPlayer = await storage.updateUser(player.id, {
    balance: player.balance + REFERRAL_NEW_PLAYER_REWARD,
  });

  referredByUserId.set(player.id, inviter.id);
  const children = referralChildrenByUserId.get(inviter.id) ?? new Set<string>();
  children.add(player.id);
  referralChildrenByUserId.set(inviter.id, children);

  return {
    status: "applied" as const,
    inviter: updatedInviter,
    player: updatedPlayer,
  };
}

function buildReferralLink(code: string) {
  if (!telegramBotUsername) return `ref_${code}`;
  return `https://t.me/${telegramBotUsername}?start=ref_${code}`;
}

async function formatReferralMenu(user: User) {
  const code = ensureReferralCodeForUser(user);
  const referrals = Array.from(referralChildrenByUserId.get(user.id) ?? []);
  const referredById = referredByUserId.get(user.id);
  const inviter = referredById ? await storage.getUser(referredById) : null;
  const link = buildReferralLink(code);

  return [
    "👥 РЕФЕРАЛЬНАЯ ПРОГРАММА",
    "━━━━━━━━━━━━━━",
    `🔑 Код: ${code}`,
    `🔗 Ссылка: ${link}`,
    `🎁 Награда за друга: +${REFERRAL_INVITER_REWARD}`,
    `🆕 Бонус другу: +${REFERRAL_NEW_PLAYER_REWARD}`,
    "━━━━━━━━━━━━━━",
    "Как работает:",
    `• Пригласивший получает +${REFERRAL_INVITER_REWARD} за каждого нового игрока`,
    `• Новый игрок по ссылке получает +${REFERRAL_NEW_PLAYER_REWARD} при регистрации`,
    "• Нельзя активировать свою ссылку",
    "• Реферальный бонус привязывается только один раз",
    "",
    "Пассивный доход (Mini App):",
    "• 1+ реферал: 0.5% (кап 100/день)",
    "• 5+ рефералов: 1.0% (кап 300/день)",
    "• 10+ рефералов: 1.5% (кап 600/день)",
    "• 25+ рефералов: 2.0% (кап 1000/день)",
    "• 50+ рефералов: 3.0% (кап 2000/день)",
    "",
    `📊 Приглашено: ${referrals.length}`,
    `🙌 Тебя пригласил: ${inviter?.username ?? "никто"}`,
    "",
    "Скопируй ссылку и отправь другу в Telegram.",
  ].join("\n");
}

function formatEducationCoursesMenu(user: User, levelKey: EducationLevelKey) {
  const level = EDUCATION_LEVELS[levelKey];
  const currency = getCurrencySymbol(user.city);
  const reduction = getEducationFailureReduction(user.city, user.reputation || 0);
  const skillCap = getTrainingSkillCapForLevel(user.level);
  return [
    `📚 ${level.name.toUpperCase()}`,
    "━━━━━━━━━━━━━━",
    ...level.courses.map((course, index) => {
      const effectiveFailure = Math.max(0, course.failureChance + 10 - reduction);
      const energyCost = getStudyEnergyCostForPlayer(levelKey, course, user);
      const courseCost = getStudyCourseCostForPlayer(course, user);
      const completedMark = "";
      return `${index + 1}. ${course.icon} ${course.name}${completedMark}\n${course.description}\nНавыки курса: ${formatStats(course.skillBoosts as Record<string, number>)}\n💸 ${currency}${courseCost} | Риск: ${effectiveFailure}% | ⚡ -${Math.round(energyCost * 100)} энергии учёбы\nПотолок навыков от обучения на твоём уровне: ${skillCap}`;
    }),
    "",
    "Выбери курс: отправь номер.",
  ].join("\n\n");
}

function applyExperienceGain(user: User, gain: number) {
  let level = user.level;
  let experience = user.experience + gain;
  while (experience >= 100) {
    level += 1;
    experience -= 100;
  }
  return { level, experience };
}

function buildWelcomeMessage(user?: TelegramUser) {
  const displayName = [user?.first_name, user?.last_name].filter(Boolean).join(" ") || user?.username || "игрок";
  return [
    `Привет, ${displayName}!`,
    "",
    "Можно играть двумя способами:",
    "1) В Telegram Mini App",
    "2) Прямо в чате Telegram-бота",
    "",
    "Для текстового режима: /starttg",
  ].join("\n");
}

async function buildBotModeMessage(snapshot: Snapshot) {
  const profileText = await formatPlayerProfile(snapshot);
  const tutorialContinueLine = await getTutorialContinueLine(snapshot.user.id);
  return [
    "🎮 Режим игры в Telegram-боте активирован",
    tutorialContinueLine ?? "",
    "",
    profileText,
    "",
    tutorialContinueLine ? "Старт обучения: /tutorial" : "",
    "Используй кнопки меню ниже.",
    "Подробный список команд: /help",
  ].filter(Boolean).join("\n");
}

function buildTelegramUsernameCandidates(user: TelegramUser): string[] {
  const candidates: string[] = [];
  if (user.username && user.username.trim().length > 0) {
    const normalized = user.username.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase();
    if (normalized) candidates.push(`tg_${normalized}`.slice(0, 30));
  }
  candidates.push(`tg_${user.id}`);
  return Array.from(new Set(candidates));
}

async function generateUniqueUsername(base: string) {
  const normalized = base.slice(0, 28);
  if (!(await storage.usernameExists(normalized))) return normalized;
  for (let i = 0; i < 10; i += 1) {
    const candidate = `${normalized.slice(0, 24)}_${Math.random().toString(16).slice(2, 6)}`;
    if (!(await storage.usernameExists(candidate))) return candidate;
  }
  return `${normalized.slice(0, 20)}_${Date.now().toString(36)}`;
}

async function beginTelegramRegistration(
  token: string,
  chatId: number,
  user: User,
  startPayload?: string,
  step: RegistrationStep = "registration_intro",
) {
  const existingDraft = registrationDraftByChatId.get(chatId);
  const draft = existingDraft && existingDraft.userId === user.id
    ? { ...existingDraft }
    : { userId: user.id };

  if (startPayload) {
    draft.startPayload = startPayload;
  }

  registrationDraftByChatId.set(chatId, draft);
  pendingActionByChatId.set(chatId, { type: step });
  await sendTelegramRegistrationStepPrompt(token, chatId, step);
}

async function resolveOrCreateTelegramPlayer(user?: TelegramUser) {
  if (!user || typeof user.id !== "number") throw new Error("Telegram user is missing");
  const telegramId = String(user.id);

  const mappedUserId = getUserIdByTelegramId(telegramId);
  if (mappedUserId) {
    const mapped = await storage.getUser(mappedUserId);
    if (mapped) {
      ensureReferralCodeForUser(mapped);
      return mapped;
    }
    unbindTelegramByTelegramId(telegramId);
  }

  const candidates = buildTelegramUsernameCandidates(user);
  for (const candidate of candidates) {
    const existing = await storage.getUserByUsername(candidate);
    if (existing) {
      bindTelegramIdToUser(telegramId, existing.id);
      ensureReferralCodeForUser(existing);
      return existing;
    }
  }
  const stableUsername = candidates[candidates.length - 1] ?? `tg_${user.id}`;
  const username = await generateUniqueUsername(stableUsername);
  const created = await storage.createUser({
    username,
    password: `${TELEGRAM_PENDING_PASSWORD_PREFIX}${randomUUID()}`,
    city: "Санкт-Петербург",
    personality: "workaholic",
    gender: "male",
  });
  bindTelegramIdToUser(telegramId, created.id);
  ensureReferralCodeForUser(created);
  return created;
}

async function resolveTelegramSnapshot(user?: TelegramUser): Promise<Snapshot> {
  const player = await resolveOrCreateTelegramPlayer(user);
  const snapshot = await getUserWithGameState(player.id);
  if (!snapshot) throw new Error("Пользователь не найден");
  return snapshot;
}

function buildNumericSelectionReplyMarkup(count: number) {
  return buildNumericSelectionReplyMarkupBase(count);
}

function buildBankSelectionReplyMarkup(productType: BankProductType) {
  const count = productType === "credit" ? listCreditPrograms().length : listDepositPrograms().length;
  return buildBankSelectionReplyMarkupBase(count);
}

function buildEducationLevelsReplyMarkup(userLevel: number) {
  const available = getAvailableEducationLevels(userLevel);
  return buildEducationLevelsReplyMarkupBase(available.map((key) => EDUCATION_LEVELS[key].name));
}

function buildEducationCoursesReplyMarkup(levelKey: EducationLevelKey) {
  return buildEducationCoursesReplyMarkupBase(EDUCATION_LEVELS[levelKey].courses.length);
}

async function sendStudyCoursesSelectionMenu(
  token: string,
  chatId: number,
  player: User,
  levelKey: EducationLevelKey,
  prefix?: string,
) {
  pendingActionByChatId.set(chatId, { type: "study_course_select", levelKey });
  rememberTelegramMenu(player.id, { menu: "study_courses", levelKey });
  await sendMessage(
    token,
    chatId,
    [prefix, formatEducationCoursesMenu(player, levelKey)].filter(Boolean).join("\n\n"),
    { reply_markup: buildEducationCoursesReplyMarkup(levelKey) },
  );
}

function getCompanyMenuSection(chatId?: number) {
  if (!Number.isFinite(chatId)) return "root" as CompanyMenuSection;
  return companyMenuSectionByChatId.get(Number(chatId)) ?? "root";
}

function setCompanyMenuSection(chatId: number, section: CompanyMenuSection) {
  companyMenuSectionByChatId.set(chatId, section);
}

function getCompanyMenuParentSection(section: CompanyMenuSection): CompanyMenuSection {
  if (section === "management_hr" || section === "management_departments") return "management";
  if (section === "bureau_exclusive") return "bureau";
  return "root";
}

function rememberTelegramMenu(userId: string, state: TelegramMenuState) {
  lastTelegramMenuByUserId.set(userId, state);
}

function resolveCityTravelMenuState(command: string): { state: TelegramMenuState; label: string } | null {
  if (command === "/jobs") return { state: { menu: "jobs" }, label: "вакансиям" };
  if (command === "/study") return { state: { menu: "study_levels" }, label: "обучению" };
  if (command === "/shop") return { state: { menu: "shop", tab: "all" }, label: "магазину" };
  if (command === "/shop_parts" || command === "/shop_courses") return { state: { menu: "shop", tab: "parts" }, label: "магазину" };
  if (command === "/shop_gadgets") return { state: { menu: "shop", tab: "gadgets" }, label: "магазину" };
  if (command === "/sell") return { state: { menu: "shop", tab: "sell" }, label: "магазину" };
  if (command === "/bank" || command === "/credits" || command === "/deposits") return { state: { menu: "bank" }, label: "банку" };
  if (command === "/repair_service") return { state: { menu: "repair_service" }, label: "сервису" };
  if (command === "/housing") return { state: { menu: "housing" }, label: "недвижимости" };
  return null;
}

async function maybeStartCitySectionTravel(
  token: string,
  chatId: number,
  player: User,
  message: TelegramMessage,
  command: string,
) {
  const target = resolveCityTravelMenuState(command);
  if (!target) return false;
  if (getPlayerHubLocation(player.id) !== "city") return false;
  return false;
}

function buildCompanyReplyMarkup(role?: string | null, chatId?: number) {
  return buildCompanyReplyMarkupBase({
    role,
    section: getCompanyMenuSection(chatId),
  });
}

function getCityHubSummaryText() {
  return [
    "🏙 Город",
    "• Вакансии",
    "• Учёба",
    "• Магазин",
    "• Сервис",
    "• Банк",
    "• Недвижимость",
  ].join("\n");
}

function formatRepairDuration(ms: number) {
  return formatRepairDurationBase(ms);
}

function countWarehousePartsByType(companyId: string) {
  const counts = new Map<string, number>();
  for (const part of getCompanyWarehouseParts(companyId)) {
    counts.set(String(part.type), (counts.get(String(part.type)) ?? 0) + Math.max(1, Number(part.quantity || 1)));
  }
  return counts;
}

function hasCompanyRepairParts(companyId: string, requiredParts: RepairPartRequirement[]) {
  const counts = countWarehousePartsByType(companyId);
  return requiredParts.every((part) => (counts.get(part.type) ?? 0) >= part.quantity);
}

function formatRepairPartsAvailability(companyId: string, requiredParts: RepairPartRequirement[]) {
  const counts = countWarehousePartsByType(companyId);
  return requiredParts.map((part) => {
    const available = counts.get(part.type) ?? 0;
    const marker = available >= part.quantity ? "✔" : "•";
    return `${marker} ${part.label} x${part.quantity}${available > 0 ? ` (есть ${available})` : ""}`;
  }).join("\n");
}

function consumeCompanyRepairParts(companyId: string, requiredParts: RepairPartRequirement[]) {
  const next = [...getCompanyWarehouseParts(companyId)];
  for (const part of requiredParts) {
    let remaining = part.quantity;
    for (let index = 0; index < next.length && remaining > 0; index += 1) {
      const current = next[index];
      if (String(current.type) !== String(part.type)) continue;
      const available = Math.max(1, Number(current.quantity || 1));
      const consume = Math.min(available, remaining);
      remaining -= consume;
      const left = available - consume;
      if (left > 0) next[index] = { ...current, quantity: left };
      else next.splice(index, 1), index -= 1;
    }
    if (remaining > 0) throw new Error(`Недостаточно деталей типа "${part.label}"`);
  }
  setCompanyWarehouseParts(companyId, next);
}

function pickRepairRewardPart() {
  const all = Object.values(ALL_PARTS).filter((part) => part.rarity === "Rare" || part.rarity === "Epic");
  return all[Math.floor(Math.random() * all.length)] ?? Object.values(ALL_PARTS)[0];
}

async function grantRepairCompletionRewards(order: RepairOrder) {
  if (!order.assignedCompanyId || order.rewardGranted) return null;
  const company = await storage.getCompany(order.assignedCompanyId);
  if (!company) return null;
  const companyRewardGrm = Math.max(40, Math.round(Number(order.finalPrice || 0) / 8));
  const complexityXp = Math.max(1, Math.ceil(order.requiredParts.length + (order.maxPrice - order.minPrice) / 800));
  await storage.updateCompany(company.id, {
    balance: Number(company.balance || 0) + companyRewardGrm,
    ork: Number(company.ork || 0) + complexityXp,
  });
  const rewardPart = pickRepairRewardPart();
  if (rewardPart) {
    const nextWarehouseParts = [...getCompanyWarehouseParts(company.id)];
    const existingIndex = nextWarehouseParts.findIndex((item) => item.id === rewardPart.id && item.rarity === rewardPart.rarity);
    if (existingIndex >= 0) {
      nextWarehouseParts[existingIndex] = {
        ...nextWarehouseParts[existingIndex],
        quantity: Math.max(1, Number(nextWarehouseParts[existingIndex].quantity || 1)) + 1,
      };
    } else {
      nextWarehouseParts.push({
        id: rewardPart.id,
        name: rewardPart.name,
        type: rewardPart.type,
        rarity: normalizePartRarity(rewardPart.rarity),
        quantity: 1,
      });
    }
    setCompanyWarehouseParts(company.id, nextWarehouseParts);
  }
  order.rewardGranted = true;
  return { company, complexityXp, rewardPart, companyRewardGrm };
}

async function applyRepairFailurePenalty(order: RepairOrder) {
  if (!order.assignedCompanyId || order.rewardGranted) return null;
  const company = await storage.getCompany(order.assignedCompanyId);
  if (!company) return null;
  const fine = Math.max(25, Math.round(Math.max(0, Number(order.finalPrice || order.maxPrice || 0) / 8) * 0.15));
  await storage.updateCompany(company.id, {
    balance: Math.max(0, Number(company.balance || 0) - fine),
    ork: Math.max(0, Number(company.ork || 0) - 1),
  });
  order.rewardGranted = true;
  return { company, fine };
}

async function processRepairOrderSweep(token: string) {
  const events = await sweepRepairOrders();
  for (const event of events) {
    try {
      if (event.type === "completed") {
        const reward = await grantRepairCompletionRewards(event.order);
        const playerChatId = Number(getTelegramIdByUserId(event.order.playerId) || event.order.playerChatId || 0);
        if (Number.isFinite(playerChatId) && playerChatId > 0) {
          await sendMessage(token, playerChatId, [
            "✅ Ремонт завершён.",
            `Гаджет: ${event.order.gadgetName}`,
            `Списано: ${getCurrencySymbol(event.order.city)}${event.charged}.`,
          ].join("\n"));
        }
        const companyChatId = Number(event.order.companyChatId || 0);
        if (Number.isFinite(companyChatId) && companyChatId > 0) {
          await sendMessage(token, companyChatId, [
            "✅ Заказ сервиса завершён.",
            `Гаджет: ${event.order.gadgetName}`,
            reward ? `Компания получила: ${reward.companyRewardGrm} GRM` : "",
            reward ? `XP компании: +${reward.complexityXp}` : "",
            reward?.rewardPart ? `Награда: ${reward.rewardPart.name} x1` : "",
          ].filter(Boolean).join("\n"));
        }
        continue;
      }

      if (event.type === "failed") {
        const penalty = await applyRepairFailurePenalty(event.order);
        const playerChatId = Number(getTelegramIdByUserId(event.order.playerId) || event.order.playerChatId || 0);
        if (Number.isFinite(playerChatId) && playerChatId > 0) {
          await sendMessage(token, playerChatId, [
            "⚠️ Заказ на ремонт сорвался.",
            `Гаджет: ${event.order.gadgetName}`,
            "Гаджет разблокирован. Можно отправить его в сервис повторно.",
          ].join("\n"));
        }
        const companyChatId = Number(event.order.companyChatId || 0);
        if (Number.isFinite(companyChatId) && companyChatId > 0) {
          await sendMessage(token, companyChatId, [
            "❌ Компания не выполнила заказ. Штраф.",
            `Гаджет: ${event.order.gadgetName}`,
            `Причина: ${event.reason}`,
            penalty ? `Штраф: ${penalty.fine} GRM` : "",
          ].filter(Boolean).join("\n"));
        }
        continue;
      }

      console.warn(`[repair] recovery action order=${event.orderId} reason=${event.reason}`);
    } catch (error) {
      console.error("repair sweep notification error:", error);
    }
  }
}

function getHousingTravelDurationMs(user: Pick<User, "city" | "tutorialState">, baseMs: number) {
  const activeHouse = getActiveHousing(user);
  return Math.max(1500, Math.round(baseMs * Math.max(0.5, Number(activeHouse?.bonuses.travelTimeMultiplier ?? 1))));
}

function getPlayerHubLocation(userId: string): PlayerHubLocation {
  return playerLocationByUserId.get(userId) ?? "home";
}

function setPlayerHubLocation(userId: string, location: PlayerHubLocation) {
  playerLocationByUserId.set(userId, location);
}

async function sendShopMenu(token: string, chatId: number, snapshot: Snapshot, userId: string, tab: ShopMenuTab = "all") {
  rememberTelegramMenu(userId, { menu: "shop", tab });
  if (tab === "sell") {
    const sellView = buildShopSellMenu(snapshot);
    if (!sellView.refs.length) {
      pendingActionByChatId.delete(chatId);
      await sendMessage(token, chatId, sellView.text, { reply_markup: SHOP_MENU_REPLY_MARKUP });
      return;
    }
    shopSellRefsByChatId.set(chatId, sellView.refs);
    pendingActionByChatId.set(chatId, { type: "shop_sell" });
    await sendMessage(token, chatId, sellView.text, { reply_markup: SHOP_MENU_REPLY_MARKUP });
    return;
  }

  if (tab === "parts" || tab === "gadgets") {
    const items = listShopItems().filter((item) => tab === "parts" ? item.type === "consumable" : item.type === "gear");
    shopBuyRefsByChatId.set(chatId, items.map((item) => item.id));
    pendingActionByChatId.set(chatId, { type: "shop_buy" });
  } else {
    shopBuyRefsByChatId.delete(chatId);
    pendingActionByChatId.delete(chatId);
  }
  await sendMessage(token, chatId, formatShopMenu(snapshot, tab), { reply_markup: SHOP_MENU_REPLY_MARKUP });
}

async function formatRepairServiceMenu(userId: string, chatId: number) {
  return await formatRepairServiceMenuBase({
    userId,
    chatId,
    storage,
    listRepairableGadgets,
    listRepairOrdersForCity: (city) => listRepairOrdersForCity(city).map((order) => ({
      ...order,
      statusLabel: getRepairOrderStatusLabel(order.status),
    })),
    repairGadgetRefsByChatId,
    repairOrderRefsByChatId,
    calculateRepairEstimate,
    getGadgetConditionStatusLabel,
    getCurrencySymbol,
  });
}

function buildRepairServiceInlineMarkup(chatId: number) {
  return buildRepairServiceInlineMarkupBase(chatId, repairGadgetRefsByChatId, repairOrderRefsByChatId);
}

async function sendRepairServiceMenu(token: string, chatId: number, userId: string, prefix?: string) {
  await sendRepairServiceMenuBase({
    token,
    chatId,
    userId,
    prefix,
    rememberTelegramMenu,
    formatRepairServiceMenu,
    buildRepairServiceInlineMarkup,
    sendMessage,
  });
}

async function formatCompanyRepairServiceMenu(membership: CompanyContext, chatId: number) {
  return await formatCompanyRepairServiceMenuBase({
    membership,
    chatId,
    listRepairOrdersForCity,
    listRepairOrdersForCompany: (companyId) => listRepairOrdersForCompany(companyId).map((order) => ({
      ...order,
      statusLabel: getRepairOrderStatusLabel(order.status),
    })),
    companyRepairOrderRefsByChatId,
    getCurrencySymbol,
    formatRepairPartsAvailability,
    hasCompanyRepairParts,
  });
}

function buildCompanyRepairServiceInlineMarkup(membership: CompanyContext) {
  return buildCompanyRepairServiceInlineMarkupBase({
    membership,
    listRepairOrdersForCity,
    hasCompanyRepairParts,
  });
}

async function sendCompanyRepairServiceMenu(token: string, chatId: number, membership: CompanyContext, playerId: string, prefix?: string) {
  await sendCompanyRepairServiceMenuBase({
    token,
    chatId,
    membership,
    playerId,
    prefix,
    setCompanyMenuSection,
    rememberTelegramMenu,
    formatCompanyRepairServiceMenu,
    buildCompanyRepairServiceInlineMarkup,
    sendMessage,
  });
}

async function sendCityHubSummary(token: string, chatId: number, userId: string, prefix?: string) {
  rememberTelegramMenu(userId, { menu: "city" });
  const text = prefix ? `${prefix}\n\n${getCityHubSummaryText()}` : getCityHubSummaryText();
  await sendWithCityHubKeyboard(token, chatId, text);
}

async function sendHomeMenu(token: string, chatId: number, snapshot: Snapshot, userId: string, prefix?: string) {
  rememberTelegramMenu(userId, { menu: "home" });
  const notices = await shouldSuppressNonRegistrationMessages(userId) ? "" : formatNotices(snapshot.notices);
  const base = await buildBotModeMessage(snapshot);
  const text = [prefix, notices ? `${base}\n\n${notices}` : base].filter(Boolean).join("\n\n");
  await sendWithHomeKeyboard(token, chatId, text);
}

async function sendCompanyRootMenu(token: string, chatId: number, player: User, prefix?: string) {
  await sendCompanyRootMenuBase({
    token,
    chatId,
    player,
    prefix,
    rememberTelegramMenu,
    setCompanyMenuSection,
    getPlayerCompanyContext,
    sendMessage,
    buildCompanyReplyMarkup,
    sendCompanyProfile,
    storage,
    getTopCompanies,
    companyListByChatId,
    formatCompanyMenuWithoutMembership,
  });
}

async function restoreTelegramMenuState(token: string, chatId: number, player: User, message: TelegramMessage, prefix?: string) {
  const state = lastTelegramMenuByUserId.get(player.id);
  if (!state) {
    const snapshot = await resolveTelegramSnapshot(message.from);
    await sendHomeMenu(token, chatId, snapshot, player.id, prefix);
    return;
  }

  if (state.menu === "extras") {
    rememberTelegramMenu(player.id, state);
    await sendWithExtrasKeyboard(
      token,
      chatId,
      [prefix, ["🧩 Допы", "• Рейтинг", "• Квесты", "• Репутация", "• Рефералы"].join("\n")].filter(Boolean).join("\n\n"),
    );
    return;
  }

  if (state.menu === "home") {
    const snapshot = await resolveTelegramSnapshot(message.from);
    await sendHomeMenu(token, chatId, snapshot, player.id, prefix);
    return;
  }

  if (state.menu === "city") {
    setPlayerHubLocation(player.id, "city");
    await sendCityHubSummary(token, chatId, player.id, prefix);
    return;
  }

  if (state.menu === "repair_service") {
    setPlayerHubLocation(player.id, "city");
    await sendRepairServiceMenu(token, chatId, player.id, prefix);
    return;
  }

  if (state.menu === "housing") {
    setPlayerHubLocation(player.id, "city");
    const refreshedUser = await storage.getUser(player.id);
    if (!refreshedUser) {
      const snapshot = await resolveTelegramSnapshot(message.from);
      await sendHomeMenu(token, chatId, snapshot, player.id, prefix);
      return;
    }
    const house = getActiveHousing(refreshedUser) ?? getStarterHousingForCity(refreshedUser.city);
    if (!house) {
      await sendCityHubSummary(token, chatId, player.id, prefix ?? "Недвижимость в этом городе пока закрыта.");
      return;
    }
    rememberTelegramMenu(player.id, state);
    await sendHousingCard(token, chatId, refreshedUser, house, prefix ?? formatHousingMenuText(refreshedUser));
    return;
  }

  if (state.menu === "jobs") {
    setPlayerHubLocation(player.id, "city");
    rememberTelegramMenu(player.id, state);
    const snapshot = await resolveTelegramSnapshot(message.from);
    const jobsCount = listJobsByCity(snapshot.user.city, getPlayerProfessionId(snapshot.user), snapshot.user.level).length;
    if (jobsCount <= 0) {
      await sendCityHubSummary(token, chatId, player.id, prefix ?? "В вашем городе сейчас нет вакансий.");
      return;
    }
    pendingActionByChatId.set(chatId, { type: "job_select" });
    await sendMessage(token, chatId, [prefix, formatJobsMenu(snapshot)].filter(Boolean).join("\n\n"), {
      reply_markup: buildJobsInlineMarkup(snapshot),
    });
    return;
  }

  if (state.menu === "study_levels") {
    setPlayerHubLocation(player.id, "city");
    rememberTelegramMenu(player.id, state);
    pendingActionByChatId.set(chatId, { type: "study_level_select" });
    await sendMessage(token, chatId, [prefix, formatEducationLevelsMenu(player)].filter(Boolean).join("\n\n"), {
      reply_markup: buildEducationLevelsReplyMarkup(player.level),
    });
    return;
  }

  if (state.menu === "study_courses") {
    setPlayerHubLocation(player.id, "city");
    rememberTelegramMenu(player.id, state);
    pendingActionByChatId.set(chatId, { type: "study_course_select", levelKey: state.levelKey });
    await sendMessage(token, chatId, [prefix, formatEducationCoursesMenu(player, state.levelKey)].filter(Boolean).join("\n\n"), {
      reply_markup: buildEducationCoursesReplyMarkup(state.levelKey),
    });
    return;
  }

  if (state.menu === "shop") {
    setPlayerHubLocation(player.id, "city");
    const snapshot = await resolveTelegramSnapshot(message.from);
    if (prefix) {
      await sendWithCityHubKeyboard(token, chatId, prefix);
    }
    await sendShopMenu(token, chatId, snapshot, player.id, state.tab);
    return;
  }

  if (state.menu === "bank") {
    setPlayerHubLocation(player.id, "city");
    rememberTelegramMenu(player.id, state);
    const snapshot = await resolveTelegramSnapshot(message.from);
    await sendWithBankKeyboard(token, chatId, [prefix, formatBankMenu(snapshot)].filter(Boolean).join("\n\n"));
    return;
  }

  setPlayerHubLocation(player.id, "company");
  setCompanyMenuSection(chatId, state.section);
  rememberTelegramMenu(player.id, state);
  const membership = await getPlayerCompanyContext(player.id);
  if (!membership) {
    await sendCompanyRootMenu(token, chatId, player, prefix);
    return;
  }
  if (state.section === "work") {
    if (prefix) {
      await sendMessage(token, chatId, prefix, { reply_markup: buildCompanyReplyMarkup(membership.role, chatId) });
    }
    await sendCompanyWorkSection(token, chatId, membership);
    return;
  }
  if (state.section === "warehouse") {
    if (prefix) {
      await sendMessage(token, chatId, prefix, { reply_markup: buildCompanyReplyMarkup(membership.role, chatId) });
    }
    await sendCompanyWarehouseSection(token, chatId, membership, player.id);
    return;
  }
  if (state.section === "service") {
    if (prefix) {
      await sendMessage(token, chatId, prefix, { reply_markup: buildCompanyReplyMarkup(membership.role, chatId) });
    }
    await sendCompanyRepairServiceMenu(token, chatId, membership, player.id);
    return;
  }
  if (state.section === "bureau" || state.section === "bureau_exclusive") {
    if (prefix) {
      await sendMessage(token, chatId, prefix, { reply_markup: buildCompanyReplyMarkup(membership.role, chatId) });
    }
    await sendCompanyBureauSection(token, chatId, membership, player.id);
    return;
  }
  if (state.section === "management") {
    if (prefix) {
      await sendMessage(token, chatId, prefix, { reply_markup: buildCompanyReplyMarkup(membership.role, chatId) });
    }
    await sendCompanyManagementSection(token, chatId, membership);
    return;
  }
  if (state.section === "management_hr") {
    await sendWithCurrentHubKeyboard(token, chatId, player.id, [prefix, "👥 HR компании"].filter(Boolean).join("\n\n"));
    return;
  }
  if (state.section === "management_departments") {
    if (prefix) {
      await sendMessage(token, chatId, prefix, { reply_markup: buildCompanyReplyMarkup(membership.role, chatId) });
    }
    await sendCompanyDepartmentsSection(token, chatId, membership);
    return;
  }
  await sendCompanyRootMenu(token, chatId, player, prefix);
}

async function forceReturnHome(token: string, chatId: number, player: User, message: TelegramMessage, reason: string) {
  const activeTravel = playerTravelByUserId.get(player.id);
  if (activeTravel) {
    const secondsLeft = getTravelRemainingSeconds(player.id);
    await sendWithMainKeyboard(token, chatId, `🚶 Вы уже в пути в ${formatTravelTargetLabel(activeTravel.target)}. Осталось ~${secondsLeft} сек.`);
    return;
  }
  if (!(await ensureExclusiveActionAllowed(token, chatId, player.id, "travel"))) {
    return;
  }

  const currentLocation = getPlayerHubLocation(player.id);
  if (currentLocation === "home") {
    const snapshot = await resolveTelegramSnapshot(message.from);
    await sendHomeMenu(token, chatId, snapshot, player.id, reason);
    return;
  }

  const travelMs = currentLocation === "company" ? TRAVEL_TO_COMPANY_MS : TRAVEL_TO_CITY_MS;
  const travelSec = Math.ceil(travelMs / 1000);
  const arrivesAtMs = Date.now() + travelMs;
  await sendWithMainKeyboard(token, chatId, `${reason}\n\n🚶 Возвращаемся домой. Прибытие через ${travelSec} сек.`);
  const timer = setTimeout(async () => {
    try {
      const state = playerTravelByUserId.get(player.id);
      if (!state || state.arrivesAtMs !== arrivesAtMs || state.target !== "home") return;
      playerTravelByUserId.delete(player.id);
      setPlayerHubLocation(player.id, "home");
      const snapshot = await resolveTelegramSnapshot(message.from);
      await sendHomeMenu(token, state.chatId, snapshot, player.id, "✅ Вы вернулись домой.");
    } catch (error) {
      console.error("Forced travel to home completion error:", error);
    }
  }, travelMs);
  playerTravelByUserId.set(player.id, { target: "home", arrivesAtMs, timer, chatId });
}

async function ensureCityHubAccess(token: string, chatId: number, player: User, message: TelegramMessage) {
  const location = getPlayerHubLocation(player.id);
  if (location === "city") return true;
  if (location === "company") {
    await forceReturnHome(token, chatId, player, message, "⛔ Из компании нельзя сразу перейти в городские разделы.");
    return false;
  }
  await sendWithMainKeyboard(token, chatId, "⛔ Сначала выйди в город кнопкой «🏙 Город».");
  return false;
}

async function ensureCompanyHubAccess(token: string, chatId: number, player: User, message: TelegramMessage) {
  const location = getPlayerHubLocation(player.id);
  if (location === "company") return true;
  if (location === "city") {
    await forceReturnHome(token, chatId, player, message, "⛔ Из города нельзя сразу перейти в меню компании.");
    return false;
  }
  await sendWithMainKeyboard(token, chatId, "⛔ Сначала открой компанию из дома.");
  return false;
}

async function handleCancelCommand(token: string, chatId: number, message: TelegramMessage) {
  const player = await resolveOrCreateTelegramPlayer(message.from);
  const pendingAction = pendingActionByChatId.get(chatId);
  pendingActionByChatId.delete(chatId);
  stopPvpQueuePolling(chatId);

  if (pendingAction?.type === "job_select") {
    await sendCityHubSummary(token, chatId, player.id);
    return;
  }
  if (pendingAction?.type === "study_course_select") {
    pendingActionByChatId.set(chatId, { type: "study_level_select" });
    rememberTelegramMenu(player.id, { menu: "study_levels" });
    await sendMessage(token, chatId, formatEducationLevelsMenu(player), {
      reply_markup: buildEducationLevelsReplyMarkup(player.level),
    });
    return;
  }
  if (pendingAction?.type === "study_level_select") {
    await sendCityHubSummary(token, chatId, player.id);
    return;
  }
  if (pendingAction?.type === "shop_buy" || pendingAction?.type === "shop_sell") {
    const snapshot = await resolveTelegramSnapshot(message.from);
    await sendShopMenu(token, chatId, snapshot, player.id, "all");
    return;
  }
  if (
    pendingAction?.type === "open_bank_product"
    || pendingAction?.type === "exchange_to_gram"
    || pendingAction?.type === "exchange_from_gram"
  ) {
    const snapshot = await resolveTelegramSnapshot(message.from);
    rememberTelegramMenu(player.id, { menu: "bank" });
    await sendWithBankKeyboard(token, chatId, formatBankMenu(snapshot));
    return;
  }
  if (
    pendingAction?.type === "company_part_deposit"
    || pendingAction?.type === "company_part_deposit_qty"
    || pendingAction?.type === "company_contract_parts"
    || pendingAction?.type === "company_exclusive_name"
    || pendingAction?.type === "company_exclusive_parts"
    || pendingAction?.type === "company_exclusive_produce_select"
    || pendingAction?.type === "company_exclusive_produce_qty"
    || pendingAction?.type === "company_exclusive_produce_confirm"
    || pendingAction?.type === "company_bp_produce_qty"
    || pendingAction?.type === "company_bp_produce_confirm"
  ) {
    const parentSection = getCompanyMenuParentSection(getCompanyMenuSection(chatId));
    setCompanyMenuSection(chatId, parentSection);
    if (parentSection === "management") {
      rememberTelegramMenu(player.id, { menu: "company", section: "management" });
      await sendWithCurrentHubKeyboard(token, chatId, player.id, "🛠 Управление компанией");
      return;
    }
    if (parentSection === "bureau") {
      rememberTelegramMenu(player.id, { menu: "company", section: "bureau" });
      await sendWithCurrentHubKeyboard(token, chatId, player.id, "🧪 Бюро компании");
      return;
    }
    await sendCompanyRootMenu(token, chatId, player);
    return;
  }

  const companySection = getCompanyMenuSection(chatId);
  if (getPlayerHubLocation(player.id) === "company" && companySection !== "root") {
    const parentSection = getCompanyMenuParentSection(companySection);
    setCompanyMenuSection(chatId, parentSection);
    if (parentSection === "management") {
      rememberTelegramMenu(player.id, { menu: "company", section: "management" });
      await sendWithCurrentHubKeyboard(token, chatId, player.id, "🛠 Управление компанией");
      return;
    }
    if (parentSection === "bureau") {
      rememberTelegramMenu(player.id, { menu: "company", section: "bureau" });
      await sendWithCurrentHubKeyboard(token, chatId, player.id, "🧪 Бюро компании");
      return;
    }
    await sendCompanyRootMenu(token, chatId, player);
    return;
  }

  const location = getPlayerHubLocation(player.id);
  if (location === "city") {
    await sendCityHubSummary(token, chatId, player.id);
    return;
  }
  if (location === "company") {
    await sendCompanyRootMenu(token, chatId, player);
    return;
  }

  const snapshot = await resolveTelegramSnapshot(message.from);
  await sendHomeMenu(token, chatId, snapshot, player.id, "Действие отменено.");
}

function clearPlayerTravel(userId: string) {
  const state = playerTravelByUserId.get(userId);
  if (state) {
    clearTimeout(state.timer);
    playerTravelByUserId.delete(userId);
  }
}

function getTravelRemainingSeconds(userId: string) {
  const state = playerTravelByUserId.get(userId);
  if (!state) return 0;
  return Math.max(0, Math.ceil((state.arrivesAtMs - Date.now()) / 1000));
}

function formatTravelTargetLabel(target: PlayerHubLocation) {
  if (target === "city") return "город";
  if (target === "company") return "компанию";
  return "дом";
}

function formatExclusiveActionLabel(action: ExclusiveActionIntent) {
  if (action === "job") return "работа (вакансии)";
  if (action === "study") return "учёба";
  if (action === "development") return "разработка гаджета";
  if (action === "pvp") return "PvP дуэль";
  return "перемещение";
}

function isCommandCompatibleWithExclusiveAction(command: string, current: ExclusiveActionIntent) {
  const cmd = String(command || "").toLowerCase();
  if (cmd === "/cancel" || cmd === "/help") return true;

  if (current === "job") {
    return cmd === "/jobs" || cmd === "/job";
  }

  if (current === "study") {
    return cmd === "/study";
  }

  if (current === "development") {
    return (
      cmd === "/company"
      || cmd === "/company_back"
      || cmd === "/company_menu_work"
      || cmd === "/company_menu_warehouse"
      || cmd === "/company_menu_bureau"
      || cmd === "/company_menu_management"
      || cmd === "/company_menu_hackathon"
      || cmd === "/company_menu_hackathon_event"
      || cmd === "/company_menu_hackathon_sabotage"
      || cmd === "/company_work"
      || cmd === "/company_mining"
      || cmd === "/company_warehouse"
      || cmd === "/company_bureau"
      || cmd === "/company_management"
      || cmd === "/company_economy"
      || cmd === "/company_departments"
      || cmd === "/company_ipo"
      || cmd === "/company_exclusive"
      || cmd === "/company_exclusive_progress"
      || cmd === "/company_exclusive_produce"
      || cmd.startsWith("/company_bp_")
    );
  }

  if (current === "pvp") {
    return (
      cmd === "/pvp"
      || cmd === "/pvp_find"
      || cmd === "/pvp_leave"
      || cmd === "/pvp_history"
      || cmd === "/status"
      || cmd === "/me"
    );
  }

  // While traveling, only allow hub navigation/status commands.
  return (
    cmd === "/menu"
    || cmd === "/profile"
    || cmd === "/me"
    || cmd === "/status"
    || cmd === "/city_hub"
    || cmd === "/company"
  );
}

function getPendingExclusiveAction(chatId: number): ExclusiveActionIntent | null {
  const pending = pendingActionByChatId.get(chatId);
  if (!pending) return null;
  if (pending.type === "job_select") return "job";
  if (pending.type === "study_level_select" || pending.type === "study_course_select") return "study";
  return null;
}

async function getCurrentExclusiveAction(userId: string, chatId: number): Promise<ExclusiveActionIntent | null> {
  if (playerTravelByUserId.has(userId)) return "travel";
  const pendingAction = getPendingExclusiveAction(chatId);
  if (pendingAction) return pendingAction;
  const membership = await getPlayerCompanyContext(userId);
  try {
    const pvpState = await callInternalApi("GET", `/api/pvp/status?userId=${encodeURIComponent(userId)}`) as any;
    if (pvpState?.inQueue) return "pvp";
  } catch {
    // ignore API failures in lock check
  }
  if (!membership) return null;
  try {
    const snapshot = await getCompanyBlueprintSnapshot(membership.company.id);
    if (snapshot.active?.status === "in_progress") return "development";
  } catch {
    // ignore API failures in lock check
  }
  try {
    const exclusiveSnapshot = await getCompanyExclusiveSnapshot(membership.company.id);
    if (exclusiveSnapshot.active?.status === "in_progress") return "development";
  } catch {
    // ignore API failures in lock check
  }
  return null;
}

async function ensureExclusiveActionAllowed(
  token: string,
  chatId: number,
  userId: string,
  intent: ExclusiveActionIntent,
) {
  const current = await getCurrentExclusiveAction(userId, chatId);
  if (current && current !== intent) {
    await sendWithCurrentHubKeyboard(
      token,
      chatId,
      userId,
      `⛔ Сейчас уже выполняется действие: ${formatExclusiveActionLabel(current)}.\nЗаверши его перед началом нового или нажми «⬅️ Назад».`,
    );
    return false;
  }
  return true;
}

async function ensureCompanyProcessUnlocked(
  token: string,
  chatId: number,
  userId: string,
  companyId: string,
  actionLabel: string,
) {
  try {
    const exclusiveSnapshot = await getCompanyExclusiveSnapshot(companyId);
    if (exclusiveSnapshot.active?.status === "in_progress") {
      await sendWithCurrentHubKeyboard(
        token,
        chatId,
        userId,
        `⛔ ${actionLabel} недоступен, пока идёт разработка редкого гаджета.\nОткрой «Разработка редких гаджетов» и дождись завершения таймера.`,
      );
      return false;
    }
  } catch {
    // ignore snapshot failures
  }
  return true;
}

function isCompanyDepartmentKey(value: string): value is CompanyDepartmentKey {
  return COMPANY_DEPARTMENT_ORDER.includes(value as CompanyDepartmentKey);
}

function resolveCompanyDepartmentKey(value: string): CompanyDepartmentKey | null {
  const normalized = value.trim();
  if (isCompanyDepartmentKey(normalized)) return normalized;
  const lowered = normalized.toLowerCase();
  return COMPANY_DEPARTMENT_ORDER.find((key) => key.toLowerCase() === lowered) ?? null;
}

function resolveInventoryRefFromChat(chatId: number, ref: string) {
  const trimmed = ref.trim();
  if (!/^\d+$/.test(trimmed)) return trimmed;
  const refs = inventoryRefsByChatId.get(chatId) ?? [];
  const index = Number(trimmed) - 1;
  if (index >= 0 && index < refs.length) return refs[index];
  return trimmed;
}

function resolveShopSellRefFromChat(chatId: number, ref: string) {
  const trimmed = ref.trim();
  if (!/^\d+$/.test(trimmed)) return trimmed;
  const refs = shopSellRefsByChatId.get(chatId) ?? [];
  const index = Number(trimmed) - 1;
  if (index >= 0 && index < refs.length) return refs[index];
  return trimmed;
}

function resolveShopBuyRefFromChat(chatId: number, ref: string) {
  const trimmed = ref.trim();
  if (!/^\d+$/.test(trimmed)) return trimmed;
  const refs = shopBuyRefsByChatId.get(chatId) ?? [];
  const index = Number(trimmed) - 1;
  if (index >= 0 && index < refs.length) return refs[index];
  return trimmed;
}

function formatCompanyPartDepositList(game: GameView, chatId: number, withQuickCommands = false) {
  const partItems = game.inventory.filter((item) => item.type === "part");
  const refs = partItems.map((item) => item.id);
  companyPartDepositRefsByChatId.set(chatId, refs);

  if (!partItems.length) {
    return "❌ В вашем инвентаре нет запчастей для переноса на склад компании.";
  }

  return [
    "📦 Перенос запчастей на склад компании",
    "━━━━━━━━━━━━━━",
    ...partItems.map((item, index) => {
      const qty = Math.max(1, Number(item.quantity) || 1);
      const rarity = normalizePartRarity(String(item.rarity || "Common"));
      const commandHint = withQuickCommands ? `  · /cpd${index + 1}` : "";
      return `${index + 1}. ${stripLeadingRarityBadgeFromName(item.name)} x${qty} (${formatRarityBadge(rarity)})${commandHint}`;
    }),
    "",
    withQuickCommands
      ? "Нажми /cpdN (например: /cpd1) или отправь номер."
      : "Открой список: /company_part_deposit",
    "Пример: /cpd1",
  ].join("\n");
}

async function ensureTutorialStarterParts(userId: string) {
  const snapshot = await getUserWithGameState(userId);
  if (!snapshot) return;
  const game = snapshot.game as GameView;
  const inventory = [...(game.inventory ?? [])];
  const desiredTypes = ["processor", "display", "battery", "case"] as const;
  const starterDefs = desiredTypes
    .map((type) => Object.values(ALL_PARTS).find((part) => part.type === type && part.rarity === "Common"))
    .filter((part): part is NonNullable<typeof part> => Boolean(part));
  if (!starterDefs.length) return;

  let changed = false;
  const next = [...inventory];
  for (const part of starterDefs) {
    const existingIndex = next.findIndex((item) => item.type === "part" && item.id === part.id);
    if (existingIndex >= 0) {
      const have = Math.max(1, Number(next[existingIndex].quantity) || 1);
      if (have < 3) {
        next[existingIndex] = { ...next[existingIndex], quantity: 3 };
        changed = true;
      }
      continue;
    }
    next.push({
      id: part.id,
      name: part.name,
      type: "part",
      stats: part.stats as Record<string, number>,
      rarity: part.rarity,
      quantity: 3,
    });
    changed = true;
  }

  if (changed) {
    applyGameStatePatch(userId, { inventory: next });
  }
}

async function sendWithHomeKeyboard(token: string, chatId: number, text: string) {
  await sendWithMainKeyboardBase({
    token,
    chatId,
    text,
    getUserIdByTelegramId,
    getTutorialSnapshotByUser,
  });
}

async function sendWithMainKeyboard(token: string, chatId: number, text: string) {
  const userId = getUserIdByTelegramId(String(chatId));
  if (!userId) {
    await sendWithHomeKeyboard(token, chatId, text);
    return;
  }

  await sendWithCurrentHubKeyboardBase({
    token,
    chatId,
    userId,
    text,
    getPlayerHubLocation,
    getPlayerCompanyContext,
    buildCompanyReplyMarkup,
    sendWithMainKeyboard: async (input) => sendWithHomeKeyboard(input.token, input.chatId, input.text),
    getUserIdByTelegramId,
    getTutorialSnapshotByUser,
  });
}

async function sendWithExtrasKeyboard(token: string, chatId: number, text: string) {
  await sendWithExtrasKeyboardBase(token, chatId, text);
}

async function sendWithCityHubKeyboard(token: string, chatId: number, text: string) {
  await sendWithCityHubKeyboardBase(token, chatId, text);
}

async function sendWithAdminKeyboard(token: string, chatId: number, text: string) {
  await sendWithAdminKeyboardBase(token, chatId, text);
}

async function sendWithBankKeyboard(token: string, chatId: number, text: string) {
  await sendWithBankKeyboardBase(token, chatId, text);
}

async function sendWithCurrentHubKeyboard(token: string, chatId: number, userId: string, text: string) {
  await sendWithCurrentHubKeyboardBase({
    token,
    chatId,
    userId,
    text,
    getPlayerHubLocation,
    getPlayerCompanyContext,
    buildCompanyReplyMarkup,
    sendWithMainKeyboard: async (input) => sendWithHomeKeyboard(input.token, input.chatId, input.text),
    getUserIdByTelegramId,
    getTutorialSnapshotByUser,
  });
}

function clearPendingActionRuntimeState(chatId: number, pendingAction: PendingAction) {
  pendingActionByChatId.delete(chatId);

  if (
    pendingAction.type === "company_contract_parts"
  ) {
    companyContractSelectedPartRefsByChatId.delete(chatId);
    companyContractPartRefsByChatId.delete(chatId);
    companyContractPartPageByChatId.delete(chatId);
  }

  if (
    pendingAction.type === "company_exclusive_name"
    || pendingAction.type === "company_exclusive_parts"
    || pendingAction.type === "company_exclusive_produce_select"
    || pendingAction.type === "company_exclusive_produce_qty"
    || pendingAction.type === "company_exclusive_produce_confirm"
  ) {
    companyExclusiveSelectedPartRefsByChatId.delete(chatId);
    companyExclusivePartRefsByChatId.delete(chatId);
    companyExclusivePartPageByChatId.delete(chatId);
  }
}

async function tryHandlePendingAction(token: string, chatId: number, text: string, message: TelegramMessage) {
  const pendingAction = pendingActionByChatId.get(chatId);
  if (!pendingAction) return false;

  const normalizedCommand = normalizeCommand(text).command;
  const allowSlashCommandsInsidePending =
    pendingAction.type === "company_exclusive_parts"
    && (
      /^\/det\d+$/i.test(text.trim())
      || /^\/det_done$/i.test(text.trim())
      || /^\/det_reset$/i.test(text.trim())
      || normalizedCommand === "/company_back"
      || normalizedCommand === "/cancel"
    );

  if (text.startsWith("/") && !allowSlashCommandsInsidePending) return false;

  const aliasCommand = resolvePlainTextAlias(text, chatId);
  const canEscapeStickyPending = new Set<PendingAction["type"]>([
    "advanced_personality_select",
    "change_city",
    "job_select",
    "shop_buy",
    "shop_sell",
    "open_bank_product",
    "exchange_to_gram",
    "exchange_from_gram",
    "stocks_buy_select",
    "stocks_buy_qty",
    "stocks_sell_select",
    "stocks_sell_qty",
    "company_create",
    "company_part_deposit",
    "company_part_deposit_qty",
    "company_contract_parts",
    "company_topup",
    "company_bp_produce_qty",
    "company_bp_produce_confirm",
    "company_exclusive_name",
    "company_exclusive_produce_select",
    "company_exclusive_produce_qty",
    "company_exclusive_produce_confirm",
    "study_level_select",
    "study_course_select",
    "admin_auth",
    "admin_add_money",
    "admin_add_exp",
  ]);
  const isEscapeAttempt =
    aliasCommand === "/company_back"
    || normalizedCommand === "/cancel"
    || normalizedCommand === "/start"
    || normalizedCommand === "/starttg"
    || (normalizedCommand.startsWith("/") && normalizedCommand !== "/help");
  if (canEscapeStickyPending.has(pendingAction.type) && isEscapeAttempt) {
    clearPendingActionRuntimeState(chatId, pendingAction);
    return false;
  }

  if (
    aliasCommand
    && (
      pendingAction.type === "shop_buy"
      || pendingAction.type === "shop_sell"
      || pendingAction.type === "study_level_select"
      || pendingAction.type === "study_course_select"
      || pendingAction.type === "job_select"
      || pendingAction.type === "open_bank_product"
      || pendingAction.type === "exchange_to_gram"
      || pendingAction.type === "exchange_from_gram"
      || pendingAction.type === "stocks_buy_select"
      || pendingAction.type === "stocks_buy_qty"
      || pendingAction.type === "stocks_sell_select"
      || pendingAction.type === "stocks_sell_qty"
    )
  ) {
    return false;
  }

  if (await handleRegistrationPendingAction({
    token,
    chatId,
    text,
    pendingAction,
    registrationDraftByChatId,
    pendingActionByChatId,
    storage,
    sendWithMainKeyboard,
    sendMessage,
    normalizeTelegramRegistrationName,
    isValidTelegramRegistrationName,
    resolveCityName,
    isCityTemporarilyAvailable,
    cityCapacityMessage: CITY_CAPACITY_MESSAGE,
    buildRegistrationCityInlineMarkup,
    getDraftCitySlideIndex,
    sendRegistrationCityPicker,
    resolvePersonality,
    getDraftPersonalitySlideIndex,
    sendRegistrationPersonalityPicker,
    buildPlayerRegistrationState,
    saveRegistrationProgress,
    sendTelegramRegistrationStepPrompt,
    resolveGender,
    getDraftGenderSlideIndex,
    sendRegistrationGenderPicker,
    resolveTelegramRegistrationStep,
    isTelegramRegistrationCompleted,
    resolveRegistrationStepFromValues,
  })) {
    return true;
  }

  const player = await resolveOrCreateTelegramPlayer(message.from);

  if (pendingAction.type === "advanced_personality_select") {
    const normalized = text.trim().toLowerCase();
    const byNumber = Number(normalized);
    const picked =
      (Number.isFinite(byNumber) && byNumber >= 1 && byNumber <= ADVANCED_PERSONALITIES.length
        ? ADVANCED_PERSONALITIES[byNumber - 1]
        : undefined)
      ?? ADVANCED_PERSONALITIES.find((item) => item.id === normalized)
      ?? ADVANCED_PERSONALITIES.find((item) => item.name.toLowerCase() === normalized);

    if (!picked) {
      await sendMessage(token, chatId, "Выбери один из вариантов кнопкой ниже или введи 1-3.", {
        reply_markup: buildAdvancedPersonalitySelectInlineMarkup(),
      });
      return true;
    }

    try {
      await setAdvancedPersonality(player.id, picked.id);
      pendingActionByChatId.delete(chatId);
      const snapshot = await getUserWithGameState(player.id);
      const profile = snapshot ? await formatPlayerProfile(snapshot) : "Профиль обновлён.";
      await sendWithMainKeyboard(
        token,
        chatId,
        [`✅ Второй характер выбран: ${picked.emoji} ${picked.name}`, "", profile].join("\n"),
      );
    } catch (error) {
      await sendWithMainKeyboard(token, chatId, `❌ ${extractErrorMessage(error)}`);
    }
    return true;
  }

  if (pendingAction.type === "change_city") {
    const resolvedCity = resolveCityName(text);
    if (!resolvedCity) {
      await sendMessage(token, chatId, "Не понял город. Выбери один из вариантов:\n1) Санкт-Петербург\n2) Сеул\n3) Сингапур\n4) Сан-Франциско", { reply_markup: CITY_REPLY_MARKUP });
      return true;
    }
    if (!isCityTemporarilyAvailable(resolvedCity)) {
      await sendMessage(token, chatId, CITY_CAPACITY_MESSAGE, { reply_markup: CITY_REPLY_MARKUP });
      return true;
    }
    await storage.updateUser(player.id, { city: resolvedCity });
    pendingActionByChatId.delete(chatId);
    const snapshot = await resolveTelegramSnapshot(message.from);
    const profileText = await formatPlayerProfile(snapshot);
    const base = `🏙 Город обновлён: ${resolvedCity}\n\n${profileText}`;
    const notices = formatNotices(snapshot.notices);
    await sendWithMainKeyboard(token, chatId, notices ? `${base}\n\n${notices}` : base);
    return true;
  }

  if (pendingAction.type === "job_select") {
    const result = await runJobSelection(token, chatId, player, text);
    if (result.ok) {
      pendingActionByChatId.delete(chatId);
    } else {
      await sendMessage(token, chatId, `❌ ${result.message}\nВыбери вакансию кнопкой ниже или отправь номер ещё раз.`);
    }
    return true;
  }

  if (pendingAction.type === "shop_buy") {
    try {
      const result = await buyShopItem(player.id, resolveShopBuyRefFromChat(chatId, text));
      const tutorialAdvance = await tryApplyTutorialEvent(
        player.id,
        result.item.type === "consumable" ? "first_course_item_bought" : "first_gadget_bought",
      );
      const questProgress = updateWeeklyQuestProgress(result.user, "shop", 1);
      pendingActionByChatId.delete(chatId);
      const currency = getCurrencySymbol(result.user.city);
      const lines = [
        `✅ Куплено: ${result.item.name}`,
        `-${currency}${result.item.price}`,
        `Бонусы: ${formatStats(result.item.stats)}`,
        `💰 Баланс: ${currency}${formatNumber(result.user.balance)}`,
      ];
      const questNotice = formatWeeklyQuestProgressNotice(questProgress);
      if (questNotice) lines.push("", questNotice);
      const tutorialNotice = formatTutorialAdvanceNotice(tutorialAdvance, result.user.city);
      if (tutorialNotice) lines.push("", tutorialNotice);
      if (result.notices.length) lines.push("", formatNotices(result.notices));
      const purchaseMarkup = buildShopPurchaseInlineMarkup(result.item);
      if (purchaseMarkup) {
        await sendMessage(token, chatId, lines.join("\n"), { reply_markup: purchaseMarkup });
      } else {
        await sendWithCityHubKeyboard(token, chatId, lines.join("\n"));
      }
    } catch (error) {
      await sendWithCityHubKeyboard(token, chatId, `❌ ${extractErrorMessage(error)}\nОтправь номер товара ещё раз или нажми «⬅️ Назад».`);
    }
    return true;
  }

  if (pendingAction.type === "open_bank_product") {
    const parsed = parseBankOpenInput(text);
    if (!parsed) {
      await sendMessage(
        token,
        chatId,
        "Неверный формат.\nВведи: номер сумма дни\nПример: 1 10000 14",
        { reply_markup: buildBankSelectionReplyMarkup(pendingAction.productType) },
      );
      return true;
    }
    try {
      const result = await openBankProduct(player.id, pendingAction.productType, parsed.programRef, parsed.amount, parsed.days);
      pendingActionByChatId.delete(chatId);
      const lines = [pendingAction.productType === "credit" ? `✅ РљСЂРµРґРёС‚ РѕС„РѕСЂРјР»РµРЅ: ${result.program.name}` : `✅ Р’РєР»Р°Рґ РѕС‚РєСЂС‹С‚: ${result.program.name}`, ...result.notices, "", await formatLiveProfile(result.user, result.state as GameView)];
      await sendWithBankKeyboard(token, chatId, lines.join("\n"));
    } catch (error) {
      await sendMessage(
        token,
        chatId,
        `❌ ${extractErrorMessage(error)}\nРџРѕРїСЂРѕР±СѓР№ РµС‰С‘ СЂР°Р· РёР»Рё РЅР°Р¶РјРё В«Р’ Р±Р°РЅРєВ».`,
        { reply_markup: buildBankSelectionReplyMarkup(pendingAction.productType) },
      );
    }
    return true;
  }

  if (pendingAction.type === "shop_sell") {
    const ref = resolveShopSellRefFromChat(chatId, text);
    try {
      const result = await sellInventoryItem(player.id, ref);
      pendingActionByChatId.delete(chatId);
      const currency = getCurrencySymbol(result.user.city);
      const lines = [
        "✅ Продано:",
        `${result.item.name} +${currency}${result.salePrice}`,
        "",
        `💰 Баланс: ${currency}${formatNumber(result.user.balance)}`,
      ];
      if (result.notices.length) lines.push("", formatNotices(result.notices));
      await sendWithCityHubKeyboard(token, chatId, lines.join("\n"));
    } catch (error) {
      await sendWithCityHubKeyboard(token, chatId, `❌ ${extractErrorMessage(error)}\nОтправь номер предмета ещё раз или нажми «⬅️ Назад».`);
    }
    return true;
  }

  if (pendingAction.type === "exchange_to_gram") {
    const amountCurrency = parseDecimalInput(text);
    if (amountCurrency === null) {
      await sendWithBankKeyboard(token, chatId, "Неверный формат. Введи сумму в валюте (например: 500).");
      return true;
    }
    try {
      const result = await exchangeCurrencyToGram(player.id, amountCurrency);
      pendingActionByChatId.delete(chatId);
      await sendWithBankKeyboard(
        token,
        chatId,
        [
          `✅ РћР±РјРµРЅ РІС‹РїРѕР»РЅРµРЅ: -${getCurrencySymbol(result.user.city)}${result.amountCurrency}, +${formatGramValue(result.amountGram)} GRM`,
          "",
          await formatLiveProfile(result.user, result.state as GameView),
        ].join("\n"),
      );
    } catch (error) {
      await sendWithBankKeyboard(token, chatId, `❌ ${extractErrorMessage(error)}\nР’РІРµРґРё СЃСѓРјРјСѓ РµС‰С‘ СЂР°Р·.`);
    }
    return true;
  }

  if (pendingAction.type === "exchange_from_gram") {
    const amountGram = parseDecimalInput(text);
    if (amountGram === null) {
      await sendWithBankKeyboard(token, chatId, "Неверный формат. Введи количество GRM (например: 12.5).");
      return true;
    }
    try {
      const result = await exchangeGramToCurrency(player.id, amountGram);
      pendingActionByChatId.delete(chatId);
      await sendWithBankKeyboard(
        token,
        chatId,
        [
          `✅ РћР±РјРµРЅ РІС‹РїРѕР»РЅРµРЅ: -${formatGramValue(result.amountGram)} GRM, +${getCurrencySymbol(result.user.city)}${result.amountCurrency}`,
          "",
          await formatLiveProfile(result.user, result.state as GameView),
        ].join("\n"),
      );
    } catch (error) {
      await sendWithBankKeyboard(token, chatId, `❌ ${extractErrorMessage(error)}\nР’РІРµРґРё РєРѕР»РёС‡РµСЃС‚РІРѕ GRM РµС‰С‘ СЂР°Р·.`);
    }
    return true;
  }

  if (pendingAction.type === "stocks_buy_select") {
    const snapshot = await getStockMarketSnapshot(player.id);
    const ticker = text.trim().toUpperCase();
    const quote = snapshot.quotes.find((item) => item.ticker.toUpperCase() === ticker);
    if (!quote) {
      await sendMessage(token, chatId, "Выбери бумагу кнопкой ниже.", {
        reply_markup: buildStocksTickerReplyMarkup(snapshot, "buy"),
      });
      return true;
    }

    pendingActionByChatId.set(chatId, { type: "stocks_buy_qty", ticker: quote.ticker });
    await sendMessage(
      token,
      chatId,
      `Выбрана бумага ${quote.ticker}.\nСколько хочешь купить? Отправь число.`,
      { reply_markup: buildStocksQuantityReplyMarkup() },
    );
    return true;
  }

  if (pendingAction.type === "stocks_buy_qty") {
    const quantity = Math.max(1, Math.floor(Number(text.trim())));
    if (!Number.isFinite(quantity) || quantity <= 0) {
      await sendMessage(token, chatId, "Введи целое число бумаг для покупки.", {
        reply_markup: buildStocksQuantityReplyMarkup(),
      });
      return true;
    }

    try {
      const result = await buyStockAsset(player.id, pendingAction.ticker, quantity);
      const tutorialAdvance = await tryApplyTutorialEvent(player.id, "first_stock_bought");
      pendingActionByChatId.delete(chatId);
      await sendMessage(
        token,
        chatId,
        [
          `✅ Куплено: ${result.ticker} x${result.quantity}`,
          `Цена: ${getCurrencySymbol(player.city)}${result.pricePerShare.toFixed(2)}`,
          `Списано: ${getCurrencySymbol(player.city)}${result.totalCost.toFixed(2)}`,
          formatTutorialAdvanceNotice(tutorialAdvance, player.city),
          "",
          await formatStocksMenu(player.id),
        ].filter(Boolean).join("\n"),
        { reply_markup: buildStocksHomeReplyMarkup() },
      );
    } catch (error) {
      await sendMessage(token, chatId, `❌ ${extractErrorMessage(error)}\nВведи количество ещё раз.`, {
        reply_markup: buildStocksQuantityReplyMarkup(),
      });
    }
    return true;
  }

  if (pendingAction.type === "stocks_sell_select") {
    const snapshot = await getStockMarketSnapshot(player.id);
    const ticker = text.trim().toUpperCase();
    const holding = snapshot.holdings.find((item) => item.ticker.toUpperCase() === ticker);
    if (!holding) {
      await sendMessage(token, chatId, "Выбери бумагу из портфеля кнопкой ниже.", {
        reply_markup: buildStocksTickerReplyMarkup(snapshot, "sell"),
      });
      return true;
    }

    pendingActionByChatId.set(chatId, { type: "stocks_sell_qty", ticker: holding.ticker });
    await sendMessage(
      token,
      chatId,
      `Выбрана бумага ${holding.ticker}.\nСколько хочешь продать? Отправь число.`,
      { reply_markup: buildStocksQuantityReplyMarkup() },
    );
    return true;
  }

  if (pendingAction.type === "stocks_sell_qty") {
    const quantity = Math.max(1, Math.floor(Number(text.trim())));
    if (!Number.isFinite(quantity) || quantity <= 0) {
      await sendMessage(token, chatId, "Введи целое число бумаг для продажи.", {
        reply_markup: buildStocksQuantityReplyMarkup(),
      });
      return true;
    }

    try {
      const result = await sellStockAsset(player.id, pendingAction.ticker, quantity);
      pendingActionByChatId.delete(chatId);
      await sendMessage(
        token,
        chatId,
        [
          `✅ Продано: ${result.ticker} x${result.quantity}`,
          `Цена: ${getCurrencySymbol(player.city)}${result.pricePerShare.toFixed(2)}`,
          `Получено: ${getCurrencySymbol(player.city)}${result.totalRevenue.toFixed(2)}`,
          "",
          await formatStocksMenu(player.id),
        ].join("\n"),
        { reply_markup: buildStocksHomeReplyMarkup() },
      );
    } catch (error) {
      await sendMessage(token, chatId, `❌ ${extractErrorMessage(error)}\nВведи количество ещё раз.`, {
        reply_markup: buildStocksQuantityReplyMarkup(),
      });
    }
    return true;
  }

  if (pendingAction.type === "company_topup") {
    const amountLocal = parseDecimalInput(text);
    if (amountLocal === null) {
      await sendWithMainKeyboard(token, chatId, "Неверный формат. Введи сумму в локальной валюте (например: 1000).");
      return true;
    }

    const membership = await getPlayerCompanyContext(player.id);
    if (!membership || String(membership.company.id) !== pendingAction.companyId) {
      pendingActionByChatId.delete(chatId);
      await sendWithMainKeyboard(token, chatId, "Компания не найдена. Открой /company и попробуй снова.");
      return true;
    }

    const companyEconomy = await ensureCompanyEconomyState(membership.company, membership.membersCount);
    const topUp = await applyCompanyTopUpFromPlayer(player, membership.company, companyEconomy, amountLocal);
    if (!topUp.ok) {
      await sendWithMainKeyboard(token, chatId, `❌ ${topUp.reason ?? "РџРѕРїРѕР»РЅРµРЅРёРµ РЅРµРґРѕСЃС‚СѓРїРЅРѕ"}`);
      return true;
    }

    pendingActionByChatId.delete(chatId);
    const updatedMembership = await getPlayerCompanyContext(player.id);
    await sendMessage(
      token,
      chatId,
      [
        `✅ РљРѕРјРїР°РЅРёСЏ РїРѕРїРѕР»РЅРµРЅР°: -${getCurrencySymbol(player.city)}${formatNumber(topUp.spentLocal)}, +${formatNumber(topUp.receivedGRM)} GRM`,
        `Р›РёС‡РЅС‹Р№ Р±Р°Р»Р°РЅСЃ: ${getCurrencySymbol(player.city)}${topUp.playerBalanceAfter}`,
      ].join("\n"),
    );
    if (updatedMembership) {
      await sendCompanyEconomySection(token, chatId, updatedMembership);
    }
    return true;
  }

  if (pendingAction.type === "company_set_salary_amount") {
    const amount = Math.floor(Number(text.trim()));
    if (!Number.isFinite(amount) || amount < 0) {
      await sendMessage(token, chatId, "Неверный формат. Введи сумму зарплаты в GRM, например: 60.", {
        reply_markup: buildCompanyReplyMarkup("owner", chatId),
      });
      return true;
    }
    if (amount > 5000) {
      await sendMessage(token, chatId, "Слишком большая зарплата. Максимум: 5000 GRM.", {
        reply_markup: buildCompanyReplyMarkup("owner", chatId),
      });
      return true;
    }

    const membership = await getPlayerCompanyContext(player.id);
    if (!membership || membership.role !== "owner" || String(membership.company.id) !== pendingAction.companyId) {
      pendingActionByChatId.delete(chatId);
      await sendWithMainKeyboard(token, chatId, "Компания не найдена. Открой /company и попробуй снова.");
      return true;
    }

    const members = await storage.getCompanyMembers(membership.company.id);
    const targetMember = members.find((member) => member.userId === pendingAction.memberUserId);
    if (!targetMember) {
      pendingActionByChatId.delete(chatId);
      await sendMessage(token, chatId, "Сотрудник не найден.", {
        reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
      });
      return true;
    }

    setCompanyMemberSalary(String(membership.company.id), targetMember.userId, amount);
    pendingActionByChatId.delete(chatId);
    await sendMessage(
      token,
      chatId,
      `✅ Зарплата назначена: ${targetMember.username} — ${amount} GRM.\nСотрудник получит её кнопкой или через скрытый /company_salary_claim.`,
      { reply_markup: buildCompanyReplyMarkup(membership.role, chatId) },
    );
    await sendMessage(token, chatId, await formatCompanySalariesSection(membership, chatId), {
      reply_markup: buildCompanySalariesInlineMarkup(membership, chatId),
    });
    return true;
  }

  if (pendingAction.type === "auction_bid_amount") {
    const amount = Number(text.trim());
    if (!Number.isFinite(amount) || amount <= 0) {
      await sendWithCityHubKeyboard(token, chatId, "Неверный формат. Введи сумму ставки в GRM, например: 150.");
      return true;
    }
    try {
      await callInternalApi("POST", "/api/market/bid", { listingId: pendingAction.listingId, bidderId: player.id, amount });
      pendingActionByChatId.delete(chatId);
      await sendMessage(token, chatId, `✅ Ставка принята.\n\n${await formatAuctionSection(player.id, chatId)}`, {
        reply_markup: await buildAuctionInlineMarkup(player.id, chatId),
      });
    } catch (error) {
      await sendWithCityHubKeyboard(token, chatId, `❌ ${extractErrorMessage(error)}`);
    }
    return true;
  }

  if (pendingAction.type === "company_part_deposit") {
    const alias = resolvePlainTextAlias(text, chatId);
    if (alias && alias !== "/company_part_deposit") {
      pendingActionByChatId.delete(chatId);
      return false;
    }
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership) {
      pendingActionByChatId.delete(chatId);
      await sendWithMainKeyboard(token, chatId, "Ты не состоишь в компании. Открой /company.");
      return true;
    }

    const quickMatch = text.trim().match(/^\/cpd(\d+)$/i);
    const normalizedInput = quickMatch ? quickMatch[1] : text.trim();
    const [refRaw, qtyRaw] = normalizedInput.split(/\s+/);
    if (!refRaw) {
      const snapshot = await resolveTelegramSnapshot(message.from);
      await sendMessage(token, chatId, formatCompanyPartDepositList(snapshot.game as GameView, chatId), {
        reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
      });
      return true;
    }

    const partRef = resolveCompanyPartDepositRefFromChat(chatId, refRaw);
    const snapshot = await getUserWithGameState(player.id);
    const inventory = [...(((snapshot?.game as GameView | undefined)?.inventory) ?? [])];
    const partItem = inventory.find((item) => item.type === "part" && item.id === partRef);
    if (!partItem) {
      await sendMessage(token, chatId, "❌ На склад компании можно добавлять только запчасти. Выбери деталь из списка или открой /company_part_deposit.");
      return true;
    }

    const result = await transferCompanyPartToWarehouse(player.id, membership, partRef, qtyRaw);
    if (!result.ok) {
      await sendMessage(token, chatId, `❌ ${result.error}`);
      return true;
    }
    pendingActionByChatId.delete(chatId);

    await sendMessage(
      token,
      chatId,
      `✅ На склад компании перенесено: ${result.partName} x${result.moveQty}.`,
      { reply_markup: buildCompanyReplyMarkup(membership.role, chatId) },
    );
    return true;
  }

  if (pendingAction.type === "company_part_deposit_qty") {
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership) {
      pendingActionByChatId.delete(chatId);
      await sendWithMainKeyboard(token, chatId, "Ты не состоишь в компании. Открой /company.");
      return true;
    }
    const qtyText = text.trim().toLowerCase();
    if (!qtyText) {
      await sendMessage(token, chatId, "Введи количество для переноса (например: 2 или all).");
      return true;
    }

    const result = await transferCompanyPartToWarehouse(player.id, membership, pendingAction.partRef, qtyText);
    if (!result.ok) {
      await sendMessage(token, chatId, `❌ ${result.error}`);
      return true;
    }
    pendingActionByChatId.delete(chatId);
    await sendMessage(
      token,
      chatId,
      `✅ На склад компании перенесено: ${result.partName} x${result.moveQty}.`,
      { reply_markup: buildCompanyReplyMarkup(membership.role, chatId) },
    );
    await sendCompanyWarehouseSection(token, chatId, membership, player.id);
    return true;
  }

  if (pendingAction.type === "company_contract_parts") {
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership) {
      clearPendingActionRuntimeState(chatId, pendingAction);
      await sendWithMainKeyboard(token, chatId, "Ты не состоишь в компании.");
      return true;
    }
    const backAlias = aliasCommand === "/company_back" || normalizedCommand === "/company_back" || normalizedCommand === "/cancel";
    if (backAlias) {
      clearPendingActionRuntimeState(chatId, pendingAction);
      await sendCompanyWorkSection(token, chatId, membership);
      return true;
    }
    const contracts = await getCityContracts(membership.company.city);
    const contract = contracts.find((item) => item.id === pendingAction.contractId);
    if (!contract) {
      clearPendingActionRuntimeState(chatId, pendingAction);
      await sendMessage(token, chatId, "Контракт больше не найден. Открой раздел работы компании заново.", {
        reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
      });
      return true;
    }
    await sendMessage(token, chatId, "Используй кнопки под сообщением, чтобы выбрать детали со склада компании.", {
      reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
    });
    await sendCompanyContractPartsPicker(token, chatId, membership, contract);
    return true;
  }

  if (pendingAction.type === "company_exclusive_name") {
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership || membership.role !== "owner") {
      pendingActionByChatId.delete(chatId);
      await sendWithMainKeyboard(token, chatId, "Раздел доступен только CEO компании.");
      return true;
    }
    const gadgetName = normalizeExclusiveDraftName(text);
    if (gadgetName.length < 3) {
      await sendMessage(token, chatId, "Название должно быть не короче 3 символов. Введи название будущего гаджета ещё раз.");
      return true;
    }
    companyExclusiveSelectedPartRefsByChatId.delete(chatId);
    companyExclusivePartPageByChatId.set(chatId, 0);
    pendingActionByChatId.set(chatId, { type: "company_exclusive_parts", gadgetName });
    await sendCompanyExclusivePartsPicker(token, chatId, membership, player.id, gadgetName);
    return true;
  }

  if (pendingAction.type === "company_exclusive_parts") {
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership || membership.role !== "owner") {
      pendingActionByChatId.delete(chatId);
      companyExclusiveSelectedPartRefsByChatId.delete(chatId);
      companyExclusivePartPageByChatId.delete(chatId);
      await sendWithMainKeyboard(token, chatId, "Раздел доступен только CEO компании.");
      return true;
    }
    const refs = getCompanyWarehouseParts(membership.company.id).map((item) => `${item.id}::${item.rarity}`);
    companyExclusivePartRefsByChatId.set(chatId, refs);
    const selectedRefs = [...(companyExclusiveSelectedPartRefsByChatId.get(chatId) ?? [])].filter((ref) => refs.includes(ref));
    companyExclusiveSelectedPartRefsByChatId.set(chatId, selectedRefs);
    const normalizedText = String(text || "").trim();
    const backAlias = aliasCommand === "/company_back" || normalizedCommand === "/company_back" || normalizedCommand === "/cancel";

    if (backAlias) {
      pendingActionByChatId.delete(chatId);
      companyExclusiveSelectedPartRefsByChatId.delete(chatId);
      companyExclusivePartRefsByChatId.delete(chatId);
      companyExclusivePartPageByChatId.delete(chatId);
      setCompanyMenuSection(chatId, "root");
      rememberTelegramMenu(player.id, { menu: "company", section: "root" });
      await sendCompanyRootMenu(token, chatId, player);
      return true;
    }

    const detMatch = normalizedText.match(/^\/det(\d+)$/i);

    if (/^\/det_reset$/i.test(normalizedText)) {
      companyExclusiveSelectedPartRefsByChatId.set(chatId, []);
      companyExclusivePartPageByChatId.set(chatId, 0);
      await sendCompanyExclusivePartsPicker(token, chatId, membership, player.id, pendingAction.gadgetName);
      return true;
    }

    if (detMatch) {
      const partIndex = Number(detMatch[1]) - 1;
      const targetRef = refs[partIndex];
      if (!targetRef) {
        await sendMessage(token, chatId, "❌ Деталь не найдена. Нажми команду из списка вроде /det1.");
        return true;
      }
      const existingIndex = selectedRefs.indexOf(targetRef);
      if (existingIndex >= 0) {
        selectedRefs.splice(existingIndex, 1);
      } else {
        if (selectedRefs.length >= 6) {
          await sendMessage(token, chatId, "❌ Можно выбрать максимум 6 деталей. Нажми /det_done или /det_reset.");
          return true;
        }
        selectedRefs.push(targetRef);
      }
      companyExclusiveSelectedPartRefsByChatId.set(chatId, selectedRefs);
      await sendCompanyExclusivePartsPicker(token, chatId, membership, player.id, pendingAction.gadgetName);
      return true;
    }

    if (!/^\/det_done$/i.test(normalizedText)) {
      await sendMessage(token, chatId, "Используй кнопки под сообщением, чтобы выбрать детали. Когда закончишь, нажми «🚀 Готово».", {
        reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
      });
      return true;
    }
    const partRefs = selectedRefs;
    if (partRefs.length < 3 || partRefs.length > 6) {
      await sendMessage(token, chatId, "❌ Для эксклюзивного гаджета нужно выбрать от 3 до 6 деталей. Отмечай их кнопками под сообщением.", {
        reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
      });
      return true;
    }
    await startCompanyExclusiveDevelopment(
      token,
      chatId,
      membership,
      player.id,
      pendingAction.gadgetName,
      partRefs,
    );
    return true;
  }

  if (pendingAction.type === "company_exclusive_produce_select") {
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership || membership.role !== "owner") {
      pendingActionByChatId.delete(chatId);
      await sendWithMainKeyboard(token, chatId, "Раздел доступен только CEO компании.");
      return true;
    }
    const backAlias = aliasCommand === "/company_back" || normalizedCommand === "/company_back" || normalizedCommand === "/cancel";
    if (backAlias) {
      pendingActionByChatId.delete(chatId);
      setCompanyMenuSection(chatId, "root");
      rememberTelegramMenu(player.id, { menu: "company", section: "root" });
      await sendCompanyRootMenu(token, chatId, player);
      return true;
    }
    if (
      normalizedCommand === "/company_exclusive_start"
      || normalizedCommand === "/company_exclusive_progress"
      || normalizedCommand === "/company_exclusive_produce"
    ) {
      pendingActionByChatId.delete(chatId);
      return false;
    }
    const snapshot = await getCompanyExclusiveSnapshot(membership.company.id);
    const parsedIndex = Number(text.trim());
    if (!Number.isFinite(parsedIndex)) {
      await sendMessage(token, chatId, "Выбери чертёж кнопкой ниже или нажми «⬅️ Назад».", {
        reply_markup: buildCompanyExclusiveProduceInlineMarkup(snapshot, membership.role, chatId),
      });
      return true;
    }
    const index = Math.max(0, parsedIndex - 1);
    const blueprint = snapshot.catalog?.[index];
    if (!blueprint) {
      await sendMessage(token, chatId, "Чертёж не найден. Выбери вариант кнопкой ниже или нажми «⬅️ Назад».", {
        reply_markup: buildCompanyExclusiveProduceInlineMarkup(snapshot, membership.role, chatId),
      });
      return true;
    }
    pendingActionByChatId.set(chatId, {
      type: "company_exclusive_produce_qty",
      blueprintId: blueprint.id,
      blueprintName: blueprint.name,
    });
    await sendMessage(token, chatId, `🏭 ${blueprint.name}\nВведи количество для выпуска (1-${Math.max(1, blueprint.remainingUnits)}).`);
    return true;
  }

  if (pendingAction.type === "company_bp_produce_qty") {
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership || membership.role !== "owner") {
      pendingActionByChatId.delete(chatId);
      await sendWithMainKeyboard(token, chatId, "Раздел доступен только CEO компании.");
      return true;
    }
    const quantityRaw = Number(text.trim() || 1);
    const quantity = Math.max(1, Math.min(pendingAction.maxQuantity, Math.floor(quantityRaw)));
    if (!Number.isFinite(quantityRaw) || quantityRaw <= 0) {
      await sendMessage(token, chatId, `Введи число от 1 до ${pendingAction.maxQuantity}.`, {
        reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
      });
      return true;
    }
    try {
      const blueprintSnapshot = await getCompanyBlueprintSnapshot(membership.company.id);
      const blueprint = blueprintSnapshot.available.find((item) => item.id === pendingAction.blueprintId);
      if (!blueprint) {
        pendingActionByChatId.delete(chatId);
        await sendMessage(token, chatId, "❌ Активный чертёж больше не найден.", {
          reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
        });
        return true;
      }
      const companyEconomy = await ensureCompanyEconomyState(membership.company, membership.membersCount);
      const departmentEffects = getDepartmentEffects(companyEconomy.departments);
      const blueprintCategory = GADGET_BLUEPRINTS.find((item) => item.id === blueprint.id)?.category ?? "smartphones";
      const batchDiscountMultiplier = Math.max(0.88, 1 - Math.max(0, quantity - 1) * 0.02);
      const gramCost = Math.max(
        1,
        Math.round(
          Number(blueprint.production?.costGram || 1)
          * quantity
          * batchDiscountMultiplier
          * departmentEffects.productionCostMultiplier,
        ),
      );
      const durationMs = calculateCompanyStandardProductionPreviewMs({
        blueprintId: blueprint.id,
        category: blueprintCategory,
        quantity,
        departmentEffects,
        advancedPersonalityId: getAdvancedPersonalityId(player),
      });
      pendingActionByChatId.set(chatId, {
        type: "company_bp_produce_confirm",
        blueprintId: blueprint.id,
        blueprintName: blueprint.name,
        quantity,
      });
      await sendMessage(
        token,
        chatId,
        [
          `🏭 ${blueprint.name}`,
          `Партия: x${quantity}`,
          `Время производства: ${formatDurationShort(durationMs)}`,
          `Стоимость запуска: ${formatNumber(gramCost)} GRM`,
          "Нажми «Запустить партию», чтобы начать производство.",
        ].filter(Boolean).join("\n"),
        { reply_markup: buildCompanyProductionConfirmInlineMarkup("standard") },
      );
    } catch (error) {
      await sendMessage(token, chatId, `❌ ${extractErrorMessage(error)}`, {
        reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
      });
    }
    return true;
  }

  if (pendingAction.type === "company_exclusive_produce_qty") {
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership || membership.role !== "owner") {
      pendingActionByChatId.delete(chatId);
      await sendWithMainKeyboard(token, chatId, "Раздел доступен только CEO компании.");
      return true;
    }
    const backAlias = aliasCommand === "/company_back" || normalizedCommand === "/company_back" || normalizedCommand === "/cancel";
    if (backAlias) {
      pendingActionByChatId.delete(chatId);
      setCompanyMenuSection(chatId, "root");
      rememberTelegramMenu(player.id, { menu: "company", section: "root" });
      await sendCompanyRootMenu(token, chatId, player);
      return true;
    }
    if (
      normalizedCommand === "/company_exclusive_start"
      || normalizedCommand === "/company_exclusive_progress"
      || normalizedCommand === "/company_exclusive_produce"
    ) {
      pendingActionByChatId.delete(chatId);
      return false;
    }
    const quantityRaw = Number(text.trim() || 1);
    const quantity = Math.max(1, Math.min(5, quantityRaw));
    if (!Number.isFinite(quantity)) {
      await sendMessage(token, chatId, "Введи число от 1 до 5 или нажми «⬅️ Назад».", {
        reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
      });
      return true;
    }
    try {
      const snapshot = await getCompanyExclusiveSnapshot(membership.company.id);
      const blueprint = (snapshot.catalog ?? []).find((item) => item.id === pendingAction.blueprintId);
      if (!blueprint) {
        pendingActionByChatId.delete(chatId);
        await sendMessage(token, chatId, "❌ Чертёж для выпуска больше не найден.", {
          reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
        });
        return true;
      }
      const actualQuantity = Math.max(1, Math.min(Number(blueprint.remainingUnits || 1), Math.floor(quantity)));
      const companyEconomy = await ensureCompanyEconomyState(membership.company, membership.membersCount);
      const departmentEffects = getDepartmentEffects(companyEconomy.departments);
      const gramCost = Math.max(
        1,
        Math.round(Number(blueprint.productionCostGram || 1) * actualQuantity * departmentEffects.productionCostMultiplier),
      );
      const durationMs = calculateCompanyExclusiveProductionPreviewMs({
        category: blueprint.category,
        quantity: actualQuantity,
        departmentEffects,
        advancedPersonalityId: getAdvancedPersonalityId(player),
      });
      pendingActionByChatId.set(chatId, {
        type: "company_exclusive_produce_confirm",
        blueprintId: pendingAction.blueprintId,
        blueprintName: pendingAction.blueprintName,
        quantity: actualQuantity,
      });
      await sendMessage(
        token,
        chatId,
        [
          `🏭 ${pendingAction.blueprintName}`,
          `Партия: x${actualQuantity}`,
          `Время производства: ${formatDurationShort(durationMs)}`,
          `Стоимость запуска: ${formatNumber(gramCost)} GRM компании`,
          "Нажми «Запустить партию», чтобы начать выпуск.",
        ].join("\n"),
        { reply_markup: buildCompanyProductionConfirmInlineMarkup("exclusive") },
      );
    } catch (error) {
      await sendMessage(token, chatId, `❌ ${extractErrorMessage(error)}`, {
        reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
      });
    }
    return true;
  }

  if (pendingAction.type === "company_bp_produce_confirm") {
    if (text.trim().startsWith("/")) return false;
    await sendMessage(token, chatId, "Нажми кнопку «Запустить партию» под предыдущим сообщением или «Изменить количество».", {
      reply_markup: buildCompanyProductionConfirmInlineMarkup("standard"),
    });
    return true;
  }

  if (pendingAction.type === "company_exclusive_produce_confirm") {
    if (text.trim().startsWith("/")) return false;
    await sendMessage(token, chatId, "Нажми кнопку «Запустить партию» под предыдущим сообщением или «Изменить количество».", {
      reply_markup: buildCompanyProductionConfirmInlineMarkup("exclusive"),
    });
    return true;
  }

  if (pendingAction.type === "study_level_select") {
    const levelKey = resolveEducationLevel(text, player.level);
    if (!levelKey) {
      await sendMessage(
        token,
        chatId,
        "Не понял уровень обучения. Выбери из списка: Школа / Колледж / Университет.",
        { reply_markup: buildEducationLevelsReplyMarkup(player.level) },
      );
      return true;
    }

    pendingActionByChatId.set(chatId, { type: "study_course_select", levelKey });
    rememberTelegramMenu(player.id, { menu: "study_courses", levelKey });
    await sendMessage(
      token,
      chatId,
      formatEducationCoursesMenu(player, levelKey),
      { reply_markup: buildEducationCoursesReplyMarkup(levelKey) },
    );
    return true;
  }

  if (pendingAction.type === "study_course_select") {
    const course = resolveEducationCourse(pendingAction.levelKey, text);
    if (!course) {
      await sendMessage(
        token,
        chatId,
        "Курс не найден. Отправь номер курса из списка.",
        { reply_markup: buildEducationCoursesReplyMarkup(pendingAction.levelKey) },
      );
      return true;
    }
    const courseCost = getStudyCourseCostForPlayer(course, player);
    if (player.balance < courseCost) {
      await sendMessage(
        token,
        chatId,
        `❌ Недостаточно средств. Нужно ${getCurrencySymbol(player.city)}${courseCost}.`,
        { reply_markup: STUDY_RESULT_REPLY_MARKUP },
      );
      pendingActionByChatId.delete(chatId);
      return true;
    }

    const snapshot = await getUserWithGameState(player.id);
    if (!snapshot) {
      pendingActionByChatId.delete(chatId);
      await sendWithMainKeyboard(token, chatId, "Профиль игрока не найден.");
      return true;
    }
    const game = snapshot.game as GameView;
    const studyEnergyCost = getStudyEnergyCostForPlayer(pendingAction.levelKey, course, player);
    if (game.studyTime < studyEnergyCost) {
      await sendMessage(
        token,
        chatId,
        `❌ Недостаточно энергии для учёбы. Нужно ${Math.round(studyEnergyCost * 100)}, доступно ${formatEnergyPercent(game.studyTime)}.`,
        { reply_markup: STUDY_RESULT_REPLY_MARKUP },
      );
      pendingActionByChatId.delete(chatId);
      return true;
    }
    const nextStudyTime = Math.max(0, Number((game.studyTime - studyEnergyCost).toFixed(4)));

    const failReduction = getEducationFailureReduction(player.city, player.reputation || 0);
    const effectiveFailure = Math.max(0, course.failureChance + 10 - failReduction);
    const baseSkills = getBaseSkillValues(game);
    const nextSkills = { ...(game?.skills || {}) } as Record<SkillName, number>;
    const skillCap = getTrainingSkillCapForLevel(player.level);
    const canGrowAnySkill = Object.entries(course.skillBoosts).some(([key, boost]) => {
      if (!(key in nextSkills) || !(key in baseSkills)) return false;
      return Number(baseSkills[key as SkillName] || 0) < skillCap && Number(boost || 0) > 0;
    });
    if (!canGrowAnySkill) {
      pendingActionByChatId.delete(chatId);
      await sendMessage(
        token,
        chatId,
        `❌ Навыки этого курса уже упираются в потолок уровня (${skillCap}). Подними уровень и попробуй снова.`,
        { reply_markup: STUDY_RESULT_REPLY_MARKUP },
      );
      return true;
    }
    const success = Math.random() * 100 > effectiveFailure;

    if (!success) {
      const updatedUser = await storage.updateUser(player.id, {
        balance: Math.max(0, player.balance - courseCost),
      });
      applyGameStatePatch(player.id, { studyTime: nextStudyTime });
      await sendMessage(
        token,
        chatId,
        [
          `❌ Курс не пройден: ${course.icon} ${course.name}`,
          `Риск: ${effectiveFailure}%`,
          `-${getCurrencySymbol(player.city)}${courseCost} (оплата курса списана)`,
          `⚡ Потрачено энергии учёбы: ${Math.round(studyEnergyCost * 100)}`,
          `⚡ Остаток энергии учёбы: ${formatEnergyPercent(nextStudyTime)}`,
          `💰 Остаток денег: ${getCurrencySymbol(player.city)}${formatNumber(Math.max(0, player.balance - courseCost))}`,
        ].join("\n"),
        { reply_markup: STUDY_RESULT_REPLY_MARKUP },
      );
      await sendStudyCoursesSelectionMenu(token, chatId, updatedUser, pendingAction.levelKey);
      return true;
    }

    const strategistReputationBonus = getAdvancedPersonalityId(player) === "strategist" ? 1.05 : 1;
    const reputationGain = Math.max(3, Math.round(3 * strategistReputationBonus));
    let updatedUser = await storage.updateUser(player.id, {
      balance: player.balance - courseCost,
      reputation: (player.reputation || 0) + reputationGain,
    });

    const cityBonus = getCityReputationBonus(player.city, player.reputation || 0);
    const citySkillProc = cityBonus.skillGrowthBoost > 0 && Math.random() * 100 < cityBonus.skillGrowthBoost;
    const luckyProc = player.personality === "lucky" && Math.random() < 0.2;
    const appliedBoosts: Partial<Record<SkillName, number>> = {};
    for (const [key, boost] of Object.entries(course.skillBoosts)) {
      if (!(key in nextSkills)) continue;
      const skill = key as SkillName;
      const baseBoost = Number(boost) || 0;
      const bonusBoost = (citySkillProc ? 1 : 0) + (luckyProc ? 1 : 0);
      const plannedBoost = Number((baseBoost + bonusBoost).toFixed(2));
      const currentValue = Number(nextSkills[skill] || 0);
      const currentBaseValue = Number(baseSkills[skill] || 0);
      const finalBoost = Number(Math.max(0, Math.min(plannedBoost, skillCap - currentBaseValue)).toFixed(2));
      if (finalBoost <= 0) continue;
      nextSkills[skill] = Number((currentValue + finalBoost).toFixed(2));
      baseSkills[skill] = Number((currentBaseValue + finalBoost).toFixed(2));
      appliedBoosts[skill] = finalBoost;
    }
    if (!Object.keys(appliedBoosts).length) {
      pendingActionByChatId.delete(chatId);
      await sendMessage(
        token,
        chatId,
        `❌ После ограничения уровня курс не даст прироста. Потолок навыков сейчас: ${skillCap}.`,
        { reply_markup: STUDY_RESULT_REPLY_MARKUP },
      );
      return true;
    }

    applyGameStatePatch(player.id, { skills: nextSkills, studyTime: nextStudyTime });
    const tutorialAdvance = await tryApplyTutorialEvent(player.id, "first_education_started");
    updateWeeklyQuestProgress(updatedUser, "study", 1);

      const continueTutorialLine = formatTutorialAdvanceNotice(tutorialAdvance, player.city) || await getTutorialContinueLine(player.id);

    await sendMessage(
      token,
      chatId,
      [
        `✅ Курс завершён: ${course.icon} ${course.name}`,
        `-${getCurrencySymbol(updatedUser.city)}${courseCost}, +${reputationGain} репутации`,
        `Навыки: ${formatStats(appliedBoosts as Record<string, number>)}`,
        `Потолок навыков от обучения на этом уровне: ${skillCap}`,
        citySkillProc ? "🏙 Бонус города: +1 к каждому навыку курса." : "",
        luckyProc ? "🍀 Удача: +1 к каждому навыку курса." : "",
        `⚡ Потрачено энергии учёбы: ${Math.round(studyEnergyCost * 100)}`,
        `⚡ Остаток энергии учёбы: ${formatEnergyPercent(nextStudyTime)}`,
        `💰 Остаток денег: ${getCurrencySymbol(updatedUser.city)}${formatNumber(updatedUser.balance)}`,
        continueTutorialLine || "",
      ].filter(Boolean).join("\n"),
      { reply_markup: STUDY_RESULT_REPLY_MARKUP },
    );
    await sendStudyCoursesSelectionMenu(token, chatId, updatedUser, pendingAction.levelKey);
    return true;
  }

  if (pendingAction.type === "admin_auth") {
    pendingActionByChatId.delete(chatId);
    if (!ADMIN_PASSWORD || text.trim() !== ADMIN_PASSWORD) {
      await sendWithMainKeyboard(token, chatId, "❌ Неверный пароль администратора.");
      return true;
    }

    adminAuthByChatId.set(chatId, true);
    await sendWithAdminKeyboard(
      token,
      chatId,
      [
        "🛠 Админ-режим включен.",
        "Доступно:",
        "• Выдача денег",
        "• Выдача опыта",
        "• Сброс игрока / рестарт",
      ].join("\n"),
    );
    return true;
  }

  if (pendingAction.type === "admin_add_money") {
    pendingActionByChatId.delete(chatId);
    if (!adminAuthByChatId.get(chatId)) {
      await sendWithMainKeyboard(token, chatId, "❌ Сначала авторизуйся: /admin <пароль>");
      return true;
    }

    const amount = Number(text.trim());
    if (!Number.isFinite(amount) || amount <= 0) {
      await sendWithAdminKeyboard(token, chatId, "Введите корректную сумму > 0.");
      return true;
    }

    const updated = await storage.updateUser(player.id, {
      balance: player.balance + Math.floor(amount),
    });
    const refreshed = await getUserWithGameState(updated.id);
    await sendWithAdminKeyboard(
      token,
      chatId,
      refreshed
        ? `✅ Р’С‹РґР°РЅРѕ ${getCurrencySymbol(updated.city)}${Math.floor(amount)}\n\n${await formatPlayerProfile(refreshed)}`
        : `✅ Р’С‹РґР°РЅРѕ ${getCurrencySymbol(updated.city)}${Math.floor(amount)}`,
    );
    return true;
  }

  if (pendingAction.type === "admin_add_exp") {
    pendingActionByChatId.delete(chatId);
    if (!adminAuthByChatId.get(chatId)) {
      await sendWithMainKeyboard(token, chatId, "❌ Сначала авторизуйся: /admin <пароль>");
      return true;
    }

    const amount = Number(text.trim());
    if (!Number.isFinite(amount) || amount <= 0) {
      await sendWithAdminKeyboard(token, chatId, "Введите корректное значение опыта > 0.");
      return true;
    }

    const next = applyExperienceGain(player, Math.floor(amount));
    const updated = await storage.updateUser(player.id, {
      level: next.level,
      experience: next.experience,
    });
    const refreshed = await getUserWithGameState(updated.id);
    await sendWithAdminKeyboard(
      token,
      chatId,
      refreshed
        ? `✅ РќР°С‡РёСЃР»РµРЅРѕ ${Math.floor(amount)} XP\n\n${await formatPlayerProfile(refreshed)}`
        : `✅ РќР°С‡РёСЃР»РµРЅРѕ ${Math.floor(amount)} XP`,
    );
    if (player.level < ADVANCED_PERSONALITY_UNLOCK_LEVEL && updated.level >= ADVANCED_PERSONALITY_UNLOCK_LEVEL) {
      await maybePromptAdvancedPersonality(token, chatId, updated);
    }
    if (player.level < PROFESSION_UNLOCK_LEVEL && updated.level >= PROFESSION_UNLOCK_LEVEL) {
      await maybePromptProfession(token, chatId, updated);
    }
    return true;
  }

  if (pendingAction.type === "company_create") {
    const companyName = normalizeTelegramCompanyName(pendingAction.companyName ?? "");
    const companyCreateCost = getCompanyCreateCostForPlayer(player.city);
    if (!companyName) {
      const nextCompanyName = normalizeTelegramCompanyName(text);
      if (nextCompanyName.length < 3 || nextCompanyName.length > 40) {
        await sendMessage(token, chatId, "Название компании должно быть длиной от 3 до 40 символов.");
        return true;
      }

      pendingActionByChatId.set(chatId, { type: "company_create", companyName: nextCompanyName });
      await sendMessage(
        token,
        chatId,
        "Теперь отправь один эмоджи для компании. Пример: 🚀 или 🏢",
        { reply_markup: buildCompanyReplyMarkup(null) },
      );
      return true;
    }

    const companyEmoji = normalizeTelegramCompanyEmoji(text);
    if (!isValidTelegramCompanyEmoji(companyEmoji)) {
      await sendMessage(token, chatId, "Эмоджи компании должен быть ровно одним эмоджи. Пример: 🚀");
      return true;
    }

    const membership = await getPlayerCompanyContext(player.id);
    if (membership) {
      pendingActionByChatId.delete(chatId);
      await sendWithMainKeyboard(token, chatId, "Ты уже состоишь в компании. Используй /company.");
      return true;
    }

    if (player.balance < companyCreateCost) {
      await sendMessage(
        token,
        chatId,
        `Недостаточно средств для создания компании. Нужно ${getCurrencySymbol(player.city)}${companyCreateCost}.`,
      );
      return true;
    }

    let debited: User | null = null;
    try {
      debited = await storage.updateUser(player.id, {
        balance: player.balance - companyCreateCost,
      });
      const company = await storage.createCompany(
        { name: formatTelegramCompanyDisplayName(companyName.slice(0, 40), companyEmoji), city: player.city },
        player.id,
        player.username,
      );
      const members = await storage.getCompanyMembers(company.id);
      await ensureCompanyEconomyState(company, members.length);
      pendingActionByChatId.delete(chatId);
      await sendMessage(
        token,
        chatId,
        `✅ Компания создана: ${company.name}\nСписано: ${getCurrencySymbol(player.city)}${companyCreateCost}\nОстаток: ${getCurrencySymbol(player.city)}${debited.balance}`,
      );
      const refreshed = await getPlayerCompanyContext(player.id);
      if (refreshed) {
        await sendCompanyProfile(token, chatId, refreshed);
      }
    } catch (error) {
      if (debited) {
        await storage.updateUser(player.id, { balance: debited.balance + companyCreateCost });
      }
      await sendMessage(token, chatId, `❌ ${extractErrorMessage(error)}`);
    }
    return true;
  }

  return false;
}

async function handleIncomingCallback(token: string, webAppUrl: string, query: TelegramCallbackQuery) {
  const callbackId = query.id;
  const chatId = query.message?.chat?.id;
  const messageId = query.message?.message_id;
  const data = (query.data || "").trim();
  let callbackText = "Готово";
  let shouldClearInlineButtons = true;

  try {
    if (!chatId || !data) {
      callbackText = "Некорректная кнопка";
      return;
    }

    if (data === "pvp_boost:start" || data.startsWith("pvp_boost:buy:")) {
      const actor = query.from ? await resolveOrCreateTelegramPlayer(query.from) : null;
      if (!actor) {
        callbackText = "Профиль не найден";
        return;
      }
      if (data.startsWith("pvp_boost:buy:")) {
        const boostId = data.split(":").pop();
        await callInternalApi("POST", "/api/pvp/boosts/purchase", { userId: actor.id, boostId });
        callbackText = "Boost куплен";
      } else {
        await callInternalApi("POST", "/api/pvp/duel/start", { userId: actor.id });
        callbackText = "Дуэль стартует";
      }

      const status = await callInternalApi("GET", `/api/pvp/status?userId=${encodeURIComponent(actor.id)}`) as any;
      if (messageId && status?.activeDuel) {
        await callTelegramApi(token, "editMessageText", {
          chat_id: chatId,
          message_id: messageId,
          text: formatPvpActiveDuelText(status.activeDuel),
          ...(status.activeDuel.awaitingStart ? { reply_markup: buildPvpBoostInlineKeyboard(status.activeDuel) } : {}),
        });
      }
      shouldClearInlineButtons = false;
      return;
    }

    const housingViewMatch = data.match(/^housing:view:(.+)$/);
    if (housingViewMatch) {
      const player = await resolveOrCreateTelegramPlayer(query.from);
      const refreshedUser = await storage.getUser(player.id);
      const house = getHousingById(housingViewMatch[1]);
      if (!refreshedUser || !house) {
        callbackText = "Дом не найден";
        return;
      }
      callbackText = "Дом";
      shouldClearInlineButtons = false;
      await replaceHousingCardMessage(token, chatId, messageId, refreshedUser, house);
      return;
    }

    const housingBuyMatch = data.match(/^housing:buy:(.+)$/);
    if (housingBuyMatch) {
      const player = await resolveOrCreateTelegramPlayer(query.from);
      const updated = await purchaseHousing(player.id, housingBuyMatch[1]);
      const house = getHousingById(housingBuyMatch[1]);
      if (!house) {
        callbackText = "Дом не найден";
        return;
      }
      callbackText = "Дом куплен";
      shouldClearInlineButtons = false;
      await replaceHousingCardMessage(token, chatId, messageId, updated, house, "✅ Покупка завершена.");
      return;
    }

    const housingActivateMatch = data.match(/^housing:activate:(.+)$/);
    if (housingActivateMatch) {
      const player = await resolveOrCreateTelegramPlayer(query.from);
      const updated = await setActiveHousing(player.id, housingActivateMatch[1]);
      const house = getHousingById(housingActivateMatch[1]);
      if (!house) {
        callbackText = "Дом не найден";
        return;
      }
      callbackText = "Дом активирован";
      shouldClearInlineButtons = false;
      await replaceHousingCardMessage(token, chatId, messageId, updated, house, "🏠 Этот дом теперь активен.");
      return;
    }

    const registrationCallback = await handleRegistrationCallback({
      data,
      token,
      chatId,
      messageId,
      callbackId: query.id,
      query,
      webAppUrl,
      registrationDraftByChatId,
      registrationInterviewMessageByChatId,
      registrationInterviewFeedbackMessageByChatId,
      registrationTutorialAnimationByChatId,
      pendingActionByChatId,
      storage,
      callInternalApi,
      callTelegramApi,
      sendMessage,
      sendWithMainKeyboard,
      sendTelegramRegistrationStepPrompt,
      handleIncomingMessage,
      buildInterviewAnswerFeedback,
      formatProjectedRegistrationSkills,
      formatStats,
      normalizeCitySlideIndex,
      normalizePersonalitySlideIndex,
      normalizeGenderSlideIndex,
      formatRegistrationCitySlide,
      formatRegistrationPersonalitySlide,
      formatRegistrationGenderSlide,
      buildRegistrationCityInlineMarkup,
      buildRegistrationPersonalityInlineMarkup,
      buildRegistrationGenderInlineMarkup,
      buildPlayerRegistrationState,
      registrationInterviewQuestions: REGISTRATION_INTERVIEW_QUESTIONS,
      tutorialDemoBlueprint: TUTORIAL_DEMO_BLUEPRINT,
      runRegistrationTutorialProgressAnimation,
      formatRegistrationTutorialBlueprintProgress,
      formatRegistrationTutorialProduceProgress,
      grantStarterHousing,
      resolveTelegramRegistrationStep,
      applyReferralFromStartPayload,
      resolveTelegramSnapshot,
      getCurrencySymbol,
      referralNewPlayerReward: REFERRAL_NEW_PLAYER_REWARD,
      getActiveHousing,
      getStarterHousingForCity,
      sendHousingCard,
      cityOptions: CITY_OPTIONS,
      personalityOptions: PERSONALITY_OPTIONS,
      genderOptions: GENDER_OPTIONS,
      saveRegistrationProgress,
    });
    if (registrationCallback?.handled) {
      callbackText = registrationCallback.callbackText ?? callbackText;
      if (typeof registrationCallback.shouldClearInlineButtons === "boolean") {
        shouldClearInlineButtons = registrationCallback.shouldClearInlineButtons;
      }
      return;
    }

    const advancedPickMatch = data.match(/^adv_personality:pick:(engineer|investor|strategist)$/);
    if (advancedPickMatch) {
      const player = await resolveOrCreateTelegramPlayer(query.from);
      if (!canSelectAdvancedPersonality(player)) {
        callbackText = "Выбор недоступен";
        return;
      }
      const selectedId = advancedPickMatch[1] as AdvancedPersonalityId;
      const selected = getAdvancedPersonalityById(selectedId);
      if (!selected) {
        callbackText = "Характер не найден";
        return;
      }

      await setAdvancedPersonality(player.id, selected.id);
      pendingActionByChatId.delete(chatId);
      callbackText = "Характер выбран";
      const snapshot = await getUserWithGameState(player.id);
      const profileText = snapshot ? await formatPlayerProfile(snapshot) : "Профиль обновлён.";
      await sendWithMainKeyboard(token, chatId, [
        `✅ Второй характер выбран: ${selected.emoji} ${selected.name}`,
        "",
        profileText,
      ].join("\n"));
      return;
    }

    const professionPickMatch = data.match(/^profession:pick:(backend|qa|designer|analyst|devops)$/);
    if (professionPickMatch) {
      const player = await resolveOrCreateTelegramPlayer(query.from);
      if (!canSelectProfession(player)) {
        callbackText = "Выбор недоступен";
        return;
      }
      const selectedId = professionPickMatch[1] as ProfessionId;
      const selected = getProfessionById(selectedId);
      if (!selected) {
        callbackText = "Профессия не найдена";
        return;
      }

      await setPlayerProfession(player.id, selected.id);
      callbackText = "Профессия выбрана";
      const snapshot = await getUserWithGameState(player.id);
      const profileText = snapshot ? await formatPlayerProfile(snapshot) : "Профиль обновлён.";
      await sendWithMainKeyboard(token, chatId, [
        `✅ Профессия выбрана: ${selected.emoji} ${selected.name}`,
        "",
        profileText,
      ].join("\n"));
      return;
    }

    if (data === "inv:open") {
      callbackText = "РРЅРІРµРЅС‚Р°СЂСЊ";
      const snapshot = await resolveTelegramSnapshot(query.from);
      const inventoryView = buildInventoryMenu(snapshot);
      inventoryRefsByChatId.set(chatId, inventoryView.refs);
      const notices = formatNotices(snapshot.notices);
      const base = notices ? `${inventoryView.text}\n\n${notices}` : inventoryView.text;
      if (messageId) {
        await callTelegramApi(token, "editMessageText", {
          chat_id: chatId,
          message_id: messageId,
          text: base,
        });
      } else {
        await sendMessage(token, chatId, base);
      }
      return;
    }

    const inventoryActionMatch = data.match(/^inv:(use|equip|service|scrap):(\d+)$/);
    if (inventoryActionMatch) {
      const action = inventoryActionMatch[1];
      const index = inventoryActionMatch[2];
      callbackText = "РРЅРІРµРЅС‚Р°СЂСЊ";
      const command = action === "use"
        ? `/use ${index}`
        : action === "equip"
        ? `/equip ${index}`
        : action === "service"
          ? `/service ${index}`
          : `/scrap ${index}`;
      await handleIncomingMessage(token, webAppUrl, {
        chat: { id: chatId },
        from: query.from,
        text: command,
      });
      return;
    }

    if (data === "quest:refresh") {
      callbackText = "Квесты";
      const player = await resolveOrCreateTelegramPlayer(query.from);
      const questView = formatWeeklyQuestMenu(player);
      if (messageId) {
        await callTelegramApi(token, "editMessageText", {
          chat_id: chatId,
          message_id: messageId,
          text: questView.text,
        });
      } else {
        await sendMessage(token, chatId, questView.text);
      }
      return;
    }

    if (data === "quest:claim") {
      callbackText = "Награда квеста";
      await handleIncomingMessage(token, webAppUrl, {
        chat: { id: chatId },
        from: query.from,
        text: "/quest_claim",
      });
      return;
    }

    if (data === "quest:reputation") {
      callbackText = "Репутация";
      await handleIncomingMessage(token, webAppUrl, {
        chat: { id: chatId },
        from: query.from,
        text: "/reputation",
      });
      return;
    }

    if (data === "quest:rating") {
      callbackText = "Рейтинг";
      await handleIncomingMessage(token, webAppUrl, {
        chat: { id: chatId },
        from: query.from,
        text: "/rating",
      });
      return;
    }

    if (data === "auction:locked") {
      callbackText = "Лот недоступен";
      await answerCallbackQuery(token, callbackId, "Первые 5 минут лот доступен только компании-разработчику");
      shouldClearInlineButtons = false;
      return;
    }

    const auctionBuyMatch = data.match(/^auction:buy:(.+)$/);
    if (auctionBuyMatch) {
      callbackText = "Покупка лота";
      const player = await resolveOrCreateTelegramPlayer(query.from);
      if (!(await ensureCityHubAccess(token, chatId, player, { chat: { id: chatId }, from: query.from, text: "/auction" }))) {
        return;
      }
      try {
        await callInternalApi("POST", "/api/market/buy", { listingId: auctionBuyMatch[1], buyerId: player.id });
        const text = `✅ Покупка завершена.\n\n${await formatAuctionSection(player.id, chatId)}`;
        if (messageId) {
          await callTelegramApi(token, "editMessageText", {
            chat_id: chatId,
            message_id: messageId,
            text,
            reply_markup: await buildAuctionInlineMarkup(player.id, chatId),
          });
        } else {
          await sendMessage(token, chatId, text, { reply_markup: await buildAuctionInlineMarkup(player.id, chatId) });
        }
        shouldClearInlineButtons = false;
      } catch (error) {
        await sendWithCityHubKeyboard(token, chatId, `❌ ${extractErrorMessage(error)}`);
      }
      return;
    }

    const auctionBidMatch = data.match(/^auction:bid:(.+)$/);
    if (auctionBidMatch) {
      callbackText = "Ставка";
      const player = await resolveOrCreateTelegramPlayer(query.from);
      if (!(await ensureCityHubAccess(token, chatId, player, { chat: { id: chatId }, from: query.from, text: "/auction" }))) {
        return;
      }
      pendingActionByChatId.set(chatId, { type: "auction_bid_amount", listingId: auctionBidMatch[1] });
      await sendWithCityHubKeyboard(token, chatId, "Введи сумму ставки в GRM.");
      shouldClearInlineButtons = false;
      return;
    }

    const ratingMatch = data.match(/^rating:(players|companies):(level|reputation|wealth|blueprints|pvp)$/);
    if (ratingMatch) {
      callbackText = "Рейтинг";
      const entity = normalizeRatingEntity(ratingMatch[1]);
      const sortValue = ratingMatch[2];
      const ratingMenu = await formatRatingMenu(entity, sortValue);
      if (messageId) {
        await callTelegramApi(token, "editMessageText", {
          chat_id: chatId,
          message_id: messageId,
          text: ratingMenu.text,
        });
      } else {
        await sendMessage(token, chatId, ratingMenu.text);
      }
      return;
    }

    if (data.startsWith("tutorial:")) {
      const player = await resolveOrCreateTelegramPlayer(query.from);

      if (data === "tutorial:refresh") {
          callbackText = "Обновлено";
          const tutorial = await getTutorialSnapshotByUser(player.id);
          const text = formatTutorialMenuText(tutorial, player.city);
          if (messageId) {
            await callTelegramApi(token, "editMessageText", {
              chat_id: chatId,
              message_id: messageId,
              text,
              reply_markup: buildTutorialInlineButtons(tutorial),
            });
        } else {
          await sendMessage(token, chatId, text);
        }
        return;
      }

      if (data === "tutorial:start") {
        callbackText = "Обучение запущено";
        await callInternalApi("POST", `/api/tutorial/${player.id}/start`, {});
        await sendTutorialMenu(token, chatId, player.id);
        return;
      }

    if (data === "tutorial:open_jobs") {
        callbackText = "Вакансии";
        await handleIncomingMessage(token, webAppUrl, {
          chat: { id: chatId },
          from: query.from,
          text: "/jobs",
        });
        return;
      }

      if (data === "tutorial:open_study") {
        callbackText = "Учёба";
        await handleIncomingMessage(token, webAppUrl, {
          chat: { id: chatId },
          from: query.from,
          text: "/study",
        });
        return;
      }

      if (data === "tutorial:open_shop_courses") {
        callbackText = "Курсы";
        await handleIncomingMessage(token, webAppUrl, {
          chat: { id: chatId },
          from: query.from,
          text: "/shop_courses",
        });
        return;
      }

      if (data === "tutorial:open_shop_gadgets") {
        callbackText = "Гаджеты";
        await handleIncomingMessage(token, webAppUrl, {
          chat: { id: chatId },
          from: query.from,
          text: "/shop_gadgets",
        });
        return;
      }

      if (data === "tutorial:open_inventory") {
        callbackText = "Инвентарь";
        await handleIncomingMessage(token, webAppUrl, {
          chat: { id: chatId },
          from: query.from,
          text: "/inventory",
        });
        return;
      }

      if (data === "tutorial:open_stocks") {
        callbackText = "Инвестиции";
        await handleIncomingMessage(token, webAppUrl, {
          chat: { id: chatId },
          from: query.from,
          text: "/stocks",
        });
        return;
      }

      const tutorialSnapshot = await getTutorialSnapshotByUser(player.id);
      let demoCompanyId = tutorialSnapshot.state.demoCompanyId;
      if (
        data === "tutorial:bp_start"
        && !demoCompanyId
      ) {
        demoCompanyId = await ensureHiddenTutorialWorkshop(player.id);
      }

      if (data === "tutorial:bp_start") {
        callbackText = "Блок перенесён";
        await sendMessage(token, chatId, "ℹ️ Блок разработки гаджета убран из обычного /tutorial. Этот сценарий теперь проходит только во время регистрации.");
        await sendTutorialMenu(token, chatId, player.id);
        return;
      }

      if (data === "tutorial:bp_check") {
        callbackText = "Блок перенесён";
        await sendMessage(token, chatId, "ℹ️ Блок разработки гаджета убран из обычного /tutorial. Этот сценарий теперь проходит только во время регистрации.");
        await sendTutorialMenu(token, chatId, player.id);
        return;
      }

      if (data === "tutorial:produce") {
        callbackText = "Блок перенесён";
        await sendMessage(token, chatId, "ℹ️ Блок разработки гаджета убран из обычного /tutorial. Этот сценарий теперь проходит только во время регистрации.");
        await sendTutorialMenu(token, chatId, player.id);
        return;
      }

      if (data === "tutorial:sell") {
        callbackText = "Блок перенесён";
        await sendMessage(token, chatId, "ℹ️ Блок разработки гаджета убран из обычного /tutorial. Этот сценарий теперь проходит только во время регистрации.");
        await sendTutorialMenu(token, chatId, player.id);
        return;
      }

      if (data === "tutorial:complete") {
        callbackText = "Завершение";
        await callInternalApi("POST", `/api/tutorial/${player.id}/complete`, {});
        await sendTutorialCompletionCelebration(token, chatId);
        await sendTutorialMenu(token, chatId, player.id);
        return;
      }
    }

    const jobPickMatch = data.match(/^job:pick:(\d+)$/);
    if (jobPickMatch) {
      callbackText = "Вакансия";
      const player = await resolveOrCreateTelegramPlayer(query.from);
      if (!(await ensureExclusiveActionAllowed(token, chatId, player.id, "job"))) {
        return;
      }
      const result = await runJobSelection(token, chatId, player, jobPickMatch[1]);
      if (!result.ok) {
        await sendWithCurrentHubKeyboard(token, chatId, player.id, `❌ ${result.message}\nОткрой вакансии ещё раз и выбери кнопку повторно.`);
      }
      return;
    }

    if (data === "job:back") {
      callbackText = "Назад";
      const player = await resolveOrCreateTelegramPlayer(query.from);
      pendingActionByChatId.delete(chatId);
      await sendCityHubSummary(token, chatId, player.id);
      return;
    }

    const repairCallback = await handleRepairCallback({
      data,
      token,
      chatId,
      messageId,
      query,
      resolveOrCreateTelegramPlayer,
      ensureCityHubAccess,
      ensureCompanyHubAccess,
      formatRepairServiceMenu,
      buildRepairServiceInlineMarkup,
      callTelegramApi,
      extractErrorMessage,
      sendMessage,
      sendCityHubSummary,
      repairGadgetRefsByChatId,
      listRepairableGadgets,
      sendRepairServiceMenu,
      calculateRepairEstimate,
      getGadgetConditionStatusLabel,
      getCurrencySymbol,
      formatRepairDuration,
      createRepairOrder,
      cancelRepairOrderByPlayer,
      getPlayerCompanyContext,
      sendWithMainKeyboard,
      formatCompanyRepairServiceMenu,
      buildCompanyRepairServiceInlineMarkup,
      sendCompanyRootMenu,
      getRepairOrder,
      sendCompanyRepairServiceMenu,
      hasCompanyRepairParts,
      acceptRepairOrder,
      consumeCompanyRepairParts,
      startRepairOrder,
      getTelegramIdByUserId,
      failRepairOrder,
    });
    if (repairCallback?.handled) {
      callbackText = repairCallback.callbackText ?? callbackText;
      if (typeof repairCallback.shouldClearInlineButtons === "boolean") {
        shouldClearInlineButtons = repairCallback.shouldClearInlineButtons;
      }
      return;
    }

    if (data.startsWith("stocks:")) {
      const player = await resolveOrCreateTelegramPlayer(query.from);
      if (!(await ensureCityHubAccess(token, chatId, player, { chat: { id: chatId }, from: query.from, text: "/stocks" }))) {
        callbackText = "Биржа недоступна";
        return;
      }

      const [, action, ticker = "", qtyRaw = "0"] = data.split(":");
      try {
        if (action === "refresh") {
          callbackText = "Открой биржу заново";
          await sendMessage(token, chatId, await formatStocksMenu(player.id), {
            reply_markup: buildStocksHomeReplyMarkup(),
          });
          return;
        }

        if (action === "news") {
          callbackText = "Новости рынка";
          const text = await formatStocksNewsMenu(player.id);
          await sendMessage(token, chatId, text, {
            reply_markup: buildStocksHomeReplyMarkup(),
          });
          return;
        }

        const quantity = Math.max(1, Math.floor(Number(qtyRaw || 0)));
        if (!ticker || !Number.isFinite(quantity)) {
          callbackText = "Неверная сделка";
          return;
        }

        if (action === "buy") {
          const result = await buyStockAsset(player.id, ticker, quantity);
          const tutorialAdvance = await tryApplyTutorialEvent(player.id, "first_stock_bought");
          callbackText = `Куплено ${ticker}`;
          const text = [
            `✅ Куплено: ${result.ticker} x${result.quantity}`,
            `Цена: ${getCurrencySymbol(player.city)}${result.pricePerShare.toFixed(2)}`,
            `Списано: ${getCurrencySymbol(player.city)}${result.totalCost.toFixed(2)}`,
            formatTutorialAdvanceNotice(tutorialAdvance, player.city),
            "",
            await formatStocksMenu(player.id),
          ].filter(Boolean).join("\n");
          await sendMessage(token, chatId, text, { reply_markup: buildStocksHomeReplyMarkup() });
          return;
        }

        if (action === "sell") {
          const result = await sellStockAsset(player.id, ticker, quantity);
          callbackText = `Продано ${ticker}`;
          const text = [
            `✅ Продано: ${result.ticker} x${result.quantity}`,
            `Цена: ${getCurrencySymbol(player.city)}${result.pricePerShare.toFixed(2)}`,
            `Получено: ${getCurrencySymbol(player.city)}${result.totalRevenue.toFixed(2)}`,
            "",
            await formatStocksMenu(player.id),
          ].join("\n");
          await sendMessage(token, chatId, text, { reply_markup: buildStocksHomeReplyMarkup() });
          return;
        }
      } catch (error) {
        callbackText = "Ошибка биржи";
        await sendWithBankKeyboard(token, chatId, `❌ ${extractErrorMessage(error)}`);
        return;
      }
    }

    const shopBuyActionMatch = data.match(/^shopbuy:(use|equip):(.+)$/);
    if (shopBuyActionMatch) {
      const player = await resolveOrCreateTelegramPlayer(query.from);
      const [, action, itemRef] = shopBuyActionMatch;
      if (action === "use") {
        callbackText = "Использование";
        try {
          const result = await useInventoryItem(player.id, itemRef);
          const tutorialAdvance = await tryApplyTutorialEvent(player.id, "first_course_item_used");
          const lines = [
            `✅ Использован предмет: ${result.item.name}`,
            `Эффект: ${formatStats(result.item.stats)}`,
            "",
            await formatLiveProfile(result.user, result.state),
          ];
          const tutorialNotice = formatTutorialAdvanceNotice(tutorialAdvance, result.user.city);
          if (tutorialNotice) lines.push("", tutorialNotice);
          if (result.notices.length) lines.push("", formatNotices(result.notices));
          await sendWithCurrentHubKeyboard(token, chatId, player.id, lines.join("\n"));
        } catch (error) {
          await sendWithCurrentHubKeyboard(token, chatId, player.id, `❌ ${extractErrorMessage(error)}`);
        }
        return;
      }
      if (action === "equip") {
        callbackText = "Экипировка";
        try {
          const result = await toggleGearItem(player.id, itemRef);
          const tutorialAdvance = result.isEquipped
            ? await tryApplyTutorialEvent(player.id, "first_gadget_equipped")
            : null;
          const lines = [
            `${result.isEquipped ? "🟢 Надето" : "⚪ Снято"}: ${result.item.name}`,
            `Бонусы: ${formatStats(result.item.stats)}`,
            "",
            await formatLiveProfile(result.user, result.state),
          ];
          const tutorialNotice = formatTutorialAdvanceNotice(tutorialAdvance, result.user.city);
          if (tutorialNotice) lines.push("", tutorialNotice);
          if (result.notices.length) lines.push("", formatNotices(result.notices));
          await sendWithCurrentHubKeyboard(token, chatId, player.id, lines.join("\n"));
        } catch (error) {
          await sendWithCurrentHubKeyboard(token, chatId, player.id, `❌ ${extractErrorMessage(error)}`);
        }
        return;
      }
    }

    if (!data.startsWith("company:")) {
      callbackText = "Действие не поддерживается";
      return;
    }

    const player = await resolveOrCreateTelegramPlayer(query.from);
    const companyJoinMatch = data.match(/^company:join:(.+)$/);
    if (companyJoinMatch) {
      callbackText = "Вступление в компанию";
      await handleIncomingMessage(token, webAppUrl, {
        chat: { id: chatId },
        from: query.from,
        text: `/company_join ${companyJoinMatch[1]}`,
      });
      return;
    }

    if (data === "company:create_start") {
      callbackText = "Создание компании";
      const membership = await getPlayerCompanyContext(player.id);
      if (membership) {
        await sendMessage(token, chatId, "Ты уже состоишь в компании. Используй /company.", {
          reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
        });
        return;
      }
      const companyCreateCost = getCompanyCreateCostForPlayer(player.city);
      pendingActionByChatId.set(chatId, { type: "company_create" });
      await sendMessage(
        token,
        chatId,
        `Введи название новой компании (3-40 символов).\nПосле этого бот попросит один эмоджи.\nСтоимость: ${getCurrencySymbol(player.city)}${companyCreateCost}`,
        { reply_markup: buildCompanyReplyMarkup(null) },
      );
      return;
    }

    const currentExclusiveAction = await getCurrentExclusiveAction(player.id, chatId);
    if (currentExclusiveAction && currentExclusiveAction !== "development") {
      callbackText = "Действие заблокировано";
      await sendWithCurrentHubKeyboard(
        token,
        chatId,
        player.id,
        `⛔ Сейчас уже выполняется действие: ${formatExclusiveActionLabel(currentExclusiveAction)}.\nСначала заверши его или нажми «⬅️ Назад».`,
      );
      return;
    }
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership) {
      callbackText = "Ты не состоишь в компании";
      await sendWithMainKeyboard(token, chatId, "Ты не состоишь в компании. Используй /company, чтобы вступить или создать новую.");
      return;
    }

    if (data === "company:work") {
      callbackText = "Раздел: Работа";
      shouldClearInlineButtons = false;
      const view = await formatCompanyWorkSection(membership, chatId);
      if (messageId) {
        await callTelegramApi(token, "editMessageText", {
          chat_id: chatId,
          message_id: messageId,
          text: view.text,
        });
      } else {
        await sendMessage(token, chatId, view.text, {
          reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
        });
      }
      return;
    }

    if (data === "company:warehouse") {
      callbackText = "Раздел: Склад";
      await sendCompanyWarehouseSection(token, chatId, membership, player.id);
      return;
    }

    const miningPickMatch = data.match(/^company:mining_pick:(short|medium|long)$/);
    if (miningPickMatch) {
      callbackText = "Выбор смены";
      await handleIncomingMessage(token, webAppUrl, {
        chat: { id: chatId },
        from: query.from,
        text: `/company_mining_start ${miningPickMatch[1]}`,
      });
      return;
    }

    if (data === "company:mining_claim") {
      callbackText = "Забор добычи";
      await handleIncomingMessage(token, webAppUrl, {
        chat: { id: chatId },
        from: query.from,
        text: "/company_mining_claim",
      });
      return;
    }

    if (data === "company:mining_refresh" || data === "company:mining_start") {
      callbackText = "Добыча";
      shouldClearInlineButtons = false;
      const status = await getCompanyMiningStatus(membership.company.id, player.id);
      const text = formatMiningPlansMenu(status);
      if (messageId) {
        await callTelegramApi(token, "editMessageText", {
          chat_id: chatId,
          message_id: messageId,
          text,
          reply_markup: buildCompanyMiningInlineButtons(status),
        });
      } else {
        await sendMessage(token, chatId, text, {
          reply_markup: buildCompanyMiningInlineButtons(status),
        });
      }
      return;
    }

    if (data === "company:mining_claim") {
      callbackText = "Получение награды";
      shouldClearInlineButtons = false;
      const currentStatus = await getCompanyMiningStatus(membership.company.id, player.id);
      if (currentStatus.status !== "ready_to_claim" || !currentStatus.rewardPreview) {
        await sendOrEditCompanyBureauSection(token, chatId, membership, player.id, messageId, "⏱ Добыча еще в процессе.");
        return;
      }
      const warehouseCheck = await ensureCompanyWarehouseCanStoreMiningReward(
        membership.company,
        currentStatus.rewardPreview.quantity,
      );
      if (!warehouseCheck.ok) {
        await sendOrEditCompanyBureauSection(
          token,
          chatId,
          membership,
          player.id,
          messageId,
          `⚠️ На складе недостаточно места. Свободно слотов: ${warehouseCheck.free}.`,
        );
        return;
      }
      const claimed = await claimCompanyMining(membership.company.id, player.id);
      const reward = claimed.reward;
      addPartToCompanyWarehouse(membership.company.id, reward);
      const text = [
        `✅ Добыча завершена: ${reward.partName} x${reward.quantity}`,
        `Редкость: ${reward.rarity}`,
        "Деталь перемещена на склад компании.",
      ].join("\n");
      await sendOrEditCompanyBureauSection(token, chatId, membership, player.id, messageId, text);
      return;
    }

    if (data === "company:bureau") {
      callbackText = "Раздел: Бюро";
      shouldClearInlineButtons = false;
      await sendOrEditCompanyBureauSection(token, chatId, membership, player.id, messageId);
      return;
    }

    const exclusiveToggleMatch = data.match(/^company:exclusive_part_toggle:(\d+)$/);
    if (exclusiveToggleMatch) {
      callbackText = "Деталь";
      shouldClearInlineButtons = false;
      const pendingAction = pendingActionByChatId.get(chatId);
      if (!pendingAction || pendingAction.type !== "company_exclusive_parts") {
        await sendMessage(token, chatId, "Сначала запусти разработку эксклюзивного гаджета через «Старт».", {
          reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
        });
        return;
      }
      const refs = getCompanyWarehouseParts(membership.company.id).map((item) => `${item.id}::${item.rarity}`);
      companyExclusivePartRefsByChatId.set(chatId, refs);
      const selectedRefs = [...(companyExclusiveSelectedPartRefsByChatId.get(chatId) ?? [])].filter((ref) => refs.includes(ref));
      const partIndex = Number(exclusiveToggleMatch[1]) - 1;
      const targetRef = refs[partIndex];
      if (!targetRef) {
        await answerCallbackQuery(token, callbackId, "Деталь не найдена");
        return;
      }
      const existingIndex = selectedRefs.indexOf(targetRef);
      if (existingIndex >= 0) {
        selectedRefs.splice(existingIndex, 1);
      } else {
        if (selectedRefs.length >= 6) {
          await answerCallbackQuery(token, callbackId, "Максимум 6 деталей");
          return;
        }
        selectedRefs.push(targetRef);
      }
      companyExclusiveSelectedPartRefsByChatId.set(chatId, selectedRefs);
      await sendCompanyExclusivePartsPicker(
        token,
        chatId,
        membership,
        player.id,
        pendingAction.gadgetName,
        messageId,
      );
      return;
    }

    const exclusivePageMatch = data.match(/^company:exclusive_part_page:(stay|\d+)$/);
    if (exclusivePageMatch) {
      callbackText = "Страница";
      shouldClearInlineButtons = false;
      if (exclusivePageMatch[1] !== "stay") {
        companyExclusivePartPageByChatId.set(chatId, Math.max(0, Number(exclusivePageMatch[1]) || 0));
      }
      const pendingAction = pendingActionByChatId.get(chatId);
      if (!pendingAction || pendingAction.type !== "company_exclusive_parts") {
        await sendMessage(token, chatId, "Сначала запусти разработку эксклюзивного гаджета через «Старт».", {
          reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
        });
        return;
      }
      await sendCompanyExclusivePartsPicker(
        token,
        chatId,
        membership,
        player.id,
        pendingAction.gadgetName,
        messageId,
      );
      return;
    }

      if (data === "company:exclusive_part_reset") {
      callbackText = "Сброс";
      shouldClearInlineButtons = false;
      const pendingAction = pendingActionByChatId.get(chatId);
      if (!pendingAction || pendingAction.type !== "company_exclusive_parts") {
        await sendMessage(token, chatId, "Сначала запусти разработку эксклюзивного гаджета через «Старт».", {
          reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
        });
        return;
      }
      companyExclusiveSelectedPartRefsByChatId.set(chatId, []);
      companyExclusivePartPageByChatId.set(chatId, 0);
      await sendCompanyExclusivePartsPicker(
        token,
        chatId,
        membership,
        player.id,
        pendingAction.gadgetName,
        messageId,
      );
      return;
    }

    if (data === "company:exclusive_part_back") {
      callbackText = "Назад";
      pendingActionByChatId.delete(chatId);
      companyExclusiveSelectedPartRefsByChatId.delete(chatId);
      companyExclusivePartRefsByChatId.delete(chatId);
      companyExclusivePartPageByChatId.delete(chatId);
      setCompanyMenuSection(chatId, "root");
      rememberTelegramMenu(player.id, { menu: "company", section: "root" });
      await sendCompanyRootMenu(token, chatId, player);
      return;
    }

    if (data === "company:exclusive_part_done") {
      callbackText = "Старт разработки";
      shouldClearInlineButtons = false;
      const pendingAction = pendingActionByChatId.get(chatId);
      if (!pendingAction || pendingAction.type !== "company_exclusive_parts") {
        await sendMessage(token, chatId, "Сначала запусти разработку эксклюзивного гаджета через «Старт».", {
          reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
        });
        return;
      }
      const refs = getCompanyWarehouseParts(membership.company.id).map((item) => `${item.id}::${item.rarity}`);
      companyExclusivePartRefsByChatId.set(chatId, refs);
      const selectedRefs = [...(companyExclusiveSelectedPartRefsByChatId.get(chatId) ?? [])].filter((ref) => refs.includes(ref));
      companyExclusiveSelectedPartRefsByChatId.set(chatId, selectedRefs);
      if (selectedRefs.length < 3 || selectedRefs.length > 6) {
        await answerCallbackQuery(token, callbackId, "Нужно выбрать 3-6 деталей");
        await sendCompanyExclusivePartsPicker(
          token,
          chatId,
          membership,
          player.id,
          pendingAction.gadgetName,
          messageId,
        );
        return;
      }
      await startCompanyExclusiveDevelopment(
        token,
        chatId,
        membership,
        player.id,
        pendingAction.gadgetName,
        selectedRefs,
      );
      return;
    }

    const exclusiveJoinMatch = data.match(/^company:exclusive_join:(.+)$/);
    if (exclusiveJoinMatch) {
      callbackText = "Подключение к разработке";
      shouldClearInlineButtons = false;
      const companyId = String(exclusiveJoinMatch[1] || "");
      const company = await storage.getCompany(companyId);
      if (!company) {
        await sendMessage(token, chatId, "❌ Компания не найдена.");
        return;
      }
      const member = await storage.getMemberByUserId(companyId, player.id);
      if (!member) {
        await sendMessage(token, chatId, "❌ Только сотрудники этой компании могут присоединиться к разработке.");
        return;
      }
      const result = await callInternalApi("POST", `/api/companies/${companyId}/exclusive/join`, {
        userId: player.id,
      }) as any;
      await sendMessage(
        token,
        chatId,
        `✅ Ты присоединился к исследованию эксклюзивного гаджета.\nУчастников: ${Math.max(1, Number(result.participantCount || 1))}\n\n${formatExclusiveProgressLiveText(result.project)}`,
        { reply_markup: buildCompanyReplyMarkup(member.role === "owner" ? "owner" : "member", chatId) },
      );
      return;
    }

    if (data === "company:management") {
      callbackText = "Раздел: Управление";
      await sendCompanyManagementSection(token, chatId, membership);
      return;
    }

    if (data === "company:economy") {
      callbackText = "Раздел: Экономика";
      await sendCompanyEconomySection(token, chatId, membership);
      return;
    }

    if (data === "company:departments") {
      callbackText = "Раздел: Отделы";
      const view = await formatCompanyDepartmentsSection(membership);
      if (messageId) {
        await callTelegramApi(token, "editMessageText", {
          chat_id: chatId,
          message_id: messageId,
          text: view.text,
        });
      } else {
        await sendMessage(token, chatId, view.text);
      }
      return;
    }

    if (data === "company:topup") {
      callbackText = "Пополнение компании";
      pendingActionByChatId.set(chatId, { type: "company_topup", companyId: String(membership.company.id) });
      const rate = getLocalToGRMRate(player.city);
      await sendWithMainKeyboard(
        token,
        chatId,
        [
          "💱 Пополнение компании в GRM",
          `Твой курс: 1 локальная единица = ${formatRate(rate)} GRM`,
          `Баланс игрока: ${getCurrencySymbol(player.city)}${player.balance}`,
          "Введи сумму в локальной валюте.",
        ].join("\n"),
      );
      return;
    }

    if (data === "company:ipo") {
      callbackText = "Раздел: IPO";
      const view = await formatCompanyIpoSection(membership);
      if (messageId) {
        await callTelegramApi(token, "editMessageText", {
          chat_id: chatId,
          message_id: messageId,
          text: view.text,
        });
      } else {
        await sendMessage(token, chatId, view.text);
      }
      return;
    }

    if (data === "company:ipo_run") {
      callbackText = "Запуск IPO";
      await handleIncomingMessage(token, webAppUrl, {
        chat: { id: chatId },
        from: query.from,
        text: "/company_ipo_run",
      });
      return;
    }

    if (data === "company:requests") {
      callbackText = "Заявки";
      await handleIncomingMessage(token, webAppUrl, {
        chat: { id: chatId },
        from: query.from,
        text: "/company_requests",
      });
      return;
    }

    if (data === "company:staffing") {
      callbackText = "HR";
      if (membership.role !== "owner") {
        await sendWithMainKeyboard(token, chatId, "Раздел доступен только CEO компании.");
        return;
      }
      await sendMessage(token, chatId, await formatCompanyStaffingSection(membership, chatId), {
        reply_markup: buildCompanyStaffingInlineMarkup(chatId, membership.role),
      });
      return;
    }

    const staffPickMatch = data.match(/^company:staff_pick:(.+)$/);
    if (staffPickMatch) {
      callbackText = "Выбор сотрудника";
      if (membership.role !== "owner") {
        await sendWithMainKeyboard(token, chatId, "Раздел доступен только CEO компании.");
        return;
      }
      const members = await storage.getCompanyMembers(membership.company.id);
      const targetMember = members.find((member) => member.userId === staffPickMatch[1]);
      if (!targetMember || targetMember.role === "owner") {
        await sendMessage(token, chatId, "Для CEO отдел не назначается.", {
          reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
        });
        return;
      }
      await sendMessage(
        token,
        chatId,
        `Выбери отдел для ${targetMember.username}:`,
        { reply_markup: buildCompanyDepartmentSelectInlineMarkup(targetMember.userId, membership.role, chatId) },
      );
      return;
    }

    const staffAssignMatch = data.match(/^company:staff_assign:([^:]+):(researchAndDevelopment|production|marketing|finance|infrastructure)$/);
    if (staffAssignMatch) {
      callbackText = "Назначение в отдел";
      if (membership.role !== "owner") {
        await sendWithMainKeyboard(token, chatId, "Раздел доступен только CEO компании.");
        return;
      }
      try {
        await callInternalApi("POST", `/api/companies/${membership.company.id}/staffing/assign`, {
          actorUserId: player.id,
          targetUserId: staffAssignMatch[1],
          department: staffAssignMatch[2],
        });
        await sendMessage(token, chatId, "✅ Сотрудник назначен в отдел.");
      } catch (error) {
        await sendMessage(token, chatId, `❌ ${extractErrorMessage(error)}`);
      }
      await sendMessage(token, chatId, await formatCompanyStaffingSection(membership, chatId), {
        reply_markup: buildCompanyStaffingInlineMarkup(chatId, membership.role),
      });
      return;
    }

    if (data === "company:salary_setup") {
      callbackText = "Зарплаты";
      await sendMessage(token, chatId, await formatCompanySalariesSection(membership, chatId), {
        reply_markup: buildCompanySalariesInlineMarkup(membership, chatId),
      });
      return;
    }

    const salaryPickMatch = data.match(/^company:salary_pick:(.+)$/);
    if (salaryPickMatch) {
      callbackText = "Выбор зарплаты";
      if (membership.role !== "owner") {
        await sendWithMainKeyboard(token, chatId, "Команда доступна только CEO компании.");
        return;
      }
      const members = await storage.getCompanyMembers(membership.company.id);
      const targetMember = members.find((member) => member.userId === salaryPickMatch[1]);
      if (!targetMember) {
        await sendMessage(token, chatId, "Сотрудник не найден.", {
          reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
        });
        return;
      }
      pendingActionByChatId.set(chatId, {
        type: "company_set_salary_amount",
        companyId: String(membership.company.id),
        memberUserId: targetMember.userId,
        memberUsername: targetMember.username,
      });
      await sendMessage(
        token,
        chatId,
        `Введи зарплату для ${targetMember.username} в GRM.\nТекущее ограничение: 0-5000.`,
        { reply_markup: buildCompanyReplyMarkup(membership.role, chatId) },
      );
      return;
    }

    if (data === "company:salary_claim") {
      callbackText = "Получение зарплаты";
      await handleIncomingMessage(token, webAppUrl, {
        chat: { id: chatId },
        from: query.from,
        text: "/company_salary_claim",
      });
      return;
    }

    if (data === "company:upgrade") {
      callbackText = "Апгрейд";
      await handleIncomingMessage(token, webAppUrl, {
        chat: { id: chatId },
        from: query.from,
        text: "/company_upgrade",
      });
      return;
    }

    if (data === "company:expand") {
      callbackText = "Расширение склада";
      await handleIncomingMessage(token, webAppUrl, {
        chat: { id: chatId },
        from: query.from,
        text: "/company_expand",
      });
      return;
    }

    if (data === "company:leave") {
      callbackText = "Выход из компании";
      await handleIncomingMessage(token, webAppUrl, {
        chat: { id: chatId },
        from: query.from,
        text: "/company_leave",
      });
      return;
    }

    if (data === "company:delete") {
      callbackText = "Удаление компании";
      await handleIncomingMessage(token, webAppUrl, {
        chat: { id: chatId },
        from: query.from,
        text: "/company_delete",
      });
      return;
    }

    if (data === "company:bp_progress") {
      callbackText = "Ускорение отключено";
      await sendMessage(token, chatId, "⛔ Ускорение разработки (+24ч) отключено.");
      return;
    }

    const companyBlueprintStartMatch = data.match(/^company:bp_start:(.+)$/);
    if (companyBlueprintStartMatch) {
      callbackText = "Старт разработки";
      if (membership.role !== "owner") {
        await sendWithMainKeyboard(token, chatId, "Команда доступна только CEO компании.");
        return;
      }
      if (!(await ensureExclusiveActionAllowed(token, chatId, player.id, "development"))) {
        return;
      }
      if (!(await ensureCompanyProcessUnlocked(token, chatId, player.id, membership.company.id, "Разработка базового чертежа"))) {
        return;
      }
      await startCompanyBlueprintDevelopment(token, chatId, membership, player, companyBlueprintStartMatch[1]);
      return;
    }

    if (data === "company:bp_produce") {
      callbackText = "Производство";
      await handleIncomingMessage(token, webAppUrl, {
        chat: { id: chatId },
        from: query.from,
        text: "/company_bp_produce",
      });
      return;
    }

    if (data === "company:bp_confirm_back") {
      callbackText = "Изменить количество";
      const pendingAction = pendingActionByChatId.get(chatId);
      if (!pendingAction || pendingAction.type !== "company_bp_produce_confirm") {
        await sendMessage(token, chatId, "Открой «Производство гаджетов» ещё раз.", {
          reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
        });
        return;
      }
      const blueprintSnapshot = await getCompanyBlueprintSnapshot(membership.company.id);
      const blueprint = blueprintSnapshot.available.find((item) => item.id === pendingAction.blueprintId);
      if (!blueprint) {
        pendingActionByChatId.delete(chatId);
        await sendMessage(token, chatId, "Чертёж больше не найден.", {
          reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
        });
        return;
      }
      const warehouseParts = [...getCompanyWarehouseParts(membership.company.id)];
      const requiredParts = blueprint.production?.parts ?? {};
      const maxByParts = Object.entries(requiredParts).reduce((limit, [partType, qtyRaw]) => {
        const perUnit = Math.max(1, Number(qtyRaw || 0));
        const available = warehouseParts
          .filter((item) => item.type === partType)
          .reduce((sum, item) => sum + Math.max(1, Number(item.quantity || 1)), 0);
        return Math.min(limit, Math.floor(available / perUnit));
      }, 10);
      const maxQuantity = Math.max(1, Math.min(10, Number.isFinite(maxByParts) ? maxByParts : 1));
      pendingActionByChatId.set(chatId, {
        type: "company_bp_produce_qty",
        blueprintId: blueprint.id,
        blueprintName: blueprint.name,
        maxQuantity,
      });
      await sendMessage(token, chatId, `🏭 ${blueprint.name}\nВведи количество для запуска производства (1-${maxQuantity}).`, {
        reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
      });
      return;
    }

    if (data === "company:bp_confirm_start") {
      callbackText = "Запуск партии";
      const pendingAction = pendingActionByChatId.get(chatId);
      if (!pendingAction || pendingAction.type !== "company_bp_produce_confirm") {
        await sendMessage(token, chatId, "Сначала выбери чертёж и количество партии.", {
          reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
        });
        return;
      }
      try {
        const blueprintSnapshot = await getCompanyBlueprintSnapshot(membership.company.id);
        const blueprint = blueprintSnapshot.available.find((item) => item.id === pendingAction.blueprintId);
        if (!blueprint) {
          pendingActionByChatId.delete(chatId);
          await sendMessage(token, chatId, "❌ Активный чертёж больше не найден.", {
            reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
          });
          return;
        }

        const warehouseParts = [...getCompanyWarehouseParts(membership.company.id)];
        const requiredParts = blueprint.production?.parts ?? {};
        const pool: Array<{ id: string; type: string; rarity: RarityName }> = [];
        for (const item of warehouseParts) {
          const qty = Math.max(1, item.quantity || 1);
          for (let i = 0; i < qty; i += 1) {
            pool.push({ id: item.id, type: item.type, rarity: normalizePartRarity(item.rarity) });
          }
        }
        const selectedParts: Array<{ id: string; type: string; rarity: RarityName }> = [];
        for (const [partType, qtyRaw] of Object.entries(requiredParts)) {
          const needed = Math.max(0, Number(qtyRaw || 0)) * pendingAction.quantity;
          for (let i = 0; i < needed; i += 1) {
            const idx = pool.findIndex((item) => item.type === partType);
            if (idx === -1) {
              throw new Error(`Недостаточно деталей типа ${partType} для партии x${pendingAction.quantity}`);
            }
            selectedParts.push(pool[idx]);
            pool.splice(idx, 1);
          }
        }

        const result = await callInternalApi("POST", `/api/companies/${membership.company.id}/produce`, {
          userId: player.id,
          parts: selectedParts,
          quantity: pendingAction.quantity,
        }) as any;
        pendingActionByChatId.delete(chatId);
        const consumeCounter = new Map<string, number>();
        for (const part of selectedParts) {
          consumeCounter.set(part.id, (consumeCounter.get(part.id) ?? 0) + 1);
        }
        const nextWarehouseParts: CompanyWarehousePartItem[] = [];
        for (const part of warehouseParts) {
          const toConsume = consumeCounter.get(part.id) ?? 0;
          if (toConsume <= 0) {
            nextWarehouseParts.push(part);
            continue;
          }
          const left = Math.max(0, Math.max(1, part.quantity || 1) - toConsume);
          consumeCounter.set(part.id, Math.max(0, toConsume - Math.max(1, part.quantity || 1)));
          if (left > 0) {
            nextWarehouseParts.push({ ...part, quantity: left });
          }
        }
        setCompanyWarehouseParts(membership.company.id, nextWarehouseParts);
        await sendMessage(
          token,
          chatId,
          [
            `🏭 Партия запущена: ${pendingAction.blueprintName} x${pendingAction.quantity}`,
            `Готовность через: ${formatProductionOrderRemaining(result.order)}`,
            Number.isFinite(Number(result.gramSpent)) ? `Списано: ${formatNumber(Number(result.gramSpent))} GRM` : "",
            Number.isFinite(Number(result.companyBalance)) ? `Баланс компании: ${formatNumber(Number(result.companyBalance))} GRM` : "",
            result.gadgetWear?.summary ? String(result.gadgetWear.summary) : "",
            "Когда партия будет готова, открой «Производство гаджетов» ещё раз.",
          ].filter(Boolean).join("\n"),
          { reply_markup: buildCompanyReplyMarkup(membership.role, chatId) },
        );
      } catch (error) {
        await sendMessage(token, chatId, `❌ ${extractErrorMessage(error)}`, {
          reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
        });
      }
      return;
    }

    const companyExclusiveProducePickMatch = data.match(/^company:exclusive_produce_pick:(.+)$/);
    if (companyExclusiveProducePickMatch) {
      callbackText = "Выбор выпуска";
      if (membership.role !== "owner") {
        await sendWithMainKeyboard(token, chatId, "Команда доступна только CEO компании.");
        return;
      }
      const snapshot = await getCompanyExclusiveSnapshot(membership.company.id);
      const target = (snapshot.catalog ?? []).find((item) => item.id === companyExclusiveProducePickMatch[1]);
      if (!target) {
        await sendMessage(token, chatId, "Чертёж не найден. Открой «Выпуск» ещё раз.", {
          reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
        });
        return;
      }
      pendingActionByChatId.set(chatId, {
        type: "company_exclusive_produce_qty",
        blueprintId: target.id,
        blueprintName: target.name,
      });
      await sendMessage(token, chatId, `🏭 ${target.name}\nВведи количество для выпуска (1-${Math.max(1, target.remainingUnits)}).`, {
        reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
      });
      return;
    }

    if (data === "company:exclusive_confirm_back") {
      callbackText = "Изменить количество";
      const pendingAction = pendingActionByChatId.get(chatId);
      if (!pendingAction || pendingAction.type !== "company_exclusive_produce_confirm") {
        await sendMessage(token, chatId, "Открой «Выпуск» ещё раз.", {
          reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
        });
        return;
      }
      pendingActionByChatId.set(chatId, {
        type: "company_exclusive_produce_qty",
        blueprintId: pendingAction.blueprintId,
        blueprintName: pendingAction.blueprintName,
      });
      await sendMessage(token, chatId, `🏭 ${pendingAction.blueprintName}\nВведи количество для выпуска.`, {
        reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
      });
      return;
    }

    if (data === "company:exclusive_confirm_start") {
      callbackText = "Запуск эксклюзивной партии";
      const pendingAction = pendingActionByChatId.get(chatId);
      if (!pendingAction || pendingAction.type !== "company_exclusive_produce_confirm") {
        await sendMessage(token, chatId, "Сначала выбери чертёж и количество партии.", {
          reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
        });
        return;
      }
      try {
        const result = await callInternalApi("POST", `/api/companies/${membership.company.id}/exclusive/produce`, {
          userId: player.id,
          blueprintId: pendingAction.blueprintId,
          quantity: pendingAction.quantity,
        }) as any;
        pendingActionByChatId.delete(chatId);
        await sendMessage(
          token,
          chatId,
          [
            `🏭 Партия запущена: ${pendingAction.blueprintName} x${pendingAction.quantity}`,
            `Готовность через: ${formatProductionOrderRemaining(result.order)}`,
            Number.isFinite(Number(result.companyBalance)) ? `Баланс компании: ${formatNumber(Number(result.companyBalance))} GRM` : "",
            result.gadgetWear?.summary ? String(result.gadgetWear.summary) : "",
            "Когда партия будет готова, открой «Выпуск» ещё раз.",
          ].filter(Boolean).join("\n"),
          { reply_markup: buildCompanyReplyMarkup(membership.role, chatId) },
        );
      } catch (error) {
        await sendMessage(token, chatId, `❌ ${extractErrorMessage(error)}`, {
          reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
        });
      }
      return;
    }

    if (data === "company:bp_join") {
      callbackText = "Участие в разработке";
      const snapshot = await getCompanyBlueprintSnapshot(membership.company.id);
      const active = snapshot.active;
      if (!active || active.status !== "in_progress") {
        await sendMessage(token, chatId, "ℹ️ Сейчас нет активной разработки для подключения.");
        return;
      }
      const contribState = companyBlueprintContribByCompanyId.get(membership.company.id);
      if (!contribState || contribState.blueprintId !== active.blueprintId) {
        await sendMessage(token, chatId, "ℹ️ Для текущей разработки еще не инициализирован вклад навыков. Подождите немного.");
        return;
      }
      const userSnapshot = await getUserWithGameState(player.id);
      const skills = (userSnapshot?.game as GameView | undefined)?.skills;
      if (!skills) {
        await sendMessage(token, chatId, "❌ Профиль навыков не найден.");
        return;
      }
      const contributes =
        ((Number(contribState.required.coding ?? 0) > 0) && Number(skills.coding ?? 0) > 0)
        || ((Number(contribState.required.design ?? 0) > 0) && Number(skills.design ?? 0) > 0)
        || ((Number(contribState.required.analytics ?? 0) > 0) && Number(skills.analytics ?? 0) > 0);
      if (!contributes) {
        await sendMessage(token, chatId, "❌ Недостаточно нужных навыков для участия в этой разработке.");
        return;
      }
      contribState.participants.add(player.id);
      companyBlueprintContribByCompanyId.set(membership.company.id, contribState);
      await sendMessage(token, chatId, "✅ Вы присоединились к разработке. Ваши навыки теперь вкладываются каждую секунду.");
      await updateCompanyBlueprintProgressMessage(
        token,
        chatId,
        membership.company.name,
        membership.company.id,
        player.id,
      );
      return;
    }

    if (data === "company:bp_progress_live") {
      callbackText = "Живой прогресс";
      await updateCompanyBlueprintProgressMessage(
        token,
        chatId,
        membership.company.name,
        membership.company.id,
        player.id,
      );
      return;
    }

    const contractAcceptMatch = data.match(/^company:contract_accept:(\d+)$/);
    if (contractAcceptMatch) {
      callbackText = "Принятие контракта";
      await handleIncomingMessage(token, webAppUrl, {
        chat: { id: chatId },
        from: query.from,
        text: `/company_contract_accept ${contractAcceptMatch[1]}`,
      });
      return;
    }

    const contractPartToggleMatch = data.match(/^company:contract_part_toggle:(\d+)$/);
    if (contractPartToggleMatch) {
      callbackText = "Выбор детали";
      shouldClearInlineButtons = false;
      const pendingAction = pendingActionByChatId.get(chatId);
      if (!pendingAction || pendingAction.type !== "company_contract_parts") {
        await sendMessage(token, chatId, "Сначала открой контракт компании и запусти выбор деталей.", {
          reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
        });
        return;
      }
      const contracts = await getCityContracts(membership.company.city);
      const contract = contracts.find((item) => item.id === pendingAction.contractId);
      if (!contract) {
        clearPendingActionRuntimeState(chatId, pendingAction);
        await sendMessage(token, chatId, "Контракт больше не найден. Открой раздел работы компании заново.", {
          reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
        });
        return;
      }
      const refs = getCompanyWarehousePartUnitRefs(membership.company.id, pendingAction.requiredPartType).map((item) => item.ref);
      companyContractPartRefsByChatId.set(chatId, refs);
      const selectedRefs = [...(companyContractSelectedPartRefsByChatId.get(chatId) ?? [])].filter((ref) => refs.includes(ref));
      const partIndex = Number(contractPartToggleMatch[1]) - 1;
      const targetRef = refs[partIndex];
      if (!targetRef) {
        await answerCallbackQuery(token, callbackId, "Деталь не найдена");
        return;
      }
      const existingIndex = selectedRefs.indexOf(targetRef);
      if (existingIndex >= 0) {
        selectedRefs.splice(existingIndex, 1);
      } else {
        if (selectedRefs.length >= pendingAction.requiredQuantity) {
          await answerCallbackQuery(token, callbackId, `Можно выбрать только ${pendingAction.requiredQuantity}`);
          return;
        }
        selectedRefs.push(targetRef);
      }
      companyContractSelectedPartRefsByChatId.set(chatId, selectedRefs);
      await sendCompanyContractPartsPicker(token, chatId, membership, contract, messageId);
      return;
    }

    const contractPartPageMatch = data.match(/^company:contract_part_page:(stay|\d+)$/);
    if (contractPartPageMatch) {
      callbackText = "Страница деталей";
      shouldClearInlineButtons = false;
      if (contractPartPageMatch[1] !== "stay") {
        companyContractPartPageByChatId.set(chatId, Math.max(0, Number(contractPartPageMatch[1]) || 0));
      }
      const pendingAction = pendingActionByChatId.get(chatId);
      if (!pendingAction || pendingAction.type !== "company_contract_parts") {
        await sendMessage(token, chatId, "Сначала открой контракт компании и запусти выбор деталей.", {
          reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
        });
        return;
      }
      const contracts = await getCityContracts(membership.company.city);
      const contract = contracts.find((item) => item.id === pendingAction.contractId);
      if (!contract) {
        clearPendingActionRuntimeState(chatId, pendingAction);
        await sendMessage(token, chatId, "Контракт больше не найден. Открой раздел работы компании заново.", {
          reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
        });
        return;
      }
      await sendCompanyContractPartsPicker(token, chatId, membership, contract, messageId);
      return;
    }

    if (data === "company:contract_part_reset") {
      callbackText = "Сброс деталей";
      shouldClearInlineButtons = false;
      const pendingAction = pendingActionByChatId.get(chatId);
      if (!pendingAction || pendingAction.type !== "company_contract_parts") {
        await sendMessage(token, chatId, "Сначала открой контракт компании и запусти выбор деталей.", {
          reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
        });
        return;
      }
      const contracts = await getCityContracts(membership.company.city);
      const contract = contracts.find((item) => item.id === pendingAction.contractId);
      if (!contract) {
        clearPendingActionRuntimeState(chatId, pendingAction);
        await sendMessage(token, chatId, "Контракт больше не найден. Открой раздел работы компании заново.", {
          reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
        });
        return;
      }
      companyContractSelectedPartRefsByChatId.set(chatId, []);
      companyContractPartPageByChatId.set(chatId, 0);
      await sendCompanyContractPartsPicker(token, chatId, membership, contract, messageId);
      return;
    }

    if (data === "company:contract_part_back") {
      callbackText = "Назад к контрактам";
      const pendingAction = pendingActionByChatId.get(chatId);
      if (pendingAction && pendingAction.type === "company_contract_parts") {
        clearPendingActionRuntimeState(chatId, pendingAction);
      }
      await sendCompanyWorkSection(token, chatId, membership);
      return;
    }

    if (data === "company:contract_part_done") {
      callbackText = "Сдача деталей";
      shouldClearInlineButtons = false;
      const pendingAction = pendingActionByChatId.get(chatId);
      if (!pendingAction || pendingAction.type !== "company_contract_parts") {
        await sendMessage(token, chatId, "Сначала открой контракт компании и запусти выбор деталей.", {
          reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
        });
        return;
      }
      const contracts = await getCityContracts(membership.company.city);
      const contract = contracts.find((item) => item.id === pendingAction.contractId);
      if (!contract) {
        clearPendingActionRuntimeState(chatId, pendingAction);
        await sendMessage(token, chatId, "Контракт больше не найден. Открой раздел работы компании заново.", {
          reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
        });
        return;
      }
      const refs = getCompanyWarehousePartUnitRefs(membership.company.id, pendingAction.requiredPartType).map((item) => item.ref);
      const selectedRefs = [...(companyContractSelectedPartRefsByChatId.get(chatId) ?? [])].filter((ref) => refs.includes(ref));
      companyContractSelectedPartRefsByChatId.set(chatId, selectedRefs);
      if (selectedRefs.length !== pendingAction.requiredQuantity) {
        await answerCallbackQuery(token, callbackId, `Нужно выбрать ${pendingAction.requiredQuantity} деталей`);
        await sendCompanyContractPartsPicker(token, chatId, membership, contract, messageId);
        return;
      }
      try {
        await completeCompanyContractDelivery(token, chatId, membership, contract, player.id, { partRefs: selectedRefs });
        clearPendingActionRuntimeState(chatId, pendingAction);
      } catch (error) {
        await sendMessage(token, chatId, `❌ ${extractErrorMessage(error)}`);
      }
      await sendCompanyWorkSection(token, chatId, membership);
      return;
    }

    const contractDeliverMatch = data.match(/^company:contract_deliver:(\d+)$/);
    if (contractDeliverMatch) {
      callbackText = "Сдача контракта";
      await handleIncomingMessage(token, webAppUrl, {
        chat: { id: chatId },
        from: query.from,
        text: `/company_contract_deliver ${contractDeliverMatch[1]}`,
      });
      return;
    }

    const requestAcceptMatch = data.match(/^company:request_accept:(.+)$/);
    if (requestAcceptMatch) {
      callbackText = "Одобрение заявки";
      await handleIncomingMessage(token, webAppUrl, {
        chat: { id: chatId },
        from: query.from,
        text: `/company_accept ${requestAcceptMatch[1]}`,
      });
      return;
    }

    const requestDeclineMatch = data.match(/^company:request_decline:(.+)$/);
    if (requestDeclineMatch) {
      callbackText = "Отклонение заявки";
      await handleIncomingMessage(token, webAppUrl, {
        chat: { id: chatId },
        from: query.from,
        text: `/company_decline ${requestDeclineMatch[1]}`,
      });
      return;
    }

    const departmentUpgradeMatch = data.match(
      /^company:dept_upgrade:(researchAndDevelopment|production|marketing|finance|infrastructure)$/,
    );
    if (departmentUpgradeMatch) {
      callbackText = "Улучшение отдела";
      await handleIncomingMessage(token, webAppUrl, {
        chat: { id: chatId },
        from: query.from,
        text: `/company_department_upgrade ${departmentUpgradeMatch[1]}`,
      });
      return;
    }

    callbackText = "Неизвестная кнопка";
  } catch (error) {
    callbackText = "Ошибка";
    if (chatId) {
      await sendMessage(token, chatId, `❌ ${extractErrorMessage(error)}`);
    }
  } finally {
    try {
      if (chatId && messageId && shouldClearInlineButtons) {
        try {
          await callTelegramApi(token, "editMessageReplyMarkup", {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: { inline_keyboard: [] },
          });
          const tracked = lastInlineMessageByChatId.get(chatId);
          if (tracked && tracked === messageId) {
            lastInlineMessageByChatId.delete(chatId);
          }
        } catch {
          // ignore cleanup errors
        }
      }
      await answerCallbackQuery(token, callbackId, callbackText);
    } catch (error) {
      console.warn("⚠️ Не удалось подтвердить callback_query:", error);
    }
  }
}

async function handleIncomingMessage(token: string, webAppUrl: string, message: TelegramMessage) {
  if (!message.chat?.id || typeof message.text !== "string") return;
  const chatId = message.chat.id;
  const text = message.text.trim();
  if (!text) return;

  const normalized = normalizeCommand(text);
  let command = normalized.command;
  let args = normalized.args;
  if (!command.startsWith("/")) {
    const fullAlias = resolvePlainTextAlias(text, chatId);
    if (fullAlias) {
      command = fullAlias;
      args = [];
    } else {
      const [firstWord, ...rest] = text.trim().split(/\s+/);
      const alias = resolvePlainTextAlias(firstWord, chatId);
      if (alias) {
        command = alias;
        args = rest;
      }
    }
  }
  if (command === "/cancel") {
    await handleCancelCommand(token, chatId, message);
    return;
  }

  if (await tryHandlePendingAction(token, chatId, text, message)) return;

  if (!command.startsWith("/")) return;

  const quickEquipMatch = command.match(/^\/equip_(\d+)$/);
  if (quickEquipMatch) {
    command = "/equip";
    args = [quickEquipMatch[1]];
  }
  const quickBuyMatch = command.match(/^\/buy_(\d+)$/);
  if (quickBuyMatch) {
    command = "/buy";
    args = [quickBuyMatch[1]];
  }
  const quickSellMatch = command.match(/^\/sell_(\d+)$/);
  if (quickSellMatch) {
    command = "/sell";
    args = [quickSellMatch[1]];
  }
  const quickUseMatch = command.match(/^\/use_(\d+)$/);
  if (quickUseMatch) {
    command = "/use";
    args = [quickUseMatch[1]];
  }
  const quickServiceMatch = command.match(/^\/service_(\d+)$/);
  if (quickServiceMatch) {
    command = "/service";
    args = [quickServiceMatch[1]];
  }
  const quickScrapMatch = command.match(/^\/scrap_(\d+)$/);
  if (quickScrapMatch) {
    command = "/scrap";
    args = [quickScrapMatch[1]];
  }
  const quickDevMatch = command.match(/^\/dev(\d+)$/);
  if (quickDevMatch) {
    command = "/company_bp_start";
    args = [quickDevMatch[1]];
  }
  const quickCompanyPartDepositMatch = command.match(/^\/cpd(\d+)$/);
  if (quickCompanyPartDepositMatch) {
    command = "/cpd";
    args = [quickCompanyPartDepositMatch[1]];
  }
  const quickHackathonPartMatch = command.match(/^\/hpart(\d+)$/);
  if (quickHackathonPartMatch) {
    command = "/hackathon_part_apply";
    args = [quickHackathonPartMatch[1]];
  }

  const playerForRegistration = await resolveOrCreateTelegramPlayer(message.from);
  const registrationStep = resolveTelegramRegistrationStep(playerForRegistration, chatId);
  if (registrationStep && command !== "/help") {
    const startPayload = command === "/start" ? args[0] ?? "" : undefined;
    await beginTelegramRegistration(token, chatId, playerForRegistration, startPayload, registrationStep);
    return;
  }

  if (canSelectAdvancedPersonality(playerForRegistration) && command !== "/help") {
    await maybePromptAdvancedPersonality(token, chatId, playerForRegistration);
    return;
  }

  if (canSelectProfession(playerForRegistration) && !["/help", "/profession"].includes(command)) {
    await maybePromptProfession(token, chatId, playerForRegistration);
    return;
  }

  if (await maybeStartCitySectionTravel(token, chatId, playerForRegistration, message, command)) {
    return;
  }

  if (!["/help", "/cancel", "/start", "/starttg"].includes(command)) {
    const currentExclusiveAction = await getCurrentExclusiveAction(playerForRegistration.id, chatId);
    if (currentExclusiveAction && !isCommandCompatibleWithExclusiveAction(command, currentExclusiveAction)) {
      await sendWithCurrentHubKeyboard(
        token,
        chatId,
        playerForRegistration.id,
        `⛔ Сейчас уже выполняется действие: ${formatExclusiveActionLabel(currentExclusiveAction)}.\nСначала заверши его или нажми «⬅️ Назад».`,
      );
      return;
    }
  }

  if (command === "/help") {
    await sendWithMainKeyboard(token, chatId, [
      "📘 СПРАВКА ПО КОМАНДАМ",
      "━━━━━━━━━━━━━━",
      "🚀 Старт",
      "• /start — открыть Mini App и профиль",
      "• /starttg — включить текстовый режим",
      "• /menu — открыть главное меню",
      "",
      "👤 Игрок",
      "• /profile — профиль игрока",
      "• /me | /status — быстрый профиль",
      "• /profession — выбрать профессию с 15 уровня",
      "• /jobs — список вакансий",
      "• Вакансии запускаются из /jobs кнопками.",
      "• /study — меню обучения",
      "• /tutorial — стартовое обучение (8 шагов)",
      "• /repair_service — городской сервис ремонта гаджетов",
      "• Аукцион теперь поддерживает покупку и ставки кнопками.",
      "",
      "🛍 Магазин и инвентарь",
      "• /shop — каталог магазина",
      "• Покупка и продажа теперь идут через кнопки и меню.",
      "• /inventory — показать инвентарь",
      "• /inv — короткая команда инвентаря",
      "• Использование, экипировка, обслуживание и разбор доступны из инвентаря.",
      "",
      "🏦 Банк и GRM",
      "• /bank — банковское меню кнопками",
      "• /credits | /deposits — программы",
      "• После открытия программы бот ждёт обычный ответ: номер сумма дни.",
      "• /repay | /withdraw — закрыть продукт",
      "• /gram — обмен валюты и GRM",
      "• /exchange_to_gram <сумма>",
      "• /exchange_from_gram <кол-во>",
      "",
      "🏢 Компании",
      "• /company — меню компании",
      "• /company_work | /company_mining | /company_warehouse | /company_bureau | /company_management",
      "• /company_service — сервисные заказы компании (CEO)",
      "• /company_staffing | /company_requests | /company_salaries | /company_departments",
      "• /company_part_deposit — открыть перенос запчастей на склад компании",
      "• /company_part_deposit 1 3 — быстрый перенос (пример)",
      "• /cpd1 — быстрый выбор 1-й запчасти",
      "• Пополнение компании, зарплаты и отделы теперь настраиваются кнопками в меню компании.",
      "• /company_salary_claim остаётся как совместимый скрытый алиас.",
      "• /company_expand | /company_upgrade (CEO)",
      "• /company_ipo | /company_ipo_run (CEO)",
      "",
      "🏁 Weekly Hackathon",
      "• /hackathon — статус и таблица",
      "• /hackathon_join — регистрация компании (CEO, 1000 GRM)",
      "• /hackathon_skill — skill-вклад (−20% энергии)",
      "• /hackathon_grm <100|500|1000> — вложить GRM",
      "• /hackathon_part — список деталей для вклада",
      "• /sabotage — меню саботажа",
      "• /sabotage_attack <type> <targetCompanyId> [targetUserId]",
      "• /sabotage_security <1|2|3> — уровень защиты компании",
      "• /poach_accept <offerId> | /poach_decline <offerId>",
      "• /events — глобальные события мира",
      "• /pvp — меню PvP Arena",
      "• /pvp_find — найти соперника (1v1)",
      "• /pvp_leave — выйти из PvP очереди",
      "• /pvp_history — последние PvP бои",
      "• Контракты компании принимаются и сдаются кнопками в разделе «Работа».",
      "• Для контрактов на запчасти CEO отдельно выбирает детали со склада компании.",
      "• /company_bureau | /company_bp_produce (CEO)",
      "• /company_exclusive — раздел редких гаджетов",
      "• Старт базовых чертежей и выпуск эксклюзивов теперь выбираются кнопками в меню компании.",
      "• /company_upgrade | /company_expand (CEO)",
      "• Создание и вступление в компанию запускаются из реестра компаний кнопками.",
      "• /company_leave",
      "• Заявки в компанию одобряются и отклоняются кнопками в HR-разделе.",
      "",
      "👥 Рефералы",
      "• /ref — твоя реферальная ссылка",
      "",
      "🏆 Прочее",
      "• /quests — еженедельное задание",
      "• /quest_claim — забрать награду за квест",
      "• /reputation | /rep — статус и бонусы репутации",
      "• /rating | /top — рейтинг игроков/компаний",
      "• /city <город> — сменить город",
      "• /cancel — возврат назад / отмена текущего действия (кнопка: «⬅️ Назад»)",
      "",
      "🛠 Админ",
      "• /admin <пароль>",
      "• /admin_add_money <сумма>",
      "• /admin_add_exp <сумма>",
      "• /admin_reset_player | /admin_restart",
      "• /admin_hackathon_start | /admin_hackathon_end | /admin_hackathon_reset",
      "• /admin_global_event",
      "• /admin_logout",
    ].join("\n"));
    return;
  }

  if (command === "/start") {
    const payload = args[0] ?? "";
    const player = playerForRegistration;
    const startRegistrationStep = resolveTelegramRegistrationStep(player, chatId);
    if (startRegistrationStep) {
      await beginTelegramRegistration(token, chatId, player, payload, startRegistrationStep);
      return;
    }
    const referralResult = await applyReferralFromStartPayload(player, payload);
    const snapshot = await resolveTelegramSnapshot(message.from);
    const profileText = await formatPlayerProfile(snapshot);
    const referralNotice =
      referralResult?.status === "applied"
        ? `\n\n🎃 Реферальный бонус начислен: +${getCurrencySymbol(snapshot.user.city)}${REFERRAL_NEW_PLAYER_REWARD}`
        : referralResult?.status === "self"
        ? "\n\n⚠️ Нельзя активировать собственную реферальную ссылку."
        : referralResult?.status === "already"
        ? "\n\nℹ️ Реферальная ссылка уже была активирована ранее."
        : referralResult?.status === "invalid"
        ? "\n\n⚠️ Реферальный код не найден."
        : "";
    const intro = `${buildWelcomeMessage(message.from)}${referralNotice}\n\n${profileText}`;
    if (canUseTelegramWebAppButton(webAppUrl)) {
      const startAppUrl = `${webAppUrl}?tgStart=${encodeURIComponent(payload)}`;
      await sendMessage(token, chatId, intro, {
        reply_markup: { inline_keyboard: [[{ text: "🚀 Открыть игру (Mini App)", web_app: { url: startAppUrl } }]] },
      });
    } else {
      await sendMessage(token, chatId, `${intro}\n\nвљ пёЏ Mini App РЅРµ РЅР°СЃС‚СЂРѕРµРЅ: TELEGRAM_WEBAPP_URL РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ HTTPS.`);
    }

    if (referralResult?.status === "applied") {
      const inviterTelegramId = getTelegramIdByUserId(referralResult.inviter.id);
      const inviterChatId = Number(inviterTelegramId);
      if (Number.isFinite(inviterChatId) && inviterChatId !== chatId) {
        try {
          await sendWithMainKeyboard(
            token,
            inviterChatId,
            [
              "🎉 Новый реферал по твоей ссылке!",
              `👤 Игрок: ${snapshot.user.username}`,
              `💰 Бонус: +${getCurrencySymbol(referralResult.inviter.city)}${REFERRAL_INVITER_REWARD}`,
              `💼 Текущий баланс: ${getCurrencySymbol(referralResult.inviter.city)}${referralResult.inviter.balance}`,
            ].join("\n"),
          );
        } catch (error) {
          console.warn("⚠️ Не удалось отправить уведомление рефереру:", error);
        }
      }
    }

    await restoreTelegramMenuState(token, chatId, player, message, "Для текстовой версии игры отправь: /starttg");
    return;
  }

  if (command === "/starttg") {
    const startTgRegistrationStep = resolveTelegramRegistrationStep(playerForRegistration, chatId);
    if (startTgRegistrationStep) {
      await beginTelegramRegistration(token, chatId, playerForRegistration, undefined, startTgRegistrationStep);
      return;
    }
    pendingActionByChatId.delete(chatId);
    await restoreTelegramMenuState(token, chatId, playerForRegistration, message);
    return;
  }

  if (command === "/menu") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    const activeTravel = playerTravelByUserId.get(player.id);
    if (activeTravel) {
      const secondsLeft = getTravelRemainingSeconds(player.id);
      await sendWithMainKeyboard(token, chatId, `🚶 Вы уже в пути в ${formatTravelTargetLabel(activeTravel.target)}. Осталось ~${secondsLeft} сек.`);
      return;
    }

    const currentLocation = getPlayerHubLocation(player.id);
    if (currentLocation !== "home") {
      if (!(await ensureExclusiveActionAllowed(token, chatId, player.id, "travel"))) {
        return;
      }
      const travelMs = currentLocation === "city" ? TRAVEL_TO_CITY_MS : TRAVEL_TO_COMPANY_MS;
      const travelSec = Math.ceil(travelMs / 1000);
      const arrivesAtMs = Date.now() + travelMs;
      await sendWithMainKeyboard(token, chatId, `🚶 Возвращаемся в главное меню (дом). Прибытие через ${travelSec} сек.`);
      const timer = setTimeout(async () => {
        try {
          const state = playerTravelByUserId.get(player.id);
          if (!state || state.arrivesAtMs !== arrivesAtMs || state.target !== "home") return;
          playerTravelByUserId.delete(player.id);
          setPlayerHubLocation(player.id, "home");
          const snapshot = await resolveTelegramSnapshot(message.from);
          const notices = formatNotices(snapshot.notices);
          const base = await buildBotModeMessage(snapshot);
          await sendWithMainKeyboard(token, state.chatId, `✅ Вы вернулись домой.\n\n${notices ? `${base}\n\n${notices}` : base}`);
        } catch (error) {
          console.error("Travel to home (menu) completion error:", error);
        }
      }, travelMs);
      playerTravelByUserId.set(player.id, { target: "home", arrivesAtMs, timer, chatId });
      return;
    }

    clearPlayerTravel(player.id);
    setPlayerHubLocation(player.id, "home");
    pendingActionByChatId.delete(chatId);
    const snapshot = await resolveTelegramSnapshot(message.from);
    await sendHomeMenu(token, chatId, snapshot, player.id);
    return;
  }

  if (command === "/extras") {
    rememberTelegramMenu(playerForRegistration.id, { menu: "extras" });
    await sendWithExtrasKeyboard(
      token,
      chatId,
      [
        "🧩 Допы",
        "• Рейтинг",
        "• Квесты",
        "• Репутация",
        "• Рефералы",
      ].join("\n"),
    );
    return;
  }

  if (command === "/city_hub") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    const activeTravel = playerTravelByUserId.get(player.id);
    if (activeTravel) {
      const secondsLeft = getTravelRemainingSeconds(player.id);
      await sendWithMainKeyboard(token, chatId, `🚶 Вы уже в пути в ${formatTravelTargetLabel(activeTravel.target)}. Осталось ~${secondsLeft} сек.`);
      return;
    }
    if (!(await ensureExclusiveActionAllowed(token, chatId, player.id, "travel"))) {
      return;
    }

    const currentLocation = getPlayerHubLocation(player.id);
    if (currentLocation === "company") {
      await forceReturnHome(token, chatId, player, message, "⛔ Из компании нельзя сразу перейти в город.");
      return;
    }

    if (currentLocation === "home") {
      const travelMs = getHousingTravelDurationMs(player, TRAVEL_TO_CITY_MS);
      const arrivesAtMs = Date.now() + travelMs;
      await sendWithMainKeyboard(token, chatId, `🚶 Вы вышли из дома в город. Прибытие через ${Math.ceil(travelMs / 1000)} сек.`);
      const timer = setTimeout(async () => {
        try {
          const state = playerTravelByUserId.get(player.id);
          if (!state || state.arrivesAtMs !== arrivesAtMs || state.target !== "city") return;
          playerTravelByUserId.delete(player.id);
          setPlayerHubLocation(player.id, "city");
          await sendCityHubSummary(token, state.chatId, player.id, "✅ Вы прибыли в город.");
        } catch (error) {
          console.error("Travel to city completion error:", error);
        }
      }, travelMs);
      playerTravelByUserId.set(player.id, { target: "city", arrivesAtMs, timer, chatId });
      return;
    }

    setPlayerHubLocation(player.id, "city");
    await sendCityHubSummary(token, chatId, player.id);
    return;
  }

  if (command === "/auction") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    if (!(await ensureCityHubAccess(token, chatId, player, message))) return;
    await sendMessage(token, chatId, await formatAuctionSection(player.id, chatId), {
      reply_markup: await buildAuctionInlineMarkup(player.id, chatId),
    });
    return;
  }

  if (command === "/housing") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    if (!(await ensureCityHubAccess(token, chatId, player, message))) return;
    const refreshedUser = await grantStarterHousing(player.id);
    const activeHouse = getActiveHousing(refreshedUser) ?? getStarterHousingForCity(refreshedUser.city);
    rememberTelegramMenu(player.id, { menu: "housing" });
    if (!activeHouse) {
      await sendWithCityHubKeyboard(token, chatId, "🏘 Недвижимость в этом городе пока закрыта.");
      return;
    }
    await sendHousingCard(token, chatId, refreshedUser, activeHouse, formatHousingMenuText(refreshedUser));
    return;
  }

  if (await handleRepairMessage({
    command,
    args,
    token,
    chatId,
    message,
    resolveOrCreateTelegramPlayer,
    ensureCityHubAccess,
    ensureCompanyHubAccess,
    sendRepairServiceMenu,
    repairGadgetRefsByChatId,
    createRepairOrder,
    getCurrencySymbol,
    formatRepairDuration,
    extractErrorMessage,
    repairOrderRefsByChatId,
    cancelRepairOrderByPlayer,
    getPlayerCompanyContext,
    sendWithMainKeyboard,
    sendCompanyRepairServiceMenu,
    listRepairOrdersForCity,
    getRepairOrder,
    hasCompanyRepairParts,
    acceptRepairOrder,
    consumeCompanyRepairParts,
    startRepairOrder,
    getTelegramIdByUserId,
    sendMessage,
    failRepairOrder,
  })) {
    return;
  }

  if (command === "/auction_buy") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    if (!(await ensureCityHubAccess(token, chatId, player, message))) return;
    const ref = args.join(" ").trim();
    if (!ref) {
      await sendWithCityHubKeyboard(token, chatId, "Использование: /auction_buy <номер лота>");
      return;
    }
    try {
      const listingId = resolveMarketListingRefFromChat(chatId, ref);
      await callInternalApi("POST", "/api/market/buy", { listingId, buyerId: player.id });
      await sendWithCityHubKeyboard(token, chatId, `✅ Покупка завершена.\n\n${await formatAuctionSection(player.id, chatId)}`);
    } catch (error) {
      await sendWithCityHubKeyboard(token, chatId, `❌ ${extractErrorMessage(error)}`);
    }
    return;
  }

  if (command === "/auction_bid") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    if (!(await ensureCityHubAccess(token, chatId, player, message))) return;
    const ref = String(args[0] || "").trim();
    const amount = Number(args[1] || 0);
    if (!ref || !Number.isFinite(amount) || amount <= 0) {
      await sendWithCityHubKeyboard(token, chatId, "Использование: /auction_bid <номер лота> <GRM>");
      return;
    }
    try {
      const listingId = resolveMarketListingRefFromChat(chatId, ref);
      await callInternalApi("POST", "/api/market/bid", { listingId, bidderId: player.id, amount });
      await sendWithCityHubKeyboard(token, chatId, `✅ Ставка принята.\n\n${await formatAuctionSection(player.id, chatId)}`);
    } catch (error) {
      await sendWithCityHubKeyboard(token, chatId, `❌ ${extractErrorMessage(error)}`);
    }
    return;
  }

  if (command === "/profile" || command === "/me" || command === "/status") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    const activeTravel = playerTravelByUserId.get(player.id);
    if (activeTravel) {
      const secondsLeft = getTravelRemainingSeconds(player.id);
      await sendWithMainKeyboard(token, chatId, `🚶 Вы уже в пути в ${formatTravelTargetLabel(activeTravel.target)}. Осталось ~${secondsLeft} сек.`);
      return;
    }

    const currentLocation = getPlayerHubLocation(player.id);
    if (currentLocation !== "home") {
      if (!(await ensureExclusiveActionAllowed(token, chatId, player.id, "travel"))) {
        return;
      }
      const travelMs = currentLocation === "city" ? TRAVEL_TO_CITY_MS : TRAVEL_TO_COMPANY_MS;
      const travelSec = Math.ceil(travelMs / 1000);
      const arrivesAtMs = Date.now() + travelMs;
      await sendWithMainKeyboard(token, chatId, `🚶 Вы отправились домой. Прибытие через ${travelSec} сек.`);
      const timer = setTimeout(async () => {
        try {
          const state = playerTravelByUserId.get(player.id);
          if (!state || state.arrivesAtMs !== arrivesAtMs || state.target !== "home") return;
          playerTravelByUserId.delete(player.id);
          setPlayerHubLocation(player.id, "home");
          const snapshot = await resolveTelegramSnapshot(message.from);
          const notices = formatNotices(snapshot.notices);
          const base = await formatPlayerProfile(snapshot);
          await sendWithMainKeyboard(token, state.chatId, `✅ Вы вернулись домой.\n\n${notices ? `${base}\n\n${notices}` : base}`);
        } catch (error) {
          console.error("Travel to home completion error:", error);
        }
      }, travelMs);
      playerTravelByUserId.set(player.id, { target: "home", arrivesAtMs, timer, chatId });
      return;
    }

    clearPlayerTravel(player.id);
    setPlayerHubLocation(player.id, "home");
    const snapshot = await resolveTelegramSnapshot(message.from);
    const notices = formatNotices(snapshot.notices);
    const base = await formatPlayerProfile(snapshot);
    await sendWithMainKeyboard(token, chatId, notices ? `${base}\n\n${notices}` : base);
    return;
  }

  if (command === "/profession") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    const currentProfession = getProfessionById(getPlayerProfessionId(player) || "");
    if (currentProfession) {
      await sendWithMainKeyboard(
        token,
        chatId,
        `🎓 Текущая профессия: ${currentProfession.emoji} ${currentProfession.name}\n${currentProfession.subtitle}`,
      );
      return;
    }
    if (player.level < PROFESSION_UNLOCK_LEVEL) {
      await sendWithMainKeyboard(token, chatId, `🎓 Профессия откроется на ${PROFESSION_UNLOCK_LEVEL} уровне.`);
      return;
    }
    await sendMessage(token, chatId, buildProfessionSelectText(), {
      reply_markup: buildProfessionSelectInlineMarkup(),
    });
    return;
  }

  if (command === "/ref" || command === "/referral") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    rememberTelegramMenu(player.id, { menu: "extras" });
    await sendWithExtrasKeyboard(token, chatId, await formatReferralMenu(player));
    return;
  }

  if (command === "/reputation" || command === "/rep") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    await sendMessage(token, chatId, formatReputationMenu(player), {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🗓 Квесты", callback_data: "quest:refresh" }, { text: "🏆 Рейтинг", callback_data: "quest:rating" }],
        ],
      },
    });
    return;
  }

  if (command === "/quests" || command === "/quest") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    const questView = formatWeeklyQuestMenu(player);
    await sendMessage(token, chatId, questView.text, {
      reply_markup: buildQuestInlineButtons(questView.canClaim),
    });
    return;
  }

  if (command === "/quest_claim") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    try {
      const claimed = await claimWeeklyQuestReward(player.id);
      const snapshot = await getUserWithGameState(player.id);
      const questView = formatWeeklyQuestMenu(claimed.user);
      const lines = [
        "🎁 Награда за недельный квест получена!",
        `+${getCurrencySymbol(claimed.user.city)}${claimed.rewardMoney}, +${claimed.rewardExp} XP, +${claimed.rewardReputation} СЂРµРїСѓС‚Р°С†РёРё`,
      ];
      if (snapshot) {
        lines.push("", await formatPlayerProfile(snapshot));
      }
      await sendMessage(token, chatId, lines.join("\n"), {
        reply_markup: buildQuestInlineButtons(questView.canClaim),
      });
    } catch (error) {
      await sendWithMainKeyboard(token, chatId, `❌ ${extractErrorMessage(error)}`);
    }
    return;
  }

  if (command === "/tutorial" || command === "/onboarding") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    try {
      await sendTutorialMenu(token, chatId, player.id);
    } catch (error) {
      await sendWithMainKeyboard(token, chatId, `❌ ${extractErrorMessage(error)}`);
    }
    return;
  }

  if (command === "/rating" || command === "/top") {
    const firstArg = args[0];
    const entity = isRatingEntityToken(firstArg) ? normalizeRatingEntity(firstArg) : "players";
    const sortArg = isRatingEntityToken(firstArg) ? args[1] : firstArg;
    const ratingMenu = await formatRatingMenu(entity, sortArg);
    await sendMessage(token, chatId, ratingMenu.text, {
      reply_markup: buildRatingInlineButtons(ratingMenu.entity, ratingMenu.sort),
    });
    return;
  }

  if (command === "/study") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    if (!(await ensureCityHubAccess(token, chatId, player, message))) return;
    if (!(await ensureExclusiveActionAllowed(token, chatId, player.id, "study"))) {
      return;
    }
    const requestedLevel = args.join(" ").trim();
    if (requestedLevel) {
      const levelKey = resolveEducationLevel(requestedLevel, player.level);
      if (!levelKey) {
        await sendWithCurrentHubKeyboard(token, chatId, player.id, "❌ Этот уровень обучения недоступен.");
        return;
      }
      pendingActionByChatId.set(chatId, { type: "study_course_select", levelKey });
      rememberTelegramMenu(player.id, { menu: "study_courses", levelKey });
      await sendMessage(token, chatId, formatEducationCoursesMenu(player, levelKey), {
        reply_markup: buildEducationCoursesReplyMarkup(levelKey),
      });
      return;
    }

    pendingActionByChatId.set(chatId, { type: "study_level_select" });
    rememberTelegramMenu(player.id, { menu: "study_levels" });
    await sendMessage(token, chatId, formatEducationLevelsMenu(player), {
      reply_markup: buildEducationLevelsReplyMarkup(player.level),
    });
    return;
  }
  if (command === "/jobs") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    if (!(await ensureCityHubAccess(token, chatId, player, message))) return;
    if (!(await ensureExclusiveActionAllowed(token, chatId, player.id, "job"))) {
      return;
    }
    const snapshot = await resolveTelegramSnapshot(message.from);
    const jobsCount = listJobsByCity(snapshot.user.city, getPlayerProfessionId(snapshot.user), snapshot.user.level).length;
    if (jobsCount <= 0) {
      pendingActionByChatId.delete(chatId);
      await sendWithCurrentHubKeyboard(token, chatId, player.id, "В вашем городе нет вакансий.");
      return;
    }
    pendingActionByChatId.set(chatId, { type: "job_select" });
    rememberTelegramMenu(player.id, { menu: "jobs" });
    await sendMessage(token, chatId, formatJobsMenu(snapshot), { reply_markup: buildJobsInlineMarkup(snapshot) });
    return;
  }

  if (command === "/job") {
    const ref = args.join(" ").trim();
    if (!ref) {
      const player = await resolveOrCreateTelegramPlayer(message.from);
      const snapshot = await resolveTelegramSnapshot(message.from);
      const jobsCount = listJobsByCity(snapshot.user.city, getPlayerProfessionId(snapshot.user), snapshot.user.level).length;
      if (jobsCount <= 0) {
        await sendWithCurrentHubKeyboard(token, chatId, player.id, "В вашем городе нет вакансий.");
        return;
      }
      pendingActionByChatId.set(chatId, { type: "job_select" });
      rememberTelegramMenu(player.id, { menu: "jobs" });
      await sendMessage(token, chatId, formatJobsMenu(snapshot), { reply_markup: buildJobsInlineMarkup(snapshot) });
      return;
    }
    const player = await resolveOrCreateTelegramPlayer(message.from);
    if (!(await ensureCityHubAccess(token, chatId, player, message))) return;
    if (!(await ensureExclusiveActionAllowed(token, chatId, player.id, "job"))) {
      return;
    }
    const result = await runJobSelection(token, chatId, player, ref);
    if (!result.ok) {
      await sendWithCurrentHubKeyboard(token, chatId, player.id, `❌ ${result.message}\nОткрой вакансии ещё раз и выбери подходящую кнопку.`);
    }
    return;
  }

  if (await handleInventoryMessage({
    command,
    args,
    token,
    chatId,
    message,
    resolveTelegramSnapshot,
    ensureCityHubAccess,
    sendShopMenu,
    resolveShopSellRefFromChat,
    resolveOrCreateTelegramPlayer,
    sellInventoryItem,
    getCurrencySymbol,
    formatLiveProfile,
    formatNotices,
    sendWithCityHubKeyboard,
    extractErrorMessage,
    buyShopItem,
    resolveShopBuyRefFromChat,
    tryApplyTutorialEvent,
    updateWeeklyQuestProgress,
    formatStats,
    formatWeeklyQuestProgressNotice,
    formatTutorialAdvanceNotice,
    buildShopPurchaseInlineMarkup,
    buildInventoryMenu,
    inventoryRefsByChatId,
    sendMessage,
    buildInventoryInlineButtons,
    resolveInventoryRefFromChat,
    sendWithCurrentHubKeyboard,
    useInventoryItem,
    toggleGearItem,
    serviceGadgetItem,
    scrapBrokenGadgetItem,
  })) {
    return;
  }

  if (await handleCompanyNavigationMessage({
    command,
    token,
    chatId,
    message,
    resolveOrCreateTelegramPlayer,
    playerTravelByUserId,
    getTravelRemainingSeconds,
    formatTravelTargetLabel,
    sendWithMainKeyboard,
    ensureExclusiveActionAllowed,
    getPlayerHubLocation,
    forceReturnHome,
    setCompanyMenuSection,
    getHousingTravelDurationMs,
    travelToCompanyMs: TRAVEL_TO_COMPANY_MS,
    rememberTelegramMenu,
    getPlayerCompanyContext,
    sendCompanyProfile,
    storage,
    getTopCompanies,
    companyListByChatId,
    sendMessage,
    formatCompanyMenuWithoutMembership,
    buildCompanyRegistryInlineMarkup,
    buildCompanyReplyMarkup,
    setPlayerHubLocation,
    ensureCompanyHubAccess,
    sendWithCurrentHubKeyboard,
    formatHackathonMenu,
    formatSabotageMenu,
    hackathonSabotageTargetRefsByChatId,
    getCompanyMenuParentSection,
    getCompanyMenuSection,
    sendCompanyRootMenu,
    sendCompanyWorkSection,
    ensureCompanyProcessUnlocked,
    getCompanyMiningStatus,
    formatMiningPlansMenu,
    buildCompanyMiningInlineButtons,
    extractErrorMessage,
    sendCompanyWarehouseSection,
    sendCompanyBureauSection,
    sendCompanyManagementSection,
    formatCompanySalariesSection,
    sendCompanyEconomySection,
    sendCompanyDepartmentsSection,
    sendCompanyIpoSection,
    sendCompanyRequestsSection,
  })) {
    return;
  }

  if (await handleEconomyMessage({
    command,
    args,
    token,
    chatId,
    message,
    resolveTelegramSnapshot,
    ensureCityHubAccess,
    formatBankMenu,
    formatNotices,
    rememberTelegramMenu,
    sendWithBankKeyboard,
    resolveOrCreateTelegramPlayer,
    getStockMarketSnapshot,
    formatStocksMenu,
    formatStocksNewsMenu,
    sendMessage,
    buildStocksHomeReplyMarkup,
    buildStocksTickerReplyMarkup,
    buyStockAsset,
    tryApplyTutorialEvent,
    getCurrencySymbol,
    formatTutorialAdvanceNotice,
    sellStockAsset,
    formatGramExchangeMenu,
    pendingActionByChatId,
    parseDecimalInput,
    exchangeCurrencyToGram,
    formatGramValue,
    formatLiveProfile,
    exchangeGramToCurrency,
    extractErrorMessage,
  })) {
    return;
  }

  if (command === "/admin") {
    if (!isAdminEnabled()) {
      await sendWithMainKeyboard(token, chatId, "❌ Админ-режим отключён: ADMIN_PASSWORD не настроен.");
      return;
    }
    const password = args.join(" ").trim();
    if (!password) {
      pendingActionByChatId.set(chatId, { type: "admin_auth" });
      await sendWithMainKeyboard(token, chatId, "🔐 Введи пароль администратора.");
      return;
    }

    if (!ADMIN_PASSWORD || password !== ADMIN_PASSWORD) {
      await sendWithMainKeyboard(token, chatId, "❌ Неверный пароль администратора.");
      return;
    }

    adminAuthByChatId.set(chatId, true);
    await sendWithAdminKeyboard(
      token,
      chatId,
      [
        "🛠 Админ-режим включен.",
        "Команды: /admin_add_money <сумма>, /admin_add_exp <сумма>, /admin_reset_player, /admin_restart, /admin_hackathon_start, /admin_hackathon_end, /admin_hackathon_reset, /admin_global_event, /admin_logout",
      ].join("\n"),
    );
    return;
  }

  if (command === "/admin_add_money") {
    if (!adminAuthByChatId.get(chatId)) {
      await sendWithMainKeyboard(token, chatId, "❌ Доступ запрещен. Авторизуйся: /admin <пароль>");
      return;
    }
    const amountRaw = args.join(" ").trim();
    if (!amountRaw) {
      pendingActionByChatId.set(chatId, { type: "admin_add_money" });
      await sendWithAdminKeyboard(token, chatId, "Введите сумму для начисления.");
      return;
    }
    const player = await resolveOrCreateTelegramPlayer(message.from);
    const amount = Math.floor(Number(amountRaw));
    if (!Number.isFinite(amount) || amount <= 0) {
      await sendWithAdminKeyboard(token, chatId, "Введите корректную сумму > 0.");
      return;
    }
    const updated = await storage.updateUser(player.id, { balance: player.balance + amount });
    const refreshed = await getUserWithGameState(updated.id);
    await sendWithAdminKeyboard(
      token,
      chatId,
      refreshed
        ? `✅ РќР°С‡РёСЃР»РµРЅРѕ ${getCurrencySymbol(updated.city)}${amount}\n\n${await formatPlayerProfile(refreshed)}`
        : `✅ РќР°С‡РёСЃР»РµРЅРѕ ${getCurrencySymbol(updated.city)}${amount}`,
    );
    return;
  }

  if (command === "/admin_add_exp") {
    if (!adminAuthByChatId.get(chatId)) {
      await sendWithMainKeyboard(token, chatId, "❌ Доступ запрещен. Авторизуйся: /admin <пароль>");
      return;
    }
    const expRaw = args.join(" ").trim();
    if (!expRaw) {
      pendingActionByChatId.set(chatId, { type: "admin_add_exp" });
      await sendWithAdminKeyboard(token, chatId, "Введите количество опыта.");
      return;
    }
    const player = await resolveOrCreateTelegramPlayer(message.from);
    const gain = Math.floor(Number(expRaw));
    if (!Number.isFinite(gain) || gain <= 0) {
      await sendWithAdminKeyboard(token, chatId, "Введите корректное значение опыта > 0.");
      return;
    }
    const next = applyExperienceGain(player, gain);
    const updated = await storage.updateUser(player.id, {
      level: next.level,
      experience: next.experience,
    });
    const refreshed = await getUserWithGameState(updated.id);
    await sendWithAdminKeyboard(
      token,
      chatId,
      refreshed ? `✅ РќР°С‡РёСЃР»РµРЅРѕ ${gain} XP\n\n${await formatPlayerProfile(refreshed)}` : `✅ РќР°С‡РёСЃР»РµРЅРѕ ${gain} XP`,
    );
    return;
  }

  if (command === "/admin_reset_player" || command === "/admin_restart") {
    if (!adminAuthByChatId.get(chatId)) {
      await sendWithMainKeyboard(token, chatId, "❌ Доступ запрещен. Авторизуйся: /admin <пароль>");
      return;
    }

    const player = await resolveOrCreateTelegramPlayer(message.from);
    const tutorialCompany = await storage.getTutorialCompanyByOwner(player.id);
    if (tutorialCompany) {
      await storage.deleteCompany(tutorialCompany.id);
      companyEconomyByCompanyId.delete(String(tutorialCompany.id));
      companySalaryByCompanyId.delete(String(tutorialCompany.id));
      companySalaryClaimAtByCompanyId.delete(String(tutorialCompany.id));
    }

    const membership = await getPlayerCompanyContext(player.id);
    if (membership) {
      if (membership.role === "owner") {
        await storage.deleteCompany(membership.company.id);
        companyEconomyByCompanyId.delete(String(membership.company.id));
        companySalaryByCompanyId.delete(String(membership.company.id));
        companySalaryClaimAtByCompanyId.delete(String(membership.company.id));
      } else {
        await storage.removeCompanyMember(membership.company.id, player.id);
        const updatedCompany = await storage.getCompany(membership.company.id);
        if (updatedCompany) {
          const members = await storage.getCompanyMembers(updatedCompany.id);
          await ensureCompanyEconomyState(updatedCompany, members.length);
        }
      }
    }

    const ownReferralCode = referralCodeByUserId.get(player.id);
    if (ownReferralCode) {
      referralOwnerByCode.delete(ownReferralCode);
    }
    referralCodeByUserId.delete(player.id);

    const inviterId = referredByUserId.get(player.id);
    if (inviterId) {
      const inviterChildren = referralChildrenByUserId.get(inviterId);
      if (inviterChildren) {
        inviterChildren.delete(player.id);
        if (!inviterChildren.size) {
          referralChildrenByUserId.delete(inviterId);
        }
      }
    }
    referredByUserId.delete(player.id);

    const children = referralChildrenByUserId.get(player.id);
    if (children) {
      for (const childId of Array.from(children)) {
        referredByUserId.delete(childId);
      }
    }
    referralChildrenByUserId.delete(player.id);
    weeklyQuestStateByUserId.delete(player.id);

    clearPlayerGameState(player.id);
    unbindTelegramByUserId(player.id);
    if (message.from?.id) {
      unbindTelegramByTelegramId(String(message.from.id));
    }
    inventoryRefsByChatId.delete(chatId);
    companyMemberRefsByChatId.delete(chatId);
    stopCompanyBlueprintProgressTicker(chatId);
    companyBlueprintProgressMessageByChatId.delete(chatId);
    registrationDraftByChatId.delete(chatId);
    pendingActionByChatId.delete(chatId);
    await storage.deleteUser(player.id);

    await sendWithAdminKeyboard(
      token,
      chatId,
      [
        "✅ Полный сброс выполнен.",
        "Аккаунт игрока удалён полностью.",
        "Отправь /start и пройди регистрацию заново.",
      ].join("\n"),
    );
    return;
  }

  if (command === "/admin_hackathon_start" || command === "/admin_hackathon_end" || command === "/admin_hackathon_reset") {
    if (!adminAuthByChatId.get(chatId)) {
      await sendWithMainKeyboard(token, chatId, "❌ Доступ запрещен. Авторизуйся: /admin <пароль>");
      return;
    }

    try {
      const action = command === "/admin_hackathon_start"
        ? "start"
        : command === "/admin_hackathon_end"
          ? "end"
          : "reset";
      const snapshot = await callInternalAdminApi("POST", `/api/admin/events/hackathon/${action}`);
      const topLine = action === "start"
        ? "✅ Weekly Hackathon запущен."
        : action === "end"
          ? "✅ Weekly Hackathon завершён."
          : "✅ Weekly Hackathon сброшен.";
      const lines = [
        topLine,
        `Статус: ${String(snapshot?.status ?? "unknown")}`,
      ];
      if (snapshot?.registeredCompanies) {
        lines.push(`Компаний зарегистрировано: ${Number(snapshot.registeredCompanies)}`);
      }
      if (snapshot?.startedAt) {
        lines.push(`Старт: ${new Date(Number(snapshot.startedAt)).toLocaleString("ru-RU")}`);
      }
      if (snapshot?.endsAt) {
        lines.push(`Финиш: ${new Date(Number(snapshot.endsAt)).toLocaleString("ru-RU")}`);
      }
      await sendWithAdminKeyboard(token, chatId, lines.join("\n"));
    } catch (error) {
      await sendWithAdminKeyboard(token, chatId, `❌ ${extractErrorMessage(error)}`);
    }
    return;
  }

  if (command === "/admin_global_event") {
    if (!adminAuthByChatId.get(chatId)) {
      await sendWithMainKeyboard(token, chatId, "❌ Доступ запрещен. Авторизуйся: /admin <пароль>");
      return;
    }

    try {
      const event = await callInternalAdminApi("POST", "/api/admin/events/global/start");
      const lines = [
        "✅ Глобальное событие создано.",
        `Название: ${String(event?.title ?? "Без названия")}`,
        `Интенсивность: ${String(event?.intensity ?? "—")}`,
        event?.description ? `Описание: ${String(event.description)}` : "",
        event?.city ? `Город: ${String(event.city)}` : "",
        event?.target ? `Цель: ${String(event.target)}` : "",
      ].filter(Boolean);
      await sendWithAdminKeyboard(token, chatId, lines.join("\n"));
    } catch (error) {
      await sendWithAdminKeyboard(token, chatId, `❌ ${extractErrorMessage(error)}`);
    }
    return;
  }

  if (command === "/admin_logout") {
    adminAuthByChatId.delete(chatId);
    await sendWithMainKeyboard(token, chatId, "Админ-режим выключен.");
    return;
  }

  if (command === "/hackathon") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    setCompanyMenuSection(chatId, "hackathon_event");
    await sendWithCurrentHubKeyboard(token, chatId, player.id, await formatHackathonMenu(player));
    return;
  }

  if (command === "/events") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    await sendWithCurrentHubKeyboard(token, chatId, player.id, await formatGlobalEventsMenu(player));
    return;
  }

  if (command === "/pvp") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    await sendMessage(token, chatId, await formatPvpMenu(player), { reply_markup: PVP_MENU_REPLY_MARKUP });
    return;
  }

  if (command === "/pvp_find") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    if (!(await ensureExclusiveActionAllowed(token, chatId, player.id, "pvp"))) {
      return;
    }
    try {
      const join = await callInternalApi("POST", "/api/pvp/queue/join", { userId: player.id }) as any;
      await sendMessage(
        token,
        chatId,
        join?.activeDuel?.awaitingStart
          ? "⚔️ Матч найден. Перед стартом откроется окно boosts на 15 секунд."
          : "⚔️ Поиск соперника запущен. Когда матч найдётся, в этом чате появится короткая дуэль-разработка с живым прогрессом.",
        { reply_markup: PVP_MENU_REPLY_MARKUP },
      );
      startPvpQueuePolling(token, chatId, player.id);
    } catch (error) {
      await sendWithCurrentHubKeyboard(token, chatId, player.id, `❌ ${extractErrorMessage(error)}`);
    }
    return;
  }

  if (command === "/pvp_leave") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    try {
      await callInternalApi("POST", "/api/pvp/queue/leave", { userId: player.id });
      stopPvpQueuePolling(chatId);
      await sendMessage(token, chatId, "✅ Ты вышел из PvP очереди.", { reply_markup: PVP_MENU_REPLY_MARKUP });
    } catch (error) {
      await sendWithCurrentHubKeyboard(token, chatId, player.id, `❌ ${extractErrorMessage(error)}`);
    }
    return;
  }

  if (command === "/pvp_history") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    try {
      const rows = await callInternalApi("GET", `/api/pvp/history?userId=${encodeURIComponent(player.id)}&limit=5`) as any[];
      const lines = [
        "🧾 PvP история (последние 5):",
        ...(rows.length
          ? rows.map((row, idx) => {
            const isA = String(row.playerAId) === player.id;
            const opponent = isA ? row.playerBName : row.playerAName;
            const before = isA ? Number(row.playerARatingBefore || 0) : Number(row.playerBRatingBefore || 0);
            const after = isA ? Number(row.playerARatingAfter || 0) : Number(row.playerBRatingAfter || 0);
            const resultText = String(row.winnerUserId || "") === player.id ? "Победа" : "Поражение";
            return `${idx + 1}. ${resultText} vs ${opponent}\n   Рейтинг: ${before} → ${after}`;
          })
          : ["История пока пуста."]),
      ];
      await sendMessage(token, chatId, lines.join("\n"), { reply_markup: PVP_MENU_REPLY_MARKUP });
    } catch (error) {
      await sendWithCurrentHubKeyboard(token, chatId, player.id, `❌ ${extractErrorMessage(error)}`);
    }
    return;
  }

  if (command === "/hackathon_join") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    setCompanyMenuSection(chatId, "hackathon_event");
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership) {
      await sendWithCurrentHubKeyboard(token, chatId, player.id, "Ты не состоишь в компании. Открой /company.");
      return;
    }
    if (membership.role !== "owner") {
      await sendWithCurrentHubKeyboard(token, chatId, player.id, "Регистрировать компанию в хакатоне может только CEO.");
      return;
    }
    try {
      const company = await storage.getCompany(membership.company.id);
      if (!company) throw new Error("Компания не найдена");
      if (Number(company.balance || 0) < WEEKLY_HACKATHON_CONFIG.registrationCostGrm) {
        throw new Error(`Недостаточно GRM на балансе компании. Нужно ${WEEKLY_HACKATHON_CONFIG.registrationCostGrm}`);
      }
      await storage.updateCompany(company.id, {
        balance: Number(company.balance || 0) - WEEKLY_HACKATHON_CONFIG.registrationCostGrm,
      });
      const rndLevel = Math.max(0, Math.floor(Number(company.ork || 0) / 100));
      registerCompanyForWeeklyHackathon({
        companyId: company.id,
        companyName: company.name,
        city: company.city,
        companyLevel: company.level,
        rndLevel,
      });
      await sendWithCurrentHubKeyboard(token, chatId, player.id, "✅ Компания зарегистрирована в Weekly Hackathon.");
    } catch (error) {
      await sendWithCurrentHubKeyboard(token, chatId, player.id, `❌ ${extractErrorMessage(error)}`);
    }
    return;
  }

  if (command === "/hackathon_skill") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    setCompanyMenuSection(chatId, "hackathon_event");
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership) {
      await sendWithCurrentHubKeyboard(token, chatId, player.id, "Ты не состоишь в компании. Открой /company.");
      return;
    }
    try {
      const snapshot = await getUserWithGameState(player.id);
      if (!snapshot) throw new Error("Профиль игрока не найден");
      const game = snapshot.game as GameView;
      const workTime = Number(game.workTime || 0);
      if (workTime < WEEKLY_HACKATHON_CONFIG.skillEnergyCost) {
        throw new Error(`Недостаточно энергии. Нужно ${Math.round(WEEKLY_HACKATHON_CONFIG.skillEnergyCost * 100)}%.`);
      }
      await startHackathonSkillProgress(token, chatId, player, membership, game);
    } catch (error) {
      await sendWithCurrentHubKeyboard(token, chatId, player.id, `❌ ${extractErrorMessage(error)}`);
    }
    return;
  }

  if (command === "/hackathon_grm_menu") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    setCompanyMenuSection(chatId, "hackathon_event");
    await sendWithCurrentHubKeyboard(token, chatId, player.id, formatHackathonGrmMenu());
    return;
  }

  if (command === "/hackathon_grm") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    setCompanyMenuSection(chatId, "hackathon_event");
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership) {
      await sendWithCurrentHubKeyboard(token, chatId, player.id, "Ты не состоишь в компании. Открой /company.");
      return;
    }
    const amount = Math.floor(Number(args[0] || 0));
    if (!WEEKLY_HACKATHON_CONFIG.grmPackages.includes(amount)) {
      await sendWithCurrentHubKeyboard(token, chatId, player.id, "Использование: /hackathon_grm <100|500|1000>");
      return;
    }
    try {
      await spendGram(player.id, amount, `Weekly Hackathon вклад ${amount} GRM`);
      const result = contributeGrmToWeeklyHackathon({
        userId: player.id,
        companyId: membership.company.id,
        amount,
      });
      await sendWithCurrentHubKeyboard(
        token,
        chatId,
        player.id,
        `✅ GRM-вклад: ${amount}\n+${result.contribution.toFixed(2)} очков\nСчёт компании: ${result.score.toFixed(2)}`,
      );
    } catch (error) {
      await sendWithCurrentHubKeyboard(token, chatId, player.id, `❌ ${extractErrorMessage(error)}`);
    }
    return;
  }

  if (command === "/hackathon_part") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    setCompanyMenuSection(chatId, "hackathon_event");
    const snapshot = await getUserWithGameState(player.id);
    if (!snapshot) {
      await sendWithCurrentHubKeyboard(token, chatId, player.id, "Профиль игрока не найден.");
      return;
    }
    const parts = ((snapshot.game as GameView).inventory || []).filter((item) => item.type === "part");
    if (!parts.length) {
      await sendWithCurrentHubKeyboard(token, chatId, player.id, "В инвентаре нет деталей для хакатона.");
      return;
    }
    hackathonPartRefsByChatId.set(chatId, parts.map((item) => item.id));
    const text = [
      "🏁 Вклад деталей в Weekly Hackathon",
      ...parts.slice(0, 10).map((item, idx) => `${idx + 1}. ${item.name} x${Math.max(1, item.quantity || 1)}  /hpart${idx + 1}`),
      "",
      "Нажми /hpartN или /hackathon_part_apply <номер>",
    ].join("\n");
    await sendWithCurrentHubKeyboard(token, chatId, player.id, text);
    return;
  }

  if (command === "/hackathon_part_apply") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    setCompanyMenuSection(chatId, "hackathon_event");
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership) {
      await sendWithCurrentHubKeyboard(token, chatId, player.id, "Ты не состоишь в компании. Открой /company.");
      return;
    }
    const rawRef = String(args[0] || "");
    if (!rawRef) {
      await sendWithCurrentHubKeyboard(token, chatId, player.id, "Использование: /hackathon_part_apply <номер>");
      return;
    }
    const resolvedRef = resolveHackathonPartRefFromChat(chatId, rawRef);
    try {
      const snapshot = await getUserWithGameState(player.id);
      if (!snapshot) throw new Error("Профиль игрока не найден");
      const inventory = [...((snapshot.game as GameView).inventory || [])];
      const index = inventory.findIndex((item) => item.type === "part" && item.id === resolvedRef);
      if (index < 0) throw new Error("Деталь не найдена. Открой /hackathon_part");
      const partItem = inventory[index];
      const partDef = ALL_PARTS[partItem.id];
      if (!partDef) throw new Error("Справочник детали не найден");
      const mappedType = mapPartTypeToHackathonType(partDef.type);
      if (!mappedType) throw new Error("Эта деталь не участвует в хакатоне");
      const result = contributePartToWeeklyHackathon({
        userId: player.id,
        companyId: membership.company.id,
        partType: mappedType,
        rarity: partItem.rarity,
        quantity: 1,
      });

      const qty = Math.max(1, Math.floor(Number(partItem.quantity || 1)));
      if (qty <= 1) {
        inventory.splice(index, 1);
      } else {
        inventory[index] = { ...partItem, quantity: qty - 1 };
      }
      applyGameStatePatch(player.id, { inventory });
      await sendWithCurrentHubKeyboard(
        token,
        chatId,
        player.id,
        `✅ Деталь вложена: ${partItem.name}\n+${result.contribution.toFixed(2)} очков\nСчёт компании: ${result.score.toFixed(2)}`,
      );
    } catch (error) {
      await sendWithCurrentHubKeyboard(token, chatId, player.id, `❌ ${extractErrorMessage(error)}`);
    }
    return;
  }

  if (command === "/sabotage") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    setCompanyMenuSection(chatId, "hackathon_sabotage");
    const payload = await formatSabotageMenu(player);
    if (typeof payload === "string") {
      await sendWithCurrentHubKeyboard(token, chatId, player.id, payload);
      return;
    }
    hackathonSabotageTargetRefsByChatId.set(chatId, payload.refs);
    await sendWithCurrentHubKeyboard(token, chatId, player.id, payload.text);
    return;
  }

  if (command === "/sabotage_security") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    setCompanyMenuSection(chatId, "hackathon_sabotage");
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership) {
      await sendWithCurrentHubKeyboard(token, chatId, player.id, "Ты не состоишь в компании. Открой /company.");
      return;
    }
    if (membership.role !== "owner") {
      await sendWithCurrentHubKeyboard(token, chatId, player.id, "Изменять security level может только CEO.");
      return;
    }
    const level = Math.floor(Number(args[0] || 0));
    if (![1, 2, 3].includes(level)) {
      await sendWithCurrentHubKeyboard(token, chatId, player.id, "Использование: /sabotage_security <1|2|3>");
      return;
    }
    try {
      const updated = setHackathonCompanySecurityLevel(membership.company.id, level);
      await sendWithCurrentHubKeyboard(token, chatId, player.id, `✅ Security level обновлён: ${updated}`);
    } catch (error) {
      await sendWithCurrentHubKeyboard(token, chatId, player.id, `❌ ${extractErrorMessage(error)}`);
    }
    return;
  }

  if (command === "/sabotage_security_menu") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    setCompanyMenuSection(chatId, "hackathon_sabotage");
    await sendWithCurrentHubKeyboard(
      token,
      chatId,
      player.id,
      "🛡 SECURITY ХАКАТОНА\n━━━━━━━━━━━━━━\nВыбери уровень защиты командой:\n/sabotage_security 1\n/sabotage_security 2\n/sabotage_security 3",
    );
    return;
  }

  if (command === "/poach_menu") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    setCompanyMenuSection(chatId, "hackathon_sabotage");
    const offers = getPendingPoachOffersForUser(player.id);
    await sendWithCurrentHubKeyboard(
      token,
      chatId,
      player.id,
      offers.length
        ? [
            "📨 TALENT POACHING",
            "━━━━━━━━━━━━━━",
            ...offers.map((offer) => `${offer.id}: /poach_accept ${offer.id} | /poach_decline ${offer.id}`),
          ].join("\n")
        : "📨 Активных talent-poaching офферов нет.",
    );
    return;
  }

  if (command === "/sabotage_attack") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership) {
      await sendWithCurrentHubKeyboard(token, chatId, player.id, "Ты не состоишь в компании. Открой /company.");
      return;
    }
    const sabotageType = resolveHackathonSabotageType(String(args[0] || ""));
    const targetRef = String(args[1] || "");
    const targetUserId = args[2] ? String(args[2]) : undefined;
    if (!sabotageType || !targetRef) {
      await sendWithCurrentHubKeyboard(token, chatId, player.id, "Использование: /sabotage_attack <type> <targetCompanyId|номер> [targetUserId]");
      return;
    }
    const targetCompanyId = resolveHackathonSabotageTargetRef(chatId, targetRef);
    try {
      if (!["owner", "cto", "security_lead"].includes(String(membership.role || "").toLowerCase())) {
        throw new Error("Только CEO / CTO / Security Lead могут запускать саботаж");
      }
      const state = getWeeklyHackathonState();
      if (state.status !== "active") throw new Error("Саботаж доступен только при активном хакатоне");
      const attackerCompany = await storage.getCompany(membership.company.id);
      const targetCompany = await storage.getCompany(targetCompanyId);
      if (!attackerCompany || !targetCompany) throw new Error("Компания не найдена");
      const typeConfig = WEEKLY_HACKATHON_CONFIG.sabotage.types[sabotageType];
      const cost = Number(typeConfig.costGrm || 0);
      if (Number(attackerCompany.balance || 0) < cost) throw new Error(`Недостаточно GRM у компании. Нужно ${cost}`);
      await storage.updateCompany(attackerCompany.id, {
        balance: Number(attackerCompany.balance || 0) - cost,
      });

      const result = launchWeeklyHackathonSabotage({
        initiatorUserId: player.id,
        initiatorRole: membership.role,
        attackerCompanyId: attackerCompany.id,
        targetCompanyId: targetCompany.id,
        sabotageType,
        targetUserId,
      });
      await storage.createHackathonSabotageLog({
        id: result.logId,
        eventId: result.eventId,
        attackerCompanyId: result.attackerCompanyId,
        attackerCompanyName: result.attackerCompanyName,
        targetCompanyId: result.targetCompanyId,
        targetCompanyName: result.targetCompanyName,
        initiatorUserId: result.initiatorUserId,
        targetUserId: result.targetUserId,
        sabotageType: result.sabotageType,
        status: result.status,
        success: typeof result.success === "boolean" ? result.success : null,
        detected: result.detected,
        scoreDeltaAttacker: result.scoreDeltaAttacker,
        scoreDeltaTarget: result.scoreDeltaTarget,
        details: JSON.stringify(result.details || {}),
        createdAt: Math.floor(Date.now() / 1000),
        resolvedAt: result.status === "resolved" ? Math.floor(Date.now() / 1000) : null,
      });

      await sendWithCurrentHubKeyboard(
        token,
        chatId,
        player.id,
        [
          "✅ Саботаж выполнен",
          `Тип: ${result.sabotageType}`,
          `Цель: ${result.targetCompanyName}`,
          `Статус: ${result.status}`,
          `Успех: ${result.success === null ? "ожидает ответа" : result.success ? "да" : "нет"}`,
          `Δ attacker: ${result.scoreDeltaAttacker}`,
          `Δ target: ${result.scoreDeltaTarget}`,
          `Раскрыт: ${result.detected ? "да" : "нет"}`,
        ].join("\n"),
      );
    } catch (error) {
      await sendWithCurrentHubKeyboard(token, chatId, player.id, `❌ ${extractErrorMessage(error)}`);
    }
    return;
  }

  if (command === "/poach_accept" || command === "/poach_decline") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    const offerId = String(args[0] || "");
    if (!offerId) {
      await sendWithCurrentHubKeyboard(token, chatId, player.id, `Использование: ${command} <offerId>`);
      return;
    }
    try {
      const accepted = command === "/poach_accept";
      const result = resolveHackathonPoachOffer({
        offerId,
        userId: player.id,
        accept: accepted,
      });
      await storage.updateHackathonSabotageLog(offerId, {
        status: accepted ? "accepted" : "declined",
        success: accepted,
        scoreDeltaTarget: result.targetScoreDelta,
        resolvedAt: Math.floor(Date.now() / 1000),
      });
      await sendWithCurrentHubKeyboard(
        token,
        chatId,
        player.id,
        accepted
          ? `✅ Предложение принято. Компания-цель получила ${result.targetScoreDelta} score.`
          : "✅ Предложение отклонено.",
      );
    } catch (error) {
      await sendWithCurrentHubKeyboard(token, chatId, player.id, `❌ ${extractErrorMessage(error)}`);
    }
    return;
  }

  if (command === "/company_mining_start") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    if (!(await ensureCompanyHubAccess(token, chatId, player, message))) return;
    setCompanyMenuSection(chatId, "work");
    rememberTelegramMenu(player.id, { menu: "company", section: "work" });
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership) {
      await sendWithMainKeyboard(token, chatId, "Ты не состоишь в компании. Открой /company.");
      return;
    }
    if (!(await ensureCompanyProcessUnlocked(token, chatId, player.id, membership.company.id, "Добыча запчастей"))) {
      return;
    }

    const rawRef = String(args[0] || "").trim();
    const byIndex = Math.max(0, Number(rawRef) - 1);
    const plan = COMPANY_MINING_PLANS[byIndex] ?? getCompanyMiningPlan(rawRef);
    try {
      const started = await callInternalApi("POST", `/api/companies/${membership.company.id}/mining/start`, {
        userId: player.id,
        planId: plan.id,
      }) as CompanyMiningStatusView;
      if (started.status === "in_progress") {
        scheduleCompanyMiningReadyNotification(token, chatId, membership, player.id, started.remainingSeconds);
      }
      await sendMessage(token, chatId, `⛏ Запущена смена: ${plan.label}\nВремя: ~${started.remainingSeconds} сек.\nОжидаемая добыча: ${plan.minRewardQty}-${plan.maxRewardQty} запчастей`, {
        reply_markup: buildCompanyMiningInlineButtons(started),
      });
    } catch (error) {
      await sendMessage(token, chatId, `❌ ${extractErrorMessage(error)}`, {
        reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
      });
    }
    return;
  }

  if (command === "/company_mining_claim") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    if (!(await ensureCompanyHubAccess(token, chatId, player, message))) return;
    setCompanyMenuSection(chatId, "work");
    rememberTelegramMenu(player.id, { menu: "company", section: "work" });
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership) {
      await sendWithMainKeyboard(token, chatId, "Ты не состоишь в компании. Открой /company.");
      return;
    }
    if (!(await ensureCompanyProcessUnlocked(token, chatId, player.id, membership.company.id, "Забор добычи"))) {
      return;
    }

    try {
      const currentStatus = await getCompanyMiningStatus(membership.company.id, player.id);
      if (currentStatus.status !== "ready_to_claim" || !currentStatus.rewardPreview) {
        await sendMessage(token, chatId, formatMiningPlansMenu(currentStatus), {
          reply_markup: buildCompanyMiningInlineButtons(currentStatus),
        });
        return;
      }
      const warehouseCheck = await ensureCompanyWarehouseCanStoreMiningReward(
        membership.company,
        currentStatus.rewardPreview.quantity,
      );
      if (!warehouseCheck.ok) {
        await sendMessage(token, chatId, `⚠️ На складе нет места. Свободно слотов: ${warehouseCheck.free}.`, {
          reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
        });
        return;
      }
      const claimed = await claimCompanyMining(membership.company.id, player.id);
      addPartToCompanyWarehouse(membership.company.id, claimed.reward);
      await sendMessage(
        token,
        chatId,
        `✅ Добыча завершена: ${claimed.reward.partName} x${claimed.reward.quantity}\nРедкость: ${claimed.reward.rarity}\nДеталь перемещена на склад компании.`,
        { reply_markup: buildCompanyReplyMarkup(membership.role, chatId) },
      );
    } catch (error) {
      await sendMessage(token, chatId, `❌ ${extractErrorMessage(error)}`, {
        reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
      });
    }
    return;
  }

  if (command === "/company_auction_list") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership) {
      await sendWithMainKeyboard(token, chatId, "Ты не состоишь в компании. Открой /company.");
      return;
    }
    if (!["owner", "manager"].includes(String(membership.role || "").toLowerCase())) {
      await sendMessage(token, chatId, "Только руководящий состав может выставлять лоты компании на аукцион.");
      return;
    }
    const ref = String(args[0] || "").trim();
    const price = Number(args[1] || 0);
    const durationHours = Math.max(2, Math.min(12, Number(args[2] || 2)));
    if (!ref || !Number.isFinite(price) || price <= 0) {
      await sendMessage(token, chatId, "Использование: /company_auction_list <номер гаджета|pномер запчасти> <цена> [часы]");
      return;
    }
    try {
      const partRef = resolveWarehousePartRefFromChat(chatId, ref);
      const gadgetId = partRef ? undefined : resolveWarehouseGadgetRefFromChat(chatId, ref);
      await callInternalApi("POST", `/api/companies/${membership.company.id}/market/list`, {
        userId: player.id,
        gadgetId,
        partRef,
        price,
        mode: "auction",
        durationHours,
      });
      await sendMessage(token, chatId, "✅ Лот выставлен на аукцион.", {
        reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
      });
    } catch (error) {
      await sendMessage(token, chatId, `❌ ${extractErrorMessage(error)}`, {
        reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
      });
    }
    return;
  }

  if (command === "/company_part_deposit") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    if (!(await ensureCompanyHubAccess(token, chatId, player, message))) return;
    setCompanyMenuSection(chatId, "warehouse");
    rememberTelegramMenu(player.id, { menu: "company", section: "warehouse" });
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership) {
      await sendWithMainKeyboard(token, chatId, "Ты не состоишь в компании. Открой /company.");
      return;
    }

    const argsText = args.join(" ").trim();
    const snapshot = await resolveTelegramSnapshot(message.from);
    const game = snapshot.game as GameView;
    if (!argsText) {
      pendingActionByChatId.set(chatId, { type: "company_part_deposit" });
      await sendMessage(token, chatId, formatCompanyPartDepositList(game, chatId, true), {
        reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
      });
      return;
    }

    const [refRaw, qtyRaw] = argsText.split(/\s+/);
    const partRef = resolveCompanyPartDepositRefFromChat(chatId, refRaw);
    const inventory = [...(game.inventory ?? [])];
    const partItem = inventory.find((item) => item.type === "part" && item.id === partRef);
    if (!partItem) {
      await sendMessage(token, chatId, "❌ На склад компании можно добавлять только запчасти. Открой /company_part_deposit и выбери деталь из списка.");
      return;
    }

    const availableQty = Math.max(1, Number(partItem.quantity) || 1);
    const requestedQty = qtyRaw && qtyRaw.toLowerCase() !== "all"
      ? Math.floor(Number(qtyRaw))
      : availableQty;
    if (!Number.isFinite(requestedQty) || requestedQty <= 0) {
      await sendMessage(token, chatId, "❌ Неверное количество. Пример: /company_part_deposit 1 3");
      return;
    }
    const moveQty = Math.min(availableQty, requestedQty);

    const companySnapshot = await getCompanyBlueprintSnapshot(membership.company.id);
    const capacity = Math.max(0, Number(membership.company.warehouseCapacity) || 50);
    const used = getCompanyWarehouseUsedSlots(membership.company.id, companySnapshot.produced.length);
    const free = Math.max(0, capacity - used);
    if (moveQty > free) {
      await sendMessage(token, chatId, `❌ Склад заполнен, добавить невозможно. Свободно слотов: ${free}.`);
      return;
    }

    const nextInventory = inventory.flatMap((item) => {
      if (item.type !== "part" || item.id !== partItem.id) return [item];
      const left = availableQty - moveQty;
      if (left <= 0) return [];
      return [{ ...item, quantity: left }];
    });
    applyGameStatePatch(player.id, { inventory: nextInventory });

    const partDef = ALL_PARTS[partItem.id];
    const nextWarehouseParts = [...getCompanyWarehouseParts(membership.company.id)];
    const existingIndex = nextWarehouseParts.findIndex((item) => item.id === partItem.id);
    if (existingIndex >= 0) {
      nextWarehouseParts[existingIndex] = {
        ...nextWarehouseParts[existingIndex],
        quantity: Math.max(0, Number(nextWarehouseParts[existingIndex].quantity) || 0) + moveQty,
      };
    } else {
      nextWarehouseParts.push({
        id: partItem.id,
        name: partItem.name,
        type: partDef?.type ?? "unknown",
        rarity: normalizePartRarity(String(partItem.rarity || partDef?.rarity || "Common")),
        quantity: moveQty,
      });
    }
    setCompanyWarehouseParts(membership.company.id, nextWarehouseParts);
    pendingActionByChatId.delete(chatId);

    await sendMessage(token, chatId, `✅ На склад компании перенесено: ${partItem.name} x${moveQty}.`, {
      reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
    });
    await sendCompanyWarehouseSection(token, chatId, membership, player.id);
    return;
  }

  if (command === "/cpd") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership) {
      await sendWithMainKeyboard(token, chatId, "Ты не состоишь в компании. Открой /company.");
      return;
    }

    const refRaw = String(args[0] || "").trim();
    if (!refRaw) {
      await sendMessage(token, chatId, "Использование: /cpd1 (или /cpd2, /cpd3...)");
      return;
    }

    const snapshot = await getUserWithGameState(player.id);
    const game = (snapshot?.game as GameView | undefined);
    const parts = [...(game?.inventory ?? [])].filter((item) => item.type === "part");
    companyPartDepositRefsByChatId.set(chatId, parts.map((item) => item.id));
    const partRef = resolveCompanyPartDepositRefFromChat(chatId, refRaw);
    const partItem = parts.find((item) => item.id === partRef);
    if (!partItem) {
      await sendMessage(token, chatId, "❌ Запчасть не найдена. Открой список: /company_part_deposit");
      return;
    }

    const availableQty = Math.max(1, Number(partItem.quantity) || 1);
    if (availableQty <= 1) {
      const result = await transferCompanyPartToWarehouse(player.id, membership, partItem.id, "1");
      if (!result.ok) {
        await sendMessage(token, chatId, `❌ ${result.error}`);
        return;
      }
      await sendMessage(token, chatId, `✅ На склад компании перенесено: ${result.partName} x${result.moveQty}.`, {
        reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
      });
      await sendCompanyWarehouseSection(token, chatId, membership, player.id);
      return;
    }

    pendingActionByChatId.set(chatId, { type: "company_part_deposit_qty", partRef: partItem.id });
    await sendMessage(
      token,
      chatId,
      `🧮 Выбрано: ${partItem.name}\nВ наличии: ${availableQty}\n\nВведи количество для переноса (1-${availableQty}) или all.`,
      { reply_markup: buildCompanyReplyMarkup(membership.role, chatId) },
    );
    return;
  }

  if (command === "/company_staffing") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    if (!(await ensureCompanyHubAccess(token, chatId, player, message))) return;
    setCompanyMenuSection(chatId, "management_hr");
    rememberTelegramMenu(player.id, { menu: "company", section: "management_hr" });
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership || membership.role !== "owner") {
      await sendWithMainKeyboard(token, chatId, "Раздел доступен только CEO компании.");
      return;
    }
    await sendMessage(token, chatId, await formatCompanyStaffingSection(membership, chatId), {
      reply_markup: buildCompanyStaffingInlineMarkup(chatId, membership.role),
    });
    return;
  }

  if (command === "/company_assign_department") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    setCompanyMenuSection(chatId, "management_hr");
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership || membership.role !== "owner") {
      await sendWithMainKeyboard(token, chatId, "Раздел доступен только CEO компании.");
      return;
    }
    const memberRef = String(args[0] || "").trim();
    const departmentKey = resolveCompanyDepartmentKey(String(args[1] || ""));
    if (!memberRef || !departmentKey) {
      await sendMessage(token, chatId, await formatCompanyStaffingSection(membership, chatId), {
        reply_markup: buildCompanyStaffingInlineMarkup(chatId, membership.role),
      });
      return;
    }
    const memberRefs = companyMemberRefsByChatId.get(chatId) ?? [];
    const memberIndex = Math.max(0, Number(memberRef) - 1);
    const targetUserId = memberRefs[memberIndex] ?? memberRef;
    try {
      await callInternalApi("POST", `/api/companies/${membership.company.id}/staffing/assign`, {
        actorUserId: player.id,
        targetUserId,
        department: departmentKey,
      });
      await sendMessage(token, chatId, "✅ Сотрудник назначен в отдел.");
    } catch (error) {
      await sendMessage(token, chatId, `❌ ${extractErrorMessage(error)}`);
    }
    await sendMessage(token, chatId, await formatCompanyStaffingSection(membership, chatId), {
      reply_markup: buildCompanyStaffingInlineMarkup(chatId, membership.role),
    });
    return;
  }

  if (command === "/company_set_salary") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    setCompanyMenuSection(chatId, "management");
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership || membership.role !== "owner") {
      await sendWithMainKeyboard(token, chatId, "Команда доступна только CEO компании.");
      return;
    }

    const argsText = args.join(" ").trim();
    if (!argsText) {
      await sendMessage(token, chatId, await formatCompanySalariesSection(membership, chatId), {
        reply_markup: buildCompanySalariesInlineMarkup(membership, chatId),
      });
      return;
    }

    const [memberRef, amountRaw] = argsText.split(/\s+/);
    const amount = Math.floor(Number(amountRaw));
    if (!memberRef || !Number.isFinite(amount) || amount < 0) {
      await sendMessage(token, chatId, "Неверная сумма зарплаты. Выбери сотрудника кнопкой и введи число от 0 до 5000.", {
        reply_markup: buildCompanySalariesInlineMarkup(membership, chatId),
      });
      return;
    }
    if (amount > 5000) {
      await sendMessage(token, chatId, "Слишком большая зарплата. Максимум: 5000 GRM.", {
        reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
      });
      return;
    }

    const members = await storage.getCompanyMembers(membership.company.id);
    const target = resolveCompanyMemberRef(chatId, memberRef, members.map((member) => ({
      userId: member.userId,
      username: member.username,
    })));
    if (!target) {
      await sendMessage(token, chatId, "Сотрудник не найден. Открой /company_salaries и используй номер.", {
        reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
      });
      return;
    }

    const targetMember = members.find((member) => member.userId === target.userId);
    if (!targetMember) {
      await sendMessage(token, chatId, "Сотрудник не найден.", {
        reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
      });
      return;
    }

    setCompanyMemberSalary(String(membership.company.id), targetMember.userId, amount);
    await sendMessage(
      token,
      chatId,
      `✅ Зарплата назначена: ${targetMember.username} — ${amount} GRM.\nСотрудник получит её командой /company_salary_claim.`,
      { reply_markup: buildCompanyReplyMarkup(membership.role, chatId) },
    );
    await sendMessage(token, chatId, await formatCompanySalariesSection(membership, chatId), {
      reply_markup: buildCompanySalariesInlineMarkup(membership, chatId),
    });
    return;
  }

  if (command === "/company_salary_claim" || command === "/salary") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    setCompanyMenuSection(chatId, "management");
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership) {
      await sendWithMainKeyboard(token, chatId, "Ты не состоишь в компании. Открой /company.");
      return;
    }
    const latestCompany = await storage.getCompany(membership.company.id);
    if (!latestCompany) {
      await sendWithMainKeyboard(token, chatId, "Компания не найдена.");
      return;
    }
    const members = await storage.getCompanyMembers(latestCompany.id);
    const ownMember = members.find((member) => member.userId === player.id);
    if (!ownMember) {
      await sendWithMainKeyboard(token, chatId, "Ты больше не состоишь в компании.");
      return;
    }

    const salary = getCompanyMemberSalary(String(latestCompany.id), player.id, ownMember.role);
    if (salary <= 0) {
      await sendWithMainKeyboard(token, chatId, "Твоя зарплата в компании ещё не назначена.");
      return;
    }

    const claimMap = getCompanySalaryClaimMap(String(latestCompany.id));
    const now = Date.now();
    const lastClaimAt = Number(claimMap.get(player.id) ?? 0);
    const nextClaimAt = lastClaimAt + COMPANY_SALARY_CLAIM_COOLDOWN_MS;
    if (lastClaimAt > 0 && nextClaimAt > now) {
      const waitMs = nextClaimAt - now;
      await sendWithMainKeyboard(token, chatId, `РЎР»РµРґСѓСЋС‰Р°СЏ РІС‹РїР»Р°С‚Р° Р±СѓРґРµС‚ РґРѕСЃС‚СѓРїРЅР° С‡РµСЂРµР· ${formatDurationShort(waitMs)}.`);
      return;
    }

    const companyEconomy = await ensureCompanyEconomyState(latestCompany, members.length);
    if (companyEconomy.capitalGRM < salary) {
      await sendWithMainKeyboard(
        token,
        chatId,
        `В кассе компании недостаточно GRM для выплаты. Нужно ${salary} GRM, доступно ${formatNumber(companyEconomy.capitalGRM)} GRM.`,
      );
      return;
    }

    const updatedEconomy = await saveCompanyEconomyState(latestCompany, {
      ...companyEconomy,
      capitalGRM: companyEconomy.capitalGRM - salary,
      profitGRM: companyEconomy.profitGRM - salary,
    });
    const updatedUser = await storage.updateUser(player.id, {
      balance: player.balance + salary,
    });
    claimMap.set(player.id, now);

    const snapshot = await getUserWithGameState(updatedUser.id);
    const profile = snapshot
      ? await formatLiveProfile(snapshot.user, snapshot.game as GameView)
      : `Р‘Р°Р»Р°РЅСЃ: ${getCurrencySymbol(updatedUser.city)}${updatedUser.balance}`;

    await sendWithMainKeyboard(
      token,
      chatId,
      [
        `✅ Р—Р°СЂРїР»Р°С‚Р° РІС‹РїР»Р°С‡РµРЅР°: +${getCurrencySymbol(updatedUser.city)}${salary}`,
        `💼 Капитал компании: ${formatNumber(updatedEconomy.capitalGRM)} GRM`,
        "",
        profile,
      ].join("\n"),
    );
    return;
  }

  if (command === "/company_topup") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    if (!(await ensureCompanyHubAccess(token, chatId, player, message))) return;
    setCompanyMenuSection(chatId, "management");
    rememberTelegramMenu(player.id, { menu: "company", section: "management" });
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership) {
      await sendWithMainKeyboard(token, chatId, "Ты не состоишь в компании. Открой /company.");
      return;
    }

    const amountRaw = args.join(" ").trim();
    if (!amountRaw) {
      pendingActionByChatId.set(chatId, { type: "company_topup", companyId: String(membership.company.id) });
      const rate = getLocalToGRMRate(player.city);
      await sendWithMainKeyboard(
        token,
        chatId,
        [
          "💱 Пополнение компании в GRM",
          `Твой курс: 1 локальная единица = ${formatRate(rate)} GRM`,
          `Баланс игрока: ${getCurrencySymbol(player.city)}${player.balance}`,
          "Введи сумму в локальной валюте (например: 1000).",
        ].join("\n"),
      );
      return;
    }

    const amountLocal = parseDecimalInput(amountRaw);
    if (amountLocal === null) {
      await sendWithMainKeyboard(token, chatId, "Неверный формат. Введи сумму в локальной валюте, например: 1000.");
      return;
    }

    const companyEconomy = await ensureCompanyEconomyState(membership.company, membership.membersCount);
    const topUp = await applyCompanyTopUpFromPlayer(player, membership.company, companyEconomy, amountLocal);
    if (!topUp.ok) {
      await sendWithMainKeyboard(token, chatId, `❌ ${topUp.reason ?? "Пополнение недоступно"}`);
      return;
    }

    await sendMessage(
      token,
      chatId,
      [
        `✅ Компания пополнена: -${getCurrencySymbol(player.city)}${formatNumber(topUp.spentLocal)}, +${formatNumber(topUp.receivedGRM)} GRM`,
        `Личный баланс: ${getCurrencySymbol(player.city)}${topUp.playerBalanceAfter}`,
      ].join("\n"),
    );
    const refreshed = await getPlayerCompanyContext(player.id);
    if (refreshed) {
      await sendCompanyEconomySection(token, chatId, refreshed);
    }
    return;
  }

  if (command === "/company_department_upgrade") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership || membership.role !== "owner") {
      await sendWithMainKeyboard(token, chatId, "Команда доступна только CEO компании.");
      return;
    }

    const rawValue = args.join(" ").trim();
    const departmentRaw = /^\d+$/.test(rawValue)
      ? COMPANY_DEPARTMENT_ORDER[Math.max(0, Number(rawValue) - 1)] ?? null
      : resolveCompanyDepartmentKey(rawValue);
    if (!departmentRaw) {
      await sendCompanyDepartmentsSection(token, chatId, membership);
      return;
    }

    const companyEconomy = await ensureCompanyEconomyState(membership.company, membership.membersCount);
    const result = upgradeDepartment(companyEconomy, departmentRaw);
    if (!result.ok) {
      await sendWithMainKeyboard(token, chatId, `❌ ${result.reason ?? "Улучшение недоступно"}`);
      await sendCompanyDepartmentsSection(token, chatId, membership);
      return;
    }

    await saveCompanyEconomyState(membership.company, result.company);
    await sendMessage(
      token,
      chatId,
      `✅ Отдел ${DEPARTMENT_LABELS[departmentRaw]} улучшен до уровня ${result.company.departments[departmentRaw]} (-${formatNumber(result.spentGRM ?? 0)} GRM)`,
    );
    const refreshed = await getPlayerCompanyContext(player.id);
    if (refreshed) {
      await sendCompanyDepartmentsSection(token, chatId, refreshed);
    }
    return;
  }

  if (command === "/company_ipo_stub") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    setCompanyMenuSection(chatId, "management");
    await sendWithCurrentHubKeyboard(token, chatId, player.id, "🚀 IPO находится в разработке.");
    return;
  }

  if (command === "/company_ipo_run") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership || membership.role !== "owner") {
      await sendWithMainKeyboard(token, chatId, "Команда доступна только CEO компании.");
      return;
    }

    const companyEconomy = await ensureCompanyEconomyState(membership.company, membership.membersCount);
    const ipoResult = runIPO(companyEconomy);
    if (!ipoResult.ok) {
      await sendWithMainKeyboard(token, chatId, `❌ ${ipoResult.reason ?? "IPO РїРѕРєР° РЅРµРґРѕСЃС‚СѓРїРЅРѕ"}`);
      await sendCompanyIpoSection(token, chatId, membership);
      return;
    }

    await saveCompanyEconomyState(membership.company, ipoResult.company);
    await sendMessage(token, chatId, "✅ IPO успешно проведено. Компания получила публичный статус.");
    const refreshed = await getPlayerCompanyContext(player.id);
    if (refreshed) {
      await sendCompanyIpoSection(token, chatId, refreshed);
    }
    return;
  }

  if (command === "/company_contract_accept" || command === "/company_contract_deliver") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership) {
      await sendWithMainKeyboard(token, chatId, "Ты не состоишь в компании. Открой /company.");
      return;
    }
    if (!(await ensureCompanyProcessUnlocked(token, chatId, player.id, membership.company.id, "Контракты компании"))) {
      return;
    }

    const ref = args.join(" ").trim();
    if (!ref) {
      await sendMessage(token, chatId, `РСЃРїРѕР»СЊР·РѕРІР°РЅРёРµ: ${command} <РЅРѕРјРµСЂ РєРѕРЅС‚СЂР°РєС‚Р°>`);
      return;
    }

    const contracts = await getCityContracts(membership.company.city);
    const selected = resolveContractRef(chatId, ref, contracts);
    if (!selected) {
      await sendMessage(token, chatId, "Контракт не найден. Открой раздел «Работа» кнопкой ниже.");
      return;
    }

    const action = command === "/company_contract_accept" ? "accept" : "deliver";
    try {
      if (action === "deliver" && selected.kind === "parts_supply") {
        await startCompanyContractPartSelection(token, chatId, membership, player.id, selected);
        return;
      } else {
        if (action === "deliver") {
          await completeCompanyContractDelivery(token, chatId, membership, selected, player.id);
        } else {
          await callInternalApi("POST", `/api/city-contracts/${selected.id}/${action}`, {
            userId: player.id,
            companyId: membership.company.id,
          });
          await sendMessage(token, chatId, "✅ Контракт принят.");
        }
      }
    } catch (error) {
      await sendMessage(token, chatId, `❌ ${extractErrorMessage(error)}`);
    }

    await sendCompanyWorkSection(token, chatId, membership);
    return;
  }

  if (command === "/company_bp_start") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    if (!(await ensureExclusiveActionAllowed(token, chatId, player.id, "development"))) {
      return;
    }
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership || membership.role !== "owner") {
      await sendWithMainKeyboard(token, chatId, "Команда доступна только CEO компании.");
      return;
    }
    if (!(await ensureCompanyProcessUnlocked(token, chatId, player.id, membership.company.id, "Разработка базового чертежа"))) {
      return;
    }

    const ref = args.join(" ").trim();
    if (!ref) {
      await sendOrEditCompanyBureauSection(token, chatId, membership, player.id);
      return;
    }
    await startCompanyBlueprintDevelopment(token, chatId, membership, player, ref);
    return;
  }

  if (command === "/company_exclusive") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    setCompanyMenuSection(chatId, "bureau_exclusive");
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership) {
      await sendWithMainKeyboard(token, chatId, "Ты не состоишь в компании. Открой /company.");
      return;
    }
    await sendMessage(token, chatId, await formatCompanyExclusiveSection(membership, player.id, chatId), {
      reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
    });
    return;
  }

  if (command === "/company_exclusive_start") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    setCompanyMenuSection(chatId, "bureau_exclusive");
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership || membership.role !== "owner") {
      await sendWithMainKeyboard(token, chatId, "Команда доступна только CEO компании.");
      return;
    }
    if (!(await ensureExclusiveActionAllowed(token, chatId, player.id, "development"))) {
      return;
    }
    const raw = args.join(" ").trim();
    if (raw) {
      const gadgetName = normalizeExclusiveDraftName(raw.split("|")[0] || raw);
      companyExclusiveSelectedPartRefsByChatId.delete(chatId);
      companyExclusivePartPageByChatId.set(chatId, 0);
      pendingActionByChatId.set(chatId, { type: "company_exclusive_parts", gadgetName });
      await sendCompanyExclusivePartsPicker(token, chatId, membership, player.id, gadgetName);
      return;
    }
    pendingActionByChatId.set(chatId, { type: "company_exclusive_name" });
    await sendMessage(token, chatId, "🪄 Введи название будущего редкого гаджета.", {
      reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
    });
    return;
  }

  if (command === "/company_exclusive_progress") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    setCompanyMenuSection(chatId, "bureau_exclusive");
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership) {
      await sendWithMainKeyboard(token, chatId, "Ты не состоишь в компании. Открой /company.");
      return;
    }
    try {
      const snapshot = await getCompanyExclusiveSnapshot(membership.company.id);
      if (!snapshot.active) {
        await sendMessage(token, chatId, "Активной редкой разработки сейчас нет.", {
          reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
        });
        return;
      }
      if (snapshot.active.status === "in_progress") {
        const progressed = await callInternalApi("POST", `/api/companies/${membership.company.id}/exclusive/progress`, {
          userId: player.id,
        }) as any;
        const prefix = progressed.status === "production_ready"
          ? "✅ Исследование завершено. Чертёж готов к выпуску."
          : progressed.status === "failed"
          ? `❌ Исследование провалено: ${progressed.failedReason || "нестабильный прототип"}`
          : "📈 Навыки CEO вложены в исследование эксклюзивного гаджета.";
        await sendMessage(token, chatId, `${prefix}\n\n${formatExclusiveProgressLiveText(progressed)}`, {
          reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
        });
        if (progressed.status === "production_ready") {
          const users = await storage.getUsers();
          const announcement = [
            "🌟 НОВЫЙ ЭКСКЛЮЗИВНЫЙ ГАДЖЕТ",
            "━━━━━━━━━━━━━━",
            `Компания ${membership.company.name} разработала эксклюзивный гаджет "${progressed.blueprint?.name ?? "прототип"}".`,
            progressed.blueprint ? formatExclusiveBlueprintSummary(progressed.blueprint) : "",
          ].filter(Boolean).join("\n");
          for (const user of users) {
            const telegramId = Number(getTelegramIdByUserId(user.id) || 0);
            if (!telegramId) continue;
            try {
              await sendMessage(token, telegramId, announcement);
            } catch {
              // ignore per-user delivery issues
            }
          }
        }
        if (progressed.status !== "in_progress") {
          await sendMessage(token, chatId, await formatCompanyExclusiveSection(membership, player.id, chatId), {
            reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
          });
        }
        return;
      }
      await sendMessage(token, chatId, formatExclusiveProgressLiveText(snapshot.active), {
        reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
      });
    } catch (error) {
      await sendMessage(token, chatId, `❌ ${extractErrorMessage(error)}`);
    }
    return;
  }

  if (command === "/company_exclusive_produce") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    setCompanyMenuSection(chatId, "bureau_exclusive");
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership || membership.role !== "owner") {
      await sendWithMainKeyboard(token, chatId, "Команда доступна только CEO компании.");
      return;
    }
    const snapshot = await getCompanyExclusiveSnapshot(membership.company.id);
    if (snapshot.productionOrder?.isExclusive) {
      if (snapshot.productionOrder.status === "ready_to_claim") {
        try {
          const claimed = await callInternalApi("POST", `/api/companies/${membership.company.id}/production/claim`, {
            userId: player.id,
          }) as any;
          await sendMessage(
            token,
            chatId,
            [
              `✅ Партия выдана: ${snapshot.productionOrder.blueprintName} x${claimed.produced?.length || snapshot.productionOrder.quantity}`,
              claimed.bonusApplied?.financeGrm ? `Финансы: +${claimed.bonusApplied.financeGrm} GRM` : "",
              claimed.bonusApplied?.xp ? `XP: +${claimed.bonusApplied.xp}` : "",
              claimed.bonusApplied?.skill ? `Навык ${claimed.bonusApplied.skill}: +${claimed.bonusApplied.amount}` : "",
              claimed.gadgetWear?.summary ? String(claimed.gadgetWear.summary) : "",
            ].filter(Boolean).join("\n"),
            { reply_markup: buildCompanyReplyMarkup(membership.role, chatId) },
          );
        } catch (error) {
          await sendMessage(token, chatId, `❌ ${extractErrorMessage(error)}`, {
            reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
          });
        }
        return;
      }

      await sendMessage(
        token,
        chatId,
        `🏭 Уже идет выпуск: ${snapshot.productionOrder.blueprintName} x${snapshot.productionOrder.quantity}\nОсталось: ${formatProductionOrderRemaining(snapshot.productionOrder)}`,
        { reply_markup: buildCompanyReplyMarkup(membership.role, chatId) },
      );
      return;
    }
    const ref = String(args[0] || "").trim();
    if (!ref) {
      pendingActionByChatId.set(chatId, { type: "company_exclusive_produce_select" });
      await sendMessage(token, chatId, formatExclusiveProduceMenu(snapshot), {
        reply_markup: buildCompanyExclusiveProduceInlineMarkup(snapshot, membership.role, chatId),
      });
      return;
    }
    const quantity = args[1] ? Math.max(1, Math.min(5, Number(args[1] || 1))) : null;
    const index = Math.max(0, Number(ref) - 1);
    const target = snapshot.catalog?.[index];
    if (!target) {
      await sendMessage(token, chatId, "Чертёж не найден. Открой «Выпуск» ещё раз.", {
        reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
      });
      return;
    }
    if (quantity === null) {
      pendingActionByChatId.set(chatId, {
        type: "company_exclusive_produce_qty",
        blueprintId: target.id,
        blueprintName: target.name,
      });
      await sendMessage(token, chatId, `🏭 ${target.name}\nВведи количество для выпуска (1-${Math.max(1, target.remainingUnits)}).`, {
        reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
      });
      return;
    }
    pendingActionByChatId.set(chatId, {
      type: "company_exclusive_produce_qty",
      blueprintId: target.id,
      blueprintName: target.name,
    });
    if (await tryHandlePendingAction(token, chatId, String(quantity), { ...message, text: String(quantity) })) return;
    return;
  }

  if (command === "/company_bp_progress") {
    await sendWithMainKeyboard(token, chatId, "⛔ Ускорение разработки (+24ч) отключено.");
    return;
  }

  if (command === "/company_bp_produce") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    setCompanyMenuSection(chatId, "bureau");
    if (!(await ensureExclusiveActionAllowed(token, chatId, player.id, "development"))) {
      return;
    }
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership || membership.role !== "owner") {
      await sendWithMainKeyboard(token, chatId, "Команда доступна только CEO компании.");
      return;
    }
    if (!(await ensureCompanyProcessUnlocked(token, chatId, player.id, membership.company.id, "Производство гаджетов"))) {
      return;
    }

    try {
      const blueprintSnapshot = await getCompanyBlueprintSnapshot(membership.company.id);
      const productionOrder = blueprintSnapshot.productionOrder;
      if (productionOrder) {
        if (productionOrder.status === "ready_to_claim") {
          const claimed = await callInternalApi("POST", `/api/companies/${membership.company.id}/production/claim`, {
            userId: player.id,
          }) as any;
          await sendMessage(
            token,
            chatId,
            [
              `✅ Партия выдана: ${productionOrder.blueprintName} x${claimed.produced?.length || productionOrder.quantity}`,
              productionOrder.isExclusive && claimed.bonusApplied?.financeGrm ? `Финансы: +${claimed.bonusApplied.financeGrm} GRM` : "",
              productionOrder.isExclusive && claimed.bonusApplied?.xp ? `XP: +${claimed.bonusApplied.xp}` : "",
              productionOrder.isExclusive && claimed.bonusApplied?.skill ? `Навык ${claimed.bonusApplied.skill}: +${claimed.bonusApplied.amount}` : "",
              claimed.gadgetWear?.summary ? String(claimed.gadgetWear.summary) : "",
            ].filter(Boolean).join("\n"),
          );
          await sendCompanyWarehouseSection(token, chatId, membership, player.id);
          return;
        }

        await sendMessage(
          token,
          chatId,
          `🏭 Уже идет производство: ${productionOrder.blueprintName} x${productionOrder.quantity}\nОсталось: ${formatProductionOrderRemaining(productionOrder)}`,
          { reply_markup: buildCompanyReplyMarkup(membership.role, chatId) },
        );
        return;
      }
      const active = blueprintSnapshot.active;
      if (!active || active.status !== "production_ready") {
        await sendMessage(token, chatId, "❌ Чертеж еще не готов к производству. Дождитесь завершения разработки.");
        return;
      }
      if (active.blueprintId) {
        storeCompanyBlueprint(membership.company.id, active.blueprintId);
      }

      const blueprint = blueprintSnapshot.available.find((item) => item.id === active.blueprintId);
      if (!blueprint) {
        await sendMessage(token, chatId, "❌ Активный чертеж не найден.");
        return;
      }

      const companyEconomy = await ensureCompanyEconomyState(membership.company, membership.membersCount);
      const departmentEffects = getDepartmentEffects(companyEconomy.departments);

      const warehouseParts = [...getCompanyWarehouseParts(membership.company.id)];
      const requiredParts = blueprint.production?.parts ?? {};
      const maxByParts = Object.entries(requiredParts).reduce((limit, [partType, qtyRaw]) => {
        const perUnit = Math.max(1, Number(qtyRaw || 0));
        const available = warehouseParts
          .filter((item) => item.type === partType)
          .reduce((sum, item) => sum + Math.max(1, Number(item.quantity || 1)), 0);
        return Math.min(limit, Math.floor(available / perUnit));
      }, 10);

      const maxQuantity = Math.max(1, Math.min(10, Number.isFinite(maxByParts) ? maxByParts : 1));
      pendingActionByChatId.set(chatId, {
        type: "company_bp_produce_qty",
        blueprintId: blueprint.id,
        blueprintName: blueprint.name,
        maxQuantity,
      });
      await sendMessage(
        token,
        chatId,
        [
          `🏭 ${blueprint.name}`,
          `Доступно для партии: до ${maxQuantity} шт.`,
          `Себестоимость за 1 шт: ${formatNumber(Math.max(1, Math.round(Number(blueprint.production?.costGram || 0) * departmentEffects.productionCostMultiplier)))} GRM`,
          "Введи количество для запуска производства.",
        ].join("\n"),
        { reply_markup: buildCompanyReplyMarkup(membership.role, chatId) },
      );
      return;
    } catch (error) {
      await sendMessage(token, chatId, `❌ ${extractErrorMessage(error)}`);
    }
    return;
  }

  if (command === "/company_upgrade") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    setCompanyMenuSection(chatId, "management_departments");
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership || membership.role !== "owner") {
      await sendWithMainKeyboard(token, chatId, "Команда доступна только CEO компании.");
      return;
    }

    try {
      await callInternalApi("POST", `/api/company/${membership.company.id}/upgrade`, {});
      const refreshed = await getPlayerCompanyContext(player.id);
      if (refreshed) {
        await sendMessage(token, chatId, "✅ Legacy-апгрейд компании выполнен.", {
          reply_markup: buildCompanyReplyMarkup(refreshed.role, chatId),
        });
        await sendCompanyDepartmentsSection(token, chatId, refreshed);
      } else {
        await sendMessage(token, chatId, "✅ Уровень компании повышен.");
      }
    } catch (error) {
      await sendMessage(token, chatId, `❌ ${extractErrorMessage(error)}`);
    }
    return;
  }

  if (command === "/company_expand" || command === "/company_expand_warehouse") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    setCompanyMenuSection(chatId, "management_departments");
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership || membership.role !== "owner") {
      await sendWithMainKeyboard(token, chatId, "Команда доступна только CEO компании.");
      return;
    }

    try {
      await callInternalApi("POST", `/api/company/${membership.company.id}/expand-warehouse`, {});
      const refreshed = await getPlayerCompanyContext(player.id);
      if (refreshed) {
        await sendMessage(token, chatId, "✅ Склад компании расширен.", {
          reply_markup: buildCompanyReplyMarkup(refreshed.role, chatId),
        });
        await sendCompanyDepartmentsSection(token, chatId, refreshed);
      } else {
        await sendMessage(token, chatId, "✅ Склад компании расширен.");
      }
    } catch (error) {
      await sendMessage(token, chatId, `❌ ${extractErrorMessage(error)}`);
    }
    return;
  }

  if (command === "/company_create") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    const companyCreateCost = getCompanyCreateCostForPlayer(player.city);
    const membership = await getPlayerCompanyContext(player.id);
    if (membership) {
      await sendMessage(token, chatId, "Ты уже состоишь в компании. Используй /company.", {
        reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
      });
      return;
    }

    const companyName = args.join(" ").trim();
    if (!companyName) {
      pendingActionByChatId.set(chatId, { type: "company_create" });
      await sendMessage(
        token,
        chatId,
        `Введи название новой компании (3-40 символов).\nПосле этого бот попросит один эмоджи.\nСтоимость: ${getCurrencySymbol(player.city)}${companyCreateCost}`,
        { reply_markup: buildCompanyReplyMarkup(null) },
      );
      return;
    }

    const normalizedCompanyName = normalizeTelegramCompanyName(companyName);
    if (normalizedCompanyName.length < 3 || normalizedCompanyName.length > 40) {
      await sendWithMainKeyboard(token, chatId, "Название компании должно быть длиной от 3 до 40 символов.");
      return;
    }

    if (player.balance < companyCreateCost) {
      await sendWithMainKeyboard(
        token,
        chatId,
        `Недостаточно средств для создания компании. Нужно ${getCurrencySymbol(player.city)}${companyCreateCost}.`,
      );
      return;
    }

    pendingActionByChatId.set(chatId, { type: "company_create", companyName: normalizedCompanyName });
    await sendMessage(
      token,
      chatId,
      "Теперь отправь один эмоджи для компании. Пример: 🚀 или 🏢",
      { reply_markup: buildCompanyReplyMarkup(null) },
    );
    return;
  }

  if (command === "/company_join") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    const membership = await getPlayerCompanyContext(player.id);
    if (membership) {
      await sendMessage(token, chatId, "Ты уже состоишь в компании. Сначала выйди из текущей: /company_leave", {
        reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
      });
      return;
    }

    const ref = args.join(" ").trim();
    if (!ref) {
      const companies = (await storage.getAllCompanies()).filter((company) => !company.isTutorial);
      companyListByChatId.set(chatId, getTopCompanies(companies).map((company) => company.id));
      await sendMessage(token, chatId, "Выбери компанию для вступления:", {
        reply_markup: buildCompanyRegistryInlineMarkup(companies),
      });
      return;
    }

    const companies = (await storage.getAllCompanies()).filter((company) => !company.isTutorial);
    let selectedCompany = null as any;

    if (/^\\d+$/.test(ref)) {
      const list = companyListByChatId.get(chatId) ?? [];
      const index = Number(ref) - 1;
      const companyId = index >= 0 && index < list.length ? list[index] : "";
      selectedCompany = companies.find((company) => company.id === companyId) ?? null;
    } else {
      selectedCompany = companies.find((company) => company.id === ref)
        ?? companies.find((company) => company.id.startsWith(ref))
        ?? companies.find((company) => company.name.toLowerCase() === ref.toLowerCase())
        ?? null;
    }

    if (!selectedCompany) {
      await sendMessage(token, chatId, "Компания не найдена. Открой /company и выбери номер.", {
        reply_markup: buildCompanyReplyMarkup(null),
      });
      return;
    }

    const pendingRequests = await storage.getJoinRequestsByUser(player.id);
    const existsPending = pendingRequests.some(
      (request) => request.companyId === selectedCompany.id && request.status === "pending",
    );
    if (existsPending) {
      await sendMessage(token, chatId, "Заявка уже отправлена и ожидает решения.", {
        reply_markup: buildCompanyReplyMarkup(null),
      });
      return;
    }

    await storage.createJoinRequest({
      companyId: selectedCompany.id,
      userId: player.id,
      username: player.username,
    });
    await sendMessage(token, chatId, `✅ Заявка отправлена в компанию "${selectedCompany.name}".`, {
      reply_markup: buildCompanyReplyMarkup(null),
    });
    return;
  }

  if (command === "/company_leave") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership) {
      await sendWithMainKeyboard(token, chatId, "Ты не состоишь в компании.");
      return;
    }

    if (membership.role === "owner") {
      await sendMessage(token, chatId, "CEO не может выйти из своей компании. Используй /company_delete.", {
        reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
      });
      return;
    }

    await storage.removeCompanyMember(membership.company.id, player.id);
    const updatedCompany = await storage.getCompany(membership.company.id);
    if (updatedCompany) {
      const members = await storage.getCompanyMembers(updatedCompany.id);
      await ensureCompanyEconomyState(updatedCompany, members.length);
    }
    stopCompanyBlueprintProgressTicker(chatId);
    companyBlueprintProgressMessageByChatId.delete(chatId);
    await sendMessage(token, chatId, `✅ Ты вышел из компании "${membership.company.name}".`, {
      reply_markup: buildCompanyReplyMarkup(null),
    });
    return;
  }

  if (command === "/company_accept" || command === "/company_decline") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    if (!(await ensureCompanyHubAccess(token, chatId, player, message))) return;
    setCompanyMenuSection(chatId, "management_hr");
    rememberTelegramMenu(player.id, { menu: "company", section: "management_hr" });
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership || membership.role !== "owner") {
      await sendWithMainKeyboard(token, chatId, "Команда доступна только CEO компании.");
      return;
    }

    const ref = args.join(" ").trim();
    if (!ref) {
      await sendMessage(token, chatId, `Использование: ${command} <номер>. Список: /company_requests`, {
        reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
      });
      return;
    }

    const requests = await storage.getJoinRequestsByCompany(membership.company.id);
    let request = null as any;

    if (/^\\d+$/.test(ref)) {
      const ids = companyRequestsByChatId.get(chatId) ?? [];
      const index = Number(ref) - 1;
      const requestId = index >= 0 && index < ids.length ? ids[index] : "";
      request = requests.find((item) => item.id === requestId) ?? null;
    } else {
      request = requests.find((item) => item.id === ref)
        ?? requests.find((item) => item.id.startsWith(ref))
        ?? null;
    }

    if (!request) {
      await sendMessage(token, chatId, "Заявка не найдена. Открой /company_requests.", {
        reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
      });
      return;
    }

    const nextStatus = command === "/company_accept" ? "accepted" : "rejected";
    await storage.updateJoinRequestStatus(request.id, nextStatus);

    if (nextStatus === "accepted") {
      const existingMember = await storage.getMemberByUserId(membership.company.id, request.userId);
      if (!existingMember) {
        const currentMembers = await storage.getCompanyMembers(membership.company.id);
        const companyEconomy = await ensureCompanyEconomyState(membership.company, currentMembers.length);
        if (currentMembers.length >= companyEconomy.employeeLimit) {
          await sendMessage(
            token,
            chatId,
            `❌ Лимит сотрудников достигнут (${currentMembers.length}/${companyEconomy.employeeLimit}). Улучши профильный отдел и расширь компанию.`,
            { reply_markup: buildCompanyReplyMarkup(membership.role, chatId) },
          );
          return;
        }

        await storage.addCompanyMember({
          companyId: membership.company.id,
          userId: request.userId,
          username: request.username,
          role: "member",
        });

        const updatedMembers = await storage.getCompanyMembers(membership.company.id);
        await ensureCompanyEconomyState(membership.company, updatedMembers.length);
      }
      await sendMessage(token, chatId, `✅ Заявка ${request.username} одобрена.`, {
        reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
      });
      await sendCompanyRequestsSection(token, chatId, membership);
      return;
    }

    await sendMessage(token, chatId, `✅ Заявка ${request.username} отклонена.`, {
      reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
    });
    await sendCompanyRequestsSection(token, chatId, membership);
    return;
  }

  if (command === "/company_delete") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership || membership.role !== "owner") {
      await sendWithMainKeyboard(token, chatId, "Команда доступна только CEO компании.");
      return;
    }

    await storage.deleteCompany(membership.company.id);
    companyEconomyByCompanyId.delete(String(membership.company.id));
    companySalaryByCompanyId.delete(String(membership.company.id));
    companySalaryClaimAtByCompanyId.delete(String(membership.company.id));
    stopCompanyBlueprintProgressTicker(chatId);
    companyBlueprintProgressMessageByChatId.delete(chatId);
    await sendMessage(token, chatId, `🗑 Компания "${membership.company.name}" удалена.`, {
      reply_markup: buildCompanyReplyMarkup(null),
    });
    return;
  }

  if (command === "/credits") {
    const snapshot = await resolveTelegramSnapshot(message.from);
    if (!(await ensureCityHubAccess(token, chatId, snapshot.user, message))) return;
    rememberTelegramMenu(snapshot.user.id, { menu: "bank" });
    pendingActionByChatId.delete(chatId);
    await sendWithBankKeyboard(token, chatId, "🚧 Кредиты пока временно недоступны в городе.\n\nОстаются доступны: обмен GRM, биржа и банковый обзор.");
    return;
  }

  if (command === "/deposits") {
    const snapshot = await resolveTelegramSnapshot(message.from);
    if (!(await ensureCityHubAccess(token, chatId, snapshot.user, message))) return;
    rememberTelegramMenu(snapshot.user.id, { menu: "bank" });
    pendingActionByChatId.delete(chatId);
    await sendWithBankKeyboard(token, chatId, "🚧 Вклады пока временно недоступны в городе.\n\nОстаются доступны: обмен GRM, биржа и банковый обзор.");
    return;
  }

  if (command === "/credit" || command === "/deposit") {
    const parsed = parseBankOpenInput(args.join(" "));
    if (!parsed) {
      await sendWithBankKeyboard(token, chatId, `РСЃРїРѕР»СЊР·РѕРІР°РЅРёРµ: ${command} <РЅРѕРјРµСЂ РїСЂРѕРіСЂР°РјРјС‹> <СЃСѓРјРјР°> <РґРЅРё>\nРџСЂРёРјРµСЂ: ${command} 1 10000 14`);
      return;
    }
    const player = await resolveOrCreateTelegramPlayer(message.from);
    if (!(await ensureCityHubAccess(token, chatId, player, message))) return;
    const type: BankProductType = command === "/credit" ? "credit" : "deposit";
    try {
      const result = await openBankProduct(player.id, type, parsed.programRef, parsed.amount, parsed.days);
      await sendWithBankKeyboard(token, chatId, [type === "credit" ? `✅ РљСЂРµРґРёС‚ РѕС„РѕСЂРјР»РµРЅ: ${result.program.name}` : `✅ Р’РєР»Р°Рґ РѕС‚РєСЂС‹С‚: ${result.program.name}`, ...result.notices, "", await formatLiveProfile(result.user, result.state as GameView)].join("\n"));
    } catch (error) {
      await sendWithBankKeyboard(token, chatId, `❌ ${extractErrorMessage(error)}`);
    }
    return;
  }

  if (command === "/repay" || command === "/withdraw") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    if (!(await ensureCityHubAccess(token, chatId, player, message))) return;
    const action = command === "/repay" ? "repay" : "withdraw";
    try {
      const result = await closeBankProduct(player.id, action);
      const symbol = getCurrencySymbol(result.user.city);
      await sendWithBankKeyboard(token, chatId, [action === "repay" ? `✅ РљСЂРµРґРёС‚ РїРѕРіР°С€РµРЅ: -${symbol}${Math.round(result.amount)}` : `✅ Р’РєР»Р°Рґ СЃРЅСЏС‚: +${symbol}${Math.round(result.amount)}`, ...result.notices, "", await formatLiveProfile(result.user, result.state as GameView)].join("\n"));
    } catch (error) {
      await sendWithBankKeyboard(token, chatId, `❌ ${extractErrorMessage(error)}`);
    }
    return;
  }

  if (command === "/city") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    const nextCity = args.join(" ").trim();
    if (!nextCity) {
      pendingActionByChatId.set(chatId, { type: "change_city" });
      await sendMessage(token, chatId, `Выбери город:\n1) Сан-Франциско\n\n${CITY_CAPACITY_MESSAGE}`, { reply_markup: CITY_REPLY_MARKUP });
      return;
    }
    const resolvedCity = resolveCityName(nextCity);
    if (!resolvedCity) {
      pendingActionByChatId.set(chatId, { type: "change_city" });
      await sendMessage(token, chatId, "Не понял город. Выбери из списка:\n1) Сан-Франциско", { reply_markup: CITY_REPLY_MARKUP });
      return;
    }
    if (!isCityTemporarilyAvailable(resolvedCity)) {
      pendingActionByChatId.set(chatId, { type: "change_city" });
      await sendMessage(token, chatId, CITY_CAPACITY_MESSAGE, { reply_markup: CITY_REPLY_MARKUP });
      return;
    }
    await storage.updateUser(player.id, { city: resolvedCity });
    pendingActionByChatId.delete(chatId);
    const snapshot = await resolveTelegramSnapshot(message.from);
    const profileText = await formatPlayerProfile(snapshot);
    const base = `🏙 Город обновлён: ${snapshot.user.city}\n\n${profileText}`;
    const notices = formatNotices(snapshot.notices);
    await sendWithMainKeyboard(token, chatId, notices ? `${base}\n\n${notices}` : base);
    return;
  }

  await sendWithMainKeyboard(token, chatId, "Неизвестная команда. Напиши /help");
}

export function startTelegramBot(httpServer: Server) {
  if (!ADMIN_PASSWORD) {
    warnIfAdminPasswordMissing();
  }
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log("ℹ️ TELEGRAM_BOT_TOKEN не задан — Telegram бот не запущен");
    return;
  }

  const webAppUrl = trimTrailingSlash(process.env.TELEGRAM_WEBAPP_URL || process.env.APP_URL || "http://localhost:5000");
  if (!webAppUrl.startsWith("https://") && !webAppUrl.startsWith("http://localhost")) {
    console.warn(`вљ пёЏ TELEGRAM_WEBAPP_URL РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ HTTPS (С‚РµРєСѓС‰РµРµ Р·РЅР°С‡РµРЅРёРµ: ${webAppUrl})`);
  }

  let stopped = false;
  let offset = 0;
  let hackathonAnnouncementTimer: NodeJS.Timeout | null = null;
  let repairSweepTimer: NodeJS.Timeout | null = null;

  const poll = async () => {
    if (stopped) return;
    try {
      const updates: Array<any> = await callTelegramApi(token, "getUpdates", {
        timeout: 25,
        offset,
        allowed_updates: ["message", "callback_query"],
      });
      for (const update of updates) {
        offset = Math.max(offset, update.update_id + 1);
        try {
          if (update?.callback_query) {
            await handleIncomingCallback(token, webAppUrl, update.callback_query as TelegramCallbackQuery);
            continue;
          }
          if (update?.message) {
            await handleIncomingMessage(token, webAppUrl, update.message as TelegramMessage);
          }
        } catch (error) {
          console.error("вљ пёЏ Telegram message handling error:", error);
          const messageChatId = update?.message?.chat?.id ?? update?.callback_query?.message?.chat?.id;
          if (messageChatId) {
            await sendWithMainKeyboard(token, messageChatId, "Ошибка обработки команды. Попробуй ещё раз.");
          }
        }
      }
    } catch (error) {
      console.error("вљ пёЏ Telegram polling error:", error);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
    setImmediate(poll);
  };

  const stop = () => {
    stopped = true;
    if (hackathonAnnouncementTimer) {
      clearInterval(hackathonAnnouncementTimer);
      hackathonAnnouncementTimer = null;
    }
    if (repairSweepTimer) {
      clearInterval(repairSweepTimer);
      repairSweepTimer = null;
    }
    for (const timer of Array.from(pvpQueuePollTimerByChatId.values())) {
      clearInterval(timer);
    }
    pvpQueuePollTimerByChatId.clear();
  };

  const broadcastHackathonAnnouncements = async () => {
    const announcements = popWeeklyHackathonAnnouncements();
    if (!announcements.length) return;

    const users = await storage.getUsers();
    for (const announcement of announcements) {
      const globalText = announcement.text;
      for (const user of users) {
        if (!isCompletedRegistration(user)) continue;
        const telegramId = getTelegramIdByUserId(user.id);
        if (!telegramId) continue;
        const chatId = Number(telegramId);
        if (!Number.isFinite(chatId)) continue;
        await sendMessage(token, chatId, globalText);
        if (announcement.winnerCompanyId) {
          const membership = await getPlayerCompanyContext(user.id);
          if (membership?.company.id === announcement.winnerCompanyId) {
            const reward = WEEKLY_HACKATHON_CONFIG.rewards.first;
            await sendMessage(
              token,
              chatId,
              [
                "🏆 Ваша компания победила в Weekly Hackathon!",
                "",
                "Награды:",
                `+${reward.grm} GRM`,
                `+${reward.brand} brand`,
                `+ уникальный гаджет: ${reward.uniqueGadget}`,
              ].join("\n"),
            );
          }
        }
      }
    }
  };

  const broadcastGlobalEventAnnouncements = async () => {
    const announcements = popGlobalEventAnnouncements();
    if (!announcements.length) return;
    const users = await storage.getUsers();
    for (const announcement of announcements) {
      for (const user of users) {
        if (!isCompletedRegistration(user)) continue;
        const telegramId = getTelegramIdByUserId(user.id);
        if (!telegramId) continue;
        const chatId = Number(telegramId);
        if (!Number.isFinite(chatId)) continue;
        await sendMessage(token, chatId, announcement.text);
      }
    }
  };

  const broadcastStockMarketAnnouncements = async () => {
    const announcement = popStockMarketAnnouncement();
    if (!announcement) return;
    const users = await storage.getUsers();
    const moodEmoji = announcement.mood === "bullish" ? "📈" : announcement.mood === "bearish" ? "📉" : "📰";
    const text = [
      `${moodEmoji} Биржа: ${announcement.title}`,
      announcement.description,
      "",
      "Открой /stocks, чтобы купить или продать бумаги.",
    ].join("\n");
    for (const user of users) {
      if (!isCompletedRegistration(user)) continue;
      const telegramId = getTelegramIdByUserId(user.id);
      if (!telegramId) continue;
      const chatId = Number(telegramId);
      if (!Number.isFinite(chatId)) continue;
      await sendMessage(token, chatId, text);
    }
  };

  const bootstrapPolling = async () => {
    try {
      await callTelegramApi(token, "deleteWebhook", { drop_pending_updates: false });
      console.log("ℹ️ Telegram webhook отключен, используется polling");
    } catch (error) {
      console.warn("⚠️ Не удалось отключить webhook, продолжаю polling:", error);
    }

    if (!telegramBotUsername) {
      try {
        const me = await callTelegramApi(token, "getMe", {});
        if (me?.username) {
          telegramBotUsername = String(me.username).replace("@", "").trim();
          console.log(`в„№пёЏ Telegram bot username: @${telegramBotUsername}`);
        }
      } catch (error) {
        console.warn("⚠️ Не удалось получить username бота (getMe):", error);
      }
    }

    try {
      await callTelegramApi(token, "setMyCommands", { commands: TELEGRAM_PUBLIC_COMMANDS });
      console.log("в„№пёЏ Telegram command list synced");
    } catch (error) {
      console.warn("⚠️ Не удалось обновить список команд Telegram:", error);
    }

    poll();
    hackathonAnnouncementTimer = setInterval(() => {
      void broadcastHackathonAnnouncements();
      void broadcastGlobalEventAnnouncements();
      void broadcastStockMarketAnnouncements();
    }, 15000);
    repairSweepTimer = setInterval(() => {
      void processRepairOrderSweep(token);
    }, 30000);
  };

  void bootstrapPolling();

  httpServer.on("close", stop);
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);

  console.log("✅ Telegram bot polling started");
}


