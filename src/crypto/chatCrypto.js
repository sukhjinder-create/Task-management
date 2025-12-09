// src/crypto/chatCrypto.js

const E2E_VERSION = "e2e-p256-aesgcm-v1";

function bufToBase64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function base64ToBuf(str) {
  const bin = atob(str);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes.buffer;
}

const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

// ⚙️ Key generation: ECDH P-256
export async function generateUserKeyPair() {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    true,
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

  return { publicKeyJwk, privateKeyJwk };
}

// 🔐 local storage helpers
export function loadKeyPairFromStorage() {
  const raw = localStorage.getItem("chatKeyPair");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ✅ FIXED: enforce correct shape and parsing for public key
async function importPublicKey(publicKeyJwk) {
  if (!publicKeyJwk) {
    throw new Error("importPublicKey: no public key provided");
  }

  let jwk = publicKeyJwk;

  // convert string JSON → object
  if (typeof jwk === "string") {
    try {
      jwk = JSON.parse(jwk);
    } catch (err) {
      console.error("importPublicKey: failed JSON.parse", err, jwk);
      throw err;
    }
  }

  if (typeof jwk !== "object") {
    throw new Error("importPublicKey: invalid JWK (not object)");
  }

  return window.crypto.subtle.importKey(
    "jwk",
    jwk,
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    true,
    []
  );
}

// 🔑 private key importer unchanged except type-safety
async function importPrivateKey(privateKeyJwk) {
  if (!privateKeyJwk) throw new Error("Missing private key");
  return window.crypto.subtle.importKey(
    "jwk",
    privateKeyJwk,
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    false,
    ["deriveKey"]
  );
}

async function deriveAesKey(myPrivateKey, otherPublicKey) {
  return window.crypto.subtle.deriveKey(
    {
      name: "ECDH",
      public: otherPublicKey,
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

/**
 * Encrypt text for multiple recipients
 */
export async function encryptForRecipients(
  plainText,
  senderId,
  recipientIds,
  users
) {
  if (!plainText) return plainText;

  const keyPair = loadKeyPairFromStorage();
  if (!keyPair?.privateKeyJwk) {
    console.warn("encryptForRecipients: no local private key");
    return plainText;
  }

  const myPriv = await importPrivateKey(keyPair.privateKeyJwk);

  const uniqueRecipientIds = [
    ...new Set(recipientIds.filter(Boolean).map(String)),
  ];

  const enc = {};

  for (const rid of uniqueRecipientIds) {
    const user = users.find((u) => String(u.id) === String(rid));

    const pubJwk =
      user?.publicKeyJwk ||
      user?.public_key ||
      user?.publicKey ||
      user?.public_key_jwk;

    if (!pubJwk) {
      console.warn("No public key for user", rid);
      continue;
    }

    let recipPub;
    try {
      recipPub = await importPublicKey(pubJwk);
    } catch (err) {
      console.error("Bad public key for", rid, err);
      continue;
    }

    const aesKey = await deriveAesKey(myPriv, recipPub);

    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await window.crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv,
      },
      aesKey,
      TEXT_ENCODER.encode(plainText)
    );

    enc[String(rid)] = {
      iv: bufToBase64(iv),
      data: bufToBase64(ciphertext),
    };
  }

  if (!Object.keys(enc).length) {
    console.warn("encryptForRecipients: no recipients had keys → plaintext");
    return plainText;
  }

  return JSON.stringify({
    type: E2E_VERSION,
    from: String(senderId),
    enc,
  });
}

/**
 * Decrypt envelope if needed
 */
export async function decryptEnvelopeIfNeeded(
  textHtml,
  messageMeta,
  currentUserId,
  users
) {
  // Not a string or empty → nothing to do
  if (!textHtml || typeof textHtml !== "string") return textHtml;

  // Not JSON-looking → definitely not our envelope
  if (!textHtml.trim().startsWith("{")) return textHtml;

  let envelope;
  try {
    envelope = JSON.parse(textHtml);
  } catch {
    // Broken JSON: just show whatever is there
    return textHtml;
  }

  if (!envelope || envelope.type !== E2E_VERSION) return textHtml;

  const entry = envelope.enc?.[String(currentUserId)];
  if (!entry) {
    // Message was encrypted, but not for this user
    return "[Encrypted message (not for you)]";
  }

  const senderId =
    envelope.from || messageMeta?.userId || messageMeta?.user_id;

  // If we don’t have a users array, don’t crash
  if (!Array.isArray(users)) {
    console.warn(
      "[E2E] decryptEnvelopeIfNeeded: users array missing, returning placeholder"
    );
    return "[Encrypted message (missing sender key)]";
  }

  const senderUser = users.find((u) => String(u.id) === String(senderId));

  const senderPubJwk =
    senderUser?.publicKeyJwk ||
    senderUser?.public_key ||
    senderUser?.publicKey ||
    senderUser?.public_key_jwk;

  if (!senderPubJwk) {
    console.warn(
      "[E2E] decryptEnvelopeIfNeeded: no public key for sender",
      senderId
    );
    return "[Encrypted message (missing sender key)]";
  }

  const keyPair = loadKeyPairFromStorage();
  if (!keyPair?.privateKeyJwk) {
    console.warn("[E2E] decryptEnvelopeIfNeeded: no local private key");
    return "[Encrypted message (no your key)]";
  }

  try {
    const myPriv = await importPrivateKey(keyPair.privateKeyJwk);
    const senderPub = await importPublicKey(senderPubJwk);

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

    // If somehow we decoded to empty string, let caller fall back
    if (typeof decoded !== "string" || decoded.trim() === "") {
      return textHtml;
    }

    return decoded;
  } catch (err) {
    console.error("decrypt failed:", err);
    return "[Encrypted message (failed decryption)]";
  }
}
