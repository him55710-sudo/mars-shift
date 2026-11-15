import {DEFAULTS} from './planner';
import type {Settings} from './planner';

/** Preserve departure reserves while replanning with depleted resources.
 * The existing planner has one reserve percentage for two resource budgets.
 * Use the larger required fraction, conservatively preserving BOTH absolute
 * departure reserves instead of shrinking the reserve as resources are spent. */
export function remainingSandSettings(spentMinutes:number,budgetMinutes:number,returning:boolean):Settings{
 if(!Number.isFinite(spentMinutes)||spentMinutes<0||!Number.isFinite(budgetMinutes)||budgetMinutes<0)throw Error('Invalid mission clock');
 const oxygenMinutes=Math.max(.01,150-spentMinutes*(1+DEFAULTS.loadKg*.01));
 const powerMinutes=Math.max(.01,140-spentMinutes*(1+DEFAULTS.loadKg*.005));
 const reservePercent=Math.min(100,Math.max(37.5/oxygenMinutes,35/powerMinutes)*100);
 return {...DEFAULTS,mobilityModel:2,terrainEffort:.3,durationMinutes:Math.max(0,budgetMinutes-spentMinutes),oxygenMinutes,powerMinutes,reservePercent,scienceMinutes:returning?0:20};
}
