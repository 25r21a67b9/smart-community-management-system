/**
 * ============================================================================
 * SMART COMMUNITY MANAGEMENT SYSTEM - FRONTEND APPLICATION CONTROLLER
 * Stack: HTML5, CSS3, Bootstrap 5.3, Bootstrap Icons, Chart.js, Vanilla JS
 * ============================================================================
 */

const AppState = {
  token:
    localStorage.getItem('sc_auth_token') ||
    sessionStorage.getItem('sc_auth_token') ||
    null,
  user: JSON.parse(
    localStorage.getItem('sc_auth_user') ||
      sessionStorage.getItem('sc_auth_user') ||
      'null'
  ),
  communityName: localStorage.getItem('sc_community_name') || 'Oakridge Heights Residency',
  isDemoSeeded: true,
  activePage: 'dashboard',
  selectedBillingMonth: 'October 2026',
  unreadNotifications: 0,
  charts: {},
  cache: {
    adminDashboard: null,
    residentDashboard: null,
    workerDashboard: null,
    flats: [],
    householdRequests: [],
    myHousehold: null,
    residents: [],
    visitors: [],
    complaints: [],
    priorityQueue: [],
    workers: [],
    payments: [],
    transactions: [],
    facilities: [],
    bookings: [],
    announcements: [],
    notifications: [],
    settings: null
  }
};

// ============================================================================
// UTILITY HELPERS
// ============================================================================
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatCurrency(amount) {
  const num = Number(amount) || 0;
  return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatCompactDate(dateObj = new Date()) {
  const weekday = dateObj.toLocaleDateString('en-GB', { weekday: 'short' });
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = dateObj.toLocaleDateString('en-GB', { month: 'short' });
  const year = dateObj.getFullYear();
  return `${weekday}, ${day} ${month} ${year}`;
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const iconMap = {
    success: 'bi-check-circle-fill text-success',
    danger: 'bi-exclamation-triangle-fill text-danger',
    warning: 'bi-exclamation-circle-fill text-warning',
    info: 'bi-info-circle-fill text-primary'
  };

  const toastEl = document.createElement('div');
  toastEl.className = 'toast align-items-center bg-white border shadow-sm mb-2';
  toastEl.setAttribute('role', 'alert');
  toastEl.innerHTML = `
    <div class="d-flex align-items-center px-3 py-2">
      <i class="bi ${iconMap[type] || iconMap.info} fs-5 me-2"></i>
      <div class="toast-body fw-medium text-dark px-1">${escapeHtml(message)}</div>
      <button type="button" class="btn-close ms-auto" data-bs-dismiss="toast" aria-label="Close"></button>
    </div>
  `;
  container.appendChild(toastEl);
  const bsToast = new bootstrap.Toast(toastEl, { delay: 4000 });
  bsToast.show();
  toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
}

let activeModalInstance = null;
function openModal(title, bodyHtml, sizeClass = 'modal-lg') {
  const titleEl = document.getElementById('scModalTitle');
  const bodyEl = document.getElementById('scModalBody');
  const dialogEl = document.getElementById('scModalDialog');
  const modalEl = document.getElementById('scModal');

  titleEl.textContent = title;
  bodyEl.innerHTML = bodyHtml;
  dialogEl.className = `modal-dialog modal-dialog-centered modal-dialog-scrollable ${sizeClass}`;

  if (!activeModalInstance) {
    activeModalInstance = new bootstrap.Modal(modalEl);
  }
  activeModalInstance.show();
}

function closeModal() {
  if (activeModalInstance) {
    activeModalInstance.hide();
  }
}

function getConfiguredBackendBaseUrl() {
  const winUrl =
    typeof window !== 'undefined' && window.SMART_COMMUNITY_API_BASE_URL
      ? String(window.SMART_COMMUNITY_API_BASE_URL).trim()
      : '';
  const storedUrl = localStorage.getItem('sc_api_base_url') || '';
  return (winUrl || storedUrl).replace(/\/+$/, '');
}

async function apiRequest(endpoint, options = {}) {
  const configuredBaseUrl = getConfiguredBackendBaseUrl();
  const vaultToken = localStorage.getItem('sc_account_vault') || '';

  const headers = {
    'Content-Type': 'application/json',
    ...(vaultToken ? { 'X-SC-Account-Vault': vaultToken } : {}),
    ...(options.headers || {})
  };
  if (AppState.token) {
    headers['Authorization'] = `Bearer ${AppState.token}`;
  }

  const requestUrl = configuredBaseUrl ? `${configuredBaseUrl}${endpoint}` : endpoint;
  let response;
  try {
    response = await fetch(requestUrl, {
      ...options,
      headers
    });
  } catch {
    throw new Error('Unable to reach the community server. Please check your network connection.');
  }

  if (response.status === 401 && !endpoint.includes('/api/auth/')) {
    handleLogout(false);
    throw new Error('Your session has expired. Please sign in again.');
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || data.message || `Request failed (${response.status})`);
  }
  return data;
}

function renderStatusBadge(status) {
  const s = String(status || '').trim();
  const map = {
    Active: 'sc-status-success',
    OCCUPIED: 'sc-status-success',
    Resolved: 'sc-status-success',
    Paid: 'sc-status-success',
    Confirmed: 'sc-status-success',
    Available: 'sc-status-success',
    Accepted: 'sc-status-info',
    Approved: 'sc-status-success',
    SUCCESS: 'sc-status-success',
    Exited: 'sc-status-neutral',
    VACANT: 'sc-status-neutral',
    Completed: 'sc-status-success',
    Pending: 'sc-status-warning',
    'Pending Acceptance': 'sc-status-warning',
    'Payment Processing': 'sc-status-info',
    Assigned: 'sc-status-info',
    'In Progress': 'sc-status-info',
    Inside: 'sc-status-info',
    Busy: 'sc-status-warning',
    Overdue: 'sc-status-danger',
    Declined: 'sc-status-danger',
    FAILED: 'sc-status-danger',
    CANCELLED: 'sc-status-neutral',
    High: 'sc-status-danger',
    Critical: 'sc-status-danger',
    Medium: 'sc-status-warning',
    Moderate: 'sc-status-warning',
    Low: 'sc-status-neutral',
    Inactive: 'sc-status-neutral',
    Cancelled: 'sc-status-danger',
    'Off Duty': 'sc-status-neutral'
  };
  const cls = map[s] || 'sc-status-neutral';
  return `<span class="sc-status ${cls}">${escapeHtml(s)}</span>`;
}

function destroyActiveCharts() {
  Object.values(AppState.charts).forEach((ch) => {
    if (ch && typeof ch.destroy === 'function') {
      ch.destroy();
    }
  });
  AppState.charts = {};
}

function getDefaultPageForRole(role) {
  if (role === 'RESIDENT') return 'resident-dashboard';
  if (role === 'WORKER') return 'worker-dashboard';
  return 'dashboard';
}

// ============================================================================
// MODULE 1: PROFESSIONAL LOGIN & RESIDENT REGISTRATION
// ============================================================================
function renderLoginScreen(errorMsg = '', prefill = {}) {
  destroyActiveCharts();
  const app = document.getElementById('app');
  const savedIdentifier = prefill.identifier || localStorage.getItem('sc_remembered_identifier') || '';
  const savedFlat = prefill.flatNumber || localStorage.getItem('sc_remembered_flat') || '';
  const successBanner = prefill.successMsg || '';

  app.innerHTML = `
    <div class="login-wrapper">
      <!-- Left Side: Residential Apartment Image with Dark Blue Overlay -->
      <div class="login-hero-pane">
        <img
          src="/images/apartment-hero.jpg"
          alt="Oakridge Heights Residential Community"
          class="login-hero-img"
          referrerPolicy="no-referrer"
          onerror="this.style.display='none'"
        />
        <div class="login-hero-scrim"></div>

        <div class="login-hero-content">
          <div class="d-flex align-items-center gap-3 mb-4">
            <div class="sc-brand-icon">
              <i class="bi bi-buildings-fill"></i>
            </div>
            <span class="fs-5 fw-bold brand-font tracking-tight">Smart Community Management System</span>
          </div>
        </div>

        <div class="login-hero-content my-auto">
          <p class="text-uppercase small fw-semibold mb-2" style="letter-spacing: 0.08em; color: #93C5FD;">
            Residential Community Portal
          </p>
          <h1 class="display-6 fw-bold mb-3" style="text-wrap: balance;">
            Modern Apartment Administration & Resident Services
          </h1>
          <p class="mb-4 text-white-50 fs-6" style="line-height: 1.65;">
            A unified residential management platform for community administrators, flat residents, and maintenance staff. Manage household records, track maintenance requests, pay monthly dues, and reserve community amenities seamlessly.
          </p>
          <div class="row g-3 pt-2 border-top border-light border-opacity-10">
            <div class="col-4">
              <div class="fw-bold fs-6 text-white">Administrators</div>
              <div class="small text-white-50">Community Oversight</div>
            </div>
            <div class="col-4">
              <div class="fw-bold fs-6 text-white">Residents</div>
              <div class="small text-white-50">Household & Billing</div>
            </div>
            <div class="col-4">
              <div class="fw-bold fs-6 text-white">Maintenance Staff</div>
              <div class="small text-white-50">Task Dispatch & Updates</div>
            </div>
          </div>
        </div>

        <div class="login-hero-content">
          <div class="small text-white-50">
            ${escapeHtml(AppState.communityName)} · Resident & Association Portal
          </div>
        </div>
      </div>

      <!-- Right Side: Professional Sign-In Card -->
      <div class="login-form-pane">
        <!-- Mobile Brand Header -->
        <div class="login-mobile-brand">
          <div class="sc-brand-icon">
            <i class="bi bi-buildings-fill"></i>
          </div>
          <div class="overflow-hidden">
            <div class="fw-bold brand-font text-truncate" style="font-size: 0.98rem;">Smart Community Management System</div>
            <div class="text-white-50" style="font-size: 0.74rem;">${escapeHtml(AppState.communityName)}</div>
          </div>
        </div>

        <div class="login-card">
          <div class="d-flex align-items-center gap-3 mb-3">
            <div class="sc-brand-icon">
              <i class="bi bi-shield-lock-fill"></i>
            </div>
            <div>
              <h4 class="fw-bold mb-0" style="color: var(--sc-navy); font-size: 1.25rem;">Smart Community Management System</h4>
              <div class="text-muted small">Sign in to your residential community account</div>
            </div>
          </div>

          ${
            successBanner
              ? `<div class="alert alert-success py-2 px-3 small d-flex align-items-center gap-2 mb-3">
                   <i class="bi bi-check-circle-fill"></i>
                   <span>${escapeHtml(successBanner)}</span>
                 </div>`
              : ''
          }

          ${
            errorMsg
              ? `<div class="alert alert-danger py-2 px-3 small d-flex align-items-center gap-2 mb-3">
                   <i class="bi bi-exclamation-octagon-fill"></i>
                   <span>${escapeHtml(errorMsg)}</span>
                 </div>`
              : ''
          }

          <form id="loginForm" novalidate>
            <div class="mb-3">
              <label class="form-label fw-semibold small text-secondary" for="loginIdentifier">
                Email or Username *
              </label>
              <div class="input-group">
                <span class="input-group-text bg-light border-end-0 text-secondary">
                  <i class="bi bi-envelope"></i>
                </span>
                <input
                  type="text"
                  id="loginIdentifier"
                  class="form-control border-start-0"
                  placeholder="Enter your email or username"
                  value="${escapeHtml(savedIdentifier)}"
                  autocomplete="username"
                  required
                />
              </div>
            </div>

            <div class="mb-3">
              <label class="form-label fw-semibold small text-secondary" for="loginPassword">
                Password *
              </label>
              <div class="input-group">
                <span class="input-group-text bg-light border-end-0 text-secondary">
                  <i class="bi bi-lock"></i>
                </span>
                <input
                  type="password"
                  id="loginPassword"
                  class="form-control border-start-0 border-end-0"
                  placeholder="Enter your password"
                  autocomplete="current-password"
                  required
                />
                <button
                  type="button"
                  class="btn btn-light border border-start-0 text-secondary"
                  onclick="togglePasswordVisibility('loginPassword', this)"
                  title="Show or hide password"
                >
                  <i class="bi bi-eye"></i>
                </button>
              </div>
            </div>

            <div class="mb-3">
              <label class="form-label fw-semibold small text-secondary" for="loginFlatNumber">
                Flat Number <span class="text-muted fw-normal">(Required for Residents)</span>
              </label>
              <div class="input-group">
                <span class="input-group-text bg-light border-end-0 text-secondary">
                  <i class="bi bi-door-open"></i>
                </span>
                <input
                  type="text"
                  id="loginFlatNumber"
                  class="form-control border-start-0 tabular-nums"
                  placeholder="e.g. A-101, A-102, B-201"
                  value="${escapeHtml(savedFlat)}"
                />
              </div>
              <div class="form-text small" style="font-size: 0.74rem;">
                Residents must enter their assigned flat number (e.g., <strong>A-101</strong>). Leave blank for Administrator or Maintenance Staff.
              </div>
            </div>

            <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
              <div class="form-check">
                <input class="form-check-input" type="checkbox" id="rememberMeCheck" checked />
                <label class="form-check-label small text-secondary" for="rememberMeCheck">
                  Remember me
                </label>
              </div>
              <button
                type="button"
                class="btn btn-link btn-sm p-0 text-decoration-none small fw-semibold"
                onclick="openForgotPasswordModal()"
              >
                Forgot Password?
              </button>
            </div>

            <button type="submit" class="btn btn-sc-primary w-100 py-2" id="loginSubmitBtn">
              <i class="bi bi-box-arrow-in-right me-1"></i>Sign In
            </button>
          </form>

          <div class="border-top mt-4 pt-3 text-center">
            <span class="small text-secondary">New resident moving into the community?</span>
            <button
              type="button"
              class="btn btn-outline-primary btn-sm w-100 mt-2 fw-semibold"
              onclick="renderResidentRegistrationScreen()"
            >
              <i class="bi bi-person-plus me-1"></i>Create Resident Account
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const identifier = document.getElementById('loginIdentifier').value.trim();
    const password = document.getElementById('loginPassword').value;
    const flatNumber = document.getElementById('loginFlatNumber').value.trim();
    const rememberMe = document.getElementById('rememberMeCheck').checked;

    if (!identifier || !password) {
      renderLoginScreen('Please enter both your email/username and password.', {
        identifier,
        flatNumber
      });
      return;
    }

    const submitBtn = document.getElementById('loginSubmitBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Signing In...`;

    try {
      const result = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier, password, flatNumber })
      });

      AppState.token = result.token;
      AppState.user = result.user;
      AppState.communityName = result.communityName || 'Oakridge Heights Residency';

      sessionStorage.setItem('sc_auth_token', result.token);
      sessionStorage.setItem('sc_auth_user', JSON.stringify(result.user));
      localStorage.setItem('sc_community_name', AppState.communityName);

      if (rememberMe) {
        localStorage.setItem('sc_auth_token', result.token);
        localStorage.setItem('sc_auth_user', JSON.stringify(result.user));
        localStorage.setItem('sc_remembered_identifier', identifier);
        if (result.user.flatNumber) {
          localStorage.setItem('sc_remembered_flat', result.user.flatNumber);
        }
      } else {
        localStorage.removeItem('sc_auth_token');
        localStorage.removeItem('sc_auth_user');
        localStorage.removeItem('sc_remembered_identifier');
        localStorage.removeItem('sc_remembered_flat');
      }

      AppState.activePage = getDefaultPageForRole(result.user.role);
      showToast(`Welcome back, ${result.user.fullName}!`, 'success');
      renderAppShell();
    } catch (err) {
      renderLoginScreen(err.message, { identifier, flatNumber });
    }
  });
}

window.togglePasswordVisibility = function (inputId, btnEl) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const isPwd = input.type === 'password';
  input.type = isPwd ? 'text' : 'password';
  if (btnEl) {
    btnEl.innerHTML = `<i class="bi ${isPwd ? 'bi-eye-slash' : 'bi-eye'}"></i>`;
  }
};

// RESIDENT SELF-REGISTRATION SCREEN (Strictly creates RESIDENT accounts only)
window.renderResidentRegistrationScreen = function (errorMsg = '', formValues = {}) {
  destroyActiveCharts();
  const app = document.getElementById('app');

  app.innerHTML = `
    <div class="login-wrapper">
      <div class="login-hero-pane">
        <img
          src="/images/apartment-hero.jpg"
          alt="Oakridge Heights Residential Community"
          class="login-hero-img"
          referrerPolicy="no-referrer"
          onerror="this.style.display='none'"
        />
        <div class="login-hero-scrim"></div>

        <div class="login-hero-content">
          <div class="d-flex align-items-center gap-3 mb-4">
            <div class="sc-brand-icon">
              <i class="bi bi-buildings-fill"></i>
            </div>
            <span class="fs-5 fw-bold brand-font tracking-tight">Smart Community Management System</span>
          </div>
        </div>

        <div class="login-hero-content my-auto">
          <p class="text-uppercase small fw-semibold mb-2" style="letter-spacing: 0.08em; color: #93C5FD;">
            Resident Onboarding
          </p>
          <h1 class="display-6 fw-bold mb-3" style="text-wrap: balance;">
            Register Your Flat & Household Account
          </h1>
          <p class="mb-4 text-white-50 fs-6" style="line-height: 1.65;">
            Create an individual Resident Portal account linked to your block and flat number. Multiple family members within the same flat can register separate accounts and share access to household maintenance bills, complaints, and facility bookings.
          </p>
        </div>

        <div class="login-hero-content">
          <div class="small text-white-50">
            ${escapeHtml(AppState.communityName)} · Resident Registration
          </div>
        </div>
      </div>

      <div class="login-form-pane">
        <div class="login-mobile-brand">
          <div class="sc-brand-icon">
            <i class="bi bi-buildings-fill"></i>
          </div>
          <div class="overflow-hidden">
            <div class="fw-bold brand-font text-truncate" style="font-size: 0.98rem;">Smart Community Management System</div>
            <div class="text-white-50" style="font-size: 0.74rem;">Resident Account Registration</div>
          </div>
        </div>

        <div class="login-card login-card-wide">
          <div class="d-flex align-items-center justify-content-between gap-2 mb-3">
            <div class="d-flex align-items-center gap-3">
              <div class="sc-brand-icon">
                <i class="bi bi-house-heart-fill"></i>
              </div>
              <div>
                <h4 class="fw-bold mb-0" style="color: var(--sc-navy); font-size: 1.2rem;">Create Resident Account</h4>
                <div class="text-muted small">Register your flat and household details</div>
              </div>
            </div>
            <span class="sc-status sc-status-info">Resident Role</span>
          </div>

          ${
            errorMsg
              ? `<div class="alert alert-danger py-2 px-3 small d-flex align-items-center gap-2 mb-3">
                   <i class="bi bi-exclamation-octagon-fill"></i>
                   <span>${escapeHtml(errorMsg)}</span>
                 </div>`
              : ''
          }

          <form id="residentRegisterForm" novalidate>
            <div class="row g-3">
              <div class="col-12 col-sm-6">
                <label class="form-label small fw-semibold text-secondary">Full Name *</label>
                <input
                  type="text"
                  id="regFullName"
                  class="form-control"
                  placeholder="e.g. Kiran Kumar"
                  value="${escapeHtml(formValues.fullName || '')}"
                  required
                />
              </div>

              <div class="col-12 col-sm-6">
                <label class="form-label small fw-semibold text-secondary">Email Address *</label>
                <input
                  type="email"
                  id="regEmail"
                  class="form-control"
                  placeholder="name@example.com"
                  value="${escapeHtml(formValues.email || '')}"
                  required
                />
              </div>

              <div class="col-12 col-sm-6">
                <label class="form-label small fw-semibold text-secondary">Phone Number *</label>
                <input
                  type="text"
                  id="regPhone"
                  class="form-control tabular-nums"
                  placeholder="e.g. 9848012345"
                  value="${escapeHtml(formValues.phone || '')}"
                  required
                />
              </div>

              <div class="col-6 col-sm-3">
                <label class="form-label small fw-semibold text-secondary">Block *</label>
                <select id="regBlock" class="form-select" required>
                  ${['A', 'B', 'C', 'D']
                    .map(
                      (b) =>
                        `<option value="${b}" ${formValues.block === b ? 'selected' : ''}>Block ${b}</option>`
                    )
                    .join('')}
                </select>
              </div>

              <div class="col-6 col-sm-3">
                <label class="form-label small fw-semibold text-secondary">Flat Number *</label>
                <input
                  type="text"
                  id="regFlatNumber"
                  class="form-control tabular-nums"
                  placeholder="e.g. A-101"
                  value="${escapeHtml(formValues.flatNumber || '')}"
                  required
                />
              </div>

              <div class="col-12 col-sm-4">
                <label class="form-label small fw-semibold text-secondary">Occupancy Type *</label>
                <select id="regResidentType" class="form-select">
                  <option value="Owner" ${formValues.residentType === 'Owner' ? 'selected' : ''}>Owner</option>
                  <option value="Tenant" ${formValues.residentType === 'Tenant' ? 'selected' : ''}>Tenant</option>
                </select>
              </div>

              <div class="col-6 col-sm-4">
                <label class="form-label small fw-semibold text-secondary">Household Role</label>
                <select id="regMemberRole" class="form-select">
                  <option value="Primary Resident" ${formValues.memberRole === 'Primary Resident' ? 'selected' : ''}>Primary Resident</option>
                  <option value="Family Member" ${formValues.memberRole === 'Family Member' ? 'selected' : ''}>Family Member</option>
                </select>
              </div>

              <div class="col-6 col-sm-4">
                <label class="form-label small fw-semibold text-secondary">Total Members</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  id="regFamilyMembers"
                  class="form-control tabular-nums"
                  value="${escapeHtml(formValues.familyMembers || '3')}"
                  required
                />
              </div>

              <div class="col-12 col-sm-6">
                <label class="form-label small fw-semibold text-secondary">Password (min 6 chars) *</label>
                <input
                  type="password"
                  id="regPassword"
                  class="form-control"
                  placeholder="Create password"
                  required
                />
              </div>

              <div class="col-12 col-sm-6">
                <label class="form-label small fw-semibold text-secondary">Confirm Password *</label>
                <input
                  type="password"
                  id="regConfirmPassword"
                  class="form-control"
                  placeholder="Confirm password"
                  required
                />
              </div>
            </div>

            <button type="submit" class="btn btn-sc-primary w-100 py-2 mt-4" id="regSubmitBtn">
              <i class="bi bi-check2-circle me-1"></i>Complete Resident Registration
            </button>
          </form>

          <div class="border-top mt-3 pt-3 text-center">
            <button
              type="button"
              class="btn btn-link btn-sm text-decoration-none fw-semibold"
              onclick="renderLoginScreen()"
            >
              <i class="bi bi-arrow-left me-1"></i>Back to Sign In
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('residentRegisterForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      fullName: document.getElementById('regFullName').value.trim(),
      email: document.getElementById('regEmail').value.trim(),
      phone: document.getElementById('regPhone').value.trim(),
      block: document.getElementById('regBlock').value,
      flatNumber: document.getElementById('regFlatNumber').value.trim(),
      residentType: document.getElementById('regResidentType').value,
      memberRole: document.getElementById('regMemberRole').value,
      familyMembers: Number(document.getElementById('regFamilyMembers').value) || 3,
      password: document.getElementById('regPassword').value
    };
    const confirmPassword = document.getElementById('regConfirmPassword').value;

    if (payload.password !== confirmPassword) {
      renderResidentRegistrationScreen('Passwords do not match. Please verify both password fields.', payload);
      return;
    }

    const btn = document.getElementById('regSubmitBtn');
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Registering Account...`;

    try {
      const res = await apiRequest('/api/auth/register-resident', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (res.vaultToken) {
        localStorage.setItem('sc_account_vault', res.vaultToken);
      }
      renderLoginScreen('', {
        identifier: res.email,
        flatNumber: res.flatNumber,
        successMsg: res.message
      });
    } catch (err) {
      renderResidentRegistrationScreen(err.message, payload);
    }
  });
};

// FORGOT PASSWORD / ACCOUNT RECOVERY MODAL
window.openForgotPasswordModal = function () {
  openModal(
    'Reset Account Password',
    `
    <form id="forgotPasswordForm">
      <p class="small text-secondary mb-3">
        Verify your registered account details below to set a new password. Residents must also provide their assigned flat number.
      </p>
      <div class="row g-3">
        <div class="col-12">
          <label class="form-label small fw-semibold">Registered Email or Username *</label>
          <input type="text" class="form-control" id="fpIdentifier" placeholder="Enter your email or username" required />
        </div>
        <div class="col-12 col-sm-6">
          <label class="form-label small fw-semibold">Registered Phone Number *</label>
          <input type="text" class="form-control tabular-nums" id="fpPhone" placeholder="e.g. 9848011223" required />
        </div>
        <div class="col-12 col-sm-6">
          <label class="form-label small fw-semibold">Flat Number (For Residents)</label>
          <input type="text" class="form-control tabular-nums" id="fpFlatNumber" placeholder="e.g. A-101" />
        </div>
        <div class="col-12">
          <label class="form-label small fw-semibold">New Password (minimum 6 characters) *</label>
          <input type="password" class="form-control" id="fpNewPassword" placeholder="Enter new password" required />
        </div>
      </div>
      <div class="d-flex justify-content-end gap-2 mt-4 pt-3 border-top">
        <button type="button" class="btn btn-light border" data-bs-dismiss="modal">Cancel</button>
        <button type="submit" class="btn btn-sc-primary" id="fpSubmitBtn">Reset Password</button>
      </div>
    </form>
  `,
    'modal-md'
  );

  document.getElementById('forgotPasswordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('fpSubmitBtn');
    btn.disabled = true;
    try {
      const identifier = document.getElementById('fpIdentifier').value.trim();
      const flatNumber = document.getElementById('fpFlatNumber').value.trim();
      const res = await apiRequest('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({
          identifier,
          phone: document.getElementById('fpPhone').value.trim(),
          flatNumber,
          newPassword: document.getElementById('fpNewPassword').value
        })
      });
      if (res.vaultToken) {
        localStorage.setItem('sc_account_vault', res.vaultToken);
      }
      closeModal();
      showToast(res.message, 'success');
      renderLoginScreen('', {
        identifier,
        flatNumber,
        successMsg: res.message
      });
    } catch (err) {
      btn.disabled = false;
      showToast(err.message, 'danger');
    }
  });
};

async function handleLogout(notify = true) {
  try {
    if (AppState.token) {
      await apiRequest('/api/auth/logout', {
        method: 'POST'
      });
    }
  } catch {
    // ignore logout error
  }
  AppState.token = null;
  AppState.user = null;
  localStorage.removeItem('sc_auth_token');
  localStorage.removeItem('sc_auth_user');
  sessionStorage.removeItem('sc_auth_token');
  sessionStorage.removeItem('sc_auth_user');
  if (notify) {
    showToast('You have signed out successfully.', 'info');
  }
  renderLoginScreen();
}

