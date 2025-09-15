/**
 * csv.js
 * Handles CSV import and export functionality for the collection.
 */
import * as Collection from './collection.js';
import * as API from './api.js';
import * as UI from './ui.js';

/**
 * Parses a CSV file and adds the cards to the collection.
 * @param {File} file The CSV file to import.
 */
export async function handleCSVImport(file) {
    if (!file) return;

    UI.updateCsvImportStatus('Starting import...');
    const reader = new FileReader();

    reader.onload = async (event) => {
        const csv = event.target.result;
        const lines = csv.split(/\r\n|\n/);
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

        // Simple column detection
        const nameIndex = headers.indexOf('name') > -1 ? headers.indexOf('name') : headers.indexOf('card name');
        const quantityIndex = headers.indexOf('quantity');
        const setIndex = headers.indexOf('set') > -1 ? headers.indexOf('set') : headers.indexOf('set name');
        const foilIndex = headers.indexOf('foil');

        if (nameIndex === -1) {
            UI.updateCsvImportStatus('Error: Could not find a "Name" column in the CSV.');
            return;
        }

        for (let i = 1; i < lines.length; i++) {
            if (!lines[i]) continue;
            const data = lines[i].split(',');

            const cardName = data[nameIndex]?.replace(/"/g, '').trim();
            if (!cardName) continue;

            UI.updateCsvImportStatus(`Processing: ${cardName}...`);

            try {
                // Search for the card on Scryfall
                const searchResults = await API.searchCards(cardName, 'mtg'); // Assuming MTG for now
                if (searchResults.length > 0) {
                    const bestMatch = searchResults[0]; // Take the first result
                    
                    const cardData = {
                        ...bestMatch,
                        quantity: quantityIndex > -1 ? parseInt(data[quantityIndex], 10) || 1 : 1,
                        is_foil: foilIndex > -1 ? (data[foilIndex]?.toLowerCase().includes('true') || data[foilIndex]?.toLowerCase().includes('yes')) : false,
                        condition: 'Near Mint', // Default
                        language: 'English', // Default
                        addedAt: new Date().toISOString()
                    };
                    
                    await Collection.addCard(cardData);
                    UI.updateCsvImportStatus(`<span style="color: green;">✓ Added ${cardName}</span>`);
                } else {
                    UI.updateCsvImportStatus(`<span style="color: orange;">✗ Could not find ${cardName}</span>`);
                }
            } catch (error) {
                UI.updateCsvImportStatus(`<span style="color: red;">! Error processing ${cardName}: ${error.message}</span>`);
            }
        }
        UI.updateCsvImportStatus('Import complete.');
    };

    reader.readAsText(file);
}

/**
 * Exports the current collection state to a CSV file and triggers a download.
 */
export function exportCollectionToCSV() {
    const collection = Collection.getState().fullCollection;
    if (collection.length === 0) {
        showToast("Your collection is empty.", "info");
        return;
    }

    const headers = ['Name', 'Quantity', 'Set Name', 'Set Code', 'Condition', 'Language', 'Foil', 'Altered', 'Signed', 'Purchase Price', 'Market Price (USD)'];
    const rows = collection.map(card => [
        `"${card.name}"`,
        card.quantity || 1,
        `"${card.set_name}"`,
        card.set,
        card.condition || 'N/A',
        card.language || 'N/A',
        card.is_foil || false,
        card.is_altered || false,
        card.is_signed || false,
        card.purchasePrice || '',
        card.prices?.usd || ''
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
        + headers.join(',') + '\n' 
        + rows.map(e => e.join(',')).join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "hatakesocial_collection.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}