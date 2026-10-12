# DRAGON HEX Control

หน้าเว็บ GitHub Pages โทนสีเขียวสำหรับตรวจคีย์กับ `https://dhx.dragonhex.workers.dev` และเตรียมหน้าควบคุมฟังก์ชันจากระยะไกล

## สถานะการเชื่อมต่อ

ส่วนตรวจคีย์เชื่อมกับ API จริงผ่าน `POST /api/auth` โดยส่ง `key`, `deviceId` และ `build` ตามรูปแบบที่แอป DRAGON HEX ใช้

API ปัจจุบันยังไม่มี endpoint สำหรับอ่าน/บันทึกสถานะฟังก์ชัน (`GET/PUT /api/device-config` ตอบ 404) และไฟล์แพตช์ปัจจุบันยังไม่ได้อ่าน remote configuration ดังนั้นหน้าเว็บจะปิดสวิตช์ไว้และแจ้ง `API UPDATE NEEDED` เพื่อไม่แสดงผลสำเร็จปลอม

## API contract ที่ต้องเพิ่ม

```http
GET /api/device-config?key=...&deviceId=...
```

```json
{
  "ok": true,
  "config": {
    "aimSystem": true,
    "noRecoil": false,
    "target": "head",
    "headshot": 75,
    "updatedAt": "2026-10-12T00:00:00.000Z"
  }
}
```

```http
PUT /api/device-config
Content-Type: application/json

{"key":"...","deviceId":"...","config":{"aimSystem":true,"noRecoil":false,"target":"head","headshot":75}}
```

ฝั่งแพตช์ต้อง poll endpoint นี้และนำค่าไปใช้กับตัวแปรจริงของฟังก์ชัน หากยังไม่มีส่วนนี้ GitHub Pages เพียงอย่างเดียวจะไม่สามารถเปลี่ยนสถานะในเกมบน iPhone ได้

## Publish

เปิด GitHub Pages จาก branch `main` และ root `/` หรือใช้ workflow ใน `.github/workflows/pages.yml`
