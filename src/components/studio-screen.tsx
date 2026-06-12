import { useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  ReduceMotion,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GrainSlider } from '@/components/grain-slider';
import { IslandCamera, type CapturedPhoto, type FromRect, type IslandCameraHandle } from '@/components/island-camera';
import { PostcardBack, type RegionRect, type WritingRegion } from '@/components/postcard-back';
import { Postmark, postmarkForToday } from '@/components/postmark';
import { PrintFlight, type Rect } from '@/components/print-flight';
import { STAMP_BORDER, StampFrame } from '@/components/stamp-frame';
import { StampTray, TRAY_STAMP_WIDTH, type DropRect } from '@/components/stamp-tray';
import { TreatedPhoto } from '@/components/treated-photo';
import { Brand, Fonts, Spacing } from '@/constants/theme';
import { useLeanIn } from '@/hooks/use-lean-in';
import { EMPTY_ADDRESS, isAddressComplete } from '@/lib/address';
import { hapticError, hapticHeavy, hapticMedium, hapticSoft } from '@/lib/haptics';
import { useModal } from '@/lib/modal-context';
import { EASE_OUT } from '@/lib/motion';
import { persistImage } from '@/lib/persist-image';
import { sendPostcard } from '@/lib/send-postcard';
import { addSent } from '@/lib/sent-postcards';
import { randomTilt } from '@/lib/tilt';
import { DEFAULT_TREATMENT, MAX_GRAIN, TREATMENTS } from '@/lib/treatments';

type PickedImage = { uri: string; width: number; height: number };
type Side = 'front' | 'back';

const FLIP = { duration: 520, easing: Easing.inOut(Easing.ease) };
// Vertical space reserved under the card for the controls + send button.
const CONTROLS_RESERVE = 150;

// How far the card leans toward your pen per writing region.
const LEAN_SCALE: Record<WritingRegion, number> = {
  dateline: 1.2,
  message: 1.15,
  recipient: 1.45,
  sender: 1.5,
};

/** Largest card width whose stamp frame still fits in maxW × maxH for the given photo ratio. */
function fitCardWidth(aspectRatio: number, maxW: number, maxH: number, border = STAMP_BORDER) {
  const heightAtMaxW = (maxW - border * 2) / aspectRatio + border * 2;
  if (heightAtMaxW <= maxH) return maxW;
  return (maxH - border * 2) * aspectRatio + border * 2;
}

