import React, { useState } from "react";

const Transcriber = () => {
    const [transcription, setTranscription] = useState("");
    const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
    const [isPaused, setIsPaused] = useState<boolean>(false);

    const handleStartTranscribing = () => {
        setIsTranscribing(true);
        setTranscription("Started transcribing...");

        // Start capture audio from tab
        chrome.tabCapture.capture({ audio: true, video: false }, (stream) => {
            if (stream) {
                console.log("Tab audio stream started", stream);

                const mediaRecorder = new MediaRecorder(stream, {
                    mimeType: "audio/webm; codecs=opus",
                });

                mediaRecorder.ondataavailable = async (event) => {
                    if (event.data.size > 0) {
                        const formData = new FormData();
                        formData.append("audio", event.data, "chunk.webm");

                        try {
                            console.log(formData.get("audio"));
                            const response = await fetch(
                                "http://localhost:5000/transcribe",
                                {
                                    method: "POST",
                                    body: formData,
                                }
                            );
                            const data = await response.json();
                            console.log(data.transcript);
                            setTranscription(
                                (prev) => prev + "\n" + data.transcript
                            );
                        } catch (err) {
                            console.error("Transcription error: ", err);
                        }
                    }
                };

                mediaRecorder.start(2000);
            } else {
                console.error("Failed to capture tab audio");
            }
        });
    };

    const handleResumeTranscribing = () => {
        setIsTranscribing(true);
        setIsPaused(false);
        setTranscription("Resumed transcribing...");
    };

    const handlePauseTranscribing = () => {
        setIsTranscribing(false);
        setIsPaused(true);
        setTranscription("Paused transcribing...");
    };

    const handleStopTranscribing = () => {
        setIsTranscribing(false);
        setIsPaused(false);
        setTranscription("Stopped transcribing...");
    };

    return (
        <div className="w-full">
            {/* Transcription Text */}
            <div className="w-full flex justify-center">{transcription}</div>

            {/* Transcription Button Group */}
            <div className="w-full flex justify-between">
                {!isTranscribing && !isPaused ? (
                    <button
                        onClick={handleStartTranscribing}
                        className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-2 rounded-md"
                    >
                        Start
                    </button>
                ) : isPaused ? (
                    <button
                        onClick={handleResumeTranscribing}
                        className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-2 rounded-md"
                    >
                        Resume
                    </button>
                ) : (
                    <button
                        onClick={handlePauseTranscribing}
                        className="bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-2 px-2 rounded-md"
                    >
                        Pause
                    </button>
                )}
                <button
                    onClick={handleStopTranscribing}
                    className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-2 rounded-md"
                >
                    Stop
                </button>
            </div>
        </div>
    );
};

export default Transcriber;
