export interface OCRBoundingBox {
    left: number;
    top: number;
    width: number;
    height: number;
}

export interface OCRWord {
    text: string;
    bbox: OCRBoundingBox;
    confidence?: number;
}

export interface OCRPageImageInput {
    pageNumber: number;
    imageDataUrl?: string;
    buffer?: ArrayBuffer;
    width?: number;
    height?: number;
}

export interface OCRStructuredResult {
    pageNumber: number;
    text?: string;
    words: OCRWord[];
    metadata?: Record<string, unknown>;
}
