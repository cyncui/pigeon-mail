import type { CSSProperties } from 'react';

// Just the blur. It must NOT live inside a reanimated-animated view — that
// promotes a compositing layer which isolates backdrop-filter so it can no
// longer sample the feed behind the modal. The dark tint (which DOES animate)
// is a separate layer in create.tsx.
const style: CSSProperties = {
  position: 'absolute',
  inset: 0,
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  pointerEvents: 'none',
};

export function ModalScrim() {
  return <div aria-hidden="true" style={style} />;
}
