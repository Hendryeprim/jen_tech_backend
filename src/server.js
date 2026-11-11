const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const errorHandler = require('./middleware/errorHandler');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Configure CORS (always allow same-origin requests so static module scripts work in production)
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000', `http://localhost:${PORT}`];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  const hostOrigin = req.headers.host ? `${req.protocol}://${req.headers.host}` : null;
  cors({
    origin: (reqOrigin, callback) => {
      if (!reqOrigin) return callback(null, true);
      if (hostOrigin && reqOrigin === hostOrigin) return callback(null, true);
      if (allowedOrigins.includes(reqOrigin) || process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }
      return callback(new Error('CORS policy: Not allowed by CORS'));
    },
    credentials: true,
  })(req, res, next);
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    system: 'JEN TECH UPVC Window Billing & Quotation Management System',
    timestamp: new Date().toISOString(),
  });
});

// Mount Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/customers', require('./routes/customerRoutes'));
app.use('/api/profiles', require('./routes/profileRoutes'));
app.use('/api/window-types', require('./routes/windowTypeRoutes'));
app.use('/api/additional-charges', require('./routes/additionalChargeRoutes'));
app.use('/api/quotations', require('./routes/quotationRoutes'));
app.use('/api/invoices', require('./routes/invoiceRoutes'));
app.use('/api/settings', require('./routes/settingsRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/calculator', require('./routes/calculatorRoutes'));
app.use('/api/customer-reports', require('./routes/customerReportRoutes'));
app.use('/api/way-bills', require('./routes/wayBillRoutes'));

// API 404 handler
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// Serve built frontend in unified production deployment if dist exists
const frontendDistPath = path.resolve(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));
  app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
}

// 404 handler for non-API routes when frontend dist isn't present
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// Central error handler
app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  const { pool } = require('./config/db');
  // Ensure customers.mobile_number allows NULL for flexible calculator quotes
  pool.query('ALTER TABLE customers ALTER COLUMN mobile_number DROP NOT NULL').catch(() => {});

  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🚀 JEN TECH Backend API Server running on port ${PORT}`);
    console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 Health Check: http://localhost:${PORT}/api/health`);
    console.log(`=======================================================`);
  });
}

module.exports = app;
