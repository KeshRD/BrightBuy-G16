import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { CartContext } from '../context/CartContext';

const Cart = () => {
  const { cart, removeFromCart } = useContext(CartContext);
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <div>
      <h1>Cart</h1>
      {cart.map(item => (
        <div key={item.variant_id}>
          <p>{item.name} - ${item.price} x {item.quantity}</p>
          <button onClick={() => removeFromCart(item.variant_id)}>Remove</button>
        </div>
      ))}
      <p>Total: ${total}</p>
      <Link to="/checkout">Checkout</Link>
    </div>
  );
};

export default Cart;