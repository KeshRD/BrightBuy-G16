import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const DriverDashboard = () => {
  const [deliveries, setDeliveries] = useState([]);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchDeliveries = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await axios.get(`${API_URL}/api/driver/deliveries`, { headers });
        setDeliveries(res.data || []);
      } catch (err) {
        console.error('Failed to fetch deliveries', err.response || err.message || err);
        setError(err.response?.data?.error || 'Failed to load deliveries');
      }
    };
    fetchDeliveries();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/');
  };

  if (error) return <div>{error}</div>;

  return (
    <div style={{ position: 'relative', padding: '20px' }}>
      <button
        onClick={handleLogout}
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          padding: '8px 16px',
          backgroundColor: '#f44336',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        Logout
      </button>

      <h2 style={{ marginTop: 0 }}>Delivery Portal</h2>

      {deliveries.length === 0 ? (
        <p>No delivery entries found.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
          <thead>
            <tr style={{ backgroundColor: '#f4f4f4' }}>
              <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Order ID</th>
              <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Date of Arrival</th>
              <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Items Ordered and Price</th>
              <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Total Price</th>
              <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Mode of Payment</th>
              <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Delivery Address</th>
              <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Customer Name</th>
            </tr>
          </thead>
          <tbody>
            {deliveries.map((d) => (
              <tr key={d.delivery_id}>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{d.order_id}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                  {d.arrival_date ? new Date(d.arrival_date).toLocaleString() : 'N/A'}
                </td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                  {Array.isArray(d.items) && d.items.length > 0 ? (
                    <ul style={{ margin: 0, paddingLeft: '20px' }}>
                      {d.items.map((it, idx) => (
                        <li key={idx}>
                          {it.product_name} - {it.variant_name} x{it.quantity} @ ${it.price}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    'No items listed'
                  )}
                </td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>${d.total_price.toFixed(2)}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{d.payment_method || 'N/A'}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{d.delivery_address || 'N/A'}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{d.customer_name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default DriverDashboard;
