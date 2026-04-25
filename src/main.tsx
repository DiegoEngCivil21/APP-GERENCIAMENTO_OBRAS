import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Suppress benign Vite WebSocket errors in this environment
const suppressViteErrors = (event: ErrorEvent | PromiseRejectionEvent) => {
  const message = 'message' in event ? event.message : (event.reason?.message || '');
  if (message.toLowerCase().includes('websocket') || message.toLowerCase().includes('vite')) {
    event.preventDefault();
    event.stopPropagation();
    return true;
  }
  return false;
};

window.addEventListener('error', suppressViteErrors, true);
window.addEventListener('unhandledrejection', suppressViteErrors);

// Fetch Interceptor for Auth
const originalFetch = window.fetch;
const customFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const token = localStorage.getItem('auth_token');
  const newInit = { ...init };
  
  if (token) {
    const headers = new Headers(newInit.headers || {});
    if (!headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    newInit.headers = headers;
  }
  
  // Always include credentials for cookies
  newInit.credentials = newInit.credentials || 'include';
  
  try {
    const response = await originalFetch(input, newInit);
    
    const url = typeof input === 'string' ? input : (input as Request).url;
    // Don't trigger unauthorized on login attempts that fail
    if (response.status === 401 && !url.includes('/api/auth/login')) {
      localStorage.removeItem('auth_token');
      window.dispatchEvent(new CustomEvent('auth-unauthorized'));
    }
    
    return response;
  } catch (error) {
    throw error;
  }
};

try {
  // Try direct assignment first
  (window as any).fetch = customFetch;
} catch (e) {
  // If direct assignment fails (read-only getter), use defineProperty
  Object.defineProperty(window, 'fetch', {
    value: customFetch,
    configurable: true,
    writable: true,
    enumerable: true
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
