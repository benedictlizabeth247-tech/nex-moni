"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Search, Star, TrendingUp, TrendingDown } from "lucide-react";

import { useUser } from "@/supabase";
import { useLiveQuotes, useMarketBoard, useMarketSearch } from "@/hooks/use-market-data";
import { addToWatchlist, getWatchlist, toggleWatchlist } from "@/services/watchlistService";
import { formatQuotePrice, formatPercent } from "@/lib/market-format";
import { CATEGORY_LABEL } from "@/services/market-data/types"
import { AssetAvatar } from "@/components/markets/AssetAvatar";

// Brand Color Palette Mapping:
// Primary Teal-Green: #008D83
// Secondary Coral: #FF8882

const TABS = ["Hot", "Recommended", "Losers", "Gainers"] as const;
type Tab = (typeof TABS)[number];

const TAB_TO_BOARD: Record<Tab, "favorites" | "hot" | "gainers" | "losers"> = {
  Recommended: "favorites",
  Hot: "hot",
  Gainers: "gainers",
  Losers: "losers",
};

export default function MarketsFeed() {
  const router = useRouter();
  const { user } = useUser();
  const userId = user?.id ?? null;
  const [activeMarketTab, setActiveMarketTab] = useState<Tab>("Hot");
  const [favorites, setFavorites] = useState<string[]>(() => getWatchlist(userId));
  const [searchQuery, setSearchQuery] = useState("");
  const { results: searchResults, isSearching } = useMarketSearch(searchQuery);

  // Re-scope the watchlist (and therefore the Recommended tab) to whichever
  // account is signed in, so one device never mixes users' recent markets.
  useEffect(() => {
    setFavorites(getWatchlist(userId));
  }, [userId]);

  const isFavoritesTab = activeMarketTab === "Recommended";

  // Board (Hot / Gainers / Losers) comes from the Market Data Service.
  const board = useMarketBoard({
    tab: TAB_TO_BOARD[activeMarketTab],
    limit: 12,
    enabled: !isFavoritesTab,
  });

  // Favorites are user-owned ids, so they are quoted live and kept in order.
  const favoriteFeed = useLiveQuotes(favorites, { enabled: isFavoritesTab });

  const rows = isFavoritesTab ? favoriteFeed.list : board.quotes;
  const isLoading = isFavoritesTab ? favoriteFeed.isLoading : board.isLoading;
  const isDegraded = isFavoritesTab
    ? Boolean(favoriteFeed.error) || favoriteFeed.isOffline
    : board.isDegraded;

  const favoriteSet = useMemo(() => new Set(favorites), [favorites]);

  const handleToggleFavorite = (id: string) => {
    setFavorites(toggleWatchlist(id, userId));
  };

  // Selecting a search result adds it to the user's Recommended markets (the
  // same watchlist that backs the Recommended tab) before opening the asset.
  const handleSelectResult = (id: string) => {
    setFavorites(addToWatchlist(id, userId));
    setSearchQuery("");
    openAsset(id);
  };

  const openAsset = (id: string) => router.push(`/markets/${encodeURIComponent(id)}`);

  return (
    <div className="px-2 sm:px-4 lg:px-6 mb-8 sm:mb-10 min-w-0">
      <div className="bg-card text-card-foreground rounded-2xl sm:rounded-[32px] p-3 sm:p-5 lg:p-8 border border-border shadow-nex-soft w-full min-w-0">
        <div className="flex justify-between items-center mb-4 px-1">
          <h3 className="text-sm font-bold text-foreground uppercase tracking-widest">Markets</h3>
          <span
            onClick={() => router.push("/markets")}
            className="text-[10px] font-bold text-primary hover:underline cursor-pointer flex items-center gap-0.5"
          >
            Market Overview <ChevronRight className="w-3 h-3" />
          </span>
        </div>

        {/* Market search — sits directly under the "Markets" heading, above the tabs. */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search markets, coins, stocks, pairs..."
            aria-label="Search markets"
            className="w-full h-10 rounded-xl bg-muted border border-border pl-9 pr-3 text-[11px] font-medium text-foreground outline-none focus:border-primary"
          />
          {searchQuery.trim() && (
            <div className="absolute z-20 left-0 right-0 top-11 bg-card text-card-foreground rounded-2xl border border-border shadow-lg overflow-hidden max-h-72 overflow-y-auto">
              {isSearching ? (
                <p className="p-4 text-[10px] text-muted-foreground">Searching markets...</p>
              ) : searchResults.length ? (
                searchResults.map((result) => (
                  <button
                    key={result.id}
                    onClick={() => handleSelectResult(result.id)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-50 last:border-0"
                  >
                    <span>
                      <span className="block text-[11px] font-bold text-slate-800">{result.display}</span>
                      <span className="block text-[9px] text-muted-foreground">
                        {result.name}
                        {result.exchange ? ` · ${result.exchange}` : ""}
                      </span>
                    </span>
                    <span className="text-[8px] font-bold uppercase text-primary shrink-0">
                      {CATEGORY_LABEL[result.type] ?? result.type}
                    </span>
                  </button>
                ))
              ) : (
                <p className="p-4 text-[10px] text-muted-foreground">No markets found.</p>
              )}
            </div>
          )}
        </div>

        <div className="w-full border-b border-gray-50 pb-0 mb-3">
          <div className="flex w-full gap-0 overflow-x-auto scrollbar-hide">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveMarketTab(tab)}
                className={`flex-1 text-center text-[11px] font-bold pb-2 transition-all whitespace-nowrap ${
                  activeMarketTab === tab
                    ? "text-foreground border-b-2 border-primary"
                    : "text-muted-foreground border-b-2 border-transparent"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider border-b border-gray-50">
                <th className="pb-2">Trading Pairs</th>
                <th className="pb-2 text-right">Price</th>
                <th className="pb-2 text-right">24H Change</th>
                <th className="pb-2 text-right">Trade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-[11px]">
              {isLoading && !rows.length
                ? Array.from({ length: 5 }).map((_, idx) => (
                    <tr key={`skeleton-${idx}`} className="animate-pulse">
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded bg-gray-100" />
                          <div>
                            <div className="h-3 w-24 rounded bg-gray-100" />
                            <div className="h-2 w-16 rounded bg-gray-50 mt-1.5" />
                          </div>
                        </div>
                      </td>
                      <td className="py-3">
                        <div className="h-3 w-16 rounded bg-gray-100 ml-auto" />
                      </td>
                      <td className="py-3">
                        <div className="h-5 w-14 rounded-lg bg-gray-100 ml-auto" />
                      </td>
                      <td className="py-3">
                        <div className="h-3 w-10 rounded bg-gray-100 ml-auto" />
                      </td>
                    </tr>
                  ))
                : rows.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <AssetAvatar symbol={row.symbol} name={row.name} type={row.type} iconUrl={row.iconUrl} size={28} />
                          <button
                            onClick={() => handleToggleFavorite(row.id)}
                            className="text-muted-foreground hover:text-foreground"
                            aria-label={
                              favoriteSet.has(row.id)
                                ? `Remove ${row.display} from favorites`
                                : `Add ${row.display} to favorites`
                            }
                          >
                            <Star
                              className={`w-3 h-3 ${
                                favoriteSet.has(row.id) ? "fill-amber-400 text-amber-400" : ""
                              }`}
                            />
                          </button>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-foreground tabular-nums">
                                {row.display}
                              </span>
                              <span
                                className={`text-[7px] font-black px-1 rounded uppercase ${
                                  row.type === "crypto"
                                    ? "bg-teal-50 text-primary"
                                    : "bg-blue-50 text-blue-600"
                                }`}
                              >
                                {CATEGORY_LABEL[row.type]}
                              </span>
                            </div>
                            <span className="text-[9px] text-muted-foreground block mt-0.5">{row.name}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 font-bold text-foreground text-right tabular-nums">
                        {formatQuotePrice(row)}
                      </td>
                      <td className="py-3 text-right font-extrabold">
                        <span
                          className={`inline-flex items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] tabular-nums ${
                            row.changePercent >= 0
                              ? "text-primary bg-emerald-50"
                              : "text-[#FF8882] bg-rose-50"
                          }`}
                        >
                          {row.changePercent >= 0 ? (
                            <TrendingUp className="w-2.5 h-2.5" />
                          ) : (
                            <TrendingDown className="w-2.5 h-2.5" />
                          )}
                          {formatPercent(row.changePercent)}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => openAsset(row.id)}
                          className="text-[11px] font-bold text-primary hover:underline"
                        >
                          Trade
                        </button>
                      </td>
                    </tr>
                  ))}

              {!isLoading && !rows.length && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-[10px] font-bold text-muted-foreground">
                    {isFavoritesTab
                      ? "Tap the star on any market to add it here."
                      : "Market data is unavailable right now. Retrying automatically."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
