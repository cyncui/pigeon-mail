import { useWindowDimensions } from 'react-native';
import {
  useAnimatedKeyboard,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import type { RegionRect } from '@/components/postcard-back';
import { EASE_OUT } from '@/lib/motion';

export type LeanInControls = ReturnType<typeof useLeanIn>;

/**
 * "Leaning in to write": when a region of the card gains focus, the card
 * scales up, slides so that region sits comfortably above the keyboard, and
 * its tilt straightens — like pulling the card toward you and squaring it up.
 * The keyboard offset tracks Reanimated's animated keyboard live, so the card
 * glides with the keyboard rather than jumping. Returns the card wrapper's
 * animated style plus focusOn(region, anchor, scale) / release().
 */
export function useLeanIn(tiltDeg: number) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const keyboard = useAnimatedKeyboard();
  const reduceMotion = useReducedMotion();

  const progress = useSharedValue(0);
  const scaleTarget = useSharedValue(1);
  // Focused region's offset from the card center, in unscaled card coordinates.
  const r0x = useSharedValue(0);
  const r0y = useSharedValue(0);
  const anchorX = useSharedValue(0);
  const anchorY = useSharedValue(0);

  function focusOn(region: RegionRect, anchor: { x: number; y: number }, scale: number) {
    // Where the region center currently sits, then back out the transform the
    // card is already wearing so r0 is expressed in resting coordinates.
    const p = progress.value;
    const s1 = 1 + (scaleTarget.value - 1) * p;
    const kb = keyboard.height.value;
    const visibleH = screenH - kb;
    const r2yNow = visibleH * (kb > 0 ? 0.42 : 0.5);
    const t1x = (screenW / 2 - anchorX.value - scaleTarget.value * r0x.value) * p;
    const t1y = (r2yNow - anchorY.value - scaleTarget.value * r0y.value) * p;

    const cx = region.x + region.width / 2;
    const cy = region.y + region.height / 2;
    anchorX.value = anchor.x;
    anchorY.value = anchor.y;
    r0x.value = (cx - anchor.x - t1x) / s1;
    r0y.value = (cy - anchor.y - t1y) / s1;
    scaleTarget.value = scale;
    progress.value = withTiming(1, { duration: reduceMotion ? 120 : 320, easing: EASE_OUT });
  }

  function release() {
    progress.value = withTiming(0, { duration: reduceMotion ? 100 : 280, easing: EASE_OUT });
  }

  const style = useAnimatedStyle(() => {
    const p = progress.value;
    const kb = keyboard.height.value;
    const visibleH = screenH - kb;
    const r2x = screenW / 2;
    const r2y = visibleH * (kb > 0 ? 0.42 : 0.5);
    const s = scaleTarget.value;
    const tx = (r2x - anchorX.value - s * r0x.value) * p;
    const ty = (r2y - anchorY.value - s * r0y.value) * p;
    return {
      transform: [
        { translateX: tx },
        { translateY: ty },
        { rotate: `${tiltDeg * (1 - p)}deg` },
        { scale: 1 + (s - 1) * p },
      ],
    };
  });

  return { style, focusOn, release };
}
