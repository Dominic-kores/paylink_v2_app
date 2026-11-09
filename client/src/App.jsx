
import { useEffect, useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Link,
  useNavigate
} from "react-router-dom";

import { post } from "./api";
import { NotificationProvider, useNotifications }
  from "./context/NotificationContext";

import NotificationBell from "./components/NotificationBell";
import Dashboard from "./pages/Dashboard";
import PaymentPage from "./pages/PaymentPage";
import PaymentHistory from "./pages/PaymentHistory";
import "./App.css";

function LoginPage() {
  const [register, setRegister] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    try {
      const data = await post(
        register ? "/auth/register" : "/auth/login",
        { name, email, password, phone }
      );

      localStorage.setItem("paylink_token", data.token);
      localStorage.setItem("paylink_user", JSON.stringify(data.user));

      // Reload so notification context connects with the token.
      window.location.replace("/dashboard");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="checkout-container">
      <div className="checkout-card">
        <div className="checkout-header">
          <h1>PayLink</h1>
          <p>Merchant Portal</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <h2>{register ? "Create Account" : "Welcome Back"}</h2>

          {error && <div className="error-box">{error}</div>}

          {register && (
            <>
              <label>Business / Merchant Name</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your business name"
              />

              <label>Mobile number (optional)</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0712345678"
              />
            </>
          )}

          <label>Email Address</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <label>Password</label>
          <input
            type="password"
            minLength={register ? 8 : undefined}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button type="submit" className="primary-btn full-width">
            {register ? "Create Account" : "Login"}
          </button>

          <button
            type="button"
            className="text-button"
            onClick={() => {
              setRegister(!register);
              setError("");
            }}
          >
            {register
              ? "Already registered? Login"
              : "New merchant? Create an account"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Protected({ children }) {
  const token = localStorage.getItem("paylink_token");

  return token
    ? children
    : <Navigate to="/login" replace />;
}

function ToastNotification() {
  const { toast, setToast } = useNotifications();

  if (!toast) return null;

  return (
    <div className={`toast ${toast.type}`}>
      <button
        className="toast-close"
        onClick={() => setToast(null)}
        aria-label="Dismiss notification"
      >
        ×
      </button>

      <strong>{toast.title}</strong>
      <p>{toast.message}</p>
    </div>
  );
}

function MerchantLayout({ children }) {
  const navigate = useNavigate();

  const user = JSON.parse(
    localStorage.getItem("paylink_user") || "null"
  );

  function logout() {
    localStorage.removeItem("paylink_token");
    localStorage.removeItem("paylink_user");
    navigate("/login", { replace: true });
    window.location.reload();
  }

  return (
    <NotificationProvider>
      <div className="app-shell">
        <header className="navbar">
          <Link className="brand" to="/dashboard">
            PayLink <span>v2</span>
          </Link>

          <nav className="nav-links">
            <Link to="/dashboard">Dashboard</Link>
            <Link to="/history">Payments</Link>
          </nav>

          <div className="nav-actions">
            <span className="merchant-name">
              {user?.name || "Merchant"}
            </span>
            <NotificationBell />
            <button className="secondary-btn" onClick={logout}>
              Logout
            </button>
          </div>
        </header>

        {children}
        <ToastNotification />
      </div>
    </NotificationProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/dashboard"
          element={
            <Protected>
              <MerchantLayout>
                <Dashboard />
              </MerchantLayout>
            </Protected>
          }
        />

        <Route
          path="/history"
          element={
            <Protected>
              <MerchantLayout>
                <PaymentHistory />
              </MerchantLayout>
            </Protected>
          }
        />

        <Route
          path="/pay/:slug"
          element={<PaymentPage />}
        />

        <Route
          path="*"
          element={<Navigate to="/dashboard" replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}
