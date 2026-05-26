import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.js'
import './sentry.js'
import './styles/index.css'
import './i18n/config.js'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element not found')
}
ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
