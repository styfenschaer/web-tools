import { Tool } from '../base/Tool.js';

export class PdfSplitTool extends Tool {
    constructor() {
        super({
            id: 'pdf-split',
            name: 'Split PDF',
            description: 'Extract individual pages from your PDF file into a zip archive quickly and privately.',
            tags: ['pdf', 'split', 'extract', 'pages', 'zip'],
            icon: `
                <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="12" y1="3" x2="12" y2="21"></line>
                </svg>
            `
        });

        this.splitFile = null;
        this.container = null;
    }

    render(container) {
        this.container = container;
        this.splitFile = null;

        this.container.innerHTML = `
            <div class="tool-workspace">
                <header class="workspace-header">
                    <h2>Split PDF</h2>
                    <p>Split a PDF document into individual pages securely. 100% private, files never leave your browser.</p>
                </header>

                <input type="file" id="file-input-split" accept=".pdf" style="display: none;">

                <div class="drop-zone" id="drop-zone-split">
                    <div class="drop-zone-content">
                        <svg class="drop-icon" viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="17 8 12 3 7 8"></polyline>
                            <line x1="12" y1="3" x2="12" y2="15"></line>
                        </svg>
                        <h3>Drag & Drop a PDF file here</h3>
                        <p>or click to select a file from your computer</p>
                    </div>
                </div>

                <div class="split-section" id="split-section" style="display: none;">
                    <div class="section-header">
                        <h2>File to Split</h2>
                    </div>
                    <div class="split-card">
                        <div class="split-info">
                            <svg class="file-icon" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                            </svg>
                            <div class="split-metadata">
                                <span id="split-file-name" class="split-file-name">filename.pdf</span>
                                <span id="split-file-details" class="split-file-details">0 KB • 0 pages</span>
                            </div>
                            <button class="btn-icon btn-delete" id="remove-split-btn" title="Remove File">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>

                <div class="action-section" id="split-action-section" style="display: none;">
                    <button class="btn btn-primary" id="split-btn">
                        <span class="btn-text">Split PDF</span>
                        <div class="loader" id="split-loader" style="display: none;"></div>
                    </button>
                </div>
            </div>
        `;

        this.bindEvents();
    }

    bindEvents() {
        const dropZone = this.container.querySelector('#drop-zone-split');
        const fileInput = this.container.querySelector('#file-input-split');
        const splitBtn = this.container.querySelector('#split-btn');
        const removeSplitBtn = this.container.querySelector('#remove-split-btn');

        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.add('dragover');
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.remove('dragover');
            });
        });

        dropZone.addEventListener('drop', (e) => {
            if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                this.handleFiles(e.dataTransfer.files);
            }
        });

        dropZone.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', (e) => {
            this.handleFiles(e.target.files);
            fileInput.value = '';
        });

        removeSplitBtn.addEventListener('click', () => this.clearSplitFile());
        splitBtn.addEventListener('click', () => this.splitPDF());
    }

    handleFiles(files) {
        if (!files || files.length === 0) return;

        const pdfFiles = Array.from(files).filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));

        if (pdfFiles.length === 0) {
            alert('Please select a valid PDF file.');
            return;
        }

        this.loadSplitFile(pdfFiles[0]);
    }

    async loadSplitFile(file) {
        if (typeof window.PDFLib === 'undefined') {
            alert('The PDF engine is currently loading. Please try again in a few seconds.');
            return;
        }

        try {
            const fileBytes = await file.arrayBuffer();
            const pdfDoc = await window.PDFLib.PDFDocument.load(fileBytes);
            const pageCount = pdfDoc.getPageCount();

            this.splitFile = {
                file: file,
                name: file.name,
                size: file.size,
                pages: pageCount
            };

            this.renderSplitView();
        } catch (error) {
            console.error('Error reading PDF pages:', error);
            alert(`Failed to analyze PDF file:\n${error.message}`);
        }
    }

    renderSplitView() {
        const dropZone = this.container.querySelector('#drop-zone-split');
        const splitSection = this.container.querySelector('#split-section');
        const splitActionSection = this.container.querySelector('#split-action-section');

        if (!this.splitFile) {
            dropZone.style.display = 'block';
            splitSection.style.display = 'none';
            splitActionSection.style.display = 'none';
            return;
        }

        dropZone.style.display = 'none';
        splitSection.style.display = 'block';
        splitActionSection.style.display = 'flex';

        this.container.querySelector('#split-file-name').textContent = this.splitFile.name;

        const sizeKB = (this.splitFile.size / 1024).toFixed(1);
        const sizeStr = sizeKB > 1000 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${sizeKB} KB`;
        const pageLabel = this.splitFile.pages === 1 ? 'page' : 'pages';

        this.container.querySelector('#split-file-details').textContent = `${sizeStr} • ${this.splitFile.pages} ${pageLabel}`;
    }

    clearSplitFile() {
        this.splitFile = null;
        this.renderSplitView();
    }

    async splitPDF() {
        if (!this.splitFile) return;

        if (typeof window.JSZip === 'undefined') {
            alert('ZIP compilation engine is loading. Try again in a moment.');
            return;
        }

        const splitBtn = this.container.querySelector('#split-btn');
        const splitLoader = this.container.querySelector('#split-loader');
        const splitBtnText = splitBtn.querySelector('.btn-text');

        splitBtn.disabled = true;
        splitLoader.style.display = 'block';
        splitBtnText.style.display = 'none';

        try {
            const { PDFDocument } = window.PDFLib;
            const originalPdfBytes = await this.splitFile.file.arrayBuffer();
            const originalPdf = await PDFDocument.load(originalPdfBytes);
            const pageCount = originalPdf.getPageCount();

            const zip = new window.JSZip();
            const originalNameClean = this.splitFile.name.replace(/\.pdf$/i, '');

            for (let i = 0; i < pageCount; i++) {
                const singlePagePdf = await PDFDocument.create();
                const [copiedPage] = await singlePagePdf.copyPages(originalPdf, [i]);
                singlePagePdf.addPage(copiedPage);

                const pageBytes = await singlePagePdf.save();
                const pageName = `${originalNameClean}_page_${i + 1}.pdf`;
                zip.file(pageName, pageBytes);
            }

            const zipBlob = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(zipBlob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `${originalNameClean}_split.zip`;
            document.body.appendChild(a);
            a.click();

            document.body.removeChild(a);
            URL.revokeObjectURL(url);

        } catch (error) {
            console.error('Split Error:', error);
            alert(`An error occurred while splitting the PDF:\n${error.message}`);
        } finally {
            splitBtn.disabled = false;
            splitLoader.style.display = 'none';
            splitBtnText.style.display = 'inline-block';
        }
    }

    destroy() {
        this.splitFile = null;
        this.container = null;
    }
}
