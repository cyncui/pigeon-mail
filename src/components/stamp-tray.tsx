import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand, Fonts, Spacing } from '@/constants/theme';
import { hapticLight, hapticSoft } from '@/lib/haptics';
import { EASE_OUT } from '@/lib/motion';

export const TRAY_STAMP_WIDTH = 56;
const SLOP = 16;
const REST_ROTATION = -8;

export type DropRect = { x: number; y: number; width: number; height: number };

function insideDropZone(cx: number, cy: number, rect: DropRect): boolean {
  'worklet';
  return (
    cx > rect.x - SLOP &&
    cx < rect.x + rect.width + SLOP &&
    cy > rect.y - SLOP &&
    cy < rect.y + rect.height + SLOP
  );
}

type Props = {
  /** A photo exists — the stamp peeks from the screen edge as a tease. */
  visible: boolean;
  /** The card is complete — the stamp slides fully in, ready to drag. */
  armed: boolean;
  /** Writing/camera/sending — the tray gets out of the way entirely. */
  hidden: boolean;
  /** What's still missing, shown when an unarmed stamp is tugged. */
  hint: string;
  /** The dashed box, in window coords (null until measurable). */
  dropRect: SharedValue<DropRect | null>;
  /** Hover highlight shared with the box inside PostcardBack. */
  hover: SharedValue<number>;
  /** The stamp has been committed into the card — the tray's copy vanishes. */
  affixed: boolean;
  /** The mini stamp itself (the user's photo in a perforated frame). */
  children: ReactNode;
  /** A drag began — the studio flips the card to its back. */
  onGrab: () => void;
  /** Dropped (or tapped) onto the box; rotation = its crooked settle. */
  onAffix: (rotation: number) => void;
};

/**
 * The postage stamp that IS the send button. It waits tucked at the screen's
 * edge, slides in when the card is ready, and the user drags it onto the
 * card's dashed box — the snap is the send. Tapping it instead lets it fly
 * itself over (the accessible path). An unfinished card just gets a wiggle
 * and a pencil note about what's missing.
 */
