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
            console.log("getting audio from tab");
            if (stream) {
                console.log("Tab audio stream started", stream);
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
