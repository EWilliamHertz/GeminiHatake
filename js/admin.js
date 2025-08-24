/**
 * HatakeSocial - Admin Dashboard Script (v3 - Product Management)
 *
 * This script handles all logic for the admin.html page.
 * - NEW: Adds full CRUD (Create, Read, Update, Delete) functionality for shop products.
 * - NEW: Allows manual entry/editing of Stripe Product and Price IDs.
 * - NEW: Supports uploading multiple gallery images for each product.
 * - Verifies admin status.
 * - Provides tools to manage users and reported posts.
 */
document.addEventListener('authReady', async (e) => {
    const user = e.detail.user;
    const adminContainer = document.getElementById('admin-dashboard-container');
    const accessDeniedContainer = document.getElementById('admin-access-denied');
    const userTableBody = document.getElementById('user-management-table');
    const reportTableBody = document.getElementById('report-management-table');
    const productsTableBody = document.getElementById('products-table-body');
    
    // Product Modal Elements
    const productModal = document.getElementById('product-modal');
    const productModalTitle = document.getElementById('product-modal-title');
    const closeProductModalBtn = document.getElementById('close-product-modal');
    const addProductBtn = document.getElementById('add-product-btn');
    const productForm = document.getElementById('product-form');
    const galleryPreviews = document.getElementById('gallery-previews');
    const productIdField = document.getElementById('product-id');
    const saveProductBtn = document.getElementById('save-product-btn');
    const productFormError = document.getElementById('product-form-error');
    const galleryImageInput = document.getElementById('product-gallery-images');

    let currentProducts = [];
    let newImageFiles = []; // To hold new files for upload
    let existingImageUrls = []; // To hold URLs of images already uploaded

    if (!user) {
        accessDeniedContainer.classList.remove('hidden');
        adminContainer.classList.add('hidden');
        return;
    }

    // --- Verify Admin Status ---
    const userDoc = await db.collection('users').doc(user.uid).get();
    const isAdmin = userDoc.exists && userDoc.data().isAdmin === true;

    if (!isAdmin) {
        accessDeniedContainer.classList.remove('hidden');
        adminContainer.classList.add('hidden');
        return;
    }

    adminContainer.classList.remove('hidden');
    accessDeniedContainer.classList.add('hidden');

    // --- Product Management Functions ---
    const loadProducts = () => {
        db.collection('products').orderBy('name').onSnapshot(snapshot => {
            productsTableBody.innerHTML = '';
            currentProducts = [];
            if (snapshot.empty) {
                productsTableBody.innerHTML = '<tr><td colspan="4" class="text-center p-4 text-gray-500">No products found. Add one!</td></tr>';
                return;
            }
            snapshot.forEach(doc => {
                const product = { id: doc.id, ...doc.data() };
                currentProducts.push(product);
                const row = document.createElement('tr');
                // Use the first image in the gallery as the thumbnail, or a placeholder
                const thumbnailUrl = (product.galleryImageUrls && product.galleryImageUrls.length > 0) ? product.galleryImageUrls[0] : 'https://placehold.co/40x40?text=N/A';
                row.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap">
                        <div class="flex items-center">
                            <div class="flex-shrink-0 h-10 w-10">
                                <img class="h-10 w-10 rounded-full object-cover" src="${thumbnailUrl}" alt="${product.name}">
                            </div>
                            <div class="ml-4">
                                <div class="text-sm font-medium text-gray-900 dark:text-white">${product.name}</div>
                            </div>
                        </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">$${product.price.toFixed(2)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">${product.stock}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button class="edit-product-btn text-indigo-600 hover:text-indigo-900 dark:text-indigo-400" data-id="${product.id}">Edit</button>
                        <button class="delete-product-btn text-red-600 hover:text-red-900 dark:text-red-400 ml-4" data-id="${product.id}">Delete</button>
                    </td>
                `;
                productsTableBody.appendChild(row);
            });
        });
    };

    const openProductModal = (product = null) => {
        productForm.reset();
        productIdField.value = '';
        galleryPreviews.innerHTML = '';
        productFormError.classList.add('hidden');
        newImageFiles = [];
        existingImageUrls = [];

        if (product) {
            productModalTitle.textContent = 'Edit Product';
            productIdField.value = product.id;
            document.getElementById('product-name').value = product.name;
            document.getElementById('product-price').value = product.price;
            document.getElementById('product-description').value = product.description;
            document.getElementById('product-stock').value = product.stock;
            document.getElementById('stripe-product-id').value = product.stripeProductId || '';
            document.getElementById('stripe-price-id').value = product.stripePriceId || '';
            
            existingImageUrls = product.galleryImageUrls || [];
            renderGalleryPreviews();
        } else {
            productModalTitle.textContent = 'Add New Product';
        }
        openModal(productModal);
    };

    const renderGalleryPreviews = () => {
        galleryPreviews.innerHTML = '';
        // Render existing images
        existingImageUrls.forEach(url => {
            const imgContainer = document.createElement('div');
            imgContainer.className = 'relative';
            imgContainer.innerHTML = `
                <img src="${url}" class="h-24 w-24 object-cover rounded-md">
                <button type="button" data-url="${url}" class="delete-existing-img-btn absolute -top-2 -right-2 bg-red-600 text-white rounded-full h-6 w-6 flex items-center justify-center text-xs">&times;</button>
            `;
            galleryPreviews.appendChild(imgContainer);
        });
        // Render newly selected files
        newImageFiles.forEach((file, index) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const imgContainer = document.createElement('div');
                imgContainer.className = 'relative';
                imgContainer.innerHTML = `
                    <img src="${e.target.result}" class="h-24 w-24 object-cover rounded-md">
                    <button type="button" data-index="${index}" class="delete-new-img-btn absolute -top-2 -right-2 bg-red-600 text-white rounded-full h-6 w-6 flex items-center justify-center text-xs">&times;</button>
                `;
                galleryPreviews.appendChild(imgContainer);
            };
            reader.readAsDataURL(file);
        });
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        saveProductBtn.disabled = true;
        saveProductBtn.textContent = 'Saving...';
        productFormError.classList.add('hidden');

        const productId = productIdField.value;
        const isEditing = !!productId;

        const productData = {
            name: document.getElementById('product-name').value,
            price: parseFloat(document.getElementById('product-price').value),
            description: document.getElementById('product-description').value,
            stock: parseInt(document.getElementById('product-stock').value),
            stripeProductId: document.getElementById('stripe-product-id').value.trim(),
            stripePriceId: document.getElementById('stripe-price-id').value.trim(),
            galleryImageUrls: [...existingImageUrls] // Start with the remaining existing URLs
        };

        try {
            const docRef = isEditing ? db.collection('products').doc(productId) : db.collection('products').doc();
            
            // Upload new images
            if (newImageFiles.length > 0) {
                const uploadPromises = newImageFiles.map(file => {
                    const timestamp = Date.now();
                    const imageRef = storage.ref(`products/${docRef.id}/${timestamp}_${file.name}`);
                    return imageRef.put(file).then(snapshot => snapshot.ref.getDownloadURL());
                });
                const newUrls = await Promise.all(uploadPromises);
                productData.galleryImageUrls.push(...newUrls);
            }

            if (productData.galleryImageUrls.length === 0) {
                throw new Error("Product must have at least one image.");
            }

            if (isEditing) {
                await docRef.update(productData);
                showToast('Product updated successfully!', 'success');
            } else {
                await docRef.set(productData);
                showToast('Product created successfully!', 'success');
            }
            closeModal(productModal);
        } catch (error) {
            console.error("Error saving product:", error);
            productFormError.textContent = error.message;
            productFormError.classList.remove('hidden');
        } finally {
            saveProductBtn.disabled = false;
            saveProductBtn.textContent = 'Save Product';
        }
    };

    const handleDeleteProduct = async (productId) => {
        if (!confirm('Are you sure you want to delete this product? This will also delete all its images.')) {
            return;
        }
        try {
            await db.collection('products').doc(productId).delete();
            showToast('Product deleted. Images will be cleaned up in the background.', 'success');
        } catch (error) {
            console.error("Error deleting product:", error);
            showToast(`Error: ${error.message}`, 'error');
        }
    };

    // --- Existing Admin Functions (User & Report Management) ---
    const loadUsers = async () => { /* ... (Your existing loadUsers function) ... */ };
    const loadReports = async () => { /* ... (Your existing loadReports function) ... */ };

    // --- Event Listeners ---
    addProductBtn.addEventListener('click', () => openProductModal());
    closeProductModalBtn.addEventListener('click', () => closeModal(productModal));
    productForm.addEventListener('submit', handleFormSubmit);

    galleryImageInput.addEventListener('change', (e) => {
        newImageFiles.push(...Array.from(e.target.files));
        renderGalleryPreviews();
    });

    galleryPreviews.addEventListener('click', (e) => {
        if (e.target.closest('.delete-existing-img-btn')) {
            const urlToDelete = e.target.closest('.delete-existing-img-btn').dataset.url;
            existingImageUrls = existingImageUrls.filter(url => url !== urlToDelete);
            renderGalleryPreviews();
        }
        if (e.target.closest('.delete-new-img-btn')) {
            const indexToDelete = parseInt(e.target.closest('.delete-new-img-btn').dataset.index, 10);
            newImageFiles.splice(indexToDelete, 1);
            renderGalleryPreviews();
        }
    });

    productsTableBody.addEventListener('click', (e) => {
        if (e.target.closest('.edit-product-btn')) {
            const btn = e.target.closest('.edit-product-btn');
            const product = currentProducts.find(p => p.id === btn.dataset.id);
            if (product) openProductModal(product);
        }
        if (e.target.closest('.delete-product-btn')) {
            const btn = e.target.closest('.delete-product-btn');
            handleDeleteProduct(btn.dataset.id);
        }
    });

    userTableBody.addEventListener('click', async (e) => { /* ... (Your existing userTableBody listener) ... */ });
    reportTableBody.addEventListener('click', async (e) => { /* ... (Your existing reportTableBody listener) ... */ });

    // --- Initial Load ---
    loadUsers();
    loadReports();
    loadProducts();
});
