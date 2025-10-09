// backend/server.js
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM "User" WHERE email = $1', [email]);
    if (result.rows.length > 0) {
      const user = result.rows[0];
      const match = await bcrypt.compare(password, user.password);
      if (match) {
        res.json({ success: true });
      } else {
        res.json({ success: false });
      }
    } else {
      res.json({ success: false });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

app.post('/signup', async (req, res) => {
  const { name, email, password, phone, role } = req.body;
  try {
    const check = await pool.query('SELECT * FROM "User" WHERE email = $1', [email]);
    if (check.rows.length > 0) {
      return res.json({ success: false, message: 'Email already exists' });
    }

    const maxIdResult = await pool.query('SELECT MAX(user_id) FROM "User"');
    const nextId = (maxIdResult.rows[0].max || 0) + 1;

    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO "User" (user_id, name, email, password, phone, role) VALUES ($1, $2, $3, $4, $5, $6)',
      [nextId, name, email, hashedPassword, phone, role]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

app.get('/products', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, c.category_name, ARRAY_AGG(
        JSON_BUILD_OBJECT(
          'variant_id', v.variant_id,
          'variant_name', v.variant_name,
          'price', v.price,
          'stock_quantity', v.stock_quantity
        )
      ) as variants
      FROM "Product" p
      JOIN "Category" c ON p.category_id = c.category_id
      LEFT JOIN "Variant" v ON p.product_id = v.product_id
      GROUP BY p.product_id, c.category_name
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

app.get('/products/:productId', async (req, res) => {
  const { productId } = req.params;
  try {
    const result = await pool.query(`
      SELECT p.*, c.category_name, ARRAY_AGG(
        JSON_BUILD_OBJECT(
          'variant_id', v.variant_id,
          'variant_name', v.variant_name,
          'price', v.price,
          'stock_quantity', v.stock_quantity
        )
      ) as variants
      FROM "Product" p
      JOIN "Category" c ON p.category_id = c.category_id
      LEFT JOIN "Variant" v ON p.product_id = v.product_id
      WHERE p.product_id = $1
      GROUP BY p.product_id, c.category_name
    `, [productId]);
    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res.status(404).json({ error: 'Product not found' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch product details' });
  }
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});