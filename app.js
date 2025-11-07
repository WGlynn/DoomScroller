// Scroll Balance Pro - Advanced Wellness Tracking App

// Utility: Sanitize HTML to prevent XSS
function sanitizeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Rate Limiter for Reddit API
class RateLimiter {
    constructor(maxRequests, timeWindow) {
        this.maxRequests = maxRequests;
        this.timeWindow = timeWindow;
        this.requests = [];
    }

    async throttle() {
        const now = Date.now();
        this.requests = this.requests.filter(time => now - time < this.timeWindow);

        if (this.requests.length >= this.maxRequests) {
            const oldestRequest = this.requests[0];
            const waitTime = this.timeWindow - (now - oldestRequest);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }

        this.requests.push(Date.now());
    }
}

class ScrollBalancePro {
    constructor() {
        this.userData = {
            xp: 0,
            level: 1,
            streak: 0,
            goals: ['learn', 'chill'],
            wellnessScore: 85,
            screenTime: 0, // seconds
            sessionStart: Date.now(),
            moodHistory: [],
            activityHistory: [],
            contentRatings: [],
            dailyStats: this.loadDailyStats()
        };

        // Charts
        this.wellnessChart = null;
        this.qualityChart = null;
        this.usageChart = null;
        this.timeChart = null;
        this.moodChart = null;

        // Navigation lock
        this.isNavigating = false;

        // Page visibility tracking
        this.isVisible = !document.hidden;
        this.lastInteraction = Date.now();

        // Reddit API rate limiter (30 requests per minute)
        this.redditLimiter = new RateLimiter(30, 60000);

        // Reddit content cache
        this.redditCache = {
            data: new Map(),
            expiresAt: new Map()
        };

        this.init();
    }

    init() {
        this.loadData();
        this.setupNavigation();
        this.setupModals();
        this.initCharts();
        this.updateAllStats();
        this.startTracking();
        this.loadGoalsProgress();
        this.loadActivityTimeline();

        // Preload analytics charts if we're on that page
        if (document.getElementById('analytics-page')?.classList.contains('active')) {
            setTimeout(() => this.loadAnalytics(), 100);
        }
    }

    // ===== DATA MANAGEMENT =====
    loadData() {
        const saved = localStorage.getItem('scrollBalancePro');
        if (saved) {
            const data = JSON.parse(saved);
            this.userData = { ...this.userData, ...data };
        }
    }

    saveData() {
        try {
            const data = JSON.stringify(this.userData);

            // Check size before saving (4.5MB threshold)
            const size = new Blob([data]).size;
            if (size > 4.5 * 1024 * 1024) {
                console.warn('Data approaching localStorage limit, compressing...');
                this.compressUserData();
            }

            localStorage.setItem('scrollBalancePro', data);

            // Verify save succeeded
            const saved = localStorage.getItem('scrollBalancePro');
            if (!saved) {
                throw new Error('Save verification failed');
            }
        } catch (error) {
            console.error('Failed to save data:', error);

            if (error.name === 'QuotaExceededError') {
                // Try to compress and save again
                this.compressUserData();
                try {
                    localStorage.setItem('scrollBalancePro', JSON.stringify(this.userData));
                } catch (retryError) {
                    // Last resort: alert user
                    alert('Warning: Unable to save progress. Your data storage is full. Please export your data from Settings.');
                }
            }
        }
    }

    compressUserData() {
        // Keep only last 100 content ratings
        if (this.userData.contentRatings.length > 100) {
            this.userData.contentRatings = this.userData.contentRatings.slice(-100);
        }

        // Keep only last 50 activities
        if (this.userData.activityHistory.length > 50) {
            this.userData.activityHistory = this.userData.activityHistory.slice(-50);
        }

        // Keep only last 30 days of mood history
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
        this.userData.moodHistory = this.userData.moodHistory.filter(
            m => new Date(m.time).getTime() > thirtyDaysAgo
        );

        console.log('User data compressed');
    }

    loadDailyStats() {
        const today = new Date().toDateString();
        const saved = localStorage.getItem('dailyStats');
        if (saved) {
            const stats = JSON.parse(saved);
            if (stats.date === today) {
                return stats;
            }
        }

        return {
            date: today,
            screenTime: 0,
            xpEarned: 0,
            contentViewed: 0,
            wellnessScores: [85]
        };
    }

    saveDailyStats() {
        localStorage.setItem('dailyStats', JSON.stringify(this.userData.dailyStats));
    }

