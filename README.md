# DRAGON HEX Control

เว็บ: https://tengppm024-lang.github.io/dragon-hex-control/
API: https://dragon-hex-control-api.dragonhex.workers.dev

ตรวจคีย์จาก API เดิมของ dhx แล้วให้ดาวน์โหลดไฟล์ 3105 ที่เพิ่มตัวรับคำสั่งเว็บและจับคู่กับเบราว์เซอร์นี้ ดู RECEIVER_NOTES.md สำหรับวิธีนำเข้าและข้อจำกัดการทดสอบบนเครื่องจริง

หน้าเว็บมี AIM SYSTEM, SILENT AIM, NO RECOIL, TARGET และ HEADSHOT บันทึก config ลง Durable Object ต่ออุปกรณ์ ตัวรับในแพตช์อ่านคำสั่งและส่ง applied mask กลับมา เว็บจะแสดง GAME ACKNOWLEDGED เฉพาะเมื่อมี heartbeat และค่าตรงกับ config ล่าสุด

GET/PUT /api/device-config ใช้ Authorization: Bearer access-key
POST /api/device-patch ใช้ access-key สร้างไฟล์จับคู่
GET /api/runtime-config ใช้ receiver token ในแพตช์และตอบ packed mask แบบ text/plain
GET /api/runtime-status ใช้ access-key ตรวจ heartbeat ของอุปกรณ์นี้

แพตช์ต้นฉบับและแม่แบบไม่ได้เผยแพร่ใน public GitHub repository แม่แบบอยู่ใน Cloudflare KV receiver:template:v1 ภายในบัญชีผู้ใช้ GitHub Pages workflow เผยแพร่เฉพาะไฟล์หน้าเว็บ

รัน tests ด้วย node tests/worker.mjs จากโฟลเดอร์นี้ การทดสอบ package และ receiver assembly อยู่ใน workspace work/ และได้ผ่านแล้ว ยังไม่ได้ทดสอบ interpreter จริงในเกมบน iPhone
