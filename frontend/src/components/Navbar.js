// src/components/Navbar.js
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "./navbar.css";
import homeIcon from "../assets/home.svg";
import cartIcon from "../assets/cart.svg";
import userIcon from "../assets/user.svg";

const Navbar = () => {
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);   // 👈 dropdown toggle
  const menuRef = useRef(null);

  // fetch suggestions
  useEffect(() => {
    if (!searchText.trim()) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await axios.get(
          `http://localhost:5000/products?search=${encodeURIComponent(searchText)}`
        );
        setSuggestions(Array.isArray(res.data) ? res.data.slice(0, 6) : []);
      } catch (err) {
        console.error(err);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [searchText]);

  // close menu if clicked outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = () => {
    if (searchText.trim()) {
      navigate(`/home?query=${encodeURIComponent(searchText)}`);
      setShowSuggestions(false);
    }
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
              />
              <button className="search-btn" onClick={handleSearch}>Search</button>

              {showSuggestions && suggestions.length > 0 && (
                <ul className="search-suggestions">
                  {suggestions.map((p) => (
                    <li
                      key={p.product_id}
                      className="suggestion-item"
                      onClick={() => navigate(`/product/${p.product_id}`)}
                    >
                      <div className="s-title">{p.product_name}</div>
                      <div className="s-meta">{p.category_name} • SKU_{p.SKU}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="navbar-icons">
            <button className="navbar-icon" onClick={() => navigate("/home")}>
              <img src={homeIcon} alt="Home" />
            </button>

            <button className="navbar-icon" onClick={() => navigate("/cart")}>
              <img src={cartIcon} alt="Cart" />
            </button>

            {/* 👇 User dropdown */}
            <div className="user-dropdown" ref={menuRef}>
              <button
                className="navbar-icon"
                onClick={() => setMenuOpen((v) => !v)}
              >
                <img src={userIcon} alt="User" />
              </button>

              {menuOpen && (
                <div className="user-dropdown-panel">
                  <button onClick={() => { setMenuOpen(false); navigate("/profile"); }}>
                    Profile
                  </button>
                  <button className="logout-btn" onClick={handleLogout}>
                    Logout
                  </button>
                </div>
              )}
            </div>
            {/* 👆 End dropdown */}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
