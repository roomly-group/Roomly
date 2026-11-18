import { useRef, useState } from "react";
import "@geoapify/geocoder-autocomplete/styles/minimal.css";
import {
  GeoapifyContext,
  GeoapifyGeocoderAutocomplete,
} from "@geoapify/react-geocoder-autocomplete";
import type { SupportedLanguage } from "@geoapify/geocoder-autocomplete";
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

/**
 * The part of a Geoapify suggestion (GeoJSON feature) the listing forms read
 * (RMY-24: typed instead of `any`). Every field may be missing.
 */
export type AddressFeature = {
  properties?: {
    formatted?: string;
    address_line1?: string;
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    town?: string;
    village?: string;
    county?: string;
    postcode?: string;
    lat?: number;
    lon?: number;
  };
};

/** What Geoapify returns when a suggestion request ends (only the count is read). */
type SuggestionsResponse = { features?: unknown[] };

interface AddressAutocompleteProps {
  /** Chiamato quando l'utente sceglie un suggerimento (feature GeoJSON di Geoapify). */
  onPlaceSelect: (feature: AddressFeature) => void;
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
      <p className="rounded-xl bg-[#f7ddd1] px-4 py-3 text-sm font-bold text-[#a74b32]">
        {t("address.noKey")}
      </p>
    );
  }

  // Every app language (it, en, es, fr, de, pt) is also a Geoapify language.
  const lang: SupportedLanguage = (SUPPORTED_LANGUAGE_CODES as readonly string[]).includes(language)
    ? (language as SupportedLanguage)
    : "en";

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
          placeSelect={(feature: AddressFeature | null) => {
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
          onRequestEnd={(success: boolean, data?: SuggestionsResponse) => {
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
