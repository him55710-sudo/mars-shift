# Design research and compatible patterns

Checked during the active redesign. Competition projects below self-identify as 2026 entrants; this is not independent verification of eligibility, judging results or scientific claims.

| Project | Evidence inspected | Useful pattern | Application to MARS SHIFT |
|---|---|---|---|
| [Tour de Mars / 6bit_Larry](https://github.com/pengvil/Tour-de-Mars) | [Live planner](https://tour-de-mars.vercel.app/marswalk.html), real browser DOM and screenshot | Visible source readiness, numbered planning stages, demo mission | Preserve preparation gates and source status; simplify operational navigation and expose a clear next action |
| [Gale Marswalk Planner / AstroNox](https://github.com/sohaib1083/gale-marswalk-planner) | [Live app](https://sohaib1083.github.io/gale-marswalk-planner/app/), browser DOM | Explicit exploration scales from globe to local ground | Group Atlas, EVA Explorer and Surface XR as distinct tasks; retain region/scale context |
| [Code Huzzlers](https://github.com/RISHI-1453/NASA_Space-Apps_Challenge_Martian_Map) | Public repository description | Task-oriented planning and compact field checklist | Prioritize return limits and immediate movement instruction, keep deeper evidence behind disclosure |
| [MarsWay / UnknownX](https://github.com/ahsanur-official/Interplanetary-Survival-Guide-Martian-Map) | Public repository description | Integrated science/mapping explanation | Keep existing evidence and science routes reachable from the mission library |
| [Goslinuly Martian Map](https://github.com/Goslinuly/nasa-hackathon) | Repository README | Layered, integrated view of a route/location | Keep quantity, data type and provenance legible rather than adding decorative status cards |

Only the first two live interfaces were inspected interactively in this research pass. Other entries are stated product claims, not verified feature tests. No competitor source, image, mark, model output or text was copied into the app. Review screenshots are local research evidence, not distributable product assets. This comparison is a bounded sample, not an exhaustive survey of every 2026 entrant. It does not establish superiority or a winning guarantee.

## License and dependency register

| Evaluated source | Verified license / resource | Decision |
|---|---|---|
| shadcn/ui | [MIT](https://raw.githubusercontent.com/shadcn-ui/ui/main/LICENSE.md) | Compatible with Vite/React; do not add a styling stack just for existing buttons/disclosures |
| Radix Primitives | [MIT](https://raw.githubusercontent.com/radix-ui/primitives/main/LICENSE) | Native navigation disclosure used for now; retain as an option for a genuinely missing accessible primitive |
| Motion | [MIT](https://raw.githubusercontent.com/motiondivision/motion/main/LICENSE.md) | Existing CSS transitions and reduced-motion media query suffice |
| Magic UI open-source package | [MIT](https://raw.githubusercontent.com/magicuidesign/magicui/main/LICENSE.md) | No decorative components copied; the commercial Pro collection has separate terms and is not reused |
| Apple Design Resources | [Apple resource license](https://developer.apple.com/support/downloads/terms/apple-design-resources/Apple-Design-Resources-License-20230621-English.pdf) | Guidance only; no template, icon, font, product bezel or image copied |
| Existing React / Three.js / Lucide / fonts | Existing `THIRD_PARTY.md` | Preserve existing license records and icon set |

New authored files: `MissionNavigation.tsx`, `design-system.css`, `DESIGN.md`. New external UI dependencies: **none**. No downloaded competitor code is installed or executed.
