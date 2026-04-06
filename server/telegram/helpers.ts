import * as iconv from "iconv-lite";

const MOJIBAKE_MARKERS = /(?:\u0420[\u0410-\u044f\u0401\u0451]|\u0421[\u0410-\u044f\u0401\u0451]|\u0413[\u0410-\u044f\u0401\u0451]|\u0432\u0402|\u0440\u045f|\u043f\u0451\u040f|\u00d1.|\u00d0.|\u00c2.|\u00c3.|\u00e2[\u0080-\u00BF])/;

export function trimTrailingSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export function countRegexMatches(input: string, pattern: RegExp) {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const source = new RegExp(pattern.source, flags);
  return (input.match(source) ?? []).length;
}

export function getMojibakeScore(input: string) {
  if (!input) return 0;
  const markerScore = countRegexMatches(input, MOJIBAKE_MARKERS) * 4;
  const brokenCyrillicScore = countRegexMatches(input, /[\u00d0\u00d1\u0420\u0421\u0413\u00c2\u00c3\u00e2][^\s]*/);
  const orphanScore = countRegexMatches(input, /(?:^|\s)[\u0420\u0421\u00d0\u00d1](?=\s|$)/) * 2;
  return markerScore + brokenCyrillicScore + orphanScore;
}

export function getReadableCyrillicScore(input: string) {
  return countRegexMatches(input, /[\u0410-\u042f\u0430-\u044f\u0401\u0451]/);
}

function tryLatin1ToUtf8(input: string) {
  try {
    return Buffer.from(input, "latin1").toString("utf8");
  } catch {
    return input;
  }
}

function tryWin1251BytesToUtf8(input: string) {
  try {
    return iconv.decode(Buffer.from(input, "latin1"), "win1251");
  } catch {
    return input;
  }
}

function tryUtf8ToWin1251(input: string) {
  try {
    return iconv.decode(iconv.encode(input, "win1251"), "utf8");
  } catch {
    return input;
  }
}

function chooseBetterText(original: string, candidate: string) {
  if (!candidate || candidate === original) return original;
  const originalScore = getMojibakeScore(original);
  const candidateScore = getMojibakeScore(candidate);
  const originalReadable = getReadableCyrillicScore(original);
  const candidateReadable = getReadableCyrillicScore(candidate);

  if (candidateScore < originalScore && candidateReadable >= originalReadable) return candidate;
  if (candidateScore <= originalScore && candidateReadable > originalReadable) return candidate;
  return original;
}

function shouldAttemptEncodingFix(input: string) {
  if (!input) return false;
  if (getMojibakeScore(input) > 0) return true;
  return MOJIBAKE_MARKERS.test(input);
}

export function fixEncoding(input: string) {
  if (!input || !shouldAttemptEncodingFix(input)) return input;

  let best = input;
  const candidates = [
    tryLatin1ToUtf8(input),
    tryWin1251BytesToUtf8(input),
    tryLatin1ToUtf8(tryWin1251BytesToUtf8(input)),
    tryWin1251BytesToUtf8(tryLatin1ToUtf8(input)),
    tryUtf8ToWin1251(input),
  ];

  for (const candidate of candidates) {
    best = chooseBetterText(best, candidate);
  }

  if (best !== input) {
    console.debug(`[telegram/fixEncoding] repaired mojibake: ${JSON.stringify(input.slice(0, 120))} -> ${JSON.stringify(best.slice(0, 120))}`);
  }

  return best;
}

export const repairMojibake = fixEncoding;

export function extractErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    const message = fixEncoding(error.message);
    if (/Telegram API .*429/i.test(message) || /Too Many Requests/i.test(message)) {
      const retryMatch = message.match(/retry after[^\d]*(\d+)/i);
      return retryMatch
        ? `Telegram \u0432\u0440\u0435\u043c\u0435\u043d\u043d\u043e \u043e\u0433\u0440\u0430\u043d\u0438\u0447\u0438\u043b \u043e\u0442\u043f\u0440\u0430\u0432\u043a\u0443 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0439. \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439 \u0441\u043d\u043e\u0432\u0430 \u0447\u0435\u0440\u0435\u0437 ${retryMatch[1]} \u0441\u0435\u043a.`
        : "Telegram \u0432\u0440\u0435\u043c\u0435\u043d\u043d\u043e \u043e\u0433\u0440\u0430\u043d\u0438\u0447\u0438\u043b \u043e\u0442\u043f\u0440\u0430\u0432\u043a\u0443 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0439. \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439 \u0441\u043d\u043e\u0432\u0430 \u0447\u0443\u0442\u044c \u043f\u043e\u0437\u0436\u0435.";
    }
    const blueprintBalanceMatch = message.match(/^Not enough company balance for blueprint start \((\d+)\)$/i);
    if (blueprintBalanceMatch) {
      return `\u041d\u0435\u0434\u043e\u0441\u0442\u0430\u0442\u043e\u0447\u043d\u043e \u0431\u0430\u043b\u0430\u043d\u0441\u0430 \u043a\u043e\u043c\u043f\u0430\u043d\u0438\u0438 \u0434\u043b\u044f \u0437\u0430\u043f\u0443\u0441\u043a\u0430 \u0440\u0430\u0437\u0440\u0430\u0431\u043e\u0442\u043a\u0438 \u0447\u0435\u0440\u0442\u0435\u0436\u0430 (\u043d\u0443\u0436\u043d\u043e ${blueprintBalanceMatch[1]} GRM).`;
    }
    if (/^Not enough company balance for blueprint start$/i.test(message)) {
      return "\u041d\u0435\u0434\u043e\u0441\u0442\u0430\u0442\u043e\u0447\u043d\u043e \u0431\u0430\u043b\u0430\u043d\u0441\u0430 \u043a\u043e\u043c\u043f\u0430\u043d\u0438\u0438 \u0434\u043b\u044f \u0437\u0430\u043f\u0443\u0441\u043a\u0430 \u0440\u0430\u0437\u0440\u0430\u0431\u043e\u0442\u043a\u0438 \u0447\u0435\u0440\u0442\u0435\u0436\u0430.";
    }
    return message;
  }
  return "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0432\u044b\u043f\u043e\u043b\u043d\u0438\u0442\u044c \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435";
}

export function getTelegramRetryAfterSeconds(payloadText: string) {
  const directMatch = payloadText.match(/retry after[^\d]*(\d+)/i);
  if (directMatch) return Number(directMatch[1]);
  try {
    const parsed = JSON.parse(payloadText) as { parameters?: { retry_after?: unknown } };
    const retryAfter = Number(parsed?.parameters?.retry_after);
    return Number.isFinite(retryAfter) ? retryAfter : null;
  } catch {
    return null;
  }
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function parseBankOpenInput(input: string) {
  const [programRef, amountRaw, daysRaw] = input.trim().split(/\s+/);
  if (!programRef || !amountRaw) return null;
  const amount = Number(amountRaw);
  const days = daysRaw ? Number(daysRaw) : 0;
  if (!Number.isFinite(amount)) return null;
  if (daysRaw && !Number.isFinite(days)) return null;
  return { programRef, amount: Math.floor(amount), days: Math.max(0, Math.floor(days || 0)) };
}

export function parseDecimalInput(input: string) {
  const normalized = input.trim().replace(",", ".");
  if (!normalized) return null;
  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  return value;
}
