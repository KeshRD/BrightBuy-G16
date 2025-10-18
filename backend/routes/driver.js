const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

const authenticateDriver = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized: No token' });
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Forbidden: Invalid token' });
    if (decoded.role !== 'Delivery Driver') return res.status(403).json({ error: 'Forbidden: Not a driver' });
    req.user = decoded;
    next();
  });
};

// Example route: get driver profile
router.get('/profile', authenticateDriver, async (req, res) => {
  try {
    const result = await pool.query('SELECT user_id, name, email, phone, role FROM "User" WHERE user_id = $1', [req.user.userId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Driver not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Driver profile fetch error:', err.stack || err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all delivery entries for the delivery portal
router.get('/deliveries', authenticateDriver, async (req, res) => {
  try {
    const query = `
      SELECT
        d.delivery_id,
        d.order_id,
        d.estimated_delivery_date AS arrival_date,
        COALESCE(d.delivery_address, o.delivery_address) AS delivery_address,
        u.name AS customer_name,
        pay.payment_method,
        COALESCE(SUM(oi.quantity * oi.price_at_purchase), 0) AS total_price,
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'variant_id', v.variant_id,
            'product_name', prod.product_name,
            'variant_name', v.variant_name,
            'quantity', oi.quantity,
            'price', oi.price_at_purchase
          ) ORDER BY oi.order_item_id
        ) FILTER (WHERE oi.order_item_id IS NOT NULL) AS items
      FROM delivery d
      JOIN "order" o ON d.order_id = o.order_id
      JOIN "user" u ON o.user_id = u.user_id
      LEFT JOIN payment pay ON o.order_id = pay.order_id
      LEFT JOIN orderitem oi ON o.order_id = oi.order_id
      LEFT JOIN variant v ON oi.variant_id = v.variant_id
      LEFT JOIN product prod ON v.product_id = prod.product_id
      GROUP BY d.delivery_id, d.order_id, d.estimated_delivery_date, d.delivery_address, u.name, pay.payment_method, o.delivery_address
      ORDER BY d.estimated_delivery_date DESC NULLS LAST, d.delivery_id DESC;
    `;

    const { rows } = await pool.query(query);

    // Map arrival_date to ISO strings for easier frontend formatting
    const processed = rows.map(r => ({
      ...r,
      arrival_date: r.arrival_date ? r.arrival_date.toISOString() : null,
      total_price: parseFloat(r.total_price) || 0,
      items: r.items || []
    }));

    res.json(processed);
  } catch (err) {
    console.error('Error fetching deliveries:', err.stack || err);
    res.status(500).json({ error: 'Server error while fetching deliveries' });
  }
});

module.exports = router;
