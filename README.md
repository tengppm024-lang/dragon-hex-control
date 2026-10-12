# DRAGON HEX Control

เว็บ: https://tengppm024-lang.github.io/dragon-hex-control/
API: https://dragon-hex-control-api.dragonhex.workers.dev

ตรวจคีย์เดียวกับ IPA ผ่านจุดตรวจสิทธิ์เว็บของ dhx โดยไม่ผูกเครื่องใหม่ แล้วให้ดาวน์โหลดไฟล์ 3105 ที่จับคู่กับช่องของคีย์นี้ หนึ่งคีย์มีหนึ่งช่องและหนึ่งตัวรับที่ใช้ได้ ดู KEY_ISOLATION.md และ RECEIVER_NOTES.md

หน้าเว็บมี AIM SYSTEM, SILENT AIM, NO RECOIL, TARGET และ HEADSHOT บันทึก config ลง Durable Object ต่อคีย์ที่ server คำนวณชื่อเอง ตัวรับในแพตช์อ่านคำสั่งและส่ง applied mask กับตัวระบุเครื่องกลับมา ต่างคีย์ใช้คนละช่อง และเว็บออกจากระบบเมื่อคีย์หมดอายุ

GET/PUT /api/device-config ใช้ Authorization: Bearer access-key
POST /api/device-patch ใช้ access-key สร้างไฟล์จับคู่
GET /api/runtime-config ใช้ receiver token ในแพตช์และตอบ packed mask แบบ text/plain
GET /api/runtime-status ใช้ access-key ตรวจ heartbeat ของอุปกรณ์นี้

แพตช์ต้นฉบับและแม่แบบไม่ได้เผยแพร่ใน public GitHub repository แม่แบบอยู่ใน Cloudflare KV receiver:template:v1 ภายในบัญชีผู้ใช้ GitHub Pages workflow เผยแพร่เฉพาะไฟล์หน้าเว็บ

รัน tests ด้วย node tests/worker.mjs จากโฟลเดอร์นี้ การทดสอบ package และ receiver assembly อยู่ใน workspace work/ และได้ผ่านแล้ว ยังไม่ได้ทดสอบ interpreter จริงในเกมบน iPhone
