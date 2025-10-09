import React, { useState, useEffect } from 'react';
import axios from 'axios';

const Shop = () => {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);

  useEffect(() => {
    axios.get('http://localhost:5000/api/products/categories').then(res => setCategories(res.data));
  }, []);

  useEffect(() => {
    const url = selectedCategory ? `http://localhost:5000/api/products?category_id=${selectedCategory}` : 'http://localhost:5000/api/products';
    axios.get(url).then(res => setProducts(res.data));
  }, [selectedCategory]);

  return (
    <div>
      <h1>Shop</h1>
      <div>
        <h2>Categories</h2>
        {categories.map(cat => (
          <button key={cat.category_id} onClick={() => setSelectedCategory(cat.category_id)}>
            {cat.name}
          </button>
        ))}
      </div>
      <div className="product-list">
        {products.map(prod => (
          <div key={prod.product_id} className="product">
            <h2>{prod.name}</h2>
            <p>Price: ${prod.price}</p>
            <Link to={`/product/${prod.product_id}`}>View Details</Link>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Shop;