import { invariant } from "../core/domain-error.js";

export const AudioAssetId = Object.freeze({
  TITLE_THEME: "TITLE_THEME",
  STAGE_SELECT_THEME: "STAGE_SELECT_THEME",
  BATTLE_STRATEGY: "BATTLE_STRATEGY",
  BATTLE_DS069: "BATTLE_DS069",
  BATTLE_GENERATED_FIXED: "BATTLE_GENERATED_FIXED",
  VICTORY_THEME: "VICTORY_THEME",
  DEFEAT_THEME: "DEFEAT_THEME",
  SWORD_CLASH: "SWORD_CLASH",
  PLAYER_BOW: "PLAYER_BOW",
  ENEMY_BOW: "ENEMY_BOW",
  TURN_GONG: "TURN_GONG",
  TRAP_DAMAGE: "TRAP_DAMAGE",
  CONFUSION_SUCCESS: "CONFUSION_SUCCESS",
  ILLUSION_SUCCESS: "ILLUSION_SUCCESS",
  WIDE_ILLUSION_START: "WIDE_ILLUSION_START",
  CHARGE_RUMBLE: "CHARGE_RUMBLE",
  FIRE_CAST: "FIRE_CAST",
  FIRE_DAMAGE: "FIRE_DAMAGE",
  WATER_CAST: "WATER_CAST",
  WATER_DAMAGE: "WATER_DAMAGE"
});

function freezeAssetDefinition(id, fileName, mimeType, byteLength, sha256) {
  return Object.freeze({ id, fileName, mimeType, byteLength, sha256 });
}

/**
 * v9.7.75のaudio-assets.jsからBase64を復号した同一バイト列の監査表。
 */
export const V9_AUDIO_ASSET_MANIFEST = Object.freeze([
  freezeAssetDefinition(AudioAssetId.TITLE_THEME, "title-theme.mp3", "audio/mpeg", 482368, "679a6f06db608042027c168ec401003fbf1a0430b3c08c7c87efcd7655b89c54"),
  freezeAssetDefinition(AudioAssetId.STAGE_SELECT_THEME, "stage-select-theme.ogg", "audio/ogg", 641897, "c9c3df5596c87d210e330fe7feb8eaadc1a5eb766e2b06133695de78fbee6ee3"),
  freezeAssetDefinition(AudioAssetId.BATTLE_STRATEGY, "battle-strategy.ogg", "audio/ogg", 725578, "b8ec27d28bea184201bec574b272f713f57b67db3c2fb78c206fc63bbb4ebd39"),
  freezeAssetDefinition(AudioAssetId.BATTLE_DS069, "battle-ds069.ogg", "audio/ogg", 1019751, "4919dabd6d33e654aa0b4ac59b62684f0a921084241b32f93bd29183da8df170"),
  freezeAssetDefinition(AudioAssetId.BATTLE_GENERATED_FIXED, "battle-generated-fixed.wav", "audio/wav", 1016108, "abce6acbb40050ac3ba5649f7d3be6153d4d41d29ea3ced6e8de696388c2aeae"),
  freezeAssetDefinition(AudioAssetId.VICTORY_THEME, "victory.mp3", "audio/mpeg", 744609, "f67083c692cd712a00aa7cb6bafd208810f99d3daf986d7e2f3fedcda5610025"),
  freezeAssetDefinition(AudioAssetId.DEFEAT_THEME, "defeat.mp3", "audio/mpeg", 744608, "d3730d18ac190f3b848327f094f75d1c17cb0c711370213a6c9f9724dac655be"),
  freezeAssetDefinition(AudioAssetId.SWORD_CLASH, "sword-clash.mp3", "audio/mpeg", 43244, "18c87a786b4a00d5055b09274f26b531fddfbe31288e9afe0f6f4b451c6d3c86"),
  freezeAssetDefinition(AudioAssetId.PLAYER_BOW, "ally-bow.mp3", "audio/mpeg", 49004, "c2579b26df0b7e7aebc64d4d2b5188b6ef47f965941103ee06a8944b2fd3159a"),
  freezeAssetDefinition(AudioAssetId.ENEMY_BOW, "enemy-bow.mp3", "audio/mpeg", 45548, "e498677ce6ac762075b10936871a4c1400db3dc5215733c40077807579192e8a"),
  freezeAssetDefinition(AudioAssetId.TURN_GONG, "turn-gong.mp3", "audio/mpeg", 21184, "697836ed1e4d772addcfb562d01264867c22f56d520bf125dab315dcc9483ebf"),
  freezeAssetDefinition(AudioAssetId.TRAP_DAMAGE, "trap-damage.mp3", "audio/mpeg", 18445, "34e4ffb0ceb1d6c124fc22b5024f542d2e08c360518a76180c70bec4f266cf66"),
  freezeAssetDefinition(AudioAssetId.CONFUSION_SUCCESS, "confusion-success.mp3", "audio/mpeg", 85127, "d40f9323ec266702e416d80ce5bd957ff9467e37b7ada0fcb574fd9a55697839"),
  freezeAssetDefinition(AudioAssetId.ILLUSION_SUCCESS, "illusion-success.mp3", "audio/mpeg", 44511, "0d065fdc1fe1daf88a4ad1a596c50470bab76007812936fe14397ad3d5d39016"),
  freezeAssetDefinition(AudioAssetId.WIDE_ILLUSION_START, "wide-illusion-start.mp3", "audio/mpeg", 17579, "8f138155d7cf0f790187becebb838311ab3b3ffa43d7bf4fc44acefc4455adcd"),
  freezeAssetDefinition(AudioAssetId.CHARGE_RUMBLE, "charge-rumble.wav", "audio/wav", 187244, "b263373e7b6a29511e01930479888f84e8e9d1a758a221cda9d5d60bb7711cf9"),
  freezeAssetDefinition(AudioAssetId.FIRE_CAST, "fire-tactic.mp3", "audio/mpeg", 85888, "ce05b02096051f06f056cec703b7eb79254773d13a2058f0385dc31a464c32f6"),
  freezeAssetDefinition(AudioAssetId.FIRE_DAMAGE, "fire-tactic-damage.mp3", "audio/mpeg", 11783, "8e810c575545c92f45a23e66ef8c4480212a8d70f7c0ad7542f01a9d745bb390"),
  freezeAssetDefinition(AudioAssetId.WATER_CAST, "water-tactic.mp3", "audio/mpeg", 120998, "70b72c8b14484b8c43cfb3fc76e1da114a0d59f3dd998a17b812a401684608df"),
  freezeAssetDefinition(AudioAssetId.WATER_DAMAGE, "water-tactic-damage.mp3", "audio/mpeg", 15822, "39bebe93b64271654160720999502f7056e0aba4a32be421c2fa467cd8ac4e16")
]);

export const DEFAULT_AUDIO_ASSET_URLS = Object.freeze(Object.fromEntries(
  V9_AUDIO_ASSET_MANIFEST.map((definition) => [
    definition.id,
    new URL(`../../assets/audio/${definition.fileName}`, import.meta.url).href
  ])
));

export function requireAudioAssetCatalog(catalog) {
  invariant(
    catalog !== null && typeof catalog === "object" && !Array.isArray(catalog),
    "AUDIO_ASSET_CATALOG_INVALID"
  );
  for (const assetId of Object.values(AudioAssetId)) {
    invariant(
      typeof catalog[assetId] === "string" && catalog[assetId].length > 0,
      "AUDIO_ASSET_URL_MISSING",
      { assetId }
    );
  }
  return Object.freeze({ ...catalog });
}
