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
  formatChangelogDateLabel,
  formatChangelogDetailedMessage,
  formatChangelogListMessage,
  formatChangelogRecentMessage,
  formatChangelogShortMessage,
  getAllChangelogEntries,
  getChangelogEntryByDate,
  getLatestChangelogEntry,
  getRecentChangelogEntries,
  normalizeChangelogDateInput,
} from "./changelog";
import { appendEconomyAuditEvent } from "./economy-audit";
import { canManageCompanyAssets, COMPANY_ASSET_MANAGER_ERROR, isCompanyAssetManagerRole } from "./company-security";
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
  PLAYABLE_PROFESSIONS,
  PROFESSIONS,
  PROFESSION_UNLOCK_LEVEL,
  getProfessionById,
  type ProfessionId,
} from "../shared/professions";
import { getPvpDailyBoostCatalog, getPvpTacticDefinition, type DuelRoundType, type DuelTacticId } from "../shared/pvp-duel";
import {
  ALL_PARTS,
  PART_TYPE_LABELS,
  RARITY_LEVELS,
  getPartPrice,
  getPartById,
  normalizePartQuality,
  resolvePartDefinition,
  type DeviceType,
  type RarityName,
} from "../client/src/lib/parts";
import {
  applyGameStatePatch,
  buyShopItem,
  clearPlayerGameState,
  closeBankProduct,
  completeJob,
  createGadgetConditionProfile,
  getEffectiveGadgetStats,
  getGadgetRepairCost,
  getGadgetWearPercent,
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
  type GamePvpBankBoost,
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
import { getPreferredDepartmentForProfession } from "../shared/company-staffing";
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
  getProfessionPromptShown,
  getTrainingConsumablesUsedAtLevel,
  purchaseHousing,
  getPlayerProfessionId,
  grantStarterHousing,
  setActiveHousing,
  setAdvancedPersonality,
  setProfessionPromptShown,
  setPlayerProfession,
  shouldAutoPromptProfession,
} from "./player-meta";
import { canEnterPvp, getPvpAccessMessage } from "./pvp-access";
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
  getHackathonRoundView,
  getWeeklyHackathonCompanyScore,
  getWeeklyHackathonPlayerStats,
  getWeeklyHackathonSabotageState,
  getWeeklyHackathonState,
  joinPlayerToWeeklyHackathonTeam,
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
  EXCLUSIVE_UPGRADE_REQUIRED_GADGETS,
  EXCLUSIVE_UPGRADE_REQUIRED_PARTS,
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
  companyBlueprintProgressMessageByChatId,
  companyBlueprintProgressTimerByChatId,
  companyBlueprintRefsByChatId,
  companyBlueprintGlobalOwnerByBlueprintId,
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
  companyPartSellRefsByChatId,
  companyRepairOrderRefsByChatId,
  companyRequestsByChatId,
  companySalaryByCompanyId,
  companySalaryClaimAtByCompanyId,
  companyContractSelectedPartRefsByChatId,
  companyWarehouseGadgetRefsByChatId,
  companyWarehouseFilterByChatId,
  companyWarehousePartRefsByChatId,
  companyWarehousePartsByCompanyId,
  hackathonPartRefsByChatId,
  hackathonSabotageTargetRefsByChatId,
  hackathonSkillProgressByChatId,
  inventoryRefsByChatId,
  lastInlineMessageByChatId,
  marketListingRefsByChatId,
  pendingActionByChatId,
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
import { companyAssignmentsByCompanyId } from "./runtime/company-state";
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
  sendCityHubSummary as sendCityHubSummaryBase,
  sendWithCityHubKeyboard as sendWithCityHubKeyboardBase,
  sendWithCurrentHubKeyboard as sendWithCurrentHubKeyboardBase,
  sendWithExtrasKeyboard as sendWithExtrasKeyboardBase,
  sendHomeMenu as sendHomeMenuBase,
  sendWithMainKeyboard as sendWithMainKeyboardBase,
  restoreTelegramMenuState as restoreTelegramMenuStateBase,
} from "./telegram/handlers/main-menu";
import { handleProfileMetaMessage } from "./telegram/handlers/profile";
import {
  type EducationLevelKey,
  getLastTelegramMenuState,
  getPlayerHubLocation,
  rememberTelegramMenu,
  setPlayerHubLocation,
  type ShopMenuTab,
  type TelegramMenuState,
} from "./telegram/ui-state";
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
  createCompanyTelegramModule,
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
  createRegistrationTelegramModule,
} from "./telegram/registration";
import { handleRegistrationCallback } from "./telegram/handlers/registration-callbacks";
import { handleRepairCallback } from "./telegram/handlers/repair-callbacks";
import { handleRegistrationPendingAction } from "./telegram/handlers/registration-messages";
import { handleRepairMessage } from "./telegram/handlers/repair-messages";
import { handleEconomyMessage } from "./telegram/handlers/economy-messages";
import { handleInventoryMessage } from "./telegram/handlers/inventory-messages";
import { handleCityMessage } from "./telegram/handlers/city";
import { handleCompanyNavigationMessage } from "./telegram/handlers/company-navigation-messages";
import { handleNavigationMessage } from "./telegram/handlers/navigation";
import { handleAdminMessage } from "./telegram/handlers/admin";
import { handlePvpMessage } from "./telegram/handlers/pvp";
import { handleHackathonCallback, handleHackathonMessage } from "./telegram/handlers/hackathon";
import { handleCompanyMembershipMessage } from "./telegram/handlers/company-membership";
import { handleCompanyProcessMessage } from "./telegram/handlers/company-processes";
import { handleCompanyManagementMessage } from "./telegram/handlers/company-management";
import { handleCompanyDevelopmentMessage } from "./telegram/handlers/company-development";
import { createPvpTelegramModule } from "./telegram/pvp";
import { createInventoryTelegramModule } from "./telegram/inventory";
import { createEconomyTelegramModule } from "./telegram/economy";
import { createRepairTelegramModule } from "./telegram/repair";
import { createHubTelegramModule } from "./telegram/hub";
import { createTutorialTelegramModule } from "./telegram/tutorial";
import type {
  TelegramCallbackDispatchContext,
  TelegramCallbackDispatchResult,
  TelegramCallbackQuery,
  TelegramMessage,
  TelegramMessageDispatchContext,
  TelegramUser,
} from "./telegram/core";

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
  | { type: "company_part_sell" }
  | { type: "company_part_sell_qty"; partRef: string }
  | { type: "company_contract_parts"; contractId: string; requiredPartType: string; requiredQuantity: number }
  | { type: "company_topup"; companyId: string }
  | { type: "company_set_salary_amount"; companyId: string; memberUserId: string; memberUsername: string }
  | { type: "auction_bid_amount"; listingId: string; source?: "city" | "company" }
  | { type: "company_auction_list_price"; ref: string; label: string }
  | { type: "company_exclusive_parts"; gadgetName: string; gadgetId?: string; gadgetCategory?: string; gadgetBatchAvailable?: number }
  | { type: "company_exclusive_confirm"; gadgetName: string; gadgetId: string; partRefs: string[]; gadgetCategory?: string; gadgetBatchAvailable?: number }
  | { type: "company_bp_produce_qty"; blueprintId: string; blueprintName: string; maxQuantity: number }
  | { type: "company_bp_produce_confirm"; blueprintId: string; blueprintName: string; quantity: number }
  | { type: "company_exclusive_produce_select" }
  | { type: "company_exclusive_produce_qty"; blueprintId: string; blueprintName: string }
  | { type: "company_exclusive_produce_confirm"; blueprintId: string; blueprintName: string; quantity: number }
  | { type: "study_level_select" }
  | { type: "study_course_select"; levelKey: EducationLevelKey }
  | { type: "gadget_catalog"; page: number }
  | { type: "advanced_personality_select" }
  | { type: "admin_auth" }
  | { type: "admin_add_money" }
  | { type: "admin_add_exp" }
  | { type: "admin_updates_date" }
  | { type: "admin_company_gadget_company" }
  | { type: "admin_company_gadget_gadget"; companyId: string }
  | { type: "admin_company_gadget_qty"; companyId: string; blueprintId: string; blueprintName: string };

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

type InventoryActionKind = "inspect" | "use" | "equip" | "service" | "scrap";

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
  activePvpBankBoost?: GamePvpBankBoost | null;
};

type CompanyBlueprintSnapshot = {
  available: Array<{
    id: string;
    name: string;
    requirements?: Partial<Record<"coding" | "design" | "analytics", number>>;
    baseStats?: Partial<Record<"coding" | "design" | "analytics" | "testing" | "attention", number>>;
    production?: { costGram?: number; parts?: Record<string, number> };
    time?: number;
  }>;
  active: {
    id?: string;
    blueprintId: string;
    status: string;
    projectStatus?: "active" | "completed" | "cancelled";
    progressHours: number;
    requiredPoints?: Partial<Record<"coding" | "design" | "analytics" | "testing" | "attention", number>>;
    currentPoints?: Partial<Record<"coding" | "design" | "analytics" | "testing" | "attention", number>>;
    lastContribution?: Partial<Record<"coding" | "design" | "analytics" | "testing" | "attention", number>>;
    participantUserIds?: string[];
    participantNames?: string[];
    tickSeconds?: number;
    estimatedFinishAt?: number | null;
    startedByUserId?: string;
    startedAt?: number;
    completedAt?: number;
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
    exclusiveLevel?: number;
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

const hackathonLiveMessageByChatId = new Map<number, {
  eventId: string;
  roundId: string;
  messageId: number;
  text: string;
}>();

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
type ExclusiveActionIntent = "job" | "study" | "development" | "travel" | "pvp" | "shop" | "bank" | "company_action" | "auction";

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
  { command: "gadgets", description: "Каталог гаджетов" },
  { command: "city", description: "Сменить город" },
  { command: "updates", description: "Обновления бота" },
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
    ["обновления", "/updates"],
    ["апдейты", "/updates"],
    ["изменения", "/updates"],
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
    ["👤 ур", "/rating players level"],
    ["👤 реп", "/rating players reputation"],
    ["👤 $", "/rating players wealth"],
    ["👤 pvp", "/rating players pvp"],
    ["🏢 ур", "/rating companies level"],
    ["🏢 grm", "/rating companies wealth"],
    ["🏢 📐", "/rating companies blueprints"],
    ["⬅️ назад в допы", "/extras"],
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
    ["🏷 аукцион компании", "/company_auction"],
    ["📥 передать запчасти", "/company_part_deposit"],
    ["💸 продать запчасти", "/company_part_sell"],
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
    ["🏁 участие в хакатоне", "/company_menu_hackathon_event"],
    ["🏁 участвовать в хакатоне", "/hackathon_join"],
    ["📊 статус хакатона", "/hackathon"],
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
    ["🧩 гаджет компании", "/admin_company_gadget"],
    ["♻️ сброс игрока", "/admin_reset_player"],
    ["♻ сброс игрока", "/admin_reset_player"],
    ["🔄 рестарт игры", "/admin_restart"],
    ["🏁 старт хакатона", "/admin_hackathon_start"],
    ["🛑 финиш хакатона", "/admin_hackathon_end"],
    ["♻️ сброс хакатона", "/admin_hackathon_reset"],
    ["♻ сброс хакатона", "/admin_hackathon_reset"],
    ["📝 последнее обновление", "/admin_updates_latest"],
    ["📜 история обновлений", "/admin_updates_history"],
    ["📚 список дат", "/admin_updates_list"],
    ["📅 обновление за дату", "/admin_updates_date"],
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
    ["продать запчасти", "/company_part_sell"],
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
  const rounded = (input: number) => Math.round(input).toString();

  for (const unit of units) {
    if (abs >= unit.threshold) {
      return `${rounded(normalized / unit.threshold)}${unit.suffix}`;
    }
  }

  return rounded(normalized);
}

function formatAuctionPrice(value: number) {
  if (!Number.isFinite(value)) return "0";
  const normalized = Number(value || 0);
  const abs = Math.abs(normalized);
  const sign = normalized < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(2).replace(".", ",")}m`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(2).replace(".", ",")}k`;
  if (Number.isInteger(normalized)) return `${normalized}`;
  return `${normalized.toFixed(2).replace(".", ",")}`;
}

