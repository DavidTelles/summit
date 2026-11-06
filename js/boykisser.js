import * as THREE from '../lib/three.module.js';
import { DEFAULT_SKIN, skinById } from './skins.js';

const HEIGHT = 1.35;
const LATERAL = new THREE.Vector3(-1, 0, 0);
const DOWN = new THREE.Vector3(0, -1, 0);
const ARM_HANG = 0.88;
const BONES = {
    thighF: 'DEF-thighR_53', shinF: 'DEF-shinR_51', thighB: 'DEF-thighL_47', shinB: 'DEF-shinL_45',
    armF: 'DEF-upper_armR_260', foreF: 'DEF-forearmR_258', armB: 'DEF-upper_armL_158', foreB: 'DEF-forearmL_156',
    neck: 'DEF-spine005_372', head: 'DEF-spine006_371',
    tail0: 'DEF-tail_41', tail1: 'DEF-tail_1_40', tail2: 'DEF-tail_2_39', tail3: 'DEF-tail_3_38', tail4: 'DEF-tail_4_37'
};
const FEET = { footF: 'DEF-footR_49', footB: 'DEF-footL_43' };
const ARM_CHILD = { armF: 'foreF', armB: 'foreB' };
const CHEST = 'DEF-spine004_373';
const FUR = new Set(['white', 'pink']);

let source = null;
let cloneRig = null;

function restFromClip(scene, clip) {
    for (const track of clip.tracks) {
        const { nodeName, propertyName } = THREE.PropertyBinding.parseTrackName(track.name);
        const node = scene.getObjectByName(nodeName);
        if (!node || !node[propertyName]) continue;
        node[propertyName].fromArray(track.values, 0);
    }
    scene.updateMatrixWorld(true);
}

function prepare(gltf) {
    const scene = gltf.scene;
    if (gltf.animations[0]) restFromClip(scene, gltf.animations[0]);
    const box = new THREE.Box3();
    let meshNode = null;
    const colors = {};
    scene.traverse(node => {
        if (!node.isSkinnedMesh) return;
        meshNode = node;
        colors[node.material.name] = node.material.color.clone();
        node.computeBoundingBox();
        box.union(node.boundingBox.clone().applyMatrix4(node.matrixWorld));
    });
    const rest = {};
    for (const [key, name] of Object.entries(BONES)) {
        const world = scene.getObjectByName(name).getWorldQuaternion(new THREE.Quaternion());
        rest[key] = { world, inverse: world.clone().invert(), hang: new THREE.Quaternion() };
    }
    for (const [arm, fore] of Object.entries(ARM_CHILD)) {
        const a = scene.getObjectByName(BONES[arm]).getWorldPosition(new THREE.Vector3());
        const b = scene.getObjectByName(BONES[fore]).getWorldPosition(new THREE.Vector3());
        rest[arm].hang.slerp(new THREE.Quaternion().setFromUnitVectors(b.sub(a).normalize(), DOWN), ARM_HANG);
    }
    const scale = HEIGHT / (box.max.y - box.min.y);
    const hip = scene.getObjectByName(BONES.thighF).getWorldPosition(new THREE.Vector3());
    const ankle = scene.getObjectByName(FEET.footF).getWorldPosition(new THREE.Vector3());
    const chest = scene.getObjectByName(CHEST);
    const scarf = new THREE.Matrix4().copy(chest.matrixWorld).invert().multiply(meshNode.matrixWorld).multiply(new THREE.Matrix4().makeTranslation(0, 1.98, 0.04));
    return {
        scene, rest, scale, colors, scarf,
        floor: box.min.y,
        hipY: (hip.y - box.min.y) * scale,
        ankleY: (ankle.y - box.min.y) * scale
    };
}

if (typeof document !== 'undefined') {
    try {
        const [{ GLTFLoader }, { clone }] = await Promise.all([import('../lib/GLTFLoader.js'), import('../lib/SkeletonUtils.js')]);
        const gltf = await new GLTFLoader().loadAsync(new URL('../boykisser.glb', import.meta.url).href);
        source = prepare(gltf);
        cloneRig = clone;
    } catch (err) {
        console.error('boykisser.glb não carregou', err);
    }
}

