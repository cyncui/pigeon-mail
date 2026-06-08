export type PostcardData = {
  id: string;
  imageUri: string;
  date: string;
  location: string;
};

/**
 * Placeholder feed data so the home screen has something to render.
 * Swap this module for a Supabase query when the backend lands — the rest of
 * the app only depends on `POSTCARDS` and the `PostcardData` shape.
 */
export const POSTCARDS: PostcardData[] = [
  {
    id: '1',
    imageUri: 'https://picsum.photos/seed/pigeon-tokyo/1000/667',
    date: 'May 2, 2026',
    location: 'Tokyo, Japan',
  },
  {
    id: '2',
    imageUri: 'https://picsum.photos/seed/pigeon-vancouver/1000/667',
    date: 'June 13, 2025',
    location: 'Vancouver, Canada',
  },
  {
    id: '3',
    imageUri: 'https://picsum.photos/seed/pigeon-lisbon/1000/667',
    date: 'Aug 9, 2025',
    location: 'Lisbon, Portugal',
  },
  {
    id: '4',
    imageUri: 'https://picsum.photos/seed/pigeon-queenstown/1000/667',
    date: 'Oct 21, 2025',
    location: 'Queenstown, New Zealand',
  },
];
