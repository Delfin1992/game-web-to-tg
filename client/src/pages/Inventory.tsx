import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, Trash2, Check } from "lucide-react";

export interface InventoryItem {
  id: string;
  name: string;
  stats: Record<string, number>;
  rarity: string;
  quantity: number;
  type: "consumable" | "gear" | "part" | "gadget";
  isEquipped?: boolean;
  durability?: number;
  maxDurability?: number;
}

interface InventoryProps {
  onBack: () => void;
  items: InventoryItem[];
  onUseItem: (id: string) => void;
  onToggleGear: (id: string) => void;
  onServiceGadget: (id: string) => void;
}

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

export default function Inventory({ onBack, items, onUseItem, onToggleGear, onServiceGadget }: InventoryProps) {
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);

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
            Инвентарь
          </h1>
          <div className="text-right">
            <p className="text-xs text-white/60 uppercase">Предметов</p>
            <p className="font-bold text-primary">{items.length}</p>
          </div>
        </div>

        {!selectedItem ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-3"
          >
            {items.length === 0 ? (
              <div className="bg-white/5 border border-primary/20 rounded-lg p-8 text-center">
                <p className="text-white/60 text-sm">Инвентарь пуст</p>
                <p className="text-white/40 text-xs mt-2">
                  Купите предметы в магазине, чтобы они появились здесь
                </p>
              </div>
            ) : (
              items.map((item) => (
                <motion.button
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`w-full text-left bg-white/5 border rounded-lg p-4 transition ${
                    item.isEquipped ? "border-primary shadow-[0_0_10px_rgba(0,255,255,0.2)]" : "border-primary/20"
                  } hover:border-primary/50 hover:bg-white/10`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-white">{item.name}</h3>
                        {item.isEquipped && (
                          <span className="text-[10px] bg-primary text-black px-1.5 py-0.5 rounded font-bold uppercase">Надето</span>
                        )}
                      </div>
                      <p className={`text-xs ${getRarityColor(item.rarity)}`}>
                        {item.rarity} · {item.type === "consumable" ? "Расходник" : item.type === "gear" ? "Экипировка" : item.type === "part" ? "Запчасть" : "Гаджет"}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-primary">
                        x{item.quantity}
                      </div>
                    </div>
                  </div>
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
                  {item.type === "gadget" && (
                    <p className="text-[10px] text-white/60 mt-2">
                      Износ: {item.durability ?? 0}/{item.maxDurability ?? 100}
                    </p>
                  )}
                </motion.button>
              ))
            )}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            <button
              onClick={() => setSelectedItem(null)}
              className="flex items-center gap-2 text-white/50 hover:text-primary text-xs uppercase tracking-widest transition-colors"
            >
              <ChevronLeft size={14} /> Вернуться
            </button>

            <div className="bg-white/5 border border-primary/20 rounded-lg p-6 space-y-4">
              <div>
                <p className={`text-xs mb-2 ${getRarityColor(selectedItem.rarity)}`}>
                  {selectedItem.rarity} · {selectedItem.type === "consumable" ? "Расходник" : selectedItem.type === "gear" ? "Экипировка" : selectedItem.type === "part" ? "Запчасть" : "Гаджет"}
                </p>
                <h2 className="text-lg font-bold text-white uppercase tracking-widest">
                  {selectedItem.name}
                </h2>
                <p className="text-xs text-white/60 mt-1">
                  В инвентаре: x{selectedItem.quantity}
                </p>
              </div>

              <div className="bg-black/40 border border-white/10 rounded p-4">
                <p className="text-xs text-white/60 mb-3">
                  {selectedItem.type === "consumable" ? "Эффекты при использовании (навсегда):" : selectedItem.type === "gear" ? "Бонусы при экипировке:" : selectedItem.type === "part" ? "Технические характеристики детали:" : "Характеристики устройства:"}
                </p>
                <div className="space-y-2">
                  {Object.entries(selectedItem.stats).map(([stat, value]) => (
                    <div key={stat} className="flex justify-between text-sm">
                      <span className="text-white/70 capitalize">{stat}</span>
                      <span className="text-green-400 font-bold">+{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {selectedItem.type === "consumable" ? (
                <button
                  onClick={() => {
                    onUseItem(selectedItem.id);
                    setSelectedItem(null);
                  }}
                  className="w-full bg-primary text-black font-bold py-3 rounded uppercase tracking-wider hover:bg-white transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(0,255,255,0.3)]"
                >
                  <Check size={16} /> Использовать
                </button>
              ) : selectedItem.type === "gear" ? (
                <button
                  onClick={() => {
                    onToggleGear(selectedItem.id);
                    setSelectedItem(null);
                  }}
                  className={`w-full font-bold py-3 rounded uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                    selectedItem.isEquipped 
                      ? "bg-red-500/20 border border-red-500/50 text-red-400 hover:bg-red-500/30" 
                      : "bg-primary text-black hover:bg-white shadow-[0_0_15px_rgba(0,255,255,0.3)]"
                  }`}
                >
                  <Check size={16} /> {selectedItem.isEquipped ? "Снять" : "Надеть"}
                </button>
              ) : (
                selectedItem.type === "part" ? (
                  <div className="w-full bg-white/5 border border-white/10 text-white/60 font-bold py-3 rounded uppercase tracking-wider text-center">
                    Деталь используется при разработке в компании
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      onServiceGadget(selectedItem.id);
                      setSelectedItem(null);
                    }}
                    disabled={(selectedItem.durability ?? 0) >= (selectedItem.maxDurability ?? 100)}
                    className="w-full bg-primary text-black font-bold py-3 rounded uppercase tracking-wider hover:bg-white transition-all disabled:opacity-40"
                  >
                    Обслужить гаджет
                  </button>
                )
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
