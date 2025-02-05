// User.js
const mongoose = require("mongoose");
const { cleanSteamId } = require("../utils/steamUtils");

const userSchema = new mongoose.Schema({
  steamId: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    set: cleanSteamId,
  },
  personaname: String,
  avatarUrl: String,
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
  stats: {
    totalGames: Number,
    completedGames: Number,
    gamesWithAchievements: Number,
    totalAchievements: Number,
    totalPossibleAchievements: Number,
    achievementPercentage: Number,
    totalPlaytime: Number,
  },
});

// Pre-save middleware to ensure steamId is clean
userSchema.pre("save", function (next) {
  if (this.steamId) {
    this.steamId = cleanSteamId(this.steamId);
  }
  next();
});

userSchema.index({ "stats.achievementPercentage": -1 });
userSchema.index({ "stats.totalAchievements": -1 });
userSchema.index({ "stats.totalPlaytime": -1 });

module.exports = mongoose.model("User", userSchema);
