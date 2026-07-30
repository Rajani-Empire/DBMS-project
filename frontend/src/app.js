import './index.css';

// ========================================================
// CORE APPLICATION STATE
// ========================================================
let state = {
  user: JSON.parse(localStorage.getItem('user')) || null,
  activeTab: 'overview', // 'overview', 'students', 'faculty', 'courses', 'sections' (Admin)
  activeStudentTab: 'register', // 'register', 'schedule', 'transcript' (Student)
  activeSubTab: 'grades', // 'grades', 'attendance', 'analytics' (Faculty)
  toast: { text: '', isError: false },
  selectedSection: '', // (Faculty class selector)
  attendanceDate: new Date().toISOString().split('T')[0], // (Faculty attendance date)
  viewAttendanceLog: false, // Toggle logs vs checklist (Faculty)
  
  // Cache lists
  students: [],
  faculty: [],
  courses: [],
  sections: [],
  mySchedule: [],
  transcript: { records: [], cgpa: '0.00', completedCredits: 0 },
  roster: [],
  attendanceReport: { totalSessions: 0, records: [] },
  analytics: { metrics: { class_average: 0, class_high: 0, class_low: 0, enrolled_count: 0 }, distribution: { A: 0, B: 0, C: 0, F: 0 } },
  
  // Search parameters
  searchQuery: '',
  
  // Modal tracking
  modal: { open: false, type: '', data: null } // type: 'students'|'faculty'|'courses'|'sections', data: null for Add or item object for Edit
};

// ========================================================
// NATIVE HTTP FETCH CLIENT
// ========================================================
async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };
  const config = {
    ...options,
    headers
  };
  if (options.body && typeof options.body === 'object') {
    config.body = JSON.stringify(options.body);
  }
  const response = await fetch(`http://localhost:5000/api${endpoint}`, config);
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    const error = new Error(errData.message || 'API request failed');
    error.status = response.status;
    error.data = errData;
    throw error;
  }
  if (response.status === 204) return null;
  return response.json();
}

// ========================================================
// TOAST NOTIFICATIONS RENDERER
// ========================================================
function showToast(text, isError = false) {
  state.toast = { text, isError };
  renderToast();
  setTimeout(() => {
    if (state.toast.text === text) {
      state.toast = { text: '', isError: false };
      renderToast();
    }
  }, 5000);
}

function renderToast() {
  let toastEl = document.getElementById('global-toast');
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.id = 'global-toast';
    document.body.appendChild(toastEl);
  }
  
  if (!state.toast.text) {
    toastEl.className = 'hidden';
    toastEl.innerHTML = '';
    return;
  }

  const isError = state.toast.isError;
  toastEl.className = `alert ${isError ? 'alert-danger' : 'alert-info'} animate-pulse`;
  toastEl.style.position = 'fixed';
  toastEl.style.top = '1rem';
  toastEl.style.right = '1rem';
  toastEl.style.zIndex = '9999';
  toastEl.style.boxShadow = 'var(--shadow-lg)';
  toastEl.innerText = state.toast.text;
}

// ========================================================
// SHARED UI ELEMENT BUILDERS
// ========================================================
function renderHeader() {
  const header = document.createElement('header');
  header.className = 'topbar';
  
  const welcomeDiv = document.createElement('div');
  welcomeDiv.className = 'welcome-badge';
  welcomeDiv.innerHTML = `
    <span class="status-dot-pulse"></span>
    <span>Welcome, <span style="color: var(--primary); font-weight: 800;">${state.user.name}</span></span>
    <span class="role-tag">${state.user.role}</span>
  `;
  
  const logoutBtn = document.createElement('button');
  logoutBtn.className = 'btn btn-secondary';
  logoutBtn.innerText = 'Sign Out';
  logoutBtn.onclick = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    state.user = null;
    checkAuthAndRoute();
  };

  header.appendChild(welcomeDiv);
  header.appendChild(logoutBtn);
  return header;
}

// SVG Icons Lookup helper
const svgIcons = {
  overview: `<svg class="sidebar-icon" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z" /></svg>`,
  students: `<svg class="sidebar-icon" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>`,
  faculty: `<svg class="sidebar-icon" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>`,
  courses: `<svg class="sidebar-icon" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.168.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.168.477-4.5 1.253" /></svg>`,
  sections: `<svg class="sidebar-icon" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>`,
  statsGraph: `<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>`
};

// ========================================================
// LOGIN VIEW RENDERER
// ========================================================
function renderLogin() {
  const root = document.getElementById('root');
  
  const container = document.createElement('div');
  container.className = 'login-container';
  container.innerHTML = `
    <div class="login-glow-1"></div>
    <div class="login-glow-2"></div>

    <div class="login-card">
      <div class="login-header">
        <div class="login-logo">
          <svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
        </div>
        <h2 class="login-title">University Portal</h2>
        <p class="login-subtitle">DBMS Course Project Registry</p>
      </div>

      <div id="login-error" class="hidden alert alert-danger animate-pulse"></div>

      <form id="login-form">
        <div class="form-group">
          <label class="form-label">Email Address</label>
          <input type="email" id="login-email" required class="form-input" placeholder="name@univ.edu" />
        </div>

        <div class="form-group">
          <label class="form-label">Password</label>
          <input type="password" id="login-password" required class="form-input" placeholder="••••••••" />
        </div>

        <button type="submit" id="login-submit" class="btn btn-primary" style="width: 100%; padding: 0.75rem 1.25rem;">
          Sign In Gateway
        </button>
      </form>

      <div class="demo-box">
        <p style="font-weight: 700; text-transform: uppercase; color: var(--slate-300); tracking: 0.05em;">Default Demo Credentials:</p>
        <div style="display: flex; flex-direction: column; gap: 0.375rem;">
          <p>• Admin: <span class="code-highlight">admin@univ.edu</span> / <span class="code-highlight">admin</span></p>
          <p>• Student: <span class="code-highlight">john@student.univ.edu</span> / <span class="code-highlight">student</span></p>
          <p>• Faculty: <span class="code-highlight">turing@univ.edu</span> / <span class="code-highlight">hash123</span></p>
        </div>
      </div>

    </div>
  `;

  root.appendChild(container);

  // Form submit handler
  document.getElementById('login-form').onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const submitBtn = document.getElementById('login-submit');
    const errBanner = document.getElementById('login-error');

    errBanner.className = 'hidden';
    submitBtn.disabled = true;
    submitBtn.innerText = 'Authenticating Credentials...';

    try {
      const response = await apiFetch('/auth/login', {
        method: 'POST',
        body: { email, password }
      });
      
      localStorage.setItem('user', JSON.stringify(response.user));
      localStorage.setItem('token', response.token);
      
      state.user = response.user;
      
      // Reset view tabs
      state.activeTab = 'overview';
      state.activeStudentTab = 'register';
      state.activeSubTab = 'grades';
      
      checkAuthAndRoute();
    } catch (err) {
      console.error(err);
      errBanner.innerText = err.message || 'Connection to authentication server failed.';
      errBanner.className = 'alert alert-danger animate-pulse';
      submitBtn.disabled = false;
      submitBtn.innerText = 'Sign In Gateway';
    }
  };
}

// ========================================================
// ADMIN DASHBOARD VIEW RENDERERS
// ========================================================
function renderAdminLayout() {
  const container = document.createElement('div');
  container.className = 'dashboard-layout';

  // 1. Sidebar element
  const sidebar = document.createElement('aside');
  sidebar.className = 'sidebar';
  
  sidebar.innerHTML = `
    <div class="sidebar-brand">
      <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
      <span>Univ Admin</span>
    </div>
  `;

  const menuContainer = document.createElement('div');
  menuContainer.className = 'sidebar-menu';

  const nav = document.createElement('nav');
  nav.className = 'sidebar-nav';
  
  const tabs = ['overview', 'students', 'faculty', 'courses', 'sections'];
  tabs.forEach(tabName => {
    const btn = document.createElement('button');
    btn.className = `sidebar-link ${state.activeTab === tabName ? 'active' : ''}`;
    btn.innerHTML = `${svgIcons[tabName]} <span style="text-transform: capitalize;">${tabName}</span>`;
    btn.onclick = () => {
      state.activeTab = tabName;
      state.searchQuery = '';
      checkAuthAndRoute();
    };
    nav.appendChild(btn);
  });

  menuContainer.appendChild(nav);

  const footer = document.createElement('div');
  footer.className = 'sidebar-footer';
  footer.innerText = 'DBMS Management Portal v2.0';

  sidebar.appendChild(menuContainer);
  sidebar.appendChild(footer);

  // 2. Main content area
  const main = document.createElement('main');
  main.className = 'main-shell';
  main.appendChild(renderHeader());

  const contentDiv = document.createElement('div');
  contentDiv.className = 'content-wrapper';
  main.appendChild(contentDiv);

  container.appendChild(sidebar);
  container.appendChild(main);

  // Load content
  loadAdminContent(contentDiv);

  return container;
}

