// backend/server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const adminRoutes = require('./routes/admin');
const driverRoutes = require('./routes/driver');
const uploadRoutes = require('./routes/upload');
const customerOrderReportRoutes = require('./routes/customerorderreport');
const upcomingDeliveriesRoutes = require('./routes/Upcomingdelivers');


const app = express();

/* ===== CORS (respect .env CORS_ORIGIN) ===== */
// Allow multiple dev origins and respect CORS_ORIGIN env var (comma-separated)
const allowedOrigins = (process.env.CORS_ORIGIN && process.env.CORS_ORIGIN.split(',')) || [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3003',
  'http://localhost:3004',
  'http://localhost:3005',
];

app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (e.g. mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    return callback(new Error('CORS policy: Origin not allowed'));
  },
  credentials: true,
}));

/* ===== Body parsers ===== */
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

/* ===== Static assets (product images) ===== */
app.use('/Assets', express.static(path.join(__dirname, 'Assets')));

/* ===== Mount route groups ===== */
app.use('/api/admin', adminRoutes);
app.use('/api/driver', driverRoutes);
app.use('/api/admin/upload', uploadRoutes);
app.use('/api/reports', customerOrderReportRoutes);
app.use('/api/orders', upcomingDeliveriesRoutes);

/* ===== DB Pool ===== */
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

/* ===== JWT secret ===== */
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

/* ===== Request logger (debug) ===== */
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

/* ===== Lightweight ping for debugging connectivity/CORS ===== */
app.get('/ping', (req, res) => {
  // echo back origin/header info useful for debugging CORS/network issues
  res.json({ ok: true, origin: req.get('origin') || null, host: req.get('host') });
});

/* ===== Helpers ===== */
const processImage = (row) => {
  if (row.image && Buffer.isBuffer(row.image)) {
    return { ...row, image: `data:image/png;base64,${row.image.toString('base64')}` };
  }
  return row;
};

const authenticate = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized: No token provided' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: `Forbidden: Invalid token (${err.message})` });
    req.user = user; // { userId, role }
    next();
  });
};

