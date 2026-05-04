import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import CreateUser from "./pages/CreateUser";
import AddHealth from "./pages/AddHealth";
import Dashboard from "./pages/Dashboard";

import ComingSoon from "./pages/ComingSoon";
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CreateUser />} />
        <Route path="/health/:citizenId" element={<AddHealth />} />
        <Route path="/dashboard/:citizenId" element={<Dashboard />} />

        <Route path="/coming-soon" element={<ComingSoon />} />
      </Routes>
    </BrowserRouter>
  );
}