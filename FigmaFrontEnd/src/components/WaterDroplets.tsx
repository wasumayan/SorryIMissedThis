import { motion } from "motion/react";
import { useEffect, useState } from "react";

interface Droplet {
  id: number;
  x: number;
  y: number;
  delay: number;
  duration: number;
}

interface WaterDropletsProps {
  x: number;
  y: number;
  active: boolean;
}

export function WaterDroplets({ x, y, active }: WaterDropletsProps) {
  const [droplets, setDroplets] = useState<Droplet[]>([]);

  useEffect(() => {
    if (active) {
      // Generate 8-12 droplets
      const count = 8 + Math.floor(Math.random() * 5);
      const newDroplets = Array.from({ length: count }, (_, i) => ({
        id: Date.now() + i,
        x: x + (Math.random() - 0.5) * 40,
        y: y - 20 + (Math.random() - 0.5) * 20,
        delay: i * 0.05,
        duration: 0.8 + Math.random() * 0.4,
      }));
      setDroplets(newDroplets);

      // Clear after animation
      setTimeout(() => setDroplets([]), 1500);
    }
  }, [active, x, y]);

  if (!active || droplets.length === 0) return null;

  return (
    <g className="pointer-events-none">
      {droplets.map((droplet) => (
        <motion.g
          key={droplet.id}
          initial={{ opacity: 0, scale: 0 }}
          animate={{
            opacity: [0, 1, 1, 0],
            scale: [0, 1.2, 1, 0.5],
            y: [droplet.y, droplet.y + 60],
          }}
          transition={{
            duration: droplet.duration,
            delay: droplet.delay,
            ease: "easeOut",
          }}
        >
          {/* Water droplet */}
          <ellipse
            cx={droplet.x}
            cy={droplet.y}
            rx={3}
            ry={4}
            fill="#38bdf8"
            opacity={0.7}
          />
          {/* Highlight */}
          <circle
            cx={droplet.x - 1}
            cy={droplet.y - 1}
            r={1.5}
            fill="white"
            opacity={0.8}
          />
          {/* Ripple effect at the end */}
          <motion.circle
            cx={droplet.x}
            cy={droplet.y + 60}
            r={2}
            fill="none"
            stroke="#38bdf8"
            strokeWidth={1}
            opacity={0.5}
            animate={{
              r: [2, 10],
              opacity: [0.5, 0],
            }}
            transition={{
              duration: 0.4,
              delay: droplet.delay + droplet.duration - 0.2,
            }}
          />
        </motion.g>
      ))}
    </g>
  );
}
