"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Tab = "dashboard" | "materials" | "recipes" | "products" | "orders" | "production" | "inventory" | "rental" | "settings";
type Unit = "kg" | "liter" | "stk";
type YieldUnit = "kg" | "liter" | "stk" | "porsjoner";
type ProductType = "grunnoppskrift" | "bakst" | "cateringmeny" | "pasmuurt" | "egenprodusert" | "selskapsmeny";

type MenuCourseOption = { id: string; productId: string };
type MenuCourse = { id: string; name: string; options: MenuCourseOption[] };type ProductSubType = "" | "brød" | "søtbakst" | "annet" | "hel" | "delt";

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
  breadScaleType?: "none" | "sifted" | "wholegrain" | "wholegrain_or_grain" | "wheat_bran" | "rye_bran" | "oat_bran";
breadScaleFlourPercent?: number;
  updatedAt?: string;
  priceUpdatedAt?: string;
};


type RecipeLine = {
  itemType: "material" | "recipe";
  itemId: string;
  amount: number;
  wastePercent?: number;
  groupLabel?: string;
};

type RecipeStepInput = { kind: "group" | "step"; ref: string };

type RecipeStep = {
  id: string;
  action: string;
  inputs: RecipeStepInput[];
};

type Recipe = {
  id: string;
  productNumber: string;
  name: string;
  category: string;
  yieldAmount: number;
  yieldUnit: YieldUnit;
  lines: RecipeLine[];
  steps?: RecipeStep[];
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
  wastePercent?: number;
  groupLabel?: string;
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
  recipeYieldAmount?: number;
  unitWeightKg?: number;
  unitsPerCase?: number;
  menuCourses?: MenuCourse[];
};

type MenuCourseSelection = { courseId: string; productId: string; guestCount: number };
type OrderLine = { productId: string; quantity: number; menuSelections?: MenuCourseSelection[] };

type Order = {
   id: string;
  orderNumber?: string;        // ← NY
  deletedAt?: string;          // ← NY (satt når ordre slettes, brukes til papirkurv)
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
  paymentInfo?: string;
note?: string;
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
  id?: string;
  customer: string;
  date?: string;
  note?: string;
  venue: string;
  venuePrice: number;
  venueExternal?: boolean;
  venueExternalName?: string;
  waiters: number;
  waiterHours: number;
  waiterAfterMidnightHours: number;
  productLines: RentalProductLine[];
  extraLines: RentalExtraLine[];
};

type Venue = { id: string; name: string; price: number };

type Settings = {
  foodVat: number;
  alcoholVat?: number;
  chefHourlyRate: number;
  chefBaseMinutes: number;
  chefExtraMinutesPer10: number;
  twoChefsOverGuestCount: number;
  waiterHourlyRate: number;
  waiterAfterMidnightHourlyRate: number;
  retailMargins?: Record<string, number>;
};

type LocationCount = { packages: number; loose: number };
type InventoryCount = { packages: number; loose: number; packagePrice: number; pricePerUnit: number; locations?: Record<string, LocationCount> };
type ProfitabilityInput = {
  matSalesNetto?: number;
  deliSalesNetto?: number;
  favnVarekostPct?: number;
  varekjopMatTotalt?: number;
};

type InventoryMonthData = {
  locked?: boolean;
  pricesFrozen?: boolean;
  waste?: Record<string, number>;
  items: Record<string, InventoryCount>;
  kassasvinn?: number;
  profitability?: ProfitabilityInput;
};

type RentalAddon = { id: string; name: string; price: number; perUnit?: boolean };

type ProductListKind = "bakst" | "catering" | "storkjokken";

type ProductList = {
  id: string;
  name: string;
  kind: ProductListKind;
  introText: string;
  productIds: string[];
  createdAt: string;
};

type ProductionCategory = "smabakst" | "brod" | "spesialbrod" | "pasmuurt";

type BakeryProductionTemplateLine = {
  id: string;
  category: ProductionCategory;
  productId: string;
  sortOrder: number;
};

type StorkjokkenCustomer = {
  id: string;
  name: string;
  orgNumber?: string;
  address?: string;
  deliveryAddress?: string;
  phone?: string;
  active?: boolean;
};

type StorkjokkenSpecialPrice = {
  customerId: string;
  productId: string;
  priceExVat: number;
};

type RecurringStorkjokkenOrder = {
  id: string;
  customerId: string;
  weekdays: number[]; // 1=mandag, 2=tirsdag osv
  lines: OrderLine[];
  active: boolean;
  note?: string;
};

type BakeryProductionDay = {
  date: string;
  approved?: boolean;
  quantities: Record<string, Record<string, number>>;
};

type CalendarNote = {
  id: string;
  date: string;
  title: string;
  text: string;
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
  calendarNotes: CalendarNote[];
  rentalOffers?: RentalOffer[];

  bakeryProductionTemplateLines: BakeryProductionTemplateLine[];
  storkjokkenCustomers: StorkjokkenCustomer[];
  storkjokkenSpecialPrices: StorkjokkenSpecialPrice[];
  recurringStorkjokkenOrders: RecurringStorkjokkenOrder[];
  bakeryProductionDays: Record<string, BakeryProductionDay>;
  seenOrderIds: string[]
};

const STORAGE_KEY = "kalkyleverktoy-prototype-v4-products";
const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_TIME || "dev";

const defaultAllergens = ["Gluten", "Hvete", "Rug", "Spelt", "Bygg", "Egg", "Melk", "Laktose", "Fisk", "Skalldyr", "Bløtdyr", "Selleri", "Lupin", "Sulfitt", "Nøtter", "Hasselnøtt", "Mandler", "Valnøtt", "Pistasj", "Peanøtter", "Sesam", "Soya", "Sennep", "Sitrus"];
const defaultMaterialCategories = ["Mat", "Mel og frø", "Meieri", "Kjøtt", "Fisk", "Grønt", "Tørrvarer", "Kjøkken, egenprodusert", "Bakeri, egenprodusert", "Frukt og grønt", "Krydder", "Deli", "Mineralvann", "Kaffe/te", "Vin", "Øl", "Cider", "Brennevin"];
const defaultMenuCategories = ["Catering", "Selskap", "Bryllup", "Konfirmasjon", "Firma"];
const defaultProductCategories = ["Grunnoppskrift", "Brød", "Søtbakst", "Cateringmeny", "Påsmurt", "Egenprodusert", "Kjøkken, egenprodusert", "Bakeri, egenprodusert", "Selskapsmeny"];
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

function formatAmountUnit(amount: number, unit: string, digits = 2) {
  if (unit === "kg" && Math.abs(amount) < 1) {
    return `${num(amount * 1000, 0)} g`;
  }
  return `${num(amount, digits)} ${unit}`;
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
settings: {
  foodVat: 15,
  alcoholVat: 25,
  chefHourlyRate: 350,
  chefBaseMinutes: 60,
  chefExtraMinutesPer10: 30,
  twoChefsOverGuestCount: 30,
  waiterHourlyRate: 350,
  waiterAfterMidnightHourlyRate: 500,

  retailMargins: {
    Deli: 50,
    Mineralvann: 70,
    Øl: 70,
    Vin: 70,
    Brennevin: 70,
    Cider: 70,
  },
},
rental: { customer: "", venue: "Kaféen", venuePrice: 11000, waiters: 1, waiterHours: 0, waiterAfterMidnightHours: 0, productLines: [], extraLines: [] },  venues: [{ id: "kafeen", name: "Kaféen", price: 11000 }, { id: "oscarshall", name: "Oscarshall", price: 18000 }, { id: "gammelfloya", name: "Gammelfløya", price: 18000 }, { id: "bodogaard", name: "Bodøgaard hel helg", price: 24000 }],
  packaging: [{ id: "glass", name: "Glass", price: 8 }, { id: "brodpose", name: "Brødpose", price: 2.5 }, { id: "aluminiumsbakke", name: "Aluminiumsbakke", price: 12 }],
  rentalAddons: defaultRentalAddons,
  productLists: [],
  menuCategories: defaultMenuCategories,
  productCategories: defaultProductCategories,
  materialCategories: defaultMaterialCategories,
  inventoryCounts: {},
  calendarNotes: [],

  bakeryProductionTemplateLines: [],
  storkjokkenCustomers: [],
  storkjokkenSpecialPrices: [],
  recurringStorkjokkenOrders: [],
  bakeryProductionDays: {},
  seenOrderIds: [],
  rentalOffers: [],
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
    materialCategories: (raw.materialCategories || defaultMaterialCategories).map((c: string) => {
  if (c === "Kjølevarer") return "Kjøkken, egenprodusert";
  if (c === "Frysevare") return "Bakeri, egenprodusert";
  return c;
}).filter((c: string, i: number, arr: string[]) => arr.indexOf(c) === i),
    inventoryCounts: raw.inventoryCounts || {},
    bakeryProductionTemplateLines:
    
  (raw as any).bakeryProductionTemplateLines || [],

storkjokkenCustomers:
  (raw as any).storkjokkenCustomers || [],

storkjokkenSpecialPrices:
  (raw as any).storkjokkenSpecialPrices || [],

recurringStorkjokkenOrders:
  (raw as any).recurringStorkjokkenOrders || [],

bakeryProductionDays:
  (raw as any).bakeryProductionDays || {},
  seenOrderIds: (() => {
  const legacyDates: string[] = (raw as any).seenOrderDates || [];
  const existing: string[] = (raw as any).seenOrderIds || [];
  if (existing.length > 0) return existing;
  if (legacyDates.length === 0) return [];
  return (raw.orders || [])
    .filter((o: any) =>
      legacyDates.includes(o.date) &&
      o.recurringNote?.startsWith("Importert fra webshop")
    )
    .map((o: any) => o.id);
})(),
rentalOffers: (raw as any).rentalOffers || [],
  };
}

export default function Page() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [data, setData] = useState<AppData>(initialData);
  const isSavingRef = React.useRef(false);
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);

  useEffect(() => {
    async function loadData() {
      const { data: authData } = await supabase.auth.getSession();
      if (!authData.session) {
        window.location.href = "/login";
        return;
      }

      const { data: row, error } = await supabase
        .from("app_data")
        .select("data")
        .eq("id", "main")
        .single();

      if (error) {
        console.error("Supabase load error:", error);
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          try { setData(migrateData(JSON.parse(saved))); } catch { setData(initialData); }
        }
        setIsLoaded(true);
        return;
      }

      if (row?.data) setData(migrateData(row.data));
      setIsLoaded(true);
    }

    loadData();
  supabase.rpc("ensure_daily_backup").then(({ error }: any) => {
    if (error) console.error("Backup error:", error);
  });

  const channel = supabase
      .channel("app_data_changes")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "app_data", filter: "id=eq.main" },
        (payload) => {
          console.log("Realtime mottatt:", new Date().toISOString(), payload?.new?.updated_at);
          if (payload.new?.data) {
            setData((prev) => {
              const incoming = migrateData(payload.new.data);
              if (isSavingRef.current) {
                // Vi holder på å lagre selv – behold lokal state for alt,
                // men hent inventoryCounts fra databasen siden RPC alltid er autoritativ der
                return {
                  ...prev,
                  inventoryCounts: incoming.inventoryCounts,
                };
              }
              // Ikke i ferd med å lagre – ta inn alt fra databasen, men behold lokal inventoryCounts
              // siden vår lokale RPC-oppdatering kan være nyere enn det som nettopp kom inn
              return {
                ...incoming,
                inventoryCounts: prev.inventoryCounts,
              };
            });
          }
        }
      )
      .subscribe();

    // Polling som backup hvis Realtime ikke leverer
    const lastUpdatedRef = { current: "" };
    const pollInterval = setInterval(async () => {
      if (isSavingRef.current) return;
      const { data: tsRow } = await supabase
        .from("app_data")
        .select("updated_at")
        .eq("id", "main")
        .single();
      if (tsRow?.updated_at && tsRow.updated_at !== lastUpdatedRef.current) {
        lastUpdatedRef.current = tsRow.updated_at;
        const { data: fullRow } = await supabase
          .from("app_data")
          .select("data")
          .eq("id", "main")
          .single();
        if (fullRow?.data) {
          setData((prev) => {
            const incoming = migrateData(fullRow.data);
            return {
              ...incoming,
              inventoryCounts: incoming.inventoryCounts,
            };
          });
        }
      }
    }, 3000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, []);

  useEffect(() => { if (isLoaded) localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }, [data, isLoaded]);

  useEffect(() => {
    let localBuildId = BUILD_ID;

    async function initBuild() {
      const { data: row, error } = await supabase
        .from("app_meta")
        .select("build_id")
        .eq("id", "main")
        .single();

      if (error || !row) {
        // Første gang / tabell ikke klar – skriv vår versjon
        await supabase.from("app_meta").upsert({ id: "main", build_id: localBuildId, updated_at: new Date().toISOString() });
        return;
      }

      if (row.build_id !== localBuildId) {
        const dbTime = Number(row.build_id) || 0;
        const myTime = Number(localBuildId) || 0;
        if (myTime >= dbTime) {
          await supabase.from("app_meta").update({ build_id: localBuildId, updated_at: new Date().toISOString() }).eq("id", "main");
        } else {
          setShowUpdateBanner(true);
        }
      }
    }

    initBuild();

    const channel = supabase
      .channel("app_meta_changes")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "app_meta", filter: "id=eq.main" },
        (payload) => {
          const newBuildId = (payload.new as any)?.build_id;
          if (newBuildId && newBuildId !== localBuildId && newBuildId > localBuildId) {
            setShowUpdateBanner(true);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const updateData = React.useCallback((partial: Partial<AppData>) => {
  setData((prev) => {
    const next = { ...prev, ...partial };
    isSavingRef.current = true;
    supabase
      .from("app_data")
      .upsert({
        id: "main",
        data: next,
        updated_at: new Date().toISOString(),
      })
      .then(({ error }) => {
        if (error) console.error("Supabase save error:", error);
        setTimeout(() => { isSavingRef.current = false; }, 2000);
      });
    return next;
  });
}, []);

  const updateInventoryRpc = React.useCallback((month: string, patch: {
    itemsPatch?: Record<string, any>;
    wastePatch?: Record<string, number>;
    kassasvinn?: number;
    locked?: boolean;
    pricesFrozen?: boolean;
    profitability?: any;
  }) => {
    setData((prev) => {
      const prevMonth: any = prev.inventoryCounts?.[month] || { items: {}, waste: {} };
      const nextMonth: any = {
        ...prevMonth,
        items: { ...(prevMonth.items || {}), ...(patch.itemsPatch || {}) },
        waste: { ...(prevMonth.waste || {}), ...(patch.wastePatch || {}) },
      };
      if (patch.kassasvinn !== undefined) nextMonth.kassasvinn = patch.kassasvinn;
      if (patch.locked !== undefined) nextMonth.locked = patch.locked;
      if (patch.pricesFrozen !== undefined) nextMonth.pricesFrozen = patch.pricesFrozen;
      if (patch.profitability !== undefined) nextMonth.profitability = patch.profitability;

      const next = { ...prev, inventoryCounts: { ...(prev.inventoryCounts || {}), [month]: nextMonth } };

      isSavingRef.current = true;
      supabase.rpc("update_inventory_items", {
        p_month: month,
        p_items_patch: patch.itemsPatch || null,
        p_waste_patch: patch.wastePatch || null,
        p_kassasvinn: patch.kassasvinn ?? null,
        p_locked: patch.locked ?? null,
        p_prices_frozen: patch.pricesFrozen ?? null,
        p_profitability: patch.profitability ?? null,
      }).then(async ({ data, error }: any) => {
        if (error) {
          console.error("Supabase RPC error (inventory):", error);
        } else if (data) {
          // Trigger Realtime ved å oppdatere updated_at på app_data
          // RPC returnerer oppdatert data – vi trenger ikke skrive hele blokken tilbake,
          // bare trigge en minimal UPDATE som Realtime plukker opp
          await supabase
            .from("app_data")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", "main");
        }
        setTimeout(() => { isSavingRef.current = false; }, 500);
      });

      return next;
    });
  }, []);

  const updateMaterialsRpc = React.useCallback((materialsPatch: Record<string, any>) => {
    setData((prev) => {
      const next = {
        ...prev,
        materials: prev.materials.map((m) => {
          if (materialsPatch[m.id]) return { ...m, ...materialsPatch[m.id] };
          return m;
        }),
      };
      const newMaterials = Object.entries(materialsPatch)
        .filter(([id]) => !prev.materials.find((m) => m.id === id))
        .map(([, mat]) => mat as Material);
      if (newMaterials.length) next.materials = [...next.materials, ...newMaterials];

      isSavingRef.current = true;
      supabase.rpc("update_materials", {
        p_materials: materialsPatch,
      }).then(({ error }: any) => {
        if (error) console.error("Supabase RPC error (materials):", error);
        setTimeout(() => { isSavingRef.current = false; }, 500);
      });

      return next;
    });
  }, []);

  const updateListRpc = React.useCallback((listKey: "products" | "recipes" | "orders", itemsPatch: Record<string, any>) => {
    setData((prev) => {
      const list = (prev as any)[listKey] as any[];
      const next = { ...prev } as any;
      next[listKey] = list.map((item) => itemsPatch[item.id] ? itemsPatch[item.id] : item);
      const newItems = Object.entries(itemsPatch)
        .filter(([id]) => !list.find((item) => item.id === id))
        .map(([, item]) => item);
      if (newItems.length) next[listKey] = [...next[listKey], ...newItems];

      isSavingRef.current = true;
      supabase.rpc("update_list_items", {
        p_list_key: listKey,
        p_items: itemsPatch,
      }).then(({ error }: any) => {
        if (error) console.error(`Supabase RPC error (${listKey}):`, error);
        setTimeout(() => { isSavingRef.current = false; }, 500);
      });

      return next;
    });
  }, []);

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
    const waste = Math.min(Number(line.wastePercent || 0), 95) / 100;
    const adjustedAmount = waste > 0 ? line.amount / (1 - waste) : line.amount;
    if (line.itemType === "recipe") {
      const r = data.recipes.find((x) => x.id === line.itemId);
      if (!r) return sum;
      return sum + recipeUnitCost(r, [...visited, recipe.id]) * adjustedAmount;
    }
    const m = data.materials.find((x) => x.id === line.itemId);
    return sum + (m?.pricePerUnit || 0) * adjustedAmount;
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

  function productKgCost(product: Product, visited: string[] = []): number {
  if (visited.includes(product.id)) return 0;

  const lineCost = product.lines.reduce((sum, line) => {

       const amount = Number(line.amount || 0);
const waste = Math.min(Number(line.wastePercent || 0), 95) / 100;
const adjustedAmount = waste > 0 ? amount / (1 - waste) : amount;
    
if (line.itemType === "material") {
      const m = data.materials.find((x) => x.id === line.itemId);
      if (!m) return sum;

      return sum + adjustedAmount * (m.pricePerUnit || 0);
    }

    if (line.itemType === "recipe") {
      const r = data.recipes.find((x) => x.id === line.itemId);
      if (!r) return sum;

      return sum + recipeUnitCost(r) * adjustedAmount;
    }

    const p = data.products.find((x) => x.id === line.itemId);
    if (!p) return sum;

return sum + productKgCost(p, [...visited, product.id]) * adjustedAmount;
  }, 0);

  const packagingCost = product.packaging.reduce((sum, p) => {
    const pack = data.packaging.find((x) => x.id === p.packagingId);
    return sum + (pack?.price || 0) * Number(p.quantity || 0);
  }, 0);

  const totalCost = lineCost + packagingCost;

  const totalWeight = Number(product.recipeYieldAmount || 1);

  return totalWeight > 0 ? totalCost / totalWeight : totalCost;
}

function productUnitCost(product: Product, visited: string[] = []) {
  const kgPrice = productKgCost(product, visited);
  const unitWeight = Number(product.unitWeightKg || 1);

  return kgPrice * unitWeight;
}

function productCost(product: Product, visited: string[] = []) {
  return productUnitCost(product, visited);
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

  const tabConfig: { key: Tab; label: string; icon: string }[] = [
  { key: "dashboard",  label: "Startside",         icon: "📅" },
  { key: "materials",  label: "Råvarer",            icon: "🥕" },
  { key: "recipes",    label: "Grunnoppskrifter",   icon: "📖" },
  { key: "products",   label: "Produkter",          icon: "🍽" },
  { key: "orders",     label: "Ordre",              icon: "📋" },
  { key: "production", label: "Produksjon",         icon: "🥖" },
  { key: "inventory",  label: "Varetelling",        icon: "📦" },
  { key: "rental",     label: "Leie av lokale",     icon: "🏠" },
  { key: "settings",   label: "Innstillinger",      icon: "⚙️" },
];

return (
  <main style={{ minHeight: "100vh", background: "#f8fafc", color: "#0f172a" }}>
    {showUpdateBanner && (
      <div style={{ position: "sticky", top: 0, zIndex: 200, background: "#f59e0b", color: "white", padding: "10px 16px", display: "flex", justifyContent: "center", alignItems: "center", gap: 12, fontWeight: 700, fontSize: 14 }}>
        <span>⚠️ Ny versjon av appen er tilgjengelig. Last inn på nytt for å unngå at data overskrives.</span>
        <button onClick={() => window.location.reload()} style={{ background: "white", color: "#92400e", border: 0, borderRadius: 8, padding: "6px 14px", fontWeight: 800, cursor: "pointer" }}>Last inn på nytt</button>
      </div>
    )}
    <div style={{ maxWidth: 1400, margin: "0 auto", display: "flex", gap: 0 }}>

      {/* ── VENSTRE SIDEBAR (desktop) ── */}
      <aside className="sidebar">
        <div style={{ padding: "20px 14px 12px" }}>
          <img src="/logo.png" alt="Logo" style={{ width: "100%", maxWidth: 140, height: "auto", objectFit: "contain", display: "block", margin: "0 auto 20px" }} />
        </div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 2, padding: "0 8px" }}>
          {tabConfig.map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={tab === key ? "sidebar-btn active" : "sidebar-btn"}
            >
              <span className="sidebar-icon">{icon}</span>
              <span className="sidebar-label">{label}</span>
            </button>
          ))}
        </nav>
        <div style={{ marginTop: "auto", padding: "16px 8px" }}>
          <button
            className="sidebar-btn logout"
            onClick={async () => { await supabase.auth.signOut(); window.location.href = "/login"; }}
          >
            <span className="sidebar-icon">🚪</span>
            <span className="sidebar-label">Logg ut</span>
          </button>
        </div>
      </aside>

      {/* ── MOBILTOPP ── */}
      <div className="mobile-topbar">
        <img src="/logo.png" alt="Logo" style={{ height: 44, width: "auto", objectFit: "contain" }} />
        <select
          value={tab}
          onChange={(e) => setTab(e.target.value as Tab)}
          style={{ flex: 1, marginLeft: 10, fontSize: 15, padding: "8px 10px", borderRadius: 10, border: "1px solid #cbd5e1" }}
        >
          {tabConfig.map(({ key, label, icon }) => (
            <option key={key} value={key}>{icon} {label}</option>
          ))}
        </select>
        <button
          style={{ marginLeft: 8, padding: "8px 12px", borderRadius: 10, border: "1px solid #fca5a5", background: "#fef2f2", cursor: "pointer", fontSize: 14 }}
          onClick={async () => { await supabase.auth.signOut(); window.location.href = "/login"; }}
        >
          🚪
        </button>
      </div>

      {/* ── INNHOLD ── */}
      <div className="main-content">
        {tab === "dashboard"  && <CalendarDashboard data={data} updateData={updateData} setTab={setTab} />}
        {tab === "materials"  && <MaterialsTab data={data} updateData={updateData} updateMaterialsRpc={updateMaterialsRpc} />}
        {tab === "recipes"    && <RecipesTab data={data} updateData={updateData} updateListRpc={updateListRpc} recipeCost={recipeCost} recipeUnitCost={recipeUnitCost} recipeTotalAmount={recipeTotalAmount} recipeAllergens={recipeAllergens} />}
        {tab === "products"   && <ProductsTab data={data} updateData={updateData} updateListRpc={updateListRpc} recipeUnitCost={recipeUnitCost} productCost={productCost} productUnitCost={productUnitCost} productAllergens={productAllergens} recommendedPriceIncVat={recommendedPriceIncVat} />}
        {tab === "orders"     && <OrdersTab data={data} updateData={updateData} updateListRpc={updateListRpc} productAllergens={productAllergens} recipeAllergens={recipeAllergens} />}
        {tab === "production" && <ProductionTab data={data} updateData={updateData} />}
        {tab === "inventory"  && <InventoryTab data={data} updateData={updateData} productUnitCost={productUnitCost} updateInventoryRpc={updateInventoryRpc} />}
        {tab === "rental"     && <RentalTab data={data} updateData={updateData} />}
        {tab === "settings"   && <SettingsTab data={data} updateData={updateData} exportData={exportData} importData={importData} />}

        <footer style={{ display: "flex", justifyContent: "center", marginTop: 40, paddingBottom: 20, opacity: 0.85 }}>
          <img src="/mise-logo.png" alt="Misemetrics" style={{ width: 140, height: "auto" }} />
        </footer>
      </div>
    </div>

    <GlobalStyles />

    <style jsx global>{`
      /* ── SIDEBAR ── */
      .sidebar {
        width: 200px;
        min-width: 200px;
        background: white;
        border-right: 1px solid #e2e8f0;
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        position: sticky;
        top: 0;
        height: 100vh;
        overflow-y: auto;
      }
      .sidebar-btn {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        padding: 10px 12px;
        border: 0;
        border-radius: 10px;
        background: transparent;
        cursor: pointer;
        text-align: left;
        font-size: 14px;
        font-weight: 500;
        color: #374151;
        transition: background 0.15s;
      }
      .sidebar-btn:hover { background: #f1f5f9; }
      .sidebar-btn.active { background: #0f172a; color: white; }
      .sidebar-btn.logout { color: #b91c1c; }
      .sidebar-btn.logout:hover { background: #fef2f2; }
      .sidebar-icon { font-size: 18px; flex-shrink: 0; width: 24px; text-align: center; }
      .sidebar-label { font-size: 13px; }

      /* ── MAIN CONTENT ── */
      .main-content {
        flex: 1;
        min-width: 0;
        padding: 20px 20px 0;
      }

      /* ── MOBILTOPP ── */
      .mobile-topbar {
        display: none;
      }

     @media (max-width: 768px) {
  .sidebar { display: none; }
  
  /* Flytt topbar ut av flex-containeren visuelt */
  .mobile-topbar {
    display: flex;
    align-items: center;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 100;
    background: white;
    border-bottom: 1px solid #e2e8f0;
    padding: 8px 12px;
    width: 100%;
    box-shadow: 0 1px 4px rgba(0,0,0,0.08);
  }
  
  /* Skyv innhold ned slik at det ikke skjules bak topbar */
  .main-content {
    padding: 70px 10px 0;
    width: 100%;
    max-width: 100vw;
    overflow-x: hidden;
  }
  
  /* Hindre horisontal scrolling */
  body, main {
    overflow-x: hidden;
    max-width: 100vw;
  }
  
  /* Flex-container skal ikke scrolle horisontalt */
  div[style*="display: flex"] {
    max-width: 100vw;
  }
}
    `}</style>
  </main>
);
}

// ============================================================
// ERSTATNING FOR CalendarDashboard i app/page.tsx
// Finn: function CalendarDashboard(
// Erstatt frem til neste function med dette
// ============================================================

function CalendarDashboard({
  data,
  updateData,
  setTab,
}: {
  data: AppData;
  updateData: (p: Partial<AppData>) => void;
  setTab: (tab: Tab) => void;
}) {
  const todayDate = today();
  const [view, setView] = useState<"month" | "day">("month");
  const [selectedDate, setSelectedDate] = useState(todayDate);
  const [monthDate, setMonthDate] = useState(todayDate);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteText, setNoteText] = useState("");

  const monthStart = new Date(`${monthDate.slice(0, 7)}-01T12:00:00`);
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const days: string[] = [];
  const calendarStart = new Date(year, month, 1);
  calendarStart.setDate(calendarStart.getDate() - startOffset);
  for (let i = 0; i < 42; i++) {
    const d = new Date(calendarStart);
    d.setDate(calendarStart.getDate() + i);
    days.push(localDateKey(d));
  }

  function monthName(date: string) {
    return new Date(`${date.slice(0, 7)}-01T12:00:00`).toLocaleDateString("no-NO", { month: "long", year: "numeric" });
  }

  function localDateKey(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function changeMonth(delta: number) {
    const base = new Date(`${monthDate.slice(0, 7)}-01T12:00:00`);
    base.setMonth(base.getMonth() + delta);
    setMonthDate(localDateKey(base));
  }

  function easterDate(year: number) {
    const a = year % 19, b = Math.floor(year / 100), c = year % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mo = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, mo - 1, day, 12);
  }

  function dateKey(d: Date) { return localDateKey(d); }
  function addDaysDate(d: Date, days: number) { const next = new Date(d); next.setDate(next.getDate() + days); return next; }

  function norwegianHolidayName(date: string) {
    const y = Number(date.slice(0, 4));
    const easter = easterDate(y);
    const holidays: Record<string, string> = {
      [`${y}-01-01`]: "1. nyttårsdag",
      [`${y}-05-01`]: "Arbeidernes dag",
      [`${y}-05-17`]: "17. mai",
      [`${y}-12-25`]: "1. juledag",
      [`${y}-12-26`]: "2. juledag",
      [dateKey(addDaysDate(easter, -3))]: "Skjærtorsdag",
      [dateKey(addDaysDate(easter, -2))]: "Langfredag",
      [dateKey(easter)]: "1. påskedag",
      [dateKey(addDaysDate(easter, 1))]: "2. påskedag",
      [dateKey(addDaysDate(easter, 39))]: "Kristi himmelfartsdag",
      [dateKey(addDaysDate(easter, 49))]: "1. pinsedag",
      [dateKey(addDaysDate(easter, 50))]: "2. pinsedag",
    };
    return holidays[date] || "";
  }

  function dayOrders(date: string) {
    return data.orders.filter((o) => o.date === date && !o.deletedAt).sort((a, b) => (a.time || "").localeCompare(b.time || ""));
  }
  function isRentalOrder(order: Order) {
  return order.recurringNote?.startsWith("Leieavtale:");
}
  function dayNotes(date: string) { return (data.calendarNotes || []).filter((n) => n.date === date); }
  function hasProduction(date: string) { return Boolean(data.bakeryProductionDays?.[date]); }

  function hasUnseenWebshopOrder(date: string): boolean {
    const seenIds = data.seenOrderIds || [];
    return data.orders.some((o) => o.date === date && !o.deletedAt && o.recurringNote?.startsWith("Importert fra webshop") && !seenIds.includes(o.id));
  }

  function markOrdersAsSeen(date: string) {
    const seenIds = data.seenOrderIds || [];
    const newIds = data.orders.filter((o) => o.date === date && !o.deletedAt && o.recurringNote?.startsWith("Importert fra webshop") && !seenIds.includes(o.id)).map((o) => o.id);
    if (newIds.length) updateData({ seenOrderIds: [...seenIds, ...newIds] });
  }

  function addNote() {
    if (!noteTitle.trim() && !noteText.trim()) return;
    const next: CalendarNote = { id: `note-${Date.now()}`, date: selectedDate, title: noteTitle.trim() || "Notat", text: noteText.trim() };
    updateData({ calendarNotes: [next, ...(data.calendarNotes || [])] });
    setNoteTitle(""); setNoteText("");
  }
  function deleteNote(id: string) { updateData({ calendarNotes: (data.calendarNotes || []).filter((n) => n.id !== id) }); }

  const selectedOrders = dayOrders(selectedDate);
  const selectedNotes = dayNotes(selectedDate);
  const selectedProduction = data.bakeryProductionDays?.[selectedDate];

  function handleDayClick(date: string) {
    setSelectedDate(date);
    setView("day");
    markOrdersAsSeen(date);
  }

  return (
    <section>
      <div className="card">
        {/* Toppknapper */}
        <div className="between">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className={view === "month" ? "btn active" : "btn"} onClick={() => setView("month")}>Måned</button>
            <button className={view === "day" ? "btn active" : "btn"} onClick={() => setView("day")}>Dag</button>
            <button className="btn" onClick={() => { setSelectedDate(todayDate); setMonthDate(todayDate); }}>I dag</button>
          </div>
        </div>

        {view === "month" && (
          <>
            {/* Månednavigasjon – kompakt på mobil */}
            <div className="cal-month-nav">
              <button className="btn" onClick={() => changeMonth(-1)}>←</button>
              <h1 className="cal-month-title">{monthName(monthDate)}</h1>
              <button className="btn" onClick={() => changeMonth(1)}>→</button>
            </div>

            {/* DESKTOP: full kalender med navn og detaljer */}
            <div className="cal-desktop">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8, marginTop: 16 }}>
                {["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"].map((d) => (
                  <b key={d} style={{ padding: 8 }}>{d}</b>
                ))}
                {days.map((date) => {
                  const inMonth = date.slice(0, 7) === monthDate.slice(0, 7);
                  const orders = dayOrders(date);
                  const notes = dayNotes(date);
                  const production = hasProduction(date);
                  const dayOfWeek = new Date(`${date}T12:00:00`).getDay();
                  const isSunday = dayOfWeek === 0;
                  const isToday = date === todayDate;
                  const isPast = date < todayDate;
                  const holidayName = norwegianHolidayName(date);
                  const unseenWebshop = hasUnseenWebshopOrder(date);
const hasRental = orders.some((o) => isRentalOrder(o));
const dayBackground = isToday ? "#dcfce7" : holidayName || isSunday ? "#fee2e2" : hasRental ? "#fef9c3" : isPast ? "#f5efe3" : inMonth ? "white" : "#f1f5f9";                  return (
                    <button key={date} onClick={() => handleDayClick(date)}
                      style={{ minHeight: 110, textAlign: "left", padding: 10, borderRadius: 14, border: isToday ? "2px solid #166534" : unseenWebshop ? "2px solid #f59e0b" : holidayName ? "2px solid #dc2626" : "1px solid #dbe4ef", background: dayBackground, opacity: inMonth ? 1 : 0.55, cursor: "pointer", position: "relative" }}>
                      <b>{Number(date.slice(8, 10))}</b>
                      {unseenWebshop && <div style={{ position: "absolute", top: 8, right: 8, background: "#f59e0b", color: "white", borderRadius: "999px", width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900 }}>🔔</div>}
                      {holidayName && <div style={{ marginTop: 4, fontSize: 11, color: "#991b1b", fontWeight: 800 }}>{holidayName}</div>}
                      {production && <div style={{ marginTop: 6, fontSize: 12, fontWeight: 800 }}>🥖 Produksjon</div>}
                      {orders.slice(0, 3).map((o) => <div key={o.id} style={{ marginTop: 4, fontSize: 12 }}>{o.time || "--"} {o.customerType === "bedrift" ? o.companyName || o.customer : o.customer}</div>)}
                      {notes.slice(0, 2).map((n) => <div key={n.id} style={{ marginTop: 4, fontSize: 12, color: "#166534" }}>📝 {n.title}</div>)}
                      {orders.length + notes.length > 5 && <small>+ flere</small>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* MOBIL: kompakt 7-kolonne kalender – bare dato + indikatorer */}
            <div className="cal-mobile">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, marginTop: 12 }}>
                {["M", "T", "O", "T", "F", "L", "S"].map((d, i) => (
                  <b key={i} style={{ textAlign: "center", fontSize: 11, color: "#64748b", padding: "4px 0" }}>{d}</b>
                ))}
                {days.map((date) => {
                  const inMonth = date.slice(0, 7) === monthDate.slice(0, 7);
                  const orders = dayOrders(date);
                  const notes = dayNotes(date);
                  const production = hasProduction(date);
                  const dayOfWeek = new Date(`${date}T12:00:00`).getDay();
                  const isSunday = dayOfWeek === 0;
                  const isToday = date === todayDate;
                  const isPast = date < todayDate;
                  const holidayName = norwegianHolidayName(date);
                  const unseenWebshop = hasUnseenWebshopOrder(date);
                  const hasContent = orders.length > 0 || notes.length > 0 || production;

                  const hasRental = orders.some((o) => isRentalOrder(o));
const bg = isToday ? "#dcfce7"
  : holidayName || isSunday ? "#fee2e2"
  : hasRental ? "#fef9c3"
  : isPast && inMonth ? "#f5efe3"
  : "white";

                  const borderColor = isToday ? "#166534"
                    : unseenWebshop ? "#f59e0b"
                    : holidayName ? "#dc2626"
                    : hasContent ? "#94a3b8"
                    : "#e2e8f0";

                  const borderWidth = isToday || unseenWebshop || holidayName ? 2 : 1;

                  return (
                    <button key={date} onClick={() => handleDayClick(date)}
                      style={{
                        minHeight: 48,
                        borderRadius: 8,
                        border: `${borderWidth}px solid ${borderColor}`,
                        background: bg,
                        opacity: inMonth ? 1 : 0.35,
                        cursor: "pointer",
                        padding: "4px 2px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 2,
                        position: "relative",
                      }}>
                      <b style={{ fontSize: 13 }}>{Number(date.slice(8, 10))}</b>

                      {/* Indikatorer */}
                      <div style={{ display: "flex", gap: 2, flexWrap: "wrap", justifyContent: "center" }}>
                        {orders.length > 0 && (
                          <span style={{ background: "#3b82f6", color: "white", borderRadius: 999, fontSize: 9, fontWeight: 700, padding: "1px 4px", lineHeight: 1.4 }}>
                            {orders.length}
                          </span>
                        )}
                        {production && (
                          <span style={{ fontSize: 10 }}>🥖</span>
                        )}
                        {notes.length > 0 && (
                          <span style={{ fontSize: 10 }}>📝</span>
                        )}
                        {unseenWebshop && (
                          <span style={{ fontSize: 10 }}>🔔</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Ordreliste for valgt dato på mobil */}
              {(() => {
                const dateOrders = dayOrders(selectedDate);
                const dateNotes = dayNotes(selectedDate);
                const dateProd = data.bakeryProductionDays?.[selectedDate];
                const hasAnything = dateOrders.length > 0 || dateNotes.length > 0 || dateProd;
                if (!hasAnything) return (
                  <p style={{ color: "#64748b", marginTop: 14, textAlign: "center", fontSize: 13 }}>
                    Trykk på en dag for å se detaljer
                  </p>
                );
                return (
                  <div style={{ marginTop: 14, border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
                    <div style={{ background: "#f8fafc", padding: "10px 14px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <b style={{ fontSize: 14 }}>{formatDateNo(selectedDate)}</b>
                      <button className="btn" style={{ fontSize: 12, padding: "4px 10px" }} onClick={() => setView("day")}>Åpne dag →</button>
                    </div>
                    {dateProd && (
                      <div style={{ padding: "8px 14px", borderBottom: "1px solid #f1f5f9", fontSize: 13 }}>
                        🥖 <b>Produksjon registrert</b>
                      </div>
                    )}
                    {dateOrders.map((o) => (
                      <div key={o.id} style={{ padding: "8px 14px", borderBottom: "1px solid #f1f5f9", fontSize: 13 }} onClick={() => setTab("orders")}>
                        <b>{o.time || "--"}</b> {o.customerType === "bedrift" ? o.companyName || o.customer : o.customer}
                        <div style={{ color: "#64748b", fontSize: 11, marginTop: 2 }}>
                          {o.orderLines.map((l) => { const p = data.products.find((x) => x.id === l.productId); return `${l.quantity}×${p?.name || "?"}`; }).join(", ")}
                        </div>
                      </div>
                    ))}
                    {dateNotes.map((n) => (
                      <div key={n.id} style={{ padding: "8px 14px", borderBottom: "1px solid #f1f5f9", fontSize: 13, color: "#166534" }}>
                        📝 <b>{n.title}</b>{n.text ? ` – ${n.text}` : ""}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </>
        )}

        {view === "day" && (
          <div style={{ marginTop: 20 }}>
            {/* Dag-navigasjon på mobil */}
            <div className="between">
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button className="btn" onClick={() => {
                  const d = new Date(selectedDate + "T12:00:00");
                  d.setDate(d.getDate() - 1);
                  setSelectedDate(localDateKey(d));
                }}>←</button>
                <h2 style={{ margin: 0 }}>{formatDateNo(selectedDate)}</h2>
                <button className="btn" onClick={() => {
                  const d = new Date(selectedDate + "T12:00:00");
                  d.setDate(d.getDate() + 1);
                  setSelectedDate(localDateKey(d));
                }}>→</button>
              </div>
              <button className="btn" onClick={() => setView("month")}>Til måned</button>
            </div>

            <div className="grid two">
              <div className="soft-box">
                <h3>Produksjon</h3>
                {selectedProduction
                  ? <button className="btn active" onClick={() => setTab("production")}>Åpne dagens produksjon</button>
                  : <p style={{ color: "#64748b" }}>Ingen produksjonsordre registrert denne dagen.</p>}
              </div>

              <div className="soft-box">
                <h3>Ordre</h3>
                {selectedOrders.length ? (
                  <table>
                    <tbody>
                      {selectedOrders.map((o) => (
                        <tr key={o.id} className="click-row" onClick={() => setTab("orders")}>
                          <td>{o.time || "-"}</td>
                          <td>{o.customerType === "bedrift" || o.customerType === "storkjokken" ? o.companyName || o.customer : o.customer}</td>
                          <td>{o.orderLines.map((l) => { const p = data.products.find((x) => x.id === l.productId); return `${l.quantity} × ${p?.name || "Produkt"}`; }).join(", ")}</td>
                          {o.recurringNote?.startsWith("Importert fra webshop") && !(data.seenOrderIds || []).includes(o.id) && (
                            <td><span style={{ color: "#f59e0b", fontWeight: 900 }}>🔔 Ny</span></td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p style={{ color: "#64748b" }}>Ingen ordre denne dagen.</p>
                )}
              </div>
            </div>

            <div className="soft-box" style={{ marginTop: 16 }}>
              <h3>Huskelapper / notiser</h3>
              <div className="form-grid three">
                <input value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} placeholder="Tittel" />
                <input value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Notat" />
                <button className="btn active" onClick={addNote}>Legg til</button>
              </div>
              {selectedNotes.length ? (
                selectedNotes.map((n) => (
                  <div key={n.id} className="editable-row">
                    <div><b>{n.title}</b><br /><small>{n.text}</small></div>
                    <button className="link danger" onClick={() => deleteNote(n.id)}>Slett</button>
                  </div>
                ))
              ) : (
                <p style={{ color: "#64748b" }}>Ingen notater denne dagen.</p>
              )}
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        /* Månednavigasjon */
        .cal-month-nav {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 16px;
          gap: 8px;
        }
        .cal-month-title {
          text-transform: capitalize;
          font-size: 38px;
          font-weight: 900;
          margin: 0;
          text-align: center;
        }

        /* Desktop: full kalender */
        .cal-desktop { display: block; }
        .cal-mobile  { display: none; }

        @media (max-width: 768px) {
          .cal-desktop { display: none; }
          .cal-mobile  { display: block; }
          .cal-month-title { font-size: 22px; }
        }
      `}</style>
    </section>
  );
}

function MaterialsTab({ data, updateData, updateMaterialsRpc }: { data: AppData; updateData: (p: Partial<AppData>) => void; updateMaterialsRpc: (patch: Record<string, any>) => void }) {
  const blank = {
    id: "",
    name: "",
    supplier: "",
    category: data.materialCategories[0] || "Mat",
    unit: "kg" as Unit,
    packageSize: "1",
    packagePrice: "0",
    retailPrice: "",
    deliMargin: "",
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
    breadScaleType: "none" as Material["breadScaleType"],
breadScaleFlourPercent: "0",
  };

  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("Alle");
  const [materialPage, setMaterialPage] = useState(1);
  const [showRecentMaterials, setShowRecentMaterials] = useState(false);
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
      breadScaleType: m.breadScaleType || "none",
breadScaleFlourPercent: String(m.breadScaleFlourPercent || 0),
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
      breadScaleType:
  form.category === "Mel og frø"
    ? (form.breadScaleType as Material["breadScaleType"])
    : "none",

breadScaleFlourPercent:
  form.category === "Mel og frø"
    ? Number(form.breadScaleFlourPercent) || 0
    : 0,
      ingredients: form.ingredients
  .split(",")
  .map((x) => x.trim())
  .filter(Boolean),
      updatedAt: new Date().toISOString(),
      priceUpdatedAt: priceChanged ? new Date().toISOString() : oldMaterial?.priceUpdatedAt,
    };

    if (editingId) {
      updateMaterialsRpc({ [m.id]: m });
    } else {
      updateData({ materials: [m, ...data.materials] });
    }
    reset();
    setShowForm(false);
  }

  function updateMaterialInline(materialId: string, patch: Partial<Material>, priceChanged = false) {
    const existing = data.materials.find((m) => m.id === materialId);
    if (!existing) return;
    const updated = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
      priceUpdatedAt: priceChanged ? new Date().toISOString() : existing.priceUpdatedAt,
    };
    updateMaterialsRpc({ [materialId]: updated });
}

function defaultRetailMargin(category: string) {
  return data.settings.retailMargins?.[category] ?? 50;
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

      {["Deli", "Mineralvann", "Øl", "Vin", "Brennevin", "Cider"].includes(form.category) && (() => {
        const costExVat = (Number(form.packagePrice) || 0) / (Number(form.packageSize) || 1);
        const selectedMargin = Math.max(
  Number(form.deliMargin || defaultRetailMargin(form.category)),
  0
);
        const isAlcohol = ["Øl", "Vin", "Brennevin", "Cider"].includes(form.category);
        const isMineralvann = form.category === "Mineralvann";
        const alcoholVat = data.settings.alcoholVat ?? 25;
        const marginVatRate = isAlcohol ? alcoholVat : data.settings.foodVat;

        function suggestedFor(vatRate: number) {
          return selectedMargin >= 100 ? 0 : Math.ceil((costExVat / (1 - selectedMargin / 100)) * (1 + vatRate / 100));
        }

        const suggested15 = suggestedFor(data.settings.foodVat);
        const suggested25 = suggestedFor(alcoholVat);
        const suggestedIncVat = isAlcohol ? suggested25 : suggested15;

        const retailIncVat = Number(form.retailPrice) || 0;
        const retailExVat = exVatFromIncVat(retailIncVat, marginVatRate);
        const finalMargin = marginPercentFrom(retailExVat, costExVat);
        const finalFoodCost = foodCostPercentFrom(retailExVat, costExVat);

        return <div className="soft-box" style={{ gridColumn: "1 / -1" }}><h3>Deli / videresalg</h3><div className="form-grid four"><label>Ønsket fortjeneste %<input type="number" min="0" value={form.deliMargin || String(defaultRetailMargin(form.category))} onChange={(e) => setForm({ ...form, deliMargin: e.target.value })} /></label>{isMineralvann ? (<><Metric label="Anbefalt pris inkl. 15% mva (med seg)" value={currency(suggested15)} dark /><Metric label="Anbefalt pris inkl. 25% mva (i lokalet)" value={currency(suggested25)} dark /></>) : (<Metric label={`Anbefalt utsalgspris inkl. mva${isAlcohol ? " (25%)" : ""}`} value={currency(suggestedIncVat)} dark />)}<label>Valgt utsalgspris inkl. mva<input type="number" value={form.retailPrice} onChange={(e) => setForm({ ...form, retailPrice: e.target.value })} /></label>{isMineralvann ? (<div style={{ display: "flex", gap: 8 }}><button className="btn" type="button" onClick={() => setForm({ ...form, retailPrice: String(suggested15) })}>Bruk 15%-pris</button><button className="btn" type="button" onClick={() => setForm({ ...form, retailPrice: String(suggested25) })}>Bruk 25%-pris</button></div>) : (<button className="btn active" type="button" onClick={() => setForm({ ...form, retailPrice: String(suggestedIncVat) })}>Bruk anbefalt pris</button>)}</div><div className="metric-row"><Metric label="Innkjøpspris eks. mva / enhet" value={currency(costExVat)} /><Metric label={`Valgt pris eks. mva${isMineralvann ? " (ved 15%)" : ""}`} value={currency(retailExVat)} /><Metric label="Varekost" value={`${num(finalFoodCost, 1)} %`} /><Metric label="Fortjeneste" value={`${num(finalMargin, 1)} %`} tone={marginTone(finalMargin)} /></div></div>;
      })()}

      <label>
  Ingredienser i råvaren

  <input
    value={form.ingredients}
    onChange={(e) => setForm({ ...form, ingredients: e.target.value })}
    placeholder="F.eks. fløte, salt / vann, soyabønner, sukker"
  />
</label>
{form.category === "Mel og frø" && (
  <div className="form-grid two">
    <label>
      Brødskala-type
      <select
        value={form.breadScaleType}
        onChange={(e) => setForm({ ...form, breadScaleType: e.target.value as Material["breadScaleType"] })}
      >
        <option value="none">Ikke med i grovhet</option>
        <option value="sifted">Siktet mel</option>
        <option value="wholegrain">Sammalt/grovt mel</option>
        <option value="wholegrain_or_grain">Hele korn / kornflak</option>
        <option value="wheat_bran">Hvetekli</option>
        <option value="rye_bran">Rugkli</option>
        <option value="oat_bran">Havrekli</option>
      </select>
    </label>

    <label>
      Andel mel/korn/kli i råvaren %
      <input
        type="number"
        value={form.breadScaleFlourPercent}
        onChange={(e) => setForm({ ...form, breadScaleFlourPercent: e.target.value })}
        placeholder="100 for mel, 50 for surdeig"
      />
    </label>
  </div>
)}

      <h3>Allergier</h3>
      <div className="chips">{defaultAllergens.map((a) => { const arr = form.allergens.split(",").map((x) => x.trim()).filter(Boolean); const active = arr.includes(a); return <button key={a} type="button" className={active ? "btn active" : "btn"} onClick={() => setForm({ ...form, allergens: (active ? arr.filter((x) => x !== a) : [...arr, a]).join(", ") })}>{a}</button>; })}</div>
      <h3>Næring per 100g/ml</h3>
      <div className="form-grid five">{[["kj", "kJ"], ["kcal", "Kcal"], ["fat", "Fett"], ["saturatedFat", "Mettet fett"], ["protein", "Protein"], ["carbs", "Karbo"], ["sugars", "Sukkerarter"], ["addedSugar", "Tilsatt sukker"], ["fiber", "Kostfiber"], ["salt", "Salt"]].map(([k, label]) => <label key={k}>{label}<input type="number" value={(form as any)[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} /></label>)}</div>
      <label className="check"><input type="checkbox" checked={form.isWholegrain} onChange={(e) => setForm({ ...form, isWholegrain: e.target.checked })} /> Fullkorn/grov råvare</label>
      <button className="btn active" onClick={save}>Lagre</button><button className="btn" onClick={() => { reset(); setShowForm(false); }}>Avbryt</button>
    </div>}

    <input value={search} onChange={(e) => { setSearch(e.target.value); setMaterialPage(1); }} placeholder="Søk råvare / leverandør" />
    <div className="chips">{["Alle", ...data.materialCategories].filter((v, i, arr) => arr.indexOf(v) === i).map((cat) => <button key={cat} className={categoryFilter === cat ? "btn active" : "btn"} onClick={() => { setCategoryFilter(cat); setMaterialPage(1); }}>{cat}</button>)}</div>
    <button
        className={showRecentMaterials ? "btn active" : "btn"}
        onClick={() => setShowRecentMaterials(!showRecentMaterials)}
        style={{ marginBottom: 12 }}
      >
        🕐 Siste oppdaterte råvarer
      </button>

      {showRecentMaterials && (() => {
        const recent = [...data.materials]
          .filter((m) => !!m.updatedAt)
          .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""))
          .slice(0, 20);

        return (
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, marginBottom: 16, overflow: "hidden", background: "white" }}>
            <div style={{ background: "#0f172a", color: "white", padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <b style={{ fontSize: 14 }}>🕐 Siste {recent.length} oppdaterte råvarer</b>
              <button onClick={() => setShowRecentMaterials(false)} style={{ background: "transparent", border: 0, color: "white", cursor: "pointer", fontSize: 18 }}>×</button>
            </div>
            {recent.length === 0 ? (
              <p style={{ padding: 16, color: "#64748b" }}>Ingen råvarer oppdatert ennå.</p>
            ) : (
              <table style={{ marginTop: 0 }}>
                <thead>
                  <tr>
                    <th>Tidspunkt</th>
                    <th>Råvare</th>
                    <th>Kategori</th>
                    <th style={{ textAlign: "right" }}>Pris/enhet</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((m, i) => {
                    const d = new Date(m.updatedAt || "");
                    const dato = `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
                    const tid = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
                    return (
                      <tr key={m.id} style={{ background: i % 2 === 0 ? "white" : "#f8fafc" }}>
                        <td style={{ color: "#64748b", whiteSpace: "nowrap" }}>{dato} {tid}</td>
                        <td><b>{m.name}</b></td>
                        <td style={{ color: "#64748b" }}>{m.category}</td>
                        <td style={{ textAlign: "right", fontWeight: 700 }}>{currency(m.pricePerUnit)}/{m.unit}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        );
      })()}

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
<td>
  {["Deli", "Mineralvann", "Øl", "Vin", "Brennevin", "Cider"].includes(m.category) && m.retailPrice
    ? `${num(
        marginPercentFrom(
          exVatFromIncVat(Number(m.retailPrice), ["Øl", "Vin", "Brennevin", "Cider"].includes(m.category) ? (data.settings.alcoholVat ?? 25) : data.settings.foodVat),
          m.pricePerUnit
        ),
        1
      )} %`
    : "-"}
</td>      
<td>{(m.allergens || []).join(", ") || "-"}</td>
          <td><button className="btn" onClick={() => { edit(m); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Rediger</button><button style={{ marginLeft: 8 }} className="btn danger" onClick={() => { if (confirm("Slette råvaren?")) updateData({ materials: data.materials.filter((x) => x.id !== m.id) }); }}>Slett</button></td>
          <td>{m.priceUpdatedAt ? formatDateNo(m.priceUpdatedAt.slice(0, 10)) : "-"}</td>
        </tr>;
      })}</tbody>
    </table>
    <div className="pager"><button className="btn" disabled={materialPage <= 1} onClick={() => setMaterialPage(materialPage - 1)}>Forrige</button><span>Side {materialPage} av {totalPages}</span><button className="btn" disabled={materialPage >= totalPages} onClick={() => setMaterialPage(materialPage + 1)}>Neste</button></div>
  </section>;
}

function RecipesTab({ data, updateData, updateListRpc, recipeCost, recipeUnitCost, recipeTotalAmount, recipeAllergens }: { data: AppData; updateData: (p: Partial<AppData>) => void; updateListRpc: (listKey: "products" | "recipes" | "orders", itemsPatch: Record<string, any>) => void; recipeCost: (r: Recipe) => number; recipeUnitCost: (r: Recipe) => number; recipeTotalAmount: (r: Recipe) => number; recipeAllergens: (r: Recipe) => string[] }) {
  const [selectedId, setSelectedId] = useState(data.recipes[0]?.id || "");
  const [mode, setMode] = useState<"view" | "new" | "edit">("view");
  const [form, setForm] = useState({ productNumber: "", name: "", category: "Grunnoppskrift", yieldAmount: "1", yieldUnit: "kg" as YieldUnit });
  const [draftLines, setDraftLines] = useState<RecipeLine[]>([]);
  const [draftSteps, setDraftSteps] = useState<RecipeStep[]>([]);
  const [line, setLine] = useState({ itemType: "material" as "material" | "recipe", itemId: "", amount: "0", wastePercent: "", groupLabel: "" });
  const [lineSearch, setLineSearch] = useState("");
  const [recipeSearch, setRecipeSearch] = useState("");
  const [newStep, setNewStep] = useState<{ action: string; inputs: RecipeStepInput[] }>({ action: "", inputs: [] });
  const [showSteps, setShowSteps] = useState(false);

  const selected = data.recipes.find((r) => r.id === selectedId);
  const activeRecipe: Recipe | undefined = mode === "view" ? selected : {
    id: selected?.id || "draft",
    productNumber: form.productNumber,
    name: form.name || "Ny grunnoppskrift",
    category: form.category,
    yieldAmount: Number(form.yieldAmount) || 1,
    yieldUnit: form.yieldUnit,
    lines: draftLines,
    steps: draftSteps,
  };

  const filteredRecipes = data.recipes
    .filter((r) => `${r.productNumber} ${r.name} ${r.category}`.toLowerCase().includes(recipeSearch.toLowerCase()))
    .sort((a, b) => `${a.category} ${a.name}`.localeCompare(`${b.category} ${b.name}`, "no-NO"));

  function startNewRecipe() {
    setMode("new");
    setForm({ productNumber: "", name: "", category: "Grunnoppskrift", yieldAmount: "1", yieldUnit: "kg" });
    setDraftLines([]);
    setDraftSteps([]);
    setLine({ itemType: "material", itemId: "", amount: "0", wastePercent: "", groupLabel: "" });
    setLineSearch("");
    setNewStep({ action: "", inputs: [] });
  }

  function editRecipe(r: Recipe) {
    setSelectedId(r.id);
    setMode("edit");
    setForm({ productNumber: r.productNumber || "", name: r.name, category: r.category, yieldAmount: String(r.yieldAmount), yieldUnit: r.yieldUnit });
    setDraftLines(r.lines.map((l) => ({ ...l })));
    setDraftSteps((r.steps || []).map((s) => ({ ...s, inputs: s.inputs.map((i) => ({ ...i })) })));
    setLine({ itemType: "material", itemId: "", amount: "0", wastePercent: "", groupLabel: "" });
    setLineSearch("");
    setNewStep({ action: "", inputs: [] });
  }

  function cancelEdit() {
    setMode("view");
    setDraftLines([]);
    setDraftSteps([]);
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
      steps: draftSteps,
    };
    updateListRpc("recipes", { [recipe.id]: recipe });
    setSelectedId(recipe.id);
    setMode("view");
    setDraftLines([]);
    setDraftSteps([]);
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
    const waste = Math.min(Number(l.wastePercent || 0), 95) / 100;
    const adjustedAmount = waste > 0 ? l.amount / (1 - waste) : l.amount;
    if (l.itemType === "material") {
      const m = data.materials.find((x) => x.id === l.itemId);
      return adjustedAmount * (m?.pricePerUnit || 0);
    }
    const r = data.recipes.find((x) => x.id === l.itemId);
    return adjustedAmount * (r ? recipeUnitCost(r) : 0);
  }

  function addLine() {
    if (!line.itemId) return;
    if (line.itemType === "recipe" && line.itemId === selected?.id) {
      return alert("En grunnoppskrift kan ikke inneholde seg selv.");
    }
    setDraftLines((prev) => [
      ...prev,
      {
        itemType: line.itemType,
        itemId: line.itemId,
        amount: Number(line.amount) || 0,
        wastePercent: Number(line.wastePercent) || 0,
        groupLabel: line.groupLabel.trim() || undefined,
      },
    ]);
    setLine({ itemType: "material", itemId: "", amount: "0", wastePercent: "", groupLabel: "" });
    setLineSearch("");
  }

  function updateDraftLine(index: number, partial: Partial<RecipeLine>) {
    setDraftLines((prev) => prev.map((l, i) => i === index ? { ...l, ...partial } : l));
  }

  const groupOptions = Array.from(new Set(draftLines.map((l) => l.groupLabel).filter((g): g is string => !!g)));

  function toggleStepInput(kind: "group" | "step", ref: string) {
    setNewStep((prev) => {
      const exists = prev.inputs.some((i) => i.kind === kind && i.ref === ref);
      return { ...prev, inputs: exists ? prev.inputs.filter((i) => !(i.kind === kind && i.ref === ref)) : [...prev.inputs, { kind, ref }] };
    });
  }

  function addStep() {
    if (!newStep.action.trim() || !newStep.inputs.length) return;
    setDraftSteps((prev) => [...prev, { id: `step-${Date.now()}-${prev.length}`, action: newStep.action.trim(), inputs: newStep.inputs }]);
    setNewStep({ action: "", inputs: [] });
  }

  function removeStep(id: string) {
    setDraftSteps((prev) => prev.filter((s) => s.id !== id).map((s) => ({ ...s, inputs: s.inputs.filter((i) => !(i.kind === "step" && i.ref === id)) })));
  }

  function stepLabel(step: RecipeStep, steps: RecipeStep[]) {
    return step.inputs.map((inp) => inp.kind === "group" ? inp.ref : (steps.find((s) => s.id === inp.ref)?.action || "?")).join(" + ");
  }

  function printRecipe(recipe: Recipe) {
    const rows = recipe.lines.map((l) => {
      const name = lineItemName(l.itemType, l.itemId) || "Ukjent";
      const waste = l.wastePercent ? ` (${l.wastePercent}% svinn)` : "";
      return `<tr><td>${l.itemType === "material" ? "Råvare" : "Grunnoppskrift"}</td><td>${name}${waste}</td><td>${num(l.amount, 3)}</td><td>${currency(lineCost(l))}</td></tr>`;
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
      <section className="card product-editor-page">
        <div className="between">
          <h1>{mode === "edit" ? "Rediger grunnoppskrift" : "Ny grunnoppskrift"}</h1>
          <div>
            <button className="btn active" onClick={saveRecipe}>
              {mode === "edit" ? "Lagre endringer" : "Lagre grunnoppskrift"}
            </button>
            <button className="btn" onClick={cancelEdit}>Avbryt</button>
          </div>
        </div>

        <div className="form-grid four">
          <label>Produktnr<input value={form.productNumber} onChange={(e) => setForm({ ...form, productNumber: e.target.value })} placeholder="Produktnr" /></label>
          <label>Navn<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Navn" /></label>
          <label>Kategori<input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Kategori" /></label>
        </div>

        {activeRecipe && (
          <div className="metric-row">
            <Metric label="Total kost eks. mva" value={currency(recipeCost(activeRecipe))} dark />
            <Metric label="Totalvekt / yield" value={`${num(recipeTotalAmount(activeRecipe), 3)} ${form.yieldUnit}`} />
            <Metric label={`Pris per ${form.yieldUnit}`} value={currency(recipeUnitCost(activeRecipe))} dark />
            <Metric label="Allergener" value={recipeAllergens(activeRecipe).join(", ") || "Ingen"} />
          </div>
        )}

        <div className="soft-box">
          <h2>Ingredienser</h2>

          <div className="form-grid five">
            <select
              value={line.itemType}
              onChange={(e) => {
                setLine({ ...line, itemType: e.target.value as RecipeLine["itemType"], itemId: "" });
                setLineSearch("");
              }}
            >
              <option value="material">Råvare</option>
              <option value="recipe">Annen grunnoppskrift</option>
            </select>

            <div className="search-picker">
              <input
                value={lineSearch || lineItemName(line.itemType, line.itemId)}
                onChange={(e) => {
                  setLineSearch(e.target.value);
                  setLine({ ...line, itemId: "" });
                }}
                placeholder="Søk og velg"
              />
              {lineSearch && (
                <div className="search-dropdown inline">
                  {lineOptions(line.itemType, lineSearch).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="search-result"
                      onClick={() => {
                        setLine({ ...line, itemId: item.id });
                        setLineSearch("");
                      }}
                    >
                      <b>{item.name}</b>
                      <small>{item.subtitle}</small>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <input
              type="number"
              value={line.amount}
              onChange={(e) => setLine({ ...line, amount: e.target.value })}
              placeholder="Mengde"
            />

            <input
              type="number"
              value={line.wastePercent}
              onChange={(e) => setLine({ ...line, wastePercent: e.target.value })}
              placeholder="Svinn %"
            />

            <input
              value={line.groupLabel}
              onChange={(e) => setLine({ ...line, groupLabel: e.target.value })}
              placeholder="Gruppe (valgfritt)"
            />

            <button className="btn" onClick={addLine}>Legg til</button>
          </div>

          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Navn</th>
                <th>Mengde</th>
                <th>Svinn %</th>
                <th>Gruppe</th>
                <th>Kost</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {draftLines.map((l, i) => (
                <tr key={i}>
                  <td>
                    <select
                      value={l.itemType}
                      onChange={(e) => updateDraftLine(i, { itemType: e.target.value as RecipeLine["itemType"], itemId: "" })}
                    >
                      <option value="material">Råvare</option>
                      <option value="recipe">Grunnoppskrift</option>
                    </select>
                  </td>
                  <td>
                    <select value={l.itemId} onChange={(e) => updateDraftLine(i, { itemId: e.target.value })}>
                      <option value="">Velg</option>
                      {l.itemType === "material"
                        ? data.materials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)
                        : data.recipes.filter((r) => r.id !== selected?.id).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </td>
                  <td>
                    <input
                      type="number"
                      value={l.amount}
                      onChange={(e) => updateDraftLine(i, { amount: Number(e.target.value) || 0 })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={l.wastePercent || ""}
                      onChange={(e) => updateDraftLine(i, { wastePercent: Number(e.target.value) || 0 })}
                      placeholder="%"
                    />
                  </td>
                  <td>
                    <input
                      value={l.groupLabel || ""}
                      onChange={(e) => updateDraftLine(i, { groupLabel: e.target.value || undefined })}
                      placeholder="-"
                      style={{ minWidth: 100 }}
                    />
                  </td>
                  <td>{currency(lineCost(l))}</td>
                  <td>
                    <button className="link danger" onClick={() => setDraftLines((prev) => prev.filter((_, ix) => ix !== i))}>
                      Slett
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button className="btn" style={{ marginTop: 20 }} onClick={() => setShowSteps((v) => !v)}>
            {showSteps || draftSteps.length ? "Skjul fremgangsmåte" : "+ Legg til fremgangsmåte"}
          </button>
          {(showSteps || draftSteps.length > 0) && (
          <>
          <p style={{ color: "#64748b", fontSize: 13 }}>Sett en gruppe på linjene over (f.eks. "Eggedosis", "Bland"), lag så steg som kombinerer hele grupper og/eller tidligere steg.</p>
          <div className="form-grid two">
            <input
              value={newStep.action}
              onChange={(e) => setNewStep({ ...newStep, action: e.target.value })}
              placeholder="Handling, f.eks. bland, smelt, vend inn, stek"
            />
            <button className="btn" onClick={addStep}>Legg til steg</button>
          </div>
          <div className="chips" style={{ margin: "8px 0" }}>
            {groupOptions.map((g) => (
              <label key={`g-${g}`} className="check">
                <input type="checkbox" checked={newStep.inputs.some((i) => i.kind === "group" && i.ref === g)} onChange={() => toggleStepInput("group", g)} />
                {g}
              </label>
            ))}
            {draftSteps.map((s, i) => (
              <label key={`s-${s.id}`} className="check">
                <input type="checkbox" checked={newStep.inputs.some((i2) => i2.kind === "step" && i2.ref === s.id)} onChange={() => toggleStepInput("step", s.id)} />
                Steg {i + 1}: {s.action}
              </label>
            ))}
          </div>
          {!groupOptions.length && <p style={{ color: "#94a3b8", fontSize: 12 }}>Ingen grupper satt på linjene ennå.</p>}

          <table>
            <thead><tr><th>#</th><th>Handling</th><th>Kombinerer</th><th></th></tr></thead>
            <tbody>
              {draftSteps.map((s, i) => (
                <tr key={s.id}>
                  <td>{i + 1}</td>
                  <td>{s.action}</td>
                  <td>{stepLabel(s, draftSteps)}</td>
                  <td><button className="link danger" onClick={() => removeStep(s.id)}>Slett</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          </>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="grid two">
      <div className="card">
        <div className="between">
          <h2>Grunnoppskrifter</h2>
          <button className="btn active" onClick={startNewRecipe}>Ny grunnoppskrift</button>
        </div>
        <input value={recipeSearch} onChange={(e) => setRecipeSearch(e.target.value)} placeholder="Søk grunnoppskrift" />
        {filteredRecipes.map((r) => (
          <div key={r.id} className={selectedId === r.id ? "list active-list" : "list"}>
            <button className="plain" onClick={() => setSelectedId(r.id)}>
              <b>{r.name}</b><br />
              <small>{r.category} · {r.yieldAmount} {r.yieldUnit} · kost {currency(recipeCost(r))} · {currency(recipeUnitCost(r))}/{r.yieldUnit}</small>
            </button>
            <button className="link" onClick={() => editRecipe(r)}>Rediger</button>
            <button className="link danger" onClick={() => { if (confirm("Slette grunnoppskrift?")) updateData({ recipes: data.recipes.filter((x) => x.id !== r.id) }); }}>Slett</button>
          </div>
        ))}
      </div>
      <div className="card">
        {!selected ? <p>Velg eller opprett en grunnoppskrift.</p> : (
          <>
            <div className="between">
              <div>
                <h2>{selected.name}</h2>
                <p>{selected.category} · totalvekt {num(recipeTotalAmount(selected), 3)} {selected.yieldUnit}</p>
              </div>
              <div>
                <button className="btn" onClick={() => editRecipe(selected)}>Rediger</button>
                <button className="btn" onClick={() => printRecipe(selected)}>Print</button>
              </div>
            </div>
            <div className="metric-row">
              <Metric label="Total kost eks. mva" value={currency(recipeCost(selected))} dark />
              <Metric label="Totalvekt / yield" value={`${num(recipeTotalAmount(selected), 3)} ${selected.yieldUnit}`} />
              <Metric label={`Pris per ${selected.yieldUnit}`} value={currency(recipeUnitCost(selected))} dark />
              <Metric label="Allergener" value={recipeAllergens(selected).join(", ") || "Ingen"} />
            </div>
            <h3>Ingredienser</h3>
            <table>
              <thead>
                <tr><th>Type</th><th>Navn</th><th>Mengde</th><th>Svinn %</th><th>Kost</th></tr>
              </thead>
              <tbody>
                {selected.lines.map((l, i) => (
                  <tr key={i}>
                    <td>{l.itemType === "material" ? "Råvare" : "Grunnoppskrift"}</td>
                    <td>{lineItemName(l.itemType, l.itemId)}</td>
                    <td>{num(l.amount)}</td>
                    <td>{l.wastePercent ? `${l.wastePercent} %` : "-"}</td>
                    <td>{currency(lineCost(l))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </section>
  );
}

function hashCode(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

function ProductsTab({ data, updateData, updateListRpc, recipeUnitCost, productCost, productUnitCost, productAllergens, recommendedPriceIncVat }: { data: AppData; updateData: (p: Partial<AppData>) => void; updateListRpc: (listKey: "products" | "recipes" | "orders", itemsPatch: Record<string, any>) => void; recipeUnitCost: (r: Recipe) => number; productCost: (p: Product) => number; productUnitCost: (p: Product) => number; productAllergens: (p: Product) => string[]; recommendedPriceIncVat: (cost: number, margin: number) => number }) {
  const [selectedId, setSelectedId] = useState(data.products[0]?.id || "");
  const [mode, setMode] = useState<"view" | "new" | "edit">("view");
const [form, setForm] = useState({
  productNumber: getNextProductNumber("Søtbakst"),
  name: "",
  type: "bakst" as ProductType,
  subType: "" as ProductSubType,
  category: "Søtbakst",
  yieldAmount: "1",
  yieldUnit: "stk" as YieldUnit,
  recipeYieldAmount: "1",
unitWeightKg: "1",
  portionsPerWhole: "",
  customerPrice: "0",
  storkjokkenPriceExVat: "",
  targetMargin: "70",
  unitsPerCase: "",
});  const [draftLines, setDraftLines] = useState<ProductLine[]>([]);
  const [draftPackaging, setDraftPackaging] = useState<ProductPackagingLine[]>([]);
const [line, setLine] = useState<{
  itemType: ProductLine["itemType"];
  itemId: string;
  amount: string;
  unit: ProductLine["unit"];
  wastePercent: string;
  groupLabel: string;
}>({
  itemType: "material",
  itemId: "",
  amount: "0",
  unit: "kg",
  wastePercent: "",
  groupLabel: "",
});
const [lineSearch, setLineSearch] = useState("");
  const [editLineSearch, setEditLineSearch] = useState<Record<number, string>>({});
  const [packLine, setPackLine] = useState({ packagingId: "", quantity: "1" });
  const [draftMenuCourses, setDraftMenuCourses] = useState<MenuCourse[]>([]);
  const [newCourseName, setNewCourseName] = useState("");
  const [courseOptionSearch, setCourseOptionSearch] = useState<Record<string, string>>({});
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

function calculatedRecipeYieldAmount(lines: ProductLine[]) {
  return lines.reduce((sum, line) => {
    if (line.unit === "kg" || line.unit === "liter") {
      return sum + Number(line.amount || 0);
    }

    return sum;
  }, 0);
}
  const draftProduct: Product = {
    id: selected?.id || "draft",
productNumber: form.productNumber || getNextProductNumber(form.category),    name: form.name || "Nytt produkt",
    type: form.type,
    subType: form.subType,
    category: form.category,
    yieldAmount: Number(form.unitWeightKg) || 1,
    yieldUnit: form.yieldUnit,
    portionsPerWhole: form.portionsPerWhole ? Number(form.portionsPerWhole) : undefined,
    customerPrice: Number(form.customerPrice) || 0,
    storkjokkenPriceExVat: form.storkjokkenPriceExVat ? Number(form.storkjokkenPriceExVat) : undefined,
    targetMargin: Number(form.targetMargin) || 70,
    lines: draftLines,
    packaging: draftPackaging,
    recipeYieldAmount: calculatedRecipeYieldAmount(draftLines) || 1,
unitWeightKg: Number(form.unitWeightKg) || 0,
  unitsPerCase: Number(form.unitsPerCase) || undefined,
  menuCourses: form.type === "selskapsmeny" ? draftMenuCourses : undefined,
  };

  const activeProduct = mode === "view" ? selected : draftProduct;

  function priceIncVatFromCost(costExVat: number, marginPercent: number, vatRate: number) {
    const margin = Number(marginPercent || 0) / 100;
    if (margin >= 1) return 0;
    return Math.ceil((costExVat / (1 - margin)) * (1 + vatRate / 100));
  }

  function startNewProduct() {
    setMode("new");
setForm({
  productNumber: getNextProductNumber("Søtbakst"),
  name: "",
  type: "bakst",
  subType: "",
  category: "Søtbakst",
  yieldAmount: "1",
  yieldUnit: "stk",
  recipeYieldAmount: "1",
unitWeightKg: "1",
  portionsPerWhole: "",
  customerPrice: "0",
  storkjokkenPriceExVat: "",
  targetMargin: "70",
  unitsPerCase: "",
});    
setDraftLines([]);
    setDraftPackaging([]);
    setDraftMenuCourses([]);
    setLine({ itemType: "material", itemId: "", amount: "0", unit: "kg", wastePercent: "", groupLabel: "" });
    setLineSearch("");
  }

  function blankFor(type: ProductType) {
    const map: Record<ProductType, Partial<typeof form>> = {
      grunnoppskrift: { category: "Grunnoppskrift", yieldUnit: "kg", customerPrice: "0" },
      bakst: { category: "Søtbakst", yieldUnit: "stk" },
      cateringmeny: { category: "Cateringmeny", yieldUnit: "porsjoner" },
      pasmuurt: { category: "Påsmurt", yieldUnit: "stk" },
      egenprodusert: { category: "Egenprodusert", yieldUnit: "stk" },
      selskapsmeny: { category: "Selskapsmeny", yieldUnit: "porsjoner" },
    };
setForm((f) => {
  const next = { ...f, type, subType: "", ...(map[type] as any) };
  return {
    ...next,
    productNumber: mode === "new" ? getNextProductNumber(next.category || f.category) : f.productNumber,
  };
});  }

  function saveProduct() {
    if (!form.name.trim()) return alert("Legg inn produktnavn.");
    const product: Product = {
      ...draftProduct,
      id: mode === "edit" && selected ? selected.id : `${idFromName(form.name)}-${Date.now()}`,
      name: form.name.trim(),
      
    };
const exists =
  product.productNumber?.trim() &&
  data.products.some(
    (x) =>
      x.productNumber === product.productNumber &&
      x.id !== product.id
  );

if (exists) {
  return alert("Produktnummer finnes allerede!");
}

    updateListRpc("products", { [product.id]: product });

    setSelectedId(product.id);
    setMode("view");
  }

  function editProduct(p: Product) {
    setForm({
productNumber: p.productNumber || "",      name: p.name,
      type: p.type,
      subType: p.subType || "",
      category: p.category,
      yieldAmount: String(p.yieldAmount),
      yieldUnit: p.yieldUnit,
      recipeYieldAmount: String(p.recipeYieldAmount || 1),
unitWeightKg: String(p.unitWeightKg || p.yieldAmount || 1),
      portionsPerWhole: String(p.portionsPerWhole || ""),
      customerPrice: String(p.customerPrice || 0),
      storkjokkenPriceExVat: String(p.storkjokkenPriceExVat || ""),
      targetMargin: String(p.targetMargin || 70),
      unitsPerCase: String(p.unitsPerCase || ""),
    });
    setDraftLines(p.lines.map((l) => ({ ...l })));
    setDraftPackaging(p.packaging.map((x) => ({ ...x })));
    setDraftMenuCourses((p.menuCourses || []).map((c) => ({ ...c, options: c.options.map((o) => ({ ...o })) })));
    setSelectedId(p.id);
    setMode("edit");
  }

  function categoryPrefix(category: string) {
  const map: Record<string, string> = {
    "Brød": "BR",
    "Søtbakst": "BA",
    "Cateringmeny": "CA",
    "Påsmurt": "PA",
    "Egenprodusert": "EG",
    "Grunnoppskrift": "GR",
  };

  return map[category] || "PR"; // fallback
}

  function getNextProductNumber(category: string) {
  const prefix = categoryPrefix(category);

  const numbers = data.products
    .filter((p) => p.productNumber?.startsWith(prefix))
    .map((p) => p.productNumber.replace(prefix, ""))
    .map((n) => Number(n))
    .filter((n) => !isNaN(n));

  const next = numbers.length ? Math.max(...numbers) + 1 : 1;

  const LENGTH = 6;

  return prefix + String(next).padStart(LENGTH, "0");
}
function copyProduct(p: Product) {
  const copy: Product = {
    ...p,
    id: `${p.id}-copy-${Date.now()}`,
    productNumber: getNextProductNumber(p.category),
    name: `${p.name} kopi`,
    lines: p.lines.map((l) => ({ ...l })),
    packaging: p.packaging.map((x) => ({ ...x })),
  };

  // legg til i state
  updateListRpc("products", { [copy.id]: copy });

  setForm({
productNumber: copy.productNumber,    name: copy.name,
    type: copy.type,
    subType: copy.subType || "",
    category: copy.category,
    yieldAmount: String(copy.yieldAmount),
    yieldUnit: copy.yieldUnit,
    recipeYieldAmount: "1",
unitWeightKg: "1",
    portionsPerWhole: String(copy.portionsPerWhole || ""),
    customerPrice: String(copy.customerPrice || 0),
    storkjokkenPriceExVat: String(copy.storkjokkenPriceExVat || ""),
    targetMargin: String(copy.targetMargin || 70),
    unitsPerCase: String(copy.unitsPerCase || ""),
  });

  setDraftLines(copy.lines.map((l) => ({ ...l })));
  setDraftPackaging(copy.packaging.map((x) => ({ ...x })));

  setSelectedId(copy.id);
  setMode("edit");
}

  function updateDraftLine(index: number, partial: Partial<ProductLine>) {
    setDraftLines((prev) => prev.map((l, i) => i === index ? { ...l, ...partial } : l));
  }

  function groupBounds(lines: ProductLine[], index: number) {
    const label = lines[index].groupLabel;
    let start = index; let end = index;
    if (label) {
      while (start > 0 && lines[start - 1].groupLabel === label) start--;
      while (end < lines.length - 1 && lines[end + 1].groupLabel === label) end++;
    }
    return { start, end };
  }

  function isGroupFirstLine(lines: ProductLine[], index: number) {
    return groupBounds(lines, index).start === index;
  }

  function renameGroup(oldLabel: string, newLabel: string) {
    const trimmed = newLabel.trim();
    setDraftLines((prev) => prev.map((l) => (l.groupLabel === oldLabel ? { ...l, groupLabel: trimmed || undefined } : l)));
  }

  function moveGroup(index: number, direction: -1 | 1) {
    setDraftLines((prev) => {
      const { start, end } = groupBounds(prev, index);
      const block = prev.slice(start, end + 1);
      if (direction === -1) {
        if (start === 0) return prev;
        const { start: prevStart } = groupBounds(prev, start - 1);
        const prevBlock = prev.slice(prevStart, start);
        return [...prev.slice(0, prevStart), ...block, ...prevBlock, ...prev.slice(end + 1)];
      } else {
        if (end === prev.length - 1) return prev;
        const { end: nextEnd } = groupBounds(prev, end + 1);
        const nextBlock = prev.slice(end + 1, nextEnd + 1);
        return [...prev.slice(0, start), ...nextBlock, ...block, ...prev.slice(nextEnd + 1)];
      }
    });
  }

  function updateDraftPackaging(index: number, partial: Partial<ProductPackagingLine>) {
    setDraftPackaging((prev) => prev.map((p, i) => i === index ? { ...p, ...partial } : p));
  }

function addLine() {
  if (!line.itemId) return;
  if (line.itemType === "product" && line.itemId === selected?.id) {
    return alert("Et produkt kan ikke inneholde seg selv.");
  }

  setDraftLines((prev) => [
    ...prev,
    {
      itemType: line.itemType,
      itemId: line.itemId,
      amount: Number(line.amount) || 0,
      unit: line.unit,
      wastePercent: Number(line.wastePercent || 0),
      groupLabel: line.groupLabel.trim() || undefined,
    },
  ]);

  setLine({
    itemType: "material",
    itemId: "",
    amount: "0",
    unit: "kg",
    wastePercent: "0",
    groupLabel: line.groupLabel,
  });

  setLineSearch("");
}

  function addPackaging() {
    if (!packLine.packagingId) return;
    setDraftPackaging((prev) => [...prev, { packagingId: packLine.packagingId, quantity: Number(packLine.quantity) || 0 }]);
    setPackLine({ packagingId: "", quantity: "1" });
  }

  // ── Selskapsmeny: kurs/rettkategorier ───────────────────────────────────
  function addMenuCourse() {
    if (!newCourseName.trim()) return;
    setDraftMenuCourses((prev) => [...prev, { id: `course-${Date.now()}`, name: newCourseName.trim(), options: [] }]);
    setNewCourseName("");
  }

  function removeMenuCourse(courseId: string) {
    setDraftMenuCourses((prev) => prev.filter((c) => c.id !== courseId));
  }

  function addCourseOption(courseId: string, productId: string) {
    if (!productId) return;
    setDraftMenuCourses((prev) => prev.map((c) => {
      if (c.id !== courseId) return c;
      if (c.options.some((o) => o.productId === productId)) return c;
      return { ...c, options: [...c.options, { id: `opt-${Date.now()}`, productId }] };
    }));
    setCourseOptionSearch((prev) => ({ ...prev, [courseId]: "" }));
  }

  function removeCourseOption(courseId: string, optionId: string) {
    setDraftMenuCourses((prev) => prev.map((c) => c.id !== courseId ? c : { ...c, options: c.options.filter((o) => o.id !== optionId) }));
  }

  // Lønnsomhet for selskapsmeny: vis varekost%/margin basert på laveste, høyeste og gjennomsnittlig kost-alternativ per kurs
  function menuCourseCostRange(courses: MenuCourse[]): { min: number; max: number; avg: number } {
    if (!courses.length) return { min: 0, max: 0, avg: 0 };
    // For hver kombinasjon er det for mange permutasjoner å regne fullt ut - vi bruker i stedet
    // summen av (laveste kost per kurs) og summen av (høyeste kost per kurs) som min/max-grense,
    // og summen av gjennomsnittlig kost per kurs som "typisk" forventet kost.
    let minSum = 0, maxSum = 0, avgSum = 0;
    courses.forEach((course) => {
      const costs = course.options.map((o) => {
        const p = data.products.find((x) => x.id === o.productId);
        return p ? productUnitCost(p) : 0;
      });
      if (!costs.length) return;
      minSum += Math.min(...costs);
      maxSum += Math.max(...costs);
      avgSum += costs.reduce((s, c) => s + c, 0) / costs.length;
    });
    return { min: minSum, max: maxSum, avg: avgSum };
  }

  function lineCost(l: ProductLine) {
    const m = l.itemType === "material" ? data.materials.find((x) => x.id === l.itemId) : undefined;
    const r = l.itemType === "recipe" ? data.recipes.find((x) => x.id === l.itemId) : undefined;
    const p = l.itemType === "product" ? data.products.find((x) => x.id === l.itemId) : undefined;

    const waste = Math.min(Number(l.wastePercent || 0), 95) / 100;
    const adjustedAmount = waste > 0 ? l.amount / (1 - waste) : l.amount;

    if (l.itemType === "material") return adjustedAmount * (m?.pricePerUnit || 0);
    if (l.itemType === "recipe") return adjustedAmount * (r ? recipeUnitCost(r) : 0);
    return adjustedAmount * (p ? productUnitCost(p) : 0);
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
type BreadScaleTotals = {
  totalFlour: number;
  wholegrainEquivalent: number;
};

function addBreadScaleMaterial(
  totals: BreadScaleTotals,
  material: Material,
  amount: number,
  unit?: ProductLine["unit"] | YieldUnit
) {
  const type = material.breadScaleType || "none";
  if (type === "none") return;

  const amountInGrams = unit === "stk" || unit === "porsjoner" ? amount : amount * 1000;
  const flourPercent = Number(material.breadScaleFlourPercent ?? 100);
  const flourAmount = amountInGrams * (flourPercent / 100);

  if (flourAmount <= 0) return;

  totals.totalFlour += flourAmount;

  if (type === "wholegrain" || type === "wholegrain_or_grain") {
    totals.wholegrainEquivalent += flourAmount;
  }

  if (type === "wheat_bran") {
    totals.wholegrainEquivalent += flourAmount * 4.5;
  }

  if (type === "rye_bran") {
    totals.wholegrainEquivalent += flourAmount * 4;
  }

  if (type === "oat_bran") {
    totals.wholegrainEquivalent += flourAmount * 2;
  }
}

function recipeBreadScaleTotals(
  recipe: Recipe,
  multiplier = 1,
  totals: BreadScaleTotals = { totalFlour: 0, wholegrainEquivalent: 0 },
  visited: string[] = []
) {
  if (visited.includes(recipe.id)) return totals;

  recipe.lines.forEach((line) => {
    const amount = Number(line.amount || 0) * multiplier;

    if (line.itemType === "material") {
      const material = data.materials.find((m) => m.id === line.itemId);
      if (material) addBreadScaleMaterial(totals, material, amount);
    }

    if (line.itemType === "recipe") {
      const subRecipe = data.recipes.find((r) => r.id === line.itemId);
      if (subRecipe) recipeBreadScaleTotals(subRecipe, amount, totals, [...visited, recipe.id]);
    }
  });

  return totals;
}

function productBreadScaleTotals(
  product: Product,
  multiplier = 1,
  totals: BreadScaleTotals = { totalFlour: 0, wholegrainEquivalent: 0 },
  visited: string[] = []
) {
  if (visited.includes(product.id)) return totals;

  product.lines.forEach((line) => {
    const amount = Number(line.amount || 0) * multiplier;

    if (line.itemType === "material") {
      const material = data.materials.find((m) => m.id === line.itemId);
      if (material) addBreadScaleMaterial(totals, material, amount, line.unit);
    }

    if (line.itemType === "recipe") {
      const recipe = data.recipes.find((r) => r.id === line.itemId);
      if (recipe) recipeBreadScaleTotals(recipe, amount, totals);
    }

    if (line.itemType === "product") {
      const subProduct = data.products.find((p) => p.id === line.itemId);
      if (subProduct) productBreadScaleTotals(subProduct, amount, totals, [...visited, product.id]);
    }
  });

  return totals;
}

function calculateWholegrainPercent(product: Product) {
  const totals = productBreadScaleTotals(product);
  if (!totals.totalFlour) return 0;

  return Math.min(100, (totals.wholegrainEquivalent / totals.totalFlour) * 100);
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
  const wholegrainPercent = calculateWholegrainPercent(product);
const showWholegrain = product.category === "Brød" || product.subType === "brød";

  const w = window.open("", "_blank");
  if (!w) return;

w.document.write(`<!doctype html><html><head><meta charset="utf-8" /><title>Deklarasjon ${escapeHtml(product.name)}</title><style>
body{font-family:Arial,sans-serif;color:#111827;padding:32px}
.label{max-width:520px;border:2px solid #111827;padding:18px}
.logo-img{height:70px;width:auto;object-fit:contain;margin-bottom:10px}
h1{font-size:24px;margin:0 0 10px}
table{width:100%;border-collapse:collapse;margin-top:12px}
td,th{border-bottom:1px solid #d1d5db;padding:7px;text-align:left}
th{background:#f3f4f6}
@media print{
  button{display:none}
  body{padding:0}
}
</style></head><body>

<button onclick="window.print()">Print</button>

<div class="label">
  <img src="/logo.png" class="logo-img" />
  <h1>${escapeHtml(product.name)}</h1>

  <p><b>Ingredienser:</b> ${escapeHtml(ingredients)}</p>
  <p><b>Allergener:</b> ${escapeHtml(allergens)}</p>

  ${showWholegrain ? `<p><b>Grovhet:</b> ${num(wholegrainPercent, 0)} %</p>` : ""}

  <p><b>Næringsinnhold per 100 g/ml</b></p>

  <table>
    <tbody>
      <tr><td>Energi</td><td>${num(n.kj, 0)} kJ / ${num(n.kcal, 0)} kcal</td></tr>
      <tr><td>Fett</td><td>${num(n.fat, 1)} g</td></tr>
      <tr><td>– hvorav mettet fett</td><td>${num(n.saturatedFat, 1)} g</td></tr>
      <tr><td>Karbohydrater</td><td>${num(n.carbs, 1)} g</td></tr>
      <tr><td>– hvorav sukkerarter</td><td>${num(n.sugars, 1)} g</td></tr>
      <tr><td>Kostfiber</td><td>${num(n.fiber, 1)} g</td></tr>
      <tr><td>Protein</td><td>${num(n.protein, 1)} g</td></tr>
      <tr><td>Salt</td><td>${num(n.salt, 2)} g</td></tr>
    </tbody>
  </table>
</div>

</body></html>`);

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
    const isMenu = product.type === "selskapsmeny" && (product.menuCourses || []).length > 0;
    const rows = isMenu
      ? (product.menuCourses || []).map((course) => {
          const optionRows = course.options.map((opt) => {
            const p = data.products.find((x) => x.id === opt.productId);
            return `<tr><td>Alternativ</td><td>${escapeHtml(p?.name || "Ukjent")}</td><td>-</td><td>${currency(p ? productUnitCost(p) : 0)}</td></tr>`;
          }).join("");
          return `<tr><td colspan="4" style="background:#111827;color:white;font-weight:800;">${escapeHtml(course.name)}</td></tr>${optionRows}`;
        }).join("")
      : product.lines.map((l) => `<tr><td>${l.itemType}</td><td>${escapeHtml(lineItemName(l.itemType, l.itemId) || "Ukjent")}</td><td>${num(l.amount, 3)} ${l.unit}</td><td>${currency(lineCost(l))}</td></tr>`).join("");
    const allergens = productAllergens(product).join(", ") || "Ingen registrert";
    const priceExVat = exVatFromIncVat(product.customerPrice, data.settings.foodVat);
    const menuCostRange = isMenu ? menuCourseCostRange(product.menuCourses || []) : null;
    const totalCostDisplay = isMenu ? `${currency(menuCostRange!.min)} – ${currency(menuCostRange!.max)}` : currency(productCost(product));
    const unitCostForMargin = isMenu ? menuCostRange!.avg : productUnitCost(product);
    const w = window.open("", "_blank");
    if (!w) return;

    w.document.write(`<!doctype html><html><head><meta charset="utf-8" /><title>${escapeHtml(product.name)}</title><style>body{font-family:Arial,sans-serif;color:#111827;padding:36px;line-height:1.4}.top{border-bottom:3px solid #111827;padding-bottom:18px;margin-bottom:24px}.logo-img{height:120px;width:auto;object-fit:contain}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:18px 0}.metric{background:#f1f5f9;border-radius:12px;padding:12px}.metric b{display:block;font-size:20px;margin-top:4px}table{width:100%;border-collapse:collapse;margin-top:16px;margin-bottom:24px}th,td{border-bottom:1px solid #e5e7eb;padding:9px;text-align:left}th{background:#f3f4f6}@media print{button{display:none}body{padding:18px}}</style></head><body><button onclick="window.print()">Print</button><div class="top"><img src="/logo.png" class="logo-img" /><h1>${escapeHtml(product.name)}</h1><p>${escapeHtml(product.type)} · ${escapeHtml(product.category)}</p></div><div class="metrics"><div class="metric">Total kost eks. mva${isMenu ? " (min–max)" : ""}<b>${totalCostDisplay}</b></div><div class="metric">Kost per ${product.yieldUnit}${isMenu ? " (snitt)" : ""}<b>${currency(unitCostForMargin)}</b></div><div class="metric">Kundepris inkl. mva<b>${currency(product.customerPrice)}</b></div><div class="metric">Varekost / margin${isMenu ? " (snitt)" : ""}<b>${num(foodCostPercentFrom(priceExVat, unitCostForMargin), 1)}% / ${num(marginPercentFrom(priceExVat, unitCostForMargin), 1)}%</b></div></div><p><b>Allergener:</b> ${escapeHtml(allergens)}</p><h2>Innhold</h2><table><thead><tr><th>Type</th><th>Navn</th><th>Mengde</th><th>Kost</th></tr></thead><tbody>${rows}</tbody></table></body></html>`);
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
  function printProductPopup(product: Product) {
  const allergens = productAllergens(product).join(", ") || "Ingen registrert";
  const ingredients = productIngredients(product).join(", ") || "-";

  const rows = product.lines.map((line) => {
    const name = lineItemName(line.itemType, line.itemId) || "Ukjent";
    return `<tr><td>${escapeHtml(line.itemType)}</td><td>${escapeHtml(name)}</td><td>${num(line.amount, 3)} ${line.unit}</td><td>${currency(lineCost(line))}</td></tr>`;
  }).join("");

  const w = window.open("", "_blank");
  if (!w) return;

  w.document.write(`<!doctype html><html><head><meta charset="utf-8" /><title>${escapeHtml(product.name)}</title><style>
body{font-family:Arial,sans-serif;color:#111827;padding:32px}
.card{max-width:720px;border:2px solid #111827;padding:20px}
.logo{height:70px;width:auto;object-fit:contain;margin-bottom:10px}
h1{margin:0 0 10px;font-size:26px}
table{width:100%;border-collapse:collapse;margin-top:14px}
td,th{border-bottom:1px solid #d1d5db;padding:7px;text-align:left}
th{background:#f3f4f6}
@media print{button{display:none}body{padding:0}}
</style></head><body>
<button onclick="window.print()">Print</button>
<div class="card">
<img src="/logo.png" class="logo" />
<h1>${escapeHtml(product.name)}</h1>
<p><b>Kategori:</b> ${escapeHtml(product.category)}</p>
<p><b>Ingredienser:</b> ${escapeHtml(ingredients)}</p>
<p><b>Allergener:</b> ${escapeHtml(allergens)}</p>
<h3>Oppskrift / innhold</h3>
<table>
<thead><tr><th>Type</th><th>Navn</th><th>Mengde</th><th>Kost</th></tr></thead>
<tbody>${rows}</tbody>
</table>
</div>
</body></html>`);

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
  <label>Produktnr
    <input value={form.productNumber} onChange={(e) => setForm({ ...form, productNumber: e.target.value })} placeholder="Produktnr" />
  </label>

  <label>Navn
    <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Produktnavn" />
  </label>

  <label>Type
    <select value={form.type} onChange={(e) => blankFor(e.target.value as ProductType)}>
      <option value="grunnoppskrift">Grunnoppskrift</option>
      <option value="bakst">Bakst</option>
      <option value="cateringmeny">Cateringmeny</option>
      <option value="pasmuurt">Påsmurt</option>
      <option value="egenprodusert">Egenprodusert</option>
      <option value="selskapsmeny">Selskapsmeny</option>
    </select>
  </label>

  <label>Kategori
    <select
      value={form.category}
      onChange={(e) => {
        const category = e.target.value;
        setForm({
          ...form,
          category,
          productNumber: mode === "new"
            ? getNextProductNumber(category)
            : form.productNumber,
        });
      }}
    >
      {data.productCategories.map((c) => (
        <option key={c}>{c}</option>
      ))}
    </select>
  </label>

  <label>Total oppskriftsvekt (kg)
    <input
      type="number"
      value={calculatedRecipeYieldAmount(draftLines)}
      readOnly
      placeholder="Beregnes automatisk"
    />
  </label>

  <label>Vekt per stk (kg)
    <input
      type="number"
      className="highlight-input"
      value={form.unitWeightKg}
      onChange={(e) => setForm({ ...form, unitWeightKg: e.target.value })}
      placeholder="F.eks. 0.45"
    />
  </label>

  <label>Enhet
    <select value={form.yieldUnit} onChange={(e) => setForm({ ...form, yieldUnit: e.target.value as YieldUnit })}>
      <option value="stk">stk</option>
      <option value="porsjoner">porsjoner</option>
      <option value="kg">kg</option>
      <option value="liter">liter</option>
    </select>
  </label>

{["Kjøkken, egenprodusert", "Bakeri, egenprodusert"].includes(form.category) && (
    <label>Antall per eske
      <input
        type="number"
        value={form.unitsPerCase}
        onChange={(e) => setForm({ ...form, unitsPerCase: e.target.value })}
        placeholder="F.eks. 12"
      />
    </label>
  )}

  {form.type === "pasmuurt" && (
    <label>Deles på antall porsjoner
      <input
        type="number"
        value={form.portionsPerWhole}
        onChange={(e) => setForm({ ...form, portionsPerWhole: e.target.value })}
        placeholder="f.eks. 12"
      />
    </label>
  )}

  <label>Valgt kundepris inkl. mva
    <input type="number" value={form.customerPrice} onChange={(e) => setForm({ ...form, customerPrice: e.target.value })} />
  </label>

  <label>Storkjøkkenpris eks. mva
    <input type="number" value={form.storkjokkenPriceExVat} onChange={(e) => setForm({ ...form, storkjokkenPriceExVat: e.target.value })} placeholder="Valgfritt" />
  </label>

  <label>Målmargin %
    <input type="number" value={form.targetMargin} onChange={(e) => setForm({ ...form, targetMargin: e.target.value })} />
  </label>
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
                  <button key={item.id} type="button" className="search-result" onClick={() => { setLine({ ...line, itemId: item.id }); setLineSearch(""); }}>                      <b>{item.name}</b>
                      <small>{item.subtitle}</small>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <input type="number" value={line.amount} onChange={(e) => setLine({ ...line, amount: e.target.value })} placeholder="Mengde" />
            <input
  type="number"
  value={line.wastePercent}
  onChange={(e) => setLine({ ...line, wastePercent: e.target.value })}
  placeholder="Svinn %"
/>
           <select value={line.unit} onChange={(e) => setLine({ ...line, unit: e.target.value as ProductLine["unit"] })}>
              <option value="kg">kg</option>
              <option value="liter">liter</option>
              <option value="stk">stk</option>
              <option value="porsjoner">porsjoner</option>
            </select>
            <input
              value={line.groupLabel}
              onChange={(e) => setLine({ ...line, groupLabel: e.target.value })}
              placeholder="Gruppe i produksjon (valgfritt), f.eks. Albondigas"
            />
            <button className="btn" onClick={addLine}>Legg til</button>
          </div>
          <p style={{ color: "#64748b", fontSize: 13, marginTop: -6 }}>
            Bruk samme gruppenavn på flere linjer (f.eks. "Albondigas") for å samle dem under en egen overskrift i produksjonsgrunnlaget. Stå tomt for vanlig flat liste.
          </p>

         <table className="compact-lines">
            <thead>
  <tr>
    <th>Type</th>
    <th>Navn</th>
    <th>Mengde</th>
    <th>Svinn %</th>
    <th>Enhet</th>
    <th>Kost</th>
    <th></th>
  </tr>
</thead>
            <tbody>
              {draftLines.map((l, i) => (
                <React.Fragment key={i}>
                {isGroupFirstLine(draftLines, i) && l.groupLabel && (
                  <tr style={{ background: Math.abs(hashCode(l.groupLabel)) % 2 === 0 ? "#e2e8f0" : "#c7d2fe", borderTop: i > 0 ? "3px solid #94a3b8" : undefined }}>
                    <td colSpan={7} style={{ padding: "6px 10px" }}>
                      <input
                        value={l.groupLabel}
                        onChange={(e) => renameGroup(l.groupLabel!, e.target.value)}
                        style={{ fontWeight: 700, fontSize: 14, border: "none", background: "transparent", width: "100%", outline: "none" }}
                        placeholder="Gruppenavn"
                      />
                    </td>
                  </tr>
                )}
                <tr style={{ background: l.groupLabel ? (Math.abs(hashCode(l.groupLabel)) % 2 === 0 ? "#f8fafc" : "#eef2ff") : "white", borderTop: isGroupFirstLine(draftLines, i) && i > 0 && !l.groupLabel ? "3px solid #94a3b8" : undefined }}>
                  <td>
                    <select value={l.itemType} onChange={(e) => updateDraftLine(i, { itemType: e.target.value as ProductLine["itemType"], itemId: "" })}>
                      <option value="material">Råvare</option>
                      <option value="recipe">Grunnoppskrift</option>
                      <option value="product">Produkt</option>
                    </select>
                  </td>
                  <td>
                    <div className="search-picker">
                      <input
                        value={editLineSearch[i] ?? lineItemName(l.itemType, l.itemId)}
                        onChange={(e) => setEditLineSearch({ ...editLineSearch, [i]: e.target.value })}
                        onFocus={() => setEditLineSearch({ ...editLineSearch, [i]: "" })}
                        placeholder="Søk og velg"
                      />
                      {editLineSearch[i] !== undefined && editLineSearch[i] !== "" && (
                        <div className="search-dropdown inline">
                          {lineOptions(l.itemType, editLineSearch[i]).map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              className="search-result"
                              onClick={() => {
                                updateDraftLine(i, { itemId: item.id });
                                const next = { ...editLineSearch };
                                delete next[i];
                                setEditLineSearch(next);
                              }}
                            >
                              <b>{item.name}</b>
                              <small>{item.subtitle}</small>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                  <td><input type="number" value={l.amount} onChange={(e) => updateDraftLine(i, { amount: Number(e.target.value) || 0 })} /></td>
                  <td>
  <input
    type="number"
    value={(l as any).wastePercent || ""}
    onChange={(e) =>
      updateDraftLine(i, { wastePercent: Number(e.target.value) || 0 })
    }
    placeholder="%"
  />
</td>
                  <td><select value={l.unit} onChange={(e) => updateDraftLine(i, { unit: e.target.value as ProductLine["unit"] })}><option value="kg">kg</option><option value="liter">liter</option><option value="stk">stk</option><option value="porsjoner">porsjoner</option></select></td>
                  <td>{currency(lineCost(l))}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button className="link danger" onClick={() => setDraftLines((prev) => prev.filter((_, ix) => ix !== i))}>Slett</button>
                    {isGroupFirstLine(draftLines, i) && (
                      <>
                        <button className="btn" style={{ marginLeft: 6, fontSize: 15, padding: "4px 10px" }} disabled={i === 0} onClick={() => moveGroup(i, -1)} title="Flytt gruppe opp">↑</button>
                        <button className="btn" style={{ marginLeft: 4, fontSize: 15, padding: "4px 10px" }} disabled={i === draftLines.length - 1} onClick={() => moveGroup(i, 1)} title="Flytt gruppe ned">↓</button>
                      </>
                    )}
                  </td>
                </tr>
                </React.Fragment>
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

        {form.type === "selskapsmeny" && (() => {
          const costRange = menuCourseCostRange(draftMenuCourses);
          const priceExVat = exVatFromIncVat(Number(form.customerPrice) || 0, data.settings.foodVat);
          const minMargin = marginPercentFrom(priceExVat, costRange.min);
          const maxMargin = marginPercentFrom(priceExVat, costRange.max);
          const avgMargin = marginPercentFrom(priceExVat, costRange.avg);
          return (
            <div className="soft-box">
              <h2>Meny-oppbygging (forrett/hovedrett/dessert)</h2>
              <p style={{ color: "#64748b", fontSize: 13 }}>
                Bygg menyen av rettkategorier. Hver kategori kan ha flere alternativer (eksisterende kalkulerte produkter).
                Ved bestilling kan kunden velge hvilket alternativ som gjelder, og produksjonsgrunnlaget regnes ut fra faktisk valg.
              </p>

              <div className="form-grid three">
                <input value={newCourseName} onChange={(e) => setNewCourseName(e.target.value)} placeholder="Ny rettkategori, f.eks. Forrett" />
                <button className="btn active" onClick={addMenuCourse}>Legg til rettkategori</button>
                <div />
              </div>

              {draftMenuCourses.map((course) => (
                <div key={course.id} className="soft-box" style={{ background: "white" }}>
                  <div className="between">
                    <h3>{course.name}</h3>
                    <button className="link danger" onClick={() => removeMenuCourse(course.id)}>Slett kategori</button>
                  </div>

                  <div className="search-picker">
                    <input
                      value={courseOptionSearch[course.id] || ""}
                      onChange={(e) => setCourseOptionSearch((prev) => ({ ...prev, [course.id]: e.target.value }))}
                      placeholder="Søk opp produkt å legge til som alternativ"
                    />
                    {courseOptionSearch[course.id] && (
                      <div className="search-dropdown inline">
                        {data.products
                          .filter((p) => p.id !== selected?.id && p.type !== "selskapsmeny")
                          .filter((p) => p.name.toLowerCase().includes((courseOptionSearch[course.id] || "").toLowerCase()))
                          .slice(0, 12)
                          .map((p) => (
                            <button key={p.id} type="button" className="search-result" onClick={() => addCourseOption(course.id, p.id)}>
                              <b>{p.name}</b>
                              <small>{p.category} · {currency(productUnitCost(p))}/{p.yieldUnit}</small>
                            </button>
                          ))}
                      </div>
                    )}
                  </div>

                  <table>
                    <thead><tr><th>Alternativ</th><th>Kost/enhet</th><th></th></tr></thead>
                    <tbody>
                      {course.options.map((opt) => {
                        const p = data.products.find((x) => x.id === opt.productId);
                        return (
                          <tr key={opt.id}>
                            <td>{p?.name || "Ukjent produkt"}</td>
                            <td>{currency(p ? productUnitCost(p) : 0)}</td>
                            <td><button className="link danger" onClick={() => removeCourseOption(course.id, opt.id)}>Slett</button></td>
                          </tr>
                        );
                      })}
                      {course.options.length === 0 && <tr><td colSpan={3} style={{ color: "#64748b" }}>Ingen alternativer lagt til ennå.</td></tr>}
                    </tbody>
                  </table>
                </div>
              ))}

              {draftMenuCourses.length > 0 && (
                <div className="metric-row">
                  <Metric label="Laveste varekost (kost-effektivt valg)" value={currency(costRange.min)} />
                  <Metric label="Høyeste varekost (dyreste valg)" value={currency(costRange.max)} />
                  <Metric label="Typisk varekost (snitt)" value={currency(costRange.avg)} dark />
                  <Metric label="Margin ved typisk valg" value={`${num(avgMargin, 1)} %`} tone={marginTone(avgMargin)} />
                </div>
              )}
              {draftMenuCourses.length > 0 && (
                <p style={{ color: "#64748b", fontSize: 13 }}>
                  Med fast pris {currency(Number(form.customerPrice) || 0)} blir margin mellom {num(minMargin, 1)}% (dyreste valg) og {num(maxMargin, 1)}% (billigste valg), typisk {num(avgMargin, 1)}%.
                </p>
              )}
            </div>
          );
        })()}
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
              <td>{p.type === "selskapsmeny" ? (() => { const r = menuCourseCostRange(p.menuCourses || []); return `${currency(r.min)} – ${currency(r.max)}`; })() : currency(productUnitCost(p))}</td>
              <td>{currency(p.customerPrice)}</td>
              <td>{p.storkjokkenPriceExVat ? currency(p.storkjokkenPriceExVat) : "-"}</td>
              <td>
                <button className="btn" onClick={() => printProductPopup(p)}>
  Se oppskrift
</button>
<button className="btn" onClick={() => printNutritionLabel(p)}>
  Deklarasjon
</button>
<button className="btn" onClick={() => editProduct(p)}>
  Rediger
</button>
<button className="btn" onClick={() => copyProduct(p)}>Kopier</button>
<button className="btn" onClick={() => printProduct(p)}>
  Print
</button>
<button
  className="btn"
  style={{
    background: "#dc2626",
    color: "white",
    borderColor: "#dc2626",
  }}
  onClick={() => {
    if (!confirm(`Sikker på at du vil slette "${p.name}"?`)) {
      return;
    }

    const usedInOrders = data.orders.some((order) =>
      (order.orderLines || []).some((line) => line.productId === p.id)
    );

    if (usedInOrders) {
      alert("Produktet brukes i ordre og kan ikke slettes.");
      return;
    }

    updateData({
      products: data.products.filter((x) => x.id !== p.id),
    });
  }}
>
  Slett
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
            <button className="btn" onClick={() => copyProduct(wideProduct)}>
  Kopier
</button>
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
  if (digits.length === 3) return `Kl ${digits.slice(0, 1)}:${digits.slice(1).padEnd(2, "0")}`;
  return `Kl ${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
}
function cleanWebshopText(raw: string): string {
  return raw
    .replace(/\[https?:\/\/[^\]]*\]/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/<mailto:[^>]*>/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseNorwegianDateGlobal(text: string): { date: string; time: string } {
  const months: Record<string, string> = {
    januar: "01", februar: "02", mars: "03", april: "04", mai: "05", juni: "06",
    juli: "07", august: "08", september: "09", oktober: "10", november: "11", desember: "12",
    jan: "01", feb: "02", mar: "03", apr: "04", jun: "06",
    jul: "07", aug: "08", sep: "09", okt: "10", nov: "11", des: "12",
    "jan.": "01", "feb.": "02", "mar.": "03", "apr.": "04", "jun.": "06",
    "jul.": "07", "aug.": "08", "sep.": "09", "okt.": "10", "nov.": "11", "des.": "12",
  };

  // Støtter tidsintervall som 18:15-18:30 – henter bare starttid
  const match = text.match(
    /(?:mandag|tirsdag|onsdag|torsdag|fredag|lørdag|søndag)?\s*(\d{1,2})[.\s]+([a-zæøå.]+)[.\s]+(\d{1,2}:\d{2})(?:-\d{1,2}:\d{2})?/i
  );
  if (!match) return { date: today(), time: "" };

  const day = match[1].padStart(2, "0");
  const monthRaw = match[2].toLowerCase().replace(/\.$/, "");
  const month = months[monthRaw] || months[match[2].toLowerCase()] || "01";
  const year = new Date().getFullYear();
  return { date: `${year}-${month}-${day}`, time: match[3] };
}

function OrdersTab({ data, updateData, updateListRpc, productAllergens, recipeAllergens }: {
  updateListRpc: (listKey: "products" | "recipes" | "orders", itemsPatch: Record<string, any>) => void;
  data: AppData;
  updateData: (p: Partial<AppData>) => void;
  productAllergens: (p: Product, visited?: string[]) => string[];
  recipeAllergens: (r: Recipe) => string[];
}) {
  const emptyOrder = (): Order => ({
    id: "", orderNumber: "", type: "catering", customerType: "privat", customer: "",
    companyName: "", orgNumber: "", companyAddress: "", phone: "", deliveryAddress: "",
    date: today(), time: "", note: "", paymentInfo: "", guests: 10,
    productId: data.products[0]?.id || "", orderLines: [], discountPercent: 0,
    isRecurring: false, recurringDays: [], recurringNote: "",
    allergens: Object.fromEntries(defaultAllergens.map((a) => [a, 0])),
    dietVegan: "0", dietVegetarian: "0", dietPregnant: "0", dietOther: "",
  });

  const todayStr = today();

  const [form, setForm] = useState<Order>(emptyOrder());
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [lineToAdd, setLineToAdd] = useState({ productId: "", quantity: 1 });
  const [addProductSearch, setAddProductSearch] = useState("");
  const [menuSelectionDraft, setMenuSelectionDraft] = useState<Record<string, { productId: string; guestCount: number }[]>>({});
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [showWebshopImport, setShowWebshopImport] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [webshopRawText, setWebshopRawText] = useState("");
  const [webshopPreview, setWebshopPreview] = useState<Order | null>(null);
  const [webshopUnmatched, setWebshopUnmatched] = useState<string[]>([]);
  const [orderSearch, setOrderSearch] = useState("");
  const [sortField, setSortField] = useState<"date" | "customer" | "orderNumber">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [orderPage, setOrderPage] = useState(1);
  const [showTodayOnly, setShowTodayOnly] = useState(false);
  const [hideOldOrders, setHideOldOrders] = useState(true);
  const [calendarView, setCalendarView] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(todayStr.slice(0, 7));
  const [calendarSelectedDate, setCalendarSelectedDate] = useState(todayStr);

  const pageSize = 30;

  function parseWebshopOrder() {
    const text = cleanWebshopText(webshopRawText);
    const lines = text.split(/\n/).map((x) => x.trim()).filter(Boolean);

    const orderNumberMatch = text.match(/Bestilling\s+(\d{4,})/i) || text.match(/\b(\d{6,})\b/);
    const orderNumber = orderNumberMatch?.[1] || String(Date.now());

    const phoneRaw =
      text.match(/Telefon:\s*(\+?[\d\s]{8,})/i)?.[1]?.trim() ||
      text.match(/Kundeinformasjon[\s\S]*?(\+47[\d\s]{8,})/i)?.[1]?.trim() || "";
    const phoneMatch = phoneRaw.replace(/\s+/g, "");

    const deliveryMatch = text.match(/Når:\s*(.+)/i);
    const dateInfo = parseNorwegianDateGlobal(deliveryMatch?.[1] || text);

    const deliveryAddress =
      text.match(/Adresse:\s*(.+)/i)?.[1]?.trim() ||
      text.match(/Hentested:\s*(.+)/i)?.[1]?.trim() ||
      "Hentes i butikk";

    let customer = "";
    let companyName = "";

    const navnLine = text.match(/Navn:\s*(.+)/i)?.[1]?.trim() || "";
    if (navnLine.includes("/")) {
      const parts = navnLine.split("/").map((s) => s.trim());
      companyName = parts[0] || "";
      customer = parts[1] || "";
    } else {
      customer = navnLine;
    }

    const idx = lines.findIndex((l) => /kundeinformasjon/i.test(l));
    if (idx >= 0) {
      const line1 = lines[idx + 1] || "";
      const line2 = lines[idx + 2] || "";
      if (!companyName && line1 === line1.toUpperCase() && line1.length > 3) {
        companyName = line1;
        if (!customer) customer = line2;
      } else if (!customer) {
        customer = line1;
      }
    }

    const driverNote =
      text.match(/Beskjed til sjåfør:\s*([\s\S]*?)(?:\n\n|\nKundeinformasjon|\nHusk)/i)?.[1]?.trim() || "";

    const erBetaltPaaNett = /ikke ta imot betaling/i.test(text);
    const erFaktura = /faktura|etterskudd|ved henting|kontant/i.test(text);
    const paymentInfo = erBetaltPaaNett
      ? "Betalt på nett"
      : erFaktura ? "Faktura / betaling ved henting" : "Betalt på nett";

    const nextUnmatched: string[] = [];
    const orderLines: OrderLine[] = [];

    const productCodeMap = new Map(
      data.products
        .filter((p) => p.productNumber)
        .map((p) => [p.productNumber!.toLowerCase(), p])
    );

    for (let i = 0; i < lines.length; i++) {
      const codeMatch = lines[i].match(/\b([A-ZÆØÅ]{1,4}\d{4,})\b/i);
      if (!codeMatch) continue;

      const productCode = codeMatch[1];
      const product = productCodeMap.get(productCode.toLowerCase());

      if (!product) {
        nextUnmatched.push(productCode);
        continue;
      }

      let quantity = 1;
      const nextLines = lines.slice(i + 1, i + 7);
      for (let j = 0; j < nextLines.length; j++) {
        const l = nextLines[j].trim();
        if (/\b[A-ZÆØÅ]{1,4}\d{4,}\b/i.test(l)) break;
        if (/^\d+$/.test(l)) { quantity = Number(l); break; }
        const firstNum = l.match(/^(\d+)\s+[\d\s]+[,.]?\d*/);
        if (firstNum) { quantity = Number(firstNum[1]); break; }
      }

      orderLines.push({ productId: product.id, quantity });
    }

    const uniqueLines = Object.values(
      orderLines.reduce((acc, line) => {
        if (!acc[line.productId] || line.quantity > acc[line.productId].quantity)
          acc[line.productId] = line;
        return acc;
      }, {} as Record<string, OrderLine>)
    );

    const allergyNote =
      text.match(/Tilpasse til allergier[^\n]*\n([^\n]+)/i)?.[1]?.trim() ||
      text.match(/Allergi[^:]*:\s*(.+)/i)?.[1]?.trim() || "";

    const unmatchedNote = nextUnmatched.length
      ? `Ikke matchet produktkode:\n${nextUnmatched.join(", ")}` : "";

    const note = [driverNote, allergyNote ? `Allergier (fra bestilling): ${allergyNote}` : "", unmatchedNote]
      .filter(Boolean).join("\n\n");

    const nextOrder: Order = {
      id: `webshop-${orderNumber}-${Date.now()}`,
      orderNumber, type: "catering",
      customerType: companyName ? "bedrift" : "privat",
      customer: customer || "Webshopkunde",
      companyName, orgNumber: "", companyAddress: "",
      phone: phoneMatch, paymentInfo, deliveryAddress,
      date: dateInfo.date, time: dateInfo.time, note,
      guests: 1,
      productId: uniqueLines[0]?.productId || data.products[0]?.id || "",
      orderLines: uniqueLines, discountPercent: 0,
      isRecurring: false, recurringDays: [],
      recurringNote: `Importert fra webshop. Ordrenr: ${orderNumber}`,
      allergens: Object.fromEntries(defaultAllergens.map((a) => [a, 0])),
      dietVegan: "0", dietVegetarian: "0", dietPregnant: "0", dietOther: "",
    };

    setWebshopPreview(nextOrder);
    setWebshopUnmatched(nextUnmatched);
  }

  function createWebshopOrder() {
    if (!webshopPreview) return;
    if (!webshopPreview.orderLines.length)
      return alert("Fant ingen produktlinjer. Sjekk at produktnummer finnes i Misemetrics.");

    const existing = data.orders.find(
      (o) => o.orderNumber && o.orderNumber === webshopPreview.orderNumber && !o.deletedAt
    );

    if (existing) {
      if (!confirm(`Ordrenr ${webshopPreview.orderNumber} finnes allerede. Oppdatere?`)) return;
      updateListRpc("orders", { [existing.id]: { ...webshopPreview, id: existing.id } });
      alert("Eksisterende ordre oppdatert.");
    } else {
      const seenIds = data.seenOrderIds || [];
      updateListRpc("orders", { [webshopPreview.id]: webshopPreview });
      updateData({ seenOrderIds: [...seenIds, webshopPreview.id] });
      alert("Webshopordre opprettet.");
    }

    setShowWebshopImport(false);
    setWebshopRawText("");
    setWebshopPreview(null);
    setWebshopUnmatched([]);
  }

  function removeOrderLine(index: number) {
    setForm({ ...form, orderLines: form.orderLines.filter((_, i) => i !== index) });
  }

  function addOrderLine() {
    if (!lineToAdd.productId) return;
    const selectedProduct = data.products.find((p) => p.id === lineToAdd.productId);
    if (selectedProduct?.type === "selskapsmeny" && (selectedProduct.menuCourses || []).length > 0) {
      const menuSelections: MenuCourseSelection[] = (selectedProduct.menuCourses || []).flatMap((course) =>
        (menuSelectionDraft[course.id] || [])
          .filter((row) => row.productId && row.guestCount > 0)
          .map((row) => ({ courseId: course.id, productId: row.productId, guestCount: Number(row.guestCount) }))
      );
      setForm({ ...form, orderLines: [...form.orderLines, { ...lineToAdd, menuSelections }] });
    } else {
      setForm({ ...form, orderLines: [...form.orderLines, lineToAdd] });
    }
    setLineToAdd({ productId: "", quantity: form.guests || 1 });
    setAddProductSearch("");
    setMenuSelectionDraft({});
  }

  // ── Selskapsmeny: fordeling av gjester per rettkategori ──────────────────
  function addMenuSelectionRow(courseId: string) {
    setMenuSelectionDraft((prev) => ({ ...prev, [courseId]: [...(prev[courseId] || []), { productId: "", guestCount: 0 }] }));
  }

  function removeMenuSelectionRow(courseId: string, index: number) {
    setMenuSelectionDraft((prev) => ({ ...prev, [courseId]: (prev[courseId] || []).filter((_, i) => i !== index) }));
  }

 function updateMenuSelectionRow(courseId: string, index: number, patch: Partial<{ productId: string; guestCount: number }>) {
    setMenuSelectionDraft((prev) => {
      const existing = prev[courseId] || [{ productId: "", guestCount: lineToAdd.quantity || 1 }];
      return {
        ...prev,
        [courseId]: existing.map((row, i) => i === index ? { ...row, ...patch } : row),
      };
    });
  }

  function menuSelectionTotalGuests(courseId: string): number {
    return (menuSelectionDraft[courseId] || []).reduce((sum, row) => sum + (Number(row.guestCount) || 0), 0);
  }

  function saveOrder() {
    const cleanLines = form.orderLines.filter((l) => l.productId && Number(l.quantity) > 0);
    if (!form.customer.trim() && form.customerType === "privat") return alert("Legg inn kundenavn.");
    if (!form.companyName?.trim() && form.customerType === "bedrift") return alert("Legg inn bedriftsnavn.");
    if (!cleanLines.length) return alert("Legg inn minst ett produkt/meny i ordren.");
    const savedOrder = { ...form, id: editingOrderId || `order-${Date.now()}`, orderLines: cleanLines };
    updateListRpc("orders", { [savedOrder.id]: savedOrder });
    setForm(emptyOrder()); setEditingOrderId(null); setShowNewOrder(false);
  }

  function editOrder(order: Order) {
    setForm({ ...emptyOrder(), ...order });
    setEditingOrderId(order.id);
    setShowNewOrder(true);
    setLineToAdd({ productId: "", quantity: order.guests || 1 });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function softDeleteOrder(id: string) {
    if (!confirm("Flytte ordren til papirkurv?")) return;
    updateData({ orders: data.orders.map((o) => o.id === id ? { ...o, deletedAt: new Date().toISOString() } : o) });
  }

  function restoreOrder(id: string) {
    updateData({ orders: data.orders.map((o) => o.id === id ? { ...o, deletedAt: undefined } : o) });
  }

  function permanentDeleteOrder(id: string) {
    if (!confirm("Slette ordren permanent? Dette kan ikke angres.")) return;
    updateData({ orders: data.orders.filter((o) => o.id !== id) });
  }

  function emptyTrash() {
    if (!confirm(`Slette alle ${deletedOrders.length} ordre i papirkurven permanent?`)) return;
    updateData({ orders: data.orders.filter((o) => !o.deletedAt) });
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

 function expandProductForProduction(product: Product, multiplier: number, path: string[] = [], menuSelections?: MenuCourseSelection[], courseName?: string): { name: string; amount: number; unit: string; source: string; courseName?: string; perUnit?: number }[] {
    if (path.includes(product.id)) return [];

    // Bakeri-produkter (Søtbakst, Bakeri-egenprodusert) skal kun vises som navn i catering/selskapsmeny-produksjon,
    // ikke brettes ut til ingrediensnivå (det gjøres separat i den egne bakeri-produksjonsfanen).
    const bakeryNoExpandCategories = ["Søtbakst", "Bakeri, egenprodusert"];
    if (bakeryNoExpandCategories.includes(product.category)) {
      return [{ name: product.name, amount: multiplier, unit: product.yieldUnit, source: product.name, courseName }];
    }

    // Selskapsmeny: bruk faktiske valgte alternativer per rettkategori, hver vektet med antall gjester som valgte det
    if (product.type === "selskapsmeny" && (product.menuCourses || []).length) {
      if (!menuSelections || !menuSelections.length) {
        return [{ name: `${product.name} (ingen menyvalg registrert)`, amount: multiplier, unit: product.yieldUnit, source: product.name, courseName }];
      }
      return menuSelections.flatMap((sel) => {
        const chosenProduct = data.products.find((x) => x.id === sel.productId);
        if (!chosenProduct) return [];
        const course = (product.menuCourses || []).find((c) => c.id === sel.courseId);
        return expandProductForProduction(chosenProduct, sel.guestCount, [...path, product.id], undefined, course?.name || courseName);
      });
    }

   if (!product.lines.length) return [{ name: product.name, amount: multiplier, unit: product.yieldUnit, source: product.name, courseName }];
    return product.lines.flatMap((line) => {
      const amount = line.amount * multiplier;
      const effectiveCourseName = line.groupLabel || courseName;
      if (line.itemType === "material") { const m = data.materials.find((x) => x.id === line.itemId); return [{ name: m?.name || "Ukjent råvare", amount, unit: line.unit, source: product.name, courseName: effectiveCourseName, perUnit: line.amount }]; }
      if (line.itemType === "recipe") { const r = data.recipes.find((x) => x.id === line.itemId); return [{ name: r?.name || "Ukjent grunnoppskrift", amount, unit: line.unit, source: product.name, courseName: effectiveCourseName, perUnit: line.amount }]; }
      const p = data.products.find((x) => x.id === line.itemId);
      if (!p) return [];
      // Underprodukter vises som egen linje (f.eks. "Chimichurri 0,2 kg") i stedet for å flates ut til råvarer.
      // Oppskriften for å lage mengden vises som egen skalert blokk i printen (scaledRecipeHtml).
      return [{ name: p.name, amount, unit: line.unit, source: product.name, courseName: effectiveCourseName, perUnit: line.amount }];
    });
  }

  function productionRowsHtml(items: { name: string; amount: number; unit: string; courseName?: string; perUnit?: number }[]) {
    let lastCourse: string | undefined;
    return items.map((r) => {
      let header = "";
      if (r.courseName !== lastCourse) {
        if (r.courseName) header = `<tr><td colspan="2" style="background:#e2e8f0;font-weight:800;padding-left:20px;">${escapeHtml(r.courseName)}</td></tr>`;
        lastCourse = r.courseName;
      }
      const perUnitHtml = r.perUnit != null ? ` <span style="color:#94a3b8;font-size:9px">(à ${num(r.perUnit, 3)} ${escapeHtml(r.unit)})</span>` : "";
      return `${header}<tr><td style="padding-left:${r.courseName ? "34px" : "9px"}">${escapeHtml(r.name)}${perUnitHtml}</td><td>${num(r.amount)} ${escapeHtml(r.unit)}</td></tr>`;
    }).join("");
  }

function productionTwoColumnHtml(items: { name: string; amount: number; unit: string; courseName?: string; perUnit?: number }[]) {
      type Group = { key?: string; rows: typeof items };
    const groups: Group[] = [];
    items.forEach((r) => {
      const last = groups[groups.length - 1];
      if (!last || last.key !== r.courseName) {
        groups.push({ key: r.courseName, rows: [r] });
      } else {
        last.rows.push(r);
      }
    });
    const colA: Group[] = []; const colB: Group[] = [];
    let heightA = 0; let heightB = 0;
    groups.forEach((g) => {
      const h = g.rows.length + (g.key ? 1 : 0);
      if (heightA <= heightB) { colA.push(g); heightA += h; } else { colB.push(g); heightB += h; }
    });
    function renderGroups(list: Group[]) {
      return list.map((g) => {
        const header = g.key ? `<tr><td colspan="3" style="font-weight:700;padding:2px 0;font-size:10px">${escapeHtml(g.key)}</td></tr>` : "";
        const rows = g.rows.map((r) => {
          const perUnitHtml = r.perUnit != null ? `<br><span style="color:#94a3b8;font-size:8px">à ${escapeHtml(formatAmountUnit(r.perUnit, r.unit, 3))}</span>` : "";
          const checkbox = `<td style="width:12px;padding:1px 3px 1px 0"><span style="display:inline-block;width:9px;height:9px;border:1px solid #334155;border-radius:2px"></span></td>`;
          return `<tr>${checkbox}<td style="padding:1px 6px 1px 0">${escapeHtml(r.name)}${perUnitHtml}</td><td style="text-align:right;padding:1px 0;white-space:nowrap;vertical-align:top">${escapeHtml(formatAmountUnit(r.amount, r.unit))}</td></tr>`;
        }).join("");
        const groupTable = `<table style="width:100%;border-collapse:collapse">${header}${rows}</table>`;
        return `<div style="border:1px solid #cbd5e1;border-radius:4px;padding:3px 4px;margin-bottom:4px">${groupTable}</div>`;
      }).join("");
    }
    return `<table style="width:100%;border-collapse:collapse;table-layout:fixed;margin-top:4px"><tr><td style="vertical-align:top;width:50%;padding-right:8px;border-right:1px solid #e5e7eb;font-size:10px">${renderGroups(colA)}</td><td style="vertical-align:top;width:50%;padding-left:8px;font-size:10px">${renderGroups(colB)}</td></tr></table>`;
  }

  function productionRowsForOrder(order: Order) {
    return order.orderLines.flatMap((line) => {
      const product = data.products.find((p) => p.id === line.productId);
      return product ? expandProductForProduction(product, Number(line.quantity) || 0, [], line.menuSelections) : [];
    });
  }

  function collectOrderMaterials(order: Order): Record<string, { name: string; category: string; amount: number; unit: string }> {
    const acc: Record<string, { name: string; category: string; amount: number; unit: string }> = {};
    const bakeryNoExpand = ["Søtbakst", "Bakeri, egenprodusert"];
    function addMaterial(id: string, amount: number, fallbackUnit: string) {
      const m = data.materials.find((x) => x.id === id);
      if (!m) return;
      if (!acc[m.id]) acc[m.id] = { name: m.name, category: m.category, amount: 0, unit: m.unit || fallbackUnit };
      acc[m.id].amount += amount;
    }
    function expandRecipe(recipeId: string, totalAmount: number, path: string[]) {
      const recipe = data.recipes.find((r) => r.id === recipeId);
      if (!recipe || path.includes(recipeId)) return;
      const base = recipe.lines.reduce((s, rl) => s + Number(rl.amount || 0), 0) || Number(recipe.yieldAmount || 1) || 1;
      const scale = totalAmount / Math.max(base, 1);
      recipe.lines.forEach((rl) => {
        const amt = Number(rl.amount || 0) * scale;
        if (rl.itemType === "material") addMaterial(rl.itemId, amt, recipe.yieldUnit);
        if (rl.itemType === "recipe") expandRecipe(rl.itemId, amt, [...path, recipeId]);
      });
    }
    function expandProduct(product: Product, multiplier: number, path: string[]) {
      if (path.includes(product.id) || bakeryNoExpand.includes(product.category)) return;
      product.lines.forEach((pl) => {
        const amt = Number(pl.amount || 0) * multiplier;
        if (pl.itemType === "material") addMaterial(pl.itemId, amt, pl.unit);
        if (pl.itemType === "recipe") expandRecipe(pl.itemId, amt, []);
        if (pl.itemType === "product") {
          const sub = data.products.find((x) => x.id === pl.itemId);
          if (sub) {
            const subYield = Number(sub.recipeYieldAmount || sub.yieldAmount || 1) || 1;
            expandProduct(sub, amt / subYield, [...path, product.id]);
          }
        }
      });
    }
    order.orderLines.forEach((line) => {
      const product = data.products.find((p) => p.id === line.productId);
      if (!product) return;
      const qty = Number(line.quantity) || 0;
      if (product.type === "selskapsmeny" && (product.menuCourses || []).length && line.menuSelections?.length) {
        line.menuSelections.forEach((sel) => {
          const chosen = data.products.find((x) => x.id === sel.productId);
          if (chosen) expandProduct(chosen, sel.guestCount, []);
        });
      } else {
        expandProduct(product, qty, []);
      }
    });
    return acc;
  }

  function scaledRecipeHtmlForOrder(product: Product, quantity: number, menuSelections?: MenuCourseSelection[], includeMaterials = false): string {
    const bakeryNoExpand = ["Søtbakst", "Bakeri, egenprodusert"];
    if (bakeryNoExpand.includes(product.category)) return "";
    if (product.type === "selskapsmeny" && (product.menuCourses || []).length) {
      if (!menuSelections || !menuSelections.length) return "";
      return menuSelections.map((sel) => {
        const chosenProduct = data.products.find((x) => x.id === sel.productId);
        if (!chosenProduct) return "";
        return `<div class="recipe-block"><h3>${escapeHtml(product.menuCourses!.find((c) => c.id === sel.courseId)?.name || "Rett")}: ${escapeHtml(chosenProduct.name)} (${sel.guestCount} stk)</h3>${scaledRecipeHtmlForOrder(chosenProduct, sel.guestCount)}</div>`;
      }).join("");
    }
    let html = "";
    product.lines.forEach((pl) => {
      if (pl.itemType === "recipe") {
        const recipe = data.recipes.find((r) => r.id === pl.itemId);
        if (!recipe) return;
        const totalAmount = Number(pl.amount || 0) * quantity;
        const recipeBase = recipe.lines.reduce((s, rl) => s + Number(rl.amount || 0), 0) || Number(recipe.yieldAmount || 1) || 1;
        const scale = totalAmount / Math.max(recipeBase, 1);
        const ingredientRows = recipe.lines.map((rl) => {
          let name = "Ukjent"; let unit = recipe.yieldUnit;
          if (rl.itemType === "material") { const m = data.materials.find((m) => m.id === rl.itemId); name = m?.name || "Ukjent råvare"; unit = m?.unit || recipe.yieldUnit; }
          if (rl.itemType === "recipe") { const sr = data.recipes.find((r) => r.id === rl.itemId); name = sr?.name || "Ukjent grunnoppskrift"; unit = sr?.yieldUnit || recipe.yieldUnit; }
          return `<tr><td>${escapeHtml(name)}</td><td class="right">${num(Number(rl.amount || 0) * scale, 3)} ${escapeHtml(unit)}</td></tr>`;
        }).join("");
        html += `<div class="recipe-block"><h3>Grunnoppskrift: ${escapeHtml(recipe.name)} – ${num(totalAmount, 3)} ${escapeHtml(pl.unit)}</h3><table><thead><tr><th>Ingrediens</th><th class="right">Mengde</th></tr></thead><tbody>${ingredientRows}</tbody></table></div>`;
      }
      if (pl.itemType === "product") {
        const subProduct = data.products.find((x) => x.id === pl.itemId);
        if (subProduct && subProduct.id !== product.id) {
          const totalAmount = Number(pl.amount || 0) * quantity;
          const subYield = Number(subProduct.recipeYieldAmount || subProduct.yieldAmount || 1) || 1;
          const subScale = totalAmount / subYield;
          html += `<div class="recipe-block"><h3>Produkt: ${escapeHtml(subProduct.name)} – ${num(totalAmount, 3)} ${escapeHtml(pl.unit)}</h3>${scaledRecipeHtmlForOrder(subProduct, subScale, undefined, true)}</div>`;
        }
      }
    });
    const materialRows = product.lines
      .filter((pl) => pl.itemType === "material")
      .map((pl) => {
        const m = data.materials.find((x) => x.id === pl.itemId);
        return `<tr><td>${escapeHtml(m?.name || "Ukjent råvare")}</td><td class="right">${num(Number(pl.amount || 0) * quantity, 3)} ${escapeHtml(pl.unit)}</td></tr>`;
      }).join("");
    if (materialRows && includeMaterials) {
      html += `<table><thead><tr><th>Råvare</th><th class="right">Mengde</th></tr></thead><tbody>${materialRows}</tbody></table>`;
    }
    return html;
  }

  function printOrder(order: Order, printLevel: "basis" | "recipes" | "full" = "full") {
    const rows = order.orderLines.map((line) => {
      const product = data.products.find((p) => p.id === line.productId);
      const lineTotal = (product?.customerPrice || 0) * line.quantity;
      return `<tr><td>${line.quantity}</td><td>${product?.name || "Ukjent"}</td><td>${currency(product?.customerPrice || 0)}</td><td>${currency(lineTotal)}</td></tr>`;
    }).join("");
    const subtotalInc = orderSubtotalIncVat(order);
    const discountAmount = orderDiscountAmount(order);
    const totalInc = orderTotalIncVat(order);
    const totalEx = exVatFromIncVat(totalInc, data.settings.foodVat);
    const noteAllergens = order.note?.match(/Allergier \(fra bestilling\):\s*(.+)/i)?.[1]?.trim() || "";
    const allergens = selectedAllergens(order).join(", ") || noteAllergens || "Ingen registrert";
    const diets = `Vegetar: ${order.dietVegetarian || 0}, Vegan: ${order.dietVegan || 0}, Gravid: ${order.dietPregnant || 0}${order.dietOther ? `, Annet: ${order.dietOther}` : ""}`;
    const customerName = order.customerType === "bedrift"
      ? `${order.companyName || ""}${order.orgNumber ? ` (${order.orgNumber})` : ""}` : order.customer;
    const allergenDetails = orderAllergenWarningDetails(order);
    const allergenWarningHtml = allergenDetails.length
      ? `<div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:8px;margin-bottom:8px;font-weight:700;color:#92400e">⚠ Allergivarsel:<br>${allergenDetails.map((d) => `${escapeHtml(d.dish)}${d.name !== d.dish ? ` – ${escapeHtml(d.name)}` : ""}: ${escapeHtml(d.allergens.join(", "))}`).join("<br>")}</div>`
      : "";
    let prodSection = "";
    {
      const isBakery = order.type === "bakeri" || order.type === "egenprodusert";
      if (isBakery) {
        const prodPages = order.orderLines.map((line) => {
          const product = data.products.find((p) => p.id === line.productId); if (!product) return "";
          const qty = Number(line.quantity) || 1;
          const recipeMap: Record<string, { name: string; totalAmount: number; unit: string; ingredientRows: string }> = {};
          product.lines.forEach((pl) => {
            if (pl.itemType !== "recipe") return;
            const recipe = data.recipes.find((r) => r.id === pl.itemId); if (!recipe) return;
            const totalAmount = Number(pl.amount || 0) * qty;
            const recipeBaseAmount = recipe.lines.reduce((s, rl) => s + Number(rl.amount || 0), 0) || Number(recipe.yieldAmount || 1) || 1;
            const scale = totalAmount / Math.max(recipeBaseAmount, 1);
            const ingredientRows = recipe.lines.map((rl) => {
              let name = "Ukjent"; let unit = recipe.yieldUnit;
              if (rl.itemType === "material") { const m = data.materials.find((m) => m.id === rl.itemId); name = m?.name || "Ukjent råvare"; unit = m?.unit || recipe.yieldUnit; }
              if (rl.itemType === "recipe") { const sr = data.recipes.find((r) => r.id === rl.itemId); name = sr?.name || "Ukjent grunnoppskrift"; unit = sr?.yieldUnit || recipe.yieldUnit; }
              return `<tr><td style="width:12px"><span style="display:inline-block;width:9px;height:9px;border:1px solid #334155;border-radius:2px"></span></td><td>${escapeHtml(name)}</td><td class="right">${escapeHtml(formatAmountUnit(Number(rl.amount || 0) * scale, unit, 3))}</td></tr>`;
            }).join("");
            recipeMap[recipe.id] = { name: recipe.name, totalAmount, unit: pl.unit, ingredientRows };
          });
          const directMaterialRows = product.lines.filter((pl) => pl.itemType === "material").map((pl) => {
            const m = data.materials.find((x) => x.id === pl.itemId);
            return `<tr><td style="width:12px"><span style="display:inline-block;width:9px;height:9px;border:1px solid #334155;border-radius:2px"></span></td><td>${escapeHtml(m?.name || "Ukjent")}</td><td class="right">${escapeHtml(formatAmountUnit(Number(pl.amount || 0) * qty, pl.unit, 3))}</td></tr>`;
          }).join("");
          const recipeBlocks = Object.values(recipeMap).map((entry) =>
            `<div class="recipe-block"><h3>Grunnoppskrift: ${escapeHtml(entry.name)} – ${num(entry.totalAmount, 3)} ${escapeHtml(entry.unit)} (for ${qty} stk)</h3><table><thead><tr><th style="width:12px"></th><th>Ingrediens</th><th class="right">Mengde</th></tr></thead><tbody>${entry.ingredientRows}</tbody></table></div>`
          ).join("");
          const directSection = directMaterialRows
            ? `<div class="recipe-block"><h3>Direkte råvarer – ${escapeHtml(product.name)}</h3><table><thead><tr><th style="width:12px"></th><th>Råvare</th><th class="right">Mengde</th></tr></thead><tbody>${directMaterialRows}</tbody></table></div>` : "";
          return `<div class="prod-product"><h2>${qty} × ${escapeHtml(product.name)}</h2>${recipeBlocks}${directSection}</div>`;
        }).join("");
prodSection = `<h2>Produksjonsgrunnlag (skalert til bestilt antall)</h2>${prodPages}`;      } else {        const prodRows = order.orderLines.map((line) => {
          const product = data.products.find((p) => p.id === line.productId); if (!product) return "";
const twoColHtml = productionTwoColumnHtml(expandProductForProduction(product, Number(line.quantity) || 0, [], line.menuSelections));          return `<div style="margin-bottom:8px;break-inside:avoid"><div style="background:#111827;color:white;font-weight:700;padding:3px 6px;font-size:11px">${line.quantity} × ${escapeHtml(product.name)}</div>${twoColHtml}</div>`;
        }).join("");
        const recipePages = printLevel === "basis" ? "" : order.orderLines.map((line) => {
          const product = data.products.find((p) => p.id === line.productId); if (!product) return "";
          const html = scaledRecipeHtmlForOrder(product, Number(line.quantity) || 0, line.menuSelections);
          if (!html) return "";
          return `<div style="margin:8px 0"><div style="background:#111827;color:white;font-weight:700;padding:3px 6px;font-size:11px">${line.quantity} × ${escapeHtml(product.name)}</div>${html}</div>`;
        }).join("");
const materialsAgg = printLevel === "full" ? collectOrderMaterials(order) : {};
        const byCategory: Record<string, { name: string; amount: number; unit: string }[]> = {};
        Object.values(materialsAgg).forEach((entry) => {
          if (!byCategory[entry.category]) byCategory[entry.category] = [];
          byCategory[entry.category].push(entry);
        });
        const shoppingHtml = Object.keys(byCategory).sort((a, b) => a.localeCompare(b, "no-NO")).map((cat) => {
          const rows = byCategory[cat]
            .sort((a, b) => a.name.localeCompare(b.name, "no-NO"))
            .map((e) => `<tr><td>${escapeHtml(e.name)}</td><td class="right">${num(e.amount, 3)} ${escapeHtml(e.unit)}</td></tr>`).join("");
          return `<div class="recipe-block"><h3>${escapeHtml(cat)}</h3><table><thead><tr><th>Råvare</th><th class="right">Mengde</th></tr></thead><tbody>${rows}</tbody></table></div>`;
        }).join("");
prodSection = `<h2>Produksjonsgrunnlag</h2>${prodRows}${recipePages ? `<div class="page-break"></div><h2>Oppskrifter (skalert til bestilt antall)</h2>${recipePages}` : ""}${shoppingHtml ? `<div class="page-break"></div><h2>Varebestilling</h2>${shoppingHtml}` : ""}`;      }
    }
    const w = window.open("", "_blank"); if (!w) return;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8" /><title>Ordre ${order.date}</title><style>@page{size:A4;margin:10mm}body{font-family:Arial,sans-serif;color:#111827;padding:10px;line-height:1.15;font-size:10px}.top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #111827;padding-bottom:6px;margin-bottom:8px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.box{border:1px solid #e5e7eb;border-radius:8px;padding:6px;margin-bottom:6px}.box p{margin:2px 0}h2{font-size:12px;margin:6px 0 3px}table{width:100%;border-collapse:collapse;margin-top:4px}th,td{border-bottom:1px solid #e5e7eb;padding:2px 5px;text-align:left;font-size:10px}th{background:#f3f4f6}.right{text-align:right}.total{font-size:14px;font-weight:900}.prod-product{border:1px solid #cbd5e1;border-radius:8px;padding:8px;margin:8px 0;break-inside:avoid}.prod-product h2{margin:0 0 6px;font-size:13px}.recipe-block{margin:8px 0;background:#f8fafc;border:1px solid #94a3b8;border-radius:6px;padding:6px;break-inside:avoid}.recipe-block h3{margin:0 0 4px;font-size:11px}.page-break{page-break-before:always}@media print{button{display:none}body{padding:6px}}</style></head><body><button onclick="window.print()">Print</button><div class="top"><div style="display:flex;align-items:center;gap:14px"><img src="/logo.png" style="height:50px;width:auto;object-fit:contain" /><div><b style="font-size:14px">KJØKKENORDRE</b><br><small style="color:#64748b">${today()}</small></div></div><div style="text-align:right"><b style="font-size:18px">${formatDateNo(order.date)} ${order.time || ""}</b><br><p style="margin:0">${order.type}${order.orderNumber ? ` · Ordrenr: ${escapeHtml(order.orderNumber)}` : ""}</p></div></div><div class="grid"><div class="box"><h2>Kunde</h2><p><b>${escapeHtml(customerName || "Ikke angitt")}</b></p><p>Kontakt: ${escapeHtml(order.customer || "-")}</p><p>Telefon: ${escapeHtml(order.phone || "-")}</p><p>Betaling: ${escapeHtml(order.paymentInfo || "-")}</p><p>Levering: ${escapeHtml(order.deliveryAddress || "-")}</p>${order.note ? `<p><b>Notat:</b><br>${escapeHtml(order.note).replace(/\n/g, "<br>")}</p>` : ""}</div><div class="box"><h2>Hensyn</h2><p><b>Dietter:</b> ${escapeHtml(diets)}</p><p><b>Allergier:</b> ${escapeHtml(allergens)}</p></div></div>${allergenWarningHtml}<h2>Ordrelinjer</h2><table><thead><tr><th>Antall</th><th>Produkt/meny</th><th>Pris inkl. mva</th><th>Sum</th></tr></thead><tbody>${rows}</tbody></table>${prodSection}<div class="box"><p>Sum før rabatt: ${currency(subtotalInc)}</p><p>Rabatt ${order.discountPercent || 0}%: -${currency(discountAmount)}</p><p class="total">Total inkl. mva: ${currency(totalInc)}</p><p>Total eks. mva: ${currency(totalEx)}</p></div></body></html>`);
    w.document.close(); w.focus();
  }

  function productName(id: string) {
    return data.products.find((p) => p.id === id)?.name || "Ukjent produkt";
  }

  function productAllergenBreakdown(product: Product, visited: string[] = []): { name: string; allergens: string[] }[] {
    if (visited.includes(product.id)) return [];
    const nextVisited = [...visited, product.id];
    return product.lines.map((line) => {
      if (line.itemType === "material") {
        const m = data.materials.find((x) => x.id === line.itemId);
        return m && (m.allergens || []).length ? { name: m.name, allergens: m.allergens } : null;
      }
      if (line.itemType === "recipe") {
        const r = data.recipes.find((x) => x.id === line.itemId);
        const allergens = r ? recipeAllergens(r) : [];
        return r && allergens.length ? { name: r.name, allergens } : null;
      }
      const p = data.products.find((x) => x.id === line.itemId);
      const allergens = p ? productAllergens(p, nextVisited) : [];
      return p && allergens.length ? { name: p.name, allergens } : null;
    }).filter((x): x is { name: string; allergens: string[] } => !!x);
  }

  function orderLineAllergenBreakdown(line: OrderLine): { dish: string; name: string; allergens: string[] }[] {
    const product = data.products.find((p) => p.id === line.productId);
    if (!product) return [];
    if (product.type === "selskapsmeny" && (product.menuCourses || []).length && line.menuSelections?.length) {
      return line.menuSelections.flatMap((sel) => {
        const chosen = data.products.find((p) => p.id === sel.productId);
        if (!chosen) return [];
        const breakdown = productAllergenBreakdown(chosen);
        return (breakdown.length ? breakdown : [{ name: chosen.name, allergens: productAllergens(chosen) }])
          .filter((b) => b.allergens.length)
          .map((b) => ({ dish: chosen.name, name: b.name, allergens: b.allergens }));
      });
    }
    const breakdown = productAllergenBreakdown(product);
    return (breakdown.length ? breakdown : [{ name: product.name, allergens: productAllergens(product) }])
      .filter((b) => b.allergens.length)
      .map((b) => ({ dish: product.name, name: b.name, allergens: b.allergens }));
  }

  function orderAllergenWarnings(order: Order) {
    const orderAllergens = new Set(order.orderLines.flatMap((l) => orderLineAllergenBreakdown(l).flatMap((b) => b.allergens)));
    return Object.entries(order.allergens || {})
      .filter(([allergen, count]) => Number(count) > 0 && orderAllergens.has(allergen))
      .map(([allergen]) => allergen);
  }

  function orderAllergenWarningDetails(order: Order) {
    const flagged = new Set(Object.entries(order.allergens || {}).filter(([, c]) => Number(c) > 0).map(([a]) => a));
    if (!flagged.size) return [];
    return order.orderLines.flatMap((line) =>
      orderLineAllergenBreakdown(line)
        .map((b) => ({ ...b, allergens: b.allergens.filter((a) => flagged.has(a)) }))
        .filter((b) => b.allergens.length)
    );
  }

  function printProductPopup(product: Product) {
    const allergens = productAllergens(product).join(", ") || "Ingen registrert";
    const rows = product.lines.map((line) => {
      let name = "Ukjent";
      if (line.itemType === "material") name = data.materials.find((m) => m.id === line.itemId)?.name || "Ukjent råvare";
      if (line.itemType === "recipe") name = data.recipes.find((r) => r.id === line.itemId)?.name || "Ukjent grunnoppskrift";
      if (line.itemType === "product") name = data.products.find((p) => p.id === line.itemId)?.name || "Ukjent produkt";
      return `<tr><td>${escapeHtml(line.itemType)}</td><td>${escapeHtml(name)}</td><td>${num(line.amount)} ${line.unit}</td></tr>`;
    }).join("");
    const w = window.open("", "_blank"); if (!w) return;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8" /><title>${escapeHtml(product.name)}</title><style>body{font-family:Arial,sans-serif;color:#111827;padding:32px}.card{max-width:620px;border:2px solid #111827;padding:20px}.logo{height:70px;width:auto;object-fit:contain;margin-bottom:10px}h1{margin:0 0 10px;font-size:26px}table{width:100%;border-collapse:collapse;margin-top:14px}td,th{border-bottom:1px solid #d1d5db;padding:7px;text-align:left}th{background:#f3f4f6}@media print{button{display:none}}</style></head><body><button onclick="window.print()">Print</button><div class="card"><img src="/logo.png" class="logo" /><h1>${escapeHtml(product.name)}</h1><p><b>Allergener:</b> ${escapeHtml(allergens)}</p><table><thead><tr><th>Type</th><th>Navn</th><th>Mengde</th></tr></thead><tbody>${rows}</tbody></table></div></body></html>`);
    w.document.close(); w.focus();
  }

  const activeOrders = data.orders.filter((o) => !o.deletedAt);
  const deletedOrders = data.orders.filter((o) => !!o.deletedAt);

  function toggleSort(field: typeof sortField) {
    if (sortField === field) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
    setOrderPage(1);
  }
  function sortIcon(field: typeof sortField) {
    if (sortField !== field) return " ↕";
    return sortDir === "asc" ? " ↑" : " ↓";
  }

  const threeDaysAgo = (() => {
    const d = new Date(); d.setDate(d.getDate() - 3);
    return d.toISOString().slice(0, 10);
  })();

  const filteredOrders = activeOrders
    .filter((o) => {
      if (showTodayOnly) return o.date === todayStr;
      if (hideOldOrders) return o.date >= threeDaysAgo;
      return true;
    })
    .filter((o) => {
      if (!orderSearch.trim()) return true;
      const q = orderSearch.toLowerCase();
      return (
        (o.orderNumber || "").toLowerCase().includes(q) ||
        (o.customer || "").toLowerCase().includes(q) ||
        (o.companyName || "").toLowerCase().includes(q) ||
        (o.phone || "").includes(q)
      );
    })
    .sort((a, b) => {
      let valA = "", valB = "";
      if (sortField === "date") { valA = `${a.date} ${a.time || ""}`; valB = `${b.date} ${b.time || ""}`; }
      if (sortField === "customer") {
        valA = a.customerType === "bedrift" ? (a.companyName || a.customer) : a.customer;
        valB = b.customerType === "bedrift" ? (b.companyName || b.customer) : b.customer;
      }
      if (sortField === "orderNumber") { valA = a.orderNumber || ""; valB = b.orderNumber || ""; }
      return sortDir === "asc" ? valA.localeCompare(valB, "no-NO") : valB.localeCompare(valA, "no-NO");
    });

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const pagedOrders = filteredOrders.slice((orderPage - 1) * pageSize, orderPage * pageSize);

  function localDateKey(d: Date) {
    const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, "0"); const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  function calDayOrders(date: string) {
    return activeOrders.filter((o) => o.date === date).sort((a, b) => (a.time || "").localeCompare(b.time || ""));
  }
  const calMonthStart = new Date(`${calendarMonth}-01T12:00:00`);
  const calYear = calMonthStart.getFullYear();
  const calMonth = calMonthStart.getMonth();
  const calFirstDay = new Date(calYear, calMonth, 1);
  const calStartOffset = (calFirstDay.getDay() + 6) % 7;
  const calDays: string[] = [];
  const calStart = new Date(calYear, calMonth, 1);
  calStart.setDate(calStart.getDate() - calStartOffset);
  for (let i = 0; i < 42; i++) { const d = new Date(calStart); d.setDate(calStart.getDate() + i); calDays.push(localDateKey(d)); }
  function changeCalMonth(delta: number) {
    const base = new Date(`${calendarMonth}-01T12:00:00`);
    base.setMonth(base.getMonth() + delta);
    setCalendarMonth(localDateKey(base).slice(0, 7));
  }
  const calSelectedOrders = calDayOrders(calendarSelectedDate);
  return (
    <section className="card">
      <div className="between">
        <h2>Ordre</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            className={showTrash ? "btn active" : "btn"}
            onClick={() => setShowTrash(!showTrash)}
          >
            🗑 Papirkurv {deletedOrders.length > 0 && `(${deletedOrders.length})`}
          </button>
          <button className="btn" onClick={() => { setShowWebshopImport(!showWebshopImport); setShowNewOrder(false); }}>
            {showWebshopImport ? "Lukk webshopimport" : "Importer fra webshop"}
          </button>
          <button className="btn" onClick={() => {
            const url = `https://${window.location.host}/api/calendar`;
            navigator.clipboard.writeText(url);
            alert(`Kalender-URL kopiert!\n\n${url}\n\nLim inn i kalenderappen under «Abonner fra nett».`);
          }}>
            📅 Kopier kalender-URL
          </button>
          <button className="btn active" onClick={() => { setShowNewOrder(!showNewOrder); setShowWebshopImport(false); }}>
            {showNewOrder ? "Skjul skjema" : "Ny ordre"}
          </button>
        </div>
      </div>

      {showWebshopImport && (
        <div className="soft-box">
          <h3>Importer webshopordre</h3>
          <p style={{ color: "#64748b" }}>
            Lim inn e-posttekst fra Postmark/webshop. Systemet matcher på produktnummer (f.eks. CA000004).
            URL-lenker og støytekst fjernes automatisk.
          </p>
          <textarea className="textarea" value={webshopRawText} onChange={(e) => setWebshopRawText(e.target.value)} placeholder="Lim inn e-posttekst her..." style={{ minHeight: 200 }} />
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <button className="btn active" onClick={parseWebshopOrder}>Les ordre</button>
            <button className="btn" onClick={() => { setWebshopRawText(""); setWebshopPreview(null); setWebshopUnmatched([]); }}>Tøm</button>
          </div>
          {webshopPreview && (
            <div className="soft-box" style={{ marginTop: 14 }}>
              <h4>Forhåndsvisning</h4>
              {data.orders.find((o) => o.orderNumber === webshopPreview.orderNumber && !o.deletedAt) && (
                <div className="warning">⚠️ Ordrenr {webshopPreview.orderNumber} finnes allerede – vil oppdatere eksisterende ordre.</div>
              )}
              <p><b>Ordrenr:</b> {webshopPreview.orderNumber || "-"}</p>
              <p><b>Kunde:</b> {webshopPreview.customer}{webshopPreview.companyName ? ` / ${webshopPreview.companyName}` : ""}</p>
              <p><b>Telefon:</b> {webshopPreview.phone || "-"}</p>
              <p><b>Dato/tid:</b> {formatDateNo(webshopPreview.date)} {webshopPreview.time}</p>
              <p><b>Levering:</b> {webshopPreview.deliveryAddress || "-"}</p>
              <p><b>Betaling:</b> {webshopPreview.paymentInfo || "-"}</p>
              {webshopPreview.note && <p style={{ whiteSpace: "pre-wrap" }}><b>Notat:</b><br />{webshopPreview.note}</p>}
              <table>
                <thead><tr><th>Produkt</th><th>Antall</th></tr></thead>
                <tbody>
                  {webshopPreview.orderLines.map((line, i) => {
                    const product = data.products.find((p) => p.id === line.productId);
                    return <tr key={i}><td>{product?.productNumber ? `${product.productNumber} · ` : ""}{product?.name || "Ukjent produkt"}</td><td>{line.quantity}</td></tr>;
                  })}
                </tbody>
              </table>
              {webshopUnmatched.length > 0 && (
                <div style={{ marginTop: 12, color: "#64748b" }}>
                  <b>Ikke matchet (havner i notat):</b>
                  <ul>{webshopUnmatched.map((line, i) => <li key={i}>{line}</li>)}</ul>
                </div>
              )}
              <button className="btn active" onClick={createWebshopOrder}>
                {data.orders.find((o) => o.orderNumber === webshopPreview.orderNumber && !o.deletedAt) ? "Oppdater eksisterende ordre" : "Opprett ordre"}
              </button>
            </div>
          )}
        </div>
      )}

      {showNewOrder && (
        <div className="soft-box full-width">
          <h3>{editingOrderId ? "Rediger ordre" : "Ny ordre"}</h3>
          <div className="form-grid four">
            <label>Ordrenr<input value={form.orderNumber || ""} onChange={(e) => setForm({ ...form, orderNumber: e.target.value })} placeholder="F.eks. 686488" /></label>
            <label>Ordretype
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Order["type"], customerType: e.target.value === "storkjokken" ? "storkjokken" : form.customerType })}>
                <option value="catering">Catering</option><option value="bakeri">Bakeri</option>
                <option value="pasmuurt">Påsmurt</option><option value="egenprodusert">Egenprodusert</option>
                <option value="storkjokken">Storkjøkken</option>
              </select>
            </label>
            <label>Kundetype
              <select value={form.customerType} onChange={(e) => setForm({ ...form, customerType: e.target.value as Order["customerType"] })}>
                <option value="privat">Privat</option><option value="bedrift">Bedrift</option><option value="storkjokken">Storkjøkken</option>
              </select>
            </label>
            <label>Dato<input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
            <label>Tid<input value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} onBlur={(e) => setForm({ ...form, time: formatTimeInput(e.target.value) })} placeholder="f.eks. 1015" /></label>
          </div>
          {form.customerType === "bedrift" || form.customerType === "storkjokken" ? (
            <div className="form-grid four">
              <label>Bedriftsnavn<input value={form.companyName || ""} onChange={(e) => setForm({ ...form, companyName: e.target.value })} /></label>
              <label>Orgnr<input value={form.orgNumber || ""} onChange={(e) => setForm({ ...form, orgNumber: e.target.value })} /></label>
              <label>Bedriftsadresse<input value={form.companyAddress || ""} onChange={(e) => setForm({ ...form, companyAddress: e.target.value })} /></label>
              <label>Kontaktperson<input value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })} /></label>
            </div>
          ) : (
            <div className="form-grid four">
              <label>Kundenavn<input value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })} placeholder="Kunde" /></label>
            </div>
          )}
          <div className="form-grid four">
            <label>Telefon<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
            <label>Leveringsadresse<input value={form.deliveryAddress} onChange={(e) => setForm({ ...form, deliveryAddress: e.target.value })} /></label>
            <label>Betalingsinfo<input value={form.paymentInfo || ""} onChange={(e) => setForm({ ...form, paymentInfo: e.target.value })} placeholder="F.eks. Betalt på nett" /></label>
            <label style={{ gridColumn: "1 / -1" }}>Notat
              <textarea className="textarea" value={form.note || ""} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Fritekst, beskjed, info osv." />
            </label>
            <label>Antall gjester<input type="number" value={form.guests} onChange={(e) => setForm({ ...form, guests: Number(e.target.value) || 0 })} /></label>
            <label>Rabatt %<input type="number" value={form.discountPercent || 0} onChange={(e) => setForm({ ...form, discountPercent: Number(e.target.value) || 0 })} /></label>
          </div>
          {form.type === "storkjokken" && (
            <div className="soft-box">
              <h3>Fast ordre / gjentagelse</h3>
              <label className="check"><input type="checkbox" checked={!!form.isRecurring} onChange={(e) => setForm({ ...form, isRecurring: e.target.checked })} /> Dette er en fast/gjentagende ordre</label>
              {form.isRecurring && <>
                <div className="chips">{["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"].map((day) => { const active = (form.recurringDays || []).includes(day); return <button key={day} type="button" className={active ? "btn active" : "btn"} onClick={() => setForm({ ...form, recurringDays: active ? (form.recurringDays || []).filter((d) => d !== day) : [...(form.recurringDays || []), day] })}>{day}</button>; })}</div>
                <input value={form.recurringNote || ""} onChange={(e) => setForm({ ...form, recurringNote: e.target.value })} placeholder="Notat, f.eks. gjelder skoleåret" />
              </>}
            </div>
          )}
          <h3>Legg til produkt / meny</h3>
          <div className="form-grid three">
            <div className="search-picker">
              <input
                value={addProductSearch || (data.products.find((p) => p.id === lineToAdd.productId)?.name || "")}
                onChange={(e) => {
                  setAddProductSearch(e.target.value);
                  setLineToAdd({ ...lineToAdd, productId: "" });
                  setMenuSelectionDraft({});
                }}
                placeholder="Søk og velg produkt"
              />
              {addProductSearch && (
                <div className="search-dropdown inline">
                  {data.products
                    .filter((p) => p.name.toLowerCase().includes(addProductSearch.toLowerCase()))
                    .slice(0, 12)
                    .map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="search-result"
                        onClick={() => {
                          setLineToAdd({ ...lineToAdd, productId: p.id });
                          setMenuSelectionDraft({});
                          setAddProductSearch("");
                        }}
                      >
                        <b>{p.name}</b>
                        <small>{p.category}</small>
                      </button>
                    ))}
                </div>
              )}
            </div>
            <input type="number" value={lineToAdd.quantity} onChange={(e) => setLineToAdd({ ...lineToAdd, quantity: Number(e.target.value) })} placeholder="Antall" />
            <button className="btn" onClick={addOrderLine}>Legg til</button>
          </div>

          {(() => {
            const selectedForAdd = data.products.find((p) => p.id === lineToAdd.productId);
            if (selectedForAdd?.type !== "selskapsmeny" || !(selectedForAdd.menuCourses || []).length) return null;
            return (
              <div className="soft-box">
                <h3>Fordel gjester per rett ({selectedForAdd.name})</h3>
                <p style={{ color: "#64748b", fontSize: 13 }}>Totalt antall gjester for denne menylinjen er {lineToAdd.quantity}. Fordel dette tallet per rettkategori under.</p>
                {(selectedForAdd.menuCourses || []).map((course) => {
                  const rows = menuSelectionDraft[course.id] || [{ productId: "", guestCount: lineToAdd.quantity || 1 }];
                  const totalGuests = menuSelectionTotalGuests(course.id);
                  const mismatch = totalGuests !== lineToAdd.quantity;
                  return (
                    <div key={course.id} style={{ marginBottom: 14 }}>
                      <div className="between">
                        <b>{course.name}</b>
                        <span style={{ color: mismatch ? "#dc2626" : "#166534", fontSize: 13, fontWeight: 700 }}>
                          {totalGuests} / {lineToAdd.quantity} gjester fordelt
                        </span>
                      </div>
                      {rows.map((row, i) => (
                        <div key={i} className="form-grid three" style={{ alignItems: "end" }}>
                          <select value={row.productId} onChange={(e) => updateMenuSelectionRow(course.id, i, { productId: e.target.value })}>
                            <option value="">Velg alternativ</option>
                            {course.options.map((opt) => {
                              const p = data.products.find((x) => x.id === opt.productId);
                              return <option key={opt.id} value={opt.productId}>{p?.name || "Ukjent"}</option>;
                            })}
                          </select>
                          <input type="number" value={row.guestCount || ""} onChange={(e) => updateMenuSelectionRow(course.id, i, { guestCount: Number(e.target.value) || 0 })} placeholder="Antall gjester" />
                          <button className="link danger" onClick={() => removeMenuSelectionRow(course.id, i)}>Slett valg</button>
                        </div>
                      ))}
                      <button className="btn" onClick={() => addMenuSelectionRow(course.id)}>+ Legg til alternativ valg</button>
                      {mismatch && <div className="warning" style={{ marginTop: 8 }}>Summen av fordelte gjester ({totalGuests}) stemmer ikke med totalt antall ({lineToAdd.quantity}) for denne menylinjen.</div>}
                    </div>
                  );
                })}
                <button className="btn active" onClick={addOrderLine} style={{ marginTop: 8 }}>Legg til denne menylinjen i ordren</button>
              </div>
            );
          })()}

          <h3>Produkter i ordre</h3>
          {form.orderLines.map((line, i) => {
            const product = data.products.find((p) => p.id === line.productId);
            return (
              <div key={i} className="pill" style={{ display: "block", marginBottom: 6 }}>
                <div>
                  {line.quantity} × {product?.name}
                  <button style={{ marginLeft: 8 }} className="link danger" onClick={() => removeOrderLine(i)}>×</button>
                  {product && <button className="btn" style={{ marginLeft: 8 }} onClick={() => printProductPopup(product)}>Se oppskrift</button>}
                </div>
                {line.menuSelections && line.menuSelections.length > 0 && (
                  <div style={{ marginTop: 4, fontSize: 12, color: "#64748b" }}>
                    {(product?.menuCourses || []).map((course) => {
                      const selections = line.menuSelections!.filter((s) => s.courseId === course.id);
                      if (!selections.length) return null;
                      return (
                        <div key={course.id}>
                          {course.name}: {selections.map((s) => `${s.guestCount}×${data.products.find((p) => p.id === s.productId)?.name || "?"}`).join(", ")}
                        </div>
                      );
                    })}
                  </div>
                )}
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
              return <div key={a}><button type="button" className={active ? "btn active" : "btn"} onClick={() => setForm({ ...form, allergens: { ...form.allergens, [a]: active ? 0 : 1 } })}>{a}</button>{active && <input style={{ marginTop: 4, width: 60 }} type="number" value={form.allergens[a]} onChange={(e) => setForm({ ...form, allergens: { ...form.allergens, [a]: Number(e.target.value) } })} />}</div>;
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
          <button className="btn active" onClick={saveOrder}>{editingOrderId ? "Lagre endringer" : "Lagre ordre"}</button>
          {editingOrderId && <button className="btn" style={{ marginLeft: 8 }} onClick={() => { setForm(emptyOrder()); setEditingOrderId(null); setShowNewOrder(false); }}>Avbryt redigering</button>}
        </div>
      )}

      {calendarView && (
        <div className="soft-box" style={{ marginTop: 12 }}>
          <div className="between" style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button className="btn" onClick={() => changeCalMonth(-1)}>←</button>
              <b style={{ textTransform: "capitalize" }}>
                {new Date(`${calendarMonth}-01T12:00:00`).toLocaleDateString("no-NO", { month: "long", year: "numeric" })}
              </b>
              <button className="btn" onClick={() => changeCalMonth(1)}>→</button>
            </div>
            <button className="btn" onClick={() => setCalendarView(false)}>Skjul kalender</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
            {["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"].map((d) => (
              <b key={d} style={{ padding: "4px 6px", fontSize: 12, color: "#64748b" }}>{d}</b>
            ))}
            {calDays.map((date) => {
              const inMonth = date.slice(0, 7) === calendarMonth;
              const orders = calDayOrders(date);
              const isToday = date === todayStr;
              const isSelected = date === calendarSelectedDate;
              return (
                <button key={date} onClick={() => setCalendarSelectedDate(date)}
                  style={{ minHeight: 64, textAlign: "left", padding: 8, borderRadius: 10, border: isSelected ? "2px solid #0f172a" : isToday ? "2px solid #166534" : "1px solid #dbe4ef", background: isSelected ? "#0f172a" : isToday ? "#dcfce7" : orders.length > 0 ? "#eff6ff" : "white", opacity: inMonth ? 1 : 0.4, cursor: "pointer", color: isSelected ? "white" : "inherit" }}>
                  <b style={{ fontSize: 13 }}>{Number(date.slice(8, 10))}</b>
                  {orders.length > 0 && <div style={{ marginTop: 3, fontSize: 11, color: isSelected ? "#93c5fd" : "#3b82f6", fontWeight: 700 }}>{orders.length} ordre</div>}
                </button>
              );
            })}
          </div>
          <div style={{ marginTop: 14 }}>
            <h3 style={{ marginBottom: 8 }}>{formatDateNo(calendarSelectedDate)} – {calSelectedOrders.length} ordre</h3>
            {calSelectedOrders.length === 0 && <p style={{ color: "#64748b" }}>Ingen ordre denne dagen.</p>}
            {calSelectedOrders.map((o) => {
              const displayName = o.customerType === "bedrift" ? o.companyName || o.customer : o.customer;
              return (
                <div key={o.id} className="editable-row">
                  <div>
                    <b>{o.time || "--"}</b> {displayName}
                    {o.orderNumber && <span style={{ marginLeft: 8, fontSize: 12, color: "#64748b" }}>#{o.orderNumber}</span>}
                    <br />
                    <small style={{ color: "#64748b" }}>{o.orderLines.map((l) => `${l.quantity}×${productName(l.productId)}`).join(", ")}</small>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="btn" onClick={() => { setCalendarView(false); setTimeout(() => setExpandedOrderId(o.id), 100); }}>Vis</button>
                    <button className="btn" onClick={() => editOrder(o)}>Rediger</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "16px 0 8px", alignItems: "center" }}>
        <input value={orderSearch} onChange={(e) => { setOrderSearch(e.target.value); setOrderPage(1); }} placeholder="Søk ordrenr, kunde, bedrift eller telefon..." style={{ flex: 1, minWidth: 200 }} />
      </div>

      <div className="chips" style={{ marginBottom: 8 }}>
        <button className={showTodayOnly ? "btn active" : "btn"} onClick={() => { setShowTodayOnly(!showTodayOnly); if (!showTodayOnly) setHideOldOrders(false); setOrderPage(1); }}>
          📅 I dag ({activeOrders.filter((o) => o.date === todayStr).length})
        </button>
        <button className={hideOldOrders && !showTodayOnly ? "btn active" : "btn"} onClick={() => { setHideOldOrders(true); setShowTodayOnly(false); setOrderPage(1); }}>
          Siste 3 dager+
        </button>
        <button className={!hideOldOrders && !showTodayOnly ? "btn active" : "btn"} onClick={() => { setHideOldOrders(false); setShowTodayOnly(false); setOrderPage(1); }}>
          Alle ordre
        </button>
        <button className={calendarView ? "btn active" : "btn"} onClick={() => setCalendarView(!calendarView)}>
          🗓 Kalender
        </button>
        <button className="btn" onClick={() => toggleSort("date")}>Dato{sortIcon("date")}</button>
        <button className="btn" onClick={() => toggleSort("customer")}>Kunde{sortIcon("customer")}</button>
        <button className="btn" onClick={() => toggleSort("orderNumber")}>Ordrenr{sortIcon("orderNumber")}</button>
      </div>

      <p style={{ color: "#64748b", margin: "0 0 12px" }}>
        {showTodayOnly ? `Viser ${filteredOrders.length} ordre for i dag` : hideOldOrders ? `${filteredOrders.length} ordre (siste 3 dager og fremover)` : `${activeOrders.length} aktive ordre totalt`}
        {orderSearch && ` · ${filteredOrders.length} treff`}
        {hideOldOrders && !showTodayOnly && (
          <button className="link" style={{ marginLeft: 8, fontSize: 13 }} onClick={() => { setHideOldOrders(false); setOrderPage(1); }}>Vis alle</button>
        )}
      </p>

      {pagedOrders.map((o) => {
        const warnings = orderAllergenWarnings(o);
        const isExpanded = expandedOrderId === o.id;
        const displayName = o.customerType === "bedrift" || o.customerType === "storkjokken" ? o.companyName || o.customer : o.customer;
        const total = orderTotalIncVat(o);
        const isToday = o.date === todayStr;
        return (
          <div key={o.id} className="order-row" style={{ borderLeft: isToday ? "4px solid #166534" : undefined, background: isToday ? "#f0fdf4" : undefined }}>
            <button className="order-row-header" onClick={() => setExpandedOrderId(isExpanded ? null : o.id)}>
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                {isToday && <span style={{ background: "#166534", color: "white", borderRadius: 6, padding: "2px 8px", fontSize: 12, fontWeight: 700 }}>I dag</span>}
                <b>{formatDateNo(o.date)} {o.time || ""}</b>
                <span>{displayName}</span>
                {o.orderNumber && <span style={{ background: "#f1f5f9", borderRadius: 6, padding: "2px 8px", fontSize: 12 }}>#{o.orderNumber}</span>}
                {warnings.length > 0 && <span style={{ color: "#dc2626", fontSize: 12 }}>⚠ Allergi</span>}
                <span style={{ color: "#64748b", fontSize: 13 }}>{o.type}</span>
                <span style={{ color: "#64748b", fontSize: 13 }}>{o.orderLines.map((l) => `${l.quantity}×${productName(l.productId)}`).join(", ")}</span>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <b>{currency(total)}</b>
                <span style={{ color: "#64748b" }}>{isExpanded ? "▲" : "▼"}</span>
              </div>
            </button>
            {isExpanded && (
              <div className="order-row-body">
                <div className="grid two" style={{ gap: 12, marginBottom: 12 }}>
                  <div>
                    <p><b>Telefon:</b> {o.phone || "-"}</p>
                    <p><b>Levering:</b> {o.deliveryAddress || "-"}</p>
                    <p><b>Betaling:</b> {o.paymentInfo || "-"}</p>
                    {o.note && <p style={{ whiteSpace: "pre-wrap" }}><b>Notat:</b><br />{o.note}</p>}
                  </div>
                  <div>
                    {(o.dietVegetarian !== "0" || o.dietVegan !== "0" || o.dietPregnant !== "0" || o.dietOther) && (
                      <p><b>Dietter:</b> vegetar {o.dietVegetarian || 0}, vegan {o.dietVegan || 0}, gravid {o.dietPregnant || 0}{o.dietOther ? ` · ${o.dietOther}` : ""}</p>
                    )}
                    {selectedAllergens(o).length > 0 && <p><b>Allergier:</b> {selectedAllergens(o).join(", ")}</p>}
                    {warnings.length > 0 && <div className="warning"><b>Allergivarsel:</b> {warnings.join(", ")}</div>}
                  </div>
                </div>
                <table>
                  <thead><tr><th>Antall</th><th>Produkt</th><th>Pris</th><th>Sum</th></tr></thead>
                  <tbody>{o.orderLines.map((l, i) => { const product = data.products.find((p) => p.id === l.productId); return <tr key={i}><td>{l.quantity}</td><td>{product?.name || "Ukjent"}</td><td>{currency(product?.customerPrice || 0)}</td><td>{currency((product?.customerPrice || 0) * l.quantity)}</td></tr>; })}</tbody>
                </table>
                <details style={{ marginTop: 10 }}>
                  <summary style={{ cursor: "pointer", color: "#64748b" }}>Produksjonsgrunnlag</summary>
                  <table><tbody>{productionRowsForOrder(o).map((r, i) => <tr key={i}><td>{r.courseName || r.source}</td><td>{r.name}</td><td>{formatAmountUnit(r.amount, r.unit)}</td></tr>)}</tbody></table>
                </details>
                <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                  <button className="btn" onClick={() => editOrder(o)}>Rediger</button>
                  <select
                    className="btn"
                    defaultValue=""
                    style={{ width: "auto", maxWidth: 220 }}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v) printOrder(o, v as "basis" | "recipes" | "full");
                      e.target.value = "";
                    }}
                  >
                    <option value="" disabled>Skriv ut...</option>
                    <option value="basis">Print ordre</option>
                    <option value="recipes">Print med oppskrift</option>
                    <option value="full">Print med oppskrift/varebestilling</option>
                  </select>
                  <button className="btn danger" onClick={() => softDeleteOrder(o.id)}>Flytt til papirkurv</button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <div className="pager">
        <button className="btn" disabled={orderPage <= 1} onClick={() => setOrderPage(orderPage - 1)}>Forrige</button>
        <span>Side {orderPage} av {totalPages}</span>
        <button className="btn" disabled={orderPage >= totalPages} onClick={() => setOrderPage(orderPage + 1)}>Neste</button>
      </div>

      {showTrash && (
        <div className="soft-box" style={{ marginTop: 24 }}>
          <div className="between">
            <h3>🗑 Papirkurv – {deletedOrders.length} ordre</h3>
            {deletedOrders.length > 0 && <button className="btn danger" onClick={emptyTrash}>Tøm papirkurv</button>}
          </div>
          <p style={{ color: "#64748b" }}>Ordre i papirkurven kan gjenopprettes eller slettes permanent.</p>
          {deletedOrders.length === 0 && <p>Papirkurven er tom.</p>}
          {deletedOrders.map((o) => {
            const displayName = o.customerType === "bedrift" ? o.companyName || o.customer : o.customer;
            return (
              <div key={o.id} className="editable-row">
                <div>
                  <b>{formatDateNo(o.date)} {o.time || ""} · {displayName}</b>
                  {o.orderNumber && <span style={{ marginLeft: 8, fontSize: 12, color: "#64748b" }}>#{o.orderNumber}</span>}
                  <br /><small>{o.orderLines.map((l) => `${l.quantity}×${productName(l.productId)}`).join(", ")}</small>
                  <br /><small style={{ color: "#64748b" }}>Slettet: {o.deletedAt ? formatDateNo(o.deletedAt.slice(0, 10)) : "-"}</small>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn" onClick={() => restoreOrder(o.id)}>Gjenopprett</button>
                  <button className="btn danger" onClick={() => permanentDeleteOrder(o.id)}>Slett permanent</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style jsx global>{`
        .order-row { border: 1px solid #e2e8f0; border-radius: 14px; margin: 8px 0; overflow: hidden; background: white; }
        .order-row-header { width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; background: inherit; border: 0; cursor: pointer; text-align: left; gap: 12px; }
        .order-row-header:hover { filter: brightness(0.97); }
        .order-row-body { padding: 0 16px 16px; border-top: 1px solid #e2e8f0; background: #fafafa; }
      `}</style>
    </section>
  );
}

function ProductionTab({
  data,
  updateData,
}: {
  data: AppData;
  updateData: (p: Partial<AppData>) => void;
}) {
  const productionCategories: { id: ProductionCategory; name: string }[] = [
    { id: "smabakst", name: "Småbakst" },
    { id: "brod", name: "Brød" },
    { id: "spesialbrod", name: "Spesialbrød" },
    { id: "pasmuurt", name: "Påsmurt" },
  ];

  const [activeDate, setActiveDate] = useState(today());
  const [mainPanel, setMainPanel] = useState<"bakeri" | "catering">("bakeri");
  const [panel, setPanel] = useState<"day" | "template" | "customers" | "recurring" | "invoice">("day");
  const [categoryFilter, setCategoryFilter] = useState<"alle" | ProductionCategory>("alle");
  const [invoiceFrom, setInvoiceFrom] = useState(today());
  const [invoiceTo, setInvoiceTo] = useState(today());
  const [invoiceWarning, setInvoiceWarning] = useState("");
  const [newCustomer, setNewCustomer] = useState({ name: "", orgNumber: "", address: "", deliveryAddress: "", phone: "" });
  const [newTemplateProductId, setNewTemplateProductId] = useState("");
  const [newTemplateCategory, setNewTemplateCategory] = useState<ProductionCategory>("smabakst");
  const [expandedCateringOrderId, setExpandedCateringOrderId] = useState<string | null>(null);

  const productionDays = data.bakeryProductionDays || {};
  const activeDay: BakeryProductionDay = productionDays[activeDate] || {
    date: activeDate, approved: false, quantities: {},
  };

  const storkjokkenCustomers = (data.storkjokkenCustomers || []).filter((c) => c.active !== false);
  const columns = [
    { id: "butikk", name: "Butikk", invoice: false },
    ...storkjokkenCustomers.map((c) => ({ id: c.id, name: c.name, invoice: true })),
  ];

  // Cateringordre for valgt dag
  const cateringOrders = data.orders.filter(
    (o) => o.date === activeDate && !o.deletedAt && (o.type === "catering" || o.type === "pasmuurt")
  ).sort((a, b) => (a.time || "").localeCompare(b.time || ""));

  function addDays(date: string, days: number) {
    const [year, month, day] = date.split("-").map(Number);
    const d = new Date(year, month - 1, day);
    d.setDate(d.getDate() + days);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function weekdayNo(date: string) {
    return ["Søndag", "Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag"][new Date(date + "T00:00:00").getDay()];
  }

  function weekdayNumber(date: string) {
    const jsDay = new Date(date + "T00:00:00").getDay();
    return jsDay === 0 ? 7 : jsDay;
  }

  function listDates(from: string, to: string) {
    const dates: string[] = []; let current = from; let guard = 0;
    while (current <= to && guard < 90) { dates.push(current); current = addDays(current, 1); guard++; }
    return dates;
  }

  const templateLines = data.bakeryProductionTemplateLines || [];
  const visibleTemplateLines = templateLines
    .filter((line) => categoryFilter === "alle" || line.category === categoryFilter)
    .sort((a, b) => {
      const catA = productionCategories.findIndex((c) => c.id === a.category);
      const catB = productionCategories.findIndex((c) => c.id === b.category);
      return catA - catB || a.sortOrder - b.sortOrder;
    });

  function saveDay(nextDay: BakeryProductionDay) {
    updateData({ bakeryProductionDays: { ...productionDays, [nextDay.date]: nextDay } });
  }

  function setCell(productId: string, columnId: string, value: number) {
    saveDay({
      ...activeDay,
      quantities: {
        ...activeDay.quantities,
        [productId]: { ...(activeDay.quantities[productId] || {}), [columnId]: value },
      },
    });
  }

  function totalForProduct(productId: string, day: BakeryProductionDay = activeDay) {
    const row = day.quantities[productId] || {};
    return columns.reduce((sum, col) => sum + Number(row[col.id] || 0), 0);
  }

  function kgForProduct(product: Product, quantity: number) {
    return quantity * Number(product.unitWeightKg || product.yieldAmount || 1);
  }

  const dayRows = templateLines.map((line) => {
    const product = data.products.find((p) => p.id === line.productId);
    if (!product) return null;
    const quantity = totalForProduct(product.id);
    return { line, product, quantity, kg: kgForProduct(product, quantity) };
  }).filter(Boolean) as { line: BakeryProductionTemplateLine; product: Product; quantity: number; kg: number }[];

  const activeRows = dayRows.filter((r) => r.quantity > 0);
  const totalUnits = activeRows.reduce((sum, row) => sum + row.quantity, 0);

  function addTemplateLine() {
    if (!newTemplateProductId) return alert("Velg et produkt først.");
    const exists = (data.bakeryProductionTemplateLines || []).some((line) => line.productId === newTemplateProductId);
    if (exists) return alert("Produktet ligger allerede i produksjonsmalen.");
    const nextLine: BakeryProductionTemplateLine = {
      id: `production-template-${Date.now()}`,
      productId: newTemplateProductId,
      category: newTemplateCategory,
      sortOrder: (data.bakeryProductionTemplateLines || []).length + 1,
    };
    updateData({ bakeryProductionTemplateLines: [...(data.bakeryProductionTemplateLines || []), nextLine] });
    setNewTemplateProductId("");
  }

  function removeTemplateLine(id: string) {
    updateData({ bakeryProductionTemplateLines: (data.bakeryProductionTemplateLines || []).filter((x) => x.id !== id) });
  }

  function addCustomer() {
    if (!newCustomer.name.trim()) return alert("Legg inn kundenavn.");
    const customer: StorkjokkenCustomer = {
      id: `customer-${Date.now()}`, name: newCustomer.name.trim(), orgNumber: newCustomer.orgNumber,
      address: newCustomer.address, deliveryAddress: newCustomer.deliveryAddress, phone: newCustomer.phone, active: true,
    };
    updateData({ storkjokkenCustomers: [...(data.storkjokkenCustomers || []), customer] });
    setNewCustomer({ name: "", orgNumber: "", address: "", deliveryAddress: "", phone: "" });
  }

  function deleteCustomer(id: string) {
    updateData({ storkjokkenCustomers: (data.storkjokkenCustomers || []).filter((x) => x.id !== id) });
  }

  function priceForCustomer(productId: string, customerId: string) {
    const special = (data.storkjokkenSpecialPrices || []).find((x) => x.customerId === customerId && x.productId === productId);
    if (special) return special.priceExVat;
    const product = data.products.find((p) => p.id === productId);
    if (!product) return 0;
    return product.storkjokkenPriceExVat || exVatFromIncVat(product.customerPrice || 0, data.settings.foodVat);
  }

  function setSpecialPrice(customerId: string, productId: string, priceExVat: number) {
    const existing = data.storkjokkenSpecialPrices || [];
    const without = existing.filter((x) => !(x.customerId === customerId && x.productId === productId));
    if (!priceExVat) { updateData({ storkjokkenSpecialPrices: without }); return; }
    updateData({ storkjokkenSpecialPrices: [...without, { customerId, productId, priceExVat }] });
  }

  function invoiceRows(from: string, to: string) {
    const dates = listDates(from, to);
    const rows: { customerId: string; customerName: string; productId: string; productName: string; quantity: number; priceExVat: number; sumExVat: number; vat: number; sumIncVat: number }[] = [];
    storkjokkenCustomers.forEach((customer) => {
      data.products.forEach((product) => {
        let quantity = 0;
        dates.forEach((date) => { const day = productionDays[date]; if (!day?.approved) return; quantity += Number(day.quantities?.[product.id]?.[customer.id] || 0); });
        if (!quantity) return;
        const priceExVat = priceForCustomer(product.id, customer.id);
        const sumExVat = quantity * priceExVat; const vat = sumExVat * 0.15;
        rows.push({ customerId: customer.id, customerName: customer.name, productId: product.id, productName: product.name, quantity, priceExVat, sumExVat, vat, sumIncVat: sumExVat + vat });
      });
    });
    return rows;
  }

  function groupedInvoiceRows(from: string, to: string) {
    const map: Record<string, { customerName: string; rows: ReturnType<typeof invoiceRows>; sumExVat: number; vat: number; sumIncVat: number }> = {};
    invoiceRows(from, to).forEach((row) => {
      if (!map[row.customerId]) map[row.customerId] = { customerName: row.customerName, rows: [], sumExVat: 0, vat: 0, sumIncVat: 0 };
      map[row.customerId].rows.push(row);
      map[row.customerId].sumExVat += row.sumExVat;
      map[row.customerId].vat += row.vat;
      map[row.customerId].sumIncVat += row.sumIncVat;
    });
    return Object.values(map);
  }

  function printWindow(title: string, body: string) {
    const w = window.open("", "_blank"); if (!w) return;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8" /><title>${escapeHtml(title)}</title><style>
@page{size:A4;margin:12mm}
body{font-family:Arial,sans-serif;color:#111827;padding:24px;line-height:1.35}
.print-header{display:flex;justify-content:center;align-items:center;margin-bottom:20px}
.print-logo{max-width:220px;max-height:90px;object-fit:contain}
.logo{height:90px;width:auto;object-fit:contain;margin-bottom:8px}
.page{break-after:page;border:2px solid #111827;border-radius:14px;padding:18px;margin-bottom:18px}
.page:last-child{break-after:auto}
.top{border-bottom:2px solid #111827;padding-bottom:12px;margin-bottom:16px;display:flex;justify-content:space-between;gap:12px}
h1,h2,h3{margin-top:0}
table{width:100%;border-collapse:collapse;margin-top:10px;font-size:12px}
th,td{border-bottom:1px solid #e5e7eb;padding:8px;text-align:left;vertical-align:top}
th{background:#f3f4f6}
.right{text-align:right}.muted{color:#64748b}
.total{font-weight:900;background:#f8fafc}
.recipe-block{margin:12px 0;background:#f8fafc;border-radius:8px;padding:12px}
.recipe-block h3{margin:0 0 8px;font-size:14px}
button{padding:10px 14px;border-radius:10px;border:1px solid #111827;background:#111827;color:white;font-weight:800;cursor:pointer;margin-bottom:14px}
@media print{button{display:none}body{padding:0}}
</style></head><body><button onclick="window.print()">Skriv ut</button>${body}</body></html>`);
    w.document.close(); w.focus();
  }

  // ── Skalert oppskrift for ett produkt (brukes i catering-print) ───────────
  function scaledRecipeHtml(product: Product, quantity: number, menuSelections?: MenuCourseSelection[]): string {
    if (product.type === "selskapsmeny" && (product.menuCourses || []).length) {
      if (!menuSelections || !menuSelections.length) return "<p>Ingen menyvalg registrert for denne bestillingen.</p>";
      return menuSelections.map((sel) => {
        const chosenProduct = data.products.find((x) => x.id === sel.productId);
        if (!chosenProduct) return "";
        return `<div class="recipe-block"><h3>${escapeHtml(product.menuCourses!.find((c) => c.id === sel.courseId)?.name || "Rett")}: ${escapeHtml(chosenProduct.name)} (${sel.guestCount} stk)</h3>${scaledRecipeHtml(chosenProduct, sel.guestCount)}</div>`;
      }).join("");
    }
    let html = "";
    product.lines.forEach((pl) => {
      if (pl.itemType === "recipe") {
        const recipe = data.recipes.find((r) => r.id === pl.itemId);
        if (!recipe) return;
        const totalAmount = Number(pl.amount || 0) * quantity;
        const recipeBase = recipe.lines.reduce((s, rl) => s + Number(rl.amount || 0), 0) || Number(recipe.yieldAmount || 1) || 1;
        const scale = totalAmount / Math.max(recipeBase, 1);
        const ingredientRows = recipe.lines.map((rl) => {
          let name = "Ukjent"; let unit = recipe.yieldUnit;
          if (rl.itemType === "material") { const m = data.materials.find((m) => m.id === rl.itemId); name = m?.name || "Ukjent råvare"; unit = m?.unit || recipe.yieldUnit; }
          if (rl.itemType === "recipe") { const sr = data.recipes.find((r) => r.id === rl.itemId); name = sr?.name || "Ukjent grunnoppskrift"; unit = sr?.yieldUnit || recipe.yieldUnit; }
          return `<tr><td>${escapeHtml(name)}</td><td class="right">${num(Number(rl.amount || 0) * scale, 3)} ${escapeHtml(unit)}</td></tr>`;
        }).join("");
        html += `<div class="recipe-block"><h3>Grunnoppskrift: ${escapeHtml(recipe.name)} – ${num(totalAmount, 3)} ${escapeHtml(pl.unit)} (for ${quantity} porsjoner)</h3><table><thead><tr><th>Ingrediens</th><th class="right">Mengde</th></tr></thead><tbody>${ingredientRows}</tbody></table></div>`;
      }
      if (pl.itemType === "material") {
        const m = data.materials.find((x) => x.id === pl.itemId);
        if (m) html += `<div class="recipe-block"><h3>Råvare: ${escapeHtml(m.name)}</h3><p>${num(Number(pl.amount || 0) * quantity, 3)} ${escapeHtml(pl.unit)}</p></div>`;
      }
      if (pl.itemType === "product") {
        const subProduct = data.products.find((x) => x.id === pl.itemId);
        if (subProduct && subProduct.id !== product.id) {
          const totalAmount = Number(pl.amount || 0) * quantity;
          // Skaler underproduktets oppskrift: totalAmount er i pl.unit (f.eks. kg),
          // underproduktets oppskrift er definert per yieldAmount av samme enhet
          const subYield = Number(subProduct.yieldAmount || 1) || 1;
          const subScale = totalAmount / subYield;
          html += `<div class="recipe-block"><h3>Produkt: ${escapeHtml(subProduct.name)} – ${num(totalAmount, 3)} ${escapeHtml(pl.unit)}</h3>${scaledRecipeHtml(subProduct, subScale)}</div>`;
        }
      }
    });
    return html || "<p>Ingen oppskriftslinjer registrert på produktet.</p>";
  }

  function printPackingSlip(order: Order) {
  const customerName = order.customerType === "bedrift"
    ? `${order.companyName || ""}${order.orgNumber ? ` (${order.orgNumber})` : ""}`
    : order.customer;

  const subtotal = order.orderLines.reduce((sum, ol) => {
    const p = data.products.find((x) => x.id === ol.productId);
    return sum + (p?.customerPrice || 0) * ol.quantity;
  }, 0);
  const discount = subtotal * ((Number(order.discountPercent) || 0) / 100);
  const total = subtotal - discount;
  const totalEx = exVatFromIncVat(total, data.settings.foodVat);

  const rows = order.orderLines.map((ol) => {
    const p = data.products.find((x) => x.id === ol.productId);
    const lineTotal = (p?.customerPrice || 0) * ol.quantity;
    return `
<tr>
  <td>${escapeHtml(p?.name || "Ukjent")}</td>
  <td class="right">${ol.quantity} stk</td>
  <td class="right">${currency(p?.customerPrice || 0)}</td>
  <td class="right"><b>${currency(lineTotal)}</b></td>
</tr>`;
  }).join("");

  const w = window.open("", "_blank"); if (!w) return;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8" /><title>Pakkseddel</title><style>
@page{size:A4;margin:14mm}
body{font-family:Arial,sans-serif;color:#111827;padding:24px;line-height:1.4}
.top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #111827;padding-bottom:14px;margin-bottom:18px}
.logo{height:90px;width:auto;object-fit:contain}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:18px}
.box{border:1px solid #e5e7eb;border-radius:12px;padding:14px}
h1{font-size:22px;margin:4px 0}
h2{font-size:15px;margin:0 0 8px;color:#374151}
table{width:100%;border-collapse:collapse;margin-top:10px}
th,td{border-bottom:1px solid #e5e7eb;padding:9px;text-align:left}
th{background:#f3f4f6}
.right{text-align:right}
.total-row{font-size:18px;font-weight:900;background:#f8fafc}
.footer{margin-top:30px;text-align:center;font-size:12px;color:#64748b;border-top:1px solid #e2e8f0;padding-top:14px}
@media print{button{display:none}body{padding:0}}
</style></head><body>
<button onclick="window.print()">Print pakkseddel</button>

<div class="top">
  <div>
    <img src="/logo.png" class="logo" />
    <h1>Pakkseddel</h1>
    <p style="margin:4px 0;color:#64748b">${formatDateNo(order.date)} ${order.time || ""}${order.orderNumber ? ` · Ordrenr: ${escapeHtml(order.orderNumber)}` : ""}</p>
  </div>
  <div style="text-align:right">
    <p><b>${escapeHtml(customerName || "")}</b></p>
    <p>${escapeHtml(order.deliveryAddress || "-")}</p>
  </div>
</div>

<div class="info-grid">
  <div class="box">
    <h2>Kunde</h2>
    <p><b>${escapeHtml(customerName || "Ikke angitt")}</b></p>
    <p>Kontakt: ${escapeHtml(order.customer || "-")}</p>
    <p>Telefon: ${escapeHtml(order.phone || "-")}</p>
    <p>Leveringsadresse: ${escapeHtml(order.deliveryAddress || "-")}</p>
  </div>
  <div class="box">
    <h2>Betaling</h2>
    <p>${escapeHtml(order.paymentInfo || "Ikke registrert")}</p>
    ${order.note ? `<p><b>Notat:</b><br>${escapeHtml(order.note).replace(/\n/g, "<br>")}</p>` : ""}
  </div>
</div>

<table>
  <thead>
    <tr>
      <th>Produkt</th>
      <th class="right">Antall</th>
      <th class="right">Pris inkl. mva</th>
      <th class="right">Sum inkl. mva</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
  <tfoot>
    ${order.discountPercent ? `<tr><td colspan="3">Rabatt ${order.discountPercent}%</td><td class="right">-${currency(discount)}</td></tr>` : ""}
    <tr class="total-row">
      <td colspan="3">Total inkl. mva</td>
      <td class="right">${currency(total)}</td>
    </tr>
    <tr>
      <td colspan="3" style="color:#64748b">Herav mva</td>
      <td class="right" style="color:#64748b">${currency(total - totalEx)}</td>
    </tr>
  </tfoot>
</table>

<div class="footer">
  Brødrene Berbusmel · brodrene@berbusmel.no · Tlf 413 73 000
</div>
</body></html>`);
  w.document.close(); w.focus();
}

  // ── Print én cateringordre med skalert oppskrift ──────────────────────────
  function printCateringOrder(order: Order) {
  const customerName = order.customerType === "bedrift"
    ? `${order.companyName || ""}${order.orgNumber ? ` (${order.orgNumber})` : ""}`
    : order.customer;

  const subtotal = order.orderLines.reduce((sum, ol) => {
    const p = data.products.find((x) => x.id === ol.productId);
    return sum + (p?.customerPrice || 0) * ol.quantity;
  }, 0);
  const discount = subtotal * ((Number(order.discountPercent) || 0) / 100);
  const total = subtotal - discount;

  const orderSummaryRows = order.orderLines.map((ol) => {
    const p = data.products.find((x) => x.id === ol.productId);
    const lineTotal = (p?.customerPrice || 0) * ol.quantity;
    return `<tr><td>${ol.quantity} × ${escapeHtml(p?.name || "Ukjent")}</td><td class="right">${currency(p?.customerPrice || 0)}</td><td class="right">${currency(lineTotal)}</td></tr>`;
  }).join("");

  const orderPages = order.orderLines.map((ol) => {
    const product = data.products.find((p) => p.id === ol.productId);
    if (!product) return "";
    return `
<div class="page">
  <div class="top">
    <div><h1>${escapeHtml(product.name)}</h1>
    <p class="muted">${escapeHtml(customerName || "")} · ${ol.quantity} porsjoner / stk</p></div>
    <div class="right"><b>${formatDateNo(order.date)} ${order.time || ""}</b></div>
  </div>
  ${scaledRecipeHtml(product, ol.quantity, ol.menuSelections)}
</div>`;
  }).join("");

  const body = `
<div class="print-header"><img src="/logo.png" class="print-logo" /></div>
<div class="page">
  <div class="top">
    <div>
      <img src="/logo.png" class="logo" />
      <h1>Cateringordre</h1>
    </div>
    <div class="right">
      <b>${formatDateNo(order.date)} ${order.time || ""}</b>
      ${order.orderNumber ? `<br>Ordrenr: ${escapeHtml(order.orderNumber)}` : ""}
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
    <div class="box">
      <h2>Kunde</h2>
      <p><b>${escapeHtml(customerName || "Ikke angitt")}</b></p>
      <p>Kontakt: ${escapeHtml(order.customer || "-")}</p>
      <p>Telefon: ${escapeHtml(order.phone || "-")}</p>
      <p>Levering: ${escapeHtml(order.deliveryAddress || "-")}</p>
      <p>Betaling: ${escapeHtml(order.paymentInfo || "-")}</p>
      ${order.note ? `<p><b>Notat:</b><br>${escapeHtml(order.note).replace(/\n/g, "<br>")}</p>` : ""}
    </div>
    <div class="box">
      <h2>Bestilling</h2>
      <table>
        <thead><tr><th>Produkt</th><th class="right">Pris</th><th class="right">Sum</th></tr></thead>
        <tbody>${orderSummaryRows}</tbody>
        <tfoot>
          ${order.discountPercent ? `<tr><td>Rabatt ${order.discountPercent}%</td><td></td><td class="right">-${currency(discount)}</td></tr>` : ""}
          <tr style="font-weight:900"><td>Total inkl. mva</td><td></td><td class="right">${currency(total)}</td></tr>
        </tfoot>
      </table>
    </div>
  </div>
</div>
${orderPages}`;

  printWindow(`Catering ${formatDateNo(order.date)} – ${customerName}`, body);
}
function printProductionDay() {
    const summaryRows = activeRows.map((row) => {
      const unitSize = Number(row.product.unitWeightKg || row.product.yieldAmount || 0);
      return `<tr><td><b>${escapeHtml(row.product.name)}</b><br><small>${escapeHtml(row.product.productNumber || "")}</small></td><td class="right">${row.quantity} stk</td><td class="right">${unitSize ? `${num(unitSize, 3)} kg/stk` : "-"}</td></tr>`;
    }).join("");

    const recipeMap: Record<string, { recipe: Recipe; totalAmount: number; unit: string; sources: { productName: string; quantity: number; amount: number; unit: string }[] }> = {};
    activeRows.forEach((row) => {
      row.product.lines.forEach((line) => {
        if (line.itemType !== "recipe") return;
        const recipe = data.recipes.find((r) => r.id === line.itemId); if (!recipe) return;
        const amount = Number(line.amount || 0) * row.quantity;
        if (!recipeMap[recipe.id]) recipeMap[recipe.id] = { recipe, totalAmount: 0, unit: line.unit, sources: [] };
        recipeMap[recipe.id].totalAmount += amount;
        recipeMap[recipe.id].sources.push({ productName: row.product.name, quantity: row.quantity, amount, unit: line.unit });
      });
    });

    const baseRecipePages = Object.values(recipeMap).map((entry) => {
      const recipe = entry.recipe;
      const recipeBaseAmount = recipe.lines.reduce((sum, line) => sum + Number(line.amount || 0), 0) || Number(recipe.yieldAmount || 1) || 1;
      const scale = entry.totalAmount / Math.max(recipeBaseAmount, 1);
      const sourceRows = entry.sources.map((source) => `<tr><td>${escapeHtml(source.productName)}</td><td class="right">${source.quantity} stk</td><td class="right">${num(source.amount, 3)} ${escapeHtml(source.unit)}</td></tr>`).join("");
      const ingredientRows = recipe.lines.map((line) => {
        let name = "Ukjent"; let unit = recipe.yieldUnit;
        if (line.itemType === "material") { const material = data.materials.find((m) => m.id === line.itemId); name = material?.name || "Ukjent råvare"; unit = material?.unit || recipe.yieldUnit; }
        if (line.itemType === "recipe") { const subRecipe = data.recipes.find((r) => r.id === line.itemId); name = subRecipe?.name || "Ukjent grunnoppskrift"; unit = subRecipe?.yieldUnit || recipe.yieldUnit; }
        return `<tr><td>${escapeHtml(name)}</td><td class="right">${num(Number(line.amount || 0) * scale, 3)} ${escapeHtml(unit)}</td></tr>`;
      }).join("");
      return `<div class="page"><div class="top"><div><h1>Grunnoppskrift: ${escapeHtml(recipe.name)}</h1><p class="muted">Summert fra alle produkter denne dagen</p></div><div class="right"><b>${num(entry.totalAmount, 3)} ${escapeHtml(entry.unit)}</b><br>${formatDateNo(activeDate)}</div></div><h2>Brukes til</h2><table><thead><tr><th>Produkt</th><th class="right">Antall</th><th class="right">Mengde</th></tr></thead><tbody>${sourceRows}</tbody></table><h2>Skalert oppskrift</h2><table><thead><tr><th>Ingrediens</th><th class="right">Mengde</th></tr></thead><tbody>${ingredientRows}</tbody></table></div>`;
    }).join("");

    const productPages = activeRows.map((row) => {
      const product = row.product;
      const lineRows = product.lines.map((line) => {
        const amount = Number(line.amount || 0) * row.quantity;
        let name = "Ukjent";
        if (line.itemType === "material") name = data.materials.find((m) => m.id === line.itemId)?.name || "Ukjent råvare";
        if (line.itemType === "recipe") name = data.recipes.find((r) => r.id === line.itemId)?.name || "Ukjent grunnoppskrift";
        if (line.itemType === "product") name = data.products.find((p) => p.id === line.itemId)?.name || "Ukjent produkt";
        return `<tr><td>${escapeHtml(name)}</td><td>${escapeHtml(line.itemType)}</td><td class="right">${num(amount, 3)} ${escapeHtml(line.unit)}</td></tr>`;
      }).join("");
      return `<div class="page"><div class="top"><div><h1>Produkt: ${escapeHtml(product.name)}</h1><p class="muted">${escapeHtml(product.category)} · ${row.quantity} stk</p></div><div class="right"><b>${formatDateNo(activeDate)}</b></div></div><table><thead><tr><th>Innhold</th><th>Type</th><th class="right">Mengde</th></tr></thead><tbody>${lineRows || `<tr><td colspan="3">Ingen linjer registrert.</td></tr>`}</tbody></table></div>`;
    }).join("");

    const packingPages = storkjokkenCustomers.map((customer) => {
      const rows = data.products.map((product) => { const qty = Number(activeDay.quantities?.[product.id]?.[customer.id] || 0); if (!qty) return ""; return `<tr><td class="right"><b>${qty}</b></td><td>${escapeHtml(product.name)}</td></tr>`; }).join("");
      if (!rows) return "";
      return `<div class="page"><div class="top"><div><h1>Pakkseddel</h1><p class="muted">${escapeHtml(customer.name)}</p></div><div class="right"><b>${formatDateNo(activeDate)}</b></div></div><table><thead><tr><th class="right">Antall</th><th>Produkt</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    }).join("");

    const body = `
<div class="print-header"><img src="/logo.png" class="print-logo" /></div>
<div class="page">
  <div class="top">
    <div><img src="/logo.png" class="logo" /><h1>Produksjon for dagen</h1><p class="muted">${weekdayNo(activeDate)} ${formatDateNo(activeDate)}</p></div>
    <div class="right"><b>${totalUnits} stk totalt</b></div>
  </div>
  <table>
    <thead><tr><th>Produkt</th><th class="right">Antall stk</th><th class="right">Størrelse</th></tr></thead>
    <tbody>${summaryRows || `<tr><td colspan="3">Ingen produksjon registrert.</td></tr>`}</tbody>
  </table>
</div>
${baseRecipePages}${productPages}${packingPages}`;

    printWindow(`Produksjon ${activeDate}`, body);
  }
// ── Print alle cateringordre for dagen ───────────────────────────────────
  function printCateringDay() {
    if (!cateringOrders.length) return alert("Ingen cateringordre denne dagen.");

    const forsideRows = cateringOrders.map((o) => {
      const customerName = o.customerType === "bedrift" ? o.companyName || o.customer : o.customer;
      return `<tr><td>${o.time || "-"}</td><td><b>${escapeHtml(customerName || "")}</b><br><small>${escapeHtml(o.phone || "")}</small></td><td>${o.orderLines.map((ol) => { const p = data.products.find((x) => x.id === ol.productId); return `${ol.quantity} × ${escapeHtml(p?.name || "Ukjent")}`; }).join("<br>")}</td><td>${escapeHtml(o.deliveryAddress || "-")}</td><td>${escapeHtml(o.paymentInfo || "-")}</td></tr>`;
    }).join("");

    const orderPages = cateringOrders.map((o) => {
      const customerName = o.customerType === "bedrift" ? `${o.companyName || ""}${o.orgNumber ? ` (${o.orgNumber})` : ""}` : o.customer;

      // Beregn totaler for pakkseddel
      const subtotal = o.orderLines.reduce((sum, ol) => {
        const p = data.products.find((x) => x.id === ol.productId);
        return sum + (p?.customerPrice || 0) * ol.quantity;
      }, 0);
      const discount = subtotal * ((Number(o.discountPercent) || 0) / 100);
      const total = subtotal - discount;
      const totalEx = exVatFromIncVat(total, data.settings.foodVat);

      const packingRows = o.orderLines.map((ol) => {
        const p = data.products.find((x) => x.id === ol.productId);
        const lineTotal = (p?.customerPrice || 0) * ol.quantity;
        return `<tr><td>${escapeHtml(p?.name || "Ukjent")}</td><td class="right">${ol.quantity} stk</td><td class="right">${currency(p?.customerPrice || 0)}</td><td class="right"><b>${currency(lineTotal)}</b></td></tr>`;
      }).join("");

      const pakkseddel = `
<div class="page">
  <div class="top">
    <div>
      <img src="/logo.png" class="logo" />
      <h1>Pakkseddel</h1>
      <p class="muted">${formatDateNo(o.date)} ${o.time || ""}${o.orderNumber ? ` · Ordrenr: ${escapeHtml(o.orderNumber)}` : ""}</p>
    </div>
    <div class="right">
      <p><b>${escapeHtml(customerName || "")}</b></p>
      <p>${escapeHtml(o.deliveryAddress || "-")}</p>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
    <div class="box">
      <h2>Kunde</h2>
      <p><b>${escapeHtml(customerName || "Ikke angitt")}</b></p>
      <p>Kontakt: ${escapeHtml(o.customer || "-")}</p>
      <p>Telefon: ${escapeHtml(o.phone || "-")}</p>
      <p>Leveringsadresse: ${escapeHtml(o.deliveryAddress || "-")}</p>
    </div>
    <div class="box">
      <h2>Betaling</h2>
      <p>${escapeHtml(o.paymentInfo || "Ikke registrert")}</p>
      ${o.note ? `<p><b>Notat:</b><br>${escapeHtml(o.note).replace(/\n/g, "<br>")}</p>` : ""}
    </div>
  </div>
  <table>
    <thead><tr><th>Produkt</th><th class="right">Antall</th><th class="right">Pris inkl. mva</th><th class="right">Sum inkl. mva</th></tr></thead>
    <tbody>${packingRows}</tbody>
    <tfoot>
      ${o.discountPercent ? `<tr><td colspan="3">Rabatt ${o.discountPercent}%</td><td class="right">-${currency(discount)}</td></tr>` : ""}
      <tr style="font-weight:900;background:#f8fafc"><td colspan="3">Total inkl. mva</td><td class="right">${currency(total)}</td></tr>
      <tr><td colspan="3" style="color:#64748b">Herav mva</td><td class="right" style="color:#64748b">${currency(total - totalEx)}</td></tr>
    </tfoot>
  </table>
  <div style="margin-top:30px;text-align:center;font-size:12px;color:#64748b;border-top:1px solid #e2e8f0;padding-top:14px">
    Brødrene Berbusmel · brodrene@berbusmel.no · Tlf 413 73 000
  </div>
</div>`;

      // Oppskriftsider per produkt
      const recipesPages = o.orderLines.map((ol) => {
        const product = data.products.find((p) => p.id === ol.productId);
        if (!product) return "";
return `<div class="page"><div class="top"><div><h1>${escapeHtml(product.name)}</h1><p class="muted">${escapeHtml(customerName || "")} · ${ol.quantity} porsjoner / stk</p></div><div class="right"><b>${formatDateNo(o.date)} ${o.time || ""}</b></div></div>${scaledRecipeHtml(product, ol.quantity, ol.menuSelections)}</div>`;      }).join("");

      return pakkseddel + recipesPages;
    }).join("");

    const body = `
<div class="print-header"><img src="/logo.png" class="print-logo" /></div>
<div class="page">
  <div class="top">
    <div><img src="/logo.png" class="logo" /><h1>Catering – oversikt for dagen</h1><p class="muted">${weekdayNo(activeDate)} ${formatDateNo(activeDate)}</p></div>
    <div class="right"><b>${cateringOrders.length} ordre</b></div>
  </div>
  <table>
    <thead><tr><th>Tid</th><th>Kunde</th><th>Produkter</th><th>Levering</th><th>Betaling</th></tr></thead>
    <tbody>${forsideRows}</tbody>
  </table>
</div>
${orderPages}`;

    printWindow(`Catering ${formatDateNo(activeDate)}`, body);
  }

  function printInvoice() {
    const missing = listDates(invoiceFrom, invoiceTo).filter((date) => !productionDays[date]?.approved);
    if (missing.length) { setInvoiceWarning(`Kan ikke printe fakturagrunnlag. Disse dagene må godkjennes først: ${missing.map((d) => `${weekdayNo(d)} ${formatDateNo(d)}`).join(", ")}`); return; }
    setInvoiceWarning("");
    const grouped = groupedInvoiceRows(invoiceFrom, invoiceTo);
    const body = grouped.map((group) => {
      const rows = group.rows.map((row) => `<tr><td>${escapeHtml(row.productName)}</td><td class="right">${row.quantity}</td><td class="right">${currency(row.priceExVat)}</td><td class="right">${currency(row.sumExVat)}</td><td class="right">${currency(row.vat)}</td><td class="right"><b>${currency(row.sumIncVat)}</b></td></tr>`).join("");
      return `<div class="page"><div class="top"><div><img src="/logo.png" class="logo" /><h1>Fakturagrunnlag</h1><p class="muted">${escapeHtml(group.customerName)}</p></div><div class="right"><b>${formatDateNo(invoiceFrom)} – ${formatDateNo(invoiceTo)}</b><br>MVA 15 %</div></div><table><thead><tr><th>Produkt</th><th class="right">Antall totalt</th><th class="right">Pris eks.</th><th class="right">Sum eks.</th><th class="right">MVA 15%</th><th class="right">Sum inkl.</th></tr></thead><tbody>${rows}</tbody><tfoot><tr class="total"><td colspan="3">Sum</td><td class="right">${currency(group.sumExVat)}</td><td class="right">${currency(group.vat)}</td><td class="right">${currency(group.sumIncVat)}</td></tr></tfoot></table></div>`;
    }).join("");
    printWindow(`Fakturagrunnlag ${invoiceFrom} - ${invoiceTo}`, body || "<p>Ingen fakturalinjer i perioden.</p>");
  }

  function applyRecurringOrdersForDay() {
    const dayNo = weekdayNumber(activeDate);
    let nextDay = { ...activeDay, quantities: { ...activeDay.quantities } };
    (data.recurringStorkjokkenOrders || []).filter((order) => order.active && order.weekdays.includes(dayNo)).forEach((order) => {
      order.lines.forEach((line) => {
        nextDay.quantities[line.productId] = { ...(nextDay.quantities[line.productId] || {}), [order.customerId]: Number(nextDay.quantities[line.productId]?.[order.customerId] || 0) + Number(line.quantity || 0) };
      });
    });
    saveDay(nextDay);
  }

  return (
    <section>
      {/* Topplinje med dato og hovedvalg */}
      <div className="card">
        <div className="between">
          <div>
            <h2>Produksjon</h2>
            <p style={{ color: "#64748b" }}>Velg dag og kategori.</p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {/* Bakeri / Catering hovedvalg */}
            <button className={mainPanel === "bakeri" ? "btn active" : "btn"} onClick={() => setMainPanel("bakeri")}>🥖 Bakeri</button>
            <button className={mainPanel === "catering" ? "btn active" : "btn"} onClick={() => setMainPanel("catering")}>
              🍽 Catering {cateringOrders.length > 0 && `(${cateringOrders.length})`}
            </button>
          </div>
        </div>
      </div>

      {/* Datovelger */}
      <div className="card">
        <div className="production-date-row">
          <button className="btn" onClick={() => setActiveDate(addDays(activeDate, -1))}>← Forrige</button>
          <div className="production-date-box">
            <small>Valgt produksjonsdag</small>
            <b>{weekdayNo(activeDate)} {formatDateNo(activeDate)}</b>
          </div>
          <button className="btn" onClick={() => setActiveDate(addDays(activeDate, 1))}>Neste →</button>
          <input type="date" value={activeDate} onChange={(e) => setActiveDate(e.target.value)} style={{ maxWidth: 180 }} />
        </div>
      </div>

      {/* ── BAKERI-PANEL ────────────────────────────────────────────────────── */}
      {mainPanel === "bakeri" && (
        <>
          <div className="card">
            <div className="between">
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="btn" onClick={() => setPanel("day")}>Dagens produksjon</button>
                <button className="btn" onClick={() => setPanel("template")}>Produktmal</button>
                <button className="btn" onClick={() => setPanel("customers")}>Storkjøkkenkunder</button>
                <button className="btn" onClick={() => setPanel("recurring")}>Fastordre</button>
                <button className="btn" onClick={() => setPanel("invoice")}>Fakturagrunnlag</button>
              </div>
              <button className="btn active" onClick={printProductionDay}>Print produksjon</button>
            </div>
          </div>

          {panel === "day" && (
            <>
              <div className="metric-row">
                <Metric label="Produksjonslinjer" value={String(activeRows.length)} />
                <Metric label="Totalt antall" value={String(totalUnits)} dark />
                <Metric label="Total produksjon" value={`${totalUnits} stk`} />
                <Metric label="Status" value={activeDay.approved ? "Godkjent" : "Ikke godkjent"} tone={activeDay.approved ? "good" : "warn"} />
              </div>

              <div className="card">
                <div className="between">
                  <div>
                    <h3>Dagens produksjonsgrid</h3>
                    <p style={{ color: "#64748b" }}>Fyll inn antall per kunde/kanal.</p>
                  </div>
                  <button className="btn" onClick={applyRecurringOrdersForDay}>Legg til fastordre for denne dagen</button>
                </div>

                <div className="chips">
                  <button className={categoryFilter === "alle" ? "btn active" : "btn"} onClick={() => setCategoryFilter("alle")}>Alle</button>
                  {productionCategories.map((cat) => (
                    <button key={cat.id} className={categoryFilter === cat.id ? "btn active" : "btn"} onClick={() => setCategoryFilter(cat.id)}>{cat.name}</button>
                  ))}
                </div>

                <div style={{ overflowX: "auto" }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Produkt</th>
                        <th>Kategori</th>
                        {columns.map((col) => <th key={col.id} style={{ textAlign: "center" }}>{col.name}</th>)}
                        <th style={{ textAlign: "center" }}>Sum</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleTemplateLines.map((line) => {
                        const product = data.products.find((p) => p.id === line.productId);
                        if (!product) return null;
                        const qtyRow = activeDay.quantities[product.id] || {};
                        const total = totalForProduct(product.id);
                        return (
                          <tr key={line.id}>
                            <td><b>{product.name}</b><br /><small style={{ color: "#64748b" }}>{product.productNumber || "-"}</small></td>
                            <td>{productionCategories.find((c) => c.id === line.category)?.name}<br /><small style={{ color: "#64748b" }}>{product.category}</small></td>
                            {columns.map((col) => (
                              <td key={col.id}>
                                <input type="number" value={qtyRow[col.id] || ""} onChange={(e) => setCell(product.id, col.id, Number(e.target.value) || 0)} style={{ minWidth: 70, textAlign: "center" }} />
                              </td>
                            ))}
                            <td style={{ textAlign: "center" }}><b>{total}</b></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {panel === "template" && (
            <div className="card">
              <h3>Produktmal for produksjonsgrid</h3>
              <div className="form-grid three">
                <select value={newTemplateCategory} onChange={(e) => setNewTemplateCategory(e.target.value as ProductionCategory)}>
                  {productionCategories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
                <select value={newTemplateProductId} onChange={(e) => setNewTemplateProductId(e.target.value)}>
                  <option value="">Velg produkt</option>
                  {data.products.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.productNumber || "-"}</option>)}
                </select>
                <button className="btn active" onClick={addTemplateLine}>Legg til i mal</button>
              </div>
              <div className="grid two">
                {productionCategories.map((cat) => (
                  <div key={cat.id} className="soft-box">
                    <h3>{cat.name}</h3>
                    {templateLines.filter((line) => line.category === cat.id).map((line) => {
                      const product = data.products.find((p) => p.id === line.productId);
                      if (!product) return null;
                      return (
                        <div key={line.id} className="editable-row">
                          <div><b>{product.name}</b><br /><small>{product.productNumber || "-"}</small></div>
                          <button className="link danger" onClick={() => removeTemplateLine(line.id)}>Fjern</button>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}

          {panel === "customers" && (
            <div className="card">
              <h3>Storkjøkkenkunder</h3>
              <div className="soft-box">
                <h3>Ny kunde</h3>
                <div className="form-grid five">
                  <input value={newCustomer.name} onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })} placeholder="Kundenavn" />
                  <input value={newCustomer.orgNumber} onChange={(e) => setNewCustomer({ ...newCustomer, orgNumber: e.target.value })} placeholder="Org.nr" />
                  <input value={newCustomer.address} onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })} placeholder="Fakturaadresse" />
                  <input value={newCustomer.deliveryAddress} onChange={(e) => setNewCustomer({ ...newCustomer, deliveryAddress: e.target.value })} placeholder="Leveringsadresse" />
                  <input value={newCustomer.phone} onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })} placeholder="Telefon" />
                </div>
                <button className="btn active" onClick={addCustomer}>Legg til kunde</button>
              </div>
              <table>
                <thead><tr><th>Kunde</th><th>Org.nr</th><th>Levering</th><th>Telefon</th><th></th></tr></thead>
                <tbody>
                  {(data.storkjokkenCustomers || []).map((customer) => (
                    <tr key={customer.id}>
                      <td><b>{customer.name}</b></td>
                      <td>{customer.orgNumber || "-"}</td>
                      <td>{customer.deliveryAddress || "-"}</td>
                      <td>{customer.phone || "-"}</td>
                      <td><button className="link danger" onClick={() => deleteCustomer(customer.id)}>Slett</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <h3 style={{ marginTop: 24 }}>Spesialpriser per kunde</h3>
              {storkjokkenCustomers.map((customer) => (
                <div key={customer.id} className="soft-box">
                  <h3>{customer.name}</h3>
                  <table>
                    <thead><tr><th>Produkt</th><th>Standardpris eks. mva</th><th>Spesialpris eks. mva</th></tr></thead>
                    <tbody>
                      {data.products.map((product) => {
                        const special = (data.storkjokkenSpecialPrices || []).find((x) => x.customerId === customer.id && x.productId === product.id);
                        return (
                          <tr key={product.id}>
                            <td>{product.name}</td>
                            <td>{currency(product.storkjokkenPriceExVat || exVatFromIncVat(product.customerPrice || 0, data.settings.foodVat))}</td>
                            <td><input type="number" value={special?.priceExVat || ""} onChange={(e) => setSpecialPrice(customer.id, product.id, Number(e.target.value) || 0)} placeholder="Standard" /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}

          {panel === "recurring" && (
            <div className="card">
              <h3>Fastordre</h3>
              <p style={{ color: "#64748b" }}>Knappen i dagsbildet legger inn aktive fastordre for valgt ukedag.</p>
              {(data.recurringStorkjokkenOrders || []).length ? (
                (data.recurringStorkjokkenOrders || []).map((order) => {
                  const customer = data.storkjokkenCustomers.find((c) => c.id === order.customerId);
                  return (
                    <div key={order.id} className="editable-row">
                      <div><b>{customer?.name || "Ukjent kunde"}</b><br /><small>Dager: {order.weekdays.join(", ")} · Linjer: {order.lines.length}</small></div>
                      <span>{order.active ? "Aktiv" : "Inaktiv"}</span>
                    </div>
                  );
                })
              ) : <p>Ingen fastordre lagt inn ennå.</p>}
            </div>
          )}

          {panel === "invoice" && (
            <div className="card">
              <div className="between">
                <div><h3>Fakturagrunnlag</h3><p style={{ color: "#64748b" }}>Alle dager i perioden må være godkjent før print.</p></div>
                <button className="btn active" onClick={printInvoice}>Print fakturagrunnlag</button>
              </div>
              <div className="form-grid three">
                <label>Fra dato<input type="date" value={invoiceFrom} onChange={(e) => setInvoiceFrom(e.target.value)} /></label>
                <label>Til dato<input type="date" value={invoiceTo} onChange={(e) => setInvoiceTo(e.target.value)} /></label>
                <Metric label="Godkjente dager i perioden" value={String(listDates(invoiceFrom, invoiceTo).filter((d) => productionDays[d]?.approved).length)} />
              </div>
              {invoiceWarning && <div className="warning">{invoiceWarning}</div>}
              {groupedInvoiceRows(invoiceFrom, invoiceTo).map((group) => (
                <div key={group.customerName} className="soft-box">
                  <div className="between"><h3>{group.customerName}</h3><b>{currency(group.sumIncVat)} inkl. mva</b></div>
                  <table>
                    <thead><tr><th>Produkt</th><th>Antall totalt</th><th>Pris eks.</th><th>Sum eks.</th><th>MVA 15%</th><th>Sum inkl.</th></tr></thead>
                    <tbody>
                      {group.rows.map((row) => (
                        <tr key={`${row.customerId}-${row.productId}`}>
                          <td>{row.productName}</td><td>{row.quantity}</td><td>{currency(row.priceExVat)}</td>
                          <td>{currency(row.sumExVat)}</td><td>{currency(row.vat)}</td><td><b>{currency(row.sumIncVat)}</b></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}

          {/* Godkjenning */}
          <div className="card">
            <div className="production-approve-box">
              <div><h3>Godkjenning av dag</h3><p style={{ color: "#64748b" }}>Dagen må godkjennes før den kan tas med i fakturagrunnlaget.</p></div>
              <button className={activeDay.approved ? "btn active" : "btn"} onClick={() => saveDay({ ...activeDay, approved: !activeDay.approved })}>
                {activeDay.approved ? "✓ Dagen er godkjent" : "Godkjenn dag"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── CATERING-PANEL ──────────────────────────────────────────────────── */}
      {mainPanel === "catering" && (
        <>
          <div className="card">
            <div className="between">
              <div>
                <h3>Cateringordre for {weekdayNo(activeDate)} {formatDateNo(activeDate)}</h3>
                <p style={{ color: "#64748b" }}>Ordre av type Catering og Påsmurt vises automatisk på leveringsdatoen.</p>
              </div>
              <button className="btn active" onClick={printCateringDay}>
                Print alle ordre for dagen
              </button>
            </div>

            {cateringOrders.length === 0 ? (
              <p style={{ color: "#64748b" }}>Ingen cateringordre denne dagen.</p>
            ) : (
              cateringOrders.map((o) => {
                const customerName = o.customerType === "bedrift" ? o.companyName || o.customer : o.customer;
                const isExpanded = expandedCateringOrderId === o.id;
                return (
                  <div key={o.id} className="order-row">
                    <button
                      className="order-row-header"
                      onClick={() => setExpandedCateringOrderId(isExpanded ? null : o.id)}
                    >
                      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                        <b>{o.time || "--"}</b>
                        <span>{customerName}</span>
                        {o.orderNumber && <span style={{ background: "#f1f5f9", borderRadius: 6, padding: "2px 8px", fontSize: 12 }}>#{o.orderNumber}</span>}
                        <span style={{ color: "#64748b", fontSize: 13 }}>
                          {o.orderLines.map((l) => {
                            const p = data.products.find((x) => x.id === l.productId);
                            return `${l.quantity} × ${p?.name || "Ukjent"}`;
                          }).join(", ")}
                        </span>
                      </div>
                      <span style={{ color: "#64748b" }}>{isExpanded ? "▲" : "▼"}</span>
                    </button>

                    {isExpanded && (
                      <div className="order-row-body">
                        <div style={{ marginBottom: 10 }}>
                          <p><b>Telefon:</b> {o.phone || "-"}</p>
                          <p><b>Levering:</b> {o.deliveryAddress || "-"}</p>
                          <p><b>Betaling:</b> {o.paymentInfo || "-"}</p>
                          {o.note && <p style={{ whiteSpace: "pre-wrap" }}><b>Notat:</b><br />{o.note}</p>}
                        </div>

                        <table>
                          <thead><tr><th>Produkt</th><th>Antall</th></tr></thead>
                          <tbody>
                            {o.orderLines.map((l, i) => {
                              const product = data.products.find((p) => p.id === l.productId);
                              return <tr key={i}><td>{product?.name || "Ukjent"}</td><td>{l.quantity}</td></tr>;
                            })}
                          </tbody>
                        </table>

                        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                          <button className="btn active" onClick={() => printCateringOrder(o)}>
                            Print denne ordren med oppskrift
                          </button>
                          {o.orderLines.map((l, i) => {
                            const product = data.products.find((p) => p.id === l.productId);
                            if (!product) return null;
                            return (
                              <button key={i} className="btn" onClick={() => {
const body = `<div class="page"><div class="top"><div><h1>${escapeHtml(product.name)}</h1><p class="muted">${l.quantity} porsjoner / stk</p></div><div class="right"><b>${formatDateNo(o.date)}</b></div></div>${scaledRecipeHtml(product, l.quantity, l.menuSelections)}</div>`;                                printWindow(`Oppskrift: ${product.name}`, body);
                              }}>
                                Oppskrift: {product.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      <style jsx global>{`
        .production-date-row { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; justify-content: space-between; }
        .production-date-box { background: #dcfce7; color: #14532d; border: 1px solid #86efac; border-radius: 14px; padding: 10px 18px; min-width: 240px; text-align: center; display: grid; gap: 2px; }
        .production-date-box small { color: #166534; font-weight: 800; }
        .production-date-box b { font-size: 18px; }
        .production-approve-box { display: flex; justify-content: space-between; gap: 16px; align-items: center; flex-wrap: wrap; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 16px; }
        .order-row { border: 1px solid #e2e8f0; border-radius: 14px; margin: 8px 0; overflow: hidden; background: white; }
        .order-row-header { width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; background: white; border: 0; cursor: pointer; text-align: left; gap: 12px; }
        .order-row-header:hover { background: #f8fafc; }
        .order-row-body { padding: 0 16px 16px; border-top: 1px solid #e2e8f0; background: #fafafa; }
      `}</style>
    </section>
  );
}

function InventoryTab({ data, updateData, productUnitCost, updateInventoryRpc }: { data: AppData; updateData: (p: Partial<AppData>) => void; productUnitCost: (p: Product) => number; updateInventoryRpc: (month: string, patch: { itemsPatch?: Record<string, any>; wastePatch?: Record<string, number>; kassasvinn?: number; locked?: boolean; pricesFrozen?: boolean; profitability?: any }) => void }) {
  const currentYm = new Date().toISOString().slice(0, 7);
  const [inventoryMonth, setInventoryMonth] = useState(currentYm);
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventoryCategoryFilter, setInventoryCategoryFilter] = useState("Alle");
  const [inventoryPage, setInventoryPage] = useState(1);
  const [showInventoryStats, setShowInventoryStats] = useState(false);
  const [expandedMobileId, setExpandedMobileId] = useState<string | null>(null);
  const [showAllLocations, setShowAllLocations] = useState(false);
  const [showRecentCounts, setShowRecentCounts] = useState(false);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(true);
  const pageSize = 50;

  React.useEffect(() => {
    const channel = supabase.channel("inventory-presence")
      .subscribe((status) => {
        setIsRealtimeConnected(status === "SUBSCRIBED");
      });
    return () => { supabase.removeChannel(channel); };
  }, []);

  function toggleMobileCard(id: string) {
    const currentScroll = window.scrollY;
    setExpandedMobileId((prev) => prev === id ? null : id);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo({ top: currentScroll, behavior: "instant" as ScrollBehavior });
      });
    });
  }

  const categoryLocations: Record<string, string[]> = {
    "Diverse mat":            ["Kjøkken", "Lager"],
    "Mel og frø":             ["Kjøkken", "Lager"],
    "Meieri":                 ["Kjølerom", "Kafé"],
    "Kjøtt":                  ["Kjølerom", "Fryser kjeller"],
    "Fisk":                   ["Kjølerom", "Fryser kjeller"],
    "Tørrvarer":              ["Kjøkken", "Lager"],
    "Kjøkken, egenprodusert": ["Kjølerom", "Fryser kjeller"],
    "Bakeri, egenprodusert":  ["Fryser bakeri", "Fryser kjeller"],
    "Frukt og grønt":         ["Kjølerom", "Lager"],
    "Krydder":                ["Kjøkken"],
    "Deli":                   ["Kjølerom", "Disk", "Lager", "Koch"],
    "Mineralvann":            ["Lager", "Kafé", "Koch", "Bodøgaard"],
    "Kaffe/te":               ["Kafé", "Lager", "Koch"],
    "Vin":                    ["Kjøleskap", "Lager", "Bodøgaard"],
    "Øl":                     ["Kjøleskap", "Lager", "Bodøgaard"],
    "Cider":                  ["Kjøleskap", "Lager", "Bodøgaard"],
    "Brennevin":              ["Lager", "Bodøgaard"],
  };

  const egenprodusertCategories = ["Kjøkken, egenprodusert", "Bakeri, egenprodusert"];
  const drinkBuckets = ["Mineralvann", "Kaffe/te", "Vin", "Øl", "Cider", "Brennevin"];
  const matSubBuckets = ["Mel og frø", "Meieri", "Kjøtt", "Fisk", "Diverse mat", "Tørrvarer", "Kjøkken, egenprodusert", "Bakeri, egenprodusert", "Frukt og grønt", "Krydder"];
  const accountingBuckets = [...matSubBuckets, "Deli", ...drinkBuckets];
  const internalBuckets = ["Alle", "Mat", ...matSubBuckets, "Deli", ...drinkBuckets];
  const statsBuckets = ["Mat", ...matSubBuckets, "Deli", ...drinkBuckets];

  const countsByMonth = data.inventoryCounts || {};
  const currentInventory = countsByMonth[inventoryMonth] || { locked: false, waste: {}, items: {} };
  const counts = currentInventory.items || {};
  const waste = currentInventory.waste || {};
  const isLocked = !!currentInventory.locked;
  const kassasvinn = currentInventory.kassasvinn || 0;
  const [year, month] = inventoryMonth.split("-");

  // Forrige måned (referanse, uredigerbar)
  const prevMonthKey = (() => {
    const [y, m] = inventoryMonth.split("-").map(Number);
    const d = new Date(y, m - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  })();
  const prevInventory = countsByMonth[prevMonthKey];
  const prevCounts = prevInventory?.items || {};

  function getPrevMaterialTotal(materialId: string): number {
    const c = prevCounts[materialId] as any;
    if (!c) return 0;
    return Number(c.packages || 0) + Number(c.loose || 0);
  }
  function getPrevProductTotal(productId: string): number {
    const c = prevCounts[`product_${productId}`] as any;
    if (!c) return 0;
    return Number(c.packages || 0) + Number(c.loose || 0);
  }

  function updateKassasvinn(val: number) {
    updateInventoryRpc(inventoryMonth, { kassasvinn: val });
  }

  const xlsxColors: Record<string, string> = {
    "Mel og frø": "8BC34A", "Meieri": "FFF176", "Kjøtt": "EF9A9A",
    "Fisk": "80DEEA", "Tørrvarer": "FFCC80",
    "Kjøkken, egenprodusert": "CE93D8", "Bakeri, egenprodusert": "FFAB91",
    "Frukt og grønt": "C8E6C9", "Krydder": "F8BBD0", "Deli": "2196F3",
    "Mineralvann": "00BCD4", "Kaffe/te": "795548", "Vin": "9C27B0",
    "Øl": "FF9800", "Cider": "CDDC39", "Brennevin": "F44336",
    "Diverse mat": "90A4AE",
  };

  const bucketColors: Record<string, string> = {
    "Mel og frø": "#f0fdf4", "Meieri": "#fefce8", "Kjøtt": "#fff1f2",
    "Fisk": "#f0fdfa", "Tørrvarer": "#fff7ed",
    "Kjøkken, egenprodusert": "#fdf4ff", "Bakeri, egenprodusert": "#fff7ed",
    "Frukt og grønt": "#f0fdf4", "Krydder": "#fdf2f8", "Deli": "#eff6ff",
    "Mineralvann": "#f0fdfa", "Kaffe/te": "#fdf8f4", "Vin": "#faf5ff",
    "Øl": "#fff7ed", "Cider": "#f7fee7", "Brennevin": "#fff1f2",
    "Diverse mat": "#f8fafc",
  };

  function getMaterialWaste(materialId: string): number { return (counts[materialId] as any)?.waste || 0; }
  function updateMaterialWaste(materialId: string, wasteAmount: number) {
    const material = data.materials.find((m) => m.id === materialId);
    const existing = (counts[materialId] as any) || {};
    const pricesAreFrozen = !!currentInventory.pricesFrozen;
    const packagePrice = pricesAreFrozen ? existing.packagePrice : (material?.packagePrice || existing.packagePrice || 0);
    const pricePerUnit = pricesAreFrozen ? existing.pricePerUnit : (material?.pricePerUnit || existing.pricePerUnit || 0);
    updateInventoryRpc(inventoryMonth, { itemsPatch: { [materialId]: { ...existing, packagePrice, pricePerUnit, waste: wasteAmount, countedAt: new Date().toISOString() } } });
  }
  function getProductWaste(productId: string): number { return (counts[`product_${productId}`] as any)?.waste || 0; }
  function updateProductWaste(product: Product, wasteAmount: number) {
    const key = `product_${product.id}`;
    const existing = (counts[key] as any) || {};
    updateInventoryRpc(inventoryMonth, { itemsPatch: { [key]: { ...existing, waste: wasteAmount, countedAt: new Date().toISOString() } } });
  }
  function materialWasteValue(m: Material): number { return getMaterialWaste(m.id) * m.pricePerUnit; }
  function productWasteValue(p: Product): number { return getProductWaste(p.id) * productUnitCost(p); }
  function totalWasteValue(): number {
    return data.materials.reduce((sum, m) => sum + materialWasteValue(m), 0)
      + data.products.filter((p) => egenprodusertCategories.includes(p.category)).reduce((sum, p) => sum + productWasteValue(p), 0)
      + kassasvinn;
  }
  function bucketWasteValue(bucket: string): number {
    if (egenprodusertCategories.includes(bucket)) return data.products.filter((p) => p.category === bucket).reduce((sum, p) => sum + productWasteValue(p), 0);
    return data.materials.filter((m) => m.category === bucket).reduce((sum, m) => sum + materialWasteValue(m), 0);
  }

  // ── Lønnsomhetsrapport: Mat vs. Deli ──────────────────────────────────────
  const profitability = currentInventory.profitability || {};

  function updateProfitability(patch: Partial<ProfitabilityInput>) {
    updateInventoryRpc(inventoryMonth, { profitability: { ...profitability, ...patch } });
  }

  // Deli varekost% beregnes live: vektet snitt av (pricePerUnit / retailPriceExVat) for alle Deli-råvarer som har retailPrice satt
  function deliVarekostPctLive(): number {
    const deliMaterials = data.materials.filter((m) => m.category === "Deli" && m.retailPrice && m.retailPrice > 0);
    if (!deliMaterials.length) return 0;
    let weightedCostSum = 0;
    let weightedRetailSum = 0;
    deliMaterials.forEach((m) => {
      const retailExVat = exVatFromIncVat(m.retailPrice || 0, data.settings.foodVat);
      if (retailExVat <= 0) return;
      // Vekt: bruk lagerverdi (kost × telling) om finnes, ellers vekt 1 (enkelt snitt)
      const c = counts[m.id] as any;
      const qty = c ? Number(c.packages || 0) * (c.packagePrice ? 1 : 1) + Number(c.loose || 0) : 0;
      const weight = qty > 0 ? qty * m.pricePerUnit : 1;
      weightedCostSum += m.pricePerUnit * weight;
      weightedRetailSum += retailExVat * weight;
    });
    if (weightedRetailSum <= 0) return 0;
    return weightedCostSum / weightedRetailSum;
  }

  const deliVarekostPct = deliVarekostPctLive();
  const matSalesNetto = profitability.matSalesNetto || 0;
  const deliSalesNetto = profitability.deliSalesNetto || 0;
  const varekjopMatTotalt = profitability.varekjopMatTotalt || 0;

  // Ekte varekost via lagerbevegelse: Åpningsbeholdning + Innkjøp − Sluttbeholdning.
  // Innkjøpet (fra regnskap) er kun kjent samlet for mat+deli, så vi bruker Deli sin
  // proxy-kost% til å anslå Delis andel av innkjøpet, og gir resten til Mat.
  const deliOpening = valueForBucketInMonth(prevMonthKey, "Deli");
  const deliClosing = valueForBucketInMonth(inventoryMonth, "Deli");
  const matOpening = valueForBucketInMonth(prevMonthKey, "Mat");
  const matClosing = valueForBucketInMonth(inventoryMonth, "Mat");

  const deliVarekostKr = deliSalesNetto * deliVarekostPct;
  const deliInnkjopEstimat = deliVarekostKr - deliOpening + deliClosing;
  const matInnkjopEstimat = varekjopMatTotalt - deliInnkjopEstimat;
  const matVarekostKr = matOpening + matInnkjopEstimat - matClosing;

  const matVarekostPctResult = matSalesNetto > 0 ? matVarekostKr / matSalesNetto : 0;
  const matBruttoKr = matSalesNetto - matVarekostKr;
  const deliBruttoKr = deliSalesNetto - deliVarekostKr;
  const matMarginPct = matSalesNetto > 0 ? matBruttoKr / matSalesNetto : 0;
  const deliMarginPct = deliSalesNetto > 0 ? deliBruttoKr / deliSalesNetto : 0;

  function getLocationCount(materialId: string, location: string): { packages: number; loose: number } {
    const item = counts[materialId] as any;
    if (!item) return { packages: 0, loose: 0 };

    const material = data.materials.find((m) => m.id === materialId);
    const validLocations = categoryLocations[material?.category || ""] || [];

    // Finn "foreldreløse" steder: lagret i data men ikke gyldige i dagens kategori-oppsett
    const orphanedTotal = item.locations
      ? Object.entries(item.locations as Record<string, { packages?: number; loose?: number }>)
          .filter(([loc]) => !validLocations.includes(loc))
          .reduce((acc, [, v]) => ({ packages: acc.packages + (v.packages || 0), loose: acc.loose + (v.loose || 0) }), { packages: 0, loose: 0 })
      : { packages: 0, loose: 0 };

    const directValue = item.locations?.[location] || { packages: 0, loose: 0 };

    // Legg foreldreløse steder til det første gyldige stedet, slik at gamle tellinger (f.eks. "Lager" fra en
    // tidligere stedskonfigurasjon) blir synlige og redigerbare igjen i stedet for å forsvinne fra visningen.
    if (validLocations[0] === location) {
      // Hvis det IKKE finnes noen locations-struktur i det hele tatt, bruk root packages/loose som bakoverkompatibilitet
      if (!item.locations || Object.keys(item.locations).length === 0) {
        return { packages: item.packages || 0, loose: item.loose || 0 };
      }
      return {
        packages: (directValue.packages || 0) + orphanedTotal.packages,
        loose: (directValue.loose || 0) + orphanedTotal.loose,
      };
    }

    return { packages: directValue.packages || 0, loose: directValue.loose || 0 };
  }

  function updateLocationCount(materialId: string, location: string, packages: number, loose: number) {
    const material = data.materials.find((m) => m.id === materialId);
    const existing = (counts[materialId] as any) || {};
    const validLocations = categoryLocations[material?.category || ""] || [];

    // Hvis prisene allerede er frosset for denne måneden (lås har vært trykket minst én gang),
    // skal IKKE prisen oppdateres til dagens pris selv om antall endres etter en opplåsing.
    const pricesAreFrozen = !!currentInventory.pricesFrozen;
    const frozenPackagePrice = pricesAreFrozen ? existing.packagePrice : (material?.packagePrice || 0);
    const frozenPricePerUnit = pricesAreFrozen ? existing.pricePerUnit : (material?.pricePerUnit || 0);

    // Når brukeren bevisst lagrer en verdi for det FØRSTE gyldige stedet, rydder vi samtidig opp i
    // eventuelle "foreldreløse" steder (f.eks. gammel "Lager"-data) fra samme objekt, slik at de ikke
    // teller dobbelt og ikke lenger dukker opp som en del av den "lesbare" sammenslåingen senere.
    const oldLocations = existing.locations || {};
    const orphanedKeys = Object.keys(oldLocations).filter((loc) => !validLocations.includes(loc));
    const isFirstValidLocation = validLocations[0] === location;

    const newLocations: Record<string, { packages: number; loose: number }> = { ...oldLocations };
    if (isFirstValidLocation && orphanedKeys.length > 0) {
      orphanedKeys.forEach((loc) => delete newLocations[loc]);
    }
    newLocations[location] = { packages, loose };

    const totalPackages = Object.values(newLocations).reduce((s: number, l: any) => s + (l.packages || 0), 0);
    const totalLoose = Object.values(newLocations).reduce((s: number, l: any) => s + (l.loose || 0), 0);
    updateInventoryRpc(inventoryMonth, { itemsPatch: { [materialId]: { ...existing, packages: totalPackages, loose: totalLoose, packagePrice: frozenPackagePrice, pricePerUnit: frozenPricePerUnit, locations: newLocations, countedAt: new Date().toISOString() } } });
  }

  function materialInventoryValue(m: Material) {
    const c = counts[m.id] as any || {};
    const packages = Number(c.packages || 0);
    const loose = Number(c.loose || 0);
    const packagePrice = c.packagePrice ?? m.packagePrice;
    const pricePerUnit = c.pricePerUnit ?? m.pricePerUnit;
    const looseVal = m.category === "Brennevin" ? loose * packagePrice : loose * pricePerUnit;
    return packages * packagePrice + looseVal;
  }

  function getProductCount(productId: string, location: string): { cases: number; loose: number } {
    const item = counts[`product_${productId}`] as any;
    if (!item) return { cases: 0, loose: 0 };
    // Bakoverkompatibilitet kun for ekte gammel data: ingen locations-struktur i det hele tatt
    if (!item.locations || Object.keys(item.locations).length === 0) {
      const product = data.products.find((p) => p.id === productId);
      const locations = product ? (categoryLocations[product.category] || []) : [];
      if (locations[0] === location) {
        return { cases: item.packages || 0, loose: item.loose || 0 };
      }
      return { cases: 0, loose: 0 };
    }
    return item.locations[location] || { cases: 0, loose: 0 };
  }

  function updateProductCount(product: Product, location: string, cases: number, loose: number) {
    const key = `product_${product.id}`;
    const existing = (counts[key] as any) || {};
    const newLocations = { ...(existing.locations || {}), [location]: { cases, loose } };
    const totalCases = Object.values(newLocations).reduce((s: number, l: any) => s + (l.cases || 0), 0);
    const totalLoose = Object.values(newLocations).reduce((s: number, l: any) => s + (l.loose || 0), 0);
    updateInventoryRpc(inventoryMonth, { itemsPatch: { [key]: { ...existing, packages: totalCases, loose: totalLoose, packagePrice: 0, pricePerUnit: 0, locations: newLocations, countedAt: new Date().toISOString() } } });
  }

  function productInventoryValue(product: Product, liveUnitCost: number): number {
    const c = counts[`product_${product.id}`] as any || { packages: 0, loose: 0 };
    const unitCost = currentInventory.pricesFrozen && c.frozenUnitCost != null ? c.frozenUnitCost : liveUnitCost;
    return (c.packages * Number(product.unitsPerCase || 1) + c.loose) * unitCost;
  }
  function egenprodusertBucketValue(bucket: string): number { return data.products.filter((p) => p.category === bucket).reduce((sum, p) => sum + productInventoryValue(p, productUnitCost(p)), 0); }
  function belongsToBucket(m: Material, bucket: string) {
    if (bucket === "Alle") return true;
    if (bucket === "Mat") return !drinkBuckets.includes(m.category) && m.category !== "Deli";
    return m.category === bucket;
  }
  function bucketValue(bucket: string) {
    if (egenprodusertCategories.includes(bucket)) return egenprodusertBucketValue(bucket);
    return data.materials.reduce((sum, m) => belongsToBucket(m, bucket) ? sum + materialInventoryValue(m) : sum, 0);
  }

  const totalMaterials = data.materials.filter((m) => !egenprodusertCategories.includes(m.category)).reduce((sum, m) => sum + materialInventoryValue(m), 0);
  const totalEgenprodusert = egenprodusertCategories.reduce((sum, b) => sum + egenprodusertBucketValue(b), 0);
  const total = totalMaterials + totalEgenprodusert;

  const filtered = data.materials
    .filter((m) => `${m.name} ${m.category}`.toLowerCase().includes(inventorySearch.toLowerCase()))
    .filter((m) => inventoryCategoryFilter === "Alle" ? true : belongsToBucket(m, inventoryCategoryFilter))
    .filter((m) => !egenprodusertCategories.includes(m.category))
    .sort((a, b) => { const idxA = accountingBuckets.indexOf(a.category); const idxB = accountingBuckets.indexOf(b.category); return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB) || a.name.localeCompare(b.name, "no-NO"); });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visibleMaterials = filtered.slice((inventoryPage - 1) * pageSize, inventoryPage * pageSize);
  const allMaterialCategories = Array.from(new Set(data.materials.map((m) => m.category))).filter((c) => !egenprodusertCategories.includes(c));
  const groupedMaterials = allMaterialCategories.reduce((acc, bucket) => { const items = visibleMaterials.filter((m) => m.category === bucket); if (items.length > 0) acc[bucket] = items; return acc; }, {} as Record<string, Material[]>);

  function valueForBucketInMonth(monthKey: string, bucket: string) {
    const monthIsFrozen = countsByMonth[monthKey]?.pricesFrozen;
    if (egenprodusertCategories.includes(bucket)) {
      const items = countsByMonth[monthKey]?.items || {};
      return data.products.filter((p) => p.category === bucket).reduce((sum, p) => {
        const c = items[`product_${p.id}`] as any || { packages: 0, loose: 0 };
        const packages = Number(c.packages || 0);
        const loose = Number(c.loose || 0);
        const unitCost = monthIsFrozen && c.frozenUnitCost != null ? c.frozenUnitCost : productUnitCost(p);
        return sum + (packages * Number(p.unitsPerCase || 1) + loose) * unitCost;
      }, 0);
    }
    const items = countsByMonth[monthKey]?.items || {};
    return data.materials.reduce((sum, m) => {
      if (!belongsToBucket(m, bucket)) return sum;
      const c = items[m.id] as any || { packages: 0, loose: 0, packagePrice: m.packagePrice, pricePerUnit: m.pricePerUnit };
      const packages = Number(c.packages || 0);
      const loose = Number(c.loose || 0);
      const packagePrice = c.packagePrice ?? m.packagePrice;
      const pricePerUnit = c.pricePerUnit ?? m.pricePerUnit;
      const looseVal2 = m.category === "Brennevin" ? loose * packagePrice : loose * pricePerUnit;
      return sum + packages * packagePrice + looseVal2;
    }, 0);
  }

  const inventoryHistory = Object.keys(countsByMonth).sort().map((monthKey) => {
    const monthData = countsByMonth[monthKey];
    const monthKassasvinn = monthData.kassasvinn || 0;
    const items = monthData.items || {};
    const monthMatTotal = data.materials
      .filter((m) => !egenprodusertCategories.includes(m.category))
      .reduce((sum, m) => {
        const c = items[m.id] as any || {};
        const packages = Number(c.packages || 0);
        const loose = Number(c.loose || 0);
        const packagePrice = c.packagePrice ?? m.packagePrice;
        const pricePerUnit = c.pricePerUnit ?? m.pricePerUnit;
        const looseVal3 = m.category === "Brennevin" ? loose * packagePrice : loose * pricePerUnit;
        return sum + packages * packagePrice + looseVal3;
      }, 0);
    const monthEgenprodTotal = egenprodusertCategories.reduce((sum, b) => sum + valueForBucketInMonth(monthKey, b), 0);
    return {
      monthKey,
      total: monthMatTotal + monthEgenprodTotal,
      wasteTotal: (() => {
        const materialWaste = data.materials.reduce((sum, m) => {
          const c = items[m.id] as any || {};
          return sum + Number(c.waste || 0) * m.pricePerUnit;
        }, 0);
        const egenprodWaste = data.products
          .filter((p) => egenprodusertCategories.includes(p.category))
          .reduce((sum, p) => sum + Number((items[`product_${p.id}`] as any)?.waste || 0) * productUnitCost(p), 0);
        return materialWaste + egenprodWaste + monthKassasvinn;
      })(),
    };
  }).slice(-12);

  const maxInventoryValue = Math.max(1, ...inventoryHistory.map((h) => h.total));

  async function exportInventoryXlsx() {
    const ExcelJS = await import("exceljs");
    const wb = new ExcelJS.Workbook();
    const sheetNames: Record<string, string> = { "Kaffe/te": "Kaffe-te", "Kjøkken, egenprodusert": "Kjøkken-egenprod", "Bakeri, egenprodusert": "Bakeri-egenprod" };
    function getColor(bucket: string) { return xlsxColors[bucket] || "607D8B"; }
    function safeSheetName(name: string) { return (sheetNames[name] || name).replace(/[\/\\?*[\]]/g, "-").slice(0, 31); }
    function addStyledHeaderRow(ws: any, values: string[], color: string) { const row = ws.addRow(values); row.eachCell((cell: any) => { cell.font = { bold: true, color: { argb: "FFFFFFFF" } }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${color}` } }; cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }; cell.alignment = { horizontal: "center" }; }); return row; }
    const allCategories = Array.from(new Set(data.materials.map((m) => m.category))).filter((c) => !egenprodusertCategories.includes(c));
    allCategories.forEach((bucket) => {
      const materials = data.materials.filter((m) => m.category === bucket).sort((a, b) => a.name.localeCompare(b.name, "no-NO"));
      if (!materials.length) return;
      const locations = categoryLocations[bucket] || ["Lager"];
      const ws = wb.addWorksheet(safeSheetName(bucket));
      const color = getColor(bucket);
      const totalCols = 3 + locations.length * 2 + 2;
      ws.columns = [{ width: 30 }, { width: 14 }, { width: 12 }, ...locations.flatMap(() => [{ width: 10 }, { width: 10 }]), { width: 10 }, { width: 14 }];
      const titleRow = ws.addRow([`Varetelling ${inventoryMonth} – ${bucket}`]);
      ws.mergeCells(1, 1, 1, totalCols); titleRow.getCell(1).font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } }; titleRow.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${color}` } }; titleRow.getCell(1).alignment = { horizontal: "center", vertical: "middle" }; titleRow.height = 28; ws.addRow([]);
      const locHeaderRow = ws.addRow(["", "", "", ...locations.flatMap((loc) => [loc, ""]), "Svinn", ""]);
      locations.forEach((loc, i) => { const col = 4 + i * 2; ws.mergeCells(3, col, 3, col + 1); const cell = locHeaderRow.getCell(col); cell.value = loc; cell.font = { bold: true, color: { argb: "FF000000" } }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `44${color}` } }; cell.alignment = { horizontal: "center" }; cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "medium" }, right: { style: "medium" } }; });
      addStyledHeaderRow(ws, ["Vare", "Råvarekost pr pk", "Pakning", ...locations.flatMap(() => ["Pakker", "Løs"]), "Svinn", "Verdi"], color);
      materials.forEach((m) => {
        const value = materialInventoryValue(m); const wasteAmt = getMaterialWaste(m.id);
        const rowValues: any[] = [m.name, m.packagePrice, `${m.packageSize} ${m.unit}`];
        locations.forEach((loc) => { const lc = getLocationCount(m.id, loc); rowValues.push(lc.packages || ""); rowValues.push(lc.loose || ""); });
        rowValues.push(wasteAmt || ""); rowValues.push(value);
        const row = ws.addRow(rowValues);
        row.eachCell((cell: any, colNumber: number) => { cell.border = { top: { style: "hair" }, bottom: { style: "hair" }, left: { style: "thin" }, right: { style: "thin" } }; if (colNumber === 2 || colNumber === totalCols) cell.numFmt = "#,##0.00"; });
        locations.forEach((_, i) => { const col = 4 + i * 2; row.getCell(col).border = { ...row.getCell(col).border, left: { style: "medium" } }; row.getCell(col + 1).border = { ...row.getCell(col + 1).border, right: { style: "medium" } }; });
      });
      const sumRow = ws.addRow([`SUM ${bucket}`, "", "", ...locations.flatMap(() => ["", ""]), bucketWasteValue(bucket), bucketValue(bucket)]);
      sumRow.eachCell((cell: any, colNumber: number) => { cell.font = { bold: true }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `44${color}` } }; cell.border = { top: { style: "medium" }, bottom: { style: "medium" }, left: { style: "medium" }, right: { style: "medium" } }; if (colNumber === totalCols || colNumber === totalCols - 1) cell.numFmt = "#,##0.00"; });
      ws.pageSetup = { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.5, right: 0.5, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 } };
    });
    const allEgenprodCategories = Array.from(new Set(data.products.map((p) => p.category))).filter((c) => egenprodusertCategories.includes(c));
    allEgenprodCategories.forEach((bucket) => {
      const products = data.products.filter((p) => p.category === bucket);
      if (!products.length) return;
      const locations = categoryLocations[bucket] || ["Lager"];
      const ws = wb.addWorksheet(safeSheetName(bucket));
      const color = getColor(bucket);
      const totalCols = 3 + locations.length * 2 + 2;
      ws.columns = [{ width: 30 }, { width: 14 }, { width: 12 }, ...locations.flatMap(() => [{ width: 10 }, { width: 10 }]), { width: 10 }, { width: 14 }];
      const titleRow = ws.addRow([`Varetelling ${inventoryMonth} – ${bucket} (egenprodusert)`]);
      ws.mergeCells(1, 1, 1, totalCols); titleRow.getCell(1).font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } }; titleRow.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${color}` } }; titleRow.getCell(1).alignment = { horizontal: "center", vertical: "middle" }; titleRow.height = 28; ws.addRow([]);
      const locHeaderRow = ws.addRow(["", "", "", ...locations.flatMap((loc) => [loc, ""]), "Svinn", ""]);
      locations.forEach((loc, i) => { const col = 4 + i * 2; ws.mergeCells(3, col, 3, col + 1); const cell = locHeaderRow.getCell(col); cell.value = loc; cell.font = { bold: true, color: { argb: "FF000000" } }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `44${color}` } }; cell.alignment = { horizontal: "center" }; cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "medium" }, right: { style: "medium" } }; });
      addStyledHeaderRow(ws, ["Produkt", "Kostpris/stk", "Per eske", ...locations.flatMap(() => ["Esker", "Løs stk"]), "Svinn stk", "Verdi"], color);
      products.forEach((p) => {
        const unitCost = productUnitCost(p); const value = productInventoryValue(p, unitCost); const wasteAmt = getProductWaste(p.id);
        const rowValues: any[] = [p.name, unitCost, Number(p.unitsPerCase || 1)];
        locations.forEach((loc) => { const lc = getProductCount(p.id, loc); rowValues.push(lc.cases || ""); rowValues.push(lc.loose || ""); });
        rowValues.push(wasteAmt || ""); rowValues.push(value);
        const row = ws.addRow(rowValues);
        row.eachCell((cell: any, colNumber: number) => { cell.border = { top: { style: "hair" }, bottom: { style: "hair" }, left: { style: "thin" }, right: { style: "thin" } }; if (colNumber === 2 || colNumber === totalCols) cell.numFmt = "#,##0.00"; });
        locations.forEach((_, i) => { const col = 4 + i * 2; row.getCell(col).border = { ...row.getCell(col).border, left: { style: "medium" } }; row.getCell(col + 1).border = { ...row.getCell(col + 1).border, right: { style: "medium" } }; });
      });
      const sumRow = ws.addRow([`SUM ${bucket}`, "", "", ...locations.flatMap(() => ["", ""]), bucketWasteValue(bucket), egenprodusertBucketValue(bucket)]);
      sumRow.eachCell((cell: any, colNumber: number) => { cell.font = { bold: true }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `44${color}` } }; cell.border = { top: { style: "medium" }, bottom: { style: "medium" }, left: { style: "medium" }, right: { style: "medium" } }; if (colNumber === totalCols || colNumber === totalCols - 1) cell.numFmt = "#,##0.00"; });
      ws.pageSetup = { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.5, right: 0.5, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 } };
    });
    const wsWaste = wb.addWorksheet("Svinn");
    wsWaste.columns = [{ width: 35 }, { width: 20 }, { width: 20 }];
    const wasteTitleRow = wsWaste.addRow([`Svinn – ${inventoryMonth}`]);
    wsWaste.mergeCells(1, 1, 1, 3); wasteTitleRow.getCell(1).font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } }; wasteTitleRow.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF607D8B" } }; wasteTitleRow.getCell(1).alignment = { horizontal: "center", vertical: "middle" }; wasteTitleRow.height = 28; wsWaste.addRow([]);
    const wasteHeaderRow = wsWaste.addRow(["Kategori / Produkt", "Svinn (mengde)", "Svinn (varekost)"]);
    wasteHeaderRow.eachCell((cell: any) => { cell.font = { bold: true, color: { argb: "FFFFFFFF" } }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF607D8B" } }; cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }; });
    allCategories.forEach((bucket) => {
      const mw = data.materials.filter((m) => m.category === bucket && getMaterialWaste(m.id) > 0).sort((a, b) => a.name.localeCompare(b.name, "no-NO"));
      if (!mw.length) return;
      const color = getColor(bucket);
      const catRow = wsWaste.addRow([bucket, "", currency(bucketWasteValue(bucket))]);
      catRow.eachCell((cell: any) => { cell.font = { bold: true }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `44${color}` } }; cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }; });
      mw.forEach((m) => { const row = wsWaste.addRow([`  ${m.name}`, `${getMaterialWaste(m.id)} ${m.unit}`, materialWasteValue(m)]); row.getCell(3).numFmt = "#,##0.00"; row.eachCell((cell: any) => { cell.border = { top: { style: "hair" }, bottom: { style: "hair" }, left: { style: "thin" }, right: { style: "thin" } }; }); });
    });
    allEgenprodCategories.forEach((bucket) => {
      const pw = data.products.filter((p) => p.category === bucket && getProductWaste(p.id) > 0);
      if (!pw.length) return;
      const color = getColor(bucket);
      const catRow = wsWaste.addRow([`${bucket} (egenprodusert)`, "", currency(bucketWasteValue(bucket))]);
      catRow.eachCell((cell: any) => { cell.font = { bold: true }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `44${color}` } }; cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }; });
      pw.forEach((p) => { const row = wsWaste.addRow([`  ${p.name}`, `${getProductWaste(p.id)} stk`, productWasteValue(p)]); row.getCell(3).numFmt = "#,##0.00"; row.eachCell((cell: any) => { cell.border = { top: { style: "hair" }, bottom: { style: "hair" }, left: { style: "thin" }, right: { style: "thin" } }; }); });
    });
    if (kassasvinn > 0) {
      wsWaste.addRow([]);
      const kassaRow = wsWaste.addRow(["Igjen ved dagsslutt, måned", "", kassasvinn]);
      kassaRow.getCell(3).numFmt = "#,##0.00";
      kassaRow.eachCell((cell: any) => { cell.font = { bold: true }; cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }; });
    }
    wsWaste.addRow([]);
    const totalWasteRow = wsWaste.addRow(["TOTAL SVINN", "", totalWasteValue()]);
    totalWasteRow.eachCell((cell: any, colNumber: number) => { cell.font = { bold: true, color: { argb: "FFFFFFFF" } }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF607D8B" } }; cell.border = { top: { style: "medium" }, bottom: { style: "medium" }, left: { style: "medium" }, right: { style: "medium" } }; if (colNumber === 3) cell.numFmt = "#,##0.00"; });

    const [yr, mo] = inventoryMonth.split("-");
    const monthNames: Record<string, string> = {
      "01": "Januar", "02": "Februar", "03": "Mars", "04": "April",
      "05": "Mai", "06": "Juni", "07": "Juli", "08": "August",
      "09": "September", "10": "Oktober", "11": "November", "12": "Desember",
    };
    const månedLabel = `${monthNames[mo] || mo} ${yr}`;
    const wsFront = wb.addWorksheet("Forside");
    wsFront.columns = [{ width: 8.5 }, { width: 37.5 }, { width: 15.5 }, { width: 18 }, { width: 8.5 }, { width: 4 }, { width: 53 }, { width: 31.5 }];
    const blue = "BDD7EE"; const green = "E2EFDA";
    const thin2 = { style: "thin" as const };
    const border = { top: thin2, bottom: thin2, left: thin2, right: thin2 };
    function fHdr(ws: any, rowNum: number, col: number, val: string, bg: string, bold = true) { const cell = ws.getCell(rowNum, col); cell.value = val; cell.font = { bold, size: 11 }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + bg } }; cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true }; cell.border = border; }
    function fLbl(ws: any, rowNum: number, col: number, val: string, bold = false) { const cell = ws.getCell(rowNum, col); cell.value = val; cell.font = { bold, size: 11 }; cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true }; cell.border = border; }
    function fVal(ws: any, rowNum: number, col: number, value: number | string | { formula: string }, bg?: string) { const cell = ws.getCell(rowNum, col); cell.value = value; if (typeof value === "number") cell.numFmt = "#,##0.00"; if (bg) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + bg } }; cell.alignment = { horizontal: "right", vertical: "middle" }; cell.border = border; }
    function fInputBlue(ws: any, rowNum: number, col: number, val: string) { const cell = ws.getCell(rowNum, col); cell.value = val; cell.font = { bold: true, size: 11 }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + blue } }; cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true }; cell.border = border; }
    function fInputGreen(ws: any, rowNum: number, col: number) { const cell = ws.getCell(rowNum, col); cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + green } }; cell.alignment = { horizontal: "right", vertical: "middle" }; cell.border = border; cell.font = { size: 18 }; }
    function mergeF(ws: any, r1: number, c1: number, r2: number, c2: number) { ws.mergeCells(r1, c1, r2, c2); }
    wsFront.getRow(1).height = 15.75; wsFront.getRow(2).height = 16.5; wsFront.getRow(3).height = 16.5;
    mergeF(wsFront, 2, 2, 3, 4); fInputBlue(wsFront, 2, 2, "Guttan på Torget AS");
    const g2 = wsFront.getCell(2, 7); g2.value = "Kontantbeholdning / Cash "; g2.font = { size: 11 }; g2.alignment = { horizontal: "left", vertical: "middle" };
    fInputBlue(wsFront, 2, 8, "(selskap/company)"); fInputBlue(wsFront, 3, 8, "(dato/date)");
    wsFront.getRow(4).height = 19.35; fHdr(wsFront, 4, 2, "VAREBEHOLDNING PR: ", blue, true); mergeF(wsFront, 4, 3, 4, 4); fInputBlue(wsFront, 4, 3, månedLabel);
    wsFront.getRow(5).height = 34.5; fHdr(wsFront, 5, 2, "Varekategori:", blue, true); mergeF(wsFront, 5, 3, 5, 4); fHdr(wsFront, 5, 3, "Sum:", blue, true);
    const g5 = wsFront.getCell(5, 7); g5.value = "Kontantbeholdning in-house (inkl. vekselkasser)/cash in house (incl. cash till)"; g5.font = { size: 11 }; g5.alignment = { horizontal: "left", vertical: "middle", wrapText: true }; g5.border = border;
    fInputGreen(wsFront, 5, 8);
    const drinkCategories = ["Mineralvann", "Kaffe/te", "Vin", "Øl", "Cider", "Brennevin"];
   const matBuckets = data.materialCategories.filter((c: string) => !drinkCategories.includes(c) && c !== "Mat");
    const egenprodTotal = egenprodusertCategories.reduce((sum: number, b: string) => sum + bucketValue(b), 0);
    const matTotal = matBuckets.reduce((sum: number, b: string) => sum + bucketValue(b), 0) + egenprodTotal;
    wsFront.getRow(6).height = 24.75; fLbl(wsFront, 6, 2, "Mat (Telt på kjøkken-telleliste):"); mergeF(wsFront, 6, 3, 6, 4); fVal(wsFront, 6, 3, Math.round(matTotal * 100) / 100);
    const g6 = wsFront.getCell(6, 7); g6.value = "Levert Loomis siste mnd/ Delivered to Loomis last month"; g6.font = { size: 11 }; g6.alignment = { horizontal: "left", vertical: "middle", wrapText: true }; g6.border = border; fInputGreen(wsFront, 6, 8);
    wsFront.getRow(7).height = 41.25; fLbl(wsFront, 7, 2, "Mat (Evt. eksternt lager):"); mergeF(wsFront, 7, 3, 7, 4); fVal(wsFront, 7, 3, 0);
    const g7 = wsFront.getCell(7, 7); g7.value = "Poser til Loomis, ikke levert / Bags for Loomis in the safe but not delivered"; g7.font = { size: 11 }; g7.alignment = { horizontal: "left", vertical: "middle", wrapText: true }; g7.border = border; fInputGreen(wsFront, 7, 8);
    wsFront.getRow(8).height = 24.75; fLbl(wsFront, 8, 2, "Mat (Telt på bar-telleliste):"); mergeF(wsFront, 8, 3, 8, 4); fVal(wsFront, 8, 3, 0);
    wsFront.getRow(9).height = 24.75; fLbl(wsFront, 9, 2, "Total Mat:", true); mergeF(wsFront, 9, 3, 9, 4);
    const c9 = wsFront.getCell(9, 3); c9.value = { formula: "SUM(C6:C8)" }; c9.numFmt = "#,##0.00"; c9.alignment = { horizontal: "right", vertical: "middle" }; c9.border = border; c9.font = { bold: true };
    const g9 = wsFront.getCell(9, 7); g9.value = "Sum / Total"; g9.font = { size: 11 }; g9.alignment = { horizontal: "left", vertical: "middle" }; g9.border = border;
    const h9 = wsFront.getCell(9, 8); h9.value = { formula: "SUM(H5:H7)" }; h9.numFmt = "#,##0.00"; h9.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + blue } }; h9.alignment = { horizontal: "right", vertical: "middle" }; h9.border = border; h9.font = { size: 11 };
    const drikkeRader = [
      { label: "Brennevin:", v: bucketValue("Brennevin") }, { label: "Øl (fatøl + flaske/boks):", v: bucketValue("Øl") },
      { label: "Øl (egenprodusert til servering):", v: 0 }, { label: "Øl (egenprodusert i produksjon):", v: 0 },
      { label: "Mineralvann:", v: bucketValue("Mineralvann") }, { label: "Vin + Cider:", v: bucketValue("Vin") + bucketValue("Cider") },
      { label: "Kaffe/te:", v: bucketValue("Kaffe/te") }, { label: "Tobakk:", v: 0 },
    ];
    drikkeRader.forEach(({ label, v }, i) => { const r = 10 + i; fLbl(wsFront, r, 2, label); mergeF(wsFront, r, 3, r, 4); fVal(wsFront, r, 3, Math.round(v * 100) / 100); });
    fLbl(wsFront, 18, 2, "Total varebeholdning mat og drikke:", true); mergeF(wsFront, 18, 3, 18, 4);
    const c18 = wsFront.getCell(18, 3); c18.value = { formula: "SUM(C10:C17)+C9" }; c18.numFmt = "#,##0.00"; c18.alignment = { horizontal: "right", vertical: "middle" }; c18.border = border; c18.font = { bold: true };
    wsFront.getRow(21).height = 15.75; mergeF(wsFront, 21, 2, 22, 4); fHdr(wsFront, 21, 2, "BREKKASJE / KJØKKENREKVISISJON", blue, true);
    wsFront.getRow(23).height = 30.75; fLbl(wsFront, 23, 2, "Varekategori:", true); fHdr(wsFront, 23, 3, "Brekkasje:", blue, false); fHdr(wsFront, 23, 4, "Kjøkkenrekvisisjon: (Bar til kjøkken)", green, false);
    wsFront.getRow(24).height = 15.75; fHdr(wsFront, 24, 3, "Beløp:", blue, false); fHdr(wsFront, 24, 4, "Beløp:", green, false);
    const matWasteTotal = matBuckets.reduce((sum: number, b: string) => sum + bucketWasteValue(b), 0);
    const brekkasjeRader = [
      { label: "Mat (inkl. igjen ved dagsslutt):", bv: Math.round((matWasteTotal + kassasvinn) * 100) / 100 },
      { label: "Vin + Cider:", bv: Math.round((bucketWasteValue("Vin") + bucketWasteValue("Cider")) * 100) / 100 },
      { label: "Brennevin:", bv: Math.round(bucketWasteValue("Brennevin") * 100) / 100 },
      { label: "Øl:", bv: Math.round(bucketWasteValue("Øl") * 100) / 100 },
      { label: "Mineralvann:", bv: Math.round(bucketWasteValue("Mineralvann") * 100) / 100 },
      { label: "Kaffe/te:", bv: Math.round(bucketWasteValue("Kaffe/te") * 100) / 100 },
      { label: "", bv: 0 },
    ];
    brekkasjeRader.forEach(({ label, bv }, i) => { const r = 25 + i; fLbl(wsFront, r, 2, label); fVal(wsFront, r, 3, bv, blue); fVal(wsFront, r, 4, 0, green); });
    fLbl(wsFront, 32, 2, "Total:", true);
    const c32 = wsFront.getCell(32, 3); c32.value = { formula: "SUM(C25:C31)" }; c32.numFmt = "#,##0.00"; c32.font = { bold: true }; c32.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + blue } }; c32.alignment = { horizontal: "right", vertical: "middle" }; c32.border = border;
    const d32 = wsFront.getCell(32, 4); d32.value = { formula: "SUM(D25:D31)" }; d32.numFmt = "#,##0.00"; d32.font = { bold: true }; d32.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + green } }; d32.alignment = { horizontal: "right", vertical: "middle" }; d32.border = border;
    wsFront.getRow(35).height = 15.75; fLbl(wsFront, 35, 2, "Kommentar:");
    const allSheets = (wb as any)._worksheets.filter(Boolean);
    const frontIdx = allSheets.findIndex((s: any) => s.name === "Forside");
    if (frontIdx > 0) { const [front] = allSheets.splice(frontIdx, 1); allSheets.unshift(front); (wb as any)._worksheets = [undefined, ...allSheets]; allSheets.forEach((s: any, i: number) => { s.orderNo = i + 1; }); }
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `varetelling-${inventoryMonth}.xlsx`; a.click(); URL.revokeObjectURL(url);
  }

  // ── Mobilkort med lokal state og onBlur-lagring ───────────────────────────

  function MobileInventoryCard({ m }: { m: Material }) {
    const locations = categoryLocations[m.category] || ["Lager"];
    const value = materialInventoryValue(m);
    const isExpanded = expandedMobileId === m.id;
    const hasData = locations.some((loc) => { const lc = getLocationCount(m.id, loc); return lc.packages > 0 || lc.loose > 0; }) || getMaterialWaste(m.id) > 0;
    const cardRef = React.useRef<HTMLDivElement>(null);

    // Lokal state per lokasjon
    const [localValues, setLocalValues] = useState<Record<string, { packages: string; loose: string }>>(() => {
      const init: Record<string, { packages: string; loose: string }> = {};
      locations.forEach((loc) => {
        const lc = getLocationCount(m.id, loc);
        init[loc] = { packages: lc.packages ? String(lc.packages) : "", loose: lc.loose ? String(lc.loose) : "" };
      });
      return init;
    });
    const [localWaste, setLocalWaste] = useState<string>(getMaterialWaste(m.id) ? String(getMaterialWaste(m.id)) : "");

    // Sync fra counts når kortet åpnes
    React.useEffect(() => {
      if (isExpanded) {
        const next: Record<string, { packages: string; loose: string }> = {};
        locations.forEach((loc) => {
          const lc = getLocationCount(m.id, loc);
          next[loc] = { packages: lc.packages ? String(lc.packages) : "", loose: lc.loose ? String(lc.loose) : "" };
        });
        setLocalValues(next);
        setLocalWaste(getMaterialWaste(m.id) ? String(getMaterialWaste(m.id)) : "");
      }
    }, [isExpanded, inventoryMonth]);

    return (
      <div ref={cardRef} style={{ border: "1px solid #e2e8f0", borderRadius: 14, marginBottom: 8, overflow: "hidden", background: hasData ? "#f0fdf4" : "white" }}>
        <button onClick={() => toggleMobileCard(m.id)} style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", background: "transparent", border: 0, cursor: "pointer", textAlign: "left", gap: 12 }}>
          <div>
            <b style={{ fontSize: 15 }}>{m.name}</b>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{m.packageSize} {m.unit} · {currency(m.packagePrice)} pr pk</div>
            {getPrevMaterialTotal(m.id) > 0 && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>Forrige mnd: {getPrevMaterialTotal(m.id)}</div>}
            {hasData && <div style={{ fontSize: 12, color: "#166534", marginTop: 2, fontWeight: 700 }}>Verdi: {currency(value)}</div>}
          </div>
          <span style={{ color: "#94a3b8", fontSize: 20 }}>{isExpanded ? "▲" : "▼"}</span>
        </button>
        {isExpanded && (
          <div style={{ padding: "0 16px 16px", borderTop: "1px solid #e2e8f0" }}>
            {locations.map((loc) => {
              const lv = localValues[loc] || { packages: "", loose: "" };
              return (
                <div key={loc} style={{ marginTop: 14 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#475569", marginBottom: 8, padding: "4px 10px", background: "#f1f5f9", borderRadius: 8, display: "inline-block" }}>📍 {loc}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <label style={{ fontSize: 13 }}>Kasser
                      <input
                        type="number" inputMode="decimal" disabled={isLocked}
                        value={lv.packages}
                        onChange={(e) => setLocalValues((prev) => ({ ...prev, [loc]: { ...prev[loc], packages: e.target.value } }))}
                        onBlur={(e) => {
                          const packages = Number(e.target.value) || 0;
                          const loose = Number(localValues[loc]?.loose) || 0;
                          updateLocationCount(m.id, loc, packages, loose);
                        }}
                        placeholder="0"
                        style={{ marginTop: 4, fontSize: 18, padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5e1", width: "100%", background: isLocked ? "#f8fafc" : "white" }}
                      />
                    </label>
                    <label style={{ fontSize: 13 }}>Løs ({m.unit})
                      <input
                        type="number" inputMode="decimal" disabled={isLocked}
                        value={lv.loose}
                        onChange={(e) => setLocalValues((prev) => ({ ...prev, [loc]: { ...prev[loc], loose: e.target.value } }))}
                        onBlur={(e) => {
                          const loose = Number(e.target.value) || 0;
                          const packages = Number(localValues[loc]?.packages) || 0;
                          updateLocationCount(m.id, loc, packages, loose);
                        }}
                        placeholder="0"
                        style={{ marginTop: 4, fontSize: 18, padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5e1", width: "100%", background: isLocked ? "#f8fafc" : "white" }}
                      />
                    </label>
                  </div>
                </div>
              );
            })}
            <div style={{ marginTop: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#92400e", marginBottom: 8, padding: "4px 10px", background: "#fffbeb", borderRadius: 8, display: "inline-block" }}>⚠️ Svinn</div>
              <input
                type="number" inputMode="decimal" disabled={isLocked}
                value={localWaste}
                onChange={(e) => setLocalWaste(e.target.value)}
                onBlur={(e) => updateMaterialWaste(m.id, Number(e.target.value) || 0)}
                placeholder="0"
                style={{ fontSize: 18, padding: "10px 12px", borderRadius: 10, border: "1px solid #f59e0b", width: "100%", background: isLocked ? "#f8fafc" : "#fffbeb" }}
              />
            </div>
            <div style={{ marginTop: 12, textAlign: "right", fontSize: 14, fontWeight: 700 }}>Verdi: {currency(value)}</div>
          </div>
        )}
      </div>
    );
  }

  function MobileProductCard({ p }: { p: Product }) {
    const locations = categoryLocations[p.category] || ["Lager"];
    const unitCost = productUnitCost(p);
    const value = productInventoryValue(p, unitCost);
    const cardId = `product_${p.id}`;
    const isExpanded = expandedMobileId === cardId;
    const hasData = locations.some((loc) => { const lc = getProductCount(p.id, loc); return lc.cases > 0 || lc.loose > 0; }) || getProductWaste(p.id) > 0;
    const cardRef = React.useRef<HTMLDivElement>(null);

    const [localValues, setLocalValues] = useState<Record<string, { cases: string; loose: string }>>(() => {
      const init: Record<string, { cases: string; loose: string }> = {};
      locations.forEach((loc) => {
        const lc = getProductCount(p.id, loc);
        init[loc] = { cases: lc.cases ? String(lc.cases) : "", loose: lc.loose ? String(lc.loose) : "" };
      });
      return init;
    });
    const [localWaste, setLocalWaste] = useState<string>(getProductWaste(p.id) ? String(getProductWaste(p.id)) : "");

    React.useEffect(() => {
      if (isExpanded) {
        const next: Record<string, { cases: string; loose: string }> = {};
        locations.forEach((loc) => {
          const lc = getProductCount(p.id, loc);
          next[loc] = { cases: lc.cases ? String(lc.cases) : "", loose: lc.loose ? String(lc.loose) : "" };
        });
        setLocalValues(next);
        setLocalWaste(getProductWaste(p.id) ? String(getProductWaste(p.id)) : "");
      }
    }, [isExpanded, inventoryMonth]);

    return (
      <div ref={cardRef} style={{ border: "1px solid #e2e8f0", borderRadius: 14, marginBottom: 8, overflow: "hidden", background: hasData ? "#f0fdf4" : "white" }}>
        <button onClick={() => toggleMobileCard(cardId)} style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", background: "transparent", border: 0, cursor: "pointer", textAlign: "left", gap: 12 }}>
          <div>
            <b style={{ fontSize: 15 }}>{p.name}</b>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{currency(unitCost)}/stk · {Number(p.unitsPerCase || 1)} stk/eske</div>
            {getPrevProductTotal(p.id) > 0 && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>Forrige mnd: {getPrevProductTotal(p.id)} stk</div>}
            {hasData && <div style={{ fontSize: 12, color: "#166534", marginTop: 2, fontWeight: 700 }}>Verdi: {currency(value)}</div>}
          </div>
          <span style={{ color: "#94a3b8", fontSize: 20 }}>{isExpanded ? "▲" : "▼"}</span>
        </button>
        {isExpanded && (
          <div style={{ padding: "0 16px 16px", borderTop: "1px solid #e2e8f0" }}>
            {locations.map((loc) => {
              const lv = localValues[loc] || { cases: "", loose: "" };
              return (
                <div key={loc} style={{ marginTop: 14 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#475569", marginBottom: 8, padding: "4px 10px", background: "#f1f5f9", borderRadius: 8, display: "inline-block" }}>📍 {loc}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <label style={{ fontSize: 13 }}>Esker
                      <input
                        type="number" inputMode="decimal" disabled={isLocked}
                        value={lv.cases}
                        onChange={(e) => setLocalValues((prev) => ({ ...prev, [loc]: { ...prev[loc], cases: e.target.value } }))}
                        onBlur={(e) => {
                          const cases = Number(e.target.value) || 0;
                          const loose = Number(localValues[loc]?.loose) || 0;
                          updateProductCount(p, loc, cases, loose);
                        }}
                        placeholder="0"
                        style={{ marginTop: 4, fontSize: 18, padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5e1", width: "100%", background: isLocked ? "#f8fafc" : "white" }}
                      />
                    </label>
                    <label style={{ fontSize: 13 }}>Løs stk
                      <input
                        type="number" inputMode="decimal" disabled={isLocked}
                        value={lv.loose}
                        onChange={(e) => setLocalValues((prev) => ({ ...prev, [loc]: { ...prev[loc], loose: e.target.value } }))}
                        onBlur={(e) => {
                          const loose = Number(e.target.value) || 0;
                          const cases = Number(localValues[loc]?.cases) || 0;
                          updateProductCount(p, loc, cases, loose);
                        }}
                        placeholder="0"
                        style={{ marginTop: 4, fontSize: 18, padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5e1", width: "100%", background: isLocked ? "#f8fafc" : "white" }}
                      />
                    </label>
                  </div>
                </div>
              );
            })}
            <div style={{ marginTop: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#92400e", marginBottom: 8, padding: "4px 10px", background: "#fffbeb", borderRadius: 8, display: "inline-block" }}>⚠️ Svinn stk</div>
              <input
                type="number" inputMode="decimal" disabled={isLocked}
                value={localWaste}
                onChange={(e) => setLocalWaste(e.target.value)}
                onBlur={(e) => updateProductWaste(p, Number(e.target.value) || 0)}
                placeholder="0"
                style={{ fontSize: 18, padding: "10px 12px", borderRadius: 10, border: "1px solid #f59e0b", width: "100%", background: isLocked ? "#f8fafc" : "#fffbeb" }}
              />
            </div>
            <div style={{ marginTop: 12, textAlign: "right", fontSize: 14, fontWeight: 700 }}>Verdi: {currency(value)}</div>
          </div>
        )}
      </div>
    );
  }

  return (
    <section className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h2 style={{ margin: 0 }}>Varetelling</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: isRealtimeConnected ? "#166534" : "#991b1b" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: isRealtimeConnected ? "#16a34a" : "#dc2626" }} />
          {isRealtimeConnected ? "Live" : "Frakoblet"}
        </div>
      </div>

      <div className="form-grid three">
        <label>Måned<select value={month} onChange={(e) => { setInventoryMonth(`${year}-${e.target.value}`); setInventoryPage(1); }}><option value="01">Januar</option><option value="02">Februar</option><option value="03">Mars</option><option value="04">April</option><option value="05">Mai</option><option value="06">Juni</option><option value="07">Juli</option><option value="08">August</option><option value="09">September</option><option value="10">Oktober</option><option value="11">November</option><option value="12">Desember</option></select></label>
        <label>År<select value={year} onChange={(e) => { setInventoryMonth(`${e.target.value}-${month}`); setInventoryPage(1); }}>{Array.from({ length: 16 }, (_, i) => 2020 + i).map((y) => <option key={y} value={String(y)}>{y}</option>)}</select></label>
        <Metric label="Sum varetelling" value={currency(total)} dark />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 8, margin: "12px 0" }}>
        <div style={{ gridColumn: "1 / -1", fontWeight: 800, color: "#64748b", fontSize: 13 }}>Mat</div>
        {matSubBuckets.map((b) => <Metric key={b} label={b} value={currency(bucketValue(b))} />)}
        <div style={{ gridColumn: "1 / -1", fontWeight: 800, color: "#64748b", fontSize: 13, marginTop: 8 }}>Deli & Drikke</div>
        {["Deli", ...drinkBuckets].map((b) => <Metric key={b} label={b} value={currency(bucketValue(b))} />)}
      </div>

      <div className="soft-box" style={{ marginBottom: 12 }}>
        <label style={{ fontWeight: 800, fontSize: 14 }}>
          Igjen ved dagsslutt, måned (råvarekost kr)
          <input
            type="number" disabled={isLocked}
            value={kassasvinn || ""}
            onChange={(e) => updateKassasvinn(Number(e.target.value) || 0)}
            placeholder="0"
            style={{ marginTop: 8, fontSize: 16, padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5e1", width: "100%", maxWidth: 300, display: "block", background: isLocked ? "#f8fafc" : "white" }}
          />
        </label>
      </div>

      <details className="soft-box" style={{ padding: 0 }}>
        <summary style={{ padding: "12px 16px", fontWeight: 800, cursor: "pointer", listStyle: "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Svinn denne måneden <span style={{ fontWeight: 400, color: "#64748b" }}>{currency(totalWasteValue())}</span></span>
          <span style={{ color: "#64748b", fontSize: 13 }}>▼</span>
        </summary>
        <div style={{ padding: "0 16px 16px" }}>
          <table style={{ marginTop: 8 }}>
            <thead><tr><th>Kategori / Produkt</th><th>Svinn (mengde)</th><th>Svinn (varekost)</th></tr></thead>
            <tbody>
              {kassasvinn > 0 && <tr style={{ background: "#fffbeb" }}><td><b>Igjen ved dagsslutt, måned</b></td><td>-</td><td><b>{currency(kassasvinn)}</b></td></tr>}
              {allMaterialCategories.map((bucket) => { const mw = data.materials.filter((m) => m.category === bucket && getMaterialWaste(m.id) > 0); if (!mw.length) return null; return (<><tr key={`wc-${bucket}`} style={{ background: bucketColors[bucket] || "#f8fafc" }}><td><b>{bucket}</b></td><td></td><td><b>{currency(bucketWasteValue(bucket))}</b></td></tr>{mw.map((m) => <tr key={`w-${m.id}`}><td style={{ paddingLeft: 24 }}>{m.name}</td><td>{getMaterialWaste(m.id)} {m.unit}</td><td>{currency(materialWasteValue(m))}</td></tr>)}</>); })}
              {egenprodusertCategories.map((bucket) => { const pw = data.products.filter((p) => p.category === bucket && getProductWaste(p.id) > 0); if (!pw.length) return null; return (<><tr key={`wce-${bucket}`} style={{ background: bucketColors[bucket] || "#f8fafc" }}><td><b>{bucket} (egenprodusert)</b></td><td></td><td><b>{currency(bucketWasteValue(bucket))}</b></td></tr>{pw.map((p) => <tr key={`we-${p.id}`}><td style={{ paddingLeft: 24 }}>{p.name}</td><td>{getProductWaste(p.id)} stk</td><td>{currency(productWasteValue(p))}</td></tr>)}</>); })}
              <tr style={{ background: "#0f172a", color: "white" }}><td><b>Total svinn</b></td><td></td><td><b>{currency(totalWasteValue())}</b></td></tr>
            </tbody>
          </table>
        </div>
      </details>

      <details className="soft-box" style={{ padding: 0 }}>
        <summary style={{ padding: "12px 16px", fontWeight: 800, cursor: "pointer", listStyle: "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Lønnsomhetsrapport: Mat vs. Deli</span>
          <span style={{ color: "#64748b", fontSize: 13 }}>▼</span>
        </summary>
        <div style={{ padding: "0 16px 16px" }}>
          <p style={{ color: "#64748b", fontSize: 13, marginTop: 8 }}>
            Regner ekte varekost via lagerbevegelse: Åpningsbeholdning (forrige måneds telling) + Innkjøp − Sluttbeholdning (denne månedens telling).
            Innkjøpet fra regnskapet er kun kjent samlet for mat+deli, så Deli sin andel anslås fra Deli sin egen kost/utsalgspris-proxy, og resten tilfaller Mat.
          </p>

          <div className="form-grid three">
            <label>Mat-salg netto eks. mva (ekskl. deli)
              <input type="number" value={profitability.matSalesNetto || ""} onChange={(e) => updateProfitability({ matSalesNetto: Number(e.target.value) || 0 })} placeholder="0" />
            </label>
            <label>Deli-salg netto eks. mva
              <input type="number" value={profitability.deliSalesNetto || ""} onChange={(e) => updateProfitability({ deliSalesNetto: Number(e.target.value) || 0 })} placeholder="0" />
            </label>
            <label>Varekjøp mat totalt (fra regnskap, mat+deli samlet)
              <input type="number" value={profitability.varekjopMatTotalt || ""} onChange={(e) => updateProfitability({ varekjopMatTotalt: Number(e.target.value) || 0 })} placeholder="F.eks. 600000" />
            </label>
          </div>

          <div className="metric-row">
            <Metric label="Åpningsbeholdning Mat/Deli" value={`${currency(matOpening)} / ${currency(deliOpening)}`} />
            <Metric label="Sluttbeholdning Mat/Deli" value={`${currency(matClosing)} / ${currency(deliClosing)}`} />
            <Metric label="Anslått innkjøp Mat / Deli" value={`${currency(matInnkjopEstimat)} / ${currency(deliInnkjopEstimat)}`} />
          </div>

          <div className="metric-row">
            <Metric label="Deli varekost % (live, fra råvarer)" value={`${num(deliVarekostPct * 100, 1)} %`} />
            <Metric label="Deli varekost kr" value={currency(deliVarekostKr)} />
            <Metric label="Mat varekost % (beregnet)" value={`${num(matVarekostPctResult * 100, 1)} %`} dark />
            <Metric label="Mat varekost kr" value={currency(matVarekostKr)} dark />
          </div>

          <div className="metric-row">
            <Metric label="Mat bruttofortjeneste" value={currency(matBruttoKr)} />
            <Metric label="Mat bruttomargin %" value={`${num(matMarginPct * 100, 1)} %`} tone={marginTone(matMarginPct * 100)} />
            <Metric label="Deli bruttofortjeneste" value={currency(deliBruttoKr)} />
            <Metric label="Deli bruttomargin %" value={`${num(deliMarginPct * 100, 1)} %`} tone={marginTone(deliMarginPct * 100)} />
          </div>

          {(!matSalesNetto || !deliSalesNetto || !varekjopMatTotalt) && (
            <div className="warning">Fyll inn alle tre inputfeltene over for å se en fullstendig beregning.</div>
          )}
        </div>
      </details>

      <div className="soft-box">
        <div className="between">
          <h3>Historikk siste 12 registrerte måneder</h3>
          <button className={showInventoryStats ? "btn active" : "btn"} onClick={() => setShowInventoryStats(!showInventoryStats)}>{showInventoryStats ? "Skjul statistikk" : "Vis statistikk"}</button>
        </div>
        <table><thead><tr><th>Måned</th><th>Varebeholdning</th><th>Svinn</th></tr></thead><tbody>{inventoryHistory.map((h) => <tr key={h.monthKey}><td>{h.monthKey}</td><td>{currency(h.total)}</td><td>{currency(h.wasteTotal)}</td></tr>)}</tbody></table>
      </div>

      {showInventoryStats && (
        <div className="soft-box">
          <h3>Grafisk statistikk</h3>
          <div className="inventory-chart">
            {inventoryHistory.map((h) => (
              <div key={h.monthKey} className="inventory-month">
                <div className="between"><b>{h.monthKey}</b><b>{currency(h.total)}</b></div>
                <div className="bar-bg"><div className="bar-fill" style={{ width: `${Math.max(4, (h.total / maxInventoryValue) * 100)}%` }} /></div>
                <div className="inventory-breakdown">{statsBuckets.map((bucket) => <div key={bucket} className="breakdown-row"><span>{bucket}</span><span>{currency(valueForBucketInMonth(h.monthKey, bucket))}</span></div>)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "12px 0" }}>
<button className="btn" onClick={() => {
          if (!isLocked) {
            // Lås måned: frys alle gjeldende priser (live → snapshot) for både råvarer og egenproduserte produkter
            const frozenItems: Record<string, any> = { ...counts };
            data.materials.forEach((m) => {
              const existing = frozenItems[m.id];
              if (existing) {
                frozenItems[m.id] = { ...existing, packagePrice: m.packagePrice, pricePerUnit: m.pricePerUnit };
              }
            });
            data.products.filter((p) => egenprodusertCategories.includes(p.category)).forEach((p) => {
              const key = `product_${p.id}`;
              const existing = frozenItems[key];
              if (existing) {
                frozenItems[key] = { ...existing, frozenUnitCost: productUnitCost(p) };
              }
            });
            updateInventoryRpc(inventoryMonth, { itemsPatch: frozenItems, locked: true, pricesFrozen: true });
          } else {
            updateInventoryRpc(inventoryMonth, { locked: false });
          }
        }}>{isLocked ? "Lås opp måned" : "Lås måned"}</button>
        <button className="btn active" onClick={exportInventoryXlsx}>Eksporter XLSX</button>
        <button className={showAllLocations ? "btn active" : "btn"} onClick={() => setShowAllLocations(!showAllLocations)} style={{ marginLeft: "auto" }}>
          {showAllLocations ? "Kompakt visning" : "Vis alle steder (PC)"}
        </button>
      </div>

      <p style={{ color: "#64748b", fontSize: 13, margin: "0 0 4px" }}>Filtrer på kategori</p>
      <select value={inventoryCategoryFilter} onChange={(e) => { setInventoryCategoryFilter(e.target.value); setInventoryPage(1); setExpandedMobileId(null); }} style={{ marginBottom: 8, fontSize: 16, padding: "10px 14px" }}>
        {internalBuckets.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
      </select>
      <input value={inventorySearch} onChange={(e) => { setInventorySearch(e.target.value); setInventoryPage(1); setExpandedMobileId(null); }} placeholder="Søk" style={{ fontSize: 16, fontWeight: 700, padding: "12px 14px", marginBottom: 12, background: "#fef3c7" }} />
      <button
        className={showRecentCounts ? "btn active" : "btn"}
        onClick={() => setShowRecentCounts(!showRecentCounts)}
        style={{ marginBottom: 12 }}
      >
        🕐 Siste tellinger
      </button>

      {showRecentCounts && (() => {
        type RecentItem = { name: string; total: number; unit: string; countedAt: string; isProduct: boolean };
        const recent: RecentItem[] = [];

        data.materials.forEach((m) => {
          const c = counts[m.id] as any;
          if (!c?.countedAt) return;
          const total = (Number(c.packages || 0) * Number(m.packageSize || 1)) + Number(c.loose || 0);
          recent.push({ name: m.name, total, unit: m.unit, countedAt: c.countedAt, isProduct: false });
        });

        data.products.filter((p) => egenprodusertCategories.includes(p.category)).forEach((p) => {
          const c = counts[`product_${p.id}`] as any;
          if (!c?.countedAt) return;
          const total = (Number(c.packages || 0) * Number(p.unitsPerCase || 1)) + Number(c.loose || 0);
          recent.push({ name: p.name, total, unit: "stk", countedAt: c.countedAt, isProduct: true });
        });

        recent.sort((a, b) => b.countedAt.localeCompare(a.countedAt));
        const top20 = recent.slice(0, 20);

        return (
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, marginBottom: 16, overflow: "hidden", background: "white" }}>
            <div style={{ background: "#0f172a", color: "white", padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <b style={{ fontSize: 14 }}>🕐 Siste {top20.length} tellinger – {inventoryMonth}</b>
              <button onClick={() => setShowRecentCounts(false)} style={{ background: "transparent", border: 0, color: "white", cursor: "pointer", fontSize: 18 }}>×</button>
            </div>
            {top20.length === 0 ? (
              <p style={{ padding: 16, color: "#64748b" }}>Ingen tellinger registrert denne måneden ennå.</p>
            ) : (
              <table style={{ marginTop: 0 }}>
                <thead>
                  <tr>
                    <th>Tidspunkt</th>
                    <th>Vare</th>
                    <th style={{ textAlign: "right" }}>Totalt</th>
                  </tr>
                </thead>
                <tbody>
                  {top20.map((item, i) => {
                    const d = new Date(item.countedAt);
                    const dato = `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
                    const tid = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
                    return (
                      <tr key={i} style={{ background: i % 2 === 0 ? "white" : "#f8fafc" }}>
                        <td style={{ color: "#64748b", whiteSpace: "nowrap" }}>{dato} {tid}</td>
                        <td>
                          <b>{item.name}</b>
                          <span style={{ marginLeft: 6, fontSize: 11, color: "#94a3b8" }}>
                            {item.isProduct ? "egenprodusert" : "råvare"}
                          </span>
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 700 }}>{num(item.total, 2)} {item.unit}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        );
      })()}

      <p style={{ color: "#64748b" }}>Viser {filtered.length} råvarer.</p>

      <div className="inventory-mobile-view">
        {egenprodusertCategories.map((bucket) => {
          if (inventoryCategoryFilter !== "Alle" && inventoryCategoryFilter !== "Mat" && inventoryCategoryFilter !== bucket) return null;
          const bucketProducts = data.products.filter((p) => p.category === bucket).filter((p) => inventorySearch === "" || p.name.toLowerCase().includes(inventorySearch.toLowerCase()));
          if (!bucketProducts.length) return null;
          const color = bucketColors[bucket] || "#f8fafc";
          return (
            <div key={`mob-ep-${bucket}`} style={{ marginBottom: 20 }}>
              <div style={{ background: color, border: "1px solid #e2e8f0", borderRadius: 12, padding: "10px 14px", display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <b>{bucket} <span style={{ fontWeight: 400, fontSize: 12, color: "#64748b" }}>egenprodusert</span></b>
                <span style={{ color: "#64748b", fontSize: 13 }}>{currency(egenprodusertBucketValue(bucket))}</span>
              </div>
              {bucketProducts.map((p) => <MobileProductCard key={p.id} p={p} />)}
            </div>
          );
        })}
        {Object.entries(groupedMaterials).map(([bucket, materials]) => {
          const color = bucketColors[bucket] || "#f8fafc";
          return (
            <div key={`mob-${bucket}`} style={{ marginBottom: 20 }}>
              <div style={{ background: color, border: "1px solid #e2e8f0", borderRadius: 12, padding: "10px 14px", display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <b>{bucket}</b>
                <span style={{ color: "#64748b", fontSize: 13 }}>{currency(bucketValue(bucket))}</span>
              </div>
              {materials.map((m) => <MobileInventoryCard key={m.id} m={m} />)}
            </div>
          );
        })}
      </div>

<div className={showAllLocations ? "inventory-desktop-view wide" : "inventory-desktop-view"}>
          {egenprodusertCategories.map((bucket) => {
          if (inventoryCategoryFilter !== "Alle" && inventoryCategoryFilter !== "Mat" && inventoryCategoryFilter !== bucket) return null;
          const locations = categoryLocations[bucket] || ["Lager"];
          const bucketProducts = data.products.filter((p) => p.category === bucket).filter((p) => inventorySearch === "" || p.name.toLowerCase().includes(inventorySearch.toLowerCase()));
          if (!bucketProducts.length) return null;
          const color = bucketColors[bucket] || "#f8fafc";
          return (
            <div key={`egenprod-${bucket}`} style={{ marginBottom: 24 }}>
              <div style={{ background: color, border: "1px solid #e2e8f0", borderRadius: "14px 14px 0 0", padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <b>{bucket} <span style={{ fontWeight: 400, fontSize: 12, color: "#64748b" }}>egenprodusert</span></b>
                <span style={{ color: "#64748b", fontSize: 13 }}>{currency(egenprodusertBucketValue(bucket))}</span>
              </div>
              <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderTop: 0, borderRadius: "0 0 14px 14px" }}>
                <table style={{ marginTop: 0 }}>
                  <thead>
                    <tr><th style={{ minWidth: 200 }}>Produkt</th><th>Kostpris/stk</th><th>Per eske</th>{locations.map((loc) => <th key={loc} colSpan={2} style={{ textAlign: "center", background: color, borderLeft: "2px solid #cbd5e1" }}>{loc}</th>)}<th style={{ borderLeft: "2px solid #f59e0b", background: "#fffbeb" }}>Svinn stk</th><th style={{ borderLeft: "2px solid #94a3b8", background: "#f1f5f9" }}>Forrige mnd</th><th>Verdi</th></tr>
                    <tr style={{ background: "#f8fafc" }}><th></th><th></th><th></th>{locations.map((loc) => (<><th key={`${loc}-e`} style={{ fontSize: 11, color: "#64748b", borderLeft: "2px solid #cbd5e1", textAlign: "center" }}>Esker</th><th key={`${loc}-l`} style={{ fontSize: 11, color: "#64748b", textAlign: "center" }}>Løs stk</th></>))}<th style={{ fontSize: 11, color: "#92400e", borderLeft: "2px solid #f59e0b", textAlign: "center", background: "#fffbeb" }}>stk</th><th style={{ fontSize: 11, color: "#64748b", borderLeft: "2px solid #94a3b8", textAlign: "center", background: "#f1f5f9" }}>stk</th><th></th></tr>
                  </thead>
                  <tbody>
                    {bucketProducts.map((p) => { const unitCost = productUnitCost(p); const value = productInventoryValue(p, unitCost); const wasteAmt = getProductWaste(p.id); const prevTotal = getPrevProductTotal(p.id); return (
                      <tr key={p.id}>
                        <td><b>{p.name}</b><br /><small style={{ color: "#64748b" }}>{p.productNumber || "-"}</small></td>
                        <td>{currency(unitCost)}</td><td>{Number(p.unitsPerCase || 1)} stk</td>
{locations.map((loc) => { const lc = getProductCount(p.id, loc); return (<><td key={`${p.id}-${loc}-e`} style={{ borderLeft: "2px solid #cbd5e1" }}><input type="number" disabled={isLocked} defaultValue={lc.cases || ""} key={`${p.id}-${loc}-e-${lc.cases}`} onBlur={(e) => updateProductCount(p, loc, Number(e.target.value) || 0, lc.loose)} style={showAllLocations ? { width: 60, minWidth: 0, textAlign: "center" } : { minWidth: 70, textAlign: "center" }} /></td><td key={`${p.id}-${loc}-l`}><input type="number" disabled={isLocked} defaultValue={lc.loose || ""} key={`${p.id}-${loc}-l-${lc.loose}`} onBlur={(e) => updateProductCount(p, loc, lc.cases, Number(e.target.value) || 0)} style={showAllLocations ? { width: 60, minWidth: 0, textAlign: "center" } : { minWidth: 70, textAlign: "center" }} /></td></>); })}<td style={{ borderLeft: "2px solid #f59e0b", background: "#fffbeb" }}><input type="number" disabled={isLocked} defaultValue={wasteAmt || ""} key={`${p.id}-waste-${wasteAmt}`} onBlur={(e) => updateProductWaste(p, Number(e.target.value) || 0)} style={showAllLocations ? { width: 60, minWidth: 0, textAlign: "center" } : { minWidth: 70, textAlign: "center" }} /></td>                        <td style={{ borderLeft: "2px solid #94a3b8", background: "#f1f5f9", textAlign: "center", color: "#64748b" }}>{prevTotal || "-"}</td>
                        <td><b>{currency(value)}</b></td>
                      </tr>
                    ); })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
        {Object.entries(groupedMaterials).map(([bucket, materials]) => {
          const locations = categoryLocations[bucket] || ["Lager"];
          const color = bucketColors[bucket] || "#f8fafc";
          return (
            <div key={bucket} style={{ marginBottom: 24 }}>
              <div style={{ background: color, border: "1px solid #e2e8f0", borderRadius: "14px 14px 0 0", padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <b>{bucket}</b><span style={{ color: "#64748b", fontSize: 13 }}>{currency(bucketValue(bucket))}</span>
              </div>
              <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderTop: 0, borderRadius: "0 0 14px 14px" }}>
                <table style={{ marginTop: 0 }}>
                  <thead>
                    <tr><th style={{ minWidth: 200 }}>Vare</th><th>Råvarekost pr pk</th><th>Pakning</th>{locations.map((loc) => <th key={loc} colSpan={2} style={{ textAlign: "center", background: color, borderLeft: "2px solid #cbd5e1" }}>{loc}</th>)}<th style={{ borderLeft: "2px solid #f59e0b", background: "#fffbeb" }}>Svinn</th><th style={{ borderLeft: "2px solid #94a3b8", background: "#f1f5f9" }}>Forrige mnd</th><th>Verdi</th></tr>
                    <tr style={{ background: "#f8fafc" }}><th></th><th></th><th></th>{locations.map((loc) => (<><th key={`${loc}-p`} style={{ fontSize: 11, color: "#64748b", borderLeft: "2px solid #cbd5e1", textAlign: "center" }}>Kasser</th><th key={`${loc}-l`} style={{ fontSize: 11, color: "#64748b", textAlign: "center" }}>Løs</th></>))}<th style={{ fontSize: 11, color: "#92400e", borderLeft: "2px solid #f59e0b", textAlign: "center", background: "#fffbeb" }}>enheter</th><th style={{ fontSize: 11, color: "#64748b", borderLeft: "2px solid #94a3b8", textAlign: "center", background: "#f1f5f9" }}>enheter</th><th></th></tr>
                  </thead>
                  <tbody>
                    {materials.map((m) => { const value = materialInventoryValue(m); const wasteAmt = getMaterialWaste(m.id); const prevTotal = getPrevMaterialTotal(m.id); return (
                      <tr key={m.id}>
<td><b>{m.name}</b></td><td>{currency(m.packagePrice)}</td><td>{m.packageSize} {m.unit}</td>
                        {locations.map((loc) => { const lc = getLocationCount(m.id, loc); return (<><td key={`${m.id}-${loc}-p`} style={{ borderLeft: "2px solid #cbd5e1" }}><input type="number" disabled={isLocked} defaultValue={lc.packages || ""} key={`${m.id}-${loc}-p-${lc.packages}`} onBlur={(e) => updateLocationCount(m.id, loc, Number(e.target.value) || 0, lc.loose)} style={showAllLocations ? { width: 60, minWidth: 0, textAlign: "center" } : { minWidth: 70, textAlign: "center" }} /></td><td key={`${m.id}-${loc}-l`}><input type="number" disabled={isLocked} defaultValue={lc.loose || ""} key={`${m.id}-${loc}-l-${lc.loose}`} onBlur={(e) => updateLocationCount(m.id, loc, lc.packages, Number(e.target.value) || 0)} style={showAllLocations ? { width: 60, minWidth: 0, textAlign: "center" } : { minWidth: 70, textAlign: "center" }} /></td></>); })}
<td style={{ borderLeft: "2px solid #f59e0b", background: "#fffbeb" }}><input type="number" disabled={isLocked} defaultValue={wasteAmt || ""} key={`${m.id}-waste-${wasteAmt}`} onBlur={(e) => updateMaterialWaste(m.id, Number(e.target.value) || 0)} style={showAllLocations ? { width: 60, minWidth: 0, textAlign: "center" } : { minWidth: 70, textAlign: "center" }} /></td>                        <td style={{ borderLeft: "2px solid #94a3b8", background: "#f1f5f9", textAlign: "center", color: "#64748b" }}>{prevTotal || "-"}</td>                        <td><b>{currency(value)}</b></td>
                      </tr>
                    ); })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>

      <div className="pager">
        <button className="btn" disabled={inventoryPage <= 1} onClick={() => setInventoryPage(inventoryPage - 1)}>Forrige</button>
        <span>Side {inventoryPage} av {totalPages}</span>
        <button className="btn" disabled={inventoryPage >= totalPages} onClick={() => setInventoryPage(inventoryPage + 1)}>Neste</button>
      </div>

      <style jsx global>{`
        .inventory-mobile-view { display: none; }
        .inventory-desktop-view { display: block; max-width: 100%; overflow-x: auto; }
        .inventory-desktop-view:not(.wide) table { max-width: 900px; }
        .inventory-desktop-view.wide table { min-width: max-content; }
        @media (max-width: 768px) {
          .inventory-mobile-view { display: block; }
          .inventory-desktop-view { display: none; }
        }
      `}</style>
    </section>
  );
}
function RentalTab({ data, updateData }: { data: AppData; updateData: (p: Partial<AppData>) => void }) {
  const [productSearch, setProductSearch] = useState("");
  const [showIncluded, setShowIncluded] = useState(true);
  const [editingOfferId, setEditingOfferId] = useState<string | null>(null);
  const [showNewOffer, setShowNewOffer] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [offerSearch, setOfferSearch] = useState("");
  const [showTerms, setShowTerms] = useState(false);
  const [deletedOffers, setDeletedOffers] = useState<RentalOffer[]>(
    ((data as any).deletedRentalOffers || []) as RentalOffer[]
  );

  const [rental, setRental] = useState<RentalOffer>(() => ({ ...initialData.rental }));

  const addonLines = rental.extraLines || [];
  const addonTotal = addonLines.reduce((sum, line) => sum + Number(line.amount || 0), 0);
  const waiterAfterMidnightHours = Number(rental.waiterAfterMidnightHours || 0);
  const food = rental.productLines.reduce((sum, l) => sum + (data.products.find((p) => p.id === l.productId)?.customerPrice || 0) * l.guests, 0);
  const waiterCost = rental.waiterHours * data.settings.waiterHourlyRate + waiterAfterMidnightHours * data.settings.waiterAfterMidnightHourlyRate;
  const total = rental.venuePrice + food + waiterCost + addonTotal;

  const includedText = "Prisen inkluderer dekketøy, hvite duker, hvite papirservietter (Dunilin), kaffe og te og rengjøring av lokalene. Leier kan ta med egne kaker inkludert i prisen.";
  const termsText = `Bodøgaard – kunst & kultur er et privat kulturhus og visningssted for kunst og kulturarv. Stedet viser verker fra Bodøgaardsamlingen, som innehar Nord-Norges største private samling av kunst og kulturgjenstander, i tillegg til temporære utstillinger gjennom året fra nasjonale og internasjonale kunstnere. Bodøgaard har også konserter og andre kulturarrangementer, samt aktiviteter gjennom grafikkverkstedet Den Frie Presse.

Bodøgaard gir de som ønsker det muligheten til å leie enkeltrom eller hele anlegget til spesielle anledninger som jubileer, dåp, konfirmasjon, bryllup, minnestund, kurs/konferanse og andre selskaper.

Følgende vilkår gjelder ved leie av lokaler på Bodøgaard:

- All kommunikasjon vedrørende utleie av lokalene og serveringstilbudet skjer via Brødrene Berbusmel på tlf. 413 73 000 eller e-post brodrene@berbusmel.no. Gjeldende priser ligger til enhver tid tilgjengelig på www.berbusmel.no/bodgaard

- All mat og drikke må bestilles gjennom Brødrene Berbusmel.

- Anlegget har skjenkebevilling. Minst en servitør er derfor til enhver tid til stede, og det er ikke anledning til å ha medbrakt alkohol.

- Siste servering av alkoholholdig drikke skjer kl. 01:30, og gjestene må forlate lokalet senest kl. 02:00 – med mindre noe annet er avtalt.

- Bodøgaard ligger i et tettbygd strøk, og støy etter kl. 00:00 må begrenses. Dette er leietaker ansvarlig for.

- Kunsten som henger på veggene eller står utstilt i lokalene er en del av det faste inventaret og kan ikke fjernes eller endres. Kunst som står montert på gulv og er i veien for rigging til arrangementer skal ikke flyttes uten tillatelse fra huseier. Kunsten er forsikret gjennom Bodøgaard – kunst & kultur.

- Omvisning i utstillingene/samlingene kan bestilles på forhånd.

- Gratis parkering for alle gjester.`;

  // Bruker perUnit fra addon-innstillinger i stedet for hardkodet liste
  function addonUsesQuantity(addonName: string) {
    return !!data.rentalAddons.find((a) => a.name === addonName)?.perUnit;
  }

  function isAddonSelected(addon: RentalAddon) { return addonLines.some((line) => line.text === addon.name); }

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

  function saveOffer() {
    if (!rental.customer.trim()) return alert("Legg inn kundenavn.");
    const offer: RentalOffer = { ...rental, id: rental.id || `rental-${Date.now()}` };
    const existing = ((data as any).rentalOffers || []) as RentalOffer[];
    const next = existing.find((o) => o.id === offer.id)
      ? existing.map((o) => o.id === offer.id ? offer : o)
      : [offer, ...existing];
    updateData({ rentalOffers: next } as any);

    if (offer.date) {
      const rentalOrder = {
        id: `rental-order-${offer.id}`,
        orderNumber: offer.id,
        type: "catering" as const,
        customerType: "bedrift" as const,
        customer: offer.customer,
        companyName: offer.customer,
        orgNumber: "", companyAddress: "", phone: "",
        deliveryAddress: rental.venueExternal ? (rental.venueExternalName || "Eksternt lokale") : rental.venue,
        date: offer.date, time: "", note: offer.note || "", paymentInfo: "",
        guests: rental.productLines.reduce((sum, l) => sum + l.guests, 0),
        productId: rental.productLines[0]?.productId || "",
        orderLines: rental.productLines.filter((l) => l.productId).map((l) => ({ productId: l.productId, quantity: l.guests })),
        discountPercent: 0, isRecurring: false, recurringDays: [],
        recurringNote: `Leieavtale: ${rental.venueExternal ? (rental.venueExternalName || "Eksternt") : rental.venue}`,
        allergens: {}, dietVegan: "0", dietVegetarian: "0", dietPregnant: "0", dietOther: "",
      };
      const orders = data.orders || [];
      const existingOrderIdx = orders.findIndex((o) => o.id === rentalOrder.id);
      const nextOrders = existingOrderIdx >= 0
        ? orders.map((o, i) => i === existingOrderIdx ? rentalOrder : o)
        : [rentalOrder, ...orders];
      updateData({ orders: nextOrders });
    }

    setEditingOfferId(null);
    setShowNewOffer(false);
    alert("Tilbud lagret!");
  }

  function loadOffer(offer: RentalOffer) {
    setRental(offer);
    setEditingOfferId(offer.id || null);
    setShowNewOffer(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setRental({ ...initialData.rental });
    setEditingOfferId(null);
    setShowNewOffer(false);
  }

  function deleteOffer(id: string) {
    if (!confirm("Flytte tilbudet til papirkurv?")) return;
    const existing = ((data as any).rentalOffers || []) as RentalOffer[];
    const offer = existing.find((o) => o.id === id);
    if (offer) {
      const nextDeleted = [offer, ...deletedOffers];
      setDeletedOffers(nextDeleted);
      updateData({ deletedRentalOffers: nextDeleted } as any);
    }
    const next = existing.filter((o) => o.id !== id);
    updateData({ rentalOffers: next } as any);
    updateData({ orders: data.orders.filter((o) => o.id !== `rental-order-${id}`) });
    if (editingOfferId === id) cancelEdit();
  }

  function restoreOffer(id: string) {
    const offer = deletedOffers.find((o) => o.id === id);
    if (!offer) return;
    const nextDeleted = deletedOffers.filter((o) => o.id !== id);
    setDeletedOffers(nextDeleted);
    updateData({ deletedRentalOffers: nextDeleted } as any);
    const existing = ((data as any).rentalOffers || []) as RentalOffer[];
    updateData({ rentalOffers: [offer, ...existing] } as any);
  }

  function permanentDeleteOffer(id: string) {
    if (!confirm("Slette permanent?")) return;
    const nextDeleted = deletedOffers.filter((o) => o.id !== id);
    setDeletedOffers(nextDeleted);
    updateData({ deletedRentalOffers: nextDeleted } as any);
  }

  function printOffer() {
    const venueName = rental.venueExternal ? (rental.venueExternalName || "Eksternt lokale") : rental.venue;
    const productRows = rental.productLines.map((l) => {
      const p = data.products.find((x) => x.id === l.productId);
      if (!p) return "";
      const lineTotal = p.customerPrice * l.guests;
      return `<tr><td>${escapeHtml(p.name)}</td><td style="text-align:right">${l.guests}</td><td style="text-align:right">${currency(p.customerPrice)}</td><td style="text-align:right"><b>${currency(lineTotal)}</b></td></tr>`;
    }).join("");
    const addonRows = addonLines.map((line) =>
      `<tr><td>${escapeHtml(line.text)}${line.quantity ? ` × ${line.quantity}` : ""}</td><td></td><td style="text-align:right">${line.quantity ? currency(line.unitPrice || 0) : ""}</td><td style="text-align:right"><b>${currency(line.amount)}</b></td></tr>`
    ).join("");
    const waiterRow = (rental.waiterHours > 0 || waiterAfterMidnightHours > 0) ? `
      <tr><td>Servitører (${rental.waiters} pers)<br><small style="color:#64748b">
        ${rental.waiterHours > 0 ? `${rental.waiterHours}t × ${currency(data.settings.waiterHourlyRate)}/t` : ""}
        ${rental.waiterHours > 0 && waiterAfterMidnightHours > 0 ? " + " : ""}
        ${waiterAfterMidnightHours > 0 ? `${waiterAfterMidnightHours}t etter midnatt × ${currency(data.settings.waiterAfterMidnightHourlyRate)}/t` : ""}
      </small></td><td></td><td></td><td style="text-align:right"><b>${currency(waiterCost)}</b></td></tr>
    ` : "";
    const venueRow = rental.venuePrice > 0
      ? `<tr><td>Leie av ${escapeHtml(venueName)}</td><td></td><td></td><td style="text-align:right"><b>${currency(rental.venuePrice)}</b></td></tr>`
      : "";
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"/><title>Tilbud – ${escapeHtml(rental.customer)}</title><style>
@page{size:A4;margin:14mm;margin-top:14mm}html{-webkit-print-color-adjust:exact}
body{font-family:Arial,sans-serif;color:#111827;padding:32px;line-height:1.5}
.header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #111827;padding-bottom:16px;margin-bottom:24px}
.logo{height:90px;width:auto;object-fit:contain}
.header-right{text-align:right;font-size:13px;color:#374151}
h2{font-size:16px;margin:20px 0 8px;border-bottom:1px solid #e5e7eb;padding-bottom:4px}
table{width:100%;border-collapse:collapse;margin-top:8px;font-size:13px}
th{background:#f3f4f6;text-align:left;padding:8px;border-bottom:2px solid #e5e7eb}
td{padding:8px;border-bottom:1px solid #f1f5f9;vertical-align:top}
.total-row{font-size:17px;font-weight:900;background:#f8fafc}
.total-row td{padding:12px 8px}
.info-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin-bottom:16px;font-size:13px}
.info-box p{margin:4px 0}
.included{font-size:12px;color:#64748b;margin-top:16px;border-top:1px solid #e2e8f0;padding-top:12px}
.disclaimer{font-size:10px;color:#94a3b8;margin-top:8px;text-align:center}
.footer{margin-top:32px;text-align:center;font-size:11px;color:#64748b;border-top:1px solid #e2e8f0;padding-top:14px}
@media print{button{display:none}body{padding:0}.page-break{page-break-before:always}}*{-webkit-print-color-adjust:exact}</style></head><body>
<button onclick="window.print()">Skriv ut / Lagre som PDF</button>
<div class="header">
  <img src="/logo.png" class="logo" />
  <div class="header-right">
    <b style="font-size:16px">TILBUD</b><br>
    ${rental.date ? `<span>Dato for arrangement: ${formatDateNo(rental.date)}</span><br>` : ""}
    <span>Utstedt: ${formatDateNo(new Date().toISOString().slice(0, 10))}</span>
  </div>
</div>
<div class="info-box">
  <p><b>Kunde:</b> ${escapeHtml(rental.customer)}</p>
  <p><b>Lokale:</b> ${escapeHtml(venueName)}</p>
  ${rental.date ? `<p><b>Dato:</b> ${formatDateNo(rental.date)}</p>` : ""}
  ${rental.note ? `<p><b>Merknad:</b></p><p style="white-space:pre-wrap;line-height:1.6">${escapeHtml(rental.note.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim())}</p>` : ""}
</div>
<div class="page-break"></div><h2>Spesifikasjon</h2>
<table>
  <thead><tr><th>Beskrivelse</th><th style="text-align:right">Antall</th><th style="text-align:right">Pris/pers</th><th style="text-align:right">Sum</th></tr></thead>
  <tbody>${venueRow}${productRows}${waiterRow}${addonRows}</tbody>
  <tfoot><tr class="total-row"><td colspan="3">Total inkl. mva</td><td style="text-align:right">${currency(total)}</td></tr></tfoot>
</table>
${showIncluded ? `<p class="included">${escapeHtml(includedText)}</p>` : ""}
<p class="disclaimer">Skrivefeil kan forekomme.</p>
${showTerms ? `<div class="page-break"></div>
<h2 style="border-bottom:2px solid #111827;padding-bottom:8px;margin-bottom:16px">Vilkår for leie av Bodøgaard</h2>
<p style="white-space:pre-wrap;font-size:13px;line-height:1.7;color:#374151">${escapeHtml(termsText)}</p>` : ""}
<div class="footer">Brødrene Berbusmel &nbsp;|&nbsp; tlf 413 73 000 &nbsp;|&nbsp; brodrene@berbusmel.no</div>
</body></html>`);
    w.document.close();
    w.focus();
  }

  const filteredProducts = data.products.filter((p) =>
    productSearch === "" || p.name.toLowerCase().includes(productSearch.toLowerCase())
  ).slice(0, 10);

  const offers = (((data as any).rentalOffers || []) as RentalOffer[])
    .filter((o) => offerSearch === "" ||
      o.customer.toLowerCase().includes(offerSearch.toLowerCase()) ||
      (o.venue || "").toLowerCase().includes(offerSearch.toLowerCase()) ||
      (o.venueExternalName || "").toLowerCase().includes(offerSearch.toLowerCase())
    )
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  return (
    <section>
      <div className="card">
        <div className="between">
          <h2>Leie av lokale</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <button className={showTrash ? "btn active" : "btn"} onClick={() => setShowTrash(!showTrash)}>
              🗑 Papirkurv {deletedOffers.length > 0 && `(${deletedOffers.length})`}
            </button>
            <button className="btn active" onClick={() => { cancelEdit(); setShowNewOffer(true); }}>Nytt tilbud</button>
          </div>
        </div>
      </div>

      {showTrash && (
        <div className="card">
          <h3>🗑 Papirkurv</h3>
          {deletedOffers.length === 0 && <p style={{ color: "#64748b" }}>Papirkurven er tom.</p>}
          {deletedOffers.map((offer) => (
            <div key={offer.id} className="editable-row">
              <div>
                <b>{offer.customer}</b>
                {offer.date && <span style={{ marginLeft: 10, color: "#64748b", fontSize: 13 }}>📅 {formatDateNo(offer.date)}</span>}
                <span style={{ marginLeft: 10, color: "#64748b", fontSize: 13 }}>{offer.venueExternal ? (offer.venueExternalName || "Eksternt") : offer.venue}</span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn" onClick={() => restoreOffer(offer.id!)}>Gjenopprett</button>
                <button className="btn danger" onClick={() => permanentDeleteOffer(offer.id!)}>Slett permanent</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showNewOffer && (
        <div className="grid two">
          <div className="card">
            <div className="between">
              <h2>{editingOfferId ? "Rediger tilbud" : "Nytt tilbud"}</h2>
              <button className="btn" onClick={cancelEdit}>Avbryt</button>
            </div>

            {editingOfferId && (
              <div style={{ background: "#fef9c3", border: "1px solid #fbbf24", borderRadius: 10, padding: "10px 14px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 700 }}>✏️ Redigerer: {rental.customer}</span>
              </div>
            )}

            <div className="form-grid two">
              <label>Kunde<input value={rental.customer} onChange={(e) => setRental({ ...rental, customer: e.target.value })} placeholder="Kundenavn" /></label>
              <label>Dato for arrangement<input type="date" value={rental.date || ""} onChange={(e) => setRental({ ...rental, date: e.target.value })} /></label>
            </div>

            <label>Lokale
              <select value={rental.venueExternal ? "__extern__" : rental.venue} onChange={(e) => {
                if (e.target.value === "__extern__") {
                  setRental({ ...rental, venueExternal: true, venue: "", venuePrice: 0 });
                } else {
                  const v = data.venues.find((x) => x.name === e.target.value)!;
                  setRental({ ...rental, venueExternal: false, venueExternalName: "", venue: v.name, venuePrice: v.price });
                }
              }}>
                {data.venues.map((v) => <option key={v.id} value={v.name}>{v.name}</option>)}
                <option value="__extern__">Eksternt lokale</option>
              </select>
            </label>

            {rental.venueExternal ? (
              <div className="form-grid two">
                <label>Navn på eksternt lokale<input value={rental.venueExternalName || ""} onChange={(e) => setRental({ ...rental, venueExternalName: e.target.value })} placeholder="F.eks. Svømmehallen" /></label>
                <label>Pris (0 hvis kunden leier selv)<input type="number" value={rental.venuePrice} onChange={(e) => setRental({ ...rental, venuePrice: Number(e.target.value) || 0 })} /></label>
              </div>
            ) : (
              <label>Lokaleleie<input type="number" value={rental.venuePrice} onChange={(e) => setRental({ ...rental, venuePrice: Number(e.target.value) })} /></label>
            )}

            <h3>Produkter/menyer</h3>
            <div className="soft-box">
              <input value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="Søk produkt eller meny..." style={{ marginBottom: 8 }} />
              {productSearch && (
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden", marginBottom: 10 }}>
                  {filteredProducts.length === 0 && <p style={{ padding: 10, color: "#64748b" }}>Ingen treff</p>}
                  {filteredProducts.map((p) => (
                    <button key={p.id} style={{ width: "100%", textAlign: "left", padding: "8px 12px", border: 0, borderBottom: "1px solid #f1f5f9", background: "white", cursor: "pointer" }}
                      onClick={() => { setRental({ ...rental, productLines: [...rental.productLines, { productId: p.id, guests: 1 }] }); setProductSearch(""); }}>
                      <b>{p.name}</b> <span style={{ color: "#64748b", fontSize: 13 }}>· {currency(p.customerPrice)}/pers</span>
                    </button>
                  ))}
                </div>
              )}
              {rental.productLines.map((l, i) => {
                const p = data.products.find((x) => x.id === l.productId);
                return (
                  <div key={i} className="form-grid three" style={{ alignItems: "end" }}>
                    <label>Produkt<input value={p?.name || ""} readOnly style={{ background: "#f8fafc" }} /></label>
                    <label>Antall gjester/porsjoner<input type="number" value={l.guests} onChange={(e) => setRental({ ...rental, productLines: rental.productLines.map((x, ix) => ix === i ? { ...x, guests: Number(e.target.value) } : x) })} /></label>
                    <button className="link danger" onClick={() => setRental({ ...rental, productLines: rental.productLines.filter((_, ix) => ix !== i) })}>Slett</button>
                  </div>
                );
              })}
            </div>

            <h3>Servitører</h3>
            <div className="form-grid three">
              <label>Antall servitører<input type="number" value={rental.waiters} onChange={(e) => setRental({ ...rental, waiters: Number(e.target.value) })} /></label>
              <label>Timer før midnatt<input type="number" value={rental.waiterHours} onChange={(e) => setRental({ ...rental, waiterHours: Number(e.target.value) })} /></label>
              <label>Timer etter midnatt<input type="number" value={rental.waiterAfterMidnightHours} onChange={(e) => setRental({ ...rental, waiterAfterMidnightHours: Number(e.target.value) })} /></label>
            </div>

            <h3>Tillegg</h3>
            <div className="soft-box">
              {data.rentalAddons.map((addon) => {
                const selected = isAddonSelected(addon);
                const line = addonLines.find((x) => x.text === addon.name);
                const usesQty = addonUsesQuantity(addon.name);
                return (
                  <div key={addon.id} className="editable-row">
                    <label className="check">
                      <input type="checkbox" checked={selected} onChange={() => toggleAddon(addon)} />
                      {addon.name} · {currency(addon.price)}{usesQty ? " per stk/person" : " (fast beløp)"}
                    </label>
                    {selected && usesQty && (
                      <label>Antall
                        <input type="number" value={line?.quantity || 1} onChange={(e) => updateAddonQuantity(addon.name, Number(e.target.value) || 0)} />
                      </label>
                    )}
                    {selected && !usesQty && (
                      <label>Beløp
                        <input type="number" value={line?.amount || 0} onChange={(e) => updateAddonAmount(addon.name, Number(e.target.value) || 0)} />
                      </label>
                    )}
                    {selected && usesQty && <b>{currency(line?.amount || 0)}</b>}
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 12 }}>
              <label style={{ fontWeight: 800, fontSize: 14, display: "block", marginBottom: 6 }}>Notater / merknader</label>
              <textarea
                className="textarea"
                value={rental.note || ""}
                onChange={(e) => setRental({ ...rental, note: e.target.value })}
                placeholder="Spesielle ønsker, allergier, praktisk info osv."
              />
            </div>
          </div>

          <div className="card">
            <h2>Tilbud</h2>
            <div className="soft-box">
              <label className="check">
                <input type="checkbox" checked={showIncluded} onChange={(e) => setShowIncluded(e.target.checked)} />
                Vis "Prisen inkluderer" i tilbud
              </label>
              {showIncluded && <p style={{ marginTop: 8, color: "#64748b", fontSize: 13 }}>{includedText}</p>}
              <label className="check" style={{ marginTop: 8 }}>
                <input type="checkbox" checked={showTerms} onChange={(e) => setShowTerms(e.target.checked)} />
                Vilkår for leie Bodøgaard
              </label>
            </div>
            {rental.venuePrice > 0 && <p>Leie {rental.venueExternal ? (rental.venueExternalName || "Eksternt lokale") : rental.venue}: <b>{currency(rental.venuePrice)}</b></p>}
            <p>Mat/produkter: <b>{currency(food)}</b></p>
            <p>Servitører: <b>{currency(waiterCost)}</b></p>
            <p>Tillegg: <b>{currency(addonTotal)}</b></p>
            {addonLines.length > 0 && (
              <table>
                <thead><tr><th>Tillegg</th><th>Antall</th><th>Pris</th></tr></thead>
                <tbody>{addonLines.map((line, i) => <tr key={i}><td>{line.text}</td><td>{line.quantity || "-"}</td><td>{currency(line.amount)}</td></tr>)}</tbody>
              </table>
            )}
            <h2 style={{ marginTop: 16 }}>Total: {currency(total)}</h2>
            <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
              <button className="btn active" onClick={saveOffer}>
                {editingOfferId ? "Lagre endringer" : "Lagre tilbud"}{rental.date ? " og legg i kalender" : ""}
              </button>
              <button className="btn" onClick={printOffer}>Last ned / print tilbud</button>
              <button className="btn" onClick={cancelEdit}>Avbryt</button>
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: 18 }}>
        <div className="between" style={{ marginBottom: 12 }}>
          <h2>Lagrede tilbud</h2>
          <input
            value={offerSearch}
            onChange={(e) => setOfferSearch(e.target.value)}
            placeholder="Søk på kunde eller lokale..."
            style={{ maxWidth: 260 }}
          />
        </div>
        {offers.length === 0 && <p style={{ color: "#64748b" }}>Ingen tilbud funnet.</p>}
        {offers.map((offer) => {
          const offerWaiterCost = (offer.waiterHours || 0) * data.settings.waiterHourlyRate + (offer.waiterAfterMidnightHours || 0) * data.settings.waiterAfterMidnightHourlyRate;
          const offerTotal = offer.venuePrice
            + offer.productLines.reduce((sum, l) => sum + (data.products.find((p) => p.id === l.productId)?.customerPrice || 0) * l.guests, 0)
            + offerWaiterCost
            + (offer.extraLines || []).reduce((sum, l) => sum + Number(l.amount || 0), 0);
          const isEditing = editingOfferId === offer.id;
          return (
            <div key={offer.id} className="editable-row" style={{ background: isEditing ? "#fef9c3" : undefined, borderRadius: isEditing ? 10 : undefined, padding: isEditing ? "8px 12px" : undefined }}>
              <div>
                <b>{offer.customer}</b>
                {isEditing && <span style={{ marginLeft: 8, fontSize: 12, background: "#fbbf24", color: "white", borderRadius: 6, padding: "2px 8px" }}>Redigeres nå</span>}
                {offer.date && <span style={{ marginLeft: 10, color: "#64748b", fontSize: 13 }}>📅 {formatDateNo(offer.date)}</span>}
                <span style={{ marginLeft: 10, color: "#64748b", fontSize: 13 }}>{offer.venueExternal ? (offer.venueExternalName || "Eksternt") : offer.venue}</span>
                <br />
                <small style={{ color: "#64748b" }}>Total: {currency(offerTotal)}</small>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {!isEditing && <button className="btn" onClick={() => loadOffer(offer)}>Rediger</button>}
                <button className="btn danger" onClick={() => deleteOffer(offer.id!)}>Slett</button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

const SettingsTab = React.memo(function SettingsTab({
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
const [newRentalAddon, setNewRentalAddon] = useState({ name: "", price: "0", perUnit: false });

  const [localSettings, setLocalSettings] = useState(data.settings);
  const [localVenues, setLocalVenues] = useState(data.venues);
  const [localPackaging, setLocalPackaging] = useState(data.packaging);
  const [localRentalAddons, setLocalRentalAddons] = useState(data.rentalAddons);

  const Section = ({ id, title, children }: { id: string; title: string; children: React.ReactNode }) =>
    <div className="settings-section">
      <button className="settings-toggle" onClick={() => setOpen(open === id ? "" : id)}>
        {title}<span>{open === id ? "−" : "+"}</span>
      </button>
      {open === id && <div className="settings-content">{children}</div>}
    </div>;

  return (
    <section className="card">
      <h2>Innstillinger</h2>

      <Section id="personell" title="Personell">
        <div className="form-grid">
          <label>MVA mat<input type="number" value={localSettings.foodVat}
            onChange={(e) => setLocalSettings({ ...localSettings, foodVat: Number(e.target.value) })}
            onBlur={() => updateData({ settings: localSettings })} /></label>
          <label>MVA alkohol<input type="number" value={localSettings.alcoholVat ?? 25}
            onChange={(e) => setLocalSettings({ ...localSettings, alcoholVat: Number(e.target.value) })}
            onBlur={() => updateData({ settings: localSettings })} /></label>
          <label>Kostnad kokker/time<input type="number" value={localSettings.chefHourlyRate}
            onChange={(e) => setLocalSettings({ ...localSettings, chefHourlyRate: Number(e.target.value) })}
            onBlur={() => updateData({ settings: localSettings })} /></label>
          <label>Grunntid kokker/min<input type="number" value={localSettings.chefBaseMinutes}
            onChange={(e) => setLocalSettings({ ...localSettings, chefBaseMinutes: Number(e.target.value) })}
            onBlur={() => updateData({ settings: localSettings })} /></label>
          <label>Tillegg min pr 10 pers<input type="number" value={localSettings.chefExtraMinutesPer10}
            onChange={(e) => setLocalSettings({ ...localSettings, chefExtraMinutesPer10: Number(e.target.value) })}
            onBlur={() => updateData({ settings: localSettings })} /></label>
          <label>2 kokker over antall<input type="number" value={localSettings.twoChefsOverGuestCount}
            onChange={(e) => setLocalSettings({ ...localSettings, twoChefsOverGuestCount: Number(e.target.value) })}
            onBlur={() => updateData({ settings: localSettings })} /></label>
          <label>Servitør/time<input type="number" value={localSettings.waiterHourlyRate}
            onChange={(e) => setLocalSettings({ ...localSettings, waiterHourlyRate: Number(e.target.value) })}
            onBlur={() => updateData({ settings: localSettings })} /></label>
          <label>Servitør etter midnatt<input type="number" value={localSettings.waiterAfterMidnightHourlyRate}
            onChange={(e) => setLocalSettings({ ...localSettings, waiterAfterMidnightHourlyRate: Number(e.target.value) })}
            onBlur={() => updateData({ settings: localSettings })} /></label>
        </div>
      </Section>

      <Section id="retailMargins" title="Standard marginer for videresalg">
        <div className="form-grid">
          {["Deli", "Mineralvann", "Øl", "Vin", "Brennevin", "Cider"].map((cat) => (
            <label key={cat}>{cat}
              <input
                type="number"
                value={localSettings.retailMargins?.[cat] ?? 50}
                onChange={(e) => setLocalSettings({
                  ...localSettings,
                  retailMargins: { ...(localSettings.retailMargins || {}), [cat]: Number(e.target.value) }
                })}
                onBlur={() => updateData({ settings: localSettings })}
              />
            </label>
          ))}
        </div>
      </Section>

      <Section id="venues" title="Leie av lokaler, priser">
        <div>
          {localVenues.map((v, i) => (
            <div key={v.id} className="editable-row">
              <input
                value={v.name}
                onChange={(e) => setLocalVenues(localVenues.map((x, ix) => ix === i ? { ...x, name: e.target.value } : x))}
                onBlur={() => updateData({ venues: localVenues })}
              />
              <input
                type="number"
                value={v.price}
                onChange={(e) => setLocalVenues(localVenues.map((x, ix) => ix === i ? { ...x, price: Number(e.target.value) || 0 } : x))}
                onBlur={() => updateData({ venues: localVenues })}
              />
              <button className="link danger" onClick={() => {
                const next = localVenues.filter((x) => x.id !== v.id);
                setLocalVenues(next);
                updateData({ venues: next });
              }}>Slett</button>
            </div>
          ))}
        </div>
        <div className="form-grid three">
          <input placeholder="Nytt lokale" value={newVenue.name} onChange={(e) => setNewVenue({ ...newVenue, name: e.target.value })} />
          <input type="number" placeholder="Pris" value={newVenue.price} onChange={(e) => setNewVenue({ ...newVenue, price: e.target.value })} />
          <button className="btn active" onClick={() => {
            if (!newVenue.name.trim()) return;
            const next = [...localVenues, { id: `${idFromName(newVenue.name)}-${Date.now()}`, name: newVenue.name.trim(), price: Number(newVenue.price) || 0 }];
            setLocalVenues(next);
            updateData({ venues: next });
            setNewVenue({ name: "", price: "0" });
          }}>Legg til</button>
        </div>
      </Section>

      <Section id="rentalAddons" title="Leie av lokale, tillegg">
        <div>
          {localRentalAddons.map((addon, i) => (
            <div key={addon.id} className="editable-row">
              <input
                value={addon.name}
                onChange={(e) => setLocalRentalAddons(localRentalAddons.map((x, ix) => ix === i ? { ...x, name: e.target.value } : x))}
                onBlur={() => updateData({ rentalAddons: localRentalAddons })}
              />
              <input
                type="number"
                value={addon.price}
                onChange={(e) => setLocalRentalAddons(localRentalAddons.map((x, ix) => ix === i ? { ...x, price: Number(e.target.value) || 0 } : x))}
                onBlur={() => updateData({ rentalAddons: localRentalAddons })}
              />
              <label className="check" style={{ whiteSpace: "nowrap" }}>
  <input
    type="checkbox"
    checked={!!addon.perUnit}
    onChange={(e) => {
      const next = localRentalAddons.map((x, ix) => ix === i ? { ...x, perUnit: e.target.checked } : x);
      setLocalRentalAddons(next);
      updateData({ rentalAddons: next });
    }}
  />
  pr stk
</label>
              <button className="link danger" onClick={() => {
                const next = localRentalAddons.filter((x) => x.id !== addon.id);
                setLocalRentalAddons(next);
                updateData({ rentalAddons: next });
              }}>Slett</button>
            </div>
          ))}
        </div>
        <div className="form-grid four">
  <input placeholder="Nytt tillegg" value={newRentalAddon.name} onChange={(e) => setNewRentalAddon({ ...newRentalAddon, name: e.target.value })} />
  <input type="number" placeholder="Pris" value={newRentalAddon.price} onChange={(e) => setNewRentalAddon({ ...newRentalAddon, price: e.target.value })} />
  <label className="check">
    <input type="checkbox" checked={newRentalAddon.perUnit} onChange={(e) => setNewRentalAddon({ ...newRentalAddon, perUnit: e.target.checked })} />
    pr stk
  </label>
  <button className="btn active" onClick={() => {
    if (!newRentalAddon.name.trim()) return;
    const next = [...localRentalAddons, { id: `${idFromName(newRentalAddon.name)}-${Date.now()}`, name: newRentalAddon.name.trim(), price: Number(newRentalAddon.price) || 0, perUnit: newRentalAddon.perUnit }];
    setLocalRentalAddons(next);
    updateData({ rentalAddons: next });
    setNewRentalAddon({ name: "", price: "0", perUnit: false });
  }}>Legg til</button>
</div>
      </Section>

      <Section id="materialCats" title="Kategorier for råvarer">
        <CategoryEditor
          values={data.materialCategories}
          newValue={newMaterialCategory}
          setNewValue={setNewMaterialCategory}
          onSave={(next) => updateData({ materialCategories: next })}
        />
      </Section>

      <Section id="productCats" title="Kategorier for produkter/menyer">
        <h3>Produktkategorier</h3>
        <CategoryEditor
          values={data.productCategories}
          newValue={newProductCategory}
          setNewValue={setNewProductCategory}
          onSave={(next) => updateData({ productCategories: next })}
        />
        <h3>Menykategorier</h3>
        <CategoryEditor
          values={data.menuCategories}
          newValue={newMenuCategory}
          setNewValue={setNewMenuCategory}
          onSave={(next) => updateData({ menuCategories: next })}
        />
      </Section>

      <Section id="packaging" title="Priser på emballasje">
        <div>
          {localPackaging.map((p, i) => (
            <div key={p.id} className="editable-row">
              <input
                value={p.name}
                onChange={(e) => setLocalPackaging(localPackaging.map((x, ix) => ix === i ? { ...x, name: e.target.value } : x))}
                onBlur={() => updateData({ packaging: localPackaging })}
              />
              <input
                type="number"
                value={p.price}
                onChange={(e) => setLocalPackaging(localPackaging.map((x, ix) => ix === i ? { ...x, price: Number(e.target.value) || 0 } : x))}
                onBlur={() => updateData({ packaging: localPackaging })}
              />
              <button className="link danger" onClick={() => {
                const next = localPackaging.filter((x) => x.id !== p.id);
                setLocalPackaging(next);
                updateData({ packaging: next });
              }}>Slett</button>
            </div>
          ))}
        </div>
        <div className="form-grid three">
          <input placeholder="Ny emballasje" value={newPackaging.name} onChange={(e) => setNewPackaging({ ...newPackaging, name: e.target.value })} />
          <input type="number" placeholder="Pris" value={newPackaging.price} onChange={(e) => setNewPackaging({ ...newPackaging, price: e.target.value })} />
          <button className="btn active" onClick={() => {
            if (!newPackaging.name.trim()) return;
            const next = [...localPackaging, { id: `${idFromName(newPackaging.name)}-${Date.now()}`, name: newPackaging.name.trim(), price: Number(newPackaging.price) || 0 }];
            setLocalPackaging(next);
            updateData({ packaging: next });
            setNewPackaging({ name: "", price: "0" });
          }}>Legg til</button>
        </div>
      </Section>

      <h3>Database</h3>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button className="btn active" onClick={exportData}>Eksporter database</button>
        <label className="btn">
          Importer database
          <input type="file" accept="application/json" hidden onChange={(e) => importData(e.target.files?.[0] || null)} />
        </label>
      </div>
      <p style={{ fontSize: 12, color: "#64748b" }}>Tips: Ta backup før du importerer ny fil.</p>
    </section>
  );
});

function CategoryEditor({ values, newValue, setNewValue, onSave }: { values: string[]; newValue: string; setNewValue: (v: string) => void; onSave: (next: string[]) => void }) {
  const [localValues, setLocalValues] = useState(values);

  return (
    <>
      <div>
        {localValues.map((v, i) => (
          <div key={`${v}-${i}`} className="editable-row">
            <input
              value={v}
              onChange={(e) => setLocalValues(localValues.map((x, ix) => ix === i ? e.target.value : x))}
              onBlur={() => onSave(localValues)}
            />
            <button className="link danger" onClick={() => {
              const next = localValues.filter((_, ix) => ix !== i);
              setLocalValues(next);
              onSave(next);
            }}>Slett</button>
          </div>
        ))}
      </div>
      <div className="form-grid three">
        <input value={newValue} onChange={(e) => setNewValue(e.target.value)} placeholder="Ny kategori" />
        <button className="btn active" onClick={() => {
          if (!newValue.trim()) return;
          const next = [...localValues, newValue.trim()];
          setLocalValues(next);
          onSave(next);
          setNewValue("");
        }}>Legg til</button>
      </div>
    </>
  );
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
    table.compact-lines td, table.compact-lines th { padding: 5px 7px; }
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
        .highlight-input {
  background: #fef9c3;
  border-color: #facc15;
}
    }
@media (max-width: 768px) {
  main {
    padding: 10px !important;
  }

  .card {
    padding: 14px !important;
    border-radius: 14px !important;
  }

  nav {
    overflow-x: auto;
    flex-wrap: nowrap !important;
    padding-bottom: 6px;
  }

  nav .btn {
    white-space: nowrap;
    flex: 0 0 auto;
  }

  .form-grid,
  .form-grid.three,
  .form-grid.four,
  .form-grid.five,
  .grid.two,
  .metric-row,
  .metric-row.three-metrics {
    grid-template-columns: 1fr !important;
  }

  table {
    display: block;
    overflow-x: auto;
    white-space: nowrap;
    font-size: 13px;
  }

  th,
  td {
    padding: 7px !important;
  }

  input,
  select,
  textarea,
  button {
    font-size: 16px !important;
  }

  .between {
    flex-direction: column;
    align-items: stretch !important;
    gap: 10px;
  }

  footer img {
    width: 100px !important;
  }
}
  `}</style>
  );
}

