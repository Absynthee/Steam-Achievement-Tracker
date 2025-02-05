const express = require("express");
const User = require("./models/User");
const cors = require("cors");
const axios = require("axios");
const path = require("path");
const NodeCache = require("node-cache");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();
const { cleanSteamId } = require("./utils/steamUtils");

// Enable CORS
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, "../public")));

mongoose
  .connect(process.env.MONGODB_URI, {})
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

mongoose.connection.on("error", (err) => {
  console.error("MongoDB connection error:", err);
});

mongoose.connection.on("connected", () => {
  console.log("MongoDB connected");
});

function clearLeaderboardCache() {
  const keys = cache.keys();
  const leaderboardKeys = keys.filter((key) => key.startsWith("leaderboard_"));
  cache.del(leaderboardKeys);
  console.log("Cleared leaderboard cache");
}

// Test endpoint for MongoDB connection
app.get("/api/db-status", (req, res) => {
  res.json({
    connected: mongoose.connection.readyState === 1,
    state: mongoose.connection.readyState,
  });
});

// Update the users endpoint
app.post("/api/users", async (req, res) => {
  try {
    console.log("Received request body:", req.body);

    if (!req.body || !req.body.steamId) {
      return res.status(400).json({
        success: false,
        error: "Missing required user data",
      });
    }

    const User = require("./models/User");

    const userData = {
      steamId: req.body.steamId,
      personaname: req.body.personaname,
      avatarUrl: req.body.avatarUrl,
      stats: req.body.stats,
      lastUpdated: new Date(),
    };

    console.log("Processing user data:", userData);

    const user = await User.findOneAndUpdate(
      { steamId: userData.steamId },
      userData,
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );
    clearLeaderboardCache();

    console.log("Saved user:", user);
    res.json({ success: true, user });
  } catch (error) {
    console.error("Error saving user:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Add new endpoints for leaderboard
const cache = new NodeCache({ stdTTL: 60 }); // Cache for 60 seconds

app.get("/api/leaderboard", async (req, res) => {
  try {
    console.log("Fetching leaderboard...");
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const sortBy = req.query.sortBy || "total";
    const skip = (page - 1) * limit;

    // Create cache key including all parameters
    const cacheKey = `leaderboard_${page}_${limit}_${sortBy}`;

    // Check cache first
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      console.log("Returning cached leaderboard data");
      return res.json(cachedData);
    }

    const User = require("./models/User");

    // Define sort options
    let sortOption = {};
    switch (sortBy) {
      case "percentage":
        sortOption = { "stats.achievementPercentage": -1 };
        break;
      case "total":
        sortOption = { "stats.totalAchievements": -1 };
        break;
      case "games":
        sortOption = { "stats.totalGames": -1 };
        break;
      case "completed":
        sortOption = { "stats.completedGames": -1 };
        break;
      case "playtime":
        sortOption = { "stats.totalPlaytime": -1 };
        break;
      case "name":
        sortOption = { personaname: 1 };
        break;
      default:
        sortOption = { "stats.totalAchievements": -1 };
    }

    // Add secondary sort to maintain consistent ordering
    sortOption.personaname = 1;

    const [users, total] = await Promise.all([
      User.find().sort(sortOption).skip(skip).limit(limit).lean().exec(),
      User.countDocuments(),
    ]);

    console.log(`Found ${users.length} users on page ${page}`);

    const response = {
      success: true,
      users,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };

    // Store in cache
    cache.set(cacheKey, response);
    console.log(`Cached leaderboard data for key: ${cacheKey}`);

    res.json(response);
  } catch (error) {
    console.error("Leaderboard error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.get("/api/cleanup-steam-ids", async (req, res) => {
  try {
    const User = require("./models/User");
    const users = await User.find();
    let updates = 0;
    let duplicates = 0;

    const processedIds = new Map();

    for (const user of users) {
      const originalId = user.steamId;
      const cleanedId = cleanSteamId(originalId);

      if (cleanedId !== originalId) {
        if (processedIds.has(cleanedId)) {
          await User.findByIdAndDelete(user._id);
          duplicates++;
          continue;
        }

        // Update the user with cleaned ID
        await User.findByIdAndUpdate(user._id, { steamId: cleanedId });
        updates++;
      }

      processedIds.set(cleanedId, user._id);
    }

    res.json({
      success: true,
      message: `Updated ${updates} users and removed ${duplicates} duplicates`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Rate limiting helper
const rateLimiter = {
  requests: {},
  reset: function () {
    this.requests = {};
  },
  check: function (ip) {
    const now = Date.now();
    if (!this.requests[ip]) {
      this.requests[ip] = {
        count: 1,
        lastReset: now,
      };
      return true;
    }

    // Reset counter after 1 minute
    if (now - this.requests[ip].lastReset > 60000) {
      this.requests[ip] = {
        count: 1,
        lastReset: now,
      };
      return true;
    }

    if (this.requests[ip].count >= 5000) {
      // 5000 requests per minute
      return false;
    }

    this.requests[ip].count++;
    return true;
  },
};

// Reset rate limiter every minute
setInterval(() => rateLimiter.reset(), 60000);

// Middleware for rate limiting
const checkRateLimit = (req, res, next) => {
  const ip = req.ip;
  if (!rateLimiter.check(ip)) {
    return res.status(429).json({ error: "Too many requests" });
  }
  next();
};

app.get("/api/update-completed-games", async (req, res) => {
  try {
    const User = require("./models/User");
    const users = await User.find();
    let updatedCount = 0;

    for (const user of users) {
      if (user.stats && Array.isArray(user.stats.games)) {
        const completedGames = user.stats.games.filter(
          (game) => game.achievements?.percentage === 100
        ).length;

        await User.findByIdAndUpdate(user._id, {
          $set: { "stats.completedGames": completedGames },
        });

        updatedCount++;
      }
    }

    res.json({
      success: true,
      message: `Updated ${updatedCount} users with completed games count`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Steam API endpoints
app.get(
  "/api/steam/resolve-vanity/:vanityUrl",
  checkRateLimit,
  async (req, res) => {
    try {
      const vanityUrl = req.params.vanityUrl;
      const cacheKey = `vanity_${vanityUrl}`;

      // Check cache
      const cachedId = cache.get(cacheKey);
      if (cachedId) {
        return res.json({ steamId: cachedId });
      }

      const response = await axios.get(
        `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=${process.env.STEAM_API_KEY}&vanityurl=${vanityUrl}`
      );

      if (response.data.response.success === 1) {
        const steamId = response.data.response.steamid;
        cache.set(cacheKey, steamId);
        res.json({ steamId: steamId });
      } else {
        res.status(404).json({ error: "Vanity URL not found" });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

app.get(
  "/api/steam/ISteamUser/GetPlayerSummaries/v2/",
  checkRateLimit,
  async (req, res) => {
    try {
      const steamids = req.query.steamids;
      const cacheKey = `player_${steamids}`;

      const cachedData = cache.get(cacheKey);
      if (cachedData) {
        return res.json(cachedData);
      }

      const response = await axios.get(
        `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${process.env.STEAM_API_KEY}&steamids=${steamids}`
      );

      cache.set(cacheKey, response.data);
      res.json(response.data);
    } catch (error) {
      // console.error("Steam API Error:", error.response?.data || error.message);
      res.status(500).json({
        error: "Error fetching user profile",
        details: error.response?.data || error.message,
      });
    }
  }
);

// Generic Steam API proxy
app.get("/api/steam/*", checkRateLimit, async (req, res) => {
  try {
    const steamPath = req.params[0];
    const queryString = new URLSearchParams(req.query).toString();
    const cacheKey = `${steamPath}?${queryString}`;

    // Check cache
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

    const response = await axios.get(
      `https://api.steampowered.com/${steamPath}?${queryString}&key=${process.env.STEAM_API_KEY}`
    );

    cache.set(cacheKey, response.data);
    res.json(response.data);
  } catch (error) {
    // console.error("Steam API Error:", error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: "Error fetching data from Steam API",
      details: error.response?.data || error.message,
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: "Internal Server Error",
    details: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// Handle 404
app.use((req, res) => {
  res.status(404).json({ error: "Not Found" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
