import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "./navbar.css";
import homeIcon from "../assets/home.svg";
import cartIcon from "../assets/cart.svg";
import userIcon from "../assets/user.svg";

const Navbar = ({ showSearch = true }) => {
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);   // 👈 dropdown toggle
  const [cartItemCount, setCartItemCount] = useState(0);
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

  // fetch cart count
  useEffect(() => {
    const fetchCartItems = async () => {
      try {
        const token = localStorage.getItem("token");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        if (!token) {
          setCartItemCount(0);
          return;
        }
        const response = await axios.get("http://localhost:5000/cart", { headers });
        setCartItemCount(Array.isArray(response.data) ? response.data.length : 0);
      } catch (error) {
        console.error("Failed to fetch cart count", error.response?.data || error.message || error);
      }
    };

    fetchCartItems();
    const interval = setInterval(fetchCartItems, 5000);
    return () => clearInterval(interval);
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
          {showSearch && (
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
          )}

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
                  {localStorage.getItem("token") ? (
                    <>
                      <button onClick={() => { setMenuOpen(false); navigate("/profile"); }}>
                        My Profile
                      </button>
                      <button className="logout-btn" onClick={handleLogout}>
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
            {/* 👆 End dropdown */}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
