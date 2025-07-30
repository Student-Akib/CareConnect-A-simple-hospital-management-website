// Common utility functions for the application

/**
 * Shows a loading state on a button
 * @param {HTMLElement} button - The button element
 * @param {string} loadingText - Text to show while loading
 * @returns {string} Original button text
 */
export function showButtonLoading(button, loadingText = 'Loading...') {
    const originalText = button.textContent;
    button.textContent = loadingText;
    button.disabled = true;
    return originalText;
}

/**
 * Resets a button to its original state
 * @param {HTMLElement} button - The button element
 * @param {string} originalText - Original button text
 */
export function resetButton(button, originalText) {
    button.textContent = originalText;
    button.disabled = false;
}

/**
 * Shows a message to the user
 * @param {HTMLElement} messageElement - The message container element
 * @param {string} message - Message text
 * @param {string} type - Message type ('success', 'error', 'info')
 */
export function showMessage(messageElement, message, type = 'info') {
    messageElement.textContent = message;
    messageElement.className = `message-${type}`;
}

/**
 * Clears a message element
 * @param {HTMLElement} messageElement - The message container element
 */
export function clearMessage(messageElement) {
    messageElement.textContent = '';
    messageElement.className = '';
}

/**
 * Validates email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid email
 */
export function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Validates username format
 * @param {string} username - Username to validate
 * @returns {object} Validation result with isValid and error properties
 */
export function validateUsername(username) {
    if (!username || username.trim().length === 0) {
        return { isValid: false, error: 'Username is required' };
    }
    
    if (username.includes(' ')) {
        return { isValid: false, error: 'Username cannot contain spaces' };
    }
    
    if (username.length < 3 || username.length > 20) {
        return { isValid: false, error: 'Username must be between 3 and 20 characters long' };
    }
    
    return { isValid: true, error: null };
}

/**
 * Handles API errors consistently
 * @param {Error} error - The error object
 * @param {HTMLElement} messageElement - Message container element
 */
export function handleApiError(error, messageElement) {
    console.error('API Error:', error);
    
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
        showMessage(messageElement, 'Network error. Please check your connection and try again.', 'error');
    } else {
        showMessage(messageElement, 'An unexpected error occurred. Please try again.', 'error');
    }
} 