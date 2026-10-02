import { useRef, useState } from "react";
import "@geoapify/geocoder-autocomplete/styles/minimal.css";
import {
  GeoapifyContext,
  GeoapifyGeocoderAutocomplete,
} from "@geoapify/react-geocoder-autocomplete";
import { useLanguage } from "@/lib/i18n";

interface AddressAutocompleteProps {
  /** Chiamato quando l'utente sceglie un suggerimento (feature GeoJSON di Geoapify). */
  onPlaceSelect: (feature: any) => void;
  /** Chiamato quando l'utente modifica o svuota il testo: la selezione precedente non è più valida. */
  onClear?: () => void;
}

const GEO_LANGS = ["it", "en", "es", "fr", "de", "pt"] as const;

export default function AddressAutocomplete({ onPlaceSelect, onClear }: AddressAutocompleteProps) {
  const { language, t } = useLanguage();
  const [status, setStatus] = useState<"idle" | "empty" | "error">("idle");
  // Dopo la scelta di un suggerimento il widget emette eventi di input/clear
  // "tecnici": vanno ignorati, altrimenti azzerano le coordinate appena scelte.
  const selected = useRef<{ text: string; at: number } | null>(null);
  const justSelected = (input?: string) => {
    const sel = selected.current;
    if (!sel) return false;
    return Date.now() - sel.at < 800 || (input !== undefined && input === sel.text);
  };
  const apiKey = import.meta.env.VITE_GEOAPIFY_API_KEY ?? import.meta.env.GEOAPIFY_API_KEY ?? "";

  if (!apiKey) {
    return (
      <p className="rounded-xl bg-[#f7ddd1] px-4 py-3 text-sm font-bold text-[#a74b32]">
        {t("address.noKey")}
      </p>
    );
  }

  const lang = (GEO_LANGS as readonly string[]).includes(language) ? (language as any) : "en";

  return (
    <div>
      <GeoapifyContext apiKey={apiKey}>
        <GeoapifyGeocoderAutocomplete
          // key: ricrea il widget quando cambia lingua, così placeholder e risultati si aggiornano
          key={lang}
          placeholder={t("address.placeholder")}
          lang={lang}
          filterByCountryCode={["it"]}
          limit={6}
          debounceDelay={250}
          skipIcons
          allowNonVerifiedHouseNumber
          allowNonVerifiedStreet
          placeSelect={(feature: any) => {
            if (!feature) return;
            selected.current = {
              text: feature.properties?.formatted ?? feature.properties?.address_line1 ?? "",
              at: Date.now(),
            };
            setStatus("idle");
            onPlaceSelect(feature);
          }}
          onUserInput={(input: string) => {
            if (justSelected(input)) return;
            selected.current = null;
            onClear?.();
            if (input.trim().length < 3) setStatus("idle");
          }}
          onClear={() => {
            if (justSelected()) return;
            selected.current = null;
            setStatus("idle");
            onClear?.();
          }}
          onRequestEnd={(success: boolean, data?: any) => {
            if (!success) setStatus("error");
            else if (!data?.features?.length) setStatus("empty");
            else setStatus("idle");
          }}
        />
      </GeoapifyContext>
      {status !== "idle" && (
        <p className="mt-2 text-xs font-bold text-[#82978e]">
          {status === "error" ? t("address.error") : t("address.noResults")}
        </p>
      )}
    </div>
  );
}
