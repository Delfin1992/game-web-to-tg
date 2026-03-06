import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Briefcase, TrendingUp, CheckCircle } from "lucide-react";
import { RANK_EMOJIS } from "@/lib/ranks";

interface Job {
  name: string;
  minStats: Record<string, number>;
  rankRequired: string;
  timeMinutes: number;
  reward: number;
  expReward: number;
  description: string;
}

interface JobsProps {
  onBack: () => void;
  playerCity: string;
  playerLevel: number;
  playerPersonality?: string;
  onCompleteWork: (reward: number, expReward: number) => void;
}

const JOBS_BY_CITY: Record<string, Job[]> = {
  "Сан-Франциско": [
    {
      name: "Стажер iOS разработчик",
      minStats: { coding: 0 },
      rankRequired: "Intern",
      timeMinutes: 5,
      reward: 10,
      expReward: 20,
      description: "Разработка простых функций для iOS приложений",
    },
    {
      name: "Junior iOS разработчик",
      minStats: { coding: 2, design: 1 },
      rankRequired: "Junior",
      timeMinutes: 5,
      reward: 25,
      expReward: 30,
      description: "Разработка компонентов iOS приложений",
    },
    {
      name: "Middle iOS разработчик",
      minStats: { coding: 4, design: 2, analytics: 2 },
      rankRequired: "Middle",
      timeMinutes: 5,
      reward: 45,
      expReward: 40,
      description: "Разработка сложных функций и оптимизация",
    },
  ],
  "Сингапур": [
    {
      name: "Стажер QA инженер",
      minStats: { testing: 0 },
      rankRequired: "Intern",
      timeMinutes: 5,
      reward: 15,
      expReward: 20,
      description: "Базовое тестирование мобильных устройств",
    },
    {
      name: "Junior QA инженер",
      minStats: { testing: 2, attention: 1 },
      rankRequired: "Junior",
      timeMinutes: 5,
      reward: 30,
      expReward: 30,
      description: "Тестирование функционала устройств",
    },
    {
      name: "Middle QA инженер",
      minStats: { testing: 4, attention: 2, analytics: 2 },
      rankRequired: "Middle",
      timeMinutes: 5,
      reward: 50,
      expReward: 40,
      description: "Автоматизация тестирования устройств",
    },
  ],
  "Санкт-Петербург": [
    {
      name: "Стажер UI/UX дизайнер",
      minStats: { design: 0 },
      rankRequired: "Intern",
      timeMinutes: 5,
      reward: 20,
      expReward: 25,
      description: "Создание простых элементов интерфейса",
    },
    {
      name: "Junior UI/UX дизайнер",
      minStats: { design: 2, attention: 1 },
      rankRequired: "Junior",
      timeMinutes: 5,
      reward: 35,
      expReward: 35,
      description: "Разработка интерфейсов приложений",
    },
    {
      name: "Middle UI/UX дизайнер",
      minStats: { design: 4, attention: 2, drawing: 2 },
      rankRequired: "Middle",
      timeMinutes: 5,
      reward: 55,
      expReward: 45,
      description: "Создание сложных интерфейсов",
    },
  ],
  "Сеул": [
    {
      name: "Стажер Game Developer",
      minStats: { coding: 0 },
      rankRequired: "Intern",
      timeMinutes: 5,
      reward: 22,
      expReward: 25,
      description: "Разработка простых игровых механик",
    },
    {
      name: "Junior K-Game Dev",
      minStats: { coding: 2, modeling: 1 },
      rankRequired: "Junior",
      timeMinutes: 5,
      reward: 40,
      expReward: 35,
      description: "Работа над K-Pop игровыми проектами",
    },
    {
      name: "Middle Engine Developer",
      minStats: { coding: 5, modeling: 3, analytics: 2 },
      rankRequired: "Middle",
      timeMinutes: 5,
      reward: 65,
      expReward: 50,
      description: "Оптимизация игровых движков",
    },
  ],
};

