import { StyleSheet, Text, View } from 'react-native';

import { StampFrame } from '@/components/stamp-frame';
import { Brand, Fonts, Spacing } from '@/constants/theme';
import type { PostcardData } from '@/lib/postcards';
import { tiltFromSeed } from '@/lib/tilt';

type Props = {
  postcard: PostcardData;
  width: number;
};

export function Postcard({ postcard, width }: Props) {
  const tilt = tiltFromSeed(postcard.id);
  return (
    <View style={[styles.wrap, { transform: [{ rotate: `${tilt}deg` }] }]}>
      <StampFrame imageUri={postcard.imageUri} width={width} />
      <Text style={styles.caption}>{`${postcard.date} in ${postcard.location}`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: Spacing.five,
  },
  caption: {
    fontFamily: Fonts.caption,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: Brand.brown60,
    textAlign: 'center',
    marginTop: Spacing.three - 10,
  },
});