function formatAuctionTimeLeft(auctionEndsAt?: number) {
  const timestamp = Number(auctionEndsAt || 0);
  if (!timestamp || timestamp <= Date.now()) return "завершается";
  const totalSeconds = Math.max(0, Math.ceil((timestamp - Date.now()) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}ч ${minutes}м`;
  if (minutes > 0) return `${minutes}м ${seconds}с`;
  return `${seconds}с`;
}

function formatRate(value: number) {
  if (!Number.isFinite(value)) return "0";
  if (Math.abs(value) >= 1) return formatNumber(value);
  return Number(value.toFixed(4)).toString();
}

function isFullEnergy(value: number) {
  return Number(value || 0) >= 0.9999;
}

function formatGramValue(value: number) {
  return formatNumber(Number(value || 0));
}

function isPvpBotUsername(username: string | null | undefined) {
  const value = String(username || "").trim().toLowerCase();
  const base = String(process.env.PVP_TEST_BOT_USERNAME || "pvp_test_bot").trim().toLowerCase();
  return value === base || value.startsWith(`${base}_`);
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

function formatGadgetPvpProfile(stats?: Record<string, number>) {
  const safeStats = stats || {};
  const project = Number(safeStats.design || 0) + Number(safeStats.analytics || 0);
  const develop = Number(safeStats.coding || 0);
  const debug = Number(safeStats.testing || 0) + Number(safeStats.attention || 0);
  const parts = [
    project > 0 ? `Проектирование +${formatNumber(project)}` : "",
    develop > 0 ? `Разработка +${formatNumber(develop)}` : "",
    debug > 0 ? `Отладка +${formatNumber(debug)}` : "",
  ].filter(Boolean);
  return parts.join(" | ");
}

function getShopGearQualityPreview(rarity: string) {
  const normalized = String(rarity || "").toLowerCase();
  if (normalized === "epic") return 1.4;
  if (normalized === "rare") return 1.2;
  if (normalized === "uncommon") return 1.1;
  return 1;
}

function formatGadgetCategoryLabel(category?: string) {
  if (category === "smartphones") return "Смартфон";
  if (category === "smartwatches") return "Смарт-часы";
  if (category === "tablets") return "Планшет";
  if (category === "laptops") return "Ноутбук";
  if (category === "asic_miners") return "ASIC";
  return "Гаджет";
}

function formatGadgetBranchLabel(branch?: string) {
  if (branch === "budget") return "Бюджет";
  if (branch === "business") return "Бизнес";
  if (branch === "creative") return "Креатив";
  if (branch === "performance") return "Производительность";
  if (branch === "efficient") return "Эффективность";
  if (branch === "industrial") return "Промышленный";
  if (branch === "experimental") return "Экспериментальный";
  return "Базовый";
}

function formatShopGearPreview(item: {
  rarity?: string;
  stats?: Record<string, number>;
  category?: string;
  branch?: string;
  generation?: number;
  requiredLevel?: number;
  quality?: number;
  reliability?: number;
  wearRate?: number;
  repairCost?: number;
  specialEffect?: string | null;
}) {
  const quality = getShopGearQualityPreview(String(item.rarity || "Common"));
  const profile = createGadgetConditionProfile({
    rarity: String(item.rarity || "Common"),
    quality: Number(item.quality ?? quality),
    testing: Number(item.stats?.testing || 0),
    attention: Number(item.stats?.attention || 0),
    maxCondition: 100,
  });
  const effectiveStats = getEffectiveGadgetStats({
    type: "gear",
    stats: item.stats || {},
    quality: Number(item.quality ?? quality),
    requiredLevel: Number(item.requiredLevel ?? 1),
    upgradeLevel: 0,
    condition: Number(profile.condition ?? 100),
    maxCondition: Number(profile.maxCondition ?? 100),
  }, { playerLevel: Number(item.requiredLevel ?? 1) });
  const statLine = formatGadgetStatLine(effectiveStats);
  const pvpProfile = formatGadgetPvpProfile(effectiveStats);
  const maxCondition = Math.max(1, Math.round(Number(profile.maxCondition ?? 100) || 100));
  const condition = Math.max(0, Math.round(Number(profile.condition ?? maxCondition) || maxCondition));
  const repairCost = getGadgetRepairCost({
    type: "gear",
    basePrice: 0,
    repairCost: Number(item.repairCost ?? 0),
    quality: Number(item.quality ?? quality),
    condition,
    maxCondition,
    isBroken: false,
  });
  return [
    `Категория: ${formatGadgetCategoryLabel(item.category)} | Ветка: ${formatGadgetBranchLabel(item.branch)} | Gen ${Math.max(1, Number(item.generation ?? 1) || 1)}`,
    `Треб. уровень: ${Math.max(1, Number(item.requiredLevel ?? 1) || 1)}`,
    statLine ? `Характеристики: ${statLine}` : "",
    pvpProfile ? `PvP-профиль: ${pvpProfile}` : "",
    `Износ: ${formatNumber(getGadgetWearPercent({ type: "gear", condition, maxCondition }))}% | до ремонта ${condition}/${maxCondition}`,
    `Ремонт: ${repairCost}`,
    item.specialEffect ? `Эффект: ${item.specialEffect}` : "",
  ].filter(Boolean).join("\n");
}

function formatGadgetRuntimeDetails(item: {
  type?: string;
  stats?: Record<string, number>;
  category?: string;
  branch?: string;
  generation?: number;
  requiredLevel?: number;
  upgradeLevel?: number;
  exclusiveLevel?: number;
  quality?: number;
  wear?: number;
  condition?: number;
  maxCondition?: number;
  durability?: number;
  maxDurability?: number;
  reliability?: number;
  isBroken?: boolean;
  repairCost?: number;
  specialEffect?: string | null;
  companyEmoji?: string | null;
}) {
  const effectiveStats = getEffectiveGadgetStats({
    type: (item.type as any) || "gadget",
    stats: item.stats || {},
    quality: Number(item.quality ?? 1),
    requiredLevel: Number(item.requiredLevel ?? 1),
    upgradeLevel: Number(item.upgradeLevel ?? item.exclusiveLevel ?? 0),
    exclusiveLevel: Number(item.exclusiveLevel ?? 0),
    wear: Number(item.wear ?? 0),
    condition: Number(item.condition ?? item.durability ?? 100),
    maxCondition: Number(item.maxCondition ?? item.maxDurability ?? 100),
    isBroken: Boolean(item.isBroken),
  }, { playerLevel: Number(item.requiredLevel ?? 1) });
  const pvpProfile = formatGadgetPvpProfile(effectiveStats);
  const quality = Number(item.quality ?? 1);
  const maxCondition = Math.max(1, Math.round(Number(item.maxCondition ?? item.maxDurability ?? 100) || 100));
  const condition = Math.max(0, Math.round(Number(item.condition ?? item.durability ?? maxCondition) || maxCondition));
  const reliability = Math.round(Number(item.reliability ?? 1) * 100);
  const wear = getGadgetWearPercent({
    type: (item.type as any) || "gadget",
    wear: item.wear,
    condition,
    maxCondition,
  });
  const repairCost = getGadgetRepairCost({
    type: (item.type as any) || "gadget",
    repairCost: item.repairCost,
    quality,
    condition,
    maxCondition,
    isBroken: Boolean(item.isBroken),
    basePrice: 0,
  });
  const lines = [
    `Категория: ${formatGadgetCategoryLabel(item.category)} | Ветка: ${formatGadgetBranchLabel(item.branch)} | Gen ${Math.max(1, Number(item.generation ?? 1) || 1)}`,
    `Треб. уровень: ${Math.max(1, Number(item.requiredLevel ?? 1) || 1)}${Number(item.upgradeLevel ?? item.exclusiveLevel ?? 0) > 0 ? ` | Улучшение: +${Math.max(0, Number(item.upgradeLevel ?? item.exclusiveLevel ?? 0))}` : ""}`,
    pvpProfile ? `PvP-профиль: ${pvpProfile}` : "",
    `Состояние: качество x${formatNumber(quality)} | износ ${formatNumber(wear)}% | до ремонта ${condition}/${maxCondition}`,
    `Надёжность: ${reliability}% | ремонт ${repairCost}${item.isBroken ? " | сломан" : ""}`,
    item.companyEmoji ? `Компания: ${item.companyEmoji}` : "",
    hasMeaningfulSpecialEffect(item.specialEffect) ? `Эффект: ${item.specialEffect}` : "",
  ].filter(Boolean);
  return lines.join("\n");
}

function formatGadgetInfoBlock(item: {
  type?: string;
  stats?: Record<string, number>;
  category?: string;
  branch?: string;
  generation?: number;
  requiredLevel?: number;
  upgradeLevel?: number;
  exclusiveLevel?: number;
  quality?: number;
  wear?: number;
  condition?: number;
  maxCondition?: number;
  durability?: number;
  maxDurability?: number;
  reliability?: number;
  isBroken?: boolean;
  repairCost?: number;
  specialEffect?: string | null;
  companyEmoji?: string | null;
}) {
  const statLine = formatGadgetStatLine(
    getEffectiveGadgetStats({
      type: (item.type as any) || "gadget",
      stats: item.stats || {},
      quality: Number(item.quality ?? 1),
      requiredLevel: Number(item.requiredLevel ?? 1),
      upgradeLevel: Number(item.upgradeLevel ?? item.exclusiveLevel ?? 0),
      exclusiveLevel: Number(item.exclusiveLevel ?? 0),
      wear: Number(item.wear ?? 0),
      condition: Number(item.condition ?? item.durability ?? 100),
      maxCondition: Number(item.maxCondition ?? item.maxDurability ?? 100),
      isBroken: Boolean(item.isBroken),
    }, { playerLevel: Number(item.requiredLevel ?? 1) }),
  );
  const detailsLine = formatGadgetRuntimeDetails(item);
  return [
    statLine ? `Характеристики: ${statLine}` : "",
    detailsLine,
  ].filter(Boolean).join("\n");
}

function formatCompactInventoryGadgetInfo(item: {
  type?: string;
  stats?: Record<string, number>;
  category?: string;
  branch?: string;
  generation?: number;
  requiredLevel?: number;
  upgradeLevel?: number;
  exclusiveLevel?: number;
  condition?: number;
  maxCondition?: number;
  durability?: number;
  maxDurability?: number;
  reliability?: number;
  isBroken?: boolean;
  companyEmoji?: string | null;
}) {
  const effectiveStats = getEffectiveGadgetStats({
    type: (item.type as any) || "gadget",
    stats: item.stats || {},
    quality: Number((item as any).quality ?? 1),
    requiredLevel: Number(item.requiredLevel ?? 1),
    upgradeLevel: Number(item.upgradeLevel ?? item.exclusiveLevel ?? 0),
    exclusiveLevel: Number(item.exclusiveLevel ?? 0),
    wear: Number((item as any).wear ?? 0),
    condition: Number(item.condition ?? item.durability ?? 100),
    maxCondition: Number(item.maxCondition ?? item.maxDurability ?? 100),
    isBroken: Boolean(item.isBroken),
  }, { playerLevel: Number(item.requiredLevel ?? 1) });
  const statLine = formatGadgetStatLine(effectiveStats);
  const maxCondition = Math.max(1, Math.round(Number(item.maxCondition ?? item.maxDurability ?? 100) || 100));
  const condition = Math.max(0, Math.round(Number(item.condition ?? item.durability ?? maxCondition) || maxCondition));
  const reliability = Math.round(Number(item.reliability ?? 1) * 100);

  return [
    statLine ? `Бонусы: ${statLine}` : "",
    `Категория: ${formatGadgetCategoryLabel(item.category)} | ${formatGadgetBranchLabel(item.branch)} | Gen ${Math.max(1, Number(item.generation ?? 1) || 1)}`,
    `Уровень: ${Math.max(1, Number(item.requiredLevel ?? 1) || 1)} | Сост.: ${condition}/${maxCondition} | Надёжность: ${reliability}%${item.companyEmoji ? ` | Компания: ${item.companyEmoji}` : ""}${item.isBroken ? " | сломан" : ""}`,
  ].filter(Boolean).join("\n");
}

function formatRarityLabel(rarity: string) {
  const normalized = normalizePartRarity(rarity);
  const labels: Record<string, string> = {
    Common: "Обычный",
    Uncommon: "Необычный",
    Rare: "Редкий",
    Epic: "Эпический",
  };
  return labels[normalized] || normalized;
}

function formatRarityBadge(rarity: string) {
  const normalized = normalizePartRarity(rarity);
  const icon = RARITY_LEVELS[normalized]?.icon ?? "⚪";
  return `${icon} ${formatRarityLabel(normalized)}`;
}

function hasMeaningfulSpecialEffect(value?: string | null) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized !== "" && normalized !== "null" && normalized !== "none" && normalized !== "undefined";
}

function stripLeadingRarityBadgeFromName(name: string) {
  return String(name || "")
    .replace(/^[⚪🔵🟣🟡]\s*/u, "")
    .trim();
}

function getDeviceCategoryEmoji(deviceCategory?: string | null) {
  const normalized = String(deviceCategory || "").trim().toLowerCase();
  if (normalized === "smartphone" || normalized === "smartphones") return "📱";
  if (normalized === "smartwatch" || normalized === "smartwatches") return "⌚";
  if (normalized === "tablet" || normalized === "tablets") return "🧾";
  if (normalized === "laptop" || normalized === "laptops") return "💻";
  if (normalized === "asic" || normalized === "asic_miners") return "⛏";
  return "🧩";
}

function formatNonZeroStats(stats?: Record<string, number>) {
  const entries = Object.entries(stats ?? {}).filter(([, value]) => Number(value || 0) > 0);
  if (!entries.length) return "";
  return entries
    .map(([stat, value]) => `+${formatNumber(Number(value || 0))} ${SKILL_LABELS[stat as SkillName] ?? stat}`)
    .join(", ");
}

function formatInventoryPartName(item: GameInventoryItem) {
  const definition = resolvePartDefinition({
    id: item.id,
    type: item.type,
    partType: (item as any).partType,
    rarity: item.rarity,
    quality: (item as any).quality,
    deviceCategory: (item as any).deviceCategory,
  });
  const rarity = normalizePartRarity(String((definition as any)?.quality || (item as any).quality || item.rarity || "Common"));
  const emoji = getDeviceCategoryEmoji(definition?.deviceCategory || (item as any).deviceCategory);
  const qualityLabel = formatRarityLabel(rarity);
  const baseName = stripLeadingRarityBadgeFromName(String(definition?.title || item.name || "Запчасть")).toLowerCase();
  return `${RARITY_LEVELS[rarity]?.icon ?? "⚪"} ${emoji} ${qualityLabel} ${baseName}`.trim();
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

function formatBlueprintRecipeCompactLine(blueprint: any) {
  const recipe = Array.isArray(blueprint?.productionRecipe) ? blueprint.productionRecipe : [];
  if (!recipe.length) return "";
  return recipe
    .slice(0, 4)
    .map((item: any) => `${formatRarityLabel(String(item.quality || item.rarity || "Common"))} ${String(item.partType || item.type || "")} x${Math.max(1, Number(item.quantity || 1))}`)
    .join(" • ");
}

function formatPartTypeLabel(partType: string) {
  return PART_TYPE_LABELS[String(partType || "") as keyof typeof PART_TYPE_LABELS] ?? String(partType || "деталь");
}

function formatBlueprintRecipeDetailedLines(blueprint: any, quantity = 1) {
  const recipe = Array.isArray(blueprint?.productionRecipe) ? blueprint.productionRecipe : [];
  if (!recipe.length) return ["Рецепт: базовые детали не настроены"];
  return [
    "Нужно на производство:",
    ...recipe.map((item: any) => {
      const partType = formatPartTypeLabel(String(item.partType || item.type || ""));
      const quality = formatRarityLabel(String(item.quality || item.rarity || "Common"));
      const amount = Math.max(1, Number(item.quantity || 1)) * Math.max(1, quantity);
      return `• ${quality} ${partType} x${formatNumber(amount)}`;
    }),
  ];
}

function getLeadingTelegramCompanyEmoji(name: string) {
  const trimmed = String(name || "").trim();
  if (!trimmed) return "";
  const firstToken = trimmed.split(/\s+/)[0] || "";
  return isValidTelegramCompanyEmoji(firstToken) ? firstToken : "";
}

function formatGlobalBlueprintOwnerLabel(owner: { companyName: string; companyEmoji?: string | null } | null | undefined) {
  if (!owner) return "";
  const emoji = String(owner.companyEmoji || getLeadingTelegramCompanyEmoji(owner.companyName) || "").trim();
  const name = String(owner.companyName || "").trim();
  if (!name) return "";
  return emoji && !name.startsWith(emoji)
    ? formatTelegramCompanyDisplayName(name, emoji)
    : name;
}

function getGadgetCategoryEmoji(category?: string | null) {
  const normalized = String(category || "").trim().toLowerCase();
  if (normalized === "smartphones") return "📱";
  if (normalized === "smartwatches") return "⌚";
  if (normalized === "tablets") return "🧾";
  if (normalized === "laptops") return "💻";
  if (normalized === "asic_miners") return "⛏";
  return "📦";
}

function formatAuctionGadgetTitle(gadget: { name?: string | null; category?: string | null }) {
  const name = String(gadget?.name || "Гаджет").trim();
  const emoji = getGadgetCategoryEmoji(gadget?.category);
  return name.startsWith(emoji) ? name : `${emoji} ${name}`;
}

const GADGET_CATALOG_REPLY_MARKUP = {
  keyboard: [[{ text: "◀️ Пред" }, { text: "▶️ След" }], [{ text: "🏠 Домой" }]],
  resize_keyboard: true,
};

const auctionViewModeByChatId = new Map<number, "compact" | "full">();

function getGadgetCatalogPages() {
  const groups = new Map<string, typeof GADGET_BLUEPRINTS>();
  for (const blueprint of GADGET_BLUEPRINTS) {
    const key = String(blueprint.category);
    const current = groups.get(key) ?? [];
    current.push(blueprint);
    groups.set(key, current);
  }
  const orderedGroups = Array.from(groups.values());
  const totalPages = orderedGroups.reduce((max, group) => Math.max(max, group.length), 0);
  return Array.from({ length: totalPages }, (_, pageIndex) =>
    orderedGroups
      .map((group) => group[pageIndex])
      .filter((item): item is typeof GADGET_BLUEPRINTS[number] => Boolean(item)),
  );
}

function formatBlueprintRecipeFull(blueprint: any) {
  const recipe = Array.isArray(blueprint?.productionRecipe) ? blueprint.productionRecipe : [];
  if (!recipe.length) return "Рецепт: базовые детали не настроены";
  return [
    "Рецепт:",
    ...recipe.map((item: any) =>
      `• ${formatRarityLabel(String(item.quality || item.rarity || "Common"))} ${String(item.partType || item.type || "")} x${Math.max(1, Number(item.quantity || 1))}`,
    ),
  ].join("\n");
}

function formatGadgetCatalogPage(pageIndex: number) {
  const pages = getGadgetCatalogPages();
  const safeIndex = Math.max(0, Math.min(pages.length - 1, pageIndex));
  const pageItems = pages[safeIndex] ?? [];
  return {
    pageIndex: safeIndex,
    totalPages: Math.max(1, pages.length),
    text: [
      "📘 КАТАЛОГ ГАДЖЕТОВ",
      "━━━━━━━━━━━━━━",
      `Страница: ${safeIndex + 1}/${Math.max(1, pages.length)}`,
      "",
      ...pageItems.map((blueprint, index) => [
        `${index + 1}. ${blueprint.name}`,
        `${formatGadgetCategoryLabel(blueprint.category)} • ${formatGadgetBranchLabel(blueprint.branch)} • Gen ${blueprint.generation}`,
        `Редкость: ${formatRarityLabel(blueprint.rarity)} • Ур. ${blueprint.requiredLevel}`,
        `Характеристики: ${formatGadgetStatLine(blueprint.baseStats) || "нет бонусов"}`,
        formatBlueprintRecipeFull(blueprint),
      ].join("\n")),
      "",
      "Кнопками ниже можно листать каталог или вернуться домой.",
    ].join("\n\n"),
  };
}

async function sendGadgetCatalogPage(token: string, chatId: number, pageIndex: number) {
  const view = formatGadgetCatalogPage(pageIndex);
  pendingActionByChatId.set(chatId, { type: "gadget_catalog", page: view.pageIndex });
  await sendMessage(token, chatId, view.text, { reply_markup: GADGET_CATALOG_REPLY_MARKUP });
}

const COMPANY_WAREHOUSE_DEVICE_FILTERS: Array<{ key: DeviceType; label: string; emoji: string }> = [
  { key: "smartphone", label: "Смартфоны", emoji: "📱" },
  { key: "smartwatch", label: "Часы", emoji: "⌚" },
  { key: "tablet", label: "Планшеты", emoji: "🧾" },
  { key: "laptop", label: "Ноутбуки", emoji: "💻" },
  { key: "asic", label: "ASIC", emoji: "⛏" },
];

function getCompanyWarehouseFilter(chatId?: number): DeviceType | null {
  if (!Number.isFinite(chatId)) return null;
  const raw = String(companyWarehouseFilterByChatId.get(Number(chatId)) || "").trim();
  return COMPANY_WAREHOUSE_DEVICE_FILTERS.some((item) => item.key === raw) ? (raw as DeviceType) : null;
}

function matchesWarehouseDeviceFilter(item: { id: string; type?: string }, filterDevice: DeviceType | null) {
  if (!filterDevice) return true;
  const definition = ALL_PARTS[item.id];
  return Array.isArray(definition?.compatibleWith) && definition.compatibleWith.includes(filterDevice);
}

function buildCompanyWarehouseInlineMarkup(chatId: number) {
  const activeFilter = getCompanyWarehouseFilter(chatId);
  const filterRows = [
    [
      {
        text: activeFilter ? "📦 Все" : "📦 Все ✓",
        callback_data: "company:warehouse_filter:all",
      },
    ],
    ...COMPANY_WAREHOUSE_DEVICE_FILTERS.reduce<Array<Array<{ text: string; callback_data: string }>>>((rows, item, index) => {
      const button = {
        text: `${item.emoji}${activeFilter === item.key ? "✓" : ""}`,
        callback_data: `company:warehouse_filter:${item.key}`,
      };
      const rowIndex = Math.floor(index / 3);
      if (!rows[rowIndex]) rows[rowIndex] = [];
      rows[rowIndex].push(button);
      return rows;
    }, []),
  ];
  return { inline_keyboard: filterRows };
}

function buildCompanyPartSellInlineMarkup(chatId: number) {
  const rows = (companyPartSellRefsByChatId.get(chatId) ?? [])
    .slice(0, 20)
    .map((_, index) => ([{
      text: `💸 ${index + 1}`,
      callback_data: `company:part_sell_pick:${index + 1}`,
    }]));
  rows.push([{ text: "⬅️ Назад на склад", callback_data: "company:warehouse" }]);
  return buildCompanyInlineMenu(rows);
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
    `Сумма: ${currency}${Math.round(product.amount)}, осталось: ${formatDurationShort(Math.max(0, product.daysLeft) * 60_000)}`,
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
  const professionBlock = profession
    ? `🎓 Профессия: ${profession.emoji} ${profession.name} (/profession)`
    : Number(user.level || 0) >= PROFESSION_UNLOCK_LEVEL
      ? "🎓 Профессия: не выбрана"
      : "";
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
    professionBlock,
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
    `🎓 Ты достиг ${PROFESSION_UNLOCK_LEVEL} уровня и теперь можешь выбрать профессию.`,
    "",
    "Профессия — это твоя специализация.",
    "Она определяет, какие навыки тебе легче развивать, в чём ты будешь сильнее в PvP и какой стиль игры тебе ближе.",
    "Профильные навыки профессии можно прокачивать выше обычного лимита.",
    "",
    "Что даёт профессия:",
    "— бонусы к профильным навыкам",
    "— усиление в PvP",
    "— повышенный предел развития ключевого навыка",
    "",
    "Без выбранной профессии PvP недоступно.",
    "",
    "Выбери специализацию:",
    "",
    ...PLAYABLE_PROFESSIONS.map((item) => `${item.emoji} ${item.name} — ${item.summary}`),
  ].join("\n\n");
}

function buildProfessionSelectInlineMarkup() {
  return buildCompanyInlineMenu(
    PLAYABLE_PROFESSIONS.map((item) => [
      { text: `${item.emoji} ${item.name}`, callback_data: `profession:pick:${item.id}` },
    ]),
  );
}

function buildProfessionConfirmText(selected: ReturnType<typeof getProfessionById>) {
  if (!selected) return "Профессия выбрана.";
  const skillLines = Object.entries(selected.pvpBonuses.skillMultipliers)
    .filter(([, multiplier]) => Number(multiplier || 1) > 1)
    .map(([skill, multiplier]) => `— +${Math.round((Number(multiplier) - 1) * 100)}% к ${SKILL_LABELS[skill as SkillName]} в PvP`);
  const roundLines = Object.entries(selected.pvpBonuses.roundMultipliers)
    .filter(([, multiplier]) => Number(multiplier || 1) > 1)
    .map(([round, multiplier]) => {
      const roundLabel = round === "concept" ? "Проектирование" : round === "core" ? "Разработка" : "Отладка";
      return `— +${Math.round((Number(multiplier) - 1) * 100)}% в раунде «${roundLabel}»`;
    });
  return [
    `✅ Ты выбрал профессию ${selected.name}.`,
    "",
    "Твои бонусы:",
    ...skillLines,
    ...roundLines,
    `— ${SKILL_LABELS[selected.skillCapBonus.skill as SkillName]} можно прокачивать выше обычного лимита`,
    "",
    "Теперь тебе доступно PvP.",
  ].join("\n");
}

async function maybePromptProfession(
  token: string,
  chatId: number,
  user: User,
  options: { force?: boolean } = {},
) {
  if (!canSelectProfession(user)) return false;
  if (!options.force && getProfessionPromptShown(user)) return false;
  await sendMessage(token, chatId, buildProfessionSelectText(), {
    reply_markup: buildProfessionSelectInlineMarkup(),
  });
  if (!options.force) {
    await setProfessionPromptShown(user.id, true);
  }
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
    ...(snapshot.user.personality === "lucky" ? ["🍀 Счастливчик: риск провала вакансий снижен на 5%, шанс бонусной награды выше."] : []),
    ...jobs.map((job, index) => {
      const money = snapshot.user.personality === "businessman" ? Math.floor(job.reward * 1.15) : job.reward;
      const exp = snapshot.user.personality === "workaholic" ? Math.floor(job.expReward * 1.2) : job.expReward;
      const energyCost = getJobWorkEnergyCost(job);
      return `${index + 1}. ${job.name}\nНаграда: ${currency}${money}, XP: ${exp}, ⚡: -${Math.round(energyCost * 100)}\nТребования: ${formatStats(job.minStats)}`;
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
      const weeklyQuestProgress = updateWeeklyQuestProgress(result.user, "jobs", 1);
      const weeklyQuestNotice = formatWeeklyQuestProgressNotice(weeklyQuestProgress);
      if (weeklyQuestNotice) lines.push("", weeklyQuestNotice);
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
      await maybePromptProfession(token, chatId, result.user, { force: false });
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
  const liveRound = getHackathonRoundView();
  const registrationEndsIn = state.registrationEndsAt ? Math.max(0, Math.ceil((state.registrationEndsAt - Date.now()) / 1000)) : 0;
  const roundEndsIn = state.roundEndAt ? Math.max(0, Math.ceil((state.roundEndAt - Date.now()) / 1000)) : 0;
  const registeredCompany = membership
    ? state.registeredCompanies.find((row: any) => row.companyId === membership.company.id)
    : null;

  const lines = [
    "🏁 WEEKLY HACKATHON",
    "━━━━━━━━━━━━━━",
    `Статус: ${state.status}`,
    state.status === "registration" && state.registrationEndsAt ? `До закрытия регистрации: ~${registrationEndsIn} сек.` : "",
    liveRound?.currentRound ? `Текущий этап: ${String(liveRound.currentRound)}` : "",
    state.roundEndAt ? `До конца этапа: ~${roundEndsIn} сек.` : "",
    membership
      ? `Компания: ${membership.company.name} (${membership.role === "owner" ? "CEO" : "Сотрудник"})`
      : "Компания: не найдена",
    registeredCompany
      ? `Состав: ${registeredCompany.participantCount}/${WEEKLY_HACKATHON_CONFIG.maxParticipantsPerCompany}`
      : "Состав: компания ещё не зарегистрирована",
    companyScore
      ? `Очки компании: ${companyScore.tournamentPoints} турнирных • сырой счёт ${formatNumber(companyScore.rawScore)}`
      : "Очки компании: пока нет",
    playerStats
      ? `Личный вклад: ${formatNumber(playerStats.totalContribution)}`
      : "Личный вклад: пока нет",
    "",
  ];

  if (state.status === "registration") {
    lines.push("Как участвовать:");
    lines.push("• CEO регистрирует компанию через /hackathon_join");
    lines.push("• игроки занимают до 5 мест той же командой /hackathon_join или кнопкой из уведомления");
    lines.push(`• состав фиксируется после регистрации и уже не меняется`);
    lines.push("");
    lines.push("Требования к участнику:");
    lines.push(`• от ${WEEKLY_HACKATHON_CONFIG.eligibility.minMembershipDays} дней в компании`);
    lines.push(`• уровень ${WEEKLY_HACKATHON_CONFIG.eligibility.minLevel}+`);
    lines.push(`• минимум ${WEEKLY_HACKATHON_CONFIG.eligibility.minTotalPvpBattles} PvP боёв за всё время`);
    lines.push(`• минимум ${WEEKLY_HACKATHON_CONFIG.eligibility.minRecentPvpBattles7d} PvP боя за последние 7 дней`);
    lines.push("");
  }

  if (state.rosterLockedAt) {
    lines.push(`Состав зафиксирован: да`);
    lines.push("");
  }

  if (registeredCompany?.participants?.length) {
    lines.push("Участники компании:");
    registeredCompany.participants.forEach((participant: any, index: number) => {
      lines.push(`${index + 1}. ${participant.username}`);
    });
    lines.push("");
  }

  if (top.length) {
    lines.push("Лидеры хакатона:");
    top.forEach((row: any) => {
      lines.push(`${row.place}. ${row.companyName} — ${row.tournamentPoints} очк. • ${formatNumber(row.score)}`);
    });
  } else {
    lines.push("Лидеры хакатона: пока нет участников");
  }

  if (state.mvp) {
    lines.push("");
    lines.push(`🎯 MVP сейчас: ${state.mvp.username} • ${formatNumber(state.mvp.totalContribution)}`);
  }

  return lines.filter(Boolean).join("\n");
}

function formatProgressBar(current: number, total: number, size: number = 12) {
  const safeTotal = Math.max(1, total);
  const filled = Math.max(0, Math.min(size, Math.round((current / safeTotal) * size)));
  return `[${"=".repeat(filled)}${"-".repeat(Math.max(0, size - filled))}]`;
}

function formatHackathonRoundLabel(roundId: string | null | undefined) {
  if (roundId === "concept") return "🎨 Концепт";
  if (roundId === "prototype") return "💻 Прототип";
  if (roundId === "pitch") return "🚀 Питч";
  return "🏁 Хакатон";
}

function formatFilledBar(value: number, max: number, size: number = 10) {
  const ratio = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const filled = Math.max(0, Math.min(size, Math.round(ratio * size)));
  return `[${"█".repeat(filled)}${"░".repeat(Math.max(0, size - filled))}]`;
}

async function formatHackathonLiveRoundMessage(userId: string) {
  const state = getWeeklyHackathonState();
  if (!(state.status === "round1" || state.status === "round2" || state.status === "round3") || !state.currentRound) {
    return null;
  }
  const membership = await getPlayerCompanyContext(userId);
  const leaderboard = Array.isArray((state as any).currentRoundLeaderboard) ? (state as any).currentRoundLeaderboard.slice(0, 8) : [];
  const maxScore = leaderboard.reduce((best: number, row: any) => Math.max(best, Number(row.score || 0)), 0);
  const remaining = state.roundEndAt ? Math.max(0, Math.ceil((state.roundEndAt - Date.now()) / 1000)) : 0;
  const lines = [
    "🏁 Хакатон недели",
    "",
    formatHackathonRoundLabel(state.currentRound),
    `⏱ Осталось: ${remaining} / ${Math.floor(WEEKLY_HACKATHON_CONFIG.roundDurationMs / 1000)} сек`,
    "",
    ...leaderboard.map((row: any) => `${row.companyName.padEnd(10, " ")} ${formatFilledBar(Number(row.score || 0), maxScore)} ${formatNumber(row.score || 0)}`),
    "",
    leaderboard[0]?.companyName ? `👑 Лидер: ${leaderboard[0].companyName}` : "👑 Лидер: пока нет",
  ];
  if (membership) {
    const own = leaderboard.find((row: any) => row.companyId === membership.company.id);
    lines.push(`🏢 Твоя компания: ${membership.company.name}${own ? ` — ${formatNumber(own.score || 0)}` : ""}`);
  }
  return lines.join("\n");
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
  const labelMap: Record<string, string> = { concept: "Проектирование", core: "Разработка", tests: "Отладка" };
  const roundsText = rounds.map((round: any, idx: number) => {
    const isPlayerA = String(round.playerAUserId || "") === String(result?.userId || "");
    const myScore = isPlayerA ? Number(round.scoreA || 0) : Number(round.scoreB || 0);
    const oppScore = isPlayerA ? Number(round.scoreB || 0) : Number(round.scoreA || 0);
    const mark = round.winnerUserId === result?.userId ? "🏆" : round.winnerUserId ? "💥" : "🤝";
    const explanation = String(isPlayerA ? round.explanationA || "" : round.explanationB || "");
    return `${idx + 1}. ${labelMap[String(round.round || "")] || String(round.round || "Этап")}: ты ${myScore.toFixed(1)} | соперник ${oppScore.toFixed(1)} ${mark}${explanation ? `\n   ${explanation}` : ""}`;
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
    : `Награда: +${Math.max(0, Number(result?.xpReward || 0))} XP${Number(result?.reputationReward || 0) > 0 ? `, +${Number(result.reputationReward)} репутации` : ""}${Number(result?.moneyReward || 0) > 0 ? `, +${String(result?.moneyRewardCurrency || "")}${formatNumber(Number(result.moneyReward || 0))}` : ""}`;
  const lines = [
    "⚔️ PvP duel result",
    `Соперник: ${result?.opponentName || "—"}`,
    resultHeadline,
    `Счёт по раундам: ${rounds.filter((round: any) => round.winnerUserId === result?.userId).length}:${rounds.filter((round: any) => round.winnerUserId && round.winnerUserId !== result?.userId).length}`,
    ratingLine,
    rewardLine,
    "",
    ...roundsText,
    ...(result?.droppedPart ? ["", `🎁 Деталь PvP: ${String(result.droppedPart.name)} (${String(result.droppedPart.rarity || "Common")})`] : []),
    ...(result?.gadgetWear?.summary ? ["", String(result.gadgetWear.summary)] : []),
  ];
  if (Number(result?.energyCost || 0) > 0) {
    lines.splice(6, 0, `⚡ Энергия дуэли: -${Math.round(Number(result?.energyCost || 0) * 100)}%`);
  }
  return lines.join("\n");
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
  const stageHints: Record<string, string> = {
    concept: "Сейчас решают Design + Analytics.",
    core: "Сейчас решают Coding + Attention.",
    tests: "Сейчас решают Testing + Analytics.",
  };
  const stageIndex = Array.isArray(activeDuel?.stages)
    ? Math.max(0, activeDuel.stages.findIndex((stage: any) => String(stage?.key || "") === String(stageView?.key || ""))) + 1
    : 0;
  const stagePrepRemainingSec = Math.max(0, Math.ceil(Number(activeDuel?.stagePreparationRemainingMs || 0) / 1000));
  return [
    "[DUEL LIVE]",
    `${activeDuel?.myName || "Ты"} vs ${activeDuel?.opponentName || "Соперник"}`,
    `Раунд ${stageIndex || "?"}/3 — ${stageView?.label || activeDuel?.currentStageLabel || "Подготовка"}`,
    stagePrepRemainingSec > 0 ? `До старта раунда: ${stagePrepRemainingSec} сек. Выбери тактику.` : "",
    stageHints[String(stageView?.key || "")] || "",
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
    stageView?.myTactic ? `Твоя тактика: ${getPvpTacticDefinition(stageView.myTactic)?.name || stageView.myTactic}` : "",
    stageView?.opponentTactic ? `Тактика соперника: ${getPvpTacticDefinition(stageView.opponentTactic)?.name || stageView.opponentTactic}` : "",
    activeDuel?.myFreezeTicks > 0 ? `⏸ Ты заморожен: ${Number(activeDuel.myFreezeTicks)} сек.` : "",
    activeDuel?.opponentFreezeTicks > 0 ? `⏸ Соперник заморожен: ${Number(activeDuel.opponentFreezeTicks)} сек.` : "",
    Array.isArray(activeDuel?.myBoosts) && activeDuel.myBoosts.length ? `Boosts: ${activeDuel.myBoosts.join(", ")}` : "",
  ].filter(Boolean).join("\n");
}

function buildPvpPreparationInlineKeyboard(activeDuel?: any) {
  const myBoosts = new Set(Array.isArray(activeDuel?.myBoosts) ? activeDuel.myBoosts : []);
  const myTactics = (activeDuel?.myTactics && typeof activeDuel.myTactics === "object") ? activeDuel.myTactics : {};
  const catalog = getPvpDailyBoostCatalog();
  const rows = catalog.map((boost) => {
    const label = myBoosts.has(boost.id) ? `${boost.name} ✓` : `${boost.name} ${boost.costGram} GRM`;
    return [{ text: label, callback_data: `pvp_boost:buy:${boost.id}` }];
  });
  const stageKey: DuelRoundType = "concept";
  const selected = myTactics[stageKey] as DuelTacticId | undefined;
  const tacticRows = selected
    ? []
    : [
        (["speed", "quality", "stability", "pressure"] as DuelTacticId[]).map((tacticId) => ({
          text: `${getPvpTacticDefinition(tacticId)?.name || tacticId}`,
          callback_data: `pvp_tactic:${stageKey}:${tacticId}`,
        })),
      ];
  return {
    inline_keyboard: [
      ...rows,
      ...tacticRows,
      [
        { text: "▶️ Старт", callback_data: "pvp_boost:start" },
      ],
    ],
  };
}

function formatPvpActiveDuelText(activeDuel: any) {
  if (activeDuel?.awaitingStart) {
    const remainingSec = Math.max(0, Math.ceil(Number(activeDuel?.preparationRemainingMs || 0) / 1000));
    const shopLines = getPvpDailyBoostCatalog().map((boost) => `• ${boost.name}: ${boost.description}`);
    const conceptTactic = activeDuel?.myTactics?.concept || "stability";
    const tacticLines = [
      "Тактики:",
      "• ⚡ Темп — +4% к первому навыку, -3% ко второму навыку соперника",
      "• 🎯 Качество — +4% ко второму навыку, -3% к первому навыку соперника",
      "• 🛡 Стабильность — +2% к обоим навыкам, негативные события слабее",
      "• 🔥 Давление — -2.5% к обоим навыкам соперника",
    ];
    return [
      "[PRE-DUEL SHOP]",
      `${activeDuel?.myName || "Ты"} vs ${activeDuel?.opponentName || "Соперник"}`,
      "Матч найден. Перед стартом можно выбрать 1 PvP-предмет и тактику на первый раунд.",
      `Автостарт через: ${remainingSec} сек.`,
      "Раунды дуэли:",
      "1. Проектирование — Design + Analytics",
      "2. Разработка — Coding + Attention",
      "3. Отладка — Testing + Analytics",
      `Текущая тактика на 1-й раунд: ${getPvpTacticDefinition(conceptTactic)?.name || conceptTactic}`,
      "",
      ...tacticLines,
      "",
      ...shopLines,
      activeDuel?.myGadgetName ? `Твой гаджет: ${activeDuel.myGadgetName}` : "",
      "",
      `Текущий лог: > ${activeDuel?.latestLog || "Матч найден. Выбери предмет и тактику на стартовый раунд."}`,
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
      label: "Проектирование",
      description: "Раунд проектирования завершён.",
    },
    core: {
      label: "Разработка",
      description: "Раунд разработки завершён.",
    },
    tests: {
      label: "Отладка",
      description: "Раунд отладки завершён.",
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
      `   ${String(isPlayerA ? round?.explanationA || "" : round?.explanationB || "")}`.trim(),
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
    if (status?.access && !status.access.ok) {
      return [
        "⚔️ PvP Arena",
        "━━━━━━━━━━━━━━",
        String(status.accessMessage || getPvpAccessMessage(status.access.reason || "level")),
      ].join("\n");
    }
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
      status?.boostRotation?.title ? `Ротация PvP-магазина: ${String(status.boostRotation.title)}` : "",
      "",
      "Награды PvP:",
      "• Победа может принести редкую или эпическую деталь",
      "• Поражение тоже может дать базовую деталь",
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

function getPvpInlineMarkup(activeDuel?: any) {
  if (activeDuel?.awaitingStart) {
    return buildPvpPreparationInlineKeyboard(activeDuel);
  }
  return buildPvpRoundInlineKeyboard(activeDuel) ?? { inline_keyboard: [] };
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
    return "Ты не состоишь в компании. Нажми кнопку «🏢 Компания».";
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
  const items = listShopItems(snapshot.user.city);
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
      if (tab === "gadgets") {
        return [
          `${index + 1}. ${item.name}`,
          `${formatShopGearPreview({
            rarity: item.rarity,
            stats: item.stats as Record<string, number>,
            category: (item as any).category,
            branch: (item as any).branch,
            generation: (item as any).generation,
            requiredLevel: (item as any).requiredLevel,
            quality: (item as any).quality,
            reliability: (item as any).reliability,
            wearRate: (item as any).wearRate,
            repairCost: (item as any).repairCost,
            specialEffect: (item as any).specialEffect,
          })}`,
          `${currency}${item.price} (${formatRarityLabel(String(item.rarity || "Common"))}) ${afford}`,
        ].join("\n");
      }
      return `${index + 1}. ${item.name}\n${currency}${item.price} (${formatRarityLabel(String(item.rarity || "Common"))}) ${afford}${minLevelLine}\n${formatStats(item.stats)}`;
    }),
    "",
    "Покупка: выбери товар кнопкой ниже или просто отправь его номер.",
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
      const durability = item.type === "gadget" || item.type === "gear"
        ? `, состояние: ${Math.max(0, Math.round(item.condition ?? item.durability ?? 0))}/${Math.max(1, Math.round(item.maxCondition ?? item.maxDurability ?? 100))}, статус: ${getGadgetConditionStatusLabel(item)}, надёжность: ${Math.round(Number(item.reliability ?? 1) * 100)}%${item.isBroken ? ", сломан" : ""}`
        : "";
      let actionLine = "";
      if (item.type === "gear") {
        const maxDurability = Math.max(1, Math.round(item.maxCondition ?? item.maxDurability ?? 100));
        const durabilityNow = Math.max(0, Math.round(item.condition ?? item.durability ?? maxDurability));
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
        if (durabilityNow < maxDurability) {
          actions.push({
            kind: "service",
            index: itemIndex,
            ref: item.id,
            itemName: item.name,
          });
          actionLine = `${actionLine}  🔧 /service_${itemIndex}`;
        }
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
      const displayName = item.type === "part" ? formatInventoryPartName(item) : item.name;
      const detailsLine = item.type === "gadget" || item.type === "gear"
        ? formatCompactInventoryGadgetInfo(item)
        : item.type === "part"
          ? formatNonZeroStats(item.stats)
          : `${formatStats(item.stats)}`;
      return [
        `${itemIndex}. ${displayName} x${Math.max(1, item.quantity || 1)} [${ITEM_TYPE_LABELS[item.type]}${equipped}]${durability}${actionLine ? `  ${actionLine}` : ""}`,
        detailsLine,
      ].filter(Boolean).join("\n");
    }),
    "",
    "ℹ️ Надеть можно только один предмет каждого типа одновременно.",
    "Также доступны: /use <номер>, /equip <номер>, /service <номер>, /scrap <номер>",
  ].join("\n\n");

  return { text, refs, actions };
}

function getInventoryActionButtonText(action: InventoryAction) {
  if (action.kind === "inspect") return `${action.index}. ℹ️ Карточка`;
  if (action.kind === "use") return `${action.index}. ⚡ Использовать`;
  if (action.kind === "service") return `${action.index}. 🔧 Обслужить`;
  if (action.kind === "scrap") return `${action.index}. ♻️ Разобрать`;
  return action.isEquipped
    ? `${action.index}. ⚪ Снять`
    : `${action.index}. 🟢 Надеть`;
}

function buildInventoryItemDetailText(item: GameInventoryItem, index: number) {
  const lines = [
    `ℹ️ Карточка предмета #${index}`,
    `${item.name}${(item.type === "gear" || item.type === "gadget") && item.isEquipped ? " (надето)" : ""}`,
    "",
  ];

  if (item.type === "gear" || item.type === "gadget") {
    lines.push(formatGadgetInfoBlock(item));
  } else {
    const statsText = item.type === "part" ? formatNonZeroStats(item.stats) : formatStats(item.stats);
    if (statsText) {
      lines.push(`Характеристики: ${statsText}`);
    }
  }

  if (item.type === "consumable") {
    lines.push("", "Действие: можно использовать кнопкой ниже.");
  } else if (item.type === "part") {
    lines.push("", "Действие: запчасть используется в крафте и разработке.");
  } else {
    const maxCondition = Math.max(1, Math.round(item.maxCondition ?? item.maxDurability ?? 100));
    const currentCondition = Math.max(0, Math.round(item.condition ?? item.durability ?? maxCondition));
    const repairCost = getGadgetRepairCost({
      type: item.type,
      repairCost: item.repairCost,
      quality: item.quality,
      condition: currentCondition,
      maxCondition,
      isBroken: Boolean(item.isBroken),
      basePrice: item.basePrice,
    });
    lines.push("", `Ремонт сейчас: ${repairCost}`);
  }

  return lines.join("\n");
}

