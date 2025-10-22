CREATE UNIQUE INDEX product_name_unique_idx
ON "Product" (UPPER("product_name"));