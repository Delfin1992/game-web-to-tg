import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Game from "@/pages/Game";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Game onResetGame={() => localStorage.removeItem("playerId")} />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
