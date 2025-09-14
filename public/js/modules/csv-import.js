/**
 * Enhanced CSV Import Module
 * Handles CSV file import functionality with better error handling and validation
 */

/**
 * Handle CSV upload with improved error handling and set matching feedback
 */
async function handleCSVUpload() {
    const fileInput = document.getElementById('csv-upload-input');
    const statusElement = document.getElementById('csv-status');
    
    if (!fileInput || !fileInput.files[0]) {
        window.Utils.showNotification('Please select a CSV file', 'error');
        return;
    }
    
    const file = fileInput.files[0];
    
    // Validate file type
    if (!file.name.toLowerCase().endsWith('.csv')) {
        window.Utils.showNotification('Please select a valid CSV file', 'error');
        return;
    }
    
    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
        window.Utils.showNotification('File is too large. Maximum size is 10MB.', 'error');
        return;
    }
    
    statusElement.textContent = 'Reading CSV file...';
    statusElement.className = 'mt-2 text-sm text-blue-600 dark:text-blue-400';
    
    try {
        const csvText = await window.Utils.readFileAsText(file);
        
        // Validate CSV format
        const validation = validateCSVFormat(csvText);
        if (!validation.valid) {
            statusElement.textContent = validation.error;
            statusElement.className = 'mt-2 text-sm text-red-600 dark:text-red-400';
            window.Utils.showNotification(validation.error, 'error');
            return;
        }
        
        statusElement.textContent = 'Parsing CSV data...';
        const cards = parseCSV(csvText);
        
        if (cards.length === 0) {
            statusElement.textContent = 'No valid cards found in CSV file';
            statusElement.className = 'mt-2 text-sm text-yellow-600 dark:text-yellow-400';
            window.Utils.showNotification('No valid cards found in CSV file', 'warning');
            return;
        }
        
        // Create enhanced progress display
        const progressContainer = document.createElement('div');
        progressContainer.className = 'mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg';
        progressContainer.innerHTML = `
            <div class="mb-3">
                <div class="flex justify-between text-sm mb-1">
                    <span>Processing cards with set matching...</span>
                    <span id="progress-text">0/${cards.length}</span>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-2">
                    <div id="progress-bar" class="bg-blue-600 h-2 rounded-full transition-all duration-300" style="width: 0%"></div>
                </div>
            </div>
            <div id="import-summary" class="grid grid-cols-2 gap-4 text-xs mb-3">
                <div class="text-green-600">✅ Perfect matches: <span id="exact-count">0</span></div>
                <div class="text-blue-600">🔍 Set matches: <span id="set-count">0</span></div>
                <div class="text-yellow-600">⚠️ Warnings: <span id="warning-count">0</span></div>
                <div class="text-red-600">❌ Errors: <span id="error-count">0</span></div>
            </div>
            <div id="import-details" class="text-xs space-y-1 max-h-32 overflow-y-auto bg-white dark:bg-gray-800 p-2 rounded border">
                <div class="text-gray-500">Import details will appear here...</div>
            </div>
        `;
        
        statusElement.appendChild(progressContainer);
        
        const progressBar = document.getElementById('progress-bar');
        const progressText = document.getElementById('progress-text');
        const exactCountEl = document.getElementById('exact-count');
        const setCountEl = document.getElementById('set-count');
        const warningCountEl = document.getElementById('warning-count');
        const errorCountEl = document.getElementById('error-count');
        const detailsEl = document.getElementById('import-details');
        
        let exactCount = 0;
        let setCount = 0;
        let warningCount = 0;
        let errorCount = 0;
        const importDetails = [];
        
        // Process cards in smaller batches to avoid rate limiting
        const batchSize = 3;
        for (let i = 0; i < cards.length; i += batchSize) {
            const batch = cards.slice(i, i + batchSize);
            
            await Promise.all(batch.map(async (card, batchIndex) => {
                const cardIndex = i + batchIndex;
                try {
                    const result = await addCardFromCSV(card, cardIndex + 1);
                    
                    // Categorize results based on set matching confidence
                    const confidence = result.cardData.setMatchConfidence;
                    if (confidence === 'exact') {
                        exactCount++;
                        importDetails.push(`✅ ${card.name} - Perfect match from ${result.cardData.set_name}`);
                    } else if (confidence === 'fuzzy_with_set' || confidence === 'search_with_set') {
                        setCount++;
                        importDetails.push(`🔍 ${card.name} - Found in ${result.cardData.set_name} (${confidence})`);
                    } else if (confidence === 'exact_no_set' || confidence === 'fuzzy_no_set') {
                        warningCount++;
                        importDetails.push(`⚠️ ${card.name} - Found but different set: ${result.cardData.set_name} (wanted: ${card.set_name})`);
                    } else {
                        warningCount++;
                        importDetails.push(`⚠️ ${card.name} - Using CSV data only (no API match)`);
                    }
                    
                } catch (error) {
                    errorCount++;
                    importDetails.push(`❌ ${card.name} - Error: ${error.message}`);
                }
                
                // Update progress display
                const processed = cardIndex + 1;
                const percentage = (processed / cards.length) * 100;
                progressBar.style.width = `${percentage}%`;
                progressText.textContent = `${processed}/${cards.length}`;
                exactCountEl.textContent = exactCount;
                setCountEl.textContent = setCount;
                warningCountEl.textContent = warningCount;
                errorCountEl.textContent = errorCount;
                
                // Update details (show last 10 entries)
                const recentDetails = importDetails.slice(-10);
                detailsEl.innerHTML = recentDetails.map(detail => `<div>${detail}</div>`).join('');
                if (importDetails.length > 10) {
                    detailsEl.innerHTML += `<div class="text-gray-500 italic">... and ${importDetails.length - 10} more entries</div>`;
                }
            }));
            
            // Small delay between batches to respect API rate limits
            if (i + batchSize < cards.length) {
                await new Promise(resolve => setTimeout(resolve, 800));
            }
        }
        
        // Final summary
        const totalSuccess = exactCount + setCount + warningCount;
        const finalMessage = `Import complete: ${totalSuccess}/${cards.length} cards imported (${exactCount} perfect, ${setCount} set matches, ${warningCount} warnings, ${errorCount} errors)`;
        
        // Update final status
        statusElement.innerHTML = `
            <div class="text-sm font-medium mb-2">${finalMessage}</div>
            ${progressContainer.outerHTML}
        `;
        
        // Show detailed breakdown
        const finalDetails = document.getElementById('import-details');
        if (finalDetails) {
            finalDetails.innerHTML = `
                <div class="space-y-1">
                    <div class="font-medium text-gray-700 dark:text-gray-300">Import Summary:</div>
                    <div class="text-green-600">✅ ${exactCount} cards with perfect set matches</div>
                    <div class="text-blue-600">🔍 ${setCount} cards found in correct sets</div>
                    <div class="text-yellow-600">⚠️ ${warningCount} cards with set mismatches or API fallbacks</div>
                    <div class="text-red-600">❌ ${errorCount} cards failed to import</div>
                    <details class="mt-2">
                        <summary class="cursor-pointer text-blue-600 hover:text-blue-800">View all import details</summary>
                        <div class="mt-2 space-y-1 max-h-40 overflow-y-auto">
                            ${importDetails.map(detail => `<div class="text-xs">${detail}</div>`).join('')}
                        </div>
                    </details>
                </div>
            `;
        }
        
        // Reload data and update UI
        if (totalSuccess > 0) {
            await window.CollectionApp.loadCollectionData();
            window.CollectionApp.renderCurrentView();
        }
        
        // Clear file input
        fileInput.value = '';
        
        const notificationType = errorCount === 0 ? 'success' : errorCount < cards.length ? 'warning' : 'error';
        window.Utils.showNotification(finalMessage, notificationType);
        
    } catch (error) {
        console.error('Error processing CSV:', error);
        const errorMessage = 'Error processing CSV file: ' + error.message;
        statusElement.textContent = errorMessage;
        statusElement.className = 'mt-2 text-sm text-red-600 dark:text-red-400';
        window.Utils.showNotification(errorMessage, 'error');
    }
}