const NOISE = `
varying vec3 vObj;
uniform float uHurt; uniform float uFlash; uniform float uDissolve; uniform float uFur;
uniform float uMarkType; uniform vec3 uMarkColor; uniform float uMarkGlow; uniform vec3 uEdge;
float h3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float n3(vec3 x) {
    vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(h3(i), h3(i + vec3(1, 0, 0)), f.x), mix(h3(i + vec3(0, 1, 0)), h3(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(h3(i + vec3(0, 0, 1)), h3(i + vec3(1, 0, 1)), f.x), mix(h3(i + vec3(0, 1, 1)), h3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}`;

const SURFACE = `
#include <color_fragment>
float fxEdge = 0.0;
float fxMark = 0.0;
if (uDissolve > 0.0) {
    float th = n3(vObj * 4.5) * 0.72 + (1.0 - clamp(vObj.y / 3.5, 0.0, 1.0)) * 0.28;
    if (th < uDissolve * 1.04) discard;
    fxEdge = 1.0 - smoothstep(0.0, 0.08, th - uDissolve * 1.04);
}
if (uFur > 0.5) {
    if (uMarkType > 0.5) {
        float band = abs(fract(vObj.y * 2.3 + n3(vObj * 1.7) * 0.9) - 0.5);
        float crack = abs(n3(vObj * 3.2) - 0.5);
        fxMark = uMarkType < 1.5 ? smoothstep(0.075, 0.03, band) * step(0.45, n3(vObj * 1.3 + 4.0)) : smoothstep(0.04, 0.012, crack);
        diffuseColor.rgb = mix(diffuseColor.rgb, uMarkColor, fxMark * 0.85);
    }
    if (uHurt > 0.001) {
        float blot = n3(vObj * 2.6 + 3.1);
        float bruise = smoothstep(0.8 - uHurt * 0.24, 0.88 - uHurt * 0.24, blot);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.52, 0.34, 0.44), bruise * 0.8);
        float claw = abs(fract((vObj.x * 0.7 + vObj.y * 0.9 + vObj.z * 0.4) * 11.0) - 0.5);
        float patchMask = smoothstep(0.74 - uHurt * 0.08, 0.8 - uHurt * 0.08, n3(vObj * 2.4 + 11.0)) * smoothstep(0.35, 0.55, n3(vObj * 7.0 + 2.0));
        float scratch = smoothstep(0.09, 0.04, claw) * patchMask * smoothstep(0.3, 0.75, uHurt);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.5, 0.05, 0.07), scratch * 0.9);
        float grime = smoothstep(0.45, 0.85, n3(vObj * 7.0 + 5.0));
        diffuseColor.rgb *= 1.0 - grime * 0.24 * uHurt;
    }
}
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), uFlash * 0.7);`;

const GLOW = `
#include <emissivemap_fragment>
totalEmissiveRadiance += uEdge * fxEdge * 3.0 + uMarkColor * fxMark * uMarkGlow + vec3(uFlash * 0.6);`;

function patchShader(shader) {
    Object.assign(shader.uniforms, this.userData.fx);
    shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vObj;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;');
    shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>' + NOISE)
        .replace('#include <color_fragment>', SURFACE)
        .replace('#include <emissivemap_fragment>', GLOW);
}

function makeFx() {
    return {
        uHurt: { value: 0 }, uFlash: { value: 0 }, uDissolve: { value: 0 },
        uMarkType: { value: 0 }, uMarkColor: { value: new THREE.Color(0, 0, 0) }, uMarkGlow: { value: 0 }, uEdge: { value: new THREE.Color(0x9feaff) }
    };
}

function fxMaterial(base, fx, fur) {
    const m = base.clone();
    m.transparent = true;
    m.fog = false;
    m.userData.fx = { ...fx, uFur: { value: fur ? 1 : 0 } };
    m.onBeforeCompile = patchShader;
    return m;
}

