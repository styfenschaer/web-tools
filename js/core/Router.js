/**
 * Hash Router to handle navigation between the Tool Hub view and specific Tool views.
 */
export class Router {
    /**
     * @param {Function} routeHandler - Callback `(routeInfo) => void` triggered on route change.
     */
    constructor(routeHandler) {
        this.routeHandler = routeHandler;
        this.init();
    }

    init() {
        window.addEventListener('hashchange', () => this.handleHashChange());
    }

    /**
     * Parse current location.hash and trigger route handler.
     */
    handleHashChange() {
        const hash = window.location.hash.slice(1).trim(); // strip '#'
        if (!hash || hash === 'hub') {
            this.routeHandler({ view: 'hub', toolId: null });
        } else {
            this.routeHandler({ view: 'tool', toolId: hash });
        }
    }

    /**
     * Programmatically navigate to a route.
     * @param {string} route - e.g. 'hub' or 'pdf-merge'
     */
    navigate(route) {
        if (route === 'hub' || !route) {
            window.location.hash = 'hub';
        } else {
            window.location.hash = route;
        }
    }

    /**
     * Initial execution when application mounts.
     */
    start() {
        this.handleHashChange();
    }
}
