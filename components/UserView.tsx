import React, { useState } from 'react';
import { QrCode, Mail, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { Attendee, CheckInResult } from '../types';
import * as Storage from '../services/storage';

export const UserView: React.FC = () => {
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      // 1. Fetch Config
      const config = await Storage.getTicketConfig();
      
      // 2. Fetch User by Email (only relevant tickets to save bandwidth? No, logic requires finding tickets first)
      const userTickets = await Storage.getAttendeesByEmail(email);
      
      if (userTickets.length === 0) {
        setResult({ success: false, message: "No registration found for this email address." });
        setLoading(false);
        return;
      }

      // 3. Filter for VALID tickets for TODAY
      const validTicketsForToday = userTickets.filter(t => config.activeTypes.includes(t.ticketType));

      if (validTicketsForToday.length === 0) {
        setResult({ 
          success: false, 
          message: "You have a ticket, but it is not valid for check-in today." 
        });
        setLoading(false);
        return;
      }

      // 4. Perform Check-in in DB
      const success = await Storage.checkInUserTickets(email, config.activeTypes);

      if (success) {
        setResult({
          success: true,
          message: "Welcome!",
          attendee: validTicketsForToday[0], // Just use first for name display
          checkedInTypes: validTicketsForToday.map(t => t.ticketType)
        });
      } else {
        setResult({
          success: false,
          message: "A database error occurred during check-in. Please try again or contact support."
        });
      }

    } catch (error) {
      console.error("Checkin Error", error);
      setResult({
        success: false,
        message: "An unexpected error occurred."
      });
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setEmail('');
    setResult(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
        
        {/* Header Graphic */}
        <div className="bg-indigo-600 p-8 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
          <div className="relative z-10">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl mx-auto flex items-center justify-center mb-4">
              <QrCode className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Event Check-In</h1>
            <p className="text-indigo-200 text-sm mt-1">Please enter your email to check in</p>
          </div>
        </div>

        <div className="p-8">
          {!result ? (
            <form onSubmit={handleCheckIn} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 ml-1">Email Address</label>
                <div className="relative group">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading || !email}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3.5 rounded-xl shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:shadow-none transition-all flex items-center justify-center gap-2 group"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    Check In Now
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <div className="text-center animate-fade-in-up">
              <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-4 ${result.success ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                {result.success ? <CheckCircle2 className="w-10 h-10" /> : <AlertCircle className="w-10 h-10" />}
              </div>
              
              <h2 className="text-2xl font-bold text-slate-800 mb-2">
                {result.success ? `Welcome, ${result.attendee?.firstName}!` : 'Check-In Failed'}
              </h2>
              
              <p className="text-slate-600 mb-6 leading-relaxed">
                {result.message}
              </p>

              {result.success && result.checkedInTypes && (
                <div className="bg-slate-50 rounded-lg p-4 mb-6 border border-slate-100">
                  <p className="text-xs text-slate-400 uppercase font-semibold mb-2">Tickets Activated</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {result.checkedInTypes.map(type => (
                      <span key={type} className="inline-block px-3 py-1 bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-full border border-indigo-200">
                        {type}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={reset}
                className="text-slate-500 hover:text-slate-800 font-medium text-sm transition-colors"
              >
                Back to Scan
              </button>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="bg-slate-50 p-4 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-400">Powered by EventFlow</p>
        </div>
      </div>
    </div>
  );
};
