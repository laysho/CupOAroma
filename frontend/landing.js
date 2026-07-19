/* ===== Cup O'Aroma — Landing / sign-in gate =====
   Runs ONLY on the landing page (index.html). The shop (shop.html) is gated
   by app.js: it redirects here unless sessionStorage 'cupGate' === 'open'.

   ----------------------------------------------------------------------
   REAL OAUTH (no extra libraries needed):
   Paste your credentials below. When BOTH are present the buttons perform
   a real Google / Facebook OAuth popup-less redirect sign-in. Until then
   the page runs in DEMO mode: clicking a provider simulates a sign-in so
   the flow is fully clickable and the rest of the site works end-to-end.

     Google:    https://console.cloud.google.com/apis/credentials
                → OAuth 2.0 Client ID (Web application)
                → Authorized redirect URI must include this page URL
                → Scopes: email, profile
     Facebook:  https://developers.facebook.com/apps
                → Add "Facebook Login" (Web)
                → Valid OAuth Redirect URIs must include this page URL
                → Permissions: email, public_profile
   ---------------------------------------------------------------------- */
const COA_AUTH = {
  googleClientId: '',   // e.g. '1234567890-abc.apps.googleusercontent.com'
  facebookAppId: '',    // e.g. '123456789012345'
};

const REAL_MODE = !!(COA_AUTH.googleClientId && COA_AUTH.facebookAppId);
const REDIRECT_URI = location.origin + location.pathname;

/* ---------- Theme (shared look with the shop) ---------- */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const btn = document.getElementById('themeBtn');
  if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
}
function initTheme() {
  let saved;
  try { saved = localStorage.getItem('cupTheme'); } catch (e) {}
  if (!saved) {
    saved = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
  }
  applyTheme(saved);
}
const themeBtn = document.getElementById('themeBtn');
if (themeBtn) {
  themeBtn.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try { localStorage.setItem('cupTheme', next); } catch (e) {}
  });
}

/* ---------- Gate / navigation ---------- */
function goToShop() {
  try { sessionStorage.setItem('cupGate', 'open'); } catch (e) {}
  location.replace('shop.html');
}
function rememberUser(provider, name) {
  try {
    sessionStorage.setItem('cupUser', JSON.stringify({ provider, name: name || provider, t: Date.now() }));
  } catch (e) {}
}
function toast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 1800);
}

/* ---------- DEMO sign-in (works with no credentials) ---------- */
function demoSignIn(provider) {
  rememberUser(provider, provider === 'Google' ? 'Google User' : provider === 'Facebook' ? 'Facebook User' : 'Guest');
  toast('Signed in with ' + provider + ' ✨');
  setTimeout(goToShop, 450);
}

/* ---------- REAL OAuth (active only when both IDs are filled in) ---------- */
function realGoogle() {
  const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
    client_id: COA_AUTH.googleClientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'token',
    scope: 'email profile',
    state: 'coa',
  }).toString();
  location.href = url;
}
function realFacebook() {
  const url = 'https://www.facebook.com/v19.0/dialog/oauth?' + new URLSearchParams({
    client_id: COA_AUTH.facebookAppId,
    redirect_uri: REDIRECT_URI,
    response_type: 'token',
    scope: 'email,public_profile',
    state: 'coa',
  }).toString();
  location.href = url;
}
// When OAuth redirects back, the access token lands in the URL hash.
function handleOAuthReturn() {
  if (!location.hash.includes('access_token')) return false;
  const params = new URLSearchParams(location.hash.slice(1));
  const token = params.get('access_token');
  const provider = location.href.includes('facebook') ? 'Facebook' : 'Google';
  if (token) rememberUser(provider, provider + ' User');
  // clean the hash so it isn't echoed in the address bar
  history.replaceState(null, '', location.pathname);
  goToShop();
  return true;
}

/* ---------- Wire up buttons ---------- */
function signIn(provider) {
  if (REAL_MODE) {
    if (provider === 'Google') return realGoogle();
    if (provider === 'Facebook') return realFacebook();
  }
  demoSignIn(provider); // demo / guest path
}

document.querySelectorAll('[data-auth]').forEach((btn) => {
  btn.addEventListener('click', () => signIn(btn.getAttribute('data-auth')));
});

/* ---------- Boot ---------- */
initTheme();
if (!handleOAuthReturn()) {
  // If already signed in this session, offer a quick re-entry.
  let gated = false;
  try { gated = sessionStorage.getItem('cupGate') === 'open'; } catch (e) {}
  const enter = document.getElementById('enterShop');
  if (gated && enter) {
    document.getElementById('authBlock').style.display = 'none';
    document.getElementById('signedIn').style.display = 'block';
  }
}
