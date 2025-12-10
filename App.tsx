import React from 'react';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { UserView } from './components/UserView';
import { AdminView } from './components/AdminView';
import { SwagClaimView } from './components/SwagClaimView';

const Nav: React.FC = () => {
  const location = useLocation();
  const isAdmin = location.pathname.includes('admin');
  const isSwag = location.pathname.includes('swag');
  
  // Don't show nav on swag claim page
  if (isSwag) return null;
  
  return (
    <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur-md border border-slate-200 shadow-lg rounded-full px-2 py-1.5 z-50 flex gap-1">
      <Link 
        to="/" 
        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${!isAdmin ? 'bg-[#10733A] text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}
      >
        Attendee
      </Link>
      <Link 
        to="/admin" 
        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${isAdmin ? 'bg-[#10733A] text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}
      >
        Admin
      </Link>
    </nav>
  );
};

const App: React.FC = () => {
  return (
    <HashRouter>
      <div className="relative">
        <Routes>
          <Route path="/" element={<UserView />} />
          <Route path="/admin" element={<AdminView />} />
          <Route path="/swag/:token" element={<SwagClaimView />} />
        </Routes>
        <Nav />
      </div>
    </HashRouter>
  );
};

export default App;
