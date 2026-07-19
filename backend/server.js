/* ===== Cup O'Aroma — Backend (Node http, no external deps) ===== */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'frontend'); // serve website from /frontend
const DATA = path.join(__dirname, 'data');            // store data in /backend/data
const MENU_FILE = path.join(DATA, 'menu.json');
const ORDERS_FILE = path.join(DATA, 'orders.json');
const PORT = process.env.PORT || 8000;
const SERVICE_RATE = 0.05;

/* ---- storage helpers ---- */
function ensure() {
  if (!fs.existsSync(DATA)) fs.mkdirSync(DATA, { recursive: true });
  if (!fs.existsSync(ORDERS_FILE)) fs.writeFileSync(ORDERS_FILE, '[]');
}
function readOrders() {
  try { return JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8') || '[]'); }
  catch { return []; }
}
function writeOrders(list) { fs.writeFileSync(ORDERS_FILE, JSON.stringify(list, null, 2)); }
function getMenu() {
  try { return JSON.parse(fs.readFileSync(MENU_FILE, 'utf8')); }
  catch { return { coffee: [], pastries: [] }; }
}

/* ---- http helpers ---- */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
};
function send(res, status, body, type = 'application/json; charset=utf-8') {
  const out = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(out);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}
function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(ROOT, path.normalize(urlPath));
  if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    return send(res, 404, { error: 'Not found' });
  }
  const ext = path.extname(filePath);
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
}

/* ---- API ---- */
const server = http.createServer(async (req, res) => {
  const urlPath = req.url.split('?')[0];
  try {
    // Menu (source of truth for products/prices)
    if (req.method === 'GET' && urlPath === '/api/menu') {
      return send(res, 200, getMenu());
    }
    // Order history (newest first)
    if (req.method === 'GET' && urlPath === '/api/orders') {
      return send(res, 200, readOrders().reverse());
    }
    // Single order
    if (req.method === 'GET' && urlPath.startsWith('/api/orders/')) {
      const id = decodeURIComponent(urlPath.split('/').pop());
      const ord = readOrders().find((o) => o.id === id);
      if (!ord) return send(res, 404, { error: 'Order not found' });
      return send(res, 200, ord);
    }
    // Place order
    if (req.method === 'POST' && urlPath === '/api/orders') {
      const body = await readBody(req);
      const items = Array.isArray(body.items) ? body.items : [];
      if (!items.length) return send(res, 400, { error: 'Cart is empty' });

      const menu = getMenu();
      const all = [...menu.coffee, ...menu.pastries];

      // Re-price from menu (never trust client prices)
      let subtotal = 0;
      const validated = items.map((it) => {
        const m = all.find((p) => p.id === it.id);
        const price = m ? Number(m.price) : Number(it.price) || 0;
        const qty = Math.max(1, parseInt(it.qty, 10) || 1);
        subtotal += price * qty;
        return {
          id: it.id,
          name: m ? m.name : it.name,
          price,
          qty,
          emoji: m ? m.emoji : it.emoji,
        };
      });

      const charge = Math.round(subtotal * SERVICE_RATE * 100) / 100;
      const total = Math.round((subtotal + charge) * 100) / 100;

      const order = {
        id: 'COA-' + String(Date.now()).slice(-6),
        date: new Date().toISOString(),
        items: validated,
        customer: body.customer || {},
        payment: body.payment || 'Cash on Delivery',
        subtotal,
        charge,
        total,
        status: 'received',
      };

      const orders = readOrders();
      orders.push(order);
      writeOrders(orders);
      return send(res, 201, order);
    }
    // Everything else -> static files
    return serveStatic(req, res);
  } catch (e) {
    return send(res, 500, { error: String(e && e.message ? e.message : e) });
  }
});

ensure();
server.listen(PORT, () => {
  console.log(`☕ Cup O'Aroma server running at http://localhost:${PORT}`);
});
