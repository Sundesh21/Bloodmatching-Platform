import { useLanguage } from "../context/LanguageContext.jsx";

// Opens Google Maps with directions from the viewer's current position to a
// stored coordinate. Renders nothing when we have no coordinates (location is
// optional — many users decline the GPS prompt at signup).
export default function DirectionsButton({ location, className = "" }) {
  const { t } = useLanguage();
  if (location?.lat == null || location?.lng == null) return null;
  const href = `https://www.google.com/maps/dir/?api=1&destination=${location.lat},${location.lng}`;
  return (
    <a
      className={`btn small ${className}`}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      <span aria-hidden="true">🧭</span> {t("common.directions")}
    </a>
  );
}
