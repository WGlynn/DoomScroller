// Scroll Balance - Extension Popup

// Load and display stats
async function loadStats() {
  // Get current tab info
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (tab && tab.url) {
    const url = new URL(tab.url);
    const domain = url.hostname;

    // Display site info
    document.getElementById('site-info').innerHTML = `
      <div class="site-name">${domain}</div>
      <div>Currently tracking your wellness</div>
    `;
  }

  // Get site tracking data
  const data = await chrome.storage.local.get(['siteTracking', 'moodHistory']);

  if (data.siteTracking) {
    // Calculate total time
    const total = Object.values(data.siteTracking).reduce((a, b) => a + b, 0);
    const minutes = Math.floor(total / 60);
    const hours = Math.floor(minutes / 60);
    const remainingMins = minutes % 60;

    if (hours > 0) {
      document.getElementById('total-time').textContent = `${hours}h ${remainingMins}m`;
    } else {
      document.getElementById('total-time').textContent = `${minutes}m`;
    }
  }

  // Calculate wellness score from mood history
  if (data.moodHistory && data.moodHistory.length > 0) {
    const recentMoods = data.moodHistory.slice(-10);
    const moodScores = {
      'energized': 90,
      'happy': 85,
      'focused': 80,
      'calm': 75,
      'tired': 50,
      'stressed': 40
    };

    const avgScore = Math.round(
      recentMoods.reduce((sum, m) => sum + (moodScores[m.mood] || 70), 0) / recentMoods.length
    );

    document.getElementById('wellness').textContent = avgScore;
  }
}

// Open dashboard button
document.getElementById('open-dashboard').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('../index.html') });
});

// Quick check-in button
document.getElementById('quick-checkin').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (tab) {
    chrome.tabs.sendMessage(tab.id, { action: 'showCheckIn' });
    window.close();
  }
});

// Load stats on popup open
loadStats();

// Refresh every 5 seconds
setInterval(loadStats, 5000);
