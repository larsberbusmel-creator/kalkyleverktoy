import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

function escapeHtml(s: string) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c));
}
function num(n: number, decimals = 1) {
  return (Number(n) || 0).toLocaleString("no-NO", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

type NutritionTotals = {
  kcal: number; kj: number; protein: number; carbs: number; fat: number;
  saturatedFat: number; fiber: number; sugars: number; addedSugar: number; salt: number; totalAmount: number;
};
function emptyNutrition(): NutritionTotals {
  return { kcal: 0, kj: 0, protein: 0, carbs: 0, fat: 0, saturatedFat: 0, fiber: 0, sugars: 0, addedSugar: 0, salt: 0, totalAmount: 0 };
}
function mergeNutrition(target: NutritionTotals, source: NutritionTotals) {
  (Object.keys(target) as (keyof NutritionTotals)[]).forEach((key) => { target[key] += source[key]; });
}

export async function POST(req: Request) {
  try {
    const { pin, productId } = await req.json();
    if (!pin || !productId) {
      return NextResponse.json({ error: "Mangler felt" }, { status: 400 });
    }

    const { data: row, error } = await supabaseAdmin.from("app_data").select("data").eq("id", "main").single();
    if (error || !row) {
      return NextResponse.json({ error: "Kunne ikke hente data" }, { status: 500 });
    }

    const appData = row.data as any;
    const customer = (appData.storkjokkenCustomers || []).find((c: any) => c.pin === pin && c.active !== false);
    if (!customer) {
      return NextResponse.json({ error: "Feil PIN-kode" }, { status: 401 });
    }

    const product = (appData.products || []).find((p: any) => p.id === productId);
    if (!product || !product.storkjokkenPriceExVat) {
      return NextResponse.json({ error: "Fant ikke produktet" }, { status: 404 });
    }
    if (Array.isArray(customer.allowedProductIds) && customer.allowedProductIds.length > 0 && !customer.allowedProductIds.includes(productId)) {
      return NextResponse.json({ error: "Ingen tilgang til dette produktet" }, { status: 403 });
    }

    const materials = appData.materials || [];
    const recipes = appData.recipes || [];
    const products = appData.products || [];

    function addMaterialNutrition(total: NutritionTotals, material: any, amount: number, unit?: string) {
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

    function recipeNutrition(recipe: any, multiplier = 1, visited: string[] = []): NutritionTotals {
      const total = emptyNutrition();
      if (visited.includes(recipe.id)) return total;
      (recipe.lines || []).forEach((line: any) => {
        const amount = line.amount * multiplier;
        if (line.itemType === "material") {
          const material = materials.find((m: any) => m.id === line.itemId);
          if (material) addMaterialNutrition(total, material, amount);
        }
        if (line.itemType === "recipe") {
          const subRecipe = recipes.find((r: any) => r.id === line.itemId);
          if (subRecipe) {
            const subBase = subRecipe.lines.reduce((s: number, l: any) => s + Number(l.amount || 0), 0) || Number(subRecipe.yieldAmount || 1) || 1;
            mergeNutrition(total, recipeNutrition(subRecipe, amount / subBase, [...visited, recipe.id]));
          }
        }
      });
      return total;
    }

    function productNutrition(prod: any, multiplier = 1, visited: string[] = []): NutritionTotals {
      const total = emptyNutrition();
      if (visited.includes(prod.id)) return total;
      (prod.lines || []).forEach((line: any) => {
        const amount = line.amount * multiplier;
        if (line.itemType === "material") {
          const material = materials.find((m: any) => m.id === line.itemId);
          if (material) addMaterialNutrition(total, material, amount, line.unit);
        }
        if (line.itemType === "recipe") {
          const recipe = recipes.find((r: any) => r.id === line.itemId);
          if (recipe) {
            const recipeBase = recipe.lines.reduce((s: number, l: any) => s + Number(l.amount || 0), 0) || Number(recipe.yieldAmount || 1) || 1;
            mergeNutrition(total, recipeNutrition(recipe, amount / recipeBase));
          }
        }
        if (line.itemType === "product") {
          const subProduct = products.find((p: any) => p.id === line.itemId);
          if (subProduct) {
            const subBase = Number(subProduct.recipeYieldAmount || subProduct.yieldAmount || 1) || 1;
            mergeNutrition(total, productNutrition(subProduct, amount / subBase, [...visited, prod.id]));
          }
        }
      });
      return total;
    }

    function nutritionPer100(prod: any) {
      const total = productNutrition(prod);
      const divisor = total.totalAmount > 0 ? total.totalAmount / 100 : 1;
      return {
        kcal: total.kcal / divisor, kj: total.kj / divisor, protein: total.protein / divisor, carbs: total.carbs / divisor,
        fat: total.fat / divisor, saturatedFat: total.saturatedFat / divisor, fiber: total.fiber / divisor,
        sugars: total.sugars / divisor, addedSugar: total.addedSugar / divisor, salt: total.salt / divisor,
      };
    }

    function materialIngredientName(material: any) {
      if (material.ingredients && material.ingredients.length) return material.ingredients.join(", ");
      return material.name;
    }
    function addIngredient(map: Record<string, { name: string; amount: number }>, name: string, amount: number) {
      if (!name || !name.trim()) return;
      if (!map[name]) map[name] = { name, amount: 0 };
      map[name].amount += amount;
    }
    function recipeIngredientMap(recipe: any, multiplier = 1, map: Record<string, { name: string; amount: number }> = {}, visited: string[] = []) {
      if (visited.includes(recipe.id)) return map;
      (recipe.lines || []).forEach((line: any) => {
        const amount = Number(line.amount || 0) * multiplier;
        if (line.itemType === "material") {
          const material = materials.find((m: any) => m.id === line.itemId);
          if (material) addIngredient(map, materialIngredientName(material), amount);
        }
        if (line.itemType === "recipe") {
          const subRecipe = recipes.find((r: any) => r.id === line.itemId);
          if (subRecipe) recipeIngredientMap(subRecipe, amount, map, [...visited, recipe.id]);
        }
      });
      return map;
    }
    function productIngredientMap(prod: any, multiplier = 1, map: Record<string, { name: string; amount: number }> = {}, visited: string[] = []) {
      if (visited.includes(prod.id)) return map;
      (prod.lines || []).forEach((line: any) => {
        const amount = Number(line.amount || 0) * multiplier;
        if (line.itemType === "material") {
          const material = materials.find((m: any) => m.id === line.itemId);
          if (material) addIngredient(map, materialIngredientName(material), amount);
        }
        if (line.itemType === "recipe") {
          const recipe = recipes.find((r: any) => r.id === line.itemId);
          if (recipe) recipeIngredientMap(recipe, amount, map);
        }
        if (line.itemType === "product") {
          const subProduct = products.find((p: any) => p.id === line.itemId);
          if (subProduct) productIngredientMap(subProduct, amount, map, [...visited, prod.id]);
        }
      });
      return map;
    }
    function productIngredients(prod: any): string[] {
      return Object.values(productIngredientMap(prod)).sort((a, b) => b.amount - a.amount).map((x) => x.name);
    }

    function recipeAllergens(recipe: any, visited: string[] = []): string[] {
      if (visited.includes(recipe.id)) return [];
      return Array.from(new Set((recipe.lines || []).flatMap((line: any) => {
        if (line.itemType === "recipe") {
          const r = recipes.find((x: any) => x.id === line.itemId);
          return r ? recipeAllergens(r, [...visited, recipe.id]) : [];
        }
        return materials.find((m: any) => m.id === line.itemId)?.allergens || [];
      }))) as string[];
    }
    function productAllergens(prod: any, visited: string[] = []): string[] {
      if (visited.includes(prod.id)) return [];
      return Array.from(new Set((prod.lines || []).flatMap((line: any) => {
        if (line.itemType === "material") return materials.find((m: any) => m.id === line.itemId)?.allergens || [];
        if (line.itemType === "recipe") {
          const r = recipes.find((x: any) => x.id === line.itemId);
          return r ? recipeAllergens(r) : [];
        }
        const p = products.find((x: any) => x.id === line.itemId);
        return p ? productAllergens(p, [...visited, prod.id]) : [];
      }))) as string[];
    }

    type BreadScaleTotals = { totalFlour: number; wholegrainEquivalent: number };
    function addBreadScaleMaterial(totals: BreadScaleTotals, material: any, amount: number, unit?: string) {
      const type = material.breadScaleType || "none";
      if (type === "none") return;
      const amountInGrams = unit === "stk" || unit === "porsjoner" ? amount : amount * 1000;
      const flourPercent = Number(material.breadScaleFlourPercent ?? 100);
      const flourAmount = amountInGrams * (flourPercent / 100);
      if (flourAmount <= 0) return;
      totals.totalFlour += flourAmount;
      if (type === "wholegrain" || type === "wholegrain_or_grain") totals.wholegrainEquivalent += flourAmount;
      if (type === "wheat_bran") totals.wholegrainEquivalent += flourAmount * 4.5;
      if (type === "rye_bran") totals.wholegrainEquivalent += flourAmount * 4;
      if (type === "oat_bran") totals.wholegrainEquivalent += flourAmount * 2;
    }
    function recipeBreadScaleTotals(recipe: any, multiplier = 1, totals: BreadScaleTotals = { totalFlour: 0, wholegrainEquivalent: 0 }, visited: string[] = []) {
      if (visited.includes(recipe.id)) return totals;
      (recipe.lines || []).forEach((line: any) => {
        const amount = Number(line.amount || 0) * multiplier;
        if (line.itemType === "material") {
          const material = materials.find((m: any) => m.id === line.itemId);
          if (material) addBreadScaleMaterial(totals, material, amount);
        }
        if (line.itemType === "recipe") {
          const subRecipe = recipes.find((r: any) => r.id === line.itemId);
          if (subRecipe) recipeBreadScaleTotals(subRecipe, amount, totals, [...visited, recipe.id]);
        }
      });
      return totals;
    }
    function productBreadScaleTotals(prod: any, multiplier = 1, totals: BreadScaleTotals = { totalFlour: 0, wholegrainEquivalent: 0 }, visited: string[] = []) {
      if (visited.includes(prod.id)) return totals;
      (prod.lines || []).forEach((line: any) => {
        const amount = Number(line.amount || 0) * multiplier;
        if (line.itemType === "material") {
          const material = materials.find((m: any) => m.id === line.itemId);
          if (material) addBreadScaleMaterial(totals, material, amount, line.unit);
        }
        if (line.itemType === "recipe") {
          const recipe = recipes.find((r: any) => r.id === line.itemId);
          if (recipe) recipeBreadScaleTotals(recipe, amount, totals);
        }
        if (line.itemType === "product") {
          const subProduct = products.find((p: any) => p.id === line.itemId);
          if (subProduct) productBreadScaleTotals(subProduct, amount, totals, [...visited, prod.id]);
        }
      });
      return totals;
    }
    function calculateWholegrainPercent(prod: any) {
      const totals = productBreadScaleTotals(prod);
      if (!totals.totalFlour) return 0;
      return Math.min(100, (totals.wholegrainEquivalent / totals.totalFlour) * 100);
    }

    const n = nutritionPer100(product);
    const ingredients = productIngredients(product).join(", ") || "-";
    const allergens = productAllergens(product).join(", ") || "Ingen registrert";
    const wholegrainPercent = calculateWholegrainPercent(product);
    const showWholegrain = product.showWholegrainInDeclaration !== false;

    const html = `<!doctype html><html><head><meta charset="utf-8" /><title>Deklarasjon ${escapeHtml(product.name)}</title><style>
body{font-family:Arial,sans-serif;color:#111827;padding:32px}
.label{max-width:520px;border:2px solid #111827;padding:18px}
.logo-img{height:70px;width:auto;object-fit:contain;margin-bottom:10px}
h1{font-size:24px;margin:0 0 10px}
table{width:100%;border-collapse:collapse;margin-top:12px}
td,th{border-bottom:1px solid #d1d5db;padding:7px;text-align:left}
th{background:#f3f4f6}
@media print{button{display:none}body{padding:0}}
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
</body></html>`;

    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  } catch (e) {
    return NextResponse.json({ error: "Noe gikk galt" }, { status: 500 });
  }
}