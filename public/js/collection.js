/**
 * Main Collection Management System
 * Modular card collection management with marketplace integration
 */

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize the main application
    window.CollectionApp.initializeApp();
});

// Global functions for backward compatibility and HTML onclick handlers
window.toggleItemSelection = function(itemId) {
    window.BulkOperations.toggleItemSelection(itemId);
};

window.selectAllItems = function() {
    window.BulkOperations.selectAllItems();
};

window.clearSelection = function() {
    window.BulkOperations.clearSelection();
};

window.bulkDelete = function() {
    window.BulkOperations.bulkDelete();
};

window.bulkListForSale = function() {
    window.BulkOperations.bulkListForSale();
};

window.exportCollection = function() {
    window.CSVImport.exportCollectionAsCSV();
};

window.handleCSVUpload = function() {
    window.CSVImport.handleCSVUpload();
};

window.searchCardVersions = function() {
    window.CardSearch.searchCardVersions();
};

window.addSealedProduct = function() {
    window.SealedProducts.addSealedProduct();
};

// Make sure all modules are available globally
console.log('Collection Management System loaded with modules:', {
    CollectionApp: !!window.CollectionApp,
    CardDisplay: !!window.CardDisplay,
    CardModal: !!window.CardModal,
    CardSearch: !!window.CardSearch,
    BulkOperations: !!window.BulkOperations,
    CSVImport: !!window.CSVImport,
    SealedProducts: !!window.SealedProducts,
    Utils: !!window.Utils
});

