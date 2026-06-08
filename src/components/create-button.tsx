import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Brand } from '@/constants/theme';

type Props = {
  /** When a postcard sits behind the button, flip the color for contrast. */
  overPostcard: boolean;
  onPress?: () => void;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

export function CreateButton({ overPostcard, onPress, size = 56, style }: Props) {
  const color = overPostcard ? Brand.cream : Brand.brown;
  const bar = size * 0.32;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Create a postcard"
      hitSlop={10}
      onPress={onPress}
      style={({ pressed }) => [
        styles.fab,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: color,
          opacity: pressed ? 0.55 : 1,
        },
        style,
      ]}
    >
      <View style={{ width: bar, height: bar }}>
        <View style={[styles.line, { backgroundColor: color, top: bar / 2 - 1, left: 0, right: 0, height: 2 }]} />
        <View style={[styles.line, { backgroundColor: color, left: bar / 2 - 1, top: 0, bottom: 0, width: 2 }]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  line: {
    position: 'absolute',
    borderRadius: 1,
  },
});
