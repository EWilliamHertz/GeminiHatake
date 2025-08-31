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
    const pageTitle = document.getElementById('page-title');
    const filters = document.getElementById('filters');

    const params = new URLSearchParams(window.location.search);
    const pageType = params.get('type') || 'tcg'; // Default to tcg

    if (pageType === 'blog') {
        if(pageTitle) pageTitle.textContent = 'Hatake Blog';
        if(filters) filters.style.display = 'none'; // Hide filters for blog
    } else {
        if(pageTitle) pageTitle.textContent = 'TCG Articles';
    }

    if (user) {
        if(writeNewArticleBtn) writeNewArticleBtn.classList.remove('hidden');
    }

    let allArticles = [];

    const loadArticles = async () => {
        if(!articlesListContainer) return;
        articlesListContainer.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 col-span-full">Loading posts...</p>';
        try {
            let query = db.collection('articles').where('status', '==', 'published');
            if (pageType === 'blog') {
                query = query.where('type', '==', 'blog_post');
            } else {
                query = query.where('type', '==', 'tcg_article');
            }
            const snapshot = await query.orderBy('createdAt', 'desc').get();

            if (snapshot.empty) {
                articlesListContainer.innerHTML = `<p class="text-center text-gray-500 dark:text-gray-400 col-span-full">No ${pageType === 'blog' ? 'blog posts' : 'articles'} published yet.</p>`;
                return;
            }
            allArticles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderArticles(allArticles);
        } catch (error) {
            console.error("Error loading articles:", error);
            articlesListContainer.innerHTML = '<p class="text-center text-red-500 col-span-full">Could not load posts.</p>';
        }
    };

    const renderArticles = (articles) => {
        if(!articlesListContainer) return;
        articlesListContainer.innerHTML = '';
        articles.forEach(article => {
            const articleCard = document.createElement('a');
            articleCard.href = `view-article.html?id=${article.id}`;
            articleCard.className = 'block bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md hover:shadow-xl transition-shadow';
            
            const snippet = article.content.substring(0, 150).replace(/<[^>]+>/g, '') + '...';

            articleCard.innerHTML = `
                <span class="text-sm font-semibold text-blue-600 dark:text-blue-400">${article.category || 'Blog Post'}</span>
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

    if(searchInput) searchInput.addEventListener('input', filterAndSearchArticles);
    if(categoryFilter) categoryFilter.addEventListener('change', filterAndSearchArticles);

    loadArticles();
}

// --- Create Article Page ---
function initCreateArticlePage(user) {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    user.getIdTokenResult().then((idTokenResult) => {
        if (!idTokenResult.claims.admin && !idTokenResult.claims.contentCreator) {
            // window.location.href = 'app.html';
        }
    });
    
    const form = document.getElementById('create-article-form');
    const articleTypeSelect = document.getElementById('article-type');
    const tcgCategorySection = document.getElementById('tcg-category-section');
    const deckPrimerInfo = document.getElementById('deck-primer-info');
    const deckNameDisplay = document.getElementById('deck-name-display');
    const articleCategorySelect = document.getElementById('article-category');
    const articleDeckIdInput = document.getElementById('article-deck-id');

    // Define the custom image handler
    function imageHandler() {
        const input = document.createElement('input');
        input.setAttribute('type', 'file');
        input.setAttribute('accept', 'image/*');
        input.click();

        input.onchange = async () => {
            const file = input.files[0];
            if (file) {
                const range = this.quill.getSelection(true);
                this.quill.insertText(range.index, ' [Uploading image...] ', 'user');
                
                try {
                    const storageRef = storage.ref();
                    const imageRef = storageRef.child(`articles/${user.uid}/${Date.now()}_${file.name}`);
                    const snapshot = await imageRef.put(file);
                    const downloadURL = await snapshot.ref.getDownloadURL();

                    this.quill.deleteText(range.index, ' [Uploading image...] '.length);
                    this.quill.insertEmbed(range.index, 'image', downloadURL);
                    this.quill.setSelection(range.index + 1);
                } catch (error) {
                    console.error("Image upload failed: ", error);
                    this.quill.deleteText(range.index, ' [Uploading image...] '.length);
                    alert("Image upload failed. Please try again.");
                }
            }
        };
    }

    // Define the full toolbar options
    const toolbarOptions = [
        [{ 'font': [] }],
        [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
        [{ 'size': ['small', false, 'large', 'huge'] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'color': [] }, { 'background': [] }],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        [{ 'indent': '-1'}, { 'indent': '+1' }],
        [{ 'align': [] }],
        ['link', 'image', 'video'],
        ['clean']
    ];

    const quill = new Quill('#editor', {
        modules: {
            toolbar: {
                container: toolbarOptions,
                handlers: {
                    'image': imageHandler
                }
            }
        },
        theme: 'snow',
        placeholder: 'Write your masterpiece...',
    });

    if(articleTypeSelect) {
        articleTypeSelect.addEventListener('change', () => {
            if (articleTypeSelect.value === 'blog_post') {
                if(tcgCategorySection) tcgCategorySection.style.display = 'none';
            } else {
                if(tcgCategorySection) tcgCategorySection.style.display = 'block';
            }
        });
    }


    const params = new URLSearchParams(window.location.search);
    const deckId = params.get('deckId');
    const deckName = params.get('deckName');

    if (deckId && deckName) {
        if(articleTypeSelect) articleTypeSelect.value = 'tcg_article';
        if(articleCategorySelect) articleCategorySelect.value = 'Deck Primer';
        if(articleCategorySelect) articleCategorySelect.disabled = true;
        if(articleDeckIdInput) articleDeckIdInput.value = deckId;
        if(deckNameDisplay) deckNameDisplay.textContent = decodeURIComponent(deckName);
        if(deckPrimerInfo) deckPrimerInfo.classList.remove('hidden');
    }

    if(form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const title = document.getElementById('article-title').value;
            const type = articleTypeSelect.value;
            const category = (type === 'tcg_article') ? articleCategorySelect.value : 'Blog Post';
            const content = quill.root.innerHTML;

            if (!title.trim() || quill.getLength() < 10) {
                alert('Please provide a title and some content for your post.');
                return;
            }

            const articleData = {
                title,
                type,
                category,
                content,
                authorId: user.uid,
                authorName: user.displayName,
                status: 'published',
                createdAt: new Date(),
                deckId: articleDeckIdInput.value || null
            };

            try {
                const docRef = await db.collection('articles').add(articleData);
                alert('Post published successfully!');
                window.location.href = `view-article.html?id=${docRef.id}`;
            } catch (error) {
                console.error("Error publishing post:", error);
                alert('Failed to publish post.');
            }
        });
    }
}

// --- View Article Page ---
function initViewArticlePage(user) {
    const articleContainer = document.getElementById('article-container');
    const params = new URLSearchParams(window.location.search);
    const articleId = params.get('id');

    if (!articleId) {
        if(articleContainer) articleContainer.innerHTML = '<p class="text-center text-red-500">Post not found.</p>';
        return;
    }

    const loadArticle = async () => {
        try {
            const doc = await db.collection('articles').doc(articleId).get();
            if (!doc.exists) {
                if(articleContainer) articleContainer.innerHTML = '<p class="text-center text-red-500">Post not found.</p>';
                return;
            }
            const article = doc.data();

            if(articleContainer) {
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
            }
        } catch (error) {
            console.error("Error loading article:", error);
            if(articleContainer) articleContainer.innerHTML = '<p class="text-center text-red-500">Could not load article.</p>';
        }
    };

    loadArticle();
}