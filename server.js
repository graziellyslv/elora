const express = require("express");
const session = require("express-session");
const PgSession = require("connect-pg-simple")(session);
const bcrypt = require("bcryptjs");
const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const path = require("path");
const { pool, initDatabase } = require("./database");

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === "production";

app.set("trust proxy", 1);
app.use(express.json({ limit: "1mb" }));
app.use(session({
  store: new PgSession({
    pool,
    tableName: "user_sessions",
    createTableIfMissing: true
  }),
  secret: process.env.SESSION_SECRET || "chave-local-apenas-para-testes",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));
app.use(express.static(path.join(__dirname, "public")));

const cloudinaryReady = !!(process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
if (cloudinaryReady) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
}
const imageUpload = cloudinaryReady
  ? multer({ storage: new CloudinaryStorage({
      cloudinary,
      params: { folder: "amora-beauty", allowed_formats: ["jpg","jpeg","png","webp"], transformation: [{ width: 1200, height: 1200, crop: "limit" }] }
    }), limits: { fileSize: 5 * 1024 * 1024 } })
  : multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const fail = (res, status, error) => res.status(status).json({ error });
function requireLogin(req,res,next) {
  if (!req.session.user) return fail(res,401,"Faça login para continuar.");
  next();
}
function requireSeller(req,res,next) {
  if (!req.session.user) return fail(res,401,"Faça login para continuar.");
  if (req.session.user.role !== "seller") return fail(res,403,"Área exclusiva para vendedores.");
  next();
}
async function getSeller(userId) {
  const r = await pool.query("SELECT * FROM seller_profiles WHERE user_id=$1", [userId]);
  return r.rows[0];
}
function toCents(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new Error("Informe um preço válido.");
  return Math.round(n * 100);
}
function imageUrl(req) {
  return req.file && req.file.path ? req.file.path : null;
}
function requireCloudinary(req,res) {
  if (!cloudinaryReady) {
    fail(res,503,"Para enviar fotos no Render, configure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY e CLOUDINARY_API_SECRET nas variáveis do serviço.");
    return false;
  }
  return true;
}

app.get("/api/health", (req,res) => res.json({ ok:true, service:"Amora Beauty API" }));

app.post("/api/auth/register", async (req,res) => {
  const client = await pool.connect();
  try {
    const { name,email,password,role } = req.body || {};
    if (!name || !email || !password) return fail(res,400,"Preencha nome, e-mail e senha.");
    if (String(password).length < 8) return fail(res,400,"A senha precisa ter pelo menos 8 caracteres.");
    if (!["buyer","seller"].includes(role)) return fail(res,400,"Tipo de conta inválido.");
    await client.query("BEGIN");
    const hash = await bcrypt.hash(password,12);
    const u = await client.query(
      "INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,$4) RETURNING id,name,email,role",
      [String(name).trim(),String(email).trim().toLowerCase(),hash,role]
    );
    const user = u.rows[0];
    if (role === "seller") {
      const p = await client.query(
        "INSERT INTO seller_profiles(user_id,display_name) VALUES($1,$2) RETURNING id",
        [user.id,user.name]
      );
      for (let day=0; day<7; day++) {
        await client.query(
          "INSERT INTO business_hours(seller_id,day_of_week,is_open,open_time,close_time) VALUES($1,$2,$3,'09:00','18:00')",
          [p.rows[0].id,day,day>0 && day<6]
        );
      }
    }
    await client.query("COMMIT");
    req.session.user = user;
    res.json({user});
  } catch(e) {
    await client.query("ROLLBACK");
    if (e.code === "23505") return fail(res,409,"Este e-mail já está cadastrado.");
    console.error(e); fail(res,500,"Não foi possível criar a conta.");
  } finally { client.release(); }
});

app.post("/api/auth/login", async (req,res) => {
  try {
    const {email,password} = req.body || {};
    const r = await pool.query("SELECT id,name,email,password_hash,role FROM users WHERE email=$1",[String(email||"").trim().toLowerCase()]);
    const u = r.rows[0];
    if (!u || !(await bcrypt.compare(password||"",u.password_hash))) return fail(res,401,"E-mail ou senha incorretos.");
    req.session.user = {id:u.id,name:u.name,email:u.email,role:u.role};
    res.json({user:req.session.user});
  } catch(e) { console.error(e); fail(res,500,"Erro ao entrar."); }
});
app.get("/api/auth/me",requireLogin,(req,res)=>res.json({user:req.session.user}));
app.post("/api/auth/logout",(req,res)=>req.session.destroy(()=>res.json({ok:true})));

app.get("/api/professionals",async(req,res)=>{
  try {
    const r=await pool.query("SELECT id,display_name,specialty,city,bio,instagram,whatsapp,photo_url,is_accepting_appointments,away_message FROM seller_profiles WHERE is_active=TRUE ORDER BY display_name");
    res.json({professionals:r.rows});
  } catch(e){console.error(e);fail(res,500,"Não foi possível carregar as profissionais.");}
});
app.get("/api/professionals/:id",async(req,res)=>{
  try {
    const p=await pool.query("SELECT id,display_name,specialty,city,bio,instagram,whatsapp,photo_url,is_accepting_appointments,away_message FROM seller_profiles WHERE id=$1 AND is_active=TRUE",[req.params.id]);
    if(!p.rows[0])return fail(res,404,"Profissional não encontrada.");
    const [s,pr]=await Promise.all([
      pool.query("SELECT * FROM services WHERE seller_id=$1 AND is_active=TRUE ORDER BY id DESC",[req.params.id]),
      pool.query("SELECT * FROM products WHERE seller_id=$1 AND is_active=TRUE ORDER BY id DESC",[req.params.id])
    ]);
    const services=await Promise.all(s.rows.map(async x=>{
      const o=await pool.query("SELECT id,option_name,extra_price_cents FROM service_options WHERE service_id=$1",[x.id]);
      return {...x,options:o.rows};
    }));
    res.json({professional:p.rows[0],services,products:pr.rows});
  } catch(e){console.error(e);fail(res,500,"Não foi possível carregar a página.");}
});

app.get("/api/seller/profile",requireSeller,async(req,res)=>{
  const p=await getSeller(req.session.user.id);
  if(!p)return fail(res,404,"Perfil de vendedor não encontrado.");
  res.json({profile:p});
});
app.put("/api/seller/profile",requireSeller,async(req,res)=>{
  try {
    const b=req.body||{};
    const r=await pool.query(
      `UPDATE seller_profiles SET display_name=$1,specialty=$2,city=$3,bio=$4,instagram=$5,whatsapp=$6
       WHERE user_id=$7 RETURNING *`,
      [String(b.display_name||"").trim(),String(b.specialty||"Profissional da beleza").trim(),b.city||"",b.bio||"",b.instagram||"",String(b.whatsapp||"").replace(/\D/g,""),req.session.user.id]
    );
    if(!r.rows[0])return fail(res,404,"Perfil não encontrado.");
    res.json({ok:true,profile:r.rows[0]});
  } catch(e){console.error(e);fail(res,500,"Não foi possível salvar o perfil.");}
});
app.post("/api/seller/photo",requireSeller,(req,res,next)=>{
  if(!requireCloudinary(req,res))return;
  imageUpload.single("photo")(req,res,async err=>{
    if(err)return fail(res,400,err.message);
    if(!req.file)return fail(res,400,"Escolha uma foto.");
    try {
      await pool.query("UPDATE seller_profiles SET photo_url=$1 WHERE user_id=$2",[imageUrl(req),req.session.user.id]);
      res.json({photo_url:imageUrl(req)});
    } catch(e){console.error(e);fail(res,500,"Não foi possível salvar a foto.");}
  });
});

app.get("/api/seller/services",requireSeller,async(req,res)=>{
  const p=await getSeller(req.session.user.id);
  const r=await pool.query("SELECT * FROM services WHERE seller_id=$1 ORDER BY id DESC",[p.id]);
  const services=await Promise.all(r.rows.map(async s=>{
    const o=await pool.query("SELECT id,option_name FROM service_options WHERE service_id=$1 ORDER BY id",[s.id]);
    return {...s,options:o.rows};
  }));
  res.json({services});
});
app.post("/api/seller/services",requireSeller,async(req,res)=>{
  const client=await pool.connect();
  try {
    const p=await getSeller(req.session.user.id),b=req.body||{};
    if(!b.name)return fail(res,400,"Informe o nome do serviço.");
    await client.query("BEGIN");
    const s=await client.query(
      "INSERT INTO services(seller_id,name,description,price_cents,duration_minutes) VALUES($1,$2,$3,$4,$5) RETURNING id",
      [p.id,b.name.trim(),b.description||"",toCents(b.price),Math.max(15,Number(b.duration_minutes)||60)]
    );
    for(const option of (Array.isArray(b.options)?b.options:[])) {
      const name=String(option).trim();
      if(name) await client.query("INSERT INTO service_options(service_id,option_name) VALUES($1,$2) ON CONFLICT DO NOTHING",[s.rows[0].id,name]);
    }
    await client.query("COMMIT");
    res.json({service:{id:s.rows[0].id}});
  } catch(e){await client.query("ROLLBACK");console.error(e);fail(res,400,e.message||"Erro ao cadastrar serviço.");}
  finally{client.release();}
});
app.delete("/api/seller/services/:id",requireSeller,async(req,res)=>{
  const p=await getSeller(req.session.user.id);
  const r=await pool.query("DELETE FROM services WHERE id=$1 AND seller_id=$2 RETURNING id",[req.params.id,p.id]);
  if(!r.rowCount)return fail(res,404,"Serviço não encontrado.");
  res.json({ok:true});
});

app.get("/api/seller/products",requireSeller,async(req,res)=>{
  const p=await getSeller(req.session.user.id);
  const r=await pool.query("SELECT * FROM products WHERE seller_id=$1 ORDER BY id DESC",[p.id]);
  res.json({products:r.rows});
});
app.post("/api/seller/products",requireSeller,async(req,res)=>{
  try {
    const p=await getSeller(req.session.user.id),b=req.body||{};
    if(!b.name)return fail(res,400,"Informe o nome do produto.");
    const r=await pool.query(
      "INSERT INTO products(seller_id,name,description,price_cents,stock_quantity) VALUES($1,$2,$3,$4,$5) RETURNING id",
      [p.id,b.name.trim(),b.description||"",toCents(b.price),Math.max(0,Number(b.stock_quantity)||0)]
    );
    res.json({product:{id:r.rows[0].id}});
  } catch(e){console.error(e);fail(res,400,e.message||"Erro ao cadastrar produto.");}
});
app.post("/api/seller/products/:id/image",requireSeller,(req,res,next)=>{
  if(!requireCloudinary(req,res))return;
  imageUpload.single("image")(req,res,async err=>{
    if(err)return fail(res,400,err.message);
    if(!req.file)return fail(res,400,"Escolha uma imagem.");
    try {
      const p=await getSeller(req.session.user.id),url=imageUrl(req);
      const r=await pool.query("UPDATE products SET image_url=$1 WHERE id=$2 AND seller_id=$3 RETURNING id",[url,req.params.id,p.id]);
      if(!r.rowCount)return fail(res,404,"Produto não encontrado.");
      res.json({image_url:url});
    } catch(e){console.error(e);fail(res,500,"Não foi possível salvar a imagem.");}
  });
});
app.delete("/api/seller/products/:id",requireSeller,async(req,res)=>{
  const p=await getSeller(req.session.user.id);
  const r=await pool.query("DELETE FROM products WHERE id=$1 AND seller_id=$2 RETURNING id",[req.params.id,p.id]);
  if(!r.rowCount)return fail(res,404,"Produto não encontrado.");
  res.json({ok:true});
});

app.get("/api/seller/hours",requireSeller,async(req,res)=>{
  const p=await getSeller(req.session.user.id);
  const r=await pool.query("SELECT day_of_week,is_open,open_time,close_time FROM business_hours WHERE seller_id=$1 ORDER BY day_of_week",[p.id]);
  res.json({hours:r.rows});
});
app.put("/api/seller/hours",requireSeller,async(req,res)=>{
  const p=await getSeller(req.session.user.id);
  if(!Array.isArray(req.body.hours))return fail(res,400,"Horários inválidos.");
  const client=await pool.connect();
  try {
    await client.query("BEGIN");
    for(const h of req.body.hours) {
      const day=Number(h.day_of_week);
      if(day<0||day>6)continue;
      await client.query(
        `INSERT INTO business_hours(seller_id,day_of_week,is_open,open_time,close_time)
         VALUES($1,$2,$3,$4,$5)
         ON CONFLICT(seller_id,day_of_week) DO UPDATE SET is_open=EXCLUDED.is_open,open_time=EXCLUDED.open_time,close_time=EXCLUDED.close_time`,
        [p.id,day,!!h.is_open,h.open_time||"09:00",h.close_time||"18:00"]
      );
    }
    await client.query("COMMIT");res.json({ok:true});
  } catch(e){await client.query("ROLLBACK");console.error(e);fail(res,500,"Não foi possível salvar os horários.");}
  finally{client.release();}
});


// O vendedor pode pausar temporariamente novos agendamentos sem apagar sua página.
app.put("/api/seller/availability",requireSeller,async(req,res)=>{
  try {
    const accepting=!!req.body.is_accepting_appointments;
    const message=String(req.body.away_message||"").trim().slice(0,300);
    const r=await pool.query(
      "UPDATE seller_profiles SET is_accepting_appointments=$1,away_message=$2 WHERE user_id=$3 RETURNING is_accepting_appointments,away_message",
      [accepting,message||null,req.session.user.id]
    );
    if(!r.rowCount)return fail(res,404,"Perfil profissional não encontrado.");
    res.json({availability:r.rows[0]});
  } catch(e){console.error(e);fail(res,500,"Não foi possível atualizar sua disponibilidade.");}
});

app.get("/api/seller/availability",requireSeller,async(req,res)=>{
  const p=await getSeller(req.session.user.id);
  if(!p)return fail(res,404,"Perfil profissional não encontrado.");
  res.json({availability:{is_accepting_appointments:p.is_accepting_appointments,away_message:p.away_message}});
});

// Lista de agendamentos da própria profissional.
app.get("/api/seller/appointments",requireSeller,async(req,res)=>{
  try {
    const p=await getSeller(req.session.user.id);
    const r=await pool.query(
      `SELECT a.id,a.appointment_date,a.appointment_time,a.notes,a.status,a.final_price_cents,a.created_at,
              u.name AS customer_name,u.email AS customer_email,
              s.name AS service_name,so.option_name AS technique
       FROM appointments a
       JOIN users u ON u.id=a.buyer_id
       JOIN services s ON s.id=a.service_id
       LEFT JOIN service_options so ON so.id=a.service_option_id
       WHERE a.seller_id=$1
       ORDER BY a.appointment_date DESC,a.appointment_time DESC`,
      [p.id]
    );
    res.json({appointments:r.rows});
  } catch(e){console.error(e);fail(res,500,"Não foi possível carregar os agendamentos.");}
});

// Atualiza o status somente dos agendamentos pertencentes à profissional logada.
app.patch("/api/seller/appointments/:id",requireSeller,async(req,res)=>{
  const allowed=["confirmed","rejected","completed","cancelled"];
  const status=String(req.body.status||"");
  if(!allowed.includes(status))return fail(res,400,"Status de agendamento inválido.");
  try {
    const p=await getSeller(req.session.user.id);
    const r=await pool.query(
      "UPDATE appointments SET status=$1 WHERE id=$2 AND seller_id=$3 RETURNING id,status",
      [status,req.params.id,p.id]
    );
    if(!r.rowCount)return fail(res,404,"Agendamento não encontrado.");
    res.json({appointment:r.rows[0]});
  } catch(e){console.error(e);fail(res,500,"Não foi possível atualizar o agendamento.");}
});

// Clientes autenticados podem solicitar horário em uma página profissional.
app.post("/api/appointments",requireLogin,async(req,res)=>{
  if(req.session.user.role!=="buyer")return fail(res,403,"Entre com uma conta de cliente para agendar.");
  const b=req.body||{};
  const client=await pool.connect();
  try {
    const sellerId=Number(b.seller_id),serviceId=Number(b.service_id);
    const optionId=b.service_option_id?Number(b.service_option_id):null;
    const date=String(b.appointment_date||""),time=String(b.appointment_time||"");
    if(!sellerId||!serviceId||!/^\\d{4}-\\d{2}-\\d{2}$/.test(date)||!/^([01]\\d|2[0-3]):[0-5]\\d$/.test(time))
      return fail(res,400,"Escolha um serviço, uma data e um horário válidos.");
    if(date < new Date().toISOString().slice(0,10))return fail(res,400,"Não é possível agendar em uma data passada.");
    await client.query("BEGIN");
    const p=await client.query("SELECT id,is_accepting_appointments FROM seller_profiles WHERE id=$1 AND is_active=TRUE FOR SHARE",[sellerId]);
    if(!p.rowCount) {await client.query("ROLLBACK");return fail(res,404,"Profissional não encontrada.");}
    if(!p.rows[0].is_accepting_appointments){await client.query("ROLLBACK");return fail(res,409,"Esta profissional está fora de expediente e não está recebendo agendamentos no momento.");}
    const service=await client.query("SELECT id,price_cents,duration_minutes FROM services WHERE id=$1 AND seller_id=$2 AND is_active=TRUE",[serviceId,sellerId]);
    if(!service.rowCount){await client.query("ROLLBACK");return fail(res,404,"Serviço não encontrado.");}
    let price=service.rows[0].price_cents;
    if(optionId){
      const opt=await client.query("SELECT extra_price_cents FROM service_options WHERE id=$1 AND service_id=$2",[optionId,serviceId]);
      if(!opt.rowCount){await client.query("ROLLBACK");return fail(res,400,"Técnica selecionada inválida.");}
      price+=opt.rows[0].extra_price_cents;
    }
    const weekday=new Date(date+"T12:00:00").getDay();
    const hours=await client.query("SELECT is_open,open_time,close_time FROM business_hours WHERE seller_id=$1 AND day_of_week=$2",[sellerId,weekday]);
    if(!hours.rowCount||!hours.rows[0].is_open){await client.query("ROLLBACK");return fail(res,409,"A profissional não atende nesse dia.");}
    if(time<hours.rows[0].open_time||time>=hours.rows[0].close_time){await client.query("ROLLBACK");return fail(res,409,"Esse horário está fora do expediente configurado.");}
    const created=await client.query(
      `INSERT INTO appointments(buyer_id,seller_id,service_id,service_option_id,appointment_date,appointment_time,notes,final_price_cents)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,status`,
      [req.session.user.id,sellerId,serviceId,optionId,date,time,String(b.notes||"").slice(0,1000),price]
    );
    await client.query("COMMIT");
    res.status(201).json({appointment:created.rows[0],message:"Solicitação de agendamento enviada. Aguarde a confirmação da profissional."});
  } catch(e) {
    await client.query("ROLLBACK");
    if(e.code==="23505")return fail(res,409,"Esse horário acabou de ser reservado. Escolha outro.");
    console.error(e);fail(res,500,"Não foi possível criar o agendamento.");
  } finally {client.release();}
});


// PEDIDOS DE PRODUTOS — o cliente compra de uma profissional por pedido.
app.post("/api/orders",requireLogin,async(req,res)=>{
  if(req.session.user.role!=="buyer")return fail(res,403,"Entre com uma conta de cliente para fazer pedidos.");
  const sellerId=Number(req.body.seller_id);
  const items=Array.isArray(req.body.items)?req.body.items:[];
  if(!sellerId||!items.length)return fail(res,400,"Seu pedido está vazio.");
  const client=await pool.connect();
  try{
    await client.query("BEGIN");
    const seller=await client.query("SELECT id FROM seller_profiles WHERE id=$1 AND is_active=TRUE",[sellerId]);
    if(!seller.rowCount){await client.query("ROLLBACK");return fail(res,404,"Profissional não encontrada.");}
    let total=0, clean=[];
    for(const item of items){
      const productId=Number(item.product_id),qty=Math.max(1,Math.min(99,Number(item.quantity)||1));
      const p=await client.query(
        "SELECT id,name,price_cents,stock_quantity FROM products WHERE id=$1 AND seller_id=$2 AND is_active=TRUE FOR UPDATE",
        [productId,sellerId]
      );
      if(!p.rowCount){await client.query("ROLLBACK");return fail(res,404,"Um dos produtos não está disponível.");}
      if(p.rows[0].stock_quantity<qty){await client.query("ROLLBACK");return fail(res,409,`Estoque insuficiente para ${p.rows[0].name}.`);}
      total+=p.rows[0].price_cents*qty;
      clean.push({...p.rows[0],quantity:qty});
    }
    const order=await client.query(
      "INSERT INTO orders(buyer_id,seller_id,status,total_cents) VALUES($1,$2,'pending',$3) RETURNING id,status,total_cents,created_at",
      [req.session.user.id,sellerId,total]
    );
    for(const item of clean){
      await client.query(
        "INSERT INTO order_items(order_id,product_id,product_name,quantity,unit_price_cents) VALUES($1,$2,$3,$4,$5)",
        [order.rows[0].id,item.id,item.name,item.quantity,item.price_cents]
      );
      await client.query("UPDATE products SET stock_quantity=stock_quantity-$1 WHERE id=$2",[item.quantity,item.id]);
    }
    await client.query("COMMIT");
    res.status(201).json({order:order.rows[0],message:"Pedido enviado à profissional! Você pode acompanhar em Meus pedidos."});
  }catch(e){await client.query("ROLLBACK");console.error(e);fail(res,500,"Não foi possível registrar seu pedido.");}
  finally{client.release();}
});

// Área do cliente: pedidos feitos e profissionais com quem agendou.
app.get("/api/customer/orders",requireLogin,async(req,res)=>{
  if(req.session.user.role!=="buyer")return fail(res,403,"Área exclusiva para clientes.");
  try{
    const orders=await pool.query(
      `SELECT o.id,o.status,o.total_cents,o.created_at,
              sp.id AS seller_id,sp.display_name AS seller_name,sp.specialty,
              COALESCE(json_agg(json_build_object('product_name',oi.product_name,'quantity',oi.quantity,'unit_price_cents',oi.unit_price_cents))
                FILTER (WHERE oi.id IS NOT NULL),'[]'::json) AS items
       FROM orders o JOIN seller_profiles sp ON sp.id=o.seller_id
       LEFT JOIN order_items oi ON oi.order_id=o.id
       WHERE o.buyer_id=$1
       GROUP BY o.id,sp.id ORDER BY o.created_at DESC`,
      [req.session.user.id]
    );
    const appointments=await pool.query(
      `SELECT a.id,a.appointment_date,a.appointment_time,a.status,a.final_price_cents,a.notes,
              sp.id AS seller_id,sp.display_name AS seller_name,sp.specialty,
              s.name AS service_name,so.option_name AS technique
       FROM appointments a JOIN seller_profiles sp ON sp.id=a.seller_id
       JOIN services s ON s.id=a.service_id
       LEFT JOIN service_options so ON so.id=a.service_option_id
       WHERE a.buyer_id=$1 ORDER BY a.appointment_date DESC,a.appointment_time DESC`,
      [req.session.user.id]
    );
    res.json({orders:orders.rows,appointments:appointments.rows});
  }catch(e){console.error(e);fail(res,500,"Não foi possível carregar seus pedidos.");}
});

// Área da profissional: todos os pedidos recebidos na própria loja.
app.get("/api/seller/orders",requireSeller,async(req,res)=>{
  try{
    const p=await getSeller(req.session.user.id);
    const r=await pool.query(
      `SELECT o.id,o.status,o.total_cents,o.created_at,u.name AS customer_name,u.email AS customer_email,
              COALESCE(json_agg(json_build_object('product_name',oi.product_name,'quantity',oi.quantity,'unit_price_cents',oi.unit_price_cents))
                FILTER (WHERE oi.id IS NOT NULL),'[]'::json) AS items
       FROM orders o JOIN users u ON u.id=o.buyer_id
       LEFT JOIN order_items oi ON oi.order_id=o.id
       WHERE o.seller_id=$1 GROUP BY o.id,u.id ORDER BY o.created_at DESC`,
      [p.id]
    );
    res.json({orders:r.rows});
  }catch(e){console.error(e);fail(res,500,"Não foi possível carregar os pedidos da sua loja.");}
});
app.patch("/api/seller/orders/:id",requireSeller,async(req,res)=>{
  const allowed=["processing","completed","cancelled"];
  const status=String(req.body.status||"");
  if(!allowed.includes(status))return fail(res,400,"Status inválido.");
  try{
    const p=await getSeller(req.session.user.id);
    const r=await pool.query(
      "UPDATE orders SET status=$1 WHERE id=$2 AND seller_id=$3 RETURNING id,status",
      [status,req.params.id,p.id]
    );
    if(!r.rowCount)return fail(res,404,"Pedido não encontrado.");
    res.json({order:r.rows[0]});
  }catch(e){console.error(e);fail(res,500,"Não foi possível atualizar o pedido.");}
});

// Error handler for upload and unexpected errors.
app.use((err,req,res,next)=>{
  console.error(err);
  res.status(400).json({error:err.message||"Erro inesperado no servidor."});
});

async function start(){
  try {
    await initDatabase();
    app.listen(PORT,()=>console.log(`Amora Beauty API rodando na porta ${PORT}`));
  } catch(e) {
    console.error("Falha ao conectar/criar as tabelas do PostgreSQL:",e);
    process.exit(1);
  }
}
start();
