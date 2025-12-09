import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, Settings, Upload, CheckCircle, Search, 
  Filter, XCircle, BarChart3, RefreshCw, Database
} from 'lucide-react';
import { Attendee, TicketConfig } from '../types';
import * as Storage from '../services/storage';
import { generateDailyReport } from '../services/geminiService';

export const AdminView: React.FC = () => {
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [ticketConfig, setTicketConfig] = useState<TicketConfig>({ activeTypes: [] });
  const [activeTab, setActiveTab] = useState<'attendees' | 'settings'>('attendees');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoadingData(true);
    const [data, config] = await Promise.all([
      Storage.getAttendees(),
      Storage.getTicketConfig()
    ]);
    setAttendees(data);
    setTicketConfig(config);
    setLoadingData(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const parsed = Storage.parseCSV(text);
      
      // Merge logic: Map existing by email+ticketType to update, or add new
      // We start with current attendees to preserve check-in status if IDs match,
      // but if CSV contains new IDs or updates, we want those.
      // Simpler approach for Supabase: Just upsert the parsed list.
      // However, to preserve "checkedIn" status if the CSV doesn't have it (it usually doesn't),
      // we need to be careful. The Storage.parseCSV defaults checkedIn to false.
      // If we blindly upsert, we might reset check-ins.
      
      // Better strategy: Identify matches and keep existing status
      const currentMap = new Map(attendees.map(a => [a.id, a]));
      
      const toSave = parsed.map(p => {
        const existing = currentMap.get(p.id);
        if (existing) {
          // Keep existing status, update names/email if changed
          return { ...p, checkedIn: existing.checkedIn, checkInTime: existing.checkInTime };
        }
        return p;
      });

      setLoadingData(true);
      await Storage.upsertAttendees(toSave);
      await loadData(); // Reload from DB
      alert(`Imported ${parsed.length} records.`);
      setLoadingData(false);
    };
    reader.readAsText(file);
  };

  const toggleTicketConfig = async (type: string) => {
    const newTypes = ticketConfig.activeTypes.includes(type)
      ? ticketConfig.activeTypes.filter(t => t !== type)
      : [...ticketConfig.activeTypes, type];
    
    const newConfig = { activeTypes: newTypes };
    
    // Optimistic update
    setTicketConfig(newConfig);
    await Storage.saveTicketConfig(newConfig);
  };

  const manualCheckIn = async (id: string, currentStatus: boolean) => {
    // Optimistic update
    const newStatus = !currentStatus;
    const newTime = newStatus ? new Date().toISOString() : undefined;
    
    setAttendees(prev => prev.map(a => 
      a.id === id ? { ...a, checkedIn: newStatus, checkInTime: newTime } : a
    ));

    await Storage.checkInAttendee(id, newStatus, newTime);
  };

  const filteredAttendees = useMemo(() => {
    return attendees.filter(a => {
      const matchesSearch = 
        a.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter = filterType === 'all' || a.ticketType === filterType;
      return matchesSearch && matchesFilter;
    });
  }, [attendees, searchQuery, filterType]);

  const allTicketTypes = useMemo(() => {
    return Array.from(new Set(attendees.map(a => a.ticketType))).sort();
  }, [attendees]);

  const handleGenerateReport = async () => {
    setLoadingReport(true);
    setAiReport(null);
    const report = await generateDailyReport(attendees);
    setAiReport(report);
    setLoadingReport(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 px-4 py-4 md:px-8 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <Settings className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-800">Event Admin</h1>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-lg">
          <button 
            onClick={() => setActiveTab('attendees')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'attendees' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Attendees
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'settings' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Settings
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8">
        {activeTab === 'attendees' && (
          <div className="space-y-6">
            {/* Stats Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <p className="text-sm text-slate-500">Total Registered</p>
                <p className="text-2xl font-bold text-slate-800">{loadingData ? '...' : attendees.length}</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <p className="text-sm text-slate-500">Checked In</p>
                <p className="text-2xl font-bold text-green-600">
                  {loadingData ? '...' : attendees.filter(a => a.checkedIn).length}
                </p>
              </div>
              <div className="col-span-2 bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex items-center justify-between">
                <div>
                  <p className="text-sm text-indigo-600 font-medium">AI Insights</p>
                  <p className="text-xs text-indigo-400">Powered by Gemini</p>
                </div>
                <button 
                  onClick={handleGenerateReport}
                  disabled={loadingReport || attendees.length === 0}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-sm transition-colors disabled:opacity-50"
                >
                  {loadingReport ? <RefreshCw className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
                  Generate Report
                </button>
              </div>
            </div>

            {aiReport && (
              <div className="bg-white p-6 rounded-xl border border-indigo-100 shadow-sm animate-fade-in relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                <h3 className="text-lg font-semibold text-slate-800 mb-2 flex items-center gap-2">
                  <span className="text-xl">✨</span> Gemini Analysis
                </h3>
                <div className="prose prose-sm text-slate-600 max-w-none whitespace-pre-wrap font-medium">
                  {aiReport}
                </div>
              </div>
            )}

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search by name or email..." 
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="relative w-full md:w-64">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <select 
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none appearance-none bg-white"
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                >
                  <option value="all">All Ticket Types</option>
                  {allTicketTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ticket Type</th>
                      <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</th>
                      <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loadingData ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                           <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                           Loading data...
                        </td>
                      </tr>
                    ) : filteredAttendees.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                          No attendees found.
                        </td>
                      </tr>
                    ) : (
                      filteredAttendees.map((attendee) => (
                        <tr key={attendee.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 font-medium text-slate-800">
                            {attendee.firstName} {attendee.lastName}
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200">
                              {attendee.ticketType}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-500 text-sm">
                            {attendee.email}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => manualCheckIn(attendee.id, attendee.checkedIn)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                                attendee.checkedIn 
                                  ? 'bg-green-100 text-green-700 hover:bg-green-200 border border-green-200' 
                                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                              }`}
                            >
                              {attendee.checkedIn ? (
                                <>
                                  <CheckCircle className="w-4 h-4" />
                                  Checked In
                                </>
                              ) : (
                                'Check In'
                              )}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-2xl mx-auto space-y-8">
            {/* CSV Import */}
            <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Database className="w-5 h-5 text-indigo-600" />
                Data Management
              </h2>
              <div className="p-8 border-2 border-dashed border-slate-300 rounded-lg hover:border-indigo-400 transition-colors bg-slate-50 text-center relative">
                {loadingData && (
                   <div className="absolute inset-0 bg-white/50 flex items-center justify-center">
                     <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
                   </div>
                )}
                <input 
                  type="file" 
                  accept=".csv" 
                  onChange={handleFileUpload} 
                  className="hidden" 
                  id="csv-upload"
                  disabled={loadingData}
                />
                <label htmlFor="csv-upload" className="cursor-pointer flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                    <Upload className="w-6 h-6" />
                  </div>
                  <span className="text-sm font-medium text-slate-700">Upload CSV to Update DB</span>
                  <span className="text-xs text-slate-400">Format: ID, Ticket, Name, Lastname, Email</span>
                </label>
              </div>
            </section>

            {/* Daily Config */}
            <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-indigo-600" />
                Daily Ticket Configuration
              </h2>
              <p className="text-sm text-slate-500 mb-6">
                Select which ticket types are valid for check-in today.
              </p>
              
              <div className="space-y-3">
                {allTicketTypes.length === 0 && !loadingData && (
                    <p className="text-sm text-slate-400 italic">No ticket types found.</p>
                )}
                {allTicketTypes.map(type => (
                  <label key={type} className="flex items-center p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition-all">
                    <div className="relative flex items-center">
                      <input 
                        type="checkbox"
                        className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-slate-300 transition-all checked:border-indigo-600 checked:bg-indigo-600"
                        checked={ticketConfig.activeTypes.includes(type)}
                        onChange={() => toggleTicketConfig(type)}
                      />
                      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100">
                        <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                      </div>
                    </div>
                    <span className="ml-3 text-slate-700 font-medium select-none">{type}</span>
                  </label>
                ))}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
};
