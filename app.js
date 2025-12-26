// ============================================
// FIELD REPORTING ASSIST - MAIN APPLICATION
// Version: 1.0
// ============================================

// API Configuration
const API_URL = 'https://script.google.com/macros/s/AKfycbyimeEt2uytqh5ECIb-0KLgtESHZRWc9UQn7MwR_uqnXrYQxmwyNkXZUeFzEyGTjvhRuQ/exec';
// ============================================
// API CALL FUNCTION - THIS WAS MISSING!
// ============================================

async function apiCall(params) {
    const API_URL = 'https://script.google.com/macros/s/AKfycbyimeEt2uytqh5ECIb-0KLgtESHZRWc9UQn7MwR_uqnXrYQxmwyNkXZUeFzEyGTjvhRuQ/exec';
    
    try {
        // Create form data for POST request
        const formData = new FormData();
        formData.append('data', JSON.stringify(params));
        
        const response = await fetch(API_URL, {
            method: 'POST',
            body: formData
        });
        
        // Check if response is ok
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        
        // Parse JSON response
        const result = await response.json();
        return result;
        
    } catch (error) {
        console.error('API Call Error:', error);
        
        // Try alternative method with URL params (GET)
        try {
            const queryString = encodeURIComponent(JSON.stringify(params));
            const getResponse = await fetch(`${API_URL}?data=${queryString}`, {
                method: 'GET',
                redirect: 'follow'
            });
            
            const text = await getResponse.text();
            
            // Try to parse as JSON
            try {
                return JSON.parse(text);
            } catch (e) {
                // If not JSON, return error
                throw new Error('Invalid response from server');
            }
            
        } catch (getError) {
            console.error('GET fallback also failed:', getError);
            throw new Error('Network error. Please check your connection.');
        }
    }
}

// Alternative apiCall for specific action format
async function apiCallAction(action, data = {}) {
    const payload = {
        action: action,
        ...data
    };
    return await apiCall(payload);
}
// App State
let appState = {
    isLoggedIn: false,
    userData: null,
    currentLocation: null,
    cachedData: {
        customers: [],
        stockists: [],
        products: [],
        areas: [],
        announcements: [],
        todayVisits: [],
        punchStatus: null
    },
    currentTab: null,
    idleTimer: null,
    idleWarningTimer: null,
    sessionTimeout: 15 * 60 * 1000, // 15 minutes
    warningTime: 60 * 1000, // 1 minute warning
    cameraStream: null,
    capturedPhoto: null,
    confirmCallback: null
};

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    initApp();
});

async function initApp() {
    // Show splash screen
    showSplash();
    
    // Load company logo
    await loadCompanyLogo();
    
    // Check for saved credentials
    checkSavedCredentials();
    
    // Check GPS status
    checkGPSStatus();
    
    // Setup event listeners
    setupEventListeners();
    
    // Hide splash after 2 seconds
    setTimeout(() => {
        hideSplash();
        if (appState.isLoggedIn) {
            showMainScreen();
        } else {
            showLoginScreen();
        }
    }, 2500);
}

function showSplash() {
    document.getElementById('splashScreen').classList.remove('hidden');
}

function hideSplash() {
    document.getElementById('splashScreen').classList.add('hidden');
}

function showLoginScreen() {
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('mainScreen').classList.add('hidden');
}

function showMainScreen() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('mainScreen').classList.remove('hidden');
    
    // Update UI with user data
    updateUserUI();
    
    // Load initial data
    syncAllData();
    
    // Start idle timer
    startIdleTimer();
    
    // Setup auto-sync
    setupAutoSync();
}

// ============================================
// COMPANY LOGO
// ============================================

async function loadCompanyLogo() {
    try {
        const response = await apiCall({ action: 'getCompanyLogo' });
        if (response.success && response.logo) {
            document.getElementById('splashLogo').src = response.logo;
            document.getElementById('loginLogo').src = response.logo;
            document.getElementById('headerLogo').src = response.logo;
        } else {
            // Use default icon
            setDefaultLogo();
        }
    } catch (error) {
        console.error('Error loading logo:', error);
        setDefaultLogo();
    }
}

function setDefaultLogo() {
    const defaultLogo = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="#4A90E2" width="100" height="100" rx="20"/><text x="50" y="60" font-size="40" fill="white" text-anchor="middle" font-family="Arial, sans-serif">FR</text></svg>');
    document.getElementById('splashLogo').src = defaultLogo;
    document.getElementById('loginLogo').src = defaultLogo;
    document.getElementById('headerLogo').src = defaultLogo;
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
    // Login form
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    
    // Back button handling
    window.addEventListener('popstate', handleBackButton);
    
    // Activity detection for idle timer
    ['click', 'touchstart', 'keypress', 'scroll'].forEach(event => {
        document.addEventListener(event, resetIdleTimer);
    });
    
    // Prevent pull-to-refresh
    document.body.addEventListener('touchmove', function(e) {
        if (document.getElementById('tabContainer').scrollTop === 0) {
            e.preventDefault();
        }
    }, { passive: false });
}

// ============================================
// GPS FUNCTIONS
// ============================================

function checkGPSStatus() {
    if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                appState.currentLocation = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                };
                updateGPSStatusUI(true);
            },
            (error) => {
                updateGPSStatusUI(false);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    } else {
        updateGPSStatusUI(false);
    }
}

function updateGPSStatusUI(isActive) {
    const gpsStatus = document.getElementById('gpsStatus');
    if (isActive) {
        gpsStatus.className = 'gps-status active';
        gpsStatus.innerHTML = '<i class="fas fa-map-marker-alt"></i><span>GPS Status: ON</span>';
    } else {
        gpsStatus.className = 'gps-status inactive';
        gpsStatus.innerHTML = '<i class="fas fa-map-marker-alt"></i><span>GPS Status: OFF</span>';
    }
}

async function getCurrentLocation() {
    return new Promise((resolve, reject) => {
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    appState.currentLocation = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude
                    };
                    resolve(appState.currentLocation);
                },
                (error) => {
                    reject(error);
                },
                { enableHighAccuracy: true, timeout: 15000 }
            );
        } else {
            reject(new Error('Geolocation not supported'));
        }
    });
}

async function getAddressFromCoordinates(lat, lng) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
        const data = await response.json();
        return data.display_name || 'Address not found';
    } catch (error) {
        console.error('Error getting address:', error);
        return 'Address not found';
    }
}

// ============================================
// LOGIN / LOGOUT
// ============================================

function checkSavedCredentials() {
    const savedCredentials = localStorage.getItem('fra_credentials');
    const savedUserData = localStorage.getItem('fra_userData');
    
    if (savedCredentials && savedUserData) {
        appState.userData = JSON.parse(savedUserData);
        appState.isLoggedIn = true;
        
        // Pre-fill login form
        const creds = JSON.parse(savedCredentials);
        document.getElementById('userCode').value = creds.userCode || '';
        document.getElementById('password').value = creds.password || '';
        document.getElementById('mobile').value = creds.mobile || '';
        document.getElementById('rememberMe').checked = true;
    }
}

async function handleLogin(e) {
    e.preventDefault();
    
    const userCode = document.getElementById('userCode').value.trim();
    const password = document.getElementById('password').value;
    const mobile = document.getElementById('mobile').value.trim();
    const rememberMe = document.getElementById('rememberMe').checked;
    
    // Check GPS
    if (!appState.currentLocation) {
        try {
            await getCurrentLocation();
        } catch (error) {
            showAlert('Please enable GPS to login!');
            return;
        }
    }
    
    showLoading();
    
    try {
        const response = await apiCall({
            action: 'login',
            userCode: userCode,
            password: password,
            mobile: mobile,
            gpsStatus: 'ON'
        });
        
        hideLoading();
        
        if (response.success) {
            appState.isLoggedIn = true;
            appState.userData = response.userData;
            
            // Save to localStorage
            localStorage.setItem('fra_userData', JSON.stringify(response.userData));
            
            if (rememberMe) {
                localStorage.setItem('fra_credentials', JSON.stringify({
                    userCode: userCode,
                    password: password,
                    mobile: mobile
                }));
            } else {
                localStorage.removeItem('fra_credentials');
            }
            
            showToast('Login successful!', 'success');
            showMainScreen();
        } else {
            showAlert(response.message || 'Login failed!');
        }
    } catch (error) {
        hideLoading();
        showAlert('Network error. Please try again.');
        console.error('Login error:', error);
    }
}

function logout() {
    showConfirm('Logout', 'Are you sure you want to logout?', (confirmed) => {
        if (confirmed) {
            appState.isLoggedIn = false;
            appState.userData = null;
            localStorage.removeItem('fra_userData');
            
            // Clear cached data
            appState.cachedData = {
                customers: [],
                stockists: [],
                products: [],
                areas: [],
                announcements: [],
                todayVisits: [],
                punchStatus: null
            };
            
            // Stop timers
            clearTimeout(appState.idleTimer);
            clearTimeout(appState.idleWarningTimer);
            
            showToast('Logged out successfully!', 'success');
            showLoginScreen();
            closeTab();
        }
    });
}

function togglePassword() {
    const passwordInput = document.getElementById('password');
    const toggleIcon = document.getElementById('passwordToggleIcon');
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleIcon.className = 'fas fa-eye-slash';
    } else {
        passwordInput.type = 'password';
        toggleIcon.className = 'fas fa-eye';
    }
}

// ============================================
// IDLE TIMER / SESSION MANAGEMENT
// ============================================

function startIdleTimer() {
    resetIdleTimer();
}

function resetIdleTimer() {
    // Clear existing timers
    clearTimeout(appState.idleTimer);
    clearTimeout(appState.idleWarningTimer);
    
    // Hide session modal if visible
    document.getElementById('sessionModal').classList.add('hidden');
    
    // Set warning timer (14 minutes)
    appState.idleWarningTimer = setTimeout(() => {
        showSessionWarning();
    }, appState.sessionTimeout - appState.warningTime);
    
    // Set logout timer (15 minutes)
    appState.idleTimer = setTimeout(() => {
        autoLogout();
    }, appState.sessionTimeout);
}

function showSessionWarning() {
    document.getElementById('sessionModal').classList.remove('hidden');
    
    let countdown = 60;
    const countdownEl = document.getElementById('sessionCountdown');
    
    const interval = setInterval(() => {
        countdown--;
        countdownEl.textContent = countdown;
        
        if (countdown <= 0) {
            clearInterval(interval);
        }
    }, 1000);
}

function autoLogout() {
    document.getElementById('sessionModal').classList.add('hidden');
    
    appState.isLoggedIn = false;
    appState.userData = null;
    localStorage.removeItem('fra_userData');
    
    showToast('Session expired. Please login again.', 'warning');
    showLoginScreen();
    closeTab();
}

// ============================================
// DATA SYNC
// ============================================

function setupAutoSync() {
    // Auto sync every 5 minutes
    setInterval(() => {
        if (appState.isLoggedIn) {
            syncAllData(true);
        }
    }, 5 * 60 * 1000);
}

async function syncAllData(silent = false) {
    if (!silent) {
        document.getElementById('syncIcon').classList.add('fa-spin');
    }
    
    try {
        const response = await apiCall({
            action: 'syncAllData',
            userCode: appState.userData.userCode
        });
        
        if (response.success) {
            appState.cachedData.customers = response.data.customers.customers || [];
            appState.cachedData.stockists = response.data.stockists.stockists || [];
            appState.cachedData.products = response.data.products.products || [];
            appState.cachedData.areas = response.data.areas.areas || [];
            appState.cachedData.announcements = response.data.announcements.announcements || [];
            appState.cachedData.punchStatus = response.data.punchStatus;
            appState.cachedData.todayVisits = response.data.todayVisits;
            
            // Update UI elements
            updatePunchStatusUI();
            updateTodayStatsUI();
            updateAnnouncementBadge();
            
            // Save to local storage for offline access
            localStorage.setItem('fra_cachedData', JSON.stringify(appState.cachedData));
            
            if (!silent) {
                showToast('Data synced successfully!', 'success');
            }
        }
    } catch (error) {
        console.error('Sync error:', error);
        if (!silent) {
            showToast('Sync failed. Please try again.', 'error');
        }
        
        // Try to load from local storage
        const cachedData = localStorage.getItem('fra_cachedData');
        if (cachedData) {
            appState.cachedData = JSON.parse(cachedData);
        }
    }
    
    document.getElementById('syncIcon').classList.remove('fa-spin');
}

function manualSync() {
    const syncBtn = document.querySelector('.sync-btn');
    syncBtn.classList.add('syncing');
    
    syncAllData().then(() => {
        syncBtn.classList.remove('syncing');
    });
}

// ============================================
// UI UPDATE FUNCTIONS
// ============================================

