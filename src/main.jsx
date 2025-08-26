import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/theme.css'
import './styles/appui.css'
import App from './App.jsx'
import { AppKitProvider } from '@reown/appkit/react';
import { appKit } from './AppKit.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppKitProvider appKit={appKit}>
      <App />
    </AppKitProvider>
  </StrictMode>,
);
