module.exports = async function handler(req, res) {
  try {
    const origin = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`;
    const upstream = await fetch(`${origin}/index.html`, { cache: 'no-store' });
    if (!upstream.ok) throw new Error(`index fetch failed: ${upstream.status}`);
    let html = await upstream.text();
    const script = `<script>(function(){function addOrdersLink(){var tabs=document.querySelector('.tabs');if(!tabs||tabs.querySelector('[data-orders-link]'))return;var b=document.createElement('button');b.type='button';b.className='tab';b.set