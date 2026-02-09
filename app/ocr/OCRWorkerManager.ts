import type { OCRPageImageInput, OCRStructuredResult } from "./types";

export interface OCRWorkerRequestMessage {
    type: "ocr:run";
    requestId: string;
    payload: OCRPageImageInput;
}

export interface OCRWorkerResultMessage {
    type: "ocr:result";
    requestId: string;
    payload: OCRStructuredResult;
}

export interface OCRWorkerErrorMessage {
    type: "ocr:error";
    requestId: string;
    error: string;
}

export type OCRWorkerResponseMessage = OCRWorkerResultMessage | OCRWorkerErrorMessage;

export interface WorkerLike {
    postMessage(message: unknown, transfer?: Transferable[]): void;
    terminate(): void;
    addEventListener(type: "message" | "error", listener: (event: unknown) => void): void;
    removeEventListener(type: "message" | "error", listener: (event: unknown) => void): void;
}

export type WorkerFactory = () => WorkerLike;

export interface OCRWorkerManagerOptions {
    maxConcurrent?: number;
}

type PendingRequest = {
    resolve: (value: OCRStructuredResult) => void;
    reject: (reason?: unknown) => void;
};

type QueuedRequest = {
    requestId: string;
    input: OCRPageImageInput;
    resolve: (value: OCRStructuredResult) => void;
    reject: (reason?: unknown) => void;
    signal?: AbortSignal;
    transfer?: Transferable[];
};

export class OCRWorkerManager {
    private readonly workerFactory: WorkerFactory;
    private worker: WorkerLike | null = null;
    private requestSequence = 0;
    private readonly pendingRequests = new Map<string, PendingRequest>();
    private readonly requestQueue: QueuedRequest[] = [];
    private readonly abortHandlers = new Map<string, { signal: AbortSignal; handler: () => void }>();
    private readonly canceledRequests = new Set<string>();
    private readonly maxConcurrent: number;
    private activeCount = 0;

    private readonly onWorkerMessage = (event: { data?: unknown }) => {
        this.handleWorkerMessage(event?.data);
    };

    private readonly onWorkerError = (event: unknown) => {
        let message = "OCR worker failed.";
        if (event && typeof event === "object") {
            const ev = event as Record<string, unknown>;
            if (typeof ev.message === "string" && ev.message) {
                message = `OCR worker failed: ${ev.message}`;
            } else if (ev.error instanceof Error) {
                message = `OCR worker failed: ${ev.error.message}`;
            }
        }
        this.rejectAll(new Error(message));
    };

    constructor(workerFactory: WorkerFactory, options: OCRWorkerManagerOptions = {}) {
        this.workerFactory = workerFactory;
        const configuredMax = Number(options.maxConcurrent ?? 1);
        this.maxConcurrent = Number.isFinite(configuredMax) && configuredMax > 0
            ? Math.floor(configuredMax)
            : 1;
    }

    static fromScript(workerScriptUrl: string, options: OCRWorkerManagerOptions = {}): OCRWorkerManager {
        return new OCRWorkerManager(() => {
            if (typeof Worker === "undefined") {
                throw new Error("Web Worker API is not available in this environment.");
            }
            return new Worker(workerScriptUrl);
        }, options);
    }

    runOCR(
        input: OCRPageImageInput,
        options: { signal?: AbortSignal; transfer?: Transferable[] } = {}
    ): Promise<OCRStructuredResult> {
        const normalizedInput = {
            ...input,
            pageNumber: this.normalizePageNumber(input.pageNumber),
        };
        const requestId = this.createRequestId(normalizedInput.pageNumber);
        const signal = options.signal;

        return new Promise<OCRStructuredResult>((resolve, reject) => {
            if (signal?.aborted) {
                reject(new Error("OCR request canceled."));
                return;
            }

            const request: QueuedRequest = {
                requestId,
                input: normalizedInput,
                resolve,
                reject,
                signal,
                transfer: options.transfer
            };

            if (signal) {
                const handler = () => this.cancelRequest(requestId, new Error("OCR request canceled."));
                signal.addEventListener("abort", handler, { once: true });
                this.abortHandlers.set(requestId, { signal, handler });
            }

            this.requestQueue.push(request);
            this.processQueue();
        });
    }

    cancelRequest(requestId: string, reason: Error = new Error("OCR request canceled.")): boolean {
        if (!requestId) return false;

        const queuedIndex = this.requestQueue.findIndex((request) => request.requestId === requestId);
        if (queuedIndex !== -1) {
            const [queued] = this.requestQueue.splice(queuedIndex, 1);
            this.cleanupAbortHandler(requestId);
            queued.reject(reason);
            return true;
        }

        const pending = this.pendingRequests.get(requestId);
        if (!pending) return false;

        this.pendingRequests.delete(requestId);
        this.canceledRequests.add(requestId);
        this.cleanupAbortHandler(requestId);
        pending.reject(reason);
        this.activeCount = Math.max(0, this.activeCount - 1);
        this.processQueue();
        return true;
    }

