<img src="public/images/trophy-steam.png" width="200"/>

# Steam Achievement Tracker
A web application that allows users to track and compare Steam achievement statistics across different profiles. Users can view detailed achievement progress, compare stats on a leaderboard, and track total gaming statistics.

## Features
- Search for Steam profiles using either Steam ID or custom URL
- View detailed achievement statistics for each profile
- Track total achievements, completion percentages, and playtime
- Global leaderboard with multiple sorting options
- Pagination support for leaderboard viewing
- Condensed view option for large game libraries
- Real-time loading progress with estimated completion time
- Automatic profile updates when revisiting existing users

## Usage
### Searching for Profiles
- Enter a Steam ID or custom URL in the search box
- Press Enter or click Search
- View detailed achievement statistics for the profile
### Leaderboard Features
 - Sort by:
    - Total Achievements
    - Total Games
    - Playtime
    - Username
- Navigate through pages using Previous/Next buttons
- View condensed or detailed game information
### View Options
- Toggle between detailed and condensed views
- Hide completed games (100%)
- Hide games with no progress (0%)
- Sort by different criteria

## Technologies Used
- Node.js
- Express.js
- MongoDB
- Steam Web API
- Vercel (Deployment)

## Limitations
- MongoDB Atlas free tier storage limit: 512MB
- Steam API rate limiting considerations
- Maximum of 100 users per page in leaderboard
- Profile updates limited to active searches
