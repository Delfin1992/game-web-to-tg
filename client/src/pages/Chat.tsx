import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Send, ChevronLeft } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface Message {
  id: string;
  username: string;
  content: string;
  timestamp: number;
}

interface ChatProps {
  onBack: () => void;
  username: string;
  userId: string;
}

export default function Chat({ onBack, username, userId }: ChatProps) {
  const [message, setMessage] = useState("");

  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ["/api/messages"],
    refetchInterval: 1000,
    staleTime: 0,
    gcTime: 0,
  });

  const mutation = useMutation({
    mutationFn: async (content: string) => {
      await apiRequest("POST", "/api/messages", {
        userId,
        username,
        content,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
      setMessage("");
    },
  });

  const handleSend = () => {
    if (message.trim()) {
      mutation.mutate(message.trim());
    }
  };

  return (
    <div className="min-h-screen bg-black/95 backdrop-blur-md p-4 pb-24 font-body">
      <div className="max-w-md mx-auto flex flex-col h-[calc(100vh-120px)]">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-white/50 hover:text-primary text-xs uppercase tracking-widest transition-colors"
          >
            <ChevronLeft size={18} /> Назад
          </button>
          <h1 className="text-xl font-bold text-white uppercase tracking-widest flex-1">
            Общий чат
          </h1>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${
                msg.username === username ? "items-end" : "items-start"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] text-white/40 uppercase tracking-tighter">
                  {msg.username}
                </span>
              </div>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                  msg.username === username
                    ? "bg-primary text-black rounded-tr-none"
                    : "bg-white/10 text-white rounded-tl-none"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Введите сообщение..."
            className="flex-1 bg-white/5 border border-white/10 rounded-full px-4 py-2 text-white text-sm focus:outline-none focus:border-primary/50"
          />
          <button
            onClick={handleSend}
            disabled={mutation.isPending || !message.trim()}
            className="bg-primary text-black p-2 rounded-full hover:bg-white transition-colors disabled:opacity-50"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
