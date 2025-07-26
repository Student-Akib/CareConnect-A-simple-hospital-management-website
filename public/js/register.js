import { setupNav } from './common/nav.js';
import { buildApiUrl } from './common/config.js';

document.addEventListener('DOMContentLoaded', () => {
    setupNav();
    const registerForm = document.getElementById('register-form');
    if (!registerForm) return;
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const messageDiv = document.getElementById('form-message');
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        if (password !== confirmPassword) {
            messageDiv.textContent = 'Passwords do not match!';
            messageDiv.className = 'message-error';
            return;
        }
        const formData = new FormData(registerForm);
        const data = Object.fromEntries(formData.entries());
        try {
            const response = await fetch(buildApiUrl('/api/auth/register'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await response.json();
            if (response.ok) {
                messageDiv.textContent = result.message || 'Registration successful!';
                messageDiv.className = 'message-success';
                setTimeout(() => { window.location.href = '/login.html'; }, 2000);
            } else {
                messageDiv.textContent = result.error || 'Registration failed';
                messageDiv.className = 'message-error';
            }
        } catch (error) {
            messageDiv.textContent = 'An unexpected error occurred.';
            messageDiv.className = 'message-error';
        }
    });
}); 