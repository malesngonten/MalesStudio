import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import '@fontsource/plus-jakarta-sans/400.css';
import '@fontsource/plus-jakarta-sans/500.css';
import '@fontsource/plus-jakarta-sans/600.css';
import '@fontsource/plus-jakarta-sans/700.css';
import './index.css';
import { initViewportZoomLock } from './utils/viewportZoomLock';

// Lock browser page zoom globally while preserving Remotion Player zoom gestures
initViewportZoomLock();

createRoot(document.getElementById('root')!).render(<App />);