function updateUserUI() {
    if (appState.userData) {
        document.getElementById('headerUserName').textContent = appState.userData.name.split(' ')[0];
        document.getElementById('welcomeName').textContent = appState.userData.name.split(' ')[0];
        
        // Set date
        const today = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        document.getElementById('welcomeDate').textContent = today.toLocaleDateString('en-IN', options);
        
        // Set default avatar
        const defaultAvatar = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle fill="#4A90E2" cx="50" cy="50" r="50"/><text x="50" y="60" font-size="35" fill="white" text-anchor="middle" font-family="Arial">' + appState.userData.name.charAt(0).toUpperCase() + '</text></svg>');
        document.getElementById('headerUserPhoto').src = defaultAvatar;
    }
}

function updatePunchStatusUI() {
    const status = appState.cachedData.punchStatus;
    const statusEl = document.getElementById('punchStatus');
    
    if (status) {
        if (status.isPunchedOut) {
            statusEl.textContent = 'Day Complete';
            statusEl.style.color = '#50C878';
        } else if (status.isPunchedIn) {
            statusEl.textContent = 'Punched In';
            statusEl.style.color = '#4A90E2';
        } else {
            statusEl.textContent = 'Not Started';
            statusEl.style.color = '#7F8C8D';
        }
    }
}

function updateTodayStatsUI() {
    const todayVisits = appState.cachedData.todayVisits;
    
    if (todayVisits && todayVisits.summary) {
        const totalVisits = todayVisits.summary.totalCustomerVisits + todayVisits.summary.totalStockistVisits;
        document.getElementById('todayVisitsCount').textContent = totalVisits;
        document.getElementById('todayOrdersValue').textContent = '₹' + formatNumber(todayVisits.summary.totalOrderValue);
    }
}

function updateAnnouncementBadge() {
    const badge = document.getElementById('announceBadge');
    const count = appState.cachedData.announcements.length;
    
    if (count > 0) {
        badge.textContent = count;
        badge.style.display = 'block';
    } else {
        badge.style.display = 'none';
    }
}

// ============================================
// TAB NAVIGATION
// ============================================

async function openTab(tabName) {
    // Check if punched in (except for certain tabs)
    const exemptTabs = ['punchInOut', 'profile', 'announcements', 'nwDays'];
    
    if (!exemptTabs.includes(tabName)) {
        const punchStatus = appState.cachedData.punchStatus;
        if (!punchStatus || !punchStatus.isPunchedIn) {
            showAlert('Please Start Your Day First! You need to Punch In before accessing this feature.');
            return;
        }
        
        // Check for pending items
        const pendingCheck = await checkPendingItems();
        if (pendingCheck) {
            return;
        }
    }
    
    appState.currentTab = tabName;
    
    // Push state for back button
    history.pushState({ tab: tabName }, '', '#' + tabName);
    
    // Generate tab content
    const tabContainer = document.getElementById('tabContainer');
    tabContainer.innerHTML = '';
    tabContainer.classList.remove('hidden');
    document.getElementById('homeContent').classList.add('hidden');
    
    switch(tabName) {
        case 'punchInOut':
            renderPunchInOut(tabContainer);
            break;
        case 'customers':
            renderCustomers(tabContainer);
            break;
        case 'stockist':
            renderStockist(tabContainer);
            break;
        case 'todayVisits':
            renderTodayVisits(tabContainer);
            break;
        case 'directPOB':
            renderDirectPOB(tabContainer);
            break;
        case 'nearBy':
            renderNearBy(tabContainer);
            break;
        case 'expenses':
            renderExpenses(tabContainer);
            break;
        case 'tourPlan':
            renderTourPlan(tabContainer);
            break;
        case 'reports':
            renderReports(tabContainer);
            break;
        case 'dailyWork':
            renderDailyWork(tabContainer);
            break;
        case 'nwDays':
            renderNWDays(tabContainer);
            break;
        case 'profile':
            renderProfile(tabContainer);
            break;
        case 'masterRequest':
            renderMasterRequest(tabContainer);
            break;
        case 'announcements':
            renderAnnouncements(tabContainer);
            break;
        default:
            closeTab();
    }
}

function closeTab() {
    document.getElementById('tabContainer').classList.add('hidden');
    document.getElementById('homeContent').classList.remove('hidden');
    appState.currentTab = null;
    history.pushState({ tab: null }, '', window.location.pathname);
}

function handleBackButton(e) {
    if (appState.currentTab) {
        closeTab();
    }
}

function goBack() {
    closeTab();
}

async function checkPendingItems() {
    try {
        const response = await apiCall({
            action: 'checkPendingItems',
            userCode: appState.userData.userCode
        });
        
        if (response.success && response.pendingItems.length > 0) {
            for (let item of response.pendingItems) {
                if (item.type === 'tourPlan') {
                    showAlert(item.message);
                    openTab('tourPlan');
                    return true;
                } else if (item.type === 'expenses') {
                    showAlert(item.message);
                    openTab('expenses');
                    return true;
                } else if (item.type === 'leave') {
                    showAlert(item.message);
                    return true;
                }
            }
        }
        return false;
    } catch (error) {
        console.error('Error checking pending items:', error);
        return false;
    }
}

// ============================================
// PUNCH IN/OUT
// ============================================

function renderPunchInOut(container) {
    const status = appState.cachedData.punchStatus || { isPunchedIn: false, isPunchedOut: false };
    
    const today = new Date();
    const dateStr = today.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    
    let buttonClass = 'punch-in';
    let buttonIcon = 'fa-sign-in-alt';
    let buttonText = 'PUNCH IN';
    let buttonSubText = 'Click Here to Start Your Day';
    
    if (status.isPunchedOut) {
        buttonClass = 'completed';
        buttonIcon = 'fa-check-circle';
        buttonText = 'DAY COMPLETED';
        buttonSubText = 'See you tomorrow!';
    } else if (status.isPunchedIn) {
        buttonClass = 'punch-out';
        buttonIcon = 'fa-sign-out-alt';
        buttonText = 'PUNCH OUT';
        buttonSubText = 'Click Here to End Your Day';
    }
    
    container.innerHTML = `
        <div class="tab-header">
            <button class="back-btn" onclick="goBack()">
                <i class="fas fa-arrow-left"></i>
            </button>
            <h2 class="tab-title">Punch In/Out</h2>
        </div>
        <div class="tab-content">
            <div class="punch-screen">
                <p class="punch-date">📅 ${dateStr}</p>
                <p class="punch-location" id="punchLocation">
                    <i class="fas fa-map-marker-alt"></i>
                    <span>Getting location...</span>
                </p>
                
                <button class="punch-button ${buttonClass} disabled" id="punchButton" onclick="handlePunch()">
                    <i class="fas ${buttonIcon}"></i>
                    <span>${buttonText}</span>
                    <small>${buttonSubText}</small>
                </button>
                
                <p id="punchTimer" class="punch-timer" style="color: #7F8C8D; margin-bottom: 20px;">⏳ Button enables in 3 sec...</p>
                
                <div class="punch-times">
                    <div class="punch-time-row">
                        <span class="punch-time-label">
                            <i class="fas fa-sign-in-alt" style="color: #50C878;"></i>
                            Punch In Time
                        </span>
                        <span class="punch-time-value ${status.punchInTime ? 'success' : ''}" id="punchInTimeDisplay">
                            ${status.punchInTime || '--:--'}
                            ${status.punchInTime ? '✅' : ''}
                        </span>
                    </div>
                    <div class="punch-time-row">
                        <span class="punch-time-label">
                            <i class="fas fa-sign-out-alt" style="color: #FF6B6B;"></i>
                            Punch Out Time
                        </span>
                        <span class="punch-time-value ${status.punchOutTime ? 'success' : ''}" id="punchOutTimeDisplay">
                            ${status.punchOutTime || '--:--'}
                            ${status.punchOutTime ? '✅' : ''}
                        </span>
                    </div>
                    ${status.isPunchedOut ? `
                    <div class="punch-time-row">
                        <span class="punch-time-label">
                            <i class="fas fa-clock" style="color: #4A90E2;"></i>
                            Working Hours
                        </span>
                        <span class="punch-time-value success">
                            ${calculateWorkingHours(status.punchInTime, status.punchOutTime)}
                        </span>
                    </div>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
    
    // Get current location
    updatePunchLocation();
    
    // Enable button after 3 seconds
    if (!status.isPunchedOut) {
        let countdown = 3;
        const timerEl = document.getElementById('punchTimer');
        const interval = setInterval(() => {
            countdown--;
            if (countdown > 0) {
                timerEl.textContent = `⏳ Button enables in ${countdown} sec...`;
            } else {
                clearInterval(interval);
                timerEl.textContent = '';
                document.getElementById('punchButton').classList.remove('disabled');
            }
        }, 1000);
    } else {
        document.getElementById('punchTimer').textContent = '';
    }
}

async function updatePunchLocation() {
    try {
        const location = await getCurrentLocation();
        const address = await getAddressFromCoordinates(location.latitude, location.longitude);
        document.getElementById('punchLocation').innerHTML = `
            <i class="fas fa-map-marker-alt"></i>
            <span>${address.substring(0, 50)}...</span>
        `;
    } catch (error) {
        document.getElementById('punchLocation').innerHTML = `
            <i class="fas fa-map-marker-alt"></i>
            <span>Location not available</span>
        `;
    }
}

async function handlePunch() {
    const status = appState.cachedData.punchStatus || { isPunchedIn: false, isPunchedOut: false };
    
    if (status.isPunchedOut) {
        return;
    }
    
    // Get current location
    showLoading();
    
    try {
        const location = await getCurrentLocation();
        
        if (status.isPunchedIn) {
            // Punch Out
            const response = await apiCall({
                action: 'punchOut',
                userCode: appState.userData.userCode,
                latitude: location.latitude,
                longitude: location.longitude
            });
            
            hideLoading();
            
            if (response.success) {
                showToast('Punch Out successful!', 'success');
                appState.cachedData.punchStatus.isPunchedOut = true;
                appState.cachedData.punchStatus.punchOutTime = response.punchOutTime;
                syncAllData(true);
                renderPunchInOut(document.getElementById('tabContainer'));
            } else {
                showAlert(response.message || 'Punch Out failed!');
            }
        } else {
            // Punch In
            const response = await apiCall({
                action: 'punchIn',
                userCode: appState.userData.userCode,
                latitude: location.latitude,
                longitude: location.longitude
            });
            
            hideLoading();
            
            if (response.success) {
                showToast('Punch In successful!', 'success');
                appState.cachedData.punchStatus = {
                    isPunchedIn: true,
                    isPunchedOut: false,
                    punchInTime: response.punchInTime,
                    punchOutTime: null
                };
                syncAllData(true);
                renderPunchInOut(document.getElementById('tabContainer'));
            } else {
                showAlert(response.message || 'Punch In failed!');
            }
        }
    } catch (error) {
        hideLoading();
        showAlert('GPS error. Please enable location and try again.');
    }
}

function calculateWorkingHours(punchIn, punchOut) {
    if (!punchIn || !punchOut) return '--:--';
    
    const inParts = punchIn.split(':');
    const outParts = punchOut.split(':');
    
    const inMinutes = parseInt(inParts[0]) * 60 + parseInt(inParts[1]);
    const outMinutes = parseInt(outParts[0]) * 60 + parseInt(outParts[1]);
    
    const diffMinutes = outMinutes - inMinutes;
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;
    
    return `${hours}h ${minutes}m`;
}

// ============================================
// CUSTOMERS
// ============================================

function renderCustomers(container) {
    const customers = appState.cachedData.customers || [];
    const areas = [...new Set(customers.map(c => c.beatArea))].filter(a => a);
    
    container.innerHTML = `
        <div class="tab-header">
            <button class="back-btn" onclick="goBack()">
                <i class="fas fa-arrow-left"></i>
            </button>
            <h2 class="tab-title">Customers</h2>
        </div>
        <div class="tab-content">
            <div class="search-bar">
                <i class="fas fa-search"></i>
                <input type="text" id="customerSearch" placeholder="Search by name, code, mobile..." onkeyup="filterCustomers()">
            </div>
            
            <div class="filter-dropdown">
                <select id="areaFilter" onchange="filterCustomers()">
                    <option value="">All Areas</option>
                    ${areas.map(area => `<option value="${area}">${area}</option>`).join('')}
                </select>
            </div>
            
            <div class="customer-list" id="customerList">
                ${renderCustomerList(customers)}
            </div>
        </div>
    `;
}

