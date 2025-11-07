# GitHub Issues to Create

Copy and paste these into GitHub Issues. Each issue includes title, labels, description, and acceptance criteria.

---

## Issue #1: XSS Vulnerability - Reddit Content Not Sanitized

**Labels:** `security`, `critical`, `bug`

**Description:**

Reddit usernames and post titles are directly interpolated into HTML without sanitization in `app.js` (lines 526-564). This creates an XSS vulnerability where malicious content could execute JavaScript.

**Location:**
- `app.js:createRealContentCard()`

**Risk:**
- XSS attacks through crafted Reddit posts
- Cookie theft, session hijacking
- Malicious script injection

**Reproduction:**
1. Load Smart Feed
2. If Reddit returns content with `<script>` tags in titles
3. Script would execute

**Fix Required:**
Create a `sanitizeHTML()` utility function and use it for all user-generated content:

```javascript
function sanitizeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Use it:
<div class="content-username">u/${sanitizeHTML(item.author)}</div>
```

**Acceptance Criteria:**
- [ ] All Reddit content is sanitized before rendering
- [ ] Unit tests verify XSS prevention
- [ ] No user-supplied content renders as HTML

---

## Issue #2: Reddit API Rate Limiting Missing

**Labels:** `bug`, `critical`, `api`

**Description:**

The app fetches from Reddit's public API without any rate limiting or retry logic. Reddit rate limits unauthenticated requests to 600 per 10 minutes. Users will hit this limit quickly and see "Failed to load content" errors.

**Location:**
- `app.js:fetchRedditPosts()` (lines 446-486)

**Current Behavior:**
- Unlimited parallel requests
- No backoff on 429 errors
- No request queuing

**Expected Behavior:**
- Implement rate limiter (max 30 requests/minute)
- Add exponential backoff on rate limit errors
- Queue requests when limit is reached

**Fix Required:**
Implement a `RateLimiter` class with throttling.

**Acceptance Criteria:**
- [ ] Rate limiter prevents >30 requests/min to Reddit
- [ ] 429 errors trigger exponential backoff
- [ ] User sees "Loading..." state during throttling
- [ ] Requests are queued, not dropped

---

## Issue #3: LocalStorage Data Loss on Quota Exceeded

**Labels:** `bug`, `critical`, `data-loss`

**Description:**

`saveData()` writes to localStorage without error handling. If quota is exceeded (~5-10MB), the write fails silently and users lose all progress (XP, streak, ratings, mood history).

**Location:**
- `app.js:saveData()` (lines 54-56)

**Risk:**
- Silent data loss after hours of usage
- No backup mechanism
- No user warning

**Current Code:**
```javascript
saveData() {
    localStorage.setItem('scrollBalancePro', JSON.stringify(this.userData));
}
```

**Fix Required:**
1. Wrap in try-catch
2. Check data size before saving
3. Compress old data if needed (keep last 100 ratings, 50 activities)
4. Fallback to IndexedDB
5. Alert user if save fails

**Acceptance Criteria:**
- [ ] saveData() handles QuotaExceededError
- [ ] Data automatically compresses when approaching limit
- [ ] User is warned before data loss occurs
- [ ] Export feature allows manual backup

---

## Issue #4: Screen Time Tracking Inflates When User AFK

**Labels:** `bug`, `critical`, `tracking`

**Description:**

Screen time increments every second even when:
- User is AFK
- Browser is minimized
- Tab is inactive
- Computer is locked

This makes the wellness score meaningless.

**Location:**
- `app.js:startTracking()` (lines 179-194)

**Current Behavior:**
```javascript
setInterval(() => {
    this.userData.screenTime++; // Always increments
}, 1000);
```

**Expected Behavior:**
- Only track when page is visible (Page Visibility API)
- Only track when user is active (detect interactions)
- Pause tracking after 30s of inactivity

**Fix Required:**
1. Use Page Visibility API (`document.hidden`)
2. Track last user interaction time
3. Only increment when visible AND recently active

**Acceptance Criteria:**
- [ ] Screen time pauses when tab is hidden
- [ ] Screen time pauses after 30s of no interaction
- [ ] Tracking resumes on user activity
- [ ] Unit tests verify behavior

---

## Issue #5: Extension Memory Leak - MutationObservers Never Cleaned Up

**Labels:** `bug`, `critical`, `memory-leak`, `extension`

**Description:**

Content script creates MutationObservers that watch the entire DOM tree but never disconnects them. This causes memory to grow unbounded on long sessions, eventually crashing the tab.

**Location:**
- `extension/content.js:trackTikTok()` (lines 132-146)
- `extension/content.js:trackInstagram()` (lines 148-162)
- `extension/content.js:trackTwitter()` (lines 164-178)

