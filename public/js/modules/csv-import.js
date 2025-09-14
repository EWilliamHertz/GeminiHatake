/**
 * CSV Import Module
 * Handles CSV file import functionality for bulk card adding
 */

/**
 * Handle CSV upload
 */
async function handleCSVUpload() {
    const fileInput = document.getElementById('csv-upload-input');
    const statusElement = document.getElementById('csv-status');
    
    if (!fileInput || !fileInput.files[0]) {
        window.Utils.showNotification('Please select a CSV file', 'error');
        return;
    }
    
    const file = fileInput.files[0];
    statusElement.textContent = 'Processing CSV...';
    
    try {
        const csvText = await window.Utils.readFileAsText(file);
        const cards = parseCSV(csvText);
        
        if (cards.length === 0) {
            statusElement.textContent = 'No valid cards found in CSV';
            return;
        }
        
        statusElement.textContent = `Processing ${cards.length} cards...`;
        
        let successCount = 0;
        let errorCount = 0;
        
        for (const card of cards) {
            try {
                await addCardFromCSV(card);
                successCount++;
                
                // Update status every 10 cards
                if (successCount % 10 === 0) {
                    statusElement.textContent = `Processed ${successCount}/${cards.length} cards...`;
                }
            } catch (error) {
                console.error('Error adding card from CSV:', error);
                errorCount++;
            }
        }
        
        statusElement.textContent = `Import complete: ${successCount} added, ${errorCount} errors`;
        
        // Reload data
        await window.CollectionApp.loadCollectionData();
        
        // Clear file input
        fileInput.value = '';
        
        window.Utils.showNotification(`CSV import complete: ${successCount} cards added`, 'success');
        
    } catch (error) {
        console.error('Error processing CSV:', error);
        statusElement.textContent = 'Error processing CSV file';
        window.Utils.showNotification('Error processing CSV file', 'error');
    }
}

/**
 * Parse CSV content
 */
function parseCSV(csvText) {
    const lines = csvText.split('\n');
    if (lines.length < 2) {
        throw new Error('CSV file must have at least a header row and one data row');
    }
    
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
    const cards = [];
    
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // Handle CSV parsing with quoted values
        const values = parseCSVLine(line);
        const card = {};
        
        headers.forEach((header, index) => {
            if (values[index]) {
                card[header] = values[index].trim().replace(/"/g, '');
            }
        });
        
        // Skip if no card name
        if (!card.name && !card['card name'] && !card.cardname) continue;
        
        // Normalize card data
        const normalizedCard = normalizeCardData(card);
        
        if (normalizedCard.name) {
            cards.push(normalizedCard);
        }
    }
    
    return cards;
}

/**
 * Parse a single CSV line handling quoted values
 */
function parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            values.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    
    values.push(current);
    return values;
}

/**
 * Normalize card data from CSV
 */
function normalizeCardData(card) {
    // Handle different possible column names
    const name = card.name || card['card name'] || card.cardname || card['card_name'];
    const setName = card.set || card['set name'] || card.setname || card['set_name'] || card.expansion;
    const quantity = parseInt(card.quantity || card.count || card.qty || 1);
    const condition = card.condition || card.cond || 'Near Mint';
    const language = card.language || card.lang || 'en';
    const foil = (card.foil || card.finish || card.treatment || '').toLowerCase();
    const price = parseFloat(card.price || card['purchase price'] || card.cost || 0) || null;
    const notes = card.notes || card.comment || card.description || '';
    
    return {
        name: name,
        set_name: setName,
        quantity: quantity,
        condition: condition,
        language: language,
        isFoil: foil.includes('foil') || foil.includes('premium'),
        purchasePrice: price,
        notes: notes,
        tcg: 'Magic: The Gathering', // Default to MTG for CSV imports
        productType: 'single',
        dateAdded: firebase.firestore.FieldValue.serverTimestamp()
    };
}

/**
 * Add card from CSV data
 */
