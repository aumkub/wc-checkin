import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, Settings, Upload, CheckCircle, Search, 
  Filter, XCircle, BarChart3, RefreshCw, Database, Lock, AlertTriangle, Edit2, X, ChevronLeft, ChevronRight
} from 'lucide-react';
import { Attendee, TicketConfig } from '../types';
import * as Storage from '../services/storage';
import { COUNTRIES } from '../constants/countries';

const ADMIN_PASSWORD = 'jmgd68f4';
const SETTINGS_PASSWORD = 'adwcbkk25';
const AUTH_STORAGE_KEY = 'admin_authenticated';
const SETTINGS_AUTH_STORAGE_KEY = 'settings_authenticated';

export const AdminView: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    // Check if already authenticated in this session
    return sessionStorage.getItem(AUTH_STORAGE_KEY) === 'true';
  });
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [ticketConfig, setTicketConfig] = useState<TicketConfig>({ activeTypes: [] });
  const [activeTab, setActiveTab] = useState<'attendees' | 'settings'>('attendees');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterCheckIn, setFilterCheckIn] = useState<string>('all'); // 'all', 'checked-in', 'not-checked-in'
  const [currentPage, setCurrentPage] = useState(1);
  const [loadingData, setLoadingData] = useState(false);
  const [showQuickReport, setShowQuickReport] = useState(false);
  const [editingAttendee, setEditingAttendee] = useState<Attendee | null>(null);
  const [countrySearch, setCountrySearch] = useState('');
  const [editCountry, setEditCountry] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [isSettingsAuthenticated, setIsSettingsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem(SETTINGS_AUTH_STORAGE_KEY) === 'true';
  });
  const [settingsPassword, setSettingsPassword] = useState('');
  const [settingsPasswordError, setSettingsPasswordError] = useState('');
  const [showSettingsPasswordModal, setShowSettingsPasswordModal] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated]);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      sessionStorage.setItem(AUTH_STORAGE_KEY, 'true');
      setPassword('');
    } else {
      setPasswordError('Incorrect password. Please try again.');
      setPassword('');
    }
  };

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
      const currentMap = new Map<string, Attendee>(attendees.map(a => [a.id, a]));
      
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

  const openEditModal = (attendee: Attendee) => {
    setEditingAttendee(attendee);
    setEditCountry(attendee.country || '');
    setEditNotes(attendee.notes || '');
    setCountrySearch('');
  };

  const closeEditModal = () => {
    setEditingAttendee(null);
    setEditCountry('');
    setEditNotes('');
    setCountrySearch('');
  };

  const saveAttendeeFields = async () => {
    if (!editingAttendee) return;
    
    const success = await Storage.updateAttendeeFields(editingAttendee.id, {
      country: editCountry,
      notes: editNotes
    });

    if (success) {
      setAttendees(prev => prev.map(a => 
        a.id === editingAttendee.id 
          ? { ...a, country: editCountry, notes: editNotes }
          : a
      ));
      closeEditModal();
    }
  };

  const filteredCountries = useMemo(() => {
    if (!countrySearch) return COUNTRIES.slice(0, 10);
    const searchLower = countrySearch.toLowerCase();
    return COUNTRIES.filter(country => 
      country.toLowerCase().includes(searchLower)
    ).slice(0, 10);
  }, [countrySearch]);

  const handleSettingsPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsPasswordError('');
    
    if (settingsPassword === SETTINGS_PASSWORD) {
      setIsSettingsAuthenticated(true);
      sessionStorage.setItem(SETTINGS_AUTH_STORAGE_KEY, 'true');
      setSettingsPassword('');
      setShowSettingsPasswordModal(false);
      setActiveTab('settings');
    } else {
      setSettingsPasswordError('Incorrect password. Please try again.');
      setSettingsPassword('');
    }
  };

  const filteredAttendees = useMemo(() => {
    return attendees.filter(a => {
      const matchesSearch = 
        a.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter = filterType === 'all' || a.ticketType === filterType;
      const matchesCheckIn = 
        filterCheckIn === 'all' || 
        (filterCheckIn === 'checked-in' && a.checkedIn) ||
        (filterCheckIn === 'not-checked-in' && !a.checkedIn);
      return matchesSearch && matchesFilter && matchesCheckIn;
    });
  }, [attendees, searchQuery, filterType, filterCheckIn]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterType, filterCheckIn]);

  // Pagination logic - always paginate to save bandwidth and improve performance
  const ITEMS_PER_PAGE = 20;
  const totalPages = Math.ceil(filteredAttendees.length / ITEMS_PER_PAGE);
  const paginatedAttendees = filteredAttendees.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const allTicketTypes = useMemo(() => {
    return Array.from(new Set(attendees.map(a => a.ticketType))).sort();
  }, [attendees]);


  // Show password prompt if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
          {/* Header */}
          <div className="bg-[#10733A] p-8 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
            <div className="relative z-10">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl mx-auto flex items-center justify-center mb-4">
                <Lock className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white">Admin Access</h1>
              <p className="text-white text-sm mt-1">Enter password to continue</p>
            </div>
          </div>

          <div className="p-8">
            <form onSubmit={handlePasswordSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 ml-1">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setPasswordError('');
                  }}
                  placeholder="Enter admin password"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#11723A]/60 focus:ring-4 focus:ring-[#11723A]/10 outline-none transition-all"
                  autoFocus
                />
                {passwordError && (
                  <p className="text-sm text-red-600 mt-1">{passwordError}</p>
                )}
              </div>
              <button
                type="submit"
                className="w-full bg-[#10733A] hover:bg-[#10733A]/90 text-white font-semibold py-3.5 rounded-xl shadow-lg shadow-[#11723A]/20 transition-all"
              >
                Access Admin Panel
              </button>
            </form>
          </div>

          {/* Footer */}
          <div className="bg-slate-50 p-4 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-400">Protected Admin Area</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 px-4 py-4 md:px-8 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-2">
          <div className="bg-[#10733A] p-2 rounded-lg">
            <Settings className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-800">Event Admin</h1>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-lg">
          <button 
            onClick={() => setActiveTab('attendees')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'attendees' ? 'bg-white text-[#10733A] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Attendees
          </button>
          <button 
            onClick={() => {
              if (isSettingsAuthenticated) {
                setActiveTab('settings');
              } else {
                setShowSettingsPasswordModal(true);
              }
            }}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'settings' ? 'bg-white text-[#10733A] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
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
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <p className="text-sm text-slate-500">Contributor Day Ticket</p>
                <p className="text-2xl font-bold text-[#10733A]">
                  {loadingData ? '...' : (() => {
                    const contributorTickets = attendees.filter(a => a.ticketType === 'Contributor Day Ticket');
                    const checkedIn = contributorTickets.filter(a => a.checkedIn).length;
                    return contributorTickets.length > 0 
                      ? `${Math.round((checkedIn / contributorTickets.length) * 100)}%`
                      : 'N/A';
                  })()}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {loadingData ? '' : (() => {
                    const contributorTickets = attendees.filter(a => a.ticketType === 'Contributor Day Ticket');
                    const checkedIn = contributorTickets.filter(a => a.checkedIn).length;
                    return contributorTickets.length > 0 
                      ? `${checkedIn} / ${contributorTickets.length}`
                      : 'No tickets';
                  })()}
                </p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <p className="text-sm text-slate-500">Other Tickets</p>
                <p className="text-2xl font-bold text-[#11723A]">
                  {loadingData ? '...' : (() => {
                    const otherTickets = attendees.filter(a => a.ticketType !== 'Contributor Day Ticket');
                    const checkedIn = otherTickets.filter(a => a.checkedIn).length;
                    return otherTickets.length > 0 
                      ? `${Math.round((checkedIn / otherTickets.length) * 100)}%`
                      : 'N/A';
                  })()}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {loadingData ? '' : (() => {
                    const otherTickets = attendees.filter(a => a.ticketType !== 'Contributor Day Ticket');
                    const checkedIn = otherTickets.filter(a => a.checkedIn).length;
                    return otherTickets.length > 0 
                      ? `${checkedIn} / ${otherTickets.length}`
                      : 'No tickets';
                  })()}
                </p>
              </div>
            </div>

            {/* Quick Report Toggle */}
            {!loadingData && attendees.length > 0 && (
              <div className="flex justify-end">
                <button
                  onClick={() => setShowQuickReport(!showQuickReport)}
                  className="flex items-center gap-2 bg-[#10733A] hover:bg-[#10733A]/90 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  <BarChart3 className="w-4 h-4" />
                  {showQuickReport ? 'Hide Quick Report' : 'Show Quick Report'}
                </button>
              </div>
            )}

            {/* Quick Report */}
            {showQuickReport && !loadingData && attendees.length > 0 && (
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm animate-fade-in">
                <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-[#10733A]" />
                  Quick Report
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Check-In Statistics */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Check-In Status</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600">Total Registered:</span>
                        <span className="font-bold text-slate-800">{attendees.length}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600">Checked In:</span>
                        <span className="font-bold text-green-600">{attendees.filter(a => a.checkedIn).length}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600">Not Checked In:</span>
                        <span className="font-bold text-slate-600">{attendees.filter(a => !a.checkedIn).length}</span>
                      </div>
                      <div className="pt-2 border-t border-slate-200 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-700 font-medium">Overall Rate:</span>
                          <span className="font-bold text-[#10733A] text-lg">
                            {Math.round((attendees.filter(a => a.checkedIn).length / attendees.length) * 100)}%
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">
                          {attendees.filter(a => a.checkedIn).length} out of {attendees.length} attendees
                        </p>
                      </div>
                      <div className="pt-2 border-t border-slate-200 space-y-2">
                        {(() => {
                          const contributorTickets = attendees.filter(a => a.ticketType === 'Contributor Day Ticket');
                          const contributorCheckedIn = contributorTickets.filter(a => a.checkedIn).length;
                          return (
                            <>
                              <div className="flex justify-between items-center">
                                <span className="text-slate-700 font-medium text-xs">Contributor Day Ticket:</span>
                                <span className="font-bold text-[#10733A]">
                                  {contributorTickets.length > 0 
                                    ? `${Math.round((contributorCheckedIn / contributorTickets.length) * 100)}%`
                                    : 'N/A'}
                                </span>
                              </div>
                              <p className="text-xs text-slate-400">
                                {contributorTickets.length > 0 
                                  ? `${contributorCheckedIn} / ${contributorTickets.length}`
                                  : 'No tickets'}
                              </p>
                            </>
                          );
                        })()}
                      </div>
                      <div className="pt-2 border-t border-slate-200 space-y-2">
                        {(() => {
                          const otherTickets = attendees.filter(a => a.ticketType !== 'Contributor Day Ticket');
                          const otherCheckedIn = otherTickets.filter(a => a.checkedIn).length;
                          return (
                            <>
                              <div className="flex justify-between items-center">
                                <span className="text-slate-700 font-medium text-xs">Other Tickets:</span>
                                <span className="font-bold text-[#11723A]">
                                  {otherTickets.length > 0 
                                    ? `${Math.round((otherCheckedIn / otherTickets.length) * 100)}%`
                                    : 'N/A'}
                                </span>
                              </div>
                              <p className="text-xs text-slate-400">
                                {otherTickets.length > 0 
                                  ? `${otherCheckedIn} / ${otherTickets.length}`
                                  : 'No tickets'}
                              </p>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Country Statistics */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Countries (Today)</h4>
                    <div className="space-y-4 max-h-64 overflow-y-auto">
                      {(() => {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        
                        // Contributor Day Ticket countries
                        const contributorCountryCounts = new Map<string, number>();
                        // Other tickets countries
                        const otherCountryCounts = new Map<string, number>();
                        
                        attendees.forEach(a => {
                          // Only count countries from attendees who checked in today
                          if (a.country && a.checkedIn && a.checkInTime) {
                            const checkInDate = new Date(a.checkInTime);
                            checkInDate.setHours(0, 0, 0, 0);
                            
                            // Check if check-in was today
                            if (checkInDate.getTime() === today.getTime()) {
                              if (a.ticketType === 'Contributor Day Ticket') {
                                contributorCountryCounts.set(a.country, (contributorCountryCounts.get(a.country) || 0) + 1);
                              } else {
                                otherCountryCounts.set(a.country, (otherCountryCounts.get(a.country) || 0) + 1);
                              }
                            }
                          }
                        });
                        
                        const sortedContributorCountries = Array.from(contributorCountryCounts.entries())
                          .sort((a, b) => b[1] - a[1])
                          .slice(0, 5);
                        const sortedOtherCountries = Array.from(otherCountryCounts.entries())
                          .sort((a, b) => b[1] - a[1])
                          .slice(0, 5);
                        
                        if (contributorCountryCounts.size === 0 && otherCountryCounts.size === 0) {
                          return <p className="text-sm text-slate-400 italic">No country data for today's check-ins</p>;
                        }
                        
                        return (
                          <>
                            {/* Contributor Day Ticket Countries */}
                            {contributorCountryCounts.size > 0 && (
                              <div className="space-y-2">
                                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Contributor Day Ticket</p>
                                {sortedContributorCountries.map(([country, count]) => (
                                  <div key={`contributor-${country}`} className="flex justify-between items-center">
                                    <span className="text-slate-600 truncate flex-1 text-sm">{country}</span>
                                    <span className="font-bold text-[#10733A] ml-2">{count}</span>
                                  </div>
                                ))}
                                {contributorCountryCounts.size > 5 && (
                                  <p className="text-xs text-slate-400 pt-1">
                                    +{contributorCountryCounts.size - 5} more
                                  </p>
                                )}
                                <div className="pt-1 border-t border-slate-200">
                                  <div className="flex justify-between items-center">
                                    <span className="text-slate-700 font-medium text-xs">Total:</span>
                                    <span className="font-bold text-[#10733A] text-xs">{contributorCountryCounts.size}</span>
                                  </div>
                                </div>
                              </div>
                            )}
                            
                            {/* Other Tickets Countries */}
                            {otherCountryCounts.size > 0 && (
                              <div className="space-y-2 pt-2 border-t border-slate-200">
                                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Other Tickets</p>
                                {sortedOtherCountries.map(([country, count]) => (
                                  <div key={`other-${country}`} className="flex justify-between items-center">
                                    <span className="text-slate-600 truncate flex-1 text-sm">{country}</span>
                                    <span className="font-bold text-[#11723A] ml-2">{count}</span>
                                  </div>
                                ))}
                                {otherCountryCounts.size > 5 && (
                                  <p className="text-xs text-slate-400 pt-1">
                                    +{otherCountryCounts.size - 5} more
                                  </p>
                                )}
                                <div className="pt-1 border-t border-slate-200">
                                  <div className="flex justify-between items-center">
                                    <span className="text-slate-700 font-medium text-xs">Total:</span>
                                    <span className="font-bold text-[#11723A] text-xs">{otherCountryCounts.size}</span>
                                  </div>
                                </div>
                              </div>
                            )}
                            
                            {/* Overall Total */}
                            <div className="pt-2 border-t-2 border-slate-300">
                              <div className="flex justify-between items-center">
                                <span className="text-slate-700 font-semibold text-sm">Total Countries (Today):</span>
                                <span className="font-bold text-[#10733A] text-sm">{contributorCountryCounts.size + otherCountryCounts.size}</span>
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* First Time Attending Statistics */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">First Time Attending</h4>
                    <div className="space-y-2">
                      {(() => {
                        const firstTime = attendees.filter(a => 
                          a.firstTimeAttending?.toLowerCase().trim() === 'yes'
                        ).length;
                        const notFirstTime = attendees.filter(a => 
                          a.firstTimeAttending && a.firstTimeAttending.toLowerCase().trim() !== 'yes'
                        ).length;
                        const unknown = attendees.filter(a => !a.firstTimeAttending).length;
                        
                        return (
                          <>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-600">First Time:</span>
                              <span className="font-bold text-green-600">{firstTime}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-600">Not First Time:</span>
                              <span className="font-bold text-slate-600">{notFirstTime}</span>
                            </div>
                            {unknown > 0 && (
                              <div className="flex justify-between items-center">
                                <span className="text-slate-600">Unknown:</span>
                                <span className="font-bold text-slate-400">{unknown}</span>
                              </div>
                            )}
                            <div className="pt-2 border-t border-slate-200">
                              <div className="flex justify-between items-center">
                                <span className="text-slate-700 font-medium">First Time Rate:</span>
                                <span className="font-bold text-[#10733A] text-lg">
                                  {firstTime + notFirstTime > 0 
                                    ? `${Math.round((firstTime / (firstTime + notFirstTime)) * 100)}%`
                                    : 'N/A'}
                                </span>
                              </div>
                              <p className="text-xs text-slate-400 mt-1">
                                {firstTime} out of {firstTime + notFirstTime} responses
                              </p>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
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
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 focus:border-[#11723A]/60 focus:ring-2 focus:ring-[#11723A]/10 outline-none transition-all"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="relative w-full md:w-48">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <select 
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 focus:border-[#11723A]/60 focus:ring-2 focus:ring-[#11723A]/10 outline-none appearance-none bg-white"
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                >
                  <option value="all">All Ticket Types</option>
                  {allTicketTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div className="relative w-full md:w-48">
                <CheckCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <select 
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 focus:border-[#11723A]/60 focus:ring-2 focus:ring-[#11723A]/10 outline-none appearance-none bg-white"
                  value={filterCheckIn}
                  onChange={(e) => setFilterCheckIn(e.target.value)}
                >
                  <option value="all">All Status</option>
                  <option value="checked-in">Checked In</option>
                  <option value="not-checked-in">Not Checked In</option>
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
                      <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</th>
                      <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Country</th>
                      <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Alerts</th>
                      <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loadingData ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                           <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                           Loading data...
                        </td>
                      </tr>
                    ) : filteredAttendees.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                          No attendees found.
                        </td>
                      </tr>
                    ) : ( 
                      paginatedAttendees.map((attendee) => {
                        const allergy = attendee.severeAllergy?.toLowerCase().trim() || '';
                        const accessibility = attendee.accessibilityNeeds?.toLowerCase().trim() || '';
                        const hasAllergy = allergy.includes('yes');
                        const hasAccessibility = accessibility.includes('yes');
                        const hasWarning = hasAllergy || hasAccessibility;
                        
                        return (
                          <tr key={attendee.id} className={`hover:bg-slate-50 transition-colors ${hasWarning ? 'bg-red-50/30' : ''}`}>
                            <td className="px-6 py-4">
                              <div className="flex flex-col gap-1.5">
                                <span className="font-medium text-slate-800">
                                  {attendee.firstName} {attendee.lastName}
                                </span>
                                <span className="inline-flex items-center w-fit px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                  {attendee.ticketType}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col gap-1">
                                <span className="text-slate-500 text-sm">{attendee.email}</span>
                                {attendee.purchaseDate && (
                                  <span className="text-xs text-slate-400">Purchased: {attendee.purchaseDate}</span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-slate-600 text-sm">
                              {attendee.country || (
                                <span className="text-slate-400 italic">Not set</span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              {hasWarning && (
                                <div className="flex items-center gap-2">
                                  {hasAllergy && (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-700 border border-red-200">
                                      <AlertTriangle className="w-3 h-3" />
                                      Allergy
                                    </span>
                                  )}
                                  {hasAccessibility && (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-700 border border-red-200">
                                      <AlertTriangle className="w-3 h-3" />
                                      Accessibility
                                    </span>
                                  )}
                                </div>
                              )}
                              {!hasWarning && (
                                <span className="text-slate-400 text-xs">—</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => openEditModal(attendee)}
                                  className="inline-flex items-center gap-1 px-2 py-1.5 rounded text-sm text-slate-600 hover:bg-slate-100 border border-slate-200 transition-all"
                                  title="Edit country and notes"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => manualCheckIn(attendee.id, attendee.checkedIn)}
                                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                                    attendee.checkedIn 
                                      ? 'bg-green-100 text-green-700 hover:bg-green-200 border border-green-200 whitespace-nowrap' 
                                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 whitespace-nowrap'
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
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between bg-white px-6 py-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="text-sm text-slate-600">
                  Showing <span className="font-medium">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to{' '}
                  <span className="font-medium">
                    {Math.min(currentPage * ITEMS_PER_PAGE, filteredAttendees.length)}
                  </span>{' '}
                  of <span className="font-medium">{filteredAttendees.length}</span> {searchQuery.trim() ? 'results' : 'attendees'}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(page => {
                        // Show first page, last page, current page, and pages around current
                        return (
                          page === 1 ||
                          page === totalPages ||
                          (page >= currentPage - 1 && page <= currentPage + 1)
                        );
                      })
                      .map((page, index, array) => {
                        // Add ellipsis if there's a gap
                        const showEllipsisBefore = index > 0 && array[index] - array[index - 1] > 1;
                        return (
                          <React.Fragment key={page}>
                            {showEllipsisBefore && (
                              <span className="px-2 text-slate-400">...</span>
                            )}
                            <button
                              onClick={() => setCurrentPage(page)}
                              className={`px-3 py-2 rounded-lg border transition-colors ${
                                currentPage === page
                                  ? 'bg-[#10733A] text-white border-[#10733A]'
                                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                              }`}
                            >
                              {page}
                            </button>
                          </React.Fragment>
                        );
                      })}
                  </div>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-2xl mx-auto space-y-8">
            {/* CSV Import */}
            <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Database className="w-5 h-5 text-[#10733A]" />
                Data Management
              </h2>
              <div className="p-8 border-2 border-dashed border-slate-300 rounded-lg hover:border-[#11723A]/40 transition-colors bg-slate-50 text-center relative">
                {loadingData && (
                   <div className="absolute inset-0 bg-white/50 flex items-center justify-center">
                     <RefreshCw className="w-8 h-8 animate-spin text-[#10733A]" />
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
                  <div className="w-12 h-12 rounded-full bg-[#11723A]/10 flex items-center justify-center text-[#10733A]">
                    <Upload className="w-6 h-6" />
                  </div>
                  <span className="text-sm font-medium text-slate-700">Upload CSV to Update DB</span>
                  <span className="text-xs text-slate-400">Format: Attendee ID, Ticket Type, First Name, Last Name, E-mail Address, Purchase date, Country, Severe allergy, Accessibility needs, First Time Attending, Notes</span>
                </label>
              </div>
            </section>

            {/* Daily Config */}
            <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-[#10733A]" />
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
                        className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-slate-300 transition-all checked:border-[#11723A]/60 checked:bg-[#10733A]"
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

      {/* Edit Modal */}
      {editingAttendee && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-800">
                Edit: {editingAttendee.firstName} {editingAttendee.lastName}
              </h2>
              <button
                onClick={closeEditModal}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Allergy/Accessibility Warning */}
              {(() => {
                const allergy = editingAttendee.severeAllergy?.toLowerCase().trim() || '';
                const accessibility = editingAttendee.accessibilityNeeds?.toLowerCase().trim() || '';
                const hasAllergy = allergy.includes('yes');
                const hasAccessibility = accessibility.includes('yes');
                
                return (hasAllergy || hasAccessibility) && (
                  <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <h3 className="text-red-800 font-semibold text-sm mb-1">⚠️ Important Notice</h3>
                        <ul className="text-red-700 text-sm space-y-1">
                          {hasAllergy && (
                            <li>• Severe Allergy: {editingAttendee.severeAllergy}</li>
                          )}
                          {hasAccessibility && (
                            <li>• Accessibility Needs: {editingAttendee.accessibilityNeeds}</li>
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Country Selector */}
              <div>
                <label className="text-sm font-semibold text-slate-700 mb-2 block">
                  Country
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={countrySearch}
                    onChange={(e) => setCountrySearch(e.target.value)}
                    onFocus={() => setCountrySearch('')}
                    placeholder="Search for country..."
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:border-[#11723A]/60 focus:ring-2 focus:ring-[#11723A]/10 outline-none transition-all"
                  />
                </div>
                {countrySearch && filteredCountries.length > 0 && (
                  <div className="mt-2 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg">
                    {filteredCountries.map((country) => (
                      <button
                        key={country}
                        type="button"
                        onClick={() => {
                          setEditCountry(country);
                          setCountrySearch('');
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-[#11723A]/10 hover:text-[#11723A] transition-colors text-sm border-b border-slate-100 last:border-b-0"
                      >
                        {country}
                      </button>
                    ))}
                  </div>
                )}
                {!countrySearch && (
                  <div className="mt-2 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg">
                    {filteredCountries.map((country) => (
                      <button
                        key={country}
                        type="button"
                        onClick={() => {
                          setEditCountry(country);
                          setCountrySearch('');
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-[#11723A]/10 hover:text-[#11723A] transition-colors text-sm border-b border-slate-100 last:border-b-0"
                      >
                        {country}
                      </button>
                    ))}
                  </div>
                )}
                {editCountry && (
                  <div className="mt-2 px-3 py-2 bg-[#11723A]/10 border border-[#11723A]/20 rounded-lg text-sm text-[#11723A]">
                    Selected: <span className="font-medium">{editCountry}</span>
                  </div>
                )}
              </div>

              {/* Notes Field */}
              <div>
                <label className="text-sm font-semibold text-slate-700 mb-2 block">
                  Notes {(() => {
                    const allergy = editingAttendee.severeAllergy?.toLowerCase().trim() || '';
                    const accessibility = editingAttendee.accessibilityNeeds?.toLowerCase().trim() || '';
                    return (allergy.includes('yes') || accessibility.includes('yes'))
                      ? '(Allergy/Accessibility notes)' : '';
                  })()}
                </label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Add notes about allergies, accessibility needs, or other important information..."
                  rows={4}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:border-[#11723A]/60 focus:ring-2 focus:ring-[#11723A]/10 outline-none transition-all resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={closeEditModal}
                  className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveAttendeeFields}
                  className="flex-1 px-4 py-2.5 bg-[#10733A] hover:bg-[#10733A]/90 text-white font-medium rounded-lg transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Password Modal */}
      {showSettingsPasswordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
            {/* Header */}
            <div className="bg-[#10733A] p-8 text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
              <div className="relative z-10">
                <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl mx-auto flex items-center justify-center mb-4">
                  <Lock className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-white">Settings Access</h1>
                <p className="text-white text-sm mt-1">Enter password to access settings</p>
              </div>
            </div>

            <div className="p-8">
              <form onSubmit={handleSettingsPasswordSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 ml-1">Password</label>
                  <input
                    type="password"
                    required
                    value={settingsPassword}
                    onChange={(e) => {
                      setSettingsPassword(e.target.value);
                      setSettingsPasswordError('');
                    }}
                    placeholder="Enter settings password"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#11723A]/60 focus:ring-4 focus:ring-[#11723A]/10 outline-none transition-all"
                    autoFocus
                  />
                  {settingsPasswordError && (
                    <p className="text-sm text-red-600 mt-1">{settingsPasswordError}</p>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowSettingsPasswordModal(false);
                      setSettingsPassword('');
                      setSettingsPasswordError('');
                    }}
                    className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-[#10733A] hover:bg-[#10733A]/90 text-white font-semibold py-3 rounded-xl shadow-lg shadow-[#11723A]/20 transition-all"
                  >
                    Access Settings
                  </button>
                </div>
              </form>
            </div>

            {/* Footer */}
            <div className="bg-slate-50 p-4 border-t border-slate-100 text-center">
              <p className="text-xs text-slate-400">Protected Settings Area</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
