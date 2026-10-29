// Cleans AutoCAD MTEXT formatting codes and returns plain text lines.
export function cleanTextLines(raw) {
  const s = String(raw ?? '')
    .replace(/\\P/g, '\n')                 // paragraph break (case-sensitive: \P, not \pi...)
    .replace(/\\p[^;]*;/g, '')              // paragraph indent / tab settings
    .replace(/\\[HWQTAFfCc][^;]*;/g, '')    // height, width, oblique, tracking, font, colour
    .replace(/\\[LlOoKk]/g, '')             // underline / overline / strike
    .replace(/\\~/g, ' ')
    .replace(/\\\\/g, '\\')
    .replace(/[{}]/g, '')
    .replace(/%%[cC]/g, 'Ø')
    .replace(/%%[dD]/g, '°');
  return s
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}
