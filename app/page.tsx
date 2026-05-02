"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Tab = "dashboard" | "materials" | "recipes" | "products" | "orders" | "production" | "inventory" | "rental" | "settings";
type Unit = "kg" | "liter" | "stk";
type YieldUnit = "kg" | "liter" | "stk" | "porsjoner";
type ProductType = "grunnoppskrift" | "bakst" | "cateringmeny" | "pasmuurt" | "egenprodusert";
type ProductSubType = "" | "brød" | "søtbakst" | "annet" | "hel" | "delt";

type Material = {
  id: string;
  name: string;
  category: string;
  supplier?: string;
  ingredients?: string[];
  unit: Unit;
  packageSize: number;
  packagePrice: number;
  pricePerUnit: number;
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
  isWholegrain?: boolean;
  updatedAt?: string;
  priceUpdatedAt?: string;
};


type RecipeLine = {
  itemType: "material" | "recipe";
  itemId: string;
  amount: number;
};

type Recipe = {
  id: string;
  productNumber: string;
  name: string;
  category: string;
  yieldAmount: number;
  yieldUnit: YieldUnit;
  lines: RecipeLine[];
};

type Packaging = {
  id: string;
  name: string;
  price: number;
};

type ProductLine = {
  itemType: "material" | "recipe" | "product";
  itemId: string;
  amount: number;
  unit: "kg" | "liter" | "stk" | "porsjoner";
};

type ProductPackagingLine = {
  packagingId: string;
  quantity: number;
};

type Product = {
  id: string;
  productNumber: string;
  name: string;
  type: ProductType;
  subType: ProductSubType;
  category: string;
  yieldAmount: number;
  yieldUnit: YieldUnit;
  portionsPerWhole?: number;
  customerPrice: number;
  storkjokkenPriceExVat?: number;
  targetMargin: number;
  lines: ProductLine[];
  packaging: ProductPackagingLine[];
};


type OrderLine = { productId: string; quantity: number };

type Order = {
  id: string;
  type: "catering" | "bakeri" | "pasmuurt" | "egenprodusert" | "storkjokken";
  customerType: "privat" | "bedrift" | "storkjokken";
  customer: string;
  companyName?: string;
  orgNumber?: string;
  companyAddress?: string;
  phone: string;
  deliveryAddress: string;
  date: string;
  time: string;
  guests: number;
  productId: string;
  orderLines: OrderLine[];
  discountPercent?: number;
  isRecurring?: boolean;
  recurringDays?: string[];
  recurringNote?: string;
  allergens: Record<string, number>;
  dietVegan?: string;
  dietVegetarian?: string;
  dietPregnant?: string;
  dietOther?: string;
};

type RentalExtraLine = { text: string; amount: number; quantity?: number; unitPrice?: number };
type RentalProductLine = { productId: string; guests: number };

type RentalOffer = {
  customer: string;
  venue: string;
  venuePrice: number;
  waiters: number;
  waiterHours: number;
  waiterAfterMidnightHours: number;
  productLines: RentalProductLine[];
  extraLines: RentalExtraLine[];
};

type Venue = { id: string; name: string; price: number };

type Settings = {
  foodVat: number;
  chefHourlyRate: number;
  chefBaseMinutes: number;
  chefExtraMinutesPer10: number;
  twoChefsOverGuests: number;
  waiterRate: number;
  waiterAfterMidnightRate: number;
};

type InventoryCount = { packages: number; loose: number; packagePrice: number; pricePerUnit: number };
type InventoryMonthData = {
  locked?: boolean;
  waste?: Record<string, number>;
  items: Record<string, InventoryCount>;
};

type RentalAddon = { id: string; name: string; price: number };

type ProductListKind = "bakst" | "catering" | "storkjokken";

type ProductList = {
  id: string;
  name: string;
  kind: ProductListKind;
  introText: string;
  productIds: string[];
  createdAt: string;
};

type AppData = {
  materials: Material[];
  recipes: Recipe[];
  products: Product[];
  orders: Order[];
  settings: Settings;
  rental: RentalOffer;
  venues: Venue[];
  packaging: Packaging[];
  rentalAddons: RentalAddon[];
  productLists: ProductList[];
  menuCategories: string[];
  productCategories: string[];
  materialCategories: string[];
  inventoryCounts?: Record<string, InventoryMonthData>;
};

const STORAGE_KEY = "kalkyleverktoy-prototype-v4-products";

const defaultAllergens = ["Gluten", "Hvete", "Rug", "Spelt", "Bygg", "Egg", "Melk", "Laktose", "Skalldyr", "Bløtdyr", "Selleri", "Lupin", "Sulfitt", "Nøtter", "Peanøtter", "Sesam", "Soya"];
const defaultMaterialCategories = ["Mat", "Mel og frø", "Meieri", "Kjøtt", "Fisk", "Grønt", "Tørrvarer", "Kjølevarer", "Frysevare", "Frukt og grønt", "Krydder", "Deli", "Mineralvann", "Kaffe/te", "Vin", "Øl", "Cider", "Brennevin"];
const defaultMenuCategories = ["Catering", "Selskap", "Bryllup", "Konfirmasjon", "Firma"];
const defaultProductCategories = ["Grunnoppskrift", "Brød", "Søtbakst", "Cateringmeny", "Påsmurt", "Egenprodusert"];
const defaultRentalAddons: RentalAddon[] = [
  { id: "bar-oppsett", name: "Oppsett av bar", price: 5000 },
  { id: "toyservietter", name: "Tøyservietter", price: 35 },
  { id: "vinpakke-3-glass", name: "Vinpakke 3 glass", price: 345 },
  { id: "alkoholfri-3-glass", name: "Alkoholfri drikkepakke 3 glass", price: 255 },
  { id: "rigg-vielse-utendors", name: "Rigg Vielse utendørs", price: 3500 },
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function idFromName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9æøå]+/gi, "-").replace(/^-|-$/g, "") || String(Date.now());
}

function currency(value: number) {
  return new Intl.NumberFormat("nb-NO", { style: "currency", currency: "NOK", maximumFractionDigits: 2 }).format(Number(value) || 0);
}

function formatDateNo(date: string) {
  if (!date) return "-";
  const [year, month, day] = date.split("-");
  return day && month && year ? `${day}.${month}.${year}` : date;
}

function num(value: number, digits = 2) {
  return new Intl.NumberFormat("nb-NO", { maximumFractionDigits: digits }).format(Number(value) || 0);
}

function escapeHtml(value: string) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeAllergen(value: string) {
  const s = value.trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : "";
}

function exVatFromIncVat(amountIncVat: number, vatRate: number) {
  const rate = Number(vatRate || 0);
  return rate > 0 ? amountIncVat / (1 + rate / 100) : amountIncVat;
}

function vatAmountFromIncVat(amountIncVat: number, vatRate: number) {
  return amountIncVat - exVatFromIncVat(amountIncVat, vatRate);
}

function marginPercentFrom(priceExVat: number, cost: number) {
  return priceExVat > 0 ? ((priceExVat - cost) / priceExVat) * 100 : 0;
}

function foodCostPercentFrom(priceExVat: number, cost: number) {
  return priceExVat > 0 ? (cost / priceExVat) * 100 : 0;
}

function marginTone(margin: number) {
  if (margin >= 65) return "good";
  if (margin >= 50) return "warn";
  return "bad";
}

function makeMaterial(id: string, name: string, category: string, unit: Unit, packageSize: number, packagePrice: number, allergens: string[], kcal: number, protein: number, carbs: number, fat: number, kj: number, saturatedFat: number, fiber: number, sugars: number, addedSugar: number, salt: number, isWholegrain = false): Material {
  return {
  id,
  name,
  category,
  unit,
  packageSize,
  packagePrice,
  pricePerUnit: packageSize ? packagePrice / packageSize : 0,
  allergens,
  ingredients: [],
  kcal,
  protein,
  carbs,
  fat,
  kj,
  saturatedFat,
  fiber,
  sugars,
  addedSugar,
  salt,
  isWholegrain,
  updatedAt: new Date().toISOString(),
  priceUpdatedAt: new Date().toISOString(),
};

}

const initialData: AppData = {
  materials: [
    makeMaterial("hvetemel", "Hvetemel", "Mel og frø", "kg", 25, 350, ["Gluten", "Hvete"], 340, 10, 70, 1.5, 1420, 0.3, 3, 1, 0, 0.01),
    makeMaterial("smor", "Smør", "Meieri", "kg", 1, 95, ["Melk", "Laktose"], 720, 1, 1, 80, 3010, 52, 0, 1, 0, 1.5),
    makeMaterial("melk", "Melk", "Meieri", "liter", 1, 22, ["Melk", "Laktose"], 43, 3.4, 4.7, 1, 180, 0.7, 0, 4.7, 0, 0.1),
    makeMaterial("sukker", "Sukker", "Tørrvarer", "kg", 1, 25, [], 400, 0, 100, 0, 1700, 0, 0, 100, 100, 0),
    makeMaterial("gjaer", "Gjær", "Kjølevarer", "kg", 1, 80, [], 105, 8, 14, 2, 440, 0.4, 7, 0, 0, 0.1),
    makeMaterial("salt", "Salt", "Tørrvarer", "kg", 1, 18, [], 0, 0, 0, 0, 0, 0, 0, 0, 0, 100),
  ],
  recipes: [
    { id: "bolledeig", productNumber: "1001", name: "Bolledeig base", category: "Grunnoppskrift", yieldAmount: 9, yieldUnit: "kg", lines: [
      { itemType: "material", itemId: "hvetemel", amount: 5 },
      { itemType: "material", itemId: "smor", amount: 0.8 },
      { itemType: "material", itemId: "melk", amount: 2 },
      { itemType: "material", itemId: "sukker", amount: 0.6 },
      { itemType: "material", itemId: "gjaer", amount: 0.12 },
      { itemType: "material", itemId: "salt", amount: 0.08 },
    ]},
  ],
  products: [
    { id: "mandelbolle", productNumber: "2001", name: "Mandelbolle", type: "bakst", subType: "søtbakst", category: "Søtbakst", yieldAmount: 1, yieldUnit: "stk", customerPrice: 48, targetMargin: 70, lines: [{ itemType: "recipe", itemId: "bolledeig", amount: 0.1, unit: "kg" }], packaging: [] },
    { id: "tapas", productNumber: "3001", name: "Tapasbuffet", type: "cateringmeny", subType: "", category: "Catering", yieldAmount: 1, yieldUnit: "porsjoner", customerPrice: 595, targetMargin: 70, lines: [{ itemType: "product", itemId: "mandelbolle", amount: 1, unit: "stk" }], packaging: [] },
  ],
  orders: [],
  settings: { foodVat: 15, chefHourlyRate: 350, chefBaseMinutes: 60, chefExtraMinutesPer10: 30, twoChefsOverGuests: 40, waiterRate: 580, waiterAfterMidnightRate: 950 },
  rental: { customer: "", venue: "Kaféen", venuePrice: 11000, waiters: 1, waiterHours: 0, waiterAfterMidnightHours: 0, productLines: [{ productId: "", guests: 0 }], extraLines: [{ text: "", amount: 0 }] },
  venues: [{ id: "kafeen", name: "Kaféen", price: 11000 }, { id: "oscarshall", name: "Oscarshall", price: 18000 }, { id: "gammelfloya", name: "Gammelfløya", price: 18000 }, { id: "bodogaard", name: "Bodøgaard hel helg", price: 24000 }],
  packaging: [{ id: "glass", name: "Glass", price: 8 }, { id: "brodpose", name: "Brødpose", price: 2.5 }, { id: "aluminiumsbakke", name: "Aluminiumsbakke", price: 12 }],
  rentalAddons: defaultRentalAddons,
  productLists: [],
  menuCategories: defaultMenuCategories,
  productCategories: defaultProductCategories,
  materialCategories: defaultMaterialCategories,
  inventoryCounts: {},
};

function migrateData(raw: Partial<AppData>): AppData {
  const recipes = (raw.recipes || initialData.recipes).map((recipe: any) => ({
    id: recipe.id,
    productNumber: recipe.productNumber || "",
    name: recipe.name,
    category: recipe.category || "Grunnoppskrift",
    yieldAmount: Number(recipe.yieldAmount || recipe.batchUnits || 1),
    yieldUnit: recipe.yieldUnit || "kg",
    lines: (recipe.lines || []).map((line: any) => ({ itemType: line.itemType || "material", itemId: line.itemId || line.materialId || "", amount: Number(line.amount || 0) })),
  }));

  const oldMenus = ((raw as any).menus || []).map((m: any) => ({
    id: m.id,
    productNumber: "",
    name: m.name,
    type: "cateringmeny" as ProductType,
    subType: "" as ProductSubType,
    category: m.category || "Catering",
    yieldAmount: 1,
    yieldUnit: "porsjoner" as YieldUnit,
    customerPrice: Number(m.customerPrice || 0),
    targetMargin: Number(m.targetMargin || 70),
    lines: (m.lines || []).map((l: any) => ({ itemType: l.itemType || "material", itemId: l.itemId, amount: Number(l.amountPerPerson || 0), unit: l.inputUnit || "stk" })),
    packaging: [],
  }));

  return {
    ...initialData,
    ...raw,
    recipes,
    products: raw.products || oldMenus || initialData.products,
    orders: raw.orders || [],
    settings: { ...initialData.settings, ...(raw.settings || {}) },
    rental: { ...initialData.rental, ...(raw.rental || {}) },
    venues: raw.venues || initialData.venues,
    packaging: raw.packaging || initialData.packaging,
    rentalAddons: (raw as any).rentalAddons || defaultRentalAddons,
    productLists: (raw as any).productLists || [],
    menuCategories: raw.menuCategories || defaultMenuCategories,
    productCategories: raw.productCategories || defaultProductCategories,
    materialCategories: raw.materialCategories || defaultMaterialCategories,
    inventoryCounts: raw.inventoryCounts || {},
  };
}

