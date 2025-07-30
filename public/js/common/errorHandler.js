// Centralized error handling for the application

/**
 * Global error handler for unhandled promise rejections
 */
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    // You could send this to an error reporting service
});

/**
 * Global error handler for uncaught errors
 */
window.addEventListener('error', (event) => {
    console.error('Uncaught error:', event.error);
    // You could send this to an error reporting service
});

/**
 * Handles authentication errors consistently
 * @param {Response} response - Fetch response object
 * @param {string} context - Context where the error occurred
 */
export function handleAuthError(response, context = '') {
    if (response.status === 401) {
        // Token expired or invalid
        localStorage.removeItem('token');
        window.location.href = '/login.html';
        return { isAuthError: true, message: 'Session expired. Please login again.' };
    }
    
    if (response.status === 403) {
        return { isAuthError: true, message: 'Access denied. Please check your permissions.' };
    }
    
    return { isAuthError: false, message: `Error in ${context}: ${response.status}` };
}

/**
 * Validates API response and handles common errors
 * @param {Response} response - Fetch response object
 * @param {string} context - Context where the error occurred
 * @returns {Promise<object>} Response data or error object
 */
export async function validateApiResponse(response, context = '') {
    if (!response.ok) {
        const authError = handleAuthError(response, context);
        if (authError.isAuthError) {
            throw new Error(authError.message);
        }
        
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
        } catch (e) {
            // If we can't parse the error response, use the default message
        }
        
        throw new Error(errorMessage);
    }
    
    try {
        return await response.json();
    } catch (e) {
        throw new Error('Invalid response format from server');
    }
}

/**
 * Safe API call wrapper with error handling
 * @param {string} url - API endpoint URL
 * @param {object} options - Fetch options
 * @param {string} context - Context for error messages
 * @returns {Promise<object>} API response data
 */
export async function safeApiCall(url, options = {}, context = '') {
    try {
        const response = await fetch(url, options);
        return await validateApiResponse(response, context);
    } catch (error) {
        console.error(`API call failed in ${context}:`, error);
        throw error;
    }
}

/**
 * Retry mechanism for failed API calls
 * @param {Function} apiCall - The API call function
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} delay - Delay between retries in milliseconds
 * @returns {Promise<object>} API response data
 */
export async function retryApiCall(apiCall, maxRetries = 3, delay = 1000) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await apiCall();
        } catch (error) {
            lastError = error;
            
            if (attempt === maxRetries) {
                throw error;
            }
            
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, delay * attempt));
        }
    }
    
    throw lastError;
} 