import React, { useState, useEffect } from "react";

interface IToast {
    message: string;
    duration?: number;
    onClose: () => void;
}

const Toast: React.FC<IToast> = ({ message, duration = 3000, onClose }) => {
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        const timeout = setTimeout(() => {
            setIsVisible(false);
            onClose();
        }, duration);

        return () => clearTimeout(timeout);
    }, []);

    return (
        <div
            className={`z-10 w-9/10 p-3 bg-gray-600 mb-4 fixed transition-all duration-500 ${
                isVisible
                    ? "opacity-90 translate-y-0"
                    : "opacity-0 -translate-y-full"
            }`}
        >
            <p className="text-sm text-white">{message}</p>
        </div>
    );
};

export default Toast;
