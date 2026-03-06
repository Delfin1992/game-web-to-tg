// client/src/pages/Game.tsx
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Briefcase,
  BookOpen,
  Zap,
  TrendingUp,
  Settings,
  BarChart3,
  Home,
  ShoppingCart,
  Landmark,
  Building2,
  Backpack,
  MessageSquare,
  Trophy,
} from "lucide-react";
import Jobs from "./Jobs";
import Shop from "./Shop";
import Bank from "./Bank";
import Inventory, { InventoryItem } from "./Inventory";
import Company from "./Company";
import AdminPanel from "./AdminPanel";
import Education from "./Education";
import Chat from "./Chat";
import Registration from "./Registration";
import Leaderboards from "./Leaderboards";
import Market from "./Market";
import { getRankLabel } from "@/lib/ranks";
import { rollRandomPartDrop, RARITY_LEVELS, getPartPrice } from "@/lib/parts";

interface BankProduct {
  type: "credit" | "deposit";
  amount: number;
  daysLeft: number;
  totalDays: number;
  totalReturn: number;
  name: string;
}

interface Player {
  id?: string;
  name: string;
  city: string;
  personality: string;
  gender: string;
  level: number;
  experience: number;
  balance: number;
  reputation: number;
  skills: {
    coding: number;
    testing: number;
    analytics: number;
    drawing: number;
    modeling: number;
    design: number;
    attention: number;
  };
  workTime: number;
  studyTime: number;
}

interface GameProps {
  onResetGame: () => void;
}

