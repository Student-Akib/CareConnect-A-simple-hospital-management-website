import { setupNav } from './common/nav.js';
import { buildApiUrl } from './common/config.js';

document.addEventListener('DOMContentLoaded', () => {
    setupNav();
    const branchesContainer = document.getElementById('branches-container');
    async function fetchAndDisplayBranches() {
        try {
            const response = await fetch(buildApiUrl('/api/branches'));
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const branches = await response.json();
            branchesContainer.innerHTML = '';
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
}); 