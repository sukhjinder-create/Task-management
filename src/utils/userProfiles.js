const USERNAME_MENTION_REGEX = /@([a-zA-Z0-9_.-]+)/g;

export function normalizeUsernameKey(username) {
  return String(username || "").trim().toLowerCase();
}

export function buildUserLookup(users = []) {
  return (users || []).reduce((acc, user) => {
    const key = normalizeUsernameKey(user?.username);
    if (key) acc[key] = user;
    return acc;
  }, {});
}

export function getUserProfilePath(userId, currentUserId) {
  if (!userId) return null;
  return String(userId) === String(currentUserId || "")
    ? "/profile"
    : `/users/${encodeURIComponent(userId)}/profile`;
}

export function linkifyUserMentionsInHtml(html, usersByUsername = {}, currentUserId) {
  if (!html || typeof DOMParser === "undefined" || typeof document === "undefined") {
    return html;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstElementChild;
  if (!root || typeof doc.createTreeWalker !== "function") return html;

  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  let currentNode = walker.nextNode();

  while (currentNode) {
    textNodes.push(currentNode);
    currentNode = walker.nextNode();
  }

  textNodes.forEach((textNode) => {
    const parentTag = textNode.parentElement?.tagName;
    if (parentTag === "A" || parentTag === "SCRIPT" || parentTag === "STYLE") {
      return;
    }

    const text = textNode.textContent || "";
    USERNAME_MENTION_REGEX.lastIndex = 0;
    if (!USERNAME_MENTION_REGEX.test(text)) {
      return;
    }

    USERNAME_MENTION_REGEX.lastIndex = 0;
    let match;
    let lastIndex = 0;
    const fragment = doc.createDocumentFragment();

    while ((match = USERNAME_MENTION_REGEX.exec(text)) !== null) {
      const [fullMatch, rawUsername] = match;
      const mentionStart = match.index;
      const mentionEnd = mentionStart + fullMatch.length;
      const linkedUser = usersByUsername[normalizeUsernameKey(rawUsername)];

      if (mentionStart > lastIndex) {
        fragment.appendChild(doc.createTextNode(text.slice(lastIndex, mentionStart)));
      }

      if (linkedUser?.id) {
        const anchor = doc.createElement("a");
        anchor.href = getUserProfilePath(linkedUser.id, currentUserId);
        anchor.className = "text-[var(--primary,#2563eb)] font-medium hover:underline";
        anchor.textContent = fullMatch;
        fragment.appendChild(anchor);
      } else {
        fragment.appendChild(doc.createTextNode(fullMatch));
      }

      lastIndex = mentionEnd;
    }

    if (lastIndex < text.length) {
      fragment.appendChild(doc.createTextNode(text.slice(lastIndex)));
    }

    textNode.parentNode?.replaceChild(fragment, textNode);
  });

  return root.innerHTML;
}