/**
 * Enhanced CSV parsing with better error handling
 */
function parseCSV(csvText) {
    const lines = csvText.split('\n').map(line => line.trim()).filter(line => line);
    
    if (lines.length < 2) {
        throw new Error('CSV file must have at least a header row and one data row');
    }
    
    const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase().replace(/"/g, ''));
    const cards = [];
    
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;
        
        try {
            const values = parseCSVLine(line);
            const card = {};
            
            headers.forEach((header, index) => {
                if (values[index] !== undefined) {
                    card[header] = values[index].trim().replace(/"/g, '');
                }
            });
            
            // Skip if no card name
            const cardName = getCardName(card);
            if (!cardName) continue;
            
            // Normalize card data
            const normalizedCard = normalizeCardData(card);
            
            if (normalizedCard.name) {
                normalizedCard.csvRowNumber = i + 1; // For error reporting
                cards.push(normalizedCard);
            }
        } catch (error) {
            console.warn(`Error parsing line ${i + 1}:`, error);
            // Continue processing other lines
        }
    }
    
    return cards;
}

/**
 * Enhanced CSV line parsing with better quote handling
 */
function parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;
    let i = 0;
    
    while (i < line.length) {
        const char = line[i];
        const nextChar = line[i + 1];
        
        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                // Escaped quote
                current += '"';
                i += 2;
            } else {
                // Toggle quote state
                inQuotes = !inQuotes;
                i++;
            }
        } else if (char === ',' && !inQuotes) {
            values.push(current);
            current = '';
            i++;
        } else {
            current += char;
            i++;
        }
    }
    
    values.push(current);
    return values;
}