async function addCardFromCSV(cardData) {
    try {
        const currentUser = window.CollectionApp.getCurrentUser();
        
        // Try to get full card data from Scryfall
        let fullCardData = cardData;
        
        if (cardData.name) {
            try {
                const searchQuery = cardData.set_name ? 
                    `${cardData.name} set:${cardData.set_name}` : 
                    cardData.name;
                
                const response = await window.Utils.makeApiCall(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(searchQuery)}`);
                fullCardData = { ...response, ...cardData }; // Merge with CSV data, CSV data takes precedence
            } catch (error) {
                console.warn('Could not find card on Scryfall, using CSV data only:', cardData.name);
            }
        }
        
        // Save to Firebase
        const collectionRef = db.collection('users').doc(currentUser.uid).collection('collection');
        await collectionRef.add(fullCardData);
        
    } catch (error) {
        console.error('Error adding card from CSV:', error);
        throw error;
    }
}

/**
 * Export collection as CSV
 */
function exportCollectionAsCSV() {
    const currentTab = window.CollectionApp.getCurrentTab();
    const data = currentTab === 'collection' ? 
        window.CollectionApp.getCollectionData() : 
        window.CollectionApp.getWishlistData();
    
    if (data.length === 0) {
        window.Utils.showNotification('No items to export', 'error');
        return;
    }
    
    // Define CSV headers
    const headers = [
        'Name',
        'Set',
        'Quantity',
        'Condition',
        'Language',
        'Foil',
        'Purchase Price',
        'Notes',
        'TCG',
        'Date Added'
    ];
    
    // Create CSV content
    let csvContent = headers.join(',') + '\n';
    
    data.forEach(item => {
        const row = [
            `"${item.name || ''}"`,
            `"${item.set_name || item.setName || ''}"`,
            item.quantity || 1,
            `"${item.condition || 'Near Mint'}"`,
            `"${item.language || 'en'}"`,
            item.isFoil ? 'Yes' : 'No',
            item.purchasePrice || '',
            `"${item.notes || ''}"`,
            `"${item.tcg || 'Magic: The Gathering'}"`,
            item.dateAdded ? window.Utils.formatDate(item.dateAdded) : ''
        ];
        csvContent += row.join(',') + '\n';
    });
    
    // Download CSV file
    const filename = `${currentTab}_export_${new Date().toISOString().split('T')[0]}.csv`;
    window.Utils.downloadFile(csvContent, filename, 'text/csv');
    
    window.Utils.showNotification('CSV export completed successfully', 'success');
}

/**
 * Initialize CSV import functionality
 */
function initializeCSVImport() {
    // CSV upload
    const csvUploadBtn = document.getElementById('csv-upload-btn');
    if (csvUploadBtn) {
        csvUploadBtn.addEventListener('click', handleCSVUpload);
    }
    
    // Export buttons
    const exportCollectionBtn = document.getElementById('export-collection-btn');
    if (exportCollectionBtn) {
        exportCollectionBtn.addEventListener('click', exportCollectionAsCSV);
    }
    
    const exportWishlistBtn = document.getElementById('export-wishlist-btn');
    if (exportWishlistBtn) {
        exportWishlistBtn.addEventListener('click', exportCollectionAsCSV);
    }
}

/**
 * Validate CSV format
 */
function validateCSVFormat(csvText) {
    const lines = csvText.split('\n');
    if (lines.length < 2) {
        return { valid: false, error: 'CSV file must have at least a header row and one data row' };
    }
    
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const requiredHeaders = ['name', 'card name', 'cardname'];
    
    const hasNameColumn = requiredHeaders.some(header => headers.includes(header));
    if (!hasNameColumn) {
        return { 
            valid: false, 
            error: 'CSV file must have a column for card names (name, card name, or cardname)' 
        };
    }
    
    return { valid: true };
}

// Export functions
window.CSVImport = {
    handleCSVUpload,
    parseCSV,
    normalizeCardData,
    addCardFromCSV,
    exportCollectionAsCSV,
    initializeCSVImport,
    validateCSVFormat
};

