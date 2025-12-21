import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		allowedHosts: true,
		proxy: {
			'/auth': {
				target: 'http://localhost:3000',
				changeOrigin: true,
				secure: false,
			},
			'/deploy': {
				target: 'http://localhost:3000',
				changeOrigin: true,
				secure: false,
			},
			'/apps': {
				target: 'http://localhost:3000',
				changeOrigin: true,
				secure: false,
			},
			'/admin': {
				target: 'http://localhost:3000',
				changeOrigin: true,
				secure: false,
			},
			'/events': {
				target: 'http://localhost:3000',
				changeOrigin: true,
				secure: false,
			}
		}
	}
});
