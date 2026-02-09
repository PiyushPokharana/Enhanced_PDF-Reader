import type { OCRStructuredResult } from "./types";

export interface OCRCacheManagerOptions {
    maxEntries?: number;
}

export class OCRCacheManager<T = OCRStructuredResult> {
    private readonly cache = new Map<number, T>();
    private readonly maxEntries: number;

    constructor(options: OCRCacheManagerOptions = {}) {
        const configuredMaxEntries = Number(options.maxEntries ?? 40);
        this.maxEntries = Number.isFinite(configuredMaxEntries) && configuredMaxEntries > 0
            ? Math.floor(configuredMaxEntries)
            : 40;
    }

    getOCR(pageNumber: number): T | undefined {
        const key = this.normalizePageNumber(pageNumber);
        const value = this.cache.get(key);
        if (value === undefined) return undefined;

        // LRU refresh
        this.cache.delete(key);
        this.cache.set(key, value);
        return value;
    }

    setOCR(pageNumber: number, data: T): void {
        const key = this.normalizePageNumber(pageNumber);
        if (this.cache.has(key)) {
            this.cache.delete(key);
        }
        this.cache.set(key, data);
        this.evictLRUIfNeeded();
    }

    hasOCR(pageNumber: number): boolean {
        return this.cache.has(this.normalizePageNumber(pageNumber));
    }

    deleteOCR(pageNumber: number): boolean {
        return this.cache.delete(this.normalizePageNumber(pageNumber));
    }

    entries(): Array<[number, T]> {
        return Array.from(this.cache.entries());
    }

    evictFarPages(currentPage: number, keepDistance: number, pinnedPages: number[] = []): number {
        const anchor = this.normalizePageNumber(currentPage);
        const distance = Number.isFinite(keepDistance) ? Math.max(0, Math.floor(keepDistance)) : 0;
        const pinned = new Set(
            pinnedPages.filter((page) => Number.isInteger(page) && page > 0)
        );

        let evicted = 0;
        for (const [pageNumber] of this.cache) {
            if (pinned.has(pageNumber)) continue;
            if (Math.abs(pageNumber - anchor) <= distance) continue;
            this.cache.delete(pageNumber);
            evicted += 1;
        }
        return evicted;
    }

    clear(): void {
        this.cache.clear();
    }

    private evictLRUIfNeeded(): void {
        while (this.cache.size > this.maxEntries) {
            const lruKey = this.cache.keys().next().value;
            if (lruKey === undefined) break;
            this.cache.delete(lruKey);
        }
    }

    private normalizePageNumber(pageNumber: number): number {
        if (!Number.isInteger(pageNumber) || pageNumber < 1) {
            throw new RangeError(`Invalid page number: ${pageNumber}`);
        }
        return pageNumber;
    }
}
