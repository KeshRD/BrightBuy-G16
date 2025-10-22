
--  TRIGGER FUNCTION: Add Sale Transaction when Payment is Paid


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

--  TRIGGER FUNCTION: Update Variant Stock on Transaction


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

--  TRIGGER FUNCTION: Set Unique SKU

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

