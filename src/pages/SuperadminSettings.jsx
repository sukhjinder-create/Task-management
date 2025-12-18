// src/pages/SuperadminSettings.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { API_BASE_URL } from "../api";

function getSuperadminAxios() {
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

export default function SuperadminSettings() {
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({});

  useEffect(() => {
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadSettings() {
    setLoading(true);
    try {
      const api = getSuperadminAxios();
      const res = await api.get("/superadmin/settings").catch(() => null);
      if (res && res.data) {
        setSettings(res.data);
      } else {
        setSettings({});
      }
    } catch (err) {
      console.error("Failed to load superadmin settings:", err);
      toast.error("Unable to load settings");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold mb-4">Platform Settings</h1>

      <div className="bg-white rounded shadow p-4">
        <p className="text-sm text-slate-600 mb-3">
          Global platform configuration for subscriptions, plans and limits.
        </p>

        {loading ? (
          <div className="text-sm text-slate-500">Loading...</div>
        ) : (
          <pre className="text-xs bg-slate-50 p-3 rounded border">{JSON.stringify(settings, null, 2)}</pre>
        )}
      </div>
    </div>
  );
}
