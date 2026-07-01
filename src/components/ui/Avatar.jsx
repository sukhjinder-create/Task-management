import { cn } from '../../utils/cn';
import { API_BASE_URL } from '../../api';
import { useState, useEffect } from 'react';

const BACKEND_URL = API_BASE_URL || 'http://localhost:5000';

function resolveAvatarUrl(src) {
  if (!src) return null;
  if (src.startsWith('http://localhost') || src.startsWith('http://127.0.0.1')) {
    const path = src.replace(/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?/, '');
    return `${BACKEND_URL}${path}`;
  }
  if (
    src.startsWith('http://') ||
    src.startsWith('https://') ||
    src.startsWith('blob:') ||
    src.startsWith('data:')
  ) return src;
  return `${BACKEND_URL}${src}`;
}

function useFetchedImage(resolvedSrc) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!resolvedSrc) {
      setBlobUrl(null);
      setFailed(false);
      return;
    }
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
        if (active) {
          setBlobUrl(null);
          setFailed(true);
        }
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [resolvedSrc]);

  return { blobUrl, failed };
}

export function FetchImg({ src, alt, className }) {
  const { blobUrl, failed } = useFetchedImage(src);
  if (!blobUrl || failed) return null;
  return <img src={blobUrl} alt={alt} className={className} />;
}

const avatarSizes = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-7 h-7 text-xs',
  md: 'w-8 h-8 text-xs',
  lg: 'w-10 h-10 text-sm',
  xl: 'w-14 h-14 text-base',
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

// Deterministic muted background per username so colleagues are
// recognizable in tight spaces without going neon.
function hueFromName(name) {
  if (!name) return 24;
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

export function Avatar({ name, src, alt, size = 'md', status, className, ...props }) {
  const initials = getInitials(name || alt);
  const resolvedSrc = resolveAvatarUrl(src);
  const { blobUrl, failed } = useFetchedImage(resolvedSrc);
  const showImage = blobUrl && !failed;

  const hue = hueFromName(name);
  const fallbackStyle = !showImage
    ? {
        background: `hsl(${hue} 55% 22%)`,
        color: `hsl(${hue} 90% 78%)`,
      }
    : undefined;

  return (
    <div className={cn('relative inline-block', className)} {...props}>
      <div
        className={cn(
          "rounded-full overflow-hidden flex items-center justify-center font-semibold tracking-tight",
          "ring-1 ring-[color:var(--border)]",
          avatarSizes[size]
        )}
        style={fallbackStyle}
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

      {status && (
        <span
          className={cn(
            "absolute bottom-0 right-0 block rounded-full ring-2 ring-[var(--app-bg)]",
            size === 'xs' && 'w-1.5 h-1.5',
            size === 'sm' && 'w-2   h-2',
            size === 'md' && 'w-2   h-2',
            size === 'lg' && 'w-2.5 h-2.5',
            size === 'xl' && 'w-3   h-3',
            status === 'online'  && 'bg-[color:var(--score-good)]',
            status === 'offline' && 'bg-[color:var(--text-soft)]',
            status === 'away'    && 'bg-[color:var(--score-warning)]',
            status === 'busy'    && 'bg-[color:var(--score-danger)]'
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
    <div className={cn('flex -space-x-1.5', className)}>
      {displayUsers.map((user, index) => (
        <Avatar
          key={index}
          name={user.name || user.username}
          src={user.avatar_url || user.avatar || user.profilePicture}
          size={size}
          className="ring-2 ring-[var(--app-bg)] rounded-full"
        />
      ))}
      {remaining > 0 && (
        <div
          className={cn(
            "rounded-full bg-[var(--surface-soft)] text-[color:var(--text-muted)]",
            "flex items-center justify-center font-semibold ring-2 ring-[var(--app-bg)]",
            "border border-[color:var(--border)]",
            avatarSizes[size]
          )}
        >
          +{remaining}
        </div>
      )}
    </div>
  );
}
