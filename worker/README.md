# DRAGON HEX Control API

Cloudflare Worker สำหรับหน้าเว็บ `dragon-hex-control` โดยไม่แก้ Worker เดิม

- `POST /api/auth` ส่งต่อไปยัง API เดิมเพื่อตรวจคีย์
- `GET /api/status` ส่งต่อสถานะระบบ
- `GET /api/device-config` อ่านสถานะฟังก์ชันจาก KV หลังตรวจคีย์
- `PUT /api/device-config` บันทึกสถานะฟังก์ชันลง KV หลังตรวจคีย์
- `/keys` ส่งไปยังหน้าจัดการคีย์เดิม

Worker ไม่เก็บคีย์เป็นข้อความปกติ ชื่อรายการใน KV ใช้ SHA-256 ของคีย์และ device ID

## Deploy

สร้าง Workers KV namespace แล้วแทน `REPLACE_WITH_KV_NAMESPACE_ID` ใน `wrangler.jsonc` จากนั้นรัน `npx wrangler deploy`

จากโฟลเดอร์ worker:

```sh
npm install
npx wrangler login
npx wrangler kv namespace create DEVICE_CONFIG
# ใส่ namespace ID ที่ได้รับใน wrangler.jsonc
npm run deploy
```

นำ URL Worker ที่ Deploy สำเร็จไปใส่ `apiBase` ใน `../config.js` แล้วทดสอบจากเว็บ GitHub Pages

GET และ PUT config ต้องส่ง `Authorization: Bearer YOUR_KEY` ไม่รับคีย์จาก query string หรือ body ของ endpoint นี้

