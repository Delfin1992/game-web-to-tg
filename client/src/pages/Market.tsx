import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface MarketProps {
  onBack: () => void;
  userId: string;
  onPurchase: (payload: { price: number; gadget?: any }) => void;
}

export default function Market({ onBack, userId, onPurchase }: MarketProps) {
  const { data: listings = [] } = useQuery<any[]>({ queryKey: ["/api/market"], refetchInterval: 5000 });
  const [bidAmount, setBidAmount] = useState<Record<string, number>>({});

  const buyMutation = useMutation({
    mutationFn: async (listingId: string) => {
      const res = await apiRequest("POST", "/api/market/buy", { listingId, buyerId: userId });
      return res.json();
    },
    onSuccess: (data, listingId) => {
      const listing = listings.find((l) => l.id === listingId);
      if (listing) onPurchase({ price: listing.price, gadget: data?.purchasedGadget });
      queryClient.invalidateQueries({ queryKey: ["/api/market"] });
      alert("Покупка успешна");
    },
    onError: async (e: any) => {
      alert((await e?.response?.text?.()) || "Не удалось купить");
    }
  });

  const bidMutation = useMutation({
    mutationFn: async ({ listingId, amount }: { listingId: string; amount: number }) => {
      await apiRequest("POST", "/api/market/bid", { listingId, bidderId: userId, amount });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/market"] });
      alert("Ставка принята");
    },
    onError: (e: any) => {
      alert(e?.message || "Не удалось сделать ставку");
    },
  });

  return (
    <div className="min-h-screen bg-black/95 text-white p-4 pb-24">
      <button onClick={onBack} className="flex items-center gap-2 text-white/60 mb-4"><ChevronLeft size={16} /> Назад</button>
      <h1 className="text-xl font-bold mb-4 uppercase">Маркет гаджетов</h1>
      <div className="space-y-3">
        {listings.length === 0 && <div className="text-white/50 text-sm">Пока нет лотов.</div>}
        {listings.map((l) => {
          const minBid = (l.currentBid ?? l.startingPrice ?? 0) + (l.minIncrement ?? 10);
          return (
          <div key={l.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-bold">{l.gadget?.name}</div>
                <div className="text-xs text-white/60">Компания: {l.companyName}</div>
                <div className="text-xs text-white/60">Качество: x{l.gadget?.quality}</div>
                <div className="text-xs text-white/60">Комиссия маркета: 8%</div>
                {l.saleType === "auction" && (
                  <>
                    <div className="text-xs text-yellow-300">Аукцион до: {new Date(l.auctionEndsAt).toLocaleString()}</div>
                    <div className="text-xs text-white/60">Текущая ставка: {l.currentBid}</div>
                    <div className="text-xs text-white/60">Мин. шаг: {l.minIncrement}</div>
                  </>
                )}
                <div className="text-xs text-white/50">{Object.entries(l.gadget?.stats || {}).map(([k,v]) => `${k}: ${v}`).join(" · ")}</div>
              </div>
              <div className="text-right">
                {l.saleType === "fixed" ? (
                  <>
                    <div className="text-primary font-bold">{l.price}</div>
                    <button
                      disabled={buyMutation.isPending}
                      onClick={() => buyMutation.mutate(l.id)}
                      className="mt-2 px-3 py-1 bg-primary text-black rounded font-bold"
                    >Купить</button>
                  </>
                ) : (
                  <>
                    <input
                      type="number"
                      value={bidAmount[l.id] ?? minBid}
                      onChange={(e) => setBidAmount((prev) => ({ ...prev, [l.id]: Number(e.target.value) }))}
                      className="w-32 bg-black/50 border border-white/20 rounded px-2 py-1"
                    />
                    <button
                      disabled={bidMutation.isPending}
                      onClick={() => bidMutation.mutate({ listingId: l.id, amount: bidAmount[l.id] ?? minBid })}
                      className="mt-2 px-3 py-1 bg-primary text-black rounded font-bold"
                    >Сделать ставку</button>
                  </>
                )}
              </div>
            </div>
          </div>
        )})}
      </div>
    </div>
  );
}
