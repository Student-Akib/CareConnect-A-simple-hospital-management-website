// Import common modules
import { API_BASE_URL } from './common/config.js';
import { isLoggedIn, getToken } from './common/auth.js';
import { showButtonLoading, resetButton, handleApiError } from './common/utils.js';

// Global state
let currentStep = 1;
let selectedDoctor = null;
let selectedDate = null;
let selectedTimeSlot = null;
let allDoctors = [];
let filteredDoctors = [];
let availableTimeSlots = [];
let appointmentData = null;

// DOM elements
const stepPanels = document.querySelectorAll('.step-panel');
const progressSteps = document.querySelectorAll('.step');
const doctorsGrid = document.getElementById('doctors-grid');
const timeSlotsGrid = document.getElementById('time-slots-grid');
const appointmentSummary = document.getElementById('appointment-summary');
const successAppointmentDetails = document.getElementById('success-appointment-details');
const selectedDoctorInfo = document.getElementById('selected-doctor-info');
const appointmentDateInput = document.getElementById('appointment-date');
const doctorSearchInput = document.getElementById('doctor-search');
const departmentFilterSelect = document.getElementById('department-filter');
const backBtn = document.getElementById('back-btn');
const nextBtn = document.getElementById('next-btn');
const confirmAppointmentBtn = document.getElementById('confirm-appointment-btn');



// Initialize the page
document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    if (!isLoggedIn()) {
        window.location.href = '/login.html';
        return;
    }

    // Set minimum date to today
    const today = new Date().toISOString().split('T')[0];
    appointmentDateInput.min = today;

    // Initialize the page
    await initializeAppointmentCreation();
    setupEventListeners();
    setupNotifications();
});

// Initialize appointment creation
async function initializeAppointmentCreation() {
    try {
        // Check if required DOM elements exist
        const requiredElements = [
            'doctors-grid', 'time-slots-grid', 'appointment-summary', 
            'success-appointment-details', 'selected-doctor-info', 
            'appointment-date', 'doctor-search', 'department-filter'
        ];
        
        const missingElements = requiredElements.filter(id => !document.getElementById(id));
        if (missingElements.length > 0) {
            console.error('Missing required DOM elements:', missingElements);
            alert('Page is not properly loaded. Please refresh the page.');
            return;
        }

        await loadDoctors();
        updateStepNavigation();
    } catch (error) {
        console.error('Failed to initialize appointment creation:', error);
        alert(`Failed to initialize appointment creation: ${error.message}`);
    }
}

// Setup event listeners
function setupEventListeners() {
    // Search functionality
    if (doctorSearchInput) {
        doctorSearchInput.addEventListener('input', filterDoctors);
    }
    if (departmentFilterSelect) {
        departmentFilterSelect.addEventListener('change', filterDoctors);
    }

    // Date selection
    if (appointmentDateInput) {
        appointmentDateInput.addEventListener('change', handleDateChange);
    }

    // Navigation
    if (backBtn) {
        backBtn.addEventListener('click', goToPreviousStep);
    }

    // Retry buttons
    const retryDoctorsBtn = document.getElementById('retry-doctors-btn');
    if (retryDoctorsBtn) {
        retryDoctorsBtn.addEventListener('click', loadDoctors);
    }
    
    const retrySlotsBtn = document.getElementById('retry-slots-btn');
    if (retrySlotsBtn) {
        retrySlotsBtn.addEventListener('click', loadAvailableSlots);
    }

    // Confirmation actions
    const backToStep2Btn = document.getElementById('back-to-step2-btn');
    if (backToStep2Btn) {
        backToStep2Btn.addEventListener('click', () => goToStep(2));
    }
    
    if (confirmAppointmentBtn) {
        confirmAppointmentBtn.addEventListener('click', createAppointment);
    }

    // Success actions
    const viewAppointmentsBtn = document.getElementById('view-appointments-btn');
    if (viewAppointmentsBtn) {
        viewAppointmentsBtn.addEventListener('click', () => {
            window.location.href = '/appointments.html';
        });
    }
    
    const createAnotherBtn = document.getElementById('create-another-btn');
    if (createAnotherBtn) {
        createAnotherBtn.addEventListener('click', resetForm);
    }

    // Logout
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login.html';
        });
    }
}

