/**
 * csv-fixed.js
 * Enhanced CSV import functionality for ManaBox files with improved parsing and error handling.
 * Fixes issues with header detection, quote handling, and data processing.
 */
import * as Collection from './collection.js';
import * as API from './api.js';

let parsedCsvData = [];

// Enhanced header mapping for ManaBox and other common CSV formats
const MANABOX_HEADERS = {
    name: ['name', 'card', 'card name', 'cardname'],
    quantity: ['quantity', 'qty', 'count', 'amount'],
    set_name: ['set name', 'edition name', 'set', 'expansion', 'expansion name'],
    set: ['set', 'set code', 'edition', 'expansion code'],
    collector_number: ['card number', 'collector number', 'number', 'card #', '#'],
    condition: ['condition', 'grade', 'state'],
    language: ['language', 'lang'],
    is_foil: ['foil', 'printing', 'finish', 'treatment', 'premium'],
    rarity: ['rarity', 'rare'],
    price: ['price', 'value', 'cost']
};

function findHeaderIndex(headers, possibleNames) {
    for (const name of possibleNames) {
        const index = headers.findIndex(header => {
            const cleanHeader = header.toLowerCase().trim().replace(/['"]/g, '');
            const cleanName = name.toLowerCase().trim();
            return cleanHeader === cleanName || cleanHeader.includes(cleanName);
        });
        if (index > -1) {
            return index;
        }
    }
    return -1;
}

// Enhanced CSV line parser that properly handles quotes, commas, and special characters
function parseCsvLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    let i = 0;
    
    while (i < line.length) {
        const char = line[i];
        const nextChar = line[i + 1];
        
        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                // Handle escaped quotes
                current += '"';
                i += 2;
                continue;
            } else {
                // Toggle quote state
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim().replace(/^"|"$/g, ''));
            current = '';
        } else {
            current += char;
        }
        i++;
    }
    
    // Add the last field
    result.push(current.trim().replace(/^"|"$/g, ''));
    return result;
}

