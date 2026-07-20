import { Tool } from '../base/Tool.js';

export class GpxFitCombinerTool extends Tool {
    constructor() {
        super({
            id: 'gpx-fit-combiner',
            name: 'GPX, FIT & TCX Track Tool',
            description: 'Combine, reorder, trim, and visualize GPS track files (.gpx, .fit, .tcx) with interactive plot controls.',
            tags: ['gpx', 'fit', 'tcx', 'gps', 'garmin', 'strava', 'combine', 'merge', 'trim', 'split', 'tracks'],
            icon: `
                <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon>
                    <line x1="8" y1="2" x2="8" y2="18"></line>
                    <line x1="16" y1="6" x2="16" y2="22"></line>
                </svg>
            `
        });

        this.files = [];                    // List of parsed file objects
        this.boundaryValues = [];            // Timestamps (ms) for N+1 boundary cuts
        this.userModifiedSliders = new Set();
        this.hiddenFileIds = new Set();     // Track hidden files
        this.selectedMetric = 'speed';       // 'speed', 'ele', 'hr', 'cad', 'power'
        this.exportFormat = 'gpx';           // 'gpx' or 'fit'
        this.chart = null;
        this.container = null;

        // Canvas interaction state
        this.hoveredBoundaryIndex = null;
        this.draggingBoundaryIndex = null;
        this.activeSnapInfo = null;
        this.canvasEventsBound = false;
    }

    render(container) {
        this.container = container;
        this.files = [];
        this.boundaryValues = [];
        this.userModifiedSliders = new Set();
        this.hiddenFileIds = new Set();
        this.selectedMetric = 'speed';
        this.exportFormat = 'gpx';

        this.container.innerHTML = `
            <div class="tool-workspace gpx-fit-workspace">
                <header class="workspace-header">
                    <h2>GPX, FIT & TCX Track Combiner & Trimmer</h2>
                    <p>Combine multiple GPX, FIT, and TCX activity files into a single track. Interactively drag cut lines, zoom the plot, and filter tracks.</p>
                </header>

                <input type="file" id="file-input-geo" multiple accept=".gpx,.fit,.tcx" style="display: none;">

                <div class="drop-zone" id="drop-zone-geo">
                    <div class="drop-zone-content">
                        <svg class="drop-icon" viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon>
                            <line x1="8" y1="2" x2="8" y2="18"></line>
                            <line x1="16" y1="6" x2="16" y2="22"></line>
                        </svg>
                        <h3>Drag & Drop .gpx, .fit, or .tcx files here</h3>
                        <p>or click to select track files from your computer</p>
                    </div>
                </div>

                <!-- Combined Workspace Section -->
                <div class="combiner-content" id="combiner-content" style="display: none;">
                    
                    <!-- File Precedence List -->
                    <div class="section-container">
                        <div class="section-header">
                            <h2>Track Files Priority Order (Top = Highest Priority)</h2>
                            <button class="btn btn-secondary btn-sm" id="clear-all-geo">Clear All</button>
                        </div>
                        <ul class="file-list" id="geo-file-list"></ul>
                    </div>

                    <!-- Metric & Chart Settings -->
                    <div class="section-container">
                        <div class="chart-controls-bar">
                            <div class="control-group">
                                <label for="metric-select" class="input-label">Plot Metric:</label>
                                <select id="metric-select" class="select-input">
                                    <option value="speed">Speed (km/h)</option>
                                    <option value="ele">Elevation (m)</option>
                                    <option value="hr">Heart Rate (bpm)</option>
                                    <option value="cad">Cadence (rpm)</option>
                                    <option value="power">Power (watts)</option>
                                </select>
                            </div>
                            <div class="zoom-controls">
                                <button class="btn btn-secondary btn-sm" id="zoom-in-btn" title="Zoom In (+)">Zoom +</button>
                                <button class="btn btn-secondary btn-sm" id="zoom-out-btn" title="Zoom Out (-)">Zoom -</button>
                                <button class="btn btn-secondary btn-sm" id="reset-zoom-btn" title="Reset Zoom">Reset Zoom ↺</button>
                                <button class="btn btn-secondary btn-sm" id="reset-cuts-btn" title="Reset Cut Lines">Reset Cuts</button>
                            </div>
                        </div>

                        <div class="chart-hint-bar">
                            <span class="hint-icon">💡</span>
                            <span><strong>Tip:</strong> Drag vertical cut lines directly on the chart. Lines snap automatically to file start/end times! Click legend items or eye icons to show/hide files. Scroll mouse wheel to zoom.</span>
                        </div>

                        <div class="chart-container">
                            <canvas id="timeline-chart"></canvas>
                        </div>
                    </div>

                    <!-- Cut Readout Summary Card -->
                    <div class="section-container">
                        <div class="section-header">
                            <h2>Active Cut Boundaries</h2>
                        </div>
                        <div class="cuts-summary-wrapper" id="cuts-summary-wrapper">
                            <!-- Dynamic Cut Badges -->
                        </div>
                    </div>

                    <!-- Combined Output Track Summary -->
                    <div class="section-container">
                        <div class="section-header">
                            <h2>Combined Output Track Statistics</h2>
                        </div>
                        <div class="combined-stats-wrapper" id="combined-stats-wrapper">
                            <!-- Dynamic Combined Statistics -->
                        </div>
                    </div>

                    <!-- Save & Export Actions -->
                    <div class="section-container action-card">
                        <div class="export-options">
                            <div class="control-group">
                                <label for="export-format" class="input-label">Export Format:</label>
                                <select id="export-format" class="select-input">
                                    <option value="gpx">GPX Track (.gpx)</option>
                                    <option value="tcx">TCX Activity (.tcx)</option>
                                    <option value="fit">FIT Activity (.fit)</option>
                                </select>
                            </div>
                            <div class="control-group">
                                <label for="output-track-name" class="input-label">Output Filename:</label>
                                <div class="input-wrapper">
                                    <input type="text" id="output-track-name" placeholder="Combined_Track">
                                    <span class="input-suffix" id="export-suffix">.gpx</span>
                                </div>
                            </div>
                        </div>

                        <button class="btn btn-primary btn-large" id="save-result-btn">
                            <span class="btn-text">Save</span>
                            <div class="loader" id="loader-geo" style="display: none;"></div>
                        </button>
                    </div>

                </div>
            </div>
        `;

        this.bindEvents();
    }

    bindEvents() {
        const dropZone = this.container.querySelector('#drop-zone-geo');
        const fileInput = this.container.querySelector('#file-input-geo');
        const clearBtn = this.container.querySelector('#clear-all-geo');
        const metricSelect = this.container.querySelector('#metric-select');
        const formatSelect = this.container.querySelector('#export-format');
        const exportSuffix = this.container.querySelector('#export-suffix');
        const saveBtn = this.container.querySelector('#save-result-btn');

        const zoomInBtn = this.container.querySelector('#zoom-in-btn');
        const zoomOutBtn = this.container.querySelector('#zoom-out-btn');
        const resetZoomBtn = this.container.querySelector('#reset-zoom-btn');
        const resetCutsBtn = this.container.querySelector('#reset-cuts-btn');

        ['dragenter', 'dragover'].forEach(name => {
            dropZone.addEventListener(name, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.add('dragover');
            });
        });

        ['dragleave', 'drop'].forEach(name => {
            dropZone.addEventListener(name, (e) => {
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

        clearBtn.addEventListener('click', () => {
            this.files = [];
            this.boundaryValues = [];
            this.userModifiedSliders = new Set();
            this.hiddenFileIds = new Set();
            this.updateView();
        });

        if (metricSelect) {
            metricSelect.addEventListener('change', (e) => {
                this.selectedMetric = e.target.value;
                this.renderChart();
            });
        }

        if (formatSelect && exportSuffix) {
            formatSelect.addEventListener('change', (e) => {
                this.exportFormat = e.target.value;
                exportSuffix.textContent = `.${this.exportFormat}`;
            });
        }

        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveResult());
        }

        if (zoomInBtn) zoomInBtn.addEventListener('click', () => this.zoomChart(1.3));
        if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => this.zoomChart(0.7));
        if (resetZoomBtn) resetZoomBtn.addEventListener('click', () => this.resetChartZoom());
        if (resetCutsBtn) {
            resetCutsBtn.addEventListener('click', () => {
                this.resetBoundaryValues();
                this.updateView();
            });
        }
    }

