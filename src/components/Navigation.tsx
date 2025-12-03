import { NavLink } from 'react-router-dom';
import './Navigation.css';

export function Navigation() {
  return (
    <nav className="navigation">
      <NavLink to="/" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
        Dashboard
      </NavLink>
      <NavLink to="/rooms" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
        Rooms
      </NavLink>
      <NavLink to="/schedule" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
        Schedule
      </NavLink>
      <NavLink to="/analysis" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
        Analysis
      </NavLink>
      <NavLink to="/recommendations" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
        Recommendations
      </NavLink>
      <NavLink to="/scheduler" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
        Scheduler
      </NavLink>
      <NavLink to="/chat" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
        AI Chat
      </NavLink>
    </nav>
  );
}
