import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import App from './App.tsx'
import { queryClient } from './lib/query-client'
import { followSystemTheme } from './lib/theme'

import './index.css'

// "System" theme tracks the device switching between light and dark while the app is open.
followSystemTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