/**
 * Get card name from various possible column names
 */
function getCardName(card) {
    const nameFields = [
        'name', 'card name', 'cardname', 'card_name', 'title',
        'card title', 'cardtitle', 'card_title'
    ];
    
    for (const field of nameFields) {
        if (card[field] && card[field].trim()) {
            return card[field].trim();
        }
    }
    
    return null;
}

/**
 * Enhanced card data normalization
 */
function normalizeCardData(card) {
    // Handle different possible column names
    const name = getCardName(card);
    const setName = card.set || card['set name'] || card.setname || card['set_name'] || 
                   card.expansion || card['expansion name'] || card.edition || '';
    
    const quantity = Math.max(1, parseInt(card.quantity || card.count || card.qty || card.amount || 1) || 1);
    
    const condition = (card.condition || card.cond || card.state || 'Near Mint').trim();
    const language = (card.language || card.lang || card.locale || 'en').trim();
    
    const foilText = (card.foil || card.finish || card.treatment || card.premium || '').toLowerCase();
    const isFoil = foilText.includes('foil') || foilText.includes('premium') || 
                   foilText.includes('holo') || foilText === 'yes' || foilText === 'true';
    
    const price = parseFloat(card.price || card['purchase price'] || card.cost || 
                           card['market price'] || card.value || 0) || null;
    
    const notes = (card.notes || card.comment || card.description || card.memo || '').trim();
    
    // Determine TCG
    let tcg = card.tcg || card.game || card.type || 'Magic: The Gathering';
    if (tcg.toLowerCase().includes('pokemon') || tcg.toLowerCase().includes('ptcg')) {
        tcg = 'Pokemon';
    } else if (tcg.toLowerCase().includes('magic') || tcg.toLowerCase().includes('mtg')) {
        tcg = 'Magic: The Gathering';
    }
    
    return {
        name: name,
        set_name: setName,
        quantity: quantity,
        condition: condition,
        language: language,
        isFoil: isFoil,
        purchasePrice: price,
        notes: notes,
        tcg: tcg,
        productType: 'single',
        dateAdded: firebase.firestore.FieldValue.serverTimestamp(),
        importSource: 'csv'
    };
}

/**
 * Enhanced card addition with better set matching
 */
