# Control Center v2

The website has separate login/control views, a live key countdown and complete ESP/AIM controls. There is no navigation to the key management page.

After updating, download the new personalized 3105 once and replace the old receiver. A new download revokes only the previous receiver for the same key. Existing receivers continue using the legacy endpoint for AIM until replaced; the dashboard reports UPDATE RECEIVER when a legacy receiver responds.

Runtime v2 uses `/api/runtime-config-v2`. Bits 0..5 control ESP Master, Distance, Player Name, Health Bar, Top Tracer and Player Box; bit 6 controls FOV Circle. The existing AIM bits 15..23 retain their original meanings, with Silent Aim target and Aim System target stored separately. Bits 24..28 transport the original 0..31 FOV radius index (50 + index × 11.29). Bit 29 transports Skeleton. The receiver applies only bits 0..6 and 15..23 to Vector2.x and encodes skeleton/radius in Vector2.y as -1000000 - ((radiusIndex << 3) | skeleton). Menu state and initialization bits remain local. These roles follow the actual rendering blocks: OnGUI 1406..1409 gates all ESP with x bit 0, while 1786..1789 gates bone rendering with y bit 0. The original menu text labels those two bits in reverse.

Private KV template: receiver:template:v2. Original package/template content is not committed to the public repository.

Expiry is enforced by fresh server authentication for every config request and receiver poll, as well as the web countdown. An expired key cannot authenticate again unless its record is deliberately renewed by the owner. Logout does not alter another key's state.

Automated verification covers complete field storage/validation, protocol separation, personalized encrypted package integrity, receiver stack/field writes, browser control payloads, expiry logout and key isolation. Actual new ESP/FOV behavior still needs confirmation in the user's running game; the earlier receiver was confirmed working by the user.
