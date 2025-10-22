// src/App.js
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import AuthPage from './components/AuthPage';
import HomePage from './components/HomePage';
import ProductDetail from './components/ProductDetail';
import CartPage from './components/CartPage';
import Checkout from './components/Checkout';
import OrderConfirmation from './components/OrderConfirmation';
import PaymentPage from './components/PaymentPage'; 
import OrdersPage from './components/OrdersPage';
import AdminPage from './components/AdminPage';
import DriverDashboard from './components/DriverDashboard';
import AddProductPage from './components/AddProductPage';
import './App.css';
import './components/navbar.css'; 
import ProfilePage from "./components/ProfilePage";


function App() {
  return (
    <div className="App">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/products" element={<HomePage showProductsOnly={true} />} />
        <Route path="/product/:productId" element={<ProductDetail />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/payment" element={<PaymentPage />} />
        <Route path="/orderConfirm" element={<OrderConfirmation />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/driver" element={<DriverDashboard />} />
        <Route path="/admin/products/new" element={<AddProductPage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Routes>
    </div>
  );
}

export default App;