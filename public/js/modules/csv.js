/**
 * csv.js - Handles parsing and processing of CSV files for collection import.
 */
import { searchMagicCards } from './api.js';
import { showNotification } from './utils.js';

function parseCSVLine(line) {
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
    return result.map(field => field.replace(/^"|"$/g, ''));
}

function detectCSVColumns(headers) {
    const headerMap = {};
    headers.forEach((header, index) => {
        const cleanHeader = header.toLowerCase().trim();
        if (cleanHeader.includes('name') || cleanHeader.includes('card')) headerMap.name = index;
        else if (cleanHeader.includes('quantity') || cleanHeader.includes('qty')) headerMap.quantity = index;
        else if (cleanHeader.includes('set') || cleanHeader.includes('expansion')) headerMap.set = index;
        else if (cleanHeader.includes('condition')) headerMap.condition = index;
        else if (cleanHeader.includes('foil')) headerMap.foil = index;
        else if (cleanHeader.includes('price')) headerMap.price = index;
        else if (cleanHeader.includes('number')) headerMap.collectorNumber = index;
    });
    return headerMap;
}

async function processCSVLine(line, columnMap, lineNumber) {
    try {
        const values = parseCSVLine(line);
        const cardName = values[columnMap.name]?.trim();
        if (!cardName) throw new Error('SKIP');

        const setName = columnMap.set !== undefined ? values[columnMap.set]?.trim() : null;
        let scryfallData = null;
        try {
            const results = await searchMagicCards(cardName);
            scryfallData = results.find(c => !setName || c.setName.toLowerCase() === setName.toLowerCase()) || results[0];
        } catch (scryfallError) {
            console.warn(`Scryfall lookup failed for "${cardName}":`, scryfallError.message);
        }
        
        return {
            name: cardName,
            quantity: parseInt(values[columnMap.quantity]) || 1,
            condition: values[columnMap.condition]?.trim() || 'Near Mint',
            isFoil: values[columnMap.foil]?.toLowerCase().includes('foil') || false,
            purchasePrice: parseFloat(values[columnMap.price]) || null,
            ...(scryfallData || { setName: setName || 'Unknown Set' }),
            dateAdded: firebase.firestore.FieldValue.serverTimestamp(),
            importedFromCSV: true,
        };
    } catch (error) {
        if (error.message === 'SKIP') throw error;
        throw new Error(`Failed to process line ${lineNumber}: ${error.message}`);
    }
}

export async function handleCSVUpload(file, db, user, statusEl, onComplete) {
    if (!file || !file.name.toLowerCase().endsWith('.csv')) {
        showNotification('Please select a valid CSV file.', 'error');
        return;
    }

    statusEl.textContent = 'Processing CSV file...';
    statusEl.className = 'text-center text-sm mt-2 text-blue-600 dark:text-blue-400';

    try {
        const text = await file.text();
        const lines = text.split('\n').filter(line => line.trim());
        if (lines.length < 2) throw new Error('CSV file appears to be empty or invalid.');

        const headers = parseCSVLine(lines[0]);
        const columnMap = detectCSVColumns(headers);
        if (columnMap.name === undefined) throw new Error('Could not find a "name" column in CSV.');

        let batch = db.batch();
        let processedCount = 0;
        
        for (let i = 1; i < lines.length; i++) {
            try {
                const cardData = await processCSVLine(lines[i], columnMap, i);
                const docRef = db.collection('users').doc(user.uid).collection('collection').doc();
                batch.set(docRef, cardData);
                processedCount++;
                if (processedCount % 499 === 0) { // Commit every ~500 operations
                    await batch.commit();
                    batch = db.batch();
                }
            } catch (lineError) {
                if (lineError.message !== 'SKIP') console.error(lineError);
            }
        }

        if (processedCount > 0 && processedCount % 499 !== 0) {
            await batch.commit();
        }

        statusEl.textContent = `Import complete! ${processedCount} cards added.`;
        statusEl.className = 'text-center text-sm mt-2 text-green-600 dark:text-green-400';
        showNotification('CSV import completed!', 'success');
        onComplete();

    } catch (error) {
        console.error('Error processing CSV:', error);
        statusEl.textContent = `Error: ${error.message}`;
        statusEl.className = 'text-center text-sm mt-2 text-red-600 dark:text-red-400';
        showNotification('CSV import failed.', 'error');
    }
}