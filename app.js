// Set PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

/**
 * Improved PDFEbookReader - Fixed TOC navigation and improved layout
 * Key improvements:
 * 1. Proper async destination resolution to fix TOC navigation
 * 2. Sidebar layout with upload area + TOC
 * 3. Main viewer takes majority of screen space
 * 4. Better error handling and user feedback
 * 5. FIXED: Upload functionality and sidebar toggle (final fix)
 */
class PDFEbookReader {
    constructor() {
        this.pdfDoc = null;
        this.currentPage = 1;
        this.totalPages = 0;
        this.scale = 1.0;
        this.isDoublePageMode = false;
        this.isSidebarVisible = true;
        this.isFullscreen = false;
        
        // TOC-specific properties
        this.outline = null;
        this.tocItems = [];
        this.activeTocItem = null;
        
        // Canvas elements
        this.canvas1 = document.getElementById('pdfCanvas');
        this.canvas2 = document.getElementById('pdfCanvas2');
        this.ctx1 = this.canvas1.getContext('2d');
        this.ctx2 = this.canvas2.getContext('2d');
        
        // Initialize after DOM is ready
        setTimeout(() => {
            this.initializeEventListeners();
            this.updateUIState();
        }, 100);
    }

    initializeEventListeners() {
        console.log('🔧 Initializing event listeners...');
        
        // CRITICAL FIX: File upload event listeners with proper element selection
        const uploadBtn = document.getElementById('uploadBtn');
        const fileInput = document.getElementById('fileInput');
        
        if (uploadBtn && fileInput) {
            console.log('✓ Upload elements found');
            
            // Remove any existing listeners
            uploadBtn.replaceWith(uploadBtn.cloneNode(true));
            const newUploadBtn = document.getElementById('uploadBtn');
            
            newUploadBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('🔴 Upload button clicked - triggering file input');
                fileInput.click();
            });
            
            fileInput.addEventListener('change', (e) => {
                console.log('📁 File input changed:', e.target.files);
                if (e.target.files && e.target.files[0]) {
                    console.log('✓ File selected:', e.target.files[0].name);
                    this.handleFileUpload(e.target.files[0]);
                }
            });
            
