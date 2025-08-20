import React, { useState, useEffect } from "react";

interface IMicrophoneSelector {
    onMicrophoneChange: (microphoneDeviceId: string) => unknown;
}

const MicrophoneSelector: React.FC<IMicrophoneSelector> = ({
    onMicrophoneChange,
}) => {
    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState("default");

    useEffect(() => {
        const getDevices = async () => {
            const deviceInfos = await navigator.mediaDevices.enumerateDevices();
            const audioDevices = deviceInfos.filter(
                (device) => device.kind === "audioinput"
            );
            setDevices(audioDevices);
        };

        // Fetch audio input devices
        getDevices();
    }, []);

    const handleDeviceChange = (
        event: React.ChangeEvent<HTMLSelectElement>
    ) => {
        const selectedDeviceId = event.target.value;
        setSelectedDeviceId(selectedDeviceId);
        onMicrophoneChange(selectedDeviceId);
    };

    return (
        <div className="w-full">
            <h3>Select Microphone:</h3>
            <select
                className="bg-neutral-600 text-white w-full"
                onChange={handleDeviceChange}
                value={selectedDeviceId}
            >
                <option value="default">
                    Original Microphone Selection via Chrome Extension
                    Permission
                </option>
                {devices.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                        {device.label || `Microphone ${device.deviceId}`}
                    </option>
                ))}
            </select>
        </div>
    );
};

export default MicrophoneSelector;
