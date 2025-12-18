export const getEncryptionKey = async () => {
    let keyData = localStorage.getItem('music_key');
    if (!keyData) {
        const key = await window.crypto.subtle.generateKey(
            { name: "AES-GCM", length: 256 },
            true,
            ["encrypt", "decrypt"]
        );
        const exported = await window.crypto.subtle.exportKey("jwk", key);
        localStorage.setItem('music_key', JSON.stringify(exported));
        return key;
    }
    return await window.crypto.subtle.importKey(
        "jwk",
        JSON.parse(keyData),
        { name: "AES-GCM" },
        true,
        ["encrypt", "decrypt"]
    );
};

export const encryptData = async (data) => {
    const key = await getEncryptionKey();
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    // Suporta tanto ArrayBuffer quanto Uint8Array
    const dataToEncrypt = data instanceof Uint8Array ? data : new Uint8Array(data);

    const encryptedContent = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        dataToEncrypt
    );

    // Retorna um objeto com os buffers originais (mais eficiente)
    return {
        iv: iv,
        encryptedData: new Uint8Array(encryptedContent)
    };
};

export const decryptData = async (encryptedObj) => {
    const key = await getEncryptionKey();

    // Reconverte para os tipos corretos caso venham do IndexedDB
    const iv = encryptedObj.iv instanceof Uint8Array ? encryptedObj.iv : new Uint8Array(encryptedObj.iv);
    const data = encryptedObj.encryptedData instanceof Uint8Array ? encryptedObj.encryptedData : new Uint8Array(encryptedObj.encryptedData);

    const decryptedContent = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key,
        data
    );

    return new Uint8Array(decryptedContent);
};
