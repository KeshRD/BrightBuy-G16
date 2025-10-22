
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
 * @route   GET /api/orders/upcoming
 * @desc    Get all upcoming orders (Pending, Confirmed, Shipped) sorted by nearest delivery date
 */
router.get("/upcoming", async (req, res) => {
  try {
    const query = `
      SELECT 
        o.order_id,
        u.name AS customer_name,
        o.order_status,
        o.mode_of_delivery,
        o.payment_method,
        o.delivery_address,
        o.estimated_delivery_date
      FROM "Order" o
      JOIN "User" u ON o.user_id = u.user_id
      WHERE o.order_status IN ('Pending', 'Confirmed', 'Shipped')
      ORDER BY o.estimated_delivery_date ASC;
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching upcoming orders:", err.stack);
    res.status(500).send("Server error while fetching upcoming orders");
  }
});
module.exports = router;