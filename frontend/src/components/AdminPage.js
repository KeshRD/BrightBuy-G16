// src/components/AdminPage.js
import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { Line, Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
const { nanoid } = require("nanoid");

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend
);

const AdminPage = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    delete axios.defaults.headers.common["Authorization"];
    navigate("/");
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>

      <nav
        style={{
          width: "220px",
          background: "#1F2937",
          color: "#fff",
          padding: "20px 10px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          height: "100vh",
        }}
      >
  
        <div>
          <h2 style={{ textAlign: "center", marginBottom: "30px" }}>Admin Panel</h2>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {[
              { key: "dashboard", label: "Dashboard" },
              { key: "products", label: "Products" },
              { key: "orders", label: "Orders" },
              { key: "transactions", label: "Transactions" },
              { key: "reports", label: "Reports" },
              { key: "customers", label: "Customers" },
              { key: "suppliers", label: "Suppliers" },
              { key: "deliverydrivers", label: "Delivery Drivers" },
            ].map((tab) => (
              <li
                key={tab.key}
                style={linkStyle(activeTab === tab.key)}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </li>
            ))}
          </ul>
        </div>

      
        <div>
          <li
            style={{ ...linkStyle(false), background: "#B91C1C", marginTop: "20px" }}
            onClick={handleLogout}
          >
            Logout
          </li>
        </div>
      </nav>


      <div style={{ flex: 1, padding: "20px", background: "#111827", color: "#fff" }}>
        {activeTab === "dashboard" && <Dashboard />}
        {activeTab === "products" && <Products />}
        {activeTab === "orders" && <Orders />}
        {activeTab === "transactions" && <Transactions />}
        {activeTab === "reports" && <Reports />}
        {activeTab === "customers" && <Customers />}
        {activeTab === "suppliers" && <Suppliers />}
        {activeTab === "deliverydrivers" && <DeliveryDrivers />}
      </div>
    </div>
  );
};

/* ===== Sidebar Link Styles ===== */
const linkStyle = (active) => ({
  color: "#fff",
  textDecoration: "none",
  display: "block",
  padding: "10px 0",
  cursor: "pointer",
  fontWeight: active ? "bold" : "normal",
  background: active ? "#374151" : "transparent",
  borderRadius: "4px",
});

