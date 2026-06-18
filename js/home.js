document.addEventListener('DOMContentLoaded', () => {
    // Check Authentication
    const userStr = localStorage.getItem('cookcook_user');
    if (!userStr) {
        window.location.href = 'index.html';
        return;
    }
    
    // UI Elements
    const searchInput = document.getElementById('searchInput');
    const sortTabs = document.querySelectorAll('.sort-tab');
    const sortOrderBtn = document.getElementById('sortOrderBtn');
    const recipeGrid = document.getElementById('recipeGrid');
    const topBar = document.getElementById('topBar');
    const modal = document.getElementById('recipeModal');
    const closeModalBtn = document.getElementById('closeModal');
    const recipeDetailContainer = document.getElementById('recipeDetailContainer');

    // Tab Switching Logic
    const tabItems = document.querySelectorAll('.tab-item:not(.publish-tab)');
    const viewSections = document.querySelectorAll('.view-section');

    tabItems.forEach(tab => {
        tab.addEventListener('click', () => {
            tabItems.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            viewSections.forEach(v => v.classList.remove('active'));
            const targetViewId = tab.dataset.view;
            const targetView = document.getElementById(targetViewId);
            if (targetView) targetView.classList.add('active');
            
            // Only show top bar on home view
            if (targetViewId === 'homeView') {
                topBar.style.display = 'flex';
            } else {
                topBar.style.display = 'none';
            }
        });
    });

    // Load Data
    let recipes = window.RECIPE_DATA || [];
    
    // State
    let currentSortMode = 'time'; // time, difficulty, duration, proficiency
    let currentSortOrder = 'desc'; // asc, desc
    let searchQuery = '';

    // Render Grid
    function renderGrid() {
        if (!recipeGrid) return;
        
        let filtered = recipes.filter(r => r.name.includes(searchQuery));

        // Sort Logic
        filtered.sort((a, b) => {
            let valA, valB;
            switch(currentSortMode) {
                case 'time':
                    valA = new Date(a.createTime).getTime();
                    valB = new Date(b.createTime).getTime();
                    break;
                case 'difficulty':
                    valA = a.difficulty;
                    valB = b.difficulty;
                    break;
                case 'duration':
                    valA = a.durationMin;
                    valB = b.durationMin;
                    break;
                case 'proficiency':
                    // Just take seikai's proficiency for sorting demo
                    valA = a.cookedStats ? (a.cookedStats.seikai || 0) : 0;
                    valB = b.cookedStats ? (b.cookedStats.seikai || 0) : 0;
                    break;
                default:
                    valA = 0; valB = 0;
            }
            
            if (currentSortOrder === 'desc') {
                return valB - valA;
            } else {
                return valA - valB;
            }
        });

        recipeGrid.innerHTML = '';
        if (filtered.length === 0) {
            recipeGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted);">暂无找到相关菜谱</div>';
            return;
        }

        filtered.forEach(recipe => {
            const card = document.createElement('div');
            card.className = 'recipe-card';
            
            let starsHtml = '';
            for(let i=0; i<5; i++) {
                if(i < recipe.difficulty) starsHtml += '<i class="fa-solid fa-star"></i>';
                else starsHtml += '<i class="fa-regular fa-star"></i>';
            }

            let authorAvatar = recipe.author === 'echo' ? 'public/images/avatars/echo.webp' : 'public/images/avatars/seikai.webp';

            card.innerHTML = `
                <div class="recipe-cover-wrap">
                    <img src="${recipe.coverUrl}" alt="${recipe.name}" class="recipe-cover">
                    <div class="cover-duration"><i class="fa-regular fa-clock"></i> ${recipe.durationMin}min</div>
                </div>
                <div class="recipe-info">
                    <h3 class="recipe-title">${recipe.name}</h3>
                    <div class="recipe-meta">
                        <div class="recipe-author">
                            <img src="${authorAvatar}" alt="author" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2NjYyI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgM2MxLjY2IDAgMyAxLjM0IDMgM3MtMS4zNCAzLTMgMy0zLTEuMzQtMy0zIDEuMzQtMyAzLTN6bTAgMTQuMmMtMi41IDAtNC43MS0xLjI4LTYtMy4yMi4wMy0xLjk5IDQtMy4wOCA2LTMuMDhzNS45NyAxLjA5IDYgMy4wOGMtMS4yOSAxLjk0LTMuNSAzLjIyLTYgMy4yMnoiLz48L3N2Zz4='">
                            <span>${recipe.author}</span>
                        </div>
                        <div class="recipe-stats">
                            ${starsHtml}
                        </div>
                    </div>
                </div>
            `;
            
            card.addEventListener('click', () => openDetail(recipe));
            recipeGrid.appendChild(card);
        });
    }

    // Events
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.trim();
            renderGrid();
        });
    }

    if (sortTabs.length > 0) {
        sortTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                sortTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                currentSortMode = tab.dataset.sort;
                renderGrid();
            });
        });
    }
    
    if (sortOrderBtn) {
        sortOrderBtn.addEventListener('click', () => {
            if (currentSortOrder === 'desc') {
                currentSortOrder = 'asc';
                sortOrderBtn.dataset.order = 'asc';
                sortOrderBtn.innerHTML = '<i class="fa-solid fa-arrow-up-short-wide"></i>';
            } else {
                currentSortOrder = 'desc';
                sortOrderBtn.dataset.order = 'desc';
                sortOrderBtn.innerHTML = '<i class="fa-solid fa-arrow-down-short-wide"></i>';
            }
            renderGrid();
        });
    }

    // Modal Logic
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            modal.classList.remove('show');
            setTimeout(() => { modal.style.display = 'none'; }, 300);
        });
    }

    function openDetail(recipe) {
        let authorAvatar = recipe.author === 'echo' ? 'public/images/avatars/echo.webp' : 'public/images/avatars/seikai.webp';
        
        let ingsHtml = recipe.materials?.ingredients?.map(ing => 
            `<span class="ingredient-item">${ing.name} <span class="amount">${ing.amount}</span></span>`
        ).join('') || '';
        
        let seasHtml = recipe.materials?.seasonings?.map(s => 
            `<span class="ingredient-item">${s}</span>`
        ).join('') || '';

        let tutorialsHtml = '';
        if (recipe.tutorials && recipe.tutorials.urls) {
            tutorialsHtml = `<div class="detail-section"><h3>参考教程</h3><div style="display:flex; flex-direction:column; gap:1rem;">`;
            recipe.tutorials.urls.forEach(url => {
                if (recipe.tutorials.type === 'video') {
                    tutorialsHtml += `<video controls class="step-media" src="${url}"></video>`;
                } else {
                    tutorialsHtml += `<img class="step-media" src="${url}" alt="tutorial">`;
                }
            });
            tutorialsHtml += `</div></div>`;
        }

        let stepsHtml = recipe.steps?.map((step, idx) => {
            let mediaHtml = step.media ? 
                (step.media.endsWith('.mp4') ? `<video controls class="step-media" src="${step.media}"></video>` : `<img class="step-media" src="${step.media}" alt="step media">`) 
                : '';
            
            let typeName = '';
            if(step.type === 'prep') typeName = '备菜';
            else if(step.type === 'cook') typeName = '烧菜';
            else if(step.type === 'timer') typeName = `计时 ${step.timerSeconds}s`;
            else if(step.type === 'judge') typeName = '判断';

            return `
                <div class="step-item type-${step.type}">
                    <div style="font-size:0.8rem; font-weight:bold; margin-bottom:0.5rem; opacity:0.8;">[${typeName}] 步骤 ${idx + 1}</div>
                    <p>${step.content}</p>
                    ${mediaHtml}
                </div>
            `;
        }).join('') || '';

        recipeDetailContainer.innerHTML = `
            <img src="${recipe.coverUrl}" class="detail-cover" alt="cover">
            <div class="detail-body">
                <h2 class="detail-title">${recipe.name}</h2>
                <div class="detail-meta">
                    <div class="recipe-author" style="width:100%; margin-bottom:0.5rem;">
                        <img src="${authorAvatar}" alt="author" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2NjYyI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgM2MxLjY2IDAgMyAxLjM0IDMgM3MtMS4zNCAzLTMgMy0zLTEuMzQtMy0zIDEuMzQtMyAzLTN6bTAgMTQuMmMtMi41IDAtNC43MS0xLjI4LTYtMy4yMi4wMy0xLjk5IDQtMy4wOCA2LTMuMDhzNS45NyAxLjA5IDYgMy4wOGMtMS4yOSAxLjk0LTMuNSAzLjIyLTYgMy4yMnoiLz48L3N2Zz4='">
                        <span>${recipe.author}</span>
                        <span style="margin-left:auto;">${recipe.createTime}</span>
                    </div>
                </div>
                
                ${tutorialsHtml}

                <div class="detail-section">
                    <h3>食材</h3>
                    <div class="ingredient-list">${ingsHtml}</div>
                </div>
                
                <div class="detail-section">
                    <h3>佐料</h3>
                    <div class="ingredient-list">${seasHtml}</div>
                </div>

                <div class="detail-section">
                    <h3>制作步骤</h3>
                    ${stepsHtml}
                </div>
            </div>
        `;
        
        modal.style.display = 'flex';
        // force reflow
        void modal.offsetWidth;
        modal.classList.add('show');
    }

    // Initial render
    renderGrid();
});
