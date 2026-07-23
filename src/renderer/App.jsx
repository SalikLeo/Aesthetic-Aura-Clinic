import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './components/layout/Sidebar';
import Dashboard from './components/features/Dashboard';
import Appointments from './components/features/Appointments';
import Patients from './components/features/Patients';
import PatientDetails from './components/features/PatientDetails';
import Doctors from './components/features/Doctors';
import Billing from './components/features/Billing';
import Services from './components/features/Services';
import Products from './components/features/Products';
import Employees from './components/features/Employees';
import Expenses from './components/features/Expenses';
import Sessions from './components/features/Sessions';
import Reports from './components/features/Reports';
import Settings from './components/features/Settings';
import ReminderManager from './components/features/ReminderManager';

const App = () => {
  return (
    <Router>
      <div className="flex h-screen bg-primary-bg text-gray-100 overflow-hidden font-sans">
        <ReminderManager />
        <Sidebar />
        <main className="flex-1 overflow-y-auto relative bg-primary-bg">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/appointments" element={<Appointments />} />
            <Route path="/patients" element={<Patients />} />
            <Route path="/patients/:id" element={<PatientDetails />} />
            <Route path="/doctors" element={<Doctors />} />
            <Route path="/billing" element={<Billing />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/services" element={<Services />} />
            <Route path="/products" element={<Products />} />
            <Route path="/employees" element={<Employees />} />
            <Route path="/sessions" element={<Sessions />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
};

export default App;
