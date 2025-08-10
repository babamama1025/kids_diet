import eel
import json
import datetime
import os
import random
from bisect import bisect_left

# --- 常數設定 ---
# 為了適應 Render 的永續儲存碟 (Persistent Disk)，動態決定資料檔案路徑
# 在 Render 環境中，我們預期 /data 資料夾會被掛載
if os.path.exists('/data'):
    # 如果 /data 存在，就使用永續儲存碟的路徑
    DATA_FILE = os.path.join('/data', 'kid_weight_manager.json')
else:
    # 否則，使用專案內的本地檔案 (方便在本機測試)
    DATA_FILE = "kid_weight_manager.json"

CONFIG_FILE = "config.json"

# --- Eel 初始化 ---
eel.init('web')

# --- BMI 標準 (資料來源: 衛生福利部國民健康署) ---
# 為了方便查詢，這裡使用簡化後的表格，以半歲為單位
# 欄位: age_in_months, p5, p15, p50, p85, p95
BMI_CHART = {
    "boys": [
        [24, 13.9, 14.8, 16.1, 17.4, 18.1], [30, 13.6, 14.4, 15.7, 16.9, 17.6],
        [36, 13.4, 14.2, 15.4, 16.6, 17.3], [42, 13.2, 14.0, 15.2, 16.4, 17.1],
        [48, 13.1, 13.8, 15.0, 16.2, 16.9], [54, 13.0, 13.7, 14.9, 16.1, 16.8],
        [60, 12.9, 13.6, 14.8, 16.1, 16.8], [66, 12.9, 13.6, 14.8, 16.2, 17.0],
        [72, 12.9, 13.6, 14.8, 16.3, 17.1], [78, 12.9, 13.7, 14.9, 16.5, 17.4],
        [84, 13.0, 13.8, 15.1, 16.8, 17.8], [90, 13.1, 13.9, 15.3, 17.1, 18.2],
        [96, 13.2, 14.1, 15.5, 17.4, 18.6], [102, 13.4, 14.3, 15.8, 17.8, 19.1],
        [108, 13.6, 14.5, 16.1, 18.2, 19.6], [114, 13.8, 14.7, 16.4, 18.6, 20.1],
        [120, 14.0, 15.0, 16.7, 19.1, 20.7], [126, 14.2, 15.2, 17.0, 19.5, 21.3],
        [132, 14.5, 15.5, 17.4, 20.0, 21.9], [138, 14.8, 15.8, 17.8, 20.5, 22.5],
        [144, 15.0, 16.1, 18.2, 21.0, 23.2], [150, 15.3, 16.4, 18.6, 21.5, 23.8],
        [156, 15.6, 16.7, 19.0, 22.0, 24.4], [162, 15.9, 17.0, 19.4, 22.5, 25.0],
        [168, 16.2, 17.3, 19.8, 23.0, 25.6], [174, 16.5, 17.6, 20.2, 23.5, 26.1],
        [180, 16.8, 17.9, 20.6, 23.9, 26.5], [186, 17.0, 18.2, 21.0, 24.3, 26.9],
        [192, 17.3, 18.5, 21.3, 24.7, 27.3], [198, 17.5, 18.7, 21.6, 25.0, 27.6],
        [204, 17.7, 18.9, 21.9, 25.3, 27.9], [210, 17.9, 19.1, 22.1, 25.6, 28.2],
        [216, 18.1, 19.3, 22.4, 25.8, 28.5]
    ],
    "girls": [
        [24, 13.5, 14.4, 15.8, 17.2, 17.9], [30, 13.2, 14.1, 15.4, 16.8, 17.6],
        [36, 12.9, 13.8, 15.1, 16.5, 17.4], [42, 12.7, 13.6, 14.9, 16.3, 17.2],
        [48, 12.6, 13.5, 14.8, 16.2, 17.1], [54, 12.5, 13.4, 14.7, 16.2, 17.1],
        [60, 12.4, 13.3, 14.6, 16.2, 17.2], [66, 12.4, 13.3, 14.6, 16.3, 17.4],
        [72, 12.4, 13.3, 14.7, 16.5, 17.6], [78, 12.5, 13.4, 14.9, 16.8, 18.0],
        [84, 12.6, 13.6, 15.1, 17.2, 18.5], [90, 12.8, 13.8, 15.4, 17.6, 19.0],
        [96, 13.0, 14.0, 15.7, 18.0, 19.5], [102, 13.2, 14.3, 16.0, 18.5, 20.1],
        [108, 13.5, 14.6, 16.4, 19.0, 20.8], [114, 13.8, 14.9, 16.8, 19.5, 21.4],
        [120, 14.1, 15.2, 17.2, 20.1, 22.1], [126, 14.4, 15.6, 17.6, 20.6, 22.8],
        [132, 14.8, 16.0, 18.1, 21.2, 23.5], [138, 15.1, 16.4, 18.5, 21.8, 24.2],
        [144, 15.5, 16.8, 19.0, 22.4, 24.9], [150, 15.8, 17.1, 19.5, 22.9, 25.5],
        [156, 16.1, 17.5, 19.9, 23.4, 26.1], [162, 16.4, 17.8, 20.3, 23.9, 26.6],
        [168, 16.7, 18.1, 20.7, 24.3, 27.1], [174, 16.9, 18.3, 21.0, 24.7, 27.6],
        [180, 17.1, 18.5, 21.3, 25.1, 28.0], [186, 17.3, 18.7, 21.5, 25.4, 28.3],
        [192, 17.5, 18.9, 21.8, 25.6, 28.6], [198, 17.6, 19.1, 22.0, 25.8, 28.8],
        [204, 17.7, 19.2, 22.1, 26.0, 29.0], [210, 17.8, 19.3, 22.3, 26.2, 29.2],
        [216, 17.9, 19.4, 22.4, 26.3, 29.3]
    ]
}

