/**
 * Add a container for game-specific filters
 */
document.addEventListener('DOMContentLoaded', function() {
    // Find the filters section
    const filtersSection = document.querySelector('.filters-section');
    
    if (filtersSection) {
        // Create game-specific filters container
        const gameSpecificFilters = document.createElement('div');
        gameSpecificFilters.id = 'game-specific-filters';
        
        // Find the right position to insert (after Type (Pokémon) section)
        const typeSection = document.querySelector('.filters-section > div:nth-child(4)');
        if (typeSection) {
            typeSection.insertAdjacentElement('afterend', gameSpecificFilters);
        } else {
            filtersSection.appendChild(gameSpecificFilters);
        }
    }
});
