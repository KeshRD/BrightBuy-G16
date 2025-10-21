// backend/utils/emailService.js
const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  service: 'gmail', // or your mail service
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendOrderConfirmationEmail(to, order) {
  const itemsHtml = order.items
    .map(
      (i) => `
      <li>${i.product_name} (${i.variant_name}) — Qty: ${i.quantity} — $${i.price}</li>
    `
    )
    .join('');

  const htmlContent = `
    <h2>Order Confirmation - Order #${order.order_id}</h2>
    <p>Dear Customer,</p>
    <p>Your order has been <b>confirmed</b>! Here are your order details:</p>
    <ul>${itemsHtml}</ul>
    <p><b>Total:</b> $${order.total_price}</p>
    <p><b>Delivery Address:</b> ${order.delivery_address}</p>
    <p>We’ll notify you once your order is shipped.</p>
    <br>
    <p>— BrightBuy Team</p>
  `;

  await transporter.sendMail({
    from: `"BrightBuy" <${process.env.EMAIL_USER}>`,
    to,
    subject: `Your Order #${order.order_id} is Confirmed`,
    html: htmlContent,
  });

  console.log(`✅ Order confirmation email sent to ${to}`);
}

module.exports = { sendOrderConfirmationEmail };
