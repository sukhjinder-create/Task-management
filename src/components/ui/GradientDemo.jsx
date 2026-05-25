import React from 'react';
import { Button } from './Button';

export const GradientDemo = () => {
  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-8 text-center text-[color:var(--text)]">Gradient Color Showcase</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
        {/* Primary Gradient */}
        <div className="p-6 rounded-xl border border-[color:var(--border)]">
          <h2 className="text-xl font-semibold mb-4 text-[color:var(--text)]">Primary Gradient</h2>
          <div className="bg-[color:var(--primary)] h-32 rounded-lg mb-4 flex items-center justify-center">
            <span className="text-white font-medium">var(--primary)</span>
          </div>
          <p className="text-sm text-[color:var(--text-muted)] mb-4">
            Used for primary buttons, important actions, and highlights.
          </p>
          <Button variant="primary">Primary Button</Button>
        </div>

        {/* Subtle Surface */}
        <div className="p-6 rounded-xl border border-[color:var(--border)]">
          <h2 className="text-xl font-semibold mb-4 text-[color:var(--text)]">Subtle Surface</h2>
          <div className="bg-[var(--surface-soft)] h-32 rounded-lg mb-4 flex items-center justify-center">
            <span className="text-[color:var(--text)] font-medium">var(--surface-soft)</span>
          </div>
          <p className="text-sm text-[color:var(--text-muted)] mb-4">
            Used for subtle backgrounds, cards, and non-intrusive elements.
          </p>
          <div className="bg-[var(--surface-soft)] p-4 rounded-lg border border-[color:var(--border)]">
            <p className="text-[color:var(--text)]">This is a subtle surface background</p>
          </div>
        </div>

        {/* Card Surface */}
        <div className="p-6 rounded-xl border border-[color:var(--border)]">
          <h2 className="text-xl font-semibold mb-4 text-[color:var(--text)]">Card Surface</h2>
          <div className="bg-[var(--surface)] h-32 rounded-lg mb-4 flex items-center justify-center border border-[color:var(--border)]">
            <span className="text-[color:var(--text)] font-medium">var(--surface)</span>
          </div>
          <p className="text-sm text-[color:var(--text-muted)] mb-4">
            Used for card backgrounds — outline-only, no fills.
          </p>
          <div className="border border-[color:var(--border)] p-6 rounded-xl">
            <h3 className="font-medium mb-2 text-[color:var(--text)]">Card Title</h3>
            <p className="text-sm text-[color:var(--text-muted)]">This card uses an outline-only border.</p>
          </div>
        </div>

        {/* Sidebar Surface */}
        <div className="p-6 rounded-xl border border-[color:var(--border)]">
          <h2 className="text-xl font-semibold mb-4 text-[color:var(--text)]">Sidebar Surface</h2>
          <div className="bg-[var(--surface-soft)] h-32 rounded-lg mb-4 flex items-center justify-center border border-[color:var(--border)]">
            <span className="text-[color:var(--text)] font-medium">var(--surface-soft)</span>
          </div>
          <p className="text-sm text-[color:var(--text-muted)] mb-4">
            Used for sidebar backgrounds — token-driven, theme-aware.
          </p>
          <div className="bg-[var(--surface-soft)] p-4 rounded-lg border border-[color:var(--border)]">
            <p className="text-[color:var(--text)]">Sidebar navigation background</p>
          </div>
        </div>
      </div>

      {/* Button Variants */}
      <div className="mb-12">
        <h2 className="text-2xl font-bold mb-6 text-[color:var(--text)]">Button Variants</h2>
        <div className="flex flex-wrap gap-4">
          <Button variant="primary">Primary</Button>
          <Button variant="premium">Premium</Button>
          <Button variant="shimmer">Shimmer</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="success">Success</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="outline">Outline</Button>
        </div>
      </div>

      {/* Status / Accent Tokens */}
      <div className="mb-12">
        <h2 className="text-2xl font-bold mb-6 text-[color:var(--text)]">Status Accent Tokens</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[
            { label: 'Primary',  bg: 'bg-[color:var(--primary)]',       text: 'text-white' },
            { label: 'Good',     bg: 'bg-[color:var(--score-good)]',     text: 'text-white' },
            { label: 'Warning',  bg: 'bg-[color:var(--score-warning)]',  text: 'text-white' },
            { label: 'Danger',   bg: 'bg-[color:var(--score-danger)]',   text: 'text-white' },
          ].map(({ label, bg, text }) => (
            <div key={label} className="text-center">
              <div className={`h-20 rounded-lg mb-2 ${bg} flex items-center justify-center border border-[color:var(--border)]`}>
                <span className={`text-sm font-medium ${text}`}>{label}</span>
              </div>
              <p className="text-sm text-[color:var(--text-muted)] capitalize">{label}</p>
            </div>
          ))}
        </div>
        <p className="text-sm text-[color:var(--text-muted)] mt-4">
          Note: Each theme has its own token palette defined in CSS custom properties.
        </p>
      </div>
    </div>
  );
};
