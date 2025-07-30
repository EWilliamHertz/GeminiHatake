/**
 * HatakeSocial - Bulk Add from Text Script (v2 - Image Fix Applied)
 *
 * This script handles all logic for the bulk_add.html page.
 * - FIX: Implements a helper function `getCardImageUrl` to correctly display images for all card types, including double-faced and split cards from Scryfall.
 * - Parses a user's pasted text list of cards.
 * - Fetches potential matches from the Scryfall API.
 * - Presents a step-by-step UI for the user to confirm each card and its details.
 * - Adds the confirmed cards to the user's Firestore collection.
 */

/**
 * Gets the correct image URL for any card type from Scryfall data.
 * Handles standard, double-faced, and split cards.
 * @param {object} cardData The full card data object from Scryfall.
 * @param {string} [size='normal'] The desired image size ('small', 'normal', 'large').
 * @returns {string} The URL of the card image or a placeholder.
 */
function getCardImageUrl(cardData, size = 'normal') {
    // Case 1: The card has multiple faces (MDFCs, split cards, etc.)
    if (cardData.card_faces && cardData.card_faces[0].image_uris) {
        return cardData.card_faces[0].image_uris[size];
    }
    // Case 2: The card is a standard, single-faced card
    if (cardData.image_uris) {
        return cardData.image_uris[size];
    }
    // Fallback if no image is found
    return 'https://placehold.co/223x310/cccccc/969696?text=No+Image';
}


