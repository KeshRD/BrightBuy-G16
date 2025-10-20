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
  "image" VARCHAR(250)
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


CREATE TABLE "Cities" (
    city_id SERIAL PRIMARY KEY,
    city_name VARCHAR(100) NOT NULL
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

-- =============================================================================
--  TRIGGER FUNCTION: Populates the "SKU" column with a unique, generated ID
-- =============================================================================

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



INSERT INTO "Cities" (city_name) VALUES
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