async function loadAdminContent(contentDiv) {
  // Title bar
  const headerBar = document.createElement('div');
  headerBar.className = 'flex justify-between items-center';
  headerBar.style.marginBottom = '2rem';
  
  let desc = '';
  if (state.activeTab === 'overview') desc = 'Real-time database analytics and activity feeds.';
  else if (state.activeTab === 'students') desc = 'Register new student accounts and adjust current term parameters.';
  else if (state.activeTab === 'faculty') desc = 'Control advisor designations and office assignments.';
  else if (state.activeTab === 'courses') desc = 'Maintain core curriculum catalog and mapping prerequisites.';
  else if (state.activeTab === 'sections') desc = 'Schedule routine offerings, time slots, and verify conflicts.';

  headerBar.innerHTML = `
    <div>
      <h1 style="font-size: 1.875rem; font-weight: 800; color: var(--slate-800); text-transform: uppercase;">
        ${state.activeTab === 'overview' ? 'Department Metrics' : `Manage ${state.activeTab}`}
      </h1>
      <p style="font-size: 0.875rem; color: var(--slate-500); margin-top: 0.25rem;">${desc}</p>
    </div>
  `;

  if (state.activeTab !== 'overview') {
    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn-primary';
    addBtn.innerHTML = `<svg style="margin-right: 0.375rem" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg> Create ${state.activeTab.slice(0, -1)}`;
    addBtn.onclick = () => openCRUDModal(null);
    headerBar.appendChild(addBtn);
  }

  contentDiv.appendChild(headerBar);

  // Load Tab Specific components
  const body = document.createElement('div');
  contentDiv.appendChild(body);

  try {
    if (state.activeTab === 'overview') {
      const stats = await apiFetch('/admin/stats');
      setOverviewData(stats);
      body.appendChild(buildAdminOverview());
    } else if (state.activeTab === 'students') {
      state.students = await apiFetch('/admin/students');
      body.appendChild(buildAdminStudentsGrid());
    } else if (state.activeTab === 'faculty') {
      state.faculty = await apiFetch('/admin/faculty');
      body.appendChild(buildAdminFacultyGrid());
    } else if (state.activeTab === 'courses') {
      state.courses = await apiFetch('/admin/courses');
      body.appendChild(buildAdminCoursesGrid());
    } else if (state.activeTab === 'sections') {
      state.sections = await apiFetch('/admin/sections');
      state.courses = await apiFetch('/admin/courses');
      state.faculty = await apiFetch('/admin/faculty');
      body.appendChild(buildAdminSectionsGrid());
    }
  } catch (err) {
    showToast(err.message, true);
  }
}

function setOverviewData(data) {
  state.metrics = data.metrics;
  state.recentActivity = data.recentActivity;
}

function buildAdminOverview() {
  const wrapper = document.createElement('div');
  wrapper.className = 'space-y-6';
  
  wrapper.innerHTML = `
    <!-- Aggregate Cards -->
    <div class="grid grid-cols-4">
      <div class="stat-card">
        <div class="stat-card-header">
          <p class="stat-card-title">Total Students</p>
          <span class="stat-card-icon-wrap blue">${svgIcons.students}</span>
        </div>
        <p class="stat-card-value">${state.metrics.total_students}</p>
      </div>

      <div class="stat-card">
        <div class="stat-card-header">
          <p class="stat-card-title">Total Faculty</p>
          <span class="stat-card-icon-wrap emerald">${svgIcons.faculty}</span>
        </div>
        <p class="stat-card-value">${state.metrics.total_faculty}</p>
      </div>

      <div class="stat-card">
        <div class="stat-card-header">
          <p class="stat-card-title">Courses Catalog</p>
          <span class="stat-card-icon-wrap amber">${svgIcons.courses}</span>
        </div>
        <p class="stat-card-value">${state.metrics.total_courses}</p>
      </div>

      <div class="stat-card">
        <div class="stat-card-header">
          <p class="stat-card-title">Dept. Average Score</p>
          <span class="stat-card-icon-wrap indigo">${svgIcons.statsGraph}</span>
        </div>
        <p class="stat-card-value">${state.metrics.department_average_score}%</p>
      </div>
    </div>

    <!-- Recent Grade Updates -->
    <div class="card" style="margin-top: 1.5rem;">
      <h2 style="font-size: 1.25rem; font-weight: 700; color: var(--slate-800); margin-bottom: 1rem;">Recent Grade Publications</h2>
      <div id="recent-feed-container"></div>
    </div>
  `;

  const feedContainer = wrapper.querySelector('#recent-feed-container');
  if (state.recentActivity.length === 0) {
    feedContainer.innerHTML = `<p style="font-size: 0.875rem; color: var(--slate-400);">No grades logged in the registry database yet.</p>`;
  } else {
    const table = document.createElement('table');
    table.className = 'data-table';
    table.innerHTML = `
      <thead>
        <tr>
          <th>Student</th>
          <th>Course Code</th>
          <th>Total Marks</th>
          <th style="text-align: center;">Calculated Grade</th>
        </tr>
      </thead>
      <tbody id="recent-rows"></tbody>
    `;
    
    const rows = table.querySelector('#recent-rows');
    state.recentActivity.forEach(act => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight: 600; color: var(--slate-800);">${act.student_name}</td>
        <td class="font-mono-tag" style="color: var(--primary); font-weight: 700;">${act.course_code}</td>
        <td>${act.total_score}%</td>
        <td style="text-align: center;">
          <span class="badge ${act.letter_grade === 'F' ? 'badge-danger' : 'badge-success'}">${act.letter_grade}</span>
        </td>
      `;
      rows.appendChild(tr);
    });
    
    feedContainer.appendChild(table);
  }

  return wrapper;
}

function buildAdminStudentsGrid() {
  const container = document.createElement('div');
  container.className = 'card';
  
  container.innerHTML = `
    <div style="margin-bottom: 1.5rem;">
      <input
        type="text"
        id="student-search-input"
        placeholder="Search students by name, registration no., or email..."
        value="${state.searchQuery}"
        class="modal-form-input"
        style="max-width: 24rem;"
      />
    </div>
    <div class="table-wrapper" id="students-table-container"></div>
  `;

  const searchInput = container.querySelector('#student-search-input');
  searchInput.oninput = (e) => {
    state.searchQuery = e.target.value;
    renderStudentsListTable(container.querySelector('#students-table-container'));
  };

  renderStudentsListTable(container.querySelector('#students-table-container'));
  return container;
}

function renderStudentsListTable(wrapperEl) {
  const query = state.searchQuery.toLowerCase();
  const list = state.students.filter(s => 
    s.name.toLowerCase().includes(query) ||
    s.student_reg_no.toLowerCase().includes(query) ||
    s.email.toLowerCase().includes(query)
  );

  wrapperEl.innerHTML = '';
  
  if (list.length === 0) {
    wrapperEl.innerHTML = `<p style="font-size: 0.875rem; color: var(--slate-400); text-align: center; padding: 1.5rem 0;">No students found matching your parameters.</p>`;
    return;
  }

  const table = document.createElement('table');
  table.className = 'data-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>Student ID</th>
        <th>Name</th>
        <th>Email</th>
        <th>Registration No</th>
        <th style="text-align: center;">Batch</th>
        <th style="text-align: center;">Semester</th>
        <th style="text-align: center;">Actions</th>
      </tr>
    </thead>
    <tbody id="students-rows"></tbody>
  `;

  const rows = table.querySelector('#students-rows');
  list.forEach(student => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="font-mono-tag">${student.id}</td>
      <td style="font-weight: 600; color: var(--slate-800);">${student.name}</td>
      <td>${student.email}</td>
      <td style="font-weight: 600;">${student.student_reg_no}</td>
      <td style="text-align: center;">${student.batch_year}</td>
      <td style="text-align: center;">Sem-${student.current_semester}</td>
      <td style="text-align: center;" id="action-cell-${student.id}"></td>
    `;
    
    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn-secondary';
    editBtn.style.padding = '0.25rem 0.5rem';
    editBtn.style.fontSize = '0.75rem';
    editBtn.style.marginRight = '0.375rem';
    editBtn.innerText = 'Edit';
    editBtn.onclick = () => openCRUDModal(student);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-danger';
    deleteBtn.style.padding = '0.25rem 0.5rem';
    deleteBtn.style.fontSize = '0.75rem';
    deleteBtn.innerText = 'Delete';
    deleteBtn.onclick = () => deleteCRUDItem(student.id);

    const cell = tr.querySelector(`#action-cell-${student.id}`);
    cell.appendChild(editBtn);
    cell.appendChild(deleteBtn);

    rows.appendChild(tr);
  });

  wrapperEl.appendChild(table);
}

function buildAdminFacultyGrid() {
  const container = document.createElement('div');
  container.className = 'card';
  
  container.innerHTML = `
    <div style="margin-bottom: 1.5rem;">
      <input
        type="text"
        id="faculty-search-input"
        placeholder="Search faculty by advisor name or email..."
        value="${state.searchQuery}"
        class="modal-form-input"
        style="max-width: 24rem;"
      />
    </div>
    <div class="table-wrapper" id="faculty-table-container"></div>
  `;

  const searchInput = container.querySelector('#faculty-search-input');
  searchInput.oninput = (e) => {
    state.searchQuery = e.target.value;
    renderFacultyListTable(container.querySelector('#faculty-table-container'));
  };

  renderFacultyListTable(container.querySelector('#faculty-table-container'));
  return container;
}

function renderFacultyListTable(wrapperEl) {
  const query = state.searchQuery.toLowerCase();
  const list = state.faculty.filter(f => 
    f.name.toLowerCase().includes(query) ||
    f.email.toLowerCase().includes(query) ||
    f.designation.toLowerCase().includes(query)
  );

  wrapperEl.innerHTML = '';
  
  if (list.length === 0) {
    wrapperEl.innerHTML = `<p style="font-size: 0.875rem; color: var(--slate-400); text-align: center; padding: 1.5rem 0;">No instructors found matching your parameters.</p>`;
    return;
  }

  const table = document.createElement('table');
  table.className = 'data-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>Faculty ID</th>
        <th>Advisor Name</th>
        <th>Email</th>
        <th>Designation</th>
        <th>Office Room</th>
        <th style="text-align: center;">Actions</th>
      </tr>
    </thead>
    <tbody id="faculty-rows"></tbody>
  `;

  const rows = table.querySelector('#faculty-rows');
  list.forEach(fac => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="font-mono-tag">${fac.id}</td>
      <td style="font-weight: 600; color: var(--slate-800);">${fac.name}</td>
      <td>${fac.email}</td>
      <td>${fac.designation}</td>
      <td class="font-mono-tag" style="font-size: 0.75rem;">${fac.office_room}</td>
      <td style="text-align: center;" id="action-cell-${fac.id}"></td>
    `;
    
    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn-secondary';
    editBtn.style.padding = '0.25rem 0.5rem';
    editBtn.style.fontSize = '0.75rem';
    editBtn.style.marginRight = '0.375rem';
    editBtn.innerText = 'Edit';
    editBtn.onclick = () => openCRUDModal(fac);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-danger';
    deleteBtn.style.padding = '0.25rem 0.5rem';
    deleteBtn.style.fontSize = '0.75rem';
    deleteBtn.innerText = 'Delete';
    deleteBtn.onclick = () => deleteCRUDItem(fac.id);

    const cell = tr.querySelector(`#action-cell-${fac.id}`);
    cell.appendChild(editBtn);
    cell.appendChild(deleteBtn);

    rows.appendChild(tr);
  });

  wrapperEl.appendChild(table);
}

