import { useEffect, useState } from 'react';

export default function StatusBar() {
  const [ist, setIst] = useState('');

  useEffect(() => {
    function tick() {
      const n = new Date();
      const p = (v: number) => String(v).padStart(2, '0');
      // IST = UTC + 5:30
      const utc = n.getTime() + n.getTimezoneOffset() * 60000;
      const istDate = new Date(utc + 5.5 * 3600000);
      setIst(`${p(istDate.getHours())}:${p(istDate.getMinutes())}:${p(istDate.getSeconds())} IST`);
    }
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="statusbar">
      <div className="status-item">
        <div className="s-dot green" />
        AI Model Online
      </div>
      <div className="status-item">
        <div className="s-dot blue" />
        Timesheet Linked
      </div>
      <div className="status-item" style={{ marginLeft: 'auto' }}>
        {ist}
      </div>
      <div className="status-item">v3.0.0 · Swift Ops</div>
    </div>
  );
}
