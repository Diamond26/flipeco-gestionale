import React from 'react';
import { Step } from '../types';
import { Check } from 'lucide-react';

interface PremiumStepperProps {
  current: Step;
}

export function PremiumStepper({ current }: PremiumStepperProps) {
  const steps = [
    { n: 1, id: 'upload', label: 'Carica File' },
    { n: 2, id: 'mapping', label: 'Mappa Colonne' },
    { n: 3, id: 'review', label: 'Revisiona e Salva' },
  ];

  const currentIdx = current === 'upload' ? 1 : current === 'mapping' ? 2 : current === 'review' ? 3 : 4;

  const titles: Record<number, string> = {
    1: 'Upload File',
    2: 'Map Columns',
    3: 'Review & Save',
    4: 'Completed'
  };

  return (
    <div className="w-full mb-12 flex flex-col items-center animate-fade-in">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-white tracking-wide mb-2 drop-shadow-lg">
          Premium Import - Step {currentIdx > 3 ? 3 : currentIdx}: {titles[currentIdx > 3 ? 3 : currentIdx]}
        </h1>
        <p className="text-white/40 text-[15px]">
          Redesigning the Flip&Co supplier product import process.
        </p>
      </div>

      <div className="flex items-center justify-center relative w-full max-w-[600px]">
        {steps.map((s, idx) => {
          const isCompleted = s.n < currentIdx;
          const isActive = s.n === currentIdx;

          return (
            <React.Fragment key={s.id}>
              {/* Step Circle */}
              <div className="relative flex flex-col items-center z-10 w-24">
                <div
                  className={`
                    w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-500
                    ${isActive ? 'bg-[#7BB35F] text-[#0a0f12] shadow-[0_0_20px_rgba(123,179,95,0.6)] ring-4 ring-[#7BB35F]/20' : ''}
                    ${isCompleted ? 'bg-[#7BB35F] text-[#0a0f12] shadow-[0_0_15px_rgba(123,179,95,0.4)]' : ''}
                    ${!isActive && !isCompleted ? 'bg-white/5 border border-white/10 text-white/30' : ''}
                  `}
                >
                  {isCompleted ? <Check className="w-5 h-5" strokeWidth={3} /> : s.n}
                </div>
                <span
                  className={`absolute top-14 text-xs font-semibold whitespace-nowrap tracking-wider transition-colors duration-500
                    ${isActive || isCompleted ? 'text-white' : 'text-white/30'}
                  `}
                >
                  {s.n}. {s.label}
                </span>
              </div>

              {/* Connecting Line */}
              {idx < steps.length - 1 && (
                <div className="flex-1 h-[2px] mx-[-15px] z-0 -mt-7 relative">
                  {/* Base line */}
                  <div className="absolute inset-0 bg-white/5" />
                  {/* Progress line */}
                  <div
                    className="absolute inset-0 bg-[#7BB35F] shadow-[0_0_10px_rgba(123,179,95,0.5)] transition-all duration-700 ease-out"
                    style={{ width: isCompleted ? '100%' : '0%' }}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