async function addCardFromCSV(cardData, rowNumber) {
    try {
        const currentUser = window.CollectionApp.getCurrentUser();
        if (!currentUser) {
            throw new Error('User not authenticated');
        }
        
        // Try to get full card data from API with better set matching
        let fullCardData = { ...cardData };
        
        if (cardData.name) {
            try {
                let apiData = null;
                
                if (cardData.tcg === 'Magic: The Gathering') {
                    // Enhanced Magic card search with better set matching
                    apiData = await findMagicCardWithSet(cardData.name, cardData.set_name);
                    
                } else if (cardData.tcg === 'Pokemon') {
                    // Enhanced Pokemon card search
                    apiData = await findPokemonCardWithSet(cardData.name, cardData.set_name);
                }
                
                if (apiData) {
                    // Merge API data with CSV data, preserving user-specific fields
                    fullCardData = {
                        ...apiData,
                        // Preserve user-specific data from CSV
                        quantity: cardData.quantity,
                        condition: cardData.condition,
                        language: cardData.language,
                        isFoil: cardData.isFoil,
                        purchasePrice: cardData.purchasePrice,
                        notes: cardData.notes,
                        dateAdded: cardData.dateAdded,
                        importSource: cardData.importSource,
                        // Add verification info
                        csvSetName: cardData.set_name,
                        setMatchConfidence: apiData.setMatchConfidence || 'unknown'
                    };
                    
                    console.log(`✅ Found ${cardData.name} from ${apiData.set_name || 'Unknown Set'} (confidence: ${apiData.setMatchConfidence || 'unknown'})`);
                } else {
                    console.warn(`⚠️ Could not find API data for "${cardData.name}" from set "${cardData.set_name}", using CSV data only`);
                }
                
            } catch (apiError) {
                console.warn(`❌ API error for "${cardData.name}":`, apiError.message);
                // Continue with CSV data only
            }
        }
        
        // Save to Firebase
        const collectionRef = db.collection('users').doc(currentUser.uid).collection('collection');
        await collectionRef.add(fullCardData);
        
        return { success: true, cardData: fullCardData };
        
    } catch (error) {
        console.error(`Error adding card from CSV row ${rowNumber}:`, error);
        throw new Error(`Failed to add card: ${error.message}`);
    }
}

/**
 * Enhanced Magic card search with better set matching
 */
async function findMagicCardWithSet(cardName, setName) {
    try {
        // First, try exact name and set match
        if (setName && setName.trim()) {
            try {
                const exactResponse = await window.Utils.makeApiCall(
                    `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardName)}&set=${encodeURIComponent(setName)}`
                );
                if (exactResponse) {
                    return { ...exactResponse, setMatchConfidence: 'exact' };
                }
            } catch (exactError) {
                console.log(`Exact match failed for ${cardName} in ${setName}, trying fuzzy search...`);
            }
            
            // Try fuzzy name with exact set
            try {
                const fuzzyResponse = await window.Utils.makeApiCall(
                    `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(cardName)}&set=${encodeURIComponent(setName)}`
                );
                if (fuzzyResponse) {
                    return { ...fuzzyResponse, setMatchConfidence: 'fuzzy_with_set' };
                }
            } catch (fuzzyError) {
                console.log(`Fuzzy match with set failed for ${cardName} in ${setName}, trying search...`);
            }
            
            // Try search with set filter
            try {
                const searchResponse = await window.Utils.makeApiCall(
                    `https://api.scryfall.com/cards/search?q=${encodeURIComponent(`"${cardName}" set:"${setName}"`)}&order=released&dir=desc`
                );
                if (searchResponse && searchResponse.data && searchResponse.data.length > 0) {
                    return { ...searchResponse.data[0], setMatchConfidence: 'search_with_set' };
                }
            } catch (searchError) {
                console.log(`Search with set failed for ${cardName} in ${setName}, trying without set...`);
            }
        }
        
        // If set matching fails, try without set but prefer newer printings
        try {
            const exactResponse = await window.Utils.makeApiCall(
                `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardName)}`
            );
            if (exactResponse) {
                return { ...exactResponse, setMatchConfidence: 'exact_no_set' };
            }
        } catch (exactError) {
            // Try fuzzy search as last resort
            const fuzzyResponse = await window.Utils.makeApiCall(
                `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(cardName)}`
            );
            if (fuzzyResponse) {
                return { ...fuzzyResponse, setMatchConfidence: 'fuzzy_no_set' };
            }
        }
        
        return null;
        
    } catch (error) {
        console.error(`Error finding Magic card ${cardName}:`, error);
        return null;
    }
}

/**
 * Enhanced Pokemon card search with better set matching
 */