// Enhanced CSV detection and parsing
function detectCsvFormat(lines) {
    if (lines.length < 2) {
        throw new Error("CSV file must have a header row and at least one data row.");
    }
    
    const headerLine = lines[0];
    let delimiter = ',';
    
    // Try to detect delimiter
    const commaCount = (headerLine.match(/,/g) || []).length;
    const semicolonCount = (headerLine.match(/;/g) || []).length;
    const tabCount = (headerLine.match(/\t/g) || []).length;
    
    if (semicolonCount > commaCount && semicolonCount > tabCount) {
        delimiter = ';';
    } else if (tabCount > commaCount && tabCount > semicolonCount) {
        delimiter = '\t';
    }
    
    return { delimiter, headerLine };
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

                const { delimiter } = detectCsvFormat(lines);
                
                // Parse headers with the detected delimiter
                const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
                console.log('Detected CSV headers:', headers);

                const headerMapping = {
                    name: findHeaderIndex(headers, MANABOX_HEADERS.name),
                    quantity: findHeaderIndex(headers, MANABOX_HEADERS.quantity),
                    set_name: findHeaderIndex(headers, MANABOX_HEADERS.set_name),
                    set: findHeaderIndex(headers, MANABOX_HEADERS.set),
                    collector_number: findHeaderIndex(headers, MANABOX_HEADERS.collector_number),
                    condition: findHeaderIndex(headers, MANABOX_HEADERS.condition),
                    language: findHeaderIndex(headers, MANABOX_HEADERS.language),
                    is_foil: findHeaderIndex(headers, MANABOX_HEADERS.is_foil),
                    rarity: findHeaderIndex(headers, MANABOX_HEADERS.rarity),
                    price: findHeaderIndex(headers, MANABOX_HEADERS.price)
                };

                console.log('Header mapping:', headerMapping);

                if (headerMapping.name === -1) {
                    return reject(new Error('Could not find a "Name" or "Card" column in the CSV. Available headers: ' + headers.join(', ')));
                }

                parsedCsvData = [];

                for (let i = 1; i < lines.length; i++) {
                    const data = delimiter === ',' ? parseCsvLine(lines[i]) : lines[i].split(delimiter);
                    
                    if (data.length < headers.length) {
                        console.warn(`Row ${i + 1} has fewer columns than headers, skipping`);
                        continue;
                    }
                    
                    const cardName = data[headerMapping.name]?.trim();
                    if (!cardName) {
                        console.warn(`Row ${i + 1} has no card name, skipping`);
                        continue;
                    }
                    
                    // Enhanced foil detection
                    const foilRaw = data[headerMapping.is_foil] || '';
                    const isFoil = foilRaw.toLowerCase().includes('true') || 
                                  foilRaw.toLowerCase().includes('yes') || 
                                  foilRaw.toLowerCase().includes('foil') ||
                                  foilRaw.toLowerCase().includes('premium') ||
                                  foilRaw === '1';
                    
                    // Enhanced quantity parsing
                    let quantity = 1;
                    if (headerMapping.quantity !== -1) {
                        const qtyRaw = data[headerMapping.quantity];
                        quantity = parseInt(qtyRaw, 10) || 1;
                    }
                    
                    const card = {
                        name: cardName,
                        quantity: quantity,
                        set_name: data[headerMapping.set_name]?.trim() || '',
                        set: data[headerMapping.set]?.trim() || '',
                        collector_number: data[headerMapping.collector_number]?.trim() || '',
                        condition: data[headerMapping.condition]?.trim() || 'Near Mint',
                        language: data[headerMapping.language]?.trim() || 'English',
                        is_foil: isFoil,
                        rarity: data[headerMapping.rarity]?.trim() || '',
                        original_price: data[headerMapping.price]?.trim() || ''
                    };
                    
                    parsedCsvData.push(card);
                }
                
                console.log(`Successfully parsed ${parsedCsvData.length} cards from CSV`);
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

export async function processCSVImport(cards, updateCallback, selectedGame = 'mtg') {
    const results = [];
    
    for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        updateCallback && updateCallback(i, 'processing', `Processing ${card.name}...`);
        
        try {
            // Build search query with improved logic
            let searchQuery = `!"${card.name}"`;
            
            if (selectedGame === 'pokemon') {
                // TCGdex/ScryDex Pokemon search often works best with just name and set code or local ID
                if (card.set && card.set.length > 0) {
                    searchQuery = `"${card.name}" set:${card.set.toLowerCase()}`;
                }
                if (card.collector_number && card.collector_number.length > 0) {
                    searchQuery += ` localId:${card.collector_number}`;
                }
            } else {
                // Add set information if available
                if (card.set && card.set.length > 0) {
                    searchQuery += ` set:${card.set.toLowerCase()}`;
                } else if (card.set_name && card.set_name.length > 0) {
                    // Try to use set name if set code is not available
                    searchQuery += ` set:"${card.set_name}"`;
                }
                
                // Add collector number if available
                if (card.collector_number && card.collector_number.length > 0) {
                    searchQuery += ` cn:${card.collector_number}`;
                }
            }
            
            console.log(`Searching for: ${searchQuery} in game: ${selectedGame}`);
            
            // Search for the card using the API module
            let searchResult = await API.searchCards(searchQuery, selectedGame);
            
            // If no results with specific query, try name-only search
            if (!searchResult || !searchResult.cards || searchResult.cards.length === 0) {
                console.warn(`Specific query failed for "${card.name}". Trying name-only search.`);
                const simpleQuery = `!"${card.name}"`;
                searchResult = await API.searchCards(simpleQuery, selectedGame);
            }
            
            // If still no results, try without quotes
            if (!searchResult || !searchResult.cards || searchResult.cards.length === 0) {
                console.warn(`Quoted search failed for "${card.name}". Trying unquoted search.`);
                searchResult = await API.searchCards(card.name, selectedGame);
            }
            
            if (searchResult && searchResult.cards && searchResult.cards.length > 0) {
                const foundCard = searchResult.cards[0];
                
                // Merge CSV data with found card data
                const cardToImport = {
                    ...foundCard,
                    quantity: card.quantity,
                    condition: card.condition,
                    language: card.language,
                    is_foil: card.is_foil,
                    addedAt: new Date(),
                    // Preserve original CSV data for reference
                    csv_data: {
                        original_name: card.name,
                        original_set: card.set,
                        original_set_name: card.set_name,
                        original_collector_number: card.collector_number,
                        original_price: card.original_price
                    }
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
                    originalName: card.name,
                    originalData: card
                });
                
                updateCallback && updateCallback(i, 'error', 'Not found');
            }
        } catch (error) {
            console.error(`Error processing ${card.name}:`, error);
            results.push({
                index: i,
                status: 'error',
                error: error.message,
                originalName: card.name,
                originalData: card
            });
            
            updateCallback && updateCallback(i, 'error', error.message);
        }
        
        // Small delay to prevent overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 150));
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
            failed: results.length - successfulCards.length,
            failedCards: results.filter(r => r.status === 'error')
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

// Export a function to validate CSV format before processing
export function validateCsvFormat(file) {
    return new Promise((resolve, reject) => {
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
                
                const headers = lines[0].toLowerCase();
                const hasNameColumn = MANABOX_HEADERS.name.some(name => headers.includes(name));
                
                if (!hasNameColumn) {
                    return reject(new Error("CSV file must contain a card name column (Name, Card, etc.)"));
                }
                
                resolve({
                    valid: true,
                    rowCount: lines.length - 1,
                    headers: lines[0].split(',').map(h => h.trim())
                });
                
            } catch (error) {
                reject(error);
            }
        };
        
        reader.onerror = () => {
            reject(new Error("Failed to read the file."));
        };
        
        reader.readAsText(file);
    });
}