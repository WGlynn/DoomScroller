# Scroll Balance Pro 🎯

**Advanced Digital Wellness Dashboard + Browser Extension**

A production-ready app that helps you build healthier digital habits through real-time tracking, wellness scoring, and gentle nudges.

## What is This?

Scroll Balance is a protocol designed to help people find a healthier balance between online and offline time. Instead of blocking social media or shaming users, it:

- **Rewards mindful consumption** - Earn XP for engaging with goal-aligned content
- **Provides gentle friction** - Nudges you to reflect after extended scrolling
- **Values quality over quantity** - Not all screen time is equal
- **Gamifies wellbeing** - Level up by making better choices

## 🚀 Quick Start Guide

### Step 1: Download the Files

**Option A: Using Git (Recommended)**
```bash
# Clone the repository
git clone https://github.com/WGlynn/DoomScroller.git

# Navigate into the folder
cd DoomScroller
```

**Option B: Download ZIP**
1. Go to the GitHub repository page
2. Click the green "Code" button
3. Click "Download ZIP"
4. Extract the ZIP file to a folder on your computer
5. Open your terminal/command prompt and navigate to that folder

### Step 2: Open the Dashboard App

**Option 1: Simple HTTP Server (Recommended)**
```bash
# Make sure you're in the DoomScroller folder
# Then run:
python3 -m http.server 8000

# Open your browser and go to:
# http://localhost:8000
```

**Option 2: Just Double-Click**
- Simply double-click `index.html` in the file explorer
- It will open in your default browser

### Step 3: Install the Browser Extension (Optional)

1. Open Chrome or any Chromium browser (Edge, Brave, etc.)
2. Go to `chrome://extensions/` (or `edge://extensions/`, etc.)
3. Toggle on **"Developer mode"** in the top right corner
4. Click **"Load unpacked"**
5. Navigate to the `DoomScroller/extension/` folder and select it
6. The extension is now installed!
7. Visit TikTok, Instagram, Twitter, YouTube, or Reddit to see it in action

### Step 4: Start Using Scroll Balance

1. Open the dashboard in your browser
2. Set your personal wellness goals (Settings page)
3. Browse the Smart Feed to see real Reddit content
4. Rate content and earn XP
5. Track your wellness score and progress

That's it! You're ready to build healthier digital habits.

## Features

### 📊 Dashboard App
✅ **Professional UI** - Modern design with sidebar navigation, cards, and charts
✅ **Wellness Score** - Real-time calculation based on multiple factors
✅ **Interactive Charts** - Wellness trends, content quality, usage patterns (Chart.js)
✅ **Deep Analytics** - Usage heatmaps, time distribution, mood tracking
✅ **Goals System** - Track progress across multiple wellness goals
✅ **Activity Timeline** - See your recent digital behavior
✅ **Insights Engine** - AI-generated tips and warnings
✅ **Multi-page** - Dashboard, Feed, Analytics, Goals, Settings

### 🔌 Browser Extension
✅ **Real Social Media** - Works on TikTok, Instagram, Twitter, YouTube, Reddit, Facebook
✅ **Floating Widget** - Shows time and wellness score while scrolling
✅ **Content Tracking** - Platform-specific video/post detection
✅ **Friction Modals** - Gentle interruptions after extended use
✅ **Mood Check-ins** - Quick emotional state tracking
✅ **Background Tracking** - Automatic time logging per site
✅ **Extension Popup** - Quick stats and dashboard access

## How to Run

**New users:** See the [🚀 Quick Start Guide](#-quick-start-guide) above for detailed step-by-step instructions.

**Quick reference:**
- Dashboard: `python3 -m http.server 8000` then open `http://localhost:8000`
- Extension: Load `extension/` folder in Chrome via `chrome://extensions/`
- See `extension/README.md` for more details

## How It Works

1. **Onboarding** - Select your personal goals
2. **Feed** - Browse real content from Reddit based on your goals
3. **Rate Content** - Mark content as valuable or skip it
4. **Earn XP** - Get more points for engaging with goal-aligned content
5. **Friction Kicks In** - After 20 minutes, you're prompted to reflect
6. **Level Up** - Progress through levels as you build better habits

## The Protocol Philosophy

Based on feedback and iteration, Scroll Balance v2.0 embraces these principles:

- **Don't fight the feed, ride it** - People aren't going to stop scrolling
- **Use "brain rot" formats for good** - Viral content can deliver real value
- **Make wellbeing frictionless** - No guilt, no shame, just gentle nudges
- **Small wins compound** - Start simple, build habits over time

## Wellness Algorithm

The wellness score is calculated using 4 factors:

1. **Goal Alignment (40%)** - How much content matches your selected goals
2. **Time Management (30%)** - Screen time relative to healthy limits
3. **Mood Trends (20%)** - Recent emotional state tracking
4. **Engagement Quality (10%)** - Valuable vs. passive content consumption

Score updates in real-time and is displayed prominently in the dashboard.

## Future Enhancements

- [ ] Pairwise comparison system for content valuation
- [ ] Peer-to-peer AI agent network
- [ ] Prediction markets for content quality
- [ ] Offline activity verification (fitness tracker sync)
- [ ] Token/crypto integration (optional track)
- [ ] Creator rewards system
- [ ] Mobile app version (React Native)
- [ ] Community challenges & leaderboards
- [ ] Export data to CSV/JSON
- [ ] Weekly/monthly wellness reports

## Technical Stack

**Dashboard:**
- Pure HTML5, CSS3, JavaScript (ES6+)
- Chart.js for data visualization
- CSS Grid & Flexbox for layout
- CSS Custom Properties (design tokens)
- LocalStorage for data persistence
- Responsive design (mobile-friendly)

**Extension:**
- Chrome Extension Manifest V3
- Content scripts for social media injection
- Background service worker for tracking
- Chrome Storage API
- Platform-specific content detection

**No frameworks, no build tools required!**

## Contributing

This is a proof of concept. Feel free to fork, experiment, and build on it.

## License

MIT License - Do whatever you want with this
