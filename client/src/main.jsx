import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Text fonts, self-hosted: only the weights the theme uses, Latin only (font-display: swap)
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/inter/latin-700.css'
import '@fontsource/geist/latin-400.css'
import '@fontsource/geist/latin-500.css'
import '@fontsource/geist/latin-600.css'
import '@fontsource/geist/latin-700.css'
import './index.css'
import App from './App.jsx'
import { loadCatalog } from './stores/catalog'

// Branch names, institutes and the university: fetched alongside the first page's own requests
loadCatalog()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
