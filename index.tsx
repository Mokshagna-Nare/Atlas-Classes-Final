import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './theme.css'; // Colour variables for the dark and light themes
import './styles.css'; // Import consolidated CSS tokens and styles
import { ThemeProvider } from './contexts/ThemeContext';
import { DataProvider } from './contexts/DataContext'; // adjust path if needed
import { completeAuthRedirect } from './services/authRedirect';


const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}


const root = ReactDOM.createRoot(rootElement);
// Finish a Google / password-reset return first, so the app starts on the right screen.
completeAuthRedirect().finally(() => {
  root.render(
    <React.StrictMode>
      <ThemeProvider>
        <DataProvider>
          <App />
        </DataProvider>
      </ThemeProvider>
    </React.StrictMode>
  );
});
