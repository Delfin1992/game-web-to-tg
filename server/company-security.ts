export const COMPANY_ASSET_MANAGER_ERROR = "Только CEO и его заместитель могут распоряжаться деньгами и активами компании.";

export function normalizeCompanyRole(role: string | null | undefined) {
  return String(role || "").trim().toLowerCase();
}

export function isCompanyAssetManagerRole(role: string | null | undefined) {
  const normalized = normalizeCompanyRole(role);
  return normalized === "owner"
    || normalized === "manager"
    || normalized === "deputy"
    || normalized === "vice"
    || normalized === "assistant_ceo";
}

export function canManageCompanyAssets(input: {
  actorUserId: string;
  companyOwnerId?: string | null;
  role?: string | null;
}) {
  if (String(input.companyOwnerId || "") && String(input.companyOwnerId) === String(input.actorUserId)) {
    return true;
  }
  return isCompanyAssetManagerRole(input.role);
}
