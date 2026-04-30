export type Unit = "kg" | "liter" | "stk";

export type Material = {
  id: string;
  name: string;
  category: string;
  unit: Unit;
  packageSize: number;
  packagePrice: number;
  pricePerUnit: number;
  unitPrice: number;
  retailPrice?: number;
  isForResale?: boolean;
  allergens: string[];
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  kj: number;
  saturatedFat: number;
  fiber: number;
  sugars: number;
  addedSugar: number;
  salt: number;
};