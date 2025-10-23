import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import "./navbar.css";
import homeIcon from "../assets/home.svg";
import cartIcon from "../assets/cart.svg";
import userIcon from "../assets/user.svg";
import chatIcon from "../assets/123.svg";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const norm = (s) =>
  (s || "")
    .toString()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const tokenize = (s) =>
  norm(s)
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);

/** Smarter scoring:
 * - Big boost if CATEGORY matches the query ("moni" -> "Monitors")
 * - Small boost for currentCategory only (so it won’t overpower query intent)
 * - Strong for name word starts/ends with query
 * - Penalty for incidental matches (e.g., head[phone]s when searching phone)
 */
const scoreProduct = (p, qTok, currentCategory) => {
  if (!qTok) return 0;

  const name = p.product_name || "";
  const sku = p.SKU || p.sku || "";
  const cat = p.category_name || "";
  const nameToks = tokenize(name);
  const catTok = norm(cat);
  const skuTok = norm(sku);
  const curCatTok = norm(currentCategory || "");

  let s = 0;

  const catMatchesQuery =
    catTok.startsWith(qTok) || catTok.split(" ").some((w) => w.startsWith(qTok));

  // 1) Category matching the query gets the HIGHEST boost
  if (catMatchesQuery) s += 160;

  // 2) Current category gets only a SMALL boost (so it won't override intent)
  if (curCatTok && curCatTok === catTok) s += 15;

  // 3) Name signals
  const nameTokStarts = nameToks.some((w) => w.startsWith(qTok));
  const nameTokEnds = nameToks.some((w) => w.endsWith(qTok));
  if (nameTokStarts) s += 110;
  if (nameTokEnds) s += 95;
  if (norm(name).includes(qTok)) s += 35;

  // 4) SKU / category contains
  if (skuTok.startsWith(qTok)) s += 70;
  if (!catMatchesQuery && catTok.includes(qTok)) s += 40;

  // 5) Penalize incidental matches (inside long tokens, not start/end)
  for (const w of nameToks) {
    if (
      w.includes(qTok) &&
      !w.startsWith(qTok) &&
      !w.endsWith(qTok) &&
      w.length >= qTok.length + 2
    ) {
      s -= 40;
    }
  }

  // small tie-breaker
  s += Math.max(0, 12 - name.length * 0.2);

  return s;
};

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchText, setSearchText] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [cartItemCount, setCartItemCount] = useState(0);
  const menuRef = useRef(null);

  const params = new URLSearchParams(location.search);
  const currentCategory = params.get("category") || "";

  // Fetch + rank suggestions
  useEffect(() => {
    const raw = searchText.trim();
    const qTok = norm(raw);
    if (!qTok) {
      setSuggestions([]);
      return;
    }

    const t = setTimeout(async () => {
      try {
        const res = await axios.get(
          `${API_URL}/products?search=${encodeURIComponent(raw)}`
        );
        const list = Array.isArray(res.data) ? res.data : [];

        const ranked = list
          .map((p) => ({ p, s: scoreProduct(p, qTok, currentCategory) }))
          .filter((x) => x.s > 0)
          .sort((a, b) => b.s - a.s)
          .map((x) => x.p);

        // de-dup + top 6
        const seen = new Set();
        const top = [];
        for (const item of ranked) {
          if (!seen.has(item.product_id)) {
            seen.add(item.product_id);
            top.push(item);
          }
          if (top.length >= 6) break;
        }
        setSuggestions(top);
      } catch (e) {
        console.error("suggestions error", e);
      }
    }, 250);

    return () => clearTimeout(t);
  }, [searchText, currentCategory]);

  // close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // fetch cart count
  useEffect(() => {
    const fetchCart = async () => {
      try {
        const token = localStorage.getItem("token");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        if (!token) return setCartItemCount(0);
        const r = await axios.get(`${API_URL}/cart`, { headers });
        setCartItemCount(Array.isArray(r.data) ? r.data.length : 0);
      } catch (e) {
        // If token is invalid (403), clear it and stop requesting
        if (e.response && e.response.status === 403) {
          localStorage.removeItem("token");
          setCartItemCount(0);
        } else {
          console.error("cart count error", e);
        }
      }
    };
    fetchCart();
    const i = setInterval(fetchCart, 5000);
    return () => clearInterval(i);
  }, []);

  const handleSearch = () => {
    const q = searchText.trim();
    if (q) {
      navigate(
        `/products?query=${encodeURIComponent(q)}${
          currentCategory ? `&category=${encodeURIComponent(currentCategory)}` : ""
        }`
      );
      setShowSuggestions(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSearch();
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/");
    setMenuOpen(false);
  };

  return (
    <header className="navbar">
      <div className="navbar-inner unified">
        <div className="navbar-brand" onClick={() => navigate("/home")}>
          BrightBuy
        </div>

        <div />

        <div className="navbar-right">
          <div className="navbar-search">
            <div className="search-wrap">
              <input
                type="text"
                placeholder="Search products..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onFocus={() => setShowSuggestions(true)}
                onKeyDown={handleKeyDown}
              />
              <button className="search-btn" onClick={handleSearch}>
                Search
              </button>

              {showSuggestions && suggestions.length > 0 && (
                <ul className="search-suggestions">
                  {suggestions.map((p) => (
                    <li
                      key={p.product_id}
                      className="suggestion-item"
                      onClick={() => navigate(`/product/${p.product_id}`)}
                    >
                      <div className="s-title">{p.product_name}</div>
                      <div className="s-meta">
                        {(p.category_name || "—")} • SKU_{p.SKU}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="navbar-links">
            <button className="navbar-link-btn" onClick={() => navigate("/products")}>
              Our Products
            </button>
          </div>

          <div className="navbar-icons">
            <button className="navbar-icon" onClick={() => navigate("/home")}>
              <img src={homeIcon} alt="Home" />
            </button>

            <button className="navbar-icon" onClick={() => {
              if (!localStorage.getItem("token")) {
                alert("Sign up/Log in to enjoy the full benefits of our service");
              } else {
                navigate("/cart");
              }
            }}>
              <img src={cartIcon} alt="Cart" />
              {cartItemCount > 0 && <span className="cart-badge">{cartItemCount}</span>}
            </button>

            <button className="navbar-icon" onClick={() => {
              if (!localStorage.getItem("token")) {
                alert("Sign up/Log in to use the chatbot");
              } else {
                navigate("/chatbot");
              }
            }}>
              <img src={chatIcon} alt="Chat" />
            </button>

            <div className="user-dropdown" ref={menuRef}>
              <button className="navbar-icon" onClick={() => setMenuOpen((v) => !v)}>
                <img src={userIcon} alt="User" />
              </button>
              {menuOpen && (
                <div className="user-dropdown-panel">
                  {localStorage.getItem("token") ? (
                    <>
                      <button onClick={() => { setMenuOpen(false); navigate("/profile"); }}>
                        My Profile
                      </button>
                      <button onClick={handleLogout}>
                        Sign out
                      </button>
                    </>
                  ) : (
                    <button onClick={() => { setMenuOpen(false); navigate("/auth"); }}>
                      Log in/Sign up
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
