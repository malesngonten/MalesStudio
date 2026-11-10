import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initViewportZoomLock } from './utils/viewportZoomLock';

// Lock browser page zoom globally while preserving Remotion Player zoom gestures
initViewportZoomLock();

createRoot(document.getElementById('root')!).render(<App />);
