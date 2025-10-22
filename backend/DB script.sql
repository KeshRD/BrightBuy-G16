-- ===========================================================
--  FINAL DATABASE SCHEMA - BrightBuy Retail System
-- ===========================================================


-- ===========================================================
--  TABLE CREATION
-- ===========================================================

CREATE TABLE "Category" (
  "category_id" SERIAL PRIMARY KEY,
  "category_name" VARCHAR(100) NOT NULL
);

CREATE TABLE "Product" (
  "product_id" SERIAL PRIMARY KEY,
  "category_id" INT REFERENCES "Category"("category_id") ON DELETE CASCADE,
  "product_name" VARCHAR(100) NOT NULL,
  "SKU" VARCHAR(50) UNIQUE NOT NULL,
  "description" TEXT,
  "image" VARCHAR(255)
);

CREATE TABLE "Variant" (
  "variant_id" SERIAL PRIMARY KEY,
  "product_id" INT REFERENCES "Product"("product_id") ON DELETE CASCADE,
  "variant_name" VARCHAR(50) NOT NULL,
  "price" DECIMAL(10,2) NOT NULL,
  "price_at_purchase" DECIMAL(10,2),
  "stock_quantity" INT DEFAULT 0
);

CREATE TABLE "User" (
  "user_id" SERIAL PRIMARY KEY,
  "name" VARCHAR(100) NOT NULL,
  "email" VARCHAR(100) UNIQUE NOT NULL,
  "password" VARCHAR(255) NOT NULL,
  "phone" VARCHAR(20),
  "role" VARCHAR(30) CHECK ("role" IN ('Registered Customer','Admin','Delivery Driver')) NOT NULL
);

CREATE TABLE "Supplier" (
  "supplier_id" SERIAL PRIMARY KEY,
  "supplier_name" VARCHAR(100) NOT NULL,
  "phone" VARCHAR(15),
  "email" VARCHAR(100),
  "address" VARCHAR(250)
);

CREATE TABLE "Order" (
  "order_id" SERIAL PRIMARY KEY,
  "user_id" INT REFERENCES "User"("user_id") ON DELETE CASCADE,
  "order_date" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "mode_of_delivery" VARCHAR(50),
  "payment_method" VARCHAR(50),
  "delivery_address" VARCHAR(100),
  "order_status" VARCHAR(20) CHECK ("order_status" IN ('Pending','Confirmed','Shipped','Delivered','Cancelled')) DEFAULT 'Pending',
  "estimated_delivery_date" DATE
);

CREATE TABLE "OrderItem" (
  "order_item_id" SERIAL PRIMARY KEY,
  "order_id" INT REFERENCES "Order"("order_id") ON DELETE CASCADE,
  "variant_id" INT REFERENCES "Variant"("variant_id") ON DELETE CASCADE,
  "quantity" INT CHECK ("quantity" > 0),
  "price_at_purchase" DECIMAL(10,2)
);

CREATE TABLE "Delivery" (
  "delivery_id" SERIAL PRIMARY KEY,
  "order_id" INT REFERENCES "Order"("order_id") ON DELETE CASCADE,
  "user_id" INT REFERENCES "User"("user_id"),
  "delivery_status" VARCHAR(20) CHECK ("delivery_status" IN ('Pending','In Transit','Delivered','Failed')) DEFAULT 'Pending',
  "estimated_delivery_date" DATE
);

CREATE TABLE "Transaction" (
  "transaction_id" SERIAL PRIMARY KEY,
  "party_id" INT,
  "party_type" VARCHAR(20) CHECK ("party_type" IN ('Supplier','Customer')) DEFAULT 'Supplier',
  "variant_id" INT REFERENCES "Variant"("variant_id") ON DELETE CASCADE,
  "transaction_type" VARCHAR(50) CHECK ("transaction_type" IN ('Purchase','Sale')),
  "quantity" INT CHECK ("quantity" > 0),
  "transaction_date" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Payment" (
  "payment_id" SERIAL PRIMARY KEY,
  "order_id" INT REFERENCES "Order"("order_id") ON DELETE CASCADE,
  "payment_method" VARCHAR(30) CHECK ("payment_method" IN ('Cash on Delivery','Card Payment')),
  "payment_status" VARCHAR(20) CHECK ("payment_status" IN ('Pending','Paid','Failed')) DEFAULT 'Pending',
  "payment_date" TIMESTAMP
);

CREATE TABLE "Report" (
  "report_id" SERIAL PRIMARY KEY,
  "report_type" VARCHAR(60),
  "generated_date" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "report_name" VARCHAR(100)
);

