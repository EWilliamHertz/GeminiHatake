/**
 * HatakeSocial - Centralized Currency Module with Live API Data
 *
 * This module handles all currency-related logic, fetching live exchange rates
 * from freecurrencyapi.com, caching them, converting between currencies,
 * and formatting prices for display across the entire application.
 */

// --- CONFIGURATION ---
// IMPORTANT: Replace this with your actual API key from https://app.freecurrencyapi.com/dashboard
const API_KEY = 'fca_live_ISCJ9fqb6skS8PcFfoU0u5PLRgBlb1pNahlYMY4f'; // <-- PASTE YOUR FREE CURRENCY API KEY HERE
const API_URL = `https://api.freecurrencyapi.com/v1/latest?apikey=${API_KEY}&base_currency=USD`;
const CACHE_DURATION_HOURS = 6;

const db = firebase.firestore();

let currentUserCurrency = 'USD';
let exchangeRates = {};

// --- Fallback rates in case the API fails ---
const fallbackRates = {
    'USD': 1.0, 'SEK': 10.58, 'EUR': 0.93, 'GBP': 0.79, 'NOK': 10.60, 'DKK': 6.95
};

/**
 * Fetches the latest exchange rates from the API or retrieves them from cache.
 */
async function loadExchangeRates() {
    const cachedData = localStorage.getItem('exchangeRates');
    const now = new Date().getTime();

    if (cachedData) {
        const { timestamp, rates } = JSON.parse(cachedData);
        if (now - timestamp < CACHE_DURATION_HOURS * 60 * 60 * 1000) {
            exchangeRates = rates;
            console.log("Using cached exchange rates.");
            return;
        }
    }

    try {
        if (!API_KEY || API_KEY.includes('PASTE YOUR')) {
            throw new Error("API Key is not set. Using fallback rates.");
        }
        console.log("Fetching live exchange rates from API...");
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error(`API request failed with status ${response.status}`);
        const data = await response.json();

        exchangeRates = data.data;
        localStorage.setItem('exchangeRates', JSON.stringify({ timestamp: now, rates: exchangeRates }));
        console.log("Successfully fetched and cached new exchange rates.");
    } catch (error) {
        console.error("Failed to fetch live exchange rates, using fallback rates.", error);
        exchangeRates = fallbackRates;
    }
}

/**
 * Initializes the currency system. Should be called once when the user state is known.
 * @param {string|null} userId The UID of the currently logged-in user, or null if logged out.
 */
export async function initCurrency(userId) {
    await loadExchangeRates();
    if (userId) {
        const userDocRef = db.collection('users').doc(userId);
        const userDoc = await userDocRef.get();
        if (userDoc.exists) {
            currentUserCurrency = userDoc.data().primaryCurrency || 'USD';
        } else {
            currentUserCurrency = localStorage.getItem('userCurrency') || 'USD';
        }

        // Listen for realtime updates from Firestore
        userDocRef.onSnapshot((doc) => {
            if (doc.exists) {
                const newCurrency = doc.data().primaryCurrency || 'USD';
                if (newCurrency !== currentUserCurrency) {
                    currentUserCurrency = newCurrency;
                    localStorage.setItem('userCurrency', currentUserCurrency);
                    document.dispatchEvent(new CustomEvent('currencyChanged', {
                        detail: { currency: newCurrency }
                    }));
                }
            }
        });

    } else {
        // For logged-out users, just use local storage
        currentUserCurrency = localStorage.getItem('userCurrency') || 'USD';
    }
    localStorage.setItem('userCurrency', currentUserCurrency);
}

/**
 * Updates the user's preferred currency in both Firestore (if logged in) and local storage.
 * @param {string} newCurrency The new currency code (e.g., 'SEK').
 */
export function updateUserCurrency(newCurrency) {
    if (!newCurrency) return Promise.reject("Invalid currency");

    // Update local state immediately for responsiveness
    currentUserCurrency = newCurrency;
    localStorage.setItem('userCurrency', newCurrency);
    document.dispatchEvent(new CustomEvent('currencyChanged', {
        detail: { currency: newCurrency }
    }));

    // Update Firestore if the user is logged in
    const user = firebase.auth().currentUser;
    if (user) {
       return db.collection('users').doc(user.uid).update({ primaryCurrency: newCurrency });
    }

    return Promise.resolve(); // Return a resolved promise for logged-out users
}

export function getUserCurrency() {
    return localStorage.getItem('userCurrency') || currentUserCurrency;
}

export function formatPrice(amount) {
    const currency = getUserCurrency();
    const numberAmount = Number(amount) || 0;
    try {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency, currencyDisplay: 'symbol' }).format(numberAmount);
    } catch (e) {
        // Fallback to USD if the currency code is invalid
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(numberAmount);
    }
}

/**
 * Converts a price to the user's selected currency and formats it.
 * @param {object|number|string} priceInput Price data (e.g., {usd: 10.50}) or a raw number assumed to be in USD.
 */
export function convertAndFormat(priceInput) {
    const targetCurrency = getUserCurrency();
    let sourcePriceUSD = 0;

    if (typeof priceInput === 'object' && priceInput !== null) {
        if (priceInput.usd) {
            sourcePriceUSD = parseFloat(priceInput.usd);
        } else {
            const firstPrice = Object.values(priceInput)[0];
            if (firstPrice) {
                sourcePriceUSD = parseFloat(firstPrice);
            }
        }
    } else if (typeof priceInput === 'number') {
        sourcePriceUSD = priceInput;
    } else if (typeof priceInput === 'string') {
        sourcePriceUSD = parseFloat(priceInput);
    } else if (priceInput === null || priceInput === undefined) {
        return 'N/A';
    }

    if (isNaN(sourcePriceUSD)) {
        return 'N/A';
    }

    const rate = exchangeRates[targetCurrency] || 1.0;
    const finalPrice = sourcePriceUSD * rate;

    return formatPrice(finalPrice);
}