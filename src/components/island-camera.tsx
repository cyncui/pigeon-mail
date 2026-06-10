import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';
import * as Linking from 'expo-linking';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand, Fonts, Spacing } from '@/constants/theme';
import { hapticLight, hapticMedium, hapticSoft } from '@/lib/haptics';
import { EASE_OUT } from '@/lib/motion';

const BLOOM_MS = 520;
const COLLAPSE_MS = 380;

export type CapturedPhoto = { uri: string; width: number; height: number };
export type FromRect = { x: number; y: number; width: number; height: number };

export type IslandCameraHandle = {
  bloom: () => void;
  collapse: () => void;
};

type Phase = 'pill' | 'live' | 'frozen';

type Props = {
  /** Fade the camera out entirely (writing side, keyboard up). */
  hidden?: boolean;
  /** Bloom out of the island as soon as the modal settles. */
  autoBloom?: boolean;
  /** True while the viewfinder is expanded (live or reviewing). */
  onExpandedChange?: (expanded: boolean) => void;
  /** The user accepted the shot — print it. fromRect = viewfinder, window coords. */
  onCapture: (photo: CapturedPhoto, fromRect: FromRect) => void;
};

/**
 * The camera lives in the Dynamic Island. A pill-shaped black capsule sits
 * exactly over the island (or top-center on hardware without one) and blooms
 * downward into a portrait viewfinder; snapping a photo freezes it for one
 * review beat, and confirming hands the still to the studio's print flight
 * while the camera tucks itself back into the island to sleep.
 *
 * The real island can't host a camera feed (Live Activities are sandboxed,
 * no video) — this is an in-app illusion, drawn to merge with the hardware.
 */
