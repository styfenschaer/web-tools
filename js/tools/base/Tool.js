/**
 * Base Tool class for Web Utilities Platform.
 * Every tool module extends this class and implements the `render(container)` method.
 */
export class Tool {
    /**
     * @param {Object} options
     * @param {string} options.id - Unique identifier for the tool (e.g. 'pdf-merge')
     * @param {string} options.name - Display title (e.g. 'Merge PDFs')
     * @param {string} options.description - Short summary of what the tool does
     * @param {string} options.icon - SVG markup string for the tool's card icon
     * @param {Array<string>} [options.tags=[]] - Keywords for search matching
     */
    constructor({ id, name, description, icon, tags = [] }) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.icon = icon;
        this.tags = tags;
    }

    /**
     * Mounts the tool UI into the given container element.
     * @param {HTMLElement} container 
     */
    render(container) {
        throw new Error(`Tool "${this.id}" must implement the render(container) method.`);
    }

    /**
     * Unmount / cleanup method called when navigating away from the tool.
     */
    destroy() {
        // Subclasses can override if event listeners or resources need cleanup
    }
}
