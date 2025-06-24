require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// Debug logging for Railway
console.log('🔍 Environment variables:');
console.log('PORT:', process.env.PORT);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('🔑 Supabase URL:', process.env.SUPABASE_URL ? 'Configured' : 'Missing');
console.log('🔑 Supabase Service Role Key:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Configured' : 'Missing');

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Liiga palju päringuid, proovi hiljem uuesti'
});
app.use(limiter);

// CORS configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? true // Allow all origins in production for Expo Go compatibility
    : ['http://localhost:8081', 'http://localhost:19006', 'exp://localhost:8081', 'http://192.168.0.24:8081'],
  credentials: true
};
app.use(cors(corsOptions));

// Increase JSON payload limit for image uploads
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Make supabase available globally
global.supabase = supabase;

// Import routes after setting up supabase
const userRoutes = require('./routes/user');
const friendsRoutes = require('./routes/friends');
const plansRoutes = require('./routes/plans');

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`📡 ${req.method} ${req.path} - ${new Date().toISOString()}`);
  next();
});

// Health check endpoint
app.get('/', (req, res) => {
  console.log('🏥 Health check requested');
  res.json({ 
    message: 'Free to Hang API töötab!',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    port: PORT,
    env: process.env.NODE_ENV
  });
});

// API routes
app.use('/api/user', userRoutes);
app.use('/api/friends', friendsRoutes);
app.use('/api/plans', plansRoutes);

// 404 handler
app.use('*', (req, res) => {
  console.log('❌ 404 endpoint not found:', req.method, req.originalUrl);
  res.status(404).json({ error: 'Endpoint ei leitud' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err.stack);
  res.status(500).json({ error: 'Serveri viga' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server töötab pordil ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://0.0.0.0:${PORT}`);
  console.log(`📡 Server kuulab kõikidel IP-del pordil ${PORT}`);
});

// Export supabase for use in routes
module.exports = { supabase }; 