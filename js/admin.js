/**
 * HatakeSocial - Admin Dashboard Script (v5 - Final Fix)
 *
 * - FIX: Removed the self-admin change prevention to allow the initial admin to set their own custom claim.
 * - Calls a secure Cloud Function (`setUserAdminClaim`) to manage user roles.
 * - Includes full product management (CRUD), user management, and report handling.
 */
document.addEventListener('authReady', async (e) => {
    const user = e.detail.user;
    const functions = firebase.functions();
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
    let newImageFiles = [];
    let existingImageUrls = [];

    if (!user) {
        accessDeniedContainer.classList.remove('hidden');
        adminContainer.classList.add('hidden');
        return;
    }

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
        existingImageUrls.forEach(url => {
            const imgContainer = document.createElement('div');
            imgContainer.className = 'relative';
            imgContainer.innerHTML = `
                <img src="${url}" class="h-24 w-24 object-cover rounded-md">
                <button type="button" data-url="${url}" class="delete-existing-img-btn absolute -top-2 -right-2 bg-red-600 text-white rounded-full h-6 w-6 flex items-center justify-center text-xs">&times;</button>
            `;
            galleryPreviews.appendChild(imgContainer);
        });
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
            galleryImageUrls: [...existingImageUrls]
        };

        try {
            const docRef = isEditing ? db.collection('products').doc(productId) : db.collection('products').doc();
            
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

    const loadUsers = async () => {
        userTableBody.innerHTML = '<tr><td colspan="4" class="text-center p-4">Loading users...</td></tr>';
        const usersSnapshot = await db.collection('users').get();
        userTableBody.innerHTML = '';

        usersSnapshot.forEach(doc => {
            const userData = doc.data();
            const userId = doc.id;
            const userIsAdmin = userData.isAdmin === true;
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                        <div class="flex-shrink-0 h-10 w-10">
                            <img class="h-10 w-10 rounded-full object-cover" src="${userData.photoURL || 'https://placehold.co/40x40'}" alt="">
                        </div>
                        <div class="ml-4">
                            <div class="text-sm font-medium text-gray-900 dark:text-white">${userData.displayName}</div>
                            <div class="text-sm text-gray-500 dark:text-gray-400">@${userData.handle}</div>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${userData.email}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${userIsAdmin ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}">
                        ${userIsAdmin ? 'Admin' : 'User'}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button data-uid="${userId}" data-is-admin="${userIsAdmin}" class="toggle-admin-btn text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-200">
                        ${userIsAdmin ? 'Revoke Admin' : 'Make Admin'}
                    </button>
                </td>
            `;
            userTableBody.appendChild(row);
        });
    };

    const loadReports = async () => {
        reportTableBody.innerHTML = '<tr><td colspan="4" class="text-center p-4">Loading reports...</td></tr>';
        const reportsSnapshot = await db.collection('reports').where('status', '==', 'pending').orderBy('timestamp', 'desc').get();
        
        if (reportsSnapshot.empty) {
            reportTableBody.innerHTML = '<tr><td colspan="4" class="text-center p-4 text-gray-500 dark:text-gray-400">No pending reports. Great job!</td></tr>';
            return;
        }

        reportTableBody.innerHTML = '';
        for (const doc of reportsSnapshot.docs) {
            const report = doc.data();
            const reportId = doc.id;

            const reporterDoc = await db.collection('users').doc(report.reportedBy).get();
            const postDoc = await db.collection('posts').doc(report.postId).get();

            const reporterName = reporterDoc.exists ? reporterDoc.data().displayName : 'Unknown User';
            const postContent = postDoc.exists ? postDoc.data().content.substring(0, 100) + '...' : '[Post Deleted]';

            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200">${reporterName}</td>
                <td class="px-6 py-4">
                    <p class="text-sm font-semibold text-gray-900 dark:text-white">${report.reason}</p>
                    <p class="text-sm text-gray-500 dark:text-gray-400">${report.details || 'No details provided.'}</p>
                </td>
                <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-300">${postContent}</td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    <button data-report-id="${reportId}" class="dismiss-report-btn text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-200">Dismiss</button>
                    ${postDoc.exists ? `<button data-report-id="${reportId}" data-post-id="${report.postId}" class="delete-post-btn text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-200">Delete Post</button>` : ''}
                </td>
            `;
            reportTableBody.appendChild(row);
        }
    };

    // --- Event Listeners ---
    addProductBtn.addEventListener('click', () => openProductModal());
    closeProductModalBtn.addEventListener('click', () => closeModal(productModal));
    productForm.addEventListener('submit', handleFormSubmit);
    galleryImageInput.addEventListener('change', (e) => {
        newImageFiles.push(...Array.from(e.target.files));
        renderGalleryPreviews();
        galleryImageInput.value = '';
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

    userTableBody.addEventListener('click', async (e) => {
        if (e.target.closest('.toggle-admin-btn')) {
            const button = e.target.closest('.toggle-admin-btn');
            const userIdToUpdate = button.dataset.uid;
            const currentIsAdmin = button.dataset.isAdmin === 'true';
            
            // **FIXED**: This block was preventing the first admin from setting their own claim.
            // It has been removed to allow self-assignment of the admin role.
            /*
            if (userIdToUpdate === user.uid) {
                showToast("You cannot change your own admin status.", "error");
                return;
            }
            */
            
            const action = currentIsAdmin ? 'revoke admin status from' : 'make';
            if (confirm(`Are you sure you want to ${action} this user?`)) {
                button.disabled = true;
                button.textContent = 'Updating...';
                try {
                    // Call the cloud function to set custom claims
                    const setUserAdminClaim = functions.httpsCallable('setUserAdminClaim');
                    await setUserAdminClaim({ targetUid: userIdToUpdate, isAdmin: !currentIsAdmin });
                    
                    showToast('User role updated successfully. The user must log out and log back in for the change to take full effect.', 'success');
                    loadUsers(); // This will refresh the user list to show the change
                } catch (error) {
                    console.error("Error updating user role:", error);
                    showToast(`Failed to update user role: ${error.message}`, "error");
                    button.disabled = false;
                    button.textContent = currentIsAdmin ? 'Revoke Admin' : 'Make Admin';
                }
            }
        }
    });

    reportTableBody.addEventListener('click', async (e) => {
        const dismissBtn = e.target.closest('.dismiss-report-btn');
        const deleteBtn = e.target.closest('.delete-post-btn');

        if (dismissBtn) {
            const reportId = dismissBtn.dataset.reportId;
            if (confirm("Are you sure you want to dismiss this report?")) {
                await db.collection('reports').doc(reportId).update({ status: 'dismissed' });
                loadReports();
            }
        }

        if (deleteBtn) {
            const reportId = deleteBtn.dataset.reportId;
            const postId = deleteBtn.dataset.postId;
            if (confirm("Are you sure you want to DELETE the post and dismiss the report? This cannot be undone.")) {
                const postRef = db.collection('posts').doc(postId);
                const reportRef = db.collection('reports').doc(reportId);
                
                const batch = db.batch();
                batch.delete(postRef);
                batch.update(reportRef, { status: 'resolved_deleted' });
                
                await batch.commit();
                loadReports();
            }
        }
    });

    // --- Initial Load ---
    loadUsers();
    loadReports();
    loadProducts();
});
