import { BlurView } from 'expo-blur';
import { StyleSheet } from 'react-native';

/** Native blur layer. The dark tint (and its fade) is a separate layer in create.tsx. */
export function ModalScrim() {
  return <BlurView intensity={32} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" />;
}