CREATE TABLE "Cart" (
  "cart_id" SERIAL PRIMARY KEY,
  "user_id" INT REFERENCES "User"("user_id") ON DELETE CASCADE,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "CartItem" (
  "cart_item_id" SERIAL PRIMARY KEY,
  "cart_id" INT REFERENCES "Cart"("cart_id") ON DELETE CASCADE,
  "variant_id" INT REFERENCES "Variant"("variant_id") ON DELETE CASCADE,
  "quantity" INT CHECK ("quantity" > 0)
);

-- ===========================================================
--  TRIGGER FUNCTION: Add Sale Transaction when Payment is Paid
-- ===========================================================

CREATE OR REPLACE FUNCTION add_sale_transaction_on_payment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.payment_status = 'Paid' THEN
    -- Avoid duplicate sale transactions
    IF NOT EXISTS (
      SELECT 1 FROM "Transaction" t
      JOIN "OrderItem" oi ON t.variant_id = oi.variant_id
      WHERE oi.order_id = NEW.order_id
        AND t.transaction_type = 'Sale'
    ) THEN
      INSERT INTO "Transaction" (
        "party_id", "party_type", "variant_id",
        "transaction_type", "quantity", "transaction_date"
      )
      SELECT 
        o.user_id,
        'Customer',
        oi.variant_id,
        'Sale',
        oi.quantity,
        COALESCE(NEW.payment_date, CURRENT_TIMESTAMP)
      FROM "Order" o
      JOIN "OrderItem" oi ON o.order_id = oi.order_id
      WHERE o.order_id = NEW.order_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_add_sale_transaction_on_payment
AFTER UPDATE OF payment_status ON "Payment"
FOR EACH ROW
WHEN (NEW.payment_status = 'Paid')
EXECUTE FUNCTION add_sale_transaction_on_payment();

-- ===========================================================
--  TRIGGER FUNCTION: Update Variant Stock on Transaction
-- ===========================================================

CREATE OR REPLACE FUNCTION update_variant_stock_on_transaction()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    IF NEW.transaction_type = 'Purchase' THEN
      UPDATE "Variant" SET stock_quantity = stock_quantity + NEW.quantity WHERE variant_id = NEW.variant_id;
    ELSIF NEW.transaction_type = 'Sale' THEN
      UPDATE "Variant" SET stock_quantity = stock_quantity - NEW.quantity WHERE variant_id = NEW.variant_id;
    END IF;

  ELSIF (TG_OP = 'UPDATE') THEN
    -- Reverse old transaction
    IF OLD.transaction_type = 'Purchase' THEN
      UPDATE "Variant" SET stock_quantity = stock_quantity - OLD.quantity WHERE variant_id = OLD.variant_id;
    ELSIF OLD.transaction_type = 'Sale' THEN
      UPDATE "Variant" SET stock_quantity = stock_quantity + OLD.quantity WHERE variant_id = OLD.variant_id;
    END IF;

    -- Apply new one
    IF NEW.transaction_type = 'Purchase' THEN
      UPDATE "Variant" SET stock_quantity = stock_quantity + NEW.quantity WHERE variant_id = NEW.variant_id;
    ELSIF NEW.transaction_type = 'Sale' THEN
      UPDATE "Variant" SET stock_quantity = stock_quantity - NEW.quantity WHERE variant_id = NEW.variant_id;
    END IF;

  ELSIF (TG_OP = 'DELETE') THEN
    IF OLD.transaction_type = 'Purchase' THEN
      UPDATE "Variant" SET stock_quantity = stock_quantity - OLD.quantity WHERE variant_id = OLD.variant_id;
    ELSIF OLD.transaction_type = 'Sale' THEN
      UPDATE "Variant" SET stock_quantity = stock_quantity + OLD.quantity WHERE variant_id = OLD.variant_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_variant_stock_on_transaction
AFTER INSERT OR UPDATE OR DELETE ON "Transaction"
FOR EACH ROW
EXECUTE FUNCTION update_variant_stock_on_transaction();

-- ===== CATEGORY =====
INSERT INTO "Category" ("category_name") VALUES
('Smartphones'),
('Laptops'),
('Tablets'),
('Smartwatches'),
('Televisions'),
('Headphones'),
('Speakers'),
('Cameras'),
('Gaming Consoles'),
('Monitors'),
('Printers'),
('Networking Devices'),
('Home Appliances'),
('Computer Accessories'),
('Storage Devices');

-- ===== PRODUCT =====
INSERT INTO "Product" ("category_id", "product_name", "SKU", "description") VALUES
-- Smartphones
(1, 'iPhone 15 Pro', 'SKU_IP15PRO', 'Apple flagship smartphone with A17 chip'),
(1, 'Samsung Galaxy S24', 'SKU_SGS24', 'Latest Galaxy S series with high-end camera'),
(1, 'Google Pixel 8', 'SKU_PIXEL8', 'AI-powered smartphone from Google'),
-- Laptops
(2, 'MacBook Air M3', 'SKU_MBA_M3', 'Lightweight laptop with Apple Silicon'),
(2, 'Dell XPS 15', 'SKU_XPS15', 'Premium Windows ultrabook with OLED display'),
(2, 'HP Spectre x360', 'SKU_SPECTRE360', '2-in-1 convertible laptop'),
-- Tablets
(3, 'iPad Pro 12.9"', 'SKU_IPADPRO129', 'High-performance tablet with M2 chip'),
(3, 'Samsung Galaxy Tab S9', 'SKU_GALAXYTABS9', 'Android tablet with AMOLED display'),
(3, 'Lenovo Tab P11', 'SKU_LENOVOP11', 'Affordable productivity tablet'),
-- Smartwatches
(4, 'Apple Watch Series 9', 'SKU_AW9', 'Health and fitness smartwatch'),
(4, 'Samsung Galaxy Watch 6', 'SKU_GW6', 'Wear OS smartwatch with fitness tracking'),
-- Televisions
(5, 'LG OLED C3 55"', 'SKU_LGOLED55C3', '4K OLED TV with perfect blacks'),
(5, 'Samsung QLED Q80C 65"', 'SKU_QLEDQ80C', 'QLED TV with Quantum Processor 4K'),
(5, 'Sony Bravia XR A80L 55"', 'SKU_SONYXR55', 'Cognitive processor XR OLED TV'),
-- Headphones
(6, 'Sony WH-1000XM5', 'SKU_SONYXM5', 'Noise-cancelling wireless headphones'),
(6, 'Apple AirPods Pro 2', 'SKU_AIRPODSPRO2', 'Active noise cancellation earbuds'),
(6, 'Bose QC45', 'SKU_BOSEQC45', 'Wireless headphones with rich audio'),
-- Speakers
(7, 'JBL Charge 5', 'SKU_JBLCHG5', 'Portable Bluetooth speaker'),
(7, 'Sonos One', 'SKU_SONOSONE', 'Smart WiFi speaker with Alexa'),
(7, 'Amazon Echo (5th Gen)', 'SKU_ECHO5', 'Smart speaker with Alexa integration'),
-- Cameras
(8, 'Canon EOS R10', 'SKU_CANONR10', 'Mirrorless camera with APS-C sensor'),
(8, 'Sony Alpha ZV-E10', 'SKU_SONYZVE10', 'Vlogging-focused mirrorless camera'),
-- Gaming Consoles
(9, 'PlayStation 5', 'SKU_PS5', 'Next-gen Sony gaming console'),
(9, 'Xbox Series X', 'SKU_XBSX', 'Microsoft’s flagship gaming console'),
(9, 'Nintendo Switch OLED', 'SKU_NSWOLED', 'Hybrid console with OLED display'),
-- Monitors
(10, 'ASUS ROG Swift 27"', 'SKU_ROG27', 'Gaming monitor with 165Hz refresh rate'),
(10, 'Dell Ultrasharp 32"', 'SKU_DELLU32', 'Professional-grade 4K monitor'),
-- Printers
(11, 'HP LaserJet Pro M404dn', 'SKU_HPM404', 'Monochrome laser printer'),
(11, 'Canon PIXMA G3010', 'SKU_PIXMAG3010', 'Ink tank color printer'),
-- Networking Devices
(12, 'TP-Link Archer AX6000', 'SKU_TPLINKAX6000', 'High-speed WiFi 6 router'),
(12, 'Netgear Nighthawk AX12', 'SKU_NGA12', 'Performance WiFi 6 router'),
-- Home Appliances
(13, 'Dyson V15 Vacuum', 'SKU_DYSONV15', 'Cordless smart vacuum cleaner'),
(13, 'Philips Air Fryer XXL', 'SKU_PHLPAFXL', 'Smart digital air fryer'),
-- Computer Accessories
(14, 'Logitech MX Master 3S', 'SKU_MXM3S', 'Advanced wireless mouse'),
(14, 'Corsair K70 RGB Keyboard', 'SKU_K70RGB', 'Mechanical gaming keyboard'),
-- Storage Devices
(15, 'Samsung 970 EVO Plus 1TB', 'SKU_970EVO1TB', 'NVMe SSD storage drive'),
(15, 'Seagate Backup Plus 2TB', 'SKU_SEAGATE2TB', 'External hard drive'),
(15, 'SanDisk Ultra 128GB', 'SKU_SANDISK128', 'High-speed USB 3.0 flash drive'),
-- NEW ADDITIONS
(13, 'Instant Pot Duo 7-in-1', 'SKU_IPDUO7', 'Smart multi-cooker with WiFi control'),
(14, 'Razer DeathAdder V3', 'SKU_RAZERDAV3', 'Ergonomic gaming mouse with high DPI sensor');

-- ===== VARIANTS =====
INSERT INTO "Variant" ("product_id", "variant_name", "price", "price_at_purchase", "stock_quantity") VALUES
-- iPhone 15 Pro
(1, '128GB - Silver', 1099.00, 950.00, 25),
(1, '256GB - Space Black', 1199.00, 1040.00, 15),

-- Samsung Galaxy S24
(2, '128GB - Phantom Black', 999.00, 880.00, 20),
(2, '256GB - Cream', 1099.00, 970.00, 10),

-- Google Pixel 8
(3, '128GB - Obsidian', 899.00, 820.00, 18),
(3, '256GB - Hazel', 999.00, 910.00, 12),

-- MacBook Air M3
(4, '256GB SSD - Silver', 1249.00, 1150.00, 8),
(4, '512GB SSD - Space Gray', 1449.00, 1320.00, 6),

-- Dell XPS 15
(5, '16GB RAM / 512GB SSD', 1699.00, 1520.00, 5),
(5, '32GB RAM / 1TB SSD', 1999.00, 1750.00, 3),

-- HP Spectre x360
(6, '16GB / 512GB', 1399.00, 1250.00, 7),

-- iPad Pro 12.9"
(7, '128GB WiFi', 1099.00, 980.00, 10),
(7, '256GB WiFi + Cellular', 1299.00, 1150.00, 6),

-- Samsung Galaxy Tab S9
(8, '128GB', 899.00, 820.00, 12),

-- Lenovo Tab P11
(9, '64GB', 299.00, 250.00, 20),
(9, '128GB', 349.00, 290.00, 15),

-- Apple Watch Series 9
(10, '41mm - Midnight', 399.00, 360.00, 15),
(10, '45mm - Starlight', 429.00, 385.00, 10),

-- Samsung Galaxy Watch 6
(11, '40mm', 329.00, 290.00, 18),

-- LG OLED C3 55"
(12, '55-inch', 1499.00, 1320.00, 5),
(12, '65-inch', 1899.00, 1660.00, 3),

-- Samsung QLED Q80C
(13, '55-inch', 1299.00, 1140.00, 4),
(13, '65-inch', 1599.00, 1420.00, 3),

-- Sony Bravia XR A80L
(14, '55-inch', 1799.00, 1550.00, 4),

-- Sony WH-1000XM5
(15, 'Black', 399.00, 350.00, 25),
(15, 'Silver', 399.00, 350.00, 20),

-- Apple AirPods Pro 2
(16, 'White', 249.00, 220.00, 30),

-- Bose QC45
(17, 'Black', 329.00, 290.00, 18),

-- JBL Charge 5
(18, 'Blue', 179.00, 150.00, 25),
(18, 'Black', 179.00, 150.00, 25),

-- Sonos One
(19, 'Black', 219.00, 195.00, 10),
(19, 'White', 219.00, 195.00, 10),

-- Amazon Echo (5th Gen)
(20, 'Charcoal', 99.00, 85.00, 20),

-- Canon EOS R10
(21, 'Body Only', 979.00, 870.00, 6),
(21, 'With 18–45mm Lens', 1099.00, 970.00, 5),

-- Sony Alpha ZV-E10
(22, 'Body Only', 699.00, 630.00, 8),

-- PlayStation 5
(23, 'Standard Edition', 499.00, 450.00, 12),
(23, 'Digital Edition', 449.00, 400.00, 8),

-- Xbox Series X
(24, '1TB Black', 499.00, 440.00, 10),

-- Nintendo Switch OLED
(25, 'White Joy-Con', 349.00, 310.00, 15),
(25, 'Neon Red/Blue', 349.00, 310.00, 15),

-- ASUS ROG Swift 27"
(26, '165Hz QHD', 599.00, 520.00, 8),

-- Dell Ultrasharp 32"
(27, '4K UHD', 999.00, 870.00, 4),

-- HP LaserJet Pro M404dn
(28, 'Standard', 299.00, 260.00, 10),

-- Canon PIXMA G3010
(29, 'Ink Tank', 249.00, 210.00, 12),

-- TP-Link Archer AX6000
(30, 'Dual Band Router', 299.00, 260.00, 8),

-- Netgear Nighthawk AX12
(31, '12-Stream WiFi 6', 399.00, 350.00, 6),

-- Dyson V15 Vacuum
(32, 'Absolute', 749.00, 680.00, 5),

-- Philips Air Fryer XXL
(33, 'Digital HD9630', 349.00, 300.00, 8),

-- Logitech MX Master 3S
(34, 'Graphite', 99.00, 85.00, 20),

-- Corsair K70 RGB Keyboard
(35, 'Black', 159.00, 135.00, 15),

-- Samsung 970 EVO Plus 1TB
(36, '1TB NVMe SSD', 89.00, 75.00, 25),

-- Seagate Backup Plus 2TB
(37, '2TB External HDD', 89.00, 75.00, 20),

-- SanDisk Ultra 128GB
(38, 'USB 3.0 Flash Drive', 29.00, 20.00, 50),

-- Instant Pot Duo 7-in-1
(39, '6 Quart', 129.00, 110.00, 10),

-- Razer DeathAdder V3
(40, 'Wired - Black', 69.00, 55.00, 15);

-- ===== USERS MIXED =====
INSERT INTO "User" (name, email, password, phone, role) VALUES
('Olivia Parker', 'olivia.parker@example.com', 'hashed_password_1', '2145550101', 'Registered Customer'),
('Ethan Harris', 'ethan.harris@example.com', 'hashed_password_2', '5125550202', 'Delivery Driver'),
('Sophia Johnson', 'sophia.johnson@example.com', 'hashed_password_3', '7135550303', 'Registered Customer'),
('Mason Lee', 'mason.lee@example.com', 'hashed_password_4', '2815550404', 'Delivery Driver'),
('Ava Martinez', 'ava.martinez@example.com', 'hashed_password_5', '9155550505', 'Registered Customer'),
('Liam Thompson', 'liam.thompson@example.com', 'hashed_password_6', '4695550606', 'Delivery Driver'),
('Isabella Brown', 'isabella.brown@example.com', 'hashed_password_7', '8305550707', 'Registered Customer'),
('Noah Wilson', 'noah.wilson@example.com', 'hashed_password_8', '9565550808', 'Delivery Driver'),
('Mia Anderson', 'mia.anderson@example.com', 'hashed_password_9', '2105550909', 'Registered Customer'),
('James Taylor', 'james.taylor@example.com', 'hashed_password_10', '9725551010', 'Registered Customer'),
('Charlotte White', 'charlotte.white@example.com', 'hashed_password_11', '3255551111', 'Registered Customer'),
('Benjamin Lewis', 'benjamin.lewis@example.com', 'hashed_password_12', '8065551212', 'Registered Customer'),
('Amelia Walker', 'amelia.walker@example.com', 'hashed_password_13', '9155551313', 'Registered Customer'),
('Elijah Hall', 'elijah.hall@example.com', 'hashed_password_14', '3615551414', 'Registered Customer'),
('Harper Young', 'harper.young@example.com', 'hashed_password_15', '9725551515', 'Registered Customer'),
('Alexander King', 'alexander.king@example.com', 'hashed_password_16', '2145551616', 'Registered Customer'),
('Evelyn Scott', 'evelyn.scott@example.com', 'hashed_password_17', '5125551717', 'Registered Customer'),
('Daniel Allen', 'daniel.allen@example.com', 'hashed_password_18', '7135551818', 'Delivery Driver'),
('Abigail Wright', 'abigail.wright@example.com', 'hashed_password_19', '8065551919', 'Registered Customer'),
('Matthew Hill', 'matthew.hill@example.com', 'hashed_password_20', '3255552020', 'Registered Customer'),
('Emily Green', 'emily.green@example.com', 'hashed_password_21', '8305552121', 'Registered Customer'),
('Lucas Adams', 'lucas.adams@example.com', 'hashed_password_22', '9565552222', 'Registered Customer'),
('Ella Baker', 'ella.baker@example.com', 'hashed_password_23', '2105552323', 'Registered Customer'),
('Jackson Nelson', 'jackson.nelson@example.com', 'hashed_password_24', '4695552424', 'Registered Customer'),
('Sofia Carter', 'sofia.carter@example.com', 'hashed_password_25', '9725552525', 'Registered Customer');

-- ===== SUPPLIERS =====
INSERT INTO "Supplier" (supplier_name, phone, email, address) VALUES
('Apple Inc.', '8005550101', 'supply@apple.com', '1 Apple Park Way, Cupertino, CA 95014'),
('Samsung Electronics', '8005550202', 'supply@samsung.com', '85 Challenger Rd, Ridgefield Park, NJ 07660'),
('Sony Corporation', '8005550303', 'contact@sony.com', '1 Sony Dr, Park Ridge, NJ 07656'),
('Canon USA', '8005550404', 'sales@canon.com', '15955 Alton Pkwy, Irvine, CA 92618'),
('Dell Technologies', '8005550505', 'sales@dell.com', '1 Dell Way, Round Rock, TX 78682'),
('HP Inc.', '8005550606', 'support@hp.com', '1501 Page Mill Rd, Palo Alto, CA 94304'),
('Logitech', '8005550707', 'contact@logitech.com', '7700 Gateway Blvd, Newark, CA 94560'),
('Bose Corporation', '8005550808', 'support@bose.com', 'The Mountain, Framingham, MA 01701'),
('JBL Professional', '8005550909', 'contact@jbl.com', '8500 Balboa Blvd, Northridge, CA 91329'),
('Amazon Distribution', '8005551010', 'supply@amazon.com', '410 Terry Ave N, Seattle, WA 98109');

-- ================================
-- ORDERS
-- ================================
INSERT INTO "Order" ("user_id", "order_date", "mode_of_delivery", "payment_method", "delivery_address", "order_status", "estimated_delivery_date")
VALUES
-- Order 1 - Card Payment
(1, '2025-10-10 10:15:00', 'Home Delivery', 'Card Payment', '123 Maple St, Dallas, TX', 'Delivered', '2025-10-14'),

-- Order 2 - Cash on Delivery
(3, '2025-10-11 14:45:00', 'Home Delivery', 'Cash on Delivery', '87 Pine Rd, Austin, TX', 'Shipped', '2025-10-18'),

-- Order 3 - Card Payment
(5, '2025-10-12 09:20:00', 'Store Pickup', 'Card Payment', 'BrightBuy Austin Store', 'Confirmed', '2025-10-15'),

-- Order 4 - Cash on Delivery
(7, '2025-10-13 16:10:00', 'Home Delivery', 'Cash on Delivery', '210 Elm St, Houston, TX', 'Pending', '2025-10-20'),

-- Order 5 - Card Payment
(9, '2025-10-14 11:00:00', 'Home Delivery', 'Card Payment', '77 Cedar Ln, San Antonio, TX', 'Delivered', '2025-10-18');


-- ================================
-- ORDER ITEMS
-- ================================
INSERT INTO "OrderItem" ("order_id", "variant_id", "quantity", "price_at_purchase")
VALUES
-- Order 1
(1, 1, 1, 1150.00), -- iPhone 15 Pro 128GB
(1, 15, 1, 420.00), -- Sony WH-1000XM5
-- Order 2
(2, 25, 1, 380.00), -- Nintendo Switch OLED
-- Order 3
(3, 5, 1, 1750.00), -- Dell XPS 15
(3, 36, 1, 95.00), -- Samsung 970 EVO Plus 1TB
-- Order 4
(4, 10, 1, 450.00), -- Apple Watch Series 9
(4, 20, 2, 110.00), -- Amazon Echo
-- Order 5
(5, 4, 1, 1200.00), -- Samsung Galaxy S24
(5, 40, 1, 65.00); -- Razer DeathAdder V3


-- ================================
-- PAYMENTS
-- ================================
INSERT INTO "Payment" ("order_id", "payment_method", "payment_status", "payment_date")
VALUES
-- Order 1 (Card Payment -> same day as order)
(1, 'Card Payment', 'Paid', '2025-10-10 10:15:00'),
-- Order 2 (Cash on Delivery -> pay on delivery date)
(2, 'Cash on Delivery', 'Paid', '2025-10-18 14:45:00'),
-- Order 3 (Card Payment)
(3, 'Card Payment', 'Paid', '2025-10-12 09:20:00'),
-- Order 4 (Cash on Delivery - Pending)
(4, 'Cash on Delivery', 'Pending', NULL),
-- Order 5 (Card Payment)
(5, 'Card Payment', 'Paid', '2025-10-14 11:00:00');

-- ================================================
-- MANUAL SALE TRANSACTIONS (for already Paid orders)
-- ================================================

INSERT INTO "Transaction" (
  "party_id", "party_type", "variant_id", "transaction_type", "quantity", "transaction_date"
)
SELECT 
  o.user_id AS party_id,
  'Customer' AS party_type,
  oi.variant_id,
  'Sale' AS transaction_type,
  oi.quantity,
  p.payment_date AS transaction_date
FROM "Order" o
JOIN "OrderItem" oi ON o.order_id = oi.order_id
JOIN "Payment" p ON o.order_id = p.order_id
WHERE o.order_id IN (1, 2, 3, 4, 5)
  AND p.payment_status = 'Paid';

-- ================================
-- DELIVERY
-- ================================

INSERT INTO "Delivery" ("order_id", "user_id", "delivery_status", "estimated_delivery_date")
SELECT
  o.order_id,
  CASE o.order_id
    WHEN 1 THEN 2   -- Ethan Harris
    WHEN 2 THEN 4   -- Mason Lee
    WHEN 3 THEN 6   -- Liam Thompson
    WHEN 4 THEN 8   -- Noah Wilson
    WHEN 5 THEN 18  -- Daniel Allen
  END AS user_id,
  CASE
    WHEN p.payment_status = 'Paid' AND o.estimated_delivery_date < CURRENT_DATE THEN 'Delivered'
    WHEN p.payment_status = 'Paid' THEN 'In Transit'
    ELSE 'Pending'
  END AS delivery_status,
  o.estimated_delivery_date
FROM "Order" o
JOIN "Payment" p ON o.order_id = p.order_id
WHERE o.order_id IN (1,2,3,4,5)
-- avoid duplicate deliveries if run multiple times
AND NOT EXISTS (
  SELECT 1 FROM "Delivery" d WHERE d.order_id = o.order_id
);

-- Step 1: Reassign deliveries from removed drivers
UPDATE "Delivery"
SET user_id = CASE user_id
  WHEN 8 THEN 2
  WHEN 18 THEN 4
  ELSE user_id
END
WHERE user_id IN (8, 18);

-- Step 2: Delete extra delivery drivers
DELETE FROM "User"
WHERE user_id IN (8, 18,29)
  AND role = 'Delivery Driver';

-- Update image URLs in the Product table

UPDATE "Product" SET image = '/Assets/iphone-15-pro-gray.jpg' WHERE product_name = 'iPhone 15 Pro';
UPDATE "Product" SET image = '/Assets/Samsung Galaxy S24.jpg' WHERE product_name = 'Samsung Galaxy S24';
UPDATE "Product" SET image = '/Assets/Google Pixel 8.png' WHERE product_name = 'Google Pixel 8';
UPDATE "Product" SET image = '/Assets/MacBook Air M3.png' WHERE product_name = 'MacBook Air M3';
UPDATE "Product" SET image = '/Assets/Dell XPS 15.png' WHERE product_name = 'Dell XPS 15';
UPDATE "Product" SET image = '/Assets/HP Spectre x360.jpg' WHERE product_name = 'HP Spectre x360';
UPDATE "Product" SET image = '/Assets/iPad Pro 12.9.jpg' WHERE product_name = 'iPad Pro 12.9"';
UPDATE "Product" SET image = '/Assets/Samsung Galaxy Tab S9.jpg' WHERE product_name = 'Samsung Galaxy Tab S9';
UPDATE "Product" SET image = '/Assets/Lenovo Tab P11.jpg' WHERE product_name = 'Lenovo Tab P11';
UPDATE "Product" SET image = '/Assets/Apple Watch Series 9.jpg' WHERE product_name = 'Apple Watch Series 9';
UPDATE "Product" SET image = '/Assets/Samsung Galaxy Watch 6.jpg' WHERE product_name = 'Samsung Galaxy Watch 6';
UPDATE "Product" SET image = '/Assets/LG OLED C3 55.jpg' WHERE product_name = 'LG OLED C3 55"';
UPDATE "Product" SET image = '/Assets/Samsung QLED Q80C 65.jpg' WHERE product_name = 'Samsung QLED Q80C 65"';
UPDATE "Product" SET image = '/Assets/Sony Bravia XR A80L 55.jpg' WHERE product_name = 'Sony Bravia XR A80L 55"';
UPDATE "Product" SET image = '/Assets/Sony WH-1000XM5.jpg' WHERE product_name = 'Sony WH-1000XM5';
UPDATE "Product" SET image = '/Assets/Apple AirPods Pro 2.jpg' WHERE product_name = 'Apple AirPods Pro 2';
UPDATE "Product" SET image = '/Assets/Bose QC45.jpg' WHERE product_name = 'Bose QC45';
UPDATE "Product" SET image = '/Assets/JBL Charge 5.jpg' WHERE product_name = 'JBL Charge 5';
UPDATE "Product" SET image = '/Assets/Sonos One.jpg' WHERE product_name = 'Sonos One';
UPDATE "Product" SET image = '/Assets/Amazon Echo (5th Gen).jpg' WHERE product_name = 'Amazon Echo (5th Gen)';
UPDATE "Product" SET image = '/Assets/Canon EOS R10.jpg' WHERE product_name = 'Canon EOS R10';
UPDATE "Product" SET image = '/Assets/Sony Alpha ZV-E10.jpg' WHERE product_name = 'Sony Alpha ZV-E10';
UPDATE "Product" SET image = '/Assets/PlayStation 5.png' WHERE product_name = 'PlayStation 5';
UPDATE "Product" SET image = '/Assets/Xbox Series X.jpg' WHERE product_name = 'Xbox Series X';
UPDATE "Product" SET image = '/Assets/Nintendo Switch OLED.jpg' WHERE product_name = 'Nintendo Switch OLED';
UPDATE "Product" SET image = '/Assets/ASUS ROG Swift 27.jpg' WHERE product_name = 'ASUS ROG Swift 27"';
UPDATE "Product" SET image = '/Assets/Dell Ultrasharp 32.jpg' WHERE product_name = 'Dell Ultrasharp 32"';
UPDATE "Product" SET image = '/Assets/HP LaserJet Pro M404dn.jpg' WHERE product_name = 'HP LaserJet Pro M404dn';
UPDATE "Product" SET image = '/Assets/Canon PIXMA G3010.jpg' WHERE product_name = 'Canon PIXMA G3010';
UPDATE "Product" SET image = '/Assets/TP-Link Archer AX6000.jpg' WHERE product_name = 'TP-Link Archer AX6000';
UPDATE "Product" SET image = '/Assets/Netgear Nighthawk AX12.jpg' WHERE product_name = 'Netgear Nighthawk AX12';
UPDATE "Product" SET image = '/Assets/Dyson V15 Vacuum.jpg' WHERE product_name = 'Dyson V15 Vacuum';
UPDATE "Product" SET image = '/Assets/Philips Air Fryer XXL.jpg' WHERE product_name = 'Philips Air Fryer XXL';
UPDATE "Product" SET image = '/Assets/Instant Pot Duo 7-in-1.jpg' WHERE product_name = 'Instant Pot Duo 7-in-1';
UPDATE "Product" SET image = '/Assets/Logitech MX Master 3S.jpg' WHERE product_name = 'Logitech MX Master 3S';
UPDATE "Product" SET image = '/Assets/Corsair K70 RGB Keyboard.jpg' WHERE product_name = 'Corsair K70 RGB Keyboard';
UPDATE "Product" SET image = '/Assets/Samsung 970 EVO Plus 1TB.jpg' WHERE product_name = 'Samsung 970 EVO Plus 1TB';
UPDATE "Product" SET image = '/Assets/Seagate Backup Plus 2TB.jpg' WHERE product_name = 'Seagate Backup Plus 2TB';
UPDATE "Product" SET image = '/Assets/SanDisk Ultra 128GB.jpg' WHERE product_name = 'SanDisk Ultra 128GB';
UPDATE "Product" SET image = '/Assets/Razer DeathAdder V3.jpg' WHERE product_name = 'Razer DeathAdder V3';

-- changes added when updating the add products functionality in the admin section

ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS "Product_category_id_fkey";
ALTER TABLE "Product"
ADD CONSTRAINT "Product_category_id_fkey"
FOREIGN KEY ("category_id")
REFERENCES "Category"("category_id")
ON DELETE CASCADE;

ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS "Product_SKU_key";
ALTER TABLE "Product"
ADD CONSTRAINT "Product_SKU_key" UNIQUE ("SKU");

CREATE EXTENSION IF NOT EXISTS "pgcrypto";


CREATE UNIQUE INDEX product_name_unique_idx
ON "Product" (UPPER("product_name"));


CREATE OR REPLACE FUNCTION set_unique_sku()
RETURNS TRIGGER AS $$
DECLARE
  new_sku TEXT;
  is_unique BOOLEAN := FALSE;
BEGIN
  WHILE NOT is_unique LOOP
    new_sku := 'SKU_' || UPPER(
      REPLACE(
        REPLACE(
          encode(gen_random_bytes(6), 'base64'),
        '+', '_'),
      '/', '-')
    );
    
    PERFORM 1 FROM "Product" WHERE "SKU" = new_sku;
    IF NOT FOUND THEN
      is_unique := TRUE;
    END IF;
  END LOOP;
  
  NEW."SKU" := new_sku;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


CREATE TRIGGER trigger_set_sku
BEFORE INSERT ON "Product"
FOR EACH ROW
EXECUTE FUNCTION set_unique_sku();

-- 1. Remove the delivery_status column from "Delivery"
ALTER TABLE "Delivery"
DROP COLUMN IF EXISTS delivery_status;

-- 2. Modify order_status check to remove 'Cancelled'
-- First, drop the existing constraint
ALTER TABLE "Order"
DROP CONSTRAINT IF EXISTS order_order_status_check;

-- Then, create a new check constraint without 'Cancelled'
ALTER TABLE "Order"
ADD CONSTRAINT order_order_status_check
CHECK (order_status IN ('Pending','Confirmed','Shipped','Delivered'));

-- 3. Modify payment_status check to remove 'Failed'
-- Drop the existing constraint
ALTER TABLE "Payment"
DROP CONSTRAINT IF EXISTS payment_payment_status_check;

-- Add the new constraint without 'Failed'
ALTER TABLE "Payment"
ADD CONSTRAINT payment_payment_status_check
CHECK (payment_status IN ('Pending','Paid'));

-- Create table
CREATE TABLE Cities (
    city_id SERIAL PRIMARY KEY,
    city_name VARCHAR(100) NOT NULL
);

-- Insert main cities of Texas
INSERT INTO Cities (city_name) VALUES
('Houston'),
('San Antonio'),
('Dallas'),
('Austin'),
('Fort Worth'),
('El Paso'),
('Arlington'),
('Corpus Christi'),
('Plano'),
('Lubbock'),
('Irving'),
('Laredo'),
('Garland'),
('Amarillo'),
('Grand Prairie'),
('Brownsville'),
('McKinney'),
('Frisco'),
('Pasadena'),
('Killeen');

INSERT INTO "User" ("user_id", "name", "email", "password", "phone", "role")
VALUES
(8, 'John Doe', 'john8@example.com', 'hashedpassword_8', '7123945678', 'Registered Customer');
-- SELECT setval(pg_get_serial_sequence('"User"', 'user_id'), (SELECT MAX("user_id") FROM "User"));
-- This ensures that the next inserted user gets a user_id greater than the current max (so PostgreSQL won’t try to reuse 8).

INSERT INTO "User" ("user_id", "name", "email", "password", "phone", "role")
VALUES
(18, 'Jane Smith', 'jane18@example.com', 'hashedpassword_18', '8723456789', 'Registered Customer');

BEGIN;

TRUNCATE "Transaction", "Delivery", "Payment", "OrderItem", "Order" RESTART IDENTITY CASCADE;

BEGIN;

BEGIN;

INSERT INTO "Order" ("user_id","order_date","mode_of_delivery","payment_method","delivery_address","order_status","estimated_delivery_date") VALUES
-- Q1 (Jan-Mar)
(1,'2025-01-10 10:05:00','Home Delivery','Card Payment','123 Maple St, Austin, TX','Delivered','2025-01-14'),
(5,'2025-01-26 15:30:00','Store Pickup','Cash on Delivery','BrightBuy Austin Store','Delivered','2025-01-26'),
(3,'2025-02-12 09:10:00','Home Delivery','Card Payment','87 Pine Rd, Dallas, TX','Delivered','2025-02-15'),
(7,'2025-03-03 18:45:00','Home Delivery','Card Payment','77 Cedar Ln, Houston, TX','Delivered','2025-03-07'),

-- Q2 (Apr-Jun)
(13,'2025-04-05 11:00:00','Home Delivery','Card Payment','14 Oak Ave, Plano, TX','Delivered','2025-04-09'),
(5,'2025-04-12 14:20:00','Store Pickup','Cash on Delivery','BrightBuy Frisco','Delivered','2025-04-12'),
(11,'2025-04-20 16:00:00','Home Delivery','Card Payment','55 Birch St, Irving, TX','Delivered','2025-04-24'),
(9,'2025-05-07 16:15:00','Home Delivery','Cash on Delivery','400 Commerce St, Dallas, TX','Delivered','2025-05-11'),
(12,'2025-05-28 09:40:00','Home Delivery','Card Payment','2 Lakeview Dr, Corpus Christi, TX','Delivered','2025-06-01'),
(14,'2025-06-10 10:30:00','Store Pickup','Card Payment','BrightBuy Dallas','Delivered','2025-06-10'),

-- Q3 (Jul-Sep)
(14,'2025-07-02 12:00:00','Home Delivery','Card Payment','9 Sycamore St, Arlington, TX','Delivered','2025-07-06'),
(8,'2025-07-18 10:10:00','Store Pickup','Cash on Delivery','BrightBuy San Antonio','Delivered','2025-07-18'),
(10,'2025-08-04 15:45:00','Home Delivery','Card Payment','100 River Rd, Fort Worth, TX','Delivered','2025-08-08'),
(13,'2025-08-25 09:00:00','Home Delivery','Card Payment','7 Prairie Ln, Lubbock, TX','Delivered','2025-08-29'),
(15,'2025-09-05 11:30:00','Home Delivery','Card Payment','42 Harbor Rd, Galveston, TX','Delivered','2025-09-09'),

-- Q4 (Oct-Dec)
(16,'2025-10-03 09:00:00','Home Delivery','Card Payment','48 Walnut St, Dallas, TX','Pending','2025-10-08'),
(17,'2025-10-07 13:15:00','Home Delivery','Card Payment','275 Broad St, Austin, TX','Pending','2025-10-12'),
(18,'2025-10-11 18:40:00','Store Pickup','Cash on Delivery','BrightBuy ATX HQ','Pending','2025-10-12'),
(19,'2025-10-14 11:25:00','Home Delivery','Card Payment','8 Magnolia Dr, Round Rock, TX','Pending','2025-10-18'),
(20,'2025-10-18 16:50:00','Home Delivery','Cash on Delivery','3 North St, Killeen, TX','Pending','2025-10-23'),
(21,'2025-11-02 10:10:00','Home Delivery','Card Payment','990 Commerce Blvd, Frisco, TX','Confirmed','2025-11-06'),
(22,'2025-11-10 15:30:00','Home Delivery','Card Payment','210 Central Ave, Denton, TX','Shipped','2025-11-15'),
(23,'2025-12-01 09:35:00','Home Delivery','Card Payment','42 Harbor Rd, Galveston, TX','Delivered','2025-12-05'),
(24,'2025-12-08 13:00:00','Store Pickup','Cash on Delivery','BrightBuy Corpus Store','Delivered','2025-12-09'),
(25,'2025-12-15 16:45:00','Home Delivery','Card Payment','Downtown, Austin, TX','Pending','2025-12-18'),
(16,'2025-12-20 12:10:00','Home Delivery','Card Payment','Suburb, Dallas, TX','Pending','2025-12-25'),
(7,'2025-12-22 09:30:00','Store Pickup','Cash on Delivery','BrightBuy North','Pending','2025-12-22'),
(8,'2025-12-28 18:00:00','Home Delivery','Card Payment','Harbor St, Houston, TX','Pending','2026-01-02');

COMMIT;

BEGIN;

INSERT INTO "OrderItem" ("order_id", "variant_id", "quantity", "price_at_purchase") VALUES
-- Q1 (Smartphones, Laptops)
(1, 1, 2, 1099.00),
(1, 8, 1, 1449.00),
(2, 12, 1, 1099.00),
(3, 17, 3, 399.00),
(4, 20, 1, 1499.00),

-- Q2 (Headphones, Speakers, Cameras)
(5, 25, 2, 399.00),
(6, 29, 1, 179.00),
(7, 32, 2, 979.00),
(8, 35, 1, 499.00),
(9, 40, 3, 599.00),
(10, 42, 2, 299.00),

-- Q3 (Networking, Home, Accessories, Storage)
(11, 44, 1, 299.00),
(12, 46, 2, 749.00),
(13, 48, 1, 99.00),
(14, 50, 2, 89.00),
(15, 52, 1, 29.00),

-- Q4 (Extra random categories)
(16, 2, 2, 1199.00),
(17, 9, 1, 1699.00),
(18, 14, 3, 899.00),
(19, 18, 1, 429.00),
(20, 23, 2, 1599.00),
(21, 28, 1, 329.00),
(22, 30, 2, 219.00),
(23, 34, 1, 699.00),
(24, 37, 2, 499.00),
(25, 41, 1, 999.00),
(26, 43, 2, 249.00),
(27, 45, 1, 399.00),
(28, 47, 2, 349.00);

COMMIT;

INSERT INTO "Payment" ("order_id", "payment_method", "payment_status", "payment_date")
SELECT
  o.order_id,
  o.payment_method,
  CASE
    WHEN o.payment_method = 'Card Payment' THEN 'Paid'
    WHEN o.order_status = 'Delivered' THEN 'Paid'
    ELSE 'Pending'
  END,
  CASE
    WHEN o.payment_method = 'Card Payment' THEN o.order_date
    WHEN o.order_status = 'Delivered' THEN o.estimated_delivery_date
    ELSE NULL
  END
FROM "Order" o;

COMMIT;

BEGIN;

INSERT INTO "Delivery" ("order_id", "user_id", "estimated_delivery_date")
SELECT
  o.order_id,
  CASE
    WHEN o.order_status = 'Pending' THEN NULL
    ELSE
      CASE (ROW_NUMBER() OVER (ORDER BY o.order_id) - 1) % 3
        WHEN 0 THEN 2
        WHEN 1 THEN 4
        WHEN 2 THEN 6
      END
  END,
  o.estimated_delivery_date
FROM "Order" o;

COMMIT;

BEGIN;

INSERT INTO "Transaction" ("party_id", "party_type", "variant_id", "transaction_type", "quantity", "transaction_date")
SELECT
  o.user_id,
  'Customer',
  oi.variant_id,
  'Sale',
  oi.quantity,
  p.payment_date
FROM "Order" o
JOIN "Payment" p ON o.order_id = p.order_id
JOIN "OrderItem" oi ON o.order_id = oi.order_id
WHERE p.payment_status = 'Paid';

COMMIT;

BEGIN;

-- Smartphones
UPDATE "Product" SET "description" = 'Apple’s flagship smartphone featuring the powerful A17 Pro chip, advanced camera system, and premium titanium design.' WHERE "SKU" = 'SKU_IP15PRO';
UPDATE "Product" SET "description" = 'Samsung’s latest Galaxy S24 with a dynamic AMOLED 2X display, AI-enhanced photography, and Snapdragon 8 Gen 3 processor.' WHERE "SKU" = 'SKU_SGS24';
UPDATE "Product" SET "description" = 'Google Pixel 8 powered by Google Tensor G3, offering cutting-edge AI features, exceptional camera performance, and 7 years of updates.' WHERE "SKU" = 'SKU_PIXEL8';

-- Laptops
UPDATE "Product" SET "description" = 'MacBook Air M3 delivers stunning performance with Apple Silicon, a lightweight design, and all-day battery life for everyday productivity.' WHERE "SKU" = 'SKU_MBA_M3';
UPDATE "Product" SET "description" = 'Dell XPS 15 combines a sleek aluminum chassis, vibrant OLED display, and powerful Intel Core performance for creators and professionals.' WHERE "SKU" = 'SKU_XPS15';
UPDATE "Product" SET "description" = 'HP Spectre x360 is a premium convertible laptop featuring 360° flexibility, vivid touchscreen, and long-lasting battery for versatile use.' WHERE "SKU" = 'SKU_SPECTRE360';

-- Tablets
UPDATE "Product" SET "description" = 'The iPad Pro 12.9” with Apple M2 chip offers desktop-class performance, Liquid Retina XDR display, and Apple Pencil 2 support for pros.' WHERE "SKU" = 'SKU_IPADPRO129';
UPDATE "Product" SET "description" = 'Samsung Galaxy Tab S9 delivers a stunning AMOLED display, S Pen support, and flagship performance for work and entertainment on the go.' WHERE "SKU" = 'SKU_GALAXYTABS9';
UPDATE "Product" SET "description" = 'Lenovo Tab P11 offers a sharp 2K display, quad speakers, and multitasking capabilities for productivity and family entertainment.' WHERE "SKU" = 'SKU_LENOVOP11';

-- Smartwatches
UPDATE "Product" SET "description" = 'Apple Watch Series 9 features a brighter display, faster chip, advanced health tracking, and seamless iPhone integration.' WHERE "SKU" = 'SKU_AW9';
UPDATE "Product" SET "description" = 'Samsung Galaxy Watch 6 combines elegant design with advanced health monitoring and powerful fitness tracking on Wear OS.' WHERE "SKU" = 'SKU_GW6';

-- Televisions
UPDATE "Product" SET "description" = 'LG OLED C3 55” offers perfect blacks, stunning 4K HDR visuals, and cinematic sound powered by the α9 Gen6 AI Processor.' WHERE "SKU" = 'SKU_LGOLED55C3';
UPDATE "Product" SET "description" = 'Samsung QLED Q80C 65” delivers bright Quantum HDR visuals, immersive sound, and Smart TV features with Tizen OS.' WHERE "SKU" = 'SKU_QLEDQ80C';
UPDATE "Product" SET "description" = 'Sony Bravia XR A80L 55” brings lifelike OLED colors, XR Cognitive Processor intelligence, and Dolby Vision cinematic quality.' WHERE "SKU" = 'SKU_SONYXR55';

-- Headphones
UPDATE "Product" SET "description" = 'Sony WH-1000XM5 provides industry-leading noise cancellation, superior audio quality, and all-day comfort for travel and work.' WHERE "SKU" = 'SKU_SONYXM5';
UPDATE "Product" SET "description" = 'Apple AirPods Pro (2nd Gen) feature personalized spatial audio, adaptive transparency, and best-in-class active noise cancellation.' WHERE "SKU" = 'SKU_AIRPODSPRO2';
UPDATE "Product" SET "description" = 'Bose QuietComfort 45 combines balanced sound, adjustable noise cancellation, and plush comfort for immersive listening.' WHERE "SKU" = 'SKU_BOSEQC45';

-- Speakers
UPDATE "Product" SET "description" = 'JBL Charge 5 is a rugged, waterproof Bluetooth speaker delivering bold sound and up to 20 hours of playtime.' WHERE "SKU" = 'SKU_JBLCHG5';
UPDATE "Product" SET "description" = 'Sonos One offers rich, room-filling sound with built-in Alexa and Google Assistant voice control.' WHERE "SKU" = 'SKU_SONOSONE';
UPDATE "Product" SET "description" = 'Amazon Echo (5th Gen) is a smart speaker powered by Alexa, offering improved sound and smart home integration.' WHERE "SKU" = 'SKU_ECHO5';

-- Cameras
UPDATE "Product" SET "description" = 'Canon EOS R10 is a compact mirrorless camera with fast autofocus, 4K recording, and versatile APS-C performance for creators.' WHERE "SKU" = 'SKU_CANONR10';
UPDATE "Product" SET "description" = 'Sony ZV-E10 is a vlogging-focused mirrorless camera offering real-time eye autofocus, 4K video, and flip-out display.' WHERE "SKU" = 'SKU_SONYZVE10';

-- Gaming Consoles
UPDATE "Product" SET "description" = 'PlayStation 5 delivers breathtaking 4K gaming, lightning-fast SSD performance, and immersive DualSense controller feedback.' WHERE "SKU" = 'SKU_PS5';
UPDATE "Product" SET "description" = 'Xbox Series X offers next-gen gaming with true 4K performance, high-speed SSD, and access to Game Pass Ultimate.' WHERE "SKU" = 'SKU_XBSX';
UPDATE "Product" SET "description" = 'Nintendo Switch OLED features a vibrant OLED screen, flexible docked/handheld modes, and fun multiplayer experiences.' WHERE "SKU" = 'SKU_NSWOLED';

-- Monitors
UPDATE "Product" SET "description" = 'ASUS ROG Swift 27” gaming monitor delivers ultra-smooth 165Hz refresh rate, 1ms response, and G-SYNC compatibility.' WHERE "SKU" = 'SKU_ROG27';
UPDATE "Product" SET "description" = 'Dell Ultrasharp 32” provides professional-grade 4K clarity, accurate color reproduction, and modern connectivity options.' WHERE "SKU" = 'SKU_DELLU32';

-- Printers
UPDATE "Product" SET "description" = 'HP LaserJet Pro M404dn is a reliable monochrome laser printer with duplex printing and enterprise-level security features.' WHERE "SKU" = 'SKU_HPM404';
UPDATE "Product" SET "description" = 'Canon PIXMA G3010 offers cost-efficient ink tank printing with wireless connectivity for home and small office use.' WHERE "SKU" = 'SKU_PIXMAG3010';

-- Networking Devices
UPDATE "Product" SET "description" = 'TP-Link Archer AX6000 is a high-performance WiFi 6 router offering ultra-fast dual-band speeds and advanced parental controls.' WHERE "SKU" = 'SKU_TPLINKAX6000';
UPDATE "Product" SET "description" = 'Netgear Nighthawk AX12 delivers blazing WiFi 6 performance, 12-stream support, and extensive security for large households.' WHERE "SKU" = 'SKU_NGA12';

-- Home Appliances
UPDATE "Product" SET "description" = 'Dyson V15 Detect intelligently optimizes suction, detects hidden dust with laser illumination, and offers powerful cordless cleaning.' WHERE "SKU" = 'SKU_DYSONV15';
UPDATE "Product" SET "description" = 'Philips Air Fryer XXL uses rapid air technology for healthier frying with less oil and smart preset cooking modes.' WHERE "SKU" = 'SKU_PHLPAFXL';
UPDATE "Product" SET "description" = 'Instant Pot Duo 7-in-1 combines pressure cooking, slow cooking, steaming, and more into a single smart appliance.' WHERE "SKU" = 'SKU_IPDUO7';

-- Computer Accessories
UPDATE "Product" SET "description" = 'Logitech MX Master 3S features precision tracking, quiet clicks, and ergonomic design for seamless productivity.' WHERE "SKU" = 'SKU_MXM3S';
UPDATE "Product" SET "description" = 'Corsair K70 RGB Keyboard offers mechanical switches, per-key RGB lighting, and premium aluminum frame for gamers.' WHERE "SKU" = 'SKU_K70RGB';
UPDATE "Product" SET "description" = 'Razer DeathAdder V3 provides ultralight comfort, Focus Pro 30K optical sensor, and lightning-fast response for esports.' WHERE "SKU" = 'SKU_RAZERDAV3';

-- Storage Devices
UPDATE "Product" SET "description" = 'Samsung 970 EVO Plus 1TB NVMe SSD offers ultra-fast read/write speeds for gaming and high-performance computing.' WHERE "SKU" = 'SKU_970EVO1TB';
UPDATE "Product" SET "description" = 'Seagate Backup Plus 2TB provides reliable external storage with USB 3.0 connectivity and sleek portable design.' WHERE "SKU" = 'SKU_SEAGATE2TB';
UPDATE "Product" SET "description" = 'SanDisk Ultra 128GB USB 3.0 flash drive delivers fast file transfers and compact, durable storage on the go.' WHERE "SKU" = 'SKU_SANDISK128';

COMMIT;

-- Update stock for Dell XPS 15
UPDATE "Variant"
SET stock_quantity = stock_quantity + 10
WHERE variant_id = 10;

-- Update stock for MacBook Air M3
UPDATE "Variant"
SET stock_quantity = stock_quantity + 5
WHERE variant_id = 8;

-- ============================================
-- Procedure: add_product_with_variant_proc
-- Description: Inserts a new product + variant safely
-- ============================================

CREATE OR REPLACE PROCEDURE add_product_with_variant_proc(
    IN p_product_name TEXT,
    IN p_category_id INT,
    IN p_description TEXT,
    IN p_image TEXT,
    IN p_variant_name TEXT,
    IN p_stock_quantity INT,
    IN p_price NUMERIC,
    IN p_price_at_purchase NUMERIC,
    OUT o_product_id INT,
    OUT o_variant_id INT,
    OUT o_sku TEXT,
    OUT o_message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
BEGIN
    -- Start a local transaction block
    BEGIN
        -- Validate category
        IF NOT EXISTS (SELECT 1 FROM "Category" WHERE category_id = p_category_id) THEN
            RAISE EXCEPTION 'Invalid category_id: %', p_category_id;
        END IF;

        -- Insert product
        INSERT INTO "Product" (category_id, product_name, description, image)
        VALUES (p_category_id, p_product_name, p_description, p_image)
        RETURNING product_id, "SKU" INTO o_product_id, o_sku;

        -- Insert variant
        INSERT INTO "Variant" (product_id, variant_name, stock_quantity, price, price_at_purchase)
        VALUES (o_product_id, p_variant_name, p_stock_quantity, p_price, p_price_at_purchase)
        RETURNING variant_id INTO o_variant_id;

        o_message := 'Product and variant added successfully';

    EXCEPTION
        WHEN OTHERS THEN
            o_message := format('Error adding product: %', SQLERRM);
            ROLLBACK;
            RETURN;
    END;
END;
$$;

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

