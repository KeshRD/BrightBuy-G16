// src/components/SidebarCategories.js
import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./sidebar.css";

export default function SidebarCategories({ categories = [] }) {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const activeCategory = params.get("category") || "All";

  // Handle click on each category
  const handleClick = (category) => {
    const newParams = new URLSearchParams(location.search);
    if (!category || category === "All") {
      newParams.delete("category");
    } else {
      newParams.set("category", category);
    }

    // ✅ Navigate to /products page, not /home
    const queryString = newParams.toString();
    navigate(`/products${queryString ? `?${queryString}` : ""}`);
  };

  return (
    <aside className="bb-sidebar">
      <h3 className="bb-sidebar-header">Categories</h3>

      {/* "All" option */}
      <button
        className={`bb-cat ${activeCategory === "All" ? "active" : ""}`}
        onClick={() => handleClick("All")}
      >
        All
      </button>

      {/* Dynamic category list */}
      <div className="bb-cat-list">
        {categories.map((cat) => (
          <button
            key={cat}
            className={`bb-cat ${activeCategory === cat ? "active" : ""}`}
            onClick={() => handleClick(cat)}
          >
            {cat}
          </button>
        ))}
      </div>
    </aside>
  );
}