export default function Page() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [data, setData] = useState<AppData>(initialData);

  useEffect(() => {
  async function loadData() {
    const { data: row, error } = await supabase
      .from("app_data")
      .select("data")
      .eq("id", "main")
      .single();

    if (error) {
      console.error("Supabase load error:", error);

      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          setData(migrateData(JSON.parse(saved)));
        } catch {
          setData(initialData);
        }
      }

      setIsLoaded(true);
      return;
    }

    if (row?.data) {
      setData(migrateData(row.data));
    }

    setIsLoaded(true);
  }

  loadData();
}, []);

  useEffect(() => { if (isLoaded) localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }, [data, isLoaded]);

  function updateData(partial: Partial<AppData>) {
  setData((prev) => {
    const next = { ...prev, ...partial };

    supabase
      .from("app_data")
      .upsert({
        id: "main",
        data: next,
        updated_at: new Date().toISOString(),
      })
      .then(({ error }) => {
        if (error) console.error("Supabase save error:", error);
      });

    return next;
  });
}

  function exportData() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `kalkyleverktoy-backup-${today()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }

  function importData(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(String(reader.result || ""));
        setData(migrateData(imported));
        alert("Data er importert.");
      } catch { alert("Kunne ikke lese filen. Sjekk at det er en JSON-backup."); }
    };
    reader.readAsText(file);
  }

  function recipeCost(recipe: Recipe, visited: string[] = []): number {
    if (visited.includes(recipe.id)) return 0;
    return recipe.lines.reduce((sum, line) => {
      if (line.itemType === "recipe") {
        const r = data.recipes.find((x) => x.id === line.itemId);
        if (!r) return sum;
        return sum + recipeUnitCost(r, [...visited, recipe.id]) * line.amount;
      }
      const m = data.materials.find((x) => x.id === line.itemId);
      return sum + (m?.pricePerUnit || 0) * line.amount;
    }, 0);
  }

  function recipeTotalAmount(recipe: Recipe) {
    const total = recipe.lines.reduce((sum, line) => sum + Number(line.amount || 0), 0);
    return total > 0 ? total : Math.max(recipe.yieldAmount || 1, 1);
  }

  function recipeUnitCost(recipe: Recipe, visited: string[] = []) {
    return recipeCost(recipe, visited) / Math.max(recipeTotalAmount(recipe), 1);
  }

  function recipeAllergens(recipe: Recipe, visited: string[] = []): string[] {
    if (visited.includes(recipe.id)) return [];
    return Array.from(new Set(recipe.lines.flatMap((line) => {
      if (line.itemType === "recipe") {
        const r = data.recipes.find((x) => x.id === line.itemId);
        return r ? recipeAllergens(r, [...visited, recipe.id]) : [];
      }
      return data.materials.find((m) => m.id === line.itemId)?.allergens || [];
    })));
  }

  function productCost(product: Product, visited: string[] = []): number {
    if (visited.includes(product.id)) return 0;
    const lineCost = product.lines.reduce((sum, line) => {
      if (line.itemType === "material") {
        const m = data.materials.find((x) => x.id === line.itemId);
        if (!m) return sum;
        const amount = line.unit === "kg" || line.unit === "liter" || line.unit === "stk" ? line.amount : line.amount;
        return sum + amount * m.pricePerUnit;
      }
      if (line.itemType === "recipe") {
        const r = data.recipes.find((x) => x.id === line.itemId);
        if (!r) return sum;
        return sum + recipeUnitCost(r) * line.amount;
      }
      const p = data.products.find((x) => x.id === line.itemId);
      if (!p) return sum;
      return sum + productUnitCost(p, [...visited, product.id]) * line.amount;
    }, 0);

    const packagingCost = product.packaging.reduce((sum, p) => {
      const pack = data.packaging.find((x) => x.id === p.packagingId);
      return sum + (pack?.price || 0) * p.quantity;
    }, 0);

    return lineCost + packagingCost;
  }

  function productUnitCost(product: Product, visited: string[] = []) {
    return productCost(product, visited) / Math.max(product.yieldAmount || 1, 1);
  }

  function productAllergens(product: Product, visited: string[] = []): string[] {
    if (visited.includes(product.id)) return [];
    return Array.from(new Set(product.lines.flatMap((line) => {
      if (line.itemType === "material") return data.materials.find((m) => m.id === line.itemId)?.allergens || [];
      if (line.itemType === "recipe") {
        const r = data.recipes.find((x) => x.id === line.itemId);
        return r ? recipeAllergens(r) : [];
      }
      const p = data.products.find((x) => x.id === line.itemId);
      return p ? productAllergens(p, [...visited, product.id]) : [];
    })));
  }

  function recommendedPriceIncVat(costExVat: number, marginPercent: number) {
    const margin = Number(marginPercent || 0) / 100;
    if (margin >= 1) return 0;
    return Math.ceil((costExVat / (1 - margin)) * (1 + data.settings.foodVat / 100));
  }

  if (!isLoaded) return <main style={{ padding: 24 }}>Laster...</main>;

  return (
    <main style={{ minHeight: "100vh", background: "#f8fafc", padding: 24, color: "#0f172a" }}>
      <div style={{ maxWidth: 1250, margin: "0 auto" }}>
        <header className="card">
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
    
    {/* VENSTRE */}
    <div>
      <img
        src="/logo.png"
        alt="Logo"
        style={{
          height: 140,
          width: "auto",
          objectFit: "contain",
        }}
      />
    </div>

    {/* HØYRE */}
   <button
  className="btn logout"
  onClick={async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }}
>
  Logg ut
</button>

  </div>
</header>

        <nav style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "18px 0" }}>
          {[["dashboard", "Startside"], ["materials", "Råvarer"], ["recipes", "Grunnoppskrifter"], ["products", "Produkter"], ["orders", "Ordre"], ["production", "Produksjon"], ["inventory", "Varetelling"], ["rental", "Leie av lokale"], ["settings", "Innstillinger"]].map(([key, label]) => <button key={key} className={tab === key ? "btn active" : "btn"} onClick={() => setTab(key as Tab)}>{label}</button>)}
        </nav>

        {tab === "dashboard" && <DashboardTab data={data} productCost={productCost} setTab={setTab} />}
        {tab === "materials" && <MaterialsTab data={data} updateData={updateData} />}
        {tab === "recipes" && <RecipesTab data={data} updateData={updateData} recipeCost={recipeCost} recipeUnitCost={recipeUnitCost} recipeTotalAmount={recipeTotalAmount} recipeAllergens={recipeAllergens} />}
        {tab === "products" && <ProductsTab data={data} updateData={updateData} recipeUnitCost={recipeUnitCost} productCost={productCost} productUnitCost={productUnitCost} productAllergens={productAllergens} recommendedPriceIncVat={recommendedPriceIncVat} />}
        {tab === "orders" && <OrdersTab data={data} updateData={updateData} productAllergens={productAllergens} />}
        {tab === "production" && <ProductionTab data={data} />}
        {tab === "inventory" && <InventoryTab data={data} updateData={updateData} />}
        {tab === "rental" && <RentalTab data={data} updateData={updateData} />}
        {tab === "settings" && (
  <SettingsTab
    data={data}
    updateData={updateData}
    exportData={exportData}
    importData={importData}
  />
)}
      </div>
      <GlobalStyles />
    </main>
  );
}

function DashboardTab({ data, productCost, setTab }: { data: AppData; productCost: (p: Product) => number; setTab: (tab: Tab) => void }) {
  const todaysOrders = data.orders.filter((o) => o.date === today()).sort((a, b) => (a.time || "").localeCompare(b.time || ""));
  const todaysProduction = todaysOrders.flatMap((o) => o.orderLines.map((l) => ({ order: o, product: data.products.find((p) => p.id === l.productId), quantity: l.quantity })));
  const todaysRevenue = todaysOrders.reduce((sum, order) => {
    const subtotal = order.orderLines.reduce((lineSum, line) => {
      const product = data.products.find((p) => p.id === line.productId);
      return lineSum + (product?.customerPrice || 0) * Number(line.quantity || 0);
    }, 0);
    const discount = subtotal * ((Number(order.discountPercent) || 0) / 100);
    return sum + subtotal - discount;
  }, 0);
  const recentMaterials = [...data.materials].sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || "")).slice(0, 6);

  return (
    <section>
      <div className="card">
        <h2 className="today-title">I dag</h2>
        <div className="metric-row three-metrics">
          <Metric label="Ordre i dag" value={String(todaysOrders.length)} dark />
          <Metric label="Produksjonslinjer" value={String(todaysProduction.length)} />
          <Metric label="Total omsetning i dag" value={currency(todaysRevenue)} />
        </div>
        <div className="grid two">
          <div>
            <h3>Dagens ordre</h3>
            <table><tbody>{todaysOrders.length ? todaysOrders.map((o) => <tr key={o.id} className="click-row" onClick={() => setTab("orders")}><td>{o.time || "-"}</td><td>{o.customerType === "bedrift" || o.customerType === "storkjokken" ? o.companyName || o.customer : o.customer}</td><td>{o.orderLines.map((l) => `${l.quantity} × ${data.products.find((p) => p.id === l.productId)?.name || "Produkt"}`).join(", ")}</td></tr>) : <tr><td>Ingen ordre i dag</td></tr>}</tbody></table>
          </div>
          <div>
            <h3>Dagens produksjon</h3>
            <table><tbody>{todaysProduction.length ? todaysProduction.map((x, i) => <tr key={i}><td>{x.quantity}</td><td>{x.product?.name}</td><td>{x.order.time || "-"}</td></tr>) : <tr><td>Ingen produksjon i dag</td></tr>}</tbody></table>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="metric-row"><Metric label="Råvarer" value={String(data.materials.length)} dark /><Metric label="Grunnoppskrifter" value={String(data.recipes.length)} /><Metric label="Produkter" value={String(data.products.length)} /><Metric label="Ordre" value={String(data.orders.length)} /></div>
        <div className="grid two">
          <div>
            <h3>Produkter med høyest kost</h3>
            <table><tbody>{data.products.map((p) => ({ p, cost: productCost(p) })).sort((a, b) => b.cost - a.cost).slice(0, 6).map(({ p, cost }) => <tr key={p.id}><td>{p.name}</td><td>{p.type}</td><td style={{ textAlign: "right" }}>{currency(cost)}</td></tr>)}</tbody></table>
          </div>
          <div>
            <h3>Nylig lagt til / endret råvarer</h3>
            <table><tbody>{recentMaterials.map((m) => <tr key={m.id}><td>{m.name}</td><td>{m.category}</td><td>{m.updatedAt ? formatDateNo(m.updatedAt.slice(0, 10)) : "-"}</td></tr>)}</tbody></table>
          </div>
        </div>
      </div>
    </section>
  );
}

function MaterialsTab({ data, updateData }: { data: AppData; updateData: (p: Partial<AppData>) => void }) {
  const blank = {
    id: "",
    name: "",
    supplier: "",
    category: data.materialCategories[0] || "Mat",
    unit: "kg" as Unit,
    packageSize: "1",
    packagePrice: "0",
    retailPrice: "",
    deliMargin: "50",
    allergens: "",
    ingredients: "",
    kcal: "0",
    protein: "0",
    carbs: "0",
    fat: "0",
    kj: "0",
    saturatedFat: "0",
    fiber: "0",
    sugars: "0",
    addedSugar: "0",
    salt: "0",
    isWholegrain: false,
  };

  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("Alle");
  const [materialPage, setMaterialPage] = useState(1);
  const pageSize = 50;

  const filtered = data.materials
    .filter((m) => `${m.name} ${m.category} ${m.supplier || ""}`.toLowerCase().includes(search.toLowerCase()))
    .filter((m) => categoryFilter === "Alle" || m.category === categoryFilter)
    .sort((a, b) => `${a.category} ${a.name}`.localeCompare(`${b.category} ${b.name}`, "no-NO"));

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visibleMaterials = filtered.slice((materialPage - 1) * pageSize, materialPage * pageSize);

  function reset() {
    setForm(blank);
    setEditingId(null);
  }

  function edit(m: Material) {
    setForm({
      ...blank,
      id: m.id,
      name: m.name,
      supplier: m.supplier || "",
      category: m.category,
      unit: m.unit,
      packageSize: String(m.packageSize),
      packagePrice: String(m.packagePrice),
      retailPrice: String(m.retailPrice || ""),
      allergens: (m.allergens || []).join(", "),
      ingredients: (m.ingredients || []).join(", "),
      kcal: String(m.kcal || 0),
      protein: String(m.protein || 0),
      carbs: String(m.carbs || 0),
      fat: String(m.fat || 0),
      kj: String(m.kj || 0),
      saturatedFat: String(m.saturatedFat || 0),
      fiber: String(m.fiber || 0),
      sugars: String(m.sugars || 0),
      addedSugar: String(m.addedSugar || 0),
      salt: String(m.salt || 0),
      isWholegrain: !!m.isWholegrain,
    });
    setEditingId(m.id);
    setShowForm(true);
  }

  function save() {
    if (!form.name.trim()) return;
    const id = editingId || `${idFromName(form.name)}-${Date.now()}`;
    const oldMaterial = editingId ? data.materials.find((x) => x.id === editingId) : undefined;
    const packageSize = Number(form.packageSize) || 1;
    const packagePrice = Number(form.packagePrice) || 0;
    const oldPrice = oldMaterial?.pricePerUnit || 0;
    const newPrice = packageSize ? packagePrice / packageSize : 0;
    const priceChanged = !oldMaterial || Math.abs(oldPrice - newPrice) > 0.0001;

    const m = {
      ...makeMaterial(id, form.name, form.category, form.unit, packageSize, packagePrice, form.allergens.split(",").map(normalizeAllergen).filter(Boolean), Number(form.kcal) || 0, Number(form.protein) || 0, Number(form.carbs) || 0, Number(form.fat) || 0, Number(form.kj) || 0, Number(form.saturatedFat) || 0, Number(form.fiber) || 0, Number(form.sugars) || 0, Number(form.addedSugar) || 0, Number(form.salt) || 0, form.isWholegrain),
      retailPrice: Number(form.retailPrice) || undefined,
      isForResale: form.category === "Deli",
      supplier: form.supplier || "",
      ingredients: form.ingredients
  .split(",")
  .map((x) => x.trim())
  .filter(Boolean),
      updatedAt: new Date().toISOString(),
      priceUpdatedAt: priceChanged ? new Date().toISOString() : oldMaterial?.priceUpdatedAt,
    };

    updateData({ materials: editingId ? data.materials.map((x) => x.id === editingId ? m : x) : [m, ...data.materials] });
    reset();
    setShowForm(false);
  }

  function updateMaterialInline(materialId: string, patch: Partial<Material>, priceChanged = false) {
    updateData({
      materials: data.materials.map((m) => {
        if (m.id !== materialId) return m;
        return {
          ...m,
          ...patch,
          updatedAt: new Date().toISOString(),
          priceUpdatedAt: priceChanged ? new Date().toISOString() : m.priceUpdatedAt,
        };
      }),
    });
  }

  return <section className="card">
    <div className="between"><h2>Råvarer</h2><button className="btn active" onClick={() => { reset(); setShowForm(true); }}>Ny råvare</button></div>

    {showForm && <div className="soft-box">
      <div className="form-grid">
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Navn" />
        <label>Leverandør<input value={form.supplier || ""} onChange={(e) => setForm({ ...form, supplier: e.target.value })} placeholder="F.eks ASKO" /></label>
        <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{data.materialCategories.map((c) => <option key={c}>{c}</option>)}</select>
        <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value as Unit })}><option value="kg">kg</option><option value="liter">liter</option><option value="stk">stk</option></select>
        <label>Pakningsstørrelse<input type="number" value={form.packageSize} onChange={(e) => setForm({ ...form, packageSize: e.target.value })} /></label>
        <label>Pakningspris eks. mva<input type="number" value={form.packagePrice} onChange={(e) => setForm({ ...form, packagePrice: e.target.value })} /></label>
        <Metric label={`Pris per ${form.unit}`} value={currency((Number(form.packagePrice) || 0) / (Number(form.packageSize) || 1))} />
      </div>

      {form.category === "Deli" && (() => {
        const costExVat = (Number(form.packagePrice) || 0) / (Number(form.packageSize) || 1);
        const selectedMargin = Math.max(Number(form.deliMargin) || 50, 0);
        const suggestedIncVat = selectedMargin >= 100 ? 0 : Math.ceil((costExVat / (1 - selectedMargin / 100)) * (1 + data.settings.foodVat / 100));
        const retailIncVat = Number(form.retailPrice) || 0;
        const retailExVat = exVatFromIncVat(retailIncVat, data.settings.foodVat);
        const finalMargin = marginPercentFrom(retailExVat, costExVat);
        const finalFoodCost = foodCostPercentFrom(retailExVat, costExVat);
        return <div className="soft-box" style={{ gridColumn: "1 / -1" }}><h3>Deli / videresalg</h3><div className="form-grid four"><label>Ønsket fortjeneste %<input type="number" min="50" value={form.deliMargin} onChange={(e) => setForm({ ...form, deliMargin: e.target.value })} /></label><Metric label="Anbefalt utsalgspris inkl. mva" value={currency(suggestedIncVat)} dark /><label>Valgt utsalgspris inkl. mva<input type="number" value={form.retailPrice} onChange={(e) => setForm({ ...form, retailPrice: e.target.value })} /></label><button className="btn active" type="button" onClick={() => setForm({ ...form, retailPrice: String(suggestedIncVat) })}>Bruk anbefalt pris</button></div><div className="metric-row"><Metric label="Innkjøpspris eks. mva / enhet" value={currency(costExVat)} /><Metric label="Valgt pris eks. mva" value={currency(retailExVat)} /><Metric label="Varekost" value={`${num(finalFoodCost, 1)} %`} /><Metric label="Fortjeneste" value={`${num(finalMargin, 1)} %`} tone={marginTone(finalMargin)} /></div></div>;
      })()}

      <label>
  Ingredienser i råvaren
  <input
    value={form.ingredients}
    onChange={(e) => setForm({ ...form, ingredients: e.target.value })}
    placeholder="F.eks. fløte, salt / vann, soyabønner, sukker"
  />
</label>

      <h3>Allergier</h3>
      <div className="chips">{defaultAllergens.map((a) => { const arr = form.allergens.split(",").map((x) => x.trim()).filter(Boolean); const active = arr.includes(a); return <button key={a} type="button" className={active ? "btn active" : "btn"} onClick={() => setForm({ ...form, allergens: (active ? arr.filter((x) => x !== a) : [...arr, a]).join(", ") })}>{a}</button>; })}</div>
      <h3>Næring per 100g/ml</h3>
      <div className="form-grid five">{[["kj", "kJ"], ["kcal", "Kcal"], ["fat", "Fett"], ["saturatedFat", "Mettet fett"], ["protein", "Protein"], ["carbs", "Karbo"], ["sugars", "Sukkerarter"], ["addedSugar", "Tilsatt sukker"], ["fiber", "Kostfiber"], ["salt", "Salt"]].map(([k, label]) => <label key={k}>{label}<input type="number" value={(form as any)[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} /></label>)}</div>
      <label className="check"><input type="checkbox" checked={form.isWholegrain} onChange={(e) => setForm({ ...form, isWholegrain: e.target.checked })} /> Fullkorn/grov råvare</label>
      <button className="btn active" onClick={save}>Lagre</button><button className="btn" onClick={() => { reset(); setShowForm(false); }}>Avbryt</button>
    </div>}

    <input value={search} onChange={(e) => { setSearch(e.target.value); setMaterialPage(1); }} placeholder="Søk råvare / leverandør" />
    <div className="chips">{["Alle", ...data.materialCategories].filter((v, i, arr) => arr.indexOf(v) === i).map((cat) => <button key={cat} className={categoryFilter === cat ? "btn active" : "btn"} onClick={() => { setCategoryFilter(cat); setMaterialPage(1); }}>{cat}</button>)}</div>
    <p style={{ color: "#64748b" }}>Viser {visibleMaterials.length} av {filtered.length} råvarer. Side {materialPage} av {totalPages}.</p>

    <table>
      <thead><tr><th>Råvare</th><th>Leverandør</th><th>Kategori</th><th>Pakning</th><th>Pris/enhet</th><th>Utsalgspris</th><th>Margin</th><th>Allergener</th><th></th><th>Sist prisendret</th></tr></thead>
      <tbody>{visibleMaterials.map((m) => {
        const retailExVat = exVatFromIncVat(m.retailPrice || 0, data.settings.foodVat);
        const deliMargin = m.category === "Deli" ? marginPercentFrom(retailExVat, m.pricePerUnit) : 0;
        return <tr key={m.id}>
          <td>
  <b>{m.name}</b>
  {m.isForResale && (
    <>
      <br />
      <small style={{ color: "#64748b" }}>Videresalg</small>
    </>
  )}
</td>
          <td><input className="inline-cell-input" value={m.supplier || ""} onChange={(e) => updateMaterialInline(m.id, { supplier: e.target.value })} placeholder="Leverandør" /></td>
          <td><select className="inline-cell-input" value={m.category} onChange={(e) => updateMaterialInline(m.id, { category: e.target.value, isForResale: e.target.value === "Deli" })}>{data.materialCategories.map((c) => <option key={c}>{c}</option>)}</select></td>
          <td><div className="inline-packaging-grid"><input className="inline-cell-input" type="number" value={m.packageSize} onChange={(e) => { const packageSize = Number(e.target.value) || 1; updateMaterialInline(m.id, { packageSize, packagePrice: m.pricePerUnit * packageSize }, true); }} /><select className="inline-cell-input" value={m.unit} onChange={(e) => updateMaterialInline(m.id, { unit: e.target.value as Unit })}><option value="kg">kg</option><option value="liter">liter</option><option value="stk">stk</option></select></div></td>
          <td><input className="inline-cell-input" type="number" value={m.pricePerUnit} onChange={(e) => { const pricePerUnit = Number(e.target.value) || 0; updateMaterialInline(m.id, { pricePerUnit, packagePrice: pricePerUnit * (m.packageSize || 1) }, true); }} /></td>
          <td><input className="inline-cell-input" type="number" value={m.retailPrice || ""} onChange={(e) => updateMaterialInline(m.id, { retailPrice: Number(e.target.value) || undefined })} placeholder="-" /></td>
          <td>{m.category === "Deli" ? `${num(deliMargin, 1)} %` : "-"}</td>
          <td>{(m.allergens || []).join(", ") || "-"}</td>
          <td><button className="btn" onClick={() => { edit(m); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Rediger</button><button style={{ marginLeft: 8 }} className="btn danger" onClick={() => { if (confirm("Slette råvaren?")) updateData({ materials: data.materials.filter((x) => x.id !== m.id) }); }}>Slett</button></td>
          <td>{m.priceUpdatedAt ? formatDateNo(m.priceUpdatedAt.slice(0, 10)) : "-"}</td>
        </tr>;
      })}</tbody>
    </table>
    <div className="pager"><button className="btn" disabled={materialPage <= 1} onClick={() => setMaterialPage(materialPage - 1)}>Forrige</button><span>Side {materialPage} av {totalPages}</span><button className="btn" disabled={materialPage >= totalPages} onClick={() => setMaterialPage(materialPage + 1)}>Neste</button></div>
  </section>;
}

function RecipesTab({ data, updateData, recipeCost, recipeUnitCost, recipeTotalAmount, recipeAllergens }: { data: AppData; updateData: (p: Partial<AppData>) => void; recipeCost: (r: Recipe) => number; recipeUnitCost: (r: Recipe) => number; recipeTotalAmount: (r: Recipe) => number; recipeAllergens: (r: Recipe) => string[] }) {
  const [selectedId, setSelectedId] = useState(data.recipes[0]?.id || "");
  const [mode, setMode] = useState<"view" | "new" | "edit">("view");
  const [form, setForm] = useState({ productNumber: "", name: "", category: "Grunnoppskrift", yieldAmount: "1", yieldUnit: "kg" as YieldUnit });
  const [draftLines, setDraftLines] = useState<RecipeLine[]>([]);
  const [line, setLine] = useState({ itemType: "material" as "material" | "recipe", itemId: "", amount: "0" });
  const [lineSearch, setLineSearch] = useState("");
  const [recipeSearch, setRecipeSearch] = useState("");

  const selected = data.recipes.find((r) => r.id === selectedId);
  const activeRecipe: Recipe | undefined = mode === "view" ? selected : {
    id: selected?.id || "draft",
    productNumber: form.productNumber,
    name: form.name || "Ny grunnoppskrift",
    category: form.category,
    yieldAmount: Number(form.yieldAmount) || 1,
    yieldUnit: form.yieldUnit,
    lines: draftLines,
  };

  const filteredRecipes = data.recipes
    .filter((r) => `${r.productNumber} ${r.name} ${r.category}`.toLowerCase().includes(recipeSearch.toLowerCase()))
    .sort((a, b) => `${a.category} ${a.name}`.localeCompare(`${b.category} ${b.name}`, "no-NO"));

  function startNewRecipe() {
    setMode("new");
    setForm({ productNumber: "", name: "", category: "Grunnoppskrift", yieldAmount: "1", yieldUnit: "kg" });
    setDraftLines([]);
    setLine({ itemType: "material", itemId: "", amount: "0" });
    setLineSearch("");
  }

  function editRecipe(r: Recipe) {
    setSelectedId(r.id);
    setMode("edit");
    setForm({ productNumber: r.productNumber || "", name: r.name, category: r.category, yieldAmount: String(r.yieldAmount), yieldUnit: r.yieldUnit });
    setDraftLines(r.lines.map((l) => ({ ...l })));
    setLine({ itemType: "material", itemId: "", amount: "0" });
    setLineSearch("");
  }

  function cancelEdit() {
    setMode("view");
    setDraftLines([]);
    setLineSearch("");
  }

  function saveRecipe() {
    if (!form.name.trim()) return alert("Legg inn navn på grunnoppskrift.");
    const recipe: Recipe = {
      id: mode === "edit" && selected ? selected.id : `${idFromName(form.name)}-${Date.now()}`,
      productNumber: form.productNumber,
      name: form.name.trim(),
      category: form.category || "Grunnoppskrift",
      yieldAmount: Number(form.yieldAmount) || 1,
      yieldUnit: form.yieldUnit,
      lines: draftLines,
    };
    updateData({ recipes: mode === "edit" ? data.recipes.map((r) => r.id === recipe.id ? recipe : r) : [recipe, ...data.recipes] });
    setSelectedId(recipe.id);
    setMode("view");
    setDraftLines([]);
  }

  function lineItemName(itemType: RecipeLine["itemType"], itemId: string) {
    if (itemType === "material") return data.materials.find((x) => x.id === itemId)?.name || "";
    return data.recipes.find((x) => x.id === itemId)?.name || "";
  }

  function lineOptions(itemType: RecipeLine["itemType"], query: string) {
    const q = query.toLowerCase();
    const source = itemType === "material"
      ? data.materials.map((x) => ({ id: x.id, name: x.name, subtitle: `${x.category} · ${x.supplier || "Uten leverandør"} · ${currency(x.pricePerUnit)}/${x.unit}` }))
      : data.recipes.filter((x) => x.id !== selected?.id).map((x) => ({ id: x.id, name: x.name, subtitle: `${x.category} · ${num(x.yieldAmount)} ${x.yieldUnit}` }));
    return source.filter((x) => !q || `${x.name} ${x.subtitle}`.toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name, "no-NO")).slice(0, 12);
  }

  function lineCost(l: RecipeLine) {
    if (l.itemType === "material") {
      const m = data.materials.find((x) => x.id === l.itemId);
      return l.amount * (m?.pricePerUnit || 0);
    }
    const r = data.recipes.find((x) => x.id === l.itemId);
    return l.amount * (r ? recipeUnitCost(r) : 0);
  }

  function addLine() {
    if (!line.itemId) return;
    if (line.itemType === "recipe" && line.itemId === selected?.id) return alert("En grunnoppskrift kan ikke inneholde seg selv.");
    setDraftLines((prev) => [...prev, { itemType: line.itemType, itemId: line.itemId, amount: Number(line.amount) || 0 }]);
    setLine({ itemType: "material", itemId: "", amount: "0" });
    setLineSearch("");
  }

  function updateDraftLine(index: number, partial: Partial<RecipeLine>) {
    setDraftLines((prev) => prev.map((l, i) => i === index ? { ...l, ...partial } : l));
  }

  function printRecipe(recipe: Recipe) {
    const rows = recipe.lines.map((l) => {
      const name = lineItemName(l.itemType, l.itemId) || "Ukjent";
      return `<tr><td>${l.itemType === "material" ? "Råvare" : "Grunnoppskrift"}</td><td>${name}</td><td>${num(l.amount, 3)}</td><td>${currency(lineCost(l))}</td></tr>`;
    }).join("");
    const allergens = recipeAllergens(recipe).join(", ") || "Ingen registrert";
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8" /><title>${recipe.name}</title><style>body{font-family:Arial,sans-serif;color:#111827;padding:36px;line-height:1.4}.top{border-bottom:3px solid #111827;padding-bottom:18px;margin-bottom:24px}.logo{font-size:26px;font-weight:900}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:18px 0}.metric{background:#f1f5f9;border-radius:12px;padding:12px}.metric b{display:block;font-size:20px;margin-top:4px}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border-bottom:1px solid #e5e7eb;padding:9px;text-align:left}th{background:#f3f4f6}@media print{button{display:none}body{padding:18px}}</style></head><body><button onclick="window.print()">Print</button><div class="top"><div class="logo">GRUNNOPPSKRIFT</div><h1>${recipe.name}</h1><p>${recipe.category}</p></div><div class="metrics"><div class="metric">Total kost eks. mva<b>${currency(recipeCost(recipe))}</b></div><div class="metric">Totalvekt / yield<b>${num(recipeTotalAmount(recipe), 3)} ${recipe.yieldUnit}</b></div><div class="metric">Pris per ${recipe.yieldUnit}<b>${currency(recipeUnitCost(recipe))}</b></div><div class="metric">Allergener<b>${allergens}</b></div></div><h2>Ingredienser</h2><table><thead><tr><th>Type</th><th>Navn</th><th>Mengde</th><th>Kost</th></tr></thead><tbody>${rows}</tbody></table></body></html>`);
    w.document.close();
    w.focus();
  }

  if (mode !== "view") {
    return ( 
    <section className="card product-editor-page"><div className="between"><h1>{mode === "edit" ? "Rediger grunnoppskrift" : "Ny grunnoppskrift"}</h1><div><button className="btn active" onClick={saveRecipe}>{mode === "edit" ? "Lagre endringer" : "Lagre grunnoppskrift"}</button><button className="btn" onClick={cancelEdit}>Avbryt</button></div></div>
      <div className="form-grid four"><label>Produktnr<input value={form.productNumber} onChange={(e) => setForm({ ...form, productNumber: e.target.value })} placeholder="Produktnr" /></label><label>Navn<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Navn" /></label><label>Kategori<input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Kategori" /></label><label>Gir<input type="number" value={form.yieldAmount} onChange={(e) => setForm({ ...form, yieldAmount: e.target.value })} /></label><label>Enhet<select value={form.yieldUnit} onChange={(e) => setForm({ ...form, yieldUnit: e.target.value as YieldUnit })}><option value="kg">kg</option><option value="liter">liter</option><option value="stk">stk</option><option value="porsjoner">porsjoner</option></select></label></div>
      {activeRecipe && <div className="metric-row"><Metric label="Total kost eks. mva" value={currency(recipeCost(activeRecipe))} dark /><Metric label="Totalvekt / yield" value={`${num(recipeTotalAmount(activeRecipe), 3)} ${form.yieldUnit}`} /><Metric label={`Pris per ${form.yieldUnit}`} value={currency(recipeUnitCost(activeRecipe))} dark /><Metric label="Allergener" value={recipeAllergens(activeRecipe).join(", ") || "Ingen"} /></div>}
      <div className="soft-box"><h2>Ingredienser</h2><div className="form-grid four"><select value={line.itemType} onChange={(e) => { setLine({ ...line, itemType: e.target.value as RecipeLine["itemType"], itemId: "" }); setLineSearch(""); }}><option value="material">Råvare</option><option value="recipe">Annen grunnoppskrift</option></select><div className="search-picker"><input value={lineSearch || lineItemName(line.itemType, line.itemId)} onChange={(e) => { setLineSearch(e.target.value); setLine({ ...line, itemId: "" }); }} placeholder="Søk og velg" />{lineSearch && <div className="search-dropdown inline">{lineOptions(line.itemType, lineSearch).map((item) => <button key={item.id} type="button" className="search-result" onClick={() => { setLine({ ...line, itemId: item.id }); setLineSearch(item.name); }}><b>{item.name}</b><small>{item.subtitle}</small></button>)}</div>}</div><input type="number" value={line.amount} onChange={(e) => setLine({ ...line, amount: e.target.value })} placeholder="Mengde" /><button className="btn" onClick={addLine}>Legg til</button></div>
      <table><thead><tr><th>Type</th><th>Navn</th><th>Mengde</th><th>Kost</th><th></th></tr></thead><tbody>{draftLines.map((l, i) => <tr key={i}><td><select value={l.itemType} onChange={(e) => updateDraftLine(i, { itemType: e.target.value as RecipeLine["itemType"], itemId: "" })}><option value="material">Råvare</option><option value="recipe">Grunnoppskrift</option></select></td><td><select value={l.itemId} onChange={(e) => updateDraftLine(i, { itemId: e.target.value })}><option value="">Velg</option>{l.itemType === "material" ? data.materials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>) : data.recipes.filter((r) => r.id !== selected?.id).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></td><td><input type="number" value={l.amount} onChange={(e) => updateDraftLine(i, { amount: Number(e.target.value) || 0 })} /></td><td>{currency(lineCost(l))}</td><td><button className="link danger" onClick={() => setDraftLines((prev) => prev.filter((_, ix) => ix !== i))}>Slett</button></td></tr>)}</tbody></table></div>
     </section>
  );
}

  return ( 
  <section className="grid two"><div className="card"><div className="between"><h2>Grunnoppskrifter</h2><button className="btn active" onClick={startNewRecipe}>Ny grunnoppskrift</button></div><input value={recipeSearch} onChange={(e) => setRecipeSearch(e.target.value)} placeholder="Søk grunnoppskrift" />{filteredRecipes.map((r) => <div key={r.id} className={selectedId === r.id ? "list active-list" : "list"}><button className="plain" onClick={() => setSelectedId(r.id)}><b>{r.name}</b><br /><small>{r.category} · {r.yieldAmount} {r.yieldUnit} · kost {currency(recipeCost(r))} · {currency(recipeUnitCost(r))}/{r.yieldUnit}</small></button><button className="link" onClick={() => editRecipe(r)}>Rediger</button><button className="link danger" onClick={() => { if (confirm("Slette grunnoppskrift?")) updateData({ recipes: data.recipes.filter((x) => x.id !== r.id) }); }}>Slett</button></div>)}</div><div className="card">{!selected ? <p>Velg eller opprett en grunnoppskrift.</p> : <><div className="between"><div><h2>{selected.name}</h2><p>{selected.category} · totalvekt {num(recipeTotalAmount(selected), 3)} {selected.yieldUnit}</p></div><div><button className="btn" onClick={() => editRecipe(selected)}>Rediger</button><button className="btn" onClick={() => printRecipe(selected)}>Print</button></div></div><div className="metric-row"><Metric label="Total kost eks. mva" value={currency(recipeCost(selected))} dark /><Metric label="Totalvekt / yield" value={`${num(recipeTotalAmount(selected), 3)} ${selected.yieldUnit}`} /><Metric label={`Pris per ${selected.yieldUnit}`} value={currency(recipeUnitCost(selected))} dark /><Metric label="Allergener" value={recipeAllergens(selected).join(", ") || "Ingen"} /></div><h3>Ingredienser</h3><table><thead><tr><th>Type</th><th>Navn</th><th>Mengde</th><th>Kost</th></tr></thead><tbody>{selected.lines.map((l, i) => <tr key={i}><td>{l.itemType === "material" ? "Råvare" : "Grunnoppskrift"}</td><td>{lineItemName(l.itemType, l.itemId)}</td><td>{num(l.amount)}</td><td>{currency(lineCost(l))}</td></tr>)}</tbody></table></>}</div></section>
);
}

