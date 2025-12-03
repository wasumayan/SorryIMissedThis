import { useEffect, useState } from "react";
import * as d3 from "d3";
import { GroveLeaf } from "./GroveLeaf";

interface LeafOverlaySVGProps {
  svgRef: React.RefObject<SVGSVGElement>;
  zoomRef: React.MutableRefObject<d3.ZoomBehavior<SVGSVGElement, unknown> | null>;
  nodes: any[];
  onContactClick: (contact: any) => void;
  width: number;
  height: number;
}

export function LeafOverlaySVG({ svgRef, zoomRef, nodes, onContactClick, width, height }: LeafOverlaySVGProps) {
  const [transform, setTransform] = useState(d3.zoomIdentity);

  // Sync with D3 zoom transform
  useEffect(() => {
    if (!svgRef.current) return;

    const updateTransform = () => {
      if (svgRef.current) {
        const currentTransform = d3.zoomTransform(svgRef.current);
        setTransform(currentTransform);
      }
    };

    // Listen for zoom events
    const svg = d3.select(svgRef.current);
    svg.on("zoom", updateTransform);
    updateTransform(); // Initial update

    return () => {
      svg.on("zoom", null);
    };
  }, [svgRef]);

  return (
    <svg
      width={width}
      height={height}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 10 }}
    >
      <g transform={transform.toString()}>
        {nodes.map((node: any) => (
          <g
            key={node.id}
            transform={`translate(${node.x}, ${node.y}) rotate(${node.rotation})`}
            style={{ pointerEvents: 'auto', cursor: 'pointer' }}
            onClick={() => onContactClick(node.contactData)}
          >
            <GroveLeaf
              name={node.name}
              category={node.category}
              status={node.status}
              size={node.size}
              x={0}
              y={0}
              rotation={0}
              onClick={() => onContactClick(node.contactData)}
            />
          </g>
        ))}
      </g>
    </svg>
  );
}

