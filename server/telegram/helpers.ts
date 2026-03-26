import * as iconv from "iconv-lite";

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
  const markerPattern = /(рџ|вЂ|в„|вљ|вњ|вќ|пїЅ|Ѓ|Љ|Њ|Џ|Ð|Ñ|Ã|Â|â[\u0080-\u00BF]|в[ЂЃ‚„…†‡€‰‹ЉЊЌЋЏ])/;
  const scoreMarkers = countRegexMatches(input, markerPattern) * 4;
  const scoreLatinCyrMix = countRegexMatches(input, /[Ѐ-џ]/);
  const scoreBrokenSingles = countRegexMatches(input, /(?:^|\s)[РС](?=\s|$)/) * 2;
  return scoreMarkers + scoreLatinCyrMix + scoreBrokenSingles;
}

export function getReadableCyrillicScore(input: string) {
  return countRegexMatches(input, /[А-Яа-яЁё]/);
}

export function tryWin1251ToUtf8(input: string) {
  try {
    return iconv.decode(iconv.encode(input, "win1251"), "utf8");
  } catch {
    return input;
  }
}

export function repairMojibake(input: string) {
  if (!input) return input;
  let base = input;
  if (!/^[\x00-\x7F\s]+$/.test(input)) {
    const fullCandidate = tryWin1251ToUtf8(input);
    const originalScore = getMojibakeScore(input);
    const candidateScore = getMojibakeScore(fullCandidate);
    const originalReadable = getReadableCyrillicScore(input);
    const candidateReadable = getReadableCyrillicScore(fullCandidate);

    if (
      (candidateScore < originalScore && candidateReadable >= originalReadable)
      || (candidateScore <= originalScore && candidateReadable > originalReadable)
    ) {
      base = fullCandidate;
    }
  }

  return base
    .replace(/Р°/g, "а")
    .replace(/Р±/g, "б")
    .replace(/РІ/g, "в")
    .replace(/Рі/g, "г")
    .replace(/Рґ/g, "д")
    .replace(/Рµ/g, "е")
    .replace(/С‘/g, "ё")
    .replace(/Р¶/g, "ж")
    .replace(/Р·/g, "з")
    .replace(/Рё/g, "и")
    .replace(/Р№/g, "й")
    .replace(/Рє/g, "к")
    .replace(/Р»/g, "л")
    .replace(/Рј/g, "м")
    .replace(/РЅ/g, "н")
    .replace(/Рѕ/g, "о")
    .replace(/Рї/g, "п")
    .replace(/СЂ/g, "р")
    .replace(/СЃ/g, "с")
    .replace(/С‚/g, "т")
    .replace(/Сѓ/g, "у")
    .replace(/С„/g, "ф")
    .replace(/С…/g, "х")
    .replace(/С†/g, "ц")
    .replace(/С‡/g, "ч")
    .replace(/С€/g, "ш")
    .replace(/С‰/g, "щ")
    .replace(/СЉ/g, "ъ")
    .replace(/С‹/g, "ы")
    .replace(/СЊ/g, "ь")
    .replace(/СЌ/g, "э")
    .replace(/СЋ/g, "ю")
    .replace(/СЏ/g, "я")
    .replace(/Рђ/g, "А")
    .replace(/Р‘/g, "Б")
    .replace(/Р’/g, "В")
    .replace(/Р“/g, "Г")
    .replace(/Р”/g, "Д")
    .replace(/Р•/g, "Е")
    .replace(/РЃ/g, "Ё")
    .replace(/Р–/g, "Ж")
    .replace(/Р—/g, "З")
    .replace(/РИ/g, "И")
    .replace(/Р™/g, "Й")
    .replace(/РК/g, "К")
    .replace(/Р›/g, "Л")
    .replace(/Рњ/g, "М")
    .replace(/Рќ/g, "Н")
    .replace(/Рћ/g, "О")
    .replace(/Рџ/g, "П")
    .replace(/Р /g, "Р")
    .replace(/С /g, "С")
    .replace(/РЎ/g, "С")
    .replace(/Рў/g, "Т")
    .replace(/РЈ/g, "У")
    .replace(/Р¤/g, "Ф")
    .replace(/РҐ/g, "Х")
    .replace(/Р¦/g, "Ц")
    .replace(/Р§/g, "Ч")
    .replace(/РЁ/g, "Ш")
    .replace(/Р©/g, "Щ")
    .replace(/РЄ/g, "Ъ")
    .replace(/Р«/g, "Ы")
    .replace(/Р¬/g, "Ь")
    .replace(/РЭ/g, "Э")
    .replace(/Р®/g, "Ю")
    .replace(/РЇ/g, "Я");
}

export function extractErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    const message = error.message;
    if (/Telegram API .*429/i.test(message) || /Too Many Requests/i.test(message)) {
      const retryMatch = message.match(/retry after[^\d]*(\d+)/i);
      return retryMatch
        ? `Telegram временно ограничил отправку сообщений. Попробуй снова через ${retryMatch[1]} сек.`
        : "Telegram временно ограничил отправку сообщений. Попробуй снова чуть позже.";
    }
    const blueprintBalanceMatch = message.match(/^Not enough company balance for blueprint start \((\d+)\)$/i);
    if (blueprintBalanceMatch) {
      return `Недостаточно баланса компании для запуска разработки чертежа (нужно ${blueprintBalanceMatch[1]} GRM).`;
    }
    if (/^Not enough company balance for blueprint start$/i.test(message)) {
      return "Недостаточно баланса компании для запуска разработки чертежа.";
    }
    return message;
  }
  return "Не удалось выполнить действие";
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
  if (!programRef || !amountRaw || !daysRaw) return null;
  const amount = Number(amountRaw);
  const days = Number(daysRaw);
  if (!Number.isFinite(amount) || !Number.isFinite(days)) return null;
  return { programRef, amount: Math.floor(amount), days: Math.floor(days) };
}

export function parseDecimalInput(input: string) {
  const normalized = input.trim().replace(",", ".");
  if (!normalized) return null;
  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  return value;
}
