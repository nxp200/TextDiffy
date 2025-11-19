# TextDiffy — Technical Documentation

## System Architecture
- Pure front-end static app.
- Files:
  - `index.html`: UI layout and bindings.
  - `css/styles.css`, `css/styles.min.css`: responsive, accessible styles.
  - `js/app.js` (ES module), `js/app.min.js`: application logic (minified build).
  - `assets/docs/TECHNICAL.md`: this document.
  - `assets/docs/USER_GUIDE.md`: user instructions.
  - `tests/tests.html`, `tests/tests.js`: browser-run tests.
- No network calls, no storage, no bundlers. Open `index.html` directly from files.

## Diff Algorithm
- Primary algorithm: Patience Diff (efficient, stable, intuitive outputs).
- Steps:
  1. Normalize lines based on whitespace/case settings.
  2. Compute anchors using items unique in both A and B.
  3. Find Longest Increasing Subsequence (LIS) over anchor positions.
  4. Recursively diff between anchors.
  5. Trim equal prefixes/suffixes for efficiency.
  6. Produce ops: `equal`, `insert`, `delete`.
  7. Collapse adjacent `delete` + `insert` into `modify` when 1:1.
- Granular sub-diff:
  - Tokenization:
    - word mode: sequence of letters/digits/underscore OR single punctuation OR whitespace; Unicode-aware when available.
    - char mode: JavaScript code points via `Array.from()`.
  - Diff tokens via same patience algorithm to produce `{type: add|remove|same, text}` parts.

## Preprocessing Rules
- `whitespaceSensitive`:
  - true: lines unchanged.
  - false: collapse internal whitespace to single spaces and trim ends.
- `caseSensitive`:
  - true: lines unchanged.
  - false: convert to lowercase for comparison.
- Granularity options: `line`, `word`, `char` affect only modified-line inline highlighting.

## Layout & Breakpoints
- Desktop (>= 768px): CSS grid with 3 equal columns for A, B, and Output.
- Mobile (<= 768px): stack panels vertically in order A → B → Output.
- Diff pane is scrollable, monospace font, color-coded borders/backgrounds.

## Accessibility
- Semantic structure with `header`, `main`, `section`, `footer`.
- ARIA labels on inputs and output region (`role=region`) and metrics (`aria-live=polite`).
- Keyboard focusable diff output (`tabindex=0`).
- High-contrast color choices and focus outlines.

## Performance
- Linear-time operations dominate (maps, LIS) with short yielding using `setTimeout(0)` to keep UI responsive.
- Diff for ~500KB typical text should complete under 2s on modern browsers.
- Rendering uses `DocumentFragment` to minimize reflow.

## Extensibility
- Add new granular mode: implement a tokenizer and pass to `patienceDiff`.
- Swap algorithm: drop-in replace `patienceDiff` with Myers if needed.
- Colors/layout: adjust CSS variables in `:root`.

## File Export & Clipboard
- Clipboard: `navigator.clipboard.writeText()` with textarea fallback.
- Export: Blob + temporary `<a download>`; includes markers `+`, `-`, `~` with inline `{+ +}` and `{- -}` for modifies.
