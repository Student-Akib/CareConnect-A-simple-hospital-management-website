import { setupNav } from './common/nav.js';
import { buildApiUrl } from './common/config.js';

document.addEventListener('DOMContentLoaded', () => {
    setupNav();
    
    // Redirect to dashboard if already logged in
    const existingToken = localStorage.getItem('token');
    if (existingToken) {
        // Verify token is still valid by making a test request
        fetch(buildApiUrl('/users/me'), {
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
    
    const registerForm = document.getElementById('register-form');
    const usernameField = document.getElementById('username');
    const messageDiv = document.getElementById('form-message');
    
    if (!registerForm) return;
    
    // Real-time username validation
    if (usernameField) {
        usernameField.addEventListener('input', () => {
            const username = usernameField.value;
            
            // Clear previous messages
            messageDiv.textContent = '';
            messageDiv.className = '';
            
            // Check for spaces
            if (username.includes(' ')) {
                messageDiv.textContent = 'Username cannot contain spaces!';
                messageDiv.className = 'message-error';
                return;
            }
            
            // Check length
            if (username.length > 0 && (username.length < 3 || username.length > 20)) {
                messageDiv.textContent = 'Username must be between 3 and 20 characters long!';
                messageDiv.className = 'message-error';
                return;
            }
            
            // Valid username
            if (username.length >= 3 && username.length <= 20 && !username.includes(' ')) {
                messageDiv.textContent = 'Username looks good!';
                messageDiv.className = 'message-success';
            }
        });
    }
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const messageDiv = document.getElementById('form-message');
        const submitBtn = registerForm.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.textContent;
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        
        // Username validation
        if (username.includes(' ')) {
            messageDiv.textContent = 'Username cannot contain spaces!';
            messageDiv.className = 'message-error';
            return;
        }
        
        if (username.length < 3 || username.length > 20) {
            messageDiv.textContent = 'Username must be between 3 and 20 characters long!';
            messageDiv.className = 'message-error';
            return;
        }
        
        if (password !== confirmPassword) {
            messageDiv.textContent = 'Passwords do not match!';
            messageDiv.className = 'message-error';
            return;
        }
        
        // Show loading state
        submitBtn.textContent = 'Creating Account...';
        submitBtn.disabled = true;
        messageDiv.textContent = '';
        messageDiv.className = '';
        
        const formData = new FormData(registerForm);
        const data = Object.fromEntries(formData.entries());
        
        try {
            const response = await fetch(buildApiUrl('/auth/register'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            if (response.ok) {
                messageDiv.textContent = result.message || 'Registration successful! Redirecting to login...';
                messageDiv.className = 'message-success';
                setTimeout(() => { window.location.href = '/login.html'; }, 2000);
            } else {
                messageDiv.textContent = result.error || 'Registration failed. Please try again.';
                messageDiv.className = 'message-error';
            }
        } catch (error) {
            console.error('Registration error:', error);
            messageDiv.textContent = 'Network error. Please check your connection and try again.';
            messageDiv.className = 'message-error';
        } finally {
            // Reset button state
            submitBtn.textContent = originalBtnText;
            submitBtn.disabled = false;
        }
    });
}); 