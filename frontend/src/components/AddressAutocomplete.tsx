import { useRef, useState } from "react";
import "@geoapify/geocoder-autocomplete/styles/minimal.css";
import {
  GeoapifyContext,
  GeoapifyGeocoderAutocomplete,
} from "@geoapify/react-geocoder-autocomplete";
import { useLanguage } from "@/lib/i18n";
import { SUPPORTED_LANGUAGE_CODES } from "@workspace/api-zod";

// ===================== CONFIGURATION =====================

/** Delay after selecting a place during which widget-generated clears are ignored (ms). */
const SELECTED_PLACE_IGNORE_DELAY_MS = 800 as const;
/** Minimum input length before address-autocomplete state is treated as active (characters). */
const MIN_ADDRESS_QUERY_LENGTH_CHARS = 3 as const;
/** Maximum address suggestions requested from Geoapify (results). */
const ADDRESS_SUGGESTION_LIMIT = 6 as const;
/** Delay before Geoapify requests suggestions after typing stops (ms). */
const ADDRESS_AUTOCOMPLETE_DEBOUNCE_MS = 250 as const;

interface AddressAutocompleteProps {
  /** Chiamato quando l'utente sceglie un suggerimento (feature GeoJSON di Geoapify). */
  onPlaceSelect: (feature: any) => void;
  /** Chiamato quando l'utente modifica o svuota il testo: la selezione precedente non è più valida. */
  onClear?: () => void;
}

export default function AddressAutocomplete({ onPlaceSelect, onClear }: AddressAutocompleteProps) {
  const { language, t } = useLanguage();
  const [status, setStatus] = useState<"idle" | "empty" | "error">("idle");
  // Dopo la scelta di un suggerimento il widget emette eventi di input/clear
  // "tecnici": vanno ignorati, altrimenti azzerano le coordinate appena scelte.
  const selected = useRef<{ text: string; at: number } | null>(null);
  const justSelected = (input?: string) => {
    const sel = selected.current;
    if (!sel) return false;
    return Date.now() - sel.at < SELECTED_PLACE_IGNORE_DELAY_MS || (input !== undefined && input === sel.text);
  };
  const apiKey = import.meta.env.VITE_GEOAPIFY_API_KEY ?? import.meta.env.GEOAPIFY_API_KEY ?? "";

  if (!apiKey) {
    return (
      <p className="rounded-sheet bg-terracotta-mist px-4 py-3 text-sm font-bold text-terracotta" role="alert">
        {t("address.noKey")}
      </p>
    );
  }

  const lang = (SUPPORTED_LANGUAGE_CODES as readonly string[]).includes(language) ? (language as any) : "en";

  return (
    <div>
      <GeoapifyContext apiKey={apiKey}>
        <GeoapifyGeocoderAutocomplete
          // key: ricrea il widget quando cambia lingua, così placeholder e risultati si aggiornano
          key={lang}
          placeholder={t("address.placeholder")}
          lang={lang}
          filterByCountryCode={["it"]}
          limit={ADDRESS_SUGGESTION_LIMIT}
          debounceDelay={ADDRESS_AUTOCOMPLETE_DEBOUNCE_MS}
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
            if (input.trim().length < MIN_ADDRESS_QUERY_LENGTH_CHARS) setStatus("idle");
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
        <p className="mt-2 text-[13px] font-bold text-sage" role="status">
          {status === "error" ? t("address.error") : t("address.noResults")}
        </p>
      )}
    </div>
  );
}
