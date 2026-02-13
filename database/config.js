const mysql = require("mysql");
const mysqls = require("mysql2/promise");

const pool = mysqls.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,       // Puedes ajustar este número según tu necesidad
  queueLimit: 0
});

module.exports = { pool };