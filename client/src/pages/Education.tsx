import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, BookOpen, CheckCircle, AlertCircle } from "lucide-react";

interface Course {
  id: string;
  name: string;
  description: string;
  cost: number;
  skillBoosts: Record<string, number>;
  timeMinutes: number;
  failureChance: number;
  icon: string;
}

interface School {
  name: string;
  minLevel: number;
  maxLevel: number;
  courses: Course[];
}

interface EducationProps {
  onBack: () => void;
  playerLevel: number;
  playerBalance: number;
  playerCity: string;
  playerReputation?: number;
  onCompleteEducation: (skillBoosts: Record<string, number>, costPaid: number) => void;
}

const EDUCATION_LEVELS: Record<string, School> = {
  school: {
    name: "🏫 Школа",
    minLevel: 1,
    maxLevel: 15,
    courses: [
      {
        id: "math",
        name: "Математика",
        description: "Основы логики и алгоритмов",
        cost: 100,
        skillBoosts: { analytics: 1, coding: 1 },
        timeMinutes: 5,
        failureChance: 15,
        icon: "🔢",
      },
      {
        id: "physics",
        name: "Физика",
        description: "Базовая физика и механика",
        cost: 100,
        skillBoosts: { modeling: 1, analytics: 1 },
        timeMinutes: 5,
        failureChance: 15,
        icon: "⚛️",
      },
      {
        id: "art",
        name: "Искусство",
        description: "Основы дизайна и композиции",
        cost: 80,
        skillBoosts: { design: 1, drawing: 1 },
        timeMinutes: 5,
        failureChance: 10,
        icon: "🎨",
      },
    ],
  },
  college: {
    name: "🎓 Колледж",
    minLevel: 16,
    maxLevel: 30,
    courses: [
      {
        id: "programming",
        name: "Программирование",
        description: "Профессиональная разработка и паттерны",
        cost: 300,
        skillBoosts: { coding: 3, analytics: 1 },
        timeMinutes: 5,
        failureChance: 20,
        icon: "💻",
      },
      {
        id: "qa",
        name: "Тестирование ПО",
        description: "QA и автоматизация тестов",
        cost: 280,
        skillBoosts: { testing: 3, attention: 2 },
        timeMinutes: 5,
        failureChance: 18,
        icon: "🔍",
      },
      {
        id: "ui_design",
        name: "UI/UX Дизайн",
        description: "Современный веб-дизайн и прототипирование",
        cost: 320,
        skillBoosts: { design: 3, drawing: 2 },
        timeMinutes: 5,
        failureChance: 15,
        icon: "🎭",
      },
      {
        id: "analytics",
        name: "Аналитика Данных",
        description: "Анализ данных и BI системы",
        cost: 350,
        skillBoosts: { analytics: 3, modeling: 2 },
        timeMinutes: 5,
        failureChance: 25,
        icon: "📊",
      },
    ],
  },
  university: {
    name: "🏛️ Университет",
    minLevel: 31,
    maxLevel: 50,
    courses: [
      {
        id: "architecture",
        name: "Архитектура ПО",
        description: "Проектирование масштабных систем",
        cost: 600,
        skillBoosts: { coding: 5, modeling: 3, analytics: 2 },
        timeMinutes: 5,
        failureChance: 25,
        icon: "🏗️",
      },
      {
        id: "ai_ml",
        name: "AI/ML Инженер",
        description: "Машинное обучение и нейросети",
        cost: 700,
        skillBoosts: { analytics: 5, coding: 3, modeling: 2 },
        timeMinutes: 5,
        failureChance: 30,
        icon: "🤖",
      },
      {
        id: "security",
        name: "Кибербезопасность",
        description: "Защита и аудит безопасности",
        cost: 650,
        skillBoosts: { testing: 4, analytics: 4, attention: 3 },
        timeMinutes: 5,
        failureChance: 28,
        icon: "🔐",
      },
      {
        id: "leadership",
        name: "Tech Leadership",
        description: "Управление командой и проектами",
        cost: 500,
        skillBoosts: { design: 4, coding: 2, analytics: 3 },
        timeMinutes: 5,
        failureChance: 20,
        icon: "👔",
      },
      {
        id: "innovation",
        name: "Инновационные технологии",
        description: "Блокчейн, Web3 и будущие тренды",
        cost: 800,
        skillBoosts: { coding: 4, modeling: 4, analytics: 3 },
        timeMinutes: 5,
        failureChance: 35,
        icon: "🚀",
      },
    ],
  },
};

