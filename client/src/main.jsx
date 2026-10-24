import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
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
