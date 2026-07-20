import { registry } from './ToolRegistry.js';
import { Router } from './Router.js';
import { PdfMergeTool } from '../tools/pdf/pdf-merge.js';
import { PdfSplitTool } from '../tools/pdf/pdf-split.js';
import { GpxFitCombinerTool } from '../tools/geo/gpx-fit-combiner.js';

export class App {
    constructor() {
        this.searchQuery = '';
        this.currentTool = null;
        this.router = null;

        this.hubView = document.getElementById('hub-view');
        this.toolView = document.getElementById('tool-view');
        this.toolWorkspace = document.getElementById('tool-workspace');
        this.breadcrumbCurrent = document.getElementById('breadcrumb-current');
        this.backBtn = document.getElementById('back-to-hub-btn');

        this.init();
    }

    init() {
        // Register available tools
        registry.register(new PdfMergeTool());
        registry.register(new PdfSplitTool());
        registry.register(new GpxFitCombinerTool());

        // Initialize Hash Router
        this.router = new Router((route) => this.handleRoute(route));

        // Bind Hub Search & Navigation Events
        this.setupHubEvents();

        // Start routing
        this.router.start();
    }

    setupHubEvents() {
        const searchInput = document.getElementById('hub-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value;
                this.renderHubGrid();
            });
        }

        if (this.backBtn) {
            this.backBtn.addEventListener('click', () => {
                this.router.navigate('hub');
            });
        }
    }

    handleRoute({ view, toolId }) {
        if (this.currentTool) {
            try {
                this.currentTool.destroy();
            } catch (e) {
                console.error('Error during tool destroy:', e);
            }
            this.currentTool = null;
        }

        if (view === 'tool' && toolId) {
            const tool = registry.get(toolId);
            if (tool) {
                this.showToolView(tool);
                return;
            }
        }

        // Default to Hub view
        this.showHubView();
    }

    showHubView() {
        this.hubView.style.display = 'block';
        this.toolView.style.display = 'none';
        this.renderHubGrid();
    }

    showToolView(tool) {
        this.currentTool = tool;
        this.hubView.style.display = 'none';
        this.toolView.style.display = 'block';

        if (this.breadcrumbCurrent) {
            this.breadcrumbCurrent.textContent = tool.name;
        }

        this.toolWorkspace.innerHTML = '';
        tool.render(this.toolWorkspace);
    }

    renderHubGrid() {
        const grid = document.getElementById('tools-grid');
        if (!grid) return;

        const filteredTools = registry.filter({
            searchQuery: this.searchQuery
        });

        grid.innerHTML = '';

        if (filteredTools.length === 0) {
            grid.innerHTML = `
                <div class="empty-hub-state">
                    <p>No tools found matching your search.</p>
                </div>
            `;
            return;
        }

        filteredTools.forEach(tool => {
            const card = document.createElement('div');
            card.className = 'tool-card';
            
            card.innerHTML = `
                <div class="tool-card-header">
                    <div class="tool-icon-wrapper">
                        ${tool.icon}
                    </div>
                </div>
                <div class="tool-card-body">
                    <h3>${tool.name}</h3>
                    <p>${tool.description}</p>
                </div>
                <div class="tool-card-footer">
                    <button class="btn btn-secondary btn-sm launch-btn">Open Tool →</button>
                </div>
            `;

            card.addEventListener('click', () => {
                this.router.navigate(tool.id);
            });

            grid.appendChild(card);
        });
    }
}

// Global initialization
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