export default function Education({ onBack, playerLevel, playerBalance, playerCity, playerReputation = 0, onCompleteEducation }: EducationProps) {
  // 🌆 ГОРОД-СПЕЦИФИЧНЫЕ БОНУСЫ
  const getCityBonus = () => {
    const rep = playerReputation;
    const city = playerCity;
    let failureReduction = 0;
    
    // САНКТ-ПЕТЕРБУРГ: меньше провалов на учёбе
    if (city === "Санкт-Петербург") {
      if (rep >= 100) failureReduction = 10;
      if (rep >= 300) failureReduction = 15;
      if (rep >= 600) failureReduction = 20;
      if (rep >= 1000) failureReduction = 25;
    }
    // СИНГАПУР: много снижение провалов
    if (city === "Сингапур") {
      if (rep >= 100) failureReduction = 15;
      if (rep >= 300) failureReduction = 18;
      if (rep >= 600) failureReduction = 20;
      if (rep >= 1000) failureReduction = 20;
    }
    // СЕУЛ: небольшое снижение на образовании
    if (city === "Сеул") {
      if (rep >= 100) failureReduction = 5;
      if (rep >= 300) failureReduction = 7;
      if (rep >= 600) failureReduction = 10;
      if (rep >= 1000) failureReduction = 15;
    }
    
    return failureReduction;
  };
  const [selectedLevel, setSelectedLevel] = useState<"school" | "college" | "university" | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [isStudying, setIsStudying] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [studyComplete, setStudyComplete] = useState(false);
  const [studyResult, setStudyResult] = useState<"success" | "failure" | null>(null);

  useEffect(() => {
    if (!isStudying || timeRemaining <= 0) return;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          setIsStudying(false);
          setStudyComplete(true);
          
          // Determine success/failure с учётом бонусов города
          let failChance = selectedCourse?.failureChance || 0;
          const cityBonus = getCityBonus();
          failChance = Math.max(0, failChance - cityBonus); // Применяем снижение провала
          
          const isSuccess = Math.random() * 100 > failChance;
          setStudyResult(isSuccess ? "success" : "failure");

          if (isSuccess && selectedCourse) {
            onCompleteEducation(selectedCourse.skillBoosts, selectedCourse.cost);
          }

          setTimeout(() => {
            setStudyComplete(false);
            setSelectedCourse(null);
            setStudyResult(null);
          }, 2000);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isStudying, timeRemaining, selectedCourse, onCompleteEducation]);

  const getAvailableLevels = () => {
    const levels: ("school" | "college" | "university")[] = [];
    if (playerLevel >= 1 && playerLevel <= 15) levels.push("school");
    if (playerLevel >= 16 && playerLevel <= 30) levels.push("college");
    if (playerLevel >= 31 && playerLevel <= 50) levels.push("university");
    return levels;
  };

  const availableLevels = getAvailableLevels();
  const currentSchool = selectedLevel ? EDUCATION_LEVELS[selectedLevel] : null;

  const getCurrencySymbol = () => {
    const citySymbols: Record<string, string> = {
      "Сан-Франциско": "$",
      "Сингапур": "S$",
      "Санкт-Петербург": "₽",
    };
    return citySymbols[playerCity] || "$";
  };

  const handleStartStudy = () => {
    if (selectedCourse && playerBalance >= selectedCourse.cost) {
      setIsStudying(true);
      setTimeRemaining(5); // Установлено 5 секунд по запросу
    }
  };

  const currency = getCurrencySymbol();

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
            Обучение
          </h1>
        </div>

        {!selectedLevel ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {/* LEVEL SELECTION */}
            <div className="space-y-3">
              {availableLevels.length === 0 ? (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-center">
                  <p className="text-white/60 text-sm">❌ Необходимый уровень не достигнут</p>
                </div>
              ) : (
                availableLevels.map((level) => {
                  const school = EDUCATION_LEVELS[level];
                  return (
                    <motion.button
                      key={level}
                      onClick={() => setSelectedLevel(level)}
                      whileHover={{ scale: 1.02 }}
                      className="w-full text-left bg-white/5 border border-primary/20 rounded-lg p-4 hover:border-primary/50 hover:bg-white/10 transition"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="font-bold text-white text-lg">{school.name}</h3>
                          <p className="text-xs text-white/60 mt-1">
                            Уровни {school.minLevel}-{school.maxLevel}
                          </p>
                        </div>
                        <div className="text-3xl">{school.name.split(" ")[0]}</div>
                      </div>
                      <p className="text-xs text-white/50 mt-2">Курсов: {school.courses.length}</p>
                    </motion.button>
                  );
                })
              )}
            </div>
          </motion.div>
        ) : !selectedCourse ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <button
              onClick={() => setSelectedLevel(null)}
              className="flex items-center gap-2 text-white/50 hover:text-primary text-xs uppercase tracking-widest transition-colors mb-4"
            >
              <ChevronLeft size={14} /> Вернуться
            </button>

            <div className="bg-white/5 border border-primary/20 rounded-lg p-4 text-center">
              <p className="text-primary font-bold uppercase tracking-widest">{currentSchool?.name}</p>
              <p className="text-xs text-white/60 mt-2">Доступные курсы</p>
            </div>

            {/* COURSE LIST */}
            <div className="space-y-3">
              {currentSchool?.courses.map((course) => (
                <motion.button
                  key={course.id}
                  onClick={() => setSelectedCourse(course)}
                  whileHover={{ scale: 1.02 }}
                  className="w-full text-left bg-white/5 border border-primary/20 rounded-lg p-4 hover:border-primary/50 hover:bg-white/10 transition"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{course.icon}</span>
                      <div>
                        <h4 className="font-bold text-white">{course.name}</h4>
                        <p className="text-xs text-white/60">{course.description}</p>
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <div className="font-bold text-primary">{currency}{course.cost}</div>
                      <div className="text-xs text-orange-400">{course.failureChance}% риск</div>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {Object.entries(course.skillBoosts).map(([skill, value]) => (
                      <div key={skill} className="text-[10px] bg-primary/20 rounded px-2 py-1 text-primary">
                        {skill} +{value}
                      </div>
                    ))}
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <button
              onClick={() => setSelectedCourse(null)}
              className="flex items-center gap-2 text-white/50 hover:text-primary text-xs uppercase tracking-widest transition-colors mb-4"
            >
              <ChevronLeft size={14} /> Вернуться
            </button>

            <div className="bg-white/5 border border-primary/20 rounded-lg p-6 space-y-4">
              <div className="text-center">
                <div className="text-5xl mb-2">{selectedCourse.icon}</div>
                <h2 className="text-lg font-bold text-white uppercase tracking-widest">
                  {selectedCourse.name}
                </h2>
                <p className="text-xs text-white/60 mt-2">{selectedCourse.description}</p>
              </div>

              <div className="bg-black/40 border border-white/10 rounded p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-white/60">Стоимость:</span>
                  <span className="text-primary font-bold">{currency}{selectedCourse.cost}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Время:</span>
                  <span className="text-blue-400">{selectedCourse.timeMinutes} мин</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Риск провала:</span>
                  <span className="text-orange-400">{selectedCourse.failureChance}%</span>
                </div>
              </div>

              <div className="bg-black/40 border border-white/10 rounded p-4">
                <p className="text-xs text-white/60 mb-2 uppercase">Прибыль навыков:</p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(selectedCourse.skillBoosts).map(([skill, value]) => (
                    <div key={skill} className="bg-black/60 rounded p-2 text-center">
                      <p className="text-[10px] text-white/60 capitalize">{skill}</p>
                      <p className="text-sm font-bold text-primary">+{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {playerBalance < selectedCourse.cost && (
                <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-red-400">❌ Недостаточно средств</p>
                  <p className="text-xs text-red-400/60">Нужно: {currency}{selectedCourse.cost - playerBalance}</p>
                </div>
              )}

              <AnimatePresence mode="wait">
                {!isStudying && !studyComplete && (
                  <motion.button
                    key="start-btn"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={handleStartStudy}
                    disabled={playerBalance < selectedCourse.cost}
                    className="w-full bg-primary text-black font-bold py-3 rounded uppercase tracking-wider hover:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Начать обучение
                  </motion.button>
                )}

                {isStudying && (
                  <motion.div
                    key="studying"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="space-y-4"
                  >
                    <div className="text-center">
                      <div className="text-5xl font-bold text-primary mb-2">
                        {Math.floor(timeRemaining / 60)}:{String(timeRemaining % 60).padStart(2, "0")}
                      </div>
                      <p className="text-white/60 text-sm uppercase tracking-wider">Учусь...</p>
                    </div>

                    <div className="w-full bg-black/60 rounded-full h-3 overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-primary to-blue-500"
                        animate={{
                          width: `${100 - (timeRemaining / 5) * 100}%`,
                        }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                  </motion.div>
                )}

                {studyComplete && (
                  <motion.div
                    key="complete"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`rounded-lg p-4 text-center space-y-3 border ${
                      studyResult === "success"
                        ? "bg-green-500/20 border-green-500/50"
                        : "bg-red-500/20 border-red-500/50"
                    }`}
                  >
                    {studyResult === "success" ? (
                      <>
                        <CheckCircle size={40} className="text-green-400 mx-auto" />
                        <div>
                          <p className="font-bold text-white text-lg">Курс завершён!</p>
                          <p className="text-green-400 text-sm mt-1">Все навыки повышены</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <AlertCircle size={40} className="text-red-400 mx-auto" />
                        <div>
                          <p className="font-bold text-white text-lg">Провал обучения!</p>
                          <p className="text-red-400 text-sm mt-1">Вам не удалось сдать экзамен</p>
                        </div>
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
