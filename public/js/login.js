import { setupNav } from './common/nav.js';
import { buildApiUrl } from './common/config.js';

document.addEventListener('DOMContentLoaded', () => {
    setupNav();
    
    // Redirect to dashboard if already logged in
    const existingToken = localStorage.getItem('token');
    if (existingToken) {
        // Verify token is still valid by making a test request
        fetch(buildApiUrl('/api/users/me'), {
            headers: { 'Authorization': `Bearer ${existingToken}` }
        })
        .then(res => {
            if (res.ok) {
                window.location.href = '/dashboard.html';
            } else {
                // Token is invalid, remove it
                localStorage.removeItem('token');
            }
        })
        .catch(() => {
            // Network error, remove token to be safe
            localStorage.removeItem('token');
        });
        return;
    }
    
    const loginForm = document.getElementById('login-form');
    if (!loginForm) return;
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const messageDiv = document.getElementById('form-message');
        const submitBtn = loginForm.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.textContent;
        
        // Show loading state
        submitBtn.textContent = 'Logging in...';
        submitBtn.disabled = true;
        messageDiv.textContent = '';
        messageDiv.className = '';
        
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
                messageDiv.textContent = 'Login successful! Redirecting...';
                messageDiv.className = 'message-success';
                localStorage.setItem('token', result.token);
                setTimeout(() => {
                    window.location.href = '/dashboard.html';
                }, 1000);
            } else {
                messageDiv.textContent = result.error || 'Login failed. Please check your credentials.';
                messageDiv.className = 'message-error';
            }
        } catch (error) {
            console.error('Login error:', error);
            messageDiv.textContent = 'Network error. Please check your connection and try again.';
            messageDiv.className = 'message-error';
        } finally {
            // Reset button state
            submitBtn.textContent = originalBtnText;
            submitBtn.disabled = false;
        }
    });
}); 