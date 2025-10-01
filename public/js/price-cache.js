/**
 * Price Data Caching and Performance Optimization System
 * Handles caching, rate limiting, and background sync for price data
 */

class PriceCache {
    constructor() {
        this.cache = new Map();
        this.requestQueue = [];
        this.isProcessingQueue = false;
        this.rateLimitDelay = 1000; // 1 second between requests
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
        this.maxCacheSize = 1000;
        this.backgroundSyncInterval = null;
    }

    /**
     * Initialize the caching system
     */
    init() {
        console.log('Initializing Price Cache system...');
        
        // Load cache from localStorage
        this.loadCache();
        
        // Start background sync
        this.startBackgroundSync();
        
        // Setup cleanup intervals
        this.setupCleanup();
        
        // Setup event listeners
        this.setupEventListeners();
    }

    /**
     * Get price data with caching
     */
    async getPriceData(cardId, days = 30, game = 'pokemon') {
        const cacheKey = `${cardId}_${days}_${game}`;
        
        // Check cache first
        const cached = this.getCachedData(cacheKey);
        if (cached) {
            console.log(`Cache hit for ${cacheKey}`);
            return cached;
        }

        // Add to request queue if not in cache
        return new Promise((resolve, reject) => {
            this.requestQueue.push({
                cacheKey,
                cardId,
                days,
                game,
                resolve,
                reject,
                timestamp: Date.now()
            });

            this.processQueue();
        });
    }

    /**
     * Get cached data if still valid
     */
    getCachedData(cacheKey) {
        const cached = this.cache.get(cacheKey);
        if (!cached) return null;

        // Check if cache is still valid
        if (Date.now() - cached.timestamp > this.cacheExpiry) {
            this.cache.delete(cacheKey);
            return null;
        }

        return cached.data;
    }

    /**
     * Process the request queue with rate limiting
     */
    async processQueue() {
        if (this.isProcessingQueue || this.requestQueue.length === 0) {
            return;
        }

        this.isProcessingQueue = true;

        while (this.requestQueue.length > 0) {
            const request = this.requestQueue.shift();
            
            try {
                // Check cache again (might have been populated by another request)
                const cached = this.getCachedData(request.cacheKey);
                if (cached) {
                    request.resolve(cached);
                    continue;
                }

                // Make the actual API request
                const data = await this.fetchPriceData(request.cardId, request.days, request.game);
                
                // Cache the result
                this.setCachedData(request.cacheKey, data);
                
                // Resolve the promise
                request.resolve(data);
                
                // Rate limiting delay
                await this.delay(this.rateLimitDelay);
                
            } catch (error) {
                console.error(`Error fetching price data for ${request.cacheKey}:`, error);
                request.reject(error);
            }
        }

        this.isProcessingQueue = false;
    }

    /**
     * Fetch price data from Firebase Functions
     */
    async fetchPriceData(cardId, days, game) {
        const getCardPriceHistoryFunction = firebase.functions().httpsCallable('getCardPriceHistory');
        const result = await getCardPriceHistoryFunction({
            cardId: cardId,
            days: days,
            game: game
        });

        if (result && result.data && result.data.success) {
            return result.data;
        } else {
            throw new Error('Failed to fetch price data');
        }
    }

    /**
     * Cache data with timestamp
     */
    setCachedData(cacheKey, data) {
        // Implement LRU cache behavior
        if (this.cache.size >= this.maxCacheSize) {
            const oldestKey = this.cache.keys().next().value;
            this.cache.delete(oldestKey);
        }

        this.cache.set(cacheKey, {
            data: data,
            timestamp: Date.now()
        });

        // Save to localStorage
        this.saveCache();
    }

    /**
     * Prefetch price data for commonly accessed cards
     */
    async prefetchPopularCards(cardIds) {
        console.log('Prefetching price data for popular cards...');
        
        const prefetchPromises = cardIds.map(cardId => {
            // Prefetch 30-day data for each card
            return this.getPriceData(cardId, 30, 'pokemon').catch(error => {
                console.warn(`Failed to prefetch data for card ${cardId}:`, error);
            });
        });

        await Promise.allSettled(prefetchPromises);
        console.log('Prefetch completed');
    }

    /**
     * Background sync for active cards
     */
    async backgroundSync() {
        console.log('Running background price sync...');
        
        try {
            // Get list of cards that need updating (older than 2 minutes)
            const staleThreshold = 2 * 60 * 1000; // 2 minutes
            const staleCards = [];
            
            for (const [cacheKey, cached] of this.cache) {
                if (Date.now() - cached.timestamp > staleThreshold) {
                    const [cardId, days, game] = cacheKey.split('_');
                    staleCards.push({ cardId, days: parseInt(days), game });
                }
            }

            // Update stale cards in batches
            const batchSize = 5;
            for (let i = 0; i < staleCards.length; i += batchSize) {
                const batch = staleCards.slice(i, i + batchSize);
                const updatePromises = batch.map(card => 
                    this.fetchPriceData(card.cardId, card.days, card.game)
                        .then(data => {
                            const cacheKey = `${card.cardId}_${card.days}_${card.game}`;
                            this.setCachedData(cacheKey, data);
                        })
                        .catch(error => {
                            console.warn(`Background sync failed for ${card.cardId}:`, error);
                        })
                );

                await Promise.allSettled(updatePromises);
                
                // Delay between batches
                if (i + batchSize < staleCards.length) {
                    await this.delay(2000); // 2 second delay between batches
                }
            }

            console.log(`Background sync completed for ${staleCards.length} cards`);
            
        } catch (error) {
            console.error('Background sync error:', error);
        }
    }

