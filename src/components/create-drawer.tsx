import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import { type DimensionValue, Modal, Pressable, StyleSheet, View } from 'react-native';

import { Brand } from '@/constants/theme';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children?: ReactNode;
  /** Sheet height. Defaults to 80%; pass 'auto' for a short, content-sized sheet. */
  height?: DimensionValue;
};

/**
 * Native counterpart to the Vaul-based web drawer (see create-drawer.web.tsx).
 * Vaul is DOM-only, so on native we slide up a Modal sheet at 80% height with a
 * blurred, darkened backdrop to mirror the same depth-and-focus treatment.
 */
export function CreateDrawer({ open, onOpenChange, children, height = '80%' }: Props) {
  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={() => onOpenChange(false)}
    >
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => onOpenChange(false)}>
          <BlurView intensity={24} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.scrim} />
        </Pressable>
        <View style={[styles.sheet, { height }]}>
          <View style={styles.handle} />
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(28, 20, 14, 0.35)',
  },
  sheet: {
    backgroundColor: Brand.cream,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: Brand.brown10,
    overflow: 'hidden',
    shadowColor: Brand.brown,
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 16,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: Brand.brown10,
    marginTop: 12,
    marginBottom: 4,
  },
});