    terminate(): void {
        if (!this.worker) return;

        this.worker.removeEventListener("message", this.onWorkerMessage);
        this.worker.removeEventListener("error", this.onWorkerError);
        this.worker.terminate();
        this.worker = null;

        this.rejectAll(new Error("OCR worker was terminated."));
    }

    private ensureWorker(): WorkerLike {
        if (this.worker) {
            return this.worker;
        }

        const worker = this.workerFactory();
        worker.addEventListener("message", this.onWorkerMessage);
        worker.addEventListener("error", this.onWorkerError);
        this.worker = worker;
        return worker;
    }

    private handleWorkerMessage(data: unknown): void {
        if (this.isResultMessage(data)) {
            const pending = this.pendingRequests.get(data.requestId);
            if (!pending) return;
            this.pendingRequests.delete(data.requestId);
            this.cleanupAbortHandler(data.requestId);
            this.activeCount = Math.max(0, this.activeCount - 1);

            if (this.canceledRequests.has(data.requestId)) {
                this.canceledRequests.delete(data.requestId);
                this.processQueue();
                return;
            }

            pending.resolve(data.payload);
            this.processQueue();
            return;
        }

        if (this.isErrorMessage(data)) {
            const pending = this.pendingRequests.get(data.requestId);
            if (!pending) return;
            this.pendingRequests.delete(data.requestId);
            this.cleanupAbortHandler(data.requestId);
            this.activeCount = Math.max(0, this.activeCount - 1);

            if (this.canceledRequests.has(data.requestId)) {
                this.canceledRequests.delete(data.requestId);
                this.processQueue();
                return;
            }

            pending.reject(new Error(data.error || "Unknown OCR worker error."));
            this.processQueue();
        }
    }

    private rejectAll(error: Error): void {
        const pending = Array.from(this.pendingRequests.values());
        const queued = Array.from(this.requestQueue.values());

        this.pendingRequests.clear();
        this.requestQueue.length = 0;
        this.activeCount = 0;
        this.canceledRequests.clear();

        pending.forEach(({ reject }) => reject(error));
        queued.forEach(({ reject }) => reject(error));

        this.abortHandlers.forEach(({ signal, handler }) => {
            signal.removeEventListener("abort", handler);
        });
        this.abortHandlers.clear();
    }

    private processQueue(): void {
        if (this.activeCount >= this.maxConcurrent) return;

        while (this.activeCount < this.maxConcurrent && this.requestQueue.length > 0) {
            const next = this.requestQueue.shift();
            if (!next) break;
            if (this.canceledRequests.has(next.requestId)) {
                this.canceledRequests.delete(next.requestId);
                this.cleanupAbortHandler(next.requestId);
                continue;
            }

            const worker = this.ensureWorker();
            this.pendingRequests.set(next.requestId, {
                resolve: next.resolve,
                reject: next.reject
            });
            this.activeCount += 1;

            const message: OCRWorkerRequestMessage = {
                type: "ocr:run",
                requestId: next.requestId,
                payload: next.input
            };

            try {
                worker.postMessage(message, next.transfer);
            } catch (error) {
                this.pendingRequests.delete(next.requestId);
                this.cleanupAbortHandler(next.requestId);
                this.activeCount = Math.max(0, this.activeCount - 1);
                next.reject(error);
            }
        }
    }

    private cleanupAbortHandler(requestId: string): void {
        const entry = this.abortHandlers.get(requestId);
        if (!entry) return;
        entry.signal.removeEventListener("abort", entry.handler);
        this.abortHandlers.delete(requestId);
    }

    private createRequestId(pageNumber: number): string {
        this.requestSequence += 1;
        return `ocr-${pageNumber}-${this.requestSequence}`;
    }

    private normalizePageNumber(pageNumber: number): number {
        if (!Number.isInteger(pageNumber) || pageNumber < 1) {
            throw new RangeError(`Invalid page number: ${pageNumber}`);
        }
        return pageNumber;
    }

    private isResultMessage(data: unknown): data is OCRWorkerResultMessage {
        return (
            this.isObject(data) &&
            data.type === "ocr:result" &&
            typeof data.requestId === "string" &&
            this.isObject(data.payload)
        );
    }

    private isErrorMessage(data: unknown): data is OCRWorkerErrorMessage {
        return (
            this.isObject(data) &&
            data.type === "ocr:error" &&
            typeof data.requestId === "string" &&
            typeof data.error === "string"
        );
    }

    private isObject(value: unknown): value is Record<string, unknown> {
        return typeof value === "object" && value !== null;
    }
}
