// Scroll Balance - Main Application Logic

class ScrollBalance {
    constructor() {
        this.userGoals = [];
        this.xp = 0;
        this.level = 1;
        this.timeSpent = 0; // in seconds
        this.contentViewed = 0;
        this.lastFrictionTime = 0;
        this.sessionStart = Date.now();

        // XP thresholds for leveling up
        this.xpThresholds = [0, 100, 250, 500, 1000, 2000, 4000, 8000];

        this.init();
    }

    init() {
        this.loadSavedData();
        this.setupOnboarding();
        this.setupFeed();
        this.startTimeTracking();
    }

    // Load saved progress from localStorage
    loadSavedData() {
        const saved = localStorage.getItem('scrollBalance');
        if (saved) {
            const data = JSON.parse(saved);
            this.xp = data.xp || 0;
            this.level = data.level || 1;
            this.userGoals = data.goals || [];

            // If user has goals, skip onboarding
            if (this.userGoals.length > 0) {
                this.showFeed();
            }
        }
    }

    saveData() {
        const data = {
            xp: this.xp,
            level: this.level,
            goals: this.userGoals
        };
        localStorage.setItem('scrollBalance', JSON.stringify(data));
    }

    // ONBOARDING
    setupOnboarding() {
        const goalButtons = document.querySelectorAll('.goal-btn');
        const startBtn = document.getElementById('start-btn');

        goalButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                btn.classList.toggle('selected');

                const goal = btn.dataset.goal;
                if (this.userGoals.includes(goal)) {
                    this.userGoals = this.userGoals.filter(g => g !== goal);
                } else {
                    this.userGoals.push(goal);
                }

                startBtn.disabled = this.userGoals.length === 0;
            });
        });

        startBtn.addEventListener('click', () => {
            this.saveData();
            this.showFeed();
        });
    }

    showFeed() {
        document.getElementById('onboarding').classList.remove('active');
        document.getElementById('feed').classList.add('active');
        this.updateStats();
        this.loadContent();
    }

    // FEED MANAGEMENT
    setupFeed() {
        // Setup friction overlay buttons
        document.getElementById('reflect-btn').addEventListener('click', () => {
            this.showReflectionModal();
        });

        document.getElementById('continue-btn').addEventListener('click', () => {
            this.hideFrictionOverlay();
        });

        // Setup reflection modal
        document.querySelectorAll('.mood-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
            });
        });

        document.getElementById('close-reflection').addEventListener('click', () => {
            this.closeReflectionModal();
            this.addXP(10, 'Self-reflection bonus');
        });
    }

    loadContent() {
        const feed = document.getElementById('content-feed');

        // Generate 5 pieces of content at a time
        for (let i = 0; i < 5; i++) {
            const content = this.generateContent();
            feed.appendChild(content);
        }

        // Infinite scroll
        window.addEventListener('scroll', () => {
            if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500) {
                this.loadContent();
            }
        });
    }

    generateContent() {
        const contentTypes = [
            { goal: 'learn', emoji: '🧠', topics: ['History', 'Science', 'Technology', 'Philosophy'] },
            { goal: 'chill', emoji: '😌', topics: ['Nature', 'Music', 'Art', 'Comedy'] },
            { goal: 'reduce-anxiety', emoji: '🧘', topics: ['Meditation', 'Mindfulness', 'Breathing', 'Calm'] },
            { goal: 'productivity', emoji: '⚡', topics: ['Tips', 'Hacks', 'Workflow', 'Tools'] },
            { goal: 'sleep', emoji: '😴', topics: ['Relaxation', 'Night Routine', 'Sleep Tips', 'ASMR'] }
        ];

        // Pick a random content type, preferring user goals
        let contentType;
        if (Math.random() > 0.3 && this.userGoals.length > 0) {
            const randomGoal = this.userGoals[Math.floor(Math.random() * this.userGoals.length)];
            contentType = contentTypes.find(ct => ct.goal === randomGoal) || contentTypes[0];
        } else {
            contentType = contentTypes[Math.floor(Math.random() * contentTypes.length)];
        }

        const topic = contentType.topics[Math.floor(Math.random() * contentType.topics.length)];
        const isAligned = this.userGoals.includes(contentType.goal);

        const card = document.createElement('div');
        card.className = 'content-card';
        card.dataset.goal = contentType.goal;
        card.dataset.aligned = isAligned;

        const usernames = ['@mindfulcreator', '@brainrot_academy', '@chillvibes', '@producti_beast', '@zenmaster'];
        const username = usernames[Math.floor(Math.random() * usernames.length)];

        card.innerHTML = `
            <div class="content-header">
                <div class="content-avatar">${contentType.emoji}</div>
                <div class="content-info">
                    <div class="content-username">${username}</div>
                    <div class="content-goal">${topic}</div>
                </div>
            </div>
            <div class="content-body">
                <div class="content-media">${contentType.emoji}</div>
                <div class="content-text">
                    ${this.generateContentText(contentType.goal, topic)}
                </div>
                <div class="content-tags">
                    <span class="tag">#${contentType.goal.replace('-', '')}</span>
                    <span class="tag">#${topic.toLowerCase()}</span>
                </div>
            </div>
            <div class="content-actions">
                <button class="action-btn valuable">👍 Valuable</button>
                <button class="action-btn skip">👎 Skip</button>
            </div>
        `;

        // Add event listeners for rating
        card.querySelector('.valuable').addEventListener('click', () => {
            this.rateContent(card, 'valuable');
        });

        card.querySelector('.skip').addEventListener('click', () => {
            this.rateContent(card, 'skip');
        });

        return card;
    }

    generateContentText(goal, topic) {
        const texts = {
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

        const options = texts[goal] || texts['learn'];
        return options[Math.floor(Math.random() * options.length)];
    }

    rateContent(card, rating) {
        const isAligned = card.dataset.aligned === 'true';
        const goal = card.dataset.goal;

        if (rating === 'valuable') {
            if (isAligned) {
                this.addXP(15, 'Engaged with goal-aligned content');
            } else {
                this.addXP(5, 'Engaged with content');
            }
        } else if (rating === 'skip') {
            if (!isAligned) {
                this.addXP(3, 'Skipped non-aligned content');
            }
        }

        // Remove card after rating
        card.style.transform = 'translateX(-100%)';
        card.style.opacity = '0';
        setTimeout(() => card.remove(), 300);

        this.contentViewed++;
        this.checkFrictionTriggers();
    }

    // XP AND LEVEL SYSTEM
    addXP(amount, reason) {
        this.xp += amount;

        // Check for level up
        const newLevel = this.calculateLevel();
        if (newLevel > this.level) {
            this.level = newLevel;
            this.showLevelUpNotification();
        }

        this.updateStats();
        this.saveData();
    }

    calculateLevel() {
        for (let i = this.xpThresholds.length - 1; i >= 0; i--) {
            if (this.xp >= this.xpThresholds[i]) {
                return i + 1;
            }
        }
        return 1;
    }

    showLevelUpNotification() {
        // Simple notification (could be enhanced)
        console.log(`🎉 Level up! Now level ${this.level}`);
    }

    updateStats() {
        document.getElementById('xp-display').textContent = this.xp;
        document.getElementById('level-display').textContent = this.level;

        const timeMinutes = Math.floor(this.timeSpent / 60);
        document.getElementById('time-display').textContent = `${timeMinutes}m`;

        // Update XP bar
        const currentLevelXP = this.xpThresholds[this.level - 1];
        const nextLevelXP = this.xpThresholds[this.level] || this.xpThresholds[this.xpThresholds.length - 1];
        const progress = ((this.xp - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100;
        document.getElementById('xp-bar').style.width = `${Math.min(progress, 100)}%`;
    }

    // TIME TRACKING
    startTimeTracking() {
        setInterval(() => {
            this.timeSpent++;
            this.updateStats();
            this.checkFrictionTriggers();
        }, 1000);
    }

    // FRICTION MECHANISMS
    checkFrictionTriggers() {
        const timeMinutes = this.timeSpent / 60;
        const timeSinceLastFriction = (Date.now() - this.lastFrictionTime) / 60000; // minutes

        // Trigger friction after 20 minutes, then every 15 minutes
        if (timeMinutes >= 20 && timeSinceLastFriction >= 15) {
            this.showFrictionOverlay();
        }

        // Grey out content after 30 minutes
        if (timeMinutes >= 30) {
            this.applyGreyoutEffect();
        }
    }

    showFrictionOverlay() {
        const overlay = document.getElementById('friction-overlay');
        const message = document.getElementById('friction-message');

        const messages = [
            `You've been scrolling for ${Math.floor(this.timeSpent / 60)} minutes. What are you looking for right now?`,
            `Time check: ${Math.floor(this.timeSpent / 60)} minutes of scrolling. How are you feeling?`,
            `Quick pause: You've seen ${this.contentViewed} pieces of content. Taking it in?`,
            `${Math.floor(this.timeSpent / 60)} minutes in. Maybe time for a stretch or a walk?`
        ];

        message.textContent = messages[Math.floor(Math.random() * messages.length)];
        overlay.classList.add('active');
        this.lastFrictionTime = Date.now();
    }

    hideFrictionOverlay() {
        document.getElementById('friction-overlay').classList.remove('active');
    }

    applyGreyoutEffect() {
        const cards = document.querySelectorAll('.content-card');
        cards.forEach(card => {
            if (Math.random() > 0.5) { // Grey out 50% of cards
                card.classList.add('greyed-out');
            }
        });
    }

    showReflectionModal() {
        this.hideFrictionOverlay();
        document.getElementById('reflection-modal').classList.add('active');
    }

    closeReflectionModal() {
        document.getElementById('reflection-modal').classList.remove('active');
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.scrollBalance = new ScrollBalance();
});
