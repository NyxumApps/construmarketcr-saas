import { createRoot } from 'react-dom/client';

import App from './App';

if (import.meta.env.VITE_E2E_MODE === 'true') {
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    let url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!url.startsWith('/api') && !url.startsWith(`${window.location.origin}/api`)) {
      return nativeFetch(input, init);
    }
    const method = (init.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const relativeUrl = url.startsWith(window.location.origin)
      ? url.slice(window.location.origin.length)
      : url;
    if (
      method === 'GET' &&
      (
        relativeUrl === '/api/plans' ||
        relativeUrl.startsWith('/api/plans?') ||
        /^\/api\/admin\/(professionals|plans|interests)(?:\?|$)/.test(relativeUrl)
      )
    ) {
      const parsed = new URL(url, window.location.origin);
      parsed.searchParams.set('includeSynthetic', 'true');
      url = url.startsWith(window.location.origin)
        ? parsed.href
        : `${parsed.pathname}${parsed.search}`;
      input = url;
    }
    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    const userId = window.localStorage.getItem('construmarket-e2e-user');
    if (userId) headers.set('x-test-clerk-user-id', userId);
    return nativeFetch(input, { ...init, headers });
  };
}
import { ErrorBoundary } from '@/components/error-boundary';

import './index.css';

createRoot(document.getElementById('root')!, {
  // Keeps caught errors off reportError(), which would raise the dev overlay.
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
