import { Image } from 'expo-image';
import { useRef, type ReactNode, type RefObject } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { AddressLines, AddressLinesDisplay } from '@/components/address-lines';
import { ScriptInput } from '@/components/script-input';
import { Brand, Fonts, Spacing } from '@/constants/theme';
import { formatAddressLines, type Address } from '@/lib/address';

const PAPER_TEXTURE = require('../../assets/textures/paper.jpg');
const PLACEHOLDER = 'rgba(63, 46, 34, 0.30)';

export type WritingRegion = 'dateline' | 'message' | 'recipient' | 'sender';
export type RegionRect = { x: number; y: number; width: number; height: number };

type Props = {
  width: number;
  height: number;
  /** "Kyoto, in June —" line above the message; feeds the feed caption. */
  dateline?: string;
  onChangeDateline?: (text: string) => void;
  message: string;
  onChangeMessage?: (text: string) => void;
  recipient: Address;
  sender: Address;
  onChangeRecipient?: (a: Address) => void;
  onChangeSender?: (a: Address) => void;
  /** Non-interactive render (send preview, picked-up desk card). */
  readOnly?: boolean;
  /** Lean-in: a writing region gained focus; rect is in window coordinates. */
  onRegionFocus?: (region: WritingRegion, rect: RegionRect) => void;
  onRegionBlur?: (region: WritingRegion) => void;
  /** The dashed stamp box, measurable by the studio as the drop target. */
  stampBoxRef?: RefObject<View | null>;
  /** 0–1 — the dragged stamp is hovering over the box (highlights it). */
  stampHover?: SharedValue<number>;
  /** Once affixed, the stamp lives IN the box so it flies with the card. */
  affixedStamp?: ReactNode;
  /** Tapping the affixed stamp (retry after a failed send). */
  onStampPress?: () => void;
  /** Pencil note under the box — what's still missing before it can fly. */
  boxHint?: string;
  /** The cancellation mark (a <Postmark/>), inked over the stamp corner. */
  postmark?: ReactNode;
};

/**
 * The writing side of the postcard. Everything is written ON the paper — a
 * dateline and message on the left, the sender ("From") tucked beneath them,
 * a stamp box and the recipient's ruled address lines on the right. No
 * drawers, no forms; tapping a region just starts writing there, and the
 * lean-in callbacks let the studio zoom the card toward your pen.
 */
