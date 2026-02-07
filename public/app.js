// Set PDF.js worker - this will be overridden by PDFReaderApp.tsx
// The React component sets the correct worker URL using pdfjsLib.version
// This line is kept for compatibility but won't execute in Next.js (window.pdfjsLib is set by React)
if (typeof pdfjsLib !== 'undefined' && typeof pdfjsLib.GlobalWorkerOptions !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
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

        // OCR overlay state
        this.ocrDataByPage = new Map();
        this.ocrDebugMode = false;
        this.defaultOCRDpi = 300;
        this.ocrRenderScale = 3;
        this.nativeTextCharThreshold = 20;
        this.pageTextSourceByPage = new Map();
        this.pageTextStatsByPage = new Map();
        this.ocrJobsByPage = new Map();
        this.resizeDebounceTimer = null;

        // Enhanced features
        this.highlights = [];
        this.aiApiKey = null;
        this.notesEditor = null;
        this.selectedText = '';
        this.currentTab = 'welcome';

        // Fullscreen properties
        this.fullscreenTimer = null;
        this.mouseMoveTimer = null;

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
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));

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
        document.addEventListener('mousemove', () => this.handleFullscreenMouseMove());

        // Listen for fullscreen changes
        document.addEventListener('fullscreenchange', () => this.handleFullscreenChange());
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
        localStorage.setItem('leftSidebarCollapsed', this.leftSidebarCollapsed);
        console.log(`📂 Left sidebar ${this.leftSidebarCollapsed ? 'collapsed' : 'expanded'}`);
    }

    toggleRightPanel() {
        const panel = document.getElementById('rightPanel');
        if (!panel) return;

        this.rightPanelCollapsed = !this.rightPanelCollapsed;
        panel.classList.toggle('collapsed', this.rightPanelCollapsed);

        // Persist state
        localStorage.setItem('rightPanelCollapsed', this.rightPanelCollapsed);
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
        window.addEventListener('resize', () => {
            if (!this.pdfDoc) return;

            if (this.resizeDebounceTimer) {
                clearTimeout(this.resizeDebounceTimer);
            }

            this.resizeDebounceTimer = setTimeout(async () => {
                try {
                    if (this.isFitWidthMode) {
                        await this.fitToWidth();
                    } else {
                        await this.renderCurrentPage();
                    }
                } catch (error) {
                    console.warn('Resize re-render failed:', error);
                }
            }, 120);
        });
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

            // Clear timers
            if (this.mouseMoveTimer) {
                clearTimeout(this.mouseMoveTimer);
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

            console.log(`📄 Rendered page ${this.currentPage} in ${this.isDoublePageMode ? 'double' : 'single'} page mode`);
        } catch (error) {
            console.error('Error rendering page:', error);
        }
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

        // Show first page wrapper
        if (this.pageWrapper1) this.pageWrapper1.classList.remove('hidden');

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
            this.clearTextLayer(this.textLayer2);
            this.clearOCRLayer(this.ocrLayer2);
        }

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

        if (this.isDoublePageMode) {
            this.currentPage = Math.max(1, this.currentPage - 2);
        } else {
            this.currentPage--;
        }

        this.renderCurrentPage();
        this.updateUIState();
    }

    nextPage() {
        if (this.currentPage >= this.totalPages) return;

        if (this.isDoublePageMode) {
            this.currentPage = Math.min(this.totalPages, this.currentPage + 2);
        } else {
            this.currentPage++;
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
            this.currentPage >= this.totalPages - 1 :
            this.currentPage >= this.totalPages;

        if (prevBtn) prevBtn.disabled = isAtStart;
        if (nextBtn) nextBtn.disabled = isAtEnd;
        if (fullscreenPrev) fullscreenPrev.disabled = isAtStart;
        if (fullscreenNext) fullscreenNext.disabled = isAtEnd;

        // Update TOC active items
        this.updateTOCActiveItem();
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
            this.showLoading('Loading PDF...');
            this.updateFileInfo(file.name, 'Loading...');

            const arrayBuffer = await file.arrayBuffer();
            const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
            this.pdfDoc = await loadingTask.promise;
            this.totalPages = this.pdfDoc.numPages;
            this.currentPage = 1;
            this.ocrDataByPage.clear();
            this.pageTextSourceByPage.clear();
            this.pageTextStatsByPage.clear();
            this.ocrJobsByPage.clear();

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
        this.scale = containerWidth / viewport.width;
        this.isFitWidthMode = true;
        await this.renderCurrentPage();
        this.updateZoomDisplay();
        this.updateFitWidthButton();
    }

    async fitToHeight() {
        if (!this.pdfDoc) return;
        const container = document.querySelector('.pdf-container');
        const containerHeight = container.clientHeight - 32;
        const page = await this.pdfDoc.getPage(this.currentPage);
        const viewport = page.getViewport({ scale: 1.0 });
        this.scale = containerHeight / viewport.height;
        this.isFitWidthMode = false;
        await this.renderCurrentPage();
        this.updateZoomDisplay();
        this.updateFitWidthButton();
    }

    zoomIn() {
        this.scale = Math.min(this.scale * 1.2, 5.0);
        this.isFitWidthMode = false;
        this.renderCurrentPage();
        this.updateZoomDisplay();
        this.updateFitWidthButton();
    }

    zoomOut() {
        this.scale = Math.max(this.scale / 1.2, 0.1);
        this.isFitWidthMode = false;
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
        document.addEventListener('click', () => this.hideContextMenu());
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

        window.getSelection().removeAllRanges();
        this.selectedText = '';

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
            localStorage.setItem('pdf-reader-highlights', JSON.stringify(this.highlights));
        } catch (error) {
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
            console.error('Error saving notes:', error);
            this.showError('Could not save notes');
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
            } else {
                return 1;
            }

            if (!resolvedDest || !Array.isArray(resolvedDest) || resolvedDest.length === 0) {
                return 1;
            }

            const pageRef = resolvedDest[0];
            if (!pageRef || typeof pageRef !== 'object') {
                return 1;
            }

            const pageIndex = await this.pdfDoc.getPageIndex(pageRef);
            const pageNumber = pageIndex + 1;

            if (pageNumber < 1 || pageNumber > this.totalPages) {
                return Math.max(1, Math.min(pageNumber, this.totalPages));
            }

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

        if (source === 'native') {
            if (textLayer) textLayer.style.pointerEvents = 'auto';
            if (ocrLayer) ocrLayer.style.pointerEvents = 'none';
            this.clearOCRLayer(ocrLayer);
            await this.renderTextLayer(page, viewport, textLayer);
        } else if (source === 'ocr') {
            if (textLayer) textLayer.style.pointerEvents = 'none';
            if (ocrLayer) ocrLayer.style.pointerEvents = 'auto';
            this.clearTextLayer(textLayer);
            await this.renderOCRLayer(page, viewport, ocrLayer, pageNumber);
        } else {
            if (textLayer) textLayer.style.pointerEvents = 'none';
            if (ocrLayer) ocrLayer.style.pointerEvents = 'none';
            this.clearTextLayer(textLayer);
            this.clearOCRLayer(ocrLayer);
        }

        if (this.ocrDebugMode) {
            const stats = this.pageTextStatsByPage.get(pageNumber);
            console.log(`[TEXT SOURCE] Page ${pageNumber}: ${source}`, stats || {});
        }

        return source;
    }

    async resolvePageTextSource(page, pageNumber) {
        if (this.pageTextSourceByPage.has(pageNumber)) {
            return this.pageTextSourceByPage.get(pageNumber);
        }

        const nativeStats = await this.getNativeTextStats(page);
        this.pageTextStatsByPage.set(pageNumber, nativeStats);

        if (nativeStats.isMeaningful) {
            this.pageTextSourceByPage.set(pageNumber, 'native');
            return 'native';
        }

        const hasOCR = await this.ensureOCRForPage(page, pageNumber);
        if (hasOCR) {
            this.pageTextSourceByPage.set(pageNumber, 'ocr');
            return 'ocr';
        }

        // Cache "none" only if an OCR engine is available but produced no usable output.
        if (this.isOCREngineAvailable()) {
            this.pageTextSourceByPage.set(pageNumber, 'none');
        }
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
        if (this.ocrDataByPage.has(pageNumber)) {
            return true;
        }

        if (!this.isOCREngineAvailable()) {
            return false;
        }

        if (this.ocrJobsByPage.has(pageNumber)) {
            return this.ocrJobsByPage.get(pageNumber);
        }

        const job = this.performOCRForPage(page, pageNumber)
            .then((ocrPageData) => {
                if (!ocrPageData) return false;
                return this.setOCRPageData(pageNumber, ocrPageData, false);
            })
            .catch((error) => {
                console.error(`OCR fallback failed on page ${pageNumber}:`, error);
                return false;
            })
            .finally(() => {
                this.ocrJobsByPage.delete(pageNumber);
            });

        this.ocrJobsByPage.set(pageNumber, job);
        return job;
    }

    isOCREngineAvailable() {
        return typeof window !== 'undefined' && (
            typeof window.performOCR === 'function' ||
            (window.Tesseract && typeof window.Tesseract.recognize === 'function')
        );
    }

    async performOCRForPage(page, pageNumber) {
        const ocrViewport = page.getViewport({ scale: this.ocrRenderScale });
        const ocrCanvas = document.createElement('canvas');
        ocrCanvas.width = Math.max(1, Math.ceil(ocrViewport.width));
        ocrCanvas.height = Math.max(1, Math.ceil(ocrViewport.height));

        const ocrContext = ocrCanvas.getContext('2d', { alpha: false });
        if (!ocrContext) {
            console.warn('Could not create OCR canvas context');
            return null;
        }

        await page.render({
            canvasContext: ocrContext,
            viewport: ocrViewport
        }).promise;

        const imageDataUrl = ocrCanvas.toDataURL('image/png');
        const rawOCR = await this.callOCREngine(imageDataUrl, pageNumber);
        if (!rawOCR) {
            return null;
        }

        const ocrPayload = typeof rawOCR === 'object' ? rawOCR : { words: [] };
        const normalizedOCR = this.normalizeOCRPageData({
            ...ocrPayload,
            imageWidth: ocrCanvas.width,
            imageHeight: ocrCanvas.height,
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

        this.ocrDataByPage.set(normalizedPageNumber, normalized);
        const existingSource = this.pageTextSourceByPage.get(normalizedPageNumber);
        if (existingSource === 'none' || existingSource === 'ocr') {
            this.pageTextSourceByPage.set(normalizedPageNumber, 'ocr');
        }
        console.log(`✅ OCR data stored for page ${normalizedPageNumber}: ${normalized.words.length} words`);

        const isCurrentPage = normalizedPageNumber === this.currentPage;
        const isCurrentSecondPage = this.isDoublePageMode && normalizedPageNumber === this.currentPage + 1;
        if (shouldRerender && this.pdfDoc && (isCurrentPage || isCurrentSecondPage)) {
            this.renderCurrentPage();
        }

        return true;
    }

    setOCRDocumentData(ocrDocumentData) {
        if (!ocrDocumentData) {
            console.warn('No OCR document data received');
            return 0;
        }

        this.ocrDataByPage.clear();
        this.ocrJobsByPage.clear();
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

        const words = this.extractOCRWordCandidates(pageData)
            .map((word) => this.normalizeOCRWord(word))
            .filter(Boolean);

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

        return {
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
    }

    extractOCRWordCandidates(pageData) {
        const candidates = [];

        const collect = (node) => {
            if (!node) return;

            if (Array.isArray(node)) {
                node.forEach(collect);
                return;
            }

            if (typeof node !== 'object') return;

            const hasText = typeof node.text === 'string' || typeof node.str === 'string' || typeof node.value === 'string';
            if (hasText) {
                candidates.push(node);
            }

            ['data', 'words', 'tokens', 'items', 'lines', 'blocks', 'paragraphs', 'symbols'].forEach((key) => {
                if (Array.isArray(node[key])) {
                    collect(node[key]);
                } else if (node[key] && typeof node[key] === 'object') {
                    collect(node[key]);
                }
            });
        };

        collect(pageData.words || pageData.tokens || pageData.items || pageData.lines || pageData.blocks || pageData);

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

    applyMatrixTransform(point, matrix) {
        const x = point[0];
        const y = point[1];
        return [
            matrix[0] * x + matrix[2] * y + matrix[4],
            matrix[1] * x + matrix[3] * y + matrix[5]
        ];
    }

    mapOCRBoxToViewport(ocrBBox, ocrImageSize, page, viewport) {
        const view = page?.view || [0, 0, 1, 1];
        const pageWidth = Math.max(1, view[2] - view[0]);
        const pageHeight = Math.max(1, view[3] - view[1]);
        const imageWidth = Math.max(1, ocrImageSize.width);
        const imageHeight = Math.max(1, ocrImageSize.height);
        const scaleX = viewport.width / imageWidth;
        const scaleY = viewport.height / imageHeight;

        // Normalize from OCR image coordinates (top-left origin) into PDF page coordinates.
        const clamp01 = (value) => Math.min(1, Math.max(0, value));
        const leftRatio = clamp01(ocrBBox.left / imageWidth);
        const rightRatio = clamp01((ocrBBox.left + ocrBBox.width) / imageWidth);
        const topRatio = clamp01(ocrBBox.top / imageHeight);
        const bottomRatio = clamp01((ocrBBox.top + ocrBBox.height) / imageHeight);

        // PDF.js uses bottom-left page coordinates, so invert Y here.
        const pdfLeft = view[0] + leftRatio * pageWidth;
        const pdfRight = view[0] + rightRatio * pageWidth;
        const pdfTop = view[1] + (1 - topRatio) * pageHeight;
        const pdfBottom = view[1] + (1 - bottomRatio) * pageHeight;

        // Apply full viewport matrix so zoom/rotation/translation are all respected.
        const matrix = viewport.transform;
        const bottomLeft = this.applyMatrixTransform([pdfLeft, pdfBottom], matrix);
        const bottomRight = this.applyMatrixTransform([pdfRight, pdfBottom], matrix);
        const topLeft = this.applyMatrixTransform([pdfLeft, pdfTop], matrix);
        const topRight = this.applyMatrixTransform([pdfRight, pdfTop], matrix);

        const xs = [bottomLeft[0], bottomRight[0], topLeft[0], topRight[0]];
        const ys = [bottomLeft[1], bottomRight[1], topLeft[1], topRight[1]];

        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        const baselineVectorX = bottomRight[0] - bottomLeft[0];
        const baselineVectorY = bottomRight[1] - bottomLeft[1];
        const baselineLength = Math.max(1, Math.hypot(baselineVectorX, baselineVectorY));

        // Height from the area formula keeps baseline anchoring stable for rotated pages.
        const sideVectorX = topLeft[0] - bottomLeft[0];
        const sideVectorY = topLeft[1] - bottomLeft[1];
        const heightFromCross = Math.abs(
            baselineVectorX * sideVectorY - baselineVectorY * sideVectorX
        ) / baselineLength;

        const fontSize = Math.max(1, heightFromCross || (maxY - minY));
        const rotationDeg = (Math.atan2(baselineVectorY, baselineVectorX) * 180) / Math.PI;

        return {
            x: minX,
            y: minY,
            width: Math.max(1, maxX - minX),
            height: Math.max(1, maxY - minY),
            fontSize,
            rotationDeg,
            baselineLength,
            baselineStart: bottomLeft,
            baselineEnd: bottomRight,
            scaleX,
            scaleY
        };
    }

    async renderOCRLayer(page, viewport, ocrLayerElement = null, pageNumber = this.currentPage) {
        const ocrLayer = ocrLayerElement || document.getElementById('ocrLayer');
        if (!ocrLayer) return;

        ocrLayer.innerHTML = '';

        const ocrPageData = this.ocrDataByPage.get(pageNumber);
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
                baseline.setAttribute('x1', `${mapped.baselineStart[0]}`);
                baseline.setAttribute('y1', `${mapped.baselineStart[1]}`);
                baseline.setAttribute('x2', `${mapped.baselineEnd[0]}`);
                baseline.setAttribute('y2', `${mapped.baselineEnd[1]}`);
                svg.appendChild(baseline);
            }

            const textNode = document.createElementNS(svgNs, 'text');
            textNode.setAttribute('class', 'ocr-word');
            textNode.setAttribute('x', `${mapped.baselineStart[0]}`);
            textNode.setAttribute('y', `${mapped.baselineStart[1]}`);
            textNode.setAttribute('font-size', `${mapped.fontSize}`);
            textNode.setAttribute('textLength', `${mapped.baselineLength}`);
            textNode.setAttribute('lengthAdjust', 'spacingAndGlyphs');
            textNode.setAttribute('xml:space', 'preserve');
            textNode.textContent = word.text;

            if (Math.abs(mapped.rotationDeg) > 0.001) {
                textNode.setAttribute(
                    'transform',
                    `rotate(${mapped.rotationDeg} ${mapped.baselineStart[0]} ${mapped.baselineStart[1]})`
                );
            }

            svg.appendChild(textNode);

            if (this.ocrDebugMode && debugRows.length < 12) {
                const formulaMappedX = word.bbox.left * mapped.scaleX;
                const formulaMappedY = viewport.height - ((word.bbox.top + word.bbox.height) * mapped.scaleY);
                debugRows.push({
                    text: word.text,
                    ocrLeft: Number(word.bbox.left.toFixed(2)),
                    ocrTop: Number(word.bbox.top.toFixed(2)),
                    ocrWidth: Number(word.bbox.width.toFixed(2)),
                    ocrHeight: Number(word.bbox.height.toFixed(2)),
                    scaleX: Number(mapped.scaleX.toFixed(4)),
                    scaleY: Number(mapped.scaleY.toFixed(4)),
                    formulaX: Number(formulaMappedX.toFixed(2)),
                    formulaY: Number(formulaMappedY.toFixed(2)),
                    baselineX: Number(mapped.baselineStart[0].toFixed(2)),
                    baselineY: Number(mapped.baselineStart[1].toFixed(2)),
                    deltaX: Number((mapped.baselineStart[0] - formulaMappedX).toFixed(2)),
                    deltaY: Number((mapped.baselineStart[1] - formulaMappedY).toFixed(2)),
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

            // PDF.js v4.x: Use Official TextLayerBuilder Class
            // TextLayerBuilder in pdfjs-dist/web/pdf_viewer.mjs is the correct export name.
            // It handles font metrics, baseline alignment, and coordinate transformations internally.

            if (window.TextLayerBuilder && window.EventBus) {
                // Create EventBus instance (required by TextLayerBuilder in v4.x)
                const eventBus = new window.EventBus();

                // Official PDF.js TextLayerBuilder - handles all transformations correctly
                const textLayerBuilder = new window.TextLayerBuilder({
                    pdfPage: page,
                    eventBus: eventBus,
                    highlighter: null,
                    accessibilityManager: null,
                    enablePermissions: false
                });

                // Set container and render
                textLayer.appendChild(textLayerBuilder.div);
                await textLayerBuilder.render(viewport);

                console.log('✅ Text layer rendered using official PDF.js TextLayerBuilder');

            } else {
                // Fallback if TextLayerBuilder not loaded
                console.warn('⚠️ TextLayerBuilder or EventBus not available');
                console.warn('Available:', {
                    TextLayerBuilder: !!window.TextLayerBuilder,
                    EventBus: !!window.EventBus
                });
            }

        } catch (error) {
            console.error('❌ Error rendering text layer:', error);
            console.error('Error details:', error.message);
            console.error('Stack:', error.stack);
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
