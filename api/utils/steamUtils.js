function cleanSteamId(steamId) {
    if (!steamId) return steamId;
    
    // Remove trailing slashes and trim
    steamId = steamId.trim().replace(/\/+$/, '');
    
    // Convert to lowercase
    steamId = steamId.toLowerCase();
    
    // If it's a full URL, extract the ID
    if (steamId.includes('steamcommunity.com')) {
      const urlMatch = steamId.match(/\/(?:id|profiles)\/([^\/]+)/);
      return urlMatch ? urlMatch[1] : steamId;
    }
    
    // If it contains /id/ or /profiles/ without the domain
    const pathMatch = steamId.match(/\/(?:id|profiles)\/([^\/]+)/);
    if (pathMatch) {
      return pathMatch[1];
    }
    
    // Return cleaned ID (remove any trailing or leading slashes)
    return steamId.replace(/^\/+|\/+$/g, '');
  }
  
  module.exports = {
    cleanSteamId
  };