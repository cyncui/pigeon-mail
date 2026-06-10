import type { Address } from '@/lib/address';

export type PostcardData = {
  id: string;
  imageUri: string;
  date: string;
  location: string;
  /** Back-of-card content for the pickup-to-read view. */
  message?: string;
  recipient?: Address;
  sender?: Address;
};

/**
 * Placeholder feed data so the desk has something to hold before the first
 * send. Swap this module for a Supabase query when the backend lands — the
 * rest of the app only depends on `POSTCARDS` and the `PostcardData` shape.
 */
export const POSTCARDS: PostcardData[] = [
  {
    id: '1',
    imageUri: 'https://picsum.photos/seed/pigeon-tokyo/1000/667',
    date: 'May 2, 2026',
    location: 'Tokyo, Japan',
    message: 'The city hums until 4am — I finally stopped to breathe at a shrine wedged between skyscrapers.',
  },
  {
    id: '2',
    imageUri: 'https://picsum.photos/seed/pigeon-vancouver/1000/667',
    date: 'June 13, 2025',
    location: 'Vancouver, Canada',
    message: 'Mountains on one side, ocean on the other. I think I could stay forever.',
  },
  {
    id: '3',
    imageUri: 'https://picsum.photos/seed/pigeon-lisbon/1000/667',
    date: 'Aug 9, 2025',
    location: 'Lisbon, Portugal',
    message: 'Every street is a staircase and every staircase has a view. My legs have opinions.',
  },
  {
    id: '4',
    imageUri: 'https://picsum.photos/seed/pigeon-queenstown/1000/667',
    date: 'Oct 21, 2025',
    location: 'Queenstown, New Zealand',
    message: 'Jumped off a perfectly good bridge today. Would absolutely do it again.',
  },
];
