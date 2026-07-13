import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";

export default function Landing() {
  const { user } = useAuth();
  const { t } = useLanguage();

  // Signed-in visitors skip the sign-up funnel and go straight to the app.
  const primaryTo = user ? "/request" : "/register";
  const secondaryTo = user ? "/donors" : "/login";

  return (
    <>
      <section className="hero">
        <HeroBlob />
        <div className="hero-inner">
          <div className="hero-copy">
            <h1>{t("landing.title")}</h1>
            <p>{t("landing.subtitle")}</p>
            <div className="hero-cta">
              <Link to={secondaryTo} className="btn outline">
                {user ? t("landing.ctaFindDonors") : t("landing.ctaLogin")}
              </Link>
              <Link to={primaryTo} className="btn">
                {t("landing.ctaPrimary")}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>{t("landing.howTitle")}</h2>
          <p>{t("landing.howSubtitle")}</p>
        </div>
        <div className="grid">
          {[1, 2, 3].map((n) => (
            <div className="card step" key={n}>
              <span className="step-num">{n}</span>
              <h3>{t(`landing.step${n}Title`)}</h3>
              <p>{t(`landing.step${n}Body`)}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="stat-band">
        <section className="section">
          <div className="stat-row">
            <div className="stat">
              <strong>8</strong>
              <span>{t("landing.statGroups")}</span>
            </div>
            <div className="stat">
              <strong>&lt;60s</strong>
              <span>{t("landing.statAlert")}</span>
            </div>
            <div className="stat">
              <strong>24/7</strong>
              <span>{t("landing.statAvailable")}</span>
            </div>
            <div className="stat">
              <strong>100%</strong>
              <span>{t("landing.statFree")}</span>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

/* The gradient sweep behind the hero. preserveAspectRatio="none" lets the
   curve stretch to any viewport while keeping its silhouette. */
function HeroBlob() {
  return (
    <svg
      className="hero-blob"
      viewBox="0 0 1600 900"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="heroGrad" x1="0" y1="0" x2="0.65" y2="1">
          <stop offset="0%" stopColor="#b21f49" />
          <stop offset="55%" stopColor="#8d1339" />
          <stop offset="100%" stopColor="#5d0f2b" />
        </linearGradient>
      </defs>
      <path d="M0,0 L320,0 C 620,220 800,540 980,900 L0,900 Z" fill="url(#heroGrad)" />
    </svg>
  );
}
