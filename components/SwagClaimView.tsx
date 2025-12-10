import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Gift, ArrowLeft } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import * as Storage from '../services/storage';
import { Attendee } from '../types';

export const SwagClaimView: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [attendee, setAttendee] = useState<Attendee | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const processToken = async () => {
      if (!token) {
        setError('Invalid QR code.');
        setLoading(false);
        return;
      }

      // Verify token
      const tokenData = Storage.verifyToken(token);
      if (!tokenData) {
        setError('Invalid or expired QR code. Please check in again to get a new QR code.');
        setLoading(false);
        return;
      }

      // Get attendee
      const attendeeData = await Storage.getAttendeeById(tokenData.attendeeId);
      if (!attendeeData) {
        setError('Attendee not found.');
        setLoading(false);
        return;
      }

      if (!attendeeData.checkedIn) {
        setError('You must check in first before claiming swag.');
        setLoading(false);
        return;
      }

      setAttendee(attendeeData);

      // If swag already received, show success
      if (attendeeData.swagReceived) {
        setSuccess(true);
        setLoading(false);
        return;
      }

      // Mark swag as received
      const updateSuccess = await Storage.updateSwagReceived(attendeeData.id, true);
      if (updateSuccess) {
        setSuccess(true);
        setAttendee({ ...attendeeData, swagReceived: true });
      } else {
        setError('Failed to update swag status. Please contact support.');
      }

      setLoading(false);
    };

    processToken();
  }, [token]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="bg-[#10733A] p-8 text-center relative overflow-hidden">
          <div className="relative z-10">
            <div className="mx-auto flex items-center justify-center mb-2">
              <img
                src="/wapuu.webp"
                alt="Wapuu"
                className="w-24"
                draggable={false}
              />
            </div>
            <h1 className="text-2xl font-bold text-white">WordCamp Bangkok 2025</h1>
            <p className="text-white text-sm mt-1">Swag Claim</p>
          </div>
        </div>

        <div className="p-8">
          {loading ? (
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-[#11723A]/20 border-t-[#10733A] rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-slate-600">Processing...</p>
            </div>
          ) : error ? (
            <div className="text-center animate-fade-in">
              <div className="w-20 h-20 mx-auto rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4">
                <AlertCircle className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">Error</h2>
              <p className="text-slate-600 mb-6">{error}</p>
              <button
                onClick={() => navigate('/')}
                className="text-slate-500 hover:text-slate-800 font-medium text-sm transition-colors flex items-center gap-2 mx-auto"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Check-In
              </button>
            </div>
          ) : success && attendee ? (
            <div className="text-center animate-fade-in">
              <div className="w-20 h-20 mx-auto rounded-full bg-green-100 text-green-600 flex items-center justify-center mb-4">
                <Gift className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">
                {attendee.swagReceived ? 'Swag Already Claimed!' : 'Swag Claimed!'}
              </h2>
              <p className="text-slate-600 mb-4">
                {attendee.firstName} {attendee.lastName}
              </p>
              <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <p className="text-green-900 font-semibold">
                    {attendee.swagReceived ? 'You have already received your swag!' : 'Your swag has been marked as received!'}
                  </p>
                </div>
                <p className="text-green-800 text-sm">
                  Please proceed to the swag station to collect your items.
                </p>
              </div>
              <button
                onClick={() => navigate('/')}
                className="text-slate-500 hover:text-slate-800 font-medium text-sm transition-colors flex items-center gap-2 mx-auto"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Check-In
              </button>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 p-4 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-400">#WCBKK2025</p>
        </div>
      </div>
    </div>
  );
};
