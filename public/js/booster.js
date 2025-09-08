/**
 * HatakeSocial - Booster Pack Simulator Script (v19 - Memory Safe & Cost Analysis)
 *
 * This script uses a hosted MTGJSON AllPrintings.json file to generate booster packs.
 * This version fixes a memory-related RangeError by implementing an efficient,
 * non-allocating weighted random selection algorithm for picking cards from sheets.
 */
document.addEventListener('authReady', () => {
    // Ensure we are on the booster page before running the script
    if (!document.getElementById('generate-booster-btn')) return;

    // This URL points to the AllPrintings.json file hosted in your Firebase Storage bucket.
    const MTGJSON_URL = 'https://firebasestorage.googleapis.com/v0/b/hatakesocial-88b5e.firebasestorage.app/o/AllPrintings.json?alt=media';

    // --- DOM Elements ---
    const generateBtn = document.getElementById('generate-booster-btn');
    const setSelect = document.getElementById('booster-set-select');
    const resultsContainer = document.getElementById('booster-pack-results');
    const statusEl = document.getElementById('booster-status');

    let allPrintingsData = null; // To store the fetched MTGJSON data

    /**
     * Fetches and processes the MTGJSON data file from Firebase Storage.
     */
    const fetchMtgJsonData = async () => {
        statusEl.textContent = 'Downloading card database (this may take a moment)...';
        try {
            const response = await fetch(MTGJSON_URL);
            if (!response.ok) {
                throw new Error(`Failed to download MTGJSON file: ${response.statusText}`);
            }
            const jsonData = await response.json();
            allPrintingsData = jsonData.data;
            return allPrintingsData;
        } catch (error) {
            console.error("Fatal Error fetching MTGJSON data:", error);
            statusEl.innerHTML = `<strong>Error:</strong> Could not download the card database. Please ensure the Firebase Storage URL is correct and the file is public.`;
            setSelect.innerHTML = '<option>Error loading data</option>';
            generateBtn.disabled = true;
            return null;
        }
    };

    /**
     * Populates the set selection dropdown using the loaded MTGJSON data.
     */
    const populateSetList = (data) => {
        setSelect.innerHTML = ''; // Clear "Loading..."

        const setsWithBoosters = Object.values(data)
            .filter(set => set.booster && Object.keys(set.booster).length > 0)
            .sort((a, b) => new Date(b.releaseDate) - new Date(a.releaseDate));

        if (setsWithBoosters.length === 0) {
            throw new Error("No sets with booster information found in the MTGJSON data.");
        }

        setsWithBoosters.forEach(set => {
            const option = document.createElement('option');
            option.value = set.code;
            option.textContent = set.name;
            setSelect.appendChild(option);
        });

        statusEl.textContent = 'Select a set and generate a booster pack!';
    };

    /**
     * Simulates opening a booster pack using MTGJSON's sheet-based logic.
     */
    const generateBooster = () => {
        const setCode = setSelect.value;
        if (!allPrintingsData || !setCode) return;

        const setData = allPrintingsData[setCode];
        if (!setData || !setData.booster) {
            statusEl.textContent = 'This set does not have booster information available.';
            return;
        }

        generateBtn.disabled = true;
        generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Generating...';
        statusEl.textContent = `Generating booster for ${setData.name}...`;
        resultsContainer.innerHTML = '';

        try {
            let boosterConfig = null;
            if (setData.booster.default) {
                boosterConfig = setData.booster.default;
            } else if (setData.booster.draft) {
                boosterConfig = setData.booster.draft;
            } else {
                const availableBoosterTypes = Object.keys(setData.booster);
                if (availableBoosterTypes.length > 0) {
                    boosterConfig = setData.booster[availableBoosterTypes[0]];
                }
            }

            if (!boosterConfig || !boosterConfig.sheets) {
                throw new Error("Could not find a valid booster configuration for this set.");
            }
            
            const pack = [];

            // --- FIX STARTS HERE: EFFICIENT WEIGHTED RANDOM SELECTION ---
            for (const sheetName in boosterConfig.sheets) {
                const sheet = boosterConfig.sheets[sheetName];
                const cardsToPick = sheet.count;
                const cardPool = Object.entries(sheet.cards); // e.g., [['uuid1', 120], ['uuid2', 1]]

                for (let i = 0; i < cardsToPick; i++) {
                    if (cardPool.length === 0) break;

                    const totalWeight = cardPool.reduce((sum, [, weight]) => sum + weight, 0);
                    if (totalWeight <= 0) break; 
                    
                    let randomWeight = Math.floor(Math.random() * totalWeight);
                    
                    let pickedIndex = -1;
                    for (let j = 0; j < cardPool.length; j++) {
                        randomWeight -= cardPool[j][1]; // Subtract the card's weight
                        if (randomWeight < 0) {
                            pickedIndex = j;
                            break;
                        }
                    }
                    
                    if (pickedIndex === -1) { // Fallback for safety
                       pickedIndex = cardPool.length - 1;
                    }

                    const [pickedUuid] = cardPool.splice(pickedIndex, 1)[0]; // Pick and remove from pool
                    pack.push(pickedUuid);
                }
            }
            // --- FIX ENDS HERE ---
            
            displayBoosterCards(pack, setData);
            statusEl.textContent = `Generated a booster pack from ${setData.name}!`;

        } catch (error) {
            console.error('Error generating booster:', error);
            statusEl.textContent = `Error: ${error.message}`;
            resultsContainer.innerHTML = `<p class="col-span-full text-center text-red-500">${error.message}</p>`;
        } finally {
            generateBtn.disabled = false;
            generateBtn.innerHTML = '<i class="fas fa-box-open mr-2"></i>Generate Booster';
        }
    };
    
    /**
     * Finds card data by UUID and displays the images.
     */
    const displayBoosterCards = (packUuids, setData) => {
        const cardMap = new Map();
        setData.cards.forEach(card => cardMap.set(card.uuid, card));

        packUuids.forEach(uuid => {
            const cardData = cardMap.get(uuid);
            if (cardData) {
                const imgEl = document.createElement('img');
                const scryfallId = cardData.identifiers.scryfallId;
                imgEl.src = scryfallId ? `https://api.scryfall.com/cards/${scryfallId}?format=image&version=normal` : 'https://placehold.co/223x310/cccccc/969696?text=Image+Not+Found';
                imgEl.alt = cardData.name;
                imgEl.title = `${cardData.name} (${cardData.rarity})`;
                imgEl.className = 'rounded-lg shadow-md w-full transition-transform hover:scale-105';
                resultsContainer.appendChild(imgEl);
            }
        });
    };
    
    /**
     * Initializes the booster pack simulator.
     */
    const initialize = async () => {
        const data = await fetchMtgJsonData();
        if (data) {
            populateSetList(data);
            generateBtn.addEventListener('click', generateBooster);
        }
    };

    // --- Start the simulator ---
    initialize();
});

