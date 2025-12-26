import React, { useEffect, useState } from 'react';

interface CountdownTimerProps {
  initialSeconds: number;
  onComplete: () => void;
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({ initialSeconds, onComplete }) => {
  const [seconds, setSeconds] = useState(initialSeconds);

  useEffect(() => {
    if (seconds <= 0) {
      onComplete();
      return;
    }
    const timer = setInterval(() => {
      setSeconds(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [seconds, onComplete]);

  return (
    <div className="p-4 bg-yellow-900/20 border border-yellow-700/50 rounded-xl text-yellow-500 text-center">
      <p className="font-semibold text-sm">Hệ thống đang bận (Rate Limit).</p>
      <p className="text-xs mt-1 opacity-80">Vui lòng thử lại sau: <span className="font-mono text-lg font-bold">{seconds}s</span></p>
    </div>
  );
};