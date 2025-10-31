import cv2
import mediapipe as mp
import sys
import json

# MediaPipeの描画ユーティリティとPoseモデルを準備
mp_drawing = mp.solutions.drawing_utils
mp_pose = mp.solutions.pose

def analyze_video(video_path):
    """
    動画ファイルを解析し、骨格情報をJSONファイルに出力します。

    Args:
        video_path (str): 解析したい動画ファイルのパス
    """
    # Poseモデルを初期化
    with mp_pose.Pose(
        min_detection_confidence=0.5,  # 検出の信頼度の最小値
        min_tracking_confidence=0.5) as pose: # 追跡の信頼度の最小値

        # 動画ファイルを読み込む
        cap = cv2.VideoCapture(video_path)

        # 動画ファイルが正常に開けたか確認
        if not cap.isOpened():
            print(f"エラー: 動画ファイルが開けませんでした。パスを確認してください: {video_path}", file=sys.stderr)
            return

        frame_count = 0
        all_landmarks = []
        while cap.isOpened():
            # 1フレームずつ読み込む
            success, image = cap.read()
            if not success:
                # 動画の終わりに達したらループを抜ける
                break

            frame_count += 1

            # パフォーマンス向上のため、画像を書き込み不可にして参照渡しにする
            image.flags.writeable = False
            
            # MediaPipeが処理できるように、色の形式をBGRからRGBに変換
            image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            
            # Poseモデルで画像（フレーム）を処理
            results = pose.process(image_rgb)

            # 検出された骨格情報をリストに追加
            if results.pose_landmarks:
                landmarks = [{'x': lm.x, 'y': lm.y, 'z': lm.z, 'visibility': lm.visibility} for lm in results.pose_landmarks.landmark]
                all_landmarks.append({'frame': frame_count, 'landmarks': landmarks})

        # 使い終わったリソースを解放
        cap.release()

        # 骨格情報をJSONファイルに保存
        with open('public/landmarks.json', 'w') as f:
            json.dump(all_landmarks, f, indent=2)
        print("骨格情報が public/landmarks.json に保存されました。")


if __name__ == '__main__':
    # --- ここをあなたの動画ファイルへのパスに変更してください ---
    video_file = '/Users/jin/Downloads/IMG_9127-1.mov'
    
    if video_file == 'ここにあなたの動画ファイルのフ/Users/jin/Downloads/IMG_9127-1.movルパスを記述してください.mp4':
        print("エラー: スクリプトを編集して、`video_file`変数をあなたの動画ファイルのパスに設定してください。", file=sys.stderr)
    else:
        analyze_video(video_file)