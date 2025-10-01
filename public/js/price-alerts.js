/**
 * Price Alerts and Notifications System for HatakeSocial
 * Handles price change notifications and user alerts
 */

class PriceAlerts {
    constructor() {
        this.alerts = new Map();
        this.notificationPermission = null;
        this.lastPriceCheck = new Date();
        this.checkInterval = null;
    }

    /**
     * Initialize the price alerts system
     */
    async init() {
        console.log('Initializing Price Alerts system...');
        
        // Request notification permission
        await this.requestNotificationPermission();
        
        // Load existing alerts from localStorage
        this.loadAlerts();
        
        // Start periodic price checking
        this.startPriceMonitoring();
        
        // Setup UI event listeners
        this.setupEventListeners();
    }

    /**
     * Request notification permission from user
     */
    async requestNotificationPermission() {
        if ('Notification' in window) {
            this.notificationPermission = await Notification.requestPermission();
            console.log('Notification permission:', this.notificationPermission);
        } else {
            console.warn('This browser does not support notifications');
        }
    }

    /**
     * Add a price alert for a card
     */
    addAlert(cardId, cardName, targetPrice, alertType = 'above', currentPrice = 0) {
        const alert = {
            id: `${cardId}_${Date.now()}`,
            cardId,
            cardName,
            targetPrice: parseFloat(targetPrice),
            alertType, // 'above', 'below', 'change'
            currentPrice: parseFloat(currentPrice),
            createdAt: new Date().toISOString(),
            triggered: false,
            active: true
        };

        this.alerts.set(alert.id, alert);
        this.saveAlerts();
        
        console.log('Price alert added:', alert);
        this.showToast(`Price alert set for ${cardName} at $${targetPrice}`, 'success');
        
        return alert.id;
    }

    /**
     * Remove a price alert
     */
    removeAlert(alertId) {
        if (this.alerts.has(alertId)) {
            const alert = this.alerts.get(alertId);
            this.alerts.delete(alertId);
            this.saveAlerts();
            
            console.log('Price alert removed:', alert);
            this.showToast(`Price alert removed for ${alert.cardName}`, 'info');
            return true;
        }
        return false;
    }

    /**
     * Check all active alerts against current prices
     */
    async checkAlerts() {
        if (this.alerts.size === 0) return;

        console.log('Checking price alerts...');
        const activeAlerts = Array.from(this.alerts.values()).filter(alert => alert.active && !alert.triggered);
        
        if (activeAlerts.length === 0) return;

        // Group alerts by card ID to minimize API calls
        const cardGroups = new Map();
        activeAlerts.forEach(alert => {
            if (!cardGroups.has(alert.cardId)) {
                cardGroups.set(alert.cardId, []);
            }
            cardGroups.get(alert.cardId).push(alert);
        });

        // Check each card's current price
        for (const [cardId, cardAlerts] of cardGroups) {
            try {
                const currentPrice = await this.getCurrentPrice(cardId);
                if (currentPrice > 0) {
                    this.evaluateAlerts(cardAlerts, currentPrice);
                }
            } catch (error) {
                console.warn(`Error checking price for card ${cardId}:`, error);
            }
        }

        this.lastPriceCheck = new Date();
    }

    /**
     * Get current price for a card
     */
    async getCurrentPrice(cardId) {
        try {
            // Use our existing price history function to get current price
            const getCardPriceHistoryFunction = firebase.functions().httpsCallable('getCardPriceHistory');
            const result = await getCardPriceHistoryFunction({
                cardId: cardId,
                days: 1,
                game: 'pokemon' // Default to pokemon, could be made configurable
            });

            if (result && result.data && result.data.success && result.data.data.length > 0) {
                const latestPrice = result.data.data[result.data.data.length - 1];
                return latestPrice.market || 0;
            }
        } catch (error) {
            console.warn('Error fetching current price:', error);
        }
        return 0;
    }

