
-- Procedure: add_product_with_variant_proc
-- Description: Inserts a new product + variant safely


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



