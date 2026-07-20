/**
 * Registry to manage tool registration and keyword search.
 */
class ToolRegistry {
    constructor() {
        /** @type {Map<string, import('../tools/base/Tool.js').Tool>} */
        this.tools = new Map();
    }

    /**
     * Registers a tool instance.
     * @param {import('../tools/base/Tool.js').Tool} tool 
     */
    register(tool) {
        if (this.tools.has(tool.id)) {
            console.warn(`Tool with ID "${tool.id}" is already registered. Overwriting.`);
        }
        this.tools.set(tool.id, tool);
    }

    /**
     * Retrieves a tool by ID.
     * @param {string} id 
     * @returns {import('../tools/base/Tool.js').Tool | undefined}
     */
    get(id) {
        return this.tools.get(id);
    }

    /**
     * Returns all registered tools.
     * @returns {import('../tools/base/Tool.js').Tool[]}
     */
    getAll() {
        return Array.from(this.tools.values());
    }

    /**
     * Filter tools by search query.
     * @param {Object} [options]
     * @param {string} [options.searchQuery='']
     * @returns {import('../tools/base/Tool.js').Tool[]}
     */
    filter({ searchQuery = '' } = {}) {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return this.getAll();

        return this.getAll().filter(tool => 
            tool.name.toLowerCase().includes(query) ||
            tool.description.toLowerCase().includes(query) ||
            (tool.tags && tool.tags.some(tag => tag.toLowerCase().includes(query)))
        );
    }
}

export const registry = new ToolRegistry();
