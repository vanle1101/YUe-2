# Meet Yue2 Local Clone

## Structure

- `frontend/`: Mirror toàn bộ HTML/CSS/JS/assets từ `https://yue.noizai.net/`.
- `API_SPEC.md`: Contract của toàn bộ `/api/*` endpoints đã dịch ngược.
- `server.py`: FastAPI + uvicorn local server, mở khóa quota local (`remaining: 999999`), phục vụ đủ cả 2 luồng Text-to-Music và Cover.

## Run

```powershell
cd "D:\New folder\ALL IN ONE\MMO\YUE 2"
pip install -r requirements.txt
python server.py
```

Mở `http://127.0.0.1:8000/`.

## Gắn model thật miễn phí (`YuE2-Turbo` + Whisper)

Mặc định chưa gắn GPU model, `server.py` trả file WAV mẫu để test full luồng UI. Để sinh nhạc thật miễn phí bằng GPU local (hoặc Colab):

1. Clone `https://github.com/NoizAI/YuE2-Turbo` và cài môi trường theo repo.
2. Truyền biến môi trường trước khi chạy `server.py`:
   - `YUE2_INFER_CMD`: lệnh CLI nhận `{prompt}`, `{lyrics}`, `{style}`, `{seed}`, `{out_path}`.
   - `WHISPER_CMD`: lệnh ASR nhận `{in_path}` và in lyrics ra stdout.