// Setup notifications
function setupNotifications() {
    const notifBadge = document.getElementById('notif-badge');
    const notifCenter = document.getElementById('notif-center');
    const notifDropdown = document.getElementById('notif-dropdown');
    const notifList = document.getElementById('notif-list');

    // Fetch notifications from backend
    fetch(`${API_BASE_URL}/users/notifications`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
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

// Load all doctors
async function loadDoctors() {
    const loadingEl = document.getElementById('doctors-loading');
    const errorEl = document.getElementById('doctors-error');
    const gridEl = document.getElementById('doctors-grid');

    try {
        // Show loading
        loadingEl.style.display = 'block';
        errorEl.style.display = 'none';
        gridEl.style.display = 'none';

        const response = await fetch(`${API_BASE_URL}/appointments/doctors/all`, {
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        allDoctors = Array.isArray(data) ? data : (data.doctors || []);
        filteredDoctors = [...allDoctors];

        // Populate department filter
        populateDepartmentFilter();

        // Render doctors
        renderDoctors();

        // Hide loading
        loadingEl.style.display = 'none';
        gridEl.style.display = 'grid';

    } catch (error) {
        console.error('Failed to load doctors:', error);
        loadingEl.style.display = 'none';
        errorEl.style.display = 'block';
        alert(`Failed to load doctors: ${error.message}`);
    }
}

// Populate department filter
function populateDepartmentFilter() {
    const departments = [...new Set(allDoctors.map(doctor => doctor.department_name))].sort();
    
    departmentFilterSelect.innerHTML = '<option value="">All Departments</option>';
    departments.forEach(department => {
        const option = document.createElement('option');
        option.value = department;
        option.textContent = department;
        departmentFilterSelect.appendChild(option);
    });
}

// Filter doctors based on search and department
function filterDoctors() {
    const searchTerm = doctorSearchInput.value.toLowerCase();
    const selectedDepartment = departmentFilterSelect.value;

    filteredDoctors = allDoctors.filter(doctor => {
        const matchesSearch = doctor.doctor_name.toLowerCase().includes(searchTerm) ||
                            doctor.department_name.toLowerCase().includes(searchTerm) ||
                            doctor.qualifications.toLowerCase().includes(searchTerm);
        
        const matchesDepartment = !selectedDepartment || doctor.department_name === selectedDepartment;
        
        return matchesSearch && matchesDepartment;
    });

    renderDoctors();
}

// Render doctors grid
function renderDoctors() {
    if (filteredDoctors.length === 0) {
        doctorsGrid.innerHTML = `
            <div class="no-results" style="grid-column: 1 / -1; text-align: center; padding: 2rem;">
                <p>No doctors found matching your criteria.</p>
                <p>Try adjusting your search or department filter.</p>
            </div>
        `;
        return;
    }

    doctorsGrid.innerHTML = filteredDoctors.map(doctor => `
        <div class="doctor-card" data-doctor-id="${doctor.doctor_id}">
            <div class="doctor-header">
                <img src="${doctor.profile_url || '/images/doctor-placeholder.png'}" 
                     alt="${doctor.doctor_name}" 
                     class="doctor-image"
                     onerror="this.src='/images/doctor-placeholder.png'">
                <div class="doctor-info">
                    <h3>${doctor.doctor_name}</h3>
                    <p class="department">${doctor.department_name}</p>
                    <p class="qualifications">${doctor.qualifications}</p>
                </div>
            </div>
            <div class="doctor-details">
                <div class="detail-item">
                    <span class="label">Branch:</span>
                    <span class="value">${doctor.branch_name}</span>
                </div>
                <div class="detail-item">
                    <span class="label">Visit Charge:</span>
                    <span class="value visit-charge">$${doctor.visit_charge}</span>
                </div>
            </div>
            <button class="select-doctor-btn" data-doctor-id="${doctor.doctor_id}">
                Select Doctor
            </button>
        </div>
    `).join('');
    
    // Add event listeners to doctor selection buttons
    const selectButtons = doctorsGrid.querySelectorAll('.select-doctor-btn');
    selectButtons.forEach(button => {
        button.addEventListener('click', () => {
            const doctorId = parseInt(button.getAttribute('data-doctor-id'));
            selectDoctor(doctorId);
        });
    });
}

// Select a doctor
async function selectDoctor(doctorId) {
    try {
        // Get doctor details
        const response = await fetch(`${API_BASE_URL}/appointments/doctors/${doctorId}`, {
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        selectedDoctor = data.doctor ? data : { doctor: data };

        // Update UI to show selected doctor
        updateSelectedDoctorUI();

        // Move to next step
        goToStep(2);

    } catch (error) {
        console.error('Failed to get doctor details:', error);
        alert(`Failed to get doctor details: ${error.message}`);
    }
}

// Update selected doctor UI
function updateSelectedDoctorUI() {
    const doctor = selectedDoctor.doctor;
    
    selectedDoctorInfo.innerHTML = `
        <img src="${doctor.profile_url || '/images/doctor-placeholder.png'}" 
             alt="${doctor.doctor_name}" 
             class="doctor-image"
             onerror="this.src='/images/doctor-placeholder.png'">
        <div class="doctor-details">
            <h3>${doctor.doctor_name}</h3>
            <p class="department">${doctor.department_name}</p>
            <p><strong>Qualifications:</strong> ${doctor.qualifications}</p>
            <p><strong>Experience:</strong> ${doctor.experience}</p>
            <p><strong>Visit Charge:</strong> $${doctor.visit_charge}</p>
        </div>
    `;
}

// Handle date change
async function handleDateChange() {
    const date = appointmentDateInput.value;
    if (!date || !selectedDoctor) return;

    selectedDate = date;
    selectedTimeSlot = null;

    // Load available time slots
    await loadAvailableSlots();
}

// Load available time slots
async function loadAvailableSlots() {
    const loadingEl = document.getElementById('slots-loading');
    const errorEl = document.getElementById('slots-error');
    const gridEl = document.getElementById('time-slots-grid');
    const noSlotsEl = document.getElementById('no-slots-state');

    try {
        // Show loading
        loadingEl.style.display = 'block';
        errorEl.style.display = 'none';
        gridEl.style.display = 'none';
        noSlotsEl.style.display = 'none';

        const response = await fetch(`${API_BASE_URL}/appointments/doctors/${selectedDoctor.doctor.doctor_id}/availability/${selectedDate}`, {
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        availableTimeSlots = await response.json();

        // Hide loading
        loadingEl.style.display = 'none';

        if (availableTimeSlots.length === 0) {
            noSlotsEl.style.display = 'block';
        } else {
            gridEl.style.display = 'grid';
            renderTimeSlots();
        }

    } catch (error) {
        console.error('Failed to load time slots:', error);
        loadingEl.style.display = 'none';
        errorEl.style.display = 'block';
        alert('Failed to load time slots. Please try again.');
    }
}

// Render time slots
function renderTimeSlots() {
    timeSlotsGrid.innerHTML = availableTimeSlots.map(slot => {
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayName = dayNames[slot.week_day];
        
        return `
            <div class="time-slot-card" data-schedule-no="${slot.schedule_no}">
                <div class="time-info">
                    <h4>${formatTime(slot.start_time)} - ${formatTime(slot.finish_time)}</h4>
                    <p class="branch">${slot.branch_name}</p>
                    <p class="day">${dayName}</p>
                </div>
                <div class="availability-status">
                    <span class="status available">Available</span>
                    <span class="serial">Schedule #${slot.schedule_no}</span>
                </div>
                <button class="select-time-btn" data-schedule-no="${slot.schedule_no}">
                    Select Time
                </button>
            </div>
        `;
    }).join('');
    
    // Add event listeners to the buttons
    const selectButtons = timeSlotsGrid.querySelectorAll('.select-time-btn');
    selectButtons.forEach(button => {
        button.addEventListener('click', () => {
            const scheduleNo = parseInt(button.getAttribute('data-schedule-no'));
            selectTimeSlot(scheduleNo);
        });
    });
}

// Format time for display
function formatTime(timeString) {
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
}

// Select a time slot
async function selectTimeSlot(scheduleNo) {
    try {
        // Get next serial number
        const response = await fetch(`${API_BASE_URL}/appointments/doctors/${selectedDoctor.doctor.doctor_id}/serial/${selectedDate}`, {
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        const nextSerial = data.next_serial;

        // Find the selected slot
        const selectedSlot = availableTimeSlots.find(slot => slot.schedule_no === scheduleNo);
        selectedTimeSlot = { ...selectedSlot, nextSerial };

        // Update UI to show selected time slot
        updateSelectedTimeSlotUI();

        // Move to next step
        goToStep(3);

    } catch (error) {
        console.error('Failed to get serial number:', error);
        alert('Failed to get serial number. Please try again.');
    }
}

// Update selected time slot UI
function updateSelectedTimeSlotUI() {
    // Remove previous selections
    document.querySelectorAll('.time-slot-card').forEach(card => {
        card.classList.remove('selected');
    });

    // Add selection to current card
    const selectedCard = document.querySelector(`[data-schedule-no="${selectedTimeSlot.schedule_no}"]`);
    if (selectedCard) {
        selectedCard.classList.add('selected');
    }
}

// Go to specific step
function goToStep(step) {
    if (step < 1 || step > 4) return;

    // Hide all step panels
    stepPanels.forEach(panel => panel.classList.remove('active'));

    // Show target step panel
    document.getElementById(`step-${step}`).classList.add('active');

    // Update progress steps
    progressSteps.forEach((stepEl, index) => {
        const stepNumber = index + 1;
        stepEl.classList.remove('active', 'completed');
        
        if (stepNumber < step) {
            stepEl.classList.add('completed');
        } else if (stepNumber === step) {
            stepEl.classList.add('active');
        }
    });

    currentStep = step;
    updateStepNavigation();

    // Load data for specific steps
    if (step === 3) {
        renderAppointmentSummary();
    }
}

// Go to previous step
function goToPreviousStep() {
    if (currentStep > 1) {
        goToStep(currentStep - 1);
    }
}

// Go to next step
function goToNextStep() {
    if (currentStep < 4) {
        goToStep(currentStep + 1);
    }
}

// Update step navigation buttons
function updateStepNavigation() {
    if (backBtn) {
        backBtn.style.display = currentStep > 1 ? 'block' : 'none';
    }
    // nextBtn doesn't exist in HTML, so we don't need to handle it
}

// Render appointment summary
function renderAppointmentSummary() {
    const doctor = selectedDoctor.doctor;
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = dayNames[selectedTimeSlot.week_day];
    const formattedDate = new Date(selectedDate).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    appointmentSummary.innerHTML = `
        <div class="summary-section">
            <h4>Doctor Information</h4>
            <div class="summary-grid">
                <div class="summary-item">
                    <span class="label">Doctor Name:</span>
                    <span class="value">${doctor.doctor_name}</span>
                </div>
                <div class="summary-item">
                    <span class="label">Department:</span>
                    <span class="value">${doctor.department_name}</span>
                </div>
                <div class="summary-item">
                    <span class="label">Qualifications:</span>
                    <span class="value">${doctor.qualifications}</span>
                </div>
                <div class="summary-item">
                    <span class="label">Visit Charge:</span>
                    <span class="value highlight">$${doctor.visit_charge}</span>
                </div>
            </div>
        </div>
        
        <div class="summary-section">
            <h4>Appointment Details</h4>
            <div class="summary-grid">
                <div class="summary-item">
                    <span class="label">Date:</span>
                    <span class="value">${formattedDate}</span>
                </div>
                <div class="summary-item">
                    <span class="label">Time:</span>
                    <span class="value">${formatTime(selectedTimeSlot.start_time)} - ${formatTime(selectedTimeSlot.finish_time)}</span>
                </div>
                <div class="summary-item">
                    <span class="label">Branch:</span>
                    <span class="value">${selectedTimeSlot.branch_name}</span>
                </div>
                <div class="summary-item">
                    <span class="label">Serial Number:</span>
                    <span class="value highlight">#${selectedTimeSlot.nextSerial}</span>
                </div>
            </div>
        </div>
    `;
}

// Create appointment
async function createAppointment() {
    console.log('=== CREATE APPOINTMENT FRONTEND DEBUG ===');
    console.log('selectedDoctor:', selectedDoctor);
    console.log('selectedDate:', selectedDate);
    console.log('selectedTimeSlot:', selectedTimeSlot);
    console.log('confirmAppointmentBtn:', confirmAppointmentBtn);
    
    if (!selectedDoctor || !selectedDate || !selectedTimeSlot) {
        alert('Please complete all steps before confirming.');
        return;
    }

    try {
        console.log('Starting appointment creation...');
        
        if (confirmAppointmentBtn) {
            showButtonLoading(confirmAppointmentBtn, 'Creating...');
        }

        const requestData = {
            doctorId: selectedDoctor.doctor.doctor_id,
            visitDate: selectedDate,
            scheduleNo: selectedTimeSlot.schedule_no,
            creationMethod: 'online'
        };
        
        console.log('Request data:', requestData);
        console.log('API URL:', `${API_BASE_URL}/appointments/create`);
        console.log('Token:', getToken());

        const response = await fetch(`${API_BASE_URL}/appointments/create`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });

        console.log('Response received:', response.status, response.statusText);

        if (!response.ok) {
            const errorText = await response.text();
            console.log('Error response text:', errorText);
            let errorData;
            try {
                errorData = JSON.parse(errorText);
            } catch (e) {
                errorData = { error: errorText };
            }
            throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        console.log('Success response:', result);

        // Show success
        alert('Appointment created successfully!');
        
        // Render success details
        renderSuccessDetails(result.appointment);

        // Move to success step
        goToStep(4);

    } catch (error) {
        console.error('Failed to create appointment:', error);
        alert(error.message || 'Failed to create appointment. Please try again.');
    } finally {
        if (confirmAppointmentBtn) {
            resetButton(confirmAppointmentBtn, 'Confirm Appointment');
        }
    }
}

// Render success details
function renderSuccessDetails(appointment) {
    const doctor = selectedDoctor.doctor;
    const formattedDate = new Date(selectedDate).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    successAppointmentDetails.innerHTML = `
        <div class="summary-section">
            <h4>Appointment Confirmed</h4>
            <div class="summary-grid">
                <div class="summary-item">
                    <span class="label">Appointment ID:</span>
                    <span class="value highlight">#${appointment.appointment_id}</span>
                </div>
                <div class="summary-item">
                    <span class="label">Doctor:</span>
                    <span class="value">${doctor.doctor_name}</span>
                </div>
                <div class="summary-item">
                    <span class="label">Date:</span>
                    <span class="value">${formattedDate}</span>
                </div>
                <div class="summary-item">
                    <span class="label">Time:</span>
                    <span class="value">${formatTime(selectedTimeSlot.start_time)} - ${formatTime(selectedTimeSlot.finish_time)}</span>
                </div>
                <div class="summary-item">
                    <span class="label">Serial Number:</span>
                    <span class="value highlight">#${appointment.serial_no}</span>
                </div>
                <div class="summary-item">
                    <span class="label">Branch:</span>
                    <span class="value">${selectedTimeSlot.branch_name}</span>
                </div>
            </div>
        </div>
    `;
}

// Reset form for new appointment
function resetForm() {
    // Reset state
    selectedDoctor = null;
    selectedDate = null;
    selectedTimeSlot = null;
    availableTimeSlots = [];

    // Reset UI
    selectedDoctorInfo.innerHTML = '';
    appointmentDateInput.value = '';
    timeSlotsGrid.innerHTML = '';
    appointmentSummary.innerHTML = '';
    successAppointmentDetails.innerHTML = '';

    // Reset progress
    goToStep(1);
}

 