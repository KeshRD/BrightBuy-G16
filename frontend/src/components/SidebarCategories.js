// src/components/SidebarCategories.js
import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./sidebar.css";

export default function SidebarCategories({ categories }) {
  const navigate = useNavigate();
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const activeCategory = params.get("category") || "All";

  // Navigate to /home?category=...
  const handleClick = (category) => {
    const newParams = new URLSearchParams(search);
    if (!category || category === "All") {
      newParams.delete("category");
    } else {
      newParams.set("category", category);
    }
    navigate(`/home?${newParams.toString()}`);
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