# --- 資料處理函式 ---
def load_config():
    try:
        with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"讀取設定檔 {CONFIG_FILE} 失敗: {e}")
        return None

def load_data():
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, 'r', encoding='utf-8') as f:
                content = f.read()
                if not content:
                    return create_new_data()
                return json.loads(content)
        except Exception as e:
            print(f"讀取資料檔 {DATA_FILE} 失敗: {e}")
            return create_new_data()
    return create_new_data()

def create_new_data():
    return {
        "name": "", "target_weight": 0, "points": 0,
        "height": 0, "birthdate": "", "gender": "",
        "weight_history": [], "daily_logs": {},
        "last_7_day_award_date": None,
        "last_30_day_award_date": None
    }

def save_data(data):
    try:
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
        return True
    except Exception as e:
        print(f"儲存資料檔 {DATA_FILE} 失敗: {e}")
        return False

def calculate_bmi_status(birthdate_str, gender, weight, height_cm, record_date_str=None):
    if not all([birthdate_str, gender, weight, height_cm]):
        return None
    try:
        birthdate = datetime.datetime.strptime(birthdate_str, "%Y-%m-%d").date()
        
        record_date = None
        if record_date_str:
            record_date = datetime.datetime.strptime(record_date_str, "%Y-%m-%d").date()
        else:
            record_date = datetime.date.today()

        age_in_months = (record_date.year - birthdate.year) * 12 + (record_date.month - birthdate.month)
        height_m = height_cm / 100.0
        bmi = round(weight / (height_m ** 2), 1)

        chart = BMI_CHART.get(gender)
        if not chart:
            return {"bmi": bmi, "status": "未知(無性別資料)"}

        ages = [row[0] for row in chart]
        # 使用二分搜尋法找到最接近的年齡區間
        idx = bisect_left(ages, age_in_months)
        if idx >= len(ages):
            idx = len(ages) - 1
        
        _, p5, _, _, p85, p95 = chart[idx]

        status = ""
        if bmi < p5:
            status = "體重過輕"
        elif p5 <= bmi < p85:
            status = "體位適中"
        elif p85 <= bmi < p95:
            status = "體重過重"
        else: # bmi >= p95
            status = "肥胖"
        
        return {"bmi": bmi, "status": status}
    except (ValueError, TypeError):
        return None

