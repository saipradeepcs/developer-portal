// Zello Developer Portal - Frontend JavaScript

// Global state
let currentPage = 1;
let servicesPerPage = 12;
let currentFilters = {
    owner: '',
    language: '',
    status: '',
    search: ''
};

// Utility functions
function showMessage(message, type = 'success') {
    const messagesDiv = document.getElementById('messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = message;
    messagesDiv.appendChild(messageDiv);
    setTimeout(() => messageDiv.remove(), 5000);
}

function getCurrentPage() {
    const path = window.location.pathname;
    if (path === '/services') return 'services';
    if (path === '/analytics') return 'analytics';
    return 'dashboard';
}

// API Helper functions
async function fetchAPI(url, options = {}) {
    try {
        const response = await fetch(url, options);
        const data = await response.json();
        return { success: response.ok, data, status: response.status };
    } catch (error) {
        console.error('API Error:', error);
        return { success: false, error: error.message };
    }
}

// Dashboard functionality
function initDashboard() {
    loadQuickStats();
    loadRecentActivity();
    setupServiceSelectors();
    setupDashboardForms();
    
    // Auto-refresh stats every 30 seconds
    setInterval(loadQuickStats, 30000);
}

async function loadQuickStats() {
    const { success, data } = await fetchAPI('/api/services/status');
    if (!success) {
        console.error('Failed to load quick stats');
        return;
    }

    // Safely update elements
    const totalEl = document.getElementById('totalServices');
    const deployedEl = document.getElementById('deployedServices');
    const healthyEl = document.getElementById('healthyServices');
    const recentEl = document.getElementById('recentDeployments');

    if (totalEl) totalEl.textContent = data.summary?.total_services || 0;
    if (deployedEl) deployedEl.textContent = data.summary?.deployed_services || 0;
    if (healthyEl) healthyEl.textContent = data.summary?.healthy || 0;
    if (recentEl) recentEl.textContent = data.recent_deployments?.length || 0;
}

async function loadRecentActivity() {
    const activityDiv = document.getElementById('recentActivity');
    if (!activityDiv) return;

    activityDiv.innerHTML = '<div class="loading">Loading recent activity...</div>';

    const { success, data } = await fetchAPI('/api/analytics/overview');
    
    if (!success) {
        activityDiv.innerHTML = '<div class="error">Failed to load recent activity</div>';
        return;
    }

    const activities = data.recent_activity || [];
    if (activities.length === 0) {
        activityDiv.innerHTML = '<p>No recent activity</p>';
        return;
    }

    activityDiv.innerHTML = activities.slice(0, 5).map(activity => `
        <div class="activity-item">
            <div class="activity-icon ${activity.event_type}">
                ${getActivityIcon(activity.event_type)}
            </div>
            <div class="activity-details">
                <div class="activity-title">${formatActivityTitle(activity)}</div>
                <div class="activity-meta">${formatActivityTime(activity.created_at)}</div>
            </div>
        </div>
    `).join('');
}

function getActivityIcon(eventType) {
    const icons = {
        created: '➕',
        deployed: '🚀',
        updated: '✏️'
    };
    return icons[eventType] || '📝';
}

function formatActivityTitle(activity) {
    const data = activity.event_data || {};
    
    // Handle case where event_data might be a JSON string
    let eventData = data;
    if (typeof data === 'string') {
        try {
            eventData = JSON.parse(data);
        } catch (e) {
            eventData = {};
        }
    }
    
    switch (activity.event_type) {
        case 'created':
            return `New service "${eventData.name || 'Unknown'}" created by ${eventData.owner || 'Unknown'}`;
        case 'deployed':
            return `Service deployed version ${eventData.version || 'Unknown'}`;
        case 'updated':
            return `Service updated`;
        default:
            return `Service ${activity.event_type}`;
    }
}

function formatActivityTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    return `${diffDays} days ago`;
}