document.addEventListener('authReady', (e) => {
    const user = e.detail.user;
    const container = document.getElementById('bulk-add-container');
    if (!container) return;

    if (!user) {
        container.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 p-8">Please log in to use the bulk add feature.</p>';
        return;
    }

    // --- DOM Elements ---
    const step1 = document.getElementById('step-1-input');
    const step2 = document.getElementById('step-2-confirm');
    const step3 = document.getElementById('step-3-complete');
    const pasteForm = document.getElementById('paste-form');
    const cardListInput = document.getElementById('card-list-input');
    const confirmationArea = document.getElementById('card-confirmation-area');
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    const summaryText = document.getElementById('summary-text');
    
    // --- State ---
    let linesToProcess = [];
    let confirmedCards = [];
    let currentIndex = 0;

    /**
     * Parses the raw text from the textarea into a structured array.
     * Extracts quantity, card name, and set code/name.
     */
    const parseCardList = (rawText) => {
        const lines = rawText.split('\n').filter(line => line.trim() !== '');
        return lines.map(line => {
            let quantity = 1;
            let name = line.trim();
            
            // Regex to find quantity (e.g., "4x ", "4 ", "x4 ")
            const qtyMatch = line.match(/^(?:(\d+)\s?x?\s*|x\s*(\d+)\s+)/i);
            if (qtyMatch) {
                quantity = parseInt(qtyMatch[1] || qtyMatch[2], 10);
                name = name.replace(qtyMatch[0], '').trim();
            }

            // Regex to find set code/name (e.g., "[SOM]", "(SLD)")
            let set = null;
            const setMatch = name.match(/\s*[\[\(]([A-Z0-9]{3,})[\]\)]/i);
            if(setMatch) {
                set = setMatch[1];
                name = name.replace(setMatch[0], '').trim();
            }

            return { originalLine: line, quantity, name, set };
        });
    };

    /**
     * Fetches card data from Scryfall API for a single parsed line.
     */
    const fetchCardVersions = async (line) => {
        let apiUrl = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(line.name)}&unique=prints&order=released&dir=desc`;
        if (line.set) {
            apiUrl += `+set%3A${line.set}`;
        }
        
        try {
            const response = await fetch(apiUrl);
            if (!response.ok) return [];
            const result = await response.json();
            return result.data.map(card => ({
                id: card.id,
                name: card.name,
                set: card.set,
                setName: card.set_name,
                rarity: card.rarity,
                collector_number: card.collector_number,
                imageUrl: getCardImageUrl(card, 'normal'),
                priceUsd: card.prices?.usd || null,
                priceUsdFoil: card.prices?.usd_foil || null,
                tcg: 'Magic: The Gathering'
            }));
        } catch (error) {
            console.error(`Error fetching ${line.name}:`, error);
            return [];
        }
    };
    
    /**
     * Renders the confirmation UI for the current card being processed.
     */
    const renderConfirmationStep = async () => {
        if (currentIndex >= linesToProcess.length) {
            await finalizeBulkAdd();
            return;
        }

        const currentLine = linesToProcess[currentIndex];
        progressText.textContent = `Processing card ${currentIndex + 1} of ${linesToProcess.length}: "${currentLine.originalLine}"`;
        progressBar.style.width = `${((currentIndex) / linesToProcess.length) * 100}%`;
        
        confirmationArea.innerHTML = `<p class="text-center p-4">Searching for "${currentLine.name}"...</p>`;
        
        const versions = await fetchCardVersions(currentLine);

        if (versions.length === 0) {
            confirmationArea.innerHTML = `
                <p class="text-center text-red-500 mb-4">Could not find any versions of "${currentLine.name}".</p>
                <div class="flex justify-center">
                    <button id="skip-btn" class="px-6 py-2 bg-gray-500 text-white font-semibold rounded-full hover:bg-gray-600">Skip This Card</button>
                </div>
            `;
            document.getElementById('skip-btn').addEventListener('click', moveToNextCard);
            return;
        }

        let versionsHtml = versions.map((v, index) => `
            <label class="flex items-center p-3 border dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
                <input type="radio" name="card-version" value="${index}" class="mr-4" ${index === 0 ? 'checked' : ''}>
                <img src="${v.imageUrl}" class="w-12 h-16 object-cover rounded-md mr-4">
                <div class="flex-grow">
                    <p class="font-bold dark:text-white">${v.name}</p>
                    <p class="text-sm text-gray-500 dark:text-gray-400">${v.setName} (#${v.collector_number})</p>
                </div>
                <p class="text-sm font-semibold dark:text-gray-300">${window.HatakeSocial.convertAndFormatPrice(v.priceUsd, 'USD')}</p>
            </label>
        `).join('');

        confirmationArea.innerHTML = `
            <h3 class="font-bold text-xl mb-2 dark:text-white">Confirm version for: <span class="text-blue-500">${currentLine.name}</span></h3>
            <form id="confirm-card-form">
                <div class="space-y-3 max-h-64 overflow-y-auto mb-4">${versionsHtml}</div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block font-bold mb-1 dark:text-gray-200">Quantity</label>
                        <input type="number" id="confirm-quantity" value="${currentLine.quantity}" min="1" class="w-full p-2 border rounded-md dark:bg-gray-900 dark:border-gray-600">
                    </div>
                    <div>
                        <label class="block font-bold mb-1 dark:text-gray-200">Condition</label>
                        <select id="confirm-condition" class="w-full p-2 border rounded-md dark:bg-gray-900 dark:border-gray-600">
                            <option>Near Mint</option>
                            <option>Lightly Played</option>
                            <option>Moderately Played</option>
                            <option>Heavily Played</option>
                            <option>Damaged</option>
                        </select>
                    </div>
                </div>
                <div class="mt-4">
                     <input type="checkbox" id="confirm-foil" class="mr-2 h-4 w-4 rounded text-blue-600 focus:ring-blue-500">
                    <label for="confirm-foil" class="dark:text-gray-300">Is this card foil?</label>
                </div>
                <div class="mt-6 flex justify-between">
                    <button type="button" id="skip-btn" class="px-6 py-2 bg-gray-500 text-white font-semibold rounded-full hover:bg-gray-600">Skip</button>
                    <button type="submit" class="px-6 py-2 bg-green-600 text-white font-semibold rounded-full hover:bg-green-700">Confirm & Next</button>
                </div>
            </form>
        `;

        document.getElementById('confirm-card-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const selectedVersionIndex = e.target.elements['card-version'].value;
            const selectedCardData = versions[selectedVersionIndex];
            
            const cardToAdd = {
                ...selectedCardData,
                quantity: parseInt(document.getElementById('confirm-quantity').value, 10),
                condition: document.getElementById('confirm-condition').value,
                isFoil: document.getElementById('confirm-foil').checked,
                addedAt: new Date(),
                forSale: false,
                purchasePrice: 0 // Default purchase price
            };
            delete cardToAdd.id;
            cardToAdd.scryfallId = selectedCardData.id;

            confirmedCards.push(cardToAdd);
            moveToNextCard();
        });
        document.getElementById('skip-btn').addEventListener('click', moveToNextCard);
    };

    const moveToNextCard = () => {
        currentIndex++;
        renderConfirmationStep();
    };

    const finalizeBulkAdd = async () => {
        step2.classList.add('hidden');
        step3.classList.remove('hidden');
        summaryText.textContent = `Processing ${confirmedCards.length} cards...`;

        const batch = db.batch();
        const collectionRef = db.collection('users').doc(user.uid).collection('collection');

        confirmedCards.forEach(card => {
            const docRef = collectionRef.doc();
            batch.set(docRef, card);
        });

        try {
            await batch.commit();
            summaryText.textContent = `Successfully added ${confirmedCards.length} cards to your collection.`;
        } catch (error) {
            console.error("Error finalizing bulk add:", error);
            summaryText.textContent = `An error occurred while saving your cards. Please check your collection and try again.`;
            summaryText.classList.add('text-red-500');
        }
    };


    // --- Event Listeners ---
    pasteForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const rawText = cardListInput.value;
        if (!rawText.trim()) {
            alert("Please paste a list of cards.");
            return;
        }
        
        linesToProcess = parseCardList(rawText);
        confirmedCards = [];
        currentIndex = 0;
        
        step1.classList.add('hidden');
        step2.classList.remove('hidden');
        
        renderConfirmationStep();
    });
});
