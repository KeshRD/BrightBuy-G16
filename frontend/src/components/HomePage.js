import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { useNavigate, useLocation } from "react-router-dom";
import Navbar from "./Navbar";
import SidebarCategories from "./SidebarCategories";
import "./sidebar.css";

/* Read query params */
function useQueryParams() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

const HomePage = () => {
  const [products, setProducts] = useState([]);
  const navigate = useNavigate();
  const params = useQueryParams();

  const query = (params.get("query") || "").toLowerCase();
  const category = params.get("category") || "";

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

      {/* snug under navbar: remove big gap */}
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
                      <img
                        src={p.image || ""}
                        alt={p.product_name}
                        className="product-card-image"
                      />
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
    </>
  );
};

export default HomePage;
