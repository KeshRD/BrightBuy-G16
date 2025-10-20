import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './payment.css';

// REMOVED: The hardcoded array is no longer needed.
// const MAIN_CITIES = ['Houston', 'San Antonio', 'Dallas', 'Austin', 'Fort Worth'];

const PaymentPage = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { items, total } = location.state || { items: [], total: 0 };

    const [shippingDetails, setShippingDetails] = useState({
        fullName: '',
        address: '',
        city: '',
        postalCode: ''
    });

    const [cardDetails, setCardDetails] = useState({
        number: '',
        expiry: '',
        cvc: '',
        name: ''
    });
    
    const [deliveryMethod, setDeliveryMethod] = useState('Standard');
    const [paymentMethod, setPaymentMethod] = useState('Card Payment');
    const [estimatedDeliveryDate, setEstimatedDeliveryDate] = useState(null);
    const [mainCities, setMainCities] = useState([]); // State to hold cities from DB

    const [error, setError] = useState('');
    const [processing, setProcessing] = useState(false);

    // New effect to fetch cities from the database when the component loads
    useEffect(() => {
        const fetchCities = async () => {
            try {
                const response = await axios.get('http://localhost:5000/cities');
                setMainCities(response.data);
            } catch (err) {
                console.error("Failed to fetch main cities:", err);
                // Fallback in case the API fails, though not ideal
                setError("Could not load delivery city data.");
            }
        };
        fetchCities();
    }, []); // Empty dependency array ensures this runs only once on mount

    // Effect to calculate estimated delivery date
    useEffect(() => {
        if (deliveryMethod === 'Store Pickup') {
            setEstimatedDeliveryDate(null);
            return;
        }

        // Now uses the dynamic 'mainCities' state
        if (shippingDetails.city && items.length > 0 && mainCities.length > 0) {
            const calculateDeliveryDate = () => {
                let deliveryDays = 0;
                const isMainCity = mainCities.map(c => c.toLowerCase()).includes(shippingDetails.city.toLowerCase());
                
                const isOutOfStock = items.some(item => item.stock_quantity === 0);

                if (isMainCity) {
                    deliveryDays = 5;
                } else {
                    deliveryDays = 7;
                }

                if (isOutOfStock) {
                    deliveryDays += 3;
                }
                
                if (deliveryMethod === 'Express') {
                    deliveryDays = Math.max(1, deliveryDays - 2);
                }

                const date = new Date();
                date.setDate(date.getDate() + deliveryDays);
                setEstimatedDeliveryDate(date.toISOString());
            };
            calculateDeliveryDate();
        } else {
            setEstimatedDeliveryDate(null);
        }
    }, [shippingDetails.city, deliveryMethod, items, mainCities]);

    const handleInputChange = (e, setter) => {
        const { name, value } = e.target;
        setter(prev => ({ ...prev, [name]: value }));
    };

    const handlePaymentSubmit = async (e) => {
        e.preventDefault();
        if (deliveryMethod !== 'Store Pickup' && (!shippingDetails.fullName || !shippingDetails.address || !shippingDetails.city || !shippingDetails.postalCode)) {
            setError('Please fill in all shipping details for delivery.');
            return;
        }
        if (paymentMethod === 'Card Payment' && (!cardDetails.number || !cardDetails.expiry || !cardDetails.cvc || !cardDetails.name)) {
            setError('Please fill in all card details for card payment.');
            return;
        }
        setProcessing(true);
        setError('');

        try {
            console.log("Simulating payment processing...");
            await new Promise(resolve => setTimeout(resolve, 1500));

            // The 'cardDetails' object was missing from this request payload
            const orderResponse = await axios.post('http://localhost:5000/create-order', {
                items,
                total,
                shippingAddress: deliveryMethod !== 'Store Pickup' ? shippingDetails : { address: 'Store Pickup' },
                deliveryMethod,
                paymentMethod,
                estimatedDeliveryDate,
                cardDetails // Correctly added cardDetails to the request
            });

            if (orderResponse.data.success) {
                // Corrected: The route in App.js is '/orderConfirm'
                navigate('/orderConfirm', { state: { orderDetails: orderResponse.data.order } });
            } else {
                setError(orderResponse.data.message || 'Failed to create order. Please try again.');
            }

        } catch (err) {
            console.error('Payment or order creation error:', err);
            setError(err.response?.data?.message || 'An error occurred during payment. Please try again.');
        } finally {
            setProcessing(false);
        }
    };

    if (items.length === 0) {
        return (
            <div className="App-header">
                <h2>Payment Details</h2>
                <p>You have no items selected for payment.</p>
                <button onClick={() => navigate('/cart')}>Back to Cart</button>
            </div>
        );
    }

    return (
        <div className="App-header">
            <h2>Complete Your Order</h2>
            <div className="payment-page-layout">
                <div className="order-summary-payment">
                    <h3>Order Summary</h3>
                    {items.map(item => (
                        <div key={item.cart_item_id} className="summary-item">
                            
                            <img
                                src={`http://localhost:5000${item.image}`}
                                alt={item.product_name}
                                className="summary-item-image"
                            />
                            <div className='summary-item-details'>
                                <span>{item.product_name} (x{item.quantity})</span>
                                <span>${(item.quantity * parseFloat(item.price)).toFixed(2)}</span>
                            </div>
                        </div>
                    ))}
                    <hr />
                    <div className="summary-total">
                        <strong>Total</strong>
                        <strong>${parseFloat(total).toFixed(2)}</strong>
                    </div>
      
                     {deliveryMethod !== 'Store Pickup' && estimatedDeliveryDate && (
                        <p className="delivery-estimate">Estimated Delivery: {new Date(estimatedDeliveryDate).toLocaleDateString()}</p>
                    )}
                </div>

                <div className="forms-column">
                    <form className="shipping-form" onSubmit={handlePaymentSubmit}>
                        
                        <h3>Delivery Method</h3>
                        <div className="form-options">
                            <label><input type="radio" value="Standard" checked={deliveryMethod === 'Standard'} onChange={(e) => setDeliveryMethod(e.target.value)} /> Standard</label>
                            <label><input type="radio" value="Store Pickup" checked={deliveryMethod === 'Store Pickup'} onChange={(e) => setDeliveryMethod(e.target.value)} /> Store Pickup</label>
                        </div>

                        {deliveryMethod !== 'Store Pickup' && (
                            <>
                                <h3>Shipping Address</h3>
                                <input type="text" name="fullName" placeholder="Full Name" value={shippingDetails.fullName} onChange={(e) => handleInputChange(e, setShippingDetails)} required />
                                <input type="text" name="address" placeholder="Address Line" value={shippingDetails.address} onChange={(e) => handleInputChange(e, setShippingDetails)} required />
                                <input type="text" name="city" placeholder="City" value={shippingDetails.city} onChange={(e) => handleInputChange(e, setShippingDetails)} required />
                                <input type="text" name="postalCode" placeholder="Postal Code" value={shippingDetails.postalCode} onChange={(e) => handleInputChange(e, setShippingDetails)} required />
                            </>
                        )}
                        
                        <h3>Payment Method</h3>
                        <div className="form-options">
                            <label><input type="radio" value="Card Payment" checked={paymentMethod === 'Card Payment'} onChange={(e) => setPaymentMethod(e.target.value)} /> Card Payment</label>
                            <label><input type="radio" value="Cash on Delivery" checked={paymentMethod === 'Cash on Delivery'} onChange={(e) => setPaymentMethod(e.target.value)} /> Cash on Delivery</label>
                        </div>

                        {paymentMethod === 'Card Payment' && (
                            <div className="payment-details-section">
                                <h3>Payment Details</h3>
                                <div className="form-group"><label>Card Number</label><input type="text" name="number" value={cardDetails.number} onChange={(e) => handleInputChange(e, setCardDetails)} /></div>
                                <div className="form-group"><label>Expiry Date</label><input type="text" name="expiry" placeholder="MM/YY" value={cardDetails.expiry} onChange={(e) => handleInputChange(e, setCardDetails)} /></div>
                                <div className="form-group"><label>Security Code (CVC)</label><input type="text" name="cvc" value={cardDetails.cvc} onChange={(e) => handleInputChange(e, setCardDetails)} /></div>
                                <div className="form-group"><label>Name on Card</label><input type="text" name="name" value={cardDetails.name} onChange={(e) => handleInputChange(e, setCardDetails)} /></div>
                            </div>
                        )}
                        
                        <div className="payment-button-group">
                            <button type="button" className="cancel-btn" onClick={() => navigate('/cart')}>Cancel</button>
                            <button type="submit" className="pay-btn" disabled={processing}>
                                {processing ? 'Processing...' : 'Place Order'}
                            </button>
                        </div>
                    </form>
                    {error && <p className="error full-width-error">{error}</p>}
                </div>
            </div>
        </div>
    );
};

export default PaymentPage;



