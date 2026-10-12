# Device config contract

อุปกรณ์และเว็บต้องใช้ key และ deviceId เดียวกัน การตรวจคีย์ส่ง deviceId ไป upstream จึงต้องทราบวิธีผูกคีย์กับอุปกรณ์ของระบบเดิมก่อนใช้จริง

GET /api/device-config?deviceId=YOUR_DEVICE_ID
Authorization: Bearer YOUR_KEY

Response: {"ok":true,"config":{"aimSystem":false,"noRecoil":false,"target":"head","headshot":0}}

PUT /api/device-config
Authorization: Bearer YOUR_KEY
Content-Type: application/json

Body: {"deviceId":"YOUR_DEVICE_ID","config":{"aimSystem":false,"noRecoil":false,"target":"head","headshot":0}}

target: head, neck, body, mixed. headshot: numeric 0,25,50,75,100. Device ID: 1–128 ASCII letters, digits, underscore or hyphen.

อุปกรณ์ต้องตรวจ HTTP status และ ok ก่อนนำ config ไปใช้ เก็บค่าที่ใช้งานล่าสุดเมื่อเครือข่ายล้มเหลว การตอบ PUT สำเร็จหมายถึงบันทึก API แล้ว ยังไม่มี acknowledgement จากอุปกรณ์ และ KV อาจเผยแพร่ค่าล่าช้า

ไฟล์ original.3105 เป็นสำเนาต้นฉบับ ยังไม่ได้แก้ข้อมูลภายใน ต้องมี specification ของแพ็กเกจหรือ source/export จากแอปที่สร้างไฟล์ก่อนเชื่อม HTTP client ในแพตช์ได้
