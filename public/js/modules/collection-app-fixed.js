/**
 * collection-app-fixed.js
 * Enhanced collection app with improved CSV import functionality for ManaBox files.
 * Fixes issues with file handling, error reporting, and user feedback.
 */
import * as Collection from './collection.js';
import * as API from './api.js';
import * as CSV from './csv-fixed.js';
import * as Currency from './currency.js';
import { getCardImageUrl } from './utils.js';

let currentUser = null;
let csvFile = null;
let csvImportResults = [];

// Enhanced UI helper functions
const UI = {
    openModal: (modal) => { 
        if (modal) { 
            modal.classList.remove('hidden'); 
            modal.classList.add('flex', 'items-center', 'justify-center'); 
        }
    },
    closeModal: (modal) => { 
        if (modal) { 
            modal.classList.add('hidden'); 
            modal.classList.remove('flex', 'items-center', 'justify-center'); 
        }
    },
    showToast: (message, type = 'info', duration = 5000) => {
        const container = document.getElementById('toast-container');
        if (!container) {
            console.log(`Toast: ${message} (${type})`);
            return;
        }
        const toast = document.createElement('div');
        const colors = { success: 'bg-green-600', error: 'bg-red-600', info: 'bg-blue-600', warning: 'bg-yellow-600' };
        toast.className = `p-4 rounded-lg text-white shadow-lg mb-2 ${colors[type] || 'bg-gray-700'} transition-all duration-300 transform translate-y-4 opacity-0`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => toast.classList.remove('translate-y-4', 'opacity-0'), 10);
        setTimeout(() => { 
            toast.classList.add('opacity-0'); 
            toast.addEventListener('transitionend', () => toast.remove()); 
        }, duration);
    },
    setButtonLoading: (button, isLoading, originalText = 'Submit') => {
        if (!button) return;
        if (isLoading) {
            button.dataset.originalText = button.innerHTML;
            button.disabled = true;
            button.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i> Processing...`;
        } else {
            button.disabled = false;
            button.innerHTML = button.dataset.originalText || originalText;
        }
    },
    updateProgress: (progressBar, progressText, progressPercentage, current, total, message = '') => {
        if (progressBar && progressText && progressPercentage) {
            const percent = Math.round((current / total) * 100);
            progressBar.style.width = `${percent}%`;
            progressText.textContent = message || `Processing ${current} of ${total}...`;
            progressPercentage.textContent = `${percent}%`;
        }
    }
};

// Enhanced CSV file selection handler
async function handleCSVFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    const statusDiv = document.getElementById('csv-import-status');
    const parseBtn = document.getElementById('start-csv-import-btn');
    const previewDiv = document.getElementById('csv-preview');
    const previewTable = document.getElementById('csv-preview-table');
    const previewCount = document.getElementById('csv-preview-count');
    
    if (!statusDiv || !parseBtn) {
        console.error('Required CSV UI elements not found');
        return;
    }
    
    try {
        statusDiv.textContent = 'Validating CSV file...';
        statusDiv.className = 'text-sm text-center p-2 rounded-md bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
        
        // First validate the CSV format
        const validation = await CSV.validateCsvFormat(file);
        
        if (!validation.valid) {
            throw new Error('Invalid CSV format');
        }
        
        statusDiv.textContent = 'Parsing CSV file...';
        
        // Parse the CSV file
        const parsedData = await CSV.parseCSV(file);
        
        if (parsedData.length === 0) {
            throw new Error('No valid cards found in CSV file');
        }
        
        // Update status
        statusDiv.textContent = `Found ${parsedData.length} cards in CSV file`;
        statusDiv.className = 'text-sm text-center p-2 rounded-md bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
        
        // Show preview
        if (previewDiv && previewTable && previewCount) {
            previewCount.textContent = parsedData.length;
            
            // Create preview table
            const previewHtml = `
                <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                    <thead class="bg-gray-50 dark:bg-gray-700">
                        <tr>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Name</th>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Set</th>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Qty</th>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Condition</th>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Foil</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-600">
                        ${parsedData.slice(0, 10).map(card => `
                            <tr>
                                <td class="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">${card.name}</td>
                                <td class="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">${card.set_name || card.set || 'Unknown'}</td>
                                <td class="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">${card.quantity}</td>
                                <td class="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">${card.condition}</td>
                                <td class="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">${card.is_foil ? 'Yes' : 'No'}</td>
                            </tr>
                        `).join('')}
                        ${parsedData.length > 10 ? `
                            <tr>
                                <td colspan="5" class="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 text-center italic">
                                    ... and ${parsedData.length - 10} more cards
                                </td>
                            </tr>
                        ` : ''}
                    </tbody>
                </table>
            `;
            
            previewTable.innerHTML = previewHtml;
            previewDiv.classList.remove('hidden');
        }
        
        // Enable the parse button
        parseBtn.disabled = false;
        parseBtn.textContent = `Import ${parsedData.length} Cards`;
        
        // Store the file for later processing
        csvFile = file;
        
    } catch (error) {
        console.error('CSV parsing error:', error);
        statusDiv.textContent = `Error: ${error.message}`;
        statusDiv.className = 'text-sm text-center p-2 rounded-md bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
        parseBtn.disabled = true;
        parseBtn.textContent = 'Parse CSV';
        
        // Hide preview on error
        if (previewDiv) {
            previewDiv.classList.add('hidden');
        }
        
        UI.showToast(`CSV Error: ${error.message}`, 'error');
    }
}

// Enhanced CSV upload handler
async function handleCSVUpload() {
    if (!csvFile) {
        UI.showToast('Please select a CSV file first', 'error');
        return;
    }

    const parseBtn = document.getElementById('start-csv-import-btn');
    const statusDiv = document.getElementById('csv-import-status');
    const gameSelector = document.getElementById('csv-game-selector');

    if (!gameSelector) {
        UI.showToast('Game selector not found', 'error');
        return;
    }

    try {
        UI.setButtonLoading(parseBtn, true, 'Processing...');
        statusDiv.textContent = 'Starting import process...';
        statusDiv.className = 'text-sm text-center p-2 rounded-md bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';

        // Get the selected game
        const selectedGame = gameSelector.value;
        console.log('Selected game for import:', selectedGame);

        // Parse CSV again to get fresh data
        const parsedData = await CSV.parseCSV(csvFile);

        // Close the import modal and open review modal
        const importModal = document.getElementById('csv-import-modal');
        const reviewModal = document.getElementById('csv-review-modal');

        UI.closeModal(importModal);
        UI.openModal(reviewModal);

        // Start the review process
        await openCsvReviewModal(parsedData, selectedGame);

    } catch (error) {
        console.error('CSV import error:', error);
        UI.showToast(`Import failed: ${error.message}`, 'error');
        statusDiv.textContent = `Error: ${error.message}`;
        statusDiv.className = 'text-sm text-center p-2 rounded-md bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    } finally {
        UI.setButtonLoading(parseBtn, false, 'Import Cards');
    }
}

// Enhanced CSV review modal
async function openCsvReviewModal(cards, game) {
    const modal = document.getElementById('csv-review-modal');
    const tableBody = document.getElementById('csv-review-table-body');
    
    if (!modal || !tableBody) {
        console.error('CSV review modal or table body not found');
        UI.showToast('Review modal not found', 'error');
        return;
    }

    // Clear existing content
    tableBody.innerHTML = '';
    csvImportResults = [];

    // Add loading rows for each card
    cards.forEach((card, index) => {
        const row = document.createElement('tr');
        row.dataset.index = index;
        row.innerHTML = `
            <td class="p-3 text-sm text-gray-900 dark:text-gray-100">${card.name}</td>
            <td class="p-3 text-sm text-gray-500 dark:text-gray-400">${card.set_name || card.set || 'Any'}</td>
            <td class="p-3 text-sm text-gray-500 dark:text-gray-400">${card.collector_number || 'N/A'}</td>
            <td class="p-3 text-sm text-gray-500 dark:text-gray-400">${card.quantity}</td>
            <td class="p-3 text-sm text-gray-500 dark:text-gray-400">${card.condition}</td>
            <td class="p-3 text-sm text-gray-500 dark:text-gray-400">${card.language}</td>
            <td class="p-3 text-sm text-gray-500 dark:text-gray-400">${card.is_foil ? 'Yes' : 'No'}</td>
            <td class="p-3 status-cell">
                <i class="fas fa-spinner fa-spin text-blue-500"></i>
                <span class="ml-2 text-blue-600 dark:text-blue-400">Searching...</span>
            </td>
            <td class="p-3">
                <button class="text-red-500 hover:text-red-700 remove-row-btn" data-index="${index}" title="Remove this card">
                    <i class="fas fa-times-circle"></i>
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });

    // Process cards using the enhanced CSV module
    const updateCallback = (index, status, message) => {
        const row = tableBody.querySelector(`tr[data-index="${index}"]`);
        if (!row) return;
        
        const statusCell = row.querySelector('.status-cell');
        if (!statusCell) return;
        
        switch (status) {
            case 'processing':
                statusCell.innerHTML = `<i class="fas fa-spinner fa-spin text-blue-500"></i><span class="ml-2 text-blue-600 dark:text-blue-400">${message}</span>`;
                break;
            case 'success':
                statusCell.innerHTML = `<i class="fas fa-check-circle text-green-500"></i><span class="ml-2 text-green-600 dark:text-green-400">Found</span>`;
                break;
            case 'error':
                statusCell.innerHTML = `<i class="fas fa-exclamation-triangle text-red-500"></i><span class="ml-2 text-red-600 dark:text-red-400">${message}</span>`;
                break;
        }
    };

    try {
        csvImportResults = await CSV.processCSVImport(cards, updateCallback, game);
        
        // Update the finalize button
        const finalizeBtn = document.getElementById('finalize-csv-import-btn');
        if (finalizeBtn) {
            const successCount = csvImportResults.filter(r => r.status === 'success').length;
            const failedCount = csvImportResults.filter(r => r.status === 'error').length;
            
            finalizeBtn.onclick = () => finalizeCsvImport(csvImportResults);
            finalizeBtn.textContent = `Import ${successCount} Cards`;
            
            if (failedCount > 0) {
                UI.showToast(`Found ${successCount} cards, ${failedCount} failed to match`, 'warning');
            } else {
                UI.showToast(`All ${successCount} cards matched successfully!`, 'success');
            }
        }
        
    } catch (error) {
        console.error('Error processing CSV import:', error);
        UI.showToast(`Processing failed: ${error.message}`, 'error');
    }

    // Set up remove buttons
    tableBody.addEventListener('click', (e) => {
        if (e.target.closest('.remove-row-btn')) {
            const index = parseInt(e.target.closest('.remove-row-btn').dataset.index);
            const row = tableBody.querySelector(`tr[data-index="${index}"]`);
            if (row) {
                row.remove();
                // Mark as removed in results
                if (csvImportResults[index]) {
                    csvImportResults[index].status = 'removed';
                }
                
                // Update finalize button
                const finalizeBtn = document.getElementById('finalize-csv-import-btn');
                if (finalizeBtn) {
                    const successCount = csvImportResults.filter(r => r.status === 'success').length;
                    finalizeBtn.textContent = `Import ${successCount} Cards`;
                }
            }
        }
    });
}