export default function Jobs({ onBack, playerCity, playerLevel, playerPersonality, onCompleteWork }: JobsProps) {
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [workComplete, setWorkComplete] = useState(false);
  const jobs = JOBS_BY_CITY[playerCity] || [];

  useEffect(() => {
    if (!isWorking || timeRemaining <= 0) return;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          setIsWorking(false);
          setWorkComplete(true);
          if (selectedJob) {
            onCompleteWork(selectedJob.reward, selectedJob.expReward);
          }
          setTimeout(() => {
            setWorkComplete(false);
            setSelectedJob(null);
          }, 2000);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isWorking, timeRemaining, selectedJob, onCompleteWork]);

  const handleStartWork = () => {
    if (selectedJob) {
      setIsWorking(true);
      setTimeRemaining(5); // Установлено 5 секунд по запросу
    }
  };

  const getJobReward = (reward: number) => {
    if (playerPersonality === "businessman") return Math.floor(reward * 1.15);
    return reward;
  };

  const getJobExp = (exp: number) => {
    if (playerPersonality === "workaholic") return Math.floor(exp * 1.2);
    return exp;
  };


  const getJobDropChance = (rank: string) => {
    if (rank === "Middle") return 50;
    if (rank === "Junior") return 38;
    return 28;
  };

  const getRankEmoji = (rank: string) => {
    return (RANK_EMOJIS as Record<string, string>)[rank] || "💼";
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
            Вакансии
          </h1>
        </div>

        {!selectedJob ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            {/* CITY INFO */}
            <div className="bg-white/5 border border-primary/20 rounded-lg p-4 text-center">
              <p className="text-sm font-bold text-white uppercase tracking-widest">
                {playerCity}
              </p>
              <p className="text-xs text-white/60 mt-1">
                Доступных вакансий: {jobs.length}
              </p>
            </div>

            {/* JOBS LIST */}
            <div className="space-y-3">
              {jobs.map((job, index) => (
                <motion.button
                  key={index}
                  onClick={() => setSelectedJob(job)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full text-left bg-white/5 border border-primary/20 rounded-lg p-4 hover:border-primary/50 hover:bg-white/10 transition"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{getRankEmoji(job.rankRequired)}</span>
                      <div>
                        <h3 className="font-bold text-white">{job.name}</h3>
                        <p className="text-xs text-white/60">{job.rankRequired}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-primary">${getJobReward(job.reward)}</div>
                      <div className="text-xs text-white/60">+{getJobExp(job.expReward)} exp</div>
                      <div className="text-[10px] text-yellow-400">🎁 {getJobDropChance(job.rankRequired)}% дроп</div>
                    </div>
                  </div>
                  <p className="text-xs text-white/50 mb-2">{job.description}</p>
                  <div className="flex gap-2">
                    {Object.entries(job.minStats).map(([stat, value]) => (
                      <div
                        key={stat}
                        className="text-[10px] bg-black/40 rounded px-2 py-1 text-primary/80"
                      >
                        {stat}: {value}+
                      </div>
                    ))}
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            <button
              onClick={() => setSelectedJob(null)}
              className="flex items-center gap-2 text-white/50 hover:text-primary text-xs uppercase tracking-widest transition-colors mb-4"
            >
              <ChevronLeft size={14} /> Вернуться
            </button>

            <div className="bg-white/5 border border-primary/20 rounded-lg p-6 space-y-4">
              <div className="text-center">
                <div className="text-5xl mb-2">
                  {getRankEmoji(selectedJob.rankRequired)}
                </div>
                <h2 className="text-lg font-bold text-white uppercase tracking-widest">
                  {selectedJob.name}
                </h2>
                <p className="text-xs text-white/60 mt-2">
                  {selectedJob.rankRequired} · {selectedJob.timeMinutes} мин · 🎁 {getJobDropChance(selectedJob.rankRequired)}% дроп
                </p>
              </div>

              <div className="bg-black/40 border border-white/10 rounded p-4">
                <p className="text-white/80 text-sm mb-4">{selectedJob.description}</p>

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-white/60">Награда:</span>
                    <span className="text-primary font-bold">${getJobReward(selectedJob.reward)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Опыт:</span>
                    <span className="text-green-400 font-bold">
                      +{getJobExp(selectedJob.expReward)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Время:</span>
                    <span className="text-blue-400 font-bold">
                      {selectedJob.timeMinutes} минут
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-white/10">
                  <p className="text-xs text-white/60 mb-3">Требуемые характеристики:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(selectedJob.minStats).map(([stat, value]) => (
                      <div key={stat} className="bg-black/60 rounded p-2 text-center">
                        <p className="text-[10px] text-white/60 capitalize">{stat}</p>
                        <p className="text-sm font-bold text-primary">{value}+</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <AnimatePresence mode="wait">
                {!isWorking && !workComplete && (
                  <motion.button
                    key="start-btn"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={handleStartWork}
                    className="w-full bg-primary text-black font-bold py-3 rounded uppercase tracking-wider hover:bg-white transition-all"
                    data-testid="button-start-job"
                  >
                    Начать работу
                  </motion.button>
                )}

                {isWorking && (
                  <motion.div
                    key="working"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="space-y-4"
                  >
                    <div className="text-center">
                      <div className="text-5xl font-bold text-primary mb-2">
                        {Math.floor(timeRemaining / 60)}:{String(timeRemaining % 60).padStart(2, "0")}
                      </div>
                      <p className="text-white/60 text-sm uppercase tracking-wider">
                        Работаю...
                      </p>
                    </div>

                    <div className="w-full bg-black/60 rounded-full h-3 overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-primary to-secondary"
                        animate={{
                          width: `${100 - (timeRemaining / 5) * 100}%`,
                        }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>

                    <div className="text-center text-xs text-white/60">
                      Вознаграждение: ${getJobReward(selectedJob?.reward || 0)} + {getJobExp(selectedJob?.expReward || 0)} exp
                    </div>
                  </motion.div>
                )}

                {workComplete && (
                  <motion.div
                    key="complete"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="bg-green-500/20 border border-green-500/50 rounded-lg p-4 text-center space-y-3"
                  >
                    <CheckCircle size={40} className="text-green-400 mx-auto" />
                    <div>
                      <p className="font-bold text-white text-lg">Работа завершена!</p>
                      <p className="text-green-400 text-sm mt-1">
                        +${getJobReward(selectedJob?.reward || 0)} | +{getJobExp(selectedJob?.expReward || 0)} exp
                      </p>
                    </div>
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
