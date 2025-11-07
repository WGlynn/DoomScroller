// Scroll Balance - Content Script (Injected into social media sites)

console.log('🎯 Scroll Balance active');

class ScrollBalanceOverlay {
  constructor() {
    this.sessionStart = Date.now();
    this.scrollCount = 0;
    this.lastScrollTime = Date.now();
    this.contentViewed = 0;
    this.settings = {};

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
  }

  injectOverlay() {
    // Create floating widget
    const widget = document.createElement('div');
    widget.id = 'scroll-balance-widget';
    widget.innerHTML = `
      <div class="sb-widget-content">
        <div class="sb-widget-header">
          <span class="sb-icon">⚖️</span>
          <span class="sb-time">0m</span>
        </div>
        <div class="sb-widget-score">
          <div class="sb-score-label">Wellness</div>
          <div class="sb-score-value">85</div>
        </div>
      </div>
    `;

    // Make it draggable
    this.makeDraggable(widget);

    document.body.appendChild(widget);
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
    // Monitor video container changes
    const observer = new MutationObserver(() => {
      const videos = document.querySelectorAll('[data-e2e="recommend-list-item-container"]');
      if (videos.length > this.contentViewed) {
        this.contentViewed = videos.length;
        this.recordContentView();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  trackInstagram() {
    // Monitor article changes (posts/reels)
    const observer = new MutationObserver(() => {
      const posts = document.querySelectorAll('article');
      if (posts.length > this.contentViewed) {
        this.contentViewed = posts.length;
        this.recordContentView();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  trackTwitter() {
    // Monitor tweet articles
    const observer = new MutationObserver(() => {
      const tweets = document.querySelectorAll('article');
      if (tweets.length > this.contentViewed) {
        this.contentViewed = tweets.length;
        this.recordContentView();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
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
    const response = await chrome.runtime.sendMessage({ action: 'getSiteTime' });
    const timeMinutes = Math.floor(response.time / 60);

    const widget = document.getElementById('scroll-balance-widget');
    if (widget) {
      const timeEl = widget.querySelector('.sb-time');
      if (timeEl) {
        timeEl.textContent = `${timeMinutes}m`;
      }
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
