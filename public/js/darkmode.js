/**
 * darkmode.js
 * Handles the dark mode toggle functionality.
 */
document.addEventListener('DOMContentLoaded', () => {
    const userActionsContainer = document.getElementById('user-actions');
    if (!userActionsContainer) return;

    // Create the toggle button
    const toggleButton = document.createElement('button');
    toggleButton.id = 'dark-mode-toggle';
    toggleButton.className = 'text-gray-600 dark:text-gray-300 hover:text-blue-500 dark:hover:text-blue-400 text-xl';
    toggleButton.innerHTML = `<i class="fas fa-moon"></i>`;
    
    // Prepend to user-actions to appear on the left of other items
    userActionsContainer.prepend(toggleButton);

    const themeIcon = toggleButton.querySelector('i');

    const applyTheme = (theme) => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
            themeIcon.classList.remove('fa-moon');
            themeIcon.classList.add('fa-sun');
        } else {
            document.documentElement.classList.remove('dark');
            themeIcon.classList.remove('fa-sun');
            themeIcon.classList.add('fa-moon');
        }
    };

    // Check for saved theme in localStorage
    const savedTheme = localStorage.getItem('theme');
    // Check for system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    // Apply saved theme, or system preference, or default to light
    const currentTheme = savedTheme || (prefersDark ? 'dark' : 'light');
    applyTheme(currentTheme);

    // Add click event listener to the toggle button
    toggleButton.addEventListener('click', () => {
        const isDarkMode = document.documentElement.classList.contains('dark');
        if (isDarkMode) {
            localStorage.setItem('theme', 'light');
            applyTheme('light');
        } else {
            localStorage.setItem('theme', 'dark');
            applyTheme('dark');
        }
    });

    // Listen for changes in system preference
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
        // Only apply system preference if no theme is explicitly saved by the user
        if (!localStorage.getItem('theme')) {
            applyTheme(e.matches ? 'dark' : 'light');
        }
    });
});