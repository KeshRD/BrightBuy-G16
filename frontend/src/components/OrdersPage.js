import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Navbar from './Navbar';
import './orderspage.css'; // Import the new CSS file

const OrdersPage = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        if (!localStorage.getItem('token')) {
            navigate('/');
            return;
        }

        const fetchOrders = async () => {
            try {
                // Assume your backend has an endpoint at '/orders' to get user-specific orders
                const response = await axios.get('http://localhost:5000/orders');
                setOrders(response.data);
            } catch (err) {
                console.error('Failed to fetch orders:', err);
                 if (err.response && (err.response.status === 401 || err.response.status === 403)) {
                    // Handle unauthorized access
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    navigate('/');
                } else {
                    setError('Could not retrieve your orders. Please try again later.');
                }
            } finally {
                setLoading(false);
            }
        };

        fetchOrders();
    }, [navigate]);

    const getStatusClassName = (status) => {
        return status ? status.toLowerCase().replace(' ', '-') : '';
    };

    return (
        <>
            <Navbar />
            <div className="App-header" style={{ paddingTop: '80px' }}>
                <h2>My Orders</h2>
                
                {loading && <p>Loading your orders...</p>}
                {error && <p className="error">{error}</p>}

                {!loading && !error && (
                    orders.length === 0 ? (
                        <div>
                            <p>You have not placed any orders yet.</p>
                            <button onClick={() => navigate('/home')}>Start Shopping</button>
                        </div>
                    ) : (
                        <div className="orders-list">
                            {orders.map(order => (
                                <div key={order.order_id} className="order-card">
                                    <div className="order-header">
                                        <div>
                                            <h4>Order ID: #{order.order_id}</h4>
                                            <p>Date: {new Date(order.order_date).toLocaleDateString()}</p>
                                        </div>
                                        <div className="order-status-total">
                                            <span className={`order-status ${getStatusClassName(order.order_status)}`}>
                                                {order.order_status}
                                            </span>
                                            <h4>Total: ${parseFloat(order.total_amount).toFixed(2)}</h4>
                                        </div>
                                    </div>
                                    <div className="order-items">
                                        <h5>Items:</h5>
                                        <ul>
                                            {order.items && order.items.map(item => (
                                                <li key={item.variant_id}>
                                                    {item.product_name} ({item.variant_name}) - Qty: {item.quantity}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                )}

                 <button 
                    onClick={() => navigate('/home')} 
                    style={{ marginTop: '30px' }}
                >
                    Back to Homepage
                </button>
            </div>
        </>
    );
};

export default OrdersPage;