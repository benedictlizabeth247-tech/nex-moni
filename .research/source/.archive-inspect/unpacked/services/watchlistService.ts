'use client';

/**
 * @fileOverview Watchlist persistence.
 *
 * Stores canonical market asset ids (e.g. `crypto.BTCUSDT`, `stock.AAPL`) so the
 * live market backend can quote them directly. Legacy bare symbols persisted by
 * earlier builds are migrated on read.
 *
 * Namespaced per authenticated user (falls back to a `guest` bucket when no
 * session exists yet) so one device never mixes one account's recommended /
 * recently explored markets into another's.
 */

const WATCHLIST_KEY = 'nexmonie_watchlist';

/** Sensible starter list spanning both provider families (crypto + stocks). */
export const DEFAULT_WATCHLIST = ['crypto.BTCUSDT', 'crypto.ETHUSDT', 'stock.AAPL'];

/** Maps legacy stored values onto canonical asset ids. */
const LEGACY_MAP: Record<string, string> = {
  BTC: 'crypto.BTCUSDT',
  ETH: 'crypto.ETHUSDT',
  SOL: 'crypto.SOLUSDT',
  USDT: 'crypto.BTCUSDT',
  GOLD: 'commodity.GC=F',
  MTNN: 'stock.AAPL',
};

const normalize = (value: string): string => {
  if (!value) return '';
  if (value.includes('.')) return value;
  return LEGACY_MAP[value.toUpperCase()] ?? `stock.${value.toUpperCase()}`;
};

const dedupe = (ids: string[]): string[] => Array.from(new Set(ids.filter(Boolean)));

/** Storage key is namespaced per user so favorites never leak between accounts. */
const storageKey = (userId?: string | null): string =>
  userId ? `${WATCHLIST_KEY}:${userId}` : `${WATCHLIST_KEY}:guest`;

const persist = (ids: string[], userId?: string | null): string[] => {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(storageKey(userId), JSON.stringify(ids));
      window.dispatchEvent(new CustomEvent('nexmonie:watchlist', { detail: ids }));
    } catch {
      /* storage unavailable (private mode / quota) — keep in-memory only */
    }
  }
  return ids;
};

export const getWatchlist = (userId?: string | null): string[] => {
  if (typeof window === 'undefined') return DEFAULT_WATCHLIST;
  try {
    const stored = localStorage.getItem(storageKey(userId));
    if (!stored) return DEFAULT_WATCHLIST;
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return DEFAULT_WATCHLIST;
    return dedupe(parsed.map((v) => normalize(String(v))));
  } catch {
    return DEFAULT_WATCHLIST;
  }
};

/** Adds or removes an asset and returns the resulting list. */
export const toggleWatchlist = (assetId: string, userId?: string | null): string[] => {
  const id = normalize(assetId);
  const current = getWatchlist(userId);
  const next = current.includes(id) ? current.filter((v) => v !== id) : [...current, id];
  return persist(dedupe(next), userId);
};

export const addToWatchlist = (assetId: string, userId?: string | null): string[] =>
  persist(dedupe([...getWatchlist(userId), normalize(assetId)]), userId);

export const removeFromWatchlist = (assetId: string, userId?: string | null): string[] =>
  persist(getWatchlist(userId).filter((v) => v !== normalize(assetId)), userId);

export const isWatched = (assetId: string, userId?: string | null): boolean =>
  getWatchlist(userId).includes(normalize(assetId));
