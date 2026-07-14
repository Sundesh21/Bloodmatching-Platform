import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { BLOOD_GROUPS, uploadToCloudinary } from "../api";

export default function Register() {
  const { register } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "donor",
    bloodGroup: "O+",
    city: "",
    phone: "",
    hospitalName: "",
    licenseNo: "",
    documentUrl: "",
    location: null,
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [locating, setLocating] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  // Name: letters and spaces only — no digits or symbols.
  const setName = (e) => {
    const cleaned = e.target.value.replace(/[^A-Za-z\s]/g, "");
    setForm((f) => ({ ...f, name: cleaned }));
  };

  // Phone: digits only, capped at 10.
  const setPhone = (e) => {
    const cleaned = e.target.value.replace(/\D/g, "").slice(0, 10);
    setForm((f) => ({ ...f, phone: cleaned }));
  };

  // Ask the browser for GPS/Wi-Fi coordinates (native Geolocation API).
  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setError(t("register.locationUnsupported"));
      return;
    }
    setError("");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setForm((f) => ({ ...f, location: { lat, lng } }));
        // Reverse-geocode coords -> city name and drop it in the city box.
        // Free, keyless OpenStreetMap Nominatim; if it fails we keep the coords.
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&zoom=10&lat=${lat}&lon=${lng}`
          );
          const a = (await res.json()).address || {};
          const city = a.city || a.town || a.village || a.county || a.state;
          if (city) setForm((f) => ({ ...f, city }));
        } catch {
          /* keep coords; user can type the city manually */
        }
        setLocating(false);
      },
      () => {
        setError(t("register.locationError"));
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const onDocumentChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      const url = await uploadToCloudinary(file);
      setForm((f) => ({ ...f, documentUrl: url }));
    } catch (err) {
      setError(err.message || t("register.documentUploadFailed"));
      e.target.value = "";
    } finally {
      setUploading(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!/^[A-Za-z\s]+$/.test(form.name.trim())) {
      setError(t("register.invalidName"));
      return;
    }
    if (form.phone && !/^\d{10}$/.test(form.phone)) {
      setError(t("register.invalidPhone"));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError(t("register.invalidEmail"));
      return;
    }
    if (isHospital && !form.documentUrl) {
      setError(t("register.documentRequired"));
      return;
    }
    setBusy(true);
    try {
      await register(form);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || t("register.failed"));
    } finally {
      setBusy(false);
    }
  };

  const isHospital = form.role === "hospital";

  return (
    <div className="page center">
      <form className="card auth" onSubmit={submit}>
        <h1>{t("register.title")}</h1>

        <label>
          {t("register.roleLabel")}
          <select value={form.role} onChange={set("role")}>
            <option value="donor">{t("register.roleDonor")}</option>
            <option value="requester">{t("register.roleRequester")}</option>
            <option value="hospital">{t("register.roleHospital")}</option>
          </select>
        </label>

        <label>
          {isHospital ? t("register.contactPerson") : t("register.fullName")}
          <input
            required
            value={form.name}
            onChange={setName}
            pattern="[A-Za-z\s]+"
            title={t("register.invalidName")}
          />
        </label>

        {isHospital && (
          <>
            <label>
              {t("register.hospitalName")}
              <input required value={form.hospitalName} onChange={set("hospitalName")} />
            </label>
            <label>
              {t("register.licenseNo")}
              <input
                required
                value={form.licenseNo}
                onChange={set("licenseNo")}
                placeholder={t("register.licenseNoPlaceholder")}
              />
            </label>
            <label>
              {t("register.documentLabel")}
              <input
                type="file"
                required={!form.documentUrl}
                accept="application/pdf,image/*"
                onChange={onDocumentChange}
              />
            </label>
            <p className="muted">
              {uploading
                ? t("register.documentUploading")
                : form.documentUrl
                ? t("register.documentUploaded")
                : t("register.documentHint")}
            </p>
            <p className="note">{t("register.verifyNotice")}</p>
          </>
        )}

        {!isHospital && (
          <label>
            {t("register.bloodGroup")}
            <select value={form.bloodGroup} onChange={set("bloodGroup")}>
              {BLOOD_GROUPS.map((bg) => (
                <option key={bg}>{bg}</option>
              ))}
            </select>
          </label>
        )}

        <label>
          {t("register.city")}
          <input required value={form.city} onChange={set("city")} placeholder={t("register.cityPlaceholder")} />
        </label>

        <button type="button" className="btn ghost" onClick={useMyLocation} disabled={locating}>
          {locating
            ? t("register.locating")
            : form.location
            ? t("register.locationSet")
            : t("register.useLocation")}
        </button>

        <label>
          {t("register.phone")}
          <input
            type="tel"
            inputMode="numeric"
            value={form.phone}
            onChange={setPhone}
            pattern="\d{10}"
            maxLength={10}
            title={t("register.invalidPhone")}
            placeholder={t("register.phonePlaceholder")}
          />
        </label>

        <label>
          {t("register.email")}
          <input type="email" required value={form.email} onChange={set("email")} />
        </label>

        <label>
          {t("register.password")}
          <input type="password" required minLength={6} value={form.password} onChange={set("password")} />
        </label>

        {error && <p className="error">{error}</p>}
        <button className="btn" disabled={busy || uploading}>
          {busy ? t("register.submitting") : t("register.submit")}
        </button>
        <p className="muted">
          {t("register.alreadyRegistered")} <Link to="/login">{t("register.logIn")}</Link>
        </p>
      </form>
    </div>
  );
}
