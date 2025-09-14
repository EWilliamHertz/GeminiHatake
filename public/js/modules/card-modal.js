window.BulkOperations = (() => {
    const bulkEditBtn = document.getElementById('bulk-edit-btn');
    const bulkActionBar = document.getElementById('bulk-action-bar');
    const selectedCountEl = document.getElementById('selected-count');
    const selectAllCheckbox = document.getElementById('select-all-checkbox');
    const listSelectedBtn = document.getElementById('list-selected-btn');
    const deleteSelectedBtn = document.getElementById('delete-selected-btn');

    let bulkEditMode = false;
    let selectedCards = new Set();

    function initialize() {
        bulkEditBtn?.addEventListener('click', toggleBulkEditMode);
        selectAllCheckbox?.addEventListener('change', handleSelectAll);
        deleteSelectedBtn?.addEventListener('click', bulkDelete);
        // Add listener for list button later
    }

    function toggleBulkEditMode() {
        bulkEditMode = !bulkEditMode;
        selectedCards.clear();
        if(selectAllCheckbox) selectAllCheckbox.checked = false;

        if (bulkEditMode) {
            bulkEditBtn.textContent = 'Cancel Bulk Edit';
            bulkEditBtn.classList.add('bg-red-600', 'hover:bg-red-700');
            bulkEditBtn.classList.remove('bg-gray-600', 'hover:bg-gray-700');
            bulkActionBar?.classList.remove('hidden');
        } else {
            bulkEditBtn.textContent = 'Bulk Edit';
            bulkEditBtn.classList.remove('bg-red-600', 'hover:bg-red-700');
            bulkEditBtn.classList.add('bg-gray-600', 'hover:bg-gray-700');
            bulkActionBar?.classList.add('hidden');
        }
        updateSelectedCount();
        window.CollectionApp.renderCurrentView();
    }

    function handleCardSelection(cardId) {
        if (!bulkEditMode) return;
        
        if (selectedCards.has(cardId)) {
            selectedCards.delete(cardId);
        } else {
            selectedCards.add(cardId);
        }
        updateSelectedCount();
        window.CollectionApp.renderCurrentView(); // Re-render to show selection state
    }

    function handleSelectAll(e) {
        const isChecked = e.target.checked;
        const collection = window.CollectionApp.getFilteredCollection(); // Get currently visible cards
        if (isChecked) {
            collection.forEach(card => selectedCards.add(card.id));
        } else {
            selectedCards.clear();
        }
        updateSelectedCount();
        window.CollectionApp.renderCurrentView();
    }
    
    function updateSelectedCount() {
        if (selectedCountEl) {
            selectedCountEl.textContent = `${selectedCards.size} cards selected`;
        }
    }

    async function bulkDelete() {
        if (selectedCards.size === 0) {
            window.Utils.showNotification("No cards selected for deletion.", "info");
            return;
        }

        if (!confirm(`Are you sure you want to permanently delete ${selectedCards.size} selected cards? This cannot be undone.`)) {
            return;
        }

        const db = window.CollectionApp.getDb();
        const user = window.CollectionApp.getCurrentUser();
        const collectionRef = db.collection('users').doc(user.uid).collection('collection');

        // Firestore allows a maximum of 500 writes in a single batch.
        const batch = db.batch();
        let count = 0;

        try {
            for (const cardId of selectedCards) {
                batch.delete(collectionRef.doc(cardId));
                count++;
                // If we reach the limit, commit the batch and start a new one.
                // This scenario is unlikely for most users but is good practice.
                if (count === 499) {
                    await batch.commit();
                    batch = db.batch(); 
                    count = 0;
                }
            }
            if (count > 0) {
                await batch.commit();
            }

            window.Utils.showNotification(`${selectedCards.size} cards deleted successfully.`, 'success');
            
            // Exit bulk edit mode and refresh data
            toggleBulkEditMode(); 
            window.CollectionApp.loadAllData();

        } catch (error) {
            console.error("Error with bulk delete:", error);
            window.Utils.showNotification("An error occurred during bulk deletion. Please try again.", "error");
        }
    }

    function isBulkEditMode() {
        return bulkEditMode;
    }

    function getSelectedCards() {
        return selectedCards;
    }

    initialize();

    return {
        isBulkEditMode,
        getSelectedCards,
        handleCardSelection
    };

})();

