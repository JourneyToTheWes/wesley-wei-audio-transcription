import React, { useEffect } from "react";
import Transcriber from "../components/Transcriber/Transcriber";
import Header from "../components/Header/Header";
import { requestMicrophonePermission } from "../utils/permissions";

// Component Home page launched on install to request access to permission for microphone usage. Chrome doesn't allow
// the Popup or SidePanel to ask for microphone permission and only the extension root origin page itself.
const Home: React.FC = () => {
    useEffect(() => {
        requestMicrophonePermission();
    }, []);

    return (
        <div className="w-screen h-screen bg-neutral-800 text-white rounded-lg p-4 shadow-lg flex flex-col items-center gap-5">
            <Header />
            <Transcriber />
        </div>
    );
};

export default Home;
