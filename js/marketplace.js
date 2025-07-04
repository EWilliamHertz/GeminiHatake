    /**
     * HatakeSocial - Marketplace Page Script (Temporary Link Generator)
     *
     * This script is designed to intentionally trigger a Firestore error
     * in the developer console. That error will contain a link that can be
     * clicked to automatically create the required database index.
     */
    document.addEventListener('authReady', (e) => {
        const user = e.detail.user;
        const marketplaceGrid = document.getElementById('marketplace-grid');
        if (!marketplaceGrid) return;

        if (!user) {
            marketplaceGrid.innerHTML = '<p class="col-span-full text-center text-gray-500">Please log in to view the marketplace.</p>';
            return;
        }

        const loadMarketplaceCards = async () => {
            try {
                // This is the query that will fail and generate the link in the console.
                console.log("Attempting to run the query that requires an index...");
                await db.collectionGroup('collection').where('forSale', '==', true).get();

                // If the code reaches here, it means the index already exists.
                marketplaceGrid.innerHTML = `<div class="col-span-full text-center p-8 bg-green-100 text-green-700 rounded-lg">
                    <h2 class="text-2xl font-bold">Success!</h2>
                    <p class="mt-2">The database index already exists. Please let me know, and I will provide the final working marketplace.js file.</p>
                </div>`;

            } catch (error) {
                // This is the expected outcome if the index is missing.
                console.error("THIS IS THE EXPECTED ERROR. CLICK THE LINK IN THIS ERROR MESSAGE TO CREATE THE INDEX:", error);
                marketplaceGrid.innerHTML = `
                    <div class="col-span-full text-center p-8 bg-red-100 text-red-700 rounded-lg">
                        <h2 class="text-2xl font-bold">Action Required: Database Index Missing</h2>
                        <p class="mt-2">To power the marketplace, a one-time database setup is needed.</p>
                        <p class="mt-4 font-semibold">Please follow these steps:</p>
                        <ol class="text-left inline-block mt-2 space-y-1">
                            <li>1. Open the Developer Console (press F12).</li>
                            <li>2. Find the red error message that starts with "THIS IS THE EXPECTED ERROR...".</li>
                            <li>3. Click the long <span class="font-mono bg-gray-200 px-1">https://console.firebase.google.com...</span> link inside that error message.</li>
                            <li>4. A new Firebase tab will open. Click the "Create" button there.</li>
                            <li>5. Wait for the index to build (status becomes "Enabled"), then let me know.</li>
                        </ol>
                    </div>`;
            }
        };

        loadMarketplaceCards();
    });
    
