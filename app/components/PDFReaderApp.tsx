'use client';

import { useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Type declarations for global objects
declare global {
    interface Window {
        pdfjsLib: typeof pdfjsLib;
        Quill: any;
        FixedEnhancedPDFReader: any;
        reader: any;
        TextLayerBuilder: any; // TextLayerBuilder class from pdfjs-dist/web/pdf_viewer
        EventBus: any; // EventBus class from pdfjs-dist/web/pdf_viewer
        Tesseract: any;
        performOCR?: (payload: { imageDataUrl: string; pageNumber: number }) => Promise<any>;
        setOCRPageData: (pageNumber: number, pageData: any) => void;
        setOCRDocumentData: (ocrDocumentData: any) => void;
        toggleOCRDebug: (enabled?: boolean) => boolean;
    }
}

// Set PDF.js worker - use the worker from the installed npm package
if (typeof window !== 'undefined') {
    // Use the worker bundled with the pdfjs-dist npm package (version 4.10.38)
    // This ensures API and Worker versions match exactly
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

export default function PDFReaderApp() {
    // This component is a client component that will handle all the PDF reader logic
    // The actual implementation uses the enhanced PDF reader class from app.js converted to React hooks

    useEffect(() => {
        // Dynamically load the Quill library
        if (typeof window !== 'undefined' && !window.Quill) {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/quill@1.3.7/dist/quill.min.js';
            script.onload = () => {
                console.log('✅ Quill loaded successfully');
            };
            document.head.appendChild(script);
        }

        // Dynamically load TextLayerBuilder and EventBus from PDF.js viewer module
        if (typeof window !== 'undefined' && !window.TextLayerBuilder) {
            import('pdfjs-dist/web/pdf_viewer.mjs').then((module) => {
                // Export TextLayerBuilder (correct name in v4.x) and EventBus to window
                window.TextLayerBuilder = module.TextLayerBuilder;
                window.EventBus = module.EventBus;
                console.log('✅ PDF.js TextLayerBuilder and EventBus loaded successfully');
            }).catch(error => {
                console.error('⚠️ Failed to load PDF.js viewer components:', error);
                console.error('Error details:', error.message);
            });
        }

        // Load Tesseract.js only when no custom OCR function is provided.
        if (typeof window !== 'undefined' && !window.Tesseract && typeof window.performOCR !== 'function') {
            const ocrScript = document.createElement('script');
            ocrScript.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
            ocrScript.async = true;
            ocrScript.onload = () => {
                console.log('Tesseract.js loaded for OCR fallback');
            };
            ocrScript.onerror = () => {
                console.warn('Tesseract.js failed to load; provide window.performOCR(payload) for OCR fallback');
            };
            document.head.appendChild(ocrScript);
        }
    }, []);

    return (
        <div className="app-container">
            {/* Refined Header */}
            <header className="app-header" id="appHeader">
                <div className="header-content">
                    <h1>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-cyan-400)' }}>
                            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                        </svg>
                        PDF Reader
                    </h1>
                    <div className="header-controls">
                        <button id="toggleView" className="btn btn--outline btn--sm">Double Page</button>
                        <button id="toggleOCRDebug" className="btn btn--outline btn--sm" title="Toggle OCR debug boxes">
                            OCR Debug Off
                        </button>
                        <button id="readingMode" className="btn btn--outline btn--sm reading-mode-btn" title="Reading Mode - Hide all panels">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                            </svg>
                            Reading
                        </button>
                        <button id="fullscreen" className="btn btn--outline btn--sm">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                            </svg>
                            Fullscreen
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="app-main">
                {/* Left Sidebar */}
                <aside className="sidebar" id="leftSidebar">
                    {/* Premium Upload Section */}
                    <section className="sidebar-section upload-section">
                        <div className="sidebar-section-header">
                            <h3>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="17 8 12 3 7 8" />
                                    <line x1="12" y1="3" x2="12" y2="15" />
                                </svg>
                                Upload PDF
                            </h3>
                        </div>
                        <div className="upload-content">
                            <div className="upload-area-compact">
                                <div className="upload-icon">
                                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--color-cyan-400)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                        <polyline points="14 2 14 8 20 8" />
                                        <line x1="12" y1="18" x2="12" y2="12" />
                                        <line x1="9" y1="15" x2="15" y2="15" />
                                    </svg>
                                </div>
                                <button id="uploadBtn" className="btn btn--primary">Choose PDF File</button>
                                <input type="file" id="fileInput" accept=".pdf" hidden />
                                <div className="upload-hint">
                                    <small>Or drag and drop a PDF file here</small>
                                </div>
                            </div>
                            <div id="fileInfo" className="file-info hidden">
                                <div className="file-name" id="fileName"></div>
                                <div className="file-status" id="fileStatus"></div>
                            </div>
                        </div>
                    </section>

                    {/* Table of Contents Section */}
                    <section className="sidebar-section toc-section">
                        <div className="sidebar-section-header">
                            <h3>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="8" y1="6" x2="21" y2="6" />
                                    <line x1="8" y1="12" x2="21" y2="12" />
                                    <line x1="8" y1="18" x2="21" y2="18" />
                                    <line x1="3" y1="6" x2="3.01" y2="6" />
                                    <line x1="3" y1="12" x2="3.01" y2="12" />
                                    <line x1="3" y1="18" x2="3.01" y2="18" />
                                </svg>
                                Contents
                            </h3>
                            <span className="toc-status" id="tocStatus">No PDF loaded</span>
                        </div>
                        <div className="toc-container" id="tocContainer">
                            <div className="toc-placeholder">
                                <p>Upload a PDF to see the table of contents</p>
                            </div>
                        </div>
                    </section>

                    {/* Left Panel Quick Access Icons */}
                    <div className="panel-icons left-panel-icons">
                        <button id="leftTocIcon" className="panel-icon active" title="Table of Contents" data-tab="toc">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="8" y1="6" x2="21" y2="6" />
                                <line x1="8" y1="12" x2="21" y2="12" />
                                <line x1="8" y1="18" x2="21" y2="18" />
                                <line x1="3" y1="6" x2="3.01" y2="6" />
                                <line x1="3" y1="12" x2="3.01" y2="12" />
                                <line x1="3" y1="18" x2="3.01" y2="18" />
                            </svg>
                        </button>
                    </div>
                </aside>

                {/* Center Content Area */}
                <div className="content-area">
                    {/* PDF Reader Controls */}
                    <div className="reader-controls" id="readerControls">
                        <div className="nav-controls">
                            <button id="prevPage" className="btn btn--secondary btn--sm">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="15 18 9 12 15 6" />
                                </svg>
                                Prev
                            </button>
                            <span className="page-info" id="pageInfo">No PDF loaded</span>
                            <button id="nextPage" className="btn btn--secondary btn--sm">
                                Next
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="9 18 15 12 9 6" />
                                </svg>
                            </button>
                        </div>

                        <div className="zoom-controls">
                            <button id="zoomOut" className="btn btn--secondary btn--sm">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                </svg>
                            </button>
                            <span className="zoom-info-container">
                                <input type="text" id="zoomInfo" className="zoom-input" defaultValue="100%" readOnly />
                            </span>
                            <button id="zoomIn" className="btn btn--secondary btn--sm">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="12" y1="5" x2="12" y2="19" />
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                </svg>
                            </button>
                            <button id="fitWidth" className="btn btn--outline btn--sm" title="Fit to container width">Fit W</button>
                            <button id="fitHeight" className="btn btn--outline btn--sm" title="Fit to container height">Fit H</button>
                            <button id="resetZoom" className="btn btn--outline btn--sm" title="Reset to Fit Width">Reset</button>
                        </div>
                    </div>

                    {/* PDF Container */}
                    <div className="reader-area">
                        <div className="pdf-container" id="pdfContainer">
                            {/* Premium Empty State */}
                            <div className="pdf-placeholder" id="pdfPlaceholder">
                                <div className="placeholder-content">
                                    <div className="placeholder-icon">
                                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--color-cyan-400)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                                            <path d="M8 7h6" />
                                            <path d="M8 11h8" />
                                            <path d="M8 15h4" />
                                        </svg>
                                    </div>
                                    <h2>Welcome to PDF Reader</h2>
                                    <p>Upload a PDF file from the sidebar to start reading with powerful features</p>
                                    <ul className="feature-list">
                                        <li>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-cyan-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginRight: 8 }}>
                                                <polyline points="20 6 9 17 4 12" />
                                            </svg>
                                            Interactive table of contents
                                        </li>
                                        <li>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-cyan-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginRight: 8 }}>
                                                <polyline points="20 6 9 17 4 12" />
                                            </svg>
                                            Zoom and navigation controls
                                        </li>
                                        <li>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-amber-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginRight: 8 }}>
                                                <polyline points="20 6 9 17 4 12" />
                                            </svg>
                                            Text highlighting and notes
                                        </li>
                                        <li>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-violet-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginRight: 8 }}>
                                                <polyline points="20 6 9 17 4 12" />
                                            </svg>
                                            AI-powered document analysis
                                        </li>
                                        <li>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-cyan-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginRight: 8 }}>
                                                <polyline points="20 6 9 17 4 12" />
                                            </svg>
                                            Responsive design
                                        </li>
                                    </ul>
                                </div>
                            </div>
                            {/* PDF Page Wrapper - positions canvas and text/highlight layers together */}
                            <div className="pdf-page-wrapper hidden" id="pdfPageWrapper">
                                <canvas id="pdfCanvas" className="pdf-canvas"></canvas>
                                <div id="ocrLayer" className="ocr-layer"></div>
                                <div id="textLayer" className="text-layer"></div>
                                <div id="highlightLayer" className="highlight-layer"></div>
                            </div>
                            {/* Second page wrapper for double-page mode */}
                            <div className="pdf-page-wrapper hidden" id="pdfPageWrapper2">
                                <canvas id="pdfCanvas2" className="pdf-canvas"></canvas>
                                <div id="ocrLayer2" className="ocr-layer"></div>
                                <div id="textLayer2" className="text-layer"></div>
                                <div id="highlightLayer2" className="highlight-layer"></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Panel */}
                <aside className="right-panel" id="rightPanel">
                    {/* Dynamic Content Area */}
                    <div className="panel-content" id="panelContent">
                        {/* AI Assistant Tab */}
                        <div className="panel-tab hidden" id="aiTab">
                            <div className="panel-section-header">
                                <h3>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-violet-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M12 8V4H8" />
                                        <rect width="16" height="12" x="4" y="8" rx="2" />
                                        <path d="M2 14h2" />
                                        <path d="M20 14h2" />
                                        <path d="M15 13v2" />
                                        <path d="M9 13v2" />
                                    </svg>
                                    AI Assistant
                                </h3>
                                <button id="clearChat" className="btn btn--secondary btn--sm">Clear</button>
                            </div>
                            <div className="tab-content">
                                <div className="ai-chat-container" id="aiChatContainer">
                                    <div className="ai-message system-message">
                                        <p>Hi! I'm your AI assistant. Upload a PDF and I'll help you analyze and understand its content. Ask me questions about the document!</p>
                                    </div>
                                </div>
                                <div className="ai-input-area">
                                    <div className="api-key-setup" id="apiKeySetup">
                                        <input type="password" id="apiKeyInput" placeholder="Enter your OpenAI API key..." className="form-control" />
                                        <button id="saveApiKey" className="btn btn--primary btn--sm">Save Key</button>
                                    </div>
                                    <div className="chat-input-container hidden" id="chatInputContainer">
                                        <textarea id="aiInput" placeholder="Ask a question about the document..." rows={2} className="form-control"></textarea>
                                        <button id="sendMessage" className="btn btn--primary btn--sm">Send</button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Highlights Tab */}
                        <div className="panel-tab hidden" id="highlightsTab">
                            <div className="panel-section-header">
                                <h3>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-amber-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="m9 11-6 6v3h9l3-3" />
                                        <path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" />
                                    </svg>
                                    Highlights
                                </h3>
                                <button id="clearHighlights" className="btn btn--secondary btn--sm">Clear All</button>
                            </div>
                            <div className="tab-content">
                                <div className="highlights-content" id="highlightsContent">
                                    <div className="highlights-placeholder">
                                        <p>Highlighted text will appear here</p>
                                        <small>Select text in the PDF to highlight it</small>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Notes Tab */}
                        <div className="panel-tab hidden" id="notesTab">
                            <div className="panel-section-header">
                                <h3>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M12 20h9" />
                                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                                    </svg>
                                    Notes
                                </h3>
                                <button id="saveNotes" className="btn btn--primary btn--sm">Save</button>
                            </div>
                            <div className="tab-content">
                                <div className="notes-content">
                                    <div id="notesEditor" className="notes-editor"></div>
                                </div>
                            </div>
                        </div>

                        {/* Default Welcome Content */}
                        <div className="panel-tab" id="welcomeTab">
                            <div className="welcome-content">
                                <div className="welcome-icon">
                                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-cyan-400)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                                    </svg>
                                </div>
                                <h3>Enhanced Features</h3>
                                <p>Click the icons below to access powerful features:</p>
                                <ul className="feature-list">
                                    <li style={{ display: 'flex', alignItems: 'center' }}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-violet-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginRight: 8 }}>
                                            <path d="M12 8V4H8" />
                                            <rect width="16" height="12" x="4" y="8" rx="2" />
                                        </svg>
                                        <strong style={{ color: 'var(--color-violet-400)', marginRight: 4 }}>AI Assistant</strong> - Ask questions
                                    </li>
                                    <li style={{ display: 'flex', alignItems: 'center' }}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-amber-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginRight: 8 }}>
                                            <path d="m9 11-6 6v3h9l3-3" />
                                        </svg>
                                        <strong style={{ color: 'var(--color-amber-400)', marginRight: 4 }}>Highlights</strong> - Mark text
                                    </li>
                                    <li style={{ display: 'flex', alignItems: 'center' }}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-cyan-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginRight: 8 }}>
                                            <path d="M12 20h9" />
                                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                                        </svg>
                                        <strong style={{ color: 'var(--color-cyan-400)', marginRight: 4 }}>Notes</strong> - Take notes
                                    </li>
                                </ul>
                                <p><small>Upload a PDF to get started!</small></p>
                            </div>
                        </div>
                    </div>

                    {/* Right Panel Quick Access Icons */}
                    <div className="panel-icons right-panel-icons">
                        <button id="rightAIIcon" className="panel-icon" title="AI Assistant" data-tab="ai">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 8V4H8" />
                                <rect width="16" height="12" x="4" y="8" rx="2" />
                                <path d="M2 14h2" />
                                <path d="M20 14h2" />
                                <path d="M15 13v2" />
                                <path d="M9 13v2" />
                            </svg>
                        </button>
                        <button id="rightHighlightsIcon" className="panel-icon" title="Highlights" data-tab="highlights">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m9 11-6 6v3h9l3-3" />
                                <path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" />
                            </svg>
                        </button>
                        <button id="rightNotesIcon" className="panel-icon" title="Notes" data-tab="notes">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 20h9" />
                                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                            </svg>
                        </button>
                    </div>
                </aside>
            </main>

            {/* Loading Indicator */}
            <div className="loading-indicator hidden" id="loadingIndicator">
                <div className="loading-spinner"></div>
                <p id="loadingText">Loading PDF...</p>
            </div>

            {/* Error Modal */}
            <div className="modal hidden" id="errorModal">
                <div className="modal-content">
                    <div className="modal-header">
                        <h3>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 8 }}>
                                <circle cx="12" cy="12" r="10" />
                                <line x1="15" y1="9" x2="9" y2="15" />
                                <line x1="9" y1="9" x2="15" y2="15" />
                            </svg>
                            Error
                        </h3>
                        <button id="closeError" className="btn btn--secondary btn--sm">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </div>
                    <div className="modal-body">
                        <p id="errorMessage">An error occurred while processing the PDF.</p>
                    </div>
                    <div className="modal-footer">
                        <button id="errorOk" className="btn btn--primary">OK</button>
                    </div>
                </div>
            </div>

            {/* Highlight Context Menu */}
            <div className="context-menu hidden" id="highlightMenu">
                <button id="highlightYellow" className="context-menu-item">
                    <span style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--highlight-yellow)', boxShadow: '0 0 6px var(--highlight-yellow)' }}></span>
                    Yellow
                </button>
                <button id="highlightGreen" className="context-menu-item">
                    <span style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--highlight-green)', boxShadow: '0 0 6px var(--highlight-green)' }}></span>
                    Green
                </button>
                <button id="highlightBlue" className="context-menu-item">
                    <span style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--highlight-blue)', boxShadow: '0 0 6px var(--highlight-blue)' }}></span>
                    Blue
                </button>
                <button id="highlightRed" className="context-menu-item">
                    <span style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--highlight-red)', boxShadow: '0 0 6px var(--highlight-red)' }}></span>
                    Red
                </button>
                <button id="removeHighlight" className="context-menu-item">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-error)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                    Remove
                </button>
            </div>

            {/* Fullscreen UI Controls Overlay */}
            <div className="fullscreen-overlay hidden" id="fullscreenOverlay">
                <div className="fullscreen-controls">
                    <button id="exitFullscreen" className="btn btn--secondary btn--sm">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                        </svg>
                        Exit Fullscreen
                    </button>
                    <div className="fullscreen-nav">
                        <button id="fullscreenPrev" className="btn btn--secondary btn--sm">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="15 18 9 12 15 6" />
                            </svg>
                            Prev
                        </button>
                        <span id="fullscreenPageInfo" className="page-info">Page 1 of 1</span>
                        <button id="fullscreenNext" className="btn btn--secondary btn--sm">
                            Next
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="9 18 15 12 9 6" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* Initialize the PDF Reader after mount */}
            <PDFReaderInitializer />
        </div>
    );
}

