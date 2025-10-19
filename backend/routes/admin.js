// backend/routes/admin.js
const express = require("express");
const router = express.Router();
const { Pool } = require("pg");
require("dotenv").config();

const { nanoid } = require('nanoid');


const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

/* ===== Products ===== */
router.get("/products", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.product_id, p.product_name, v.variant_id, v.variant_name as variant, c.category_name AS category, 
             v.stock_quantity, v.price
      FROM "Product" p
      JOIN "Category" c ON p.category_id = c.category_id
      LEFT JOIN "Variant" v ON p.product_id = v.product_id
      ORDER BY p.product_id, v.variant_id ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Products fetch error:", err.stack);
    res.status(500).send("Server error");
  }
});

/**
 * @route   GET /api/admin/categories
 * @desc    Get all categories for dropdowns
 */
router.get("/categories", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT category_id, category_name AS name 
      FROM "Category" 
      ORDER BY name ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Categories fetch error:", err.stack);
    res.status(500).send("Server error");
  }
});

// backend/routes/admin.js
// ... (keep all your imports and other routes) ...

/**
 * @route   POST /api/admin/products
 * @desc    Add a new product (with its first variant)
 */
router.post("/products", async (req, res) => {
  // --- 1. GET 'price_at_purchase' from body ---
  const { product_name, variant, category_id, stock_quantity, price, price_at_purchase, description, image } = req.body;

  // --- 2. VALIDATE 'price_at_purchase' ---
  if (!product_name || !variant || !category_id || !stock_quantity || !price || !price_at_purchase || !description || !image) {
    return res.status(400).json({ message: "All fields, including an image, are required" });
  }

  // --- 3. Product Name Uniqueness Check (from trigger) ---
  // We still need to check for the error code, but the check itself is done by the DB

  // --- 4. SKU Generation (from trigger) ---
  // This is now handled entirely by the database trigger

  // --- 5. Database Transaction ---
  const client = await pool.connect(); 
  try {
    await client.query("BEGIN"); 

    const productQuery = `
      INSERT INTO "Product" (product_name, category_id, description, image)
      VALUES ($1, $2, $3, $4)
      RETURNING product_id, "SKU"; 
    `;
    const productRes = await client.query(productQuery, [
      product_name,
      category_id,
      description,
      image 
    ]);
    const newProductId = productRes.rows[0].product_id;
    const generatedSku = productRes.rows[0].SKU;

    console.log(`Generated SKU ${generatedSku} for new product.`);

    // --- 6. FIX: Use the new variable in the query ---
    const variantQuery = `
      INSERT INTO "Variant" (product_id, variant_name, stock_quantity, price, price_at_purchase)
      VALUES ($1, $2, $3, $4, $5) 
      RETURNING *;
    `;
    const variantRes = await client.query(variantQuery, [
      newProductId,
      variant, 
      stock_quantity,
      price,
      price_at_purchase // <-- Use the new variable here ($5)
    ]);

    await client.query("COMMIT");
    res.json({
      message: "Product and variant added successfully",
      product: productRes.rows[0],
      variant: variantRes.rows[0],
    });

  } catch (err) {
    // --- 7. Error Handling (Unchanged) ---
    await client.query("ROLLBACK").catch(() => {});
    
    if (err.code === '23505') { 
      // Check for the unique index name (it might be 'product_name_unique_idx')
      if (err.constraint === 'product_name_unique' || err.constraint === 'product_name_unique_idx') {
        return res.status(400).json({ message: "A product with this name already exists. Please use a different name." });
      }
    }
    
    console.error("Add product error:", err.stack);
    res.status(500).send("Server error while adding product");
  } finally {
    client.release();
  }
});

// ... (keep all your other routes) ...
module.exports = router;

/* ===== Orders with Delivery Info ===== */
router.get("/orders-with-delivery", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        o.order_id,
        u.name AS customer_name,
        o.order_status AS status,
        SUM(oi.price_at_purchase * oi.quantity) AS total_amount,
        o.order_date,
        d.delivery_id,
        d.delivery_status,
        d.estimated_delivery_date AS delivery_date
      FROM "Order" o
      JOIN "User" u ON o.user_id = u.user_id
      JOIN "OrderItem" oi ON o.order_id = oi.order_id
      LEFT JOIN "Delivery" d ON o.order_id = d.order_id
      GROUP BY o.order_id, u.name, o.order_status, o.order_date, d.delivery_id, d.delivery_status, d.estimated_delivery_date
      ORDER BY o.order_id ASC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error("Orders with delivery fetch error:", err.stack);
    res.status(500).send("Server error");
  }
});

