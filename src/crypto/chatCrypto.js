// src/crypto/chatCrypto.js

// Single version flag for our envelope
export const E2E_VERSION = "e2e-p256-aesgcm-v1";

const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

// ---------- helpers ----------

function bufToBase64(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin);
}

function base64ToBuf(b64) {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    arr[i] = bin.charCodeAt(i);
  }
  return arr;
}

export function loadKeyPairFromStorage() {
  try {
    const raw = localStorage.getItem("chatKeyPair");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.error("[E2E] Failed to load keypair from storage:", err);
    return null;
  }
}

function saveKeyPairToStorage(obj) {
  try {
    localStorage.setItem("chatKeyPair", JSON.stringify(obj));
  } catch (err) {
    console.error("[E2E] Failed to save keypair to storage:", err);
  }
}

// ---------- key generation / import ----------

export async function generateUserKeyPair() {
  if (!window.crypto?.subtle) {
    throw new Error("WebCrypto not available");
  }

  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    true, // extractable
    ["deriveKey", "deriveBits"]
  );

  const publicKeyJwk = await window.crypto.subtle.exportKey(
    "jwk",
    keyPair.publicKey
  );
  const privateKeyJwk = await window.crypto.subtle.exportKey(
    "jwk",
    keyPair.privateKey
  );

  const payload = { publicKeyJwk, privateKeyJwk };
  saveKeyPairToStorage(payload);
  return payload;
}

export async function importPublicKey(jwk) {
  if (!jwk) throw new Error("Missing public JWK");
  return window.crypto.subtle.importKey(
    "jwk",
    jwk,
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    true,
    [] // public key has no usages in ECDH
  );
}

export async function importPrivateKey(jwk) {
  if (!jwk) throw new Error("Missing private JWK");
  return window.crypto.subtle.importKey(
    "jwk",
    jwk,
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    false,
    ["deriveKey", "deriveBits"]
  );
}

async function deriveAesKey(myPrivateKey, theirPublicKey) {
  return window.crypto.subtle.deriveKey(
    {
      name: "ECDH",
      public: theirPublicKey,
    },
    myPrivateKey,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"]
  );
}

// ---------- ENCRYPT ----------

/**
 * Encrypt a plaintext HTML string for a set of user IDs.
 *
 * @param {string} plainHtml
 * @param {string} senderId
 * @param {string[]} recipientIds - MUST include senderId so sender can read own messages
 * @param {Array} usersWithKeys - [{id, username, publicKeyJwk}, ...]
 * @returns {Promise<string>} JSON string envelope
 */

// chatCrypto.js

export async function encryptForRecipients(
  plainHtml,
  senderId,
  recipientIds,
  usersWithKeys
) {
  // Nothing to encrypt
  if (!plainHtml || typeof plainHtml !== "string" || !plainHtml.trim()) {
    return plainHtml;
  }

  const senderIdStr = String(senderId);

  // Make sure sender is in the recipient list
  const uniqueIds = Array.from(
    new Set(
      [...(recipientIds || []), senderIdStr].map((id) => String(id))
    )
  );

  // Load my own keypair (created in Chat.jsx and stored in localStorage)
  const keyPair = loadKeyPairFromStorage();
  if (!keyPair?.privateKeyJwk || !keyPair?.publicKeyJwk) {
    console.warn("[E2E] No local keypair, sending plaintext instead");
    return plainHtml;
  }

  // Build map: userId -> publicKeyJwk (from /crypto/public-keys)
  const keyById = new Map();
  (usersWithKeys || []).forEach((u) => {
    if (!u || !u.id) return;
    const raw =
      u.publicKeyJwk ||
      u.public_key ||
      u.publicKey ||
      u.public_key_jwk ||
      null;
    if (raw) {
      keyById.set(String(u.id), raw);
    }
  });

  // Ensure we always have sender's public key in the map
  keyById.set(senderIdStr, keyPair.publicKeyJwk);

  // Encrypt for anyone we *do* have a public key for.
  // Users without a key will read from fallbackText later.
  const recipients = [];
  for (const id of uniqueIds) {
    const jwk = keyById.get(id);
    if (!jwk) {
      console.warn("[E2E] No public key for recipient", id);
      continue;
    }
    recipients.push({ id, publicKeyJwk: jwk });
  }

  if (recipients.length === 0) {
    console.warn("[E2E] No recipients had public keys; sending plaintext");
    return plainHtml;
  }

  const myPriv = await importPrivateKey(keyPair.privateKeyJwk);

  const enc = {};
  for (const r of recipients) {
    const recipPub =
      typeof r.publicKeyJwk === "string"
        ? await importPublicKey(JSON.parse(r.publicKeyJwk))
        : await importPublicKey(r.publicKeyJwk);

    const aesKey = await deriveAesKey(myPriv, recipPub);

    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const cipherBuf = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      aesKey,
      TEXT_ENCODER.encode(plainHtml)
    );

    enc[String(r.id)] = {
      iv: bufToBase64(iv),
      data: bufToBase64(new Uint8Array(cipherBuf)),
    };
  }

  // 🔑 ALWAYS embed the sender's public key from local keyPair
  const envelope = {
    type: E2E_VERSION,
    from: senderIdStr,
    fromPublicKeyJwk: keyPair.publicKeyJwk, // <— key for everyone to use
    enc,
    // 🔥 CRITICAL: plaintext backup so nobody ever sees JSON
    fallbackText: plainHtml,
  };

  return JSON.stringify(envelope);
}


