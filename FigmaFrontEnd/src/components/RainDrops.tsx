import { motion } from "motion/react";

interface RainDropsProps {
  spoutX: number;
  spoutY: number;
  reducedMotion?: boolean;
}

export function RainDrops({ spoutX, spoutY, reducedMotion = false }: RainDropsProps) {
  if (reducedMotion) return null;

  const drops = Array.from({ length: 5 }, (_, i) => ({
    id: i,
    delay: i * 0.3,
    offset: (i - 2) * 3,
  }));

  return (
    <g>
      {drops.map((drop) => (
        <motion.g key={drop.id}>
          {/* Water droplet falling from spout */}
          <motion.ellipse
            cx={spoutX + drop.offset}
            cy={spoutY}
            rx={2}
            ry={3}
            fill="#38bdf8"
            opacity={0.7}
            animate={{
              cy: [spoutY, spoutY + 80],
              opacity: [0, 0.7, 0.7, 0],
              scale: [0.5, 1, 1, 0.3],
            }}
            transition={{
              duration: 1.2,
              delay: drop.delay,
              repeat: Infinity,
              repeatDelay: 1,
              ease: "easeIn",
            }}
          />
          {/* Highlight on droplet */}
          <motion.circle
            cx={spoutX + drop.offset - 0.5}
            cy={spoutY - 0.8}
            r={0.8}
            fill="white"
            opacity={0.8}
            animate={{
              cy: [spoutY - 0.8, spoutY + 79.2],
              opacity: [0, 0.8, 0.8, 0],
            }}
            transition={{
              duration: 1.2,
              delay: drop.delay,
              repeat: Infinity,
              repeatDelay: 1,
              ease: "easeIn",
            }}
          />
          {/* Tiny splash at bottom */}
          <motion.circle
            cx={spoutX + drop.offset}
            cy={spoutY + 80}
            r={4}
            fill="none"
            stroke="#38bdf8"
            strokeWidth={1}
            opacity={0}
            animate={{
              scale: [0, 1.5],
              opacity: [0, 0, 0.4, 0],
            }}
            transition={{
              duration: 0.4,
              delay: drop.delay + 1.2,
              repeat: Infinity,
              repeatDelay: 1,
              ease: "easeOut",
            }}
          />
        </motion.g>
      ))}
    </g>
  );
}
