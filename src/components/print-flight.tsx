import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { EASE_OUT } from '@/lib/motion';

export type Rect = { x: number; y: number; width: number; height: number };

type Props = {
  uri: string;
  from: Rect;
  to: Rect;
  /** The card's resting tilt — the photo settles into it as it lands. */
  rotation: number;
  onDone: () => void;
};

const FLIGHT_MS = 460;

/**
 * The freshly captured photo flies out of the viewfinder and lands on the
 * postcard — translating, scaling, and picking up the card's tilt on the way
 * down, then fading as the real (Skia-treated) card surfaces beneath it.
 */
export function PrintFlight({ uri, from, to, rotation, onDone }: Props) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(
      1,
      { duration: reduceMotion ? 140 : FLIGHT_MS, easing: EASE_OUT },
      (finished) => {
        if (finished) runOnJS(onDone)();
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      left: interpolate(p, [0, 1], [from.x, to.x]),
      top: interpolate(p, [0, 1], [from.y, to.y]),
      width: interpolate(p, [0, 1], [from.width, to.width]),
      height: interpolate(p, [0, 1], [from.height, to.height]),
      borderRadius: interpolate(p, [0, 1], [28, 1]),
      transform: [{ rotate: `${rotation * p}deg` }],
      // The real card fades in beneath during the last stretch.
      opacity: interpolate(p, [0, 0.82, 1], [1, 1, 0]),
    };
  });

  return (
    <Animated.View style={[styles.flyer, style]} pointerEvents="none">
      <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flyer: {
    position: 'absolute',
    overflow: 'hidden',
    zIndex: 60,
  },
});