// ============================================================================
// ROLE-SPECIFIC SIDEBAR NAVIGATION & RESPONSIVE APP SHELL
// ============================================================================
function getNavigationItemsForRole(role) {
  if (role === 'ADMIN') {
    return [
      { id: 'dashboard', label: 'Dashboard', icon: 'bi-grid-1x2-fill' },
      { id: 'flats', label: 'Flats & Households', icon: 'bi-building-fill' },
      { id: 'residents', label: 'Resident Management', icon: 'bi-people-fill' },
      { id: 'complaints', label: 'Complaint Management', icon: 'bi-exclamation-diamond-fill' },
      { id: 'workers', label: 'Worker Management', icon: 'bi-person-workspace' },
      { id: 'payments', label: 'Maintenance Payments', icon: 'bi-credit-card-2-front-fill' },
      { id: 'bookings', label: 'Facility Booking', icon: 'bi-calendar2-check-fill' },
      { id: 'visitors', label: 'Visitor Management', icon: 'bi-person-badge-fill' },
      { id: 'announcements', label: 'Announcements & Events', icon: 'bi-megaphone-fill' },
      { id: 'reports', label: 'Reports', icon: 'bi-bar-chart-line-fill' },
      { id: 'settings', label: 'Settings', icon: 'bi-gear-fill' }
    ];
  }
  if (role === 'RESIDENT') {
    return [
      { id: 'resident-dashboard', label: 'My Dashboard', icon: 'bi-grid-1x2-fill' },
      { id: 'my-household', label: 'My Household', icon: 'bi-house-heart-fill' },
      { id: 'my-complaints', label: 'My Complaints', icon: 'bi-exclamation-diamond-fill' },
      { id: 'my-payments', label: 'My Maintenance Payments', icon: 'bi-credit-card-2-front-fill' },
      { id: 'my-bookings', label: 'Book Facility', icon: 'bi-calendar2-check-fill' },
      { id: 'announcements', label: 'Announcements & Events', icon: 'bi-megaphone-fill' },
      { id: 'my-profile', label: 'My Profile', icon: 'bi-person-circle' }
    ];
  }
  // WORKER
  return [
    { id: 'worker-dashboard', label: 'My Dashboard', icon: 'bi-grid-1x2-fill' },
    { id: 'worker-complaints', label: 'My Assigned Complaints', icon: 'bi-tools' },
    { id: 'worker-history', label: 'My Work History', icon: 'bi-clock-history' },
    { id: 'my-profile', label: 'My Profile', icon: 'bi-person-circle' }
  ];
}

window.toggleMobileSidebar = function () {
  const sidebar = document.getElementById('scSidebar');
  const backdrop = document.getElementById('scSidebarBackdrop');
  if (sidebar) sidebar.classList.toggle('show-mobile');
  if (backdrop) backdrop.classList.toggle('show-mobile');
};

window.closeMobileSidebar = function () {
  const sidebar = document.getElementById('scSidebar');
  const backdrop = document.getElementById('scSidebarBackdrop');
  if (sidebar) sidebar.classList.remove('show-mobile');
  if (backdrop) backdrop.classList.remove('show-mobile');
};

async function refreshNotificationsBadge() {
  try {
    const data = await apiRequest('/api/notifications');
    AppState.unreadNotifications = data.unreadCount || 0;
    AppState.cache.notifications = data.notifications || [];
    const badgeEl = document.getElementById('topNotifBadge');
    if (badgeEl) {
      if (AppState.unreadNotifications > 0) {
        badgeEl.textContent = AppState.unreadNotifications;
        badgeEl.classList.remove('d-none');
      } else {
        badgeEl.classList.add('d-none');
      }
    }
  } catch {
    // ignore
  }
}

window.openNotificationsModal = async function () {
  await refreshNotificationsBadge();
  const list = AppState.cache.notifications || [];

  openModal(
    'Notifications',
    `
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3 pb-2 border-bottom">
      <div class="small text-secondary">
        Showing alerts and updates for <strong>${escapeHtml(AppState.user.fullName)}</strong>
      </div>
      ${
        list.some((n) => !n.isRead)
          ? `<button class="btn btn-sm btn-outline-primary" onclick="markAllNotificationsRead()">
               <i class="bi bi-check2-all me-1"></i>Mark All as Read
             </button>`
          : ''
      }
    </div>
    ${
      list.length === 0
        ? `<div class="sc-empty-state py-4">
             <div class="sc-empty-icon"><i class="bi bi-bell"></i></div>
             <h6 class="fw-bold text-dark mb-1">No Notifications</h6>
             <p class="small mb-0">You are all caught up.</p>
           </div>`
        : `<div class="d-flex flex-column gap-2" style="max-height: 440px; overflow-y: auto;">
             ${list
               .map(
                 (n) => `
               <div class="p-3 rounded border ${n.isRead ? 'bg-white' : 'bg-light border-primary border-opacity-25'} d-flex justify-content-between align-items-start gap-2">
                 <div class="min-w-0">
                   <div class="d-flex flex-wrap align-items-center gap-2 mb-1">
                     <span class="sc-status sc-status-info">${escapeHtml(n.category)}</span>
                     <span class="fw-bold text-dark small">${escapeHtml(n.title)}</span>
                     ${!n.isRead ? `<span class="sc-status sc-status-warning">New</span>` : ''}
                   </div>
                   <div class="text-secondary small">${escapeHtml(n.message)}</div>
                   <div class="text-muted mt-1 tabular-nums" style="font-size: 0.72rem;">
                     ${escapeHtml(String(n.createdAt).replace('T', ' ').slice(0, 16))}
                   </div>
                 </div>
                 ${
                   !n.isRead
                     ? `<button class="btn btn-sm btn-light border flex-shrink-0" onclick="markNotificationRead(${n.id})" title="Mark as read">
                          <i class="bi bi-check2"></i>
                        </button>`
                     : ''
                 }
               </div>
             `
               )
               .join('')}
           </div>`
    }
  `,
    'modal-lg'
  );
};

window.markNotificationRead = async function (id) {
  await apiRequest(`/api/notifications/${id}/read`, { method: 'PUT' });
  await openNotificationsModal();
};

window.markAllNotificationsRead = async function () {
  await apiRequest('/api/notifications/read-all', { method: 'PUT' });
  await openNotificationsModal();
};

