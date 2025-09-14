window.Utils = (() => {

    function safeFormatPrice(value) {
        if (window.HatakeSocial && typeof window.HatakeSocial.convertAndFormatPrice === 'function') {
            return window.HatakeSocial.convertAndFormatPrice(value, 'USD');
        }
        return `$${Number(value || 0).toFixed(2)} USD`;
    }

    function showNotification(message, type = 'info') {
        let backgroundColor = '#3B82F6'; // Default blue for info
        if (type === 'success') {
            backgroundColor = '#22C55E'; // Green
        } else if (type === 'error') {
            backgroundColor = '#EF4444'; // Red
        } else if (type === 'warning') {
            backgroundColor = '#F59E0B'; // Amber
        }
        
        Toastify({
            text: message,
            duration: 3000,
            close: true,
            gravity: "top",
            position: "right",
            stopOnFocus: true,
            style: {
                background: backgroundColor,
                borderRadius: "8px",
            },
        }).showToast();
    }

    async function makeApiCall(url, options = {}) {
        try {
            const response = await fetch(url, {
                ...options,
                headers: { 'Content-Type': 'application/json', ...options.headers }
            });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error('API call failed:', error);
            throw error;
        }
    }

    function readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsText(file);
        });
    }

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

    function getProductTypeDisplayName(type) {
        const names = {
            'booster_box': 'Booster Box',
            'booster_pack': 'Booster Pack',
            'bundle': 'Bundle',
            'prerelease_kit': 'Prerelease Kit',
            'commander_deck': 'Commander Deck',
            'starter_deck': 'Starter Deck',
        };
        return names[type] || type;
    }
    
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
    
    function formatDate(timestamp) {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString('en-US');
    }

    return {
        safeFormatPrice,
        showNotification,
        makeApiCall,
        readFileAsText,
        debounce,
        getProductTypeDisplayName,
        downloadFile,
        formatDate
    };

})();