/* ===== Dashboard Component (Cleaned) ===== */
const Dashboard = () => {
  const [netIncome, setNetIncome] = useState(0);
  const [topProducts, setTopProducts] = useState([]);
  const [salesData, setSalesData] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState({});
  const [selectedQuarter, setSelectedQuarter] = useState("Q1");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [topProductPeriod, setTopProductPeriod] = useState("3_months");
  const [categoryOrders, setCategoryOrders] = useState([]);

  /* ===== Fetch Dashboard Data ===== */
  const fetchDashboardData = useCallback(async () => {
    try {
      const netRes = await axios.get("http://localhost:5000/api/admin/stats/netincome");
      const paymentRes = await axios.get("http://localhost:5000/api/admin/stats/payment-methods");

      setNetIncome(netRes.data.net_income || 0);

      const paymentObj = {};
      paymentRes.data.forEach((method) => {
        paymentObj[method.payment_method] = parseInt(method.count);
      });
      setPaymentMethods(paymentObj);
    } catch (err) {
      console.error(err);
    }
  }, []);

  /* ===== Fetch Sales Data ===== */
  const fetchSalesData = useCallback(async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/admin/stats/sales-performance", {
        params: { quarter: selectedQuarter, year: selectedYear },
      });
      setSalesData(res.data || []);
    } catch (err) {
      console.error("Error fetching sales data:", err);
    }
  }, [selectedQuarter, selectedYear]);

  /* ===== Fetch Top Products ===== */
  const fetchTopProducts = useCallback(async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/admin/stats/top-products", {
        params: { period: topProductPeriod },
      });
      setTopProducts(res.data || []);
    } catch (err) {
      console.error("Error fetching top products:", err);
    }
  }, [topProductPeriod]);

  /* ===== Fetch Category Orders ===== */
  const fetchCategoryOrders = useCallback(async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/admin/stats/category-orders");
      console.log("Category Orders Response:", res.data);
      setCategoryOrders(res.data || []);
      
    } catch (err) {
      console.error("Error fetching category orders:", err);
    }
  }, []);

  /* ===== Initial Data Fetch ===== */
  useEffect(() => {
    fetchDashboardData();
    fetchSalesData();
    fetchTopProducts();
    fetchCategoryOrders();
  }, [fetchDashboardData, fetchSalesData, fetchTopProducts, fetchCategoryOrders]);

  /* ===== Refetch Sales Data on Quarter / Year Change ===== */
  useEffect(() => {
    fetchSalesData();
  }, [fetchSalesData]);

  /* ===== Refetch Top Products on Period Change ===== */
  useEffect(() => {
    fetchTopProducts();
  }, [fetchTopProducts]);

  const handleTopProductPeriodChange = (e) => setTopProductPeriod(e.target.value);

  /* ===== Chart Data ===== */
  const lineChartData = {
    labels: salesData.map((item) => item.date),
    datasets: [
      {
        label: "Total Sales ($)",
        data: salesData.map((item) => item.total_sales),
        borderColor: "#34D399",
        backgroundColor: "rgba(52, 211, 153, 0.2)",
        tension: 0.3,
        fill: true,
      },
    ],
  };

  const doughnutData = {
    labels: Object.keys(paymentMethods),
    datasets: [
      {
        label: "Payment Methods",
        data: Object.values(paymentMethods),
        backgroundColor: ["#10B981", "#3B82F6", "#FACC15"],
        borderWidth: 1,
      },
    ],
  };

  return (
    <div style={{ color: "#fff" }}>
      {/* ===== TOP ROW: Net Income + Payment Methods ===== */}
      <div style={dashboardStyles.topRow}>
        <div style={dashboardStyles.netIncomeBox}>
          <h3>Net Income</h3>
          <p style={{ fontSize: "2rem", fontWeight: "bold", marginTop: "20px" }}>
            ${Number(netIncome || 0).toLocaleString()}
          </p>
        </div>

        <div style={dashboardStyles.paymentBox}>
          <h3>Payment Methods</h3>
          <div style={dashboardStyles.doughnutWrapper}>
            {Object.keys(paymentMethods).length > 0 ? (
              <Doughnut
                data={doughnutData}
                options={{ maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } }}
              />
            ) : (
              <p>No payment data available.</p>
            )}
          </div>
        </div>
      </div>

      {/* ===== QUARTER + YEAR SELECTORS ===== */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
        <label>
          Quarter:
          <select
            value={selectedQuarter}
            onChange={(e) => setSelectedQuarter(e.target.value)}
            style={dashboardStyles.dropdown}
          >
            <option value="Q1">Q1 (Jan - Mar)</option>
            <option value="Q2">Q2 (Apr - Jun)</option>
            <option value="Q3">Q3 (Jul - Sep)</option>
            <option value="Q4">Q4 (Oct - Dec)</option>
          </select>
        </label>

        <label>
          Year:
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            style={dashboardStyles.dropdown}
          >
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </label>

        <button onClick={fetchSalesData} style={styles.refreshButton}>
          Refresh
        </button>
      </div>

      {/* ===== SALES PERFORMANCE ===== */}
      <div style={dashboardStyles.chartContainer}>
        <h3>Sales Performance</h3>
        {salesData.length > 0 ? <Line data={lineChartData} /> : <p>No sales data available.</p>}
      </div>

      {/* ===== TOP PRODUCTS ===== */}
      <div style={dashboardStyles.tableContainer}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
          <h3>Top Selling Products</h3>
          <select
            value={topProductPeriod}
            onChange={handleTopProductPeriodChange}
            style={dashboardStyles.dropdown}
          >
            <option value="1_month">Last Month</option>
            <option value="3_months">Last 3 Months</option>
            <option value="6_months">Last 6 Months</option>
            <option value="1_year">Last Year</option>
          </select>
        </div>

        <table style={dashboardStyles.table}>
          <thead>
            <tr>
              <th>Product</th>
              <th>Qty Sold</th>
              <th>Revenue</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {topProducts.length > 0 ? (
              topProducts.map((product, i) => (
                <tr key={i}>
                  <td>{product.product_name}</td>
                  <td>{product.total_sold}</td>
                  <td>${parseFloat(product.total_revenue).toFixed(2)}</td>
                  <td style={{ color: "lightgreen" }}>In Stock</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4">No product data available.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ===== CATEGORY-WISE TOTAL ORDERS ===== */}
<div style={{ ...dashboardStyles.tableContainer, marginTop: "30px" }}>
  <h3>Category-wise Total Orders</h3>
  <table style={dashboardStyles.table}>
    <thead>
      <tr>
        <th>Category</th>
        <th>Total Sold</th>
        {/*<th>Total Revenue ($)</th>*/}
      </tr>
    </thead>
    <tbody>
      {categoryOrders.length > 0 ? (
        categoryOrders.map((cat, i) => (
          <tr key={i}>
            <td>{cat.category}</td>
            <td>{cat.total_sold}</td>
            {/*<td>{cat.total_revenue}</td>*/}
          </tr>
        ))
      ) : (
        <tr>
          <td colSpan="3">No category data available.</td>
        </tr>
      )}
    </tbody>
  </table>
</div>

    </div>
  );
};



const dashboardStyles = {
  topRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "stretch",
    gap: "20px",
    marginBottom: "20px",
  },
  netIncomeBox: {
    flex: "1",
    background: "#1F2937",
    padding: "20px",
    borderRadius: "8px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "250px",
  },
  paymentBox: {
    flex: "1",
    background: "#111827",
    padding: "20px",
    borderRadius: "8px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "250px",
  },
  doughnutWrapper: {
    width: "180px",
    height: "180px",
    marginTop: "15px",
  },
  chartContainer: {
    background: "#111827",
    padding: "20px",
    borderRadius: "8px",
    marginBottom: "20px",
  },
  tableContainer: {
    background: "#111827",
    padding: "20px",
    borderRadius: "8px",
    color: "#fff",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  dropdown: {
    marginLeft: "5px",
    padding: "5px",
    borderRadius: "4px",
    border: "1px solid #ccc",
    background: "#111827",
    color: "#fff",
  },

  
};

/* ===== Other Admin Components ===== */
const Products = () => {
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredProducts, setFilteredProducts] = useState([]);
  //const [topProductPeriod, setTopProductPeriod] = useState("3_months"); // default

  

  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {

    setFilteredProducts(
      products.filter(
        (p) =>
          p.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.variant.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.category.toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [searchTerm, products]);

  const fetchData = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/admin/products");
      setProducts(res.data);
      setFilteredProducts(res.data);
    } catch (err) {
      console.error(err);
    }
  };
  




  return (
    <div>
      <h2>Products</h2>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px", gap: "5px"}}>

   
        <button
          onClick={() => navigate('/admin/products/new')}
          style={{
            padding: "6px 12px",
            border: "1px solid #ccc",
            borderLeft: "none",
            borderRadius: "4px",
            background: "#10B981",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          Add Product
        </button>

       
        <div style={{ display: "flex", gap: "0px" }}>
          <input
            type="text"
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.g.target.value)}
            style={{
              padding: "6px 10px",
              borderRadius: "4px 0 0 4px",
              border: "1px solid #ccc",
              width: "200px",
            }}
          />
          <button
            onClick={() => {}} 
            style={{
              padding: "6px 12px",
              border: "1px solid #ccc",
              borderLeft: "none",
              borderRadius: "0 4px 4px 0",
              background: "#10B981",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Search
          </button>
        </div>
      </div>
      
      <Table
        data={filteredProducts}
        columns={["variant_id", "product_name", "variant","category", "stock_quantity", "price"]}
      />

 
      
    </div>
  );
};


const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredOrders, setFilteredOrders] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    setFilteredOrders(
      orders.filter(
        (o) =>
          o.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          o.status.toLowerCase().includes(searchTerm.toLowerCase()) ||
          o.order_id.toString().includes(searchTerm)
      )
    );
  }, [searchTerm, orders]);

  const fetchData = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/admin/orders-with-delivery");
      setOrders(res.data);
      setFilteredOrders(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div>
      <h2>Orders</h2>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "10px", gap: "5px" }}>
        <input
          type="text"
          placeholder="Search orders..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            padding: "6px 10px",
            borderRadius: "4px 0 0 4px",
            border: "1px solid #ccc",
            width: "200px",
          }}
        />
        <button
          onClick={() => {}}
          style={{
            padding: "6px 12px",
            border: "1px solid #ccc",
            borderLeft: "none",
            borderRadius: "0 4px 4px 0",
            background: "#3B82F6",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          Search
        </button>
      </div>
      <Table
        data={filteredOrders}
        columns={[
          "order_id",
          "customer_name",
          "status",
          "total_amount",
          "order_date",
          "delivery_id",
          "delivery_status",
          "delivery_date"
        ]}
      />
    </div>
  );
};




