// client/src/components/Company.tsx
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  Building2,
  Users,
  TrendingUp,
  Plus,
  Briefcase,
  Box,
  FileText,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { InventoryItem } from "./Inventory";
import { ALL_PARTS } from "@/lib/parts";
import { BLUEPRINT_STATUSES } from "@shared/gadgets";

interface Part {
  id: string;
  name: string;
  quality: "Обычное" | "Хорошее" | "Отличное" | "Премиум" | "Легендарное";
  quantity: number;
}

interface Project {
  id: string;
  name: string;
  description: string;
  progress: number;
  target: number;
  status: "active" | "completed";
  skillType: "coding" | "design" | "testing" | "management" | "analytics";
  activeDeveloperIds?: string[];
}

interface PlayerCompany {
  id: string;
  name: string;
  level: number;
  city?: string;
  experience: number;
  balance: number;
  role: "CEO" | "Employee";
  employees: {
    id: number;
    name: string;
    role: string;
    salary: number;
    earned?: number;
    devTime?: number;
  }[];
  deputy?: string;
  salaries?: {
    ceo: number;
    deputy: number;
    regular: number;
  };
  joinRequests?: { playerId: string; playerName: string; playerLevel: number }[];
  warehouse: Part[];
  projects: Project[];
  activeProjectId?: string | null;
  warehouseCapacity?: number;
}

interface CompanyProps {
  onBack: () => void;
  playerLevel: number;
  playerCity: string;
  playerBalance: number;
  playerName: string;
  onCreateCompany: (name: string, cost: number) => void;
  playerCompany?: PlayerCompany | null;
  onUpdateCompany?: (update: Partial<PlayerCompany>) => void;
  onUpdatePlayerBalance?: (amount: number) => void;
  playerSkills?: Record<string, number>;
  currentPlayerId?: string;
  playerInventory?: InventoryItem[];
  onConsumeInventoryParts?: (partIds: string[]) => void;
}

interface CityContract {
  id: string;
  title: string;
  customer: string;
  category: string;
  requiredQuantity: number;
  minQuality: number;
  rewardMoney: number;
  rewardOrk: number;
  status: "open" | "in_progress" | "completed";
  assignedCompanyId?: string;
  expiresAt: number;
}

const SPARE_PARTS = [
  { name: "ASIC чип", qualities: ["Обычное", "Хорошее", "Отличное", "Премиум", "Легендарное"] },
  { name: "Система охлаждения", qualities: ["Обычное", "Хорошее", "Отличное", "Премиум", "Легендарное"] },
  { name: "Блок питания", qualities: ["Обычное", "Хорошее", "Отличное", "Премиум", "Легендарное"] },
  { name: "Контроллер управления", qualities: ["Обычное", "Хорошее", "Отличное", "Премиум", "Легендарное"] },
  { name: "Материнская плата", qualities: ["Обычное", "Хорошее", "Отличное", "Премиум", "Легендарное"] },
  { name: "Корпус", qualities: ["Обычное", "Хорошее", "Отличное", "Премиум", "Легендарное"] },
  { name: "Процессор", qualities: ["Обычное", "Хорошее", "Отличное", "Премиум", "Легендарное"] },
  { name: "Оперативная память", qualities: ["Обычное", "Хорошее", "Отличное", "Премиум", "Легендарное"] },
  { name: "Дисплей", qualities: ["Обычное", "Хорошее", "Отличное", "Премиум", "Легендарное"] },
  { name: "Батарея", qualities: ["Обычное", "Хорошее", "Отличное", "Премиум", "Легендарное"] },
  { name: "Хранилище", qualities: ["Обычное", "Хорошее", "Отличное", "Премиум", "Легендарное"] },
  { name: "Камера", qualities: ["Обычное", "Хорошее", "Отличное", "Премиум", "Легендарное"] },
  { name: "Ремешок", qualities: ["Обычное", "Хорошее", "Отличное", "Премиум", "Легендарное"] },
];

const GADGET_PROJECTS: Omit<Project, "id" | "progress" | "status">[] = [
  { name: "ASIC майнер Pro", description: "Высокопроизводительный ASIC майнер с продвинутыми микросхемами.", target: 2500, skillType: "coding" },
  { name: "Смартфон Ultra", description: "Флагманский смартфон с процессором S4 и поддержкой 5G.", target: 3000, skillType: "coding" },
  { name: "Смарт часы Elite", description: "Продвинутые смарт часы с AMOLED дисплеем и GPS.", target: 1200, skillType: "design" },
  { name: "Планшет Studio", description: "Профессиональный планшет для творчества и работы.", target: 2000, skillType: "design" },
  { name: "Ноутбук Beast", description: "Мощный ноутбук для разработки с процессором L3 и SSD хранилищем.", target: 3500, skillType: "coding" },
];

const COMPANY_CREATION_COST = 1000;

