/* ===== Cup O'Aroma — frontend wired to backend API ===== */
const PESO = '₱';
const SERVICE_RATE = 0.05;

let cart = [];            // { id, name, price, qty, emoji }
let pending = null;       // product waiting for qty choice
let pendingQty = 1;
let menu = { coffee: [], pastries: [] };

const $ = (sel) => document.querySelector(sel);
const on = (sel, ev, fn) => { const el = $(sel); if (el) el.addEventListener(ev, fn); };
const fmt = (n) => PESO + Number(n).toLocaleString('en-PH', { maximumFractionDigits: 2 });

const findItem = (id) => cart.find((c) => c.id === id);
const saveCart = () => { try { localStorage.setItem('cupCart', JSON.stringify(cart)); } catch (e) {} };
const loadCart = () => { try { const s = localStorage.getItem('cupCart'); if (s) cart = JSON.parse(s); } catch (e) {} };

/* ---------- Quantity picker ---------- */
function openQty(card) {
  pending = {
    id: card.dataset.id,
    name: card.dataset.name,
    price: Number(card.dataset.price),
    emoji: card.dataset.emoji,
  };
  pendingQty = 1;
  $('#qtyEmoji').textContent = pending.emoji;
  $('#qtyName').textContent = pending.name;
  $('#qtyPrice').textContent = fmt(pending.price);
  $('#qtyNum').textContent = pendingQty;
  $('#qtyModal').classList.add('show');
  $('#qtyModal').setAttribute('aria-hidden', 'false');
}
function closeQty() {
  $('#qtyModal').classList.remove('show');
  $('#qtyModal').setAttribute('aria-hidden', 'true');
  pending = null;
}
function setPendingQty(n) {
  pendingQty = Math.max(1, n);
  $('#qtyNum').textContent = pendingQty;
}

/* ---------- Cart ops ---------- */
function addToCart(id, name, price, emoji, qty = 1) {
  const existing = findItem(id);
  if (existing) existing.qty += qty;
  else cart.push({ id, name, price: Number(price), qty, emoji });
  saveCart();
  renderCart();
  bumpCount();
  toast(`${qty}× ${name} added 🛒`);
}
function changeQty(id, delta) {
  const item = findItem(id);
  if (!item) return;
  if (delta < 0 && item.qty + delta <= 0) {
    // Would drop to 0 → confirm before removing
    askConfirm(`Remove ${item.name} from your cart?`, () => {
      cart = cart.filter((c) => c.id !== id);
      saveCart(); renderCart(); bumpCount();
      toast(`${item.name} removed 🗑`);
    });
    return;
  }
  item.qty += delta;
  saveCart(); renderCart(); bumpCount();
}
const cartCount = () => cart.reduce((s, c) => s + c.qty, 0);
const cartSubtotal = () => cart.reduce((s, c) => s + c.price * c.qty, 0);

function bumpCount() {
  const el = $('#cartCount');
  el.textContent = cartCount();
  el.classList.toggle('show', cartCount() > 0);
}

/* ---------- Render cart drawer (side panel) ---------- */
function renderCart() {
  const wrap = $('#cartItems');
  wrap.innerHTML = '';

  if (cart.length === 0) {
    wrap.innerHTML = '<p class="cart-empty">Your cart is empty. Add something tasty ☕</p>';
  } else {
    cart.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'cart-row';
      row.innerHTML = `
        <div class="cart-emoji">${item.emoji}</div>
        <div class="cart-info">
          <strong>${item.name}</strong>
          <span class="cart-price">${fmt(item.price)}</span>
        </div>
        <div class="qty-control">
          <button data-act="dec" data-id="${item.id}" aria-label="Decrease">−</button>
          <span>${item.qty}</span>
          <button data-act="inc" data-id="${item.id}" aria-label="Increase">+</button>
        </div>
        <div class="cart-line">${fmt(item.price * item.qty)}</div>
        <button class="cart-del" data-del="${item.id}" aria-label="Remove item" title="Remove">🗑</button>`;
      wrap.appendChild(row);
    });
  }

  $('#cartTotal').textContent = fmt(cartSubtotal());
  $('#checkoutBtn').disabled = cart.length === 0;
}

