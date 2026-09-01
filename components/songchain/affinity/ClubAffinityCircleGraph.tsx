"use client";

import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import type { ClubCircleData } from "./circle-types";
import { orbProfileUrl } from "./circle-types";
import { clubAvatarUrl, initial } from "./circle-image";

interface SimNode {
  id: string;
  handle: string;
  name: string | null;
  avatarUrl: string | null;
  address: string | null;
  count: number;
  radius: number;
  isCenter: boolean;
  fill1: string;
  fill2: string;
  ring: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

interface HoverInfo {
  handle: string;
  name: string | null;
  x: number;
  y: number;
}

type ClubAffinityCircleGraphProps = {
  data: ClubCircleData;
  /** Clamped square size in px for the SVG (also the simulation space). */
  size: number;
  /** Show handle labels under each node. */
  showLabels?: boolean;
};

/**
 * Club members circle — adapted from lens-affinity-circle AffinityCircleGraph.
 * Center = club logo; orbit = group members. Click opens Orb profile.
 */
export function ClubAffinityCircleGraph({
  data,
  size,
  showLabels = true,
}: ClubAffinityCircleGraphProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const labelSelRef = useRef<d3.Selection<
    SVGTextElement,
    SimNode,
    SVGGElement,
    unknown
  > | null>(null);
  const labelThreshRef = useRef(0);

  useEffect(() => {
    if (!svgRef.current) return;

    const width = size;
    const height = size;
    const scale = width / 800;

    const centerRadius = Math.max(38, width * 0.11);
    const minRadius = Math.max(12, width * 0.03);
    const maxRadius = Math.max(24, width * 0.072);
    const radialDistance = width * 0.32;

    const members = data.members;
    const maxCount = Math.max(1, ...members.map((m) => m.count), 1);
    const minCount = Math.min(...members.map((m) => m.count), 1);

    const radiusFor = (count: number) => {
      if (maxCount === minCount) return (minRadius + maxRadius) / 2;
      const t = Math.log(count + 1) / Math.log(maxCount + 1);
      return minRadius + t * (maxRadius - minRadius);
    };

    const centerNode: SimNode = {
      id: "center",
      handle: data.center.label,
      name: data.center.label,
      avatarUrl: data.center.logoUrl,
      address: null,
      count: 0,
      radius: centerRadius,
      isCenter: true,
      fill1: "#fbbf24",
      fill2: "#fb7185",
      ring: "#fcd34d",
    };

    const memberNodes: SimNode[] = members.map((m, i) => {
      const rank = members.length > 1 ? i / (members.length - 1) : 0;
      const light = d3.interpolateRgb("#c4b5fd", "#67e8f9")(rank);
      const deep = d3.interpolateRgb("#7c3aed", "#0891b2")(rank);
      const handle = m.handle || m.address?.slice(0, 8) || `member-${i}`;
      return {
        id: `m-${m.address ?? handle}-${i}`,
        handle,
        name: m.name,
        avatarUrl: m.avatarUrl,
        address: m.address,
        count: m.count,
        radius: radiusFor(m.count),
        isCenter: false,
        fill1: light,
        fill2: deep,
        ring: light,
      };
    });

    memberNodes.forEach((n, i) => {
      const angle = (i / Math.max(memberNodes.length, 1)) * Math.PI * 2 - Math.PI / 2;
      const jitter = 0.82 + ((i * 41) % 30) / 100;
      n.x = width / 2 + Math.cos(angle) * radialDistance * jitter;
      n.y = height / 2 + Math.sin(angle) * radialDistance * jitter;
    });

    const nodes = [centerNode, ...memberNodes];

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${width} ${height}`);

    const defs = svg.append("defs");

    const glow = defs
      .append("filter")
      .attr("id", "club-circle-glow")
      .attr("x", "-60%")
      .attr("y", "-60%")
      .attr("width", "220%")
      .attr("height", "220%");
    glow
      .append("feGaussianBlur")
      .attr("stdDeviation", 3.5 * scale)
      .attr("result", "blur");
    const glowMerge = glow.append("feMerge");
    glowMerge.append("feMergeNode").attr("in", "blur");
    glowMerge.append("feMergeNode").attr("in", "SourceGraphic");

    nodes.forEach((n) => {
      const g = defs
        .append("radialGradient")
        .attr("id", `club-grad-${n.id}`)
        .attr("cx", "35%")
        .attr("cy", "30%")
        .attr("r", "75%");
      g.append("stop").attr("offset", "0%").attr("stop-color", n.fill1);
      g.append("stop").attr("offset", "100%").attr("stop-color", n.fill2);
    });

    const container = svg.append("g");

    const orbits = container.append("g").attr("opacity", 0.5);
    [0.24, 0.36, 0.46].forEach((r) => {
      orbits
        .append("circle")
        .attr("cx", width / 2)
        .attr("cy", height / 2)
        .attr("r", width * r)
        .attr("fill", "none")
        .attr("stroke", "#2a2540")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "2 6");
    });

    centerNode.fx = width / 2;
    centerNode.fy = height / 2;

    const simulation = d3
      .forceSimulation(nodes as d3.SimulationNodeDatum[])
      .force("center", d3.forceCenter(width / 2, height / 2).strength(0.06))
      .force(
        "charge",
        d3.forceManyBody().strength(-260 * scale).distanceMax(360 * scale),
      )
      .force(
        "collision",
        d3
          .forceCollide<SimNode>()
          .radius((d) => d.radius + 7 * scale)
          .strength(0.85),
      )
      .force(
        "radial",
        d3
          .forceRadial<SimNode>(
            (d) => (d.isCenter ? 0 : radialDistance),
            width / 2,
            height / 2,
          )
          .strength((d) => (d.isCenter ? 0 : 0.55)),
      )
      .alphaDecay(0.025);

    const links = container
      .append("g")
      .selectAll("line")
      .data(memberNodes)
      .join("line")
      .attr("stroke", (d) => d.ring)
      .attr("stroke-width", (d) => 0.6 + (d.count / maxCount) * 1.8)
      .attr("stroke-opacity", 0.18);

    const node = container
      .append("g")
      .selectAll<SVGGElement, SimNode>("g")
      .data(nodes)
      .join("g")
      .attr("cursor", (d) => (d.isCenter ? "default" : "pointer"));

    node
      .append("circle")
      .attr("r", (d) => d.radius)
      .attr("fill", (d) => `url(#club-grad-${d.id})`)
      .attr("stroke", (d) => d.ring)
      .attr("stroke-width", (d) => (d.isCenter ? 3 : 2))
      .attr("filter", (d) => (d.isCenter ? "url(#club-circle-glow)" : null))
      .attr("opacity", 0.96);

    node.each(function (d) {
      const g = d3.select(this);
      const src = clubAvatarUrl(d.avatarUrl);
      if (src) {
        const clipId = `club-clip-${d.id}`;
        defs
          .append("clipPath")
          .attr("id", clipId)
          .append("circle")
          .attr("r", d.radius - 2.5);
        g.append("image")
          .attr("href", src)
          .attr("width", d.radius * 2)
          .attr("height", d.radius * 2)
          .attr("x", -d.radius)
          .attr("y", -d.radius)
          .attr("preserveAspectRatio", "xMidYMid slice")
          .attr("clip-path", `url(#${clipId})`)
          .attr("opacity", 0)
          .transition()
          .duration(700)
          .attr("opacity", 1);
      } else {
        g.append("text")
          .attr("text-anchor", "middle")
          .attr("dominant-baseline", "central")
          .attr("font-size", d.radius * 0.9)
          .attr("font-weight", 700)
          .attr("fill", "#0c0a17")
          .attr("pointer-events", "none")
          .text(initial(d.handle));
      }
    });

    const labelThreshold = minRadius * 1.15;
    labelThreshRef.current = labelThreshold;
    const labels = node
      .append("text")
      .attr("text-anchor", "middle")
      .attr("y", (d) => d.radius + (d.isCenter ? 20 : 14))
      .attr("font-size", (d) => (d.isCenter ? 13 : 11))
      .attr("font-weight", (d) => (d.isCenter ? 700 : 500))
      .attr("fill", (d) => (d.isCenter ? "#fcd34d" : "#c4bfe0"))
      .attr("pointer-events", "none")
      .attr("opacity", (d) =>
        showLabels && (d.isCenter || d.radius > labelThreshold) ? 1 : 0,
      )
      .text((d) => {
        const h = d.handle;
        return h.length > 14 ? `${h.slice(0, 12)}…` : h;
      });
    labelSelRef.current = labels;

    const svgRect = () => svgRef.current!.getBoundingClientRect();

    node
      .filter((d) => !d.isCenter)
      .on("mouseenter", function (_e, d) {
        d3.select(this)
          .select("circle")
          .transition()
          .duration(180)
          .attr("r", d.radius * 1.16)
          .attr("filter", "url(#club-circle-glow)");
        d3.select(this)
          .select("image")
          .transition()
          .duration(180)
          .attr("width", d.radius * 2 * 1.16)
          .attr("height", d.radius * 2 * 1.16)
          .attr("x", -d.radius * 1.16)
          .attr("y", -d.radius * 1.16);
      })
      .on("mousemove", function (event, d) {
        const rect = svgRect();
        const [px, py] = d3.pointer(event, svgRef.current);
        setHover({
          handle: d.handle,
          name: d.name,
          x: (px / width) * rect.width,
          y: (py / height) * rect.height,
        });
      })
      .on("mouseleave", function (_e, d) {
        d3.select(this)
          .select("circle")
          .transition()
          .duration(180)
          .attr("r", d.radius)
          .attr("filter", null);
        d3.select(this)
          .select("image")
          .transition()
          .duration(180)
          .attr("width", d.radius * 2)
          .attr("height", d.radius * 2)
          .attr("x", -d.radius)
          .attr("y", -d.radius);
        setHover(null);
      })
      .on("click", function (_e, d) {
        setHover(null);
        const url = orbProfileUrl({
          handle: d.handle,
          address: d.address,
        });
        window.open(url, "_blank", "noopener,noreferrer");
      });

    const drag = d3
      .drag<SVGGElement, SimNode>()
      .on("start", (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        if (!d.isCenter) {
          d.fx = d.x;
          d.fy = d.y;
        }
      })
      .on("drag", (event, d) => {
        if (!d.isCenter) {
          d.fx = event.x;
          d.fy = event.y;
        }
      })
      .on("end", (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        if (!d.isCenter) {
          d.fx = null;
          d.fy = null;
        }
      });
    node.filter((d) => !d.isCenter).call(drag);

    const repulseR = 130 * scale;
    const repulseS = 70 * scale;
    svg.on("mousemove", function (event) {
      const [mx, my] = d3.pointer(event);
      nodes.forEach((n) => {
        if (n.isCenter || n.x == null || n.y == null) return;
        const dx = n.x - mx;
        const dy = n.y - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < repulseR && dist > 0) {
          const f = (repulseR - dist) / repulseR;
          if (n.vx != null && n.vy != null) {
            n.vx += (dx / dist) * f * repulseS;
            n.vy += (dy / dist) * f * repulseS;
          }
        }
      });
      simulation.alpha(0.12).restart();
    });

    simulation.on("tick", () => {
      links
        .attr("x1", width / 2)
        .attr("y1", height / 2)
        .attr("x2", (d) => d.x ?? width / 2)
        .attr("y2", (d) => d.y ?? height / 2);
      node.attr(
        "transform",
        (d) => `translate(${d.x ?? width / 2},${d.y ?? height / 2})`,
      );
    });

    return () => {
      simulation.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- showLabels handled below
  }, [data, size]);

  useEffect(() => {
    const labels = labelSelRef.current;
    if (!labels) return;
    labels
      .interrupt()
      .transition()
      .duration(200)
      .attr("opacity", (d) =>
        showLabels && (d.isCenter || d.radius > labelThreshRef.current) ? 1 : 0,
      );
  }, [showLabels]);

  return (
    <div className="relative mx-auto w-full max-w-full overflow-hidden rounded-xl bg-[#0c0a17]">
      <svg
        ref={svgRef}
        width={size}
        height={size}
        className="mx-auto block h-auto w-full max-w-full"
        role="img"
        aria-label={`${data.center.label} club members`}
      />
      {hover && (
        <div
          className="pointer-events-none absolute z-10 max-w-[min(200px,70%)] rounded-lg border border-white/10 bg-black/85 px-3 py-2 text-xs text-white shadow-lg backdrop-blur-sm"
          style={{
            left: Math.min(Math.max(hover.x + 12, 8), Math.max(8, size - 160)),
            top: Math.min(Math.max(hover.y + 12, 8), Math.max(8, size - 56)),
          }}
        >
          <p className="font-semibold">@{hover.handle}</p>
          {hover.name && hover.name !== hover.handle && (
            <p className="mt-0.5 truncate text-white/70">{hover.name}</p>
          )}
        </div>
      )}
    </div>
  );
}
