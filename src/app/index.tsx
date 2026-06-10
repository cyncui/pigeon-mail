import { useRouter } from 'expo-router';

import { DeskScreen } from '@/components/desk-screen';
import { POSTCARDS } from '@/lib/postcards';
import { toPostcardData, useSentPostcards } from '@/lib/sent-postcards';

export default function HomeScreen() {
  const router = useRouter();
  const { data, loading } = useSentPostcards();

  const sent = data.map(toPostcardData);
  // Seed the desk with sample cards until the user has sent their own.
  const showSamples = !loading && sent.length === 0;
  const cards = showSamples ? POSTCARDS : sent;

  return <DeskScreen cards={cards} loading={loading} onCreate={() => router.push('/create')} />;
}
