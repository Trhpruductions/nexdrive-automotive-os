/**
 * Small RFC 4180 CSV parser (quotes, escaped quotes, CRLF) that runs in the
 * browser and on the server. Returns header names and row objects.
 */
export function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const src = text.replace(/^\uFEFF/, "");
  const records: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') { quoted = true; continue; }
    if (c === ",") { row.push(field); field = ""; continue; }
    if (c === "\r") continue;
    if (c === "\n") { row.push(field); records.push(row); row = []; field = ""; continue; }
    field += c;
  }
  if (field.length || row.length) { row.push(field); records.push(row); }
  const nonEmpty = records.filter((r) => r.some((v) => v.trim() !== ""));
  if (!nonEmpty.length) return { headers: [], rows: [] };
  const headers = nonEmpty[0].map((h, i) => (h.trim() || `column${i + 1}`));
  const rows = nonEmpty.slice(1).map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? "").trim()])));
  return { headers, rows };
}

export type ImportEntity = "customers" | "vehicles" | "parts";

export type FieldSpec = { key: string; label: string; required?: boolean; hint?: string; aliases: string[] };

/** Target fields per entity + the source-column names we auto-map from. */
export const IMPORT_FIELDS: Record<ImportEntity, FieldSpec[]> = {
  customers: [
    { key: "firstName", label: "First name", required: true, aliases: ["first name", "firstname", "first", "given name"] },
    { key: "lastName", label: "Last name", required: true, aliases: ["last name", "lastname", "last", "surname", "family name"] },
    { key: "fullName", label: "Full name (if one column)", hint: "Used when first/last are not mapped", aliases: ["name", "customer", "customer name", "full name", "contact"] },
    { key: "company", label: "Company", aliases: ["company", "business", "organization", "organisation"] },
    { key: "email", label: "Email", aliases: ["email", "e-mail", "email address"] },
    { key: "phone", label: "Phone", aliases: ["phone", "mobile", "cell", "telephone", "phone number", "primary phone"] },
    { key: "address", label: "Street address", aliases: ["address", "street", "address1", "address 1"] },
    { key: "city", label: "City", aliases: ["city", "town"] },
    { key: "state", label: "State", aliases: ["state", "province", "region"] },
    { key: "zip", label: "ZIP", aliases: ["zip", "zipcode", "zip code", "postal", "postal code", "postcode"] },
    { key: "notes", label: "Notes", aliases: ["notes", "note", "comments", "memo"] },
  ],
  vehicles: [
    { key: "ownerEmail", label: "Owner email", hint: "Owner is matched by email, then phone, then name", aliases: ["owner email", "customer email", "email"] },
    { key: "ownerPhone", label: "Owner phone", aliases: ["owner phone", "customer phone", "phone"] },
    { key: "ownerName", label: "Owner name", aliases: ["owner", "owner name", "customer", "customer name", "name"] },
    { key: "year", label: "Year", required: true, aliases: ["year", "model year", "yr"] },
    { key: "make", label: "Make", required: true, aliases: ["make", "manufacturer", "brand"] },
    { key: "model", label: "Model", required: true, aliases: ["model"] },
    { key: "trim", label: "Trim", aliases: ["trim", "submodel", "sub model", "series"] },
    { key: "color", label: "Color", aliases: ["color", "colour", "paint"] },
    { key: "vin", label: "VIN", aliases: ["vin", "vin number", "chassis"] },
    { key: "licensePlate", label: "License plate", aliases: ["plate", "license", "license plate", "licence plate", "tag", "registration"] },
    { key: "plateState", label: "Plate state", aliases: ["plate state", "state", "reg state"] },
    { key: "mileage", label: "Mileage", aliases: ["mileage", "miles", "odometer", "odo", "km"] },
    { key: "engine", label: "Engine", aliases: ["engine", "motor"] },
    { key: "transmission", label: "Transmission", aliases: ["transmission", "trans", "gearbox"] },
    { key: "notes", label: "Notes", aliases: ["notes", "note", "comments"] },
  ],
  parts: [
    { key: "sku", label: "SKU / part number", required: true, aliases: ["sku", "part number", "part #", "partnumber", "part no", "number", "code", "item"] },
    { key: "name", label: "Name", required: true, aliases: ["name", "description", "part name", "desc", "title"] },
    { key: "brand", label: "Brand", aliases: ["brand", "manufacturer", "make", "mfg"] },
    { key: "category", label: "Category", aliases: ["category", "group", "type", "class"] },
    { key: "location", label: "Bin / location", aliases: ["location", "bin", "shelf", "aisle"] },
    { key: "supplier", label: "Supplier", aliases: ["supplier", "vendor", "source"] },
    { key: "quantityOnHand", label: "Quantity on hand", aliases: ["qty", "quantity", "on hand", "onhand", "stock", "quantity on hand", "qoh"] },
    { key: "reorderPoint", label: "Reorder point", aliases: ["reorder", "reorder point", "min", "minimum", "min qty"] },
    { key: "cost", label: "Cost", aliases: ["cost", "unit cost", "our cost", "purchase price"] },
    { key: "price", label: "Sell price", aliases: ["price", "sell", "retail", "list", "sale price", "unit price"] },
  ],
};

/** Guess a source column for each target field by name. */
export function autoMap(entity: ImportEntity, headers: string[]): Record<string, string> {
  const norm = (s: string) => s.toLowerCase().replace(/[_\-.]+/g, " ").replace(/\s+/g, " ").trim();
  const out: Record<string, string> = {};
  const used = new Set<string>();
  for (const f of IMPORT_FIELDS[entity]) {
    const candidates = [f.key.toLowerCase(), norm(f.label), ...f.aliases.map(norm)];
    const hit = headers.find((h) => !used.has(h) && candidates.includes(norm(h)));
    if (hit) { out[f.key] = hit; used.add(hit); }
  }
  return out;
}
