/**
 * currency.js
 * Handles all client-side currency conversion and formatting.
 */
let state = {
    rates: null, // Stores rates relative to USD
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
        state.rates = result.data;
        state.rates['USD'] = 1;
        console.log(`Currency rates loaded. User currency: ${state.userCurrency}.`);
    } catch (error) {
        console.error("Failed to initialize currency rates:", error);
        state.rates = { 'USD': 1 }; // Fallback
    }
}

export async function updateUserCurrency(newCurrency) {
    if (newCurrency in state.symbols) {
        state.userCurrency = newCurrency;
        // Re-initialize with the new currency
        await initCurrency(newCurrency);
    }
}

export function convertAndFormat(priceInUsd) {
    if (typeof priceInUsd !== 'number' || !state.rates) {
        return formatPrice(priceInUsd, 'USD');
    }
    const rate = state.rates[state.userCurrency];
    if (!rate) {
        return formatPrice(priceInUsd, 'USD');
    }
    const convertedPrice = priceInUsd * rate;
    return formatPrice(convertedPrice, state.userCurrency);
}

export function convertFromSekAndFormat(priceInSek) {
    if (typeof priceInSek !== 'number' || !state.rates || !state.rates.SEK) {
        return formatPrice(priceInSek, 'SEK');
    }
    const priceInUsd = priceInSek / state.rates.SEK;
    return convertAndFormat(priceInUsd);
}

export function formatPrice(amount, currencyCode) {
    if (typeof amount !== 'number') return 'N/A';
    const symbol = state.symbols[currencyCode] || '$';
    const formattedAmount = amount.toFixed(2).replace('.', ',');
    const nordics = ['SEK', 'NOK', 'DKK'];
    return nordics.includes(currencyCode) ? `${formattedAmount} ${symbol}` : `${symbol}${formattedAmount}`;
}

export const getUserCurrency = () => state.userCurrency;
export const getRates = () => state.rates;

