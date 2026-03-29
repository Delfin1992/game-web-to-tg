type AllowedOriginMatcher = "*" | Set<string>;

function parseCsv(value: string | undefined) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function getAllowedOrigins(): AllowedOriginMatcher {
  const configured = parseCsv(process.env.ALLOWED_ORIGINS);
  if (configured.length > 0) {
    return new Set(configured);
  }

  if (process.env.NODE_ENV !== "production") {
    return "*";
  }

  const appUrl = String(process.env.APP_URL || process.env.TELEGRAM_WEBAPP_URL || "").trim();
  return appUrl ? new Set([trimTrailingSlash(appUrl)]) : new Set();
}

export function isOriginAllowed(origin: string | undefined, allowed: AllowedOriginMatcher) {
  if (allowed === "*") return true;
  if (!origin) return true;
  return allowed.has(trimTrailingSlash(origin));
}

export function getServerBaseUrl() {
  const configured = String(process.env.INTERNAL_API_BASE_URL || process.env.APP_URL || "").trim();
  if (configured) return trimTrailingSlash(configured);
  const port = String(process.env.PORT || "5000").trim() || "5000";
  return `http://127.0.0.1:${port}`;
}

export function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export function getAdminPassword() {
  const password = String(process.env.ADMIN_PASSWORD || process.env.TELEGRAM_ADMIN_PASSWORD || "").trim();
  return password || null;
}

let adminPasswordWarningShown = false;

export function warnIfAdminPasswordMissing() {
  if (adminPasswordWarningShown) return;
  if (getAdminPassword()) return;
  adminPasswordWarningShown = true;
  console.warn("Admin routes and Telegram admin actions are disabled: ADMIN_PASSWORD is not configured.");
}

export function isAdminEnabled() {
  return Boolean(getAdminPassword());
}