function buildAdminCoursesGrid() {
  const container = document.createElement('div');
  container.className = 'card';
  
  container.innerHTML = `
    <div style="margin-bottom: 1.5rem;">
      <input
        type="text"
        id="courses-search-input"
        placeholder="Search courses by code or title..."
        value="${state.searchQuery}"
        class="modal-form-input"
        style="max-width: 24rem;"
      />
    </div>
    <div class="table-wrapper" id="courses-table-container"></div>
  `;

  const searchInput = container.querySelector('#courses-search-input');
  searchInput.oninput = (e) => {
    state.searchQuery = e.target.value;
    renderCoursesListTable(container.querySelector('#courses-table-container'));
  };

  renderCoursesListTable(container.querySelector('#courses-table-container'));
  return container;
}

function renderCoursesListTable(wrapperEl) {
  const query = state.searchQuery.toLowerCase();
  const list = state.courses.filter(c => 
    c.course_code.toLowerCase().includes(query) ||
    c.title.toLowerCase().includes(query)
  );

  wrapperEl.innerHTML = '';
  
  if (list.length === 0) {
    wrapperEl.innerHTML = `<p style="font-size: 0.875rem; color: var(--slate-400); text-align: center; padding: 1.5rem 0;">No courses scheduled in syllabus catalog.</p>`;
    return;
  }

  const table = document.createElement('table');
  table.className = 'data-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>Code</th>
        <th>Course Title</th>
        <th style="text-align: center;">Credits</th>
        <th>Prerequisite Required</th>
        <th style="text-align: center;">Actions</th>
      </tr>
    </thead>
    <tbody id="courses-rows"></tbody>
  `;

  const rows = table.querySelector('#courses-rows');
  list.forEach(c => {
    const tr = document.createElement('tr');
    
    let prereqHtml = `<span style="color: var(--slate-300); font-size: 0.75rem;">— None</span>`;
    if (c.prerequisite_title) {
      prereqHtml = `<span class="badge badge-info">${c.prerequisite_title}</span>`;
    }

    tr.innerHTML = `
      <td style="font-weight: 700; color: var(--primary);">${c.course_code}</td>
      <td style="font-weight: 600; color: var(--slate-800);">${c.title}</td>
      <td style="text-align: center;">${c.credits} Cr.</td>
      <td>${prereqHtml}</td>
      <td style="text-align: center;" id="action-cell-${c.id}"></td>
    `;
    
    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn-secondary';
    editBtn.style.padding = '0.25rem 0.5rem';
    editBtn.style.fontSize = '0.75rem';
    editBtn.style.marginRight = '0.375rem';
    editBtn.innerText = 'Edit';
    editBtn.onclick = () => openCRUDModal(c);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-danger';
    deleteBtn.style.padding = '0.25rem 0.5rem';
    deleteBtn.style.fontSize = '0.75rem';
    deleteBtn.innerText = 'Delete';
    deleteBtn.onclick = () => deleteCRUDItem(c.id);

    const cell = tr.querySelector(`#action-cell-${c.id}`);
    cell.appendChild(editBtn);
    cell.appendChild(deleteBtn);

    rows.appendChild(tr);
  });

  wrapperEl.appendChild(table);
}

function buildAdminSectionsGrid() {
  const container = document.createElement('div');
  container.className = 'card';
  
  container.innerHTML = `
    <div style="margin-bottom: 1.5rem;">
      <input
        type="text"
        id="sections-search-input"
        placeholder="Search scheduled sections by code, room, or instructor name..."
        value="${state.searchQuery}"
        class="modal-form-input"
        style="max-width: 24rem;"
      />
    </div>
    <div class="table-wrapper" id="sections-table-container"></div>
  `;

  const searchInput = container.querySelector('#sections-search-input');
  searchInput.oninput = (e) => {
    state.searchQuery = e.target.value;
    renderSectionsListTable(container.querySelector('#sections-table-container'));
  };

  renderSectionsListTable(container.querySelector('#sections-table-container'));
  return container;
}

function renderSectionsListTable(wrapperEl) {
  const query = state.searchQuery.toLowerCase();
  const list = state.sections.filter(sec => 
    sec.course_code.toLowerCase().includes(query) ||
    sec.course_title.toLowerCase().includes(query) ||
    sec.faculty_name.toLowerCase().includes(query) ||
    sec.room_number.toLowerCase().includes(query)
  );

  wrapperEl.innerHTML = '';
  
  if (list.length === 0) {
    wrapperEl.innerHTML = `<p style="font-size: 0.875rem; color: var(--slate-400); text-align: center; padding: 1.5rem 0;">No scheduled sections registered.</p>`;
    return;
  }

  const table = document.createElement('table');
  table.className = 'data-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>Section ID</th>
        <th>Course</th>
        <th>Instructor</th>
        <th>Room</th>
        <th>Day</th>
        <th>Time Slot</th>
        <th style="text-align: center;">Semester</th>
        <th style="text-align: center;">Actions</th>
      </tr>
    </thead>
    <tbody id="sections-rows"></tbody>
  `;

  const rows = table.querySelector('#sections-rows');
  list.forEach(sec => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="font-mono-tag">${sec.id}</td>
      <td>
        <div style="font-weight: 600; color: var(--slate-800);">${sec.course_code}</div>
        <div style="font-size: 0.75rem; color: var(--slate-400); font-weight: 500;">${sec.course_title}</div>
      </td>
      <td style="font-weight: 500;">${sec.faculty_name}</td>
      <td class="font-mono-tag" style="font-size: 0.75rem;">${sec.room_number}</td>
      <td>
        <span class="badge badge-info">${sec.day_of_week}</span>
      </td>
      <td style="font-weight: 600; color: var(--slate-600);">${sec.time_slot}</td>
      <td style="text-align: center; font-weight: 700; color: var(--slate-400);">${sec.semester_code}</td>
      <td style="text-align: center;" id="action-cell-${sec.id}"></td>
    `;
    
    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn-secondary';
    editBtn.style.padding = '0.25rem 0.5rem';
    editBtn.style.fontSize = '0.75rem';
    editBtn.style.marginRight = '0.375rem';
    editBtn.innerText = 'Edit';
    editBtn.onclick = () => openCRUDModal(sec);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-danger';
    deleteBtn.style.padding = '0.25rem 0.5rem';
    deleteBtn.style.fontSize = '0.75rem';
    deleteBtn.innerText = 'Delete';
    deleteBtn.onclick = () => deleteCRUDItem(sec.id);

    const cell = tr.querySelector(`#action-cell-${sec.id}`);
    cell.appendChild(editBtn);
    cell.appendChild(deleteBtn);

    rows.appendChild(tr);
  });

  wrapperEl.appendChild(table);
}

