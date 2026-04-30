import type { Menu, MenuLine } from "@/types/domain";
import { recipeCost } from "./recipes";
export function normalizeMenuQuantity(line: MenuLine){ if(line.inputUnit==="g"||line.inputUnit==="ml") return line.quantityPerPerson/1000; return line.quantityPerPerson; }
export function menuLineCost(line: MenuLine, guests=1){ const q=normalizeMenuQuantity(line); if(line.itemType==="material") return q*guests*Number(line.material?.unitPrice||0); return q*guests*(line.recipe ? recipeCost(line.recipe) : 0); }
export function menuRawCost(menu: Menu, guests=menu.minGuests){ return menu.lines.reduce((sum,line)=>sum+menuLineCost(line,guests),0); }
export function chefLaborCost({guests,hourlyRate,baseMinutes,extraMinutesPer10,twoChefsOver}:{guests:number;hourlyRate:number;baseMinutes:number;extraMinutesPer10:number;twoChefsOver:number}){ const groups=Math.max(1,Math.ceil(guests/10)); const minutes=baseMinutes+extraMinutesPer10*(groups-1); const chefs=guests>twoChefsOver?2:1; return (minutes/60)*hourlyRate*chefs; }
export function suggestedMenuPrice({menu,guests,chefCost,targetMargin}:{menu:Menu;guests:number;chefCost:number;targetMargin:number}){ const cost=menuRawCost(menu,guests)+chefCost; const costShare=100-targetMargin; if(costShare<=0) return 0; return (cost/(costShare/100))*(1+menu.vatRate/100); }
