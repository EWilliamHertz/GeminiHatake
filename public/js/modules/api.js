/**
 * api.js - Handles all external API calls for card data.
 */
import { getCardImageUrl } from './utils.js';

const POKEMON_API_KEY = '60a08d4a-3a34-43d8-8f41-827b58cfac6d';
const POKEMON_API_URL = 'https://api.pokemontcg.io/v2/cards';

async function makeApiCall(url, options = {}) {
    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('API call failed:', url, error);
        throw error;
    }
}

export async function searchMagicCards(cardName) {
    const searchUrl = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(cardName)}&unique=prints&order=released&dir=desc`;
    const result = await makeApiCall(searchUrl);
    return result.data.map(card => ({
        id: card.id,
        name: card.name,
        set: card.set,
        setName: card.set_name,
        rarity: card.rarity,
        collector_number: card.collector_number,
        imageUrl: getCardImageUrl(card, 'small'), // Use consistent image URL getter
        priceUsd: card.prices?.usd || null,
        priceUsdFoil: card.prices?.usd_foil || null,
        tcg: 'Magic: The Gathering',
        colors: (card.card_faces ? card.card_faces[0].colors : card.colors) || [],
        card_faces: card.card_faces,
        image_uris: card.image_uris
    }));
}

export async function searchPokemonCards(cardName) {
    const searchUrl = `${POKEMON_API_URL}?q=name:"${encodeURIComponent(cardName)}"&pageSize=20`;
    const result = await makeApiCall(searchUrl, {
        headers: { 'X-Api-Key': POKEMON_API_KEY }
    });
    return result.data.map(card => ({
        id: card.id,
        name: card.name,
        set: card.set.id,
        setName: card.set.name,
        rarity: card.rarity,
        collector_number: card.number,
        imageUrl: card.images.small,
        priceUsd: card.tcgplayer?.prices?.holofoil?.market || card.tcgplayer?.prices?.normal?.market || null,
        priceUsdFoil: card.tcgplayer?.prices?.reverseHolofoil?.market || null,
        tcg: 'Pokémon',
        types: card.types,
        images: card.images
    }));
}