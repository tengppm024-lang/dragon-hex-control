# DRAGONx web receiver

Receiver generated from DRAGONx_Menu_Green.3105. The source password was used locally. Its existing encrypted key wrapping is preserved; no plaintext password is embedded in source code or the output.

The new DRAGONx WEB RECEIVER v2 entry in RUN ON WEBSITE replaces MENU ON WEBSITE. The previous entry is OFFLINE as a recoverable backup. The uploaded master is recognized by its SHA-256 digest. Each authenticated IPA download receives a fresh scoped receiver token through the existing delivery service.

The master file is for administrator upload. Users obtain a personalized executable package through their logged-in IPA; the unpersonalized master carries a placeholder token.

The web catalog follows the user's activated receiver profile. Eleven controls bind real integer slots: ESP, Bone, Distance, Name, HP, Line, Box, Aimbot, Aim Vector, Silent Aim / Scatter, and FOV. Original internal control IDs remain compatible with the existing API. FOV radius is supported. Headshot rate and the old target selectors are hidden for this profile because those bindings have not been established. The original menu's Silent Aim slot also gates its scatter-rate override; these effects share one switch.

Validation: original methods and wrapper data retained; GUI branches relocated; package authenticated and replacement digest verified; scoped generation, registered tokens, per-key catalog/mask, device isolation and expired-key rejection pass automated tests. Readback comes from actual fields and game entry-point flags report invocation only. None of these checks establish gameplay effects on a physical device. Physical game validation remains required.

After refresh, open DRAGONx WEB RECEIVER v2 from the IPA, then sign in again on the control website with the same access key. Saving changes sends them to that key's receiver.

IFix static-field semantics reference: https://github.com/Tencent/InjectFix/blob/master/Source/VSProj/Src/Core/VirtualMachine.cs
