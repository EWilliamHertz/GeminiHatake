/**
 * tooltip-element.js
 * Creates the card preview tooltip element if it doesn't exist
 */

document.addEventListener('DOMContentLoaded', function() {
    // Check if tooltip element already exists
    if (!document.getElementById('card-preview-tooltip')) {
        // Create tooltip element
        const tooltip = document.createElement('div');
        tooltip.id = 'card-preview-tooltip';
        tooltip.className = 'fixed z-50 hidden';
        tooltip.style.pointerEvents = 'none';
        document.body.appendChild(tooltip);
        
        console.log('Card preview tooltip element created');
    }
});
