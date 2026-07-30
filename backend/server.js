const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Import the routing configurations
const authRoutes = require('./routes/authRoutes');
// NOTE: Fix the spelling if your file matches the screenshot typo: './routes/couresRoutes'
const courseRoutes = require('./routes/courseRoutes'); 
const adminRoutes = require('./routes/adminRoutes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json()); // Parses incoming JSON body payloads

// Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/admin', adminRoutes);

// Fallback error handler for unhandled operational routes
app.use((req, res) => {
  res.status(404).json({ message: 'API route not found' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Backend server running live on port ${PORT}`);
});