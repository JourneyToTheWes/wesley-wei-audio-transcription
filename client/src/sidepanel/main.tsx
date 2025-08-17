import React from "react";
import { createRoot } from "react-dom/client";
import SidePanel from "./SidePanel";
import "../index.css";

const root = createRoot(document.getElementById("root")!);
root.render(<SidePanel />);
