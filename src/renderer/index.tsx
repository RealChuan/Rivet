import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.js'
import { ErrorBoundary } from './components/common/ErrorBoundary.js'
import './sentry.js'
import './i18n/config.js'

import '@fontsource-variable/geist/wght.css'
import '@fontsource-variable/geist-mono/wght.css'
import './styles/index.css'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element not found')
}
ReactDOM.createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
