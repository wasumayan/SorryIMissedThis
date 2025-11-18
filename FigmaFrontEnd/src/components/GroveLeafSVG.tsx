import { GROVE_CONSTANTS } from "../constants/grove";

interface GroveLeafSVGProps {
  name: string;
  category?: string;
  status?: string;
  size?: number;
  onClick: () => void;
}

// Simplified SVG version of GroveLeaf for use in D3-managed SVG
export function GroveLeafSVG({ name, category, status, size = 0.5, onClick }: GroveLeafSVGProps) {
  const baseSize = 20 + size * 20; // 20-40px base size
  const baseColor = status === 'healthy' 
    ? GROVE_CONSTANTS.COLORS.HEALTHY 
    : status === 'attention' 
    ? GROVE_CONSTANTS.COLORS.ATTENTION 
    : status === 'dormant' 
    ? GROVE_CONSTANTS.COLORS.DORMANT 
    : GROVE_CONSTANTS.COLORS.WILTED;

  return (
    <g onClick={onClick} style={{ cursor: 'pointer' }}>
      {/* Leaf shape */}
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
      
      {/* Leaf highlight */}
      <path
        d={`M 0 ${-baseSize * 0.9} 
            Q ${baseSize * 0.3} ${-baseSize * 0.5} ${baseSize * 0.2} 0
            Q ${baseSize * 0.3} ${baseSize * 0.4} 0 ${baseSize * 0.7}
            Q ${-baseSize * 0.3} ${baseSize * 0.4} ${-baseSize * 0.2} 0
            Q ${-baseSize * 0.3} ${-baseSize * 0.5} 0 ${-baseSize * 0.9} Z`}
        fill="white"
        opacity={status === "wilted" ? 0.1 : 0.2}
      />
      
      {/* Leaf vein */}
      <line
        x1={0}
        y1={-baseSize * 0.9}
        x2={0}
        y2={baseSize * 0.9}
        stroke="currentColor"
        strokeWidth="1.5"
        opacity={0.3}
      />
      
      {/* Name label */}
      <g transform={`translate(0, ${baseSize + 12})`}>
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
    </g>
  );
}

