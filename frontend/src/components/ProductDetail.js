// src/components/ProductDetail.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';

const ProductDetail = () => {
  const { productId } = useParams();
  const [product, setProduct] = useState(null);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const response = await axios.get(`http://localhost:5000/products/${productId}`);
        setProduct(response.data);
      } catch (err) {
        console.error('Error fetching product details:', err);
      }
    };
    fetchProduct();
  }, [productId]);

  if (!product) return <div className="App-header">Loading...</div>;

  return (
    <div className="App-header product-detail">
      <h2>{product.product_name}</h2>
      <p>{product.description}</p>
      <h3>Category: {product.category_name}</h3>
      <p>SKU: {product.SKU}</p>
      <h3>Variants</h3>
      <ul>
        {product.variants.map((variant) => (
          <li key={variant.variant_id}>
            <p>Variant: {variant.variant_name}</p>
            <p>Price: ${variant.price.toFixed(2)}</p>
            <p>Stock: {variant.stock_quantity} units</p>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ProductDetail;