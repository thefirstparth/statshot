import { render } from 'preact';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app';
import './render/fonts';
import './styles.css';

render(<App />, document.getElementById('app')!);

// Precache the app shell so it works offline after the first visit.
if ('serviceWorker' in navigator) registerSW({ immediate: true });
