import React, { useState, useEffect, useContext } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { CartContext } from '../context/CartContext';

const ProductDetail = () => {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const { addToCart } = useContext(CartContext);

  useEffect(() => {
    axios.get(`http://localhost:5000/api/products/${id}`).then(res => {
      setProduct(res.data[0]);  // First row for product info
      setSelectedVariant(res.data[0]);  // Default variant
    });
  }, [id]);

  if (!product) return <p>Loading...</p>;

  return (
    <div>
      <h1>{product.name}</h1>
      <p>{product.description}</p>
      <h2>Variants:</h2>
      {product.variants ? product.variants.map(v => (  // Adjust if data structure differs
        <div key={v.variant_id}>
          <p>{JSON.stringify(v.attributes)} - ${v.price} (Stock: {v.stock_qty})</p>
          <button onClick={() => setSelectedVariant(v)}>Select</button>
        </div>
      )) : <p>No variants</p>}
      <button onClick={() => addToCart({ variant_id: selectedVariant.variant_id, quantity: 1, price: selectedVariant.price, name: product.name })}>
        Add to Cart
      </button>
    </div>
  );
};

export default ProductDetail;