// Get all variants with product & category names
router.get("/variants", async (req, res) => {
  try {
    const query = `
      SELECT 
        v.variant_id,
        v.variant_name,
        v.stock_quantity,
        p.product_name,
        c.category_name
      FROM "Variant" v
      JOIN "Product" p ON v.product_id = p.product_id
      JOIN "Category" c ON p.category_id = c.category_id
      ORDER BY c.category_name, p.product_name, v.variant_name;
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching variants:", err);
    res.status(500).send("Server error while fetching variants");
  }
});


/* ===== Transactions ===== */
router.get("/transactions", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.transaction_id, t.variant_id, t.party_id, t.party_type,
             t.transaction_type , t.quantity, t.transaction_date
      FROM "Transaction" t
      ORDER BY t.transaction_id ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Transactions fetch error:", err.stack);
    res.status(500).send("Server error");
  }
});

/**
 * @route   PUT /api/admin/transactions/:id
 * @desc    Update a transaction (stock auto-updated by trigger)
 * @body    { variant_id, party_id, party_type, transaction_type, quantity, transaction_date }
 */
router.put("/transactions/:id", async (req, res) => {
  const transactionId = req.params.id;
  const { variant_id, party_id, party_type, transaction_type, quantity, transaction_date } = req.body;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const updateQuery = `
      UPDATE "Transaction"
      SET variant_id = $1,
          party_id = $2,
          party_type = $3,
          transaction_type = $4,
          quantity = $5,
          transaction_date = $6
      WHERE transaction_id = $7
      RETURNING *;
    `;
    const updated = await client.query(updateQuery, [
      variant_id,
      party_id,
      party_type || "Supplier",
      transaction_type,
      quantity,
      transaction_date || new Date(),
      transactionId,
    ]);

    if (updated.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).send("Transaction not found");
    }

    await client.query("COMMIT");
    res.json({ message: "Transaction updated successfully", transaction: updated.rows[0] });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Update transaction error:", err.stack);
    res.status(500).send("Server error while updating transaction");
  } finally {
    client.release();
  }
});

/**
 * @route   POST /api/admin/transactions
 * @desc    Add a transaction (stock auto-updated by trigger)
 * @body    { variant_id, party_id, party_type, transaction_type, quantity, transaction_date }
 */
router.post("/transactions", async (req, res) => {
  const { variant_id, party_id, party_type, transaction_type, quantity, transaction_date } = req.body;

  if (!variant_id || !party_id || !transaction_type || !quantity) {
    return res.status(400).send("All fields are required");
  }

  const client = await pool.connect();
  try {
    console.log(">>> Add transaction triggered:", req.body);
    await client.query("BEGIN");

    const insertQuery = `
      INSERT INTO "Transaction" (variant_id, party_id, party_type, transaction_type, quantity, transaction_date)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    const result = await client.query(insertQuery, [
      variant_id,
      party_id,
      party_type || "Supplier",
      transaction_type,
      quantity,
      transaction_date || new Date(),
    ]);

    await client.query("COMMIT");
    res.json({ message: "Transaction added successfully", transaction: result.rows[0] });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Add transaction error:", err.stack);
    res.status(500).send("Server error while adding transaction");
  } finally {
    client.release();
  }
});

/**
 * @route   DELETE /api/admin/transactions/:id
 * @desc    Delete a transaction (stock auto-adjusted by trigger)
 */
router.delete("/transactions/:id", async (req, res) => {
  const transactionId = req.params.id;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const txRes = await client.query(
      `DELETE FROM "Transaction" WHERE transaction_id = $1 RETURNING *`,
      [transactionId]
    );

    if (txRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).send("Transaction not found");
    }

    await client.query("COMMIT");
    res.json({ message: "Transaction deleted successfully", transaction: txRes.rows[0] });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Delete transaction error:", err.stack);
    res.status(500).send("Server error while deleting transaction");
  } finally {
    client.release();
  }
});



