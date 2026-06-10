import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * One place for every tactile beat in the app, so the vocabulary stays small
 * and consistent. All fire-and-forget; no-ops on web.
 */
const isWeb = Platform.OS === 'web';

/** Something gently announces itself (camera wakes, stamp appears). */
export function hapticSoft() {
  if (!isWeb) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
}

/** The user picked something up / a transition began. */
export function hapticLight() {
  if (!isWeb) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/** A real action landed (shutter, photo printed). */
export function hapticMedium() {
  if (!isWeb) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

/** The big one — the stamp thunks onto the card. */
export function hapticHeavy() {
  if (!isWeb) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
}

/** Something went wrong (send failed). */
export function hapticError() {
  if (!isWeb) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
}