    /**
     * Evaluate alerts against current price
     */
    evaluateAlerts(alerts, currentPrice) {
        alerts.forEach(alert => {
            let shouldTrigger = false;
            let message = '';

            switch (alert.alertType) {
                case 'above':
                    if (currentPrice >= alert.targetPrice) {
                        shouldTrigger = true;
                        message = `${alert.cardName} is now $${currentPrice.toFixed(2)} (target: $${alert.targetPrice.toFixed(2)})`;
                    }
                    break;
                case 'below':
                    if (currentPrice <= alert.targetPrice) {
                        shouldTrigger = true;
                        message = `${alert.cardName} dropped to $${currentPrice.toFixed(2)} (target: $${alert.targetPrice.toFixed(2)})`;
                    }
                    break;
                case 'change':
                    const percentChange = Math.abs((currentPrice - alert.currentPrice) / alert.currentPrice) * 100;
                    if (percentChange >= alert.targetPrice) { // targetPrice used as percentage threshold
                        shouldTrigger = true;
                        const direction = currentPrice > alert.currentPrice ? 'increased' : 'decreased';
                        message = `${alert.cardName} ${direction} by ${percentChange.toFixed(1)}% to $${currentPrice.toFixed(2)}`;
                    }
                    break;
            }

            if (shouldTrigger) {
                this.triggerAlert(alert, message, currentPrice);
            }
        });
    }

    /**
     * Trigger a price alert
     */
    triggerAlert(alert, message, currentPrice) {
        // Mark alert as triggered
        alert.triggered = true;
        alert.triggeredAt = new Date().toISOString();
        alert.triggeredPrice = currentPrice;
        this.saveAlerts();

        // Show notification
        this.showNotification('Price Alert', message);
        
        // Show toast
        this.showToast(message, 'success', 10000);
        
        // Log the alert
        console.log('Price alert triggered:', alert, message);

        // Optionally, you could emit an event for other parts of the app
        document.dispatchEvent(new CustomEvent('priceAlertTriggered', {
            detail: { alert, message, currentPrice }
        }));
    }

    /**
     * Show browser notification
     */
    showNotification(title, message) {
        if (this.notificationPermission === 'granted' && 'Notification' in window) {
            const notification = new Notification(title, {
                body: message,
                icon: '/favicon.ico',
                badge: '/favicon.ico',
                tag: 'price-alert',
                requireInteraction: true
            });

            notification.onclick = () => {
                window.focus();
                notification.close();
            };

            // Auto-close after 10 seconds
            setTimeout(() => notification.close(), 10000);
        }
    }

