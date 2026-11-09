
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { get } from "../api";
import { useNotifications } from "../context/NotificationContext";

export default function PaymentHistory() {
  const [payments, setPayments] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [filters, setFilters] = useState({
    status: "",
    from: "",
    to: "",
    minAmount: "",
    maxAmount: ""
  });

  const { refreshKey } = useNotifications();

  useEffect(() => {
    let active = true;

    async function loadPayments() {
      setLoading(true);

      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: "20"
        });

        Object.entries(filters).forEach(([key, value]) => {
          if (value !== "") {
            params.set(key, value);
          }
        });

        const response = await get(
          `/payments?${params.toString()}`
        );

        if (active) {
          setPayments(response.data);
          setPagination(response.pagination);
          setError("");
        }
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadPayments();

    return () => {
      active = false;
    };
  }, [page, filters, refreshKey]);

  function changeFilter(name, value) {
    setFilters((current) => ({
      ...current,
      [name]: value
    }));

    setPage(1);
  }

  return (
    <div className="page-container">
      <div className="page-heading">
        <div>
          <h1>Payment History</h1>
          <p>Search and filter your transactions.</p>
        </div>

        <Link className="secondary-btn" to="/dashboard">
          Back to Dashboard
        </Link>
      </div>

      <section className="card">
        <div className="filters">
          <div>
            <label>Status</label>
            <select
              value={filters.status}
              onChange={(e) =>
                changeFilter("status", e.target.value)
              }
            >
              <option value="">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          <div>
            <label>From</label>
            <input
              type="date"
              value={filters.from}
              onChange={(e) =>
                changeFilter("from", e.target.value)
              }
            />
          </div>

          <div>
            <label>To</label>
            <input
              type="date"
              value={filters.to}
              onChange={(e) =>
                changeFilter("to", e.target.value)
              }
            />
          </div>

          <div>
            <label>Min KES</label>
            <input
              type="number"
              min="0"
              value={filters.minAmount}
              onChange={(e) =>
                changeFilter("minAmount", e.target.value)
              }
            />
          </div>

          <div>
            <label>Max KES</label>
            <input
              type="number"
              min="0"
              value={filters.maxAmount}
              onChange={(e) =>
                changeFilter("maxAmount", e.target.value)
              }
            />
          </div>
        </div>
      </section>

      <section className="card">
        {error && <div className="error-box">{error}</div>}
        {loading && <p>Loading payments...</p>}

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Transaction ID</th>
                <th>Customer</th>
                <th>Amount</th>
                <th>Status</th>
                <th>M-Pesa Receipt</th>
                <th>Date</th>
              </tr>
            </thead>

            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <td>{payment.id.slice(0, 12)}...</td>
                  <td>{payment.payerPhone}</td>
                  <td>
                    KES {payment.amount.toLocaleString("en-KE")}
                  </td>
                  <td>
                    <span className={
                      `status-badge ${payment.status.toLowerCase()}`
                    }>
                      {payment.status}
                    </span>
                  </td>
                  <td>
                    {payment.mpesaReceiptNumber || "—"}
                  </td>
                  <td>
                    {new Date(
                      payment.createdAt
                    ).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && payments.length === 0 && (
          <p className="empty-state">
            No payments match your filters.
          </p>
        )}

        {pagination && (
          <div className="pagination">
            <button
              className="secondary-btn"
              onClick={() => setPage((p) => p - 1)}
              disabled={page <= 1}
            >
              Previous
            </button>

            <span>
              Page {page} of {pagination.totalPages || 1}
            </span>

            <button
              className="secondary-btn"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= pagination.totalPages}
            >
              Next
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
