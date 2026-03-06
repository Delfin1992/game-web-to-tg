// client/src/components/Registration.tsx
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

const CITIES = [
  {
    id: "sf",
    name: "Сан-Франциско",
    emoji: "🌉",
    currency: "USD",
    desc: "Кремниевая долина. Бонусы: +8-15% к зарплате, +12% к опыту (при высокой репутации).",
  },
  {
    id: "singapore",
    name: "Сингапур",
    emoji: "🏙️",
    currency: "SGD",
    desc: "Финтех-хаб. Бонусы: -15% шанс провала, +6% доход, +9% к навыкам (при высокой репутации).",
  },
  {
    id: "spb",
    name: "Санкт-Петербург",
    emoji: "🏛️",
    currency: "RUB",
    desc: "Культурная столица. Бонусы: -25% шанс провала, +5% к росту навыков (при высокой репутации).",
  },
  {
    id: "seoul",
    name: "Сеул",
    emoji: "🌃",
    currency: "KRW",
    desc: "K-Tech. Бонусы: +10% к зарплате, +7% к росту навыков, +5% к опыту (при высокой репутации).",
  },
];

const PERSONALITIES = [
  {
    id: "workaholic",
    name: "Трудоголик 💪",
    emoji: "💪",
    desc: "Получает на 20% больше опыта за работу",
    bonuses: { exp_multiplier: 1.2 },
  },
  {
    id: "businessman",
    name: "Бизнесмен 💼",
    emoji: "💼",
    desc: "Получает на 15% больше денег за работу",
    bonuses: { money_multiplier: 1.15 },
  },
  {
    id: "genius",
    name: "Гений 🧠",
    emoji: "🧠",
    desc: "Начинает с повышенными характеристиками в 1.5x",
    bonuses: { stats_multiplier: 1.5 },
  },
  {
    id: "lucky",
    name: "Счастливчик 🍀",
    emoji: "🍀",
    desc: "Имеет шанс получить бонусные награды",
    bonuses: { luck_multiplier: 1.2 },
  },
];

interface PlayerData {
  name: string;
  city: string;
  personality: string;
  gender: string;
  id?: string;
  referralCode?: string;
  telegramId?: string;
}

interface RegistrationProps {
  onComplete: (data: PlayerData) => void;
}

