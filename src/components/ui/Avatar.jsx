import { cn } from '../../utils/cn';
import { API_BASE_URL } from '../../api';
import { useState, useEffect } from 'react';

const BACKEND_URL = API_BASE_URL || import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

function resolveAvatarUrl(src) {
  if (!src) return null;
  // On mobile, localhost refers to the device itself — remap to configured backend
  if (src.startsWith('http://localhost') || src.startsWith('http://127.0.0.1')) {
    const path = src.replace(/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?/, '');
    return `${BACKEND_URL}${path}`;
  }
  if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('blob:') || src.startsWith('data:')) return src;
  return `${BACKEND_URL}${src}`;
}

// Fetches image via JS fetch (Capacitor-intercepted, same network stack as API calls).
// Falls back to direct URL if fetch fails (e.g. web browser with CORS).
function useFetchedImage(resolvedSrc) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!resolvedSrc) { setBlobUrl(null); setFailed(false); return; }
    let active = true;
    let objectUrl = null;

    fetch(resolvedSrc)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.blob();
      })
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
        setFailed(false);
      })
      .catch(() => {
        if (active) { setBlobUrl(null); setFailed(true); }
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [resolvedSrc]);

  return { blobUrl, failed };
}

// Drop-in <img> replacement that loads via fetch (works in Capacitor WebView).
// Shows nothing while loading; caller is responsible for fallback UI.
export function FetchImg({ src, alt, className }) {
  const { blobUrl, failed } = useFetchedImage(src);
  if (!blobUrl || failed) return null;
  return <img src={blobUrl} alt={alt} className={className} />;
}

const avatarSizes = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-12 h-12 text-lg',
  xl: 'w-16 h-16 text-2xl',
};

function getInitials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function Avatar({ name, src, alt, size = 'md', status, className, ...props }) {
  const initials = getInitials(name || alt);
  const resolvedSrc = resolveAvatarUrl(src);
  const { blobUrl, failed } = useFetchedImage(resolvedSrc);

  const showImage = blobUrl && !failed;

  return (
    <div className={cn('relative inline-block', className)} {...props}>
      <div
        className={cn(
          'rounded-full overflow-hidden bg-primary-100 text-primary-700',
          'flex items-center justify-center font-medium',
          avatarSizes[size]
        )}
      >
        {showImage ? (
          <img
            src={blobUrl}
            alt={alt || name}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="w-full h-full flex items-center justify-center">
            {initials}
          </span>
        )}
      </div>

      {/* Status indicator */}
      {status && (
        <span
          className={cn(
            'absolute bottom-0 right-0 block rounded-full ring-2 ring-white',
            size === 'xs' && 'w-1.5 h-1.5',
            size === 'sm' && 'w-2 h-2',
            size === 'md' && 'w-2.5 h-2.5',
            size === 'lg' && 'w-3 h-3',
            size === 'xl' && 'w-4 h-4',
            status === 'online' && 'bg-success-500',
            status === 'offline' && 'bg-gray-400',
            status === 'away' && 'bg-warning-500',
            status === 'busy' && 'bg-danger-500'
          )}
        />
      )}
    </div>
  );
}

export function AvatarGroup({ users = [], max = 3, size = 'md', className }) {
  const displayUsers = users.slice(0, max);
  const remaining = users.length - max;

  return (
    <div className={cn('flex -space-x-2', className)}>
      {displayUsers.map((user, index) => (
        <Avatar
          key={index}
          name={user.name || user.username}
          src={user.avatar_url || user.avatar || user.profilePicture}
          size={size}
          className="ring-2 ring-white"
        />
      ))}
      {remaining > 0 && (
        <div
          className={cn(
            'rounded-full bg-gray-200 text-gray-600',
            'flex items-center justify-center font-medium ring-2 ring-white',
            avatarSizes[size]
          )}
        >
          +{remaining}
        </div>
      )}
    </div>
  );
}
