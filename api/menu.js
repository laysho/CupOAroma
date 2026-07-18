const fs = require('fs');
const path = require('path');
const MENU = path.join(__dirname, '..', 'backend', 'data', 'menu.json');

module.exports = (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  try {
    const menu = JSON.parse(fs.readFileSync(MENU, 'utf8'));
    res.statusCode = 200;
    res.end(JSON.stringify(menu));
  } catch (e) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: String(e && e.message ? e.message : e) }));
  }
};
