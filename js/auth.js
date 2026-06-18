document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const submitBtn = loginForm.querySelector('.btn-primary');

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        // Add loading state
        submitBtn.classList.add('loading');
        
        // Simulate API call
        setTimeout(() => {
            submitBtn.classList.remove('loading');
            // Store a fake token or user info
            localStorage.setItem('cookcook_user', JSON.stringify({
                name: '测试用户',
                avatar: 'public/avatars/default.png'
            }));
            
            // Redirect to home page
            window.location.href = 'home.html';
        }, 1200);
    });
});
