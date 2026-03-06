export const RANKS = {
  Intern: { minLevel: 1, maxLevel: 5 },
  Junior: { minLevel: 6, maxLevel: 15 },
  Middle: { minLevel: 16, maxLevel: 25 },
  Senior: { minLevel: 26, maxLevel: 35 },
  Lead: { minLevel: 36, maxLevel: 45 },
  Architect: { minLevel: 46, maxLevel: 60 },
  "Tech Director": { minLevel: 61, maxLevel: Number.POSITIVE_INFINITY },
  CEO: { minLevel: 1, maxLevel: Number.POSITIVE_INFINITY },
} as const;

export const RANK_EMOJIS: Record<keyof typeof RANKS, string> = {
  Intern: "🧑‍🎓",
  Junior: "👶",
  Middle: "🧑‍💻",
  Senior: "👨‍💻",
  Lead: "🧠",
  Architect: "🏛️",
  "Tech Director": "👨‍💼",
  CEO: "👑",
};

export type RankName = keyof typeof RANKS;

export function getRankByLevel(level: number, isCEO = false): RankName {
  if (isCEO) return "CEO";
  const normalizedLevel = Math.max(1, Math.floor(level || 1));

  const ordered: RankName[] = [
    "Intern",
    "Junior",
    "Middle",
    "Senior",
    "Lead",
    "Architect",
    "Tech Director",
  ];

  for (const rank of ordered) {
    const range = RANKS[rank];
    if (normalizedLevel >= range.minLevel && normalizedLevel <= range.maxLevel) {
      return rank;
    }
  }

  return "Tech Director";
}

export function getRankLabel(level: number, isCEO = false): string {
  const rank = getRankByLevel(level, isCEO);
  return `${RANK_EMOJIS[rank]} ${rank}`;
}
