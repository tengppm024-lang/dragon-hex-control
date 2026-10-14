export const DRAGONX_CONTROLS = [
  {
    "id": "espMaster",
    "label": "Enable ESP",
    "group": "ESP",
    "slot": 55,
    "kind": "boolean",
    "min": 0,
    "max": 1,
    "default": false
  },
  {
    "id": "playerBox",
    "label": "Player Box",
    "group": "ESP",
    "slot": 56,
    "kind": "boolean",
    "min": 0,
    "max": 1,
    "default": false
  },
  {
    "id": "espFill",
    "label": "Box Fill",
    "group": "ESP",
    "slot": 71,
    "kind": "boolean",
    "min": 0,
    "max": 1,
    "default": false
  },
  {
    "id": "topTracer",
    "label": "Top Tracer",
    "group": "ESP",
    "slot": 57,
    "kind": "boolean",
    "min": 0,
    "max": 1,
    "default": false
  },
  {
    "id": "playerName",
    "label": "Player Name",
    "group": "ESP",
    "slot": 58,
    "kind": "boolean",
    "min": 0,
    "max": 1,
    "default": false
  },
  {
    "id": "distance",
    "label": "Distance",
    "group": "ESP",
    "slot": 60,
    "kind": "boolean",
    "min": 0,
    "max": 1,
    "default": false
  },
  {
    "id": "healthBar",
    "label": "Health Bar",
    "group": "ESP",
    "slot": 59,
    "kind": "boolean",
    "min": 0,
    "max": 1,
    "default": false
  },
  {
    "id": "skeleton",
    "label": "Skeleton",
    "group": "ESP",
    "slot": 61,
    "kind": "boolean",
    "min": 0,
    "max": 1,
    "default": false
  },
  {
    "id": "aimSystem",
    "label": "Aimbot",
    "group": "AIM",
    "slot": 72,
    "kind": "boolean",
    "min": 0,
    "max": 1,
    "default": false
  },
  {
    "id": "noRecoil",
    "label": "Silent Aim / Scatter",
    "group": "AIM",
    "slot": 73,
    "kind": "boolean",
    "min": 0,
    "max": 1,
    "default": false
  },
  {
    "id": "fovCircle",
    "label": "FOV Circle",
    "group": "AIM",
    "slot": 75,
    "kind": "boolean",
    "min": 0,
    "max": 1,
    "default": false
  },
  {
    "id": "visibleCheck",
    "label": "Visible Check",
    "group": "AIM",
    "slot": 88,
    "kind": "boolean",
    "min": 0,
    "max": 1,
    "default": false
  },
  {
    "id": "noKnock",
    "label": "Ignore Knocked",
    "group": "MISC",
    "slot": 91,
    "kind": "boolean",
    "min": 0,
    "max": 1,
    "default": false
  },
  {
    "id": "fovRed",
    "label": "FOV Red",
    "group": "COLORS",
    "slot": 89,
    "kind": "boolean",
    "min": 0,
    "max": 1,
    "default": false
  },
  {
    "id": "silentAim",
    "label": "Aim Vector",
    "group": "AIM",
    "slot": 76,
    "kind": "boolean",
    "min": 0,
    "max": 1,
    "default": false
  },
  {
    "id": "targetPriority",
    "label": "Target Priority",
    "group": "AIM",
    "slot": 92,
    "kind": "select",
    "min": 0,
    "max": 2,
    "default": 0,
    "options": [
      {
        "value": 0,
        "label": "Crosshair"
      },
      {
        "value": 1,
        "label": "Distance"
      },
      {
        "value": 2,
        "label": "HP"
      }
    ]
  },
  {
    "id": "aimBone",
    "label": "Aim Bone",
    "group": "AIM",
    "slot": 77,
    "kind": "select",
    "min": 0,
    "max": 2,
    "default": 0,
    "options": [
      {
        "value": 0,
        "label": "Head"
      },
      {
        "value": 1,
        "label": "Neck"
      },
      {
        "value": 2,
        "label": "Body"
      }
    ]
  },
  {
    "id": "aimDelay",
    "label": "Delay",
    "group": "AIM",
    "slot": 81,
    "kind": "integer",
    "min": 0,
    "max": 10,
    "default": 3
  },
  {
    "id": "aimPull",
    "label": "Pull",
    "group": "AIM",
    "slot": 82,
    "kind": "integer",
    "min": 1,
    "max": 600,
    "default": 20
  },
  {
    "id": "lineThickness",
    "label": "Line Thickness",
    "group": "ESP",
    "slot": 137,
    "kind": "integer",
    "min": 1,
    "max": 100,
    "default": 100
  },
  {
    "id": "textSize",
    "label": "Text Size",
    "group": "ESP",
    "slot": 108,
    "kind": "integer",
    "min": 20,
    "max": 200,
    "default": 100
  },
  {
    "id": "drawDistance",
    "label": "Draw Distance",
    "group": "ESP",
    "slot": 109,
    "kind": "integer",
    "min": 20,
    "max": 2000,
    "default": 200
  },
  {
    "id": "vectorMode",
    "label": "Vector Mode",
    "group": "AIM",
    "slot": 84,
    "kind": "select",
    "min": 0,
    "max": 2,
    "default": 0,
    "options": [
      {
        "value": 0,
        "label": "Mode 0"
      },
      {
        "value": 1,
        "label": "Mode 1"
      },
      {
        "value": 2,
        "label": "Mode 2"
      }
    ]
  },
  {
    "id": "fovStyle",
    "label": "FOV Style",
    "group": "AIM",
    "slot": 85,
    "kind": "select",
    "min": 0,
    "max": 2,
    "default": 0,
    "options": [
      {
        "value": 0,
        "label": "Mode 0"
      },
      {
        "value": 1,
        "label": "Mode 1"
      },
      {
        "value": 2,
        "label": "Mode 2"
      }
    ]
  },
  {
    "id": "boxStyle",
    "label": "Box Style",
    "group": "ESP",
    "slot": 62,
    "kind": "select",
    "min": 0,
    "max": 2,
    "default": 0,
    "options": [
      {
        "value": 0,
        "label": "Mode 0"
      },
      {
        "value": 1,
        "label": "Mode 1"
      },
      {
        "value": 2,
        "label": "Mode 2"
      }
    ]
  },
  {
    "id": "healthStyle",
    "label": "Health Bar Style",
    "group": "ESP",
    "slot": 63,
    "kind": "select",
    "min": 0,
    "max": 2,
    "default": 0,
    "options": [
      {
        "value": 0,
        "label": "Mode 0"
      },
      {
        "value": 1,
        "label": "Mode 1"
      },
      {
        "value": 2,
        "label": "Mode 2"
      }
    ]
  },
  {
    "id": "menuLanguage",
    "label": "Menu Language",
    "group": "SETTINGS",
    "slot": 132,
    "kind": "select",
    "min": 0,
    "max": 1,
    "default": 1,
    "options": [
      {
        "value": 0,
        "label": "Vietnamese"
      },
      {
        "value": 1,
        "label": "English"
      }
    ]
  },
  {
    "id": "englishLabels",
    "label": "English Labels",
    "group": "SETTINGS",
    "slot": 86,
    "kind": "boolean",
    "min": 0,
    "max": 1,
    "default": false
  },
  {
    "id": "lineOrigin",
    "label": "Line Origin",
    "group": "ESP",
    "slot": 68,
    "kind": "select",
    "min": 0,
    "max": 2,
    "default": 0,
    "options": [
      {
        "value": 0,
        "label": "Mode 0"
      },
      {
        "value": 1,
        "label": "Mode 1"
      },
      {
        "value": 2,
        "label": "Mode 2"
      }
    ]
  },
  {
    "id": "enemyCount",
    "label": "Enemy Count",
    "group": "ESP",
    "slot": 66,
    "kind": "boolean",
    "min": 0,
    "max": 1,
    "default": false
  },
  {
    "id": "espOnlyVisible",
    "label": "Draw Visible Only",
    "group": "ESP",
    "slot": 118,
    "kind": "boolean",
    "min": 0,
    "max": 1,
    "default": false
  },
  {
    "id": "espIgnoreDead",
    "label": "Ignore Dead",
    "group": "MISC",
    "slot": 119,
    "kind": "boolean",
    "min": 0,
    "max": 1,
    "default": false
  },
  {
    "id": "fovRadius",
    "label": "FOV Radius",
    "group": "AIM",
    "slot": 74,
    "kind": "integer",
    "min": 20,
    "max": 360,
    "default": 120
  },
  {
    "id": "aimOnlyFiring",
    "label": "Aim Only While Firing",
    "group": "AIM",
    "slot": 90,
    "kind": "boolean",
    "min": 0,
    "max": 1,
    "default": false
  }
];

