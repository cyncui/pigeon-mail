import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CreateDrawer } from '@/components/create-drawer';
import { GrainSlider } from '@/components/grain-slider';
import { PostcardBack } from '@/components/postcard-back';
import { StampFrame } from '@/components/stamp-frame';
import { TreatedPhoto } from '@/components/treated-photo';
import { Brand, Fonts, Spacing } from '@/constants/theme';
import { useModal } from '@/lib/modal-context';
import { randomTilt } from '@/lib/tilt';
import { DEFAULT_TREATMENT, MAX_GRAIN, TREATMENTS } from '@/lib/treatments';

type PickedImage = { uri: string; width: number; height: number };
type Side = 'front' | 'back';

// Keep in sync with StampFrame's paper margin so the card fits the stage exactly.
const STAMP_BORDER = 18;
const FLIP = { duration: 520, easing: Easing.inOut(Easing.ease) };

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
  const [sourceOpen, setSourceOpen] = useState(false);
  const [treatmentKey, setTreatmentKey] = useState(DEFAULT_TREATMENT.key);
  const [grain, setGrain] = useState(0);
  const [side, setSide] = useState<Side>('front');
  const [message, setMessage] = useState('');
  const [recipient, setRecipient] = useState('');
  const [sender, setSender] = useState('');
  const [tilt] = useState(() => randomTilt());

  const flip = useSharedValue(0);
  const treatment = TREATMENTS.find((t) => t.key === treatmentKey) ?? DEFAULT_TREATMENT;

  // The photo's orientation drives the postcard's orientation; the back matches it.
  const aspectRatio = image ? image.width / image.height : 3 / 2;
  const maxW = Math.min(screenW - Spacing.four * 2, 520);
  const maxH = screenH - (insets.top + 24) - (insets.bottom + 108);
  const cardWidth = fitCardWidth(aspectRatio, maxW, maxH);
  const cardHeight = (cardWidth - STAMP_BORDER * 2) / aspectRatio + STAMP_BORDER * 2;

  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1200 }, { rotateY: `${flip.value * 180}deg` }],
  }));
  const backStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1200 }, { rotateY: `${flip.value * 180 + 180}deg` }],
  }));

  // Card materializes (scale + fade, staggered after the backdrop) and reverses
  // on dismiss via the shared `closing` value.
  const reduceMotion = useReducedMotion();
  const enter = useSharedValue(0);
  useEffect(() => {
    enter.value = withDelay(
      reduceMotion ? 0 : 60,
      withTiming(1, { duration: reduceMotion ? 120 : 340, easing: Easing.bezier(0.16, 1, 0.3, 1) }),
    );
  }, [enter, reduceMotion]);
  const cardAnim = useAnimatedStyle(() => ({
    opacity: enter.value * (1 - closing.value),
    transform: [{ scale: reduceMotion ? 1 : 0.94 + (enter.value - closing.value) * 0.06 }],
  }));
  const controlsExit = useAnimatedStyle(() => ({ opacity: 1 - closing.value }));

  function flipTo(next: Side) {
    setSide(next);
    flip.value = withTiming(next === 'back' ? 1 : 0, FLIP);
  }

  function applyResult(result: ImagePicker.ImagePickerResult) {
    setSourceOpen(false);
    if (result.canceled) return;
    const asset = result.assets[0];
    if (asset) setImage({ uri: asset.uri, width: asset.width, height: asset.height });
  }

  async function chooseFromLibrary() {
    applyResult(await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 }));
  }

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setSourceOpen(false);
      return;
    }
    applyResult(await ImagePicker.launchCameraAsync({ quality: 1 }));
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Tap anywhere outside the card/controls to dismiss. */}
      <Pressable
        style={StyleSheet.absoluteFill}
        accessibilityRole="button"
        accessibilityLabel="Close"
        onPress={requestClose}
      />

      <View
        style={[styles.content, { paddingTop: insets.top + Spacing.two, paddingBottom: insets.bottom }]}
        pointerEvents="box-none"
      >
        <View style={styles.stage} pointerEvents="box-none">
          <View style={{ transform: [{ rotate: `${tilt}deg` }] }}>
            <Animated.View style={[{ width: cardWidth, height: cardHeight }, cardAnim]}>
              <Animated.View style={[styles.face, frontStyle]} pointerEvents={side === 'front' ? 'auto' : 'none'}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={image ? 'Flip postcard' : 'Add a photo'}
                  onPress={() => (image ? flipTo('back') : setSourceOpen(true))}
                  onLongPress={image ? () => setSourceOpen(true) : undefined}
                  delayLongPress={300}
                >
                  {image ? (
                    <Animated.View entering={FadeIn.duration(320).reduceMotion(ReduceMotion.System)}>
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
                    </Animated.View>
                  ) : (
                    <View style={[styles.empty, { width: cardWidth, height: cardHeight }]}>
                      <View style={styles.plus}>
                        <View style={styles.plusH} />
                        <View style={styles.plusV} />
                      </View>
                      <Text style={styles.emptyLabel}>Add a photo</Text>
                    </View>
                  )}
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
                  message={message}
                  onChangeMessage={setMessage}
                  recipient={recipient}
                  onChangeRecipient={setRecipient}
                  sender={sender}
                  onChangeSender={setSender}
                />
              </Animated.View>
            </Animated.View>
          </View>
        </View>

        <View style={styles.controls} pointerEvents="box-none">
          {side === 'front' && image ? (
            <Animated.View style={controlsExit} pointerEvents="box-none">
              <Animated.View entering={FadeIn.duration(300).reduceMotion(ReduceMotion.System)} style={styles.controlsInner}>
              <View style={styles.pills}>
                {TREATMENTS.map((t) => {
                  const active = t.key === treatmentKey;
                  return (
                    <Pressable
                      key={t.key}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      onPress={() => setTreatmentKey(t.key)}
                      style={[styles.pill, active && styles.pillActive]}
                    >
                      <Text style={[styles.pillText, active && styles.pillTextActive]}>{t.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <GrainSlider value={grain} onChange={setGrain} />
              </Animated.View>
            </Animated.View>
          ) : null}
        </View>
      </View>

      <CreateDrawer open={sourceOpen} onOpenChange={setSourceOpen} height="auto">
        <View style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.three }]}>
          <Text style={styles.sheetTitle}>Add a photo</Text>
          <Pressable style={styles.action} onPress={takePhoto}>
            <Text style={styles.actionText}>Take a photo</Text>
          </Pressable>
          <Pressable style={styles.action} onPress={chooseFromLibrary}>
            <Text style={styles.actionText}>Choose from library</Text>
          </Pressable>
        </View>
      </CreateDrawer>
    </KeyboardAvoidingView>
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
  empty: {
    backgroundColor: Brand.paper,
    borderRadius: 2,
    borderWidth: 2,
    borderColor: Brand.brown10,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  plus: {
    width: 28,
    height: 28,
  },
  plusH: {
    position: 'absolute',
    top: 13,
    left: 0,
    right: 0,
    height: 2,
    borderRadius: 1,
    backgroundColor: Brand.brown60,
  },
  plusV: {
    position: 'absolute',
    left: 13,
    top: 0,
    bottom: 0,
    width: 2,
    borderRadius: 1,
    backgroundColor: Brand.brown60,
  },
  emptyLabel: {
    fontFamily: Fonts.caption,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: Brand.brown60,
  },
  controls: {
    height: 92,
    justifyContent: 'center',
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
  sheet: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    gap: Spacing.two,
  },
  sheetTitle: {
    fontFamily: Fonts.serifItalic,
    fontSize: 22,
    lineHeight: 28,
    color: Brand.brown,
    marginBottom: Spacing.one,
  },
  action: {
    height: 54,
    borderRadius: 14,
    backgroundColor: Brand.paper,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Brand.brown10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    fontFamily: Fonts.sans,
    fontSize: 16,
    color: Brand.brown,
  },
});
