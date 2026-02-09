export interface OCROverlayLayerOptions {
    id?: string;
    className?: string;
    zIndex?: number;
}

type OverlayElementFactory = () => HTMLDivElement;

const defaultElementFactory: OverlayElementFactory = () => {
    if (typeof document === "undefined") {
        throw new Error("Cannot create OCROverlayLayer without a DOM environment.");
    }
    return document.createElement("div");
};

export class OCROverlayLayer {
    private readonly layerElement: HTMLDivElement;
    private visible = false;

    constructor(
        options: OCROverlayLayerOptions = {},
        elementFactory: OverlayElementFactory = defaultElementFactory
    ) {
        const id = options.id ?? "ocrOverlayLayer";
        const className = options.className ?? "ocr-overlay-layer";
        const zIndex = options.zIndex ?? 2;

        this.layerElement = elementFactory();
        this.layerElement.id = id;
        this.layerElement.className = className;
        this.layerElement.setAttribute("aria-hidden", "true");
        this.layerElement.style.position = "absolute";
        this.layerElement.style.inset = "0";
        this.layerElement.style.pointerEvents = "none";
        this.layerElement.style.zIndex = String(zIndex);
        this.layerElement.style.display = "none";
    }

    mount(container: HTMLElement): HTMLDivElement {
        if (typeof window !== "undefined") {
            const computed = window.getComputedStyle(container);
            if (computed.position === "static") {
                container.style.position = "relative";
            }
        }

        if (this.layerElement.parentElement !== container) {
            this.unmount();
            container.appendChild(this.layerElement);
        }

        return this.layerElement;
    }

    unmount(): void {
        if (this.layerElement.parentElement) {
            this.layerElement.parentElement.removeChild(this.layerElement);
        }
    }

    show(): void {
        this.visible = true;
        this.layerElement.style.display = "block";
    }

    hide(): void {
        this.visible = false;
        this.layerElement.style.display = "none";
    }

    isVisible(): boolean {
        return this.visible;
    }

    clear(): void {
        this.layerElement.replaceChildren();
    }

    setContent(content: Node): void {
        this.layerElement.replaceChildren(content);
    }

    getElement(): HTMLDivElement {
        return this.layerElement;
    }
}
