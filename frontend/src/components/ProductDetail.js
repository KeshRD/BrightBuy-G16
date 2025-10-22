import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import './productdetail.css';
import Navbar from './Navbar'; // FIX: Added missing Navbar import

const ProductDetail = () => {
  // FIX: All the component logic was missing and has been restored
  const { productId } = useParams();
  const [product, setProduct] = useState(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      navigate('/');
      return;
    }
    const token = localStorage.getItem('token');
    if (token) axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    const fetchProduct = async () => {
      try {
        const response = await axios.get(`http://localhost:5000/products/${productId}`);
        setProduct(response.data);
      } catch (err) {
        console.error('Error fetching product details:', err);
        setError('Failed to load product details');
      }
    };
    fetchProduct();
  }, [productId, navigate]);

  const handleAddToCart = async (variantId) => {
    try {
      const response = await axios.post('http://localhost:5000/cart/add', { variant_id: variantId, quantity: 1 });
      if (response.data.success) {
        alert('Added to cart!');
        // Consider refreshing cart count in navbar here
      } else {
        setError(response.data.message || 'Failed to add to cart');
      }
    } catch (err) {
      console.error('Add to cart error:', err);
      setError(err.response?.data?.message || 'Failed to add to cart');
    }
  };

  if (!product) return (
    <>
      <Navbar />
      <div className="App-header">{error || 'Loading...'}</div>
    </>
  );

  return (
    <>
      <Navbar />
      <div className="App-header product-detail">
        <div className="product-main">
          <div className="product-image-container">
            <img
              src={`http://localhost:5000${product.image}`}
              alt={product.product_name}
              className="product-card-image"
            />
          </div>
          <div className="product-details">
            <h2 className="product-title">{product.product_name}</h2>
            <div className="product-info">
              <p className="product-description">{product.description}</p>
              <p className="product-category">Category: {product.category_name}</p>
            </div>
            <div className="variants-section">
              <h3 className="variants-title">Variants</h3>
              {error && <p className="error">{error}</p>}
              <ul>
                {product.variants.map((variant) => (
                  <li key={variant.variant_id}>
                    <p className="variant-name">Variant: {variant.variant_name}</p>
                    <p className="variant-price">Price: ${variant.price.toFixed(2)}</p>
                    <p className="variant-stock">Stock: {variant.stock_quantity} units</p>
                    <button className="add-to-cart-btn" onClick={() => handleAddToCart(variant.variant_id)}>Add to Cart</button>
                    <button className="buy-now-btn" onClick={() => {
                      navigate('/checkout', {
                        state: {
                          buyNowItem: {
                            ...product,
                            ...variant,
                            quantity: 1,
                            image: product.image,
                            cart_item_id: `buy-now-${variant.variant_id}`
                          }
                        }
                      });
                    }}>Buy Now</button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ProductDetail;

