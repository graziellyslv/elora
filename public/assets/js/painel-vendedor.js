const API="/api";
const days=["Domingo","Segunda-feira","Terça-feira","Quarta-feira","Quinta-feira","Sexta-feira","Sábado"];
const $=s=>document.querySelector(s);
const money=n=>(Number(n)/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
async function req(url,opt={}){const r=await fetch(API+url,{credentials:"same-origin",...opt,headers:{...(opt.body instanceof FormData?{}:{"Content-Type":"application/json"}),...(opt.headers||{})}});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||"Erro na solicitação");return d}
function msg(t){$("#message").hidden=false;$("#message").textContent=t}
async function logout(){try{await req("/auth/logout",{method:"POST"})}catch{}location.href="index.html"}
function renderHours(data){const byDay=Object.fromEntries(data.map(x=>[x.day_of_week,x]));$("#hours").innerHTML=days.map((d,i)=>{const x=byDay[i]||{is_open:false,open_time:"09:00",close_time:"18:00"};return `<div class="day-row"><strong>${d}</strong><label><input type="checkbox" data-day="${i}" ${x.is_open?"checked":""}> Atendo</label><input type="time" data-open="${i}" value="${x.open_time}"><input type="time" data-close="${i}" value="${x.close_time}"></div>`}).join("")}
function renderServices(items){$("#servicesList").innerHTML=items.map(s=>`<li><span><b>${esc(s.name)}</b><br>${money(s.price_cents)} · ${s.duration_minutes} min<br><small>${s.options.map(o=>esc(o.option_name)).join(", ")}</small></span><button class="btn btn-outline" onclick="deleteService(${s.id})">Excluir</button></li>`).join("")||"<li>Nenhum serviço cadastrado.</li>"}
function renderProducts(items){$("#productsList").innerHTML=items.map(p=>`<li><span><b>${esc(p.name)}</b><br>${money(p.price_cents)} · Estoque: ${p.stock_quantity}</span><button class="btn btn-outline" onclick="deleteProduct(${p.id})">Excluir</button></li>`).join("")||"<li>Nenhum produto cadastrado.</li>"}
function dateBR(v){return new Date(String(v).slice(0,10)+"T12:00:00").toLocaleDateString("pt-BR")}
function renderAppointments(items){
 const el=$("#appointmentsList");
 if(!items.length){el.innerHTML='<p class="empty-state">Você ainda não recebeu agendamentos.</p>';return}
 el.innerHTML=items.map(a=>{
  const statusLabels={pending:"Aguardando confirmação",confirmed:"Confirmado",rejected:"Recusado",completed:"Concluído",cancelled:"Cancelado"};
  const actions=a.status==="pending"?`<button class="btn btn-primary btn-small" onclick="changeAppointment(${a.id},'confirmed')">Confirmar</button><button class="btn btn-outline btn-small" onclick="changeAppointment(${a.id},'rejected')">Recusar</button>`:a.status==="confirmed"?`<button class="btn btn-primary btn-small" onclick="changeAppointment(${a.id},'completed')">Marcar concluído</button><button class="btn btn-outline btn-small" onclick="changeAppointment(${a.id},'cancelled')">Cancelar</button>`:"";
  return `<article class="appointment-item"><div class="appointment-info"><span class="status status-${esc(a.status)}">${statusLabels[a.status]||esc(a.status)}</span><h3>${esc(a.customer_name)}</h3><p><b>${esc(a.service_name)}</b>${a.technique?" · "+esc(a.technique):""}</p><p>📅 ${dateBR(a.appointment_date)} às ${esc(String(a.appointment_time).slice(0,5))} · ${money(a.final_price_cents)}</p><p class="muted">${esc(a.customer_email)}</p>${a.notes?`<p>Observação: ${esc(a.notes)}</p>`:""}</div><div class="appointment-actions">${actions}</div></article>`;
 }).join("");
}
async function loadAppointments(){try{const d=await req("/seller/appointments");renderAppointments(d.appointments)}catch(e){$("#appointmentsList").innerHTML=`<p>${esc(e.message)}</p>`}}

function renderSellerOrders(items){
 const el=$("#sellerOrders");
 if(!items.length){el.innerHTML='<p class="empty-state">Sua loja ainda não recebeu pedidos de produtos.</p>';return}
 const labels={pending:"Novo pedido",processing:"Em preparação",completed:"Concluído",cancelled:"Cancelado"};
 el.innerHTML=items.map(o=>`<article class="order-card"><div class="order-top"><div><span class="eyebrow">PEDIDO #${o.id}</span><h3>${esc(o.customer_name)}</h3><p>${esc(o.customer_email)}</p></div><span class="status status-${esc(o.status)}">${labels[o.status]||esc(o.status)}</span></div><ul>${o.items.map(i=>`<li>${esc(i.product_name)} × ${i.quantity} <strong>${money(i.unit_price_cents*i.quantity)}</strong></li>`).join("")}</ul><div class="order-bottom"><span>${new Date(o.created_at).toLocaleString("pt-BR")}</span><strong>Total: ${money(o.total_cents)}</strong></div><div class="appointment-actions">${o.status==="pending"?`<button class="btn btn-primary btn-small" onclick="changeOrder(${o.id},'processing')">Aceitar pedido</button>`:""}${o.status==="pending"||o.status==="processing"?`<button class="btn btn-outline btn-small" onclick="changeOrder(${o.id},'completed')">Marcar concluído</button><button class="btn btn-outline btn-small" onclick="changeOrder(${o.id},'cancelled')">Cancelar</button>`:""}</div></article>`).join("");
}
async function loadSellerOrders(){try{const d=await req("/seller/orders");renderSellerOrders(d.orders)}catch(e){$("#sellerOrders").innerHTML=`<p>${esc(e.message)}</p>`}}
async function changeOrder(id,status){try{await req(`/seller/orders/${id}`,{method:"PATCH",body:JSON.stringify({status})});await loadSellerOrders();msg("Pedido atualizado.")}catch(e){msg(e.message)}}

