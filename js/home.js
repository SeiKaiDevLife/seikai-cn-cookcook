document.addEventListener('DOMContentLoaded', () => {
    // Check Authentication
    const userStr = localStorage.getItem('cookcook_user');
    if (!userStr) {
        window.location.href = 'index.html';
        return;
    }
    
    const user = JSON.parse(userStr);
    document.getElementById('userName').textContent = user.name;
    document.getElementById('userAvatar').src = user.avatar;

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('cookcook_user');
        window.location.href = 'index.html';
    });

    // Load Data
    let recipes = window.RECIPE_DATA || [];
    let currentSort = 'default';
    let searchQuery = '';

    const recipeGrid = document.getElementById('recipeGrid');
    const searchInput = document.getElementById('searchInput');
    const sortBtns = document.querySelectorAll('.sort-btn');
    const modal = document.getElementById('recipeModal');
    const closeModalBtn = document.getElementById('closeModal');
    const recipeDetailContainer = document.getElementById('recipeDetailContainer');

    function renderRecipes() {
        let filtered = recipes.filter(r => r.title.includes(searchQuery) || r.description.includes(searchQuery));
        
        if (currentSort === 'time') {
            filtered.sort((a, b) => new Date(b.stats.date) - new Date(a.stats.date));
        } else if (currentSort === 'hot') {
            filtered.sort((a, b) => b.stats.views - a.stats.views);
        }

        recipeGrid.innerHTML = '';
        
        if (filtered.length === 0) {
            recipeGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted);">暂无找到相关菜谱</div>';
            return;
        }

        filtered.forEach(recipe => {
            const card = document.createElement('div');
            card.className = 'recipe-card';
            card.innerHTML = `
                <img src="${recipe.cover}" alt="${recipe.title}" class="recipe-cover">
                <div class="recipe-info">
                    <h3 class="recipe-title">${recipe.title}</h3>
                    <p class="recipe-desc">${recipe.description}</p>
                    <div class="recipe-meta">
                        <div class="recipe-author">
                            <img src="${recipe.author.avatar}" alt="author">
                            <span>${recipe.author.name}</span>
                        </div>
                        <div class="recipe-stats">
                            <i class="fa-solid fa-eye"></i> ${recipe.stats.views}
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
        let ingredientsHtml = recipe.ingredients.map(ing => `
            <div class="ingredient-item">
                <span>${ing.name}</span>
                <span>${ing.amount}</span>
            </div>
        `).join('');

        let stepsHtml = recipe.steps.map((step, idx) => {
            let mediaHtml = '';
            if (step.type === 'image') {
                mediaHtml = `<img src="${step.media}" alt="Step ${idx+1}" class="step-media">`;
            } else if (step.type === 'video') {
                mediaHtml = `<video src="${step.media}" controls class="step-media"></video>`;
            }
            return `
                <div class="step-item">
                    <h4>步骤 ${idx + 1}</h4>
                    <p>${step.content}</p>
                    ${mediaHtml}
                </div>
            `;
        }).join('');

        recipeDetailContainer.innerHTML = `
            ${recipe.video ? `<video src="${recipe.video}" controls class="detail-cover"></video>` : `<img src="${recipe.cover}" class="detail-cover">`}
            <div class="detail-body">
                <h2 class="detail-title">${recipe.title}</h2>
                <div class="detail-meta">
                    <div class="recipe-author">
                        <img src="${recipe.author.avatar}" alt="author">
                        <span>${recipe.author.name}</span>
                    </div>
                    <span><i class="fa-solid fa-fire"></i> 热度: ${recipe.stats.views}</span>
                    <span><i class="fa-solid fa-calendar"></i> 发布于: ${new Date(recipe.stats.date).toLocaleDateString()}</span>
                </div>
                
                <div class="detail-section">
                    <h3>食材清单</h3>
                    <div class="ingredient-list">
                        ${ingredientsHtml}
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