function setupDashboardForms() {
    // Service registration form
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const formData = {
                name: document.getElementById('serviceName').value,
                owner: document.getElementById('owner').value,
                language: document.getElementById('language').value,
                repo: document.getElementById('repo').value,
                description: document.getElementById('description')?.value || ''
            };
            
            const { success, data } = await fetchAPI('/api/services', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (success) {
                showMessage('Service registered successfully!');
                this.reset();
                loadQuickStats();
                setupServiceSelectors(); // Refresh selectors
            } else {
                showMessage(data.error || 'Failed to register service', 'error');
            }
        });
    }

    // Deployment form
    const deployForm = document.getElementById('deployForm');
    if (deployForm) {
        deployForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const serviceName = document.getElementById('deployService').value;
            const version = document.getElementById('version').value;
            
            const { success, data } = await fetchAPI(`/api/services/${serviceName}/deploy`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ version })
            });

            if (success) {
                showMessage(`Successfully deployed ${serviceName} version ${version}!`);
                this.reset();
                loadQuickStats();
            } else {
                showMessage(data.error || 'Failed to deploy service', 'error');
            }
        });
    }

    // Next steps form
    const nextStepsForm = document.getElementById('nextStepsForm');
    if (nextStepsForm) {
        nextStepsForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const serviceName = document.getElementById('nextStepsService').value;
            
            const { success, data } = await fetchAPI(`/api/services/${serviceName}/next-steps`);
            const resultDiv = document.getElementById('nextStepsResult');
            
            if (success && resultDiv) {
                resultDiv.innerHTML = `
                    <div class="next-steps">
                        <h3>📋 Next Steps for ${serviceName}</h3>
                        <ul>
                            ${data.next_steps.map(step => `<li>${step}</li>`).join('')}
                        </ul>
                        ${data.templates ? `
                            <h4>📄 Template Links:</h4>
                            <ul>
                                ${Object.entries(data.templates).map(([name, url]) => 
                                    `<li><a href="${url}" target="_blank">${name}</a></li>`
                                ).join('')}
                            </ul>
                        ` : ''}
                    </div>
                `;
            } else if (resultDiv) {
                resultDiv.innerHTML = `<div class="error">Failed to get next steps</div>`;
            }
        });
    }
}

// Services page functionality
function initServices() {
    loadFilters();
    loadServices();
    setupServiceFilters();
    setupServiceSearch();
    setupViewToggle();
    setupServiceModal();
    
    // Auto-refresh services every 30 seconds
    setInterval(() => loadServices(), 30000);
}

async function loadFilters() {
    const { success, data } = await fetchAPI('/api/filters');
    if (!success) return;

    updateSelectOptions('ownerFilter', data.owners || []);
    updateSelectOptions('languageFilter', data.languages || []);
}

async function loadServices() {
    const params = new URLSearchParams({
        page: currentPage.toString(),
        per_page: servicesPerPage.toString(),
        ...currentFilters
    });

    // Remove empty filters
    for (const [key, value] of [...params.entries()]) {
        if (!value) params.delete(key);
    }

    const { success, data } = await fetchAPI(`/api/services?${params}`);
    
    const servicesList = document.getElementById('servicesList');
    const servicesCount = document.getElementById('servicesCount');
    
    if (!success) {
        if (servicesList) servicesList.innerHTML = '<div class="error">Failed to load services</div>';
        return;
    }

    if (servicesCount) {
        const total = data.total || 0;
        const showing = data.services?.length || 0;
        servicesCount.textContent = `Showing ${showing} of ${total} services`;
    }

    if (servicesList) {
        if (!data.services || data.services.length === 0) {
            servicesList.innerHTML = '<div class="loading">No services found matching the current filters.</div>';
        } else {
            servicesList.innerHTML = data.services.map(service => `
                <div class="service-card" data-service-name="${service.name}">
                    <div class="service-status status-${service.status}">
                        ${service.status}
                    </div>
                    <div class="service-name">${service.name}</div>
                    <div class="service-details">
                        <span><strong>Owner:</strong> ${service.owner}</span>
                        <span><strong>Language:</strong> ${service.language}</span>
                        <span><strong>Repository:</strong> <a href="${service.repo}" target="_blank" onclick="event.stopPropagation()">View Repo</a></span>
                    </div>
                    ${service.description ? `
                        <div class="service-description">${service.description}</div>
                    ` : ''}
                    ${service.deployed_version ? `
                        <div class="deployment-section">
                            <strong>🚀 Current Deployment:</strong> ${service.deployed_version}
                            <br><small>Deployed: ${new Date(service.deployed_at).toLocaleString()}</small>
                        </div>
                    ` : ''}
                </div>
            `).join('');
        }
    }

    updatePagination(data);
}

