import { createContext, useContext } from 'react';
import type { SharedValue } from 'react-native-reanimated';

export type ModalControls = {
  /** 0 = fully open; animates toward 1 while dismissing. */
  closing: SharedValue<number>;
  /** Play the exit animation, then navigate back. */
  requestClose: () => void;
};

export const ModalContext = createContext<ModalControls | null>(null);

export function useModal(): ModalControls {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error('useModal must be used inside a ModalContext provider');
  return ctx;
}
