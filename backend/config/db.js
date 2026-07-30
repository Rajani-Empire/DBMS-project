const mysql = require('mysql2/promise');
require('dotenv').config();

// Create the connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,     // Maximizes performance by keeping 10 active connections ready
  queueLimit: 0            // Infinite queueing when connections are busy
});

// Export the pool directly
module.exports = pool;