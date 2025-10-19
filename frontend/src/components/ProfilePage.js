// src/components/ProfilePage.js
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

export default function ProfilePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("user")); } catch { return null; }
  });
  const [loading, setLoading] = useState(!user);
  const [err, setErr] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { navigate("/"); return; }

    // If no local user (e.g., after refresh), fetch from backend
    if (!user) {
      (async () => {
        try {
          const res = await axios.get(`${API_URL}/api/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          localStorage.setItem("user", JSON.stringify(res.data));
          setUser(res.data);
        } catch (e) {
          setErr("Failed to load profile. Please log in again.");
        } finally { setLoading(false); }
      })();
    }
  }, [navigate, user]);

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    delete axios.defaults.headers.common['Authorization'];
    navigate("/");
  };

  if (loading) return <div className="App-header" style={{paddingTop:90}}>Loading…</div>;
  if (err) return <div className="App-header" style={{paddingTop:90}}>{err}</div>;
  if (!user) return null;

  return (
    <div className="App-header" style={{ paddingTop: 90 }}>
      <div style={{
        maxWidth: 720, margin: "0 auto",
        background: "#1c1f24", border: "1px solid rgba(255,255,255,.06)",
        borderRadius: 12, padding: 20
      }}>
        <h2 style={{marginTop:0}}>My Profile</h2>
        <p><b>Name:</b> {user.name}</p>
        <p><b>Email:</b> {user.email}</p>
        {user.phone && <p><b>Phone:</b> {user.phone}</p>}
        <p><b>Role:</b> {user.role}</p>

        <div style={{display:"flex", gap:12, marginTop:12}}>
          <button onClick={() => navigate("/orders")}>My Orders</button>
          {user.role === "Admin" && (
            <button onClick={() => navigate("/admin")}>Admin Dashboard</button>
          )}
          <button style={{background:"#f44336"}} onClick={logout}>Logout</button>
        </div>
      </div>
    </div>
  );
}