export default function StudioScreen() {
  const { closing, requestClose } = useModal();
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();

  const [image, setImage] = useState<PickedImage | null>(null);
  const [treatmentKey, setTreatmentKey] = useState(DEFAULT_TREATMENT.key);
  const [grain, setGrain] = useState(0);
  const [side, setSide] = useState<Side>('front');
  const [message, setMessage] = useState('');
  const [recipient, setRecipient] = useState(EMPTY_ADDRESS);
  const [sender, setSender] = useState(EMPTY_ADDRESS);
  const [caption, setCaption] = useState('');
  const [writing, setWriting] = useState<WritingRegion | null>(null);
  const [cameraExpanded, setCameraExpanded] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [flight, setFlight] = useState<{ uri: string; from: Rect; to: Rect } | null>(null);
  const pendingFrom = useRef<FromRect | null>(null);
  const cameraRef = useRef<IslandCameraHandle>(null);
  const [tilt] = useState(() => randomTilt());

  // The stamp IS the send: idle → affixed (flying) → error (came back).
  const [sendPhase, setSendPhase] = useState<'idle' | 'affixed' | 'error'>('idle');
  const [sent, setSent] = useState<boolean | null>(null);
  const [flightDone, setFlightDone] = useState(false);
  const [affixRotation, setAffixRotation] = useState(0);

  const flip = useSharedValue(0);
  const treatment = TREATMENTS.find((t) => t.key === treatmentKey) ?? DEFAULT_TREATMENT;
  const canSend =
    !!image && message.trim().length > 0 && isAddressComplete(recipient) && isAddressComplete(sender);
  const missing: string[] = [];
  if (!message.trim()) missing.push('a note');
  if (!isAddressComplete(recipient)) missing.push('a recipient');
  if (!isAddressComplete(sender)) missing.push('your address');

  // The photo's orientation drives the postcard's orientation; the back matches it.
  const aspectRatio = image ? image.width / image.height : 3 / 2;
  const maxW = Math.min(screenW - Spacing.four * 2, 520);
  const maxH = screenH - (insets.top + 24) - (insets.bottom + CONTROLS_RESERVE);
  const cardWidth = fitCardWidth(aspectRatio, maxW, maxH);
  const cardHeight = (cardWidth - STAMP_BORDER * 2) / aspectRatio + STAMP_BORDER * 2;

  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1200 }, { rotateY: `${flip.value * 180}deg` }],
  }));
  const backStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1200 }, { rotateY: `${flip.value * 180 + 180}deg` }],
  }));

  // Card materializes (scale + fade, staggered after the backdrop) and reverses
  // on dismiss via the shared `closing` value. `cardVisible` hides it under the
  // print flight; `squash` is the platen-press beat when a photo or stamp lands.
  const reduceMotion = useReducedMotion();
  const enter = useSharedValue(0);
  const cardVisible = useSharedValue(1);
  const squash = useSharedValue(1);
  useEffect(() => {
    enter.value = withDelay(
      reduceMotion ? 0 : 60,
      withTiming(1, { duration: reduceMotion ? 120 : 340, easing: EASE_OUT }),
    );
  }, [enter, reduceMotion]);
  const cardAnim = useAnimatedStyle(() => ({
    opacity: enter.value * (1 - closing.value) * cardVisible.value,
    transform: [
      { scale: (reduceMotion ? 1 : 0.94 + (enter.value - closing.value) * 0.06) * squash.value },
    ],
  }));
  const controlsExit = useAnimatedStyle(() => ({ opacity: 1 - closing.value }));

  // Lean-in zoom: writing on the card pulls it toward you and squares it up.
  const leanIn = useLeanIn(tilt);
  const anchorRef = useRef<View>(null);
  const releaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function handleRegionFocus(region: WritingRegion, rect: RegionRect) {
    if (releaseTimer.current) clearTimeout(releaseTimer.current);
    setWriting(region);
    anchorRef.current?.measureInWindow((x, y, w, h) => {
      leanIn.focusOn(rect, { x: x + w / 2, y: y + h / 2 }, LEAN_SCALE[region]);
    });
  }
  function handleRegionBlur() {
    if (releaseTimer.current) clearTimeout(releaseTimer.current);
    // A blur followed by a sibling-region focus is a hand-off, not an exit.
    releaseTimer.current = setTimeout(() => {
      setWriting(null);
      leanIn.release();
      // The card glides back to rest — re-aim the stamp's drop target after.
      scheduleBoxMeasure(420);
    }, 90);
  }

  // ---- Stamp drop target: the dashed box, measured in window coords. ----
  const stampBoxRef = useRef<View>(null);
  const dropRect = useSharedValue<DropRect | null>(null);
  const stampHover = useSharedValue(0);
  const measureTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function scheduleBoxMeasure(delay: number) {
    if (measureTimer.current) clearTimeout(measureTimer.current);
    measureTimer.current = setTimeout(() => {
      stampBoxRef.current?.measureInWindow((x, y, w, h) => {
        // A detached/unlaid node reports zeros — a 0×0 target at the screen
        // origin would otherwise accept drops in the corner.
        if (w > 0 && h > 0) dropRect.value = { x, y, width: w, height: h };
      });
    }, delay);
  }
  // The cancellation lands a beat after the stamp: thunk … clack.
  const postmarkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (measureTimer.current) clearTimeout(measureTimer.current);
      if (releaseTimer.current) clearTimeout(releaseTimer.current);
      if (postmarkTimer.current) clearTimeout(postmarkTimer.current);
    },
    [],
  );

  function flipTo(next: Side) {
    // Writing in progress: the first tap on the paper puts the pen down.
    if (writing) {
      Keyboard.dismiss();
      return;
    }
    setSide(next);
    flip.value = withTiming(next === 'back' ? 1 : 0, FLIP);
    if (next === 'back') scheduleBoxMeasure(FLIP.duration + 60);
    else dropRect.value = null;
  }

  // ---- The photo arrives by air: capture → flight → lands on the card. ----
  function handleCapture(photo: CapturedPhoto, from: FromRect) {
    pendingFrom.current = from;
    cardVisible.value = 0;
    setImage(photo);
  }

  // Once the card has laid out for the new photo, aim the flight at its
  // photo area (the stamp frame's inset rect, in window coordinates).
  useEffect(() => {
    if (!image || !pendingFrom.current) return;
    const from = pendingFrom.current;
    pendingFrom.current = null;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        anchorRef.current?.measureInWindow((x, y, w, h) => {
          const cx = x + w / 2;
          const cy = y + h / 2;
          setFlight({
            uri: image.uri,
            from,
            to: {
              x: cx - cardWidth / 2 + STAMP_BORDER,
              y: cy - cardHeight / 2 + STAMP_BORDER,
              width: cardWidth - STAMP_BORDER * 2,
              height: cardHeight - STAMP_BORDER * 2,
            },
          });
        });
      }),
    );
    // cardWidth/cardHeight are derived from `image` in the same render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image]);

  function handleFlightDone() {
    setFlight(null);
    hapticMedium();
    cardVisible.value = withTiming(1, { duration: 120 });
    // The platen press: a tiny squash as the print lands.
    squash.value = withSequence(
      withTiming(0.985, { duration: 90 }),
      withTiming(1, { duration: 160, easing: EASE_OUT }),
    );
  }

  // ---- The send: stamp snaps in → card holds a beat, lifts, and flies. ----
  const lift = useSharedValue(0);
  const flyOff = useSharedValue(0);

  // The pigeon couldn't take off: bring the card back down, half-apologize.
  function failSend() {
    setSendPhase('error');
    hapticError();
    lift.value = withTiming(0, { duration: 200 });
    flyOff.value = withSpring(0, { damping: 14, stiffness: 120 });
  }

  async function runSend() {
    if (!image) return;
    setSent(null);
    const draft = {
      imageUri: image.uri,
      message,
      recipient,
      sender,
      location: caption.trim(),
      treatmentKey,
      grain,
    };
    const result = await sendPostcard(draft);
    if (!result.ok) {
      failSend();
      return;
    }
    try {
      // Bake the previewed look into the stored image so the desk (and the
      // eventual print) shows exactly what was designed.
      const imageUri = await persistImage(draft.imageUri, result.id, {
        treatment,
        grain: draft.grain * MAX_GRAIN,
      });
      await addSent({ ...draft, id: result.id, imageUri, sentAt: result.sentAt });
      setSent(true);
    } catch {
      failSend();
    }
  }

  function startSendFlight() {
    setFlightDone(false);
    if (reduceMotion) {
      lift.value = 0;
      flyOff.value = withDelay(350, withTiming(1, { duration: 160 }, (finished) => {
        if (finished) runOnJS(setFlightDone)(true);
      }));
      return;
    }
    lift.value = withDelay(350, withTiming(1, { duration: 180, easing: EASE_OUT }));
    flyOff.value = withDelay(
      530,
      withTiming(1, { duration: 620, easing: Easing.in(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(setFlightDone)(true);
      }),
    );
  }

  function handleAffix(rotation: number) {
    // A double-fired drop/tap must never send twice.
    if (sendPhase !== 'idle') return;
    setAffixRotation(rotation);
    setSendPhase('affixed');
    hapticHeavy();
    squash.value = withSequence(withTiming(0.99, { duration: 120 }), withTiming(1, { duration: 180 }));
    postmarkTimer.current = setTimeout(hapticMedium, 320);
    void runSend();
    startSendFlight();
  }

  function retrySend() {
    if (sendPhase !== 'error') return;
    setSendPhase('affixed');
    void runSend();
    startSendFlight();
  }

  // The card leaves only once both the flight has played AND the send landed.
  useEffect(() => {
    if (sendPhase === 'affixed' && sent === true && flightDone) requestClose();
  }, [sendPhase, sent, flightDone, requestClose]);

  const flyStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -screenH * 1.2 * flyOff.value },
      { rotate: `${6 * flyOff.value}deg` },
      { scale: 1 + 0.03 * lift.value - 0.2 * flyOff.value },
    ],
  }));

  // The user's photo, miniaturized into an actual postage stamp.
  function renderMiniStamp(width: number) {
    if (!image) return null;
    return (
      <StampFrame
        imageUri={image.uri}
        width={width}
        aspectRatio={0.78}
        border={width > 44 ? 6 : 4}
        perfPitch={width > 44 ? 9 : 8}
        perfRadius={width > 44 ? 3 : 2.5}
        renderPhoto={({ width: w, height: h }) => (
          <TreatedPhoto uri={image.uri} width={w} height={h} treatment={treatment} grain={grain * MAX_GRAIN} />
        )}
      />
    );
  }

  return (
    <View style={styles.root}>
      {/* Tap anywhere outside to leave. With a card in progress, an expanded
          camera tucks away first (protecting the draft from an accidental
          dismiss); with nothing made yet, one tap closes everything together. */}
      <Pressable
        style={StyleSheet.absoluteFill}
        accessibilityRole="button"
        accessibilityLabel={cameraExpanded && image ? 'Close the camera' : 'Close'}
        onPress={() => {
          if (cameraExpanded && image) {
            cameraRef.current?.collapse();
            return;
          }
          if (cameraExpanded) {
            setLeaving(true);
            cameraRef.current?.collapse();
          }
          requestClose();
        }}
      />

      <View
        style={[styles.content, { paddingTop: insets.top + Spacing.two, paddingBottom: insets.bottom }]}
        pointerEvents="box-none"
      >
        <View style={styles.stage} pointerEvents="box-none">
          {/* No empty placeholder card — the viewfinder is the hero until a
              photo prints, then the card materializes beneath the flight. */}
          <View ref={anchorRef} collapsable={false}>
            {image ? (
              <Animated.View style={flyStyle}>
                <Animated.View style={leanIn.style}>
                <Animated.View style={[{ width: cardWidth, height: cardHeight }, cardAnim]}>
                  <Animated.View style={[styles.face, frontStyle]} pointerEvents={side === 'front' ? 'auto' : 'none'}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Flip postcard"
                      onPress={() => flipTo('back')}
                    >
                      <StampFrame
                        imageUri={image.uri}
                        width={cardWidth}
                        aspectRatio={aspectRatio}
                        renderPhoto={({ width, height }) => (
                          <TreatedPhoto
                            uri={image.uri}
                            width={width}
                            height={height}
                            treatment={treatment}
                            grain={grain * MAX_GRAIN}
                          />
                        )}
                      />
                    </Pressable>
                  </Animated.View>

                  <Animated.View style={[styles.face, backStyle]} pointerEvents={side === 'back' ? 'box-none' : 'none'}>
                    <Pressable
                      style={StyleSheet.absoluteFill}
                      accessibilityRole="button"
                      accessibilityLabel="Flip postcard"
                      onPress={() => flipTo('front')}
                    />
                    <PostcardBack
                      width={cardWidth}
                      height={cardHeight}
                      dateline={caption}
                      onChangeDateline={setCaption}
                      message={message}
                      onChangeMessage={setMessage}
                      recipient={recipient}
                      sender={sender}
                      onChangeRecipient={setRecipient}
                      onChangeSender={setSender}
                      onRegionFocus={handleRegionFocus}
                      onRegionBlur={handleRegionBlur}
                      stampBoxRef={stampBoxRef}
                      stampHover={stampHover}
                      affixedStamp={
                        sendPhase !== 'idle' ? (
                          <View style={{ transform: [{ rotate: `${affixRotation}deg` }] }}>
                            {renderMiniStamp(34)}
                          </View>
                        ) : undefined
                      }
                      onStampPress={sendPhase === 'error' ? retrySend : undefined}
                      boxHint={image && missing.length ? `needs ${missing.join(' · ')}` : undefined}
                      postmark={
                        sendPhase !== 'idle' ? (
                          <Postmark
                            mark={postmarkForToday(caption)}
                            animateIn
                            pressDelay={200}
                            reduceMotion={reduceMotion}
                          />
                        ) : undefined
                      }
                    />
                  </Animated.View>
                </Animated.View>
                </Animated.View>
              </Animated.View>
            ) : null}
          </View>
        </View>

        <Animated.View style={[styles.controls, controlsExit]} pointerEvents="box-none">
          {side === 'front' && image && !writing ? (
            <Animated.View
              entering={FadeIn.duration(300).reduceMotion(ReduceMotion.System)}
              style={styles.controlsInner}
            >
              <View style={styles.pills}>
                {TREATMENTS.map((t) => {
                  const active = t.key === treatmentKey;
                  return (
                    <Pressable
                      key={t.key}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      hitSlop={{ top: 4, bottom: 4 }}
                      onPress={() => {
                        if (t.key !== treatmentKey) hapticSoft();
                        setTreatmentKey(t.key);
                      }}
                      style={({ pressed }) => [
                        styles.pill,
                        active && styles.pillActive,
                        pressed && { transform: [{ scale: 0.96 }] },
                      ]}
                    >
                      <Text style={[styles.pillText, active && styles.pillTextActive]}>{t.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <GrainSlider value={grain} onChange={setGrain} />
            </Animated.View>
          ) : null}

          {sendPhase === 'error' ? (
            <Text style={styles.errorNote}>
              the pigeon couldn’t take off — tap the stamp to try again
            </Text>
          ) : null}
        </Animated.View>
      </View>

      <IslandCamera
        ref={cameraRef}
        autoBloom={!image}
        hidden={side === 'back' || writing !== null || leaving}
        onExpandedChange={setCameraExpanded}
        onCapture={handleCapture}
      />

      {flight ? (
        <PrintFlight
          uri={flight.uri}
          from={flight.from}
          to={flight.to}
          rotation={tilt}
          onDone={handleFlightDone}
        />
      ) : null}

      <StampTray
        visible={!!image}
        armed={canSend}
        hidden={writing !== null || cameraExpanded || !!flight}
        hint={missing.join(', ')}
        dropRect={dropRect}
        hover={stampHover}
        affixed={sendPhase !== 'idle'}
        onGrab={() => {
          if (side === 'front') flipTo('back');
        }}
        onAffix={handleAffix}
      >
        {renderMiniStamp(TRAY_STAMP_WIDTH)}
      </StampTray>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.four,
  },
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  face: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backfaceVisibility: 'hidden',
  },
  controls: {
    gap: Spacing.three,
  },
  controlsInner: {
    gap: Spacing.three,
  },
  pills: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  pill: {
    height: 34,
    paddingHorizontal: Spacing.three,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Brand.cream20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: {
    backgroundColor: Brand.cream12,
    borderColor: Brand.cream60,
  },
  pillText: {
    fontFamily: Fonts.caption,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: Brand.cream60,
  },
  pillTextActive: {
    color: Brand.cream,
  },
  errorNote: {
    fontFamily: Fonts.caption,
    fontSize: 11,
    letterSpacing: 0.4,
    color: Brand.cream60,
    textAlign: 'center',
    transform: [{ rotate: '-0.5deg' }],
  },
});
