"""
動画解析ロジック（analyze_video_scored.pyからコピー）

このファイルは、Cloud Functionsで使えるように
メインの解析プログラムからロジックを移植したものです。
"""

import cv2
import mediapipe as mp
import math


def calculate_distance(point1, point2):
    """2点間の距離を計算"""
    return math.sqrt(
        (point1['x'] - point2['x'])**2 + 
        (point1['y'] - point2['y'])**2 + 
        (point1['z'] - point2['z'])**2
    )


def calculate_angle(point1, center, point2):
    """3点で角度を計算（度）"""
    vec1_x = point1['x'] - center['x']
    vec1_y = point1['y'] - center['y']
    vec2_x = point2['x'] - center['x']
    vec2_y = point2['y'] - center['y']
    
    dot_product = vec1_x * vec2_x + vec1_y * vec2_y
    mag1 = math.sqrt(vec1_x**2 + vec1_y**2)
    mag2 = math.sqrt(vec2_x**2 + vec2_y**2)
    
    if mag1 == 0 or mag2 == 0:
        return 0
    
    cos_angle = dot_product / (mag1 * mag2)
    cos_angle = max(-1.0, min(1.0, cos_angle))
    angle = math.acos(cos_angle)
    return math.degrees(angle)


def analyze_kickboxing_form(video_path):
    """
    動画を解析してキックボクシングのスコアを算出
    """
    
    punch_speeds = []
    guard_positions = []
    kick_heights = []
    core_rotations = []
    
    mp_pose = mp.solutions.pose
    
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
        
        fps = cap.get(cv2.CAP_PROP_FPS)
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
                
                left_wrist = {'x': landmarks[15].x, 'y': landmarks[15].y, 'z': landmarks[15].z}
                right_wrist = {'x': landmarks[16].x, 'y': landmarks[16].y, 'z': landmarks[16].z}
                left_shoulder = {'x': landmarks[11].x, 'y': landmarks[11].y, 'z': landmarks[11].z}
                right_shoulder = {'x': landmarks[12].x, 'y': landmarks[12].y, 'z': landmarks[12].z}
                left_hip = {'x': landmarks[23].x, 'y': landmarks[23].y, 'z': landmarks[23].z}
                right_hip = {'x': landmarks[24].x, 'y': landmarks[24].y, 'z': landmarks[24].z}
                
                # パンチ速度
                if prev_hand_positions["left"] and prev_hand_positions["right"]:
                    left_distance = calculate_distance(left_wrist, prev_hand_positions["left"])
                    right_distance = calculate_distance(right_wrist, prev_hand_positions["right"])
                    max_distance = max(left_distance, right_distance)
                    speed = max_distance * fps
                    punch_speeds.append(speed)
                
                prev_hand_positions["left"] = left_wrist
                prev_hand_positions["right"] = right_wrist
                
                # ガード姿勢
                left_guard_height = abs(left_wrist['y'] - left_shoulder['y'])
                right_guard_height = abs(right_wrist['y'] - right_shoulder['y'])
                avg_guard_height = (left_guard_height + right_guard_height) / 2
                guard_positions.append(avg_guard_height)
                
                # キック高さ
                left_ankle = {'x': landmarks[27].x, 'y': landmarks[27].y, 'z': landmarks[27].z}
                right_ankle = {'x': landmarks[28].x, 'y': landmarks[28].y, 'z': landmarks[28].z}
                max_kick_height = max(
                    left_hip['y'] - left_ankle['y'],
                    right_hip['y'] - right_ankle['y']
                )
                kick_heights.append(max_kick_height)
                
                # コア回転
                shoulder_angle = calculate_angle(left_shoulder, left_hip, right_hip)
                core_rotations.append(shoulder_angle)
        
        cap.release()
    
    # スコアリング（0-100点）
    punch_speed_score = 0
    if punch_speeds:
        max_speed = max(punch_speeds)
        punch_speed_score = min(100, max(0, max_speed * 100))
    
    guard_stability_score = 0
    if guard_positions:
        avg_guard = sum(guard_positions) / len(guard_positions)
        guard_stability_score = max(0, min(100, 100 - (avg_guard * 500)))
    
    kick_height_score = 0
    if kick_heights:
        max_kick = max(kick_heights)
        kick_height_score = min(100, max(0, max_kick * 500))
    
    core_rotation_score = 0
    if core_rotations:
        avg_rotation = sum(core_rotations) / len(core_rotations)
        ideal_angle = 45
        distance = abs(avg_rotation - ideal_angle)
        core_rotation_score = max(0, min(100, 100 - (distance * 2)))
    
    return {
        "status": "success",
        "scores": {
            "punch_speed": round(punch_speed_score, 1),
            "guard_stability": round(guard_stability_score, 1),
            "kick_height": round(kick_height_score, 1),
            "core_rotation": round(core_rotation_score, 1)
        },
        "error_message": None
    }

