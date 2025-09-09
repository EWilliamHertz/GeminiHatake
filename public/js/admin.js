/**
 * HatakeSocial - Admin Panel Script
 *
 * This script handles all logic for the admin.html page.
 * Features:
 * - User Management (View, Suspend (timed), Ban, Impersonate, Grant Admin)
 * - Content Moderation (Articles, Comments, Reported Content)
 * - Platform Management (Broadcast Messages)
 * - Product Management (CRUD for Shop)
 * * FIXES APPLIED:
 * - Implemented product editing functionality.
 * - Implemented user impersonation functionality.
 * - Corrected user action calls (ban/suspend) to match backend functions.
 * - Implemented a simple user profile view modal.
 */

document.addEventListener('authReady', (e) => {
    const user = e.detail.user;
    const db = firebase.firestore();
    const functions = firebase.functions();

    const adminContent = document.getElementById('admin-content');
    if (!adminContent) return;

    // --- State Variables ---
    let currentProducts = [];
    let currentUsers = [];
    let currentArticles = [];
    let confirmationCallback = null;

    // --- DOM Element References ---
    const getElements = () => ({
        confirmationModal: document.getElementById('confirmation-modal'),
        confirmationTitle: document.getElementById('confirmation-title'),
        confirmationMessage: document.getElementById('confirmation-message'),
        confirmationConfirmBtn: document.getElementById('confirmation-confirm-btn'),
        confirmationCancelBtn: document.getElementById('confirmation-cancel-btn'),
        
        suspendUserModal: document.getElementById('suspend-user-modal'),
        suspendUserForm: document.getElementById('suspend-user-form'),
        suspendUserIdInput: document.getElementById('suspend-user-id'),
        suspendDurationSelect: document.getElementById('suspend-duration'),
        suspendCancelBtn: document.getElementById('suspend-cancel-btn'),

        userProfileModal: document.getElementById('user-profile-modal'),
        closeUserProfileModalBtn: document.getElementById('close-user-profile-modal'),
        userProfileModalContent: document.getElementById('user-profile-modal-content'),

        productModal: document.getElementById('product-modal'),
        productModalTitle: document.getElementById('product-modal-title'),
        closeProductModalBtn: document.getElementById('close-product-modal'),
        productForm: document.getElementById('product-form'),
        productId: document.getElementById('product-id'),
        saveProductBtn: document.getElementById('save-product-btn'),
    });

    // --- Authorization Check ---
    const checkAdminStatus = async () => {
        if (!user) {
            adminContent.innerHTML = '<p class="text-center text-red-500 p-8">You must be logged in to view this page.</p>';
            return false;
        }
        try {
            const idTokenResult = await user.getIdTokenResult(true);
            if (idTokenResult.claims.admin) {
                return true;
            } else {
                adminContent.innerHTML = '<p class="text-center text-red-500 p-8">Access Denied. You do not have administrator privileges.</p>';
                return false;
            }
        } catch (error) {
            console.error("Error verifying admin status:", error);
            adminContent.innerHTML = `<p class="text-center text-red-500 p-8">An error occurred while verifying your permissions: ${error.message}</p>`;
            return false;
        }
    };

    // --- Main Admin Panel HTML Structure ---
    const renderAdminLayout = () => {
        adminContent.innerHTML = `
            <div class="mb-6 border-b border-gray-200 dark:border-gray-700">
                <nav id="admin-tabs" class="flex flex-wrap -mb-px space-x-6" aria-label="Tabs">
                    <button data-tab="dashboard" class="admin-tab whitespace-nowrap py-4 px-1 border-b-2 font-medium text-lg text-blue-600 border-blue-600"><i class="fas fa-chart-line mr-2"></i>Dashboard</button>
                    <button data-tab="users" class="admin-tab whitespace-nowrap py-4 px-1 border-b-2 font-medium text-lg text-gray-500 hover:text-gray-700 hover:border-gray-300"><i class="fas fa-users mr-2"></i>Users</button>
                    <button data-tab="content" class="admin-tab whitespace-nowrap py-4 px-1 border-b-2 font-medium text-lg text-gray-500 hover:text-gray-700 hover:border-gray-300"><i class="fas fa-file-alt mr-2"></i>Content</button>
                    <button data-tab="platform" class="admin-tab whitespace-nowrap py-4 px-1 border-b-2 font-medium text-lg text-gray-500 hover:text-gray-700 hover:border-gray-300"><i class="fas fa-cogs mr-2"></i>Platform</button>
                    <button data-tab="products" class="admin-tab whitespace-nowrap py-4 px-1 border-b-2 font-medium text-lg text-gray-500 hover:text-gray-700 hover:border-gray-300"><i class="fas fa-shopping-cart mr-2"></i>Products</button>
                </nav>
            </div>
            <div>
                <div id="tab-content-dashboard" class="admin-tab-content"></div>
                <div id="tab-content-users" class="admin-tab-content hidden"></div>
                <div id="tab-content-content" class="admin-tab-content hidden"></div>
                <div id="tab-content-platform" class="admin-tab-content hidden"></div>
                <div id="tab-content-products" class="admin-tab-content hidden"></div>
            </div>`;
        renderDashboardTab();
        renderUsersTab();
        renderContentTab();
        renderPlatformTab();
        renderProductsTab();
    };

    // --- Tab Rendering Functions ---
    const renderDashboardTab = () => {
        const container = document.getElementById('tab-content-dashboard');
        container.innerHTML = `<h2 class="text-2xl font-bold mb-4">Dashboard</h2><p>Welcome to the admin dashboard.</p><div id="analytics-container" class="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4"></div>`;
        loadAnalytics();
    };

    const renderUsersTab = () => {
        document.getElementById('tab-content-users').innerHTML = `<h2 class="text-2xl font-bold mb-4">User Management</h2><div class="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow"><table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700"><thead class="bg-gray-50 dark:bg-gray-700"><tr><th class="p-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">User</th><th class="p-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Email</th><th class="p-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Joined</th><th class="p-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Status</th><th class="p-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Actions</th></tr></thead><tbody id="users-table-body" class="divide-y divide-gray-200 dark:divide-gray-700"></tbody></table></div>`;
    };

    const renderContentTab = () => {
         document.getElementById('tab-content-content').innerHTML = `<h2 class="text-2xl font-bold mb-4">Content Moderation</h2><div class="space-y-6"><div><h3 class="text-xl font-semibold mb-2">Manage Articles</h3><div class="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow"><table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700"><thead class="bg-gray-50 dark:bg-gray-700"><tr><th class="p-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Title</th><th class="p-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Author</th><th class="p-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Created</th><th class="p-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Actions</th></tr></thead><tbody id="articles-table-body" class="divide-y divide-gray-200 dark:divide-gray-700"></tbody></table></div></div></div>`;
    };

    const renderPlatformTab = () => {
        document.getElementById('tab-content-platform').innerHTML = `<h2 class="text-2xl font-bold mb-4">Platform Management</h2><div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6"><h3 class="text-xl font-semibold mb-2">Broadcast Message</h3><p class="text-gray-600 dark:text-gray-400 mb-4">Send a notification to all users.</p><form id="broadcast-form" class="space-y-4"><div><label for="broadcast-message" class="block text-sm font-medium">Message</label><textarea id="broadcast-message" required rows="4" class="mt-1 block w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"></textarea></div><div class="text-right"><button type="submit" class="px-6 py-2 bg-blue-600 text-white font-semibold rounded-full hover:bg-blue-700">Send Broadcast</button></div></form></div>`;
    };

    const renderProductsTab = () => {
        document.getElementById('tab-content-products').innerHTML = `<div class="flex justify-between items-center mb-4"><h2 class="text-2xl font-bold">Product Management</h2><button id="add-product-btn" class="px-4 py-2 bg-green-600 text-white font-semibold rounded-full hover:bg-green-700"><i class="fas fa-plus mr-2"></i>Add New Product</button></div><div class="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow"><table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700"><thead class="bg-gray-50 dark:bg-gray-700"><tr><th class="p-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Product</th><th class="p-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Price</th><th class="p-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Stock</th><th class="p-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Actions</th></tr></thead><tbody id="products-table-body" class="divide-y divide-gray-200 dark:divide-gray-700"></tbody></table></div>`;
    };

    // --- Data Loading and Rendering ---
    const loadAnalytics = async () => {
        const container = document.getElementById('analytics-container');
        container.innerHTML = '<p>Loading analytics...</p>';
        try {
            const userSnap = await db.collection('users').get();
            const articleSnap = await db.collection('articles').get();
            const productSnap = await db.collection('products').get();
            container.innerHTML = `
                <div class="p-4 bg-white dark:bg-gray-800 rounded-lg shadow"><h4 class="font-bold text-lg">${userSnap.size}</h4><p class="text-gray-500">Total Users</p></div>
                <div class="p-4 bg-white dark:bg-gray-800 rounded-lg shadow"><h4 class="font-bold text-lg">${articleSnap.size}</h4><p class="text-gray-500">Total Articles</p></div>
                <div class="p-4 bg-white dark:bg-gray-800 rounded-lg shadow"><h4 class="font-bold text-lg">${productSnap.size}</h4><p class="text-gray-500">Total Products</p></div>`;
        } catch (e) {
            console.error("Error loading analytics:", e);
            container.innerHTML = `<p class="text-red-500 col-span-3">Could not load analytics. See console for details.</p>`;
        }
    };

    const loadUsers = async () => {
        const tableBody = document.getElementById('users-table-body');
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center p-4">Loading users...</td></tr>';
        try {
            const snapshot = await db.collection('users').get();
            currentUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            currentUsers.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
            renderUsers();
        } catch (error) {
            console.error("Error loading users:", error);
            tableBody.innerHTML = '<tr><td colspan="5" class="text-center p-4 text-red-500">Could not load users.</td></tr>';
        }
    };

    const renderUsers = () => {
        const tableBody = document.getElementById('users-table-body');
        if (!tableBody) return;
        tableBody.innerHTML = currentUsers.map(u => {
            let statusText, statusClass;
            const suspendedUntil = u.suspendedUntil?.toDate();
            if (u.isBanned) {
                statusText = 'Banned'; statusClass = 'bg-red-500';
            } else if (suspendedUntil && suspendedUntil > new Date()) {
                statusText = `Suspended`; statusClass = 'bg-yellow-500';
            } else {
                statusText = 'Active'; statusClass = 'bg-green-500';
            }

            return `
             <tr class="dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                 <td class="p-4 font-medium"><div class="flex items-center"><img src="${u.photoURL || 'https://placehold.co/32x32'}" class="w-8 h-8 rounded-full mr-3 object-cover"/>${u.displayName || 'No Name'}</div></td>
                 <td class="p-4">${u.email}</td>
                 <td class="p-4">${u.createdAt ? new Date(u.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}</td>
                 <td class="p-4"><span class="px-2 py-1 text-xs font-semibold text-white rounded-full ${statusClass}">${statusText}</span></td>
                 <td class="p-4 text-lg space-x-3">
                     <button class="view-user-btn text-blue-500 hover:text-blue-400" data-uid="${u.id}" title="View Full Profile"><i class="fas fa-eye"></i></button>
                     <button class="suspend-user-btn text-yellow-500 hover:text-yellow-400" data-uid="${u.id}" title="Suspend User"><i class="fas fa-clock"></i></button>
                     <button class="ban-user-btn text-red-500 hover:text-red-400" data-uid="${u.id}" data-current="${u.isBanned || false}" title="${u.isBanned ? 'Un-ban User' : 'Ban User'}"><i class="fas fa-gavel"></i></button>
                     <button class="impersonate-user-btn text-purple-500 hover:text-purple-400" data-uid="${u.id}" title="Impersonate User"><i class="fas fa-mask"></i></button>
                 </td>
             </tr>`;
        }).join('');
    };

    const loadArticles = async () => {
        const tableBody = document.getElementById('articles-table-body');
        tableBody.innerHTML = '<tr><td colspan="4" class="text-center p-4">Loading articles...</td></tr>';
        try {
            const snapshot = await db.collection('articles').orderBy('createdAt', 'desc').get();
            currentArticles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderArticles();
        } catch (error) {
            console.error("Error loading articles:", error);
            tableBody.innerHTML = '<tr><td colspan="4" class="text-center p-4 text-red-500">Could not load articles.</td></tr>';
        }
    };

    const renderArticles = () => {
        const tableBody = document.getElementById('articles-table-body');
        if (!tableBody) return;
        tableBody.innerHTML = currentArticles.map(article => `
             <tr class="dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                 <td class="p-4 font-medium">${article.title}</td><td class="p-4">${article.authorName || 'N/A'}</td>
                 <td class="p-4">${article.createdAt ? new Date(article.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}</td>
                 <td class="p-4"><button class="delete-article-btn text-red-500 hover:text-red-400" data-id="${article.id}" title="Delete Article"><i class="fas fa-trash"></i></button></td>
             </tr>`).join('');
    };

    const loadProducts = async () => {
        const tableBody = document.getElementById('products-table-body');
        tableBody.innerHTML = '<tr><td colspan="4" class="text-center p-4">Loading products...</td></tr>';
        try {
            const snapshot = await db.collection('products').get();
            currentProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            currentProducts.sort((a,b) => a.name.localeCompare(b.name));
            renderProducts();
        } catch (error) {
            console.error("Error loading products:", error);
            tableBody.innerHTML = '<tr><td colspan="4" class="text-center p-4 text-red-500">Could not load products.</td></tr>';
        }
    };
    
    const renderProducts = () => {
        const tableBody = document.getElementById('products-table-body');
        if (currentProducts.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="4" class="text-center p-4">No products found.</td></tr>';
            return;
        }
        tableBody.innerHTML = currentProducts.map(p => `
            <tr class="dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td class="p-4 font-medium">${p.name}</td><td class="p-4">$${(p.price || 0).toFixed(2)}</td><td class="p-4">${p.stock}</td>
                <td class="p-4 space-x-4">
                    <button class="edit-product-btn text-blue-500 hover:underline" data-id="${p.id}">Edit</button>
                    <button class="delete-product-btn text-red-500 hover:underline" data-id="${p.id}">Delete</button>
                </td>
            </tr>`).join('');
    };

    // --- Admin Actions ---
    const showConfirmation = (title, message, callback) => {
        const { confirmationModal, confirmationTitle, confirmationMessage } = getElements();
        confirmationTitle.textContent = title;
        confirmationMessage.textContent = message;
        confirmationModal.classList.add('flex'); confirmationModal.classList.remove('hidden');
        confirmationCallback = callback;
    };

    const userAction = async (action, payload) => {
        try {
            const cloudFunction = functions.httpsCallable(action);
            await cloudFunction(payload);
            showToast(`Action '${action}' completed successfully.`, 'success');
            loadUsers(); // Refresh user list after action
        } catch (error) {
            console.error(`Error with action ${action}:`, error);
            showToast(`Error: ${error.message}`, 'error');
        }
    };
    
    // --- Event Handlers ---
    const handleBroadcastSubmit = (e) => {
        e.preventDefault();
        const message = document.getElementById('broadcast-message').value;
        if (!message) return;
        showConfirmation('Confirm Broadcast', `Send "${message}" to ALL users?`, () => {
            userAction('broadcastMessage', { message }).then(() => e.target.reset());
        });
    };

    const handleSuspendFormSubmit = (e) => {
        e.preventDefault();
        const { suspendUserIdInput, suspendDurationSelect, suspendUserModal } = getElements();
        const uid = suspendUserIdInput.value;
        const durationHours = parseInt(suspendDurationSelect.value, 10);
        const suspendedUntil = new Date();
        suspendedUntil.setHours(suspendedUntil.getHours() + durationHours);

        showConfirmation('Confirm Suspension', `Suspend this user for ${suspendDurationSelect.options[suspendDurationSelect.selectedIndex].text}?`, 
            () => userAction('suspendUser', { uid, suspendedUntil: suspendedUntil.toISOString() }));
        
        suspendUserModal.classList.add('hidden');
        suspendUserModal.classList.remove('flex');
    };

    const handleProductFormSubmit = async (e) => {
        e.preventDefault();
        const { productForm, saveProductBtn, productModal, productId } = getElements();
        saveProductBtn.disabled = true;
        saveProductBtn.textContent = 'Saving...';

        const productData = {
            name: productForm.elements['product-name'].value,
            description: productForm.elements['product-description'].value,
            price: parseFloat(productForm.elements['product-price'].value),
            stock: parseInt(productForm.elements['product-stock'].value, 10),
            stripePriceId: productForm.elements['product-stripe-id'].value,
        };
        
        const currentId = productId.value;

        try {
            if (currentId) {
                await db.collection('products').doc(currentId).update(productData);
                showToast('Product updated successfully!', 'success');
            } else {
                await db.collection('products').add(productData);
                showToast('Product added successfully!', 'success');
            }
            productModal.classList.add('hidden');
            productModal.classList.remove('flex');
            loadProducts();
        } catch (error) {
            console.error("Error saving product:", error);
            showToast(`Error: ${error.message}`, 'error');
        } finally {
            saveProductBtn.disabled = false;
            saveProductBtn.textContent = 'Save Product';
        }
    };
    
    // --- Initialization ---
    const initializeAdminPanel = async () => {
        if (!await checkAdminStatus()) return;

        renderAdminLayout();
        loadUsers();
        
        const elements = getElements();

        // Tab switching
        document.getElementById('admin-tabs').addEventListener('click', (e) => {
            const button = e.target.closest('.admin-tab');
            if (!button) return;
            document.querySelectorAll('.admin-tab').forEach(tab => {
                tab.classList.remove('text-blue-600', 'border-blue-600');
                tab.classList.add('text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');
            });
            document.querySelectorAll('.admin-tab-content').forEach(content => content.classList.add('hidden'));
            
            button.classList.add('text-blue-600', 'border-blue-600');
            button.classList.remove('text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');
            const tabName = button.dataset.tab;
            document.getElementById(`tab-content-${tabName}`).classList.remove('hidden');

            if (tabName === 'products') loadProducts();
            if (tabName === 'content') loadArticles();
            if (tabName === 'dashboard') loadAnalytics();
        });

        // Global content click listener using event delegation
        adminContent.addEventListener('click', e => {
            const button = e.target.closest('button');
            if (!button) return;
            const uid = button.dataset.uid;

            if (button.id === 'add-product-btn') {
                elements.productForm.reset();
                elements.productId.value = '';
                elements.productModalTitle.textContent = 'Add Product';
                elements.productModal.classList.add('flex');
                elements.productModal.classList.remove('hidden');
            }
            if (button.classList.contains('view-user-btn')) {
                const user = currentUsers.find(u => u.id === uid);
                if (user) {
                    const joinedDate = user.createdAt ? new Date(user.createdAt.seconds * 1000).toLocaleString() : 'N/A';
                    const suspendedUntil = user.suspendedUntil?.toDate();
                    const suspensionInfo = suspendedUntil && suspendedUntil > new Date() ? 
                        `<p><strong>Suspended Until:</strong> ${suspendedUntil.toLocaleString()}</p>` : '';

                    elements.userProfileModalContent.innerHTML = `
                        <div class="flex flex-col md:flex-row items-start space-y-4 md:space-y-0 md:space-x-6">
                            <img src="${user.photoURL || 'https://placehold.co/128x128'}" class="w-32 h-32 rounded-full object-cover border-4 border-gray-300 dark:border-gray-600">
                            <div>
                                <h3 class="text-2xl font-bold">${user.displayName || 'No Name'}</h3>
                                <p class="text-gray-500 dark:text-gray-400">${user.email}</p>
                                <p class="mt-2"><strong>User ID:</strong> <code class="text-sm bg-gray-200 dark:bg-gray-700 p-1 rounded">${user.id}</code></p>
                                <p><strong>Joined:</strong> ${joinedDate}</p>
                                <p><strong>Banned Status:</strong> ${user.isBanned ? '<span class="text-red-500 font-bold">Banned</span>' : 'Not Banned'}</p>
                                ${suspensionInfo}
                            </div>
                        </div>`;
                    elements.userProfileModal.classList.remove('hidden');
                    elements.userProfileModal.classList.add('flex');
                }
            }
            if (button.classList.contains('suspend-user-btn')) {
                elements.suspendUserIdInput.value = uid;
                elements.suspendUserModal.classList.add('flex');
                elements.suspendUserModal.classList.remove('hidden');
            }
            if (button.classList.contains('ban-user-btn')) {
                const isBanned = button.dataset.current === 'true';
                const action = isBanned ? 'unBanUser' : 'banUser';
                const verb = isBanned ? 'Un-ban' : 'Ban';
                showConfirmation(`${verb} User?`, `Are you sure you want to permanently ${verb.toLowerCase()} this user?`, () => userAction(action, { uid }));
            }
            if (button.classList.contains('impersonate-user-btn')) {
                showConfirmation('Impersonate User?', 
                    'You will be signed out of your admin account and logged in as this user. Proceed?', 
                    async () => {
                        try {
                            const generateToken = functions.httpsCallable('generateImpersonationToken');
                            const result = await generateToken({ uid });
                            const token = result.data.token;
                            await firebase.auth().signInWithCustomToken(token);
                            window.location.href = 'app.html'; // Redirect to main app
                        } catch (error) {
                            console.error("Impersonation failed:", error);
                            showToast(`Error: ${error.message}`, 'error');
                        }
                    }
                );
            }
            if (button.classList.contains('delete-article-btn')) {
                showConfirmation('Delete Article?', 'This cannot be undone.', async () => {
                    await db.collection('articles').doc(button.dataset.id).delete();
                    showToast('Article deleted.', 'success'); loadArticles();
                });
            }
            if (button.classList.contains('edit-product-btn')) {
                const productId = button.dataset.id;
                const product = currentProducts.find(p => p.id === productId);
                if (product) {
                    elements.productForm.reset();
                    elements.productModalTitle.textContent = 'Edit Product';
                    elements.productId.value = product.id;
                    elements.productForm.elements['product-name'].value = product.name || '';
                    elements.productForm.elements['product-description'].value = product.description || '';
                    elements.productForm.elements['product-price'].value = product.price || 0;
                    elements.productForm.elements['product-stock'].value = product.stock || 0;
                    elements.productForm.elements['product-stripe-id'].value = product.stripePriceId || '';
                    elements.productModal.classList.add('flex');
                    elements.productModal.classList.remove('hidden');
                }
            }
            if (button.classList.contains('delete-product-btn')) {
                 showConfirmation('Delete Product?', 'This cannot be undone. Product images will also be deleted.', async () => {
                    await db.collection('products').doc(button.dataset.id).delete();
                    showToast('Product deleted.', 'success'); loadProducts();
                });
            }
        });
        
        // Modal and form listeners
        elements.confirmationConfirmBtn.addEventListener('click', () => {
            if (confirmationCallback) confirmationCallback();
            elements.confirmationModal.classList.add('hidden');
        });
        elements.confirmationCancelBtn.addEventListener('click', () => elements.confirmationModal.classList.add('hidden'));
        elements.suspendCancelBtn.addEventListener('click', () => elements.suspendUserModal.classList.add('hidden'));
        elements.closeProductModalBtn.addEventListener('click', () => elements.productModal.classList.add('hidden'));
        elements.closeUserProfileModalBtn.addEventListener('click', () => elements.userProfileModal.classList.add('hidden'));
        
        elements.suspendUserForm.addEventListener('submit', handleSuspendFormSubmit);
        elements.productForm.addEventListener('submit', handleProductFormSubmit);
        document.getElementById('tab-content-platform').addEventListener('submit', e => {
            if (e.target.id === 'broadcast-form') handleBroadcastSubmit(e);
        });
    };

    initializeAdminPanel();
});