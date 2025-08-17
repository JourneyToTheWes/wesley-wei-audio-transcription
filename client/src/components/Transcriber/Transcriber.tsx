import React, { useState, useRef } from "react";

const Transcriber = () => {
    const [transcription, setTranscription] = useState("");
    const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
    const [isPaused, setIsPaused] = useState<boolean>(false);

    // useRef variables to store mutable objects for persistence across rerenders
    const socketRef = useRef<WebSocket | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);

    // Creates and returns new WebSocket to the transcribe service
    const connectWebSocket = () => {
        // Initialize a new WebSocket connection to your server
        const newSocket = new WebSocket("ws://localhost:5000/transcribe");

        // Store the socket instance in the ref
        socketRef.current = newSocket;

        // Handle incoming messages from the server
        newSocket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.transcript) {
                    // Check if it's a final transcript
                    if (data.isFinal) {
                        // Add a new line for a final transcription result
                        setTranscription(
                            (prev) => prev + " " + data.transcript + "\n"
                        );
                    } else {
                        // Updates last line with interim (non-final) results
                        setTranscription((prev) => {
                            const lines = prev.split("\n");
                            lines[lines.length - 1] = data.transcript;
                            return lines.join("\n");
                        });
                    }
                }
            } catch (err) {
                console.error("Failed to parse WebSocket message:", err);
            }
        };

        // Handle connection closure
        newSocket.onclose = () => {
            console.log("WebSocket connection closed.");
            setIsTranscribing(false);
        };

        // Handle errors
        newSocket.onerror = (err) => {
            console.error("WebSocket error:", err);
            setIsTranscribing(false);
        };

        return newSocket;
    };

    const handleStartTranscribing = () => {
        setIsTranscribing(true);
        setTranscription(
            "Connecting to WebSocket and starting transcription..."
        );

        // Start a WebSocket connection
        const socket = connectWebSocket();

        // The 'onopen' event handler ensures the socket is ready before sending data
        socket.onopen = () => {
            console.log("WebSocket connection opened.");
            setTranscription(
                "WebSocket connected. Starting tab audio capture..."
            );

            // Start capture audio from tab using the chrome.tabCapture API
            chrome.tabCapture.capture(
                { audio: true, video: false },
                (stream) => {
                    if (stream) {
                        console.log("Tab audio stream started", stream);

                        // Initialize MediaRecorder to record from the captured stream
                        const mediaRecorder = new MediaRecorder(stream, {
                            mimeType: "audio/webm; codecs=opus",
                        });

                        // Store the media recorder instance in the ref
                        mediaRecorderRef.current = mediaRecorder;

                        // Event handler for when a chunk of data is available
                        mediaRecorder.ondataavailable = (event) => {
                            if (
                                event.data.size > 0 &&
                                socket.readyState === WebSocket.OPEN
                            ) {
                                // Send the audio chunk directly over the WebSocket
                                socket.send(event.data);
                            }
                        };

                        // Start recording, sending data in 2-second chunks
                        mediaRecorder.start(2000);

                        setTranscription("Recording and transcribing...");
                    } else {
                        console.error("Failed to capture tab audio");
                        setTranscription("Error: Failed to capture tab audio.");
                        setIsTranscribing(false);
                        // Close the socket if capture fails
                        if (socket.readyState === WebSocket.OPEN) {
                            socket.close();
                        }
                    }
                }
            );
        };
    };

    const handleResumeTranscribing = () => {
        if (
            mediaRecorderRef.current &&
            mediaRecorderRef.current.state === "paused"
        ) {
            mediaRecorderRef.current.resume();
            setIsTranscribing(true);
            setIsPaused(false);
            setTranscription((prev) => prev + "\nResumed transcribing...");
        }
    };

    const handlePauseTranscribing = () => {
        if (
            mediaRecorderRef.current &&
            mediaRecorderRef.current.state === "recording"
        ) {
            mediaRecorderRef.current.pause();
            setIsTranscribing(false);
            setIsPaused(true);
            setTranscription((prev) => prev + "\nPaused transcribing...");
        }
    };

    const handleStopTranscribing = () => {
        if (
            mediaRecorderRef.current &&
            mediaRecorderRef.current.state !== "inactive"
        ) {
            mediaRecorderRef.current.stop();
            console.log("MediaRecorder stopped.");
        }
        if (
            socketRef.current &&
            socketRef.current.readyState === WebSocket.OPEN
        ) {
            socketRef.current.close();
            console.log("WebSocket closed.");
        }
        setIsTranscribing(false);
        setIsPaused(false);
        setTranscription((prev) => prev + "\nTranscription stopped.");
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
