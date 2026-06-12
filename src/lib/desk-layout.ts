import AsyncStorage from '@react-native-async-storage/async-storage';

import { tiltFromSeed, unitFromSeed } from '@/lib/tilt';

const KEY = 'pigeon.deskLayout.v1';

/** Where one card sits on the desk. Centers are normalized to the window
 * (cx, cy ∈ [0,1]) so layouts survive web resizes and device changes. */
export type Placement = {
  cx: number;
  cy: number;
  /** Resting rotation in degrees. */
  rot: number;
  /** Stacking order; higher = closer to the top of the pile. */
  z: number;
};

type DeskLayout = {
  version: 1;
  nextZ: number;
  cards: Record<string, Placement>;
};

const EMPTY: DeskLayout = { version: 1, nextZ: 1, cards: {} };

let cache: DeskLayout = EMPTY;
let loaded = false;
let writing = false;
let dirty = false;

export async function loadDeskLayout(): Promise<DeskLayout> {
  if (loaded) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DeskLayout;
      if (parsed.version === 1) cache = parsed;
    }
  } catch (error) {
    console.warn('Failed to load desk layout', error);
  }
  loaded = true;
  return cache;
}

/** Write-through with an in-flight coalesce guard — commits happen at gesture
 * end (~1/sec max), so a queued single rewrite is plenty. */
async function persist() {
  if (writing) {
    dirty = true;
    return;
  }
  writing = true;
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(cache));
  } catch (error) {
    console.warn('Failed to persist desk layout', error);
  } finally {
    writing = false;
    if (dirty) {
      dirty = false;
      void persist();
    }
  }
}

export function commitPlacement(id: string, placement: Placement): void {
  cache = {
    ...cache,
    // Keep the bring-to-front counter ahead of any committed z, so arrivals
    // (which use claimNextZ) always land on top of dragged cards.
    nextZ: Math.max(cache.nextZ, placement.z + 1),
    cards: { ...cache.cards, [id]: placement },
  };
  void persist();
}

/** Commit a whole desk's worth of placements in one write (shake-scatter). */
export function commitPlacements(entries: Map<string, Placement>): void {
  let nextZ = cache.nextZ;
  const cards = { ...cache.cards };
  entries.forEach((placement, id) => {
    cards[id] = placement;
    nextZ = Math.max(nextZ, placement.z + 1);
  });
  cache = { ...cache, nextZ, cards };
  void persist();
}

export function getPlacement(id: string): Placement | undefined {
  return cache.cards[id];
}

/** Synchronous bring-to-front counter; persisted with the next commit. */
export function claimNextZ(): number {
  const z = cache.nextZ;
  cache = { ...cache, nextZ: z + 1 };
  return z;
}

/** Current top-of-pile counter without claiming it. */
export function peekNextZ(): number {
  return cache.nextZ;
}

/** Tidy up: forget every placement so cards return to their seed pile. */
export async function resetDeskLayout(): Promise<void> {
  cache = { ...EMPTY };
  await persist();
}

/** Drop saved placements for cards no longer on the desk (e.g. samples after
 * the first real send). */
export function pruneTo(ids: string[]): void {
  const keep = new Set(ids);
  const pruned = Object.fromEntries(Object.entries(cache.cards).filter(([id]) => keep.has(id)));
  if (Object.keys(pruned).length !== Object.keys(cache.cards).length) {
    cache = { ...cache, cards: pruned };
    void persist();
  }
}

// ---- Pure placement helpers ----

export type DeskRect = { left: number; top: number; right: number; bottom: number };

/** Deterministic seed position for a card resting in the center pile: a small
 * scatter (±8px) and the card's signature tilt, nudged slightly above true
 * center so the FAB/tidy row doesn't crowd the pile. */
export function seedPlacement(id: string, stackIndex: number, rect: DeskRect): Placement {
  const w = rect.right - rect.left;
  const h = rect.bottom - rect.top;
  const px = rect.left + w / 2 + (unitFromSeed(id, 'x') - 0.5) * 16;
  const py = rect.top + h / 2 - 12 + (unitFromSeed(id, 'y') - 0.5) * 16;
  return {
    cx: clampUnit(toUnit(px, rect.left, rect.right)),
    cy: clampUnit(toUnit(py, rect.top, rect.bottom)),
    rot: tiltFromSeed(id),
    z: stackIndex,
  };
}

/**
 * A shake throws every card to its own patch of desk. Cards land in the cells
 * of a shuffled, jittered grid — true uniform randomness clumps badly at desk
 * counts — and pick up a rotation well past the resting tilt plus a reshuffled
 * stacking order, so the spill reads as a toss, not a layout.
 */
export function scatterPlacements(ids: string[], rect: DeskRect): Map<string, Placement> {
  const w = Math.max(1, rect.right - rect.left);
  const h = Math.max(1, rect.bottom - rect.top);
  const cols = Math.max(1, Math.round(Math.sqrt((ids.length * w) / h)));
  const rows = Math.max(1, Math.ceil(ids.length / cols));

  const cells = shuffle(Array.from({ length: cols * rows }, (_, i) => i));
  const zs = shuffle(ids.map((_, i) => i + 1));

  const out = new Map<string, Placement>();
  ids.forEach((id, i) => {
    const cell = cells[i];
    const col = cell % cols;
    const row = Math.floor(cell / cols);
    out.set(id, {
      cx: clampUnit((col + 0.5 + (Math.random() - 0.5) * 0.7) / cols),
      cy: clampUnit((row + 0.5 + (Math.random() - 0.5) * 0.7) / rows),
      rot: (Math.random() - 0.5) * 18,
      z: zs[i],
    });
  });
  return out;
}

function shuffle(values: number[]): number[] {
  for (let i = values.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }
  return values;
}

export function placementToPx(p: Placement, rect: DeskRect): { x: number; y: number } {
  return {
    x: rect.left + clampUnit(p.cx) * (rect.right - rect.left),
    y: rect.top + clampUnit(p.cy) * (rect.bottom - rect.top),
  };
}

export function pxToPlacement(x: number, y: number, rect: DeskRect): { cx: number; cy: number } {
  return {
    cx: clampUnit(toUnit(x, rect.left, rect.right)),
    cy: clampUnit(toUnit(y, rect.top, rect.bottom)),
  };
}

function toUnit(v: number, min: number, max: number): number {
  return max > min ? (v - min) / (max - min) : 0.5;
}

function clampUnit(v: number): number {
  return Math.max(0, Math.min(1, v));
}
