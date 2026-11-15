# Mobile EVA verification — 2026-11-15

Browser: Chrome responsive viewport, not physical iOS/Android hardware. Sizes: 320 × 740, 390 × 844, and an 844 × 390 landscape surface-explorer smoke check.

## Completed flows

- Public Vercel baseline at 390 × 844: Surface Explorer → Mission Control → three departure checks → outbound checkpoints → HOLD → local position/buddy verification → resume → science checklist and four 5-minute science blocks → return review → habitat. Outcome: 20/20 science minutes, 81/110 simulated minutes, 43% modeled reserve (25% minimum).
- Revised local build at 320 × 740: Eastern ridge mission → departure checks → HOLD with simulated blocked corridor → verify position/buddy → compare and explicitly accept a +27 m alternative → science checklist and 20 minutes → return review → 12 return checkpoints → habitat. Outcome: 20/20 science minutes, 87/110 simulated minutes, 38% modeled reserve (25% minimum).
- New-rehearsal confirmation resets the completed run; menu links and route selection work.
- Integrated source: refresh after one outbound checkpoint offers the saved T+00:02 rehearsal. Restore enters HOLD, with checkpoint progression disabled until position and buddy checks are completed.

## Repaired findings

| Finding | Change and observed result |
| --- | --- |
| Active crew map began below the fixed controls | Compact mobile operational header, vitals and next-checkpoint layout. At 390 × 844 the map is now y=532–692; controls begin at y=719. |
| HOLD resume action fell below the mobile control bar | Compact HOLD card; at 320 × 740 Resume ends at y=571, above controls at y=615. Position and buddy checks remain required. |
| Science checklist was pushed below controls | Compact science hierarchy and redundant metric captions; all three tasks fit above the action bar at 320 × 740. Science time and reserve remain visible. |
| Surface route selector covered the destination pin | Horizontal mobile mission title/selector layout. Verified pin separation at 320 and 390 widths with no horizontal overflow. |
| Fixed crew dialogs allowed background scrolling | Lock body/root scroll while open, restore original overflow on close, and restore focus without scrolling. At 320 × 740 return review remains within y=73–667. |

Return confirmation remains disabled when a held crew has not completed the local checks. Alternate routes require explicit adoption. No mission physics, resource models or telemetry claims were changed.

## Evidence

Screenshots in [mobile-evidence](mobile-evidence/): before/after active crew at 390, HOLD at 320/390, science and completed detour at 320, surface explorer at 320/390.

## Verification limits

The checks use simulated checkpoint progression and Chrome viewport sizing. Physical touch hold behavior, iOS Safari, Android browser chrome/safe areas and device offline behavior still need hardware validation. A complete rehearsal does not establish operational astronaut safety.

## Automated checks on integrated source

54 test files / 384 tests passed. TypeScript, Vite production build, static/Navcam asset packaging and rover-display verification passed. `git diff --check` passed.
