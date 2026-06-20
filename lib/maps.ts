import "server-only";

import { getGoogleMapsApiKey } from "@/lib/env";
import type { LatLng } from "@/lib/geo";

export { haversineKm, type LatLng } from "@/lib/geo";

const GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";
const DISTANCE_MATRIX_URL =
  "https://maps.googleapis.com/maps/api/distancematrix/json";

/**
 * Geocodes a free-text address to coordinates via the Google Geocoding API.
 *
 * Returns null when no API key is configured, the request fails, or no result
 * is found — callers store null coordinates and fall back to manual distance.
 */
export async function geocodeAddress(query: string): Promise<LatLng | null> {
  const apiKey = getGoogleMapsApiKey();
  const address = query.trim();

  if (!apiKey) {
    console.warn("[maps] Skipping geocode — GOOGLE_MAPS_API_KEY is not set.");
    return null;
  }

  if (!address) {
    return null;
  }

  try {
    const url = `${GEOCODE_URL}?address=${encodeURIComponent(address)}&key=${apiKey}`;
    const response = await fetch(url);
    const data = (await response.json()) as {
      status: string;
      results?: { geometry?: { location?: LatLng } }[];
    };

    if (data.status !== "OK") {
      console.warn(`[maps] Geocode failed for "${address}": ${data.status}`);
      return null;
    }

    const location = data.results?.[0]?.geometry?.location;
    if (!location || typeof location.lat !== "number" || typeof location.lng !== "number") {
      return null;
    }

    return { lat: location.lat, lng: location.lng };
  } catch (error) {
    console.warn(`[maps] Geocode error for "${address}":`, error);
    return null;
  }
}

/**
 * Driving distance in kilometres between two coordinates via the Google
 * Distance Matrix API. Returns null when no key is configured or the request
 * fails, so callers can fall back to a straight-line estimate.
 */
export async function getDrivingDistanceKm(
  origin: LatLng,
  dest: LatLng
): Promise<number | null> {
  const apiKey = getGoogleMapsApiKey();

  if (!apiKey) {
    console.warn(
      "[maps] Skipping distance matrix — GOOGLE_MAPS_API_KEY is not set."
    );
    return null;
  }

  try {
    const params = new URLSearchParams({
      origins: `${origin.lat},${origin.lng}`,
      destinations: `${dest.lat},${dest.lng}`,
      mode: "driving",
      units: "metric",
      key: apiKey
    });
    const response = await fetch(`${DISTANCE_MATRIX_URL}?${params.toString()}`);
    const data = (await response.json()) as {
      status: string;
      rows?: {
        elements?: { status: string; distance?: { value: number } }[];
      }[];
    };

    const element = data.rows?.[0]?.elements?.[0];
    if (data.status !== "OK" || element?.status !== "OK" || !element.distance) {
      console.warn(
        `[maps] Distance matrix failed: ${data.status}/${element?.status ?? "no-element"}`
      );
      return null;
    }

    return Math.round((element.distance.value / 1000) * 100) / 100;
  } catch (error) {
    console.warn("[maps] Distance matrix error:", error);
    return null;
  }
}
