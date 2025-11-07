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
            dailyStats: this.loadDailyStats(),

            // NEW: Achievement & Progression
            achievements: [],
            unlockedBadges: [],
            dailyChallenge: null,
            challengeProgress: 0,
            totalContentRated: 0,
            totalValuableContent: 0,

            // NEW: Behavioral Tracking
            sessionRatings: [], // Current session ratings
            lastNudgeTime: 0,
            mindlessScrollDetected: 0,
            qualityStreakCurrent: 0, // Consecutive valuable ratings
            qualityStreakBest: 0,

            // NEW: Content Memory & Learning
            contentSignatures: new Map(), // Remember rated content
            categoryPreferences: {}, // Learn what user likes

            // NEW: Time Pattern Data
            hourlyEngagement: Array(24).fill(null).map(() => ({
                ratings: 0,
                valuable: 0,
                aligned: 0,
                skip: 0
            })),

            // NEW: Owl Chatbot Companion
            owlTemperament: 'encouraging', // encouraging, tough-love, zen, quirky
            owlEnabled: true,
            owlInteractions: [],
            lastOwlAppearance: 0,
            owlDismissals: 0,

            // Hardcore Mode
            hardcoreMode: false
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

        // Historical data for charts
        this.historicalData = this.loadHistoricalData();

        // Session tracking for live coaching
        this.sessionStartTime = Date.now();
        this.sessionAlignedCount = 0;
        this.lastCoachingMessage = null;

        this.init();
    }

    init() {
        this.loadData();
        this.setupNavigation();
        this.setupKeyboardShortcuts();
        this.setupModals();
        this.setupOwlSettings();
        this.initCharts();
        this.updateAllStats();
        this.startTracking();
        this.loadGoalsProgress();
        this.loadActivityTimeline();
        this.generateDailyChallenge();
        this.checkAchievements();

        // Preload analytics charts if we're on that page
        if (document.getElementById('analytics-page')?.classList.contains('active')) {
            setTimeout(() => this.loadAnalytics(), 100);
        }
    }

    // ===== ACHIEVEMENTS & PROGRESSION SYSTEM =====
    getAchievementDefinitions() {
        return [
            {
                id: 'first_rating',
                name: 'First Steps',
                description: 'Rate your first piece of content',
                icon: '🌱',
                condition: () => this.userData.totalContentRated >= 1,
                xpReward: 50
            },
            {
                id: 'quality_curator_10',
                name: 'Quality Curator',
                description: 'Rate 10 pieces of valuable content',
                icon: '⭐',
                condition: () => this.userData.totalValuableContent >= 10,
                xpReward: 100
            },
            {
                id: 'quality_curator_50',
                name: 'Master Curator',
                description: 'Rate 50 pieces of valuable content',
                icon: '🌟',
                condition: () => this.userData.totalValuableContent >= 50,
                xpReward: 250
            },
            {
                id: 'streak_7',
                name: 'Week Warrior',
                description: 'Maintain a 7-day streak',
                icon: '🔥',
                condition: () => this.userData.streak >= 7,
                xpReward: 200
            },
            {
                id: 'streak_30',
                name: 'Month Master',
                description: 'Maintain a 30-day streak',
                icon: '💎',
                condition: () => this.userData.streak >= 30,
                xpReward: 500
            },
            {
                id: 'quality_streak_5',
                name: 'On a Roll',
                description: 'Rate 5 valuable items in a row',
                icon: '🎯',
                condition: () => this.userData.qualityStreakBest >= 5,
                xpReward: 150
            },
            {
                id: 'quality_streak_10',
                name: 'Unstoppable',
                description: 'Rate 10 valuable items in a row',
                icon: '🚀',
                condition: () => this.userData.qualityStreakBest >= 10,
                xpReward: 300
            },
            {
                id: 'level_5',
                name: 'Intermediate',
                description: 'Reach level 5',
                icon: '📈',
                condition: () => this.userData.level >= 5,
                xpReward: 100
            },
            {
                id: 'level_10',
                name: 'Advanced User',
                description: 'Reach level 10',
                icon: '🏆',
                condition: () => this.userData.level >= 10,
                xpReward: 300
            },
            {
                id: 'wellness_80',
                name: 'Mindful Master',
                description: 'Achieve 80+ wellness score',
                icon: '🧘',
                condition: () => this.userData.wellnessScore >= 80,
                xpReward: 150
            },
            {
                id: 'wellness_90',
                name: 'Zen Master',
                description: 'Achieve 90+ wellness score',
                icon: '✨',
                condition: () => this.userData.wellnessScore >= 90,
                xpReward: 350
            },
            {
                id: 'daily_challenge_1',
                name: 'Challenge Accepted',
                description: 'Complete your first daily challenge',
                icon: '🎮',
                condition: () => this.userData.achievements.filter(a => a.includes('daily_complete')).length >= 1,
                xpReward: 100
            },
            {
                id: 'alignment_master',
                name: 'Alignment Master',
                description: 'Maintain 90% goal alignment',
                icon: '🎪',
                condition: () => {
                    const recent = this.userData.contentRatings.slice(-20);
                    if (recent.length < 10) return false;
                    const aligned = recent.filter(r => r.aligned).length;
                    return (aligned / recent.length) >= 0.9;
                },
                xpReward: 400
            }
        ];
    }

    checkAchievements() {
        const definitions = this.getAchievementDefinitions();
        let newAchievements = [];

        definitions.forEach(achievement => {
            // Skip if already unlocked
            if (this.userData.achievements.includes(achievement.id)) return;

            // Check condition
            if (achievement.condition()) {
                this.userData.achievements.push(achievement.id);
                this.userData.xp += achievement.xpReward;
                newAchievements.push(achievement);

                // Track as activity
                this.addActivity('achievement', `🏆 Unlocked: ${achievement.name}`, new Date());
            }
        });

        // Show celebration if new achievements
        if (newAchievements.length > 0) {
            this.showAchievementNotification(newAchievements);
            this.checkLevelUp();
            this.saveData();
        }
    }

    showAchievementNotification(achievements) {
        achievements.forEach((achievement, index) => {
            setTimeout(() => {
                this.showToast(`${achievement.icon} ${achievement.name}`, achievement.description, 'achievement');
            }, index * 500);
        });
    }

    generateDailyChallenge() {
        const today = new Date().toDateString();

        // Check if we already have today's challenge
        if (this.userData.dailyChallenge && this.userData.dailyChallenge.date === today) {
            return;
        }

        // Generate new challenge
        const challenges = [
            {
                id: 'rate_10',
                name: 'Rate 10 items',
                description: 'Rate at least 10 pieces of content today',
                target: 10,
                progress: 0,
                type: 'ratings',
                xpReward: 100
            },
            {
                id: 'valuable_7',
                name: 'Find 7 gems',
                description: 'Find and rate 7 valuable pieces of content',
                target: 7,
                progress: 0,
                type: 'valuable',
                xpReward: 150
            },
            {
                id: 'alignment_80',
                name: '80% Alignment',
                description: 'Maintain at least 80% goal alignment today',
                target: 80,
                progress: 0,
                type: 'alignment',
                xpReward: 120
            },
            {
                id: 'mindful_session',
                name: 'Mindful Session',
                description: 'Complete a session with 100% valuable ratings',
                target: 5,
                progress: 0,
                type: 'perfect_session',
                xpReward: 200
            }
        ];

        // Pick random challenge
        const challenge = challenges[Math.floor(Math.random() * challenges.length)];
        challenge.date = today;

        this.userData.dailyChallenge = challenge;
        this.userData.challengeProgress = 0;
        this.saveData();
    }

    updateDailyChallengeProgress() {
        if (!this.userData.dailyChallenge) return;

        const challenge = this.userData.dailyChallenge;
        const today = new Date().toDateString();

        // Reset if it's a new day
        if (challenge.date !== today) {
            this.generateDailyChallenge();
            return;
        }

        // Calculate progress based on challenge type
        let progress = 0;
        const todayRatings = this.userData.contentRatings.filter(r => {
            return new Date(r.timestamp).toDateString() === today;
        });

        switch(challenge.type) {
            case 'ratings':
                progress = todayRatings.length;
                break;
            case 'valuable':
                progress = todayRatings.filter(r => r.rating === 'valuable').length;
                break;
            case 'alignment':
                const aligned = todayRatings.filter(r => r.aligned).length;
                progress = todayRatings.length > 0 ? Math.round((aligned / todayRatings.length) * 100) : 0;
                break;
            case 'perfect_session':
                const valuableCount = todayRatings.filter(r => r.rating === 'valuable').length;
                progress = valuableCount;
                break;
        }

        challenge.progress = progress;

        // Check if completed
        if (progress >= challenge.target && !this.userData.achievements.includes(`daily_complete_${challenge.date}`)) {
            this.userData.achievements.push(`daily_complete_${challenge.date}`);
            this.userData.xp += challenge.xpReward;
            this.showToast('🎉 Daily Challenge Complete!', `+${challenge.xpReward} XP`, 'success');
            this.checkAchievements();
        }

        this.saveData();
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Don't trigger in input fields or textareas
            if (e.target.matches('input, textarea')) return;

            // Navigation shortcuts
            switch(e.key) {
                case '1':
                    e.preventDefault();
                    this.navigateTo('dashboard');
                    break;
                case '2':
                    e.preventDefault();
                    this.navigateTo('feed');
                    break;
                case '3':
                    e.preventDefault();
                    this.navigateTo('analytics');
                    break;
                case '4':
                    e.preventDefault();
                    this.navigateTo('goals');
                    break;
                case '5':
                    e.preventDefault();
                    this.navigateTo('settings');
                    break;
                case '6':
                    e.preventDefault();
                    this.navigateTo('about');
                    break;
                case '?':
                    e.preventDefault();
                    this.showKeyboardHelp();
                    break;
                case 'Escape':
                    // Close any open modals
                    this.closeReflectionModal();
                    this.closeKeyboardHelp();
                    break;
            }
        });
    }

    showKeyboardHelp() {
        let helpModal = document.getElementById('keyboard-help-modal');

        if (!helpModal) {
            helpModal = document.createElement('div');
            helpModal.id = 'keyboard-help-modal';
            helpModal.className = 'modal active';
            helpModal.innerHTML = `
                <div class="modal-content modern">
                    <button class="modal-close" onclick="app.closeKeyboardHelp()">&times;</button>
                    <h2>⌨️ Keyboard Shortcuts</h2>
                    <div style="margin-top: var(--spacing-xl);">
                        <div class="shortcut-row">
                            <kbd>1</kbd>
                            <span>Go to Dashboard</span>
                        </div>
                        <div class="shortcut-row">
                            <kbd>2</kbd>
                            <span>Go to Smart Feed</span>
                        </div>
                        <div class="shortcut-row">
                            <kbd>3</kbd>
                            <span>Go to Analytics</span>
                        </div>
                        <div class="shortcut-row">
                            <kbd>4</kbd>
                            <span>Go to Goals</span>
                        </div>
                        <div class="shortcut-row">
                            <kbd>5</kbd>
                            <span>Go to Settings</span>
                        </div>
                        <div class="shortcut-row">
                            <kbd>6</kbd>
                            <span>Go to About</span>
                        </div>
                        <div class="shortcut-row">
                            <kbd>?</kbd>
                            <span>Show this help</span>
                        </div>
                        <div class="shortcut-row">
                            <kbd>Esc</kbd>
                            <span>Close modals</span>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(helpModal);
        } else {
            helpModal.classList.add('active');
        }
    }

    closeKeyboardHelp() {
        const helpModal = document.getElementById('keyboard-help-modal');
        if (helpModal) {
            helpModal.classList.remove('active');
        }
    }

    // ===== MOBILE MENU =====
    toggleMobileMenu() {
        const sidebar = document.querySelector('.sidebar');
        sidebar.classList.toggle('mobile-open');

        // Close menu when clicking nav items
        if (sidebar.classList.contains('mobile-open')) {
            const navItems = document.querySelectorAll('.nav-item');
            navItems.forEach(item => {
                item.addEventListener('click', () => {
                    sidebar.classList.remove('mobile-open');
                }, { once: true });
            });
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

    loadHistoricalData() {
        const saved = localStorage.getItem('historicalData');
        if (saved) {
            return JSON.parse(saved);
        }

        // Initialize with some baseline data for the last 7 days
        const historical = {};
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateKey = date.toDateString();
            historical[dateKey] = {
                wellnessScore: 85,
                screenTime: 0,
                xpEarned: 0
            };
        }
        return historical;
    }

    saveHistoricalData() {
        if (!this.historicalData) {
            this.historicalData = this.loadHistoricalData();
        }

        // Save today's data
        const today = new Date().toDateString();
        this.historicalData[today] = {
            wellnessScore: this.userData.wellnessScore,
            screenTime: this.userData.dailyStats.screenTime,
            xpEarned: this.userData.xp
        };

        // Keep only last 90 days
        const dates = Object.keys(this.historicalData).sort();
        if (dates.length > 90) {
            const toRemove = dates.slice(0, dates.length - 90);
            toRemove.forEach(date => delete this.historicalData[date]);
        }

        localStorage.setItem('historicalData', JSON.stringify(this.historicalData));
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
        // Advanced wellness calculation with 7 factors
        // 1. Goal alignment (25%) - How well content matches goals
        // 2. Time management (20%) - Balance of screen time
        // 3. Mood trajectory (15%) - Improving vs declining mood
        // 4. Engagement quality (15%) - Valuable vs mindless consumption
        // 5. Consistency bonus (10%) - Maintaining healthy patterns
        // 6. Content diversity (10%) - Variety of content types
        // 7. Recency weighting (5%) - Recent behavior matters more

        let score = 0;

        // 1. GOAL ALIGNMENT (25 points max)
        const totalRatings = Math.max(this.userData.contentRatings.length, 1);
        const recentRatings = this.userData.contentRatings.slice(-20); // Last 20 ratings
        const alignedRatings = recentRatings.filter(r => r.aligned).length;
        const alignmentRatio = alignedRatings / Math.max(recentRatings.length, 1);

        // Bonus for high alignment
        let goalScore = alignmentRatio * 25;
        if (alignmentRatio > 0.8) goalScore += 5; // Bonus for excellent alignment
        score += Math.min(goalScore, 30);

        // 2. TIME MANAGEMENT (20 points max)
        const dailyHours = (this.userData.dailyStats.screenTime || 0) / 3600;
        let timeScore = 20;

        if (dailyHours === 0) {
            timeScore = 15; // Some usage is good
        } else if (dailyHours < 1) {
            timeScore = 18; // Light usage
        } else if (dailyHours <= 2) {
            timeScore = 20; // Ideal range
        } else if (dailyHours <= 3) {
            timeScore = 17; // Moderate
        } else if (dailyHours <= 4) {
            timeScore = 12; // Getting high
        } else if (dailyHours <= 6) {
            timeScore = 7; // High usage
        } else {
            timeScore = Math.max(0, 7 - (dailyHours - 6) * 2); // Excessive
        }
        score += timeScore;

        // 3. MOOD TRAJECTORY (15 points max)
        const recentMoods = this.userData.moodHistory.slice(-10);
        let moodScore = 10; // Default

        if (recentMoods.length >= 3) {
            // Calculate mood trend
            const moodScores = recentMoods.map(m => m.score || this.getMoodScore(m.mood));
            const recentAvg = moodScores.slice(-3).reduce((a, b) => a + b, 0) / 3;
            const olderAvg = moodScores.slice(0, -3).reduce((a, b) => a + b, 0) / Math.max(moodScores.length - 3, 1);

            // Reward improving mood
            if (recentAvg > olderAvg) {
                moodScore = 15; // Improving
            } else if (recentAvg >= 75) {
                moodScore = 13; // Consistently good
            } else if (recentAvg >= 60) {
                moodScore = 10; // Moderate
            } else {
                moodScore = 7; // Concerning
            }

            // Bonus for recent positive moods
            const recentPositive = recentMoods.slice(-3).filter(m =>
                ['energized', 'calm', 'focused', 'happy'].includes(m.mood)
            ).length;
            if (recentPositive === 3) moodScore += 3;
        }
        score += Math.min(moodScore, 18);

        // 4. ENGAGEMENT QUALITY (15 points max)
        let engagementScore = 7; // Default

        if (recentRatings.length > 0) {
            const valuableCount = recentRatings.filter(r => r.rating === 'valuable').length;
            const valuableRatio = valuableCount / recentRatings.length;

            engagementScore = valuableRatio * 15;

            // Penalty for excessive skipping (mindless scrolling)
            const skipCount = recentRatings.filter(r => r.rating === 'skip').length;
            const skipRatio = skipCount / recentRatings.length;
            if (skipRatio > 0.7) {
                engagementScore *= 0.7; // 30% penalty for mindless scrolling
            }
        }
        score += engagementScore;

        // 5. CONSISTENCY BONUS (10 points max)
        let consistencyScore = 0;

        // Check streak
        if (this.userData.streak >= 7) consistencyScore += 5;
        else if (this.userData.streak >= 3) consistencyScore += 3;
        else if (this.userData.streak >= 1) consistencyScore += 1;

        // Check historical consistency
        const historicalDates = Object.keys(this.historicalData);
        if (historicalDates.length >= 5) {
            const recentScores = historicalDates.slice(-5).map(date =>
                this.historicalData[date].wellnessScore
            );
            const avgScore = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
            if (avgScore >= 75) consistencyScore += 5;
        }

        score += consistencyScore;

        // 6. CONTENT DIVERSITY (10 points max)
        let diversityScore = 5; // Default

        if (recentRatings.length >= 10) {
            const goalTypes = new Set(recentRatings.map(r => r.goal));
            const diversityRatio = goalTypes.size / 5; // Max 5 goal types
            diversityScore = diversityRatio * 10;

            // Slight bonus for exploring different content
            if (goalTypes.size >= 3) diversityScore += 2;
        }
        score += Math.min(diversityScore, 12);

        // 7. RECENCY WEIGHTING (5 points max)
        // Reward recent positive actions
        const lastHourRatings = this.userData.contentRatings.filter(r => {
            return Date.now() - r.timestamp < 3600000; // Last hour
        });

        let recencyScore = 2; // Default
        if (lastHourRatings.length > 0) {
            const recentAligned = lastHourRatings.filter(r => r.aligned && r.rating === 'valuable').length;
            const recentRatio = recentAligned / lastHourRatings.length;
            recencyScore = recentRatio * 5;
        }
        score += recencyScore;

        // FINAL ADJUSTMENTS
        // Normalize to 0-100 range
        score = Math.round(score);
        score = Math.max(20, Math.min(100, score)); // Floor at 20, ceiling at 100

        // Smooth transitions (moving average with previous score)
        const previousScore = this.userData.wellnessScore || 85;
        score = Math.round(previousScore * 0.3 + score * 0.7); // 70% new, 30% old

        this.userData.wellnessScore = score;

        // Only push score if it changed
        const lastScore = this.userData.dailyStats.wellnessScores.slice(-1)[0];
        if (!lastScore || Math.abs(lastScore - score) > 1) {
            this.userData.dailyStats.wellnessScores.push(score);

            // Keep only last 100 scores
            if (this.userData.dailyStats.wellnessScores.length > 100) {
                this.userData.dailyStats.wellnessScores = this.userData.dailyStats.wellnessScores.slice(-100);
            }
        }

        return score;
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

        // Update XP with level progression
        document.getElementById('total-xp').textContent = this.userData.xp.toLocaleString();
        this.updateLevelProgress();

        // Update streak
        document.getElementById('streak').textContent = `${this.userData.streak} days`;

        // Update sidebar level
        document.getElementById('sidebar-level').textContent = this.userData.level;

        // Update achievements
        this.loadAchievementsBadges();

        // Update daily challenge
        this.loadDailyChallengeCard();

        // Save data
        this.saveData();
        this.saveDailyStats();
        this.saveHistoricalData();
    }

    updateLevelProgress() {
        const xpForNextLevel = this.getXPForLevel(this.userData.level + 1);
        const xpForCurrentLevel = this.getXPForLevel(this.userData.level);
        const xpIntoLevel = this.userData.xp - xpForCurrentLevel;
        const xpNeeded = xpForNextLevel - xpForCurrentLevel;
        const progress = Math.min((xpIntoLevel / xpNeeded) * 100, 100);

        const progressBar = document.querySelector('.level-progress-bar');
        if (progressBar) {
            progressBar.style.width = `${progress}%`;
        }

        const progressText = document.querySelector('.level-progress-text');
        if (progressText) {
            progressText.textContent = `${xpIntoLevel}/${xpNeeded} XP to Level ${this.userData.level + 1}`;
        }
    }

    getXPForLevel(level) {
        // Exponential XP curve: Level 2 = 100, Level 3 = 250, Level 4 = 500, etc.
        return Math.floor(100 * Math.pow(level - 1, 1.5));
    }

    loadAchievementsBadges() {
        const container = document.querySelector('.achievements-showcase');
        if (!container) return;

        const definitions = this.getAchievementDefinitions();
        const recent = this.userData.achievements.slice(-4).reverse();

        if (recent.length === 0) {
            container.innerHTML = '<p class="no-achievements">Complete actions to unlock achievements!</p>';
            return;
        }

        container.innerHTML = recent.map(achievementId => {
            const achievement = definitions.find(a => a.id === achievementId);
            if (!achievement) return '';

            return `
                <div class="achievement-badge">
                    <div class="badge-icon">${achievement.icon}</div>
                    <div class="badge-info">
                        <div class="badge-name">${achievement.name}</div>
                        <div class="badge-desc">${achievement.description}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    loadDailyChallengeCard() {
        const container = document.querySelector('.daily-challenge-card');
        if (!container) return;

        if (!this.userData.dailyChallenge) {
            this.generateDailyChallenge();
        }

        const challenge = this.userData.dailyChallenge;
        const progress = challenge.progress || 0;
        const progressPercent = Math.min((progress / challenge.target) * 100, 100);
        const isComplete = progress >= challenge.target;

        container.innerHTML = `
            <div class="challenge-header">
                <h4>🎯 Daily Challenge</h4>
                <span class="challenge-reward">+${challenge.xpReward} XP</span>
            </div>
            <div class="challenge-name">${challenge.name}</div>
            <div class="challenge-description">${challenge.description}</div>
            <div class="challenge-progress">
                <div class="progress-bar">
                    <div class="progress-fill ${isComplete ? 'complete' : ''}" style="width: ${progressPercent}%"></div>
                </div>
                <div class="progress-text">
                    ${progress}/${challenge.target} ${isComplete ? '✅ Complete!' : ''}
                </div>
            </div>
        `;
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
                this.checkOwlTriggers();
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
        // Use real historical data for last 7 days
        const data = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateKey = date.toDateString();

            // Get historical score or use current as fallback
            const historicalScore = this.historicalData[dateKey]?.wellnessScore || this.userData.wellnessScore;
            data.push(historicalScore);
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
            { id: 'learn', icon: '📚', name: 'Learn Something', description: 'Engage with educational content' },
            { id: 'chill', icon: '😌', name: 'Chill Intentionally', description: 'Mindful relaxation time' },
            { id: 'reduce-anxiety', icon: '🧘', name: 'Reduce Anxiety', description: 'Focus on calming content' },
            { id: 'productivity', icon: '⚡', name: 'Be Productive', description: 'Work towards your goals' },
            { id: 'sleep', icon: '😴', name: 'Better Sleep', description: 'Wind down properly' }
        ];

        container.innerHTML = allGoals.map(goal => {
            const isSelected = this.userData.goals.includes(goal.id);
            return `
                <div class="goal-card ${isSelected ? 'selected' : ''}" data-goal-id="${goal.id}" style="cursor: pointer; position: relative;">
                    ${isSelected ? '<div class="goal-checkmark">✓</div>' : ''}
                    <div class="stat-icon wellness">${goal.icon}</div>
                    <div class="stat-content">
                        <div class="stat-label">${goal.name}</div>
                        <div style="font-size: 0.9rem; color: var(--text-secondary);">
                            ${goal.description}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Add click handlers
        container.querySelectorAll('.goal-card').forEach(card => {
            card.addEventListener('click', () => {
                const goalId = card.dataset.goalId;
                this.toggleGoal(goalId);
            });
        });
    }

    toggleGoal(goalId) {
        const index = this.userData.goals.indexOf(goalId);

        if (index === -1) {
            // Add goal
            this.userData.goals.push(goalId);
        } else {
            // Remove goal
            this.userData.goals.splice(index, 1);
        }

        // Save changes
        this.saveData();

        // Refresh goals page display
        this.loadGoalsPage();

        // Clear feed cache since goals changed
        this.redditCache.data.clear();
        this.redditCache.expiresAt.clear();

        // Show feedback
        this.addActivity('goal', `Updated goals: ${this.userData.goals.join(', ')}`, new Date());

        console.log('Goals updated:', this.userData.goals);
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

                        // Get best quality image
                        let imageUrl = null;
                        if (post.preview && post.preview.images && post.preview.images[0]) {
                            // Use preview image (higher quality)
                            imageUrl = post.preview.images[0].source.url.replace(/&amp;/g, '&');
                        } else if (post.thumbnail && post.thumbnail.startsWith('http')) {
                            // Fallback to thumbnail
                            imageUrl = post.thumbnail;
                        } else if (post.url && /\.(jpg|jpeg|png|gif|webp)$/i.test(post.url)) {
                            // Direct image link
                            imageUrl = post.url;
                        }

                        posts.push({
                            id: post.id,
                            title: post.title,
                            content: post.selftext ? post.selftext.substring(0, 300) : '',
                            author: post.author,
                            subreddit: post.subreddit,
                            url: `https://reddit.com${post.permalink}`,
                            thumbnail: imageUrl,
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

            // Start timer countdown
            this.startVoteTimer(card);
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
                    <div class="vote-timer" style="text-align: center; margin-bottom: var(--spacing-sm); font-size: 0.9rem; color: var(--text-secondary);">
                        ⏱️ Read for <span class="timer-countdown">15</span>s before rating
                    </div>
                    <button class="action-btn valuable" disabled>👍 Valuable</button>
                    <button class="action-btn skip" disabled>👎 Skip</button>
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

            // Start timer countdown
            this.startVoteTimer(card);
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
                    <div class="vote-timer" style="text-align: center; margin-bottom: var(--spacing-sm); font-size: 0.9rem; color: var(--text-secondary);">
                        ⏱️ Read for <span class="timer-countdown">15</span>s before rating
                    </div>
                    <button class="action-btn valuable" disabled>👍 Valuable</button>
                    <button class="action-btn skip" disabled>👎 Skip</button>
                </div>
            </div>
        `;
    }

    rateContent(card, rating) {
        const isAligned = card.dataset.aligned === 'true';
        const goal = card.dataset.goal;
        const contentId = card.dataset.id;
        const currentHour = new Date().getHours();

        // Record rating with enhanced metadata
        const ratingData = {
            id: contentId,
            goal: goal,
            aligned: isAligned,
            rating: rating,
            timestamp: Date.now(),
            hour: currentHour,
            sessionTime: Date.now() - this.sessionStartTime
        };

        this.userData.contentRatings.push(ratingData);
        this.userData.sessionRatings.push(ratingData);
        this.userData.totalContentRated++;

        if (rating === 'valuable') {
            this.userData.totalValuableContent++;
        }

        // Update hourly engagement patterns
        const hourData = this.userData.hourlyEngagement[currentHour];
        hourData.ratings++;
        if (rating === 'valuable') hourData.valuable++;
        if (isAligned) hourData.aligned++;
        if (rating === 'skip') hourData.skip++;

        // Track quality streaks
        if (rating === 'valuable' && isAligned) {
            this.userData.qualityStreakCurrent++;
            if (this.userData.qualityStreakCurrent > this.userData.qualityStreakBest) {
                this.userData.qualityStreakBest = this.userData.qualityStreakCurrent;
            }
            this.sessionAlignedCount++;
        } else {
            this.userData.qualityStreakCurrent = 0;
        }

        // Award XP with streak multipliers
        let xpGained = 0;
        let baseXP = 0;
        let multiplier = 1;

        if (rating === 'valuable') {
            baseXP = isAligned ? 15 : 5;

            // Streak multipliers
            if (this.userData.streak >= 30) multiplier = 3;
            else if (this.userData.streak >= 7) multiplier = 2;

            // Quality streak bonus
            if (this.userData.qualityStreakCurrent >= 5) {
                multiplier += 0.5;
            }

            xpGained = Math.round(baseXP * multiplier);
            this.userData.xp += xpGained;

            const bonusText = multiplier > 1 ? ` (${multiplier}x bonus!)` : '';
            this.addActivity('xp', `Earned ${xpGained} XP${bonusText}`, new Date());
        } else if (rating === 'skip') {
            if (!isAligned) {
                xpGained = 3;
                this.userData.xp += xpGained;
            }
        }

        // Show XP gain animation
        if (xpGained > 0) {
            this.showXPAnimation(card, xpGained, multiplier);
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

                // Start timer for new card
                this.startVoteTimer(addedCard);
            }
        }, 300);

        // Update stats
        this.userData.dailyStats.contentViewed++;
        this.calculateWellnessScore();
        this.updateAllStats();

        // Check for achievements and challenges
        this.updateDailyChallengeProgress();
        this.checkAchievements();

        // Live coaching and behavioral nudges
        this.provideLiveCoaching();
        this.detectMindlessScrolling();

        // Check owl triggers for contextual guidance
        this.checkOwlTriggers();

        // Update dashboard if visible
        this.updateDashboardCoaching();
    }

    startVoteTimer(card) {
        const timerDisplay = card.querySelector('.timer-countdown');
        const valuableBtn = card.querySelector('.action-btn.valuable');
        const skipBtn = card.querySelector('.action-btn.skip');
        const timerContainer = card.querySelector('.vote-timer');

        if (!timerDisplay || !valuableBtn || !skipBtn || !timerContainer) return;

        let timeLeft = 15;

        const interval = setInterval(() => {
            timeLeft--;
            timerDisplay.textContent = timeLeft;

            if (timeLeft <= 0) {
                clearInterval(interval);
                valuableBtn.disabled = false;
                skipBtn.disabled = false;
                timerContainer.style.display = 'none';
            }
        }, 1000);
    }

    // ===== LIVE COACHING & BEHAVIORAL NUDGES =====
    provideLiveCoaching() {
        const now = Date.now();
        const sessionDuration = (now - this.sessionStartTime) / 1000 / 60; // minutes

        // Don't spam - wait at least 2 minutes between messages
        if (now - this.userData.lastNudgeTime < 120000) return;

        const recentRatings = this.userData.sessionRatings.slice(-10);
        if (recentRatings.length < 5) return;

        const valuableCount = recentRatings.filter(r => r.rating === 'valuable').length;
        const alignedCount = recentRatings.filter(r => r.aligned).length;
        const valuableRate = valuableCount / recentRatings.length;
        const alignedRate = alignedCount / recentRatings.length;

        let message = null;
        let type = 'info';

        // Positive reinforcement
        if (valuableRate >= 0.8 && alignedRate >= 0.8) {
            const messages = [
                "🌟 You're in the zone! Great content choices!",
                "✨ Excellent flow! You're riding the algorithm perfectly.",
                "🎯 Amazing alignment! Keep this momentum going!",
                "🚀 You're on fire! Quality content streak!"
            ];
            message = messages[Math.floor(Math.random() * messages.length)];
            type = 'success';
        }
        // Gentle course correction
        else if (valuableRate < 0.3 && recentRatings.length >= 8) {
            message = "💭 Noticed you're skipping a lot. Need a mental break?";
            type = 'warning';
            this.userData.mindlessScrollDetected++;
        }
        // Micro-break suggestion
        else if (sessionDuration > 30 && valuableRate < 0.5) {
            message = "🧘 You've been scrolling for a while. Quick stretch?";
            type = 'info';
        }
        // Quality streak celebration
        else if (this.userData.qualityStreakCurrent === 5) {
            message = "🎯 5 in a row! You're building quality habits!";
            type = 'achievement';
        }

        if (message && message !== this.lastCoachingMessage) {
            this.showToast('Live Coaching', message, type);
            this.lastCoachingMessage = message;
            this.userData.lastNudgeTime = now;
        }
    }

    detectMindlessScrolling() {
        const recent = this.userData.sessionRatings.slice(-15);
        if (recent.length < 15) return;

        const lastMinute = recent.filter(r => Date.now() - r.timestamp < 60000);

        // Scrolling too fast = mindless
        if (lastMinute.length >= 10) {
            const skipRate = lastMinute.filter(r => r.rating === 'skip').length / lastMinute.length;
            if (skipRate > 0.7) {
                this.showToast(
                    '🌊 Slow Down',
                    'Take a breath. What are you looking for?',
                    'warning'
                );
                this.userData.mindlessScrollDetected++;
                this.userData.lastNudgeTime = Date.now();
            }
        }
    }

    showXPAnimation(card, xp, multiplier) {
        const xpElement = document.createElement('div');
        xpElement.className = 'xp-popup';
        xpElement.textContent = `+${xp} XP`;

        if (multiplier > 1) {
            xpElement.classList.add('multiplier');
            xpElement.textContent += ` ${multiplier}x`;
        }

        const rect = card.getBoundingClientRect();
        xpElement.style.position = 'fixed';
        xpElement.style.left = rect.left + rect.width / 2 + 'px';
        xpElement.style.top = rect.top + 'px';

        document.body.appendChild(xpElement);

        setTimeout(() => {
            xpElement.remove();
        }, 2000);
    }

    showToast(title, message, type = 'info') {
        // Create toast notification
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        `;

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('show');
        }, 10);

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    updateDashboardCoaching() {
        // Live session stats on dashboard
        const coachingContainer = document.querySelector('.live-coaching');
        if (!coachingContainer) return;

        const sessionDuration = Math.floor((Date.now() - this.sessionStartTime) / 1000 / 60);
        const sessionRatings = this.userData.sessionRatings.length;
        const sessionValuable = this.userData.sessionRatings.filter(r => r.rating === 'valuable').length;
        const sessionAlignmentRate = sessionRatings > 0
            ? Math.round((this.sessionAlignedCount / sessionRatings) * 100)
            : 0;

        coachingContainer.innerHTML = `
            <h4>📊 Live Session</h4>
            <div class="session-stats">
                <div class="stat-inline">
                    <span class="label">Duration:</span>
                    <span class="value">${sessionDuration} min</span>
                </div>
                <div class="stat-inline">
                    <span class="label">Rated:</span>
                    <span class="value">${sessionRatings} items</span>
                </div>
                <div class="stat-inline">
                    <span class="label">Valuable:</span>
                    <span class="value">${sessionValuable} (${sessionRatings > 0 ? Math.round((sessionValuable/sessionRatings)*100) : 0}%)</span>
                </div>
                <div class="stat-inline ${sessionAlignmentRate >= 80 ? 'excellent' : sessionAlignmentRate >= 60 ? 'good' : ''}">
                    <span class="label">Alignment:</span>
                    <span class="value">${sessionAlignmentRate}%</span>
                </div>
                ${this.userData.qualityStreakCurrent >= 3 ? `
                    <div class="streak-indicator">
                        🔥 ${this.userData.qualityStreakCurrent} quality streak!
                    </div>
                ` : ''}
            </div>
        `;
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
    async loadAnalytics() {
        console.log('Loading analytics page...');

        // Clear existing charts to prevent duplicates
        if (this.usageHeatmapChart) {
            this.usageHeatmapChart.destroy();
            this.usageHeatmapChart = null;
        }
        if (this.timeDistChart) {
            this.timeDistChart.destroy();
            this.timeDistChart = null;
        }
        if (this.moodChartInstance) {
            this.moodChartInstance.destroy();
            this.moodChartInstance = null;
        }

        // Check if Chart.js is loaded
        if (typeof Chart === 'undefined') {
            console.error('Chart.js not loaded');
            return;
        }

        // CRITICAL FIX: Wait for browser to complete layout pass
        // Double requestAnimationFrame ensures canvas elements have computed dimensions
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

        // Verify all canvas elements exist and have dimensions
        const heatmapCanvas = document.getElementById('usage-heatmap');
        const distCanvas = document.getElementById('time-distribution');
        const moodCanvas = document.getElementById('mood-chart');

        console.log('Canvas elements found:', {
            heatmap: !!heatmapCanvas,
            distribution: !!distCanvas,
            mood: !!moodCanvas
        });

        if (heatmapCanvas) {
            const rect = heatmapCanvas.getBoundingClientRect();
            console.log('Heatmap canvas dimensions:', rect.width, 'x', rect.height);
        }

        // Load all charts
        this.loadUsageHeatmap();
        this.loadTimeDistribution();
        this.loadMoodChart();

        // Load advanced analytics
        this.loadQualityTrendsChart();
        this.loadTimeOfDayHeatmap();
        this.generateWeeklyInsights();

        console.log('Analytics charts initialized');
    }

    loadUsageHeatmap() {
        const canvas = document.getElementById('usage-heatmap');
        if (!canvas) {
            console.error('Usage heatmap canvas not found');
            return;
        }

        // Verify canvas has dimensions
        const rect = canvas.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
            console.error('Usage heatmap canvas has zero dimensions:', rect);
            return;
        }

        if (typeof Chart === 'undefined') {
            console.error('Chart.js not loaded for heatmap');
            return;
        }

        try {
            const data = this.generateHeatmapData();
            console.log('Heatmap data:', data);
            console.log('Creating heatmap chart with dimensions:', rect.width, 'x', rect.height);

            this.usageHeatmapChart = new Chart(canvas, {
                type: 'bar',
                data: {
                    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                    datasets: [{
                        label: 'Screen Time (hours)',
                        data: data,
                        backgroundColor: '#6366f1',
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: (context) => `${context.parsed.y.toFixed(1)} hours`
                            }
                        }
                    },
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

            console.log('Usage heatmap chart created successfully');
        } catch (error) {
            console.error('Failed to create heatmap chart:', error);
        }
    }

    loadTimeDistribution() {
        const canvas = document.getElementById('time-distribution');
        if (!canvas) {
            console.error('Time distribution canvas not found');
            return;
        }

        // Verify canvas has dimensions
        const rect = canvas.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
            console.error('Time distribution canvas has zero dimensions:', rect);
            return;
        }

        if (typeof Chart === 'undefined') {
            console.error('Chart.js not loaded for time distribution');
            return;
        }

        try {
            console.log('Creating time distribution chart with dimensions:', rect.width, 'x', rect.height);
            // Calculate actual distribution based on content ratings
            const ratings = this.userData.contentRatings;
            let social = 0, learning = 0, entertainment = 0, productive = 0;

            if (ratings.length > 0) {
                ratings.forEach(rating => {
                    if (rating.goal === 'learn') learning++;
                    else if (rating.goal === 'productivity') productive++;
                    else if (rating.goal === 'chill') entertainment++;
                    else social++;
                });
            } else {
                // Default values for new users
                social = 35;
                learning = 25;
                entertainment = 25;
                productive = 15;
            }

            this.timeDistChart = new Chart(canvas, {
                type: 'doughnut',
                data: {
                    labels: ['Social', 'Learning', 'Entertainment', 'Productive'],
                    datasets: [{
                        data: [social, learning, entertainment, productive],
                        backgroundColor: ['#6366f1', '#10b981', '#f59e0b', '#ec4899'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                color: '#94a3b8',
                                padding: 15,
                                font: { size: 12 }
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: (context) => {
                                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                    const percentage = ((context.parsed / total) * 100).toFixed(1);
                                    return `${context.label}: ${percentage}%`;
                                }
                            }
                        }
                    }
                }
            });

            console.log('Time distribution chart created successfully');
        } catch (error) {
            console.error('Failed to create time distribution chart:', error);
        }
    }

    loadMoodChart() {
        const canvas = document.getElementById('mood-chart');
        if (!canvas) {
            console.error('Mood chart canvas not found');
            return;
        }

        // Verify canvas has dimensions
        const rect = canvas.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
            console.error('Mood chart canvas has zero dimensions:', rect);
            return;
        }

        if (typeof Chart === 'undefined') {
            console.error('Chart.js not loaded for mood chart');
            return;
        }

        try {
            console.log('Creating mood chart with dimensions:', rect.width, 'x', rect.height);
            // Get real mood data for last 7 days
            const moodData = [];
            for (let i = 6; i >= 0; i--) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                const dateKey = date.toDateString();

                // Get moods for this day
                const dayMoods = this.userData.moodHistory.filter(m => {
                    return new Date(m.time).toDateString() === dateKey;
                });

                // Calculate average mood score for the day
                if (dayMoods.length > 0) {
                    const avgScore = dayMoods.reduce((sum, m) => sum + (m.score || this.getMoodScore(m.mood)), 0) / dayMoods.length;
                    moodData.push(Math.round(avgScore));
                } else {
                    // No data for this day, use baseline
                    moodData.push(i === 0 ? 85 : null); // null for missing data, 85 for today
                }
            }

            this.moodChartInstance = new Chart(canvas, {
                type: 'line',
                data: {
                    labels: this.getLast7Days(),
                    datasets: [{
                        label: 'Mood Score',
                        data: moodData,
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        fill: true,
                        tension: 0.4,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        spanGaps: true // Connect across null values
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: (context) => `Mood: ${context.parsed.y}/100`
                            }
                        }
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

            console.log('Mood chart created successfully');
        } catch (error) {
            console.error('Failed to create mood chart:', error);
        }
    }

    generateHeatmapData() {
        // Use real historical screen time data for last 7 days
        const data = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateKey = date.toDateString();

            // Get historical screen time in hours
            const screenTimeSeconds = this.historicalData[dateKey]?.screenTime || 0;
            const screenTimeHours = screenTimeSeconds / 3600;
            data.push(Math.round(screenTimeHours * 10) / 10); // Round to 1 decimal
        }
        return data;
    }

    // ===== ADVANCED ANALYTICS =====
    loadQualityTrendsChart() {
        const canvas = document.getElementById('quality-trends-chart');
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        // Calculate quality trends over last 14 days
        const qualityData = [];
        const labels = [];

        for (let i = 13; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateKey = date.toDateString();

            const dayRatings = this.userData.contentRatings.filter(r => {
                return new Date(r.timestamp).toDateString() === dateKey;
            });

            let quality = null;
            if (dayRatings.length >= 3) {
                const valuable = dayRatings.filter(r => r.rating === 'valuable').length;
                quality = Math.round((valuable / dayRatings.length) * 100);
            }

            qualityData.push(quality);
            labels.push(this.formatShortDate(date));
        }

        if (this.qualityTrendsChart) {
            this.qualityTrendsChart.destroy();
        }

        this.qualityTrendsChart = new Chart(canvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Content Quality %',
                    data: qualityData,
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    fill: true,
                    tension: 0.4,
                    spanGaps: true
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
                        ticks: { color: '#94a3b8', maxRotation: 45 }
                    }
                }
            }
        });
    }

    loadTimeOfDayHeatmap() {
        const canvas = document.getElementById('time-heatmap-chart');
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        // Calculate quality by hour
        const hourlyQuality = [];
        const labels = [];

        for (let hour = 0; hour < 24; hour++) {
            const hourData = this.userData.hourlyEngagement[hour];

            let quality = 0;
            if (hourData.ratings > 0) {
                quality = Math.round((hourData.valuable / hourData.ratings) * 100);
            }

            hourlyQuality.push(hourData.ratings > 0 ? quality : null);

            // Format hour (12h format)
            const ampm = hour >= 12 ? 'PM' : 'AM';
            const hour12 = hour % 12 || 12;
            labels.push(`${hour12}${ampm}`);
        }

        if (this.timeHeatmapChart) {
            this.timeHeatmapChart.destroy();
        }

        this.timeHeatmapChart = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Quality %',
                    data: hourlyQuality,
                    backgroundColor: hourlyQuality.map(q => {
                        if (q === null) return '#1e293b';
                        if (q >= 75) return '#10b981';
                        if (q >= 50) return '#f59e0b';
                        return '#ef4444';
                    }),
                    borderRadius: 2
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
                        grid: { display: false },
                        ticks: { color: '#94a3b8', font: { size: 9 } }
                    }
                }
            }
        });
    }

    generateWeeklyInsights() {
        const container = document.querySelector('.weekly-insights');
        if (!container) return;

        // Calculate last 7 days vs previous 7 days
        const now = new Date();
        const thisWeek = [];
        const lastWeek = [];

        for (let i = 0; i < 7; i++) {
            const thisDate = new Date(now);
            thisDate.setDate(now.getDate() - i);

            const lastDate = new Date(now);
            lastDate.setDate(now.getDate() - i - 7);

            const thisRatings = this.userData.contentRatings.filter(r => {
                return new Date(r.timestamp).toDateString() === thisDate.toDateString();
            });

            const lastRatings = this.userData.contentRatings.filter(r => {
                return new Date(r.timestamp).toDateString() === lastDate.toDateString();
            });

            thisWeek.push(...thisRatings);
            lastWeek.push(...lastRatings);
        }

        // Calculate metrics
        const thisValuable = thisWeek.filter(r => r.rating === 'valuable').length;
        const lastValuable = lastWeek.filter(r => r.rating === 'valuable').length;

        const thisAligned = thisWeek.filter(r => r.aligned).length;
        const lastAligned = lastWeek.filter(r => r.aligned).length;

        const thisQuality = thisWeek.length > 0 ? (thisValuable / thisWeek.length) * 100 : 0;
        const lastQuality = lastWeek.length > 0 ? (lastValuable / lastWeek.length) * 100 : 0;

        const thisAlignment = thisWeek.length > 0 ? (thisAligned / thisWeek.length) * 100 : 0;
        const lastAlignment = lastWeek.length > 0 ? (lastAligned / lastWeek.length) * 100 : 0;

        const qualityChange = thisQuality - lastQuality;
        const alignmentChange = thisAlignment - lastAlignment;

        // Find best/worst hours
        const bestHour = this.findBestHour();
        const worstHour = this.findWorstHour();

        // Generate insights
        const insights = [];

        if (qualityChange > 5) {
            insights.push({
                type: 'positive',
                icon: '📈',
                text: `Content quality improved by ${Math.round(qualityChange)}% this week!`
            });
        } else if (qualityChange < -5) {
            insights.push({
                type: 'negative',
                icon: '📉',
                text: `Content quality dropped ${Math.round(Math.abs(qualityChange))}% this week.`
            });
        }

        if (alignmentChange > 5) {
            insights.push({
                type: 'positive',
                icon: '🎯',
                text: `Goal alignment up ${Math.round(alignmentChange)}%! You're finding what matters.`
            });
        }

        if (this.userData.qualityStreakBest >= 5) {
            insights.push({
                type: 'achievement',
                icon: '🔥',
                text: `Best streak: ${this.userData.qualityStreakBest} quality items in a row!`
            });
        }

        if (bestHour) {
            const ampm = bestHour >= 12 ? 'PM' : 'AM';
            const hour12 = bestHour % 12 || 12;
            insights.push({
                type: 'info',
                icon: '⏰',
                text: `You're most mindful around ${hour12}${ampm}`
            });
        }

        if (worstHour && this.userData.hourlyEngagement[worstHour].ratings >= 5) {
            const ampm = worstHour >= 12 ? 'PM' : 'AM';
            const hour12 = worstHour % 12 || 12;
            insights.push({
                type: 'warning',
                icon: '⚠️',
                text: `Mindless scrolling tends to happen around ${hour12}${ampm}`
            });
        }

        if (this.userData.streak >= 7) {
            insights.push({
                type: 'positive',
                icon: '💎',
                text: `${this.userData.streak}-day streak! You're building lasting habits.`
            });
        }

        // Render insights
        if (insights.length === 0) {
            container.innerHTML = '<p class="no-insights">Keep rating content to unlock personalized insights!</p>';
            return;
        }

        container.innerHTML = insights.map(insight => `
            <div class="insight-card insight-${insight.type}">
                <span class="insight-icon">${insight.icon}</span>
                <span class="insight-text">${insight.text}</span>
            </div>
        `).join('');
    }

    findBestHour() {
        let bestHour = -1;
        let bestQuality = 0;

        for (let hour = 0; hour < 24; hour++) {
            const hourData = this.userData.hourlyEngagement[hour];
            if (hourData.ratings < 5) continue; // Need at least 5 ratings

            const quality = (hourData.valuable / hourData.ratings) * 100;
            if (quality > bestQuality) {
                bestQuality = quality;
                bestHour = hour;
            }
        }

        return bestHour >= 0 ? bestHour : null;
    }

    findWorstHour() {
        let worstHour = -1;
        let worstQuality = 100;

        for (let hour = 0; hour < 24; hour++) {
            const hourData = this.userData.hourlyEngagement[hour];
            if (hourData.ratings < 5) continue;

            const quality = (hourData.valuable / hourData.ratings) * 100;
            if (quality < worstQuality) {
                worstQuality = quality;
                worstHour = hour;
            }
        }

        return worstHour >= 0 ? worstHour : null;
    }

    formatShortDate(date) {
        const month = date.getMonth() + 1;
        const day = date.getDate();
        return `${month}/${day}`;
    }

    // ===== OWL CHATBOT COMPANION =====
    getOwlPersonality() {
        const personalities = {
            encouraging: {
                name: 'Encouraging',
                emoji: '🦉',
                description: 'Supportive and positive vibes'
            },
            'tough-love': {
                name: 'Tough Love',
                emoji: '🦉',
                description: 'Direct and keeps you accountable'
            },
            zen: {
                name: 'Zen Master',
                emoji: '🦉',
                description: 'Calm and mindful guidance'
            },
            quirky: {
                name: 'Quirky Companion',
                emoji: '🦉',
                description: 'Fun and slightly chaotic'
            }
        };
        return personalities[this.userData.owlTemperament] || personalities.encouraging;
    }

    getOwlMessages(context) {
        const temperament = this.userData.owlTemperament;
        const messages = {
            // When wellness score drops
            low_wellness: {
                encouraging: [
                    "Hey friend! I noticed your wellness score dipped. You're still awesome - let's get back on track! 🌟",
                    "Don't worry about the score! Every great journey has bumps. What matters is you're here trying. 💚",
                    "I believe in you! Small steps lead to big changes. Ready to turn this around?"
                ],
                'tough-love': [
                    "Alright, real talk: Your wellness score is dropping. Time to step up and make better choices. You got this!",
                    "I'm not mad, just disappointed... JK! But seriously, let's fix this. No more mindless scrolling!",
                    "Stop what you're doing. Look at that score. Now let's make it better. Action time!"
                ],
                zen: [
                    "Notice the score without judgment. It's just information. Breathe, reset, continue. 🧘",
                    "The score is low, but you are not the score. Return to your intentions. All is well.",
                    "Observe this moment. Your awareness is already the first step toward balance."
                ],
                quirky: [
                    "🚨 BEEP BOOP! Wellness systems at 42%! (Hitchhiker's Guide reference? No? Just me?) Let's boost those numbers!",
                    "Your wellness score and I had a chat. It's feeling neglected. Show it some love!",
                    "Plot twist: The real wellness was the content we skipped along the way! 🦉✨"
                ]
            },

            // After quality streak
            quality_streak: {
                encouraging: [
                    "WOW! Look at that quality streak! You're absolutely crushing it! Keep going! 🔥",
                    "This is what I'm talking about! You're making fantastic choices! So proud! ✨",
                    "Your streak is FIRE! You're building amazing habits right now! 🌟"
                ],
                'tough-love': [
                    "Finally! THIS is what I like to see. Don't stop now - keep that momentum!",
                    "Decent streak. Don't let it get to your head though. Consistency is what counts.",
                    "Good. Now double it. I know you can."
                ],
                zen: [
                    "Observe the flow state you've entered. This is mindful consumption. Beautiful. 🌸",
                    "The streak is not the goal. The awareness behind each choice is. Well done.",
                    "You are present. You are intentional. This is the way."
                ],
                quirky: [
                    "STREAK ALERT! 🎉 Someone call the fire department because you're ON FIRE! (Metaphorically!)",
                    "My owl senses are tingling! Quality content streak detected! *does owl victory dance*",
                    "Achievement unlocked: Actual Good Decision Maker! Who even are you right now?! 🦉✨"
                ]
            },

            // Mindless scrolling detected
            mindless_scroll: {
                encouraging: [
                    "Hey, I see you're scrolling pretty fast! Maybe time for a quick breather? You deserve it! 💙",
                    "Just checking in! You've been at this a while. How about a stretch or some water? 😊",
                    "Friend reminder: You came here for a reason. What was it again?"
                ],
                'tough-love': [
                    "STOP. Right now. You're doomscrolling and you know it. Close this or be intentional!",
                    "Be honest: Are you finding what you need, or just burning time? Make a choice!",
                    "You're better than this. Either focus up or take a real break!"
                ],
                zen: [
                    "Notice the scrolling. Notice the seeking. What are you truly looking for? 🍃",
                    "The scroll continues, yet nothing changes. Perhaps it's time to pause. Breathe.",
                    "Observe the pattern. You have the power to break it. Right now. This moment."
                ],
                quirky: [
                    "HALT! You've entered the Scroll Vortex™! Emergency extraction needed! 🚁",
                    "My owl eyes are getting dizzy watching you scroll! Even I need a break! 🌀",
                    "*waves wings frantically* HUMAN! HELLO! Anyone in there?! Time for a reality check!"
                ]
            },

            // After completing daily challenge
            challenge_complete: {
                encouraging: [
                    "YOU DID IT! Daily challenge complete! I'm so excited for you! 🎉🎊",
                    "Challenge crushed! You're building such amazing habits! Keep shining! ✨",
                    "That's my human! Challenge complete! You earned that XP!"
                ],
                'tough-love': [
                    "Challenge done. Good. That's the bare minimum for success. Now what's next?",
                    "Nice. Challenge complete. Don't celebrate too long - there's always another goal.",
                    "Completed it. Good work. Now keep that energy going!"
                ],
                zen: [
                    "The challenge is complete. The practice continues. Well done. 🙏",
                    "Achievement noted. But remember: the journey itself is the destination.",
                    "You set an intention. You followed through. This is mindful living."
                ],
                quirky: [
                    "🎺 CHALLENGE COMPLETE! *confetti cannon* *owl party* THIS IS AMAZING!",
                    "Did you just...? YOU DID! Challenge = DEMOLISHED! *chef's kiss* 🦉👌",
                    "Breaking news: Local human completes challenge! Sources say 'they're awesome'!"
                ]
            },

            // Random check-ins
            checkin: {
                encouraging: [
                    "Hey you! Just wanted to say you're doing great! Keep being awesome! 💫",
                    "Quick check-in: How are you feeling? Remember, I'm here to help! 🦉",
                    "You're making progress even when it doesn't feel like it. Trust the process! ✨"
                ],
                'tough-love': [
                    "Status check: Are you staying on track or slipping? Be honest.",
                    "Quick question: Are you here with purpose or just passing time?",
                    "Remember your goals? Yeah, me too. Let's stick to them."
                ],
                zen: [
                    "This moment is an opportunity. How will you use it? 🌿",
                    "Breathe in awareness. Breathe out distraction. You are here now.",
                    "The screen glows. The mind wanders. Gently return to intention."
                ],
                quirky: [
                    "🦉 Owl interruption! How's my favorite human doing? *ruffles feathers*",
                    "Random owl fact: Did you know owls can rotate their heads 270°? Cool, right? Also, how ya doing?",
                    "BEEP! Cuteness check! You're still adorable! Also, staying mindful? *winks with one eye*"
                ]
            },

            // Long session warning
            long_session: {
                encouraging: [
                    "You've been here a while! Maybe time for a little break? Your brain will thank you! 🌸",
                    "Long session detected! You've got this, but breaks are healthy too! 💚",
                    "Hey, superstar! Maybe stretch those legs? You've earned a breather!"
                ],
                'tough-love': [
                    "You've been scrolling way too long. Take a break. Not a suggestion.",
                    "Session time is through the roof. Either take a break or make it count!",
                    "How long are you gonna sit here? Move. Now. Break time!"
                ],
                zen: [
                    "Time flows like water. You've been here long. Consider flowing elsewhere. 🌊",
                    "The session grows long. The body grows still. Movement is medicine. Rise.",
                    "Notice the passage of time. Honor your body's needs. Take space."
                ],
                quirky: [
                    "URGENT OWL BUSINESS! You've been sitting for *checks notes* way too long! Fly, human! 🦉",
                    "My calculations show you've achieved maximum screen time! Achievement unlocked: Couch Potato! (jk love u, take a break tho)",
                    "*taps on screen* Testing testing, is this thing on? Oh good! Your butt needs a break! 🪑❌"
                ]
            }
        };

        return messages[context]?.[temperament] || messages[context]?.encouraging || [];
    }

    shouldOwlAppear() {
        if (!this.userData.owlEnabled) return false;

        const now = Date.now();
        const timeSinceLastAppearance = now - this.userData.lastOwlAppearance;

        // Don't spam - at least 3 minutes between appearances
        if (timeSinceLastAppearance < 180000) return false;

        // If user dismisses owl too much, reduce frequency
        if (this.userData.owlDismissals > 10 && timeSinceLastAppearance < 600000) return false;

        return true;
    }

    triggerOwlAppearance(context, forceShow = false) {
        if (!forceShow && !this.shouldOwlAppear()) return;

        const messages = this.getOwlMessages(context);
        if (messages.length === 0) return;

        const randomMessage = messages[Math.floor(Math.random() * messages.length)];
        this.showOwl(randomMessage, context);

        this.userData.lastOwlAppearance = Date.now();
        this.userData.owlInteractions.push({
            context,
            message: randomMessage,
            timestamp: Date.now()
        });

        // Keep last 50 interactions
        if (this.userData.owlInteractions.length > 50) {
            this.userData.owlInteractions = this.userData.owlInteractions.slice(-50);
        }

        this.saveData();
    }

    showOwl(message, context) {
        // Remove existing owl
        const existing = document.querySelector('.owl-companion');
        if (existing) existing.remove();

        const owl = document.createElement('div');
        owl.className = 'owl-companion';
        owl.innerHTML = `
            <div class="owl-container">
                <div class="owl-character">
                    <div class="owl-body">
                        <div class="owl-face">
                            <div class="owl-eyes">
                                <div class="owl-eye left">
                                    <div class="owl-pupil"></div>
                                </div>
                                <div class="owl-eye right">
                                    <div class="owl-pupil"></div>
                                </div>
                            </div>
                            <div class="owl-beak"></div>
                        </div>
                        <div class="owl-wing left"></div>
                        <div class="owl-wing right"></div>
                    </div>
                    <div class="owl-feet">
                        <div class="owl-foot left"></div>
                        <div class="owl-foot right"></div>
                    </div>
                </div>
                <div class="owl-speech-bubble">
                    <div class="owl-message">${message}</div>
                    <div class="owl-actions">
                        <button class="owl-btn owl-dismiss" onclick="app.dismissOwl()">Thanks!</button>
                        <button class="owl-btn owl-snooze" onclick="app.snoozeOwl()">Later</button>
                    </div>
                </div>
                <button class="owl-close" onclick="app.dismissOwl()">&times;</button>
            </div>
        `;

        document.body.appendChild(owl);

        // Animate entrance
        setTimeout(() => owl.classList.add('owl-visible'), 10);

        // Auto-dismiss after 15 seconds
        setTimeout(() => {
            if (document.contains(owl)) {
                this.dismissOwl(true);
            }
        }, 15000);

        // Animate eyes to follow cursor (fun detail)
        this.animateOwlEyes(owl);
    }

    animateOwlEyes(owl) {
        const leftPupil = owl.querySelector('.owl-pupil');
        const rightPupil = owl.querySelectorAll('.owl-pupil')[1];

        document.addEventListener('mousemove', function moveEyes(e) {
            if (!document.contains(owl)) {
                document.removeEventListener('mousemove', moveEyes);
                return;
            }

            const leftEye = owl.querySelector('.owl-eye.left');
            const rightEye = owl.querySelector('.owl-eye.right');

            if (!leftEye || !rightEye) return;

            const moveEye = (eye, pupil) => {
                const rect = eye.getBoundingClientRect();
                const eyeCenterX = rect.left + rect.width / 2;
                const eyeCenterY = rect.top + rect.height / 2;

                const angle = Math.atan2(e.clientY - eyeCenterY, e.clientX - eyeCenterX);
                const distance = Math.min(rect.width * 0.2, 8);

                const x = Math.cos(angle) * distance;
                const y = Math.sin(angle) * distance;

                pupil.style.transform = `translate(${x}px, ${y}px)`;
            };

            moveEye(leftEye, leftPupil);
            moveEye(rightEye, rightPupil);
        });
    }

    dismissOwl(auto = false) {
        const owl = document.querySelector('.owl-companion');
        if (owl) {
            owl.classList.add('owl-hidden');
            setTimeout(() => owl.remove(), 300);

            if (!auto) {
                this.userData.owlDismissals++;
            }
            this.saveData();
        }
    }

    snoozeOwl() {
        this.dismissOwl();
        // Snooze for 30 minutes
        this.userData.lastOwlAppearance = Date.now() + (30 * 60 * 1000);
        this.saveData();
    }

    // Context-aware triggers
    checkOwlTriggers() {
        // Low wellness
        if (this.userData.wellnessScore < 60) {
            if (Math.random() < 0.3) { // 30% chance
                this.triggerOwlAppearance('low_wellness');
            }
        }

        // Quality streak
        if (this.userData.qualityStreakCurrent >= 2) {
            if (Math.random() < 0.5) { // 50% chance
                this.triggerOwlAppearance('quality_streak');
            }
        }

        // Mindless scrolling
        if (this.userData.mindlessScrollDetected > 3) {
            if (Math.random() < 0.4) { // 40% chance
                this.triggerOwlAppearance('mindless_scroll');
            }
        }

        // Long session (over 45 minutes)
        const sessionTime = (Date.now() - this.sessionStartTime) / 60000;
        if (sessionTime > 45) {
            if (Math.random() < 0.3) { // 30% chance
                this.triggerOwlAppearance('long_session');
            }
        }

        // Random check-in (10% chance every check)
        if (Math.random() < 0.1) {
            this.triggerOwlAppearance('checkin');
        }
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

    setupOwlSettings() {
        // Owl enable/disable toggle
        const owlEnabledCheckbox = document.getElementById('owl-enabled');
        if (owlEnabledCheckbox) {
            owlEnabledCheckbox.checked = this.userData.owlEnabled;

            owlEnabledCheckbox.addEventListener('change', (e) => {
                this.userData.owlEnabled = e.target.checked;
                this.saveData();

                // Toggle visibility of settings
                const owlSettingsDiv = document.getElementById('owl-settings');
                if (owlSettingsDiv) {
                    owlSettingsDiv.style.opacity = e.target.checked ? '1' : '0.5';
                    owlSettingsDiv.style.pointerEvents = e.target.checked ? 'auto' : 'none';
                }
            });
        }

        // Hardcore mode toggle
        const hardcoreModeCheckbox = document.getElementById('hardcore-mode');
        if (hardcoreModeCheckbox) {
            hardcoreModeCheckbox.checked = this.userData.hardcoreMode;

            hardcoreModeCheckbox.addEventListener('change', (e) => {
                this.userData.hardcoreMode = e.target.checked;
                this.saveData();

                // Show confirmation toast
                if (e.target.checked) {
                    this.showToast('⚡ Hardcore mode enabled! You\'ll be restricted from social media for 24 hours if you don\'t meet your daily wellness goals.', 'warning');
                } else {
                    this.showToast('Hardcore mode disabled', 'info');
                }
            });
        }

        // Temperament selection
        document.querySelectorAll('.temperament-option').forEach(option => {
            // Set initial selection
            if (option.dataset.temperament === this.userData.owlTemperament) {
                option.classList.add('selected');
            }

            option.addEventListener('click', () => {
                // Remove selection from all
                document.querySelectorAll('.temperament-option').forEach(opt => {
                    opt.classList.remove('selected');
                });

                // Add selection to clicked
                option.classList.add('selected');

                // Save temperament
                this.userData.owlTemperament = option.dataset.temperament;
                this.saveData();

                // Show confirmation toast
                this.showToast(`Owl temperament changed to ${option.querySelector('.temperament-name').textContent}! 🦉`, 'info');
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

    // ===== DATA EXPORT =====
    exportData() {
        const exportData = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            userData: this.userData,
            dailyStats: this.userData.dailyStats
        };

        // Create blob
        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: 'application/json'
        });

        // Create download link
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `scroll-balance-export-${Date.now()}.json`;
        a.click();

        // Cleanup
        URL.revokeObjectURL(url);

        // Show feedback
        this.addActivity('export', 'Data exported successfully', new Date());
        console.log('Data exported successfully');
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ScrollBalancePro();
    window.scrollBalancePro = window.app; // Keep backwards compatibility
});
