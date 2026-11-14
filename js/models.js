"use strict";

/* ============================================================
   Character models (CLAUDE.md: characters are ready-made GLB/glTF models
   in the Nintendo style, like Mario and Bowser).

   Each entry names a model whose source page and licence were checked on
   Sketchfab (CC-BY 4.0, downloadable, under 30 thousand triangles).
   `ready: false` means the files are not in the repository yet: the game
   then keeps the simple stand-in built in code, and never requests the
   file (a 404 would show up as an error). To install one, download the
   glTF archive from its page and run:
       node tools/add-model.js <id> <downloaded.zip>
   which unpacks it into assets/<id>/, keeps its licence file, adds the
   credit to README.md and sets `ready: true` here.

   height: standing height in world units (the hero is 1.55).
   yaw: turn in radians so the model faces local +Z (the game's "front").
   clip: animation clip to loop (name, or index), when the file has one.
   ============================================================ */
const Models = (() => {
  const REGISTRY = {
    luigi: {
      title: "Luigi (Super Mario Bros)", author: "Yanez Designs", authorUrl: "https://sketchfab.com/Yanez-Designs",
      url: "https://sketchfab.com/3d-models/luigi-super-mario-bros-a79c8ef8419448c39f61fc32b2b19e7c",
      license: "CC-BY-4.0", triangles: 17386, height: 1.75, yaw: 0, clip: 0, ready: false
    },
    dk: {
      title: "Donkey Kong 64", author: "chicosantossaraiva", authorUrl: "https://sketchfab.com/chicosantossaraiva",
      url: "https://sketchfab.com/3d-models/donkey-kong-64-131973a2107e45e8a61822c556f252f2",
      license: "CC-BY-4.0", triangles: 704, height: 3.2, yaw: 0, clip: 0, ready: true
    },
    goomba: {
      title: "Animated Goomba (Super Mario Bros)", author: "Yanez Designs", authorUrl: "https://sketchfab.com/Yanez-Designs",
      url: "https://sketchfab.com/3d-models/animated-goomba-super-mario-bros-3c91cc4ac8144d82a05309679a3dbbd5",
      license: "CC-BY-4.0", triangles: 6288, height: 1.3, yaw: 0, clip: 0, ready: false
    },
    paratroopa: {
      title: "Mario Kart 8 - Koopa Paratroopa", author: "taej11503", authorUrl: "https://sketchfab.com/taej11503",
      url: "https://sketchfab.com/3d-models/mario-kart-8-koopa-paratroopa-2147c4e5ff5f43a89c3a07c5011c4295",
      license: "CC-BY-4.0", triangles: 1266, height: 1.8, yaw: 0, clip: 0, ready: false
    },
    buzzy: {
      title: "Buzzy Beetle (Super Mario Bros)", author: "Yanez Designs", authorUrl: "https://sketchfab.com/Yanez-Designs",
      url: "https://sketchfab.com/3d-models/buzzy-beetle-super-mario-bros-8d3d39516f7b40d5aa19e85226940899",
      license: "CC-BY-4.0", triangles: 12980, height: 1.5, yaw: 0, clip: 0, ready: false
    },
    ukiki: {
      title: "Ukiki", author: "tirrellclark.75", authorUrl: "https://sketchfab.com/tirrellclark.75",
      url: "https://sketchfab.com/3d-models/ukiki-c71d5ac4570a46b69fc3bfa7b3e4a30e",
      license: "CC-BY-4.0", triangles: 317, height: 1.1, yaw: 0, clip: 0, ready: false
    },
    bowserjr: {
      title: "Bowser Jr. (Mario Kart 8 Deluxe)", author: "Austin Zimmermann", authorUrl: "https://sketchfab.com/AustinZimmermann",
      url: "https://sketchfab.com/3d-models/bowser-jr-mario-kart-8-deluxe-8fd1397374a04d499ab4bd5bf90ffeac",
      license: "CC-BY-4.0", triangles: 4152, height: 1.5, yaw: 0, clip: 0, ready: false
    }
  };

  const mixers = [];
  const handles = [];

  // Height of a model by rays (Box3 only sees the bind pose of a skinned mesh; see Mario's loader).
  function measure(model) {
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const rc = new THREE.Raycaster(); rc.far = 1e7;
    rc.set(new THREE.Vector3((box.min.x + box.max.x) / 2, 1e6, (box.min.z + box.max.z) / 2), new THREE.Vector3(0, -1, 0));
    let top = -Infinity, bottom = Infinity;
    const ext = Math.max(box.max.x - box.min.x, box.max.z - box.min.z, 1e-3) * 0.6;
    const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2;
    for (let i = -6; i <= 6; i++) for (let j = -6; j <= 6; j++) {
      const x = cx + ext * i / 6, z = cz + ext * j / 6;
      rc.set(new THREE.Vector3(x, 1e6, z), new THREE.Vector3(0, -1, 0));
      const a = rc.intersectObject(model, true)[0]; if (a) top = Math.max(top, a.point.y);
      rc.set(new THREE.Vector3(x, -1e6, z), new THREE.Vector3(0, 1, 0));
      const b = rc.intersectObject(model, true)[0]; if (b) bottom = Math.min(bottom, b.point.y);
    }
    if (!isFinite(top) || !isFinite(bottom) || top <= bottom) { top = box.max.y; bottom = box.min.y; }
    return { top, bottom, cx, cz };
  }

  // load(id, parent, standIn): adds a holder under parent. The stand-in (a group built in code)
  // shows until the model has loaded, and stays if the model is not installed or fails to load.
  function load(id, parent, standIn, opts) {
    const spec = REGISTRY[id];
    const o = Object.assign({ height: spec ? spec.height : 1, yaw: spec ? spec.yaw : 0 }, opts || {});
    const holder = new THREE.Group(); holder.name = "model:" + id;
    parent.add(holder);
    const h = { id, holder, standIn: standIn || null, model: null, ready: false, mixer: null, failed: false };
    handles.push(h);
    if (!spec || !spec.ready || typeof THREE.GLTFLoader !== "function") return h;
    new THREE.GLTFLoader().load("assets/" + id + "/" + (spec.file || "scene.gltf"), (gltf) => {
      const model = gltf.scene;
      model.traverse(m => {
        if (!m.isMesh) return;
        m.castShadow = true;
        if (m.isSkinnedMesh) { m.frustumCulled = false; m.geometry.computeBoundingSphere(); m.geometry.boundingSphere.radius = 1e5; }
      });
      const fit = new THREE.Group(); fit.add(model);
      const ms = measure(model);
      const k = o.height / (ms.top - ms.bottom);
      model.scale.multiplyScalar(k);
      model.position.set(-ms.cx * k, -ms.bottom * k, -ms.cz * k);
      fit.rotation.y = o.yaw;
      holder.add(fit);
      if (h.standIn) h.standIn.visible = false;
      h.model = fit; h.ready = true;
      if (gltf.animations && gltf.animations.length) {
        const clip = typeof spec.clip === "string" ? THREE.AnimationClip.findByName(gltf.animations, spec.clip) : gltf.animations[spec.clip || 0];
        if (clip) { h.mixer = new THREE.AnimationMixer(model); h.mixer.clipAction(clip).play(); mixers.push(h.mixer); }
      }
    }, undefined, () => { h.failed = true; console.warn("model " + id + " failed to load, keeping the stand-in"); });
    return h;
  }

  function update(dt) { for (const m of mixers) m.update(dt); }

  return { REGISTRY, load, update, get handles() { return handles; } };
})();
