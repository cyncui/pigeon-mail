import { StyleSheet, Text, View } from 'react-native';

import { StampFrame } from '@/components/stamp-frame';
import { Brand, Fonts, Spacing } from '@/constants/theme';
import type { PostcardData } from '@/lib/postcards';

type Props = {
  postcard: PostcardData;
  width: number;
};

export function Postcard({ postcard, width }: Props) {
  return (
    <View style={styles.wrap}>
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
    fontFamily: Fonts.mono,
    fontSize: 13,
    lineHeight: 18,
    color: Brand.brown,
    textAlign: 'center',
    marginTop: Spacing.three,
  },
});
