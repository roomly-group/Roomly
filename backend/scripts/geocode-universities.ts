/**
 * Calcola latitudine/longitudine delle università che ne sono prive,
 * usando l'API di geocoding di Geoapify. Da lanciare una volta (e dopo ogni
 * nuova università inserita):
 *
 *   cd backend && npx tsx scripts/geocode-universities.ts
 *
 * Richiede GEOAPIFY_API_KEY, SUPABASE_URL e SUPABASE_SECRET_KEY nel .env del backend.
 */
import "dotenv/config";
import { supabaseAdmin } from "../src/lib/supabase-admin.js";

const apiKey = process.env.GEOAPIFY_API_KEY ?? process.env.VITE_GEOAPIFY_API_KEY;
if (!apiKey) throw new Error("Manca GEOAPIFY_API_KEY nel .env del backend");

const { data, error } = await supabaseAdmin
  .from("universita")
  .select("*")
  .or("latitudine.is.null,longitudine.is.null");
if (error) throw error;

for (const uni of data ?? []) {
  const text = [uni.nome, uni.citta].filter(Boolean).join(", ");
  const url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(text)}&filter=countrycode:it&limit=1&apiKey=${apiKey}`;
  const response = await fetch(url);
  const json: any = await response.json();
  const coords = json?.features?.[0]?.geometry?.coordinates as [number, number] | undefined;
  if (!coords) {
    console.warn(`✗ nessun risultato per "${text}"`);
    continue;
  }
  const [lon, lat] = coords;
  const { error: updateError } = await supabaseAdmin
    .from("universita")
    .update({ latitudine: lat, longitudine: lon })
    .eq("id", uni.id);
  console.log(updateError ? `✗ ${uni.nome}: ${updateError.message}` : `✓ ${uni.nome} → ${lat}, ${lon}`);
}
