import { createRoot } from "react-dom/client";
import { SoccerApp } from "../src/components/app";
createRoot(document.getElementById("root")!).render(
  <>
    <div className="browser-demo-banner">
      <b>DEMO SIAP DICOBA</b>
      <span>
        Tanpa instalasi · Data hanya di browser ini · Tidak terhubung ke server
      </span>
    </div>
    <SoccerApp />
  </>,
);
