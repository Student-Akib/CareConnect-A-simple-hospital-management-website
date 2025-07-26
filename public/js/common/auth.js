// Authentication helpers
export function getToken() {
    return localStorage.getItem('token');
}

export function isLoggedIn() {
    return !!getToken();
} 