import eel
import json
import datetime
import os
import random
from sqlalchemy import create_engine, Column, String, Integer, Float, Date, Boolean, JSON
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base

# --- 資料庫設定 ---
# 優先從環境變數讀取 DATABASE_URL (用於 Render 部署)
# 如果找不到，則使用本地的 SQLite 資料庫 (用於本機開發測試)
DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///kids_diet.db")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# --- 資料庫模型 (Schema) ---
class Setting(Base):
    __tablename__ = "settings"
    key = Column(String, primary_key=True, index=True)
    value = Column(JSON)

class WeightHistory(Base):
    __tablename__ = "weight_history"
    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, unique=True, index=True)
    weight = Column(Float)
    height = Column(Float)
    bmi = Column(Float, nullable=True)
    bmi_status = Column(String, nullable=True)

class DailyLog(Base):
    __tablename__ = "daily_logs"
    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, unique=True, index=True)
    diet = Column(JSON, default=[])
    exercise = Column(JSON, default=[])
    completed = Column(Boolean, default=False)

# --- BMI 計算 (與之前相同) ---
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
def calculate_bmi_status(birthdate_str, gender, weight, height_cm, record_date=None):
    from bisect import bisect_left
    if not all([birthdate_str, gender, weight, height_cm]): return None
    try:
        birthdate = datetime.date.fromisoformat(birthdate_str)
        if record_date is None: record_date = datetime.date.today()
        age_in_months = (record_date.year - birthdate.year) * 12 + (record_date.month - birthdate.month)
        height_m = height_cm / 100.0
        bmi = round(weight / (height_m ** 2), 1)
        chart = BMI_CHART.get(gender)
        if not chart: return {"bmi": bmi, "status": "未知"}
        ages = [row[0] for row in chart]
        idx = bisect_left(ages, age_in_months)
        if idx >= len(ages): idx = len(ages) - 1
        _, p5, _, _, p85, p95 = chart[idx]
        status = "體重過輕" if bmi < p5 else "體位適中" if p5 <= bmi < p85 else "體重過重" if p85 <= bmi < p95 else "肥胖"
        return {"bmi": bmi, "status": status}
    except (ValueError, TypeError): return None

# --- 資料庫輔助函式 ---
def get_setting(db, key, default=None):
    setting = db.query(Setting).filter(Setting.key == key).first()
    return setting.value if setting else default

def set_setting(db, key, value):
    setting = db.query(Setting).filter(Setting.key == key).first()
    if setting:
        setting.value = value
    else:
        setting = Setting(key=key, value=value)
        db.add(setting)

# --- Eel 公開函式 ---
@eel.expose
def get_app_data():
    db = SessionLocal()
    try:
        name = get_setting(db, 'name')
        if not name:
            # 尚未初始化
            config = json.load(open("config.json", "r", encoding="utf-8"))
            return {"config": config, "data": {"name": None}}

        # 從資料庫讀取所有資料
        data = {s.key: s.value for s in db.query(Setting).all()}
        
        history = db.query(WeightHistory).order_by(WeightHistory.date).all()
        data['weight_history'] = [{"date": h.date.isoformat(), "weight": h.weight, "height": h.height, "bmi": h.bmi, "bmi_status": h.bmi_status} for h in history]
        
        logs = db.query(DailyLog).all()
        data['daily_logs'] = {log.date.isoformat(): {"diet": log.diet, "exercise": log.exercise, "completed": log.completed} for log in logs}

        # 計算最新的BMI
        if history:
            latest_record = history[-1]
            data['bmi_info'] = {"bmi": latest_record.bmi, "status": latest_record.bmi_status}
        else:
            data['bmi_info'] = None
        
        config = json.load(open("config.json", "r", encoding="utf-8"))
        return {"config": config, "data": data}
    finally:
        db.close()

@eel.expose
def save_initial(form_data):
    if not all(form_data.values()): return {"error": "所有欄位都必須填寫！"}
    db = SessionLocal()
    try:
        today = datetime.date.today()
        # 儲存基本設定
        for key, value in form_data.items():
            set_setting(db, key, value)
        set_setting(db, 'points', 0)

        # 儲存第一筆體重歷史
        height = float(form_data['height'])
        weight = float(form_data['initial_weight'])
        bmi_info = calculate_bmi_status(form_data['birthdate'], form_data['gender'], weight, height, today)
        
        new_history = WeightHistory(
            date=today,
            weight=weight,
            height=height,
            bmi=bmi_info.get('bmi') if bmi_info else None,
            bmi_status=bmi_info.get('status') if bmi_info else None
        )
        db.add(new_history)
        db.commit()
        return get_app_data()['data']
    except ValueError:
        db.rollback()
        return {"error": "體重和身高請輸入有效的正數！"}
    finally:
        db.close()

