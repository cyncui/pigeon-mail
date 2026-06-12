import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

const KEY = 'pigeon.handling.v1';

/**
 * The record of being used. Every pickup is remembered, per card, forever —
 * so a card that gets returned to looks returned-to: the spine of the book
 * falling open to the page you kept reading.
 */
type Handling = { pickups: number; lastAt: number };
type HandlingMap = Record<string, Handling>;

let cache: HandlingMap = {};
let loaded = false;
let version = 0;
let writing = false;
let dirty = false;
const listeners = new Set<() => void>();

function emit() {
  version += 1;
  for (const listener of listeners) listener();
}

export async function loadHandling(): Promise<void> {
  if (loaded) return;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) cache = JSON.parse(raw) as HandlingMap;
  } catch (error) {
    console.warn('Failed to load handling', error);
  }
  loaded = true;
  emit();
}

/** Coalesced write-through, same shape as the desk layout's. */
async function persist() {
  if (writing) {
    dirty = true;
    return;
  }
  writing = true;
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(cache));
  } catch (error) {
    console.warn('Failed to persist handling', error);
  } finally {
    writing = false;
    if (dirty) {
      dirty = false;
      void persist();
    }
  }
}

/** A card was picked up to read. */
export function recordPickup(id: string): void {
  const prev = cache[id];
  cache = { ...cache, [id]: { pickups: (prev?.pickups ?? 0) + 1, lastAt: Date.now() } };
  emit();
  void persist();
}

/**
 * How worn a card looks, 0..1. Asymptotic: the first few reads mark fastest
 * (a new thing shows its first scuff loudest), and it never quite saturates.
 */
export function wearLevel(id: string): number {
  const pickups = cache[id]?.pickups ?? 0;
  return pickups === 0 ? 0 : 1 - Math.exp(-pickups / 6);
}

/** Forget handling for cards no longer on the desk. */
export function pruneHandlingTo(ids: string[]): void {
  const keep = new Set(ids);
  const pruned = Object.fromEntries(Object.entries(cache).filter(([id]) => keep.has(id)));
  if (Object.keys(pruned).length !== Object.keys(cache).length) {
    cache = pruned;
    void persist();
  }
}

// ---- React binding: a version counter that bumps on every recorded touch ----

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getVersion = () => version;

/** Re-render on any handling change; read levels with wearLevel(id). */
export function useHandlingVersion(): number {
  return useSyncExternalStore(subscribe, getVersion, getVersion);
}
