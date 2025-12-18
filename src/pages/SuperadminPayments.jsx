// src/pages/SuperadminPayments.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { API_BASE_URL } from "../api";

/**
 * Superadmin Payments (placeholder but functional)
 * - stays in superadmin area
 * - demonstrates how to call backend superadmin endpoints using token
 */

function getSuperadminAxios() {
  // prefer explicit window token (set by SuperadminAuthContext)
  const tokenFromWindow = window.__SUPERADMIN_TOKEN__ || null;
  let raw = null;
  try {
    raw = localStorage.getItem("superadmin_auth");
  } catch {}
  const parsed = raw ? JSON.parse(raw) : null;
  const token = tokenFromWindow || parsed?.token || null;

  return axios.create({
    baseURL: API_BASE_URL,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

export default function SuperadminPayments() {
  const [loading, setLoading] = useState(false);
  const [invoices, setInvoices] = useState([]);

  useEffect(() => {
    loadInvoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadInvoices() {
    setLoading(true);
    try {
      const api = getSuperadminAxios();
      // backend route may be /superadmin/payments/invoices
      const res = await api.get("/superadmin/payments/invoices").catch(() => null);
      if (res && res.data) {
        setInvoices(res.data || []);
      } else {
        // if no backend yet, show placeholder
        setInvoices([]);
      }
    } catch (err) {
      console.error("Failed to load invoices:", err);
      toast.error("Unable to load payments data");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold mb-4">Payments & Billing</h1>

      <div className="bg-white rounded shadow p-4 mb-4">
        <p className="text-sm text-slate-600">
          Manage subscriptions, invoices and customer billing. This page is intentionally minimal — wire your payment provider (Stripe/PayPal) on the backend.
        </p>
      </div>

      <div className="bg-white rounded shadow p-4">
        <h2 className="text-sm font-semibold mb-2">Invoices</h2>

        {loading ? (
          <div className="text-sm text-slate-500">Loading...</div>
        ) : invoices.length === 0 ? (
          <div className="text-sm text-slate-500">No invoices available (or backend route not implemented).</div>
        ) : (
          <div className="space-y-3">
            {invoices.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between border rounded p-3">
                <div>
                  <div className="font-medium">{inv.description || `Invoice ${inv.id}`}</div>
                  <div className="text-xs text-slate-500">{inv.date || inv.created_at}</div>
                </div>
                <div className="text-sm">{inv.amount || inv.total || "—"}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