// ---------- DECRYPT ----------

/**
 * Try to decrypt an envelope if it's in our E2E format.
 * Otherwise, return the input textHtml unchanged.
 *
 * @param {string} textHtml - raw DB text_html field
 * @param {object} messageMeta - full message row from server
 * @param {string} currentUserId
 * @param {Array} users - usersWithKeys from Chat.jsx
 * @returns {Promise<string>}
 */
// chatCrypto.js

export async function decryptEnvelopeIfNeeded(
  textHtml,
  messageMeta,
  currentUserId,
  users
) {
  // Not a string or empty → nothing to do
  if (!textHtml || typeof textHtml !== "string") return textHtml;

  const trimmed = textHtml.trim();
  if (!trimmed.startsWith("{")) return textHtml;

  let envelope;
  try {
    envelope = JSON.parse(trimmed);
  } catch {
    // Broken JSON: show whatever is there
    return textHtml;
  }

  if (!envelope || envelope.type !== E2E_VERSION) return textHtml;

  const currentIdStr = String(currentUserId);
  const senderId =
    envelope.from ||
    messageMeta?.userId ||
    messageMeta?.user_id ||
    null;

  // Plaintext fallback if anything goes bad
  const fallbackPlain =
    typeof envelope.fallbackText === "string" &&
    envelope.fallbackText.trim() !== ""
      ? envelope.fallbackText
      : textHtml;

  // There might not even be an encrypted entry for this user
  const entry = envelope.enc?.[currentIdStr];
  if (!entry) {
    console.warn(
      "[E2E] No encrypted payload for this user; using fallback"
    );
    return fallbackPlain;
  }

  // Figure out sender public key
  let senderPubJwk =
    envelope.fromPublicKeyJwk !== undefined
      ? envelope.fromPublicKeyJwk
      : null;

  // If not in envelope, try /crypto/public-keys data
  if (!senderPubJwk && Array.isArray(users)) {
    const senderUser = users.find(
      (u) => String(u.id) === String(senderId)
    );
    senderPubJwk =
      senderUser?.publicKeyJwk ||
      senderUser?.public_key ||
      senderUser?.publicKey ||
      senderUser?.public_key_jwk ||
      null;
  }

  // If still nothing and it's *our own* message, use our local keyPair
  if (!senderPubJwk && senderId && String(senderId) === currentIdStr) {
    const keyPair = loadKeyPairFromStorage();
    if (keyPair?.publicKeyJwk) {
      senderPubJwk = keyPair.publicKeyJwk;
    }
  }

  if (!senderPubJwk) {
    console.warn(
      "[E2E] decryptEnvelopeIfNeeded: no sender pub key, using fallback"
    );
    return fallbackPlain;
  }

  // We need our private key to decrypt
  const keyPair = loadKeyPairFromStorage();
  if (!keyPair?.privateKeyJwk) {
    console.warn(
      "[E2E] decryptEnvelopeIfNeeded: no local private key, using fallback"
    );
    return fallbackPlain;
  }

  try {
    const myPriv = await importPrivateKey(keyPair.privateKeyJwk);

    const senderPub =
      typeof senderPubJwk === "string"
        ? await importPublicKey(JSON.parse(senderPubJwk))
        : await importPublicKey(senderPubJwk);

    const aesKey = await deriveAesKey(myPriv, senderPub);

    const iv = base64ToBuf(entry.iv);
    const data = base64ToBuf(entry.data);

    const plainBuf = await window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: new Uint8Array(iv),
      },
      aesKey,
      data
    );

    const decoded = TEXT_DECODER.decode(plainBuf);
    if (!decoded || !decoded.trim()) {
      return fallbackPlain;
    }

    return decoded;
  } catch (err) {
    console.warn(
      "[E2E] decryptEnvelopeIfNeeded: decrypt failed, falling back in UI",
      err
    );
    return fallbackPlain;
  }
}
