import { WithSkiaWeb } from '@shopify/react-native-skia/lib/module/web';

import type { ScriptInputProps } from './script-input-skia';
import { Fonts } from '@/constants/theme';
import { TextInput } from 'react-native';

export type { ScriptInputProps };

const INK = '#3F2E22';
const PLACEHOLDER = 'rgba(63, 46, 34, 0.30)';

/**
 * Web wrapper: CanvasKit (≈8MB) loads lazily; until it's ready the message is
 * a plain TextInput in the script face — typing is never blocked, and the
 * hand-off is seamless because the value is controlled by the parent.
 * (Duplicated minimally from script-input-skia's PlainScriptInput: importing
 * that module statically would bind Skia's web entry before CanvasKit exists.)
 */
export function ScriptInput(props: ScriptInputProps) {
  return (
    <WithSkiaWeb<ScriptInputProps>
      getComponent={() => import('./script-input-skia').then((m) => ({ default: m.ScriptInput }))}
      componentProps={props}
      fallback={
        <TextInput
          style={{
            flex: 1,
            fontFamily: Fonts.serif,
            fontSize: props.fontSize,
            lineHeight: props.lineHeight,
            color: INK,
            padding: 0,
          }}
          value={props.value}
          onChangeText={props.onChangeText}
          placeholder={props.placeholder}
          placeholderTextColor={PLACEHOLDER}
          maxLength={props.maxLength}
          multiline
          scrollEnabled={false}
          textAlignVertical="top"
          onFocus={props.onFocus}
          onBlur={props.onBlur}
        />
      }
    />
  );
}
