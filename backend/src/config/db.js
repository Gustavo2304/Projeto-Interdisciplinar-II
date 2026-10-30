// Conexão com o PostgreSQL: um pool de conexões compartilhado por toda a API.
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || 'hermespdv',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD,
});

module.exports = pool;
