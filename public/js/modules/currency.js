/**
 * currency.js
 * Handles fetching, caching, and applying currency exchange rates.
 * - FIX: Now gracefully handles failures from the backend, defaulting to USD instead of crashing.
 */

const functions = firebase.functions();
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
 * @param {object} prices - The prices object from the card data (e.g., { usd: '10.00', jpy: '1500.00' }).
 * @returns {number} - The price in USD.
 */
export function getNormalizedPriceUSD(prices) {
    if (!prices || typeof prices !== 'object') return 0;

    if (prices.usd) return parseFloat(prices.usd) || 0;

    // This check is now safer because exchangeRates will never be null after initCurrency runs.
    if (!exchangeRates) {
        console.warn("Exchange rates not initialized, cannot convert price.");
        return 0;
    }

    if (prices.jpy && exchangeRates.JPY) {
        return (parseFloat(prices.jpy) / exchangeRates.JPY) || 0;
    }
    
    if (prices.eur && exchangeRates.EUR) {
        return (parseFloat(prices.eur) / exchangeRates.EUR) || 0;
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

export async function updateUserCurrency(newCurrency) {
    userCurrency = newCurrency;
    localStorage.setItem('userCurrency', newCurrency);
    document.dispatchEvent(new CustomEvent('currencyChanged', { detail: { currency: newCurrency } }));
    
    const user = firebase.auth().currentUser;
    if (user) {
        try {
            await firebase.firestore().collection('users').doc(user.uid).update({
                preferredCurrency: newCurrency
            });
        } catch (error) {
            console.error("Failed to save currency preference to Firestore:", error);
        }
    }
}