window.CardSearch = (() => {
    const searchBtn = document.getElementById('search-card-versions-btn');
    const searchInput = document.getElementById('manual-card-name');
    const gameSelect = document.getElementById('manual-game-select');
    const resultsModal = document.getElementById('search-results-modal');
    const resultsContainer = document.getElementById('manual-add-results');
    const closeResultsBtn = document.getElementById('close-search-results-modal');

    function initialize() {
        searchBtn?.addEventListener('click', performSearch);
        searchInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                performSearch();
            }
        });
        closeResultsBtn?.addEventListener('click', () => resultsModal.classList.add('hidden'));
    }

    async function performSearch() {
        const cardName = searchInput.value.trim();
        const game = gameSelect.value;
        if (!cardName) {
            window.Utils.showNotification('Please enter a card name.', 'info');
            return;
        }

        resultsContainer.innerHTML = `<p class="text-center text-gray-500 dark:text-gray-400 p-4">Searching...</p>`;
        resultsModal.classList.remove('hidden');

        try {
            let results = [];
            if (game === 'magic') {
                results = await window.Api.searchMagicCards(cardName);
            } else {
                results = await window.Api.searchPokemonCards(cardName);
            }
            renderResults(results);
        } catch (error) {
            resultsContainer.innerHTML = `<p class="text-center text-red-500 p-4">Search failed. Please try again.</p>`;
            console.error("Search failed:", error);
        }
    }

    function renderResults(cards) {
        resultsContainer.innerHTML = '';
        if (!cards || cards.length === 0) {
            resultsContainer.innerHTML = `<p class="text-center text-gray-500 dark:text-gray-400 p-4">No results found.</p>`;
            return;
        }
        cards.forEach(card => {
            const resultEl = document.createElement('div');
            resultEl.className = 'flex items-center p-3 border-b dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 group relative';
            
            const price = card.priceUsd;

            resultEl.innerHTML = `
                <img src="${window.CardDisplay.getCardImageUrl(card, 'small')}" class="w-12 h-16 object-cover rounded-sm mr-4 shadow-sm">
                <div class="flex-grow">
                    <p class="font-semibold">${card.name}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">${card.setName || card.set_name} (#${card.collector_number})</p>
                    ${price ? `<p class="text-xs font-bold text-green-600 dark:text-green-400 mt-1">${window.Utils.safeFormatPrice(price)}</p>` : ''}
                </div>
                <button class="add-card-from-search text-blue-600 dark:text-blue-400 p-2"><i class="fas fa-plus-circle text-2xl"></i></button>`;
            
            resultEl.querySelector('.add-card-from-search').addEventListener('click', (e) => {
                e.stopPropagation();
                resultsModal.classList.add('hidden');
                window.CardModal.openCardManagementModal(card); 
            });

            let previewImg = null;
            resultEl.addEventListener('mousemove', (e) => {
                if (!previewImg) return;
                previewImg.style.left = `${e.clientX + 25}px`;
                previewImg.style.top = `${e.clientY - 125}px`;
            });
            resultEl.addEventListener('mouseenter', () => {
                if (previewImg) return;
                previewImg = document.createElement('img');
                previewImg.id = 'card-hover-preview';
                previewImg.src = window.CardDisplay.getCardImageUrl(card, 'large');
                previewImg.style.width = '240px';
                previewImg.style.zIndex = '1003'; 
                document.body.appendChild(previewImg);
                setTimeout(() => {
                    if(previewImg) {
                        previewImg.style.transform = 'scale(1)';
                        previewImg.style.opacity = '1';
                    }
                }, 10);
            });
            resultEl.addEventListener('mouseleave', () => {
                if (previewImg) {
                    previewImg.remove();
                    previewImg = null;
                }
            });

            resultsContainer.appendChild(resultEl);
        });
    }

    return { initialize };
})();

