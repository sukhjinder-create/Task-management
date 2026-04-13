// src/pages/SLA.jsx — Public SLA page (no auth required)
import { Link } from "react-router-dom";
import { Shield, Clock, Database, CheckCircle, AlertTriangle, Zap } from "lucide-react";

function Section({ title, children }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">{title}</h2>
      {children}
    </section>
  );
}

function Table({ headers, rows }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 mb-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            {headers.map((h) => (
              <th key={h} className="px-4 py-3 text-left font-semibold text-gray-700">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-3 text-gray-700">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function SLA() {
  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900">Asystence</span>
          </div>
          <Link to="/login" className="text-sm text-indigo-600 hover:underline font-medium">
            Sign in →
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">

        {/* Title */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Service Level Agreement</h1>
          <p className="text-gray-500 text-sm">Effective date: April 1, 2026 · Last updated: March 27, 2026</p>
          <p className="mt-4 text-gray-600 leading-relaxed">
            This Service Level Agreement ("SLA") describes the uptime commitments, support response
            times, data backup policies, and compensation terms Asystence provides to paying customers.
          </p>
        </div>

        {/* Uptime */}
        <Section title="1. Uptime Guarantee">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {[
              { icon: <Zap className="w-5 h-5 text-green-600" />, label: "Monthly Uptime", value: "99.9%", bg: "bg-green-50 border-green-200" },
              { icon: <Clock className="w-5 h-5 text-blue-600" />, label: "Max Downtime / Month", value: "~43 min", bg: "bg-blue-50 border-blue-200" },
              { icon: <CheckCircle className="w-5 h-5 text-indigo-600" />, label: "Planned Maintenance Window", value: "Sundays 2–4 AM UTC", bg: "bg-indigo-50 border-indigo-200" },
            ].map(({ icon, label, value, bg }) => (
              <div key={label} className={`rounded-xl border p-4 ${bg}`}>
                <div className="flex items-center gap-2 mb-1">{icon}<span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</span></div>
                <p className="text-lg font-bold text-gray-900">{value}</p>
              </div>
            ))}
          </div>
          <p className="text-gray-600 text-sm leading-relaxed">
            Uptime is measured as the percentage of minutes in a calendar month during which the Asystence
            application API and web interface are available and responding to requests. Scheduled
            maintenance windows and incidents caused by customer actions are excluded from downtime
            calculations.
          </p>
        </Section>

        {/* Compensation */}
        <Section title="2. Service Credits">
          <p className="text-gray-600 text-sm mb-4 leading-relaxed">
            If monthly uptime falls below the guaranteed threshold, affected customers on paid plans
            are eligible for service credits applied to their next billing cycle.
          </p>
          <Table
            headers={["Monthly Uptime", "Service Credit"]}
            rows={[
              ["99.0% – 99.9%", "10% of monthly fee"],
              ["95.0% – 98.9%", "25% of monthly fee"],
              ["Below 95.0%", "50% of monthly fee"],
            ]}
          />
          <p className="text-gray-500 text-xs mt-2">
            Credits must be requested within 30 days of the incident. Credits are non-transferable and
            may not be exchanged for cash.
          </p>
        </Section>

        {/* Support */}
        <Section title="3. Support Response Times">
          <Table
            headers={["Plan", "Severity", "First Response", "Resolution Target"]}
            rows={[
              ["Enterprise", "Critical (service down)", "≤ 1 hour", "≤ 4 hours"],
              ["Enterprise", "High (major feature broken)", "≤ 4 hours", "≤ 24 hours"],
              ["Enterprise", "Medium / Low", "≤ 8 business hours", "Best effort"],
              ["Professional", "Critical", "≤ 4 hours", "≤ 12 hours"],
              ["Professional", "Medium / Low", "≤ 1 business day", "Best effort"],
              ["Basic / Free", "All", "≤ 3 business days", "Best effort"],
            ]}
          />
          <div className="flex items-start gap-2 text-sm text-gray-600 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mt-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
            <span>Support is provided in English via in-app chat and email. Business hours are Monday–Friday 9 AM–6 PM IST.</span>
          </div>
        </Section>

        {/* Data Backup */}
        <Section title="4. Data Backup Policy">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            {[
              { icon: <Database className="w-5 h-5 text-indigo-600" />, label: "Backup Frequency", value: "Daily at 2:00 AM UTC" },
              { icon: <Clock className="w-5 h-5 text-indigo-600" />, label: "Retention Period", value: "30 days rolling" },
              { icon: <Shield className="w-5 h-5 text-indigo-600" />, label: "Backup Encryption", value: "AES-256 at rest" },
              { icon: <CheckCircle className="w-5 h-5 text-indigo-600" />, label: "Storage", value: "Redundant S3-compatible object storage" },
            ].map(({ icon, label, value }) => (
              <div key={label} className="flex items-start gap-3 bg-white border border-gray-200 rounded-xl p-4">
                <div className="mt-0.5">{icon}</div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
                  <p className="font-medium text-gray-900 mt-0.5">{value}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-gray-600 text-sm leading-relaxed">
            Asystence performs automated full database backups every day. Backups are compressed, encrypted,
            and stored in geographically redundant object storage. In the event of a data loss incident,
            we guarantee a Recovery Point Objective (RPO) of 24 hours and a Recovery Time Objective
            (RTO) of 4 hours for Enterprise customers, and 12 hours for Professional customers.
          </p>
        </Section>

        {/* Backup Restoration */}
        <Section title="5. Backup Restoration">
          <Table
            headers={["Plan", "Restoration Request", "Target RTO"]}
            rows={[
              ["Enterprise", "Contact support — we restore on your behalf", "≤ 4 hours"],
              ["Professional", "Contact support — we restore on your behalf", "≤ 12 hours"],
              ["Basic", "Self-service export only", "N/A"],
            ]}
          />
          <p className="text-gray-500 text-xs mt-2">
            Workspace data exports (JSON/CSV) are available to all paying plans at any time from the
            Enterprise → GDPR section. Full database restoration is reserved for disaster-recovery
            scenarios.
          </p>
        </Section>

        {/* Exclusions */}
        <Section title="6. Exclusions">
          <ul className="list-disc list-inside space-y-1.5 text-sm text-gray-600">
            <li>Downtime caused by customer misuse, abuse, or violation of the Terms of Service</li>
            <li>Incidents caused by third-party services (payment gateways, OAuth providers, email delivery)</li>
            <li>Force majeure events (natural disasters, widespread internet outages)</li>
            <li>Scheduled maintenance windows communicated at least 24 hours in advance</li>
            <li>Free plan workspaces (no uptime SLA applies)</li>
          </ul>
        </Section>

        {/* Contact */}
        <Section title="7. Contact">
          <p className="text-gray-600 text-sm">
            To request a service credit or file an SLA claim, contact{" "}
            <span className="font-medium text-gray-900">support@proxima.app</span> within 30 days of
            the incident. Include your workspace ID, the date/time of the incident, and a description
            of the impact.
          </p>
        </Section>

        <p className="text-xs text-gray-400 mt-8 text-center">
          Asystence reserves the right to update this SLA with 30 days' notice. The current version always applies.
        </p>
      </main>
    </div>
  );
}
