/**
 * Utilities Module
 * Common utility functions used across the application
 */

/**
 * Safe price formatting
 */
function safeFormatPrice(value) {
    if (window.HatakeSocial && typeof window.HatakeSocial.convertAndFormatPrice === 'function') {
        return window.HatakeSocial.convertAndFormatPrice(value, 'USD');
    }
    return `$${Number(value || 0).toFixed(2)} USD`;
}

/**
 * Show notification
 */
function showNotification(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);
    
    // Create toast if showToast function exists
    if (typeof showToast === 'function') {
        showToast(message, type);
    } else {
        // Fallback to alert for important messages
        if (type === 'error') {
            alert(`Error: ${message}`);
        } else if (type === 'success') {
            alert(`Success: ${message}`);
        }
    }
}

/**
 * API call helper
 */
async function makeApiCall(url, options = {}) {
    try {
        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('API call failed:', error);
        throw error;
    }
}

/**
 * Read file as text
 */
function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(e);
        reader.readAsText(file);
    });
}

/**
 * Debounce function
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Generate unique ID
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Sanitize HTML
 */
function sanitizeHTML(str) {
    if (!str) return '';
    const temp = document.createElement('div');
    temp.textContent = str;
    return temp.innerHTML;
}

/**
 * Format date
 */
function formatDate(date) {
    if (!date) return 'Unknown';
    
    if (date.toDate) {
        // Firestore timestamp
        date = date.toDate();
    }
    
    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    }).format(date);
}

/**
 * Validate email
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Get display name for product type
 */
function getProductTypeDisplayName(type) {
    const displayNames = {
        'booster_box': 'Booster Box',
        'booster_pack': 'Booster Pack',
        'bundle': 'Bundle',
        'prerelease_kit': 'Prerelease Kit',
        'commander_deck': 'Commander Deck',
        'starter_deck': 'Starter Deck',
        'collector_booster': 'Collector Booster',
        'draft_booster': 'Draft Booster',
        'set_booster': 'Set Booster',
        'theme_booster': 'Theme Booster'
    };
    return displayNames[type] || type;
}

/**
 * Copy text to clipboard
 */
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showNotification('Copied to clipboard', 'success');
    } catch (error) {
        console.error('Failed to copy to clipboard:', error);
        showNotification('Failed to copy to clipboard', 'error');
    }
}

/**
 * Download file
 */
function downloadFile(content, filename, contentType = 'text/plain') {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Export functions
window.Utils = {
    safeFormatPrice,
    showNotification,
    makeApiCall,
    readFileAsText,
    debounce,
    generateId,
    sanitizeHTML,
    formatDate,
    isValidEmail,
    getProductTypeDisplayName,
    copyToClipboard,
    downloadFile
};

