import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import Navbar from './Navbar'; // FIX: Added the missing import for the Navbar

const HomePage = ({ showProductsOnly }) => {
  const [products, setProducts] = useState([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const navigate = useNavigate();

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
    if (!localStorage.getItem('token')) {
      navigate('/');
      return;
    }

    const fetchProducts = async () => {
      try {
        const response = await axios.get('http://localhost:5000/products');
        setProducts(response.data);
      } catch (err) {
        console.error('Error fetching products:', err);
      }
    };
    fetchProducts();
  }, [navigate]);

  // FIX: Added the missing function definition
  const handleProductClick = (productId) => {
    navigate(`/product/${productId}`);
  };

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
      <main className="page-main" style={{ paddingTop: '96px' }}>
        {!showProductsOnly ? (
          <section className="hero" aria-label="Welcome banner">
            <div className="hero-inner">
              <h1 className="hero-title">Welcome to our store</h1>
              <p className="hero-sub">Discover curated products with modern design and clean, spacious layouts.</p>
              <div className="hero-cta-row">
                <button className="cta" onClick={() => navigate('/products')}>Shop Now</button>
              </div>
            </div>
          </section>
        ) : null}

        {!showProductsOnly ? (
          <section className="about-us" aria-label="About Us">
            <div className="container">
              <h2>About Us</h2>
              <p className="about-text">We are dedicated to providing high-quality products with a focus on customer satisfaction.</p>
              <p className="about-text">Our team works tirelessly to curate the best items for your needs.</p>
              <p className="about-text">Thank you for choosing us for your shopping experience.</p>
            </div>
          </section>
        ) : null}



        {showProductsOnly && (
          <section className="products-section container" aria-label="All products">
            <h2 className="section-title">Our Products</h2>
            <div className="product-grid">
              {products.map((product) => (
                <article key={product.product_id} className="product-card" role="button" tabIndex={0} onClick={() => handleProductClick(product.product_id)} onKeyDown={(e) => e.key === 'Enter' && handleProductClick(product.product_id)}>
                  <img src={`http://localhost:5000${product.image}`} alt={product.product_name} className="product-card-image" />
                  <div className="meta">
                    <h3 className="title">{product.product_name}</h3>
                    <p className="desc">{product.description}</p>
                    <p className="price">Starting at: ${product.variants && product.variants.length > 0 ? Math.min(...product.variants.map(v => v.price)).toFixed(2) : 'N/A'}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </main>
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

