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
      COALESCE(d.delivery_status, 'Unknown') AS delivery_status,
      d.user_id AS driver_id,
      du.name AS driver_name,
      o.order_status AS order_status,
    o.delivery_address AS delivery_address,
    cu.name AS customer_name,
    pay.payment_method,
    pay.payment_status AS payment_status,
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
  FROM "Delivery" d
  JOIN "Order" o ON d.order_id = o.order_id
  JOIN "User" cu ON o.user_id = cu.user_id
  LEFT JOIN "User" du ON d.user_id = du.user_id
  LEFT JOIN "Payment" pay ON o.order_id = pay.order_id
  LEFT JOIN "OrderItem" oi ON o.order_id = oi.order_id
  LEFT JOIN "Variant" v ON oi.variant_id = v.variant_id
  LEFT JOIN "Product" prod ON v.product_id = prod.product_id
  GROUP BY d.delivery_id, d.order_id, d.estimated_delivery_date, d.delivery_status, d.user_id, du.name, o.order_status, cu.name, pay.payment_method, pay.payment_status, o.delivery_address
  ORDER BY d.estimated_delivery_date DESC NULLS LAST, d.delivery_id DESC;
`;


    const { rows } = await pool.query(query);

    // Prevent client caching so we always return fresh data
    res.set('Cache-Control', 'no-store');

    // Map arrival_date to ISO strings for easier frontend formatting
    const processed = rows.map(r => ({
      ...r,
      arrival_date: r.arrival_date ? r.arrival_date.toISOString() : null,
      total_price: parseFloat(r.total_price) || 0,
      items: r.items || [],
      delivery_status: r.delivery_status || 'Unknown',
      order_status: r.order_status || null,
      driver_id: r.driver_id || null,
      driver_name: r.driver_name || null,
      payment_status: r.payment_status || 'Pending'
    }));

    res.json(processed);
  } catch (err) {

    console.error('Error fetching deliveries:', err.message);
    console.error(err.stack);

    res.status(500).json({ error: 'Server error while fetching deliveries' });
  }
});

// Claim a delivery: set to In Transit and assign current driver if it's Pending and unassigned
router.post('/deliveries/:id/claim', authenticateDriver, async (req, res) => {
  try {
    const deliveryId = parseInt(req.params.id, 10);
    if (Number.isNaN(deliveryId)) return res.status(400).json({ error: 'Invalid delivery id' });

    const driverId = req.user.userId;

    const claimRes = await pool.query(
      'UPDATE "Delivery" SET user_id = $1, delivery_status = $2 WHERE delivery_id = $3 AND (delivery_status = $4 OR delivery_status IS NULL) AND user_id IS NULL RETURNING delivery_id',
      [driverId, 'In Transit', deliveryId, 'Pending']
    );

    if (claimRes.rowCount === 0) {
      return res.status(409).json({ error: 'Delivery already claimed or not pending' });
    }

    const selectOneQuery = `
      SELECT
        d.delivery_id,
        d.order_id,
        d.estimated_delivery_date AS arrival_date,
        COALESCE(d.delivery_status, 'Unknown') AS delivery_status,
        d.user_id AS driver_id,
        du.name AS driver_name,
        o.order_status AS order_status,
        o.delivery_address AS delivery_address,
        cu.name AS customer_name,
        pay.payment_method,
        pay.payment_status AS payment_status,
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
      FROM "Delivery" d
      JOIN "Order" o ON d.order_id = o.order_id
      JOIN "User" cu ON o.user_id = cu.user_id
      LEFT JOIN "User" du ON d.user_id = du.user_id
      LEFT JOIN "Payment" pay ON o.order_id = pay.order_id
      LEFT JOIN "OrderItem" oi ON o.order_id = oi.order_id
      LEFT JOIN "Variant" v ON oi.variant_id = v.variant_id
      LEFT JOIN "Product" prod ON v.product_id = prod.product_id
      WHERE d.delivery_id = $1
      GROUP BY d.delivery_id, d.order_id, d.estimated_delivery_date, d.delivery_status, d.user_id, du.name, o.order_status, cu.name, pay.payment_method, pay.payment_status, o.delivery_address;
    `;

    const { rows } = await pool.query(selectOneQuery, [deliveryId]);

    if (rows.length === 0) return res.status(404).json({ error: 'Delivery not found after claim' });

    res.set('Cache-Control', 'no-store');

    const r = rows[0];
    const processed = {
      ...r,
      arrival_date: r.arrival_date ? r.arrival_date.toISOString() : null,
      total_price: parseFloat(r.total_price) || 0,
      items: r.items || [],
      delivery_status: r.delivery_status || 'Unknown',
      order_status: r.order_status || null,
      driver_id: r.driver_id || null,
      driver_name: r.driver_name || null,
      payment_status: r.payment_status || 'Pending'
    };

    res.json(processed);
  } catch (err) {
    console.error('Error claiming delivery:', err.message);
    console.error(err.stack);
    res.status(500).json({ error: 'Server error while claiming delivery' });
  }
});

// Update delivery status from In Transit to Delivered/Failed by assigned driver only
router.patch('/deliveries/:id/status', authenticateDriver, async (req, res) => {
  try {
    const deliveryId = parseInt(req.params.id, 10);
    if (Number.isNaN(deliveryId)) return res.status(400).json({ error: 'Invalid delivery id' });

    const { status } = req.body || {};
    if (!['Delivered', 'Failed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be Delivered or Failed.' });
    }

    const driverId = req.user.userId;

    const updRes = await pool.query(
      'UPDATE "Delivery" SET delivery_status = $1 WHERE delivery_id = $2 AND delivery_status = $3 AND user_id = $4 RETURNING delivery_id',
      [status, deliveryId, 'In Transit', driverId]
    );

    if (updRes.rowCount === 0) {
      return res.status(403).json({ error: 'Not allowed: You are not assigned to this delivery or it is not in transit' });
    }

    const selectOneQuery = `
      SELECT
        d.delivery_id,
        d.order_id,
        d.estimated_delivery_date AS arrival_date,
        COALESCE(d.delivery_status, 'Unknown') AS delivery_status,
        d.user_id AS driver_id,
        du.name AS driver_name,
        o.order_status AS order_status,
        o.delivery_address AS delivery_address,
        cu.name AS customer_name,
        pay.payment_method,
        pay.payment_status AS payment_status,
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
      FROM "Delivery" d
      JOIN "Order" o ON d.order_id = o.order_id
      JOIN "User" cu ON o.user_id = cu.user_id
      LEFT JOIN "User" du ON d.user_id = du.user_id
      LEFT JOIN "Payment" pay ON o.order_id = pay.order_id
      LEFT JOIN "OrderItem" oi ON o.order_id = oi.order_id
      LEFT JOIN "Variant" v ON oi.variant_id = v.variant_id
      LEFT JOIN "Product" prod ON v.product_id = prod.product_id
      WHERE d.delivery_id = $1
      GROUP BY d.delivery_id, d.order_id, d.estimated_delivery_date, d.delivery_status, d.user_id, du.name, o.order_status, cu.name, pay.payment_method, pay.payment_status, o.delivery_address;
    `;

    const { rows } = await pool.query(selectOneQuery, [deliveryId]);

    if (rows.length === 0) return res.status(404).json({ error: 'Delivery not found after update' });

    res.set('Cache-Control', 'no-store');

    const r = rows[0];
    const processed = {
      ...r,
      arrival_date: r.arrival_date ? r.arrival_date.toISOString() : null,
      total_price: parseFloat(r.total_price) || 0,
      items: r.items || [],
      delivery_status: r.delivery_status || 'Unknown',
      order_status: r.order_status || null,
      driver_id: r.driver_id || null,
      driver_name: r.driver_name || null,
      payment_status: r.payment_status || 'Pending'
    };

    res.json(processed);
  } catch (err) {
    console.error('Error updating delivery status:', err.message);
    console.error(err.stack);
    res.status(500).json({ error: 'Server error while updating delivery status' });
  }
});

// Mark payment status as Paid for a delivery (assigned driver only)
router.patch('/deliveries/:id/payment-status', authenticateDriver, async (req, res) => {
  try {
    const deliveryId = parseInt(req.params.id, 10);
    if (Number.isNaN(deliveryId)) return res.status(400).json({ error: 'Invalid delivery id' });

    // Ensure caller is the assigned driver
    const dRes = await pool.query('SELECT user_id, order_id FROM "Delivery" WHERE delivery_id = $1', [deliveryId]);
    if (dRes.rows.length === 0) return res.status(404).json({ error: 'Delivery not found' });
    const { user_id: assignedDriverId, order_id } = dRes.rows[0];
    if (!assignedDriverId || assignedDriverId !== req.user.userId) {
      return res.status(403).json({ error: 'Not allowed: You are not assigned to this delivery' });
    }

    // Update payment to Paid
    const upd = await pool.query(
      'UPDATE "Payment" p SET payment_status = $1, payment_date = NOW() FROM "Delivery" d WHERE d.delivery_id = $2 AND p.order_id = d.order_id RETURNING p.payment_id',
      ['Paid', deliveryId]
    );

    if (upd.rowCount === 0) {
      return res.status(404).json({ error: 'Payment record not found for this delivery' });
    }

    // Return the refreshed delivery row
    const selectOneQuery = `
      SELECT
        d.delivery_id,
        d.order_id,
        d.estimated_delivery_date AS arrival_date,
        COALESCE(d.delivery_status, 'Unknown') AS delivery_status,
        d.user_id AS driver_id,
        du.name AS driver_name,
        o.order_status AS order_status,
        o.delivery_address AS delivery_address,
        cu.name AS customer_name,
        pay.payment_method,
        pay.payment_status AS payment_status,
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
      FROM "Delivery" d
      JOIN "Order" o ON d.order_id = o.order_id
      JOIN "User" cu ON o.user_id = cu.user_id
      LEFT JOIN "User" du ON d.user_id = du.user_id
      LEFT JOIN "Payment" pay ON o.order_id = pay.order_id
      LEFT JOIN "OrderItem" oi ON o.order_id = oi.order_id
      LEFT JOIN "Variant" v ON oi.variant_id = v.variant_id
      LEFT JOIN "Product" prod ON v.product_id = prod.product_id
      WHERE d.delivery_id = $1
      GROUP BY d.delivery_id, d.order_id, d.estimated_delivery_date, d.delivery_status, d.user_id, du.name, o.order_status, cu.name, pay.payment_method, pay.payment_status, o.delivery_address;
    `;

    const { rows } = await pool.query(selectOneQuery, [deliveryId]);

    if (rows.length === 0) return res.status(404).json({ error: 'Delivery not found after payment update' });

    const r = rows[0];
    const processed = {
      ...r,
      arrival_date: r.arrival_date ? r.arrival_date.toISOString() : null,
      total_price: parseFloat(r.total_price) || 0,
      items: r.items || [],
      delivery_status: r.delivery_status || 'Unknown',
      order_status: r.order_status || null,
      driver_id: r.driver_id || null,
      driver_name: r.driver_name || null,
      payment_status: r.payment_status || 'Pending'
    };

    res.json(processed);
  } catch (err) {
    console.error('Error updating payment status:', err.message);
    console.error(err.stack);
    res.status(500).json({ error: 'Server error while updating payment status' });
  }
});

module.exports = router;
