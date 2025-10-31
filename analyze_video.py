
import cv2
import mediapipe as mp
import sys

# MediaPipeの描画ユーティリティとPoseモデルを準備
mp_drawing = mp.solutions.drawing_utils
mp_pose = mp.solutions.pose

def analyze_video(video_path):
    """
    動画ファイルを解析し、骨格情報をコンソールに出力します。

    Args:/Users/jin/Downloads/IMG_9127-1.mov
        video_path (str): 解析したい動画ファイルのパス
    """
    # Poseモデルを初期化
    # `with`を使うと、処理が終わった後にリソースを自動で解放してくれます。
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
        while cap.isOpened():
            # 1フレームずつ読み込む
            success, image = cap.read()
            if not success:
                # 動画の終わりに達したらループを抜ける
                break

            frame_count += 1
            print(f"--- フレーム {frame_count} ---")

            # パフォーマンス向上のため、画像を書き込み不可にして参照渡しにする
            image.flags.writeable = False
            
            # MediaPipeが処理できるように、色の形式をBGRからRGBに変換
            image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            
            # Poseモデルで画像（フレーム）を処理
            results = pose.process(image_rgb)

            # 検出された骨格情報を出力
            if results.pose_landmarks:
                print(results.pose_landmarks)
                
                # (参考) 骨格を画像に描画したい場合は、以下のコメントを外してください
                # image.flags.writeable = True
                # mp_drawing.draw_landmarks(
                #     image,
                #     results.pose_landmarks,
                #     mp_pose.POSE_CONNECTIONS)
                # cv2.imshow('MediaPipe Pose', image)
                # if cv2.waitKey(5) & 0xFF == 27:
                #      break


        # 使い終わったリソースを解放
        cap.release()
        # cv2.destroyAllWindows() # プレビューウィンドウを使っている場合はこちらも

if __name__ == '__main__':
    # --- ここをあなたの動画ファイルへのパスに変更してください ---
    # 例: video_file = 'C:/Users/YourName/Videos/my_kick.mp4'
    # 例: video_file = '/U/Users/jin/Desktop/IMG_4735.MP4sers/YourName/Movies/my_kick.mp4'
    video_file = '/Users/jin/Downloads/IMG_9127-1.mov'
    
    if video_file == 'ここにあなたの動画ファイルのフ/Users/jin/Downloads/IMG_9127-1.movルパスを記述してください.mp4':
        print("エラー: スクリプトを編集して、`video_file`変数をあなたの動画ファイルのパスに設定してください。", file=sys.stderr)
    else:
        analyze_video(video_file)
