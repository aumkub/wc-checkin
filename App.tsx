import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { UserView } from './components/UserView';
import { AdminView } from './components/AdminView';

const App: React.FC = () => {
  return (
    <HashRouter>
      <div className="relative">
        <Routes>
          <Route path="/" element={<UserView />} />
          <Route path="/admin" element={<AdminView />} />
        </Routes>
      </div>
    </HashRouter>
  );
};

export default App;