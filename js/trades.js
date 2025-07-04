/**
 * HatakeSocial - Trades Page Script (Temporary Link Generator)
 *
 * This script is designed to intentionally trigger Firestore errors
 * in the developer console. These errors will contain links that can be
 * clicked to automatically create the required database indexes for the trades page.
 */
document.addEventListener('authReady', (e) => {
    const user = e.detail.user;
    const incomingContainer = document.getElementById('tab-content-incoming');
    if (!incomingContainer) return; // We are not on the trades page

    if (!user) {
        incomingContainer.innerHTML = '<p class="text-center text-gray-500">Please log in to view your trades.</p>';
        return;
    }

    // Display a clear message on the page.
    incomingContainer.innerHTML = `
        <div class="text-center p-8 bg-red-100 text-red-700 rounded-lg">
            <h2 class="text-2xl font-bold">Action Required: Database Indexes Missing</h2>
            <p class="mt-2">To display your trades, a one-time database setup is needed.</p>
            <p class="mt-4 font-semibold">Please follow these steps:</p>
            <ol class="text-left inline-block mt-2 space-y-1">
                <li>1. Open the Developer Console (press F12).</li>
                <li>2. You should see two red error messages below, each starting with "THIS IS AN EXPECTED ERROR...".</li>
                <li>3. Click the long <span class="font-mono bg-gray-200 px-1">https://console.firebase.google.com...</span> link inside the <strong>first</strong> error message.</li>
                <li>4. A new Firebase tab will open. Click the "Create" button there.</li>
                <li>5. Come back to this page and click the link in the <strong>second</strong> error message.</li>
                <li>6. A new Firebase tab will open again. Click the "Create" button.</li>
                <li>7. Wait for both indexes to build (status becomes "Enabled"), then let me know.</li>
            </ol>
        </div>
    `;

    const generateIndexLinks = async () => {
        // --- Query 1: For Incoming Trades ---
        try {
            console.log("Attempting to run query for INCOMING trades...");
            await db.collection('trades').where('receiverId', '==', user.uid).orderBy('createdAt', 'desc').get();
        } catch (error) {
            console.error("THIS IS AN EXPECTED ERROR (1/2). CLICK THE LINK BELOW TO CREATE THE INDEX FOR INCOMING TRADES:", error);
        }

        // --- Query 2: For Outgoing Trades ---
        try {
            console.log("Attempting to run query for OUTGOING trades...");
            await db.collection('trades').where('proposerId', '==', user.uid).orderBy('createdAt', 'desc').get();
        } catch (error) {
            console.error("THIS IS AN EXPECTED ERROR (2/2). CLICK THE LINK BELOW TO CREATE THE INDEX FOR OUTGOING TRADES:", error);
        }
    };

    // Run the function to generate the links.
    generateIndexLinks();
});
