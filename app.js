// Set PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

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

        // TOC properties
        this.outline = null;
        this.tocItems = [];
        this.activeTocItem = null;

        // Canvas elements
        this.canvas1 = document.getElementById('pdfCanvas');
        this.canvas2 = document.getElementById('pdfCanvas2');
        this.ctx1 = this.canvas1?.getContext('2d');
        this.ctx2 = this.canvas2?.getContext('2d');

        // Enhanced features
        this.highlights = [];
        this.aiApiKey = null;
        this.notesEditor = null;
        this.selectedText = '';
        this.currentTab = 'welcome';

        // Fullscreen properties
        this.fullscreenTimer = null;
        this.mouseMoveTimer = null;

        // Initialize after DOM is ready
        setTimeout(() => {
            this.initializeEventListeners();
            this.initializeTabSystem();
            this.initializeFullscreenControls();
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
        if (fitWidthBtn) fitWidthBtn.addEventListener('click', () => this.toggleFitWidth());

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

        // Fullscreen
        const fullscreenBtn = document.getElementById('fullscreen');
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
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
        if (notesEditorElement) {
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
        const viewport = page.getViewport({ scale: this.scale });

        // Hide second canvas
        this.canvas2.classList.add('hidden');

        // Set up first canvas
        this.canvas1.height = viewport.height;
        this.canvas1.width = viewport.width;
        this.canvas1.classList.remove('hidden');

        // Render PDF page
        const renderContext = {
            canvasContext: this.ctx1,
            viewport: viewport
        };

        await page.render(renderContext).promise;

        // Render text layer for selection
        await this.renderTextLayer(page, viewport);
    }

    async renderDoublePages() {
        const container = document.querySelector('.pdf-container');
        if (container) {
            container.classList.add('double-page');
        }

        // Render first page
        const page1 = await this.pdfDoc.getPage(this.currentPage);
        const viewport1 = page1.getViewport({ scale: this.scale });

        this.canvas1.height = viewport1.height;
        this.canvas1.width = viewport1.width;
        this.canvas1.classList.remove('hidden');

        const renderContext1 = {
            canvasContext: this.ctx1,
            viewport: viewport1
        };

        await page1.render(renderContext1).promise;

        // Render second page if available
        if (this.currentPage < this.totalPages) {
            const page2 = await this.pdfDoc.getPage(this.currentPage + 1);
            const viewport2 = page2.getViewport({ scale: this.scale });

            this.canvas2.height = viewport2.height;
            this.canvas2.width = viewport2.width;
            this.canvas2.classList.remove('hidden');

            const renderContext2 = {
                canvasContext: this.ctx2,
                viewport: viewport2
            };

            await page2.render(renderContext2).promise;
        } else {
            this.canvas2.classList.add('hidden');
        }

        // Render text layer for first page
        await this.renderTextLayer(page1, viewport1);
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
    }

    toggleFitWidth() {
        const container = document.querySelector('.pdf-container');
        if (!container || !this.pdfDoc) return;

        if (this.isFitWidthMode) {
            this.isFitWidthMode = false;
            this.fitToHeight();
            document.getElementById('fitWidth').textContent = 'Fit Height';
        } else {
            this.isFitWidthMode = true;
            this.fitToWidth();
            document.getElementById('fitWidth').textContent = 'Fit Width';
        }
    }

    async fitToWidth() {
        if (!this.pdfDoc) return;
        const container = document.querySelector('.pdf-container');
        const containerWidth = container.clientWidth - 32;
        const page = await this.pdfDoc.getPage(this.currentPage);
        const viewport = page.getViewport({ scale: 1.0 });
        this.scale = containerWidth / viewport.width;
        this.renderCurrentPage();
        this.updateZoomDisplay();
    }

    async fitToHeight() {
        if (!this.pdfDoc) return;
        const container = document.querySelector('.pdf-container');
        const containerHeight = container.clientHeight - 32;
        const page = await this.pdfDoc.getPage(this.currentPage);
        const viewport = page.getViewport({ scale: 1.0 });
        this.scale = containerHeight / viewport.height;
        this.renderCurrentPage();
        this.updateZoomDisplay();
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
        if (fitWidthBtn && !this.isFitWidthMode) {
            fitWidthBtn.textContent = 'Fit Width';
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
        const textLayer = document.getElementById('textLayer');
        if (textLayer) {
            textLayer.addEventListener('mouseup', (e) => this.handleTextSelection(e));
            textLayer.addEventListener('contextmenu', (e) => this.handleContextMenu(e));
        }

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
            <div class="highlight-item" data-highlight-id="${highlight.id}" onclick="reader.goToHighlight('${highlight.id}')">
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
        const highlight = this.highlights.find(h => h.id == highlightId);
        if (highlight) {
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
                        <span class="toc-page-num">${item.pageNumber}</span>
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

    async renderTextLayer(page, viewport) {
        const textLayer = document.getElementById('textLayer');
        if (!textLayer) return;

        try {
            textLayer.innerHTML = '';
            textLayer.style.left = this.canvas1.offsetLeft + 'px';
            textLayer.style.top = this.canvas1.offsetTop + 'px';
            textLayer.style.height = this.canvas1.offsetHeight + 'px';
            textLayer.style.width = this.canvas1.offsetWidth + 'px';

            const textContent = await page.getTextContent();

            pdfjsLib.renderTextLayer({
                textContent: textContent,
                container: textLayer,
                viewport: viewport,
                textDivs: []
            });
        } catch (error) {
            console.error('Error rendering text layer:', error);
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
let reader;

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