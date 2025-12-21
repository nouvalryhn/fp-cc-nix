import type { Handle } from '@sveltejs/kit';

const API_URL = process.env.INTERNAL_API_URL || 'http://api:3000';

export const handle: Handle = async ({ event, resolve }) => {
    // Proxy API requests to the backend
    const apiPaths = ['/auth', '/deploy', '/apps', '/admin', '/events'];
    const shouldProxy = apiPaths.some(path => event.url.pathname.startsWith(path));
    
    if (shouldProxy) {
        const apiUrl = `${API_URL}${event.url.pathname}${event.url.search}`;
        
        try {
            return await fetch(apiUrl, {
                method: event.request.method,
                headers: event.request.headers,
                body: event.request.body,
                // @ts-ignore
                duplex: 'half'
            });
        } catch (error) {
            console.error('Proxy error:', error);
            return new Response('API unavailable', { status: 503 });
        }
    }

    return resolve(event);
};
