import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import ErrorBoundary from '@/components/ErrorBoundary'
import { installNativeAuthDeepLinks } from '@/lib/capacitor-auth'
import { applyTheme, getStoredTheme, setStoredTheme } from '@/lib/theme'
import '@/index.css'

// Restore charcoal dark as the default OS look (one-time after light redesign).
try {
  if (!localStorage.getItem("titanos-theme-dark-restore")) {
    setStoredTheme("dark");
    localStorage.setItem("titanos-theme-dark-restore", "1");
  }
} catch {
  /* ignore */
}

applyTheme(getStoredTheme());
installNativeAuthDeepLinks();

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary message="The app failed to load." fullScreen showHome>
    <App />
  </ErrorBoundary>
)
