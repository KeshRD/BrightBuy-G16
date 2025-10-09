// backend/server.js
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
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

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

// Middleware to log requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

const authenticate = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  console.log('Auth Header:', authHeader);
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    console.error('Authentication failed: No token provided');
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.error('Authentication failed: Invalid token', err.message);
      return res.status(403).json({ error: `Forbidden: Invalid token (${err.message})` });
    }
    console.log('Authenticated user:', user);
    req.user = user;
    next();
  });
};

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  console.log('Login attempt:', { email });
  try {
    const result = await pool.query('SELECT * FROM "User" WHERE email = $1', [email]);
    if (result.rows.length > 0) {
      const user = result.rows[0];
      const match = await bcrypt.compare(password, user.password);
      if (match) {
        const token = jwt.sign({ userId: user.user_id }, JWT_SECRET, { expiresIn: '1h' });
        console.log('Login successful:', { userId: user.user_id, email });
        res.json({ success: true, token, user: { user_id: user.user_id, name: user.name, role: user.role } });
      } else {
        console.error('Login failed: Invalid password for email', email);
        res.json({ success: false, message: 'Invalid credentials' });
      }
    } else {
      console.error('Login failed: Email not found', email);
      res.json({ success: false, message: 'Invalid credentials' });
    }
  } catch (err) {
    console.error('Login error:', err.stack);
    res.status(500).json({ success: false, message: 'Server error during login' });
  }
});

app.post('/signup', async (req, res) => {
  const { name, email, password, phone, role } = req.body;
  console.log('Signup attempt:', { email, role });
  try {
    const check = await pool.query('SELECT * FROM "User" WHERE email = $1', [email]);
    if (check.rows.length > 0) {
      console.error('Signup failed: Email already exists', email);
      return res.json({ success: false, message: 'Email already exists' });
    }

    const maxIdResult = await pool.query('SELECT MAX(user_id) FROM "User"');
    const nextId = (maxIdResult.rows[0].max || 0) + 1;

    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO "User" (user_id, name, email, password, phone, role) VALUES ($1, $2, $3, $4, $5, $6)',
      [nextId, name, email, hashedPassword, phone, role]
    );
    console.log('Signup successful:', { userId: nextId, email });
    res.json({ success: true });
  } catch (err) {
    console.error('Signup error:', err.stack);
    res.status(500).json({ success: false, message: 'Server error during signup' });
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
    console.log('Fetched products:', result.rows.length);
    res.json(result.rows);
  } catch (err) {
    console.error('Products fetch error:', err.stack);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

app.get('/products/:productId', async (req, res) => {
  const { productId } = req.params;
  console.log('Fetching product:', { productId });
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
      console.log('Product found:', { productId });
      res.json(result.rows[0]);
    } else {
      console.error('Product not found:', { productId });
      res.status(404).json({ error: 'Product not found' });
    }
  } catch (err) {
    console.error('Product detail fetch error:', err.stack);
    res.status(500).json({ error: 'Failed to fetch product details' });
  }
});

app.get('/cart', authenticate, async (req, res) => {
  const userId = req.user.userId;
  console.log('Fetching cart for user:', { userId });
  try {
    let cartResult = await pool.query('SELECT cart_id FROM "Cart" WHERE user_id = $1', [userId]);
    let cartId;
    if (cartResult.rows.length === 0) {
      console.log('Creating new cart for user:', { userId });
      cartResult = await pool.query(
        'INSERT INTO "Cart" (user_id) VALUES ($1) RETURNING cart_id',
        [userId]
      );
      cartId = cartResult.rows[0].cart_id;
    } else {
      cartId = cartResult.rows[0].cart_id;
    }
    console.log('Cart ID:', { cartId });

    const itemsResult = await pool.query(`
      SELECT ci.*, v.price, v.variant_name, v.stock_quantity,
             p.product_id, p.product_name, p.description, p."SKU",
             c.category_name
      FROM "CartItem" ci
      JOIN "Variant" v ON ci.variant_id = v.variant_id
      JOIN "Product" p ON v.product_id = p.product_id
      JOIN "Category" c ON p.category_id = c.category_id
      WHERE ci.cart_id = $1
    `, [cartId]);
    console.log('Cart items fetched:', itemsResult.rows.length);
    res.json(itemsResult.rows);
  } catch (err) {
    console.error('Cart fetch error:', err.stack);
    res.status(500).json({ error: 'Failed to fetch cart' });
  }
});

app.post('/cart/add', authenticate, async (req, res) => {
  const { variant_id, quantity = 1 } = req.body;
  const userId = req.user.userId;
  console.log('Add to cart request:', { userId, variant_id, quantity });

  try {
    if (!variant_id || quantity <= 0) {
      console.error('Invalid request: variant_id or quantity missing/invalid', { variant_id, quantity });
      return res.status(400).json({ success: false, message: 'Invalid variant_id or quantity' });
    }

    // Validate variant exists and has stock
    const variantResult = await pool.query(
      'SELECT stock_quantity FROM "Variant" WHERE variant_id = $1',
      [variant_id]
    );
    if (variantResult.rows.length === 0) {
      console.error('Invalid variant_id:', { variant_id });
      return res.status(400).json({ success: false, message: 'Variant not found' });
    }
    if (variantResult.rows[0].stock_quantity < quantity) {
      console.error('Insufficient stock for variant_id:', { variant_id, requested: quantity, available: variantResult.rows[0].stock_quantity });
      return res.status(400).json({ success: false, message: 'Insufficient stock' });
    }

    // Get or create cart
    let cartResult = await pool.query('SELECT cart_id FROM "Cart" WHERE user_id = $1', [userId]);
    let cartId;
    if (cartResult.rows.length === 0) {
      console.log('Creating new cart for user:', { userId });
      cartResult = await pool.query(
        'INSERT INTO "Cart" (user_id) VALUES ($1) RETURNING cart_id',
        [userId]
      );
      cartId = cartResult.rows[0].cart_id;
    } else {
      cartId = cartResult.rows[0].cart_id;
    }
    console.log('Using cart ID:', { cartId });

    // Check if item exists in cart
    const existingResult = await pool.query(
      'SELECT * FROM "CartItem" WHERE cart_id = $1 AND variant_id = $2',
      [cartId, variant_id]
    );
    if (existingResult.rows.length > 0) {
      console.log('Updating existing cart item:', { cart_item_id: existingResult.rows[0].cart_item_id, variant_id });
      await pool.query(
        'UPDATE "CartItem" SET quantity = quantity + $1 WHERE cart_item_id = $2',
        [quantity, existingResult.rows[0].cart_item_id]
      );
    } else {
      console.log('Adding new cart item:', { cartId, variant_id, quantity });
      await pool.query(
        'INSERT INTO "CartItem" (cart_id, variant_id, quantity) VALUES ($1, $2, $3)',
        [cartId, variant_id, quantity]
      );
    }
    console.log('Cart item added/updated successfully');
    res.json({ success: true });
  } catch (err) {
    console.error('Add to cart error:', err.stack);
    res.status(500).json({ success: false, message: `Server error adding to cart: ${err.message}` });
  }
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});