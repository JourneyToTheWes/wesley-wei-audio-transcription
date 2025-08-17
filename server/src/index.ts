import express from "express";
import multer from "multer";
import { SpeechClient, protos } from "@google-cloud/speech";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const upload = multer({ dest: "uploads/" });
const speechClient = new SpeechClient({
    keyFilename: path.resolve(process.env.GOOGLE_CLOUD_SERVICE_KEY || ""),
});

app.post("/transcribe", upload.single("audio"), async (req, res) => {
    try {
        const audioBytes = fs.readFileSync(req.file!.path).toString("base64");
        const audio: protos.google.cloud.speech.v1.IRecognitionAudio = {
            content: audioBytes,
        };
        const config: protos.google.cloud.speech.v1.IRecognitionConfig = {
            encoding: "WEBM_OPUS",
            sampleRateHertz: 48000,
            languageCode: "en-US",
        };
        const request: protos.google.cloud.speech.v1.IRecognizeRequest = {
            audio,
            config,
        };
        const [response] = await speechClient.recognize(request);
        console.log(response);
        const transcript =
            response.results
                ?.map((result) =>
                    result.alternatives && result.alternatives.length > 0
                        ? result.alternatives[0].transcript
                        : ""
                )
                .join("\n") ?? "";
        fs.unlinkSync(req.file!.path);

        res.json({ transcript });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(5000, () => console.log("Backend listening on port 5000"));
