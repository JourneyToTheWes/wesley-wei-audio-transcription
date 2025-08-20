import React, { useState, useRef, useEffect } from "react";
import Toast from "../Toast/Toast";
import Toggle from "../Toggle/Toggle";
import { FaCopy, FaPause, FaPlay, FaStop } from "react-icons/fa";
import { BsFiletypeTxt } from "react-icons/bs";
import { LuFileJson2 } from "react-icons/lu";
import { requestMicrophonePermission } from "../../utils/permissions";
import { Permission } from "../../permissions/Permissions";
import MicrophoneSelector from "../MicrophoneSelector/MicrophoneSelector";

interface ITranscript {
    timestamp: number;
    text: string;
}

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
    const [transcriptProcessingMode, setTranscriptProcessingMode] =
        useState("real-time");
    const [audioSource, setAudioSource] = useState("tab");
    // "default" is the microphone value set the first time when selecting the microphone via
    // Chrome Extension Microphone permission request.
    const [microphoneSelection, setMicrophoneSelection] = useState("default");

    // useRef variables to store mutable objects for persistence across rerenders
    const socketRef = useRef<WebSocket | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const startTimeRef = useRef(0);
    const capturedStreamRef = useRef<MediaStream | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const sessionDurationIntervalRef = useRef<number | undefined>(undefined);
    const retryCountRef = useRef(0);

    // For managing the transcription state
    const finalTranscriptionEventsRef = useRef<ITranscript[]>([]);
    const lastInterimTranscriptionRef = useRef<ITranscript | null>(null);
    const userMessagesRef = useRef<ITranscript[]>([]);
    // New ref to track the last finalized transcript text for de-duplication
    const lastFinalizedTextRef = useRef("");

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
                console.log(data);
                if (data.transcript) {
                    // Calculate the elapsed time since recording started
                    const elapsedTime = Date.now() - startTimeRef.current;

                    let transcriptText = data.transcript;

                    // Check if the current API transcript starts with the
                    // last transcripted segment. If so, we want to remove
                    // the duplicate section so the segment looks like it is
                    // resuming from the previous pause point. Google's
                    // speech-to-text feeds in the whole transcript segment
                    // each time until it reaches a final flag which it determines
                    // as a pause in speech, so we need this logic for smooth client UX.
                    if (
                        lastFinalizedTextRef.current &&
                        transcriptText.startsWith(lastFinalizedTextRef.current)
                    ) {
                        transcriptText = transcriptText
                            .substring(lastFinalizedTextRef.current.length)
                            .trim();
                    }

                    if (data.isFinal || !lastInterimTranscriptionRef.current) {
                        const timestamp = elapsedTime;

                        // Check if it's a final transcript
                        if (data.isFinal) {
                            // Clear up the last finalized text ref
                            lastFinalizedTextRef.current = "";

                            // If it's a final result, append it to the final text and clear the interim
                            const timestampToUse =
                                lastInterimTranscriptionRef.current
                                    ? lastInterimTranscriptionRef.current
                                          .timestamp
                                    : elapsedTime;
                            finalTranscriptionEventsRef.current.push({
                                timestamp: timestampToUse, // Use last interim timestamp to maintain original timestamp for when the transcription segment started
                                text: transcriptText,
                            });
                            lastInterimTranscriptionRef.current = null;
                        } else {
                            // If it's an interim result, store it in the interim buffer
                            lastInterimTranscriptionRef.current = {
                                timestamp,
                                text: transcriptText,
                            };
                        }
                    } else {
                        // It's a continuation of current interim segment, so only update the text so the original timestamp remains
                        lastInterimTranscriptionRef.current.text =
                            transcriptText;
                    }

                    // Update the main transcription state by combining all parts
                    setTranscription(combineAndRenderTranscripts());
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

    // Helper function to combine and render all transcription events in correct order
    const combineAndRenderTranscripts = () => {
        // Combine final transcripts and user messages
        const allEvents = [
            ...finalTranscriptionEventsRef.current,
            ...userMessagesRef.current,
        ];

        // Sort all events by their timestamp
        allEvents.sort(
            (a: ITranscript, b: ITranscript) => a.timestamp - b.timestamp
        );

        // Build the full transcription string from the sorted events
        let fullText = allEvents
            .map((event) => `[${formatTime(event.timestamp)}] ${event.text}`)
            .join("\n");

        // Append the current interim result if it exists
        if (lastInterimTranscriptionRef.current) {
            const interimTimestamp =
                lastInterimTranscriptionRef.current.timestamp;
            const interimText = lastInterimTranscriptionRef.current.text;
            fullText += `\n[${formatTime(interimTimestamp)}] ${interimText}`;
        }

        return fullText;
    };

    const handleStartTranscribing = () => {
        // Reset previous transcription variable holders
        lastInterimTranscriptionRef.current = null;
        finalTranscriptionEventsRef.current = [];
        lastFinalizedTextRef.current = "";
        userMessagesRef.current = [];
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
                `WebSocket connected. Starting ${audioSource} audio capture...`
            );
            startTimeRef.current = Date.now();

            if (audioSource === "microphone") {
                requestMicrophonePermission().then((granted) => {
                    console.log("granted:", granted);
                    if (granted) {
                        console.log("granted");

                        // The selected microphone
                        const deviceId: object | undefined =
                            microphoneSelection === "default"
                                ? undefined
                                : { exact: microphoneSelection };

                        // To get stream with the correct sample rate
                        const audioConstraints = {
                            audio: {
                                sampleRate: 48000,
                                channelCount: 1,
                                echoCancellation: true,
                                deviceId,
                            },
                        };

                        navigator.mediaDevices
                            .getUserMedia(audioConstraints)
                            .then((stream) => {
                                handleStream(stream, socket);
                            })
                            .catch((error) => {
                                console.error(
                                    "Error accessing microphone:",
                                    error
                                );
                                displayStatusMessage(
                                    `Error accessing microphone: ${error}. Please ensure you have granted the necessary permissions.`
                                );
                                setTranscription(
                                    "Error: Failed to capture microphone audio."
                                );
                                setIsTranscribing(false);
                                if (
                                    socketRef.current &&
                                    socketRef.current.readyState ===
                                        WebSocket.OPEN
                                ) {
                                    socketRef.current.close();
                                }
                            });
                    } else {
                        console.log("not granted");

                        chrome.tabs.create({
                            url: chrome.runtime.getURL(
                                `permissions.html?permission=${Permission.Microphone}`
                            ),
                        });
                    }
                });
            } else if (audioSource === "tab") {
                if (typeof chrome === "undefined" || !chrome.tabCapture) {
                    displayStatusMessage(
                        "Error accessing chrome.tabCapture in this environment. This feature requires a Chrome Extension."
                    );
                    setIsTranscribing(false);
                    if (
                        socketRef.current &&
                        socketRef.current.readyState === WebSocket.OPEN
                    ) {
                        socketRef.current.close();
                    }
                    return;
                }
                // Start capture audio from tab using the chrome.tabCapture API
                chrome.tabCapture.capture(
                    { audio: true, video: false },
                    (stream) => {
                        if (stream) {
                            handleStream(stream, socket);
                        } else {
                            console.error("Failed to capture tab audio");
                            displayStatusMessage(
                                `Error: Failed to capturing tab audio.`
                            );
                            setTranscription(
                                "Error: Failed to capture tab audio."
                            );
                            setIsTranscribing(false);
                            // Close the socket if capture fails
                            if (socket.readyState === WebSocket.OPEN) {
                                socket.close();

                                displayStatusMessage("WebSocket closed.");
                            }
                        }
                    }
                );
            }
        };
    };

    // Helper function to handle the media stream once it's acquired
    const handleStream = (stream: MediaStream, socket: WebSocket) => {
        console.log(`${audioSource} audio stream started`, stream);

        // Store the stream in a ref for later playback and cleanup
        if (audioSource !== "microphone") {
            capturedStreamRef.current = stream;
        } else {
            capturedStreamRef.current = null;
        }

        // Initialize MediaRecorder to record from the captured stream
        const mediaRecorder = new MediaRecorder(stream, {
            mimeType: "audio/webm; codecs=opus",
        });

        // Store the media recorder instance in the ref
        mediaRecorderRef.current = mediaRecorder;

        // Event handler for when a chunk of data is available
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0 && socket.readyState === WebSocket.OPEN) {
                // Send the audio chunk directly over the WebSocket
                socket.send(event.data);
            }
        };

        // Start recording, sending data in 0.1-second chunks if processing mode is
        // real-time or chunked every 30 seconds.
        mediaRecorder.start(
            transcriptProcessingMode === "real-time" ? 100 : 30000
        );

        setTranscription("Recording and transcribing...\n");
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

            userMessagesRef.current.push({
                timestamp: sessionDuration + 1, // to offset resume being later than pause
                text: "[Resumed transcribing...]",
            });
            setTranscription(combineAndRenderTranscripts());
        }
    };

    const handlePauseTranscribing = () => {
        if (
            mediaRecorderRef.current &&
            mediaRecorderRef.current.state === "recording"
        ) {
            // Clear Interim messages so order on transcript visually appears chronologically
            if (lastInterimTranscriptionRef.current) {
                // Set last finalized text segment on pause so we can check for duplication
                // on resume.
                lastFinalizedTextRef.current =
                    lastInterimTranscriptionRef.current.text;

                finalTranscriptionEventsRef.current.push({
                    timestamp: lastInterimTranscriptionRef.current.timestamp,
                    text: lastInterimTranscriptionRef.current.text,
                });
                lastInterimTranscriptionRef.current = null; // Clear interim message
            }

            mediaRecorderRef.current.pause();
            if (audioRef.current) {
                audioRef.current.pause();
            }
            setIsTranscribing(false);
            setIsPaused(true);
            userMessagesRef.current.push({
                timestamp: sessionDuration,
                text: "[Paused transcribing...]",
            });

            setTranscription(combineAndRenderTranscripts());
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
            displayStatusMessage("WebSocket closed.");
        }
        if (capturedStreamRef.current) {
            capturedStreamRef.current
                .getTracks()
                .forEach((track) => track.stop());
        }
        setIsTranscribing(false);
        setIsPaused(false);
        userMessagesRef.current.push({
            timestamp: Date.now() - startTimeRef.current,
            text: "Transcription stopped.",
        });

        setTranscription(combineAndRenderTranscripts());
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

            <div className="w-full flex flex-col md:flex-row md:justify-center">
                {/* Audio Source Selection */}
                <div className="flex flex-col justify-center items-center mb-4 space-x-2">
                    <h3 className="text-base">Audio Source:</h3>
                    <Toggle
                        value={audioSource}
                        leftValue="microphone"
                        rightValue="tab"
                        leftContent="Microphone"
                        rightContent="Tab"
                        onToggle={setAudioSource}
                    />

                    {audioSource === "microphone" && (
                        <MicrophoneSelector
                            onMicrophoneChange={setMicrophoneSelection}
                        />
                    )}
                </div>

                {/* Transcript Processing Modes */}
                <div className="flex flex-col items-center">
                    <h3 className="text-base">Transcript Processing Mode</h3>
                    <Toggle
                        value={transcriptProcessingMode}
                        leftValue="real-time"
                        rightValue="chunks"
                        leftContent="Real-Time"
                        rightContent="Chunks"
                        onToggle={setTranscriptProcessingMode}
                    />
                </div>
            </div>

            <div className="w-full md:w-8/10 mt-8 flex flex-col gap-2">
                {/* Transcription Text */}
                <h2 className="text-base self-start">Transcription:</h2>
                <div className="w-full min-h-[50px] max-h-[300px] overflow-auto bg-neutral-500 flex justify-center rounded-md shadow-md p-3">
                    <p>{renderTranscriptionWithBreaks(transcription)}</p>
                </div>

                {/* Transcription Button Group */}
                <div className="w-full flex justify-between">
                    {!isTranscribing && !isPaused ? (
                        <button
                            onClick={handleStartTranscribing}
                            className="bg-green-500 hover:bg-green-600 text-white font-semibold btn btn-icon-text"
                        >
                            <FaPlay />
                            Start
                        </button>
                    ) : isPaused ? (
                        <button
                            onClick={handleResumeTranscribing}
                            className="bg-green-500 hover:bg-green-600 text-white font-semibold btn btn-icon-text"
                        >
                            <FaPlay />
                            Resume
                        </button>
                    ) : (
                        <button
                            onClick={handlePauseTranscribing}
                            className="bg-yellow-500 hover:bg-yellow-600 text-white font-semibold btn btn-icon-text"
                        >
                            <FaPause /> Pause
                        </button>
                    )}
                    <button
                        onClick={handleStopTranscribing}
                        disabled={!isTranscribing && !isPaused}
                        className={`text-white font-semibold btn btn-icon-text ${
                            isTranscribing || isPaused
                                ? "bg-red-500 hover:bg-red-600"
                                : "bg-gray-400"
                        }`}
                    >
                        <FaStop />
                        Stop
                    </button>
                </div>
                {/* Session Duration */}
                <div className="flex flex-col items-center">
                    <h3 className="text-base">Session Duration</h3>
                    {formatTime(sessionDuration)}
                </div>

                {/* Copy/Download Transcript */}
                <div className="flex flex-wrap justify-center gap-2 mb-4">
                    <button
                        onClick={handleCopyToClipboard}
                        disabled={transcription.length === 0}
                        className={`px-4 btn btn-icon-text font-semibold text-white ${
                            transcription.length === 0
                                ? "bg-gray-400"
                                : "bg-indigo-600 hover:bg-indigo-700"
                        }`}
                    >
                        <FaCopy />
                        Copy to Clipboard
                    </button>
                    <button
                        onClick={handleDownloadTranscriptText}
                        disabled={transcription.length === 0}
                        className={`px-4 btn btn-icon-text font-semibold text-white ${
                            transcription.length === 0
                                ? "bg-gray-400"
                                : "bg-purple-600 hover:bg-purple-700"
                        }`}
                    >
                        <BsFiletypeTxt /> Download Text
                    </button>
                    <button
                        onClick={handleDownloadTranscriptJson}
                        disabled={transcription.length === 0}
                        className={`px-4 btn btn-icon-text font-semibold text-white ${
                            transcription.length === 0
                                ? "bg-gray-400"
                                : "bg-purple-600 hover:bg-purple-700"
                        }`}
                    >
                        <LuFileJson2 /> Download JSON
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Transcriber;
