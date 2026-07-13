import { useLanguage } from "../context/LanguageContext.jsx";

// A one-tap call button. `tel:` links hand off to the device dialer
// (phone app on mobile, FaceTime/Skype/etc. on desktop).
export default function CallButton({ phone, label, className = "" }) {
  const { t } = useLanguage();
  if (!phone) return null;
  // Keep digits and a leading +, drop spaces/dashes so the dialer parses it.
  const tel = phone.replace(/[^\d+]/g, "");
  if (!tel) return null;
  const shownLabel = label ?? t("common.call");
  return (
    <a
      className={`btn small call-btn ${className}`}
      href={`tel:${tel}`}
      aria-label={`${t("common.call")} ${phone}`}
    >
      <span aria-hidden="true">📞</span> {shownLabel}
    </a>
  );
}
