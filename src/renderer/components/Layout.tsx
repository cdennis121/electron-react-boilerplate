import { Routes, Route, Link } from 'react-router-dom';
import Users from './Users';
import HuntGroups from './HuntGroups';
import CallQueues from './CallQueues';
import CallHistory from './CallHistory';
import Audio from './Audio';
import Settings from './Settings';

function Layout() {
  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>User Management</h2>
        </div>
        <nav className="sidebar-nav">
          <Link to="/users" className="nav-link">
            Users
          </Link>
          <Link to="/hunt-groups" className="nav-link">
            Hunt Groups
          </Link>
          <Link to="/call-queues" className="nav-link">
            Call Queues
          </Link>
          <Link to="/call-history" className="nav-link">
            Call History
          </Link>
          <Link to="/audio" className="nav-link">
            Audio
          </Link>
        </nav>
        <nav className="sidebar-nav-bottom">
          <Link to="/settings" className="nav-link">
            ⚙️ Settings
          </Link>
        </nav>
      </aside>
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Users />} />
          <Route path="/users" element={<Users />} />
          <Route path="/hunt-groups" element={<HuntGroups />} />
          <Route path="/call-queues" element={<CallQueues />} />
          <Route path="/call-history" element={<CallHistory />} />
          <Route path="/audio" element={<Audio />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  );
}

export default Layout;
