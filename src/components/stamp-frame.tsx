import { Image } from 'expo-image';
import { useId, useMemo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Image as SvgImage, Mask, Rect } from 'react-native-svg';

import { Brand } from '@/constants/theme';

// Real paper texture used as the card's surface.
const PAPER_TEXTURE = require('../../assets/textures/paper.jpg');
// Texture strength over the ivory base on the border. Lower = lighter / creamier.
const PAPER_TEXTURE_OPACITY = 0.8;
// Faint paper texture multiplied over the photo so the whole stamp reads as one sheet.
const PHOTO_TEXTURE_OPACITY = 0.5;

const STAMP_BORDER = 18; // paper margin framing the image
const PERF_PITCH = 18; // distance between perforation centers
const PERF_RADIUS = 6; // perforation hole radius

type Props = {
  imageUri: string;
  width: number;
  /** Image aspect ratio (width / height). */
  aspectRatio?: number;
  /** Custom photo layer (e.g. a Skia-treated canvas), sized to the inset photo rect. */
  renderPhoto?: (size: { width: number; height: number }) => ReactNode;
};

/**
 * A postage-stamp frame on real paper. A textured paper image is masked to the
 * perforated stamp shape — a thick border with spaced semicircular notches that
 * run through the corners — and the photo is inset under a matte veil plus a
 * faint pass of the same paper grain, so the whole card reads as one print.
 */
export function StampFrame({ imageUri, width, aspectRatio = 3 / 2, renderPhoto }: Props) {
  const maskId = `stamp-${useId().replace(/:/g, '')}`;

  const imageW = width - STAMP_BORDER * 2;
  const imageH = imageW / aspectRatio;
  const height = imageH + STAMP_BORDER * 2;

  const holes = useMemo(() => {
    const pts: { cx: number; cy: number }[] = [];
    const nx = Math.max(2, Math.round(width / PERF_PITCH));
    const ny = Math.max(2, Math.round(height / PERF_PITCH));
    const stepX = width / nx;
    const stepY = height / ny;
    // top & bottom edges, including the four corners
    for (let i = 0; i <= nx; i++) {
      const cx = i * stepX;
      pts.push({ cx, cy: 0 });
      pts.push({ cx, cy: height });
    }
    // left & right edges, excluding the corners (already covered above)
    for (let j = 1; j < ny; j++) {
      const cy = j * stepY;
      pts.push({ cx: 0, cy });
      pts.push({ cx: width, cy });
    }
    return pts;
  }, [width, height]);

  const perfHoles = holes.map((c, i) => <Circle key={i} cx={c.cx} cy={c.cy} r={PERF_RADIUS} fill="#000" />);

  const photoRect = { top: STAMP_BORDER, left: STAMP_BORDER, width: imageW, height: imageH };

  return (
    <View style={{ width, height }}>
      {/* paper card (real texture over an ivory base), masked to the perforated edge */}
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <Mask id={maskId}>
            <Rect x={0} y={0} width={width} height={height} fill="#fff" />
            {perfHoles}
          </Mask>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill={Brand.paper} mask={`url(#${maskId})`} />
        <SvgImage
          href={PAPER_TEXTURE}
          x={0}
          y={0}
          width={width}
          height={height}
          preserveAspectRatio="xMidYMid slice"
          opacity={PAPER_TEXTURE_OPACITY}
          mask={`url(#${maskId})`}
        />
      </Svg>

      {/* the photo, inset to sit inside the paper border */}
      {renderPhoto ? (
        <View style={[styles.image, photoRect]}>{renderPhoto({ width: imageW, height: imageH })}</View>
      ) : (
        <Image source={{ uri: imageUri }} style={[styles.image, photoRect]} contentFit="cover" transition={250} />
      )}
      {/* warm matte veil so the photo reads as a print, not a glossy digital image */}
      <View pointerEvents="none" style={[styles.print, photoRect]} />
      {/* faint paper grain over the photo, multiplied so it reads as printed on the same sheet */}
      <View pointerEvents="none" style={[styles.photoTexture, photoRect]}>
        <Image source={PAPER_TEXTURE} style={StyleSheet.absoluteFill} contentFit="cover" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    position: 'absolute',
    borderRadius: 1,
    backgroundColor: Brand.paper,
  },
  print: {
    position: 'absolute',
    borderRadius: 1,
    backgroundColor: Brand.print,
  },
  photoTexture: {
    position: 'absolute',
    borderRadius: 1,
    overflow: 'hidden',
    opacity: PHOTO_TEXTURE_OPACITY,
    mixBlendMode: 'multiply',
  },
});