export function PostcardBack({
  width,
  height,
  dateline = '',
  onChangeDateline,
  message,
  onChangeMessage,
  recipient,
  sender,
  onChangeRecipient,
  onChangeSender,
  readOnly,
  onRegionFocus,
  onRegionBlur,
  stampBoxRef,
  stampHover,
  affixedStamp,
  onStampPress,
  boxHint,
  postmark,
}: Props) {
  const regionRefs = {
    dateline: useRef<View>(null),
    message: useRef<View>(null),
    recipient: useRef<View>(null),
    sender: useRef<View>(null),
  };

  function focusRegion(region: WritingRegion) {
    const node = regionRefs[region].current;
    if (!node || !onRegionFocus) return;
    node.measureInWindow((x, y, w, h) => onRegionFocus(region, { x, y, width: w, height: h }));
  }

  // The drop target answers the dragged stamp: a touch of growth + darker dashes.
  const boxStyle = useAnimatedStyle(() => {
    const hover = stampHover?.value ?? 0;
    return {
      transform: [{ scale: 1 + hover * 0.04 }],
      borderColor: interpolateColor(hover, [0, 1], ['rgba(63, 46, 34, 0.1)', 'rgba(63, 46, 34, 0.6)']),
    };
  });

  return (
    <View style={[styles.card, { width, height }]} pointerEvents={readOnly ? 'none' : 'box-none'}>
      <Image
        source={PAPER_TEXTURE}
        style={[StyleSheet.absoluteFill, styles.texture]}
        contentFit="cover"
        pointerEvents="none"
      />
      <View style={styles.inner} pointerEvents="box-none">
        <View style={styles.left} pointerEvents="box-none">
          <View ref={regionRefs.dateline} collapsable={false}>
            {readOnly ? (
              dateline ? (
                <Text style={styles.dateline}>{dateline}</Text>
              ) : null
            ) : (
              <TextInput
                style={[styles.dateline, styles.datelineInput]}
                value={dateline}
                onChangeText={onChangeDateline}
                placeholder="where / when…"
                placeholderTextColor={PLACEHOLDER}
                maxLength={40}
                returnKeyType="done"
                onFocus={() => focusRegion('dateline')}
                onBlur={() => onRegionBlur?.('dateline')}
              />
            )}
          </View>

          <View ref={regionRefs.message} collapsable={false} style={styles.messageWrap}>
            {readOnly ? (
              <Text style={styles.message}>{message}</Text>
            ) : (
              <ScriptInput
                value={message}
                onChangeText={(text) => onChangeMessage?.(text)}
                fontSize={22}
                lineHeight={30}
                placeholder="Write your message…"
                maxLength={220}
                onFocus={() => focusRegion('message')}
                onBlur={() => onRegionBlur?.('message')}
              />
            )}
          </View>

          <View ref={regionRefs.sender} collapsable={false} style={styles.senderBlock}>
            <Text style={styles.fromLabel} pointerEvents="none">
              From
            </Text>
            {readOnly ? (
              <AddressLinesDisplay lines={formatAddressLines(sender)} fontSize={16} />
            ) : (
              <AddressLines
                value={sender}
                onChange={(a) => onChangeSender?.(a)}
                fontSize={16}
                namePlaceholder="Your name"
                onFocusBlock={() => focusRegion('sender')}
                onBlurBlock={() => onRegionBlur?.('sender')}
              />
            )}
          </View>
        </View>

        <View style={styles.right} pointerEvents="box-none">
          <View style={styles.stampArea} pointerEvents="box-none">
            <Animated.View
              ref={stampBoxRef as RefObject<View>}
              collapsable={false}
              style={[styles.stamp, boxStyle]}
              pointerEvents={affixedStamp && onStampPress ? 'auto' : 'none'}
            >
              {/* Only a tappable stamp (send retry) may be a button — a plain
                  affixed stamp must not nest a button inside the card's own
                  flip button on web. */}
              {affixedStamp && onStampPress ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Stamp"
                  onPress={onStampPress}
                  style={styles.affixed}
                >
                  {affixedStamp}
                </Pressable>
              ) : affixedStamp ? (
                <View style={styles.affixed}>{affixedStamp}</View>
              ) : (
                <View style={styles.stampInner} />
              )}
            </Animated.View>
            {postmark ? (
              <View style={styles.postmarkPin} pointerEvents="none">
                {postmark}
              </View>
            ) : null}
          </View>
          {boxHint ? (
            <Text style={styles.boxHint} pointerEvents="none">
              {boxHint}
            </Text>
          ) : null}
          <View ref={regionRefs.recipient} collapsable={false}>
            {readOnly ? (
              <AddressLinesDisplay lines={formatAddressLines(recipient)} fontSize={20} />
            ) : (
              <AddressLines
                value={recipient}
                onChange={(a) => onChangeRecipient?.(a)}
                fontSize={20}
                namePlaceholder="Name"
                onFocusBlock={() => focusRegion('recipient')}
                onBlurBlock={() => onRegionBlur?.('recipient')}
              />
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Brand.paper,
    borderRadius: 3,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Brand.brown10,
  },
  texture: {
    opacity: 0.45,
  },
  inner: {
    flex: 1,
    flexDirection: 'row',
    padding: Spacing.three,
  },
  left: {
    flex: 1.15,
    paddingRight: Spacing.three,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: Brand.brown10,
  },
  dateline: {
    fontFamily: Fonts.script,
    fontSize: 22,
    lineHeight: 26,
    color: Brand.brown60,
  },
  datelineInput: {
    padding: 0,
    marginBottom: 2,
  },
  messageWrap: {
    flex: 1,
  },
  // The message body is the maker's own hand; the dateline/addresses keep the
  // formal script.
  message: {
    flex: 1,
    fontFamily: Fonts.serif,
    fontSize: 22,
    lineHeight: 30,
    color: Brand.brown,
    padding: 0,
  },
  senderBlock: {
    marginTop: Spacing.two,
  },
  fromLabel: {
    fontFamily: Fonts.caption,
    fontSize: 9,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: Brand.brown60,
    marginBottom: 2,
  },
  right: {
    flex: 0.85,
    paddingLeft: Spacing.three,
  },
  stampArea: {
    alignSelf: 'flex-end',
    marginBottom: Spacing.two,
  },
  stamp: {
    width: 40,
    height: 48,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: Brand.brown10,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The cancellation ring sits on the paper to the stamp's left; its killer
  // bars cross the stamp and may run off the card edge — real mail does.
  postmarkPin: {
    position: 'absolute',
    left: -37,
    top: -1,
    transform: [{ rotate: '-7deg' }],
  },
  stampInner: {
    width: 26,
    height: 34,
    borderRadius: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Brand.brown10,
  },
  affixed: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxHint: {
    fontFamily: Fonts.caption,
    fontSize: 8,
    lineHeight: 11,
    color: Brand.brown60,
    textAlign: 'right',
    marginBottom: Spacing.one,
    transform: [{ rotate: '-1deg' }],
  },
});