export default function Game({ onResetGame }: GameProps) {
  const [player, setPlayer] = useState<Player | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [currentScreen, setCurrentScreen] = useState<
    | "home"
    | "work"
    | "study"
    | "skills"
    | "jobs"
    | "shop"
    | "bank"
    | "inventory"
    | "company"
    | "admin"
    | "city"
    | "chat"
    | "leaderboard"
    | "market"
    | "registration"
  >("registration");
  const [actionInProgress, setActionInProgress] = useState(false);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [playerCompany, setPlayerCompany] = useState<any>(null);
  const [showReputationMenu, setShowReputationMenu] = useState(false);
  const [jobDropPity, setJobDropPity] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [weeklyQuests, setWeeklyQuests] = useState<
    {
      id: string;
      title: string;
      description: string;
      reward: string;
      progress: number;
      target: number;
      completed: boolean;
      claimed?: boolean;
    }[]
  >([]);

  const getRarityByQuality = (quality: number) => {
    if (quality >= 3) return "Legendary";
    if (quality >= 2) return "Epic";
    if (quality >= 1.5) return "Rare";
    return "Common";
  };

  // ✅ ЗАГРУЗКА ИГРОКА ИЗ БД ПРИ СТАРТЕ
  useEffect(() => {
    async function loadPlayer() {
      try {
        const storedId = localStorage.getItem("playerId");
        if (storedId) {
          const res = await fetch(`/api/users/${storedId}`);
          if (res.ok) {
            const userData = await res.json();
            setPlayer({
              id: userData.id,
              name: userData.username,
              city: userData.city || "Санкт-Петербург",
              personality: userData.personality || "workaholic",
              gender: userData.gender || "male",
              level: userData.level || 1,
              experience: userData.experience || 0,
              balance: userData.balance || 100,
              reputation: userData.reputation || 0,
              skills: userData.skills || {
                coding: 0,
                testing: 0,
                analytics: 0,
                drawing: 0,
                modeling: 0,
                design: 0,
                attention: 0,
              },
              workTime: (userData.workTime || 100) / 100,
              studyTime: (userData.studyTime || 100) / 100,
            });
            setInventory(userData.inventory || []);
            setUserId(userData.id);
            localStorage.setItem("playerId", userData.id);
            setCurrentScreen("home");
          } else {
            setCurrentScreen("registration");
          }
        } else {
          setCurrentScreen("registration");
        }
      } catch (error) {
        console.error("Failed to load player:", error);
        setCurrentScreen("registration");
      } finally {
        setIsLoading(false);
      }
    }

    loadPlayer();
  }, []);

  // ✅ СОХРАНЕНИЕ ПРОГРЕССА В БД
  const savePlayerProgress = async () => {
    if (!player || !userId) return;

    try {
      await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level: player.level,
          experience: player.experience,
          balance: player.balance,
          reputation: player.reputation,
          skills: player.skills,
          workTime: Math.floor(player.workTime * 100),
          studyTime: Math.floor(player.studyTime * 100),
          inventory,
        }),
      });
    } catch (error) {
      console.error("Failed to save progress:", error);
    }
  };

  // ✅ АВТОСОХРАНЕНИЕ КАЖДЫЕ 30 СЕКУНД
  useEffect(() => {
    const interval = setInterval(savePlayerProgress, 30000);
    return () => clearInterval(interval);
  }, [player, inventory, userId]);

  useEffect(() => {
    const wearInterval = setInterval(() => {
      setInventory((prev) =>
        prev.map((item) => {
          if (item.type !== "gadget") return item;
          const nextDurability = Math.max(0, (item.durability ?? 100) - 1);
          return { ...item, durability: nextDurability };
        })
      );
    }, 90000);

    return () => clearInterval(wearInterval);
  }, []);

  // Инициализация еженедельных квестов
  useEffect(() => {
    if (!player) return;

    const spbQuests = [
      {
        id: "spb-1",
        title: "Первый блин — не баг",
        description: "Выполни 5 рабочих заданий в Санкт-Петербурге.",
        reward: "800 ₽ + 300 XP",
        progress: 0,
        target: 5,
        completed: false,
      },
      {
        id: "spb-2",
        title: "Студент ГУАПа",
        description: "Заверши 3 учебных курса (Школа/Колледж).",
        reward: "500 ₽ + 400 XP",
        progress: 0,
        target: 3,
        completed: false,
      },
      {
        id: "spb-3",
        title: "Купи хлеба!",
        description: "Заработай 500 ₽ и купи любой предмет в магазине.",
        reward: "300 ₽ + Булка программиста",
        progress: 0,
        target: 1,
        completed: false,
      },
    ];
    const seoulQuests = [
      {
        id: "seoul-1",
        title: "Seoul Commute",
        description: "Выполни 5 рабочих заданий в Сеуле.",
        reward: "₩15 000 + 300 XP",
        progress: 0,
        target: 5,
        completed: false,
      },
      {
        id: "seoul-2",
        title: "High School Grad",
        description: "Заверши 3 учебных курса (Школа/Колледж).",
        reward: "₩10 000 + 400 XP",
        progress: 0,
        target: 3,
        completed: false,
      },
      {
        id: "seoul-3",
        title: "Bungeo-ppang Break",
        description: "Заработай ₩12 000 и купи любой предмет в магазине.",
        reward: "₩8 000 + Бунгеоппанг",
        progress: 0,
        target: 1,
        completed: false,
      },
    ];
    const sfQuests = [
      {
        id: "sf-1",
        title: "Hello, Silicon Valley!",
        description: "Выполни 5 рабочих заданий в Сан-Франциско.",
        reward: "$12 + 300 XP",
        progress: 0,
        target: 5,
        completed: false,
      },
      {
        id: "sf-2",
        title: "Coding Bootcamp Grad",
        description: "Заверши 3 учебных курса (Школа/Колледж).",
        reward: "$8 + 400 XP",
        progress: 0,
        target: 3,
        completed: false,
      },
      {
        id: "sf-3",
        title: "First Coffee Run",
        description: "Заработай $10 и купи любой предмет в магазине.",
        reward: "$5 + Blue Bottle Coffee",
        progress: 0,
        target: 1,
        completed: false,
      },
    ];
    const sgQuests = [
      {
        id: "sg-1",
        title: "MRT to Work",
        description: "Выполни 5 рабочих заданий в Сингапуре.",
        reward: "S$15 + 300 XP",
        progress: 0,
        target: 5,
        completed: false,
      },
      {
        id: "sg-2",
        title: "Poly Grad",
        description: "Заверши 3 учебных курса (Школа/Колледж).",
        reward: "S$10 + 400 XP",
        progress: 0,
        target: 3,
        completed: false,
      },
      {
        id: "sg-3",
        title: "Hawker Meal",
        description: "Заработай S$12 и купи любой предмет в магазине.",
        reward: "S$8 + Chicken Rice",
        progress: 0,
        target: 1,
        completed: false,
      },
    ];

    let cityQuests = spbQuests;
    if (player.city === "Сеул") cityQuests = seoulQuests;
    if (player.city === "Сан-Франциско") cityQuests = sfQuests;
    if (player.city === "Сингапур") cityQuests = sgQuests;

    const shuffled = [...cityQuests].sort(() => 0.5 - Math.random());
    setWeeklyQuests(shuffled.slice(0, 1));
  }, [player?.city]);


  const addItemToInventory = (item: InventoryItem) => {
    setInventory((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) => (i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...prev, { ...item, quantity: Math.max(1, item.quantity || 1) }];
    });
  };

  const updateQuestProgress = (questId: string, amount: number = 1) => {
    setWeeklyQuests((prev) =>
      prev.map((q) => {
        if (q.id === questId && !q.completed) {
          const newProgress = Math.min(q.progress + amount, q.target);
          const isCompleted = newProgress >= q.target;
          return { ...q, progress: newProgress, completed: isCompleted };
        }
        return q;
      })
    );
  };

  const claimQuestReward = (quest: any) => {
    if (!quest.completed || quest.claimed || !player) return;
    const moneyMatch = quest.reward.match(/(\d+)\s*[₽\$₩S]/);
    const expMatch = quest.reward.match(/(\d+)\s*XP/);
    const moneyReward = moneyMatch ? parseInt(moneyMatch[1]) : 0;
    const repReward = 10;
    const expReward = expMatch ? parseInt(expMatch[1]) : 0;

    setPlayer((p) => {
      if (!p) return p;
      const newExp = p.experience + expReward;
      return {
        ...p,
        balance: p.balance + moneyReward,
        reputation: p.reputation + repReward,
        level: p.level + Math.floor(newExp / 100),
        experience: newExp >= 100 ? newExp % 100 : newExp,
      };
    });

    setWeeklyQuests((prev) =>
      prev.map((q) => (q.id === quest.id ? { ...q, claimed: true } : q))
    );
  };

  // Регенерация энергии
  useEffect(() => {
    const interval = setInterval(() => {
      setPlayer((p) => {
        if (!p) return p;
        return {
          ...p,
          workTime: Math.min(p.workTime + 0.05, 1),
          studyTime: Math.min(p.studyTime + 0.05, 1),
        };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleWork = async () => {
    if (!player || player.workTime < 0.3) return;
    setActionInProgress(true);
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const bonus = getCityBonus();
    let moneyGained = Math.floor(Math.random() * 50) + 30;
    let expGained = Math.floor(Math.random() * 10) + 5;

    if (player.personality === "workaholic") expGained = Math.floor(expGained * 1.2);
    if (player.personality === "businessman") moneyGained = Math.floor(moneyGained * 1.15);
    moneyGained = Math.floor(moneyGained * (1 + bonus.salaryBoost / 100));
    expGained = Math.floor(expGained * (1 + bonus.xpBoost / 100));

    setPlayer((p) => {
      if (!p) return p;
      const newExp = p.experience + expGained;
      return {
        ...p,
        workTime: Math.max(0, p.workTime - 0.3),
        balance: p.balance + moneyGained,
        reputation: (p.reputation || 0) + 2,
        level: newExp >= 100 ? p.level + 1 : p.level,
        experience: newExp >= 100 ? newExp % 100 : newExp,
      };
    });

    setActionInProgress(false);

    const droppedPart = rollRandomPartDrop(22);
    if (droppedPart) {
      addItemToInventory({
        id: droppedPart.id,
        name: `${RARITY_LEVELS[droppedPart.rarity].icon} ${droppedPart.name}`,
        stats: droppedPart.stats as Record<string, number>,
        rarity: droppedPart.rarity,
        quantity: 1,
        type: "part",
      });
      alert(`🎁 Найдена деталь: ${droppedPart.name} (${droppedPart.rarity}) за ~${getCurrencySymbol()}${getPartPrice(droppedPart.id)}`);
    }

    if (player.city === "Санкт-Петербург") updateQuestProgress("spb-1");
    else if (player.city === "Сеул") updateQuestProgress("seoul-1");
    else if (player.city === "Сан-Франциско") updateQuestProgress("sf-1");
    else if (player.city === "Сингапур") updateQuestProgress("sg-1");
  };

  const handleStudy = async () => {
    if (!player || player.studyTime < 0.3) return;
    setActionInProgress(true);
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const skillBoosts: (keyof Player["skills"])[] = ["coding", "testing", "analytics"];
    const boostedSkill = skillBoosts[Math.floor(Math.random() * skillBoosts.length)];
    const bonus = getCityBonus();

    setPlayer((p) => {
      if (!p) return p;
      let skillIncrease = 1;
      if (bonus.skillGrowthBoost > 0 && Math.random() * 100 < bonus.skillGrowthBoost) {
        skillIncrease = 2;
      }
      if (p.personality === "lucky" && Math.random() < 0.2) {
        skillIncrease += 1;
      }
      return {
        ...p,
        studyTime: Math.max(0, p.studyTime - 0.3),
        reputation: (p.reputation || 0) + 3,
        skills: {
          ...p.skills,
          [boostedSkill]: p.skills[boostedSkill] + skillIncrease,
        },
      };
    });

    setActionInProgress(false);
    if (player.city === "Санкт-Петербург") updateQuestProgress("spb-2");
    else if (player.city === "Сеул") updateQuestProgress("seoul-2");
    else if (player.city === "Сан-Франциско") updateQuestProgress("sf-2");
    else if (player.city === "Сингапур") updateQuestProgress("sg-2");
  };

  const getCurrencySymbol = () => {
    if (!player) return "$";
    const citySymbols: Record<string, string> = {
      "Сан-Франциско": "$",
      "Сингапур": "S$",
      "Санкт-Петербург": "₽",
      "Сеул": "₩",
    };
    return citySymbols[player.city] || "$";
  };

  const getReputationStatus = (rep: number) => {
    if (rep >= 1000) return { title: "Легенда", color: "text-yellow-400" };
    if (rep >= 600) return { title: "Икона IT", color: "text-orange-400" };
    if (rep >= 300) return { title: "Уважаемый", color: "text-blue-400" };
    if (rep >= 100) return { title: "Местный", color: "text-green-400" };
    return { title: "Незнакомец", color: "text-white/50" };
  };

  const getCityBonus = () => {
    if (!player) return { failureRateReduction: 0, salaryBoost: 0, skillGrowthBoost: 0, xpBoost: 0 };
    const rep = player.reputation;
    const city = player.city;
    let bonus = { failureRateReduction: 0, salaryBoost: 0, skillGrowthBoost: 0, xpBoost: 0 };

    if (city === "Санкт-Петербург") {
      if (rep >= 100) bonus.failureRateReduction = 10;
      if (rep >= 300) bonus.skillGrowthBoost = 5;
      if (rep >= 600) bonus.failureRateReduction = 20;
      if (rep >= 1000) bonus.failureRateReduction = 25;
    }
    if (city === "Сан-Франциско") {
      if (rep >= 100) bonus.salaryBoost = 8;
      if (rep >= 300) bonus.xpBoost = 12;
      if (rep >= 600) bonus.salaryBoost = 12;
      if (rep >= 1000) bonus.salaryBoost = 15;
    }
    if (city === "Сингапур") {
      if (rep >= 100) bonus.failureRateReduction = 15;
      if (rep >= 300) bonus.salaryBoost = 6;
      if (rep >= 600) bonus.failureRateReduction = 18;
      if (rep >= 1000) bonus.skillGrowthBoost = 9;
    }
    if (city === "Сеул") {
      if (rep >= 100) bonus.salaryBoost = 10;
      if (rep >= 300) bonus.skillGrowthBoost = 7;
      if (rep >= 600) bonus.xpBoost = 5;
      if (rep >= 1000) bonus.failureRateReduction = 30;
    }

    return bonus;
  };

  // ✅ ОБРАБОТКА РЕГИСТРАЦИИ С СОЗДАНИЕМ В БД
  const handleRegistrationComplete = async (data: any) => {
    try {
      const fingerprintKey = "deviceFingerprint";
      let deviceFingerprint = localStorage.getItem(fingerprintKey);
      if (!deviceFingerprint) {
        deviceFingerprint = `fp_${crypto.randomUUID()}`;
        localStorage.setItem(fingerprintKey, deviceFingerprint);
      }

      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: data.name,
          password: "temp_" + Date.now(),
          city: data.city,
          personality: data.personality,
          gender: data.gender,
          referralCode: data.referralCode || undefined,
          telegramId: data.telegramId || undefined,
          deviceFingerprint,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        alert("Ошибка регистрации: " + error.error);
        return;
      }

      const userData = await res.json();
      setUserId(userData.id);
      localStorage.setItem("playerId", userData.id);

      setPlayer({
        id: userData.id,
        name: userData.username,
        city: userData.city,
        personality: userData.personality,
        gender: userData.gender,
        level: userData.level,
        experience: userData.experience,
        balance: userData.balance,
        reputation: 0,
        skills: {
          coding: 0,
          testing: 0,
          analytics: 0,
          drawing: 0,
          modeling: 0,
          design: 0,
          attention: 0,
        },
        workTime: 1,
        studyTime: 1,
      });

      setCurrentScreen("home");
    } catch (error) {
      console.error("Registration error:", error);
      alert("Ошибка регистрации");
    }
  };

  // ✅ ЭКРАН ЗАГРУЗКИ
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-white/60 text-sm uppercase tracking-widest">Загрузка...</p>
        </div>
      </div>
    );
  }

  // ✅ ЭКРАН РЕГИСТРАЦИИ
  if (currentScreen === "registration" || !player) {
    return <Registration onComplete={handleRegistrationComplete} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black text-white p-4 pb-24">
      {/* HEADER */}
      <div className="max-w-md mx-auto space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-lg font-bold text-white">{player.name}</h1>
            <p className="text-xs text-white/60">{getRankLabel(player.level)} • Level {player.level}</p>
          </div>
          <button
            onClick={() => setCurrentScreen("admin")}
            className="bg-white/10 border border-white/20 text-white p-2 rounded hover:bg-white/20 transition"
          >
            <Settings size={20} />
          </button>
        </div>

        {/* Balance */}
        <div className="bg-gradient-to-r from-primary/20 to-primary/5 border border-primary/30 rounded-xl p-4">
          <p className="text-xs text-white/60 uppercase">Баланс</p>
          <p className="text-2xl font-bold text-primary">
            {getCurrencySymbol()}
            {player.balance.toLocaleString()}
          </p>
        </div>

        {/* Progress Bars */}
        <div className="space-y-2">
          <div className="bg-black/40 border border-white/10 rounded p-3">
            <div className="flex justify-between text-xs mb-2">
              <span className="text-white/60">Experience</span>
              <span className="text-primary">{player.experience}/100</span>
            </div>
            <div className="w-full bg-black/60 rounded-full h-2 overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-primary to-secondary"
                animate={{ width: `${player.experience}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>

          {/* Reputation Bar */}
          <button
            onClick={() => setShowReputationMenu(!showReputationMenu)}
            className="w-full bg-black/40 border border-white/10 rounded p-3 text-left hover:border-yellow-500/30 transition relative"
          >
            <div className="flex justify-between text-xs mb-2">
              <span className="text-white/60">Репутация в {player.city}</span>
              <span className={`font-bold ${getReputationStatus(player.reputation).color}`}>
                {getReputationStatus(player.reputation).title}
              </span>
            </div>
            <div className="w-full bg-black/60 rounded-full h-2 overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-yellow-500 to-orange-500"
                animate={{ width: `${Math.min((player.reputation % 1000) / 10, 100)}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <div className="text-[10px] text-white/40 mt-1">
              {player.reputation} очков (кликните для подробностей)
            </div>

            {showReputationMenu && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute top-full left-0 right-0 bg-black/95 border border-yellow-500/30 rounded mt-2 p-4 z-50 text-white text-xs space-y-3"
              >
                <div className="border-b border-white/10 pb-3">
                  <p className="font-bold text-yellow-400 mb-2">📊 Способы заработать репутацию:</p>
                  <p className="text-white/70">• Работа: +2 репутации за задание</p>
                  <p className="text-white/70">• Обучение: +3 репутации за курс</p>
                  <p className="text-white/70">• Недельные квесты: +10 репутации за награду</p>
                </div>
                <div>
                  <p className="font-bold text-yellow-400 mb-2">🏆 Уровни и бонусы в {player.city}:</p>
                  {player.city === "Санкт-Петербург" && (
                    <div className="space-y-1 text-white/70">
                      <p>100+: -10% шанс провала на учёбе</p>
                      <p>300+: +5% ускорение роста навыков</p>
                      <p>600+: -20% провал на учёбе</p>
                      <p className="text-yellow-300">1000+: -25% провал (Легенда)</p>
                    </div>
                  )}
                  {player.city === "Сан-Франциско" && (
                    <div className="space-y-1 text-white/70">
                      <p>100+: +8% к зарплате</p>
                      <p>300+: +12% к опыту</p>
                      <p>600+: +12% зарплата</p>
                      <p className="text-yellow-300">1000+: +15% зарплата (Легенда)</p>
                    </div>
                  )}
                  {player.city === "Сингапур" && (
                    <div className="space-y-1 text-white/70">
                      <p>100+: -15% провал на учёбе</p>
                      <p>300+: +6% доход</p>
                      <p>600+: -18% провал</p>
                      <p className="text-yellow-300">1000+: +9% навыки, -20% провал (Легенда)</p>
                    </div>
                  )}
                  {player.city === "Сеул" && (
                    <div className="space-y-1 text-white/70">
                      <p>100+: +10% к зарплате</p>
                      <p>300+: +7% ускорение навыков</p>
                      <p>600+: +5% XP</p>
                      <p className="text-yellow-300">1000+: -30% провал (Легенда)</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      {currentScreen === "home" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="max-w-md mx-auto space-y-4 flex flex-col items-center justify-center min-h-[60vh]"
        >
          {/* CHARACTER IMAGE */}
          <div className="flex justify-center mb-4">
            <img
              src={player.gender === "female" ? "/character-female.png" : "/character-male.png"}
              alt="Character"
              className="h-80 w-auto object-contain drop-shadow-[0_0_30px_rgba(0,255,255,0.3)]"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='40' fill='%2300ffff' opacity='0.3'/%3E%3C/svg%3E";
              }}
            />
          </div>

          {/* HOME TABS */}
          <div className="grid grid-cols-3 gap-3 w-full max-w-sm px-4">
            <motion.button
              onClick={() => setCurrentScreen("skills")}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-white/5 border border-primary/20 rounded-xl p-3 flex flex-col items-center gap-2 hover:bg-white/10 transition"
            >
              <BarChart3 className="text-primary" size={24} />
              <span className="text-[10px] uppercase font-bold text-white">Навыки</span>
            </motion.button>

            <motion.button
              onClick={() => setCurrentScreen("inventory")}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-white/5 border border-primary/20 rounded-xl p-3 flex flex-col items-center gap-2 hover:bg-white/10 transition"
            >
              <Backpack className="text-primary" size={24} />
              <span className="text-[10px] uppercase font-bold text-white">Предметы</span>
            </motion.button>

            <motion.button
              onClick={() => setCurrentScreen("bank")}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-white/5 border border-primary/20 rounded-xl p-3 flex flex-col items-center gap-2 hover:bg-white/10 transition"
            >
              <Landmark className="text-primary" size={24} />
              <span className="text-[10px] uppercase font-bold text-white">Банк</span>
            </motion.button>

            <motion.button
              onClick={() => setCurrentScreen("leaderboard")}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-white/5 border border-yellow-500/20 rounded-xl p-3 flex flex-col items-center gap-2 hover:bg-white/10 transition"
            >
              <Trophy className="text-yellow-400" size={24} />
              <span className="text-[10px] uppercase font-bold text-white">Рейтинг</span>
            </motion.button>
          </div>

          {/* WEEKLY QUESTS */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4 w-full max-w-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                Еженедельные задания
              </h3>
              <span className="text-[10px] text-white/40 uppercase font-bold">Обновление через 6д</span>
            </div>

            <div className="space-y-3">
              {weeklyQuests.map((quest) => (
                <div key={quest.id} className="bg-black/40 border border-white/5 rounded-xl p-3 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs font-bold text-white">{quest.title}</p>
                      <p className="text-[10px] text-white/50 leading-tight mt-1">{quest.description}</p>
                    </div>
                    {quest.completed ? (
                      quest.claimed ? (
                        <span className="text-[10px] font-bold text-white/40 uppercase bg-white/5 px-2 py-0.5 rounded">
                          Получено
                        </span>
                      ) : (
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => claimQuestReward(quest)}
                          className="text-[10px] font-bold text-black uppercase bg-primary px-2 py-0.5 rounded shadow-[0_0_10px_rgba(0,255,255,0.5)]"
                        >
                          Забрать
                        </motion.button>
                      )
                    ) : (
                      <span className="text-[10px] font-mono text-primary">
                        {quest.progress}/{quest.target}
                      </span>
                    )}
                  </div>
                  <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-500"
                      style={{ width: `${(quest.progress / quest.target) * 100}%` }}
                    />
                  </div>
                  <div className="flex items-center gap-1.5 pt-1">
                    <span className="text-[9px] text-white/30 uppercase font-bold tracking-tighter">
                      Награда:
                    </span>
                    <span className="text-[9px] text-yellow-500/80 font-bold uppercase">{quest.reward}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* PLAYER INFO */}
          <div className="text-center space-y-1 bg-black/40 backdrop-blur-sm border border-white/10 p-3 rounded-xl w-full max-w-xs mt-4">
            <h2 className="text-lg font-bold text-white tracking-widest uppercase">{player.name}</h2>
            <div className="flex justify-center items-center gap-2 text-primary text-[10px] font-mono">
              <span>{player.city}</span>
              <span className="text-white/20">|</span>
              <span>
                {player.personality === "workaholic" && "💪 Трудоголик"}
                {player.personality === "businessman" && "💼 Бизнесмен"}
                {player.personality === "genius" && "🧠 Гений"}
                {player.personality === "lucky" && "🍀 Счастливчик"}
              </span>
            </div>
          </div>
        </motion.div>
      )}

      {currentScreen === "city" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="max-w-md mx-auto space-y-6 flex flex-col items-center justify-center min-h-[60vh]"
        >
          <h2 className="text-2xl font-bold text-white uppercase tracking-widest mb-4">Город</h2>
          <div className="grid grid-cols-1 gap-4 w-full max-w-xs px-4">
            <motion.button
              onClick={() => setCurrentScreen("shop")}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-gradient-to-br from-pink-500/20 to-pink-600/10 border border-pink-400/30 rounded-2xl p-6 flex flex-col items-center gap-3 hover:border-pink-400/60 transition"
            >
              <ShoppingCart className="text-pink-400" size={32} />
              <span className="text-lg font-bold text-white uppercase tracking-wider">Магазин</span>
            </motion.button>

            <motion.button
              onClick={() => setCurrentScreen("company")}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 border border-cyan-400/30 rounded-2xl p-6 flex flex-col items-center gap-3 hover:border-cyan-400/60 transition"
            >
              <Building2 className="text-cyan-400" size={32} />
              <span className="text-lg font-bold text-white uppercase tracking-wider">Компании</span>
            </motion.button>

            <motion.button
              onClick={() => setCurrentScreen("market")}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-400/30 rounded-2xl p-6 flex flex-col items-center gap-3 hover:border-emerald-400/60 transition"
            >
              <ShoppingCart className="text-emerald-400" size={32} />
              <span className="text-lg font-bold text-white uppercase tracking-wider">Маркет</span>
            </motion.button>
          </div>
        </motion.div>
      )}

      {currentScreen === "jobs" && (
        <Jobs
          onBack={() => setCurrentScreen("home")}
          playerCity={player.city}
          playerLevel={player.level}
          playerPersonality={player.personality}
          onCompleteWork={(reward, expReward) => {
            setPlayer((p) => {
              if (!p) return p;
              let finalMoney = reward;
              let finalExp = expReward;
              if (p.personality === "workaholic") finalExp = Math.floor(finalExp * 1.2);
              if (p.personality === "businessman") finalMoney = Math.floor(finalMoney * 1.15);
              const newExp = p.experience + finalExp;
              return {
                ...p,
                balance: p.balance + finalMoney,
                reputation: (p.reputation || 0) + 2,
                experience: newExp >= 100 ? newExp % 100 : newExp,
                level: newExp >= 100 ? p.level + 1 : p.level,
              };
            });

            const baseChance = expReward >= 45 ? 50 : expReward >= 30 ? 38 : 28;
            const effectiveChance = Math.min(85, baseChance + jobDropPity * 15);
            const droppedPart = rollRandomPartDrop(effectiveChance);

            if (droppedPart) {
              addItemToInventory({
                id: droppedPart.id,
                name: `${RARITY_LEVELS[droppedPart.rarity].icon} ${droppedPart.name}`,
                stats: droppedPart.stats as Record<string, number>,
                rarity: droppedPart.rarity,
                quantity: 1,
                type: "part",
              });
              setJobDropPity(0);
              alert(`🎁 За вакансию получена деталь: ${droppedPart.name} (${droppedPart.rarity})`);
            } else {
              setJobDropPity((prev) => Math.min(prev + 1, 4));
            }

            if (player.city === "Санкт-Петербург") updateQuestProgress("spb-1");
            else if (player.city === "Сеул") updateQuestProgress("seoul-1");
            else if (player.city === "Сан-Франциско") updateQuestProgress("sf-1");
            else if (player.city === "Сингапур") updateQuestProgress("sg-1");
          }}
        />
      )}

      {currentScreen === "shop" && (
        <Shop
          onBack={() => setCurrentScreen("home")}
          playerBalance={player.balance}
          onBuyItem={(item) => {
            setPlayer((p) => {
              if (!p) return p;
              return { ...p, balance: p.balance - item.price };
            });
            if (player.city === "Санкт-Петербург") updateQuestProgress("spb-3");
            else if (player.city === "Сеул") updateQuestProgress("seoul-3");
            else if (player.city === "Сан-Франциско") updateQuestProgress("sf-3");
            else if (player.city === "Сингапур") updateQuestProgress("sg-3");
            addItemToInventory({ ...item, quantity: 1 } as InventoryItem);
          }}
        />
      )}

      {currentScreen === "bank" && (
        <Bank
          onBack={() => setCurrentScreen("home")}
          playerBalance={player.balance}
          playerLevel={player.level}
          playerCity={player.city}
          onAddBalance={(amount) => {
            setPlayer((p) => {
              if (!p) return p;
              return { ...p, balance: p.balance + amount };
            });
          }}
          activeBankProduct={null}
          onSetBankProduct={() => {}}
        />
      )}

      {currentScreen === "inventory" && (
        <Inventory
          onBack={() => setCurrentScreen("home")}
          items={inventory}
          onUseItem={(id) => {
            const item = inventory.find((i) => i.id === id);
            if (item && item.type === "consumable") {
              setPlayer((p) => {
                if (!p) return p;
                const newSkills = { ...p.skills };
                Object.entries(item.stats).forEach(([stat, value]) => {
                  const skillKey = stat as keyof typeof p.skills;
                  if (skillKey in newSkills) {
                    newSkills[skillKey] += value;
                  }
                });
                return { ...p, skills: newSkills };
              });
              setInventory((prev) => {
                const existing = prev.find((i) => i.id === id);
                if (existing && existing.quantity > 1) {
                  return prev.map((i) =>
                    i.id === id ? { ...i, quantity: i.quantity - 1 } : i
                  );
                }
                return prev.filter((i) => i.id !== id);
              });
              alert(`Предмет ${item.name} использован! Характеристики повышены.`);
            }
          }}
          onToggleGear={(id) => {
            const item = inventory.find((i) => i.id === id);
            if (item && item.type === "gear") {
              const isEquipping = !item.isEquipped;
              setPlayer((p) => {
                if (!p) return p;
                const newSkills = { ...p.skills };
                Object.entries(item.stats).forEach(([stat, value]) => {
                  const skillKey = stat as keyof typeof p.skills;
                  if (skillKey in newSkills) {
                    newSkills[skillKey] += isEquipping ? value : -value;
                  }
                });
                return { ...p, skills: newSkills };
              });
              setInventory((prev) =>
                prev.map((i) => (i.id === id ? { ...i, isEquipped: isEquipping } : i))
              );
            }
          }}
          onServiceGadget={(id) => {
            const item = inventory.find((i) => i.id === id && i.type === "gadget");
            if (!item || !player) return;
            const maxDurability = item.maxDurability ?? 100;
            const currentDurability = item.durability ?? maxDurability;
            const missingDurability = Math.max(0, maxDurability - currentDurability);
            const serviceCost = Math.max(20, missingDurability * 5);

            if (missingDurability === 0) {
              alert("Гаджет уже в идеальном состоянии");
              return;
            }

            if (player.balance < serviceCost) {
              alert(`Недостаточно средств на обслуживание (${serviceCost})`);
              return;
            }

            setPlayer((p) => (p ? { ...p, balance: p.balance - serviceCost } : p));
            setInventory((prev) =>
              prev.map((i) =>
                i.id === id ? { ...i, durability: maxDurability } : i
              )
            );
            alert(`Гаджет обслужен за ${serviceCost}`);
          }}
        />
      )}

      {currentScreen === "company" && (
        <Company
          onBack={() => setCurrentScreen("city")}
          playerLevel={player.level}
          playerCity={player.city}
          playerBalance={player.balance}
          playerName={player.name}
          playerCompany={playerCompany}
          currentPlayerId={userId || ""}  // ✅ ДОБАВИТЬ ЭТУ СТРОКУ
          onCreateCompany={(name, cost) => {
            setPlayer((p) => {
              if (!p) return p;
              return { ...p, balance: p.balance - cost };
            });
            setPlayerCompany({
              id: `comp-${Date.now()}`,
              name,
              level: 1,
              experience: 0,
              balance: 0,
              role: "CEO",
              employees: [
                { id: 1, name: player.name, role: "CEO", salary: 0 }
              ],
              warehouse: [],
              projects: []
            });
            setCurrentScreen("company");
          }}
          onUpdateCompany={(update) =>
            setPlayerCompany((prev: any) => {
              if (Object.keys(update).length === 0) return null;
              return { ...(prev ?? {}), ...update };
            })
          }
          onUpdatePlayerBalance={(amount) =>
            setPlayer((p) => {
              if (!p) return p;
              return { ...p, balance: p.balance + amount };
            })
          }
          playerSkills={player.skills}
          playerInventory={inventory}
          onConsumeInventoryParts={(partIds) => {
            setInventory((prev) => prev.filter((item) => !partIds.includes(item.id)));
          }}
        />
      )}

      {currentScreen === "leaderboard" && (
        <Leaderboards onBack={() => setCurrentScreen("home")} />
      )}

      {currentScreen === "market" && (
        <Market
          onBack={() => setCurrentScreen("city")}
          userId={userId || ""}
          onPurchase={({ price, gadget }) => {
            setPlayer((p) => (p ? { ...p, balance: p.balance - price } : p));
            if (!gadget) return;

            const inventoryGadget: InventoryItem = {
              id: `gadget-${gadget.id}`,
              name: gadget.name,
              stats: gadget.stats || {},
              rarity: getRarityByQuality(Number(gadget.quality || 1)),
              quantity: 1,
              type: "gadget",
              durability: gadget.durability ?? 100,
              maxDurability: gadget.maxDurability ?? 100,
            };
            setInventory((prev) => [inventoryGadget, ...prev]);
          }}
        />
      )}

      {currentScreen === "admin" && (
        <AdminPanel
          onBack={() => setCurrentScreen("home")}
          playerLevel={player.level}
          playerBalance={player.balance}
          playerName={player.name}
          onUpdateLevel={(newLevel) => {
            setPlayer((p) => {
              if (!p) return p;
              return { ...p, level: newLevel };
            });
          }}
          onAddMoney={(amount) => {
            setPlayer((p) => {
              if (!p) return p;
              return { ...p, balance: p.balance + amount };
            });
          }}
          onResetGame={() => {
            localStorage.removeItem("playerId");
            setPlayer(null);
            setUserId(null);
            setPlayerCompany(null);
            setCurrentScreen("registration");
          }}
        />
      )}

      {currentScreen === "work" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-md mx-auto space-y-4">
          <button
            onClick={() => setCurrentScreen("home")}
            className="text-primary/70 hover:text-primary text-xs uppercase tracking-wider transition"
          >
            ← Назад
          </button>
          <div className="bg-white/5 border border-primary/20 rounded-lg p-6 text-center space-y-4">
            <Briefcase size={40} className="text-blue-400 mx-auto" />
            <div>
              <h2 className="text-lg font-bold text-white mb-1">Работа</h2>
              <p className="text-white/60 text-sm">Зарабатывай деньги и опыт за работу</p>
            </div>
            <div className="bg-black/40 border border-white/10 rounded p-4">
              <div className="text-xs text-white/60 mb-2">Готовность к работе</div>
              <div className="w-full bg-black/60 rounded-full h-3 overflow-hidden mb-2">
                <motion.div
                  className="h-full bg-gradient-to-r from-blue-400 to-blue-600"
                  animate={{ width: `${player.workTime * 100}%` }}
                />
              </div>
              <div className="text-sm font-mono text-blue-300">
                {(player.workTime * 100).toFixed(0)}%
              </div>
            </div>
            <button
              onClick={handleWork}
              disabled={player.workTime < 0.3 || actionInProgress}
              className="w-full bg-blue-500 text-white font-bold py-3 rounded uppercase tracking-wider hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actionInProgress ? "Работаю..." : "Начать работу"}
            </button>
            <p className="text-xs text-white/40">⏱️ Требуется 30% энергии | +$30-80 + опыт</p>
          </div>
        </motion.div>
      )}

      {currentScreen === "study" && (
        <Education
          onBack={() => setCurrentScreen("home")}
          playerLevel={player.level}
          playerBalance={player.balance}
          playerCity={player.city}
          playerReputation={player.reputation}
          onCompleteEducation={(skillBoosts, cost) => {
            setPlayer((p) => {
              if (!p) return p;
              return {
                ...p,
                balance: p.balance - cost,
                reputation: p.reputation + 3,
                skills: {
                  ...p.skills,
                  ...Object.fromEntries(
                    Object.entries(skillBoosts).map(([skill, boost]) => [
                      skill,
                      (p.skills[skill as keyof typeof p.skills] || 0) + boost,
                    ])
                  ),
                },
              };
            });
            if (player.city === "Санкт-Петербург") updateQuestProgress("spb-2");
            else if (player.city === "Сеул") updateQuestProgress("seoul-2");
            else if (player.city === "Сан-Франциско") updateQuestProgress("sf-2");
            else if (player.city === "Сингапур") updateQuestProgress("sg-2");
          }}
        />
      )}

      {currentScreen === "chat" && (
        <Chat
          onBack={() => setCurrentScreen("home")}
          username={player.name}
          userId={userId || ""}  // ✅ ИСПРАВИТЬ (было player.name)
        />
      )}

      {currentScreen === "skills" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-md mx-auto space-y-4">
          <button
            onClick={() => setCurrentScreen("home")}
            className="text-primary/70 hover:text-primary text-xs uppercase tracking-wider transition"
          >
            ← Назад
          </button>
          <div className="bg-white/5 border border-primary/20 rounded-lg p-6">
            <h2 className="text-lg font-bold text-white mb-4 uppercase tracking-widest">Навыки</h2>
            <div className="space-y-4">
              {Object.entries(player.skills).map(([skill, level]) => (
                <div key={skill}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-white/80 capitalize font-mono">{skill}</span>
                    <span className="text-primary font-bold">{level}</span>
                  </div>
                  <div className="w-full bg-black/60 rounded-full h-2 overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-primary to-secondary"
                      animate={{ width: `${Math.min(level * 10, 100)}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 pt-4 border-t border-white/10">
              <p className="text-xs text-white/40">
                💡 Совет: учись, чтобы развивать навыки. Каждая учеба дает +1 к случайному навыку.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* BOTTOM NAVIGATION */}
      <div className="fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-md border-t border-white/10 p-4 z-50">
        <div className="max-w-md mx-auto flex justify-between items-center px-2">
          <button
            onClick={() => setCurrentScreen("home")}
            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition ${
              currentScreen === "home" ? "text-primary bg-primary/10" : "text-white/40 hover:text-white"
            }`}
          >
            <Home size={24} />
            <span className="text-[10px] uppercase font-bold">Дом</span>
          </button>

          <button
            onClick={() => setCurrentScreen("jobs")}
            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition ${
              currentScreen === "jobs" ? "text-primary bg-primary/10" : "text-white/40 hover:text-white"
            }`}
          >
            <Briefcase size={24} />
            <span className="text-[10px] uppercase font-bold">Работа</span>
          </button>

          <button
            onClick={() => setCurrentScreen("study")}
            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition ${
              currentScreen === "study" ? "text-primary bg-primary/10" : "text-white/40 hover:text-white"
            }`}
          >
            <BookOpen size={24} />
            <span className="text-[10px] uppercase font-bold">Учеба</span>
          </button>

          <button
            onClick={() => setCurrentScreen("chat")}
            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition ${
              currentScreen === "chat" ? "text-primary bg-primary/10" : "text-white/40 hover:text-white"
            }`}
          >
            <MessageSquare size={24} />
            <span className="text-[10px] uppercase font-bold">Чат</span>
          </button>

          <button
            onClick={() => setCurrentScreen("city")}
            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition ${
              ["city", "shop", "company"].includes(currentScreen)
                ? "text-primary bg-primary/10"
                : "text-white/40 hover:text-white"
            }`}
          >
            <Building2 size={24} />
            <span className="text-[10px] uppercase font-bold">Город</span>
          </button>
        </div>
      </div>
    </div>
  );
}