/* ===== Reports ===== */
router.get("/reports", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT report_id, report_name AS title, generated_date AS generated_on
      FROM "Report"
      ORDER BY report_id ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Reports fetch error:", err.stack);
    res.status(500).send("Server error");
  }
});

/* ===== Customers ===== */
router.get("/customers", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT user_id AS customer_id, name, email, phone
      FROM "User"
      WHERE role = 'Registered Customer'
      ORDER BY user_id ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Customers fetch error:", err.stack);
    res.status(500).send("Server error");
  }
});

/* ===== Suppliers ===== */
router.get("/suppliers", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT supplier_id, supplier_name AS name, phone AS contact, email, address
      FROM "Supplier"
      ORDER BY supplier_id ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Suppliers fetch error:", err.stack);
    res.status(500).send("Server error");
  }
});

/* ===== Delivery Drivers ===== */
router.get("/deliverydrivers", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT user_id AS delivery_id, name, email, phone, NULL AS joined_on
      FROM "User"
      WHERE role = 'Delivery Driver'
      ORDER BY user_id ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Customers fetch error:", err.stack);
    res.status(500).send("Server error");
  }
});

/* ============================================================
   ADMIN DASHBOARD STATS ROUTES
   ============================================================ */

/**
 * @route   GET /api/admin/stats/netincome
 * @desc    Get net income = gross sales (from PAID orders) - purchases (from Transaction table)
 */
router.get("/stats/netincome", async (req, res) => {
  try {
    const query = `
      SELECT
        COALESCE(gross.total_income, 0) AS gross_sales,
        COALESCE(purchases.total_purchases, 0) AS purchases_cost,
        (COALESCE(gross.total_income, 0) - COALESCE(purchases.total_purchases, 0)) AS net_income
      FROM
        (
          SELECT SUM(oi.price_at_purchase * oi.quantity) AS total_income
          FROM "OrderItem" oi
          JOIN "Order" o ON oi.order_id = o.order_id
          JOIN "Payment" p ON o.order_id = p.order_id
          WHERE p.payment_status = 'Paid'
        ) AS gross,
        (
          SELECT SUM(ABS(t.quantity) * COALESCE(v.price, 0)) AS total_purchases
          FROM "Transaction" t
          JOIN "Variant" v ON t.variant_id = v.variant_id
          WHERE
            LOWER(COALESCE(t.transaction_type, '')) LIKE '%purchase%'
            OR LOWER(COALESCE(t.transaction_type, '')) LIKE '%restock%'
            OR LOWER(COALESCE(t.party_type, '')) = 'supplier'
        ) AS purchases;
    `;
    const result = await pool.query(query);
    const row = result.rows[0] || { gross_sales: 0, purchases_cost: 0, net_income: 0 };
    res.json({
      gross_sales: parseFloat(row.gross_sales) || 0,
      purchases_cost: parseFloat(row.purchases_cost) || 0,
      net_income: parseFloat(row.net_income) || 0,
    });
  } catch (err) {
    console.error("Net income fetch error:", err.stack);
    res.status(500).send("Server error while fetching net income");
  }
});

/**
 * @route   GET /api/admin/stats/category-orders
 * @desc    Get total sold quantity and revenue per product category
 */
router.get("/stats/category-orders", async (req, res) => {
  try {
    const query = `
      SELECT 
        c.category_name AS category,
        SUM(oi.quantity) AS total_sold,
        SUM(oi.price_at_purchase * oi.quantity) AS total_revenue
      FROM "OrderItem" oi
      JOIN "Order" o ON oi.order_id = o.order_id
      JOIN "Payment" p ON o.order_id = p.order_id
      JOIN "Variant" v ON oi.variant_id = v.variant_id
      JOIN "Product" pr ON v.product_id = pr.product_id
      JOIN "Category" c ON pr.category_id = c.category_id
      WHERE p.payment_status = 'Paid'
      GROUP BY c.category_name
      ORDER BY total_sold DESC;
    `;

    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error("Category orders fetch error:", err.stack);
    res.status(500).send("Server error while fetching category orders");
  }
});


/**
 * @route   GET /api/admin/stats/top-products
 * @desc    Get top 5 selling products by total sales quantity
 */
