// src/components/UpcomingDeliveries.js
import React, { useEffect, useState } from "react";
const UpcomingDeliveries = () => {
  const [orders, setOrders] = useState([]);
  useEffect(() => {
    fetch("http://localhost:5000/api/orders/upcoming")
      .then((res) => res.json())
      .then((data) => setOrders(data))
      .catch((err) => console.error("Error fetching upcoming orders:", err));
  }, []);
  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h2 className="text-2xl font-bold mb-4 text-gray-800 text-center">
        🚚 Upcoming Deliveries
      </h2>
      {orders.length === 0 ? (
        <p className="text-gray-600 text-center">No upcoming orders found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200 rounded-xl shadow">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                <th className="py-2 px-4 text-left">Order ID</th>
                <th className="py-2 px-4 text-left">Customer</th>
                <th className="py-2 px-4 text-left">Status</th>
                <th className="py-2 px-4 text-left">Mode of Delivery</th>
                <th className="py-2 px-4 text-left">Payment Method</th>
                <th className="py-2 px-4 text-left">Delivery Address</th>
                <th className="py-2 px-4 text-left">Estimated Delivery</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr
                  key={order.order_id}
                  className="border-t hover:bg-gray-50 transition-colors"
                >
                  <td className="py-2 px-4">{order.order_id}</td>
                  <td className="py-2 px-4">{order.customer_name}</td>
                  <td
                    className={`py-2 px-4 font-semibold ${
                      order.order_status === "Pending"
                        ? "text-yellow-600"
                        : order.order_status === "Confirmed"
                        ? "text-blue-600"
                        : "text-green-600"
                    }`}
                  >
                    {order.order_status}
                  </td>
                  <td className="py-2 px-4">{order.mode_of_delivery}</td>
                  <td className="py-2 px-4">{order.payment_method}</td>
                  <td className="py-2 px-4">{order.delivery_address}</td>
                  <td className="py-2 px-4">
                    {new Date(order.estimated_delivery_date).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
export default UpcomingDeliveries;