const Transactions = () => {
  const [transactions, setTransactions] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [variants, setVariants] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [formData, setFormData] = useState({
    party_id: "",
    variant_id: "",
    quantity: "",
    transaction_date: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    fetchData();
    fetchSuppliers();
    fetchVariants();
  }, []);

  const fetchData = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/admin/transactions");
      setTransactions(res.data);
    } catch (err) {
      console.error("Error fetching transactions:", err);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/admin/suppliers");
      setSuppliers(res.data || []);
    } catch (err) {
      console.error("Error fetching suppliers:", err);
    }
  };

  const fetchVariants = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/admin/variants");
      setVariants(res.data || []);
    } catch (err) {
      console.error("Error fetching variants:", err);
    }
  };

  const openModal = (transaction = null) => {
    if (transaction) {
      setSelectedTransaction(transaction);
      setFormData({
        party_id: transaction.party_id,
        variant_id: transaction.variant_id,
        quantity: transaction.quantity,
        transaction_date: transaction.transaction_date.split("T")[0],
      });
    } else {
      setSelectedTransaction(null);
      setFormData({
        party_id: "",
        variant_id: "",
        quantity: "",
        transaction_date: new Date().toISOString().split("T")[0],
      });
    }
    setShowModal(true);
  };

  const handleDelete = async (transaction_id) => {
    if (!window.confirm("Are you sure you want to delete this transaction?")) return;

    try {
      const res = await axios.delete(`http://localhost:5000/api/admin/transactions/${transaction_id}`);
      alert(res.data.message || "Transaction deleted successfully!");
      fetchData();
    } catch (err) {
      console.error(err.response?.data || err.message);
      alert("Failed to delete transaction.");
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedTransaction(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    const { variant_id, party_id, quantity, transaction_date } = formData;

    if (!variant_id || !party_id || !quantity) {
      alert("Please fill in all fields.");
      return;
    }

    const payload = {
      variant_id: Number(variant_id),
      party_id: Number(party_id),
      transaction_type: "Purchase", // fixed
      quantity: Number(quantity),
      transaction_date,
      party_type: "Supplier", // fixed
    };

    console.log(">>> Payload:", payload);

    try {
      if (selectedTransaction) {
        await axios.put(
          `http://localhost:5000/api/admin/transactions/${selectedTransaction.transaction_id}`,
          payload
        );
        alert("Transaction updated successfully!");
      } else {
        await axios.post("http://localhost:5000/api/admin/transactions", payload);
        alert("Transaction added successfully!");
      }
      fetchData();
      closeModal();
    } catch (err) {
      console.error(err.response?.data || err.message);
      alert("Failed to save transaction.");
    }
  };

  return (
    <div>
      <h2>Transactions</h2>
      <button onClick={() => openModal()} style={styles.addButton}>
        Add New Transaction
      </button>

      <Table
        data={transactions}
        columns={[
          "transaction_id",
          "party_id",
          "party_type",
          "variant_id",
          "transaction_type",
          "quantity",
          "transaction_date",
          "actions",
        ]}
        renderExtraColumn={(row) => (
          <div style={{ display: "flex", gap: "5px" }}>
        
            <button onClick={() => handleDelete(row.transaction_id)} style={styles.deleteButton}>
              Delete
            </button>
          </div>
        )}
      />

      {showModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h3>{selectedTransaction ? "Update Transaction" : "Add New Transaction"}</h3>

            <label>
              Supplier:
              <select
                name="party_id"
                value={formData.party_id}
                onChange={handleInputChange}
                style={styles.input}
              >
                <option value="">Select Supplier</option>
                {suppliers.map((s) => (
                  <option key={s.supplier_id} value={s.supplier_id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Variant (Product - Category):
              <select
                name="variant_id"
                value={formData.variant_id}
                onChange={handleInputChange}
                style={styles.input}
              >
                <option value="">Select Variant</option>
                {variants.map((v) => (
                  <option key={v.variant_id} value={v.variant_id}>
                    {`${v.variant_name} - ${v.product_name} (${v.category_name})`}
                  </option>
                ))}
              </select>
            </label>


            <label>
              Quantity:
              <input
                type="number"
                name="quantity"
                value={formData.quantity}
                onChange={handleInputChange}
                style={styles.input}
              />
            </label>

            <label>
              Transaction Date:
              <input
                type="date"
                name="transaction_date"
                value={formData.transaction_date}
                onChange={handleInputChange}
                style={styles.input}
              />
            </label>

            <div style={styles.modalButtons}>
              <button onClick={handleSave} style={styles.saveButton}>
                {selectedTransaction ? "Update" : "Add"}
              </button>
              <button onClick={closeModal} style={styles.cancelButton}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};



const Reports = () => {
  const [reports, setReports] = useState([]);
  useEffect(() => {
    fetchData();
  }, []);
  const fetchData = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/admin/reports");
      setReports(res.data);
    } catch (err) {
      console.error(err);
    }
  };
  return (
    <div>
      <h2>Reports</h2>
      <Table data={reports} columns={["report_id", "title", "generated_on"]} />
    </div>
  );
};

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [selectedRole, setSelectedRole] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [modalCustomer, setModalCustomer] = useState(null);
  const [supplierAddress, setSupplierAddress] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/admin/customers");
      setCustomers(res.data);
    } catch (err) {
      console.error("Error fetching customers:", err);
    }
  };

  const handleRoleSelect = (id, newRole) => {
    setSelectedRole((prev) => ({ ...prev, [id]: newRole }));
  };

  const handleChangeRole = async (cust) => {
    const newRole = selectedRole[cust.customer_id];
    if (!newRole) {
      alert("Please select a role first.");
      return;
    }

    // If Supplier — open popup
    if (newRole === "Supplier") {
      setModalCustomer(cust);
      setShowModal(true);
      return;
    }

    // Otherwise — directly update role
    try {
      await axios.patch(`http://localhost:5000/api/admin/users/${cust.customer_id}/role`, {
        role: newRole,
      });
      alert("Role updated successfully!");
      fetchData();
    } catch (err) {
      console.error("Error updating role:", err);
      alert("Failed to update role.");
    }
  };

  const handleSupplierSubmit = async () => {
    if (!supplierAddress.trim()) {
      alert("Please enter the supplier's address.");
      return;
    }

    try {
      await axios.patch(`http://localhost:5000/api/admin/users/${modalCustomer.customer_id}/role`, {
        role: "Supplier",
        address: supplierAddress,
      });
      alert("Role updated and supplier added successfully!");
      setShowModal(false);
      setSupplierAddress("");
      fetchData();
    } catch (err) {
      console.error("Error updating supplier role:", err);
      alert("Failed to update supplier role.");
    }
  };

  return (
    <div>
      <h2>Customers</h2>
      <table style={styles.table}>
        <thead>
          <tr>
            <th>Customer ID</th>
            <th>Name</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Current Role</th>
            <th>Change Role</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {customers.length > 0 ? (
            customers.map((cust) => (
              <tr key={cust.customer_id}>
                <td>{cust.customer_id}</td>
                <td>{cust.name}</td>
                <td>{cust.email}</td>
                <td>{cust.phone}</td>
                <td>{cust.role || "Registered Customer"}</td>
                <td>
                  <select
                    value={selectedRole[cust.customer_id] || cust.role || "Registered Customer"}
                    onChange={(e) => handleRoleSelect(cust.customer_id, e.target.value)}
                    style={{
                      background: "#111827",
                      color: "#fff",
                      padding: "6px",
                      borderRadius: "4px",
                    }}
                  >
                    <option value="Registered Customer">Customer</option>
                    <option value="Admin">Admin</option>
                    <option value="Supplier">Supplier</option>
                    <option value="Delivery Driver">Delivery Driver</option>
                  </select>
                </td>
                <td>
                  <button
                    onClick={() => handleChangeRole(cust)}
                    style={{
                      background: "#3B82F6",
                      color: "#fff",
                      border: "none",
                      padding: "6px 10px",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    Change Role
                  </button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="7">No customers found.</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* ========== Supplier Modal ========== */}
      {showModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h3 style={{ marginBottom: "15px" }}>
              Convert <span style={{ color: "#3B82F6" }}>{modalCustomer.name}</span> to Supplier
            </h3>
            <p>Enter supplier address:</p>
            <input
              type="text"
              placeholder="Supplier address"
              value={supplierAddress}
              onChange={(e) => setSupplierAddress(e.target.value)}
              style={{
                width: "100%",
                padding: "8px",
                margin: "10px 0",
                borderRadius: "6px",
                border: "1px solid #444",
                background: "#111827",
                color: "#fff",
              }}
            />
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  background: "#6B7280",
                  color: "#fff",
                  border: "none",
                  padding: "6px 12px",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSupplierSubmit}
                style={{
                  background: "#10B981",
                  color: "#fff",
                  border: "none",
                  padding: "6px 12px",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};






const Suppliers = () => {
  const [suppliers, setSuppliers] = useState([]);
  useEffect(() => {
    fetchData();
  }, []);
  const fetchData = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/admin/suppliers");
      setSuppliers(res.data);
    } catch (err) {
      console.error(err);
    }
  };
  return (
    <div>
      <h2>Suppliers</h2>
      <Table
        data={suppliers}
        columns={["supplier_id", "name", "contact", "email", "address"]}
      />
    </div>
  );
};

const DeliveryDrivers = () => {
  const [DeliveryDrivers, setDeliveryDrivers] = useState([]);
  useEffect(() => {
    fetchData();
  }, []);
  const fetchData = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/admin/deliverydrivers");
      setDeliveryDrivers(res.data);
    } catch (err) {
      console.error(err);
    }
  };
  return (
    <div>
      <h2>Delivery Drivers</h2>
      <Table data={DeliveryDrivers} columns={["delivery_id", "name", "email", "phone"]} />
    </div>
  );
};

const Table = ({ data, columns, renderExtraColumn }) => (
  <table style={styles.table}>
    <thead>
      <tr>
        {columns.map((col) => (
          <th key={col}>{col.replace("_", " ").toUpperCase()}</th>
        ))}
      </tr>
    </thead>
    <tbody>
      {data.map((row) => (
        <tr key={row.transaction_id || row[columns[0]]}>
          {columns.map((col) =>
            col === "actions" ? (
              <td key={col}>{renderExtraColumn ? renderExtraColumn(row) : null}</td>
            ) : (
              <td key={col}>{row[col]}</td>
            )
          )}
        </tr>
      ))}
    </tbody>
  </table>
);

// ===== Styles =====
const styles = {
  table: {
    width: "100%",
    borderCollapse: "collapse",
    border: "1px solid #ccc",
    marginTop: "15px",
  },

  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100vw",
    height: "100vh",
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  modal: {
    background: "#1F2937",
    padding: "20px",
    borderRadius: "8px",
    minWidth: "300px",
    display: "flex",
    flexDirection: "column",
    gap: "15px",
    color: "#fff",
  },
  input: {
    width: "100%",
    padding: "8px",
    borderRadius: "4px",
    border: "1px solid #ccc",
    marginTop: "5px",
    background: "#111827",
    color: "#fff",
  },
  modalButtons: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
  },
  saveButton: {
    padding: "6px 12px",
    background: "#10B981",
    color: "#fff",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
  },
  cancelButton: {
    padding: "6px 12px",
    background: "#B91C1C",
    color: "#fff",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
  },

  addButton: {
    padding: "6px 12px",
    background: "#10B981",
    color: "#fff",
    border: "none",
    borderRadius: "4px",
    marginBottom: "10px",
    cursor: "pointer",
  },

  deleteButton: {
    padding: "5px 10px",
    background: "#f44336",
    color: "white",
    border: "none",
    borderRadius: "4px",
  },
};
export default AdminPage;