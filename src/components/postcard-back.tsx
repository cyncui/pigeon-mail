import { Image } from 'expo-image';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Brand, Fonts, Spacing } from '@/constants/theme';

const PAPER_TEXTURE = require('../../assets/textures/paper.jpg');
const PLACEHOLDER = 'rgba(63, 46, 34, 0.35)';

type Props = {
  width: number;
  height: number;
  message: string;
  onChangeMessage: (text: string) => void;
  recipient: string;
  onChangeRecipient: (text: string) => void;
  sender: string;
  onChangeSender: (text: string) => void;
};

/**
 * The writing side of the postcard: message on the left, a stamp box and the
 * recipient address on the right, sender ("From") tucked under the message.
 * Same paper stock as the front so the flip reveals one coherent card.
 *
 * Everything except the text fields is `pointerEvents="box-none"` so taps on the
 * bare paper fall through to the flip layer beneath, while taps on a field still
 * focus it for editing.
 */
export function PostcardBack({
  width,
  height,
  message,
  onChangeMessage,
  recipient,
  onChangeRecipient,
  sender,
  onChangeSender,
}: Props) {
  return (
    <View style={[styles.card, { width, height }]} pointerEvents="box-none">
      <Image
        source={PAPER_TEXTURE}
        style={[StyleSheet.absoluteFill, styles.texture]}
        contentFit="cover"
        pointerEvents="none"
      />
      <View style={styles.inner} pointerEvents="box-none">
        <View style={styles.left} pointerEvents="box-none">
          <TextInput
            style={styles.message}
            value={message}
            onChangeText={onChangeMessage}
            placeholder="Write your message…"
            placeholderTextColor={PLACEHOLDER}
            multiline
            textAlignVertical="top"
          />
          <View style={styles.senderBlock} pointerEvents="box-none">
            <Text style={styles.fromLabel} pointerEvents="none">
              From
            </Text>
            <TextInput
              style={styles.sender}
              value={sender}
              onChangeText={onChangeSender}
              placeholder="Your address"
              placeholderTextColor={PLACEHOLDER}
              multiline
            />
          </View>
        </View>

        <View style={styles.right} pointerEvents="box-none">
          <View style={styles.stamp} pointerEvents="none">
            <View style={styles.stampInner} />
          </View>
          <TextInput
            style={styles.address}
            value={recipient}
            onChangeText={onChangeRecipient}
            placeholder="Recipient name & address"
            placeholderTextColor={PLACEHOLDER}
            multiline
            textAlignVertical="top"
          />
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
    justifyContent: 'space-between',
  },
  message: {
    flex: 1,
    fontFamily: Fonts.serif,
    fontSize: 15,
    lineHeight: 22,
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
  sender: {
    fontFamily: Fonts.caption,
    fontSize: 11,
    lineHeight: 15,
    color: Brand.brown,
    padding: 0,
  },
  right: {
    flex: 0.85,
    paddingLeft: Spacing.three,
  },
  stamp: {
    alignSelf: 'flex-end',
    width: 40,
    height: 48,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: Brand.brown10,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  stampInner: {
    width: 26,
    height: 34,
    borderRadius: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Brand.brown10,
  },
  address: {
    flex: 1,
    fontFamily: Fonts.caption,
    fontSize: 13,
    lineHeight: 19,
    color: Brand.brown,
    padding: 0,
  },
});
