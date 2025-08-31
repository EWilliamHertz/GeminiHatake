document.addEventListener('DOMContentLoaded', function() {
    // IMPORTANT: REPLACE WITH YOUR ACTUAL FIREBASE CONFIG from auth.js
 const firebaseConfig = {
  apiKey: "AIzaSyD2Z9tCmmgReMG77ywXukKC_YIXsbP3uoU",
  authDomain: "hatakesocial-88b5e.firebaseapp.com",
  projectId: "hatakesocial-88b5e",
  storageBucket: "hatakesocial-88b5e.firebasestorage.app",
  messagingSenderId: "1091697032506",
  appId: "1:1091697032506:web:6a7cf9f10bd12650b22403",
  measurementId: "G-EH0PS2Z84J"
};

    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }

    const db = firebase.firestore();
    const galleryContainer = document.getElementById('gallery-container');

    async function fetchProductImages() {
        if (!galleryContainer) return;

        try {
            const productsSnapshot = await db.collection('products').get();
            
            if (productsSnapshot.empty) {
                galleryContainer.innerHTML = '<p>No products found in the database.</p>';
                return;
            }
            
            galleryContainer.innerHTML = ''; // Clear loading message

            let imageFound = false;
            productsSnapshot.forEach(doc => {
                const product = doc.data();
                if (product.galleryImageUrls && Array.isArray(product.galleryImageUrls)) {
                    product.galleryImageUrls.forEach(imageUrl => {
                        if (typeof imageUrl === 'string' && imageUrl.startsWith('http')) {
                            imageFound = true;
                            const img = document.createElement('img');
                            img.src = imageUrl;
                            img.alt = product.name || 'Product Image';
                            img.loading = 'lazy';
                            galleryContainer.appendChild(img);
                        }
                    });
                }
            });

            if (!imageFound) {
                 galleryContainer.innerHTML = '<p>No valid gallery images were found in the products.</p>';
            }

        } catch (error) {
            console.error("Error fetching product images: ", error);
            galleryContainer.innerHTML = '<p>Could not load images. Please check the console for errors.</p>';
        }
    }

    fetchProductImages();
});