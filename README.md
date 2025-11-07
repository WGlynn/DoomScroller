# Scroll Balance Protocol 🎯

**Anti-doomscrolling protocol proof of concept**

A minimal, functional demo showing how a digital wellbeing layer could work on top of existing social media platforms.

## What is This?

Scroll Balance is a protocol designed to help people find a healthier balance between online and offline time. Instead of blocking social media or shaming users, it:

- **Rewards mindful consumption** - Earn XP for engaging with goal-aligned content
- **Provides gentle friction** - Nudges you to reflect after extended scrolling
- **Values quality over quantity** - Not all screen time is equal
- **Gamifies wellbeing** - Level up by making better choices

## Features (MVP)

✅ **Goal Selection** - Choose what matters to you (learn, chill, reduce anxiety, productivity, sleep)
✅ **XP & Leveling System** - Earn points for healthy behaviors
✅ **Time Tracking** - See how long you've been scrolling
✅ **Content Rating** - Rate content as valuable or skip it
✅ **Gentle Friction** - Get prompted to reflect after 20+ minutes
✅ **Greyout Effect** - Visual feedback after extended use
✅ **Progress Persistence** - Your stats are saved locally

## How to Run

This is a pure HTML/CSS/JavaScript app with no dependencies.

```bash
# Option 1: Just open the file
open index.html

# Option 2: Use a simple HTTP server
python3 -m http.server 8000
# Then visit http://localhost:8000

# Option 3: Use any other local server
npx serve
```

## How It Works

1. **Onboarding** - Select your personal goals
2. **Feed** - Browse mock social content (simulates TikTok/Instagram style)
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

## Future Enhancements

This is a barebones proof of concept. Future versions could include:

- [ ] Pairwise comparison system for content valuation
- [ ] Peer-to-peer AI agent network
- [ ] Prediction markets for content quality
- [ ] Offline activity verification
- [ ] Token/crypto integration (optional track)
- [ ] Creator rewards system
- [ ] Real social media integration
- [ ] Mobile app version
- [ ] Community challenges & leaderboards

## Technical Stack

- Pure HTML5, CSS3, JavaScript (ES6+)
- No frameworks, no build tools, no dependencies
- LocalStorage for data persistence
- Responsive design (mobile-friendly)

## Contributing

This is a proof of concept. Feel free to fork, experiment, and build on it.

## License

MIT License - Do whatever you want with this
