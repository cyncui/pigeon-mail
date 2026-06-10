/**
 * Greedy word-wrap layout for the calligraphy editor. Pure math: the caller
 * supplies a per-character width function (backed by a Skia font + cache) and
 * gets back where every glyph sits and where the caret belongs for any text
 * index. Kerning is ignored — additive widths are indistinguishable at
 * handwriting sizes with a casual script face.
 */

export type GlyphPos = {
  char: string;
  /** Index into the source text (for stable keys across reflow). */
  index: number;
  x: number;
  line: number;
};

export type CaretPos = { x: number; line: number };

export type ScriptLayout = {
  glyphs: GlyphPos[];
  /** carets[i] = caret position before char i; carets[text.length] = end. */
  carets: CaretPos[];
  lineCount: number;
};

export function layoutScript(
  text: string,
  charWidth: (ch: string) => number,
  maxWidth: number,
): ScriptLayout {
  const glyphs: GlyphPos[] = [];
  const carets: CaretPos[] = new Array(text.length + 1);
  let x = 0;
  let line = 0;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (ch === '\n') {
      carets[i] = { x, line };
      line += 1;
      x = 0;
      i += 1;
      continue;
    }

    if (ch === ' ') {
      carets[i] = { x, line };
      const w = charWidth(' ');
      if (x + w > maxWidth) {
        // A space at the edge becomes the line break itself.
        line += 1;
        x = 0;
      } else if (x > 0) {
        glyphs.push({ char: ch, index: i, x, line });
        x += w;
      }
      i += 1;
      continue;
    }

    // Measure the word ahead; wrap before it if it won't fit on this line.
    let end = i;
    let wordW = 0;
    while (end < text.length && text[end] !== ' ' && text[end] !== '\n') {
      wordW += charWidth(text[end]);
      end += 1;
    }
    if (x > 0 && x + wordW > maxWidth) {
      line += 1;
      x = 0;
    }
    // Lay the word down, hard-breaking only if it alone exceeds the line.
    for (let j = i; j < end; j += 1) {
      const w = charWidth(text[j]);
      if (x > 0 && x + w > maxWidth) {
        line += 1;
        x = 0;
      }
      carets[j] = { x, line };
      glyphs.push({ char: text[j], index: j, x, line });
      x += w;
    }
    i = end;
  }

  carets[text.length] = { x, line };
  // Backfill any gaps (defensive — every index should be set above).
  for (let k = 0; k <= text.length; k += 1) {
    if (!carets[k]) carets[k] = { x: 0, line: 0 };
  }

  return { glyphs, carets, lineCount: line + 1 };
}
