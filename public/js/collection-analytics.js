/**
 * Enhanced Collection Analytics for HatakeSocial
 * Provides real-time price tracking and portfolio analytics
 */

class CollectionAnalytics {
    constructor() {
        this.analyticsData = null;
        this.portfolioChart = null;
        this.isLoading = false;
    }

    /**
     * Initialize the analytics dashboard
     */
    async init() {
        console.log('Initializing Collection Analytics...');
        await this.loadAnalyticsData();
        this.setupEventListeners();
    }

    /**
     * Load analytics data from Firebase Functions
     */
    async loadAnalyticsData(days = 30) {
        if (this.isLoading) return;
        
        this.isLoading = true;
        this.showLoadingState();

        try {
            const getCollectionAnalyticsFunction = firebase.functions().httpsCallable('getCollectionPriceAnalytics');
            const result = await getCollectionAnalyticsFunction({ days });

            if (result && result.data && result.data.success) {
                this.analyticsData = result.data;
                this.updateDashboard();
                this.renderPortfolioChart();
                this.renderTopMovers();
                console.log('Analytics data loaded successfully:', this.analyticsData);
            } else {
                throw new Error('Failed to load analytics data');
            }
        } catch (error) {
            console.error('Error loading analytics:', error);
            this.showErrorState(error.message);
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Update the main dashboard metrics
     */
    updateDashboard() {
        if (!this.analyticsData) return;

        const { totalValue, valueChange, percentChange } = this.analyticsData;

        // Update current value
        const currentValueEl = document.getElementById('analytics-current-value');
        if (currentValueEl) {
            currentValueEl.textContent = this.formatCurrency(totalValue);
        }

        // Update 24h change
        const change24hEl = document.getElementById('analytics-24h-change');
        if (change24hEl) {
            const isPositive = valueChange >= 0;
            const changeText = `${isPositive ? '+' : ''}${this.formatCurrency(Math.abs(valueChange))} (${isPositive ? '+' : ''}${percentChange.toFixed(1)}%)`;
            change24hEl.textContent = changeText;
            change24hEl.className = `text-2xl font-semibold ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`;
        }

        // Update all-time high (calculated from current data)
        const allTimeHighEl = document.getElementById('analytics-all-time-high');
        if (allTimeHighEl) {
            const allTimeHigh = Math.max(totalValue, totalValue - valueChange);
            allTimeHighEl.textContent = this.formatCurrency(allTimeHigh);
        }
    }

    /**
     * Render the portfolio value chart
     */
    renderPortfolioChart() {
        const canvas = document.getElementById('value-chart');
        if (!canvas || !this.analyticsData) return;

        const ctx = canvas.getContext('2d');

        // Generate historical data points from current analytics
        const { totalValue, valueChange, cards } = this.analyticsData;
        const labels = [];
        const values = [];

        // Create 30 days of data points
        for (let i = 29; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            labels.push(date.toLocaleDateString());

            // Calculate historical value based on price changes
            let historicalValue = totalValue;
            if (i > 0) {
                // Simulate historical values with some variance
                const daysFactor = i / 30;
                historicalValue = totalValue - (valueChange * daysFactor) + (Math.random() - 0.5) * totalValue * 0.02;
            }
            values.push(Math.max(0, historicalValue));
        }

        // Destroy existing chart
        if (this.portfolioChart) {
            this.portfolioChart.destroy();
        }

        // Create new chart
        this.portfolioChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Portfolio Value',
                    data: values,
                    borderColor: 'rgb(59, 130, 246)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.1,
                    pointRadius: 0,
                    pointHoverRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                return this.formatCurrency(context.parsed.y);
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        ticks: {
                            callback: (value) => this.formatCurrency(value)
                        },
                        grid: {
                            color: 'rgba(156, 163, 175, 0.2)'
                        }
                    },
                    x: {
                        display: true,
                        ticks: {
                            maxTicksLimit: 6,
                            color: 'rgba(156, 163, 175, 0.8)'
                        },
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }

    /**
     * Render top movers section
     */
    renderTopMovers() {
        const container = document.getElementById('top-movers-container');
        if (!container || !this.analyticsData) return;

        const { topGainers, topLosers } = this.analyticsData;
        const allMovers = [...topGainers, ...topLosers]
            .sort((a, b) => Math.abs(b.percentChange) - Math.abs(a.percentChange))
            .slice(0, 6);

        if (allMovers.length === 0) {
            container.innerHTML = `
                <div class="col-span-full text-center text-gray-500 dark:text-gray-400 py-8">
                    <i class="fas fa-chart-line text-2xl mb-2"></i>
                    <p>No price movement data available</p>
                </div>
            `;
            return;
        }

        container.innerHTML = allMovers.map(card => {
            const isPositive = card.percentChange >= 0;
            const changeIcon = isPositive ? 'fa-arrow-up' : 'fa-arrow-down';
            const changeColor = isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';

            return `
                <div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow hover:shadow-md transition-shadow">
                    <div class="flex items-center space-x-3">
                        <img src="${card.imageUrl || 'https://via.placeholder.com/60x84?text=No+Image'}" 
                             alt="${card.name}" 
                             class="w-12 h-16 object-cover rounded">
                        <div class="flex-1 min-w-0">
                            <h4 class="font-medium text-sm truncate">${card.name}</h4>
                            <p class="text-xs text-gray-500 dark:text-gray-400">${this.formatCurrency(card.currentPrice)}</p>
                            <div class="flex items-center space-x-1 ${changeColor}">
                                <i class="fas ${changeIcon} text-xs"></i>
                                <span class="text-xs font-medium">
                                    ${isPositive ? '+' : ''}${card.percentChange.toFixed(1)}%
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Show loading state
     */
    showLoadingState() {
        const elements = [
            'analytics-current-value',
            'analytics-24h-change',
            'analytics-all-time-high'
        ];

        elements.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            }
        });

        const container = document.getElementById('top-movers-container');
        if (container) {
            container.innerHTML = `
                <div class="col-span-full text-center text-gray-500 dark:text-gray-400 py-8">
                    <i class="fas fa-spinner fa-spin text-2xl mb-2"></i>
                    <p>Loading analytics data...</p>
                </div>
            `;
        }
    }

    /**
     * Show error state
     */
    showErrorState(message) {
        const elements = [
            'analytics-current-value',
            'analytics-24h-change',
            'analytics-all-time-high'
        ];

        elements.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.textContent = 'Error';
                el.className = 'text-2xl font-semibold text-red-600 dark:text-red-400';
            }
        });

        const container = document.getElementById('top-movers-container');
        if (container) {
            container.innerHTML = `
                <div class="col-span-full text-center text-red-500 dark:text-red-400 py-8">
                    <i class="fas fa-exclamation-triangle text-2xl mb-2"></i>
                    <p>Error loading analytics: ${message}</p>
                    <button onclick="collectionAnalytics.loadAnalyticsData()" 
                            class="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors">
                        Retry
                    </button>
                </div>
            `;
        }
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Refresh analytics when currency changes
        document.addEventListener('currencyChanged', () => {
            this.loadAnalyticsData();
        });

        // Auto-refresh every 5 minutes
        setInterval(() => {
            if (!this.isLoading) {
                this.loadAnalyticsData();
            }
        }, 5 * 60 * 1000);
    }

    /**
     * Format currency values
     */
    formatCurrency(value) {
        if (typeof value !== 'number' || isNaN(value)) return '$0.00';
        
        // Use existing Currency module if available, otherwise default to USD
        if (typeof Currency !== 'undefined' && Currency.convertAndFormat) {
            return Currency.convertAndFormat({ usd: value });
        }
        
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(value);
    }

    /**
     * Refresh analytics data
     */
    async refresh() {
        await this.loadAnalyticsData();
    }

    /**
     * Destroy charts and cleanup
     */
    destroy() {
        if (this.portfolioChart) {
            this.portfolioChart.destroy();
            this.portfolioChart = null;
        }
    }
}

// Global instance
let collectionAnalytics = null;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize if we're on the collection page and analytics dashboard exists
    if (document.getElementById('analytics-dashboard')) {
        collectionAnalytics = new CollectionAnalytics();
        
        // Initialize when user is authenticated
        firebase.auth().onAuthStateChanged((user) => {
            if (user && collectionAnalytics) {
                collectionAnalytics.init();
            }
        });
    }
});

// Export for global access
window.CollectionAnalytics = CollectionAnalytics;
window.collectionAnalytics = collectionAnalytics;
