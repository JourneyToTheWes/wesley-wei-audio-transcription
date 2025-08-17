import React from "react";
import Transcriber from "../components/Transcriber/Transcriber";

const Popup: React.FC = () => {
    return (
        <div className="w-[500px] bg-neutral-800 text-white rounded-lg p-4 shadow-lg flex flex-col items-center">
            <h1 className="text-3xl">Real-Time Audio Transcription</h1>
            <Transcriber />
        </div>
    );
};

export default Popup;
