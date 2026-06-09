import type { CSSProperties, ReactNode } from 'react';
import { Drawer } from 'vaul';

import { Brand } from '@/constants/theme';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children?: ReactNode;
  /** Sheet height. Defaults to a tall 80vh; pass 'auto' for a short, content-sized sheet. */
  height?: number | string;
};

/**
 * Bottom drawer for the create-postcard flow, built on Vaul — the same drawer
 * primitive shadcn's `Drawer` wraps (Drawer.Root / Overlay / Content, with
 * drag-to-dismiss, Esc, and scroll-lock for free). Controlled via `open` so the
 * FAB on the home screen can drive it.
 *
 * The overlay both darkens and blurs the backdrop to push the page back and pull
 * focus onto the sheet. The sheet sits at 80vh.
 */
export function CreateDrawer({ open, onOpenChange, children, height = '80vh' }: Props) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay style={overlay} />
        <Drawer.Content style={{ ...content, height }} aria-describedby={undefined}>
          <div style={handle} aria-hidden="true" />
          {/* Radix requires a title for accessibility; keep it visually hidden. */}
          <Drawer.Title style={srOnly}>Create a postcard</Drawer.Title>
          {children}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

const overlay: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 50,
  backgroundColor: 'rgba(28, 20, 14, 0.5)', // warm dark scrim
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
};

const content: CSSProperties = {
  position: 'fixed',
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 50,
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: Brand.cream,
  borderTopLeftRadius: 24,
  borderTopRightRadius: 24,
  borderTop: `1px solid ${Brand.brown10}`,
  boxShadow: '0 -8px 30px rgba(63, 46, 34, 0.18)',
  outline: 'none',
};

const handle: CSSProperties = {
  width: 44,
  height: 5,
  borderRadius: 999,
  backgroundColor: Brand.brown10,
  margin: '12px auto 4px',
  flexShrink: 0,
};

const srOnly: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
};
