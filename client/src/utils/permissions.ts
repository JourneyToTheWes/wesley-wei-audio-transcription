export const requestMicrophonePermission = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
        });
        console.log("Microphone access granted:", stream);
        return true;
    } catch (err) {
        console.error("Microphone access denied:", err);
        return false;
    }
};
