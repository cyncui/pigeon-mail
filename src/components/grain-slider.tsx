import { useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';

import { Brand, Fonts, Spacing } from '@/constants/theme';
import { hapticSoft } from '@/lib/haptics';

const THUMB = 16;
const TRACK_H = 24;
// Film-advance ratchet: a soft tick at each tenth as the grain winds on.
const DETENTS = 10;

type Props = {
  /** 0–1 */
  value: number;
  onChange: (value: number) => void;
};

/** Compact draggable/tappable slider for grain intensity. */
export function GrainSlider({ value, onChange }: Props) {
  const [trackW, setTrackW] = useState(0);
  const widthRef = useRef(0);
  const detentRef = useRef(Math.round(value * DETENTS));

  const setFromX = (x: number) => {
    const usable = Math.max(0, widthRef.current - THUMB);
    const clamped = Math.max(0, Math.min(usable, x - THUMB / 2));
    const next = usable > 0 ? clamped / usable : 0;
    const detent = Math.round(next * DETENTS);
    if (detent !== detentRef.current) {
      detentRef.current = detent;
      hapticSoft();
    }
    onChange(next);
  };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => setFromX(e.nativeEvent.locationX),
      onPanResponderMove: (e) => setFromX(e.nativeEvent.locationX),
    }),
  ).current;

  const usable = Math.max(0, trackW - THUMB);
  const thumbX = value * usable;

  return (
    <View style={styles.row}>
      <Text style={styles.label}>Grain</Text>
      <View
        style={styles.track}
        hitSlop={{ top: 8, bottom: 8 }}
        onLayout={(e) => {
          widthRef.current = e.nativeEvent.layout.width;
          setTrackW(e.nativeEvent.layout.width);
        }}
        {...responder.panHandlers}
      >
        <View style={styles.line} pointerEvents="none" />
        <View style={[styles.fill, { width: thumbX + THUMB / 2 }]} pointerEvents="none" />
        <View style={[styles.thumb, { left: thumbX }]} pointerEvents="none" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  label: {
    width: 44,
    fontFamily: Fonts.caption,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: Brand.cream60,
  },
  track: {
    flex: 1,
    height: TRACK_H,
    justifyContent: 'center',
  },
  line: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: (TRACK_H - 3) / 2,
    height: 3,
    borderRadius: 2,
    backgroundColor: Brand.cream20,
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: (TRACK_H - 3) / 2,
    height: 3,
    borderRadius: 2,
    backgroundColor: Brand.cream60,
  },
  thumb: {
    position: 'absolute',
    top: (TRACK_H - THUMB) / 2,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: Brand.cream,
  },
});
