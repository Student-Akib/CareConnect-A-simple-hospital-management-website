document.addEventListener('DOMContentLoaded', () => {

    // --- Helper function to get the JWT token from localStorage ---
    const getToken = () => localStorage.getItem('token');

    // --- Universal Hamburger Menu and Logout Button Logic ---
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');
    if (hamburger && navLinks) {
        hamburger.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            hamburger.classList.toggle('active');
        });
    }

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('token'); // Clear the token from storage
            window.location.href = '/login.html'; // Redirect to the login page
        });
    }

    // --- Page-specific Logic ---
    // Get the current page's path to run only the necessary code
    const page = window.location.pathname;

    // --- Logic for the HOMEPAGE (index.html) ---
    if (page === '/' || page.endsWith('index.html')) {
        const authLink = document.querySelector('a.login-btn');
        if (authLink && getToken()) {
            // If the user is logged in, change the button to link to the dashboard
            authLink.textContent = 'Dashboard';
            authLink.href = '/dashboard.html';
        }
    }

    // --- Logic for the Branches Page ---
    if (page.endsWith('branches.html')) {
        const branchesContainer = document.getElementById('branches-container');
        async function fetchAndDisplayBranches() {
            try {
                const response = await fetch('http://localhost:3000/api/branches');
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const branches = await response.json();
                branchesContainer.innerHTML = ''; // Clear loading message
                if (branches.length === 0) {
                    branchesContainer.innerHTML = '<p>No branches found.</p>';
                    return;
                }
                branches.forEach(branch => {
                    const branchCard = document.createElement('div');
                    branchCard.className = 'branch-card';
                    branchCard.innerHTML = `
                        <h3>${branch.branch_name}</h3>
                        <p><strong>Address:</strong> ${branch.branch_address}</p>
                        <p><strong>Email:</strong> <a href="mailto:${branch.branch_email}">${branch.branch_email}</a></p>
                        <p><strong>Hours:</strong> ${branch.branch_hours}</p>
                        ${branch.google_map_link ? `<a href="${branch.google_map_link}" class="map-link" target="_blank">View on Map</a>` : ''}
                    `;
                    branchesContainer.appendChild(branchCard);
                });
            } catch (error) {
                console.error("Failed to fetch branches:", error);
                branchesContainer.innerHTML = '<p class="error-message">Could not load branches.</p>';
            }
        }
        fetchAndDisplayBranches();
    }

    // --- Logic for Registration Page ---
    if (page.endsWith('register.html')) {
        const registerForm = document.getElementById('register-form');
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
                const response = await fetch('http://localhost:3000/api/users/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                const result = await response.json();
                if (response.ok) {
                    messageDiv.textContent = result.message;
                    messageDiv.className = 'message-success';
                    setTimeout(() => { window.location.href = '/login.html'; }, 2000);
                } else {
                    messageDiv.textContent = result.message;
                    messageDiv.className = 'message-error';
                }
            } catch (error) {
                messageDiv.textContent = 'An unexpected error occurred.';
                messageDiv.className = 'message-error';
            }
        });
    }

    // --- Logic for Login Page ---
    if (page.endsWith('login.html')) {
        const loginForm = document.getElementById('login-form');
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const messageDiv = document.getElementById('form-message');
            const formData = new FormData(loginForm);
            const data = Object.fromEntries(formData.entries());

            try {
                const response = await fetch('http://localhost:3000/api/users/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                const result = await response.json();
                if (response.ok) {
                    localStorage.setItem('token', result.token);
                    window.location.href = '/dashboard.html';
                } else {
                    messageDiv.textContent = result.message;
                    messageDiv.className = 'message-error';
                }
            } catch (error) {
                messageDiv.textContent = 'An unexpected error occurred.';
                messageDiv.className = 'message-error';
            }
        });
    }

    // --- Logic for Dashboard Page ---
    if (page.endsWith('dashboard.html')) {
        const welcomeMessage = document.getElementById('welcome-message');
        const token = getToken();

        if (!token) {
            window.location.href = '/login.html';
            return;
        }

        async function fetchDashboardData() {
            try {
                const response = await fetch('http://localhost:3000/api/users/dashboard', {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    }
                });
                if (response.status === 401 || response.status === 403) {
                    localStorage.removeItem('token');
                    window.location.href = '/login.html';
                    return;
                }
                if (!response.ok) throw new Error('Failed to fetch dashboard data.');
                const data = await response.json();
                welcomeMessage.textContent = `Welcome, ${data.user.username}!`;
            } catch (error) {
                console.error('Dashboard error:', error);
                welcomeMessage.textContent = 'Could not load your data. Please try logging in again.';
            }
        }
        fetchDashboardData();
    }
});
