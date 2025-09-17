/**
 * currency.js
 * Handles all client-side currency conversion and formatting.
 */
let state = {
    rates: null,
    userCurrency: 'USD',
    symbols: {
        USD: '$', SEK: 'kr', EUR: '€', GBP: '£', NOK: 'kr', DKK: 'kr'
    }
};

const functions = firebase.functions();
const getExchangeRates = functions.httpsCallable('getExchangeRates');

export async function initCurrency(preferredCurrency = 'USD') {
    state.userCurrency = preferredCurrency in state.symbols ? preferredCurrency : 'USD';
    try {
        const result = await getExchangeRates({ base: 'USD' });
        // **FIX**: Check for result.data and result.data.rates before assigning
        if (result && result.data && result.data.rates) {
            state.rates = result.data.rates;
            state.rates['USD'] = 1; // Ensure USD base rate is always present
            console.log(`Currency rates loaded. User currency: ${state.userCurrency}.`);
        } else {
            throw new Error("Invalid or empty response from getExchangeRates function.");
        }
    } catch (error) {
        console.error("Failed to initialize currency rates, using fallback rates:", error);
        // **FIX**: Provide a comprehensive fallback object to prevent the app from crashing
        state.rates = { 'USD': 1, 'SEK': 10.5, 'EUR': 0.92, 'GBP': 0.78, 'NOK': 9.55, 'DKK': 6.85 };
    }
}

export function getUserCurrency() {
    return state.userCurrency;
}

export function updateUserCurrency(currency) {
    state.userCurrency = currency;
}

export function convertAndFormat(priceInUsd) {
    if (typeof priceInUsd !== 'number' || !state.rates) {
        return 'N/A';
    }
    const rate = state.rates[state.userCurrency];
    const convertedPrice = priceInUsd * (rate || 1);
    return formatPrice(convertedPrice, state.userCurrency);
}

export function convertFromSekAndFormat(priceInSek) {
    if (typeof priceInSek !== 'number' || !state.rates || !state.rates.SEK) {
        return 'N/A';
    }
    const priceInUsd = priceInSek / state.rates.SEK;
    return convertAndFormat(priceInUsd);
}

function formatPrice(amount, currencyCode) {
    if (typeof amount !== 'number' || isNaN(amount)) return 'N/A';
    
    // Use Intl.NumberFormat for better localization and formatting
    return new Intl.NumberFormat('sv-SE', {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: 2,
    }).format(amount);
}