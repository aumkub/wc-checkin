import React, { useState, useEffect, useRef } from 'react';
import { Camera, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import * as Storage from '../services/storage';
import { Attendee } from '../types';

interface SwagScanViewProps {
  onScanSuccess: (attendee: Attendee) => void;
  onClose: () => void;
}

export const SwagScanView: React.FC<SwagScanViewProps> = ({ onScanSuccess, onClose }) => {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const scannerId = 'swag-qr-scanner';

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const startScanning = async () => {
    try {
      setError(null);
      setSuccess(null);
      
      const html5QrCode = new Html5Qrcode(scannerId);
      html5QrCodeRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' }, // Use back camera on mobile
        {
          fps: 10,
          qrbox: { width: 250, height: 250 }
        },
        async (decodedText) => {
          // Stop scanning once we get a result
          await html5QrCode.stop();
          html5QrCodeRef.current = null;
          setScanning(false);

          // Extract token from URL if it's a full URL
          let token = decodedText;
          const urlMatch = decodedText.match(/swag\/([^\/\s]+)/);
          if (urlMatch) {
            token = urlMatch[1];
          }

          // Verify token and get attendee
          const tokenData = Storage.verifyToken(token);
          if (!tokenData) {
            setError('Invalid QR code. Please scan a valid check-in QR code.');
            return;
          }

          const attendee = await Storage.getAttendeeById(tokenData.attendeeId);
          if (!attendee) {
            setError('Attendee not found.');
            return;
          }

          if (!attendee.checkedIn) {
            setError('This attendee has not checked in yet.');
            return;
          }

          // Mark swag as received
          const success = await Storage.updateSwagReceived(attendee.id, true);
          if (success) {
            setSuccess(`${attendee.firstName} ${attendee.lastName} - Swag marked as received!`);
            onScanSuccess({ ...attendee, swagReceived: true });
            
            // Auto close after 2 seconds
            setTimeout(() => {
              onClose();
            }, 2000);
          } else {
            setError('Failed to update swag status. Please try again.');
          }
        },
        (errorMessage) => {
          // Ignore scanning errors (they're frequent during scanning)
        }
      );

      setScanning(true);
    } catch (err: any) {
      console.error('QR Scanner error', err);
      setError(err.message || 'Failed to start camera. Please ensure camera permissions are granted.');
      setScanning(false);
    }
  };

  const stopScanning = async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current = null;
      } catch (err) {
        console.error('Error stopping scanner', err);
      }
    }
    setScanning(false);
  };

  const handleClose = async () => {
    await stopScanning();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Camera className="w-5 h-5 text-[#10733A]" />
            Scan QR Code for Swag
          </h2>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 flex-1 flex flex-col items-center justify-center">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border-2 border-red-200 rounded-lg w-full">
              <div className="flex items-center gap-2 text-red-800">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm font-medium">{error}</p>
              </div>
            </div>
          )}

          {success && (
            <div className="mb-4 p-4 bg-green-50 border-2 border-green-200 rounded-lg w-full">
              <div className="flex items-center gap-2 text-green-800">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm font-medium">{success}</p>
              </div>
            </div>
          )}

          <div className="w-full mb-4">
            <div
              id={scannerId}
              className={`w-full ${scanning ? 'block' : 'hidden'}`}
              style={{ minHeight: '300px' }}
            />
            {!scanning && (
              <div className="w-full bg-slate-100 rounded-lg flex items-center justify-center" style={{ minHeight: '300px' }}>
                <div className="text-center">
                  <Camera className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-600 font-medium mb-2">Ready to Scan</p>
                  <p className="text-sm text-slate-500">Click Start to begin scanning QR codes</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3 w-full">
            {!scanning ? (
              <button
                onClick={startScanning}
                className="flex-1 bg-[#10733A] hover:bg-[#10733A]/90 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <Camera className="w-5 h-5" />
                Start Scanning
              </button>
            ) : (
              <button
                onClick={stopScanning}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
              >
                Stop Scanning
              </button>
            )}
            <button
              onClick={handleClose}
              className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-all"
            >
              Close
            </button>
          </div>

          <p className="text-xs text-slate-500 mt-4 text-center">
            Point your camera at the attendee's check-in QR code
          </p>
        </div>
      </div>
    </div>
  );
};