# --- Eel 公開函式 ---
@eel.expose
def get_app_data():
    config = load_config()
    data = load_data()
    if config is None or data is None:
        return {"error": "無法載入設定或資料檔案。"}
    
    if data.get("name"): # 如果是已設定的用戶，才計算BMI
        # 計算歷史BMI
        for record in data['weight_history']:
            # 舊資料可能沒有身高，要處理一下
            if 'height' in record:
                bmi_info = calculate_bmi_status(
                    data.get('birthdate'), data.get('gender'), 
                    record['weight'], record['height'],
                    record_date_str=record['date']
                )
                if bmi_info:
                    record['bmi'] = bmi_info.get('bmi')
                    record['bmi_status'] = bmi_info.get('status')
        
        # Ensure all daily_logs have a 'completed' status for consistency
        for date_str, log_entry in data['daily_logs'].items():
            if 'completed' not in log_entry:
                log_entry['completed'] = False

        # 計算最新的BMI狀態，給主畫面用
        if data['weight_history']:
            latest_record = data['weight_history'][-1]
            data['bmi_info'] = {
                "bmi": latest_record.get('bmi'),
                "status": latest_record.get('bmi_status')
            }
        else:
            data['bmi_info'] = None

    return {"config": config, "data": data}

@eel.expose
def save_initial(form_data):
    if not all(form_data.values()):
        return {"error": "所有欄位都必須填寫！"}
    try:
        initial_weight = float(form_data['initial_weight'])
        target_weight = float(form_data['target_weight'])
        height = float(form_data['height'])

        if initial_weight <= 0 or target_weight <= 0 or height <= 0:
            raise ValueError("體重和身高必須是正數")

        data = create_new_data()
        data.update(form_data)
        data['initial_weight'] = initial_weight
        data['target_weight'] = target_weight
        data['height'] = height

        today_str = str(datetime.date.today())
        data["weight_history"].append({"date": today_str, "weight": initial_weight, "height": height})
        
        save_data(data)
        # 回傳前也先算好BMI
        data['bmi_info'] = calculate_bmi_status(data['birthdate'], data['gender'], initial_weight, height, today_str)
        return data
    except ValueError:
        return {"error": "體重和身高請輸入有效的正數！"}

@eel.expose
def save_height_and_weight(height_str, weight_str):
    if not weight_str or not height_str:
        return {"error": "請輸入身高和體重！"}
    try:
        new_weight = float(weight_str)
        new_height = float(height_str)
        if new_weight <= 0 or new_height <= 0:
            raise ValueError("身高和體重必須是正數")
        
        data = load_data()
        data['height'] = new_height  # 更新最外層的最新身高
        
        today_str = str(datetime.date.today())
        found = False
        for record in data['weight_history']:
            if record['date'] == today_str:
                record['weight'] = new_weight
                record['height'] = new_height # 更新歷史紀錄中的身高
                found = True
                break
        if not found:
            data['weight_history'].append({"date": today_str, "weight": new_weight, "height": new_height})
            
        save_data(data)
        data['bmi_info'] = calculate_bmi_status(data['birthdate'], data['gender'], new_weight, new_height)
        return data
    except ValueError:
        return {"error": "請輸入有效的數字！"}

# ... (其他函式維持不變) ...
@eel.expose
def save_diet(selected_options):
    if not selected_options:
        return {"error": "你尚未選擇任何飲食項目喔！"}
    data = load_data()
    today = str(datetime.date.today())
    if today not in data["daily_logs"]:
        data["daily_logs"][today] = {}
    data["daily_logs"][today]["diet"] = selected_options
    save_data(data)
    return data

@eel.expose
def save_exercise(selected_exercises):
    if not selected_exercises:
        return {"error": "你尚未選擇任何運動項目喔！"}
    data = load_data()
    today = str(datetime.date.today())
    if today not in data["daily_logs"]:
        data["daily_logs"][today] = {}
    data["daily_logs"][today]["exercise"] = selected_exercises
    save_data(data)
    return data

