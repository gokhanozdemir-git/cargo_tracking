import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Kullanici from './pages/Kullanici';
import Yonetici from './pages/Yonetici';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/kullanici" element={<Kullanici />} />
          <Route path="/yonetici" element={<Yonetici />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;