function renderAppShell() {
  if (!AppState.token || !AppState.user) {
    renderLoginScreen();
    return;
  }

  const role = AppState.user.role;
  const navItems = getNavigationItemsForRole(role);
  if (!navItems.some((i) => i.id === AppState.activePage)) {
    AppState.activePage = getDefaultPageForRole(role);
  }

  const roleDisplayLabel =
    role === 'ADMIN'
      ? 'Administrator'
      : role === 'RESIDENT'
      ? `Resident${AppState.user.flatNumber ? ` · Flat ${AppState.user.flatNumber}` : ''}`
      : 'Maintenance Worker';

  const todayFormatted = formatCompactDate(new Date());

  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="app-shell">
      <!-- Mobile Sidebar Backdrop -->
      <div class="sc-sidebar-backdrop" id="scSidebarBackdrop" onclick="closeMobileSidebar()"></div>

      <!-- Fixed Dark Navy Sidebar -->
      <aside class="sc-sidebar" id="scSidebar">
        <div class="sc-sidebar-brand">
          <div class="d-flex align-items-center gap-2 overflow-hidden">
            <div class="sc-brand-icon">
              <i class="bi bi-buildings-fill"></i>
            </div>
            <div class="overflow-hidden">
              <div class="fw-bold text-white text-truncate brand-font" style="font-size: 0.93rem;" id="sidebarCommunityName">
                ${escapeHtml(AppState.communityName)}
              </div>
              <div class="text-white-50 text-truncate" style="font-size: 0.72rem;">${escapeHtml(roleDisplayLabel)}</div>
            </div>
          </div>
          <button
            type="button"
            class="btn btn-sm btn-outline-light border-opacity-25 d-lg-none flex-shrink-0"
            onclick="closeMobileSidebar()"
            aria-label="Close navigation menu"
          >
            <i class="bi bi-x-lg"></i>
          </button>
        </div>

        <nav class="sc-sidebar-nav">
          <div class="sc-nav-section-label">Navigation Menu</div>
          ${navItems
            .map(
              (item) => `
            <button
              type="button"
              class="sc-nav-item ${AppState.activePage === item.id ? 'active' : ''}"
              onclick="navigateToPage('${item.id}')"
            >
              <i class="bi ${item.icon}"></i>
              <span>${escapeHtml(item.label)}</span>
            </button>
          `
            )
            .join('')}
        </nav>

        <div class="sc-sidebar-footer">
          <div class="d-flex align-items-center justify-content-between">
            <div class="overflow-hidden me-2">
              <div class="fw-semibold text-white small text-truncate">${escapeHtml(AppState.user.fullName)}</div>
              <div class="text-white-50 text-truncate" style="font-size: 0.72rem;">${escapeHtml(roleDisplayLabel)}</div>
            </div>
            <button
              type="button"
              class="btn btn-sm btn-outline-light border-opacity-25 flex-shrink-0"
              onclick="handleLogout(true)"
              title="Sign Out"
            >
              <i class="bi bi-box-arrow-right"></i>
            </button>
          </div>
        </div>
      </aside>

      <!-- Main Workspace -->
      <div class="sc-main">
        <!-- Responsive Top Navigation Bar -->
        <header class="sc-topbar">
          <div class="sc-topbar-left">
            <button
              type="button"
              class="btn btn-light border sc-topbar-icon-btn d-lg-none"
              onclick="toggleMobileSidebar()"
              aria-label="Open navigation menu"
            >
              <i class="bi bi-list fs-5"></i>
            </button>
            <div class="sc-topbar-greeting">
              <div class="sc-topbar-user" title="${escapeHtml(AppState.user.fullName)}">
                <span class="d-none d-sm-inline">Welcome, </span>${escapeHtml(AppState.user.fullName)}
              </div>
              <span class="sc-topbar-sep">·</span>
              <div class="sc-topbar-date tabular-nums">
                <i class="bi bi-calendar3 me-1 d-none d-sm-inline"></i>${escapeHtml(todayFormatted)}
              </div>
            </div>
          </div>

          <div class="sc-topbar-right">
            <!-- Notification Bell Button -->
            <button
              type="button"
              class="btn btn-light border text-secondary position-relative sc-topbar-icon-btn"
              onclick="openNotificationsModal()"
              title="Notifications"
            >
              <i class="bi bi-bell-fill"></i>
              <span class="d-none d-xl-inline ms-1 small fw-medium">Notifications</span>
              <span
                id="topNotifBadge"
                class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger tabular-nums d-none"
                style="font-size: 0.65rem;"
              >
                0
              </span>
            </button>

            <!-- Profile / Settings Button -->
            <button
              type="button"
              class="btn btn-light border text-secondary sc-topbar-icon-btn"
              onclick="navigateToPage('${role === 'ADMIN' ? 'settings' : 'my-profile'}')"
              title="${role === 'ADMIN' ? 'Settings' : 'My Profile'}"
            >
              <i class="bi bi-person-circle"></i>
              <span class="d-none d-md-inline ms-1 small fw-medium">${role === 'ADMIN' ? 'Settings' : 'My Profile'}</span>
            </button>

            <!-- Primary Role Action -->
            ${
              role === 'WORKER'
                ? `<button type="button" class="btn btn-sc-primary sc-topbar-cta" onclick="navigateToPage('worker-complaints')">
                     <i class="bi bi-tools"></i>
                     <span class="d-none d-sm-inline">My Assigned Tasks</span>
                     <span class="d-inline d-sm-none cta-text-mobile">Tasks</span>
                   </button>`
                : `<button type="button" class="btn btn-sc-primary sc-topbar-cta" onclick="openRegisterComplaintModal()">
                     <i class="bi bi-plus-lg"></i>
                     <span class="d-none d-sm-inline">Register Complaint</span>
                     <span class="d-inline d-sm-none cta-text-mobile">Complaint</span>
                   </button>`
            }
          </div>
        </header>

        <!-- Dynamic Module Content Area -->
        <main class="sc-content" id="scMainContent">
          <div class="text-center py-5 text-muted">
            <div class="spinner-border text-primary spinner-border-sm me-2"></div>
            Loading...
          </div>
        </main>
      </div>
    </div>
  `;

  refreshNotificationsBadge();
  loadActivePageContent();
}

window.navigateToPage = function (pageId) {
  closeMobileSidebar();
  AppState.activePage = pageId;
  renderAppShell();
};

async function loadActivePageContent() {
  destroyActiveCharts();
  const page = AppState.activePage;
  try {
    switch (page) {
      case 'dashboard':
        await renderAdminDashboardPage();
        break;
      case 'resident-dashboard':
        await renderResidentDashboardPage();
        break;
      case 'worker-dashboard':
        await renderWorkerDashboardPage();
        break;
      case 'flats':
        await renderFlatsAndHouseholdsPage();
        break;
      case 'my-household':
        await renderMyHouseholdPage();
        break;
      case 'residents':
        await renderResidentsPage();
        break;
      case 'visitors':
        await renderVisitorsPage();
        break;
      case 'complaints':
        await renderAdminComplaintsPage();
        break;
      case 'my-complaints':
        await renderResidentComplaintsPage();
        break;
      case 'worker-complaints':
        await renderWorkerComplaintsPage();
        break;
      case 'worker-history':
        await renderWorkerHistoryPage();
        break;
      case 'workers':
        await renderWorkersPage();
        break;
      case 'payments':
        await renderAdminPaymentsPage();
        break;
      case 'my-payments':
        await renderResidentPaymentsPage();
        break;
      case 'bookings':
      case 'my-bookings':
        await renderBookingsPage();
        break;
      case 'announcements':
        await renderAnnouncementsPage();
        break;
      case 'reports':
        await renderReportsPage();
        break;
      case 'settings':
      case 'my-profile':
        await renderSettingsOrProfilePage();
        break;
      default:
        if (AppState.user.role === 'RESIDENT') await renderResidentDashboardPage();
        else if (AppState.user.role === 'WORKER') await renderWorkerDashboardPage();
        else await renderAdminDashboardPage();
    }
  } catch (err) {
    const main = document.getElementById('scMainContent');
    if (main) {
      main.innerHTML = `
        <div class="sc-card p-4 border-danger">
          <h5 class="text-danger fw-bold mb-2"><i class="bi bi-exclamation-triangle-fill me-2"></i>Unable to Load View</h5>
          <p class="text-secondary mb-3">${escapeHtml(err.message)}</p>
          <button class="btn btn-sc-primary btn-sm" onclick="loadActivePageContent()">Retry</button>
        </div>
      `;
    }
  }
}

// ============================================================================
// ADMINISTRATOR DASHBOARD (WITH 12 SUMMARY CARDS & MAINTENANCE COLLECTION OVERVIEW)
// ============================================================================
async function renderAdminDashboardPage() {
  const main = document.getElementById('scMainContent');
  const queryMonth = encodeURIComponent(AppState.selectedBillingMonth || 'October 2026');
  const [data, workers, residents] = await Promise.all([
    apiRequest(`/api/dashboard/admin?billingMonth=${queryMonth}`),
    apiRequest('/api/workers').catch(() => []),
    apiRequest('/api/residents').catch(() => [])
  ]);

  AppState.cache.adminDashboard = data;
  AppState.cache.workers = workers;
  AppState.cache.residents = residents;
  AppState.selectedBillingMonth = data.selectedBillingMonth;

  if (data.communitySettings?.communityName) {
    AppState.communityName = data.communitySettings.communityName;
    const brandEl = document.getElementById('sidebarCommunityName');
    if (brandEl) brandEl.textContent = AppState.communityName;
  }

  const { stats, collectionOverview, recentComplaints, priorityQueue, urgentIssues, announcements, availableBillingMonths } = data;

  main.innerHTML = `
    <!-- Top Page Header & Quick Actions -->
    <div class="sc-page-header">
      <div>
        <h3 class="fw-bold mb-1" style="color: var(--sc-navy);">Administrator Dashboard</h3>
        <div class="text-secondary small">
          ${escapeHtml(AppState.communityName)} · Community-wide occupancy, maintenance billing, and complaint dispatch overview
        </div>
      </div>

      <div class="sc-page-actions">
        <button class="btn btn-sc-navy btn-sm" onclick="openResidentModal()">
          <i class="bi bi-person-plus-fill me-1"></i>Add Resident
        </button>
        <button class="btn btn-sc-primary btn-sm" onclick="openRegisterComplaintModal()">
          <i class="bi bi-exclamation-circle me-1"></i>Register Complaint
        </button>
        <button class="btn btn-outline-secondary btn-sm bg-white" onclick="openWorkerModal()">
          <i class="bi bi-person-gear me-1"></i>Add Worker
        </button>
        <button class="btn btn-outline-secondary btn-sm bg-white" onclick="openAnnouncementModal()">
          <i class="bi bi-megaphone me-1"></i>Create Announcement
        </button>
      </div>
    </div>

    <!-- 12 Summary Statistic Cards (Responsive 1-col / 2-col on mobile, 3-col tablet, 4-col desktop) -->
    <div class="row g-3 mb-4">
      <div class="col-12 col-sm-6 col-md-4 col-xl-3">
        <div class="sc-stat-card">
          <div>
            <div class="text-secondary small fw-semibold mb-1">Total Flats</div>
            <div class="stat-value tabular-nums">${stats.totalFlats}</div>
            <div class="text-muted small mt-1">Blocks A, B, C & D</div>
          </div>
          <div class="sc-stat-icon" style="background: #EFF6FF; color: #2563EB;"><i class="bi bi-building"></i></div>
        </div>
      </div>

      <div class="col-12 col-sm-6 col-md-4 col-xl-3">
        <div class="sc-stat-card">
          <div>
            <div class="text-secondary small fw-semibold mb-1">Occupied Flats</div>
            <div class="stat-value tabular-nums" style="color: #15803D;">${stats.occupiedFlats}</div>
            <div class="text-muted small mt-1">${Math.max(0, stats.totalFlats - stats.occupiedFlats)} vacant flat(s)</div>
          </div>
          <div class="sc-stat-icon" style="background: #DCFCE7; color: #15803D;"><i class="bi bi-house-check-fill"></i></div>
        </div>
      </div>

      <div class="col-12 col-sm-6 col-md-4 col-xl-3">
        <div class="sc-stat-card">
          <div>
            <div class="text-secondary small fw-semibold mb-1">Total Registered Residents</div>
            <div class="stat-value tabular-nums">${stats.totalResidents}</div>
            <div class="text-muted small mt-1">Active households</div>
          </div>
          <div class="sc-stat-icon" style="background: #EFF6FF; color: #2563EB;"><i class="bi bi-people-fill"></i></div>
        </div>
      </div>

      <div class="col-12 col-sm-6 col-md-4 col-xl-3">
        <div class="sc-stat-card">
          <div>
            <div class="text-secondary small fw-semibold mb-1">Total Complaints</div>
            <div class="stat-value tabular-nums">${stats.totalComplaints}</div>
            <div class="text-muted small mt-1">All logged complaints</div>
          </div>
          <div class="sc-stat-icon" style="background: #F1F5F9; color: #142D4E;"><i class="bi bi-clipboard2-data-fill"></i></div>
        </div>
      </div>

      <div class="col-12 col-sm-6 col-md-4 col-xl-3">
        <div class="sc-stat-card">
          <div>
            <div class="text-secondary small fw-semibold mb-1">Pending Complaints</div>
            <div class="stat-value tabular-nums" style="color: #B45309;">${stats.pendingComplaints}</div>
            <div class="text-muted small mt-1">Awaiting assignment/acceptance</div>
          </div>
          <div class="sc-stat-icon" style="background: #FEF3C7; color: #B45309;"><i class="bi bi-hourglass-split"></i></div>
        </div>
      </div>

      <div class="col-12 col-sm-6 col-md-4 col-xl-3">
        <div class="sc-stat-card">
          <div>
            <div class="text-secondary small fw-semibold mb-1">In-Progress Complaints</div>
            <div class="stat-value tabular-nums" style="color: #1D4ED8;">${stats.inProgressComplaints}</div>
            <div class="text-muted small mt-1">Accepted & active work</div>
          </div>
          <div class="sc-stat-icon" style="background: #DBEAFE; color: #1D4ED8;"><i class="bi bi-gear-wide-connected"></i></div>
        </div>
      </div>

      <div class="col-12 col-sm-6 col-md-4 col-xl-3">
        <div class="sc-stat-card">
          <div>
            <div class="text-secondary small fw-semibold mb-1">Resolved Complaints</div>
            <div class="stat-value tabular-nums" style="color: #15803D;">${stats.resolvedComplaints}</div>
            <div class="text-muted small mt-1">Completed & closed</div>
          </div>
          <div class="sc-stat-icon" style="background: #DCFCE7; color: #15803D;"><i class="bi bi-check2-circle"></i></div>
        </div>
      </div>

      <div class="col-12 col-sm-6 col-md-4 col-xl-3">
        <div class="sc-stat-card">
          <div>
            <div class="text-secondary small fw-semibold mb-1">Total Maintenance Due</div>
            <div class="stat-value tabular-nums" style="color: #B45309; font-size: 1.4rem;">${formatCurrency(stats.totalMaintenanceDue)}</div>
            <div class="text-muted small mt-1">Outstanding (${escapeHtml(data.selectedBillingMonth)})</div>
          </div>
          <div class="sc-stat-icon" style="background: #FEF3C7; color: #B45309;"><i class="bi bi-wallet2"></i></div>
        </div>
      </div>

      <div class="col-12 col-sm-6 col-md-4 col-xl-3">
        <div class="sc-stat-card">
          <div>
            <div class="text-secondary small fw-semibold mb-1">Total Amount Collected</div>
            <div class="stat-value tabular-nums" style="color: #15803D; font-size: 1.4rem;">${formatCurrency(stats.totalAmountCollected)}</div>
            <div class="text-muted small mt-1">Verified payments (${escapeHtml(data.selectedBillingMonth)})</div>
          </div>
          <div class="sc-stat-icon" style="background: #DCFCE7; color: #15803D;"><i class="bi bi-cash-stack"></i></div>
        </div>
      </div>

      <div class="col-12 col-sm-6 col-md-4 col-xl-3">
        <div class="sc-stat-card">
          <div>
            <div class="text-secondary small fw-semibold mb-1">Flats That Have Paid</div>
            <div class="stat-value tabular-nums" style="color: #15803D;">${stats.flatsPaidCount}</div>
            <div class="text-muted small mt-1">Paid for ${escapeHtml(data.selectedBillingMonth)}</div>
          </div>
          <div class="sc-stat-icon" style="background: #DCFCE7; color: #15803D;"><i class="bi bi-check-square-fill"></i></div>
        </div>
      </div>

      <div class="col-12 col-sm-6 col-md-4 col-xl-3">
        <div class="sc-stat-card">
          <div>
            <div class="text-secondary small fw-semibold mb-1">Flats With Pending Payments</div>
            <div class="stat-value tabular-nums" style="color: #B45309;">${stats.flatsPendingCount}</div>
            <div class="text-muted small mt-1">Within due date</div>
          </div>
          <div class="sc-stat-icon" style="background: #FEF3C7; color: #B45309;"><i class="bi bi-clock"></i></div>
        </div>
      </div>

      <div class="col-12 col-sm-6 col-md-4 col-xl-3">
        <div class="sc-stat-card">
          <div>
            <div class="text-secondary small fw-semibold mb-1">Overdue Payments</div>
            <div class="stat-value tabular-nums" style="color: #B91C1C;">${stats.overdueBillsCount}</div>
            <div class="text-muted small mt-1">Past due date</div>
          </div>
          <div class="sc-stat-icon" style="background: #FEE2E2; color: #B91C1C;"><i class="bi bi-exclamation-octagon-fill"></i></div>
        </div>
      </div>
    </div>

    <!-- DEDICATED MAINTENANCE COLLECTION OVERVIEW SECTION -->
    <div class="sc-card mb-4">
      <div class="sc-card-header">
        <div>
          <h6 class="fw-bold mb-0" style="color: var(--sc-navy);">
            <i class="bi bi-bank2 text-primary me-2"></i>Maintenance Collection Overview
          </h6>
          <div class="text-muted small">
            Billing summary, flat-wise payment status, and residents with outstanding dues
          </div>
        </div>
        <div class="d-flex flex-wrap align-items-center gap-2">
          <label class="small fw-semibold text-secondary mb-0">Billing Period:</label>
          <select
            class="form-select form-select-sm"
            style="width: auto;"
            onchange="changeAdminBillingPeriod(this.value)"
          >
            ${availableBillingMonths
              .map(
                (m) =>
                  `<option value="${escapeHtml(m)}" ${data.selectedBillingMonth === m ? 'selected' : ''}>${escapeHtml(
                    m
                  )}</option>`
              )
              .join('')}
            <option value="ALL" ${data.selectedBillingMonth === 'ALL' ? 'selected' : ''}>All Billing Periods</option>
          </select>
          <button class="btn btn-sm btn-sc-primary" onclick="openGenerateBillModal()">
            <i class="bi bi-plus-lg me-1"></i>Generate Bill
          </button>
        </div>
      </div>

      <div class="sc-card-body">
        <!-- Collection Summary Metrics Strip -->
        <div class="row g-3 mb-4 p-3 rounded border bg-light">
          <div class="col-6 col-md-4 col-xl-2">
            <div class="text-muted small">Expected Collection</div>
            <div class="fw-bold fs-6 tabular-nums text-dark">${formatCurrency(collectionOverview.expectedCollection)}</div>
          </div>
          <div class="col-6 col-md-4 col-xl-2">
            <div class="text-muted small">Amount Collected</div>
            <div class="fw-bold fs-6 tabular-nums text-success">${formatCurrency(collectionOverview.collectedAmount)}</div>
          </div>
          <div class="col-6 col-md-4 col-xl-2">
            <div class="text-muted small">Outstanding Amount</div>
            <div class="fw-bold fs-6 tabular-nums text-danger">${formatCurrency(collectionOverview.outstandingAmount)}</div>
          </div>
          <div class="col-6 col-md-4 col-xl-2">
            <div class="text-muted small">Flats Paid</div>
            <div class="fw-bold fs-6 tabular-nums text-success">${collectionOverview.flatsPaidCount} Flats</div>
          </div>
          <div class="col-6 col-md-4 col-xl-2">
            <div class="text-muted small">Flats Unpaid</div>
            <div class="fw-bold fs-6 tabular-nums text-warning">${collectionOverview.flatsUnpaidCount} Flats</div>
          </div>
          <div class="col-6 col-md-4 col-xl-2">
            <div class="text-muted small">Overdue Bills</div>
            <div class="fw-bold fs-6 tabular-nums text-danger">${collectionOverview.overdueCount} Bills</div>
          </div>
        </div>

        <div class="row g-4">
          <!-- Table of Residents / Flats with Outstanding Payments -->
          <div class="col-12 col-xl-6">
            <h6 class="fw-bold small text-uppercase text-secondary mb-2">
              Flats with Outstanding Payments (${collectionOverview.outstandingBills.length})
            </h6>
            <div class="table-responsive border rounded">
              ${
                collectionOverview.outstandingBills.length === 0
                  ? `<div class="p-4 text-center text-muted small">All billed flats have paid for this period!</div>`
                  : `<table class="table sc-table mb-0">
                       <thead>
                         <tr>
                           <th>Flat</th>
                           <th>Resident</th>
                           <th>Billing Period</th>
                           <th>Total Payable</th>
                           <th>Due Date</th>
                           <th>Status</th>
                         </tr>
                       </thead>
                       <tbody>
                         ${collectionOverview.outstandingBills
                           .map(
                             (b) => `
                           <tr>
                             <td class="tabular-nums fw-bold">${escapeHtml(b.flatNumber)}</td>
                             <td>${escapeHtml(b.residentName)}</td>
                             <td>${escapeHtml(b.billingMonth)}</td>
                             <td class="tabular-nums fw-bold text-danger">${formatCurrency(b.amount)}</td>
                             <td class="tabular-nums small">${escapeHtml(b.dueDate)}</td>
                             <td>${renderStatusBadge(b.paymentStatus)}</td>
                           </tr>
                         `
                           )
                           .join('')}
                       </tbody>
                     </table>`
              }
            </div>
          </div>

          <!-- Payment Status for Each Flat -->
          <div class="col-12 col-xl-6">
            <h6 class="fw-bold small text-uppercase text-secondary mb-2">
              Payment Status for Each Community Flat (${collectionOverview.flatPaymentStatuses.length} Flats)
            </h6>
            <div class="table-responsive border rounded" style="max-height: 290px; overflow-y: auto;">
              <table class="table sc-table mb-0">
                <thead>
                  <tr>
                    <th>Flat</th>
                    <th>Household / Resident</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${collectionOverview.flatPaymentStatuses
                    .map(
                      (fp) => `
                    <tr>
                      <td class="tabular-nums fw-semibold">Flat ${escapeHtml(fp.flatNumber)}</td>
                      <td>${escapeHtml(fp.residentName)}</td>
                      <td class="tabular-nums">${fp.totalAmount ? formatCurrency(fp.totalAmount) : '—'}</td>
                      <td>${renderStatusBadge(fp.paymentStatus)}</td>
                    </tr>
                  `
                    )
                    .join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Priority Queue & Urgent Issues + Charts Row -->
    <div class="row g-4 mb-4">
      <div class="col-12 col-xl-7">
        <div class="sc-card h-100">
          <div class="sc-card-header">
            <div>
              <h6 class="fw-bold mb-0">
                <i class="bi bi-sort-numeric-down-alt text-danger me-2"></i>Smart Complaint Priority Queue
              </h6>
              <div class="text-muted small">
                Active complaints ranked by severity, category urgency, and waiting time
              </div>
            </div>
            <button class="btn btn-sm btn-outline-primary" onclick="navigateToPage('complaints')">
              Manage All Complaints
            </button>
          </div>
          <div class="table-responsive">
            ${
              priorityQueue.length === 0
                ? `<div class="sc-empty-state">
                     <div class="sc-empty-icon"><i class="bi bi-check2-all"></i></div>
                     <h6 class="fw-bold text-dark mb-1">No Active Complaints in Queue</h6>
                     <p class="small mb-0">All community complaints are resolved.</p>
                   </div>`
                : `<table class="table sc-table">
                     <thead>
                       <tr>
                         <th>Rank</th>
                         <th>Issue & Flat</th>
                         <th>Priority Score</th>
                         <th>Worker & Status</th>
                         <th class="text-end">Action</th>
                       </tr>
                     </thead>
                     <tbody>
                       ${priorityQueue
                         .map(
                           (item, idx) => `
                         <tr>
                           <td>
                             <span class="pq-rank ${idx === 0 ? 'pq-rank-1' : idx === 1 ? 'pq-rank-2' : 'pq-rank-default'}">
                               #${idx + 1}
                             </span>
                           </td>
                           <td>
                             <div class="fw-semibold text-dark">${escapeHtml(item.category)}</div>
                             <div class="text-muted small">
                               <span class="tabular-nums">${escapeHtml(item.complaintCode)}</span> · Flat ${escapeHtml(item.flatNumber)} (${escapeHtml(item.residentName)})
                             </div>
                           </td>
                           <td>
                             <div class="fw-bold tabular-nums text-dark">${item.totalPriorityScore} pts</div>
                             <div class="text-muted" style="font-size: 0.74rem;">
                               Sev ${item.severityScore} + Urg ${item.urgencyScore} + Wait ${item.waitingTimeBonus}
                             </div>
                           </td>
                           <td>
                             <div class="small fw-medium">${escapeHtml(item.assignedWorkerName || 'Unassigned')}</div>
                             ${renderStatusBadge(item.status)}
                           </td>
                           <td class="text-end">
                             <button class="btn btn-sm btn-light border" onclick="openManageComplaintModal(${item.id})">
                               Assign / Manage
                             </button>
                           </td>
                         </tr>
                       `
                         )
                         .join('')}
                     </tbody>
                   </table>`
            }
          </div>
        </div>
      </div>

      <div class="col-12 col-xl-5">
        <div class="sc-card mb-4">
          <div class="sc-card-header">
            <h6 class="fw-bold mb-0"><i class="bi bi-lightning-charge-fill text-warning me-2"></i>Urgent Issues Requiring Attention</h6>
            <span class="small text-secondary tabular-nums">${urgentIssues.length} active</span>
          </div>
          <div class="sc-card-body">
            ${
              urgentIssues.length === 0
                ? `<div class="text-center py-3 text-muted small">No urgent issues pending right now.</div>`
                : `<div class="d-flex flex-column gap-2">
                     ${urgentIssues
                       .map(
                         (u) => `
                       <div class="p-3 rounded border bg-light d-flex align-items-start justify-content-between gap-2">
                         <div>
                           <div class="fw-bold text-dark small">
                             ${escapeHtml(u.category)} · Flat ${escapeHtml(u.flatNumber)}
                             <span class="text-danger ms-1 tabular-nums">(${u.totalPriorityScore} pts)</span>
                           </div>
                           <div class="text-secondary small mt-1">${escapeHtml(u.description)}</div>
                           <div class="text-muted mt-1" style="font-size: 0.75rem;">
                             Worker: <strong>${escapeHtml(u.assignedWorkerName || 'Unassigned')}</strong> · Status: ${escapeHtml(u.status)}
                           </div>
                         </div>
                         <button class="btn btn-sm btn-outline-dark shrink-0" onclick="openManageComplaintModal(${u.id})">
                           Review
                         </button>
                       </div>
                     `
                       )
                       .join('')}
                   </div>`
            }
          </div>
        </div>

        <div class="sc-card">
          <div class="sc-card-header">
            <h6 class="fw-bold mb-0">Complaint Priority & Monthly Trend</h6>
          </div>
          <div class="sc-card-body">
            <div class="row g-3 align-items-center">
              <div class="col-sm-5">
                <div style="height: 170px;">
                  <canvas id="dashboardPriorityChart"></canvas>
                </div>
              </div>
              <div class="col-sm-7">
                <div style="height: 170px;">
                  <canvas id="dashboardMonthlyChart"></canvas>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Recent Complaints & Community Announcements -->
    <div class="row g-4">
      <div class="col-12 col-xl-8">
        <div class="sc-card h-100">
          <div class="sc-card-header">
            <h6 class="fw-bold mb-0">Recent Community Complaints</h6>
            <button class="btn btn-sm btn-light border" onclick="navigateToPage('complaints')">View All</button>
          </div>
          <div class="table-responsive">
            <table class="table sc-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Resident & Flat</th>
                  <th>Category</th>
                  <th>Priority</th>
                  <th>Assigned Worker</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${recentComplaints
                  .map(
                    (c) => `
                  <tr>
                    <td class="tabular-nums fw-semibold">${escapeHtml(c.complaintCode)}</td>
                    <td>
                      <div class="fw-medium">${escapeHtml(c.residentName)}</div>
                      <div class="text-muted small">Flat ${escapeHtml(c.flatNumber)}</div>
                    </td>
                    <td>${escapeHtml(c.category)}</td>
                    <td>${renderStatusBadge(c.priority)}</td>
                    <td>${escapeHtml(c.assignedWorkerName || 'Unassigned')}</td>
                    <td>${renderStatusBadge(c.status)}</td>
                  </tr>
                `
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="col-12 col-xl-4">
        <div class="sc-card h-100">
          <div class="sc-card-header">
            <h6 class="fw-bold mb-0">Community Announcements</h6>
            <button class="btn btn-sm btn-light border" onclick="navigateToPage('announcements')">All Notices</button>
          </div>
          <div class="sc-card-body">
            <div class="d-flex flex-column gap-3">
              ${announcements
                .slice(0, 3)
                .map(
                  (a) => `
                <div class="pb-3 border-bottom">
                  <div class="d-flex align-items-center justify-content-between mb-1">
                    <span class="small fw-semibold text-primary">${escapeHtml(a.category)}</span>
                    ${
                      a.important
                        ? `<span class="sc-status sc-status-danger"><i class="bi bi-pin-angle-fill"></i>Important</span>`
                        : `<span class="small text-muted tabular-nums">${escapeHtml(a.publishDate)}</span>`
                    }
                  </div>
                  <div class="fw-bold text-dark mb-1">${escapeHtml(a.title)}</div>
                  <div class="text-secondary small">${escapeHtml(a.description)}</div>
                </div>
              `
                )
                .join('')}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Render Charts
  const prioCtx = document.getElementById('dashboardPriorityChart');
  if (prioCtx && window.Chart) {
    const { High, Medium, Low } = data.priorityBreakdown;
    AppState.charts.prio = new Chart(prioCtx, {
      type: 'doughnut',
      data: {
        labels: ['High', 'Medium', 'Low'],
        datasets: [{ data: [High, Medium, Low], backgroundColor: ['#B91C1C', '#D97706', '#2563EB'], borderWidth: 2 }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } } }
      }
    });
  }

  const monthCtx = document.getElementById('dashboardMonthlyChart');
  if (monthCtx && window.Chart) {
    AppState.charts.monthly = new Chart(monthCtx, {
      type: 'bar',
      data: {
        labels: data.monthlyStats.map((m) => m.month),
        datasets: [{ label: 'Complaints', data: data.monthlyStats.map((m) => m.count), backgroundColor: '#2563EB', borderRadius: 5 }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
      }
    });
  }
}

window.changeAdminBillingPeriod = function (monthVal) {
  AppState.selectedBillingMonth = monthVal;
  renderAdminDashboardPage();
};

// ============================================================================
// RESIDENT DASHBOARD & RESIDENT MODULE VIEWS
// ============================================================================
async function renderResidentDashboardPage() {
  const main = document.getElementById('scMainContent');
  const data = await apiRequest('/api/dashboard/resident');
  AppState.cache.residentDashboard = data;
  const { resident, stats, unpaidBills, recentPayments, myComplaints, upcomingBookings, announcements } = data;

  main.innerHTML = `
    <div class="sc-page-header">
      <div>
        <h3 class="fw-bold mb-1" style="color: var(--sc-navy);">My Household Dashboard</h3>
        <div class="text-secondary small">
          <strong>${escapeHtml(resident.fullName)}</strong> · Block ${escapeHtml(resident.block)} · Flat <strong>${escapeHtml(resident.flatNumber)}</strong> (${escapeHtml(resident.residentType)}${resident.memberRole ? ` · ${escapeHtml(resident.memberRole)}` : ''})
        </div>
      </div>
      <div class="sc-page-actions">
        <button class="btn btn-sc-primary btn-sm" onclick="openRegisterComplaintModal()">
          <i class="bi bi-plus-circle me-1"></i>Submit Complaint
        </button>
        <button class="btn btn-sc-navy btn-sm" onclick="navigateToPage('my-payments')">
          <i class="bi bi-credit-card me-1"></i>My Maintenance Bills
        </button>
        <button class="btn btn-outline-secondary btn-sm bg-white" onclick="navigateToPage('my-bookings')">
          <i class="bi bi-calendar-plus me-1"></i>Book Facility
        </button>
      </div>
    </div>

    <!-- Resident Summary Cards -->
    <div class="row g-3 mb-4">
      <div class="col-6 col-md-4 col-xl-2">
        <div class="sc-stat-card">
          <div>
            <div class="text-secondary small fw-semibold mb-1">Flat & Block</div>
            <div class="stat-value tabular-nums" style="font-size: 1.4rem;">${escapeHtml(resident.flatNumber)}</div>
            <div class="text-muted small mt-1">Block ${escapeHtml(resident.block)} (${escapeHtml(resident.residentType)})</div>
          </div>
        </div>
      </div>

      <div class="col-6 col-md-4 col-xl-2">
        <div class="sc-stat-card">
          <div>
            <div class="text-secondary small fw-semibold mb-1">Household Members</div>
            <div class="stat-value tabular-nums" style="font-size: 1.4rem;">${stats.familyMembers}</div>
            <div class="text-muted small mt-1">Registered members</div>
          </div>
        </div>
      </div>

      <div class="col-6 col-md-4 col-xl-2">
        <div class="sc-stat-card">
          <div>
            <div class="text-secondary small fw-semibold mb-1">Pending Complaints</div>
            <div class="stat-value tabular-nums" style="color: #B45309; font-size: 1.4rem;">${stats.pendingComplaints}</div>
            <div class="text-muted small mt-1">Submitted by you</div>
          </div>
        </div>
      </div>

      <div class="col-6 col-md-4 col-xl-2">
        <div class="sc-stat-card">
          <div>
            <div class="text-secondary small fw-semibold mb-1">In Progress</div>
            <div class="stat-value tabular-nums" style="color: #1D4ED8; font-size: 1.4rem;">${stats.inProgressComplaints}</div>
            <div class="text-muted small mt-1">Worker assigned</div>
          </div>
        </div>
      </div>

      <div class="col-6 col-md-4 col-xl-2">
        <div class="sc-stat-card">
          <div>
            <div class="text-secondary small fw-semibold mb-1">Resolved</div>
            <div class="stat-value tabular-nums" style="color: #15803D; font-size: 1.4rem;">${stats.resolvedComplaints}</div>
            <div class="text-muted small mt-1">Completed tasks</div>
          </div>
        </div>
      </div>

      <div class="col-6 col-md-4 col-xl-2">
        <div class="sc-stat-card">
          <div>
            <div class="text-secondary small fw-semibold mb-1">Outstanding Dues</div>
            <div class="stat-value tabular-nums" style="color: ${stats.outstandingAmount > 0 ? '#B91C1C' : '#15803D'}; font-size: 1.35rem;">
              ${formatCurrency(stats.outstandingAmount)}
            </div>
            <div class="text-muted small mt-1 tabular-nums">
              ${stats.nextDueDate ? `Due: ${escapeHtml(stats.nextDueDate)}` : 'No dues pending'}
            </div>
          </div>
        </div>
      </div>
    </div>

    ${
      unpaidBills.length > 0
        ? `
      <div class="sc-card mb-4 border-warning">
        <div class="sc-card-header bg-light">
          <div>
            <h6 class="fw-bold mb-0 text-dark">
              <i class="bi bi-Receipt-cutoff text-warning me-2"></i>Action Required: Unpaid Maintenance Bill(s)
            </h6>
            <div class="small text-secondary">Pay your monthly flat maintenance online and receive an instant verified receipt</div>
          </div>
        </div>
        <div class="table-responsive">
          <table class="table sc-table mb-0">
            <thead>
              <tr>
                <th>Bill ID</th>
                <th>Billing Month</th>
                <th>Base Amount</th>
                <th>Late Fee</th>
                <th>Total Payable</th>
                <th>Due Date</th>
                <th>Status</th>
                <th class="text-end">Action</th>
              </tr>
            </thead>
            <tbody>
              ${unpaidBills
                .map(
                  (b) => `
                <tr>
                  <td class="tabular-nums fw-semibold">${escapeHtml(b.paymentCode)}</td>
                  <td class="fw-semibold">${escapeHtml(b.billingMonth)}</td>
                  <td class="tabular-nums">${formatCurrency(b.baseAmount || b.amount)}</td>
                  <td class="tabular-nums">${formatCurrency(b.lateFee || 0)}</td>
                  <td class="tabular-nums fw-bold text-danger">${formatCurrency(b.amount)}</td>
                  <td class="tabular-nums">${escapeHtml(b.dueDate)}</td>
                  <td>${renderStatusBadge(b.paymentStatus)}</td>
                  <td class="text-end">
                    <button class="btn btn-sm btn-sc-primary" onclick="openResidentDemoPaymentModal(${b.id})">
                      <i class="bi bi-shield-check me-1"></i>Pay Now
                    </button>
                  </td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </div>
    `
        : ''
    }

    <div class="row g-4">
      <!-- My Recent Complaints -->
      <div class="col-12 col-xl-7">
        <div class="sc-card h-100">
          <div class="sc-card-header">
            <h6 class="fw-bold mb-0">My Submitted Complaints</h6>
            <button class="btn btn-sm btn-light border" onclick="navigateToPage('my-complaints')">View All</button>
          </div>
          <div class="table-responsive">
            ${
              myComplaints.length === 0
                ? `<div class="sc-empty-state py-4">
                     <p class="small mb-2">You have not submitted any complaints yet.</p>
                     <button class="btn btn-sm btn-sc-primary" onclick="openRegisterComplaintModal()">Submit Complaint</button>
                   </div>`
                : `<table class="table sc-table">
                     <thead>
                       <tr>
                         <th>ID</th>
                         <th>Category</th>
                         <th>Priority</th>
                         <th>Assigned Worker</th>
                         <th>Status</th>
                         <th class="text-end">Details</th>
                       </tr>
                     </thead>
                     <tbody>
                       ${myComplaints
                         .map(
                           (c) => `
                         <tr>
                           <td class="tabular-nums fw-semibold">${escapeHtml(c.complaintCode)}</td>
                           <td>${escapeHtml(c.category)}</td>
                           <td>${renderStatusBadge(c.priority)}</td>
                           <td>${escapeHtml(c.assignedWorkerName || 'Pending Admin Assignment')}</td>
                           <td>${renderStatusBadge(c.status)}</td>
                           <td class="text-end">
                             <button class="btn btn-sm btn-light border" onclick="openManageComplaintModal(${c.id})">
                               View
                             </button>
                           </td>
                         </tr>
                       `
                         )
                         .join('')}
                     </tbody>
                   </table>`
            }
          </div>
        </div>
      </div>

      <!-- Recent Payment History, Upcoming Facility Bookings & Announcements -->
      <div class="col-12 col-xl-5">
        <div class="sc-card mb-4">
          <div class="sc-card-header">
            <h6 class="fw-bold mb-0">Recent Payment History</h6>
            <button class="btn btn-sm btn-light border" onclick="navigateToPage('my-payments')">All Payments</button>
          </div>
          <div class="sc-card-body">
            ${
              recentPayments.length === 0
                ? `<div class="text-muted small text-center py-2">No completed payments yet.</div>`
                : `<div class="d-flex flex-column gap-2">
                     ${recentPayments
                       .map(
                         (p) => `
                       <div class="p-2 rounded border bg-light d-flex justify-content-between align-items-center">
                         <div>
                           <div class="fw-semibold small text-dark">${escapeHtml(p.billingMonth)} · <span class="tabular-nums">${formatCurrency(p.amount)}</span></div>
                           <div class="text-muted" style="font-size: 0.75rem;">
                             Paid on ${escapeHtml(p.paymentDate)} · ${escapeHtml(p.paymentMethod)}
                           </div>
                         </div>
                         <button class="btn btn-sm btn-outline-secondary" onclick="openReceiptModal(${p.id})">
                           Receipt
                         </button>
                       </div>
                     `
                       )
                       .join('')}
                   </div>`
            }
          </div>
        </div>

        <div class="sc-card mb-4">
          <div class="sc-card-header">
            <h6 class="fw-bold mb-0">My Upcoming Facility Bookings</h6>
            <button class="btn btn-sm btn-light border" onclick="navigateToPage('my-bookings')">Book Facility</button>
          </div>
          <div class="sc-card-body">
            ${
              upcomingBookings.length === 0
                ? `<div class="text-muted small text-center py-2">No upcoming facility bookings.</div>`
                : `<div class="d-flex flex-column gap-2">
                     ${upcomingBookings
                       .map(
                         (b) => `
                       <div class="p-2 rounded border d-flex justify-content-between align-items-center">
                         <div>
                           <div class="fw-semibold small text-dark">${escapeHtml(b.facilityName)}</div>
                           <div class="text-muted small tabular-nums">${escapeHtml(b.bookingDate)} · ${escapeHtml(b.timeSlot)}</div>
                         </div>
                         ${renderStatusBadge(b.bookingStatus)}
                       </div>
                     `
                       )
                       .join('')}
                   </div>`
            }
          </div>
        </div>

        <div class="sc-card">
          <div class="sc-card-header">
            <h6 class="fw-bold mb-0">Important Community Announcements</h6>
          </div>
          <div class="sc-card-body">
            <div class="d-flex flex-column gap-2">
              ${announcements
                .slice(0, 2)
                .map(
                  (a) => `
                <div class="p-2 rounded border bg-light">
                  <div class="fw-bold small text-dark">${escapeHtml(a.title)}</div>
                  <div class="text-secondary small mt-1">${escapeHtml(a.description)}</div>
                </div>
              `
                )
                .join('')}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ============================================================================
// FLATS & HOUSEHOLDS (ADMIN) & MY HOUSEHOLD (RESIDENT)
// ============================================================================
async function renderFlatsAndHouseholdsPage() {
  const main = document.getElementById('scMainContent');
  const data = await apiRequest('/api/flats');
  AppState.cache.flats = data.flats || [];
  AppState.cache.householdRequests = data.householdRequests || [];

  const pendingReqs = AppState.cache.householdRequests.filter((r) => r.status === 'Pending');

  main.innerHTML = `
    <div class="sc-page-header">
      <div>
        <h3 class="fw-bold mb-1" style="color: var(--sc-navy);">Flats & Households Registry</h3>
        <div class="text-secondary small">Manage apartment units, occupancy status, registered family accounts, and household update requests</div>
      </div>
      <div class="sc-page-actions">
        <button class="btn btn-outline-secondary btn-sm bg-white" onclick="openAddFlatModal()">
          <i class="bi bi-building-add me-1"></i>Add Flat Unit
        </button>
        <button class="btn btn-sc-primary btn-sm" onclick="openResidentModal()">
          <i class="bi bi-person-plus-fill me-1"></i>Assign Resident to Flat
        </button>
      </div>
    </div>

    ${
      pendingReqs.length > 0
        ? `
      <div class="sc-card mb-4 border-primary">
        <div class="sc-card-header bg-light">
          <h6 class="fw-bold mb-0 text-primary">
            <i class="bi bi-person-check-fill me-2"></i>Pending Household Member Update Requests (${pendingReqs.length})
          </h6>
        </div>
        <div class="table-responsive">
          <table class="table sc-table mb-0">
            <thead>
              <tr>
                <th>Flat</th>
                <th>Resident</th>
                <th>Current Members</th>
                <th>Requested Members</th>
                <th>Status</th>
                <th class="text-end">Admin Action</th>
              </tr>
            </thead>
            <tbody>
              ${pendingReqs
                .map(
                  (r) => `
                <tr>
                  <td class="tabular-nums fw-bold">${escapeHtml(r.flatNumber)}</td>
                  <td>${escapeHtml(r.residentName)}</td>
                  <td class="tabular-nums">${r.currentFamilyMembers}</td>
                  <td class="tabular-nums fw-bold text-primary">${r.requestedFamilyMembers}</td>
                  <td>${renderStatusBadge(r.status)}</td>
                  <td class="text-end">
                    <button class="btn btn-sm btn-success me-1" onclick="handleHouseholdRequest(${r.id}, 'APPROVE')">Approve</button>
                    <button class="btn btn-sm btn-outline-danger" onclick="handleHouseholdRequest(${r.id}, 'REJECT')">Reject</button>
                  </td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </div>
    `
        : ''
    }

    <div class="sc-card">
      <div class="sc-card-header">
        <h6 class="fw-bold mb-0">All Registered Community Flats (${AppState.cache.flats.length})</h6>
      </div>
      <div class="table-responsive">
        <table class="table sc-table">
          <thead>
            <tr>
              <th>Flat Number</th>
              <th>Block & Floor</th>
              <th>Unit Type & Area</th>
              <th>Occupancy Status</th>
              <th>Primary Household Head</th>
              <th>Registered Accounts</th>
              <th>Ownership</th>
              <th>Household Members</th>
            </tr>
          </thead>
          <tbody>
            ${AppState.cache.flats
              .map((f) => {
                const members = f.householdMembers || (f.resident ? [f.resident] : []);
                return `
              <tr>
                <td class="tabular-nums fw-bold">${escapeHtml(f.flatNumber)}</td>
                <td>Block ${escapeHtml(f.block)} · Floor ${f.floorNumber}</td>
                <td class="tabular-nums">${escapeHtml(f.bhkType)} (${f.areaSqft} sq.ft)</td>
                <td>${renderStatusBadge(f.occupancyStatus)}</td>
                <td class="fw-semibold">${f.resident ? escapeHtml(f.resident.fullName) : '<span class="text-muted">Vacant</span>'}</td>
                <td>
                  ${
                    members.length === 0
                      ? '<span class="text-muted small">—</span>'
                      : members
                          .map(
                            (m) =>
                              `<div class="small"><span class="fw-medium">${escapeHtml(m.fullName)}</span> <span class="text-muted">(${escapeHtml(m.memberRole || 'Primary Resident')})</span></div>`
                          )
                          .join('')
                  }
                </td>
                <td>${f.resident ? escapeHtml(f.resident.residentType) : '—'}</td>
                <td class="tabular-nums">${f.resident ? f.resident.familyMembers : '—'}</td>
              </tr>
            `;
              })
              .join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

window.openAddFlatModal = function () {
  openModal(
    'Add Community Flat Unit',
    `
    <form id="addFlatForm">
      <div class="row g-3">
        <div class="col-md-4">
          <label class="form-label small fw-semibold">Block *</label>
          <select class="form-select" id="fltBlock" required>
            <option value="A">Block A</option>
            <option value="B">Block B</option>
            <option value="C">Block C</option>
            <option value="D">Block D</option>
          </select>
        </div>
        <div class="col-md-4">
          <label class="form-label small fw-semibold">Flat Number *</label>
          <input type="text" class="form-control tabular-nums" id="fltNumber" placeholder="e.g. C-202" required />
        </div>
        <div class="col-md-4">
          <label class="form-label small fw-semibold">Floor Number *</label>
          <input type="number" class="form-control tabular-nums" id="fltFloor" value="2" min="1" max="25" required />
        </div>
        <div class="col-md-6">
          <label class="form-label small fw-semibold">BHK Configuration</label>
          <select class="form-select" id="fltBhk">
            <option value="2 BHK">2 BHK</option>
            <option value="3 BHK" selected>3 BHK</option>
            <option value="4 BHK">4 BHK</option>
          </select>
        </div>
        <div class="col-md-6">
          <label class="form-label small fw-semibold">Carpet Area (sq.ft)</label>
          <input type="number" class="form-control tabular-nums" id="fltArea" value="1650" required />
        </div>
      </div>
      <div class="d-flex justify-content-end gap-2 mt-4 pt-3 border-top">
        <button type="button" class="btn btn-light border" data-bs-dismiss="modal">Cancel</button>
        <button type="submit" class="btn btn-sc-primary">Create Flat Unit</button>
      </div>
    </form>
  `,
    'modal-md'
  );

  document.getElementById('addFlatForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await apiRequest('/api/flats', {
        method: 'POST',
        body: JSON.stringify({
          block: document.getElementById('fltBlock').value,
          flatNumber: document.getElementById('fltNumber').value.trim(),
          floorNumber: Number(document.getElementById('fltFloor').value),
          bhkType: document.getElementById('fltBhk').value,
          areaSqft: Number(document.getElementById('fltArea').value),
          occupancyStatus: 'VACANT'
        })
      });
      showToast('Flat unit added to registry.', 'success');
      closeModal();
      loadActivePageContent();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  });
};

window.handleHouseholdRequest = async function (reqId, action) {
  try {
    await apiRequest(`/api/flats/household-requests/${reqId}`, {
      method: 'PUT',
      body: JSON.stringify({ action })
    });
    showToast(`Household update request ${action === 'APPROVE' ? 'approved' : 'rejected'}.`, 'success');
    loadActivePageContent();
  } catch (err) {
    showToast(err.message, 'danger');
  }
};

// RESIDENT: MY HOUSEHOLD PAGE
async function renderMyHouseholdPage() {
  const main = document.getElementById('scMainContent');
  const data = await apiRequest('/api/my-household');
  const { resident, flat, householdMembers = [], requests } = data;

  main.innerHTML = `
    <div class="sc-page-header">
      <div>
        <h3 class="fw-bold mb-1" style="color: var(--sc-navy);">My Household Information</h3>
        <div class="text-secondary small">
          Official flat occupancy record, registered family member accounts, and permitted contact details for Flat ${escapeHtml(resident.flatNumber)}
        </div>
      </div>
    </div>

    <div class="row g-4 mb-4">
      <!-- Official Flat & Occupancy Details (Read-Only, Managed by Administrator) -->
      <div class="col-12 col-xl-5">
        <div class="sc-card h-100">
          <div class="sc-card-header">
            <h6 class="fw-bold mb-0">Official Flat & Occupancy Record</h6>
            <span class="sc-status sc-status-info">Admin Verified</span>
          </div>
          <div class="sc-card-body">
            <div class="row g-3">
              <div class="col-6">
                <div class="text-muted small">Flat Number</div>
                <div class="fw-bold fs-5 tabular-nums">${escapeHtml(resident.flatNumber)}</div>
              </div>
              <div class="col-6">
                <div class="text-muted small">Block & Floor</div>
                <div class="fw-semibold">Block ${escapeHtml(resident.block)} · Floor ${flat.floorNumber || 1}</div>
              </div>
              <div class="col-6">
                <div class="text-muted small">Ownership Status</div>
                <div class="fw-semibold">${escapeHtml(resident.residentType)}</div>
              </div>
              <div class="col-6">
                <div class="text-muted small">Registered Members</div>
                <div class="fw-bold tabular-nums">${resident.familyMembers} Members</div>
              </div>
              <div class="col-6">
                <div class="text-muted small">Unit Configuration</div>
                <div class="tabular-nums">${escapeHtml(flat.bhkType || '3 BHK')} (${flat.areaSqft || 1650} sq.ft)</div>
              </div>
              <div class="col-6">
                <div class="text-muted small">Registration Date</div>
                <div class="tabular-nums">${escapeHtml(resident.registrationDate)}</div>
              </div>
            </div>
            <div class="alert alert-secondary small mt-4 mb-0">
              <i class="bi bi-info-circle me-1"></i>
              Flat ownership and official occupancy records are managed by the community administrator. You can update your contact details or submit a household member count change for administrator review on the right.
            </div>
          </div>
        </div>
      </div>

      <!-- Update Permitted Household Contact Details & Request Member Count Change -->
      <div class="col-12 col-xl-7">
        <div class="sc-card h-100">
          <div class="sc-card-header">
            <h6 class="fw-bold mb-0">Update Permitted Contact Details & Household Members</h6>
          </div>
          <div class="sc-card-body">
            <form id="myHouseholdForm">
              <div class="row g-3">
                <div class="col-md-6">
                  <label class="form-label small fw-semibold">Primary Phone Number *</label>
                  <input type="text" class="form-control tabular-nums" id="hhPhone" value="${escapeHtml(resident.phone)}" required />
                </div>
                <div class="col-md-6">
                  <label class="form-label small fw-semibold">Email Address *</label>
                  <input type="email" class="form-control" id="hhEmail" value="${escapeHtml(resident.email)}" required />
                </div>
                <div class="col-md-6">
                  <label class="form-label small fw-semibold">Emergency Contact Person & Phone</label>
                  <input type="text" class="form-control" id="hhEmergency" value="${escapeHtml(resident.emergencyContact || '')}" placeholder="e.g. Kavita Mehta (9848011299)" />
                </div>
                <div class="col-md-6">
                  <label class="form-label small fw-semibold">Registered Household Vehicles</label>
                  <input type="text" class="form-control tabular-nums" id="hhVehicles" value="${escapeHtml(resident.vehicleNumbers || '')}" placeholder="e.g. TS09-FM-4421" />
                </div>
                <div class="col-md-6">
                  <label class="form-label small fw-semibold">Request Household Member Count Update (Requires Admin Approval)</label>
                  <input type="number" min="1" max="20" class="form-control tabular-nums" id="hhMembers" value="${resident.familyMembers}" />
                </div>
              </div>
              <div class="text-end mt-4 pt-3 border-top">
                <button type="submit" class="btn btn-sc-primary">Save Contact Details</button>
              </div>
            </form>

            ${
              requests && requests.length > 0
                ? `<div class="mt-4 pt-3 border-top">
                     <h6 class="fw-bold small text-uppercase text-secondary mb-2">Household Member Change Requests</h6>
                     ${requests
                       .map(
                         (req) => `
                       <div class="p-2 rounded border bg-light d-flex justify-content-between align-items-center small mb-1">
                         <span>Requested change from <strong>${req.currentFamilyMembers}</strong> to <strong>${req.requestedFamilyMembers}</strong> members</span>
                         ${renderStatusBadge(req.status)}
                       </div>
                     `
                       )
                       .join('')}
                   </div>`
                : ''
            }
          </div>
        </div>
      </div>
    </div>

    <!-- Registered Accounts Linked to This Flat -->
    <div class="sc-card">
      <div class="sc-card-header">
        <div>
          <h6 class="fw-bold mb-0">Registered Resident Accounts for Flat ${escapeHtml(resident.flatNumber)} (${householdMembers.length})</h6>
          <div class="text-muted small">All family members registered under Flat ${escapeHtml(resident.flatNumber)} share access to flat maintenance bills, complaints, and bookings</div>
        </div>
      </div>
      <div class="table-responsive">
        <table class="table sc-table mb-0">
          <thead>
            <tr>
              <th>Resident ID</th>
              <th>Full Name</th>
              <th>Household Role</th>
              <th>Phone Number</th>
              <th>Email Address</th>
              <th>Ownership</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${(householdMembers.length ? householdMembers : [resident])
              .map(
                (m) => `
              <tr>
                <td class="tabular-nums fw-semibold">${escapeHtml(m.residentCode)}</td>
                <td class="fw-semibold text-dark">${escapeHtml(m.fullName)}</td>
                <td><span class="sc-status sc-status-info">${escapeHtml(m.memberRole || 'Primary Resident')}</span></td>
                <td class="tabular-nums">${escapeHtml(m.phone)}</td>
                <td>${escapeHtml(m.email)}</td>
                <td>${escapeHtml(m.residentType)}</td>
                <td>${renderStatusBadge(m.status)}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById('myHouseholdForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const res = await apiRequest('/api/my-household/contact', {
        method: 'PUT',
        body: JSON.stringify({
          phone: document.getElementById('hhPhone').value.trim(),
          email: document.getElementById('hhEmail').value.trim(),
          emergencyContact: document.getElementById('hhEmergency').value.trim(),
          vehicleNumbers: document.getElementById('hhVehicles').value.trim(),
          requestedFamilyMembers: Number(document.getElementById('hhMembers').value)
        })
      });
      showToast(res.message, 'success');
      loadActivePageContent();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  });
}

// ============================================================================
// WORKER DASHBOARD, ASSIGNED COMPLAINTS & WORK HISTORY
// ============================================================================
async function renderWorkerDashboardPage() {
  const main = document.getElementById('scMainContent');
  const data = await apiRequest('/api/dashboard/worker');
  AppState.cache.workerDashboard = data;
  const { worker, stats, assignedComplaints } = data;

  main.innerHTML = `
    <div class="sc-page-header">
      <div>
        <h3 class="fw-bold mb-1" style="color: var(--sc-navy);">Maintenance Worker Dashboard</h3>
        <div class="text-secondary small">
          <strong>${escapeHtml(worker.name)}</strong> (${escapeHtml(worker.workerCode)}) · Specialization: <strong>${escapeHtml(worker.specialization)}</strong> · Status: ${renderStatusBadge(worker.availability)}
        </div>
      </div>
      <div class="sc-page-actions">
        <button class="btn btn-sc-primary btn-sm" onclick="navigateToPage('worker-complaints')">
          <i class="bi bi-tools me-1"></i>My Assigned Complaints
        </button>
        <button class="btn btn-outline-secondary btn-sm bg-white" onclick="navigateToPage('worker-history')">
          <i class="bi bi-clock-history me-1"></i>My Work History
        </button>
      </div>
    </div>

    <!-- 6 Worker Summary Cards -->
    <div class="row g-3 mb-4">
      <div class="col-6 col-md-4 col-xl-2">
        <div class="sc-stat-card">
          <div>
            <div class="text-secondary small fw-semibold mb-1">Total Assigned</div>
            <div class="stat-value tabular-nums">${stats.totalAssigned}</div>
            <div class="text-muted small mt-1">All tasks</div>
          </div>
        </div>
      </div>
      <div class="col-6 col-md-4 col-xl-2">
        <div class="sc-stat-card">
          <div>
            <div class="text-secondary small fw-semibold mb-1">Awaiting Acceptance</div>
            <div class="stat-value tabular-nums" style="color: #B45309;">${stats.awaitingAcceptance}</div>
            <div class="text-muted small mt-1">New assignments</div>
          </div>
        </div>
      </div>
      <div class="col-6 col-md-4 col-xl-2">
        <div class="sc-stat-card">
          <div>
            <div class="text-secondary small fw-semibold mb-1">Accepted Tasks</div>
            <div class="stat-value tabular-nums" style="color: #2563EB;">${stats.acceptedTasks}</div>
            <div class="text-muted small mt-1">Ready to start</div>
          </div>
        </div>
      </div>
      <div class="col-6 col-md-4 col-xl-2">
        <div class="sc-stat-card">
          <div>
            <div class="text-secondary small fw-semibold mb-1">In-Progress Tasks</div>
            <div class="stat-value tabular-nums" style="color: #1D4ED8;">${stats.inProgressTasks}</div>
            <div class="text-muted small mt-1">Active work</div>
          </div>
        </div>
      </div>
      <div class="col-6 col-md-4 col-xl-2">
        <div class="sc-stat-card">
          <div>
            <div class="text-secondary small fw-semibold mb-1">Completed Tasks</div>
            <div class="stat-value tabular-nums" style="color: #15803D;">${stats.completedTasks}</div>
            <div class="text-muted small mt-1">Resolved by you</div>
          </div>
        </div>
      </div>
      <div class="col-6 col-md-4 col-xl-2">
        <div class="sc-stat-card">
          <div>
            <div class="text-secondary small fw-semibold mb-1">High-Priority</div>
            <div class="stat-value tabular-nums" style="color: #B91C1C;">${stats.highPriorityTasks}</div>
            <div class="text-muted small mt-1">Urgent active</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Assigned Complaints Table -->
    <div class="sc-card">
      <div class="sc-card-header">
        <h6 class="fw-bold mb-0">My Assigned Maintenance Complaints</h6>
      </div>
      <div class="table-responsive">
        ${renderWorkerComplaintsTableHtml(assignedComplaints)}
      </div>
    </div>
  `;
}

async function renderWorkerComplaintsPage() {
  const main = document.getElementById('scMainContent');
  const data = await apiRequest('/api/dashboard/worker');
  const activeComplaints = (data.assignedComplaints || []).filter((c) => c.status !== 'Resolved');

  main.innerHTML = `
    <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
      <div>
        <h3 class="fw-bold mb-1" style="color: var(--sc-navy);">My Assigned Complaints</h3>
        <div class="text-secondary small">
          Accept or decline new assignments, update progress to In Progress, and submit completion notes
        </div>
      </div>
    </div>

    <div class="sc-card">
      <div class="sc-card-header">
        <h6 class="fw-bold mb-0">Active Assigned Tasks (${activeComplaints.length})</h6>
      </div>
      <div class="table-responsive">
        ${renderWorkerComplaintsTableHtml(activeComplaints)}
      </div>
    </div>
  `;
}

async function renderWorkerHistoryPage() {
  const main = document.getElementById('scMainContent');
  const data = await apiRequest('/api/dashboard/worker');
  const completedComplaints = (data.assignedComplaints || []).filter((c) => c.status === 'Resolved');

  main.innerHTML = `
    <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
      <div>
        <h3 class="fw-bold mb-1" style="color: var(--sc-navy);">My Work History</h3>
        <div class="text-secondary small">Completed maintenance tasks and resolution logs</div>
      </div>
    </div>

    <div class="sc-card">
      <div class="sc-card-header">
        <h6 class="fw-bold mb-0">Completed Tasks (${completedComplaints.length})</h6>
      </div>
      <div class="table-responsive">
        ${renderWorkerComplaintsTableHtml(completedComplaints)}
      </div>
    </div>
  `;
}

function renderWorkerComplaintsTableHtml(list) {
  if (!list || list.length === 0) {
    return `
      <div class="sc-empty-state">
        <div class="sc-empty-icon"><i class="bi bi-check2-circle"></i></div>
        <h6 class="fw-bold text-dark mb-1">No Assigned Tasks in This View</h6>
        <p class="small mb-0">When the administrator assigns a complaint to you, it will appear here.</p>
      </div>
    `;
  }

  return `
    <table class="table sc-table">
      <thead>
        <tr>
          <th>Complaint ID</th>
          <th>Category</th>
          <th>Description</th>
          <th>Flat / Location</th>
          <th>Priority</th>
          <th>Assignment Date</th>
          <th>Current Status</th>
          <th class="text-end">Worker Actions</th>
        </tr>
      </thead>
      <tbody>
        ${list
          .map(
            (c) => `
          <tr>
            <td class="tabular-nums fw-semibold">${escapeHtml(c.complaintCode)}</td>
            <td class="fw-medium">${escapeHtml(c.category)}</td>
            <td style="max-width: 260px;">
              <div class="text-truncate" title="${escapeHtml(c.description)}">${escapeHtml(c.description)}</div>
              ${
                c.resolutionNotes
                  ? `<div class="text-muted small text-truncate">Note: ${escapeHtml(c.resolutionNotes)}</div>`
                  : ''
              }
            </td>
            <td class="tabular-nums fw-semibold">Flat ${escapeHtml(c.flatNumber)}</td>
            <td>${renderStatusBadge(c.priority)}</td>
            <td class="tabular-nums small">${escapeHtml(c.assignedDate || c.complaintDate)}</td>
            <td>${renderStatusBadge(c.status)}</td>
            <td class="text-end">
              ${
                c.status === 'Assigned' || c.workerAcceptanceStatus === 'Pending Acceptance'
                  ? `<div class="btn-group btn-group-sm">
                       <button class="btn btn-success" onclick="workerAcceptTask(${c.id})">
                         <i class="bi bi-check-lg me-1"></i>Accept
                       </button>
                       <button class="btn btn-outline-danger" onclick="openWorkerDeclineModal(${c.id})">
                         Decline
                       </button>
                     </div>`
                  : c.status === 'Accepted'
                  ? `<div class="btn-group btn-group-sm">
                       <button class="btn btn-sc-primary" onclick="workerStartProgress(${c.id})">
                         <i class="bi bi-play-fill me-1"></i>Start Work
                       </button>
                       <button class="btn btn-success" onclick="openWorkerCompleteModal(${c.id})">
                         Complete
                       </button>
                     </div>`
                  : c.status === 'In Progress'
                  ? `<div class="btn-group btn-group-sm">
                       <button class="btn btn-success" onclick="openWorkerCompleteModal(${c.id})">
                         <i class="bi bi-check2-circle me-1"></i>Mark Completed
                       </button>
                       <button class="btn btn-light border" onclick="openManageComplaintModal(${c.id})">
                         Details
                       </button>
                     </div>`
                  : `<button class="btn btn-sm btn-light border" onclick="openManageComplaintModal(${c.id})">
                       View History
                     </button>`
              }
            </td>
          </tr>
        `
          )
          .join('')}
      </tbody>
    </table>
  `;
}

window.workerAcceptTask = async function (complaintId) {
  try {
    await apiRequest(`/api/complaints/${complaintId}/worker-accept`, { method: 'POST' });
    showToast('Task accepted! You can now mark it In Progress when you start work.', 'success');
    refreshNotificationsBadge();
    loadActivePageContent();
  } catch (err) {
    showToast(err.message, 'danger');
  }
};

window.openWorkerDeclineModal = function (complaintId) {
  openModal(
    'Decline Assigned Task',
    `
    <form id="workerDeclineForm">
      <p class="small text-secondary mb-3">
        Please enter a clear reason for declining this assignment. The administrator will be notified immediately so the complaint can be reassigned to another worker.
      </p>
      <div class="mb-3">
        <label class="form-label small fw-semibold">Reason for Declining *</label>
        <textarea class="form-control" id="declineReasonInput" rows="3" placeholder="e.g. Currently handling an emergency pipe burst in Block A; unavailable for 3 hours." required></textarea>
      </div>
      <div class="d-flex justify-content-end gap-2">
        <button type="button" class="btn btn-light border" data-bs-dismiss="modal">Cancel</button>
        <button type="submit" class="btn btn-danger">Submit Decline & Notify Admin</button>
      </div>
    </form>
  `,
    'modal-md'
  );

  document.getElementById('workerDeclineForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await apiRequest(`/api/complaints/${complaintId}/worker-decline`, {
        method: 'POST',
        body: JSON.stringify({
          reason: document.getElementById('declineReasonInput').value.trim()
        })
      });
      showToast('Assignment declined. Administrator has been notified to reassign.', 'info');
      closeModal();
      refreshNotificationsBadge();
      loadActivePageContent();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  });
};

