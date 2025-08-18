import express from "express";
import Websocket, { WebSocketServer } from "ws";
import { SpeechClient, protos } from "@google-cloud/speech";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = 5000;

// Initialize the Google Cloud Speech-to-Text client.
// Make sure the GOOGLE_CLOUD_SERVICE_KEY environment variable is set.
const speechClient = new SpeechClient({
    keyFilename: process.env.GOOGLE_CLOUD_SERVICE_KEY,
});

// Create a WebSocket server instance.
const wss = new WebSocketServer({ noServer: true });

wss.on("connection", (ws) => {
    console.log("Client connected to WebSocket.");

    const config: protos.google.cloud.speech.v1.IRecognitionConfig = {
        encoding: "WEBM_OPUS",
        sampleRateHertz: 48000,
        languageCode: "en-US",
    };
    // Configure the Google Cloud streaming request.
    const streamingRecognitionConfig: protos.google.cloud.speech.v1.IStreamingRecognitionConfig =
        {
            config,
            singleUtterance: false,
            interimResults: true,
        };

    // Create a bidirectional streaming call to the Google Cloud API.
    const recognizeStream = speechClient
        .streamingRecognize(streamingRecognitionConfig)
        .on("error", (error) => {
            console.error("Google Speech API stream error:", error);
            ws.send(JSON.stringify({ error: error.message }));
            ws.close();
        })
        .on("data", (data) => {
            // When Google sends back a transcription result, forward it to the frontend via WebSocket.
            const result = data.results[0];
            if (
                result &&
                result.alternatives &&
                result.alternatives.length > 0
            ) {
                const transcript = result.alternatives[0].transcript;
                ws.send(
                    JSON.stringify({ transcript, isFinal: result.isFinal })
                );
            }
        });

    // The WebSocket 'message' event is triggered when the client (your extension)
    // sends audio data.
    ws.on("message", (message) => {
        // Forward the audio data directly to the Google Speech API stream.
        recognizeStream.write(message);
    });

    // Clean up when the WebSocket connection is closed.
    ws.on("close", () => {
        console.log("Client disconnected from WebSocket.");
        // End the Google Speech API stream.
        recognizeStream.end();
    });
});

// Use the Express server to handle the WebSocket upgrade request.
const server = app.listen(port, () => {
    console.log(`Backend listening on port ${port}`);
});

server.on("upgrade", (request, socket, head) => {
    if (request.url === "/transcribe") {
        wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit("connection", ws, request);
        });
    } else {
        socket.destroy();
    }
});
