import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import ErrorBoundary from '@/components/ErrorBoundary'
import { installNativeAuthDeepLinks } from '@/lib/capacitor-auth'
import { applyTheme, getStoredTheme } from '@/lib/theme'
import '@/index.css'

applyTheme(getStoredTheme())
installNativeAuthDeepLinks()

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary message="The app failed to load." fullScreen showHome>
    <App />
  </ErrorBoundary>
)
