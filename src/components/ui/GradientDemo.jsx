import React from 'react';
import { Button } from './Button';

export const GradientDemo = () => {
  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-8 text-center">Gradient Color Showcase</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
        {/* Primary Gradient */}
        <div className="p-6 rounded-xl border theme-border">
          <h2 className="text-xl font-semibold mb-4">Primary Gradient</h2>
          <div className="gradient-primary h-32 rounded-lg mb-4 flex items-center justify-center">
            <span className="text-white font-medium">from-[var(--gradient-from)] to-[var(--gradient-to)]</span>
          </div>
          <p className="text-sm theme-text-muted mb-4">
            Used for primary buttons, important actions, and highlights.
          </p>
          <Button variant="primary">Primary Gradient Button</Button>
        </div>

        {/* Subtle Gradient */}
        <div className="p-6 rounded-xl border theme-border">
          <h2 className="text-xl font-semibold mb-4">Subtle Gradient</h2>
          <div className="gradient-subtle h-32 rounded-lg mb-4 flex items-center justify-center">
            <span className="theme-text font-medium">from-[var(--gradient-subtle-from)] to-[var(--gradient-subtle-to)]</span>
          </div>
          <p className="text-sm theme-text-muted mb-4">
            Used for subtle backgrounds, cards, and non-intrusive elements.
          </p>
          <div className="gradient-subtle p-4 rounded-lg">
            <p className="theme-text">This is a subtle gradient background</p>
          </div>
        </div>

        {/* Card Gradient */}
        <div className="p-6 rounded-xl border theme-border">
          <h2 className="text-xl font-semibold mb-4">Card Gradient</h2>
          <div className="gradient-card h-32 rounded-lg mb-4 flex items-center justify-center">
            <span className="theme-text font-medium">from-[var(--gradient-card-from)] to-[var(--gradient-card-to)]</span>
          </div>
          <p className="text-sm theme-text-muted mb-4">
            Used for card backgrounds with a soft vertical gradient.
          </p>
          <div className="gradient-card p-6 rounded-xl shadow-sm">
            <h3 className="font-medium mb-2">Card Title</h3>
            <p className="text-sm theme-text-muted">This card uses a vertical gradient background.</p>
          </div>
        </div>

        {/* Sidebar Gradient */}
        <div className="p-6 rounded-xl border theme-border">
          <h2 className="text-xl font-semibold mb-4">Sidebar Gradient</h2>
          <div className="gradient-sidebar h-32 rounded-lg mb-4 flex items-center justify-center">
            <span className="theme-text font-medium">from-[var(--gradient-sidebar-from)] to-[var(--gradient-sidebar-to)]</span>
          </div>
          <p className="text-sm theme-text-muted mb-4">
            Used for sidebar backgrounds with a vertical gradient.
          </p>
          <div className="gradient-sidebar p-4 rounded-lg">
            <p className="theme-text">Sidebar navigation background</p>
          </div>
        </div>
      </div>

      {/* Premium Gradient Showcase */}
      <div className="mb-12">
        <h2 className="text-2xl font-bold mb-6">Premium Gradient Variants</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {/* Premium Gradient */}
          <div className="p-6 rounded-xl border theme-border">
            <h2 className="text-xl font-semibold mb-4">Premium Gradient</h2>
            <div className="gradient-premium h-32 rounded-lg mb-4 flex items-center justify-center">
              <span className="text-white font-medium">Multi-stop 135° gradient</span>
            </div>
            <p className="text-sm theme-text-muted mb-4">
              Premium multi-stop gradient with white highlights for extra depth.
            </p>
            <Button variant="premium">Premium Gradient Button</Button>
          </div>

          {/* Shimmer Gradient */}
          <div className="p-6 rounded-xl border theme-border">
            <h2 className="text-xl font-semibold mb-4">Shimmer Gradient</h2>
            <div className="gradient-shimmer h-32 rounded-lg mb-4 flex items-center justify-center">
              <span className="text-white font-medium">Animated shimmer effect</span>
            </div>
            <p className="text-sm theme-text-muted mb-4">
              Animated gradient with subtle shimmer effect for attention.
            </p>
            <Button variant="shimmer">Shimmer Button</Button>
          </div>

          {/* Radial Gradient */}
          <div className="p-6 rounded-xl border theme-border">
            <h2 className="text-xl font-semibold mb-4">Radial Gradient</h2>
            <div className="gradient-radial h-32 rounded-lg mb-4 flex items-center justify-center">
              <span className="theme-text font-medium">Radial spotlight effect</span>
            </div>
            <p className="text-sm theme-text-muted mb-4">
              Radial gradient for spotlight effects and focal points.
            </p>
            <div className="gradient-radial p-6 rounded-lg">
              <p className="theme-text">Radial gradient background</p>
            </div>
          </div>

          {/* Gradient Overlay */}
          <div className="p-6 rounded-xl border theme-border">
            <h2 className="text-xl font-semibold mb-4">Gradient Overlay</h2>
            <div className="gradient-overlay h-32 rounded-lg mb-4 flex items-center justify-center relative theme-surface">
              <span className="theme-text font-medium z-10">Overlay on surface</span>
            </div>
            <p className="text-sm theme-text-muted mb-4">
              Subtle gradient overlay for depth without changing base color.
            </p>
            <div className="gradient-overlay p-4 rounded-lg theme-surface relative">
              <p className="theme-text z-10">Content with gradient overlay</p>
            </div>
          </div>
        </div>
      </div>

      {/* Button Variants */}
      <div className="mb-12">
        <h2 className="text-2xl font-bold mb-6">Gradient Button Variants</h2>
        <div className="flex flex-wrap gap-4">
          <Button variant="primary">Primary Gradient</Button>
          <Button variant="premium">Premium Gradient</Button>
          <Button variant="shimmer">Shimmer Gradient</Button>
          <Button variant="danger">Danger Gradient</Button>
          <Button variant="success">Success Gradient</Button>
          <Button variant="secondary">Secondary (No Gradient)</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="outline">Outline</Button>
        </div>
      </div>

      {/* Theme Examples */}
      <div>
        <h2 className="text-2xl font-bold mb-6">Gradient Across Themes</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {['light', 'dark', 'ocean', 'forest', 'sunset', 'yellow'].map((theme) => (
            <div key={theme} className="text-center">
              <div 
                className={`h-20 rounded-lg mb-2 gradient-primary flex items-center justify-center`}
                data-theme={theme}
              >
                <span className="text-white text-sm font-medium">{theme}</span>
              </div>
              <p className="text-sm capitalize">{theme}</p>
            </div>
          ))}
        </div>
        <p className="text-sm theme-text-muted mt-4">
          Note: Each theme has its own gradient color palette defined in CSS variables.
        </p>
      </div>
    </div>
  );
};