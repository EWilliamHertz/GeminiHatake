/**
 * csv.js
 * Handles CSV import and export functionality for the collection.
 */
import * as Collection from './collection.js';
import * as API from './api.js';
import * as UI from './ui.js';

let parsedCsvData = [];

const MANABOX_HEADERS = {
    name: ['name', 'card'],
    quantity: ['quantity'],
    set_name: ['set name', 'edition name'],
    set: ['set', 'set code'],
    card_number: ['card number', 'collector number'],
    condition: ['condition'],
    language: ['language'],
    is_foil: ['foil'],
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

export function parseCSV(file) {
    return new Promise((resolve, reject) => {
        if (!file) {
            return reject(new Error("No file provided."));
        }

        const reader = new FileReader();

        reader.onload = (event) => {
            const csv = event.target.result;
            const lines = csv.split(/\r\n|\n/).filter(line => line);
            if (lines.length < 2) {
                return reject(new Error("CSV file must have a header row and at least one data row."));
            }
            const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

            const headerMapping = {
                name: findHeaderIndex(headers, MANABOX_HEADERS.name),
                quantity: findHeaderIndex(headers, MANABOX_HEADERS.quantity),
                set_name: findHeaderIndex(headers, MANABOX_HEADERS.set_name),
                set: findHeaderIndex(headers, MANABOX_HEADERS.set),
                card_number: findHeaderIndex(headers, MANABOX_HEADERS.card_number),
                condition: findHeaderIndex(headers, MANABOX_HEADERS.condition),
                language: findHeaderIndex(headers, MANABOX_HEADERS.language),
                is_foil: findHeaderIndex(headers, MANABOX_HEADERS.is_foil),
            };

            if (headerMapping.name === -1) {
                return reject(new Error('Could not find a "Name" or "Card" column in the CSV.'));
            }
            
            parsedCsvData = [];

            for (let i = 1; i < lines.length; i++) {
                const data = lines[i].split(',');
                const card = {
                    name: data[headerMapping.name]?.replace(/"/g, '').trim(),
                    quantity: parseInt(data[headerMapping.quantity], 10) || 1,
                    set_name: data[headerMapping.set_name]?.replace(/"/g, '').trim() || '',
                    set: data[headerMapping.set]?.replace(/"/g, '').trim() || '',
                    condition: data[headerMapping.condition] || 'Near Mint',
                    language: data[headerMapping.language] || 'English',
                    is_foil: data[headerMapping.is_foil]?.toLowerCase().includes('true') || data[headerMapping.is_foil]?.toLowerCase().includes('yes'),
                };
                parsedCsvData.push(card);
            }
            resolve(parsedCsvData);
        };

        reader.onerror = () => {
            reject(new Error("Failed to read the file."));
        };

        reader.readAsText(file);
    });
}

export async function finalizeImport() {
    UI.updateCsvImportStatus('Importing cards...');
    let successCount = 0;
    let errorCount = 0;

    for (const card of parsedCsvData) {
        if (!card) continue;
        try {
            await new Promise(resolve => setTimeout(resolve, 100)); // Rate limiting
            const searchResults = await API.searchCards(card.name, 'mtg'); // Assuming MTG for now
            if (searchResults.length > 0) {
                let bestMatch = searchResults[0];
                if (card.set_name || card.set) {
                    const specificPrint = searchResults.find(c => c.set_name === card.set_name || c.set === card.set);
                    if (specificPrint) bestMatch = specificPrint;
                }
                
                const cardData = {
                    ...bestMatch,
                    quantity: card.quantity,
                    is_foil: card.is_foil,
                    condition: card.condition,
                    language: card.language,
                    addedAt: new Date().toISOString()
                };
                
                await Collection.addMultipleCards([cardData]);
                successCount++;
            } else {
                errorCount++;
            }
        } catch (error) {
            errorCount++;
            console.error(`Error processing ${card.name}:`, error);
        }
    }

    UI.showToast(`${successCount} cards imported successfully. ${errorCount} cards failed.`, 'success');
    UI.closeModal(document.getElementById('csv-review-modal'));
    Collection.applyFilters();
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

