import { isLoggedIn } from './common/auth.js';
import { setupNav } from './common/nav.js';

document.addEventListener('DOMContentLoaded', function() {
    setupNav();
    
    // Login/Dashboard button in nav
    const loginBtn = document.querySelector('a.login-btn');
    if (loginBtn) {
        if (isLoggedIn()) {
            loginBtn.textContent = 'Dashboard';
            loginBtn.href = '/dashboard.html';
        } else {
            loginBtn.textContent = 'Login';
            loginBtn.href = '/login.html';
        }
    }
    
    // Hero CTA button
    const heroCta = document.getElementById('hero-cta');
    if (heroCta) {
        heroCta.href = isLoggedIn() ? '/dashboard.html' : '/login.html';
    }
    
    // Dashboard card link
    const dashLink = document.getElementById('dashboard-link');
    if (dashLink) {
        dashLink.href = isLoggedIn() ? '/dashboard.html' : '/login.html';
    }
}); 