function updatePagination(data) {
    const pagination = document.getElementById('pagination');
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');
    const pageInfo = document.getElementById('pageInfo');

    if (!pagination) return;

    const totalPages = data.pages || 1;
    const hasMultiplePages = totalPages > 1;

    pagination.style.display = hasMultiplePages ? 'flex' : 'none';

    if (prevBtn) {
        prevBtn.disabled = currentPage === 1;
        prevBtn.onclick = () => {
            if (currentPage > 1) {
                currentPage--;
                loadServices();
            }
        };
    }

    if (nextBtn) {
        nextBtn.disabled = currentPage === totalPages;
        nextBtn.onclick = () => {
            if (currentPage < totalPages) {
                currentPage++;
                loadServices();
            }
        };
    }

    if (pageInfo) {
        pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    }
}

function setupServiceFilters() {
    ['ownerFilter', 'languageFilter', 'statusFilter'].forEach(filterId => {
        const filterElement = document.getElementById(filterId);
        if (filterElement) {
            filterElement.addEventListener('change', (e) => {
                const filterKey = filterId.replace('Filter', '');
                currentFilters[filterKey] = e.target.value;
                currentPage = 1; // Reset to first page
                loadServices();
            });
        }
    });
}

function setupServiceSearch() {
    const searchInput = document.getElementById('searchServices');
    const clearBtn = document.getElementById('clearSearch');
    
    if (searchInput) {
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                currentFilters.search = e.target.value;
                currentPage = 1;
                loadServices();
            }, 300);
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            currentFilters.search = '';
            currentPage = 1;
            loadServices();
        });
    }
}

function setupViewToggle() {
    const gridBtn = document.getElementById('gridViewBtn');
    const listBtn = document.getElementById('listViewBtn');
    const container = document.getElementById('servicesList');

    if (gridBtn && listBtn && container) {
        gridBtn.addEventListener('click', () => {
            container.className = 'services-container grid-view';
            gridBtn.classList.add('active');
            listBtn.classList.remove('active');
        });

        listBtn.addEventListener('click', () => {
            container.className = 'services-container list-view';
            listBtn.classList.add('active');
            gridBtn.classList.remove('active');
        });
    }
}

function setupServiceModal() {
    const modal = document.getElementById('serviceModal');
    const closeBtn = document.getElementById('closeModal');
    const servicesList = document.getElementById('servicesList');

    if (modal && closeBtn && servicesList) {
        // Close modal handlers
        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });

        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });

        // Service card click handler
        servicesList.addEventListener('click', async (e) => {
            const serviceCard = e.target.closest('.service-card');
            if (!serviceCard) return;

            const serviceName = serviceCard.dataset.serviceName;
            if (!serviceName) return;

            await showServiceModal(serviceName);
        });
    }
}

