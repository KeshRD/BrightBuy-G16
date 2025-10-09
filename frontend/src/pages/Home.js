import React from 'react';
import { Link } from 'react-router-dom';

const Home = () => (
  <div>
    <h1>Welcome to BrightBuy</h1>
    <Link to="/shop">Shop Now</Link>
  </div>
);

export default Home;