export default function Company({
  onBack,
  playerLevel,
  playerCity,
  playerBalance,
  playerName,
  onCreateCompany,
  playerCompany,
  onUpdateCompany,
  onUpdatePlayerBalance,
  playerSkills,
  currentPlayerId,
  playerInventory = [],
  onConsumeInventoryParts,
}: CompanyProps) {
  const [activeTab, setActiveTab] = useState<"dashboard" | "work" | "warehouse" | "bureau" | "management" | "blueprints">("dashboard");
  const [managementSubTab, setManagementSubTab] = useState<"employees" | "salaries" | "requests">("employees");
  const [selectedDeputy, setSelectedDeputy] = useState<string | null>(null);
  const [salarySettings, setSalarySettings] = useState({ ceo: 1000, deputy: 800, regular: 500 });
  const [workStatus, setWorkStatus] = useState<"idle" | "working" | "success" | "failure">("idle");
  const [lastReward, setLastReward] = useState<{ money: number; part?: Part } | null>(null);
  const [listingPrice, setListingPrice] = useState<number>(0);
  const [listingMode, setListingMode] = useState<"fixed" | "auction">("fixed");
  const [auctionHours, setAuctionHours] = useState<number>(2);
  const [showCreate, setShowCreate] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [selectedCompany, setSelectedCompany] = useState<any>(null);

  const companyRef = useRef(playerCompany);
  const skillsRef = useRef(playerSkills);
  const playerNameRef = useRef(playerName);
  const onUpdateRef = useRef(onUpdateCompany);

  useEffect(() => {
    companyRef.current = playerCompany;
    skillsRef.current = playerSkills;
    playerNameRef.current = playerName;
    onUpdateRef.current = onUpdateCompany;
  }, [playerCompany, playerSkills, playerName, onUpdateCompany]);

  useEffect(() => {
    if (!currentPlayerId) {
      console.warn("⚠️ currentPlayerId не передан в Company!");
    }
  }, [currentPlayerId]);

  const getEstimatedTime = (project: Project | undefined) => {
    if (!project?.activeDeveloperIds?.length || !playerSkills) return 0;
    let totalSkill = 0;
    project.activeDeveloperIds.forEach(() => {
      const skillValue = (playerSkills as any)[project.skillType] || 1;
      totalSkill += Math.max(1, Math.floor(skillValue * 0.1));
    });
    if (totalSkill === 0) return 0;
    return Math.ceil((project.target - project.progress) / totalSkill);
  };

  // Разработка проекта
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (playerCompany?.activeProjectId && playerSkills && playerCompany?.projects) {
      const activeProject = playerCompany.projects.find((p) => p.id === playerCompany.activeProjectId);
      if (activeProject?.activeDeveloperIds?.length && activeProject.status !== "completed") {
        interval = setInterval(() => {
          const latest = companyRef.current;
          const skills = skillsRef.current;
          if (!latest?.projects || !latest?.activeProjectId) return;

          const proj = latest.projects.find((p) => p.id === latest.activeProjectId);
          if (!proj || proj.status === "completed") return;

          let totalContribution = 0;
          (proj.activeDeveloperIds || []).forEach(() => {
            const skillValue = (skills as any)[proj.skillType] || 1;
            totalContribution += Math.max(1, Math.floor(skillValue * 0.1));
          });

          if (latest.level >= 10) totalContribution = Math.floor(totalContribution * 1.25);
          else if (latest.level >= 8) totalContribution = Math.floor(totalContribution * 1.2);
          else if (latest.level >= 5) totalContribution = Math.floor(totalContribution * 1.1);
          else if (latest.level >= 3) totalContribution = Math.floor(totalContribution * 1.05);

          if (totalContribution === 0) return;

          const newProjects = latest.projects.map((p) => {
            if (p.id === latest.activeProjectId) {
              const newProgress = Math.min(p.progress + totalContribution, p.target);
              return {
                ...p,
                progress: newProgress,
                status: (newProgress >= p.target ? "completed" : "active") as any,
              };
            }
            return p;
          });

          onUpdateRef.current?.({
            projects: newProjects,
            experience: (latest.experience || 0) + 1,
          });
        }, 5000);
      }
    }
    return () => clearInterval(interval);
  }, [playerCompany?.activeProjectId]);

  // Загрузка компаний из API
  const { data: cityCompanies = [] } = useQuery<any[]>({
    queryKey: ["/api/companies"],
    refetchInterval: 5000,
  });

  const joinMutation = useMutation({
    mutationFn: async (companyId: string) => {
      await apiRequest("POST", `/api/companies/${companyId}/join`, {
        userId: currentPlayerId,      // ✅ UUID из БД
        username: playerName,
        playerLevel: playerLevel || 1,
      });
    },
    onSuccess: () => {
      alert("Заявка отправлена!");
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
    },
  });

  const respondMutation = useMutation({
    mutationFn: async ({ requestId, status, companyId, userId, username }: any) => {
      await apiRequest("POST", `/api/companies/requests/${requestId}/respond`, {
        status,
        companyId,
        userId,
        username,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/companies", playerCompany?.id, "requests"] });
    },
  });


  const { data: blueprintData, refetch: refetchBlueprints } = useQuery<any>({
    queryKey: ["/api/companies", playerCompany?.id, "blueprints"],
    enabled: !!playerCompany?.id,
    queryFn: async () => {
      const r = await fetch(`/api/companies/${playerCompany?.id}/blueprints`);
      return r.json();
    },
  });

  const { data: cityContracts = [], refetch: refetchCityContracts } = useQuery<CityContract[]>({
    queryKey: ["/api/city-contracts", playerCompany?.city],
    enabled: !!playerCompany?.city,
    queryFn: async () => {
      const cityName = playerCompany?.city ?? playerCity;
      const r = await fetch(`/api/city-contracts/${encodeURIComponent(cityName)}`);
      return r.json();
    },
    refetchInterval: 10000,
  });

  const startBlueprint = useMutation({
    mutationFn: async (blueprintId: string) => {
      await apiRequest("POST", `/api/companies/${playerCompany?.id}/blueprints/start`, { userId: currentPlayerId, blueprintId });
    },
    onSuccess: () => refetchBlueprints(),
  });

  const progressBlueprint = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/companies/${playerCompany?.id}/blueprints/progress`, { userId: currentPlayerId, hours: 24 });
    },
    onSuccess: () => {
      refetchBlueprints();
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
    },
  });

  const produceGadget = useMutation({
    mutationFn: async () => {
      if (!blueprintData?.active?.blueprintId) throw new Error("No active blueprint");
      const bp = blueprintData.available.find((b: any) => b.id === blueprintData.active.blueprintId);
      if (!bp) throw new Error("Blueprint not found");

      const used: InventoryItem[] = [];
      Object.entries(bp.production.parts).forEach(([partType, qty]) => {
        const candidates = playerInventory.filter((item) => item.type === "part" && ALL_PARTS[item.id]?.type === partType).slice(0, Number(qty));
        used.push(...candidates);
      });

      const required = Object.values(bp.production.parts).reduce((a: number, b: any) => a + Number(b), 0);
      if (used.length < required) throw new Error("Недостаточно деталей в инвентаре");

      const payloadParts = used.map((item) => ({ id: item.id, type: ALL_PARTS[item.id]?.type, rarity: item.rarity }));
      const r = await apiRequest("POST", `/api/companies/${playerCompany?.id}/produce`, { userId: currentPlayerId, parts: payloadParts });
      onConsumeInventoryParts?.(used.map((u) => u.id));
      return r.json();
    },
    onSuccess: () => refetchBlueprints(),
    onError: (e: any) => alert(e?.message || "Не удалось произвести гаджет"),
  });

  const createListing = useMutation({
    mutationFn: async (gadgetId: string) => {
      await apiRequest("POST", `/api/companies/${playerCompany?.id}/market/list`, {
        userId: currentPlayerId,
        gadgetId,
        price: listingPrice,
        mode: listingMode,
        durationHours: auctionHours,
      });
    },
    onSuccess: () => {
      alert("Лот выставлен на маркет");
      queryClient.invalidateQueries({ queryKey: ["/api/market"] });
    },
    onError: (e: any) => alert(e?.message || "Не удалось создать лот"),
  });

  const acceptContract = useMutation({
    mutationFn: async (contractId: string) => {
      await apiRequest("POST", `/api/city-contracts/${contractId}/accept`, {
        userId: currentPlayerId,
        companyId: playerCompany?.id,
      });
    },
    onSuccess: () => refetchCityContracts(),
    onError: (e: any) => alert(e?.message || "Не удалось принять контракт"),
  });

  const deliverContract = useMutation({
    mutationFn: async (contractId: string) => {
      await apiRequest("POST", `/api/city-contracts/${contractId}/deliver`, {
        userId: currentPlayerId,
        companyId: playerCompany?.id,
      });
    },
    onSuccess: () => {
      refetchCityContracts();
      refetchBlueprints();
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      alert("Контракт успешно выполнен");
    },
    onError: (e: any) => alert(e?.message || "Не удалось сдать контракт"),
  });

  const { data: joinRequests = [] } = useQuery<any[]>({
    queryKey: ["/api/companies", playerCompany?.id, "requests"],
    enabled: !!playerCompany && playerCompany.role === "CEO",
    refetchInterval: 5000,
  });

  const currency = {
    symbol: playerCity === "Сеул" ? "₩" : playerCity === "Санкт-Петербург" ? "₽" : "$",
    name: "",
  };

  const getBonusMultiplier = () => {
    if (!playerCompany) return 1;
    const level = playerCompany.level;
    if (level >= 10) return 1.5;
    if (level >= 9) return 1.4;
    if (level >= 8) return 1.35;
    if (level >= 7) return 1.3;
    if (level >= 6) return 1.25;
    if (level >= 5) return 1.2;
    if (level >= 4) return 1.15;
    if (level >= 3) return 1.1;
    if (level >= 2) return 1.05;
    return 1;
  };

  const handleWork = () => {
    setWorkStatus("working");
    setTimeout(() => {
      const isSuccess = Math.random() > 0.2;
      if (isSuccess) {
        const baseSalary = 5000;
        const multiplier = getBonusMultiplier();
        let salary = Math.floor(baseSalary * multiplier);

        const partIndex = Math.floor(Math.random() * SPARE_PARTS.length);
        const qualityRoll = Math.random();
        let quality: Part["quality"] = "Обычное";
        if (qualityRoll > 0.95) quality = "Легендарное";
        else if (qualityRoll > 0.85) quality = "Премиум";
        else if (qualityRoll > 0.7) quality = "Отличное";
        else if (qualityRoll > 0.4) quality = "Хорошее";

        const newPart: Part = {
          id: `part-${Date.now()}`,
          name: SPARE_PARTS[partIndex].name,
          quality: quality,
          quantity: 1,
        };

        setLastReward({ money: salary, part: newPart });
        setWorkStatus("success");

        if (onUpdateCompany && playerCompany) {
          const existingPartIndex = playerCompany.warehouse.findIndex(
            (p) => p.name === newPart.name && p.quality === quality
          );
          let newWarehouse = [...playerCompany.warehouse];
          if (existingPartIndex >= 0) {
            newWarehouse[existingPartIndex].quantity += 1;
          } else {
            newWarehouse.push(newPart);
          }
          onUpdateCompany({
            experience: (playerCompany.experience || 0) + 50,
            balance: playerCompany.balance + salary,
            warehouse: newWarehouse,
          });
        }
      } else {
        setWorkStatus("failure");
      }
    }, 2000);
  };

  const startDevelopment = (projectId: string) => {
    if (!playerCompany || !onUpdateCompany) return;
    const project = playerCompany.projects.find((p) => p.id === projectId);
    if (!project) return;
    const playerDevId = playerName.replace(/\s+/g, "_");
    if ((project.activeDeveloperIds || []).includes(playerDevId)) return;

    const newProjects = playerCompany.projects.map((p) => {
      if (p.id === projectId) {
        return {
          ...p,
          activeDeveloperIds: [...(p.activeDeveloperIds || []), playerDevId],
        };
      }
      return p;
    });

    onUpdateCompany({
      projects: newProjects,
      activeProjectId: projectId,
    });
  };

  const stopDevelopment = (projectId: string) => {
    if (!playerCompany || !onUpdateCompany) return;
    const playerDevId = playerName.replace(/\s+/g, "_");
    const newProjects = playerCompany.projects.map((p) => {
      if (p.id === projectId) {
        return {
          ...p,
          activeDeveloperIds: (p.activeDeveloperIds || []).filter((id) => id !== playerDevId),
        };
      }
      return p;
    });
    onUpdateCompany({ projects: newProjects });
  };

  const selectActiveProject = (projectId: string) => {
    if (playerCompany?.role !== "CEO" || !onUpdateCompany) return;
    onUpdateCompany({ activeProjectId: projectId });
  };

  const upgradeCompany = async () => {
    if (!playerCompany) return;
    try {
      const response = await fetch(`/api/company/${playerCompany.id}/upgrade`, { method: "POST" });
      if (!response.ok) {
        const error = await response.text();
        alert(`Ошибка: ${error}`);
        return;
      }
      const updated = await response.json();
      if (onUpdateCompany) onUpdateCompany(updated);
      alert("Уровень компании повышен!");
    } catch (e) {
      alert("Ошибка при повышении уровня");
    }
  };

  const expandWarehouse = async () => {
    if (!playerCompany) return;
    try {
      const response = await fetch(`/api/company/${playerCompany.id}/expand-warehouse`, { method: "POST" });
      if (!response.ok) {
        const error = await response.text();
        alert(`Ошибка: ${error}`);
        return;
      }
      const updated = await response.json();
      if (onUpdateCompany) onUpdateCompany(updated);
      alert("Склад расширен до 100 мест!");
    } catch (e) {
      alert("Ошибка при расширении склада");
    }
  };

    const createCompany = async () => {
      if (!companyName.trim() || !currentPlayerId) {
        alert("Ошибка: playerId не найден!");  // ✅ Добавить проверку
        return;
      }
    try {
      const response = await fetch("/api/company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: companyName,
          ownerId: currentPlayerId,  // ✅ UUID из БД
          username: playerName,
          city: playerCity,
        }),
      });
      if (!response.ok) {
        const error = await response.text();
        alert(`Ошибка: ${error}`);
        return;
      }
      const company = await response.json();
      onUpdateCompany?.({
        id: company.id,
        name: company.name,
        level: company.level,
        experience: company.experience,
        balance: company.balance,
        role: "CEO",
        employees: [{ id: 1, name: playerName, role: "CEO", salary: 0 }],
        warehouse: company.warehouse || [],
        projects: [],
        warehouseCapacity: company.warehouseCapacity,
      });
      setCompanyName("");
      setShowCreate(false);
      setActiveTab("dashboard");
    } catch (e) {
      alert("Ошибка при создании компании");
    }
  };

  const leaveCompany = async () => {
    if (!playerCompany || !currentPlayerId) return;
    try {
      const response = await fetch(`/api/companies/${playerCompany.id}/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentPlayerId }),
      });
      if (!response.ok) {
        alert("Ошибка при выходе из компании");
        return;
      }
      onUpdateCompany?.({} as Partial<PlayerCompany>);
      alert("Вы покинули компанию");
    } catch (e) {
      alert("Ошибка при выходе из компании");
    }
  };

  if (playerCompany) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black text-white p-4 pb-24">
        <button
          onClick={activeTab === "dashboard" ? onBack : () => setActiveTab("dashboard")}
          className="flex items-center gap-2 text-white/50 hover:text-primary text-xs uppercase tracking-widest transition-colors"
        >
          <ChevronLeft size={18} /> {activeTab === "dashboard" ? "Назад" : "В меню"}
        </button>

        <h2 className="text-xl font-bold text-white uppercase tracking-widest mb-4">
          {activeTab === "dashboard"
            ? "Управление"
            : activeTab === "work"
            ? "Работа"
            : activeTab === "warehouse"
            ? "Склад"
            : activeTab === "bureau"
            ? "Проектное бюро"
            : activeTab === "blueprints"
            ? "Чертежи и производство"
            : "Управление компанией"}
        </h2>

        <AnimatePresence mode="wait">
          {activeTab === "dashboard" && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 rounded-2xl p-6 text-center">
                <Building2 className="text-primary mx-auto mb-3" size={40} />
                <h2 className="text-2xl font-bold text-white uppercase tracking-widest">{playerCompany.name}</h2>
                <p className="text-xs text-primary/60 mt-1 uppercase">
                  Level {playerCompany.level} · {playerCompany.role}
                </p>

                <div className="mt-4 flex flex-col gap-2">
                  <div className="flex justify-between text-[10px] uppercase text-white/40 px-1">
                    <span>Очки роста (ОРК)</span>
                    <span className="text-primary">
                      {playerCompany.experience} /{" "}
                      {playerCompany.level === 1
                        ? 100
                        : playerCompany.level === 2
                        ? 250
                        : playerCompany.level === 3
                        ? 450
                        : playerCompany.level === 4
                        ? 700
                        : playerCompany.level === 5
                        ? 1000
                        : playerCompany.level === 6
                        ? 1400
                        : playerCompany.level === 7
                        ? 1900
                        : playerCompany.level === 8
                        ? 2500
                        : playerCompany.level === 9
                        ? 3200
                        : 4000}
                    </span>
                  </div>
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-500"
                      style={{
                        width: `${Math.min(
                          100,
                          (playerCompany.experience /
                            (playerCompany.level === 1
                              ? 100
                              : playerCompany.level === 2
                              ? 250
                              : playerCompany.level === 3
                              ? 450
                              : playerCompany.level === 4
                              ? 700
                              : playerCompany.level === 5
                              ? 1000
                              : playerCompany.level === 6
                              ? 1400
                              : playerCompany.level === 7
                              ? 1900
                              : playerCompany.level === 8
                              ? 2500
                              : playerCompany.level === 9
                              ? 3200
                              : 4000)) *
                            100
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-6">
                  <div className="bg-black/40 rounded-xl p-3 border border-white/5">
                    <p className="text-[10px] text-white/40 uppercase">Баланс фирмы</p>
                    <p className="text-lg font-bold text-primary">
                      {currency.symbol}
                      {playerCompany.balance.toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-black/40 rounded-xl p-3 border border-white/5">
                    <p className="text-[10px] text-white/40 uppercase">Склад</p>
                    <p className="text-lg font-bold text-white">
                      {playerCompany.warehouseCapacity || 50} мест
                    </p>
                  </div>
                </div>

                {playerCompany.role === "CEO" && (
                  <div className="mt-6 flex flex-col gap-2">
                    {playerCompany.level === 1 && (Number(playerCompany.warehouseCapacity) || 50) < 100 && (
                      <button
                        onClick={expandWarehouse}
                        className="w-full py-2 bg-primary/20 border border-primary/50 rounded-xl text-[10px] font-bold text-primary uppercase hover:bg-primary/30 transition"
                      >
                        Расширить склад (1 000 {currency.symbol})
                      </button>
                    )}
                    <button
                      onClick={upgradeCompany}
                      className="w-full py-3 bg-primary text-black rounded-xl text-xs font-bold uppercase hover:bg-primary/90 transition shadow-[0_0_20px_rgba(0,255,255,0.3)]"
                    >
                      Повысить уровень компании
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-4 gap-2">
                <button
                  onClick={() => setActiveTab("work")}
                  className="bg-white/5 border border-white/10 rounded-xl p-3 hover:bg-white/10 transition text-center group"
                >
                  <Briefcase className="text-primary mx-auto mb-1 group-hover:scale-110 transition" size={20} />
                  <p className="text-[8px] font-bold text-white uppercase">Работа</p>
                </button>
                <button
                  onClick={() => setActiveTab("warehouse")}
                  className="bg-white/5 border border-white/10 rounded-xl p-3 hover:bg-white/10 transition text-center group"
                >
                  <Box className="text-primary mx-auto mb-1 group-hover:scale-110 transition" size={20} />
                  <p className="text-[8px] font-bold text-white uppercase">Склад</p>
                </button>
                <button
                  onClick={() => setActiveTab("bureau")}
                  className="bg-white/5 border border-white/10 rounded-xl p-3 hover:bg-white/10 transition text-center group"
                >
                  <FileText className="text-primary mx-auto mb-1 group-hover:scale-110 transition" size={20} />
                  <p className="text-[8px] font-bold text-white uppercase">Бюро</p>
                </button>
                {(playerCompany.role === "CEO" || playerCompany.deputy === playerName) && (
                  <button
                    onClick={() => setActiveTab("management")}
                    className="bg-white/5 border border-white/10 rounded-xl p-3 hover:bg-white/10 transition text-center group"
                  >
                    <Users className="text-primary mx-auto mb-1 group-hover:scale-110 transition" size={20} />
                    <p className="text-[8px] font-bold text-white uppercase">Управ.</p>
                  </button>
                )}
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-bold text-white/60 uppercase px-1">Штат сотрудников</h3>
                <div className="space-y-2">
                  {playerCompany.employees.map((emp) => (
                    <div
                      key={emp.id}
                      className="bg-white/5 border border-white/10 rounded-xl p-4 flex justify-between items-center"
                    >
                      <div>
                        <p className="text-sm font-bold text-white">{emp.name}</p>
                        <p className="text-[10px] text-white/40 uppercase">{emp.role}</p>
                      </div>
                      <p className="text-xs font-bold text-primary">
                        {currency.symbol}
                        {emp.salary}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={leaveCompany}
                className="w-full py-3 bg-red-500/20 border border-red-500/50 rounded-xl text-xs font-bold text-red-400 uppercase hover:bg-red-500/30 transition"
              >
                Покинуть компанию
              </button>
            </motion.div>
          )}

          {activeTab === "work" && (
            <motion.div
              key="work"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center space-y-6">
                {workStatus === "idle" && (
                  <>
                    <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                      <Briefcase size={40} className="text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white uppercase">Рабочая смена</h3>
                      <p className="text-sm text-white/60 mt-2">
                        Выполняйте задания компании, чтобы зарабатывать деньги и добывать детали для склада.
                      </p>
                    </div>
                    <button
                      onClick={handleWork}
                      className="w-full bg-primary text-black font-bold py-4 rounded-xl uppercase tracking-widest hover:bg-white transition"
                    >
                      Начать работу
                    </button>
                  </>
                )}
                {workStatus === "working" && (
                  <div className="py-12 space-y-6">
                    <div className="relative w-24 h-24 mx-auto">
                      <motion.div
                        className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Briefcase size={32} className="text-primary" />
                      </div>
                    </div>
                    <p className="text-primary font-mono animate-pulse uppercase tracking-widest">Выполнение задач...</p>
                  </div>
                )}
                {(workStatus === "success" || workStatus === "failure") && (
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="space-y-6"
                  >
                    {workStatus === "success" ? (
                      <>
                        <CheckCircle2 size={60} className="text-green-500 mx-auto" />
                        <div>
                          <h3 className="text-xl font-bold text-white uppercase">Успех!</h3>
                          <p className="text-sm text-white/60 mt-2">Задание выполнено безупречно.</p>
                        </div>
                        <div className="bg-black/40 border border-white/10 rounded-xl p-4 space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-white/60 text-xs">Награда:</span>
                            <span className="text-primary font-bold">
                              +{currency.symbol}
                              {lastReward?.money}
                            </span>
                          </div>
                          {lastReward?.part && (
                            <div className="flex justify-between items-center">
                              <span className="text-white/60 text-xs">Деталь:</span>
                              <span className="text-blue-400 font-bold">
                                {lastReward.part.name} ({lastReward.part.quality})
                              </span>
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <XCircle size={60} className="text-red-500 mx-auto" />
                        <h3 className="text-xl font-bold text-white uppercase">Ошибка</h3>
                        <p className="text-sm text-white/60 mt-2">Что-то пошло не так.</p>
                      </>
                    )}
                    <button
                      onClick={() => setWorkStatus("idle")}
                      className="w-full bg-white/10 border border-white/10 text-white font-bold py-4 rounded-xl uppercase hover:bg-white/20 transition"
                    >
                      Продолжить
                    </button>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === "warehouse" && (
            <motion.div
              key="warehouse"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 gap-3">
                {playerCompany.warehouse.length === 0 ? (
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
                    <Box size={40} className="text-white/20 mx-auto mb-4" />
                    <p className="text-white/40 uppercase text-xs">Склад пуст</p>
                  </div>
                ) : (
                  playerCompany.warehouse.map((part) => (
                    <div
                      key={part.id}
                      className="bg-white/5 border border-white/10 rounded-xl p-4 flex justify-between items-center"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            part.quality === "Легендарное"
                              ? "bg-orange-500/20 text-orange-500"
                              : part.quality === "Премиум"
                              ? "bg-purple-500/20 text-purple-500"
                              : part.quality === "Отличное"
                              ? "bg-blue-500/20 text-blue-500"
                              : part.quality === "Хорошее"
                              ? "bg-green-500/20 text-green-500"
                              : "bg-white/10 text-white/60"
                          }`}
                        >
                          <Box size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">{part.name}</p>
                          <p className="text-[10px] uppercase opacity-60">{part.quality}</p>
                        </div>
                      </div>
                      <div className="bg-black/40 px-3 py-1 rounded-full border border-white/5">
                        <span className="text-xs font-mono text-primary">x{part.quantity}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {activeTab === "bureau" && (
            <motion.div
              key="bureau"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-4"
            >
              <div className="space-y-3">
                <div className="flex justify-between items-center px-1">
                  <h3 className="text-xs font-bold text-white/60 uppercase">Текущие разработки</h3>
                  {playerCompany.activeProjectId && (
                    <span className="text-[10px] text-primary animate-pulse font-bold uppercase">
                      Активен выбор CEO
                    </span>
                  )}
                </div>

                {playerCompany.projects.filter((p) => p.status === "active").length === 0 ? (
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
                    <p className="text-white/40 text-xs uppercase">Нет активных проектов</p>
                  </div>
                ) : (
                  playerCompany.projects
                    .filter((p) => p.status === "active")
                    .map((project) => {
                      const isSelected = playerCompany.activeProjectId === project.id;
                      return (
                        <div
                          key={project.id}
                          className={`bg-white/5 border ${
                            isSelected ? "border-primary" : "border-white/10"
                          } rounded-xl p-4 space-y-3 relative overflow-hidden`}
                        >
                          {isSelected && (
                            <div className="absolute top-0 right-0 bg-primary text-black text-[8px] font-bold px-2 py-0.5 rounded-bl uppercase">
                              В работе
                            </div>
                          )}
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="text-sm font-bold text-white">{project.name}</h4>
                              <p className="text-[10px] text-white/40 mt-1">{project.description}</p>
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] bg-primary/20 text-primary px-2 py-1 rounded-full font-bold uppercase">
                                {project.skillType}
                              </span>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px] font-mono">
                              <span className="text-white/40">Прогресс</span>
                              <span className="text-primary">
                                {project.progress} / {project.target}
                              </span>
                            </div>
                            <div className="w-full bg-black/40 h-1.5 rounded-full overflow-hidden">
                              <motion.div
                                className="h-full bg-primary"
                                initial={{ width: 0 }}
                                animate={{ width: `${(project.progress / project.target) * 100}%` }}
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="flex gap-2">
                              {isSelected && (
                                <button
                                  onClick={() => {
                                    const devId = playerName.replace(/\s+/g, "_");
                                    const isDevActive = project.activeDeveloperIds?.includes(devId);
                                    const newProjects = playerCompany.projects.map((p) => {
                                      if (p.id === project.id) {
                                        const newIds = isDevActive
                                          ? (p.activeDeveloperIds || []).filter((id) => id !== devId)
                                          : [...(p.activeDeveloperIds || []), devId];
                                        return { ...p, activeDeveloperIds: newIds };
                                      }
                                      return p;
                                    });
                                    onUpdateCompany?.({ projects: newProjects });
                                  }}
                                  className={`flex-1 ${
                                    (project.activeDeveloperIds || []).includes(
                                      playerName.replace(/\s+/g, "_")
                                    )
                                      ? "bg-green-500/20 text-green-500"
                                      : "bg-primary text-black"
                                  } text-xs font-bold py-2 rounded-lg transition`}
                                >
                                  {(project.activeDeveloperIds || []).includes(
                                    playerName.replace(/\s+/g, "_")
                                  )
                                    ? "Разработка..."
                                    : "Начать разработку"}
                                </button>
                              )}
                              {playerCompany.role === "CEO" && !isSelected && (
                                <button
                                  onClick={() => selectActiveProject(project.id)}
                                  className="flex-1 bg-white/10 hover:bg-white/20 text-white text-xs font-bold py-2 rounded-lg transition"
                                >
                                  Выбрать для компании
                                </button>
                              )}
                            </div>
                            {isSelected && (project.activeDeveloperIds || []).length > 0 && (
                              <div className="text-center space-y-1">
                                <p className="text-[9px] text-green-400/60 animate-pulse font-bold uppercase">
                                  Разработка активна
                                </p>
                                <p className="text-[8px] text-white/50">
                                  Разработчики: {project.activeDeveloperIds?.length}
                                </p>
                                <p className="text-[8px] text-primary font-mono">
                                  ⏱ ~{getEstimatedTime(project)}сек осталось
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                )}
              </div>

              {playerCompany.role === "CEO" && (
                <div className="space-y-3 pt-4">
                  <h3 className="text-xs font-bold text-white/60 uppercase px-1">Доступные чертежи</h3>
                  <div className="grid grid-cols-1 gap-2">
                    {GADGET_PROJECTS.map((template, idx) => {
                      const isAlreadyActive = playerCompany.projects.some((p) => p.name === template.name);
                      return (
                        <button
                          key={idx}
                          onClick={() => {
                            const newProject: Project = {
                              ...template,
                              id: `proj-${Date.now()}`,
                              progress: 0,
                              status: "active",
                            };
                            onUpdateCompany?.({ projects: [...playerCompany.projects, newProject] });
                          }}
                          disabled={isAlreadyActive}
                          className="bg-white/5 border border-white/10 rounded-xl p-4 flex justify-between items-center hover:border-primary transition disabled:opacity-50"
                        >
                          <div className="text-left">
                            <p className="text-sm font-bold text-white">{template.name}</p>
                            <p className="text-[10px] text-white/40 uppercase">Нужен: {template.skillType}</p>
                          </div>
                          <Plus size={16} className="text-primary" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "blueprints" && (
            <motion.div key="blueprints" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <h3 className="font-bold mb-2">Активный чертеж</h3>
                {!blueprintData?.active ? (
                  <p className="text-sm text-white/50">Чертеж не выбран</p>
                ) : (
                  <div className="text-sm space-y-1">
                    <div>{blueprintData.available.find((b: any) => b.id === blueprintData.active.blueprintId)?.name}</div>
                    <div className="text-white/60">Статус: {BLUEPRINT_STATUSES[blueprintData.active.status as keyof typeof BLUEPRINT_STATUSES]}</div>
                    <div className="text-white/60">Прогресс: {blueprintData.active.progressHours}ч</div>
                  </div>
                )}
                {playerCompany.role === "CEO" && blueprintData?.active && blueprintData.active.status !== "production_ready" && (
                  <button onClick={() => progressBlueprint.mutate()} className="mt-3 px-3 py-1 bg-primary text-black rounded font-bold text-sm">+24ч разработки</button>
                )}
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
                <h3 className="font-bold">Доступные чертежи</h3>
                {(blueprintData?.available || []).map((bp: any) => (
                  <div key={bp.id} className="flex items-center justify-between bg-black/30 rounded p-2 text-sm">
                    <span>{bp.name}</span>
                    {playerCompany.role === "CEO" && <button onClick={() => startBlueprint.mutate(bp.id)} className="text-primary">Выбрать</button>}
                  </div>
                ))}
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
                <h3 className="font-bold">Произведенные гаджеты</h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    onClick={() => setListingMode("fixed")}
                    className={`rounded px-2 py-1 ${listingMode === "fixed" ? "bg-primary text-black" : "bg-black/40 text-white/80"}`}
                  >
                    Фикс-цена
                  </button>
                  <button
                    onClick={() => setListingMode("auction")}
                    className={`rounded px-2 py-1 ${listingMode === "auction" ? "bg-primary text-black" : "bg-black/40 text-white/80"}`}
                  >
                    Аукцион
                  </button>
                </div>
                {listingMode === "auction" && (
                  <div className="text-xs text-white/70">
                    Длительность аукциона (2-12 ч):
                    <input
                      type="number"
                      min={2}
                      max={12}
                      value={auctionHours}
                      onChange={(e) => setAuctionHours(Number(e.target.value))}
                      className="w-full mt-1 bg-black/50 border border-white/20 rounded px-2 py-1"
                    />
                  </div>
                )}
                <button onClick={() => produceGadget.mutate()} disabled={produceGadget.isPending} className="px-3 py-1 bg-primary text-black rounded font-bold text-sm">Произвести гаджет</button>
                {(blueprintData?.produced || []).map((g: any) => (
                  <div key={g.id} className="bg-black/30 rounded p-2 text-sm space-y-1">
                    <div className="font-semibold">{g.name} · x{g.quality}</div>
                    <div className="text-white/60">Цена: {g.minPrice}-{g.maxPrice}</div>
                    {listingMode === "auction" && g.quality < 2 ? (
                      <div className="text-[11px] text-yellow-300">Аукцион доступен только для quality ≥ 2.0</div>
                    ) : null}
                    <input type="number" value={listingPrice || g.minPrice} onChange={(e) => setListingPrice(Number(e.target.value))} className="w-full bg-black/50 border border-white/20 rounded px-2 py-1" />
                    <button onClick={() => createListing.mutate(g.id)} className="text-primary">{listingMode === "auction" ? "Запустить аукцион" : "Выставить в маркет"}</button>
                  </div>
                ))}
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
                <h3 className="font-bold">Городские контракты</h3>
                {cityContracts.map((contract) => {
                  const canAccept = contract.status === "open";
                  const canDeliver = contract.status === "in_progress" && contract.assignedCompanyId === playerCompany.id;
                  return (
                    <div key={contract.id} className="bg-black/30 rounded p-2 text-sm space-y-1">
                      <div className="font-semibold">{contract.title} · {contract.customer}</div>
                      <div className="text-white/60">
                        Нужно: {contract.requiredQuantity} шт. {contract.category}, качество ≥ {contract.minQuality}
                      </div>
                      <div className="text-white/60">Награда: {contract.rewardMoney}$ и +{contract.rewardOrk} ORK</div>
                      <div className="text-white/60">
                        Статус: {contract.status === "open" ? "Открыт" : contract.status === "in_progress" ? "В работе" : "Завершен"}
                      </div>
                      {canAccept && (
                        <button onClick={() => acceptContract.mutate(contract.id)} className="text-primary">
                          Принять контракт
                        </button>
                      )}
                      {canDeliver && (
                        <button onClick={() => deliverContract.mutate(contract.id)} className="text-primary">
                          Сдать контракт
                        </button>
                      )}
                    </div>
                  );
                })}
                {cityContracts.length === 0 && <p className="text-sm text-white/50">Пока нет активных контрактов.</p>}
              </div>
            </motion.div>
          )}

          {activeTab === "management" && (
            <motion.div
              key="management"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-4"
            >
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setManagementSubTab("employees")}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg ${
                    managementSubTab === "employees"
                      ? "bg-primary text-black"
                      : "bg-white/5 border border-white/10 text-white"
                  }`}
                >
                  👥 Сотрудники
                </button>
                <button
                  onClick={() => setManagementSubTab("salaries")}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg ${
                    managementSubTab === "salaries"
                      ? "bg-primary text-black"
                      : "bg-white/5 border border-white/10 text-white"
                  }`}
                >
                  💰 Зарплата
                </button>
                <button
                  onClick={() => setManagementSubTab("requests")}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg ${
                    managementSubTab === "requests"
                      ? "bg-primary text-black"
                      : "bg-white/5 border border-white/10 text-white"
                  }`}
                >
                  📋 Заявки
                </button>
              </div>

              {managementSubTab === "employees" && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-white/60 uppercase px-1">Штат компании</h3>
                  {playerCompany.employees.map((emp) => (
                    <div
                      key={emp.id}
                      className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm font-bold text-white">{emp.name}</p>
                          <p className="text-[10px] text-white/40 uppercase">Лвл: {playerLevel}</p>
                        </div>
                        {playerCompany.role === "CEO" && emp.name !== playerName && (
                          <button
                            onClick={() => {
                              if (selectedDeputy === emp.name) setSelectedDeputy(null);
                              else setSelectedDeputy(emp.name);
                              if (selectedDeputy === emp.name) {
                                onUpdateCompany?.({ deputy: selectedDeputy });
                              }
                            }}
                            className={`text-[10px] px-2 py-1 rounded font-bold ${
                              selectedDeputy === emp.name
                                ? "bg-green-500/20 text-green-400"
                                : "bg-blue-500/20 text-blue-400"
                            }`}
                          >
                            {selectedDeputy === emp.name ? "✓ Зам" : "Назнач. зам"}
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div className="bg-black/40 rounded p-2">
                          <p className="text-white/40">Заработок</p>
                          <p className="text-green-400 font-bold">+{currency.symbol}{emp.earned || 0}</p>
                        </div>
                        <div className="bg-black/40 rounded p-2">
                          <p className="text-white/40">Время разр.</p>
                          <p className="text-primary font-bold">{Math.round((emp.devTime || 0) / 60)}м</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {managementSubTab === "salaries" && (
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-white/60 uppercase px-1">Установить зарплаты</h3>
                  <div className="space-y-3">
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                      <label className="text-xs text-white/60 uppercase">
                        CEO: {currency.symbol}
                        {salarySettings.ceo}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="5000"
                        step="100"
                        value={salarySettings.ceo}
                        onChange={(e) =>
                          setSalarySettings({ ...salarySettings, ceo: parseInt(e.target.value) })
                        }
                        className="w-full mt-2"
                      />
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                      <label className="text-xs text-white/60 uppercase">
                        Заместитель: {currency.symbol}
                        {salarySettings.deputy}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="3000"
                        step="100"
                        value={salarySettings.deputy}
                        onChange={(e) =>
                          setSalarySettings({ ...salarySettings, deputy: parseInt(e.target.value) })
                        }
                        className="w-full mt-2"
                      />
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                      <label className="text-xs text-white/60 uppercase">
                        Обычные сотрудники: {currency.symbol}
                        {salarySettings.regular}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="2000"
                        step="100"
                        value={salarySettings.regular}
                        onChange={(e) =>
                          setSalarySettings({ ...salarySettings, regular: parseInt(e.target.value) })
                        }
                        className="w-full mt-2"
                      />
                    </div>
                    <button
                      onClick={() => onUpdateCompany?.({ salaries: salarySettings })}
                      className="w-full bg-primary text-black font-bold py-3 rounded-lg uppercase"
                    >
                      Сохранить
                    </button>
                  </div>
                </div>
              )}

              {managementSubTab === "requests" && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-white/60 uppercase px-1">Заявки на вступление</h3>
                  {!joinRequests || joinRequests.length === 0 ? (
                    <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
                      <p className="text-white/40 text-xs uppercase">Нет заявок</p>
                    </div>
                  ) : (
                    joinRequests.map((req) => (
                      <div
                        key={req.id}
                        className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3"
                      >
                        <div>
                          <p className="text-sm font-bold text-white">{req.username}</p>
                          <p className="text-[10px] text-white/40">Уровень: {req.playerLevel}</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() =>
                              respondMutation.mutate({
                                requestId: req.id,
                                status: "accepted",
                                companyId: playerCompany.id,
                                userId: req.userId,
                                username: req.username,
                              })
                            }
                            className="flex-1 bg-green-500/20 text-green-400 text-xs font-bold py-2 rounded"
                          >
                            Принять
                          </button>
                          <button
                            onClick={() =>
                              respondMutation.mutate({
                                requestId: req.id,
                                status: "rejected",
                                companyId: playerCompany.id,
                                userId: req.userId,
                                username: req.username,
                              })
                            }
                            className="flex-1 bg-red-500/20 text-red-400 text-xs font-bold py-2 rounded"
                          >
                            Отказать
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Экран выбора компании (если игрок не в компании)
  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black text-white p-4 pb-24">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-white/50 hover:text-primary text-xs uppercase tracking-widest transition-colors"
      >
        <ChevronLeft size={18} /> Назад
      </button>

      <h2 className="text-2xl font-bold text-white uppercase tracking-widest mb-4">Компании</h2>

      {!selectedCompany && !showCreate ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="bg-white/5 border border-primary/20 rounded-lg p-4">
            <p className="text-sm font-bold text-white uppercase tracking-widest">{playerCity}</p>
            <p className="text-xs text-white/60 mt-1">
              Баланс: {currency.symbol}
              {playerBalance.toLocaleString()}
            </p>
          </div>

          <h3 className="text-xs font-bold text-white/60 uppercase px-1">Доступные компании</h3>
          {cityCompanies.map((comp: any) => (
            <motion.button
              key={comp.id}
              onClick={() => setSelectedCompany(comp)}
              whileHover={{ scale: 1.02 }}
              className="w-full text-left bg-white/5 border border-primary/20 rounded-lg p-4 hover:border-primary transition"
            >
              <p className="font-bold text-white">{comp.name}</p>
              <p className="text-xs text-white/60">Город: {comp.city}</p>
              <p className="text-xs text-white/60">CEO: {comp.ownerId}</p>
              <div className="flex justify-between mt-2 text-xs">
                <span className="text-primary">Уровень {comp.level}</span>
                <span className="text-white/60">{comp.members || 1} чел.</span>
              </div>
            </motion.button>
          ))}

          <motion.button
            onClick={() => setShowCreate(true)}
            whileHover={{ scale: 1.02 }}
            disabled={playerBalance < COMPANY_CREATION_COST}
            className="w-full bg-green-500/20 border border-green-500/30 rounded-lg p-4 text-green-400 font-bold uppercase disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Plus size={16} /> Создать компанию ({currency.symbol}
            {COMPANY_CREATION_COST})
          </motion.button>
        </motion.div>
      ) : showCreate ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <button
            onClick={() => setShowCreate(false)}
            className="text-white/50 text-xs flex items-center gap-1 uppercase tracking-widest"
          >
            <ChevronLeft size={14} /> Назад
          </button>

          <h3 className="text-lg font-bold text-white uppercase">Новая компания</h3>

          <input
            type="text"
            placeholder="Название"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded px-4 py-3 text-white outline-none focus:border-primary"
          />

          <button
            onClick={createCompany}
            disabled={!companyName.trim() || playerBalance < COMPANY_CREATION_COST}
            className="w-full bg-primary text-black font-bold py-3 rounded uppercase disabled:opacity-50"
          >
            Создать
          </button>
        </motion.div>
      ) : selectedCompany ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <button
            onClick={() => setSelectedCompany(null)}
            className="text-white/50 text-xs flex items-center gap-1 uppercase tracking-widest"
          >
            <ChevronLeft size={14} /> Назад
          </button>

          <div className="bg-white/5 border border-primary/20 rounded-lg p-6 space-y-4">
            <h3 className="text-xl font-bold text-white">{selectedCompany.name}</h3>
            <p className="text-xs text-white/60">Уровень {selectedCompany.level}</p>

            <button
              onClick={() => joinMutation.mutate(selectedCompany.id)}
              className="w-full bg-primary text-black font-bold py-3 rounded uppercase"
            >
              Подать заявку
            </button>
          </div>
        </motion.div>
      ) : null}
    </div>
  );
}
