/**
 * Badge System Frontend JavaScript
 * 
 * Handles badge display, notifications, and progress tracking
 */

// Badge rarity colors
const BADGE_RARITY_COLORS = {
    common: '#9CA3AF',      // Gray
    uncommon: '#10B981',    // Green
    rare: '#3B82F6',        // Blue
    epic: '#8B5CF6',        // Purple
    legendary: '#F59E0B'    // Gold
};

// Badge rarity gradients
const BADGE_RARITY_GRADIENTS = {
    common: 'from-gray-400 to-gray-600',
    uncommon: 'from-green-400 to-green-600',
    rare: 'from-blue-400 to-blue-600',
    epic: 'from-purple-400 to-purple-600',
    legendary: 'from-yellow-400 to-yellow-600'
};

/**
 * Load user's badges from Firestore
 */
async function loadUserBadges(userId) {
    try {
        const badgesSnapshot = await firebase.firestore()
            .collection('users')
            .doc(userId)
            .collection('badges')
            .orderBy('earnedAt', 'desc')
            .get();
        
        const badges = [];
        for (const doc of badgesSnapshot.docs) {
            const badgeData = doc.data();
            
            // Get badge definition
            const badgeDefDoc = await firebase.firestore()
                .collection('badgeDefinitions')
                .doc(badgeData.badgeId)
                .get();
            
            if (badgeDefDoc.exists) {
                badges.push({
                    ...badgeDefDoc.data(),
                    earnedAt: badgeData.earnedAt
                });
            }
        }
        
        return badges;
    } catch (error) {
        console.error('Error loading badges:', error);
        return [];
    }
}

/**
 * Load badge statistics for a user
 */
async function loadBadgeStats(userId) {
    try {
        const statsDoc = await firebase.firestore()
            .collection('users')
            .doc(userId)
            .collection('private')
            .doc('badgeStats')
            .get();
        
        if (statsDoc.exists) {
            return statsDoc.data();
        }
        
        return {
            totalBadges: 0,
            totalPoints: 0,
            categoryCounts: {},
            lastBadgeEarned: null,
            lastBadgeId: null
        };
    } catch (error) {
        console.error('Error loading badge stats:', error);
        return null;
    }
}

/**
 * Get badge progress from Cloud Function
 */
async function getBadgeProgress() {
    try {
        const getBadgeProgressFunc = firebase.functions().httpsCallable('getBadgeProgress');
        const result = await getBadgeProgressFunc();
        
        if (result.data.success) {
            return result.data.progress;
        }
        
        return [];
    } catch (error) {
        console.error('Error getting badge progress:', error);
        return [];
    }
}

/**
 * Render a single badge element
 */
