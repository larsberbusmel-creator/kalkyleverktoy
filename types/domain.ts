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
export type MenuLine = {
  id: string;
  itemId: string;
  itemType: "material" | "recipe" | "product";
  amount: number;
  quantityPerPerson: number;
  inputUnit?: string;
  materialUnit?: string;
};

export type Menu = {
  id: string;
  name: string;
  lines: MenuLine[];
  guests?: number;
};