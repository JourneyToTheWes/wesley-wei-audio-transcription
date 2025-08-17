import React from "react";
import Transcriber from "../components/Transcriber/Transcriber";
import Header from "../components/Header/Header";

const SidePanel: React.FC = () => {
    return (
        <div className="h-screen bg-neutral-800 text-white rounded-lg p-4 shadow-lg flex flex-col items-center gap-5">
            <Header />
            <Transcriber />
        </div>
    );
};

export default SidePanel;