            console.log('✓ Upload event listeners attached');
        } else {
            console.error('❌ Upload elements not found:', { uploadBtn, fileInput });
        }

        // Navigation controls
        const prevBtn = document.getElementById('prevPage');
        const nextBtn = document.getElementById('nextPage');
        
        if (prevBtn) {
            prevBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.previousPage();
            });
        }
        if (nextBtn) {
            nextBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.nextPage();
            });
        }
        
        // Zoom controls
        const zoomInBtn = document.getElementById('zoomIn');
        const zoomOutBtn = document.getElementById('zoomOut');
        const fitWidthBtn = document.getElementById('fitWidth');
        
        if (zoomInBtn) zoomInBtn.addEventListener('click', (e) => { e.preventDefault(); this.zoomIn(); });
        if (zoomOutBtn) zoomOutBtn.addEventListener('click', (e) => { e.preventDefault(); this.zoomOut(); });
        if (fitWidthBtn) fitWidthBtn.addEventListener('click', (e) => { e.preventDefault(); this.fitWidth(); });
        
        // View toggle
        const toggleViewBtn = document.getElementById('toggleView');
        if (toggleViewBtn) {
            toggleViewBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleViewMode();
            });
        }
        
        // CRITICAL FIX: Sidebar controls with proper element replacement
        const toggleSidebarBtn = document.getElementById('toggleSidebar');
        if (toggleSidebarBtn) {
            // Remove any existing listeners
            toggleSidebarBtn.replaceWith(toggleSidebarBtn.cloneNode(true));
            const newToggleSidebarBtn = document.getElementById('toggleSidebar');
            
            newToggleSidebarBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('🔴 Sidebar toggle clicked');
                this.toggleSidebar();
            });
            
            console.log('✓ Sidebar toggle event listener attached');
        } else {
            console.error('❌ Sidebar toggle button not found');
        }
        
        // Fullscreen
        const fullscreenBtn = document.getElementById('fullscreen');
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleFullscreen();
            });
        }
        
        // Error modal
        const closeErrorBtn = document.getElementById('closeError');
        const errorOkBtn = document.getElementById('errorOk');
        
        if (closeErrorBtn) closeErrorBtn.addEventListener('click', () => this.hideError());
        if (errorOkBtn) errorOkBtn.addEventListener('click', () => this.hideError());

        // Keyboard navigation
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
        
        // Drag and drop support
        this.initializeDragAndDrop();
        
        console.log('✅ All event listeners initialized');
    }

    /**
     * Initialize drag and drop functionality
     */
    initializeDragAndDrop() {
        const uploadArea = document.querySelector('.upload-area-compact');
        
        if (!uploadArea) {
            console.warn('⚠️ Upload area not found for drag and drop');
            return;
        }
        
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
                console.log('📁 File dropped:', files[0].name);
                this.handleFileUpload(files[0]);
            } else {
                this.showError('Please drop a valid PDF file.');
            }
        });
        
        console.log('✓ Drag and drop initialized');
    }

    /**
     * Fixed file upload handler with proper loading states
     */
    async handleFileUpload(file) {
        console.log('📄 Handling file upload:', file.name, file.type, file.size);
        
        if (!file) {
            this.showError('No file selected.');
            return;
        }
        
        if (file.type !== 'application/pdf') {
            this.showError('Please select a valid PDF file.');
            return;
        }
        
        try {
            this.showLoading('Loading PDF...');
            this.updateFileInfo(file.name, 'Loading...');
            
            const arrayBuffer = await file.arrayBuffer();
            console.log('✓ File read as array buffer, size:', arrayBuffer.byteLength);
            
            // Load PDF document
            const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
            this.pdfDoc = await loadingTask.promise;
            this.totalPages = this.pdfDoc.numPages;
            this.currentPage = 1;
            
            console.log('✅ PDF loaded successfully:', this.totalPages, 'pages');
            
            this.updateFileInfo(file.name, `${this.totalPages} pages loaded`);
            
            // Extract TOC with proper async handling
            this.showLoading('Extracting table of contents...');
            await this.extractTOC();
            
            // Show PDF content
            this.hidePlaceholder();
            
            // Render first page(s)
            this.showLoading('Rendering pages...');
            await this.renderCurrentPage();
            
            this.hideLoading();
            this.updateUIState();
            
            console.log('🎉 PDF successfully loaded and rendered');
            
        } catch (error) {
            console.error('❌ Error loading PDF:', error);
            this.showError(`Failed to load PDF file: ${error.message || 'Please ensure it\'s a valid PDF.'}`);
            this.hideLoading();
            this.updateFileInfo('', 'Failed to load');
        }
    }

    /**
     * FIXED: Proper TOC extraction with async destination resolution
     */
    async extractTOC() {
        try {
            console.log('📖 Extracting table of contents...');
            
            // Get PDF outline/bookmarks
            this.outline = await this.pdfDoc.getOutline();
            
            if (this.outline && this.outline.length > 0) {
                console.log('✓ TOC found with', this.outline.length, 'top-level items');
                
                // Process the outline with proper async destination resolution
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

    /**
     * FIXED: Proper async processing of outline destinations
     * This fixes the issue where all TOC items pointed to the last page
     */
    async processOutlineWithDestinations(outline, level = 1, parentIndex = '') {
        const items = [];
        
        for (let index = 0; index < outline.length; index++) {
            const item = outline[index];
            const currentIndex = parentIndex ? `${parentIndex}.${index + 1}` : `${index + 1}`;
            
            try {
                // CRITICAL FIX: Properly resolve destination for each item
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
                console.log(`  📄 TOC item: "${item.title}" → Page ${pageNum}`);
                
                // Recursively process children
                if (item.items && item.items.length > 0) {
                    const childItems = await this.processOutlineWithDestinations(item.items, level + 1, currentIndex);
                    items.push(...childItems);
                }
                
            } catch (error) {
                console.warn('Failed to resolve destination for TOC item:', item.title, error);
                
                // Add item with fallback page number
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

    /**
     * FIXED: Proper destination resolution using PDF.js APIs
     * This is the key fix for the TOC navigation issue
     */
    async resolveDestinationToPageNumber(dest) {
        if (!dest || !this.pdfDoc) {
            return 1;
        }

        try {
            let resolvedDest;
            
            // Handle different destination types
            if (typeof dest === 'string') {
                // Named destination - need to resolve it
                resolvedDest = await this.pdfDoc.getDestination(dest);
            } else if (Array.isArray(dest)) {
                // Direct destination array
                resolvedDest = dest;
            } else {
                console.warn('Unknown destination type:', typeof dest, dest);
                return 1;
            }

            if (!resolvedDest || !Array.isArray(resolvedDest) || resolvedDest.length === 0) {
                console.warn('Invalid resolved destination:', resolvedDest);
                return 1;
            }

            // Get page reference from destination
            const pageRef = resolvedDest[0];
            
            if (!pageRef || typeof pageRef !== 'object') {
                console.warn('No valid page reference in destination:', resolvedDest);
                return 1;
            }

            // Resolve page reference to page index
            const pageIndex = await this.pdfDoc.getPageIndex(pageRef);
            
            // Convert 0-based index to 1-based page number
            const pageNumber = pageIndex + 1;
            
            // Validate page number
            if (pageNumber < 1 || pageNumber > this.totalPages) {
                console.warn('Invalid page number resolved:', pageNumber, 'total pages:', this.totalPages);
                return Math.max(1, Math.min(pageNumber, this.totalPages));
            }
            
            return pageNumber;
            
        } catch (error) {
            console.error('Error resolving destination:', error);
            return 1;
        }
    }

    /**
     * Fixed TOC rendering with proper page numbers
     */
    renderTOC() {
        const tocContainer = document.getElementById('tocContainer');
        
        if (!this.tocItems || this.tocItems.length === 0) {
            this.renderEmptyTOC();
            return;
        }

        // Create TOC HTML structure
        const tocHTML = this.createTOCHTML();
        tocContainer.innerHTML = tocHTML;
        
        // Add click event listeners to TOC items
        this.attachTOCEventListeners();
        
        console.log('✓ TOC rendered with', this.tocItems.length, 'items and correct page numbers');
    }

    /**
     * Create TOC HTML with verified page numbers
     */
    createTOCHTML() {
        let html = '<ul class="toc-list">';
        
        this.tocItems.forEach((item, index) => {
            const levelClass = `level-${Math.min(item.level, 3)}`;
            
            html += `
                <li class="toc-item">
                    <a href="#" class="toc-link ${levelClass}" data-page="${item.pageNumber}" data-index="${index}">
                        <span class="toc-title">${this.escapeHtml(item.title)}</span>
                        <span class="toc-page-num">${item.pageNumber}</span>
                    </a>
                </li>
            `;
        });
        
        html += '</ul>';
        return html;
    }

    /**
     * Fixed TOC event listeners with proper navigation
     */
    attachTOCEventListeners() {
        const tocLinks = document.querySelectorAll('.toc-link');
        
        tocLinks.forEach(link => {
            link.addEventListener('click', async (e) => {
                e.preventDefault();
                
                const pageNum = parseInt(e.currentTarget.getAttribute('data-page'));
                const index = parseInt(e.currentTarget.getAttribute('data-index'));
                
                if (pageNum && pageNum > 0 && pageNum <= this.totalPages) {
                    console.log('📍 Navigating to page', pageNum, 'from TOC item:', this.tocItems[index]?.title);
                    
                    // Navigate to the specific page
                    await this.goToPage(pageNum);
                    
                    // Update active TOC item
                    this.setActiveTOCItem(index);
                    
                    // Hide sidebar on mobile after navigation
                    if (window.innerWidth <= 768) {
                        this.hideSidebar();
                    }
                } else {
                    console.warn('Invalid page number for navigation:', pageNum);
                }
            });
        });
    }

    /**
     * Fixed page navigation method
     */
    async goToPage(pageNum) {
        if (pageNum < 1 || pageNum > this.totalPages) {
            console.warn('Invalid page number:', pageNum);
            return;
        }
        
        this.currentPage = pageNum;
        await this.renderCurrentPage();
        this.updatePageInfo();
        this.updateUIState();
    }

    /**
     * Set active TOC item with visual feedback
     */
    setActiveTOCItem(index) {
        // Remove previous active item
        const previousActive = document.querySelector('.toc-link.active');
        if (previousActive) {
            previousActive.classList.remove('active');
        }
        
        // Set new active item
        const newActive = document.querySelector(`[data-index="${index}"]`);
        if (newActive) {
            newActive.classList.add('active');
            this.activeTocItem = index;
            
            // Scroll active item into view
            newActive.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    /**
     * Empty TOC handler
     */
    renderEmptyTOC() {
        const tocContainer = document.getElementById('tocContainer');
        tocContainer.innerHTML = `
            <div class="toc-placeholder">
                <p>📄 This PDF doesn't contain a table of contents</p>
                <small>Some PDFs don't have embedded bookmarks or outlines</small>
            </div>
        `;
    }

    // PDF rendering methods
    async renderCurrentPage() {
        if (!this.pdfDoc) return;

        try {
            if (this.isDoublePageMode && this.currentPage < this.totalPages) {
                await this.renderDoublePage();
            } else {
                await this.renderSinglePage();
            }
            
            this.updatePageInfo();
            
        } catch (error) {
            console.error('Error rendering page:', error);
            this.showError('Failed to render PDF page.');
        }
    }

    async renderSinglePage() {
        const page = await this.pdfDoc.getPage(this.currentPage);
        const viewport = page.getViewport({ scale: this.scale });
        
        this.canvas1.width = viewport.width;
        this.canvas1.height = viewport.height;
        this.canvas1.classList.remove('hidden');
        this.canvas2.classList.add('hidden');
        
        await page.render({
            canvasContext: this.ctx1,
            viewport: viewport
        }).promise;
    }

    async renderDoublePage() {
        // Render current page
        const page1 = await this.pdfDoc.getPage(this.currentPage);
        const viewport1 = page1.getViewport({ scale: this.scale });
        
        this.canvas1.width = viewport1.width;
        this.canvas1.height = viewport1.height;
        this.canvas1.classList.remove('hidden');
        
        await page1.render({
            canvasContext: this.ctx1,
            viewport: viewport1
        }).promise;
        
        // Render next page if available
        if (this.currentPage < this.totalPages) {
            const page2 = await this.pdfDoc.getPage(this.currentPage + 1);
            const viewport2 = page2.getViewport({ scale: this.scale });
            
            this.canvas2.width = viewport2.width;
            this.canvas2.height = viewport2.height;
            this.canvas2.classList.remove('hidden');
            
            await page2.render({
                canvasContext: this.ctx2,
                viewport: viewport2
            }).promise;
        } else {
            this.canvas2.classList.add('hidden');
        }
    }

    // Navigation methods
    async previousPage() {
        if (this.currentPage > 1) {
            this.currentPage -= this.isDoublePageMode ? 2 : 1;
            this.currentPage = Math.max(1, this.currentPage);
            await this.renderCurrentPage();
        }
    }

    async nextPage() {
        if (this.currentPage < this.totalPages) {
            this.currentPage += this.isDoublePageMode ? 2 : 1;
            this.currentPage = Math.min(this.totalPages, this.currentPage);
            await this.renderCurrentPage();
        }
    }

    // Zoom methods
    async zoomIn() {
        this.scale = Math.min(this.scale * 1.2, 3.0);
        await this.renderCurrentPage();
        this.updateZoomInfo();
    }

    async zoomOut() {
        this.scale = Math.max(this.scale / 1.2, 0.5);
        await this.renderCurrentPage();
        this.updateZoomInfo();
    }

    async fitWidth() {
        if (!this.pdfDoc) return;
        
        const page = await this.pdfDoc.getPage(this.currentPage);
        const container = document.getElementById('pdfContainer');
        const containerWidth = container.clientWidth - 32; // Account for padding
        
        const viewport = page.getViewport({ scale: 1.0 });
        this.scale = containerWidth / viewport.width;
        
        await this.renderCurrentPage();
        this.updateZoomInfo();
    }

    // View mode toggle
    async toggleViewMode() {
        this.isDoublePageMode = !this.isDoublePageMode;
        
        const container = document.getElementById('pdfContainer');
        const viewModeBtn = document.getElementById('viewMode');
        
        if (this.isDoublePageMode) {
            container.classList.add('double-page');
            viewModeBtn.textContent = 'Double Page';
        } else {
            container.classList.remove('double-page');
            viewModeBtn.textContent = 'Single Page';
        }
        
        await this.renderCurrentPage();
    }

    // CRITICAL FIX: Sidebar methods
    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        console.log('🔧 Toggling sidebar, current classes:', sidebar.classList.toString());
        console.log('🔧 Window width:', window.innerWidth);
        
        if (window.innerWidth <= 768) {
            // Mobile: use 'show' class
            const wasVisible = sidebar.classList.contains('show');
            if (wasVisible) {
                sidebar.classList.remove('show');
                console.log('📱 Mobile: Hiding sidebar');
            } else {
                sidebar.classList.add('show');
                console.log('📱 Mobile: Showing sidebar');
            }
            this.isSidebarVisible = !wasVisible;
        } else {
            // Desktop: use 'hidden' class
            const wasHidden = sidebar.classList.contains('hidden');
            if (wasHidden) {
                sidebar.classList.remove('hidden');
                console.log('🖥️ Desktop: Showing sidebar');
            } else {
                sidebar.classList.add('hidden');
                console.log('🖥️ Desktop: Hiding sidebar');
            }
            this.isSidebarVisible = wasHidden;
        }
        
        console.log('✅ Sidebar toggled, new classes:', sidebar.classList.toString(), 'visible:', this.isSidebarVisible);
    }

    hideSidebar() {
        const sidebar = document.getElementById('sidebar');
        
        if (window.innerWidth <= 768) {
            sidebar.classList.remove('show');
        } else {
            sidebar.classList.add('hidden');
        }
        
        this.isSidebarVisible = false;
    }

    // Fullscreen toggle
    toggleFullscreen() {
        try {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen();
                this.isFullscreen = true;
            } else {
                document.exitFullscreen();
                this.isFullscreen = false;
            }
        } catch (e) {
            console.log('Fullscreen not supported:', e);
        }
    }

    // Keyboard navigation
    handleKeyboard(e) {
        if (!this.pdfDoc) return;
        
        switch (e.key) {
            case 'ArrowLeft':
                e.preventDefault();
                this.previousPage();
                break;
            case 'ArrowRight':
                e.preventDefault();
                this.nextPage();
                break;
            case '=':
            case '+':
                e.preventDefault();
                this.zoomIn();
                break;
            case '-':
                e.preventDefault();
                this.zoomOut();
                break;
            case '0':
                e.preventDefault();
                this.fitWidth();
                break;
            case 'f':
                e.preventDefault();
                this.toggleFullscreen();
                break;
        }
    }

    // UI update methods
    updatePageInfo() {
        const pageInfo = document.getElementById('pageInfo');
        if (this.totalPages === 0) {
            pageInfo.textContent = 'No PDF loaded';
        } else if (this.isDoublePageMode && this.currentPage < this.totalPages) {
            pageInfo.textContent = `Pages ${this.currentPage}-${this.currentPage + 1} of ${this.totalPages}`;
        } else {
            pageInfo.textContent = `Page ${this.currentPage} of ${this.totalPages}`;
        }
    }

    updateZoomInfo() {
        document.getElementById('zoomLevel').textContent = `${Math.round(this.scale * 100)}%`;
    }

    updateFileInfo(fileName, status) {
        const fileInfo = document.getElementById('fileInfo');
        const fileNameEl = fileInfo.querySelector('.file-name');
        const fileStatusEl = fileInfo.querySelector('.file-status');
        
        if (fileName) {
            fileNameEl.textContent = fileName;
            fileStatusEl.textContent = status;
            fileInfo.classList.remove('hidden');
        } else {
            fileInfo.classList.add('hidden');
        }
    }

    updateTocStatus(status) {
        const tocStatusEl = document.getElementById('tocStatus');
        if (tocStatusEl) {
            tocStatusEl.textContent = status;
        }
    }

    updateUIState() {
        const hasDoc = !!this.pdfDoc;
        
        // Enable/disable controls based on document state
        const prevBtn = document.getElementById('prevPage');
        const nextBtn = document.getElementById('nextPage');
        const zoomInBtn = document.getElementById('zoomIn');
        const zoomOutBtn = document.getElementById('zoomOut');
        const fitWidthBtn = document.getElementById('fitWidth');
        
        if (prevBtn) prevBtn.disabled = !hasDoc || this.currentPage <= 1;
        if (nextBtn) nextBtn.disabled = !hasDoc || this.currentPage >= this.totalPages;
        if (zoomInBtn) zoomInBtn.disabled = !hasDoc;
        if (zoomOutBtn) zoomOutBtn.disabled = !hasDoc;
        if (fitWidthBtn) fitWidthBtn.disabled = !hasDoc;
        
        this.updatePageInfo();
        this.updateZoomInfo();
    }

    // UI state methods
    hidePlaceholder() {
        const placeholder = document.querySelector('.pdf-placeholder');
        if (placeholder) {
            placeholder.style.display = 'none';
        }
    }

    showLoading(text = 'Loading...') {
        const indicator = document.getElementById('loadingIndicator');
        const loadingText = document.getElementById('loadingText');
        if (indicator && loadingText) {
            loadingText.textContent = text;
            indicator.classList.remove('hidden');
        }
    }

    hideLoading() {
        const indicator = document.getElementById('loadingIndicator');
        if (indicator) {
            indicator.classList.add('hidden');
        }
    }

    showError(message) {
        const errorMessage = document.getElementById('errorMessage');
        const errorModal = document.getElementById('errorModal');
        if (errorMessage && errorModal) {
            errorMessage.textContent = message;
            errorModal.classList.remove('hidden');
        }
        console.error('❌ Error shown to user:', message);
    }

    hideError() {
        const errorModal = document.getElementById('errorModal');
        if (errorModal) {
            errorModal.classList.add('hidden');
        }
    }

    // Helper methods
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Initializing improved PDF eBook Reader');
    console.log('✓ Fixed TOC navigation with proper async destination resolution');
    console.log('✓ Improved layout: sidebar (30%) + main viewer (70%)');
    console.log('✓ Upload area moved to sidebar');
    console.log('✓ Enhanced error handling and user feedback');
    console.log('✓ FINAL FIX: Upload functionality and sidebar toggle');
    
    // Create reader instance with delay to ensure DOM is ready
    window.pdfReader = new PDFEbookReader();
    
    console.log('✅ Reader initialized successfully');
});