window.workerStartProgress = async function (complaintId) {
  try {
    await apiRequest(`/api/complaints/${complaintId}/worker-progress`, {
      method: 'POST',
      body: JSON.stringify({ progressNotes: 'Worker started on-site inspection and maintenance work.' })
    });
    showToast('Task status updated to In Progress.', 'success');
    refreshNotificationsBadge();
    loadActivePageContent();
  } catch (err) {
    showToast(err.message, 'danger');
  }
};

window.openWorkerCompleteModal = function (complaintId) {
  openModal(
    'Complete Maintenance Task & Resolve Complaint',
    `
    <form id="workerCompleteForm">
      <p class="small text-secondary mb-3">
        Enter detailed completion and resolution notes below. Upon submission, the task will be marked Completed and the complaint status will update to Resolved for the resident and administrator.
      </p>
      <div class="mb-3">
        <label class="form-label small fw-semibold">Completion / Resolution Notes *</label>
        <textarea class="form-control" id="workerCompletionNotes" rows="3" placeholder="Describe the repair performed, parts replaced, and verification test..." required></textarea>
      </div>
      <div class="d-flex justify-content-end gap-2">
        <button type="button" class="btn btn-light border" data-bs-dismiss="modal">Cancel</button>
        <button type="submit" class="btn btn-success">
          <i class="bi bi-check2-circle me-1"></i>Submit Notes & Mark Completed
        </button>
      </div>
    </form>
  `,
    'modal-md'
  );

  document.getElementById('workerCompleteForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await apiRequest(`/api/complaints/${complaintId}/worker-complete`, {
        method: 'POST',
        body: JSON.stringify({
          resolutionNotes: document.getElementById('workerCompletionNotes').value.trim()
        })
      });
      showToast('Task marked Completed and complaint resolved!', 'success');
      closeModal();
      refreshNotificationsBadge();
      loadActivePageContent();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  });
};

// ============================================================================
// RESIDENT MANAGEMENT (ADMIN)
// ============================================================================
async function renderResidentsPage() {
  const main = document.getElementById('scMainContent');
  const residents = await apiRequest('/api/residents');
  AppState.cache.residents = residents;

  main.innerHTML = `
    <div class="sc-page-header">
      <div>
        <h3 class="fw-bold mb-1" style="color: var(--sc-navy);">Resident Management</h3>
        <div class="text-secondary small">
          Directory of registered flat owners, tenants, and family members across Blocks A, B, C, and D
        </div>
      </div>
      <div class="sc-page-actions">
        <button class="btn btn-sc-primary btn-sm" onclick="openResidentModal()">
          <i class="bi bi-person-plus-fill me-1"></i>Add Resident
        </button>
      </div>
    </div>

    <div class="sc-card">
      <div class="sc-card-header">
        <div class="row g-2 w-100 align-items-center">
          <div class="col-12 col-md-5">
            <div class="input-group input-group-sm">
              <span class="input-group-text bg-light"><i class="bi bi-search"></i></span>
              <input
                type="text"
                id="residentSearchInput"
                class="form-control"
                placeholder="Search by name, flat (e.g. A-101), phone, or email..."
                oninput="filterResidentsTable()"
              />
            </div>
          </div>
          <div class="col-6 col-md-3">
            <select id="residentBlockFilter" class="form-select form-select-sm" onchange="filterResidentsTable()">
              <option value="">All Blocks (A - D)</option>
              <option value="A">Block A</option>
              <option value="B">Block B</option>
              <option value="C">Block C</option>
              <option value="D">Block D</option>
            </select>
          </div>
          <div class="col-6 col-md-3">
            <select id="residentTypeFilter" class="form-select form-select-sm" onchange="filterResidentsTable()">
              <option value="">All Types (Owner & Tenant)</option>
              <option value="Owner">Owner</option>
              <option value="Tenant">Tenant</option>
            </select>
          </div>
          <div class="col-12 col-md-1 text-end">
            <span class="small text-muted tabular-nums" id="residentCountLabel">${residents.length} rows</span>
          </div>
        </div>
      </div>

      <div class="table-responsive" id="residentsTableContainer"></div>
    </div>
  `;

  filterResidentsTable();
}

