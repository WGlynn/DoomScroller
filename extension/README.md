# Scroll Balance - Browser Extension

Chrome extension that adds wellness tracking and mindful nudges to real social media platforms.

## Features

- **Real-time Tracking**: Monitors time spent on TikTok, Instagram, Twitter, YouTube, Reddit, and Facebook
- **Floating Widget**: Shows current session time and wellness score
- **Gentle Friction**: Periodic check-ins after 20+ minutes of scrolling
- **Mood Tracking**: Record how you're feeling during sessions
- **Content Tracking**: Monitors how much content you've viewed
- **Background Tracking**: Automatic time tracking even when tab is inactive

## Installation

### Option 1: Load Unpacked (Developer Mode)

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked"
4. Select the `extension/` folder
5. The extension is now installed!

### Option 2: Build and Install

```bash
# Package the extension
cd extension
zip -r scroll-balance-extension.zip *

# Then manually load in Chrome
```

## How It Works

### Background Service Worker (`background.js`)
- Tracks time spent on each site
- Stores mood history
- Manages extension state
- Updates badge with time spent

### Content Script (`content.js`)
- Injected into supported social media sites
- Creates floating wellness widget
- Detects scrolling patterns
- Shows friction modals
- Platform-specific content tracking

### Popup (`popup.html`)
- Quick stats view
- Link to full dashboard
- Quick check-in button

## Supported Platforms

- ✅ TikTok
- ✅ Instagram
- ✅ Twitter/X
- ✅ YouTube
- ✅ Reddit
- ✅ Facebook

## Privacy

All data is stored locally in Chrome's storage. Nothing is sent to external servers.

## Development

```bash
# Watch for changes
npm run watch

# Build production version
npm run build
```

## Permissions Required

- `storage` - Save user data locally
- `tabs` - Track active tab
- `activeTab` - Inject content scripts
- Host permissions for supported social media sites

## Future Enhancements

- [ ] Customizable friction intervals
- [ ] Export data
- [ ] Sync across devices
- [ ] More detailed analytics
- [ ] Goal setting per platform
- [ ] Weekly/monthly reports
