CREATE OR REPLACE VIEW vw_product_details AS
SELECT 
  p.product_id,
  p.product_name,
  v.variant_id,
  v.variant_name,
  c.category_name,
  v.stock_quantity,
  v.price
FROM "Product" p
JOIN "Category" c ON p.category_id = c.category_id
LEFT JOIN "Variant" v ON p.product_id = v.product_id
ORDER BY p.product_id, v.variant_id;



CREATE OR REPLACE VIEW vw_orders_with_delivery AS
SELECT 
  o.order_id,
  u.name AS customer_name,
  o.order_status AS status,
  SUM(oi.price_at_purchase * oi.quantity) AS total_amount,
  o.order_date,
  d.delivery_id,
  d.estimated_delivery_date AS delivery_date
FROM "Order" o
JOIN "User" u ON o.user_id = u.user_id
JOIN "OrderItem" oi ON o.order_id = oi.order_id
LEFT JOIN "Delivery" d ON o.order_id = d.order_id
GROUP BY o.order_id, u.name, o.order_status, o.order_date, d.delivery_id, d.estimated_delivery_date;



CREATE OR REPLACE VIEW vw_transaction_details AS
SELECT 
  t.transaction_id,
  t.variant_id,
  v.variant_name,
  p.product_name,
  t.party_id,
  t.party_type,
  t.transaction_type,
  t.quantity,
  t.transaction_date
FROM "Transaction" t
LEFT JOIN "Variant" v ON t.variant_id = v.variant_id
LEFT JOIN "Product" p ON v.product_id = p.product_id;



CREATE OR REPLACE VIEW vw_variant_details AS
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



CREATE OR REPLACE VIEW vw_category_sales AS
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
