document.addEventListener('DOMContentLoaded', () => {
    // Check Authentication
    const userStr = localStorage.getItem('cookcook_user');
    if (!userStr) {
        window.location.href = 'index.html';
        return;
    }
    
    const currentUser = JSON.parse(userStr);
    // Top nav elements
    const searchInput = document.getElementById('searchInput');
    const sortBtns = document.querySelectorAll('.sort-btn');
    const recipeGrid = document.getElementById('recipeGrid');

    // Tab Switching Logic
    const tabItems = document.querySelectorAll('.tab-item:not(.publish-tab)');
    const viewSections = document.querySelectorAll('.view-section');

    tabItems.forEach(tab => {
        tab.addEventListener('click', () => {
            tabItems.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            viewSections.forEach(v => v.classList.remove('active'));
            const targetView = document.getElementById(tab.dataset.view);
            if (targetView) targetView.classList.add('active');
        });
    });

    // Profile handling (mocked for now, logout could be placed in Profile view later)
    // Removed old top navbar user profile references to match new UI

    // Load Data
    let recipes = window.RECIPE_DATA || [];
    let currentSort = 'default';
    let searchQuery = '';

    const modal = document.getElementById('recipeModal');
    const closeModalBtn = document.getElementById('closeModal');
    const recipeDetailContainer = document.getElementById('recipeDetailContainer');

    function renderRecipes() {
        let filtered = recipes.filter(r => r.name.includes(searchQuery));
        
        if (currentSort === 'time') {
            filtered.sort((a, b) => new Date(b.createTime) - new Date(a.createTime));
        } else if (currentSort === 'hot') {
            // Placeholder: no actual hotness data in Phase 1 as per requirements
        }

        recipeGrid.innerHTML = '';
        
        if (filtered.length === 0) {
            recipeGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted);">暂无找到相关菜谱</div>';
            return;
        }

        filtered.forEach(recipe => {
            const card = document.createElement('div');
            card.className = 'recipe-card';
            
            // Generate difficulty stars
            let starsHtml = '';
            for (let i = 0; i < recipe.difficulty; i++) {
                starsHtml += '<i class="fa-solid fa-star" style="color: #f59e0b;"></i>';
            }

            // Default avatars for hardcoded users
            let authorAvatar = recipe.author === 'echo' ? 'public/avatars/echo.webp' : 'public/avatars/seikai.webp';

            card.innerHTML = `
                <div class="recipe-cover-wrap">
                    <img src="${recipe.coverUrl}" alt="${recipe.name}" class="recipe-cover">
                    <div class="cover-duration"><i class="fa-regular fa-clock"></i> ${recipe.durationMin}min</div>
                </div>
                <div class="recipe-info">
                    <h3 class="recipe-title">${recipe.name}</h3>
                    <div class="recipe-meta">
                        <div class="recipe-author">
                            <img src="${authorAvatar}" alt="author">
                            <span>${recipe.author}</span>
                        </div>
                        <div class="recipe-stats">
                            ${starsHtml}
                        </div>
                    </div>
                </div>
            `;
            card.addEventListener('click', () => openRecipe(recipe));
            recipeGrid.appendChild(card);
        });
    }

    // Search and Sort Event Listeners
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.trim();
        renderRecipes();
    });

    sortBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            sortBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentSort = e.target.dataset.sort;
            renderRecipes();
        });
    });

    // Modal logic
    function openRecipe(recipe) {
        let ingredientsHtml = '';
        if (recipe.materials && recipe.materials.ingredients) {
            ingredientsHtml += recipe.materials.ingredients.map(ing => `
                <div class="ingredient-item">
                    <span>${ing.name}</span>
                    <span class="amount">${ing.amount}</span>
                </div>
            `).join('');
        }

        let seasoningsHtml = '';
        if (recipe.materials && recipe.materials.seasonings) {
            seasoningsHtml += recipe.materials.seasonings.map(s => `
                <div class="ingredient-item">
                    <span>${s}</span>
                </div>
            `).join('');
        }

        const typeLabels = {
            'prep': '备菜',
            'cook': '烧菜',
            'timer': '计时',
            'judge': '判断'
        };

        let stepsHtml = recipe.steps.map((step, idx) => {
            let mediaHtml = '';
            if (step.media) {
                if (step.media.endsWith('.mp4')) {
                    mediaHtml = `<video src="${step.media}" controls class="step-media"></video>`;
                } else {
                    mediaHtml = `<img src="${step.media}" alt="Step ${idx+1}" class="step-media">`;
                }
            }
            
            let timerHtml = step.type === 'timer' && step.timerSeconds ? ` <span style="color: #60a5fa;"><i class="fa-regular fa-clock"></i> ${Math.floor(step.timerSeconds / 60)}分${step.timerSeconds % 60}秒</span>` : '';

            return `
                <div class="step-item type-${step.type}">
                    <h4>步骤 ${idx + 1} <span style="font-size: 0.8rem; font-weight: normal; margin-left: 0.5rem; opacity: 0.8;">[${typeLabels[step.type]}]</span></h4>
                    <p>${step.content}${timerHtml}</p>
                    ${mediaHtml}
                </div>
            `;
        }).join('');

        let authorAvatar = recipe.author === 'echo' ? 'public/avatars/echo.webp' : 'public/avatars/seikai.webp';

        let tutorialsHtml = '';
        if (recipe.tutorials && recipe.tutorials.urls) {
            recipe.tutorials.urls.forEach(url => {
                if (recipe.tutorials.type === 'video') {
                    tutorialsHtml += `<video src="${url}" controls class="step-media" style="margin-bottom:1rem;"></video>`;
                } else {
                    tutorialsHtml += `<img src="${url}" class="step-media" style="margin-bottom:1rem;">`;
                }
            });
        }

        recipeDetailContainer.innerHTML = `
            <img src="${recipe.coverUrl}" class="detail-cover">
            <div class="detail-body">
                <h2 class="detail-title">${recipe.name}</h2>
                <div class="detail-meta">
                    <div class="recipe-author">
                        <img src="${authorAvatar}" alt="author">
                        <span>${recipe.author}</span>
                    </div>
                    <span><i class="fa-regular fa-clock"></i> 耗时: ${recipe.durationMin} 分钟</span>
                    <span><i class="fa-solid fa-fire"></i> 难度: ${recipe.difficulty} 星</span>
                    <span><i class="fa-solid fa-calendar"></i> ${recipe.createTime}</span>
                </div>
                
                ${tutorialsHtml ? `
                <div class="detail-section">
                    <h3>参考教程</h3>
                    <div class="tutorials-container">
                        ${tutorialsHtml}
                    </div>
                </div>
                ` : ''}
                
                <div class="detail-section">
                    <h3>食材清单</h3>
                    <div class="ingredient-list">
                        ${ingredientsHtml}
                    </div>
                </div>

                <div class="detail-section">
                    <h3>所需佐料</h3>
                    <div class="ingredient-list">
                        ${seasoningsHtml}
                    </div>
                </div>
                
                <div class="detail-section">
                    <h3>制作步骤</h3>
                    <div class="steps-list">
                        ${stepsHtml}
                    </div>
                </div>
            </div>
        `;
        
        modal.classList.add('show');
    }

    closeModalBtn.addEventListener('click', () => {
        modal.classList.remove('show');
        // Pause any playing videos
        const videos = modal.querySelectorAll('video');
        videos.forEach(v => v.pause());
    });

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModalBtn.click();
        }
    });

    // Init
    renderRecipes();
});
