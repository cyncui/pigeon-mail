import { useId } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, Ellipse, Line, RadialGradient, Stop } from 'react-native-svg';

import { unitFromSeed } from '@/lib/tilt';

// Full-wear ink strengths; the whole overlay is then scaled by `level`, so a
// freshly handled card shows almost nothing and a loved one stays subtle.
const SMUDGE_ALPHA = 0.1;
const CORNER_ALPHA = 0.12;
const CREASE_DARK = 0.07;
const CREASE_LIGHT = 0.09;

type Props = {
  /** Card id — wear lands differently on every card, but always the same way. */
  seed: string;
  width: number;
  height: number;
  /** 0..1 from wearLevel(); 0 renders nothing. */
  level: number;
};

/**
 * The record of being held: a faint thumb-smudge where a hand would grip, a
 * softening at the near corners, and — once a card has really been returned
 * to — a hairline crease. Deterministic per card, accumulating with use,
 * never loud. You touch a thing and it touches you back, a little.
 */
export function WearOverlay({ seed, width, height, level }: Props) {
  const uid = useId().replace(/:/g, '');
  if (level <= 0 || width <= 0 || height <= 0) return null;

  const su = (salt: string) => unitFromSeed(seed, salt);

  // Thumb zone: along one vertical edge, where the card actually gets held.
  const rightHanded = su('hand') > 0.35; // most hands are right hands
  const sx = rightHanded ? width * (0.8 + su('sx') * 0.08) : width * (0.12 + su('sx') * 0.08);
  const sy = height * (0.42 + su('sy') * 0.38);
  const srx = width * 0.13;
  const sry = srx * 1.45;

  // The corners nearest the grip soften first.
  const cornerX = rightHanded ? width : 0;
  const cornerR = width * 0.2;

  // A crease only after real returning-to (level past ~0.45 ≈ four pickups).
  const creaseStrength = Math.max(0, Math.min(1, (level - 0.45) * 1.8));
  const cy1 = height * (0.18 + su('cr') * 0.3);
  const cx2 = width * (0.12 + su('cw') * 0.06);

  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none" opacity={level}>
      <Defs>
        <RadialGradient id={`smudge-${uid}`} cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#3F2E22" stopOpacity={SMUDGE_ALPHA} />
          <Stop offset="100%" stopColor="#3F2E22" stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id={`corner-${uid}`} cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#FFF5E1" stopOpacity={CORNER_ALPHA} />
          <Stop offset="100%" stopColor="#FFF5E1" stopOpacity={0} />
        </RadialGradient>
      </Defs>

      <Ellipse cx={sx} cy={sy} rx={srx} ry={sry} fill={`url(#smudge-${uid})`} />

      <Ellipse cx={cornerX} cy={0} rx={cornerR} ry={cornerR} fill={`url(#corner-${uid})`} />
      <Ellipse cx={cornerX} cy={height} rx={cornerR} ry={cornerR} fill={`url(#corner-${uid})`} />

      {creaseStrength > 0 ? (
        <>
          {/* A fold catches light on one side and shadow on the other. */}
          <Line
            x1={0}
            y1={cy1}
            x2={cx2}
            y2={cy1 - height * 0.06}
            stroke="#3F2E22"
            strokeWidth={0.8}
            strokeOpacity={CREASE_DARK * creaseStrength}
            strokeLinecap="round"
          />
          <Line
            x1={0}
            y1={cy1 + 1}
            x2={cx2}
            y2={cy1 - height * 0.06 + 1}
            stroke="#FFF5E1"
            strokeWidth={0.8}
            strokeOpacity={CREASE_LIGHT * creaseStrength}
            strokeLinecap="round"
          />
        </>
      ) : null}
    </Svg>
  );
}