@eel.expose
def save_height_and_weight(height_str, weight_str):
    if not weight_str or not height_str: return {"error": "請輸入身高和體重！"}
    db = SessionLocal()
    try:
        new_weight = float(weight_str)
        new_height = float(height_str)
        today = datetime.date.today()

        birthdate = get_setting(db, 'birthdate')
        gender = get_setting(db, 'gender')
        bmi_info = calculate_bmi_status(birthdate, gender, new_weight, new_height, today)

        record = db.query(WeightHistory).filter(WeightHistory.date == today).first()
        if record:
            record.weight = new_weight
            record.height = new_height
            if bmi_info:
                record.bmi = bmi_info.get('bmi')
                record.bmi_status = bmi_info.get('status')
        else:
            new_record = WeightHistory(
                date=today, weight=new_weight, height=new_height,
                bmi=bmi_info.get('bmi') if bmi_info else None,
                bmi_status=bmi_info.get('status') if bmi_info else None
            )
            db.add(new_record)
        
        set_setting(db, 'height', new_height) # 更新最新身高
        db.commit()
        return get_app_data()['data']
    except ValueError:
        db.rollback()
        return {"error": "請輸入有效的數字！"}
    finally:
        db.close()

def get_or_create_log(db, date):
    log = db.query(DailyLog).filter(DailyLog.date == date).first()
    if not log:
        log = DailyLog(date=date, diet=[], exercise=[], completed=False)
        db.add(log)
    return log

@eel.expose
def save_diet(selected_options):
    if not selected_options: return {"error": "你尚未選擇任何飲食項目喔！"}
    db = SessionLocal()
    try:
        today = datetime.date.today()
        log = get_or_create_log(db, today)
        log.diet = selected_options
        db.commit()
        return get_app_data()['data']
    finally:
        db.close()

@eel.expose
def save_exercise(selected_exercises):
    if not selected_exercises: return {"error": "你尚未選擇任何運動項目喔！"}
    db = SessionLocal()
    try:
        today = datetime.date.today()
        log = get_or_create_log(db, today)
        log.exercise = selected_exercises
        db.commit()
        return get_app_data()['data']
    finally:
        db.close()

@eel.expose
def complete_day():
    db = SessionLocal()
    try:
        today = datetime.date.today()
        log = db.query(DailyLog).filter(DailyLog.date == today).first()

        if not log or (not log.diet and not log.exercise):
            return {"error": "先記錄今天的飲食或運動，才能完成任務喔！"}
        if log.get("completed"):
            return {"message": "今天已經完成過任務囉！"}

        diet_points = len(log.diet)
        exercise_points = len(log.exercise) * 2
        points_earned = diet_points + exercise_points
        
        current_points = get_setting(db, 'points', 0)
        set_setting(db, 'points', current_points + points_earned)
        log.completed = True
        
        # TODO: 連續任務獎勵邏輯需要重寫
        
        db.commit()
        message = f"恭喜！今天任務完成！獲得 {points_earned} 點數！"
        return {"data": get_app_data()['data'], "message": message}
    finally:
        db.close()

@eel.expose
def redeem_reward(cost_str):
    db = SessionLocal()
    try:
        cost = int(cost_str)
        current_points = get_setting(db, 'points', 0)
        if current_points >= cost:
            set_setting(db, 'points', current_points - cost)
            db.commit()
            new_points = get_setting(db, 'points')
            return {"data": get_app_data()['data'], "message": f"恭喜你！成功兌換獎勵！\n剩餘點數: {new_points}"}
        else:
            return {"error": "點數不足，沒辦法兌換喔！"}
    finally:
        db.close()

@eel.expose
def get_calendar_data():
    db = SessionLocal()
    try:
        logs = db.query(DailyLog).all()
        return {"daily_logs": {log.date.isoformat(): {"completed": log.completed} for log in logs}}
    finally:
        db.close()

# --- 啟動程式 ---
def init_db():
    # 建立資料庫表格
    Base.metadata.create_all(bind=engine)

if __name__ == "__main__":
    print("正在初始化資料庫...")
    init_db()

    # 初始化 Eel，指定網頁檔案在 'web' 資料夾
    eel.init('web')
    
    port = int(os.environ.get('PORT', 8000))
    host = '0.0.0.0' if 'DATABASE_URL' in os.environ else 'localhost'
    
    try:
        print(f"正在啟動應用程式於 http://{host}:{port}")
        eel.start('index.html', mode=None, host=host, port=port)
    except (SystemExit, MemoryError, KeyboardInterrupt):
        print("應用程式已關閉。")