function makeScarf(fx) {
    const mat = fxMaterial(new THREE.MeshStandardMaterial({ name: 'scarf', roughness: 0.85, side: THREE.DoubleSide }), fx, false);
    const group = new THREE.Group();
    const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.1, 8, 24), mat);
    wrap.rotation.x = Math.PI / 2;
    wrap.scale.set(1, 0.85, 1);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.62, 0.05), mat);
    tail.position.set(0.18, -0.3, -0.32);
    tail.rotation.set(0.35, 0, -0.25);
    const tail2 = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.48, 0.05), mat);
    tail2.position.set(0.02, -0.24, -0.34);
    tail2.rotation.set(0.3, 0, 0.12);
    group.add(wrap, tail, tail2);
    return { group, mat, geometries: [wrap.geometry, tail.geometry, tail2.geometry], tails: [tail, tail2] };
}

const delta = new THREE.Quaternion();
const swing = new THREE.Quaternion();

export function makeBoykisser(layer, skinId = DEFAULT_SKIN) {
    if (!source) return null;
    const root = cloneRig(source.scene);
    const fx = makeFx();
    const materials = new Map();
    const byName = {};
    let skeleton = null;
    root.traverse(node => {
        byName[node.name] = node;
        if (!node.isMesh) return;
        node.frustumCulled = false;
        node.renderOrder = layer;
        if (node.isSkinnedMesh) skeleton = node.skeleton;
        const name = node.material.name;
        if (!materials.has(name)) materials.set(name, fxMaterial(node.material, fx, FUR.has(name)));
        node.material = materials.get(name);
    });
    const joints = {};
    for (const [key, name] of Object.entries(BONES)) {
        joints[key] = { bone: byName[name], base: byName[name].quaternion.clone(), rest: source.rest[key] };
    }
    const feet = Object.values(FEET).map(name => byName[name]);
    const scarf = makeScarf(fx);
    source.scarf.decompose(scarf.group.position, scarf.group.quaternion, scarf.group.scale);
    scarf.group.traverse(n => { if (n.isMesh) { n.renderOrder = layer + 1; n.frustumCulled = false; } });
    byName[CHEST].add(scarf.group);
    root.scale.setScalar(source.scale);
    root.position.y = -source.floor * source.scale;
    const lights = new THREE.Group();
    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(1.2, 2.5, 3);
    lights.add(new THREE.HemisphereLight(0xffffff, 0x9a93a8, 1.9), sun, sun.target);
    const model = {
        root, joints, feet, lights, skeleton, fx, scarf,
        hipY: source.hipY, ankleY: source.ankleY,
        materials: [...materials.values(), scarf.mat], byName: Object.fromEntries(materials), padBase: new THREE.Color()
    };
    applySkin(model, skinId);
    return model;
}

export function applySkin(model, skinId) {
    const skin = skinById(skinId) || skinById(DEFAULT_SKIN);
    const set = (name, hex) => {
        const m = model.byName[name];
        if (m) m.color.copy(hex === undefined ? source.colors[name] : new THREE.Color(hex));
    };
    set('white', skin.fur);
    set('pink', skin.pads);
    set('material', skin.blush);
    set('black', skin.eyes);
    const pad = model.byName.pink;
    if (pad) {
        pad.emissive.setHex(skin.padGlow || 0x000000);
        model.padBase.copy(pad.color);
    }
    const marks = skin.marks;
    model.fx.uMarkType.value = marks ? marks.type : 0;
    model.fx.uMarkGlow.value = marks ? marks.glow : 0;
    model.fx.uMarkColor.value.setHex(marks ? marks.color : 0x000000);
    model.scarf.group.visible = !!skin.scarf;
    if (skin.scarf) model.scarf.mat.color.setHex(skin.scarf);
    model.skin = skin.id;
}

export function poseJoint(joint, angle) {
    const { bone, base, rest } = joint;
    swing.setFromAxisAngle(LATERAL, angle).multiply(rest.hang);
    delta.copy(rest.inverse).multiply(swing).multiply(rest.world);
    bone.quaternion.copy(base).multiply(delta);
}

export function disposeBoykisser(model) {
    if (!model) return;
    model.materials.forEach(m => m.dispose());
    model.scarf.geometries.forEach(g => g.dispose());
    if (model.skeleton) model.skeleton.dispose();
}
