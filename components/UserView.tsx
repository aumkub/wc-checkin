import React, { useState, useMemo, useEffect } from 'react';
import { QrCode, Mail, CheckCircle2, AlertCircle, ArrowRight, Search, AlertTriangle } from 'lucide-react';
import { Attendee, CheckInResult } from '../types';
import * as Storage from '../services/storage';
import { COUNTRIES } from '../constants/countries';
import QRCode from 'qrcode';
import { supabase } from '../services/supabaseClient';

export const UserView: React.FC = () => {
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('');
  const [showCountrySelector, setShowCountrySelector] = useState(false);
  const [savingCountry, setSavingCountry] = useState(false);
  const [pendingCheckIn, setPendingCheckIn] = useState<{ email: string; validTickets: Attendee[] } | null>(null);
  const [checkedInTickets, setCheckedInTickets] = useState<Attendee[]>([]);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      // 1. Fetch Config
      const config = await Storage.getTicketConfig();
      
      // 2. Fetch User by Email
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

      // 3.5. Check if all valid tickets are already checked in
      const allCheckedIn = validTicketsForToday.every(t => t.checkedIn === true);
      if (allCheckedIn) {
        // Fetch latest attendee data to get current swagReceived status
        const latestTickets = await Storage.getAttendeesByEmail(email);
        const latestValidTickets = latestTickets.filter(t => config.activeTypes.includes(t.ticketType));
        const firstTicket = latestValidTickets[0] || validTicketsForToday[0];
        
        setCheckedInTickets(latestValidTickets.length > 0 ? latestValidTickets : validTicketsForToday);
        setResult({
          success: true,
          message: "You are already checked in!",
          attendee: firstTicket,
          checkedInTypes: latestValidTickets.length > 0 ? latestValidTickets.map(t => t.ticketType) : validTicketsForToday.map(t => t.ticketType),
          alreadyCheckedIn: true
        });
        setSelectedCountry(firstTicket.country || '');
        
        // Only generate QR code if swag hasn't been received yet AND ticket type is NOT Contributor Day Ticket
        if (!firstTicket.swagReceived && firstTicket.ticketType !== 'Contributor Day Ticket') {
          // Generate QR code for already checked-in users
          const token = Storage.generateSecureToken(firstTicket.id, email);
          const baseUrl = window.location.origin + window.location.pathname.replace(/\/$/, '');
          const qrUrl = `${baseUrl}#/swag/${token}`;
          try {
            const qrDataUrl = await QRCode.toDataURL(qrUrl, { width: 300, margin: 2 });
            setQrCodeDataUrl(qrDataUrl);
          } catch (qrError) {
            console.error('QR Code generation error', qrError);
          }
        } else {
          setQrCodeDataUrl(null);
        }
        
        setLoading(false);
        return;
      }

      // 4. Check if any ticket has a country set
      const hasCountry = validTicketsForToday.some(t => t.country && t.country.trim() !== '');

      // 5. If no country, require country selection first
      if (!hasCountry) {
        setPendingCheckIn({ email, validTickets: validTicketsForToday });
        setShowCountrySelector(true);
        setLoading(false);
        return;
      }

      // 6. Perform Check-in in DB
      await performCheckIn(email, config.activeTypes, validTicketsForToday);

    } catch (error) {
      console.error("Checkin Error", error);
      setResult({
        success: false,
        message: "An unexpected error occurred."
      });
      setLoading(false);
    }
  };

  const performCheckIn = async (email: string, activeTypes: string[], validTickets: Attendee[]) => {
    setLoading(true);
    try {
      const success = await Storage.checkInUserTickets(email, activeTypes);

      if (success) {
        // Fetch latest attendee data to get current swagReceived status
        const latestTickets = await Storage.getAttendeesByEmail(email);
        const latestValidTickets = latestTickets.filter(t => activeTypes.includes(t.ticketType));
        const attendee = latestValidTickets[0] || validTickets[0];
        
        // Store all checked-in tickets for warning check
        setCheckedInTickets(latestValidTickets.length > 0 ? latestValidTickets : validTickets);
        setResult({
          success: true,
          message: "",
          attendee: attendee,
          checkedInTypes: latestValidTickets.length > 0 ? latestValidTickets.map(t => t.ticketType) : validTickets.map(t => t.ticketType)
        });
        setSelectedCountry(attendee.country || '');
        setPendingCheckIn(null);
        
        // Only generate QR code if swag hasn't been received yet AND ticket type is NOT Contributor Day Ticket
        if (!attendee.swagReceived && attendee.ticketType !== 'Contributor Day Ticket') {
          // Generate QR code with secure token
          const token = Storage.generateSecureToken(attendee.id, email);
          // Use hash router format for the QR code URL
          const baseUrl = window.location.origin + window.location.pathname.replace(/\/$/, '');
          const qrUrl = `${baseUrl}#/swag/${token}`;
          try {
            const qrDataUrl = await QRCode.toDataURL(qrUrl, { width: 300, margin: 2 });
            setQrCodeDataUrl(qrDataUrl);
          } catch (qrError) {
            console.error('QR Code generation error', qrError);
          }
        } else {
          setQrCodeDataUrl(null);
        }
      } else {
        setResult({
          success: false,
          message: "A database error occurred during check-in. Please try again or contact support."
        });
        setCheckedInTickets([]);
        setQrCodeDataUrl(null);
      }
    } catch (error) {
      console.error("Checkin Error", error);
      setResult({
        success: false,
        message: "An unexpected error occurred."
      });
      setCheckedInTickets([]);
      setQrCodeDataUrl(null);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setEmail('');
    setResult(null);
    setCountrySearch('');
    setSelectedCountry('');
    setShowCountrySelector(false);
    setPendingCheckIn(null);
    setCheckedInTickets([]);
    setQrCodeDataUrl(null);
  };

  const filteredCountries = useMemo(() => {
    if (!countrySearch) return COUNTRIES.slice(0, 10); // Show first 10 when no search
    const searchLower = countrySearch.toLowerCase();
    return COUNTRIES.filter(country => 
      country.toLowerCase().includes(searchLower)
    ).slice(0, 10);
  }, [countrySearch]);

  const handleCountrySelect = async (country: string) => {
    setSavingCountry(true);
    
    // Determine which email to use
    const emailToUse = pendingCheckIn?.email || result?.attendee?.email;
    if (!emailToUse) {
      setSavingCountry(false);
      return;
    }
    
    // Update country for all tickets with this email
    const success = await Storage.updateAttendeeCountryByEmail(emailToUse, country);
    
    if (success) {
      setSelectedCountry(country);
      setCountrySearch('');
      
      // If we have pending check-in, proceed with check-in after country is set
      if (pendingCheckIn) {
        const config = await Storage.getTicketConfig();
        setShowCountrySelector(false);
        await performCheckIn(emailToUse, config.activeTypes, pendingCheckIn.validTickets.map(t => ({ ...t, country })));
      } else if (result?.attendee) {
        // Update the result attendee
        setResult({
          ...result,
          attendee: { ...result.attendee, country }
        });
        setShowCountrySelector(false);
      }
    }
    setSavingCountry(false);
  };

  const hasWarning = useMemo(() => {
    // Check pending check-in tickets first (before check-in)
    if (pendingCheckIn) {
      return pendingCheckIn.validTickets.some(ticket => {
        const allergy = ticket.severeAllergy?.toLowerCase().trim() || '';
        const accessibility = ticket.accessibilityNeeds?.toLowerCase().trim() || '';
        return allergy.includes('yes') || accessibility.includes('yes');
      });
    }
    
    // Check all tickets that were checked in (after check-in)
    if (checkedInTickets.length > 0) {
      return checkedInTickets.some(ticket => {
        const allergy = ticket.severeAllergy?.toLowerCase().trim() || '';
        const accessibility = ticket.accessibilityNeeds?.toLowerCase().trim() || '';
        return allergy.includes('yes') || accessibility.includes('yes');
      });
    }
    
    // Fallback to single attendee check
    if (result?.attendee) {
      const allergy = result.attendee.severeAllergy?.toLowerCase().trim() || '';
      const accessibility = result.attendee.accessibilityNeeds?.toLowerCase().trim() || '';
      return allergy.includes('yes') || accessibility.includes('yes');
    }
    
    return false;
  }, [result, pendingCheckIn, checkedInTickets]);

  // Real-time subscription for swag status updates
  useEffect(() => {
    if (!result?.attendee?.id) return;

    const attendeeId = result.attendee.id;

    const channel = supabase
      .channel(`swag-status-${attendeeId}`, {
        config: {
          broadcast: { self: true }
        }
      })
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'attendees',
          filter: `id=eq.${attendeeId}`
        },
        (payload) => {
          const updatedAttendee = payload.new as Attendee;
          const oldAttendee = payload.old as Attendee;
          
          // Always update the result with new attendee data
          setResult(prev => {
            if (!prev || !prev.attendee) return prev;
            return {
              ...prev,
              attendee: updatedAttendee
            };
          });
          
          // Check if swagReceived changed from false/undefined to true
          const oldSwagStatus = oldAttendee?.swagReceived ?? false;
          const newSwagStatus = updatedAttendee.swagReceived ?? false;
          
          // Hide QR code immediately when swag is received
          if (!oldSwagStatus && newSwagStatus) {
            setQrCodeDataUrl(null);
          }
          
          // Update checked in tickets if they exist
          setCheckedInTickets(prev => prev.map(t => 
            t.id === updatedAttendee.id ? updatedAttendee : t
          ));
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Real-time subscription active for swag status');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Real-time subscription error for swag status');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [result?.attendee?.id]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
        
        {/* Header Graphic */}
        <div className="bg-[#10733A] p-8 pt-4 text-center relative overflow-hidden">
          <div className="relative z-10">
            <div className="mx-auto flex items-center justify-center mb-2">
              {/* <QrCode className="w-8 h-8 text-white" /> */}
          <img
            src="/wapuu.webp"
            alt="Wapuu"
            className="w-24"
            draggable={false}
          />
            </div>
            <h1 className="text-2xl font-bold text-white">WordCamp Bangkok 2025</h1>
            <p className="text-white text-sm mt-1">Please enter your email to self check in</p>
          </div>
        </div>

        <div className="p-8">
          {!result && !showCountrySelector ? (
            <form onSubmit={handleCheckIn} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 ml-1">Email Address</label>
                <div className="relative group">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-[#11723A] transition-colors" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#11723A] focus:ring-4 focus:ring-[#11723A]/10 outline-none transition-all"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading || !email}
                className="w-full bg-[#10733A] hover:bg-[#10733A]/90 text-white font-semibold py-3.5 rounded-xl shadow-lg shadow-[#11723A]/20 disabled:opacity-50 disabled:shadow-none transition-all flex items-center justify-center gap-2 group"
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
          ) : showCountrySelector && pendingCheckIn ? (
            <div className="space-y-6 animate-fade-in">
              <div className="text-center">
                <h2 className="text-xl font-bold text-slate-800 mb-2">Select Your Country</h2>
                <p className="text-slate-600 text-sm">Please select your country before checking in.</p>
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700 mb-2 block">Country</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={countrySearch}
                    onChange={(e) => setCountrySearch(e.target.value)}
                    placeholder="Search for your country..."
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:border-[#11723A] focus:ring-2 focus:ring-[#11723A]/10 outline-none transition-all"
                  />
                </div>
                {countrySearch && filteredCountries.length > 0 && (
                  <div className="mt-2 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg">
                    {filteredCountries.map((country) => (
                      <button
                        key={country}
                        type="button"
                        onClick={() => handleCountrySelect(country)}
                        disabled={savingCountry}
                        className="w-full text-left px-4 py-2 hover:bg-[#11723A]/10 hover:text-[#11723A] transition-colors text-sm border-b border-slate-100 last:border-b-0 disabled:opacity-50"
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
                        onClick={() => handleCountrySelect(country)}
                        disabled={savingCountry}
                        className="w-full text-left px-4 py-2 hover:bg-[#11723A]/10 hover:text-[#11723A] transition-colors text-sm border-b border-slate-100 last:border-b-0 disabled:opacity-50"
                      >
                        {country}
                      </button>
                    ))}
                  </div>
                )}
                {savingCountry && (
                  <div className="mt-2 text-center">
                    <div className="w-5 h-5 border-2 border-[#11723A]/20 border-t-[#11723A]/60 rounded-full animate-spin mx-auto"></div>
                  </div>
                )}
              </div>
              <button
                onClick={reset}
                className="w-full text-slate-500 hover:text-slate-800 font-medium text-sm transition-colors py-2"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="text-center animate-fade-in-up">
              <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-4 ${result.success ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                {result.success ? <CheckCircle2 className="w-10 h-10" /> : <AlertCircle className="w-10 h-10" />}
              </div>
              
              <h2 className="text-2xl font-bold text-slate-800 mb-2">
                {result.success 
                  ? (result.alreadyCheckedIn 
                      ? `Hello, ${result.attendee?.firstName}!` 
                      : `Welcome, ${result.attendee?.firstName}!`)
                  : 'Check-In Failed'}
              </h2>


              {result.success && result.checkedInTypes && (
                <div className="bg-slate-50 rounded-lg p-4 mb-6 border border-slate-100">
                  <p className="text-xs text-slate-400 uppercase font-semibold mb-2">Tickets Activated</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {result.checkedInTypes.map((type, index) => (
                      <span key={`${type}-${index}`} className="inline-block px-3 py-1 bg-[#11723A]/10 text-[#11723A] text-xs font-semibold rounded-full border border-[#11723A]/20">
                        {type}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {result.success && qrCodeDataUrl && result.attendee && !result.attendee.swagReceived && 
               result.attendee.ticketType !== 'Contributor Day Ticket' && (
                <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-center">
                    <p className="text-sm font-semibold text-slate-700 mb-3">Swag Claim QR Code</p>
                    <div className="flex justify-center mb-2">
                      <img 
                        src={qrCodeDataUrl} 
                        alt="Swag Claim QR Code" 
                        className="w-48 h-48 border-4 border-white rounded-lg shadow-md"
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-4">
                      Show this QR code<br></br>at the swag claim station to receive your items
                    </p>
                  </div>
                </div>
              )}

              {result.success && result.attendee && result.attendee.swagReceived && (
                <div className="mb-6 p-4 bg-green-50 rounded-xl border-2 border-green-200">
                  <div className="text-center">
                    <img src="/wapuu-badge.png" alt="Wapuu Badge" className="w-20 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-green-800 mb-1">Swag Already Claimed</p>
                    <p className="text-xs text-green-700">
                      You have already received your swag. Thank you!
                    </p>
                  </div>
                </div>
              )}
              
              {result.alreadyCheckedIn ? (
                <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4 mb-6">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <img src="/Banner.png" alt="Banner" className="w-36 mx-auto mb-3" />
                  </div>
                  <p className="text-blue-900 font-semibold text-base">You Are Already Checked In</p>
                  <p className="text-blue-800 text-sm">
                    Your check-in was completed successfully. No further action is needed.
                  </p>
                </div>
              ) : (
                <p className="text-slate-600 mb-6 leading-relaxed">
                  {result.message}
                </p>
              )}

              {result.success && hasWarning && !result.alreadyCheckedIn && (
                <div className="bg-red-50 border-4 border-red-500 rounded-lg p-5 mb-6 animate-fade-in shadow-lg shadow-red-200/50">
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <h3 className="text-red-900 font-bold text-base mb-2 flex items-center gap-2">
                        <span className="text-xl">⚠️</span>
                        URGENT: Contact Staff Immediately
                      </h3>
                      <p className="text-red-800 text-sm font-medium leading-relaxed">
                        {(() => {
                          // Check all tickets being checked in
                          const ticketsToCheck = pendingCheckIn?.validTickets || checkedInTickets || (result?.attendee ? [result.attendee] : []);
                          
                          let hasAllergy = false;
                          let hasAccessibility = false;
                          
                          ticketsToCheck.forEach(ticket => {
                            const allergy = ticket.severeAllergy?.toLowerCase().trim() || '';
                            const accessibility = ticket.accessibilityNeeds?.toLowerCase().trim() || '';
                            if (allergy.includes('yes')) hasAllergy = true;
                            if (accessibility.includes('yes')) hasAccessibility = true;
                          });
                          
                          if (hasAllergy && hasAccessibility) {
                            return 'This attendee has severe allergies and accessibility needs. Please contact staff immediately for assistance.';
                          } else if (hasAllergy) {
                            return 'This attendee has severe allergies. Please contact staff immediately for assistance.';
                          } else {
                            return 'This attendee has accessibility needs. Please contact staff immediately for assistance.';
                          }
                        })()}
                      </p>
                      <div className="mt-3 pt-3 border-t border-red-300">
                        <p className="text-xs text-red-700 font-semibold uppercase tracking-wide">
                          Action Required: Staff Attention Needed
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {result.success && selectedCountry && (
                <div className="mb-6 text-sm text-slate-600">
                  <span className="font-medium">Country:</span> {selectedCountry}
                </div>
              )}

              <button
                onClick={reset}
                className="text-slate-500 hover:text-slate-800 font-medium text-sm transition-colors"
              >
                Back to Check-In
              </button>
            </div>
          )}
        </div> 
        
        {/* Footer */}
        <div className="bg-slate-50 p-4 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-400">#WCBKK2025</p>
        </div>
      </div>
    </div>
  );
};
