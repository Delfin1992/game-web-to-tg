import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, Lock, RotateCcw, LogOut } from "lucide-react";

interface SettingsProps {
  onBack: () => void;
  onResetGame: () => void;
  isAdmin: boolean;
  setIsAdmin: (value: boolean) => void;
}

export default function Settings({
  onBack,
  onResetGame,
  isAdmin,
  setIsAdmin,
}: SettingsProps) {
  const [adminPassword, setAdminPassword] = useState("");
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const ADMIN_PASSWORD = "admin123"; // Простой пароль для демо

  const handleAdminLogin = () => {
    if (adminPassword === ADMIN_PASSWORD) {
      setIsAdmin(true);
      setShowPasswordInput(false);
      setAdminPassword("");
      setErrorMessage("");
    } else {
      setErrorMessage("Неправильный пароль!");
      setTimeout(() => setErrorMessage(""), 3000);
    }
  };

  const handleAdminLogout = () => {
    setIsAdmin(false);
    setShowPasswordInput(false);
    setAdminPassword("");
  };

  const handleResetConfirm = () => {
    onResetGame();
    setShowResetConfirm(false);
    setIsAdmin(false);
    onBack();
  };

  return (
    <div className="min-h-screen bg-black/95 backdrop-blur-md p-4 pb-24 font-body">
      <div className="max-w-md mx-auto">
        {/* HEADER */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-white/50 hover:text-primary text-xs uppercase tracking-widest transition-colors"
          >
            <ChevronLeft size={18} /> Назад
          </button>
          <h1 className="text-xl font-bold text-white uppercase tracking-widest flex-1">
            Настройки
          </h1>
        </div>

        {/* MAIN CONTENT */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-4"
        >
          {/* ADMIN STATUS CARD */}
          <div className="bg-white/5 border border-yellow-500/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Lock size={18} className="text-yellow-500" />
              <h2 className="text-sm font-bold text-white uppercase tracking-widest">
                Администратор
              </h2>
            </div>

            {!isAdmin ? (
              <div className="space-y-3">
                <p className="text-xs text-white/60">
                  Для доступа к админ-функциям введите пароль.
                </p>
                {!showPasswordInput ? (
                  <button
                    onClick={() => {
                      setShowPasswordInput(true);
                      setErrorMessage("");
                    }}
                    className="w-full bg-yellow-500/20 border border-yellow-500/40 text-yellow-500 font-bold py-2 rounded uppercase tracking-wider text-xs hover:bg-yellow-500/30 transition"
                  >
                    Войти как администратор
                  </button>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="password"
                      value={adminPassword}
                      onChange={(e) => {
                        setAdminPassword(e.target.value);
                        setErrorMessage("");
                      }}
                      onKeyPress={(e) =>
                        e.key === "Enter" && handleAdminLogin()
                      }
                      placeholder="Введите пароль..."
                      data-testid="input-admin-password"
                      className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-white placeholder:text-white/20 focus:outline-none focus:border-yellow-500/60 transition-colors text-sm"
                      autoFocus
                    />
                    {errorMessage && (
                      <p className="text-red-500 text-xs font-bold">
                        ❌ {errorMessage}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={handleAdminLogin}
                        className="flex-1 bg-yellow-500 text-black font-bold py-2 rounded uppercase tracking-wider text-xs hover:bg-yellow-400 transition"
                      >
                        Войти
                      </button>
                      <button
                        onClick={() => {
                          setShowPasswordInput(false);
                          setAdminPassword("");
                          setErrorMessage("");
                        }}
                        className="flex-1 bg-white/10 text-white font-bold py-2 rounded uppercase tracking-wider text-xs hover:bg-white/20 transition"
                      >
                        Отмена
                      </button>
                    </div>
                    <p className="text-[10px] text-white/40 text-center">
                      💡 Пароль для демо: admin123
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-2">
                  <p className="text-xs text-yellow-500 font-bold flex items-center gap-1">
                    ✓ Вы вошли как администратор
                  </p>
                </div>
                <button
                  onClick={handleAdminLogout}
                  className="w-full bg-white/10 border border-white/20 text-white font-bold py-2 rounded uppercase tracking-wider text-xs hover:bg-white/20 transition flex items-center justify-center gap-2"
                >
                  <LogOut size={14} /> Выйти из аккаунта администратора
                </button>
              </div>
            )}
          </div>

          {/* ADMIN FUNCTIONS */}
          {isAdmin && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="border-t border-white/10 pt-4">
                <h3 className="text-xs font-bold text-white uppercase tracking-widest mb-3">
                  Админ-функции
                </h3>

                {/* RESET GAME CARD */}
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <RotateCcw size={18} className="text-red-500" />
                    <h4 className="text-sm font-bold text-white uppercase tracking-widest">
                      Сброс регистрации
                    </h4>
                  </div>

                  {!showResetConfirm ? (
                    <div className="space-y-3">
                      <p className="text-xs text-white/60">
                        Удалить всю информацию о персонаже и начать регистрацию
                        заново. Это действие необратимо!
                      </p>
                      <button
                        onClick={() => setShowResetConfirm(true)}
                        data-testid="button-reset-game"
                        className="w-full bg-red-500/30 border border-red-500/60 text-red-500 font-bold py-2 rounded uppercase tracking-wider text-xs hover:bg-red-500/50 transition"
                      >
                        Сбросить регистрацию
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs text-white font-bold">
                        ⚠️ Вы уверены? Все данные будут удалены!
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={handleResetConfirm}
                          data-testid="button-confirm-reset"
                          className="flex-1 bg-red-600 text-white font-bold py-2 rounded uppercase tracking-wider text-xs hover:bg-red-700 transition"
                        >
                          Да, сбросить
                        </button>
                        <button
                          onClick={() => setShowResetConfirm(false)}
                          data-testid="button-cancel-reset"
                          className="flex-1 bg-white/10 text-white font-bold py-2 rounded uppercase tracking-wider text-xs hover:bg-white/20 transition"
                        >
                          Отмена
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* INFO CARD */}
          <div className="bg-white/5 border border-primary/20 rounded-lg p-4 text-center">
            <p className="text-xs text-white/60">
              Game Version: 1.0.0
            </p>
            <p className="text-[10px] text-white/40 mt-1">
              Programmer Idle Simulator
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
