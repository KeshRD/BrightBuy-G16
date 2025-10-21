import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const DriverDashboard = () => {
  const [deliveries, setDeliveries] = useState([]);
  const [error, setError] = useState('');
  const [activeDropdownId, setActiveDropdownId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profile, setProfile] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all' or 'mine'
  const navigate = useNavigate();

  const currentUser = (() => {
    try { return JSON.parse(localStorage.getItem('user')); } catch (e) { return null; }
  })();
  const myDriverId = currentUser?.user_id || null;

  const refreshDeliveries = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.get(`${API_URL}/api/driver/deliveries`, { headers });
      // Keep the original payload but also log it so we can see what the backend returned
      console.log('Driver deliveries fetched:', res.data);
      setDeliveries(res.data || []);
    } catch (err) {
      console.error('Failed to fetch deliveries', err.response || err.message || err);
      setError(err.response?.data?.error || 'Failed to load deliveries');
    }
  };

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.get(`${API_URL}/api/driver/profile`, { headers });
      setProfile(res.data);
    } catch (err) {
      console.error('Failed to fetch profile', err.response || err.message || err);
      // Optionally set error, but since it's profile, maybe not critical
    }
  };

  useEffect(() => {
    refreshDeliveries();
    fetchProfile();
  }, []);

  // Order: Pending (0), Confirmed (1), Shipped (2), Delivered (3), Others (4)
  const getStatus = (d) => (d.status && d.status !== 'Unknown' ? d.status : 'Pending');
  const statusOrder = (s) => (s === 'Pending' ? 0 : s === 'Confirmed' ? 1 : s === 'Shipped' ? 2 : s === 'Delivered' ? 3 : 4);
  const filteredDeliveries = filter === 'mine' ? deliveries.filter(d => d.driver_id && myDriverId && d.driver_id === myDriverId) : deliveries;
  const sortedDeliveries = [...filteredDeliveries].sort((a, b) => statusOrder(getStatus(a)) - statusOrder(getStatus(b)));

  const handleClaim = async (delivery) => {
    if (!window.confirm('Are you sure you want to claim this delivery?')) return;
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.post(`${API_URL}/api/driver/deliveries/${delivery.delivery_id}/claim`, {}, { headers });
      setDeliveries(prev => prev.map(x => x.delivery_id === delivery.delivery_id ? { ...x, ...res.data } : x));
    } catch (err) {
      console.error('Claim failed', err.response || err.message || err);
      alert(err.response?.data?.error || 'Failed to claim delivery');
      // In case another driver already claimed or status changed, refresh the list
      refreshDeliveries();
    }
  };

  const handleTransitClick = (delivery) => {
    if (delivery.driver_id && myDriverId && delivery.driver_id === myDriverId && (delivery.status === 'Confirmed' || delivery.status === 'Shipped')) {
      handleStatusUpdate(delivery);
    }
  };

  const markPaymentPaid = async (delivery) => {
    if (!window.confirm('Are you sure you want to mark payment as Paid?')) return;
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.patch(`${API_URL}/api/driver/deliveries/${delivery.delivery_id}/payment-status`, {}, { headers });
      setDeliveries(prev => prev.map(x => x.delivery_id === delivery.delivery_id ? { ...x, ...res.data } : x));
    } catch (err) {
      console.error('Payment update failed', err.response || err.message || err);
      alert(err.response?.data?.error || 'Failed to mark payment as Paid');
    }
  };

  const handleStatusUpdate = async (delivery) => {
  const currentStatus = delivery.status;
  let nextStatus;
  let confirmMessage;

  if (currentStatus === 'Confirmed') {
    nextStatus = 'Shipped';
    confirmMessage = 'Are you sure you want to mark this order as Shipped?';
  } else if (currentStatus === 'Shipped') {
    nextStatus = 'Delivered';
    confirmMessage = 'Are you sure you want to mark this order as Delivered?';
  } else {
    return;
  }

  if (!window.confirm(confirmMessage)) return;

  try {
    const token = localStorage.getItem('token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await axios.patch(
      `${API_URL}/api/driver/deliveries/${delivery.delivery_id}/status`,
      {},
      { headers }
    );
    
    alert(res.data.message); // ✅ moved here
    setDeliveries(prev =>
      prev.map(x =>
        x.delivery_id === delivery.delivery_id ? { ...x, ...res.data } : x
      )
    );
  } catch (err) {
    console.error('Status update failed', err.response || err.message || err);
    alert(err.response?.data?.error || 'Failed to update status');
  }
};


  // Removed handleStatusChange as it's replaced by handleStatusUpdate

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/');
  };

  if (error) return <div>{error}</div>;

  return (
    <div style={{ position: 'relative', padding: '20px', fontFamily: 'Brandon Grotesque, sans-serif' }}>
      {/* Profile Icon */}
      <div
        onClick={() => setSidebarOpen(true)}
        style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          cursor: 'pointer',
          fontSize: '24px',
          color: '#000'
        }}
        title="Profile"
      >
        👤
      </div>

      {/* Sidebar */}
      {sidebarOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '300px',
            height: '100%',
            backgroundColor: '#fff',
            boxShadow: '2px 0 5px rgba(0,0,0,0.1)',
            zIndex: 1000,
            padding: '20px',
            overflowY: 'auto'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3>My Profile</h3>
            <button
              onClick={() => setSidebarOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '20px',
                cursor: 'pointer'
              }}
            >
              ×
            </button>
          </div>
          {profile ? (
            <div style={{ textAlign: 'left' }}>
              <p><strong>Name:</strong> {profile.name}</p>
              <p><strong>Email:</strong> {profile.email}</p>
              <p><strong>Driver ID:</strong> {profile.user_id}</p>
            </div>
          ) : (
            <p style={{ textAlign: 'left' }}>Loading profile...</p>
          )}
        </div>
      )}

      {/* Overlay to close sidebar */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 999
          }}
        />
      )}

      <button
        onClick={handleLogout}
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          padding: '8px 16px',
          backgroundColor: '#ccc',
          color: '#000',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontWeight: 'bold',
          fontSize: 'calc(1rem + 3pt)'
        }}
      >
        Logout
      </button>

      <h2 style={{ marginTop: 0, fontSize: '2em', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        Delivery Portal
      </h2>
      <div style={{ marginBottom: '12px' }}>
        <label style={{ marginRight: '10px' }}>Filter:</label>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ padding: '4px 8px' }}>
          <option value="all">All Orders</option>
          <option value="mine">My Orders</option>
        </select>
      </div>
      <hr style={{ border: 'none', borderTop: '8px solid #ccc', margin: '8px 0 12px' }} />

      {filteredDeliveries.length === 0 ? (
        <p>No delivery entries found.</p>
      ) : (
        (() => {
          // Group deliveries by status
          const grouped = sortedDeliveries.reduce((acc, d) => {
            const status = getStatus(d);
            if (!acc[status]) acc[status] = [];
            acc[status].push(d);
            return acc;
          }, {});

          return Object.keys(grouped).sort((a, b) => statusOrder(a) - statusOrder(b)).map(status => (
            <div key={status} style={{ marginBottom: '40px' }}>
              <h3 style={{ marginBottom: '10px', fontSize: '1.4em', color: '#333' }}>
                {status === 'Pending' ? 'Pending Orders' :
                 status === 'Confirmed' ? 'Confirmed Orders' :
                 status === 'Shipped' ? 'Shipped Orders' :
                 status === 'Delivered' ? 'Delivered Orders' : 'Other Orders'}
              </h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f4f4f4' }}>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Order ID</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Date of Arrival</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Items Ordered and Price</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Total Price</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Mode of Payment</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Payment Status</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Delivery Address</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Customer Name</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Order Status</th>
                  </tr>
                </thead>
                <tbody>
                  {grouped[status].map(d => (
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
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                        {(() => {
                          const isMine = d.driver_id && myDriverId && d.driver_id === myDriverId;
                          const paymentStatus = d.payment_status && d.payment_status !== 'Unknown' ? d.payment_status : (d.payment_method === 'Card Payment' ? 'Paid' : 'Pending');
                          const orderStatus = d.status && d.status !== 'Unknown' ? d.status : 'Pending';
                          if (orderStatus === 'Delivered' && paymentStatus === 'Pending') {
                            if (isMine) {
                              return (
                                <span
                                  onClick={() => markPaymentPaid(d)}
                                  style={{
                                    cursor: 'pointer',
                                    textDecoration: 'underline',
                                    backgroundColor: '#2196f3',
                                    color: '#fff',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    display: 'inline-block'
                                  }}
                                  title="Mark payment as Paid"
                                >
                                  Pending
                                </span>
                              );
                            }
                            return (
                              <span
                                onClick={() => alert("You can't change this.")}
                                style={{
                                  cursor: 'pointer',
                                  textDecoration: 'underline',
                                  backgroundColor: '#9e9e9e',
                                  color: '#fff',
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  display: 'inline-block'
                                }}
                                title="You can't change this"
                              >
                                Pending
                              </span>
                            );
                          }
                          return (
                            <span
                              style={{
                                backgroundColor: paymentStatus === 'Paid' ? '#4caf50' : '#ff9800',
                                color: '#fff',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                display: 'inline-block'
                              }}
                            >
                              {paymentStatus}
                            </span>
                          );
                        })()}
                      </td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{d.delivery_address || 'N/A'}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{d.customer_name}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                        {(() => {
                          const status = d.status && d.status !== 'Unknown' ? d.status : 'Pending';
                          const assigned = !!d.driver_id;
                          const isMine = assigned && myDriverId && d.driver_id === myDriverId;

                          if (status === 'Pending') {
                            return (
                              <>
                                {!assigned ? (
                                  <button
                                    onClick={() => handleClaim(d)}
                                    style={{
                                      padding: '4px 8px',
                                      backgroundColor: '#ff9800',
                                      color: '#fff',
                                      border: 'none',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      fontWeight: 600
                                    }}
                                    title="Click to claim this delivery"
                                  >
                                    Pending
                                  </button>
                                ) : (
                                  <span
                                    style={{
                                      fontWeight: 600,
                                      backgroundColor: '#ff9800',
                                      color: '#fff',
                                      padding: '4px 8px',
                                      borderRadius: '4px',
                                      display: 'inline-block'
                                    }}
                                  >
                                    Pending
                                  </span>
                                )}
                                {assigned && (
                                  <div style={{ marginTop: '6px', fontSize: '0.85em', color: '#555' }}>
                                    Driver: {d.driver_id} - {d.driver_name}
                                  </div>
                                )}
                              </>
                            );
                          }

                          if (status === 'Confirmed' || status === 'Shipped') {
                            return (
                              <>
                                <span
                                  onClick={() => isMine ? handleStatusUpdate(d) : alert("You can't change this.")}
                                  style={{
                                    cursor: 'pointer',
                                    textDecoration: 'underline',
                                    fontWeight: 600,
                                    backgroundColor: '#2196f3',
                                    color: '#fff',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    display: 'inline-block'
                                  }}
                                  title={isMine ? 'Click to update status' : "You can't change this"}
                                >
                                  {status}
                                </span>
                                {assigned && (
                                  <div style={{ marginTop: '6px', fontSize: '0.85em', color: '#555' }}>
                                    Driver: {d.driver_id} - {d.driver_name}
                                  </div>
                                )}
                              </>
                            );
                          }

                          return (
                            <>
                              <span
                                style={{
                                  fontWeight: 600,
                                  backgroundColor: status === 'Delivered' ? '#4caf50' : '#f44336',
                                  color: '#fff',
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  display: 'inline-block'
                                }}
                              >
                                {status}
                              </span>
                              {assigned && (
                                <div style={{ marginTop: '6px', fontSize: '0.85em', color: '#555' }}>
                                  Driver: {d.driver_id} - {d.driver_name}
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ));
        })()
      )}
    </div>
  );
};

export default DriverDashboard;
