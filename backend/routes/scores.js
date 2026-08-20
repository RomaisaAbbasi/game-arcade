import express from 'express';
import User from '../models/User.js';

const router = express.Router();

// Update score for a specific game
router.put('/:name/:game', async (req, res) => {
  try {
    const { name, game } = req.params;
    const { scoreData } = req.body; // game-specific data

    const user = await User.findOne({ name });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Update the relevant game's stats
    if (!user.scores[game]) user.scores[game] = {};
    const current = user.scores[game];

    // Merge new data (only if better)
    for (const key in scoreData) {
      if (scoreData[key] > (current[key] || 0)) {
        current[key] = scoreData[key];
      }
    }
    await user.save();
    res.json({ name: user.name, scores: user.scores });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;