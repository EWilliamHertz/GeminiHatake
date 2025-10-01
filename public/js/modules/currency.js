/**
 * currency.js
 * Handles fetching, caching, and applying currency exchange rates.
 * - FIX: Now gracefully handles failures from the backend, defaulting to USD instead of crashing.
 * - FIX: Updated getNormalizedPriceUSD to handle ScryDex price structure with variant-based keys.
 */

// Initialize Firebase functions safely
let functions = null;
try {
    if (typeof firebase !== 'undefined' && firebase.functions) {
        functions = firebase.functions();
    }
} catch (error) {
    console.warn('Firebase functions not available:', error.message);
}
let exchangeRates = null;
let lastFetchTimestamp = 0;
const CACHE_DURATION_MS = 1000 * 60 * 60 * 6; // Cache for 6 hours
let userCurrency = localStorage.getItem('userCurrency') || 'USD';


/**
 * Fetches exchange rates from the backend cloud function and caches them.
 * @param {string} base - The base currency (e.g., 'USD').
 */
export async function initCurrency(base = 'USD') {
    const now = Date.now();
    if (exchangeRates && (now - lastFetchTimestamp < CACHE_DURATION_MS)) {
        console.log("Using cached exchange rates.");
        return;
    }

    try {
        if (!functions) {
            console.warn('Firebase functions not available, using default USD rates');
            exchangeRates = { USD: 1.0 };
            lastFetchTimestamp = now;
            return;
        }
        
        console.log(`Fetching exchange rates with base ${base}...`);
        const getRates = functions.httpsCallable('getExchangeRates');
        const result = await getRates({ base });

        // CRITICAL FIX: The data from a callable function is in result.data
        if (result.data && result.data.rates && Object.keys(result.data.rates).length > 0) {
            exchangeRates = result.data.rates;
            exchangeRates[base] = 1.0;
            lastFetchTimestamp = now;
            console.log("Exchange rates loaded successfully.", exchangeRates);
        } else {
            // This case handles a valid response structure but empty rates object
            throw new Error("Received empty or invalid rates object from backend.");
        }
    } catch (error) {
        console.error("Could not fetch exchange rates:", error);
        // FIX: Graceful fallback. Set a default to prevent the app from crashing.
        // The app will now function but will only show prices in USD.
        exchangeRates = { USD: 1.0 };
        showToast("Could not fetch currency rates. Prices will be shown in USD.", "error");
    }
}

/**
 * Converts a card's prices object to a single normalized USD value.
 * FIXED: Now handles both Scryfall format (usd, eur, jpy) and ScryDex format (variant_condition keys).
 * @param {object} prices - The prices object from the card data (e.g., { usd: '10.00', jpy: '1500.00' } or { normal_NM: 5.99, reverseHolofoil_NM: 12.50 }).
 * @returns {number} - The price in USD.
 */
export function getNormalizedPriceUSD(prices) {
    if (!prices || typeof prices !== 'object') return 0;

    // Handle Scryfall format (MTG cards)
    if (prices.usd) return parseFloat(prices.usd) || 0;

    // This check is now safer because exchangeRates will never be null after initCurrency runs.
    if (!exchangeRates) {
        console.warn("Exchange rates not initialized, cannot convert price.");
        return 0;
    }

    if (prices.jpy && exchangeRates.JPY) {
        // Fix: JPY to USD conversion - divide by exchange rate since JPY is typically > 100 per USD
        // For example: 300 JPY / 150 (JPY per USD) = 2 USD
        const jpyRate = exchangeRates.JPY;
        return (parseFloat(prices.jpy) / jpyRate) || 0;
    }
    
    if (prices.eur && exchangeRates.EUR) {
        // EUR to USD conversion - multiply by exchange rate since EUR is typically < 1 per USD
        // For example: 10 EUR * 1.1 (USD per EUR) = 11 USD
        const eurRate = exchangeRates.EUR;
        return (parseFloat(prices.eur) * eurRate) || 0;
    }
    
    // NEW: Handle ScryDex format (Pokemon, Lorcana, Gundam cards)
    // ScryDex returns prices with keys like 'normal_NM', 'reverseHolofoil_NM', etc.
    const priceKeys = Object.keys(prices);
    if (priceKeys.length > 0) {
        // Priority order for ScryDex variants (prefer normal over special variants)
        const priorityOrder = [
            'normal_NM', 'normal_LP', 'normal_MP', 'normal_HP', 'normal_DMG',
            'reverseHolofoil_NM', 'reverseHolofoil_LP', 'reverseHolofoil_MP', 'reverseHolofoil_HP', 'reverseHolofoil_DMG',
            'holofoil_NM', 'holofoil_LP', 'holofoil_MP', 'holofoil_HP', 'holofoil_DMG',
            'firstEdition_NM', 'firstEdition_LP', 'firstEdition_MP', 'firstEdition_HP', 'firstEdition_DMG'
        ];
        
        // Find the first available price in priority order
        for (const priorityKey of priorityOrder) {
            if (prices[priorityKey] && typeof prices[priorityKey] === 'number') {
                return prices[priorityKey];
            }
        }
        
        // If no priority match, use the first available numeric price
        for (const key of priceKeys) {
            const price = prices[key];
            if (typeof price === 'number' && price > 0) {
                return price;
            }
        }
    }
    
    return 0;
}

