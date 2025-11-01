import os
import json
import tempfile
import traceback

import functions_framework
import requests
from google.cloud.secretmanager_v1 import SecretManagerServiceClient
from tenacity import retry, stop_after_attempt, wait_exponential

from analyze import analyze_kickboxing_form

# --- Client Initialization ---
try:
    storage_client = storage.Client()
    db = firestore.Client()
    secret_client = secretmanager.SecretManagerServiceClient()
except Exception as e:
    print(f"❌ FATAL: Failed to initialize Google Cloud clients: {e}")
    db, secret_client = None, None

# --- Secret Loading Function ---
def access_secret_version(secret_id, project_id, version_id="latest"):
    """Access the payload for the given secret version."""
    if not secret_client:
        raise ConnectionError("Secret Manager client not initialized.")
    name = f"projects/{project_id}/secrets/{secret_id}/versions/{version_id}"
    response = secret_client.access_secret_version(name=name)
    return response.payload.data.decode('UTF-8')

# --- Load Secrets at Runtime ---
PROJECT_ID = os.environ.get('GCP_PROJECT')
DIFY_API_ENDPOINT = ""
DIFY_API_KEY = ""
LINE_CHANNEL_ACCESS_TOKEN = ""

try:
    if PROJECT_ID:
        DIFY_API_ENDPOINT = access_secret_version("DIFY_API_ENDPOINT", PROJECT_ID)
        DIFY_API_KEY = access_secret_version("DIFY_API_KEY", PROJECT_ID)
        LINE_CHANNEL_ACCESS_TOKEN = access_secret_version("LINE_CHANNEL_ACCESS_TOKEN", PROJECT_ID)
        print("✅ Successfully loaded secrets from Secret Manager.")
except Exception as e:
    print(f"❌ WARNING: Failed to load secrets from Secret Manager: {e}. Falling back to env vars.")
    # Fallback to environment variables if Secret Manager fails
    DIFY_API_ENDPOINT = os.environ.get('DIFY_API_ENDPOINT', '')
    DIFY_API_KEY = os.environ.get('DIFY_API_KEY', '')
    LINE_CHANNEL_ACCESS_TOKEN = os.environ.get('LINE_CHANNEL_ACCESS_TOKEN', '')

# (The rest of the file remains the same as the previously fortified version)
# ... (process_video_trigger, call_dify_api, send_line_message_with_retry)