    /**
     * Show toast notification
     */
    showToast(message, type = 'info', duration = 5000) {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        const colors = { 
            success: 'bg-green-600', 
            error: 'bg-red-600', 
            info: 'bg-blue-600',
            warning: 'bg-yellow-600'
        };
        
        toast.className = `p-4 rounded-lg text-white shadow-lg mb-2 ${colors[type] || 'bg-gray-700'} transition-all duration-300 transform translate-y-4 opacity-0`;
        toast.innerHTML = `
            <div class="flex items-center justify-between">
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" class="ml-4 text-white hover:text-gray-200">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        container.appendChild(toast);
        setTimeout(() => toast.classList.remove('translate-y-4', 'opacity-0'), 10);
        setTimeout(() => {
            toast.classList.add('opacity-0');
            toast.addEventListener('transitionend', () => toast.remove());
        }, duration);
    }

    /**
     * Start periodic price monitoring
     */
    startPriceMonitoring() {
        // Check every 5 minutes
        this.checkInterval = setInterval(() => {
            this.checkAlerts();
        }, 5 * 60 * 1000);

        console.log('Price monitoring started (5-minute intervals)');
    }

    /**
     * Stop price monitoring
     */
    stopPriceMonitoring() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
            console.log('Price monitoring stopped');
        }
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Listen for page visibility changes to pause/resume monitoring
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.stopPriceMonitoring();
            } else {
                this.startPriceMonitoring();
                // Check immediately when page becomes visible
                setTimeout(() => this.checkAlerts(), 1000);
            }
        });

        // Listen for user authentication changes
        if (typeof firebase !== 'undefined') {
            firebase.auth().onAuthStateChanged((user) => {
                if (!user) {
                    this.stopPriceMonitoring();
                    this.clearAlerts();
                } else {
                    this.startPriceMonitoring();
                }
            });
        }
    }

    /**
     * Save alerts to localStorage
     */
    saveAlerts() {
        try {
            const alertsArray = Array.from(this.alerts.entries());
            localStorage.setItem('priceAlerts', JSON.stringify(alertsArray));
        } catch (error) {
            console.warn('Error saving alerts to localStorage:', error);
        }
    }

    /**
     * Load alerts from localStorage
     */
    loadAlerts() {
        try {
            const saved = localStorage.getItem('priceAlerts');
            if (saved) {
                const alertsArray = JSON.parse(saved);
                this.alerts = new Map(alertsArray);
                console.log(`Loaded ${this.alerts.size} price alerts from storage`);
            }
        } catch (error) {
            console.warn('Error loading alerts from localStorage:', error);
            this.alerts = new Map();
        }
    }

    /**
     * Clear all alerts
     */
    clearAlerts() {
        this.alerts.clear();
        this.saveAlerts();
        console.log('All price alerts cleared');
    }

    /**
     * Get all active alerts
     */
    getActiveAlerts() {
        return Array.from(this.alerts.values()).filter(alert => alert.active);
    }

    /**
     * Get triggered alerts
     */
    getTriggeredAlerts() {
        return Array.from(this.alerts.values()).filter(alert => alert.triggered);
    }

    /**
     * Create alert UI for a card
     */
    createAlertUI(cardId, cardName, currentPrice = 0) {
        return `
            <div class="price-alert-form p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <h4 class="font-medium mb-3">Set Price Alert for ${cardName}</h4>
                <div class="space-y-3">
                    <div>
                        <label class="block text-sm font-medium mb-1">Alert Type</label>
                        <select id="alert-type-${cardId}" class="w-full p-2 border rounded-md dark:bg-gray-600 dark:border-gray-500">
                            <option value="above">Price goes above</option>
                            <option value="below">Price goes below</option>
                            <option value="change">Price changes by %</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">Target Value</label>
                        <input type="number" 
                               id="alert-value-${cardId}" 
                               class="w-full p-2 border rounded-md dark:bg-gray-600 dark:border-gray-500" 
                               placeholder="Enter price or percentage"
                               step="0.01"
                               min="0">
                    </div>
                    <div class="flex space-x-2">
                        <button onclick="priceAlerts.addAlertFromUI('${cardId}', '${cardName}', ${currentPrice})"
                                class="flex-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors">
                            Set Alert
                        </button>
                        <button onclick="this.closest('.price-alert-form').remove()"
                                class="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors">
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Add alert from UI form
     */
    addAlertFromUI(cardId, cardName, currentPrice) {
        const typeSelect = document.getElementById(`alert-type-${cardId}`);
        const valueInput = document.getElementById(`alert-value-${cardId}`);
        
        if (!typeSelect || !valueInput) return;
        
        const alertType = typeSelect.value;
        const targetValue = parseFloat(valueInput.value);
        
        if (isNaN(targetValue) || targetValue <= 0) {
            this.showToast('Please enter a valid target value', 'error');
            return;
        }
        
        this.addAlert(cardId, cardName, targetValue, alertType, currentPrice);
        
        // Remove the form
        const form = document.querySelector('.price-alert-form');
        if (form) form.remove();
    }

    /**
     * Cleanup when page unloads
     */
    destroy() {
        this.stopPriceMonitoring();
        this.saveAlerts();
    }
}

// Global instance
let priceAlerts = null;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    priceAlerts = new PriceAlerts();
    
    // Initialize when user is authenticated
    if (typeof firebase !== 'undefined') {
        firebase.auth().onAuthStateChanged((user) => {
            if (user && priceAlerts) {
                priceAlerts.init();
            }
        });
    }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (priceAlerts) {
        priceAlerts.destroy();
    }
});

// Export for global access
window.PriceAlerts = PriceAlerts;
window.priceAlerts = priceAlerts;
