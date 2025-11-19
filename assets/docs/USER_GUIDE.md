# TextDiffy — User Guide

## What it does
TextDiffy compares two pieces of text completely in your browser and shows a color-coded diff similar to Git.

## Steps
1. Paste or type your first text into `Input A`.
2. Paste or type your second text into `Input B`.
3. Adjust settings if needed:
   - Whitespace sensitive: when off, multiple spaces/tabs collapse and ends are trimmed before comparing.
   - Case sensitive: when off, comparison ignores letter case.
   - Granularity:
     - line: highlight changes at the line level only.
     - word: highlight changed words within modified lines.
     - character: highlight changed characters within modified lines.
4. Click `Compare`.

## Interpreting results
- Green lines (`+`): Added.
- Red lines (`−`): Removed.
- Orange lines (`~` with two sub-lines): Modified; the first shows removals, the second shows additions with inline highlights.
- Neutral lines: Unchanged.
- Metrics above the output show counts of added, removed, and modified lines.

## Copy and Export
- Copy Output to Clipboard: copies a plain-text diff with prefixes `+`, `-`, `~`, and spaces for unchanged.
- Export as Text File: downloads the same plain-text diff as `textdiffy-diff.txt`.

## Tips
- For large inputs, keep the browser tab active while diffing; the app yields to keep the UI responsive.
- Works offline; no data leaves your device.
- Supports Chrome, Edge, Firefox, and generally Safari.
