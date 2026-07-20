import { Tool } from '../base/Tool.js';

export class PdfMergeTool extends Tool {
    constructor() {
        super({
            id: 'pdf-merge',
            name: 'Merge PDFs',
            description: 'Combine multiple PDF documents into a single organized file securely in your browser.',
            tags: ['pdf', 'merge', 'combine', 'join'],
            icon: `
                <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="12" y1="18" x2="12" y2="12"></line>
                    <line x1="9" y1="15" x2="15" y2="15"></line>
                </svg>
            `
        });

        this.filesArray = [];
        this.isFilenameEdited = false;
        this.container = null;
    }

    render(container) {
        this.container = container;
        this.filesArray = [];
        this.isFilenameEdited = false;

        this.container.innerHTML = `
            <div class="tool-workspace">
                <header class="workspace-header">
                    <h2>Merge PDFs</h2>
                    <p>Combine multiple PDFs into a single document securely. 100% private, files never leave your browser.</p>
                </header>

                <input type="file" id="file-input-merge" multiple accept=".pdf" style="display: none;">

                <div class="drop-zone" id="drop-zone-merge">
                    <div class="drop-zone-content">
                        <svg class="drop-icon" viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="17 8 12 3 7 8"></polyline>
                            <line x1="12" y1="3" x2="12" y2="15"></line>
                        </svg>
                        <h3>Drag & Drop PDF files here</h3>
                        <p>or click to select files from your computer</p>
                    </div>
                </div>

                <div class="list-section" id="list-section-merge" style="display: none;">
                    <div class="section-header">
                        <h2>Selected Files (<span id="file-count-merge">0</span>)</h2>
                        <button class="btn btn-secondary btn-sm" id="clear-all-merge">Clear All</button>
                    </div>
                    <div class="list-container">
                        <ul class="file-list" id="file-list-merge"></ul>
                    </div>
                </div>

                <div class="name-section" id="name-section-merge" style="display: none;">
                    <label for="output-filename-merge" class="input-label">Output Filename</label>
                    <div class="input-wrapper">
                        <input type="text" id="output-filename-merge" placeholder="Merged_Document">
                        <span class="input-suffix">.pdf</span>
                    </div>
                </div>

                <div class="action-section" id="action-section-merge" style="display: none;">
                    <button class="btn btn-primary" id="combine-btn">
                        <span class="btn-text">Combine PDFs</span>
                        <div class="loader" id="loader-merge" style="display: none;"></div>
                    </button>
                </div>
            </div>
        `;

        this.bindEvents();
    }

