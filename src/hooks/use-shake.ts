import { Accelerometer } from 'expo-sensors';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

// A shake is a back-and-forth, not a bump: two distinct jolts (acceleration
// peaks well past gravity's resting ~1g) inside a short window. A refractory
// gap keeps one swing's sustained peak from counting twice, and a cooldown
// after firing lets the cards land before the next shake can fling them again.
const SAMPLE_MS = 32;
const JOLT_FORCE = 1.65; // total acceleration in g that counts as a jolt
const JOLT_GAP_MS = 90;
const JOLTS_TO_FIRE = 2;
const JOLT_WINDOW_MS = 650;
const COOLDOWN_MS = 1100;

/**
 * Fires `onShake` when the phone is given a deliberate shake. Subscribes to
 * the accelerometer only while `enabled`; returns whether a usable
 * accelerometer exists at all (false on web and motionless hardware), so
 * callers can decide whether to advertise the gesture.
 */
export function useShake(enabled: boolean, onShake: () => void): boolean {
  const [supported, setSupported] = useState(false);

  // The subscription effect must not re-run just because the handler closure
  // is fresh this render — read it through a ref instead.
  const handler = useRef(onShake);
  useEffect(() => {
    handler.current = onShake;
  }, [onShake]);

  useEffect(() => {
    // Web's accelerometer needs an HTTPS + user-gesture permission dance on
    // iOS Safari; the desk keeps its drag affordance there instead.
    if (Platform.OS === 'web') return;
    let cancelled = false;
    void Accelerometer.isAvailableAsync().then((ok) => {
      if (!cancelled) setSupported(ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!enabled || !supported) return;
    let jolts: number[] = [];
    let lastJolt = 0;
    let mutedUntil = 0;

    Accelerometer.setUpdateInterval(SAMPLE_MS);
    const subscription = Accelerometer.addListener(({ x, y, z }) => {
      const now = Date.now();
      if (now < mutedUntil) return;
      const force = Math.sqrt(x * x + y * y + z * z);
      if (force < JOLT_FORCE || now - lastJolt < JOLT_GAP_MS) return;
      lastJolt = now;
      jolts = [...jolts.filter((t) => now - t < JOLT_WINDOW_MS), now];
      if (jolts.length >= JOLTS_TO_FIRE) {
        jolts = [];
        mutedUntil = now + COOLDOWN_MS;
        handler.current();
      }
    });
    return () => subscription.remove();
  }, [enabled, supported]);

  return supported;
}