// Open CRUD modal overlay
function openCRUDModal(item) {
  state.modal.open = true;
  state.modal.data = item;
  state.modal.type = state.activeTab;
  renderModal();
}

function renderModal() {
  let modalEl = document.getElementById('crud-modal');
  if (modalEl) modalEl.remove();

  if (!state.modal.open) return;

  const isEdit = state.modal.data !== null;
  const item = state.modal.data;
  const type = state.modal.type;

  modalEl = document.createElement('div');
  modalEl.id = 'crud-modal';
  modalEl.className = 'modal-overlay';
  
  let formFieldsHtml = '';
  
  if (type === 'students') {
    formFieldsHtml = `
      <div class="form-group">
        <label class="modal-form-label">Full Name</label>
        <input type="text" id="m-name" required value="${isEdit ? item.name : ''}" class="modal-form-input" />
      </div>
      <div class="form-group">
        <label class="modal-form-label">Email Address</label>
        <input type="email" id="m-email" required value="${isEdit ? item.email : ''}" class="modal-form-input" />
      </div>
      ${!isEdit ? `
      <div class="form-group">
        <label class="modal-form-label">Default Password</label>
        <input type="password" id="m-password" required value="" class="modal-form-input" />
      </div>
      ` : ''}
      <div class="flex" style="gap: 1rem; margin-bottom: 1.25rem;">
        <div class="flex-1">
          <label class="modal-form-label">Reg Number</label>
          <input type="text" id="m-reg" required placeholder="REG-2026-XXX" value="${isEdit ? item.student_reg_no : ''}" class="modal-form-input" />
        </div>
        <div class="flex-1">
          <label class="modal-form-label">Batch Year</label>
          <input type="number" id="m-batch" required value="${isEdit ? item.batch_year : new Date().getFullYear()}" class="modal-form-input" />
        </div>
      </div>
      <div class="form-group">
        <label class="modal-form-label">Active Semester (1-8)</label>
        <select id="m-semester" class="modal-form-select">
          ${[1,2,3,4,5,6,7,8].map(num => `<option value="${num}" ${isEdit && item.current_semester === num ? 'selected' : ''}>Semester ${num}</option>`).join('')}
        </select>
      </div>
    `;
  } else if (type === 'faculty') {
    formFieldsHtml = `
      <div class="form-group">
        <label class="modal-form-label">Advisor Name</label>
        <input type="text" id="m-name" required value="${isEdit ? item.name : ''}" class="modal-form-input" />
      </div>
      <div class="form-group">
        <label class="modal-form-label">Email Address</label>
        <input type="email" id="m-email" required value="${isEdit ? item.email : ''}" class="modal-form-input" />
      </div>
      ${!isEdit ? `
      <div class="form-group">
        <label class="modal-form-label">Default Password</label>
        <input type="password" id="m-password" required value="" class="modal-form-input" />
      </div>
      ` : ''}
      <div class="flex" style="gap: 1rem; margin-bottom: 1.25rem;">
        <div class="flex-1">
          <label class="modal-form-label">Designation</label>
          <select id="m-designation" class="modal-form-select">
            ${['Professor', 'Associate Professor', 'Assistant Professor', 'Senior Lecturer', 'Lecturer'].map(des => `
              <option value="${des}" ${isEdit && item.designation === des ? 'selected' : ''}>${des}</option>
            `).join('')}
          </select>
        </div>
        <div class="flex-1">
          <label class="modal-form-label">Office Room</label>
          <input type="text" id="m-room" required placeholder="Room-XXX" value="${isEdit ? item.office_room : ''}" class="modal-form-input" />
        </div>
      </div>
    `;
  } else if (type === 'courses') {
    formFieldsHtml = `
      <div class="flex" style="gap: 1rem; margin-bottom: 1.25rem;">
        <div class="flex-1">
          <label class="modal-form-label">Course Code</label>
          <input type="text" id="m-code" required placeholder="CSE-311" value="${isEdit ? item.course_code : ''}" class="modal-form-input" />
        </div>
        <div class="flex-1">
          <label class="modal-form-label">Credits</label>
          <select id="m-credits" class="modal-form-select">
            ${[1.0, 1.5, 3.0, 4.0].map(cr => `<option value="${cr}" ${isEdit && parseFloat(item.credits) === cr ? 'selected' : ''}>${cr} Cr.</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="modal-form-label">Course Title</label>
        <input type="text" id="m-title" required value="${isEdit ? item.title : ''}" class="modal-form-input" />
      </div>
      <div class="form-group">
        <label class="modal-form-label">Prerequisite Course</label>
        <select id="m-prereq" class="modal-form-select">
          <option value="">None — Direct Entry</option>
          ${state.courses
            .filter(c => !isEdit || c.id !== item.id)
            .map(c => `<option value="${c.id}" ${isEdit && item.prerequisite_id === c.id ? 'selected' : ''}>${c.course_code} - ${c.title}</option>`).join('')}
        </select>
      </div>
    `;
  } else if (type === 'sections') {
    formFieldsHtml = `
      <div class="form-group">
        <label class="modal-form-label">Course Catalog Select</label>
        <select id="m-course-id" required class="modal-form-select">
          ${state.courses.map(c => `<option value="${c.id}" ${isEdit && item.course_id === c.id ? 'selected' : ''}>${c.course_code} - ${c.title}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="modal-form-label">Faculty Instructor Select</label>
        <select id="m-faculty-id" required class="modal-form-select">
          ${state.faculty.map(f => `<option value="${f.id}" ${isEdit && item.faculty_id === f.id ? 'selected' : ''}>${f.name} (${f.designation})</option>`).join('')}
        </select>
      </div>
      <div class="flex" style="gap: 1rem; margin-bottom: 1.25rem;">
        <div class="flex-1">
          <label class="modal-form-label">Semester Code</label>
          <input type="text" id="m-semester-code" required placeholder="Summer2026" value="${isEdit ? item.semester_code : 'Summer2026'}" class="modal-form-input" />
        </div>
        <div class="flex-1">
          <label class="modal-form-label">Room Allocation</label>
          <input type="text" id="m-room" required placeholder="Room-102 or Lab-3" value="${isEdit ? item.room_number : ''}" class="modal-form-input" />
        </div>
      </div>
      <div class="flex" style="gap: 1rem; margin-bottom: 1.25rem;">
        <div class="flex-1">
          <label class="modal-form-label">Day of Week</label>
          <select id="m-day" class="modal-form-select">
            ${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map(day => `
              <option value="${day}" ${isEdit && item.day_of_week === day ? 'selected' : ''}>${day}</option>
            `).join('')}
          </select>
        </div>
        <div class="flex-1">
          <label class="modal-form-label">Time Slot</label>
          <input type="text" id="m-time" required placeholder="e.g. 09:00-10:30" value="${isEdit ? item.time_slot : '09:00-10:30'}" class="modal-form-input" />
        </div>
      </div>
    `;
  }

  modalEl.innerHTML = `
    <div class="modal-card">
      <div class="modal-header">
        <h3 class="modal-title">
          ${isEdit ? 'Edit Profile details' : 'Add New Entry'} - <span style="text-transform: capitalize; color: var(--primary);">${type.slice(0, -1)}</span>
        </h3>
        <button id="modal-close-btn" class="modal-close-btn">
          <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <form id="modal-form" class="modal-body">
        <div style="display: flex; flex-direction: column; gap: 1rem;">
          ${formFieldsHtml}
        </div>
        
        <div class="modal-footer" style="margin-top: 1.5rem; margin-left: -1.5rem; margin-right: -1.5rem; margin-bottom: -1rem;">
          <button type="button" id="modal-cancel-btn" class="btn btn-secondary">
            Cancel
          </button>
          <button type="submit" class="btn btn-primary">
            ${isEdit ? 'Save Updates' : 'Add Item'}
          </button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modalEl);

  const closeModal = () => {
    state.modal.open = false;
    state.modal.data = null;
    modalEl.remove();
  };

  document.getElementById('modal-close-btn').onclick = closeModal;
  document.getElementById('modal-cancel-btn').onclick = closeModal;

  document.getElementById('modal-form').onsubmit = async (e) => {
    e.preventDefault();
    
    let url = `/admin/${type}`;
    let method = isEdit ? 'PUT' : 'POST';
    if (isEdit) {
      url += `/${item.id}`;
    }

    let payload = {};
    if (type === 'students') {
      payload = {
        name: document.getElementById('m-name').value,
        email: document.getElementById('m-email').value,
        student_reg_no: document.getElementById('m-reg').value,
        batch_year: parseInt(document.getElementById('m-batch').value) || 2026,
        current_semester: parseInt(document.getElementById('m-semester').value) || 1
      };
      if (!isEdit) payload.password = document.getElementById('m-password').value;
    } else if (type === 'faculty') {
      payload = {
        name: document.getElementById('m-name').value,
        email: document.getElementById('m-email').value,
        designation: document.getElementById('m-designation').value,
        office_room: document.getElementById('m-room').value
      };
      if (!isEdit) payload.password = document.getElementById('m-password').value;
    } else if (type === 'courses') {
      payload = {
        course_code: document.getElementById('m-code').value,
        title: document.getElementById('m-title').value,
        credits: parseFloat(document.getElementById('m-credits').value) || 3.0,
        prerequisite_id: document.getElementById('m-prereq').value || null
      };
    } else if (type === 'sections') {
      payload = {
        course_id: parseInt(document.getElementById('m-course-id').value),
        faculty_id: parseInt(document.getElementById('m-faculty-id').value),
        semester_code: document.getElementById('m-semester-code').value,
        room_number: document.getElementById('m-room').value,
        day_of_week: document.getElementById('m-day').value,
        time_slot: document.getElementById('m-time').value
      };
    }

    try {
      const response = await apiFetch(url, {
        method,
        body: payload
      });
      showToast(response.message || 'Saved successfully!');
      closeModal();
      checkAuthAndRoute();
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Error occurred. Verify parameters.', true);
    }
  };
}

async function deleteCRUDItem(id) {
  if (!window.confirm("Are you absolutely sure you want to delete this item? This action is permanent and may break relational records.")) return;
  try {
    const res = await apiFetch(`/admin/${state.activeTab}/${id}`, { method: 'DELETE' });
    showToast(res.message || 'Item deleted successfully.');
    checkAuthAndRoute();
  } catch (err) {
    console.error(err);
    showToast(err.message || 'Failed to delete the selected item.', true);
  }
}

// ========================================================
// STUDENT DASHBOARD VIEW RENDERERS
// ========================================================
function renderStudentLayout() {
  const container = document.createElement('div');
  container.className = 'dashboard-layout';
  container.style.flexDirection = 'column';
  
  container.appendChild(renderHeader());

  const mainArea = document.createElement('div');
  mainArea.className = 'content-wrapper';
  mainArea.style.flex = '1';
  mainArea.style.display = 'flex';
  mainArea.style.flexDirection = 'column';
  mainArea.style.overflowY = 'auto';
  
  // Banner / Tab Bar
  const topBar = document.createElement('div');
  topBar.className = 'flex justify-between items-center';
  topBar.style.marginBottom = '2rem';
  
  topBar.innerHTML = `
    <div>
      <h1 style="font-size: 1.875rem; font-weight: 800; color: var(--slate-800); text-transform: uppercase;">Registration & Academic Portal</h1>
      <p style="font-size: 0.875rem; color: var(--slate-500); margin-top: 0.25rem;">Enroll in weekly schedules, view transcripts, and manage your degree course routine.</p>
    </div>
  `;

  const tabsContainer = document.createElement('div');
  tabsContainer.className = 'tab-container';
  
  const tabs = [
    { id: 'register', label: 'Course Catalog' },
    { id: 'schedule', label: 'My Class Routine' },
    { id: 'transcript', label: 'Grade Sheet' }
  ];

  tabs.forEach(t => {
    const btn = document.createElement('button');
    btn.className = `tab-btn ${state.activeStudentTab === t.id ? 'active' : ''}`;
    btn.innerText = t.label;
    btn.onclick = () => {
      state.activeStudentTab = t.id;
      state.searchQuery = '';
      checkAuthAndRoute();
    };
    tabsContainer.appendChild(btn);
  });

  topBar.appendChild(tabsContainer);
  mainArea.appendChild(topBar);

  const body = document.createElement('div');
  body.style.flex = '1';
  mainArea.appendChild(body);

  container.appendChild(mainArea);

  loadStudentContent(body);

  return container;
}

async function loadStudentContent(bodyEl) {
  try {
    state.mySchedule = await apiFetch(`/courses/schedule/${state.user.id}`);
    
    if (state.activeStudentTab === 'register') {
      state.sections = await apiFetch('/courses/available');
      bodyEl.appendChild(buildStudentRegisterView());
    } else if (state.activeStudentTab === 'schedule') {
      bodyEl.appendChild(buildStudentScheduleView());
    } else if (state.activeStudentTab === 'transcript') {
      state.transcript = await apiFetch(`/courses/transcript/${state.user.id}`);
      bodyEl.appendChild(buildStudentTranscriptView());
    }
  } catch (err) {
    showToast(err.message, true);
  }
}

function buildStudentRegisterView() {
  const container = document.createElement('div');
  container.className = 'card';

  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
      <h2 style="font-size: 1.25rem; font-weight: 700; color: var(--slate-800);">Available Department Offerings</h2>
      <input
        type="text"
        id="catalog-search"
        placeholder="Search course code or title..."
        value="${state.searchQuery}"
        class="modal-form-input"
        style="max-width: 16rem;"
      />
    </div>
    <div class="table-wrapper" id="catalog-table-container"></div>
  `;

  const search = container.querySelector('#catalog-search');
  search.oninput = (e) => {
    state.searchQuery = e.target.value;
    renderCatalogTable(container.querySelector('#catalog-table-container'));
  };

  renderCatalogTable(container.querySelector('#catalog-table-container'));

  return container;
}

function renderCatalogTable(wrapperEl) {
  const query = state.searchQuery.toLowerCase();
  const list = state.sections.filter(sec => 
    sec.course_code.toLowerCase().includes(query) ||
    sec.course_title.toLowerCase().includes(query)
  );

  wrapperEl.innerHTML = '';
  if (list.length === 0) {
    wrapperEl.innerHTML = `<p style="font-size: 0.875rem; color: var(--slate-400); text-align: center; padding: 1.5rem 0;">No class sections scheduled for this term.</p>`;
    return;
  }

  const table = document.createElement('table');
  table.className = 'data-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>Code</th>
        <th>Course Title</th>
        <th style="text-align: center;">Credits</th>
        <th>Faculty Advisor</th>
        <th>Routine Slot</th>
        <th>Room</th>
        <th style="text-align: center;">Capacity</th>
        <th style="text-align: center;">Action</th>
      </tr>
    </thead>
    <tbody id="catalog-rows"></tbody>
  `;

  const rows = table.querySelector('#catalog-rows');
  list.forEach(sec => {
    const enrolled = state.mySchedule.some(s => s.section_id === sec.section_id);
    const isFull = sec.enrolled_count >= sec.capacity;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-weight: 700; color: var(--primary);">${sec.course_code}</td>
      <td style="font-weight: 600; color: var(--slate-800);">${sec.course_title}</td>
      <td style="text-align: center;">${sec.credits} Cr.</td>
      <td style="font-weight: 500;">${sec.faculty_name}</td>
      <td>
        <span class="badge badge-info" style="margin-right: 0.5rem;">${sec.day_of_week}</span>
        <span style="font-weight: 600; color: var(--slate-500);">${sec.time_slot}</span>
      </td>
      <td class="font-mono-tag" style="font-size: 0.75rem;">${sec.room_number}</td>
      <td style="text-align: center;">
        <span class="badge ${isFull ? 'badge-danger' : 'badge-info'}">
          ${sec.enrolled_count}/${sec.capacity || 40}
        </span>
      </td>
      <td style="text-align: center;" id="enroll-cell-${sec.section_id}"></td>
    `;

    const cell = tr.querySelector(`#enroll-cell-${sec.section_id}`);
    
    if (enrolled) {
      const dropBtn = document.createElement('button');
      dropBtn.className = 'btn btn-danger';
      dropBtn.style.padding = '0.375rem 0.75rem';
      dropBtn.style.fontSize = '0.75rem';
      dropBtn.innerText = 'Drop Course';
      dropBtn.onclick = () => handleStudentDrop(sec.section_id);
      cell.appendChild(dropBtn);
    } else {
      const enrollBtn = document.createElement('button');
      enrollBtn.disabled = isFull;
      enrollBtn.className = isFull ? 'btn btn-secondary' : 'btn btn-primary';
      enrollBtn.style.padding = '0.375rem 0.75rem';
      enrollBtn.style.fontSize = '0.75rem';
      enrollBtn.innerText = isFull ? 'Full Slot' : 'Enroll Class';
      enrollBtn.onclick = () => handleStudentEnroll(sec.section_id);
      cell.appendChild(enrollBtn);
    }

    rows.appendChild(tr);
  });

  wrapperEl.appendChild(table);
}

