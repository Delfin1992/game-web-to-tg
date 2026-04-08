export type NotificationScope = "personal" | "city" | "global";

export type NotificationType =
  | "CONTRACT_COMPLETED"
  | "CONTRACT_REWARD_AVAILABLE"
  | "CONTRACT_FAILED"
  | "REPAIR_COMPLETED"
  | "REPAIR_REWARD_AVAILABLE"
  | "PVP_RESULT"
  | "HACKATHON_RESULT"
  | "COMPANY_JOIN_ACCEPTED"
  | "COMPANY_ROLE_ASSIGNED"
  | "MARKET_LISTING_SOLD"
  | "AUCTION_WON"
  | "AUCTION_ENDED"
  | "BANK_PRODUCT_COMPLETED"
  | "DAILY_QUEST_COMPLETED"
  | "DAILY_QUEST_REWARD_AVAILABLE"
  | "PROFESSION_SELECTED"
  | "SYSTEM_INFO"
  | "CITY_EVENT_ACTIVE"
  | "GLOBAL_EVENT_ACTIVE"
  | "CITY_EVENT_UPDATED"
  | "GLOBAL_EVENT_UPDATED";

export type NotificationReward = {
  money?: number;
  xp?: number;
  reputation?: number;
  gram?: number;
  workEnergy?: number;
  studyEnergy?: number;
  itemId?: string;
  itemName?: string;
  itemType?: "part" | "trophy";
  itemQuantity?: number;
  itemRarity?: string;
  itemStats?: Record<string, number>;
};

export type NotificationClaimKind =
  | "daily_quest_reward"
  | "generic_reward";

export type NotificationRecord = {
  id: string;
  userId: string | null;
  type: NotificationType;
  scope: NotificationScope;
  title: string;
  message: string;
  dataJson: Record<string, unknown> | null;
  reward: NotificationReward | null;
  claimKind: NotificationClaimKind | null;
  isRead: boolean;
  isClaimable: boolean;
  isClaimed: boolean;
  isPersistent: boolean;
  city: string | null;
  eventKey: string | null;
  activeFrom: number | null;
  activeUntil: number | null;
  replacesEventKey: string | null;
  createdAt: number;
  updatedAt: number;
  readAt: number | null;
  claimedAt: number | null;
};

export type NotificationView = NotificationRecord & {
  effectiveRead: boolean;
};

export type NotificationListSnapshot = {
  serverTime: number;
  unreadCount: number;
  claimableCount: number;
  items: NotificationView[];
};

export type CreateNotificationInput = {
  type: NotificationType;
  title: string;
  message: string;
  dataJson?: Record<string, unknown> | null;
  isRead?: boolean;
  isClaimable?: boolean;
  reward?: NotificationReward | null;
  claimKind?: NotificationClaimKind | null;
};

export type UpsertPersistentEventInput = {
  type: Extract<NotificationType, "CITY_EVENT_ACTIVE" | "GLOBAL_EVENT_ACTIVE" | "CITY_EVENT_UPDATED" | "GLOBAL_EVENT_UPDATED">;
  title: string;
  message: string;
  dataJson?: Record<string, unknown> | null;
  eventKey: string;
  activeFrom?: number | null;
  activeUntil?: number | null;
  replacesEventKey?: string | null;
};
