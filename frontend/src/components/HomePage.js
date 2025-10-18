import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Navbar from './Navbar'; // FIX: Added the missing import for the Navbar

const HomePage = () => {
  const [products, setProducts] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      navigate('/');
      return;
    }

    const fetchProducts = async () => {
      try {
        const response = await axios.get('http://localhost:5000/products');
        setProducts(response.data);
      } catch (err) {
        console.error('Error fetching products:', err);
      }
    };
    fetchProducts();
  }, [navigate]);

  // FIX: Added the missing function definition
  const handleProductClick = (productId) => {
    navigate(`/product/${productId}`);
  };

  return (
    <>
      <Navbar /> 
      <div className="App-header" style={{ paddingTop: '80px' }}>
        <h2>Our Products</h2>
        
        <div className="product-grid">
          {products.map((product) => (
            <div key={product.product_id} className="product-card" onClick={() => handleProductClick(product.product_id)}>
            <img
              src={`http://localhost:5000${product.image}`}
              alt={product.product_name}
              className="product-card-image"
            />

              <img src={product.image} alt={product.product_name} className="product-card-image" />
              <h3>{product.product_name}</h3>
              <p>{product.description}</p>
              <p>Starting at: ${product.variants && product.variants.length > 0 ? Math.min(...product.variants.map(v => v.price)).toFixed(2) : 'N/A'}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default HomePage;

