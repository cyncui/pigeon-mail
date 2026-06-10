import { Canvas, Path, Skia, useFont, type SkFont, type SkPath } from '@shopify/react-native-skia';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Brand, Fonts } from '@/constants/theme';
import { layoutScript } from '@/lib/script-layout';

// The message is written in the maker's own hand — the Skia editor traces
// these glyph outlines for the write-on animation.
const FONT_SRC = require('../../assets/fonts/HandOfCynthia-Regular.otf');
const INK = Brand.brown;
const PLACEHOLDER = 'rgba(63, 46, 34, 0.30)';
// One glyph's write-on: stroke traces for ~130ms, ink floods in behind it.
const WRITE_MS = 180;
const STROKE_DONE = 0.72;

export type ScriptInputProps = {
  value: string;
  onChangeText: (text: string) => void;
  fontSize: number;
  lineHeight: number;
  placeholder?: string;
  maxLength?: number;
  onFocus?: () => void;
  onBlur?: () => void;
};

/**
 * An editable field whose text is drawn by hand: an invisible TextInput owns
 * the keyboard, autocorrect, and selection, while a Skia canvas renders every
 * character as its glyph path in the script face — and each newly typed
 * character traces itself on, pen-stroke first, ink fill behind. We own the
 * layout (greedy wrap in script-layout.ts), so the drawn text and the caret
 * can never drift apart.
 */
export function ScriptInput(props: ScriptInputProps) {
  const font = useFont(FONT_SRC, props.fontSize);
  // Until the typeface decodes (a frame or two), a plain input keeps typing
  // unblocked; the swap is seamless because the value is controlled.
  if (!font) return <PlainScriptInput {...props} />;
  return <ScriptEditor font={font} {...props} />;
}

export default ScriptInput;

