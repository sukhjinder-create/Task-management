import { cn } from '../../utils/cn';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

function resolveAvatarUrl(src) {
  if (!src) return null;
  if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('blob:') || src.startsWith('data:')) return src;
  return `${BACKEND_URL}${src}`;
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

  return (
    <div className={cn('relative inline-block', className)} {...props}>
      <div
        className={cn(
          'rounded-full overflow-hidden bg-primary-100 text-primary-700',
          'flex items-center justify-center font-medium',
          avatarSizes[size]
        )}
      >
        {resolvedSrc ? (
          <img
            src={resolvedSrc}
            alt={alt || name}
            className="w-full h-full object-cover"
            onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }}
          />
        ) : null}
        <span style={{ display: resolvedSrc ? 'none' : 'flex' }} className="w-full h-full items-center justify-center">
          {initials}
        </span>
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