function renderBadge(badge, earned = true) {
    const rarityGradient = BADGE_RARITY_GRADIENTS[badge.rarity] || BADGE_RARITY_GRADIENTS.common;
    const opacity = earned ? 'opacity-100' : 'opacity-40';
    
    return `
        <div class="badge-item ${opacity} group relative" data-badge-id="${badge.id}">
            <div class="bg-gradient-to-br ${rarityGradient} p-4 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                <div class="text-center">
                    <i class="${badge.icon} text-4xl text-white mb-2"></i>
                    <h3 class="text-white font-bold text-sm">${badge.name}</h3>
                    ${badge.points ? `<p class="text-white text-xs mt-1">${badge.points} pts</p>` : ''}
                    ${earned && badge.earnedAt ? `
                        <p class="text-white text-xs mt-1 opacity-75">
                            ${formatDate(badge.earnedAt)}
                        </p>
                    ` : ''}
                </div>
            </div>
            
            <!-- Tooltip -->
            <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-50">
                <div class="bg-gray-900 text-white text-xs rounded-lg p-3 shadow-xl max-w-xs">
                    <p class="font-bold mb-1">${badge.name}</p>
                    <p class="text-gray-300">${badge.description}</p>
                    <p class="text-gray-400 mt-1 capitalize">${badge.rarity} • ${badge.category.replace('_', ' ')}</p>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render badge progress item
 */
function renderBadgeProgress(badge) {
    const rarityGradient = BADGE_RARITY_GRADIENTS[badge.rarity] || BADGE_RARITY_GRADIENTS.common;
    const progressBarColor = BADGE_RARITY_COLORS[badge.rarity] || BADGE_RARITY_COLORS.common;
    
    if (badge.earned) {
        return renderBadge(badge, true);
    }
    
    return `
        <div class="badge-progress-item bg-white dark:bg-gray-800 rounded-lg p-4 shadow-md">
            <div class="flex items-center space-x-4">
                <div class="flex-shrink-0">
                    <div class="bg-gradient-to-br ${rarityGradient} p-3 rounded-lg opacity-60">
                        <i class="${badge.icon} text-2xl text-white"></i>
                    </div>
                </div>
                <div class="flex-1">
                    <div class="flex items-center justify-between mb-1">
                        <h4 class="font-bold text-gray-900 dark:text-gray-100">${badge.name}</h4>
                        <span class="text-sm text-gray-600 dark:text-gray-400">${badge.percentage}%</span>
                    </div>
                    <p class="text-xs text-gray-600 dark:text-gray-400 mb-2">${badge.description}</p>
                    <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div class="h-2 rounded-full transition-all duration-300" 
                             style="width: ${badge.percentage}%; background-color: ${progressBarColor}"></div>
                    </div>
                    <p class="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        ${badge.progress} / ${badge.maxProgress}
                    </p>
                </div>
            </div>
        </div>
    `;
}

/**
 * Display badges in a container
 */
async function displayUserBadges(userId, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '<div class="text-center py-8"><i class="fas fa-spinner fa-spin text-3xl text-gray-400"></i></div>';
    
    const badges = await loadUserBadges(userId);
    
    if (badges.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12">
                <i class="fas fa-award text-6xl text-gray-300 dark:text-gray-600 mb-4"></i>
                <p class="text-gray-600 dark:text-gray-400">No badges earned yet. Start collecting cards and trading to earn your first badge!</p>
            </div>
        `;
        return;
    }
    
    // Group badges by category
    const badgesByCategory = {};
    badges.forEach(badge => {
        const category = badge.category || 'other';
        if (!badgesByCategory[category]) {
            badgesByCategory[category] = [];
        }
        badgesByCategory[category].push(badge);
    });
    
    let html = '';
    
    for (const [category, categoryBadges] of Object.entries(badgesByCategory)) {
        const categoryName = category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        
        html += `
            <div class="mb-8">
                <h3 class="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4 capitalize">
                    ${categoryName}
                </h3>
                <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                    ${categoryBadges.map(badge => renderBadge(badge, true)).join('')}
                </div>
            </div>
        `;
    }
    
    container.innerHTML = html;
}

/**
 * Display badge progress
 */
