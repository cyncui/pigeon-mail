import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDecay,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { StampFrame } from '@/components/stamp-frame';
import { WearOverlay } from '@/components/wear-overlay';
import { hapticSoft } from '@/lib/haptics';
import type { PostcardData } from '@/lib/postcards';

/** px-space bounds for a card's CENTER — keeps a grabbable sliver on screen. */
export type DeskBounds = { minX: number; maxX: number; minY: number; maxY: number };

export type DeskTarget = { x: number; y: number; rot: number; z: number };

/** How a settle should feel: a tidy glide back, or a shaken-loose toss. */
export type SettleMode = 'glide' | 'toss';

type Props = {
  postcard: PostcardData;
  width: number;
  height: number;
  target: DeskTarget;
  /** Bumped when the parent wants cards to animate to `target` (tidy/shake/resize). */
  settleEpoch: number;
  /** Per-card delay for staggered settles, ms. */
  settleDelay: number;
  settleMode: SettleMode;
  bounds: DeskBounds;
  /** Desk-wide bring-to-front counter (shared across cards). */
  zCounter: { value: number };
  /** True until this card has played its arrival; starts invisible. */
  entering: boolean;
  /** Flips true when the desk is focused and the arrival should play. */
  playEntrance: boolean;
  entranceDelay: number;
  /** Hidden while the focus overlay is "holding" this card. */
  held: boolean;
  /** 0..1 — how visibly handled this card is (wearLevel). */
  wear: number;
  reduceMotion: boolean;
  onCommit: (id: string, x: number, y: number, rot: number, z: number) => void;
  onTap: (id: string, x: number, y: number, rot: number) => void;
};

const LIFT_SHADOW_IN = 160;
const SETTLE_SPRING = { damping: 14, stiffness: 240 };
const TOSS_MIN_SPEED = 250;
// Tidy glides home; a shake flings — underdamped so cards overshoot and rock
// into place like they actually slid across the desk.
const GLIDE_SPRING = { damping: 18, stiffness: 160 };
const SCATTER_SPRING = { damping: 12, stiffness: 190 };

