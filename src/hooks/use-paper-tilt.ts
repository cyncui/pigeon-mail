import { DeviceMotion } from 'expo-sensors';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

// Paper in a hand is never gimbal-locked to the screen: as the phone tilts,
// the held card lags a few degrees behind, like it has its own tiny inertia.
// The pose at pickup is the neutral baseline, so it works lying down, at a
// desk, anywhere.
const SAMPLE_MS = 33;
const MAX_DEG = 4;
const FOLLOW = 0.22; // how much of the phone's tilt the card picks up
// Overdamped: the card should feel viscous, never springy.
const TILT_SPRING = { damping: 26, stiffness: 180 };

/**
 * Device-motion tilt for a held card. Returns an animated style (perspective +
 * rotateX/rotateY, clamped to ±4°) to wrap the card's faces with. Inert on
 * web, on hardware without a gyroscope, and while disabled — the style then
 * just sits at zero.
 */
export function usePaperTilt(enabled: boolean) {
  const rx = useSharedValue(0);
  const ry = useSharedValue(0);
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let cancelled = false;
    void DeviceMotion.isAvailableAsync().then((ok) => {
      if (!cancelled) setAvailable(ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!enabled || !available) return;
    let baseline: { beta: number; gamma: number } | null = null;

    DeviceMotion.setUpdateInterval(SAMPLE_MS);
    const subscription = DeviceMotion.addListener(({ rotation }) => {
      if (!rotation) return;
      if (!baseline) baseline = { beta: rotation.beta, gamma: rotation.gamma };
      const toDeg = 180 / Math.PI;
      const dx = (rotation.beta - baseline.beta) * toDeg * FOLLOW;
      const dy = (rotation.gamma - baseline.gamma) * toDeg * FOLLOW;
      rx.value = withSpring(clamp(-dx, -MAX_DEG, MAX_DEG), TILT_SPRING);
      ry.value = withSpring(clamp(dy, -MAX_DEG, MAX_DEG), TILT_SPRING);
    });
    return () => {
      subscription.remove();
      // Settle flat for the put-down.
      rx.value = withSpring(0, TILT_SPRING);
      ry.value = withSpring(0, TILT_SPRING);
    };
  }, [enabled, available, rx, ry]);

  return useAnimatedStyle(() => ({
    transform: [
      { perspective: 1400 },
      { rotateX: `${rx.value}deg` },
      { rotateY: `${ry.value}deg` },
    ],
  }));
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
