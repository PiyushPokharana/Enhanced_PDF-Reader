
class PDFEbookReader {
    constructor() {
        this.pdfDoc = null;
        this.currentPage = 1;
        this.totalPages = 0;
        this.isDoublePageView = true;
        this.scale = 1.5;

        this.initializeElements();
        this.bindEvents();
        this.setupFullscreenEvents();
    }

    initializeElements() {
        this.uploadBtn = document.getElementById('uploadBtn');
        this.pdfUpload = document.getElementById('pdfUpload');
        this.toggleView = document.getElementById('toggleView');
        this.readerContainer = document.getElementById('readerContainer');
        this.prevPageBtn = document.getElementById('prevPage');
        this.nextPageBtn = document.getElementById('nextPage');
        this.pageInfo = document.getElementById('pageInfo');
        this.leftCanvas = document.getElementById('leftCanvas');
        this.rightCanvas = document.getElementById('rightCanvas');
        this.singleCanvas = document.getElementById('singleCanvas');
        this.book = document.getElementById('book');
        this.singlePageView = document.getElementById('singlePageView');
    }

    bindEvents() {
        // Use arrow functions to preserve 'this' context
        this.uploadBtn.addEventListener('click', () => this.pdfUpload.click());
        this.pdfUpload.addEventListener('change', (e) => this.handleFileUpload(e));
        this.toggleView.addEventListener('click', () => this.toggleViewMode());
        this.prevPageBtn.addEventListener('click', () => this.previousPage());
        this.nextPageBtn.addEventListener('click', () => this.nextPage());

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (this.pdfDoc) {
                if (e.key === 'ArrowLeft') this.previousPage();
                if (e.key === 'ArrowRight') this.nextPage();
            }
        });
    }

    setupFullscreenEvents() {
        // Double-click anywhere to toggle fullscreen
        document.addEventListener('dblclick', () => {
            const book = document.getElementById('book');
            const singlePageView = document.getElementById('singlePageView');
            if (document.fullscreenElement) {
                document.exitFullscreen();
                book.classList.remove('fullscreen');
                singlePageView.classList.remove('fullscreen');
            } else {
                if (book.style.display !== 'none') {
                    book.requestFullscreen();
                    book.classList.add('fullscreen');
                } else {
                    singlePageView.requestFullscreen();
                    singlePageView.classList.add('fullscreen');
                }
            }
        });

        // F key toggles fullscreen
        document.addEventListener('keydown', (e) => {
            if (e.key.toLowerCase() === 'f') {
                const book = document.getElementById('book');
                const singlePageView = document.getElementById('singlePageView');
                if (document.fullscreenElement) {
                    document.exitFullscreen();
                    book.classList.remove('fullscreen');
                    singlePageView.classList.remove('fullscreen');
                } else {
                    if (book.style.display !== 'none') {
                        book.requestFullscreen();
                        book.classList.add('fullscreen');
                    } else {
                        singlePageView.requestFullscreen();
                        singlePageView.classList.add('fullscreen');
                    }
                }
            }
        });

        // Remove fullscreen class when exiting fullscreen
        document.addEventListener('fullscreenchange', () => {
            if (!document.fullscreenElement) {
                document.getElementById('book').classList.remove('fullscreen');
                document.getElementById('singlePageView').classList.remove('fullscreen');
            }
        });
    }

    async handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file || file.type !== 'application/pdf') {
            alert('Please select a valid PDF file');
            return;
        }

        try {
            this.uploadBtn.innerHTML = '<span class="loading"></span> Loading...';
            this.uploadBtn.disabled = true;

            const arrayBuffer = await file.arrayBuffer();
            this.pdfDoc = await pdfjsLib.getDocument(arrayBuffer).promise;
            this.totalPages = this.pdfDoc.numPages;
            this.currentPage = 1;

            this.showReader();
            this.renderCurrentPages();

            this.uploadBtn.innerHTML = 'Upload PDF';
            this.uploadBtn.disabled = false;
            this.toggleView.style.display = 'inline-block';

        } catch (error) {
            console.error('Error loading PDF:', error);
            alert('Error loading PDF file');
            this.uploadBtn.innerHTML = 'Upload PDF';
            this.uploadBtn.disabled = false;
        }
    }

    showReader() {
        this.readerContainer.style.display = 'block';
        this.updatePageInfo();
        this.updateNavigationButtons();

        // Set initial button text
        this.toggleView.textContent = 'Switch to Single Page';
    }

    toggleViewMode() {
        this.isDoublePageView = !this.isDoublePageView;

        if (this.isDoublePageView) {
            this.book.style.display = 'flex';
            this.singlePageView.style.display = 'none';
            this.toggleView.textContent = 'Switch to Single Page';
        } else {
            this.book.style.display = 'none';
            this.singlePageView.style.display = 'flex';
            this.toggleView.textContent = 'Switch to Double Page';
        }

        this.renderCurrentPages();
    }

    async renderCurrentPages() {
        if (!this.pdfDoc) return;

        if (this.isDoublePageView) {
            await this.renderDoublePage();
        } else {
            await this.renderSinglePage();
        }

        this.updatePageInfo();
        this.updateNavigationButtons();
    }

    async renderDoublePage() {
        // Clear both canvases first
        this.clearCanvas(this.leftCanvas);
        this.clearCanvas(this.rightCanvas);

        try {
            // Render left page first
            if (this.currentPage <= this.totalPages) {
                await this.renderPage(this.currentPage, this.leftCanvas);
                console.log(`Left page ${this.currentPage} rendered successfully`);
            }

            // Small delay before rendering right page
            await new Promise(resolve => setTimeout(resolve, 100));

            // Then render right page
            if (this.currentPage + 1 <= this.totalPages) {
                await this.renderPage(this.currentPage + 1, this.rightCanvas);
                console.log(`Right page ${this.currentPage + 1} rendered successfully`);
            }

        } catch (error) {
            console.error('Error in double page rendering:', error);
        }
    }

    async renderSinglePage() {
        if (this.currentPage <= this.totalPages) {
            await this.renderPage(this.currentPage, this.singleCanvas);
        }
    }

    async renderPage(pageNum, canvas) {
        try {
            const page = await this.pdfDoc.getPage(pageNum);
            const viewport = page.getViewport({ scale: this.scale });

            canvas.width = viewport.width;
            canvas.height = viewport.height;

            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, viewport.width, viewport.height);

            const renderContext = {
                canvasContext: ctx,
                viewport: viewport
            };

            await page.render(renderContext).promise;
            this.addPageShadow(canvas);

        } catch (error) {
            console.error('Error rendering page:', error);
        }
    }

    addPageShadow(canvas) {
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
        gradient.addColorStop(0, 'rgba(0,0,0,0.1)');
        gradient.addColorStop(0.1, 'rgba(0,0,0,0)');
        gradient.addColorStop(0.9, 'rgba(0,0,0,0)');
        gradient.addColorStop(1, 'rgba(0,0,0,0.1)');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    clearCanvas(canvas) {
        const ctx = canvas.getContext('2d');

        if (canvas.width === 0 || canvas.height === 0) {
            canvas.width = 400;
            canvas.height = 300;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#fefefe';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    previousPage() {
        if (this.isDoublePageView) {
            if (this.currentPage > 1) {
                this.currentPage = Math.max(1, this.currentPage - 2);
                this.addPageTurnAnimation();
                setTimeout(() => this.renderCurrentPages(), 300);
            }
        } else {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.renderCurrentPages();
            }
        }
    }

    nextPage() {
        if (this.isDoublePageView) {
            const newPage = this.currentPage + 2;
            if (newPage <= this.totalPages) {
                this.currentPage = newPage;
            } else if (this.currentPage < this.totalPages) {
                this.currentPage = this.totalPages;
            }
        } else {
            if (this.currentPage < this.totalPages) {
                this.currentPage++;
            }
        }

        this.addPageTurnAnimation();
        setTimeout(() => this.renderCurrentPages(), 300);
    }

    addPageTurnAnimation() {
        // Add flip animation to book container
        this.book.classList.add('book-flip');
        setTimeout(() => this.book.classList.remove('book-flip'), 600);

        // Play book flipping sound
        if (!this.flipSound) {
            this.flipSound = new Audio('book-flip.mp3'); // Place book-flip.mp3 in your project folder
            this.flipSound.volume = 0.5;
        }
        // Restart sound if already playing
        this.flipSound.currentTime = 0;
        this.flipSound.play();
    }

    updatePageInfo() {
        if (this.isDoublePageView) {
            const endPage = Math.min(this.currentPage + 1, this.totalPages);
            this.pageInfo.textContent = `Pages ${this.currentPage}-${endPage} of ${this.totalPages}`;
        } else {
            this.pageInfo.textContent = `Page ${this.currentPage} of ${this.totalPages}`;
        }
    }

    updateNavigationButtons() {
        this.prevPageBtn.disabled = this.currentPage <= 1;

        if (this.isDoublePageView) {
            this.nextPageBtn.disabled = this.currentPage >= this.totalPages;
        } else {
            this.nextPageBtn.disabled = this.currentPage >= this.totalPages;
        }
    }
}

// Initialize the PDF reader when the page loads
document.addEventListener('DOMContentLoaded', () => {
    // Configure PDF.js worker
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    // Initialize the reader
    new PDFEbookReader();
});
