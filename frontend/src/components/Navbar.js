import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './navbar.css';

import cartIcon from '../assets/cart.svg';
import userIcon from '../assets/user.svg';

const Navbar = () => {
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [cartItemCount, setCartItemCount] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCartItems = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        if (!token) {
          setCartItemCount(0);
          return;
        }
        const response = await axios.get('http://localhost:5000/cart', { headers });
        setCartItemCount(Array.isArray(response.data) ? response.data.length : 0);
      } catch (error) {
        console.error('Failed to fetch cart count', error.response?.data || error.message || error);
      }
    };

    fetchCartItems();
    const interval = setInterval(fetchCartItems, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    delete axios.defaults.headers.common['Authorization'];
    navigate('/');
  };

  return (
    <nav className="navbar">
      <div style={{display:'flex', alignItems:'center', gap:24}}>
        <div className="navbar-brand" onClick={() => navigate('/home')}>
          Bright Buy
        </div>
        <div className="nav-links">
          <Link to="/home" className="nav-link">Home</Link>
          <Link to="/products" className="nav-link">Our Products</Link>
        </div>
      </div>
      <div className="navbar-icons">
        <div className="navbar-icon cart-icon" onClick={() => navigate('/cart')}>
          <img src={cartIcon} alt="Cart" width="24" height="24" />
          {cartItemCount > 0 && <span className="cart-badge">{cartItemCount}</span>}
        </div>
        <div className="navbar-icon user-icon" onClick={() => setDropdownVisible(!dropdownVisible)}>
          <img src={userIcon} alt="User Profile" width="24" height="24" />
          {dropdownVisible && (
            <div className="dropdown-menu">
              <Link to="/profile" onClick={() => setDropdownVisible(false)}>My Profile</Link>
              <Link to="/orders" onClick={() => setDropdownVisible(false)}>My Orders</Link>
              <Link to="/" onClick={handleLogout}>Logout</Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
