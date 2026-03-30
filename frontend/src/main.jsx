import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: 'rgba(20, 20, 26, 0.95)',
            backdropFilter: 'blur(12px)',
            color: '#e4e4e7',
            border: '1px solid rgba(139, 61, 175, 0.3)',
            borderRadius: '8px',
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: '0.9rem',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#0a0a0f',
            },
          },
          error: {
            iconTheme: {
              primary: '#dc2626',
              secondary: '#0a0a0f',
            },
          },
        }}
      />
    </BrowserRouter>
  </React.StrictMode>
);