async function handleStudentEnroll(secId) {
  try {
    const res = await apiFetch('/courses/enroll', {
      method: 'POST',
      body: { student_id: state.user.id, section_id: secId }
    });
    showToast(res.message || 'Enrolled successfully!');
    checkAuthAndRoute();
  } catch (err) {
    showToast(err.message, true);
  }
}

async function handleStudentDrop(secId) {
  if (!window.confirm("Are you sure you want to drop this class section? This will delete any recorded grades for this session.")) return;
  try {
    const res = await apiFetch('/courses/drop', {
      method: 'POST',
      body: { student_id: state.user.id, section_id: secId }
    });
    showToast(res.message || 'Dropped section successfully.');
    checkAuthAndRoute();
  } catch (err) {
    showToast(err.message, true);
  }
}

function buildStudentScheduleView() {
  const wrapper = document.createElement('div');
  wrapper.className = 'card';

  wrapper.innerHTML = `
    <h2 style="font-size: 1.25rem; font-weight: 700; color: var(--slate-800); margin-bottom: 1rem;">My Class Timetable (${state.mySchedule.length} Courses Enrolled)</h2>
    <div id="timetable-container"></div>
  `;

  const container = wrapper.querySelector('#timetable-container');
  if (state.mySchedule.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 2rem 0;">
        <p style="font-size: 0.875rem; color: var(--slate-400); margin-bottom: 1rem;">You are not registered in any class sections for this semester.</p>
        <button id="go-to-catalog" class="btn btn-primary">
          Go to Course Catalog
        </button>
      </div>
    `;
    container.querySelector('#go-to-catalog').onclick = () => {
      state.activeStudentTab = 'register';
      checkAuthAndRoute();
    };
  } else {
    const table = document.createElement('table');
    table.className = 'data-table';
    table.innerHTML = `
      <thead>
        <tr>
          <th>Day</th>
          <th>Time Slot</th>
          <th>Course</th>
          <th>Credits</th>
          <th>Instructor</th>
          <th>Room Location</th>
          <th style="text-align: center;">Action</th>
        </tr>
      </thead>
      <tbody id="timetable-rows"></tbody>
    `;
    
    const rows = table.querySelector('#timetable-rows');
    state.mySchedule.forEach(sec => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight: 800; color: var(--slate-800);">
          <span class="badge badge-info">${sec.day_of_week}</span>
        </td>
        <td style="font-weight: 600; color: var(--slate-600);">${sec.time_slot}</td>
        <td>
          <div style="font-weight: 700; color: var(--slate-800);">${sec.course_code}</div>
          <div style="font-size: 0.75rem; color: var(--slate-400); font-weight: 500;">${sec.course_title}</div>
        </td>
        <td>${sec.credits} Credits</td>
        <td style="font-weight: 500;">${sec.faculty_name}</td>
        <td class="font-mono-tag" style="font-size: 0.75rem;">${sec.room_number}</td>
        <td style="text-align: center;" id="drop-cell-${sec.section_id}"></td>
      `;

      const dropBtn = document.createElement('button');
      dropBtn.className = 'btn btn-danger';
      dropBtn.style.padding = '0.25rem 0.5rem';
      dropBtn.style.fontSize = '0.75rem';
      dropBtn.innerText = 'Drop';
      dropBtn.onclick = () => handleStudentDrop(sec.section_id);

      tr.querySelector(`#drop-cell-${sec.section_id}`).appendChild(dropBtn);
      rows.appendChild(tr);
    });

    container.appendChild(table);
  }

  return wrapper;
}

