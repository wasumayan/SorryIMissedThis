import { motion } from "motion/react";

interface LeafProps {
  name: string;
  category: "family" | "friends" | "work";
  status: "healthy" | "attention" | "dormant" | "wilted";
  size: number; // 0-1 scale based on interaction frequency
  x: number;
  y: number;
  rotation: number;
  onClick: () => void;
  reducedMotion?: boolean;
  isBloomingFromBud?: boolean; // Transition from dormant to healthy
  season?: "spring" | "summer" | "autumn" | "winter";
}

export function GroveLeaf({ 
  name, 
  category: _category, // Part of Contact interface but not used in visualization
  status, 
  size, 
  x, 
  y, 
  rotation, 
  onClick, 
  reducedMotion = false,
  isBloomingFromBud = false,
  season = "summer"
}: LeafProps) {
  // Seasonal color variations
  const seasonalHealthColors = {
    spring: {
      healthy: "#22c55e", // Light green - new growth
      attention: "#fbbf24", // Yellow
      dormant: "#f472b6", // Light pink
      wilted: "#92400e",
    },
    summer: {
      healthy: "#10b981", // Vibrant green
      attention: "#f59e0b", // Orange
      dormant: "#ec4899", // Pink
      wilted: "#78350f",
    },
    autumn: {
      healthy: "#eab308", // Golden yellow - autumn leaves
      attention: "#ea580c", // Deep orange
      dormant: "#dc2626", // Red
      wilted: "#57534e",
    },
    winter: {
      healthy: "#059669", // Evergreen
      attention: "#0891b2", // Icy blue
      dormant: "#e0e7ff", // Frost white
      wilted: "#44403c",
    },
  };

  const healthColors = seasonalHealthColors[season];
  const baseColor = healthColors[status];
  const baseSize = 25 + size * 35; // 25-60px

  const leafVariants = {
    initial: { scale: 0.8, opacity: 0 },
    animate: {
      scale: 1,
      opacity: status === "wilted" ? 0.6 : 1,
      transition: { duration: reducedMotion ? 0 : 0.6, ease: "easeOut" as const },
    },
    hover: {
      scale: reducedMotion ? 1 : 1.2,
      opacity: 1,
      transition: { duration: reducedMotion ? 0 : 0.2 },
    },
  };

  // Gentle sway animation
  const swayAnimation = reducedMotion
    ? {}
    : {
        rotate: [rotation - 3, rotation + 3, rotation - 3],
        y: [y - 1, y + 1, y - 1],
        transition: {
          duration: 3 + Math.random() * 2,
          repeat: Infinity,
          ease: "easeInOut" as const,
        },
      };

  // Blooming animation from bud to leaf
  const bloomVariants = isBloomingFromBud ? {
    initial: { scale: 1, opacity: 1 },
    bloom: {
      scale: [1, 1.3, 1],
      rotate: [0, 10, -10, 0],
      transition: { duration: 1.2, ease: "easeInOut" as const },
    },
  } : undefined;

  // Dormant contacts are flower buds (not yet bloomed)
  if (status === "dormant" && !isBloomingFromBud) {
    return (
      <motion.g
        variants={leafVariants}
        initial="initial"
        animate="animate"
        whileHover="hover"
        whileTap={{ scale: 0.95 }} // Visual feedback on click
        style={{ cursor: "pointer" }}
        onClick={(e) => {
          e.stopPropagation(); // Prevent event bubbling
          console.log('[LEAF] Dormant leaf clicked:', name);
          onClick();
        }}
      >
        <motion.g
          animate={swayAnimation}
          style={{ transformOrigin: `${x}px ${y}px` }}
        >
          {/* Flower bud - closed petals */}
          <g transform={`translate(${x}, ${y}) rotate(${rotation})`}>
            {/* Stem */}
            <line
              x1={0}
              y1={0}
              x2={0}
              y2={baseSize * 0.4}
              stroke="#65a30d"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            
            {/* Closed bud - teardrop shape */}
            <ellipse
              cx={0}
              cy={-baseSize * 0.4}
              rx={baseSize * 0.35}
              ry={baseSize * 0.6}
              fill={baseColor}
              opacity={0.85}
            />
            
            {/* Bud highlight */}
            <ellipse
              cx={-baseSize * 0.1}
              cy={-baseSize * 0.5}
              rx={baseSize * 0.15}
              ry={baseSize * 0.25}
              fill="white"
              opacity={0.3}
            />
            
            {/* Sepals (green leaf-like structures at base of bud) */}
            {[0, 120, 240].map((angle, i) => {
              const rad = (angle * Math.PI) / 180;
              const dist = baseSize * 0.3;
              return (
                <path
                  key={i}
                  d={`M 0 ${-baseSize * 0.1} Q ${Math.cos(rad) * dist} ${-baseSize * 0.2 + Math.sin(rad) * dist} ${Math.cos(rad) * dist * 0.7} ${-baseSize * 0.4 + Math.sin(rad) * dist * 0.7}`}
                  fill="#65a30d"
                  opacity={0.7}
                />
              );
            })}

            {/* Gentle pulse to show it's waiting to bloom */}
            <motion.circle
              cx={0}
              cy={-baseSize * 0.4}
              r={baseSize * 0.5}
              fill="none"
              stroke={baseColor}
              strokeWidth="1.5"
              opacity={0.4}
              animate={
                reducedMotion
                  ? {}
                  : {
                      scale: [1, 1.15, 1],
                      opacity: [0.4, 0.1, 0.4],
                      transition: { duration: 3, repeat: Infinity },
                    }
              }
            />
          </g>

          {/* Name label */}
          <g transform={`translate(${x}, ${y + baseSize + 12})`}>
            <rect
              x={-name.length * 3.5}
              y={-8}
              width={name.length * 7}
              height={16}
              fill="white"
              opacity={0.9}
              rx={4}
              className="dark:fill-[#1c2128]"
            />
            <text
              textAnchor="middle"
              fill="currentColor"
              fontSize={11}
              fontWeight={500}
              opacity={0.9}
            >
              {name}
            </text>
          </g>
        </motion.g>
      </motion.g>
    );
  }

  // Regular leaf (healthy, attention, wilted) - or blooming from bud
  return (
    <motion.g
      variants={leafVariants}
      initial="initial"
      animate={isBloomingFromBud ? "bloom" : "animate"}
      whileHover="hover"
      whileTap={{ scale: 0.95 }} // Visual feedback on click
      style={{ cursor: "pointer" }}
      onClick={(e) => {
        e.stopPropagation(); // Prevent event bubbling
        console.log('[LEAF] Clicked:', name);
        onClick();
      }}
    >
      <motion.g
        animate={swayAnimation}
        style={{ transformOrigin: `${x}px ${y}px` }}
        variants={bloomVariants || undefined}
      >
        {/* Leaf shape */}
        <g transform={`translate(${x}, ${y}) rotate(${rotation})`}>
          {/* Stem connecting to branch */}
          <line
            x1={0}
            y1={0}
            x2={0}
            y2={baseSize * 0.15}
            stroke="#78350f"
            strokeWidth="2"
            strokeLinecap="round"
            opacity={0.8}
          />
          
          {/* Main leaf body */}
          <path
            d={`M 0 ${-baseSize * 0.9} 
                Q ${baseSize * 0.5} ${-baseSize * 0.4} ${baseSize * 0.4} 0
                Q ${baseSize * 0.5} ${baseSize * 0.6} 0 ${baseSize * 0.9}
                Q ${-baseSize * 0.5} ${baseSize * 0.6} ${-baseSize * 0.4} 0
                Q ${-baseSize * 0.5} ${-baseSize * 0.4} 0 ${-baseSize * 0.9} Z`}
            fill={baseColor}
            opacity={status === "wilted" ? 0.7 : 0.95}
            filter={status === "wilted" ? "saturate(0.3)" : "none"}
          />
          
          {/* Leaf highlight for depth - less prominent if withering */}
          <path
            d={`M 0 ${-baseSize * 0.9} 
                Q ${baseSize * 0.35} ${-baseSize * 0.5} ${baseSize * 0.25} ${-baseSize * 0.2}
                Q ${baseSize * 0.1} 0 0 ${baseSize * 0.1}
                Q ${-baseSize * 0.2} ${-baseSize * 0.2} 0 ${-baseSize * 0.9} Z`}
            fill="white"
            opacity={status === "wilted" ? 0.05 : status === "attention" ? 0.15 : 0.25}
          />
          
          {/* Central vein */}
          <line
            x1={0}
            y1={-baseSize * 0.85}
            x2={0}
            y2={baseSize * 0.85}
            stroke="rgba(0,0,0,0.15)"
            strokeWidth="2"
            strokeLinecap="round"
          />
          
          {/* Side veins */}
          {[0.4, 0.6, -0.4, -0.6].map((pos, i) => (
            <line
              key={i}
              x1={0}
              y1={-baseSize * Math.abs(pos)}
              x2={baseSize * Math.sign(pos) * 0.3}
              y2={-baseSize * Math.abs(pos) * 0.5}
              stroke="rgba(0,0,0,0.1)"
              strokeWidth="1"
              strokeLinecap="round"
            />
          ))}

          {/* Dew drop for attention status - leaf needs watering! */}
          {status === "attention" && (
            <motion.g>
              <circle
                cx={baseSize * 0.25}
                cy={-baseSize * 0.4}
                r={baseSize * 0.12}
                fill="#38bdf8"
                opacity={0.8}
              />
              <circle
                cx={baseSize * 0.27}
                cy={-baseSize * 0.42}
                r={baseSize * 0.04}
                fill="white"
                opacity={0.9}
              />
              <motion.circle
                cx={baseSize * 0.25}
                cy={-baseSize * 0.4}
                r={baseSize * 0.12}
                fill="none"
                stroke="#38bdf8"
                strokeWidth="1.5"
                opacity={0.6}
                animate={
                  reducedMotion
                    ? {}
                    : {
                        scale: [1, 1.3, 1],
                        opacity: [0.6, 0, 0.6],
                        transition: { duration: 2, repeat: Infinity },
                      }
                }
              />
            </motion.g>
          )}

          {/* Wilted indicators - brown spots and curled edges */}
          {status === "wilted" && (
            <>
              <circle cx={baseSize * 0.15} cy={0} r={baseSize * 0.08} fill="#451a03" opacity={0.4} />
              <circle cx={-baseSize * 0.1} cy={baseSize * 0.3} r={baseSize * 0.06} fill="#451a03" opacity={0.4} />
              <circle cx={baseSize * 0.05} cy={-baseSize * 0.5} r={baseSize * 0.07} fill="#451a03" opacity={0.3} />
              {/* Curled/torn edge effect */}
              <path
                d={`M ${baseSize * 0.35} ${-baseSize * 0.1} Q ${baseSize * 0.45} ${-baseSize * 0.05} ${baseSize * 0.4} 0`}
                fill="none"
                stroke="#451a03"
                strokeWidth="1.5"
                opacity={0.3}
              />
            </>
          )}

          {/* Slight yellowing on attention leaves (withering edges) */}
          {status === "attention" && (
            <>
              <ellipse
                cx={baseSize * 0.3}
                cy={baseSize * 0.5}
                rx={baseSize * 0.15}
                ry={baseSize * 0.2}
                fill="#fbbf24"
                opacity={0.25}
              />
              <ellipse
                cx={-baseSize * 0.25}
                cy={-baseSize * 0.3}
                rx={baseSize * 0.12}
                ry={baseSize * 0.18}
                fill="#fbbf24"
                opacity={0.2}
              />
            </>
          )}

          {/* Bloom sparkles/petals animation */}
          {isBloomingFromBud && !reducedMotion && (
            <>
              {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => {
                const rad = (angle * Math.PI) / 180;
                const distance = baseSize * 1.2;
                return (
                  <motion.ellipse
                    key={`petal-${i}`}
                    cx={0}
                    cy={0}
                    rx={baseSize * 0.15}
                    ry={baseSize * 0.25}
                    fill="#f472b6"
                    opacity={0}
                    animate={{
                      cx: Math.cos(rad) * distance,
                      cy: Math.sin(rad) * distance,
                      opacity: [0, 0.8, 0],
                      scale: [0.5, 1, 0.3],
                      rotate: [0, angle + 180],
                    }}
                    transition={{
                      duration: 1.5,
                      delay: i * 0.1,
                      ease: "easeOut",
                    }}
                  />
                );
              })}
            </>
          )}
        </g>

        {/* Name label */}
        <g transform={`translate(${x}, ${y + baseSize + 12})`}>
          <rect
            x={-name.length * 3.5}
            y={-8}
            width={name.length * 7}
            height={16}
            fill="white"
            opacity={0.9}
            rx={4}
            className="dark:fill-[#1c2128]"
          />
          <text
            textAnchor="middle"
            fill="currentColor"
            fontSize={11}
            fontWeight={500}
            opacity={0.9}
          >
            {name}
          </text>
        </g>
      </motion.g>
    </motion.g>
  );
}
