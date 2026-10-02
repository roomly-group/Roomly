"use client";
import "@geoapify/geocoder-autocomplete/styles/minimal.css";
import {
  GeoapifyContext,
  GeoapifyGeocoderAutocomplete,
} from "@geoapify/react-geocoder-autocomplete";

interface AddressAutocompleteProps {
  onPlaceSelect: (feature: any) => void;
}

export default function AddressAutocomplete({ onPlaceSelect }: AddressAutocompleteProps) {
  const apiKey = import.meta.env.VITE_GEOAPIFY_API_KEY ?? import.meta.env.GEOAPIFY_API_KEY ?? "";

  return (
    <GeoapifyContext apiKey={apiKey}>
      <GeoapifyGeocoderAutocomplete
        placeholder="Inserisci l'indirizzo dell'alloggio"
        limit={5}
        placeSelect={onPlaceSelect}
      />
    </GeoapifyContext>
  );
}