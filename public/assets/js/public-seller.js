const API="/api";
const m=n=>(Number(n)/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let currentSeller=null, serviceData=[];
async function load(){
 const id=new URLSearchParams(location.search).get("id");
 if(!id){document.getElementById("sellerProfile").innerHTML="<p>Profissional não encontrada.</p>";return}
 try{
  const r=await fetch(`/api/professionals/${id}`,{credentials:"same-origin"});
  const d=await r.json();if(!r.ok)throw Error(d.error);
  const p=d.professional;currentSeller=p;serviceData=d.services;
  document.title=p.display_name+" | ÉLORA BEAUTY";
  document.getElementById("sellerProfile").innerHTML=`<section class="seller-hero"><div class="seller-cover large rose">${p.photo_url?`<img class="seller-photo" src="${esc(p.photo_url)}">`:`<div class="avatar">${esc(p.display_name.split(" ").map(x=>x[0]).slice(0,2).join(""))}</div>`}</div><div class="seller-hero-text"><span class="eyebrow">${esc(p.specialty)}</span><h1>${esc(p.display_name)}</h1><p>📍 ${esc(p.city)}</p><p>${esc(p.bio)}</p><p class="social-label">${esc(p.instagram||"")}</p>${p.whatsapp?`<a class="btn btn-primary" target="_blank" rel="noopener" href="https://wa.me/${esc(p.whatsapp)}">Conversar pelo WhatsApp</a>`:""}</div></section>`;
  document.getElementById("publicServices").innerHTML=d.services.map(s=>`<article class="service-card"><div><h3>${esc(s.name)}</h3><p>${esc(s.description||"Atendimento personalizado")} · ${s.duration_minutes} min</p><p>${s.options.map(o=>esc(o.option_name)).join(" • ")}</p></div><strong>${m(s.price_cents)}</strong></article>`).join("")||"<p>Nenhum serviço cadastrado.</p>";
  document.getElementById("publicProducts").innerHTML=d.products.map(p=>`<article class="product-card"><div class="product-art">${p.image_url?`<img src="${esc(p.image_url)}" alt="${esc(p.name)}" style="width:100%;height:100%;object-fit:cover">`:"🎀"}</div><div class="product-card-body"><h3>${esc(p.name)}</h3><p>${esc(p.description)}</p><strong>${m(p.price_cents)}</strong><p>Estoque: ${p.stock_quantity}</p><button class="btn btn-primary btn-full" ${Number(p.stock_quantity)<=0?"disabled":""} onclick="placeProductOrder(${p.id}, this)">Pedir este produto</button></div></article>`).join("")||"<p>Nenhum produto cadastrado.</p>";
  const serviceSelect=document.getElementById("bookingService");
  serviceSelect.innerHTML='<option value="">Escolha um serviço</option>'+d.services.map(s=>`<option value="${s.id}">${esc(s.name)} — ${m(s.price_cents)}</option>`).join("");
  serviceSelect.addEventListener("change",updateOptions);
  const bookingForm=document.getElementById("bookingForm");
  if(!p.is_accepting_appointments){
   document.getElementById("bookingStatus").innerHTML=`<div class="dash-message">${esc(p.away_message||"Esta profissional está fora de expediente e não está recebendo agendamentos no momento.")}</div>`;
   bookingForm.hidden=true;
  }
 }catch(e){document.getElementById("sellerProfile").innerHTML=`<p class="empty-state">${esc(e.message)}</p>`}
}
function updateOptions(){
 const service=serviceData.find(s=>String(s.id)===document.getElementById("bookingService").value);
 const select=document.getElementById("bookingOption");
 select.innerHTML='<option value="">Sem opção específica</option>'+(service?.options||[]).map(o=>`<option value="${o.id}">${esc(o.option_name)}${Number(o.extra_price_cents)>0?" (+"+m(o.extra_price_cents)+")":""}</option>`).join("");
}
document.getElementById("bookingForm").addEventListener("submit",async e=>{
 e.preventDefault();const msg=document.getElementById("bookingMessage");msg.textContent="Enviando solicitação...";
 const data={seller_id:currentSeller.id,service_id:Number(document.getElementById("bookingService").value),service_option_id:document.getElementById("bookingOption").value||null,appointment_date:document.getElementById("bookingDate").value,appointment_time:document.getElementById("bookingTime").value,notes:document.getElementById("bookingNotes").value};
 try{
  const r=await fetch(`${API}/appointments`,{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});
  const d=await r.json();if(r.status===401){msg.textContent="Entre na sua conta de cliente para solicitar um horário.";setTimeout(()=>location.href="login.html",1200);return}if(!r.ok)throw Error(d.error);
  msg.textContent=d.message;e.target.reset();updateOptions();
 }catch(err){msg.textContent=err.message}
});

async function placeProductOrder(productId, button){
 if(!currentSeller)return;
 if(button){button.disabled=true;button.textContent="Enviando..."}
 try{
  const r=await fetch(`${API}/orders`,{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({seller_id:currentSeller.id,items:[{product_id:productId,quantity:1}]})});
  const d=await r.json();
  if(r.status===401){alert("Entre na sua conta de cliente para fazer um pedido.");location.href="login.html";return}
  if(!r.ok)throw Error(d.error);
  alert(d.message);location.href="pedidos.html";
 }catch(e){alert(e.message);if(button){button.disabled=false;button.textContent="Pedir este produto"}}
}
window.placeProductOrder=placeProductOrder;

document.getElementById("bookingDate").min=new Date().toISOString().slice(0,10);
load();
