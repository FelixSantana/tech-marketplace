const fs = require('fs');
const path = require('path');

module.exports = async function handler(req, res) {
  try {
    const indexPath = path.join(process.cwd(), 'index.html');
    let html = fs.readFileSync(indexPath, 'utf8');
    const script = `<script>(function(){function addOrdersLink(){var tabs=document.querySelector('.tabs');if(!tabs||tabs.querySelector('[data-orders-link]'))return;var b=document.createElement('button');b.type='button';b.className='tab';b.setAttribute('data-orders-link','true');b.textContent='Órdenes';b.addEventListener('click',function(){window.location.href='/admin/orders';});tabs.appendChild(b)}function watch(){addOrdersLink();var o=new MutationObserver(addOrdersLink);o.observe(document.documentElement,{childList:true,subtree:true})}if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',watch)}else{watch()}})();</script>`;
    html = html.includes('</body>') ? html.replace('</body>', `${script}</body>`) : `${html}${script}`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(html);
  } catch (e) {
    console.error('admin wrapper error', e);
    return res.status(500).send('No se pudo cargar el panel de administración.');
  }
};
