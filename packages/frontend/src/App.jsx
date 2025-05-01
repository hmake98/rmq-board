import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ConfigProvider, theme } from "antd";
import { SocketProvider } from "./context/SocketContext";
import MainLayout from "./layouts/MainLayout";

// Import pages
import Overview from "./components/Overview";
import Queues from "./components/Queues";
import Exchanges from "./components/Exchanges";
import Bindings from "./components/Bindings";
import PublishMessage from "./components/PublishMessage";

// Import styles
import "./App.css";

const App = () => {
  // Detect user's preferred color scheme
  const prefersDarkMode = window.matchMedia(
    "(prefers-color-scheme: dark)"
  ).matches;

  return (
    <ConfigProvider
      theme={{
        algorithm: prefersDarkMode
          ? theme.darkAlgorithm
          : theme.defaultAlgorithm,
        token: {
          colorPrimary: "#ff6600",
        },
      }}
    >
      <SocketProvider>
        <Router>
          <Routes>
            <Route path="/" element={<MainLayout />}>
              <Route index element={<Overview />} />
              <Route path="queues" element={<Queues />} />
              <Route path="exchanges" element={<Exchanges />} />
              <Route path="bindings" element={<Bindings />} />
              <Route path="publish" element={<PublishMessage />} />
            </Route>
          </Routes>
        </Router>
      </SocketProvider>
    </ConfigProvider>
  );
};

export default App;
