/**
 * HatakeSocial - Booster Pack Simulator Script (v6 - Scryfall API with Debugging)
 *
 * This script handles all logic for the booster.html page.
 * - Uses the Scryfall API to avoid all CORS issues.
 * - Includes on-page logging to diagnose any remaining issues.
 */
document.addEventListener('authReady', () => {
    const boosterPageContainer = document.getElementById('generate-booster-btn');
    if (!boosterPageContainer) return;

    // --- DOM Elements ---
    const generateBtn = document.getElementById('generate-booster-btn');
    const setSelect = document.getElementById('booster-set-select');
    const resultsContainer = document.getElementById('booster-pack-results');
    const statusEl = document.getElementById('booster-status');
    const debugOutput = document.getElementById('debug-output'); // The new debug area

    // --- Helper to print debug messages to the screen ---
    const log = (message) => {
        if (debugOutput) {
            debugOutput.textContent += message + '\n';
        }
        console.log(message);
    };

    /**
     * Fetches the list of all sets from the Scryfall API and populates the dropdown.
     */
    const populateSetList = async () => {
        statusEl.textContent = 'Fetching set list...';
        log('--- Starting populateSetList ---');
        try {
            log('Attempting to fetch from Scryfall API: https://api.scryfall.com/sets');
            const response = await fetch('https://api.scryfall.com/sets');
            log(`API Response Status: ${response.status} ${response.statusText}`);

            if (!response.ok) {
                throw new Error(`Scryfall API Error: ${response.statusText}`);
            }
            
            const setData = await response.json();
            log(`Successfully fetched data. Found ${setData.data.length} total sets from Scryfall.`);
            
            setSelect.innerHTML = ''; // Clear "Loading..." message
            
            // Filter for sets that can be opened in boosters.
            const boosterSets = setData.data
                .filter(set => set.booster && !set.digital)
                .sort((a, b) => new Date(b.released_at) - new Date(a.released_at));
            
            log(`Found ${boosterSets.length} sets after filtering.`);

            if (boosterSets.length === 0) {
                 throw new Error("Filtering resulted in 0 sets. The dropdown will be empty.");
            }

            boosterSets.forEach(set => {
                const option = document.createElement('option');
                option.value = set.code;
                option.textContent = set.name;
                setSelect.appendChild(option);
            });
            
            log('--- Finished populating dropdown successfully. ---');
            statusEl.textContent = 'Select a set and generate a booster pack!';
        } catch (error) {
            console.error("Error populating set list:", error);
            log(`--- ERROR CAUGHT --- \n${error.message}`);
            statusEl.innerHTML = `<strong>Error: Load failed.</strong> Could not fetch data from Scryfall. Please check your internet connection and the debug output below.`;
            setSelect.innerHTML = '<option>Could not load sets</option>';
        }
    };

    /**
     * Fetches a generated booster pack from the Scryfall API and displays it.
     */
    const generateBooster = async () => {
        const setCode = setSelect.value;
        if (!setCode || setCode === 'Could not load sets') {
            statusEl.textContent = 'Please wait for sets to load or select a valid set.';
            return;
        };

        generateBtn.disabled = true;
        generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Generating...';
        statusEl.textContent = `Generating booster for ${setSelect.options[setSelect.selectedIndex].text}...`;
        resultsContainer.innerHTML = '';
        
        try {
            const response = await fetch(`https://api.scryfall.com/sets/${setCode}/booster`);

            if (!response.ok) {
                 if(response.status === 404) {
                    throw new Error(`Scryfall does not have booster data for this set. Please try another.`);
                 }
                 throw new Error(`Scryfall API Error: ${response.statusText}`);
            }
            
            const boosterData = await response.json();
            
            if (!boosterData.data || boosterData.data.length === 0) {
                 throw new Error('Received empty booster pack data from Scryfall.');
            }

            boosterData.data.forEach(card => {
                const imgEl = document.createElement('img');
                imgEl.src = card.image_uris?.normal || 'https://placehold.co/223x310/cccccc/969696?text=Image+Not+Found';
                imgEl.alt = card.name;
                imgEl.title = `${card.name} (${card.rarity})`;
                imgEl.className = 'rounded-lg shadow-md w-full transition-transform hover:scale-105 cursor-pointer';
                imgEl.addEventListener('click', () => window.open(card.scryfall_uri, '_blank'));
                resultsContainer.appendChild(imgEl);
            });
            
            statusEl.textContent = `Generated a booster pack from ${boosterData.data[0].set_name}!`;

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
