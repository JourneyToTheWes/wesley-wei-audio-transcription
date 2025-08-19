import React, { useEffect } from "react";
import Header from "../components/Header/Header";
import { FaMicrophone } from "react-icons/fa";
import { requestMicrophonePermission } from "../utils/permissions";

export enum Permission {
    Microphone,
}

const Permissions: React.FC = () => {
    useEffect(() => {
        const searchParams = new URLSearchParams(window.location.search);
        const paramPermission = searchParams.get("permission");

        if (paramPermission) {
            const permission = Number(paramPermission);
            switch (permission) {
                case Permission.Microphone:
                    requestMicrophonePermission();
                    break;
                default:
                    break;
            }
        }
    }, []);

    return (
        <div className="w-screen h-screen bg-neutral-800 text-white rounded-lg p-4 shadow-lg flex flex-col items-center gap-5">
            <Header />
            <h2 className="text-2xl">Grant Permissions for App Usage</h2>
            <div className="flex flex-col items-center gap-2 bg-neutral-600 p-5 rounded-md">
                <span className="text-base">
                    Click on permission button to request that specific
                    permission:
                </span>
                <button
                    className="btn btn-icon-text bg-purple-600 hover:bg-purple-700 px-4"
                    onClick={requestMicrophonePermission}
                >
                    <FaMicrophone /> Microphone
                </button>
            </div>
        </div>
    );
};

export default Permissions;
