import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CreateButton } from '@/components/create-button';
import { Postcard } from '@/components/postcard';
import { Brand, Fonts, Spacing } from '@/constants/theme';
import { POSTCARDS } from '@/lib/postcards';

const FAB_SIZE = 56;
const FAB_MARGIN = Spacing.four;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = screenWidth - Spacing.four * 2;
  const router = useRouter();

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + Spacing.five,
            paddingBottom: insets.bottom + FAB_SIZE + Spacing.six,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Pigeon Mail</Text>
        {POSTCARDS.map((postcard) => (
          <Postcard key={postcard.id} postcard={postcard} width={cardWidth} />
        ))}
      </ScrollView>

      <CreateButton
        size={FAB_SIZE}
        onPress={() => router.push('/create')}
        style={{ right: FAB_MARGIN, bottom: insets.bottom + FAB_MARGIN }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Brand.cream,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.four,
  },
  title: {
    fontFamily: Fonts.serifItalic,
    fontSize: 30,
    lineHeight: 38,
    color: Brand.brown,
    textAlign: 'center',
    marginBottom: Spacing.five,
  },
});
