import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { GlassSurface } from '@/components/glass-surface';
import { Brand } from '@/constants/theme';

type Props = {
  onPress?: () => void;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

export function CreateButton({ onPress, size = 56, style }: Props) {
  const bar = size * 0.32;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Create a postcard"
      hitSlop={10}
      onPress={onPress}
      style={({ pressed }) => [
        styles.fab,
        { width: size, height: size, borderRadius: size / 2, transform: [{ scale: pressed ? 0.96 : 1 }] },
        style,
      ]}
    >
      <GlassSurface style={[StyleSheet.absoluteFill, { borderRadius: size / 2 }]} interactive intensity={90} />
      <View style={{ width: bar, height: bar }}>
        <View style={[styles.line, { top: bar / 2 - 1, left: 0, right: 0, height: 2 }]} />
        <View style={[styles.line, { left: bar / 2 - 1, top: 0, bottom: 0, width: 2 }]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Brand.brown10,
  },
  line: {
    position: 'absolute',
    borderRadius: 1,
    backgroundColor: Brand.brown,
  },
});