router.get("/stats/top-products", async (req, res) => {
  try {
    const { period = "3_months" } = req.query;

    let startDate = new Date();
    switch (period) {
      case "1_month":
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case "3_months":
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      case "6_months":
        startDate.setMonth(startDate.getMonth() - 6);
        break;
      case "1_year":
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate.setMonth(startDate.getMonth() - 3);
    }

    const query = `
      SELECT
  p.product_name,
  SUM(oi.quantity) AS total_sold,
  SUM(oi.price_at_purchase * oi.quantity) AS total_revenue
FROM "OrderItem" oi
JOIN "Order" o ON oi.order_id = o.order_id
JOIN "Payment" pay ON o.order_id = pay.order_id
JOIN "Variant" v ON oi.variant_id = v.variant_id
JOIN "Product" p ON v.product_id = p.product_id
WHERE pay.payment_status = 'Paid'
  AND o.order_date >= $1
GROUP BY p.product_name
ORDER BY total_sold DESC
LIMIT 5;

    `;

    const result = await pool.query(query, [startDate]);
    res.json(result.rows);
  } catch (err) {
    console.error("Top products fetch error:", err.stack);
    res.status(500).send("Server error while fetching top products");
  }
});


/**
 * @route   GET /api/admin/stats/sales-performance
 * @desc    Get sales performance over time (daily sales in the past 30 days)
 */
router.get("/stats/sales-performance", async (req, res) => {
  try {
    const { quarter = "Q1", year = new Date().getFullYear() } = req.query;

    let startMonth, endMonth;
    switch (quarter) {
      case "Q1": startMonth = 1; endMonth = 3; break;
      case "Q2": startMonth = 4; endMonth = 6; break;
      case "Q3": startMonth = 7; endMonth = 9; break;
      case "Q4": startMonth = 10; endMonth = 12; break;
      default: startMonth = 1; endMonth = 3;
    }

    const query = `
      SELECT 
        DATE(o.order_date) AS date,
        COALESCE(SUM(oi.price_at_purchase * oi.quantity), 0) AS total_sales
      FROM "Order" o
      JOIN "OrderItem" oi ON o.order_id = oi.order_id
      JOIN "Payment" p ON o.order_id = p.order_id
      WHERE p.payment_status = 'Paid'
        AND EXTRACT(MONTH FROM o.order_date) BETWEEN $1 AND $2
        AND EXTRACT(YEAR FROM o.order_date) = $3
      GROUP BY DATE(o.order_date)
      ORDER BY DATE(o.order_date) ASC;
    `;

    const result = await pool.query(query, [startMonth, endMonth, year]);
    res.json(result.rows);
  } catch (err) {
    console.error("Sales performance fetch error:", err.stack);
    res.status(500).send("Server error while fetching sales performance");
  }
});


/**
 * @route   GET /api/admin/stats/payment-methods
 * @desc    Get distribution of payment methods (Card vs COD)
 */
router.get("/stats/payment-methods", async (req, res) => {
  try {
    const query = `
      SELECT 
        p.payment_method,
        COUNT(*) AS count
      FROM "Payment" p
      GROUP BY p.payment_method;
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error("Payment methods fetch error:", err.stack);
    res.status(500).send("Server error while fetching payment method stats");
  }
});

/* ===== Update User Role ===== */
router.patch("/users/:id/role", async (req, res) => {
  const { id } = req.params;
  const { role, address } = req.body; // 👈 include address

  const validRoles = ["Admin", "Registered Customer", "Supplier", "Delivery Driver"];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: "Invalid role value" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const userRes = await client.query('SELECT * FROM "User" WHERE "user_id" = $1', [id]);
    if (userRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "User not found" });
    }

    const user = userRes.rows[0];

    if (role === "Supplier") {
      // Validate that address is provided
      if (!address || address.trim() === "") {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Supplier address is required" });
      }

      // Insert supplier with address
      await client.query(
        `INSERT INTO "Supplier" ("supplier_name", "phone", "email", "address")
         VALUES ($1, $2, $3, $4)`,
        [user.name, user.phone, user.email, address]
      );

      // Delete user from User table
      await client.query('DELETE FROM "User" WHERE "user_id" = $1', [id]);
    } else {
      // Regular role update
      await client.query('UPDATE "User" SET "role" = $1 WHERE "user_id" = $2', [role, id]);
    }

    await client.query("COMMIT");
    res.status(200).json({ message: "Role updated successfully." });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error updating user role:", err);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});


module.exports = router;