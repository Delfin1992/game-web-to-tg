import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Trophy } from "lucide-react";
import { getRankLabel } from "@/lib/ranks";

type PlayerSort = "level" | "reputation" | "wealth";
type CompanySort = "level" | "wealth" | "blueprints";

interface PlayerRow {
  id: string;
  username: string;
  level: number;
  reputation: number;
  balance: number;
  city?: string;
}

interface CompanyRow {
  id: string;
  name: string;
  city: string;
  level: number;
  balance: number;
  developedBlueprints: number;
}

interface LeaderboardsProps {
  onBack: () => void;
}

export default function Leaderboards({ onBack }: LeaderboardsProps) {
  const [playerSort, setPlayerSort] = useState<PlayerSort>("level");
  const [companySort, setCompanySort] = useState<CompanySort>("level");

  const { data: players = [] } = useQuery<PlayerRow[]>({
    queryKey: [`/api/leaderboard/players?sort=${playerSort}`],
    refetchInterval: 5000,
  });

  const { data: companies = [] } = useQuery<CompanyRow[]>({
    queryKey: [`/api/leaderboard/companies?sort=${companySort}`],
    refetchInterval: 5000,
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black text-white p-4 pb-24">
      <div className="max-w-md mx-auto space-y-5">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-white/50 hover:text-primary text-xs uppercase tracking-widest transition-colors"
        >
          <ChevronLeft size={18} /> Назад
        </button>

        <div className="text-center">
          <h2 className="text-2xl font-bold uppercase tracking-widest text-primary flex items-center justify-center gap-2">
            <Trophy size={22} /> Доска почёта
          </h2>
          <p className="text-xs text-white/50 mt-1">Глобальные таблицы лидеров игроков и компаний</p>
        </div>

        <div className="bg-white/5 border border-primary/20 rounded-lg p-4 space-y-3">
          <h3 className="text-xs uppercase tracking-widest text-white/60">Игроки</h3>
          <div className="flex gap-2">
            <button onClick={() => setPlayerSort("level")} className={`px-2 py-1 rounded text-xs ${playerSort === "level" ? "bg-primary text-black" : "bg-white/10 text-white/70"}`}>Уровень</button>
            <button onClick={() => setPlayerSort("reputation")} className={`px-2 py-1 rounded text-xs ${playerSort === "reputation" ? "bg-primary text-black" : "bg-white/10 text-white/70"}`}>Репутация</button>
            <button onClick={() => setPlayerSort("wealth")} className={`px-2 py-1 rounded text-xs ${playerSort === "wealth" ? "bg-primary text-black" : "bg-white/10 text-white/70"}`}>Богатство</button>
          </div>
          <div className="space-y-2">
            {players.map((p, idx) => (
              <div key={p.id} className="bg-black/40 border border-white/10 rounded p-2 text-xs flex justify-between">
                <div>
                  <div className="font-bold">#{idx + 1} {p.username}</div>
                  <div className="text-white/50">{p.city || "—"}</div>
                </div>
                <div className="text-right">
                  <div>{getRankLabel(p.level)}</div>
                  <div>Lvl {p.level}</div>
                  <div>Rep {p.reputation}</div>
                  <div>${p.balance}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white/5 border border-cyan-400/20 rounded-lg p-4 space-y-3">
          <h3 className="text-xs uppercase tracking-widest text-white/60">Компании</h3>
          <div className="flex gap-2">
            <button onClick={() => setCompanySort("level")} className={`px-2 py-1 rounded text-xs ${companySort === "level" ? "bg-cyan-400 text-black" : "bg-white/10 text-white/70"}`}>Уровень</button>
            <button onClick={() => setCompanySort("wealth")} className={`px-2 py-1 rounded text-xs ${companySort === "wealth" ? "bg-cyan-400 text-black" : "bg-white/10 text-white/70"}`}>Богатство</button>
            <button onClick={() => setCompanySort("blueprints")} className={`px-2 py-1 rounded text-xs ${companySort === "blueprints" ? "bg-cyan-400 text-black" : "bg-white/10 text-white/70"}`}>Чертежи</button>
          </div>
          <div className="space-y-2">
            {companies.map((c, idx) => (
              <div key={c.id} className="bg-black/40 border border-white/10 rounded p-2 text-xs flex justify-between">
                <div>
                  <div className="font-bold">#{idx + 1} {c.name}</div>
                  <div className="text-white/50">{c.city}</div>
                </div>
                <div className="text-right">
                  <div>🏢 {c.level >= 10 ? "Enterprise" : c.level >= 6 ? "Scale-up" : "Startup"}</div>
                  <div>Lvl {c.level}</div>
                  <div>${c.balance}</div>
                  <div>📐 {c.developedBlueprints}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
