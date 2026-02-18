/**
 * csv.js
 * Handles CSV import and export functionality for the collection.
 * - Fixed to work with the actual Firebase backend and API module
 * - Proper error handling and user feedback
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
        const index = headers.findIndex(header => 
            header.toLowerCase().includes(name.toLowerCase())
        );
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
                let csv = event.target.result;
                // Remove BOM if present
                if (csv.charCodeAt(0) === 0xFEFF) {
                    csv = csv.substring(1);
                }
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

export async function processCSVImport(cards, updateCallback) {
    const results = [];
    
    for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        updateCallback && updateCallback(i, 'processing', `Processing ${card.name}...`);
        
        try {
            // Search for the card using the API module
            let searchQuery = `!"${card.name}"`;
            const selectedGame = card.game || 'mtg';
            
            if (selectedGame === 'pokemon') {
                if (card.set && card.set.length > 0) {
                    searchQuery = `"${card.name}" set:${card.set.toLowerCase()}`;
                }
                if (card.collector_number && card.collector_number.length > 0) {
                    searchQuery += ` localId:${card.collector_number}`;
                }
            }
            
            const searchResult = await API.searchCards(searchQuery, selectedGame);
            
            if (searchResult && searchResult.cards && searchResult.cards.length > 0) {
                const foundCard = searchResult.cards[0];
                
                // Merge CSV data with found card data
                const cardToImport = {
                    ...foundCard,
                    quantity: card.quantity,
                    condition: card.condition,
                    language: card.language,
                    is_foil: card.is_foil,
                    addedAt: new Date()
                };
                
                results.push({
                    index: i,
                    status: 'success',
                    card: cardToImport,
                    originalName: card.name
                });
                
                updateCallback && updateCallback(i, 'success', 'Found');
            } else {
                results.push({
                    index: i,
                    status: 'error',
                    error: 'Card not found',
                    originalName: card.name
                });
                
                updateCallback && updateCallback(i, 'error', 'Not found');
            }
        } catch (error) {
            console.error(`Error processing ${card.name}:`, error);
            results.push({
                index: i,
                status: 'error',
                error: error.message,
                originalName: card.name
            });
            
            updateCallback && updateCallback(i, 'error', error.message);
        }
        
        // Small delay to prevent overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return results;
}

export async function finalizeImport(results) {
    const successfulCards = results.filter(r => r.status === 'success').map(r => r.card);
    
    if (successfulCards.length === 0) {
        throw new Error('No cards to import');
    }
    
    try {
        await Collection.addMultipleCards(successfulCards);
        return {
            imported: successfulCards.length,
            failed: results.length - successfulCards.length
        };
    } catch (error) {
        console.error('Error importing cards:', error);
        throw error;
    }
}

export function getParsedData() {
    return parsedCsvData;
}

export function clearParsedData() {
    parsedCsvData = [];
}

export function updateReviewedCard(index, field, value) {
    if (parsedCsvData[index]) {
        parsedCsvData[index][field] = value;
    }
}

export function removeReviewedCard(index) {
    parsedCsvData.splice(index, 1);
}
