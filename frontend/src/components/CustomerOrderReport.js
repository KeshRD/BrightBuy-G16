import React, { useState } from "react";
const CustomerOrderReport = () => {
  const [userInput, setUserInput] = useState("");
  const [filterType, setFilterType] = useState("name"); // "name" or "id"
  const [paymentFilter, setPaymentFilter] = useState("All");
  const [orders, setOrders] = useState([]);
  const [customerName, setCustomerName] = useState("");
  const [loading, setLoading] = useState(false);
  const fetchOrders = async () => {
  if (!userInput.trim()) {
    alert("Please enter a customer name or ID");
    return;
  }
  setLoading(true);
  setOrders([]);
  setCustomerName("");
  try {
    const params = new URLSearchParams();
    if (filterType === "id") params.append("user_id", userInput);
    else params.append("name", userInput);
    if (paymentFilter !== "All") params.append("payment_status", paymentFilter);
    const res = await fetch(
      `http://localhost:5000/api/reports/customer-orders?${params.toString()}`
    );
    let data;
    try {
      data = await res.json(); // Might fail if server sends non-JSON
    } catch {
      console.error("Invalid JSON response from backend");
      alert("Invalid response from server");
      setOrders([]);
      return;
    }
    // Handle backend error response
    if (!res.ok) {
      console.error("Server error:", data.error || "Unknown error");
      alert(data.error || "Server error while fetching orders");
      setOrders([]);
      return;
    }
    // Data must be an array
    if (!Array.isArray(data)) {
      console.error("Unexpected response:", data);
      alert("Unexpected response format from server");
      setOrders([]);
      return;
    }
    // ✅ All good
    setOrders(data);
    if (data.length > 0) setCustomerName(data[0].customer_name);
  } catch (err) {
    console.error("Error fetching customer orders:", err);
    alert("Network or server error while fetching orders");
    setOrders([]);
  } finally {
    setLoading(false);
  }
};

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h2 className="text-2xl font-bold mb-6 text-gray-800 text-center">
        🧾 Customer Order Summary & Payment Report
      </h2>
      {/* Input Section */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="border rounded-lg px-3 py-2 shadow-sm focus:ring-2 focus:ring-blue-400"
        >
          <option value="name">Search by Name</option>
          <option value="id">Search by User ID</option>
        </select>
        <input
          type={filterType === "id" ? "number" : "text"}
          placeholder={`Enter ${filterType === "id" ? "User ID" : "Customer Name"}`}
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          className="border rounded-lg px-4 py-2 w-full sm:w-1/3 shadow-sm focus:ring-2 focus:ring-blue-400"
        />
        <select
          value={paymentFilter}
          onChange={(e) => setPaymentFilter(e.target.value)}
          className="border rounded-lg px-3 py-2 shadow-sm focus:ring-2 focus:ring-blue-400"
        >
          <option value="All">All Payments</option>
          <option value="Paid">Paid</option>
          <option value="Pending">Pending</option>
        </select>
        <button
          onClick={fetchOrders}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Loading..." : "Search"}
        </button>
      </div>
      {/* Show Customer Name */}
      {customerName && (
        <h3 className="text-xl font-semibold text-center text-gray-800 mb-4">
          🧍‍♂️ Customer: <span className="text-blue-700">{customerName}</span>
        </h3>
      )}
      {/* Table */}
      {orders.length === 0 && !loading ? (
        <p className="text-center text-gray-600">No orders found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200 rounded-xl shadow">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                <th className="py-2 px-4 text-left">Order ID</th>
                <th className="py-2 px-4 text-left">Order Date</th>
                <th className="py-2 px-4 text-left">Order Status</th>
                <th className="py-2 px-4 text-left">Payment Status</th>
                <th className="py-2 px-4 text-left">Total</th>
                <th className="py-2 px-4 text-left">Delivery Mode</th>
                <th className="py-2 px-4 text-left">Address</th>
                <th className="py-2 px-4 text-left">Est. Delivery</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr
                  key={order.order_id}
                  className="border-t hover:bg-gray-50 transition-colors"
                >
                  <td className="py-2 px-4">{order.order_id}</td>
                  <td className="py-2 px-4">
                    {new Date(order.order_date).toLocaleString()}
                  </td>
                  <td
                    className={`py-2 px-4 font-semibold ${
                      order.order_status === "Delivered"
                        ? "text-green-600"
                        : order.order_status === "Pending"
                        ? "text-yellow-600"
                        : "text-blue-600"
                    }`}
                  >
                    {order.order_status}
                  </td>
                  <td
                    className={`py-2 px-4 font-semibold ${
                      order.payment_status === "Paid"
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {order.payment_status}
                  </td>
                  <td className="py-2 px-4">${order.total_amount}</td>
                  <td className="py-2 px-4">{order.mode_of_delivery}</td>
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
export default CustomerOrderReport;