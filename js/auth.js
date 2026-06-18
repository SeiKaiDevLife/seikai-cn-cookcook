document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const submitBtn = loginForm.querySelector('.primary-btn') || loginForm.querySelector('button');

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const usernameInput = document.getElementById('username').value.trim().toLowerCase();
        
        if (usernameInput !== 'seikai' && usernameInput !== 'echo') {
            alert('用户名不正确，只允许 seikai 或 echo 登录！');
            return;
        }
        
        // Add loading state
        if (submitBtn) submitBtn.classList.add('loading');
        
        // Simulate API call
        setTimeout(() => {
            if (submitBtn) submitBtn.classList.remove('loading');
            
            // Store the actual username
            localStorage.setItem('cookcook_user', usernameInput);
            
            // Redirect to home page
            window.location.href = 'home.html';
        }, 800);
    });
});
