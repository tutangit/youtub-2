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

    // Converte para ArrayBuffer se for Blob ou outro tipo
    let buffer;
    if (data instanceof Blob) {
        buffer = await data.arrayBuffer();
    } else if (data instanceof ArrayBuffer) {
        buffer = data;
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

    // Garante que são Uint8Arrays (importante para o IndexedDB)
    const iv = encryptedObj.iv instanceof Uint8Array ? encryptedObj.iv : new Uint8Array(Object.values(encryptedObj.iv));
    const data = encryptedObj.encryptedData instanceof Uint8Array ? encryptedObj.encryptedData : new Uint8Array(Object.values(encryptedObj.encryptedData));

    const decryptedContent = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key,
        data.buffer
    );

    return decryptedContent; // Retorna o ArrayBuffer puro
};
