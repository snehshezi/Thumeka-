"use client";

import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { useEffect, useId, useRef, useState } from "react";

type AddressAutocompleteProps = {
  name: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
  "data-testid"?: string;
  /** Optional sibling input (same form) that gets the picked place's suburb. */
  suburbInputName?: string;
  /** Optional hidden input names that receive the picked place's coordinates. */
  coordsLatName?: string;
  coordsLngName?: string;
  /** Fires after a place is selected (used to trigger downstream effects like re-quoting). */
  onPlaceSelected?: (place: {
    address: string;
    lat: number;
    lng: number;
    suburb: string | null;
  }) => void;
  /** Fires on every keystroke — lets controlled parents mirror the typed value. */
  onValueChange?: (value: string) => void;
};

const SUBURB_PRIORITY = ["sublocality_level_1", "sublocality", "locality"];

function findSuburb(
  components: google.maps.GeocoderAddressComponent[] | undefined
): string | null {
  if (!components) {
    return null;
  }

  for (const type of SUBURB_PRIORITY) {
    const match = components.find((component) => component.types.includes(type));
    if (match?.long_name) {
      return match.long_name;
    }
  }

  return null;
}

/**
 * Address input with Google Places Autocomplete biased to South Africa.
 *
 * When NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is unset the component degrades to a
 * plain <input> with the same name/testid, so dev and CI stay functional and
 * the server-side geocoding fallback continues to work.
 */
export function AddressAutocomplete({
  name,
  defaultValue,
  placeholder,
  required,
  className = "input",
  "data-testid": testId,
  suburbInputName,
  coordsLatName,
  coordsLngName,
  onPlaceSelected,
  onValueChange
}: AddressAutocompleteProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const inputRef = useRef<HTMLInputElement>(null);
  const [coords, setCoords] = useState<{ lat: string; lng: string }>({
    lat: "",
    lng: ""
  });
  const componentId = useId();

  useEffect(() => {
    if (!apiKey || !inputRef.current) {
      return;
    }

    let cancelled = false;
    let autocomplete: google.maps.places.Autocomplete | null = null;
    let listener: google.maps.MapsEventListener | null = null;

    setOptions({ key: apiKey, libraries: ["places"], v: "weekly" });

    importLibrary("places")
      .then((places) => {
        if (cancelled || !inputRef.current) {
          return;
        }

        // DEPRECATED — Google flagged `places.Autocomplete` (the class
        // constructor) for replacement by the `<gmp-place-autocomplete>` Web
        // Component as of March 2025. The console warning is informational:
        // Google has committed to ≥12 months notice before any removal, so
        // the call still works. We're deferring the migration because:
        //   1. The new API requires enabling the "Places API (New)" SKU in
        //      Google Cloud (separate from the legacy "Places API"), with a
        //      per-request pricing model instead of per-session.
        //   2. The replacement is a declarative Web Component with a
        //      different DOM surface — design review needed before swapping.
        //   3. New behaviour uses a `gmp-placeselect` event instead of
        //      `place_changed`, plus a different shape for the returned
        //      Place object (no more `address_components` / `geometry.location`
        //      in the same form). The suburb auto-fill path below would need
        //      rewriting against the new Place API.
        // Soft target: migrate within 6 months. README has the same note
        // under "Known deprecations".
        autocomplete = new places.Autocomplete(inputRef.current, {
          componentRestrictions: { country: "za" },
          fields: ["formatted_address", "geometry", "address_components"]
        });

        listener = autocomplete.addListener("place_changed", () => {
          if (!autocomplete) {
            return;
          }
          const place = autocomplete.getPlace();
          const location = place.geometry?.location;
          const address = place.formatted_address ?? inputRef.current?.value ?? "";
          const suburb = findSuburb(place.address_components);

          if (inputRef.current && place.formatted_address) {
            inputRef.current.value = place.formatted_address;
          }

          if (suburb && suburbInputName && inputRef.current) {
            const form = inputRef.current.form;
            const suburbField = form?.elements.namedItem(suburbInputName);
            if (suburbField instanceof HTMLInputElement) {
              suburbField.value = suburb;
              suburbField.dispatchEvent(new Event("input", { bubbles: true }));
              suburbField.dispatchEvent(new Event("change", { bubbles: true }));
            }
          }

          if (location) {
            const lat = location.lat();
            const lng = location.lng();
            setCoords({ lat: String(lat), lng: String(lng) });
            onPlaceSelected?.({ address, lat, lng, suburb });
          }
        });
      })
      .catch((error) => {
        console.warn("[address-autocomplete] failed to load Places API:", error);
      });

    return () => {
      cancelled = true;
      listener?.remove();
      autocomplete = null;
    };
  }, [apiKey, suburbInputName, onPlaceSelected]);

  return (
    <>
      <input
        autoComplete="off"
        className={className}
        data-testid={testId}
        defaultValue={defaultValue}
        id={componentId}
        name={name}
        onChange={(event) => {
          if (coords.lat || coords.lng) {
            setCoords({ lat: "", lng: "" });
          }
          onValueChange?.(event.target.value);
        }}
        placeholder={placeholder}
        ref={inputRef}
        required={required}
        type="text"
      />
      {coordsLatName ? (
        <input name={coordsLatName} type="hidden" value={coords.lat} />
      ) : null}
      {coordsLngName ? (
        <input name={coordsLngName} type="hidden" value={coords.lng} />
      ) : null}
    </>
  );
}
