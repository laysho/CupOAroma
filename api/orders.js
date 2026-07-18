const fs = require('fs');
const path = require('path');
const MENU = path.join(__dirname, '..', 'backend', 'data', 'menu.json');
const ORDERS = '/tmp/cup_orders.json'; // Vercel FS is read-only; /tmp is writable (ephemeral)
const SERVICE_RATE = 0.05;

function getMenu() {
  try { return JSON.parse(fs.readFileSync(MENU, 'utf8')); }
  catch { return { coffee: [], pastries: [] }; }
}
function readOrders() {
  try { return JSON.parse(fs.readFileSync(ORDERS, 'utf8') || '[]'); }
  catch { return []; }
}
function writeOrders(list) { fs.writeFileSync(ORDERS, JSON.stringify(list, null, 2)); }
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'GET') {
      res.statusCode = 200;
      return res.end(JSON.stringify(readOrders().reverse()));
    }
    if (req.method === 'POST') {
      const body = await readBody(req);
      const items = Array.isArray(body.items) ? body.items : [];
      if (!items.length) { res.statusCode = 400; return res.end(JSON.stringify({ error: 'Cart is empty' })); }

      const menu = getMenu();
      const all = [...menu.coffee, ...menu.pastries];

      let subtotal = 0;
      const validated = items.map((it) => {
        const m = all.find((p) => p.id === it.id);
        const price = m ? Number(m.price) : Number(it.price) || 0;
        const qty = Math.max(1, parseInt(it.qty, 10) || 1);
        subtotal += price * qty;
        return { id: it.id, name: m ? m.name : it.name, price, qty, emoji: m ? m.emoji : it.emoji };
      });

      const charge = Math.round(subtotal * SERVICE_RATE * 100) / 100;
      const total = Math.round((subtotal + charge) * 100) / 100;

      const order = {
        id: 'COA-' + String(Date.now()).slice(-6),
        date: new Date().toISOString(),
        items: validated,
        customer: body.customer || {},
        payment: body.payment || 'Cash on Delivery',
        subtotal, charge, total, status: 'received',
      };

      const orders = readOrders();
      orders.push(order);
      writeOrders(orders);
      res.statusCode = 201;
      return res.end(JSON.stringify(order));
    }
    res.statusCode = 405;
    res.end(JSON.stringify({ error: 'Method not allowed' }));
  } catch (e) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: String(e && e.message ? e.message : e) }));
  }
};