**Current Behavior:**
```javascript
const observer = new MutationObserver(() => { /* ... */ });
observer.observe(document.body, { childList: true, subtree: true });
// Never disconnected!
```

**Impact:**
- Memory grows unbounded
- Browser tab becomes slow
- Tab crashes after extended use

**Fix Required:**
1. Throttle observer callbacks
2. Disconnect observers on page unload
3. Limit observation scope
4. Store observers for manual cleanup

**Acceptance Criteria:**
- [ ] All observers disconnected on `beforeunload`
- [ ] Callbacks throttled to max 1/500ms
- [ ] Memory usage stable over 1-hour session
- [ ] Performance profiling shows no leaks

---

## Issue #6: Chart.js Errors Crash Entire Page

**Labels:** `bug`, `high-priority`, `ui`

**Description:**

Chart initialization has no error handling. If Chart.js fails to load or canvas elements are missing, the entire page crashes.

**Location:**
- `app.js:initCharts()` (lines 216-278)
- `app.js:loadAnalytics()` (lines 845-858)

**Current Behavior:**
- No try-catch blocks
- Assumes Chart.js is always available
- Assumes canvas elements exist

**Expected Behavior:**
- Graceful degradation if Chart.js missing
- Fallback UI if canvas missing
- Error doesn't break entire app

**Fix Required:**
Wrap chart code in try-catch, show fallback UI on error.

**Acceptance Criteria:**
- [ ] Charts fail gracefully
- [ ] User sees "Charts unavailable" message
- [ ] App remains functional without charts
- [ ] Console shows helpful error messages

---

## Issue #7: Race Condition in Page Navigation

**Labels:** `bug`, `high-priority`, `navigation`

**Description:**

Rapid clicks on navigation items cause race conditions. Async page loads (analytics, feed) don't check if navigation already changed. Charts render on wrong pages.

**Location:**
- `app.js:navigateTo()` (lines 92-113)

**Current Behavior:**
- No navigation lock
- Async loads not awaited
- No error handling

**Reproduction:**
1. Rapidly click between Analytics and Dashboard
2. Charts sometimes appear on Dashboard
3. Console shows errors

**Fix Required:**
1. Add `isNavigating` lock
2. Make navigateTo() async
3. Await page loads
4. Cancel pending loads on new navigation

**Acceptance Criteria:**
- [ ] Rapid clicks don't cause errors
- [ ] Only one navigation at a time
- [ ] Charts render on correct pages
- [ ] Previous page loads are cancelled

---

## Issue #8: Wellness Score Calculation Has Critical Bugs

**Labels:** `bug`, `high-priority`, `algorithm`

**Description:**

Wellness score calculation has multiple bugs:
1. Time score goes negative for >8 hours usage
2. Division by zero possible
3. Uses total lifetime screen time instead of daily
4. Empty arrays cause NaN

**Location:**
- `app.js:calculateWellnessScore()` (lines 115-151)

**Current Issues:**
```javascript
// Goes negative!
const timeScore = Math.max(0, (1 - hours / 8) * 30);

// Division by zero if no ratings
const totalRatings = this.userData.contentRatings.length || 1;
```

**Expected Behavior:**
- Score always 0-100
- Uses daily stats, not lifetime
- Handles empty arrays gracefully
- Meaningful baseline scores

**Fix Required:**
Complete rewrite with proper edge case handling.

**Acceptance Criteria:**
- [ ] Score always 0-100
- [ ] No NaN or negative values
- [ ] Uses daily screen time
- [ ] Works with empty data
- [ ] Unit tests cover edge cases

---

## Issue #9: No Caching for Reddit Content

**Labels:** `enhancement`, `high-priority`, `performance`

**Description:**

Every filter change fetches new Reddit data, wasting API quota and causing slow UX. Content should be cached for 5-10 minutes.

**Location:**
- `app.js:fetchRealContent()` (lines 395-415)

**Current Behavior:**
- All filter changes fetch new data
- Same subreddits fetched repeatedly
- Slow, wasteful, hits rate limits

**Expected Behavior:**
- Cache Reddit responses for 5 minutes
- Filter changes use cached data
- Only fetch if cache expired

**Fix Required:**
Implement cache with Map() storing data + expiration timestamps.

**Acceptance Criteria:**
- [ ] Reddit data cached for 5 minutes
- [ ] Filter changes instant (use cache)
- [ ] Cache limited to 10 entries
- [ ] Old cache entries pruned

---

## Issue #10: Extension Content Script Conflicts with Page JavaScript

**Labels:** `bug`, `high-priority`, `extension`

