const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  console.warn("AVISO: DATABASE_URL não configurada. Defina a variável do PostgreSQL no Render ou no .env local.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role VARCHAR(20) NOT NULL CHECK (role IN ('buyer','seller','admin')) DEFAULT 'buyer',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS seller_profiles (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      display_name VARCHAR(150) NOT NULL,
      specialty VARCHAR(120) NOT NULL DEFAULT 'Profissional da beleza',
      city VARCHAR(150),
      bio TEXT,
      instagram VARCHAR(150),
      whatsapp VARCHAR(30),
      photo_url TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      is_accepting_appointments BOOLEAN NOT NULL DEFAULT TRUE,
      away_message TEXT
    );
    CREATE TABLE IF NOT EXISTS services (
      id BIGSERIAL PRIMARY KEY,
      seller_id BIGINT NOT NULL REFERENCES seller_profiles(id) ON DELETE CASCADE,
      name VARCHAR(150) NOT NULL,
      description TEXT,
      price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
      duration_minutes INTEGER NOT NULL DEFAULT 60,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS service_options (
      id BIGSERIAL PRIMARY KEY,
      service_id BIGINT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
      option_name VARCHAR(120) NOT NULL,
      extra_price_cents INTEGER NOT NULL DEFAULT 0,
      UNIQUE(service_id, option_name)
    );
    CREATE TABLE IF NOT EXISTS products (
      id BIGSERIAL PRIMARY KEY,
      seller_id BIGINT NOT NULL REFERENCES seller_profiles(id) ON DELETE CASCADE,
      name VARCHAR(150) NOT NULL,
      description TEXT,
      price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
      stock_quantity INTEGER NOT NULL DEFAULT 0,
      image_url TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS business_hours (
      id BIGSERIAL PRIMARY KEY,
      seller_id BIGINT NOT NULL REFERENCES seller_profiles(id) ON DELETE CASCADE,
      day_of_week INTEGER NOT NULL CHECK(day_of_week BETWEEN 0 AND 6),
      is_open BOOLEAN NOT NULL DEFAULT FALSE,
      open_time VARCHAR(5) NOT NULL DEFAULT '09:00',
      close_time VARCHAR(5) NOT NULL DEFAULT '18:00',
      UNIQUE(seller_id, day_of_week)
    );
    CREATE TABLE IF NOT EXISTS appointments (
      id BIGSERIAL PRIMARY KEY,
      buyer_id BIGINT NOT NULL REFERENCES users(id),
      seller_id BIGINT NOT NULL REFERENCES seller_profiles(id),
      service_id BIGINT NOT NULL REFERENCES services(id),
      service_option_id BIGINT REFERENCES service_options(id),
      appointment_date DATE NOT NULL,
      appointment_time VARCHAR(5) NOT NULL,
      notes TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK(status IN ('pending','confirmed','completed','cancelled','rejected')),
      final_price_cents INTEGER NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS unique_active_seller_slot
      ON appointments(seller_id, appointment_date, appointment_time)
      WHERE status IN ('pending','confirmed');
    CREATE TABLE IF NOT EXISTS orders (
      id BIGSERIAL PRIMARY KEY,
      buyer_id BIGINT NOT NULL REFERENCES users(id),
      seller_id BIGINT NOT NULL REFERENCES seller_profiles(id),
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      total_cents INTEGER NOT NULL,
      delivery_notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS order_items (
      id BIGSERIAL PRIMARY KEY,
      order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id BIGINT NOT NULL REFERENCES products(id),
      product_name VARCHAR(150) NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price_cents INTEGER NOT NULL
    );
    ALTER TABLE seller_profiles ADD COLUMN IF NOT EXISTS is_accepting_appointments BOOLEAN NOT NULL DEFAULT TRUE;
    ALTER TABLE seller_profiles ADD COLUMN IF NOT EXISTS away_message TEXT;
    CREATE INDEX IF NOT EXISTS idx_services_seller ON services(seller_id);
    CREATE INDEX IF NOT EXISTS idx_products_seller ON products(seller_id);
  `);
}
module.exports = { pool, initDatabase };
