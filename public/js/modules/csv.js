/**
 * csv.js
 * Handles CSV import and export functionality for the collection.
 * - Merges robust parsing with live progress updates.
 */
import * as Collection from './collection.js';
import * as API from './api.js';

let parsedCsvData = [];

// Header mapping for ManaBox and other common CSV formats
const MANABOX_HEADERS = {
    name: ['name', 'card'],
    quantity: ['quantity'],
    set_name: ['set name', 'edition name'],
    set: ['set', 'set code'],
    collector_number: ['card number', 'collector number'],
    condition: ['condition'],
    language: ['language'],
    is_foil: ['foil', 'printing'], // 'printing' can also indicate foil status
};

function findHeaderIndex(headers, possibleNames) {
    for (const name of possibleNames) {
        const index = headers.indexOf(name);
        if (index > -1) {
            return index;
        }
    }
    return -1;
}

// A more robust CSV line parser that handles quotes
function parseCsvLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}

export function parseCSV(file) {
    return new Promise((resolve, reject) => {
        if (!file) {
            return reject(new Error("No file provided."));
        }

        const reader = new FileReader();

        reader.onload = (event) => {
            try {
                const csv = event.target.result;
                const lines = csv.split(/\r\n|\n/).filter(line => line.trim());
                if (lines.length < 2) {
                    return reject(new Error("CSV file must have a header row and at least one data row."));
                }
                const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));

                const headerMapping = {
                    name: findHeaderIndex(headers, MANABOX_HEADERS.name),
                    quantity: findHeaderIndex(headers, MANABOX_HEADERS.quantity),
                    set_name: findHeaderIndex(headers, MANABOX_HEADERS.set_name),
                    set: findHeaderIndex(headers, MANABOX_HEADERS.set),
                    collector_number: findHeaderIndex(headers, MANABOX_HEADERS.collector_number),
                    condition: findHeaderIndex(headers, MANABOX_HEADERS.condition),
                    language: findHeaderIndex(headers, MANABOX_HEADERS.language),
                    is_foil: findHeaderIndex(headers, MANABOX_HEADERS.is_foil),
                };

                if (headerMapping.name === -1) {
                    return reject(new Error('Could not find a "Name" or "Card" column in the CSV.'));
                }

                parsedCsvData = [];

                for (let i = 1; i < lines.length; i++) {
                    const data = parseCsvLine(lines[i]);
                    const foilRaw = data[headerMapping.is_foil] || '';
                    const card = {
                        name: data[headerMapping.name]?.replace(/"/g, '').trim(),
                        quantity: parseInt(data[headerMapping.quantity], 10) || 1,
                        set_name: data[headerMapping.set_name]?.replace(/"/g, '').trim() || '',
                        set: data[headerMapping.set]?.replace(/"/g, '').trim() || '',
                        collector_number: data[headerMapping.collector_number]?.replace(/"/g, '').trim() || '',
                        condition: data[headerMapping.condition] || 'Near Mint',
                        language: data[headerMapping.language] || 'English',
                        is_foil: foilRaw.toLowerCase().includes('true') || foilRaw.toLowerCase().includes('yes') || foilRaw.toLowerCase().includes('foil'),
                    };
                    if (card.name) {
                        parsedCsvData.push(card);
                    }
                }
                resolve(parsedCsvData);
            } catch (error) {
                console.error("Error parsing CSV:", error);
                reject(error);
            }
        };

        reader.onerror = () => {
            reject(new Error("Failed to read the file."));
        };

        reader.readAsText(file);
    });
}

export async function finalizeImport(UI) {
    const importButton = document.getElementById('finalize-csv-import-btn');
    if (!parsedCsvData || parsedCsvData.length === 0) {
        UI.showToast("No cards to import.", "info");
        return;
    }

    UI.setButtonLoading(importButton, true, "Importing...");
    if (UI.toggleCsvImportProgress) UI.toggleCsvImportProgress(true);

    const totalCards = parsedCsvData.length;
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < totalCards; i++) {
        const card = parsedCsvData[i];
        if (!card) continue;

        if (UI.updateCsvReviewRowStatus) UI.updateCsvReviewRowStatus(i, 'loading');
        
        try {
            await new Promise(resolve => setTimeout(resolve, 110)); // Rate limiting for Scryfall API

            const query = `!"${card.name}" set:${card.set} cn:"${card.collector_number}"`;
            const searchResults = await API.searchCards(query, 'mtg');
            
            if (searchResults.length > 0) {
                const bestMatch = searchResults[0];
                
                const cardData = {
                    ...bestMatch,
                    quantity: card.quantity,
                    is_foil: card.is_foil,
                    condition: card.condition,
                    language: card.language,
                    addedAt: new Date()
                };
                
                await Collection.addMultipleCards([cardData]);
                successCount++;
                if (UI.updateCsvReviewRowStatus) UI.updateCsvReviewRowStatus(i, 'success', 'Imported');
            } else {
                throw new Error("Not found");
            }
        } catch (error) {
            errorCount++;
            console.error(`Error processing ${card.name}:`, error);
            if (UI.updateCsvReviewRowStatus) UI.updateCsvReviewRowStatus(i, 'error', error.message || 'Failed');
        }

        const progress = Math.round(((i + 1) / totalCards) * 100);
        if (UI.updateCsvImportProgress) UI.updateCsvImportProgress(i + 1, totalCards, progress);
    }

    UI.setButtonLoading(importButton, false, "Import Finished");
    importButton.disabled = true;

    UI.showToast(`${successCount} cards imported successfully. ${errorCount > 0 ? `${errorCount} failed.` : ''}`, errorCount > 0 ? 'warning' : 'success');
    
    setTimeout(() => {
        const modal = document.getElementById('csv-review-modal');
        if (modal) UI.closeModal(modal);
        document.dispatchEvent(new CustomEvent('collectionUpdated'));
    }, 3000);
}


export function updateReviewedCard(index, field, value) {
    if (parsedCsvData[index]) {
        parsedCsvData[index][field] = value;
    }
}

export function removeReviewedCard(index) {
    parsedCsvData.splice(index, 1);
}

export function getParsedData() {
    return parsedCsvData;
}