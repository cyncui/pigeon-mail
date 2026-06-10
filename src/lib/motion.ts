import { Easing } from 'react-native-reanimated';

/** The house entrance ease — a long, soft settle. Exits use Easing.in. */
export const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
