import { showNotification } from './modules/utils.js';
import { searchCards } from './modules/api.js';

document.addEventListener('authReady', (e) => {
    const user = e.detail.user;
    if (!user) {
        document.getElementById('bulk-add-container').innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 p-8">Please log in to use this feature.</p>';
        return;
    }

    const db = firebase.firestore();
    const storage = firebase.storage();

    // TCG Configuration
    const TCG_CONFIGS = {
        "Magic: The Gathering": {
            apiKey: "mtg",
            defaultConditions: ["Near Mint", "Lightly Played", "Moderately Played", "Heavily Played", "Damaged"],
            supportsFoil: true,
            supportsSigned: true,
            supportsAltered: true
        },
        "Pokémon": {
            apiKey: "pokemon",
            defaultConditions: ["Mint", "Near Mint", "Excellent", "Good", "Light Play", "Play", "Poor"],
            supportsFoil: false,
            supportsSigned: false,
            supportsAltered: false
        },
        "Lorcana": {
            apiKey: "lorcana",
            defaultConditions: ["Near Mint", "Lightly Played", "Moderately Played", "Heavily Played", "Damaged"],
            supportsFoil: true,
            supportsSigned: false,
            supportsAltered: false
        },
        "Gundam": {
            apiKey: "gundam",
            defaultConditions: ["Near Mint", "Lightly Played", "Moderately Played", "Heavily Played", "Damaged"],
            supportsFoil: false,
            supportsSigned: false,
            supportsAltered: false
        }
    };

    // --- DOM Elements ---
    const step1 = document.getElementById('step-1-input');
    const step2 = document.getElementById('step-2-confirm');
    const pasteForm = document.getElementById('paste-form');
    const cardListInput = document.getElementById('card-list-input');
    const tcgSelect = document.getElementById('tcg-select');

    let linesToProcess = [];
    let confirmedCards = [];
    let currentIndex = 0;
    let selectedTcg = '';

    const parseCardList = (rawText) => {
        return rawText.split('\n')
            .map(line => line.trim())
            .filter(line => line)
            .map((line, index) => {
                let quantity = 1;
                let name = line;
                
                // Support various quantity formats
                const qtyMatch = line.match(/^(?:(\d+)\s?x?\s*)/i);
                if (qtyMatch) {
                    quantity = parseInt(qtyMatch[1], 10);
                    name = name.replace(qtyMatch[0], '').trim();
                }
                
                // Clean up card name (remove set codes, comments, etc.)
                name = name.replace(/\s*\([A-Z0-9]+\)\s*$/i, ''); // Remove set codes like (M21)
                name = name.replace(/\s*\/\/.*$/, ''); // Remove comments after //
                name = name.trim();
                
                return { id: `card-row-${index}`, originalLine: line, quantity, name };
            });
    };

    const getCardImageUrl = (cardData) => {
        if (cardData.image_uris) {
            return cardData.image_uris.normal || cardData.image_uris.large || cardData.image_uris.small;
        }
        if (cardData.card_faces && cardData.card_faces[0].image_uris) {
            return cardData.card_faces[0].image_uris.normal || cardData.card_faces[0].image_uris.large;
        }
        return 'https://placehold.co/223x310/cccccc/969696?text=No+Image';
    };

    const renderConfirmationModal = async () => {
        if (currentIndex >= linesToProcess.length) {
            await finalizeBulkAdd();
            return;
        }

        const currentLine = linesToProcess[currentIndex];
        const tcgConfig = TCG_CONFIGS[selectedTcg];
        
        showNotification(`Processing card ${currentIndex + 1} of ${linesToProcess.length}: "${currentLine.name}"`, 'info');

        try {
            // Use centralized searchCards function
            const versions = await searchCards(currentLine.name, tcgConfig.apiKey);
            
            if (!versions || versions.length === 0) {
                showNotification(`No results found for "${currentLine.name}". Skipping...`, 'warning');
                moveToNextCard(); // Skip if no versions found
                return;
            }
            
            const firstVersion = versions[0];
            const versionsOptions = versions.map(v => {
                const setName = v.set_name || v.set || 'Unknown Set';
                const setCode = v.set || 'UNK';
                return `<option value='${JSON.stringify(v)}'>${setName} (${setCode.toUpperCase()})</option>`;
            }).join('');

            // Generate condition options based on TCG
            const conditionOptions = tcgConfig.defaultConditions.map(condition => 
                `<option value="${condition}">${condition}</option>`
            ).join('');

            // Generate special options based on TCG support
            let specialOptionsHTML = '';
            if (tcgConfig.supportsFoil) {
                specialOptionsHTML += '<label><input type="checkbox" id="modal-is-foil" class="mr-1">Foil</label>';
            }
            if (tcgConfig.supportsSigned) {
                specialOptionsHTML += '<label><input type="checkbox" id="modal-is-signed" class="mr-1">Signed</label>';
            }
            if (tcgConfig.supportsAltered) {
                specialOptionsHTML += '<label><input type="checkbox" id="modal-is-altered" class="mr-1">Altered</label>';
            }

            const modalHTML = `
            <div id="bulk-add-modal" class="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[1001] p-4">
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[95vh] flex flex-col">
                    <div class="flex justify-between items-center p-4 border-b dark:border-gray-700">
                        <h2 class="text-xl font-bold dark:text-white">Confirm: <span class="text-blue-500">${currentLine.name}</span></h2>
                        <div class="flex items-center space-x-2">
                            <span class="text-sm text-gray-500 dark:text-gray-400">${selectedTcg}</span>
                            <button class="close-modal-btn text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">&times;</button>
                        </div>
                    </div>
                    <div class="p-6 overflow-y-auto">
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div class="md:col-span-1">
                                <img id="modal-card-image" src="${getCardImageUrl(firstVersion)}" class="rounded-lg w-full" alt="${firstVersion.name}">
                            </div>
                            <div class="md:col-span-2 grid grid-cols-2 gap-4">
                                <div class="col-span-2">
                                    <label class="block font-bold mb-1">Version/Set</label>
                                    <select id="modal-set-select" class="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600">${versionsOptions}</select>
                                </div>
                                <div>
                                    <label class="block font-bold mb-1">Quantity</label>
                                    <input type="number" id="modal-quantity" value="${currentLine.quantity}" min="1" class="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600">
                                </div>
                                <div>
                                    <label class="block font-bold mb-1">Condition</label>
                                    <select id="modal-condition" class="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600">
                                        ${conditionOptions}
                                    </select>
                                </div>
                                <div class="col-span-2">
                                    <label class="block font-bold mb-1">Upload Custom Image (Optional)</label>
                                    <input type="file" id="modal-image-upload" accept="image/*" class="text-xs w-full">
                                </div>
                                ${specialOptionsHTML ? `
                                <div class="col-span-2 flex items-center space-x-4 mt-2">
                                    ${specialOptionsHTML}
                                </div>
                                ` : ''}
                                <div class="col-span-2">
                                     <label class="block font-bold mb-1">Notes (Optional)</label>
                                     <textarea id="modal-notes" class="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" rows="3" placeholder="Add any additional notes about this card..."></textarea>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="flex justify-between p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                        <div class="text-sm text-gray-500 dark:text-gray-400">
                            Card ${currentIndex + 1} of ${linesToProcess.length}
                        </div>
                        <div class="flex space-x-2">
                            <button class="skip-btn px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700">Skip</button>
                            <button id="modal-confirm-btn" class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">Confirm & Next</button>
                        </div>
                    </div>
                </div>
            </div>`;
            
            document.body.insertAdjacentHTML('beforeend', modalHTML);

            const modalElement = document.getElementById('bulk-add-modal');
            
            // Update image when set selection changes
            modalElement.querySelector('#modal-set-select').addEventListener('change', (e) => {
                const selectedData = JSON.parse(e.target.value);
                modalElement.querySelector('#modal-card-image').src = getCardImageUrl(selectedData);
            });
            
            const confirmAndClose = () => {
                const selectedCardData = JSON.parse(modalElement.querySelector('#modal-set-select').value);
                const imageFile = modalElement.querySelector('#modal-image-upload').files[0];

                const cardToAdd = {
                    ...selectedCardData,
                    quantity: parseInt(modalElement.querySelector('#modal-quantity').value, 10),
                    condition: modalElement.querySelector('#modal-condition').value,
                    notes: modalElement.querySelector('#modal-notes').value,
                    addedAt: new Date(),
                    forSale: false,
                    purchasePrice: 0,
                    imageFile: imageFile || null,
                    game: selectedTcg
                };

                // Add TCG-specific properties
                if (tcgConfig.supportsFoil) {
                    cardToAdd.isFoil = modalElement.querySelector('#modal-is-foil')?.checked || false;
                }
                if (tcgConfig.supportsSigned) {
                    cardToAdd.isSigned = modalElement.querySelector('#modal-is-signed')?.checked || false;
                }
                if (tcgConfig.supportsAltered) {
                    cardToAdd.isAltered = modalElement.querySelector('#modal-is-altered')?.checked || false;
                }

                confirmedCards.push(cardToAdd);
                modalElement.remove();
                moveToNextCard();
            };
            
            const skipAndClose = () => {
                showNotification(`Skipped "${currentLine.name}"`, 'info');
                modalElement.remove();
                moveToNextCard();
            };

            modalElement.querySelector('#modal-confirm-btn').addEventListener('click', confirmAndClose);
            modalElement.querySelectorAll('.close-modal-btn, .skip-btn').forEach(btn => btn.addEventListener('click', skipAndClose));

            // Handle escape key
            const handleEscape = (e) => {
                if (e.key === 'Escape') {
                    skipAndClose();
                    document.removeEventListener('keydown', handleEscape);
                }
            };
            document.addEventListener('keydown', handleEscape);

        } catch (error) {
            console.error(`Failed to fetch ${currentLine.name}:`, error);
            showNotification(`Error searching for "${currentLine.name}": ${error.message}. Skipping...`, 'error');
            moveToNextCard(); // Skip on error
        }
    };

    const moveToNextCard = () => {
        currentIndex++;
        renderConfirmationModal();
    };

    const finalizeBulkAdd = async () => {
        if (confirmedCards.length === 0) {
            showNotification('No cards were confirmed for addition.', 'info');
            resetBulkAdd();
            return;
        }

        showNotification(`Saving ${confirmedCards.length} cards to your collection...`, 'info');
        
        try {
            const batch = db.batch();
            const collectionRef = db.collection('users').doc(user.uid).collection('collection');

            for (const card of confirmedCards) {
                const { imageFile, ...cardData } = card;
                
                // Upload custom image if provided
                if (imageFile) {
                    try {
                        const imageRef = storage.ref(`user_uploads/${user.uid}/${Date.now()}_${imageFile.name}`);
                        const snapshot = await imageRef.put(imageFile);
                        cardData.customImageUrl = await snapshot.ref.getDownloadURL();
                    } catch (imageError) {
                        console.error('Error uploading image:', imageError);
                        // Continue without custom image
                    }
                }
                
                const docRef = collectionRef.doc();
                batch.set(docRef, cardData);
            }

            await batch.commit();
            showNotification(`Successfully added ${confirmedCards.length} cards to your collection!`, 'success');
            
            // Redirect to collection after a short delay
            setTimeout(() => {
                window.location.href = 'my_collection.html';
            }, 2000);
            
        } catch (error) {
            console.error("Error finalizing bulk add:", error);
            showNotification(`An error occurred while saving cards: ${error.message}`, 'error');
        } finally {
            resetBulkAdd();
        }
    };

    const resetBulkAdd = () => {
        step1.classList.remove('hidden');
        step2.classList.add('hidden');
        cardListInput.value = '';
        tcgSelect.value = '';
        linesToProcess = [];
        confirmedCards = [];
        currentIndex = 0;
        selectedTcg = '';
    };

    // Update placeholder text based on selected TCG
    tcgSelect.addEventListener('change', (e) => {
        selectedTcg = e.target.value;
        const tcgConfig = TCG_CONFIGS[selectedTcg];
        
        if (selectedTcg === 'Magic: The Gathering') {
            cardListInput.placeholder = `1x Sol Ring
4x Lightning Bolt
2x Counterspell
1x Black Lotus

Format examples:
- 1x Card Name
- 4 Card Name  
- Card Name (quantity defaults to 1)`;
        } else if (selectedTcg === 'Pokémon') {
            cardListInput.placeholder = `4x Professor Oak
2x Charizard
1x Pikachu

Format examples:
- 4x Card Name
- 2 Card Name
- Card Name (quantity defaults to 1)`;
        } else if (selectedTcg === 'Lorcana') {
            cardListInput.placeholder = `4x Mickey Mouse - Brave Little Tailor
2x Elsa - Snow Queen
1x Belle - Hidden Depths

Format examples:
- 4x Card Name
- 2 Card Name
- Card Name (quantity defaults to 1)`;
        } else if (selectedTcg === 'Gundam') {
            cardListInput.placeholder = `3x RX-78-2 Gundam
2x Char's Zaku II
1x Strike Freedom Gundam

Format examples:
- 3x Card Name
- 2 Card Name
- Card Name (quantity defaults to 1)`;
        }
    });

    pasteForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const rawText = cardListInput.value;
        selectedTcg = tcgSelect.value;
        
        if (!selectedTcg) {
            showNotification("Please select a Trading Card Game first.", "error");
            return;
        }
        
        if (!rawText.trim()) {
            showNotification("Please paste a list of cards.", "error");
            return;
        }
        
        linesToProcess = parseCardList(rawText);
        
        if (linesToProcess.length === 0) {
            showNotification("No valid cards found in the list.", "error");
            return;
        }
        
        confirmedCards = [];
        currentIndex = 0;
        
        step1.classList.add('hidden');
        step2.classList.remove('hidden'); 
        
        showNotification(`Found ${linesToProcess.length} cards to process for ${selectedTcg}`, 'info');
        renderConfirmationModal();
    });

    // Initialize with default TCG selection
    if (tcgSelect.options.length > 1) {
        tcgSelect.selectedIndex = 1; // Select first actual option (Magic: The Gathering)
        tcgSelect.dispatchEvent(new Event('change'));
    }
});