function buildStudentTranscriptView() {
  const wrapper = document.createElement('div');
  wrapper.className = 'space-y-6';

  const semCount = Array.from(new Set(state.transcript.records.map(r => r.semester_code))).length || 1;

  wrapper.innerHTML = `
    <div class="grid grid-cols-4" style="grid-template-columns: repeat(3, minmax(0, 1fr));">
      <div class="stat-card">
        <p class="stat-card-title">Cumulative CGPA</p>
        <p class="stat-card-value" style="color: var(--primary);">${state.transcript.cgpa}</p>
      </div>
      <div class="stat-card">
        <p class="stat-card-title">Credits Completed</p>
        <p class="stat-card-value" style="color: var(--success);">${state.transcript.completedCredits} Cr.</p>
      </div>
      <div class="stat-card">
        <p class="stat-card-title">Registered Semesters</p>
        <p class="stat-card-value" style="color: var(--warning);">${semCount}</p>
      </div>
    </div>

    <div class="card" style="margin-top: 1.5rem;">
      <h2 style="font-size: 1.25rem; font-weight: 700; color: var(--slate-800); margin-bottom: 1rem;">Official Academic Grade Sheet</h2>
      <div class="table-wrapper" id="transcript-table-container"></div>
    </div>
  `;

  const container = wrapper.querySelector('#transcript-table-container');
  if (state.transcript.records.length === 0) {
    container.innerHTML = `<p style="font-size: 0.875rem; color: var(--slate-400); text-align: center; padding: 1.5rem 0;">No academic grades published in this registry.</p>`;
  } else {
    const table = document.createElement('table');
    table.className = 'data-table';
    table.innerHTML = `
      <thead>
        <tr>
          <th>Semester</th>
          <th>Code</th>
          <th>Course Title</th>
          <th style="text-align: center;">Credits</th>
          <th style="text-align: center;">Mid Marks (40)</th>
          <th style="text-align: center;">Final Marks (60)</th>
          <th style="text-align: center;">Grade Points</th>
          <th style="text-align: center;">Letter Grade</th>
        </tr>
      </thead>
      <tbody id="transcript-rows"></tbody>
    `;

    const rows = table.querySelector('#transcript-rows');
    state.transcript.records.forEach(row => {
      let gpts = '0.00';
      if (row.letter_grade === 'A') gpts = '4.00';
      else if (row.letter_grade === 'B') gpts = '3.00';
      else if (row.letter_grade === 'C') gpts = '2.00';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight: 800; color: var(--slate-450);">${row.semester_code}</td>
        <td style="font-weight: 700; color: var(--primary);">${row.course_code}</td>
        <td style="font-weight: 600; color: var(--slate-800);">${row.course_title}</td>
        <td style="text-align: center;">${row.credits} Cr.</td>
        <td style="text-align: center;" class="font-mono-tag">${row.mid_marks !== null ? row.mid_marks : '—'}</td>
        <td style="text-align: center;" class="font-mono-tag">${row.final_marks !== null ? row.final_marks : '—'}</td>
        <td style="text-align: center; font-weight: 700;">${gpts}</td>
        <td style="text-align: center;">
          <span class="badge ${row.letter_grade === 'F' ? 'badge-danger' : 'badge-success'}">${row.letter_grade || 'F'}</span>
        </td>
      `;
      rows.appendChild(tr);
    });

    container.appendChild(table);
  }

  return wrapper;
}

// ========================================================
// FACULTY DASHBOARD VIEW RENDERERS
// ========================================================
function renderFacultyLayout() {
  const container = document.createElement('div');
  container.className = 'dashboard-layout';
  container.style.flexDirection = 'column';
  
  container.appendChild(renderHeader());

  const mainArea = document.createElement('div');
  mainArea.className = 'content-wrapper';
  mainArea.style.flex = '1';
  mainArea.style.display = 'flex';
  mainArea.style.flexDirection = 'column';
  mainArea.style.overflowY = 'auto';

  // Section Selector Bar
  const selectorBar = document.createElement('div');
  selectorBar.className = 'flex justify-between items-center';
  selectorBar.style.marginBottom = '1.5rem';
  
  selectorBar.innerHTML = `
    <div>
      <h1 style="font-size: 1.875rem; font-weight: 800; color: var(--slate-800); text-transform: uppercase;">Faculty Advising Gateway</h1>
      <p style="font-size: 0.875rem; color: var(--slate-500); margin-top: 0.25rem;">Select assigned class routines, record daily attendance, evaluate marks, and monitor performance graphs.</p>
    </div>
  `;

  const dropDownWrap = document.createElement('div');
  dropDownWrap.className = 'flex items-center';
  dropDownWrap.style.backgroundColor = 'white';
  dropDownWrap.style.padding = '0.5rem';
  dropDownWrap.style.border = '1px solid var(--slate-200)';
  dropDownWrap.style.borderRadius = 'var(--radius-2xl)';
  dropDownWrap.style.boxShadow = 'var(--shadow-sm)';
  dropDownWrap.innerHTML = `
    <label style="font-size: 0.75rem; font-weight: 700; color: var(--slate-400); text-transform: uppercase; margin-left: 0.5rem; margin-right: 0.5rem;">Class Section</label>
    <select id="faculty-section-select" class="modal-form-select" style="border: none; width: auto; font-weight: 600; cursor: pointer;"></select>
  `;

  selectorBar.appendChild(dropDownWrap);
  mainArea.appendChild(selectorBar);

  const subTabs = document.createElement('div');
  subTabs.id = 'faculty-subtabs';
  mainArea.appendChild(subTabs);

  const body = document.createElement('div');
  body.style.flex = '1';
  mainArea.appendChild(body);

  container.appendChild(mainArea);

  loadFacultySections(dropDownWrap.querySelector('#faculty-section-select'), subTabs, body);

  return container;
}

async function loadFacultySections(selectEl, subTabsEl, bodyEl) {
  try {
    state.sections = await apiFetch(`/courses/faculty/${state.user.id}`);
    
    selectEl.innerHTML = '';
    if (state.sections.length === 0) {
      selectEl.innerHTML = `<option value="">No Assigned Routines</option>`;
      bodyEl.innerHTML = `
        <div style="text-align: center; padding: 3rem 0; font-weight: 700; color: var(--slate-400); background-color: white; border: 1px solid var(--slate-100); border-radius: var(--radius-2xl);">
          No class sections assigned to your advisory profile for this term.
        </div>
      `;
      return;
    }

    state.sections.forEach(sec => {
      const opt = document.createElement('option');
      opt.value = sec.section_id;
      opt.innerText = `${sec.course_code} — Room ${sec.room_number} (${sec.day_of_week} ${sec.time_slot})`;
      selectEl.appendChild(opt);
    });

    if (!state.selectedSection) {
      state.selectedSection = state.sections[0].section_id;
    }
    selectEl.value = state.selectedSection;

    selectEl.onchange = (e) => {
      state.selectedSection = e.target.value;
      loadFacultySectionDetails(bodyEl);
    };

    // Build Sub Tabs
    subTabsEl.className = 'tab-container';
    subTabsEl.style.marginBottom = '1.5rem';
    subTabsEl.innerHTML = '';
    
    const subTabsList = [
      { id: 'grades', label: 'Grade Registry' },
      { id: 'attendance', label: 'Class Attendance' },
      { id: 'analytics', label: 'Performance Analytics' }
    ];

    subTabsList.forEach(t => {
      const btn = document.createElement('button');
      btn.className = `tab-btn ${state.activeSubTab === t.id ? 'active' : ''}`;
      btn.innerText = t.label;
      btn.onclick = () => {
        state.activeSubTab = t.id;
        checkAuthAndRoute();
      };
      subTabsEl.appendChild(btn);
    });

    loadFacultySectionDetails(bodyEl);
  } catch (err) {
    showToast(err.message, true);
  }
}

async function loadFacultySectionDetails(bodyEl) {
  bodyEl.innerHTML = `<div style="text-align: center; padding: 2rem 0; font-weight: 600; color: var(--slate-500);" class="animate-pulse">Syncing class records...</div>`;
  try {
    state.roster = await apiFetch(`/courses/roster/${state.selectedSection}`);
    state.attendanceReport = await apiFetch(`/courses/attendance/${state.selectedSection}`);
    state.analytics = await apiFetch(`/courses/analytics/${state.selectedSection}`);
    
    bodyEl.innerHTML = '';

    if (state.activeSubTab === 'grades') {
      bodyEl.appendChild(buildFacultyGradesView());
    } else if (state.activeSubTab === 'attendance') {
      bodyEl.appendChild(buildFacultyAttendanceView());
    } else if (state.activeSubTab === 'analytics') {
      bodyEl.appendChild(buildFacultyAnalyticsView());
    }
  } catch (err) {
    showToast(err.message, true);
  }
}

function buildFacultyGradesView() {
  const wrapper = document.createElement('div');
  wrapper.className = 'card';
  
  wrapper.innerHTML = `
    <h3 style="font-size: 1.25rem; font-weight: 700; color: var(--slate-800); margin-bottom: 1rem;">Student Marks Records (${state.roster.length} Enrolled)</h3>
    <div class="table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th>Student Name</th>
            <th style="width: 9rem;">Mid Marks (Max 40)</th>
            <th style="width: 9rem;">Final Marks (Max 60)</th>
            <th style="text-align: center; width: 7rem;">Letter Grade</th>
            <th style="text-align: center; width: 7rem;">Action</th>
          </tr>
        </thead>
        <tbody id="grades-rows"></tbody>
      </table>
    </div>
  `;

  const rows = wrapper.querySelector('#grades-rows');
  state.roster.forEach((student, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-weight: 600; color: var(--slate-800);">${student.student_name}</td>
      <td>
        <input type="number" id="mid-${student.enrollment_id}" max="40" min="0" step="0.5" value="${student.mid_marks !== null ? student.mid_marks : ''}" class="modal-form-input" style="width: 6rem;" />
      </td>
      <td>
        <input type="number" id="final-${student.enrollment_id}" max="60" min="0" step="0.5" value="${student.final_marks !== null ? student.final_marks : ''}" class="modal-form-input" style="width: 6rem;" />
      </td>
      <td style="text-align: center;">
        <span class="badge ${student.letter_grade === 'F' ? 'badge-danger' : 'badge-success'}">
          ${student.letter_grade || 'F'}
        </span>
      </td>
      <td style="text-align: center;" id="save-cell-${student.enrollment_id}"></td>
    `;

    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn-primary';
    saveBtn.style.padding = '0.375rem 0.75rem';
    saveBtn.style.fontSize = '0.75rem';
    saveBtn.innerText = 'Save';
    saveBtn.onclick = async () => {
      const mid = parseFloat(document.getElementById(`mid-${student.enrollment_id}`).value) || 0;
      const final = parseFloat(document.getElementById(`final-${student.enrollment_id}`).value) || 0;
      try {
        const res = await apiFetch('/courses/grade', {
          method: 'PUT',
          body: { enrollment_id: student.enrollment_id, mid_marks: mid, final_marks: final }
        });
        showToast(res.message || 'Saved successfully!');
        state.roster[index].mid_marks = mid;
        state.roster[index].final_marks = final;
        state.roster[index].letter_grade = res.grade;
        checkAuthAndRoute();
      } catch (err) {
        showToast(err.message || 'Failed to update grades.', true);
      }
    };

    tr.querySelector(`#save-cell-${student.enrollment_id}`).appendChild(saveBtn);
    rows.appendChild(tr);
  });

  return wrapper;
}

function buildFacultyAttendanceView() {
  const wrapper = document.createElement('div');
  wrapper.className = 'space-y-6';

  wrapper.innerHTML = `
    <div class="flex justify-between items-center card" style="padding: 1rem;">
      <div class="flex items-center space-x-3">
        <label style="font-size: 0.75rem; font-weight: 700; color: var(--slate-400); text-transform: uppercase;">Roll Date</label>
        <input type="date" id="att-date-picker" value="${state.attendanceDate}" class="modal-form-input" style="width: auto; cursor: pointer;" />
      </div>
      
      <button id="toggle-att-views" class="btn btn-secondary">
        ${state.viewAttendanceLog ? 'Take Attendance Checklist' : 'View Cumulative Attendance Report'}
      </button>
    </div>
    
    <div id="attendance-sub-body" style="margin-top: 1.5rem"></div>
  `;

  const datePicker = wrapper.querySelector('#att-date-picker');
  datePicker.onchange = (e) => {
    state.attendanceDate = e.target.value;
  };

  const toggleBtn = wrapper.querySelector('#toggle-att-views');
  toggleBtn.onclick = () => {
    state.viewAttendanceLog = !state.viewAttendanceLog;
    renderAttendanceSubBody(wrapper.querySelector('#attendance-sub-body'));
    toggleBtn.innerText = state.viewAttendanceLog ? 'Take Attendance Checklist' : 'View Cumulative Attendance Report';
  };

  renderAttendanceSubBody(wrapper.querySelector('#attendance-sub-body'));

  return wrapper;
}

function renderAttendanceSubBody(subContainer) {
  subContainer.innerHTML = '';
  
  if (state.viewAttendanceLog) {
    const reportBox = document.createElement('div');
    reportBox.className = 'card';
    reportBox.innerHTML = `
      <h3 style="font-size: 1.25rem; font-weight: 700; color: var(--slate-800); margin-bottom: 0.5rem;">Class Attendance Sheet</h3>
      <p style="font-size: 0.75rem; color: var(--slate-400); margin-bottom: 1.5rem;">Total lectures conducted this term: <span style="font-weight: 700; color: var(--primary);">${state.attendanceReport.totalSessions} Sessions</span></p>
      <div class="table-wrapper" id="att-report-table-wrap"></div>
    `;

    const tableWrap = reportBox.querySelector('#att-report-table-wrap');
    if (state.attendanceReport.records.length === 0) {
      tableWrap.innerHTML = `<p style="font-size: 0.875rem; color: var(--slate-400); text-align: center; padding: 1.5rem 0;">No attendance sessions registered for this section.</p>`;
    } else {
      const table = document.createElement('table');
      table.className = 'data-table';
      table.innerHTML = `
        <thead>
          <tr>
            <th>Student Name</th>
            <th style="text-align: center;">Sessions Present</th>
            <th style="text-align: center;">Total Classes</th>
            <th style="text-align: center;">Attendance Rate</th>
            <th style="text-align: center;">Status Clear</th>
          </tr>
        </thead>
        <tbody id="att-report-rows"></tbody>
      `;

      const rows = table.querySelector('#att-report-rows');
      state.attendanceReport.records.forEach(rec => {
        const rate = state.attendanceReport.totalSessions > 0 
          ? Math.round((rec.present_count / state.attendanceReport.totalSessions) * 100)
          : 0;
        const warning = rate < 75;

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td style="font-weight: 600; color: var(--slate-800);">${rec.student_name}</td>
          <td style="text-align: center; font-weight: 700;">${rec.present_count}</td>
          <td style="text-align: center;">${state.attendanceReport.totalSessions}</td>
          <td style="text-align: center; font-weight: 800; color: ${warning ? 'var(--danger)' : 'var(--success)'};">${rate}%</td>
          <td style="text-align: center;">
            <span class="badge ${warning ? 'badge-danger' : 'badge-success'}">
              ${warning ? 'Attendance Short' : 'Satisfactory'}
            </span>
          </td>
        `;
        rows.appendChild(tr);
      });
      tableWrap.appendChild(table);
    }
    subContainer.appendChild(reportBox);
  } else {
    // Take attendance form checklist view
    const formBox = document.createElement('form');
    formBox.className = 'card';
    
    const checklist = state.roster.map(st => ({
      student_id: st.student_id,
      student_name: st.student_name,
      status: 'Present'
    }));

    formBox.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
        <h3 style="font-size: 1.25rem; font-weight: 700; color: var(--slate-800);">Roll Checklist (${checklist.length} Students)</h3>
        <p style="font-size: 0.75rem; color: var(--slate-400); font-weight: 700; text-transform: uppercase;">Toggle badge status labels to mark Present/Absent</p>
      </div>
      <div class="table-wrapper" id="checklist-table-wrap"></div>
      <div style="display: flex; justify-content: flex-end; margin-top: 1.5rem;">
        <button type="submit" class="btn btn-success">
          Submit Daily Attendance Sheet
        </button>
      </div>
    `;

    const tableWrap = formBox.querySelector('#checklist-table-wrap');
    if (checklist.length === 0) {
      tableWrap.innerHTML = `<p style="font-size: 0.875rem; color: var(--slate-400); text-align: center; padding: 1.5rem 0;">No students are registered in this section.</p>`;
      formBox.querySelector('button[type="submit"]').className = 'hidden';
    } else {
      const table = document.createElement('table');
      table.className = 'data-table';
      table.innerHTML = `
        <thead>
          <tr>
            <th>Student ID</th>
            <th>Student Name</th>
            <th style="text-align: center;">Admittance Status</th>
          </tr>
        </thead>
        <tbody id="checklist-rows"></tbody>
      `;

      const rows = table.querySelector('#checklist-rows');
      checklist.forEach((student, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="font-mono-tag" style="font-size: 0.75rem;">${student.student_id}</td>
          <td style="font-weight: 600; color: var(--slate-800);">${student.student_name}</td>
          <td style="text-align: center;" id="toggle-cell-${student.student_id}"></td>
        `;

        const badge = document.createElement('button');
        badge.type = 'button';
        badge.className = 'btn btn-success';
        badge.style.padding = '0.375rem 1rem';
        badge.style.fontSize = '0.75rem';
        badge.style.borderRadius = 'var(--radius-full)';
        badge.innerText = 'Present';
        badge.onclick = () => {
          checklist[index].status = checklist[index].status === 'Present' ? 'Absent' : 'Present';
          badge.innerText = checklist[index].status;
          badge.className = `btn ${checklist[index].status === 'Present' ? 'btn-success' : 'btn-danger'}`;
          badge.style.borderRadius = 'var(--radius-full)';
          badge.style.padding = '0.375rem 1rem';
        };

        tr.querySelector(`#toggle-cell-${student.student_id}`).appendChild(badge);
        rows.appendChild(tr);
      });
      tableWrap.appendChild(table);
    }

    formBox.onsubmit = async (e) => {
      e.preventDefault();
      try {
        const payload = {
          section_id: state.selectedSection,
          date: state.attendanceDate,
          records: checklist.map(r => ({ student_id: r.student_id, status: r.status }))
        };
        const res = await apiFetch('/courses/attendance', {
          method: 'POST',
          body: payload
        });
        showToast(res.message || 'Attendance registered successfully!');
        state.attendanceReport = await apiFetch(`/courses/attendance/${state.selectedSection}`);
        state.viewAttendanceLog = true;
        checkAuthAndRoute();
      } catch (err) {
        showToast(err.message || 'Failed to submit attendance checklist.', true);
      }
    };

    subContainer.appendChild(formBox);
  }
}

function buildFacultyAnalyticsView() {
  const wrapper = document.createElement('div');
  wrapper.className = 'space-y-6';

  const m = state.analytics.metrics;
  const dist = state.analytics.distribution;

  wrapper.innerHTML = `
    <!-- metrics summary cards -->
    <div class="grid grid-cols-4">
      <div class="stat-card">
        <p class="stat-card-title">Class Average Marks</p>
        <p class="stat-card-value" style="color: var(--primary);">${m.class_average}%</p>
      </div>
      <div class="stat-card">
        <p class="stat-card-title">Highest Score Boundary</p>
        <p class="stat-card-value" style="color: var(--success);">${m.class_high}%</p>
      </div>
      <div class="stat-card">
        <p class="stat-card-title">Lowest Score Boundary</p>
        <p class="stat-card-value" style="color: var(--danger);">${m.class_low}%</p>
      </div>
      <div class="stat-card">
        <p class="stat-card-title">Students Graded</p>
        <p class="stat-card-value" style="color: var(--indigo);">${m.enrolled_count}</p>
      </div>
    </div>

    <!-- Custom CSS bar graph -->
    <div class="card" style="margin-top: 1.5rem">
      <h3 style="font-size: 1.25rem; font-weight: 700; color: var(--slate-800); margin-bottom: 1.5rem;">Grade Distribution Chart</h3>
      <div id="analytics-chart-container"></div>
    </div>
  `;

  const chartContainer = wrapper.querySelector('#analytics-chart-container');
  if (m.enrolled_count === 0) {
    chartContainer.innerHTML = `<p style="font-size: 0.875rem; color: var(--slate-400); text-align: center;">No grades submitted to compute grade frequencies.</p>`;
  } else {
    const listWrap = document.createElement('div');
    listWrap.style.display = 'flex';
    listWrap.style.flexDirection = 'column';
    listWrap.style.gap = '1rem';
    
    const gradesList = ['A', 'B', 'C', 'F'];
    gradesList.forEach(grade => {
      const count = dist[grade] || 0;
      const percentage = m.enrolled_count > 0 ? Math.round((count / m.enrolled_count) * 100) : 0;
      
      const row = document.createElement('div');
      row.className = 'chart-row';
      row.innerHTML = `
        <span class="chart-label">Grade ${grade}</span>
        <div class="chart-bar-bg">
          <div class="chart-bar-fill ${grade}" style="width: ${percentage}%"></div>
          ${percentage > 5 ? `<span class="chart-overlay-text">${count} Students (${percentage}%)</span>` : ''}
        </div>
        ${percentage <= 5 ? `<span class="chart-fallback-text">${count} (${percentage}%)</span>` : ''}
      `;
      listWrap.appendChild(row);
    });

    chartContainer.appendChild(listWrap);
  }

  return wrapper;
}

// ========================================================
// CORE APP ROUTER GATEWAY
// ========================================================
function checkAuthAndRoute() {
  const root = document.getElementById('root');
  root.innerHTML = '';
  
  renderToast();

  if (!state.user) {
    renderLogin();
  } else {
    if (state.user.role === 'admin') {
      root.appendChild(renderAdminLayout());
    } else if (state.user.role === 'student') {
      root.appendChild(renderStudentLayout());
    } else if (state.user.role === 'faculty') {
      root.appendChild(renderFacultyLayout());
    }
  }
}

// Start app routing loop on load
window.onload = checkAuthAndRoute;
window.checkAuthAndRoute = checkAuthAndRoute;
window.state = state;
