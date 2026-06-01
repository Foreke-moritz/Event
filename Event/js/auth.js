// Auth - Connecting strictly natively tying Forms securely directly validating via Toast mechanisms (js/auth.js)

document.addEventListener('DOMContentLoaded', () => {
    if (!window.supabase) return;

    // -------------- LOGIN LOGIC --------------
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('lEmail').value.trim();
            const password = document.getElementById('lPassword').value;

            if (!email || !password) {
                Utils.showToast("All fields are required.", "error");
                return;
            }

            const btn = document.getElementById('btnLogin');
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner"></span> Authenticating...';

            const { data, error } = await supabase.auth.signInWithPassword({ email, password });

            if (error) {
                Utils.showToast(error.message, "error");
                btn.disabled = false;
                btn.innerHTML = 'Sign In';
                return;
            }

            // Immediately explicitly evaluate the profiles table resolving inactivity securely
            const { data: profile, error: pError } = await supabase.from('profiles').select('is_active, role').eq('id', data.user.id).single();

            if (pError || !profile) {
                await supabase.auth.signOut();
                Utils.showToast("Account metadata corrupted. Contact support.", "error");
                btn.disabled = false;
                btn.innerHTML = 'Sign In';
                return;
            }

            if (!profile.is_active) {
                await supabase.auth.signOut();
                Utils.showToast("Your account has been disabled. Please contact your business admin.", "error");
                btn.disabled = false;
                btn.innerHTML = 'Sign In';
                return;
            }

            // Route securely strictly via explicit Role checking organically bypassing complex states natively
            Utils.showToast("Login Successful!", "success");
            setTimeout(() => {
                if (profile.role === 'admin') window.location.href = 'admin/dashboard.html';
                else window.location.href = 'user/dashboard.html';
            }, 800);
        });
    }

    // -------------- REGISTER LOGIC --------------
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('rFullName').value.trim();
            const biz = document.getElementById('rBusinessName').value.trim();
            const phone = document.getElementById('rPhone').value.trim();
            const email = document.getElementById('rEmail').value.trim();
            const pass = document.getElementById('rPassword').value;
            const confirm = document.getElementById('rConfirmPassword').value;

            if (!name || !biz || !phone || !email || !pass || !confirm) {
                Utils.showToast("All fields are required.", "error");
                return;
            }

            if (pass !== confirm) {
                Utils.showToast("Passwords do not match.", "error");
                return;
            }
            if (pass.length < 6) {
                Utils.showToast("Password must be at least 6 characters.", "error");
                return;
            }

            const btn = document.getElementById('btnRegister');
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner"></span> Creating Account...';

            // By default, this registers a business Admin, safely passing explicitly to user_metadata trigger
            const { data, error } = await supabase.auth.signUp({
                email, password: pass,
                options: {
                    data: {
                        full_name: name,
                        business_name: biz,
                        phone: phone,
                        role: 'admin' // The DB trigger natively intercepts this generating admin directly securely
                    }
                }
            });

            if (error) {
                Utils.showToast(error.message, "error");
                btn.disabled = false;
                btn.innerHTML = 'Create Admin Account';
                return;
            }

            // Check if email confirmation is required by Supabase
            if (data?.user && !data?.session) {
                Utils.showToast("Registration successful! Please check your email to verify your account.", "success", 6000);
                setTimeout(() => { window.location.href = 'login.html'; }, 3000);
                return;
            }

            Utils.showToast("Registration successful! Initializing Dashboard...", "success");
            setTimeout(() => {
                window.location.href = 'admin/dashboard.html';
            }, 1000);
        });
    }

    // -------------- FORGOT PASSWORD LOGIC --------------
    const forgotForm = document.getElementById('forgotForm');
    if (forgotForm) {
        forgotForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('fEmail').value.trim();
            if (!email) return;

            const btn = document.getElementById('btnForgot');
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner"></span> Processing...';

            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin + '/login.html'
            });

            if (error) {
                Utils.showToast(error.message, "error");
                btn.disabled = false;
                btn.innerHTML = 'Send Reset Link';
            } else {
                Utils.showToast("Password reset email sent!", "success");
                setTimeout(() => { window.location.href = 'login.html'; }, 2000);
            }
        });
    }

});

// Global Function natively tracking logging out dynamically natively executing
window.handleLogout = async () => {
    if(!window.supabase) return;
    try {
        await supabase.auth.signOut();
        // Determine routing bounce properly
        const path = window.location.pathname;
        if(path.includes('/admin/') || path.includes('/user/')) window.location.replace('../login.html');
        else window.location.replace('login.html');
    } catch(err) {
        window.location.replace('../login.html');
    }
};
