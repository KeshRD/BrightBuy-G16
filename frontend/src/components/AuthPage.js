import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './AuthPage.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('Registered Customer');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  // Auto-redirect if already logged in
  useEffect(() => {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (token && user) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      if (user.role === 'Admin') navigate('/admin');
      else if (user.role === 'Delivery Driver') navigate('/driver');
      else navigate('/home');
    }
  }, [navigate]);

  const clearMessages = () => {
    setError('');
    setSuccessMsg('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearMessages();
    setLoading(true);

    if (isLogin) {
      // LOGIN
      try {
        const response = await axios.post(`${API_URL}/login`, { email, password });

        if (response.data && response.data.success) {
          const user = response.data.user;
          localStorage.setItem('token', response.data.token);
          localStorage.setItem('user', JSON.stringify(user));
          axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;

          if (user.role === 'Admin') navigate('/admin');
          else if (user.role === 'Delivery Driver') navigate('/driver');
          else navigate('/home');
        } else {
          setError(response.data?.message || 'Please enter valid credentials.');
        }
      } catch (err) {
        console.error('Login error', err);
        setError(err.response?.data?.message || 'Login failed. Please try again.');
      } finally {
        setLoading(false);
      }
    } else {
      // SIGNUP
      if (!name || !email || !password || !phone || !role) {
        setError('Please fill all fields.');
        setLoading(false);
        return;
      }

      try {
        const response = await axios.post(`${API_URL}/signup`, {
          name,
          email,
          password,
          phone,
          role,
        });

        if (response.data && response.data.success) {
          setIsLogin(true);
          setSuccessMsg('Signup successful! Please login.');
          // clear signup fields but keep email for convenience
          setName('');
          setPhone('');
          setPassword('');
        } else {
          setError(response.data?.message || 'Signup failed.');
        }
      } catch (err) {
        console.error('Signup error', err);
        setError(err.response?.data?.message || 'Signup failed. Please try again.');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-overlay" />
      <div className="auth-container" role="main" aria-live="polite">
        <div className="auth-card">
          <div className="auth-header">
            <img src="/images/logo-light.png" alt="Logo" className="auth-logo" onError={(e)=>{e.currentTarget.style.display='none'}} />
            <h1>{isLogin ? 'Welcome Back' : 'Create an Account'}</h1>
            <p className="subtitle">{isLogin ? 'Sign in to continue to Bright-Buy' : 'Register to start using Bright-Buy'}</p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            {!isLogin && (
              <>
                <label className="label">
                  <span className="label-text">Full name</span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jane Doe"
                    className="input"
                    required={!isLogin}
                    aria-label="Full name"
                  />
                </label>

                <label className="label">
                  <span className="label-text">Phone</span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+94 77 123 4567"
                    className="input"
                    required={!isLogin}
                    aria-label="Phone"
                  />
                </label>

                <label className="label">
                  <span className="label-text">Role</span>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="input select"
                    aria-label="Role"
                  >
                    <option value="Registered Customer">Registered Customer</option>
                    <option value="Admin">Admin</option>
                    <option value="Delivery Driver">Delivery Driver</option>
                  </select>
                </label>
              </>
            )}

            <label className="label">
              <span className="label-text">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="input"
                required
                aria-label="Email"
              />
            </label>

            <label className="label">
              <span className="label-text">Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="input"
                required
                aria-label="Password"
              />
            </label>

            <button type="submit" className="btn primary" disabled={loading}>
              {loading ? (isLogin ? 'Signing in...' : 'Creating account...') : (isLogin ? 'Login' : 'Sign up')}
            </button>

            <div className="meta-row">
              <button
                type="button"
                className="link-btn"
                onClick={() => { clearMessages(); setIsLogin(!isLogin); }}
              >
                {isLogin ? 'Need an account? Create one' : 'Have an account? Login'}
              </button>
            </div>

            {successMsg && <div className="message success" role="status">{successMsg}</div>}
            {error && <div className="message error" role="alert">{error}</div>}
          </form>

          <footer className="auth-footer">
            <small>By continuing you agree to our <u>Terms</u> & <u>Privacy</u>.</small>
          </footer>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
