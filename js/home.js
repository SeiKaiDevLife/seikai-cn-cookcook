document.addEventListener('DOMContentLoaded', () => {
    // Check Authentication
    let userStr = localStorage.getItem('cookcook_user');
    let displayUserStr = '';

    if (!userStr || userStr.includes('{') || (userStr !== 'seikai' && userStr !== 'echo')) {
        localStorage.removeItem('cookcook_user');
        window.location.href = 'index.html';
        return;
    } else {
        displayUserStr = userStr.charAt(0).toUpperCase() + userStr.slice(1);
    }
    
    const searchInput = document.getElementById('searchInput');
    const sortBtn = document.getElementById('sortBtn');
    
    // OSS Helpers
    const ENCRYPTED_CREDENTIALS = "U2FsdGVkX1/O2LvdBfLLtIwzMjSiaU5wjjshpICsLCG9Ha8fwPaPQJnIne+ZSGHlmydtvi0g48RYERvodnmTkZnhXApS0IU7KoMNoL/CsLwWREf0qAAKh5ndFRa/uY/t";
    let ossClient = null;
    
    window.getOSSUrl = function(url, type) {
        if (!url || !url.startsWith('public/')) return url;
        if (url.includes('/videos/raw/')) {
            url = url.replace('/videos/raw/', '/videos/compass/');
        }
        let baseUrl = 'https://www-seikai.oss-cn-hangzhou.aliyuncs.com/cookcook/' + url;
        if (type === 'avatar') {
            return baseUrl + '?x-oss-process=image/resize,w_100,m_lfit';
        } else if (type === 'cover_small') {
            return baseUrl + '?x-oss-process=image/resize,w_300,m_lfit';
        } else if (type === 'cover_large') {
            return baseUrl + '?x-oss-process=image/resize,w_800,m_lfit';
        } else if (type === 'tutorial_img') {
            return baseUrl + '?x-oss-process=image/resize,w_800,m_lfit';
        }
        return baseUrl;
    };
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
        tab.addEventListener('click', (e) => {
            tabItems.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            const targetViewId = tab.dataset.view;
            if (e.isTrusted && targetViewId === 'publishView' && window.resetPublishForm) {
                window.resetPublishForm();
            }
            
            viewSections.forEach(v => v.classList.remove('active'));
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
            
            
            if (targetViewId === 'menuView') {
                renderGuide();
            }
        });
    });

    window.showToast = function(msg) {
        let t = document.createElement('div');
        t.className = 'custom-toast';
        t.innerText = msg;
        document.body.appendChild(t);
        setTimeout(() => t.classList.add('show'), 10);
        setTimeout(() => {
            t.classList.remove('show');
            setTimeout(() => t.remove(), 300);
        }, 2000);
    };

    let cartRecipeIds = [];
    window.addToCart = function(id) {
        if (!cartRecipeIds.includes(id)) {
            cartRecipeIds.push(id);
            window.showToast("已加入点菜清单！");
            window.renderGrid();
            window.renderMatchGrid();
            if (guideState === 'CART') renderGuide();
        } else {
            window.showToast("已经在清单中了");
        }
    };

    // Load Data
    let recipes = [];
    
    // Fetch recipes from OSS
    fetch('https://www-seikai.oss-cn-hangzhou.aliyuncs.com/cookcook/public/data/recipes.json?t=' + Date.now())
        .then(res => res.json())
        .then(data => {
            recipes = data;
            if(window.renderGrid) window.renderGrid();
            if(document.getElementById('profileView').classList.contains('active')) {
                renderProfile();
            }
        })
        .catch(err => {
            console.error("无法从OSS拉取数据，使用本地回退", err);
            recipes = window.RECIPE_DATA || [];
            if(window.renderGrid) window.renderGrid();
        });
    
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

    // Match UI Render
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

            let isInCart = cartRecipeIds.includes(recipe.id);
            card.className = '';
            card.innerHTML = `
                <div class="match-list-item ${isInCart ? 'in-cart' : ''}" onclick="window.openDetail(recipes.find(x => x.id === '${recipe.id}'))" style="position:relative;">
                ${isInCart ? 
                    `<button class="add-to-cart-btn is-in-cart" onclick="event.stopPropagation(); window.removeFromCart('${recipe.id}');" style="position:absolute; right:1rem; top:1rem;"><i class="fa-solid fa-xmark"></i></button>` :
                    `<button class="add-to-cart-btn" onclick="event.stopPropagation(); window.addToCart('${recipe.id}')" style="position:absolute; right:1rem; top:1rem;"><i class="fa-solid fa-plus"></i></button>`
                }
                <div class="match-list-left">
                    <img src="${window.getOSSUrl(recipe.coverUrl, 'cover_small')}" alt="${recipe.name}">
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
            
            matchRecipeGrid.appendChild(card);
        });
    }

    // Publish Logic
    let pubSteps = [];
    let pubIngList = [];
    let pubSeasList = [];
    
    let pubCoverFile = null;
    let pubCoverUrl = '';
    
    let pubTutorialFiles = [];
    let pubTutorialUrls = [];
    let pubTutorialType = 'image';
    let editingRecipeId = null;

    window.handleCoverUpload = function(event) {
        const file = event.target.files[0];
        if (file) {
            pubCoverFile = file;
            pubCoverUrl = URL.createObjectURL(file);
            document.getElementById('pubCoverUpload').style.display = 'none';
            let preview = document.getElementById('pubCoverPreview');
            preview.style.display = 'block';
            preview.src = pubCoverUrl;
        }
    };

    window.handleTutorialUpload = function(event) {
        const files = Array.from(event.target.files);
        if (files.length > 0) {
            pubTutorialType = files[0].type.startsWith('video') ? 'video' : 'image';
            pubTutorialFiles = [];
            pubTutorialUrls = [];
            document.getElementById('pubTutorialPreview').innerHTML = '';
            
            files.forEach(f => {
                pubTutorialFiles.push(f);
                let url = URL.createObjectURL(f);
                pubTutorialUrls.push(url);
                let el = document.createElement(pubTutorialType === 'video' ? 'video' : 'img');
                el.src = url;
                el.style.width = '80px';
                el.style.height = '80px';
                el.style.objectFit = 'cover';
                el.style.borderRadius = '10px';
                document.getElementById('pubTutorialPreview').appendChild(el);
            });
        }
    };

    const pubIngName = document.getElementById('pubIngName');
    const pubIngAmount = document.getElementById('pubIngAmount');
    const pubIngUnit = document.getElementById('pubIngUnit');
    const addPubIngBtn = document.getElementById('addPubIngBtn');
    const pubIngTagsContainer = document.getElementById('pubIngTagsContainer');

    const pubSeasInput = document.getElementById('pubSeasInput');
    const addPubSeasBtn = document.getElementById('addPubSeasBtn');
    const pubSeasTagsContainer = document.getElementById('pubSeasTagsContainer');

    function renderPubIngTags() {
        if (!pubIngTagsContainer) return;
        pubIngTagsContainer.innerHTML = pubIngList.map((ingObj, idx) => {
            let text = ingObj.amount ? `${ingObj.name} ${ingObj.amount}` : ingObj.name;
            return `
            <div class="ing-tag" style="background: rgba(16, 185, 129, 0.1); color: #059669; border: 1px solid rgba(16,185,129,0.2);">
                ${text}
                <i class="fa-solid fa-xmark" style="color: #059669;" onclick="window.removePubIng(${idx})"></i>
            </div>
            `;
        }).join('');
    }

    function renderPubSeasTags() {
        if (!pubSeasTagsContainer) return;
        pubSeasTagsContainer.innerHTML = pubSeasList.map((seas, idx) => `
            <div class="ing-tag" style="background: rgba(245, 158, 11, 0.1); color: #d97706; border: 1px solid rgba(245,158,11,0.2);">
                ${seas}
                <i class="fa-solid fa-xmark" style="color: #d97706;" onclick="window.removePubSeas(${idx})"></i>
            </div>
        `).join('');
    }

    window.removePubIng = function(idx) {
        pubIngList.splice(idx, 1);
        renderPubIngTags();
    };

    window.removePubSeas = function(idx) {
        pubSeasList.splice(idx, 1);
        renderPubSeasTags();
    };

    if (addPubIngBtn && pubIngName && pubIngAmount) {
        addPubIngBtn.addEventListener('click', () => {
            let name = pubIngName.value.trim();
            let amountVal = pubIngAmount.value.trim();
            let unit = pubIngUnit ? pubIngUnit.value : '';
            let amount = amountVal ? amountVal + unit : (unit === '适量' ? '适量' : '');
            
            if (name) {
                pubIngList.push({ name: name, amount: amount });
                pubIngName.value = '';
                pubIngAmount.value = '';
                renderPubIngTags();
            }
        });
        pubIngName.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addPubIngBtn.click();
        });
        pubIngAmount.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addPubIngBtn.click();
        });
    }

    if (addPubSeasBtn && pubSeasInput) {
        addPubSeasBtn.addEventListener('click', () => {
            let val = pubSeasInput.value.trim();
            if (val && !pubSeasList.includes(val)) {
                pubSeasList.push(val);
                pubSeasInput.value = '';
                renderPubSeasTags();
            }
        });
        pubSeasInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addPubSeasBtn.click();
        });
    }

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
    
    window.editRecipe = function(id) {
        let recipe = recipes.find(x => x.id === id);
        if (!recipe || recipe.author !== userStr) return;
        
        editingRecipeId = id;
        pubIngList = JSON.parse(JSON.stringify(recipe.materials?.ingredients || []));
        pubSeasList = JSON.parse(JSON.stringify(recipe.materials?.seasonings || []));
        pubSteps = JSON.parse(JSON.stringify(recipe.steps || []));
        pubCoverUrl = recipe.coverUrl || '';
        pubTutorialUrls = recipe.tutorials?.urls ? [...recipe.tutorials.urls] : [];
        pubTutorialType = recipe.tutorials?.type || 'image';
        
        document.getElementById('pubName').value = recipe.name;
        document.getElementById('pubDiff').value = recipe.difficulty;
        document.getElementById('pubDur').value = recipe.durationMin;
        
        let coverUpload = document.getElementById('pubCoverUpload');
        let coverPreview = document.getElementById('pubCoverPreview');
        if (pubCoverUrl) {
            coverUpload.style.display = 'none';
            coverPreview.style.display = 'block';
            coverPreview.src = pubCoverUrl;
        } else {
            coverUpload.style.display = 'flex';
            coverPreview.style.display = 'none';
            coverPreview.src = '';
        }
        
        let tutPreview = document.getElementById('pubTutorialPreview');
        tutPreview.innerHTML = '';
        pubTutorialUrls.forEach(url => {
            let el = document.createElement(pubTutorialType === 'video' ? 'video' : 'img');
            el.src = url;
            el.style.width = '80px';
            el.style.height = '80px';
            el.style.objectFit = 'cover';
            el.style.borderRadius = '10px';
            tutPreview.appendChild(el);
        });
        
        renderPubIngTags();
        renderPubSeasTags();
        renderPubSteps();
        
        let pubBtn = document.getElementById('publishBtn');
        if(pubBtn) pubBtn.innerText = '更新菜谱';
        
        // Open publish view
        document.querySelector('.tab-item[data-view="publishView"]').click();
        
        // Close detail modal
        modal.classList.remove('show');
        setTimeout(() => { modal.style.display = 'none'; }, 300);
    };

    window.resetPublishForm = function() {
        editingRecipeId = null;
        let pubBtn = document.getElementById('publishBtn');
        if(pubBtn) pubBtn.innerText = '发布菜谱';
        
        document.getElementById('pubName').value = '';
        document.getElementById('pubDiff').value = '3';
        document.getElementById('pubDur').value = '15';
        pubCoverUrl = '';
        pubTutorialUrls = [];
        document.getElementById('pubCoverUpload').style.display = 'flex';
        document.getElementById('pubCoverPreview').style.display = 'none';
        document.getElementById('pubCoverPreview').src = '';
        document.getElementById('pubTutorialPreview').innerHTML = '';
        if(document.getElementById('pubIngName')) document.getElementById('pubIngName').value = '';
        if(document.getElementById('pubIngAmount')) document.getElementById('pubIngAmount').value = '';
        if(document.getElementById('pubSeasInput')) document.getElementById('pubSeasInput').value = '';
        
        pubIngList = [];
        pubSeasList = [];
        pubSteps = [];
        renderPubIngTags();
        renderPubSeasTags();
        renderPubSteps();
    };

    let pendingOSSCallback = null;
    window.runWithOSS = function(callback) {
        if (ossClient) {
            callback();
        } else {
            pendingOSSCallback = callback;
            let secPwdModal = document.getElementById('secPwdModal');
            document.getElementById('secPwdInput').value = '';
            secPwdModal.classList.add('show');
            secPwdModal.style.display = 'flex';
        }
    };
    
    document.getElementById('cancelSecPwdBtn').addEventListener('click', () => {
        let secPwdModal = document.getElementById('secPwdModal');
        secPwdModal.classList.remove('show');
        setTimeout(() => { secPwdModal.style.display = 'none'; pendingOSSCallback = null; }, 300);
    });
    
    document.getElementById('confirmSecPwdBtn').addEventListener('click', async () => {
        if (!ossClient) {
            let pwd = document.getElementById('secPwdInput').value;
            if (!pwd) return;
            if (!ENCRYPTED_CREDENTIALS || ENCRYPTED_CREDENTIALS === "REPLACE_ME_WITH_ENCRYPTED_CREDENTIALS") {
                alert("未配置OSS凭证！"); return;
            }
            try {
                const decryptedBytes = CryptoJS.AES.decrypt(ENCRYPTED_CREDENTIALS, pwd);
                const decryptedText = decryptedBytes.toString(CryptoJS.enc.Utf8);
                if (!decryptedText) throw new Error("解密失败");
                const credentials = JSON.parse(decryptedText);
                ossClient = new OSS({
                    region: 'oss-cn-hangzhou',
                    accessKeyId: credentials.id.trim(),
                    accessKeySecret: credentials.secret.trim(),
                    bucket: 'www-seikai'
                });
            } catch (err) {
                alert("二级密码错误或解密失败！");
                console.error(err);
                return;
            }
        }
        
        let secPwdModal = document.getElementById('secPwdModal');
        secPwdModal.classList.remove('show');
        setTimeout(() => { secPwdModal.style.display = 'none'; }, 300);
        
        if (pendingOSSCallback) {
            let cb = pendingOSSCallback;
            pendingOSSCallback = null;
            cb();
        }
    });
    
    window.saveDataToOSS = async function() {
        if (!ossClient) throw new Error("OSS client not initialized");
        const jsonStr = JSON.stringify(recipes, null, 2);
        const blob = new Blob([jsonStr], {type: 'application/json'});
        await ossClient.put('cookcook/public/data/recipes.json', blob);
    };

    window.submitRecipe = function() {
        window.runWithOSS(async () => {
            // --- REAL SUBMIT LOGIC ---
        let name = document.getElementById('pubName').value.trim();
        let diff = parseInt(document.getElementById('pubDiff').value) || 3;
        let dur = parseInt(document.getElementById('pubDur').value) || 15;
        
        if (!name) { alert("菜谱名称不能为空！"); return; }
        
        let publishBtn = document.getElementById('confirmSecPwdBtn');
        let originalText = publishBtn.innerText;
        publishBtn.innerText = "上传中...";
        publishBtn.disabled = true;

        try {
            // Upload Cover
            let finalCoverUrl = pubCoverUrl || 'public/images/covers/recipe_001.webp';
            if (pubCoverFile) {
                let ext = pubCoverFile.name.split('.').pop();
                let ossName = `public/covers/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
                await ossClient.put('cookcook/' + ossName, pubCoverFile);
                finalCoverUrl = ossName;
            }

            // Upload Tutorials
            let finalTutorialUrls = [];
            for (let i = 0; i < pubTutorialFiles.length; i++) {
                let f = pubTutorialFiles[i];
                let ext = f.name.split('.').pop();
                let isVideo = f.type.startsWith('video');
                let dir = isVideo ? 'public/videos/raw/' : 'public/tutorials/';
                let ossName = `${dir}${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
                await ossClient.put('cookcook/' + ossName, f);
                finalTutorialUrls.push(ossName);
            }
            
            // For editing, keep existing tutorials if not changed (pubTutorialUrls without blob)
            if (pubTutorialFiles.length === 0 && pubTutorialUrls.length > 0) {
                finalTutorialUrls = [...pubTutorialUrls]; // keep existing
            }

            let newIngs = [...pubIngList];
            let newSeas = [...pubSeasList];
            
            if (editingRecipeId) {
                let oldRecipe = recipes.find(x => x.id === editingRecipeId);
                if (oldRecipe) {
                    // Check affected notes
                    let hasAffectedNotes = false;
                    if (oldRecipe.notes && oldRecipe.notes.length > 0) {
                        for (let note of oldRecipe.notes) {
                            let oldStep = oldRecipe.steps.find(s => s.id === note.stepId);
                            let newStep = pubSteps.find(s => s.id === note.stepId);
                            if (!newStep || (oldStep && oldStep.content !== newStep.content)) {
                                hasAffectedNotes = true;
                                break;
                            }
                        }
                    }
                    
                    if (hasAffectedNotes) {
                        let choice = confirm("您修改或删除了部分包含笔记的步骤。点击“确定”一并删除这些失效笔记，点击“取消”暂时保留。您可以稍后在【笔记】页面中手动修改它们。");
                        if (choice) {
                            oldRecipe.notes = oldRecipe.notes.filter(note => {
                                let newStep = pubSteps.find(s => s.id === note.stepId);
                                let oldStep = oldRecipe.steps.find(s => s.id === note.stepId);
                                return newStep && (!oldStep || oldStep.content === newStep.content);
                            });
                        }
                    }
                    
                    // Update
                    oldRecipe.name = name;
                    oldRecipe.coverUrl = finalCoverUrl;
                    oldRecipe.difficulty = diff;
                    oldRecipe.durationMin = dur;
                    oldRecipe.materials.ingredients = newIngs;
                    oldRecipe.materials.seasonings = newSeas;
                    oldRecipe.steps = JSON.parse(JSON.stringify(pubSteps));
                    if (finalTutorialUrls.length > 0) {
                        oldRecipe.tutorials = { type: pubTutorialType, urls: [...finalTutorialUrls] };
                    } else {
                        oldRecipe.tutorials = null;
                    }
                }
            } else {
                let newRecipe = {
                    id: 'recipe_' + Date.now(),
                    name: name,
                    coverUrl: finalCoverUrl,
                    author: userStr,
                    createTime: new Date().toISOString().split('T')[0] + " 12:00:00",
                    difficulty: diff,
                    durationMin: dur,
                    cookedStats: {},
                    materials: { ingredients: newIngs, seasonings: newSeas },
                    steps: pubSteps,
                    tutorials: finalTutorialUrls.length > 0 ? { type: pubTutorialType, urls: finalTutorialUrls } : null,
                    notes: []
                };
                recipes.unshift(newRecipe);
            }
            
            // SAVE TO OSS
            const jsonStr = JSON.stringify(recipes, null, 2);
            const blob = new Blob([jsonStr], {type: 'application/json'});
            await ossClient.put('cookcook/public/data/recipes.json', blob);

            alert((editingRecipeId ? "修改" : "发布") + "成功！数据已持久化至云端。");
            
            // Return to home view
            document.querySelector('.tab-item[data-view="homeView"]').click();
            
            // Reset form
            window.resetPublishForm();
            window.renderGrid();
        } catch (err) {
            console.error(err);
            alert("上传失败！" + err.message);
        } finally {
            publishBtn.innerText = originalText;
            publishBtn.disabled = false;
        }
    });
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
            recipeGrid.innerHTML = '<div style="column-span: all; text-align: center; padding: 3rem; color: var(--text-muted);">暂无找到相关菜谱</div>';
            return;
        }

        filtered.forEach(recipe => {
            const card = document.createElement('div');
            let isInCart = cartRecipeIds.includes(recipe.id);
            card.className = isInCart ? 'recipe-card in-cart' : 'recipe-card';
            
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
                    <img src="${window.getOSSUrl(recipe.coverUrl, 'cover_small')}" alt="${recipe.name}" class="recipe-cover">
                    <div class="cover-duration"><i class="fa-regular fa-clock"></i> ${recipe.durationMin}min</div>
                </div>
                <div class="recipe-info">
                    <div class="recipe-title" style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <span>${recipe.name}</span>
                        ${cartRecipeIds.includes(recipe.id) ? 
                            `<button class="add-to-cart-btn is-in-cart" onclick="event.stopPropagation(); window.removeFromCart('${recipe.id}');"><i class="fa-solid fa-xmark"></i></button>` :
                            `<button class="add-to-cart-btn" onclick="event.stopPropagation(); window.addToCart('${recipe.id}')"><i class="fa-solid fa-plus"></i></button>`
                        }
                    </div>
                    <div class="recipe-meta">
                        <div class="recipe-author">
                            <img src="${window.getOSSUrl(authorAvatar, 'avatar')}" alt="author">
                            <span>${recipe.author.charAt(0).toUpperCase() + recipe.author.slice(1)}</span>
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
    if (document.getElementById('searchInput')) {
        document.getElementById('searchInput').addEventListener('input', (e) => {
            searchQuery = e.target.value.trim();
            renderGrid();
        });
    }

    if (document.getElementById('sortDropdown') && sortTrigger) {
        sortTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            document.getElementById('sortDropdown').classList.toggle('open');
        });

        document.addEventListener('click', () => {
            document.getElementById('sortDropdown').classList.remove('open');
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
        window.runWithOSS(async () => {
            let r = recipes.find(x => x.id === recipeId);
            if (r) {
                if (!r.cookedStats) r.cookedStats = {};
                r.cookedStats[userStr] = (r.cookedStats[userStr] || 0) + 1;
                try {
                    await window.saveDataToOSS();
                    renderGrid();
                    openDetail(r);
                } catch (e) {
                    alert("更新数据失败: " + e.message);
                }
            }
        });
    };

    window.deleteRecipe = function(recipeId) {
        if (!confirm("确定要删除这道菜谱吗？此操作不可恢复！")) return;
        
        window.runWithOSS(async () => {
            let idx = recipes.findIndex(x => x.id === recipeId);
            if (idx > -1) {
                let rToRestore = recipes[idx];
                recipes.splice(idx, 1);
                try {
                    await window.saveDataToOSS();
                    alert("删除成功！");
                    let modal = document.getElementById('recipeDetailModal');
                    modal.classList.remove('show');
                    setTimeout(() => { modal.style.display = 'none'; }, 300);
                    renderGrid();
                    if(document.getElementById('profileView').classList.contains('active')) renderProfile();
                } catch (e) {
                    alert("删除失败: " + e.message);
                    // 恢复被删的数据
                    recipes.splice(idx, 0, rToRestore);
                }
            }
        });
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
        document.getElementById('profileName').innerText = displayUserStr;
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
                <div class="carousel-container">
                    ${recipe.tutorials.urls.length > 1 ? `<button class="carousel-btn left" onclick="window.scrollCarousel(-1)"><i class="fa-solid fa-chevron-left"></i></button>` : ''}
                    <div class="tutorial-scroll" id="detailCarousel" onscroll="window.updateCarouselDots()">`;
            recipe.tutorials.urls.forEach(url => {
                let isVideo = recipe.tutorials.type === 'video' || url.endsWith('.mp4') || (url.startsWith('blob:') && recipe.tutorials.type === 'video');
                if (isVideo) {
                    tutorialsHtml += `<video controls class="carousel-media" src="${window.getOSSUrl(url, 'tutorial_video')}"></video>`;
                } else {
                    tutorialsHtml += `<img class="carousel-media" src="${window.getOSSUrl(url, 'tutorial_img')}" alt="tutorial">`;
                }
            });
            tutorialsHtml += `</div>
                    ${recipe.tutorials.urls.length > 1 ? `<button class="carousel-btn right" onclick="window.scrollCarousel(1)"><i class="fa-solid fa-chevron-right"></i></button>` : ''}
                    ${recipe.tutorials.urls.length > 1 ? `<div class="carousel-dots" id="carouselDots">
                        ${recipe.tutorials.urls.map((_, i) => `<span class="dot ${i===0?'active':''}"></span>`).join('')}
                    </div>` : ''}
                </div></div>`;
        }

        let stepsHtml = recipe.steps?.map((step, idx) => {
            let mediaHtml = step.media ? 
                (step.media.endsWith('.mp4') ? `<video controls class="step-inline-media" src="${window.getOSSUrl(step.media, 'tutorial_video')}"></video>` : `<img class="step-inline-media" src="${window.getOSSUrl(step.media, 'tutorial_img')}" alt="step media">`) 
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
            <img src="${window.getOSSUrl(recipe.coverUrl, 'cover_large')}" class="detail-cover" alt="cover">
            <div class="detail-body">
                <h2 class="detail-title">${recipe.name}</h2>
                <div class="detail-meta">
                    <div class="recipe-author-lg">
                        <img src="${window.getOSSUrl(authorAvatar, 'avatar')}" alt="author">
                        <span class="author-name">${recipe.author.charAt(0).toUpperCase() + recipe.author.slice(1)}</span>
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
            
            <div class="recipe-action-bar" style="display:flex; justify-content:space-around; align-items:center; padding: 1rem;">
                <button class="action-btn primary" onclick="window.markCooked('${recipe.id}')">
                    <i class="fa-solid fa-fire-burner"></i>
                    <span>做过 (${userCookedCount})</span>
                </button>
                <button class="action-btn" onclick="window.editRecipe('${recipe.id}')">
                    <i class="fa-solid fa-pen"></i>
                    <span>编辑</span>
                </button>
                <button class="action-btn" onclick="window.openNoteModal('${recipe.id}')">
                    <i class="fa-solid fa-book-open"></i>
                    <span>笔记</span>
                </button>
                <button class="action-btn" style="color: #4CAF50;" onclick="window.addToCart('${recipe.id}')">
                    <i class="fa-solid fa-cart-plus"></i>
                    <span>点菜</span>
                </button>
                ${recipe.author === userStr ? `
                <button class="action-btn" style="color: #FF5252;" onclick="window.deleteRecipe('${recipe.id}')">
                    <i class="fa-solid fa-trash"></i>
                    <span>删除</span>
                </button>
                ` : ''}
            </div>
        `;
        
        modal.style.display = 'block';
        // force reflow
        void modal.offsetWidth;
        modal.classList.add('show');
    }

    // Initial render
    renderGrid();
    
    // Guided Cooking Logic
    let guideState = 'CART'; // CART, PREP, ORDER, COOKING, DONE
    let cookingQueue = []; // [{ recipe, steps: [] }]
    let currentDishIdx = 0;
    let currentStepIdx = 0;
    let timerInterval = null;

    window.renderGuide = function() {
        const root = document.getElementById('guideRoot');
        if (!root) return;
        
        if (guideState === 'CART') {
            let html = `
                <div class="guide-container">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
                        <h2 style="font-size:1.8rem; font-weight:800; margin:0;">点菜清单</h2>
                    </div>
                    
                    <div id="cartListContainer" style="display:flex; flex-wrap:wrap; gap:0.5rem; margin-bottom:1.5rem;">`;
            if (cartRecipeIds.length === 0) {
                html += `<div style="width:100%; text-align:center; padding: 1rem 0; color:var(--text-muted);">暂未点菜</div>`;
            } else {
                cartRecipeIds.forEach(id => {
                    let r = recipes.find(x => x.id === id);
                    if (r) {
                        html += `
                            <div class="cart-item-mini">
                                <img src="${window.getOSSUrl(r.coverUrl, 'cover_small')}">
                                <span class="cart-item-mini-name">${r.name}</span>
                                <button class="cart-item-mini-del" onclick="window.removeFromCart('${r.id}')"><i class="fa-solid fa-xmark"></i></button>
                            </div>
                        `;
                    }
                });
            }
            html += `</div>
                    
                    <div class="search-box" style="margin-bottom: 1.5rem;">
                        <i class="fa-solid fa-magnifying-glass"></i>
                        <input type="text" id="guideSearchInput" placeholder="搜索菜谱并添加..." oninput="window.handleGuideSearch()">
                    </div>
                    <div id="guideSearchResults" style="margin-bottom: 2rem;"></div>
                    
                <button class="primary-btn" onclick="window.startPrep()" style="margin-top:2rem;" ${cartRecipeIds.length===0?'disabled style="opacity:0.5;"':''}>开始备菜</button>
            </div>`;
            root.innerHTML = html;
        } else if (guideState === 'PREP') {
            let html = `
                <div class="guide-container">
                    <h2 style="font-size:1.8rem; font-weight:800; margin-bottom:1.5rem;">开始备菜</h2>
                    <div id="prepListContainer">`;
            let hasPrep = false;
            cartRecipeIds.forEach(id => {
                let r = recipes.find(x => x.id === id);
                let prepSteps = r.steps.filter(s => s.type === 'prep');
                if (prepSteps.length > 0) {
                    hasPrep = true;
                    html += `<div class="prep-dish-group">
                        <div class="prep-dish-title"><i class="fa-solid fa-leaf"></i> ${r.name}</div>`;
                    prepSteps.forEach((step, idx) => {
                        html += `<div class="prep-step-item">
                            <div class="step-num">${idx+1}.</div>
                            <div>${step.content}</div>
                        </div>`;
                    });
                    html += `</div>`;
                }
            });
            if (!hasPrep) html += `<div style="text-align:center; padding: 2rem 0; color:var(--text-muted);">所选菜品均无备菜步骤，可直接开始做菜！</div>`;
            html += `</div>
                <button class="primary-btn" onclick="window.goToOrder()" style="margin-top:2rem; background:#10b981;">备菜完成，准备做菜</button>
            </div>`;
            root.innerHTML = html;
        } else if (guideState === 'ORDER') {
            let html = `
                <div class="guide-container">
                    <h2 style="font-size:1.8rem; font-weight:800; margin-bottom:1.5rem;">调整做菜顺序</h2>
                    <div id="orderListContainer">`;
            cartRecipeIds.forEach((id, idx) => {
                let r = recipes.find(x => x.id === id);
                html += `
                    <div class="order-item">
                        <div style="font-weight:800; color:var(--text-muted); width:20px;">${idx+1}</div>
                        <img src="${window.getOSSUrl(r.coverUrl, 'cover_small')}" style="width:50px; height:50px; border-radius:10px; object-fit:cover;">
                        <div style="font-weight:700; flex:1;">${r.name}</div>
                        <div class="order-controls">
                            <button onclick="window.moveOrder(${idx}, -1)" ${idx===0?'style="opacity:0.3;"':''}><i class="fa-solid fa-chevron-up"></i></button>
                            <button onclick="window.moveOrder(${idx}, 1)" ${idx===cartRecipeIds.length-1?'style="opacity:0.3;"':''}><i class="fa-solid fa-chevron-down"></i></button>
                        </div>
                    </div>
                `;
            });
            html += `</div>
                <button class="primary-btn" onclick="window.startCooking()" style="margin-top:2rem; background:#ef4444;">确认顺序，开始制作</button>
            </div>`;
            root.innerHTML = html;
        } else if (guideState === 'MODE_SELECT') {
            if (currentDishIdx >= cookingQueue.length) return;
            let dish = cookingQueue[currentDishIdx];
            let html = `
                <div class="guide-fullscreen" style="justify-content:center; align-items:center; background:#FFF; padding:5%;">
                    <h2 style="font-size:1.8rem; margin-bottom:2.5rem; font-weight:800; text-align:center;">
                        你想怎么做 <span style="color:#059669;">${dish.recipe.name}</span>？
                    </h2>
                    <div style="display:flex; flex-direction:column; gap:1.2rem; width:100%; max-width:300px;">
                        <button class="primary-btn" style="background:#059669;" onclick="window.selectMode('steps')">做菜步骤</button>
                        <button class="primary-btn" style="background:#000;" onclick="window.selectMode('tutorial')">视频/图片教程</button>
                    </div>
                </div>
            `;
            root.innerHTML = html;
        } else if (guideState === 'COOKING') {
            if (currentDishIdx >= cookingQueue.length) return;
            let dish = cookingQueue[currentDishIdx];
            let step = dish.steps[currentStepIdx];
            
            let html = '';
            
            let tutorialsHtml = '';
            if (dish.recipe.tutorials && dish.recipe.tutorials.urls) {
                dish.recipe.tutorials.urls.forEach(url => {
                    let isVideo = dish.recipe.tutorials.type === 'video' || url.endsWith('.mp4');
                    if (isVideo) {
                        tutorialsHtml += `<video controls autoplay class="carousel-media" src="${window.getOSSUrl(url, 'tutorial_video')}" style="height:100%; width:100%; object-fit:contain; background:#000; flex:0 0 100%;"></video>`;
                    } else {
                        tutorialsHtml += `<img class="carousel-media" src="${window.getOSSUrl(url, 'tutorial_img')}" style="height:100%; width:100%; object-fit:contain; background:#000; flex:0 0 100%;">`;
                    }
                });
            }

            if (dish.mode === 'tutorial') {
                html = `
                    <div class="guide-fullscreen">
                        <div class="cooking-header">
                            <div class="cooking-dish-name">${dish.recipe.name}</div>
                            <div class="cooking-progress-text">第 ${currentDishIdx+1}/${cookingQueue.length} 道菜 | 纯教程模式</div>
                        </div>
                        <div style="flex:1; overflow-y:auto; background:#000; display:flex; flex-direction:column;">
                            <div style="display:flex; overflow-x:auto; scroll-snap-type:x mandatory; flex:1;">${tutorialsHtml}</div>
                        </div>
                        <div class="cooking-action" style="background:#FFF;">
                            <button class="primary-btn" style="background:#ef4444;" onclick="window.finishDish()">这道菜做好了 <i class="fa-solid fa-check"></i></button>
                        </div>
                    </div>
                `;
            } else {
                let prevStep = currentStepIdx > 0 ? dish.steps[currentStepIdx - 1] : null;
                let nextStep = currentStepIdx < dish.steps.length - 1 ? dish.steps[currentStepIdx + 1] : null;

                let typeClass = 'bg-cook';
                let nextTypeClass = 'bg-cook-dull';
                let typeName = '烹饪';
                if(step.type === 'timer') { typeClass = 'bg-timer'; typeName = '计时'; }
                if(step.type === 'judge') { typeClass = 'bg-judge'; typeName = '判断'; }

                if (nextStep) {
                    if(nextStep.type === 'timer') nextTypeClass = 'bg-timer-dull';
                    if(nextStep.type === 'judge') nextTypeClass = 'bg-judge-dull';
                }
                
                let extraHtml = '';
                if (step.type === 'timer') {
                    extraHtml = `
                        <div class="timer-unified-btn" id="unifiedTimerBtn" onclick="window.startStepTimer(${step.timerSeconds})">
                            <div class="timer-unified-progress" id="timerProgressBar" style="width: 100%;"></div>
                            <div class="timer-unified-text" id="timerDisplay">${step.timerSeconds}s 开始倒计时</div>
                        </div>
                    `;
                }
                
                let mediaSection = dish.mode === 'both' ? `
                    <div style="height: 200px; background:#000; flex-shrink:0; display:flex; overflow-x:auto; scroll-snap-type:x mandatory;">
                        ${tutorialsHtml}
                    </div>
                ` : '';

                html = `
                    <div class="guide-fullscreen">
                        <div class="cooking-header">
                            <div class="cooking-dish-name">${dish.recipe.name}</div>
                            <div class="cooking-progress-text">第 ${currentDishIdx+1}/${cookingQueue.length} 道菜 | 步骤 ${currentStepIdx+1}/${dish.steps.length}</div>
                        </div>
                        ${mediaSection}
                        <div class="cooking-cards-wrapper">
                            ${prevStep ? `
                            <div class="cooking-card cooking-card-prev">
                                <div class="step-content-box">${prevStep.content}</div>
                            </div>` : ''}
                            
                            <div class="cooking-card cooking-card-current ${typeClass}">
                                <div class="cooking-step-type">${typeName}</div>
                                <div class="step-content-box">
                                    <div class="cooking-step-content">${step.content}</div>
                                </div>
                                ${extraHtml}
                            </div>
                            
                            ${nextStep ? `
                            <div class="cooking-card cooking-card-next ${nextTypeClass}">
                                <div class="step-content-box">${nextStep.content}</div>
                            </div>` : ''}
                        </div>
                        <div class="cooking-action">
                            <div id="swipeSliderTrack" style="position:relative; width:90%; margin:0 auto; max-width:400px; height:60px; background:rgba(0,0,0,0.05); border-radius:30px; overflow:hidden;">
                                <div style="position:absolute; width:100%; text-align:center; line-height:60px; color:#999; font-weight:700; font-size:1rem; user-select:none; pointer-events:none;">向左滑动完成步骤</div>
                                <div id="swipeSliderThumb" style="position:absolute; right:0; top:0; width:60px; height:60px; border-radius:30px; background:var(--text-main); color:#fff; display:flex; justify-content:center; align-items:center; z-index:2; font-size:1.2rem; box-shadow:-5px 0 15px rgba(0,0,0,0.1); cursor:grab;">
                                    <i class="fa-solid fa-chevron-left"></i>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }
            root.innerHTML = html;
            
            // Slider Logic
            let sliderThumb = document.getElementById('swipeSliderThumb');
            let sliderTrack = document.getElementById('swipeSliderTrack');
            if (sliderThumb && sliderTrack) {
                let isDragging = false;
                let startX = 0;
                let currentTx = 0;
                let maxTx = sliderTrack.clientWidth - sliderThumb.clientWidth;

                const startDrag = (e) => {
                    isDragging = true;
                    startX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
                    sliderThumb.style.transition = 'none';
                };

                const onDrag = (e) => {
                    if (!isDragging) return;
                    let x = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
                    let deltaX = x - startX;
                    
                    // We are sliding LEFT, so deltaX will be negative
                    // Initial position is at RIGHT (right: 0), so translateX should go from 0 to -maxTx
                    if (deltaX > 0) deltaX = 0;
                    if (deltaX < -maxTx) deltaX = -maxTx;
                    
                    currentTx = deltaX;
                    sliderThumb.style.transform = `translateX(${currentTx}px)`;
                };

                const endDrag = (e) => {
                    if (!isDragging) return;
                    isDragging = false;
                    sliderThumb.style.transition = 'transform 0.3s';
                    
                    if (currentTx <= -maxTx * 0.7) {
                        // Success - slide all the way and finish
                        sliderThumb.style.transform = `translateX(${-maxTx}px)`;
                        setTimeout(() => window.finishStep(), 150);
                    } else {
                        // Revert
                        sliderThumb.style.transform = `translateX(0px)`;
                    }
                };

                sliderThumb.addEventListener('mousedown', startDrag);
                sliderThumb.addEventListener('touchstart', startDrag, {passive: false});
                document.addEventListener('mousemove', onDrag);
                document.addEventListener('touchmove', onDrag, {passive: false});
                document.addEventListener('mouseup', endDrag);
                document.addEventListener('touchend', endDrag);
            }
        } else if (guideState === 'DONE') {
            let html = `
                <div class="guide-fullscreen guide-done">
                    <div class="done-title">辛苦了</div>
                    <div class="done-subtitle">所有的美味都已就绪</div>
                    <button class="done-btn" onclick="window.finishGuide()">返回首页</button>
                </div>
            `;
            root.innerHTML = html;
        }
    };

    window.removeFromCart = function(id) {
        cartRecipeIds = cartRecipeIds.filter(x => x !== id);
        window.renderGrid();
        window.renderMatchGrid();
        if (guideState === 'CART' || guideState === 'ORDER' || guideState === 'PREP') renderGuide();
    };

    window.handleGuideSearch = function() {
        let q = document.getElementById('guideSearchInput').value.trim().toLowerCase();
        const resultsBox = document.getElementById('guideSearchResults');
        if (!q) {
            resultsBox.innerHTML = '';
            return;
        }
        
        let matches = recipes.filter(r => r.name.toLowerCase().includes(q) && !cartRecipeIds.includes(r.id));
        if (matches.length === 0) {
            resultsBox.innerHTML = '<div style="color:var(--text-muted); font-size:0.9rem; text-align:center;">无匹配菜谱或已在清单中</div>';
            return;
        }
        
        let html = matches.slice(0, 5).map(r => `
            <div class="cart-item" style="display:flex; align-items:center; padding: 0.5rem 1rem; margin-bottom: 0.5rem;">
                <img src="${window.getOSSUrl(r.coverUrl, 'cover_small')}" style="width:40px; height:40px; border-radius:8px; object-fit:cover; margin-right: 1rem; flex-shrink: 0;">
                <div style="font-weight:600; font-size:0.95rem; white-space: nowrap;">${r.name}</div>
                <div style="flex-grow: 1; border-bottom: 1px dashed rgba(0,0,0,0.15); margin: 0 1rem;"></div>
                <button class="add-to-cart-btn" style="flex-shrink: 0;" onclick="window.addToCart('${r.id}'); document.getElementById('guideSearchInput').value=''; window.handleGuideSearch();"><i class="fa-solid fa-plus"></i></button>
            </div>
        `).join('');
        resultsBox.innerHTML = html;
    };

    window.startPrep = function() {
        if (cartRecipeIds.length === 0) return;
        window.runWithOSS(() => {
            guideState = 'PREP';
            renderGuide();
        });
    };

    window.goToOrder = function() {
        guideState = 'ORDER';
        renderGuide();
    };

    window.moveOrder = function(idx, dir) {
        if (idx + dir < 0 || idx + dir >= cartRecipeIds.length) return;
        let temp = cartRecipeIds[idx];
        cartRecipeIds[idx] = cartRecipeIds[idx + dir];
        cartRecipeIds[idx + dir] = temp;
        renderGuide();
    };

    window.startCooking = function() {
        cookingQueue = cartRecipeIds.map(id => {
            let r = recipes.find(x => x.id === id);
            let steps = r.steps.filter(s => s.type !== 'prep');
            return { recipe: r, steps: steps, mode: 'steps' };
        }).filter(q => q.steps.length > 0 || (q.recipe.tutorials && q.recipe.tutorials.urls && q.recipe.tutorials.urls.length > 0));
        
        if (cookingQueue.length === 0) {
            guideState = 'DONE';
            renderGuide();
            return;
        }
        
        currentDishIdx = 0;
        currentStepIdx = 0;
        guideState = 'MODE_SELECT';
        renderGuide();
    };

    window.selectMode = function(mode) {
        if (currentDishIdx < cookingQueue.length) {
            cookingQueue[currentDishIdx].mode = mode;
        }
        guideState = 'COOKING';
        renderGuide();
    };

    window.startStepTimer = function(seconds) {
        if (timerInterval) clearInterval(timerInterval);
        let left = seconds;
        const display = document.getElementById('timerDisplay');
        const bar = document.getElementById('timerProgressBar');
        const btn = document.getElementById('unifiedTimerBtn');
        if(btn) btn.onclick = null; // prevent multiple clicks
        
        timerInterval = setInterval(() => {
            left--;
            if (display) display.innerText = left + 's';
            if (bar) bar.style.width = (left / seconds * 100) + '%';
            if (left <= 0) {
                clearInterval(timerInterval);
                timerInterval = null;
                if (display) display.innerText = '时间到！';
            }
        }, 1000);
    };

    window.finishDish = function() {
        let dish = cookingQueue[currentDishIdx];
        let today = new Date().toISOString().split('T')[0];
        if (!dish.recipe.cookedStats[today]) dish.recipe.cookedStats[today] = 0;
        dish.recipe.cookedStats[today]++;
        window.showToast(`✅ ${dish.recipe.name} 制作完成！`);
        
        currentDishIdx++;
        currentStepIdx = 0;
        
        if (currentDishIdx >= cookingQueue.length) {
            guideState = 'DONE';
        } else {
            guideState = 'MODE_SELECT';
        }
        
        renderGuide();
    };

    window.finishStep = function() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        
        currentStepIdx++;
        let dish = cookingQueue[currentDishIdx];
        
        if (currentStepIdx >= dish.steps.length) {
            window.finishDish();
            return;
        }
        
        renderGuide();
    };

    window.finishGuide = function() {
        window.runWithOSS(async () => {
            // mark all items in cart as cooked
            let updated = false;
            for (let id of cartRecipeIds) {
                let r = recipes.find(x => x.id === id);
                if (r) {
                    if (!r.cookedStats) r.cookedStats = {};
                    r.cookedStats[userStr] = (r.cookedStats[userStr] || 0) + 1;
                    updated = true;
                }
            }
            
            if (updated) {
                try {
                    await window.saveDataToOSS();
                } catch (e) {
                    alert("同步做菜记录至云端失败，但本地已更新: " + e.message);
                }
            }
            
            guideState = 'CART';
            cartRecipeIds = [];
            document.querySelector('.tab-item[data-view="homeView"]').click();
            window.renderGrid(); // update stats visually
            if(document.getElementById('profileView').classList.contains('active')) renderProfile();
            renderGuide();
        });
    };

    // Carousel Logic
    window.scrollCarousel = function(dir) {
        const carousel = document.getElementById('detailCarousel');
        if (!carousel) return;
        const width = carousel.clientWidth;
        carousel.scrollBy({ left: dir * width, behavior: 'smooth' });
    };

    window.updateCarouselDots = function() {
        const carousel = document.getElementById('detailCarousel');
        const dotsContainer = document.getElementById('carouselDots');
        if (!carousel || !dotsContainer) return;
        
        let index = Math.round(carousel.scrollLeft / carousel.clientWidth);
        let dots = dotsContainer.querySelectorAll('.dot');
        dots.forEach((d, i) => {
            if (i === index) d.classList.add('active');
            else d.classList.remove('active');
        });
    };

    window.renderGrid = renderGrid;
    window.renderMatchGrid = renderMatchGrid;
});
