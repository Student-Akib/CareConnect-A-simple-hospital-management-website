// Import common modules
import { buildApiUrl } from './common/config.js';

// DOM elements
const loadingState = document.getElementById('loading-state');
const errorState = document.getElementById('error-state');
const appointmentsContainer = document.getElementById('appointments-container');
const appointmentsList = document.getElementById('appointments-list');
const noAppointments = document.getElementById('no-appointments');
const retryBtn = document.getElementById('retry-btn');
const appointmentModal = document.getElementById('appointment-modal');
const modalTitle = document.getElementById('modal-title');
const modalBody = document.getElementById('modal-body');
const closeModal = document.getElementById('close-modal');

// Get token from localStorage
const token = localStorage.getItem('token');

// Check authentication
if (!token) {
    window.location.href = '/login.html';
}

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    setupNotifications();
    loadAppointments();
    
    // Event listeners
    retryBtn.addEventListener('click', loadAppointments);
    closeModal.addEventListener('click', hideModal);
    
    // Close modal when clicking outside
    appointmentModal.addEventListener('click', function(e) {
        if (e.target === appointmentModal) {
            hideModal();
        }
    });
    
    // Close modal with Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && appointmentModal.style.display === 'block') {
            hideModal();
        }
    });
    
    // Logout functionality
    document.getElementById('logout-btn').addEventListener('click', function() {
        localStorage.removeItem('token');
        window.location.href = '/login.html';
    });
});

