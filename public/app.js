// Set PDF.js worker path — use locally bundled worker for offline support & version consistency
// In Next.js this is overridden by PDFReaderApp.tsx before app.js loads
if (typeof pdfjsLib !== 'undefined' && typeof pdfjsLib.GlobalWorkerOptions !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/lib/pdf.worker.min.mjs';
}

/**
 * Fixed Enhanced PDF E-book Reader
 * Key fixes and improvements:
 * 1. Fixed panel functionality with tab-based approach
 * 2. Fixed AI API integration with proper error handling
 * 3. Fixed double page view functionality
 * 4. Enhanced fullscreen mode with auto-hiding controls
 */
class FixedEnhancedPDFReader {
    constructor() {
        // PDF.js properties
        this.pdfDoc = null;
        this.currentPage = 1;
        this.totalPages = 0;
        this.scale = 1.0;
        this.isDoublePageMode = false;
        this.isFullscreen = false;
        this.isFitWidthMode = false;
        this.isFitHeightMode = false;
        this.isReadingMode = false;

        // TOC properties
        this.outline = null;
        this.tocItems = [];
        this.activeTocItem = null;

        // Page wrapper elements (contain canvas + text layer + highlight layer)
        this.pageWrapper1 = document.getElementById('pdfPageWrapper');
        this.pageWrapper2 = document.getElementById('pdfPageWrapper2');

        // Canvas elements
        this.canvas1 = document.getElementById('pdfCanvas');
        this.canvas2 = document.getElementById('pdfCanvas2');
        this.ctx1 = this.canvas1?.getContext('2d');
        this.ctx2 = this.canvas2?.getContext('2d');

        // Text layer elements
        this.textLayer1 = document.getElementById('textLayer');
        this.textLayer2 = document.getElementById('textLayer2');
        this.ocrLayer1 = document.getElementById('ocrLayer');
        this.ocrLayer2 = document.getElementById('ocrLayer2');
        this.ocrToggleBtn1 = document.getElementById('toggleOCRPage1');
        this.ocrToggleBtn2 = document.getElementById('toggleOCRPage2');

        // OCR overlay state
        this.ocrDataByPage = new Map();
        this.ocrCacheManager = this.createOCRCacheManager();
        this.ocrWorkerManager = this.createOCRWorkerManager();
        this.ocrDebugMode = false;
        this.defaultOCRDpi = 300;
        this.ocrRenderScale = 3;
        this.ocrPreparationRange = 1;
        this.ocrCacheDistance = 3;
        this.ocrMaxConcurrent = 1;
        this.nativeTextCharThreshold = 20;
        this.pageTextSourceByPage = new Map();
        this.pageTextStatsByPage = new Map();
        this.ocrJobsByPage = new Map();
        this.ocrViewEnabledByPage = new Map();
        this.backgroundOCRChain = Promise.resolve();
        this.ocrMeasureCanvas = null;
        this.ocrMeasureCtx = null;
        this.ocrSessionId = 0;
        this.resizeDebounceTimer = null;
        this.pageVisibilityObserver = null;
        this.pageVisibilityRoot = null;

        // Enhanced features
        this.highlights = [];
        this.aiApiKey = null;
        this.notesEditor = null;
        this.selectedText = '';
        this.currentTab = 'welcome';

        // Fullscreen properties
        this.fullscreenTimer = null;
        this.mouseMoveTimer = null;

        // Bound event handlers (stored for cleanup/removal)
        this._boundHandlers = {};

        // Sidebar collapse states (persist in localStorage)
        this.leftSidebarCollapsed = localStorage.getItem('leftSidebarCollapsed') === 'true';
        this.rightPanelCollapsed = localStorage.getItem('rightPanelCollapsed') === 'true';

        // Expose OCR hooks for external pipeline integrations
        if (typeof window !== 'undefined') {
            window.setOCRPageData = (pageNumber, pageData) => this.setOCRPageData(pageNumber, pageData);
            window.setOCRDocumentData = (ocrDocumentData) => this.setOCRDocumentData(ocrDocumentData);
            window.toggleOCRDebug = (enabled) => this.setOCRDebugMode(enabled);
        }

        // Initialize after DOM is ready
        setTimeout(() => {
            this.initializeEventListeners();
            this.initializeTabSystem();
            this.initializeFullscreenControls();
            this.initializePanelToggles();
            this.initializeResizeHandling();
            this.initializePageVisibilityObserver();
            this.updateOCRDebugButton();
            this.updateUIState();
        }, 100);
    }

