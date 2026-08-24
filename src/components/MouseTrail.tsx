import { useEffect, useRef } from 'react';

interface TrailPoint {
  x: number;
  y: number;
  life: number;
  size: number;
}

const MouseTrail = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointsRef = useRef<TrailPoint[]>([]);
  const frameRef = useRef<number>();

  useEffect(() => {
    const isTouchOrMobile =
      window.matchMedia('(pointer: coarse)').matches ||
      window.innerWidth < 768 ||
      'ontouchstart' in window;

    if (isTouchOrMobile) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;

    const resize = () => {
      canvas.width = window.innerWidth * window.devicePixelRatio;
      canvas.height = window.innerHeight * window.devicePixelRatio;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
    };

    const addPoint = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      pointsRef.current.push({
        x: event.clientX,
        y: event.clientY,
        life: 1,
        size: Math.random() * 6 + 7,
      });
      if (pointsRef.current.length > 24) pointsRef.current.shift();
    };

    const animate = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      pointsRef.current = pointsRef.current
        .map((point) => ({ ...point, life: point.life - 0.04, y: point.y - 0.2 }))
        .filter((point) => point.life > 0);

      pointsRef.current.forEach((point, index) => {
        const alpha = Math.max(point.life, 0);
        const radius = point.size * alpha;
        const gradient = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius);
        gradient.addColorStop(0, `rgba(255, 238, 202, ${alpha * 0.8})`);
        gradient.addColorStop(0.4, `rgba(248, 113, 113, ${alpha * 0.4})`);
        gradient.addColorStop(1, `rgba(127, 29, 29, 0)`);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
        ctx.fill();

        const previous = pointsRef.current[index - 1];
        if (previous) {
          ctx.strokeStyle = `rgba(239, 68, 68, ${alpha * 0.15})`;
          ctx.lineWidth = Math.max(1, alpha * 2.5);
          ctx.beginPath();
          ctx.moveTo(previous.x, previous.y);
          ctx.lineTo(point.x, point.y);
          ctx.stroke();
        }
      });

      frameRef.current = requestAnimationFrame(animate);
    };

    resize();
    animate();
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', addPoint, { passive: true });

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', addPoint);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return <canvas ref={canvasRef} className="mouse-trail" aria-hidden="true" />;
};

export default MouseTrail;
