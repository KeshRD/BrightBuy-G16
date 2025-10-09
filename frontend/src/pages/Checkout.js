import React, { useState, useContext, useEffect } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { CartContext } from '../context/CartContext';

const Checkout = () => {
  const { user } = useContext(AuthContext);
  const { cart, clearCart } = useContext(CartContext);
  const [addresses, setAddresses] = useState([]);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [deliveryMode, setDeliveryMode] = useState('standard_delivery');
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [newAddress, setNewAddress] = useState({ street: '', city: '', state: 'TX', postal_code: '' });

  useEffect(() => {
    if (user) {
      axios.get('http://localhost:5000/api/orders/addresses', {
        headers: { Authorization: `Bearer ${user.token}` }
      }).then(res => setAddresses(res.data));
    }
  }, [user]);

  const addAddress = async () => {
    const res = await axios.post('http://localhost:5000/api/orders/addresses', newAddress, {
      headers: { Authorization: `Bearer ${user.token}` }
    });
    setAddresses([...addresses, { address_id: res.data.address_id, ...newAddress }]);
  };

  const placeOrder = async () => {
    if (!selectedAddress) return alert('Select address');
    try {
      await axios.post('http://localhost:5000/api/orders', {
        address_id: selectedAddress,
        delivery_mode: deliveryMode,
        payment_method: paymentMethod,
        items: cart.map(item => ({ variant_id: item.variant_id, quantity: item.quantity }))
      }, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      clearCart();
      alert('Order placed!');
    } catch (err) {
      alert(err.response.data.error);
    }
  };

  if (!user) return <p>Please login to checkout.</p>;

  return (
    <div>
      <h1>Checkout</h1>
      {/* Address form and list */}
      <h2>Addresses</h2>
      {addresses.map(addr => (
        <div key={addr.address_id}>
          <p>{addr.street}, {addr.city}</p>
          <button onClick={() => setSelectedAddress(addr.address_id)}>Select</button>
        </div>
      ))}
      <h3>Add New Address</h3>
      <input placeholder="Street" onChange={e => setNewAddress({ ...newAddress, street: e.target.value })} />
      <input placeholder="City" onChange={e => setNewAddress({ ...newAddress, city: e.target.value })} />
      <input placeholder="Postal Code" onChange={e => setNewAddress({ ...newAddress, postal_code: e.target.value })} />
      <button onClick={addAddress}>Add</button>

      <h2>Delivery Mode</h2>
      <select onChange={e => setDeliveryMode(e.target.value)}>
        <option value="store_pickup">Store Pickup</option>
        <option value="standard_delivery">Standard Delivery</option>
      </select>

      <h2>Payment Method</h2>
      <select onChange={e => setPaymentMethod(e.target.value)}>
        <option value="cod">Cash on Delivery</option>
        <option value="card">Card</option>
      </select>

      <button onClick={placeOrder}>Place Order</button>
    </div>
  );
};

export default Checkout;