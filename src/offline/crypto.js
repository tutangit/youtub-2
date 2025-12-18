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

    // Converte qualquer entrada para ArrayBuffer
    let buffer;
    if (data instanceof Blob) {
        buffer = await data.arrayBuffer();
    } else if (data instanceof ArrayBuffer) {
        buffer = data;
    } else if (ArrayBuffer.isView(data)) {
        buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    } else {
        buffer = new Uint8Array(data).buffer;
    }

    const encryptedContent = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        buffer
    );

    return {
        iv: iv,
        encryptedData: new Uint8Array(encryptedContent)
    };
};

export const decryptData = async (encryptedObj) => {
    const key = await getEncryptionKey();

    // Suporte para quando os dados vêm do IndexedDB (podem ser objetos puros)
    const iv = encryptedObj.iv instanceof Uint8Array ? encryptedObj.iv : new Uint8Array(Object.values(encryptedObj.iv));
    const encryptedData = encryptedObj.encryptedData instanceof Uint8Array ? encryptedObj.encryptedData : new Uint8Array(Object.values(encryptedObj.encryptedData));

    const decryptedContent = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key,
        encryptedData
    );

    return decryptedContent;
};
