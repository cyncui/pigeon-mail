import { Image } from 'expo-image';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import { Brand, Fonts, Spacing } from '@/constants/theme';
import type { PostcardData } from '@/lib/postcards';

type Props = {
  postcard: PostcardData;
  /** Reports the card's bounds (used to flip the create button's color). */
  onLayout?: (event: LayoutChangeEvent) => void;
};

export function Postcard({ postcard, onLayout }: Props) {
  return (
    <View style={styles.wrap} onLayout={onLayout}>
      <View style={styles.stamp}>
        <Image
          source={{ uri: postcard.imageUri }}
          style={styles.image}
          contentFit="cover"
          transition={250}
        />
      </View>
      <Text style={styles.caption}>{`${postcard.date} in ${postcard.location}`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: Spacing.five,
  },
  stamp: {
    backgroundColor: Brand.stamp,
    padding: Spacing.two, // white postage-stamp border
    borderRadius: 4,
    // soft, warm-neutral drop shadow for a little physical lift
    shadowColor: Brand.brown,
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  image: {
    width: '100%',
    aspectRatio: 3 / 2,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: Brand.brown10,
    backgroundColor: Brand.brown10,
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
