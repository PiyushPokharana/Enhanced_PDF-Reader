// Set PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

/**
 * Enhanced PDF E-book Reader with AI Integration and Advanced Features
 * Features:
 * 1. Right-side panel with AI agent, highlights, and notes
 * 2. AI agent integration for document analysis
 * 3. Text highlighting and storage
 * 4. Rich text notes editor with Quill
 * 5. Fixed zoom functionality with manual input
 * 6. Quick access icons
 */
class EnhancedPDFReader {
    constructor() {
        // PDF.js properties
        this.pdfDoc = null;
        this.currentPage = 1;
        this.totalPages = 0;
        this.scale = 1.0;
        this.isDoublePageMode = false;
        this.isSidebarVisible = true;
        this.isRightPanelVisible = true;
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

        // New features
        this.highlights = [];
        this.aiApiKey = null;
        this.notesEditor = null;
        this.selectedText = '';
        this.isSelecting = false;

        // Initialize after DOM is ready
        setTimeout(() => {
            this.initializeEventListeners();
            this.initializeRightPanel();
            this.updateUIState();
        }, 100);
    }

    initializeEventListeners() {
        console.log('🔧 Initializing enhanced event listeners...');

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

        // View toggle
        const toggleViewBtn = document.getElementById('toggleView');
        if (toggleViewBtn) {
            toggleViewBtn.addEventListener('click', () => this.toggleViewMode());
        }

        // Sidebar controls
        const toggleSidebarBtn = document.getElementById('toggleSidebar');
        if (toggleSidebarBtn) {
            toggleSidebarBtn.addEventListener('click', () => this.toggleSidebar());
        }

        // Right panel controls
        const toggleRightPanelBtn = document.getElementById('toggleRightPanel');
        if (toggleRightPanelBtn) {
            toggleRightPanelBtn.addEventListener('click', () => this.toggleRightPanel());
        }

        // Fullscreen
        const fullscreenBtn = document.getElementById('fullscreen');
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
        }

        // Quick access icons
        const quickAI = document.getElementById('quickAI');
        const quickHighlights = document.getElementById('quickHighlights');
        const quickNotes = document.getElementById('quickNotes');

        if (quickAI) quickAI.addEventListener('click', () => this.focusAISection());
        if (quickHighlights) quickHighlights.addEventListener('click', () => this.focusHighlightsSection());
        if (quickNotes) quickNotes.addEventListener('click', () => this.focusNotesSection());

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

