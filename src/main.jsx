import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";

function App() {
  return (
    <main className="min-h-screen bg-background text-foreground p-6">
      <h1 className="text-3xl font-semibold">TitanOS</h1>
      <p className="mt-2 text-muted-foreground">Vite + React + Tailwind v4 is ready.</p>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
