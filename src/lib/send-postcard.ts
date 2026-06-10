import type { Address } from '@/lib/address';

/** Everything the print-and-mail service needs to produce one postcard. */
export type PostcardDraft = {
  imageUri: string;
  message: string;
  recipient: Address; // → Lob `to`
  sender: Address; // → Lob `from`
  location: string;
  treatmentKey: string;
  grain: number;
};

export type SendResult =
  | { ok: true; id: string; sentAt: number }
  | { ok: false; error: string };

/** Flip to true to exercise the failure UX during development. */
const SIMULATE_ERRORS = false;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function makeId(): string {
  return `pc_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * STUB. Pretends to hand the card to Lob and waits a beat so the UI can show a
 * "mailing…" state. Replace the body with a `fetch` to the thin backend that
 * holds the Lob key and uploads the image — callers only depend on the
 * `PostcardDraft` / `SendResult` shapes, mirroring the "swap when the backend
 * lands" note in lib/postcards.ts.
 */
export async function sendPostcard(draft: PostcardDraft): Promise<SendResult> {
  await delay(1400 + Math.random() * 800);
  if (SIMULATE_ERRORS || !draft.imageUri) {
    return { ok: false, error: "Couldn't reach the mail service." };
  }
  return { ok: true, id: makeId(), sentAt: Date.now() };
}