function renderCustomerList(customers) {
    if (customers.length === 0) {
        return `
            <div class="empty-state">
                <i class="fas fa-users"></i>
                <h4>No Customers Found</h4>
                <p>No customers are assigned to you yet.</p>
            </div>
        `;
    }
    
    return customers.map(customer => `
        <div class="customer-card" onclick="openCustomerVisit('${customer.customerID}')">
            <div class="customer-avatar">${customer.customerName.charAt(0)}</div>
            <div class="customer-info">
                <div class="customer-name">
                    ${customer.customerName}
                    <span class="customer-code">(${customer.customerID})</span>
                </div>
                <div class="customer-meta">
                    <span><i class="fas fa-tag"></i> ${customer.category || 'N/A'}</span>
                    <span><i class="fas fa-map-marker-alt"></i> ${customer.beatArea || 'N/A'}</span>
                </div>
            </div>
            <button class="info-btn" onclick="event.stopPropagation(); showCustomerInfo('${customer.customerID}')">
                <i class="fas fa-info"></i>
            </button>
        </div>
    `).join('');
}

function filterCustomers() {
    const searchTerm = document.getElementById('customerSearch').value.toLowerCase();
    const areaFilter = document.getElementById('areaFilter').value;
    
    let filtered = appState.cachedData.customers.filter(customer => {
        const matchesSearch = customer.customerName.toLowerCase().includes(searchTerm) ||
                            customer.customerID.toLowerCase().includes(searchTerm) ||
                            (customer.mobile && customer.mobile.includes(searchTerm));
        const matchesArea = !areaFilter || customer.beatArea === areaFilter;
        
        return matchesSearch && matchesArea;
    });
    
    document.getElementById('customerList').innerHTML = renderCustomerList(filtered);
}

async function showCustomerInfo(customerID) {
    showLoading();
    
    try {
        const response = await apiCall({
            action: 'getCustomerInfo',
            customerID: customerID
        });
        
        hideLoading();
        
        if (response.success) {
            const customer = appState.cachedData.customers.find(c => c.customerID === customerID);
            
            const popup = document.createElement('div');
            popup.className = 'info-popup';
            popup.id = 'customerInfoPopup';
            popup.innerHTML = `
                <div class="info-popup-content">
                    <div class="info-popup-header">
                        <h3>${customer.customerName}</h3>
                        <p>${customer.customerID}</p>
                    </div>
                    <div class="info-popup-body">
                        <div class="info-section">
                            <h4><i class="fas fa-calendar-check"></i> Last 5 Visits</h4>
                            <div class="info-list">
                                ${response.visits.length > 0 ? response.visits.map(v => `
                                    <div class="info-list-item">
                                        <span class="date">${v.date}</span>
                                    </div>
                                `).join('') : '<p style="color: #7F8C8D; text-align: center;">No visits yet</p>'}
                            </div>
                        </div>
                        <div class="info-section">
                            <h4><i class="fas fa-shopping-cart"></i> Last 5 Orders</h4>
                            <div class="info-list">
                                ${response.orders.length > 0 ? response.orders.map(o => `
                                    <div class="info-list-item">
                                        <span class="date">${o.date}</span>
                                        <span class="value">₹${formatNumber(o.orderValue)}</span>
                                    </div>
                                `).join('') : '<p style="color: #7F8C8D; text-align: center;">No orders yet</p>'}
                            </div>
                        </div>
                    </div>
                    <button class="info-popup-close" onclick="closeCustomerInfo()">Close</button>
                </div>
            `;
            
            document.body.appendChild(popup);
        }
    } catch (error) {
        hideLoading();
        showToast('Error loading customer info', 'error');
    }
}

function closeCustomerInfo() {
    const popup = document.getElementById('customerInfoPopup');
    if (popup) {
        popup.remove();
    }
}

// ============================================
// CUSTOMER VISIT
// ============================================

