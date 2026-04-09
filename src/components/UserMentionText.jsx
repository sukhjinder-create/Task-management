import { Fragment } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { cn } from "../utils/cn";
import { getUserProfilePath, normalizeUsernameKey } from "../utils/userProfiles";

const USERNAME_MENTION_REGEX = /@([a-zA-Z0-9_.-]+)/g;

export default function UserMentionText({ text, usersByUsername = {}, className }) {
  const { auth } = useAuth();
  const value = String(text || "");
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = USERNAME_MENTION_REGEX.exec(value)) !== null) {
    const [fullMatch, rawUsername] = match;
    const mentionStart = match.index;
    const mentionEnd = mentionStart + fullMatch.length;
    const linkedUser = usersByUsername[normalizeUsernameKey(rawUsername)];
    const profilePath = linkedUser?.id ? getUserProfilePath(linkedUser.id, auth.user?.id) : null;

    if (mentionStart > lastIndex) {
      parts.push(value.slice(lastIndex, mentionStart));
    }

    if (profilePath) {
      parts.push(
        <Link
          key={`${rawUsername}-${mentionStart}`}
          to={profilePath}
          className="font-medium text-[var(--primary,#2563eb)] hover:underline"
        >
          {fullMatch}
        </Link>
      );
    } else {
      parts.push(fullMatch);
    }

    lastIndex = mentionEnd;
  }

  if (lastIndex < value.length) {
    parts.push(value.slice(lastIndex));
  }

  return (
    <span className={cn(className)}>
      {parts.map((part, index) => (
        <Fragment key={index}>{part}</Fragment>
      ))}
    </span>
  );
}
