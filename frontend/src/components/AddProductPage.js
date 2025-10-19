// src/components/AddProductPage.js
import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const AddProductPage = () => {
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const [imageFile, setImageFile] = useState(null);
  const [imageName, setImageName] = useState("");
  const [imagePreview, setImagePreview] = useState(null);

  // --- 1. ADD 'price_at_purchase' TO STATE ---
  const [formData, setFormData] = useState({
    product_name: "",
    variant: "",
    category_id: "",
    stock_quantity: "",
    price: "",
    price_at_purchase: "", // <-- ADDED
    description: "",
  });
  const navigate = useNavigate();

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/admin/categories");
      setCategories(res.data || []);
    } catch (err) {
      console.error("Error fetching categories:", err);
      setError("Failed to load categories.");
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file)); 
      setImageName(file.name.replace(/\.[^.]+$/, ''));
    } else {
      setImageFile(null);
      setImagePreview(null);
      setImageName("");
    }
  };

  const handleSave = async () => {
    setError(""); 
    setIsUploading(true); 

    // --- 2. ADD 'price_at_purchase' TO VALIDATION ---
    const { product_name, variant, category_id, stock_quantity, price, price_at_purchase, description } = formData;

    if (!product_name || !variant || !category_id || !stock_quantity || !price || !price_at_purchase || !description || !imageFile || !imageName) {
      alert("Please fill in ALL fields, including an image name and file.");
      setIsUploading(false);
      return;
    }

    let imageUrl = "";

    try {
      const imageFormData = new FormData();
      imageFormData.append('desired_name', imageName); 
      imageFormData.append('image', imageFile); 

      const uploadRes = await axios.post("http://localhost:5000/api/admin/upload", imageFormData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (!uploadRes.data.success || !uploadRes.data.imageUrl) {
        throw new Error("Image upload failed.");
      }
      
      imageUrl = uploadRes.data.imageUrl;

    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.message || "Failed to upload image.";
      setError(errMsg);
      alert(errMsg);
      setIsUploading(false);
      return;
    }

    // --- 3. SEND FULL FORMDATA (it already includes price_at_purchase) ---
    const payload = {
      ...formData,
      image: imageUrl 
    };

    try {
      await axios.post("http://localhost:5000/api/admin/products", payload);
      alert("Product added successfully!");
      navigate("/admin"); 
    } catch (err) {
      console.error(err.response?.data || err.message);
      const errMsg = err.response?.data?.message || "Failed to save product.";
      setError(errMsg);
      alert(errMsg);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div style={{ padding: "20px", background: "#111827", color: "#fff", minHeight: "100vh" }}>
      <div style={styles.formContainer}>
        <h3>Add New Product</h3>

        {/* ... (product_name, description, variant, category, stock_quantity) ... */}
        
        <label>
          Product Name:
          <input type="text" name="product_name" value={formData.product_name} onChange={handleInputChange} style={styles.input} />
        </label>
        
        <label>
          Description:
          <textarea name="description" value={formData.description} onChange={handleInputChange} style={{...styles.input, height: '80px'}} />
        </label>

        <label>
          Variant (e.g., "Red, Large", "250g"):
          <input type="text" name="variant" value={formData.variant} onChange={handleInputChange} style={styles.input} />
        </label>
        
        <label>
          Category:
          <select name="category_id" value={formData.category_id} onChange={handleInputChange} style={styles.input}>
            <option value="">Select Category</option>
            {categories.map((c) => (
              <option key={c.category_id} value={c.category_id}>
                {c.name} 
              </option>
            ))}
          </select>
        </label>

         <label>
          Stock Quantity:
          <input type="number" name="stock_quantity" value={formData.stock_quantity} onChange={handleInputChange} style={styles.input} />
        </label>


        <label>
          Price (Selling Price):
          <input type="number" step="0.01" name="price" value={formData.price} onChange={handleInputChange} style={styles.input} />
        </label>
        
        {/* --- 4. ADD NEW JSX FIELD --- */}
        <label>
          Price at Purchase (Cost Price):
          <input type="number" step="0.01" name="price_at_purchase" value={formData.price_at_purchase} onChange={handleInputChange} style={styles.input} />
        </label>
        {/* --- END OF NEW FIELD --- */}
        
        <label>
          Image File:
          <input type="file" name="imageFile" accept="image/png, image/jpeg, image/jpg" onChange={handleFileChange} style={styles.input} />
        </label>

        <label>
          Image Name (for filename):
          <input type="text" name="imageName" placeholder="e.g., iphone-15-pro-blue" value={imageName} onChange={(e) => setImageName(e.target.value)} style={styles.input} />
        </label>
        
        {imagePreview && (
          <img src={imagePreview} alt="Preview" style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '4px' }} />
        )}

        {error && <p style={{ color: '#F87171' }}>{error}</p>}

        <div style={styles.modalButtons}>
          <button onClick={handleSave} style={styles.saveButton} disabled={isUploading}>
            {isUploading ? "Saving..." : "Add Product"}
          </button>
          <button onClick={() => navigate('/admin')} style={styles.cancelButton}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

// --- (Keep your 'styles' object here) ---
const styles = {
  formContainer: {
    background: "#1F2937",
    padding: "20px",
    borderRadius: "8px",
    maxWidth: "600px",
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: "15px",
    color: "#fff",
  },
  input: {
    width: "100%",
    padding: "8px",
    borderRadius: "4px",
    border: "1px solid #ccc",
    marginTop: "5px",
    background: "#111827",
    color: "#fff",
    boxSizing: "border-box", 
  },
  modalButtons: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
  },
  saveButton: {
    padding: "6px 12px",
    background: "#10B981",
    color: "#fff",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
  },
  cancelButton: {
    padding: "6px 12px",
    background: "#B91C1C",
    color: "#fff",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
  },
};

export default AddProductPage;