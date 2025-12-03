/**
 * Simple Firebase Analytics
 * Logs page views to Firestore 'site_analytics' collection.
 */
document.addEventListener('DOMContentLoaded', () => {
    // Wait for Firebase to initialize
    const analyticsInterval = setInterval(() => {
        if (typeof firebase !== 'undefined' && firebase.app()) {
            clearInterval(analyticsInterval);
            logPageView();
        }
    }, 500);
});

async function logPageView() {
    try {
        const db = firebase.firestore();
        const path = window.location.pathname || '/';
        
        // Get simple browser info (nothing invasive)
        const userAgent = navigator.userAgent;
        let deviceType = 'desktop';
        if (/Mobi|Android/i.test(userAgent)) {
            deviceType = 'mobile';
        }

        await db.collection('site_analytics').add({
            page: path,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            device: deviceType,
            referrer: document.referrer || 'direct'
        });
        
        console.log('Page view logged');
    } catch (error) {
        console.error('Analytics error:', error);
    }
}