/* ===== Auth: Login / Signup ===== */
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const lowerEmail = String(email || '').toLowerCase();

  try {
    const result = await pool.query('SELECT * FROM "User" WHERE email = $1', [lowerEmail]);
    if (result.rows.length === 0) {
      return res.json({ success: false, message: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.json({ success: false, message: 'Invalid credentials' });

    // include role in token
    const token = jwt.sign({ userId: user.user_id, role: user.role }, JWT_SECRET, { expiresIn: '1h' });

    // return more user fields so Profile can show without another call
    return res.json({
      success: true,
      token,
      user: {
        user_id: user.user_id,
        name: user.name,
        email: user.email,   // added
        phone: user.phone,   // added
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Login error:', err.stack || err);
    res.status(500).json({ success: false, message: 'Server error during login' });
  }
});

app.post('/signup', async (req, res) => {
  const { name, email, password, phone, role } = req.body;
  const lowerEmail = String(email || '').toLowerCase();

  try {
    const check = await pool.query('SELECT 1 FROM "User" WHERE email = $1', [lowerEmail]);
    if (check.rows.length > 0) {
      return res.json({ success: false, message: 'Email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO "User" (name, email, password, phone, role) VALUES ($1, $2, $3, $4, $5)',
      [name, lowerEmail, hashedPassword, phone, role]
    );

    console.log('✅ User created successfully:', email);
    res.json({ success: true });
  } catch (err) {
    console.error('❌ Signup error:', err.stack || err);
    res.status(500).json({ success: false, message: 'Server error during signup' });
  }
});

/* ===== Products ===== */
app.get('/products', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, c.category_name, ARRAY_AGG(
        JSON_BUILD_OBJECT(
          'variant_id', v.variant_id, 'variant_name', v.variant_name,
          'price', v.price, 'stock_quantity', v.stock_quantity
        )
      ) as variants
      FROM "Product" p
      JOIN "Category" c ON p.category_id = c.category_id
      LEFT JOIN "Variant" v ON p.product_id = v.product_id
      GROUP BY p.product_id, c.category_name
    `);

    const processed = result.rows.map(processImage);
    res.json(processed);
  } catch (err) {
    console.error('GET /products error:', err.stack || err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

app.get('/products/:productId', async (req, res) => {
  const { productId } = req.params;
  try {
    const result = await pool.query(`
      SELECT p.*, c.category_name, ARRAY_AGG(
        JSON_BUILD_OBJECT(
          'variant_id', v.variant_id, 'variant_name', v.variant_name,
          'price', v.price, 'stock_quantity', v.stock_quantity
        )
      ) as variants
      FROM "Product" p
      JOIN "Category" c ON p.category_id = c.category_id
      LEFT JOIN "Variant" v ON p.product_id = v.product_id
      WHERE p.product_id = $1
      GROUP BY p.product_id, c.category_name
    `, [productId]);

    if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found' });

    const processed = processImage(result.rows[0]);
    res.json(processed);
  } catch (err) {
    console.error('GET /products/:id error:', err.stack || err);
    res.status(500).json({ error: 'Failed to fetch product details' });
  }
});

/* ===== Cart ===== */
app.get('/cart', authenticate, async (req, res) => {
  const userId = req.user.userId;
  try {
    const cartResult = await pool.query('SELECT cart_id FROM "Cart" WHERE user_id = $1', [userId]);
    if (cartResult.rows.length === 0) return res.json([]);

    const cartId = cartResult.rows[0].cart_id;
    const itemsResult = await pool.query(`
      SELECT ci.*, v.price, v.variant_name, v.stock_quantity, p.product_id, p.product_name, p.image
      FROM "CartItem" ci
      JOIN "Variant" v ON ci.variant_id = v.variant_id
      JOIN "Product" p ON v.product_id = p.product_id
      WHERE ci.cart_id = $1
    `, [cartId]);

    const processed = itemsResult.rows.map(processImage);
    res.json(processed);
  } catch (err) {
    console.error('GET /cart error:', err.stack || err);
    res.status(500).json({ error: 'Failed to fetch cart' });
  }
});

app.post('/cart/add', authenticate, async (req, res) => {
  const { variant_id, quantity = 1 } = req.body;
  const userId = req.user.userId;

  try {
    const variantResult = await pool.query('SELECT stock_quantity FROM "Variant" WHERE variant_id = $1', [variant_id]);
    if (variantResult.rows.length === 0 || variantResult.rows[0].stock_quantity < quantity) {
      return res.status(400).json({ success: false, message: 'Insufficient stock or variant not found' });
    }

    let cartResult = await pool.query('SELECT cart_id FROM "Cart" WHERE user_id = $1', [userId]);
    if (cartResult.rows.length === 0) {
      cartResult = await pool.query('INSERT INTO "Cart" (user_id) VALUES ($1) RETURNING cart_id', [userId]);
    }
    const cartId = cartResult.rows[0].cart_id;

    const existing = await pool.query('SELECT cart_item_id, quantity FROM "CartItem" WHERE cart_id = $1 AND variant_id = $2', [cartId, variant_id]);
    if (existing.rows.length > 0) {
      await pool.query('UPDATE "CartItem" SET quantity = quantity + $1 WHERE cart_item_id = $2', [quantity, existing.rows[0].cart_item_id]);
    } else {
      await pool.query('INSERT INTO "CartItem" (cart_id, variant_id, quantity) VALUES ($1, $2, $3)', [cartId, variant_id, quantity]);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('POST /cart/add error:', err.stack || err);
    res.status(500).json({ success: false, message: `Server error adding to cart: ${err.message}` });
  }
});

app.post('/cart/update', authenticate, async (req, res) => {
  const { cart_item_id, quantity } = req.body;
  if (!cart_item_id || !quantity || quantity < 1) {
    return res.status(400).json({ success: false, message: 'Invalid request data.' });
  }

  try {
    const itemResult = await pool.query('SELECT variant_id FROM "CartItem" WHERE cart_item_id = $1', [cart_item_id]);
    if (itemResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Cart item not found.' });
    }

    const { variant_id } = itemResult.rows[0];
    const variantResult = await pool.query('SELECT stock_quantity FROM "Variant" WHERE variant_id = $1', [variant_id]);
    if (variantResult.rows[0].stock_quantity < quantity) {
      return res.status(400).json({ success: false, message: 'Insufficient stock.' });
    }

    await pool.query('UPDATE "CartItem" SET quantity = $1 WHERE cart_item_id = $2', [quantity, cart_item_id]);
    res.json({ success: true, message: 'Cart updated.' });
  } catch (err) {
    console.error('POST /cart/update error:', err.stack || err);
    res.status(500).json({ success: false, message: 'Server error while updating cart.' });
  }
});

app.get('/cities', async (req, res) => {
  try {
    const result = await pool.query('SELECT city_name FROM "Cities" ORDER BY city_name');
    // Extract just the names into a simple array to send to the frontend
    const cityNames = result.rows.map(row => row.city_name);
    res.json(cityNames);
  } catch (err) {
    console.error('Cities fetch error:', err.stack);
    res.status(500).json({ error: 'Failed to fetch cities' });
  }
});


app.delete('/cart/remove/:cartItemId', authenticate, async (req, res) => {
  const { cartItemId } = req.params;
  try {
    const del = await pool.query('DELETE FROM "CartItem" WHERE cart_item_id = $1', [cartItemId]);
    if (del.rowCount === 0) return res.status(404).json({ success: false, message: 'Item not found in cart.' });
    res.json({ success: true, message: 'Item removed from cart.' });
  } catch (err) {
    console.error('DELETE /cart/remove error:', err.stack || err);
    res.status(500).json({ success: false, message: 'Server error while removing from cart.' });
  }
});

/* ===== Payments / Orders ===== */
const validateCardDetails = (cardDetails) => {
  if (!cardDetails || !cardDetails.number || !cardDetails.expiry || !cardDetails.cvc) {
    return { valid: false, message: 'Incomplete card details.' };
  }
  if (cardDetails.number.endsWith('0000')) {
    return { valid: false, message: 'Payment processor declined the card.' };
  }
  if (cardDetails.number.replace(/\s/g, '').length !== 16) {
    return { valid: false, message: 'Invalid card number format.' };
  }
  if (String(cardDetails.cvc).length !== 3) {
    return { valid: false, message: 'Invalid Security Code.' };
  }
  return { valid: true, message: 'Payment successful.' };
};

app.post('/create-order', authenticate, async (req, res) => {
  const { items, total, shippingAddress, deliveryMethod, paymentMethod, estimatedDeliveryDate, cardDetails } = req.body;
  const userId = req.user.userId;
  const client = await pool.connect();

  try {
    if (paymentMethod === 'Card Payment') {
      const validation = validateCardDetails(cardDetails);
      if (!validation.valid) return res.status(400).json({ success: false, message: validation.message });
    }

    await client.query('BEGIN');

    const deliveryAddress = `${shippingAddress.address}, ${shippingAddress.city}, ${shippingAddress.postalCode}`;
    let paymentStatus = 'Pending';
    let orderStatus = 'Pending';
    if (paymentMethod === 'Card Payment') {
      paymentStatus = 'Paid';
      orderStatus = 'Confirmed';
    }

    const orderResult = await client.query(
      `INSERT INTO "Order" (user_id, order_date, mode_of_delivery, payment_method, delivery_address, order_status, estimated_delivery_date)
       VALUES ($1, NOW(), $2, $3, $4, $5, $6)
       RETURNING order_id, order_date`,
      [userId, deliveryMethod, paymentMethod, deliveryAddress, orderStatus, new Date(estimatedDeliveryDate)]
    );
    const newOrder = orderResult.rows[0];
    const orderId = newOrder.order_id;

    for (const item of items) {
      await client.query(
        `INSERT INTO "OrderItem" (order_id, variant_id, quantity, price_at_purchase)
         VALUES ($1, $2, $3, $4)`,
        [orderId, item.variant_id, item.quantity, item.price]
      );

      const stockUpdate = await client.query(
        `UPDATE "Variant" SET stock_quantity = stock_quantity - $1
         WHERE variant_id = $2 AND stock_quantity >= $1`,
        [item.quantity, item.variant_id]
      );
      if (stockUpdate.rowCount === 0) throw new Error(`Insufficient stock for variant ${item.variant_name}.`);
    }

    await client.query(
      `INSERT INTO "Payment" (order_id, payment_method, payment_status, payment_date)
       VALUES ($1, $2, $3, NOW())`,
      [orderId, paymentMethod, paymentStatus]
    );

    const cartResult = await client.query('SELECT cart_id FROM "Cart" WHERE user_id = $1', [userId]);
    if (cartResult.rows.length > 0) {
      const cartId = cartResult.rows[0].cart_id;
      await client.query('DELETE FROM "CartItem" WHERE cart_id = $1', [cartId]);
    }

    await client.query('COMMIT');

    const finalOrderDetails = {
      order_id: orderId,
      order_date: newOrder.order_date,
      total_amount: total,
      shipping_address: deliveryAddress,
      estimatedDeliveryDate,
      items: items.map(i => ({ ...i })),
    };

    res.json({ success: true, order: finalOrderDetails });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create order error:', err.stack || err);
    res.status(500).json({ success: false, message: `Server error while creating order: ${err.message}` });
  } finally {
    client.release();
  }
});

app.get('/orders', authenticate, async (req, res) => {
  const userId = req.user.userId;

  try {
    const query = `
      SELECT
        o.order_id,
        o.order_date,
        o.order_status,
        COALESCE(pay.payment_status, 'Pending') AS payment_status,
        SUM(oi.quantity * oi.price_at_purchase) AS total_amount,
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'variant_id', v.variant_id,
            'product_name', p.product_name,
            'variant_name', v.variant_name,
            'quantity', oi.quantity,
            'price_at_purchase', oi.price_at_purchase
          )
        ) AS items,
        -- derive the bucket for UI
        CASE
          WHEN COALESCE(pay.payment_status, 'Pending') = 'Pending' THEN 'toPay'
          WHEN o.order_status = 'Pending' THEN 'toShip'
          WHEN o.order_status = 'In Transit' THEN 'toReceive'
          WHEN o.order_status = 'Delivered' THEN 'received'
          ELSE 'other'
        END AS bucket
      FROM "Order" o
      LEFT JOIN "OrderItem" oi ON o.order_id = oi.order_id
      LEFT JOIN "Variant" v ON oi.variant_id = v.variant_id
      LEFT JOIN "Product" p ON v.product_id = p.product_id
      LEFT JOIN "Payment" pay ON pay.order_id = o.order_id
      WHERE o.user_id = $1
      GROUP BY o.order_id, o.order_date, o.order_status, pay.payment_status
      ORDER BY o.order_date DESC;
    `;

    const { rows } = await pool.query(query, [userId]);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching orders:', err.stack);
    res.status(500).json({ success: false, message: 'Failed to fetch orders' });
  }
});

/* ===== Debug helper (optional) ===== */
app.get('/debug/user-columns', async (req, res) => {
  try {
    const q = `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE lower(table_name) = 'user'
      ORDER BY ordinal_position
    `;
    const { rows } = await pool.query(q);
    res.json(rows);
  } catch (err) {
    console.error('Debug schema error:', err.stack || err);
    res.status(500).json({ error: 'Failed to fetch schema info' });
  }
});

/* ===== Who am I (for Profile page) ===== */
app.get('/api/me', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT user_id, name, email, phone, role FROM "User" WHERE user_id = $1',
      [req.user.userId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('GET /api/me error:', err.stack || err);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ===== Start server ===== */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
