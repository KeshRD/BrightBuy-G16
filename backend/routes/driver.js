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

const { sendOrderConfirmationEmail } = require('../utils/emailService');

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
      o.order_status AS status,
      d.user_id AS driver_id,
      du.name AS driver_name,
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
  GROUP BY d.delivery_id, d.order_id, d.estimated_delivery_date, o.order_status, d.user_id, du.name, cu.name, pay.payment_method, pay.payment_status, o.delivery_address
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
      status: r.status || 'Pending',
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

// Claim a delivery: set order status to Confirmed and assign current driver if it's Pending and unassigned
router.post('/deliveries/:id/claim', authenticateDriver, async (req, res) => {
  try {
    const deliveryId = parseInt(req.params.id, 10);
    if (Number.isNaN(deliveryId)) return res.status(400).json({ error: 'Invalid delivery id' });

    const driverId = req.user.userId;

    const claimRes = await pool.query(
      `UPDATE "Delivery" d SET user_id = $1 FROM "Order" o WHERE d.delivery_id = $2 AND d.user_id IS NULL AND o.order_id = d.order_id AND o.order_status = 'Pending' RETURNING d.delivery_id`,
      [driverId, deliveryId]
    );

    if (claimRes.rowCount === 0) {
      return res.status(409).json({ error: 'Delivery already claimed or not pending' });
    }

    await pool.query(
      'UPDATE "Order" SET order_status = $1 WHERE order_id = (SELECT order_id FROM "Delivery" WHERE delivery_id = $2)',
      ['Confirmed', deliveryId]
    );

    const selectOneQuery = `
      SELECT
        d.delivery_id,
        d.order_id,
        d.estimated_delivery_date AS arrival_date,
        o.order_status AS status,
        d.user_id AS driver_id,
        du.name AS driver_name,
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
      GROUP BY d.delivery_id, d.order_id, d.estimated_delivery_date, o.order_status, d.user_id, du.name, cu.name, pay.payment_method, pay.payment_status, o.delivery_address;
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
      status: r.status || 'Pending',
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

  await pool.query(
  'UPDATE "Order" SET order_status = $1 WHERE order_id = (SELECT order_id FROM "Delivery" WHERE delivery_id = $2)',
  ['Confirmed', deliveryId]
);

// Claim successful -> send email before sending the response
const emailData = await pool.query(`
  SELECT u.email, o.order_id, o.delivery_address
  FROM "Order" o
  JOIN "User" u ON o.user_id = u.user_id
  WHERE o.order_id = (SELECT order_id FROM "Delivery" WHERE delivery_id = $1)
`, [deliveryId]);

if (emailData.rows.length > 0) {
  const { email, order_id, delivery_address } = emailData.rows[0];
  const orderItemsRes = await pool.query(`
    SELECT p.product_name, v.variant_name, oi.quantity, oi.price_at_purchase AS price
    FROM "OrderItem" oi
    JOIN "Variant" v ON oi.variant_id = v.variant_id
    JOIN "Product" p ON v.product_id = p.product_id
    WHERE oi.order_id = $1
  `, [order_id]);

  const total = orderItemsRes.rows.reduce(
    (sum, i) => sum + parseFloat(i.price) * i.quantity,
    0
  );

  await sendOrderConfirmationEmail(email, {
    order_id,
    items: orderItemsRes.rows,
    total_price: total.toFixed(2),
    delivery_address,
  });
}

// now send a single response
res.json({
  status: 'Confirmed',
  message: 'Order confirmed and confirmation email sent.',
  ...processed
});

});

// Update order status: Confirmed -> Shipped, Shipped -> Delivered by assigned driver only
router.patch('/deliveries/:id/status', authenticateDriver, async (req, res) => {
  try {
    const deliveryId = parseInt(req.params.id, 10);
    if (Number.isNaN(deliveryId)) return res.status(400).json({ error: 'Invalid delivery id' });

    const driverId = req.user.userId;

    // Get current order status
    const currentStatusRes = await pool.query(
      'SELECT o.order_status FROM "Order" o JOIN "Delivery" d ON o.order_id = d.order_id WHERE d.delivery_id = $1 AND d.user_id = $2',
      [deliveryId, driverId]
    );

    if (currentStatusRes.rows.length === 0) {
      return res.status(403).json({ error: 'Not allowed: You are not assigned to this delivery' });
    }

    const currentStatus = currentStatusRes.rows[0].order_status;
    let newStatus;

    if (currentStatus === 'Confirmed') {
      newStatus = 'Shipped';
    } else if (currentStatus === 'Shipped') {
      newStatus = 'Delivered';
    } else {
      return res.status(400).json({ error: 'Invalid status transition' });
    }

    const updRes = await pool.query(
      'UPDATE "Order" SET order_status = $1 WHERE order_id = (SELECT order_id FROM "Delivery" WHERE delivery_id = $2 AND user_id = $3)',
      [newStatus, deliveryId, driverId]
    );

    if (updRes.rowCount === 0) {
      return res.status(403).json({ error: 'Not allowed: You are not assigned to this delivery' });
    }

    const selectOneQuery = `
      SELECT
        d.delivery_id,
        d.order_id,
        d.estimated_delivery_date AS arrival_date,
        o.order_status AS status,
        d.user_id AS driver_id,
        du.name AS driver_name,
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
      GROUP BY d.delivery_id, d.order_id, d.estimated_delivery_date, o.order_status, d.user_id, du.name, cu.name, pay.payment_method, pay.payment_status, o.delivery_address;
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
      status: r.status || 'Pending',
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

// Mark payment status as Paid for a delivery (assigned driver only, only if order is Delivered)
router.patch('/deliveries/:id/payment-status', authenticateDriver, async (req, res) => {
  try {
    const deliveryId = parseInt(req.params.id, 10);
    if (Number.isNaN(deliveryId)) return res.status(400).json({ error: 'Invalid delivery id' });

    const driverId = req.user.userId;

    // Ensure caller is the assigned driver and order is Delivered
    const dRes = await pool.query(
      'SELECT d.user_id, d.order_id, o.order_status FROM "Delivery" d JOIN "Order" o ON d.order_id = o.order_id WHERE d.delivery_id = $1',
      [deliveryId]
    );
    if (dRes.rows.length === 0) return res.status(404).json({ error: 'Delivery not found' });
    const { user_id: assignedDriverId, order_id, order_status } = dRes.rows[0];
    if (!assignedDriverId || assignedDriverId !== driverId) {
      return res.status(403).json({ error: 'Not allowed: You are not assigned to this delivery' });
    }
    if (order_status !== 'Delivered') {
      return res.status(400).json({ error: 'Payment can only be marked as Paid when order is Delivered' });
    }

    // Update payment to Paid
    const upd = await pool.query(
      'UPDATE "Payment" SET payment_status = $1, payment_date = NOW() WHERE order_id = $2 RETURNING payment_id',
      ['Paid', order_id]
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
        o.order_status AS status,
        d.user_id AS driver_id,
        du.name AS driver_name,
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
      GROUP BY d.delivery_id, d.order_id, d.estimated_delivery_date, o.order_status, d.user_id, du.name, cu.name, pay.payment_method, pay.payment_status, o.delivery_address;
    `;

    const { rows } = await pool.query(selectOneQuery, [deliveryId]);

    if (rows.length === 0) return res.status(404).json({ error: 'Delivery not found after payment update' });

    const r = rows[0];
    const processed = {
      ...r,
      arrival_date: r.arrival_date ? r.arrival_date.toISOString() : null,
      total_price: parseFloat(r.total_price) || 0,
      items: r.items || [],
      status: r.status || 'Pending',
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