    // ===== NAVIGATION =====
    setupNavigation() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.dataset.page;
                this.navigateTo(page);
            });
        });
    }

    async navigateTo(pageName) {
        // Prevent rapid clicks causing race conditions
        if (this.isNavigating) return;
        this.isNavigating = true;

        try {
            // Update nav items
            document.querySelectorAll('.nav-item').forEach(item => {
                item.classList.remove('active');
            });

            const targetNav = document.querySelector(`[data-page="${pageName}"]`);
            if (!targetNav) {
                throw new Error(`Invalid page: ${pageName}`);
            }
            targetNav.classList.add('active');

            // Update pages
            document.querySelectorAll('.page').forEach(page => {
                page.classList.remove('active');
            });

            const targetPage = document.getElementById(`${pageName}-page`);
            if (!targetPage) {
                throw new Error(`Page not found: ${pageName}`);
            }
            targetPage.classList.add('active');

            // Load page-specific content
            if (pageName === 'analytics') {
                await this.loadAnalytics();
            } else if (pageName === 'goals') {
                this.loadGoalsPage();
            } else if (pageName === 'feed') {
                await this.loadSmartFeed();
            }
        } catch (error) {
            console.error('Navigation error:', error);
            // Fallback to dashboard if navigation fails
            if (pageName !== 'dashboard') {
                this.navigateTo('dashboard');
            }
        } finally {
            this.isNavigating = false;
        }
    }

    // ===== WELLNESS CALCULATION =====
    calculateWellnessScore() {
        // Factors:
        // 1. Goal alignment (40%)
        // 2. Time management (30%)
        // 3. Mood trend (20%)
        // 4. Engagement quality (10%)

        let score = 50; // Start at baseline

        // Goal alignment (40%)
        const totalRatings = Math.max(this.userData.contentRatings.length, 1);
        const goalAlignedRatings = this.userData.contentRatings.filter(r => r.aligned).length;
        const goalScore = (goalAlignedRatings / totalRatings) * 40;

        // Time management (30%) - use DAILY stats, not lifetime
        const dailyHours = (this.userData.dailyStats.screenTime || 0) / 3600;
        const targetHours = 3; // Reasonable daily target
        let timeScore;
        if (dailyHours <= targetHours) {
            timeScore = 30; // Full points if under target
        } else {
            // Gradually decrease as time increases beyond target
            timeScore = Math.max(0, 30 * (1 - (dailyHours - targetHours) / targetHours));
        }

        // Mood trend (20%)
        let moodScore = 10; // Default baseline
        const recentMoods = this.userData.moodHistory.slice(-5);
        if (recentMoods.length > 0) {
            const positiveMoods = recentMoods.filter(m =>
                ['energized', 'calm', 'focused', 'happy'].includes(m.mood)
            ).length;
            moodScore = (positiveMoods / recentMoods.length) * 20;
        }

        // Engagement quality (10%)
        let engagementScore = 5; // Default baseline
        if (totalRatings > 0) {
            const valuableContent = this.userData.contentRatings.filter(r => r.rating === 'valuable').length;
            engagementScore = (valuableContent / totalRatings) * 10;
        }

        score = Math.round(goalScore + timeScore + moodScore + engagementScore);

        // Ensure score is within bounds
        this.userData.wellnessScore = Math.max(0, Math.min(100, score));

        // Only push score if it changed significantly (avoid array bloat)
        const lastScore = this.userData.dailyStats.wellnessScores.slice(-1)[0];
        if (!lastScore || Math.abs(lastScore - this.userData.wellnessScore) > 2) {
            this.userData.dailyStats.wellnessScores.push(this.userData.wellnessScore);

            // Keep only last 100 scores
            if (this.userData.dailyStats.wellnessScores.length > 100) {
                this.userData.dailyStats.wellnessScores = this.userData.dailyStats.wellnessScores.slice(-100);
            }
        }

        return this.userData.wellnessScore;
    }

    // ===== STATS UPDATE =====
    updateAllStats() {
        // Update wellness score
        const wellnessScore = this.calculateWellnessScore();
        document.getElementById('wellness-score').textContent = wellnessScore;

        // Update screen time
        const hours = Math.floor(this.userData.screenTime / 3600);
        const minutes = Math.floor((this.userData.screenTime % 3600) / 60);
        document.getElementById('screen-time').textContent = `${hours}h ${minutes}m`;

        // Update XP
        document.getElementById('total-xp').textContent = this.userData.xp.toLocaleString();

        // Update streak
        document.getElementById('streak').textContent = `${this.userData.streak} days`;

        // Update sidebar level
        document.getElementById('sidebar-level').textContent = this.userData.level;

        // Save data
        this.saveData();
        this.saveDailyStats();
    }

    // ===== TRACKING =====
    startTracking() {
        // Page visibility tracking
        document.addEventListener('visibilitychange', () => {
            this.isVisible = !document.hidden;
        });

        // User activity tracking
        ['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(event => {
            document.addEventListener(event, () => {
                this.lastInteraction = Date.now();
            }, { passive: true });
        });

        // Update every second
        setInterval(() => {
            // Only track if page is visible and user was active in last 30 seconds
            const isActive = (Date.now() - this.lastInteraction) < 30000;

            if (this.isVisible && isActive) {
                this.userData.screenTime++;
                this.userData.dailyStats.screenTime++;
            }

            // Update every 10 seconds
            if (this.userData.screenTime % 10 === 0) {
                this.updateAllStats();
            }

            // Check for milestones every minute
            if (this.userData.screenTime % 60 === 0) {
                this.checkMilestones();
            }
        }, 1000);

        // Update charts every 30 seconds
        setInterval(() => {
            if (this.wellnessChart || this.qualityChart) {
                this.updateCharts();
            }
        }, 30000);
    }

    checkMilestones() {
        const minutes = Math.floor(this.userData.screenTime / 60);

        // Show reflection modal every 30 minutes
        if (minutes > 0 && minutes % 30 === 0) {
            this.showReflectionModal();
        }

        // Add activity log
        if (minutes % 15 === 0) {
            this.addActivity('check-in', `${minutes} minutes of usage`, new Date());
        }
    }

    // ===== CHARTS =====
    initCharts() {
        try {
            if (typeof Chart === 'undefined') {
                console.warn('Chart.js not loaded, charts will not be available');
                return;
            }

            // Wellness trend chart
            const wellnessCtx = document.getElementById('wellness-chart');
            if (wellnessCtx) {
                try {
                    this.wellnessChart = new Chart(wellnessCtx, {
                        type: 'line',
                        data: {
                            labels: this.getLast7Days(),
                            datasets: [{
                                label: 'Wellness Score',
                                data: this.generateWellnessTrendData(),
                                borderColor: '#6366f1',
                                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                                fill: true,
                                tension: 0.4
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: { display: false }
                            },
                            scales: {
                                y: {
                                    beginAtZero: true,
                                    max: 100,
                                    grid: { color: '#334155' },
                                    ticks: { color: '#94a3b8' }
                                },
                                x: {
                                    grid: { color: '#334155' },
                                    ticks: { color: '#94a3b8' }
                                }
                            }
                        }
                    });
                } catch (error) {
                    console.error('Failed to create wellness chart:', error);
                }
            }

            // Quality donut chart
            const qualityCtx = document.getElementById('quality-chart');
            if (qualityCtx) {
                try {
                    this.qualityChart = new Chart(qualityCtx, {
                        type: 'doughnut',
                        data: {
                            labels: ['High Value', 'Medium', 'Low Value'],
                            datasets: [{
                                data: [45, 35, 20],
                                backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
                                borderWidth: 0
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: { display: false }
                            }
                        }
                    });
                } catch (error) {
                    console.error('Failed to create quality chart:', error);
                }
            }
        } catch (error) {
            console.error('Failed to initialize charts:', error);
            this.showChartFallback();
        }
    }

    showChartFallback() {
        document.querySelectorAll('.chart-container').forEach(container => {
            if (container && !container.querySelector('canvas')?.getContext) {
                container.innerHTML = `
                    <div style="padding: 40px; text-align: center; color: var(--text-secondary);">
                        📊 Charts unavailable. Your data is safe and being tracked.
                    </div>
                `;
            }
        });
    }

    updateCharts() {
        if (this.wellnessChart) {
            this.wellnessChart.data.datasets[0].data = this.generateWellnessTrendData();
            this.wellnessChart.update();
        }

        if (this.qualityChart) {
            const stats = this.calculateContentQuality();
            this.qualityChart.data.datasets[0].data = [stats.high, stats.medium, stats.low];
            this.qualityChart.update();
        }
    }

    getLast7Days() {
        const days = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            days.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        }
        return days;
    }

    generateWellnessTrendData() {
        // Generate realistic trending data
        const baseScore = this.userData.wellnessScore;
        const data = [];
        for (let i = 6; i >= 0; i--) {
            const variance = Math.random() * 20 - 10;
            data.push(Math.max(0, Math.min(100, baseScore + variance - i * 2)));
        }
        return data;
    }

    calculateContentQuality() {
        const ratings = this.userData.contentRatings;
        if (ratings.length === 0) {
            return { high: 45, medium: 35, low: 20 };
        }

        const valuable = ratings.filter(r => r.rating === 'valuable').length;
        const total = ratings.length;

        const high = Math.round((valuable / total) * 100);
        const low = Math.round(((total - valuable) / total) * 100);
        const medium = 100 - high - low;

        return { high, medium, low };
    }

    // ===== GOALS =====
    loadGoalsProgress() {
        const container = document.getElementById('goals-progress');
        if (!container) return;

        const goals = [
            { name: '📚 Learn Something New', progress: 65 },
            { name: '😌 Stay Calm', progress: 80 },
            { name: '⚡ Be Productive', progress: 45 }
        ];

        container.innerHTML = goals.map(goal => `
            <div class="goal-progress-item">
                <div class="goal-progress-header">
                    <div class="goal-progress-name">${goal.name}</div>
                    <div class="goal-progress-percent">${goal.progress}%</div>
                </div>
                <div class="goal-progress-bar">
                    <div class="goal-progress-fill" style="width: ${goal.progress}%"></div>
                </div>
            </div>
        `).join('');
    }

    loadGoalsPage() {
        const container = document.querySelector('.goals-grid');
        if (!container) return;

        const allGoals = [
            { icon: '📚', name: 'Learn Something', description: 'Engage with educational content' },
            { icon: '😌', name: 'Chill Intentionally', description: 'Mindful relaxation time' },
            { icon: '🧘', name: 'Reduce Anxiety', description: 'Focus on calming content' },
            { icon: '⚡', name: 'Be Productive', description: 'Work towards your goals' },
            { icon: '😴', name: 'Better Sleep', description: 'Wind down properly' }
        ];

        container.innerHTML = allGoals.map(goal => `
            <div class="stat-card">
                <div class="stat-icon wellness">${goal.icon}</div>
                <div class="stat-content">
                    <div class="stat-label">${goal.name}</div>
                    <div style="font-size: 0.9rem; color: var(--text-secondary);">
                        ${goal.description}
                    </div>
                </div>
            </div>
        `).join('');
    }

    // ===== SMART FEED =====
    loadSmartFeed() {
        const container = document.getElementById('smart-feed');
        if (!container) return;

        // Show loading state
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-secondary);">Loading real content...</div>';

        // Setup filter buttons
        this.setupFeedFilters();

        // Load initial content
        this.currentFeedFilter = 'all';
        this.fetchRealContent();
    }

    async fetchRealContent() {
        const container = document.getElementById('smart-feed');
        if (!container) return;

        // Create cache key based on filter and goals
        const cacheKey = `${this.currentFeedFilter}_${this.userData.goals.join(',')}`;
        const now = Date.now();

        // Check cache first
        if (this.redditCache.data.has(cacheKey)) {
            const expiresAt = this.redditCache.expiresAt.get(cacheKey);
            if (now < expiresAt) {
                console.log('Using cached Reddit data');
                this.currentFeedContent = this.redditCache.data.get(cacheKey);
                this.renderRealFeedContent();
                return;
            }
        }

        container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-secondary);">Loading real content...</div>';

        try {
            // Fetch from multiple subreddits based on goals
            const subreddits = this.getSubredditsForGoals();
            const posts = await this.fetchRedditPosts(subreddits);

            if (posts.length === 0) {
                container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-secondary);">No content available. Try changing filters.</div>';
                return;
            }

            // Cache for 5 minutes
            this.redditCache.data.set(cacheKey, posts);
            this.redditCache.expiresAt.set(cacheKey, now + 5 * 60 * 1000);

            // Limit cache size to 10 entries
            if (this.redditCache.data.size > 10) {
                const oldestKey = this.redditCache.data.keys().next().value;
                this.redditCache.data.delete(oldestKey);
                this.redditCache.expiresAt.delete(oldestKey);
            }

            this.currentFeedContent = posts;
            this.renderRealFeedContent();
        } catch (error) {
            console.error('Error fetching content:', error);
            container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--error);">Failed to load content. Please try again.</div>';
        }
    }

    getSubredditsForGoals() {
        const subredditMap = {
            'learn': ['todayilearned', 'explainlikeimfive', 'science', 'AskScience'],
            'chill': ['natureporn', 'cozyplaces', 'mademesmile', 'wholesomememes'],
            'reduce-anxiety': ['meditation', 'mindfulness', 'decidingtobebetter'],
            'productivity': ['productivity', 'getdisciplined', 'lifeprotips'],
            'sleep': ['sleep', 'bedtime']
        };

        let subreddits = [];

        if (this.currentFeedFilter === 'goal-aligned' && this.userData.goals.length > 0) {
            this.userData.goals.forEach(goal => {
                if (subredditMap[goal]) {
                    subreddits.push(...subredditMap[goal]);
                }
            });
        } else if (this.currentFeedFilter === 'educational') {
            subreddits = [...subredditMap['learn'], ...subredditMap['productivity']];
        } else {
            // All - mix from all categories
            Object.values(subredditMap).forEach(subs => {
                subreddits.push(...subs);
            });
        }

        return subreddits.slice(0, 5); // Limit to 5 subreddits
    }

    async fetchRedditPosts(subreddits) {
        const posts = [];

        for (const subreddit of subreddits.slice(0, 3)) { // Only fetch from 3 to be fast
            try {
                // Use rate limiter to prevent hitting Reddit's rate limits
                await this.redditLimiter.throttle();

                const response = await fetch(`https://www.reddit.com/r/${subreddit}/hot.json?limit=5`);

                // Handle rate limiting
                if (response.status === 429) {
                    console.warn('Reddit rate limit hit, waiting...');
                    const retryAfter = response.headers.get('Retry-After') || 60;
                    await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
                    continue; // Skip this subreddit for now
                }

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();

                if (data.data && data.data.children) {
                    data.data.children.forEach(child => {
                        const post = child.data;

                        // Skip if NSFW or no content
                        if (post.over_18 || (!post.title && !post.selftext)) return;

                        // Determine goal alignment
                        const goal = this.categorizeRedditPost(post);
                        const isAligned = this.userData.goals.includes(goal);

                        posts.push({
                            id: post.id,
                            title: post.title,
                            content: post.selftext ? post.selftext.substring(0, 300) : '',
                            author: post.author,
                            subreddit: post.subreddit,
                            url: `https://reddit.com${post.permalink}`,
                            thumbnail: post.thumbnail && post.thumbnail.startsWith('http') ? post.thumbnail : null,
                            score: post.score,
                            goal: goal,
                            aligned: isAligned,
                            type: 'reddit'
                        });
                    });
                }
            } catch (error) {
                console.error(`Error fetching r/${subreddit}:`, error);
            }
        }

        return posts;
    }

    categorizeRedditPost(post) {
        const subreddit = post.subreddit.toLowerCase();
        const title = post.title.toLowerCase();

        if (subreddit.includes('learn') || subreddit.includes('science') || subreddit.includes('explain')) {
            return 'learn';
        } else if (subreddit.includes('meditation') || subreddit.includes('mindfulness') || subreddit.includes('anxiety')) {
            return 'reduce-anxiety';
        } else if (subreddit.includes('productivity') || subreddit.includes('discipline')) {
            return 'productivity';
        } else if (subreddit.includes('sleep')) {
            return 'sleep';
        } else {
            return 'chill';
        }
    }

    renderRealFeedContent() {
        const container = document.getElementById('smart-feed');
        if (!container || !this.currentFeedContent) return;

        container.innerHTML = this.currentFeedContent.map(item => this.createRealContentCard(item)).join('');

        // Add event listeners
        container.querySelectorAll('.content-card').forEach(card => {
            card.querySelector('.action-btn.valuable')?.addEventListener('click', () => {
                this.rateContent(card, 'valuable');
            });
            card.querySelector('.action-btn.skip')?.addEventListener('click', () => {
                this.rateContent(card, 'skip');
            });
            card.querySelector('.action-btn.view')?.addEventListener('click', () => {
                const url = card.dataset.url;
                if (url) window.open(url, '_blank');
            });
        });
    }

    createRealContentCard(item) {
        const goalEmojis = {
            'learn': '🧠',
            'chill': '😌',
            'reduce-anxiety': '🧘',
            'productivity': '⚡',
            'sleep': '😴'
        };

        const emoji = goalEmojis[item.goal] || '📱';
        const alignedBadge = item.aligned ? '<span class="tag" style="background: rgba(16, 185, 129, 0.2); color: #10b981;">✓ Goal Aligned</span>' : '';

        // Sanitize all user-generated content to prevent XSS
        const safeAuthor = sanitizeHTML(item.author);
        const safeSubreddit = sanitizeHTML(item.subreddit);
        const safeTitle = sanitizeHTML(item.title);
        const safeContent = item.content ? sanitizeHTML(item.content) : '';
        const safeUrl = sanitizeHTML(item.url);
        const safeThumbnail = item.thumbnail ? sanitizeHTML(item.thumbnail) : null;
        const safeScore = parseInt(item.score) || 0;

        return `
            <div class="content-card" data-id="${sanitizeHTML(item.id)}" data-goal="${sanitizeHTML(item.goal)}" data-aligned="${item.aligned}" data-url="${safeUrl}">
                <div class="content-header">
                    <div class="content-avatar">${emoji}</div>
                    <div class="content-info">
                        <div class="content-username">u/${safeAuthor}</div>
                        <div class="content-goal">r/${safeSubreddit}</div>
                    </div>
                </div>
                <div class="content-body">
                    ${safeThumbnail ? `<img src="${safeThumbnail}" class="content-image" style="width: 100%; height: 300px; object-fit: cover; border-radius: var(--radius-lg); margin-bottom: var(--spacing-md);" onerror="this.style.display='none'" />` : `<div class="content-media">${emoji}</div>`}
                    <div class="content-text"><strong>${safeTitle}</strong></div>
                    ${safeContent ? `<div style="font-size: 0.9rem; color: var(--text-secondary); margin-top: var(--spacing-sm);">${safeContent}...</div>` : ''}
                    <div class="content-tags">
                        <span class="tag">#${item.goal.replace('-', '')}</span>
                        <span class="tag">👍 ${safeScore}</span>
                        ${alignedBadge}
                    </div>
                </div>
                <div class="content-actions">
                    <button class="action-btn valuable">👍 Valuable</button>
                    <button class="action-btn skip">👎 Skip</button>
                    <button class="action-btn view" style="background: rgba(99, 102, 241, 0.1); border-color: var(--primary); color: var(--primary);">🔗 View</button>
                </div>
            </div>
        `;
    }

    setupFeedFilters() {
        const filterButtons = document.querySelectorAll('.filter-btn');
        filterButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                // Update active state
                filterButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Filter content
                const filter = btn.textContent.toLowerCase().trim();
                this.currentFeedFilter = filter;
                this.fetchRealContent();
            });
        });
    }

    renderFeedContent() {
        const container = document.getElementById('smart-feed');
        if (!container) return;

        // Generate content based on filter
        const content = this.generateFeedContent(10);
        container.innerHTML = content.map(item => this.createContentCard(item)).join('');

        // Add event listeners to action buttons
        container.querySelectorAll('.content-card').forEach(card => {
            const valuableBtn = card.querySelector('.action-btn.valuable');
            const skipBtn = card.querySelector('.action-btn.skip');

            valuableBtn?.addEventListener('click', () => {
                this.rateContent(card, 'valuable');
            });

            skipBtn?.addEventListener('click', () => {
                this.rateContent(card, 'skip');
            });
        });
    }

    generateFeedContent(count) {
        const contentTypes = [
            { goal: 'learn', emoji: '🧠', topics: ['History', 'Science', 'Technology', 'Philosophy', 'Business'], category: 'Educational' },
            { goal: 'chill', emoji: '😌', topics: ['Nature', 'Music', 'Art', 'Comedy', 'Travel'], category: 'All' },
            { goal: 'reduce-anxiety', emoji: '🧘', topics: ['Meditation', 'Mindfulness', 'Breathing', 'Calm', 'Yoga'], category: 'Goal-Aligned' },
            { goal: 'productivity', emoji: '⚡', topics: ['Tips', 'Hacks', 'Workflow', 'Tools', 'Automation'], category: 'Educational' },
            { goal: 'sleep', emoji: '😴', topics: ['Relaxation', 'Night Routine', 'Sleep Tips', 'ASMR', 'Wind Down'], category: 'Goal-Aligned' }
        ];

        const content = [];

        for (let i = 0; i < count; i++) {
            // Pick random content type
            let contentType;

            // Filter based on current filter
            if (this.currentFeedFilter === 'goal-aligned' && this.userData.goals.length > 0) {
                const randomGoal = this.userData.goals[Math.floor(Math.random() * this.userData.goals.length)];
                contentType = contentTypes.find(ct => ct.goal === randomGoal) || contentTypes[0];
            } else if (this.currentFeedFilter === 'educational') {
                const educational = contentTypes.filter(ct => ct.category === 'Educational');
                contentType = educational[Math.floor(Math.random() * educational.length)];
            } else {
                contentType = contentTypes[Math.floor(Math.random() * contentTypes.length)];
            }

            const topic = contentType.topics[Math.floor(Math.random() * contentType.topics.length)];
            const isAligned = this.userData.goals.includes(contentType.goal);

            content.push({
                id: `content-${Date.now()}-${i}`,
                emoji: contentType.emoji,
                goal: contentType.goal,
                topic: topic,
                aligned: isAligned,
                title: this.generateContentTitle(contentType.goal, topic),
                username: this.generateUsername()
            });
        }

        return content;
    }

    generateContentTitle(goal, topic) {
        const titles = {
            'learn': [
                `Mind-blowing ${topic} fact that'll make you rethink everything 🤯`,
                `Quick ${topic} lesson but make it actually interesting`,
                `POV: You're learning ${topic} but it doesn't feel like homework`,
                `${topic} explained in a way that actually makes sense`
            ],
            'chill': [
                `Just ${topic} vibes, nothing else`,
                `When you need a ${topic} moment`,
                `${topic} content that hits different`,
                `Pure ${topic} energy, no stress`
            ],
            'reduce-anxiety': [
                `${topic} technique that actually works`,
                `Try this ${topic} exercise right now`,
                `${topic} content for when everything feels like too much`,
                `Simple ${topic} practice you can do anywhere`
            ],
            'productivity': [
                `${topic} that changed how I work`,
                `Stop scrolling and try this ${topic}`,
                `${topic} that actually works (not clickbait)`,
                `Game-changing ${topic} for getting things done`
            ],
            'sleep': [
                `${topic} for better sleep tonight`,
                `${topic} routine that'll knock you out`,
                `Try this ${topic} before bed`,
                `${topic} that helped me sleep like a baby`
            ]
        };

        const options = titles[goal] || titles['learn'];
        return options[Math.floor(Math.random() * options.length)];
    }

    generateUsername() {
        const usernames = [
            '@mindfulcreator',
            '@brainrot_academy',
            '@chillvibes',
            '@producti_beast',
            '@zenmaster',
            '@knowledge_drop',
            '@calm_corner',
            '@flow_state',
            '@wise_scrolls',
            '@balanced_life'
        ];
        return usernames[Math.floor(Math.random() * usernames.length)];
    }

    createContentCard(item) {
        const alignedBadge = item.aligned ? '<span class="tag" style="background: rgba(16, 185, 129, 0.2); color: #10b981;">✓ Goal Aligned</span>' : '';

        return `
            <div class="content-card" data-id="${item.id}" data-goal="${item.goal}" data-aligned="${item.aligned}">
                <div class="content-header">
                    <div class="content-avatar">${item.emoji}</div>
                    <div class="content-info">
                        <div class="content-username">${item.username}</div>
                        <div class="content-goal">${item.topic}</div>
                    </div>
                </div>
                <div class="content-body">
                    <div class="content-media">${item.emoji}</div>
                    <div class="content-text">${item.title}</div>
                    <div class="content-tags">
                        <span class="tag">#${item.goal.replace('-', '')}</span>
                        <span class="tag">#${item.topic.toLowerCase()}</span>
                        ${alignedBadge}
                    </div>
                </div>
                <div class="content-actions">
                    <button class="action-btn valuable">👍 Valuable</button>
                    <button class="action-btn skip">👎 Skip</button>
                </div>
            </div>
        `;
    }

    rateContent(card, rating) {
        const isAligned = card.dataset.aligned === 'true';
        const goal = card.dataset.goal;
        const contentId = card.dataset.id;

        // Record rating
        this.userData.contentRatings.push({
            id: contentId,
            goal: goal,
            aligned: isAligned,
            rating: rating,
            timestamp: Date.now()
        });

        // Award XP
        let xpGained = 0;
        if (rating === 'valuable') {
            xpGained = isAligned ? 15 : 5;
            this.userData.xp += xpGained;
            this.addActivity('xp', `Earned ${xpGained} XP from valuable content`, new Date());
        } else if (rating === 'skip') {
            if (!isAligned) {
                xpGained = 3;
                this.userData.xp += xpGained;
            }
        }

        // Visual feedback
        card.style.transform = 'translateX(-100%)';
        card.style.opacity = '0';
        card.style.transition = 'all 0.3s ease';

        setTimeout(() => {
            card.remove();
            // Load one more item to replace it
            const newContent = this.generateFeedContent(1);
            const container = document.getElementById('smart-feed');
            if (container && newContent.length > 0) {
                const newCard = this.createContentCard(newContent[0]);
                container.insertAdjacentHTML('beforeend', newCard);

                // Add event listeners to new card
                const addedCard = container.lastElementChild;
                addedCard.querySelector('.action-btn.valuable')?.addEventListener('click', () => {
                    this.rateContent(addedCard, 'valuable');
                });
                addedCard.querySelector('.action-btn.skip')?.addEventListener('click', () => {
                    this.rateContent(addedCard, 'skip');
                });
            }
        }, 300);

        // Update stats
        this.userData.dailyStats.contentViewed++;
        this.calculateWellnessScore();
        this.updateAllStats();
    }

    // ===== ACTIVITY TIMELINE =====
    loadActivityTimeline() {
        const container = document.getElementById('activity-timeline');
        if (!container) return;

        const activities = this.userData.activityHistory.slice(-5).reverse();

        if (activities.length === 0) {
            activities.push(
                { type: 'start', title: 'Session started', time: new Date() },
                { type: 'goal', title: 'Goals updated', time: new Date(Date.now() - 300000) }
            );
        }

        container.innerHTML = activities.map(activity => {
            const timeAgo = this.getTimeAgo(activity.time);
            return `
                <div class="activity-item">
                    <div class="activity-icon">${this.getActivityIcon(activity.type)}</div>
                    <div class="activity-content">
                        <div class="activity-title">${activity.title}</div>
                        <div class="activity-time">${timeAgo}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    addActivity(type, title, time) {
        this.userData.activityHistory.push({ type, title, time });
        if (this.userData.activityHistory.length > 50) {
            this.userData.activityHistory = this.userData.activityHistory.slice(-50);
        }
        this.loadActivityTimeline();
        this.saveData();
    }

    getActivityIcon(type) {
        const icons = {
            'start': '🚀',
            'goal': '🎯',
            'xp': '⚡',
            'check-in': '💭',
            'level-up': '⬆️'
        };
        return icons[type] || '📌';
    }

    getTimeAgo(time) {
        const seconds = Math.floor((Date.now() - new Date(time)) / 1000);
        if (seconds < 60) return 'Just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        return `${Math.floor(seconds / 86400)}d ago`;
    }

    // ===== ANALYTICS =====
    loadAnalytics() {
        // Clear existing charts to prevent duplicates
        if (this.usageHeatmapChart) this.usageHeatmapChart.destroy();
        if (this.timeDistChart) this.timeDistChart.destroy();
        if (this.moodChartInstance) this.moodChartInstance.destroy();

        // Small delay to ensure canvas elements are in DOM
        setTimeout(() => {
            this.loadUsageHeatmap();
            this.loadTimeDistribution();
            this.loadMoodChart();
        }, 100);
    }

    loadUsageHeatmap() {
        const canvas = document.getElementById('usage-heatmap');
        if (!canvas || typeof Chart === 'undefined') {
            console.log('Canvas not found or Chart.js not loaded');
            return;
        }

        const data = this.generateHeatmapData();

        this.usageHeatmapChart = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [{
                    label: 'Screen Time (hours)',
                    data: data,
                    backgroundColor: '#6366f1'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: '#334155' },
                        ticks: { color: '#94a3b8' }
                    },
                    x: {
                        grid: { color: '#334155' },
                        ticks: { color: '#94a3b8' }
                    }
                }
            }
        });
    }

    loadTimeDistribution() {
        const canvas = document.getElementById('time-distribution');
        if (!canvas || typeof Chart === 'undefined') {
            console.log('Time distribution canvas not found');
            return;
        }

        this.timeDistChart = new Chart(canvas, {
            type: 'pie',
            data: {
                labels: ['Social', 'Learning', 'Entertainment', 'Productive'],
                datasets: [{
                    data: [35, 25, 25, 15],
                    backgroundColor: ['#6366f1', '#10b981', '#f59e0b', '#ec4899']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#94a3b8' }
                    }
                }
            }
        });
    }

    loadMoodChart() {
        const canvas = document.getElementById('mood-chart');
        if (!canvas || typeof Chart === 'undefined') {
            console.log('Mood chart canvas not found');
            return;
        }

        this.moodChartInstance = new Chart(canvas, {
            type: 'line',
            data: {
                labels: this.getLast7Days(),
                datasets: [{
                    label: 'Mood Score',
                    data: [70, 75, 80, 78, 85, 88, 90],
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        grid: { color: '#334155' },
                        ticks: { color: '#94a3b8' }
                    },
                    x: {
                        grid: { color: '#334155' },
                        ticks: { color: '#94a3b8' }
                    }
                }
            }
        });
    }

    generateHeatmapData() {
        return Array.from({ length: 7 }, () => Math.random() * 6 + 2);
    }

    // ===== MODALS =====
    setupModals() {
        // Modal close
        document.querySelector('.modal-close')?.addEventListener('click', () => {
            this.closeReflectionModal();
        });

        // Mood buttons
        document.querySelectorAll('.mood-card').forEach(btn => {
            btn.addEventListener('click', () => {
                const mood = btn.dataset.mood;
                this.recordMood(mood);
                this.closeReflectionModal();
            });
        });
    }

    showReflectionModal() {
        document.getElementById('reflection-modal').classList.add('active');
    }

    closeReflectionModal() {
        document.getElementById('reflection-modal').classList.remove('active');
    }

    recordMood(mood) {
        this.userData.moodHistory.push({
            mood,
            time: new Date(),
            score: this.getMoodScore(mood)
        });

        this.addActivity('check-in', `Feeling ${mood}`, new Date());
        this.calculateWellnessScore();
        this.updateAllStats();
    }

    getMoodScore(mood) {
        const scores = {
            'energized': 90,
            'happy': 85,
            'focused': 80,
            'calm': 75,
            'tired': 50,
            'stressed': 40
        };
        return scores[mood] || 70;
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.scrollBalancePro = new ScrollBalancePro();
});