/* ---------- Drawer open/close ---------- */
function openCart() {
  $('#cartDrawer').classList.add('open');
  $('#overlay').classList.add('show');
  $('#cartDrawer').setAttribute('aria-hidden', 'false');
}
function closeCart() {
  $('#cartDrawer').classList.remove('open');
  $('#overlay').classList.remove('show');
  $('#cartDrawer').setAttribute('aria-hidden', 'true');
}

/* ---------- Checkout (billing + delivery + payment) ---------- */
function openCheckout() {
  if (cart.length === 0) return;
  closeCart();
  renderCheckout();
  $('#checkoutModal').classList.add('show');
  $('#checkoutModal').setAttribute('aria-hidden', 'false');
}
function closeCheckout() {
  $('#checkoutModal').classList.remove('show');
  $('#checkoutModal').setAttribute('aria-hidden', 'true');
}
function renderCheckout() {
  const sum = $('#checkoutSummary');
  sum.innerHTML = '';
  cart.forEach((item) => {
    const line = document.createElement('div');
    line.className = 'summary-row';
    line.innerHTML = `<span>${item.emoji} ${item.name} ×${item.qty}</span><span>${fmt(item.price * item.qty)}</span>`;
    sum.appendChild(line);
  });
  $('#checkoutTotal').textContent = fmt(cartSubtotal());
}

