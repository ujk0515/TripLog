import React from 'react';
import * as ReactDOM from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import './styles/index.css';
import App from './App';
import { Router } from './contexts/RouterContext';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  React.createElement(Router, null,
    React.createElement(AuthProvider, null,
      React.createElement(ToastProvider, null,
        React.createElement(App)
      )
    )
  )
);