    bindEvents() {
        const dropZone = this.container.querySelector('#drop-zone-merge');
        const fileInput = this.container.querySelector('#file-input-merge');
        const clearBtn = this.container.querySelector('#clear-all-merge');
        const combineBtn = this.container.querySelector('#combine-btn');
        const filenameInput = this.container.querySelector('#output-filename-merge');

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
            if (e.dataTransfer && e.dataTransfer.files) {
                this.handleFiles(e.dataTransfer.files);
            }
        });

        dropZone.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', (e) => {
            this.handleFiles(e.target.files);
            fileInput.value = '';
        });

        filenameInput.addEventListener('input', () => {
            this.isFilenameEdited = true;
        });

        clearBtn.addEventListener('click', () => {
            this.filesArray = [];
            this.isFilenameEdited = false;
            filenameInput.value = '';
            this.renderList();
        });

        combineBtn.addEventListener('click', () => this.combinePDFs());
    }

    handleFiles(files) {
        if (!files || files.length === 0) return;

        const pdfFiles = Array.from(files).filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));

        if (pdfFiles.length === 0) {
            alert('Please select valid PDF files.');
            return;
        }

        const isFirstLoad = this.filesArray.length === 0;

        pdfFiles.forEach(file => {
            this.filesArray.push({
                id: Date.now() + Math.random().toString(36).substring(2, 9),
                file: file,
                name: file.name,
                size: file.size
            });
        });

        const filenameInput = this.container.querySelector('#output-filename-merge');
        if (isFirstLoad && this.filesArray.length > 0 && !this.isFilenameEdited && filenameInput) {
            filenameInput.value = this.filesArray[0].name.replace(/\.pdf$/i, '') + '_merged';
        }

        this.renderList();
    }

    renderList() {
        const listSection = this.container.querySelector('#list-section-merge');
        const nameSection = this.container.querySelector('#name-section-merge');
        const actionSection = this.container.querySelector('#action-section-merge');
        const fileList = this.container.querySelector('#file-list-merge');
        const fileCount = this.container.querySelector('#file-count-merge');

        if (!listSection) return;

        fileList.innerHTML = '';
        fileCount.textContent = this.filesArray.length;

        if (this.filesArray.length === 0) {
            listSection.style.display = 'none';
            nameSection.style.display = 'none';
            actionSection.style.display = 'none';
            return;
        }

        listSection.style.display = 'block';
        nameSection.style.display = 'block';
        actionSection.style.display = 'flex';

        this.filesArray.forEach((fileObj, index) => {
            const li = document.createElement('li');
            li.className = 'file-item';

            const sizeKB = (fileObj.size / 1024).toFixed(1);
            const sizeStr = sizeKB > 1000 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${sizeKB} KB`;

            li.innerHTML = `
                <span class="file-index">${index + 1}</span>
                <span class="file-name" title="${this.escapeHtml(fileObj.name)}">${this.escapeHtml(fileObj.name)}</span>
                <span class="file-size">${sizeStr}</span>
                <div class="item-actions">
                    <button class="btn-icon btn-up" title="Move Up" ${index === 0 ? 'disabled' : ''}>
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="18 15 12 9 6 15"></polyline>
                        </svg>
                    </button>
                    <button class="btn-icon btn-down" title="Move Down" ${index === this.filesArray.length - 1 ? 'disabled' : ''}>
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                    </button>
                    <button class="btn-icon btn-delete" title="Remove">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            `;

            li.querySelector('.btn-up').addEventListener('click', () => this.moveUp(index));
            li.querySelector('.btn-down').addEventListener('click', () => this.moveDown(index));
            li.querySelector('.btn-delete').addEventListener('click', () => this.removeFile(fileObj.id));

            fileList.appendChild(li);
        });
    }

    moveUp(index) {
        if (index > 0) {
            const temp = this.filesArray[index];
            this.filesArray[index] = this.filesArray[index - 1];
            this.filesArray[index - 1] = temp;
            this.updateDefaultName();
            this.renderList();
        }
    }

    moveDown(index) {
        if (index < this.filesArray.length - 1) {
            const temp = this.filesArray[index];
            this.filesArray[index] = this.filesArray[index + 1];
            this.filesArray[index + 1] = temp;
            this.updateDefaultName();
            this.renderList();
        }
    }

    removeFile(id) {
        this.filesArray = this.filesArray.filter(f => f.id !== id);
        const filenameInput = this.container.querySelector('#output-filename-merge');
        if (this.filesArray.length === 0) {
            this.isFilenameEdited = false;
            if (filenameInput) filenameInput.value = '';
        } else {
            this.updateDefaultName();
        }
        this.renderList();
    }

    updateDefaultName() {
        const filenameInput = this.container.querySelector('#output-filename-merge');
        if (!this.isFilenameEdited && this.filesArray.length > 0 && filenameInput) {
            filenameInput.value = this.filesArray[0].name.replace(/\.pdf$/i, '') + '_merged';
        }
    }

    async combinePDFs() {
        if (this.filesArray.length === 0) return;

        if (typeof window.PDFLib === 'undefined') {
            alert('PDF library is loading. Try again in a moment.');
            return;
        }

        const combineBtn = this.container.querySelector('#combine-btn');
        const loader = this.container.querySelector('#loader-merge');
        const btnText = combineBtn.querySelector('.btn-text');
        const filenameInput = this.container.querySelector('#output-filename-merge');

        combineBtn.disabled = true;
        loader.style.display = 'block';
        btnText.style.display = 'none';

        try {
            const { PDFDocument } = window.PDFLib;
            const mergedPdf = await PDFDocument.create();

            for (const fileObj of this.filesArray) {
                try {
                    const fileBytes = await fileObj.file.arrayBuffer();
                    const pdfDoc = await PDFDocument.load(fileBytes);
                    const copiedPages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
                    copiedPages.forEach(page => mergedPdf.addPage(page));
                } catch (fileErr) {
                    throw new Error(`Failed to load "${fileObj.name}". It may be encrypted or corrupted.`);
                }
            }

            const mergedPdfBytes = await mergedPdf.save();

            let outputName = filenameInput.value.trim();
            if (!outputName) outputName = 'Merged_Document';
            if (!outputName.toLowerCase().endsWith('.pdf')) outputName += '.pdf';

            const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = outputName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

        } catch (error) {
            console.error('Merge Error:', error);
            alert(`An error occurred while merging PDFs:\n${error.message}`);
        } finally {
            combineBtn.disabled = false;
            loader.style.display = 'none';
            btnText.style.display = 'inline-block';
        }
    }

    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    destroy() {
        this.filesArray = [];
        this.container = null;
    }
}
