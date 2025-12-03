import { useEffect, useState } from "react";
import { GroveLeaf } from "./GroveLeaf";

interface LeafOverlayProps {
  graphData: { nodes: any[]; links: any[] };
  nodes: any[];
  onNodeClick: (node: any) => void;
  width: number;
  height: number;
}

export function LeafOverlay({ graphData, nodes, onNodeClick, width, height }: LeafOverlayProps) {
  const [nodePositions, setNodePositions] = useState<Map<string, { x: number; y: number; rotation: number }>>(new Map());

  // Update node positions from force graph
  // Note: react-force-graph mutates nodes in place, adding x, y properties
  useEffect(() => {
    const updatePositions = () => {
      if (!graphData || !graphData.nodes) return;

      const positions = new Map<string, { x: number; y: number; rotation: number }>();
      
      // Match nodes by ID - nodes prop contains contact nodes (without center)
      nodes.forEach((node) => {
        const graphNode = graphData.nodes.find((n: any) => n.id === node.id);
        if (graphNode && typeof graphNode.x === 'number' && typeof graphNode.y === 'number' && !isNaN(graphNode.x) && !isNaN(graphNode.y)) {
          // Use graph coordinates directly - SVG will match canvas coordinate system
          positions.set(node.id, {
            x: graphNode.x,
            y: graphNode.y,
            rotation: graphNode.rotation || node.rotation || 0,
          });
        }
      });
      
      if (positions.size > 0) {
        setNodePositions(positions);
      }
    };

    // Update on animation frame for smooth tracking
    const interval = setInterval(updatePositions, 16); // ~60fps
    updatePositions(); // Initial update

    return () => clearInterval(interval);
  }, [graphData, nodes]);

  // Only render if we have at least some positions
  if (nodePositions.size === 0) {
    return null;
  }

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      width={width}
      height={height}
      style={{ 
        pointerEvents: 'none',
        zIndex: 10, // Above the canvas (z-0) but below controls (z-20)
        position: 'absolute',
        top: 0,
        left: 0
      }}
    >
      {nodes.map((node) => {
        const position = nodePositions.get(node.id);
        if (!position || typeof position.x !== 'number' || typeof position.y !== 'number') {
          return null;
        }

        return (
          <g
            key={node.id}
            transform={`translate(${position.x}, ${position.y}) rotate(${position.rotation})`}
            style={{ pointerEvents: 'auto', cursor: 'pointer' }}
            onClick={() => onNodeClick(node)}
          >
            <GroveLeaf
              name={node.name || 'Unknown'}
              category={node.category || 'friends'}
              status={node.status || 'dormant'}
              size={node.size || 0.5}
              x={0}
              y={0}
              rotation={0}
              onClick={() => onNodeClick(node)}
            />
          </g>
        );
      })}
    </svg>
  );
}

