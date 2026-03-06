import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, TrendingUp, TrendingDown, X } from "lucide-react";

interface BankProduct {
  type: "credit" | "deposit";
  amount: number;
  daysLeft: number;
  totalDays: number;
  totalReturn: number;
  name: string;
}

interface BankProps {
  onBack: () => void;
  playerBalance: number;
  playerLevel: number;
  playerCity: string;
  onAddBalance: (amount: number) => void;
  activeBankProduct: BankProduct | null;
  onSetBankProduct: (product: BankProduct | null) => void;
}

export default function Bank({ onBack, playerBalance, playerLevel, playerCity, onAddBalance, activeBankProduct, onSetBankProduct }: BankProps) {
  const [selectedTab, setSelectedTab] = useState<"credits" | "deposits">(
    "credits"
  );
  const [selectedProgram, setSelectedProgram] = useState<number | null>(null);
  const [inputAmount, setInputAmount] = useState("");
  const [inputDays, setInputDays] = useState("");

  const getCurrencySymbol = () => {
    const citySymbols: Record<string, string> = {
      "Сан-Франциско": "$",
      "Сингапур": "S$",
      "Санкт-Петербург": "₽",
    };
    return citySymbols[playerCity] || "$";
  };

  const creditPrograms = [
    {
      name: "Стандартный кредит",
      minLevel: 1,
      minAmount: 10000,
      maxAmount: 100000,
      interest: 15,
      description: "Базовый кредит с минимальными требованиями",
    },
    {
      name: "Премиум кредит",
      minLevel: 10,
      minAmount: 50000,
      maxAmount: 500000,
      interest: 12,
      description: "Кредит с улучшенными условиями",
    },
    {
      name: "VIP кредит",
      minLevel: 25,
      minAmount: 200000,
      maxAmount: 2000000,
      interest: 10,
      description: "Эксклюзивный кредит для опытных игроков",
    },
  ];

  const depositPrograms = [
    {
      name: "Сберегательный вклад",
      minLevel: 1,
      minAmount: 1000,
      maxAmount: 100000,
      interest: 10,
      description: "Надежный вклад с гарантированным доходом",
    },
    {
      name: "Накопительный вклад",
      minLevel: 10,
      minAmount: 50000,
      maxAmount: 500000,
      interest: 12,
      description: "Вклад с повышенной процентной ставкой",
    },
    {
      name: "Премиум вклад",
      minLevel: 25,
      minAmount: 200000,
      maxAmount: 2000000,
      interest: 15,
      description: "Максимальный доход для крупных сумм",
    },
  ];

  const programs = selectedTab === "credits" ? creditPrograms : depositPrograms;
  const currency = getCurrencySymbol();

  const handleSelectProgram = (index: number) => {
    setSelectedProgram(index);
    setInputAmount("");
    setInputDays("");
  };

  const handleApplyProgram = (program: typeof creditPrograms[0]) => {
    const amount = parseInt(inputAmount);
    const days = parseInt(inputDays);

    if (!amount || !days) {
      alert("❌ Пожалуйста, заполните оба поля");
      return;
    }

    if (amount < program.minAmount || amount > program.maxAmount) {
      alert(`❌ Сумма должна быть от ${program.minAmount} до ${program.maxAmount}`);
      return;
    }

    if (days < 7 || days > 90) {
      alert("❌ Срок должен быть от 7 до 90 дней");
      return;
    }

    const totalReturn = Math.round(amount * (1 + (program.interest / 100) * (days / 365)));

    if (selectedTab === "credits") {
      // Кредит - добавляем деньги сейчас
      onAddBalance(amount);
      onSetBankProduct({
        type: "credit",
        amount,
        daysLeft: days,
        totalDays: days,
        totalReturn,
        name: program.name,
      });
      alert(
        `✓ Кредит одобрен!\n\nПолучено: ${currency}${amount}\nЧерез ${days} дней нужно вернуть: ${currency}${totalReturn}`
      );
    } else {
      // Вклад - вычитаем деньги сейчас
      if (playerBalance < amount) {
        alert("❌ Недостаточно средств");
        return;
      }
      onAddBalance(-amount);
      onSetBankProduct({
        type: "deposit",
        amount,
        daysLeft: days,
        totalDays: days,
        totalReturn,
        name: program.name,
      });
      alert(
        `✓ Вклад открыт!\n\nВнесено: ${currency}${amount}\nЧерез ${days} дней получите: ${currency}${totalReturn}`
      );
    }

    setSelectedProgram(null);
    setInputAmount("");
    setInputDays("");
  };

  const handleEarlyTermination = (action: "repay" | "withdraw") => {
    if (!activeBankProduct) return;

    const daysPassed = activeBankProduct.totalDays - Math.ceil(activeBankProduct.daysLeft);
    const daysPassedPercent = daysPassed / activeBankProduct.totalDays;

    if (action === "repay" && activeBankProduct.type === "credit") {
      // Для кредита: считаем проценты только за прошедшие дни
      const totalInterest = activeBankProduct.totalReturn - activeBankProduct.amount;
      const interestForPassed = Math.round(totalInterest * daysPassedPercent);
      const amountToRepay = activeBankProduct.amount + interestForPassed;

      if (playerBalance >= amountToRepay) {
        onAddBalance(-amountToRepay);
        onSetBankProduct(null);
        alert(
          `✓ Кредит погашен досрочно!\n\nПрошло дней: ${daysPassed}/${activeBankProduct.totalDays}\nПлачено: ${currency}${amountToRepay}\nЭкономия: ${currency}${activeBankProduct.totalReturn - amountToRepay}`
        );
      } else {
        alert(`❌ Недостаточно средств. Нужно: ${currency}${amountToRepay}`);
      }
    } else if (action === "withdraw" && activeBankProduct.type === "deposit") {
      // Для вклада: считаем проценты только за прошедшие дни
      const totalInterest = activeBankProduct.totalReturn - activeBankProduct.amount;
      const interestForPassed = Math.round(totalInterest * daysPassedPercent);
      const amountToReceive = activeBankProduct.amount + interestForPassed;

      onAddBalance(amountToReceive);
      onSetBankProduct(null);
      alert(
        `✓ Вклад снят досрочно!\n\nПрошло дней: ${daysPassed}/${activeBankProduct.totalDays}\nПолучено: ${currency}${amountToReceive}\nУтеряно процентов: ${currency}${activeBankProduct.totalReturn - amountToReceive}`
      );
    }
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
            Банк
          </h1>
        </div>

        {/* TABS */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setSelectedTab("credits")}
            className={`flex-1 py-2 rounded uppercase text-xs font-bold tracking-wider transition ${
              selectedTab === "credits"
                ? "bg-primary text-black"
                : "bg-white/10 text-white/60 hover:bg-white/20"
            }`}
          >
            <TrendingDown size={16} className="inline mr-1" /> Кредиты
          </button>
          <button
            onClick={() => setSelectedTab("deposits")}
            className={`flex-1 py-2 rounded uppercase text-xs font-bold tracking-wider transition ${
              selectedTab === "deposits"
                ? "bg-primary text-black"
                : "bg-white/10 text-white/60 hover:bg-white/20"
            }`}
          >
            <TrendingUp size={16} className="inline mr-1" /> Вклады
          </button>
        </div>

        {/* CONTENT */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-4"
        >
          {/* INFO CARD */}
          <div className="bg-white/5 border border-primary/20 rounded-lg p-4 text-center">
            <p className="text-xs text-white/60 uppercase mb-1">Ваш баланс</p>
            <p className="text-2xl font-bold text-primary">{currency}{playerBalance}</p>
            <p className="text-xs text-white/60 mt-2">Уровень: {playerLevel}</p>
          </div>

          {/* PROGRAMS LIST */}
          <div className="space-y-3">
            {programs.map((program, index) => (
              <motion.div
                key={index}
                whileHover={{ scale: 1.02 }}
                className={`border rounded-lg p-4 transition ${
                  playerLevel >= program.minLevel
                    ? "bg-white/5 border-primary/20 hover:border-primary/50"
                    : "bg-black/40 border-white/10 opacity-50"
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-bold text-white">{program.name}</h3>
                    <p className="text-xs text-white/60">{program.description}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-green-400">
                      {program.interest}%
                    </div>
                    <div className="text-[10px] text-white/60">годовых</div>
                  </div>
                </div>

                <div className="space-y-1 text-xs text-white/70 mb-3">
                  <div className="flex justify-between">
                    <span>Сумма:</span>
                    <span>{currency}{program.minAmount} - {currency}{program.maxAmount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Уровень:</span>
                    <span>{program.minLevel}+</span>
                  </div>
                </div>

                <button
                  onClick={() => handleSelectProgram(index)}
                  disabled={playerLevel < program.minLevel || activeBankProduct !== null}
                  className="w-full bg-primary/20 text-primary font-bold py-2 rounded uppercase text-xs tracking-wider hover:bg-primary/30 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {playerLevel < program.minLevel 
                    ? "Требуется выше уровень" 
                    : activeBankProduct !== null
                    ? "Погасите текущий"
                    : "Выбрать"}
                </button>
              </motion.div>
            ))}
          </div>

          {/* INFO */}
          <div className="bg-black/40 border border-white/10 rounded-lg p-3">
            <p className="text-[10px] text-white/60">
              💡 {selectedTab === "credits" 
                ? "Кредиты помогут получить деньги срочно, но их нужно будет вернуть с процентами."
                : "Вклады помогут вам получить пассивный доход. Чем больше сумма, тем выше процент."}
            </p>
          </div>

          {/* ACTIVE PRODUCT INFO */}
          {activeBankProduct && (
            <div className={`rounded-lg p-3 border space-y-3 ${
              activeBankProduct.type === "credit"
                ? "bg-red-500/10 border-red-500/30"
                : "bg-green-500/10 border-green-500/30"
            }`}>
              <div>
                <p className={`text-xs font-bold uppercase mb-1 ${
                  activeBankProduct.type === "credit"
                    ? "text-red-400"
                    : "text-green-400"
                }`}>
                  {activeBankProduct.type === "credit" ? "⚠️ Активный кредит" : "✓ Активный вклад"}
                </p>
                <p className="text-sm text-white font-bold mb-2">{activeBankProduct.name}</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-white/60">Сумма: </span>
                    <span className="text-white font-bold">{currency}{activeBankProduct.amount}</span>
                  </div>
                  <div>
                    <span className="text-white/60">Дней осталось: </span>
                    <span className="text-white font-bold">{Math.ceil(activeBankProduct.daysLeft)}</span>
                  </div>
                  <div>
                    <span className="text-white/60">К {activeBankProduct.type === "credit" ? "возврату" : "получению"}: </span>
                    <span className="text-white font-bold">{currency}{Math.round(activeBankProduct.totalReturn)}</span>
                  </div>
                </div>
              </div>

              {/* ACTION BUTTONS */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleEarlyTermination("repay")}
                  className={`text-xs font-bold py-2 rounded uppercase transition ${
                    activeBankProduct.type === "credit"
                      ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                      : "text-white/60 cursor-not-allowed opacity-50"
                  }`}
                  disabled={activeBankProduct.type !== "credit"}
                >
                  {activeBankProduct.type === "credit" ? "Погасить раньше" : "—"}
                </button>
                <button
                  onClick={() => handleEarlyTermination("withdraw")}
                  className={`text-xs font-bold py-2 rounded uppercase transition ${
                    activeBankProduct.type === "deposit"
                      ? "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                      : "text-white/60 cursor-not-allowed opacity-50"
                  }`}
                  disabled={activeBankProduct.type !== "deposit"}
                >
                  {activeBankProduct.type === "deposit" ? "Забрать раньше" : "—"}
                </button>
              </div>
            </div>
          )}
        </motion.div>

        {/* MODAL FOR PROGRAM SELECTION */}
        {selectedProgram !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-black/95 border border-primary/30 rounded-lg p-6 max-w-sm w-full"
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-white uppercase">
                  {programs[selectedProgram]?.name}
                </h2>
                <button
                  onClick={() => setSelectedProgram(null)}
                  className="text-white/50 hover:text-primary transition"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs text-white/60 uppercase block mb-2">
                    Сумма ({currency}{programs[selectedProgram]?.minAmount} - {currency}{programs[selectedProgram]?.maxAmount})
                  </label>
                  <input
                    type="number"
                    value={inputAmount}
                    onChange={(e) => setInputAmount(e.target.value)}
                    placeholder="Введите сумму"
                    className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-white placeholder-white/40 focus:border-primary outline-none transition"
                  />
                </div>

                <div>
                  <label className="text-xs text-white/60 uppercase block mb-2">
                    Срок (дни: 7-90)
                  </label>
                  <input
                    type="number"
                    value={inputDays}
                    onChange={(e) => setInputDays(e.target.value)}
                    placeholder="Введите количество дней"
                    className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-white placeholder-white/40 focus:border-primary outline-none transition"
                  />
                </div>

                {inputAmount && inputDays && (
                  <div className="bg-white/5 border border-primary/20 rounded p-3 text-sm">
                    <div className="text-white/60 mb-2">Расчёт:</div>
                    <div className="text-white font-bold">
                      {selectedTab === "credits"
                        ? `Получите: ${currency}${parseInt(inputAmount)}`
                        : `Положите: ${currency}${parseInt(inputAmount)}`}
                    </div>
                    <div className="text-green-400 font-bold mt-1">
                      К возврату: {currency}{Math.round(
                        parseInt(inputAmount) *
                          (1 +
                            (programs[selectedProgram]?.interest / 100) *
                            (parseInt(inputDays) / 365))
                      )}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setSelectedProgram(null)}
                    className="flex-1 bg-white/10 text-white font-bold py-2 rounded uppercase text-xs tracking-wider hover:bg-white/20 transition"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={() => handleApplyProgram(programs[selectedProgram]!)}
                    disabled={!inputAmount || !inputDays}
                    className="flex-1 bg-primary text-black font-bold py-2 rounded uppercase text-xs tracking-wider hover:bg-white transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Применить
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
