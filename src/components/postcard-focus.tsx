import { useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PostcardBack } from '@/components/postcard-back';
import { Postmark, postmarkFor } from '@/components/postmark';
import { POSTCARD_ASPECT, STAMP_BORDER, StampFrame } from '@/components/stamp-frame';
import { WearOverlay } from '@/components/wear-overlay';
import { Brand, Fonts, Spacing } from '@/constants/theme';
import { usePaperTilt } from '@/hooks/use-paper-tilt';
import { EMPTY_ADDRESS } from '@/lib/address';
import { wearLevel } from '@/lib/handling';
import { EASE_OUT } from '@/lib/motion';
import type { PostcardData } from '@/lib/postcards';
import { unitFromSeed } from '@/lib/tilt';

export type FocusOrigin = { x: number; y: number; rot: number; width: number };

type Props = {
  postcard: PostcardData;
  origin: FocusOrigin;
  onClose: () => void;
  /** Bump to put the card down gracefully from outside (shake = let go). */
  closeSignal?: number;
};

/**
 * "Pick up a card to read it": the tapped desk card lifts to the center of the
 * screen at reading size over a dim scrim, tilting faintly with the hand that
 * holds it. Tap or drag sideways to turn it over; tapping the scrim (or
 * shaking — letting go) sets it back down where it was.
 */
