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
