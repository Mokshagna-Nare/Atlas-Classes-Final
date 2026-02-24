require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const aiRoutes = require('./routes/ai');
const instituteRoutes = require('./routes/institutes');

const app = express();

/**
 * CORS (DEV)
 * origin: true => reflect request Origin (works well for localhost dev)
 * credentials: true => allows Authorization header / cookies if ever used
 */
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'https://www.atlasclasses.com',
    'https://atlasclasses.com'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};



// IMPORTANT: CORS must be before routes
app.use(cors(corsOptions));
// Explicitly handle preflight across-the-board
app.options('*', cors(corsOptions)); // helpful when browsers send OPTIONS preflight [web:84][web:96]

app.use(express.json({ limit: '50mb' }));

// Quick request logger (temporary, helps verify requests reach backend)
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} | Origin: ${req.headers.origin}`);
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/institutes', instituteRoutes);

// Health Check
app.get('/', (req, res) => {
  res.send('Atlas Classes Backend (Supabase) is running');
});

// If we are not on Vercel (local dev), listen to the port
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5001;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

// Export the app for Vercel serverless functions
module.exports = app;

