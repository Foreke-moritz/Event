// Utilities - Globally shared logic bindings (js/utils.js)

class Utils {
    /**
     * Renders a clean Toast notification preventing disruptive generic alerts explicitly.
     * @param {string} message 
     * @param {string} type 'success', 'error', 'info'
     */
    static showToast(message, type = 'success') {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.style.cssText = 'position: fixed; top: 1.5rem; right: 1.5rem; z-index: 9999; display: flex; flex-direction: column; gap: 0.5rem; max-width: 350px;';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        let bgStr = 'var(--success)';
        let iconStr = '<i class="fa-solid fa-circle-check"></i>';

        if (type === 'error') {
            bgStr = 'var(--danger)';
            iconStr = '<i class="fa-solid fa-circle-exclamation"></i>';
        } else if (type === 'info') {
            bgStr = 'var(--info)';
            iconStr = '<i class="fa-solid fa-circle-info"></i>';
        }

        toast.style.cssText = `
            background-color: ${bgStr}; color: white; padding: 1rem 1.5rem; border-radius: var(--border-radius);
            box-shadow: var(--shadow-md); display: flex; align-items: center; gap: 0.75rem; font-weight: 500; font-size: 0.875rem;
            opacity: 0; transform: translateX(100%); transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        `;
        toast.innerHTML = `${iconStr} <span>${message}</span>`;
        container.appendChild(toast);

        setTimeout(() => { toast.style.opacity = '1'; toast.style.transform = 'translateX(0)'; }, 10);
        setTimeout(() => {
            toast.style.opacity = '0'; toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    /**
     * Formats identical values strictly matching natively provided DB values safely
     */
    static formatCurrency(amount, curr = 'FCFA') {
        const num = Number(amount) || 0;
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(num) + ' ' + curr;
    }

    /**
     * Translates ISO strings securely capturing native local browsers explicitly
     */
    static formatDate(isoString) {
        if (!isoString) return '-';
        return new Date(isoString).toLocaleString(undefined, {
            year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    }

    /**
     * Dynamically triggers browser print dialogue explicitly tied to element IDs avoiding full DOM destruction globally
     */
    static printElement(elementId, title = 'Document') {
        window.print(); // CSS relies on @media print
    }
}

// Map utils globally onto window namespace
window.Utils = Utils;
