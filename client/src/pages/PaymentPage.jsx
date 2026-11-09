
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";

import { get, post } from "../api";
import { createSocket } from "../socket";

export default function PaymentPage() {
  const { slug } = useParams();

  const [link, setLink] = useState(null);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [paymentId, setPaymentId] = useState(null);
  const [status, setStatus] = useState("IDLE");
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState("");

  const socketRef = useRef(null);

  useEffect(() => {
    let active = true;

    get(`/payments/links/${slug}`)
      .then((data) => {
        if (active) setLink(data);
      })
      .catch((err) => {
        if (active) setError(err.message);
      });

    return () => {
      active = false;
    };
  }, [slug]);

  useEffect(() => {
    if (!paymentId) return;

    const socket = createSocket();
    socketRef.current = socket;

    function subscribe() {
      socket.emit("watch-payment", {
        paymentId,
        slug
      });
    }

    function handleStatus(payment) {
      if (payment.id !== paymentId) return;

      setStatus(payment.status);

      if (payment.status === "COMPLETED") {
        setReceipt(payment.mpesaReceiptNumber);
      }

      if (payment.status === "FAILED") {
        setError(
          payment.failureReason || "Payment failed"
        );
      }
    }

    socket.on("connect", subscribe);
    socket.on("payment-status", handleStatus);

    // Also check current database status.
    // Useful if callback completed before socket connected.
    get(`/payments/status/${paymentId}?slug=${slug}`)
      .then(handleStatus)
      .catch(console.error);

    return () => {
      socket.off("connect", subscribe);
      socket.off("payment-status", handleStatus);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [paymentId, slug]);

  async function handlePayment(event) {
    event.preventDefault();

    setError("");
    setReceipt(null);
    setStatus("PROCESSING");
    setPaymentId(null);

    try {
      const response = await post("/payments/stkpush", {
        slug,
        phone,
        email: email.trim() || undefined
      });

      setPaymentId(response.paymentId);
      setStatus("PENDING");
    } catch (err) {
      setError(err.message);
      setStatus("FAILED");
    }
  }

  if (error && !link) {
    return (
      <div className="checkout-container">
        <div className="error-box">{error}</div>
      </div>
    );
  }

  if (!link) {
    return <p className="loading-text">Loading payment page...</p>;
  }

  return (
    <div className="checkout-container">
      <div className="checkout-card">
        <div className="checkout-header">
          <h1>PayLink</h1>
          <p>Secure M-Pesa Payment</p>
        </div>

        <div className="checkout-body">
          <p className="muted">Paying to</p>
          <h2>{link.merchantName}</h2>
          <p>{link.description}</p>

          <div className="payment-amount">
            KES {link.amount.toLocaleString("en-KE")}
          </div>

          {status === "COMPLETED" ? (
            <div className="success-box">
              <h2>✓ Payment Received!</h2>
              <p>Your payment was successful.</p>
              <p><strong>Receipt:</strong> {receipt}</p>
              <p>Thank you for using PayLink.</p>
            </div>
          ) : (
            <>
              {error && (
                <div className="error-box">{error}</div>
              )}

              {status === "PENDING" && (
                <div className="pending-box">
                  <h3>Waiting for M-Pesa payment...</h3>
                  <p>
                    Check your phone and enter your M-Pesa PIN.
                    This page updates automatically.
                  </p>
                </div>
              )}

              {status === "PROCESSING" && (
                <div className="pending-box">
                  <h3>Processing your request...</h3>
                  <p>Sending the STK Push to your phone.</p>
                </div>
              )}

              <form onSubmit={handlePayment}>
                <label>M-Pesa phone number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0712345678"
                  required
                  disabled={
                    status === "PROCESSING" ||
                    status === "PENDING"
                  }
                />

                <label>Email for receipt (optional)</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="customer@example.com"
                  disabled={
                    status === "PROCESSING" ||
                    status === "PENDING"
                  }
                />

                <button
                  type="submit"
                  className="primary-btn full-width"
                  disabled={
                    status === "PROCESSING" ||
                    status === "PENDING"
                  }
                >
                  {status === "FAILED"
                    ? "Retry Payment"
                    : "Pay with M-Pesa"}
                </button>
              </form>

              <p className="checkout-footer">
                You will receive an M-Pesa prompt on your phone.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
