// API Configuration
export const API_BASE_URL = 'http://localhost:3000/api';

// Helper function to build API URLs
export function buildApiUrl(endpoint) {
    return `${API_BASE_URL}${endpoint}`;
} 