import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CreateButton } from '@/components/create-button';
import { Postcard } from '@/components/postcard';
import { Brand, Fonts, Spacing } from '@/constants/theme';
import { POSTCARDS } from '@/lib/postcards';

const FAB_SIZE = 56;
const FAB_MARGIN = Spacing.four;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const cardWidth = screenWidth - Spacing.four * 2;

  // Content-relative bounds of each card, keyed by id, plus the live scroll
  // offset — together they tell us whether a postcard is behind the button.
  const boundsRef = useRef<Record<string, { top: number; height: number }>>({});
  const scrollYRef = useRef(0);
  const overRef = useRef(false);
  const [overPostcard, setOverPostcard] = useState(false);

  // The button's vertical center in screen coordinates. The ScrollView fills
  // the screen, so a content point maps to screen-y as (contentY - scrollY).
  const fabCenterY = screenHeight - insets.bottom - FAB_MARGIN - FAB_SIZE / 2;

  const recompute = useCallback(
    (scrollY: number) => {
      const next = Object.values(boundsRef.current).some(({ top, height }) => {
        const screenTop = top - scrollY;
        return fabCenterY >= screenTop && fabCenterY <= screenTop + height;
      });
      if (next !== overRef.current) {
        overRef.current = next;
        setOverPostcard(next);
      }
    },
    [fabCenterY],
  );

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y;
      scrollYRef.current = y;
      recompute(y);
    },
    [recompute],
  );

  const onCardLayout = useCallback(
    (id: string, event: LayoutChangeEvent) => {
      const { y, height } = event.nativeEvent.layout;
      boundsRef.current[id] = { top: y, height };
      recompute(scrollYRef.current);
    },
    [recompute],
  );

  // Re-evaluate when measurements or screen dimensions settle, so the initial
  // color is correct before the first scroll.
  useEffect(() => {
    recompute(scrollYRef.current);
  }, [recompute]);

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + Spacing.three,
            paddingBottom: insets.bottom + FAB_SIZE + Spacing.six,
          },
        ]}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Pigeon Mail</Text>
        {POSTCARDS.map((postcard) => (
          <Postcard
            key={postcard.id}
            postcard={postcard}
            width={cardWidth}
            onLayout={(event) => onCardLayout(postcard.id, event)}
          />
        ))}
      </ScrollView>

      <CreateButton
        overPostcard={overPostcard}
        size={FAB_SIZE}
        onPress={() => {
          // TODO: open the create-postcard flow (Capture → Compose → …)
        }}
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
    fontFamily: Fonts.serif,
    fontStyle: 'italic',
    fontSize: 30,
    lineHeight: 38,
    color: Brand.brown,
    textAlign: 'center',
    marginBottom: Spacing.five,
  },
});
