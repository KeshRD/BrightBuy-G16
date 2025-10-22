const express = require("express");
const router = express.Router();
const { Pool } = require("pg");
require("dotenv").config();
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});
/**
 * @route   GET /api/reports/customer-orders
 * @query   user_id (optional)
 * @query   name (optional)
 * @query   payment_status (optional: 'Paid' | 'Pending')
 * @desc    Get all orders and payment details for a customer
 */
router.get("/customer-orders", async (req, res) => {
  try {
    const { user_id, name, payment_status } = req.query;
    const params = [];
    let whereClause = "WHERE 1=1";
    // Filter by user_id or name
    if (user_id) {
      params.push(user_id);
      whereClause += ` AND u.user_id = $${params.length}`;
    } else if (name) {
      params.push(`%${name}%`);
      whereClause += ` AND LOWER(u.name) LIKE LOWER($${params.length})`;
    }
    // Filter by payment_status
    if (payment_status && ["Paid", "Pending"].includes(payment_status)) {
      params.push(payment_status);
      whereClause += ` AND p.payment_status = $${params.length}`;
    }
    const query = `
      SELECT 
        o.order_id,
        u.user_id,
        u.name AS customer_name,
        o.order_date,
        o.order_status,
        o.mode_of_delivery,
        o.payment_method,
        o.delivery_address,
        o.estimated_delivery_date,
        COALESCE(p.payment_status, 'Pending') AS payment_status,
        COALESCE(p.payment_method, o.payment_method) AS payment_method_from_payment,
        SUM(oi.quantity * oi.price_at_purchase) AS total_amount
      FROM "Order" o
      JOIN "User" u ON o.user_id = u.user_id
      LEFT JOIN "Payment" p ON o.order_id = p.order_id
      LEFT JOIN "OrderItem" oi ON o.order_id = oi.order_id
      ${whereClause}
      GROUP BY o.order_id, u.user_id, u.name, p.payment_status, p.payment_method
      ORDER BY o.order_date DESC;
    `;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching customer order report:", err.stack);
    res.status(500).send("Server error while fetching customer order report");
  }
});
module.exports = router;