import { motion } from "motion/react";
import { useEffect, useState } from "react";

interface WateringAnimationProps {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  onComplete: () => void;
}

interface Droplet {
  id: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  delay: number;
  size: number;
}

export function WateringAnimation({ 
  startX, 
  startY, 
  endX, 
  endY, 
  onComplete 
}: WateringAnimationProps) {
  const [droplets] = useState<Droplet[]>(() => {
    // Generate 15-20 water droplets
    const count = 15 + Math.floor(Math.random() * 6);
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      startX: startX + (Math.random() - 0.5) * 20,
      startY: startY + (Math.random() - 0.5) * 10,
      endX: endX + (Math.random() - 0.5) * 40,
      endY: endY + (Math.random() - 0.5) * 40,
      delay: i * 0.05,
      size: 3 + Math.random() * 4,
    }));
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 1500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <g>
      {droplets.map((droplet) => (
        <motion.g key={droplet.id}>
          {/* Water droplet */}
          <motion.ellipse
            cx={droplet.startX}
            cy={droplet.startY}
            rx={droplet.size * 0.7}
            ry={droplet.size}
            fill="#06b6d4"
            opacity={0.8}
            initial={{ 
              cx: droplet.startX, 
              cy: droplet.startY,
              opacity: 0,
              scale: 0.5,
            }}
            animate={{
              cx: droplet.endX,
              cy: droplet.endY,
              opacity: [0, 0.8, 0.8, 0],
              scale: [0.5, 1, 1, 0.3],
            }}
            transition={{
              duration: 1,
              delay: droplet.delay,
              ease: "easeIn",
            }}
          />
          {/* Highlight on droplet */}
          <motion.circle
            cx={droplet.startX - droplet.size * 0.25}
            cy={droplet.startY - droplet.size * 0.25}
            r={droplet.size * 0.3}
            fill="white"
            opacity={0.6}
            initial={{ 
              cx: droplet.startX - droplet.size * 0.25, 
              cy: droplet.startY - droplet.size * 0.25,
              opacity: 0,
            }}
            animate={{
              cx: droplet.endX - droplet.size * 0.25,
              cy: droplet.endY - droplet.size * 0.25,
              opacity: [0, 0.6, 0.6, 0],
            }}
            transition={{
              duration: 1,
              delay: droplet.delay,
              ease: "easeIn",
            }}
          />
        </motion.g>
      ))}
      
      {/* Splash effect at the end */}
      <motion.g>
        {[0, 60, 120, 180, 240, 300].map((angle, i) => {
          const rad = (angle * Math.PI) / 180;
          const distance = 20;
          return (
            <motion.circle
              key={`splash-${i}`}
              cx={endX}
              cy={endY}
              r={3}
              fill="#38bdf8"
              opacity={0}
              initial={{ opacity: 0, scale: 0 }}
              animate={{
                cx: endX + Math.cos(rad) * distance,
                cy: endY + Math.sin(rad) * distance,
                opacity: [0, 0, 0.6, 0],
                scale: [0, 0, 1, 0.5],
              }}
              transition={{
                duration: 0.6,
                delay: 0.7,
                ease: "easeOut",
              }}
            />
          );
        })}
      </motion.g>

      {/* Ripple effect */}
      <motion.circle
        cx={endX}
        cy={endY}
        r={10}
        fill="none"
        stroke="#06b6d4"
        strokeWidth={2}
        opacity={0}
        initial={{ scale: 0, opacity: 0 }}
        animate={{
          scale: [0, 2.5],
          opacity: [0, 0, 0.5, 0],
        }}
        transition={{
          duration: 1,
          delay: 0.7,
          ease: "easeOut",
        }}
      />
    </g>
  );
}
