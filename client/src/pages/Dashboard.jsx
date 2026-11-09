
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Wallet,
  Clock3,
  CircleCheck,
  TrendingUp,
  Copy,
  Plus
} from "lucide-react";

import { get, post } from "../api";
import PaymentChart from "../components/PaymentChart";
import { useNotifications } from "../context/NotificationContext";

const currency = (amount) =>
  `KES ${Number(amount || 0).toLocaleString("en-KE")}`;

export default function Dashboard() {
  const [analytics, setAnalytics] = useState(null);
  const [links, setLinks] = useState([]);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { refreshKey, notifications } = useNotifications();

  async function loadDashboard() {
    try {
      const [stats, savedLinks] = await Promise.all([
        get("/analytics"),
        get("/payments/links")
      ]);

      setAnalytics(stats);
      setLinks(savedLinks);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, [refreshKey]);

  async function createLink(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const newLink = await post("/payments/links", {
        description,
        amount: Number(amount)
      });

      setLinks((current) => [newLink, ...current]);
      setDescription("");
      setAmount("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function copyLink(url) {
    try {
      await navigator.clipboard.writeText(url);
      alert("Payment link copied!");
    } catch {
      setError("Unable to copy link");
    }
  }

  const stats = [
    {
      title: "Total Revenue",
      value: currency(analytics?.totalRevenue),
      icon: Wallet
    },
    {
      title: "Pending Payments",
      value: analytics?.pendingPayments ?? 0,
      icon: Clock3
    },
    {
      title: "Completed Payments",
      value: analytics?.completedPayments ?? 0,
      icon: CircleCheck
    },
    {
      title: "Conversion Rate",
      value: `${analytics?.conversionRate ?? 0}%`,
      icon: TrendingUp
    }
  ];

  return (
    <div className="page-container">
      <div className="page-heading">
        <div>
          <h1>Merchant Dashboard</h1>
          <p>Monitor your payments and business performance.</p>
        </div>

        <Link className="primary-btn" to="/history">
          View Payment History
        </Link>
      </div>

      {error && <div className="error-box">{error}</div>}

      <div className="stats-grid">
        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <div className="stat-card" key={stat.title}>
              <div className="stat-icon">
                <Icon size={23} />
              </div>
              <p>{stat.title}</p>
              <h2>{stat.value}</h2>
            </div>
          );
        })}
      </div>

      <div className="dashboard-grid">
        <PaymentChart
          data={analytics?.dailyRevenue || []}
        />

        <section className="card">
          <h3>Create Payment Link</h3>
          <p>Generate a payment URL to share with customers.</p>

          <form onSubmit={createLink}>
            <label>Payment description</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Farm produce payment"
              required
              maxLength={200}
            />

            <label>Amount (KES)</label>
            <input
              type="number"
              min="1"
              step="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="1000"
              required
            />

            <button
              type="submit"
              className="primary-btn full-width"
              disabled={loading}
            >
              <Plus size={17} />
              {loading ? "Creating..." : "Create Payment Link"}
            </button>
          </form>
        </section>
      </div>

      <section className="card">
        <h3>Your Payment Links</h3>

        {links.length === 0 ? (
          <p className="empty-state">
            You have not created any payment links.
          </p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Payment URL</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {links.map((link) => (
                  <tr key={link.id}>
                    <td>{link.description}</td>
                    <td>{currency(link.amount)}</td>
                    <td>
                      <a
                        href={link.paymentUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open Payment Page
                      </a>
                    </td>
                    <td>
                      <button
                        className="secondary-btn"
                        onClick={() => copyLink(link.paymentUrl)}
                      >
                        <Copy size={15} />
                        Copy
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <h3>Live Payment Activity</h3>

        {notifications.length === 0 ? (
          <p className="empty-state">
            New payment activities will appear here.
          </p>
        ) : (
          notifications.slice(0, 8).map((item) => (
            <div className="activity-item" key={item.id}>
              <div>
                <strong>{item.title}</strong>
                <p>{item.message}</p>
              </div>

              <small>
                {new Date(item.createdAt).toLocaleString()}
              </small>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
