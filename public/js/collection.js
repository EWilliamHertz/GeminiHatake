/**
 * Main Collection Management System
 * Initializes all modules for the collection page.
 */
document.addEventListener('authReady', (e) => {
    const user = e.detail.user;
    if (user) {
        // Initialize all modules in a specific order to resolve dependencies
        // This ensures that `window.ModuleName` exists before it's called by another module.
        window.CardDisplay.initialize();
        window.CardModal.initialize();
        window.BulkOperations.initialize();
        window.CardSearch.initialize();
        window.CSVImport.initialize();
        window.SealedProducts.initialize();
        
        // Initialize the main app last, as it depends on all other modules being ready.
        window.CollectionApp.initialize(user, firebase.firestore());
    } else {
        const mainContent = document.querySelector('main');
        if (mainContent) {
            mainContent.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 p-8">Please log in to manage your collection.</p>';
        }
    }
});