function buildInventoryItemDetailInlineButtons(item: GameInventoryItem, index: number) {
  const rows: Array<Array<{ text: string; callback_data: string }>> = [];

  if (item.type === "consumable") {
    rows.push([{ text: "⚡ Использовать", callback_data: `inv:use:${index}` }]);
  }

  if (item.type === "gear" || item.type === "gadget") {
    if (!item.isBroken) {
      rows.push([{
        text: item.isEquipped ? "⚪ Снять" : "🟢 Надеть",
        callback_data: `inv:equip:${index}`,
      }]);
    }
    const maxCondition = Math.max(1, Math.round(item.maxCondition ?? item.maxDurability ?? 100));
    const currentCondition = Math.max(0, Math.round(item.condition ?? item.durability ?? maxCondition));
    if (currentCondition < maxCondition) {
      rows.push([{ text: "🔧 Починить", callback_data: `inv:service:${index}` }]);
    }
    if (item.type === "gadget" && item.isBroken) {
      rows.push([{ text: "♻️ Разобрать", callback_data: `inv:scrap:${index}` }]);
    }
  }

  rows.push([{ text: "⬅️ К инвентарю", callback_data: "inv:open" }]);
  return { inline_keyboard: rows };
}

function buildInventoryInlineButtons(view: InventoryMenuView) {
  const rows: Array<Array<{ text: string; callback_data: string }>> = [];
  const maxButtons = 12;

  const grouped = new Map<number, InventoryAction[]>();
  for (const action of view.actions) {
    const current = grouped.get(action.index) ?? [];
    current.push(action);
    grouped.set(action.index, current);
  }

  for (const index of [...grouped.keys()].sort((a, b) => a - b).slice(0, maxButtons)) {
    const actions = grouped.get(index) ?? [];
    const inspect = actions.find((action) => action.kind === "inspect");
    const primary = actions.find((action) => action.kind === "equip" || action.kind === "use");
    const secondary = actions.find((action) => action.kind === "service" || action.kind === "scrap");
    const row: Array<{ text: string; callback_data: string }> = [];
    if (inspect) {
      row.push({
        text: getInventoryActionButtonText(inspect),
        callback_data: `inv:${inspect.kind}:${inspect.index}`,
      });
    }
    if (primary) {
      row.push({
        text: getInventoryActionButtonText(primary),
        callback_data: `inv:${primary.kind}:${primary.index}`,
      });
    }
    if (secondary) {
      row.push({
        text: getInventoryActionButtonText(secondary),
        callback_data: `inv:${secondary.kind}:${secondary.index}`,
      });
    }
    if (row.length) rows.push(row);
  }

  rows.push([{ text: "🔄 Обновить инвентарь", callback_data: "inv:open" }]);
  return { inline_keyboard: rows };
}

function buildShopPurchaseInlineMarkup(item: Pick<GameInventoryItem, "id" | "type" | "name"> & { price?: number }) {
  if (item.type === "consumable") {
    return {
      inline_keyboard: [[{ text: "⚡ Использовать", callback_data: `shopbuy:use:${item.id}:${Math.max(0, Number(item.price || 0))}` }]],
    };
  }
  if (item.type === "gear") {
    return {
      inline_keyboard: [[{ text: "🟢 Надеть", callback_data: `shopbuy:equip:${item.id}:${Math.max(0, Number(item.price || 0))}` }]],
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
        { text: selected("players", "level", "👤 Ур"), callback_data: "rating:players:level" },
        { text: selected("players", "reputation", "👤 Реп"), callback_data: "rating:players:reputation" },
        { text: selected("players", "wealth", "👤 $"), callback_data: "rating:players:wealth" },
      ],
      [
        { text: selected("players", "pvp", "👤 PvP"), callback_data: "rating:players:pvp" },
      ],
      [
        { text: selected("companies", "level", "🏢 Ур"), callback_data: "rating:companies:level" },
        { text: selected("companies", "wealth", "🏢 GRM"), callback_data: "rating:companies:wealth" },
        { text: selected("companies", "blueprints", "🏢 📐"), callback_data: "rating:companies:blueprints" },
      ],
    ],
  };
}

function formatBankProgramsMenu(type: BankProductType, snapshot: Snapshot) {
  const programs = type === "credit" ? listCreditPrograms(snapshot.user.city) : listDepositPrograms(snapshot.user.city);
  const currency = getCurrencySymbol(snapshot.user.city);
  return [
    type === "credit"
      ? "🏦 Кредиты\n\nКредит даёт деньги сразу, чтобы быстрее купить гаджет, расходник или усилить подготовку к PvP. Потом сумму нужно вернуть с процентами."
      : "🏦 Вклады\n\nВклад позволяет либо спокойно приумножить деньги, либо рискнуть ради большей прибыли, либо подготовить временный бонус к PvP.",
    ...programs.map((program, index) =>
      `${index + 1}. ${program.name}\nУровень: ${program.minLevel}+ | Время: ${formatDurationShort(program.durationMinutes * 60_000)}\nСумма: ${currency}${program.minAmount}-${currency}${program.maxAmount}\n${program.description}${
        type === "credit"
          ? `\nВозврат: ${program.interest}% сверху`
          : program.depositKind === "safe"
            ? `\nДоход: +${Math.round(Number(program.interest || 0))}%`
            : program.depositKind === "risky"
            ? `\nШанс успеха: ${Math.round(Number(program.riskySuccessChance || 0) * 100)}% | Доход: до +${Math.round(Number(program.riskyInterest || 0))}%`
              : `\nБонус после завершения: +${Math.round(Number(program.pvpRewardBonusPct || 0) * 100)}% к репутации PvP, +${Math.round(Number(program.pvpXpBonusPct || 0) * 100)}% XP, +${Math.round(Number(program.pvpRatingBonusFlat || 0))} рейтинга`
      }`
    ),
    "",
    "Выбери программу кнопкой или ответь сообщением: <номер> <сумма>",
    "Пример ответа: 1 800",
  ].join("\n\n");
}

function buildShopSelectionInlineMarkup(snapshot: Snapshot, tab: ShopMenuTab) {
  if (tab !== "parts" && tab !== "gadgets") return undefined;
  const items = listShopItems(snapshot.user.city).filter((item) => tab === "parts" ? item.type === "consumable" : item.type === "gear");
  if (!items.length) return undefined;
  const rows: Array<Array<{ text: string; callback_data: string }>> = [];
  for (let index = 0; index < items.length; index += 2) {
    const pair = items.slice(index, index + 2).map((item, pairIndex) => ({
      text: `${index + pairIndex + 1}`,
      callback_data: `shop:pick:${item.id}`,
    }));
    rows.push(pair);
  }
  return { inline_keyboard: rows };
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
  const status = check.canUpgrade ? "✅ Доступно" : `⛔ ${check.reason ?? "Недоступно"}`;
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
    "📘 Открыть обучение: /tutorial",
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
  return `🎓 Обучение: ${event.progressText}. Следующий шаг: ${event.stepContent?.title ?? "см. раздел «Обучение»"}.${rewardText} Продолжай через «/tutorial».`;
}

function formatShopPurchaseResultText(input: {
  itemName: string;
  balance: number;
  city: string;
  price: number;
  tutorialAdvance?: TutorialEventApiResult | null;
  equipped?: boolean;
  bonusesText?: string;
  used?: boolean;
}) {
  const currency = getCurrencySymbol(input.city);
  const lines = [
    `${input.used ? "✅ Куплено и использовано" : input.equipped ? "✅ Куплено и надето" : "✅ Куплено"}: ${input.itemName}`,
    `-${currency}${formatNumber(input.price)}`,
    input.bonusesText ? `Бонусы: ${input.bonusesText}` : "",
    "",
    `💰 Баланс: ${currency}${formatNumber(input.balance)}`,
  ];
  const tutorialNotice = formatTutorialAdvanceNotice(input.tutorialAdvance ?? null, input.city);
  if (tutorialNotice) {
    lines.push("", tutorialNotice);
  }
  return lines.join("\n");
}

async function getTutorialContinueLine(userId: string): Promise<string | null> {
  try {
    const snapshot = await getTutorialSnapshotByUser(userId);
    if (snapshot.state.isCompleted) return null;
    return "‼️ Обучение не завершено: продолжи через /tutorial.";
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
    upgradeCandidates?: any[];
    productionOrder?: CompanyBlueprintSnapshot["productionOrder"] | null;
  };
}

async function previewCompanyExclusiveUpgrade(
  companyId: string,
  userId: string,
  gadgetId: string,
  seedParts: Array<{ id: string; rarity: string; type: string; name?: string }>,
) {
  return await callInternalApi("POST", `/api/companies/${companyId}/exclusive/preview`, {
    userId,
    gadgetId,
    seedParts,
  }) as {
    blueprint: any;
    companyBalanceAfterStart?: number;
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
  blueprintButtons: Array<{ id: string; label: string }> = [],
) {
  if (activeStatus === "in_progress") {
    return buildCompanyInlineMenu([]);
  }
  const rows: Array<Array<{ text: string; callback_data: string }>> = [];
  if (isOwner && blueprintButtons.length) {
    rows.push(...blueprintButtons.slice(0, 12).map((item, index) => ([{
      text: `${index + 1}. ${item.label}`,
      callback_data: `company:bp_start:${item.id}`,
    }])));
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

function buildCompanyExclusiveStartInlineMarkup(
  snapshot: Awaited<ReturnType<typeof getCompanyExclusiveSnapshot>>,
) {
  const candidates = Array.isArray(snapshot.upgradeCandidates) ? snapshot.upgradeCandidates : [];
  const rows = candidates.slice(0, 20).map((item: any) => [
    {
      text: `${item.name}${item.exclusiveLevel ? ` · EX+${item.exclusiveLevel}` : ""} · x${Math.max(1, Number(item.availableQuantity || 1))}`,
      callback_data: `company:exclusive_pick:${item.id}`,
    },
  ]);
  return { inline_keyboard: rows };
}

function buildCompanyProductionConfirmInlineMarkup(kind: "standard" | "exclusive") {
  return {
    inline_keyboard: [
      [{ text: "✅ Запустить партию", callback_data: kind === "standard" ? "company:bp_confirm_start" : "company:exclusive_confirm_start" }],
      [{ text: "⬅️ Изменить количество", callback_data: kind === "standard" ? "company:bp_confirm_back" : "company:exclusive_confirm_back" }],
    ],
  };
}

function buildCompanyExclusiveUpgradeConfirmInlineMarkup() {
  return {
    inline_keyboard: [
      [{ text: "✅ Запустить EX-апгрейд", callback_data: "company:exclusive_upgrade_start" }],
      [{ text: "⬅️ Изменить детали", callback_data: "company:exclusive_upgrade_back" }],
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
  const warehouseFilter = getCompanyWarehouseFilter(chatId);
  const filteredWarehouseParts = warehouseParts.filter((part) => matchesWarehouseDeviceFilter(part, warehouseFilter));
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
      filteredWarehouseParts.map((part, index) => `p${index + 1}`),
    );
  }
  const filterLabel = warehouseFilter
    ? COMPANY_WAREHOUSE_DEVICE_FILTERS.find((item) => item.key === warehouseFilter)?.label ?? warehouseFilter
    : "Все категории";
  const partLabel = filteredWarehouseParts.length
    ? filteredWarehouseParts.map((part, index) => formatWarehousePartLine(part, index)).join("\n")
    : warehouseParts.length
      ? "Для выбранного типа гаджета запчастей на складе нет."
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
            `${index + 1}. ${representative.name} x${quantity} [Гаджет]`,
            formatCompactInventoryGadgetInfo(representative),
            representative.exclusiveLevel ? `EX: +${representative.exclusiveLevel}` : "",
            representative.exclusiveBonusLabel ? `Бонус: ${representative.exclusiveBonusLabel}` : "",
            `Цена: ${formatNumber(Number(representative.minPrice || 0))}-${formatNumber(Number(representative.maxPrice || 0))}`,
          ].filter(Boolean).join("\n")
        ).join("\n\n")
      : "Гаджетов на складе нет.",
    "",
    "🧩 Запчасти:",
    `Фильтр: ${filterLabel}`,
    partLabel,
    "",
    "📐 Разработанные чертежи:",
    blueprintLabel,
    "",
    "Открыть перенос: /company_part_deposit",
    "Быстрый пример: /company_part_deposit 1 3",
    "Продажа со склада: /company_part_sell",
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
  const visibleBlueprints = unlockedBlueprints.map((blueprint) => {
    const owner = companyBlueprintGlobalOwnerByBlueprintId.get(String(blueprint.id || "").trim()) ?? null;
    const lockedByOtherCompany = Boolean(owner && owner.companyId !== input.company.id);
    return { blueprint, owner, lockedByOtherCompany };
  });
  const availableBlueprintButtons = visibleBlueprints
    .filter((entry) => !entry.lockedByOtherCompany)
    .map((entry) => {
      const catalogBlueprint = GADGET_BLUEPRINTS.find((item) => item.id === entry.blueprint.id);
      return {
        id: entry.blueprint.id,
        label: `${getGadgetCategoryEmoji(catalogBlueprint?.category)} ${entry.blueprint.name}`,
      };
    });
  companyBlueprintRefsByChatId.set(chatId, availableBlueprintButtons.map((entry) => entry.id));

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
    snapshot.active?.participantUserIds?.length ? `Участники: ${snapshot.active.participantUserIds.length}` : "",
    snapshot.active?.estimatedFinishAt
      ? snapshot.active.estimatedFinishAt <= Date.now()
        ? "ETA: почти готово"
        : `ETA: ~${formatDurationShort(Math.max(0, Number(snapshot.active.estimatedFinishAt) - Date.now()))}`
      : snapshot.active?.status === "in_progress"
        ? "ETA: нужен участник с подходящими навыками"
        : "",
    snapshot.productionOrder
      ? `Производство: ${snapshot.productionOrder.blueprintName} x${snapshot.productionOrder.quantity} (${snapshot.productionOrder.status === "ready_to_claim" ? "готово к выдаче" : `ещё ${formatProductionOrderRemaining(snapshot.productionOrder)}`})`
      : "Производство: нет активной партии",
    exclusiveSnapshot?.active
      ? `Эксклюзив: ${exclusiveSnapshot.active.blueprint?.targetGadgetName ?? exclusiveSnapshot.active.blueprint?.name ?? "апгрейд"} (${exclusiveSnapshot.active.status})`
      : "Эксклюзив: нет активного EX-апгрейда",
    snapshot.active ? `Прогресс: ${snapshot.active.progressHours}ч` : "",
    activeBlueprint?.time ? `Нужно: ${activeBlueprint.time}ч` : "",
    "",
    visibleBlueprints.length
      ? [
          "Доступные чертежи:",
          ...visibleBlueprints.map(({ blueprint: bp, owner, lockedByOtherCompany }, index) => {
            const catalogBlueprint = GADGET_BLUEPRINTS.find((item) => item.id === bp.id);
            const generation = Math.max(1, Number(catalogBlueprint?.generation || 1));
            const recipeLine = formatBlueprintRecipeCompactLine(bp);
            return [
              `┏ ${index + 1}. ${getGadgetCategoryEmoji(catalogBlueprint?.category)} ${bp.name}${generation === 1 ? " • стартовый" : ""}${lockedByOtherCompany ? " 🔒" : ""}`,
              `┣ ${formatGadgetCategoryLabel(catalogBlueprint?.category)} • ${formatGadgetBranchLabel(catalogBlueprint?.branch)} • Gen ${generation}`,
              `┣ ${requirementsLabel(bp.requirements)} • запуск ${formatNumber(Math.max(1, Math.round(Number(bp.production?.costGram || 0) * 25)))} GRM`,
              recipeLine ? `┣ Рецепт: ${recipeLine}` : "",
              lockedByOtherCompany ? `┣ Уже разработан: ${formatGlobalBlueprintOwnerLabel(owner)}` : "",
              "┗",
            ].filter(Boolean).join("\n");
          }),
        ].join("\n")
      : "Нет доступных чертежей. Разработай базовую модель, чтобы открыть следующее поколение.",
    "",
    input.role === "owner"
      ? "Выбери чертёж кнопкой ниже. Эксклюзивы открываются в отдельном разделе компании."
      : "Бюро в режиме просмотра. Управление доступно CEO.",
  ].filter(Boolean).join("\n"),
    snapshot,
    miningStatus,
    blueprintButtons: availableBlueprintButtons,
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

  const memberButtons = rows.map(({ index }) => [{
    text: `💸 ${index + 1}`,
    callback_data: `company:salary_pick_ref:${index + 1}`,
  }]);

  const extraRows = input.role === "owner"
    ? memberButtons
    : [[{ text: "💰 Получить зарплату", callback_data: "company:salary_claim" }]];
  return buildCompanyInlineMenu([
    ...extraRows,
    [{ text: "⬅️ Назад в управление", callback_data: "company:management" }],
  ]);
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
    "CEO тоже можно назначить в отдел.",
    "Выбери сотрудника кнопкой ниже, затем выбери отдел.",
  ].join("\n\n");
}

function buildCompanyStaffingInlineMarkup(chatId: number, role: string | null | undefined) {
  const memberRefs = companyMemberRefsByChatId.get(chatId) ?? [];
  const memberButtons = memberRefs.map((_, index) => ([{
    text: `👤 ${index + 1}`,
    callback_data: `company:staff_pick_ref:${index + 1}`,
  }]));
  return buildCompanyInlineMenu([
    ...memberButtons,
    [{ text: "⬅️ Назад в управление", callback_data: "company:management" }],
  ]);
}

function buildCompanyDepartmentSelectInlineMarkup(memberRef: string, role: string | null | undefined, chatId: number) {
  const deptRows = COMPANY_DEPARTMENT_ORDER.map((departmentKey) => ([{
    text: `${COMPANY_DEPARTMENT_EMOJIS[departmentKey]} ${DEPARTMENT_LABELS[departmentKey]}`,
    callback_data: `company:staff_assign_ref:${memberRef}:${departmentKey}`,
  }]));
  return buildCompanyInlineMenu([
    ...deptRows,
    [{ text: "⬅️ Назад в HR", callback_data: "company:staffing" }],
  ]);
}

function formatCompanyDepartmentChoiceHelp() {
  return [
    "Кратко по отделам:",
    "🧪 Backend Core: сильнее помогает разработке чертежей, ускоряет R&D.",
    "🏭 Platform & Delivery: лучше для производства и выпуска гаджетов.",
    "📣 Product Design: усиливает дизайн, качество и спрос на гаджеты.",
    "💼 Analytics Office: помогает аналитике, прибыли и решениям компании.",
    "🏗 QA & Security: усиливает стабильность, защиту и инфраструктуру.",
  ].join("\n");
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
  const upgradeCandidates = Array.isArray(snapshot.upgradeCandidates) ? snapshot.upgradeCandidates : [];
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
        `Активный апгрейд: ${snapshot.active.blueprint?.targetGadgetName ?? snapshot.active.blueprint?.name ?? "без имени"}`,
        `Статус: ${snapshot.active.status === "in_progress" ? "идёт апгрейд" : snapshot.active.status === "production_ready" ? "готов к выпуску" : "провал"}`,
        snapshot.active.readyAt
          ? `До результата: ${formatDurationShort(Math.max(0, Number(snapshot.active.readyAt || 0) - Date.now()))}`
          : `Общая готовность: ${research.percent}%`,
        snapshot.active.blueprint?.upgradeLevel ? `Целевой уровень: EX+${snapshot.active.blueprint.upgradeLevel}` : "",
        `Шанс успеха: ${Math.round(Number(snapshot.active.blueprint?.successChance || 0) * 100)}%`,
        `Стоимость запуска: ${formatNumber(Number(snapshot.active.blueprint?.developmentCostGrm || 0))} GRM`,
        `Бонус апгрейда: ${snapshot.active.blueprint?.bonusLabel ?? "—"}`,
      ].join("\n")
    : "Активной эксклюзивной разработки нет.";

  const productionText = snapshot.productionOrder?.isExclusive
    ? `Активная партия: ${snapshot.productionOrder.blueprintName} x${snapshot.productionOrder.quantity} (${snapshot.productionOrder.status === "ready_to_claim" ? "готово к выдаче" : `ещё ${formatProductionOrderRemaining(snapshot.productionOrder)}`})`
    : "Активной партии эксклюзивов нет.";

  const catalogText = snapshot.catalog?.length
    ? snapshot.catalog.map((item, index) =>
        `${index + 1}. ${item.name}\n${item.flavor}\nБонус: ${item.bonusLabel}\nЛимит: ${item.remainingUnits}/${item.totalUnits} | Выпуск: ${item.productionCostGram} GRM`
      ).join("\n\n")
    : "Готовых EX-апгрейдов пока нет.";

  const candidatesText = upgradeCandidates.length
    ? upgradeCandidates.map((item, index) => `${index + 1}. ${item.name}${item.exclusiveLevel ? ` (EX+${item.exclusiveLevel})` : ""} x${Math.max(1, Number(item.availableQuantity || 1))}`).join("\n")
    : `На складе компании нет партий из ${EXCLUSIVE_UPGRADE_REQUIRED_GADGETS}+ одинаковых обычных гаджетов для EX-апгрейда.`;

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
    "Гаджеты для апгрейда:",
    candidatesText,
    "",
    `Баланс компании: ${formatNumber(Number(input.company.balance || 0))} GRM`,
    "",
    "Детали склада компании:",
    partsText,
    warehouseParts.length > COMPANY_EXCLUSIVE_PARTS_PAGE_SIZE ? `Страница: ${currentPage + 1}/${totalPages}` : "",
    "",
    `Выбрано деталей: ${selectedRefs.length}/${EXCLUSIVE_UPGRADE_REQUIRED_PARTS}`,
    selectedText,
    "",
    isPickingParts
      ? "Выбор деталей: кнопками под сообщением."
      : "Кнопки ниже: Старт / Прогресс / Выпуск",
    isPickingParts
      ? `Когда выберешь ${EXCLUSIVE_UPGRADE_REQUIRED_PARTS} деталей, нажми «🚀 Готово» или «⬅️ Назад».`
      : `Для запуска нужна партия из ${EXCLUSIVE_UPGRADE_REQUIRED_GADGETS} одинаковых обычных гаджетов и ${EXCLUSIVE_UPGRADE_REQUIRED_PARTS} подходящих деталей.`,
  ].join("\n");
}

