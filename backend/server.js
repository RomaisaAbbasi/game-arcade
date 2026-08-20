import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import userRoutes from './routes/users.js';
import scoreRoutes from './routes/scores.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

// Routes
app.use('/api/users', userRoutes);
app.use('/api/scores', scoreRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Backend running on http://localhost:${PORT}`);
});