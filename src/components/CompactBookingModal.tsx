import React from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { CompactBookingForm } from './CompactBookingForm';

interface CompactBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (reservation: any) => void;
  user: FirebaseUser | null;
  initialTrajet?: string;
  initialBoat?: string;
  initialClass?: 'standard' | 'business' | 'vip';
  currency?: 'USD' | 'CDF';
}

export function CompactBookingModal({
  isOpen,
  onClose,
  onSuccess,
  user,
  initialTrajet = 'Goma Port Public ➔ Bukavu Ihusi',
  initialBoat = 'Mugote 1',
  initialClass = 'standard',
  currency = 'USD'
}: CompactBookingModalProps) {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <CompactBookingForm
          isModal={true}
          onClose={onClose}
          onSuccess={onSuccess}
          user={user}
          initialTrajet={initialTrajet}
          initialBoat={initialBoat}
          initialClass={initialClass}
          currency={currency}
        />
      </div>
    </div>
  );
}
