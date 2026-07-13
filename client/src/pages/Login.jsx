import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";

export default function Login() {
  const { login } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(form.email, form.password);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || t("login.failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page center">
      <form className="card auth" onSubmit={submit}>
        <h1>{t("login.title")}</h1>
        <p className="muted">{t("login.subtitle")}</p>
        <label>
          {t("login.email")}
          <input
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </label>
        <label>
          {t("login.password")}
          <input
            type="password"
            required
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn" disabled={busy}>
          {busy ? t("login.submitting") : t("login.submit")}
        </button>
        <p className="muted">
          <Link to="/forgot-password">Forgot password?</Link>
        </p>
        <p className="muted">
          {t("login.newHere")} <Link to="/register">{t("login.createAccount")}</Link>
        </p>
      </form>
    </div>
  );
}
