import React, { useState, useRef, useEffect } from "react";

const Transcriber = () => {
    const [transcription, setTranscription] = useState<string>("");
    const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
    const [isPaused, setIsPaused] = useState<boolean>(false);
    const [sessionDuration, setSessionDuration] = useState<number>(0);

    // useRef variables to store mutable objects for persistence across rerenders
    const socketRef = useRef<WebSocket | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const startTimeRef = useRef(0);
    const capturedStreamRef = useRef<MediaStream | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

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
        let sessionDurationInterval: undefined | number;
        if (startTimeRef && startTimeRef.current) {
            sessionDurationInterval = setInterval(() => {
                setSessionDuration((prev) => prev + 1000);
            }, 1000);
        }

        return () => {
            clearInterval(sessionDurationInterval);
        };
    }, [startTimeRef.current]);

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
                        // Add a new line for a final transcription result
                        setTranscription(
                            (prev) =>
                                prev + `[${timestamp}] ${data.transcript}\n`
                        );
                    } else {
                        // Updates last line with interim (non-final) results
                        setTranscription((prev) => {
                            const lines = prev.split("\n");
                            lines[
                                lines.length - 1
                            ] = `[${timestamp}] ${data.transcript}`;
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
        startTimeRef.current = Date.now();

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

                        // Start recording, sending data in 0.5-second chunks
                        mediaRecorder.start(500);

                        setTranscription("Recording and transcribing...\n");
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
            if (audioRef.current) {
                audioRef.current.play();
            }
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
            if (audioRef.current) {
                audioRef.current.pause();
            }
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

    return (
        <div className="w-full flex flex-col items-center gap-3">
            {/* Transcription Text */}
            <h2 className="text-base self-start">Transcription:</h2>
            <div className="w-full min-h-[50px] bg-neutral-500 flex justify-center rounded-md shadow-md">
                <p>{renderTranscriptionWithBreaks(transcription)}</p>
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
                    className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-2 rounded-md"
                >
                    Stop
                </button>
            </div>

            {/* Session Duration */}
            <div className="flex flex-col items-center">
                <h3 className="text-base">Session Duration</h3>
                {formatTime(sessionDuration)}
            </div>
        </div>
    );
};

export default Transcriber;
