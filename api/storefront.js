const fs = require('fs');
const path = require('path');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Method Not Allowed');

  try {
    const indexPath = path.join(process.cwd(), 'index.html');
    let html = fs.readFileSync(indexPath, 'utf8');

    const script = `<script>
(function(){
  if(window.__synapticOrderCheckout) return;
  window.__synapticOrderCheckout = true;

  const originalOpen = window.open.bind(window);

  const css = document.createElement('style');
  css.textContent = '.so-overlay{position:fixed;inset:0;background:rgba(6,7,11,.75);backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:18px}.so-box{width:min(440px,100%);background:var(--bg-elev,#10131c);color:var(--text,#edeef3);border:1px solid var(--border,#262b3c);border-radius:18px;padding:22px;box-shadow:0 20px 60px rgba(0,0,0,.45);font-family:Inter,system-ui,sans-serif}.so-box h3{margin:0 0 6px;font-size:20px}.so-box p{margin:0 0 18px;color:var(--text-muted,#8b90a8);font-size:13px;line-height:1.45}.so-field{margin-bottom:12px}.so-field label{display:block;font-size:12px;color:var(--text-muted,#8b90a8);margin-bottom:6px}.so-field input{width:100%;box-sizing:border-box;background:var(--surface,#161a26);border:1px solid var(--border,#262b3c);border-radius:9px;padding:11px 12px;color:var(--text,#edeef3);outline:none}.so-field input:focus{border-color:var(--accent,#7c5cff)}.so-summary{background:var(--surface,#161a26);border:1px solid var(--border,#262b3c);border-radius:10px;padding:10px 12px;margin:12px 0 16px;font-size:12px;line-height:1.5;max-height:130px;overflow:auto}.so-actions{display:flex;gap:8px;justify-content:flex-end}.so-btn{border:1px solid var(--border,#262b3c);background:var(--surface,#161a26);color:var(--text,#edeef3);padding:10px 14px;border-radius:9px;font-weight:700;cursor:pointer}.so-btn.primary{background:#25d366;border-color:#25d366;color:#06210f}.so-btn:disabled{opacity:.6;cursor:wait}.so-error{color:#ff5c7a;font-size:12px;margin:8px 0 0;display:none}';
  document.head.appendChild(css);

  function esc(s){
    return String(s || '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('\\"','&quot;').replaceAll("'",'&#39;');
  }

  function digitsOnly(value){
    let out = '';
    for(const ch of String(value || '')) if(ch >= '0' && ch <= '9') out += ch;
    return out;
  }

  function numberFromText(value){
    const cleaned = String(value || '').trim();
    let out = '';
    for(const ch of cleaned){
      if((ch >= '0' && ch <= '9') || ch === '.' || ch === ',') out += ch;
    }
    if(out.includes('.') && out.includes(',')){
      out = out.replaceAll('.','').replace(',','.');
    } else if(out.includes(',')){
      const parts = out.split(',');
      out = parts.length === 2 && parts[1].length !== 3 ? parts[0]+'.'+parts[1] : out.replaceAll(',','');
    } else if(out.split('.').length > 2){
      out = out.replaceAll('.','');
    }
    return Number(out) || 0;
  }

  function parseMessage(url){
    try{
      const u = new URL(url, location.href);
      const text = u.searchParams.get('text') || '';
      const lines = text.split(String.fromCharCode(10)).map(x=>x.trim()).filter(Boolean);
      const products = [];
      let total = 0;

      for(const line of lines){
        if(line.startsWith('• ') && line.includes(' x') && line.includes(' — ')){
          const body = line.slice(2);
          const dash = body.indexOf(' — ');
          const left = dash >= 0 ? body.slice(0,dash) : body;
          const right = dash >= 0 ? body.slice(dash+3) : '';
          const qtyMarker = left.lastIndexOf(' x');
          if(qtyMarker > 0){
            const name = left.slice(0,qtyMarker).trim();
            const quantity = Math.max(1, Number(left.slice(qtyMarker+2).trim()) || 1);
            const subtotal = numberFromText(right);
            const unitPrice = quantity ? subtotal / quantity : 0;
            products.push({name, quantity, unitPrice});
            continue;
          }
        }
        if(line.toLowerCase().startsWith('total:')) total = numberFromText(line.slice(6));
      }

      if(!total) total = products.reduce((sum,p)=>sum + p.quantity*p.unitPrice, 0);
      return {products,total};
    }catch(e){
      console.error('WhatsApp order parse failed', e);
      return {products:[],total:0};
    }
  }

  function openCheckout(url){
    const parsed = parseMessage(url);
    const overlay = document.createElement('div');
    overlay.className = 'so-overlay';
    overlay.innerHTML = '<div class="so-box"><h3>Confirmar pedido</h3><p>Déjanos tus datos para registrar tu orden como <strong>pendiente</strong> y luego abrir WhatsApp con el pedido listo para enviar.</p><div class="so-field"><label>Nombre</label><input id="soName" autocomplete="name" maxlength="120" placeholder="Tu nombre" required></div><div class="so-field"><label>Tu WhatsApp</label><input id="soPhone" autocomplete="tel" inputmode="tel" maxlength="20" placeholder="Ej. 18095551234" required></div><div class="so-summary"><strong>Pedido</strong><br>'+esc(parsed.products.map(p=>p.name+' ×'+p.quantity).join(' · ')||'Producto solicitado')+'<br><strong>Total: RD$ '+Number(parsed.total||0).toLocaleString('es-DO',{minimumFractionDigits:2,maximumFractionDigits:2})+'</strong></div><div class="so-actions"><button class="so-btn" id="soCancel">Cancelar</button><button class="so-btn primary" id="soSend">Registrar y abrir WhatsApp</button></div><div class="so-error" id="soError"></div></div>';
    document.body.appendChild(overlay);

    const name = overlay.querySelector('#soName');
    const phone = overlay.querySelector('#soPhone');
    const send = overlay.querySelector('#soSend');
    const error = overlay.querySelector('#soError');
    name.focus();

    const close = ()=>overlay.remove();
    overlay.querySelector('#soCancel').onclick = close;
    overlay.addEventListener('click', e=>{ if(e.target===overlay) close(); });

    send.onclick = async ()=>{
      const customerName = name.value.trim();
      const customerPhone = digitsOnly(phone.value);
      error.style.display = 'none';

      if(customerName.length < 2){ error.textContent='Escribe tu nombre.'; error.style.display='block'; name.focus(); return; }
      if(customerPhone.length < 8){ error.textContent='Escribe un número de WhatsApp válido.'; error.style.display='block'; phone.focus(); return; }
      if(!parsed.products.length){ error.textContent='No pudimos identificar los productos. Vuelve a abrir el pedido e inténtalo de nuevo.'; error.style.display='block'; return; }

      send.disabled = true;
      send.textContent = 'Registrando pedido…';

      try{
        const response = await fetch('/api/orders', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({source:'whatsapp_checkout',customerName,phone:customerPhone,products:parsed.products,total:parsed.total,notes:'Pedido generado desde el catálogo y enviado a WhatsApp.'})
        });
        const data = await response.json().catch(()=>({}));
        if(!response.ok) throw new Error(data.message || 'No se pudo registrar el pedido.');
        close();
        originalOpen(url,'_blank','noopener');
      }catch(err){
        console.error('WhatsApp order registration failed', err);
        send.disabled = false;
        send.textContent = 'Registrar y abrir WhatsApp';
        error.textContent = err.message || 'No se pudo registrar el pedido. Inténtalo de nuevo.';
        error.style.display = 'block';
      }
    };
  }

  window.open = function(url,target,features){
    const href = String(url || '');
    if(href.includes('wa.me/')){
      openCheckout(href);
      return null;
    }
    return originalOpen(url,target,features);
  };

  document.addEventListener('click', function(e){
    const link = e.target.closest('a[href*="wa.me/"]');
    if(!link || link.classList.contains('disabled') || link.getAttribute('href')==='#') return;
    e.preventDefault();
    e.stopImmediatePropagation();
    openCheckout(link.href);
  }, true);
})();
</script>`;

    html = html.replace('</body>', script + '</body>');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(html);
  } catch (e) {
    console.error('storefront wrapper error', e);
    return res.status(500).send('Error cargando el catálogo.');
  }
};
