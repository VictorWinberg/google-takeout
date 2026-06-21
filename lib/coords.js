import { find } from "geo-tz";

export function getCoords(data) {
  for (const key of ["geoData", "geoDataExif"]) {
    const geo = data[key];
    if (geo?.latitude != null && geo?.longitude != null) {
      const lat = geo.latitude;
      const lng = geo.longitude;
      if (lat !== 0 || lng !== 0) {
        return { lat, lng };
      }
    }
  }

  return null;
}

export function getTimezoneFromCoords(lat, lng) {
  const timezones = find(lat, lng);
  return timezones[0] ?? null;
}
