window.Api = (() => {

    async function searchMagicCards(cardName) {
        try {
            const searchUrl = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(cardName)}&unique=prints&order=released&dir=desc&page_size=40`;
            const result = await fetch(searchUrl).then(res => res.json());
            if (result.object === 'error') {
                console.warn("Scryfall API error:", result.details);
                return [];
            }
            return result.data.map(card => ({
                id: card.id,
                name: card.name,
                set: card.set,
                setName: card.set_name,
                rarity: card.rarity,
                collector_number: card.collector_number,
                imageUrl: window.CardDisplay.getCardImageUrl(card, 'small'),
                priceUsd: card.prices?.usd || null,
                priceUsdFoil: card.prices?.usd_foil || null,
                tcg: 'Magic: The Gathering',
                card_faces: card.card_faces,
                image_uris: card.image_uris
            }));
        } catch(error) {
            console.error("Error searching Magic cards:", error);
            return [];
        }
    }

    async function searchPokemonCards(cardName) {
        const searchPokemon = firebase.functions().httpsCallable('searchPokemon');
        try {
            const result = await searchPokemon({ cardName: cardName });
            // The cloud function now returns the `data` array directly
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
                images: card.images
            }));
        } catch (error) {
            console.error("Error calling searchPokemon cloud function:", error);
            window.Utils.showNotification(`Error searching Pokémon cards: ${error.message}`, 'error');
            return [];
        }
    }

    return { searchMagicCards, searchPokemonCards };
})();
