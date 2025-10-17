import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

/**
 * Application entry point
 * 
 * Initializes the React application with StrictMode for development checks
 * and renders the root App component into the DOM.
 * 
 * @remarks
 * - Uses React 18's createRoot API for concurrent features
 * - StrictMode enables additional development checks and warnings
 * - Logs initialization errors to console for debugging
 * 
 * @see https://react.dev/reference/react-dom/client/createRoot
 */

const rootElement = document.getElementById('root');

if (!rootElement) {
  const errorMessage = 'Failed to find root element. Ensure index.html contains <div id="root"></div>';
  console.error('[App Initialization Error]', errorMessage);
  
  // Display user-friendly error message
  document.body.innerHTML = `
    <div style="
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 2rem;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
      background-color: #f5f5f5;
    ">
      <div style="
        max-width: 500px;
        padding: 2rem;
        background: white;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      ">
        <h1 style="color: #d32f2f; margin: 0 0 1rem 0; font-size: 1.5rem;">
          Application Error
        </h1>
        <p style="color: #424242; margin: 0 0 1rem 0; line-height: 1.5;">
          ${errorMessage}
        </p>
        <p style="color: #757575; margin: 0; font-size: 0.875rem;">
          Please contact support if this issue persists.
        </p>
      </div>
    </div>
  `;
  
  throw new Error(errorMessage);
}

try {
  const root = ReactDOM.createRoot(rootElement);
  
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  
  // Log successful initialization in development
  if (import.meta.env.DEV) {
    console.log('[App Initialized]', {
      mode: import.meta.env.MODE,
      timestamp: new Date().toISOString(),
      reactVersion: React.version,
    });
  }
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
  
  console.error('[App Render Error]', {
    error: errorMessage,
    stack: error instanceof Error ? error.stack : undefined,
    timestamp: new Date().toISOString(),
  });
  
  // Display user-friendly error message
  rootElement.innerHTML = `
    <div style="
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 2rem;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
      background-color: #f5f5f5;
    ">
      <div style="
        max-width: 500px;
        padding: 2rem;
        background: white;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      ">
        <h1 style="color: #d32f2f; margin: 0 0 1rem 0; font-size: 1.5rem;">
          Failed to Start Application
        </h1>
        <p style="color: #424242; margin: 0 0 1rem 0; line-height: 1.5;">
          An error occurred while initializing the application. Please refresh the page to try again.
        </p>
        <details style="margin: 1rem 0 0 0;">
          <summary style="color: #757575; cursor: pointer; font-size: 0.875rem;">
            Technical Details
          </summary>
          <pre style="
            margin: 0.5rem 0 0 0;
            padding: 1rem;
            background: #f5f5f5;
            border-radius: 4px;
            overflow-x: auto;
            font-size: 0.75rem;
            color: #424242;
          ">${errorMessage}</pre>
        </details>
        <button
          onclick="window.location.reload()"
          style="
            margin-top: 1.5rem;
            padding: 0.75rem 1.5rem;
            background: #1976d2;
            color: white;
            border: none;
            border-radius: 4px;
            font-size: 1rem;
            cursor: pointer;
            font-family: inherit;
          "
          onmouseover="this.style.background='#1565c0'"
          onmouseout="this.style.background='#1976d2'"
        >
          Reload Application
        </button>
      </div>
    </div>
  `;
  
  throw error;
}

// Enable hot module replacement in development
if (import.meta.hot) {
  import.meta.hot.accept();
}