async function openCustomerVisit(customerID) {
    const customer = appState.cachedData.customers.find(c => c.customerID === customerID);
    if (!customer) return;
    
    // Check if already visited today
    const todayVisits = appState.cachedData.todayVisits?.visits || [];
    const alreadyVisited = todayVisits.find(v => v.customerID === customerID);
    
    if (alreadyVisited) {
        showAlert('Already visited this customer today!');
        return;
    }
    
    appState.currentVisitCustomer = customer;
    appState.capturedPhoto = null;
    
    const stockists = appState.cachedData.stockists || [];
    const products = appState.cachedData.products || [];
    
    const container = document.getElementById('tabContainer');
    container.innerHTML = `
        <div class="tab-header">
            <button class="back-btn" onclick="renderCustomers(document.getElementById('tabContainer'))">
                <i class="fas fa-arrow-left"></i>
            </button>
            <h2 class="tab-title">Customer Visit</h2>
            <div class="tab-header-right">
                <button class="submit-btn" onclick="submitCustomerVisit()" style="background: var(--gradient-success); color: white; padding: 8px 15px; border-radius: 8px;">
                    <i class="fas fa-check"></i>
                </button>
            </div>
        </div>
        <div class="tab-content visit-screen">
            <div class="visit-customer-info">
                <h3>${customer.customerName}</h3>
                <p>${customer.customerID} | ${customer.category || 'N/A'} | ${customer.beatArea || 'N/A'}</p>
            </div>
            
            <div class="selfie-section">
                <h4>📸 Capture Live Selfie</h4>
                <div class="selfie-preview" id="selfiePreview" onclick="openCamera()">
                    <i class="fas fa-camera"></i>
                </div>
                <button class="capture-btn" onclick="openCamera()">
                    <i class="fas fa-camera"></i> Take Selfie
                </button>
                <p class="selfie-note">⚠️ Gallery selection not allowed</p>
            </div>
            
            <div class="order-section">
                <h4>📦 Order</h4>
                <div class="order-toggle">
                    <input type="radio" name="orderYesNo" id="orderYes" value="Yes" onclick="toggleOrderDetails(true)">
                    <label for="orderYes"><i class="fas fa-check-circle"></i> Yes</label>
                    <input type="radio" name="orderYesNo" id="orderNo" value="No" onclick="toggleOrderDetails(false)" checked>
                    <label for="orderNo"><i class="fas fa-times-circle"></i> No</label>
                </div>
                
                <div class="order-details" id="orderDetails">
                    <div class="form-group">
                        <label>Select Stockist</label>
                        <select id="visitStockist">
                            <option value="">-- Select Stockist --</option>
                            ${stockists.map(s => `<option value="${s.stockistID}" data-name="${s.stockistName}">${s.stockistName}</option>`).join('')}
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label>Products</label>
                        <div class="product-list-order" id="productListOrder">
                            ${products.map(p => `
                                <div class="product-item">
                                    <span class="product-name">${p.productName} (${p.packingSize})</span>
                                    <input type="number" class="product-qty" min="0" value="0" 
                                        data-code="${p.productCode}" 
                                        data-name="${p.productName}"
                                        data-value="${p.valuePerUnit}"
                                        onchange="calculateOrderTotal()">
                                    <span class="product-value" id="value_${p.productCode}">₹0</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    
                    <div class="order-total">
                        <span>Total Order Value:</span>
                        <span id="orderTotalValue">₹0</span>
                    </div>
                </div>
            </div>
            
            <button class="submit-visit-btn" onclick="submitCustomerVisit()">
                <i class="fas fa-check-circle"></i>
                Submit Visit
            </button>
        </div>
    `;
}

function toggleOrderDetails(show) {
    const orderDetails = document.getElementById('orderDetails');
    if (show) {
        orderDetails.classList.add('visible');
    } else {
        orderDetails.classList.remove('visible');
    }
}

function calculateOrderTotal() {
    const products = document.querySelectorAll('.product-qty');
    let total = 0;
    
    products.forEach(input => {
        const qty = parseInt(input.value) || 0;
        const value = parseFloat(input.dataset.value) || 0;
        const productValue = qty * value;
        
        document.getElementById('value_' + input.dataset.code).textContent = '₹' + formatNumber(productValue);
        total += productValue;
    });
    
    document.getElementById('orderTotalValue').textContent = '₹' + formatNumber(total);
}

async function submitCustomerVisit() {
    // Validate selfie
    if (!appState.capturedPhoto) {
        showAlert('Please capture a selfie first!');
        return;
    }
    
    // Get current location
    showLoading();
    
    try {
        const location = await getCurrentLocation();
        
        // Check location radius
        const customer = appState.currentVisitCustomer;
        const distance = calculateDistance(
            location.latitude, 
            location.longitude, 
            customer.latitude, 
            customer.longitude
        );
        
        const allowedRadius = (customer.radius || 500) / 1000; // Convert to KM
        
        if (distance > allowedRadius) {
            hideLoading();
            showAlert(`You are ${distance.toFixed(2)} KM away from customer location. Visit cannot be submitted. Allowed radius: ${allowedRadius * 1000} meters`);
            return;
        }
        
        // Prepare order data
        const orderYesNo = document.querySelector('input[name="orderYesNo"]:checked').value;
        let orderDetails = '';
        let orderValue = 0;
        let stockistID = '';
        let stockistName = '';
        
        if (orderYesNo === 'Yes') {
            stockistID = document.getElementById('visitStockist').value;
            stockistName = document.getElementById('visitStockist').selectedOptions[0]?.dataset.name || '';
            
            if (!stockistID) {
                hideLoading();
                showAlert('Please select a stockist for the order!');
                return;
            }
            
            const products = [];
            document.querySelectorAll('.product-qty').forEach(input => {
                const qty = parseInt(input.value) || 0;
                if (qty > 0) {
                    products.push({
                        code: input.dataset.code,
                        name: input.dataset.name,
                        qty: qty,
                        value: qty * parseFloat(input.dataset.value)
                    });
                    orderValue += qty * parseFloat(input.dataset.value);
                }
            });
            
            orderDetails = JSON.stringify(products);
        }
        
        // Submit visit
        const response = await apiCall({
            action: 'submitVisit',
            userCode: appState.userData.userCode,
            visitType: 'Customer',
            customerID: customer.customerID,
            customerName: customer.customerName,
            latitude: location.latitude,
            longitude: location.longitude,
            selfieBase64: appState.capturedPhoto,
            orderYesNo: orderYesNo,
            stockistID: stockistID,
            stockistName: stockistName,
            orderValue: orderValue,
            orderDetails: orderDetails,
            remarks: ''
        });
        
        hideLoading();
        
        if (response.success) {
            showToast('Visit submitted successfully!', 'success');
            appState.capturedPhoto = null;
            appState.currentVisitCustomer = null;
            syncAllData(true);
            renderCustomers(document.getElementById('tabContainer'));
        } else {
            showAlert(response.message || 'Failed to submit visit!');
        }
    } catch (error) {
        hideLoading();
        showAlert('Error: ' + error.message);
    }
}

// ============================================
// STOCKIST
// ============================================

function renderStockist(container) {
    const stockists = appState.cachedData.stockists || [];
    
    container.innerHTML = `
        <div class="tab-header">
            <button class="back-btn" onclick="goBack()">
                <i class="fas fa-arrow-left"></i>
            </button>
            <h2 class="tab-title">Stockist</h2>
        </div>
        <div class="tab-content">
            <div class="stockist-list" id="stockistList">
                ${renderStockistList(stockists)}
            </div>
        </div>
    `;
}

function renderStockistList(stockists) {
    if (stockists.length === 0) {
        return `
            <div class="empty-state">
                <i class="fas fa-store"></i>
                <h4>No Stockists Found</h4>
                <p>No stockists are assigned to you yet.</p>
            </div>
        `;
    }
    
    return stockists.map(stockist => `
        <div class="stockist-card" onclick="openStockistVisit('${stockist.stockistID}')">
            <div class="stockist-avatar">${stockist.stockistName.charAt(0)}</div>
            <div class="stockist-info">
                <div class="stockist-name">
                    ${stockist.stockistName}
                    <span class="stockist-code">(${stockist.stockistID})</span>
                </div>
                <div class="stockist-meta">
                    <span><i class="fas fa-map-marker-alt"></i> ${stockist.address || 'N/A'}</span>
                </div>
            </div>
        </div>
    `).join('');
}

async function openStockistVisit(stockistID) {
    const stockist = appState.cachedData.stockists.find(s => s.stockistID === stockistID);
    if (!stockist) return;
    
    // Check if already visited today
    const todayVisits = appState.cachedData.todayVisits?.visits || [];
    const alreadyVisited = todayVisits.find(v => v.customerID === stockistID);
    
    if (alreadyVisited) {
        showAlert('Already visited this stockist today!');
        return;
    }
    
    appState.currentVisitStockist = stockist;
    appState.capturedPhoto = null;
    
    const container = document.getElementById('tabContainer');
    container.innerHTML = `
        <div class="tab-header">
            <button class="back-btn" onclick="renderStockist(document.getElementById('tabContainer'))">
                <i class="fas fa-arrow-left"></i>
            </button>
            <h2 class="tab-title">Stockist Visit</h2>
            <div class="tab-header-right">
                <button class="submit-btn" onclick="submitStockistVisit()" style="background: var(--gradient-success); color: white; padding: 8px 15px; border-radius: 8px;">
                    <i class="fas fa-check"></i>
                </button>
            </div>
        </div>
        <div class="tab-content visit-screen">
            <div class="visit-customer-info">
                <h3>${stockist.stockistName}</h3>
                <p>${stockist.stockistID} | ${stockist.address || 'N/A'}</p>
            </div>
            
            <div class="selfie-section">
                <h4>📸 Capture Live Selfie</h4>
                <div class="selfie-preview" id="selfiePreview" onclick="openCamera()">
                    <i class="fas fa-camera"></i>
                </div>
                <button class="capture-btn" onclick="openCamera()">
                    <i class="fas fa-camera"></i> Take Selfie
                </button>
                <p class="selfie-note">⚠️ Gallery selection not allowed</p>
            </div>
            
            <div style="background: #E8F5E9; padding: 15px; border-radius: 10px; margin-bottom: 20px;">
                <p style="color: #2E7D32; font-size: 0.9rem; margin: 0;">
                    <i class="fas fa-info-circle"></i> No location check required for stockist visit.<br>
                    <i class="fas fa-info-circle"></i> No order entry available.
                </p>
            </div>
            
            <button class="submit-visit-btn" onclick="submitStockistVisit()">
                <i class="fas fa-check-circle"></i>
                Submit Visit
            </button>
        </div>
    `;
}

async function submitStockistVisit() {
    // Validate selfie
    if (!appState.capturedPhoto) {
        showAlert('Please capture a selfie first!');
        return;
    }
    
    showLoading();
    
    try {
        const location = await getCurrentLocation();
        const stockist = appState.currentVisitStockist;
        
        const response = await apiCall({
            action: 'submitVisit',
            userCode: appState.userData.userCode,
            visitType: 'Stockist',
            customerID: stockist.stockistID,
            customerName: stockist.stockistName,
            latitude: location.latitude,
            longitude: location.longitude,
            selfieBase64: appState.capturedPhoto,
            orderYesNo: 'No',
            stockistID: '',
            stockistName: '',
            orderValue: 0,
            orderDetails: '',
            remarks: ''
        });
        
        hideLoading();
        
        if (response.success) {
            showToast('Stockist visit submitted successfully!', 'success');
            appState.capturedPhoto = null;
            appState.currentVisitStockist = null;
            syncAllData(true);
            renderStockist(document.getElementById('tabContainer'));
        } else {
            showAlert(response.message || 'Failed to submit visit!');
        }
    } catch (error) {
        hideLoading();
        showAlert('Error: ' + error.message);
    }
}

// ============================================
// TODAY VISITS
// ============================================

function renderTodayVisits(container) {
    const todayVisits = appState.cachedData.todayVisits || { visits: [], summary: { totalCustomerVisits: 0, totalStockistVisits: 0, totalOrderValue: 0 } };
    
    const today = new Date();
    const dateStr = today.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    
    container.innerHTML = `
        <div class="tab-header">
            <button class="back-btn" onclick="goBack()">
                <i class="fas fa-arrow-left"></i>
            </button>
            <h2 class="tab-title">Today Visits</h2>
            <div class="tab-header-right">
                <button onclick="openDatePicker()" style="background: var(--primary-color); color: white; padding: 8px 15px; border-radius: 8px;">
                    <i class="fas fa-calendar"></i>
                </button>
            </div>
        </div>
        <div class="tab-content">
            <div class="date-selector">
                <span id="selectedDate">${dateStr}</span>
            </div>
            
            <div class="summary-cards">
                <div class="summary-card">
                    <span class="value">${todayVisits.summary.totalCustomerVisits}</span>
                    <span class="label">Customers</span>
                </div>
                <div class="summary-card">
                    <span class="value">${todayVisits.summary.totalStockistVisits}</span>
                    <span class="label">Stockists</span>
                </div>
                <div class="summary-card">
                    <span class="value">₹${formatNumber(todayVisits.summary.totalOrderValue)}</span>
                    <span class="label">Order Value</span>
                </div>
            </div>
            
            <div class="visits-section">
                <h4>Customer Visits</h4>
                <div class="visit-list" id="customerVisitsList">
                    ${renderVisitList(todayVisits.visits.filter(v => v.visitType === 'Customer'))}
                </div>
            </div>
            
            <div class="visits-section">
                <h4>Stockist Visits</h4>
                <div class="visit-list" id="stockistVisitsList">
                    ${renderVisitList(todayVisits.visits.filter(v => v.visitType === 'Stockist'))}
                </div>
            </div>
        </div>
    `;
}

function renderVisitList(visits) {
    if (visits.length === 0) {
        return '<p style="text-align: center; color: #7F8C8D; padding: 20px;">No visits yet</p>';
    }
    
    return visits.map(visit => `
        <div class="visit-item">
            <div class="visit-icon">
                <i class="fas fa-check"></i>
            </div>
            <div class="visit-details">
                <h5>${visit.customerName}</h5>
                <p>${visit.visitTime} | ${visit.visitType}</p>
            </div>
            <div class="visit-value">${visit.orderValue > 0 ? '₹' + formatNumber(visit.orderValue) : '--'}</div>
        </div>
    `).join('');
}

function openDatePicker() {
    const input = document.createElement('input');
    input.type = 'date';
    input.onchange = function() {
        loadVisitsByDate(this.value);
    };
    input.click();
}

async function loadVisitsByDate(dateStr) {
    showLoading();
    
    try {
        const [year, month, day] = dateStr.split('-');
        const formattedDate = `${day}-${month}-${year}`;
        
        const response = await apiCall({
            action: 'getVisitsByDate',
            userCode: appState.userData.userCode,
            date: formattedDate
        });
        
        hideLoading();
        
        if (response.success) {
            document.getElementById('selectedDate').textContent = new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
            
            // Update summary
            const summaryCards = document.querySelectorAll('.summary-card .value');
            summaryCards[0].textContent = response.summary.totalCustomerVisits;
            summaryCards[1].textContent = response.summary.totalStockistVisits;
            summaryCards[2].textContent = '₹' + formatNumber(response.summary.totalOrderValue);
            
            // Update lists
            document.getElementById('customerVisitsList').innerHTML = renderVisitList(response.visits.filter(v => v.visitType === 'Customer'));
            document.getElementById('stockistVisitsList').innerHTML = renderVisitList(response.visits.filter(v => v.visitType === 'Stockist'));
        }
    } catch (error) {
        hideLoading();
        showToast('Error loading visits', 'error');
    }
}

// ============================================
// DIRECT POB
// ============================================

function renderDirectPOB(container) {
    const customers = appState.cachedData.customers || [];
    const areas = [...new Set(customers.map(c => c.beatArea))].filter(a => a);
    
    container.innerHTML = `
        <div class="tab-header">
            <button class="back-btn" onclick="goBack()">
                <i class="fas fa-arrow-left"></i>
            </button>
            <h2 class="tab-title">Direct POB</h2>
        </div>
        <div class="tab-content">
            <div style="background: #FFF3E0; padding: 15px; border-radius: 10px; margin-bottom: 20px;">
                <p style="color: #E65100; font-size: 0.85rem; margin: 0;">
                    <i class="fas fa-info-circle"></i> Use this for phone orders. No visit will be counted and no location check required.
                </p>
            </div>
            
            <div class="search-bar">
                <i class="fas fa-search"></i>
                <input type="text" id="pobCustomerSearch" placeholder="Search customer..." onkeyup="filterPOBCustomers()">
            </div>
            
            <div class="filter-dropdown">
                <select id="pobAreaFilter" onchange="filterPOBCustomers()">
                    <option value="">All Areas</option>
                    ${areas.map(area => `<option value="${area}">${area}</option>`).join('')}
                </select>
            </div>
            
            <div class="customer-list" id="pobCustomerList">
                ${customers.map(customer => `
                    <div class="customer-card" onclick="openDirectPOBOrder('${customer.customerID}')">
                        <div class="customer-avatar">${customer.customerName.charAt(0)}</div>
                        <div class="customer-info">
                            <div class="customer-name">
                                ${customer.customerName}
                                <span class="customer-code">(${customer.customerID})</span>
                            </div>
                            <div class="customer-meta">
                                <span><i class="fas fa-tag"></i> ${customer.category || 'N/A'}</span>
                                <span><i class="fas fa-map-marker-alt"></i> ${customer.beatArea || 'N/A'}</span>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function filterPOBCustomers() {
    const searchTerm = document.getElementById('pobCustomerSearch').value.toLowerCase();
    const areaFilter = document.getElementById('pobAreaFilter').value;
    
    let filtered = appState.cachedData.customers.filter(customer => {
        const matchesSearch = customer.customerName.toLowerCase().includes(searchTerm) ||
                            customer.customerID.toLowerCase().includes(searchTerm);
        const matchesArea = !areaFilter || customer.beatArea === areaFilter;
        
        return matchesSearch && matchesArea;
    });
    
    document.getElementById('pobCustomerList').innerHTML = filtered.map(customer => `
        <div class="customer-card" onclick="openDirectPOBOrder('${customer.customerID}')">
            <div class="customer-avatar">${customer.customerName.charAt(0)}</div>
            <div class="customer-info">
                <div class="customer-name">
                    ${customer.customerName}
                    <span class="customer-code">(${customer.customerID})</span>
                </div>
                <div class="customer-meta">
                    <span><i class="fas fa-tag"></i> ${customer.category || 'N/A'}</span>
                    <span><i class="fas fa-map-marker-alt"></i> ${customer.beatArea || 'N/A'}</span>
                </div>
            </div>
        </div>
    `).join('');
}

function openDirectPOBOrder(customerID) {
    const customer = appState.cachedData.customers.find(c => c.customerID === customerID);
    if (!customer) return;
    
    appState.currentPOBCustomer = customer;
    
    const stockists = appState.cachedData.stockists || [];
    const products = appState.cachedData.products || [];
    
    const container = document.getElementById('tabContainer');
    container.innerHTML = `
        <div class="tab-header">
            <button class="back-btn" onclick="renderDirectPOB(document.getElementById('tabContainer'))">
                <i class="fas fa-arrow-left"></i>
            </button>
            <h2 class="tab-title">Phone Order</h2>
        </div>
        <div class="tab-content">
            <div class="visit-customer-info">
                <h3>${customer.customerName}</h3>
                <p>${customer.customerID} | 📞 Phone Order Entry</p>
            </div>
            
            <div style="background: #E3F2FD; padding: 15px; border-radius: 10px; margin-bottom: 20px;">
                <p style="color: #1565C0; font-size: 0.85rem; margin: 0;">
                    ℹ️ No selfie required<br>
                    ℹ️ No visit will be counted<br>
                    ℹ️ No location check required
                </p>
            </div>
            
            <div class="order-section" style="background: white; padding: 20px; border-radius: 12px; box-shadow: var(--shadow-light);">
                <div class="form-group">
                    <label>Select Stockist *</label>
                    <select id="pobStockist" required>
                        <option value="">-- Select Stockist --</option>
                        ${stockists.map(s => `<option value="${s.stockistID}" data-name="${s.stockistName}">${s.stockistName}</option>`).join('')}
                    </select>
                </div>
                
                <div class="form-group">
                    <label>Products</label>
                    <div class="product-list-order">
                        ${products.map(p => `
                            <div class="product-item">
                                <span class="product-name">${p.productName} (${p.packingSize})</span>
                                <input type="number" class="product-qty pob-qty" min="0" value="0" 
                                    data-code="${p.productCode}" 
                                    data-name="${p.productName}"
                                    data-value="${p.valuePerUnit}"
                                    onchange="calculatePOBTotal()">
                                <span class="product-value" id="pob_value_${p.productCode}">₹0</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <div class="order-total">
                    <span>Total Order Value:</span>
                    <span id="pobTotalValue">₹0</span>
                </div>
            </div>
            
            <button class="submit-visit-btn" onclick="submitDirectPOB()" style="margin-top: 20px;">
                <i class="fas fa-check-circle"></i>
                Submit Order
            </button>
        </div>
    `;
}

function calculatePOBTotal() {
    const products = document.querySelectorAll('.pob-qty');
    let total = 0;
    
    products.forEach(input => {
        const qty = parseInt(input.value) || 0;
        const value = parseFloat(input.dataset.value) || 0;
        const productValue = qty * value;
        
        document.getElementById('pob_value_' + input.dataset.code).textContent = '₹' + formatNumber(productValue);
        total += productValue;
    });
    
    document.getElementById('pobTotalValue').textContent = '₹' + formatNumber(total);
}

async function submitDirectPOB() {
    const stockistID = document.getElementById('pobStockist').value;
    const stockistName = document.getElementById('pobStockist').selectedOptions[0]?.dataset.name || '';
    
    if (!stockistID) {
        showAlert('Please select a stockist!');
        return;
    }
    
    const products = [];
    let totalValue = 0;
    
    document.querySelectorAll('.pob-qty').forEach(input => {
        const qty = parseInt(input.value) || 0;
        if (qty > 0) {
            const value = qty * parseFloat(input.dataset.value);
            products.push({
                code: input.dataset.code,
                name: input.dataset.name,
                qty: qty,
                value: value
            });
            totalValue += value;
        }
    });
    
    if (products.length === 0) {
        showAlert('Please add at least one product!');
        return;
    }
    
    showLoading();
    
    try {
        const customer = appState.currentPOBCustomer;
        
        const response = await apiCall({
            action: 'submitDirectPOB',
            userCode: appState.userData.userCode,
            customerID: customer.customerID,
            customerName: customer.customerName,
            stockistID: stockistID,
            stockistName: stockistName,
            orderDetails: JSON.stringify(products),
            totalValue: totalValue
        });
        
        hideLoading();
        
        if (response.success) {
            showToast('Order submitted successfully!', 'success');
            appState.currentPOBCustomer = null;
            syncAllData(true);
            renderDirectPOB(document.getElementById('tabContainer'));
        } else {
            showAlert(response.message || 'Failed to submit order!');
        }
    } catch (error) {
        hideLoading();
        showAlert('Error: ' + error.message);
    }
}

// ============================================
// NEAR BY CUSTOMERS
// ============================================

async function renderNearBy(container) {
    container.innerHTML = `
        <div class="tab-header">
            <button class="back-btn" onclick="goBack()">
                <i class="fas fa-arrow-left"></i>
            </button>
            <h2 class="tab-title">Near By Customers</h2>
        </div>
        <div class="tab-content">
            <div class="map-container" id="nearByMap"></div>
            
            <div class="location-info" id="locationInfo">
                <i class="fas fa-map-marker-alt"></i>
                <span>Getting your location...</span>
            </div>
            
            <div class="nearby-list" id="nearByList">
                <div class="empty-state">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>Loading nearby customers...</p>
                </div>
            </div>
        </div>
    `;
    
    // Get location and load nearby customers
    try {
        const location = await getCurrentLocation();
        
        // Update location info
        const address = await getAddressFromCoordinates(location.latitude, location.longitude);
        document.getElementById('locationInfo').innerHTML = `
            <i class="fas fa-map-marker-alt"></i>
            <span>📍 Your Location: ${address.substring(0, 40)}... | 🔄 Radius: 5 KM</span>
        `;
        
        // Initialize map
        const map = L.map('nearByMap').setView([location.latitude, location.longitude], 14);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap'
        }).addTo(map);
        
        // Add user marker
        L.marker([location.latitude, location.longitude], {
            icon: L.divIcon({
                className: 'user-marker',
                html: '<div style="background: #4A90E2; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 10px rgba(0,0,0,0.3);"></div>',
                iconSize: [20, 20]
            })
        }).addTo(map).bindPopup('You are here');
        
        // Load nearby customers
        const response = await apiCall({
            action: 'getNearByCustomers',
            userCode: appState.userData.userCode,
            latitude: location.latitude,
            longitude: location.longitude
        });
        
        if (response.success && response.customers.length > 0) {
            // Add customer markers
            response.customers.forEach(customer => {
                L.marker([customer.latitude, customer.longitude], {
                    icon: L.divIcon({
                        className: 'customer-marker',
                        html: '<div style="background: #FF6B6B; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white;"></div>',
                        iconSize: [16, 16]
                    })
                }).addTo(map).bindPopup(customer.customerName);
            });
            
            // Render list
            document.getElementById('nearByList').innerHTML = response.customers.map(customer => `
                <div class="nearby-card" onclick="openCustomerVisit('${customer.customerID}')">
                    <div class="nearby-distance">
                        <span class="value">${customer.distance.toFixed(1)}</span>
                        <span class="unit">KM</span>
                    </div>
                    <div class="nearby-info">
                        <h5>${customer.customerName}</h5>
                        <p><i class="fas fa-tag"></i> ${customer.category} | <i class="fas fa-map-marker-alt"></i> ${customer.beatArea}</p>
                    </div>
                    <i class="fas fa-chevron-right" style="color: #BDC3C7;"></i>
                </div>
            `).join('');
        } else {
            document.getElementById('nearByList').innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-map-marker-alt"></i>
                    <h4>No Customers Nearby</h4>
                    <p>No customers found within 5 KM radius</p>
                </div>
            `;
        }
    } catch (error) {
        document.getElementById('locationInfo').innerHTML = `
            <i class="fas fa-exclamation-triangle" style="color: #FF6B6B;"></i>
            <span>Unable to get location. Please enable GPS.</span>
        `;
        document.getElementById('nearByList').innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h4>Location Error</h4>
                <p>Please enable GPS and try again</p>
            </div>
        `;
    }
}

// ============================================
// EXPENSES
// ============================================

function renderExpenses(container) {
    const today = new Date();
    const dateStr = today.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
    
    container.innerHTML = `
        <div class="tab-header">
            <button class="back-btn" onclick="goBack()">
                <i class="fas fa-arrow-left"></i>
            </button>
            <h2 class="tab-title">Expenses</h2>
        </div>
        <div class="tab-content">
            <div class="expense-form">
                <h4>📅 Date: ${dateStr}</h4>
                
                <div class="day-type-toggle" style="margin-top: 15px;">
                    <input type="radio" name="dayType" id="dayTypeHQ" value="HQ">
                    <label for="dayTypeHQ">HQ</label>
                    <input type="radio" name="dayType" id="dayTypeExHQ" value="Ex-HQ">
                    <label for="dayTypeExHQ">Ex-HQ</label>
                    <input type="radio" name="dayType" id="dayTypeOS" value="OS">
                    <label for="dayTypeOS">OS</label>
                </div>
                
                <div class="auto-fields" style="margin-top: 20px;">
                    <div class="auto-field-row">
                        <span class="label"><i class="fas fa-money-bill"></i> Day Allowance</span>
                        <span class="value" id="dayAllowance">₹0 <i class="fas fa-lock lock-icon"></i></span>
                    </div>
                    <div class="auto-field-row">
                        <span class="label"><i class="fas fa-mobile-alt"></i> Mobile Allowance</span>
                        <span class="value" id="mobileAllowance">₹0 <i class="fas fa-lock lock-icon"></i></span>
                    </div>
                    <div class="auto-field-row">
                        <span class="label"><i class="fas fa-road"></i> Total KM</span>
                        <span class="value" id="totalKM">0 KM <i class="fas fa-lock lock-icon"></i></span>
                    </div>
                    <div class="auto-field-row">
                        <span class="label"><i class="fas fa-car"></i> Fare (₹2.6/KM)</span>
                        <span class="value" id="fareAmount">₹0 <i class="fas fa-lock lock-icon"></i></span>
                    </div>
                </div>
                
                <div class="misc-section" style="margin-top: 20px;">
                    <h5>MISC Expense</h5>
                    <div class="form-group">
                        <label>Amount (₹)</label>
                        <input type="number" id="miscAmount" min="0" value="0" placeholder="Enter amount" onchange="calculateTotalExpense()">
                    </div>
                    <div class="form-group">
                        <label>Remark * (Required if amount > 0)</label>
                        <textarea id="miscRemark" rows="2" placeholder="Enter remark..."></textarea>
                    </div>
                </div>
                
                <div class="attachment-section">
                    <h5>📎 Attachments</h5>
                    <div class="attachment-buttons">
                        <button class="attachment-btn" onclick="addExpensePhoto()">
                            <i class="fas fa-camera"></i> Add Photo
                        </button>
                        <button class="attachment-btn" onclick="addExpenseFile()">
                            <i class="fas fa-file"></i> Add File
                        </button>
                    </div>
                    <div class="attachment-list" id="attachmentList"></div>
                </div>
            </div>
            
            <div class="expense-total">
                <span>💰 Total Expense:</span>
                <span id="totalExpense">₹0</span>
            </div>
            
            <div class="expense-buttons">
                <button class="save-expense-btn" onclick="saveExpense()">
                    <i class="fas fa-save"></i> Save Daily
                </button>
                <button class="submit-expense-btn" id="submitExpenseBtn" onclick="submitExpenses()" disabled>
                    <i class="fas fa-paper-plane"></i> Final Submit
                </button>
            </div>
            
            <p style="text-align: center; color: #7F8C8D; font-size: 0.8rem; margin-top: 15px;">
                ⚠️ Final Submit available after month end<br>
                ⚠️ Deadline: 3rd of next month
            </p>
        </div>
    `;
    
    // Check if month ended for enabling submit
    const currentDay = today.getDate();
    if (currentDay >= 1 && currentDay <= 3) {
        document.getElementById('submitExpenseBtn').disabled = false;
    }
}

function calculateTotalExpense() {
    // This would be calculated based on actual data from API
    const miscAmount = parseFloat(document.getElementById('miscAmount').value) || 0;
    // For now, showing just misc amount - actual calculation would include allowances
    document.getElementById('totalExpense').textContent = '₹' + formatNumber(miscAmount);
}

async function saveExpense() {
    const dayType = document.querySelector('input[name="dayType"]:checked')?.value;
    
    if (!dayType) {
        showAlert('Please select Day Type (HQ/Ex-HQ/OS)!');
        return;
    }
    
    const miscAmount = parseFloat(document.getElementById('miscAmount').value) || 0;
    const miscRemark = document.getElementById('miscRemark').value.trim();
    
    if (miscAmount > 0 && !miscRemark) {
        showAlert('Please enter remark for MISC expense!');
        return;
    }
    
    showLoading();
    
    try {
        const today = new Date();
        const dateStr = today.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
        
        const response = await apiCall({
            action: 'saveExpense',
            userCode: appState.userData.userCode,
            date: dateStr,
            dayType: dayType,
            miscAmount: miscAmount,
            miscRemark: miscRemark,
            attachments: [] // Would include actual attachment data
        });
        
        hideLoading();
        
        if (response.success) {
            showToast('Expense saved successfully!', 'success');
        } else {
            showAlert(response.message || 'Failed to save expense!');
        }
    } catch (error) {
        hideLoading();
        showAlert('Error: ' + error.message);
    }
}

function submitExpenses() {
    showConfirm('Submit Expenses', 'Are you sure you want to submit all expenses for last month? This action cannot be undone.', async (confirmed) => {
        if (confirmed) {
            showLoading();
            
            try {
                const today = new Date();
                const lastMonth = today.getMonth() === 0 ? 12 : today.getMonth();
                const year = today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear();
                
                const response = await apiCall({
                    action: 'submitExpenses',
                    userCode: appState.userData.userCode,
                    month: lastMonth,
                    year: year
                });
                
                hideLoading();
                
                if (response.success) {
                    showToast(response.message, 'success');
                } else {
                    showAlert(response.message || 'Failed to submit expenses!');
                }
            } catch (error) {
                hideLoading();
                showAlert('Error: ' + error.message);
            }
        }
    });
}

function addExpensePhoto() {
    openCamera('expense');
}

function addExpenseFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,.pdf';
    input.onchange = function(e) {
        if (e.target.files.length > 0) {
            const file = e.target.files[0];
            addAttachment(file.name);
        }
    };
    input.click();
}

function addAttachment(name) {
    const list = document.getElementById('attachmentList');
    const item = document.createElement('div');
    item.className = 'attachment-item';
    item.innerHTML = `
        <span><i class="fas fa-paperclip"></i> ${name}</span>
        <i class="fas fa-times attachment-remove" onclick="this.parentElement.remove()"></i>
    `;
    list.appendChild(item);
}

// ============================================
// TOUR PLAN
// ============================================

function renderTourPlan(container) {
    const today = new Date();
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const currentMonth = monthNames[today.getMonth()];
    const currentYear = today.getFullYear();
    
    const areas = appState.cachedData.areas || [];
    const daysInMonth = new Date(currentYear, today.getMonth() + 1, 0).getDate();
    
    let daysHTML = '';
    for (let i = 1; i <= daysInMonth; i++) {
        daysHTML += `
            <div class="tour-plan-row">
                <div class="tour-plan-date">${i}</div>
                <div class="tour-plan-select">
                    <select id="tourDay${i}">
                        <option value="">-- Select Area --</option>
                        ${areas.map(a => `<option value="${a.areaID}" data-name="${a.areaName}">${a.areaName} (${a.areaType})</option>`).join('')}
                    </select>
                </div>
            </div>
        `;
    }
    
    container.innerHTML = `
        <div class="tab-header">
            <button class="back-btn" onclick="goBack()">
                <i class="fas fa-arrow-left"></i>
            </button>
            <h2 class="tab-title">Tour Plan</h2>
        </div>
        <div class="tab-content">
            <div class="tour-plan-header">
                <div class="month-selector">
                    <span>${currentMonth} ${currentYear}</span>
                </div>
            </div>
            
            <div class="tour-plan-grid">
                ${daysHTML}
            </div>
            
            <div class="tour-plan-submit">
                <button onclick="submitTourPlan(${today.getMonth() + 1}, ${currentYear}, ${daysInMonth})">
                    <i class="fas fa-paper-plane"></i> Submit to HO
                </button>
            </div>
        </div>
    `;
}

async function submitTourPlan(month, year, daysInMonth) {
    const plans = [];
    
    for (let i = 1; i <= daysInMonth; i++) {
        const select = document.getElementById('tourDay' + i);
        if (select.value) {
            plans.push({
                date: i,
                areaID: select.value,
                areaName: select.selectedOptions[0]?.dataset.name || ''
            });
        }
    }
    
    if (plans.length === 0) {
        showAlert('Please select at least one area for tour plan!');
        return;
    }
    
    showLoading();
    
    try {
        const response = await apiCall({
            action: 'submitTourPlan',
            userCode: appState.userData.userCode,
            month: month,
            year: year,
            plans: plans
        });
        
        hideLoading();
        
        if (response.success) {
            showToast('Tour Plan submitted successfully!', 'success');
            goBack();
        } else {
            showAlert(response.message || 'Failed to submit tour plan!');
        }
    } catch (error) {
        hideLoading();
        showAlert('Error: ' + error.message);
    }
}

// ============================================
// REPORTS (Placeholder)
// ============================================

function renderReports(container) {
    container.innerHTML = `
        <div class="tab-header">
            <button class="back-btn" onclick="goBack()">
                <i class="fas fa-arrow-left"></i>
            </button>
            <h2 class="tab-title">Reports</h2>
        </div>
        <div class="tab-content">
            <div class="empty-state">
                <i class="fas fa-chart-bar"></i>
                <h4>Coming Soon</h4>
                <p>Reports feature will be implemented soon.</p>
            </div>
        </div>
    `;
}

// ============================================
// DAILY WORK (Placeholder)
// ============================================

function renderDailyWork(container) {
    container.innerHTML = `
        <div class="tab-header">
            <button class="back-btn" onclick="goBack()">
                <i class="fas fa-arrow-left"></i>
            </button>
            <h2 class="tab-title">Daily Work Reports</h2>
        </div>
        <div class="tab-content">
            <div class="empty-state">
                <i class="fas fa-clipboard-list"></i>
                <h4>Coming Soon</h4>
                <p>Daily Work Reports feature will be implemented soon.</p>
            </div>
        </div>
    `;
}

// ============================================
// NW DAYS
// ============================================

function renderNWDays(container) {
    container.innerHTML = `
        <div class="tab-header">
            <button class="back-btn" onclick="goBack()">
                <i class="fas fa-arrow-left"></i>
            </button>
            <h2 class="tab-title">NW Days</h2>
        </div>
        <div class="tab-content">
            <div class="nw-form">
                <h4>Apply Non-Working Day</h4>
                
                <div class="form-group">
                    <label>Day Type *</label>
                    <select id="nwDayType" onchange="handleNWTypeChange()">
                        <option value="">-- Select Day Type --</option>
                        <option value="Leave">Leave</option>
                        <option value="Meeting">Meeting</option>
                        <option value="Admin Day">Admin Day</option>
                    </select>
                </div>
                
                <div class="leave-type-section" id="leaveTypeSection">
                    <div class="form-group">
                        <label>Leave Type *</label>
                        <select id="leaveType">
                            <option value="">-- Select Leave Type --</option>
                            <option value="CL">CL (Casual Leave)</option>
                            <option value="PL">PL (Paid Leave)</option>
                            <option value="SL">SL (Sick Leave)</option>
                        </select>
                    </div>
                </div>
                
                <div class="date-range-section" id="dateRangeSection">
                    <label>Date Range *</label>
                    <div class="date-inputs">
                        <div class="form-group">
                            <label>From</label>
                            <input type="date" id="nwDateFrom">
                        </div>
                        <div class="form-group">
                            <label>To</label>
                            <input type="date" id="nwDateTo">
                        </div>
                    </div>
                </div>
                
                <div class="single-date-section" id="singleDateSection">
                    <div class="form-group">
                        <label>Date *</label>
                        <input type="date" id="nwDate">
                    </div>
                </div>
                
                <div class="form-group">
                    <label>Remark * (Mandatory)</label>
                    <textarea id="nwRemark" rows="3" placeholder="Enter reason/remark..."></textarea>
                </div>
                
                <button class="nw-submit-btn" onclick="submitNWDay()">
                    <i class="fas fa-paper-plane"></i> Submit
                </button>
            </div>
        </div>
    `;
}

function handleNWTypeChange() {
    const dayType = document.getElementById('nwDayType').value;
    
    document.getElementById('leaveTypeSection').classList.remove('visible');
    document.getElementById('dateRangeSection').classList.remove('visible');
    document.getElementById('singleDateSection').classList.remove('visible');
    
    if (dayType === 'Leave') {
        document.getElementById('leaveTypeSection').classList.add('visible');
        document.getElementById('dateRangeSection').classList.add('visible');
    } else if (dayType === 'Meeting' || dayType === 'Admin Day') {
        document.getElementById('singleDateSection').classList.add('visible');
    }
}

async function submitNWDay() {
    const dayType = document.getElementById('nwDayType').value;
    const remark = document.getElementById('nwRemark').value.trim();
    
    if (!dayType) {
        showAlert('Please select Day Type!');
        return;
    }
    
    if (!remark) {
        showAlert('Please enter a remark!');
        return;
    }
    
    let dates = [];
    let leaveType = '';
    
    if (dayType === 'Leave') {
        leaveType = document.getElementById('leaveType').value;
        if (!leaveType) {
            showAlert('Please select Leave Type!');
            return;
        }
        
        const fromDate = document.getElementById('nwDateFrom').value;
        const toDate = document.getElementById('nwDateTo').value;
        
        if (!fromDate || !toDate) {
            showAlert('Please select date range!');
            return;
        }
        
        // Generate dates array
        const from = new Date(fromDate);
        const to = new Date(toDate);
        
        while (from <= to) {
            dates.push(from.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-'));
            from.setDate(from.getDate() + 1);
        }
    } else {
        const date = document.getElementById('nwDate').value;
        if (!date) {
            showAlert('Please select date!');
            return;
        }
        const d = new Date(date);
        dates.push(d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-'));
    }
    
    showLoading();
    
    try {
        const response = await apiCall({
            action: 'submitNWDay',
            userCode: appState.userData.userCode,
            nwType: dayType,
            leaveType: leaveType,
            dates: dates,
            remark: remark
        });
        
        hideLoading();
        
        if (response.success) {
            showToast('NW Day submitted successfully!', 'success');
            goBack();
        } else {
            showAlert(response.message || 'Failed to submit!');
        }
    } catch (error) {
        hideLoading();
        showAlert('Error: ' + error.message);
    }
}

// ============================================
// PROFILE
// ============================================

async function renderProfile(container) {
    showLoading();
    
    try {
        const response = await apiCall({
            action: 'getProfile',
            userCode: appState.userData.userCode
        });
        
        hideLoading();
        
        const profile = response.profile || appState.userData;
        const photoLink = response.photoLink || '';
        
        const defaultAvatar = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle fill="#4A90E2" cx="50" cy="50" r="50"/><text x="50" y="60" font-size="35" fill="white" text-anchor="middle" font-family="Arial">' + profile.name.charAt(0).toUpperCase() + '</text></svg>');
        
        container.innerHTML = `
            <div class="tab-header">
                <button class="back-btn" onclick="goBack()">
                    <i class="fas fa-arrow-left"></i>
                </button>
                <h2 class="tab-title">Profile</h2>
            </div>
            <div class="tab-content">
                <div class="profile-header">
                    <div class="profile-photo">
                        <img id="profilePhotoImg" src="${photoLink || defaultAvatar}" alt="Profile">
                        <div class="profile-photo-edit" onclick="changeProfilePhoto()">
                            <i class="fas fa-camera"></i>
                        </div>
                    </div>
                    <h3 class="profile-name">${profile.name}</h3>
                    <p class="profile-designation">${profile.designation || 'Employee'}</p>
                </div>
                
                <div class="profile-fields">
                    <div class="profile-field">
                        <div class="profile-field-icon"><i class="fas fa-id-badge"></i></div>
                        <div class="profile-field-content">
                            <span class="profile-field-label">User Code</span>
                            <span class="profile-field-value">${profile.userCode}</span>
                        </div>
                        <i class="fas fa-lock profile-field-lock"></i>
                    </div>
                    <div class="profile-field">
                        <div class="profile-field-icon"><i class="fas fa-user"></i></div>
                        <div class="profile-field-content">
                            <span class="profile-field-label">Name</span>
                            <span class="profile-field-value">${profile.name}</span>
                        </div>
                        <i class="fas fa-lock profile-field-lock"></i>
                    </div>
                    <div class="profile-field">
                        <div class="profile-field-icon"><i class="fas fa-phone"></i></div>
                        <div class="profile-field-content">
                            <span class="profile-field-label">Mobile</span>
                            <span class="profile-field-value">${profile.mobile}</span>
                        </div>
                        <i class="fas fa-lock profile-field-lock"></i>
                    </div>
                    <div class="profile-field">
                        <div class="profile-field-icon"><i class="fas fa-envelope"></i></div>
                        <div class="profile-field-content">
                            <span class="profile-field-label">Email</span>
                            <input type="email" id="profileEmail" class="profile-field-value" value="${profile.email || ''}" style="border: none; background: transparent; width: 100%;">
                        </div>
                        <i class="fas fa-edit profile-field-edit"></i>
                    </div>
                    <div class="profile-field">
                        <div class="profile-field-icon"><i class="fas fa-map-marker-alt"></i></div>
                        <div class="profile-field-content">
                            <span class="profile-field-label">Territory</span>
                            <span class="profile-field-value">${profile.territory || 'N/A'}</span>
                        </div>
                        <i class="fas fa-lock profile-field-lock"></i>
                    </div>
                    <div class="profile-field">
                        <div class="profile-field-icon"><i class="fas fa-user-tie"></i></div>
                        <div class="profile-field-content">
                            <span class="profile-field-label">Reporting To</span>
                            <span class="profile-field-value">${profile.reportingTo || 'N/A'}</span>
                        </div>
                        <i class="fas fa-lock profile-field-lock"></i>
                    </div>
                </div>
                
                <button class="profile-save-btn" onclick="saveProfile()">
                    <i class="fas fa-save"></i> Save Changes
                </button>
                
                <button class="logout-btn" onclick="logout()">
                    <i class="fas fa-sign-out-alt"></i> Logout
                </button>
            </div>
        `;
    } catch (error) {
        hideLoading();
        showToast('Error loading profile', 'error');
    }
}

async function saveProfile() {
    const email = document.getElementById('profileEmail').value.trim();
    
    showLoading();
    
    try {
        const response = await apiCall({
            action: 'updateProfile',
            userCode: appState.userData.userCode,
            email: email
        });
        
        hideLoading();
        
        if (response.success) {
            showToast('Profile updated successfully!', 'success');
        } else {
            showAlert(response.message || 'Failed to update profile!');
        }
    } catch (error) {
        hideLoading();
        showAlert('Error: ' + error.message);
    }
}

function changeProfilePhoto() {
    openCamera('profile');
}

// ============================================
// MASTER REQUEST
// ============================================

function renderMasterRequest(container) {
    container.innerHTML = `
        <div class="tab-header">
            <button class="back-btn" onclick="goBack()">
                <i class="fas fa-arrow-left"></i>
            </button>
            <h2 class="tab-title">Master Request</h2>
        </div>
        <div class="tab-content">
            <div class="master-options">
                <div class="master-option" onclick="openExistingCustomerUpdate()">
                    <div class="master-option-icon update">
                        <i class="fas fa-edit"></i>
                    </div>
                    <div class="master-option-content">
                        <h4>Existing Customer Update</h4>
                        <p>Update details of existing customer</p>
                    </div>
                </div>
                
                <div class="master-option" onclick="openNewCustomerAddition()">
                    <div class="master-option-icon add">
                        <i class="fas fa-user-plus"></i>
                    </div>
                    <div class="master-option-content">
                        <h4>New Customer Addition</h4>
                        <p>Add a new customer to your list</p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function openExistingCustomerUpdate() {
    const customers = appState.cachedData.customers || [];
    const areas = appState.cachedData.areas || [];
    
    const container = document.getElementById('tabContainer');
    container.innerHTML = `
        <div class="tab-header">
            <button class="back-btn" onclick="renderMasterRequest(document.getElementById('tabContainer'))">
                <i class="fas fa-arrow-left"></i>
            </button>
            <h2 class="tab-title">Update Customer</h2>
        </div>
        <div class="tab-content">
            <div class="form-group">
                <label>Search & Select Customer</label>
                <select id="updateCustomerSelect" onchange="loadCustomerForUpdate()">
                    <option value="">-- Select Customer --</option>
                    ${customers.map(c => `<option value="${c.customerID}">${c.customerName} (${c.customerID})</option>`).join('')}
                </select>
            </div>
            
            <div id="updateCustomerForm" style="display: none;">
                <div class="form-group">
                    <label>Customer Code</label>
                    <input type="text" id="updateCustCode" readonly style="background: #f0f0f0;">
                </div>
                <div class="form-group">
                    <label>Customer Name *</label>
                    <input type="text" id="updateCustName" required>
                </div>
                <div class="form-group">
                    <label>Category *</label>
                    <select id="updateCustCategory">
                        <option value="">-- Select --</option>
                        <option value="Chemist">Chemist</option>
                        <option value="Wholeseller">Wholeseller</option>
                        <option value="General Store">General Store</option>
                        <option value="Paan Shop">Paan Shop</option>
                        <option value="Other">Other</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Area/City *</label>
                    <select id="updateCustArea">
                        <option value="">-- Select --</option>
                        ${areas.map(a => `<option value="${a.areaName}">${a.areaName}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Mobile Number</label>
                    <input type="tel" id="updateCustMobile" maxlength="10">
                </div>
                <div class="form-group">
                    <label>Address (Manual)</label>
                    <textarea id="updateCustAddressManual" rows="2"></textarea>
                </div>
                <div class="form-group">
                    <label>Address (GPS) 🔒</label>
                    <textarea id="updateCustAddressGPS" rows="2" readonly style="background: #f0f0f0;"></textarea>
                    <button type="button" onclick="captureGPSAddress('update')" style="margin-top: 10px; padding: 10px 20px; background: var(--gradient-primary); color: white; border-radius: 8px;">
                        <i class="fas fa-map-marker-alt"></i> Capture GPS Address
                    </button>
                </div>
                
                <button class="submit-visit-btn" onclick="submitCustomerUpdate()">
                    <i class="fas fa-check-circle"></i> Update Customer
                </button>
            </div>
        </div>
    `;
}

function loadCustomerForUpdate() {
    const customerID = document.getElementById('updateCustomerSelect').value;
    if (!customerID) {
              return;
    }
    
    const customer = appState.customers.find(c => c.customerID === customerID);
    if (customer) {
        document.getElementById('updateCustomerName').value = customer.customerName;
        document.getElementById('updateCustomerCategory').value = customer.category;
        document.getElementById('updateCustomerMobile').value = customer.mobile || '';
        document.getElementById('updateCustomerAddressManual').value = customer.addressManual || '';
        document.getElementById('updateCustomerAddressGPS').value = customer.addressGPS || '';
        
        // Set area dropdown
        const areaSelect = document.getElementById('updateCustomerArea');
        areaSelect.value = customer.beatArea || '';
    }
}

async function captureUpdateGPSAddress() {
    showLoading();
    try {
        const position = await getCurrentPosition();
        const address = await reverseGeocode(position.coords.latitude, position.coords.longitude);
        document.getElementById('updateCustomerAddressGPS').value = address;
        appState.tempLat = position.coords.latitude;
        appState.tempLong = position.coords.longitude;
        showToast('GPS Address captured!', 'success');
    } catch (error) {
        showToast('Failed to get GPS address', 'error');
    }
    hideLoading();
}

async function submitCustomerUpdate() {
    const customerID = document.getElementById('updateCustomerSelect').value;
    const customerName = document.getElementById('updateCustomerName').value.trim();
    const category = document.getElementById('updateCustomerCategory').value;
    const beatArea = document.getElementById('updateCustomerArea').value;
    const mobile = document.getElementById('updateCustomerMobile').value.trim();
    const addressManual = document.getElementById('updateCustomerAddressManual').value.trim();
    const addressGPS = document.getElementById('updateCustomerAddressGPS').value.trim();
    
    if (!customerID || !customerName || !category || !beatArea) {
        showToast('Please fill all required fields', 'error');
        return;
    }
    
    if (!appState.tempLat || !appState.tempLong) {
        showToast('Please capture GPS address first', 'error');
        return;
    }
    
    showLoading();
    try {
        const response = await apiCall('updateCustomer', {
            userCode: appState.userData.userCode,
            customerID: customerID,
            customerName: customerName,
            category: category,
            beatArea: beatArea,
            mobile: mobile,
            addressManual: addressManual,
            addressGPS: addressGPS,
            latitude: appState.tempLat,
            longitude: appState.tempLong
        });
        
        if (response.success) {
            showToast('Customer updated successfully!', 'success');
            await syncData();
            goBack();
        } else {
            showToast(response.message || 'Failed to update customer', 'error');
        }
    } catch (error) {
        showToast('Error updating customer', 'error');
    }
    hideLoading();
}

// ============================================
// NEW CUSTOMER ADDITION
// ============================================

function openNewCustomer() {
    const html = `
        <div class="tab-header">
            <button class="back-btn" onclick="goBack()">
                <i class="fas fa-arrow-left"></i>
            </button>
            <h2 class="tab-title">New Customer Addition</h2>
        </div>
        <div class="tab-content">
            <div class="info-note" style="background: rgba(80, 200, 120, 0.1); padding: 15px; border-radius: 12px; margin-bottom: 20px;">
                <p style="color: #50C878; font-size: 0.9rem;"><i class="fas fa-info-circle"></i> Customer Code will be auto-generated after submission.</p>
            </div>
            
            <form id="newCustomerForm" class="nw-form" onsubmit="submitNewCustomer(event)">
                <div class="form-group">
                    <label>Customer Name *</label>
                    <input type="text" id="newCustomerName" placeholder="Enter customer name" required>
                </div>
                
                <div class="form-group">
                    <label>Category *</label>
                    <select id="newCustomerCategory" required>
                        <option value="">Select Category</option>
                        <option value="Chemist">Chemist</option>
                        <option value="Wholeseller">Wholeseller</option>
                        <option value="General Store">General Store</option>
                        <option value="Paan Shop">Paan Shop</option>
                        <option value="Other">Other</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label>Area/City *</label>
                    <div class="search-bar" style="margin-bottom: 0;">
                        <i class="fas fa-search"></i>
                        <input type="text" id="newCustomerAreaSearch" placeholder="Type to search area..." oninput="filterNewCustomerAreas()">
                    </div>
                    <select id="newCustomerArea" required style="margin-top: 10px;">
                        <option value="">Select Area</option>
                        ${appState.areas.map(area => `<option value="${area.areaName}">${area.areaName}</option>`).join('')}
                    </select>
                </div>
                
                <div class="form-group">
                    <label>Mobile Number</label>
                    <input type="tel" id="newCustomerMobile" placeholder="Enter mobile number" pattern="[0-9]{10}" maxlength="10">
                </div>
                
                <div class="form-group">
                    <label>Address (Manual) *</label>
                    <textarea id="newCustomerAddressManual" placeholder="Enter complete address" rows="3" required></textarea>
                </div>
                
                <div class="form-group">
                    <label>Address (GPS) 🔒</label>
                    <textarea id="newCustomerAddressGPS" placeholder="Click button to capture GPS address" rows="2" readonly style="background: #f5f7fa;"></textarea>
                    <button type="button" class="capture-btn" style="margin-top: 10px; width: 100%;" onclick="captureNewGPSAddress()">
                        <i class="fas fa-map-marker-alt"></i> Capture GPS Address
                    </button>
                </div>
                
                <button type="submit" class="nw-submit-btn">
                    <i class="fas fa-plus"></i> Add Customer
                </button>
            </form>
        </div>
    `;
    
    showTabContent(html);
    appState.tempLat = null;
    appState.tempLong = null;
}

function filterNewCustomerAreas() {
    const searchValue = document.getElementById('newCustomerAreaSearch').value.toLowerCase();
    const select = document.getElementById('newCustomerArea');
    
    select.innerHTML = '<option value="">Select Area</option>';
    
    appState.areas.forEach(area => {
        if (area.areaName.toLowerCase().includes(searchValue)) {
            const option = document.createElement('option');
            option.value = area.areaName;
            option.textContent = area.areaName;
            select.appendChild(option);
        }
    });
}

async function captureNewGPSAddress() {
    showLoading();
    try {
        const position = await getCurrentPosition();
        const address = await reverseGeocode(position.coords.latitude, position.coords.longitude);
        document.getElementById('newCustomerAddressGPS').value = address;
        appState.tempLat = position.coords.latitude;
        appState.tempLong = position.coords.longitude;
        showToast('GPS Address captured!', 'success');
    } catch (error) {
        showToast('Failed to get GPS address', 'error');
    }
    hideLoading();
}

async function submitNewCustomer(event) {
    event.preventDefault();
    
    const customerName = document.getElementById('newCustomerName').value.trim();
    const category = document.getElementById('newCustomerCategory').value;
    const beatArea = document.getElementById('newCustomerArea').value;
    const mobile = document.getElementById('newCustomerMobile').value.trim();
    const addressManual = document.getElementById('newCustomerAddressManual').value.trim();
    const addressGPS = document.getElementById('newCustomerAddressGPS').value.trim();
    
    if (!customerName || !category || !beatArea || !addressManual) {
        showToast('Please fill all required fields', 'error');
        return;
    }
    
    if (!appState.tempLat || !appState.tempLong) {
        showToast('Please capture GPS address first', 'error');
        return;
    }
    
    showLoading();
    try {
        const response = await apiCall('addCustomer', {
            userCode: appState.userData.userCode,
            customerName: customerName,
            category: category,
            beatArea: beatArea,
            mobile: mobile,
            addressManual: addressManual,
            addressGPS: addressGPS,
            latitude: appState.tempLat,
            longitude: appState.tempLong
        });
        
        if (response.success) {
            showAlert('Success', `Customer added successfully!\n\nCustomer Code: ${response.customerID}`);
            await syncData();
            goBack();
            goBack(); // Go back to Master Request main screen
        } else {
            showToast(response.message || 'Failed to add customer', 'error');
        }
    } catch (error) {
        showToast('Error adding customer', 'error');
    }
    hideLoading();
}

// ============================================
// ANNOUNCEMENTS FUNCTIONS
// ============================================

function showAnnouncements() {
    const announcements = appState.announcements || [];
    
    const html = `
        <div class="tab-header">
            <button class="back-btn" onclick="goBack()">
                <i class="fas fa-arrow-left"></i>
            </button>
            <h2 class="tab-title">Announcements</h2>
        </div>
        <div class="tab-content">
            ${announcements.length === 0 ? `
                <div class="empty-state">
                    <i class="fas fa-bullhorn"></i>
                    <h4>No Announcements</h4>
                    <p>There are no announcements at this time.</p>
                </div>
            ` : `
                <div class="announcement-list">
                    ${announcements.map(ann => `
                        <div class="announcement-card" onclick="showAnnouncementDetail('${ann.id}')">
                            <div class="announcement-header">
                                <span class="announcement-title">
                                    <i class="fas fa-bullhorn"></i>
                                    ${ann.title}
                                </span>
                                <i class="fas fa-chevron-right announcement-arrow"></i>
                            </div>
                            <p class="announcement-date">${ann.date}</p>
                        </div>
                    `).join('')}
                </div>
            `}
        </div>
    `;
    
    showTabContent(html);
    
    // Update badge
    document.getElementById('announceBadge').textContent = announcements.length;
}

function showAnnouncementDetail(annId) {
    const announcement = appState.announcements.find(a => a.id === annId);
    if (!announcement) return;
    
    const html = `
        <div class="tab-header">
            <button class="back-btn" onclick="goBack()">
                <i class="fas fa-arrow-left"></i>
            </button>
            <h2 class="tab-title">Announcement</h2>
        </div>
        <div class="tab-content">
            <div class="announcement-detail">
                <div class="announcement-detail-header">
                    <h3><i class="fas fa-bullhorn"></i> ${announcement.title}</h3>
                    <p><i class="fas fa-calendar"></i> ${announcement.date}</p>
                </div>
                <div class="announcement-detail-body">
                    ${announcement.message.replace(/\n/g, '<br>')}
                </div>
            </div>
        </div>
    `;
    
    appState.navigationStack.push('announcements');
    showTabContent(html);
}

// ============================================
// PROFILE FUNCTIONS
// ============================================

function showProfile() {
    const profile = appState.profile || {};
    const photoLink = appState.profilePhoto || 'https://via.placeholder.com/100';
    
    const html = `
        <div class="tab-header">
            <button class="back-btn" onclick="goBack()">
                <i class="fas fa-arrow-left"></i>
            </button>
            <h2 class="tab-title">Profile</h2>
        </div>
        <div class="tab-content" style="padding: 0;">
            <div class="profile-header">
                <div class="profile-photo">
                    <img id="profilePhotoImg" src="${photoLink}" alt="Profile" onerror="this.src='https://via.placeholder.com/100'">
                    <div class="profile-photo-edit" onclick="changeProfilePhoto()">
                        <i class="fas fa-camera"></i>
                    </div>
                </div>
                <h3 class="profile-name">${profile.name || 'User'}</h3>
                <p class="profile-designation">${profile.designation || 'Employee'}</p>
            </div>
            
            <div style="padding: 20px;">
                <div class="profile-fields">
                    <div class="profile-field">
                        <div class="profile-field-icon">
                            <i class="fas fa-id-badge"></i>
                        </div>
                        <div class="profile-field-content">
                            <span class="profile-field-label">User Code</span>
                            <span class="profile-field-value">${profile.userCode || '-'}</span>
                        </div>
                        <i class="fas fa-lock profile-field-lock"></i>
                    </div>
                    
                    <div class="profile-field">
                        <div class="profile-field-icon">
                            <i class="fas fa-user"></i>
                        </div>
                        <div class="profile-field-content">
                            <span class="profile-field-label">Name</span>
                            <span class="profile-field-value">${profile.name || '-'}</span>
                        </div>
                        <i class="fas fa-lock profile-field-lock"></i>
                    </div>
                    
                    <div class="profile-field">
                        <div class="profile-field-icon">
                            <i class="fas fa-phone"></i>
                        </div>
                        <div class="profile-field-content">
                            <span class="profile-field-label">Mobile</span>
                            <span class="profile-field-value">${profile.mobile || '-'}</span>
                        </div>
                        <i class="fas fa-lock profile-field-lock"></i>
                    </div>
                    
                    <div class="profile-field">
                        <div class="profile-field-icon">
                            <i class="fas fa-envelope"></i>
                        </div>
                        <div class="profile-field-content">
                            <span class="profile-field-label">Email</span>
                            <input type="email" id="profileEmail" class="profile-field-value" value="${profile.email || ''}" placeholder="Enter email" style="border: none; background: transparent; width: 100%;">
                        </div>
                        <i class="fas fa-edit profile-field-edit" onclick="document.getElementById('profileEmail').focus()"></i>
                    </div>
                    
                    <div class="profile-field">
                        <div class="profile-field-icon">
                            <i class="fas fa-map-marker-alt"></i>
                        </div>
                        <div class="profile-field-content">
                            <span class="profile-field-label">Territory</span>
                            <span class="profile-field-value">${profile.territory || '-'}</span>
                        </div>
                        <i class="fas fa-lock profile-field-lock"></i>
                    </div>
                    
                    <div class="profile-field">
                        <div class="profile-field-icon">
                            <i class="fas fa-user-tie"></i>
                        </div>
                        <div class="profile-field-content">
                            <span class="profile-field-label">Reporting To</span>
                            <span class="profile-field-value">${profile.reportingTo || '-'}</span>
                        </div>
                        <i class="fas fa-lock profile-field-lock"></i>
                    </div>
                </div>
                
                <button class="profile-save-btn" onclick="saveProfile()">
                    <i class="fas fa-save"></i> Save Changes
                </button>
                
                <button class="logout-btn" onclick="confirmLogout()">
                    <i class="fas fa-sign-out-alt"></i> Logout
                </button>
            </div>
        </div>
    `;
    
    showTabContent(html);
}

function changeProfilePhoto() {
    appState.cameraCallback = async (imageData) => {
        showLoading();
        try {
            const response = await apiCall('updateProfilePhoto', {
                userCode: appState.userData.userCode,
                photoBase64: imageData
            });
            
            if (response.success) {
                appState.profilePhoto = response.photoLink;
                document.getElementById('profilePhotoImg').src = imageData;
                document.getElementById('headerUserPhoto').src = imageData;
                showToast('Profile photo updated!', 'success');
            } else {
                showToast('Failed to update photo', 'error');
            }
        } catch (error) {
            showToast('Error updating photo', 'error');
        }
        hideLoading();
    };
    
    openCamera();
}

async function saveProfile() {
    const email = document.getElementById('profileEmail').value.trim();
    
    showLoading();
    try {
        const response = await apiCall('updateProfile', {
            userCode: appState.userData.userCode,
            email: email
        });
        
        if (response.success) {
            appState.profile.email = email;
            showToast('Profile updated!', 'success');
        } else {
            showToast(response.message || 'Failed to update profile', 'error');
        }
    } catch (error) {
        showToast('Error updating profile', 'error');
    }
    hideLoading();
}

function confirmLogout() {
    showConfirm('Logout', 'Are you sure you want to logout?', (confirmed) => {
        if (confirmed) {
            logout();
        }
    });
}

function logout() {
    // Clear app state
    appState.isLoggedIn = false;
    appState.userData = null;
    appState.customers = [];
    appState.stockists = [];
    appState.products = [];
    appState.areas = [];
    appState.announcements = [];
    appState.punchStatus = {};
    appState.profile = {};
    
    // Clear session storage
    sessionStorage.removeItem('userData');
    sessionStorage.removeItem('isLoggedIn');
    
    // Show login screen
    document.getElementById('mainScreen').classList.add('hidden');
    document.getElementById('tabContainer').classList.add('hidden');
    document.getElementById('loginScreen').classList.remove('hidden');
    
    showToast('Logged out successfully', 'success');
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function showLoading() {
    document.getElementById('loadingOverlay').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.add('hidden');
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const icon = toast.querySelector('.toast-icon');
    const msg = toast.querySelector('.toast-message');
    
    toast.className = 'toast ' + type;
    msg.textContent = message;
    
    switch(type) {
        case 'success':
            icon.className = 'toast-icon fas fa-check-circle';
            break;
        case 'error':
            icon.className = 'toast-icon fas fa-times-circle';
            break;
        case 'warning':
            icon.className = 'toast-icon fas fa-exclamation-triangle';
            break;
        default:
            icon.className = 'toast-icon fas fa-info-circle';
    }
    
    toast.classList.remove('hidden');
    
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

function showAlert(title, message) {
    document.getElementById('alertMessage').textContent = message;
    document.querySelector('#alertModal .modal-title').textContent = title;
    document.getElementById('alertModal').classList.remove('hidden');
}

function closeAlertModal() {
    document.getElementById('alertModal').classList.add('hidden');
}

let confirmCallback = null;

function showConfirm(title, message, callback) {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    document.getElementById('confirmModal').classList.remove('hidden');
    confirmCallback = callback;
}

function closeConfirmModal(result) {
    document.getElementById('confirmModal').classList.add('hidden');
    if (confirmCallback) {
        confirmCallback(result);
        confirmCallback = null;
    }
}

function formatDate(date) {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
}

function formatTime(date) {
    const d = new Date(date);
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${hours}:${minutes} ${ampm}`;
}

function formatCurrency(amount) {
    return '₹' + parseFloat(amount || 0).toLocaleString('en-IN');
}

function getCurrentPosition() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation not supported'));
            return;
        }
        
        navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        });
    });
}

async function reverseGeocode(lat, lng) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
        const data = await response.json();
        return data.display_name || `${lat}, ${lng}`;
    } catch (error) {
        return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function toRad(deg) {
    return deg * (Math.PI/180);
}

// ============================================
// CAMERA FUNCTIONS
// ============================================

let cameraStream = null;

function openCamera() {
    const modal = document.getElementById('cameraModal');
    const video = document.getElementById('cameraVideo');
    const canvas = document.getElementById('cameraCanvas');
    const capturedImage = document.getElementById('capturedImage');
    const captureBtn = document.getElementById('captureBtn');
    const retakeBtn = document.getElementById('retakeBtn');
    const confirmPhotoBtn = document.getElementById('confirmPhotoBtn');
    
    // Reset UI
    video.classList.remove('hidden');
    capturedImage.classList.add('hidden');
    captureBtn.classList.remove('hidden');
    retakeBtn.classList.add('hidden');
    confirmPhotoBtn.classList.add('hidden');
    
    modal.classList.remove('hidden');
    
    // Start camera
    navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false
    }).then(stream => {
        cameraStream = stream;
        video.srcObject = stream;
    }).catch(error => {
        showToast('Failed to access camera', 'error');
        closeCameraModal();
    });
}

function capturePhoto() {
    const video = document.getElementById('cameraVideo');
    const canvas = document.getElementById('cameraCanvas');
    const capturedImage = document.getElementById('capturedImage');
    const captureBtn = document.getElementById('captureBtn');
    const retakeBtn = document.getElementById('retakeBtn');
    const confirmPhotoBtn = document.getElementById('confirmPhotoBtn');
    
    // Set canvas size
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw video frame to canvas
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    
    // Compress image to max 50KB
    let quality = 0.7;
    let imageData = canvas.toDataURL('image/jpeg', quality);
    
    // Reduce quality until under 50KB
    while (imageData.length > 50000 && quality > 0.1) {
        quality -= 0.1;
        imageData = canvas.toDataURL('image/jpeg', quality);
    }
    
    // If still too large, resize
    if (imageData.length > 50000) {
        const scale = Math.sqrt(50000 / imageData.length);
        canvas.width = video.videoWidth * scale;
        canvas.height = video.videoHeight * scale;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        imageData = canvas.toDataURL('image/jpeg', 0.5);
    }
    
    capturedImage.src = imageData;
    appState.capturedPhoto = imageData;
    
    // Update UI
    video.classList.add('hidden');
    capturedImage.classList.remove('hidden');
    captureBtn.classList.add('hidden');
    retakeBtn.classList.remove('hidden');
    confirmPhotoBtn.classList.remove('hidden');
}

function retakePhoto() {
    const video = document.getElementById('cameraVideo');
    const capturedImage = document.getElementById('capturedImage');
    const captureBtn = document.getElementById('captureBtn');
    const retakeBtn = document.getElementById('retakeBtn');
    const confirmPhotoBtn = document.getElementById('confirmPhotoBtn');
    
    video.classList.remove('hidden');
    capturedImage.classList.add('hidden');
    captureBtn.classList.remove('hidden');
    retakeBtn.classList.add('hidden');
    confirmPhotoBtn.classList.add('hidden');
    
    appState.capturedPhoto = null;
}

function confirmPhoto() {
    closeCameraModal();
    
    if (appState.cameraCallback && appState.capturedPhoto) {
        appState.cameraCallback(appState.capturedPhoto);
        appState.cameraCallback = null;
    }
}

function closeCameraModal() {
    const modal = document.getElementById('cameraModal');
    const video = document.getElementById('cameraVideo');
    
    // Stop camera stream
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
    
    video.srcObject = null;
    modal.classList.add('hidden');
}

// ============================================
// IDLE TIMEOUT (15 MINUTES)
// ============================================

let idleTimer = null;
let warningTimer = null;
let countdownTimer = null;
const IDLE_TIMEOUT = 15 * 60 * 1000; // 15 minutes
const WARNING_TIME = 60 * 1000; // 1 minute warning

function resetIdleTimer() {
    // Clear existing timers
    if (idleTimer) clearTimeout(idleTimer);
    if (warningTimer) clearTimeout(warningTimer);
    if (countdownTimer) clearInterval(countdownTimer);
    
    // Hide warning modal if visible
    document.getElementById('sessionModal').classList.add('hidden');
    
    // Only set timer if logged in
    if (!appState.isLoggedIn) return;
    
    // Set warning timer (14 minutes)
    warningTimer = setTimeout(() => {
        showSessionWarning();
    }, IDLE_TIMEOUT - WARNING_TIME);
    
    // Set logout timer (15 minutes)
    idleTimer = setTimeout(() => {
        logout();
        showToast('Session expired due to inactivity', 'warning');
    }, IDLE_TIMEOUT);
}

function showSessionWarning() {
    const modal = document.getElementById('sessionModal');
    const countdown = document.getElementById('sessionCountdown');
    let seconds = 60;
    
    modal.classList.remove('hidden');
    countdown.textContent = seconds;
    
    countdownTimer = setInterval(() => {
        seconds--;
        countdown.textContent = seconds;
        
        if (seconds <= 0) {
            clearInterval(countdownTimer);
        }
    }, 1000);
}

// Add event listeners for user activity
['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'].forEach(event => {
    document.addEventListener(event, resetIdleTimer, true);
});

// ============================================
// BACK BUTTON HANDLING
// ============================================

window.addEventListener('popstate', function(event) {
    if (appState.navigationStack.length > 0) {
        goBack();
    }
});

function goBack() {
    if (appState.navigationStack.length > 0) {
        const previousTab = appState.navigationStack.pop();
        
        if (appState.navigationStack.length === 0) {
            // Go to home
            document.getElementById('tabContainer').classList.add('hidden');
            document.getElementById('homeContent').classList.remove('hidden');
            appState.currentTab = 'home';
        } else {
            // Go to previous tab
            openTab(previousTab, false);
        }
    } else {
        // Already at home
        document.getElementById('tabContainer').classList.add('hidden');
        document.getElementById('homeContent').classList.remove('hidden');
        appState.currentTab = 'home';
    }
}

// ============================================
// SERVICE WORKER FOR PWA
// ============================================

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(registration => {
                console.log('ServiceWorker registered');
            })
            .catch(error => {
                console.log('ServiceWorker registration failed:', error);
            });
    });
}

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', init);
        
