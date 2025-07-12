/**
 * HatakeSocial - Booster Pack Simulator Script
 *
 * This script handles all logic for the booster.html page.
 * - Fetches a comprehensive list of sets from MTGJSON to populate the simulator dropdown.
 * - Generates a simulated booster pack based on the selected set's data.
 * - Displays the generated cards.
 * - FIX: Changed listener to 'authReady' to ensure consistent script initialization across the site.
 */
document.addEventListener('authReady', () => {
    const boosterPageContainer = document.getElementById('generate-booster-btn');
    if (!boosterPageContainer) return; // Exit if not on the booster page

    // --- DOM Elements ---
    const generateBtn = document.getElementById('generate-booster-btn');
    const setSelect = document.getElementById('booster-set-select');
    const resultsContainer = document.getElementById('booster-pack-results');
    const statusEl = document.getElementById('booster-status');

    // --- Main Functions ---

    /**
     * Fetches the list of all sets from MTGJSON and populates the dropdown.
     */
    const populateSetList = async () => {
        statusEl.textContent = 'Fetching set list...';
        try {
            const response = await fetch('https://mtgjson.com/api/v5/SetList.json');
            if (!response.ok) throw new Error('Could not fetch set list from MTGJSON.');
            
            const setListData = await response.json();
            
            setSelect.innerHTML = ''; // Clear "Loading..." message
            
            // Filter for sets that are likely to have booster data and sort by release date
            const filteredAndSortedSets = setListData.data
                .filter(set => ['core', 'expansion', 'masters', 'draft_innovation', 'funny'].includes(set.type) && !set.isOnlineOnly)
                .sort((a, b) => new Date(b.releaseDate) - new Date(a.releaseDate));

            filteredAndSortedSets.forEach(set => {
                const option = document.createElement('option');
                option.value = set.code;
                option.textContent = set.name;
                setSelect.appendChild(option);
            });
            statusEl.textContent = 'Select a set and generate a booster pack!';
        } catch (error) {
            console.error("Error populating set list:", error);
            statusEl.textContent = `Error: ${error.message}`;
            setSelect.innerHTML = '<option>Could not load sets</option>';
        }
    };

    /**
     * Picks a random item from an object based on its weight.
     * @param {Object<string, number>} items - An object where keys are item identifiers and values are their weights.
     * @returns {string} The key of the chosen item.
     */
    const weightedRandom = (items) => {
        const totalWeight = Object.values(items).reduce((sum, weight) => sum + weight, 0);
        let random = Math.random() * totalWeight;
        for (const item in items) {
            if (random < items[item]) {
                return item;
            }
            random -= items[item];
        }
        // Fallback in case of floating point inaccuracies
        return Object.keys(items)[0];
    };

    /**
     * Fetches a specific set's data, generates a pack, and displays it.
     */
    const generateBooster = async () => {
        const setCode = setSelect.value;
        if (!setCode || setCode === 'Could not load sets') {
            statusEl.textContent = 'Please wait for sets to load or select a valid set.';
            return;
        };

        generateBtn.disabled = true;
        generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Generating...';
        statusEl.textContent = `Fetching data for ${setCode}...`;
        resultsContainer.innerHTML = '';
        
        try {
            const response = await fetch(`https://mtgjson.com/api/v5/${setCode}.json`);
            if (!response.ok) throw new Error(`Could not fetch data for ${setCode}.`);
            
            const setData = await response.json();
            
            if (!setData.data.booster) {
                throw new Error(`Booster data not available for ${setCode}. Try a different set.`);
            }
            
            // Use the 'default' booster configuration
            const boosterConfig = setData.data.booster.default;
            if (!boosterConfig || !boosterConfig.boosters || boosterConfig.boosters.length === 0) {
                 throw new Error(`Default booster configuration not found for ${setCode}.`);
            }

            // We'll use the first configuration in the `boosters` array
            const boosterContents = boosterConfig.boosters[0].contents;
            const sheets = boosterConfig.sheets;
            
            // Create a map of cards by their UUID for quick lookup
            const cardsByUuid = setData.data.cards.reduce((acc, card) => {
                acc[card.uuid] = card;
                return acc;
            }, {});

            let generatedPack = [];

            // Iterate through the booster slots (e.g., 'rare', 'common', 'uncommon')
            for (const slot in boosterContents) {
                const count = boosterContents[slot]; // How many cards to pick from this slot
                for (let i = 0; i < count; i++) {
                    const sheet = sheets[slot];
                     if (sheet && sheet.cards) {
                        const cardUuid = weightedRandom(sheet.cards);
                        const cardData = cardsByUuid[cardUuid];
                        if (cardData) {
                            generatedPack.push(cardData);
                        }
                    }
                }
            }
            
            // Display the generated cards
            generatedPack.forEach(card => {
                const imgEl = document.createElement('img');
                // Use Scryfall for high-quality images, linking via the Scryfall ID
                imgEl.src = `https://api.scryfall.com/cards/${card.identifiers.scryfallId}?format=image&version=normal`;
                imgEl.alt = card.name;
                imgEl.title = `${card.name} (${card.rarity})`;
                imgEl.className = 'rounded-lg shadow-md w-full transition-transform hover:scale-105 cursor-pointer';
                imgEl.addEventListener('click', () => window.open(`https://scryfall.com/card/${card.set}/${card.number}`, '_blank'));
                resultsContainer.appendChild(imgEl);
            });
            
            statusEl.textContent = `Generated a booster pack from ${setData.data.name}!`;

        } catch (error) {
            console.error('Error generating booster:', error);
            statusEl.textContent = `Error: ${error.message}`;
            resultsContainer.innerHTML = `<p class="col-span-full text-center text-red-500">${error.message}</p>`;
        } finally {
            generateBtn.disabled = false;
            generateBtn.innerHTML = '<i class="fas fa-box-open mr-2"></i>Generate Booster';
        }
    };

    // --- Event Listeners ---
    generateBtn.addEventListener('click', generateBooster);

    // --- Initial Load ---
    populateSetList();
});
