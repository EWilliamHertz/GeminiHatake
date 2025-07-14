/**
 * HatakeSocial - Booster Pack Simulator Script (v8 - Final Filter Fix)
 *
 * This script handles all logic for the booster.html page.
 * - FINAL FIX: The filter for sets from the Scryfall API has been corrected
 * to use the 'set.booster' boolean flag, which accurately reflects
 * whether the API can generate a booster for that set.
 */
document.addEventListener('authReady', () => {
    const boosterPageContainer = document.getElementById('generate-booster-btn');
    if (!boosterPageContainer) return; // Exit if not on the booster page

    // --- DOM Elements ---
    const generateBtn = document.getElementById('generate-booster-btn');
    const setSelect = document.getElementById('booster-set-select');
    const resultsContainer = document.getElementById('booster-pack-results');
    const statusEl = document.getElementById('booster-status');
    const debugOutput = document.getElementById('debug-output');

    /**
     * Fetches the list of all sets from the Scryfall API and populates the dropdown.
     */
    const populateSetList = async () => {
        statusEl.textContent = 'Fetching set list...';
        try {
            const response = await fetch('https://api.scryfall.com/sets');
            if (!response.ok) {
                throw new Error(`Scryfall API Error: ${response.statusText}`);
            }
            
            const setData = await response.json();
            setSelect.innerHTML = '';

            // **THE FINAL FIX IS HERE:** Using Scryfall's 'booster' flag.
            // This is the most accurate way to filter for sets that have booster packs.
            const boosterSets = setData.data
                .filter(set => set.booster && !set.digital)
                .sort((a, b) => new Date(b.released_at) - new Date(a.released_at));

            if (boosterSets.length === 0) {
                 throw new Error("Filtering still resulted in 0 sets. There might be a temporary issue with the Scryfall API.");
            }

            boosterSets.forEach(set => {
                const option = document.createElement('option');
                option.value = set.code;
                option.textContent = set.name;
                setSelect.appendChild(option);
            });
            
            statusEl.textContent = 'Select a set and generate a booster pack!';
            if(debugOutput) debugOutput.style.display = 'none'; // Hide debug box on success

        } catch (error) {
            console.error("Error populating set list:", error);
            statusEl.innerHTML = `<strong>Error: Load failed.</strong> Could not process the set list.`;
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