    async handleFiles(fileList) {
        if (!fileList || fileList.length === 0) return;

        const filesToProcess = Array.from(fileList).filter(f => {
            const name = f.name.toLowerCase();
            return name.endsWith('.gpx') || name.endsWith('.fit') || name.endsWith('.tcx');
        });

        if (filesToProcess.length === 0) {
            alert('Please select valid .gpx, .fit, or .tcx files.');
            return;
        }

        for (const file of filesToProcess) {
            try {
                const parsedTrack = await this.parseFile(file);
                if (parsedTrack && parsedTrack.trackpoints.length > 0) {
                    this.files.push(parsedTrack);
                } else {
                    alert(`No valid GPS trackpoints found in "${file.name}".`);
                }
            } catch (err) {
                console.error(`Error parsing file ${file.name}:`, err);
                alert(`Failed to parse "${file.name}": ${err.message}`);
            }
        }

        if (this.files.length > 0) {
            this.files.sort((a, b) => a.startTime - b.startTime);
            this.resetBoundaryValues();
            this.updateView();
        }
    }

    // ----------------------------------------------------
    // File Parsers: GPX (XML) & FIT (Binary)
    // ----------------------------------------------------
    async parseFile(file) {
        const name = file.name.toLowerCase();
        if (name.endsWith('.gpx')) {
            const text = await file.text();
            return this.parseGpx(file.name, text, file.size);
        } else if (name.endsWith('.tcx')) {
            const text = await file.text();
            return this.parseTcx(file.name, text, file.size);
        } else {
            const buffer = await file.arrayBuffer();
            return this.parseFit(file.name, buffer, file.size);
        }
    }

    getChildTagText(element, tagName) {
        let nodes = element.getElementsByTagNameNS('*', tagName);
        if (nodes && nodes.length > 0) return nodes[0].textContent;
        let fallback = element.getElementsByTagName(tagName);
        return (fallback && fallback.length > 0) ? fallback[0].textContent : null;
    }

