import { writable } from 'svelte/store';
import { browser } from '$app/environment';

interface User {
    id: string;
    email: string;
    role: string;
}

interface AuthState {
    token: string | null;
    user: User | null;
    isAuthenticated: boolean;
}

const initialState: AuthState = {
    token: null,
    user: null,
    isAuthenticated: false,
};

// Persist to localStorage
const storedAuth = browser ? localStorage.getItem('auth') : null;
const initial = storedAuth ? JSON.parse(storedAuth) : initialState;

export const auth = writable<AuthState>(initial);

if (browser) {
    auth.subscribe((value) => {
        if (value.isAuthenticated) {
            localStorage.setItem('auth', JSON.stringify(value));
        } else {
            localStorage.removeItem('auth');
        }
    });
}

export const logout = () => {
    auth.set(initialState);
    if (browser) window.location.href = '/login';
}
