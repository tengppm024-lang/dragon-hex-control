# แพตช์รับคำสั่งเว็บ

เพิ่มตัวรับคำสั่งลงใน bytecode ของไฟล์ 3105 ที่ผู้ใช้ส่งมาโดยตรง ไม่ต้องใช้ source C# เดิม ตัวรับใช้ UnityWebRequest แบบ asynchronous ใน OnGUI อ่านคำสั่งประมาณทุก 2 วินาที แล้วเขียนบิตเปิด–ปิดลง Vector2.x ของ SceneEditBoxSelectTool.DIGCJIKHGJP ซึ่งเมนูเดิมและเกมใช้ร่วมกัน

ตัวเลือกที่เชื่อม: AIM SYSTEM, SILENT AIM, NO RECOIL, TARGET และ HEADSHOT นำค่าตามตำแหน่งบิตของเมนูเดิมไปใช้ ไม่มีการแทนที่ body ของ game methods 0–4 เพิ่ม prefix ใน OnGUI และแทนการอ่าน touchCount ด้วยศูนย์ พร้อมปิดเมนูในเกม

เว็บให้ดาวน์โหลด DRAGON_HEX_WEB_RECEIVER.3105 หลังตรวจคีย์สำเร็จ แต่ละไฟล์ฝัง receiver token เฉพาะที่จับคู่กับ key + deviceId ของเบราว์เซอร์เดียวกัน ไม่ต้องกรอก Device ID ตัวแพตช์ไม่มี access key เดิม ส่วน Worker ตรวจสิทธิ์คีย์เดิมก่อนตอบคำสั่งทุกครั้ง

ตัวรับส่งค่าที่นำไปใช้แล้วกลับผ่าน X-Dragonhex-Applied ในการ poll ครั้งถัดไป เว็บแสดง GAME ACKNOWLEDGED เมื่อมีการติดต่อจากตัวรับในเกมและค่าตรงกับ config ล่าสุด การตอบ PUT สำเร็จอย่างเดียวไม่ถือว่าเกมรับแล้ว

แม่แบบแพตช์เก็บใน KV receiver:template:v1 ภายในบัญชี Cloudflare ไม่รวมแพตช์ต้นฉบับหรือแม่แบบไว้ใน public GitHub repository ส่วน config และ heartbeat ใช้ Durable Object ต่ออุปกรณ์เพื่อไม่ต้องรอ KV เผยแพร่ข้ามภูมิภาค

## วิธีใช้

1. เข้าเว็บ https://tengppm024-lang.github.io/dragon-hex-control/ แล้วกรอกคีย์จากระบบเดิม
2. กดดาวน์โหลด 3105 รับคำสั่งเว็บ
3. ปิดใช้งานแพตช์เดิม นำเข้าไฟล์ใหม่ในแอป 3105 และเปิดใช้งานไฟล์ใหม่นี้ ก่อนเปิดเกม
4. กลับหน้าเว็บเดิม เลือกฟังก์ชันแล้ว SAVE TO API รอ GAME ACKNOWLEDGED

ต้องใช้เว็บในเบราว์เซอร์ที่ดาวน์โหลดไฟล์เพื่อให้จับคู่อุปกรณ์ตรงกัน หากเปลี่ยนเบราว์เซอร์หรือคีย์ให้ดาวน์โหลดไฟล์จับคู่ใหม่

## การทดสอบและขอบเขต

- ผ่านการทดสอบการเข้ารหัส AES-GCM, plist, token personalization และ SHA-256 replacement digests ทั้งสองรายการ
- ผ่านการจำลอง stack ของคำสั่งตัวรับ, รอบ polling, คำตอบผิดรูปแบบ/HTTP error/exception, acknowledgement และการรักษาบิตนอกส่วนที่ควบคุม
- ผ่าน tests ฝั่ง Worker สำหรับตรวจสิทธิ์, แยกอุปกรณ์, token และคีย์ที่ถูกยกเลิก, config/acknowledgement ใน Durable Object
- HTTP error, ข้อมูลผิดรูปแบบ หรือ exception ทำให้ส่วน AIM/RECOIL ที่ควบคุมผ่านเว็บปิดจนได้รับคำตอบที่ถูกต้องอีกครั้ง
- ยังไม่ได้รันแพตช์บน iPhone/เกมจริง จึงยังไม่ยืนยัน compatibility ของ UnityWebRequest และ NewFieldInfo ใน IFix รุ่นเกมนี้ การจำลอง bytecode ไม่ใช่การทดสอบ interpreter จริง ต้องทดสอบไฟล์ที่ดาวน์โหลดบนเครื่องและตรวจ heartbeat ถ้า import ได้แต่เกมไม่ส่ง heartbeat ต้องตรวจ log การ load IFix ก่อน
- ข้อความ GAME ACKNOWLEDGED ยืนยันการเขียนสถานะของตัวรับ ไม่ใช่การวัดผลเล็ง/แรงดีดจาก gameplay
