import { buildApiUrl } from './common/config.js';

document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const profileForm = document.getElementById('profile-form');
    const saveBtn = document.getElementById('save-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    const editBtn = document.getElementById('edit-btn');
    const deleteAccountBtn = document.getElementById('delete-account-btn');
    const viewActions = document.getElementById('view-actions');
    const editActions = document.getElementById('edit-actions');
    const notifBadge = document.getElementById('notif-badge');
    const notifCenter = document.getElementById('notif-center');
    const notifDropdown = document.getElementById('notif-dropdown');
    const notifList = document.getElementById('notif-list');
    const logoutBtn = document.getElementById('logout-btn');

    // Form fields
    const userIdField = document.getElementById('userId');
    const patientIdField = document.getElementById('patientId');
    const usernameField = document.getElementById('username');
    const emailField = document.getElementById('email');
    const nameField = document.getElementById('name');
    const phoneField = document.getElementById('phone');
    const dobField = document.getElementById('dob');
    const sexField = document.getElementById('sex');
    const bloodTypeField = document.getElementById('bloodType');
    const sexDisplayField = document.getElementById('sex-display');
    const bloodTypeDisplayField = document.getElementById('bloodType-display');
    
    // Elements initialized

    // Check if user is logged in
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    // Load profile data
    async function loadProfile() {
        try {
            const response = await fetch(buildApiUrl('/users/me'), {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                if (response.status === 401) {
                    localStorage.removeItem('token');
                    window.location.href = '/login.html';
                    return;
                }
                throw new Error(`HTTP ${response.status}: Failed to fetch profile data`);
            }

            const data = await response.json();
            
            // Debug: Log the data to see what we're getting
            console.log('Profile data loaded for user:', data.id);
            
            // Populate form fields
            userIdField.value = data.id || '';
            patientIdField.value = data.patient?.id || '';
            usernameField.value = data.username || '';
            emailField.value = data.email || '';
            nameField.value = data.patient?.name || '';
            phoneField.value = data.patient?.phone || '';
            dobField.value = formatDateForInput(data.patient?.dob);
            sexField.value = data.patient?.sex || '';
            bloodTypeField.value = data.patient?.bloodType || '';
            
            // Populate display fields
            sexDisplayField.value = getSexDisplay(data.patient?.sex);
            bloodTypeDisplayField.value = data.patient?.bloodType || '';
            
            console.log('Display fields populated:', {
                sexDisplayField: sexDisplayField.value,
                bloodTypeDisplayField: bloodTypeDisplayField.value,
                originalSex: data.patient?.sex,
                originalBloodType: data.patient?.bloodType
            });
            
            // Field values set successfully

        } catch (error) {
            console.error('Error loading profile:', error);
            showNotification('Error loading profile data', 'error');
        }
    }

    // Helper function to format date for HTML input
    function formatDateForInput(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toISOString().split('T')[0]; // Convert to yyyy-MM-dd format
    }

    // Helper function to get sex display text
    function getSexDisplay(sex) {
        switch(sex) {
            case 'M': return 'Male';
            case 'F': return 'Female';
            case 'O': return 'Other';
            default: return '';
        }
    }

    // Helper function to switch to edit mode
    function switchToEditMode() {
        // Show edit fields, hide display fields
        sexField.style.display = 'block';
        bloodTypeField.style.display = 'block';
        sexDisplayField.style.display = 'none';
        bloodTypeDisplayField.style.display = 'none';
        
        // Remove readonly from editable fields
        nameField.readOnly = false;
        phoneField.readOnly = false;
        dobField.readOnly = false;
        
        // Show edit actions, hide view actions
        viewActions.style.display = 'none';
        editActions.style.display = 'flex';
    }

    // Helper function to switch to view mode
    function switchToViewMode() {
        console.log('Switching to view mode');
        
        // Show display fields, hide edit fields
        sexField.style.display = 'none';
        bloodTypeField.style.display = 'none';
        sexDisplayField.style.display = 'block';
        bloodTypeDisplayField.style.display = 'block';
        
        // Add readonly to all fields
        nameField.readOnly = true;
        phoneField.readOnly = true;
        dobField.readOnly = true;
        
        // Show view actions, hide edit actions
        viewActions.style.display = 'flex';
        editActions.style.display = 'none';
        
        // Update display fields with current values
        sexDisplayField.value = getSexDisplay(sexField.value);
        bloodTypeDisplayField.value = bloodTypeField.value;
        
        console.log('View mode - Display field values:', {
            sexDisplayField: sexDisplayField.value,
            bloodTypeDisplayField: bloodTypeDisplayField.value
        });
    }

    // Save profile changes
    async function saveProfile(formData) {
        try {
            setLoading(true);
            
            const response = await fetch(buildApiUrl('/users/me'), {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                if (response.status === 401) {
                    localStorage.removeItem('token');
                    window.location.href = '/login.html';
                    return;
                }
                
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to update profile');
            }

            const result = await response.json();
            showNotification('Profile updated successfully!', 'success');
            
            // Switch back to view mode after successful save
            switchToViewMode();
            
        } catch (error) {
            console.error('Error saving profile:', error);
            showNotification(error.message || 'Failed to update profile', 'error');
        } finally {
            setLoading(false);
        }
    }

    // Delete account
    async function deleteAccount() {
        if (!confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
            return;
        }

        if (!confirm('This will permanently delete all your data. Are you absolutely sure?')) {
            return;
        }

        try {
            setLoading(true);
            
            const response = await fetch(buildApiUrl('/users/me'), {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                if (response.status === 401) {
                    localStorage.removeItem('token');
                    window.location.href = '/login.html';
                    return;
                }
                
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to delete account');
            }

            showNotification('Account deleted successfully', 'success');
            setTimeout(() => {
                localStorage.clear();
                window.location.href = '/login.html';
            }, 2000);
            
        } catch (error) {
            console.error('Error deleting account:', error);
            showNotification(error.message || 'Failed to delete account', 'error');
        } finally {
            setLoading(false);
        }
    }

    // Set loading state
    function setLoading(loading) {
        const btnText = saveBtn.querySelector('.btn-text');
        const btnLoading = saveBtn.querySelector('.btn-loading');
        
        if (loading) {
            saveBtn.disabled = true;
            btnText.style.display = 'none';
            btnLoading.style.display = 'inline';
        } else {
            saveBtn.disabled = false;
            btnText.style.display = 'inline';
            btnLoading.style.display = 'none';
        }
    }

    // Show notification
    function showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // Add to page
        document.body.appendChild(notification);
        
        // Remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }

    // Load notifications
    async function loadNotifications() {
        try {
            const response = await fetch(buildApiUrl('/users/notifications'), {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                if (response.status === 401) {
                    localStorage.removeItem('token');
                    window.location.href = '/login.html';
                    return;
                }
                throw new Error(`HTTP ${response.status}: Failed to fetch notifications`);
            }

            const data = await response.json();
            const notifications = data.notifications || [];
            const unreadCount = data.unreadCount || notifications.filter(n => n.status === 'unread').length;
            
            if (notifBadge) notifBadge.textContent = unreadCount;
            if (notifList) {
                notifList.innerHTML = notifications.length
                    ? notifications.map(n => `<div class="notif-item${n.status === 'unread' ? ' unread' : ''}"><strong>${n.title || ''}</strong><br>${n.message || n.text || ''}</div>`).join('')
                    : '<div class="notif-item">No notifications</div>';
            }
        } catch (error) {
            console.error('Error fetching notifications:', error);
            if (notifList) notifList.innerHTML = '<div class="notif-item">Could not load notifications</div>';
        }
    }

    // Event listeners
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = {
                name: nameField.value.trim(),
                phone: phoneField.value.trim(),
                dob: dobField.value,
                sex: sexField.value,
                bloodType: bloodTypeField.value
            };

            // Validate required fields
            if (!formData.name || !formData.phone || !formData.dob || !formData.sex || !formData.bloodType) {
                showNotification('Please fill in all required fields', 'error');
                return;
            }

            await saveProfile(formData);
        });
    }

    if (editBtn) {
        editBtn.addEventListener('click', switchToEditMode);
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            switchToViewMode();
            // Reload profile data to reset any changes
            loadProfile();
        });
    }

    if (deleteAccountBtn) {
        deleteAccountBtn.addEventListener('click', deleteAccount);
    }

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
            localStorage.clear();
            window.location.href = '/login.html';
        });
    }

    // Initialize
    loadProfile().then(() => {
        // Start in view mode
        switchToViewMode();
    });
    loadNotifications();
}); 