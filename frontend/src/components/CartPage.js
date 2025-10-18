import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const CartPage = () => {
  const [cartItems, setCartItems] = useState([]);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Function to fetch cart items, can be reused
  const fetchCart = async () => {
    try {
      const response = await axios.get('http://localhost:5000/cart');
      setCartItems(response.data);
    } catch (err) {
      console.error('Fetch cart error:', err);
      if (err.response && (err.response.status === 401 || err.response.status === 403)) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        delete axios.defaults.headers.common['Authorization'];
        navigate('/');
      } else {
        setError('Failed to load cart');
      }
    }
  };

  useEffect(() => {
    const fetchCart = async () => {
      try {
        const response = await axios.get('http://localhost:5000/cart');
        setCartItems(response.data);
      } catch (err) {
        console.error('Fetch cart error:', err);
        if (err.response && (err.response.status === 401 || err.response.status === 403)) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          delete axios.defaults.headers.common['Authorization'];
          navigate('/');
        } else {
          setError('Failed to load cart');
        }
      }
    };

    if (!localStorage.getItem('token')) {
      navigate('/');
      return;
    }

    fetchCart();
  }, [navigate]);

  const handleQuantityChange = async (item, newQuantity) => {
    if (newQuantity < 1) return;
    if (newQuantity > item.stock_quantity) {
      alert(`Sorry, only ${item.stock_quantity} units are in stock.`);
      return;
    if (newQuantity < 1) return; // Prevent quantity from being less than 1
    if (newQuantity > item.stock_quantity) {
        alert(`Sorry, only ${item.stock_quantity} units are in stock.`);
        return;
    }

    try {
      const response = await axios.post('http://localhost:5000/cart/update', {
        cart_item_id: item.cart_item_id,
        quantity: newQuantity,
      });

      if (response.data.success) {
        // Update the state locally for a quick UI response
        setCartItems(currentItems =>
          currentItems.map(cartItem =>
            cartItem.cart_item_id === item.cart_item_id
              ? { ...cartItem, quantity: newQuantity }
              : cartItem
          )
        );
      } else {
        setError(response.data.message || 'Failed to update quantity.');
      }
    } catch (err) {
      console.error('Update quantity error:', err);
      setError(err.response?.data?.message || 'Failed to update quantity.');
    }
  };

  const handleRemoveItem = async (cartItemId) => {
    try {
      const response = await axios.delete(`http://localhost:5000/cart/remove/${cartItemId}`);
      if (response.data.success) {
        // Update state locally
        setCartItems(currentItems => currentItems.filter(item => item.cart_item_id !== cartItemId));
      } else {
        setError('Failed to remove item.');
      }
    } catch (err) {
      console.error('Remove item error:', err);
      setError('Failed to remove item.');
    }
  };

  const total = cartItems.reduce((sum, item) => {
    const price = parseFloat(item.price);
    return isNaN(price) ? sum : sum + item.quantity * price;
  }, 0);

  return (
    <div className="App-header">
      <div className="page-header">
        <button onClick={() => navigate('/home')}>Continue Shopping</button>
        <h2>Your Cart</h2>
      </div>
      {error && <p className="error">{error}</p>}
      {cartItems.length === 0 ? (
        <div className="cart-empty">
          <p>Your cart is empty.</p>
        </div>
      ) : (
        <>
          <ul className="cart-list">
            {cartItems.map((item) => (
              <li key={item.cart_item_id}>
                <img
              src={`http://localhost:5000${item.image}`}
              alt={item.product_name}
              className="product-card-image"
            />
                <img src={item.image} alt={item.product_name} className="cart-item-image" />
                <div className="cart-item-details">
                  <h3>{item.product_name} - {item.variant_name}</h3>
                  <p>Price: ${parseFloat(item.price).toFixed(2)}</p>
                  <div className="quantity-controls">
                    <button className="quantity-btn" onClick={() => handleQuantityChange(item, item.quantity - 1)} disabled={item.quantity <= 1}>-</button>
                    <span>{item.quantity}</span>
                    <button className="quantity-btn" onClick={() => handleQuantityChange(item, item.quantity + 1)}>+</button>
                  </div>
                </div>
                <div className="cart-item-actions">
                  <p>Subtotal: ${(item.quantity * parseFloat(item.price)).toFixed(2)}</p>
                  <button className="remove-btn" onClick={() => handleRemoveItem(item.cart_item_id)}>Remove</button>
                    <p>Subtotal: ${(item.quantity * parseFloat(item.price)).toFixed(2)}</p>
                    <button className="remove-btn" onClick={() => handleRemoveItem(item.cart_item_id)}>Remove</button>
                </div>
              </li>
            ))}
          </ul>
          <div className="cart-summary">
            <h3>Total: ${total.toFixed(2)}</h3>
            <button className="checkout-btn" onClick={() => navigate('/checkout')}>Proceed to Checkout</button>
          </div>
        </>
      )}
    </div>
  );
};

export default CartPage;

