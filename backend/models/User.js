import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  scores: {
    // ---- Space Jump ----
    spaceJump: {
      highScore: { type: Number, default: 0 },
      level: { type: Number, default: 1 }
    },
    // ---- Memory Flip ----
    memoryFlip: {
      bestScore: { type: Number, default: 0 },
      bestTime: { type: Number, default: 0 },
      bestMoves: { type: Number, default: 0 },
      bestAccuracy: { type: Number, default: 0 },
      bestEfficiency: { type: Number, default: 0 }
    },
    // ---- 2048 Plus ----
    twothousandFortyEight: {
      bestScore: { type: Number, default: 0 },
      highestTile: { type: Number, default: 0 },
      gamesPlayed: { type: Number, default: 0 },
      gamesWon: { type: Number, default: 0 },
      bestMovesTo2048: { type: Number, default: 0 }
    },
    // ---- Cozy Cake Factory ----
    cozyCakeFactory: {
      bestScore: { type: Number, default: 0 },
      highestLevel: { type: Number, default: 0 },
      totalPerfectCakes: { type: Number, default: 0 },
      bestEfficiency: { type: Number, default: 0 },
      highestCombo: { type: Number, default: 0 }
    },
    // ---- Word Hunt ----
    wordHunt: {
      easyScore: { type: Number, default: 0 },
      easyStars: { type: Number, default: 0 },
      mediumScore: { type: Number, default: 0 },
      mediumStars: { type: Number, default: 0 },
      hardScore: { type: Number, default: 0 },
      hardStars: { type: Number, default: 0 },
      bestAccuracy: { type: Number, default: 0 },
      bestCombo: { type: Number, default: 0 },
      gamesPlayed: { type: Number, default: 0 }
    },
   // ---- Bubble Blast ----
bubbleBlast: {
  bestScore: { type: Number, default: 0 },
  highestLevel: { type: Number, default: 0 },
  totalStars: { type: Number, default: 0 },
  gamesPlayed: { type: Number, default: 0 }
}
  }
});

const User = mongoose.model('User', userSchema);
export default User;