# Terrain inspection and progressive disclosure

Field Navigation opens with its terrain map, budget state and selected round-trip summary. Mission controls, layers/evidence and route comparisons start collapsed. Opening or closing them preserves the worker revision, mission target, calculated routes and current close-view camera pose. Close buttons and Escape return focus to the corresponding disclosure control. Candidate numbers are hidden initially; reviewed exclusions and a selected candidate remain visible. The layer panel can show all candidates again.

## Inspection

Use **Inspect terrain** and choose a point, double-click supported terrain, or use **Inspect this terrain point** in a candidate card. This focuses the orbit camera on the native measured elevation. It does not change a mission destination or run the route planner. **Back to overview** restores the survey composition. The existing wheel/touch orbit controls and +/− buttons remain available.

Inside 420 m camera distance, the orbital display adds native 1 m samples around the focus while preserving the complete existing orbital grid. Four existing registered 512 px image tiles populate the bounded 1024 px detail atlas, using the finest available observed image level (about 0.3 m pixels). No new imagery, generated texture or synthetic rock geometry is introduced. The surrounding context perimeter is rebuilt with exactly the same focus axes, preserving its native boundary seam. Display resource values and planning arrays are unchanged.

The field camera stops at an 80 m orbit radius to avoid excessive magnification beyond the source detail. The + button disables at that limit; wheel/pinch controls share it. A measured-height clearance check keeps the orbit camera above the native or observed regional surface. Broad animated route ribbons fade near the camera while the thin screen-sized route lines remain visible.

**Expand map** changes the page layout to show only the map and essential route summary. It does not enter a browser fullscreen permission flow. Exit with its button or Escape. The map canvas remains mounted when disclosures or the expanded layout change, and close-view camera poses are preserved across panel resizing. Reduced-motion preferences continue to suppress route animation.

## Validation

`terrain-inspection.test.ts` checks physical target coordinates, unsupported points, unchanged planning data, measured detailed heights and native NoData handling. `regional-terrain.test.ts` includes a close-inspection seam check. Browser verification exercises actual native detail atlas activation, bounded zoom, disclosure state/focus restoration, route comparison, expanded view and mobile layout.
