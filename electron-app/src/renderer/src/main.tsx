import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'
import { ThemeProvider } from './hooks/use-theme'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
      <Toaster
        position="bottom-right"
        theme="dark"
        toastOptions={{
          style: { background: '#1f2023', border: '1px solid #2e3033', color: '#f4f4f5' },
        }}
      />
    </ThemeProvider>
  </StrictMode>
)