/**
 * Client component that initializes the PDF reader with the existing app.js logic
 * This component handles loading the original JavaScript class after hydration
 */
function PDFReaderInitializer() {
    useEffect(() => {
        // Make pdfjsLib globally available for app.js
        if (typeof window !== 'undefined') {
            (window as any).pdfjsLib = pdfjsLib;
        }

        // Dynamically import and initialize the PDF reader
        const initializeReader = async () => {
            // Load the original app.js logic
            const script = document.createElement('script');
            script.src = 'public/app.js';
            script.type = 'text/javascript';

            // Critical: Wait for script to load, then manually trigger initialization
            script.onload = () => {
                console.log('✅ app.js loaded successfully');

                // Manually trigger initialization since DOMContentLoaded has already fired
                if ((window as any).FixedEnhancedPDFReader) {
                    (window as any).reader = new (window as any).FixedEnhancedPDFReader();

                    // Load saved data
                    if ((window as any).reader.loadHighlights) {
                        (window as any).reader.loadHighlights();
                    }

                    // Check for saved API key
                    try {
                        const savedKey = localStorage.getItem('pdf-reader-api-key');
                        if (savedKey) {
                            const apiKeyInput = document.getElementById('apiKeyInput') as HTMLInputElement;
                            if (apiKeyInput) {
                                apiKeyInput.value = savedKey;
                                setTimeout(() => {
                                    document.getElementById('saveApiKey')?.click();
                                }, 100);
                            }
                        }
                    } catch (error) {
                        console.warn('Could not load saved API key:', error);
                    }

                    console.log('🎉 PDF Reader initialized successfully');
                } else {
                    console.error('❌ FixedEnhancedPDFReader class not found in app.js');
                }
            };

            script.onerror = () => {
                console.error('❌ Failed to load app.js');
            };

            document.body.appendChild(script);
        };

        // Wait for DOM to be fully ready
        if (typeof window !== 'undefined') {
            initializeReader();
        }

        return () => {
            // Cleanup if needed
        };
    }, []);

    return null;
}
