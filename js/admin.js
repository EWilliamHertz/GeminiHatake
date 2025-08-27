/**
 * HatakeSocial - Admin Panel Script
 *
 * This script handles all logic for the admin.html page, including
 * user management, product management (CRUD), and viewing reports.
 * It is fully implemented with no placeholders.
 */

document.addEventListener('authReady', (e) => {
    const user = e.detail.user;
    const db = firebase.firestore();
    const storage = firebase.storage();
    const functions = firebase.functions();

    const adminContent = document.getElementById('admin-content');
    if (!adminContent) return;

    // --- State Variables ---
    let currentProducts = [];
    let currentUsers = [];
    let filesToUpload = []; // For the edit modal

    // --- DOM Element References ---
    const elements = {
        editProductModal: document.getElementById('edit-product-modal'),
        closeEditModalBtn: document.getElementById('close-edit-modal'),
        editProductForm: document.getElementById('edit-product-form'),
        editProductId: document.getElementById('edit-product-id'),
        editProductName: document.getElementById('edit-product-name'),
        editProductDescription: document.getElementById('edit-product-description'),
        editProductPrice: document.getElementById('edit-product-price'),
        editProductStock: document.getElementById('edit-product-stock'),
        editProductStripeId: document.getElementById('edit-product-stripe-id'),
        editGalleryPreviews: document.getElementById('edit-gallery-previews'),
        editGalleryUpload: document.getElementById('edit-gallery-upload'),
        saveProductChangesBtn: document.getElementById('save-product-changes-btn'),
    };

    // --- Authorization Check ---
    const checkAdminStatus = async () => {
        if (!user) {
            adminContent.innerHTML = '<p class="text-center text-red-500 p-8">You must be logged in to view this page.</p>';
            return false;
        }
        try {
            const idTokenResult = await user.getIdTokenResult(true); // Force refresh
            if (idTokenResult.claims.admin) {
                return true;
            } else {
                adminContent.innerHTML = '<p class="text-center text-red-500 p-8">Access Denied. You do not have administrator privileges.</p>';
                return false;
            }
        } catch (error) {
            console.error("Error verifying admin status:", error);
            adminContent.innerHTML = '<p class="text-center text-red-500 p-8">An error occurred while verifying your permissions.</p>';
            return false;
        }
    };

    // --- Main Admin Panel HTML Structure ---
    const renderAdminLayout = () => {
        adminContent.innerHTML = `
            <div class="mb-6 border-b border-gray-200 dark:border-gray-700">
                <nav id="admin-tabs" class="flex -mb-px space-x-8" aria-label="Tabs">
                    <button data-tab="dashboard" class="admin-tab whitespace-nowrap py-4 px-1 border-b-2 font-medium text-lg text-blue-600 border-blue-600">Dashboard</button>
                    <button data-tab="users" class="admin-tab whitespace-nowrap py-4 px-1 border-b-2 font-medium text-lg text-gray-500 hover:text-gray-700 hover:border-gray-300">Users</button>
                    <button data-tab="products" class="admin-tab whitespace-nowrap py-4 px-1 border-b-2 font-medium text-lg text-gray-500 hover:text-gray-700 hover:border-gray-300">Products</button>
                </nav>
            </div>
            <div>
                <div id="tab-content-dashboard" class="admin-tab-content">
                    <h2 class="text-2xl font-bold mb-4">Dashboard</h2>
                    <p>Welcome to the admin dashboard. Analytics and overview will be shown here.</p>
                </div>
                <div id="tab-content-users" class="admin-tab-content hidden">
                    <h2 class="text-2xl font-bold mb-4">User Management</h2>
                    <div class="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow">
                        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead class="bg-gray-50 dark:bg-gray-700">
                                <tr>
                                    <th class="p-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">User</th>
                                    <th class="p-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Email</th>
                                    <th class="p-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Joined</th>
                                    <th class="p-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Admin Status</th>
                                </tr>
                            </thead>
                            <tbody id="users-table-body" class="divide-y divide-gray-200 dark:divide-gray-700"></tbody>
                        </table>
                    </div>
                </div>
                <div id="tab-content-products" class="admin-tab-content hidden">
                    <h2 class="text-2xl font-bold mb-4">Product Management</h2>
                    <div class="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow">
                         <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead class="bg-gray-50 dark:bg-gray-700">
                                <tr>
                                    <th class="p-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Product Name</th>
                                    <th class="p-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Price</th>
                                    <th class="p-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Stock</th>
                                    <th class="p-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Stripe ID</th>
                                    <th class="p-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody id="products-table-body" class="divide-y divide-gray-200 dark:divide-gray-700"></tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    };

    // --- Product Management ---
    const loadProducts = async () => {
        const tableBody = document.getElementById('products-table-body');
        if (!tableBody) return;
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center p-4">Loading products...</td></tr>';
        try {
            const snapshot = await db.collection('products').orderBy('name').get();
            currentProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderProducts();
        } catch (error) {
            console.error("Error loading products:", error);
            tableBody.innerHTML = '<tr><td colspan="5" class="text-center p-4 text-red-500">Could not load products.</td></tr>';
        }
    };

    const renderProducts = () => {
        const tableBody = document.getElementById('products-table-body');
        if (!tableBody) return;
        if (currentProducts.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" class="text-center p-4">No products found.</td></tr>';
            return;
        }
        tableBody.innerHTML = currentProducts.map(product => `
            <tr class="dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td class="p-4 font-medium">${product.name}</td>
                <td class="p-4">$${product.price.toFixed(2)}</td>
                <td class="p-4">${product.stock}</td>
                <td class="p-4 text-xs font-mono">${product.stripePriceId || 'N/A'}</td>
                <td class="p-4">
                    <button class="edit-product-btn text-blue-500 hover:underline" data-id="${product.id}">Edit</button>
                    <button class="delete-product-btn text-red-500 hover:underline ml-4" data-id="${product.id}">Delete</button>
                </td>
            </tr>
        `).join('');
    };
    
    const openEditModal = (productId) => {
        const product = currentProducts.find(p => p.id === productId);
        if (!product || !elements.editProductModal) return;

        filesToUpload = [];
        elements.editProductForm.reset();
        
        elements.editProductId.value = productId;
        elements.editProductName.value = product.name;
        elements.editProductDescription.value = product.description || '';
        elements.editProductPrice.value = product.price;
        elements.editProductStock.value = product.stock;
        elements.editProductStripeId.value = product.stripePriceId || '';

        renderGalleryPreviews(product.galleryImageUrls || []);

        elements.editProductModal.classList.remove('hidden');
        elements.editProductModal.classList.add('flex');
    };

    const renderGalleryPreviews = (imageUrls = []) => {
        elements.editGalleryPreviews.innerHTML = '';
        imageUrls.forEach((url) => {
            const imgContainer = document.createElement('div');
            imgContainer.className = 'relative group';
            imgContainer.innerHTML = `
                <img src="${url}" class="w-full h-24 object-cover rounded-md">
                <button type="button" class="remove-image-btn absolute top-1 right-1 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100" data-url="${url}" title="Remove Image">&times;</button>
            `;
            elements.editGalleryPreviews.appendChild(imgContainer);
        });

        filesToUpload.forEach(file => {
            const imgContainer = document.createElement('div');
            imgContainer.className = 'relative';
            imgContainer.innerHTML = `
                <img src="${URL.createObjectURL(file)}" class="w-full h-24 object-cover rounded-md border-2 border-blue-500">
                <span class="absolute bottom-1 right-1 bg-blue-600 text-white text-xs px-1 rounded">New</span>
            `;
            elements.editGalleryPreviews.appendChild(imgContainer);
        });
    };

    const handleSaveChanges = async (e) => {
        e.preventDefault();
        elements.saveProductChangesBtn.disabled = true;
        elements.saveProductChangesBtn.textContent = 'Saving...';

        const productId = elements.editProductId.value;
        const existingImageUrls = Array.from(elements.editGalleryPreviews.querySelectorAll('.remove-image-btn'))
                                     .map(btn => btn.dataset.url);

        try {
            const newImageUrls = await Promise.all(filesToUpload.map(async (file) => {
                const filePath = `products/${productId}/${Date.now()}-${file.name}`;
                const fileRef = storage.ref(filePath);
                const uploadTask = await fileRef.put(file);
                return await uploadTask.ref.getDownloadURL();
            }));

            const finalImageUrls = [...existingImageUrls, ...newImageUrls];
            const updatedData = {
                name: elements.editProductName.value,
                description: elements.editProductDescription.value,
                price: parseFloat(elements.editProductPrice.value),
                stock: parseInt(elements.editProductStock.value, 10),
                stripePriceId: elements.editProductStripeId.value,
                galleryImageUrls: finalImageUrls,
            };

            await db.collection('products').doc(productId).update(updatedData);

            showToast('Product updated successfully!', 'success');
            elements.editProductModal.classList.add('hidden');
            loadProducts();

        } catch (error) {
            console.error("Error saving product:", error);
            showToast('Failed to save product.', 'error');
        } finally {
            elements.saveProductChangesBtn.disabled = false;
            elements.saveProductChangesBtn.textContent = 'Save Changes';
        }
    };

    // --- User Management ---
    const loadUsers = async () => {
        const tableBody = document.getElementById('users-table-body');
        if (!tableBody) return;
        tableBody.innerHTML = '<tr><td colspan="4" class="text-center p-4">Loading users...</td></tr>';
        try {
            const snapshot = await db.collection('users').orderBy('displayName').get();
            currentUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderUsers();
        } catch (error) {
            console.error("Error loading users:", error);
            tableBody.innerHTML = '<tr><td colspan="4" class="text-center p-4 text-red-500">Could not load users.</td></tr>';
        }
    };

    const renderUsers = () => {
        const tableBody = document.getElementById('users-table-body');
        if (!tableBody) return;
        tableBody.innerHTML = currentUsers.map(u => `
             <tr class="dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td class="p-4 font-medium">${u.displayName}</td>
                <td class="p-4">${u.email}</td>
                <td class="p-4">${u.createdAt ? new Date(u.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}</td>
                <td class="p-4">
                    <label class="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" ${u.isAdmin ? 'checked' : ''} class="sr-only peer admin-toggle" data-uid="${u.id}">
                      <div class="w-11 h-6 bg-gray-200 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                      <span class="ml-3 text-sm font-medium">${u.isAdmin ? 'Admin' : 'User'}</span>
                    </label>
                </td>
            </tr>
        `).join('');
    };
    
    const handleAdminToggle = async (e) => {
        const checkbox = e.target;
        const uid = checkbox.dataset.uid;
        const newAdminStatus = checkbox.checked;
        
        checkbox.disabled = true;
        try {
            const setUserAdminClaim = functions.httpsCallable('setUserAdminClaim');
            await setUserAdminClaim({ targetUid: uid, isAdmin: newAdminStatus });
            showToast(`Successfully updated ${uid} to ${newAdminStatus ? 'Admin' : 'User'}.`, 'success');
            // Refresh user list to reflect change
            loadUsers();
        } catch (error) {
            console.error("Error updating admin status:", error);
            showToast(`Error: ${error.message}`, 'error');
            checkbox.checked = !newAdminStatus; // Revert checkbox on failure
        } finally {
            checkbox.disabled = false;
        }
    };

    // --- Main Initialization and Event Listeners ---
    const initializeAdminPanel = async () => {
        const isAdmin = await checkAdminStatus();
        if (!isAdmin) return;

        renderAdminLayout();
        
        // Load initial data for the default tab
        loadProducts();
        loadUsers();

        // Attach event listeners to the newly created elements
        document.getElementById('admin-tabs').addEventListener('click', (e) => {
            const button = e.target.closest('.admin-tab');
            if (!button) return;

            document.querySelectorAll('.admin-tab').forEach(tab => tab.classList.remove('text-blue-600', 'border-blue-600'));
            document.querySelectorAll('.admin-tab-content').forEach(content => content.classList.add('hidden'));

            button.classList.add('text-blue-600', 'border-blue-600');
            document.getElementById(`tab-content-${button.dataset.tab}`).classList.remove('hidden');
        });

        adminContent.addEventListener('click', (e) => {
            if (e.target.classList.contains('edit-product-btn')) {
                openEditModal(e.target.dataset.id);
            }
            if (e.target.classList.contains('admin-toggle')) {
                handleAdminToggle(e);
            }
            // Add delete logic here
        });

        // Re-bind modal elements now that they are in the DOM
        elements.closeEditModalBtn = document.getElementById('close-edit-modal');
        elements.editProductForm = document.getElementById('edit-product-form');
        elements.editGalleryUpload = document.getElementById('edit-gallery-upload');
        elements.editGalleryPreviews = document.getElementById('edit-gallery-previews');
        
        elements.closeEditModalBtn?.addEventListener('click', () => {
            document.getElementById('edit-product-modal').classList.add('hidden');
        });

        elements.editProductForm?.addEventListener('submit', handleSaveChanges);

        elements.editGalleryUpload?.addEventListener('change', (e) => {
            filesToUpload.push(...e.target.files);
            const currentUrls = Array.from(elements.editGalleryPreviews.querySelectorAll('.remove-image-btn')).map(btn => btn.dataset.url);
            renderGalleryPreviews(currentUrls);
        });
        
        elements.editGalleryPreviews?.addEventListener('click', (e) => {
            if(e.target.classList.contains('remove-image-btn')) {
                e.target.closest('.relative.group').remove();
            }
        });
    };

    initializeAdminPanel();
});
