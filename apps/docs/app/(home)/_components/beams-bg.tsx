"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

// Heavy WebGL (three.js) — load it lazily and only on the client.
const Beams = dynamic(() => import("./beams/Beams"), { ssr: false });

/**
 * Renders the animated Beams background, unless the user has asked to reduce
 * motion — in which case the hero's static background shows through instead.
 */
export function BeamsBg() {
  const [show, setShow] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const motionOk = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setShow(!motionOk.matches);
    update();
    motionOk.addEventListener("change", update);
    return () => motionOk.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!show) {
      setReady(false);
      return;
    }
    // let the WebGL canvas paint before we fade it in over the static bg
    const t = setTimeout(() => setReady(true), 350);
    return () => clearTimeout(t);
  }, [show]);

  if (!show) return null;

  return (
    <div
      className={`absolute inset-0 -z-10 block transition-opacity duration-1000 ease-out ${
        ready ? "opacity-100" : "opacity-0"
      }`}
    >
      <Beams
        beamWidth={2}
        beamHeight={18}
        beamNumber={14}
        lightColor="#34d399"
        speed={2}
        noiseIntensity={1.6}
        scale={0.2}
        rotation={28}
      />
      {/* fade the beams into the page background at the bottom */}
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-b from-transparent to-fd-background" />
    </div>
  );
}
