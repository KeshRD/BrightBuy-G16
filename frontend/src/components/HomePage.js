import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { useNavigate, useLocation, Link } from "react-router-dom";
import Navbar from "./Navbar";
import SidebarCategories from "./SidebarCategories";
import "./sidebar.css";

/* Read query params */
function useQueryParams() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

const HomePage = ({ showProductsOnly }) => {
  const [products, setProducts] = useState([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const navigate = useNavigate();
  const params = useQueryParams();

  const query = (params.get("query") || "").toLowerCase();
  const category = params.get("category") || "";

  const slides = [
    { image: '/Assets/MacBook Air M3.png', alt: 'MacBook Air M3' },
    { image: '/Assets/PlayStation 5.png', alt: 'PlayStation 5' },
    { image: '/Assets/Apple AirPods Pro 2.jpg', alt: 'Apple AirPods Pro 2' },
    { image: '/Assets/Nintendo Switch OLED.jpg', alt: 'Nintendo Switch OLED' },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prevSlide) => (prevSlide + 1) % slides.length);
    }, 8000); // Change slide every 8 seconds

    return () => clearInterval(interval);
  }, [slides.length]);

  useEffect(() => {
    const container = document.querySelector('.slideshow-container');
    if (container) {
      container.style.transform = `translateX(-${currentSlide * 100}%)`;
    }
  }, [currentSlide]);

  const goToPrevSlide = () => {
    setCurrentSlide((prevSlide) => (prevSlide - 1 + slides.length) % slides.length);
  };

  const goToNextSlide = () => {
    setCurrentSlide((prevSlide) => (prevSlide + 1) % slides.length);
  };

  const goToSlide = (index) => {
    setCurrentSlide(index);
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/");
      return;
    }
    axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

    (async () => {
      try {
        const res = await axios.get("http://localhost:5000/products");
        setProducts(Array.isArray(res.data) ? res.data : []);
      } catch (e) {
        console.error("fetch products error", e);
      }
    })();
  }, [navigate]);

  /* Unique, sorted categories from products */
  const categories = Array.from(
    new Set(products.map((p) => p.category_name).filter(Boolean))
  ).sort();

  /* Filtered product list by search + category */
  const filtered = products.filter((p) => {
    const name = (p.product_name || "").toLowerCase();
    const desc = (p.description || "").toLowerCase();
    const sku = (p.SKU || p.sku || "").toLowerCase();
    const cat = (p.category_name || "");

    const matchesQuery =
      !query || name.includes(query) || desc.includes(query) || sku.includes(query);
    const matchesCategory =
      !category || (cat && cat.toLowerCase() === category.toLowerCase());

    return matchesQuery && matchesCategory;
  });

  const minPrice = (variants = []) => {
    const nums = variants.map((v) => Number(v.price)).filter((n) => !isNaN(n));
    return nums.length ? Math.min(...nums) : null;
  };

  const openProduct = (id) => navigate(`/product/${id}`);

  return (
    <>
      <Navbar />
      {!showProductsOnly ? (
        <section className="slideshow" aria-label="Featured products slideshow">
          <div className="slideshow-container">
            {slides.map((slide, index) => (
              <div key={index} className={`slide ${index === currentSlide ? 'active' : ''}`}>
                <img src={`http://localhost:5000${slide.image}`} alt={slide.alt} className="slide-image" />
              </div>
            ))}
          </div>
          <button className="slideshow-nav prev" onClick={goToPrevSlide}>{'<'}</button>
          <button className="slideshow-nav next" onClick={goToNextSlide}>{'>'}</button>
          <div className="slideshow-dots">
            {slides.map((_, index) => (
              <div key={index} className={`dot ${index === currentSlide ? 'active' : ''}`} onClick={() => goToSlide(index)}></div>
            ))}
          </div>
        </section>
      ) : null}
      {!showProductsOnly && (
        <section className="welcome-container">
          <div className="welcome-content">
            <h1>Welcome to Bright Buy!</h1>
            <p>Discover amazing products at unbeatable prices.</p>
            <Link to="/products" className="shop-now-btn">Shop Now</Link>
          </div>
        </section>
      )}
      {!showProductsOnly && (
        <section className="about-us-container">
          <div className="about-us-content">
            <h2>About Us</h2>
            <p>At Bright Buy, we are committed to providing high-quality products and exceptional customer service. Our mission is to make shopping easy, fun, and affordable for everyone.</p>
          </div>
        </section>
      )}
      {showProductsOnly && (
        <div className="App-header" style={{ paddingTop: 8, paddingLeft: 0, paddingRight: 0, marginTop: 0 }}>
          <div className="bb-layout">
            {/* LEFT: Categories (sticky) */}
            <SidebarCategories categories={categories} />

            {/* RIGHT: Product content */}
            <div className="bb-content">
              <div className="bb-content-wrap">
                <h2 className="bb-heading">Our Products</h2>
                <div className="bb-heading-divider" />

                {/* existing product grid styles from your project */}
                <div className="product-grid">
                  {filtered.map((p) => {
                    const m = minPrice(p.variants);
                    return (
                      <div
                        key={p.product_id}
                        className="product-card"
                        onClick={() => openProduct(p.product_id)}
                      >
                        <img src={`http://localhost:5000${p.image}`} alt={p.product_name} className="product-card-image" />
                        <h3>{p.product_name}</h3>

                        {p.description && (
                          <p style={{ color: "#a3a3a3", marginTop: 4 }}>
                            {p.description.length > 80
                              ? p.description.slice(0, 80) + "…"
                              : p.description}
                          </p>
                        )}

                        <p style={{ marginTop: 6, fontWeight: 700 }}>
                          {m !== null ? `Starting at $${m.toFixed(2)}` : "See options"}
                        </p>
                      </div>
                    );
                  })}

                  {filtered.length === 0 && (
                    <div style={{ opacity: 0.8 }}>No products match your selection.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-left">
            <p>Contact Us</p>
            <p>Phone: (123) 456-7890</p>
            <p>Email: support@example.com</p>
            <p>FAX: (123) 456-7891</p>
          </div>
          <div className="footer-center">
            <p>&copy; 2025 Bright Buy. All rights reserved.</p>
          </div>
          <div className="footer-right">
            <Link to="/home" className="footer-link">Home</Link>
            <Link to="/products" className="footer-link">Our Products</Link>
          </div>
        </div>
      </footer>
    </>
  );
};

export default HomePage;