function DeskCardInner({
  postcard,
  width,
  height,
  target,
  settleEpoch,
  settleDelay,
  settleMode,
  bounds,
  zCounter,
  entering,
  playEntrance,
  entranceDelay,
  held,
  wear,
  reduceMotion,
  onCommit,
  onTap,
}: Props) {
  const x = useSharedValue(target.x);
  const y = useSharedValue(target.y);
  const rot = useSharedValue(entering ? target.rot + 4 : target.rot);
  const z = useSharedValue(target.z);
  const lift = useSharedValue(0);
  const appear = useSharedValue(entering ? 0 : 1);
  const dropY = useSharedValue(entering ? -120 : 0);
  const settling = useSharedValue(0); // pending decay axes before commit

  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  // Arrival: spring in from above once the desk is visible again.
  const playedEntrance = useRef(false);
  useEffect(() => {
    if (!entering || !playEntrance || playedEntrance.current) return;
    playedEntrance.current = true;
    if (reduceMotion) {
      dropY.value = 0;
      rot.value = target.rot;
      appear.value = withTiming(1, { duration: 120 });
      return;
    }
    const spring = { damping: 17, stiffness: 170 };
    appear.value = withDelay(entranceDelay, withTiming(1, { duration: 160 }));
    dropY.value = withDelay(entranceDelay, withSpring(0, spring));
    rot.value = withDelay(entranceDelay, withSpring(target.rot, spring));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entering, playEntrance, entranceDelay, reduceMotion, target.rot]);

  // The thunk of new mail: the arriving card's first touch of the desk (the
  // drop spring crossing rest, not its settle) gets a soft tick.
  const landed = useSharedValue(entering ? 0 : 1);
  useAnimatedReaction(
    () => dropY.value,
    (cur, prev) => {
      if (landed.value || prev === null || prev === cur) return;
      if (prev < -2 && cur >= -2) {
        landed.value = 1;
        runOnJS(hapticSoft)();
      }
    },
  );

  // The desk has a wooden lip: a card hitting the edge — dragged into it or
  // tossed against it — ticks once per contact.
  const { minX: bMinX, maxX: bMaxX, minY: bMinY, maxY: bMaxY } = bounds;
  useAnimatedReaction(
    () => ({ x: x.value, y: y.value }),
    (cur, prev) => {
      if (prev === null) return;
      const hitX =
        (cur.x <= bMinX && prev.x > bMinX) || (cur.x >= bMaxX && prev.x < bMaxX);
      const hitY =
        (cur.y <= bMinY && prev.y > bMinY) || (cur.y >= bMaxY && prev.y < bMaxY);
      if (hitX || hitY) runOnJS(hapticSoft)();
    },
    [bMinX, bMaxX, bMinY, bMaxY],
  );

  // Tidy / shake / resize: animate to the (re)computed target. The epoch and
  // the new target land in the same commit (the desk sets both states
  // together); the ref guard keeps later target-only rebuilds (arrivals) from
  // replaying the settle.
  const lastEpoch = useRef(settleEpoch);
  useEffect(() => {
    if (settleEpoch === lastEpoch.current) return;
    lastEpoch.current = settleEpoch;
    if (reduceMotion) {
      x.value = target.x;
      y.value = target.y;
      rot.value = target.rot;
      z.value = target.z;
      return;
    }
    const spring = settleMode === 'toss' ? SCATTER_SPRING : GLIDE_SPRING;
    x.value = withDelay(settleDelay, withSpring(target.x, spring));
    y.value = withDelay(settleDelay, withSpring(target.y, spring));
    rot.value = withDelay(settleDelay, withSpring(target.rot, spring));
    z.value = target.z;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settleEpoch, target, settleDelay, settleMode, reduceMotion]);

  // The gesture worklets are memoized, so they must call stable wrappers that
  // read the freshest handlers through a ref.
  const handlers = useRef({ onCommit, onTap });
  useEffect(() => {
    handlers.current = { onCommit, onTap };
  }, [onCommit, onTap]);
  const commit = useCallback(
    (cx: number, cy: number, crot: number, cz: number) => {
      handlers.current.onCommit(postcard.id, cx, cy, crot, cz);
    },
    [postcard.id],
  );
  const tap = useCallback(
    (cx: number, cy: number, crot: number) => {
      handlers.current.onTap(postcard.id, cx, cy, crot);
    },
    [postcard.id],
  );

  const { minX, maxX, minY, maxY } = bounds;
  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .minDistance(6)
      .onBegin(() => {
        // Any touch brings the card to the top of the pile. The drag origin is
        // snapshotted here (not onStart) so translation math is correct even
        // if the activation callback is skipped in a degenerate event stream.
        zCounter.value += 1;
        z.value = zCounter.value;
        startX.value = x.value;
        startY.value = y.value;
      })
      .onStart(() => {
        lift.value = withTiming(1, { duration: LIFT_SHADOW_IN });
      })
      .onUpdate((e) => {
        x.value = Math.max(minX, Math.min(maxX, startX.value + e.translationX));
        y.value = Math.max(minY, Math.min(maxY, startY.value + e.translationY));
      })
      .onEnd((e) => {
        lift.value = withSpring(0, SETTLE_SPRING);
        const speed = Math.hypot(e.velocityX, e.velocityY);
        if (!reduceMotion && speed > TOSS_MIN_SPEED) {
          settling.value = 2;
          const onAxisDone = () => {
            'worklet';
            settling.value -= 1;
            if (settling.value === 0) runOnJS(commit)(x.value, y.value, rot.value, z.value);
          };
          x.value = withDecay(
            { velocity: e.velocityX, clamp: [minX, maxX], rubberBandEffect: true, rubberBandFactor: 0.6 },
            onAxisDone,
          );
          y.value = withDecay(
            { velocity: e.velocityY, clamp: [minY, maxY], rubberBandEffect: true, rubberBandFactor: 0.6 },
            onAxisDone,
          );
        } else {
          runOnJS(commit)(x.value, y.value, rot.value, z.value);
        }
      })
      .onFinalize((_e, success) => {
        if (!success) lift.value = withSpring(0, SETTLE_SPRING);
      });

    const tapGesture = Gesture.Tap()
      .maxDistance(8)
      .maxDuration(250)
      .onEnd((_e, success) => {
        if (success) runOnJS(tap)(x.value, y.value, rot.value);
      });

    return Gesture.Race(pan, tapGesture);
    // Gesture builders are memoized explicitly — React Compiler must not be
    // trusted to preserve builder identity across renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minX, maxX, minY, maxY, reduceMotion, commit, tap]);

  const cardStyle = useAnimatedStyle(() => ({
    zIndex: Math.round(z.value),
    opacity: appear.value * (held ? 0 : 1),
    transform: [
      { translateX: x.value - width / 2 },
      { translateY: y.value - height / 2 + dropY.value },
      { rotate: `${rot.value}deg` },
      { scale: 1 + lift.value * 0.045 },
    ],
  }));
  const restShadowStyle = useAnimatedStyle(() => ({ opacity: 1 - lift.value }));
  const liftShadowStyle = useAnimatedStyle(() => ({ opacity: lift.value }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.card, { width, height }, cardStyle]}>
        <Animated.View style={[styles.shadow, styles.shadowRest, restShadowStyle]} />
        <Animated.View style={[styles.shadow, styles.shadowLift, liftShadowStyle]} />
        <StampFrame imageUri={postcard.imageUri} width={width} />
        <WearOverlay seed={postcard.id} width={width} height={height} level={wear} />
      </Animated.View>
    </GestureDetector>
  );
}

export const DeskCard = memo(DeskCardInner);

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  // Inset so the rectangular shadow never peeks through the perforation notches.
  shadow: {
    position: 'absolute',
    top: 7,
    left: 7,
    right: 7,
    bottom: 7,
    borderRadius: 2,
  },
  shadowRest: {
    boxShadow: '0 2px 6px rgba(63, 46, 34, 0.10), 0 6px 16px rgba(63, 46, 34, 0.08)',
  },
  shadowLift: {
    boxShadow: '0 4px 10px rgba(63, 46, 34, 0.12), 0 12px 28px rgba(63, 46, 34, 0.18)',
  },
});
