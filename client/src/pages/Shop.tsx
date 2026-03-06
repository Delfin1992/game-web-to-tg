import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ShoppingCart, Zap } from "lucide-react";

interface Item {
  id: string;
  name: string;
  price: number;
  stats: Record<string, number>;
  description: string;
  rarity: string;
  type: "consumable" | "gear";
}

interface ShopProps {
  onBack: () => void;
  playerBalance: number;
  onBuyItem: (item: Item) => void;
}

const ITEMS: Item[] = [
  // === КНИГИ И КУРСЫ (Consumables) ===
  {
    id: "coding-book",
    name: "Учебник по программированию",
    price: 100,
    stats: { coding: 1 },
    description: "Разовое использование: +1 Кодинг",
    rarity: "Common",
    type: "consumable",
  },
  {
    id: "testing-course",
    name: "Курс по тестированию",
    price: 100,
    stats: { testing: 1 },
    description: "Разовое использование: +1 Тестирование",
    rarity: "Common",
    type: "consumable",
  },
  {
    id: "analytics-book",
    name: "Книга по аналитике",
    price: 100,
    stats: { analytics: 1 },
    description: "Разовое использование: +1 Аналитика",
    rarity: "Common",
    type: "consumable",
  },
  {
    id: "drawing-album",
    name: "Альбом для рисования",
    price: 100,
    stats: { drawing: 1 },
    description: "Разовое использование: +1 Рисование",
    rarity: "Common",
    type: "consumable",
  },
  {
    id: "advanced-coding",
    name: "Продвинутый курс программирования",
    price: 500,
    stats: { coding: 3 },
    description: "Разовое использование: +3 Кодинг",
    rarity: "Rare",
    type: "consumable",
  },
  
  // === ГАДЖЕТЫ (Gear) ===
  {
    id: "gaming-keyboard",
    name: "🎮 Механическая клавиатура",
    price: 250,
    stats: { coding: 1, testing: 1 },
    description: "Экипировка: +1 Кодинг, +1 Тестирование",
    rarity: "Uncommon",
    type: "gear",
  },
  {
    id: "gaming-mouse",
    name: "🖱️ Программируемая мышь",
    price: 200,
    stats: { testing: 1, attention: 1 },
    description: "Экипировка: +1 Тестирование, +1 Внимание",
    rarity: "Uncommon",
    type: "gear",
  },
  {
    id: "monitor-uhd",
    name: "🖥️ 4K Монитор",
    price: 800,
    stats: { design: 2, drawing: 2 },
    description: "Экипировка: +2 Дизайн, +2 Рисование",
    rarity: "Rare",
    type: "gear",
  },
  {
    id: "headphones-pro",
    name: "🎧 Профессиональные наушники",
    price: 300,
    stats: { attention: 2, coding: 1 },
    description: "Экипировка: +2 Внимание, +1 Кодинг",
    rarity: "Uncommon",
    type: "gear",
  },
  {
    id: "laptop-pro",
    name: "💻 MacBook Pro",
    price: 2000,
    stats: { coding: 3, design: 2, testing: 1 },
    description: "Экипировка: +3 Кодинг, +2 Дизайн, +1 Тестирование",
    rarity: "Epic",
    type: "gear",
  },
];

const getRarityColor = (rarity: string) => {
  const colors: Record<string, string> = {
    Common: "text-white/60",
    Uncommon: "text-green-400",
    Rare: "text-blue-400",
    Epic: "text-purple-400",
    Legendary: "text-yellow-400",
  };
  return colors[rarity] || "text-white/60";
};

