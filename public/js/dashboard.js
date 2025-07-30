import { buildApiUrl } from './common/config.js';

document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const notifBadge = document.getElementById('notif-badge');
    const notifCenter = document.getElementById('notif-center');
    const notifDropdown = document.getElementById('notif-dropdown');
    const notifList = document.getElementById('notif-list');
    const logoutBtn = document.getElementById('logout-btn');
    const welcomeBanner = document.querySelector('.welcome-banner h1');

    // Check if user is logged in
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    // Fetch user info for welcome banner
            fetch(buildApiUrl('/users/me'), {
        headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => {
        if (!res.ok) {
            if (res.status === 401) {
                // Token expired or invalid
                localStorage.removeItem('token');
                window.location.href = '/login.html';
                throw new Error('Authentication failed');
            }
            throw new Error(`HTTP ${res.status}: Failed to fetch user data`);
        }
        return res.json();
    })
    .then(data => {
        if (welcomeBanner && data && data.patient && data.patient.name) {
            welcomeBanner.textContent = `Hello, ${data.patient.name}!`;
        }
    })
    .catch((error) => {
        console.error('Error fetching user data:', error);
        if (welcomeBanner) welcomeBanner.textContent = 'Hello, Patient!';
    });

    // Fetch notifications from backend
            fetch(buildApiUrl('/users/notifications'), {
        headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => {
        if (!res.ok) {
            if (res.status === 401) {
                // Token expired or invalid
                localStorage.removeItem('token');
                window.location.href = '/login.html';
                throw new Error('Authentication failed');
            }
            throw new Error(`HTTP ${res.status}: Failed to fetch notifications`);
        }
        return res.json();
    })
    .then(data => {
        const notifications = data.notifications || [];
        const unreadCount = data.unreadCount || notifications.filter(n => n.status === 'unread').length;
        if (notifBadge) notifBadge.textContent = unreadCount;
        if (notifList) {
            notifList.innerHTML = notifications.length
                ? notifications.map(n => `<div class="notif-item${n.status === 'unread' ? ' unread' : ''}"><strong>${n.title || ''}</strong><br>${n.message || n.text || ''}</div>`).join('')
                : '<div class="notif-item">No notifications</div>';
        }
    })
    .catch((error) => {
        console.error('Error fetching notifications:', error);
        if (notifList) notifList.innerHTML = '<div class="notif-item">Could not load notifications</div>';
    });

    // Notification dropdown logic
    if (notifCenter && notifDropdown) {
        notifCenter.addEventListener('click', () => {
            notifDropdown.style.display = notifDropdown.style.display === 'block' ? 'none' : 'block';
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!notifCenter.contains(e.target)) {
                notifDropdown.style.display = 'none';
            }
        });
    }

    // Logout functionality
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('token');
            window.location.href = '/login.html';
        });
    }
}); 