/**
 * Formats a price value into a display string for the target currency.
 * Accepts either a raw prices object or a pre-calculated USD value.
 * @param {object|number} priceData - The prices object or a number in USD.
 * @returns {string} - The formatted price string (e.g., "105.50 kr" or "$10.00").
 */
export function convertAndFormat(priceData) {
    const targetCurrency = getUserCurrency();
    let priceUSD = 0;

    if (typeof priceData === 'number') {
        priceUSD = priceData;
    } else if (typeof priceData === 'object' && priceData !== null) {
        priceUSD = getNormalizedPriceUSD(priceData);
    }

    if (typeof priceUSD !== 'number' || isNaN(priceUSD)) {
        priceUSD = 0;
    }

    let finalPrice = priceUSD;
    let currencyInfo = { symbol: '$', code: 'USD' };

    const currencyMap = {
        'SEK': { symbol: 'kr' }, 'EUR': { symbol: '€' },
        'JPY': { symbol: '¥' }, 'GBP': { symbol: '£' },
        'NOK': { symbol: 'kr' }, 'DKK': { symbol: 'kr' },
        'USD': { symbol: '$' }
    };
    
    if (targetCurrency !== 'USD' && exchangeRates && exchangeRates[targetCurrency.toUpperCase()]) {
        finalPrice = priceUSD * exchangeRates[targetCurrency.toUpperCase()];
        currencyInfo = currencyMap[targetCurrency.toUpperCase()] || { symbol: targetCurrency };
    }
    
    const formattedPrice = finalPrice.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    
    return `${formattedPrice} ${currencyInfo.symbol}`;
}

export function getUserCurrency() {
    return userCurrency;
}

export async function loadUserCurrency(userId) {
    try {
        const userDoc = await firebase.firestore().collection('users').doc(userId).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            const savedCurrency = userData.primaryCurrency || 'USD';
            userCurrency = savedCurrency;
            localStorage.setItem('userCurrency', savedCurrency);
            
            // Update any existing currency selectors
            const selector = document.getElementById('currency-selector');
            if (selector) {
                selector.value = savedCurrency;
            }
            
            console.log(`Loaded user currency: ${savedCurrency}`);
            return savedCurrency;
        }
    } catch (error) {
        console.error("Failed to load currency preference from Firestore:", error);
    }
    return userCurrency;
}

export async function updateUserCurrency(newCurrency) {
    userCurrency = newCurrency;
    localStorage.setItem('userCurrency', newCurrency);
    document.dispatchEvent(new CustomEvent('currencyChanged', { detail: { currency: newCurrency } }));
    
    const user = firebase.auth().currentUser;
    if (user) {
        try {
            await firebase.firestore().collection('users').doc(user.uid).update({
                primaryCurrency: newCurrency
            });
        } catch (error) {
            console.error("Failed to save currency preference to Firestore:", error);
        }
    }
}
