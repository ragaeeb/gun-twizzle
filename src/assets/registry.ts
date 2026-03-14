// Vite resolves these imports to hashed URLs at build time.
// In dev, they resolve to the original file paths served by Vite's dev server.

// ─── Audio SFX ─────────────────────────────────────────────────────────
import bulletSfx from './audio/sfx/bullet.mp3?url';
import bullet2Sfx from './audio/sfx/bullet2.mp3?url';
import clipSfx from './audio/sfx/clip.mp3?url';
import crackSfx from './audio/sfx/crack.mp3?url';
import drawSfx from './audio/sfx/draw.mp3?url';
import draw2Sfx from './audio/sfx/draw2.mp3?url';
import draw3Sfx from './audio/sfx/draw3.mp3?url';
import gunshotSfx from './audio/sfx/gunshot.mp3?url';
import gunshot2Sfx from './audio/sfx/gunshot2.mp3?url';
import knifeSfx from './audio/sfx/knife.mp3?url';
import loadSfx from './audio/sfx/load.mp3?url';
import switchSfx from './audio/sfx/switch.mp3?url';
import tacSfx from './audio/sfx/tac.mp3?url';
// ─── HUD images ────────────────────────────────────────────────────────
import ak47Hud from './hud/ak47.webp';
import knifeHud from './hud/knife.webp';
import uspHud from './hud/usp.webp';
import shieldPickupModel from './models/pickups/armor_vest.glb?url';
// ─── Pickup models ─────────────────────────────────────────────────────
import firstAidKitPickupModel from './models/pickups/first_aid_kit_box_first_aid.glb?url';
import ammoPickupModel from './models/pickups/military_box_with_ammunition_pg-7v.glb?url';
// ─── Weapon models (classic) ──────────────────────────────────────────
import ak47Model from './models/weapons/AK47.glb?url';
import ak47Markers from './models/weapons/AK47.json?url';
import bulletModel from './models/weapons/Bullet.glb?url';
import knifeModel from './models/weapons/Knife.glb?url';
import knifeMarkers from './models/weapons/Knife.json?url';
import uspModel from './models/weapons/Usp.glb?url';
import uspMarkers from './models/weapons/Usp.json?url';
// ─── Textures ──────────────────────────────────────────────────────────
import bulletHoleTexture from './textures/bullethole3.webp';
import muzzleFlashTexture from './textures/muzzleFlash.webp';
import smokeTexture from './textures/smoke.webp';
import sparksTexture from './textures/sparks2.webp';
import waterNormalsTexture from './textures/waternormals.webp';

// ─── Registry ──────────────────────────────────────────────────────────

export const AssetRegistry = {
    hud: {
        ak47: ak47Hud,
        knife: knifeHud,
        usp: uspHud,
    },
    pickups: {
        ammo: ammoPickupModel,
        health: firstAidKitPickupModel,
        shield: shieldPickupModel,
    },
    sounds: {
        bullet: bulletSfx,
        bullet2: bullet2Sfx,
        clip: clipSfx,
        crack: crackSfx,
        draw: drawSfx,
        draw2: draw2Sfx,
        draw3: draw3Sfx,
        gunshot: gunshotSfx,
        gunshot2: gunshot2Sfx,
        knife: knifeSfx,
        load: loadSfx,
        switch: switchSfx,
        tac: tacSfx,
    },
    textures: {
        bulletHole: bulletHoleTexture,
        muzzleFlash: muzzleFlashTexture,
        smoke: smokeTexture,
        sparks: sparksTexture,
        waterNormals: waterNormalsTexture,
    },
    weapons: {
        ak47: { markers: ak47Markers, model: ak47Model },
        bullet: { model: bulletModel },
        knife: { markers: knifeMarkers, model: knifeModel },
        usp: { markers: uspMarkers, model: uspModel },
    },
} as const;
