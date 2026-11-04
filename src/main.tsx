import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import CiamCallback from './pages/CiamCallback.tsx'

// Must match the path of the redirect_uri registered with CIAM
const CALLBACK_PATH = '/auth'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {window.location.pathname === CALLBACK_PATH ? <CiamCallback /> : <App />}
  </StrictMode>,
)
