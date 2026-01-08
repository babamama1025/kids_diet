document.addEventListener('DOMContentLoaded', () => {
    const appContainer = document.getElementById('app-container');
    let state = {};

    // --- UTILS ---
    const showToast = (message, type = 'success') => {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => document.body.removeChild(toast), 500);
        }, 3000);
    };

    const render = (view, props = {}) => {
        appContainer.innerHTML = '';
        const viewElement = document.createElement('div');
        viewElement.innerHTML = views[view](props);
        appContainer.appendChild(viewElement);
        bindEvents(view);
    };

    const handleApiResponse = (response) => {
        if (response.error) {
            showToast(response.error, 'error');
            return false;
        } else {
            if (response.message) showToast(response.message);
            state.data = response.data || response;
            return true;
        }
    };

    // --- HELPER FUNCTIONS ---
    const displayDailyDetails = (dateString, targetElementId) => {
        const log = state.data.daily_logs[dateString];
        const pointsForDay = state.data.points_history.filter(p => p.timestamp.startsWith(dateString));

        let detailsHTML = `<h4>${dateString}</h4>`;

        // Diet and Exercise
        detailsHTML += `<p><b>飲食:</b><br>${log?.diet?.join(', ') || '未記錄'}</p>`;
        detailsHTML += `<p><b>運動:</b><br>${log?.exercise?.join(', ') || '未記錄'}</p>`;
        detailsHTML += `<p><b>任務完成:</b> ${log?.completed ? '是' : '否'}</p>`;

        // Points History
        detailsHTML += `<hr><h5>點數紀錄:</h5>`;
        if (pointsForDay.length > 0) {
            detailsHTML += '<ul class="points-history-list">';
            // Reverse to show earliest first for the day
            pointsForDay.slice().reverse().forEach(p => {
                const pointClass = p.points_change >= 0 ? 'points-gain' : 'points-loss';
                const sign = p.points_change > 0 ? '+' : '';
                detailsHTML += `<li><span class="timestamp">${p.timestamp.split(' ')[1]}</span> ${p.description}: <span class="${pointClass}">${sign}${p.points_change}</span> (總計: ${p.current_total})</li>`;
            });
            detailsHTML += '</ul>';
        } else {
            detailsHTML += '<p>當天沒有點數變動</p>';
        }

        document.getElementById(targetElementId).innerHTML = detailsHTML;
    };

    // --- VIEWS / TEMPLATES ---
    const views = {
        setup: () => `
            <div class="card">
                <h2>歡迎！</h2>
                <p>請先完成初始設定，開始你的健康冒險！</p>
                <div class="input-group">
                    <label for="name">你的名字：</label>
                    <input type="text" id="name" required>
                </div>
                <div class="input-group">
                    <label>你的性別：</label>
                    <div class="gender-group">
                        <label><input type="radio" name="gender" value="boys" checked> 男生</label>
                        <label><input type="radio" name="gender" value="girls"> 女生</label>
                    </div>
                </div>
                <div class="input-group">
                    <label for="birthdate">你的生日：</label>
                    <input type="date" id="birthdate" required>
                </div>
                <div class="input-group">
                    <label for="height">身高 (cm)：</label>
                    <input type="number" id="height" required>
                </div>
                <div class="input-group">
                    <label for="initial_weight">初始體重 (kg)：</label>
                    <input type="number" id="initial_weight" required>
                </div>
                <div class="input-group">
                    <label for="target_weight">目標體重 (kg)：</label>
                    <input type="number" id="target_weight" required>
                </div>
                <button id="save-initial">開始冒險！</button>
            </div>
        `,
        dashboard: () => {
            const { name, points, weight_history, daily_logs, bmi_info, current_streak } = state.data;
            const current_weight = weight_history.length > 0 ? weight_history[weight_history.length - 1].weight : 'N/A';
            const tip = state.config.daily_tips[Math.floor(Math.random() * state.config.daily_tips.length)];
            // Manually format today's date string to avoid timezone issues with toISOString()
            const d = new Date();
            const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            const todayLog = daily_logs[today] || {};
            const isCompleted = todayLog.completed;
            const dietLogged = todayLog.diet && todayLog.diet.length > 0;
            const exerciseLogged = todayLog.exercise && todayLog.exercise.length > 0;

            const bmi_html = bmi_info ? 
                `<div class="stat-item">
                    <h3>BMI <span class="bmi-status status-${bmi_info.status}">${bmi_info.status}</span></h3>
                    <p>${bmi_info.bmi}</p>
                </div>` : '';

            return `
                <div class="card">
                    <h2>嗨，${name}！</h2>
                    <p>${tip}</p>
                    <div class="stats-grid">
                        <div class="stat-item"><h3>目前體重</h3><p>${current_weight} kg</p></div>
                        ${bmi_html}
                        <div class="stat-item"><h3>連續任務</h3><p>${current_streak} 天</p></div>
                        <div class="stat-item"><h3>我的點數 <a href="#" class="info-link" data-view="rules">?</a></h3><p>${points}</p></div>
                    </div>
                </div>
                <div class="card">
                    ${isCompleted ? '<p style="color: var(--success-color); text-align: center; font-weight: bold;">今日任務已完成！</p>' : '<button id="complete-day" class="success">✔️ 完成今天任務</button>'}
                    <div class="button-group">
                        <button data-view="dynamicTasks" class="dynamic-tasks-btn">🎯 動態任務</button>
                        <button data-view="manageTasks">⚙️ 任務管理</button>
                        <button data-view="logHealth">更新身高及體重</button>
                        <button data-view="rewards">獎勵商店</button>
                        <button data-view="logExercise" class="${exerciseLogged ? 'logged' : ''}">紀錄運動 ${exerciseLogged ? '✓' : ''}</button>
                        <button data-view="logDiet" class="${dietLogged ? 'logged' : ''}">紀錄飲食 ${dietLogged ? '✓' : ''}</button>
                        <button data-view="history">歷史紀錄</button>
                        <button data-view="chart">進度圖表</button>
                        <button data-view="calendar">日曆</button>
                    </div>
                </div>
            `;
        },
        logHealth: () => `
            <div class="card">
                <h2>更新身高及體重</h2>
                <div class="input-group">
                    <label for="new_height">今天身高 (cm)：</label>
                    <input type="number" id="new_height" value="${state.data.height}" required>
                </div>
                <div class="input-group">
                    <label for="new_weight">今天體重 (kg)：</label>
                    <input type="number" id="new_weight" required>
                </div>
                <button id="save-health">儲存</button>
                <button data-view="dashboard" class="secondary">返回</button>
            </div>
        `,
        logDiet: () => `
            <div class="card" id="diet-view">
                <h2>記錄今日飲食</h2>
                <div class="checklist-group">
                    ${state.config.diet_options.map(opt => `
                        <div class="item">
                            <input type="checkbox" id="diet-${opt}" value="${opt}">
                            <label for="diet-${opt}">${opt}</label>
                        </div>
                    `).join('')}
                </div>
                <button id="save-diet">儲存</button>
                <button data-view="dashboard" class="secondary">返回</button>
            </div>
        `,
        logExercise: () => `
            <div class="card" id="exercise-view">
                <h2>記錄今日運動</h2>
                <div class="checklist-group">
                    ${state.config.exercise_options.map(opt => `
                        <div class="item">
                            <input type="checkbox" id="ex-${opt}" value="${opt}">
                            <label for="ex-${opt}">${opt}</label>
                        </div>
                    `).join('')}
                </div>
                <button id="save-exercise">儲存</button>
                <button data-view="dashboard" class="secondary">返回</button>
            </div>
        `,
        rewards: () => `
            <div class="card">
                <h2>獎勵商店 (你有 ${state.data.points} 點)</h2>
                ${Object.entries(state.config.rewards).map(([cost, reward]) => `
                    <div class="reward-item">
                        <div>
                            <p>${reward}</p>
                            <p class="cost">${cost} 點</p>
                        </div>
                        <button class="redeem-reward" data-cost="${cost}" ${state.data.points < cost ? 'disabled' : ''}>兌換</button>
                    </div>
                `).join('')}
                <button data-view="dashboard" class="secondary">返回</button>
            </div>
        `,
        history: () => `
            <div class="card">
                <h2>歷史紀錄</h2>
                <ul class="history-list">
                    ${Object.keys(state.data.daily_logs).sort().reverse().map(date => `<li data-date="${date}">${date}</li>`).join('')}
                </ul>
                <div id="history-details">點擊上方日期查看詳情</div>
                <button data-view="dashboard" class="secondary">返回</button>
            </div>
        `,
        chart: () => `
            <div class="card">
                <h2>體重與BMI進度圖表</h2>
                <canvas id="healthChart"></canvas>
                <button data-view="dashboard" class="secondary">返回</button>
            </div>
        `,
        rules: () => `
            <div class="card">
                <h2>點數獲得規則</h2>
                <ul class="rules-list">
                    <li>每記錄一項<b>飲食</b>項目，可獲得 <b>1</b> 點。</li>
                    <li>每記錄一項<b>運動</b>項目，可獲得 <b>2</b> 點。</li>
                    <li>點數會在點擊主畫面的「✔️ 完成今天任務」按鈕後，才會計算並累加到總點數中。</li>
                    <li>連續完成7天任務，可額外獲得 <b>10</b> 點。</li>
                    <li>連續完成30天任務，可額外獲得 <b>10</b> 點。</li>
                </ul>
                <button data-view="dashboard" class="secondary">返回主畫面</button>
            </div>
        `,
        calendar: () => `
            <div class="card">
                <h2>任務日曆</h2>
                <div class="calendar-nav">
                    <button id="prevMonth">上個月</button>
                    <h3 id="currentMonthYear"></h3>
                    <button id="nextMonth">下個月</button>
                </div>
                <div class="calendar-grid" id="calendarGrid">
                    <!-- Days of the week -->
                    <div class="day-name">日</div>
                    <div class="day-name">一</div>
                    <div class="day-name">二</div>
                    <div class="day-name">三</div>
                    <div class="day-name">四</div>
                    <div class="day-name">五</div>
                    <div class="day-name">六</div>
                    <!-- Calendar days will be inserted here by JS -->
                </div>
                <div id="calendar-history-details" class="history-details">點擊日曆上的日期查看詳情</div>
                <button data-view="dashboard" class="secondary">返回</button>
            </div>
        `,
        dynamicTasks: () => {
            const tasks = state.data.active_dynamic_tasks || [];

            if (tasks.length === 0) {
                return `
                    <div class="card">
                        <h2>🎯 動態任務</h2>
                        <p style="text-align: center; color: var(--light-text-color);">
                            目前沒有可用的動態任務喔！
                        </p>
                        <button data-view="dashboard" class="secondary">返回</button>
                    </div>
                `;
            }

            return `
                <div class="card">
                    <h2>🎯 動態任務</h2>
                    <p>完成任務就能獲得點數！</p>
                    <div class="dynamic-tasks-list">
                        ${tasks.map(task => {
                            const hours = Math.floor(task.time_remaining / 3600);
                            const minutes = Math.floor((task.time_remaining % 3600) / 60);
                            const timeText = hours > 0 ? `${hours}小時${minutes}分` : `${minutes}分鐘`;

                            return `
                                <div class="dynamic-task-item ${task.is_completed ? 'completed' : ''}">
                                    <div class="task-header">
                                        <h3>${task.title}</h3>
                                        <span class="task-points">+${task.points_reward} 點</span>
                                    </div>
                                    ${task.description ? `<p class="task-description">${task.description}</p>` : ''}
                                    <div class="task-footer">
                                        <span class="task-timer">⏰ 剩餘: ${timeText}</span>
                                        ${task.is_completed
                                            ? '<span class="task-status completed">✓ 已完成</span>'
                                            : `<button class="complete-dynamic-task" data-task-id="${task.id}">完成任務</button>`
                                        }
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                    <button data-view="dashboard" class="secondary">返回</button>
                </div>
            `;
        },
        manageTasks: () => `
            <div class="card">
                <h2>任務管理中心</h2>
                <p style="color: var(--light-text-color); font-size: 14px;">
                    家長專用：創建和管理動態任務
                </p>
                <button id="create-task-btn" class="success">+ 創建新任務</button>
                <button id="view-all-tasks-btn">查看所有任務</button>
                <button data-view="dashboard" class="secondary">返回</button>
            </div>
        `,
        createTask: () => {
            const now = new Date();
            const today = now.toISOString().split('T')[0];
            const currentTime = now.toTimeString().slice(0, 5);

            return `
                <div class="card">
                    <h2>創建動態任務</h2>
                    <div class="input-group">
                        <label for="task-title">任務標題 *</label>
                        <input type="text" id="task-title" placeholder="例：整理房間" required>
                    </div>
                    <div class="input-group">
                        <label for="task-description">任務描述（可選）</label>
                        <textarea id="task-description" rows="3" placeholder="詳細說明任務內容..."></textarea>
                    </div>
                    <div class="input-group">
                        <label for="task-points">獎勵點數 *</label>
                        <input type="number" id="task-points" min="1" value="5" required>
                    </div>
                    <div class="input-group">
                        <label for="task-start-date">開始日期 *</label>
                        <input type="date" id="task-start-date" value="${today}" required>
                    </div>
                    <div class="input-group">
                        <label for="task-start-time">開始時間 *</label>
                        <input type="time" id="task-start-time" value="${currentTime}" required>
                    </div>
                    <div class="input-group">
                        <label for="task-end-date">結束日期 *</label>
                        <input type="date" id="task-end-date" value="${today}" required>
                    </div>
                    <div class="input-group">
                        <label for="task-end-time">結束時間 *</label>
                        <input type="time" id="task-end-time" value="23:59" required>
                    </div>
                    <button id="save-task" class="success">創建任務</button>
                    <button data-view="manageTasks" class="secondary">取消</button>
                </div>
            `;
        },
        allTasks: () => `
            <div class="card">
                <h2>所有任務</h2>
                <div id="all-tasks-container">
                    <p style="text-align: center;">載入中...</p>
                </div>
                <button data-view="manageTasks" class="secondary">返回</button>
            </div>
        `
    };

    // --- EVENT BINDING ---
    const bindEvents = (view) => {
        document.querySelectorAll('[data-view]').forEach(el => {
            el.onclick = (e) => { 
                e.preventDefault(); // 防止 a 標籤跳轉
                render(el.dataset.view); 
            };
        });

        if (view === 'setup') {
            document.getElementById('save-initial').onclick = async () => {
                const formData = {
                    name: document.getElementById('name').value,
                    gender: document.querySelector('input[name="gender"]:checked').value,
                    birthdate: document.getElementById('birthdate').value,
                    height: document.getElementById('height').value,
                    initial_weight: document.getElementById('initial_weight').value,
                    target_weight: document.getElementById('target_weight').value,
                };
                const response = await eel.save_initial(formData)();
                if (handleApiResponse(response)) render('dashboard');
            };
        } else if (view === 'dashboard') {
            const completeBtn = document.getElementById('complete-day');
            if(completeBtn) completeBtn.onclick = async () => {
                const response = await eel.complete_day()();
                if (handleApiResponse(response)) render('dashboard');
            };
        } else if (view === 'logHealth') {
            document.getElementById('save-health').onclick = async () => {
                const height = document.getElementById('new_height').value;
                const weight = document.getElementById('new_weight').value;
                const response = await eel.save_height_and_weight(height, weight)();
                if (handleApiResponse(response)) render('dashboard');
            };
        } else if (view === 'logDiet') {
            document.getElementById('save-diet').onclick = async () => {
                const selected = Array.from(document.querySelectorAll('#diet-view input:checked')).map(el => el.value);
                const response = await eel.save_diet(selected)();
                if (handleApiResponse(response)) render('dashboard');
            };
        } else if (view === 'logExercise') {
            document.getElementById('save-exercise').onclick = async () => {
                const selected = Array.from(document.querySelectorAll('#exercise-view input:checked')).map(el => el.value);
                const response = await eel.save_exercise(selected)();
                if (handleApiResponse(response)) render('dashboard');
            };
        } else if (view === 'rewards') {
            document.querySelectorAll('.redeem-reward').forEach(btn => {
                btn.onclick = async () => {
                    const response = await eel.redeem_reward(btn.dataset.cost)();
                    if (handleApiResponse(response)) render('rewards');
                };
            });
        } else if (view === 'history') {
            document.querySelectorAll('.history-list li').forEach(li => {
                li.onclick = () => {
                    displayDailyDetails(li.dataset.date, 'history-details');
                };
            });
        } else if (view === 'chart') {
            const ctx = document.getElementById('healthChart').getContext('2d');
            const weightChartData = state.data.weight_history.map(item => ({x: item.date, y: item.weight}));
            const bmiChartData = state.data.weight_history.filter(item => item.bmi).map(item => ({x: item.date, y: item.bmi}));

            new Chart(ctx, {
                type: 'line',
                data: {
                    datasets: [
                        {
                            label: '體重 (kg)',
                            data: weightChartData,
                            borderColor: 'var(--primary-color)',
                            backgroundColor: 'rgba(74, 144, 226, 0.1)',
                            fill: true,
                            tension: 0.1,
                            yAxisID: 'y-weight'
                        },
                        {
                            label: 'BMI',
                            data: bmiChartData,
                            borderColor: 'var(--accent-color)',
                            backgroundColor: 'rgba(255, 99, 132, 0.1)',
                            fill: false,
                            tension: 0.1,
                            yAxisID: 'y-bmi'
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            type: 'time',
                            time: {
                                unit: 'day'
                            },
                            title: {
                                display: true,
                                text: '日期'
                            }
                        },
                        'y-weight': {
                            type: 'linear',
                            position: 'left',
                            title: {
                                display: true,
                                text: '體重 (kg)'
                            },
                            beginAtZero: false
                        },
                        'y-bmi': {
                            type: 'linear',
                            position: 'right',
                            title: {
                                display: true,
                                text: 'BMI'
                            },
                            grid: {
                                drawOnChartArea: false // 只在左側Y軸繪製網格線
                            },
                            beginAtZero: false
                        }
                    }
                }
            });
        } else if (view === 'calendar') {
            let currentCalendarDate = new Date(); // Track current month being viewed

            const renderCalendar = (date) => {
                const year = date.getFullYear();
                const month = date.getMonth(); // 0-indexed
                document.getElementById('currentMonthYear').textContent = `${year}年 ${month + 1}月`;

                const firstDayOfMonth = new Date(year, month, 1);
                const lastDayOfMonth = new Date(year, month + 1, 0);
                const daysInMonth = lastDayOfMonth.getDate();

                const startDayOfWeek = firstDayOfMonth.getDay(); // 0 for Sunday, 1 for Monday

                const calendarGrid = document.getElementById('calendarGrid');
                calendarGrid.innerHTML = `
                    <div class="day-name">日</div>
                    <div class="day-name">一</div>
                    <div class="day-name">二</div>
                    <div class="day-name">三</div>
                    <div class="day-name">四</div>
                    <div class="day-name">五</div>
                    <div class="day-name">六</div>
                `; // Reset grid and add day names

                // Add empty leading days
                for (let i = 0; i < startDayOfWeek; i++) {
                    const emptyDay = document.createElement('div');
                    emptyDay.className = 'calendar-day empty';
                    calendarGrid.appendChild(emptyDay);
                }

                const dailyLogs = state.data.daily_logs || {};

                for (let day = 1; day <= daysInMonth; day++) {
                    // 修正時區問題：手動格式化日期字串，避免 toISOString() 轉換成 UTC 時間
                    const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const dayElement = document.createElement('div');
                    dayElement.className = 'calendar-day';
                    dayElement.textContent = day;

                    if (dailyLogs[dateString] && dailyLogs[dateString].completed === true) {
                        dayElement.classList.add('completed');
                        dayElement.title = '任務已完成！';
                    }
                    dayElement.dataset.date = dateString; // Add data-date attribute
                    calendarGrid.appendChild(dayElement);
                }

                // Add event listeners to calendar days
                document.querySelectorAll('.calendar-day:not(.empty)').forEach(dayEl => {
                    dayEl.onclick = () => {
                        displayDailyDetails(dayEl.dataset.date, 'calendar-history-details');
                    };
                });
            };

            document.getElementById('prevMonth').onclick = () => {
                currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
                renderCalendar(currentCalendarDate);
            };

            document.getElementById('nextMonth').onclick = () => {
                currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
                renderCalendar(currentCalendarDate);
            };

            renderCalendar(currentCalendarDate); // Initial render
        } else if (view === 'dynamicTasks') {
            // 綁定「完成任務」按鈕
            document.querySelectorAll('.complete-dynamic-task').forEach(btn => {
                btn.onclick = async () => {
                    const taskId = parseInt(btn.dataset.taskId);
                    const response = await eel.complete_dynamic_task(taskId)();
                    if (handleApiResponse(response)) render('dynamicTasks');
                };
            });
        } else if (view === 'manageTasks') {
            document.getElementById('create-task-btn').onclick = () => {
                render('createTask');
            };
            document.getElementById('view-all-tasks-btn').onclick = () => {
                render('allTasks');
            };
        } else if (view === 'createTask') {
            document.getElementById('save-task').onclick = async () => {
                const taskData = {
                    title: document.getElementById('task-title').value,
                    description: document.getElementById('task-description').value,
                    points_reward: document.getElementById('task-points').value,
                    start_time: document.getElementById('task-start-date').value + 'T' +
                               document.getElementById('task-start-time').value + ':00',
                    end_time: document.getElementById('task-end-date').value + 'T' +
                             document.getElementById('task-end-time').value + ':00'
                };
                const response = await eel.create_dynamic_task(taskData)();
                if (handleApiResponse(response)) render('manageTasks');
            };
        } else if (view === 'allTasks') {
            // 載入所有任務
            loadAllTasks();
        }
    };

    // --- HELPER FUNCTIONS (continued) ---
    const loadAllTasks = async () => {
        const response = await eel.get_all_dynamic_tasks()();
        const tasks = response.tasks || [];

        const container = document.getElementById('all-tasks-container');

        if (tasks.length === 0) {
            container.innerHTML = '<p style="text-align: center;">尚未創建任何任務</p>';
            return;
        }

        const statusText = {
            'active': '進行中',
            'expired': '已過期',
            'upcoming': '未開始'
        };

        const statusClass = {
            'active': 'status-active',
            'expired': 'status-expired',
            'upcoming': 'status-upcoming'
        };

        container.innerHTML = `
            <div class="all-tasks-list">
                ${tasks.map(task => `
                    <div class="task-item ${statusClass[task.status]}">
                        <div class="task-header">
                            <h4>${task.title}</h4>
                            <span class="task-status-badge ${statusClass[task.status]}">
                                ${statusText[task.status]}
                            </span>
                        </div>
                        ${task.description ? `<p>${task.description}</p>` : ''}
                        <div class="task-meta">
                            <span>點數: ${task.points_reward}</span>
                            <span>時間: ${new Date(task.start_time).toLocaleString('zh-TW')} -
                                  ${new Date(task.end_time).toLocaleString('zh-TW')}</span>
                        </div>
                        ${task.is_active ?
                            `<button class="delete-task" data-task-id="${task.id}">刪除</button>` :
                            '<span style="color: var(--light-text-color);">已刪除</span>'
                        }
                    </div>
                `).join('')}
            </div>
        `;

        // 綁定刪除按鈕
        document.querySelectorAll('.delete-task').forEach(btn => {
            btn.onclick = async () => {
                if (confirm('確定要刪除此任務嗎？')) {
                    const taskId = parseInt(btn.dataset.taskId);
                    const response = await eel.delete_dynamic_task(taskId)();
                    if (handleApiResponse(response)) {
                        loadAllTasks(); // 重新載入
                    }
                }
            };
        });
    };

    // --- INITIALIZATION ---
    const init = async () => {
        const response = await eel.get_app_data()();
        if (response.error) {
            appContainer.innerHTML = `<div class="card"><h2>錯誤</h2><p>${response.error}</p></div>`;
            return;
        }
        state = response;
        if (!state.data || !state.data.name) {
            render('setup');
        } else {
            render('dashboard');
        }
    };

    init();
});
