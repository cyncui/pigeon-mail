import { useEffect, useId, useMemo } from 'react';
import { Platform, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, Path, Text as SvgText, TextPath } from 'react-native-svg';

import { EASE_OUT } from '@/lib/motion';

// Cancellation ink: brown, slightly starved, like a worn rubber stamp.
const INK = 'rgba(63, 46, 34, 0.55)';
const RING = 46;
const BARS_W = 52;
const PAD = 3; // headroom for the bars' wave
// SVG attributes can't resolve CSS variables, so name the face directly.
const MARK_FONT = Platform.OS === 'web' ? 'Ioskeley Mono' : 'IoskeleyMono';

export type PostmarkInfo = {
  /** Top arc — the sending town. */
  arc: string;
  /** Center lines — the date, e.g. ["MAY 2", "2026"]. */
  lines: string[];
};

/** Build postmark text from a card's display fields. */
export function postmarkFor(date: string, location: string): PostmarkInfo {
  const town = (location.split(',')[0] ?? '').trim().toUpperCase();
  const arc = (town || 'PIGEON MAIL').slice(0, 16);
  const comma = date.lastIndexOf(',');
  const lines =
    comma > 0
      ? [date.slice(0, comma).trim().toUpperCase(), date.slice(comma + 1).trim().toUpperCase()]
      : [date.trim().toUpperCase()];
  return { arc, lines };
}

/** Today's postmark, for the moment of cancellation in the studio. */
export function postmarkForToday(location: string): PostmarkInfo {
  const now = new Date();
  const monthDay = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(now);
  return {
    ...postmarkFor('', location),
    lines: [monthDay.toUpperCase(), String(now.getFullYear())],
  };
}

type Props = {
  mark: PostmarkInfo;
  /** Press on (scale-down + ink-in) instead of just being there. */
  animateIn?: boolean;
  /** Delay before the press, ms (lets the stamp land first). */
  pressDelay?: number;
  reduceMotion?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * A circular cancellation postmark: town on the top arc, date in the middle,
 * wavy "killer" bars running off to the right so they cross the stamp. The
 * mark that turns a postcard from written into MAILED — proof it passed
 * through hands.
 */
export function Postmark({ mark, animateIn = false, pressDelay = 0, reduceMotion, style }: Props) {
  const arcId = `pm-${useId().replace(/:/g, '')}`;

  const press = useSharedValue(animateIn ? 0 : 1);
  useEffect(() => {
    if (!animateIn) return;
    press.value = withDelay(
      reduceMotion ? 0 : pressDelay,
      withTiming(1, { duration: reduceMotion ? 120 : 240, easing: EASE_OUT }),
    );
    // Mount-only: a postmark is pressed once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const pressStyle = useAnimatedStyle(() => ({
    opacity: press.value * 0.92,
    transform: [{ scale: reduceMotion ? 1 : 1.5 - press.value * 0.5 }],
  }));

  const cx = RING / 2;
  const cy = PAD + RING / 2;
  const r = RING / 2 - 0.8;
  const arcR = r - 7.5;

  // Four killer bars, hand-inked: slightly ragged lengths.
  const bars = useMemo(() => {
    const waves: string[] = [];
    [-9, -3, 3, 9].forEach((dy, i) => {
      const y = cy + dy;
      const x0 = cx + r - 2;
      const segments = Math.ceil((BARS_W + 6) / 10);
      let d = `M ${x0} ${y} q 5 -2.2 10 0`;
      for (let s = 1; s < segments - (i % 2); s += 1) d += ' t 10 0';
      waves.push(d);
    });
    return waves;
  }, [cx, cy, r]);

  const lineCount = mark.lines.length;

  return (
    <Animated.View style={[style, pressStyle]} pointerEvents="none">
      <Svg width={RING + BARS_W} height={RING + PAD * 2}>
        <Defs>
          {/* Top inner arc, left → right, for the town to ride. */}
          <Path id={arcId} d={`M ${cx - arcR} ${cy} A ${arcR} ${arcR} 0 0 1 ${cx + arcR} ${cy}`} />
        </Defs>
        {bars.map((d, i) => (
          <Path key={i} d={d} stroke={INK} strokeWidth={1.1} strokeLinecap="round" fill="none" />
        ))}
        <Path
          d={`M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z`}
          stroke={INK}
          strokeWidth={1.2}
          fill="none"
        />
        <SvgText fill={INK} fontFamily={MARK_FONT} fontSize={6.4} letterSpacing={0.6}>
          <TextPath href={`#${arcId}`} startOffset="50%" textAnchor="middle">
            {mark.arc}
          </TextPath>
        </SvgText>
        {mark.lines.map((line, i) => (
          <SvgText
            key={i}
            x={cx}
            y={cy + (i - (lineCount - 1) / 2) * 9 + 2.4}
            fill={INK}
            fontFamily={MARK_FONT}
            fontSize={7.2}
            letterSpacing={0.4}
            textAnchor="middle"
          >
            {line}
          </SvgText>
        ))}
      </Svg>
    </Animated.View>
  );
}
