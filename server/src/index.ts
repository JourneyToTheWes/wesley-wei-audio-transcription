import express from "express";
import multer from "multer";
import { SpeechClient } from "@google-cloud/speech";
import fs from "fs";
import path from "path";

const app = express();
const upload = multer({ dest: "uploads/" });
const speechClient = new SpeechClient({
    keyFilename: path.join(__dirname, "../<service-account>.json"),
});