    /**
     * Start background sync interval
     */
    startBackgroundSync() {
        // Run background sync every 10 minutes
        this.backgroundSyncInterval = setInterval(() => {
            this.backgroundSync();
        }, 10 * 60 * 1000);

        console.log('Background sync started (10-minute intervals)');
    }

    /**
     * Stop background sync
     */
    stopBackgroundSync() {
        if (this.backgroundSyncInterval) {
            clearInterval(this.backgroundSyncInterval);
            this.backgroundSyncInterval = null;
            console.log('Background sync stopped');
        }
    }

    /**
     * Setup cache cleanup
     */
    setupCleanup() {
        // Clean expired entries every 5 minutes
        setInterval(() => {
            this.cleanExpiredEntries();
        }, 5 * 60 * 1000);
    }

    /**
     * Clean expired cache entries
     */
    cleanExpiredEntries() {
        const now = Date.now();
        let removedCount = 0;

        for (const [key, cached] of this.cache) {
            if (now - cached.timestamp > this.cacheExpiry) {
                this.cache.delete(key);
                removedCount++;
            }
        }

        if (removedCount > 0) {
            console.log(`Cleaned ${removedCount} expired cache entries`);
            this.saveCache();
        }
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Pause background sync when page is hidden
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.stopBackgroundSync();
            } else {
                this.startBackgroundSync();
            }
        });

        // Clear cache when user logs out
        if (typeof firebase !== 'undefined') {
            firebase.auth().onAuthStateChanged((user) => {
                if (!user) {
                    this.clearCache();
                    this.stopBackgroundSync();
                }
            });
        }
    }

    /**
     * Save cache to localStorage
     */
    saveCache() {
        try {
            const cacheArray = Array.from(this.cache.entries());
            // Only save recent entries to avoid localStorage bloat
            const recentEntries = cacheArray.filter(([key, cached]) => {
                return Date.now() - cached.timestamp < this.cacheExpiry;
            });
            
            localStorage.setItem('priceCache', JSON.stringify(recentEntries));
        } catch (error) {
            console.warn('Error saving cache to localStorage:', error);
            // If storage is full, clear old entries and try again
            this.cleanExpiredEntries();
        }
    }

    /**
     * Load cache from localStorage
     */
    loadCache() {
        try {
            const saved = localStorage.getItem('priceCache');
            if (saved) {
                const cacheArray = JSON.parse(saved);
                this.cache = new Map(cacheArray);
                
                // Clean any expired entries
                this.cleanExpiredEntries();
                
                console.log(`Loaded ${this.cache.size} cached price entries`);
            }
        } catch (error) {
            console.warn('Error loading cache from localStorage:', error);
            this.cache = new Map();
        }
    }

    /**
     * Clear all cached data
     */
    clearCache() {
        this.cache.clear();
        localStorage.removeItem('priceCache');
        console.log('Price cache cleared');
    }

    /**
     * Get cache statistics
     */
    getCacheStats() {
        const now = Date.now();
        let validEntries = 0;
        let expiredEntries = 0;
        let totalSize = 0;

        for (const [key, cached] of this.cache) {
            totalSize += JSON.stringify(cached).length;
            if (now - cached.timestamp > this.cacheExpiry) {
                expiredEntries++;
            } else {
                validEntries++;
            }
        }

        return {
            totalEntries: this.cache.size,
            validEntries,
            expiredEntries,
            totalSizeKB: Math.round(totalSize / 1024),
            hitRate: this.calculateHitRate()
        };
    }

    /**
     * Calculate cache hit rate (simplified)
     */
    calculateHitRate() {
        // This would need more sophisticated tracking in a real implementation
        return 'N/A';
    }

    /**
     * Utility delay function
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Batch update multiple cards
     */
    async batchUpdateCards(cardIds, days = 30, game = 'pokemon') {
        console.log(`Batch updating ${cardIds.length} cards...`);
        
        const updatePromises = cardIds.map(cardId => 
            this.getPriceData(cardId, days, game).catch(error => {
                console.warn(`Failed to update card ${cardId}:`, error);
                return null;
            })
        );

        const results = await Promise.allSettled(updatePromises);
        const successful = results.filter(result => result.status === 'fulfilled' && result.value !== null).length;
        
        console.log(`Batch update completed: ${successful}/${cardIds.length} successful`);
        return results;
    }

    /**
     * Cleanup when page unloads
     */
    destroy() {
        this.stopBackgroundSync();
        this.saveCache();
        
        // Clear any pending requests
        this.requestQueue.forEach(request => {
            request.reject(new Error('Cache system destroyed'));
        });
        this.requestQueue = [];
    }
}

// Global instance
let priceCache = null;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    priceCache = new PriceCache();
    
    // Initialize when user is authenticated
    if (typeof firebase !== 'undefined') {
        firebase.auth().onAuthStateChanged((user) => {
            if (user && priceCache) {
                priceCache.init();
            }
        });
    }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (priceCache) {
        priceCache.destroy();
    }
});

// Export for global access
window.PriceCache = PriceCache;
window.priceCache = priceCache;
