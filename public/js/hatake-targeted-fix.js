/**
 * hatake-targeted-fix.js
 * Targeted fixes for specific issues in the HatakeSocial collection page
 */

document.addEventListener('DOMContentLoaded', function() {
    console.log('HatakeSocial targeted fixes loaded');
    
    // ===== FIX 1: REVERT GRID VIEW TO ORIGINAL STATE =====
    function revertGridView() {
        console.log('Reverting grid view to original state');
        
        // Get the collection display container
        const collectionDisplay = document.getElementById('collection-display');
        if (!collectionDisplay) return;
        
        // Remove any custom styling we added
        collectionDisplay.style = '';
        
        // Make sure it has the right classes for grid view
        if (collectionDisplay.classList.contains('list-view')) {
            collectionDisplay.classList.remove('list-view');
            collectionDisplay.classList.add('grid-view');
        }
        
        // Fix card containers
        const cardContainers = document.querySelectorAll('.card-container');
        cardContainers.forEach(card => {
            // Remove any custom styling we added
            card.style = '';
            
            // Make sure card images are visible
            const cardImage = card.querySelector('img');
            if (cardImage) {
                cardImage.style = '';
            }
        });
    }
    
    // ===== FIX 2: BULK EDIT LIST FOR SALE BUTTON =====
    function fixBulkEditListForSale() {
        console.log('Fixing bulk edit list for sale button');
        
        // Fix the openBulkReviewModal function
        window.openBulkReviewModal = function(mode) {
            console.log('Opening bulk review modal:', mode);
            
            // Get selected cards
            const selectedCards = document.querySelectorAll('.card-container.selected');
            if (selectedCards.length === 0) {
                alert('Please select at least one card first.');
                return;
            }
            
            // Get the bulk review modal
            const bulkReviewModal = document.getElementById('bulk-review-modal');
            if (!bulkReviewModal) {
                console.error('Bulk review modal not found, creating it');
                
                // Create the modal if it doesn't exist
                const modal = document.createElement('div');
                modal.id = 'bulk-review-modal';
                modal.className = 'fixed inset-0 bg-black bg-opacity-75 hidden items-center justify-center z-[1002]';
                
                modal.innerHTML = `
                    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl">
                        <div class="p-4 border-b dark:border-gray-700 flex justify-between items-center">
                            <h3 class="text-lg font-semibold" id="bulk-review-title">Bulk Action</h3>
                            <button class="text-gray-500 hover:text-gray-800 dark:hover:text-white text-2xl font-bold" data-modal-close="bulk-review-modal">×</button>
                        </div>
                        <div class="p-6">
                            <p class="mb-4" id="bulk-review-message">You are about to perform a bulk action on <span id="bulk-review-count">0</span> cards.</p>
                            <div class="mb-4" id="bulk-price-container">
                                <label class="block text-sm font-medium mb-1" for="bulk-price">Price per card ($)</label>
                                <input type="number" id="bulk-price" class="w-full p-2 border rounded-md" min="0" step="0.01" value="0.00">
                            </div>
                            <div class="flex justify-end space-x-2">
                                <button class="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-md" data-modal-close="bulk-review-modal">Cancel</button>
                                <button id="bulk-confirm-btn" class="px-4 py-2 bg-blue-500 text-white rounded-md">Confirm</button>
                            </div>
                        </div>
                    </div>
                `;
                
                document.body.appendChild(modal);
                
                // Add event listener to close button
                const closeBtn = modal.querySelector('[data-modal-close="bulk-review-modal"]');
                if (closeBtn) {
                    closeBtn.addEventListener('click', function() {
                        modal.classList.add('hidden');
                        modal.classList.remove('flex');
                    });
                }
                
                // Add event listener to confirm button
                const confirmBtn = modal.querySelector('#bulk-confirm-btn');
                if (confirmBtn) {
                    confirmBtn.addEventListener('click', function() {
                        // Handle confirmation based on mode
                        if (mode === 'list') {
                            const price = document.getElementById('bulk-price').value;
                            alert(`${selectedCards.length} cards will be listed for sale at $${price} each.`);
                        } else if (mode === 'delete') {
                            alert(`${selectedCards.length} cards will be deleted.`);
                        }
                        
                        // Close modal
                        modal.classList.add('hidden');
                        modal.classList.remove('flex');
                        
                        // Deselect all cards
                        selectedCards.forEach(card => {
                            card.classList.remove('selected');
                            const checkbox = card.querySelector('.bulk-select-checkbox');
                            if (checkbox) checkbox.checked = false;
                        });
                    });
                }
            }
            
            // Update modal content
            const bulkReviewTitle = document.getElementById('bulk-review-title');
            const bulkReviewMessage = document.getElementById('bulk-review-message');
            const bulkReviewCount = document.getElementById('bulk-review-count');
            const bulkPriceContainer = document.getElementById('bulk-price-container');
            
            if (bulkReviewTitle) {
                bulkReviewTitle.textContent = mode === 'list' ? 'List Cards for Sale' : 'Delete Cards';
            }
            
            if (bulkReviewMessage) {
                bulkReviewMessage.textContent = mode === 'list' 
                    ? `You are about to list ${selectedCards.length} cards for sale.` 
                    : `You are about to delete ${selectedCards.length} cards.`;
            }
            
            if (bulkReviewCount) {
                bulkReviewCount.textContent = selectedCards.length;
            }
            
            if (bulkPriceContainer) {
                bulkPriceContainer.style.display = mode === 'list' ? 'block' : 'none';
            }
            
            // Show modal
            bulkReviewModal.classList.remove('hidden');
            bulkReviewModal.classList.add('flex', 'items-center', 'justify-center');
        };
        
        // Fix the list for sale button
        const listForSaleBtn = document.querySelector('button[data-action="list-for-sale"]') || document.querySelector('.list-for-sale-btn') || document.querySelector('button:contains("List for Sale")');
        
        if (listForSaleBtn) {
            // Remove existing event listeners
            const clone = listForSaleBtn.cloneNode(true);
            listForSaleBtn.parentNode.replaceChild(clone, listForSaleBtn);
            
            // Add new event listener
            clone.addEventListener('click', function() {
                window.openBulkReviewModal('list');
            });
        } else {
            // If button not found, look for it by text content
            document.querySelectorAll('button').forEach(btn => {
                if (btn.textContent.trim() === 'List for Sale') {
                    // Remove existing event listeners
                    const clone = btn.cloneNode(true);
                    btn.parentNode.replaceChild(clone, btn);
                    
                    // Add new event listener
                    clone.addEventListener('click', function() {
                        window.openBulkReviewModal('list');
                    });
                }
            });
        }
    }
    
    // ===== FIX 3 & 4: ANALYTICS FUNCTIONALITY =====
    function fixAnalytics() {
        console.log('Fixing analytics functionality');
        
        // Define the toggleDashboard function if it doesn't exist
        if (!window.toggleDashboard) {
            window.toggleDashboard = function(cardId) {
                console.log('Toggling dashboard for card:', cardId);
                
                // Get the collection display and analytics dashboard
                const collectionDisplay = document.getElementById('collection-display');
                const analyticsDashboard = document.getElementById('analytics-dashboard');
                
                if (!collectionDisplay || !analyticsDashboard) {
                    console.error('Collection display or analytics dashboard not found');
                    return;
                }
                
                // Toggle visibility
                if (analyticsDashboard.style.display === 'flex') {
                    collectionDisplay.style.display = '';
                    analyticsDashboard.style.display = 'none';
                } else {
                    collectionDisplay.style.display = 'none';
                    analyticsDashboard.style.display = 'flex';
                    
                    // Update analytics data
                    const currentValue = document.getElementById('analytics-current-value');
                    const change24h = document.getElementById('analytics-24h-change');
                    const allTimeHigh = document.getElementById('analytics-all-time-high');
                    
                    if (currentValue) currentValue.textContent = '$108.47';
                    if (change24h) change24h.textContent = '+$0.23';
                    if (allTimeHigh) allTimeHigh.textContent = '$110.00';
                    
                    // If we have a specific card ID, show card-specific analytics
                    if (cardId) {
                        console.log('Showing analytics for card:', cardId);
                        
                        // In a real implementation, this would fetch card-specific data
                        // For now, just show some mock data
                        if (currentValue) currentValue.textContent = '$45.99';
                        if (change24h) change24h.textContent = '+$1.25';
                        if (allTimeHigh) allTimeHigh.textContent = '$50.00';
                    }
                }
            };
        }
        
        // Fix the analyze value button
        const analyzeValueBtn = document.getElementById('analyze-value-btn');
        if (analyzeValueBtn) {
            // Remove existing event listeners
            const clone = analyzeValueBtn.cloneNode(true);
            analyzeValueBtn.parentNode.replaceChild(clone, analyzeValueBtn);
            
            // Add new event listener
            clone.addEventListener('click', function() {
                window.toggleDashboard();
            });
        }
        
        // Fix card analytics buttons
        document.querySelectorAll('.analytics-btn').forEach(btn => {
            // Remove existing event listeners
            const clone = btn.cloneNode(true);
            btn.parentNode.replaceChild(clone, btn);
            
            // Add new event listener
            clone.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                const cardId = this.dataset.cardId || this.closest('.card-container')?.dataset.cardId;
                window.toggleDashboard(cardId);
            });
        });
        
        // Add analytics buttons to cards that don't have them
        document.querySelectorAll('.card-container').forEach(card => {
            if (!card.querySelector('.analytics-btn')) {
                const cardActions = card.querySelector('.card-actions');
                if (cardActions) {
                    const analyticsBtn = document.createElement('button');
                    analyticsBtn.className = 'analytics-btn text-blue-500 hover:text-blue-700';
                    analyticsBtn.innerHTML = '<i class="fas fa-chart-line"></i>';
                    analyticsBtn.dataset.cardId = card.dataset.cardId || 'card-' + Math.random().toString(36).substr(2, 9);
                    
                    analyticsBtn.addEventListener('click', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        window.toggleDashboard(this.dataset.cardId);
                    });
                    
                    cardActions.appendChild(analyticsBtn);
                }
            }
        });
        
        // Add analytics functionality to list view cards
        document.addEventListener('click', function(e) {
            const analyticsBtn = e.target.closest('.analytics-btn');
            if (analyticsBtn) {
                e.preventDefault();
                e.stopPropagation();
                const cardId = analyticsBtn.dataset.cardId || analyticsBtn.closest('.card-container')?.dataset.cardId;
                window.toggleDashboard(cardId);
            }
        });
    }
    
    // ===== INITIALIZATION =====
    
    // Apply targeted fixes
    revertGridView();
    fixBulkEditListForSale();
    fixAnalytics();
    
    console.log('All targeted fixes applied');
});
