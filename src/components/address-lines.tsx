import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Brand, Fonts } from '@/constants/theme';
import { formatCityLine, isAddressComplete, parseCityLine, type Address } from '@/lib/address';

const PLACEHOLDER = 'rgba(63, 46, 34, 0.30)';

type Props = {
  value: Address;
  onChange: (a: Address) => void;
  /** Handwriting size; the sender block runs smaller than the recipient.
   * Lovers Quarrel is small-bodied — sizes here run larger than they read. */
  fontSize?: number;
  namePlaceholder?: string;
  /** Notify the lean-in zoom that writing started/stopped in this block. */
  onFocusBlock?: () => void;
  onBlurBlock?: () => void;
};

/**
 * A postcard's ruled address lines, written directly on the card: name,
 * street, apt (optional), and a combined "City, ST ZIP" line. The structured
 * Lob-ready `Address` survives underneath — only the city line parses, and it
 * does so forgivingly, normalizing on blur. No drawer, no form: you write on
 * the paper.
 */
export function AddressLines({
  value,
  onChange,
  fontSize = 20,
  namePlaceholder = 'Name',
  onFocusBlock,
  onBlurBlock,
}: Props) {
  // The raw city line is local so typing never fights the parser.
  const [cityLine, setCityLine] = useState(() => formatCityLine(value));
  const [showHint, setShowHint] = useState(false);

  const streetRef = useRef<TextInput>(null);
  const aptRef = useRef<TextInput>(null);
  const cityRef = useRef<TextInput>(null);

  // Track focus across the block's inputs: the block "blurs" only when focus
  // leaves all of them (a blur immediately followed by a sibling focus is a
  // hand-off, not an exit).
  const focusDepth = useRef(0);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (blurTimer.current) clearTimeout(blurTimer.current);
    },
    [],
  );
  function handleFocus() {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    focusDepth.current += 1;
    if (focusDepth.current === 1) {
      setShowHint(false);
      onFocusBlock?.();
    }
  }
  function handleBlur() {
    blurTimer.current = setTimeout(() => {
      focusDepth.current = 0;
      const parsed = parseCityLine(cityLine);
      if (parsed) setCityLine(formatCityLine(parsed)); // normalize, e.g. "or" → OR
      const touched =
        value.name.trim() || value.line1.trim() || value.line2?.trim() || cityLine.trim();
      setShowHint(Boolean(touched) && !isAddressComplete(value));
      onBlurBlock?.();
    }, 80);
    focusDepth.current = Math.max(0, focusDepth.current - 1);
  }

  function changeCityLine(text: string) {
    setCityLine(text);
    const parsed = parseCityLine(text);
    onChange(parsed ? { ...value, ...parsed } : { ...value, city: '', state: '', zip: '' });
  }

  const lineHeight = Math.round(fontSize * 1.5);
  const inputStyle = [styles.input, { fontSize, lineHeight, height: lineHeight + 6 }];

  return (
    <View>
      <TextInput
        style={inputStyle}
        value={value.name}
        onChangeText={(name) => onChange({ ...value, name })}
        placeholder={namePlaceholder}
        placeholderTextColor={PLACEHOLDER}
        autoCapitalize="words"
        maxLength={40}
        returnKeyType="next"
        onSubmitEditing={() => streetRef.current?.focus()}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
      <TextInput
        ref={streetRef}
        style={inputStyle}
        value={value.line1}
        onChangeText={(line1) => onChange({ ...value, line1 })}
        placeholder="Street"
        placeholderTextColor={PLACEHOLDER}
        autoCapitalize="words"
        maxLength={64}
        returnKeyType="next"
        onSubmitEditing={() => aptRef.current?.focus()}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
      <TextInput
        ref={aptRef}
        style={inputStyle}
        value={value.line2 ?? ''}
        onChangeText={(line2) => onChange({ ...value, line2 })}
        placeholder="Apt (optional)"
        placeholderTextColor={PLACEHOLDER}
        autoCapitalize="words"
        maxLength={32}
        returnKeyType="next"
        onSubmitEditing={() => cityRef.current?.focus()}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
      <TextInput
        ref={cityRef}
        style={inputStyle}
        value={cityLine}
        onChangeText={changeCityLine}
        placeholder="City, ST ZIP"
        placeholderTextColor={PLACEHOLDER}
        autoCapitalize="words"
        autoCorrect={false}
        maxLength={48}
        returnKeyType="done"
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
      {showHint ? <Text style={styles.hint}>needs a city, state & zip</Text> : null}
    </View>
  );
}

/** Read-only twin used by previews: the same lines, no inputs. */
export function AddressLinesDisplay({ lines, fontSize = 20 }: { lines: string[]; fontSize?: number }) {
  const lineHeight = Math.round(fontSize * 1.5);
  return (
    <View>
      {lines.map((line, i) => (
        <Text key={i} style={[styles.display, { fontSize, lineHeight }]}>
          {line}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    fontFamily: Fonts.script,
    color: Brand.brown,
    padding: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Brand.brown10,
  },
  display: {
    fontFamily: Fonts.script,
    color: Brand.brown,
  },
  hint: {
    fontFamily: Fonts.caption,
    fontSize: 9,
    lineHeight: 13,
    color: Brand.brown60,
    marginTop: 3,
    transform: [{ rotate: '-1deg' }],
  },
});