/* ---------- Place order → send to backend → receipt ---------- */
async function placeOrder() {
  const form = $('#billingForm');
  if (!form.reportValidity()) return;

  const data = Object.fromEntries(new FormData(form).entries());
  const payload = {
    items: cart.map((c) => ({ id: c.id, qty: c.qty })),
    customer: {
      name: data.name,
      email: data.email,
      mobile: data.mobile,
      address: data.address,
      note: data.note || '',
    },
    payment: data.pay,
  };

  const btn = $('#placeOrderBtn');
  btn.disabled = true;
  btn.textContent = 'Sending…';

  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Server returned ' + res.status);
    const ord = await res.json();

    // Build receipt from server response (server is source of truth for totals)
    $('#receiptMeta').innerHTML = `
      <div><span>Order #</span><strong>${ord.id}</strong></div>
      <div><span>Date</span><strong>${new Date(ord.date).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}</strong></div>
      <div><span>Name</span><strong>${escapeHtml(ord.customer.name)}</strong></div>
      <div><span>Mobile</span><strong>${escapeHtml(ord.customer.mobile)}</strong></div>
      <div><span>Address</span><strong>${escapeHtml(ord.customer.address)}</strong></div>
      ${ord.customer.note ? `<div class="receipt-note-row"><span>Note</span><strong>${escapeHtml(ord.customer.note)}</strong></div>` : ''}`;

    const ri = $('#receiptItems');
    ri.innerHTML = '';
    ord.items.forEach((item) => {
      const r = document.createElement('div');
      r.className = 'receipt-row';
      r.innerHTML = `<span>${item.emoji} ${item.name} ×${item.qty}</span><span>${fmt(item.price * item.qty)}</span>`;
      ri.appendChild(r);
    });

    $('#receiptSubtotal').textContent = fmt(ord.subtotal);
    $('#receiptCharge').textContent = fmt(ord.charge);
    $('#receiptTotal').textContent = fmt(ord.total);
    $('#receiptPay').textContent = 'Paid via: ' + ord.payment;

    const notes = [
      'Your coffee is being brewed with a smile ☕',
      'Good things are brewing just for you 🌷',
      'Made fresh, made with love 💗',
      'A little treat for a bright Cebu day 🌞',
      'Sip slow, stay cozy 🧸',
      'You just made our day sweeter 🍰',
      'Freshly made, coming right up 🌸',
      'Warm hugs in every cup 🤍',
    ];
    $('#receiptNote').textContent = notes[Math.floor(Math.random() * notes.length)];

    closeCheckout();
    $('#receiptModal').classList.add('show');
    $('#receiptModal').setAttribute('aria-hidden', 'false');

    // reset cart + billing after successful order (fresh state)
    cart = [];
    saveCart();
    renderCart();
    bumpCount();
    resetBilling();
  } catch (e) {
    toast('Order failed: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Place Order';
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

/* ---------- Menu rendering from backend ---------- */
function cardHTML(p) {
  return `
    <article class="menu-card" data-id="${p.id}" data-name="${escapeAttr(p.name)}"
             data-price="${p.price}" data-emoji="${p.emoji}">
      <div class="thumb thumb-${p.color || 'pink'}">${p.emoji}</div>
      <h3>${escapeHtml(p.name)}</h3>
      <p>${escapeHtml(p.desc || '')}</p>
      <div class="price-row"><span class="price">${fmt(p.price)}</span><span class="tag">${escapeHtml(p.tag || '')}</span></div>
      <button class="add-btn">Add to cart 🛒</button>
    </article>`;
}
function escapeAttr(str) {
  return String(str).replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
async function loadMenu(retry = 0) {
  try {
    const res = await fetch('/api/menu');
    if (!res.ok) throw new Error('Menu load failed');
    menu = await res.json();
    const bestCoffee = menu.coffee.filter((p) => p.best);
    const bestPastries = menu.pastries.filter((p) => p.best);

    // Main landing page: best sellers + a fading "see full menu" teaser card
    if ($('#coffeeGrid')) {
      $('#coffeeGrid').innerHTML = bestCoffee.map(cardHTML).join('') + teaserCard('fullmenu.html');
      $('#pastriesGrid').innerHTML = bestPastries.map(cardHTML).join('') + teaserCard('fullmenu.html');
    }

    // Full menu page: every item
    if ($('#allCoffeeGrid')) {
      $('#allCoffeeGrid').innerHTML = menu.coffee.map(cardHTML).join('');
      $('#allPastriesGrid').innerHTML = menu.pastries.map(cardHTML).join('');
    }
  } catch (e) {
    if (retry < 3) { setTimeout(() => loadMenu(retry + 1), 800); return; }
    if ($('#coffeeGrid')) {
      $('#coffeeGrid').innerHTML =
        '<p class="cart-empty">Could not load menu. Is the server running? 😕 ' +
        '<button class="btn btn-pill" id="retryMenu">Retry</button></p>';
      const rb = $('#retryMenu');
      if (rb) rb.addEventListener('click', () => loadMenu());
    }
  }
}

function teaserCard(href) {
  return `
    <a class="menu-card teaser-card" href="${href}">
      <div class="thumb thumb-pink teaser-thumb">⋯</div>
      <h3>See Full Menu</h3>
      <p>More brews &amp; bakes waiting for you.</p>
      <div class="price-row"><span class="tag">View all →</span></div>
    </a>`;
}

/* ---------- Misc ---------- */
function resetBilling() {
  const form = $('#billingForm');
  if (form) form.reset();
}
function closeAllModals() {
  closeCheckout();
  $('#receiptModal').classList.remove('show');
  $('#receiptModal').setAttribute('aria-hidden', 'true');
  resetBilling();
}
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
}

/* ---------- Confirm dialog ---------- */
let confirmAction = null;
function askConfirm(message, onConfirm) {
  confirmAction = onConfirm;
  $('#confirmMsg').textContent = message;
  $('#confirmModal').classList.add('show');
  $('#confirmModal').setAttribute('aria-hidden', 'false');
}
function closeConfirm() {
  $('#confirmModal').classList.remove('show');
  $('#confirmModal').setAttribute('aria-hidden', 'true');
  confirmAction = null;
}
on('#confirmOk', 'click', () => {
  const fn = confirmAction;
  closeConfirm();
  if (fn) fn();
});
on('#confirmCancel', 'click', closeConfirm);

/* ---------- Scroll spy (navbar active indicator) ---------- */
const navLinksAll = Array.from(document.querySelectorAll('.nav-links a[data-section]'));
function updateActiveNav() {
  const pos = window.scrollY + 120;
  let current = '';
  ['menu', 'pastries', 'story', 'visit'].forEach((id) => {
    const sec = document.getElementById(id);
    if (sec && sec.offsetTop <= pos) current = id;
  });
  navLinksAll.forEach((a) => a.classList.toggle('active', a.dataset.section === current));
}
window.addEventListener('scroll', updateActiveNav, { passive: true });

/* ---------- Events ---------- */
document.addEventListener('click', (e) => {
  const addBtn = e.target.closest('.add-btn');
  if (addBtn) {
    openQty(addBtn.closest('.menu-card'));
    return;
  }
  const delBtn = e.target.closest('.cart-del');
  if (delBtn) {
    const id = delBtn.dataset.del;
    const it = findItem(id);
    askConfirm(`Remove ${it ? it.name : 'this item'} from your cart?`, () => {
      cart = cart.filter((c) => c.id !== id);
      saveCart(); renderCart(); bumpCount();
      toast(`${it ? it.name : 'Item'} removed 🗑`);
    });
    return;
  }
  const qtyBtn = e.target.closest('.qty-control button');
  if (qtyBtn) {
    changeQty(qtyBtn.dataset.id, qtyBtn.dataset.act === 'inc' ? 1 : -1);
  }
});

on('#qtyMinus', 'click', () => setPendingQty(pendingQty - 1));
on('#qtyPlus', 'click', () => setPendingQty(pendingQty + 1));
on('#qtyConfirm', 'click', () => {
  if (!pending) return;
  addToCart(pending.id, pending.name, pending.price, pending.emoji, pendingQty);
  closeQty();
});
on('#qtyClose', 'click', closeQty);

on('#cartBtn', 'click', openCart);
on('#closeCart', 'click', closeCart);
on('#overlay', 'click', closeCart);
on('#checkoutBtn', 'click', openCheckout);
on('#closeCheckout', 'click', closeCheckout);
on('#backToCart', 'click', () => { closeCheckout(); openCart(); });
on('#placeOrderBtn', 'click', placeOrder);
on('#newOrderBtn', 'click', closeAllModals);
on('#printReceipt', 'click', () => window.print());
on('#receiptExit', 'click', closeAllModals);

const navToggle = $('#navToggle');
const navLinks = $('#navLinks');
if (navToggle) {
  navToggle.addEventListener('click', () => {
    const open = navLinks.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  navLinks.querySelectorAll('a').forEach((a) =>
    a.addEventListener('click', () => {
      navLinks.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    })
  );
}

on('#qtyModal', 'click', (e) => { if (e.target.id === 'qtyModal') closeQty(); });
on('#checkoutModal', 'click', (e) => { if (e.target.id === 'checkoutModal') closeCheckout(); });
on('#receiptModal', 'click', (e) => { if (e.target.id === 'receiptModal') closeAllModals(); });
on('#confirmModal', 'click', (e) => { if (e.target.id === 'confirmModal') closeConfirm(); });

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeCart(); closeQty(); closeCheckout(); closeAllModals(); }
});

/* ---------- Theme (dark mode) ---------- */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const btn = $('#themeBtn');
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
$('#themeBtn').addEventListener('click', () => {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  try { localStorage.setItem('cupTheme', next); } catch (e) {}
});

/* ---------- Init ---------- */
/* Gate: the shop requires a sign-in from the landing page (index.html).
   sessionStorage 'cupGate' === 'open' is set by landing.js on sign-in. */
(function gate() {
  let open = false;
  try { open = sessionStorage.getItem('cupGate') === 'open'; } catch (e) {}
  if (!open) {
    const href = location.pathname;
    if (href.endsWith('shop.html') || href.endsWith('fullmenu.html')) {
      location.replace('index.html');
    }
  }
})();

/* ---------- Signed-in identity + profile dropdown (shop side) ---------- */
function signOut() {
  try { sessionStorage.removeItem('cupGate'); sessionStorage.removeItem('cupUser'); } catch (e) {}
  location.replace('index.html');
}
function initialsOf(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '☕';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
(function setupProfile() {
  let u = null;
  try { u = JSON.parse(sessionStorage.getItem('cupUser') || 'null'); } catch (e) {}
  const menu = document.getElementById('profileMenu');
  if (!u || !menu) return;
  menu.style.display = 'inline-flex';
  const name = (u.name && u.name.trim()) || (u.email && u.email.includes('@') ? u.email.split('@')[0] : '') || 'You';
  const avatar = document.getElementById('profileAvatar');
  const greeting = document.getElementById('profileGreeting');
  const nameEl = document.getElementById('profileName');
  const dropdown = document.getElementById('profileDropdown');
  const so = document.getElementById('signOutBtn');
  if (avatar) { avatar.textContent = initialsOf(name); avatar.title = name; }
  if (greeting) greeting.textContent = 'Hi, ' + name;
  if (nameEl) nameEl.textContent = 'Hi, ' + name;
  if (so) so.addEventListener('click', signOut);
  if (avatar && dropdown) {
    avatar.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = dropdown.classList.toggle('open');
      avatar.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.addEventListener('click', (e) => {
      if (!menu.contains(e.target)) {
        dropdown.classList.remove('open');
        avatar.setAttribute('aria-expanded', 'false');
      }
    });
  }
})();

initTheme();
loadCart();
renderCart();
bumpCount();
loadMenu();
