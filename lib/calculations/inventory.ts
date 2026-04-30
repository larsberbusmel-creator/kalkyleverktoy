import type { Material } from "@/types/domain";
export function inventoryLineValue(material: Material, packages:number, looseQuantity:number){ return Number(packages||0)*material.packagePrice+Number(looseQuantity||0)*material.unitPrice; }
export function inventoryTotalQuantity(material: Material, packages:number, looseQuantity:number){ return Number(packages||0)*material.packageSize+Number(looseQuantity||0); }
