import { useEffect, useState } from 'react';

// Consentement cookies RGPD — version du texte (incrémenter si la politique change → redemande le consentement)
const COOKIE_CONSENT_KEY = 'voluptia_cookie_consent_v1';

function readConsent() {
  try {
    const raw = localStorage.getItem(COOKIE_CONSENT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function writeConsent(consent) {
  try {
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify({ ...consent, at: new Date().toISOString() }));
    // Permet à d'autres scripts (mesure d'audience, etc.) de réagir au choix.
    window.dispatchEvent(new CustomEvent('voluptia:cookie-consent', { detail: consent }));
  } catch {}
}

// Ouvre la fenêtre de préférences depuis n'importe où :
// window.dispatchEvent(new Event('voluptia:open-cookie-preferences'))
export default function CookieConsent() {
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState(false);
  const [analytics, setAnalytics] = useState(false);

  useEffect(() => {
    const existing = readConsent();
    if (!existing) setOpen(true);
    else setAnalytics(Boolean(existing.analytics));
    const reopen = () => { const c = readConsent(); setAnalytics(Boolean(c?.analytics)); setDetails(true); setOpen(true); };
    window.addEventListener('voluptia:open-cookie-preferences', reopen);
    return () => window.removeEventListener('voluptia:open-cookie-preferences', reopen);
  }, []);

  function decide(consent) {
    writeConsent({ necessary: true, analytics: Boolean(consent.analytics) });
    setOpen(false);
    setDetails(false);
  }

  if (!open) return null;

  return (
    <div className="cookie-consent-v1" role="dialog" aria-live="polite" aria-label="Consentement aux cookies">
      <div className="cookie-consent-card-v1">
        <div className="cookie-consent-body-v1">
          <strong>🍪 Cookies &amp; vie privée</strong>
          <p>
            Nous utilisons des cookies strictement nécessaires au fonctionnement du site (session, sécurité, choix d’affichage).
            Vous pouvez accepter ou refuser les cookies de mesure d’audience facultatifs. Détails sur la page{' '}
            <a href="/cookies">Cookies</a> et{' '}
            <a href="/confidentialite-donnees">Confidentialité</a>.
          </p>

          {details ? (
            <div className="cookie-consent-options-v1">
              <label className="cookie-consent-row-v1 is-locked">
                <span><strong>Nécessaires</strong><small>Indispensables au service — toujours actifs.</small></span>
                <input type="checkbox" checked readOnly disabled />
              </label>
              <label className="cookie-consent-row-v1">
                <span><strong>Mesure d’audience</strong><small>Statistiques anonymisées pour améliorer le site (facultatif).</small></span>
                <input type="checkbox" checked={analytics} onChange={(e) => setAnalytics(e.target.checked)} />
              </label>
            </div>
          ) : null}
        </div>

        <div className="cookie-consent-actions-v1">
          {details ? (
            <button type="button" className="cookie-btn-v1 primary" onClick={() => decide({ analytics })}>Enregistrer mes choix</button>
          ) : (
            <>
              <button type="button" className="cookie-btn-v1 ghost" onClick={() => setDetails(true)}>Personnaliser</button>
              <button type="button" className="cookie-btn-v1 ghost" onClick={() => decide({ analytics: false })}>Tout refuser</button>
              <button type="button" className="cookie-btn-v1 primary" onClick={() => decide({ analytics: true })}>Tout accepter</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
