import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Navigation } from './components/Navigation';
import { MDCLogo } from './components/MDCLogo';
import { Dashboard } from './pages/Dashboard';
import { Rooms } from './pages/Rooms';
import { Schedule } from './pages/Schedule';
import { Analysis } from './pages/Analysis';
import { Recommendations } from './pages/Recommendations';
import { Scheduler } from './pages/Scheduler';
import { Building6 } from './pages/Building6';
import { Chat } from './pages/Chat';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <header className="app-header">
          <div className="header-brand">
            <MDCLogo width={40} height={40} />
            <div className="header-title">
              <h1>MDC Scheduling</h1>
              <span className="header-subtitle">Classroom Analytics & Planning</span>
            </div>
          </div>
        </header>
        <Navigation />
        <main className="app-main">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/rooms" element={<Rooms />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/analysis" element={<Analysis />} />
            <Route path="/recommendations" element={<Recommendations />} />
            <Route path="/scheduler" element={<Scheduler />} />
            <Route path="/building6" element={<Building6 />} />
            <Route path="/chat" element={<Chat />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
