import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import CookieConsent from './CookieConsent.jsx';
import './styles.css';
import './redesign-v110.css';
import './visual-refresh-v113.css';
import './pro-polish-v118.css';
import './notifications-dropdown-v152.css';
import './mobile-fixes-v152.css';
import './admin-redesign-v160.css';
import './search-redesign-v170.css';
import './responsive-fixes-v171.css';
import './responsive-fixes-v174.css';
import './responsive-fixes-v176.css';
import './responsive-fixes-v177.css';
import './responsive-fixes-v178.css';
import './responsive-fixes-v179-scroll-mobile.css';
import './responsive-fixes-v180-carte-profil.css';
import './responsive-fixes-v181-messagerie.css';
import './responsive-fixes-v182-messagerie-design.css';
import './responsive-fixes-v183-messagerie-hub.css';
import './responsive-fixes-v184-hub-bugs.css';
import './responsive-fixes-v185-drawer-center.css';
import './responsive-fixes-v186-media-fullscreen.css';
import './responsive-fixes-v187-profil-instagram.css';
import './responsive-fixes-v188-monespace-instagram.css';

function escapeBootHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  }[char]));
}

function renderBootError(error) {
  const root = document.getElementById('root');
  if (!root) return;
  root.innerHTML = `
    <main style="min-height:100vh;display:grid;place-items:center;padding:24px;background:#10070f;color:#fff8ef;font-family:system-ui,-apple-system,Segoe UI,sans-serif;">
      <section style="max-width:680px;border:1px solid rgba(255,255,255,.18);border-radius:24px;padding:24px;background:rgba(255,255,255,.08);">
        <p style="margin:0 0 8px;color:#ff8fc5;font-weight:800;letter-spacing:.12em;text-transform:uppercase;">Erreur frontend</p>
        <h1 style="margin:0 0 12px;font-size:28px;">La page n’a pas pu se charger.</h1>
        <p style="line-height:1.6;color:#cbbac7;">Faites Ctrl+F5 pour vider le cache. Si le problème continue, ouvrez la console navigateur et copiez l’erreur affichée.</p>
        <pre style="white-space:pre-wrap;overflow:auto;max-height:180px;background:rgba(0,0,0,.32);padding:12px;border-radius:12px;">${escapeBootHtml(error?.message || error || 'Erreur inconnue')}</pre>
      </section>
    </main>`;
}

class RootErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error('[frontend]', error);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="center-screen">
          <h2>Erreur frontend</h2>
          <p>La page n’a pas pu se charger. Faites Ctrl+F5 puis réessayez.</p>
          <button type="button" className="primary-btn" onClick={() => window.location.reload()}>Recharger</button>
        </main>
      );
    }
    return this.props.children;
  }
}

window.addEventListener('error', (event) => {
  if (!document.getElementById('root')?.hasChildNodes()) renderBootError(event.error || event.message);
});
window.addEventListener('unhandledrejection', (event) => {
  if (!document.getElementById('root')?.hasChildNodes()) renderBootError(event.reason);
});

try {
  createRoot(document.getElementById('root')).render(
    <RootErrorBoundary>
      <App />
      <CookieConsent />
    </RootErrorBoundary>
  );
} catch (error) {
  renderBootError(error);
}

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
      .then((registration) => registration.update().catch(() => {}))
      .catch(() => {});
  });
}
