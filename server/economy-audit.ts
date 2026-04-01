import { registerRuntimeSnapshotProvider } from "./storage";

export type EconomyAuditEventType =
  | "MARKET_GADGET_PURCHASED"
  | "MARKET_GADGET_RELIST_ATTEMPT"
  | "MARKET_GADGET_RELIST_BLOCKED"
  | "COMPANY_MARKET_LISTING_CREATED"
  | "COMPANY_FUNDS_SPENT"
  | "COMPANY_ASSET_ACTION_DENIED"
  | "COMPANY_PARTS_SOLD";

export type EconomyAuditStatus = "success" | "blocked" | "failed";

export type EconomyAuditEntry = {
  id: string;
  eventType: EconomyAuditEventType;
  userId?: string | null;
  companyId?: string | null;
  targetId?: string | null;
  amount?: number | null;
  status: EconomyAuditStatus;
  reason?: string | null;
  createdAt: number;
  metadata?: Record<string, unknown> | null;
};

const economyAuditLog: EconomyAuditEntry[] = [];
const MAX_AUDIT_LOG_SIZE = 5000;

function createAuditId() {
  return `audit_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function appendEconomyAuditEvent(input: Omit<EconomyAuditEntry, "id" | "createdAt"> & { createdAt?: number }) {
  const entry: EconomyAuditEntry = {
    id: createAuditId(),
    createdAt: Number(input.createdAt || Date.now()),
    eventType: input.eventType,
    userId: input.userId ?? null,
    companyId: input.companyId ?? null,
    targetId: input.targetId ?? null,
    amount: Number.isFinite(Number(input.amount)) ? Number(input.amount) : null,
    status: input.status,
    reason: input.reason ?? null,
    metadata: input.metadata ?? null,
  };
  economyAuditLog.unshift(entry);
  if (economyAuditLog.length > MAX_AUDIT_LOG_SIZE) {
    economyAuditLog.length = MAX_AUDIT_LOG_SIZE;
  }
  return entry;
}

export function getEconomyAuditLog(limit: number = 100) {
  return economyAuditLog.slice(0, Math.max(1, Math.min(1000, limit)));
}

function exportEconomyAuditSnapshot() {
  return economyAuditLog.slice(0, MAX_AUDIT_LOG_SIZE);
}

function importEconomyAuditSnapshot(snapshot: unknown) {
  economyAuditLog.length = 0;
  if (!Array.isArray(snapshot)) return;
  for (const raw of snapshot) {
    if (!raw || typeof raw !== "object") continue;
    const entry = raw as Partial<EconomyAuditEntry>;
    if (!entry.eventType || !entry.status) continue;
    economyAuditLog.push({
      id: String(entry.id || createAuditId()),
      eventType: entry.eventType as EconomyAuditEventType,
      userId: entry.userId ? String(entry.userId) : null,
      companyId: entry.companyId ? String(entry.companyId) : null,
      targetId: entry.targetId ? String(entry.targetId) : null,
      amount: Number.isFinite(Number(entry.amount)) ? Number(entry.amount) : null,
      status: entry.status as EconomyAuditStatus,
      reason: entry.reason ? String(entry.reason) : null,
      createdAt: Number(entry.createdAt || Date.now()),
      metadata: entry.metadata && typeof entry.metadata === "object" ? { ...entry.metadata } : null,
    });
  }
}

function clearEconomyAuditSnapshot() {
  economyAuditLog.length = 0;
}

registerRuntimeSnapshotProvider("economy-audit-log", {
  exportSnapshot: exportEconomyAuditSnapshot,
  importSnapshot: importEconomyAuditSnapshot,
  clear: clearEconomyAuditSnapshot,
});
