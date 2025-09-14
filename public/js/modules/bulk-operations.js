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
        window.CollectionApp.renderCurrentView();
    }

    function handleSelectAll(e) {
        const isChecked = e.target.checked;
        const collection = window.CollectionApp.getFilteredCollection();
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

        const batch = db.batch();
        selectedCards.forEach(cardId => {
            batch.delete(collectionRef.doc(cardId));
        });

        try {
            await batch.commit();
            window.Utils.showNotification(`${selectedCards.size} cards deleted successfully.`, 'success');
            
            // This is the correct sequence: reload data, then exit bulk mode which triggers a re-render
            await window.CollectionApp.loadAllData();
            toggleBulkEditMode();

        } catch (error) {
            console.error("Error with bulk delete:", error);
            window.Utils.showNotification("An error occurred during bulk deletion. Please try again.", "error");
        }
    }

    return {
        initialize,
        isBulkEditMode: () => bulkEditMode,
        getSelectedCards: () => selectedCards,
        handleCardSelection,
        toggleBulkEditMode
    };

})();

