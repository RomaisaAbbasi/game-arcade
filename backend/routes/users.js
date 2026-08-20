import express from 'express';
import User from '../models/User.js';

const router = express.Router();

// Create or get user (login)
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
    const cleanName = name.trim();
    let user = await User.findOne({ name: cleanName });
    if (!user) {
      user = new User({ name: cleanName });
      await user.save();
    }
    res.json({ name: user.name, scores: user.scores });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;