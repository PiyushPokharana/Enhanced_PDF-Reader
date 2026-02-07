# OCR Overlay Alignment Guide

This document describes the coordinate transformation pipeline used to align OCR text overlays with rasterized PDF page images.

## Coordinate Pipeline

OCR bounding boxes come from image space with a top-left origin:

- `left`, `top`, `width`, `height` are in OCR image pixels.
- OCR image size is `ocrImageWidth`, `ocrImageHeight`.

PDF page rendering uses PDF.js viewport coordinates with bottom-left page coordinates internally and transformed viewport coordinates in the DOM.

### Step 1. Normalize OCR image coordinates

```text
leftRatio   = left / ocrImageWidth
rightRatio  = (left + width) / ocrImageWidth
topRatio    = top / ocrImageHeight
bottomRatio = (top + height) / ocrImageHeight
```

### Step 2. Convert to PDF page coordinates (bottom-left origin)

For page view box `[xMin, yMin, xMax, yMax]`:

```text
pageWidth  = xMax - xMin
pageHeight = yMax - yMin

pdfLeft   = xMin + leftRatio * pageWidth
pdfRight  = xMin + rightRatio * pageWidth
pdfTop    = yMin + (1 - topRatio) * pageHeight
pdfBottom = yMin + (1 - bottomRatio) * pageHeight
```

This is equivalent to the simpler no-rotation formula:

```text
scaleX = viewport.width / ocrImageWidth
scaleY = viewport.height / ocrImageHeight

mappedX = left * scaleX
mappedY = viewport.height - ((top + height) * scaleY)
```

### Step 3. Apply PDF.js viewport matrix

Using `viewport.transform = [a, b, c, d, e, f]`:

```text
X = a * x + c * y + e
Y = b * x + d * y + f
```

The transformation is applied to all 4 box corners so zoom, translation, and rotation stay exact.

### Step 4. Baseline-aligned text placement

Baseline is anchored to transformed `(pdfLeft, pdfBottom)`.  
Font size is computed from the transformed box height (cross-product area / baseline length) so alignment is stable even when page rotation is present.

## DPI Consistency

If OCR image dimensions are missing, fallback dimensions are derived from OCR DPI:

```text
ocrImageWidth  = pageWidthPoints  * dpi / 72
ocrImageHeight = pageHeightPoints * dpi / 72
```

Default fallback DPI is `300`.

## Integration API

`public/app.js` exposes global hooks:

- `window.setOCRPageData(pageNumber, pageData)`
- `window.setOCRDocumentData(documentData)`
- `window.toggleOCRDebug(enabled?)`

Accepted OCR page payloads support flexible structures (`words`, `tokens`, `lines`, `items`) and bbox forms:

- `{ left, top, width, height }`
- `{ x, y, w, h }`
- `{ x0, y0, x1, y1 }`
- `[x0, y0, x1, y1]`

## Debug Mode

When OCR debug is enabled:

- Bounding boxes are drawn over the page.
- Baseline lines are drawn for each word.
- Console logs include:
  - raw OCR bbox
  - computed scale factors
  - formula-based mapped coordinates
  - final matrix-transformed coordinates
  - deltas between simple formula mapping and rendered baseline

Use this to detect where misalignment starts (OCR source, scaling, or viewport transform).

## Reflow Triggers

OCR overlay is re-rendered whenever:

- page render runs
- zoom changes
- fit-width / fit-height changes
- window resize occurs (debounced)

This keeps OCR overlay synchronized with current viewport geometry.
