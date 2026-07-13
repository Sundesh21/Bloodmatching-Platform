import { useLanguage } from "../context/LanguageContext.jsx";

// Shown in place of a donor/requester feature (posting requests, browsing
// donors, publishing stock) whenever the logged-in hospital isn't verified
// yet. Keeps every gated page consistent instead of each rolling its own copy.
export default function HospitalVerifyGate({ status }) {
  const { t } = useLanguage();
  return (
    <div className="page">
      <div className={`card verify-notice ${status}`}>
        <h1>{status === "rejected" ? t("verify.rejectedTitle") : t("verify.pendingTitle")}</h1>
        <p className="muted">
          {status === "rejected" ? t("verify.rejectedBody") : t("verify.pendingBody")}
        </p>
      </div>
    </div>
  );
}
