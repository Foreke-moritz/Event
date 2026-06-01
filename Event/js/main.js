// Global setup and utilities

document.addEventListener('DOMContentLoaded', () => {
    // Mobile sidebar toggle
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');

    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('show');
        });
    }

    // Set active link based on current path safely guarding root
    const navLinks = document.querySelectorAll('.nav-item');
    const currentPath = window.location.pathname;
    
    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href && currentPath.includes(href) && href !== '') {
            link.classList.add('active');
        }
    });
});

// Format Currency Utility safely defaulting to FCFA formatting dynamically or generic number
function formatCurrency(amount, currencySymbol = 'FCFA') {
    const num = Number(amount) || 0;
    // Format large numbers cleanly matching standard Locale formats. Using a fallback generic formatter.
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(num) + ' ' + currencySymbol;
}

// Global Toast Notification System injecting straight into body
function showMessage(msg, isError = false) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = 'position: fixed; top: 1rem; right: 1rem; z-index: 9999; display: flex; flex-direction: column; gap: 0.5rem; max-width: 350px;';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const bg = isError ? 'var(--danger)' : 'var(--success)';
    const icon = isError ? '<i class="fa-solid fa-circle-exclamation"></i>' : '<i class="fa-solid fa-circle-check"></i>';
    
    toast.style.cssText = `
        background-color: ${bg};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: var(--border-radius);
        box-shadow: var(--shadow-md);
        display: flex;
        align-items: center;
        gap: 0.75rem;
        font-weight: 500;
        font-size: 0.875rem;
        opacity: 0;
        transform: translateX(100%);
        transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
    `;
    
    toast.innerHTML = `${icon} <span>${msg}</span>`;
    container.appendChild(toast);

    // Trigger animation
    setTimeout(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(0)';
    }, 10);

    // Auto cleanup
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// Convert native database isoDate strings to Localized strings identically shared
function formatDateString(isoString) {
    if (!isoString) return '-';
    return new Date(isoString).toLocaleString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
}
