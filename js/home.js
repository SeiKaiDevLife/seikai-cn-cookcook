document.addEventListener('DOMContentLoaded', () => {
    // Check Authentication
    let userStr = localStorage.getItem('cookcook_user');
    
    // Clear legacy invalid token
    if (!userStr || userStr.includes('{') || (userStr !== 'seikai' && userStr !== 'echo')) {
        localStorage.removeItem('cookcook_user');
        window.location.href = 'index.html';
        return;
    }
    
    const searchInput = document.getElementById('searchInput');
    const sortDropdown = document.getElementById('sortDropdown');
    const sortTrigger = document.getElementById('sortTrigger');
    const sortMenuItems = document.querySelectorAll('.dropdown-item');
    const sortOrderBtn = document.getElementById('sortOrderBtn');
    const recipeGrid = document.getElementById('recipeGrid');
    const topBar = document.getElementById('topBar');
    // Modal Elements
    const modal = document.getElementById('recipeModal');
    const closeModalBtn = document.getElementById('closeModal');
    const recipeDetailContainer = document.getElementById('recipeDetailContainer');

    const editModal = document.getElementById('editRecipeModal');
    const closeEditModalBtn = document.getElementById('closeEditModal');
    const saveEditBtn = document.getElementById('saveEditBtn');
    
    const noteModal = document.getElementById('addNoteModal');
    const closeNoteModalBtn = document.getElementById('closeNoteModal');
    const saveNoteBtn = document.getElementById('saveNoteBtn');
    
    let currentEditingRecipe = null;
    let currentNoteRecipeId = null;

    // Tab Switching Logic
    const tabItems = document.querySelectorAll('.tab-item');
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
                renderGrid();
            } else {
                topBar.style.display = 'none';
            }

            if (targetViewId === 'profileView') {
                renderProfile();
            }
            
            if (targetViewId === 'ingredientsView') {
                renderMatchGrid();
            }
            
            if (targetViewId === 'publishView') {
                renderPubSteps();
            }
        });
    });

    // Load Data
    let recipes = window.RECIPE_DATA || [];
    
    // State
    let currentSortMode = 'time'; // time, difficulty, duration, proficiency
    let currentSortOrder = 'desc'; // asc, desc
    let searchQuery = '';

    // Ingredients Logic
    let myIngredients = [];
    const ingInput = document.getElementById('ingInput');
    const addIngBtn = document.getElementById('addIngBtn');
    const ingTagsContainer = document.getElementById('ingTagsContainer');
    const matchRecipeGrid = document.getElementById('matchRecipeGrid');

    const synonymDict = {
        "猪肉": ["五花肉", "梅花肉", "里脊肉", "瘦肉", "排骨"],
        "牛肉": ["牛腩", "牛排", "肥牛"],
        "葱": ["大葱", "小葱", "洋葱"],
        "辣椒": ["小米辣", "青椒", "红椒", "薄皮辣椒", "线椒", "朝天椒"],
        "糖": ["白糖", "红糖", "冰糖"],
        "油": ["食用油", "菜籽油", "花生油", "猪油", "橄榄油"],
        "酱油": ["生抽", "老抽"],
        "盐": ["食盐", "粗盐", "海盐"],
        "蒜": ["大蒜", "蒜瓣", "蒜末"],
        "姜": ["生姜", "老姜"]
    };

    function checkMatch(reqName, userIng) {
        if (reqName.includes(userIng) || userIng.includes(reqName)) return true;
        for (let key in synonymDict) {
            let list = synonymDict[key];
            if (userIng.includes(key) && list.some(item => reqName.includes(item))) return true;
            if (reqName.includes(key) && list.some(item => userIng.includes(item))) return true;
        }
        return false;
    }

    function renderIngTags() {
        if (!ingTagsContainer) return;
        ingTagsContainer.innerHTML = myIngredients.map((ing, idx) => `
            <div class="ing-tag">
                ${ing}
                <i class="fa-solid fa-xmark" onclick="window.removeIng(${idx})"></i>
            </div>
        `).join('');
        renderMatchGrid();
    }

    window.removeIng = function(idx) {
        myIngredients.splice(idx, 1);
        renderIngTags();
    };

    if (addIngBtn && ingInput) {
        addIngBtn.addEventListener('click', () => {
            let val = ingInput.value.trim();
            if (val && !myIngredients.includes(val)) {
                myIngredients.push(val);
                ingInput.value = '';
                renderIngTags();
            }
        });
        
        ingInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                addIngBtn.click();
            }
        });
    }

    function renderMatchGrid() {
        if (!matchRecipeGrid) return;
        
        if (myIngredients.length === 0) {
            matchRecipeGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted);">请输入食材以匹配菜谱</div>';
            return;
        }

        let scoredRecipes = recipes.map(r => {
            let reqIngs = r.materials?.ingredients || [];
            if (reqIngs.length === 0) return { recipe: r, score: 0, percent: 0, matched: [], missing: [] };
            
            let matched = [];
            let missing = [];
            
            reqIngs.forEach(req => {
                let isMatch = myIngredients.some(myIng => checkMatch(req.name, myIng));
                if (isMatch) matched.push(req.name);
                else missing.push(req.name);
            });
            
            let percent = Math.round((matched.length / reqIngs.length) * 100);
            return { recipe: r, score: matched.length, percent: percent, matched: matched, missing: missing };
        });

        scoredRecipes.sort((a, b) => b.percent - a.percent);
        scoredRecipes = scoredRecipes.filter(sr => sr.percent > 0);

        matchRecipeGrid.innerHTML = '';
        if (scoredRecipes.length === 0) {
            matchRecipeGrid.innerHTML = '<div style="text-align: center; padding: 3rem; color: var(--text-muted);">暂无匹配菜谱，换些食材试试</div>';
            return;
        }

        scoredRecipes.forEach(sr => {
            let recipe = sr.recipe;
            const card = document.createElement('div');
            card.className = 'match-list-item';
            
            let tagsHtml = '';
            sr.matched.forEach(m => {
                tagsHtml += `<div class="match-ing-tag matched">${m} <i class="fa-solid fa-check"></i></div>`;
            });
            sr.missing.forEach(m => {
                tagsHtml += `<div class="match-ing-tag missing">${m} <i class="fa-solid fa-xmark"></i></div>`;
            });

            card.innerHTML = `
                <div class="match-list-left">
                    <img src="${recipe.coverUrl}" alt="${recipe.name}">
                </div>
                <div class="match-list-right">
                    <h3 class="match-list-title">${recipe.name}</h3>
                    <div class="match-ing-tags">
                        ${tagsHtml}
                    </div>
                    <div class="match-percent">
                        满足度 ${sr.percent}%
                    </div>
                </div>
            `;
            
            card.addEventListener('click', () => openDetail(recipe));
            matchRecipeGrid.appendChild(card);
        });
    }

    // Publish Logic
    let pubSteps = [];
    
    window.addPubStep = function(type) {
        pubSteps.push({
            id: 's' + Date.now(),
            type: type,
            content: '',
            timerSeconds: type === 'timer' ? 60 : 0
        });
        renderPubSteps();
    };
    
    window.removePubStep = function(idx) {
        pubSteps.splice(idx, 1);
        renderPubSteps();
    };
    
    window.updatePubStep = function(idx, key, val) {
        pubSteps[idx][key] = val;
    };
    
    function renderPubSteps() {
        const container = document.getElementById('pubStepsContainer');
        if (!container) return;
        
        container.innerHTML = pubSteps.map((step, idx) => {
            let typeName = '';
            if(step.type === 'prep') typeName = '备菜';
            else if(step.type === 'cook') typeName = '烧菜';
            else if(step.type === 'timer') typeName = '计时';
            else if(step.type === 'judge') typeName = '判断';
            
            let extraHtml = '';
            if (step.type === 'timer') {
                extraHtml = `<input type="number" value="${step.timerSeconds}" onchange="window.updatePubStep(${idx}, 'timerSeconds', parseInt(this.value))" placeholder="秒数" style="width: 80px; margin-top: 0.5rem; padding: 0.4rem; border-radius: 8px; border: 1px solid #CCC;"> 秒`;
            }
            
            return `
                <div class="pub-step-item ${step.type}">
                    <button class="remove-step" onclick="window.removePubStep(${idx})">&times;</button>
                    <div style="font-size: 0.8rem; font-weight: 700; margin-bottom: 0.5rem; color: var(--text-muted);">步骤 ${idx+1} - ${typeName}</div>
                    <textarea rows="2" style="width: 100%; border: 1px solid #EEE; padding: 0.5rem; border-radius: 8px; resize: none; font-family: inherit; font-size: 0.95rem; outline: none;" onchange="window.updatePubStep(${idx}, 'content', this.value)" placeholder="输入步骤说明...">${step.content}</textarea>
                    ${extraHtml}
                </div>
            `;
        }).join('');
    }
    
    window.submitRecipe = function() {
        let pwd = prompt("请输入二级密码以确认发布（提示：123456）：");
        if (pwd !== "123456") {
            alert("二级密码错误！");
            return;
        }
        
        let name = document.getElementById('pubName').value.trim();
        let cover = document.getElementById('pubCover').value.trim() || 'public/images/covers/recipe_001.webp';
        let diff = parseInt(document.getElementById('pubDiff').value) || 3;
        let dur = parseInt(document.getElementById('pubDur').value) || 15;
        
        let ingsRaw = document.getElementById('pubIngs').value.trim();
        let seasRaw = document.getElementById('pubSeas').value.trim();
        
        if (!name) { alert("菜谱名称不能为空！"); return; }
        
        let newIngs = [];
        if (ingsRaw) {
            newIngs = ingsRaw.split('\n').map(line => {
                let parts = line.trim().split(/\s+/);
                if (parts.length >= 2) return { name: parts[0], amount: parts.slice(1).join(' ') };
                return { name: line.trim(), amount: '' };
            }).filter(i => i.name);
        }
        
        let newSeas = seasRaw ? seasRaw.split('\n').map(l => l.trim()).filter(l => l) : [];
        
        let newRecipe = {
            id: 'recipe_' + Date.now(),
            name: name,
            coverUrl: cover,
            author: userStr,
            createTime: new Date().toISOString().split('T')[0] + " 12:00:00",
            difficulty: diff,
            durationMin: dur,
            cookedStats: {},
            materials: {
                ingredients: newIngs,
                seasonings: newSeas
            },
            steps: pubSteps,
            notes: []
        };
        
        recipes.unshift(newRecipe);
        alert("发布成功！(数据仅在本次刷新前有效)");
        
        // Return to home view
        document.querySelector('.tab-item[data-view="homeView"]').click();
        
        // Reset form
        document.getElementById('pubName').value = '';
        document.getElementById('pubCover').value = '';
        document.getElementById('pubIngs').value = '';
        document.getElementById('pubSeas').value = '';
        pubSteps = [];
        renderPubSteps();
    };

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
            
            let myCooked = recipe.cookedStats ? (recipe.cookedStats[userStr] || 0) : 0;
            let cookedHtml = `<span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;"><i class="fa-solid fa-fire-burner"></i> 做过 ${myCooked} 次</span>`;

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
                            <img src="${authorAvatar}" alt="author">
                            <span>${recipe.author}</span>
                        </div>
                        <div class="recipe-stats" style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.3rem;">
                            <div style="font-size: 0.75rem;">${starsHtml}</div>
                            ${cookedHtml}
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

    if (sortDropdown && sortTrigger) {
        sortTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            sortDropdown.classList.toggle('open');
        });

        document.addEventListener('click', () => {
            sortDropdown.classList.remove('open');
        });

        sortMenuItems.forEach(item => {
            item.addEventListener('click', () => {
                sortMenuItems.forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                sortTrigger.innerHTML = `<span>${item.innerText}</span> <i class="fa-solid fa-chevron-down"></i>`;
                currentSortMode = item.dataset.val;
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

    if (closeEditModalBtn) {
        closeEditModalBtn.addEventListener('click', () => {
            editModal.classList.remove('show');
            setTimeout(() => { editModal.style.display = 'none'; }, 300);
        });
    }

    if (saveEditBtn) {
        saveEditBtn.addEventListener('click', () => {
            if (!currentEditingRecipe) return;
            
            // Collect values
            const diff = parseInt(document.getElementById('editDifficulty').value) || 1;
            const dur = parseInt(document.getElementById('editDuration').value) || 10;
            const ingsRaw = document.getElementById('editIngredients').value.trim();
            const seasRaw = document.getElementById('editSeasonings').value.trim();

            currentEditingRecipe.difficulty = diff;
            currentEditingRecipe.durationMin = dur;
            
            // Parse ingredients
            let newIngs = [];
            if (ingsRaw) {
                newIngs = ingsRaw.split('\n').map(line => {
                    let parts = line.trim().split(/\s+/);
                    if (parts.length >= 2) {
                        return { name: parts[0], amount: parts.slice(1).join(' ') };
                    }
                    return { name: line.trim(), amount: '' };
                }).filter(i => i.name);
            }
            
            // Parse seasonings
            let newSeas = [];
            if (seasRaw) {
                newSeas = seasRaw.split('\n').map(l => l.trim()).filter(l => l);
            }

            if (!currentEditingRecipe.materials) currentEditingRecipe.materials = {};
            currentEditingRecipe.materials.ingredients = newIngs;
            currentEditingRecipe.materials.seasonings = newSeas;

            // Close edit modal and refresh
            editModal.classList.remove('show');
            setTimeout(() => { editModal.style.display = 'none'; }, 300);
            
            renderGrid();
            openDetail(currentEditingRecipe);
        });
    }

    if (closeNoteModalBtn) {
        closeNoteModalBtn.addEventListener('click', () => {
            noteModal.classList.remove('show');
            setTimeout(() => { noteModal.style.display = 'none'; }, 300);
        });
    }

    if (saveNoteBtn) {
        saveNoteBtn.addEventListener('click', () => {
            let r = recipes.find(x => x.id === currentNoteRecipeId);
            if (!r) return;
            
            let stepId = document.getElementById('noteStepSelect').value;
            let content = document.getElementById('noteContentInput').value.trim();
            
            if (stepId && content) {
                if (!r.notes) r.notes = [];
                r.notes.push({ stepId: stepId, author: userStr, content: content });
                
                noteModal.classList.remove('show');
                setTimeout(() => { noteModal.style.display = 'none'; }, 300);
                
                openDetail(r);
            } else {
                alert("请选择步骤并填写笔记内容");
            }
        });
    }

    // Expose functions for inline onclick handlers
    window.markCooked = function(recipeId) {
        let r = recipes.find(x => x.id === recipeId);
        if (r) {
            if (!r.cookedStats) r.cookedStats = {};
            r.cookedStats[userStr] = (r.cookedStats[userStr] || 0) + 1;
            renderGrid();
            openDetail(r);
        }
    };

    window.openEditModal = function(recipeId) {
        let r = recipes.find(x => x.id === recipeId);
        if (r) {
            currentEditingRecipe = r;
            document.getElementById('editDifficulty').value = r.difficulty || 1;
            document.getElementById('editDuration').value = r.durationMin || 10;
            
            let ingsStr = (r.materials?.ingredients || []).map(i => `${i.name} ${i.amount}`).join('\n');
            let seasStr = (r.materials?.seasonings || []).join('\n');
            
            document.getElementById('editIngredients').value = ingsStr;
            document.getElementById('editSeasonings').value = seasStr;

            editModal.style.display = 'block';
            void editModal.offsetWidth;
            editModal.classList.add('show');
        }
    };

    window.openNoteModal = function(recipeId) {
        let r = recipes.find(x => x.id === recipeId);
        if (r && r.steps) {
            currentNoteRecipeId = recipeId;
            let select = document.getElementById('noteStepSelect');
            select.innerHTML = r.steps.map((s, idx) => {
                let text = s.content.length > 20 ? s.content.substring(0, 20) + '...' : s.content;
                return `<option value="${s.id}">步骤 ${idx + 1}: ${text}</option>`;
            }).join('');
            document.getElementById('noteContentInput').value = '';
            
            noteModal.style.display = 'block';
            void noteModal.offsetWidth;
            noteModal.classList.add('show');
        }
    };

    window.addStepNote = function(recipeId, stepIndex) {
        let content = prompt("输入做菜心得：");
        if (content && content.trim()) {
            let r = recipes.find(x => x.id === recipeId);
            if (r) {
                if (!r.notes) r.notes = [];
                r.notes.push({
                    stepIndex: stepIndex,
                    author: userStr,
                    content: content.trim()
                });
                openDetail(r);
            }
        }
    };
    
    window.logout = function() {
        localStorage.removeItem('cookcook_user');
        window.location.href = 'index.html';
    };
    
    function renderProfile() {
        document.getElementById('profileName').innerText = userStr;
        document.getElementById('profileAvatar').src = userStr === 'echo' ? 'public/images/avatars/echo.webp' : 'public/images/avatars/seikai.webp';
        
        let cookedCount = 0;
        let cookedDuration = 0;
        let publishedCount = 0;
        let notesCount = 0;
        
        recipes.forEach(r => {
            if (r.author === userStr) {
                publishedCount++;
            }
            if (r.cookedStats && r.cookedStats[userStr]) {
                let times = r.cookedStats[userStr];
                cookedCount += times;
                cookedDuration += times * (r.durationMin || 0);
            }
            if (r.notes) {
                notesCount += r.notes.filter(n => n.author === userStr).length;
            }
        });
        
        let hrs = Math.floor(cookedDuration / 60);
        let mins = cookedDuration % 60;
        let timeStr = hrs > 0 ? `${hrs}h${mins}m` : `${mins}m`;
        if(cookedDuration === 0) timeStr = '0m';
        
        document.getElementById('statCooked').innerText = cookedCount;
        document.getElementById('statDuration').innerText = timeStr;
        document.getElementById('statPublished').innerText = publishedCount;
        document.getElementById('statNotes').innerText = notesCount;
    }

    function openDetail(recipe) {
        let authorAvatar = recipe.author === 'echo' ? 'public/images/avatars/echo.webp' : 'public/images/avatars/seikai.webp';
        
        let ingsHtml = '';
        if (recipe.materials?.ingredients?.length > 0) {
            ingsHtml = `<div class="ingredient-list-premium">` + 
                recipe.materials.ingredients.map(ing => 
                `<div class="ingredient-row">
                    <span class="ingredient-name">${ing.name}</span>
                    <div class="ingredient-dots"></div>
                    <span class="ingredient-amount">${ing.amount}</span>
                </div>`
            ).join('') + `</div>`;
        }
        
        let seasHtml = recipe.materials?.seasonings?.map(s => 
            `<div class="seasoning-chip">${s}</div>`
        ).join('') || '';

        let tutorialsHtml = '';
        if (recipe.tutorials && recipe.tutorials.urls && recipe.tutorials.urls.length > 0) {
            tutorialsHtml = `<div class="detail-section"><h3>参考教程</h3>
                <div class="tutorial-scroll-container">
                    <div class="tutorial-scroll">`;
            recipe.tutorials.urls.forEach(url => {
                if (recipe.tutorials.type === 'video') {
                    tutorialsHtml += `<video controls class="step-media" src="${url}"></video>`;
                } else {
                    tutorialsHtml += `<img class="step-media" src="${url}" alt="tutorial">`;
                }
            });
            tutorialsHtml += `</div></div></div>`;
        }

        let stepsHtml = recipe.steps?.map((step, idx) => {
            let mediaHtml = step.media ? 
                (step.media.endsWith('.mp4') ? `<video controls class="step-inline-media" src="${step.media}"></video>` : `<img class="step-inline-media" src="${step.media}" alt="step media">`) 
                : '';
            
            let typeName = '';
            let typeClass = `step-${step.type}`;
            if(step.type === 'prep') typeName = '备菜';
            else if(step.type === 'cook') typeName = '烧菜';
            else if(step.type === 'timer') typeName = `计时 ${step.timerSeconds}s`;
            else if(step.type === 'judge') typeName = '判断';

            let stepNotes = (recipe.notes || []).filter(n => n.stepId === step.id);
            let notesHtml = stepNotes.map(n => `
                <div class="step-note-card">
                    <div class="note-author"><i class="fa-solid fa-lightbulb"></i> ${n.author} 的心得</div>
                    <div class="note-text">${n.content}</div>
                </div>
            `).join('');

            return `
                <div class="step-timeline-item ${typeClass}">
                    <div class="step-line"></div>
                    <div class="step-dot"></div>
                    <div class="step-content">
                        <div class="step-header">
                            <span class="step-num">Step ${idx + 1}</span>
                            <span class="step-tag">${typeName}</span>
                        </div>
                        <p class="step-text">${step.content}</p>
                        ${mediaHtml}
                        ${notesHtml}
                    </div>
                </div>
            `;
        }).join('') || '';

        let userCookedCount = recipe.cookedStats ? (recipe.cookedStats[userStr] || 0) : 0;

        recipeDetailContainer.innerHTML = `
            <img src="${recipe.coverUrl}" class="detail-cover" alt="cover">
            <div class="detail-body">
                <h2 class="detail-title">${recipe.name}</h2>
                <div class="detail-meta">
                    <div class="recipe-author-lg">
                        <img src="${authorAvatar}" alt="author">
                        <span class="author-name">${recipe.author}</span>
                        <span class="meta-date">${recipe.createTime}</span>
                    </div>
                </div>
                
                ${tutorialsHtml}

                <div class="detail-section">
                    <h3>食材清单</h3>
                    ${ingsHtml}
                </div>
                
                <div class="detail-section" style="margin-top: 1.5rem;">
                    <h3>所需佐料</h3>
                    <div class="seasoning-list">${seasHtml}</div>
                </div>

                <div class="detail-section" style="margin-top: 2rem;">
                    <h3>制作步骤</h3>
                    <div class="detail-steps">
                        ${stepsHtml}
                    </div>
                </div>
            </div>
            
            <div class="recipe-action-bar">
                <button class="action-btn primary" onclick="window.markCooked('${recipe.id}')">
                    <i class="fa-solid fa-fire-burner"></i>
                    <span>做过 (${userCookedCount})</span>
                </button>
                <button class="action-btn" onclick="alert('编辑功能开发中')">
                    <i class="fa-solid fa-pen-to-square"></i>
                    <span>编辑</span>
                </button>
                <button class="action-btn" onclick="window.openNoteModal('${recipe.id}')">
                    <i class="fa-solid fa-book-open"></i>
                    <span>笔记</span>
                </button>
            </div>
        `;
        
        modal.style.display = 'block';
        // force reflow
        void modal.offsetWidth;
        modal.classList.add('show');
    }

    // Initial render
    renderGrid();
});
