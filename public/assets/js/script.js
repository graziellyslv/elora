const API = "/api";
const money = n => (Number(n)/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
async function api(url, options={}) {
  const response = await fetch(API+url,{credentials:"same-origin",...options,headers:{...(options.body instanceof FormData?{}:{"Content-Type":"application/json"}),...(options.headers||{})}});
  const data = await response.json().catch(()=>({error:"Resposta inválida do servidor"}));
  if(!response.ok) throw new Error(data.error || "Não foi possível concluir a operação.");
  return data;
}
async function updateNav(){
  try{
    const {user}=await api("/auth/me");
    const box=document.querySelector(".nav-actions");
    if(!box)return;
    box.innerHTML=`<span class="user-name">Olá, ${escapeHtml(user.name)}</span>${user.role==="seller"?'<a class="nav-link" href="painel-vendedor.html">Meu painel</a><a class="nav-link" href="painel-vendedor.html#sellerOrders">Pedidos da loja</a>':'<a class="nav-link" href="pedidos.html">Meus pedidos</a>'}<button class="btn btn-outline btn-small" onclick="logout()">Sair</button>`;
  }catch{}
}
function escapeHtml(v=""){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
async function logout(){try{await api("/auth/logout",{method:"POST"});}catch{} location.href="index.html";}
async function renderHome(){
 const target=document.getElementById("listaProfissionais"); if(!target)return;
 try{
  const {professionals}=await api("/professionals");
  target.innerHTML=professionals.length?professionals.map(p=>`<article class="seller-card">
   <div class="seller-cover ${p.theme||"rose"}">${p.photo_url?`<img class="seller-photo" src="${p.photo_url}" alt="Foto de ${escapeHtml(p.display_name)}">`:`<div class="avatar">${escapeHtml((p.display_name||"").split(" ").map(x=>x[0]).slice(0,2).join(""))}</div>`}</div>
   <div class="seller-card-body"><span class="eyebrow">${escapeHtml(p.specialty)}</span><h3>${escapeHtml(p.display_name)}</h3><p>📍 ${escapeHtml(p.city||"")}</p><p class="seller-description">${escapeHtml(p.bio||"Conheça os serviços e produtos desta profissional.")}</p><a class="btn btn-primary btn-full" href="vendedor.html?id=${p.id}">Conhecer profissional →</a></div>
  </article>`).join(""):'<p class="empty-state">Ainda não há profissionais cadastradas. Volte em breve! ♡</p>';
 }catch(e){target.innerHTML=`<p class="empty-state">${escapeHtml(e.message)}<br>Confira se o servidor está iniciado.</p>`;}
}
document.addEventListener("DOMContentLoaded",()=>{updateNav();renderHome();});
