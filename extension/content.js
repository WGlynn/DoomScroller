// Scroll Balance - Content Script (Injected into social media sites)
// Wrap in IIFE to prevent conflicts with page scripts
(function() {
  'use strict';

  // Check if already injected
  if (window.__SCROLL_BALANCE_INJECTED__) {
    console.warn('Scroll Balance already injected');
    return;
  }
  window.__SCROLL_BALANCE_INJECTED__ = true;

  console.log('🎯 Scroll Balance active');

  class ScrollBalanceOverlay {
    constructor() {
      this.sessionStart = Date.now();
      this.scrollCount = 0;
      this.lastScrollTime = Date.now();
      this.contentViewed = 0;
      this.settings = {};
      this.observers = []; // Track observers for cleanup
      this.namespace = 'sb-' + Math.random().toString(36).substr(2, 9);

      this.init();
    }

  async init() {
    // Load settings
    const result = await chrome.storage.local.get(['settings']);
    this.settings = result.settings || {};

    // Inject overlay UI
    this.injectOverlay();

    // Track scrolling
    this.trackScrolling();

    // Track content viewing
    this.trackContent();

    // Show periodic check-ins
    this.setupCheckIns();

    // Update stats display
    this.updateStats();
    setInterval(() => this.updateStats(), 10000);

    // Cleanup on page unload
    this.setupCleanup();
  }

  setupCleanup() {
    window.addEventListener('beforeunload', () => {
      // Disconnect all observers
      this.observers.forEach(observer => observer.disconnect());
      this.observers = [];
      console.log('Scroll Balance cleaned up');
    });
  }

  throttle(func, delay) {
    let timeout = null;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), delay);
    };
  }

  injectOverlay() {
    // Create enhanced floating widget with unique ID
    const widget = document.createElement('div');
    widget.id = `${this.namespace}-widget`;
    widget.className = 'scroll-balance-widget-v1';

    const platform = this.detectPlatform();
    const platformIcon = this.getPlatformIcon(platform);
    const platformName = this.getPlatformName(platform);

    widget.innerHTML = `
      <div class="sb-widget-content">
        <div class="sb-widget-header">
          <span class="sb-platform-icon">${platformIcon}</span>
          <span class="sb-platform-name">${platformName}</span>
          <button class="sb-minimize-btn" title="Minimize">−</button>
        </div>

        <div class="sb-widget-body">
          <div class="sb-stat-row">
            <div class="sb-stat">
              <div class="sb-stat-label">Time Here</div>
              <div class="sb-stat-value sb-time">0m</div>
            </div>
            <div class="sb-stat">
              <div class="sb-stat-label">Viewed</div>
              <div class="sb-stat-value sb-viewed">0</div>
            </div>
          </div>

          <div class="sb-stat-row">
            <div class="sb-stat">
              <div class="sb-stat-label">Scroll Pace</div>
              <div class="sb-stat-value sb-pace">Chill</div>
            </div>
            <div class="sb-stat">
              <div class="sb-stat-label">Wellness</div>
              <div class="sb-stat-value sb-wellness">85</div>
            </div>
          </div>

          <div class="sb-scroll-indicator">
            <div class="sb-scroll-bar"></div>
          </div>

          <div class="sb-insight">
            <span class="sb-insight-icon">💡</span>
            <span class="sb-insight-text">Loading insights...</span>
          </div>

          <div class="sb-quick-actions">
            <button class="sb-action-btn" data-action="pause" title="Take a break">⏸️</button>
            <button class="sb-action-btn" data-action="mood" title="Check mood">😊</button>
            <button class="sb-action-btn" data-action="dashboard" title="Open dashboard">📊</button>
          </div>
        </div>
      </div>
    `;

    // Make it draggable
    this.makeDraggable(widget);

    // Add event listeners
    this.setupWidgetListeners(widget);

    document.body.appendChild(widget);
    this.widgetId = widget.id;
    this.isMinimized = false;
  }

  setupWidgetListeners(widget) {
    // Minimize button
    const minimizeBtn = widget.querySelector('.sb-minimize-btn');
    minimizeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleMinimize(widget);
    });

    // Quick actions
    widget.querySelectorAll('.sb-action-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        this.handleQuickAction(action);
      });
    });
  }

  toggleMinimize(widget) {
    this.isMinimized = !this.isMinimized;
    const body = widget.querySelector('.sb-widget-body');
    const minimizeBtn = widget.querySelector('.sb-minimize-btn');

    if (this.isMinimized) {
      body.style.display = 'none';
      minimizeBtn.textContent = '+';
      minimizeBtn.title = 'Expand';
    } else {
      body.style.display = 'block';
      minimizeBtn.textContent = '−';
      minimizeBtn.title = 'Minimize';
    }
  }

  handleQuickAction(action) {
    switch(action) {
      case 'pause':
        this.showFrictionModal();
        break;
      case 'mood':
        this.showQuickMoodCheck();
        break;
      case 'dashboard':
        window.open(chrome.runtime.getURL('popup.html'), '_blank');
        break;
    }
  }

  showQuickMoodCheck() {
    const modal = document.createElement('div');
    modal.id = 'scroll-balance-quick-mood';
    modal.innerHTML = `
      <div class="sb-friction-overlay">
        <div class="sb-friction-content sb-quick-mood">
          <h2>😊 Quick Mood Check</h2>
          <p>How's this ${this.getPlatformName(this.detectPlatform())} session treating you?</p>
          <div class="sb-mood-buttons">
            <button class="sb-mood-btn" data-mood="energized">⚡ Energized</button>
            <button class="sb-mood-btn" data-mood="calm">😌 Calm</button>
            <button class="sb-mood-btn" data-mood="focused">🎯 Focused</button>
            <button class="sb-mood-btn" data-mood="tired">😴 Tired</button>
            <button class="sb-mood-btn" data-mood="stressed">😰 Stressed</button>
            <button class="sb-mood-btn" data-mood="happy">😊 Happy</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelectorAll('.sb-mood-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mood = btn.dataset.mood;
        chrome.runtime.sendMessage({
          action: 'recordMood',
          mood: mood,
          platform: this.detectPlatform()
        });
        modal.remove();
        this.showToast('Mood recorded! 💚');
      });
    });

    // Click outside to close
    modal.addEventListener('click', (e) => {
      if (e.target === modal || e.target.classList.contains('sb-friction-overlay')) {
        modal.remove();
      }
    });
  }

  showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'sb-toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  getPlatformIcon(platform) {
    const icons = {
      'tiktok': '🎵',
      'instagram': '📸',
      'twitter': '🐦',
      'youtube': '📺',
      'reddit': '🤖',
      'unknown': '🌐'
    };
    return icons[platform] || icons['unknown'];
  }

  getPlatformName(platform) {
    const names = {
      'tiktok': 'TikTok',
      'instagram': 'Instagram',
      'twitter': 'X/Twitter',
      'youtube': 'YouTube',
      'reddit': 'Reddit',
      'unknown': 'Web'
    };
    return names[platform] || names['unknown'];
  }

  getPlatformInsight(platform) {
    const insights = {
      'tiktok': '🎵 TikTok: Quick swipes can add up. Are you finding what you came for?',
      'instagram': '📸 Instagram: Beautiful feeds can be endless. Set an intention.',
      'twitter': '🐦 Twitter: News moves fast. Don\'t let doom-scrolling take over.',
      'youtube': '📺 YouTube: One video leads to another. Check your watch time.',
      'reddit': '🤖 Reddit: So many threads to explore. Stay focused on your goals.',
      'unknown': '🌐 Browse mindfully. Quality over quantity.'
    };
    return insights[platform] || insights['unknown'];
  }

  calculateScrollPace() {
    const sessionTime = (Date.now() - this.sessionStart) / 1000; // seconds
    const scrollsPerMinute = (this.scrollCount / sessionTime) * 60;

    if (scrollsPerMinute < 10) return { label: 'Chill', color: '#10b981' };
    if (scrollsPerMinute < 30) return { label: 'Moderate', color: '#f59e0b' };
    if (scrollsPerMinute < 60) return { label: 'Fast', color: '#f97316' };
    return { label: 'Rapid', color: '#ef4444' };
  }

  makeDraggable(element) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

    element.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
      e = e || window.event;
      e.preventDefault();
      pos3 = e.clientX;
      pos4 = e.clientY;
      document.onmouseup = closeDragElement;
      document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
      e = e || window.event;
      e.preventDefault();
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;
      element.style.top = (element.offsetTop - pos2) + "px";
      element.style.left = (element.offsetLeft - pos1) + "px";
    }

    function closeDragElement() {
      document.onmouseup = null;
      document.onmousemove = null;
    }
  }

  trackScrolling() {
    let scrollTimeout;

    window.addEventListener('scroll', () => {
      this.scrollCount++;
      this.lastScrollTime = Date.now();

      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        // User stopped scrolling
        this.checkForFriction();
      }, 2000);
    });
  }

  trackContent() {
    // Detect content viewing (platform-specific)
    const platform = this.detectPlatform();

    if (platform === 'tiktok') {
      this.trackTikTok();
    } else if (platform === 'instagram') {
      this.trackInstagram();
    } else if (platform === 'twitter') {
      this.trackTwitter();
    }
  }

  detectPlatform() {
    const hostname = window.location.hostname;

    if (hostname.includes('tiktok')) return 'tiktok';
    if (hostname.includes('instagram')) return 'instagram';
    if (hostname.includes('twitter') || hostname.includes('x.com')) return 'twitter';
    if (hostname.includes('youtube')) return 'youtube';
    if (hostname.includes('reddit')) return 'reddit';

    return 'unknown';
  }

  trackTikTok() {
    let lastCount = 0;

    // Use throttled observer to prevent excessive callbacks
    const observer = new MutationObserver(this.throttle(() => {
      const videos = document.querySelectorAll('[data-e2e="recommend-list-item-container"]');
      if (videos.length > lastCount) {
        lastCount = videos.length;
        this.contentViewed = videos.length;
        this.recordContentView();
      }
    }, 500)); // Throttle to max once per 500ms

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Store for cleanup
    this.observers.push(observer);
  }

  trackInstagram() {
    let lastCount = 0;

    // Monitor article changes (posts/reels)
    const observer = new MutationObserver(this.throttle(() => {
      const posts = document.querySelectorAll('article');
      if (posts.length > lastCount) {
        lastCount = posts.length;
        this.contentViewed = posts.length;
        this.recordContentView();
      }
    }, 500));

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Store for cleanup
    this.observers.push(observer);
  }

  trackTwitter() {
    let lastCount = 0;

    // Monitor tweet articles
    const observer = new MutationObserver(this.throttle(() => {
      const tweets = document.querySelectorAll('article');
      if (tweets.length > lastCount) {
        lastCount = tweets.length;
        this.contentViewed = tweets.length;
        this.recordContentView();
      }
    }, 500));

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Store for cleanup
    this.observers.push(observer);
  }

  recordContentView() {
    chrome.runtime.sendMessage({
      action: 'trackContent',
      data: {
        platform: this.detectPlatform(),
        scrollCount: this.scrollCount
      }
    });
  }

  async checkForFriction() {
    if (!this.settings.frictionEnabled) return;

    const timeSpent = (Date.now() - this.sessionStart) / 60000; // minutes

    if (timeSpent > this.settings.frictionInterval) {
      this.showFrictionModal();
      this.sessionStart = Date.now(); // Reset timer
    }
  }

  showFrictionModal() {
    // Check if modal already exists
    if (document.getElementById('scroll-balance-friction')) return;

    const modal = document.createElement('div');
    modal.id = 'scroll-balance-friction';
    modal.innerHTML = `
      <div class="sb-friction-overlay">
        <div class="sb-friction-content">
          <h2>⏸️ Take a Breath</h2>
          <p>You've been scrolling for a while. How are you feeling?</p>
          <div class="sb-mood-buttons">
            <button class="sb-mood-btn" data-mood="energized">⚡ Energized</button>
            <button class="sb-mood-btn" data-mood="calm">😌 Calm</button>
            <button class="sb-mood-btn" data-mood="focused">🎯 Focused</button>
            <button class="sb-mood-btn" data-mood="tired">😴 Tired</button>
            <button class="sb-mood-btn" data-mood="stressed">😰 Stressed</button>
            <button class="sb-mood-btn" data-mood="happy">😊 Happy</button>
          </div>
          <button class="sb-continue-btn">Continue Scrolling</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Add event listeners
    modal.querySelectorAll('.sb-mood-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mood = btn.dataset.mood;
        chrome.runtime.sendMessage({
          action: 'recordMood',
          mood: mood
        });
        modal.remove();
      });
    });

    modal.querySelector('.sb-continue-btn').addEventListener('click', () => {
      modal.remove();
    });
  }

  async updateStats() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getSiteTime' });
      const timeMinutes = Math.floor(response.time / 60);

      const widget = document.getElementById(this.widgetId);
      if (!widget) return;

      // Update time
      const timeEl = widget.querySelector('.sb-time');
      if (timeEl) {
        if (timeMinutes >= 60) {
          const hours = Math.floor(timeMinutes / 60);
          const mins = timeMinutes % 60;
          timeEl.textContent = `${hours}h ${mins}m`;
        } else {
          timeEl.textContent = `${timeMinutes}m`;
        }
      }

      // Update content viewed
      const viewedEl = widget.querySelector('.sb-viewed');
      if (viewedEl) {
        viewedEl.textContent = this.contentViewed;
      }

      // Update scroll pace
      const paceEl = widget.querySelector('.sb-pace');
      if (paceEl) {
        const pace = this.calculateScrollPace();
        paceEl.textContent = pace.label;
        paceEl.style.color = pace.color;
      }

      // Update scroll indicator bar
      const scrollBar = widget.querySelector('.sb-scroll-bar');
      if (scrollBar) {
        const sessionMinutes = (Date.now() - this.sessionStart) / 60000;
        const scrollsPerMin = sessionMinutes > 0 ? this.scrollCount / sessionMinutes : 0;
        const intensity = Math.min((scrollsPerMin / 60) * 100, 100); // Max at 60 scrolls/min
        scrollBar.style.width = `${intensity}%`;

        if (intensity < 30) {
          scrollBar.style.background = '#10b981';
        } else if (intensity < 60) {
          scrollBar.style.background = '#f59e0b';
        } else {
          scrollBar.style.background = '#ef4444';
        }
      }

      // Update platform insight
      const insightEl = widget.querySelector('.sb-insight-text');
      if (insightEl) {
        const platform = this.detectPlatform();
        const insight = this.getPlatformInsight(platform);
        insightEl.textContent = insight;
      }

      // Update wellness score (get from storage if available)
      const wellnessEl = widget.querySelector('.sb-wellness');
      if (wellnessEl) {
        chrome.storage.local.get(['scrollBalancePro'], (result) => {
          if (result.scrollBalancePro) {
            const data = JSON.parse(result.scrollBalancePro);
            wellnessEl.textContent = data.wellnessScore || 85;
          }
        });
      }
    } catch (error) {
      console.error('Error updating stats:', error);
    }
  }

  setupCheckIns() {
    // Random check-ins
    setInterval(() => {
      if (Math.random() > 0.9) { // 10% chance every interval
        this.showQuickCheckIn();
      }
    }, 300000); // Every 5 minutes
  }

  showQuickCheckIn() {
    // Subtle notification
    const notification = document.createElement('div');
    notification.className = 'sb-notification';
    notification.textContent = '💭 Mindful moment: What are you looking for right now?';

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => notification.remove(), 500);
    }, 5000);
  }
}

  // Initialize when page loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      new ScrollBalanceOverlay();
    });
  } else {
    new ScrollBalanceOverlay();
  }

})(); // Close IIFE
