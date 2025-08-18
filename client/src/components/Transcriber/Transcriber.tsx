import React, { useState, useRef, useEffect } from "react";
import Toast from "../Toast/Toast";

const Transcriber = () => {
    // Constants for retry logic
    const MAX_RETRIES = 3;
    const RETRY_BASE_DELAY = 1000; // 1 second

    const [transcription, setTranscription] = useState<string>("");
    const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
    const [isPaused, setIsPaused] = useState<boolean>(false);
    const [sessionDuration, setSessionDuration] = useState<number>(0);
    const [statusMessage, setStatusMessage] = useState("");
    const [showToast, setShowToast] = useState(false);

    // useRef variables to store mutable objects for persistence across rerenders
    const socketRef = useRef<WebSocket | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const startTimeRef = useRef(0);
    const capturedStreamRef = useRef<MediaStream | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const sessionDurationIntervalRef = useRef<number | undefined>(undefined);
    const retryCountRef = useRef(0);

    // For managing the transcription state
    const lastFinalTranscriptionRef = useRef("");
    const lastInterimTranscriptionRef = useRef("");

    const displayStatusMessage = (message: string) => {
        setStatusMessage(message);
        setShowToast(true);
    };

    const handleCloseToast = () => {
        setStatusMessage("");
        setShowToast(false);
    };

    // Formats milliseconds into a timestamp (HH:mm:ss)
    const formatTime = (ms: number) => {
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        const pad = (num: number) => String(num).padStart(2, "0");

        if (hours > 0) {
            return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
        } else {
            return `${pad(minutes)}:${pad(seconds)}`;
        }
    };

    useEffect(() => {
        if (isTranscribing && !isPaused) {
            sessionDurationIntervalRef.current = setInterval(() => {
                setSessionDuration((prev) => prev + 1000);
            }, 1000);
        } else {
            clearInterval(sessionDurationIntervalRef.current);
        }

        return () => {
            clearInterval(sessionDurationIntervalRef.current);
        };
    }, [isTranscribing, isPaused]);

    // Reconnect WebSocket with exponential backoff
    const reconnectWebSocket = () => {
        if (retryCountRef.current < MAX_RETRIES) {
            const delay = RETRY_BASE_DELAY * Math.pow(2, retryCountRef.current);
            displayStatusMessage(
                `Connection lost. Retrying in ${
                    delay / 1000
                } seconds... (Attempt ${
                    retryCountRef.current + 1
                }/${MAX_RETRIES})`
            );
            retryCountRef.current++;
            setTimeout(() => {
                if (!isTranscribing) {
                    // If the user has stopped transcription manually, don't try to reconnect
                    return;
                }
                connectWebSocket();
            }, delay);
        } else {
            displayStatusMessage(
                "Failed to reconnect. Please try starting a new transcription."
            );
            setIsTranscribing(false);
            setIsPaused(false);
        }
    };

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
                    // Calculate the elapsed time since recording started
                    const elapsedTime = Date.now() - startTimeRef.current;
                    const timestamp = formatTime(elapsedTime);

                    // Check if it's a final transcript
                    if (data.isFinal) {
                        // If it's a final result, append it to the final text and clear the interim buffer
                        lastFinalTranscriptionRef.current += `[${timestamp}] ${data.transcript}\n`;
                        lastInterimTranscriptionRef.current = "";
                    } else {
                        // If it's an interim result, store it in the interim buffer
                        lastInterimTranscriptionRef.current = `[${timestamp}] ${data.transcript}`;
                    }

                    // Update the main transcription state by combining final and interim text
                    setTranscription(
                        lastFinalTranscriptionRef.current +
                            lastInterimTranscriptionRef.current
                    );
                }
            } catch (err) {
                console.error("Failed to parse WebSocket message:", err);
            }
        };

        // Handle connection closure
        newSocket.onclose = () => {
            console.log("WebSocket connection closed.");

            if (isTranscribing) {
                reconnectWebSocket();
            }
        };

        // Handle errors
        newSocket.onerror = (err) => {
            console.error("WebSocket error:", err);

            if (isTranscribing) {
                reconnectWebSocket();
            }
        };

        return newSocket;
    };

    const handleStartTranscribing = () => {
        setSessionDuration(0); // Set session duration back to 0 when starting new session
        setTranscription(
            "Connecting to WebSocket and starting transcription..."
        );

        // Start a WebSocket connection
        const socket = connectWebSocket();

        // The 'onopen' event handler ensures the socket is ready before sending data
        socket.onopen = () => {
            console.log("WebSocket connection opened.");
            displayStatusMessage("WebSocket connected.");
            retryCountRef.current = 0; // Reset retry count on successful connection

            if (isTranscribing) {
                return;
            }

            setIsTranscribing(true);
            setTranscription(
                "WebSocket connected. Starting tab audio capture..."
            );
            startTimeRef.current = Date.now();

            // Start capture audio from tab using the chrome.tabCapture API
            chrome.tabCapture.capture(
                { audio: true, video: false },
                (stream) => {
                    if (stream) {
                        console.log("Tab audio stream started", stream);

                        // Store the stream in a ref for later playback and cleanup
                        capturedStreamRef.current = stream;

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

                        // Start recording, sending data in 0.1-second chunks
                        mediaRecorder.start(100);

                        setTranscription("Recording and transcribing...\n");
                    } else {
                        console.error("Failed to capture tab audio");
                        setTranscription("Error: Failed to capture tab audio.");
                        setIsTranscribing(false);
                        // Close the socket if capture fails
                        if (socket.readyState === WebSocket.OPEN) {
                            socket.close();

                            displayStatusMessage("WebSocket closed.");
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
            if (audioRef.current) {
                audioRef.current.play();
            }
            setIsTranscribing(true);
            setIsPaused(false);
            setTranscription((prev) => prev + "\nResumed transcribing...\n");
        }
    };

    const handlePauseTranscribing = () => {
        if (
            mediaRecorderRef.current &&
            mediaRecorderRef.current.state === "recording"
        ) {
            mediaRecorderRef.current.pause();
            if (audioRef.current) {
                audioRef.current.pause();
            }
            setIsTranscribing(false);
            setIsPaused(true);
            setTranscription((prev) => prev + "\nPaused transcribing...\n");
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
        if (capturedStreamRef.current) {
            capturedStreamRef.current
                .getTracks()
                .forEach((track) => track.stop());
        }
        setIsTranscribing(false);
        setIsPaused(false);
        setTranscription((prev) => prev + "\nTranscription stopped.");
    };

    // Effect to play back the captured audio stream
    useEffect(() => {
        if (capturedStreamRef.current) {
            const audio = new Audio();
            // Assign the captured stream as the audio source
            audio.srcObject = capturedStreamRef.current;
            // Start playing the audio
            audio
                .play()
                .catch((e) => console.error("Error playing audio stream:", e));
            audioRef.current = audio;
        }

        // Stop audio playback on component unmount
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.srcObject = null;
            }
        };
    }, [capturedStreamRef.current]);

    useEffect(() => {
        return () => {
            handleStopTranscribing();
        };
    }, []);

    const renderTranscriptionWithBreaks = (text: string) => {
        return text.split("\n").map((line, index) => (
            <React.Fragment key={index}>
                {line}
                <br />
            </React.Fragment>
        ));
    };

    const handleCopyToClipboard = async () => {
        try {
            await navigator.clipboard.writeText(transcription);
            displayStatusMessage("Transcript copied to clipboard!");
        } catch (err) {
            console.error("Failed to copy transcript: ", err);
            displayStatusMessage("Failed to copy transcript.");
        }
    };

    const handleDownloadTranscriptText = () => {
        const element = document.createElement("a");
        const file = new Blob([transcription], { type: "text/plain" });
        element.href = URL.createObjectURL(file);
        element.download = "transcription.txt";
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
        displayStatusMessage("Transcription downloaded as text!");
    };

    const handleDownloadTranscriptJson = () => {
        const lines = transcription
            .split("\n")
            .filter((line) => line.trim() !== "");

        // Parse the text into a structured JSON format
        const jsonOutput = lines.map((line) => {
            // Regex to extract the timestamp and text
            const match = line.match(/^\[(.*?)\]\s*(.*)$/);
            if (match) {
                return {
                    timestamp: match[1],
                    text: match[2].trim(),
                };
            } else {
                return {
                    text: line,
                };
            }
        });

        const jsonString = JSON.stringify(jsonOutput, null, 2);
        const element = document.createElement("a");
        const file = new Blob([jsonString], { type: "application/json" });
        element.href = URL.createObjectURL(file);
        element.download = "transcription.json";
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
        displayStatusMessage("Transcription downloaded as JSON!");
    };

    return (
        <div className="w-full flex flex-col items-center gap-3">
            {/* Status Message Toast */}
            {showToast && (
                <Toast
                    message={statusMessage}
                    duration={3000}
                    onClose={handleCloseToast}
                />
            )}

            {/* Transcription Text */}
            <div className="w-full mt-8">
                <h2 className="text-base self-start">Transcription:</h2>
                <div className="w-full min-h-[50px] bg-neutral-500 flex justify-center rounded-md shadow-md p-3">
                    <p>{renderTranscriptionWithBreaks(transcription)}</p>
                </div>
            </div>

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
                    disabled={!isTranscribing && !isPaused}
                    className={`text-white font-semibold py-2 px-2 rounded-md ${
                        isTranscribing || isPaused
                            ? "bg-red-500 hover:bg-red-600"
                            : "bg-gray-400"
                    }`}
                >
                    Stop
                </button>
            </div>

            {/* Session Duration */}
            <div className="flex flex-col items-center">
                <h3 className="text-base">Session Duration</h3>
                {formatTime(sessionDuration)}
            </div>

            {/* Copy/Download Transcript */}
            <div className="space-x-4 mb-4">
                <button
                    onClick={handleCopyToClipboard}
                    disabled={transcription.length === 0}
                    className={`px-4 py-2 rounded-md font-semibold text-white ${
                        transcription.length === 0
                            ? "bg-gray-400"
                            : "bg-indigo-600 hover:bg-indigo-700"
                    }`}
                >
                    Copy to Clipboard
                </button>
                <button
                    onClick={handleDownloadTranscriptText}
                    disabled={transcription.length === 0}
                    className={`px-4 py-2 rounded-md font-semibold text-white ${
                        transcription.length === 0
                            ? "bg-gray-400"
                            : "bg-purple-600 hover:bg-purple-700"
                    }`}
                >
                    Download Text
                </button>
                <button
                    onClick={handleDownloadTranscriptJson}
                    disabled={transcription.length === 0}
                    className={`px-4 py-2 rounded-md font-semibold text-white ${
                        transcription.length === 0
                            ? "bg-gray-400"
                            : "bg-purple-600 hover:bg-purple-700"
                    }`}
                >
                    Download JSON
                </button>
            </div>
        </div>
    );
};

export default Transcriber;