/** The pre-Skia fallback — also exported for the web pre-CanvasKit state. */
export function PlainScriptInput({
  value,
  onChangeText,
  fontSize,
  lineHeight,
  placeholder,
  maxLength,
  onFocus,
  onBlur,
}: ScriptInputProps) {
  return (
    <TextInput
      style={[styles.fill, { fontFamily: Fonts.serif, fontSize, lineHeight, color: INK }]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={PLACEHOLDER}
      maxLength={maxLength}
      multiline
      scrollEnabled={false}
      textAlignVertical="top"
      onFocus={onFocus}
      onBlur={onBlur}
    />
  );
}

function ScriptEditor({
  font,
  value,
  onChangeText,
  fontSize,
  lineHeight,
  placeholder,
  maxLength,
  onFocus,
  onBlur,
}: ScriptInputProps & { font: SkFont }) {
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const [selection, setSelection] = useState(0);
  const [focused, setFocused] = useState(false);

  // Per-character advance widths, cached for the life of the font.
  const widthCache = useMemo(() => new Map<string, number>(), [font]); // eslint-disable-line react-hooks/exhaustive-deps
  const charWidth = (ch: string) => {
    let w = widthCache.get(ch);
    if (w === undefined) {
      w = font.measureText(ch).width;
      widthCache.set(ch, w);
    }
    return w;
  };

  const metrics = useMemo(() => font.getMetrics(), [font]);
  const ascent = -metrics.ascent;
  const baselineFor = (line: number) => line * lineHeight + ascent;

  const layout = useMemo(
    () => layoutScript(value, charWidth, Math.max(width, 1)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [value, width, font],
  );

  // Stable identity per character so reflowed glyphs don't re-animate and
  // freshly inserted ones do. Keys mirror the text via prefix/suffix diff.
  const keysRef = useRef<{ text: string; keys: string[]; nextKey: number; initial: boolean }>({
    text: '',
    keys: [],
    nextKey: 0,
    initial: true,
  });
  const keys = useMemo(() => {
    const state = keysRef.current;
    const old = state.text;
    if (value !== old) {
      let prefix = 0;
      const max = Math.min(old.length, value.length);
      while (prefix < max && old[prefix] === value[prefix]) prefix += 1;
      let suffix = 0;
      while (
        suffix < max - prefix &&
        old[old.length - 1 - suffix] === value[value.length - 1 - suffix]
      ) {
        suffix += 1;
      }
      const inserted = value.length - prefix - suffix;
      const fresh: string[] = [];
      for (let i = 0; i < inserted; i += 1) {
        // Cards opened with existing text shouldn't replay every stroke.
        fresh.push(`${state.initial ? 's' : 'a'}${state.nextKey++}`);
      }
      state.keys = [...state.keys.slice(0, prefix), ...fresh, ...state.keys.slice(old.length - suffix)];
      state.text = value;
      state.initial = false;
    }
    return state.keys;
  }, [value]);

  // Caret: ours, drawn from the same layout the glyphs use.
  const caret = layout.carets[Math.min(selection, layout.carets.length - 1)];
  const blink = useSharedValue(1);
  useEffect(() => {
    blink.value = focused
      ? withRepeat(withSequence(withTiming(1, { duration: 530 }), withTiming(0, { duration: 530 })), -1)
      : withTiming(0, { duration: 80 });
  }, [focused, blink]);
  const caretStyle = useAnimatedStyle(() => ({ opacity: blink.value }));

  return (
    <View style={styles.fill} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 ? (
        <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
          {layout.glyphs.map((glyph) => (
            <WrittenGlyph
              key={keys[glyph.index] ?? `g${glyph.index}`}
              char={glyph.char}
              x={glyph.x}
              baseline={baselineFor(glyph.line)}
              font={font}
              animate={!reduceMotion && (keys[glyph.index] ?? '').startsWith('a')}
            />
          ))}
        </Canvas>
      ) : null}

      {value.length === 0 ? (
        <Text
          style={[styles.placeholder, { fontFamily: Fonts.serif, fontSize, lineHeight }]}
          pointerEvents="none"
        >
          {placeholder}
        </Text>
      ) : null}

      {focused ? (
        <Animated.View
          style={[
            styles.caret,
            {
              left: caret.x,
              top: caret.line * lineHeight + lineHeight * 0.12,
              height: lineHeight * 0.76,
            },
            caretStyle,
          ]}
          pointerEvents="none"
        />
      ) : null}

      <TextInput
        style={[styles.fill, styles.ghostInput, { fontSize, lineHeight }]}
        value={value}
        onChangeText={onChangeText}
        onSelectionChange={(e) => setSelection(e.nativeEvent.selection.start)}
        maxLength={maxLength}
        multiline
        scrollEnabled={false}
        textAlignVertical="top"
        caretHidden
        selectionColor="rgba(63, 46, 34, 0.18)"
        onFocus={() => {
          setFocused(true);
          onFocus?.();
        }}
        onBlur={() => {
          setFocused(false);
          onBlur?.();
        }}
      />
    </View>
  );
}

type GlyphProps = {
  char: string;
  x: number;
  baseline: number;
  font: SkFont;
  animate: boolean;
};

// Origin glyph outlines, shared app-wide per (font, char).
const originPaths = new WeakMap<SkFont, Map<string, SkPath | null>>();
function originPath(font: SkFont, char: string): SkPath | null {
  let perFont = originPaths.get(font);
  if (!perFont) {
    perFont = new Map();
    originPaths.set(font, perFont);
  }
  if (!perFont.has(char)) {
    perFont.set(char, Skia.Path.MakeFromText(char, 0, 0, font));
  }
  return perFont.get(char) ?? null;
}

const WrittenGlyph = memo(function WrittenGlyph({ char, x, baseline, font, animate }: GlyphProps) {
  const path = useMemo(() => {
    const origin = originPath(font, char);
    if (!origin) return null;
    const moved = origin.copy();
    moved.offset(x, baseline);
    return moved;
  }, [font, char, x, baseline]);

  const t = useSharedValue(animate ? 0 : 1);
  useEffect(() => {
    t.value = withTiming(1, { duration: WRITE_MS, easing: Easing.out(Easing.quad) });
    // Mount-only: a glyph writes itself once; reflow just moves it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const strokeEnd = useDerivedValue(() => Math.min(1, t.value / STROKE_DONE));
  const strokeOpacity = useDerivedValue(() => interpolate(t.value, [0.7, 1], [1, 0]));
  const fillOpacity = useDerivedValue(() => interpolate(t.value, [0.4, 0.95], [0, 1]));

  if (!path) return null; // missing glyph (emoji): skip — see ghost input note
  if (!animate) return <Path path={path} color={INK} />;
  return (
    <>
      <Path
        path={path}
        color={INK}
        style="stroke"
        strokeWidth={1.1}
        start={0}
        end={strokeEnd}
        opacity={strokeOpacity}
      />
      <Path path={path} color={INK} opacity={fillOpacity} />
    </>
  );
});

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  ghostInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    fontFamily: Fonts.serif,
    color: 'transparent',
    padding: 0,
  },
  placeholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    color: PLACEHOLDER,
  },
  caret: {
    position: 'absolute',
    width: 1.5,
    borderRadius: 1,
    backgroundColor: Brand.brown,
  },
});
