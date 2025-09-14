import { showNotification } from './modules/utils.js';
import * as api from './modules/api.js';

document.addEventListener('authReady', (e) => {
    const user = e.detail.user;
    if (!user) {
        document.getElementById('bulk-add-container').innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 p-8">Please log in to use this feature.</p>';
        return;
    }

    const db = firebase.firestore();
    const storage = firebase.storage();

    // --- DOM Elements ---
    const step1 = document.getElementById('step-1-input');
    const step2 = document.getElementById('step-2-confirm');
    const pasteForm = document.getElementById('paste-form');
    const cardListInput = document.getElementById('card-list-input');

    let linesToProcess = [];
    let confirmedCards = [];
    let currentIndex = 0;

    const parseCardList = (rawText) => {
        return rawText.split('\n')
            .map(line => line.trim())
            .filter(line => line)
            .map((line, index) => {
                let quantity = 1;
                let name = line;
                const qtyMatch = line.match(/^(?:(\d+)\s?x?\s*)/i);
                if (qtyMatch) {
                    quantity = parseInt(qtyMatch[1], 10);
                    name = name.replace(qtyMatch[0], '').trim();
                }
                return { id: `card-row-${index}`, originalLine: line, quantity, name };
            });
    };

    const renderConfirmationModal = async () => {
        if (currentIndex >= linesToProcess.length) {
            await finalizeBulkAdd();
            return;
        }

        const currentLine = linesToProcess[currentIndex];
        showNotification(`Processing card ${currentIndex + 1} of ${linesToProcess.length}: "${currentLine.name}"`, 'info');

        try {
            const versions = await api.searchMagicCards(currentLine.name);
            if (!versions || versions.length === 0) {
                moveToNextCard(); // Skip if no versions found
                return;
            }
            
            const firstVersion = versions[0];
            const versionsOptions = versions.map(v => `<option value='${JSON.stringify(v)}'>${v.setName} (${v.set.toUpperCase()})</option>`).join('');

            const modalHTML = `
            <div id="bulk-add-modal" class="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[1001] p-4">
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[95vh] flex flex-col">
                    <div class="flex justify-between items-center p-4 border-b dark:border-gray-700">
                        <h2 class="text-xl font-bold dark:text-white">Confirm: <span class="text-blue-500">${currentLine.name}</span></h2>
                        <button class="close-modal-btn text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">&times;</button>
                    </div>
                    <div class="p-6 overflow-y-auto">
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div class="md:col-span-1">
                                <img id="modal-card-image" src="${firstVersion.imageUrl}" class="rounded-lg w-full">
                            </div>
                            <div class="md:col-span-2 grid grid-cols-2 gap-4">
                                <div>
                                    <label class="block font-bold mb-1">Expansion</label>
                                    <select id="modal-set-select" class="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600">${versionsOptions}</select>
                                </div>
                                <div>
                                    <label class="block font-bold mb-1">Quantity</label>
                                    <input type="number" id="modal-quantity" value="${currentLine.quantity}" min="1" class="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600">
                                </div>
                                <div>
                                    <label class="block font-bold mb-1">Condition</label>
                                    <select id="modal-condition" class="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600">
                                        <option>Near Mint</option>
                                        <option>Lightly Played</option>
                                        <option>Moderately Played</option>
                                        <option>Heavily Played</option>
                                        <option>Damaged</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="block font-bold mb-1">Upload Image</label>
                                    <input type="file" id="modal-image-upload" class="text-xs">
                                </div>
                                <div class="col-span-2 flex items-center space-x-4 mt-2">
                                    <label><input type="checkbox" id="modal-is-foil" class="mr-1">Foil</label>
                                    <label><input type="checkbox" id="modal-is-signed" class="mr-1">Signed</label>
                                    <label><input type="checkbox" id="modal-is-altered" class="mr-1">Altered</label>
                                </div>
                                <div class="col-span-2">
                                     <label class="block font-bold mb-1">Notes</label>
                                     <textarea id="modal-notes" class="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" rows="3"></textarea>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="flex justify-end p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                        <button class="skip-btn px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 mr-2">Skip</button>
                        <button id="modal-confirm-btn" class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">Confirm & Next</button>
                    </div>
                </div>
            </div>`;
            
            document.body.insertAdjacentHTML('beforeend', modalHTML);

            const modalElement = document.getElementById('bulk-add-modal');
            
            modalElement.querySelector('#modal-set-select').addEventListener('change', (e) => {
                const selectedData = JSON.parse(e.target.value);
                modalElement.querySelector('#modal-card-image').src = selectedData.imageUrl;
            });
            
            const confirmAndClose = () => {
                const selectedCardData = JSON.parse(modalElement.querySelector('#modal-set-select').value);
                const imageFile = modalElement.querySelector('#modal-image-upload').files[0];

                const cardToAdd = {
                    ...selectedCardData,
                    quantity: parseInt(modalElement.querySelector('#modal-quantity').value, 10),
                    condition: modalElement.querySelector('#modal-condition').value,
                    isFoil: modalElement.querySelector('#modal-is-foil').checked,
                    isSigned: modalElement.querySelector('#modal-is-signed').checked,
                    isAltered: modalElement.querySelector('#modal-is-altered').checked,
                    notes: modalElement.querySelector('#modal-notes').value,
                    addedAt: new Date(),
                    forSale: false,
                    purchasePrice: 0,
                    imageFile: imageFile || null
                };

                confirmedCards.push(cardToAdd);
                modalElement.remove();
                moveToNextCard();
            };
            
            const skipAndClose = () => {
                modalElement.remove();
                moveToNextCard();
            };

            modalElement.querySelector('#modal-confirm-btn').addEventListener('click', confirmAndClose);
            modalElement.querySelectorAll('.close-modal-btn, .skip-btn').forEach(btn => btn.addEventListener('click', skipAndClose));

        } catch (error) {
            console.error(`Failed to fetch ${currentLine.name}:`, error);
            moveToNextCard(); // Skip on error
        }
    };

    const moveToNextCard = () => {
        currentIndex++;
        renderConfirmationModal();
    };

    const finalizeBulkAdd = async () => {
        if (confirmedCards.length === 0) {
            showNotification('No cards were confirmed.', 'info');
            resetBulkAdd();
            return;
        }

        showNotification(`Saving ${confirmedCards.length} cards...`, 'info');
        
        const batch = db.batch();
        const collectionRef = db.collection('users').doc(user.uid).collection('collection');

        for (const card of confirmedCards) {
            const { imageFile, ...cardData } = card;
            if (imageFile) {
                const imageRef = storage.ref(`user_uploads/${user.uid}/${Date.now()}_${imageFile.name}`);
                const snapshot = await imageRef.put(imageFile);
                cardData.customImageUrl = await snapshot.ref.getDownloadURL();
            }
            const docRef = collectionRef.doc();
            batch.set(docRef, cardData);
        }

        try {
            await batch.commit();
            showNotification(`Successfully added ${confirmedCards.length} cards.`, 'success');
        } catch (error) {
            console.error("Error finalizing bulk add:", error);
            showNotification(`An error occurred while saving.`, 'error');
        } finally {
            resetBulkAdd();
        }
    };

    const resetBulkAdd = () => {
        step1.classList.remove('hidden');
        step2.classList.add('hidden');
        cardListInput.value = '';
        linesToProcess = [];
        confirmedCards = [];
        currentIndex = 0;
    };

    pasteForm.addEventListener('submit', (e) => {
        e.preventDefault(); // This was the missing piece
        const rawText = cardListInput.value;
        if (!rawText.trim()) {
            showNotification("Please paste a list of cards.", "error");
            return;
        }
        
        linesToProcess = parseCardList(rawText);
        confirmedCards = [];
        currentIndex = 0;
        
        step1.classList.add('hidden');
        step2.classList.remove('hidden'); 
        
        renderConfirmationModal();
    });
});