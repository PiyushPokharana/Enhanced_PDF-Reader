export interface OCRToggleState {
    nativeTextVisible: boolean;
    ocrTextVisible: boolean;
}

type OCRToggleListener = (state: OCRToggleState) => void;

export class OCRToggleController {
    private state: OCRToggleState;
    private readonly listeners = new Set<OCRToggleListener>();

    constructor(initialState: Partial<OCRToggleState> = {}) {
        this.state = {
            nativeTextVisible: initialState.nativeTextVisible ?? true,
            ocrTextVisible: initialState.ocrTextVisible ?? false,
        };
    }

    get nativeTextVisible(): boolean {
        return this.state.nativeTextVisible;
    }

    get ocrTextVisible(): boolean {
        return this.state.ocrTextVisible;
    }

    getState(): OCRToggleState {
        return { ...this.state };
    }

    setNativeTextVisible(visible: boolean): OCRToggleState {
        return this.updateState({ nativeTextVisible: visible });
    }

    setOCRTextVisible(visible: boolean): OCRToggleState {
        return this.updateState({ ocrTextVisible: visible });
    }

    toggleNativeText(): OCRToggleState {
        return this.setNativeTextVisible(!this.state.nativeTextVisible);
    }

    toggleOCRText(): OCRToggleState {
        return this.setOCRTextVisible(!this.state.ocrTextVisible);
    }

    subscribe(listener: OCRToggleListener, emitImmediately = true): () => void {
        this.listeners.add(listener);
        if (emitImmediately) {
            listener(this.getState());
        }
        return () => {
            this.listeners.delete(listener);
        };
    }

    private updateState(partial: Partial<OCRToggleState>): OCRToggleState {
        this.state = { ...this.state, ...partial };
        const snapshot = this.getState();
        this.listeners.forEach((listener) => listener(snapshot));
        return snapshot;
    }
}