export default function Shop({ onBack, playerBalance, onBuyItem }: ShopProps) {
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [purchased, setPurchased] = useState(false);

  return (
    <div className="min-h-screen bg-black/95 backdrop-blur-md p-4 pb-24 font-body">
      <div className="max-w-md mx-auto">
        {/* HEADER */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-white/50 hover:text-primary text-xs uppercase tracking-widest transition-colors"
          >
            <ChevronLeft size={18} /> Назад
          </button>
          <h1 className="text-xl font-bold text-white uppercase tracking-widest">
            Магазин
          </h1>
          <div className="text-right">
            <p className="text-xs text-white/60 uppercase">Баланс</p>
            <p className="font-bold text-primary">${playerBalance}</p>
          </div>
        </div>

        {!selectedItem ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            {ITEMS.map((item) => (
              <motion.button
                key={item.id}
                onClick={() => setSelectedItem(item)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full text-left bg-white/5 border border-primary/20 rounded-lg p-4 hover:border-primary/50 hover:bg-white/10 transition"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-bold text-white">{item.name}</h3>
                    <p className={`text-xs ${getRarityColor(item.rarity)}`}>
                      {item.rarity}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-primary">${item.price}</div>
                    <div
                      className={`text-xs ${
                        playerBalance >= item.price
                          ? "text-green-400"
                          : "text-red-400"
                      }`}
                    >
                      {playerBalance >= item.price ? "✓" : "✗"}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-white/50 mb-2">{item.description}</p>
                <div className="flex gap-1">
                  {Object.entries(item.stats).map(([stat, value]) => (
                    <span
                      key={stat}
                      className="text-[10px] bg-primary/10 text-primary px-2 py-1 rounded"
                    >
                      +{value} {stat}
                    </span>
                  ))}
                </div>
              </motion.button>
            ))}
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <button
              onClick={() => setSelectedItem(null)}
              className="flex items-center gap-2 text-white/50 hover:text-primary text-xs uppercase tracking-widest transition-colors"
            >
              <ChevronLeft size={14} /> Вернуться
            </button>

            <div className="bg-white/5 border border-primary/20 rounded-lg p-6 space-y-4">
              <div>
                <p className={`text-xs mb-2 ${getRarityColor(selectedItem.rarity)}`}>
                  {selectedItem.rarity}
                </p>
                <h2 className="text-lg font-bold text-white uppercase tracking-widest">
                  {selectedItem.name}
                </h2>
              </div>

              <div className="bg-black/40 border border-white/10 rounded p-4">
                <p className="text-white/80 text-sm mb-4">{selectedItem.description}</p>

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-white/60">Цена:</span>
                    <span className="text-primary font-bold">${selectedItem.price}</span>
                  </div>

                  <div className="pt-3 border-t border-white/10">
                    <p className="text-xs text-white/60 mb-2">Эффекты:</p>
                    <div className="space-y-2">
                      {Object.entries(selectedItem.stats).map(([stat, value]) => (
                        <div key={stat} className="flex justify-between text-sm">
                          <span className="text-white/70 capitalize">{stat}</span>
                          <span className="text-green-400 font-bold">+{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {!purchased ? (
                <>
                  <button
                    disabled={playerBalance < selectedItem.price}
                    onClick={() => {
                      if (playerBalance >= selectedItem.price) {
                        onBuyItem(selectedItem);
                        setPurchased(true);
                        setTimeout(() => {
                          setPurchased(false);
                          setSelectedItem(null);
                        }, 1500);
                      }
                    }}
                    className="w-full bg-primary text-black font-bold py-3 rounded uppercase tracking-wider hover:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    data-testid="button-buy-item"
                  >
                    <ShoppingCart size={16} /> Купить за ${selectedItem.price}
                  </button>

                  {playerBalance < selectedItem.price && (
                    <p className="text-center text-xs text-red-400">
                      Недостаточно средств
                    </p>
                  )}
                </>
              ) : (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-green-500/20 border border-green-500/50 rounded-lg p-4 text-center"
                >
                  <p className="font-bold text-green-400">Куплено! ✓</p>
                  <p className="text-xs text-white/60 mt-1">
                    Предмет добавлен в инвентарь
                  </p>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
