require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// Debug logging for Railway (updated for read receipts deployment)
console.log('🔍 Environment variables:');
console.log('PORT:', process.env.PORT);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('🔑 Supabase URL:', process.env.SUPABASE_URL ? 'Configured' : 'Missing');
console.log('🔑 Supabase Service Role Key:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Configured' : 'Missing');
console.log('🔑 Supabase Anon Key:', process.env.SUPABASE_ANON_KEY ? 'Configured' : 'Missing');
console.log('🔁 Active project:', (process.env.SUPABASE_ACTIVE_PROJECT || 'KOZIPPP').toUpperCase());

// Allow selecting between multiple Supabase projects via SUPABASE_ACTIVE_PROJECT
const ACTIVE = (process.env.SUPABASE_ACTIVE_PROJECT || 'KOZIPPP').toUpperCase();
const resolveEnv = (base, fallback) => process.env[base] || process.env[fallback];

const SUPABASE_URL = resolveEnv(`SUPABASE_URL_${ACTIVE}`, 'SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = resolveEnv(`SUPABASE_SERVICE_ROLE_KEY_${ACTIVE}`, 'SUPABASE_SERVICE_ROLE_KEY');
const SUPABASE_ANON_KEY = resolveEnv(`SUPABASE_ANON_KEY_${ACTIVE}`, 'SUPABASE_ANON_KEY');

console.log('🔧 Resolved Supabase URL (active):', SUPABASE_URL ? 'OK' : 'MISSING');
console.log('🔧 Resolved Service Key (active):', SUPABASE_SERVICE_ROLE_KEY ? 'OK' : 'MISSING');
console.log('🔧 Resolved Anon Key (active):', SUPABASE_ANON_KEY ? 'OK' : 'MISSING');

// Check for required environment variables
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables:');
  if (!SUPABASE_URL) console.error('   - SUPABASE_URL or SUPABASE_URL_' + ACTIVE);
  if (!SUPABASE_SERVICE_ROLE_KEY) console.error('   - SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE_KEY_' + ACTIVE);
  console.error('🚨 Server will start but Supabase functionality will be disabled');
}

// Check for JWT validation key
if (!SUPABASE_ANON_KEY) {
  console.warn('⚠️ SUPABASE_ANON_KEY not found, using hardcoded fallback for JWT validation');
}

// Security middleware
app.use(helmet());

// Trust proxy for rate limit behind Railway/Proxies
app.set('trust proxy', 1);

// Rate limiting - increased for mobile app usage
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // limit each IP to 500 requests per windowMs (increased from 100)
  message: 'Liiga palju päringuid, proovi hiljem uuesti',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip
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

// Supabase client with error handling
let supabase = null;
try {
  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    supabase = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY
    );
    console.log('✅ Supabase client initialized');
  } else {
    console.log('⚠️ Supabase client not initialized - missing environment variables');
  }
} catch (error) {
  console.error('❌ Failed to initialize Supabase client:', error.message);
}

// Make supabase available globally
global.supabase = supabase;

// Ensure required storage bucket exists (best-effort, idempotent)
async function ensureStorageSetup() {
  if (!supabase) return;
  try {
    const { data: bucket, error: getError } = await supabase.storage.getBucket('avatars');
    if (getError) {
      console.log('ℹ️ getBucket error (continuing):', getError.message);
    }
    if (!bucket) {
      console.log('🪣 Creating avatars bucket');
      const { error: createError } = await supabase.storage.createBucket('avatars', {
        public: true,
        fileSizeLimit: 5 * 1024 * 1024,
        allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
      });
      if (createError) {
        console.log('ℹ️ Could not create avatars bucket:', createError.message);
      } else {
        console.log('✅ Avatars bucket ensured');
      }
    }
  } catch (e) {
    console.log('ℹ️ Bucket ensure skipped (best-effort):', e.message);
  }
}

ensureStorageSetup();

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
    version: '1.0.1',
    timestamp: new Date().toISOString(),
    port: PORT,
    env: process.env.NODE_ENV,
    supabase: supabase ? 'Connected' : 'Not connected',
    debug: 'Authentication debugging enabled',
    plans_backend: 'Ready - call /api/setup-plans to initialize database'
  });
});

// Import routes after setting up supabase
// NOTE: We removed try-catch to ensure server crashes if routes are broken (better for debugging in Railway)
const userRoutes = require('./routes/user');
const friendsRoutes = require('./routes/friends');
const plansRoutes = require('./routes/plans');
const storageRoutes = require('./routes/storage');
const chatRoutes = require('./routes/chat');
const notificationRoutes = require('./routes/notifications');

// API routes
app.use('/api/user', userRoutes);
app.use('/api/friends', friendsRoutes);
app.use('/api/plans', plansRoutes);
app.use('/api/storage', storageRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/notifications', notificationRoutes);

console.log('✅ Routes loaded successfully');

// Start plan scheduler if supabase is available
if (supabase) {
  try {
    const scheduler = require('./services/scheduler');
    scheduler.start();

    const { startEngagementScheduler } = require('./services/engagementService');
    startEngagementScheduler();

    // Graceful shutdown for scheduler
    process.on('SIGTERM', () => {
      console.log('🛑 SIGTERM received, stopping scheduler...');
      scheduler.stop();
    });

    process.on('SIGINT', () => {
      console.log('🛑 SIGINT received, stopping scheduler...');
      scheduler.stop();
    });
  } catch (error) {
    console.error('❌ Failed to start scheduler:', error.message);
  }
} else {
  console.log('⚠️ Supabase not available, scheduler will not start');
}

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

// Start server with error handling
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server töötab pordil ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://0.0.0.0:${PORT}`);
  console.log(`📡 Server kuulab kõikidel IP-del pordil ${PORT}`);
});

// Handle server errors
server.on('error', (error) => {
  console.error('❌ Server failed to start:', error.message);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

// Export supabase for use in routes
module.exports = { supabase }; 