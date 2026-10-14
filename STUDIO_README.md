# Patch Studio

Owner/admin URL: https://dhx.dragonhex.workers.dev/patch-studio

Sign in with the existing dhx administrator account. Select a `.3105`, run analysis, review the discovered functions, choose the IPA group and patch title, then confirm. Analysis does not write a patch. Confirmation registers an API receiver upload master and its selected feature catalog. The owner can download the master afterward; normal users continue receiving scoped receiver files automatically through their logged-in IPA. No owner download link is added to the customer control page.

The analyzer reads the binary plist envelope, authenticates and decrypts public-key AES-GCM payloads, and reads IFix string tables. Files with passwords, another encryption format, malformed data, or unsupported interpreter structure are rejected or reported as unsupported.

Automatic receiver generation currently supports the exact verified DRAGON HEX original and receiver binaries, with the verified Free Fire bundle, replacement paths and local configuration. It does not generate bindings for arbitrary third-party menus from their names alone. An unknown menu needs its real sample and a reviewed adapter before confirmation and generation can be enabled. Additional rules are not silently dropped.

The known adapter contains ESP Master, Skeleton, Distance, Player Name, Health Bar, Top Tracer, Player Box, Silent Aim, Aim System, FOV Circle and No Recoil. Native AIM gameplay behavior remains unverified; successful file generation and state acknowledgement do not prove its gameplay effect.

Local tests cover package parsing, malformed input, unknown menu detection, admin authorization, same-origin confirmation, unchanged files between analysis/confirmation, no pre-confirm writes, registered output integrity and repeat confirmation. Browser QA verified authenticated analysis, 11 supported controls, API readiness, and disabled confirmation for an unknown-menu fixture. Live confirmation was left to the owner.