export function StampTray({
  visible,
  armed,
  hidden,
  hint,
  dropRect,
  hover,
  affixed,
  children,
  onGrab,
  onAffix,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const [showHint, setShowHint] = useState(false);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (hintTimer.current) clearTimeout(hintTimer.current);
    },
    [],
  );

  // Resting pose: slide via `right` so the anchor is measurable from layout.
  const stampH = TRAY_STAMP_WIDTH * 1.25;
  const trayTop = insets.top + 70;
  const restRight = armed ? Spacing.three : visible ? -(TRAY_STAMP_WIDTH - 10) : -(TRAY_STAMP_WIDTH + 24);

  const slide = useSharedValue(restRight);
  useEffect(() => {
    slide.value = withTiming(restRight, { duration: 420, easing: EASE_OUT });
    if (armed) hapticSoft();
  }, [restRight, armed, slide]);

  // The stamp's resting center in window coords (for aiming the snap).
  const anchor = useSharedValue<{ x: number; y: number } | null>(null);
  useEffect(() => {
    // Where the stamp center sits once `slide` settles at the armed pose.
    anchor.value = {
      x: screenW - Spacing.three - TRAY_STAMP_WIDTH / 2,
      y: trayTop + stampH / 2,
    };
  }, [screenW, trayTop, stampH, anchor]);

  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const grab = useSharedValue(0);
  const rotation = useSharedValue(REST_ROTATION);
  const wiggle = useSharedValue(0);

  // An armed, ignored stamp leans over every so often — "drag me" without a
  // tooltip. Never while held, never once affixed.
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    if (!armed || hidden || affixed || reduceMotion) return;
    const nudge = () => {
      if (grab.value > 0.01) return;
      wiggle.value = withSequence(
        withTiming(-2.2, { duration: 90 }),
        withTiming(1.6, { duration: 120 }),
        withTiming(0, { duration: 180 }),
      );
    };
    const first = setTimeout(nudge, 5000);
    const repeat = setInterval(nudge, 9000);
    return () => {
      clearTimeout(first);
      clearInterval(repeat);
    };
  }, [armed, hidden, affixed, reduceMotion, grab, wiggle]);

  function tugDenied() {
    if (hintTimer.current) clearTimeout(hintTimer.current);
    setShowHint(true);
    hintTimer.current = setTimeout(() => setShowHint(false), 1800);
  }

  function affix(rot: number) {
    onAffix(rot);
  }

  const gesture = useMemo(() => {
    const flyTo = (target: DropRect, a: { x: number; y: number }) => {
      'worklet';
      // Crooked settle: deterministic-enough pseudo-random from the drop point.
      const rot = ((target.x + target.y) % 7) - 3.5 > 0 ? 5.5 : -5.5;
      const cx = target.x + target.width / 2;
      const cy = target.y + target.height / 2;
      const snap = { duration: 240, easing: EASE_OUT };
      grab.value = withTiming(0.72 / 1.15, snap); // grab also carries scale; settle to fit the box
      rotation.value = withTiming(rot, snap);
      tx.value = withTiming(cx - a.x, snap);
      ty.value = withTiming(cy - a.y, snap, (finished) => {
        if (finished) runOnJS(affix)(rot);
      });
    };

    const pan = Gesture.Pan()
      .minDistance(4)
      .onStart(() => {
        if (!armed) {
          wiggle.value = withSequence(
            withTiming(-6, { duration: 60 }),
            withTiming(6, { duration: 90 }),
            withTiming(0, { duration: 120 }),
          );
          runOnJS(tugDenied)();
          return;
        }
        grab.value = withTiming(1, { duration: 140 });
        rotation.value = withTiming(-2, { duration: 180 });
        runOnJS(hapticLight)();
        runOnJS(onGrab)();
      })
      .onUpdate((e) => {
        if (!armed) return;
        tx.value = e.translationX;
        ty.value = e.translationY;
        const a = anchor.value;
        const rect = dropRect.value;
        if (!a || !rect) {
          if (hover.value !== 0) hover.value = withTiming(0, { duration: 120 });
          return;
        }
        const inside = insideDropZone(a.x + e.translationX, a.y + e.translationY, rect);
        if (inside && hover.value < 0.5) {
          hover.value = withTiming(1, { duration: 140 });
          runOnJS(hapticSoft)();
        } else if (!inside && hover.value >= 0.5) {
          hover.value = withTiming(0, { duration: 140 });
        }
      })
      .onEnd((e) => {
        if (!armed) return;
        const a = anchor.value;
        const rect = dropRect.value;
        const inside =
          a && rect && insideDropZone(a.x + e.translationX, a.y + e.translationY, rect);
        hover.value = withTiming(0, { duration: 160 });
        if (inside && rect && a) {
          flyTo(rect, a);
        } else {
          const back = { damping: 16, stiffness: 220, velocity: 0 };
          tx.value = withSpring(0, { ...back, velocity: e.velocityX });
          ty.value = withSpring(0, { ...back, velocity: e.velocityY });
          grab.value = withTiming(0, { duration: 180 });
          rotation.value = withTiming(REST_ROTATION, { duration: 220 });
        }
      });

    const tap = Gesture.Tap()
      .maxDistance(8)
      .onEnd((_e, success) => {
        if (!success) return;
        if (!armed) {
          runOnJS(tugDenied)();
          return;
        }
        const a = anchor.value;
        const rect = dropRect.value;
        if (a && rect) flyTo(rect, a);
        else runOnJS(tugDenied)();
      });

    return Gesture.Race(pan, tap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [armed]);

  const trayStyle = useAnimatedStyle(() => ({
    right: slide.value,
    opacity: hidden || affixed ? withTiming(0, { duration: 140 }) : withTiming(1, { duration: 200 }),
  }));
  const stampStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { rotate: `${rotation.value + wiggle.value}deg` },
      { scale: 1 + grab.value * 0.15 },
    ],
  }));

  return (
    <Animated.View
      style={[styles.tray, { top: trayTop }, trayStyle]}
      pointerEvents={hidden || affixed ? 'none' : 'box-none'}
    >
      {showHint ? (
        <Text style={styles.hint} accessibilityLiveRegion="polite">
          finish the card first — {hint}
        </Text>
      ) : null}
      <GestureDetector gesture={gesture}>
        <Animated.View
          style={stampStyle}
          accessibilityRole="button"
          accessibilityLabel={armed ? 'Send — drag me onto the card, or tap' : 'The stamp — finish the card to send'}
        >
          <View style={styles.stampShadow}>{children}</View>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tray: {
    position: 'absolute',
    alignItems: 'flex-end',
    zIndex: 70,
  },
  hint: {
    position: 'absolute',
    right: TRAY_STAMP_WIDTH + Spacing.three,
    top: 6,
    width: 150,
    fontFamily: Fonts.caption,
    fontSize: 10,
    lineHeight: 14,
    color: Brand.cream60,
    textAlign: 'right',
    transform: [{ rotate: '-1deg' }],
  },
  stampShadow: {
    boxShadow: '0 3px 8px rgba(20, 12, 6, 0.35)',
    borderRadius: 2,
  },
});
