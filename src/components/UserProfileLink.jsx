import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Avatar } from "./ui";
import { cn } from "../utils/cn";
import { getUserProfilePath } from "../utils/userProfiles";

export default function UserProfileLink({
  userId,
  username,
  avatarUrl,
  showAvatar = false,
  hideName = false,
  avatarSize = "sm",
  className,
  nameClassName,
  title,
  stopPropagation = false,
  children,
}) {
  const { auth } = useAuth();
  const profilePath = getUserProfilePath(userId, auth.user?.id);

  const handleClick = stopPropagation
    ? (event) => event.stopPropagation()
    : undefined;

  const content = children || (
    <>
      {showAvatar ? <Avatar name={username || "User"} src={avatarUrl} size={avatarSize} /> : null}
      {!hideName ? (
        <span className={cn("truncate", nameClassName)}>
          {username || "Unknown user"}
        </span>
      ) : null}
    </>
  );

  if (!profilePath) {
    return (
      <span className={className} onClick={handleClick}>
        {content}
      </span>
    );
  }

  return (
    <Link
      to={profilePath}
      title={title || (username ? `Open ${username}'s profile` : "Open user profile")}
      className={cn(
        "inline-flex items-center gap-2 transition-colors hover:text-[var(--primary,#2563eb)]",
        className
      )}
      onClick={handleClick}
    >
      {content}
    </Link>
  );
}