window.filterResidentsTable = function () {
  const query = (document.getElementById('residentSearchInput')?.value || '').trim().toLowerCase();
  const blockFilter = document.getElementById('residentBlockFilter')?.value || '';
  const typeFilter = document.getElementById('residentTypeFilter')?.value || '';

  const filtered = AppState.cache.residents.filter((r) => {
    const matchesQuery =
      !query ||
      String(r.fullName).toLowerCase().includes(query) ||
      String(r.flatNumber).toLowerCase().includes(query) ||
      String(r.residentCode).toLowerCase().includes(query) ||
      String(r.phone).toLowerCase().includes(query) ||
      String(r.email).toLowerCase().includes(query);
    const matchesBlock = !blockFilter || String(r.block).toUpperCase() === blockFilter;
    const matchesType = !typeFilter || r.residentType === typeFilter;
    return matchesQuery && matchesBlock && matchesType;
  });

  const countEl = document.getElementById('residentCountLabel');
  if (countEl) countEl.textContent = `${filtered.length} rows`;

  const container = document.getElementById('residentsTableContainer');
  if (!container) return;

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="sc-empty-state">
        <div class="sc-empty-icon"><i class="bi bi-people"></i></div>
        <h6 class="fw-bold text-dark mb-1">No Matching Resident Records</h6>
        <p class="small mb-3">Try clearing your search filters or register a new resident flat record.</p>
        <button class="btn btn-sc-primary btn-sm" onclick="openResidentModal()">Add Resident</button>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <table class="table sc-table">
      <thead>
        <tr>
          <th>Resident ID</th>
          <th>Name</th>
          <th>Flat Number</th>
          <th>Block</th>
          <th>Phone</th>
          <th>Email</th>
          <th>Resident Type</th>
          <th>Status</th>
          <th class="text-end">Actions</th>
        </tr>
      </thead>
      <tbody>
        ${filtered
          .map(
            (r) => `
          <tr>
            <td class="tabular-nums fw-semibold">${escapeHtml(r.residentCode)}</td>
            <td class="fw-semibold text-dark">${escapeHtml(r.fullName)}</td>
            <td class="tabular-nums fw-medium">${escapeHtml(r.flatNumber)}</td>
            <td>Block ${escapeHtml(r.block)}</td>
            <td class="tabular-nums">${escapeHtml(r.phone)}</td>
            <td class="text-secondary small">${escapeHtml(r.email)}</td>
            <td>${escapeHtml(r.residentType)}</td>
            <td>${renderStatusBadge(r.status)}</td>
            <td class="text-end">
              <div class="btn-group btn-group-sm">
                <button class="btn btn-light border" onclick="viewResidentDetails(${r.id})" title="View Details">
                  <i class="bi bi-eye"></i>
                </button>
                <button class="btn btn-light border" onclick="openResidentModal(${r.id})" title="Edit Resident">
                  <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-light border text-danger" onclick="confirmDeleteResident(${r.id})" title="Delete Resident">
                  <i class="bi bi-trash"></i>
                </button>
              </div>
            </td>
          </tr>
        `
          )
          .join('')}
      </tbody>
    </table>
  `;
};

window.viewResidentDetails = function (id) {
  const r = AppState.cache.residents.find((x) => x.id === id);
  if (!r) return;
  openModal(
    `Resident Profile — ${r.fullName}`,
    `
    <div class="row g-3">
      <div class="col-sm-6">
        <div class="text-muted small">Resident ID</div>
        <div class="fw-bold tabular-nums">${escapeHtml(r.residentCode)}</div>
      </div>
      <div class="col-sm-6">
        <div class="text-muted small">Status</div>
        <div>${renderStatusBadge(r.status)}</div>
      </div>
      <div class="col-sm-6">
        <div class="text-muted small">Full Name</div>
        <div class="fw-semibold">${escapeHtml(r.fullName)}</div>
      </div>
      <div class="col-sm-6">
        <div class="text-muted small">Block & Flat Number</div>
        <div class="fw-semibold tabular-nums">Block ${escapeHtml(r.block)} · Flat ${escapeHtml(r.flatNumber)}</div>
      </div>
      <div class="col-sm-6">
        <div class="text-muted small">Phone Number</div>
        <div class="tabular-nums">${escapeHtml(r.phone)}</div>
      </div>
      <div class="col-sm-6">
        <div class="text-muted small">Email Address</div>
        <div>${escapeHtml(r.email)}</div>
      </div>
      <div class="col-sm-6">
        <div class="text-muted small">Ownership Type</div>
        <div>${escapeHtml(r.residentType)}</div>
      </div>
      <div class="col-sm-6">
        <div class="text-muted small">Family Members</div>
        <div class="tabular-nums">${r.familyMembers} members</div>
      </div>
      <div class="col-sm-6">
        <div class="text-muted small">Registration Date</div>
        <div class="tabular-nums">${escapeHtml(r.registrationDate)}</div>
      </div>
    </div>
    <div class="text-end mt-4 pt-3 border-top">
      <button class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Close</button>
      <button class="btn btn-sc-primary btn-sm ms-2" onclick="openResidentModal(${r.id})">Edit Record</button>
    </div>
  `,
    'modal-md'
  );
};

window.openResidentModal = function (editId = null) {
  const existing = editId ? AppState.cache.residents.find((r) => r.id === editId) : null;
  const today = new Date().toISOString().slice(0, 10);

  openModal(
    existing ? `Edit Resident — ${existing.residentCode}` : 'Register New Resident & Flat Account',
    `
    <form id="residentForm">
      <div class="row g-3">
        <div class="col-md-6">
          <label class="form-label small fw-semibold">Full Name *</label>
          <input type="text" class="form-control" id="resFullName" value="${escapeHtml(existing?.fullName || '')}" placeholder="e.g. Arvind Swamy" required />
        </div>
        <div class="col-6 col-md-3">
          <label class="form-label small fw-semibold">Block *</label>
          <select class="form-select" id="resBlock" required>
            ${['A', 'B', 'C', 'D']
              .map((b) => `<option value="${b}" ${existing?.block === b ? 'selected' : ''}>Block ${b}</option>`)
              .join('')}
          </select>
        </div>
        <div class="col-6 col-md-3">
          <label class="form-label small fw-semibold">Flat Number *</label>
          <input type="text" class="form-control tabular-nums" id="resFlatNumber" value="${escapeHtml(existing?.flatNumber || '')}" placeholder="e.g. A-201" required />
        </div>
        <div class="col-md-6">
          <label class="form-label small fw-semibold">Phone Number (10-15 digits) *</label>
          <input type="text" class="form-control tabular-nums" id="resPhone" value="${escapeHtml(existing?.phone || '')}" placeholder="e.g. 9848012345" required />
        </div>
        <div class="col-md-6">
          <label class="form-label small fw-semibold">Email Address (Login ID) *</label>
          <input type="email" class="form-control" id="resEmail" value="${escapeHtml(existing?.email || '')}" placeholder="resident@example.com" required />
        </div>
        <div class="col-6 col-md-4">
          <label class="form-label small fw-semibold">Owner or Tenant *</label>
          <select class="form-select" id="resType">
            <option value="Owner" ${existing?.residentType === 'Owner' ? 'selected' : ''}>Owner</option>
            <option value="Tenant" ${existing?.residentType === 'Tenant' ? 'selected' : ''}>Tenant</option>
          </select>
        </div>
        <div class="col-6 col-md-4">
          <label class="form-label small fw-semibold">Household Role</label>
          <select class="form-select" id="resMemberRole">
            <option value="Primary Resident" ${existing?.memberRole === 'Primary Resident' ? 'selected' : ''}>Primary Resident</option>
            <option value="Family Member" ${existing?.memberRole === 'Family Member' ? 'selected' : ''}>Family Member</option>
          </select>
        </div>
        <div class="col-6 col-md-4">
          <label class="form-label small fw-semibold">Family Members *</label>
          <input type="number" min="1" max="20" class="form-control tabular-nums" id="resFamily" value="${existing?.familyMembers || 3}" required />
        </div>
        <div class="col-6 col-md-4">
          <label class="form-label small fw-semibold">Registration Date *</label>
          <input type="date" class="form-control tabular-nums" id="resRegDate" value="${existing?.registrationDate || today}" required />
        </div>
        <div class="col-12 col-md-4">
          <label class="form-label small fw-semibold">${existing ? 'Reset Account Password (Optional)' : 'Initial Account Password'}</label>
          <input type="password" class="form-control" id="resPassword" placeholder="${existing ? 'Leave blank to keep current' : 'Default: Resident@123'}" />
        </div>
        ${
          existing
            ? `<div class="col-12 col-md-4">
                 <label class="form-label small fw-semibold">Account Status</label>
                 <select class="form-select" id="resStatus">
                   <option value="Active" ${existing.status === 'Active' ? 'selected' : ''}>Active</option>
                   <option value="Inactive" ${existing.status === 'Inactive' ? 'selected' : ''}>Inactive</option>
                 </select>
               </div>`
            : ''
        }
      </div>
      <div class="d-flex justify-content-end gap-2 mt-4 pt-3 border-top">
        <button type="button" class="btn btn-light border" data-bs-dismiss="modal">Cancel</button>
        <button type="submit" class="btn btn-sc-primary">
          ${existing ? 'Save Changes' : 'Register Resident'}
        </button>
      </div>
    </form>
  `
  );

  document.getElementById('residentForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      fullName: document.getElementById('resFullName').value.trim(),
      block: document.getElementById('resBlock').value,
      flatNumber: document.getElementById('resFlatNumber').value.trim(),
      phone: document.getElementById('resPhone').value.trim(),
      email: document.getElementById('resEmail').value.trim(),
      residentType: document.getElementById('resType').value,
      memberRole: document.getElementById('resMemberRole').value,
      familyMembers: Number(document.getElementById('resFamily').value) || 1,
      registrationDate: document.getElementById('resRegDate').value,
      password: document.getElementById('resPassword').value,
      status: document.getElementById('resStatus')?.value || 'Active'
    };

    try {
      let res;
      if (existing) {
        res = await apiRequest(`/api/residents/${existing.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        showToast(`Updated resident record for ${payload.fullName}.`, 'success');
      } else {
        res = await apiRequest('/api/residents', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        showToast(`Resident ${payload.fullName} (Flat ${payload.flatNumber}) registered.`, 'success');
      }
      if (res?.vaultToken) {
        localStorage.setItem('sc_account_vault', res.vaultToken);
      }
      closeModal();
      loadActivePageContent();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  });
};

window.confirmDeleteResident = function (id) {
  const r = AppState.cache.residents.find((x) => x.id === id);
  if (!r) return;
  openModal(
    'Confirm Resident Deletion',
    `
    <p class="mb-3">Are you sure you want to remove resident <strong>${escapeHtml(r.fullName)}</strong> (Flat <strong>${escapeHtml(r.flatNumber)}</strong>)?</p>
    <div class="d-flex justify-content-end gap-2">
      <button class="btn btn-light border" data-bs-dismiss="modal">Cancel</button>
      <button class="btn btn-danger" id="confirmDelResBtn">Delete Resident</button>
    </div>
  `,
    'modal-md'
  );

  document.getElementById('confirmDelResBtn').addEventListener('click', async () => {
    try {
      await apiRequest(`/api/residents/${id}`, { method: 'DELETE' });
      showToast(`Deleted resident ${r.fullName}.`, 'info');
      closeModal();
      loadActivePageContent();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  });
};

// ============================================================================
// VISITOR MANAGEMENT (ADMIN SECURITY ENTRY FEATURE)
// ============================================================================
async function renderVisitorsPage() {
  const main = document.getElementById('scMainContent');
  const [visitors, residents] = await Promise.all([
    apiRequest('/api/visitors'),
    apiRequest('/api/residents').catch(() => [])
  ]);
  AppState.cache.visitors = visitors;
  AppState.cache.residents = residents;

  const todayPrefix = new Date().toISOString().slice(0, 10);
  const visitorsToday = visitors.filter((v) => String(v.entryTime).startsWith(todayPrefix)).length;
  const currentlyInside = visitors.filter((v) => v.status === 'Inside').length;
  const completedVisits = visitors.filter((v) => v.status === 'Exited').length;

  main.innerHTML = `
    <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
      <div>
        <h3 class="fw-bold mb-1" style="color: var(--sc-navy);">Visitor Management</h3>
        <div class="text-secondary small">Security gate entry/exit register and visitor tracking</div>
      </div>
      <button class="btn btn-sc-primary" onclick="openRegisterVisitorModal()">
        <i class="bi bi-person-plus-fill me-1"></i>Register New Visitor
      </button>
    </div>

    <div class="row g-3 mb-4">
      <div class="col-md-4">
        <div class="sc-stat-card">
          <div>
            <div class="text-secondary small fw-semibold mb-1">Total Visitors Today</div>
            <div class="stat-value tabular-nums">${visitorsToday}</div>
          </div>
          <div class="sc-stat-icon" style="background: #EFF6FF; color: #2563EB;"><i class="bi bi-calendar-check"></i></div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="sc-stat-card">
          <div>
            <div class="text-secondary small fw-semibold mb-1">Currently Inside Community</div>
            <div class="stat-value tabular-nums" style="color: #1D4ED8;">${currentlyInside}</div>
          </div>
          <div class="sc-stat-icon" style="background: #DBEAFE; color: #1D4ED8;"><i class="bi bi-geo-alt-fill"></i></div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="sc-stat-card">
          <div>
            <div class="text-secondary small fw-semibold mb-1">Completed Visits</div>
            <div class="stat-value tabular-nums" style="color: #15803D;">${completedVisits}</div>
          </div>
          <div class="sc-stat-icon" style="background: #DCFCE7; color: #15803D;"><i class="bi bi-box-arrow-right"></i></div>
        </div>
      </div>
    </div>

    <div class="sc-card">
      <div class="sc-card-header">
        <div class="row g-2 w-100 align-items-center">
          <div class="col-md-5">
            <div class="input-group input-group-sm">
              <span class="input-group-text bg-light"><i class="bi bi-search"></i></span>
              <input type="text" id="visitorSearchInput" class="form-control" placeholder="Search by visitor name, flat, or purpose..." oninput="filterVisitorsTable()" />
            </div>
          </div>
          <div class="col-md-3">
            <select id="visitorStatusFilter" class="form-select form-select-sm" onchange="filterVisitorsTable()">
              <option value="">All Statuses</option>
              <option value="Inside">Inside</option>
              <option value="Exited">Exited</option>
            </select>
          </div>
          <div class="col-md-4">
            <input type="date" id="visitorDateFilter" class="form-control form-control-sm tabular-nums" onchange="filterVisitorsTable()" />
          </div>
        </div>
      </div>
      <div class="table-responsive" id="visitorsTableContainer"></div>
    </div>
  `;

  filterVisitorsTable();
}

window.filterVisitorsTable = function () {
  const query = (document.getElementById('visitorSearchInput')?.value || '').trim().toLowerCase();
  const statusFilter = document.getElementById('visitorStatusFilter')?.value || '';
  const dateFilter = document.getElementById('visitorDateFilter')?.value || '';

  const filtered = AppState.cache.visitors.filter((v) => {
    const matchesQuery =
      !query ||
      String(v.visitorName).toLowerCase().includes(query) ||
      String(v.flatNumber).toLowerCase().includes(query) ||
      String(v.purpose).toLowerCase().includes(query);
    const matchesStatus = !statusFilter || v.status === statusFilter;
    const matchesDate = !dateFilter || String(v.entryTime).startsWith(dateFilter);
    return matchesQuery && matchesStatus && matchesDate;
  });

  const container = document.getElementById('visitorsTableContainer');
  if (!container) return;

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="sc-empty-state">
        <div class="sc-empty-icon"><i class="bi bi-person-badge"></i></div>
        <h6 class="fw-bold text-dark mb-1">No Visitor Entries Found</h6>
        <p class="small mb-3">Register incoming visitors at the security desk to log their entry time automatically.</p>
        <button class="btn btn-sc-primary btn-sm" onclick="openRegisterVisitorModal()">Register Visitor</button>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <table class="table sc-table">
      <thead>
        <tr>
          <th>Visitor ID</th>
          <th>Visitor Name</th>
          <th>Contact Number</th>
          <th>Flat to Visit</th>
          <th>Purpose</th>
          <th>Entry Time</th>
          <th>Exit Time</th>
          <th>Status</th>
          <th class="text-end">Action</th>
        </tr>
      </thead>
      <tbody>
        ${filtered
          .map(
            (v) => `
          <tr>
            <td class="tabular-nums fw-semibold">${escapeHtml(v.visitorCode)}</td>
            <td class="fw-semibold text-dark">${escapeHtml(v.visitorName)}</td>
            <td class="tabular-nums">${escapeHtml(v.contactNumber)}</td>
            <td class="tabular-nums fw-medium">Flat ${escapeHtml(v.flatNumber)}</td>
            <td>${escapeHtml(v.purpose)}</td>
            <td class="tabular-nums small">${escapeHtml(v.entryTime)}</td>
            <td class="tabular-nums small">${escapeHtml(v.exitTime || '—')}</td>
            <td>${renderStatusBadge(v.status)}</td>
            <td class="text-end">
              ${
                v.status === 'Inside'
                  ? `<button class="btn btn-sm btn-outline-success" onclick="markVisitorExit(${v.id})">
                       <i class="bi bi-box-arrow-right me-1"></i>Mark Exit
                     </button>`
                  : `<span class="text-muted small">Completed</span>`
              }
            </td>
          </tr>
        `
          )
          .join('')}
      </tbody>
    </table>
  `;
};

window.openRegisterVisitorModal = function () {
  const flatOptions = AppState.cache.residents
    .map((r) => `<option value="${escapeHtml(r.flatNumber)}">Flat ${escapeHtml(r.flatNumber)} — ${escapeHtml(r.fullName)}</option>`)
    .join('');

  openModal(
    'Register Incoming Visitor',
    `
    <form id="visitorForm">
      <div class="row g-3">
        <div class="col-md-6">
          <label class="form-label small fw-semibold">Visitor Name *</label>
          <input type="text" class="form-control" id="visName" placeholder="e.g. Rajesh Kumar" required />
        </div>
        <div class="col-md-6">
          <label class="form-label small fw-semibold">Contact Number *</label>
          <input type="text" class="form-control tabular-nums" id="visPhone" placeholder="e.g. 9848099887" required />
        </div>
        <div class="col-md-6">
          <label class="form-label small fw-semibold">Flat Being Visited *</label>
          ${
            flatOptions
              ? `<select class="form-select" id="visFlat" required>${flatOptions}</select>`
              : `<input type="text" class="form-control" id="visFlat" placeholder="e.g. A-101" required />`
          }
        </div>
        <div class="col-md-6">
          <label class="form-label small fw-semibold">Purpose of Visit *</label>
          <input type="text" class="form-control" id="visPurpose" placeholder="e.g. Family Visit / Courier Delivery" required />
        </div>
      </div>
      <div class="form-text mt-2">
        <i class="bi bi-clock me-1"></i>Entry timestamp will be recorded automatically upon submission.
      </div>
      <div class="d-flex justify-content-end gap-2 mt-4 pt-3 border-top">
        <button type="button" class="btn btn-light border" data-bs-dismiss="modal">Cancel</button>
        <button type="submit" class="btn btn-sc-primary">Record Visitor Entry</button>
      </div>
    </form>
  `,
    'modal-md'
  );

  document.getElementById('visitorForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await apiRequest('/api/visitors', {
        method: 'POST',
        body: JSON.stringify({
          visitorName: document.getElementById('visName').value.trim(),
          contactNumber: document.getElementById('visPhone').value.trim(),
          flatNumber: document.getElementById('visFlat').value.trim(),
          purpose: document.getElementById('visPurpose').value.trim()
        })
      });
      showToast('Visitor entry logged.', 'success');
      closeModal();
      loadActivePageContent();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  });
};

window.markVisitorExit = async function (id) {
  try {
    await apiRequest(`/api/visitors/${id}/exit`, { method: 'PUT' });
    showToast('Visitor exit time recorded.', 'success');
    loadActivePageContent();
  } catch (err) {
    showToast(err.message, 'danger');
  }
};

// ============================================================================
// COMPLAINT MANAGEMENT (ADMIN VIEW vs RESIDENT VIEW)
// ============================================================================
async function renderAdminComplaintsPage() {
  const main = document.getElementById('scMainContent');
  const [complaints, priorityQueue, workers, residents] = await Promise.all([
    apiRequest('/api/complaints'),
    apiRequest('/api/complaints/priority-queue'),
    apiRequest('/api/workers').catch(() => []),
    apiRequest('/api/residents').catch(() => [])
  ]);

  AppState.cache.complaints = complaints;
  AppState.cache.priorityQueue = priorityQueue;
  AppState.cache.workers = workers;
  AppState.cache.residents = residents;

  const total = complaints.length;
  const pending = complaints.filter((c) => c.status === 'Pending' || c.status === 'Assigned').length;
  const inProgress = complaints.filter((c) => c.status === 'Accepted' || c.status === 'In Progress').length;
  const resolved = complaints.filter((c) => c.status === 'Resolved').length;
  const highPrio = complaints.filter((c) => c.priority === 'High' && c.status !== 'Resolved').length;

  const categories = [
    'Water Leakage',
    'Electricity',
    'Lift Maintenance',
    'Garbage Collection',
    'Plumbing',
    'Security',
    'Parking',
    'Garden Maintenance',
    'Other'
  ];

  main.innerHTML = `
    <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
      <div>
        <h3 class="fw-bold mb-1" style="color: var(--sc-navy);">Complaint Management & Dispatch</h3>
        <div class="text-secondary small">
          Review complaint priority, assign or reassign maintenance workers, and track resolution progress
        </div>
      </div>
      <button class="btn btn-sc-primary" onclick="openRegisterComplaintModal()">
        <i class="bi bi-plus-lg me-1"></i>Register Complaint
      </button>
    </div>

    <!-- 5 Complaint Summary Cards -->
    <div class="row g-3 mb-4">
      <div class="col-6 col-xl">
        <div class="sc-stat-card">
          <div>
            <div class="text-secondary small fw-semibold">Total Complaints</div>
            <div class="stat-value tabular-nums">${total}</div>
          </div>
          <div class="sc-stat-icon" style="background: #F1F5F9; color: #142D4E;"><i class="bi bi-list-task"></i></div>
        </div>
      </div>
      <div class="col-6 col-xl">
        <div class="sc-stat-card">
          <div>
            <div class="text-secondary small fw-semibold">Pending / Assigned</div>
            <div class="stat-value tabular-nums" style="color: #B45309;">${pending}</div>
          </div>
          <div class="sc-stat-icon" style="background: #FEF3C7; color: #B45309;"><i class="bi bi-clock-history"></i></div>
        </div>
      </div>
      <div class="col-6 col-xl">
        <div class="sc-stat-card">
          <div>
            <div class="text-secondary small fw-semibold">Accepted / In Progress</div>
            <div class="stat-value tabular-nums" style="color: #1D4ED8;">${inProgress}</div>
          </div>
          <div class="sc-stat-icon" style="background: #DBEAFE; color: #1D4ED8;"><i class="bi bi-gear-wide-connected"></i></div>
        </div>
      </div>
      <div class="col-6 col-xl">
        <div class="sc-stat-card">
          <div>
            <div class="text-secondary small fw-semibold">Resolved</div>
            <div class="stat-value tabular-nums" style="color: #15803D;">${resolved}</div>
          </div>
          <div class="sc-stat-icon" style="background: #DCFCE7; color: #15803D;"><i class="bi bi-check2-circle"></i></div>
        </div>
      </div>
      <div class="col-12 col-xl">
        <div class="sc-stat-card">
          <div>
            <div class="text-secondary small fw-semibold">High-Priority Active</div>
            <div class="stat-value tabular-nums" style="color: #B91C1C;">${highPrio}</div>
          </div>
          <div class="sc-stat-icon" style="background: #FEE2E2; color: #B91C1C;"><i class="bi bi-exclamation-octagon-fill"></i></div>
        </div>
      </div>
    </div>

    <!-- Dedicated Smart Priority Queue Section -->
    <div class="sc-card mb-4">
      <div class="sc-card-header bg-light">
        <div>
          <h6 class="fw-bold mb-0" style="color: var(--sc-navy);">
            <i class="bi bi-sort-numeric-down-alt text-primary me-2"></i>Smart Complaint Priority Queue
          </h6>
          <div class="text-secondary small">
            Priority Score = Severity Score + Urgency Score + Waiting-Time Bonus (Older complaints ranked first on ties)
          </div>
        </div>
        <span class="sc-status sc-status-info tabular-nums">${priorityQueue.length} Active in Queue</span>
      </div>
      <div class="sc-card-body py-3">
        ${
          priorityQueue.length === 0
            ? `<div class="text-center py-2 text-muted small">All complaints are currently resolved.</div>`
            : `<div class="row g-2">
                 ${priorityQueue
                   .slice(0, 4)
                   .map(
                     (pq, i) => `
                   <div class="col-12 col-md-6 col-xl-3">
                     <div class="p-3 rounded border h-100 d-flex flex-column justify-content-between bg-white">
                       <div>
                         <div class="d-flex align-items-center justify-content-between mb-2">
                           <span class="pq-rank ${i === 0 ? 'pq-rank-1' : i === 1 ? 'pq-rank-2' : 'pq-rank-default'}">#${i + 1}</span>
                           <span class="fw-bold tabular-nums text-danger">${pq.totalPriorityScore} pts</span>
                         </div>
                         <div class="fw-bold text-dark small mb-1">${escapeHtml(pq.category)} · Flat ${escapeHtml(pq.flatNumber)}</div>
                         <div class="text-muted small mb-2 text-truncate">${escapeHtml(pq.description)}</div>
                       </div>
                       <div class="pt-2 border-top d-flex align-items-center justify-content-between">
                         <span class="text-secondary" style="font-size: 0.72rem;">
                           Sev ${pq.severityScore} + Urg ${pq.urgencyScore} + Wait ${pq.waitingTimeBonus}
                         </span>
                         <button class="btn btn-sm btn-link p-0 text-decoration-none fw-semibold" onclick="openManageComplaintModal(${pq.id})">
                           Assign / Manage &rarr;
                         </button>
                       </div>
                     </div>
                   </div>
                 `
                   )
                   .join('')}
               </div>`
        }
      </div>
    </div>

    <!-- Main Complaints Table Card -->
    <div class="sc-card">
      <div class="sc-card-header">
        <div class="row g-2 w-100">
          <div class="col-md-4">
            <div class="input-group input-group-sm">
              <span class="input-group-text bg-light"><i class="bi bi-search"></i></span>
              <input type="text" id="cmpSearchInput" class="form-control" placeholder="Search ID, resident, flat, description..." oninput="filterComplaintsTable()" />
            </div>
          </div>
          <div class="col-md-3">
            <select id="cmpCategoryFilter" class="form-select form-select-sm" onchange="filterComplaintsTable()">
              <option value="">All Categories</option>
              ${categories.map((c) => `<option value="${c}">${c}</option>`).join('')}
            </select>
          </div>
          <div class="col-md-2">
            <select id="cmpPriorityFilter" class="form-select form-select-sm" onchange="filterComplaintsTable()">
              <option value="">All Priorities</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
          <div class="col-md-3">
            <select id="cmpStatusFilter" class="form-select form-select-sm" onchange="filterComplaintsTable()">
              <option value="">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Assigned">Assigned</option>
              <option value="Accepted">Accepted</option>
              <option value="In Progress">In Progress</option>
              <option value="Resolved">Resolved</option>
            </select>
          </div>
        </div>
      </div>
      <div class="table-responsive" id="complaintsTableContainer"></div>
    </div>
  `;

  filterComplaintsTable();
}

// RESIDENT: MY COMPLAINTS VIEW
async function renderResidentComplaintsPage() {
  const main = document.getElementById('scMainContent');
  const complaints = await apiRequest('/api/complaints');
  AppState.cache.complaints = complaints;

  main.innerHTML = `
    <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
      <div>
        <h3 class="fw-bold mb-1" style="color: var(--sc-navy);">My Complaints</h3>
        <div class="text-secondary small">
          Submit maintenance complaints for your flat and track assigned worker progress and resolution notes
        </div>
      </div>
      <button class="btn btn-sc-primary" onclick="openRegisterComplaintModal()">
        <i class="bi bi-plus-lg me-1"></i>Register New Complaint
      </button>
    </div>

    <div class="sc-card">
      <div class="sc-card-header">
        <h6 class="fw-bold mb-0">Complaints Submitted by My Household (${complaints.length})</h6>
      </div>
      <div class="table-responsive">
        ${
          complaints.length === 0
            ? `<div class="sc-empty-state">
                 <div class="sc-empty-icon"><i class="bi bi-clipboard-check"></i></div>
                 <h6 class="fw-bold text-dark mb-1">No Complaints Submitted Yet</h6>
                 <p class="small mb-3">If you are experiencing any maintenance issue in your flat or block, submit a complaint below.</p>
                 <button class="btn btn-sc-primary btn-sm" onclick="openRegisterComplaintModal()">Submit First Complaint</button>
               </div>`
            : `<table class="table sc-table">
                 <thead>
                   <tr>
                     <th>Complaint ID</th>
                     <th>Category</th>
                     <th>Description</th>
                     <th>Priority</th>
                     <th>Assigned Worker & Work Status</th>
                     <th>Date</th>
                     <th>Status</th>
                     <th>Resolution Notes</th>
                     <th class="text-end">Details</th>
                   </tr>
                 </thead>
                 <tbody>
                   ${complaints
                     .map(
                       (c) => `
                     <tr>
                       <td class="tabular-nums fw-semibold">${escapeHtml(c.complaintCode)}</td>
                       <td class="fw-semibold text-dark">${escapeHtml(c.category)}</td>
                       <td style="max-width: 240px;">
                         <div class="text-truncate" title="${escapeHtml(c.description)}">${escapeHtml(c.description)}</div>
                       </td>
                       <td>${renderStatusBadge(c.priority)}</td>
                       <td>
                         <div class="fw-medium small">${escapeHtml(c.assignedWorkerName || 'Awaiting Admin Assignment')}</div>
                         ${
                           c.assignedWorkerName
                             ? `<div class="text-muted" style="font-size: 0.72rem;">Worker Status: ${escapeHtml(c.workerAcceptanceStatus || c.status)}</div>`
                             : ''
                         }
                       </td>
                       <td class="tabular-nums small">${escapeHtml(c.complaintDate)}</td>
                       <td>${renderStatusBadge(c.status)}</td>
                       <td style="max-width: 220px;">
                         <div class="small text-secondary text-truncate" title="${escapeHtml(c.resolutionNotes || '')}">
                           ${escapeHtml(c.resolutionNotes || '—')}
                         </div>
                       </td>
                       <td class="text-end">
                         <button class="btn btn-sm btn-light border" onclick="openManageComplaintModal(${c.id})">
                           View
                         </button>
                       </td>
                     </tr>
                   `
                     )
                     .join('')}
                 </tbody>
               </table>`
        }
      </div>
    </div>
  `;
}

window.filterComplaintsTable = function () {
  const query = (document.getElementById('cmpSearchInput')?.value || '').trim().toLowerCase();
  const catFilter = document.getElementById('cmpCategoryFilter')?.value || '';
  const prioFilter = document.getElementById('cmpPriorityFilter')?.value || '';
  const statusFilter = document.getElementById('cmpStatusFilter')?.value || '';

  const filtered = AppState.cache.complaints.filter((c) => {
    const matchesQuery =
      !query ||
      String(c.complaintCode).toLowerCase().includes(query) ||
      String(c.residentName).toLowerCase().includes(query) ||
      String(c.flatNumber).toLowerCase().includes(query) ||
      String(c.description).toLowerCase().includes(query);
    const matchesCat = !catFilter || c.category === catFilter;
    const matchesPrio = !prioFilter || c.priority === prioFilter;
    const matchesStatus = !statusFilter || c.status === statusFilter;
    return matchesQuery && matchesCat && matchesPrio && matchesStatus;
  });

  const container = document.getElementById('complaintsTableContainer');
  if (!container) return;

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="sc-empty-state">
        <div class="sc-empty-icon"><i class="bi bi-clipboard-check"></i></div>
        <h6 class="fw-bold text-dark mb-1">No Matching Complaints</h6>
        <p class="small mb-3">No complaints match the current filter criteria.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <table class="table sc-table">
      <thead>
        <tr>
          <th>Complaint ID</th>
          <th>Resident & Flat</th>
          <th>Category</th>
          <th>Description</th>
          <th>Priority (Score)</th>
          <th>Assigned Worker</th>
          <th>Date</th>
          <th>Status</th>
          <th class="text-end">Actions</th>
        </tr>
      </thead>
      <tbody>
        ${filtered
          .map(
            (c) => `
          <tr>
            <td class="tabular-nums fw-semibold">${escapeHtml(c.complaintCode)}</td>
            <td>
              <div class="fw-semibold text-dark">${escapeHtml(c.residentName)}</div>
              <div class="text-muted small tabular-nums">Flat ${escapeHtml(c.flatNumber)}</div>
            </td>
            <td class="fw-medium">${escapeHtml(c.category)}</td>
            <td style="max-width: 240px;">
              <div class="text-truncate" title="${escapeHtml(c.description)}">${escapeHtml(c.description)}</div>
              ${
                c.declineReason
                  ? `<div class="text-danger small"><i class="bi bi-exclamation-circle me-1"></i>Declined: ${escapeHtml(c.declineReason)}</div>`
                  : ''
              }
            </td>
            <td>
              ${renderStatusBadge(c.priority)}
              <span class="text-muted small tabular-nums ms-1">(${c.totalPriorityScore} pts)</span>
            </td>
            <td>
              <div>${escapeHtml(c.assignedWorkerName || 'Unassigned')}</div>
              ${
                c.assignedWorkerName
                  ? `<div class="text-muted" style="font-size: 0.72rem;">${escapeHtml(c.workerAcceptanceStatus || '')}</div>`
                  : ''
              }
            </td>
            <td class="tabular-nums small">${escapeHtml(c.complaintDate)}</td>
            <td>${renderStatusBadge(c.status)}</td>
            <td class="text-end">
              <button class="btn btn-sm btn-light border" onclick="openManageComplaintModal(${c.id})">
                <i class="bi bi-sliders me-1"></i>Assign / Manage
              </button>
            </td>
          </tr>
        `
          )
          .join('')}
      </tbody>
    </table>
  `;
};

window.openRegisterComplaintModal = async function () {
  const isResident = AppState.user.role === 'RESIDENT';
  if (!isResident && AppState.cache.residents.length === 0) {
    AppState.cache.residents = await apiRequest('/api/residents').catch(() => []);
  }
  const today = new Date().toISOString().slice(0, 10);
  const categories = [
    'Water Leakage',
    'Electricity',
    'Lift Maintenance',
    'Garbage Collection',
    'Plumbing',
    'Security',
    'Parking',
    'Garden Maintenance',
    'Other'
  ];

  openModal(
    isResident ? 'Submit Household Maintenance Complaint' : 'Register Community Complaint',
    `
    <form id="registerComplaintForm">
      <div class="row g-3">
        ${
          !isResident
            ? `
          <div class="col-md-6">
            <label class="form-label small fw-semibold">Resident & Flat *</label>
            <select class="form-select" id="cmpResidentId" required>
              ${AppState.cache.residents
                .map((r) => `<option value="${r.id}">${escapeHtml(r.fullName)} — Flat ${escapeHtml(r.flatNumber)}</option>`)
                .join('')}
            </select>
          </div>
          <div class="col-md-6">
            <label class="form-label small fw-semibold">Complaint Category *</label>
            <select class="form-select" id="cmpCategory" required>
              ${categories.map((c) => `<option value="${c}">${c}</option>`).join('')}
            </select>
          </div>
          <div class="col-md-6">
            <label class="form-label small fw-semibold">Initial Severity *</label>
            <select class="form-select" id="cmpSeverity" required>
              <option value="Critical">Critical (50 pts)</option>
              <option value="High">High (35 pts)</option>
              <option value="Moderate" selected>Moderate (20 pts)</option>
              <option value="Low">Low (10 pts)</option>
            </select>
          </div>
          <div class="col-md-6">
            <label class="form-label small fw-semibold">Complaint Date *</label>
            <input type="date" class="form-control tabular-nums" id="cmpDate" value="${today}" required />
          </div>
        `
            : `
          <div class="col-md-12">
            <label class="form-label small fw-semibold">Complaint Category *</label>
            <select class="form-select" id="cmpCategory" required>
              ${categories.map((c) => `<option value="${c}">${c}</option>`).join('')}
            </select>
          </div>
        `
        }
        <div class="col-12">
          <label class="form-label small fw-semibold">Issue Description *</label>
          <textarea class="form-control" id="cmpDescription" rows="3" placeholder="Provide clear location and issue details..." required></textarea>
        </div>
      </div>
      ${
        isResident
          ? `<div class="form-text mt-2">
               <i class="bi bi-info-circle me-1"></i>Your complaint will be submitted with <strong>Pending</strong> status. The system will calculate suggested priority and the administrator will assign a suitable maintenance worker.
             </div>`
          : ''
      }
      <div class="d-flex justify-content-end gap-2 mt-4 pt-3 border-top">
        <button type="button" class="btn btn-light border" data-bs-dismiss="modal">Cancel</button>
        <button type="submit" class="btn btn-sc-primary">Submit Complaint</button>
      </div>
    </form>
  `,
    'modal-md'
  );

  document.getElementById('registerComplaintForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await apiRequest('/api/complaints', {
        method: 'POST',
        body: JSON.stringify({
          residentId: isResident ? AppState.user.linkedResidentId : Number(document.getElementById('cmpResidentId').value),
          category: document.getElementById('cmpCategory').value,
          severity: document.getElementById('cmpSeverity')?.value,
          complaintDate: document.getElementById('cmpDate')?.value || today,
          description: document.getElementById('cmpDescription').value.trim()
        })
      });
      showToast('Complaint submitted with Pending status.', 'success');
      closeModal();
      refreshNotificationsBadge();
      loadActivePageContent();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  });
};