export default function Registration({ onComplete }: RegistrationProps) {
  const [step, setStep] = useState<"name" | "city" | "personality" | "gender">("name");
  const [formData, setFormData] = useState({
    name: "",
    city: CITIES[0].name,
    personality: PERSONALITIES[0].id,
    gender: "male",
    referralCode: "",
    telegramId: "",
  });
  const [cityIndex, setCityIndex] = useState(0);
  const [personalityIndex, setPersonalityIndex] = useState(0);
  const [usernameError, setUsernameError] = useState("");
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [isRegistering] = useState(false);

  // ✅ Проверка доступности ника
  const checkUsername = async (username: string) => {
    if (username.length < 2) {
      setUsernameError("Минимум 2 символа");
      return false;
    }

    setCheckingUsername(true);
    try {
      const res = await fetch(`/api/check-username/${encodeURIComponent(username)}`);
      const data = await res.json();

      if (data.exists) {
        setUsernameError("Этот ник уже занят");
        return false;
      } else {
        setUsernameError("");
        return true;
      }
    } catch {
      setUsernameError("Ошибка проверки");
      return false;
    } finally {
      setCheckingUsername(false);
    }
  };

  const handleNameSubmit = async () => {
    const isAvailable = await checkUsername(formData.name);
    if (isAvailable) {
      setStep("city");
    }
  };

  const handleCitySelect = () => {
    setFormData({ ...formData, city: CITIES[cityIndex].name });
    setStep("personality");
  };

  const handlePersonalitySelect = () => {
    setFormData({
      ...formData,
      personality: PERSONALITIES[personalityIndex].id,
    });
    setStep("gender");
  };

  // Передаём выбранный пол и завершаем onboarding
  const handleGenderSelect = (selectedGender: string) => {
    setFormData({
      ...formData,
      gender: selectedGender,
    });

    // ✅ ДОБАВИТЬ: Сохранение userId
    const newUserId = `user-${Date.now()}`;
    localStorage.setItem("playerId", newUserId);

    onComplete({
      ...formData,
      gender: selectedGender,
      id: newUserId,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black p-6 flex flex-col items-center justify-center">
      <AnimatePresence mode="wait">
        {/* === STEP 1: NAME === */}
        {step === "name" && (
          <motion.div
            key="name"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6 w-full max-w-md"
          >
            <div className="text-center space-y-2">
              <h1 className="text-3xl font-bold text-white uppercase tracking-widest">Career Sim</h1>
              <p className="text-white/40 text-sm">Стань IT-профессионалом за одну ночь</p>
            </div>

            <div className="bg-white/5 border border-primary/20 rounded-lg p-6 backdrop-blur-md">
              <label className="block text-xs uppercase tracking-wider text-primary/70 mb-3">
                Как тебя зовут?
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value });
                  setUsernameError("");
                }}
                onBlur={() => checkUsername(formData.name)}
                onKeyPress={(e) => e.key === "Enter" && handleNameSubmit()}
                placeholder="Введи свой позывной..."
                className="w-full bg-black/40 border border-white/10 rounded px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-primary/80 transition-colors"
                autoFocus
              />
              <input
                type="text"
                value={formData.referralCode}
                onChange={(e) => setFormData({ ...formData, referralCode: e.target.value.toUpperCase() })}
                placeholder="Реферальный код (необязательно)"
                className="w-full mt-3 bg-black/40 border border-white/10 rounded px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-primary/80 transition-colors"
              />
              <input
                type="text"
                value={formData.telegramId}
                onChange={(e) => setFormData({ ...formData, telegramId: e.target.value })}
                placeholder="Telegram ID (для бота, необязательно)"
                className="w-full mt-2 bg-black/40 border border-white/10 rounded px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-primary/80 transition-colors"
              />
              {usernameError && (
                <p className="text-red-400 text-xs mt-1">{usernameError}</p>
              )}
              {checkingUsername && (
                <p className="text-yellow-400 text-xs mt-1">Проверка...</p>
              )}
            </div>

            <button
              onClick={handleNameSubmit}
              disabled={formData.name.trim().length < 2 || checkingUsername}
              className="w-full bg-primary text-black font-bold uppercase tracking-widest py-3 rounded hover:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Далее →
            </button>
          </motion.div>
        )}

        {/* === STEP 2: CITY === */}
        {step === "city" && (
          <motion.div
            key="city"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6 w-full max-w-md"
          >
            <button
              onClick={() => setStep("name")}
              className="flex items-center gap-2 text-white/50 hover:text-primary text-xs uppercase tracking-widest transition-colors"
            >
              <ChevronLeft size={14} /> Назад
            </button>

            <div className="text-center">
              <h2 className="text-2xl font-bold text-white uppercase tracking-widest">Выбери город</h2>
              <p className="text-white/40 mt-2 text-xs">Где ты хочешь строить карьеру?</p>
            </div>

            <div className="bg-white/5 border border-primary/20 rounded-lg p-6 backdrop-blur-md min-h-[240px] flex flex-col justify-between">
              <div className="text-center space-y-4">
                <div className="text-5xl">{CITIES[cityIndex].emoji}</div>
                <div>
                  <h3 className="text-xl font-bold text-white">{CITIES[cityIndex].name}</h3>
                  <div className="inline-block bg-primary/20 text-primary px-2 py-1 rounded text-xs font-mono mt-1">
                    {CITIES[cityIndex].currency}
                  </div>
                </div>
                <p className="text-white/60 text-sm">{CITIES[cityIndex].desc}</p>
              </div>

              <div className="flex gap-4 justify-center pt-4">
                <button
                  onClick={() => setCityIndex((prev) => (prev - 1 + CITIES.length) % CITIES.length)}
                  className="p-2 rounded border border-primary/30 text-primary hover:bg-primary/10 transition"
                >
                  <ChevronLeft size={20} />
                </button>
                <div className="flex gap-1">
                  {CITIES.map((_, i) => (
                    <div
                      key={i}
                      className={`h-2 rounded-full transition ${
                        i === cityIndex ? "bg-primary w-4" : "bg-white/20 w-2"
                      }`}
                    />
                  ))}
                </div>
                <button
                  onClick={() => setCityIndex((prev) => (prev + 1) % CITIES.length)}
                  className="p-2 rounded border border-primary/30 text-primary hover:bg-primary/10 transition"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>

            <button
              onClick={handleCitySelect}
              className="w-full bg-primary text-black font-bold uppercase tracking-widest py-3 rounded hover:bg-white transition-all"
            >
              Выбрать {CITIES[cityIndex].name}
            </button>
          </motion.div>
        )}

        {/* === STEP 3: PERSONALITY === */}
        {step === "personality" && (
          <motion.div
            key="personality"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6 w-full max-w-md"
          >
            <button
              onClick={() => setStep("city")}
              className="flex items-center gap-2 text-white/50 hover:text-primary text-xs uppercase tracking-widest transition-colors"
            >
              <ChevronLeft size={14} /> Назад
            </button>

            <div className="text-center">
              <h2 className="text-2xl font-bold text-white uppercase tracking-widest">Выбери характер</h2>
              <p className="text-white/40 mt-2 text-xs">Какой ты профессионал?</p>
            </div>

            <div className="bg-white/5 border border-primary/20 rounded-lg p-6 backdrop-blur-md min-h-[280px] flex flex-col justify-between">
              <div className="text-center space-y-4">
                <div className="text-6xl">{PERSONALITIES[personalityIndex].emoji}</div>
                <div>
                  <h3 className="text-xl font-bold text-white">{PERSONALITIES[personalityIndex].name}</h3>
                </div>
                <p className="text-white/60 text-sm">{PERSONALITIES[personalityIndex].desc}</p>
                <div className="bg-black/40 rounded p-3 text-left text-xs">
                  <p className="text-white/60 mb-2">Эффект характера:</p>
                  <div className="space-y-1">
                    {Object.entries(PERSONALITIES[personalityIndex].bonuses).map(([type, multiplier]) => {
                      let displayText = "";
                      if (type === "exp_multiplier") displayText = `Опыт: +${((multiplier - 1) * 100).toFixed(0)}%`;
                      else if (type === "money_multiplier") displayText = `Деньги: +${((multiplier - 1) * 100).toFixed(0)}%`;
                      else if (type === "stats_multiplier") displayText = `Характеристики: x${multiplier}`;
                      else if (type === "luck_multiplier") displayText = `Удача: +${((multiplier - 1) * 100).toFixed(0)}%`;
                      return <div key={type} className="text-primary">{displayText}</div>;
                    })}
                  </div>
                </div>
              </div>

              <div className="flex gap-4 justify-center pt-4">
                <button
                  onClick={() => setPersonalityIndex((prev) => (prev - 1 + PERSONALITIES.length) % PERSONALITIES.length)}
                  className="p-2 rounded border border-primary/30 text-primary hover:bg-primary/10 transition"
                >
                  <ChevronLeft size={20} />
                </button>
                <div className="flex gap-1">
                  {PERSONALITIES.map((_, i) => (
                    <div
                      key={i}
                      className={`h-2 rounded-full transition ${
                        i === personalityIndex ? "bg-primary w-4" : "bg-white/20 w-2"
                      }`}
                    />
                  ))}
                </div>
                <button
                  onClick={() => setPersonalityIndex((prev) => (prev + 1) % PERSONALITIES.length)}
                  className="p-2 rounded border border-primary/30 text-primary hover:bg-primary/10 transition"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>

            <button
              onClick={handlePersonalitySelect}
              className="w-full bg-primary text-black font-bold uppercase tracking-widest py-3 rounded hover:bg-white transition-all"
            >
              Начать как {PERSONALITIES[personalityIndex].name}
            </button>
          </motion.div>
        )}

        {/* === STEP 4: GENDER === */}
        {step === "gender" && (
          <motion.div
            key="gender"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6 w-full max-w-md"
          >
            <button
              onClick={() => setStep("personality")}
              className="flex items-center gap-2 text-white/50 hover:text-primary text-xs uppercase tracking-widest transition-colors"
            >
              <ChevronLeft size={14} /> Назад
            </button>

            <div className="text-center">
              <h2 className="text-2xl font-bold text-white uppercase tracking-widest">Выбери персонажа</h2>
              <p className="text-white/40 mt-2 text-xs">Какого пола будет твой персонаж?</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleGenderSelect("male")}
                disabled={isRegistering}
                className="bg-white/5 border-2 border-primary/20 rounded-lg p-6 backdrop-blur-md hover:border-primary/60 hover:bg-primary/10 transition space-y-4 disabled:opacity-50"
              >
                <div className="text-6xl">👨</div>
                <div>
                  <h3 className="text-lg font-bold text-white">Мужчина</h3>
                </div>
              </button>
              <button
                onClick={() => handleGenderSelect("female")}
                disabled={isRegistering}
                className="bg-white/5 border-2 border-primary/20 rounded-lg p-6 backdrop-blur-md hover:border-primary/60 hover:bg-primary/10 transition space-y-4 disabled:opacity-50"
              >
                <div className="text-6xl">👩</div>
                <div>
                  <h3 className="text-lg font-bold text-white">Женщина</h3>
                </div>
              </button>
            </div>

            {isRegistering && (
              <div className="text-center">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-white/60 text-xs uppercase">Создание персонажа...</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
