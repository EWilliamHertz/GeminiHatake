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
        state.rates = result.data;
        state.rates['USD'] = 1;
        console.log(`Currency rates loaded. User currency: ${state.userCurrency}.`);
    } catch (error) {
        console.error("Failed to initialize currency rates:", error);
        state.rates = { 'USD': 1 }; // Fallback
    }
}

export function convertAndFormat(priceInUsd) {
    if (typeof priceInUsd !== 'number' || !state.rates) {
        return formatPrice(priceInUsd, 'USD');
    }
    const rate = state.rates[state.userCurrency];
    const convertedPrice = priceInUsd * (rate || 1);
    return formatPrice(convertedPrice, state.userCurrency);
}

export function convertFromSekAndFormat(priceInSek) {
    if (typeof priceInSek !== 'number' || !state.rates || !state.rates.SEK) {
        return formatPrice(priceInSek, 'SEK');
    }
    const priceInUsd = priceInSek / state.rates.SEK;
    return convertAndFormat(priceInUsd);
}

function formatPrice(amount, currencyCode) {
    if (typeof amount !== 'number') return 'N/A';
    const symbol = state.symbols[currencyCode] || '$';
    const formattedAmount = amount.toFixed(2).replace('.', ',');
    const nordics = ['SEK', 'NOK', 'DKK'];
    return nordics.includes(currencyCode) ? `${formattedAmount} ${symbol}` : `${symbol}${formattedAmount}`;
}