export const DRAGONX_IDS = DRAGONX_CONTROLS.map(f=>f.id);
export function normalizeDragonx(input={}) {
  return Object.fromEntries(DRAGONX_CONTROLS.map(f=>{
    const raw=input[f.id];
    const value=f.kind==='boolean' ? (typeof raw==='boolean'?raw:f.default) : Number.isInteger(raw)?Math.max(f.min,Math.min(f.max,raw)):f.default;
    return [f.id,value];
  }));
}
export function validDragonx(input) {
  return input && typeof input==='object' && !Array.isArray(input) && DRAGONX_CONTROLS.every(f=>input[f.id]===undefined || (f.kind==='boolean'?typeof input[f.id]==='boolean':Number.isInteger(input[f.id])&&input[f.id]>=f.min&&input[f.id]<=f.max));
}
export function dragonxPacket(input) {
  const config=normalizeDragonx(input);
  return DRAGONX_CONTROLS.map(f=>Number(config[f.id])).join(';')+';';
}
export function parseDragonxReadback(text) {
  if(typeof text!=='string'||text.length>256||!/^\d{1,4}(;\d{1,4})*;$/.test(text))return null;
  const values=text.slice(0,-1).split(';').map(Number);
  if(values.length!==DRAGONX_CONTROLS.length || values.some((v,i)=>v<DRAGONX_CONTROLS[i].min||v>DRAGONX_CONTROLS[i].max))return null;
  return values.join(';')+';';
}
