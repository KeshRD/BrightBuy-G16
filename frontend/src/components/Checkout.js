import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useLocation } from 'react-router-dom'; 
import './checkout.css';


const Checkout = () => {
    const [cartItems, setCartItems] = useState([]);
    const [selectedItems, setSelectedItems] = useState(new Set());
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
      
        const buyNowItem = location.state?.buyNowItem;

        if (buyNowItem) {
        
            setCartItems([buyNowItem]);
  
            setSelectedItems(new Set([buyNowItem.cart_item_id]));
        } else {

            if (!localStorage.getItem('token')) {
                navigate('/');
                return;
            }

            const fetchCart = async () => {
                try {
                    const response = await axios.get('http://localhost:5000/cart');
                    setCartItems(response.data);
              
                    setSelectedItems(new Set(response.data.map(item => item.cart_item_id)));
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
            fetchCart();
        }
    }, [navigate, location.state]); 

    const handleSelectItem = (itemId) => {
        const newSelectedItems = new Set(selectedItems);
        if (newSelectedItems.has(itemId)) {
            newSelectedItems.delete(itemId);
        } else {
            newSelectedItems.add(itemId);
        }
        setSelectedItems(newSelectedItems);
    };
    

    const selectedCartItems = cartItems.filter(item => selectedItems.has(item.cart_item_id));

    const subtotal = selectedCartItems.reduce((sum, item) => {
        const price = parseFloat(item.price);
        return isNaN(price) ? sum : sum + item.quantity * price;
    }, 0);

    const tax = subtotal * 0.10; 
    const total = subtotal + tax;

    const handlePlaceOrder = () => {
        if (selectedCartItems.length === 0) {
            alert("Please select at least one item to checkout.");
            return;
        }
     
        navigate('/payment', { 
            state: { 
                items: selectedCartItems, 
                total: total 
            } 
        });
    };

    return (
        <div className="App-header">
            <button onClick={() => navigate('/cart')}>Back to Cart</button>
            <h2>Checkout</h2>
            {error && <p className="error">{error}</p>}
            <div className="checkout-page">
                <div className="products-section">
                    <h3>Your Items</h3>
                    {cartItems.length > 0 ? (
                        cartItems.map((item) => (
                            <div key={item.cart_item_id} className="checkout-item">
                                <input
                                    type="checkbox"
                                    checked={selectedItems.has(item.cart_item_id)}
                                    onChange={() => handleSelectItem(item.cart_item_id)}
                                />
                                <img
              src={`http://localhost:5000${item.image}`}
              alt={item.product_name}
              className="product-card-image"
            />
                                <div className="item-details">
                                    <h4>{item.product_name} - {item.variant_name}</h4>
                                    <p>Qty: {item.quantity}</p>
                                </div>
                                <p>${(item.quantity * parseFloat(item.price)).toFixed(2)}</p>
                            </div>
                        ))
                    ) : (
                        <p>Your cart is empty.</p>
                    )}
                </div>

                <div className="order-summary-section">
                    <h3>Order Summary</h3>
                    <div className="summary-line">
                        <span>Subtotal</span>
                        <span>${subtotal.toFixed(2)}</span>
                    </div>
                    <div className="summary-line">
                        <span>Tax (10%)</span>
                        <span>${tax.toFixed(2)}</span>
                    </div>
                    <hr />
                    <div className="summary-line">
                        <strong>Total</strong>
                        <strong>${total.toFixed(2)}</strong>
                    </div>
                    
                    <button className="place-order-btn" onClick={handlePlaceOrder}>Place Order</button>
                </div>
            </div>
        </div>
    );
};

export default Checkout;

