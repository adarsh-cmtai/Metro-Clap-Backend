const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');
const authRoutes = require('./modules/auth/authRoutes');
const locationRoutes = require('./modules/location/locationRoutes');
const serviceRoutes = require('./modules/services/serviceRoutes');
const adminRoutes = require('./modules/admin/adminRoutes');
const customerRoutes = require('./modules/customer/customerRoutes');
const proRoutes = require('./modules/pro/proRoutes');
const applicationRoutes = require('./modules/partner-application/applicationRoutes');
const cartRoutes = require('./modules/cart/cartRoutes');
const paymentRoutes = require('./modules/payment/paymentRoutes');
const blogRoutes = require('./modules/blog/blogRoutes');
const adminBlogRoutes = require('./modules/admin/adminBlogRoutes');

dotenv.config();
if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    console.error("FATAL ERROR: Razorpay Key ID and Key Secret are not defined in the .env file.");
    process.exit(1);
}
connectDB();


const app = express();

// CORS setup
app.use(cors({
  origin:'http://localhost:3000',
  credentials: true
}));

app.use(express.json());

app.get('/', (req, res) => {
  res.send('API is running...');
});

app.use('/api/auth', authRoutes);
app.use('/api/location', locationRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/pro', proRoutes);
app.use('/api/partner-applications', applicationRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/blog', blogRoutes);
app.use('/api/admin/blog', adminBlogRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
