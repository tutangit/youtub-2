const ALGORITHM = 'AES-GCM';
const KEY_NAME = 'music_player_secret_key';

/**
 * Generates or retrieves a persistent symmetric key for AES-GCM.
 * We store the key in IndexedDB for persistence across sessions, 
 * or as a simpler first step, we recreate it if lost (which would break old data).
 * For a production app, we'd use a master password or PBKDF2.
 */
export async function getEncryptionKey() {
    const storedKey = localStorage.getItem(KEY_NAME);
    if (storedKey) {
        const rawKey = Uint8Array.from(atob(storedKey), c => c.charCodeAt(0));
        return await crypto.subtle.importKey(
            'raw',
            rawKey,
            ALGORITHM,
            true,
            ['encrypt', 'decrypt']
        );
    }

    const key = await crypto.subtle.generateKey(
        { name: ALGORITHM, length: 256 },
        true,
        ['encrypt', 'decrypt']
    );

    const exportedKey = await crypto.subtle.exportKey('raw', key);
    const base64Key = btoa(String.fromCharCode(...new Uint8Array(exportedKey)));
    localStorage.setItem(KEY_NAME, base64Key);

    return key;
}

/**
 * Encrypts a File/Blob using AES-GCM.
 */
export async function encryptData(data) {
    const key = await getEncryptionKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encodedContent = await data.arrayBuffer();

    const encryptedContent = await crypto.subtle.encrypt(
        { name: ALGORITHM, iv },
        key,
        encodedContent
    );

    // Combine IV and Encrypted Content
    const combined = new Uint8Array(iv.length + encryptedContent.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encryptedContent), iv.length);

    return combined;
}

/**
 * Decrypts a combined ArrayBuffer (IV + EncryptedContent) using AES-GCM.
 */
export async function decryptData(combinedArray) {
    const key = await getEncryptionKey();
    const iv = combinedArray.slice(0, 12);
    const encryptedContent = combinedArray.slice(12);

    const decryptedContent = await crypto.subtle.decrypt(
        { name: ALGORITHM, iv },
        key,
        encryptedContent
    );

    return new Blob([decryptedContent], { type: 'audio/mpeg' });
}
