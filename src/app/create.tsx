import { useRouter } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { ModalScrim } from '@/components/modal-scrim';
import StudioScreen from '@/components/studio-screen';
import { ModalContext } from '@/lib/modal-context';
import { EASE_OUT } from '@/lib/motion';

const EASE_IN = Easing.in(Easing.quad);

/**
 * Owns the modal's backdrop and its enter/exit choreography.
 *
 * The blur (ModalScrim) is a plain, un-animated layer — putting backdrop-filter
 * inside a reanimated view promotes a compositing layer that stops it from
 * blurring the feed. The dark tint is a separate animated layer that fades in/out
 * (coordinated with the card via the shared `closing` value). We navigate back
 * only once the exit finishes, so dismiss fades + scales out instead of snapping.
 */
export default function CreateScreen() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const scrimIn = useSharedValue(0);
  const closing = useSharedValue(0);

  useEffect(() => {
    scrimIn.value = withTiming(1, { duration: reduceMotion ? 80 : 260, easing: EASE_OUT });
  }, [scrimIn, reduceMotion]);

  const requestClose = useCallback(() => {
    if (closing.value > 0) return;
    const goBack = () => router.back();
    closing.value = withTiming(1, { duration: reduceMotion ? 90 : 200, easing: EASE_IN }, (finished) => {
      if (finished) runOnJS(goBack)();
    });
  }, [closing, reduceMotion, router]);

  const tintStyle = useAnimatedStyle(() => ({ opacity: scrimIn.value * (1 - closing.value) }));

  return (
    <ModalContext.Provider value={{ closing, requestClose }}>
      <View style={styles.root}>
        <ModalScrim />
        <Animated.View style={[StyleSheet.absoluteFill, styles.tint, tintStyle]} pointerEvents="none" />
        <StudioScreen />
      </View>
    </ModalContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  tint: {
    backgroundColor: 'rgba(22, 15, 10, 0.5)',
  },
});