window.openManageComplaintModal = async function (complaintId) {
  const complaints = await apiRequest('/api/complaints');
  AppState.cache.complaints = complaints;
  const c = complaints.find((x) => x.id === complaintId);
  if (!c) return;

  const isAdmin = AppState.user.role === 'ADMIN';
  let workers = [];
  let rec = null;

  if (isAdmin) {
    const [wList, recData] = await Promise.all([
      apiRequest('/api/workers').catch(() => []),
      apiRequest(`/api/workers/recommend?category=${encodeURIComponent(c.category)}`).catch(() => ({ recommendation: null }))
    ]);
    workers = wList;
    rec = recData?.recommendation;
  }

  openModal(
    `Complaint ${c.complaintCode} — ${c.category} (Flat ${c.flatNumber})`,
    `
    <div class="row g-3 mb-3">
      <div class="col-md-8">
        <div class="p-3 bg-light rounded border h-100">
          <div class="d-flex align-items-center justify-content-between mb-2">
            <span class="fw-bold text-dark">${escapeHtml(c.residentName)} · Flat ${escapeHtml(c.flatNumber)}</span>
            ${renderStatusBadge(c.status)}
          </div>
          <p class="mb-2 text-dark">${escapeHtml(c.description)}</p>
          <div class="small text-muted">
            Logged on <span class="tabular-nums">${escapeHtml(c.complaintDate)}</span> · Priority: ${renderStatusBadge(c.priority)}
            · Assigned Worker: <strong>${escapeHtml(c.assignedWorkerName || 'Unassigned')}</strong>
            ${c.workerAcceptanceStatus && c.workerAcceptanceStatus !== 'Unassigned' ? `(${escapeHtml(c.workerAcceptanceStatus)})` : ''}
          </div>
          ${
            c.declineReason
              ? `<div class="alert alert-danger py-1 px-2 small mt-2 mb-0">
                   <strong>Previous Worker Declined:</strong> ${escapeHtml(c.declineReason)}
                 </div>`
              : ''
          }
          ${
            c.resolutionNotes
              ? `<div class="alert alert-success py-2 px-3 small mt-2 mb-0">
                   <strong>Resolution / Progress Notes:</strong> ${escapeHtml(c.resolutionNotes)}
                 </div>`
              : ''
          }
        </div>
      </div>
      <div class="col-md-4">
        <div class="p-3 rounded border h-100" style="background: #F8FAFC;">
          <div class="small fw-bold text-secondary mb-1">Priority Score Breakdown</div>
          <div class="fs-4 fw-bold tabular-nums text-primary">${c.totalPriorityScore} pts</div>
          <div class="small text-muted tabular-nums">
            Severity (${escapeHtml(c.severity)}): +${c.severityScore}<br/>
            Category Urgency: +${c.urgencyScore}<br/>
            Waiting (${c.hoursWaiting}h): +${c.waitingTimeBonus}
          </div>
        </div>
      </div>
    </div>

    ${
      isAdmin && rec && c.status !== 'Resolved'
        ? `<div class="alert alert-info py-2 px-3 d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
             <div class="small">
               <strong><i class="bi bi-magic me-1"></i>Recommended Worker:</strong>
               ${escapeHtml(rec.recommendationReason)}
             </div>
             <button type="button" class="btn btn-sm btn-primary" onclick="document.getElementById('updWorkerId').value='${rec.workerId}'">
               Select ${escapeHtml(rec.name)}
             </button>
           </div>`
        : ''
    }

    ${
      isAdmin
        ? `
      <form id="updateComplaintForm" class="border-top pt-3 mb-3">
        <div class="row g-3">
          <div class="col-md-4">
            <label class="form-label small fw-semibold">Review Priority Level</label>
            <select class="form-select form-select-sm" id="updPriority">
              <option value="High" ${c.priority === 'High' ? 'selected' : ''}>High</option>
              <option value="Medium" ${c.priority === 'Medium' ? 'selected' : ''}>Medium</option>
              <option value="Low" ${c.priority === 'Low' ? 'selected' : ''}>Low</option>
            </select>
          </div>
          <div class="col-md-4">
            <label class="form-label small fw-semibold">Assign / Reassign Worker</label>
            <select class="form-select form-select-sm" id="updWorkerId">
              <option value="">-- Unassigned --</option>
              ${workers
                .filter((w) => w.status === 'Active')
                .map(
                  (w) =>
                    `<option value="${w.id}" ${c.assignedWorkerId === w.id ? 'selected' : ''}>${escapeHtml(
                      w.name
                    )} (${escapeHtml(w.specialization)} · ${w.assignedTasks} active)</option>`
                )
                .join('')}
            </select>
          </div>
          <div class="col-md-4">
            <label class="form-label small fw-semibold">Complaint Status</label>
            <select class="form-select form-select-sm" id="updStatus">
              <option value="Pending" ${c.status === 'Pending' ? 'selected' : ''}>Pending</option>
              <option value="Assigned" ${c.status === 'Assigned' ? 'selected' : ''}>Assigned</option>
              <option value="Accepted" ${c.status === 'Accepted' ? 'selected' : ''}>Accepted</option>
              <option value="In Progress" ${c.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
              <option value="Resolved" ${c.status === 'Resolved' ? 'selected' : ''}>Resolved</option>
            </select>
          </div>
          <div class="col-12">
            <label class="form-label small fw-semibold">Administrator Notes</label>
            <textarea class="form-control form-control-sm" id="updNotes" rows="2" placeholder="Optional dispatch or resolution notes...">${escapeHtml(
              c.resolutionNotes || ''
            )}</textarea>
          </div>
        </div>
        <div class="d-flex justify-content-end gap-2 mt-3">
          <button type="submit" class="btn btn-sc-primary btn-sm">Save Assignment & Update</button>
        </div>
      </form>
    `
        : ''
    }

    <!-- Audit History Timeline -->
    <div class="border-top pt-3">
      <h6 class="fw-bold small text-uppercase text-secondary mb-2">Complaint Assignment & Status Audit History</h6>
      <div class="d-flex flex-column gap-2" style="max-height: 220px; overflow-y: auto;">
        ${(c.history || [])
          .map(
            (h) => `
          <div class="p-2 rounded bg-light border small d-flex justify-content-between align-items-start">
            <div>
              <span class="fw-semibold text-dark">${escapeHtml(h.oldStatus ? `${h.oldStatus} → ${h.newStatus}` : h.newStatus)}</span>
              <span class="text-muted ms-2">by ${escapeHtml(h.changedBy)}</span>
              <div class="text-secondary mt-1">${escapeHtml(h.notes || '')}</div>
            </div>
            <span class="text-muted tabular-nums" style="font-size: 0.74rem;">${escapeHtml(
              String(h.changedAt).replace('T', ' ').slice(0, 16)
            )}</span>
          </div>
        `
          )
          .join('')}
      </div>
    </div>
  `
  );

  const form = document.getElementById('updateComplaintForm');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await apiRequest(`/api/complaints/${c.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            priority: document.getElementById('updPriority')?.value,
            assignedWorkerId: document.getElementById('updWorkerId')?.value,
            status: document.getElementById('updStatus').value,
            resolutionNotes: document.getElementById('updNotes').value.trim()
          })
        });
        showToast(`Complaint ${c.complaintCode} updated.`, 'success');
        closeModal();
        refreshNotificationsBadge();
        loadActivePageContent();
      } catch (err) {
        showToast(err.message, 'danger');
      }
    });
  }
};

// ============================================================================
// WORKER MANAGEMENT (ADMIN)
// ============================================================================
async function renderWorkersPage() {
  const main = document.getElementById('scMainContent');
  const workers = await apiRequest('/api/workers');
  AppState.cache.workers = workers;

  const specializations = [
    'Plumber',
    'Electrician',
    'Lift Technician',
    'Cleaner',
    'Security Guard',
    'Gardener',
    'General Maintenance'
  ];

  main.innerHTML = `
    <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
      <div>
        <h3 class="fw-bold mb-1" style="color: var(--sc-navy);">Maintenance Worker Management</h3>
        <div class="text-secondary small">
          Manage maintenance staff, specializations, availability, and active task loads
        </div>
      </div>
      <button class="btn btn-sc-primary" onclick="openWorkerModal()">
        <i class="bi bi-person-plus-fill me-1"></i>Add Worker
      </button>
    </div>

    <div class="sc-card">
      <div class="sc-card-header">
        <div class="row g-2 w-100">
          <div class="col-md-5">
            <div class="input-group input-group-sm">
              <span class="input-group-text bg-light"><i class="bi bi-search"></i></span>
              <input type="text" id="workerSearchInput" class="form-control" placeholder="Search worker name, ID, or phone..." oninput="filterWorkersTable()" />
            </div>
          </div>
          <div class="col-md-4">
            <select id="workerSpecFilter" class="form-select form-select-sm" onchange="filterWorkersTable()">
              <option value="">All Specializations</option>
              ${specializations.map((s) => `<option value="${s}">${s}</option>`).join('')}
            </select>
          </div>
          <div class="col-md-3">
            <select id="workerAvailFilter" class="form-select form-select-sm" onchange="filterWorkersTable()">
              <option value="">All Availability</option>
              <option value="Available">Available</option>
              <option value="Busy">Busy</option>
              <option value="Off Duty">Off Duty</option>
            </select>
          </div>
        </div>
      </div>
      <div class="table-responsive" id="workersTableContainer"></div>
    </div>
  `;

  filterWorkersTable();
}

window.filterWorkersTable = function () {
  const query = (document.getElementById('workerSearchInput')?.value || '').trim().toLowerCase();
  const specFilter = document.getElementById('workerSpecFilter')?.value || '';
  const availFilter = document.getElementById('workerAvailFilter')?.value || '';

  const filtered = AppState.cache.workers.filter((w) => {
    const matchesQuery =
      !query ||
      String(w.name).toLowerCase().includes(query) ||
      String(w.workerCode).toLowerCase().includes(query) ||
      String(w.phone).toLowerCase().includes(query);
    const matchesSpec = !specFilter || w.specialization === specFilter;
    const matchesAvail = !availFilter || w.availability === availFilter;
    return matchesQuery && matchesSpec && matchesAvail;
  });

  const container = document.getElementById('workersTableContainer');
  if (!container) return;

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="sc-empty-state">
        <div class="sc-empty-icon"><i class="bi bi-tools"></i></div>
        <h6 class="fw-bold text-dark mb-1">No Workers Found</h6>
        <p class="small mb-3">Add maintenance staff members to assign them to community complaints.</p>
        <button class="btn btn-sc-primary btn-sm" onclick="openWorkerModal()">Add Worker</button>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <table class="table sc-table">
      <thead>
        <tr>
          <th>Worker ID</th>
          <th>Name</th>
          <th>Specialization</th>
          <th>Phone</th>
          <th>Availability</th>
          <th>Assigned Tasks</th>
          <th>Completed Tasks</th>
          <th>Status</th>
          <th class="text-end">Actions</th>
        </tr>
      </thead>
      <tbody>
        ${filtered
          .map(
            (w) => `
          <tr>
            <td class="tabular-nums fw-semibold">${escapeHtml(w.workerCode)}</td>
            <td class="fw-semibold text-dark">${escapeHtml(w.name)}</td>
            <td>${escapeHtml(w.specialization)}</td>
            <td class="tabular-nums">${escapeHtml(w.phone)}</td>
            <td>${renderStatusBadge(w.availability)}</td>
            <td class="tabular-nums fw-bold">${w.assignedTasks}</td>
            <td class="tabular-nums text-success fw-semibold">${w.completedTasks}</td>
            <td>${renderStatusBadge(w.status)}</td>
            <td class="text-end">
              <div class="btn-group btn-group-sm">
                <button class="btn btn-light border" onclick="openWorkerModal(${w.id})" title="Edit Worker">
                  <i class="bi bi-pencil"></i>
                </button>
                <button
                  class="btn btn-light border ${w.status === 'Active' ? 'text-warning' : 'text-success'}"
                  onclick="toggleWorkerStatus(${w.id})"
                  title="${w.status === 'Active' ? 'Deactivate' : 'Activate'}"
                >
                  <i class="bi ${w.status === 'Active' ? 'bi-slash-circle' : 'bi-check-circle'}"></i>
                </button>
              </div>
            </td>
          </tr>
        `
          )
          .join('')}
      </tbody>
    </table>
  `;
};

window.openWorkerModal = function (editId = null) {
  const existing = editId ? AppState.cache.workers.find((w) => w.id === editId) : null;
  const specializations = [
    'Plumber',
    'Electrician',
    'Lift Technician',
    'Cleaner',
    'Security Guard',
    'Gardener',
    'General Maintenance'
  ];

  openModal(
    existing ? `Edit Worker — ${existing.workerCode}` : 'Register Maintenance Worker & Login Account',
    `
    <form id="workerForm">
      <div class="row g-3">
        <div class="col-md-6">
          <label class="form-label small fw-semibold">Worker Full Name *</label>
          <input type="text" class="form-control" id="wrkName" value="${escapeHtml(existing?.name || '')}" required />
        </div>
        <div class="col-md-6">
          <label class="form-label small fw-semibold">Specialization *</label>
          <select class="form-select" id="wrkSpec" required>
            ${specializations
              .map((s) => `<option value="${s}" ${existing?.specialization === s ? 'selected' : ''}>${s}</option>`)
              .join('')}
          </select>
        </div>
        <div class="col-md-6">
          <label class="form-label small fw-semibold">Phone Number *</label>
          <input type="text" class="form-control tabular-nums" id="wrkPhone" value="${escapeHtml(existing?.phone || '')}" required />
        </div>
        <div class="col-md-6">
          <label class="form-label small fw-semibold">Availability</label>
          <select class="form-select" id="wrkAvail">
            <option value="Available" ${existing?.availability === 'Available' ? 'selected' : ''}>Available</option>
            <option value="Busy" ${existing?.availability === 'Busy' ? 'selected' : ''}>Busy</option>
            <option value="Off Duty" ${existing?.availability === 'Off Duty' ? 'selected' : ''}>Off Duty</option>
          </select>
        </div>
        <div class="col-md-6">
          <label class="form-label small fw-semibold">Worker Login Email (Optional)</label>
          <input type="email" class="form-control" id="wrkEmail" placeholder="worker@community.com" />
        </div>
        <div class="col-md-6">
          <label class="form-label small fw-semibold">${existing ? 'Reset Worker Password (Optional)' : 'Initial Login Password'}</label>
          <input type="password" class="form-control" id="wrkPassword" placeholder="${existing ? 'Leave blank to keep current' : 'Default: Worker@123'}" />
        </div>
      </div>
      <div class="d-flex justify-content-end gap-2 mt-4 pt-3 border-top">
        <button type="button" class="btn btn-light border" data-bs-dismiss="modal">Cancel</button>
        <button type="submit" class="btn btn-sc-primary">${existing ? 'Update Worker' : 'Add Worker'}</button>
      </div>
    </form>
  `,
    'modal-md'
  );

  document.getElementById('workerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      name: document.getElementById('wrkName').value.trim(),
      specialization: document.getElementById('wrkSpec').value,
      phone: document.getElementById('wrkPhone').value.trim(),
      availability: document.getElementById('wrkAvail').value,
      email: document.getElementById('wrkEmail')?.value.trim(),
      password: document.getElementById('wrkPassword')?.value
    };
    try {
      let res;
      if (existing) {
        res = await apiRequest(`/api/workers/${existing.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        showToast(`Worker ${payload.name} updated.`, 'success');
      } else {
        res = await apiRequest('/api/workers', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        showToast(`Worker ${payload.name} added.`, 'success');
      }
      if (res?.vaultToken) {
        localStorage.setItem('sc_account_vault', res.vaultToken);
      }
      closeModal();
      loadActivePageContent();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  });
};

window.toggleWorkerStatus = async function (id) {
  const w = AppState.cache.workers.find((x) => x.id === id);
  if (!w) return;
  const newStatus = w.status === 'Active' ? 'Inactive' : 'Active';
  try {
    await apiRequest(`/api/workers/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: newStatus })
    });
    showToast(`Worker ${w.name} marked as ${newStatus}.`, 'info');
    loadActivePageContent();
  } catch (err) {
    showToast(err.message, 'danger');
  }
};

// ============================================================================
// MAINTENANCE PAYMENTS (ADMIN VIEW & RESIDENT ONLINE PAYMENT VIEW)
// ============================================================================
async function renderAdminPaymentsPage() {
  const main = document.getElementById('scMainContent');
  const [payments, transactions, residents] = await Promise.all([
    apiRequest('/api/payments'),
    apiRequest('/api/payments/transactions').catch(() => []),
    apiRequest('/api/residents').catch(() => [])
  ]);
  AppState.cache.payments = payments;
  AppState.cache.transactions = transactions;
  AppState.cache.residents = residents;

  const totalCollected = payments
    .filter((p) => p.paymentStatus === 'Paid')
    .reduce((acc, p) => acc + Number(p.amount), 0);
  const pendingAmt = payments
    .filter((p) => p.paymentStatus === 'Pending')
    .reduce((acc, p) => acc + Number(p.amount), 0);
  const overdueAmt = payments
    .filter((p) => p.paymentStatus === 'Overdue')
    .reduce((acc, p) => acc + Number(p.amount), 0);
  const totalDue = pendingAmt + overdueAmt;

  const months = Array.from(new Set(payments.map((p) => p.billingMonth)));

  main.innerHTML = `
    <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
      <div>
        <h3 class="fw-bold mb-1" style="color: var(--sc-navy);">Maintenance Payment Management</h3>
        <div class="text-secondary small">Create bills, monitor collection summaries, review payment transactions, and generate receipts</div>
      </div>
      <button class="btn btn-sc-primary" onclick="openGenerateBillModal()">
        <i class="bi bi-file-earmark-plus me-1"></i>Generate Maintenance Bill
      </button>
    </div>

    <div class="row g-3 mb-4">
      <div class="col-sm-6 col-xl-3">
        <div class="sc-stat-card">
          <div>
            <div class="text-secondary small fw-semibold">Total Amount Due</div>
            <div class="stat-value tabular-nums">${formatCurrency(totalDue)}</div>
          </div>
          <div class="sc-stat-icon" style="background: #F1F5F9; color: #142D4E;"><i class="bi bi-wallet2"></i></div>
        </div>
      </div>
      <div class="col-sm-6 col-xl-3">
        <div class="sc-stat-card">
          <div>
            <div class="text-secondary small fw-semibold">Amount Collected</div>
            <div class="stat-value tabular-nums" style="color: #15803D;">${formatCurrency(totalCollected)}</div>
          </div>
          <div class="sc-stat-icon" style="background: #DCFCE7; color: #15803D;"><i class="bi bi-cash-stack"></i></div>
        </div>
      </div>
      <div class="col-sm-6 col-xl-3">
        <div class="sc-stat-card">
          <div>
            <div class="text-secondary small fw-semibold">Pending Payments</div>
            <div class="stat-value tabular-nums" style="color: #B45309;">${formatCurrency(pendingAmt)}</div>
          </div>
          <div class="sc-stat-icon" style="background: #FEF3C7; color: #B45309;"><i class="bi bi-hourglass"></i></div>
        </div>
      </div>
      <div class="col-sm-6 col-xl-3">
        <div class="sc-stat-card">
          <div>
            <div class="text-secondary small fw-semibold">Overdue Payments</div>
            <div class="stat-value tabular-nums" style="color: #B91C1C;">${formatCurrency(overdueAmt)}</div>
          </div>
          <div class="sc-stat-icon" style="background: #FEE2E2; color: #B91C1C;"><i class="bi bi-exclamation-circle"></i></div>
        </div>
      </div>
    </div>

    <div class="sc-card mb-4">
      <div class="sc-card-header">
        <div class="row g-2 w-100">
          <div class="col-md-4">
            <div class="input-group input-group-sm">
              <span class="input-group-text bg-light"><i class="bi bi-search"></i></span>
              <input type="text" id="paymentSearchInput" class="form-control" placeholder="Search resident, flat number, or bill ID..." oninput="filterPaymentsTable()" />
            </div>
          </div>
          <div class="col-md-3">
            <select id="paymentMonthFilter" class="form-select form-select-sm" onchange="filterPaymentsTable()">
              <option value="">All Billing Months</option>
              ${months.map((m) => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('')}
            </select>
          </div>
          <div class="col-md-2">
            <select id="paymentBlockFilter" class="form-select form-select-sm" onchange="filterPaymentsTable()">
              <option value="">All Blocks</option>
              <option value="A">Block A</option>
              <option value="B">Block B</option>
              <option value="C">Block C</option>
              <option value="D">Block D</option>
            </select>
          </div>
          <div class="col-md-3">
            <select id="paymentStatusFilter" class="form-select form-select-sm" onchange="filterPaymentsTable()">
              <option value="">All Payment Statuses</option>
              <option value="Paid">Paid</option>
              <option value="Pending">Pending</option>
              <option value="Overdue">Overdue</option>
            </select>
          </div>
        </div>
      </div>
      <div class="table-responsive" id="paymentsTableContainer"></div>
    </div>

    <!-- Payment Transaction Log (Includes Online Demo Payments & Failed/Cancelled Attempts) -->
    <div class="sc-card">
      <div class="sc-card-header">
        <h6 class="fw-bold mb-0">Payment Transaction & Verification Log (${transactions.length})</h6>
      </div>
      <div class="table-responsive">
        ${
          transactions.length === 0
            ? `<div class="p-4 text-center text-muted small">No payment transactions logged yet.</div>`
            : `<table class="table sc-table mb-0">
                 <thead>
                   <tr>
                     <th>Reference</th>
                     <th>Resident & Flat</th>
                     <th>Billing Month</th>
                     <th>Amount</th>
                     <th>Method & Mode</th>
                     <th>Date</th>
                     <th>Verification Status</th>
                   </tr>
                 </thead>
                 <tbody>
                   ${transactions
                     .map(
                       (t) => `
                     <tr>
                       <td class="tabular-nums fw-semibold">${escapeHtml(t.referenceNumber || '—')}</td>
                       <td>${escapeHtml(t.residentName || '')} (Flat ${escapeHtml(t.flatNumber || '')})</td>
                       <td>${escapeHtml(t.billingMonth || '')}</td>
                       <td class="tabular-nums fw-bold">${formatCurrency(t.amountPaid)}</td>
                       <td>
                         ${escapeHtml(t.paymentMethod)}
                         ${t.isDemoTransaction ? `<span class="sc-status sc-status-info ms-1">Demo Mode</span>` : ''}
                       </td>
                       <td class="tabular-nums small">${escapeHtml(t.paymentDate)}</td>
                       <td>${renderStatusBadge(t.transactionStatus || 'SUCCESS')}</td>
                     </tr>
                   `
                     )
                     .join('')}
                 </tbody>
               </table>`
        }
      </div>
    </div>
  `;

  filterPaymentsTable();
}