// Enhanced finalize import function
async function finalizeCsvImport(results) {
    const finalizeBtn = document.getElementById('finalize-csv-import-btn');
    const progressContainer = document.getElementById('csv-import-progress-container');
    const progressBar = document.getElementById('csv-progress-bar');
    const progressText = document.getElementById('csv-progress-text');
    const progressPercentage = document.getElementById('csv-progress-percentage');
    
    try {
        UI.setButtonLoading(finalizeBtn, true, 'Importing...');
        
        // Show progress container
        if (progressContainer) {
            progressContainer.classList.remove('hidden');
        }
        
        const cardsToImport = results.filter(item => item.status === 'success').map(item => item.card);
        
        if (cardsToImport.length === 0) {
            UI.showToast("No valid cards to import.", "error");
            return;
        }
        
        // Update progress
        UI.updateProgress(progressBar, progressText, progressPercentage, 0, cardsToImport.length, 'Starting import...');
        
        // Import cards in batches to show progress
        const batchSize = 10;
        let imported = 0;
        
        for (let i = 0; i < cardsToImport.length; i += batchSize) {
            const batch = cardsToImport.slice(i, i + batchSize);
            
            UI.updateProgress(progressBar, progressText, progressPercentage, imported, cardsToImport.length, `Importing batch ${Math.floor(i / batchSize) + 1}...`);
            
            await Collection.addMultipleCards(batch);
            imported += batch.length;
            
            UI.updateProgress(progressBar, progressText, progressPercentage, imported, cardsToImport.length);
            
            // Small delay between batches
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        const failedCount = results.filter(item => item.status === 'error').length;
        const successMessage = `Successfully imported ${cardsToImport.length} cards!${failedCount > 0 ? ` ${failedCount} cards failed to match.` : ''}`;
        
        UI.showToast(successMessage, 'success', 8000);
        
        // Close the review modal
        const reviewModal = document.getElementById('csv-review-modal');
        UI.closeModal(reviewModal);
        
        // Clear the CSV file and reset UI
        csvFile = null;
        csvImportResults = [];
        
        // Reset the import modal
        const fileInput = document.getElementById('csv-file-input');
        if (fileInput) fileInput.value = '';
        
        const statusDiv = document.getElementById('csv-import-status');
        if (statusDiv) statusDiv.textContent = '';
        
        const previewDiv = document.getElementById('csv-preview');
        if (previewDiv) previewDiv.classList.add('hidden');
        
        const parseBtn = document.getElementById('start-csv-import-btn');
        if (parseBtn) {
            parseBtn.disabled = true;
            parseBtn.textContent = 'Parse CSV';
        }
        
        // Refresh the collection display if there's a function for it
        if (typeof applyAndRender === 'function') {
            applyAndRender({});
        }
        
    } catch (error) {
        console.error('Error finalizing import:', error);
        UI.showToast(`Import failed: ${error.message}`, 'error');
    } finally {
        UI.setButtonLoading(finalizeBtn, false, 'Finalize Import');
        
        // Hide progress container
        if (progressContainer) {
            progressContainer.classList.add('hidden');
        }
    }
}

// Enhanced modal close functionality
function setupModalHandlers() {
    // CSV Import modal handlers
    const csvImportBtn = document.getElementById('csv-import-btn');
    if (csvImportBtn) {
        csvImportBtn.addEventListener('click', function() {
            console.log('Opening CSV import modal');
            const modal = document.getElementById('csv-import-modal');
            UI.openModal(modal);
        });
    }

    // File input handler
    const csvFileInput = document.getElementById('csv-file-input');
    if (csvFileInput) {
        csvFileInput.addEventListener('change', handleCSVFileSelect);
    }

    // Parse button handler
    const startCsvImportBtn = document.getElementById('start-csv-import-btn');
    if (startCsvImportBtn) {
        startCsvImportBtn.addEventListener('click', handleCSVUpload);
    }

    // Modal close handlers
    document.addEventListener('click', (e) => {
        if (e.target.matches('[data-modal-close]')) {
            const modalId = e.target.getAttribute('data-modal-close');
            const modal = document.getElementById(modalId);
            if (modal) {
                UI.closeModal(modal);
                
                // Special cleanup for CSV modals
                if (modalId === 'csv-import-modal') {
                    const fileInput = document.getElementById('csv-file-input');
                    if (fileInput) fileInput.value = '';
                    const statusDiv = document.getElementById('csv-import-status');
                    if (statusDiv) statusDiv.textContent = '';
                    const previewDiv = document.getElementById('csv-preview');
                    if (previewDiv) previewDiv.classList.add('hidden');
                } else if (modalId === 'csv-review-modal') {
                    const progressContainer = document.getElementById('csv-import-progress-container');
                    if (progressContainer) progressContainer.classList.add('hidden');
                }
            }
        }
    });

    // Escape key handler
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const openModals = document.querySelectorAll('.fixed.flex:not(.hidden)');
            openModals.forEach(modal => {
                if (modal.id && modal.id.includes('modal')) {
                    UI.closeModal(modal);
                }
            });
        }
    });
}

// Initialize the enhanced CSV functionality
export function initializeEnhancedCSV() {
    console.log('Initializing enhanced CSV import functionality');
    setupModalHandlers();
    
    // Add some helpful styles for better UX
    const style = document.createElement('style');
    style.textContent = `
        .csv-preview-table {
            max-height: 300px;
            overflow-y: auto;
        }
        
        .status-cell {
            min-width: 120px;
        }
        
        .remove-row-btn {
            transition: all 0.2s ease;
        }
        
        .remove-row-btn:hover {
            transform: scale(1.1);
        }
        
        .csv-import-progress {
            transition: width 0.3s ease;
        }
    `;
    document.head.appendChild(style);
}

// Export the main functions
export { handleCSVFileSelect, handleCSVUpload, openCsvReviewModal, finalizeCsvImport };
