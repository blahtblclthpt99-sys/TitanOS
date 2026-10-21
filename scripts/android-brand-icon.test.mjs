import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = file => readFileSync(new URL(file, import.meta.url), "utf8");
const icon = read("../android/app/src/main/res/drawable/titanos_metallic_mark.xml");
const normal = read("../android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml");
const round = read("../android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml");
const background = read("../android/app/src/main/res/values/ic_launcher_background.xml");
test("metallic vector icon exists within launcher safe boundaries", () => {
  assert.match(icon, /<vector /);
  assert.match(icon, /viewportWidth="108"/);
  assert.match(icon, /viewportHeight="108"/);
  assert.match(icon, /#E9F5FF/);
  assert.match(icon, /#FFBD43/);
});
test("both adaptive launcher variants use metallic Titan shield", () => {
  for (const source of [normal, round]) assert.match(source, /@drawable\/titanos_metallic_mark/);
  assert.match(background, /#06162C/);
});
