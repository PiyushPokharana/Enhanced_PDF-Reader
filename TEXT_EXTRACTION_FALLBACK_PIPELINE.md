# Text Extraction Fallback Pipeline

This reader now uses an automatic, per-page text source pipeline:

1. Native PDF text extraction via PDF.js.
2. OCR fallback only when native text is insufficient.
3. Overlay rendering that stays aligned during zoom and resize.

## Page Decision Logic

For each page:

- Run `page.getTextContent()`.
- Compute:
  - `itemsCount = textContent.items.length`
  - `characterCount = joinedTextWithoutWhitespace.length`
- Native text is considered meaningful when:
  - `itemsCount > 0`
  - `characterCount > 20`

If meaningful:

- Source = `native`
- Render with PDF.js text layer.
- OCR is skipped.

If not meaningful:

- Source attempts `ocr`.
- Full page is rasterized and sent to OCR.

## OCR Fallback

Fallback rasterization uses the full page at high resolution:

```js
const ocrViewport = page.getViewport({ scale: 3 });
canvas.width = Math.ceil(ocrViewport.width);
canvas.height = Math.ceil(ocrViewport.height);
await page.render({ canvasContext, viewport: ocrViewport }).promise;
const imageDataUrl = canvas.toDataURL('image/png');
```

OCR engine order:

1. `window.performOCR(payload)` if provided (custom API adapter).
2. `window.Tesseract.recognize(...)` (Tesseract.js).

## Overlay Rendering

OCR results are normalized to a word+bbox format and rendered on an SVG overlay layer.

- Bounding boxes are converted from OCR image coordinates to PDF viewport coordinates.
- Alignment uses viewport matrix transforms and baseline anchoring.
- Overlay is recomputed on every page render (including zoom/resize) so it remains aligned.

## Caching Behavior

- `native` and `ocr` source selections are cached per page.
- OCR results are cached per page.
- OCR jobs are de-duplicated with in-flight promise tracking.
- If OCR engine is not yet available, page is left as `none` and retried later once the engine loads.

## Files

- Pipeline implementation: `public/app.js`
- OCR runtime loading: `app/components/PDFReaderApp.tsx`
- Coordinate alignment details: `OCR_OVERLAY_ALIGNMENT.md`