def check_and_award_consecutive_points(data):
    today = datetime.date.today()
    sorted_dates = sorted([datetime.datetime.strptime(d, "%Y-%m-%d").date() for d in data["daily_logs"].keys() if data["daily_logs"][d].get("completed")], reverse=True)

    if not sorted_dates:
        return None

    consecutive_count = 0
    last_date = today

    for d in sorted_dates:
        if d == last_date:
            consecutive_count += 1
            last_date -= datetime.timedelta(days=1)
        elif d < last_date: # Gap found, stop counting consecutive days
            break
        # If d > last_date, it means a future date, which shouldn't happen for sorted_dates from daily_logs

    message = None
    # Check for 7-day streak
    if consecutive_count >= 7:
        # Check if points for this streak have already been awarded
        # A simple way is to store the date of the last awarded 7-day streak
        if not data.get('last_7_day_award_date') or \
           (today - datetime.datetime.strptime(data['last_7_day_award_date'], "%Y-%m-%d").date()).days >= 7:
            data['points'] += 10
            data['last_7_day_award_date'] = today.strftime("%Y-%m-%d")
            message = f"恭喜！連續完成7天任務，獲得10點獎勵！"

    # Check for 30-day streak
    if consecutive_count >= 30:
        if not data.get('last_30_day_award_date') or \
           (today - datetime.datetime.strptime(data['last_30_day_award_date'], "%Y-%m-%d").date()).days >= 30:
            data['points'] += 10
            data['last_30_day_award_date'] = today.strftime("%Y-%m-%d")
            if message:
                message += f"\n恭喜！連續完成30天任務，獲得10點獎勵！"
            else:
                message = f"恭喜！連續完成30天任務，獲得10點獎勵！"
    return message

@eel.expose
def complete_day():
    data = load_data()
    today = str(datetime.date.today())
    if today in data["daily_logs"]:
        log = data["daily_logs"][today]
        if log.get("completed"):
            return {"message": "今天已經完成過任務囉！"}
        diet_points = len(log.get("diet", []))
        exercise_points = len(log.get("exercise", [])) * 2
        points_earned = diet_points + exercise_points
        if points_earned == 0:
            return {"error": "先記錄今天的飲食或運動，才能完成任務喔！"}
        data["points"] += points_earned
        log["completed"] = True
        
        # Check and award consecutive points
        consecutive_message = check_and_award_consecutive_points(data)
        
        save_data(data)
        
        message = f"恭喜！今天任務完成！獲得 {points_earned} 點數！"
        if consecutive_message:
            message += f"\n{consecutive_message}"
            
        return {"data": data, "message": message}
    else:
        return {"error": "先記錄飲食和運動吧！"}

@eel.expose
def redeem_reward(cost_str):
    data = load_data()
    cost = int(cost_str)
    if data['points'] >= cost:
        data['points'] -= cost
        save_data(data)
        return {"data": data, "message": f"恭喜你！成功兌換獎勵！\n剩餘點數: {data['points']}"}
    else:
        return {"error": "點數不足，沒辦法兌換喔！"}

@eel.expose
def get_calendar_data():
    data = load_data()
    return {"daily_logs": data.get("daily_logs", {})}

# --- 啟動程式 ---
if __name__ == "__main__":
    # 部署到網路伺服器時，需要監聽 0.0.0.0，並使用環境變數指定的 PORT
    # os.environ.get('PORT', 8000) 會嘗試讀取 PORT 環境變數，如果找不到就用 8000 為預設值 (方便本機測試)
    port = int(os.environ.get('PORT', 8000))
    
    try:
        print("正在啟動應用程式...")
        # mode=None 可以在伺服器上執行時，不試圖開啟瀏覽器視窗
        eel.start('index.html', mode=None, host='0.0.0.0', port=port)
    except (SystemExit, MemoryError, KeyboardInterrupt):
        print("應用程式已關閉。")
