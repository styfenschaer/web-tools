document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const tabMerge = document.getElementById('tab-merge');
    const tabSplit = document.getElementById('tab-split');
    const appDescription = document.getElementById('app-description');
    
    const dropZone = document.getElementById('drop-zone');
    const dropTitle = document.getElementById('drop-title');
    const dropSubtitle = document.getElementById('drop-subtitle');
    
    const fileInput = document.getElementById('file-input');
    
    // Merge Mode elements
    const listSection = document.getElementById('list-section');
    const fileList = document.getElementById('file-list');
    const fileCount = document.getElementById('file-count');
    const clearAllBtn = document.getElementById('clear-all-btn');
    const nameSection = document.getElementById('name-section');
    const filenameInput = document.getElementById('output-filename');
    const actionSection = document.getElementById('action-section');
    const combineBtn = document.getElementById('combine-btn');
    const loader = document.getElementById('loader');
    const btnText = combineBtn.querySelector('.btn-text');

    // Split Mode elements
    const splitSection = document.getElementById('split-section');
    const splitActionSection = document.getElementById('split-action-section');
    const splitBtn = document.getElementById('split-btn');
    const splitLoader = document.getElementById('split-loader');
    const splitBtnText = splitBtn.querySelector('.btn-text');
    const removeSplitBtn = document.getElementById('remove-split-btn');

    // State Variables
    let activeTab = 'merge'; // 'merge' or 'split'
    let filesArray = [];     // Hold files for merge mode
    let splitFile = null;    // Hold file for split mode
    let isFilenameEdited = false;

    // Initialize Event Listeners
    setupTabs();
    setupDragAndDrop();
    setupFileInput();
    setupControlButtons();
    setupNamingInput();

    // 1. Tab Navigation Management
    function setupTabs() {
        tabMerge.addEventListener('click', () => switchTab('merge'));
        tabSplit.addEventListener('click', () => switchTab('split'));
    }

    function switchTab(tab) {
        if (activeTab === tab) return;
        activeTab = tab;

        // Toggle active states
        if (tab === 'merge') {
            tabMerge.classList.add('active');
            tabSplit.classList.remove('active');
            
            appDescription.textContent = 'Combine multiple PDFs into a single document securely. 100% private, files never leave your browser.';
            
            dropTitle.textContent = 'Drag & Drop PDF files here';
            dropSubtitle.textContent = 'or click to select files from your computer';
            
            // Render merge layout
            dropZone.style.display = 'block';
            renderList();
            
            // Hide split elements
            splitSection.style.display = 'none';
            splitActionSection.style.display = 'none';
        } else {
            tabMerge.classList.remove('active');
            tabSplit.classList.add('active');
            
            appDescription.textContent = 'Split a PDF document into individual pages securely. 100% private, files never leave your browser.';
            
            dropTitle.textContent = 'Drag & Drop a PDF file here';
            dropSubtitle.textContent = 'or click to select a file from your computer';
            
            // Hide merge elements
            listSection.style.display = 'none';
            nameSection.style.display = 'none';
            actionSection.style.display = 'none';
            
            // Render split layout
            renderSplitView();
        }
    }

    // 2. Drag & Drop Event Handlers
    function setupDragAndDrop() {
        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.add('dragover');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.remove('dragover');
            }, false);
        });

        dropZone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            handleFiles(files);
        }, false);

        dropZone.addEventListener('click', () => {
            fileInput.click();
        });
    }

    // 3. File Input Handler
    function setupFileInput() {
        fileInput.addEventListener('change', (e) => {
            handleFiles(e.target.files);
            fileInput.value = ''; // Allow selecting same files repeatedly
        });
    }

    // 4. File Processing Router
    function handleFiles(files) {
        if (files.length === 0) return;
        
        const newFiles = Array.from(files).filter(file => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));

        if (newFiles.length === 0) {
            alert('Please select valid PDF files.');
            return;
        }

        if (activeTab === 'merge') {
            const isFirstLoad = filesArray.length === 0;
            
            newFiles.forEach(file => {
                filesArray.push({
                    id: Date.now() + Math.random().toString(36).substr(2, 9),
                    file: file,
                    name: file.name,
                    size: file.size
                });
            });
            
            // Autofill filename input using first file if not custom-edited
            if (isFirstLoad && filesArray.length > 0 && !isFilenameEdited) {
                const defaultName = filesArray[0].name.replace(/\.pdf$/i, '') + '_merged';
                filenameInput.value = defaultName;
            }
            
            renderList();
        } else {
            // Split mode: process only the first file
            loadSplitFile(newFiles[0]);
        }
    }

    // 5. Render Merge List
    function renderList() {
        fileList.innerHTML = '';
        fileCount.textContent = filesArray.length;

        if (filesArray.length === 0) {
            listSection.style.display = 'none';
            nameSection.style.display = 'none';
            actionSection.style.display = 'none';
            return;
        }

        listSection.style.display = 'block';
        nameSection.style.display = 'block';
        actionSection.style.display = 'flex';

        filesArray.forEach((fileObj, index) => {
            const li = document.createElement('li');
            li.className = 'file-item';
            
            const sizeKB = (fileObj.size / 1024).toFixed(1);
            const sizeStr = sizeKB > 1000 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${sizeKB} KB`;

            li.innerHTML = `
                <span class="file-index">${index + 1}</span>
                <span class="file-name" title="${escapeHtml(fileObj.name)}">${escapeHtml(fileObj.name)}</span>
                <span class="file-size">${sizeStr}</span>
                <div class="item-actions">
                    <button class="btn-icon btn-up" title="Move Up" ${index === 0 ? 'disabled' : ''}>
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="18 15 12 9 6 15"></polyline>
                        </svg>
                    </button>
                    <button class="btn-icon btn-down" title="Move Down" ${index === filesArray.length - 1 ? 'disabled' : ''}>
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

            // Action click bindings
            li.querySelector('.btn-up').addEventListener('click', () => moveUp(index));
            li.querySelector('.btn-down').addEventListener('click', () => moveDown(index));
            li.querySelector('.btn-delete').addEventListener('click', () => removeFile(fileObj.id));

            fileList.appendChild(li);
        });
    }

    // 6. Naming Input Focus / Edit Checks
    function setupNamingInput() {
        filenameInput.addEventListener('input', () => {
            isFilenameEdited = true;
        });
    }

    // 7. Actions: Shuffling & Removal
    function moveUp(index) {
        if (index > 0) {
            const temp = filesArray[index];
            filesArray[index] = filesArray[index - 1];
            filesArray[index - 1] = temp;
            
            // Re-sync naming index if it wasn't edited
            if (!isFilenameEdited && filesArray.length > 0) {
                filenameInput.value = filesArray[0].name.replace(/\.pdf$/i, '') + '_merged';
            }
            
            renderList();
        }
    }

    function moveDown(index) {
        if (index < filesArray.length - 1) {
            const temp = filesArray[index];
            filesArray[index] = filesArray[index + 1];
            filesArray[index + 1] = temp;
            
            // Re-sync naming index if it wasn't edited
            if (!isFilenameEdited && filesArray.length > 0) {
                filenameInput.value = filesArray[0].name.replace(/\.pdf$/i, '') + '_merged';
            }
            
            renderList();
        }
    }

    function removeFile(id) {
        filesArray = filesArray.filter(fileObj => fileObj.id !== id);
        
        // Reset or re-evaluate naming triggers on removal
        if (filesArray.length === 0) {
            isFilenameEdited = false;
            filenameInput.value = '';
        } else if (!isFilenameEdited) {
            filenameInput.value = filesArray[0].name.replace(/\.pdf$/i, '') + '_merged';
        }
        
        renderList();
    }

    function setupControlButtons() {
        clearAllBtn.addEventListener('click', () => {
            filesArray = [];
            isFilenameEdited = false;
            filenameInput.value = '';
            renderList();
        });

        combineBtn.addEventListener('click', combinePDFs);
        splitBtn.addEventListener('click', splitPDF);
        removeSplitBtn.addEventListener('click', clearSplitFile);
    }

    // 8. Split File Parsing & Rendering
    async function loadSplitFile(file) {
        if (typeof PDFLib === 'undefined') {
            alert('The PDF engine is currently loading. Please try again in a few seconds.');
            return;
        }

        try {
            const fileBytes = await file.arrayBuffer();
            const pdfDoc = await PDFLib.PDFDocument.load(fileBytes);
            const pageCount = pdfDoc.getPageCount();

            splitFile = {
                file: file,
                name: file.name,
                size: file.size,
                pages: pageCount
            };

            renderSplitView();
        } catch (error) {
            console.error('Error reading PDF pages:', error);
            alert(`Failed to analyze PDF file:\n${error.message}`);
        }
    }

    function renderSplitView() {
        if (!splitFile) {
            dropZone.style.display = 'block';
            splitSection.style.display = 'none';
            splitActionSection.style.display = 'none';
            return;
        }

        dropZone.style.display = 'none';
        splitSection.style.display = 'block';
        splitActionSection.style.display = 'flex';

        document.getElementById('split-file-name').textContent = splitFile.name;

        const sizeKB = (splitFile.size / 1024).toFixed(1);
        const sizeStr = sizeKB > 1000 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${sizeKB} KB`;
        const pageLabel = splitFile.pages === 1 ? 'page' : 'pages';

        document.getElementById('split-file-details').textContent = `${sizeStr} • ${splitFile.pages} ${pageLabel}`;
    }

    function clearSplitFile() {
        splitFile = null;
        renderSplitView();
    }

    // 9. PDF Combination Logic (Merge Mode)
    async function combinePDFs() {
        if (filesArray.length === 0) return;

        if (typeof PDFLib === 'undefined') {
            alert('PDF library is loading. Try again in a moment.');
            return;
        }

        combineBtn.disabled = true;
        loader.style.display = 'block';
        btnText.style.display = 'none';

        try {
            const { PDFDocument } = PDFLib;
            const mergedPdf = await PDFDocument.create();

            for (const fileObj of filesArray) {
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

            // Set final output filename
            let outputName = filenameInput.value.trim();
            if (!outputName) {
                outputName = 'Merged_Document';
            }
            if (!outputName.toLowerCase().endsWith('.pdf')) {
                outputName += '.pdf';
            }

            // Download Trigger
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

    // 10. PDF Splitting Logic (Split Mode)
    async function splitPDF() {
        if (!splitFile) return;

        if (typeof JSZip === 'undefined') {
            alert('ZIP compilation engine is loading. Try again in a moment.');
            return;
        }

        splitBtn.disabled = true;
        splitLoader.style.display = 'block';
        splitBtnText.style.display = 'none';

        try {
            const { PDFDocument } = PDFLib;
            const originalPdfBytes = await splitFile.file.arrayBuffer();
            const originalPdf = await PDFDocument.load(originalPdfBytes);
            const pageCount = originalPdf.getPageCount();

            const zip = new JSZip();
            const originalNameClean = splitFile.name.replace(/\.pdf$/i, '');

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

    // Helper: Escape HTML entity symbols
    function escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
});
