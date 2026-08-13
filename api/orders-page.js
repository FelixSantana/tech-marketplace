const fs = require('fs');
const path = require('path');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Method Not Allowed');

  try {
    const html = fs.readFileSync(path.join(process.cwd(), 'orders.html'), 'utf8');
    const script = `<style>
.product-line{grid-template-columns:minmax(0,1fr) 82px 112px 112px 34px!important;align-items:center}
.product-line .pn{min-width:0}
.product-line .psub{background:var(--panel2);border:1px solid var(--line);color:var(--text);border-radius:10px;padding:10px 8px;font-size:13px;text-align:right}
.product-line select.pn{appearance:auto;cursor:pointer}
@media(max-width:620px){.product-line{grid-template-columns:minmax(0,1fr) 62px 90px 92px 34px!important}}
</style>
<script>
(function(){
  let catalogProducts=[];
  let catalogLoaded=false;

  function productPrice(p){
    const candidates=[p.price,p.unitPrice,p.salePrice,p.precio,p.amount];
    for(const v of candidates){
      const n=Number(v);
      if(Number.isFinite(n)&&n>=0)return n;
    }
    return 0;
  }
  function productId(p){return String(p.id||p._id||p.sku||'');}
  function productName(p){return String(p.name||p.title||p.nombre||'Producto');}
  function moneyLocal(n){return 'RD$ '+Number(n||0).toLocaleString('es-DO',{minimumFractionDigits:2,maximumFractionDigits:2})}

  async function loadCatalogProducts(){
    try{
      const r=await fetch('/api/catalog',{cache:'no-store'});
      if(!r.ok)throw new Error('No se pudo cargar el catálogo');
      const data=await r.json();
      catalogProducts=Array.isArray(data.products)?data.products.filter(p=>p&&productName(p)):[];
      catalogLoaded=true;
    }catch(e){
      console.error('orders product catalog error',e);
      catalogProducts=[];
    }
  }

  function optionsFor(selectedName){
    const current=String(selectedName||'');
    return '<option value="">Seleccionar producto…</option>'+catalogProducts.map(p=>{
      const name=productName(p), price=productPrice(p);
      return '<option value="'+escapeHtml(name)+'" data-price="'+price+'" '+(name===current?'selected':'')+'>'+escapeHtml(name)+' — '+moneyLocal(price)+'</option>';
    }).join('');
  }
  function escapeHtml(s){return String(s??'').replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]));}

  function makeLine(p){
    const name=String(p?.name||'');
    const qty=Math.max(1,Number(p?.quantity)||1);
    const price=Number.isFinite(Number(p?.unitPrice))?Number(p.unitPrice):0;
    const d=document.createElement('div');
    d.className='product-line';
    d.innerHTML='<select class="input pn">'+optionsFor(name)+'</select><input class="input pq" type="number" min="1" step="1" value="'+qty+'"><input class="input pp" type="number" min="0" step="0.01" value="'+price.toFixed(2)+'"><div class="psub">'+moneyLocal(qty*price)+'</div><button class="iconbtn remove-line" type="button">×</button>';
    const select=d.querySelector('.pn'), q=d.querySelector('.pq'), pp=d.querySelector('.pp'), sub=d.querySelector('.psub');
    function updateSubtotal(){
      const n=Math.max(1,Number(q.value)||1), pr=Math.max(0,Number(pp.value)||0);
      sub.textContent=moneyLocal(n*pr);
      if(typeof window.calcTotal==='function')window.calcTotal();
    }
    select.addEventListener('change',()=>{
      const opt=select.options[select.selectedIndex];
      const catalogPrice=Number(opt?.dataset?.price);
      if(select.value&&Number.isFinite(catalogPrice)){pp.value=catalogPrice.toFixed(2);}
      updateSubtotal();
    });
    q.addEventListener('input',updateSubtotal);pp.addEventListener('input',updateSubtotal);
    d.querySelector('.remove-line').onclick=()=>{d.remove();if(typeof window.calcTotal==='function')window.calcTotal()};
    return d;
  }

  async function install(){
    await loadCatalogProducts();
    if(typeof window.addProductLine!=='function')return;

    window.addProductLine=function(p={name:'',quantity:1,unitPrice:0}){
      const d=makeLine(p);
      document.getElementById('productsEditor').appendChild(d);
      if(typeof window.calcTotal==='function')window.calcTotal();
    };

    const oldCalc=window.calcTotal;
    window.calcTotal=function(){
      let total=0;
      document.querySelectorAll('.product-line').forEach(r=>{
        total+=(Number(r.querySelector('.pq')?.value)||0)*(Number(r.querySelector('.pp')?.value)||0);
        const sub=r.querySelector('.psub');
        if(sub)sub.textContent=moneyLocal((Number(r.querySelector('.pq')?.value)||0)*(Number(r.querySelector('.pp')?.value)||0));
      });
      const totalInput=document.getElementById('total');
      if(totalInput)totalInput.value=total.toFixed(2);
      return total;
    };

    const add=document.getElementById('addProduct');
    if(add)add.onclick=()=>window.addProductLine();

    // Re-render the currently open editor using catalog dropdowns if needed.
    const modal=document.getElementById('orderModal');
    if(modal){
      const observer=new MutationObserver(()=>{
        document.querySelectorAll('.product-line').forEach(row=>{
          const input=row.querySelector('.pn');
          if(input && input.tagName==='INPUT'){
            const oldName=input.value;
            const qty=row.querySelector('.pq')?.value||1;
            const price=row.querySelector('.pp')?.value||0;
            const replacement=makeLine({name:oldName,quantity:qty,unitPrice:price});
            row.replaceWith(replacement);
          }
        });
        window.calcTotal();
      });
      observer.observe(document.getElementById('productsEditor'),{childList:true});
    }
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
</script>`;
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.setHeader('Cache-Control','no-store');
    return res.status(200).send(html.replace('</body>',script+'</body>'));
  } catch(e) {
    console.error('orders page error',e);
    return res.status(500).send('Error cargando el dashboard de órdenes.');
  }
};
