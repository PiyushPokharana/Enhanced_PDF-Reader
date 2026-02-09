const OCR_LANGUAGE = "eng";
// Build absolute URLs so importScripts works regardless of worker origin
const _origin = (typeof self !== "undefined" && self.location && self.location.origin && self.location.origin !== "null")
    ? self.location.origin
    : "";
const LIB_PATH = _origin + "/lib/tesseract/";
const TESSERACT_SCRIPT_URL = LIB_PATH + "tesseract.min.js";
const WORKER_PATH = LIB_PATH + "worker.min.js";
const CORE_PATH = LIB_PATH + "tesseract-core.wasm.js";
// Use CDN for language data (trained models are not bundled locally)
const LANG_PATH = "https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0_best_int";

let tesseractLoadPromise = null;

function ensureTesseract() {
    if (self.Tesseract && typeof self.Tesseract.recognize === "function") {
        return Promise.resolve(self.Tesseract);
    }

    if (!tesseractLoadPromise) {
        tesseractLoadPromise = new Promise((resolve, reject) => {
            try {
                importScripts(TESSERACT_SCRIPT_URL);
                if (!self.Tesseract || typeof self.Tesseract.recognize !== "function") {
                    throw new Error("Tesseract did not initialize in OCR worker.");
                }
                resolve(self.Tesseract);
            } catch (error) {
                reject(error);
            }
        });
    }

    return tesseractLoadPromise;
}

function toFiniteNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function normalizeBBox(rawBBox) {
    const bbox = rawBBox || {};
    const x0 = toFiniteNumber(bbox.x0 ?? bbox.left ?? bbox.x);
    const y0 = toFiniteNumber(bbox.y0 ?? bbox.top ?? bbox.y);
    const x1 = toFiniteNumber(bbox.x1 ?? bbox.right);
    const y1 = toFiniteNumber(bbox.y1 ?? bbox.bottom);

    if (x0 === null || y0 === null || x1 === null || y1 === null) {
        return null;
    }

    return {
        left: Math.min(x0, x1),
        top: Math.min(y0, y1),
        width: Math.abs(x1 - x0),
        height: Math.abs(y1 - y0),
    };
}

function normalizeWord(rawWord) {
    if (!rawWord || typeof rawWord !== "object") return null;

    const text = String(rawWord.text ?? "").trim();
    if (!text) return null;

    const bbox = normalizeBBox(rawWord.bbox);
    if (!bbox || bbox.width <= 0 || bbox.height <= 0) return null;

    const confidence = toFiniteNumber(rawWord.confidence);
    return {
        text,
        bbox,
        confidence: confidence === null ? undefined : confidence,
    };
}

async function runOCR(payload) {
    const tesseract = await ensureTesseract();

    const hasImageUrl = typeof payload.imageDataUrl === "string" && payload.imageDataUrl.length > 0;

    if (!hasImageUrl) {
        throw new Error("Missing OCR image payload (expected imageDataUrl).");
    }

    const imagePayload = payload.imageDataUrl;

    // Configure with local paths; disable blob URLs to avoid origin issues in nested workers
    const result = await tesseract.recognize(imagePayload, OCR_LANGUAGE, {
        workerPath: WORKER_PATH,
        corePath: CORE_PATH,
        langPath: LANG_PATH,
        workerBlobURL: false
    });

    const wordsRaw = Array.isArray(result?.data?.words) ? result.data.words : [];
    const words = wordsRaw.map(normalizeWord).filter(Boolean);
    const confidence = toFiniteNumber(result?.data?.confidence);

    return {
        pageNumber: payload.pageNumber,
        text: typeof result?.data?.text === "string" ? result.data.text : "",
        words,
        metadata: {
            engine: "tesseract-worker-local",
            confidence: confidence === null ? undefined : confidence,
            width: payload.width,
            height: payload.height,
        },
    };
}

self.addEventListener("message", async (event) => {
    const message = event?.data;
    if (!message || message.type !== "ocr:run" || typeof message.requestId !== "string") {
        return;
    }

    try {
        const payload = message.payload || {};
        const pageNumber = Number(payload.pageNumber);
        if (!Number.isInteger(pageNumber) || pageNumber < 1) {
            throw new Error(`Invalid page number: ${payload.pageNumber}`);
        }
        if (typeof payload.imageDataUrl !== "string") {
            throw new Error("Missing OCR image payload (expected imageDataUrl).");
        }

        const result = await runOCR({
            ...payload,
            pageNumber,
        });

        self.postMessage({
            type: "ocr:result",
            requestId: message.requestId,
            payload: result,
        });
    } catch (error) {
        self.postMessage({
            type: "ocr:error",
            requestId: message.requestId,
            error: error instanceof Error ? error.message : String(error),
        });
    }
});