export function PostcardFocus({ postcard, origin, onClose, closeSignal }: Props) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();

  // Reading size: as large as fits, frame-only (the caption stays on the desk).
  const maxW = Math.min(screenW - 48, 460);
  const maxH = screenH - insets.top - insets.bottom - 96;
  const widthAtMaxH = (maxH - STAMP_BORDER * 2) * POSTCARD_ASPECT + STAMP_BORDER * 2;
  const targetW = Math.min(maxW, Math.max(widthAtMaxH, 200));
  const targetH = (targetW - STAMP_BORDER * 2) / POSTCARD_ASPECT + STAMP_BORDER * 2;
  const centerX = screenW / 2;
  const centerY = (screenH + insets.top - insets.bottom) / 2;

  const progress = useSharedValue(0);
  const flip = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, { duration: reduceMotion ? 120 : 380, easing: EASE_OUT });
    // Picking a card up turns it over in the same motion — you lifted it to
    // read it. Tapping toggles back to the photo side.
    flip.value = withDelay(
      reduceMotion ? 0 : 140,
      withTiming(1, { duration: reduceMotion ? 120 : 520, easing: Easing.inOut(Easing.ease) }),
    );
  }, [progress, flip, reduceMotion]);

  function close() {
    flip.value = withTiming(0, { duration: reduceMotion ? 100 : 320, easing: EASE_OUT });
    progress.value = withTiming(
      0,
      { duration: reduceMotion ? 120 : 320, easing: EASE_OUT },
      (finished) => {
        if (finished) runOnJS(onClose)();
      },
    );
  }

  function toggleFlip() {
    // flip lives in [-1, 1]: both ±1 show the back, the sign is just which
    // way the card was turned.
    flip.value = withTiming(Math.abs(flip.value) > 0.5 ? 0 : 1, {
      duration: reduceMotion ? 120 : 520,
      easing: Easing.inOut(Easing.ease),
    });
  }

  // Shake = let go: the desk asks the card to put itself down properly.
  const lastCloseSignal = useRef(closeSignal ?? 0);
  useEffect(() => {
    if (closeSignal === undefined || closeSignal === lastCloseSignal.current) return;
    lastCloseSignal.current = closeSignal;
    close();
    // close() reads only shared values + onClose, which the signal outlives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closeSignal]);

  // Turning the card is finger-driven: drag carries it, a flick finishes it,
  // and letting go mid-turn settles to the nearer face.
  const flipStart = useSharedValue(0);
  const flipPan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-12, 12])
        .failOffsetY([-14, 14])
        .onStart(() => {
          flipStart.value = flip.value;
        })
        .onUpdate((e) => {
          const raw = flipStart.value + e.translationX / (targetW * 0.7);
          // A hair of give past flat, so the paper flexes instead of walling.
          flip.value = Math.max(-1.08, Math.min(1.08, raw));
        })
        .onEnd((e) => {
          const projected = flip.value + (e.velocityX / (targetW * 0.7)) * 0.1;
          const dest = projected > 0.5 ? 1 : projected < -0.5 ? -1 : 0;
          if (reduceMotion) {
            flip.value = withTiming(dest, { duration: 120 });
          } else {
            flip.value = withSpring(dest, { damping: 16, stiffness: 150 });
          }
        }),
    // Gesture builders are memoized explicitly (React Compiler must not be
    // trusted to preserve builder identity).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [targetW, reduceMotion],
  );

  // Paper in hand: the held card tilts a few degrees with the phone.
  const tiltStyle = usePaperTilt(!reduceMotion);

  // The stamp this card was sent with, settled at its deterministic crook.
  const stampTilt = unitFromSeed(postcard.id, 'affix') > 0.5 ? 5.5 : -5.5;

  const scrimStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(progress.value, [0, 1], [origin.x - centerX, 0]) },
      { translateY: interpolate(progress.value, [0, 1], [origin.y - centerY, 0]) },
      { rotate: `${interpolate(progress.value, [0, 1], [origin.rot, 0])}deg` },
      { scale: interpolate(progress.value, [0, 1], [origin.width / targetW, 1]) },
    ],
  }));
  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1200 }, { rotateY: `${flip.value * 180}deg` }],
  }));
  const backStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1200 }, { rotateY: `${flip.value * 180 + 180}deg` }],
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.overlay]}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel="Put the postcard down"
          onPress={close}
        />
      </Animated.View>

      <Animated.View
        style={[styles.cardWrap, { left: centerX - targetW / 2, top: centerY - targetH / 2 }, cardStyle]}
        pointerEvents="box-none"
      >
        <GestureDetector gesture={flipPan}>
          <Animated.View style={tiltStyle}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Flip postcard"
              onPress={toggleFlip}
              style={{ width: targetW, height: targetH }}
            >
              <Animated.View style={[styles.face, frontStyle]}>
                {/* Stored images already carry their baked treatment (persist-image). */}
                <StampFrame imageUri={postcard.imageUri} width={targetW} />
                <WearOverlay
                  seed={postcard.id}
                  width={targetW}
                  height={targetH}
                  level={wearLevel(postcard.id)}
                />
              </Animated.View>
              <Animated.View style={[styles.face, backStyle]}>
                <PostcardBack
                  width={targetW}
                  height={targetH}
                  dateline={postcard.location}
                  message={postcard.message ?? ''}
                  recipient={postcard.recipient ?? EMPTY_ADDRESS}
                  sender={postcard.sender ?? EMPTY_ADDRESS}
                  readOnly
                  affixedStamp={
                    <View style={{ transform: [{ rotate: `${stampTilt}deg` }] }}>
                      <StampFrame
                        imageUri={postcard.imageUri}
                        width={34}
                        aspectRatio={0.78}
                        border={4}
                        perfPitch={8}
                        perfRadius={2.5}
                      />
                    </View>
                  }
                  postmark={<Postmark mark={postmarkFor(postcard.date, postcard.location)} />}
                />
              </Animated.View>
            </Pressable>
          </Animated.View>
        </GestureDetector>
        {/* The caption lives here now — on the desk the piles kept jumbling it. */}
        <Animated.View style={scrimStyle} pointerEvents="none">
          <Text style={styles.caption}>
            {postcard.location ? `${postcard.date} in ${postcard.location}` : postcard.date}
          </Text>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Above every desk card's animated zIndex and the furniture layer.
  overlay: {
    zIndex: 1000000,
  },
  scrim: {
    backgroundColor: 'rgba(22, 15, 10, 0.28)',
  },
  cardWrap: {
    position: 'absolute',
  },
  face: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backfaceVisibility: 'hidden',
  },
  caption: {
    fontFamily: Fonts.caption,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: Brand.cream60,
    textAlign: 'center',
    marginTop: Spacing.three,
  },
});
