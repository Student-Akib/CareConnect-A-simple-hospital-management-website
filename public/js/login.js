import { setupNav } from './common/nav.js';
import { buildApiUrl } from './common/config.js';

document.addEventListener('DOMContentLoaded', () => {
    setupNav();
    const loginForm = document.getElementById('login-form');
    if (!loginForm) return;
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const messageDiv = document.getElementById('form-message');
        const formData = new FormData(loginForm);
        const data = Object.fromEntries(formData.entries());
        try {
            const response = await fetch(buildApiUrl('/api/auth/login'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await response.json();
            if (response.ok) {
                localStorage.setItem('token', result.token);
                window.location.href = '/dashboard.html';
            } else {
                messageDiv.textContent = result.error || 'Login failed';
                messageDiv.className = 'message-error';
            }
        } catch (error) {
            messageDiv.textContent = 'An unexpected error occurred.';
            messageDiv.className = 'message-error';
        }
    });
}); 