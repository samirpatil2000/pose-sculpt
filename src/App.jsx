import React from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import './App.css';
import PoseEditor from './pages/PoseEditor';
import PoseExtractor from './pages/PoseExtractor';

function TabBar() {
  return (
    <nav className="tab-bar">
      <NavLink 
        to="/" 
        className={({ isActive }) => isActive ? "active" : ""}
        end
      >
        Pose Editor
      </NavLink>
      <NavLink 
        to="/extract" 
        className={({ isActive }) => isActive ? "active" : ""}
      >
        Pose Extractor
      </NavLink>
    </nav>
  );
}

function App() {
  return (
    <BrowserRouter>
      <TabBar />
      <Routes>
        <Route path="/" element={<PoseEditor />} />
        <Route path="/extract" element={<PoseExtractor />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
