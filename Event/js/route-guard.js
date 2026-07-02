// Route Guard - STRICT ISOLATION SECURED
// Re-written firmly bounding cross-directory manipulation natively directly avoiding complex routers

class RouteGuard {
    static async enforceBoundary() {
        if (!window.supabase) {
            console.error("RouteGuard: Supabase completely missing!");
            const lock = document.getElementById('rg-lock'); if(lock) lock.remove();
            return;
        }

        const currentPath = window.location.pathname.toLowerCase();
        
        const isPublicPath = currentPath.endsWith('login.html') || 
                             currentPath.endsWith('register.html') || 
                             currentPath.endsWith('forgot-password.html') || 
                             currentPath.endsWith('index.html') || 
                             currentPath.endsWith('/') || 
                             currentPath === '';

        const isAdminPath = currentPath.includes('/admin/');
        const isStaffPath = currentPath.includes('/staff/');

        const { data: { session } } = await supabase.auth.getSession();
        
        // --- Not Logged In ---
        if (!session) {
            if (isAdminPath || isStaffPath) {
                const depthFix = currentPath.split('/').length > 2 ? '../' : './';
                window.location.replace(`${depthFix}login.html`);
            } else {
                const lock = document.getElementById('rg-lock'); if(lock) lock.remove(); // Safe to view public
            }
            return;
        }
        
        // --- Active Session Resolving ---
        
        // Query Profiles identically enforcing specific `is_active` security!
        const { data: profile } = await supabase.from('profiles').select('role, is_active').eq('id', session.user.id).single();
        
        if (!profile || !profile.is_active) {
            await supabase.auth.signOut();
            const depthFix = (isAdminPath || isStaffPath) ? '../' : './';
            window.location.replace(`${depthFix}login.html`);
            return;
        }

        const role = profile.role || 'user'; // 'admin' or 'staff'
        const depthFix = (isAdminPath || isStaffPath) ? '../' : './';

        // 1. Logged in Users hitting Public bounds (e.g., login.html)
        if (isPublicPath) {
            if (role === 'admin') window.location.replace('admin/dashboard.html');
            else window.location.replace('staff/dashboard.html');
            return;
        }

        // 2. Intrusions Resolving
        if (isAdminPath && role !== 'admin') {
            window.location.replace('../staff/dashboard.html');
            return;
        }

        if (isStaffPath && role === 'admin') {
            window.location.replace('../admin/dashboard.html');
            return;
        }

        // --- Execute global metadata injection explicitly ---
        // Dynamically populates UI elements if they exist universally
        const nameDisplay = document.getElementById('topUserName');
        const roleDisplay = document.getElementById('topUserRole');
        const avatarDisplay = document.getElementById('avatarDisplay');
        const bizNameDisplay = document.getElementById('sidebarBizName');
        const nameRaw = session.user.user_metadata?.full_name || 'User';

        if(nameDisplay) nameDisplay.textContent = nameRaw;
        if(roleDisplay) {
            roleDisplay.textContent = role === 'admin' ? 'Admin' : 'Staff';
            roleDisplay.className = role === 'admin' ? 'badge badge-success' : 'badge badge-info';
        }
        if(avatarDisplay) avatarDisplay.textContent = nameRaw.charAt(0).toUpperCase();

        if (bizNameDisplay) {
            // Find Business name locally. For staff, it matches the admin_id's business_name.
            // Rather than query aggressively, we simply write "CoreInventory" universally unless specified.
            // Or extract from auth metadata directly via profiles.
            const { data: bmeta } = await supabase.from('profiles').select('business_name').eq('id', role === 'admin' ? session.user.id : profile.admin_id).single();
            if(bmeta && bmeta.business_name) bizNameDisplay.textContent = bmeta.business_name;
        }

        const lock = document.getElementById('rg-lock'); if(lock) lock.remove(); // Release native lock explicitly permitting rendering
    }
}

document.write('<style id="rg-lock">body { display: none !important; }</style>');
document.addEventListener('DOMContentLoaded', RouteGuard.enforceBoundary);
