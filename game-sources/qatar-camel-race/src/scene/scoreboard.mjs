import * as THREE from "three";
import { QATAR_MAROON } from "./textures.mjs";
const AR = (n) => String(n).replace(/[0-9]/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]);
function buildScoreboard(scene) {
  const W = 1024, H = 640;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const group = new THREE.Group();
  group.name = "scoreboard";
  const frameMat = new THREE.MeshStandardMaterial({ color: "#2a2a2c", roughness: 0.5, metalness: 0.4 });
  const screenMat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
  const frame = new THREE.Mesh(new THREE.BoxGeometry(7.4, 4.7, 0.35), frameMat);
  frame.position.y = 5.6;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(7, 4.375), screenMat);
  screen.position.set(0, 5.6, -0.18);
  screen.rotation.y = Math.PI;
  const legGeo = new THREE.BoxGeometry(0.3, 3.6, 0.3);
  for (const x of [-2.6, 2.6]) {
    const leg = new THREE.Mesh(legGeo, frameMat);
    leg.position.set(x, 1.8, 0);
    group.add(leg);
  }
  group.add(frame, screen);
  scene.add(group);
  let lastKey = "";
  function draw(rows, title = "الترتيب المباشر") {
    ctx.fillStyle = "#101014";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = QATAR_MAROON;
    ctx.fillRect(0, 0, W, 96);
    ctx.fillStyle = "#ffffff";
    ctx.font = '800 58px "QCR Cairo", Arial';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.direction = "rtl";
    ctx.fillText(title, W / 2, 52);
    const rowH = (H - 110) / Math.max(6, rows.length);
    rows.forEach((r, i) => {
      const y = 110 + i * rowH;
      ctx.fillStyle = r.isPlayer ? "rgba(138,21,56,0.85)" : i % 2 ? "#1b1b22" : "#16161c";
      ctx.fillRect(16, y + 4, W - 32, rowH - 8);
      ctx.direction = "rtl";
      ctx.textAlign = "right";
      ctx.fillStyle = "#f2d8a6";
      ctx.font = '800 54px "QCR Cairo", Arial';
      ctx.fillText(AR(r.rank), W - 40, y + rowH / 2 + 4);
      ctx.fillStyle = r.color;
      ctx.fillRect(W - 170, y + 14, rowH - 28, rowH - 28);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.strokeRect(W - 170, y + 14, rowH - 28, rowH - 28);
      ctx.fillStyle = r.light ? "#111" : "#fff";
      ctx.textAlign = "center";
      ctx.font = '800 40px "QCR Cairo", Arial';
      ctx.fillText(String(r.number), W - 170 + (rowH - 28) / 2, y + rowH / 2 + 3);
      ctx.textAlign = "right";
      ctx.fillStyle = "#ffffff";
      ctx.font = `${r.isPlayer ? 800 : 600} 46px "QCR Cairo", Arial`;
      ctx.fillText(r.name, W - 210, y + rowH / 2 + 4);
    });
    tex.needsUpdate = true;
  }
  draw([]);
  return {
    group,
    setPosition(x, z) {
      group.position.set(x, 0, z);
    },
    update(rows, title) {
      const key = rows.map((r) => r.id + r.rank).join("|") + title;
      if (key === lastKey) return;
      lastKey = key;
      draw(rows, title);
    },
    dispose() {
      tex.dispose();
      screenMat.dispose();
      frameMat.dispose();
      group.traverse((o) => o.isMesh && o.geometry.dispose());
      group.removeFromParent();
    }
  };
}
export {
  buildScoreboard
};