    parseGpx(fileName, xmlText, fileSize) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlText, 'text/xml');

        const parserError = doc.querySelector('parsererror');
        if (parserError) {
            console.error('GPX XML Parse Error:', parserError.textContent);
            throw new Error('Invalid GPX XML format.');
        }

        let trkpts = Array.from(doc.getElementsByTagNameNS('*', 'trkpt'));
        if (trkpts.length === 0) {
            trkpts = Array.from(doc.getElementsByTagName('trkpt'));
        }

        const trackpoints = [];
        const baseTime = Date.now();
        let syntheticPointIndex = 0;

        trkpts.forEach((pt) => {
            const latStr = pt.getAttribute('lat');
            const lonStr = pt.getAttribute('lon');
            if (!latStr || !lonStr) return;
            const lat = parseFloat(latStr);
            const lon = parseFloat(lonStr);
            if (isNaN(lat) || isNaN(lon)) return;

            const eleStr = this.getChildTagText(pt, 'ele');
            const ele = (eleStr !== null && eleStr !== '') ? parseFloat(eleStr) : null;

            const timeStr = this.getChildTagText(pt, 'time');
            let time;
            if (timeStr && timeStr.trim()) {
                time = new Date(timeStr.trim()).getTime();
                if (isNaN(time)) time = baseTime + (syntheticPointIndex * 1000);
            } else {
                time = baseTime + (syntheticPointIndex * 1000);
            }
            syntheticPointIndex++;

            const speedStr = this.getChildTagText(pt, 'speed');
            let speed = (speedStr !== null && speedStr !== '') ? parseFloat(speedStr) * 3.6 : null; // m/s to km/h

            const hrStr = this.getChildTagText(pt, 'hr');
            const hr = (hrStr !== null && hrStr !== '') ? parseInt(hrStr, 10) : null;

            const cadStr = this.getChildTagText(pt, 'cad');
            const cad = (cadStr !== null && cadStr !== '') ? parseInt(cadStr, 10) : null;

            const powerStr = this.getChildTagText(pt, 'power') || this.getChildTagText(pt, 'pwr') || this.getChildTagText(pt, 'watts') || this.getChildTagText(pt, 'Watts');
            const power = (powerStr !== null && powerStr !== '') ? parseFloat(powerStr) : null;

            const tempStr = this.getChildTagText(pt, 'atemp') || this.getChildTagText(pt, 'wtemp');
            const atemp = (tempStr !== null && tempStr !== '') ? parseFloat(tempStr) : null;

            trackpoints.push({ lat, lon, ele, time, speed, hr, cad, power, atemp });
        });

        if (trackpoints.length === 0) return null;

        for (let i = 1; i < trackpoints.length; i++) {
            if (trackpoints[i].speed === null || isNaN(trackpoints[i].speed)) {
                const prev = trackpoints[i - 1];
                const curr = trackpoints[i];
                const dtSec = (curr.time - prev.time) / 1000;
                if (dtSec > 0 && dtSec < 120) {
                    const distKm = this.calculateDistanceKm(prev.lat, prev.lon, curr.lat, curr.lon);
                    curr.speed = (distKm / dtSec) * 3600; // km/h
                } else {
                    curr.speed = 0;
                }
            }
        }
        if (trackpoints.length > 0 && (trackpoints[0].speed === null || isNaN(trackpoints[0].speed))) {
            trackpoints[0].speed = trackpoints[1]?.speed || 0;
        }

        trackpoints.sort((a, b) => a.time - b.time);
        const stats = this.calculateTrackStats(trackpoints);

        return {
            id: Date.now() + Math.random().toString(36).substring(2, 9),
            name: fileName,
            type: 'gpx',
            size: fileSize,
            trackpoints: trackpoints,
            startTime: trackpoints[0].time,
            endTime: trackpoints[trackpoints.length - 1].time,
            stats: stats
        };
    }

    parseFit(fileName, arrayBuffer, fileSize) {
        const view = new DataView(arrayBuffer);
        if (arrayBuffer.byteLength < 14) throw new Error('Invalid FIT file size.');

        const headerSize = view.getUint8(0);
        const dataType = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));

        if (dataType !== '.FIT') {
            throw new Error('Not a valid .FIT file header.');
        }

        const dataSize = view.getUint32(4, true);
        const FIT_EPOCH_MS = Date.UTC(1989, 11, 31, 0, 0, 0);

        const trackpoints = [];
        let offset = headerSize;
        const localDefs = new Map();

        while (offset < headerSize + dataSize && offset < arrayBuffer.byteLength) {
            const recordHeader = view.getUint8(offset);
            offset++;

            const isDefinition = (recordHeader & 0x40) !== 0;
            const localMsgNum = recordHeader & 0x0F;

            if (isDefinition) {
                offset++;
                const architecture = view.getUint8(offset); offset++;
                const isLittleEndian = architecture === 0;
                const globalMsgNum = view.getUint16(offset, isLittleEndian); offset += 2;
                const numFields = view.getUint8(offset); offset++;

                const fields = [];
                for (let i = 0; i < numFields; i++) {
                    const fieldDefNum = view.getUint8(offset); offset++;
                    const size = view.getUint8(offset); offset++;
                    const baseType = view.getUint8(offset); offset++;
                    fields.push({ fieldDefNum, size, baseType });
                }

                localDefs.set(localMsgNum, { globalMsgNum, isLittleEndian, fields });
            } else {
                const def = localDefs.get(localMsgNum);
                if (!def) break;

                let lat = null, lon = null, ele = null, time = null, speed = null, hr = null, cad = null, power = null;

                for (const field of def.fields) {
                    if (offset + field.size > arrayBuffer.byteLength) break;
                    const isLE = def.isLittleEndian;

                    if (def.globalMsgNum === 20) {
                        switch (field.fieldDefNum) {
                            case 253:
                                if (field.size === 4) {
                                    const sec = view.getUint32(offset, isLE);
                                    if (sec !== 0xFFFFFFFF) time = FIT_EPOCH_MS + (sec * 1000);
                                }
                                break;
                            case 0:
                                if (field.size === 4) {
                                    const val = view.getInt32(offset, isLE);
                                    if (val !== 0x7FFFFFFF) lat = val * (180 / 2147483648);
                                }
                                break;
                            case 1:
                                if (field.size === 4) {
                                    const val = view.getInt32(offset, isLE);
                                    if (val !== 0x7FFFFFFF) lon = val * (180 / 2147483648);
                                }
                                break;
                            case 2:
                                if (field.size === 2) {
                                    const val = view.getUint16(offset, isLE);
                                    if (val !== 0xFFFF) ele = (val / 5.0) - 500;
                                }
                                break;
                            case 3:
                                if (field.size === 1) {
                                    const val = view.getUint8(offset);
                                    if (val !== 0xFF) hr = val;
                                }
                                break;
                            case 4:
                                if (field.size === 1) {
                                    const val = view.getUint8(offset);
                                    if (val !== 0xFF) cad = val;
                                }
                                break;
                            case 6:
                                if (field.size === 2) {
                                    const val = view.getUint16(offset, isLE);
                                    if (val !== 0xFFFF) speed = (val / 1000.0) * 3.6; // km/h
                                }
                                break;
                            case 7:
                                if (field.size === 2) {
                                    const val = view.getUint16(offset, isLE);
                                    if (val !== 0xFFFF) power = val;
                                } else if (field.size === 1) {
                                    const val = view.getUint8(offset);
                                    if (val !== 0xFF) power = val;
                                }
                                break;
                        }
                    }

                    offset += field.size;
                }

                if (def.globalMsgNum === 20 && time && lat !== null && lon !== null) {
                    trackpoints.push({ lat, lon, ele, time, speed, hr, cad, power });
                }
            }
        }

        if (trackpoints.length === 0) {
            throw new Error('No GPS record trackpoints found in FIT file.');
        }

        trackpoints.sort((a, b) => a.time - b.time);
        const stats = this.calculateTrackStats(trackpoints);

        return {
            id: Date.now() + Math.random().toString(36).substring(2, 9),
            name: fileName,
            type: 'fit',
            size: fileSize,
            trackpoints: trackpoints,
            startTime: trackpoints[0].time,
            endTime: trackpoints[trackpoints.length - 1].time,
            stats: stats
        };
    }

    parseTcx(fileName, xmlText, fileSize) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlText, 'text/xml');

        const parserError = doc.querySelector('parsererror');
        if (parserError) {
            console.error('TCX XML Parse Error:', parserError.textContent);
            throw new Error('Invalid TCX XML format.');
        }

        let pts = Array.from(doc.getElementsByTagNameNS('*', 'Trackpoint'));
        if (pts.length === 0) {
            pts = Array.from(doc.getElementsByTagName('Trackpoint'));
        }

        const trackpoints = [];
        const baseTime = Date.now();
        let syntheticPointIndex = 0;

        pts.forEach(pt => {
            const latStr = this.getChildTagText(pt, 'LatitudeDegrees');
            const lonStr = this.getChildTagText(pt, 'LongitudeDegrees');
            if (!latStr || !lonStr) return;

            const lat = parseFloat(latStr);
            const lon = parseFloat(lonStr);
            if (isNaN(lat) || isNaN(lon)) return;

            const eleStr = this.getChildTagText(pt, 'AltitudeMeters');
            const ele = (eleStr !== null && eleStr !== '') ? parseFloat(eleStr) : null;

            const timeStr = this.getChildTagText(pt, 'Time');
            let time;
            if (timeStr && timeStr.trim()) {
                time = new Date(timeStr.trim()).getTime();
                if (isNaN(time)) time = baseTime + (syntheticPointIndex * 1000);
            } else {
                time = baseTime + (syntheticPointIndex * 1000);
            }
            syntheticPointIndex++;

            let hr = null;
            const hrNode = pt.getElementsByTagNameNS('*', 'HeartRateBpm')[0] || pt.getElementsByTagName('HeartRateBpm')[0];
            if (hrNode) {
                const hrValStr = this.getChildTagText(hrNode, 'Value');
                if (hrValStr) hr = parseInt(hrValStr, 10);
            }

            const cadStr = this.getChildTagText(pt, 'Cadence');
            const cad = (cadStr !== null && cadStr !== '') ? parseInt(cadStr, 10) : null;

            const powerStr = this.getChildTagText(pt, 'Watts') || this.getChildTagText(pt, 'watts') || this.getChildTagText(pt, 'power') || this.getChildTagText(pt, 'pwr');
            const power = (powerStr !== null && powerStr !== '') ? parseFloat(powerStr) : null;

            const speedStr = this.getChildTagText(pt, 'Speed') || this.getChildTagText(pt, 'speed');
            let speed = (speedStr !== null && speedStr !== '') ? parseFloat(speedStr) * 3.6 : null;

            const tempStr = this.getChildTagText(pt, 'atemp') || this.getChildTagText(pt, 'Temp');
            const atemp = (tempStr !== null && tempStr !== '') ? parseFloat(tempStr) : null;

            trackpoints.push({ lat, lon, ele, time, speed, hr, cad, power, atemp });
        });

        if (trackpoints.length === 0) {
            throw new Error('No GPS record trackpoints found in TCX file.');
        }

        for (let i = 1; i < trackpoints.length; i++) {
            if (trackpoints[i].speed === null || isNaN(trackpoints[i].speed)) {
                const prev = trackpoints[i - 1];
                const curr = trackpoints[i];
                const dtSec = (curr.time - prev.time) / 1000;
                if (dtSec > 0 && dtSec < 120) {
                    const distKm = this.calculateDistanceKm(prev.lat, prev.lon, curr.lat, curr.lon);
                    curr.speed = (distKm / dtSec) * 3600;
                } else {
                    curr.speed = 0;
                }
            }
        }
        if (trackpoints.length > 0 && (trackpoints[0].speed === null || isNaN(trackpoints[0].speed))) {
            trackpoints[0].speed = trackpoints[1]?.speed || 0;
        }

        trackpoints.sort((a, b) => a.time - b.time);
        const stats = this.calculateTrackStats(trackpoints);

        return {
            id: Date.now() + Math.random().toString(36).substring(2, 9),
            name: fileName,
            type: 'tcx',
            size: fileSize,
            trackpoints: trackpoints,
            startTime: trackpoints[0].time,
            endTime: trackpoints[trackpoints.length - 1].time,
            stats: stats
        };
    }

    calculateDistanceKm(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    formatDuration(ms) {
        if (!ms || ms <= 0) return '0s';
        const totalSec = Math.floor(ms / 1000);
        const hrs = Math.floor(totalSec / 3600);
        const mins = Math.floor((totalSec % 3600) / 60);
        const secs = totalSec % 60;

        if (hrs > 0) {
            return `${hrs}h ${mins}m`;
        } else if (mins > 0) {
            return `${mins}m ${secs}s`;
        } else {
            return `${secs}s`;
        }
    }

    calculateTrackStats(trackpoints) {
        if (!trackpoints || trackpoints.length === 0) {
            return {
                distanceKm: 0,
                elapsedTimeMs: 0,
                movingTimeMs: 0,
                eleGain: 0,
                eleLoss: 0,
                avgSpeedKmH: 0,
                maxSpeedKmH: 0,
                avgHr: null,
                maxHr: null
            };
        }

        let totalDistKm = 0;
        let eleGain = 0;
        let eleLoss = 0;
        let movingTimeMs = 0;
        let maxSpeed = 0;
        let hrSum = 0;
        let hrCount = 0;
        let maxHr = 0;

        let powerSum = 0;
        let powerCount = 0;
        let maxPower = 0;

        const startTime = trackpoints[0].time;
        const endTime = trackpoints[trackpoints.length - 1].time;
        const elapsedTimeMs = Math.max(0, endTime - startTime);

        for (let i = 1; i < trackpoints.length; i++) {
            const prev = trackpoints[i - 1];
            const curr = trackpoints[i];
            const dtMs = curr.time - prev.time;

            const distKm = this.calculateDistanceKm(prev.lat, prev.lon, curr.lat, curr.lon);
            totalDistKm += distKm;

            let speed = curr.speed;
            if (speed === null || isNaN(speed)) {
                speed = (dtMs > 0 && dtMs < 300000) ? (distKm / (dtMs / 1000)) * 3600 : 0;
            }
            if (speed > maxSpeed) maxSpeed = speed;

            if (speed >= 1.0 && dtMs > 0 && dtMs < 300000) {
                movingTimeMs += dtMs;
            }

            if (prev.ele !== null && curr.ele !== null && !isNaN(prev.ele) && !isNaN(curr.ele)) {
                const dEle = curr.ele - prev.ele;
                if (dEle > 0.3) {
                    eleGain += dEle;
                } else if (dEle < -0.3) {
                    eleLoss += Math.abs(dEle);
                }
            }

            if (curr.hr !== null && !isNaN(curr.hr)) {
                hrSum += curr.hr;
                hrCount++;
                if (curr.hr > maxHr) maxHr = curr.hr;
            }

            if (curr.power !== null && !isNaN(curr.power)) {
                powerSum += curr.power;
                powerCount++;
                if (curr.power > maxPower) maxPower = curr.power;
            }
        }

        if (movingTimeMs === 0 && elapsedTimeMs > 0) {
            movingTimeMs = elapsedTimeMs;
        }

        const movingTimeHours = movingTimeMs / 3600000;
        const avgSpeedKmH = movingTimeHours > 0 ? (totalDistKm / movingTimeHours) : 0;
        const avgHr = hrCount > 0 ? Math.round(hrSum / hrCount) : null;
        const avgPower = powerCount > 0 ? Math.round(powerSum / powerCount) : null;

        return {
            distanceKm: totalDistKm,
            elapsedTimeMs,
            movingTimeMs,
            eleGain: Math.round(eleGain),
            eleLoss: Math.round(eleLoss),
            avgSpeedKmH: parseFloat(avgSpeedKmH.toFixed(1)),
            maxSpeedKmH: parseFloat(maxSpeed.toFixed(1)),
            avgHr,
            maxHr: maxHr > 0 ? maxHr : null,
            avgPower,
            maxPower: maxPower > 0 ? Math.round(maxPower) : null
        };
    }

    // ----------------------------------------------------
    // Boundary Calculations & Constraints
    // ----------------------------------------------------
    resetBoundaryValues() {
        this.userModifiedSliders = new Set();
        if (this.files.length === 0) {
            this.boundaryValues = [];
            return;
        }

        const N = this.files.length;
        this.boundaryValues = new Array(N + 1);

        const globalMin = Math.min(...this.files.map(f => f.startTime));
        const globalMax = Math.max(...this.files.map(f => f.endTime));

        this.boundaryValues[0] = globalMin;

        for (let i = 1; i < N; i++) {
            const prevEnd = this.files[i - 1].endTime;
            const currStart = this.files[i].startTime;
            if (prevEnd >= currStart) {
                this.boundaryValues[i] = Math.round((currStart + prevEnd) / 2);
            } else {
                this.boundaryValues[i] = prevEnd;
            }
        }

        this.boundaryValues[N] = globalMax;
    }

    toggleFileVisibility(fileId) {
        if (this.hiddenFileIds.has(fileId)) {
            this.hiddenFileIds.delete(fileId);
        } else {
            this.hiddenFileIds.add(fileId);
        }
        this.updateView();
    }

    updateView() {
        const dropZone = this.container.querySelector('#drop-zone-geo');
        const combinerContent = this.container.querySelector('#combiner-content');

        if (this.files.length === 0) {
            dropZone.style.display = 'block';
            combinerContent.style.display = 'none';
            if (this.chart) {
                this.chart.destroy();
                this.chart = null;
            }
            return;
        }

        dropZone.style.display = 'none';
        combinerContent.style.display = 'flex';

        const filenameInput = this.container.querySelector('#output-track-name');
        if (filenameInput && !filenameInput.value) {
            filenameInput.value = this.files[0].name.replace(/\.(gpx|fit|tcx)$/i, '') + '_combined';
        }

        const exportSuffix = this.container.querySelector('#export-suffix');
        if (exportSuffix) {
            exportSuffix.textContent = `.${this.exportFormat}`;
        }

        this.renderFileList();
        this.renderCutsSummary();
        this.renderCombinedStats();
        this.renderChart();
    }

    renderFileList() {
        const fileList = this.container.querySelector('#geo-file-list');
        fileList.innerHTML = '';

        this.files.forEach((fileObj, index) => {
            const li = document.createElement('li');
            const isHidden = this.hiddenFileIds.has(fileObj.id);
            li.className = `file-item ${isHidden ? 'file-item-hidden' : ''}`;

            const sizeKB = (fileObj.size / 1024).toFixed(1);
            const sizeStr = sizeKB > 1000 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${sizeKB} KB`;
            const ptsCount = fileObj.trackpoints.length;
            const startStr = new Date(fileObj.startTime).toLocaleTimeString();
            const endStr = new Date(fileObj.endTime).toLocaleTimeString();

            const stats = fileObj.stats || this.calculateTrackStats(fileObj.trackpoints);
            const distStr = `${stats.distanceKm.toFixed(2)} km`;
            const activeTimeStr = this.formatDuration(stats.movingTimeMs);
            const totalTimeStr = this.formatDuration(stats.elapsedTimeMs);
            const eleStr = `+${stats.eleGain}m / -${stats.eleLoss}m`;
            const speedStr = `${stats.avgSpeedKmH} km/h`;

            li.innerHTML = `
                <div class="file-item-content">
                    <div class="file-item-header">
                        <span class="file-index">${index + 1}</span>
                        <span class="file-name" title="${this.escapeHtml(fileObj.name)}">${this.escapeHtml(fileObj.name)}</span>
                        <span class="file-size">${sizeStr} • ${ptsCount} pts • (${startStr} - ${endStr})</span>
                    </div>

                    <div class="file-stats-pills">
                        <span class="stat-pill" title="Track Distance">📏 <strong>${distStr}</strong></span>
                        <span class="stat-pill" title="Moving Time (Total Elapsed)">⏱️ <strong>${activeTimeStr}</strong> (${totalTimeStr})</span>
                        <span class="stat-pill" title="Elevation Gain / Loss">🏔️ <strong>${eleStr}</strong></span>
                        <span class="stat-pill" title="Average Moving Speed (Max)">⚡ <strong>${speedStr}</strong> (max ${stats.maxSpeedKmH})</span>
                        ${stats.avgHr ? `<span class="stat-pill" title="Average Heart Rate">❤️ <strong>${stats.avgHr} bpm</strong></span>` : ''}
                        ${stats.avgPower ? `<span class="stat-pill" title="Average Power (Max)">🚴 <strong>${stats.avgPower} W</strong> (max ${stats.maxPower} W)</span>` : ''}
                    </div>
                </div>

                <div class="item-actions">
                    <button class="btn-icon btn-visibility ${isHidden ? 'is-hidden' : ''}" title="${isHidden ? 'Show in plot' : 'Hide from plot'}">
                        ${isHidden ? `
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                                <line x1="1" y1="1" x2="23" y2="23"></line>
                            </svg>
                        ` : `
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                        `}
                    </button>
                    <button class="btn-icon btn-up" title="Move Up" ${index === 0 ? 'disabled' : ''}>
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="18 15 12 9 6 15"></polyline>
                        </svg>
                    </button>
                    <button class="btn-icon btn-down" title="Move Down" ${index === this.files.length - 1 ? 'disabled' : ''}>
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

            li.querySelector('.btn-visibility').addEventListener('click', () => this.toggleFileVisibility(fileObj.id));
            li.querySelector('.btn-up').addEventListener('click', () => this.moveUp(index));
            li.querySelector('.btn-down').addEventListener('click', () => this.moveDown(index));
            li.querySelector('.btn-delete').addEventListener('click', () => this.removeFile(fileObj.id));

            fileList.appendChild(li);
        });
    }

    renderCombinedStats() {
        const wrapper = this.container.querySelector('#combined-stats-wrapper');
        if (!wrapper) return;
        wrapper.innerHTML = '';

        const finalTrackpoints = this.buildCombinedTrackpoints();
        if (finalTrackpoints.length === 0) {
            wrapper.innerHTML = `<div class="stats-empty-msg">No active trackpoints remaining in final output.</div>`;
            return;
        }

        const combStats = this.calculateTrackStats(finalTrackpoints);

        const card = document.createElement('div');
        card.className = 'combined-stats-card';
        card.innerHTML = `
            <div class="stats-grid">
                <div class="stat-box">
                    <span class="stat-box-label">Total Distance</span>
                    <span class="stat-box-value">${combStats.distanceKm.toFixed(2)} <small>km</small></span>
                    <span class="stat-box-sub">${finalTrackpoints.length} track points</span>
                </div>
                <div class="stat-box">
                    <span class="stat-box-label">Active Time</span>
                    <span class="stat-box-value">${this.formatDuration(combStats.movingTimeMs)}</span>
                    <span class="stat-box-sub">Elapsed: ${this.formatDuration(combStats.elapsedTimeMs)}</span>
                </div>
                <div class="stat-box">
                    <span class="stat-box-label">Elevation Gain / Loss</span>
                    <span class="stat-box-value">+${combStats.eleGain}m / -${combStats.eleLoss}m</span>
                </div>
                <div class="stat-box">
                    <span class="stat-box-label">Avg Speed</span>
                    <span class="stat-box-value">${combStats.avgSpeedKmH} <small>km/h</small></span>
                    <span class="stat-box-sub">Max: ${combStats.maxSpeedKmH} km/h</span>
                </div>
                ${combStats.avgHr ? `
                <div class="stat-box">
                    <span class="stat-box-label">Avg Heart Rate</span>
                    <span class="stat-box-value">${combStats.avgHr} <small>bpm</small></span>
                    <span class="stat-box-sub">Max: ${combStats.maxHr} bpm</span>
                </div>` : ''}
                ${combStats.avgPower ? `
                <div class="stat-box">
                    <span class="stat-box-label">Avg Power</span>
                    <span class="stat-box-value">${combStats.avgPower} <small>W</small></span>
                    <span class="stat-box-sub">Max: ${combStats.maxPower} W</span>
                </div>` : ''}
            </div>
        `;

        wrapper.appendChild(card);
    }

    moveUp(index) {
        if (index > 0) {
            const temp = this.files[index];
            this.files[index] = this.files[index - 1];
            this.files[index - 1] = temp;
            this.resetBoundaryValues();
            this.updateView();
        }
    }

    moveDown(index) {
        if (index < this.files.length - 1) {
            const temp = this.files[index];
            this.files[index] = this.files[index + 1];
            this.files[index + 1] = temp;
            this.resetBoundaryValues();
            this.updateView();
        }
    }

    removeFile(id) {
        this.files = this.files.filter(f => f.id !== id);
        this.hiddenFileIds.delete(id);
        this.resetBoundaryValues();
        this.updateView();
    }

    renderCutsSummary() {
        const wrapper = this.container.querySelector('#cuts-summary-wrapper');
        if (!wrapper) return;
        wrapper.innerHTML = '';

        if (this.files.length === 0) return;

        const N = this.files.length;
        const flexContainer = document.createElement('div');
        flexContainer.className = 'cuts-summary-grid';

        for (let i = 0; i <= N; i++) {
            let label = '';
            if (i === 0) {
                label = 'Start Cut';
            } else if (i === N) {
                label = 'End Cut';
            } else {
                label = `Cut ${i}`;
            }

            const val = this.boundaryValues[i];
            const timeStr = val ? new Date(val).toLocaleTimeString() : 'N/A';
            const isModified = this.userModifiedSliders.has(i);

            const badge = document.createElement('div');
            badge.className = `cut-summary-card ${isModified ? 'is-modified' : ''}`;
            badge.innerHTML = `
                <span class="cut-card-title">${label}</span>
                <span class="cut-card-time">${timeStr}</span>
                <span class="cut-card-status">${isModified ? 'Trimmed' : 'Auto'}</span>
            `;

            flexContainer.appendChild(badge);
        }

        wrapper.appendChild(flexContainer);
    }

    // ----------------------------------------------------
    // Chart.js Plotting & Interactive Canvas Events
    // ----------------------------------------------------
    renderChart() {
        const canvas = this.container.querySelector('#timeline-chart');
        if (!canvas) return;

        if (typeof window.Chart === 'undefined') {
            console.warn('Chart.js is loading...');
            return;
        }

        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }

        if (this.files.length === 0) return;

        const colors = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4'];
        const datasets = [];

        this.files.forEach((fileObj, fIdx) => {
            const isHidden = this.hiddenFileIds.has(fileObj.id);
            const dataPoints = [];

            fileObj.trackpoints.forEach(pt => {
                let val = pt[this.selectedMetric];
                if (val !== null && val !== undefined) {
                    dataPoints.push({ x: pt.time, y: val });
                }
            });

            datasets.push({
                label: `(#${fIdx + 1}) ${fileObj.name}`,
                data: dataPoints,
                borderColor: colors[fIdx % colors.length],
                backgroundColor: colors[fIdx % colors.length] + '22',
                borderWidth: 2,
                pointRadius: 0,
                tension: 0.2,
                hidden: isHidden
            });
        });

        const metricLabels = {
            speed: 'Speed (km/h)',
            ele: 'Elevation (m)',
            hr: 'Heart Rate (bpm)',
            cad: 'Cadence (rpm)',
            power: 'Power (W)'
        };

        const self = this;
        const boundaryLinesPlugin = {
            id: 'boundaryLinesPlugin',
            afterDraw: (chart) => {
                const { ctx, chartArea, scales } = chart;
                if (!scales.x || !chartArea) return;

                ctx.save();

                self.boundaryValues.forEach((timeMs, idx) => {
                    const xPixel = scales.x.getPixelForValue(timeMs);
                    if (xPixel >= chartArea.left && xPixel <= chartArea.right) {
                        const isEnd = idx === 0 || idx === self.files.length;
                        const isHovered = self.hoveredBoundaryIndex === idx;
                        const isDragging = self.draggingBoundaryIndex === idx;

                        let lineColor = isEnd ? '#ef4444' : '#f59e0b';
                        if (isDragging || isHovered) lineColor = '#10b981';

                        const labelText = idx === 0 ? 'Start Cut' : (idx === self.files.length ? 'End Cut' : `Cut ${idx}`);

                        if (isHovered || isDragging) {
                            ctx.shadowColor = lineColor;
                            ctx.shadowBlur = 8;
                        } else {
                            ctx.shadowBlur = 0;
                        }

                        ctx.beginPath();
                        ctx.setLineDash((isHovered || isDragging) ? [] : [5, 5]);
                        ctx.lineWidth = (isHovered || isDragging) ? 3 : 2;
                        ctx.strokeStyle = lineColor;
                        ctx.moveTo(xPixel, chartArea.top);
                        ctx.lineTo(xPixel, chartArea.bottom);
                        ctx.stroke();
                        ctx.shadowBlur = 0;

                        ctx.fillStyle = lineColor;
                        ctx.beginPath();
                        ctx.arc(xPixel, (chartArea.top + chartArea.bottom) / 2, (isHovered || isDragging) ? 6 : 4, 0, Math.PI * 2);
                        ctx.fill();

                        ctx.fillStyle = lineColor;
                        ctx.font = 'bold 11px Inter, sans-serif';
                        ctx.fillRect(xPixel - 24, chartArea.top, 48, 18);

                        ctx.fillStyle = '#ffffff';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(labelText, xPixel, chartArea.top + 9);
                    }
                });

                if (self.activeSnapInfo) {
                    ctx.font = 'bold 12px Inter, sans-serif';
                    const textWidth = ctx.measureText(self.activeSnapInfo).width;
                    const badgeWidth = textWidth + 24;
                    const badgeX = (chartArea.left + chartArea.right) / 2 - badgeWidth / 2;
                    const badgeY = chartArea.top + 24;

                    ctx.fillStyle = '#10b981';
                    ctx.beginPath();
                    if (ctx.roundRect) {
                        ctx.roundRect(badgeX, badgeY, badgeWidth, 26, 6);
                    } else {
                        ctx.rect(badgeX, badgeY, badgeWidth, 26);
                    }
                    ctx.fill();

                    ctx.fillStyle = '#000000';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(`📌 ${self.activeSnapInfo}`, (chartArea.left + chartArea.right) / 2, badgeY + 13);
                }

                ctx.restore();
            }
        };

        const ctx = canvas.getContext('2d');
        this.chart = new window.Chart(ctx, {
            type: 'line',
            data: { datasets },
            plugins: [boundaryLinesPlugin],
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                interaction: {
                    mode: 'nearest',
                    intersect: false
                },
                scales: {
                    x: {
                        type: 'linear',
                        title: { display: true, text: 'Absolute Time (UTC)', color: '#a1a1aa' },
                        ticks: {
                            color: '#a1a1aa',
                            callback: (value) => new Date(value).toLocaleTimeString()
                        },
                        grid: { color: '#27272a' }
                    },
                    y: {
                        title: { display: true, text: metricLabels[this.selectedMetric] || '', color: '#a1a1aa' },
                        ticks: { color: '#a1a1aa' },
                        grid: { color: '#27272a' }
                    }
                },
                plugins: {
                    legend: {
                        labels: { color: '#f4f4f5', usePointStyle: true },
                        onClick: (e, legendItem) => {
                            const fileObj = self.files[legendItem.datasetIndex];
                            if (fileObj) {
                                self.toggleFileVisibility(fileObj.id);
                            }
                        }
                    },
                    zoom: {
                        zoom: {
                            wheel: { enabled: true },
                            pinch: { enabled: true },
                            mode: 'x'
                        },
                        pan: {
                            enabled: true,
                            mode: 'x'
                        }
                    }
                }
            }
        });

        this.setupChartCanvasEvents(canvas);
    }

    setupChartCanvasEvents(canvas) {
        if (this.canvasEventsBound) return;
        this.canvasEventsBound = true;

        let isPanDragging = false;
        let lastPanX = 0;

        const getMouseX = (e) => {
            const rect = canvas.getBoundingClientRect();
            const clientX = e.touches && e.touches.length > 0 ? e.touches[0].clientX : e.clientX;
            return clientX - rect.left;
        };

        const findHoveredBoundary = (mouseX) => {
            if (!this.chart || !this.chart.scales || !this.chart.scales.x) return -1;
            const scaleX = this.chart.scales.x;
            const threshold = 12;

            for (let i = 0; i < this.boundaryValues.length; i++) {
                const bVal = this.boundaryValues[i];
                const bPix = scaleX.getPixelForValue(bVal);
                if (Math.abs(bPix - mouseX) <= threshold) {
                    return i;
                }
            }
            return -1;
        };

        const onPointerMove = (e) => {
            if (!this.chart || !this.chart.scales || !this.chart.scales.x) return;
            const mouseX = getMouseX(e);

            if (isPanDragging) {
                const deltaX = mouseX - lastPanX;
                lastPanX = mouseX;
                if (this.chart && typeof this.chart.pan === 'function') {
                    this.chart.pan({ x: deltaX }, undefined, 'default');
                }
                canvas.style.cursor = 'grabbing';
                return;
            }

            if (this.draggingBoundaryIndex === null) {
                const hIdx = findHoveredBoundary(mouseX);
                if (hIdx !== -1) {
                    canvas.style.cursor = 'col-resize';
                    if (this.hoveredBoundaryIndex !== hIdx) {
                        this.hoveredBoundaryIndex = hIdx;
                        this.chart.update('none');
                    }
                } else {
                    canvas.style.cursor = 'grab';
                    if (this.hoveredBoundaryIndex !== null) {
                        this.hoveredBoundaryIndex = null;
                        this.chart.update('none');
                    }
                }
                return;
            }

            const scaleX = this.chart.scales.x;
            const idx = this.draggingBoundaryIndex;
            let timeVal = scaleX.getValueForPixel(mouseX);

            let snappedTime = null;
            let snapLabel = '';
            const snapThresholdPx = 15;

            for (const fileObj of this.files) {
                if (this.hiddenFileIds.has(fileObj.id)) continue;

                const startPix = scaleX.getPixelForValue(fileObj.startTime);
                if (Math.abs(startPix - mouseX) <= snapThresholdPx) {
                    snappedTime = fileObj.startTime;
                    snapLabel = `Snapped to "${fileObj.name}" Start`;
                    break;
                }

                const endPix = scaleX.getPixelForValue(fileObj.endTime);
                if (Math.abs(endPix - mouseX) <= snapThresholdPx) {
                    snappedTime = fileObj.endTime;
                    snapLabel = `Snapped to "${fileObj.name}" End`;
                    break;
                }
            }

            if (snappedTime !== null) {
                timeVal = snappedTime;
                this.activeSnapInfo = snapLabel;
            } else {
                this.activeSnapInfo = null;
            }

            const globalMinTime = Math.min(...this.files.map(f => f.startTime));
            const globalMaxTime = Math.max(...this.files.map(f => f.endTime));
            const minAllowed = (idx === 0) ? globalMinTime : this.boundaryValues[idx - 1];
            const maxAllowed = (idx === this.files.length) ? globalMaxTime : this.boundaryValues[idx + 1];

            timeVal = Math.max(minAllowed, Math.min(maxAllowed, timeVal));
            this.boundaryValues[idx] = timeVal;
            this.userModifiedSliders.add(idx);

            this.renderCutsSummary();
            this.renderCombinedStats();
            this.chart.update('none');
        };

        const onPointerDown = (e) => {
            const mouseX = getMouseX(e);
            const hIdx = findHoveredBoundary(mouseX);
            if (hIdx !== -1) {
                this.draggingBoundaryIndex = hIdx;
                canvas.style.cursor = 'col-resize';
                if (canvas.setPointerCapture && e.pointerId) {
                    try { canvas.setPointerCapture(e.pointerId); } catch (_) { }
                }
                e.preventDefault();
            } else {
                isPanDragging = true;
                lastPanX = mouseX;
                canvas.style.cursor = 'grabbing';
                if (canvas.setPointerCapture && e.pointerId) {
                    try { canvas.setPointerCapture(e.pointerId); } catch (_) { }
                }
                e.preventDefault();
            }
        };

        const onPointerUp = (e) => {
            if (this.draggingBoundaryIndex !== null) {
                if (canvas.releasePointerCapture && e.pointerId) {
                    try { canvas.releasePointerCapture(e.pointerId); } catch (_) { }
                }
                this.draggingBoundaryIndex = null;
                this.activeSnapInfo = null;
                this.hoveredBoundaryIndex = null;
                canvas.style.cursor = 'grab';
                if (this.chart) this.chart.update('none');
            }

            if (isPanDragging) {
                isPanDragging = false;
                if (canvas.releasePointerCapture && e.pointerId) {
                    try { canvas.releasePointerCapture(e.pointerId); } catch (_) { }
                }
                canvas.style.cursor = 'grab';
            }
        };

        canvas.addEventListener('pointerdown', onPointerDown);
        canvas.addEventListener('pointermove', onPointerMove);
        canvas.addEventListener('pointerup', onPointerUp);
        canvas.addEventListener('pointercancel', onPointerUp);
    }

    zoomChart(factor) {
        if (!this.chart || !this.chart.scales || !this.chart.scales.x) return;

        if (typeof this.chart.zoom === 'function') {
            this.chart.zoom(factor);
        } else {
            const scale = this.chart.scales.x;
            const range = scale.max - scale.min;
            const center = (scale.min + scale.max) / 2;
            const newHalfRange = (range / factor) / 2;

            scale.options.min = center - newHalfRange;
            scale.options.max = center + newHalfRange;
            this.chart.update();
        }
    }

    resetChartZoom() {
        if (!this.chart) return;
        if (typeof this.chart.resetZoom === 'function') {
            this.chart.resetZoom();
        } else if (this.files.length > 0 && this.chart.scales.x) {
            delete this.chart.scales.x.options.min;
            delete this.chart.scales.x.options.max;
            this.chart.update();
        }
    }

    // ----------------------------------------------------
    // Save Result & Client-Side Export
    // ----------------------------------------------------
    async saveResult() {
        if (this.files.length === 0) return;

        const saveBtn = this.container.querySelector('#save-result-btn');
        const loader = this.container.querySelector('#loader-geo');
        const btnText = saveBtn.querySelector('.btn-text');

        saveBtn.disabled = true;
        loader.style.display = 'block';
        btnText.style.display = 'none';

        try {
            const finalTrackpoints = this.buildCombinedTrackpoints();

            if (finalTrackpoints.length === 0) {
                alert('No trackpoints remaining after current cuts or filter settings.');
                return;
            }

            const filenameInput = this.container.querySelector('#output-track-name');
            let baseName = filenameInput ? filenameInput.value.trim() : 'Combined_Track';
            if (!baseName) baseName = 'Combined_Track';

            if (this.exportFormat === 'gpx') {
                const gpxContent = this.generateGpxXml(finalTrackpoints, baseName);
                const blob = new Blob([gpxContent], { type: 'application/gpx+xml' });
                this.downloadBlob(blob, `${baseName}.gpx`);
            } else if (this.exportFormat === 'tcx') {
                const tcxContent = this.generateTcxXml(finalTrackpoints, baseName);
                const blob = new Blob([tcxContent], { type: 'application/vnd.garmin.tcx+xml' });
                this.downloadBlob(blob, `${baseName}.tcx`);
            } else {
                const fitBuffer = this.generateFitBinary(finalTrackpoints);
                const blob = new Blob([fitBuffer], { type: 'application/octet-stream' });
                this.downloadBlob(blob, `${baseName}.fit`);
            }

        } catch (error) {
            console.error('Export error:', error);
            alert(`Failed to export track:\n${error.message}`);
        } finally {
            saveBtn.disabled = false;
            loader.style.display = 'none';
            btnText.style.display = 'inline-block';
        }
    }

    generateTcxXml(trackpoints, trackName = 'Combined_Track') {
        if (!trackpoints || trackpoints.length === 0) return '';

        const startTimeIso = new Date(trackpoints[0].time).toISOString();
        const stats = this.calculateTrackStats(trackpoints);
        const totalDistMeters = Math.round(stats.distanceKm * 1000);
        const totalDurationSec = Math.round(stats.elapsedTimeMs / 1000);

        let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
        xml += `<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2" xmlns:ns3="http://www.garmin.com/xmlschemas/ActivityExtension/v2">\n`;
        xml += `  <Activities>\n`;
        xml += `    <Activity Sport="Biking">\n`;
        xml += `      <Id>${startTimeIso}</Id>\n`;
        xml += `      <Lap StartTime="${startTimeIso}">\n`;
        xml += `        <TotalTimeSeconds>${totalDurationSec}</TotalTimeSeconds>\n`;
        xml += `        <DistanceMeters>${totalDistMeters}</DistanceMeters>\n`;
        if (stats.maxSpeedKmH > 0) xml += `        <MaximumSpeed>${(stats.maxSpeedKmH / 3.6).toFixed(2)}</MaximumSpeed>\n`;
        if (stats.avgHr) xml += `        <AverageHeartRateBpm><Value>${stats.avgHr}</Value></AverageHeartRateBpm>\n`;
        if (stats.maxHr) xml += `        <MaximumHeartRateBpm><Value>${stats.maxHr}</Value></MaximumHeartRateBpm>\n`;
        xml += `        <Intensity>Active</Intensity>\n`;
        xml += `        <TriggerMethod>Manual</TriggerMethod>\n`;
        xml += `        <Track>\n`;

        let cumulativeDistKm = 0;
        for (let i = 0; i < trackpoints.length; i++) {
            const pt = trackpoints[i];
            if (i > 0) {
                const prev = trackpoints[i - 1];
                cumulativeDistKm += this.calculateDistanceKm(prev.lat, prev.lon, pt.lat, pt.lon);
            }

            const ptTimeIso = new Date(pt.time).toISOString();
            xml += `          <Trackpoint>\n`;
            xml += `            <Time>${ptTimeIso}</Time>\n`;
            xml += `            <Position>\n`;
            xml += `              <LatitudeDegrees>${pt.lat.toFixed(6)}</LatitudeDegrees>\n`;
            xml += `              <LongitudeDegrees>${pt.lon.toFixed(6)}</LongitudeDegrees>\n`;
            xml += `            </Position>\n`;
            if (pt.ele !== null && !isNaN(pt.ele)) xml += `            <AltitudeMeters>${pt.ele.toFixed(1)}</AltitudeMeters>\n`;
            xml += `            <DistanceMeters>${Math.round(cumulativeDistKm * 1000)}</DistanceMeters>\n`;
            if (pt.hr !== null && !isNaN(pt.hr)) {
                xml += `            <HeartRateBpm><Value>${Math.round(pt.hr)}</Value></HeartRateBpm>\n`;
            }
            if (pt.cad !== null && !isNaN(pt.cad)) {
                xml += `            <Cadence>${Math.round(pt.cad)}</Cadence>\n`;
            }

            const hasExt = (pt.speed !== null && !isNaN(pt.speed)) || (pt.power !== null && !isNaN(pt.power));
            if (hasExt) {
                xml += `            <Extensions>\n`;
                xml += `              <ns3:TPX>\n`;
                if (pt.speed !== null && !isNaN(pt.speed)) {
                    xml += `                <ns3:Speed>${(pt.speed / 3.6).toFixed(2)}</ns3:Speed>\n`;
                }
                if (pt.power !== null && !isNaN(pt.power)) {
                    xml += `                <ns3:Watts>${Math.round(pt.power)}</ns3:Watts>\n`;
                }
                xml += `              </ns3:TPX>\n`;
                xml += `            </Extensions>\n`;
            }

            xml += `          </Trackpoint>\n`;
        }

        xml += `        </Track>\n`;
        xml += `      </Lap>\n`;
        xml += `    </Activity>\n`;
        xml += `  </Activities>\n`;
        xml += `</TrainingCenterDatabase>\n`;

        return xml;
    }

    buildCombinedTrackpoints() {
        const N = this.files.length;
        const resultPoints = [];

        for (let i = 0; i < N; i++) {
            const fileObj = this.files[i];

            if (this.hiddenFileIds.has(fileObj.id)) continue;

            const startCut = (this.userModifiedSliders && this.userModifiedSliders.has(i))
                ? this.boundaryValues[i]
                : ((this.userModifiedSliders && this.userModifiedSliders.has(0)) ? Math.max(fileObj.startTime, this.boundaryValues[0]) : fileObj.startTime);

            const endCut = (this.userModifiedSliders && this.userModifiedSliders.has(i + 1))
                ? this.boundaryValues[i + 1]
                : ((this.userModifiedSliders && this.userModifiedSliders.has(N)) ? Math.min(fileObj.endTime, this.boundaryValues[N]) : fileObj.endTime);

            const segmentPoints = fileObj.trackpoints.filter(pt => {
                return pt.time >= startCut && pt.time <= endCut;
            });

            resultPoints.push(...segmentPoints);
        }

        resultPoints.sort((a, b) => a.time - b.time);

        const uniquePoints = [];
        const seenTimes = new Set();

        resultPoints.forEach(pt => {
            if (!seenTimes.has(pt.time)) {
                seenTimes.add(pt.time);
                uniquePoints.push(pt);
            }
        });

        return uniquePoints;
    }

    generateGpxXml(trackpoints, trackName) {
        let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
        xml += `<gpx version="1.1" creator="Web Tools Platform - GPX &amp; FIT Tool"\n`;
        xml += `  xmlns="http://www.topografix.com/GPX/1/1"\n`;
        xml += `  xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1"\n`;
        xml += `  xmlns:gpxx="http://www.garmin.com/xmlschemas/GpxExtensions/v3"\n`;
        xml += `  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n`;
        xml += `  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd http://www.garmin.com/xmlschemas/TrackPointExtension/v1 http://www.garmin.com/xmlschemas/TrackPointExtensionv1.xsd">\n`;
        xml += `  <metadata>\n`;
        xml += `    <name>${this.escapeHtml(trackName)}</name>\n`;
        xml += `    <time>${new Date(trackpoints[0].time).toISOString()}</time>\n`;
        xml += `  </metadata>\n`;
        xml += `  <trk>\n`;
        xml += `    <name>${this.escapeHtml(trackName)}</name>\n`;

        let isSegmentOpen = false;

        trackpoints.forEach((pt, idx) => {
            const prevPt = idx > 0 ? trackpoints[idx - 1] : null;
            const timeGap = prevPt ? pt.time - prevPt.time : 0;

            if (!isSegmentOpen || timeGap > 600000) {
                if (isSegmentOpen) xml += `    </trkseg>\n`;
                xml += `    <trkseg>\n`;
                isSegmentOpen = true;
            }

            const timeIso = new Date(pt.time).toISOString();
            xml += `      <trkpt lat="${pt.lat.toFixed(6)}" lon="${pt.lon.toFixed(6)}">\n`;
            if (pt.ele !== null && !isNaN(pt.ele)) {
                xml += `        <ele>${pt.ele.toFixed(2)}</ele>\n`;
            }
            xml += `        <time>${timeIso}</time>\n`;
            if (pt.speed !== null && !isNaN(pt.speed)) {
                xml += `        <speed>${(pt.speed / 3.6).toFixed(2)}</speed>\n`;
            }

            const hasExtension = pt.hr !== null || pt.cad !== null || pt.atemp !== null || pt.power !== null || pt.speed !== null;
            if (hasExtension) {
                xml += `        <extensions>\n`;
                if (pt.power !== null && !isNaN(pt.power)) {
                    xml += `          <power>${Math.round(pt.power)}</power>\n`;
                }
                if (pt.hr !== null || pt.cad !== null || pt.atemp !== null || pt.speed !== null) {
                    xml += `          <gpxtpx:TrackPointExtension>\n`;
                    if (pt.atemp !== null && !isNaN(pt.atemp)) xml += `            <gpxtpx:atemp>${pt.atemp.toFixed(1)}</gpxtpx:atemp>\n`;
                    if (pt.hr !== null) xml += `            <gpxtpx:hr>${pt.hr}</gpxtpx:hr>\n`;
                    if (pt.cad !== null) xml += `            <gpxtpx:cad>${pt.cad}</gpxtpx:cad>\n`;
                    if (pt.speed !== null && !isNaN(pt.speed)) xml += `            <gpxtpx:speed>${(pt.speed / 3.6).toFixed(2)}</gpxtpx:speed>\n`;
                    xml += `          </gpxtpx:TrackPointExtension>\n`;
                }
                xml += `        </extensions>\n`;
            }

            xml += `      </trkpt>\n`;
        });

        if (isSegmentOpen) {
            xml += `    </trkseg>\n`;
        }

        xml += `  </trk>\n`;
        xml += `</gpx>\n`;

        return xml;
    }

    generateFitBinary(trackpoints) {
        const recordCount = trackpoints.length;
        const dataLengthEstimate = recordCount * 30 + 100;
        const buffer = new ArrayBuffer(dataLengthEstimate + 14);
        const view = new DataView(buffer);
        const bytes = new Uint8Array(buffer);

        view.setUint8(0, 14);
        view.setUint8(1, 0x20);
        view.setUint16(2, 2100, true);
        bytes[8] = 0x2E; bytes[9] = 0x46; bytes[10] = 0x49; bytes[11] = 0x54;
        view.setUint16(12, 0, true);

        let offset = 14;

        view.setUint8(offset++, 0x40);
        view.setUint8(offset++, 0);
        view.setUint8(offset++, 0);
        view.setUint16(offset, 20, true); offset += 2;
        view.setUint8(offset++, 5);

        const fieldsDef = [
            { id: 253, size: 4, type: 134 },
            { id: 0, size: 4, type: 133 },
            { id: 1, size: 4, type: 133 },
            { id: 2, size: 2, type: 132 },
            { id: 6, size: 2, type: 132 }
        ];

        fieldsDef.forEach(f => {
            view.setUint8(offset++, f.id);
            view.setUint8(offset++, f.size);
            view.setUint8(offset++, f.type);
        });

        const FIT_EPOCH_MS = Date.UTC(1989, 11, 31, 0, 0, 0);

        trackpoints.forEach(pt => {
            view.setUint8(offset++, 0x00);

            const sec = Math.floor((pt.time - FIT_EPOCH_MS) / 1000);
            view.setUint32(offset, sec, true); offset += 4;

            const latSemi = Math.round(pt.lat * (2147483648 / 180));
            view.setInt32(offset, latSemi, true); offset += 4;

            const lonSemi = Math.round(pt.lon * (2147483648 / 180));
            view.setInt32(offset, lonSemi, true); offset += 4;

            const eleScaled = pt.ele !== null ? Math.round((pt.ele + 500) * 5) : 0xFFFF;
            view.setUint16(offset, Math.min(0xFFFE, Math.max(0, eleScaled)), true); offset += 2;

            const speedScaled = pt.speed !== null ? Math.round((pt.speed / 3.6) * 1000) : 0xFFFF;
            view.setUint16(offset, Math.min(0xFFFE, Math.max(0, speedScaled)), true); offset += 2;
        });

        const dataSize = offset - 14;
        view.setUint32(4, dataSize, true);

        return buffer.slice(0, offset);
    }

    handleSave() {
        return this.saveResult();
    }

    downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            if (a.parentNode) {
                document.body.removeChild(a);
            }
            URL.revokeObjectURL(url);
        }, 200);
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
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
        this.files = [];
        this.boundaryValues = [];
        this.hiddenFileIds = new Set();
        this.userModifiedSliders = new Set();
        this.container = null;
        this.canvasEventsBound = false;
    }
}
