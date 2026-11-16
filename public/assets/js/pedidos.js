const API="/api", $=s=>document.querySelector(s);
const money=n=>(Number(n)/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const dateBR=v=>new Date(String(v).slice(0,10)+"T12:00:00").toLocaleDateString("pt-BR");
async function api(url,opt={}){const r=await fetch(API+url,{credentials:"same-origin",...opt,headers:{"Content-Type":"application/json",...(opt.headers||{})}});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||"Erro ao carregar");return d}
async function logout(){try{await api("/auth/logout",{method:"POST"})}catch{}location.href="index.html"}
function renderOrders(items){
 const el=$("#customerOrders");
 if(!items.length){el.innerHTML='<p class="empty-state">Você ainda não fez pedidos de produtos. Visite uma profissional para conhecer a lojinha dela. ♡</p>';return}
 const labels={pending:"Recebido pela profissional",processing:"Em preparação",completed:"Concluído",cancelled:"Cancelado"};
 el.innerHTML=items.map(o=>`<article class="order-card"><div class="order-top"><div><span class="eyebrow">PEDIDO #${o.id}</span><h3>${esc(o.seller_name)}</h3><p>${esc(o.specialty||"Profissional")}</p></div><span class="status status-${esc(o.status)}">${labels[o.status]||esc(o.status)}</span></div><ul>${o.items.map(i=>`<li>${esc(i.product_name)} × ${i.quantity} <strong>${money(i.unit_price_cents*i.quantity)}</strong></li>`).join("")}</ul><div class="order-bottom"><span>${new Date(o.created_at).toLocaleString("pt-BR")}</span><strong>Total: ${money(o.total_cents)}</strong></div><a class="text-link" href="vendedor.html?id=${o.seller_id}">Ver loja da profissional →</a></article>`).join("");
}
function renderAppointments(items){
 const el=$("#customerAppointments");
 if(!items.length){el.innerHTML='<p class="empty-state">Você ainda não solicitou nenhum agendamento. ♡</p>';return}
 const labels={pending:"Aguardando confirmação",confirmed:"Confirmado",rejected:"Recusado",completed:"Concluído",cancelled:"Cancelado"};
 el.innerHTML=items.map(a=>`<article class="order-card"><div class="order-top"><div><span class="eyebrow">AGENDAMENTO #${a.id}</span><h3>${esc(a.service_name)}${a.technique?" · "+esc(a.technique):""}</h3><p>Com <b>${esc(a.seller_name)}</b> · ${esc(a.specialty||"Profissional")}</p></div><span class="status status-${esc(a.status)}">${labels[a.status]||esc(a.status)}</span></div><div class="order-bottom"><span>📅 ${dateBR(a.appointment_date)} às ${esc(String(a.appointment_time).slice(0,5))}</span><strong>${money(a.final_price_cents)}</strong></div>${a.notes?`<p class="order-notes">Observação: ${esc(a.notes)}</p>`:""}<a class="text-link" href="vendedor.html?id=${a.seller_id}">Ver profissional →</a></article>`).join("");
}
async function init(){
 try{const me=await api("/auth/me");if(me.user.role!=="buyer"){location.href="painel-vendedor.html";return}
 const d=await api("/customer/orders");renderOrders(d.orders);renderAppointments(d.appointments);
 }catch(e){$("#customerOrders").innerHTML=`<p>${esc(e.message)}. <a href="login.html">Entre na sua conta</a>.</p>`;$("#customerAppointments").innerHTML=""}
}
window.logout=logout;init();
