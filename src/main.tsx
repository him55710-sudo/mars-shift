import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import WorkspaceBoundary from './WorkspaceBoundary';
import './design-system.css';
import './workspace-shell.css';

createRoot(document.getElementById('root')!).render(<React.StrictMode><WorkspaceBoundary><App/></WorkspaceBoundary></React.StrictMode>);