export const IslandCamera = forwardRef<IslandCameraHandle, Props>(function IslandCamera(
  { hidden, autoBloom, onExpandedChange, onCapture },
  ref,
) {
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const [permission, requestPermission] = useCameraPermissions();

  // Island devices: draw slightly oversized so the black-on-black seam
  // swallows per-model variance. Others: a visible capsule under the status bar.
  const hasIsland = Platform.OS === 'ios' && insets.top >= 59;
  const pill = hasIsland
    ? { width: 130, height: 39, top: 10 }
    : { width: 126, height: 37, top: insets.top + 8 };
  const finder = (() => {
    const width = Math.min(screenW - 96, 320);
    return { width, height: (width * 4) / 3, top: pill.top };
  })();

  const [phase, setPhase] = useState<Phase>('pill');
  const [facing, setFacing] = useState<CameraType>('back');
  const [cameraReady, setCameraReady] = useState(false);
  const [shot, setShot] = useState<CapturedPhoto | null>(null);
  const [busy, setBusy] = useState(false);

  const progress = useSharedValue(0); // 0 = pill, 1 = viewfinder
  const wake = useSharedValue(1); // pulse scale while waking
  const flash = useSharedValue(0);
  const containerRef = useRef<View>(null);
  const cameraRef = useRef<CameraView>(null);
  // One print per shot — a double-tapped checkmark must not fly two photos.
  const printed = useRef(false);
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (collapseTimer.current) clearTimeout(collapseTimer.current);
    },
    [],
  );

  const expanded = phase !== 'pill';
  useEffect(() => {
    onExpandedChange?.(expanded);
  }, [expanded, onExpandedChange]);

  function bloom() {
    if (phase !== 'pill') return;
    setCameraReady(false);
    setShot(null);
    printed.current = false;
    setPhase('live');
    hapticLight();
    progress.value = withTiming(1, { duration: reduceMotion ? 120 : BLOOM_MS, easing: EASE_OUT });
    if (!permission?.granted) void requestPermission();
  }

  function collapse() {
    if (phase === 'pill') return;
    setPhase('pill');
    setShot(null);
    progress.value = withTiming(0, { duration: reduceMotion ? 100 : COLLAPSE_MS, easing: EASE_OUT });
  }

  useImperativeHandle(ref, () => ({ bloom, collapse }));

  // Wake pulse, then auto-bloom: the island announces itself and opens.
  const autoBloomed = useRef(false);
  useEffect(() => {
    if (!autoBloom || autoBloomed.current) return;
    autoBloomed.current = true;
    if (reduceMotion) {
      const t = setTimeout(bloom, 200);
      return () => clearTimeout(t);
    }
    const pulse = setTimeout(() => {
      hapticSoft();
      wake.value = withSequence(
        withTiming(1.08, { duration: 160, easing: EASE_OUT }),
        withTiming(1, { duration: 160, easing: EASE_OUT }),
      );
    }, 80);
    const open = setTimeout(bloom, 480);
    return () => {
      clearTimeout(pulse);
      clearTimeout(open);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoBloom, reduceMotion]);

  async function snap() {
    const camera = cameraRef.current;
    if (!camera || busy) return;
    setBusy(true);
    hapticMedium();
    flash.value = withSequence(withTiming(1, { duration: 60 }), withTiming(0, { duration: 180 }));
    try {
      const photo = await camera.takePictureAsync();
      if (photo) {
        setShot({ uri: photo.uri, width: photo.width, height: photo.height });
        setPhase('frozen');
      }
    } catch {
      // Capture can fail (camera claimed by another app, mid-teardown) —
      // stay live so the user can simply try again.
    } finally {
      setBusy(false);
    }
  }

  function retake() {
    hapticLight();
    printed.current = false;
    setShot(null);
    setPhase('live');
  }

  function confirm() {
    const photo = shot;
    // One print per shot — a double-tap must not fly two photos at the card.
    if (!photo || printed.current) return;
    printed.current = true;
    containerRef.current?.measureInWindow((x, y, width, height) => {
      onCapture(photo, { x, y, width, height });
      // Tuck back into the island a beat after the photo departs.
      collapseTimer.current = setTimeout(() => {
        printed.current = false;
        collapse();
      }, 120);
    });
  }

  const containerStyle = useAnimatedStyle(() => {
    const width = interpolate(progress.value, [0, 1], [pill.width, finder.width]);
    const height = interpolate(progress.value, [0, 1], [pill.height, finder.height]);
    return {
      width,
      height,
      top: pill.top,
      left: (screenW - width) / 2,
      borderRadius: interpolate(progress.value, [0, 1], [pill.height / 2, 28]),
      transform: [{ scale: wake.value }],
      opacity: hidden ? withTiming(0, { duration: 160 }) : withTiming(1, { duration: 200 }),
    };
  });
  const feedStyle = useAnimatedStyle(() => ({
    opacity: withTiming(cameraReady ? 1 : 0, { duration: 220 }),
  }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));
  const chromeStyle = useAnimatedStyle(() => ({
    // Shutter & co. appear only once the finder is mostly open.
    opacity: interpolate(progress.value, [0.7, 1], [0, 1]),
  }));

  const denied = permission != null && !permission.granted && !permission.canAskAgain;
  const showCamera = expanded && permission?.granted;

  return (
    <Animated.View
      ref={containerRef}
      style={[styles.container, !hasIsland && styles.capsuleEdge, containerStyle]}
      pointerEvents={hidden ? 'none' : 'auto'}
    >
      {/* The pill face: tappable to (re)bloom. */}
      {phase === 'pill' ? (
        <Pressable
          style={styles.pillFace}
          accessibilityRole="button"
          accessibilityLabel="Open the camera"
          onPress={bloom}
        >
          <View style={styles.aperture} />
        </Pressable>
      ) : (
        <>
          {showCamera ? (
            <Animated.View style={[styles.feed, { width: finder.width, height: finder.height }, feedStyle]}>
              <CameraView
                ref={cameraRef}
                style={StyleSheet.absoluteFill}
                facing={facing}
                onCameraReady={() => setCameraReady(true)}
              />
              {shot ? (
                /* Frozen review: the still sits over the live feed. */
                <Animated.Image
                  source={{ uri: shot.uri }}
                  style={StyleSheet.absoluteFill}
                  accessibilityLabel="Your photo, frozen for review"
                />
              ) : null}
            </Animated.View>
          ) : (
            <View style={styles.lensCap}>
              <Text style={styles.lensCapText}>{denied ? 'Camera is off' : 'Waking the camera…'}</Text>
              {denied ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => Linking.openSettings()}
                  hitSlop={8}
                >
                  <Text style={styles.lensCapLink}>Open Settings</Text>
                </Pressable>
              ) : null}
            </View>
          )}

          <Animated.View style={[StyleSheet.absoluteFill, styles.flash, flashStyle]} pointerEvents="none" />

          <Animated.View style={[styles.chrome, chromeStyle]} pointerEvents="box-none">
            {phase === 'live' && showCamera ? (
              <>
                <Pressable
                  style={styles.flipFacing}
                  accessibilityRole="button"
                  accessibilityLabel="Flip camera"
                  hitSlop={8}
                  onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
                >
                  <Text style={styles.flipFacingText}>↺</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.shutter, pressed && { transform: [{ scale: 0.96 }] }]}
                  accessibilityRole="button"
                  accessibilityLabel="Take the photo"
                  disabled={busy || !cameraReady}
                  onPress={snap}
                >
                  <View style={styles.shutterDot} />
                </Pressable>
              </>
            ) : null}
            {phase === 'frozen' ? (
              <>
                <Pressable
                  style={styles.retake}
                  accessibilityRole="button"
                  accessibilityLabel="Retake"
                  hitSlop={8}
                  onPress={retake}
                >
                  <Text style={styles.retakeText}>Retake</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.shutter,
                    styles.confirm,
                    pressed && { transform: [{ scale: 0.96 }] },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Print this photo onto the postcard"
                  onPress={confirm}
                >
                  <Text style={styles.confirmText}>✓</Text>
                </Pressable>
              </>
            ) : null}
          </Animated.View>
        </>
      )}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    backgroundColor: '#000',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  },
  capsuleEdge: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Brand.cream12,
  },
  pillFace: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aperture: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: Brand.cream60,
  },
  feed: {
    position: 'absolute',
    alignSelf: 'center',
  },
  lensCap: {
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.four,
  },
  lensCapText: {
    fontFamily: Fonts.caption,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: Brand.cream60,
  },
  lensCapLink: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: Brand.cream,
    textDecorationLine: 'underline',
  },
  flash: {
    backgroundColor: '#fff',
  },
  chrome: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: Spacing.three,
    alignItems: 'center',
  },
  shutter: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 4,
    borderColor: Brand.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterDot: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Brand.cream,
  },
  confirm: {
    backgroundColor: Brand.cream,
  },
  confirmText: {
    fontSize: 28,
    lineHeight: 34,
    color: '#000',
  },
  flipFacing: {
    position: 'absolute',
    right: Spacing.three,
    bottom: 14,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flipFacingText: {
    fontSize: 18,
    color: Brand.cream,
  },
  retake: {
    position: 'absolute',
    left: Spacing.three,
    bottom: 20,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  retakeText: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: Brand.cream,
  },
});