window.filterPaymentsTable = function () {
  const query = (document.getElementById('paymentSearchInput')?.value || '').trim().toLowerCase();
  const monthFilter = document.getElementById('paymentMonthFilter')?.value || '';
  const blockFilter = document.getElementById('paymentBlockFilter')?.value || '';
  const statusFilter = document.getElementById('paymentStatusFilter')?.value || '';

  const filtered = AppState.cache.payments.filter((p) => {
    const matchesQuery =
      !query ||
      String(p.residentName).toLowerCase().includes(query) ||
      String(p.flatNumber).toLowerCase().includes(query) ||
      String(p.paymentCode).toLowerCase().includes(query);
    const matchesMonth = !monthFilter || p.billingMonth === monthFilter;
    const matchesBlock = !blockFilter || String(p.block || p.flatNumber.charAt(0)).toUpperCase() === blockFilter;
    const matchesStatus = !statusFilter || p.paymentStatus === statusFilter;
    return matchesQuery && matchesMonth && matchesBlock && matchesStatus;
  });

  const container = document.getElementById('paymentsTableContainer');
  if (!container) return;

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="sc-empty-state">
        <div class="sc-empty-icon"><i class="bi bi-receipt"></i></div>
        <h6 class="fw-bold text-dark mb-1">No Maintenance Bills Found</h6>
        <p class="small mb-0">No maintenance payment records match your filter criteria.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <table class="table sc-table">
      <thead>
        <tr>
          <th>Bill ID</th>
          <th>Resident</th>
          <th>Flat</th>
          <th>Billing Month</th>
          <th>Base + Late Fee</th>
          <th>Total Payable</th>
          <th>Due Date</th>
          <th>Status</th>
          <th>Payment Ref</th>
          <th class="text-end">Actions</th>
        </tr>
      </thead>
      <tbody>
        ${filtered
          .map(
            (p) => `
          <tr>
            <td class="tabular-nums fw-semibold">${escapeHtml(p.paymentCode)}</td>
            <td class="fw-semibold text-dark">${escapeHtml(p.residentName)}</td>
            <td class="tabular-nums">Flat ${escapeHtml(p.flatNumber)}</td>
            <td>${escapeHtml(p.billingMonth)}</td>
            <td class="tabular-nums small text-secondary">
              ${formatCurrency(p.baseAmount || p.amount)} + ${formatCurrency(p.lateFee || 0)}
            </td>
            <td class="tabular-nums fw-bold">${formatCurrency(p.amount)}</td>
            <td class="tabular-nums small">${escapeHtml(p.dueDate)}</td>
            <td>${renderStatusBadge(p.paymentStatus)}</td>
            <td class="tabular-nums small">${escapeHtml(p.paymentReference || '—')}</td>
            <td class="text-end">
              ${
                p.paymentStatus === 'Paid'
                  ? `<button class="btn btn-sm btn-light border" onclick="openReceiptModal(${p.id})">
                       <i class="bi bi-printer me-1"></i>Receipt
                     </button>`
                  : `<button class="btn btn-sm btn-outline-primary" onclick="openRecordPaymentModal(${p.id})">
                       Record Offline Payment
                     </button>`
              }
            </td>
          </tr>
        `
          )
          .join('')}
      </tbody>
    </table>
  `;
};

// RESIDENT: MY MAINTENANCE PAYMENTS PAGE
async function renderResidentPaymentsPage() {
  const main = document.getElementById('scMainContent');
  const [payments, transactions] = await Promise.all([
    apiRequest('/api/payments'),
    apiRequest('/api/payments/transactions').catch(() => [])
  ]);
  AppState.cache.payments = payments;
  AppState.cache.transactions = transactions;

  const unpaid = payments.filter((p) => p.paymentStatus !== 'Paid');
  const paid = payments.filter((p) => p.paymentStatus === 'Paid');

  main.innerHTML = `
    <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
      <div>
        <h3 class="fw-bold mb-1" style="color: var(--sc-navy);">My Maintenance Payments</h3>
        <div class="text-secondary small">
          View monthly maintenance bills for your flat, complete online payments, and download receipts
        </div>
      </div>
    </div>

    ${
      unpaid.length > 0
        ? `<div class="alert alert-warning d-flex align-items-center justify-content-between gap-3 mb-4">
             <div>
               <strong><i class="bi bi-exclamation-triangle-fill me-2"></i>You have ${unpaid.length} unpaid maintenance bill(s)</strong>
               <div class="small">Please complete your payment before the due date to avoid late fees.</div>
             </div>
             <button class="btn btn-sm btn-sc-primary shrink-0" onclick="openResidentDemoPaymentModal(${unpaid[0].id})">
               Pay Now (${formatCurrency(unpaid[0].amount)})
             </button>
           </div>`
        : `<div class="alert alert-success d-flex align-items-center gap-2 mb-4">
             <i class="bi bi-check-circle-fill fs-5"></i>
             <div><strong>All maintenance bills are paid!</strong> You have zero outstanding dues.</div>
           </div>`
    }

    <!-- My Maintenance Bills Table -->
    <div class="sc-card mb-4">
      <div class="sc-card-header">
        <h6 class="fw-bold mb-0">My Maintenance Bills (${payments.length})</h6>
      </div>
      <div class="table-responsive">
        <table class="table sc-table">
          <thead>
            <tr>
              <th>Bill ID</th>
              <th>Billing Month</th>
              <th>Flat Number</th>
              <th>Base Amount</th>
              <th>Late Fee</th>
              <th>Total Payable</th>
              <th>Due Date</th>
              <th>Payment Status</th>
              <th>Payment Date</th>
              <th class="text-end">Action</th>
            </tr>
          </thead>
          <tbody>
            ${payments
              .map(
                (p) => `
              <tr>
                <td class="tabular-nums fw-semibold">${escapeHtml(p.paymentCode)}</td>
                <td class="fw-semibold text-dark">${escapeHtml(p.billingMonth)}</td>
                <td class="tabular-nums">Flat ${escapeHtml(p.flatNumber)}</td>
                <td class="tabular-nums">${formatCurrency(p.baseAmount || p.amount)}</td>
                <td class="tabular-nums">${formatCurrency(p.lateFee || 0)}</td>
                <td class="tabular-nums fw-bold">${formatCurrency(p.amount)}</td>
                <td class="tabular-nums small">${escapeHtml(p.dueDate)}</td>
                <td>${renderStatusBadge(p.paymentStatus)}</td>
                <td class="tabular-nums small">${escapeHtml(p.paymentDate || '—')}</td>
                <td class="text-end">
                  ${
                    p.paymentStatus === 'Paid'
                      ? `<button class="btn btn-sm btn-light border" onclick="openReceiptModal(${p.id})">
                           <i class="bi bi-receipt me-1"></i>View Receipt
                         </button>`
                      : `<button class="btn btn-sm btn-sc-primary" onclick="openResidentDemoPaymentModal(${p.id})">
                           <i class="bi bi-credit-card me-1"></i>Pay Now
                         </button>`
                  }
                </td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- My Payment Transaction History -->
    <div class="sc-card">
      <div class="sc-card-header">
        <h6 class="fw-bold mb-0">My Payment History (${paid.length} Completed)</h6>
      </div>
      <div class="table-responsive">
        ${
          transactions.length === 0
            ? `<div class="p-4 text-center text-muted small">No payment transactions recorded yet.</div>`
            : `<table class="table sc-table mb-0">
                 <thead>
                   <tr>
                     <th>Transaction Ref</th>
                     <th>Billing Month</th>
                     <th>Amount</th>
                     <th>Payment Method</th>
                     <th>Date</th>
                     <th>Result</th>
                   </tr>
                 </thead>
                 <tbody>
                   ${transactions
                     .map(
                       (t) => `
                     <tr>
                       <td class="tabular-nums fw-semibold">${escapeHtml(t.referenceNumber)}</td>
                       <td>${escapeHtml(t.billingMonth)}</td>
                       <td class="tabular-nums fw-bold">${formatCurrency(t.amountPaid)}</td>
                       <td>
                         ${escapeHtml(t.paymentMethod)}
                         ${t.isDemoTransaction ? `<span class="sc-status sc-status-info ms-1">Demo Payment Mode</span>` : ''}
                       </td>
                       <td class="tabular-nums small">${escapeHtml(t.paymentDate)}</td>
                       <td>${renderStatusBadge(t.transactionStatus)}</td>
                     </tr>
                   `
                     )
                     .join('')}
                 </tbody>
               </table>`
        }
      </div>
    </div>
  `;
}

// RESIDENT ONLINE DEMO PAYMENT MODAL (With Backend Verification)
window.openResidentDemoPaymentModal = function (billId) {
  const bill =
    AppState.cache.payments.find((b) => b.id === billId) ||
    (AppState.cache.residentDashboard?.unpaidBills || []).find((b) => b.id === billId);
  if (!bill) return;

  openModal(
    `Pay Maintenance Bill — ${bill.paymentCode}`,
    `
    <!-- Clearly Labelled Demo Payment Mode Banner -->
    <div class="alert alert-info d-flex align-items-start gap-2 mb-3">
      <i class="bi bi-info-circle-fill fs-5 mt-1"></i>
      <div class="small">
        <strong>DEMO PAYMENT MODE (Simulated Gateway for College Demonstration)</strong><br/>
        This payment checkout simulates an online payment verification flow for academic demonstration purposes. It does not transfer real money or collect real banking/card credentials. Demo payments are explicitly tagged in receipts and records.
      </div>
    </div>

    <div class="p-3 bg-light rounded border mb-3">
      <div class="row g-2 small">
        <div class="col-sm-6"><span class="text-muted">Resident:</span> <strong>${escapeHtml(bill.residentName)}</strong></div>
        <div class="col-sm-6"><span class="text-muted">Flat Number:</span> <strong class="tabular-nums">Flat ${escapeHtml(bill.flatNumber)}</strong></div>
        <div class="col-sm-6"><span class="text-muted">Billing Period:</span> <strong>${escapeHtml(bill.billingMonth)}</strong></div>
        <div class="col-sm-6"><span class="text-muted">Due Date:</span> <strong class="tabular-nums">${escapeHtml(bill.dueDate)}</strong></div>
        <div class="col-sm-6"><span class="text-muted">Base Maintenance:</span> <span class="tabular-nums">${formatCurrency(bill.baseAmount || bill.amount)}</span></div>
        <div class="col-sm-6"><span class="text-muted">Late Fee:</span> <span class="tabular-nums">${formatCurrency(bill.lateFee || 0)}</span></div>
      </div>
      <div class="border-top mt-2 pt-2 d-flex justify-content-between align-items-center">
        <span class="fw-bold text-dark">Total Payable Amount</span>
        <span class="fs-5 fw-bold text-primary tabular-nums">${formatCurrency(bill.amount)}</span>
      </div>
    </div>

    <form id="residentDemoPayForm">
      <div class="row g-3">
        <div class="col-md-6">
          <label class="form-label small fw-semibold">Select Payment Method *</label>
          <select class="form-select" id="resPayMethod" required>
            <option value="UPI">UPI (Simulated VPA)</option>
            <option value="NetBanking">NetBanking (Simulated Bank Portal)</option>
            <option value="Debit Card">Debit Card (Simulated Token)</option>
          </select>
        </div>
        <div class="col-md-6">
          <label class="form-label small fw-semibold">Gateway Verification Outcome (For Testing)</label>
          <select class="form-select" id="resPayOutcome">
            <option value="SUCCESS" selected>Simulate Verified Payment Success</option>
            <option value="FAILED">Simulate Payment Failure (Do Not Mark Paid)</option>
            <option value="CANCELLED">Simulate User Cancellation (Do Not Mark Paid)</option>
          </select>
        </div>
        <div class="col-12">
          <div class="form-check">
            <input class="form-check-input" type="checkbox" id="resPayConfirmCheck" required />
            <label class="form-check-label small fw-semibold" for="resPayConfirmCheck">
              I confirm the bill details and authorize this simulated demonstration payment of ${formatCurrency(bill.amount)}.
            </label>
          </div>
        </div>
      </div>

      <div class="d-flex justify-content-end gap-2 mt-4 pt-3 border-top">
        <button type="button" class="btn btn-light border" data-bs-dismiss="modal">Close</button>
        <button type="submit" class="btn btn-sc-primary" id="resPaySubmitBtn">
          <i class="bi bi-shield-lock me-1"></i>Proceed & Verify Demo Payment
        </button>
      </div>
    </form>
  `,
    'modal-md'
  );

  document.getElementById('residentDemoPayForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('resPaySubmitBtn');
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Verifying with Backend...`;

    try {
      const res = await apiRequest(`/api/payments/${bill.id}/resident-pay`, {
        method: 'POST',
        body: JSON.stringify({
          paymentMethod: document.getElementById('resPayMethod').value,
          simulateOutcome: document.getElementById('resPayOutcome').value,
          residentConfirmed: document.getElementById('resPayConfirmCheck').checked
        })
      });
      showToast(res.message, 'success');
      closeModal();
      await refreshNotificationsBadge();
      await loadActivePageContent();
      // Open the generated Demo Payment Receipt automatically
      if (res.record) {
        AppState.cache.payments = await apiRequest('/api/payments').catch(() => [res.record]);
        openReceiptModal(res.record.id);
      }
    } catch (err) {
      showToast(err.message, 'danger');
      closeModal();
      await refreshNotificationsBadge();
      await loadActivePageContent();
    }
  });
};

window.openGenerateBillModal = function () {
  const defaultDue = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
  openModal(
    'Generate Monthly Maintenance Bill',
    `
    <form id="generateBillForm">
      <div class="row g-3">
        <div class="col-md-6">
          <label class="form-label small fw-semibold">Select Resident & Flat *</label>
          <select class="form-select" id="billResidentId" required>
            ${AppState.cache.residents
              .map(
                (r) =>
                  `<option value="${r.id}">${escapeHtml(r.fullName)} — Flat ${escapeHtml(r.flatNumber)}</option>`
              )
              .join('')}
          </select>
        </div>
        <div class="col-md-6">
          <label class="form-label small fw-semibold">Billing Month & Year *</label>
          <input type="text" class="form-control" id="billMonth" value="November 2026" placeholder="e.g. November 2026" required />
        </div>
        <div class="col-md-4">
          <label class="form-label small fw-semibold">Base Amount (INR) *</label>
          <input type="number" step="0.01" min="100" class="form-control tabular-nums" id="billBaseAmount" value="3500.00" required />
        </div>
        <div class="col-md-4">
          <label class="form-label small fw-semibold">Late Fee (INR)</label>
          <input type="number" step="0.01" min="0" class="form-control tabular-nums" id="billLateFee" value="0.00" required />
        </div>
        <div class="col-md-4">
          <label class="form-label small fw-semibold">Due Date *</label>
          <input type="date" class="form-control tabular-nums" id="billDueDate" value="${defaultDue}" required />
        </div>
      </div>
      <div class="form-text mt-2">
        Duplicate bills for the same resident and billing period are automatically prevented.
      </div>
      <div class="d-flex justify-content-end gap-2 mt-4 pt-3 border-top">
        <button type="button" class="btn btn-light border" data-bs-dismiss="modal">Cancel</button>
        <button type="submit" class="btn btn-sc-primary">Generate Bill</button>
      </div>
    </form>
  `,
    'modal-md'
  );

  document.getElementById('generateBillForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await apiRequest('/api/payments/generate', {
        method: 'POST',
        body: JSON.stringify({
          residentId: Number(document.getElementById('billResidentId').value),
          billingMonth: document.getElementById('billMonth').value.trim(),
          baseAmount: Number(document.getElementById('billBaseAmount').value),
          lateFee: Number(document.getElementById('billLateFee').value),
          dueDate: document.getElementById('billDueDate').value
        })
      });
      showToast('Maintenance bill generated and resident notified.', 'success');
      closeModal();
      refreshNotificationsBadge();
      loadActivePageContent();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  });
};

window.openRecordPaymentModal = function (id) {
  const p = AppState.cache.payments.find((x) => x.id === id);
  if (!p) return;
  const today = new Date().toISOString().slice(0, 10);

  openModal(
    `Record Authorized Offline Payment — ${p.paymentCode}`,
    `
    <div class="p-3 bg-light rounded border mb-3">
      <div class="fw-bold">${escapeHtml(p.residentName)} (Flat ${escapeHtml(p.flatNumber)})</div>
      <div class="small text-secondary">Billing Period: ${escapeHtml(p.billingMonth)} · Total Payable: <strong class="tabular-nums">${formatCurrency(p.amount)}</strong></div>
    </div>
    <form id="recordPayForm">
      <div class="row g-3">
        <div class="col-md-6">
          <label class="form-label small fw-semibold">Offline Payment Method *</label>
          <select class="form-select" id="payMethod" required>
            <option value="Bank Transfer / NEFT">Bank Transfer / NEFT</option>
            <option value="Cheque">Cheque</option>
            <option value="UPI">UPI (Verified Voucher)</option>
            <option value="Cash">Cash Receipt Voucher</option>
          </select>
        </div>
        <div class="col-md-6">
          <label class="form-label small fw-semibold">Payment Date *</label>
          <input type="date" class="form-control tabular-nums" id="payDate" value="${today}" required />
        </div>
        <div class="col-12">
          <label class="form-label small fw-semibold">Official Transaction / Cheque / Voucher Reference Number *</label>
          <input type="text" class="form-control tabular-nums" id="payRef" placeholder="e.g. NEFT-HDFC-8841209" required />
        </div>
        <div class="col-12">
          <div class="form-check">
            <input class="form-check-input" type="checkbox" id="adminAuthConfirm" required />
            <label class="form-check-label small fw-semibold" for="adminAuthConfirm">
              I verify that this offline payment instrument has been received and authorized for community accounts.
            </label>
          </div>
        </div>
      </div>
      <div class="d-flex justify-content-end gap-2 mt-4 pt-3 border-top">
        <button type="button" class="btn btn-light border" data-bs-dismiss="modal">Cancel</button>
        <button type="submit" class="btn btn-success">Record Verified Offline Payment</button>
      </div>
    </form>
  `,
    'modal-md'
  );

  document.getElementById('recordPayForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await apiRequest(`/api/payments/${p.id}/pay`, {
        method: 'PUT',
        body: JSON.stringify({
          paymentMethod: document.getElementById('payMethod').value,
          paymentDate: document.getElementById('payDate').value,
          referenceNumber: document.getElementById('payRef').value.trim(),
          adminAuthorizationConfirmed: document.getElementById('adminAuthConfirm').checked
        })
      });
      showToast(`Offline payment recorded for Flat ${p.flatNumber}.`, 'success');
      closeModal();
      refreshNotificationsBadge();
      loadActivePageContent();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  });
};

window.openReceiptModal = function (id) {
  const p =
    AppState.cache.payments.find((x) => x.id === id) ||
    (AppState.cache.residentDashboard?.recentPayments || []).find((x) => x.id === id);
  if (!p) return;

  openModal(
    `Maintenance Payment Receipt — ${p.receiptNumber || p.paymentCode}`,
    `
    <div id="printableReceiptArea" class="p-3 border rounded bg-white">
      ${
        p.isDemoPayment
          ? `<div class="alert alert-info py-1 px-2 small mb-3 text-center fw-semibold">
               DEMO PAYMENT RECEIPT — Simulated Transaction (No Real Money Transferred)
             </div>`
          : ''
      }
      <div class="d-flex justify-content-between align-items-start border-bottom pb-3 mb-3">
        <div>
          <h5 class="fw-bold mb-0" style="color: var(--sc-navy);">${escapeHtml(AppState.communityName)}</h5>
          <div class="small text-muted">Maintenance Payment Receipt</div>
        </div>
        <div class="text-end">
          <div class="fw-bold tabular-nums">${escapeHtml(p.receiptNumber || p.paymentCode)}</div>
          <div class="small text-muted tabular-nums">Date: ${escapeHtml(p.paymentDate)}</div>
        </div>
      </div>
      <div class="row g-2 mb-3 small">
        <div class="col-6"><span class="text-muted">Resident Name:</span> <strong>${escapeHtml(p.residentName)}</strong></div>
        <div class="col-6"><span class="text-muted">Flat Number:</span> <strong class="tabular-nums">${escapeHtml(p.flatNumber)}</strong></div>
        <div class="col-6"><span class="text-muted">Billing Period:</span> <strong>${escapeHtml(p.billingMonth)}</strong></div>
        <div class="col-6"><span class="text-muted">Payment Method:</span> <strong>${escapeHtml(p.paymentMethod || 'UPI')}</strong></div>
        <div class="col-6"><span class="text-muted">Base Maintenance:</span> <span class="tabular-nums">${formatCurrency(p.baseAmount || p.amount)}</span></div>
        <div class="col-6"><span class="text-muted">Late Fee:</span> <span class="tabular-nums">${formatCurrency(p.lateFee || 0)}</span></div>
        <div class="col-12"><span class="text-muted">Transaction Ref:</span> <strong class="tabular-nums">${escapeHtml(p.paymentReference || p.receiptNumber || '—')}</strong></div>
      </div>
      <div class="p-3 bg-light rounded d-flex justify-content-between align-items-center">
        <span class="fw-semibold">Total Amount Paid</span>
        <span class="fs-5 fw-bold text-success tabular-nums">${formatCurrency(p.amount)}</span>
      </div>
    </div>
    <div class="d-flex justify-content-end gap-2 mt-3">
      <button class="btn btn-light border btn-sm" data-bs-dismiss="modal">Close</button>
      <button class="btn btn-sc-primary btn-sm" onclick="window.print()">
        <i class="bi bi-printer me-1"></i>Print Receipt
      </button>
    </div>
  `,
    'modal-md'
  );
};

// ============================================================================
// FACILITY BOOKING (ADMIN & RESIDENT)
// ============================================================================
async function renderBookingsPage() {
  const main = document.getElementById('scMainContent');
  const [data, residents] = await Promise.all([
    apiRequest('/api/bookings'),
    apiRequest('/api/residents').catch(() => [])
  ]);
  AppState.cache.facilities = data.facilities || [];
  AppState.cache.bookings = data.bookings || [];
  AppState.cache.residents = residents;

  const isResident = AppState.user.role === 'RESIDENT';

  main.innerHTML = `
    <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
      <div>
        <h3 class="fw-bold mb-1" style="color: var(--sc-navy);">${isResident ? 'Book Community Facility' : 'Facility Booking Management'}</h3>
        <div class="text-secondary small">Reserve common amenities with automatic time-slot overlap conflict detection</div>
      </div>
      <button class="btn btn-sc-primary" onclick="openCreateBookingModal()">
        <i class="bi bi-calendar-plus me-1"></i>Create Facility Booking
      </button>
    </div>

    <!-- 4 Facility Cards -->
    <div class="row g-3 mb-4">
      ${AppState.cache.facilities
        .map(
          (f) => `
        <div class="col-md-6 col-xl-3">
          <div class="sc-card h-100 p-3 d-flex flex-column justify-content-between">
            <div>
              <div class="d-flex align-items-center justify-content-between mb-2">
                <h6 class="fw-bold mb-0 text-dark">${escapeHtml(f.name)}</h6>
                ${renderStatusBadge(f.availability)}
              </div>
              <p class="text-secondary small mb-2">${escapeHtml(f.description)}</p>
            </div>
            <div class="pt-2 border-top d-flex align-items-center justify-content-between small text-muted">
              <span class="tabular-nums"><i class="bi bi-people me-1"></i>Cap: ${f.capacity}</span>
              <button class="btn btn-sm btn-link p-0 text-decoration-none fw-semibold" onclick="openCreateBookingModal(${f.id})">
                Book Slot &rarr;
              </button>
            </div>
          </div>
        </div>
      `
        )
        .join('')}
    </div>

    <div class="sc-card">
      <div class="sc-card-header">
        <div class="row g-2 w-100 align-items-center">
          <div class="col-md-6">
            <input type="text" id="bookingSearchInput" class="form-control form-control-sm" placeholder="Search by facility, resident, or flat..." oninput="filterBookingsTable()" />
          </div>
          <div class="col-md-4">
            <select id="bookingFacilityFilter" class="form-select form-select-sm" onchange="filterBookingsTable()">
              <option value="">All Facilities</option>
              ${AppState.cache.facilities.map((f) => `<option value="${escapeHtml(f.name)}">${escapeHtml(f.name)}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>
      <div class="table-responsive" id="bookingsTableContainer"></div>
    </div>
  `;

  filterBookingsTable();
}

window.filterBookingsTable = function () {
  const query = (document.getElementById('bookingSearchInput')?.value || '').trim().toLowerCase();
  const facFilter = document.getElementById('bookingFacilityFilter')?.value || '';

  const filtered = AppState.cache.bookings.filter((b) => {
    const matchesQuery =
      !query ||
      String(b.facilityName).toLowerCase().includes(query) ||
      String(b.residentName).toLowerCase().includes(query) ||
      String(b.flatNumber).toLowerCase().includes(query);
    const matchesFac = !facFilter || b.facilityName === facFilter;
    return matchesQuery && matchesFac;
  });

  const container = document.getElementById('bookingsTableContainer');
  if (!container) return;

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="sc-empty-state">
        <div class="sc-empty-icon"><i class="bi bi-calendar2-week"></i></div>
        <h6 class="fw-bold text-dark mb-1">No Facility Bookings Found</h6>
        <p class="small mb-3">Select a community facility above to reserve a date and time slot.</p>
        <button class="btn btn-sc-primary btn-sm" onclick="openCreateBookingModal()">Book Facility</button>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <table class="table sc-table">
      <thead>
        <tr>
          <th>Booking ID</th>
          <th>Facility</th>
          <th>Resident & Flat</th>
          <th>Booking Date</th>
          <th>Time Slot</th>
          <th>Purpose</th>
          <th>Status</th>
          <th class="text-end">Action</th>
        </tr>
      </thead>
      <tbody>
        ${filtered
          .map(
            (b) => `
          <tr>
            <td class="tabular-nums fw-semibold">${escapeHtml(b.bookingCode)}</td>
            <td class="fw-semibold text-dark">${escapeHtml(b.facilityName)}</td>
            <td>${escapeHtml(b.residentName)} (Flat ${escapeHtml(b.flatNumber)})</td>
            <td class="tabular-nums">${escapeHtml(b.bookingDate)}</td>
            <td class="tabular-nums small">${escapeHtml(b.timeSlot)}</td>
            <td>${escapeHtml(b.purpose || '—')}</td>
            <td>${renderStatusBadge(b.bookingStatus)}</td>
            <td class="text-end">
              ${
                b.bookingStatus !== 'Cancelled'
                  ? `<button class="btn btn-sm btn-outline-danger" onclick="cancelBooking(${b.id})">Cancel</button>`
                  : `<span class="text-muted small">—</span>`
              }
            </td>
          </tr>
        `
          )
          .join('')}
      </tbody>
    </table>
  `;
};

window.openCreateBookingModal = function (preselectFacilityId = null) {
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const isResident = AppState.user.role === 'RESIDENT';
  const slots = [
    '06:00 AM - 08:00 AM',
    '07:00 AM - 09:00 AM',
    '10:00 AM - 01:00 PM',
    '03:00 PM - 06:00 PM',
    '06:00 PM - 10:00 PM',
    'Full Day (12:00 PM - 11:00 AM)'
  ];

  openModal(
    'Reserve Community Facility',
    `
    <form id="bookingForm">
      <div class="row g-3">
        <div class="col-md-6">
          <label class="form-label small fw-semibold">Facility *</label>
          <select class="form-select" id="bkgFacilityId" required>
            ${AppState.cache.facilities
              .map(
                (f) =>
                  `<option value="${f.id}" ${preselectFacilityId === f.id ? 'selected' : ''}>${escapeHtml(f.name)}</option>`
              )
              .join('')}
          </select>
        </div>
        ${
          !isResident
            ? `<div class="col-md-6">
                 <label class="form-label small fw-semibold">Resident *</label>
                 <select class="form-select" id="bkgResidentId" required>
                   ${AppState.cache.residents
                     .map((r) => `<option value="${r.id}">${escapeHtml(r.fullName)} — Flat ${escapeHtml(r.flatNumber)}</option>`)
                     .join('')}
                 </select>
               </div>`
            : ''
        }
        <div class="col-md-6">
          <label class="form-label small fw-semibold">Booking Date *</label>
          <input type="date" class="form-control tabular-nums" id="bkgDate" value="${tomorrow}" required />
        </div>
        <div class="col-md-6">
          <label class="form-label small fw-semibold">Time Slot *</label>
          <select class="form-select tabular-nums" id="bkgSlot" required>
            ${slots.map((s) => `<option value="${s}">${s}</option>`).join('')}
          </select>
        </div>
        <div class="col-12">
          <label class="form-label small fw-semibold">Event / Purpose *</label>
          <input type="text" class="form-control" id="bkgPurpose" placeholder="e.g. Family Get-Together / Evening Badminton" required />
        </div>
      </div>
      <div class="d-flex justify-content-end gap-2 mt-4 pt-3 border-top">
        <button type="button" class="btn btn-light border" data-bs-dismiss="modal">Cancel</button>
        <button type="submit" class="btn btn-sc-primary">Confirm Booking</button>
      </div>
    </form>
  `,
    'modal-md'
  );

  document.getElementById('bookingForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await apiRequest('/api/bookings', {
        method: 'POST',
        body: JSON.stringify({
          facilityId: Number(document.getElementById('bkgFacilityId').value),
          residentId: isResident ? AppState.user.linkedResidentId : Number(document.getElementById('bkgResidentId').value),
          bookingDate: document.getElementById('bkgDate').value,
          timeSlot: document.getElementById('bkgSlot').value,
          purpose: document.getElementById('bkgPurpose').value.trim()
        })
      });
      showToast('Facility booking confirmed!', 'success');
      closeModal();
      refreshNotificationsBadge();
      loadActivePageContent();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  });
};

window.cancelBooking = async function (id) {
  try {
    await apiRequest(`/api/bookings/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ bookingStatus: 'Cancelled' })
    });
    showToast('Booking cancelled.', 'info');
    refreshNotificationsBadge();
    loadActivePageContent();
  } catch (err) {
    showToast(err.message, 'danger');
  }
};

