import { useEffect, useRef, useMemo, useState } from "react";
import * as d3 from "d3";
import { GroveLeafSVG } from "./GroveLeafSVG";
import { GROVE_CONSTANTS } from "../constants/grove";
import { Contact } from "../services/api";

interface GroveSVGProps {
  contacts: Contact[];
  onContactClick: (contact: Contact) => void;
  width: number;
  height: number;
}

export function GroveSVG({ contacts, onContactClick, width, height }: GroveSVGProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const groupRef = useRef<SVGGElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  // Calculate graph data
  const graphData = useMemo(() => {
    const { CENTER_X, CENTER_Y, MIN_BRANCH_DISTANCE, MAX_BRANCH_DISTANCE, RECENCY_NORMALIZATION_DAYS, FREQUENCY_MAX_MSG_PER_DAY } = GROVE_CONSTANTS;
    const totalContacts = contacts.length;
    
    if (totalContacts === 0) {
      return { nodes: [], links: [] };
    }

    // Extract and normalize recency
    const rawRecencies = contacts.map(c => {
      if (c.recency !== undefined) return c.recency;
      if (c.daysSinceContact !== undefined) {
        return Math.min(1.0, c.daysSinceContact / RECENCY_NORMALIZATION_DAYS);
      }
      if (c.lastContact) {
        const lastContactDate = new Date(c.lastContact);
        const daysSince = (Date.now() - lastContactDate.getTime()) / (1000 * 60 * 60 * 24);
        return Math.min(1.0, daysSince / RECENCY_NORMALIZATION_DAYS);
      }
      return 0.5;
    });

    // Extract and normalize frequency
    const rawFrequencies = contacts.map(c => {
      if (c.frequency !== undefined) return c.frequency;
      if (c.metrics?.interactionFrequency !== undefined) {
        return Math.min(1.0, c.metrics.interactionFrequency / FREQUENCY_MAX_MSG_PER_DAY);
      }
      return 0;
    });

    const maxFrequency = Math.max(...rawFrequencies, 0.001);
    const normalizedFrequencies = rawFrequencies.map(freq => 
      maxFrequency > 0 ? freq / maxFrequency : 0
    );

    // Create center node
    const centerNode = {
      id: 'you',
      name: 'You',
      isCenter: true,
      x: CENTER_X,
      y: CENTER_Y,
    };

    // Create contact nodes - equally spaced around circle
    const contactNodes = contacts.map((contact, i) => {
      const angleDegrees = (360 / totalContacts) * i;
      const angleRadians = (angleDegrees * Math.PI) / 180;
      const recency = rawRecencies[i];
      const frequency = normalizedFrequencies[i];
      const distance = MIN_BRANCH_DISTANCE + recency * (MAX_BRANCH_DISTANCE - MIN_BRANCH_DISTANCE);

      return {
        id: contact.id,
        name: contact.name,
        category: contact.category,
        status: contact.status,
        size: contact.size,
        recency,
        frequency,
        rotation: angleDegrees + 90,
        x: CENTER_X + Math.cos(angleRadians) * distance,
        y: CENTER_Y + Math.sin(angleRadians) * distance,
        contactData: contact,
      };
    });

    // Create links
    const links = contactNodes.map((node) => ({
      source: centerNode,
      target: node,
      recency: node.recency,
      frequency: node.frequency,
    }));

    return {
      nodes: [centerNode, ...contactNodes],
      links,
    };
  }, [contacts]);

  // Setup D3 zoom and render
  useEffect(() => {
    if (!svgRef.current || graphData.nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    const g = d3.select(groupRef.current);

    // Clear previous D3-rendered content (but keep React-rendered leaves)
    g.selectAll("g.links, g.center-node").remove();

    // Setup zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([GROVE_CONSTANTS.ZOOM_MIN, GROVE_CONSTANTS.ZOOM_MAX])
      .on("zoom", (event) => {
        // Apply transform to the group (affects both D3 elements and React children)
        g.attr("transform", event.transform.toString());
      });

    zoomRef.current = zoom;
    svg.call(zoom);

    // Center the view
    const initialTransform = d3.zoomIdentity
      .translate(width / 2 - GROVE_CONSTANTS.CENTER_X, height / 2 - GROVE_CONSTANTS.CENTER_Y)
      .scale(1);
    svg.call(zoom.transform, initialTransform);

    // Render branches (links) - only update if links changed
    let linkGroup = g.select<SVGGElement>("g.links");
    if (linkGroup.empty()) {
      linkGroup = g.append("g").attr("class", "links");
    }
    
    const links = linkGroup.selectAll<SVGLineElement, any>("line")
      .data(graphData.links, (d: any) => `${(d.source as any).id}-${(d.target as any).id}`);
    
    links.exit().remove();
    
    const linksEnter = links.enter().append("line");
    const linksUpdate = linksEnter.merge(links);
    
    linksUpdate
      .attr("x1", (d: any) => (d.source as any).x)
      .attr("y1", (d: any) => (d.source as any).y)
      .attr("x2", (d: any) => (d.target as any).x)
      .attr("y2", (d: any) => (d.target as any).y)
      .attr("stroke", GROVE_CONSTANTS.COLORS.BRANCH)
      .attr("stroke-width", (d: any) => {
        const thickness = GROVE_CONSTANTS.MIN_BRANCH_THICKNESS + 
          d.frequency * (GROVE_CONSTANTS.MAX_BRANCH_THICKNESS - GROVE_CONSTANTS.MIN_BRANCH_THICKNESS);
        return thickness;
      })
      .attr("opacity", (d: any) => {
        return GROVE_CONSTANTS.BRANCH_OPACITY.MIN + 
          d.frequency * (GROVE_CONSTANTS.BRANCH_OPACITY.MAX - GROVE_CONSTANTS.BRANCH_OPACITY.MIN);
      })
      .attr("stroke-linecap", "round");

    // Render center node (watering can) - only update if it doesn't exist
    const centerNode = graphData.nodes.find((n: any) => n.isCenter);
    if (centerNode) {
      let centerGroup = g.select<SVGGElement>("g.center-node");
      if (centerGroup.empty()) {
        centerGroup = g.append("g").attr("class", "center-node");
      } else {
        // Clear and re-render if it exists
        centerGroup.selectAll("*").remove();
      }
      const { WATERING_CAN, COLORS, LABEL_OFFSETS } = GROVE_CONSTANTS;
      
      // Get or create defs element (only once)
      let defs = svg.select("defs");
      if (defs.empty()) {
        defs = svg.append("defs");
      }
      
      // Glow gradient
      const glowGradient = defs.append("radialGradient")
        .attr("id", "water-glow");
      glowGradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", "rgba(6, 182, 212, 0.4)");
      glowGradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", "rgba(6, 182, 212, 0.1)");

      // Glow
      centerGroup.append("circle")
        .attr("cx", centerNode.x)
        .attr("cy", centerNode.y)
        .attr("r", WATERING_CAN.GLOW_RADIUS)
        .attr("fill", "url(#water-glow)");

      // Watering can body
      centerGroup.append("ellipse")
        .attr("cx", centerNode.x)
        .attr("cy", centerNode.y + WATERING_CAN.CAN_BODY_CY)
        .attr("rx", WATERING_CAN.CAN_BODY_RX)
        .attr("ry", WATERING_CAN.CAN_BODY_RY)
        .attr("fill", COLORS.CAN_BODY)
        .attr("opacity", 0.9);

      // Water inside gradient
      const waterGradient = defs.append("linearGradient")
        .attr("id", "water-gradient")
        .attr("x1", "0%")
        .attr("y1", "0%")
        .attr("x2", "0%")
        .attr("y2", "100%");
      waterGradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", COLORS.WATER_GRADIENT_START);
      waterGradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", COLORS.WATER_GRADIENT_END);

      centerGroup.append("ellipse")
        .attr("cx", centerNode.x)
        .attr("cy", centerNode.y + WATERING_CAN.WATER_CY)
        .attr("rx", WATERING_CAN.WATER_RX)
        .attr("ry", WATERING_CAN.WATER_RY)
        .attr("fill", "url(#water-gradient)")
        .attr("opacity", 0.85);

      // "You" label
      centerGroup.append("text")
        .attr("x", centerNode.x)
        .attr("y", centerNode.y + LABEL_OFFSETS.YOU_LABEL_Y)
        .attr("text-anchor", "middle")
        .attr("fill", "currentColor")
        .attr("font-size", "13")
        .attr("font-weight", "600")
        .attr("opacity", 0.8)
        .text("You");
    }

    // Contact nodes are rendered via React components in the JSX below
  }, [graphData, width, height]);

  // Get zoom level for controls
  const getZoomLevel = () => {
    if (!svgRef.current || !zoomRef.current) return 1;
    const transform = d3.zoomTransform(svgRef.current);
    return transform.k;
  };

  // Zoom functions
  const zoomIn = () => {
    if (!svgRef.current || !zoomRef.current) return;
    svgRef.current && d3.select(svgRef.current).transition().call(
      zoomRef.current.scaleBy as any,
      1.2
    );
  };

  const zoomOut = () => {
    if (!svgRef.current || !zoomRef.current) return;
    svgRef.current && d3.select(svgRef.current).transition().call(
      zoomRef.current.scaleBy as any,
      1 / 1.2
    );
  };

  const zoomToFit = () => {
    if (!svgRef.current || !zoomRef.current) return;
    const zoom = zoomRef.current;
    const initialTransform = d3.zoomIdentity
      .translate(width / 2 - GROVE_CONSTANTS.CENTER_X, height / 2 - GROVE_CONSTANTS.CENTER_Y)
      .scale(1);
    d3.select(svgRef.current).transition().call(zoom.transform as any, initialTransform);
  };

  if (graphData.nodes.length === 0) {
    return null;
  }

  const contactNodes = graphData.nodes.filter((n: any) => !n.isCenter);

  return (
    <div className="relative w-full h-full">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="absolute inset-0"
        style={{ cursor: "move" }}
      >
        <defs>
          <pattern id="leaf-pattern" x="0" y="0" width="120" height="120" patternUnits="userSpaceOnUse">
            <path
              d="M60 30C60 30 50 40 50 50C50 56 54 60 60 60C66 60 70 56 70 50C70 40 60 30 60 30Z"
              fill="currentColor"
              opacity="0.5"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#leaf-pattern)" opacity="0.03" />
        <g ref={groupRef} className="grove-content">
          {/* Branches and center node are rendered by D3 above */}
          {/* Contact nodes (leaves) are rendered as React components - they're in the same group so zoom affects them */}
          {contactNodes.map((node: any) => (
            <g
              key={node.id}
              transform={`translate(${node.x}, ${node.y}) rotate(${node.rotation})`}
              style={{ pointerEvents: 'auto', cursor: 'pointer' }}
              onClick={() => onContactClick(node.contactData)}
            >
              {/* Render GroveLeaf as SVG elements directly */}
              <GroveLeafSVG
                name={node.name}
                category={node.category}
                status={node.status}
                size={node.size}
                onClick={() => onContactClick(node.contactData)}
              />
            </g>
          ))}
        </g>
      </svg>

      {/* Zoom controls */}
      <div className="absolute top-4 right-4 z-20 flex flex-col gap-2 bg-card/90 backdrop-blur-sm rounded-lg p-2 border shadow-lg">
        <button
          onClick={zoomIn}
          className="h-8 w-8 flex items-center justify-center border rounded hover:bg-muted"
          aria-label="Zoom in"
        >
          +
        </button>
        <div className="text-xs text-center text-muted-foreground px-2">
          {Math.round(getZoomLevel() * 100)}%
        </div>
        <button
          onClick={zoomOut}
          className="h-8 w-8 flex items-center justify-center border rounded hover:bg-muted"
          aria-label="Zoom out"
        >
          −
        </button>
        <button
          onClick={zoomToFit}
          className="h-8 w-8 flex items-center justify-center border rounded hover:bg-muted"
          aria-label="Reset view"
        >
          ⌂
        </button>
      </div>
    </div>
  );
}