function ProductsTab({ data, updateData, recipeUnitCost, productCost, productUnitCost, productAllergens, recommendedPriceIncVat }: { data: AppData; updateData: (p: Partial<AppData>) => void; recipeUnitCost: (r: Recipe) => number; productCost: (p: Product) => number; productUnitCost: (p: Product) => number; productAllergens: (p: Product) => string[]; recommendedPriceIncVat: (cost: number, margin: number) => number }) {
  const [selectedId, setSelectedId] = useState(data.products[0]?.id || "");
  const [mode, setMode] = useState<"view" | "new" | "edit">("view");
  const [form, setForm] = useState({ productNumber: "", name: "", type: "bakst" as ProductType, subType: "" as ProductSubType, category: "Søtbakst", yieldAmount: "1", yieldUnit: "stk" as YieldUnit, portionsPerWhole: "", customerPrice: "0", storkjokkenPriceExVat: "", targetMargin: "70" });
  const [draftLines, setDraftLines] = useState<ProductLine[]>([]);
  const [draftPackaging, setDraftPackaging] = useState<ProductPackagingLine[]>([]);
  const [line, setLine] = useState({ itemType: "material" as ProductLine["itemType"], itemId: "", amount: "0", unit: "kg" as ProductLine["unit"] });
  const [lineSearch, setLineSearch] = useState("");
  const [packLine, setPackLine] = useState({ packagingId: "", quantity: "1" });
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Alle");
  const [productPage, setProductPage] = useState(1);
  const [wideProductId, setWideProductId] = useState<string | null>(null);
  const [listMode, setListMode] = useState<ProductListKind>("bakst");
  const [showProductListEditor, setShowProductListEditor] = useState(false);
  const [listName, setListName] = useState("Ny produktliste");
  const [listIntroText, setListIntroText] = useState("");
  const [listSelectedIds, setListSelectedIds] = useState<string[]>([]);

  const pageSize = 20;
  const selected = data.products.find((p) => p.id === selectedId);
  const wideProduct = data.products.find((p) => p.id === wideProductId);

  const filtered = data.products
    .filter((p) => {
      const matchesSearch = `${p.productNumber} ${p.name} ${p.type} ${p.category}`.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = categoryFilter === "Alle" || p.category === categoryFilter || p.type === categoryFilter;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => `${a.category} ${a.name}`.localeCompare(`${b.category} ${b.name}`, "no-NO"));

  const totalProductPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pagedProducts = filtered.slice((productPage - 1) * pageSize, productPage * pageSize);

  const draftProduct: Product = {
    id: selected?.id || "draft",
    productNumber: form.productNumber,
    name: form.name || "Nytt produkt",
    type: form.type,
    subType: form.subType,
    category: form.category,
    yieldAmount: Number(form.yieldAmount) || 1,
    yieldUnit: form.yieldUnit,
    portionsPerWhole: form.portionsPerWhole ? Number(form.portionsPerWhole) : undefined,
    customerPrice: Number(form.customerPrice) || 0,
    storkjokkenPriceExVat: form.storkjokkenPriceExVat ? Number(form.storkjokkenPriceExVat) : undefined,
    targetMargin: Number(form.targetMargin) || 70,
    lines: draftLines,
    packaging: draftPackaging,
  };

  const activeProduct = mode === "view" ? selected : draftProduct;

  function priceIncVatFromCost(costExVat: number, marginPercent: number, vatRate: number) {
    const margin = Number(marginPercent || 0) / 100;
    if (margin >= 1) return 0;
    return Math.ceil((costExVat / (1 - margin)) * (1 + vatRate / 100));
  }

  function startNewProduct() {
    setMode("new");
    setForm({ productNumber: "", name: "", type: "bakst", subType: "", category: "Søtbakst", yieldAmount: "1", yieldUnit: "stk", portionsPerWhole: "", customerPrice: "0", storkjokkenPriceExVat: "", targetMargin: "70" });
    setDraftLines([]);
    setDraftPackaging([]);
    setLine({ itemType: "material", itemId: "", amount: "0", unit: "kg" });
    setLineSearch("");
  }

  function blankFor(type: ProductType) {
    const map: Record<ProductType, Partial<typeof form>> = {
      grunnoppskrift: { category: "Grunnoppskrift", yieldUnit: "kg", customerPrice: "0" },
      bakst: { category: "Søtbakst", yieldUnit: "stk" },
      cateringmeny: { category: "Cateringmeny", yieldUnit: "porsjoner" },
      pasmuurt: { category: "Påsmurt", yieldUnit: "stk" },
      egenprodusert: { category: "Egenprodusert", yieldUnit: "stk" },
    };
    setForm((f) => ({ ...f, type, subType: "", ...(map[type] as any) }));
  }

  function saveProduct() {
    if (!form.name.trim()) return alert("Legg inn produktnavn.");
    const product: Product = {
      ...draftProduct,
      id: mode === "edit" && selected ? selected.id : `${idFromName(form.name)}-${Date.now()}`,
      name: form.name.trim(),
    };

    updateData({
      products: mode === "edit"
        ? data.products.map((x) => x.id === product.id ? product : x)
        : [product, ...data.products],
    });

    setSelectedId(product.id);
    setMode("view");
  }

  function editProduct(p: Product) {
    setForm({
      productNumber: p.productNumber || "",
      name: p.name,
      type: p.type,
      subType: p.subType || "",
      category: p.category,
      yieldAmount: String(p.yieldAmount),
      yieldUnit: p.yieldUnit,
      portionsPerWhole: String(p.portionsPerWhole || ""),
      customerPrice: String(p.customerPrice || 0),
      storkjokkenPriceExVat: String(p.storkjokkenPriceExVat || ""),
      targetMargin: String(p.targetMargin || 70),
    });
    setDraftLines(p.lines.map((l) => ({ ...l })));
    setDraftPackaging(p.packaging.map((x) => ({ ...x })));
    setSelectedId(p.id);
    setMode("edit");
  }

  function updateDraftLine(index: number, partial: Partial<ProductLine>) {
    setDraftLines((prev) => prev.map((l, i) => i === index ? { ...l, ...partial } : l));
  }

  function updateDraftPackaging(index: number, partial: Partial<ProductPackagingLine>) {
    setDraftPackaging((prev) => prev.map((p, i) => i === index ? { ...p, ...partial } : p));
  }

  function addLine() {
    if (!line.itemId) return;
    if (line.itemType === "product" && line.itemId === selected?.id) return alert("Et produkt kan ikke inneholde seg selv.");

    setDraftLines((prev) => [...prev, {
      itemType: line.itemType,
      itemId: line.itemId,
      amount: Number(line.amount) || 0,
      unit: line.unit,
    }]);

    setLine({ itemType: "material", itemId: "", amount: "0", unit: "kg" });
    setLineSearch("");
  }

  function addPackaging() {
    if (!packLine.packagingId) return;
    setDraftPackaging((prev) => [...prev, { packagingId: packLine.packagingId, quantity: Number(packLine.quantity) || 0 }]);
    setPackLine({ packagingId: "", quantity: "1" });
  }

  function lineCost(l: ProductLine) {
    const m = l.itemType === "material" ? data.materials.find((x) => x.id === l.itemId) : undefined;
    const r = l.itemType === "recipe" ? data.recipes.find((x) => x.id === l.itemId) : undefined;
    const p = l.itemType === "product" ? data.products.find((x) => x.id === l.itemId) : undefined;

    if (l.itemType === "material") return l.amount * (m?.pricePerUnit || 0);
    if (l.itemType === "recipe") return l.amount * (r ? recipeUnitCost(r) : 0);
    return l.amount * (p ? productUnitCost(p) : 0);
  }

  function lineItemName(itemType: ProductLine["itemType"], itemId: string) {
    if (itemType === "material") return data.materials.find((x) => x.id === itemId)?.name || "";
    if (itemType === "recipe") return data.recipes.find((x) => x.id === itemId)?.name || "";
    return data.products.find((x) => x.id === itemId)?.name || "";
  }

  type NutritionTotals = {
  kcal: number;
  kj: number;
  protein: number;
  carbs: number;
  fat: number;
  saturatedFat: number;
  fiber: number;
  sugars: number;
  addedSugar: number;
  salt: number;
  totalAmount: number;
};

function emptyNutrition(): NutritionTotals {
  return {
    kcal: 0,
    kj: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    saturatedFat: 0,
    fiber: 0,
    sugars: 0,
    addedSugar: 0,
    salt: 0,
    totalAmount: 0,
  };
}

function addMaterialNutrition(total: NutritionTotals, material: Material, amount: number, unit?: ProductLine["unit"] | YieldUnit) {
  const amountInGramsOrMl = unit === "stk" || unit === "porsjoner" ? amount : amount * 1000;
  const factor = amountInGramsOrMl / 100;

  total.kcal += (material.kcal || 0) * factor;
  total.kj += (material.kj || 0) * factor;
  total.protein += (material.protein || 0) * factor;
  total.carbs += (material.carbs || 0) * factor;
  total.fat += (material.fat || 0) * factor;
  total.saturatedFat += (material.saturatedFat || 0) * factor;
  total.fiber += (material.fiber || 0) * factor;
  total.sugars += (material.sugars || 0) * factor;
  total.addedSugar += (material.addedSugar || 0) * factor;
  total.salt += (material.salt || 0) * factor;
  total.totalAmount += amountInGramsOrMl;
}

function mergeNutrition(target: NutritionTotals, source: NutritionTotals) {
  Object.keys(target).forEach((key) => {
    target[key as keyof NutritionTotals] += source[key as keyof NutritionTotals];
  });
}

function recipeNutrition(recipe: Recipe, multiplier = 1, visited: string[] = []) {
  const total = emptyNutrition();
  if (visited.includes(recipe.id)) return total;

  recipe.lines.forEach((line) => {
    const amount = line.amount * multiplier;

    if (line.itemType === "material") {
      const material = data.materials.find((m) => m.id === line.itemId);
      if (material) addMaterialNutrition(total, material, amount);
    }

    if (line.itemType === "recipe") {
      const subRecipe = data.recipes.find((r) => r.id === line.itemId);
      if (subRecipe) mergeNutrition(total, recipeNutrition(subRecipe, amount, [...visited, recipe.id]));
    }
  });

  return total;
}

function productNutrition(product: Product, multiplier = 1, visited: string[] = []) {
  const total = emptyNutrition();
  if (visited.includes(product.id)) return total;

  product.lines.forEach((line) => {
    const amount = line.amount * multiplier;

    if (line.itemType === "material") {
      const material = data.materials.find((m) => m.id === line.itemId);
      if (material) addMaterialNutrition(total, material, amount, line.unit);
    }

    if (line.itemType === "recipe") {
      const recipe = data.recipes.find((r) => r.id === line.itemId);
      if (recipe) mergeNutrition(total, recipeNutrition(recipe, amount));
    }

    if (line.itemType === "product") {
      const subProduct = data.products.find((p) => p.id === line.itemId);
      if (subProduct) mergeNutrition(total, productNutrition(subProduct, amount, [...visited, product.id]));
    }
  });

  return total;
}

function nutritionPer100(product: Product) {
  const total = productNutrition(product);
  const divisor = total.totalAmount > 0 ? total.totalAmount / 100 : 1;

  return {
    kcal: total.kcal / divisor,
    kj: total.kj / divisor,
    protein: total.protein / divisor,
    carbs: total.carbs / divisor,
    fat: total.fat / divisor,
    saturatedFat: total.saturatedFat / divisor,
    fiber: total.fiber / divisor,
    sugars: total.sugars / divisor,
    addedSugar: total.addedSugar / divisor,
    salt: total.salt / divisor,
  };
}

type IngredientRow = {
  name: string;
  amount: number;
};

function materialIngredientName(material: Material) {
  if (material.ingredients && material.ingredients.length) {
    return material.ingredients.join(", ");
  }

  return material.name;
}

function addIngredient(
  map: Record<string, IngredientRow>,
  name: string,
  amount: number
) {
  if (!name.trim()) return;

  if (!map[name]) {
    map[name] = { name, amount: 0 };
  }

  map[name].amount += amount;
}

function recipeIngredientMap(
  recipe: Recipe,
  multiplier = 1,
  map: Record<string, IngredientRow> = {},
  visited: string[] = []
) {
  if (visited.includes(recipe.id)) return map;

  recipe.lines.forEach((line) => {
    const amount = Number(line.amount || 0) * multiplier;

    if (line.itemType === "material") {
      const material = data.materials.find((m) => m.id === line.itemId);
      if (material) {
        addIngredient(map, materialIngredientName(material), amount);
      }
    }

    if (line.itemType === "recipe") {
      const subRecipe = data.recipes.find((r) => r.id === line.itemId);
      if (subRecipe) {
        recipeIngredientMap(subRecipe, amount, map, [...visited, recipe.id]);
      }
    }
  });

  return map;
}

function productIngredientMap(
  product: Product,
  multiplier = 1,
  map: Record<string, IngredientRow> = {},
  visited: string[] = []
) {
  if (visited.includes(product.id)) return map;

  product.lines.forEach((line) => {
    const amount = Number(line.amount || 0) * multiplier;

    if (line.itemType === "material") {
      const material = data.materials.find((m) => m.id === line.itemId);
      if (material) {
        addIngredient(map, materialIngredientName(material), amount);
      }
    }

    if (line.itemType === "recipe") {
      const recipe = data.recipes.find((r) => r.id === line.itemId);
      if (recipe) {
        recipeIngredientMap(recipe, amount, map);
      }
    }

    if (line.itemType === "product") {
      const subProduct = data.products.find((p) => p.id === line.itemId);
      if (subProduct) {
        productIngredientMap(subProduct, amount, map, [...visited, product.id]);
      }
    }
  });

  return map;
}

function productIngredients(product: Product): string[] {
  return Object.values(productIngredientMap(product))
    .sort((a, b) => b.amount - a.amount)
    .map((x) => x.name);
}

function printNutritionLabel(product: Product) {
  const n = nutritionPer100(product);
  const ingredients = productIngredients(product).join(", ") || "-";
  const allergens = productAllergens(product).join(", ") || "Ingen registrert";

  const w = window.open("", "_blank");
  if (!w) return;

  w.document.write(`<!doctype html><html><head><meta charset="utf-8" /><title>Næring ${escapeHtml(product.name)}</title><style>body{font-family:Arial,sans-serif;color:#111827;padding:32px}.label{max-width:520px;border:2px solid #111827;padding:18px}h1{font-size:24px;margin:0 0 10px}table{width:100%;border-collapse:collapse;margin-top:12px}td,th{border-bottom:1px solid #d1d5db;padding:7px;text-align:left}th{background:#f3f4f6}.small{font-size:12px;color:#4b5563;margin-top:12px}@media print{button{display:none}body{padding:0}}</style></head><body><button onclick="window.print()">Print</button><div class="label"><h1>${escapeHtml(product.name)}</h1><p><b>Ingredienser:</b> ${escapeHtml(ingredients)}</p><p><b>Allergener:</b> ${escapeHtml(allergens)}</p><p><b>Næringsinnhold per 100 g/ml</b></p><table><tbody><tr><td>Energi</td><td>${num(n.kj, 0)} kJ / ${num(n.kcal, 0)} kcal</td></tr><tr><td>Fett</td><td>${num(n.fat, 1)} g</td></tr><tr><td>– hvorav mettet fett</td><td>${num(n.saturatedFat, 1)} g</td></tr><tr><td>Karbohydrater</td><td>${num(n.carbs, 1)} g</td></tr><tr><td>– hvorav sukkerarter</td><td>${num(n.sugars, 1)} g</td></tr><tr><td>Kostfiber</td><td>${num(n.fiber, 1)} g</td></tr><tr><td>Protein</td><td>${num(n.protein, 1)} g</td></tr><tr><td>Salt</td><td>${num(n.salt, 2)} g</td></tr></tbody></table><p class="small">Beregnet fra registrerte råvarer.</p></div></body></html>`);

  w.document.close();
  w.focus();
}

function printProductLabel(product: Product) {
  const n = nutritionPer100(product);
  const ingredients = productIngredients(product).join(", ") || "-";
  const allergens = productAllergens(product).join(", ") || "Ingen registrert";

  const w = window.open("", "_blank");
  if (!w) return;

  w.document.write(`<!doctype html><html><head><meta charset="utf-8" /><title>Label ${escapeHtml(product.name)}</title><style>@page{size:90mm 60mm;margin:5mm}body{font-family:Arial,sans-serif;color:#111827;font-size:10px}h1{font-size:16px;margin:0 0 4px}table{width:100%;border-collapse:collapse;margin-top:6px}td{border-bottom:1px solid #ddd;padding:2px}.muted{color:#4b5563}.bold{font-weight:800}@media print{button{display:none}}</style></head><body><button onclick="window.print()">Print label</button><h1>${escapeHtml(product.name)}</h1><p><span class="bold">Ingredienser:</span> ${escapeHtml(ingredients)}</p><p><span class="bold">Allergener:</span> ${escapeHtml(allergens)}</p><table><tbody><tr><td>Energi</td><td>${num(n.kj, 0)} kJ / ${num(n.kcal, 0)} kcal</td></tr><tr><td>Fett</td><td>${num(n.fat, 1)} g</td></tr><tr><td>Mettet fett</td><td>${num(n.saturatedFat, 1)} g</td></tr><tr><td>Karbohydrater</td><td>${num(n.carbs, 1)} g</td></tr><tr><td>Sukkerarter</td><td>${num(n.sugars, 1)} g</td></tr><tr><td>Protein</td><td>${num(n.protein, 1)} g</td></tr><tr><td>Salt</td><td>${num(n.salt, 2)} g</td></tr></tbody></table><p class="muted">Brødrene Berbusmel</p></body></html>`);

  w.document.close();
  w.focus();
}

  function lineOptions(itemType: ProductLine["itemType"], query: string) {
    const q = query.toLowerCase();

    const source = itemType === "material"
      ? data.materials.map((x) => ({ id: x.id, name: x.name, subtitle: `${x.category} · ${currency(x.pricePerUnit)}/${x.unit}` }))
      : itemType === "recipe"
        ? data.recipes.map((x) => ({ id: x.id, name: x.name, subtitle: `${x.category} · ${num(x.yieldAmount)} ${x.yieldUnit}` }))
        : data.products
            .filter((x) => x.id !== selected?.id)
            .map((x) => ({ id: x.id, name: x.name, subtitle: `${x.category} · ${currency(productUnitCost(x))}/${x.yieldUnit}` }));

    return source
      .filter((x) => !q || `${x.name} ${x.subtitle}`.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, "no-NO"))
      .slice(0, 12);
  }

  function printProduct(product: Product) {
    const rows = product.lines.map((l) => `<tr><td>${l.itemType}</td><td>${escapeHtml(lineItemName(l.itemType, l.itemId) || "Ukjent")}</td><td>${num(l.amount, 3)} ${l.unit}</td><td>${currency(lineCost(l))}</td></tr>`).join("");
    const allergens = productAllergens(product).join(", ") || "Ingen registrert";
    const priceExVat = exVatFromIncVat(product.customerPrice, data.settings.foodVat);
    const w = window.open("", "_blank");
    if (!w) return;

    w.document.write(`<!doctype html><html><head><meta charset="utf-8" /><title>${escapeHtml(product.name)}</title><style>body{font-family:Arial,sans-serif;color:#111827;padding:36px;line-height:1.4}.top{border-bottom:3px solid #111827;padding-bottom:18px;margin-bottom:24px}.logo-img{height:120px;width:auto;object-fit:contain}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:18px 0}.metric{background:#f1f5f9;border-radius:12px;padding:12px}.metric b{display:block;font-size:20px;margin-top:4px}table{width:100%;border-collapse:collapse;margin-top:16px;margin-bottom:24px}th,td{border-bottom:1px solid #e5e7eb;padding:9px;text-align:left}th{background:#f3f4f6}@media print{button{display:none}body{padding:18px}}</style></head><body><button onclick="window.print()">Print</button><div class="top"><img src="/logo.png" class="logo-img" /><h1>${escapeHtml(product.name)}</h1><p>${escapeHtml(product.type)} · ${escapeHtml(product.category)}</p></div><div class="metrics"><div class="metric">Total kost eks. mva<b>${currency(productCost(product))}</b></div><div class="metric">Kost per ${product.yieldUnit}<b>${currency(productUnitCost(product))}</b></div><div class="metric">Kundepris inkl. mva<b>${currency(product.customerPrice)}</b></div><div class="metric">Varekost / margin<b>${num(foodCostPercentFrom(priceExVat, productUnitCost(product)), 1)}% / ${num(marginPercentFrom(priceExVat, productUnitCost(product)), 1)}%</b></div></div><p><b>Allergener:</b> ${escapeHtml(allergens)}</p><h2>Innhold</h2><table><thead><tr><th>Type</th><th>Navn</th><th>Mengde</th><th>Kost</th></tr></thead><tbody>${rows}</tbody></table></body></html>`);
    w.document.close();
    w.focus();
  }

  function toggleListProduct(productId: string) {
    setListSelectedIds((prev) => prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]);
  }

  function createProductList() {
    if (!listSelectedIds.length) return alert("Velg minst ett produkt til listen.");

    const next: ProductList = {
      id: `product-list-${Date.now()}`,
      name: listName.trim() || "Produktliste",
      kind: listMode,
      introText: listIntroText,
      productIds: listSelectedIds,
      createdAt: new Date().toISOString(),
    };

    updateData({ productLists: [next, ...(data.productLists || [])] });
  }

  function printProductList(list: ProductList) {
    const products = list.productIds.map((id) => data.products.find((p) => p.id === id)).filter(Boolean) as Product[];
    const logo = `<img src="/logo.png" style="height:120px;width:auto;object-fit:contain;margin-bottom:10px;" />`;
    const title = escapeHtml(list.name);
    const intro = list.introText ? `<p class="intro">${escapeHtml(list.introText).replace(/\n/g, "<br>")}</p>` : "";

    let content = "";

    if (list.kind === "catering") {
      content = products.map((p) => {
        const elements = p.lines.map((line) => lineItemName(line.itemType, line.itemId)).filter(Boolean);
        const allergens = productAllergens(p).join(", ") || "-";
        return `<section class="catering-menu"><h2>${escapeHtml(p.name)}</h2>${elements.map((element) => `<p class="menu-line">${escapeHtml(element)}</p>`).join("")}<p class="allergens">A: ${escapeHtml(allergens)}</p><p class="price">Kr ${num(p.customerPrice, 0)},- pr pers</p></section>`;
      }).join("");
    } else if (list.kind === "storkjokken") {
      content = `<table><thead><tr><th>Produkt</th><th>Vekt/str</th><th>Pris eks. mva</th><th>Pris inkl. 15%</th><th>Pris inkl. 25%</th></tr></thead><tbody>${products.map((p) => {
        const exVat = p.storkjokkenPriceExVat || exVatFromIncVat(p.customerPrice, 15);
        return `<tr><td><b>${escapeHtml(p.name)}</b><br><small>A: ${escapeHtml(productAllergens(p).join(", ") || "-")}</small></td><td>${escapeHtml(`${p.yieldAmount} ${p.yieldUnit}`)}</td><td>${currency(exVat)}</td><td>${currency(exVat * 1.15)}</td><td>${currency(exVat * 1.25)}</td></tr>`;
      }).join("")}</tbody></table>`;
    } else {
      content = `<table><thead><tr><th>Produkt</th><th>Kategori</th><th>Vekt/str</th><th>Pris</th></tr></thead><tbody>${products.map((p) => `<tr><td><b>${escapeHtml(p.name)}</b><br><small>A: ${escapeHtml(productAllergens(p).join(", ") || "-")}</small></td><td>${escapeHtml(p.category)}</td><td>${escapeHtml(`${p.yieldAmount} ${p.yieldUnit}`)}</td><td>${currency(p.customerPrice)}</td></tr>`).join("")}</tbody></table>`;
    }

    const w = window.open("", "_blank");
    if (!w) return;

    w.document.write(`<!doctype html><html><head><meta charset="utf-8" /><title>${title}</title><style>@page{size:A4;margin:14mm}body{font-family:Arial,sans-serif;color:#111827;line-height:1.35}.top{text-align:center;border-bottom:2px solid #111827;padding-bottom:12px;margin-bottom:16px}h1{font-size:25px;margin:4px 0 6px}.intro{font-size:13px;color:#334155;margin:8px auto 0;max-width:680px}table{width:100%;border-collapse:collapse;font-size:11px}th{background:#111827;color:white;text-align:left;padding:7px}td{border-bottom:1px solid #e5e7eb;padding:7px;vertical-align:top}small,.allergens{color:#64748b}.catering-menu{max-width:560px;margin:0 auto 18px;break-inside:avoid}.catering-menu h2{text-align:center;font-size:26px;margin:16px 0 12px}.menu-line{font-size:15px;margin:0 0 8px;text-align:left}.allergens{font-size:13px;margin:3px 0 12px}.price{text-align:center;font-size:18px;font-weight:900;margin-top:16px}.footer{position:fixed;bottom:0;left:0;right:0;text-align:center;font-size:10px;color:#64748b}@media print{button{display:none}}</style></head><body><button onclick="window.print()">Print</button><div class="top">${logo}<h1>${title}</h1>${intro}</div>${content}<div class="footer">Brødrene Berbusmel | tlf 413 73 000 | brodrene@berbusmel.no</div></body></html>`);
    w.document.close();
    w.focus();
  }

  const activeCost = activeProduct ? productCost(activeProduct) : 0;
  const activeUnitCost = activeProduct ? productUnitCost(activeProduct) : 0;
  const priceExVat = activeProduct ? exVatFromIncVat(activeProduct.customerPrice, data.settings.foodVat) : 0;
  const finalFoodCost = activeProduct ? foodCostPercentFrom(priceExVat, activeUnitCost) : 0;
  const finalMargin = activeProduct ? marginPercentFrom(priceExVat, activeUnitCost) : 0;

  if (mode !== "view") {
    return (
      <section className="card product-editor-page">
        <div className="between">
          <h1>{mode === "edit" ? "Rediger produkt" : "Nytt produkt"}</h1>
          <div>
            <button className="btn active" onClick={saveProduct}>{mode === "edit" ? "Lagre endringer" : "Lagre produkt"}</button>
            <button className="btn" onClick={() => setMode("view")}>Avbryt</button>
          </div>
        </div>

        <div className="form-grid four">
          <label>Produktnr<input value={form.productNumber} onChange={(e) => setForm({ ...form, productNumber: e.target.value })} placeholder="Produktnr" /></label>
          <label>Navn<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Produktnavn" /></label>
          <label>Type<select value={form.type} onChange={(e) => blankFor(e.target.value as ProductType)}><option value="grunnoppskrift">Grunnoppskrift</option><option value="bakst">Bakst</option><option value="cateringmeny">Cateringmeny</option><option value="pasmuurt">Påsmurt</option><option value="egenprodusert">Egenprodusert</option></select></label>
          <label>Kategori<select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{data.productCategories.map((c) => <option key={c}>{c}</option>)}</select></label>
          <label>Gir<input type="number" value={form.yieldAmount} onChange={(e) => setForm({ ...form, yieldAmount: e.target.value })} /></label>
          <label>Enhet<select value={form.yieldUnit} onChange={(e) => setForm({ ...form, yieldUnit: e.target.value as YieldUnit })}><option value="stk">stk</option><option value="porsjoner">porsjoner</option><option value="kg">kg</option><option value="liter">liter</option></select></label>
          {form.type === "pasmuurt" && <label>Deles på antall porsjoner<input type="number" value={form.portionsPerWhole} onChange={(e) => setForm({ ...form, portionsPerWhole: e.target.value })} placeholder="f.eks. 12" /></label>}
          <label>Valgt kundepris inkl. mva<input type="number" value={form.customerPrice} onChange={(e) => setForm({ ...form, customerPrice: e.target.value })} /></label>
          <label>Storkjøkkenpris eks. mva<input type="number" value={form.storkjokkenPriceExVat} onChange={(e) => setForm({ ...form, storkjokkenPriceExVat: e.target.value })} placeholder="Valgfritt" /></label>
          <label>Målmargin %<input type="number" value={form.targetMargin} onChange={(e) => setForm({ ...form, targetMargin: e.target.value })} /></label>
        </div>

        <div className="metric-row">
          <Metric label="Total kost eks. mva" value={currency(activeCost)} />
          <Metric label={`Kost per ${form.yieldUnit}`} value={currency(activeUnitCost)} dark />
          <Metric label="Anbefalt 70% inkl. 15% mva" value={currency(priceIncVatFromCost(activeUnitCost, 70, 15))} />
          <Metric label="Anbefalt 70% inkl. 25% mva" value={currency(priceIncVatFromCost(activeUnitCost, 70, 25))} />
        </div>

        <div className="metric-row">
          <Metric label="Endelig margin" value={`${num(finalMargin, 1)} %`} tone={marginTone(finalMargin)} />
          <Metric label="Endelig varekost" value={`${num(finalFoodCost, 1)} %`} />
          <Metric label="Storkjøkkenpris eks. mva" value={form.storkjokkenPriceExVat ? currency(Number(form.storkjokkenPriceExVat)) : "Ikke satt"} />
          <Metric label="Storkjøkken inkl. 15%" value={form.storkjokkenPriceExVat ? currency(Number(form.storkjokkenPriceExVat) * 1.15) : "-"} />
        </div>

        <div className="soft-box">
          <h2>Ingredienser / innhold</h2>
          <div className="form-grid five">
            <select value={line.itemType} onChange={(e) => { setLine({ ...line, itemType: e.target.value as ProductLine["itemType"], itemId: "" }); setLineSearch(""); }}>
              <option value="material">Råvare</option>
              <option value="recipe">Grunnoppskrift</option>
              <option value="product">Produkt</option>
            </select>

            <div className="search-picker">
              <input value={lineSearch || lineItemName(line.itemType, line.itemId)} onChange={(e) => { setLineSearch(e.target.value); setLine({ ...line, itemId: "" }); }} placeholder="Søk og velg" />
              {lineSearch && (
                <div className="search-dropdown inline">
                  {lineOptions(line.itemType, lineSearch).map((item) => (
                    <button key={item.id} type="button" className="search-result" onClick={() => { setLine({ ...line, itemId: item.id }); setLineSearch(item.name); }}>
                      <b>{item.name}</b>
                      <small>{item.subtitle}</small>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <input type="number" value={line.amount} onChange={(e) => setLine({ ...line, amount: e.target.value })} placeholder="Mengde" />
            <select value={line.unit} onChange={(e) => setLine({ ...line, unit: e.target.value as ProductLine["unit"] })}>
              <option value="kg">kg</option>
              <option value="liter">liter</option>
              <option value="stk">stk</option>
              <option value="porsjoner">porsjoner</option>
            </select>
            <button className="btn" onClick={addLine}>Legg til</button>
          </div>

          <table>
            <thead><tr><th>Type</th><th>Navn</th><th>Mengde</th><th>Enhet</th><th>Kost</th><th></th></tr></thead>
            <tbody>
              {draftLines.map((l, i) => (
                <tr key={i}>
                  <td>
                    <select value={l.itemType} onChange={(e) => updateDraftLine(i, { itemType: e.target.value as ProductLine["itemType"], itemId: "" })}>
                      <option value="material">Råvare</option>
                      <option value="recipe">Grunnoppskrift</option>
                      <option value="product">Produkt</option>
                    </select>
                  </td>
                  <td><input value={lineItemName(l.itemType, l.itemId)} readOnly /><small style={{ color: "#64748b" }}>Endre ved å slette/legge inn ny linje</small></td>
                  <td><input type="number" value={l.amount} onChange={(e) => updateDraftLine(i, { amount: Number(e.target.value) || 0 })} /></td>
                  <td><select value={l.unit} onChange={(e) => updateDraftLine(i, { unit: e.target.value as ProductLine["unit"] })}><option value="kg">kg</option><option value="liter">liter</option><option value="stk">stk</option><option value="porsjoner">porsjoner</option></select></td>
                  <td>{currency(lineCost(l))}</td>
                  <td><button className="link danger" onClick={() => setDraftLines((prev) => prev.filter((_, ix) => ix !== i))}>Slett</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {form.type === "egenprodusert" && (
          <div className="soft-box">
            <h2>Emballasje</h2>
            <div className="form-grid three">
              <select value={packLine.packagingId} onChange={(e) => setPackLine({ ...packLine, packagingId: e.target.value })}>
                <option value="">Velg emballasje</option>
                {data.packaging.map((p) => <option key={p.id} value={p.id}>{p.name} · {currency(p.price)}</option>)}
              </select>
              <input type="number" value={packLine.quantity} onChange={(e) => setPackLine({ ...packLine, quantity: e.target.value })} placeholder="Antall" />
              <button className="btn" onClick={addPackaging}>Legg til</button>
            </div>

            <table>
              <tbody>
                {draftPackaging.map((p, i) => {
                  const pack = data.packaging.find((x) => x.id === p.packagingId);
                  return (
                    <tr key={i}>
                      <td><select value={p.packagingId} onChange={(e) => updateDraftPackaging(i, { packagingId: e.target.value })}>{data.packaging.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></td>
                      <td><input type="number" value={p.quantity} onChange={(e) => updateDraftPackaging(i, { quantity: Number(e.target.value) || 0 })} /></td>
                      <td>{currency((pack?.price || 0) * p.quantity)}</td>
                      <td><button className="link danger" onClick={() => setDraftPackaging((prev) => prev.filter((_, ix) => ix !== i))}>Slett</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    );
  }

  return (
  <section>
    <div className="card">
      <div className="between">
        <h2>Produkter</h2>

        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={() => setShowProductListEditor(true)}>
            Lag produktliste
          </button>

          <button className="btn active" onClick={startNewProduct}>
            Nytt produkt
          </button>
        </div>
      </div>

      <input
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setProductPage(1);
        }}
        placeholder="Søk produkt"
      />

      <div className="chips">
        {["Alle", ...data.productCategories]
          .filter((v, i, arr) => arr.indexOf(v) === i)
          .map((cat) => (
            <button
              key={cat}
              className={categoryFilter === cat ? "btn active" : "btn"}
              onClick={() => {
                setCategoryFilter(cat);
                setProductPage(1);
              }}
            >
              {cat}
            </button>
          ))}
      </div>

      <p style={{ color: "#64748b" }}>
        Viser {pagedProducts.length} av {filtered.length} produkter. Side {productPage} av {totalProductPages}.
      </p>

      <table>
        <thead>
          <tr>
            <th>Produktnr</th>
            <th>Produkt</th>
            <th>Type</th>
            <th>Kategori</th>
            <th>Kost/enhet</th>
            <th>Kundepris</th>
            <th>Storkjøkken eks. mva</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {pagedProducts.map((p) => (
            <tr key={p.id}>
              <td>{p.productNumber || "-"}</td>
              <td>
                <b>{p.name}</b>
                <br />
                <small>{p.yieldAmount} {p.yieldUnit}</small>
              </td>
              <td>{p.type}</td>
              <td>{p.category}</td>
              <td>{currency(productUnitCost(p))}</td>
              <td>{currency(p.customerPrice)}</td>
              <td>{p.storkjokkenPriceExVat ? currency(p.storkjokkenPriceExVat) : "-"}</td>
              <td>
                <button className="btn" onClick={() => { setSelectedId(p.id); setWideProductId(p.id); }}>
  Se oppskrift
</button>
<button className="btn" onClick={() => printNutritionLabel(p)}>
  Næring
</button>
<button className="btn" onClick={() => printProductLabel(p)}>
  Print label
</button>
<button className="btn" onClick={() => editProduct(p)}>
  Rediger
</button>
<button className="btn" onClick={() => printProduct(p)}>
  Print
</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="pager">
        <button className="btn" disabled={productPage <= 1} onClick={() => setProductPage(productPage - 1)}>Forrige</button>
        <span>Side {productPage} av {totalProductPages}</span>
        <button className="btn" disabled={productPage >= totalProductPages} onClick={() => setProductPage(productPage + 1)}>Neste</button>
      </div>
    </div>

    {wideProduct && (
      <div className="card wide-product-view">
        <div className="between">
          <div>
            <h2>{wideProduct.name}</h2>
            <p>{wideProduct.type} · {wideProduct.category} · gir {num(wideProduct.yieldAmount)} {wideProduct.yieldUnit}</p>
          </div>
          <div>
            <button className="btn" onClick={() => editProduct(wideProduct)}>Rediger</button>
            <button className="btn" onClick={() => printProduct(wideProduct)}>Print</button>
            <button className="btn" onClick={() => setWideProductId(null)}>Lukk</button>
          </div>
        </div>

        <div className="metric-row">
          <Metric label="Total kost eks. mva" value={currency(productCost(wideProduct))} />
          <Metric label={`Kost per ${wideProduct.yieldUnit}`} value={currency(productUnitCost(wideProduct))} dark />
          <Metric label="Anbefalt 70% inkl. 15%" value={currency(priceIncVatFromCost(productUnitCost(wideProduct), 70, 15))} />
          <Metric label="Anbefalt 70% inkl. 25%" value={currency(priceIncVatFromCost(productUnitCost(wideProduct), 70, 25))} />
        </div>

        <div className="metric-row">
          <Metric label="Valgt pris inkl. mva" value={currency(wideProduct.customerPrice)} dark />
          <Metric label="Storkjøkken eks. mva" value={wideProduct.storkjokkenPriceExVat ? currency(wideProduct.storkjokkenPriceExVat) : "Ikke satt"} />
          <Metric label="Storkjøkken inkl. 15%" value={wideProduct.storkjokkenPriceExVat ? currency(wideProduct.storkjokkenPriceExVat * 1.15) : "-"} />
          <Metric label="Allergener" value={productAllergens(wideProduct).join(", ") || "Ingen"} />
        </div>

        <h3>Produktinnhold</h3>
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>Navn</th>
              <th>Mengde</th>
              <th>Enhet</th>
              <th>Kost</th>
            </tr>
          </thead>
          <tbody>
            {wideProduct.lines.map((l, i) => (
              <tr key={i}>
                <td>{l.itemType}</td>
                <td>{lineItemName(l.itemType, l.itemId)}</td>
                <td>{num(l.amount)}</td>
                <td>{l.unit}</td>
                <td>{currency(lineCost(l))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}

    <div className="card product-list-card">
      <h2>Produktlister / prislister</h2>

      {showProductListEditor && (
        <div className="soft-box">
          <div className="between">
            <h3>
              {listMode === "bakst" && "Produktliste: Bakst"}
              {listMode === "catering" && "Produktliste: Catering"}
              {listMode === "storkjokken" && "Produktliste: Storkjøkken"}
            </h3>
            <button className="btn" onClick={() => setShowProductListEditor(false)}>Lukk</button>
          </div>

          <div className="form-grid three">
            <label>
              Type liste
              <select
                value={listMode}
                onChange={(e) => {
                  const kind = e.target.value as ProductListKind;
                  setListMode(kind);
                  setListName(
                    kind === "bakst"
                      ? "Produktliste bakst"
                      : kind === "catering"
                        ? "Produktliste catering"
                        : "Produktliste storkjøkken"
                  );
                }}
              >
                <option value="bakst">Bakst</option>
                <option value="catering">Catering</option>
                <option value="storkjokken">Storkjøkken</option>
              </select>
            </label>

            <label>
              Navn på liste
              <input value={listName} onChange={(e) => setListName(e.target.value)} />
            </label>

            <button className="btn active" onClick={createProductList}>Lagre liste</button>
          </div>

          <button className="btn" onClick={() => setListSelectedIds(filtered.map((p) => p.id))}>
            Velg alle filtrerte produkter
          </button>

          <label>
            Fritekst under logo
            <textarea
              className="textarea"
              value={listIntroText}
              onChange={(e) => setListIntroText(e.target.value)}
              placeholder="F.eks. gyldig fra dato, bestillingsinfo osv."
            />
          </label>

          <div className="product-list-picker">
            {filtered.map((p) => (
              <label key={p.id} className="check product-list-check">
                <input
                  type="checkbox"
                  checked={listSelectedIds.includes(p.id)}
                  onChange={() => toggleListProduct(p.id)}
                />
                <span>
                  <b>{p.name}</b>
                  <br />
                  <small>
                    {p.category} · kundepris {currency(p.customerPrice)} · storkjøkken{" "}
                    {p.storkjokkenPriceExVat ? currency(p.storkjokkenPriceExVat) : "ikke satt"}
                  </small>
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      <h3>Lagrede produktlister</h3>

      {(data.productLists || []).length ? (
        (data.productLists || []).map((list) => (
          <div key={list.id} className="editable-row">
            <div>
              <b>{list.name}</b>
              <br />
              <small>{list.kind} · {list.productIds.length} produkter</small>
            </div>
            <div>
              <button className="btn" onClick={() => printProductList(list)}>Print</button>
              <button
                className="btn danger"
                onClick={() =>
                  updateData({
                    productLists: (data.productLists || []).filter((x) => x.id !== list.id),
                  })
                }
              >
                Slett
              </button>
            </div>
          </div>
        ))
      ) : (
        <p style={{ color: "#64748b" }}>Ingen produktlister laget ennå.</p>
      )}
    </div>
  </section>
);
}

function formatTimeInput(value: string) {
  const digits = value.replace(/[^0-9]/g, "");

  if (!digits) return "";
  if (digits.length <= 2) return `Kl ${digits.padStart(2, "0")}:00`;
  if (digits.length === 3) {
    return `Kl ${digits.slice(0, 1)}:${digits.slice(1).padEnd(2, "0")}`;
  }

  return `Kl ${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
}

function OrdersTab({ data, updateData, productAllergens }: { data: AppData; updateData: (p: Partial<AppData>) => void; productAllergens: (p: Product) => string[] }) {
  const emptyOrder = (): Order => ({
    id: "",
    type: "catering",
    customerType: "privat",
    customer: "",
    companyName: "",
    orgNumber: "",
    companyAddress: "",
    phone: "",
    deliveryAddress: "",
    date: today(),
    time: "",
    guests: 10,
    productId: data.products[0]?.id || "",
    orderLines: [],
    discountPercent: 0,
    isRecurring: false,
    recurringDays: [],
    recurringNote: "",
    allergens: Object.fromEntries(defaultAllergens.map((a) => [a, 0])),
    dietVegan: "0",
    dietVegetarian: "0",
    dietPregnant: "0",
    dietOther: "",
  });

  const [form, setForm] = useState<Order>(emptyOrder);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [lineToAdd, setLineToAdd] = useState({ productId: "", quantity: 1 });
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [orderPage, setOrderPage] = useState(1);
  const pageSize = 20;

  function addOrderLine() {
    setForm({ ...form, orderLines: [...form.orderLines, { productId: data.products[0]?.id || "", quantity: form.guests || 1 }] });
  }

  function updateOrderLine(index: number, partial: Partial<OrderLine>) {
    setForm({ ...form, orderLines: form.orderLines.map((l, i) => i === index ? { ...l, ...partial } : l) });
  }

  function removeOrderLine(index: number) {
    setForm({ ...form, orderLines: form.orderLines.filter((_, i) => i !== index) });
  }

  function saveOrder() {
    const cleanLines = form.orderLines.filter((l) => l.productId && Number(l.quantity) > 0);
    if (!form.customer.trim() && form.customerType === "privat") return alert("Legg inn kundenavn.");
    if (!form.companyName?.trim() && form.customerType === "bedrift") return alert("Legg inn bedriftsnavn.");
    if (!cleanLines.length) return alert("Legg inn minst ett produkt/meny i ordren.");

    const savedOrder = { ...form, id: editingOrderId || `order-${Date.now()}`, orderLines: cleanLines };

    updateData({
      orders: editingOrderId
        ? data.orders.map((o) => (o.id === editingOrderId ? savedOrder : o))
        : [savedOrder, ...data.orders],
    });

    setForm(emptyOrder());
    setEditingOrderId(null);
    setShowNewOrder(false);
  }

  function editOrder(order: Order) {
    setForm({ ...emptyOrder(), ...order });
    setEditingOrderId(order.id);
    setShowNewOrder(true);
    setLineToAdd({ productId: "", quantity: order.guests || 1 });
  }

  function selectedAllergens(order: Order) {
    return Object.entries(order.allergens || {})
      .filter(([, count]) => Number(count) > 0)
      .map(([name, count]) => `${name}: ${count}`);
  }

  function orderSubtotalIncVat(order: Order) {
    return order.orderLines.reduce((sum, line) => {
      const product = data.products.find((p) => p.id === line.productId);
      return sum + (product?.customerPrice || 0) * Number(line.quantity || 0);
    }, 0);
  }

  function orderDiscountAmount(order: Order) {
    return orderSubtotalIncVat(order) * ((Number(order.discountPercent) || 0) / 100);
  }

  function orderTotalIncVat(order: Order) {
    return orderSubtotalIncVat(order) - orderDiscountAmount(order);
  }

  function printOrder(order: Order) {
    const rows = order.orderLines.map((line) => {
      const product = data.products.find((p) => p.id === line.productId);
      const lineTotal = (product?.customerPrice || 0) * line.quantity;
      return `<tr><td>${line.quantity}</td><td>${product?.name || "Ukjent"}</td><td>${currency(product?.customerPrice || 0)}</td><td>${currency(lineTotal)}</td></tr>`;
    }).join("");

    const prodRows = order.orderLines.map((line) => {
      const product = data.products.find((p) => p.id === line.productId);
      if (!product) return "";
      const rowsForProduct = expandProductForProduction(product, Number(line.quantity) || 0)
        .map((r) => `<tr><td>${r.name}</td><td>${num(r.amount)} ${r.unit}</td></tr>`)
        .join("");
      return `<tr><td colspan="2" style="background:#111827;color:white;font-weight:800;">${line.quantity} × ${product.name}</td></tr>${rowsForProduct}`;
    }).join("");
    const subtotalInc = orderSubtotalIncVat(order);
    const discountAmount = orderDiscountAmount(order);
    const totalInc = orderTotalIncVat(order);
    const totalEx = exVatFromIncVat(totalInc, data.settings.foodVat);
    const allergens = selectedAllergens(order).join(", ") || "Ingen registrert";
    const diets = `Vegetar: ${order.dietVegetarian || 0}, Vegan: ${order.dietVegan || 0}, Gravid: ${order.dietPregnant || 0}${order.dietOther ? `, Annet: ${order.dietOther}` : ""}`;
    const customerName = order.customerType === "bedrift" ? `${order.companyName || ""}${order.orgNumber ? ` (${order.orgNumber})` : ""}` : order.customer;

    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8" /><title>Ordre ${order.date}</title><style>body{font-family:Arial,sans-serif;color:#111827;padding:36px;line-height:1.4}.top{display:flex;justify-content:space-between;border-bottom:3px solid #111827;padding-bottom:18px;margin-bottom:24px}.logo{font-size:26px;font-weight:900}.muted{color:#64748b}.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.box{border:1px solid #e5e7eb;border-radius:14px;padding:14px;margin-bottom:16px}table{width:100%;border-collapse:collapse;margin-top:8px}th,td{border-bottom:1px solid #e5e7eb;padding:8px;text-align:left}th{background:#f3f4f6}.right{text-align:right}.total{font-size:20px;font-weight:900}.warn{background:#fef3c7;border:1px solid #f59e0b;border-radius:12px;padding:12px;margin:12px 0}@media print{button{display:none}body{padding:18px}}</style></head><body><button onclick="window.print()">Print</button><div class="top"><div><div class="logo">KJØKKENORDRE</div><div class="muted">${today()}</div></div><div class="right"><h1>${formatDateNo(order.date)} ${order.time || ""}</h1><p>${order.type}</p></div></div><div class="grid"><div class="box"><h2>Kunde</h2><p><b>${customerName || "Ikke angitt"}</b></p><p>Kontakt: ${order.customer || "-"}</p><p>Telefon: ${order.phone || "-"}</p><p>Levering: ${order.deliveryAddress || "-"}</p></div><div class="box"><h2>Hensyn</h2><p><b>Dietter:</b> ${diets}</p><p><b>Allergier:</b> ${allergens}</p></div></div><h2>Ordrelinjer</h2><table><thead><tr><th>Antall</th><th>Produkt/meny</th><th>Pris inkl. mva</th><th>Sum</th></tr></thead><tbody>${rows}</tbody></table><div class="box"><p>Sum før rabatt: ${currency(subtotalInc)}</p><p>Rabatt ${order.discountPercent || 0}%: -${currency(discountAmount)}</p><p class="total">Total inkl. mva: ${currency(totalInc)}</p><p>Total eks. mva: ${currency(totalEx)}</p></div><h2>Produksjonsgrunnlag</h2><table><thead><tr><th>Element</th><th>Mengde</th></tr></thead><tbody>${prodRows}</tbody></table></body></html>`);
    w.document.close();
    w.focus();
  }

  function productName(id: string) {
    return data.products.find((p) => p.id === id)?.name || "Ukjent produkt";
  }

  function orderAllergenWarnings(order: Order) {
    const orderAllergens = new Set(order.orderLines.flatMap((l) => {
      const p = data.products.find((x) => x.id === l.productId);
      return p ? productAllergens(p) : [];
    }));

    return Object.entries(order.allergens || {})
      .filter(([allergen, count]) => Number(count) > 0 && orderAllergens.has(allergen))
      .map(([allergen]) => allergen);
  }

  function expandProductForProduction(product: Product, multiplier: number, path: string[] = []): { name: string; amount: number; unit: string; source: string }[] {
    if (path.includes(product.id)) return [];

    if (!product.lines.length) {
      return [{ name: product.name, amount: multiplier, unit: product.yieldUnit, source: product.name }];
    }

    return product.lines.flatMap((line) => {
      const amount = line.amount * multiplier;
      if (line.itemType === "material") {
        const m = data.materials.find((x) => x.id === line.itemId);
        return [{ name: m?.name || "Ukjent råvare", amount, unit: line.unit, source: product.name }];
      }
      if (line.itemType === "recipe") {
        const r = data.recipes.find((x) => x.id === line.itemId);
        return [{ name: r?.name || "Ukjent grunnoppskrift", amount, unit: line.unit, source: product.name }];
      }
      const p = data.products.find((x) => x.id === line.itemId);
      return p ? expandProductForProduction(p, amount, [...path, product.id]) : [];
    });
  }

  function productionRowsForOrder(order: Order) {
    return order.orderLines.flatMap((line) => {
      const product = data.products.find((p) => p.id === line.productId);
      return product ? expandProductForProduction(product, Number(line.quantity) || 0) : [];
    });
  }

  const sortedOrders = [...data.orders].sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  const now = new Date(today());
  const threeDaysAgo = new Date(now);
  threeDaysAgo.setDate(now.getDate() - 3);

  const visibleOrders = sortedOrders.filter((o) => new Date(o.date) >= threeDaysAgo);
  const totalPages = Math.max(1, Math.ceil(visibleOrders.length / pageSize));
  const pagedOrders = visibleOrders.slice((orderPage - 1) * pageSize, orderPage * pageSize);

  return (
    <section className="card">
      <div className="between">
        <h2>Ordre</h2>
        <button className="btn active" onClick={() => setShowNewOrder(!showNewOrder)}>{showNewOrder ? "Skjul ny ordre" : "Ny ordre"}</button>
      </div>

      {showNewOrder && (
        <div className="soft-box full-width">
          <h3>{editingOrderId ? "Rediger ordre" : "Ny ordre"}</h3>
          <div className="form-grid four">
            <label>Ordretype<select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Order["type"], customerType: e.target.value === "storkjokken" ? "storkjokken" : form.customerType })}><option value="catering">Catering</option><option value="bakeri">Bakeri</option><option value="pasmuurt">Påsmurt</option><option value="egenprodusert">Egenprodusert</option><option value="storkjokken">Storkjøkken</option></select></label>
            <label>Kundetype<select value={form.customerType} onChange={(e) => setForm({ ...form, customerType: e.target.value as Order["customerType"] })}><option value="privat">Privat</option><option value="bedrift">Bedrift</option><option value="storkjokken">Storkjøkken</option></select></label>
            <label>Dato<input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
            <label>Tid<input value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} onBlur={(e) => setForm({ ...form, time: formatTimeInput(e.target.value) })} placeholder="f.eks. 1015" /></label>
          </div>

          {form.customerType === "bedrift" || form.customerType === "storkjokken" ? (
            <div className="form-grid four">
              <label>Bedriftsnavn<input value={form.companyName || ""} onChange={(e) => setForm({ ...form, companyName: e.target.value })} placeholder="Bedrift" /></label>
              <label>Orgnr<input value={form.orgNumber || ""} onChange={(e) => setForm({ ...form, orgNumber: e.target.value })} placeholder="Org.nr" /></label>
              <label>Bedriftsadresse<input value={form.companyAddress || ""} onChange={(e) => setForm({ ...form, companyAddress: e.target.value })} placeholder="Adresse" /></label>
              <label>Kontaktperson<input value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })} placeholder="Kontaktperson" /></label>
            </div>
          ) : (
            <div className="form-grid four">
              <label>Kundenavn<input value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })} placeholder="Kunde" /></label>
            </div>
          )}

          <div className="form-grid four">
            <label>Telefon<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Telefonnummer" /></label>
            <label>Leveringsadresse<input value={form.deliveryAddress} onChange={(e) => setForm({ ...form, deliveryAddress: e.target.value })} placeholder="Leveringsadresse" /></label>
            <label>Antall gjester / porsjoner<input type="number" value={form.guests} onChange={(e) => setForm({ ...form, guests: Number(e.target.value) || 0 })} /></label>
            <label>Rabatt %<input type="number" value={form.discountPercent || 0} onChange={(e) => setForm({ ...form, discountPercent: Number(e.target.value) || 0 })} /></label>
          </div>

          {form.type === "storkjokken" && <div className="soft-box"><h3>Fast ordre / gjentagelse</h3><label className="check"><input type="checkbox" checked={!!form.isRecurring} onChange={(e) => setForm({ ...form, isRecurring: e.target.checked })} /> Dette er en fast/gjentagende ordre</label>{form.isRecurring && <><div className="chips">{["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"].map((day) => { const active = (form.recurringDays || []).includes(day); return <button key={day} type="button" className={active ? "btn active" : "btn"} onClick={() => setForm({ ...form, recurringDays: active ? (form.recurringDays || []).filter((d) => d !== day) : [...(form.recurringDays || []), day] })}>{day}</button>; })}</div><input value={form.recurringNote || ""} onChange={(e) => setForm({ ...form, recurringNote: e.target.value })} placeholder="Notat, f.eks. gjelder skoleåret / pauser i ferier" /></>}</div>}

          <h3>Legg til produkt / meny</h3>
          <div className="form-grid three">
            <select value={lineToAdd.productId} onChange={(e) => setLineToAdd({ ...lineToAdd, productId: e.target.value })}>
              <option value="">Velg produkt</option>
              {data.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input type="number" value={lineToAdd.quantity} onChange={(e) => setLineToAdd({ ...lineToAdd, quantity: Number(e.target.value) })} placeholder="Antall" />
            <button className="btn" onClick={() => {
              if (!lineToAdd.productId) return;
              setForm({ ...form, orderLines: [...form.orderLines, lineToAdd] });
              setLineToAdd({ productId: "", quantity: form.guests || 1 });
            }}>Legg til</button>
          </div>

          <h3>Produkter i ordre</h3>
          {form.orderLines.map((line, i) => {
            const product = data.products.find((p) => p.id === line.productId);
            return (
              <div key={i} className="pill">
                {line.quantity} × {product?.name}
                <button style={{ marginLeft: 8 }} className="link danger" onClick={() => removeOrderLine(i)}>✕</button>
              </div>
            );
          })}

          <h3>Dietter / hensyn</h3>
          <div className="form-grid four">
            <label>Vegetar<input type="number" value={form.dietVegetarian || "0"} onChange={(e) => setForm({ ...form, dietVegetarian: e.target.value })} /></label>
            <label>Vegan<input type="number" value={form.dietVegan || "0"} onChange={(e) => setForm({ ...form, dietVegan: e.target.value })} /></label>
            <label>Gravid<input type="number" value={form.dietPregnant || "0"} onChange={(e) => setForm({ ...form, dietPregnant: e.target.value })} /></label>
            <label>Andre hensyn<input value={form.dietOther || ""} onChange={(e) => setForm({ ...form, dietOther: e.target.value })} placeholder="Fritekst" /></label>
          </div>

          <h3>Allergier i ordren</h3>
          <div className="chips">
            {defaultAllergens.map((a) => {
              const active = (form.allergens[a] || 0) > 0;
              return (
                <div key={a}>
                  <button type="button" className={active ? "btn active" : "btn"} onClick={() => {
                    setForm({ ...form, allergens: { ...form.allergens, [a]: active ? 0 : 1 } });
                  }}>{a}</button>
                  {active && (
                    <input style={{ marginTop: 4, width: 60 }} type="number" value={form.allergens[a]} onChange={(e) => setForm({ ...form, allergens: { ...form.allergens, [a]: Number(e.target.value) } })} />
                  )}
                </div>
              );
            })}
          </div>
          {orderAllergenWarnings(form).length > 0 && <div className="warning"><b>Varsel:</b> Ordren inneholder produkter med {orderAllergenWarnings(form).join(", ")}.</div>}

          <h3>Ordresum</h3>
          <div className="metric-row">
            <Metric label="Sum før rabatt" value={currency(orderSubtotalIncVat(form))} />
            <Metric label={`Rabatt ${form.discountPercent || 0}%`} value={`-${currency(orderDiscountAmount(form))}`} />
            <Metric label="Sum inkl. mva" value={currency(orderTotalIncVat(form))} dark />
            <Metric label="Sum eks. mva" value={currency(exVatFromIncVat(orderTotalIncVat(form), data.settings.foodVat))} />
          </div>

          <button className="btn" onClick={() => printOrder({ ...form, id: editingOrderId || "preview" })}>Print ordre</button>

          <h3>Produksjonsgrunnlag for denne ordren</h3>
          <table>
            <thead><tr><th>Fra produkt</th><th>Element</th><th>Mengde</th></tr></thead>
            <tbody>{productionRowsForOrder(form).map((r, i) => <tr key={i}><td>{r.source}</td><td>{r.name}</td><td>{num(r.amount)} {r.unit}</td></tr>)}</tbody>
          </table>

          <button className="btn active" onClick={saveOrder}>{editingOrderId ? "Lagre endringer" : "Lagre ordre"}</button>{editingOrderId && <button className="btn" onClick={() => { setForm(emptyOrder()); setEditingOrderId(null); setShowNewOrder(false); }}>Avbryt redigering</button>}
        </div>
      )}

      <div className="card">
        <h2>Ordrearkiv</h2>
        <p style={{ color: "#64748b" }}>Viser ordre fra siste tre dager og fremover, sortert etter dato.</p>
        {pagedOrders.map((o) => {
          const warnings = orderAllergenWarnings(o);
          return (
            <div key={o.id} className="list order-card">
              <div className="between">
                <div>
                  <b>{formatDateNo(o.date)} {o.time} · {o.customerType === "bedrift" ? o.companyName : o.customer}</b><br />
                  <small>{o.type} · {o.guests} pers · {o.phone || "telefon mangler"} · {o.deliveryAddress || "adresse mangler"}</small>
                </div>
                <div><button className="link" onClick={() => editOrder(o)}>Rediger</button><button className="link" onClick={() => printOrder(o)}>Print</button><button className="link danger" onClick={() => { if (confirm("Slette ordren?")) updateData({ orders: data.orders.filter((x) => x.id !== o.id) }); }}>Slett</button></div>
              </div>
              <div style={{ marginTop: 8 }}>
                {o.orderLines.map((l, i) => <span key={i} className="pill">{l.quantity} × {productName(l.productId)}</span>)}
              </div>
              {(o.dietVegetarian !== "0" || o.dietVegan !== "0" || o.dietPregnant !== "0" || o.dietOther) && <p><b>Dietter:</b> vegetar {o.dietVegetarian || 0}, vegan {o.dietVegan || 0}, gravid {o.dietPregnant || 0}{o.dietOther ? ` · ${o.dietOther}` : ""}</p>}
              {selectedAllergens(o).length > 0 && <p><b>Allergier:</b> {selectedAllergens(o).join(", ")}</p>}
              {warnings.length > 0 && <div className="warning"><b>Allergivarsel:</b> {warnings.join(", ")}</div>}
              <details>
                <summary>Produksjonsgrunnlag</summary>
                <table><tbody>{productionRowsForOrder(o).map((r, i) => <tr key={i}><td>{r.source}</td><td>{r.name}</td><td>{num(r.amount)} {r.unit}</td></tr>)}</tbody></table>
              </details>
            </div>
          );
        })}
        <div className="pager"><button className="btn" disabled={orderPage <= 1} onClick={() => setOrderPage(orderPage - 1)}>Forrige</button><span>Side {orderPage} av {totalPages}</span><button className="btn" disabled={orderPage >= totalPages} onClick={() => setOrderPage(orderPage + 1)}>Neste</button></div>
      </div>
    </section>
  );
}

function ProductionTab({ data }: { data: AppData }) {
  const [dateFrom, setDateFrom] = useState(today());
  const [dateTo, setDateTo] = useState(today());
  const [showMaterials, setShowMaterials] = useState(true);

  const ordersInPeriod = data.orders
    .filter((o) => o.date >= dateFrom && o.date <= dateTo)
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));

  type MaterialOrderRow = { name: string; category: string; supplier: string; amount: number; unit: string };

  function addAmount(map: Record<string, MaterialOrderRow>, key: string, name: string, category: string, supplier: string, amount: number, unit: string) {
    const mapKey = `${key}-${unit}`;
    if (!map[mapKey]) map[mapKey] = { name, category, supplier, amount: 0, unit };
    map[mapKey].amount += amount;
  }

  function expandProductToMaterials(product: Product, multiplier: number, map: Record<string, MaterialOrderRow>, path: string[] = []) {
    if (path.includes(product.id)) return;
    product.lines.forEach((line) => {
      const amount = line.amount * multiplier;
      if (line.itemType === "material") {
        const material = data.materials.find((m) => m.id === line.itemId);
        if (material) addAmount(map, material.id, material.name, material.category, material.supplier || "Uten leverandør", amount, line.unit);
        return;
      }
      if (line.itemType === "recipe") {
        const recipe = data.recipes.find((r) => r.id === line.itemId);
        if (!recipe) return;
        recipe.lines.forEach((rl) => {
          if (rl.itemType === "material") {
            const material = data.materials.find((m) => m.id === rl.itemId);
            if (material) addAmount(map, material.id, material.name, material.category, material.supplier || "Uten leverandør", rl.amount * amount, material.unit);
          }
        });
        return;
      }
      const subProduct = data.products.find((p) => p.id === line.itemId);
      if (subProduct) expandProductToMaterials(subProduct, amount, map, [...path, product.id]);
    });
  }

  const materialMap: Record<string, MaterialOrderRow> = {};
  ordersInPeriod.forEach((order) => {
    order.orderLines.forEach((line) => {
      const product = data.products.find((p) => p.id === line.productId);
      if (product) expandProductToMaterials(product, Number(line.quantity) || 0, materialMap);
    });
  });

  const materialRows = Object.values(materialMap).sort((a, b) => `${a.supplier} ${a.category} ${a.name}`.localeCompare(`${b.supplier} ${b.category} ${b.name}`, "no-NO"));

  function printProductionSummary() {
    const orderRows = ordersInPeriod.flatMap((o) => o.orderLines.map((l) => {
      const product = data.products.find((p) => p.id === l.productId);
      return `<tr><td>${formatDateNo(o.date)} ${o.time || ""}</td><td>${o.customerType === "bedrift" ? o.companyName || "" : o.customer}</td><td>${product?.name || "Ukjent"}</td><td>${l.quantity}</td></tr>`;
    })).join("");

    const grouped = materialRows.reduce((acc, row) => {
      if (!acc[row.supplier]) acc[row.supplier] = [];
      acc[row.supplier].push(row);
      return acc;
    }, {} as Record<string, typeof materialRows>);

    const materialHtml = Object.entries(grouped).map(([supplier, rows]) => `<tr><td colspan="4" style="background:#111827;color:white;font-weight:800;">${supplier}</td></tr>${rows.map((r) => `<tr><td>${r.category}</td><td>${r.name}</td><td>${num(r.amount)}</td><td>${r.unit}</td></tr>`).join("")}`).join("");

    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8" /><title>Produksjon ${dateFrom} - ${dateTo}</title><style>body{font-family:Arial,sans-serif;color:#111827;padding:36px;line-height:1.4}.top{border-bottom:3px solid #111827;padding-bottom:18px;margin-bottom:24px}.logo{font-size:26px;font-weight:900}.muted{color:#64748b}table{width:100%;border-collapse:collapse;margin-top:8px;margin-bottom:24px}th,td{border-bottom:1px solid #e5e7eb;padding:8px;text-align:left}th{background:#f3f4f6}@media print{button{display:none}body{padding:18px}}</style></head><body><button onclick="window.print()">Print</button><div class="top"><div class="logo">PRODUKSJONSSAMMENDRAG</div><div class="muted">${formatDateNo(dateFrom)} til ${formatDateNo(dateTo)}</div></div><h2>Ordre</h2><table><thead><tr><th>Dato/tid</th><th>Kunde</th><th>Produkt</th><th>Antall</th></tr></thead><tbody>${orderRows}</tbody></table><h2>Varebestillingsliste per leverandør</h2><table><thead><tr><th>Kategori</th><th>Råvare</th><th>Mengde</th><th>Enhet</th></tr></thead><tbody>${materialHtml}</tbody></table></body></html>`);
    w.document.close();
    w.focus();
  }

  return (
    <section className="card">
      <h2>Produksjon</h2>
      <div className="form-grid three">
        <label>Fra dato<input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></label>
        <label>Til dato<input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></label>
        <button className="btn active" onClick={printProductionSummary}>Print produksjon/varebestilling</button>
      </div>
      <button className={showMaterials ? "btn active" : "btn"} onClick={() => setShowMaterials(!showMaterials)}>{showMaterials ? "Skjul varebestillingsliste" : "Vis varebestillingsliste"}</button>

      <h3>Ordre i perioden</h3>
      <table><thead><tr><th>Dato</th><th>Kunde</th><th>Produkt/meny</th><th>Antall</th></tr></thead><tbody>{ordersInPeriod.flatMap((o) => o.orderLines.map((l, i) => <tr key={`${o.id}-${i}`}><td>{formatDateNo(o.date)} {o.time}</td><td>{o.customerType === "bedrift" ? o.companyName : o.customer}</td><td>{data.products.find((p) => p.id === l.productId)?.name}</td><td>{l.quantity}</td></tr>))}</tbody></table>

      {showMaterials && <><h3>Varebestillingsliste</h3><table><thead><tr><th>Leverandør</th><th>Kategori</th><th>Råvare</th><th>Mengde</th><th>Enhet</th></tr></thead><tbody>{materialRows.map((r, i) => <tr key={i}><td>{r.supplier || "Uten leverandør"}</td><td>{r.category}</td><td>{r.name}</td><td>{num(r.amount)}</td><td>{r.unit}</td></tr>)}</tbody></table></>}
    </section>
  );
}

function InventoryTab({ data, updateData }: { data: AppData; updateData: (p: Partial<AppData>) => void }) {
  const currentYm = new Date().toISOString().slice(0, 7);
  const [inventoryMonth, setInventoryMonth] = useState(currentYm);
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventoryCategoryFilter, setInventoryCategoryFilter] = useState("Alle");
  const [inventoryPage, setInventoryPage] = useState(1);
  const [showInventoryStats, setShowInventoryStats] = useState(false);
  const pageSize = 50;

  const countsByMonth = data.inventoryCounts || {};
  const currentInventory = countsByMonth[inventoryMonth] || { locked: false, waste: {}, items: {} };
  const counts = currentInventory.items || {};
  const waste = currentInventory.waste || {};
  const isLocked = !!currentInventory.locked;

  const accountingBuckets = ["Mat", "Mineralvann", "Kaffe/te", "Vin", "Øl", "Cider", "Brennevin"];
  const internalBuckets = ["Alle", "Mat", "Deli", "Mineralvann", "Kaffe/te", "Vin", "Øl", "Cider", "Brennevin"];
  const statsBuckets = ["Mat", "Deli", "Mineralvann", "Kaffe/te", "Vin", "Øl", "Cider", "Brennevin"];
  const drinkBuckets = ["Mineralvann", "Kaffe/te", "Vin", "Øl", "Cider", "Brennevin"];

  function updateCount(materialId: string, packages: number, loose: number) {
    const material = data.materials.find((m) => m.id === materialId);
    updateData({
      inventoryCounts: {
        ...countsByMonth,
        [inventoryMonth]: {
          ...currentInventory,
          waste,
          items: {
            ...counts,
            [materialId]: {
              packages,
              loose,
              packagePrice: material?.packagePrice || 0,
              pricePerUnit: material?.pricePerUnit || 0,
            },
          },
        },
      },
    });
  }

  function updateWaste(bucket: string, amount: number) {
    updateData({
      inventoryCounts: {
        ...countsByMonth,
        [inventoryMonth]: {
          ...currentInventory,
          items: counts,
          waste: { ...waste, [bucket]: amount },
        },
      },
    });
  }

  function materialInventoryValue(m: Material) {
    const c = counts[m.id] || { packages: 0, loose: 0, packagePrice: m.packagePrice, pricePerUnit: m.pricePerUnit };
    return c.packages * (c.packagePrice ?? m.packagePrice) + c.loose * (c.pricePerUnit ?? m.pricePerUnit);
  }

  function belongsToBucket(m: Material, bucket: string) {
    if (bucket === "Alle") return true;
    if (bucket === "Deli") return m.category === "Deli";
    if (bucket === "Mat") return !drinkBuckets.includes(m.category) && m.category !== "Deli";
    return m.category === bucket;
  }

  function bucketValue(bucket: string) {
    return data.materials.reduce((sum, m) => belongsToBucket(m, bucket) ? sum + materialInventoryValue(m) : sum, 0);
  }

  const total = data.materials.reduce((sum, m) => sum + materialInventoryValue(m), 0);
  const [year, month] = inventoryMonth.split("-");

  const filtered = data.materials
    .filter((m) => `${m.name} ${m.category}`.toLowerCase().includes(inventorySearch.toLowerCase()))
    .filter((m) => inventoryCategoryFilter === "Alle" ? true : belongsToBucket(m, inventoryCategoryFilter))
    .sort((a, b) => {
      const bucketA = drinkBuckets.includes(a.category) ? a.category : "Mat";
      const bucketB = drinkBuckets.includes(b.category) ? b.category : "Mat";
      return `${accountingBuckets.indexOf(bucketA)} ${a.name}`.localeCompare(`${accountingBuckets.indexOf(bucketB)} ${b.name}`, "no-NO");
    });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visibleMaterials = filtered.slice((inventoryPage - 1) * pageSize, inventoryPage * pageSize);

  function exportInventoryCsv() {
    const rows: string[][] = [];
    rows.push([`Varetelling ${inventoryMonth}`]);
    rows.push([]);
    rows.push(["Kategori", "Vare", "Råvarekost pr pk", "Pakning", "Pakker", "Løs", "Verdi"]);

    accountingBuckets.forEach((bucket) => {
      const materials = data.materials.filter((m) => belongsToBucket(m, bucket)).sort((a, b) => a.name.localeCompare(b.name, "no-NO"));
      rows.push([]);
      rows.push([bucket.toUpperCase(), "", "", "", "", "", ""]);
      materials.forEach((m) => {
        const c = counts[m.id] || { packages: 0, loose: 0, packagePrice: m.packagePrice, pricePerUnit: m.pricePerUnit };
        const value = materialInventoryValue(m);
        rows.push([
          bucket,
          m.name,
          String(m.packagePrice).replace(".", ","),
          `${m.packageSize} ${m.unit}`,
          String(c.packages || "").replace(".", ","),
          String(c.loose || "").replace(".", ","),
          value.toFixed(2).replace(".", ","),
        ]);
      });
      rows.push([`SUM ${bucket}`, "", "", "", "", "", bucketValue(bucket).toFixed(2).replace(".", ",")]);
      rows.push([`SVINN ${bucket}`, "", "", "", "", "", String(waste[bucket] || 0).replace(".", ",")]);
    });

    rows.push([]);
    rows.push(["TOTAL", "", "", "", "", "", total.toFixed(2).replace(".", ",")]);

    const csv = rows
      .map((row) =>
        row
          .map((cell) => JSON.stringify(String(cell ?? "")))
          .join(";")
      )
      .join(String.fromCharCode(10));

    const blob = new Blob([String.fromCharCode(0xfeff) + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `varetelling-${inventoryMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function valueForBucketInMonth(monthKey: string, bucket: string) {
    const monthData = countsByMonth[monthKey];
    const items = monthData?.items || {};
    return data.materials.reduce((sum, m) => {
      if (!belongsToBucket(m, bucket)) return sum;
      const c = items[m.id] || { packages: 0, loose: 0, packagePrice: m.packagePrice, pricePerUnit: m.pricePerUnit };
      return sum + c.packages * (c.packagePrice ?? m.packagePrice) + c.loose * (c.pricePerUnit ?? m.pricePerUnit);
    }, 0);
  }

  const inventoryHistory = Object.keys(countsByMonth).sort().map((monthKey) => {
    const monthData = countsByMonth[monthKey];
    const totalValue = statsBuckets.reduce((sum, b) => sum + valueForBucketInMonth(monthKey, b), 0);
    return { monthKey, total: totalValue, wasteTotal: Object.values(monthData.waste || {}).reduce((s, v) => s + Number(v || 0), 0) };
  }).slice(-12);

  const maxInventoryValue = Math.max(1, ...inventoryHistory.map((h) => h.total));

  return (
    <section className="card">
      <h2>Varetelling</h2>
      <div className="form-grid three">
        <label>
          Måned
          <select value={month} onChange={(e) => { setInventoryMonth(`${year}-${e.target.value}`); setInventoryPage(1); }}>
            <option value="01">Januar</option><option value="02">Februar</option><option value="03">Mars</option><option value="04">April</option><option value="05">Mai</option><option value="06">Juni</option><option value="07">Juli</option><option value="08">August</option><option value="09">September</option><option value="10">Oktober</option><option value="11">November</option><option value="12">Desember</option>
          </select>
        </label>
        <label>
          År
          <select value={year} onChange={(e) => { setInventoryMonth(`${e.target.value}-${month}`); setInventoryPage(1); }}>
            {Array.from({ length: 16 }, (_, i) => 2020 + i).map((y) => <option key={y} value={String(y)}>{y}</option>)}
          </select>
        </label>
        <Metric label="Sum varetelling" value={currency(total)} dark />
      </div>

      <div className="metric-row">{accountingBuckets.map((b) => <Metric key={b} label={b} value={currency(bucketValue(b))} />)}</div>

      <div className="soft-box">
        <h3>Svinn denne måneden</h3>
        <div className="form-grid four">
          {accountingBuckets.map((b) => <label key={b}>{b}<input type="number" value={waste[b] || ""} onChange={(e) => updateWaste(b, Number(e.target.value) || 0)} /></label>)}
        </div>
      </div>

      <div className="soft-box">
        <div className="between"><h3>Historikk siste 12 registrerte måneder</h3><button className={showInventoryStats ? "btn active" : "btn"} onClick={() => setShowInventoryStats(!showInventoryStats)}>{showInventoryStats ? "Skjul grafisk statistikk" : "Vis grafisk statistikk"}</button></div>
        <table><thead><tr><th>Måned</th><th>Varebeholdning</th><th>Svinn</th></tr></thead><tbody>{inventoryHistory.map((h) => <tr key={h.monthKey}><td>{h.monthKey}</td><td>{currency(h.total)}</td><td>{currency(h.wasteTotal)}</td></tr>)}</tbody></table>
      </div>

      {showInventoryStats && <div className="soft-box"><h3>Grafisk statistikk måned for måned</h3><p style={{ color: "#64748b" }}>Oversikt over total varebeholdning og fordeling per kategori.</p><div className="inventory-chart">{inventoryHistory.map((h) => <div key={h.monthKey} className="inventory-month"><div className="between"><b>{h.monthKey}</b><b>{currency(h.total)}</b></div><div className="bar-bg"><div className="bar-fill" style={{ width: `${Math.max(4, (h.total / maxInventoryValue) * 100)}%` }} /></div><div className="inventory-breakdown">{statsBuckets.map((bucket) => { const value = valueForBucketInMonth(h.monthKey, bucket); return <div key={bucket} className="breakdown-row"><span>{bucket}</span><span>{currency(value)}</span></div>; })}</div></div>)}</div></div>}

      <button className="btn" onClick={() => updateData({ inventoryCounts: { ...countsByMonth, [inventoryMonth]: { ...currentInventory, waste, locked: !isLocked, items: counts } } })}>{isLocked ? "Lås opp måned" : "Lås måned"}</button>
      <button className="btn active" onClick={exportInventoryCsv}>Eksporter CSV</button>

      <input value={inventorySearch} onChange={(e) => { setInventorySearch(e.target.value); setInventoryPage(1); }} placeholder="Søk råvare" />

      <div className="chips">
        {internalBuckets.map((cat) => <button key={cat} className={inventoryCategoryFilter === cat ? "btn active" : "btn"} onClick={() => { setInventoryCategoryFilter(cat); setInventoryPage(1); }}>{cat}</button>)}
      </div>

      <p style={{ color: "#64748b" }}>Viser {visibleMaterials.length} av {filtered.length} råvarer. Side {inventoryPage} av {totalPages}.</p>

      <table>
        <thead><tr><th>Vare</th><th>Kategori</th><th>Råvarekost pr pk</th><th>Pakning</th><th>Pakker</th><th>Løs</th><th>Verdi</th></tr></thead>
        <tbody>
          {visibleMaterials.map((m) => {
            const c = counts[m.id] || { packages: 0, loose: 0, packagePrice: m.packagePrice, pricePerUnit: m.pricePerUnit };
            const value = c.packages * (c.packagePrice ?? m.packagePrice) + c.loose * (c.pricePerUnit ?? m.pricePerUnit);
            return <tr key={m.id}><td>{m.name}</td><td>{m.category}</td><td>{currency(m.packagePrice)}</td><td>{m.packageSize} {m.unit}</td><td><input type="number" disabled={isLocked} value={c.packages || ""} onChange={(e) => updateCount(m.id, Number(e.target.value), c.loose)} /></td><td><input type="number" disabled={isLocked} value={c.loose || ""} onChange={(e) => updateCount(m.id, c.packages, Number(e.target.value))} /></td><td>{currency(value)}</td></tr>;
          })}
        </tbody>
      </table>

      <div className="pager"><button className="btn" disabled={inventoryPage <= 1} onClick={() => setInventoryPage(inventoryPage - 1)}>Forrige</button><span>Side {inventoryPage} av {totalPages}</span><button className="btn" disabled={inventoryPage >= totalPages} onClick={() => setInventoryPage(inventoryPage + 1)}>Neste</button></div>
    </section>
  );
}

function RentalTab({ data, updateData }: { data: AppData; updateData: (p: Partial<AppData>) => void }) {
  const rental = data.rental;
  function setRental(next: RentalOffer) { updateData({ rental: next }); }

  const addonLines = rental.extraLines || [];
  const addonTotal = addonLines.reduce((sum, line) => sum + Number(line.amount || 0), 0);
  const food = rental.productLines.reduce((sum, l) => sum + (data.products.find((p) => p.id === l.productId)?.customerPrice || 0) * l.guests, 0);
  const waiters = rental.waiters * (rental.waiterHours * data.settings.waiterRate + rental.waiterAfterMidnightHours * data.settings.waiterAfterMidnightRate);
  const total = rental.venuePrice + food + waiters + addonTotal;

  const quantityAddons = ["Tøyservietter", "Vinpakke 3 glass", "Alkoholfri drikkepakke 3 glass"];
  const includedText = "Prisen inkluderer dekketøy, hvite duker, hvite papirservietter (Dunilin), kaffe og te og rengjøring av lokalene. Leier kan ta med egne kaker inkludert i prisen.";

  function addonUsesQuantity(addonName: string) {
    return quantityAddons.includes(addonName);
  }

  function isAddonSelected(addon: RentalAddon) {
    return addonLines.some((line) => line.text === addon.name);
  }

  function toggleAddon(addon: RentalAddon) {
    if (isAddonSelected(addon)) {
      setRental({ ...rental, extraLines: addonLines.filter((line) => line.text !== addon.name) });
      return;
    }
    const usesQty = addonUsesQuantity(addon.name);
    setRental({ ...rental, extraLines: [...addonLines, { text: addon.name, unitPrice: addon.price, quantity: usesQty ? 1 : undefined, amount: addon.price }] });
  }

  function updateAddonQuantity(addonName: string, quantity: number) {
    setRental({
      ...rental,
      extraLines: addonLines.map((line) => {
        if (line.text !== addonName) return line;
        const unitPrice = Number(line.unitPrice ?? line.amount ?? 0);
        return { ...line, quantity, unitPrice, amount: quantity * unitPrice };
      }),
    });
  }

  function updateAddonAmount(addonName: string, amount: number) {
    setRental({ ...rental, extraLines: addonLines.map((line) => line.text === addonName ? { ...line, amount, unitPrice: addonUsesQuantity(line.text) ? Number(line.unitPrice ?? amount) : undefined } : line) });
  }

  return <section className="grid two"><div className="card"><h2>Leie av lokale</h2><label>Kunde<input value={rental.customer} onChange={(e) => setRental({ ...rental, customer: e.target.value })} placeholder="Kunde" /></label><label>Lokale<select value={rental.venue} onChange={(e) => { const v = data.venues.find((x) => x.name === e.target.value)!; setRental({ ...rental, venue: v.name, venuePrice: v.price }); }}>{data.venues.map((v) => <option key={v.id}>{v.name}</option>)}</select></label><label>Lokaleleie<input type="number" value={rental.venuePrice} onChange={(e) => setRental({ ...rental, venuePrice: Number(e.target.value) })} /></label><h3>Produkter/menyer</h3>{rental.productLines.map((l, i) => <div className="form-grid three" key={i}><label>Produkt<select value={l.productId} onChange={(e) => setRental({ ...rental, productLines: rental.productLines.map((x, ix) => ix === i ? { ...x, productId: e.target.value } : x) })}><option value="">Velg produkt</option>{data.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Antall gjester / porsjoner<input type="number" value={l.guests} onChange={(e) => setRental({ ...rental, productLines: rental.productLines.map((x, ix) => ix === i ? { ...x, guests: Number(e.target.value) } : x) })} /></label><button className="link danger" onClick={() => setRental({ ...rental, productLines: rental.productLines.filter((_, ix) => ix !== i) })}>Slett</button></div>)}<button className="btn" onClick={() => setRental({ ...rental, productLines: [...rental.productLines, { productId: "", guests: 0 }] })}>+ Produkt</button><h3>Servitører</h3><div className="form-grid three"><label>Antall servitører<input type="number" value={rental.waiters} onChange={(e) => setRental({ ...rental, waiters: Number(e.target.value) })} /></label><label>Timer før midnatt<input type="number" value={rental.waiterHours} onChange={(e) => setRental({ ...rental, waiterHours: Number(e.target.value) })} /></label><label>Timer etter midnatt<input type="number" value={rental.waiterAfterMidnightHours} onChange={(e) => setRental({ ...rental, waiterAfterMidnightHours: Number(e.target.value) })} /></label></div><h3>Tillegg</h3><div className="soft-box">{data.rentalAddons.map((addon) => { const selected = isAddonSelected(addon); const line = addonLines.find((x) => x.text === addon.name); const usesQty = addonUsesQuantity(addon.name); return <div key={addon.id} className="editable-row"><label className="check"><input type="checkbox" checked={selected} onChange={() => toggleAddon(addon)} /> {addon.name} · {currency(addon.price)}{usesQty ? " per stk/person" : ""}</label>{selected && usesQty && <label>Antall<input type="number" value={line?.quantity || 1} onChange={(e) => updateAddonQuantity(addon.name, Number(e.target.value) || 0)} /></label>}{selected && !usesQty && <label>Pris<input type="number" value={line?.amount || 0} onChange={(e) => updateAddonAmount(addon.name, Number(e.target.value) || 0)} /></label>}{selected && usesQty && <b>{currency(line?.amount || 0)}</b>}</div>; })}</div></div><div className="card"><h2>Tilbud</h2><div className="soft-box"><h3>Prisen inkluderer</h3><p>{includedText}</p></div><p>Leie {rental.venue}: <b>{currency(rental.venuePrice)}</b></p><p>Mat/produkter: <b>{currency(food)}</b></p><p>Servitører: <b>{currency(waiters)}</b></p><p>Tillegg: <b>{currency(addonTotal)}</b></p>{addonLines.length > 0 && <table><thead><tr><th>Tillegg</th><th>Antall</th><th>Pris</th></tr></thead><tbody>{addonLines.map((line, i) => <tr key={i}><td>{line.text}</td><td>{line.quantity || "-"}</td><td>{currency(line.amount)}</td></tr>)}</tbody></table>}<h2>Total: {currency(total)}</h2></div></section>;
}

function SettingsTab({
  data,
  updateData,
  exportData,
  importData,
}: {
  data: AppData;
  updateData: (p: Partial<AppData>) => void;
  exportData: () => void;
  importData: (file: File | null) => void;
}) {
  const [open, setOpen] = useState("personell");
  const [newMaterialCategory, setNewMaterialCategory] = useState("");
  const [newProductCategory, setNewProductCategory] = useState("");
  const [newMenuCategory, setNewMenuCategory] = useState("");
  const [newVenue, setNewVenue] = useState({ name: "", price: "0" });
  const [newPackaging, setNewPackaging] = useState({ name: "", price: "0" });
  const [newRentalAddon, setNewRentalAddon] = useState({ name: "", price: "0" });
  const s = data.settings;
  const Section = ({ id, title, children }: { id: string; title: string; children: React.ReactNode }) => <div className="settings-section"><button className="settings-toggle" onClick={() => setOpen(open === id ? "" : id)}>{title}<span>{open === id ? "−" : "+"}</span></button>{open === id && <div className="settings-content">{children}</div>}</div>;

  return <section className="card"><h2>Innstillinger</h2><Section id="personell" title="Personell"><div className="form-grid"><label>MVA mat<input type="number" value={s.foodVat} onChange={(e) => updateData({ settings: { ...s, foodVat: Number(e.target.value) } })} /></label><label>Kostnad kokker/time<input type="number" value={s.chefHourlyRate} onChange={(e) => updateData({ settings: { ...s, chefHourlyRate: Number(e.target.value) } })} /></label><label>Grunntid kokker/min<input type="number" value={s.chefBaseMinutes} onChange={(e) => updateData({ settings: { ...s, chefBaseMinutes: Number(e.target.value) } })} /></label><label>Tillegg min pr 10 pers<input type="number" value={s.chefExtraMinutesPer10} onChange={(e) => updateData({ settings: { ...s, chefExtraMinutesPer10: Number(e.target.value) } })} /></label><label>2 kokker over antall<input type="number" value={s.twoChefsOverGuests} onChange={(e) => updateData({ settings: { ...s, twoChefsOverGuests: Number(e.target.value) } })} /></label><label>Servitør/time<input type="number" value={s.waiterRate} onChange={(e) => updateData({ settings: { ...s, waiterRate: Number(e.target.value) } })} /></label><label>Servitør etter midnatt<input type="number" value={s.waiterAfterMidnightRate} onChange={(e) => updateData({ settings: { ...s, waiterAfterMidnightRate: Number(e.target.value) } })} /></label></div></Section><Section id="venues" title="Leie av lokaler, priser"><div>{data.venues.map((v, i) => <div key={v.id} className="editable-row"><input value={v.name} onChange={(e) => updateData({ venues: data.venues.map((x, ix) => ix === i ? { ...x, name: e.target.value } : x) })} /><input type="number" value={v.price} onChange={(e) => updateData({ venues: data.venues.map((x, ix) => ix === i ? { ...x, price: Number(e.target.value) || 0 } : x) })} /><button className="link danger" onClick={() => updateData({ venues: data.venues.filter((x) => x.id !== v.id) })}>Slett</button></div>)}</div><div className="form-grid three"><input placeholder="Nytt lokale" value={newVenue.name} onChange={(e) => setNewVenue({ ...newVenue, name: e.target.value })} /><input type="number" placeholder="Pris" value={newVenue.price} onChange={(e) => setNewVenue({ ...newVenue, price: e.target.value })} /><button className="btn active" onClick={() => { if (!newVenue.name.trim()) return; updateData({ venues: [...data.venues, { id: `${idFromName(newVenue.name)}-${Date.now()}`, name: newVenue.name.trim(), price: Number(newVenue.price) || 0 }] }); setNewVenue({ name: "", price: "0" }); }}>Legg til</button></div></Section><Section id="rentalAddons" title="Leie av lokale, tillegg"><div>{data.rentalAddons.map((addon, i) => <div key={addon.id} className="editable-row"><input value={addon.name} onChange={(e) => updateData({ rentalAddons: data.rentalAddons.map((x, ix) => ix === i ? { ...x, name: e.target.value } : x) })} /><input type="number" value={addon.price} onChange={(e) => updateData({ rentalAddons: data.rentalAddons.map((x, ix) => ix === i ? { ...x, price: Number(e.target.value) || 0 } : x) })} /><button className="link danger" onClick={() => updateData({ rentalAddons: data.rentalAddons.filter((x) => x.id !== addon.id) })}>Slett</button></div>)}</div><div className="form-grid three"><input placeholder="Nytt tillegg" value={newRentalAddon.name} onChange={(e) => setNewRentalAddon({ ...newRentalAddon, name: e.target.value })} /><input type="number" placeholder="Pris" value={newRentalAddon.price} onChange={(e) => setNewRentalAddon({ ...newRentalAddon, price: e.target.value })} /><button className="btn active" onClick={() => { if (!newRentalAddon.name.trim()) return; updateData({ rentalAddons: [...data.rentalAddons, { id: `${idFromName(newRentalAddon.name)}-${Date.now()}`, name: newRentalAddon.name.trim(), price: Number(newRentalAddon.price) || 0 }] }); setNewRentalAddon({ name: "", price: "0" }); }}>Legg til</button></div></Section><Section id="materialCats" title="Kategorier for råvarer"><CategoryEditor values={data.materialCategories} newValue={newMaterialCategory} setNewValue={setNewMaterialCategory} onSave={(next) => updateData({ materialCategories: next })} /></Section><Section id="productCats" title="Kategorier for produkter/menyer"><h3>Produktkategorier</h3><CategoryEditor values={data.productCategories} newValue={newProductCategory} setNewValue={setNewProductCategory} onSave={(next) => updateData({ productCategories: next })} /><h3>Menykategorier</h3><CategoryEditor values={data.menuCategories} newValue={newMenuCategory} setNewValue={setNewMenuCategory} onSave={(next) => updateData({ menuCategories: next })} /></Section><Section id="packaging" title="Priser på emballasje"><div>{data.packaging.map((p, i) => <div key={p.id} className="editable-row"><input value={p.name} onChange={(e) => updateData({ packaging: data.packaging.map((x, ix) => ix === i ? { ...x, name: e.target.value } : x) })} /><input type="number" value={p.price} onChange={(e) => updateData({ packaging: data.packaging.map((x, ix) => ix === i ? { ...x, price: Number(e.target.value) || 0 } : x) })} /><button className="link danger" onClick={() => updateData({ packaging: data.packaging.filter((x) => x.id !== p.id) })}>Slett</button></div>)}</div><div className="form-grid three"><input placeholder="Ny emballasje" value={newPackaging.name} onChange={(e) => setNewPackaging({ ...newPackaging, name: e.target.value })} /><input type="number" placeholder="Pris" value={newPackaging.price} onChange={(e) => setNewPackaging({ ...newPackaging, price: e.target.value })} /><button className="btn active" onClick={() => { if (!newPackaging.name.trim()) return; updateData({ packaging: [...data.packaging, { id: `${idFromName(newPackaging.name)}-${Date.now()}`, name: newPackaging.name.trim(), price: Number(newPackaging.price) || 0 }] }); setNewPackaging({ name: "", price: "0" }); }}>Legg til</button></div></Section><div style={{ marginTop: 40 }}>
  <h3>Database</h3>

  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
    <button className="btn active" onClick={exportData}>
      Eksporter database
    </button>

    <label className="btn">
      Importer database
      <input
        type="file"
        accept="application/json"
        hidden
        onChange={(e) => importData(e.target.files?.[0] || null)}
      />
    </label>
  </div>

  <p style={{ fontSize: 12, color: "#64748b", marginTop: 8 }}>
    Tips: Ta backup før du importerer ny fil.
  </p>
</div></section>;
}

function CategoryEditor({ values, newValue, setNewValue, onSave }: { values: string[]; newValue: string; setNewValue: (v: string) => void; onSave: (next: string[]) => void }) {
  return <>
    <div>{values.map((v, i) => <div key={`${v}-${i}`} className="editable-row"><input value={v} onChange={(e) => onSave(values.map((x, ix) => ix === i ? e.target.value : x))} /><button className="link danger" onClick={() => onSave(values.filter((_, ix) => ix !== i))}>Slett</button></div>)}</div>
    <div className="form-grid three"><input value={newValue} onChange={(e) => setNewValue(e.target.value)} placeholder="Ny kategori" /><button className="btn active" onClick={() => { if (!newValue.trim()) return; onSave([...values, newValue.trim()]); setNewValue(""); }}>Legg til</button></div>
  </>;
}

function EditableList<T extends { id: string }>({ items, label, onDelete }: { items: T[]; label: (item: T) => string; onDelete: (id: string) => void }) {
  return <div>{items.map((item) => <div key={item.id} className="editable-row"><span>{label(item)}</span><button className="link danger" onClick={() => onDelete(item.id)}>Slett</button></div>)}</div>;
}

function Metric({ label, value, dark = false, tone }: { label: string; value: string; dark?: boolean; tone?: "good" | "warn" | "bad" }) {
  const toneClass = tone ? ` ${tone}` : "";
  return <div className={dark ? "metric dark" : `metric${toneClass}`}><small>{label}</small><b>{value}</b></div>;
}

function GlobalStyles() {
  return (
    <style jsx global>{`
    * { box-sizing: border-box; }
    h1, h2, h3 { margin-top: 0; }
    .card { background: white; border-radius: 18px; padding: 22px; box-shadow: 0 1px 8px rgba(15,23,42,.08); margin-bottom: 18px; }
    .grid.two { display: grid; grid-template-columns: minmax(320px,420px) 1fr; gap: 18px; align-items: start; }
    .form-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 10px; margin: 12px 0; }
    .form-grid.three { grid-template-columns: repeat(3,minmax(0,1fr)); }
    .form-grid.four { grid-template-columns: repeat(4,minmax(0,1fr)); }
    .form-grid.five { grid-template-columns: repeat(5,minmax(0,1fr)); }
    .small-grid { display: grid; grid-template-columns: repeat(6,minmax(0,1fr)); gap: 8px; }
    .between { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap; }
    input, select { width: 100%; border: 1px solid #cbd5e1; border-radius: 10px; padding: 9px 10px; background: white; }
    .btn {
  padding: 2px 6px;
  border-radius: 6px;
  border: 1px solid #cbd5f5;
  background: white;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  }
  .btn:hover {
  background: #f1f5f9;
  }
  .btn.danger {
  border-color: #fecaca;
  color: #b91c1c;
  background: #fef2f2;
  }
  .btn.logout {
  background: #fecaca;   /* lys rød */
  color: #0f172a;        /* sort tekst */
  border: 1px solid #fca5a5;
  }

  .btn.logout:hover {
  background: #fca5a5;
  }
    .btn.active { background: #0f172a; color: white; border-color: #0f172a; }
    .list { display: block; width: 100%; text-align: left; border: 1px solid #e2e8f0; background: white; border-radius: 12px; padding: 12px; margin: 8px 0; cursor: pointer; }
    .active-list { background: #0f172a; color: white; }
    .metric-row { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 10px; margin: 12px 0; }
    .metric-row.three-metrics { grid-template-columns: repeat(3,minmax(0,1fr)); }
    .metric { background: #f1f5f9; border-radius: 14px; padding: 14px; display: flex; flex-direction: column; gap: 4px; }
    .metric.dark { background: #0f172a; color: white; }
    .metric.good { background: #dcfce7; }
    .metric.warn { background: #fef3c7; }
    .metric.bad { background: #fee2e2; }
    table { width: 100%; border-collapse: collapse; margin-top: 14px; }
    th { text-align: left; background: #f1f5f9; }
    td, th { border-bottom: 1px solid #e2e8f0; padding: 9px; vertical-align: top; }
    .link { border: 0; background: transparent; cursor: pointer; font-weight: 700; margin-right: 8px; }
    .plain { border: 0; background: transparent; color: inherit; width: 100%; text-align: left; cursor: pointer; padding: 0; }
    .danger { color: #dc2626; }
    label { font-weight: 700; font-size: 13px; }
    label input, label select { margin-top: 5px; }
    .check { display:flex; gap:8px; align-items:center; margin:10px 0; }
    .check input { width:auto; }
    .soft-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 16px; margin: 14px 0; }
    .chips { display:flex; flex-wrap:wrap; gap:8px; margin:8px 0 16px; }
    .warning { background:#fef3c7; border:1px solid #f59e0b; padding:12px; border-radius:12px; margin:12px 0; }
    .settings-section { border:1px solid #e2e8f0; border-radius:14px; margin-bottom:10px; overflow:hidden; }
    .settings-toggle { width:100%; display:flex; justify-content:space-between; align-items:center; border:0; background:#f8fafc; padding:14px 16px; font-weight:800; cursor:pointer; }
    .settings-content { padding:16px; }
    .editable-row { display:flex; justify-content:space-between; gap:12px; padding:8px 0; border-bottom:1px solid #e2e8f0; }
    .full-width { width:100%; }
    .order-line-box { border:1px solid #e2e8f0; border-radius:14px; padding:12px; background:white; }
    .danger-btn { color:#dc2626; border-color:#fecaca; }
    .pill { display:inline-flex; padding:6px 10px; border-radius:999px; background:#f1f5f9; margin:4px 6px 4px 0; font-size:13px; font-weight:700; }
    .pager { display:flex; justify-content:center; align-items:center; gap:12px; margin-top:16px; }
    .today-title { font-size: 34px; margin-bottom: 16px; }
    .click-row { cursor:pointer; }
    .click-row:hover { background:#f8fafc; }
    .search-picker { position: relative; }
    .search-dropdown.inline { position: absolute; z-index: 30; left: 0; right: 0; top: calc(100% + 4px); background: white; border: 1px solid #cbd5e1; border-radius: 12px; box-shadow: 0 12px 24px rgba(15,23,42,.14); max-height: 280px; overflow: auto; }
    .search-result { width: 100%; border: 0; background: white; padding: 10px 12px; text-align: left; display: flex; flex-direction: column; gap: 2px; cursor: pointer; }
    .search-result:hover { background: #f8fafc; }
    .search-result small { color: #64748b; }
    .inventory-chart { display: grid; gap: 14px; }
    .inventory-month { border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px; background: white; }
    .bar-bg { height: 14px; background: #e2e8f0; border-radius: 999px; overflow: hidden; margin: 10px 0; }
    .bar-fill { height: 100%; background: #0f172a; border-radius: 999px; }
    .inventory-breakdown { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 6px 14px; margin-top: 10px; }
    .breakdown-row { display: flex; justify-content: space-between; gap: 10px; border-bottom: 1px solid #f1f5f9; padding: 4px 0; font-size: 13px; }
   .inline-cell-input {
  min-width: 90px;
  padding: 5px 6px;
  border-radius: 7px;
  font-size: 13px;
  }
  .inline-packaging-grid {
  display: grid;
  grid-template-columns: 1fr 80px;
  gap: 6px;
  }
  .textarea {
  width: 100%;
  min-height: 90px;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  padding: 9px 10px;
  background: white;
  resize: vertical;
  }
  .product-list-card {
  margin-top: 18px;
  }
  .product-list-picker {
  display: grid;
  grid-template-columns: repeat(2,minmax(0,1fr));
  gap: 8px;
  margin: 14px 0;
  }
  .product-list-check {
  align-items: flex-start;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 10px;
  background: white;
  }
  .wide-product-view {
  margin-top: 18px;
  }
        @media (max-width: 900px) {
      .grid.two,
      .form-grid,
      .form-grid.three,
      .form-grid.four,
      .form-grid.five,
      .metric-row,
      .small-grid {
        grid-template-columns: 1fr;
          }
    }
  `}</style>
  );
}
