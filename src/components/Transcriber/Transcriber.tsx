import React, { useState } from "react";

const Transcriber = () => {
    const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
    const [isPaused, setIsPaused] = useState<boolean>(false);

    const handleResumeTranscription = () => {
        setIsTranscribing(true);
        setIsPaused(false);
    };

    const handlePauseTranscription = () => {
        setIsTranscribing(false);
        setIsPaused(true);
    };

    const handleStopTranscription = () => {
        setIsTranscribing(false);
        setIsPaused(false);
    };

    return (
        <div className="w-full flex justify-between">
            {!isTranscribing && !isPaused ? (
                <button
                    onClick={() => setIsTranscribing(true)}
                    className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-2 rounded-md"
                >
                    Start
                </button>
            ) : isPaused ? (
                <button
                    onClick={handleResumeTranscription}
                    className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-2 rounded-md"
                >
                    Resume
                </button>
            ) : (
                <button
                    onClick={handlePauseTranscription}
                    className="bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-2 px-2 rounded-md"
                >
                    Pause
                </button>
            )}
            <button
                onClick={handleStopTranscription}
                className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-2 rounded-md"
            >
                Stop
            </button>
        </div>
    );
};

export default Transcriber;
