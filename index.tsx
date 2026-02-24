import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css'; // Import consolidated CSS tokens and styles
import { DataProvider } from './contexts/DataContext'; // adjust path if needed


const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}


const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <DataProvider>
      <App />
    </DataProvider>
  </React.StrictMode>
);
