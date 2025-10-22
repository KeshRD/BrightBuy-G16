// frontend/src/components/ProfilePage.js
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "./profile.css";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

export default function ProfilePage() {
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // fetch profile + orders
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setErr("You’re not logged in.");
      setLoading(false);
      return;
    }
    const headers = { Authorization: `Bearer ${token}` };

    (async () => {
      try {
        const [meRes, ordRes] = await Promise.all([
          axios.get(`${API_URL}/api/me`, { headers }),
          axios.get(`${API_URL}/orders`, { headers }),
        ]);
        setMe(meRes.data);
        setOrders(Array.isArray(ordRes.data) ? ordRes.data : []);
      } catch (e) {
        console.error(e);
        setErr("Failed to load your profile or orders.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // derive buckets if backend didn’t send "bucket"
  const grouped = useMemo(() => {
    const g = { toPay: [], toShip: [], toReceive: [], received: [], other: [] };
    for (const o of orders) {
      const payment = (o.payment_status || "Pending").toLowerCase();
      const status = (o.order_status || "").toLowerCase();
      const bucket =
        o.bucket ||
        (payment === "pending"
          ? "toPay"
          : status === "pending"
          ? "toShip"
          : status === "in transit"
          ? "toReceive"
          : status === "delivered"
          ? "received"
          : "other");
      (g[bucket] ?? g.other).push(o);
    }
    return g;
  }, [orders]);

  if (loading) {
    return (
      <div className="profile-shell">
        <div className="card skeleton">
          <div className="s-l1" />
          <div className="s-l2" />
          <div className="s-l3" />
        </div>
        <div className="orders-card skeleton" />
      </div>
    );
  }
  if (err) return <div className="profile-shell"><div className="error">{err}</div></div>;
  if (!me) return null;

  return (
    <div className="profile-shell">
      {/* Top row: avatar + details */}
      <section className="card profile-card">
        <div className="avatar">
          {me.name?.[0]?.toUpperCase() || "U"}
        </div>

        <div className="profile-meta">
          <h1>My Profile</h1>
          <div className="meta-grid">
            <MetaRow label="Name" value={me.name} />
            <MetaRow label="Email" value={me.email} />
            <MetaRow label="Phone" value={me.phone || "—"} />
            <MetaRow label="Role" value={me.role} />
          </div>

          <div className="actions">
            <button className="btn primary" onClick={() => navigate("/home")}>
              Continue Shopping
            </button>
            <button
              className="btn danger"
              onClick={() => {
                localStorage.clear();
                navigate("/");
              }}
            >
              Logout
            </button>
          </div>
        </div>
      </section>

      {/* Orders overview */}
      <section className="orders-card">
        <div className="orders-header">
          <h2>My Orders</h2>
          <button
            className="btn ghost"
            onClick={() => navigate("/orders")}
            title="View all orders"
          >
            View All Orders →
          </button>
        </div>

        <div className="buckets">
          <Bucket
            label="To Pay"
            count={grouped.toPay.length}
            icon={<WalletIcon />}
          />
          <Bucket
            label="To Ship"
            count={grouped.toShip.length}
            icon={<BoxIcon />}
          />
          <Bucket
            label="To Receive"
            count={grouped.toReceive.length}
            icon={<TruckIcon />}
          />
          <Bucket
            label="Received"
            count={grouped.received.length}
            icon={<CheckIcon />}
          />
          <Bucket label="Other" count={grouped.other.length} icon={<DotsIcon />} />
        </div>

        {/* Lists – only render if items exist */}
        <OrderList title="To Pay" items={grouped.toPay} />
        <OrderList title="To Ship" items={grouped.toShip} />
        <OrderList title="To Receive" items={grouped.toReceive} />
        <OrderList title="Received" items={grouped.received} />
      </section>
    </div>
  );
}

function MetaRow({ label, value }) {
  return (
    <div className="meta-row">
      <span className="k">{label}</span>
      <span className="v">{value}</span>
    </div>
  );
}

function Bucket({ label, count, icon }) {
  return (
    <div className="bucket">
      <div className="i">{icon}</div>
      <div className="t">{label}</div>
      <div className="c">{count}</div>
    </div>
  );
}

function OrderList({ title, items }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="order-list">
      <h3>{title}</h3>
      <div className="order-grid">
        {items.map((o) => (
          <div key={o.order_id} className="order-card">
            <div className="order-top">
              <div className="oid">Order #{o.order_id}</div>
              <div className="badges">
                <span className="pill">{o.payment_status || "Pending"}</span>
                <span className="pill dim">{o.order_status}</span>
              </div>
            </div>

            <div className="order-body">
              <div className="lines">
                {Array.isArray(o.items) &&
                  o.items.slice(0, 3).map((it, idx) => (
                    <div key={idx} className="line">
                      <span className="name">
                        {it.product_name} <span className="muted">({it.variant_name})</span>
                      </span>
                      <span className="qty">× {it.quantity}</span>
                    </div>
                  ))}
                {Array.isArray(o.items) && o.items.length > 3 && (
                  <div className="muted">+ {o.items.length - 3} more</div>
                )}
              </div>

              <div className="total">
                Total: <b>${Number(o.total_amount || 0).toFixed(2)}</b>
              </div>
            </div>

            <div className="order-actions">
              <button
                className="btn small ghost"
                onClick={() => window.location.assign("/orders")}
              >
                Details
              </button>
              {String(o.payment_status).toLowerCase() === "pending" && (
                <button
                  className="btn small primary"
                  onClick={() => window.location.assign(`/checkout?order=${o.order_id}`)}
                >
                  Pay Now
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------- tiny inline icons (SVG) ------- */
function WalletIcon() {
  return (
    <svg viewBox="0 0 24 24" className="ico"><path d="M20 7H6a2 2 0 0 1 0-4h12a1 1 0 0 1 0 2H6a0 0 0 1 0 0 0v0a2 2 0 0 0-2 2v10a3 3 0 0 0 3 3h13a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Zm-2 6a1 1 0 1 1 0-2h3v2Z"/></svg>
  );
}
function BoxIcon() {
  return (
    <svg viewBox="0 0 24 24" className="ico"><path d="M12 2 2 7l10 5 10-5-10-5Zm0 7L2 4v13l10 5 10-5V4L12 9Z"/></svg>
  );
}
function TruckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="ico"><path d="M3 6h11v9H3V6Zm11 3h4l3 3v3h-7V9ZM6 20a2 2 0 1 1 0-4 2 2 0 0 1 0 4Zm10 0a2 2 0 1 1 .001-4.001A2 2 0 0 1 16 20Z"/></svg>
  );
}
function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="ico"><path d="M20.285 6.709 9 18l-5.285-5.29 1.414-1.414L9 15.172l9.871-9.877 1.414 1.414Z"/></svg>
  );
}
function DotsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="ico"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
  );
}
