"""
動画解析 + キックボクシングスコアリング機能

このスクリプトは：
1. MediaPipeで骨格を検出
2. キックボクシングのフォームを評価
3. JSON形式で結果を出力
"""

import cv2
import mediapipe as mp
import sys
import json
import math

# MediaPipeの準備
mp_pose = mp.solutions.pose

def calculate_distance(point1, point2):
    """2点間の距離を計算"""
    return math.sqrt(
        (point1['x'] - point2['x'])**2 + 
        (point1['y'] - point2['y'])**2 + 
        (point1['z'] - point2['z'])**2
    )

def calculate_angle(point1, center, point2):
    """3点で角度を計算（度）"""
    # ベクトルを作成
    vec1_x = point1['x'] - center['x']
    vec1_y = point1['y'] - center['y']
    vec2_x = point2['x'] - center['x']
    vec2_y = point2['y'] - center['y']
    
    # 内積を計算
    dot_product = vec1_x * vec2_x + vec1_y * vec2_y
    mag1 = math.sqrt(vec1_x**2 + vec1_y**2)
    mag2 = math.sqrt(vec2_x**2 + vec2_y**2)
    
    if mag1 == 0 or mag2 == 0:
        return 0
    
    # 角度を計算（ラジアン→度）
    cos_angle = dot_product / (mag1 * mag2)
    cos_angle = max(-1.0, min(1.0, cos_angle))  # -1から1の範囲に制限
    angle = math.acos(cos_angle)
    return math.degrees(angle)

def analyze_kickboxing_form(video_path):
    """
    動画を解析してキックボクシングのスコアを算出
    
    評価項目：
    - パンチ速度（punch_speed）
    - ガード姿勢（guard_stability）
    - キック高さ（kick_height）
    - コア回転（core_rotation）
    """
    
    # 評価用の変数を初期化
    punch_speeds = []
    guard_positions = []
    kick_heights = []
    core_rotations = []
    
    with mp_pose.Pose(
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5
    ) as pose:
        
        cap = cv2.VideoCapture(video_path)
        
        if not cap.isOpened():
            return {
                "status": "failure",
                "error_message": f"動画ファイルが開けませんでした: {video_path}"
            }
        
        fps = cap.get(cv2.CAP_PROP_FPS)  # フレームレート
        frame_count = 0
        prev_hand_positions = {"left": None, "right": None}
        
        while cap.isOpened():
            success, image = cap.read()
            if not success:
                break
            
            frame_count += 1
            image.flags.writeable = False
            image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            results = pose.process(image_rgb)
            
            if results.pose_landmarks:
                landmarks = results.pose_landmarks.landmark
                
                # ランドマークのインデックス（MediaPipe Pose）
                # 左腕: 15, 16 (手首, 肘)
                # 右腕: 18, 20 (手首, 肘)
                # 肩: 11, 12 (左, 右)
                # 股関節: 23, 24 (左, 右)
                # 足首: 27, 28 (左, 右)
                
                # 現在の手首位置
                left_wrist = {
                    'x': landmarks[15].x,
                    'y': landmarks[15].y,
                    'z': landmarks[15].z
                }
                right_wrist = {
                    'x': landmarks[16].x,
                    'y': landmarks[16].y,
                    'z': landmarks[16].z
                }
                left_shoulder = {
                    'x': landmarks[11].x,
                    'y': landmarks[11].y,
                    'z': landmarks[11].z
                }
                right_shoulder = {
                    'x': landmarks[12].x,
                    'y': landmarks[12].y,
                    'z': landmarks[12].z
                }
                left_hip = {
                    'x': landmarks[23].x,
                    'y': landmarks[23].y,
                    'z': landmarks[23].z
                }
                right_hip = {
                    'x': landmarks[24].x,
                    'y': landmarks[24].y,
                    'z': landmarks[24].z
                }
                
                # 1. パンチ速度の評価
                if prev_hand_positions["left"] and prev_hand_positions["right"]:
                    # 前フレームからの移動距離
                    left_distance = calculate_distance(left_wrist, prev_hand_positions["left"])
                    right_distance = calculate_distance(right_wrist, prev_hand_positions["right"])
                    max_distance = max(left_distance, right_distance)
                    
                    # 速度 = 距離 / 時間（秒）
                    # 1フレーム = 1/fps 秒
                    speed = max_distance * fps
                    punch_speeds.append(speed)
                
                prev_hand_positions["left"] = left_wrist
                prev_hand_positions["right"] = right_wrist
                
                # 2. ガード姿勢の評価（手が顔の近くにあるか）
                # 手首と肩のY座標の差が小さい = 良いガード
                left_guard_height = abs(left_wrist['y'] - left_shoulder['y'])
                right_guard_height = abs(right_wrist['y'] - right_shoulder['y'])
                avg_guard_height = (left_guard_height + right_guard_height) / 2
                guard_positions.append(avg_guard_height)
                
                # 3. キック高さの評価（足首の高さ）
                left_ankle = {
                    'x': landmarks[27].x,
                    'y': landmarks[27].y,
                    'z': landmarks[27].z
                }
                right_ankle = {
                    'x': landmarks[28].x,
                    'y': landmarks[28].y,
                    'z': landmarks[28].z
                }
                # 股関節より高い = キックしている
                max_kick_height = max(
                    left_hip['y'] - left_ankle['y'],
                    right_hip['y'] - right_ankle['y']
                )
                kick_heights.append(max_kick_height)
                
                # 4. コア回転の評価（肩と股関節の角度）
                shoulder_angle = calculate_angle(left_shoulder, left_hip, right_hip)
                core_rotations.append(shoulder_angle)
        
        cap.release()
    
    # スコアリング（0-100点で評価）
    # パンチ速度: 速いほど高得点（最大1.0で100点）
    punch_speed_score = 0
    if punch_speeds:
        max_speed = max(punch_speeds)
        punch_speed_score = min(100, max_speed * 100)
    
    # ガード姿勢: 低いほど高得点（0.1以下で100点）
    guard_stability_score = 0
    if guard_positions:
        avg_guard = sum(guard_positions) / len(guard_positions)
        guard_stability_score = max(0, 100 - (avg_guard * 500))
    
    # キック高さ: 高いほど高得点（0.2以上で100点）
    kick_height_score = 0
    if kick_heights:
        max_kick = max(kick_heights)
        kick_height_score = min(100, max_kick * 500)
    
    # コア回転: 適切な角度で高得点（30-60度が理想）
    core_rotation_score = 0
    if core_rotations:
        avg_rotation = sum(core_rotations) / len(core_rotations)
        # 45度を理想として、距離に応じて減点
        ideal_angle = 45
        distance = abs(avg_rotation - ideal_angle)
        core_rotation_score = max(0, 100 - (distance * 2))
    
    # 結果をJSON形式で返す
    result = {
        "status": "success",
        "scores": {
            "punch_speed": round(punch_speed_score, 1),
            "guard_stability": round(guard_stability_score, 1),
            "kick_height": round(kick_height_score, 1),
            "core_rotation": round(core_rotation_score, 1)
        },
        "error_message": None
    }
    
    return result

if __name__ == '__main__':
    # テスト用
    if len(sys.argv) > 1:
        video_file = sys.argv[1]
    else:
        video_file = '/Users/jin/Downloads/IMG_9127-1.mov'
    
    result = analyze_kickboxing_form(video_file)
    print(json.dumps(result, indent=2, ensure_ascii=False))
    
    # JSONファイルとして保存
    with open('analysis_result.json', 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

