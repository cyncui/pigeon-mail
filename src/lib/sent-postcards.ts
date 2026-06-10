import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import type { Address } from '@/lib/address';
import type { PostcardData } from '@/lib/postcards';

const KEY = 'pigeon.sentPostcards.v1';

/** A postcard the user has "mailed", persisted locally. */
export type SentPostcard = {
  id: string;
  /** Durable URI: file:// (native) or a data: URI (web). */
  imageUri: string;
  message: string;
  recipient: Address;
  sender: Address;
  location: string;
  treatmentKey: string;
  grain: number;
  sentAt: number;
};

let cache: SentPostcard[] = [];
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

async function write() {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(cache));
  } catch (error) {
    console.warn('Failed to persist sent postcards', error);
  }
}

export async function loadSent(): Promise<SentPostcard[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as SentPostcard[]) : [];
  } catch (error) {
    console.warn('Failed to load sent postcards', error);
    cache = [];
  }
  loaded = true;
  emit();
  return cache;
}

/** Prepend a newly sent card (newest first) and persist. */
export async function addSent(card: SentPostcard): Promise<void> {
  cache = [card, ...cache];
  emit();
  await write();
}

// ---- React binding (useSyncExternalStore — stable since cache is only ever
// reassigned, never mutated in place) ----

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!loaded) void loadSent();
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => cache;

export function useSentPostcards(): { data: SentPostcard[]; loading: boolean } {
  const data = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return { data, loading: !loaded };
}

// ---- Mapping to the shape the feed (Postcard / PostcardData) consumes ----

export function formatSentDate(ms: number): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(
    new Date(ms),
  );
}

export function toPostcardData(card: SentPostcard): PostcardData {
  return {
    id: card.id,
    imageUri: card.imageUri,
    date: formatSentDate(card.sentAt),
    location: card.location,
    message: card.message,
    recipient: card.recipient,
    sender: card.sender,
  };
}