async function showServiceModal(serviceName) {
    const modal = document.getElementById('serviceModal');
    const modalTitle = document.getElementById('modalServiceName');
    const modalBody = document.getElementById('modalBody');

    if (!modal || !modalTitle || !modalBody) return;

    // Show modal with loading state
    modalTitle.textContent = serviceName;
    modalBody.innerHTML = '<div class="loading">Loading service details...</div>';
    modal.style.display = 'block';

    // Load service events
    const { success, data } = await fetchAPI(`/api/services/${serviceName}/events`);
    
    if (success) {
        modalBody.innerHTML = `
            <div class="service-details-modal">
                <h4>📋 Service Events</h4>
                <div class="events-list">
                    ${data.events.map(event => `
                        <div class="activity-item">
                            <div class="activity-icon ${event.event_type}">
                                ${getActivityIcon(event.event_type)}
                            </div>
                            <div class="activity-details">
                                <div class="activity-title">${formatActivityTitle(event)}</div>
                                <div class="activity-meta">${formatActivityTime(event.created_at)}</div>
                            </div>
                        </div>
                    `).join('') || '<p>No events found</p>'}
                </div>
            </div>
        `;
    } else {
        modalBody.innerHTML = '<div class="error">Failed to load service details</div>';
    }
}

// Analytics page functionality
function initAnalytics() {
    loadAnalyticsData();
    setupAnalyticsFilters();
    
    // Auto-refresh every 60 seconds
    setInterval(loadAnalyticsData, 60000);
}

async function loadAnalyticsData() {
    const { success, data } = await fetchAPI('/api/analytics/overview');
    if (!success) {
        console.error('Failed to load analytics data');
        return;
    }

    // Update stats
    const stats = data.deployment_stats || {};
    const summary = data.summary || {};
    
    const totalEl = document.getElementById('totalServicesAnalytics');
    const deployedEl = document.getElementById('deployedServicesAnalytics');
    const healthyEl = document.getElementById('healthyServicesAnalytics');
    const teamsEl = document.getElementById('teamsCount');

    if (totalEl) totalEl.textContent = summary.total_services || 0;
    if (deployedEl) deployedEl.textContent = stats.deployed_services || 0;
    if (healthyEl) healthyEl.textContent = summary.healthy || 0;
    if (teamsEl) teamsEl.textContent = Object.keys(data.team_distribution || {}).length;

    // Charts removed from analytics page

    // Update activity
    updateActivityList(data.recent_activity || []);
}

// updateChart removed

function updateActivityList(activities) {
    const activityList = document.getElementById('activityList');
    if (!activityList) return;

    if (activities.length === 0) {
        activityList.innerHTML = '<div class="loading">No recent activity</div>';
        return;
    }

    activityList.innerHTML = activities.map(activity => `
        <div class="activity-item">
            <div class="activity-icon ${activity.event_type}">
                ${getActivityIcon(activity.event_type)}
            </div>
            <div class="activity-details">
                <div class="activity-title">${formatActivityTitle(activity)}</div>
                <div class="activity-meta">${formatActivityTime(activity.created_at)}</div>
            </div>
        </div>
    `).join('');
}

function setupAnalyticsFilters() {
    // Placeholder for analytics filters
    const activityFilter = document.getElementById('activityFilter');
    const activityPeriod = document.getElementById('activityPeriod');

    if (activityFilter) {
        activityFilter.addEventListener('change', loadAnalyticsData);
    }

    if (activityPeriod) {
        activityPeriod.addEventListener('change', loadAnalyticsData);
    }
}

// Common functionality
async function setupServiceSelectors() {
    const { success, data } = await fetchAPI('/api/services');
    if (!success) return;

    const services = data.services || [];
    updateSelectOptions('deployService', services.map(s => s.name));
    updateSelectOptions('nextStepsService', services.map(s => s.name));
}

function updateSelectOptions(selectId, options) {
    const select = document.getElementById(selectId);
    if (!select) return;
    
    const currentValue = select.value;
    
    // Keep the first option (usually "All..." or "Select...")
    while (select.children.length > 1) {
        select.removeChild(select.lastChild);
    }
    
    options.forEach(option => {
        if (option) {
            const optionElement = document.createElement('option');
            optionElement.value = option;
            optionElement.textContent = option;
            select.appendChild(optionElement);
        }
    });
    
    select.value = currentValue;
}

// Initialize the application
function initializeApp() {
    const page = getCurrentPage();
    
    switch (page) {
        case 'services':
            initServices();
            break;
        case 'analytics':
            initAnalytics();
            break;
        default:
            initDashboard();
    }
}

// Wait for DOM to be fully loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}