function formatExclusiveBlueprintSummary(blueprint: any) {
  if (!blueprint) return "Характеристики: —";
  if (blueprint.targetGadgetId) {
    const statText = Object.entries(blueprint.baseStats || {})
      .map(([key, value]) => `+${formatNumber(Number(value || 0))} ${key}`)
      .join(", ");
    return [
      `Базовый гаджет: ${blueprint.targetGadgetName || "—"}`,
      `Цель: EX+${Math.max(1, Number(blueprint.upgradeLevel || 1))}`,
      `Нужно гаджетов: ${Math.max(1, Number(blueprint.requiredGadgetCount || EXCLUSIVE_UPGRADE_REQUIRED_GADGETS))}`,
      `Нужно деталей: ${Math.max(0, Number(blueprint.requiredPartCount || EXCLUSIVE_UPGRADE_REQUIRED_PARTS))}`,
      `Тип деталей: ${blueprint.requiredPartType || "подходящие по категории"}`,
      `Характеристики после апгрейда: ${statText || "—"}`,
      `Шанс успеха: ${Math.round(Number(blueprint.successChance || 0) * 100)}%`,
      `Запуск: ${formatNumber(Number(blueprint.developmentCostGrm || 0))} GRM компании`,
    ].join("\n");
  }
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
  if (project?.targetGadget || project?.blueprint?.targetGadgetId) {
    const remainingMs = Math.max(0, Number(project?.readyAt || 0) - Date.now());
    return [
      "🌟 ЭКСКЛЮЗИВНЫЙ АПГРЕЙД",
      "━━━━━━━━━━━━━━",
      `Гаджет: ${project?.blueprint?.targetGadgetName ?? project?.targetGadget?.name ?? "без имени"}`,
      `Целевой уровень: EX+${Math.max(1, Number(project?.blueprint?.upgradeLevel || 1))}`,
      `Статус: ${project?.status === "in_progress" ? "идёт улучшение" : project?.status === "production_ready" ? "готов к выпуску" : "провал"}`,
      `Шанс успеха: ${Math.round(Number(project?.blueprint?.successChance || 0) * 100)}%`,
      `Осталось: ${remainingMs > 0 ? formatDurationShort(remainingMs) : "0 сек"}`,
      formatExclusiveBlueprintSummary(project?.blueprint),
    ].join("\n");
  }
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

function getExclusiveCompatiblePartTypesForCategory(category: string) {
  const normalized = String(category || "").trim().toLowerCase();
  if (normalized === "smartphones" || normalized === "smartphone") {
    return ["processor", "display", "camera", "battery", "motherboard", "case"];
  }
  if (normalized === "smartwatches" || normalized === "smartwatch") {
    return ["strap", "display", "battery", "controller", "case"];
  }
  if (normalized === "tablets" || normalized === "tablet") {
    return ["processor", "memory", "display", "camera", "battery", "motherboard", "storage", "case"];
  }
  if (normalized === "laptops" || normalized === "laptop") {
    return ["processor", "memory", "display", "battery", "motherboard", "storage", "cooling", "case"];
  }
  if (normalized === "asic_miners" || normalized === "asic") {
    return ["asic_chip", "cooling", "power", "controller", "case"];
  }
  return [];
}

function formatExclusivePartRequirementsBlock(category?: string) {
  const partTypes = getExclusiveCompatiblePartTypesForCategory(String(category || ""));
  if (!partTypes.length) {
    return `Нужно выбрать ${EXCLUSIVE_UPGRADE_REQUIRED_PARTS} подходящих деталей со склада компании.`;
  }
  const labels = partTypes.map((type) => String(Object.values(ALL_PARTS).find((part) => part.type === type)?.type || type))
    .map((type) => {
      const localized: Record<string, string> = {
        processor: "процессоры",
        memory: "память",
        display: "дисплеи",
        battery: "батареи",
        motherboard: "материнские платы",
        case: "корпуса",
        cooling: "охлаждение",
        controller: "контроллеры",
        asic_chip: "ASIC-чипы",
        camera: "камеры",
        storage: "накопители",
        strap: "ремешки",
        power: "блоки питания",
      };
      return localized[type] ?? type;
    });
  return [
    `Для EX-апгрейда нужно:`,
    `• ${EXCLUSIVE_UPGRADE_REQUIRED_GADGETS} одинаковых обычных гаджетов этой модели`,
    `• ${EXCLUSIVE_UPGRADE_REQUIRED_PARTS} деталей подходящих типов`,
    `Подходящие детали: ${labels.join(", ")}`,
  ].join("\n");
}

async function sendCompanyExclusivePartsPicker(
  token: string,
  chatId: number,
  membership: CompanyContext,
  playerId: string,
  gadgetName: string,
  gadgetCategory?: string,
  gadgetBatchAvailable?: number,
  messageId?: number,
) {
  const text = [
    `🧩 Апгрейд гаджета: ${gadgetName}`,
    `Доступно одинаковых гаджетов модели: x${Math.max(1, Number(gadgetBatchAvailable || 1))}`,
    formatExclusivePartRequirementsBlock(gadgetCategory),
    "Выбирай детали кнопками ниже.",
    `Когда наберёшь ${EXCLUSIVE_UPGRADE_REQUIRED_PARTS} деталей, нажми «Готово».`,
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
  gadgetId?: string,
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
    `🧠 Запускаем апгрейд "${gadgetName}"...\nПроверяем детали, шанс успеха и время улучшения.`,
    { reply_markup: buildCompanyReplyMarkup(membership.role, chatId) },
  );

  try {
    const project = await callInternalApi("POST", `/api/companies/${membership.company.id}/exclusive/start`, {
      userId: playerId,
      name: gadgetName,
      gadgetId,
      partRefs: selectedRefs,
      seedParts: selectedSeedParts,
    }) as any;
    await sendMessage(
      token,
      chatId,
      `🧠 Апгрейд "${gadgetName}" запущен.\nТеперь улучшение идёт по времени. Нажимай «Прогресс», чтобы проверять статус и результат.\n\n${formatExclusiveProgressLiveText(project)}`,
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
            "🌟 В компании начался эксклюзивный апгрейд",
            `Компания: ${membership.company.name}`,
            `Гаджет: ${gadgetName}`,
            "CEO запустил улучшение существующего гаджета до EX-версии.",
          ].join("\n"),
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
        "CEO уже добавлен в проект.",
        "Сотрудники компании могут присоединиться и вкладывать навыки каждые 5 секунд.",
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
    await sendMessage(token, chatId, `❌ ${extractErrorMessage(error)}`);
  }
}

function formatExclusiveProduceMenu(snapshot: Awaited<ReturnType<typeof getCompanyExclusiveSnapshot>>) {
  const catalog = snapshot.catalog ?? [];
  if (!catalog.length) {
    return "🏭 ВЫПУСК EX-АПГРЕЙДОВ\n━━━━━━━━━━━━━━\nГотовых EX-апгрейдов пока нет.";
  }
  return [
    "🏭 ВЫПУСК EX-АПГРЕЙДОВ",
    "━━━━━━━━━━━━━━",
    ...catalog.map((item, index) => [
      `${index + 1}. ${item.name}`,
      item.targetGadgetName ? `База: ${item.targetGadgetName}` : `Нужно запчастей: ${Math.max(1, Number(item.seedParts?.length || 0))}`,
      `Нужно GRM компании: ${item.productionCostGram}`,
      `Время производства: ~${item.targetGadgetId ? "8 мин" : `${Math.max(5, Math.floor(Number(item.seedParts?.length || 1) * 6))} сек.`}`,
      `Лимит: ${item.remainingUnits}/${item.totalUnits}`,
    ].join("\n")),
    "",
    "Выбери готовый EX-апгрейд кнопкой ниже.",
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
  const viewMode = auctionViewModeByChatId.get(chatId) ?? "compact";
  return [
    "🏷 АУКЦИОН",
    "━━━━━━━━━━━━━━",
    ...listings.map((listing, index) => {
      const ownEarlyAccess = Date.now() - Number(listing.createdAt || 0) < 20 * 60 * 1000;
      const lockedText = ownEarlyAccess && membership?.company?.id !== listing.companyId
        ? "Первые 20 минут: только для компании-разработчика"
        : "";
      const title = listing.listingKind === "part"
        ? stripLeadingRarityBadgeFromName(String(listing.part?.name || listing.partName || "Запчасть"))
        : formatAuctionGadgetTitle(listing.gadget || { name: "Гаджет", category: undefined });
      const priceLine = listing.saleType === "auction"
        ? `Текущая ставка: ${formatAuctionPrice(Number(listing.currentBid || listing.startingPrice || 0))} GRM`
        : `Цена: ${formatAuctionPrice(Number(listing.price || 0))} GRM`;
      if (listing.listingKind === "gadget" && viewMode !== "full") {
        return [
          `${index + 1}. ${title}`,
          `${listing.companyName} • ${priceLine}`,
          `Характеристики: ${formatGadgetStatLine(listing.gadget?.stats) || "нет данных"}`,
          listing.saleType === "auction" ? `До завершения: ${formatAuctionTimeLeft(Number(listing.auctionEndsAt || 0))}` : "",
          lockedText,
        ].filter(Boolean).join("\n");
      }
      return [
        `${index + 1}. ${title}`,
        `Компания: ${listing.companyName} | ${listing.saleType === "auction" ? "Аукцион" : "Фиксированная цена"}`,
        listing.listingKind === "part"
          ? `Лот: запчасть ${formatRarityBadge(String(listing.part?.rarity || listing.partRarity || "Common"))}`
          : "",
        listing.gadget ? formatGadgetInfoBlock(listing.gadget) : "",
        listing.listingKind === "part" && listing.part?.type ? `Категория: ${listing.part.type}` : "",
        listing.gadget?.exclusiveBonusLabel ? `Бонус: ${listing.gadget.exclusiveBonusLabel}` : "",
        priceLine,
        listing.saleType === "auction" ? `До завершения: ${formatAuctionTimeLeft(Number(listing.auctionEndsAt || 0))}` : "",
        lockedText,
        listing.saleType === "auction"
          ? "Сделать ставку можно через кнопку или диалог аукциона."
          : "Покупка доступна через кнопку или диалог аукциона.",
      ].filter(Boolean).join("\n");
    }),
    "",
    viewMode === "full"
      ? "Команда: /auction_short — вернуть короткий вид"
      : "Команда: /auction_full — показать больше информации",
  ].join("\n\n");
}

async function formatCompanyAuctionSection(membership: CompanyContext, chatId: number) {
  const blueprintSnapshot = await getCompanyBlueprintSnapshot(membership.company.id);
  const warehouseGadgets = Array.isArray(blueprintSnapshot?.produced) ? blueprintSnapshot.produced : [];
  const warehouseParts = getCompanyWarehouseParts(membership.company.id);
  const groupedWarehouseGadgets = groupCompanyProducedGadgets(warehouseGadgets);
  companyWarehouseGadgetRefsByChatId.set(chatId, groupedWarehouseGadgets.map((item) => String(item.representative.id)));
  companyWarehousePartRefsByChatId.set(chatId, warehouseParts.map((item) => `${item.id}::${String(item.quality || item.rarity || "Common")}`));

  const listings = (await callInternalApi("GET", "/api/market") as any[]).slice(0, 8);
  marketListingRefsByChatId.set(chatId, listings.map((listing) => String(listing.id)));

  const gadgetLines = groupedWarehouseGadgets.length
    ? groupedWarehouseGadgets.slice(0, 8).map((group, index: number) => [
        `${index + 1}. ${formatAuctionGadgetTitle(group.representative)}${group.quantity > 1 ? ` x${group.quantity}` : ""}`,
        `Цена рынка: ${formatNumber(Number(group.representative.minPrice || 0))}-${formatNumber(Number(group.representative.maxPrice || 0))} GRM`,
        `Выставить: кнопкой ниже или /company_auction_list ${index + 1} <цена> [часы]`,
      ].join("\n"))
    : ["Гаджетов для продажи на складе нет."];

  const partLines = warehouseParts.length
    ? warehouseParts.slice(0, 8).map((part, index) => [
        `p${index + 1}. ${formatWarehousePartLine(part)}`,
        `Цена рынка: ${formatNumber(Math.max(10, Math.floor(getPartPrice(String(part.id || "")) * 0.85)))}-${formatNumber(Math.max(Math.max(10, Math.floor(getPartPrice(String(part.id || "")) * 0.85)), Math.ceil(getPartPrice(String(part.id || "")) * 2.4)))} GRM`,
        `Тип: ${formatPartTypeLabel(String(part.partType || part.type || ""))}`,
        `Выставить: кнопкой ниже или /company_auction_list p${index + 1} <цена> [часы]`,
      ].join("\n"))
    : ["Запчастей для продажи на складе нет."];

  const marketLines = listings.length
    ? listings.map((listing, index) => {
        const title = listing.listingKind === "gadget"
          ? formatAuctionGadgetTitle(listing.gadget || { name: "Гаджет", category: undefined })
          : stripLeadingRarityBadgeFromName(String(listing.part?.name || listing.partName || "Запчасть"));
        const quality = formatRarityBadge(String(listing.part?.quality || listing.part?.rarity || listing.partRarity || "Common"));
        const locked = Date.now() - Number(listing.createdAt || 0) < 20 * 60 * 1000 && String(listing.companyId || "") !== String(membership.company.id);
        const priceLabel = listing.saleType === "auction"
          ? `Ставка: ${formatAuctionPrice(Number(listing.currentBid || listing.startingPrice || 0))} GRM`
          : `Цена: ${formatAuctionPrice(Number(listing.price || 0))} GRM`;
        return [
          `${index + 1}. ${title}`,
          listing.listingKind === "gadget"
            ? `${formatGadgetCategoryLabel(String(listing.gadget?.category || ""))} • ${listing.saleType === "auction" ? "Аукцион" : "Фиксированная цена"}`
            : `${quality} • ${formatPartTypeLabel(String(listing.part?.partType || listing.part?.type || listing.partType || ""))}`,
          `Компания: ${listing.companyName}`,
          priceLabel,
          listing.saleType === "auction" ? `До завершения: ${formatAuctionTimeLeft(Number(listing.auctionEndsAt || 0))}` : "",
          locked ? "Первые 20 минут лот доступен только компании-разработчику." : "",
        ].join("\n");
      })
    : ["Сейчас на рынке нет активных лотов."];

  return [
    "🏷 АУКЦИОН КОМПАНИИ",
    "━━━━━━━━━━━━━━",
    "Выставление гаджетов:",
    ...gadgetLines,
    "",
    "Выставление запчастей:",
    ...partLines,
    "",
    "🛒 Лоты на рынке:",
    ...marketLines,
    "",
    "Покупка и ставки доступны кнопками ниже.",
  ].join("\n\n");
}

async function buildCompanyAuctionInlineMarkup(chatId: number, companyId: string) {
  const gadgetRefs = companyWarehouseGadgetRefsByChatId.get(chatId) ?? [];
  const partRefs = companyWarehousePartRefsByChatId.get(chatId) ?? [];
  const listingRefs = marketListingRefsByChatId.get(chatId) ?? [];
  const listings = (await callInternalApi("GET", "/api/market") as any[])
    .filter((listing) => listingRefs.includes(String(listing.id)));

  const rows: Array<Array<{ text: string; callback_data: string }>> = [];
  rows.push(...gadgetRefs.slice(0, 8).map((ref, index) => ([{
    text: `🏷 Гаджет ${index + 1}`,
    callback_data: `cauction:list:${index + 1}`,
  }])));
  rows.push(...partRefs.slice(0, 8).map((_, index) => ([{
    text: `🏷 Запчасть p${index + 1}`,
    callback_data: `cauction:list:p${index + 1}`,
  }])));
  rows.push(...listings.map((listing, index) => {
    const locked = Date.now() - Number(listing.createdAt || 0) < 20 * 60 * 1000
      && String(listing.companyId || "") !== String(companyId || "");
    if (locked) {
      return [{ text: `🔒 Лот ${index + 1}`, callback_data: "cauction:locked" }];
    }
    return [{
      text: `${listing.saleType === "auction" ? "💸" : "🛒"} Лот ${index + 1}`,
      callback_data: listing.saleType === "auction"
        ? `cauction:bid:${listing.id}`
        : `cauction:buy:${listing.id}`,
    }];
  }).map((row) => [row[0]]));
  rows.push([{ text: "🔄 Обновить", callback_data: "cauction:refresh" }]);
  rows.push([{ text: "📦 Назад на склад", callback_data: "company:warehouse" }]);
  return { inline_keyboard: rows };
}

async function buildAuctionInlineMarkup(userId: string, chatId: number) {
  const listings = await callInternalApi("GET", "/api/market") as any[];
  marketListingRefsByChatId.set(chatId, listings.map((listing) => String(listing.id)));
  const membership = await getPlayerCompanyContext(userId);
  const rows = listings.flatMap((listing, index) => {
    const ownEarlyAccess = Date.now() - Number(listing.createdAt || 0) < 20 * 60 * 1000;
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
    rows.push([{ text: "📦 Прокачка склада", callback_data: "company:warehouse_expand_preview" }]);
  }
  rows.push([{ text: "🔄 Обновить отделы", callback_data: "company:departments" }]);
  return buildCompanyInlineMenu(rows);
}

function buildCompanyWarehouseExpandInlineButtons(canUpgrade: boolean) {
  return buildCompanyInlineMenu([
    [
      {
        text: canUpgrade ? "📦 Подтвердить прокачку склада" : "⛔ Прокачка недоступна",
        callback_data: canUpgrade ? "company:warehouse_expand_confirm" : "company:warehouse_expand_preview",
      },
    ],
    [{ text: "🔄 Обновить", callback_data: "company:warehouse_expand_preview" }],
  ]);
}

function formatCompanyWarehouseExpandPreview(company: CompanyContext["company"]) {
  const capacity = Math.max(0, Number(company.warehouseCapacity) || 50);
  const canUpgrade = Number(company.level || 1) === 1 && capacity < 100;
  const upgradeCost = 1000;
  const nextCapacity = canUpgrade ? 100 : capacity;
  const additionalSlots = Math.max(0, nextCapacity - capacity);

  return {
    canUpgrade,
    text: [
      "📦 ПРОКАЧКА СКЛАДА",
      "━━━━━━━━━━━━━━",
      `Текущий лимит склада: ${capacity} слотов`,
      canUpgrade ? `После прокачки: ${nextCapacity} слотов (+${additionalSlots})` : `Следующий лимит: ${nextCapacity} слотов`,
      canUpgrade ? `Стоимость прокачки: ${formatNumber(upgradeCost)} GRM` : "Стоимость прокачки: недоступно",
      "",
      canUpgrade
        ? "При нажатии на кнопку ниже склад компании сразу обновится и лимит хранения увеличится."
        : "Сейчас прокачка склада недоступна для этой компании.",
    ].join("\n"),
  };
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

function formatBlueprintProgressLines(active?: CompanyBlueprintSnapshot["active"] | null) {
  if (!active) return [] as string[];
  const skillOrder: Array<"coding" | "design" | "analytics" | "testing" | "attention"> = ["coding", "design", "analytics", "testing", "attention"];
  const labels: Record<"coding" | "design" | "analytics" | "testing" | "attention", string> = {
    coding: "Кодинг",
    design: "Дизайн",
    analytics: "Аналитика",
    testing: "Тестирование",
    attention: "Внимание",
  };
  const progressLines: string[] = [];
  for (const skill of skillOrder) {
    const required = Math.max(0, Number(active.requiredPoints?.[skill] ?? 0));
    if (required <= 0) continue;
    const invested = Math.min(required, Math.max(0, Number(active.currentPoints?.[skill] ?? 0)));
    const perTick = Math.max(0, Number(active.lastContribution?.[skill] ?? 0));
    progressLines.push(`${labels[skill]}: ${formatNumber(invested)}/${formatNumber(required)}${perTick > 0 ? ` | +${formatNumber(perTick)}/тик` : ""}`);
  }
  const etaText = active.estimatedFinishAt
    ? active.estimatedFinishAt <= Date.now()
      ? "До завершения: почти готово"
      : `До завершения: ~${formatDurationShort(Math.max(0, Number(active.estimatedFinishAt) - Date.now()))}`
    : "До завершения: нужен участник с подходящими навыками";
  const participants = Array.isArray(active.participantNames) && active.participantNames.length
    ? `👥 Участники: ${active.participantNames.join(", ")}`
    : `👥 Участники: ${Math.max(0, Number(active.participantUserIds?.length || 0))}`;
  return ["🧠 Исследование:", ...progressLines, participants, etaText];
}

const BLUEPRINT_DEPARTMENT_SKILL_BOOSTS: Record<
  CompanyDepartmentKey,
  Partial<Record<"coding" | "design" | "analytics", number>>
> = {
  researchAndDevelopment: {
    coding: 0.12,
    analytics: 0.08,
    design: 0.05,
  },
  production: {
    coding: 0.08,
    analytics: 0.04,
    design: 0.02,
  },
  marketing: {
    design: 0.12,
    analytics: 0.06,
    coding: 0.03,
  },
  finance: {
    analytics: 0.12,
    coding: 0.05,
    design: 0.03,
  },
  infrastructure: {
    coding: 0.05,
    analytics: 0.05,
    design: 0.03,
  },
};

function getBlueprintParticipantDepartment(
  companyId: string,
  userId: string,
  professionId: ProfessionId | null,
): CompanyDepartmentKey | null {
  const assignments = companyAssignmentsByCompanyId.get(companyId);
  const assignedDepartment = assignments?.get(userId)?.department;
  if (assignedDepartment) return assignedDepartment;
  return getPreferredDepartmentForProfession(professionId);
}

function getBlueprintDepartmentSkillMultiplier(
  department: CompanyDepartmentKey | null,
  skill: "coding" | "design" | "analytics",
) {
  if (!department) return 1;
  const bonus = Number(BLUEPRINT_DEPARTMENT_SKILL_BOOSTS[department]?.[skill] ?? 0);
  return 1 + Math.max(0, bonus);
}

function formatBlueprintDepartmentBoostNote(
  department: CompanyDepartmentKey | null,
  required: Partial<Record<"coding" | "design" | "analytics", number>>,
) {
  if (!department) return "";
  const labels: Record<"coding" | "design" | "analytics", string> = {
    coding: "Кодинг",
    design: "Дизайн",
    analytics: "Аналитика",
  };
  const boosts = (["coding", "design", "analytics"] as const)
    .filter((skill) => Number(required[skill] ?? 0) > 0)
    .map((skill) => {
      const bonus = Number(BLUEPRINT_DEPARTMENT_SKILL_BOOSTS[department]?.[skill] ?? 0);
      return bonus > 0 ? `${labels[skill]} +${Math.round(bonus * 100)}%` : "";
    })
    .filter(Boolean);
  if (!boosts.length) return "";
  return `🏢 Бонус отдела «${DEPARTMENT_LABELS[department]}»: ${boosts.join(", ")}.`;
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
    const professionId = snapshot ? getPlayerProfessionId(snapshot.user) : null;
    const department = getBlueprintParticipantDepartment(companyId, userId, professionId);
    const engineerMultiplier = advanced === "engineer" ? 1.15 : 1;
    const skills = (snapshot?.game as GameView | undefined)?.skills;
    if (!skills) continue;
    if (Number(required.coding ?? 0) > 0) {
      tick.coding +=
        Math.max(0, Number(skills.coding ?? 0))
        * engineerMultiplier
        * getBlueprintDepartmentSkillMultiplier(department, "coding");
    }
    if (Number(required.design ?? 0) > 0) {
      tick.design +=
        Math.max(0, Number(skills.design ?? 0))
        * engineerMultiplier
        * getBlueprintDepartmentSkillMultiplier(department, "design");
    }
    if (Number(required.analytics ?? 0) > 0) {
      tick.analytics +=
        Math.max(0, Number(skills.analytics ?? 0))
        * engineerMultiplier
        * getBlueprintDepartmentSkillMultiplier(department, "analytics");
    }
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
    ...formatBlueprintProgressLines(active),
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
      await callInternalApi("POST", `/api/companies/${companyId}/blueprints/progress`, {
        userId,
      });
      await updateCompanyBlueprintProgressMessage(token, chatId, companyName, companyId, userId);

      const timer = setTimeout(tick, 5000);
      companyBlueprintProgressTimerByChatId.set(chatId, timer);
    } catch (error) {
      console.warn("⚠️ Автопрогресс чертежа остановлен:", error);
      stopCompanyBlueprintProgressTicker(chatId);
    }
  };

  const timer = setTimeout(tick, 5000);
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
          "Нажми кнопку ниже, чтобы присоединиться к разработке и вкладывать навыки каждые 5 секунд.",
        ].join("\n"),
        { reply_markup: { inline_keyboard: [
          [{ text: "🤝 Присоединиться", callback_data: "company:bp_join" }],
          [{ text: "📈 Открыть прогресс", callback_data: "company:bp_progress_live" }],
          [{ text: "Позже", callback_data: "company:bureau" }],
        ] } },
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
    buildCompanyWorkInlineButtons,
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
    buildCompanyWarehouseInlineMarkup,
    getUserWithGameState,
    pendingActionByChatId,
    formatCompanyPartDepositList,
    sendMessage,
  });
}

