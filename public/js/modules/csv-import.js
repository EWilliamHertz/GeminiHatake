window.CSVImport = (() => {

    function initialize() {
        document.getElementById('csv-upload-btn')?.addEventListener('click', handleCSVUpload);
        document.getElementById('export-collection-btn')?.addEventListener('click', () => {
            const data = window.CollectionApp.getFullCollection();
            exportCollectionAsCSV(data, 'collection');
        });
    }

    async function handleCSVUpload() {
        const fileInput = document.getElementById('csv-upload-input');
        const statusElement = document.getElementById('csv-status');
        
        const user = window.CollectionApp.getCurrentUser();
        if (!user) {
            window.Utils.showNotification("You must be logged in to import a CSV.", "error");
            return;
        }
        
        if (!fileInput || !fileInput.files[0]) {
            window.Utils.showNotification('Please select a CSV file', 'error');
            return;
        }
        
        const file = fileInput.files[0];
        
        if (!file.name.toLowerCase().endsWith('.csv')) {
            window.Utils.showNotification('Please select a valid CSV file', 'error');
            return;
        }
        
        statusElement.innerHTML = '<p class="text-blue-600 dark:text-blue-400">Reading CSV file...</p>';
        
        try {
            const csvText = await window.Utils.readFileAsText(file);
            const validation = validateCSVFormat(csvText);
            if (!validation.valid) {
                statusElement.innerHTML = `<p class="text-red-600 dark:text-red-400">${validation.error}</p>`;
                return;
            }
            
            const cards = parseCSV(csvText);
            if (cards.length === 0) {
                statusElement.innerHTML = '<p class="text-yellow-600 dark:text-yellow-400">No valid cards found in CSV.</p>';
                return;
            }
            
            statusElement.innerHTML = `<p class="text-blue-600 dark:text-blue-400">Importing ${cards.length} cards... This may take a moment.</p>`;

            let successCount = 0;
            let errorCount = 0;

            const chunks = [];
            for (let i = 0; i < cards.length; i += 5) { // Process in small chunks
                chunks.push(cards.slice(i, i + 5));
            }

            for (const chunk of chunks) {
                await Promise.all(chunk.map(async (card) => {
                    try {
                        await addCardFromCSV(card);
                        successCount++;
                    } catch (error) {
                        console.error("Failed to import card:", card.name, error);
                        errorCount++;
                    }
                }));
                await new Promise(res => setTimeout(res, 1000)); // Delay between chunks
            }

            const finalMessage = `Import complete! ${successCount} cards added, ${errorCount} failed.`;
            statusElement.innerHTML = `<p class="text-green-600 dark:text-green-400">${finalMessage}</p>`;
            window.Utils.showNotification(finalMessage, 'success');
            
            if (successCount > 0) {
                window.CollectionApp.loadAllData();
            }
            fileInput.value = '';

        } catch (error) {
            console.error('Error processing CSV:', error);
            const errorMessage = 'Error processing CSV file: ' + error.message;
            statusElement.innerHTML = `<p class="text-red-600 dark:text-red-400">${errorMessage}</p>`;
        }
    }

    function parseCSV(csvText) {
        const lines = csvText.split('\n').map(line => line.trim()).filter(line => line);
        if (lines.length < 2) throw new Error('CSV must have a header and at least one data row.');
        const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase().replace(/"/g, ''));
        const cards = [];
        for (let i = 1; i < lines.length; i++) {
            if (!lines[i]) continue;
            try {
                const values = parseCSVLine(lines[i]);
                let card = {};
                headers.forEach((header, index) => {
                    if (values[index] !== undefined) card[header] = values[index].trim().replace(/"/g, '');
                });
                const normalizedCard = normalizeCardData(card);
                if (normalizedCard.name) cards.push(normalizedCard);
            } catch (error) {
                console.warn(`Error parsing CSV line ${i + 1}:`, error);
            }
        }
        return cards;
    }
    
    function parseCSVLine(line) {
        const values = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];
            if (char === '"') {
                if (inQuotes && nextChar === '"') { current += '"'; i++; } 
                else { inQuotes = !inQuotes; }
            } else if (char === ',' && !inQuotes) {
                values.push(current); current = '';
            } else {
                current += char;
            }
        }
        values.push(current);
        return values;
    }
    
    function getCardName(card) {
        const nameFields = ['name', 'card name', 'cardname', 'card_name', 'title'];
        for (const field of nameFields) {
            if (card[field] && card[field].trim()) return card[field].trim();
        }
        return null;
    }

    function normalizeCardData(card) {
        const name = getCardName(card);
        const setName = card.set || card['set name'] || card.setname || card.expansion || '';
        const quantity = Math.max(1, parseInt(card.quantity || card.count || card.qty || 1) || 1);
        const condition = (card.condition || 'Near Mint').trim();
        const language = (card.language || 'en').trim();
        const foilText = (card.foil || card.finish || '').toLowerCase();
        const isFoil = foilText.includes('foil') || foilText.includes('yes');
        const purchasePrice = parseFloat(card.price || card['purchase price'] || 0) || null;
        const notes = (card.notes || '').trim();
        return { name, set_name: setName, quantity, condition, language, isFoil, purchasePrice, notes };
    }

    async function addCardFromCSV(cardData) {
        const user = window.CollectionApp.getCurrentUser();
        const db = window.CollectionApp.getDb();
        if (!user) throw new Error('User not authenticated');
        
        let fullCardData = {
            ...cardData,
            dateAdded: firebase.firestore.FieldValue.serverTimestamp(),
            productType: 'single',
        };

        try {
            const apiResults = await window.Api.searchMagicCards(cardData.name);
            if (apiResults && apiResults.length > 0) {
                const bestMatch = apiResults.find(c => c.setName.toLowerCase().includes(cardData.set_name.toLowerCase())) || apiResults[0];
                fullCardData = { ...bestMatch, ...fullCardData };
            }
        } catch (apiError) {
            console.warn(`API lookup failed for ${cardData.name}, using CSV data only.`);
        }
        
        await db.collection('users').doc(user.uid).collection('collection').add(fullCardData);
    }

    function validateCSVFormat(csvText) {
        if (!csvText || csvText.trim().length === 0) return { valid: false, error: 'CSV file is empty' };
        const lines = csvText.split('\n').filter(line => line.trim());
        if (lines.length < 2) return { valid: false, error: 'CSV needs a header and at least one data row' };
        const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
        const hasNameColumn = ['name', 'card name', 'cardname'].some(col => headers.includes(col));
        if (!hasNameColumn) return { valid: false, error: `CSV must have a 'name' or 'card name' column` };
        return { valid: true };
    }

    function exportCollectionAsCSV(data, listName) {
        if (data.length === 0) {
            window.Utils.showNotification('No items to export.', 'info');
            return;
        }
        const headers = ['Name', 'Set', 'Quantity', 'Condition', 'Foil', 'Market Price', 'Notes'];
        let csvContent = headers.join(',') + '\n';
        data.forEach(item => {
            const row = [
                `"${(item.name || '').replace(/"/g, '""')}"`,
                `"${(item.setName || item.set_name || '').replace(/"/g, '""')}"`,
                item.quantity || 1,
                `"${item.condition || ''}"`,
                item.isFoil ? 'Yes' : 'No',
                item.priceUsd || 0,
                `"${(item.notes || '').replace(/"/g, '""')}"`
            ];
            csvContent += row.join(',') + '\n';
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `${listName}_export.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    return { initialize };
})();

