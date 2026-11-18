import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { installSecureFetch } from './secureFetch.ts'
import { AppFeedbackProvider } from './components/AppFeedback.tsx'

installSecureFetch()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppFeedbackProvider>
      <App />
    </AppFeedbackProvider>
  </StrictMode>,
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.error('Service worker registration failed:', error);
    });
  });
}