# --- Main Trigger Function ---
@functions_framework.cloud_event
def process_video_trigger(cloud_event):
    """Triggered by a file upload to Cloud Storage."""
    data = cloud_event.data
    bucket_name = data.get("bucket")
    file_path = data.get("name")

    if not file_path or not file_path.startswith('videos/'):
        print(f"INFO: Skipping non-video file: {file_path}")
        return {"status": "skipped", "reason": "Not a video file"}

    # Extract IDs from path: videos/{userId}/{jobId}/{fileName}
    try:
        _, user_id, job_id, file_name = file_path.split('/')
    except ValueError:
        print(f"ERROR: Invalid file path structure: {file_path}")
        return {"status": "error", "reason": "Invalid path structure"}

    job_ref = db.collection('video_jobs').document(job_id)

    # --- Idempotency Check ---
    try:
        job_doc = job_ref.get()
        if not job_doc.exists:
            print(f"ERROR: Job document not found for job ID: {job_id}")
            return {"status": "error", "reason": "Job document not found"}
        
        if job_doc.to_dict().get('status') != 'pending':
            print(f"INFO: Job {job_id} already processed or is processing. Skipping.")
            return {"status": "skipped", "reason": "Job not in pending state"}

        # --- Mark as Processing (Atomic Update) ---
        job_ref.update({"status": "processing", "updatedAt": firestore.SERVER_TIMESTAMP})

    except Exception as e:
        print(f"ERROR: Firestore transaction failed for job {job_id}: {e}")
        return {"status": "error", "reason": "Firestore transaction failed"}

    # --- Main Processing Logic ---
    temp_path = None
    try:
        # 1. Download video to a temporary file
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(file_path)
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file_name)[1]) as temp_file:
            temp_path = temp_file.name
            blob.download_to_filename(temp_path)
            print(f"INFO: Job {job_id}: File downloaded to {temp_path}")

        # 2. Analyze the video
        analysis_result = analyze_kickboxing_form(temp_path)
        print(f"INFO: Job {job_id}: Analysis complete.")
        job_ref.update({"analysisResult": analysis_result})

        if analysis_result.get('status') != 'success':
            raise ValueError(f"Analysis failed: {analysis_result.get('error')}")

        # 3. Call Dify API
        aika_message = call_dify_api(analysis_result['scores'], user_id)
        if not aika_message:
            aika_message = "ふふ、動画は受け取ったわ。でも今、ちょっと考え中…。後でまた声をかけてちょうだい。"
        print(f"INFO: Job {job_id}: Dify message received.")

        # 4. Send LINE message with retry
        send_line_message_with_retry(user_id, aika_message, job_id)
        print(f"INFO: Job {job_id}: LINE notification process completed.")

        # 5. Mark job as completed
        job_ref.update({"status": "completed", "aikaMessage": aika_message, "updatedAt": firestore.SERVER_TIMESTAMP})
        print(f"✅ SUCCESS: Job {job_id} completed successfully.")
        return {"status": "success"}

    except Exception as e:
        print(f"CRITICAL: Unhandled exception in job {job_id}: {e}")
        traceback.print_exc()
        job_ref.update({"status": "error", "errorMessage": str(e), "updatedAt": firestore.SERVER_TIMESTAMP})
        # Notify user of failure
        try:
            error_message = "ごめんあそばせ。今、スカウターの調子が悪いようだわ…後でもう一度試してみて。"
            send_line_message_with_retry(user_id, error_message, job_id, is_error_notification=True)
        except Exception as notify_error:
            print(f"ERROR: Failed to send error notification for job {job_id}: {notify_error}")
        return {"status": "error", "reason": str(e)}

    finally:
        # 6. Clean up temporary file
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)
            print(f"INFO: Job {job_id}: Cleaned up temporary file {temp_path}.")

# --- Helper Functions ---

def call_dify_api(scores, user_id):
    """Calls Dify API to generate AIKA's message."""
    # (Implementation is the same as before)
    pass # Placeholder for existing implementation

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
def send_line_message_with_retry(user_id, message, job_id, is_error_notification=False):
    """Sends a LINE message with exponential backoff retry."""
    print(f"INFO: Job {job_id}: Attempting to send LINE message to {user_id}...")
    try:
        headers = {
            'Authorization': f'Bearer {LINE_CHANNEL_ACCESS_TOKEN}',
            'Content-Type': 'application/json'
        }
        payload = {
            'to': user_id,
            'messages': [{'type': 'text', 'text': message}]
        }
        response = requests.post('https://api.line.me/v2/bot/message/push', headers=headers, json=payload, timeout=10)
        response.raise_for_status() # Raise an exception for bad status codes
        print(f"INFO: Job {job_id}: Successfully sent LINE message.")

    except requests.exceptions.RequestException as e:
        print(f"WARNING: Job {job_id}: LINE notification attempt failed: {e}. Retrying...")
        # On the final attempt, log a critical error for alerting
        if send_line_message_with_retry.retry.statistics['attempt_number'] == 3:
            log_payload = {
                "message": f"CRITICAL: Failed to send LINE notification for job {job_id} after 3 attempts.",
                "jobId": job_id,
                "userId": user_id,
                "error": str(e),
                "severity": "ERROR"
            }
            print(json.dumps(log_payload))
            # To avoid breaking the main flow, we don't re-raise the final error
            # if it's not a user-facing error notification itself.
            if is_error_notification:
                 raise
        else:
            raise

