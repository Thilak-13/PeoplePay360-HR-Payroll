import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Global Fetch Interceptor to automatically attach Authorization Bearer token to all /api/ requests
const originalFetch = window.fetch;
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const token = localStorage.getItem('peoplepay360_token') || sessionStorage.getItem('peoplepay360_token');
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

  if (token && (url.startsWith('/api/') || url.includes('/api/v1/'))) {
    const defaultInit = init || {};
    const headers = new Headers(defaultInit.headers || {});
    if (!headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return originalFetch(input, { ...defaultInit, headers });
  }
  return originalFetch(input, init);
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