async function displayBadgeProgress(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '<div class="text-center py-8"><i class="fas fa-spinner fa-spin text-3xl text-gray-400"></i></div>';
    
    const progress = await getBadgeProgress();
    
    if (progress.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12">
                <p class="text-gray-600 dark:text-gray-400">Unable to load badge progress.</p>
            </div>
        `;
        return;
    }
    
    // Separate earned and unearned badges
    const earnedBadges = progress.filter(b => b.earned);
    const unearnedBadges = progress.filter(b => !b.earned);
    
    let html = '';
    
    // Show unearned badges with progress
    if (unearnedBadges.length > 0) {
        html += `
            <div class="mb-8">
                <h3 class="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                    In Progress
                </h3>
                <div class="space-y-3">
                    ${unearnedBadges
                        .sort((a, b) => b.percentage - a.percentage)
                        .slice(0, 10)
                        .map(badge => renderBadgeProgress(badge))
                        .join('')}
                </div>
            </div>
        `;
    }
    
    // Show earned badges
    if (earnedBadges.length > 0) {
        html += `
            <div class="mb-8">
                <h3 class="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                    Earned Badges (${earnedBadges.length})
                </h3>
                <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                    ${earnedBadges.map(badge => renderBadge(badge, true)).join('')}
                </div>
            </div>
        `;
    }
    
    container.innerHTML = html;
}

/**
 * Display badge statistics
 */
async function displayBadgeStats(userId, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const stats = await loadBadgeStats(userId);
    
    if (!stats) {
        container.innerHTML = '';
        return;
    }
    
    const html = `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-6 text-white shadow-lg">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-blue-100 text-sm">Total Badges</p>
                        <p class="text-3xl font-bold">${stats.totalBadges || 0}</p>
                    </div>
                    <i class="fas fa-award text-4xl opacity-50"></i>
                </div>
            </div>
            
            <div class="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-lg p-6 text-white shadow-lg">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-yellow-100 text-sm">Total Points</p>
                        <p class="text-3xl font-bold">${stats.totalPoints || 0}</p>
                    </div>
                    <i class="fas fa-star text-4xl opacity-50"></i>
                </div>
            </div>
            
            <div class="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-6 text-white shadow-lg">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-purple-100 text-sm">Latest Badge</p>
                        <p class="text-lg font-bold truncate">${stats.lastBadgeId ? stats.lastBadgeId.replace(/_/g, ' ') : 'None'}</p>
                    </div>
                    <i class="fas fa-trophy text-4xl opacity-50"></i>
                </div>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
}

/**
 * Show badge earned notification
 */
function showBadgeNotification(badgeData) {
    const rarityGradient = BADGE_RARITY_GRADIENTS[badgeData.badgeRarity] || BADGE_RARITY_GRADIENTS.common;
    
    const notification = document.createElement('div');
    notification.className = 'fixed top-20 right-4 z-50 animate-slide-in-right';
    notification.innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-4 max-w-sm border-2 border-yellow-400">
            <div class="flex items-center space-x-4">
                <div class="flex-shrink-0">
                    <div class="bg-gradient-to-br ${rarityGradient} p-3 rounded-lg">
                        <i class="${badgeData.badgeIcon} text-2xl text-white"></i>
                    </div>
                </div>
                <div class="flex-1">
                    <p class="text-sm font-bold text-yellow-600 dark:text-yellow-400">
                        <i class="fas fa-trophy"></i> Badge Earned!
                    </p>
                    <p class="font-bold text-gray-900 dark:text-gray-100">${badgeData.badgeName}</p>
                    <p class="text-xs text-gray-600 dark:text-gray-400">${badgeData.badgeDescription}</p>
                    ${badgeData.points ? `<p class="text-xs text-gray-500 dark:text-gray-500 mt-1">+${badgeData.points} points</p>` : ''}
                </div>
                <button onclick="this.parentElement.parentElement.parentElement.remove()" 
                        class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

/**
 * Listen for badge notifications
 */
function listenForBadgeNotifications(userId) {
    firebase.firestore()
        .collection('users')
        .doc(userId)
        .collection('notifications')
        .where('type', '==', 'badge_earned')
        .where('read', '==', false)
        .onSnapshot(snapshot => {
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added') {
                    const notification = change.doc.data();
                    showBadgeNotification(notification);
                    
                    // Mark as read
                    change.doc.ref.update({ read: true });
                }
            });
        });
}

/**
 * Format timestamp to readable date
 */
function formatDate(timestamp) {
    if (!timestamp) return '';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
}

/**
 * Initialize badge system
 */
function initBadgeSystem(userId) {
    // Listen for badge notifications
    listenForBadgeNotifications(userId);
    
    // Add CSS animations
    if (!document.getElementById('badge-system-styles')) {
        const style = document.createElement('style');
        style.id = 'badge-system-styles';
        style.textContent = `
            @keyframes slide-in-right {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            
            .animate-slide-in-right {
                animation: slide-in-right 0.3s ease-out;
            }
            
            .badge-item {
                cursor: pointer;
            }
        `;
        document.head.appendChild(style);
    }
}

// Export functions for use in other scripts
window.BadgeSystem = {
    loadUserBadges,
    loadBadgeStats,
    getBadgeProgress,
    displayUserBadges,
    displayBadgeProgress,
    displayBadgeStats,
    showBadgeNotification,
    listenForBadgeNotifications,
    initBadgeSystem
};