async function init(){
 try{
  const {user}=await req("/auth/me");
  if(user.role!=="seller")throw Error("Esta área é exclusiva para contas de vendedor.");
  const [profile,hours,services,products,availability]=await Promise.all([req("/seller/profile"),req("/seller/hours"),req("/seller/services"),req("/seller/products"),req("/seller/availability")]);
  const f=$("#profileForm");
  Object.entries(profile.profile).forEach(([k,v])=>{if(f.elements[k])f.elements[k].value=v||""});
  if(profile.profile.photo_url){$("#photoPreview").src=profile.profile.photo_url;$("#photoPreview").hidden=false}
  renderHours(hours.hours);renderServices(services.services);renderProducts(products.products);
  $("#acceptingAppointments").checked=availability.availability.is_accepting_appointments;
  $("#awayMessage").value=availability.availability.away_message||"";
  await loadAppointments(); await loadSellerOrders();
 }catch(e){msg(e.message);if(e.message.includes("Faça login"))setTimeout(()=>location.href="login.html",1200)}
}
$("#profileForm").addEventListener("submit",async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.target).entries());try{await req("/seller/profile",{method:"PUT",body:JSON.stringify(data)});msg("Sua página foi atualizada! ♡")}catch(x){msg(x.message)}});
$("#uploadPhoto").addEventListener("click",async()=>{const file=$("#photo").files[0];if(!file){msg("Escolha uma foto primeiro.");return}const fd=new FormData();fd.append("photo",file);try{const d=await req("/seller/photo",{method:"POST",body:fd});$("#photoPreview").src=d.photo_url;$("#photoPreview").hidden=false;msg("Foto atualizada com sucesso!")}catch(e){msg(e.message)}});
$("#serviceForm").addEventListener("submit",async e=>{e.preventDefault();const f=e.target;const data={name:f.name.value,description:f.description.value,price:Number(f.price.value),duration_minutes:Number(f.duration_minutes.value),options:f.options.value.split(",").map(x=>x.trim()).filter(Boolean)};try{await req("/seller/services",{method:"POST",body:JSON.stringify(data)});f.reset();f.duration_minutes.value=60;renderServices((await req("/seller/services")).services);msg("Serviço cadastrado!")}catch(x){msg(x.message)}});
$("#productForm").addEventListener("submit",async e=>{e.preventDefault();const f=e.target;const data={name:f.name.value,description:f.description.value,price:Number(f.price.value),stock_quantity:Number(f.stock_quantity.value)};try{const d=await req("/seller/products",{method:"POST",body:JSON.stringify(data)});const file=f.image.files[0];if(file){const fd=new FormData();fd.append("image",file);await req(`/seller/products/${d.product.id}/image`,{method:"POST",body:fd})}f.reset();f.stock_quantity.value=0;renderProducts((await req("/seller/products")).products);msg("Produto cadastrado!")}catch(x){msg(x.message)}});
$("#saveHours").addEventListener("click",async()=>{const hours=days.map((d,i)=>({day_of_week:i,is_open:$(`[data-day="${i}"]`).checked,open_time:$(`[data-open="${i}"]`).value,close_time:$(`[data-close="${i}"]`).value}));try{await req("/seller/hours",{method:"PUT",body:JSON.stringify({hours})});msg("Horários salvos!")}catch(e){msg(e.message)}});
$("#saveAvailability").addEventListener("click",async()=>{try{const d=await req("/seller/availability",{method:"PUT",body:JSON.stringify({is_accepting_appointments:$("#acceptingAppointments").checked,away_message:$("#awayMessage").value})});msg(d.availability.is_accepting_appointments?"Você está recebendo agendamentos novamente.":"Disponibilidade pausada. Novos agendamentos foram bloqueados.");}catch(e){msg(e.message)}});
async function changeAppointment(id,status){try{await req(`/seller/appointments/${id}`,{method:"PATCH",body:JSON.stringify({status})});await loadAppointments();msg("Agendamento atualizado.")}catch(e){msg(e.message)}}
async function deleteService(id){if(!confirm("Excluir este serviço?"))return;try{await req("/seller/services/"+id,{method:"DELETE"});renderServices((await req("/seller/services")).services)}catch(e){msg(e.message)}}
async function deleteProduct(id){if(!confirm("Excluir este produto?"))return;try{await req("/seller/products/"+id,{method:"DELETE"});renderProducts((await req("/seller/products")).products)}catch(e){msg(e.message)}}
window.changeOrder=changeOrder;window.logout=logout;window.changeAppointment=changeAppointment;window.deleteService=deleteService;window.deleteProduct=deleteProduct;
init();
