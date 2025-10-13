import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './orderconfirmation.css';

const OrderConfirmation = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { orderDetails } = location.state || {};

    if (!orderDetails) {
        return (
            <div className="App-header">
                <h2>No Order Details Found</h2>
                <p>Something went wrong. Please check your order history.</p>
                <button onClick={() => navigate('/home')}>Go to Home</button>
            </div>
        );
    }

    return (
        <div className="App-header">
            <div className="confirmation-container">
                <h2>Thank You For Your Order!</h2>
                <p>Your order has been placed successfully.</p>
                
                <div className="order-summary-final">
                    <h3>Order Summary</h3>
                    <p><strong>Order ID:</strong> {orderDetails.order_id}</p>
                    <p><strong>Order Date:</strong> {new Date(orderDetails.order_date).toLocaleDateString()}</p>
                    {/* Display Shipping Address */}
                    <p><strong>Shipping To:</strong> {orderDetails.shipping_address}</p>
                    <p><strong>Total Amount:</strong> ${parseFloat(orderDetails.total_amount).toFixed(2)}</p>
                    
                    <h4>Items Ordered:</h4>
                    <ul>
                        {orderDetails.items.map(item => (
                            <li key={item.variant_id}>
                                {item.product_name} ({item.variant_name}) - Qty: {item.quantity}
                            </li>
                        ))}
                    </ul>
                </div>
                
                <button onClick={() => navigate('/home')}>Continue Shopping</button>
            </div>
        </div>
    );
};

export default OrderConfirmation;