async function sendCompanyAuctionSection(token: string, chatId: number, membership: CompanyContext, userId: string) {
  await sendMessage(token, chatId, await formatCompanyAuctionSection(membership, chatId), {
    reply_markup: await buildCompanyAuctionInlineMarkup(chatId, membership.company.id),
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
    buildCompanyDepartmentsInlineButtons,
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
  return normalizePartQuality(value);
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
  const current = companyWarehousePartsByCompanyId.get(companyId) ?? [];
  const normalized = normalizeCompanyWarehouseParts(current);
  if (normalized.changed) {
    companyWarehousePartsByCompanyId.set(companyId, normalized.parts);
  }
  return normalized.parts;
}

function normalizeCompanyWarehousePart(item: any) {
  const definition = resolvePartDefinition({
    id: item?.id,
    type: item?.type,
    partType: item?.partType,
    rarity: item?.rarity,
    quality: item?.quality,
    deviceCategory: item?.deviceCategory,
  });
  if (!definition) return null;
  return {
    id: definition.id,
    name: definition.name,
    title: definition.title,
    type: definition.type,
    partType: definition.partType,
    rarity: definition.quality,
    quality: definition.quality,
    deviceCategory: definition.deviceCategory,
    gadgetCategory: definition.gadgetCategory,
    quantity: Math.max(1, Number(item?.quantity || 1)),
  };
}

function buildRatingReplyMarkup() {
  return buildReplyKeyboard([
    ["👤 Ур", "👤 Реп", "👤 $"],
    ["👤 PvP", "🏢 Ур", "🏢 GRM"],
    ["🏢 📐"],
    ["⬅️ Назад в допы"],
  ]);
}

function normalizeCompanyWarehouseParts(parts: any[]) {
  const normalized: any[] = [];
  let changed = false;
  for (const item of Array.isArray(parts) ? parts : []) {
    const nextItem = normalizeCompanyWarehousePart(item);
    if (!nextItem) {
      changed = true;
      continue;
    }
    const existing = normalized.find((entry) => entry.id === nextItem.id);
    if (existing) {
      existing.quantity += nextItem.quantity;
      changed = true;
      continue;
    }
    if (
      String(item?.id || "") !== nextItem.id
      || String(item?.rarity || "") !== nextItem.rarity
      || String(item?.quality || "") !== nextItem.quality
      || String(item?.type || "") !== nextItem.type
      || String(item?.name || "") !== nextItem.name
    ) {
      changed = true;
    }
    normalized.push(nextItem);
  }
  return { parts: normalized, changed };
}

function getCompanyWarehousePartUnitRefs(companyId: string, filterType?: string | null) {
  const refs: Array<{ ref: string; id: string; rarity: RarityName; type: string; name: string }> = [];
  for (const item of getCompanyWarehouseParts(companyId)) {
    const partType = String(item.type || getPartById(item.id)?.type || "");
    if (filterType && partType !== filterType) continue;
    const quantity = Math.max(1, Number(item.quantity || 1));
    const rarity = normalizePartRarity(String(item.quality || item.rarity || getPartById(item.id)?.rarity || "Common"));
    for (let unitIndex = 0; unitIndex < quantity; unitIndex += 1) {
      refs.push({
        ref: `${item.id}::${rarity}::${unitIndex + 1}`,
        id: item.id,
        rarity,
        type: partType,
        name: String(item.name || getPartById(item.id)?.name || item.id),
      });
    }
  }
  return refs;
}

function setCompanyWarehouseParts(companyId: string, parts: CompanyWarehousePartItem[]) {
  companyWarehousePartsByCompanyId.set(companyId, normalizeCompanyWarehouseParts(parts).parts);
}

function addPartToCompanyWarehouse(companyId: string, reward: CompanyMiningRewardView) {
  const next = [...getCompanyWarehouseParts(companyId)];
  const partDef = getPartById(reward.partId);
  const rarity = normalizePartRarity(String(reward.rarity || partDef?.rarity || "Common"));
  const qty = Math.max(1, Number(reward.quantity) || 1);
  const normalizedPartId = String(partDef?.id || reward.partId);
  const existingIndex = next.findIndex((item) => item.id === normalizedPartId && item.rarity === rarity);
  if (existingIndex >= 0) {
    next[existingIndex] = {
      ...next[existingIndex],
      quantity: Math.max(0, Number(next[existingIndex].quantity) || 0) + qty,
    };
  } else {
    next.push({
      id: normalizedPartId,
      name: String(partDef?.name || reward.partName),
      type: reward.partType || partDef?.type || "unknown",
      rarity,
      quality: rarity,
      partType: reward.partType || partDef?.type || "unknown",
      deviceCategory: partDef?.deviceCategory,
      gadgetCategory: partDef?.gadgetCategory,
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
    exclusiveLevel: Number(gadget.exclusiveLevel || 0),
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
  const statLabels: Record<string, string> = {
    performance: "Производительность",
    efficiency: "Эффективность",
    design: "Дизайн",
    coding: "Кодинг",
    testing: "Тестирование",
    analytics: "Аналитика",
    attention: "Внимание",
    drawing: "Рисование",
    modeling: "3D-моделирование",
    reliability: "Надёжность",
  };
  return Object.entries(stats || {})
    .map(([key, value]) => `${statLabels[key] || key}: ${formatNumber(Number(value || 0))}`)
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

function getCompanyPartSellPrice(itemOrPartId: { id?: string } | string) {
  const partId = typeof itemOrPartId === "string" ? itemOrPartId : String(itemOrPartId?.id || "");
  return Math.max(1, Math.round(getPartPrice(partId) * 0.5));
}

function resolveCompanyPartSellRefFromChat(chatId: number, ref: string) {
  const trimmed = ref.trim();
  if (!/^\d+$/.test(trimmed)) return trimmed;
  const refs = companyPartSellRefsByChatId.get(chatId) ?? [];
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

async function sellCompanyWarehousePart(
  membership: CompanyContext,
  partRef: string,
  qtyInput?: string,
  actorUserId?: string,
): Promise<{ ok: true; partName: string; sellQty: number; earnedGrm: number; companyCapitalGrm: number } | { ok: false; error: string }> {
  const warehouseParts = [...getCompanyWarehouseParts(membership.company.id)];
  const partItem = warehouseParts.find((item) => String(item.id) === String(partRef));
  if (!partItem) {
    return { ok: false, error: "Запчасть не найдена на складе компании." };
  }

  const availableQty = Math.max(1, Number(partItem.quantity) || 1);
  const requestedQty = qtyInput && qtyInput.toLowerCase() !== "all"
    ? Math.floor(Number(qtyInput))
    : availableQty;
  if (!Number.isFinite(requestedQty) || requestedQty <= 0) {
    return { ok: false, error: "Неверное количество. Введите число или all." };
  }
  const sellQty = Math.min(availableQty, requestedQty);
  const earnedGrm = getCompanyPartSellPrice(partItem) * sellQty;

  const nextWarehouseParts = warehouseParts.flatMap((item) => {
    if (String(item.id) !== String(partItem.id)) return [item];
    const left = availableQty - sellQty;
    if (left <= 0) return [];
    return [{ ...item, quantity: left }];
  });
  setCompanyWarehouseParts(membership.company.id, nextWarehouseParts);

  const members = await storage.getCompanyMembers(membership.company.id);
  const economy = await ensureCompanyEconomyState(membership.company, members.length);
  const savedEconomy = await saveCompanyEconomyState(membership.company, {
    ...economy,
    capitalGRM: Math.max(0, Number(economy.capitalGRM || 0) + earnedGrm),
  });
  await appendEconomyAuditEvent({
    eventType: "COMPANY_PARTS_SOLD",
    userId: actorUserId ?? membership.company.ownerId,
    companyId: membership.company.id,
    targetId: String(partItem.id),
    amount: earnedGrm,
    status: "success",
    reason: "company_part_sell",
    metadata: {
      quantity: sellQty,
      quality: String(partItem.quality || partItem.rarity || "Common"),
      partType: String(partItem.partType || partItem.type || "unknown"),
      partName: String(partItem.name || "Запчасть"),
    },
  });

  return {
    ok: true,
    partName: String(partItem.name || "Запчасть"),
    sellQty,
    earnedGrm,
    companyCapitalGrm: Math.max(0, Number(savedEconomy.capitalGRM || 0)),
  };
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
    const users = (await storage.getUsers()).filter((user) => !isPvpBotUsername(user.username));
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
              `   lvl ${formatNumber(item.level)} • rep ${formatNumber(item.reputation)} • PvP ${formatNumber(Number(item.pvpRating || 1000))} • ${getCurrencySymbol(item.city)}${formatNumber(item.balance)}`
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
        `• Осталось: ${formatDurationShort(Math.max(0, game.activeBankProduct.daysLeft) * 60_000)}`,
        `• ${game.activeBankProduct.type === "credit" ? "К возврату" : "К получению"}: ${currency}${Math.round(game.activeBankProduct.totalReturn)}`,
      ].join("\n")
    : "⚪ Активных банковских продуктов нет";
  const pvpBoost = game.activePvpBankBoost
    ? [
        "⚔️ PvP-бонус от вклада",
        `• ${game.activePvpBankBoost.sourceName}`,
        `• Осталось: ${formatDurationShort(Math.max(0, game.activePvpBankBoost.expiresAt - Date.now()))}`,
        `• Победа даёт: +${Math.round(game.activePvpBankBoost.rewardBonusPct * 100)}% к репутации, +${Math.round(game.activePvpBankBoost.xpBonusPct * 100)}% XP, +${Math.round(game.activePvpBankBoost.ratingBonusFlat)} рейтинга`,
      ].join("\n")
    : null;

  return [
    "🏦 БАНКОВСКИЙ ЦЕНТР",
    "━━━━━━━━━━━━━━",
    `💰 Баланс: ${currency}${formatNumber(user.balance)}`,
    `🪙 GRM: ${formatGramValue(game.gramBalance)} GRM`,
    `💱 Курс: 1 локальная единица = ${formatRate(getLocalToGramRate(user.city))} GRM`,
    "━━━━━━━━━━━━━━",
    active,
    ...(pvpBoost ? ["", pvpBoost] : []),
    "",
    "📉 Кредиты помогают ускорить развитие, но потом долг нужно погасить.",
    "📈 Вклады дают либо короткую прибыль, либо временный PvP-бонус.",
    "",
    "Выбери действие кнопками ниже.",
    "Для пополнения компании: кнопка управления компанией",
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

function buildPvpRoundInlineKeyboard(activeDuel?: any) {
  const stageKey = String(activeDuel?.currentStageKey || "concept") as DuelRoundType;
  const myTactics = (activeDuel?.myTactics && typeof activeDuel.myTactics === "object") ? activeDuel.myTactics : {};
  if (Number(activeDuel?.stagePreparationRemainingMs || 0) <= 0) return null;
  if (myTactics[stageKey]) return null;
  return {
    inline_keyboard: [
      (["speed", "quality", "stability", "pressure"] as DuelTacticId[]).map((tacticId) => ({
        text: `${getPvpTacticDefinition(tacticId)?.name || tacticId}`,
        callback_data: `pvp_tactic:${stageKey}:${tacticId}`,
      })),
    ],
  };
}

async function notifyReferralInviter(input: {
  token: string;
  inviterChatId: number;
  inviterCity: string;
  inviterBalance: number;
  invitedUsername: string;
  referralInviterReward: number;
}) {
  await sendMessage(
    input.token,
    input.inviterChatId,
    [
      "🎉 Новый реферал зашёл в игру по твоей ссылке!",
      `👤 Игрок: ${input.invitedUsername}`,
      `💰 Бонус: +${getCurrencySymbol(input.inviterCity)}${input.referralInviterReward}`,
      `💼 Текущий баланс: ${getCurrencySymbol(input.inviterCity)}${formatNumber(input.inviterBalance)}`,
    ].join("\n"),
  );
}

function buildEnergyFullNotifications(game: GameView, previous?: { work: boolean; study: boolean }) {
  const notifications: string[] = [];
  const workFull = isFullEnergy(game.workTime);
  const studyFull = isFullEnergy(game.studyTime);

  if (previous) {
    if (workFull && !previous.work) {
      notifications.push("⚡ Энергия работы полностью восстановлена.");
    }
    if (studyFull && !previous.study) {
      notifications.push("📚 Энергия учёбы полностью восстановлена.");
    }
  }

  return {
    workFull,
    studyFull,
    notifications,
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
  const professionId = getPlayerProfessionId(user);
  const baseSkillCap = getTrainingSkillCapForLevel(user.level);
  return [
    `📚 ${level.name.toUpperCase()}`,
    "━━━━━━━━━━━━━━",
    ...level.courses.map((course, index) => {
      const effectiveFailure = Math.max(0, course.failureChance + 10 - reduction);
      const energyCost = getStudyEnergyCostForPlayer(levelKey, course, user);
      const courseCost = getStudyCourseCostForPlayer(course, user);
      const boostedCap = Object.keys(course.skillBoosts || {}).reduce((best, skillKey) => {
        return Math.max(best, getTrainingSkillCapForLevel(user.level, skillKey as SkillName, professionId));
      }, baseSkillCap);
      const capLine = boostedCap > baseSkillCap
        ? `Потолок навыков от обучения на твоём уровне: ${baseSkillCap} (профильный навык профессии: ${boostedCap})`
        : `Потолок навыков от обучения на твоём уровне: ${baseSkillCap}`;
      const completedMark = "";
      return `${index + 1}. ${course.icon} ${course.name}${completedMark}\n${course.description}\nНавыки курса: ${formatStats(course.skillBoosts as Record<string, number>)}\n💸 ${currency}${courseCost} | Риск: ${effectiveFailure}% | ⚡ -${Math.round(energyCost * 100)} энергии учёбы\n${capLine}`;
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
    tutorialContinueLine ?? "",
    profileText,
    tutorialContinueLine ? "Старт обучения: кнопка «🎓 Обучение»" : "",
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

const pvpTelegramModule = createPvpTelegramModule({
  handlePvpMessageInput: async (command, token, chatId, message) => handlePvpMessage({
    command,
    token,
    chatId,
    message,
    resolveOrCreateTelegramPlayer,
    canEnterPvp,
    getPvpAccessMessage,
    sendMessage,
    PVP_MENU_REPLY_MARKUP,
    formatPvpMenu,
    buildProfessionSelectText,
    buildProfessionSelectInlineMarkup,
    ensureExclusiveActionAllowed,
    callInternalApi,
    startPvpQueuePolling: (innerToken: string, innerChatId: number, userId: string) =>
      pvpTelegramModule.startQueuePolling(innerToken, innerChatId, userId),
    stopPvpQueuePolling: (innerChatId: number) => pvpTelegramModule.stopQueuePolling(innerChatId),
    sendWithCurrentHubKeyboard,
    extractErrorMessage,
  }),
  resolveActor: async (query) => (query?.from ? resolveOrCreateTelegramPlayer(query.from) : null),
  callInternalApi,
  formatPvpActiveDuelText,
  getPvpInlineMarkup,
  callTelegramApi,
  sendMessage,
  formatPvpResultText,
  pvpMenuReplyMarkup: PVP_MENU_REPLY_MARKUP,
  pvpQueuePollTimerByChatId,
  pvpDuelProgressMessageByChatId,
  pvpDuelStageKeyByChatId,
});

const registrationTelegramModule = createRegistrationTelegramModule({
  registrationDraftByChatId,
  pendingActionByChatId,
  buildPlayerRegistrationState,
  promptStep: sendTelegramRegistrationStepPrompt,
  handlePendingAction: handleRegistrationPendingAction,
  handleCallback: handleRegistrationCallback,
});

const companyTelegramModule = createCompanyTelegramModule({
  handleNavigationMessage: handleCompanyNavigationMessage,
  handleMembershipMessage: handleCompanyMembershipMessage,
  handleProcessMessage: handleCompanyProcessMessage,
  handleManagementMessage: handleCompanyManagementMessage,
  handleDevelopmentMessage: handleCompanyDevelopmentMessage,
  resolveOrCreateTelegramPlayer,
  getCurrentExclusiveAction,
  formatExclusiveActionLabel: (action: string) => formatExclusiveActionLabel(action as ExclusiveActionIntent),
  sendWithCurrentHubKeyboard,
  getPlayerCompanyContext,
  sendWithMainKeyboard,
  buildCompanyReplyMarkup,
  canManageCompanyAssets: (role?: string | null) => isCompanyAssetManagerRole(role),
  companyAssetManagerError: COMPANY_ASSET_MANAGER_ERROR,
  getCompanyCreateCostForPlayer,
  pendingActionByChatId,
  sendMessage,
  getCurrencySymbol,
  sendCompanyWorkSection,
  sendCompanyWarehouseSection,
  companyWarehouseFilterByChatId,
  sendCompanyManagementSection,
  formatCompanyDepartmentsSection,
  callTelegramApi,
  formatNumber,
  formatRate,
  getLocalToGRMRate,
  formatCompanyIpoSection,
  formatCompanyStaffingSection,
  buildCompanyStaffingInlineMarkup,
  companyMemberRefsByChatId,
  storage,
  buildCompanyDepartmentSelectInlineMarkup,
  formatCompanyDepartmentChoiceHelp,
  callInternalApi,
  extractErrorMessage,
  formatCompanySalariesSection,
  buildCompanySalariesInlineMarkup,
  formatCompanyWarehouseExpandPreview,
  buildCompanyWarehouseExpandInlineButtons,
  buildCompanyReplyMarkupFn: buildCompanyReplyMarkup,
  handleIncomingMessage,
  ensureCompanyProcessUnlocked,
  getCompanyMiningPlan,
  scheduleCompanyMiningReadyNotification,
  buildCompanyMiningInlineButtons,
  getCompanyMiningStatus,
  formatMiningPlansMenu,
  ensureCompanyWarehouseCanStoreMiningReward,
  claimCompanyMining,
  addPartToCompanyWarehouse,
  sendOrEditCompanyBureauSection,
  getCompanyBlueprintSnapshot,
  updateCompanyBlueprintProgressMessage,
  ensureCompanyEconomyState,
  sendCompanyRequestsSection,
  upgradeDepartment,
  saveCompanyEconomyState,
  sendCompanyDepartmentsSection,
  departmentLabels: DEPARTMENT_LABELS,
  ensureExclusiveActionAllowed,
  startCompanyBlueprintDevelopment,
  sendCompanyEconomySection,
  getCompanyExclusiveSnapshot,
  companyExclusiveSelectedPartRefsByChatId,
  companyExclusivePartPageByChatId,
  companyExclusivePartRefsByChatId,
  getCompanyWarehouseParts,
  sendCompanyExclusivePartsPicker,
  EXCLUSIVE_UPGRADE_REQUIRED_PARTS,
  EXCLUSIVE_UPGRADE_REQUIRED_GADGETS,
  previewCompanyExclusiveUpgrade,
  formatDurationShort,
  buildCompanyExclusiveUpgradeConfirmInlineMarkup,
  startCompanyExclusiveDevelopment,
  sendCompanyRootMenu,
  setCompanyMenuSection,
  rememberTelegramMenu,
  answerCallbackQuery,
  ALL_PARTS,
  getCityContracts,
  clearPendingActionRuntimeState,
  getCompanyWarehousePartUnitRefs,
  companyContractSelectedPartRefsByChatId,
  companyContractPartPageByChatId,
  sendCompanyContractPartsPicker,
  completeCompanyContractDelivery,
  startCompanyContractPartSelection,
  resolveContractRef,
  normalizePartRarity,
  setCompanyWarehouseParts,
  formatProductionOrderRemaining,
  resolveCompanyPartSellRefFromChat,
  sellCompanyWarehousePart,
});

const inventoryTelegramModule = createInventoryTelegramModule({
  handleInventoryMessage,
  resolveOrCreateTelegramPlayer,
  resolveTelegramSnapshot,
  inventoryRefsByChatId,
  buildInventoryMenu,
  formatNotices,
  buildInventoryInlineButtons,
  callTelegramApi,
  sendMessage,
  buildInventoryItemDetailText,
  buildInventoryItemDetailInlineButtons,
  handleIncomingMessage,
  buyShopItem,
  tryApplyTutorialEvent,
  updateWeeklyQuestProgress,
  formatShopPurchaseResultText,
  buildShopPurchaseInlineMarkup,
  sendWithCityHubKeyboard,
  extractErrorMessage,
  answerCallbackQuery,
  useInventoryItem,
  toggleGearItem,
  formatStats,
  sendWithCurrentHubKeyboard,
});

const economyTelegramModule = createEconomyTelegramModule({
  handleEconomyMessage,
  resolveOrCreateTelegramPlayer,
  ensureCityHubAccess,
  resolveTelegramSnapshot,
  rememberTelegramMenu,
  pendingActionByChatId,
  formatBankProgramsMenu,
  buildBankSelectionReplyMarkup,
  sendMessage,
  sendWithBankKeyboard,
  parseBankOpenInput,
  openBankProduct,
  formatLiveProfile,
  getCurrencySymbol,
  extractErrorMessage,
  closeBankProduct,
  formatStocksMenu,
  formatStocksNewsMenu,
  buildStocksHomeReplyMarkup,
  buyStockAsset,
  sellStockAsset,
  tryApplyTutorialEvent,
  formatTutorialAdvanceNotice,
});

const repairTelegramModule = createRepairTelegramModule({
  handleRepairMessage,
  handleRepairCallback,
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
  formatRepairServiceMenu,
  buildRepairServiceInlineMarkup,
  callTelegramApi,
  sendCityHubSummary,
  listRepairableGadgets,
  calculateRepairEstimate,
  getGadgetConditionStatusLabel,
  formatCompanyRepairServiceMenu,
  buildCompanyRepairServiceInlineMarkup,
  sendCompanyRootMenu,
});

const hubTelegramModule = createHubTelegramModule({
  handleNavigationMessage,
  handleCityMessage,
  resolveOrCreateTelegramPlayer,
  storage,
  getHousingById,
  purchaseHousing,
  setActiveHousing,
  replaceHousingCardMessage,
});

const tutorialTelegramModule = createTutorialTelegramModule({
  resolveOrCreateTelegramPlayer,
  getTutorialSnapshotByUser,
  formatTutorialMenuText,
  buildTutorialInlineButtons,
  callTelegramApi,
  sendMessage,
  callInternalApi,
  sendTutorialMenu,
  sendTutorialCompletionCelebration,
  handleIncomingMessage,
  ensureExclusiveActionAllowed,
  runJobSelection,
  sendWithCurrentHubKeyboard,
  pendingActionByChatId,
  sendCityHubSummary,
});

async function tryHandleTelegramFeatureCallback(input: {
  pvpInput: {
    data: string;
    token: string;
    chatId: number;
    messageId?: number;
    query: TelegramCallbackQuery;
  };
  registrationInput: any;
  companyInput: {
    data: string;
    token: string;
    chatId: number;
    messageId?: number;
    query: TelegramCallbackQuery;
    callbackId: string;
    webAppUrl: string;
  };
}) {
  const pvpCallback = await pvpTelegramModule.handleCallback(input.pvpInput);
  if (pvpCallback?.handled) {
    return {
      handled: true as const,
      callbackText: pvpCallback.callbackText,
      shouldClearInlineButtons: pvpCallback.shouldClearInlineButtons,
    };
  }

  const registrationCallback = await registrationTelegramModule.handleCallback(input.registrationInput);
  if (registrationCallback?.handled) {
    return {
      handled: true as const,
      callbackText: registrationCallback.callbackText,
      shouldClearInlineButtons: registrationCallback.shouldClearInlineButtons,
    };
  }

  const companyCallback = await companyTelegramModule.handleCallback(input.companyInput);
  if (companyCallback?.handled) {
    return {
      handled: true as const,
      callbackText: companyCallback.callbackText,
      shouldClearInlineButtons: "shouldClearInlineButtons" in companyCallback
        ? companyCallback.shouldClearInlineButtons
        : undefined,
    };
  }

  return { handled: false as const };
}

async function tryHandleTelegramFeatureMessage(input: {
  command: string;
  args: string[];
  token: string;
  chatId: number;
  message: TelegramMessage;
  companyInput: any;
}) {
  if (await companyTelegramModule.handleMessage(input.companyInput)) {
    return true;
  }

  if (await pvpTelegramModule.handleMessage(input.command, input.token, input.chatId, input.message)) {
    return true;
  }

  return false;
}

const REGISTRATION_BYPASS_COMMANDS = new Set(["/help", "/updates", "/changes"]);
const TUTORIAL_BYPASS_COMMANDS = new Set(["/help", "/updates", "/changes", "/cancel", "/start", "/starttg", "/tutorial", "/onboarding"]);
const PROFESSION_AUTOPROMPT_BYPASS_COMMANDS = new Set(["/help", "/updates", "/changes", "/profession", "/pvp", "/pvp_find"]);

function shouldBypassRegistrationFlow(command: string) {
  return REGISTRATION_BYPASS_COMMANDS.has(command);
}

function shouldBypassTutorialLocks(command: string) {
  return TUTORIAL_BYPASS_COMMANDS.has(command);
}

function shouldBypassProfessionAutoprompt(command: string) {
  return PROFESSION_AUTOPROMPT_BYPASS_COMMANDS.has(command);
}

function buildRegistrationCallbackInput(
  data: string,
  token: string,
  chatId: number,
  messageId: number | undefined,
  callbackId: string,
  query: TelegramCallbackQuery,
  webAppUrl: string,
) {
  return {
    data,
    token,
    chatId,
    messageId,
    callbackId,
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
    resolveTelegramRegistrationStep: (user: User, innerChatId: number) => registrationTelegramModule.resolveStep(user, innerChatId),
    applyReferralFromStartPayload,
    resolveTelegramSnapshot,
    getCurrencySymbol,
    referralNewPlayerReward: REFERRAL_NEW_PLAYER_REWARD,
    referralInviterReward: REFERRAL_INVITER_REWARD,
    getTelegramIdByUserId,
    getActiveHousing,
    getStarterHousingForCity,
    sendHousingCard,
    notifyReferralInviter,
    cityOptions: CITY_OPTIONS,
    personalityOptions: PERSONALITY_OPTIONS,
    genderOptions: GENDER_OPTIONS,
    saveRegistrationProgress,
  };
}

function buildCompanyFeatureMessageInput(
  command: string,
  args: string[],
  token: string,
  chatId: number,
  message: TelegramMessage,
) {
  return {
    command,
    args,
    token,
    chatId,
    message,
    navigationInput: {
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
    },
    membershipInput: {
      command,
      args,
      token,
      chatId,
      message,
      resolveOrCreateTelegramPlayer,
      getCompanyCreateCostForPlayer,
      getPlayerCompanyContext,
      sendMessage,
      buildCompanyReplyMarkup,
      pendingActionByChatId,
      getCurrencySymbol,
      normalizeTelegramCompanyName,
      sendWithMainKeyboard,
      storage,
      companyListByChatId,
      getTopCompanies,
      buildCompanyRegistryInlineMarkup,
      ensureCompanyEconomyState,
      stopCompanyBlueprintProgressTicker,
      companyBlueprintProgressMessageByChatId,
      ensureCompanyHubAccess,
      setCompanyMenuSection,
      rememberTelegramMenu,
      companyRequestsByChatId,
      sendCompanyRequestsSection,
      companyEconomyByCompanyId,
      companySalaryByCompanyId,
      companySalaryClaimAtByCompanyId,
      getTelegramIdByUserId,
    },
    processInput: {
      command,
      args,
      token,
      chatId,
      message,
      resolveOrCreateTelegramPlayer,
      ensureCompanyHubAccess,
      setCompanyMenuSection,
      rememberTelegramMenu,
      getPlayerCompanyContext,
      sendWithMainKeyboard,
      ensureCompanyProcessUnlocked,
      COMPANY_MINING_PLANS,
      getCompanyMiningPlan,
      callInternalApi,
      scheduleCompanyMiningReadyNotification,
      sendMessage,
      buildCompanyMiningInlineButtons,
      extractErrorMessage,
      buildCompanyReplyMarkup,
      getCompanyMiningStatus,
      formatMiningPlansMenu,
      ensureCompanyWarehouseCanStoreMiningReward,
      claimCompanyMining,
      addPartToCompanyWarehouse,
      resolveWarehousePartRefFromChat,
      resolveWarehouseGadgetRefFromChat,
      resolveTelegramSnapshot,
      formatCompanyPartDepositList,
      pendingActionByChatId,
      getCompanyBlueprintSnapshot,
      getCompanyWarehouseUsedSlots,
      applyGameStatePatch,
      ALL_PARTS,
      getCompanyWarehouseParts,
      setCompanyWarehouseParts,
      normalizePartRarity,
      sendCompanyWarehouseSection,
      getUserWithGameState,
      companyPartDepositRefsByChatId,
      resolveCompanyPartDepositRefFromChat,
      transferCompanyPartToWarehouse,
      formatCompanyPartSellList,
      buildCompanyPartSellInlineMarkup,
      resolveCompanyPartSellRefFromChat,
      sellCompanyWarehousePart,
      sendCompanyAuctionSection,
      canManageCompanyAssets: (role?: string | null) => isCompanyAssetManagerRole(role),
      companyAssetManagerError: COMPANY_ASSET_MANAGER_ERROR,
    },
    managementInput: {
      command,
      args,
      token,
      chatId,
      message,
      resolveOrCreateTelegramPlayer,
      ensureCompanyHubAccess,
      setCompanyMenuSection,
      rememberTelegramMenu,
      getPlayerCompanyContext,
      sendWithMainKeyboard,
      formatCompanyStaffingSection,
      sendMessage,
      buildCompanyStaffingInlineMarkup,
      resolveCompanyDepartmentKey,
      callInternalApi,
      extractErrorMessage,
      formatCompanySalariesSection,
      buildCompanySalariesInlineMarkup,
      companyMemberRefsByChatId,
      storage,
      resolveCompanyMemberRef,
      getCompanySalaryMap,
      getCompanySalaryClaimMap,
      ensureCompanyEconomyState,
      saveCompanyEconomyState,
      getUserWithGameState,
      formatLiveProfile,
      getCurrencySymbol,
      formatNumber,
      pendingActionByChatId,
      getLocalToGRMRate,
      formatRate,
      parseDecimalInput,
      applyCompanyTopUpFromPlayer,
      sendCompanyEconomySection,
      COMPANY_DEPARTMENT_ORDER,
      upgradeDepartment,
      DEPARTMENT_LABELS,
      sendCompanyDepartmentsSection,
      sendWithCurrentHubKeyboard,
      runIPO,
      sendCompanyIpoSection,
    },
    developmentInput: {
      command,
      args,
      token,
      chatId,
      message,
      resolveOrCreateTelegramPlayer,
      getPlayerCompanyContext,
      sendWithMainKeyboard,
      ensureCompanyProcessUnlocked,
      sendMessage,
      getCityContracts,
      resolveContractRef,
      startCompanyContractPartSelection,
      completeCompanyContractDelivery,
      callInternalApi,
      extractErrorMessage,
      sendCompanyWorkSection,
      ensureExclusiveActionAllowed,
      sendOrEditCompanyBureauSection,
      startCompanyBlueprintDevelopment,
      setCompanyMenuSection,
      formatCompanyExclusiveSection,
      buildCompanyReplyMarkup,
      buildCompanyExclusiveStartInlineMarkup,
      companyExclusiveSelectedPartRefsByChatId,
      companyExclusivePartPageByChatId,
      pendingActionByChatId,
      sendCompanyExclusivePartsPicker,
      getCompanyExclusiveSnapshot,
      formatExclusiveProgressLiveText,
      storage,
      getTelegramIdByUserId,
      formatExclusiveBlueprintSummary,
      formatProductionOrderRemaining,
      formatExclusiveProduceMenu,
      buildCompanyExclusiveProduceInlineMarkup,
      tryHandlePendingAction,
      getCompanyBlueprintSnapshot,
      ensureCompanyEconomyState,
      getDepartmentEffects,
      getCompanyWarehouseParts,
    },
  };
}

function buildTelegramFeatureCallbackInput(
  data: string,
  token: string,
  webAppUrl: string,
  query: TelegramCallbackQuery,
  chatId: number,
  messageId: number | undefined,
  callbackId: string,
) {
  return {
    pvpInput: { data, token, chatId, messageId, query },
    registrationInput: buildRegistrationCallbackInput(data, token, chatId, messageId, query.id, query, webAppUrl),
    companyInput: {
      data,
      token,
      chatId,
      messageId,
      query,
      callbackId,
      webAppUrl,
    },
  };
}

function buildTelegramFeatureMessageInput(
  command: string,
  args: string[],
  token: string,
  chatId: number,
  message: TelegramMessage,
) {
  return {
    command,
    args,
    token,
    chatId,
    message,
    companyInput: buildCompanyFeatureMessageInput(command, args, token, chatId, message),
  };
}

function buildTelegramHubMessageInput(
  command: string,
  args: string[],
  token: string,
  webAppUrl: string,
  chatId: number,
  message: TelegramMessage,
  player: User,
) {
  return {
    navigationInput: {
      command,
      args,
      token,
      webAppUrl,
      chatId,
      message,
      player,
      pendingActionByChatId,
      playerTravelByUserId,
      getTravelRemainingSeconds,
      formatTravelTargetLabel,
      getPlayerHubLocation,
      ensureExclusiveActionAllowed,
      TRAVEL_TO_CITY_MS,
      TRAVEL_TO_COMPANY_MS,
      setPlayerHubLocation,
      clearPlayerTravel,
      resolveTelegramRegistrationStep: (user: User, innerChatId: number) => registrationTelegramModule.resolveStep(user, innerChatId),
      beginTelegramRegistration: registrationTelegramModule.beginRegistration,
      applyReferralFromStartPayload,
      resolveTelegramSnapshot,
      formatPlayerProfile,
      buildWelcomeMessage,
      canUseTelegramWebAppButton,
      sendMessage,
      getCurrencySymbol,
      REFERRAL_NEW_PLAYER_REWARD,
      REFERRAL_INVITER_REWARD,
      getTelegramIdByUserId,
      sendWithMainKeyboard,
      restoreTelegramMenuState,
      formatNotices,
      buildBotModeMessage,
      sendHomeMenu,
      rememberTelegramMenu,
      sendWithExtrasKeyboard,
      ensureCityHubAccess,
      formatAuctionSection,
      buildAuctionInlineMarkup,
      resolveCityName,
      isCityTemporarilyAvailable,
      CITY_CAPACITY_MESSAGE,
      CITY_REPLY_MARKUP,
      storage,
    },
    cityInput: {
      command,
      args,
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
      getHousingTravelDurationMs,
      TRAVEL_TO_CITY_MS,
      setPlayerHubLocation,
      sendCityHubSummary,
      ensureCityHubAccess,
      grantStarterHousing,
      getActiveHousing,
      getStarterHousingForCity,
      rememberTelegramMenu,
      sendWithCityHubKeyboard,
      sendHousingCard,
      formatHousingMenuText,
      pendingActionByChatId,
      sendWithCurrentHubKeyboard,
      resolveEducationLevel,
      sendMessage,
      formatEducationCoursesMenu,
      buildEducationCoursesReplyMarkup,
      formatEducationLevelsMenu,
      buildEducationLevelsReplyMarkup,
      resolveTelegramSnapshot,
      listJobsByCity,
      getPlayerProfessionId,
      formatJobsMenu,
      buildJobsInlineMarkup,
      runJobSelection,
    },
  };
}

async function tryHandleTelegramPlayerSystemsMessage(
  command: string,
  args: string[],
  token: string,
  chatId: number,
  message: TelegramMessage,
) {
  if (await handleProfileMetaMessage({
    command,
    args,
    token,
    chatId,
    message,
    resolveOrCreateTelegramPlayer,
    playerTravelByUserId,
    getTravelRemainingSeconds,
    formatTravelTargetLabel,
    sendWithMainKeyboard,
    getPlayerHubLocation,
    ensureExclusiveActionAllowed,
    resolveTelegramSnapshot,
    setPlayerHubLocation,
    clearPlayerTravel,
    TRAVEL_TO_CITY_MS,
    TRAVEL_TO_COMPANY_MS,
    formatNotices,
    formatPlayerProfile,
    getProfessionById,
    getPlayerProfessionId,
    PROFESSION_UNLOCK_LEVEL,
    buildProfessionSelectText,
    buildProfessionSelectInlineMarkup,
    sendMessage,
    rememberTelegramMenu,
    formatReferralMenu,
    sendWithExtrasKeyboard,
    sendWithRatingKeyboard,
    formatReputationMenu,
    formatWeeklyQuestMenu,
    buildQuestInlineButtons,
    claimWeeklyQuestReward,
    getUserWithGameState,
    getCurrencySymbol,
    extractErrorMessage,
    sendTutorialMenu,
    isRatingEntityToken,
    normalizeRatingEntity,
    formatRatingMenu,
  })) {
    return true;
  }

  if (await inventoryTelegramModule.handleMessage({
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
    return true;
  }

  if (await economyTelegramModule.handleMessage({
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
    return true;
  }

  if (await handleAdminMessage({
    command,
    args,
    token,
    chatId,
    message,
    ADMIN_PASSWORD,
    isAdminEnabled,
    adminAuthByChatId,
    pendingActionByChatId,
    companyListByChatId,
    sendWithMainKeyboard,
    sendWithAdminKeyboard,
    resolveOrCreateTelegramPlayer,
    storage,
    getUserWithGameState,
    getCurrencySymbol,
    formatPlayerProfile,
    applyExperienceGain,
    getPlayerCompanyContext,
    ensureCompanyEconomyState,
    clearPlayerGameState,
    unbindTelegramByUserId,
    unbindTelegramByTelegramId,
    companyEconomyByCompanyId,
    companySalaryByCompanyId,
    companySalaryClaimAtByCompanyId,
    referralCodeByUserId,
    referralOwnerByCode,
    referredByUserId,
    referralChildrenByUserId,
    weeklyQuestStateByUserId,
    inventoryRefsByChatId,
    companyMemberRefsByChatId,
    stopCompanyBlueprintProgressTicker,
    companyBlueprintProgressMessageByChatId,
    registrationDraftByChatId,
    callInternalAdminApi,
    extractErrorMessage,
  })) {
    return true;
  }

  if (await handleHackathonMessage({
    command,
    args,
    token,
    chatId,
    message,
    resolveOrCreateTelegramPlayer,
    setCompanyMenuSection,
    sendWithCurrentHubKeyboard,
    formatHackathonMenu,
    formatGlobalEventsMenu,
    getPlayerCompanyContext,
    storage,
    registerCompanyForWeeklyHackathon,
    joinPlayerToWeeklyHackathonTeam,
    getWeeklyHackathonCompanyScore,
    extractErrorMessage,
    getTelegramIdByUserId,
    sendMessage,
  })) {
    return true;
  }

  return false;
}

async function tryHandleTelegramLegacyCommandIslands(
  command: string,
  args: string[],
  token: string,
  chatId: number,
  message: TelegramMessage,
) {
  if (command === "/auction_full" || command === "/auction_short") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    if (!(await ensureCityHubAccess(token, chatId, player, message))) return true;
    auctionViewModeByChatId.set(chatId, command === "/auction_full" ? "full" : "compact");
    await sendMessage(token, chatId, await formatAuctionSection(player.id, chatId), {
      reply_markup: await buildAuctionInlineMarkup(player.id, chatId),
    });
    return true;
  }

  if (command === "/auction_buy") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    if (!(await ensureCityHubAccess(token, chatId, player, message))) return true;
    const ref = args.join(" ").trim();
    if (!ref) {
      await sendWithCityHubKeyboard(token, chatId, "Открой аукцион и выбери лот кнопкой покупки.");
      return true;
    }
    try {
      const listingId = resolveMarketListingRefFromChat(chatId, ref);
      await callInternalApi("POST", "/api/market/buy", { listingId, buyerId: player.id });
      await sendWithCityHubKeyboard(token, chatId, `✅ Покупка завершена.\n\n${await formatAuctionSection(player.id, chatId)}`);
    } catch (error) {
      await sendWithCityHubKeyboard(token, chatId, `❌ ${extractErrorMessage(error)}`);
    }
    return true;
  }

  if (command === "/auction_bid") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    if (!(await ensureCityHubAccess(token, chatId, player, message))) return true;
    const ref = String(args[0] || "").trim();
    const amount = Number(args[1] || 0);
    if (!ref || !Number.isFinite(amount) || amount <= 0) {
      await sendWithCityHubKeyboard(token, chatId, "Открой аукцион, выбери лот и укажи сумму ставки обычным сообщением.");
      return true;
    }
    try {
      const listingId = resolveMarketListingRefFromChat(chatId, ref);
      await callInternalApi("POST", "/api/market/bid", { listingId, bidderId: player.id, amount });
      await sendWithCityHubKeyboard(token, chatId, `✅ Ставка принята.\n\n${await formatAuctionSection(player.id, chatId)}`);
    } catch (error) {
      await sendWithCityHubKeyboard(token, chatId, `❌ ${extractErrorMessage(error)}`);
    }
    return true;
  }

  if (command === "/company_upgrade") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    setCompanyMenuSection(chatId, "management_departments");
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership || membership.role !== "owner") {
      await sendWithMainKeyboard(token, chatId, "Команда доступна только CEO компании.");
      return true;
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
    return true;
  }

  if (command === "/company_expand" || command === "/company_expand_warehouse") {
    const player = await resolveOrCreateTelegramPlayer(message.from);
    setCompanyMenuSection(chatId, "management_departments");
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership || membership.role !== "owner") {
      await sendWithMainKeyboard(token, chatId, "Команда доступна только CEO компании.");
      return true;
    }

    const preview = formatCompanyWarehouseExpandPreview(membership.company);
    await sendMessage(token, chatId, preview.text, {
      reply_markup: buildCompanyWarehouseExpandInlineButtons(preview.canUpgrade),
    });
    return true;
  }

  return false;
}

async function tryHandleTelegramMetaCallback(input: {
  data: string;
  token: string;
  webAppUrl: string;
  chatId: number;
  messageId?: number;
  callbackId: string;
  query: TelegramCallbackQuery;
}) {
  const { data, token, webAppUrl, chatId, messageId, callbackId, query } = input;

  const advancedPickMatch = data.match(/^adv_personality:pick:(engineer|investor|strategist)$/);
  if (advancedPickMatch) {
    const player = await resolveOrCreateTelegramPlayer(query.from);
    if (!canSelectAdvancedPersonality(player)) {
      return { handled: true as const, callbackText: "Выбор недоступен" };
    }
    const selectedId = advancedPickMatch[1] as AdvancedPersonalityId;
    const selected = getAdvancedPersonalityById(selectedId);
    if (!selected) {
      return { handled: true as const, callbackText: "Характер не найден" };
    }

    await setAdvancedPersonality(player.id, selected.id);
    pendingActionByChatId.delete(chatId);
    const snapshot = await getUserWithGameState(player.id);
    const profileText = snapshot ? await formatPlayerProfile(snapshot) : "Профиль обновлён.";
    await sendWithMainKeyboard(token, chatId, [
      `✅ Второй характер выбран: ${selected.emoji} ${selected.name}`,
      "",
      profileText,
    ].join("\n"));
    return { handled: true as const, callbackText: "Характер выбран" };
  }

  const professionPickMatch = data.match(/^profession:pick:(backend|qa|designer|analyst|devops)$/);
  if (professionPickMatch) {
    const player = await resolveOrCreateTelegramPlayer(query.from);
    if (!canSelectProfession(player)) {
      return { handled: true as const, callbackText: "Выбор недоступен" };
    }
    const selectedId = professionPickMatch[1] as ProfessionId;
    const selected = getProfessionById(selectedId);
    if (!selected) {
      return { handled: true as const, callbackText: "Профессия не найдена" };
    }

    await setPlayerProfession(player.id, selected.id);
    pendingActionByChatId.delete(chatId);
    await sendWithCurrentHubKeyboard(token, chatId, player.id, buildProfessionConfirmText(selected));
    return { handled: true as const, callbackText: "Профессия выбрана" };
  }

  const inventoryCallback = await inventoryTelegramModule.handleCallback({
    data,
    token,
    webAppUrl,
    chatId,
    messageId,
    callbackId,
    query,
  });
  if (inventoryCallback.handled) {
    return inventoryCallback;
  }

  if (data === "quest:refresh") {
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
    return { handled: true as const, callbackText: "Квесты" };
  }

  if (data === "quest:claim" || data === "quest:reputation" || data === "quest:rating") {
    const command = data === "quest:claim" ? "/quest_claim" : data === "quest:reputation" ? "/reputation" : "/rating";
    const callbackText = data === "quest:claim" ? "Награда квеста" : data === "quest:reputation" ? "Репутация" : "Рейтинг";
    await handleIncomingMessage(token, webAppUrl, {
      chat: { id: chatId },
      from: query.from,
      text: command,
    });
    return { handled: true as const, callbackText };
  }

  return { handled: false as const };
}

async function tryHandleTelegramUtilityCallback(input: {
  data: string;
  token: string;
  webAppUrl: string;
  chatId: number;
  messageId?: number;
  callbackId: string;
  query: TelegramCallbackQuery;
}) {
  const { data, token, webAppUrl, chatId, messageId, callbackId, query } = input;

  if (data === "auction:locked") {
    await answerCallbackQuery(token, callbackId, "Первые 20 минут лот доступен только компании-разработчику");
    return { handled: true as const, callbackText: "Лот недоступен", shouldClearInlineButtons: false };
  }

  const auctionBuyMatch = data.match(/^auction:buy:(.+)$/);
  if (auctionBuyMatch) {
    const player = await resolveOrCreateTelegramPlayer(query.from);
    if (!(await ensureCityHubAccess(token, chatId, player, { chat: { id: chatId }, from: query.from, text: "/auction" }))) {
      return { handled: true as const, callbackText: "Покупка лота" };
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
      return { handled: true as const, callbackText: "Покупка лота", shouldClearInlineButtons: false };
    } catch (error) {
      await sendWithCityHubKeyboard(token, chatId, `❌ ${extractErrorMessage(error)}`);
      return { handled: true as const, callbackText: "Покупка лота" };
    }
  }

  const auctionBidMatch = data.match(/^auction:bid:(.+)$/);
  if (auctionBidMatch) {
    const player = await resolveOrCreateTelegramPlayer(query.from);
    if (!(await ensureCityHubAccess(token, chatId, player, { chat: { id: chatId }, from: query.from, text: "/auction" }))) {
      return { handled: true as const, callbackText: "Ставка" };
    }
    pendingActionByChatId.set(chatId, { type: "auction_bid_amount", listingId: auctionBidMatch[1] });
    await sendWithCityHubKeyboard(token, chatId, "Введи сумму ставки в GRM.");
    return { handled: true as const, callbackText: "Ставка", shouldClearInlineButtons: false };
  }

  const ratingMatch = data.match(/^rating:(players|companies):(level|reputation|wealth|blueprints|pvp)$/);
  if (ratingMatch) {
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
    return { handled: true as const, callbackText: "Рейтинг" };
  }

  return { handled: false as const };
}

async function tryHandleTelegramCommerceCallback(input: {
  data: string;
  token: string;
  chatId: number;
  callbackId: string;
  query: TelegramCallbackQuery;
}) {
  const { data, token, chatId, callbackId, query } = input;

  if (data === "cauction:locked") {
    await answerCallbackQuery(token, callbackId, "Лот сейчас недоступен.");
    return { handled: true as const };
  }

  if (data === "cauction:refresh") {
    const player = await resolveOrCreateTelegramPlayer(query.from);
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership) {
      await sendWithMainKeyboard(token, chatId, "Ты не состоишь в компании. Нажми кнопку «🏢 Компания».");
      return { handled: true as const };
    }
    await sendCompanyAuctionSection(token, chatId, membership, player.id);
    return { handled: true as const };
  }

  const companyAuctionListMatch = data.match(/^cauction:list:(.+)$/);
  if (companyAuctionListMatch) {
    const player = await resolveOrCreateTelegramPlayer(query.from);
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership) {
      await sendWithMainKeyboard(token, chatId, "Ты не состоишь в компании. Нажми кнопку «🏢 Компания».");
      return { handled: true as const };
    }
    const rawRef = String(companyAuctionListMatch[1] || "").trim();
    const normalizedRef = /^\d+$/.test(rawRef) ? rawRef : rawRef.toLowerCase();
    const partRef = resolveWarehousePartRefFromChat(chatId, normalizedRef);
    const label = partRef
      ? formatWarehousePartLine(getCompanyWarehouseParts(membership.company.id).find((item) => `${item.id}::${String(item.quality || item.rarity || "Common")}` === partRef) ?? { name: "Запчасть" })
      : String(((await getCompanyBlueprintSnapshot(membership.company.id))?.produced ?? []).find((item: any) => item.id === resolveWarehouseGadgetRefFromChat(chatId, normalizedRef))?.name || `Гаджет ${normalizedRef}`);
    pendingActionByChatId.set(chatId, { type: "company_auction_list_price", ref: normalizedRef, label });
    await sendMessage(token, chatId, [
      `🏷 Подготовка лота: ${label}`,
      "Введи стартовую цену и часы аукциона.",
      "Пример: 500 2",
    ].join("\n"), {
      reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
    });
    return { handled: true as const };
  }

  const companyAuctionBuyMatch = data.match(/^cauction:buy:(.+)$/);
  if (companyAuctionBuyMatch) {
    const player = await resolveOrCreateTelegramPlayer(query.from);
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership) {
      await sendWithMainKeyboard(token, chatId, "Ты не состоишь в компании. Нажми кнопку «🏢 Компания».");
      return { handled: true as const };
    }
    try {
      await callInternalApi("POST", "/api/market/buy", { listingId: companyAuctionBuyMatch[1], buyerId: player.id });
      await sendMessage(token, chatId, "✅ Лот куплен.", {
        reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
      });
      await sendCompanyAuctionSection(token, chatId, membership, player.id);
    } catch (error) {
      await sendMessage(token, chatId, `❌ ${extractErrorMessage(error)}`, {
        reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
      });
    }
    return { handled: true as const };
  }

  const companyAuctionBidMatch = data.match(/^cauction:bid:(.+)$/);
  if (companyAuctionBidMatch) {
    const player = await resolveOrCreateTelegramPlayer(query.from);
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership) {
      await sendWithMainKeyboard(token, chatId, "Ты не состоишь в компании. Нажми кнопку «🏢 Компания».");
      return { handled: true as const };
    }
    pendingActionByChatId.set(chatId, {
      type: "auction_bid_amount",
      listingId: companyAuctionBidMatch[1],
      source: "company",
    });
    await sendMessage(token, chatId, "Введи сумму ставки в GRM, например: 150.", {
      reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
    });
    return { handled: true as const };
  }

  return { handled: false as const };
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
    const items = listShopItems(snapshot.user.city).filter((item) => tab === "parts" ? item.type === "consumable" : item.type === "gear");
    shopBuyRefsByChatId.set(chatId, items.map((item) => item.id));
    pendingActionByChatId.set(chatId, { type: "shop_buy" });
  } else {
    shopBuyRefsByChatId.delete(chatId);
    pendingActionByChatId.delete(chatId);
  }
  const selectionMarkup = buildShopSelectionInlineMarkup(snapshot, tab);
  await sendMessage(
    token,
    chatId,
    formatShopMenu(snapshot, tab),
    selectionMarkup ? { reply_markup: selectionMarkup } : { reply_markup: SHOP_MENU_REPLY_MARKUP },
  );
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
  await sendCityHubSummaryBase({
    token,
    chatId,
    userId,
    prefix,
    rememberTelegramMenu,
    getCityHubSummaryText,
    sendWithCityHubKeyboard,
  });
}

async function sendHomeMenu(token: string, chatId: number, snapshot: Snapshot, userId: string, prefix?: string) {
  await sendHomeMenuBase({
    token,
    chatId,
    snapshot,
    userId,
    prefix,
    rememberTelegramMenu,
    shouldSuppressNonRegistrationMessages,
    formatNotices,
    buildBotModeMessage,
    sendWithHomeKeyboard,
  });
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
  await restoreTelegramMenuStateBase({
    token,
    chatId,
    player,
    message,
    prefix,
    getLastTelegramMenuState,
    resolveTelegramSnapshot,
    sendHomeMenu,
    rememberTelegramMenu,
    sendWithExtrasKeyboard,
    setPlayerHubLocation,
    sendCityHubSummary,
    sendRepairServiceMenu,
    storage,
    getActiveHousing,
    getStarterHousingForCity,
    formatHousingMenuText,
    sendHousingCard,
    pendingActionByChatId,
    formatJobsMenu,
    listJobsByCity,
    getPlayerProfessionId,
    buildJobsInlineMarkup,
    sendMessage,
    formatEducationLevelsMenu,
    buildEducationLevelsReplyMarkup,
    formatEducationCoursesMenu,
    buildEducationCoursesReplyMarkup,
    sendShopMenu,
    formatBankMenu,
    sendWithBankKeyboard,
    setCompanyMenuSection,
    getPlayerCompanyContext,
    sendCompanyRootMenu,
    buildCompanyReplyMarkup,
    sendCompanyWorkSection,
    sendCompanyWarehouseSection,
    sendCompanyRepairServiceMenu,
    sendCompanyBureauSection,
    sendCompanyManagementSection,
    sendCompanyDepartmentsSection,
    sendWithCurrentHubKeyboard,
  });
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
  pvpTelegramModule.stopQueuePolling(chatId);

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
  if (pendingAction?.type === "gadget_catalog") {
    const snapshot = await resolveTelegramSnapshot(message.from);
    await sendHomeMenu(token, chatId, snapshot, player.id);
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
    || pendingAction?.type === "company_part_sell"
    || pendingAction?.type === "company_part_sell_qty"
    || pendingAction?.type === "company_auction_list_price"
    || pendingAction?.type === "company_contract_parts"
    || pendingAction?.type === "company_exclusive_parts"
    || pendingAction?.type === "company_exclusive_confirm"
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
  if (action === "shop") return "покупка или продажа в магазине";
  if (action === "bank") return "банковая операция";
  if (action === "company_action") return "действие компании";
  if (action === "auction") return "ставка на аукционе";
  return "перемещение";
}

function isCommandCompatibleWithExclusiveAction(command: string, current: ExclusiveActionIntent) {
  const cmd = String(command || "").toLowerCase();
  if (
    cmd === "/cancel"
    || cmd === "/help"
    || cmd === "/updates"
    || cmd === "/changes"
    || cmd === "/tutorial"
    || cmd === "/onboarding"
    || cmd === "/quests"
    || cmd === "/quest"
    || cmd === "/quest_claim"
    || cmd === "/reputation"
    || cmd === "/rep"
  ) return true;

  if (current === "job") {
    return cmd === "/jobs" || cmd === "/job";
  }

  if (current === "study") {
    return cmd === "/study";
  }

  if (current === "shop") {
    return (
      cmd === "/shop"
      || cmd === "/shop_courses"
      || cmd === "/shop_gadgets"
      || cmd === "/inventory"
      || cmd === "/sell"
      || cmd === "/use"
      || cmd === "/equip"
      || cmd === "/service"
      || cmd === "/scrap"
    );
  }

  if (current === "bank") {
    return (
      cmd === "/bank"
      || cmd === "/gram"
      || cmd === "/credits"
      || cmd === "/deposits"
      || cmd === "/stocks"
      || cmd === "/stocks_news"
    );
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

  if (current === "company_action") {
    return (
      cmd === "/company"
      || cmd === "/company_back"
      || cmd === "/company_work"
      || cmd === "/company_warehouse"
      || cmd === "/company_bureau"
      || cmd === "/company_management"
      || cmd === "/company_part_deposit"
      || cmd === "/company_part_sell"
      || cmd === "/company_auction"
      || cmd === "/cpd"
      || cmd === "/company_requests"
      || cmd === "/company_departments"
      || cmd === "/company_salaries"
      || cmd === "/company_topup"
      || cmd === "/company_exclusive"
      || cmd === "/company_exclusive_start"
      || cmd === "/company_exclusive_progress"
      || cmd === "/company_exclusive_produce"
      || cmd === "/company_bp_produce"
    );
  }

  if (current === "auction") {
    return cmd === "/auction";
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
  if (pending.type === "shop_buy" || pending.type === "shop_sell") return "shop";
  if (
    pending.type === "open_bank_product"
    || pending.type === "exchange_to_gram"
    || pending.type === "exchange_from_gram"
    || pending.type === "stocks_buy_select"
    || pending.type === "stocks_buy_qty"
    || pending.type === "stocks_sell_select"
    || pending.type === "stocks_sell_qty"
  ) return "bank";
  if (pending.type === "auction_bid_amount") return "auction";
  if (
    pending.type === "company_part_deposit"
    || pending.type === "company_part_deposit_qty"
    || pending.type === "company_part_sell"
    || pending.type === "company_part_sell_qty"
    || pending.type === "company_auction_list_price"
    || pending.type === "company_contract_parts"
    || pending.type === "company_topup"
    || pending.type === "company_set_salary_amount"
    || pending.type === "company_exclusive_parts"
    || pending.type === "company_exclusive_confirm"
    || pending.type === "company_bp_produce_qty"
    || pending.type === "company_bp_produce_confirm"
    || pending.type === "company_exclusive_produce_select"
    || pending.type === "company_exclusive_produce_qty"
    || pending.type === "company_exclusive_produce_confirm"
  ) return "company_action";
  return null;
}

function isReplyNavigationCommand(command: string) {
  const cmd = String(command || "").toLowerCase();
  return [
    "/menu",
    "/profile",
    "/inventory",
    "/city_hub",
    "/jobs",
    "/study",
    "/shop",
    "/bank",
    "/housing",
    "/auction",
    "/company",
    "/extras",
  ].includes(cmd);
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
        `⛔ ${actionLabel} недоступен, пока идёт EX-апгрейд гаджета.\nОткрой раздел эксклюзивов и дождись завершения таймера.`,
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
      const commandHint = withQuickCommands ? `  · /cpd${index + 1}` : "";
      return `${index + 1}. ${formatInventoryPartName(item)} x${qty} [Запчасть]${commandHint}`;
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
  const userId = getUserIdByTelegramId(String(chatId));
  let replyMarkup = MAIN_MENU_REPLY_MARKUP;
  if (userId) {
    try {
      const tutorialSnapshot = await getTutorialSnapshotByUser(userId);
      replyMarkup = buildMainMenuReplyMarkup(!tutorialSnapshot.state.isCompleted);
    } catch {
      replyMarkup = MAIN_MENU_REPLY_MARKUP;
    }
  }
  await sendMessage(token, chatId, text, { reply_markup: replyMarkup });
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
    sendWithMainKeyboard: async (input) => sendWithMainKeyboardBase({
      token: input.token,
      chatId: input.chatId,
      text: input.text,
      getUserIdByTelegramId: input.getUserIdByTelegramId,
      getTutorialSnapshotByUser: input.getTutorialSnapshotByUser,
      getLastTelegramMenuState: input.getLastTelegramMenuState,
    }),
    getUserIdByTelegramId,
    getTutorialSnapshotByUser,
    getLastTelegramMenuState,
  });
}

async function sendWithExtrasKeyboard(token: string, chatId: number, text: string) {
  await sendWithExtrasKeyboardBase(token, chatId, text);
}

function formatCompanyPartSellList(membership: CompanyContext, chatId: number) {
  const warehouseParts = getCompanyWarehouseParts(membership.company.id);
  companyPartSellRefsByChatId.set(chatId, warehouseParts.map((item) => String(item.id)));
  if (!warehouseParts.length) {
    return "❌ На складе компании нет запчастей для продажи.";
  }

  return [
    "💸 Продажа запчастей со склада компании",
    "━━━━━━━━━━━━━━",
    ...warehouseParts.map((item, index) => {
      const unitPrice = getCompanyPartSellPrice(item);
      const quantity = Math.max(1, Number(item.quantity) || 1);
      const totalPrice = unitPrice * quantity;
      return [
        `${index + 1}. ${formatWarehousePartLine(item)}`,
        `Цена продажи: ${formatNumber(unitPrice)} GRM за 1 • всего ${formatNumber(totalPrice)} GRM`,
        `Продать: /company_part_sell ${index + 1} [кол-во]`,
      ].join("\n");
    }),
    "",
    "Выбери запчасть кнопкой ниже или используй команду /company_part_sell 1 3",
  ].join("\n\n");
}

async function sendWithRatingKeyboard(token: string, chatId: number, text: string) {
  await sendMessage(token, chatId, text, {
    reply_markup: buildRatingReplyMarkup(),
  });
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
    pendingAction.type === "company_exclusive_parts"
    || pendingAction.type === "company_exclusive_confirm"
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

  if (pendingAction.type === "gadget_catalog") {
    const normalizedText = text.trim().toLowerCase();
    if (normalizedText === "◀️ пред".toLowerCase()) {
      await sendGadgetCatalogPage(token, chatId, Math.max(0, pendingAction.page - 1));
      return true;
    }
    if (normalizedText === "▶️ след".toLowerCase()) {
      await sendGadgetCatalogPage(token, chatId, pendingAction.page + 1);
      return true;
    }
    if (normalizedText === "🏠 домой".toLowerCase()) {
      pendingActionByChatId.delete(chatId);
      const player = await resolveOrCreateTelegramPlayer(message.from);
      const snapshot = await resolveTelegramSnapshot(message.from);
      await sendHomeMenu(token, chatId, snapshot, player.id);
      return true;
    }
  }

  const normalizedCommand = normalizeCommand(text).command;
  if (normalizedCommand === "/tutorial" || normalizedCommand === "/onboarding") {
    clearPendingActionRuntimeState(chatId, pendingAction);
    return false;
  }
  const allowSlashCommandsInsidePending =
    pendingAction.type === "company_exclusive_parts"
    || pendingAction.type === "company_exclusive_confirm"
    && (
      /^\/det\d+$/i.test(text.trim())
      || /^\/det_done$/i.test(text.trim())
      || /^\/det_reset$/i.test(text.trim())
      || normalizedCommand === "/company_back"
      || normalizedCommand === "/cancel"
    )
    || pendingAction.type === "company_auction_list_price"
    || pendingAction.type === "company_part_sell"
    || pendingAction.type === "company_part_sell_qty"
    && (
      normalizedCommand === "/company_auction"
      || normalizedCommand === "/company_warehouse"
      || normalizedCommand === "/company_back"
      || normalizedCommand === "/company"
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
    "company_part_sell",
    "company_part_sell_qty",
    "company_auction_list_price",
    "company_contract_parts",
    "company_topup",
    "company_bp_produce_qty",
    "company_bp_produce_confirm",
    "company_exclusive_confirm",
    "company_exclusive_produce_select",
    "company_exclusive_produce_qty",
    "company_exclusive_produce_confirm",
    "study_level_select",
    "study_course_select",
    "admin_auth",
    "admin_add_money",
    "admin_add_exp",
    "admin_company_gadget_company",
    "admin_company_gadget_gadget",
    "admin_company_gadget_qty",
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
      || pendingAction.type === "company_auction_list_price"
      || pendingAction.type === "company_part_sell"
      || pendingAction.type === "company_part_sell_qty"
    )
  ) {
    return false;
  }

  if (await registrationTelegramModule.handlePendingAction({
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
    resolveTelegramRegistrationStep: (user: User, innerChatId: number) => registrationTelegramModule.resolveStep(user, innerChatId),
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
      await sendMessage(token, chatId, `❌ ${result.message}\nВыбери вакансию кнопкой ниже, другую кнопку меню или отправь номер ещё раз.`);
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
      pendingActionByChatId.delete(chatId);
      const weeklyQuestProgress = updateWeeklyQuestProgress(result.user, "shop", 1);
      const lines = [
        formatShopPurchaseResultText({
        itemName: result.item.name,
        balance: result.user.balance,
        city: result.user.city,
        price: Number(result.item.price || 0),
        tutorialAdvance,
      }),
      ];
      const weeklyQuestNotice = formatWeeklyQuestProgressNotice(weeklyQuestProgress);
      if (weeklyQuestNotice) lines.push("", weeklyQuestNotice);
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
        "Неверный формат.\nВведи: номер сумма\nПример: 1 800",
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
      await sendWithMainKeyboard(token, chatId, "Компания не найдена. Открой раздел «🏢 Компания» и попробуй снова.");
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
        `✅ Компания пополнена: -${getCurrencySymbol(player.city)}${formatNumber(topUp.spentLocal)}, +${formatNumber(topUp.receivedGRM)} GRM`,
        `Личный баланс: ${getCurrencySymbol(player.city)}${formatNumber(topUp.playerBalanceAfter)}`,
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
      await sendWithMainKeyboard(token, chatId, "Компания не найдена. Открой раздел «🏢 Компания» и попробуй снова.");
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

  if (pendingAction.type === "company_auction_list_price") {
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership) {
      pendingActionByChatId.delete(chatId);
      await sendWithMainKeyboard(token, chatId, "Ты не состоишь в компании. Нажми кнопку «🏢 Компания».");
      return true;
    }
    if (!canManageCompanyAssets({ actorUserId: player.id, companyOwnerId: membership.company.ownerId, role: membership.role })) {
      pendingActionByChatId.delete(chatId);
      await sendMessage(token, chatId, COMPANY_ASSET_MANAGER_ERROR, {
        reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
      });
      return true;
    }
    const backToCompanyAlias =
      aliasCommand === "/company_auction"
      || aliasCommand === "/company_warehouse"
      || aliasCommand === "/company_part_sell"
      || aliasCommand === "/company_back"
      || normalizedCommand === "/company_auction"
      || normalizedCommand === "/company_warehouse"
      || normalizedCommand === "/company_part_sell"
      || normalizedCommand === "/company_back"
      || normalizedCommand === "/company"
      || normalizedCommand === "/cancel";
    if (backToCompanyAlias) {
      clearPendingActionRuntimeState(chatId, pendingAction);
      return false;
    }
    const [priceRaw, hoursRaw] = text.trim().split(/\s+/);
    const price = Math.floor(Number(priceRaw || 0));
    const durationHours = Math.max(2, Math.min(12, Math.floor(Number(hoursRaw || 2) || 2)));
    if (!Number.isFinite(price) || price <= 0) {
      await sendMessage(token, chatId, "Неверный формат. Введи: цена [часы]. Пример: 500 2", {
        reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
      });
      return true;
    }
    try {
      const partRef = resolveWarehousePartRefFromChat(chatId, pendingAction.ref);
      const gadgetId = partRef ? undefined : resolveWarehouseGadgetRefFromChat(chatId, pendingAction.ref);
      await callInternalApi("POST", `/api/companies/${membership.company.id}/market/list`, {
        userId: player.id,
        gadgetId,
        partRef,
        price,
        mode: "auction",
        durationHours,
      });
      pendingActionByChatId.delete(chatId);
      await sendMessage(token, chatId, `✅ Лот выставлен: ${pendingAction.label}\nСтартовая цена: ${formatNumber(price)} GRM\nДлительность: ${durationHours} ч.`, {
        reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
      });
      await sendCompanyAuctionSection(token, chatId, membership, player.id);
    } catch (error) {
      await sendMessage(token, chatId, `❌ ${extractErrorMessage(error)}`, {
        reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
      });
    }
    return true;
  }

  if (pendingAction.type === "auction_bid_amount") {
    const amount = Number(text.trim());
    if (!Number.isFinite(amount) || amount <= 0) {
      if (pendingAction.source === "company") {
        const membership = await getPlayerCompanyContext(player.id);
        if (membership) {
          await sendMessage(token, chatId, "Неверный формат. Введи сумму ставки в GRM, например: 150.", {
            reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
          });
          return true;
        }
      }
      await sendWithCityHubKeyboard(token, chatId, "Неверный формат. Введи сумму ставки в GRM, например: 150.");
      return true;
    }
    try {
      await callInternalApi("POST", "/api/market/bid", { listingId: pendingAction.listingId, bidderId: player.id, amount });
      pendingActionByChatId.delete(chatId);
      if (pendingAction.source === "company") {
        const membership = await getPlayerCompanyContext(player.id);
        if (membership) {
          await sendMessage(token, chatId, "✅ Ставка принята.", {
            reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
          });
          await sendCompanyAuctionSection(token, chatId, membership, player.id);
          return true;
        }
      }
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
      await sendWithMainKeyboard(token, chatId, "Ты не состоишь в компании. Нажми кнопку «🏢 Компания».");
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
      await sendMessage(token, chatId, "❌ На склад компании можно добавлять только запчасти. Выбери деталь из списка ниже или нажми «📥 Передать запчасти» заново.");
      return true;
    }

    const availableQty = Math.max(1, Number(partItem.quantity) || 1);
    if (!qtyRaw && availableQty > 1) {
      pendingActionByChatId.set(chatId, { type: "company_part_deposit_qty", partRef: partItem.id });
      await sendMessage(
        token,
        chatId,
        `🧮 Выбрано: ${partItem.name}\nВ наличии: ${availableQty}\n\nВведи количество для переноса (1-${availableQty}) или all.`,
        { reply_markup: buildCompanyReplyMarkup(membership.role, chatId) },
      );
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
      await sendWithMainKeyboard(token, chatId, "Ты не состоишь в компании. Нажми кнопку «🏢 Компания».");
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
    return true;
  }

  if (pendingAction.type === "company_part_sell") {
    const alias = resolvePlainTextAlias(text, chatId);
    if (alias && alias !== "/company_part_sell") {
      pendingActionByChatId.delete(chatId);
      return false;
    }
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership) {
      pendingActionByChatId.delete(chatId);
      await sendWithMainKeyboard(token, chatId, "Ты не состоишь в компании. Нажми кнопку «🏢 Компания».");
      return true;
    }
    if (!canManageCompanyAssets({ actorUserId: player.id, companyOwnerId: membership.company.ownerId, role: membership.role })) {
      pendingActionByChatId.delete(chatId);
      await sendMessage(token, chatId, COMPANY_ASSET_MANAGER_ERROR, {
        reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
      });
      return true;
    }

    const [refRaw, qtyRaw] = text.trim().split(/\s+/);
    if (!refRaw) {
      await sendMessage(token, chatId, formatCompanyPartSellList(membership, chatId), {
        reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
      });
      return true;
    }

    const partRef = resolveCompanyPartSellRefFromChat(chatId, refRaw);
    const warehouseParts = getCompanyWarehouseParts(membership.company.id);
    const partItem = warehouseParts.find((item) => String(item.id) === String(partRef));
    if (!partItem) {
      await sendMessage(token, chatId, "❌ Запчасть не найдена на складе компании. Выбери позицию из списка ниже.");
      return true;
    }

    const availableQty = Math.max(1, Number(partItem.quantity) || 1);
    if (!qtyRaw && availableQty > 1) {
      pendingActionByChatId.set(chatId, { type: "company_part_sell_qty", partRef: String(partItem.id) });
      await sendMessage(
        token,
        chatId,
        `💸 Выбрано: ${partItem.name}\nНа складе: ${availableQty}\nЦена за 1: ${formatNumber(getCompanyPartSellPrice(partItem))} GRM\n\nВведи количество для продажи (1-${availableQty}) или all.`,
        { reply_markup: buildCompanyReplyMarkup(membership.role, chatId) },
      );
      return true;
    }

    const result = await sellCompanyWarehousePart(membership, partRef, qtyRaw, player.id);
    if (!result.ok) {
      await sendMessage(token, chatId, `❌ ${result.error}`);
      return true;
    }
    pendingActionByChatId.delete(chatId);
    await sendMessage(
      token,
      chatId,
      `✅ Со склада компании продано: ${result.partName} x${result.sellQty}\n+${formatNumber(result.earnedGrm)} GRM\nКапитал компании: ${formatNumber(result.companyCapitalGrm)} GRM`,
      { reply_markup: buildCompanyReplyMarkup(membership.role, chatId) },
    );
    return true;
  }

  if (pendingAction.type === "company_part_sell_qty") {
    const membership = await getPlayerCompanyContext(player.id);
    if (!membership) {
      pendingActionByChatId.delete(chatId);
      await sendWithMainKeyboard(token, chatId, "Ты не состоишь в компании. Нажми кнопку «🏢 Компания».");
      return true;
    }
    if (!canManageCompanyAssets({ actorUserId: player.id, companyOwnerId: membership.company.ownerId, role: membership.role })) {
      pendingActionByChatId.delete(chatId);
      await sendMessage(token, chatId, COMPANY_ASSET_MANAGER_ERROR, {
        reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
      });
      return true;
    }
    const qtyText = text.trim().toLowerCase();
    if (!qtyText) {
      await sendMessage(token, chatId, "Введи количество для продажи (например: 2 или all).");
      return true;
    }
    const result = await sellCompanyWarehousePart(membership, pendingAction.partRef, qtyText, player.id);
    if (!result.ok) {
      await sendMessage(token, chatId, `❌ ${result.error}`);
      return true;
    }
    pendingActionByChatId.delete(chatId);
    await sendMessage(
      token,
      chatId,
      `✅ Со склада компании продано: ${result.partName} x${result.sellQty}\n+${formatNumber(result.earnedGrm)} GRM\nКапитал компании: ${formatNumber(result.companyCapitalGrm)} GRM`,
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
      await sendCompanyExclusivePartsPicker(
        token,
        chatId,
        membership,
        player.id,
        pendingAction.gadgetName,
        pendingAction.gadgetCategory,
        pendingAction.gadgetBatchAvailable,
      );
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
      if (selectedRefs.length >= EXCLUSIVE_UPGRADE_REQUIRED_PARTS) {
          await sendMessage(token, chatId, `❌ Нужно выбрать ровно ${EXCLUSIVE_UPGRADE_REQUIRED_PARTS} деталей. Нажми /det_done или /det_reset.`);
          return true;
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
        pendingAction.gadgetCategory,
        pendingAction.gadgetBatchAvailable,
      );
      return true;
    }

    if (!/^\/det_done$/i.test(normalizedText)) {
      await sendMessage(token, chatId, "Используй кнопки под сообщением, чтобы выбрать детали. Когда закончишь, нажми «🚀 Готово».", {
        reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
      });
      return true;
    }
    const partRefs = selectedRefs;
    if (partRefs.length !== EXCLUSIVE_UPGRADE_REQUIRED_PARTS) {
      await sendMessage(token, chatId, `❌ Для эксклюзивного апгрейда нужно выбрать ровно ${EXCLUSIVE_UPGRADE_REQUIRED_PARTS} деталей. Отмечай их кнопками под сообщением.`, {
        reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
      });
      return true;
    }
    const pickedParts = getCompanyWarehouseParts(membership.company.id)
      .map((item) => ({ ...item, ref: `${item.id}::${item.rarity}` }))
      .filter((item) => partRefs.includes(item.ref))
      .map((item) => ({
        id: item.id,
        rarity: String(item.rarity || "Common"),
        type: String(item.type || ALL_PARTS[item.id]?.type || "processor"),
        name: String(item.name || ALL_PARTS[item.id]?.name || item.id),
      }));
    try {
      const preview = await previewCompanyExclusiveUpgrade(
        membership.company.id,
        player.id,
        String(pendingAction.gadgetId || ""),
        pickedParts,
      );
      pendingActionByChatId.set(chatId, {
        type: "company_exclusive_confirm",
        gadgetName: pendingAction.gadgetName,
        gadgetId: String(pendingAction.gadgetId || ""),
        partRefs,
      });
      await sendMessage(
        token,
        chatId,
        [
          `🌟 EX-апгрейд: ${pendingAction.gadgetName}`,
          `Цель: EX+${Math.max(1, Number(preview.blueprint?.upgradeLevel || 1))}`,
          `Шанс успеха: ${Math.round(Number(preview.blueprint?.successChance || 0) * 100)}%`,
          `Стоимость запуска: ${formatNumber(Number(preview.blueprint?.developmentCostGrm || 0))} GRM`,
          `Время апгрейда: ${formatDurationShort(Number(preview.blueprint?.developmentHoursRequired || 0) * 60 * 60 * 1000)}`,
          preview.companyBalanceAfterStart !== undefined ? `Баланс компании после старта: ${formatNumber(Number(preview.companyBalanceAfterStart || 0))} GRM` : "",
          "",
          "Подтверди запуск или вернись к подбору деталей.",
        ].filter(Boolean).join("\n"),
        { reply_markup: buildCompanyExclusiveUpgradeConfirmInlineMarkup() },
      );
    } catch (error) {
      await sendMessage(token, chatId, `❌ ${extractErrorMessage(error)}`, {
        reply_markup: buildCompanyReplyMarkup(membership.role, chatId),
      });
    }
    return true;
  }

  if (pendingAction.type === "company_exclusive_confirm") {
    if (text.trim().startsWith("/")) return false;
    await sendMessage(token, chatId, "Подтверди запуск EX-апгрейда кнопкой под предыдущим сообщением или вернись к деталям.", {
      reply_markup: buildCompanyExclusiveUpgradeConfirmInlineMarkup(),
    });
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
      await sendMessage(token, chatId, "Выбери готовый EX-апгрейд кнопкой ниже или нажми «⬅️ Назад».", {
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
    const professionId = getPlayerProfessionId(player);
    const baseSkillCap = getTrainingSkillCapForLevel(player.level);
    const canGrowAnySkill = Object.entries(course.skillBoosts).some(([key, boost]) => {
      if (!(key in nextSkills) || !(key in baseSkills)) return false;
      const skillCap = getTrainingSkillCapForLevel(player.level, key as SkillName, professionId);
      return Number(baseSkills[key as SkillName] || 0) < skillCap && Number(boost || 0) > 0;
    });
    if (!canGrowAnySkill) {
      pendingActionByChatId.delete(chatId);
      await sendMessage(
        token,
        chatId,
        `❌ Навыки этого курса уже упираются в потолок уровня (${baseSkillCap}). Подними уровень и попробуй снова.`,
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
      const skillCap = getTrainingSkillCapForLevel(player.level, skill, professionId);
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
        `❌ После ограничения уровня курс не даст прироста. Потолок навыков сейчас: ${baseSkillCap}.`,
        { reply_markup: STUDY_RESULT_REPLY_MARKUP },
      );
      return true;
    }

    applyGameStatePatch(player.id, { skills: nextSkills, studyTime: nextStudyTime });
    const tutorialAdvance = await tryApplyTutorialEvent(player.id, "first_education_started");
    const weeklyQuestProgress = updateWeeklyQuestProgress(updatedUser, "study", 1);

    const continueTutorialLine = formatTutorialAdvanceNotice(tutorialAdvance, player.city) || await getTutorialContinueLine(player.id);
    const weeklyQuestNotice = formatWeeklyQuestProgressNotice(weeklyQuestProgress);
    const resultingCap = Object.keys(appliedBoosts).reduce((best, skillKey) => {
      return Math.max(best, getTrainingSkillCapForLevel(player.level, skillKey as SkillName, professionId));
    }, baseSkillCap);

    await sendMessage(
      token,
      chatId,
      [
        `✅ Курс завершён: ${course.icon} ${course.name}`,
        `-${getCurrencySymbol(updatedUser.city)}${courseCost}, +${reputationGain} репутации`,
        `Навыки: ${formatStats(appliedBoosts as Record<string, number>)}`,
        `Потолок навыков от обучения на этом уровне: ${resultingCap}`,
        citySkillProc ? "🏙 Бонус города: +1 к каждому навыку курса." : "",
        luckyProc ? "🍀 Удача: +1 к каждому навыку курса." : "",
        `⚡ Потрачено энергии учёбы: ${Math.round(studyEnergyCost * 100)}`,
        `⚡ Остаток энергии учёбы: ${formatEnergyPercent(nextStudyTime)}`,
        `💰 Остаток денег: ${getCurrencySymbol(updatedUser.city)}${formatNumber(updatedUser.balance)}`,
        weeklyQuestNotice || "",
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
      await maybePromptProfession(token, chatId, updated, { force: false });
    }
    return true;
  }

  if (pendingAction.type === "admin_updates_date") {
    if (!adminAuthByChatId.get(chatId)) {
      pendingActionByChatId.delete(chatId);
      await sendWithMainKeyboard(token, chatId, "❌ Сначала авторизуйся: /admin <пароль>");
      return true;
    }

    const requestedDate = normalizeChangelogDateInput(text);
    if (!requestedDate) {
      await sendWithAdminKeyboard(token, chatId, "Введи дату в формате YYYY-MM-DD. Пример: 2026-03-30");
      return true;
    }

    pendingActionByChatId.delete(chatId);
    const entry = getChangelogEntryByDate(requestedDate);
    await sendWithAdminKeyboard(
      token,
      chatId,
      entry
        ? formatChangelogDetailedMessage(entry)
        : `За ${formatChangelogDateLabel(requestedDate)} обновления не найдены.`,
    );
    return true;
  }

  if (pendingAction.type === "admin_company_gadget_company") {
    if (!adminAuthByChatId.get(chatId)) {
      pendingActionByChatId.delete(chatId);
      await sendWithMainKeyboard(token, chatId, "❌ Сначала авторизуйся: /admin <пароль>");
      return true;
    }

    const companyRefs = companyListByChatId.get(chatId) ?? [];
    const pickedIndex = Math.max(0, Number(text.trim()) - 1);
    const companyId = companyRefs[pickedIndex];
    if (!companyId) {
      await sendWithAdminKeyboard(token, chatId, "Выбери компанию номером из списка.");
      return true;
    }

    pendingActionByChatId.set(chatId, { type: "admin_company_gadget_gadget", companyId });
    const company = await storage.getCompany(companyId);
    const lines = [
      `🧩 Компания: ${company?.name || "Компания"}`,
      "Выбери гаджет номером из списка:",
      "",
      ...GADGET_BLUEPRINTS.map((blueprint, index) => `${index + 1}. ${blueprint.name} (${blueprint.category})`),
    ];
    await sendWithAdminKeyboard(token, chatId, lines.join("\n"));
    return true;
  }

  if (pendingAction.type === "admin_company_gadget_gadget") {
    if (!adminAuthByChatId.get(chatId)) {
      pendingActionByChatId.delete(chatId);
      await sendWithMainKeyboard(token, chatId, "❌ Сначала авторизуйся: /admin <пароль>");
      return true;
    }

    const pickedIndex = Math.max(0, Number(text.trim()) - 1);
    const blueprint = GADGET_BLUEPRINTS[pickedIndex];
    if (!blueprint) {
      await sendWithAdminKeyboard(token, chatId, "Выбери гаджет номером из списка.");
      return true;
    }

    pendingActionByChatId.set(chatId, {
      type: "admin_company_gadget_qty",
      companyId: pendingAction.companyId,
      blueprintId: blueprint.id,
      blueprintName: blueprint.name,
    });
    await sendWithAdminKeyboard(
      token,
      chatId,
      `🧩 ${blueprint.name}\nВведи количество гаджетов для добавления в компанию.`,
    );
    return true;
  }

  if (pendingAction.type === "admin_company_gadget_qty") {
    if (!adminAuthByChatId.get(chatId)) {
      pendingActionByChatId.delete(chatId);
      await sendWithMainKeyboard(token, chatId, "❌ Сначала авторизуйся: /admin <пароль>");
      return true;
    }

    const quantity = Math.floor(Number(text.trim()));
    if (!Number.isFinite(quantity) || quantity <= 0) {
      await sendWithAdminKeyboard(token, chatId, "Введи корректное количество больше 0.");
      return true;
    }

    try {
      const result = await callInternalAdminApi("POST", `/api/admin/companies/${pendingAction.companyId}/grant-gadget`, {
        blueprintId: pendingAction.blueprintId,
        quantity,
      });
      pendingActionByChatId.delete(chatId);
      await sendWithAdminKeyboard(
        token,
        chatId,
        [
          "✅ Гаджет добавлен в компанию.",
          `Компания: ${String(result?.companyName || "—")}`,
          `Гаджет: ${String(result?.gadgetName || pendingAction.blueprintName)}`,
          `Количество: ${Number(result?.quantity || quantity)}`,
        ].join("\n"),
      );
    } catch (error) {
      await sendWithAdminKeyboard(token, chatId, `❌ ${extractErrorMessage(error)}`);
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
        `✅ Компания создана: ${company.name}\nСписано: ${getCurrencySymbol(player.city)}${formatNumber(companyCreateCost)}\nОстаток: ${getCurrencySymbol(player.city)}${formatNumber(debited.balance)}`,
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

function buildTelegramCallbackDispatchContext(
  token: string,
  webAppUrl: string,
  query: TelegramCallbackQuery,
): TelegramCallbackDispatchContext | null {
  const chatId = query.message?.chat?.id;
  const data = String(query.data || "").trim();
  if (!chatId || !data) return null;
  return {
    token,
    webAppUrl,
    query,
    chatId,
    messageId: query.message?.message_id,
    callbackId: query.id,
    data,
  };
}

async function dispatchTelegramCallback(ctx: TelegramCallbackDispatchContext): Promise<TelegramCallbackDispatchResult> {
  let callbackText = "Готово";
  let shouldClearInlineButtons = true;

  const hubCallback = await hubTelegramModule.handleCallback({
    data: ctx.data,
    token: ctx.token,
    chatId: ctx.chatId,
    messageId: ctx.messageId,
    query: ctx.query,
  });
  if (hubCallback.handled) {
    return {
      handled: true,
      callbackText: hubCallback.callbackText ?? callbackText,
      shouldClearInlineButtons: "shouldClearInlineButtons" in hubCallback && typeof hubCallback.shouldClearInlineButtons === "boolean"
        ? hubCallback.shouldClearInlineButtons
        : shouldClearInlineButtons,
    };
  }

  const metaCallback = await tryHandleTelegramMetaCallback({
    data: ctx.data,
    token: ctx.token,
    webAppUrl: ctx.webAppUrl,
    chatId: ctx.chatId,
    messageId: ctx.messageId,
    callbackId: ctx.callbackId,
    query: ctx.query,
  });
  if (metaCallback.handled) {
    return {
      handled: true,
      callbackText: metaCallback.callbackText ?? callbackText,
      shouldClearInlineButtons: "shouldClearInlineButtons" in metaCallback && typeof metaCallback.shouldClearInlineButtons === "boolean"
        ? metaCallback.shouldClearInlineButtons
        : shouldClearInlineButtons,
    };
  }

  const featureCallback = await tryHandleTelegramFeatureCallback(
    buildTelegramFeatureCallbackInput(ctx.data, ctx.token, ctx.webAppUrl, ctx.query, ctx.chatId, ctx.messageId, ctx.callbackId),
  );
  if (featureCallback.handled) {
    return {
      handled: true,
      callbackText: featureCallback.callbackText ?? callbackText,
      shouldClearInlineButtons: typeof featureCallback.shouldClearInlineButtons === "boolean"
        ? featureCallback.shouldClearInlineButtons
        : shouldClearInlineButtons,
    };
  }

  const utilityCallback = await tryHandleTelegramUtilityCallback({
    data: ctx.data,
    token: ctx.token,
    webAppUrl: ctx.webAppUrl,
    chatId: ctx.chatId,
    messageId: ctx.messageId,
    callbackId: ctx.callbackId,
    query: ctx.query,
  });
  if (utilityCallback.handled) {
    return {
      handled: true,
      callbackText: utilityCallback.callbackText ?? callbackText,
      shouldClearInlineButtons: "shouldClearInlineButtons" in utilityCallback && typeof utilityCallback.shouldClearInlineButtons === "boolean"
        ? utilityCallback.shouldClearInlineButtons
        : shouldClearInlineButtons,
    };
  }

  const tutorialCallback = await tutorialTelegramModule.handleCallback({
    data: ctx.data,
    token: ctx.token,
    webAppUrl: ctx.webAppUrl,
    chatId: ctx.chatId,
    messageId: ctx.messageId,
    query: ctx.query,
  });
  if (tutorialCallback.handled) {
    return {
      handled: true,
      callbackText: tutorialCallback.callbackText ?? callbackText,
      shouldClearInlineButtons: "shouldClearInlineButtons" in tutorialCallback && typeof tutorialCallback.shouldClearInlineButtons === "boolean"
        ? tutorialCallback.shouldClearInlineButtons
        : shouldClearInlineButtons,
    };
  }

  const hackathonCallback = await handleHackathonCallback({
    data: ctx.data,
    token: ctx.token,
    chatId: ctx.chatId,
    query: ctx.query,
    resolveOrCreateTelegramPlayer,
    getPlayerCompanyContext,
    joinPlayerToWeeklyHackathonTeam,
    sendWithCurrentHubKeyboard,
    formatHackathonMenu,
    extractErrorMessage,
    storage,
  });
  if (hackathonCallback.handled) {
    return {
      handled: true,
      callbackText: hackathonCallback.callbackText ?? callbackText,
      shouldClearInlineButtons: "shouldClearInlineButtons" in hackathonCallback && typeof hackathonCallback.shouldClearInlineButtons === "boolean"
        ? hackathonCallback.shouldClearInlineButtons
        : shouldClearInlineButtons,
    };
  }

  const inventoryCallback = await inventoryTelegramModule.handleCallback({
    data: ctx.data,
    token: ctx.token,
    webAppUrl: ctx.webAppUrl,
    chatId: ctx.chatId,
    messageId: ctx.messageId,
    callbackId: ctx.callbackId,
    query: ctx.query,
  });
  if (inventoryCallback.handled) {
    return {
      handled: true,
      callbackText: inventoryCallback.callbackText ?? callbackText,
      shouldClearInlineButtons: "shouldClearInlineButtons" in inventoryCallback && typeof inventoryCallback.shouldClearInlineButtons === "boolean"
        ? inventoryCallback.shouldClearInlineButtons
        : shouldClearInlineButtons,
    };
  }

  const economyCallback = await economyTelegramModule.handleCallback({
    data: ctx.data,
    token: ctx.token,
    chatId: ctx.chatId,
    query: ctx.query,
  });
  if (economyCallback.handled) {
    return {
      handled: true,
      callbackText: "callbackText" in economyCallback ? economyCallback.callbackText ?? callbackText : callbackText,
      shouldClearInlineButtons,
    };
  }

  const repairCallback = await repairTelegramModule.handleCallback({
    data: ctx.data,
    token: ctx.token,
    chatId: ctx.chatId,
    messageId: ctx.messageId,
    query: ctx.query,
  });
  if (repairCallback.handled) {
    return {
      handled: true,
      callbackText: repairCallback.callbackText ?? callbackText,
      shouldClearInlineButtons: "shouldClearInlineButtons" in repairCallback && typeof repairCallback.shouldClearInlineButtons === "boolean"
        ? repairCallback.shouldClearInlineButtons
        : shouldClearInlineButtons,
    };
  }

  const commerceCallback = await tryHandleTelegramCommerceCallback({
    data: ctx.data,
    token: ctx.token,
    chatId: ctx.chatId,
    callbackId: ctx.callbackId,
    query: ctx.query,
  });
  if (commerceCallback.handled) {
    return {
      handled: true,
      callbackText: (commerceCallback as { callbackText?: string }).callbackText ?? callbackText,
      shouldClearInlineButtons: "shouldClearInlineButtons" in commerceCallback && typeof commerceCallback.shouldClearInlineButtons === "boolean"
        ? commerceCallback.shouldClearInlineButtons
        : shouldClearInlineButtons,
    };
  }

  return {
    handled: true,
    callbackText: ctx.data.startsWith("company:") ? "Неизвестная кнопка" : "Действие не поддерживается",
    shouldClearInlineButtons,
  };
}

async function handleIncomingCallback(token: string, webAppUrl: string, query: TelegramCallbackQuery) {
  const dispatchContext = buildTelegramCallbackDispatchContext(token, webAppUrl, query);
  const callbackId = query.id;
  const chatId = dispatchContext?.chatId;
  const messageId = dispatchContext?.messageId;
  let callbackText = "Готово";
  let shouldClearInlineButtons = true;

  try {
    if (!dispatchContext) {
      callbackText = "Некорректная кнопка";
      return;
    }
    const result = await dispatchTelegramCallback(dispatchContext);
    callbackText = result.callbackText ?? callbackText;
    if (typeof result.shouldClearInlineButtons === "boolean") {
      shouldClearInlineButtons = result.shouldClearInlineButtons;
    }
    if (query.data === "company:warehouse_expand_preview") {
      shouldClearInlineButtons = false;
    }
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

function buildTelegramMessageDispatchContext(
  token: string,
  webAppUrl: string,
  message: TelegramMessage,
  text: string,
  command: string,
  args: string[],
  player: User,
): TelegramMessageDispatchContext {
  return {
    token,
    webAppUrl,
    message,
    chatId: Number(message.chat?.id),
    text,
    command,
    args,
    player,
  };
}

async function dispatchTelegramCommandMessage(ctx: TelegramMessageDispatchContext) {
  const registrationStep = registrationTelegramModule.resolveStep(ctx.player, ctx.chatId);
  if (registrationStep && !shouldBypassRegistrationFlow(ctx.command)) {
    const startPayload = ctx.command === "/start" ? ctx.args[0] ?? "" : undefined;
    await registrationTelegramModule.beginRegistration(ctx.token, ctx.chatId, ctx.player, startPayload, registrationStep);
    return;
  }

  if (canSelectAdvancedPersonality(ctx.player) && !shouldBypassRegistrationFlow(ctx.command)) {
    await maybePromptAdvancedPersonality(ctx.token, ctx.chatId, ctx.player);
    return;
  }

  if (shouldAutoPromptProfession(ctx.player) && !shouldBypassProfessionAutoprompt(ctx.command)) {
    await maybePromptProfession(ctx.token, ctx.chatId, ctx.player, { force: false });
  }

  if (await maybeStartCitySectionTravel(ctx.token, ctx.chatId, ctx.player, ctx.message, ctx.command)) {
    return;
  }

  const pendingExclusiveAction = getPendingExclusiveAction(ctx.chatId);
  if (
    pendingExclusiveAction
    && isReplyNavigationCommand(ctx.command)
    && !isCommandCompatibleWithExclusiveAction(ctx.command, pendingExclusiveAction)
  ) {
    pendingActionByChatId.delete(ctx.chatId);
  }

  if (!shouldBypassTutorialLocks(ctx.command)) {
    const currentExclusiveAction = await getCurrentExclusiveAction(ctx.player.id, ctx.chatId);
    if (currentExclusiveAction && !isCommandCompatibleWithExclusiveAction(ctx.command, currentExclusiveAction)) {
      await sendWithCurrentHubKeyboard(
        ctx.token,
        ctx.chatId,
        ctx.player.id,
        `⛔ Сейчас уже выполняется действие: ${formatExclusiveActionLabel(currentExclusiveAction)}.\nСначала заверши его или отмени текущее действие командой /cancel.`,
      );
      return;
    }
  }

  if (ctx.command === "/help") {
    await sendWithMainKeyboard(ctx.token, ctx.chatId, [
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
      `• /profession — выбрать профессию с ${PROFESSION_UNLOCK_LEVEL} уровня`,
      "• /jobs — список вакансий",
      "• Вакансии запускаются из /jobs кнопками.",
      "• /study — меню обучения",
      "• Обучение запускается через кнопку «🎓 Обучение»",
      "• /repair_service — городской сервис ремонта гаджетов",
      "• Аукцион теперь поддерживает покупку и ставки кнопками.",
      "",
      "🛍 Магазин и инвентарь",
      "• /shop — каталог магазина",
      "• /gadgets — каталог производимых гаджетов и рецептов",
      "• Покупка и продажа теперь идут через кнопки и меню.",
      "• /inventory — показать инвентарь",
      "• /inv — короткая команда инвентаря",
      "• Использование, экипировка, обслуживание и разбор доступны из инвентаря.",
      "",
      "🏦 Банк и GRM",
      "• /bank — банковское меню кнопками",
      "• Кредиты: быстрый и стандартный, для ускорения развития.",
      "• Вклады: надёжный, рискованный и PvP-вклад.",
      "• Биржа и обмен GRM работают через кнопки и диалоговые сообщения.",
      "• Открытие кредита или вклада: выбери программу кнопкой и отправь сумму.",
      "• Закрытие кредита и вклада доступно из банкового меню.",
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
      "• /company_part_sell — открыть продажу запчастей со склада компании",
      "• /company_part_deposit 1 3 — быстрый перенос (пример)",
      "• /cpd1 — быстрый выбор 1-й запчасти",
      "• Пополнение компании, зарплаты и отделы теперь настраиваются кнопками в меню компании.",
      "• /company_salary_claim остаётся как совместимый скрытый алиас.",
      "• /company_expand | /company_upgrade (CEO)",
      "• /company_ipo | /company_ipo_run (CEO)",
      "",
      "🏁 Weekly Hackathon",
      "• /hackathon — статус weekly hackathon",
      "• /hackathon_join — CEO регистрирует компанию или игрок занимает слот в составе",
      "• Состав ограничен 5 участниками на компанию",
      "• Хакатон проходит в 3 timed-этапа с автоматическим подсчётом очков",
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
      "📝 Обновления",
      "• /updates — последнее обновление",
      "• /updates latest — последнее обновление",
      "• /updates 2026-03-30 — изменения за выбранную дату",
      "• /updates list — список доступных дат",
      "• /updates 7d — краткая история за 7 дней",
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
      "• /admin_updates_latest | /admin_updates_list",
      "• /admin_updates_history | /admin_updates_date",
      "• /admin_reset_player | /admin_restart",
      "• /admin_hackathon_start | /admin_hackathon_end | /admin_hackathon_reset",
      "• /admin_global_event",
      "• /admin_logout",
    ].join("\n"));
    return;
  }

  if (ctx.command === "/updates" || ctx.command === "/changes") {
    const rawArg = String(ctx.args[0] ?? "").trim().toLowerCase();
    if (!rawArg || rawArg === "latest") {
      const entry = getLatestChangelogEntry();
      await sendWithMainKeyboard(
        ctx.token,
        ctx.chatId,
        entry ? formatChangelogShortMessage(entry) : "История обновлений пока пуста.",
      );
      return;
    }

    if (rawArg === "list") {
      await sendWithMainKeyboard(ctx.token, ctx.chatId, formatChangelogListMessage(getAllChangelogEntries()));
      return;
    }

    if (rawArg === "7d") {
      await sendWithMainKeyboard(ctx.token, ctx.chatId, formatChangelogRecentMessage(getRecentChangelogEntries(7), 7));
      return;
    }

    const requestedDate = normalizeChangelogDateInput(ctx.args[0]);
    if (!requestedDate) {
      await sendWithMainKeyboard(
        ctx.token,
        ctx.chatId,
        "Используй /updates, /updates latest, /updates YYYY-MM-DD, /updates list или /updates 7d.",
      );
      return;
    }

    const entry = getChangelogEntryByDate(requestedDate);
    await sendWithMainKeyboard(
      ctx.token,
      ctx.chatId,
      entry
        ? formatChangelogDetailedMessage(entry)
        : `За ${formatChangelogDateLabel(requestedDate)} обновления не найдены.`,
    );
    return;
  }

  if (ctx.command === "/gadgets") {
    await sendGadgetCatalogPage(ctx.token, ctx.chatId, 0);
    return;
  }

  if (await hubTelegramModule.handleMessage(
    buildTelegramHubMessageInput(ctx.command, ctx.args, ctx.token, ctx.webAppUrl, ctx.chatId, ctx.message, ctx.player),
  )) {
    return;
  }

  if (await repairTelegramModule.handleMessage({
    command: ctx.command,
    args: ctx.args,
    token: ctx.token,
    chatId: ctx.chatId,
    message: ctx.message,
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

  if (await tryHandleTelegramFeatureMessage(
    buildTelegramFeatureMessageInput(ctx.command, ctx.args, ctx.token, ctx.chatId, ctx.message),
  )) {
    return;
  }

  if (await tryHandleTelegramPlayerSystemsMessage(ctx.command, ctx.args, ctx.token, ctx.chatId, ctx.message)) {
    return;
  }

  if (await tryHandleTelegramLegacyCommandIslands(ctx.command, ctx.args, ctx.token, ctx.chatId, ctx.message)) {
    return;
  }

  await sendWithMainKeyboard(ctx.token, ctx.chatId, "Неизвестная команда. Напиши /help");
}

async function handleIncomingMessage(token: string, webAppUrl: string, message: TelegramMessage) {
  if (!message.chat?.id || typeof message.text !== "string") return;
  const chatId = message.chat.id;
  const text = message.text.trim();
  if (!text) return;

  try {
    const normalized = normalizeCommand(text);
    let command = normalized.command;
    let args = normalized.args;
    if (!command.startsWith("/")) {
      const fullAlias = resolvePlainTextAlias(text, chatId);
      if (fullAlias) {
        const aliasNormalized = normalizeCommand(fullAlias);
        command = aliasNormalized.command;
        args = aliasNormalized.args;
      } else {
        const [firstWord, ...rest] = text.trim().split(/\s+/);
        const alias = resolvePlainTextAlias(firstWord, chatId);
        if (alias) {
          const aliasNormalized = normalizeCommand(alias);
          command = aliasNormalized.command;
          args = [...aliasNormalized.args, ...rest];
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
    const dispatchContext = buildTelegramMessageDispatchContext(
      token,
      webAppUrl,
      message,
      text,
      command,
      args,
      playerForRegistration,
    );
    await dispatchTelegramCommandMessage(dispatchContext);
  } catch (error) {
    await sendMessage(token, chatId, `❌ ${extractErrorMessage(error)}`);
  }
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
  let hackathonLiveTimer: NodeJS.Timeout | null = null;
  let repairSweepTimer: NodeJS.Timeout | null = null;
  let playerNoticeSweepTimer: NodeJS.Timeout | null = null;
  const energyFullStateByUserId = new Map<string, { work: boolean; study: boolean }>();

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
    if (hackathonLiveTimer) {
      clearInterval(hackathonLiveTimer);
      hackathonLiveTimer = null;
    }
    if (repairSweepTimer) {
      clearInterval(repairSweepTimer);
      repairSweepTimer = null;
    }
    if (playerNoticeSweepTimer) {
      clearInterval(playerNoticeSweepTimer);
      playerNoticeSweepTimer = null;
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
        if (announcement.targetCompanyId) {
          const membership = await getPlayerCompanyContext(user.id);
          if (membership?.company.id !== announcement.targetCompanyId) continue;
        }
        await sendMessage(token, chatId, globalText, announcement.joinCompanyId
          ? { reply_markup: { inline_keyboard: [[{ text: "✅ Участвовать", callback_data: `hackathon:join_team:${announcement.joinCompanyId}` }]] } }
          : undefined);
        if (announcement.winnerCompanyId) {
          const membership = await getPlayerCompanyContext(user.id);
          if (membership?.company.id === announcement.winnerCompanyId) {
            await sendMessage(
              token,
              chatId,
              [
                "🏆 Ваша компания победила в Weekly Hackathon!",
                "",
                "Награды:",
                `+${WEEKLY_HACKATHON_CONFIG.rewards.first.companyGrm} GRM компании`,
                `+${WEEKLY_HACKATHON_CONFIG.rewards.first.rareParts} rare запчасти`,
                "• возможна epic деталь",
                "• временный бафф к разработке",
              ].join("\n"),
            );
          }
        }
      }
    }
  };

  const broadcastHackathonLiveBoards = async () => {
    const state = getWeeklyHackathonState();
    if (!(state.status === "round1" || state.status === "round2" || state.status === "round3") || !state.eventId || !state.currentRound) {
      return;
    }
    const users = await storage.getUsers();
    for (const user of users) {
      if (!isCompletedRegistration(user)) continue;
      const telegramId = getTelegramIdByUserId(user.id);
      if (!telegramId) continue;
      const chatId = Number(telegramId);
      if (!Number.isFinite(chatId)) continue;
      const membership = await getPlayerCompanyContext(user.id);
      if (!membership) continue;
      if (!(state.registeredCompanies as any[]).some((row: any) => row.companyId === membership.company.id)) continue;
      const text = await formatHackathonLiveRoundMessage(user.id);
      if (!text) continue;
      const tracked = hackathonLiveMessageByChatId.get(chatId);
      if (tracked && tracked.eventId === state.eventId && tracked.roundId === state.currentRound) {
        if (tracked.text === text) continue;
        try {
          await callTelegramApi(token, "editMessageText", {
            chat_id: chatId,
            message_id: tracked.messageId,
            text,
          });
          hackathonLiveMessageByChatId.set(chatId, { ...tracked, text });
        } catch (error: any) {
          const message = String(error?.description || error?.message || "");
          if (!message.toLowerCase().includes("message is not modified")) {
            const next = await sendMessage(token, chatId, text) as { message_id?: number };
            hackathonLiveMessageByChatId.set(chatId, {
              eventId: state.eventId,
              roundId: state.currentRound,
              messageId: Number(next?.message_id || 0),
              text,
            });
          }
        }
      } else {
        const next = await sendMessage(token, chatId, text) as { message_id?: number };
        hackathonLiveMessageByChatId.set(chatId, {
          eventId: state.eventId,
          roundId: state.currentRound,
          messageId: Number(next?.message_id || 0),
          text,
        });
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
      "Открой «🏦 Банк» -> «📊 Биржа», чтобы купить или продать бумаги.",
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

  const broadcastPlayerRuntimeNotifications = async () => {
    const users = await storage.getUsers();
    for (const user of users) {
      if (!isCompletedRegistration(user)) continue;
      const telegramId = getTelegramIdByUserId(user.id);
      if (!telegramId) continue;
      const chatId = Number(telegramId);
      if (!Number.isFinite(chatId)) continue;

      try {
        const snapshot = await getUserWithGameState(user.id);
        if (!snapshot) continue;
        const game = snapshot.game as GameView;
        const previous = energyFullStateByUserId.get(user.id);
        const energyState = buildEnergyFullNotifications(game, previous);
        energyFullStateByUserId.set(user.id, { work: energyState.workFull, study: energyState.studyFull });

        const blocks: string[] = [];
        if (snapshot.notices.length) {
          blocks.push(formatNotices(snapshot.notices));
        }
        if (energyState.notifications.length) {
          blocks.push(energyState.notifications.join("\n"));
        }
        if (!blocks.length) continue;
        await sendMessage(token, chatId, blocks.join("\n\n"));
      } catch (error) {
        console.warn("⚠️ Не удалось отправить системное уведомление игроку:", error);
      }
    }
  };

  const broadcastRestartNotice = async () => {
    const users = await storage.getUsers();
    const entry = getLatestChangelogEntry({ restartOnly: true });
    if (!entry) return;
    const changedAt = new Date().toLocaleString("ru-RU", {
      timeZone: "Europe/Moscow",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    const text = `${formatChangelogShortMessage(entry, { restart: true })}\n🕒 Время перезапуска: ${changedAt} (МСК)`;

    for (const user of users) {
      if (!isCompletedRegistration(user)) continue;
      const telegramId = getTelegramIdByUserId(user.id);
      if (!telegramId) continue;
      const chatId = Number(telegramId);
      if (!Number.isFinite(chatId)) continue;
      try {
        await sendMessage(token, chatId, text);
      } catch (error) {
        console.warn("⚠️ Не удалось отправить уведомление о рестарте:", error);
      }
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

    await broadcastRestartNotice();

    poll();
    hackathonAnnouncementTimer = setInterval(() => {
      void broadcastHackathonAnnouncements();
      void broadcastGlobalEventAnnouncements();
      void broadcastStockMarketAnnouncements();
    }, 15000);
    hackathonLiveTimer = setInterval(() => {
      void broadcastHackathonLiveBoards();
    }, Math.max(5000, WEEKLY_HACKATHON_CONFIG.liveUpdateMs));
    repairSweepTimer = setInterval(() => {
      void processRepairOrderSweep(token);
    }, 30000);
    playerNoticeSweepTimer = setInterval(() => {
      void broadcastPlayerRuntimeNotifications();
    }, 30000);
  };

  void bootstrapPolling();

  httpServer.on("close", stop);
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);

  console.log("✅ Telegram bot polling started");
}


