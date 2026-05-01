export type Unit = "kg" | "liter" | "stk" | "g" | "ml" | "porsjoner" | string;

export type Material = {
  id: string;
  name: string;
  category?: string;
  unit: Unit;
  packageSize?: number;
  packagePrice?: number;
  pricePerUnit?: number;
  unitPrice?: number;
  retailPrice?: number;
  isForResale?: boolean;
  allergens?: string[];
  kcal?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  kj?: number;
  saturatedFat?: number;
  fiber?: number;
  sugars?: number;
  addedSugar?: number;
  salt?: number;
  [key: string]: any;
};

export type RecipeLine = {
  id?: string;
  itemId?: string;
  itemType?: "material" | "recipe" | "product" | string;
  amount?: number;
  quantity?: number;
  inputUnit?: string;
  material?: Material;
  recipe?: Recipe;
  product?: Product;
  [key: string]: any;
};

export type Recipe = {
  id: string;
  name: string;
  lines?: RecipeLine[];
  yieldAmount?: number;
  yieldUnit?: string;
  allergens?: string[];
  [key: string]: any;
};

export type ProductLine = {
  id?: string;
  itemId?: string;
  itemType?: "material" | "recipe" | "product" | string;
  amount?: number;
  inputUnit?: string;
  material?: Material;
  recipe?: Recipe;
  product?: Product;
  [key: string]: any;
};

export type Product = {
  id: string;
  name: string;
  lines?: ProductLine[];
  packaging?: any[];
  yieldAmount?: number;
  yieldUnit?: string;
  allergens?: string[];
  [key: string]: any;
};

export type MenuLine = {
  id?: string;
  itemId?: string;
  itemType?: "material" | "recipe" | "product" | string;
  amount?: number;
  quantity?: number;
  quantityPerPerson?: number;
  inputUnit?: string;
  materialUnit?: string;
  material?: Material;
  recipe?: Recipe;
  product?: Product;
  [key: string]: any;
};

export type Menu = {
  id: string;
  name: string;
  lines: MenuLine[];
  guests?: number;
  minGuests?: number;
  vatRate: number;
  [key: string]: any;
};