**Description:**

Content script injects global variables and uses generic element IDs that can conflict with page scripts.

**Location:**
- `extension/content.js` (entire file)

**Risk:**
- Widget ID `scroll-balance-widget` could collide
- Global variables could be overwritten
- Page scripts could break extension

**Current Code:**
```javascript
const widget = document.createElement('div');
widget.id = 'scroll-balance-widget'; // Generic ID
```

**Fix Required:**
1. Wrap in IIFE
2. Use unique namespaced IDs
3. Check if already injected
4. Isolate variables

**Acceptance Criteria:**
- [ ] All code wrapped in IIFE
- [ ] IDs are unique per injection
- [ ] Check prevents double-injection
- [ ] No global variable pollution

---

## Issue #11: Goals Page Not Interactive

**Labels:** `bug`, `medium-priority`, `ui`

**Description:**

Goals page displays goals but they're not selectable or editable. Users can't change their goals after initial setup.

**Location:**
- `app.js:loadGoalsPage()` (lines 354-377)

**Current Behavior:**
- Goals displayed as static cards
- No click handlers
- Changes not saved

**Expected Behavior:**
- Click goal to toggle selection
- Visual feedback on selection
- Changes saved to userData.goals
- Feed updates with new goals

**Acceptance Criteria:**
- [ ] Goals are clickable
- [ ] Selected state persists
- [ ] Visual indicator shows selection
- [ ] Feed updates immediately

---

## Issue #12: Missing Keyboard Navigation

**Labels:** `accessibility`, `medium-priority`, `a11y`

**Description:**

No keyboard shortcuts. App is inaccessible for keyboard-only users.

**Expected Behavior:**
- Number keys (1-5) navigate pages
- Tab focuses interactive elements
- Enter activates buttons
- `?` shows keyboard help
- ESC closes modals

**Fix Required:**
Add keyboard event listeners with proper focus management.

**Acceptance Criteria:**
- [ ] Keyboard shortcuts work
- [ ] Focus indicators visible
- [ ] Help modal lists shortcuts
- [ ] Works without mouse

---

## Issue #13: No Data Export Feature

**Labels:** `feature`, `medium-priority`

**Description:**

Users can't backup or export their data. If localStorage is cleared, all progress is lost.

**Expected Feature:**
Settings page should have "Export Data" button that downloads JSON file with all user data.

**Acceptance Criteria:**
- [ ] Export button in settings
- [ ] Downloads JSON file
- [ ] File includes all userData
- [ ] Can be re-imported

---

## Issue #14: Poor Mobile Responsiveness

**Labels:** `ui`, `medium-priority`, `mobile`

**Description:**

- Sidebar doesn't collapse on mobile
- Charts overflow on small screens
- Touch targets too small (< 44px)
- Horizontal scrolling issues

**Fix Required:**
- Hamburger menu for mobile
- Responsive charts
- Larger touch targets
- Better mobile layout

**Acceptance Criteria:**
- [ ] Sidebar collapses on mobile
- [ ] All touch targets ≥44x44px
- [ ] Charts fit mobile screens
- [ ] No horizontal scroll

---

## Issue #15: Charts Display Random Data

**Labels:** `bug`, `medium-priority`, `data-integrity`

**Description:**

Analytics charts show randomly generated data instead of real historical data. This makes the analytics page completely meaningless.

**Location:**
- `app.js:generateWellnessTrendData()` (lines 303-312)
- `app.js:generateHeatmapData()` (line 967-969)

**Current Code:**
```javascript
generateWellnessTrendData() {
    const variance = Math.random() * 20 - 10; // RANDOM!
    data.push(baseScore + variance - i * 2);
}
```

**Fix Required:**
Store real daily wellness scores in array, display historical data.

**Acceptance Criteria:**
- [ ] Charts show real historical data
- [ ] Data persists across sessions
- [ ] No random number generation
- [ ] 7-day history tracked

---

## Priority Summary

**IMMEDIATE (Critical):**
- Issue #1: XSS Vulnerability
- Issue #2: Rate Limiting
- Issue #3: Data Loss
- Issue #4: Screen Time Bug
- Issue #5: Memory Leak

**SHORT-TERM (High):**
- Issue #6: Chart Errors
- Issue #7: Navigation Race Condition
- Issue #8: Wellness Score Bugs
- Issue #9: No Caching
- Issue #10: Extension Conflicts

**MEDIUM-TERM:**
- Issue #11: Goals Not Interactive
- Issue #12: Keyboard Navigation
- Issue #13: Data Export
- Issue #14: Mobile Responsive
- Issue #15: Random Chart Data

Create these issues in order of priority.
