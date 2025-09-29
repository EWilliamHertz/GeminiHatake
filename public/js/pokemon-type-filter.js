/**
 * pokemon-type-filter.js
 * Creates and manages the Pokémon type filter
 */

document.addEventListener('DOMContentLoaded', function() {
    // Create the Pokémon type filter container if it doesn't exist
    if (!document.getElementById('pokemon-type-filter')) {
        // Find the game-specific-filters container
        const gameSpecificFilters = document.getElementById('game-specific-filters');
        
        if (gameSpecificFilters) {
            // Create the Pokémon type filter
            const pokemonTypeFilter = document.createElement('div');
            pokemonTypeFilter.id = 'pokemon-type-filter';
            pokemonTypeFilter.className = 'mb-4 hidden';
            pokemonTypeFilter.innerHTML = `
                <h3 class="text-lg font-semibold mb-2">Type (Pokémon)</h3>
                <select id="type-filter" class="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600">
                    <option>All Types</option>
                    <option>Fire</option>
                    <option>Water</option>
                    <option>Grass</option>
                    <option>Electric</option>
                    <option>Psychic</option>
                    <option>Fighting</option>
                    <option>Darkness</option>
                    <option>Metal</option>
                    <option>Fairy</option>
                    <option>Dragon</option>
                    <option>Colorless</option>
                </select>
            `;
            
            // Add the filter to the container
            gameSpecificFilters.appendChild(pokemonTypeFilter);
            
            console.log('Pokémon type filter created');
        }
    }
    
    // Show/hide the Pokémon type filter based on selected games
    function updatePokemonTypeFilter() {
        const pokemonTypeFilter = document.getElementById('pokemon-type-filter');
        const pokemonCheckbox = document.querySelector('input[data-game="pokemon"]');
        
        if (pokemonTypeFilter && pokemonCheckbox) {
            if (pokemonCheckbox.checked) {
                pokemonTypeFilter.classList.remove('hidden');
            } else {
                pokemonTypeFilter.classList.add('hidden');
            }
        }
    }
    
    // Add event listener to Pokémon checkbox
    const pokemonCheckbox = document.querySelector('input[data-game="pokemon"]');
    if (pokemonCheckbox) {
        pokemonCheckbox.addEventListener('change', updatePokemonTypeFilter);
        
        // Initialize filter visibility
        updatePokemonTypeFilter();
    }
});
