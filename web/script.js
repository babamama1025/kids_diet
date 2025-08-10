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
            const today = new Date().toISOString().split('T')[0];
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
                <button data-view="dashboard" class="secondary">返回</button>
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
                    const log = state.data.daily_logs[li.dataset.date];
                    const details = document.getElementById('history-details');
                    details.innerHTML = `
                        <h4>${li.dataset.date}</h4>
                        <p><b>飲食:</b><br>${log.diet?.join(', ') || '未記錄'}</p>
                        <p><b>運動:</b><br>${log.exercise?.join(', ') || '未記錄'}</p>
                        <p><b>任務完成:</b> ${log.completed ? '是' : '否'}</p>
                    `;
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

            const renderCalendar = async (date) => {
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

                const response = await eel.get_calendar_data()();
                const dailyLogs = response.daily_logs || {};

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
                    calendarGrid.appendChild(dayElement);
                }
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
        }
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
