import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';

const Profile = () => {
  const { user } = useContext(AuthContext);
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    if (user) {
      axios.get('http://localhost:5000/api/orders', {
        headers: { Authorization: `Bearer ${user.token}` }
      }).then(res => setOrders(res.data));
    }
  }, [user]);

  if (!user) return <p>Please login.</p>;

  return (
    <div>
      <h1>Profile - Order History</h1>
      {orders.map(order => (
        <div key={order.order_id}>
          <p>Order #{order.order_id} - Status: {order.status} - Total: ${order.total_amount}</p>
        </div>
      ))}
    </div>
  );
};

export default Profile;