        console.log('✅ Enhanced event listeners initialized');
    }

    initializeRightPanel() {
        // Initialize Quill editor for notes
        const notesEditor = document.getElementById('notesEditor');
        if (notesEditor) {
            this.notesEditor = new Quill(notesEditor, {
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
        }

        // Load saved notes
        this.loadNotes();
    }

    initializeTextSelection() {
        const textLayer = document.getElementById('textLayer');
        if (textLayer) {
            textLayer.addEventListener('mouseup', (e) => this.handleTextSelection(e));
            textLayer.addEventListener('contextmenu', (e) => this.handleContextMenu(e));
        }

        // Context menu for highlights
        this.initializeHighlightContextMenu();

        // Hide context menu on click outside
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
        console.log('📄 Handling enhanced file upload:', file.name);

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

            console.log('🎉 Enhanced PDF successfully loaded and rendered');
        } catch (error) {
            console.error('❌ Error loading PDF:', error);
            this.showError(`Failed to load PDF file: ${error.message}`);
            this.hideLoading();
            this.updateFileInfo('', 'Failed to load');
        }
    }

    // Enhanced zoom functionality with manual input
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

    // Fixed fit width functionality
    toggleFitWidth() {
        const container = document.querySelector('.pdf-container');
        if (!container || !this.pdfDoc) return;

        if (this.isFitWidthMode) {
            // Switch to fit height mode
            this.isFitWidthMode = false;
            this.fitToHeight();
            document.getElementById('fitWidth').textContent = 'Fit Height';
        } else {
            // Switch to fit width mode
            this.isFitWidthMode = true;
            this.fitToWidth();
            document.getElementById('fitWidth').textContent = 'Fit Width';
        }
    }

    async fitToWidth() {
        if (!this.pdfDoc) return;

        const container = document.querySelector('.pdf-container');
        const containerWidth = container.clientWidth - 32; // Account for padding

        const page = await this.pdfDoc.getPage(this.currentPage);
        const viewport = page.getViewport({ scale: 1.0 });

        this.scale = containerWidth / viewport.width;
        this.renderCurrentPage();
        this.updateZoomDisplay();
    }

    async fitToHeight() {
        if (!this.pdfDoc) return;

        const container = document.querySelector('.pdf-container');
        const containerHeight = container.clientHeight - 32; // Account for padding

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

        // Clear selection
        window.getSelection().removeAllRanges();
        this.selectedText = '';

        console.log('Text highlighted:', highlight);
    }

    removeHighlight() {
        // Implementation for removing specific highlight would go here
        // For now, just clear selection
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

    // AI Agent functionality
    saveApiKey() {
        const apiKeyInput = document.getElementById('apiKeyInput');
        if (!apiKeyInput) return;

        const apiKey = apiKeyInput.value.trim();
        if (!apiKey) {
            this.showError('Please enter a valid OpenAI API key');
            return;
        }

        this.aiApiKey = apiKey;

        // Hide API key setup and show chat interface
        const apiKeySetup = document.getElementById('apiKeySetup');
        const chatInputContainer = document.getElementById('chatInputContainer');

        if (apiKeySetup) apiKeySetup.classList.add('hidden');
        if (chatInputContainer) chatInputContainer.classList.remove('hidden');

        // Save to localStorage (encrypted in real implementation)
        try {
            localStorage.setItem('pdf-reader-api-key', apiKey);
        } catch (error) {
            console.warn('Could not save API key:', error);
        }

        this.addAIMessage('system', '✅ API key saved! You can now ask questions about your documents.');
    }

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
            this.updateAIMessage(loadingId, '❌ Sorry, I encountered an error. Please check your API key and try again.');
        }
    }

    async callOpenAI(message, context) {
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
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    }

    async getDocumentContext() {
        if (!this.pdfDoc) return 'No document loaded.';

        try {
            // Extract text from current page and nearby pages for context
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

    // Notes functionality
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

    // Panel management
    toggleSidebar() {
        const sidebar = document.getElementById('leftSidebar');
        const toggleIcon = document.getElementById('sidebarToggleIcon');

        if (sidebar) {
            this.isSidebarVisible = !this.isSidebarVisible;
            if (this.isSidebarVisible) {
                sidebar.classList.remove('hidden');
                if (toggleIcon) toggleIcon.textContent = '◀';
            } else {
                sidebar.classList.add('hidden');
                if (toggleIcon) toggleIcon.textContent = '▶';
            }
        }
    }

    toggleRightPanel() {
        const rightPanel = document.getElementById('rightPanel');
        const toggleIcon = document.getElementById('rightPanelToggleIcon');

        if (rightPanel) {
            this.isRightPanelVisible = !this.isRightPanelVisible;
            if (this.isRightPanelVisible) {
                rightPanel.classList.remove('hidden');
                if (toggleIcon) toggleIcon.textContent = '▶';
            } else {
                rightPanel.classList.add('hidden');
                if (toggleIcon) toggleIcon.textContent = '◀';
            }
        }
    }

    // Quick access functions
    focusAISection() {
        const aiSection = document.querySelector('.ai-section');
        if (aiSection) {
            aiSection.scrollIntoView({ behavior: 'smooth' });

            // Focus on AI input if available
            const aiInput = document.getElementById('aiInput');
            if (aiInput && !aiInput.closest('.hidden')) {
                setTimeout(() => aiInput.focus(), 300);
            }
        }
    }

    focusHighlightsSection() {
        const highlightsSection = document.querySelector('.highlights-section');
        if (highlightsSection) {
            highlightsSection.scrollIntoView({ behavior: 'smooth' });
        }
    }

    focusNotesSection() {
        const notesSection = document.querySelector('.notes-section');
        if (notesSection) {
            notesSection.scrollIntoView({ behavior: 'smooth' });

            // Focus on notes editor
            if (this.notesEditor) {
                setTimeout(() => this.notesEditor.focus(), 300);
            }
        }
    }

    // Existing methods (preserved and enhanced)
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

    async renderCurrentPage() {
        if (!this.pdfDoc) return;

        try {
            const page = await this.pdfDoc.getPage(this.currentPage);
            const viewport = page.getViewport({ scale: this.scale });

            // Set up canvas
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

            console.log(`📄 Rendered page ${this.currentPage}`);
        } catch (error) {
            console.error('Error rendering page:', error);
        }
    }

    async renderTextLayer(page, viewport) {
        const textLayer = document.getElementById('textLayer');
        if (!textLayer) return;

        try {
            // Clear previous text layer
            textLayer.innerHTML = '';

            // Position text layer
            textLayer.style.left = this.canvas1.offsetLeft + 'px';
            textLayer.style.top = this.canvas1.offsetTop + 'px';
            textLayer.style.height = this.canvas1.offsetHeight + 'px';
            textLayer.style.width = this.canvas1.offsetWidth + 'px';

            // Get text content
            const textContent = await page.getTextContent();

            // Render text layer using PDF.js
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

    // Navigation methods
    previousPage() {
        if (this.currentPage <= 1) return;
        this.currentPage--;
        this.renderCurrentPage();
        this.updateUIState();
    }

    nextPage() {
        if (this.currentPage >= this.totalPages) return;
        this.currentPage++;
        this.renderCurrentPage();
        this.updateUIState();
    }

    goToPage(pageNumber) {
        if (pageNumber < 1 || pageNumber > this.totalPages) return;
        this.currentPage = pageNumber;
        this.renderCurrentPage();
        this.updateUIState();
    }

    toggleViewMode() {
        this.isDoublePageMode = !this.isDoublePageMode;
        const toggleBtn = document.getElementById('toggleView');
        if (toggleBtn) {
            toggleBtn.textContent = this.isDoublePageMode ? 'Single Page' : 'Double Page';
        }
        this.renderCurrentPage();
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
            this.isFullscreen = true;
        } else {
            document.exitFullscreen();
            this.isFullscreen = false;
        }
    }

    // UI State management
    updateUIState() {
        // Update page info
        const pageInfo = document.getElementById('pageInfo');
        if (pageInfo) {
            if (this.totalPages > 0) {
                pageInfo.textContent = `Page ${this.currentPage} of ${this.totalPages}`;
            } else {
                pageInfo.textContent = 'No PDF loaded';
            }
        }

        // Update zoom display
        this.updateZoomDisplay();

        // Update navigation buttons
        const prevBtn = document.getElementById('prevPage');
        const nextBtn = document.getElementById('nextPage');

        if (prevBtn) prevBtn.disabled = this.currentPage <= 1;
        if (nextBtn) nextBtn.disabled = this.currentPage >= this.totalPages;

        // Update TOC active items
        this.updateTOCActiveItem();
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

    // Utility methods
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
        // Simple success notification - could be enhanced with a proper toast system
        console.log('✅', message);
        // You could implement a toast notification system here
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

// Initialize the enhanced reader when the page loads
let reader;

document.addEventListener('DOMContentLoaded', () => {
    reader = new EnhancedPDFReader();

    // Load saved data
    reader.loadHighlights();

    // Check for saved API key
    try {
        const savedKey = localStorage.getItem('pdf-reader-api-key');
        if (savedKey) {
            const apiKeyInput = document.getElementById('apiKeyInput');
            if (apiKeyInput) {
                apiKeyInput.value = savedKey;
                // Auto-save the key
                setTimeout(() => {
                    document.getElementById('saveApiKey')?.click();
                }, 100);
            }
        }
    } catch (error) {
        console.warn('Could not load saved API key:', error);
    }
});