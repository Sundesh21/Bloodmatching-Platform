import { NavLink } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext.jsx";

/* Segmented control shared by the two "find blood" surfaces:
   individual donors (/donors) and hospital stock (/inventory). */
export default function FindBloodTabs() {
  const { t } = useLanguage();
  return (
    <div className="segmented-wrap">
      <div className="segmented">
        <NavLink to="/donors">{t("nav.findDonors")}</NavLink>
        <NavLink to="/inventory">{t("nav.hospitalStock")}</NavLink>
      </div>
    </div>
  );
}
