import React from "react";

interface IToggle {
    value: string;
    leftValue: string;
    rightValue: string;
    leftContent: string | React.ReactNode;
    rightContent: string | React.ReactNode;
    onToggle: (value: string) => any;
}

/**
 * A simple two-option toggle component.
 * @param {Object} props - The component props.
 * @param {string} props.value - The currently selected option's value.
 * @param {string} props.leftValue - The value for the left option.
 * @param {string} props.rightValue - The value for the right option.
 * @param {React.ReactNode} props.leftContent - The content (text or icon) for the left option.
 * @param {React.ReactNode} props.rightContent - The content (text or icon) for the right option.
 * @param {function} props.onToggle - A function to call when an option is clicked.
 */
const Toggle: React.FC<IToggle> = ({
    value,
    leftValue,
    rightValue,
    leftContent,
    rightContent,
    onToggle,
}) => {
    // Determine the position of the active pill based on the current value.
    const pillClasses =
        value === leftValue
            ? "transform translate-x-0" // Active left
            : "transform translate-x-[72px]"; // Active right

    return (
        <div className="relative flex w-40 h-10 p-1 rounded-full bg-purple-500/50 shadow-inner overflow-hidden">
            {/* The active pill indicator, which slides */}
            <div
                className={`absolute top-1 left-1 w-1/2 h-8 bg-purple-600 rounded-full shadow-md transition-transform duration-300 ease-in-out ${pillClasses}`}
            />

            {/* Left option container */}
            <button
                onClick={() => onToggle(leftValue)}
                className="relative flex-1 flex items-center justify-center cursor-pointer text-white font-medium focus:outline-none"
            >
                <span
                    className={`transition-colors duration-300 ${
                        value === leftValue ? "text-white" : "text-white/70"
                    }`}
                >
                    {leftContent}
                </span>
            </button>

            {/* Right option container */}
            <button
                onClick={() => onToggle(rightValue)}
                className="relative flex-1 flex items-center justify-center cursor-pointer text-white font-medium focus:outline-none"
            >
                <span
                    className={`transition-colors duration-300 ${
                        value === rightValue ? "text-white" : "text-white/70"
                    }`}
                >
                    {rightContent}
                </span>
            </button>
        </div>
    );
};

export default Toggle;
