"use strict";

// Shared geometry and stage state. This script loads after Three.js and before
// the game entry script. Planet geometry stays owned by index.html for now.
const GameShared = (() => {
  function surfaceUp(pos, planet) {
    return new THREE.Vector3().subVectors(pos, planet.center).normalize();
  }

  function nearestPlanet(pos, planets) {
    let best = planets[0], bestD = Infinity;
    for (const planet of planets) {
      const distance = pos.distanceTo(planet.center) - planet.radius;
      if (distance < bestD) { bestD = distance; best = planet; }
    }
    return best;
  }

  function projectTangent(vector, up) {
    const out = vector.clone().addScaledVector(up, -vector.dot(up));
    if (out.lengthSq() < 1e-6) {
      const alt = Math.abs(up.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
      out.copy(alt.addScaledVector(up, -alt.dot(up)));
    }
    return out.normalize();
  }

  const wind = { direction: new THREE.Vector3(0, 0, 0), strength: 0 };
  const brake = { engaged: false };

  return { surfaceUp, nearestPlanet, projectTangent, wind, brake };
})();
