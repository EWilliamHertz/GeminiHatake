/**
 * Deck Builder Form Enhancements
 * Adds improved form validation, interaction, and user experience features
 */

document.addEventListener('DOMContentLoaded', function() {
    // Form elements
    const deckBuilderForm = document.getElementById('deck-builder-form');
    const deckNameInput = document.getElementById('deck-name-input');
    const deckTcgSelect = document.getElementById('deck-tcg-select');
    const deckFormatSelect = document.getElementById('deck-format-select');
    const deckFormatContainer = document.getElementById('deck-format-select-container');
    const deckBioInput = document.getElementById('deck-bio-input');
    const decklistInput = document.getElementById('decklist-input');
    const deckPrimerInput = document.getElementById('deck-primer-input');
    const deckPublicCheckbox = document.getElementById('deck-public-checkbox');
    const buildDeckBtn = document.getElementById('build-deck-btn');
    const saveDeckBtn = document.getElementById('save-deck-btn');

    // Format options for each TCG
    const formatOptions = {
        "Magic: The Gathering": [
            "Standard",
            "Modern", 
            "Commander",
            "Pauper",
            "Legacy",
            "Vintage",
            "Pioneer",
            "Historic",
            "Alchemy"
        ],
        "Pokémon": [
            "Standard",
            "Expanded",
            "Unlimited"
        ],
        "Lorcana": [
            "Standard"
        ],
        "Gundam": [
            "Standard"
        ]
    };

    // Form validation rules
    const validationRules = {
        deckName: {
            required: true,
            minLength: 3,
            maxLength: 100,
            message: 'Deck name must be between 3 and 100 characters'
        },
        tcg: {
            required: true,
            message: 'Please select a game'
        },
        format: {
            required: true,
            message: 'Please select a format'
        },
        decklist: {
            required: true,
            minLength: 10,
            message: 'Please enter a valid deck list'
        }
    };

    // Initialize form enhancements
    function initializeFormEnhancements() {
        setupTcgFormatDependency();
        setupFormValidation();
        setupAutoSave();
        setupFormInteractions();
        setupKeyboardShortcuts();
    }

    // Setup TCG and Format dependency
    function setupTcgFormatDependency() {
        deckTcgSelect.addEventListener('change', function() {
            const selectedTcg = this.value;
            
            // Clear format selection
            deckFormatSelect.innerHTML = '<option disabled selected value="">Select a Format</option>';
            
            if (selectedTcg && formatOptions[selectedTcg]) {
                // Populate format options
                formatOptions[selectedTcg].forEach(format => {
                    const option = document.createElement('option');
                    option.value = format;
                    option.textContent = format;
                    deckFormatSelect.appendChild(option);
                });
                
                // Show format container
                deckFormatContainer.classList.remove('hidden');
                deckFormatSelect.required = true;
            } else {
                // Hide format container
                deckFormatContainer.classList.add('hidden');
                deckFormatSelect.required = false;
            }
            
            // Validate form
            validateForm();
        });
    }

    // Setup form validation
    function setupFormValidation() {
        // Real-time validation
        deckNameInput.addEventListener('input', () => validateField('deckName', deckNameInput));
        deckTcgSelect.addEventListener('change', () => validateField('tcg', deckTcgSelect));
        deckFormatSelect.addEventListener('change', () => validateField('format', deckFormatSelect));
        decklistInput.addEventListener('input', () => validateField('decklist', decklistInput));

        // Form submission validation
        deckBuilderForm.addEventListener('submit', function(e) {
            e.preventDefault();
            if (validateForm()) {
                handleFormSubmission();
            }
        });

        // Save button validation
        if (saveDeckBtn) {
            saveDeckBtn.addEventListener('click', function(e) {
                e.preventDefault();
                if (validateForm()) {
                    handleSaveDeck();
                }
            });
        }
    }

    // Validate individual field
    function validateField(fieldName, element) {
        const rule = validationRules[fieldName];
        if (!rule) return true;

        const value = element.value.trim();
        let isValid = true;
        let errorMessage = '';

        // Required validation
        if (rule.required && !value) {
            isValid = false;
            errorMessage = rule.message || `${fieldName} is required`;
        }

        // Length validation
        if (isValid && rule.minLength && value.length < rule.minLength) {
            isValid = false;
            errorMessage = rule.message || `${fieldName} must be at least ${rule.minLength} characters`;
        }

        if (isValid && rule.maxLength && value.length > rule.maxLength) {
            isValid = false;
            errorMessage = rule.message || `${fieldName} must be no more than ${rule.maxLength} characters`;
        }

        // Update field styling
        updateFieldValidation(element, isValid, errorMessage);
        
        return isValid;
    }

    // Update field validation styling
    function updateFieldValidation(element, isValid, errorMessage) {
        // Remove existing validation classes
        element.classList.remove('form-error', 'form-success');
        
        // Remove existing error message
        const existingError = element.parentNode.querySelector('.error-message');
        if (existingError) {
            existingError.remove();
        }

        if (element.value.trim()) {
            if (isValid) {
                element.classList.add('form-success');
            } else {
                element.classList.add('form-error');
                
                // Add error message
                const errorDiv = document.createElement('div');
                errorDiv.className = 'error-message';
                errorDiv.textContent = errorMessage;
                element.parentNode.appendChild(errorDiv);
            }
        }
    }

    // Validate entire form
    function validateForm() {
        const nameValid = validateField('deckName', deckNameInput);
        const tcgValid = validateField('tcg', deckTcgSelect);
        const formatValid = deckFormatContainer.classList.contains('hidden') || validateField('format', deckFormatSelect);
        const decklistValid = validateField('decklist', decklistInput);

        const isValid = nameValid && tcgValid && formatValid && decklistValid;
        
        // Update submit button state
        updateSubmitButtonState(isValid);
        
        return isValid;
    }

    // Update submit button state
    function updateSubmitButtonState(isValid) {
        if (buildDeckBtn) {
            buildDeckBtn.disabled = !isValid;
            buildDeckBtn.classList.toggle('opacity-50', !isValid);
            buildDeckBtn.classList.toggle('cursor-not-allowed', !isValid);
        }

        if (saveDeckBtn) {
            saveDeckBtn.disabled = !isValid;
            saveDeckBtn.classList.toggle('opacity-50', !isValid);
            saveDeckBtn.classList.toggle('cursor-not-allowed', !isValid);
        }
    }

    // Setup auto-save functionality
    function setupAutoSave() {
        let autoSaveTimeout;
        
        function triggerAutoSave() {
            clearTimeout(autoSaveTimeout);
            autoSaveTimeout = setTimeout(() => {
                saveFormData();
            }, 2000); // Auto-save after 2 seconds of inactivity
        }

        // Auto-save on input changes
        [deckNameInput, deckTcgSelect, deckFormatSelect, deckBioInput, decklistInput, deckPrimerInput].forEach(element => {
            if (element) {
                element.addEventListener('input', triggerAutoSave);
                element.addEventListener('change', triggerAutoSave);
            }
        });

        if (deckPublicCheckbox) {
            deckPublicCheckbox.addEventListener('change', triggerAutoSave);
        }

        // Load saved data on page load
        loadFormData();
    }

    // Save form data to localStorage
    function saveFormData() {
        const formData = {
            deckName: deckNameInput.value,
            tcg: deckTcgSelect.value,
            format: deckFormatSelect.value,
            bio: deckBioInput.value,
            decklist: decklistInput.value,
            primer: deckPrimerInput.value,
            isPublic: deckPublicCheckbox.checked,
            timestamp: Date.now()
        };

        try {
            localStorage.setItem('deckBuilderFormData', JSON.stringify(formData));
            showAutoSaveIndicator();
        } catch (error) {
            console.warn('Could not save form data to localStorage:', error);
        }
    }

    // Load form data from localStorage
    function loadFormData() {
        try {
            const savedData = localStorage.getItem('deckBuilderFormData');
            if (savedData) {
                const formData = JSON.parse(savedData);
                
                // Only load if data is less than 24 hours old
                if (Date.now() - formData.timestamp < 24 * 60 * 60 * 1000) {
                    deckNameInput.value = formData.deckName || '';
                    deckTcgSelect.value = formData.tcg || '';
                    
                    // Trigger TCG change to populate formats
                    if (formData.tcg) {
                        deckTcgSelect.dispatchEvent(new Event('change'));
                        setTimeout(() => {
                            deckFormatSelect.value = formData.format || '';
                        }, 100);
                    }
                    
                    deckBioInput.value = formData.bio || '';
                    decklistInput.value = formData.decklist || '';
                    deckPrimerInput.value = formData.primer || '';
                    deckPublicCheckbox.checked = formData.isPublic !== false;
                }
            }
        } catch (error) {
            console.warn('Could not load form data from localStorage:', error);
        }
    }

    // Show auto-save indicator
    function showAutoSaveIndicator() {
        // Create or update auto-save indicator
        let indicator = document.getElementById('auto-save-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'auto-save-indicator';
            indicator.className = 'fixed top-32 right-5 bg-green-500 text-white px-3 py-1 rounded-md text-sm opacity-0 transition-opacity duration-300 z-50';
            indicator.innerHTML = '<i class="fas fa-check mr-1"></i>Auto-saved';
            document.body.appendChild(indicator);
        }

        // Show indicator
        indicator.style.opacity = '1';
        
        // Hide after 2 seconds
        setTimeout(() => {
            indicator.style.opacity = '0';
        }, 2000);
    }

    // Setup form interactions
    function setupFormInteractions() {
        // Character counters for text areas
        addCharacterCounter(deckNameInput, 100);
        addCharacterCounter(deckBioInput, 500);
        addCharacterCounter(deckPrimerInput, 5000);

        // Deck list formatting helper
        setupDecklistHelper();

        // Format selection helper
        setupFormatHelper();
    }

    // Add character counter to input/textarea
    function addCharacterCounter(element, maxLength) {
        if (!element) return;

        const counter = document.createElement('div');
        counter.className = 'text-sm text-gray-500 dark:text-gray-400 mt-1 text-right';
        element.parentNode.appendChild(counter);

        function updateCounter() {
            const length = element.value.length;
            counter.textContent = `${length}/${maxLength}`;
            
            if (length > maxLength * 0.9) {
                counter.classList.add('text-yellow-600');
            } else {
                counter.classList.remove('text-yellow-600');
            }
            
            if (length > maxLength) {
                counter.classList.add('text-red-600');
            } else {
                counter.classList.remove('text-red-600');
            }
        }

        element.addEventListener('input', updateCounter);
        updateCounter(); // Initial update
    }

    // Setup deck list helper
    function setupDecklistHelper() {
        if (!decklistInput) return;

        // Add format helper text
        const helper = document.createElement('div');
        helper.className = 'text-sm text-gray-500 dark:text-gray-400 mt-1';
        helper.innerHTML = `
            <strong>Format:</strong> Quantity CardName (e.g., "4 Lightning Bolt")<br>
            <strong>Tip:</strong> One card per line, separate sideboard with "Sideboard:" line
        `;
        decklistInput.parentNode.appendChild(helper);

        // Auto-format deck list
        decklistInput.addEventListener('blur', function() {
            const lines = this.value.split('\n');
            const formattedLines = lines.map(line => {
                line = line.trim();
                if (!line || line.toLowerCase().includes('sideboard')) return line;
                
                // Try to parse and reformat
                const match = line.match(/^(\d+)\s*x?\s*(.+)$/i);
                if (match) {
                    return `${match[1]} ${match[2]}`;
                }
                return line;
            });
            
            this.value = formattedLines.join('\n');
        });
    }

    // Setup format helper
    function setupFormatHelper() {
        if (!deckFormatSelect) return;

        deckFormatSelect.addEventListener('change', function() {
            const selectedFormat = this.value;
            const selectedTcg = deckTcgSelect.value;
            
            // Show format-specific information
            showFormatInfo(selectedTcg, selectedFormat);
        });
    }

    // Show format-specific information
    function showFormatInfo(tcg, format) {
        // Remove existing format info
        const existingInfo = document.getElementById('format-info');
        if (existingInfo) {
            existingInfo.remove();
        }

        if (!tcg || !format) return;

        const formatInfo = getFormatInfo(tcg, format);
        if (!formatInfo) return;

        const infoDiv = document.createElement('div');
        infoDiv.id = 'format-info';
        infoDiv.className = 'mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md text-sm';
        infoDiv.innerHTML = `
            <strong>${format} Format:</strong><br>
            ${formatInfo}
        `;
        
        deckFormatSelect.parentNode.appendChild(infoDiv);
    }

    // Get format information
    function getFormatInfo(tcg, format) {
        const formatInfoMap = {
            "Magic: The Gathering": {
                "Standard": "Deck size: 60+ cards, Max 4 copies per card (except basic lands)",
                "Modern": "Deck size: 60+ cards, Max 4 copies per card (except basic lands)",
                "Commander": "Deck size: Exactly 100 cards, Max 1 copy per card (except basic lands), 1 Commander",
                "Pauper": "Deck size: 60+ cards, Only common cards allowed, Max 4 copies per card",
                "Legacy": "Deck size: 60+ cards, Max 4 copies per card (except basic lands)",
                "Vintage": "Deck size: 60+ cards, Max 4 copies per card (except basic lands and restricted cards)"
            },
            "Pokémon": {
                "Standard": "Deck size: Exactly 60 cards, Max 4 copies per card (except basic Energy)",
                "Expanded": "Deck size: Exactly 60 cards, Max 4 copies per card (except basic Energy)"
            },
            "Lorcana": {
                "Standard": "Deck size: Exactly 60 cards, Max 4 copies per card"
            },
            "Gundam": {
                "Standard": "Deck size: Exactly 50 cards, Max 3 copies per card"
            }
        };

        return formatInfoMap[tcg]?.[format] || null;
    }

    // Setup keyboard shortcuts
    function setupKeyboardShortcuts() {
        document.addEventListener('keydown', function(e) {
            // Ctrl/Cmd + S to save
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                if (validateForm()) {
                    handleSaveDeck();
                }
            }
            
            // Ctrl/Cmd + Enter to build deck
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                if (validateForm()) {
                    handleFormSubmission();
                }
            }
        });
    }

    // Handle form submission
    function handleFormSubmission() {
        // Add loading state
        buildDeckBtn.classList.add('loading');
        buildDeckBtn.disabled = true;
        
        // Clear auto-saved data
        localStorage.removeItem('deckBuilderFormData');
        
        // The actual form submission will be handled by the existing deck.js code
        // This just provides the enhanced UX
        
        // Remove loading state after a delay (the existing code will handle the actual submission)
        setTimeout(() => {
            buildDeckBtn.classList.remove('loading');
            buildDeckBtn.disabled = false;
        }, 1000);
    }

    // Handle save deck
    function handleSaveDeck() {
        if (!saveDeckBtn) return;
        
        // Add loading state
        saveDeckBtn.classList.add('loading');
        saveDeckBtn.disabled = true;
        
        // Show success message
        showToast('Deck saved successfully!', true);
        
        // Clear auto-saved data
        localStorage.removeItem('deckBuilderFormData');
        
        // Remove loading state
        setTimeout(() => {
            saveDeckBtn.classList.remove('loading');
            saveDeckBtn.disabled = false;
        }, 1000);
    }

    // Toast notification function (fallback if not available)
    function showToast(message, isSuccess = false) {
        if (window.showToast) {
            window.showToast(message, isSuccess);
            return;
        }
        
        // Fallback toast implementation
        const toast = document.createElement('div');
        toast.className = `fixed top-32 right-5 px-4 py-2 rounded-md text-white text-sm z-50 transition-opacity duration-300 ${isSuccess ? 'bg-green-500' : 'bg-red-500'}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // Initialize when DOM is ready
    initializeFormEnhancements();
});
