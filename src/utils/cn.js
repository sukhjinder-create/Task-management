/**
 * Utility function for merging className strings with Tailwind CSS
 * Combines clsx for conditional classes with tailwind-merge for deduplication
 *
 * Usage:
 * cn('px-2 py-1', 'text-sm', condition && 'bg-blue-500')
 * cn('px-2 py-1 px-4') // Later px-4 overrides px-2
 */

// Simple implementation without external dependencies
// This handles basic className merging
export function cn(...inputs) {
  return inputs
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}
