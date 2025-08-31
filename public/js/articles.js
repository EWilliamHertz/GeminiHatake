/**
 * HatakeSocial - Articles & Content Script
 *
 * This script handles creating, viewing, and listing articles.
 */
document.addEventListener('authReady', (e) => {
    const user = e.detail.user;

    // --- Page specific logic ---
    if (document.getElementById('articles-list')) {
        initArticlesListPage(user);
    }
    if (document.getElementById('create-article-form')) {
        initCreateArticlePage(user);
    }
    if (document.getElementById('article-container')) {
        initViewArticlePage(user);
    }
});

// --- Articles List Page ---
function initArticlesListPage(user) {
    const articlesListContainer = document.getElementById('articles-list');
    const writeNewArticleBtn = document.getElementById('write-new-article-btn');
    const searchInput = document.getElementById('article-search');
    const categoryFilter = document.getElementById('article-category-filter');

    if (user) {
        writeNewArticleBtn.classList.remove('hidden');
    }

    let allArticles = [];

    const loadArticles = async () => {
        articlesListContainer.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 col-span-full">Loading articles...</p>';
        try {
            const snapshot = await db.collection('articles').where('status', '==', 'published').orderBy('createdAt', 'desc').get();
            if (snapshot.empty) {
                articlesListContainer.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 col-span-full">No articles published yet.</p>';
                return;
            }
            allArticles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderArticles(allArticles);
        } catch (error) {
            console.error("Error loading articles:", error);
            articlesListContainer.innerHTML = '<p class="text-center text-red-500 col-span-full">Could not load articles.</p>';
        }
    };

    const renderArticles = (articles) => {
        articlesListContainer.innerHTML = '';
        articles.forEach(article => {
            const articleCard = document.createElement('a');
            articleCard.href = `view-article.html?id=${article.id}`;
            articleCard.className = 'block bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md hover:shadow-xl transition-shadow';
            
            const snippet = article.content.substring(0, 150).replace(/<[^>]+>/g, '') + '...';

            articleCard.innerHTML = `
                <span class="text-sm font-semibold text-blue-600 dark:text-blue-400">${article.category}</span>
                <h3 class="text-xl font-bold text-gray-900 dark:text-white mt-2">${article.title}</h3>
                <p class="text-gray-600 dark:text-gray-400 mt-2 text-sm">${snippet}</p>
                <div class="mt-4 pt-4 border-t dark:border-gray-700 flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
                    <span>By ${article.authorName}</span>
                    <span>${new Date(article.createdAt.seconds * 1000).toLocaleDateString()}</span>
                </div>
            `;
            articlesListContainer.appendChild(articleCard);
        });
    };
    
    const filterAndSearchArticles = () => {
        const searchTerm = searchInput.value.toLowerCase();
        const category = categoryFilter.value;
        
        let filteredArticles = allArticles;

        if (category) {
            filteredArticles = filteredArticles.filter(a => a.category === category);
        }

        if (searchTerm) {
            filteredArticles = filteredArticles.filter(a => 
                a.title.toLowerCase().includes(searchTerm) || 
                a.content.toLowerCase().includes(searchTerm)
            );
        }
        
        renderArticles(filteredArticles);
    };

    searchInput.addEventListener('input', filterAndSearchArticles);
    categoryFilter.addEventListener('change', filterAndSearchArticles);

    loadArticles();
}

// --- Create Article Page ---
function initCreateArticlePage(user) {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }
    
    const form = document.getElementById('create-article-form');
    const deckPrimerInfo = document.getElementById('deck-primer-info');
    const deckNameDisplay = document.getElementById('deck-name-display');
    const articleCategorySelect = document.getElementById('article-category');
    const articleDeckIdInput = document.getElementById('article-deck-id');

    const quill = new Quill('#editor', {
        theme: 'snow',
        placeholder: 'Write your masterpiece...',
    });

    const params = new URLSearchParams(window.location.search);
    const deckId = params.get('deckId');
    const deckName = params.get('deckName');

    if (deckId && deckName) {
        articleCategorySelect.value = 'Deck Primer';
        articleCategorySelect.disabled = true;
        articleDeckIdInput.value = deckId;
        deckNameDisplay.textContent = decodeURIComponent(deckName);
        deckPrimerInfo.classList.remove('hidden');
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('article-title').value;
        const category = articleCategorySelect.value;
        const content = quill.root.innerHTML;

        if (!title.trim() || quill.getLength() < 10) {
            alert('Please provide a title and some content for your article.');
            return;
        }

        const articleData = {
            title,
            category,
            content,
            authorId: user.uid,
            authorName: user.displayName,
            status: 'published', // In a real app, this might be 'pending_review'
            createdAt: new Date(),
            deckId: articleDeckIdInput.value || null
        };

        try {
            const docRef = await db.collection('articles').add(articleData);
            alert('Article published successfully!');
            window.location.href = `view-article.html?id=${docRef.id}`;
        } catch (error) {
            console.error("Error publishing article:", error);
            alert('Failed to publish article.');
        }
    });
}

// --- View Article Page ---
function initViewArticlePage(user) {
    const articleContainer = document.getElementById('article-container');
    const params = new URLSearchParams(window.location.search);
    const articleId = params.get('id');

    if (!articleId) {
        articleContainer.innerHTML = '<p class="text-center text-red-500">Article not found.</p>';
        return;
    }

    const loadArticle = async () => {
        try {
            const doc = await db.collection('articles').doc(articleId).get();
            if (!doc.exists) {
                articleContainer.innerHTML = '<p class="text-center text-red-500">Article not found.</p>';
                return;
            }
            const article = doc.data();

            articleContainer.innerHTML = `
                <h1 class="text-4xl font-extrabold text-gray-900 dark:text-white mb-2">${article.title}</h1>
                <div class="text-sm text-gray-500 dark:text-gray-400 mb-6">
                    <span>By <a href="profile.html?uid=${article.authorId}" class="text-blue-600 hover:underline">${article.authorName}</a></span>
                    <span class="mx-2">&bull;</span>
                    <span>Published on ${new Date(article.createdAt.seconds * 1000).toLocaleDateString()}</span>
                    <span class="mx-2">&bull;</span>
                    <span class="font-semibold">${article.category}</span>
                </div>
                <div class="prose dark:prose-invert max-w-none ql-snow">
                    <div class="ql-editor">
                        ${article.content}
                    </div>
                </div>
            `;
        } catch (error) {
            console.error("Error loading article:", error);
            articleContainer.innerHTML = '<p class="text-center text-red-500">Could not load article.</p>';
        }
    };

    loadArticle();
}
