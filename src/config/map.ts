/**
 * Map tile configuration.
 * One basemap: MapTiler Light. Fallback: OpenStreetMap when key is missing.
 * Change provider here — all three map instances pick it up automatically.
 */

// MapTiler key (injected by Vite from .env.local)
export const MAPTILER_KEY = (import.meta as any).env?.VITE_MAPTILER_KEY as string | undefined;

// ── Active tile ───────────────────────────────────────────────────────────────
export const TILE_URL = MAPTILER_KEY
  ? `https://api.maptiler.com/maps/dataviz-light/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`
  : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

export const TILE_ATTRIBUTION = MAPTILER_KEY
  ? '&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// ── Default survey area center ────────────────────────────────────────────────
// Golden Gate Channel / San Francisco Bay — open deep water survey zone
export const DEFAULT_CENTER: [number, number] = [37.8200, -122.4500];
export const DEFAULT_ZOOM = 13;