// ============================================================================
// ANNOUNCEMENTS & COMMUNITY EVENTS
// ============================================================================
async function renderAnnouncementsPage() {
  const main = document.getElementById('scMainContent');
  const announcements = await apiRequest('/api/announcements');
  AppState.cache.announcements = announcements;
  const isAdmin = AppState.user.role === 'ADMIN';

  main.innerHTML = `
    <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
      <div>
        <h3 class="fw-bold mb-1" style="color: var(--sc-navy);">Announcements & Community Events</h3>
        <div class="text-secondary small">Official circulars, maintenance alerts, and upcoming residential events</div>
      </div>
      ${
        isAdmin
          ? `<button class="btn btn-sc-primary" onclick="openAnnouncementModal()">
               <i class="bi bi-megaphone-fill me-1"></i>Create Announcement
             </button>`
          : ''
      }
    </div>

    ${
      announcements.length === 0
        ? `<div class="sc-card sc-empty-state">
             <div class="sc-empty-icon"><i class="bi bi-megaphone"></i></div>
             <h6 class="fw-bold text-dark mb-1">No Announcements Published</h6>
             <p class="small mb-3">Important community notices and event schedules will appear here.</p>
           </div>`
        : `<div class="row g-3">
             ${announcements
               .map(
                 (a) => `
               <div class="col-12 col-lg-6">
                 <div class="sc-card h-100 p-4 d-flex flex-column justify-content-between">
                   <div>
                     <div class="d-flex align-items-center justify-content-between gap-2 mb-2">
                       <span class="sc-status sc-status-info">${escapeHtml(a.category)}</span>
                       <div class="d-flex align-items-center gap-2">
                         ${
                           a.important
                             ? `<span class="sc-status sc-status-danger"><i class="bi bi-pin-angle-fill"></i>Important</span>`
                             : ''
                         }
                         <span class="small text-muted tabular-nums">Published: ${escapeHtml(a.publishDate)}</span>
                       </div>
                     </div>
                     <h5 class="fw-bold text-dark mb-2">${escapeHtml(a.title)}</h5>
                     <p class="text-secondary mb-3">${escapeHtml(a.description)}</p>
                   </div>
                   <div class="pt-3 border-top d-flex flex-wrap align-items-center justify-content-between gap-2 small text-muted">
                     <div>
                       <span>By ${escapeHtml(a.createdBy)}</span>
                       ${
                         a.eventDate
                           ? ` · <strong class="text-dark tabular-nums"><i class="bi bi-calendar-event me-1"></i>Event Date: ${escapeHtml(a.eventDate)}</strong>`
                           : ''
                       }
                     </div>
                     ${
                       isAdmin
                         ? `<div class="btn-group btn-group-sm">
                              <button class="btn btn-light border" onclick="openAnnouncementModal(${a.id})">Edit</button>
                              <button class="btn btn-light border text-danger" onclick="deleteAnnouncement(${a.id})">Delete</button>
                            </div>`
                         : ''
                     }
                   </div>
                 </div>
               </div>
             `
               )
               .join('')}
           </div>`
    }
  `;
}

window.openAnnouncementModal = function (editId = null) {
  const existing = editId ? AppState.cache.announcements.find((a) => a.id === editId) : null;
  const today = new Date().toISOString().slice(0, 10);
  const categories = [
    'General Notice',
    'Maintenance Alert',
    'Water Supply',
    'Electricity',
    'Security',
    'Community Event'
  ];

  openModal(
    existing ? 'Edit Announcement' : 'Publish Community Announcement',
    `
    <form id="announcementForm">
      <div class="row g-3">
        <div class="col-md-8">
          <label class="form-label small fw-semibold">Announcement Title *</label>
          <input type="text" class="form-control" id="annTitle" value="${escapeHtml(existing?.title || '')}" required />
        </div>
        <div class="col-md-4">
          <label class="form-label small fw-semibold">Category *</label>
          <select class="form-select" id="annCategory" required>
            ${categories
              .map((c) => `<option value="${c}" ${existing?.category === c ? 'selected' : ''}>${c}</option>`)
              .join('')}
          </select>
        </div>
        <div class="col-md-6">
          <label class="form-label small fw-semibold">Publish Date *</label>
          <input type="date" class="form-control tabular-nums" id="annPubDate" value="${existing?.publishDate || today}" required />
        </div>
        <div class="col-md-6">
          <label class="form-label small fw-semibold">Event Date (Optional)</label>
          <input type="date" class="form-control tabular-nums" id="annEventDate" value="${existing?.eventDate || ''}" />
        </div>
        <div class="col-12">
          <label class="form-label small fw-semibold">Description *</label>
          <textarea class="form-control" id="annDesc" rows="3" required>${escapeHtml(existing?.description || '')}</textarea>
        </div>
        <div class="col-12">
          <div class="form-check">
            <input class="form-check-input" type="checkbox" id="annImportant" ${existing?.important ? 'checked' : ''} />
            <label class="form-check-label small fw-semibold" for="annImportant">
              Mark as Important Notice (Highlighted on Dashboard & Sent to Notifications)
            </label>
          </div>
        </div>
      </div>
      <div class="d-flex justify-content-end gap-2 mt-4 pt-3 border-top">
        <button type="button" class="btn btn-light border" data-bs-dismiss="modal">Cancel</button>
        <button type="submit" class="btn btn-sc-primary">${existing ? 'Update Notice' : 'Publish Notice'}</button>
      </div>
    </form>
  `,
    'modal-md'
  );

  document.getElementById('announcementForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      title: document.getElementById('annTitle').value.trim(),
      category: document.getElementById('annCategory').value,
      publishDate: document.getElementById('annPubDate').value,
      eventDate: document.getElementById('annEventDate').value || null,
      description: document.getElementById('annDesc').value.trim(),
      important: document.getElementById('annImportant').checked
    };
    try {
      if (existing) {
        await apiRequest(`/api/announcements/${existing.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        showToast('Announcement updated.', 'success');
      } else {
        await apiRequest('/api/announcements', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        showToast('Announcement published.', 'success');
      }
      closeModal();
      refreshNotificationsBadge();
      loadActivePageContent();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  });
};

window.deleteAnnouncement = async function (id) {
  try {
    await apiRequest(`/api/announcements/${id}`, { method: 'DELETE' });
    showToast('Announcement deleted.', 'info');
    loadActivePageContent();
  } catch (err) {
    showToast(err.message, 'danger');
  }
};

// ============================================================================
// REPORTS & ANALYTICS (ADMIN)
// ============================================================================
async function renderReportsPage() {
  const main = document.getElementById('scMainContent');
  const [complaints, payments, workers] = await Promise.all([
    apiRequest('/api/complaints'),
    apiRequest('/api/payments'),
    apiRequest('/api/workers')
  ]);

  AppState.cache.complaints = complaints;
  AppState.cache.payments = payments;
  AppState.cache.workers = workers;

  main.innerHTML = `
    <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
      <div>
        <h3 class="fw-bold mb-1" style="color: var(--sc-navy);">Reports & Analytics</h3>
        <div class="text-secondary small">Community complaints, maintenance collection, and worker performance analytics</div>
      </div>
      <div class="d-flex gap-2">
        <button class="btn btn-outline-secondary btn-sm bg-white" onclick="exportComplaintsCsv()">
          <i class="bi bi-download me-1"></i>Download Complaints CSV
        </button>
        <button class="btn btn-sc-primary btn-sm" onclick="exportPaymentsCsv()">
          <i class="bi bi-file-earmark-spreadsheet me-1"></i>Download Payments CSV
        </button>
      </div>
    </div>

    <div class="row g-4">
      <div class="col-md-6">
        <div class="sc-card h-100">
          <div class="sc-card-header"><h6 class="fw-bold mb-0">Complaints by Category</h6></div>
          <div class="sc-card-body"><div style="height: 260px;"><canvas id="repCategoryChart"></canvas></div></div>
        </div>
      </div>
      <div class="col-md-6">
        <div class="sc-card h-100">
          <div class="sc-card-header"><h6 class="fw-bold mb-0">Complaint Status Distribution</h6></div>
          <div class="sc-card-body"><div style="height: 260px;"><canvas id="repStatusChart"></canvas></div></div>
        </div>
      </div>
      <div class="col-md-6">
        <div class="sc-card h-100">
          <div class="sc-card-header"><h6 class="fw-bold mb-0">Maintenance Payment Collection (INR)</h6></div>
          <div class="sc-card-body"><div style="height: 260px;"><canvas id="repPaymentChart"></canvas></div></div>
        </div>
      </div>
      <div class="col-md-6">
        <div class="sc-card h-100">
          <div class="sc-card-header"><h6 class="fw-bold mb-0">Worker Task Completion</h6></div>
          <div class="sc-card-body"><div style="height: 260px;"><canvas id="repWorkerChart"></canvas></div></div>
        </div>
      </div>
    </div>
  `;

  if (window.Chart) {
    const catCounts = {};
    complaints.forEach((c) => {
      catCounts[c.category] = (catCounts[c.category] || 0) + 1;
    });
    AppState.charts.repCat = new Chart(document.getElementById('repCategoryChart'), {
      type: 'bar',
      data: {
        labels: Object.keys(catCounts),
        datasets: [{ label: 'Complaints', data: Object.values(catCounts), backgroundColor: '#142D4E', borderRadius: 5 }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });

    const statusMap = { Pending: 0, Assigned: 0, Accepted: 0, 'In Progress': 0, Resolved: 0 };
    complaints.forEach((c) => {
      statusMap[c.status] = (statusMap[c.status] || 0) + 1;
    });
    AppState.charts.repStatus = new Chart(document.getElementById('repStatusChart'), {
      type: 'doughnut',
      data: {
        labels: Object.keys(statusMap),
        datasets: [
          {
            data: Object.values(statusMap),
            backgroundColor: ['#D97706', '#2563EB', '#6366F1', '#0284C7', '#15803D']
          }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });

    const paySums = { Paid: 0, Pending: 0, Overdue: 0 };
    payments.forEach((p) => {
      paySums[p.paymentStatus] = (paySums[p.paymentStatus] || 0) + Number(p.amount);
    });
    AppState.charts.repPay = new Chart(document.getElementById('repPaymentChart'), {
      type: 'bar',
      data: {
        labels: ['Collected (Paid)', 'Pending', 'Overdue'],
        datasets: [
          {
            label: 'Amount (INR)',
            data: [paySums.Paid, paySums.Pending, paySums.Overdue],
            backgroundColor: ['#15803D', '#D97706', '#B91C1C'],
            borderRadius: 6
          }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });

    AppState.charts.repWorker = new Chart(document.getElementById('repWorkerChart'), {
      type: 'bar',
      data: {
        labels: workers.map((w) => w.name),
        datasets: [
          { label: 'Completed Tasks', data: workers.map((w) => w.completedTasks), backgroundColor: '#15803D' },
          { label: 'Active Assigned', data: workers.map((w) => w.assignedTasks), backgroundColor: '#2563EB' }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }
}

function downloadCsvFile(filename, rows) {
  const csvContent = rows
    .map((r) => r.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

window.exportComplaintsCsv = function () {
  const rows = [
    ['Complaint ID', 'Resident', 'Flat', 'Category', 'Severity', 'Priority', 'Priority Score', 'Worker', 'Date', 'Status'],
    ...AppState.cache.complaints.map((c) => [
      c.complaintCode,
      c.residentName,
      c.flatNumber,
      c.category,
      c.severity,
      c.priority,
      c.totalPriorityScore,
      c.assignedWorkerName || 'Unassigned',
      c.complaintDate,
      c.status
    ])
  ];
  downloadCsvFile('smart_community_complaints_report.csv', rows);
  showToast('Complaints CSV exported.', 'success');
};

window.exportPaymentsCsv = function () {
  const rows = [
    ['Bill ID', 'Resident', 'Flat', 'Billing Month', 'Base Amount', 'Late Fee', 'Total Payable', 'Due Date', 'Payment Date', 'Method', 'Status'],
    ...AppState.cache.payments.map((p) => [
      p.paymentCode,
      p.residentName,
      p.flatNumber,
      p.billingMonth,
      p.baseAmount || p.amount,
      p.lateFee || 0,
      p.amount,
      p.dueDate,
      p.paymentDate || '',
      p.paymentMethod || '',
      p.paymentStatus
    ])
  ];
  downloadCsvFile('smart_community_payments_report.csv', rows);
  showToast('Payments CSV exported.', 'success');
};

// ============================================================================
// SETTINGS (ADMIN) & MY PROFILE (RESIDENT / WORKER)
// ============================================================================
async function renderSettingsOrProfilePage() {
  const main = document.getElementById('scMainContent');
  const settingsData = await apiRequest('/api/settings');
  AppState.cache.settings = settingsData;

  const cs = settingsData.communitySettings;
  const profile = settingsData.profile;
  const residentProfile = settingsData.residentProfile;
  const workerProfile = settingsData.workerProfile;
  const isAdmin = AppState.user.role === 'ADMIN';

  main.innerHTML = `
    <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
      <div>
        <h3 class="fw-bold mb-1" style="color: var(--sc-navy);">${isAdmin ? 'Community & Account Settings' : 'My Profile & Account Security'}</h3>
        <div class="text-secondary small">
          ${isAdmin ? 'Manage community details, profile settings, and account password' : 'Update your permitted personal contact details and change your account password'}
        </div>
      </div>
      <button class="btn btn-outline-danger btn-sm" onclick="handleLogout(true)">
        <i class="bi bi-box-arrow-right me-1"></i>Logout (${escapeHtml(AppState.user.username)})
      </button>
    </div>

    <div class="row g-4">
      <!-- Left Column: Personal Profile or Community Information -->
      <div class="col-12 col-xl-7">
        ${
          isAdmin
            ? `
          <div class="sc-card mb-4">
            <div class="sc-card-header">
              <h6 class="fw-bold mb-0">Community Information & Contact Details</h6>
            </div>
            <div class="sc-card-body">
              <form id="communitySettingsForm">
                <div class="row g-3">
                  <div class="col-md-6">
                    <label class="form-label small fw-semibold">Community Name</label>
                    <input type="text" class="form-control" id="setCommName" value="${escapeHtml(cs.communityName)}" required />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label small fw-semibold">Default Monthly Maintenance (INR)</label>
                    <input type="number" step="0.01" class="form-control tabular-nums" id="setMaintDefault" value="${cs.monthlyMaintenanceDefault}" required />
                  </div>
                  <div class="col-12">
                    <label class="form-label small fw-semibold">Community Address</label>
                    <input type="text" class="form-control" id="setCommAddr" value="${escapeHtml(cs.communityAddress)}" required />
                  </div>
                  <div class="col-md-4">
                    <label class="form-label small fw-semibold">Office Email</label>
                    <input type="email" class="form-control" id="setCommEmail" value="${escapeHtml(cs.contactEmail)}" required />
                  </div>
                  <div class="col-md-4">
                    <label class="form-label small fw-semibold">Office Phone</label>
                    <input type="text" class="form-control tabular-nums" id="setCommPhone" value="${escapeHtml(cs.contactPhone)}" required />
                  </div>
                  <div class="col-md-4">
                    <label class="form-label small fw-semibold">24x7 Security Desk</label>
                    <input type="text" class="form-control tabular-nums" id="setEmergPhone" value="${escapeHtml(cs.emergencyPhone)}" required />
                  </div>
                </div>
                <div class="mt-3 text-end">
                  <button type="submit" class="btn btn-sc-primary btn-sm">Save Community Settings</button>
                </div>
              </form>
            </div>
          </div>
        `
            : ''
        }

        <div class="sc-card">
          <div class="sc-card-header">
            <h6 class="fw-bold mb-0">My Personal Profile Details</h6>
            <span class="sc-status sc-status-neutral">Role: ${escapeHtml(profile.role)} (Fixed)</span>
          </div>
          <div class="sc-card-body">
            <form id="personalProfileForm">
              <div class="row g-3">
                <div class="col-md-6">
                  <label class="form-label small fw-semibold">Full Name *</label>
                  <input type="text" class="form-control" id="profFullName" value="${escapeHtml(profile.fullName)}" required />
                </div>
                <div class="col-md-6">
                  <label class="form-label small fw-semibold">Email Address *</label>
                  <input type="email" class="form-control" id="profEmail" value="${escapeHtml(profile.email)}" required />
                </div>
                ${
                  residentProfile
                    ? `
                  <div class="col-md-6">
                    <label class="form-label small fw-semibold">Phone Number *</label>
                    <input type="text" class="form-control tabular-nums" id="profPhone" value="${escapeHtml(residentProfile.phone)}" required />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label small fw-semibold">Assigned Flat (Admin Managed)</label>
                    <input type="text" class="form-control tabular-nums" value="Block ${escapeHtml(residentProfile.block)} · Flat ${escapeHtml(residentProfile.flatNumber)}" disabled />
                  </div>
                `
                    : ''
                }
                ${
                  workerProfile
                    ? `
                  <div class="col-md-4">
                    <label class="form-label small fw-semibold">Phone Number *</label>
                    <input type="text" class="form-control tabular-nums" id="profPhone" value="${escapeHtml(workerProfile.phone)}" required />
                  </div>
                  <div class="col-md-4">
                    <label class="form-label small fw-semibold">Specialization</label>
                    <input type="text" class="form-control" value="${escapeHtml(workerProfile.specialization)}" disabled />
                  </div>
                  <div class="col-md-4">
                    <label class="form-label small fw-semibold">Duty Availability</label>
                    <select class="form-select" id="profAvailability">
                      <option value="Available" ${workerProfile.availability === 'Available' ? 'selected' : ''}>Available</option>
                      <option value="Busy" ${workerProfile.availability === 'Busy' ? 'selected' : ''}>Busy</option>
                      <option value="Off Duty" ${workerProfile.availability === 'Off Duty' ? 'selected' : ''}>Off Duty</option>
                    </select>
                  </div>
                `
                    : ''
                }
              </div>
              <div class="mt-3 text-end">
                <button type="submit" class="btn btn-sc-primary btn-sm">Update Profile Details</button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <!-- Right Column: Change Password & Community Directory Info -->
      <div class="col-12 col-xl-5">
        <div class="sc-card mb-4">
          <div class="sc-card-header">
            <h6 class="fw-bold mb-0">Change Account Password</h6>
          </div>
          <div class="sc-card-body">
            <form id="changePasswordForm">
              <div class="mb-3">
                <label class="form-label small fw-semibold">Current Password *</label>
                <input type="password" class="form-control" id="curPwd" required />
              </div>
              <div class="mb-3">
                <label class="form-label small fw-semibold">New Password (minimum 6 characters) *</label>
                <input type="password" class="form-control" id="newPwd" required />
              </div>
              <button type="submit" class="btn btn-sc-navy w-100">Update Password</button>
            </form>
          </div>
        </div>

        <div class="sc-card">
          <div class="sc-card-header">
            <h6 class="fw-bold mb-0">Community Helpdesk & Contacts</h6>
          </div>
          <div class="sc-card-body small">
            <div class="mb-2"><strong>Community:</strong> ${escapeHtml(cs.communityName)}</div>
            <div class="mb-2"><strong>Address:</strong> ${escapeHtml(cs.communityAddress)}</div>
            <div class="mb-2"><strong>Office Email:</strong> ${escapeHtml(cs.contactEmail)}</div>
            <div class="mb-2 tabular-nums"><strong>Office Phone:</strong> ${escapeHtml(cs.contactPhone)}</div>
            <div class="tabular-nums"><strong>24x7 Security Desk:</strong> ${escapeHtml(cs.emergencyPhone)}</div>
          </div>
        </div>
      </div>
    </div>
  `;

  const commForm = document.getElementById('communitySettingsForm');
  if (commForm && isAdmin) {
    commForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const updated = await apiRequest('/api/settings/community', {
          method: 'PUT',
          body: JSON.stringify({
            communityName: document.getElementById('setCommName').value.trim(),
            communityAddress: document.getElementById('setCommAddr').value.trim(),
            contactEmail: document.getElementById('setCommEmail').value.trim(),
            contactPhone: document.getElementById('setCommPhone').value.trim(),
            emergencyPhone: document.getElementById('setEmergPhone').value.trim(),
            monthlyMaintenanceDefault: Number(document.getElementById('setMaintDefault').value)
          })
        });
        AppState.communityName = updated.communityName;
        localStorage.setItem('sc_community_name', updated.communityName);
        showToast('Community settings saved.', 'success');
        renderAppShell();
      } catch (err) {
        showToast(err.message, 'danger');
      }
    });
  }

  document.getElementById('personalProfileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const res = await apiRequest('/api/settings/profile', {
        method: 'PUT',
        body: JSON.stringify({
          fullName: document.getElementById('profFullName').value.trim(),
          email: document.getElementById('profEmail').value.trim(),
          phone: document.getElementById('profPhone')?.value.trim(),
          availability: document.getElementById('profAvailability')?.value
        })
      });
      AppState.user = res.user;
      sessionStorage.setItem('sc_auth_user', JSON.stringify(res.user));
      if (localStorage.getItem('sc_auth_token')) {
        localStorage.setItem('sc_auth_user', JSON.stringify(res.user));
      }
      if (res.vaultToken) {
        localStorage.setItem('sc_account_vault', res.vaultToken);
      }
      showToast(res.message, 'success');
      renderAppShell();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  });

  document.getElementById('changePasswordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const res = await apiRequest('/api/settings/password', {
        method: 'PUT',
        body: JSON.stringify({
          currentPassword: document.getElementById('curPwd').value,
          newPassword: document.getElementById('newPwd').value
        })
      });
      if (res?.vaultToken) {
        localStorage.setItem('sc_account_vault', res.vaultToken);
      }
      showToast('Password updated successfully.', 'success');
      document.getElementById('changePasswordForm').reset();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  });
}

// ============================================================================
// INITIALIZE APPLICATION ON DOM READY
// ============================================================================
document.addEventListener('DOMContentLoaded', async () => {
  if (AppState.token) {
    try {
      const me = await apiRequest('/api/auth/me');
      AppState.user = me.user;
      if (me.communitySettings?.communityName) {
        AppState.communityName = me.communitySettings.communityName;
      }
      AppState.activePage = getDefaultPageForRole(me.user.role);
      renderAppShell();
      return;
    } catch {
      handleLogout(false);
    }
  }
  renderLoginScreen();
});