// Notification functions
function setupNotifications() {
    const notifBadge = document.getElementById('notif-badge');
    const notifCenter = document.getElementById('notif-center');
    const notifDropdown = document.getElementById('notif-dropdown');
    const notifList = document.getElementById('notif-list');

    // Fetch notifications from backend
    fetch(buildApiUrl('/api/users/notifications'), {
        headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => {
        if (!res.ok) {
            if (res.status === 401) {
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
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 3000);
}

// Load appointments from API
async function loadAppointments() {
    try {
        showLoading();
        
        const response = await fetch(buildApiUrl('/api/appointments'), {
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
            throw new Error(`HTTP ${response.status}: Failed to fetch appointments`);
        }

        const data = await response.json();
        console.log('Received appointments data:', data);
        console.log('Number of appointments:', data.appointments?.length);
        
        if (data.appointments && data.appointments.length > 0) {
            displayAppointments(data.appointments);
        } else {
            showNoAppointments();
        }
        
    } catch (error) {
        console.error('Error loading appointments:', error);
        showError();
    }
}

// Display appointments in the list
function displayAppointments(appointments) {
    console.log('displayAppointments called with:', appointments.length, 'appointments');
    console.log('Appointment details:', appointments.map(a => ({ id: a.appointment_id, doctor: a.doctor_name, date: a.visit_date })));
    
    // Sort appointments by visit date (most recent first)
    appointments.sort((a, b) => new Date(b.visit_date) - new Date(a.visit_date));
    
    appointmentsList.innerHTML = '';
    
    appointments.forEach((appointment, index) => {
        console.log(`Creating card ${index + 1} for appointment ID:`, appointment.appointment_id);
        const appointmentCard = createAppointmentCard(appointment);
        appointmentsList.appendChild(appointmentCard);
    });
    
    console.log('Total cards appended to list:', appointmentsList.children.length);
    showAppointmentsContainer();
}

// Create an appointment card
function createAppointmentCard(appointment) {
    const card = document.createElement('div');
    card.className = 'appointment-card';
    
    const visitDate = new Date(appointment.visit_date);
    const statusClass = getStatusClass(appointment.status);
    const statusText = getStatusText(appointment.status);
    
    card.innerHTML = `
        <div class="appointment-header">
            <div class="appointment-date">
                <div class="date-day">${visitDate.getDate()}</div>
                <div class="date-month">${visitDate.toLocaleDateString('en-US', { month: 'short' })}</div>
                <div class="date-year">${visitDate.getFullYear()}</div>
            </div>
            <div class="appointment-info">
                <h3>Dr. ${appointment.doctor_name}</h3>
                <p class="specialization">${appointment.specialization || 'General Medicine'}</p>
                <div class="appointment-meta">
                    <span class="schedule">Schedule: ${appointment.schedule_no}</span>
                    <span class="serial">Serial: ${appointment.serial_no}</span>
                </div>
            </div>
            <div class="appointment-status">
                <span class="status-badge ${statusClass}">${statusText}</span>
                ${appointment.prescription_id ? '<span class="prescription-badge">📋 Prescription</span>' : ''}
            </div>
        </div>
        <div class="appointment-actions">
            <button class="btn btn-primary view-details-btn" data-appointment-id="${appointment.appointment_id}">
                View Details
            </button>
        </div>
    `;
    
    // Add click event for view details
    const viewDetailsBtn = card.querySelector('.view-details-btn');
    viewDetailsBtn.addEventListener('click', () => {
        showAppointmentDetails(appointment.appointment_id);
    });
    
    return card;
}

// Show appointment details in modal
async function showAppointmentDetails(appointmentId) {
    try {
        const response = await fetch(buildApiUrl(`/api/appointments/${appointmentId}`), {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: Failed to fetch appointment details`);
        }

        const data = await response.json();
        const { appointment, prescription } = data;
        
        displayAppointmentModal(appointment, prescription);
        
    } catch (error) {
        console.error('Error loading appointment details:', error);
        showNotification('Error loading appointment details', 'error');
    }
}

// Display appointment details in modal
function displayAppointmentModal(appointment, prescription) {
    const visitDate = new Date(appointment.visit_date);
    
    modalTitle.textContent = `Appointment Details - ${visitDate.toLocaleDateString()}`;
    
    let modalContent = `
        <div class="appointment-details-modal">
            <div class="detail-section">
                <h4>Appointment Information</h4>
                <div class="detail-grid">
                    <div class="detail-item">
                        <strong>Doctor:</strong> Dr. ${appointment.doctor_name}
                    </div>
                    <div class="detail-item">
                        <strong>Specialization:</strong> ${appointment.specialization || 'General Medicine'}
                    </div>
                    <div class="detail-item">
                        <strong>Visit Date:</strong> ${visitDate.toLocaleDateString('en-US', { 
                            weekday: 'long', 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                        })}
                    </div>
                    <div class="detail-item">
                        <strong>Schedule:</strong> ${appointment.schedule_no}
                    </div>
                    <div class="detail-item">
                        <strong>Serial:</strong> ${appointment.serial_no}
                    </div>
                    <div class="detail-item">
                        <strong>Status:</strong> <span class="status-badge ${getStatusClass(appointment.status)}">${getStatusText(appointment.status)}</span>
                    </div>
                    <div class="detail-item">
                        <strong>Method:</strong> ${formatCreationMethod(appointment.creation_method)}
                    </div>
                </div>
            </div>
    `;
    
    // Add bill information if available
    if (appointment.bill_id) {
        modalContent += `
            <div class="detail-section">
                <h4>Bill Information</h4>
                <div class="detail-grid">
                    <div class="detail-item">
                        <strong>Total Amount:</strong> $${appointment.total_amount || 'N/A'}
                    </div>
                    <div class="detail-item">
                        <strong>Payment Method:</strong> ${formatPaymentMethod(appointment.payment_status) || 'N/A'}
                    </div>
                </div>
            </div>
        `;
    }
    
    // Add prescription information if available
    if (prescription) {
        modalContent += `
            <div class="detail-section">
                <h4>Prescription Information</h4>
                <div class="prescription-details">
                    <p><strong>Diagnosis:</strong> ${prescription.diagnosis || 'Not specified'}</p>
                    ${prescription.next_visit_date ? `<p><strong>Next Visit:</strong> ${new Date(prescription.next_visit_date).toLocaleDateString()}</p>` : ''}
                </div>
        `;
        
        // Add prescription items if available
        if (prescription.items && prescription.items.length > 0) {
            modalContent += `
                <div class="prescription-items">
                    <h5>Medications</h5>
                    <div class="medication-list">
            `;
            
            prescription.items.forEach(item => {
                modalContent += `
                    <div class="medication-item">
                        <h6>${item.drug_name}</h6>
                        <p><strong>Dosage:</strong> ${item.dosage}</p>
                        <p><strong>Duration:</strong> ${item.duration}</p>
                        <p><strong>Instructions:</strong> ${item.instructions || 'As prescribed'}</p>
                    </div>
                `;
            });
            
            modalContent += `
                    </div>
                </div>
            `;
        }
        
        modalContent += `</div>`;
    }
    
    modalContent += `</div>`;
    
    modalBody.innerHTML = modalContent;
    showModal();
}

// Helper functions
function getStatusClass(status) {
    const statusClasses = {
        'requested': 'status-requested',
        'scheduled': 'status-scheduled',
        'confirmed': 'status-confirmed',
        'visited': 'status-visited',
        'completed': 'status-completed',
        'cancelled': 'status-cancelled'
    };
    return statusClasses[status] || 'status-scheduled';
}

function getStatusText(status) {
    const statusTexts = {
        'requested': 'Pending Confirmation',
        'scheduled': 'Scheduled',
        'confirmed': 'Confirmed',
        'visited': 'Visited',
        'completed': 'Completed',
        'cancelled': 'Cancelled'
    };
    return statusTexts[status] || status;
}

function formatCreationMethod(method) {
    const methodTexts = {
        'online': 'Online',
        'phone': 'Phone',
        'walk_in': 'Walk-in',
        'referral': 'Referral'
    };
    return methodTexts[method] || method;
}

function formatPaymentMethod(method) {
    const methodTexts = {
        'not_decided': 'Not Decided',
        'cash': 'Cash',
        'mobile_banking': 'Mobile Banking',
        'credit_card': 'Credit Card',
        'debit_card': 'Debit Card',
        'check': 'Check',
        'bank_transfer': 'Bank Transfer'
    };
    return methodTexts[method] || method;
}

// UI state functions
function showLoading() {
    loadingState.style.display = 'block';
    errorState.style.display = 'none';
    appointmentsContainer.style.display = 'none';
    noAppointments.style.display = 'none';
}

function showError() {
    loadingState.style.display = 'none';
    errorState.style.display = 'block';
    appointmentsContainer.style.display = 'none';
    noAppointments.style.display = 'none';
}

function showAppointmentsContainer() {
    loadingState.style.display = 'none';
    errorState.style.display = 'none';
    appointmentsContainer.style.display = 'block';
    noAppointments.style.display = 'none';
}

function showNoAppointments() {
    loadingState.style.display = 'none';
    errorState.style.display = 'none';
    appointmentsContainer.style.display = 'none';
    noAppointments.style.display = 'block';
}

function showModal() {
    appointmentModal.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function hideModal() {
    appointmentModal.style.display = 'none';
    document.body.style.overflow = 'auto';
} 