    initializeEventListeners() {
        console.log('🔧 Initializing fixed event listeners...');

        // File upload
        const uploadBtn = document.getElementById('uploadBtn');
        const fileInput = document.getElementById('fileInput');

        if (uploadBtn && fileInput) {
            uploadBtn.addEventListener('click', (e) => {
                e.preventDefault();
                fileInput.click();
            });

            fileInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files[0]) {
                    this.handleFileUpload(e.target.files[0]);
                }
            });
        }

        // Navigation controls
        const prevBtn = document.getElementById('prevPage');
        const nextBtn = document.getElementById('nextPage');
        if (prevBtn) prevBtn.addEventListener('click', () => this.previousPage());
        if (nextBtn) nextBtn.addEventListener('click', () => this.nextPage());

        // Zoom controls
        const zoomInBtn = document.getElementById('zoomIn');
        const zoomOutBtn = document.getElementById('zoomOut');
        const fitWidthBtn = document.getElementById('fitWidth');
        const zoomInput = document.getElementById('zoomInfo');

        if (zoomInBtn) zoomInBtn.addEventListener('click', () => this.zoomIn());
        if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => this.zoomOut());
        if (fitWidthBtn) fitWidthBtn.addEventListener('click', () => this.fitToWidth());

        const fitHeightBtn = document.getElementById('fitHeight');
        if (fitHeightBtn) fitHeightBtn.addEventListener('click', () => this.fitToHeight());

        const resetZoomBtn = document.getElementById('resetZoom');
        if (resetZoomBtn) resetZoomBtn.addEventListener('click', () => this.resetZoom());

        // Enhanced zoom input functionality
        if (zoomInput) {
            zoomInput.addEventListener('focus', () => {
                zoomInput.readOnly = false;
                zoomInput.select();
            });

            zoomInput.addEventListener('blur', () => {
                zoomInput.readOnly = true;
            });

            zoomInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    this.setZoomFromInput();
                    zoomInput.blur();
                }
            });
        }

        // Fixed view toggle
        const toggleViewBtn = document.getElementById('toggleView');
        if (toggleViewBtn) {
            toggleViewBtn.addEventListener('click', () => this.toggleViewMode());
        }

        // OCR debug toggle
        const toggleOCRDebugBtn = document.getElementById('toggleOCRDebug');
        if (toggleOCRDebugBtn) {
            toggleOCRDebugBtn.addEventListener('click', () => this.setOCRDebugMode());
        }

        // Per-page OCR toggle buttons
        if (this.ocrToggleBtn1) {
            this.ocrToggleBtn1.addEventListener('click', () => this.toggleOCRForRenderedSlot(1));
        }
        if (this.ocrToggleBtn2) {
            this.ocrToggleBtn2.addEventListener('click', () => this.toggleOCRForRenderedSlot(2));
        }

        // Fullscreen
        const fullscreenBtn = document.getElementById('fullscreen');
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
        }

        // Reading Mode
        const readingModeBtn = document.getElementById('readingMode');
        if (readingModeBtn) {
            readingModeBtn.addEventListener('click', () => this.toggleReadingMode());
        }

        // AI Agent controls
        const saveApiKey = document.getElementById('saveApiKey');
        const sendMessage = document.getElementById('sendMessage');
        const clearChat = document.getElementById('clearChat');
        const aiInput = document.getElementById('aiInput');

        if (saveApiKey) saveApiKey.addEventListener('click', () => this.saveApiKey());
        if (sendMessage) sendMessage.addEventListener('click', () => this.sendAIMessage());
        if (clearChat) clearChat.addEventListener('click', () => this.clearAIChat());

        if (aiInput) {
            aiInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendAIMessage();
                }
            });
        }

        // Highlights controls
        const clearHighlights = document.getElementById('clearHighlights');
        if (clearHighlights) {
            clearHighlights.addEventListener('click', () => this.clearAllHighlights());
        }

        // Notes controls
        const saveNotes = document.getElementById('saveNotes');
        if (saveNotes) {
            saveNotes.addEventListener('click', () => this.saveNotes());
        }

        // Error modal
        const closeError = document.getElementById('closeError');
        const errorOk = document.getElementById('errorOk');
        if (closeError) closeError.addEventListener('click', () => this.hideError());
        if (errorOk) errorOk.addEventListener('click', () => this.hideError());

        // Keyboard navigation
        this._boundHandlers.keydown = (e) => this.handleKeyboard(e);
        document.addEventListener('keydown', this._boundHandlers.keydown);

        // Drag and drop
        this.initializeDragAndDrop();

        // Text selection and highlighting
        this.initializeTextSelection();

        console.log('✅ Fixed event listeners initialized');
    }

    initializeTabSystem() {
        console.log('🔧 Initializing new tab system...');

        // Initialize tab system for right panel
        const rightPanelIcons = document.querySelectorAll('.right-panel-icons .panel-icon');
        rightPanelIcons.forEach(icon => {
            icon.addEventListener('click', (e) => {
                e.preventDefault();
                const tabName = icon.getAttribute('data-tab');
                this.switchToTab(tabName);
            });
        });

        // Initialize left panel icons (currently just TOC)
        const leftPanelIcons = document.querySelectorAll('.left-panel-icons .panel-icon');
        leftPanelIcons.forEach(icon => {
            icon.addEventListener('click', (e) => {
                e.preventDefault();
                // Left panel icons just add visual feedback for now
                this.setActiveLeftIcon(icon);
            });
        });

        // Initialize Quill editor for notes
        this.initializeNotesEditor();

        console.log('✅ Tab system initialized');
    }

    switchToTab(tabName) {
        console.log(`🔄 Switching to tab: ${tabName}`);

        // Hide all tabs
        const allTabs = document.querySelectorAll('.panel-tab');
        allTabs.forEach(tab => tab.classList.add('hidden'));

        // Remove active state from all icons
        const allIcons = document.querySelectorAll('.right-panel-icons .panel-icon');
        allIcons.forEach(icon => icon.classList.remove('active'));

        // Show the selected tab
        const targetTab = document.getElementById(`${tabName}Tab`);
        if (targetTab) {
            targetTab.classList.remove('hidden');
            this.currentTab = tabName;

            // Set active icon
            const activeIcon = document.querySelector(`[data-tab="${tabName}"]`);
            if (activeIcon) {
                activeIcon.classList.add('active');
            }

            // Special handling for different tabs
            if (tabName === 'ai') {
                this.focusAIInput();
            } else if (tabName === 'notes') {
                this.focusNotesEditor();
            }
        }
    }

    setActiveLeftIcon(clickedIcon) {
        // Remove active from all left icons
        const leftIcons = document.querySelectorAll('.left-panel-icons .panel-icon');
        leftIcons.forEach(icon => icon.classList.remove('active'));

        // Add active to clicked icon
        clickedIcon.classList.add('active');
    }

    initializeNotesEditor() {
        const notesEditorElement = document.getElementById('notesEditor');
        if (notesEditorElement && typeof Quill !== 'undefined') {
            // Destroy existing Quill instance to prevent memory leaks on reinit
            if (this.notesEditor) {
                // Save current content before destroying
                const currentContent = this.notesEditor.root.innerHTML;
                this.notesEditor.off('text-change');
                this.notesEditor = null;
                // Clear the editor container so Quill can reinitialize cleanly
                notesEditorElement.innerHTML = '';
                notesEditorElement.classList.remove('ql-container', 'ql-snow');
                // Remove any leftover toolbar created by previous Quill instance
                const oldToolbar = notesEditorElement.previousElementSibling;
                if (oldToolbar && oldToolbar.classList.contains('ql-toolbar')) {
                    oldToolbar.remove();
                }
            }

            this.notesEditor = new Quill(notesEditorElement, {
                theme: 'snow',
                placeholder: 'Write your notes here...',
                modules: {
                    toolbar: [
                        [{ 'header': [1, 2, 3, false] }],
                        ['bold', 'italic', 'underline'],
                        [{ 'color': [] }, { 'background': [] }],
                        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                        ['clean']
                    ]
                }
            });

            // Load saved notes
            this.loadNotes();
        }
    }

    initializeFullscreenControls() {
        // Fullscreen overlay controls
        const exitFullscreen = document.getElementById('exitFullscreen');
        const fullscreenPrev = document.getElementById('fullscreenPrev');
        const fullscreenNext = document.getElementById('fullscreenNext');

        if (exitFullscreen) exitFullscreen.addEventListener('click', () => this.exitFullscreen());
        if (fullscreenPrev) fullscreenPrev.addEventListener('click', () => this.previousPage());
        if (fullscreenNext) fullscreenNext.addEventListener('click', () => this.nextPage());

        // Mouse movement detection for fullscreen
        this._boundHandlers.mousemove = () => this.handleFullscreenMouseMove();
        document.addEventListener('mousemove', this._boundHandlers.mousemove);

        // Listen for fullscreen changes
        this._boundHandlers.fullscreenchange = () => this.handleFullscreenChange();
        document.addEventListener('fullscreenchange', this._boundHandlers.fullscreenchange);
    }

    initializePanelToggles() {
        console.log('🔧 Initializing panel toggle controls...');

        // Left sidebar toggle - clicking on TOC icon toggles collapse
        const leftTocIcon = document.getElementById('leftTocIcon');
        if (leftTocIcon) {
            leftTocIcon.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggleLeftSidebar();
            });
        }

        // Right panel - clicking any icon expands if collapsed
        const rightPanelIcons = document.querySelectorAll('.right-panel-icons .panel-icon');
        rightPanelIcons.forEach(icon => {
            icon.addEventListener('click', (e) => {
                // If panel is collapsed, expand it before switching tab
                if (this.rightPanelCollapsed) {
                    this.toggleRightPanel();
                }
            });
        });

        // Apply saved collapsed states on load
        this.applyPanelStates();

        console.log('✅ Panel toggle controls initialized');
    }

    toggleLeftSidebar() {
        const sidebar = document.getElementById('leftSidebar');
        if (!sidebar) return;

        this.leftSidebarCollapsed = !this.leftSidebarCollapsed;
        sidebar.classList.toggle('collapsed', this.leftSidebarCollapsed);

        // Persist state
        try {
            localStorage.setItem('leftSidebarCollapsed', this.leftSidebarCollapsed);
        } catch (error) {
            console.warn('Could not save sidebar state:', error);
        }
        console.log(`📂 Left sidebar ${this.leftSidebarCollapsed ? 'collapsed' : 'expanded'}`);
    }

    toggleRightPanel() {
        const panel = document.getElementById('rightPanel');
        if (!panel) return;

        this.rightPanelCollapsed = !this.rightPanelCollapsed;
        panel.classList.toggle('collapsed', this.rightPanelCollapsed);

        // Persist state
        try {
            localStorage.setItem('rightPanelCollapsed', this.rightPanelCollapsed);
        } catch (error) {
            console.warn('Could not save panel state:', error);
        }
        console.log(`📂 Right panel ${this.rightPanelCollapsed ? 'collapsed' : 'expanded'}`);
    }

    applyPanelStates() {
        // Apply saved collapsed states
        const sidebar = document.getElementById('leftSidebar');
        const panel = document.getElementById('rightPanel');

        if (sidebar && this.leftSidebarCollapsed) {
            sidebar.classList.add('collapsed');
        }
        if (panel && this.rightPanelCollapsed) {
            panel.classList.add('collapsed');
        }
    }

    initializeResizeHandling() {
        this._boundHandlers.resize = () => {
            if (!this.pdfDoc) return;

            if (this.resizeDebounceTimer) {
                clearTimeout(this.resizeDebounceTimer);
            }

            this.resizeDebounceTimer = setTimeout(async () => {
                try {
                    if (this.isFitWidthMode) {
                        await this.fitToWidth();
                    } else if (this.isFitHeightMode) {
                        await this.fitToHeight();
                    } else {
                        await this.renderCurrentPage();
                    }
                } catch (error) {
                    console.warn('Resize re-render failed:', error);
                }
            }, 120);
        };
        window.addEventListener('resize', this._boundHandlers.resize);
    }

    handleFullscreenMouseMove() {
        if (!this.isFullscreen) return;

        const overlay = document.getElementById('fullscreenOverlay');
        if (overlay) {
            overlay.classList.remove('hidden');
            overlay.classList.add('visible');

            // Clear existing timer
            if (this.mouseMoveTimer) {
                clearTimeout(this.mouseMoveTimer);
            }

            // Hide controls after 3 seconds of inactivity
            this.mouseMoveTimer = setTimeout(() => {
                overlay.classList.remove('visible');
                overlay.classList.add('hidden');
            }, 3000);
        }
    }

    handleFullscreenChange() {
        this.isFullscreen = !!document.fullscreenElement;
        const overlay = document.getElementById('fullscreenOverlay');
        const header = document.getElementById('appHeader');
        const controls = document.getElementById('readerControls');

        if (this.isFullscreen) {
            // Hide normal UI elements
            if (header) header.classList.add('hidden');
            if (controls) controls.classList.add('hidden');

            // Show fullscreen overlay
            if (overlay) {
                overlay.classList.remove('hidden');
                this.updateFullscreenControls();
            }
        } else {
            // Show normal UI elements
            if (header) header.classList.remove('hidden');
            if (controls) controls.classList.remove('hidden');

            // Hide fullscreen overlay
            if (overlay) overlay.classList.add('hidden');

            // Clear all fullscreen timers
            if (this.fullscreenTimer) {
                clearTimeout(this.fullscreenTimer);
                this.fullscreenTimer = null;
            }
            if (this.mouseMoveTimer) {
                clearTimeout(this.mouseMoveTimer);
                this.mouseMoveTimer = null;
            }
        }
    }

    updateFullscreenControls() {
        const pageInfo = document.getElementById('fullscreenPageInfo');
        if (pageInfo) {
            if (this.totalPages > 0) {
                pageInfo.textContent = `Page ${this.currentPage} of ${this.totalPages}`;
            } else {
                pageInfo.textContent = 'No PDF loaded';
            }
        }
    }

    // Fixed API key handling
    saveApiKey() {
        const apiKeyInput = document.getElementById('apiKeyInput');
        if (!apiKeyInput) return;

        const apiKey = apiKeyInput.value.trim();
        if (!apiKey) {
            this.showError('Please enter a valid OpenAI API key');
            return;
        }

        if (!apiKey.startsWith('sk-')) {
            this.showError('Invalid API key format. OpenAI API keys should start with "sk-"');
            return;
        }

        this.aiApiKey = apiKey;

        // Hide API key setup and show chat interface
        const apiKeySetup = document.getElementById('apiKeySetup');
        const chatInputContainer = document.getElementById('chatInputContainer');

        if (apiKeySetup) apiKeySetup.classList.add('hidden');
        if (chatInputContainer) chatInputContainer.classList.remove('hidden');

        // Save to localStorage (in production, use proper encryption)
        try {
            localStorage.setItem('pdf-reader-api-key', apiKey);
        } catch (error) {
            console.warn('Could not save API key:', error);
        }

        this.addAIMessage('system', '✅ API key saved successfully! You can now ask questions about your documents.');
        console.log('✅ API key saved and validated');
    }

    // Fixed AI message sending with better error handling
    async sendAIMessage() {
        const aiInput = document.getElementById('aiInput');
        if (!aiInput || !this.aiApiKey) return;

        const message = aiInput.value.trim();
        if (!message) return;

        // Add user message to chat
        this.addAIMessage('user', message);
        aiInput.value = '';

        // Add loading message
        const loadingId = this.addAIMessage('ai', '🤔 Thinking...');

        try {
            // Get document context
            const documentContext = await this.getDocumentContext();

            const response = await this.callOpenAI(message, documentContext);

            // Replace loading message with response
            this.updateAIMessage(loadingId, response);
        } catch (error) {
            console.error('AI API error:', error);
            let errorMessage = '❌ Sorry, I encountered an error. ';

            if (error.message.includes('401')) {
                errorMessage += 'Please check your API key is correct and has sufficient credits.';
            } else if (error.message.includes('429')) {
                errorMessage += 'Rate limit exceeded. Please try again in a moment.';
            } else if (error.message.includes('500')) {
                errorMessage += 'OpenAI service is temporarily unavailable. Please try again later.';
            } else {
                errorMessage += 'Please try again or check your internet connection.';
            }

            this.updateAIMessage(loadingId, errorMessage);
        }
    }

    // Fixed OpenAI API call with better error handling
    async callOpenAI(message, context) {
        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.aiApiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo',
                    messages: [
                        {
                            role: 'system',
                            content: `You are a helpful AI assistant analyzing a PDF document. Here's the context from the document: ${context}. Please answer questions about this document accurately and concisely.`
                        },
                        {
                            role: 'user',
                            content: message
                        }
                    ],
                    max_tokens: 500,
                    temperature: 0.7
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (!data.choices || !data.choices[0] || !data.choices[0].message) {
                throw new Error('Invalid response format from OpenAI');
            }

            return data.choices[0].message.content;
        } catch (error) {
            console.error('OpenAI API call failed:', error);
            throw error;
        }
    }

    // Fixed double page view functionality
    toggleViewMode() {
        this.isDoublePageMode = !this.isDoublePageMode;
        const toggleBtn = document.getElementById('toggleView');

        if (toggleBtn) {
            toggleBtn.textContent = this.isDoublePageMode ? 'Single Page' : 'Double Page';
        }

        console.log(`🔄 View mode changed to: ${this.isDoublePageMode ? 'Double Page' : 'Single Page'}`);

        // Re-render current page(s) with new view mode
        if (this.pdfDoc) {
            this.renderCurrentPage();
        }
    }

    // Enhanced PDF rendering with double page support
    async renderCurrentPage() {
        if (!this.pdfDoc) return;

        try {
            if (this.isDoublePageMode) {
                await this.renderDoublePages();
            } else {
                await this.renderSinglePage();
            }

            this.handleVisiblePage(this.currentPage);

            console.log(`📄 Rendered page ${this.currentPage} in ${this.isDoublePageMode ? 'double' : 'single'} page mode`);
        } catch (error) {
            console.error('Error rendering page:', error);
        }
    }

    initializePageVisibilityObserver() {
        if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return;

        // Disconnect any existing observer to prevent leaks when reinitializing
        if (this.pageVisibilityObserver) {
            this.pageVisibilityObserver.disconnect();
            this.pageVisibilityObserver = null;
        }

        const root = document.querySelector('.reader-area') || document.querySelector('.pdf-container');
        this.pageVisibilityRoot = root || null;

        this.pageVisibilityObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    const pageNumber = Number(entry?.target?.dataset?.pageNumber);
                    if (!Number.isInteger(pageNumber)) return;
                    if (!entry.isIntersecting) {
                        this.cancelOCRForPage(pageNumber);
                        return;
                    }
                    this.handleVisiblePage(pageNumber);
                });
            },
            {
                root: this.pageVisibilityRoot,
                rootMargin: '120px 0px',
                threshold: 0.15
            }
        );

        this.refreshPageVisibilityObserver();
    }

    refreshPageVisibilityObserver() {
        if (!this.pageVisibilityObserver) return;
        this.pageVisibilityObserver.disconnect();

        if (this.pageWrapper1) {
            this.pageVisibilityObserver.observe(this.pageWrapper1);
        }
        if (this.pageWrapper2) {
            this.pageVisibilityObserver.observe(this.pageWrapper2);
        }
    }

    assignPageWrapperNumber(wrapper, pageNumber) {
        if (!wrapper) return;
        if (!Number.isInteger(pageNumber) || pageNumber < 1) {
            delete wrapper.dataset.pageNumber;
            return;
        }
        wrapper.dataset.pageNumber = String(pageNumber);
    }

    getRenderedPageNumberForSlot(slotNumber) {
        const wrapper = slotNumber === 2 ? this.pageWrapper2 : this.pageWrapper1;
        if (!wrapper || wrapper.classList.contains('hidden')) return null;
        const pageNumber = Number(wrapper?.dataset?.pageNumber);
        if (!Number.isInteger(pageNumber) || pageNumber < 1) return null;
        return pageNumber;
    }

    isPageCurrentlyRendered(pageNumber) {
        if (!Number.isInteger(pageNumber) || pageNumber < 1) return false;
        const isPrimary = pageNumber === this.currentPage;
        const isSecondary = this.isDoublePageMode && pageNumber === this.currentPage + 1;
        return isPrimary || isSecondary;
    }

    setOCRViewEnabled(pageNumber, enabled) {
        const normalizedPageNumber = Number(pageNumber);
        if (!Number.isInteger(normalizedPageNumber) || normalizedPageNumber < 1) return;

        if (enabled) {
            this.ocrViewEnabledByPage.set(normalizedPageNumber, true);
        } else {
            this.ocrViewEnabledByPage.delete(normalizedPageNumber);
        }
    }

    getOCRButtonState(pageNumber) {
        const hasPage = Number.isInteger(pageNumber) && pageNumber > 0;
        if (!hasPage) {
            return { disabled: true, active: false, loading: false, text: 'OCR', pageNumber: null };
        }

        const isPreparing = this.ocrJobsByPage.has(pageNumber);
        const isCached = this.hasCachedOCR(pageNumber);
        const isEnabled = this.ocrViewEnabledByPage.get(pageNumber) === true;

        let text;
        if (isPreparing) {
            text = `OCR... P${pageNumber}`;
        } else if (isEnabled) {
            text = `OCR On P${pageNumber}`;
        } else if (isCached) {
            text = `OCR Ready P${pageNumber}`;
        } else {
            text = `Run OCR P${pageNumber}`;
        }

        return {
            disabled: isPreparing,
            active: isEnabled,
            loading: isPreparing,
            text,
            pageNumber
        };
    }

    updateOCRToggleButton(button, pageNumber) {
        if (!button) return;

        const state = this.getOCRButtonState(pageNumber);

        button.disabled = state.disabled;
        button.classList.toggle('active', state.active);
        button.classList.toggle('loading', state.loading);
        button.dataset.pageNumber = state.pageNumber != null ? String(state.pageNumber) : '';
        button.textContent = state.text;
    }

    updateOCRToggleButtons() {
        this.updateOCRToggleButton(this.ocrToggleBtn1, this.getRenderedPageNumberForSlot(1));
        this.updateOCRToggleButton(this.ocrToggleBtn2, this.getRenderedPageNumberForSlot(2));
    }

    async toggleOCRForRenderedSlot(slotNumber) {
        const pageNumber = this.getRenderedPageNumberForSlot(slotNumber);
        if (!pageNumber) return;
        await this.toggleOCRForPage(pageNumber);
    }

    async toggleOCRForPage(pageNumber) {
        const normalizedPageNumber = Number(pageNumber);
        if (!Number.isInteger(normalizedPageNumber) || normalizedPageNumber < 1 || !this.pdfDoc) {
            return;
        }

        const isEnabled = this.ocrViewEnabledByPage.get(normalizedPageNumber) === true;
        if (isEnabled) {
            this.setOCRViewEnabled(normalizedPageNumber, false);
            this.syncOCRButtonsAndRender(normalizedPageNumber);
            return;
        }

        if (this.hasCachedOCR(normalizedPageNumber)) {
            this.setOCRViewEnabled(normalizedPageNumber, true);
            this.syncOCRButtonsAndRender(normalizedPageNumber);
            return;
        }

        if (!this.isOCREngineAvailable()) {
            this.showError('OCR worker is not available.');
            return;
        }

        const preparationPromise = this.ensureOCRForPage(null, normalizedPageNumber);
        this.updateOCRToggleButtons(); // Show loading state immediately
        const prepared = await preparationPromise;
        if (!prepared) {
            this.updateOCRToggleButtons();
            return;
        }

        this.setOCRViewEnabled(normalizedPageNumber, true);
        this.syncOCRButtonsAndRender(normalizedPageNumber);
    }

    async syncOCRButtonsAndRender(pageNumber) {
        this.updateOCRToggleButtons();
        if (this.isPageCurrentlyRendered(pageNumber)) {
            await this.renderCurrentPage();
            this.updateUIState();
        }
    }

    handleVisiblePage(pageNumber) {
        if (!this.pdfDoc) return;

        const anchorPage = this.currentPage;
        const isVisibleAnchor = pageNumber === anchorPage;
        const isVisibleSecondPage = this.isDoublePageMode && pageNumber === anchorPage + 1;
        if (!isVisibleAnchor && !isVisibleSecondPage) return;

        this.scheduleBackgroundOCRPreparation(anchorPage);
        this.evictFarOCRPages(anchorPage);
    }

    cancelOCRForPage(pageNumber) {
        const normalizedPageNumber = Number(pageNumber);
        if (!Number.isInteger(normalizedPageNumber) || normalizedPageNumber < 1) return false;

        const job = this.ocrJobsByPage.get(normalizedPageNumber);
        if (!job) return false;

        if (job.controller && typeof job.controller.abort === 'function') {
            job.controller.abort();
        }

        this.ocrJobsByPage.delete(normalizedPageNumber);
        this.updateOCRToggleButtons();
        return true;
    }

    /**
     * Cancel ALL in-flight OCR jobs immediately.
     * Aborts every AbortController and clears the jobs map.
     * Should be called before loading a new document or replacing OCR data.
     */
    cancelAllOCRJobs() {
        for (const [, job] of this.ocrJobsByPage) {
            if (job.controller && typeof job.controller.abort === 'function') {
                job.controller.abort();
            }
        }
        this.ocrJobsByPage.clear();
        this.backgroundOCRChain = Promise.resolve();
    }

    /**
     * Release canvas memory by zeroing dimensions and clearing the context.
     * Setting width/height to 0 forces the browser to deallocate the
     * backing bitmap immediately, preventing GPU/CPU memory leaks.
     * The canvas is then ready to be resized for a fresh render.
     */
    releaseCanvasMemory(canvas, ctx) {
        if (!canvas) return;
        if (ctx) {
            try { ctx.clearRect(0, 0, canvas.width, canvas.height); } catch (_) { }
        }
        canvas.width = 0;
        canvas.height = 0;
    }

    evictFarOCRPages(anchorPageNumber) {
        if (!this.ocrCacheManager || typeof this.ocrCacheManager.evictFarPages !== 'function') return;
        if (!Number.isInteger(anchorPageNumber) || anchorPageNumber < 1) return;

        const pinnedPages = [anchorPageNumber];
        if (this.isDoublePageMode && anchorPageNumber + 1 <= this.totalPages) {
            pinnedPages.push(anchorPageNumber + 1);
        }

        this.ocrCacheManager.evictFarPages(anchorPageNumber, this.ocrCacheDistance, pinnedPages);

        const pinned = new Set(pinnedPages);
        Array.from(this.ocrJobsByPage.keys()).forEach((pageNumber) => {
            if (pinned.has(pageNumber)) return;
            if (Math.abs(pageNumber - anchorPageNumber) <= this.ocrCacheDistance) return;
            this.cancelOCRForPage(pageNumber);
        });
    }

    scheduleBackgroundOCRPreparation(anchorPageNumber = this.currentPage) {
        if (!this.pdfDoc || !this.isOCREngineAvailable()) return;

        const startPage = Math.max(1, anchorPageNumber);
        const endPage = Math.min(this.totalPages, anchorPageNumber + this.ocrPreparationRange);
        const pagesToPrepare = [];

        for (let pageNumber = startPage; pageNumber <= endPage; pageNumber++) {
            // Skip pages already cached or currently being prepared.
            if (this.hasCachedOCR(pageNumber) || this.ocrJobsByPage.has(pageNumber)) {
                continue;
            }
            pagesToPrepare.push(pageNumber);
        }

        if (pagesToPrepare.length === 0) {
            return;
        }

        const runPreparation = () => {
            pagesToPrepare.forEach((pageNumber) => {
                this.prepareOCRPageInBackground(pageNumber);
            });
        };

        if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
            window.requestIdleCallback(() => runPreparation(), { timeout: 900 });
            return;
        }

        setTimeout(runPreparation, 0);
    }

    prepareOCRPageInBackground(pageNumber) {
        if (this.hasCachedOCR(pageNumber) || this.ocrJobsByPage.has(pageNumber)) {
            return;
        }

        // Keep preparation work serialized so rasterization does not spike UI work.
        this.backgroundOCRChain = this.backgroundOCRChain
            .catch(() => undefined)
            .then(() => this.ensureOCRForPage(null, pageNumber))
            .catch((error) => {
                console.warn(`Background OCR preparation failed for page ${pageNumber}:`, error);
            });
    }

    async renderSinglePage() {
        const page = await this.pdfDoc.getPage(this.currentPage);
        const container = document.querySelector('.pdf-container');
        if (container) {
            container.classList.remove('double-page');
        }

        // Single viewport for both canvas and text layer - no DPR manipulation
        const viewport = page.getViewport({ scale: this.scale });

        // Hide second page wrapper
        if (this.pageWrapper2) this.pageWrapper2.classList.add('hidden');

        this.assignPageWrapperNumber(this.pageWrapper1, this.currentPage);
        this.assignPageWrapperNumber(this.pageWrapper2, null);
        this.updateOCRToggleButtons();

        // Show first page wrapper
        if (this.pageWrapper1) this.pageWrapper1.classList.remove('hidden');

        // Release old canvas bitmap before allocating new one
        this.releaseCanvasMemory(this.canvas1, this.ctx1);

        // Canvas dimensions match viewport exactly
        this.canvas1.width = viewport.width;
        this.canvas1.height = viewport.height;
        this.canvas1.style.width = `${viewport.width}px`;
        this.canvas1.style.height = `${viewport.height}px`;

        // Page wrapper matches viewport
        if (this.pageWrapper1) {
            this.pageWrapper1.style.width = `${viewport.width}px`;
            this.pageWrapper1.style.height = `${viewport.height}px`;
        }

        // Text layer dimensions must match viewport exactly
        if (this.textLayer1) {
            this.textLayer1.style.width = `${viewport.width}px`;
            this.textLayer1.style.height = `${viewport.height}px`;
        }

        // OCR layer dimensions must match viewport exactly
        if (this.ocrLayer1) {
            this.ocrLayer1.style.width = `${viewport.width}px`;
            this.ocrLayer1.style.height = `${viewport.height}px`;
        }

        // Render PDF page - no transform parameter
        const renderContext = {
            canvasContext: this.ctx1,
            viewport: viewport
        };

        await page.render(renderContext).promise;

        this.refreshPageVisibilityObserver();

        // Render native text layer or OCR overlay based on per-page text availability.
        await this.renderPageTextOverlay(
            page,
            viewport,
            this.currentPage,
            this.textLayer1,
            this.ocrLayer1
        );
    }

    async renderDoublePages() {
        const container = document.querySelector('.pdf-container');
        if (container) {
            container.classList.add('double-page');
        }

        // Render first page - single viewport, no DPR manipulation
        const page1 = await this.pdfDoc.getPage(this.currentPage);
        const viewport1 = page1.getViewport({ scale: this.scale });

        // Show first page wrapper
        if (this.pageWrapper1) this.pageWrapper1.classList.remove('hidden');

        this.assignPageWrapperNumber(this.pageWrapper1, this.currentPage);
        this.updateOCRToggleButtons();

        // Release old canvas bitmaps before allocating new ones
        this.releaseCanvasMemory(this.canvas1, this.ctx1);
        this.releaseCanvasMemory(this.canvas2, this.ctx2);

        // Canvas dimensions match viewport exactly
        this.canvas1.width = viewport1.width;
        this.canvas1.height = viewport1.height;
        this.canvas1.style.width = `${viewport1.width}px`;
        this.canvas1.style.height = `${viewport1.height}px`;

        // Page wrapper matches viewport
        if (this.pageWrapper1) {
            this.pageWrapper1.style.width = `${viewport1.width}px`;
            this.pageWrapper1.style.height = `${viewport1.height}px`;
        }

        // Text layer dimensions match viewport
        if (this.textLayer1) {
            this.textLayer1.style.width = `${viewport1.width}px`;
            this.textLayer1.style.height = `${viewport1.height}px`;
        }

        // OCR layer dimensions match viewport
        if (this.ocrLayer1) {
            this.ocrLayer1.style.width = `${viewport1.width}px`;
            this.ocrLayer1.style.height = `${viewport1.height}px`;
        }

        const renderContext1 = {
            canvasContext: this.ctx1,
            viewport: viewport1
        };

        await page1.render(renderContext1).promise;

        // Render second page if available
        if (this.currentPage < this.totalPages) {
            const page2 = await this.pdfDoc.getPage(this.currentPage + 1);
            const viewport2 = page2.getViewport({ scale: this.scale });

            // Show second page wrapper
            if (this.pageWrapper2) this.pageWrapper2.classList.remove('hidden');

            this.assignPageWrapperNumber(this.pageWrapper2, this.currentPage + 1);
            this.updateOCRToggleButtons();

            // Canvas dimensions match viewport exactly
            this.canvas2.width = viewport2.width;
            this.canvas2.height = viewport2.height;
            this.canvas2.style.width = `${viewport2.width}px`;
            this.canvas2.style.height = `${viewport2.height}px`;

            // Page wrapper matches viewport
            if (this.pageWrapper2) {
                this.pageWrapper2.style.width = `${viewport2.width}px`;
                this.pageWrapper2.style.height = `${viewport2.height}px`;
            }

            // Text layer dimensions match viewport
            if (this.textLayer2) {
                this.textLayer2.style.width = `${viewport2.width}px`;
                this.textLayer2.style.height = `${viewport2.height}px`;
            }

            // OCR layer dimensions match viewport
            if (this.ocrLayer2) {
                this.ocrLayer2.style.width = `${viewport2.width}px`;
                this.ocrLayer2.style.height = `${viewport2.height}px`;
            }

            const renderContext2 = {
                canvasContext: this.ctx2,
                viewport: viewport2
            };

            await page2.render(renderContext2).promise;

            await this.renderPageTextOverlay(
                page2,
                viewport2,
                this.currentPage + 1,
                this.textLayer2,
                this.ocrLayer2
            );
        } else {
            if (this.pageWrapper2) this.pageWrapper2.classList.add('hidden');
            this.assignPageWrapperNumber(this.pageWrapper2, null);
            this.clearTextLayer(this.textLayer2);
            this.clearOCRLayer(this.ocrLayer2);
            this.updateOCRToggleButtons();
        }

        this.refreshPageVisibilityObserver();

        await this.renderPageTextOverlay(
            page1,
            viewport1,
            this.currentPage,
            this.textLayer1,
            this.ocrLayer1
        );
    }

    // Navigation methods with double page support
    previousPage() {
        if (this.currentPage <= 1) return;

        const step = this.isDoublePageMode ? 2 : 1;
        this.currentPage = Math.max(1, this.currentPage - step);

        this.renderCurrentPage();
        this.updateUIState();
    }

    nextPage() {
        if (this.currentPage >= this.totalPages) return;

        const step = this.isDoublePageMode ? 2 : 1;
        const nextVal = this.currentPage + step;

        if (nextVal > this.totalPages) {
            if (this.currentPage === this.totalPages) return;
            this.currentPage = this.totalPages;
        } else {
            this.currentPage = nextVal;
        }

        this.renderCurrentPage();
        this.updateUIState();
    }

    goToPage(pageNumber) {
        if (pageNumber < 1 || pageNumber > this.totalPages) return;
        this.currentPage = pageNumber;
        this.renderCurrentPage();
        this.updateUIState();
    }

    // Focus helpers for tabs
    focusAIInput() {
        setTimeout(() => {
            const aiInput = document.getElementById('aiInput');
            if (aiInput && !aiInput.closest('.hidden')) {
                aiInput.focus();
            }
        }, 300);
    }

    focusNotesEditor() {
        setTimeout(() => {
            if (this.notesEditor) {
                this.notesEditor.focus();
            }
        }, 300);
    }

    // Enhanced fullscreen functionality
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().then(() => {
                console.log('✅ Entered fullscreen mode');
            }).catch(err => {
                console.error('Error entering fullscreen:', err);
                this.showError('Could not enter fullscreen mode');
            });
        } else {
            this.exitFullscreen();
        }
    }

    // Reading Mode - hides all panels and maximizes reading area
    toggleReadingMode() {
        const appContainer = document.querySelector('.app-container');
        const readingModeBtn = document.getElementById('readingMode');

        if (!appContainer) return;

        this.isReadingMode = !this.isReadingMode;
        appContainer.classList.toggle('reading-mode', this.isReadingMode);

        if (readingModeBtn) {
            readingModeBtn.classList.toggle('active', this.isReadingMode);
        }

        console.log(`📖 Reading mode ${this.isReadingMode ? 'enabled' : 'disabled'}`);
    }

    exitFullscreen() {
        // Clear fullscreen-related timers immediately
        if (this.fullscreenTimer) {
            clearTimeout(this.fullscreenTimer);
            this.fullscreenTimer = null;
        }
        if (this.mouseMoveTimer) {
            clearTimeout(this.mouseMoveTimer);
            this.mouseMoveTimer = null;
        }

        if (document.fullscreenElement) {
            document.exitFullscreen().then(() => {
                console.log('✅ Exited fullscreen mode');
            }).catch(err => {
                console.error('Error exiting fullscreen:', err);
            });
        }
    }

    // UI State management with fullscreen support
    updateUIState() {
        // Update page info
        const pageInfo = document.getElementById('pageInfo');
        if (pageInfo) {
            if (this.totalPages > 0) {
                if (this.isDoublePageMode && this.currentPage < this.totalPages) {
                    pageInfo.textContent = `Pages ${this.currentPage}-${this.currentPage + 1} of ${this.totalPages}`;
                } else {
                    pageInfo.textContent = `Page ${this.currentPage} of ${this.totalPages}`;
                }
            } else {
                pageInfo.textContent = 'No PDF loaded';
            }
        }

        // Update fullscreen controls
        if (this.isFullscreen) {
            this.updateFullscreenControls();
        }

        // Update zoom display
        this.updateZoomDisplay();

        // Update navigation buttons
        const prevBtn = document.getElementById('prevPage');
        const nextBtn = document.getElementById('nextPage');
        const fullscreenPrev = document.getElementById('fullscreenPrev');
        const fullscreenNext = document.getElementById('fullscreenNext');

        const isAtStart = this.currentPage <= 1;
        const isAtEnd = this.isDoublePageMode ?
            this.currentPage >= this.totalPages :
            this.currentPage >= this.totalPages;

        if (prevBtn) prevBtn.disabled = isAtStart;
        if (nextBtn) nextBtn.disabled = isAtEnd;
        if (fullscreenPrev) fullscreenPrev.disabled = isAtStart;
        if (fullscreenNext) fullscreenNext.disabled = isAtEnd;

        // Update TOC active items
        this.updateTOCActiveItem();
        this.updateOCRToggleButtons();
    }

    // All other methods from the original class remain the same
    // (copying the working methods from the original implementation)

    initializeDragAndDrop() {
        const uploadArea = document.querySelector('.upload-area-compact');
        if (!uploadArea) return;

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            uploadArea.addEventListener(eventName, () => {
                uploadArea.classList.add('drag-over');
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, () => {
                uploadArea.classList.remove('drag-over');
            });
        });

        uploadArea.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            if (files.length > 0 && files[0].type === 'application/pdf') {
                this.handleFileUpload(files[0]);
            } else {
                this.showError('Please drop a valid PDF file.');
            }
        });
    }

    async handleFileUpload(file) {
        console.log('📄 Handling file upload:', file.name);

        if (!file || file.type !== 'application/pdf') {
            this.showError('Please select a valid PDF file.');
            return;
        }

        try {
            this.ocrSessionId += 1;

            // Release old canvas memory before loading new document
            this.releaseCanvasMemory(this.canvas1, this.ctx1);
            this.releaseCanvasMemory(this.canvas2, this.ctx2);

            // Release OCR measurement canvas
            if (this.ocrMeasureCanvas) {
                this.releaseCanvasMemory(this.ocrMeasureCanvas, this.ocrMeasureCtx);
                this.ocrMeasureCanvas = null;
                this.ocrMeasureCtx = null;
            }

            this.showLoading('Loading PDF...');
            this.updateFileInfo(file.name, 'Loading...');

            const arrayBuffer = await file.arrayBuffer();
            const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
            this.pdfDoc = await loadingTask.promise;
            this.totalPages = this.pdfDoc.numPages;
            this.currentPage = 1;
            // Cancel all in-flight OCR before clearing state
            this.cancelAllOCRJobs();
            this.ocrDataByPage.clear();
            if (this.ocrCacheManager) {
                this.ocrCacheManager.clear();
            }
            this.pageTextSourceByPage.clear();
            this.pageTextStatsByPage.clear();
            this.ocrViewEnabledByPage.clear();

            console.log('✅ PDF loaded successfully:', this.totalPages, 'pages');
            this.updateFileInfo(file.name, `${this.totalPages} pages loaded`);

            // Extract TOC
            this.showLoading('Extracting table of contents...');
            await this.extractTOC();

            // Show PDF content
            this.hidePlaceholder();

            // Render first page(s)
            this.showLoading('Rendering pages...');
            await this.renderCurrentPage();

            this.hideLoading();
            this.updateUIState();

            // Apply Fit Width as default zoom mode
            await this.fitToWidth();

            // Update AI assistant with document info
            this.updateAIWithDocument(file.name);

            console.log('🎉 PDF successfully loaded and rendered');
        } catch (error) {
            console.error('❌ Error loading PDF:', error);
            this.showError(`Failed to load PDF file: ${error.message}`);
            this.hideLoading();
            this.updateFileInfo('', 'Failed to load');
        }
    }

    // Enhanced zoom functionality
    setZoomFromInput() {
        const zoomInput = document.getElementById('zoomInfo');
        if (!zoomInput) return;

        let value = zoomInput.value.replace('%', '');
        const zoomValue = parseFloat(value);

        if (isNaN(zoomValue) || zoomValue < 10 || zoomValue > 500) {
            this.showError('Please enter a zoom value between 10% and 500%');
            this.updateZoomDisplay();
            return;
        }

        this.scale = zoomValue / 100;
        this.isFitWidthMode = false;
        this.isFitHeightMode = false;
        this.renderCurrentPage();
        this.updateZoomDisplay();
        this.updateFitWidthButton();
    }

    // Reset zoom to Fit Width (default)
    resetZoom() {
        this.fitToWidth();
    }

    async fitToWidth() {
        if (!this.pdfDoc) return;
        const container = document.querySelector('.pdf-container');
        const containerWidth = container.clientWidth - 32;
        const page = await this.pdfDoc.getPage(this.currentPage);
        const viewport = page.getViewport({ scale: 1.0 });
        const pageWidth = viewport.width;

        if (this.isDoublePageMode && this.currentPage < this.totalPages) {
            // In double mode, account for the wider of the two pages
            const page2 = await this.pdfDoc.getPage(this.currentPage + 1);
            const viewport2 = page2.getViewport({ scale: 1.0 });
            const totalWidth = pageWidth + viewport2.width;
            this.scale = containerWidth / totalWidth;
        } else {
            this.scale = containerWidth / pageWidth;
        }

        this.isFitWidthMode = true;
        this.isFitHeightMode = false;
        await this.renderCurrentPage();
        this.updateZoomDisplay();
        this.updateFitWidthButton();
    }

    async fitToHeight() {
        if (!this.pdfDoc || this._isFittingHeight) return;
        this._isFittingHeight = true;
        try {
            // Use .reader-area (fixed-size scrollable parent) instead of .pdf-container
            // because .pdf-container has min-height:100% and grows with content,
            // which causes an infinite loop when measuring its clientHeight.
            const readerArea = document.querySelector('.reader-area');
            if (!readerArea) { this._isFittingHeight = false; return; }
            const containerHeight = readerArea.clientHeight - 32;
            const page = await this.pdfDoc.getPage(this.currentPage);
            const viewport = page.getViewport({ scale: 1.0 });
            let tallestHeight = viewport.height;

            if (this.isDoublePageMode && this.currentPage < this.totalPages) {
                // In double mode, fit the tallest of the two pages
                const page2 = await this.pdfDoc.getPage(this.currentPage + 1);
                const viewport2 = page2.getViewport({ scale: 1.0 });
                tallestHeight = Math.max(viewport.height, viewport2.height);
            }

            this.scale = containerHeight / tallestHeight;
            this.isFitWidthMode = false;
            this.isFitHeightMode = true;
            await this.renderCurrentPage();
            this.updateZoomDisplay();
            this.updateFitWidthButton();
        } finally {
            this._isFittingHeight = false;
        }
    }

    zoomIn() {
        this.scale = Math.min(this.scale * 1.2, 5.0);
        this.isFitWidthMode = false;
        this.isFitHeightMode = false;
        this.renderCurrentPage();
        this.updateZoomDisplay();
        this.updateFitWidthButton();
    }

    zoomOut() {
        this.scale = Math.max(this.scale / 1.2, 0.1);
        this.isFitWidthMode = false;
        this.isFitHeightMode = false;
        this.renderCurrentPage();
        this.updateZoomDisplay();
        this.updateFitWidthButton();
    }

    updateFitWidthButton() {
        const fitWidthBtn = document.getElementById('fitWidth');
        if (fitWidthBtn) {
            fitWidthBtn.textContent = this.isFitWidthMode ? 'Fit Width ✓' : 'Fit Width';
        }
    }

    updateZoomDisplay() {
        const zoomInput = document.getElementById('zoomInfo');
        if (zoomInput) {
            zoomInput.value = `${Math.round(this.scale * 100)}%`;
        }
    }

    // Text selection and highlighting
    initializeTextSelection() {
        const attachTextLayerListeners = (layer) => {
            if (!layer) return;
            layer.addEventListener('mouseup', (e) => this.handleTextSelection(e));
            layer.addEventListener('contextmenu', (e) => this.handleContextMenu(e));
        };

        attachTextLayerListeners(this.textLayer1 || document.getElementById('textLayer'));
        attachTextLayerListeners(this.textLayer2 || document.getElementById('textLayer2'));
        attachTextLayerListeners(this.ocrLayer1 || document.getElementById('ocrLayer'));
        attachTextLayerListeners(this.ocrLayer2 || document.getElementById('ocrLayer2'));

        this.initializeHighlightContextMenu();
        this._boundHandlers.clickHideContext = () => this.hideContextMenu();
        document.addEventListener('click', this._boundHandlers.clickHideContext);
    }

    initializeHighlightContextMenu() {
        const contextMenu = document.getElementById('highlightMenu');
        if (!contextMenu) return;

        const colors = ['yellow', 'green', 'blue', 'red'];
        colors.forEach(color => {
            const btn = document.getElementById(`highlight${color.charAt(0).toUpperCase() + color.slice(1)}`);
            if (btn) {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.highlightSelectedText(color);
                    this.hideContextMenu();
                });
            }
        });

        const removeBtn = document.getElementById('removeHighlight');
        if (removeBtn) {
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeHighlight();
                this.hideContextMenu();
            });
        }
    }

    handleTextSelection(e) {
        const selection = window.getSelection();
        if (selection.rangeCount > 0 && !selection.isCollapsed) {
            this.selectedText = selection.toString().trim();
            if (this.selectedText.length > 0) {
                console.log('Text selected:', this.selectedText);
            }
        }
    }

    handleContextMenu(e) {
        const selection = window.getSelection();
        if (selection.rangeCount > 0 && !selection.isCollapsed) {
            e.preventDefault();
            this.selectedText = selection.toString().trim();
            if (this.selectedText.length > 0) {
                this.showContextMenu(e.clientX, e.clientY);
            }
        }
    }

    showContextMenu(x, y) {
        const contextMenu = document.getElementById('highlightMenu');
        if (contextMenu) {
            contextMenu.style.left = `${x}px`;
            contextMenu.style.top = `${y}px`;
            contextMenu.classList.remove('hidden');
        }
    }

    hideContextMenu() {
        const contextMenu = document.getElementById('highlightMenu');
        if (contextMenu) {
            contextMenu.classList.add('hidden');
        }
    }

    highlightSelectedText(color) {
        if (!this.selectedText) return;

        const highlight = {
            id: Date.now(),
            text: this.selectedText,
            color: color,
            page: this.currentPage,
            timestamp: new Date().toISOString()
        };

        this.highlights.push(highlight);
        this.updateHighlightsList();
        this.saveHighlights();

        // Keep selection intact so users can quickly apply multiple highlights
        console.log('Text highlighted:', highlight);
    }

    removeHighlight() {
        window.getSelection().removeAllRanges();
        this.selectedText = '';
    }

    updateHighlightsList() {
        const highlightsContent = document.getElementById('highlightsContent');
        if (!highlightsContent) return;

        if (this.highlights.length === 0) {
            highlightsContent.innerHTML = `
                <div class="highlights-placeholder">
                    <p>📝 Highlighted text will appear here</p>
                    <small>Select text in the PDF to highlight it</small>
                </div>
            `;
            return;
        }

        const highlightsHTML = this.highlights.map(highlight => `
            <div class="highlight-item" data-highlight-id="${highlight.id}" onclick="window.reader && window.reader.goToHighlight(${highlight.id})">
                <div class="highlight-text">"${highlight.text.substring(0, 100)}${highlight.text.length > 100 ? '...' : ''}"</div>
                <div class="highlight-meta">
                    <span>Page ${highlight.page}</span>
                    <div class="highlight-color ${highlight.color}" style="background-color: var(--highlight-${highlight.color})"></div>
                </div>
            </div>
        `).join('');

        highlightsContent.innerHTML = highlightsHTML;

        // Scroll to the newest highlight (last item)
        const lastItem = highlightsContent.lastElementChild;
        if (lastItem) {
            lastItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    goToHighlight(highlightId) {
        if (!highlightId) return;
        const highlight = this.highlights.find(h => h.id == highlightId);
        if (highlight && typeof highlight.page === 'number') {
            this.goToPage(highlight.page);
        }
    }

    clearAllHighlights() {
        if (this.highlights.length === 0) return;

        if (confirm('Are you sure you want to clear all highlights?')) {
            this.highlights = [];
            this.updateHighlightsList();
            this.saveHighlights();
        }
    }

    saveHighlights() {
        try {
            const data = JSON.stringify(this.highlights);
            localStorage.setItem('pdf-reader-highlights', data);
        } catch (error) {
            if (error?.name === 'QuotaExceededError') {
                this.showError('Storage is full. Try clearing old highlights or notes.');
            }
            console.warn('Could not save highlights:', error);
        }
    }

    loadHighlights() {
        try {
            const saved = localStorage.getItem('pdf-reader-highlights');
            if (saved) {
                this.highlights = JSON.parse(saved);
                this.updateHighlightsList();
            }
        } catch (error) {
            console.warn('Could not load highlights:', error);
        }
    }

    async getDocumentContext() {
        if (!this.pdfDoc) return 'No document loaded.';

        try {
            let context = '';
            const startPage = Math.max(1, this.currentPage - 1);
            const endPage = Math.min(this.totalPages, this.currentPage + 1);

            for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
                const page = await this.pdfDoc.getPage(pageNum);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(' ');
                context += `Page ${pageNum}: ${pageText.substring(0, 500)}...\n`;
            }

            return context || 'Could not extract text from document.';
        } catch (error) {
            console.error('Error extracting document context:', error);
            return 'Error extracting document context.';
        }
    }

    addAIMessage(type, content) {
        const chatContainer = document.getElementById('aiChatContainer');
        if (!chatContainer) return;

        const messageId = Date.now();
        const messageDiv = document.createElement('div');
        messageDiv.className = `ai-message ${type}-message`;
        messageDiv.id = `message-${messageId}`;
        messageDiv.innerHTML = `<p>${content}</p>`;

        chatContainer.appendChild(messageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;

        return messageId;
    }

    updateAIMessage(messageId, content) {
        const messageElement = document.getElementById(`message-${messageId}`);
        if (messageElement) {
            messageElement.innerHTML = `<p>${content}</p>`;
        }
    }

    clearAIChat() {
        const chatContainer = document.getElementById('aiChatContainer');
        if (chatContainer) {
            chatContainer.innerHTML = `
                <div class="ai-message system-message">
                    <p>👋 Hi! I'm your AI assistant. Upload a PDF and I'll help you analyze and understand its content. Ask me questions about the document!</p>
                </div>
            `;
        }
    }

    updateAIWithDocument(fileName) {
        this.addAIMessage('system', `📄 Document "${fileName}" loaded successfully! You can now ask me questions about its content.`);
    }

    saveNotes() {
        if (!this.notesEditor) return;

        const content = this.notesEditor.getContents();
        try {
            localStorage.setItem('pdf-reader-notes', JSON.stringify(content));
            this.showSuccess('Notes saved successfully!');
        } catch (error) {
            if (error?.name === 'QuotaExceededError') {
                this.showError('Storage is full. Try clearing old highlights or notes.');
            } else {
                this.showError('Could not save notes');
            }
            console.warn('Could not save notes:', error);
        }
    }

    loadNotes() {
        if (!this.notesEditor) return;

        try {
            const saved = localStorage.getItem('pdf-reader-notes');
            if (saved) {
                const content = JSON.parse(saved);
                this.notesEditor.setContents(content);
            }
        } catch (error) {
            console.warn('Could not load notes:', error);
        }
    }

    // TOC methods
    async extractTOC() {
        try {
            console.log('📖 Extracting table of contents...');
            this.outline = await this.pdfDoc.getOutline();

            if (this.outline && this.outline.length > 0) {
                console.log('✓ TOC found with', this.outline.length, 'top-level items');
                this.tocItems = await this.processOutlineWithDestinations(this.outline);
                this.renderTOC();
                this.updateTocStatus(`${this.tocItems.length} items found`);
            } else {
                console.log('ℹ️ No table of contents found in PDF');
                this.renderEmptyTOC();
                this.updateTocStatus('No TOC available');
            }
        } catch (error) {
            console.error('Error extracting TOC:', error);
            this.renderEmptyTOC();
            this.updateTocStatus('TOC extraction failed');
        }
    }

    async processOutlineWithDestinations(outline, level = 1, parentIndex = '') {
        const items = [];
        for (let index = 0; index < outline.length; index++) {
            const item = outline[index];
            const currentIndex = parentIndex ? `${parentIndex}.${index + 1}` : `${index + 1}`;

            try {
                const pageNum = await this.resolveDestinationToPageNumber(item.dest);
                const tocItem = {
                    title: item.title,
                    dest: item.dest,
                    pageNumber: pageNum,
                    level: level,
                    index: currentIndex,
                    bold: item.bold || false,
                    italic: item.italic || false,
                    hasChildren: item.items && item.items.length > 0
                };

                items.push(tocItem);
                console.log(`📄 TOC item: "${item.title}" → Page ${pageNum}`);

                if (item.items && item.items.length > 0) {
                    const childItems = await this.processOutlineWithDestinations(item.items, level + 1, currentIndex);
                    items.push(...childItems);
                }
            } catch (error) {
                console.warn('Failed to resolve destination for TOC item:', item.title, error);
                const tocItem = {
                    title: item.title,
                    dest: item.dest,
                    pageNumber: 1,
                    level: level,
                    index: currentIndex,
                    bold: item.bold || false,
                    italic: item.italic || false,
                    hasChildren: item.items && item.items.length > 0
                };
                items.push(tocItem);
            }
        }
        return items;
    }

    async resolveDestinationToPageNumber(dest) {
        if (!dest || !this.pdfDoc) return 1;

        try {
            let resolvedDest;
            if (typeof dest === 'string') {
                resolvedDest = await this.pdfDoc.getDestination(dest);
            } else if (Array.isArray(dest)) {
                resolvedDest = dest;
            } else if (typeof dest === 'object' && dest !== null) {
                // Handle destination objects with page property
                if (typeof dest.pageNumber === 'number') return Math.max(1, Math.min(dest.pageNumber, this.totalPages));
                if (typeof dest.page === 'number') return Math.max(1, Math.min(dest.page, this.totalPages));
                // Try treating it as a page ref directly
                try {
                    const idx = await this.pdfDoc.getPageIndex(dest);
                    return Math.max(1, Math.min(idx + 1, this.totalPages));
                } catch (e) {
                    return 1;
                }
            } else {
                return 1;
            }

            if (!resolvedDest || !Array.isArray(resolvedDest) || resolvedDest.length === 0) {
                return 1;
            }

            const pageRef = resolvedDest[0];
            let pageNumber;

            if (typeof pageRef === 'number') {
                // Some destinations use a direct page index (0-based)
                pageNumber = pageRef + 1;
            } else if (pageRef && typeof pageRef === 'object') {
                // Standard PDF ref object — resolve via getPageIndex
                const pageIndex = await this.pdfDoc.getPageIndex(pageRef);
                pageNumber = pageIndex + 1;
            } else {
                return 1;
            }

            // Validate resolved page number
            if (pageNumber < 1 || pageNumber > this.totalPages) {
                return Math.max(1, Math.min(pageNumber, this.totalPages));
            }

            // The remaining elements describe the view type:
            // [pageRef, /XYZ, left, top, zoom]
            // [pageRef, /Fit]
            // [pageRef, /FitH, top]
            // [pageRef, /FitV, left]
            // [pageRef, /FitR, left, bottom, right, top]
            // [pageRef, /FitB]
            // [pageRef, /FitBH, top]
            // [pageRef, /FitBV, left]
            // We only need the page number for TOC navigation, so these
            // are noted for completeness but the page is correctly resolved above.

            return pageNumber;
        } catch (error) {
            console.error('Error resolving destination:', error);
            return 1;
        }
    }

    renderTOC() {
        const tocContainer = document.getElementById('tocContainer');
        if (!this.tocItems || this.tocItems.length === 0) {
            this.renderEmptyTOC();
            return;
        }

        const tocHTML = this.createTOCHTML();
        tocContainer.innerHTML = tocHTML;
        this.attachTOCEventListeners();
        console.log('✓ TOC rendered with', this.tocItems.length, 'items');
    }

    createTOCHTML() {
        let html = '<ul class="toc-list">';

        this.tocItems.forEach(item => {
            const levelClass = `level-${item.level}`;
            const activeClass = item.pageNumber === this.currentPage ? 'active' : '';

            html += `
                <li class="toc-item">
                    <a href="#" class="toc-link ${levelClass} ${activeClass}" data-page="${item.pageNumber}">
                        <span class="toc-title">${this.escapeHtml(item.title)}</span>
                        <span class="toc-page">${item.pageNumber}</span>
                    </a>
                </li>
            `;
        });

        html += '</ul>';
        return html;
    }

    attachTOCEventListeners() {
        const tocLinks = document.querySelectorAll('.toc-link');
        tocLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const pageNumber = parseInt(link.dataset.page);
                if (!isNaN(pageNumber)) {
                    this.goToPage(pageNumber);
                }
            });
        });
    }

    renderEmptyTOC() {
        const tocContainer = document.getElementById('tocContainer');
        tocContainer.innerHTML = `
            <div class="toc-placeholder">
                <p>📄 This PDF doesn't contain a table of contents</p>
                <small>Some PDFs don't have embedded bookmarks or outlines</small>
            </div>
        `;
    }

    updateTocStatus(status) {
        const tocStatus = document.getElementById('tocStatus');
        if (tocStatus) {
            tocStatus.textContent = status;
        }
    }

    updateTOCActiveItem() {
        const tocLinks = document.querySelectorAll('.toc-link');
        tocLinks.forEach(link => {
            const pageNumber = parseInt(link.dataset.page);
            if (pageNumber === this.currentPage) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    }

    createOCRCacheManager() {
        if (typeof window !== 'undefined' && typeof window.OCRCacheManager === 'function') {
            return new window.OCRCacheManager();
        }

        // Inline LRU cache fallback when external OCRCacheManager is not available
        const fallbackCache = new Map();
        const maxEntries = 40;
        return {
            getOCR(pageNumber) {
                const value = fallbackCache.get(pageNumber);
                if (value === undefined) return undefined;
                // LRU refresh: delete and re-insert so it moves to end
                fallbackCache.delete(pageNumber);
                fallbackCache.set(pageNumber, value);
                return value;
            },
            setOCR(pageNumber, data) {
                if (fallbackCache.has(pageNumber)) fallbackCache.delete(pageNumber);
                fallbackCache.set(pageNumber, data);
                // Evict oldest entry if over limit
                while (fallbackCache.size > maxEntries) {
                    const lruKey = fallbackCache.keys().next().value;
                    if (lruKey === undefined) break;
                    fallbackCache.delete(lruKey);
                }
            },
            hasOCR(pageNumber) {
                return fallbackCache.has(pageNumber);
            },
            evictFarPages(currentPage, keepDistance, pinnedPages = []) {
                const pinned = new Set(pinnedPages);
                for (const [page] of fallbackCache) {
                    if (pinned.has(page)) continue;
                    if (Math.abs(page - currentPage) <= keepDistance) continue;
                    fallbackCache.delete(page);
                }
            },
            clear() {
                fallbackCache.clear();
            }
        };
    }

    createOCRWorkerManager() {
        // Prefer externally provided OCRWorkerManager (e.g. from Next.js TypeScript module)
        if (typeof window !== 'undefined' && typeof window.OCRWorkerManager === 'function') {
            try {
                return window.OCRWorkerManager.fromScript('/ocr-worker.js', {
                    maxConcurrent: this.ocrMaxConcurrent
                });
            } catch (error) {
                console.warn('Could not initialize external OCR worker manager:', error);
            }
        }

        // Inline fallback OCRWorkerManager when external class is not available
        if (typeof Worker === 'undefined') {
            console.warn('Web Worker API not available — OCR disabled.');
            return null;
        }

        const maxConcurrent = Math.max(1, Math.floor(this.ocrMaxConcurrent || 1));
        let worker = null;
        let requestSeq = 0;
        const pendingRequests = new Map();
        const requestQueue = [];
        const abortHandlers = new Map();
        const canceledRequests = new Set();
        let activeCount = 0;

        function ensureWorker() {
            if (worker) return worker;
            worker = new Worker('/ocr-worker.js');
            worker.addEventListener('message', onMessage);
            worker.addEventListener('error', onError);
            return worker;
        }

        function onMessage(event) {
            const data = event?.data;
            if (!data || typeof data !== 'object') return;

            if (data.type === 'ocr:result' && typeof data.requestId === 'string') {
                const pending = pendingRequests.get(data.requestId);
                if (!pending) return;
                pendingRequests.delete(data.requestId);
                cleanupAbort(data.requestId);
                activeCount = Math.max(0, activeCount - 1);
                if (canceledRequests.has(data.requestId)) {
                    canceledRequests.delete(data.requestId);
                    processQueue();
                    return;
                }
                pending.resolve(data.payload);
                processQueue();
            } else if (data.type === 'ocr:error' && typeof data.requestId === 'string') {
                const pending = pendingRequests.get(data.requestId);
                if (!pending) return;
                pendingRequests.delete(data.requestId);
                cleanupAbort(data.requestId);
                activeCount = Math.max(0, activeCount - 1);
                if (canceledRequests.has(data.requestId)) {
                    canceledRequests.delete(data.requestId);
                    processQueue();
                    return;
                }
                pending.reject(new Error(data.error || 'Unknown OCR worker error.'));
                processQueue();
            }
        }

        function onError() {
            rejectAll(new Error('OCR worker failed.'));
        }

        function rejectAll(error) {
            const allPending = Array.from(pendingRequests.values());
            const allQueued = Array.from(requestQueue);
            pendingRequests.clear();
            requestQueue.length = 0;
            activeCount = 0;
            canceledRequests.clear();
            allPending.forEach(({ reject }) => reject(error));
            allQueued.forEach(({ reject }) => reject(error));
            abortHandlers.forEach(({ signal, handler }) => signal.removeEventListener('abort', handler));
            abortHandlers.clear();
        }

        function cleanupAbort(requestId) {
            const entry = abortHandlers.get(requestId);
            if (!entry) return;
            entry.signal.removeEventListener('abort', entry.handler);
            abortHandlers.delete(requestId);
        }

        function processQueue() {
            if (activeCount >= maxConcurrent) return;
            while (activeCount < maxConcurrent && requestQueue.length > 0) {
                const next = requestQueue.shift();
                if (!next) break;
                if (canceledRequests.has(next.requestId)) {
                    canceledRequests.delete(next.requestId);
                    cleanupAbort(next.requestId);
                    continue;
                }
                const w = ensureWorker();
                pendingRequests.set(next.requestId, { resolve: next.resolve, reject: next.reject });
                activeCount += 1;
                try {
                    w.postMessage({
                        type: 'ocr:run',
                        requestId: next.requestId,
                        payload: next.input
                    }, next.transfer || []);
                } catch (err) {
                    pendingRequests.delete(next.requestId);
                    cleanupAbort(next.requestId);
                    activeCount = Math.max(0, activeCount - 1);
                    next.reject(err);
                }
            }
        }

        function cancelRequest(requestId) {
            if (!requestId) return false;
            const qIdx = requestQueue.findIndex(r => r.requestId === requestId);
            if (qIdx !== -1) {
                const [queued] = requestQueue.splice(qIdx, 1);
                cleanupAbort(requestId);
                queued.reject(new Error('OCR request canceled.'));
                return true;
            }
            const pending = pendingRequests.get(requestId);
            if (!pending) return false;
            pendingRequests.delete(requestId);
            canceledRequests.add(requestId);
            cleanupAbort(requestId);
            pending.reject(new Error('OCR request canceled.'));
            activeCount = Math.max(0, activeCount - 1);
            processQueue();
            return true;
        }

        return {
            runOCR(input, options = {}) {
                const pageNumber = input.pageNumber;
                if (!Number.isInteger(pageNumber) || pageNumber < 1) {
                    return Promise.reject(new RangeError(`Invalid page number: ${pageNumber}`));
                }
                requestSeq += 1;
                const requestId = `ocr-${pageNumber}-${requestSeq}`;
                const signal = options.signal;

                return new Promise((resolve, reject) => {
                    if (signal?.aborted) {
                        reject(new Error('OCR request canceled.'));
                        return;
                    }
                    const request = {
                        requestId,
                        input,
                        resolve,
                        reject,
                        signal,
                        transfer: options.transfer
                    };
                    if (signal) {
                        const handler = () => cancelRequest(requestId);
                        signal.addEventListener('abort', handler, { once: true });
                        abortHandlers.set(requestId, { signal, handler });
                    }
                    requestQueue.push(request);
                    processQueue();
                });
            },
            cancelRequest,
            terminate() {
                if (!worker) return;
                worker.removeEventListener('message', onMessage);
                worker.removeEventListener('error', onError);
                worker.terminate();
                worker = null;
                rejectAll(new Error('OCR worker was terminated.'));
            }
        };
    }

    hasCachedOCR(pageNumber) {
        return (
            (this.ocrCacheManager && this.ocrCacheManager.hasOCR(pageNumber)) ||
            this.ocrDataByPage.has(pageNumber)
        );
    }

    getCachedOCR(pageNumber) {
        if (this.ocrCacheManager) {
            const cached = this.ocrCacheManager.getOCR(pageNumber);
            if (cached) return cached;
        }
        return this.ocrDataByPage.get(pageNumber);
    }

    clearTextLayer(textLayerElement = null) {
        const textLayer = textLayerElement || document.getElementById('textLayer');
        if (!textLayer) return;
        textLayer.innerHTML = '';
    }

    clearOCRLayer(ocrLayerElement = null) {
        const ocrLayer = ocrLayerElement || document.getElementById('ocrLayer');
        if (!ocrLayer) return;
        ocrLayer.innerHTML = '';
        ocrLayer.classList.remove('debug');
    }

    async renderPageTextOverlay(page, viewport, pageNumber, textLayerElement = null, ocrLayerElement = null) {
        const source = await this.resolvePageTextSource(page, pageNumber);
        const textLayer = textLayerElement || document.getElementById('textLayer');
        const ocrLayer = ocrLayerElement || document.getElementById('ocrLayer');
        const shouldShowOCR = this.ocrViewEnabledByPage.get(pageNumber) === true && this.hasCachedOCR(pageNumber);

        if (shouldShowOCR) {
            if (textLayer) textLayer.style.pointerEvents = 'none';
            if (ocrLayer) ocrLayer.style.pointerEvents = 'auto';
            this.clearTextLayer(textLayer);
            await this.renderOCRLayer(page, viewport, ocrLayer, pageNumber);
            return 'ocr';
        }

        if (source === 'native') {
            if (textLayer) textLayer.style.pointerEvents = 'auto';
            if (ocrLayer) ocrLayer.style.pointerEvents = 'none';
            await this.renderTextLayer(page, viewport, textLayer);
        } else {
            if (textLayer) textLayer.style.pointerEvents = 'none';
            if (ocrLayer) ocrLayer.style.pointerEvents = 'none';
            this.clearTextLayer(textLayer);
        }

        if (this.ocrDebugMode && this.hasCachedOCR(pageNumber)) {
            await this.renderOCRLayer(page, viewport, ocrLayer, pageNumber);
        } else {
            this.clearOCRLayer(ocrLayer);
        }

        if (this.ocrDebugMode) {
            const stats = this.pageTextStatsByPage.get(pageNumber);
            console.log(`[TEXT SOURCE] Page ${pageNumber}: ${source}`, stats || {});
        }

        return source;
    }

    async resolvePageTextSource(page, pageNumber) {
        const cachedSource = this.pageTextSourceByPage.get(pageNumber);
        if (cachedSource === 'native' || cachedSource === 'none') {
            return cachedSource;
        }
        if (cachedSource === 'ocr') {
            // OCR overlays are intentionally disabled; keep result as silent preparation only.
            return 'none';
        }

        const nativeStats = await this.getNativeTextStats(page);
        this.pageTextStatsByPage.set(pageNumber, nativeStats);

        if (nativeStats.isMeaningful) {
            this.pageTextSourceByPage.set(pageNumber, 'native');
            return 'native';
        }

        this.pageTextSourceByPage.set(pageNumber, 'none');
        return 'none';
    }

    async getNativeTextStats(page) {
        try {
            const textContent = await page.getTextContent();
            const items = Array.isArray(textContent?.items) ? textContent.items : [];
            const combined = items
                .map((item) => (typeof item?.str === 'string' ? item.str : ''))
                .join('')
                .replace(/\s+/g, '');

            const characterCount = combined.length;
            const itemsCount = items.length;
            const isMeaningful = itemsCount > 0 && characterCount > this.nativeTextCharThreshold;

            return { itemsCount, characterCount, isMeaningful };
        } catch (error) {
            console.warn('Native text extraction failed, falling back to OCR:', error);
            return { itemsCount: 0, characterCount: 0, isMeaningful: false };
        }
    }

    async ensureOCRForPage(page, pageNumber) {
        const normalizedPageNumber = Number(pageNumber);
        if (!Number.isInteger(normalizedPageNumber) || normalizedPageNumber < 1) {
            return false;
        }

        if (this.hasCachedOCR(normalizedPageNumber)) {
            return true;
        }

        if (!this.isOCREngineAvailable()) {
            return false;
        }

        if (!page && !this.pdfDoc) {
            return false;
        }

        if (this.ocrJobsByPage.has(normalizedPageNumber)) {
            const existing = this.ocrJobsByPage.get(normalizedPageNumber);
            return existing?.promise || false;
        }

        const sessionId = this.ocrSessionId;
        const controller = new AbortController();
        const job = (async () => {
            // Pre-flight session check — bail early if document changed
            if (sessionId !== this.ocrSessionId) return null;
            const targetPage = page || await this.pdfDoc.getPage(normalizedPageNumber);
            // Re-check after async getPage
            if (sessionId !== this.ocrSessionId) return null;
            return this.performOCRForPage(targetPage, normalizedPageNumber, controller.signal);
        })()
            .then((ocrPageData) => {
                if (sessionId !== this.ocrSessionId) {
                    return false;
                }
                if (!ocrPageData) return false;
                return this.setOCRPageData(normalizedPageNumber, ocrPageData, false);
            })
            .catch((error) => {
                console.error(`OCR preparation failed on page ${normalizedPageNumber}:`, error);
                return false;
            })
            .finally(() => {
                this.ocrJobsByPage.delete(normalizedPageNumber);
                this.updateOCRToggleButtons();
            });

        this.ocrJobsByPage.set(normalizedPageNumber, { promise: job, controller });
        this.updateOCRToggleButtons();
        return job;
    }

    isOCREngineAvailable() {
        return !!(this.ocrWorkerManager && typeof this.ocrWorkerManager.runOCR === 'function');
    }

    async performOCRForPage(page, pageNumber, abortSignal) {
        if (!this.ocrWorkerManager) {
            return null;
        }

        if (abortSignal?.aborted) {
            return null;
        }

        const ocrViewport = page.getViewport({ scale: this.ocrRenderScale });
        const ocrCanvas = document.createElement('canvas');
        ocrCanvas.width = Math.max(1, Math.ceil(ocrViewport.width));
        ocrCanvas.height = Math.max(1, Math.ceil(ocrViewport.height));

        const imageWidth = ocrCanvas.width;
        const imageHeight = ocrCanvas.height;

        const ocrContext = ocrCanvas.getContext('2d', { alpha: false, desynchronized: true });
        if (!ocrContext) {
            console.warn('Could not create OCR canvas context');
            return null;
        }

        await page.render({
            canvasContext: ocrContext,
            viewport: ocrViewport
        }).promise;

        ocrContext.filter = 'grayscale(100%) contrast(120%)';
        ocrContext.drawImage(ocrCanvas, 0, 0);
        ocrContext.filter = 'none';

        if (abortSignal?.aborted) {
            return null;
        }

        // Convert canvas to PNG data URL — Tesseract.recognize() accepts encoded
        // images (PNG/JPEG) but NOT raw RGBA pixel buffers.
        const imageDataUrl = ocrCanvas.toDataURL('image/png');

        // Release the temporary OCR canvas immediately after extracting image
        ocrCanvas.width = 0;
        ocrCanvas.height = 0;

        const rawOCR = await this.ocrWorkerManager.runOCR({
            pageNumber,
            imageDataUrl,
            width: imageWidth,
            height: imageHeight
        }, {
            signal: abortSignal
        });
        if (!rawOCR) {
            return null;
        }

        const ocrPayload = typeof rawOCR === 'object' ? rawOCR : { words: [] };
        const normalizedOCR = this.normalizeOCRPageData({
            ...ocrPayload,
            imageWidth,
            imageHeight,
            dpi: 72 * this.ocrRenderScale
        });

        if (!normalizedOCR || normalizedOCR.words.length === 0) {
            console.warn(`OCR returned no usable words on page ${pageNumber}`);
            return null;
        }

        return normalizedOCR;
    }

    async callOCREngine(imageDataUrl, pageNumber) {
        if (typeof window !== 'undefined' && typeof window.performOCR === 'function') {
            return window.performOCR({
                imageDataUrl,
                pageNumber
            });
        }

        if (typeof window !== 'undefined' && window.Tesseract && typeof window.Tesseract.recognize === 'function') {
            return window.Tesseract.recognize(imageDataUrl, 'eng', {
                logger: (message) => {
                    if (!this.ocrDebugMode || !message || !message.status) return;
                    const progress = typeof message.progress === 'number'
                        ? ` ${Math.round(message.progress * 100)}%`
                        : '';
                    console.log(`[OCR] Page ${pageNumber}: ${message.status}${progress}`);
                }
            });
        }

        console.warn('No OCR engine available. Load Tesseract.js or define window.performOCR(payload).');
        return null;
    }

    updateOCRDebugButton() {
        const debugBtn = document.getElementById('toggleOCRDebug');
        if (!debugBtn) return;

        debugBtn.textContent = this.ocrDebugMode ? 'OCR Debug On' : 'OCR Debug Off';
        debugBtn.classList.toggle('active', this.ocrDebugMode);
    }

    setOCRDebugMode(enabled = null) {
        this.ocrDebugMode = typeof enabled === 'boolean' ? enabled : !this.ocrDebugMode;
        this.updateOCRDebugButton();

        if (this.pdfDoc) {
            this.renderCurrentPage();
        }

        return this.ocrDebugMode;
    }

    setOCRPageData(pageNumber, pageData, shouldRerender = true) {
        const normalizedPageNumber = Number(pageNumber);
        if (!Number.isInteger(normalizedPageNumber) || normalizedPageNumber < 1) {
            console.warn('Invalid OCR page number:', pageNumber);
            return false;
        }

        const normalized = this.normalizeOCRPageData(pageData);
        if (!normalized) {
            console.warn(`Could not normalize OCR data for page ${normalizedPageNumber}`);
            return false;
        }

        const structured = this.toStructuredOCRPageData(
            normalizedPageNumber,
            normalized,
            pageData?.text ?? pageData?.fullText
        );

        this.ocrDataByPage.set(normalizedPageNumber, structured);
        if (this.ocrCacheManager) {
            this.ocrCacheManager.setOCR(normalizedPageNumber, structured);
        }

        const existingSource = this.pageTextSourceByPage.get(normalizedPageNumber) || 'none';
        if (existingSource !== 'native') {
            // Keep OCR data silent for now; overlays are not displayed yet.
            this.pageTextSourceByPage.set(normalizedPageNumber, 'none');
        }
        console.log(`✅ OCR data stored for page ${normalizedPageNumber}: ${structured.words.length} words`);

        const isCurrentPage = normalizedPageNumber === this.currentPage;
        const isCurrentSecondPage = this.isDoublePageMode && normalizedPageNumber === this.currentPage + 1;
        if (shouldRerender && this.pdfDoc && (isCurrentPage || isCurrentSecondPage)) {
            this.renderCurrentPage();
        }

        this.updateOCRToggleButtons();
        return true;
    }

    setOCRDocumentData(ocrDocumentData) {
        if (!ocrDocumentData) {
            console.warn('No OCR document data received');
            return 0;
        }

        // Cancel all in-flight OCR before replacing data
        this.cancelAllOCRJobs();
        this.ocrDataByPage.clear();
        if (this.ocrCacheManager) {
            this.ocrCacheManager.clear();
        }
        this.ocrViewEnabledByPage.clear();
        Array.from(this.pageTextSourceByPage.entries()).forEach(([pageNumber, source]) => {
            if (source !== 'native') {
                this.pageTextSourceByPage.delete(pageNumber);
            }
        });
        const entries = [];

        if (Array.isArray(ocrDocumentData)) {
            ocrDocumentData.forEach((pageData, index) => {
                entries.push([index + 1, pageData]);
            });
        } else if (Array.isArray(ocrDocumentData.pages)) {
            ocrDocumentData.pages.forEach((pageData, index) => {
                const pageNum = Number(pageData?.pageNumber ?? index + 1);
                entries.push([pageNum, pageData]);
            });
        } else if (ocrDocumentData.pages && typeof ocrDocumentData.pages === 'object') {
            Object.entries(ocrDocumentData.pages).forEach(([pageNumber, pageData]) => {
                entries.push([Number(pageNumber), pageData]);
            });
        } else if (ocrDocumentData.pageNumber) {
            entries.push([Number(ocrDocumentData.pageNumber), ocrDocumentData]);
        } else {
            console.warn('Unsupported OCR document payload shape');
            return 0;
        }

        let loadedCount = 0;
        entries.forEach(([pageNumber, pageData]) => {
            if (this.setOCRPageData(pageNumber, pageData, false)) {
                loadedCount++;
            }
        });

        console.log(`✅ OCR document loaded: ${loadedCount} page(s)`);

        if (this.pdfDoc) {
            this.renderCurrentPage();
        }

        return loadedCount;
    }

    normalizeOCRPageData(pageData) {
        if (!pageData || typeof pageData !== 'object') {
            return null;
        }

        try {
            let candidates;
            try {
                candidates = this.extractOCRWordCandidates(pageData);
            } catch (extractErr) {
                console.warn('Failed to extract OCR word candidates:', extractErr);
                return null;
            }

            if (!Array.isArray(candidates)) {
                return null;
            }

            const words = [];
            for (const candidate of candidates) {
                try {
                    const normalized = this.normalizeOCRWord(candidate);
                    if (normalized) {
                        words.push(normalized);
                    }
                } catch (wordErr) {
                    // Skip malformed individual words without crashing
                    console.warn('Skipping malformed OCR word:', wordErr);
                }
            }

            if (words.length === 0) {
                return null;
            }

            const imageMeta = pageData.image && typeof pageData.image === 'object' ? pageData.image : {};
            const resolvedDpi = this.toFiniteNumber(
                pageData.dpi ??
                pageData.sourceDpi ??
                imageMeta.dpi ??
                imageMeta.resolution
            ) || this.defaultOCRDpi;

            const result = {
                words,
                imageWidth: this.toFiniteNumber(
                    pageData.imageWidth ??
                    pageData.width ??
                    imageMeta.width ??
                    imageMeta.w
                ),
                imageHeight: this.toFiniteNumber(
                    pageData.imageHeight ??
                    pageData.height ??
                    imageMeta.height ??
                    imageMeta.h
                ),
                dpi: resolvedDpi
            };

            // Validate final structure has sane values
            if (!Array.isArray(result.words) || result.words.length === 0) {
                return null;
            }
            if (typeof result.dpi !== 'number' || !isFinite(result.dpi) || result.dpi <= 0) {
                result.dpi = this.defaultOCRDpi;
            }

            return result;
        } catch (err) {
            console.warn('normalizeOCRPageData failed on unexpected data structure:', err);
            return null;
        }
    }

    toStructuredOCRPageData(pageNumber, normalized, rawText) {
        if (!normalized || typeof normalized !== 'object') {
            return { pageNumber, text: undefined, words: [], imageWidth: null, imageHeight: null, dpi: this.defaultOCRDpi };
        }

        const text = typeof rawText === 'string' ? rawText.trim() : undefined;
        const words = Array.isArray(normalized.words)
            ? normalized.words.map((word) => {
                try {
                    const bbox = word && word.bbox ? word.bbox : {};
                    return {
                        text: `${word?.text ?? ''}`,
                        bbox: {
                            left: Number(bbox.left) || 0,
                            top: Number(bbox.top) || 0,
                            width: Number(bbox.width) || 0,
                            height: Number(bbox.height) || 0
                        },
                        confidence: this.toFiniteNumber(word?.confidence)
                    };
                } catch (e) {
                    return null;
                }
            }).filter(Boolean)
            : [];

        const structured = {
            pageNumber,
            text,
            words,
            imageWidth: this.toFiniteNumber(normalized.imageWidth),
            imageHeight: this.toFiniteNumber(normalized.imageHeight),
            dpi: this.toFiniteNumber(normalized.dpi) || this.defaultOCRDpi
        };

        return this.cloneStructuredData(structured);
    }

    cloneStructuredData(data) {
        if (typeof structuredClone === 'function') {
            return structuredClone(data);
        }
        return JSON.parse(JSON.stringify(data));
    }

    extractOCRWordCandidates(pageData) {
        const candidates = [];
        const visited = new WeakSet();

        const collect = (node, depth) => {
            if (!node || depth > 10) return;

            if (typeof node !== 'object') return;

            // Guard against circular references
            if (visited.has(node)) return;
            visited.add(node);

            if (Array.isArray(node)) {
                for (let i = 0; i < node.length; i++) {
                    collect(node[i], depth + 1);
                }
                return;
            }

            const hasText = typeof node.text === 'string' || typeof node.str === 'string' || typeof node.value === 'string';
            if (hasText) {
                candidates.push(node);
            }

            ['data', 'words', 'tokens', 'items', 'lines', 'blocks', 'paragraphs', 'symbols'].forEach((key) => {
                if (Array.isArray(node[key])) {
                    collect(node[key], depth + 1);
                } else if (node[key] && typeof node[key] === 'object') {
                    collect(node[key], depth + 1);
                }
            });
        };

        collect(pageData.words || pageData.tokens || pageData.items || pageData.lines || pageData.blocks || pageData, 0);

        // Deduplicate by object identity and text+bbox signature.
        const unique = [];
        const signatures = new Set();
        candidates.forEach((entry) => {
            const text = `${entry.text ?? entry.str ?? entry.value ?? ''}`.trim();
            const bbox = entry.bbox || entry.box || entry.rect || entry.bounds || entry.boundingBox || entry;
            const signature = `${text}|${JSON.stringify(bbox)}`;
            if (text && !signatures.has(signature)) {
                signatures.add(signature);
                unique.push(entry);
            }
        });

        return unique;
    }

    normalizeOCRWord(rawWord) {
        if (!rawWord || typeof rawWord !== 'object') return null;

        const text = `${rawWord.text ?? rawWord.str ?? rawWord.value ?? ''}`.trim();
        if (!text) return null;

        const bbox = this.normalizeOCRBBox(
            rawWord.bbox ||
            rawWord.box ||
            rawWord.rect ||
            rawWord.bounds ||
            rawWord.boundingBox ||
            rawWord
        );

        if (!bbox || bbox.width <= 0 || bbox.height <= 0) {
            return null;
        }

        return {
            text,
            bbox,
            confidence: this.toFiniteNumber(rawWord.confidence ?? rawWord.conf ?? rawWord.score)
        };
    }

    normalizeOCRBBox(bboxInput) {
        if (!bboxInput) return null;

        if (Array.isArray(bboxInput) && bboxInput.length >= 4) {
            const x1 = this.toFiniteNumber(bboxInput[0]);
            const y1 = this.toFiniteNumber(bboxInput[1]);
            const third = this.toFiniteNumber(bboxInput[2]);
            const fourth = this.toFiniteNumber(bboxInput[3]);

            if ([x1, y1, third, fourth].some((n) => n === null)) return null;

            if (third > x1 && fourth > y1) {
                return {
                    left: x1,
                    top: y1,
                    width: third - x1,
                    height: fourth - y1
                };
            }

            return {
                left: x1,
                top: y1,
                width: Math.max(0, third),
                height: Math.max(0, fourth)
            };
        }

        if (typeof bboxInput !== 'object') return null;

        if (Array.isArray(bboxInput.points) && bboxInput.points.length > 1) {
            const points = bboxInput.points
                .map((point) => [this.toFiniteNumber(point?.x), this.toFiniteNumber(point?.y)])
                .filter((point) => point[0] !== null && point[1] !== null);

            if (points.length > 1) {
                const xs = points.map((point) => point[0]);
                const ys = points.map((point) => point[1]);
                const minX = Math.min(...xs);
                const maxX = Math.max(...xs);
                const minY = Math.min(...ys);
                const maxY = Math.max(...ys);
                return {
                    left: minX,
                    top: minY,
                    width: maxX - minX,
                    height: maxY - minY
                };
            }
        }

        const left = this.toFiniteNumber(bboxInput.left ?? bboxInput.x ?? bboxInput.x0);
        const top = this.toFiniteNumber(bboxInput.top ?? bboxInput.y ?? bboxInput.y0);
        const width = this.toFiniteNumber(bboxInput.width ?? bboxInput.w);
        const height = this.toFiniteNumber(bboxInput.height ?? bboxInput.h);

        if (left !== null && top !== null && width !== null && height !== null) {
            return {
                left,
                top,
                width: Math.max(0, width),
                height: Math.max(0, height)
            };
        }

        const x0 = this.toFiniteNumber(bboxInput.x0 ?? bboxInput.left ?? bboxInput.x);
        const y0 = this.toFiniteNumber(bboxInput.y0 ?? bboxInput.top ?? bboxInput.y);
        const x1 = this.toFiniteNumber(bboxInput.x1 ?? bboxInput.right);
        const y1 = this.toFiniteNumber(bboxInput.y1 ?? bboxInput.bottom);

        if (x0 !== null && y0 !== null && x1 !== null && y1 !== null) {
            return {
                left: Math.min(x0, x1),
                top: Math.min(y0, y1),
                width: Math.abs(x1 - x0),
                height: Math.abs(y1 - y0)
            };
        }

        return null;
    }

    resolveOCRImageDimensions(ocrPageData, page, viewport) {
        const view = page?.view || [0, 0, 1, 1];
        const pageWidth = Math.max(1, view[2] - view[0]);
        const pageHeight = Math.max(1, view[3] - view[1]);

        const dpi = this.toFiniteNumber(ocrPageData?.dpi) || this.defaultOCRDpi;
        let width = this.toFiniteNumber(ocrPageData?.imageWidth);
        let height = this.toFiniteNumber(ocrPageData?.imageHeight);

        if (!width || width <= 0) {
            width = (pageWidth * dpi) / 72;
        }
        if (!height || height <= 0) {
            height = (pageHeight * dpi) / 72;
        }

        if ((!width || !height) && viewport) {
            width = width || viewport.width;
            height = height || viewport.height;
        }

        return { width, height, dpi };
    }

    mapOCRBoxToViewport(ocrBBox, ocrImageSize, page, viewport) {
        const view = page?.view || [0, 0, 1, 1];
        const pageWidthPts = Math.max(1, view[2] - view[0]);
        const pageHeightPts = Math.max(1, view[3] - view[1]);

        const imageWidthPx = Math.max(1, ocrImageSize.width);
        const imageHeightPx = Math.max(1, ocrImageSize.height);
        const ocrDpi = Math.max(1, this.toFiniteNumber(ocrImageSize.dpi) || this.defaultOCRDpi);

        // DPI normalization: convert OCR pixel space to physical page points.
        const pointsPerPixelX = 72 / ocrDpi;
        const pointsPerPixelY = 72 / ocrDpi;

        const dpiImageWidthPts = imageWidthPx * pointsPerPixelX;
        const dpiImageHeightPts = imageHeightPx * pointsPerPixelY;
        const dpiNormX = pageWidthPts / Math.max(1, dpiImageWidthPts);
        const dpiNormY = pageHeightPts / Math.max(1, dpiImageHeightPts);

        const leftPts = ocrBBox.left * pointsPerPixelX * dpiNormX;
        const topPts = ocrBBox.top * pointsPerPixelY * dpiNormY;
        const widthPts = Math.max(0, ocrBBox.width * pointsPerPixelX * dpiNormX);
        const heightPts = Math.max(0, ocrBBox.height * pointsPerPixelY * dpiNormY);

        const viewportScaleX = viewport.width / pageWidthPts;
        const viewportScaleY = viewport.height / pageHeightPts;

        const mappedX = leftPts * viewportScaleX;
        const mappedWidth = widthPts * viewportScaleX;
        const mappedHeight = heightPts * viewportScaleY;

        // Y-axis inversion: OCR top-left origin -> PDF viewport top-left overlay space.
        const mappedTop = viewport.height - ((topPts + heightPts) * viewportScaleY);
        const baselineY = mappedTop + mappedHeight;

        // Baseline placement + required font-size estimate.
        const fontSize = Math.max(1, mappedHeight * 0.8);

        return {
            x: mappedX,
            y: mappedTop,
            width: Math.max(1, mappedWidth),
            height: Math.max(1, mappedHeight),
            baselineY,
            fontSize,
            mapScaleX: viewportScaleX,
            mapScaleY: viewportScaleY
        };
    }

    measureOCRTextWidth(text, fontSize) {
        const normalizedText = `${text || ''}`.trim();
        if (!normalizedText) return 0;

        if (!this.ocrMeasureCtx) {
            this.ocrMeasureCanvas = document.createElement('canvas');
            this.ocrMeasureCtx = this.ocrMeasureCanvas.getContext('2d');
        }

        if (!this.ocrMeasureCtx) {
            return Math.max(1, normalizedText.length * fontSize * 0.5);
        }

        this.ocrMeasureCtx.font = `${fontSize}px sans-serif`;
        const measured = this.ocrMeasureCtx.measureText(normalizedText).width;
        return Math.max(1, measured);
    }

    async renderOCRLayer(page, viewport, ocrLayerElement = null, pageNumber = this.currentPage) {
        const ocrLayer = ocrLayerElement || document.getElementById('ocrLayer');
        if (!ocrLayer) return;

        ocrLayer.innerHTML = '';

        const ocrPageData = this.getCachedOCR(pageNumber);
        if (!ocrPageData || !Array.isArray(ocrPageData.words) || ocrPageData.words.length === 0) {
            ocrLayer.classList.remove('debug');
            return;
        }

        ocrLayer.classList.toggle('debug', this.ocrDebugMode);
        const ocrImageSize = this.resolveOCRImageDimensions(ocrPageData, page, viewport);
        const svgNs = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNs, 'svg');
        svg.setAttribute('class', 'ocr-overlay-svg');
        svg.setAttribute('viewBox', `0 0 ${viewport.width} ${viewport.height}`);
        svg.setAttribute('width', `${viewport.width}`);
        svg.setAttribute('height', `${viewport.height}`);
        svg.setAttribute('preserveAspectRatio', 'none');

        const debugRows = [];
        let renderedCount = 0;

        for (const word of ocrPageData.words) {
            const mapped = this.mapOCRBoxToViewport(word.bbox, ocrImageSize, page, viewport);
            if (!mapped || !word.text) continue;

            renderedCount++;
            const measuredTextWidth = this.measureOCRTextWidth(word.text, mapped.fontSize);
            const textScaleX = Math.max(0.05, mapped.width / Math.max(1, measuredTextWidth));

            if (this.ocrDebugMode) {
                const rect = document.createElementNS(svgNs, 'rect');
                rect.setAttribute('class', 'ocr-bbox');
                rect.setAttribute('x', `${mapped.x}`);
                rect.setAttribute('y', `${mapped.y}`);
                rect.setAttribute('width', `${mapped.width}`);
                rect.setAttribute('height', `${mapped.height}`);
                svg.appendChild(rect);

                const baseline = document.createElementNS(svgNs, 'line');
                baseline.setAttribute('class', 'ocr-baseline');
                baseline.setAttribute('x1', `${mapped.x}`);
                baseline.setAttribute('y1', `${mapped.baselineY}`);
                baseline.setAttribute('x2', `${mapped.x + mapped.width}`);
                baseline.setAttribute('y2', `${mapped.baselineY}`);
                svg.appendChild(baseline);
            }

            const textGroup = document.createElementNS(svgNs, 'g');
            textGroup.setAttribute(
                'transform',
                `translate(${mapped.x} ${mapped.baselineY}) scale(${textScaleX} 1)`
            );

            const textNode = document.createElementNS(svgNs, 'text');
            textNode.setAttribute('class', 'ocr-word');
            textNode.setAttribute('x', '0');
            textNode.setAttribute('y', '0');
            textNode.setAttribute('font-size', `${mapped.fontSize}`);
            textNode.setAttribute('font-family', 'sans-serif');
            textNode.setAttribute('dominant-baseline', 'alphabetic');
            textNode.setAttribute('xml:space', 'preserve');
            textNode.textContent = word.text;
            textGroup.appendChild(textNode);
            svg.appendChild(textGroup);

            if (this.ocrDebugMode && debugRows.length < 12) {
                const formulaMappedX = word.bbox.left * mapped.mapScaleX;
                const formulaMappedY = viewport.height - ((word.bbox.top + word.bbox.height) * mapped.mapScaleY);
                debugRows.push({
                    text: word.text,
                    ocrLeft: Number(word.bbox.left.toFixed(2)),
                    ocrTop: Number(word.bbox.top.toFixed(2)),
                    ocrWidth: Number(word.bbox.width.toFixed(2)),
                    ocrHeight: Number(word.bbox.height.toFixed(2)),
                    mapScaleX: Number(mapped.mapScaleX.toFixed(4)),
                    mapScaleY: Number(mapped.mapScaleY.toFixed(4)),
                    formulaX: Number(formulaMappedX.toFixed(2)),
                    formulaY: Number(formulaMappedY.toFixed(2)),
                    baselineX: Number(mapped.x.toFixed(2)),
                    baselineY: Number(mapped.baselineY.toFixed(2)),
                    deltaX: Number((mapped.x - formulaMappedX).toFixed(2)),
                    deltaY: Number((mapped.y - formulaMappedY).toFixed(2)),
                    fontSize: Number(mapped.fontSize.toFixed(2)),
                    measuredTextWidth: Number(measuredTextWidth.toFixed(2)),
                    textScaleX: Number(textScaleX.toFixed(4)),
                    mappedX: Number(mapped.x.toFixed(2)),
                    mappedY: Number(mapped.y.toFixed(2)),
                    mappedWidth: Number(mapped.width.toFixed(2)),
                    mappedHeight: Number(mapped.height.toFixed(2))
                });
            }
        }

        ocrLayer.appendChild(svg);

        if (this.ocrDebugMode) {
            console.groupCollapsed(`[OCR DEBUG] Page ${pageNumber} overlay diagnostics`);
            console.log('OCR image size:', ocrImageSize);
            console.log('Viewport:', {
                width: viewport.width,
                height: viewport.height,
                scale: viewport.scale,
                transform: viewport.transform
            });
            console.log('Rendered words:', renderedCount);
            if (debugRows.length > 0) {
                console.table(debugRows);
            }
            console.groupEnd();
        }
    }

    toFiniteNumber(value) {
        const number = Number(value);
        return Number.isFinite(number) ? number : null;
    }

    async renderTextLayer(page, viewport, textLayerElement = null) {
        // Use passed element or fall back to default
        const textLayer = textLayerElement || document.getElementById('textLayer');
        if (!textLayer) return;

        try {
            // Clear previous content
            textLayer.innerHTML = '';

            // Strategy 1: PDF.js v4.x TextLayerBuilder from pdf_viewer.mjs
            // (loaded by PDFReaderApp.tsx and placed on window)
            if (window.TextLayerBuilder && window.EventBus) {
                const eventBus = new window.EventBus();
                const textLayerBuilder = new window.TextLayerBuilder({
                    pdfPage: page,
                    eventBus: eventBus,
                    highlighter: null,
                    accessibilityManager: null,
                    enablePermissions: false
                });
                textLayer.appendChild(textLayerBuilder.div);
                await textLayerBuilder.render(viewport);
                console.log('✅ Text layer rendered using TextLayerBuilder');
                return;
            }

            // Strategy 2: pdfjsLib.TextLayer (available in pdfjs-dist v4.x core)
            // Does not require pdf_viewer.mjs — works offline with the npm package
            if (typeof pdfjsLib !== 'undefined' && pdfjsLib.TextLayer) {
                const textContentSource = await page.getTextContent();
                const textLayerDiv = document.createElement('div');
                textLayerDiv.className = 'textLayer';
                textLayer.appendChild(textLayerDiv);

                const pdfTextLayer = new pdfjsLib.TextLayer({
                    textContentSource: textContentSource,
                    container: textLayerDiv,
                    viewport: viewport
                });
                await pdfTextLayer.render();
                console.log('✅ Text layer rendered using pdfjsLib.TextLayer');
                return;
            }

            // Strategy 3: Manual text span rendering (ultimate fallback)
            // Renders text content as positioned spans for basic text selection
            const textContent = await page.getTextContent();
            if (!textContent || !textContent.items || textContent.items.length === 0) return;

            const textLayerDiv = document.createElement('div');
            textLayerDiv.className = 'textLayer';
            textLayerDiv.style.position = 'absolute';
            textLayerDiv.style.left = '0';
            textLayerDiv.style.top = '0';
            textLayerDiv.style.right = '0';
            textLayerDiv.style.bottom = '0';
            textLayerDiv.style.overflow = 'hidden';
            textLayerDiv.style.opacity = '0.25';
            textLayerDiv.style.lineHeight = '1.0';

            for (const item of textContent.items) {
                if (!item.str) continue;
                const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
                const span = document.createElement('span');
                span.textContent = item.str;
                const fontHeight = Math.hypot(tx[2], tx[3]);
                const left = tx[4];
                const top = tx[5] - fontHeight;
                span.style.cssText = `
                    position: absolute;
                    left: ${left}px;
                    top: ${top}px;
                    font-size: ${fontHeight}px;
                    font-family: sans-serif;
                    white-space: pre;
                    pointer-events: all;
                    color: transparent;
                `;
                textLayerDiv.appendChild(span);
            }
            textLayer.appendChild(textLayerDiv);
            console.log('✅ Text layer rendered using manual span fallback');

        } catch (error) {
            console.error('❌ Error rendering text layer:', error);
        }
    }

    updateFileInfo(fileName, status) {
        const fileInfo = document.getElementById('fileInfo');
        const fileNameEl = document.getElementById('fileName');
        const fileStatusEl = document.getElementById('fileStatus');

        if (fileName) {
            if (fileInfo) fileInfo.classList.remove('hidden');
            if (fileNameEl) fileNameEl.textContent = fileName;
            if (fileStatusEl) fileStatusEl.textContent = status;
        } else {
            if (fileInfo) fileInfo.classList.add('hidden');
        }
    }

    hidePlaceholder() {
        const placeholder = document.getElementById('pdfPlaceholder');
        if (placeholder) {
            placeholder.classList.add('hidden');
        }
    }

    showLoading(text = 'Loading...') {
        const loadingIndicator = document.getElementById('loadingIndicator');
        const loadingText = document.getElementById('loadingText');

        if (loadingIndicator) loadingIndicator.classList.remove('hidden');
        if (loadingText) loadingText.textContent = text;
    }

    hideLoading() {
        const loadingIndicator = document.getElementById('loadingIndicator');
        if (loadingIndicator) loadingIndicator.classList.add('hidden');
    }

    showError(message) {
        const errorModal = document.getElementById('errorModal');
        const errorMessage = document.getElementById('errorMessage');

        if (errorMessage) errorMessage.textContent = message;
        if (errorModal) errorModal.classList.remove('hidden');
    }

    hideError() {
        const errorModal = document.getElementById('errorModal');
        if (errorModal) errorModal.classList.add('hidden');
    }

    showSuccess(message) {
        console.log('✅', message);
    }

    handleKeyboard(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        switch (e.key) {
            case 'ArrowLeft':
                e.preventDefault();
                this.previousPage();
                break;
            case 'ArrowRight':
                e.preventDefault();
                this.nextPage();
                break;
            case 'Home':
                e.preventDefault();
                this.goToPage(1);
                break;
            case 'End':
                e.preventDefault();
                this.goToPage(this.totalPages);
                break;
            case 'F11':
                e.preventDefault();
                this.toggleFullscreen();
                break;
        }
    }

    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    /**
     * Tear down the reader instance: clear all timers, remove global event
     * listeners, disconnect observers, and release canvas memory.
     * Call this when the host component unmounts (e.g. React useEffect cleanup).
     */
    destroy() {
        // --- Timers ---
        if (this.resizeDebounceTimer) {
            clearTimeout(this.resizeDebounceTimer);
            this.resizeDebounceTimer = null;
        }
        if (this.fullscreenTimer) {
            clearTimeout(this.fullscreenTimer);
            this.fullscreenTimer = null;
        }
        if (this.mouseMoveTimer) {
            clearTimeout(this.mouseMoveTimer);
            this.mouseMoveTimer = null;
        }

        // --- Event listeners ---
        if (this._boundHandlers) {
            if (this._boundHandlers.resize) {
                window.removeEventListener('resize', this._boundHandlers.resize);
            }
            if (this._boundHandlers.keydown) {
                document.removeEventListener('keydown', this._boundHandlers.keydown);
            }
            if (this._boundHandlers.mousemove) {
                document.removeEventListener('mousemove', this._boundHandlers.mousemove);
            }
            if (this._boundHandlers.fullscreenchange) {
                document.removeEventListener('fullscreenchange', this._boundHandlers.fullscreenchange);
            }
            if (this._boundHandlers.clickHideContext) {
                document.removeEventListener('click', this._boundHandlers.clickHideContext);
            }
            this._boundHandlers = {};
        }

        // --- IntersectionObserver ---
        if (this.pageVisibilityObserver) {
            this.pageVisibilityObserver.disconnect();
            this.pageVisibilityObserver = null;
        }

        // --- Cancel OCR ---
        this.cancelAllOCRJobs();
        if (this.ocrWorkerManager && typeof this.ocrWorkerManager.terminate === 'function') {
            this.ocrWorkerManager.terminate();
        }

        // --- Canvas memory ---
        this.releaseCanvasMemory(this.canvas1, this.ctx1);
        this.releaseCanvasMemory(this.canvas2, this.ctx2);
        if (this.ocrMeasureCanvas) {
            this.releaseCanvasMemory(this.ocrMeasureCanvas, this.ocrMeasureCtx);
            this.ocrMeasureCanvas = null;
            this.ocrMeasureCtx = null;
        }

        // --- Quill editor ---
        if (this.notesEditor) {
            this.notesEditor.off('text-change');
            this.notesEditor = null;
        }

        // --- Window hooks ---
        if (typeof window !== 'undefined') {
            delete window.setOCRPageData;
            delete window.setOCRDocumentData;
            delete window.toggleOCRDebug;
        }

        console.log('🧹 FixedEnhancedPDFReader destroyed');
    }
}

// Initialize the fixed reader when the page loads
// Note: For Next.js, this is handled by PDFReaderInitializer component
// The DOMContentLoaded event is not used because it fires before this script loads
let reader;

// Export the class to window so it can be instantiated from React
if (typeof window !== 'undefined') {
    window.FixedEnhancedPDFReader = FixedEnhancedPDFReader;
}

// Legacy initialization for non-Next.js environments
if (typeof window !== 'undefined' && document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        reader = new FixedEnhancedPDFReader();

        // Load saved data
        reader.loadHighlights();

        // Check for saved API key
        try {
            const savedKey = localStorage.getItem('pdf-reader-api-key');
            if (savedKey) {
                const apiKeyInput = document.getElementById('apiKeyInput');
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
    });
}
