const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    steamId: { 
        type: String, 
        required: true, 
        unique: true,
        lowercase: true, 
        trim: true     

    },
    personaname: String,
    avatarUrl: String,
    lastUpdated: { 
        type: Date, 
        default: Date.now 
    },
    stats: {
        totalGames: Number,
        gamesWithAchievements: Number,
        totalAchievements: Number,
        totalPossibleAchievements: Number,
        achievementPercentage: Number,
        totalPlaytime: Number
    }
});

userSchema.pre('save', function(next) {
    if (this.steamId) {
        this.steamId = this.steamId.toLowerCase();
    }
    next();
});

// userSchema.index({ steamId: 1 });
userSchema.index({ 'stats.achievementPercentage': -1 });
userSchema.index({ 'stats.totalAchievements': -1 });
userSchema.index({ 'stats.totalPlaytime': -1 });


module.exports = mongoose.model('User', userSchema);