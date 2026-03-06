// client/src/pages/AdminPanel.tsx
import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, Zap, DollarSign, Trash2 } from "lucide-react";

interface AdminPanelProps {
  onBack: () => void;
  playerLevel: number;
  playerBalance: number;
  playerName: string;
  onUpdateLevel: (newLevel: number) => void;
  onAddMoney: (amount: number) => void;
  onResetGame: () => void;  // ✅ Убедитесь что это есть
}

export default function AdminPanel({
  onBack,
  playerLevel,
  playerBalance,
  playerName,
  onUpdateLevel,
  onAddMoney,
  onResetGame,  // ✅ Добавить в деструктуризацию
}: AdminPanelProps) {
  const [newLevel, setNewLevel] = useState(playerLevel.toString());
  const [addAmount, setAddAmount] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const correctPassword = "admin123";

  const handleAuthenticate = () => {
    if (adminPassword === correctPassword) {
      setIsAuthenticated(true);
      setAdminPassword("");
    } else {
      alert("❌ Неверный пароль!");
      setAdminPassword("");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black text-white p-4 pb-24">
      {/* HEADER */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-white/50 hover:text-primary text-xs uppercase tracking-widest transition-colors"
      >
        <ChevronLeft size={18} /> Назад
      </button>

      <h2 className="text-xl font-bold text-white uppercase tracking-widest mb-4">Админ Панель</h2>

      {!isAuthenticated ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-center">
            <p className="text-xs text-red-400 uppercase">⚠️ Требуется аутентификация</p>
          </div>

          <div className="bg-white/5 border border-primary/20 rounded-lg p-6 space-y-4">
            <input
              type="password"
              placeholder="Введите пароль"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleAuthenticate()}
              className="w-full bg-black/40 border border-white/10 rounded px-4 py-3 text-white placeholder-white/40 focus:border-primary outline-none transition"
            />
            <button
              onClick={handleAuthenticate}
              className="w-full bg-primary text-black font-bold py-3 rounded uppercase tracking-wider hover:bg-white transition-all"
            >
              Подтвердить
            </button>
          </div>
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {/* INFO */}
          <div className="bg-white/5 border border-primary/20 rounded-lg p-4">
            <p className="text-xs text-white/60 uppercase mb-2">Персонаж</p>
            <p className="text-lg font-bold text-primary">{playerName}</p>
          </div>

          {/* LEVEL EDITOR */}
          <div className="bg-white/5 border border-primary/20 rounded-lg p-4 space-y-3">
            <h3 className="text-xs font-bold text-white uppercase flex items-center gap-2">
              <Zap size={14} /> Редактировать уровень
            </h3>
            <div className="space-y-2">
              <label className="text-xs text-white/60">Текущий уровень: {playerLevel}</label>
              <input
                type="number"
                value={newLevel}
                onChange={(e) => setNewLevel(e.target.value)}
                min="1"
                max="100"
                className="w-full bg-black/40 border border-white/10 rounded px-4 py-3 text-white focus:border-primary outline-none transition"
              />
            </div>
            <button
              onClick={() => {
                const level = parseInt(newLevel);
                if (level > 0 && level <= 100) {
                  onUpdateLevel(level);
                  alert(`✓ Уровень изменён на ${level}`);
                } else {
                  alert("❌ Уровень должен быть от 1 до 100");
                }
              }}
              className="w-full bg-blue-500 text-white font-bold py-2 rounded uppercase text-xs tracking-wider hover:bg-blue-600 transition"
            >
              Установить уровень
            </button>
          </div>

          {/* MONEY EDITOR */}
          <div className="bg-white/5 border border-primary/20 rounded-lg p-4 space-y-3">
            <h3 className="text-xs font-bold text-white uppercase flex items-center gap-2">
              <DollarSign size={14} /> Добавить деньги
            </h3>
            <div className="space-y-2">
              <label className="text-xs text-white/60">Текущий баланс: ${playerBalance}</label>
              <input
                type="number"
                value={addAmount}
                onChange={(e) => setAddAmount(e.target.value)}
                placeholder="Сумма"
                min="0"
                className="w-full bg-black/40 border border-white/10 rounded px-4 py-3 text-white placeholder-white/40 focus:border-primary outline-none transition"
              />
            </div>
            <button
              onClick={() => {
                const amount = parseInt(addAmount);
                if (amount > 0) {
                  onAddMoney(amount);
                  setAddAmount("");
                  alert(`✓ Добавлено ${amount} денег`);
                } else {
                  alert("❌ Введите положительное число");
                }
              }}
              className="w-full bg-green-500 text-white font-bold py-2 rounded uppercase text-xs tracking-wider hover:bg-green-600 transition"
            >
              Добавить
            </button>
          </div>

          {/* RESET PLAYER */}
          <div className="bg-white/5 border-red-500/20 rounded-lg p-4 space-y-3">
            <h3 className="text-xs font-bold text-red-400 uppercase flex items-center gap-2">
              <Trash2 size={14} /> Сброс данных
            </h3>
            <p className="text-[10px] text-white/40">
              Это действие полностью удалит данные персонажа и вернет вас на экран регистрации.
            </p>
            <div className="flex flex-col gap-2">
              {/* Сброс UI */}
              <button
                onClick={() => {
                  if (confirm("Вы уверены, что хотите полностью сбросить прогресс?")) {
                    onResetGame();  // ✅ Вызываем функцию
                  }
                }}
                className="w-full bg-red-600 text-white font-bold py-2 rounded uppercase text-xs tracking-wider hover:bg-red-700 transition"
              >
                Сбросить персонажа (UI)
              </button>

              {/* Полная очистка БД */}
              <button
                onClick={async () => {
                  if (confirm("⚠️ ВНИМАНИЕ: Это полностью очистит базу данных! Вы уверены?")) {
                    try {
                      const res = await fetch("/api/admin/reset-db", { method: "POST" });
                      if (res.ok) {
                        alert("✅ База данных успешно очищена!");
                        onResetGame();  // ✅ Сбрасываем UI после очистки БД
                      } else {
                        alert("❌ Ошибка при очистке БД");
                      }
                    } catch (e) {
                      console.error("Reset error:", e);
                      alert("❌ Ошибка сети");
                    }
                  }
                }}
                className="w-full bg-orange-600 text-white font-bold py-2 rounded uppercase text-xs tracking-wider hover:bg-orange-700 transition"
              >
                Полная очистка БД
              </button>
            </div>
          </div>

          {/* LOGOUT */}
          <button
            onClick={() => {
              setIsAuthenticated(false);
              setAdminPassword("");
            }}
            className="w-full bg-red-500/20 border border-red-500/30 text-red-400 font-bold py-3 rounded uppercase tracking-wider hover:bg-red-500/30 transition"
          >
            Выход
          </button>
        </motion.div>
      )}
    </div>
  );
}