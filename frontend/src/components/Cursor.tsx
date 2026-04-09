import { useRef, useEffect } from 'react';

export default function Cursor() {
  const co = useRef<HTMLDivElement>(null);
  const ci = useRef<HTMLDivElement>(null);
  const mousePos = useRef({ x: 0, y: 0 });
  const outerPos = useRef({ x: 0, y: 0 });
  
  useEffect(() => {
    const mm = (e: MouseEvent) => {
      mousePos.current = { x: e.clientX, y: e.clientY };
      if (ci.current) { 
        ci.current.style.left = e.clientX + 'px'; 
        ci.current.style.top = e.clientY + 'px'; 
      }
    };
    document.addEventListener('mousemove', mm);
    
    let req: number;
    const loop = () => {
      outerPos.current.x += (mousePos.current.x - outerPos.current.x) * .13;
      outerPos.current.y += (mousePos.current.y - outerPos.current.y) * .13;
      if (co.current) { 
        co.current.style.left = outerPos.current.x + 'px'; 
        co.current.style.top = outerPos.current.y + 'px'; 
      }
      req = requestAnimationFrame(loop);
    };
    loop();
    
    return () => { 
      document.removeEventListener('mousemove', mm); 
      cancelAnimationFrame(req); 
    };
  }, []);
  
  return (
    <>
      <div className="cur-o" ref={co}></div>
      <div className="cur-i" ref={ci}></div>
    </>
  );
}
