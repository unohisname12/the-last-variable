// Unambiguous alphabet (no 0/O/1/I). 5 chars -> ~28M combos, plenty per active class.
const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function genClassCode(len = 5): string {
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHA[Math.floor(Math.random() * ALPHA.length)];
  return out;
}