async function findPokemonCardWithSet(cardName, setName) {
    try {
        let searchQuery = `name:"${encodeURIComponent(cardName)}"`;
        
        // Add set filter if provided
        if (setName && setName.trim()) {
            searchQuery += ` set.name:"${encodeURIComponent(setName)}"`;
        }
        
        const response = await window.Utils.makeApiCall(
            `https://api.pokemontcg.io/v2/cards?q=${searchQuery}&pageSize=1&orderBy=-set.releaseDate`,
            {
                headers: {
                    'X-Api-Key': '60a08d4a-3a34-43d8-8f41-827b58cfac6d'
                }
            }
        );
        
        if (response.data && response.data.length > 0) {
            const card = response.data[0];
            return { 
                ...card, 
                setMatchConfidence: setName ? 'with_set' : 'no_set' 
            };
        }
        
        // If no exact match, try without set filter
        if (setName) {
            const fallbackResponse = await window.Utils.makeApiCall(
                `https://api.pokemontcg.io/v2/cards?q=name:"${encodeURIComponent(cardName)}"&pageSize=1&orderBy=-set.releaseDate`,
                {
                    headers: {
                        'X-Api-Key': '60a08d4a-3a34-43d8-8f41-827b58cfac6d'
                    }
                }
            );
            
            if (fallbackResponse.data && fallbackResponse.data.length > 0) {
                return { 
                    ...fallbackResponse.data[0], 
                    setMatchConfidence: 'fallback_no_set' 
                };
            }
        }
        
        return null;
        
    } catch (error) {
        console.error(`Error finding Pokemon card ${cardName}:`, error);
        return null;
    }
}

/**
 * Enhanced CSV format validation
 */
function validateCSVFormat(csvText) {
    if (!csvText || csvText.trim().length === 0) {
        return { valid: false, error: 'CSV file is empty' };
    }
    
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
        return { valid: false, error: 'CSV file must have at least a header row and one data row' };
    }
    
    const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
    
    // Check for required name column
    const nameColumns = ['name', 'card name', 'cardname', 'card_name', 'title'];
    const hasNameColumn = nameColumns.some(col => headers.includes(col));
    
    if (!hasNameColumn) {
        return { 
            valid: false, 
            error: `CSV file must have a column for card names. Expected one of: ${nameColumns.join(', ')}` 
        };
    }
    
    // Check for reasonable number of columns
    if (headers.length > 50) {
        return {
            valid: false,
            error: 'CSV file has too many columns (maximum 50 allowed)'
        };
    }
    
    // Check for reasonable number of rows
    if (lines.length > 10000) {
        return {
            valid: false,
            error: 'CSV file has too many rows (maximum 10,000 allowed)'
        };
    }
    
    return { valid: true };
}

/**
 * Export collection as CSV with enhanced formatting
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
    
    // Define comprehensive CSV headers
    const headers = [
        'Name',
        'Set',
        'Quantity',
        'Condition',
        'Language',
        'Foil',
        'Purchase Price',
        'Market Price',
        'Notes',
        'TCG',
        'Rarity',
        'Mana Cost',
        'Type',
        'Date Added'
    ];
    
    // Create CSV content with proper escaping
    let csvContent = headers.map(h => `"${h}"`).join(',') + '\n';
    
    data.forEach(item => {
        const row = [
            escapeCSVField(item.name || ''),
            escapeCSVField(item.set_name || item.setName || ''),
            item.quantity || 1,
            escapeCSVField(item.condition || 'Near Mint'),
            escapeCSVField(item.language || 'en'),
            item.isFoil ? 'Yes' : 'No',
            item.purchasePrice || '',
            item.prices?.usd || item.price || '',
            escapeCSVField(item.notes || ''),
            escapeCSVField(item.tcg || 'Magic: The Gathering'),
            escapeCSVField(item.rarity || ''),
            escapeCSVField(item.mana_cost || ''),
            escapeCSVField(item.type_line || ''),
            item.dateAdded ? window.Utils.formatDate(item.dateAdded) : ''
        ];
        csvContent += row.join(',') + '\n';
    });
    
    // Download CSV file
    const filename = `${currentTab}_export_${new Date().toISOString().split('T')[0]}.csv`;
    window.Utils.downloadFile(csvContent, filename, 'text/csv');
    
    window.Utils.showNotification(`CSV export completed: ${data.length} items exported`, 'success');
}

/**
 * Properly escape CSV fields
 */
function escapeCSVField(value) {
    if (value === null || value === undefined) return '""';
    
    const stringValue = String(value);
    
    // If the value contains quotes, commas, or newlines, wrap in quotes and escape internal quotes
    if (stringValue.includes('"') || stringValue.includes(',') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
    }
    
    return `"${stringValue}"`;
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
    
    // File input change handler for validation
    const fileInput = document.getElementById('csv-upload-input');
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const statusElement = document.getElementById('csv-status');
            if (statusElement && e.target.files[0]) {
                statusElement.textContent = `Selected: ${e.target.files[0].name}`;
                statusElement.className = 'mt-2 text-sm text-gray-600 dark:text-gray-400';
            }
        });
    }
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

