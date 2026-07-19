/* ===== Cup O'Aroma — Landing / sign-in gate =====
   Runs ONLY on the landing page (index.html). The shop (shop.html) is gated
   by app.js: it redirects here unless sessionStorage 'cupGate' === 'open'.

   ----------------------------------------------------------------------
   REAL OAUTH ONLY (no demo mode, no guest):
   The "Continue with Google" button performs a real Google OAuth redirect
   sign-in (Implicit flow). Without a Client ID it shows a "not configured"
   hint instead of signing in.

     Google:    https://console.cloud.google.com/apis/credentials
                → OAuth 2.0 Client ID (Web application)
                → Authorized redirect URI must include this page URL
                → Scopes: email, profile
   ---------------------------------------------------------------------- */
const COA_AUTH = {
  googleClientId: '558724368617-4m9hi5si66j23us6obb2pqcsjtg4lefq.apps.googleusercontent.com',
};

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
function rememberUser(provider, name, email, picture) {
  try {
    sessionStorage.setItem('cupUser', JSON.stringify({
      provider,
      name: name || provider,
      email: email || '',
      picture: picture || '',
      t: Date.now(),
    }));
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

/* ---------- REAL OAuth (active when that provider's ID is filled in) ---------- */
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
// After OAuth redirect, exchange the hash token for the user's profile.
async function googleProfile(token) {
  try {
    const r = await fetch('https://www.googleapis.com/o/oauth2/v3/userinfo', {
      headers: { Authorization: 'Bearer ' + token },
    });
    if (!r.ok) return null;
    const d = await r.json();
    return { provider: 'Google', name: d.name || 'Google User', email: d.email || '', picture: d.picture || '' };
  } catch (e) { return null; }
}

// When OAuth redirects back, the access token lands in the URL hash.
async function handleOAuthReturn() {
  if (!location.hash.includes('access_token')) return false;
  const params = new URLSearchParams(location.hash.slice(1));
  const token = params.get('access_token');
  let info = { provider: 'Google', name: 'Google User', email: '', picture: '' };
  if (token) {
    const prof = await googleProfile(token);
    if (prof) info = prof;
    rememberUser(info.provider, info.name, info.email, info.picture);
  }
  // clean the hash so the token isn't echoed in the address bar
  history.replaceState(null, '', location.pathname);
  goToShop();
  return true;
}

/* ---------- Wire up buttons ---------- */
function realFor(provider) {
  if (provider === 'Google') return !!COA_AUTH.googleClientId;
  return false;
}
function signIn(provider) {
  if (realFor(provider)) {
    if (provider === 'Google') return realGoogle();
  }
  toast('Sign-in with ' + provider + ' isn’t set up yet — add your Google Client ID in landing.js.');
}

document.querySelectorAll('[data-auth]').forEach((btn) => {
  btn.addEventListener('click', () => signIn(btn.getAttribute('data-auth')));
});

/* ---------- Boot ---------- */
initTheme();
handleOAuthReturn().then((ok) => {
  if (ok) return; // navigated into the shop
  // If already signed in this session, offer a quick re-entry.
  let gated = false;
  try { gated = sessionStorage.getItem('cupGate') === 'open'; } catch (e) {}
  const enter = document.getElementById('enterShop');
  if (gated && enter) {
    document.getElementById('authBlock').style.display = 'none';
    document.getElementById('signedIn').style.display = 'block';
    try {
      const u = JSON.parse(sessionStorage.getItem('cupUser') || 'null');
      const m = document.querySelector('#signedIn .signed-msg');
      if (u && m) m.textContent = 'Welcome back, ' + (u.name || u.provider) + ' 🌸';
    } catch (e) {}
  }
});
