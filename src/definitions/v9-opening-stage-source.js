// Generated from pinned v9.7.75 game.js by scripts/import-v9-opening-stages.mjs.
function freeze(value) {
  if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
export const V9_OPENING_STAGE_SOURCE = freeze([
  {
    "id": "shaohuashan-road",
    "chapterNumber": 1,
    "title": "第一章　少華山への道",
    "description": "史進と少華山三頭領で、山道各所の官軍と後方の追手を突破し、少華山へ脱出する。敵軍を全滅させても勝利となる。",
    "leader": "shi_jin",
    "turnLimit": 15,
    "escape": {
      "destination": {
        "x": 3,
        "y": 0
      },
      "radius": 0,
      "unitIds": [
        "shi_jin"
      ]
    },
    "objectiveText": "勝利：史進が北の旗へ到達、または敵軍を全滅<br>敗北：史進が敗走",
    "requiredSurvivors": [],
    "units": [
      {
        "id": "shi_jin",
        "characterId": "shi_jin",
        "army": "PLAYER",
        "position": {
          "x": 1,
          "y": 14
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "zhu_wu",
        "characterId": "zhu_wu",
        "army": "PLAYER",
        "position": {
          "x": 0,
          "y": 12
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "chen_da",
        "characterId": "chen_da",
        "army": "PLAYER",
        "position": {
          "x": 2,
          "y": 14
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "yang_chun",
        "characterId": "yang_chun",
        "army": "PLAYER",
        "position": {
          "x": 3,
          "y": 14
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "captain1",
        "characterId": "shaohuashan-road_captain1",
        "army": "ENEMY",
        "position": {
          "x": 6,
          "y": 15
        },
        "move": 4,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "shaohuashan-road_captain1",
          "name": "官軍騎兵隊長",
          "shortName": "騎",
          "martial": 52,
          "command": 48,
          "intelligence": 34,
          "charisma": 28,
          "portraitKey": "mob_captain_unreliable_middle",
          "alias": "官軍騎兵隊長",
          "combatSkills": [
            "騎乗戦闘"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "慎重・威圧的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "soldier1",
        "characterId": "shaohuashan-road_soldier1",
        "army": "ENEMY",
        "position": {
          "x": 7,
          "y": 14
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "shaohuashan-road_soldier1",
          "name": "官兵甲",
          "shortName": "甲",
          "martial": 36,
          "command": 32,
          "intelligence": 20,
          "charisma": 18,
          "portraitKey": "mob_infantry_very_weak",
          "alias": "官兵",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "実直",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "soldier2",
        "characterId": "shaohuashan-road_soldier2",
        "army": "ENEMY",
        "position": {
          "x": 5,
          "y": 4
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "shaohuashan-road_soldier2",
          "name": "官軍弓兵",
          "shortName": "弓",
          "martial": 35,
          "command": 34,
          "intelligence": 24,
          "charisma": 18,
          "portraitKey": "mob_bow_very_weak",
          "alias": "官軍弓兵",
          "combatSkills": [
            "弓弩術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "実直",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "guard1",
        "characterId": "shaohuashan-road_guard1",
        "army": "ENEMY",
        "position": {
          "x": 3,
          "y": 2
        },
        "move": 2,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "shaohuashan-road_guard1",
          "name": "関所守備兵",
          "shortName": "守",
          "martial": 44,
          "command": 46,
          "intelligence": 28,
          "charisma": 25,
          "portraitKey": "mob_infantry_older_weak",
          "alias": "守備兵",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "慎重",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "mid_guard1",
        "characterId": "shaohuashan-road_mid_guard1",
        "army": "ENEMY",
        "position": {
          "x": 1,
          "y": 10
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "shaohuashan-road_mid_guard1",
          "name": "山道守備兵",
          "shortName": "守",
          "martial": 43,
          "command": 47,
          "intelligence": 30,
          "charisma": 24,
          "portraitKey": "mob_infantry_older_weak",
          "alias": "山道守備兵",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "慎重",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "mid_soldier1",
        "characterId": "shaohuashan-road_mid_soldier1",
        "army": "ENEMY",
        "position": {
          "x": 6,
          "y": 9
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "shaohuashan-road_mid_soldier1",
          "name": "官兵乙",
          "shortName": "乙",
          "martial": 39,
          "command": 38,
          "intelligence": 24,
          "charisma": 20,
          "portraitKey": "mob_infantry_young_weak",
          "alias": "官兵",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "実直",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "mid_archer1",
        "characterId": "shaohuashan-road_mid_archer1",
        "army": "ENEMY",
        "position": {
          "x": 2,
          "y": 7
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "shaohuashan-road_mid_archer1",
          "name": "山道弓兵",
          "shortName": "弓",
          "martial": 37,
          "command": 38,
          "intelligence": 30,
          "charisma": 20,
          "portraitKey": "mob_bow_young_weak",
          "alias": "官軍弓兵",
          "combatSkills": [
            "弓弩術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "慎重",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "strategist1",
        "characterId": "shaohuashan-road_strategist1",
        "army": "ENEMY",
        "position": {
          "x": 5,
          "y": 8
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "shaohuashan-road_strategist1",
          "name": "官軍参謀",
          "shortName": "謀",
          "martial": 22,
          "command": 46,
          "intelligence": 88,
          "charisma": 40,
          "portraitKey": "mob_adviser_military_frontline",
          "alias": "官軍参謀",
          "combatSkills": [
            "なし"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "冷静・策謀的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      }
    ],
    "intro": [
      {
        "unitId": "shi_jin",
        "text": "官軍が迫っている。ここで囲まれる前に、少華山へ抜けるぞ！"
      },
      {
        "unitId": "zhu_wu",
        "text": "北の旗を目指しましょう。前には守備兵、後ろには追手がいます。"
      }
    ],
    "victory": [
      {
        "unitId": "shi_jin",
        "text": "よし、包囲を抜けた！　このまま少華山へ急ぐぞ！"
      },
      {
        "unitId": "zhu_wu",
        "text": "追手もすぐには追いつけますまい。皆、無事で何よりです。"
      }
    ]
  },
  {
    "id": "wild-boar-forest",
    "chapterNumber": 2,
    "title": "第二章　野猪林の危機",
    "description": "林冲を狙う董超・薛覇と増派された開封府の公人・参謀部隊を、魯智深とともに退ける。",
    "leader": "lin_chong",
    "turnLimit": 15,
    "escape": null,
    "objectiveText": "勝利：董超・薛覇らを全滅<br>敗北：林冲が敗走",
    "requiredSurvivors": [],
    "units": [
      {
        "id": "lin_chong",
        "characterId": "lin_chong",
        "army": "PLAYER",
        "position": {
          "x": 3,
          "y": 12
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "lu_zhishen",
        "characterId": "lu_zhishen",
        "army": "PLAYER",
        "position": {
          "x": 2,
          "y": 14
        },
        "move": 3,
        "facing": "NORTH"
      },
      {
        "id": "dong_chao",
        "characterId": "dong_chao",
        "army": "ENEMY",
        "position": {
          "x": 4,
          "y": 2
        },
        "move": 3,
        "facing": "SOUTH"
      },
      {
        "id": "xue_ba",
        "characterId": "xue_ba",
        "army": "ENEMY",
        "position": {
          "x": 2,
          "y": 4
        },
        "move": 3,
        "facing": "SOUTH"
      },
      {
        "id": "escort_yz1",
        "characterId": "wild-boar-forest_escort_yz1",
        "army": "ENEMY",
        "position": {
          "x": 5,
          "y": 6
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "wild-boar-forest_escort_yz1",
          "name": "開封府公人丙一隊",
          "shortName": "丙",
          "martial": 36,
          "command": 34,
          "intelligence": 24,
          "charisma": 18,
          "portraitKey": "mob_infantry_young_weak",
          "alias": "下級公人",
          "combatSkills": [
            "なし"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "小心・未熟",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "escort_yz2",
        "characterId": "wild-boar-forest_escort_yz2",
        "army": "ENEMY",
        "position": {
          "x": 6,
          "y": 2
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "wild-boar-forest_escort_yz2",
          "name": "開封府公人丙二隊",
          "shortName": "丙",
          "martial": 36,
          "command": 34,
          "intelligence": 24,
          "charisma": 18,
          "portraitKey": "mob_infantry_young_weak",
          "alias": "下級公人",
          "combatSkills": [
            "なし"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "小心・未熟",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "escort_yz4",
        "characterId": "wild-boar-forest_escort_yz4",
        "army": "ENEMY",
        "position": {
          "x": 5,
          "y": 10
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "wild-boar-forest_escort_yz4",
          "name": "開封府公人丁",
          "shortName": "丁",
          "martial": 34,
          "command": 32,
          "intelligence": 22,
          "charisma": 16,
          "portraitKey": "mob_infantry_very_weak",
          "alias": "下級公人",
          "combatSkills": [
            "なし"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "小心・未熟",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "escort_yz5",
        "characterId": "wild-boar-forest_escort_yz5",
        "army": "ENEMY",
        "position": {
          "x": 1,
          "y": 4
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "wild-boar-forest_escort_yz5",
          "name": "開封府弓兵",
          "shortName": "弓",
          "martial": 40,
          "command": 40,
          "intelligence": 34,
          "charisma": 20,
          "portraitKey": "mob_bow_older_weak",
          "alias": "開封府弓兵",
          "combatSkills": [
            "弓弩術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "慎重",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "kaifeng_adviser",
        "characterId": "wild-boar-forest_kaifeng_adviser",
        "army": "ENEMY",
        "position": {
          "x": 1,
          "y": 8
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "wild-boar-forest_kaifeng_adviser",
          "name": "開封府参謀",
          "shortName": "謀",
          "martial": 24,
          "command": 48,
          "intelligence": 88,
          "charisma": 42,
          "portraitKey": "mob_adviser_civil_document",
          "alias": "開封府参謀",
          "combatSkills": [
            "なし"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "冷静・策謀的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      }
    ],
    "intro": [
      {
        "unitId": "lin_chong",
        "text": "董超、薛覇……まさか、ここで俺を殺すつもりだったのか。"
      },
      {
        "unitId": "lu_zhishen",
        "text": "林冲、話はあとだ！　まずはこいつらを叩き伏せるぞ！"
      }
    ],
    "victory": [
      {
        "unitId": "lu_zhishen",
        "text": "はっはっは！　これで悪党どもは片付いたな！"
      },
      {
        "unitId": "lin_chong",
        "text": "魯智深、この恩は忘れぬ。だが俺の受難は、まだ終わりそうにない。"
      }
    ]
  },
  {
    "id": "birthday-convoy",
    "chapterNumber": 3,
    "title": "第三章　生辰綱奪取",
    "description": "晁蓋・呉用らで5ターン以内に護送車を含む初期護送部隊を全滅させ、第5自軍ターン開始時、または第5自軍ターン中の護送隊壊滅直後に現れる追捕軍をかわして北の湿地帯へ脱出する。追捕軍出現後は敵軍を全滅させても勝利となる。",
    "leader": "chao_gai",
    "turnLimit": 15,
    "escape": {
      "destination": {
        "x": 3,
        "y": 0
      },
      "radius": 0,
      "unitIds": [
        "chao_gai"
      ]
    },
    "objectiveText": "勝利：5ターン以内に護送車を含む初期護送部隊を殲滅し、その後、晁蓋が北の旗へ到達。または追捕軍出現後、敵軍を全滅<br>敗北：晁蓋が敗走・5ターン以内に護送部隊を殲滅できない",
    "requiredSurvivors": [],
    "raid": {
      "escapeObjective": "勝利：生辰綱を奪取し、晁蓋が北端の旗へ到達。または追捕軍出現後、敵軍を全滅<br>敗北：晁蓋が敗走",
      "completionMessages": [
        "護送車を含む初期護送部隊を全滅！　生辰綱を奪取した。",
        "任務更新：晁蓋を北端の湿地に出現した旗まで脱出させてください。"
      ],
      "turnLimit": 5,
      "reinforcementTurn": 5,
      "stationaryUnits": [
        "convoy_cart"
      ],
      "arrival": [
        {
          "unitId": "raid_captain",
          "text": "追捕軍、到着！　生辰綱を狙う賊どもを一人も逃がすな！",
          "actionLabel": "官軍増援"
        },
        {
          "unitId": "wu_yong",
          "text": "追捕軍が来ました。作戦どおり生辰綱を奪取し、北の湿地へ抜けます。包囲される前に道を開きましょう！"
        }
      ]
    },
    "units": [
      {
        "id": "chao_gai",
        "characterId": "chao_gai",
        "army": "PLAYER",
        "position": {
          "x": 2,
          "y": 15
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "wu_yong",
        "characterId": "wu_yong",
        "army": "PLAYER",
        "position": {
          "x": 1,
          "y": 15
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "gongsun_sheng",
        "characterId": "gongsun_sheng",
        "army": "PLAYER",
        "position": {
          "x": 3,
          "y": 15
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "liu_tang",
        "characterId": "liu_tang",
        "army": "PLAYER",
        "position": {
          "x": 4,
          "y": 15
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "ruan_xiaoer",
        "characterId": "ruan_xiaoer",
        "army": "PLAYER",
        "position": {
          "x": 0,
          "y": 14
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "ruan_xiaowu",
        "characterId": "ruan_xiaowu",
        "army": "PLAYER",
        "position": {
          "x": 1,
          "y": 14
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "ruan_xiaoqi",
        "characterId": "ruan_xiaoqi",
        "army": "PLAYER",
        "position": {
          "x": 2,
          "y": 14
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "bai_sheng",
        "characterId": "bai_sheng",
        "army": "PLAYER",
        "position": {
          "x": 4,
          "y": 14
        },
        "move": 3,
        "facing": "NORTH"
      },
      {
        "id": "convoy_cart",
        "characterId": "birthday-convoy_convoy_cart",
        "army": "ENEMY",
        "position": {
          "x": 4,
          "y": 12
        },
        "move": 0,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "birthday-convoy_convoy_cart",
          "name": "生辰綱護送車",
          "shortName": "車",
          "martial": 8,
          "command": 20,
          "intelligence": 10,
          "charisma": 10,
          "portraitKey": "convoy_cart_portrait",
          "alias": "生辰綱",
          "combatSkills": [
            "なし"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "なし",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "yang_zhi",
        "characterId": "yang_zhi",
        "army": "ENEMY",
        "position": {
          "x": 4,
          "y": 10
        },
        "move": 4,
        "facing": "SOUTH"
      },
      {
        "id": "escort1",
        "characterId": "birthday-convoy_escort1",
        "army": "ENEMY",
        "position": {
          "x": 5,
          "y": 11
        },
        "move": 4,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "birthday-convoy_escort1",
          "name": "護送騎兵",
          "shortName": "騎",
          "martial": 45,
          "command": 45,
          "intelligence": 28,
          "charisma": 24,
          "portraitKey": "mob_cavalry_very_weak",
          "alias": "護送騎兵",
          "combatSkills": [
            "騎乗戦闘"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "実直",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "escort2",
        "characterId": "birthday-convoy_escort2",
        "army": "ENEMY",
        "position": {
          "x": 3,
          "y": 11
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "birthday-convoy_escort2",
          "name": "護送兵乙",
          "shortName": "乙",
          "martial": 40,
          "command": 42,
          "intelligence": 28,
          "charisma": 24,
          "portraitKey": "mob_infantry_young_weak",
          "alias": "護送兵",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "実直",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "escort3",
        "characterId": "birthday-convoy_escort3",
        "army": "ENEMY",
        "position": {
          "x": 6,
          "y": 12
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "birthday-convoy_escort3",
          "name": "護送兵丙",
          "shortName": "丙",
          "martial": 38,
          "command": 40,
          "intelligence": 26,
          "charisma": 22,
          "portraitKey": "mob_infantry_older_weak",
          "alias": "護送兵",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "実直",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "escort4",
        "characterId": "birthday-convoy_escort4",
        "army": "ENEMY",
        "position": {
          "x": 2,
          "y": 10
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "birthday-convoy_escort4",
          "name": "護送槍兵甲",
          "shortName": "槍",
          "martial": 42,
          "command": 44,
          "intelligence": 28,
          "charisma": 24,
          "portraitKey": "mob_infantry_young_normal_a",
          "alias": "護送槍兵",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "実直",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "escort5",
        "characterId": "birthday-convoy_escort5",
        "army": "ENEMY",
        "position": {
          "x": 6,
          "y": 10
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "birthday-convoy_escort5",
          "name": "護送槍兵乙",
          "shortName": "槍",
          "martial": 42,
          "command": 44,
          "intelligence": 28,
          "charisma": 24,
          "portraitKey": "mob_infantry_older_normal_a",
          "alias": "護送槍兵",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "実直",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "escort6",
        "characterId": "birthday-convoy_escort6",
        "army": "ENEMY",
        "position": {
          "x": 1,
          "y": 11
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "birthday-convoy_escort6",
          "name": "護送弓兵",
          "shortName": "弓",
          "martial": 38,
          "command": 40,
          "intelligence": 32,
          "charisma": 22,
          "portraitKey": "mob_bow_older_weak",
          "alias": "護送弓兵",
          "combatSkills": [
            "弓弩術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "慎重",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "raid_captain",
        "characterId": "birthday-convoy_raid_captain",
        "army": "ENEMY",
        "position": {
          "x": 7,
          "y": 15
        },
        "move": 4,
        "facing": "NORTH",
        "reserve": true,
        "mobCharacter": {
          "id": "birthday-convoy_raid_captain",
          "name": "追捕軍隊長",
          "shortName": "将",
          "martial": 58,
          "command": 60,
          "intelligence": 42,
          "charisma": 38,
          "portraitKey": "mob_captain_high_trust_young",
          "alias": "官軍追捕隊長",
          "combatSkills": [
            "騎乗戦闘"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "慎重・威圧的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "raid_cavalry1",
        "characterId": "birthday-convoy_raid_cavalry1",
        "army": "ENEMY",
        "position": {
          "x": 6,
          "y": 15
        },
        "move": 4,
        "facing": "NORTH",
        "reserve": true,
        "mobCharacter": {
          "id": "birthday-convoy_raid_cavalry1",
          "name": "追捕騎兵甲",
          "shortName": "騎",
          "martial": 48,
          "command": 48,
          "intelligence": 30,
          "charisma": 24,
          "portraitKey": "mob_cavalry_young_normal_a",
          "alias": "官軍騎兵",
          "combatSkills": [
            "騎乗戦闘"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "実直",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "raid_cavalry2",
        "characterId": "birthday-convoy_raid_cavalry2",
        "army": "ENEMY",
        "position": {
          "x": 0,
          "y": 13
        },
        "move": 4,
        "facing": "NORTH",
        "reserve": true,
        "mobCharacter": {
          "id": "birthday-convoy_raid_cavalry2",
          "name": "追捕騎兵乙",
          "shortName": "騎",
          "martial": 46,
          "command": 46,
          "intelligence": 28,
          "charisma": 22,
          "portraitKey": "mob_cavalry_young_weak",
          "alias": "官軍騎兵",
          "combatSkills": [
            "騎乗戦闘"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "実直",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "raid_soldier1",
        "characterId": "birthday-convoy_raid_soldier1",
        "army": "ENEMY",
        "position": {
          "x": 7,
          "y": 13
        },
        "move": 3,
        "facing": "NORTH",
        "reserve": true,
        "mobCharacter": {
          "id": "birthday-convoy_raid_soldier1",
          "name": "追捕官兵甲",
          "shortName": "甲",
          "martial": 40,
          "command": 42,
          "intelligence": 28,
          "charisma": 22,
          "portraitKey": "mob_infantry_young_normal_a",
          "alias": "官兵",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "実直",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "raid_soldier2",
        "characterId": "birthday-convoy_raid_soldier2",
        "army": "ENEMY",
        "position": {
          "x": 6,
          "y": 9
        },
        "move": 3,
        "facing": "SOUTH",
        "reserve": true,
        "mobCharacter": {
          "id": "birthday-convoy_raid_soldier2",
          "name": "追捕官兵乙",
          "shortName": "乙",
          "martial": 40,
          "command": 42,
          "intelligence": 28,
          "charisma": 22,
          "portraitKey": "mob_infantry_young_normal_b",
          "alias": "官兵",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "実直",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "raid_soldier3",
        "characterId": "birthday-convoy_raid_soldier3",
        "army": "ENEMY",
        "position": {
          "x": 0,
          "y": 9
        },
        "move": 3,
        "facing": "SOUTH",
        "reserve": true,
        "mobCharacter": {
          "id": "birthday-convoy_raid_soldier3",
          "name": "追捕官兵丙",
          "shortName": "丙",
          "martial": 40,
          "command": 42,
          "intelligence": 28,
          "charisma": 22,
          "portraitKey": "mob_infantry_older_normal_a",
          "alias": "官兵",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "実直",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "raid_soldier4",
        "characterId": "birthday-convoy_raid_soldier4",
        "army": "ENEMY",
        "position": {
          "x": 7,
          "y": 7
        },
        "move": 3,
        "facing": "SOUTH",
        "reserve": true,
        "mobCharacter": {
          "id": "birthday-convoy_raid_soldier4",
          "name": "追捕官兵丁",
          "shortName": "丁",
          "martial": 42,
          "command": 44,
          "intelligence": 30,
          "charisma": 24,
          "portraitKey": "mob_infantry_older_normal_a",
          "alias": "官兵",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "実直",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "raid_soldier5",
        "characterId": "birthday-convoy_raid_soldier5",
        "army": "ENEMY",
        "position": {
          "x": 0,
          "y": 6
        },
        "move": 3,
        "facing": "SOUTH",
        "reserve": true,
        "mobCharacter": {
          "id": "birthday-convoy_raid_soldier5",
          "name": "追捕官兵戊",
          "shortName": "戊",
          "martial": 42,
          "command": 44,
          "intelligence": 30,
          "charisma": 24,
          "portraitKey": "mob_infantry_older_normal_b",
          "alias": "官兵",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "実直",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "raid_archer1",
        "characterId": "birthday-convoy_raid_archer1",
        "army": "ENEMY",
        "position": {
          "x": 7,
          "y": 11
        },
        "move": 3,
        "facing": "NORTH",
        "reserve": true,
        "mobCharacter": {
          "id": "birthday-convoy_raid_archer1",
          "name": "追捕弓兵甲",
          "shortName": "弓",
          "martial": 38,
          "command": 38,
          "intelligence": 32,
          "charisma": 20,
          "portraitKey": "mob_bow_young_normal_a",
          "alias": "官軍弓兵",
          "combatSkills": [
            "弓弩術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "慎重",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "raid_archer2",
        "characterId": "birthday-convoy_raid_archer2",
        "army": "ENEMY",
        "position": {
          "x": 0,
          "y": 11
        },
        "move": 3,
        "facing": "NORTH",
        "reserve": true,
        "mobCharacter": {
          "id": "birthday-convoy_raid_archer2",
          "name": "追捕弓兵乙",
          "shortName": "弓",
          "martial": 38,
          "command": 38,
          "intelligence": 32,
          "charisma": 20,
          "portraitKey": "mob_bow_young_normal_b",
          "alias": "官軍弓兵",
          "combatSkills": [
            "弓弩術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "慎重",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "raid_guard1",
        "characterId": "birthday-convoy_raid_guard1",
        "army": "ENEMY",
        "position": {
          "x": 5,
          "y": 6
        },
        "move": 3,
        "facing": "SOUTH",
        "reserve": true,
        "mobCharacter": {
          "id": "birthday-convoy_raid_guard1",
          "name": "湿地入口守備兵",
          "shortName": "守",
          "martial": 44,
          "command": 48,
          "intelligence": 32,
          "charisma": 26,
          "portraitKey": "mob_infantry_older_normal_a",
          "alias": "守備兵",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "慎重",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "raid_guard2",
        "characterId": "birthday-convoy_raid_guard2",
        "army": "ENEMY",
        "position": {
          "x": 2,
          "y": 7
        },
        "move": 3,
        "facing": "SOUTH",
        "reserve": true,
        "mobCharacter": {
          "id": "birthday-convoy_raid_guard2",
          "name": "北路守備兵",
          "shortName": "守",
          "martial": 44,
          "command": 48,
          "intelligence": 32,
          "charisma": 26,
          "portraitKey": "mob_infantry_older_normal_b",
          "alias": "守備兵",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "慎重",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "raid_adviser",
        "characterId": "birthday-convoy_raid_adviser",
        "army": "ENEMY",
        "position": {
          "x": 4,
          "y": 8
        },
        "move": 3,
        "facing": "SOUTH",
        "reserve": true,
        "mobCharacter": {
          "id": "birthday-convoy_raid_adviser",
          "name": "追捕軍参謀",
          "shortName": "謀",
          "martial": 25,
          "command": 50,
          "intelligence": 90,
          "charisma": 44,
          "portraitKey": "mob_adviser_military_scout",
          "alias": "追捕軍参謀",
          "combatSkills": [
            "なし"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "冷静・策謀的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "raid_water_soldier",
        "characterId": "birthday-convoy_raid_water_soldier",
        "army": "ENEMY",
        "position": {
          "x": 5,
          "y": 3
        },
        "move": 4,
        "facing": "SOUTH",
        "reserve": true,
        "mobCharacter": {
          "id": "birthday-convoy_raid_water_soldier",
          "name": "追捕水兵甲",
          "shortName": "水",
          "martial": 46,
          "command": 48,
          "intelligence": 36,
          "charisma": 28,
          "portraitKey": "mob_infantry_older_normal_b",
          "alias": "追捕水兵",
          "combatSkills": [
            "水中戦"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "冷静・執拗",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "raid_water_soldier2",
        "characterId": "birthday-convoy_raid_water_soldier2",
        "army": "ENEMY",
        "position": {
          "x": 7,
          "y": 2
        },
        "move": 4,
        "facing": "SOUTH",
        "reserve": true,
        "mobCharacter": {
          "id": "birthday-convoy_raid_water_soldier2",
          "name": "追捕水兵乙",
          "shortName": "水",
          "martial": 45,
          "command": 47,
          "intelligence": 35,
          "charisma": 27,
          "portraitKey": "mob_infantry_older_normal_a",
          "alias": "追捕水兵",
          "combatSkills": [
            "水中戦"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "冷静・執拗",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      }
    ],
    "intro": [
      {
        "unitId": "wu_yong",
        "text": "護送車だけを狙っても護送隊は追ってきます。五ターン以内に楊志を含む初期護送部隊を全滅させ、その後、晁蓋殿を北の旗まで退かせましょう。"
      },
      {
        "unitId": "chao_gai",
        "text": "よし！　七星と白勝、護送隊を打ち破って生辰綱を奪い取るぞ！"
      },
      {
        "unitId": "ruan_xiaoer",
        "text": "北は水と湿地だ。俺たち水軍なら動きやすい。退路は任せろ。"
      }
    ],
    "victory": [
      {
        "unitId": "chao_gai",
        "text": "官軍の包囲を抜けた！　生辰綱を持って、このまま逃げ切るぞ！"
      },
      {
        "unitId": "wu_yong",
        "text": "湿地を退路に選んだ甲斐がありました。追手が立て直す前に散りましょう。"
      }
    ]
  },
  {
    "id": "qingfeng-fort",
    "chapterNumber": 4,
    "title": "第四章　清風寨の激突",
    "description": "宋江を北へ逃がしながら、秦明・黄信の大規模追撃軍と前方の青州封鎖部隊を突破する。敵軍を全滅させても勝利となる。",
    "leader": "song_jiang",
    "turnLimit": 15,
    "escape": {
      "destination": {
        "x": 3,
        "y": 0
      },
      "radius": 0,
      "unitIds": [
        "song_jiang"
      ]
    },
    "objectiveText": "勝利：宋江が北の旗へ到達、または敵軍を全滅<br>敗北：宋江が敗走",
    "requiredSurvivors": [],
    "units": [
      {
        "id": "song_jiang",
        "characterId": "song_jiang",
        "army": "PLAYER",
        "position": {
          "x": 1,
          "y": 14
        },
        "move": 3,
        "facing": "NORTH"
      },
      {
        "id": "hua_rong",
        "characterId": "hua_rong",
        "army": "PLAYER",
        "position": {
          "x": 0,
          "y": 12
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "yan_shun",
        "characterId": "yan_shun",
        "army": "PLAYER",
        "position": {
          "x": 2,
          "y": 14
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "wang_ying",
        "characterId": "wang_ying",
        "army": "PLAYER",
        "position": {
          "x": 3,
          "y": 14
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "zheng_tianshou",
        "characterId": "zheng_tianshou",
        "army": "PLAYER",
        "position": {
          "x": 4,
          "y": 14
        },
        "move": 3,
        "facing": "NORTH"
      },
      {
        "id": "qin_ming",
        "characterId": "qin_ming",
        "army": "ENEMY",
        "position": {
          "x": 6,
          "y": 15
        },
        "move": 4,
        "facing": "SOUTH"
      },
      {
        "id": "huang_xin",
        "characterId": "huang_xin",
        "army": "ENEMY",
        "position": {
          "x": 7,
          "y": 14
        },
        "move": 4,
        "facing": "SOUTH"
      },
      {
        "id": "qingzhou1",
        "characterId": "qingfeng-fort_qingzhou1",
        "army": "ENEMY",
        "position": {
          "x": 3,
          "y": 2
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "qingfeng-fort_qingzhou1",
          "name": "青州官兵甲",
          "shortName": "甲",
          "martial": 40,
          "command": 38,
          "intelligence": 24,
          "charisma": 20,
          "portraitKey": "mob_infantry_young_normal_a",
          "alias": "青州官兵",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "実直",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "qingzhou2",
        "characterId": "qingfeng-fort_qingzhou2",
        "army": "ENEMY",
        "position": {
          "x": 5,
          "y": 4
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "qingfeng-fort_qingzhou2",
          "name": "青州弩兵",
          "shortName": "弩",
          "martial": 39,
          "command": 40,
          "intelligence": 30,
          "charisma": 20,
          "portraitKey": "mob_bow_young_normal_a",
          "alias": "青州弩兵",
          "combatSkills": [
            "弓弩術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "実直",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "qingzhou3",
        "characterId": "qingfeng-fort_qingzhou3",
        "army": "ENEMY",
        "position": {
          "x": 1,
          "y": 4
        },
        "move": 4,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "qingfeng-fort_qingzhou3",
          "name": "青州騎兵",
          "shortName": "騎",
          "martial": 48,
          "command": 45,
          "intelligence": 28,
          "charisma": 24,
          "portraitKey": "mob_cavalry_young_normal_a",
          "alias": "青州騎兵",
          "combatSkills": [
            "騎乗戦闘"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "qingzhou5",
        "characterId": "qingfeng-fort_qingzhou5",
        "army": "ENEMY",
        "position": {
          "x": 1,
          "y": 10
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "qingfeng-fort_qingzhou5",
          "name": "青州弩兵乙",
          "shortName": "弩",
          "martial": 40,
          "command": 42,
          "intelligence": 34,
          "charisma": 20,
          "portraitKey": "mob_bow_young_normal_b",
          "alias": "青州弩兵",
          "combatSkills": [
            "弓弩術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "慎重",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "qingzhou6",
        "characterId": "qingfeng-fort_qingzhou6",
        "army": "ENEMY",
        "position": {
          "x": 5,
          "y": 11
        },
        "move": 4,
        "facing": "NORTH",
        "mobCharacter": {
          "id": "qingfeng-fort_qingzhou6",
          "name": "青州騎兵乙",
          "shortName": "騎",
          "martial": 50,
          "command": 48,
          "intelligence": 30,
          "charisma": 24,
          "portraitKey": "mob_cavalry_young_normal_b",
          "alias": "青州騎兵",
          "combatSkills": [
            "騎乗戦闘"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      }
    ],
    "intro": [
      {
        "unitId": "song_jiang",
        "text": "秦明・黄信の軍勢が迫っている。ここは戦いながら北へ抜けよう。"
      },
      {
        "unitId": "hua_rong",
        "text": "兄上は旗を目指してください。追手は私たちが食い止めます。"
      }
    ],
    "victory": [
      {
        "unitId": "song_jiang",
        "text": "皆のおかげで包囲を抜けられた。秦明殿、どうか話を聞いてほしい。"
      },
      {
        "unitId": "qin_ming",
        "text": "……この宋江、ただの賊ではないようだな。"
      }
    ]
  },
  {
    "id": "jiangzhou-execution-ground",
    "chapterNumber": 5,
    "title": "第五章　江州法場の救出",
    "description": "宋江・戴宗・李逵は右下奥の騎兵・参謀を含む江州官軍をかわし、第2ターンに現れる晁蓋救援隊と、右側湿地を進む李俊ら水軍衆の援護を受けて船着き場を目指す。敵軍を全滅させても勝利となる。",
    "leader": "song_jiang_jiangzhou",
    "turnLimit": 15,
    "escape": {
      "destination": {
        "x": 3,
        "y": 0
      },
      "radius": 1,
      "unitIds": [
        "song_jiang_jiangzhou",
        "chao_gai_jiangzhou"
      ]
    },
    "objectiveText": "勝利：宋江と晁蓋が北の旗周辺へ到達、または敵軍を全滅<br>敗北：宋江または晁蓋が敗走",
    "requiredSurvivors": [],
    "rescue": {
      "turn": 2,
      "arrival": [
        {
          "unitId": "chao_gai_jiangzhou",
          "text": "宋江兄弟、待たせた！　晁蓋、救援に参った！　左手から包囲を崩すぞ！",
          "actionLabel": "味方救援"
        },
        {
          "unitId": "huang_wenbing",
          "text": "やはり賊徒どもが現れたか！　左手の包囲を崩されるな。弩兵は救援隊を狙い撃て！",
          "actionLabel": "敵軍警戒"
        },
        {
          "unitId": "cai_jiu",
          "text": "江州の官威を侮るな！　全軍、宋江を逃がすでない！"
        },
        {
          "unitId": "song_jiang_jiangzhou",
          "text": "晁蓋兄長！　来てくださったか！　これで活路を開ける！"
        },
        {
          "unitId": "hua_rong_jiangzhou",
          "text": "兄上、騎兵に構いすぎてはいけません。私たちが左側を崩します。歩兵の包囲が狭まる前に北へ！"
        },
        {
          "unitId": "li_kui",
          "text": "晁蓋の兄貴！　よく来た！　これで官兵どもをまとめて蹴散らせるぞ！"
        }
      ]
    },
    "units": [
      {
        "id": "song_jiang_jiangzhou",
        "characterId": "song_jiang",
        "army": "PLAYER",
        "position": {
          "x": 3,
          "y": 15
        },
        "move": 3,
        "facing": "NORTH"
      },
      {
        "id": "dai_zong",
        "characterId": "dai_zong",
        "army": "PLAYER",
        "position": {
          "x": 4,
          "y": 15
        },
        "move": 6,
        "facing": "NORTH"
      },
      {
        "id": "li_kui",
        "characterId": "li_kui",
        "army": "PLAYER",
        "position": {
          "x": 3,
          "y": 14
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "li_jun_jiangzhou",
        "characterId": "li_jun",
        "army": "PLAYER",
        "position": {
          "x": 0,
          "y": 1
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "zhang_heng_jiangzhou",
        "characterId": "zhang_heng",
        "army": "PLAYER",
        "position": {
          "x": 1,
          "y": 1
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "zhang_shun_jiangzhou",
        "characterId": "zhang_shun",
        "army": "PLAYER",
        "position": {
          "x": 2,
          "y": 1
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "tong_wei_jiangzhou",
        "characterId": "tong_wei",
        "army": "PLAYER",
        "position": {
          "x": 5,
          "y": 1
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "tong_meng_jiangzhou",
        "characterId": "tong_meng",
        "army": "PLAYER",
        "position": {
          "x": 6,
          "y": 1
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "jiangzhou_cavalry1",
        "characterId": "jiangzhou-execution-ground_jiangzhou_cavalry1",
        "army": "ENEMY",
        "position": {
          "x": 0,
          "y": 15
        },
        "move": 4,
        "facing": "NORTH",
        "mobCharacter": {
          "id": "jiangzhou-execution-ground_jiangzhou_cavalry1",
          "name": "江州騎兵甲",
          "shortName": "騎",
          "martial": 48,
          "command": 46,
          "intelligence": 28,
          "charisma": 24,
          "portraitKey": "mob_cavalry_young_normal_b",
          "alias": "江州騎兵",
          "combatSkills": [
            "騎乗戦闘"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "jiangzhou_cavalry2",
        "characterId": "jiangzhou-execution-ground_jiangzhou_cavalry2",
        "army": "ENEMY",
        "position": {
          "x": 7,
          "y": 15
        },
        "move": 4,
        "facing": "NORTH",
        "mobCharacter": {
          "id": "jiangzhou-execution-ground_jiangzhou_cavalry2",
          "name": "江州騎兵乙",
          "shortName": "騎",
          "martial": 48,
          "command": 46,
          "intelligence": 28,
          "charisma": 24,
          "portraitKey": "mob_cavalry_young_normal_b",
          "alias": "江州騎兵",
          "combatSkills": [
            "騎乗戦闘"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "jiangzhou_cavalry3",
        "characterId": "jiangzhou-execution-ground_jiangzhou_cavalry3",
        "army": "ENEMY",
        "position": {
          "x": 7,
          "y": 14
        },
        "move": 4,
        "facing": "NORTH",
        "mobCharacter": {
          "id": "jiangzhou-execution-ground_jiangzhou_cavalry3",
          "name": "江州騎兵丙",
          "shortName": "騎",
          "martial": 48,
          "command": 46,
          "intelligence": 28,
          "charisma": 24,
          "portraitKey": "mob_cavalry_older_normal_a",
          "alias": "江州騎兵",
          "combatSkills": [
            "騎乗戦闘"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "jiangzhou_cavalry4",
        "characterId": "jiangzhou-execution-ground_jiangzhou_cavalry4",
        "army": "ENEMY",
        "position": {
          "x": 5,
          "y": 15
        },
        "move": 4,
        "facing": "NORTH",
        "mobCharacter": {
          "id": "jiangzhou-execution-ground_jiangzhou_cavalry4",
          "name": "江州騎兵丁",
          "shortName": "騎",
          "martial": 50,
          "command": 48,
          "intelligence": 30,
          "charisma": 24,
          "portraitKey": "mob_cavalry_older_normal_a",
          "alias": "江州騎兵",
          "combatSkills": [
            "騎乗戦闘"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "jiangzhou_cavalry5",
        "characterId": "jiangzhou-execution-ground_jiangzhou_cavalry5",
        "army": "ENEMY",
        "position": {
          "x": 5,
          "y": 9
        },
        "move": 4,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "jiangzhou-execution-ground_jiangzhou_cavalry5",
          "name": "江州騎兵戊",
          "shortName": "騎",
          "martial": 50,
          "command": 48,
          "intelligence": 30,
          "charisma": 24,
          "portraitKey": "mob_cavalry_older_normal_b",
          "alias": "江州騎兵",
          "combatSkills": [
            "騎乗戦闘"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "jiangzhou_adviser2",
        "characterId": "jiangzhou-execution-ground_jiangzhou_adviser2",
        "army": "ENEMY",
        "position": {
          "x": 6,
          "y": 14
        },
        "move": 3,
        "facing": "NORTH",
        "mobCharacter": {
          "id": "jiangzhou-execution-ground_jiangzhou_adviser2",
          "name": "江州軍参謀乙",
          "shortName": "謀",
          "martial": 24,
          "command": 50,
          "intelligence": 90,
          "charisma": 44,
          "portraitKey": "mob_adviser_military_scout",
          "alias": "江州軍参謀",
          "combatSkills": [
            "なし"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "冷静・策謀的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "jiangzhou_soldier2",
        "characterId": "jiangzhou-execution-ground_jiangzhou_soldier2",
        "army": "ENEMY",
        "position": {
          "x": 6,
          "y": 15
        },
        "move": 3,
        "facing": "NORTH",
        "mobCharacter": {
          "id": "jiangzhou-execution-ground_jiangzhou_soldier2",
          "name": "江州官兵甲一隊",
          "shortName": "甲",
          "martial": 42,
          "command": 44,
          "intelligence": 28,
          "charisma": 24,
          "portraitKey": "mob_infantry_young_normal_b",
          "alias": "江州官兵",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "実直",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "jiangzhou_soldier4",
        "characterId": "jiangzhou-execution-ground_jiangzhou_soldier4",
        "army": "ENEMY",
        "position": {
          "x": 5,
          "y": 14
        },
        "move": 3,
        "facing": "NORTH",
        "mobCharacter": {
          "id": "jiangzhou-execution-ground_jiangzhou_soldier4",
          "name": "江州官兵丁",
          "shortName": "丁",
          "martial": 40,
          "command": 42,
          "intelligence": 25,
          "charisma": 22,
          "portraitKey": "mob_infantry_older_normal_a",
          "alias": "江州官兵",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "実直",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "jiangzhou_soldier5",
        "characterId": "jiangzhou-execution-ground_jiangzhou_soldier5",
        "army": "ENEMY",
        "position": {
          "x": 5,
          "y": 11
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "jiangzhou-execution-ground_jiangzhou_soldier5",
          "name": "江州官兵甲二隊",
          "shortName": "甲",
          "martial": 42,
          "command": 44,
          "intelligence": 28,
          "charisma": 24,
          "portraitKey": "mob_infantry_young_normal_a",
          "alias": "江州官兵",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "実直",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "jiangzhou_soldier6",
        "characterId": "jiangzhou-execution-ground_jiangzhou_soldier6",
        "army": "ENEMY",
        "position": {
          "x": 5,
          "y": 13
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "jiangzhou-execution-ground_jiangzhou_soldier6",
          "name": "江州官兵甲三隊",
          "shortName": "甲",
          "martial": 42,
          "command": 44,
          "intelligence": 28,
          "charisma": 24,
          "portraitKey": "mob_infantry_young_normal_b",
          "alias": "江州官兵",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "実直",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "jiangzhou_water_soldier1",
        "characterId": "jiangzhou-execution-ground_jiangzhou_water_soldier1",
        "army": "ENEMY",
        "position": {
          "x": 6,
          "y": 9
        },
        "move": 4,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "jiangzhou-execution-ground_jiangzhou_water_soldier1",
          "name": "江州水兵",
          "shortName": "水",
          "martial": 46,
          "command": 48,
          "intelligence": 36,
          "charisma": 28,
          "portraitKey": "mob_infantry_older_normal_b",
          "alias": "江州水兵",
          "combatSkills": [
            "水中戦"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "冷静・執拗",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "jiangzhou_archer2",
        "characterId": "jiangzhou-execution-ground_jiangzhou_archer2",
        "army": "ENEMY",
        "position": {
          "x": 7,
          "y": 10
        },
        "move": 3,
        "facing": "NORTH",
        "mobCharacter": {
          "id": "jiangzhou-execution-ground_jiangzhou_archer2",
          "name": "江州弩兵乙",
          "shortName": "弩",
          "martial": 38,
          "command": 40,
          "intelligence": 32,
          "charisma": 20,
          "portraitKey": "mob_bow_older_normal_a",
          "alias": "江州弩兵",
          "combatSkills": [
            "弓弩術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "慎重",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "cai_jiu",
        "characterId": "cai_jiuzhifu",
        "army": "ENEMY",
        "position": {
          "x": 7,
          "y": 13
        },
        "move": 2,
        "facing": "NORTH"
      },
      {
        "id": "jiangzhou_soldier3",
        "characterId": "jiangzhou-execution-ground_jiangzhou_soldier3",
        "army": "ENEMY",
        "position": {
          "x": 6,
          "y": 13
        },
        "move": 3,
        "facing": "NORTH",
        "mobCharacter": {
          "id": "jiangzhou-execution-ground_jiangzhou_soldier3",
          "name": "江州官兵甲四隊",
          "shortName": "甲",
          "martial": 42,
          "command": 44,
          "intelligence": 28,
          "charisma": 24,
          "portraitKey": "mob_infantry_older_normal_a",
          "alias": "江州官兵",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "実直",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "jiangzhou_captain1",
        "characterId": "jiangzhou-execution-ground_jiangzhou_captain1",
        "army": "ENEMY",
        "position": {
          "x": 5,
          "y": 10
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "jiangzhou-execution-ground_jiangzhou_captain1",
          "name": "江州隊長甲一隊",
          "shortName": "将",
          "martial": 52,
          "command": 55,
          "intelligence": 36,
          "charisma": 30,
          "portraitKey": "mob_captain_standard_young",
          "alias": "江州隊長",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "威圧的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "jiangzhou_captain2",
        "characterId": "jiangzhou-execution-ground_jiangzhou_captain2",
        "army": "ENEMY",
        "position": {
          "x": 5,
          "y": 12
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "jiangzhou-execution-ground_jiangzhou_captain2",
          "name": "江州隊長甲二隊",
          "shortName": "将",
          "martial": 52,
          "command": 55,
          "intelligence": 36,
          "charisma": 30,
          "portraitKey": "mob_captain_standard_middle",
          "alias": "江州隊長",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "威圧的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "jiangzhou_elite_cavalry1",
        "characterId": "jiangzhou-execution-ground_jiangzhou_elite_cavalry1",
        "army": "ENEMY",
        "position": {
          "x": 6,
          "y": 12
        },
        "move": 4,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "jiangzhou-execution-ground_jiangzhou_elite_cavalry1",
          "name": "江州精鋭騎兵甲",
          "shortName": "精",
          "martial": 64,
          "command": 62,
          "intelligence": 38,
          "charisma": 32,
          "portraitKey": "mob_cavalry_young_strong",
          "alias": "江州精鋭騎兵",
          "combatSkills": [
            "騎乗戦闘"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "jiangzhou_elite_cavalry2",
        "characterId": "jiangzhou-execution-ground_jiangzhou_elite_cavalry2",
        "army": "ENEMY",
        "position": {
          "x": 7,
          "y": 12
        },
        "move": 4,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "jiangzhou-execution-ground_jiangzhou_elite_cavalry2",
          "name": "江州精鋭騎兵乙",
          "shortName": "精",
          "martial": 63,
          "command": 61,
          "intelligence": 37,
          "charisma": 31,
          "portraitKey": "mob_cavalry_older_strong",
          "alias": "江州精鋭騎兵",
          "combatSkills": [
            "騎乗戦闘"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "jiangzhou_spear1",
        "characterId": "jiangzhou-execution-ground_jiangzhou_spear1",
        "army": "ENEMY",
        "position": {
          "x": 4,
          "y": 9
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "jiangzhou-execution-ground_jiangzhou_spear1",
          "name": "江州槍兵甲",
          "shortName": "槍",
          "martial": 43,
          "command": 46,
          "intelligence": 28,
          "charisma": 24,
          "portraitKey": "mob_infantry_young_normal_a",
          "alias": "江州槍兵",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "実直",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "jiangzhou_spear2",
        "characterId": "jiangzhou-execution-ground_jiangzhou_spear2",
        "army": "ENEMY",
        "position": {
          "x": 7,
          "y": 9
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "jiangzhou-execution-ground_jiangzhou_spear2",
          "name": "江州槍兵乙",
          "shortName": "槍",
          "martial": 43,
          "command": 46,
          "intelligence": 28,
          "charisma": 24,
          "portraitKey": "mob_infantry_young_normal_b",
          "alias": "江州槍兵",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "実直",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "jiangzhou_spear3",
        "characterId": "jiangzhou-execution-ground_jiangzhou_spear3",
        "army": "ENEMY",
        "position": {
          "x": 7,
          "y": 11
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "jiangzhou-execution-ground_jiangzhou_spear3",
          "name": "江州槍兵丙",
          "shortName": "槍",
          "martial": 42,
          "command": 45,
          "intelligence": 27,
          "charisma": 23,
          "portraitKey": "mob_infantry_older_normal_a",
          "alias": "江州槍兵",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "実直",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "jiangzhou_spear4",
        "characterId": "jiangzhou-execution-ground_jiangzhou_spear4",
        "army": "ENEMY",
        "position": {
          "x": 6,
          "y": 11
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "jiangzhou-execution-ground_jiangzhou_spear4",
          "name": "江州槍兵丁",
          "shortName": "槍",
          "martial": 42,
          "command": 45,
          "intelligence": 27,
          "charisma": 23,
          "portraitKey": "mob_infantry_older_normal_b",
          "alias": "江州槍兵",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "実直",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "jiangzhou_archer3",
        "characterId": "jiangzhou-execution-ground_jiangzhou_archer3",
        "army": "ENEMY",
        "position": {
          "x": 6,
          "y": 10
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "jiangzhou-execution-ground_jiangzhou_archer3",
          "name": "江州弩兵戊",
          "shortName": "弩",
          "martial": 39,
          "command": 42,
          "intelligence": 34,
          "charisma": 22,
          "portraitKey": "mob_bow_older_normal_b",
          "alias": "江州弩兵",
          "combatSkills": [
            "弓弩術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "慎重",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "jiangzhou_archer4",
        "characterId": "jiangzhou-execution-ground_jiangzhou_archer4",
        "army": "ENEMY",
        "position": {
          "x": 4,
          "y": 10
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "jiangzhou-execution-ground_jiangzhou_archer4",
          "name": "江州弩兵己",
          "shortName": "弩",
          "martial": 39,
          "command": 42,
          "intelligence": 34,
          "charisma": 22,
          "portraitKey": "mob_bow_older_normal_a",
          "alias": "江州弩兵",
          "combatSkills": [
            "弓弩術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "慎重",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "huang_wenbing",
        "characterId": "huang_wenbing",
        "army": "ENEMY",
        "position": {
          "x": 4,
          "y": 11
        },
        "move": 3,
        "facing": "SOUTH"
      },
      {
        "id": "jiangzhou_archer5",
        "characterId": "jiangzhou-execution-ground_jiangzhou_archer5",
        "army": "ENEMY",
        "position": {
          "x": 4,
          "y": 7
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "jiangzhou-execution-ground_jiangzhou_archer5",
          "name": "江州弩兵庚",
          "shortName": "弩",
          "martial": 39,
          "command": 42,
          "intelligence": 34,
          "charisma": 22,
          "portraitKey": "mob_bow_young_normal_a",
          "alias": "江州弩兵",
          "combatSkills": [
            "弓弩術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "慎重",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "jiangzhou_archer6",
        "characterId": "jiangzhou-execution-ground_jiangzhou_archer6",
        "army": "ENEMY",
        "position": {
          "x": 4,
          "y": 8
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "jiangzhou-execution-ground_jiangzhou_archer6",
          "name": "江州弩兵辛",
          "shortName": "弩",
          "martial": 39,
          "command": 42,
          "intelligence": 34,
          "charisma": 22,
          "portraitKey": "mob_bow_young_normal_b",
          "alias": "江州弩兵",
          "combatSkills": [
            "弓弩術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "慎重",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "jiangzhou_mid_archer1",
        "characterId": "jiangzhou-execution-ground_jiangzhou_mid_archer1",
        "army": "ENEMY",
        "position": {
          "x": 5,
          "y": 8
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "jiangzhou-execution-ground_jiangzhou_mid_archer1",
          "name": "江州弩兵丙",
          "shortName": "弩",
          "martial": 39,
          "command": 42,
          "intelligence": 34,
          "charisma": 22,
          "portraitKey": "mob_bow_older_normal_a",
          "alias": "江州弩兵",
          "combatSkills": [
            "弓弩術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "慎重",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "jiangzhou_mid_archer2",
        "characterId": "jiangzhou-execution-ground_jiangzhou_mid_archer2",
        "army": "ENEMY",
        "position": {
          "x": 7,
          "y": 7
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "jiangzhou-execution-ground_jiangzhou_mid_archer2",
          "name": "江州弩兵丁",
          "shortName": "弩",
          "martial": 39,
          "command": 42,
          "intelligence": 34,
          "charisma": 22,
          "portraitKey": "mob_bow_older_normal_b",
          "alias": "江州弩兵",
          "combatSkills": [
            "弓弩術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "慎重",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "jiangzhou_adviser",
        "characterId": "jiangzhou-execution-ground_jiangzhou_adviser",
        "army": "ENEMY",
        "position": {
          "x": 6,
          "y": 8
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "jiangzhou-execution-ground_jiangzhou_adviser",
          "name": "江州軍参謀",
          "shortName": "謀",
          "martial": 24,
          "command": 50,
          "intelligence": 90,
          "charisma": 44,
          "portraitKey": "mob_adviser_military_formation",
          "alias": "江州軍参謀",
          "combatSkills": [
            "なし"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "冷静・策謀的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "executioner",
        "characterId": "jiangzhou-execution-ground_executioner",
        "army": "ENEMY",
        "position": {
          "x": 4,
          "y": 6
        },
        "move": 2,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "jiangzhou-execution-ground_executioner",
          "name": "刑場執行官",
          "shortName": "刑",
          "martial": 78,
          "command": 67,
          "intelligence": 54,
          "charisma": 25,
          "portraitKey": "mob_executioner",
          "alias": "刑場執行官",
          "combatSkills": [
            "刀術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "冷酷",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "jiangzhou_guard1",
        "characterId": "jiangzhou-execution-ground_jiangzhou_guard1",
        "army": "ENEMY",
        "position": {
          "x": 6,
          "y": 5
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "jiangzhou-execution-ground_jiangzhou_guard1",
          "name": "北路守備兵甲",
          "shortName": "守",
          "martial": 45,
          "command": 50,
          "intelligence": 30,
          "charisma": 26,
          "portraitKey": "mob_infantry_older_normal_b",
          "alias": "江州守備兵",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "慎重",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "jiangzhou_guard2",
        "characterId": "jiangzhou-execution-ground_jiangzhou_guard2",
        "army": "ENEMY",
        "position": {
          "x": 7,
          "y": 5
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "jiangzhou-execution-ground_jiangzhou_guard2",
          "name": "北路守備兵乙",
          "shortName": "守",
          "martial": 45,
          "command": 50,
          "intelligence": 30,
          "charisma": 26,
          "portraitKey": "mob_infantry_older_normal_b",
          "alias": "江州守備兵",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "慎重",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "jiangzhou_guard3",
        "characterId": "jiangzhou-execution-ground_jiangzhou_guard3",
        "army": "ENEMY",
        "position": {
          "x": 5,
          "y": 7
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "jiangzhou-execution-ground_jiangzhou_guard3",
          "name": "右路守備兵",
          "shortName": "守",
          "martial": 45,
          "command": 50,
          "intelligence": 30,
          "charisma": 26,
          "portraitKey": "mob_infantry_older_normal_a",
          "alias": "江州守備兵",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "慎重",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "chao_gai_jiangzhou",
        "characterId": "chao_gai",
        "army": "PLAYER",
        "position": {
          "x": 0,
          "y": 9
        },
        "move": 4,
        "facing": "NORTH",
        "reserve": true
      },
      {
        "id": "hua_rong_jiangzhou",
        "characterId": "hua_rong",
        "army": "PLAYER",
        "position": {
          "x": 0,
          "y": 8
        },
        "move": 4,
        "facing": "NORTH",
        "reserve": true
      },
      {
        "id": "huang_xin_jiangzhou",
        "characterId": "huang_xin",
        "army": "PLAYER",
        "position": {
          "x": 1,
          "y": 9
        },
        "move": 4,
        "facing": "NORTH",
        "reserve": true
      },
      {
        "id": "yan_shun_jiangzhou",
        "characterId": "yan_shun",
        "army": "PLAYER",
        "position": {
          "x": 0,
          "y": 10
        },
        "move": 4,
        "facing": "NORTH",
        "reserve": true
      },
      {
        "id": "wang_ying_jiangzhou",
        "characterId": "wang_ying",
        "army": "PLAYER",
        "position": {
          "x": 1,
          "y": 10
        },
        "move": 4,
        "facing": "NORTH",
        "reserve": true
      },
      {
        "id": "zheng_tianshou_jiangzhou",
        "characterId": "zheng_tianshou",
        "army": "PLAYER",
        "position": {
          "x": 1,
          "y": 8
        },
        "move": 3,
        "facing": "NORTH",
        "reserve": true
      },
      {
        "id": "liu_tang_jiangzhou",
        "characterId": "liu_tang",
        "army": "PLAYER",
        "position": {
          "x": 2,
          "y": 9
        },
        "move": 4,
        "facing": "NORTH",
        "reserve": true
      }
    ],
    "intro": [
      {
        "unitId": "cai_jiu",
        "text": "罪人宋江、戴宗の処刑を執行せよ。法場を固め、一人たりとも近づけるな！"
      },
      {
        "unitId": "huang_wenbing",
        "text": "知府様、宋江の仲間どもが救出を企てているやもしれません。北の船着き場まで兵を配し、退路を断つべきでしょう。"
      },
      {
        "unitId": "executioner",
        "text": "罪人宋江、戴宗！　法場の刻限だ！　官兵ども、脱走を許すな！"
      },
      {
        "unitId": "li_kui",
        "text": "兄貴に指一本触れてみろ！　黒旋風が官兵どもをまとめてぶった斬るぞ！"
      },
      {
        "unitId": "song_jiang_jiangzhou",
        "text": "戴宗殿、李逵、まずは包囲を抜けよう。騎兵だけに足を止められず、北の船着き場へ急ぐのだ。"
      },
      {
        "unitId": "li_jun_jiangzhou",
        "text": "船は用意してある！　俺たち水軍衆も水路から打って出る。湿地と川を使って官兵の横腹を突くぞ！"
      }
    ],
    "victory": [
      {
        "unitId": "li_jun_jiangzhou",
        "text": "よし、二人とも来たな！　全員、船へ乗れ！　江州を離れるぞ！"
      },
      {
        "unitId": "song_jiang_jiangzhou",
        "text": "皆が命を懸けて救ってくれた。この恩、宋江は決して忘れぬ。"
      },
      {
        "unitId": "chao_gai_jiangzhou",
        "text": "話は船の上だ。今は一刻も早くここを離れるぞ！"
      }
    ]
  },
  {
    "id": "zhu-family-manor",
    "chapterNumber": 6,
    "title": "第六章　三打祝家荘・総力戦",
    "description": "梁山泊軍は呉用の策のもと総力を挙げ、祝朝奉が率いる大軍と欒廷玉・祝家三兄弟の防衛線へ挑む。登州の孫立らは祝家荘への援軍を装い、左上寄りの中段で戦況を見守っている。",
    "leader": "song_jiang_zhujia",
    "turnLimit": 20,
    "escape": null,
    "objectiveText": "勝利：祝家荘軍を全滅<br>敗北：宋江が敗走",
    "requiredSurvivors": [],
    "betrayal": {
      "turn": 4,
      "unitIds": [
        "sun_li_zhujia",
        "sun_xin_zhujia",
        "gu_dasao_zhujia",
        "yue_he_zhujia",
        "xie_zhen_zhujia",
        "xie_bao_zhujia",
        "zou_yuan_zhujia",
        "zou_run_zhujia"
      ],
      "arrival": [
        {
          "unitId": "wu_yong_zhujia",
          "text": "今です、孫提轄！　内より祝家荘の陣を崩してください！"
        },
        {
          "unitId": "sun_li_zhujia",
          "text": "承知した！　登州の者ども、これより梁山泊軍に加勢する。祝家荘の大軍を内側から崩すぞ！"
        },
        {
          "unitId": "zhu_chaofeng",
          "text": "な、何だと！　孫立め、最初から梁山泊と通じておったのか！　各隊、陣を立て直せ！"
        }
      ],
      "trapZones": [
        {
          "label": "中盤前方",
          "count": 1,
          "candidates": [
            [
              4,
              7
            ],
            [
              5,
              7
            ],
            [
              7,
              7
            ]
          ]
        },
        {
          "label": "中盤中央",
          "count": 2,
          "candidates": [
            [
              2,
              10
            ],
            [
              5,
              10
            ],
            [
              0,
              11
            ],
            [
              7,
              11
            ]
          ]
        },
        {
          "label": "中盤後方",
          "count": 1,
          "candidates": [
            [
              1,
              14
            ],
            [
              3,
              14
            ],
            [
              4,
              14
            ],
            [
              6,
              14
            ]
          ]
        }
      ]
    },
    "units": [
      {
        "id": "shi_xiu_zhujia",
        "characterId": "shi_xiu",
        "army": "PLAYER",
        "position": {
          "x": 0,
          "y": 19
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "lin_chong_zhujia",
        "characterId": "lin_chong",
        "army": "PLAYER",
        "position": {
          "x": 1,
          "y": 19
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "song_jiang_zhujia",
        "characterId": "song_jiang",
        "army": "PLAYER",
        "position": {
          "x": 2,
          "y": 19
        },
        "move": 3,
        "facing": "NORTH"
      },
      {
        "id": "wu_yong_zhujia",
        "characterId": "wu_yong",
        "army": "PLAYER",
        "position": {
          "x": 3,
          "y": 19
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "ma_lin_zhujia",
        "characterId": "ma_lin",
        "army": "PLAYER",
        "position": {
          "x": 4,
          "y": 19
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "li_kui_zhujia",
        "characterId": "li_kui",
        "army": "PLAYER",
        "position": {
          "x": 5,
          "y": 19
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "qin_ming_zhujia",
        "characterId": "qin_ming",
        "army": "PLAYER",
        "position": {
          "x": 6,
          "y": 19
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "yang_xiong_zhujia",
        "characterId": "yang_xiong",
        "army": "PLAYER",
        "position": {
          "x": 6,
          "y": 17
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "hua_rong_zhujia",
        "characterId": "hua_rong",
        "army": "PLAYER",
        "position": {
          "x": 1,
          "y": 18
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "yang_lin_zhujia",
        "characterId": "yang_lin",
        "army": "PLAYER",
        "position": {
          "x": 2,
          "y": 18
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "wang_ying_zhujia",
        "characterId": "wang_ying",
        "army": "PLAYER",
        "position": {
          "x": 3,
          "y": 18
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "ou_peng_zhujia",
        "characterId": "ou_peng",
        "army": "PLAYER",
        "position": {
          "x": 4,
          "y": 18
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "deng_fei_zhujia",
        "characterId": "deng_fei",
        "army": "PLAYER",
        "position": {
          "x": 5,
          "y": 18
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "li_jun_zhujia",
        "characterId": "li_jun",
        "army": "PLAYER",
        "position": {
          "x": 0,
          "y": 18
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "dai_zong_zhujia",
        "characterId": "dai_zong",
        "army": "PLAYER",
        "position": {
          "x": 6,
          "y": 18
        },
        "move": 6,
        "facing": "NORTH"
      },
      {
        "id": "zhang_shun_zhujia",
        "characterId": "zhang_shun",
        "army": "PLAYER",
        "position": {
          "x": 7,
          "y": 18
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "mu_hong_zhujia",
        "characterId": "mu_hong",
        "army": "PLAYER",
        "position": {
          "x": 0,
          "y": 17
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "huang_xin_zhujia",
        "characterId": "huang_xin",
        "army": "PLAYER",
        "position": {
          "x": 2,
          "y": 17
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "zhang_heng_zhujia",
        "characterId": "zhang_heng",
        "army": "PLAYER",
        "position": {
          "x": 4,
          "y": 17
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "bai_sheng_zhujia",
        "characterId": "bai_sheng",
        "army": "PLAYER",
        "position": {
          "x": 7,
          "y": 19
        },
        "move": 3,
        "facing": "NORTH"
      },
      {
        "id": "zhu_chaofeng",
        "characterId": "zhu_chaofeng",
        "army": "ENEMY",
        "position": {
          "x": 3,
          "y": 0
        },
        "move": 3,
        "facing": "SOUTH"
      },
      {
        "id": "luan_tingyu",
        "characterId": "luan_tingyu",
        "army": "ENEMY",
        "position": {
          "x": 4,
          "y": 1
        },
        "move": 4,
        "facing": "SOUTH"
      },
      {
        "id": "zhu_long",
        "characterId": "zhu_long",
        "army": "ENEMY",
        "position": {
          "x": 2,
          "y": 1
        },
        "move": 4,
        "facing": "SOUTH"
      },
      {
        "id": "zhu_hu",
        "characterId": "zhu_hu",
        "army": "ENEMY",
        "position": {
          "x": 5,
          "y": 1
        },
        "move": 4,
        "facing": "SOUTH"
      },
      {
        "id": "zhu_biao",
        "characterId": "zhu_biao",
        "army": "ENEMY",
        "position": {
          "x": 6,
          "y": 2
        },
        "move": 4,
        "facing": "SOUTH"
      },
      {
        "id": "hu_sanniang",
        "characterId": "hu_sanniang",
        "army": "ENEMY",
        "position": {
          "x": 1,
          "y": 2
        },
        "move": 4,
        "facing": "SOUTH"
      },
      {
        "id": "hu_female_cavalry",
        "characterId": "zhu-family-manor_hu_female_cavalry",
        "army": "ENEMY",
        "position": {
          "x": 1,
          "y": 3
        },
        "move": 4,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "zhu-family-manor_hu_female_cavalry",
          "name": "扈家荘女騎馬隊甲",
          "shortName": "女",
          "martial": 62,
          "command": 58,
          "intelligence": 45,
          "charisma": 52,
          "portraitKey": "mob_female_cavalry",
          "alias": "扈家荘女騎馬隊",
          "combatSkills": [
            "騎乗戦闘"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "寡黙・勇猛",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "hu_female_cavalry_a3",
        "characterId": "zhu-family-manor_hu_female_cavalry_a3",
        "army": "ENEMY",
        "position": {
          "x": 0,
          "y": 2
        },
        "move": 4,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "zhu-family-manor_hu_female_cavalry_a3",
          "name": "扈家荘女騎馬隊乙",
          "shortName": "女",
          "martial": 62,
          "command": 58,
          "intelligence": 45,
          "charisma": 52,
          "portraitKey": "mob_female_cavalry",
          "alias": "扈家荘女騎馬隊",
          "combatSkills": [
            "騎乗戦闘"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "寡黙・勇猛",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "hu_female_cavalry_b2",
        "characterId": "zhu-family-manor_hu_female_cavalry_b2",
        "army": "ENEMY",
        "position": {
          "x": 1,
          "y": 1
        },
        "move": 4,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "zhu-family-manor_hu_female_cavalry_b2",
          "name": "扈家荘女騎馬隊丙",
          "shortName": "女",
          "martial": 62,
          "command": 58,
          "intelligence": 45,
          "charisma": 52,
          "portraitKey": "mob_female_cavalry",
          "alias": "扈家荘女騎馬隊",
          "combatSkills": [
            "騎乗戦闘"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "寡黙・勇猛",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "hu_female_adviser",
        "characterId": "zhu-family-manor_hu_female_adviser",
        "army": "ENEMY",
        "position": {
          "x": 0,
          "y": 4
        },
        "move": 3,
        "facing": "SOUTH",
        "overrides": {
          "maxHp": 190
        },
        "mobCharacter": {
          "id": "zhu-family-manor_hu_female_adviser",
          "name": "扈家荘女軍師",
          "shortName": "謀",
          "martial": 24,
          "command": 52,
          "intelligence": 87,
          "charisma": 48,
          "portraitKey": "mob_female_cavalry",
          "alias": "扈家荘女軍師",
          "combatSkills": [
            "なし"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "冷静・機敏",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "manor1",
        "characterId": "zhu-family-manor_manor1",
        "army": "ENEMY",
        "position": {
          "x": 2,
          "y": 3
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "zhu-family-manor_manor1",
          "name": "祝家荘兵甲",
          "shortName": "甲",
          "martial": 46,
          "command": 45,
          "intelligence": 30,
          "charisma": 22,
          "portraitKey": "zhujia_infantry_young_strong",
          "alias": "祝家荘兵",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "実直",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "manor2",
        "characterId": "zhu-family-manor_manor2",
        "army": "ENEMY",
        "position": {
          "x": 5,
          "y": 3
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "zhu-family-manor_manor2",
          "name": "祝家荘兵乙",
          "shortName": "乙",
          "martial": 46,
          "command": 45,
          "intelligence": 30,
          "charisma": 22,
          "portraitKey": "zhujia_infantry_older_strong",
          "alias": "祝家荘兵",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "実直",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "manor3",
        "characterId": "zhu-family-manor_manor3",
        "army": "ENEMY",
        "position": {
          "x": 2,
          "y": 4
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "zhu-family-manor_manor3",
          "name": "祝家荘兵丙",
          "shortName": "丙",
          "martial": 46,
          "command": 45,
          "intelligence": 30,
          "charisma": 22,
          "portraitKey": "zhujia_infantry_young_strong",
          "alias": "祝家荘兵",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "実直",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "manor4",
        "characterId": "zhu-family-manor_manor4",
        "army": "ENEMY",
        "position": {
          "x": 7,
          "y": 4
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "zhu-family-manor_manor4",
          "name": "祝家荘兵丁",
          "shortName": "丁",
          "martial": 46,
          "command": 45,
          "intelligence": 30,
          "charisma": 22,
          "portraitKey": "zhujia_infantry_older_strong",
          "alias": "祝家荘兵",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "実直",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zhujia_front_cavalry_left",
        "characterId": "zhu-family-manor_zhujia_front_cavalry_left",
        "army": "ENEMY",
        "position": {
          "x": 1,
          "y": 11
        },
        "move": 4,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "zhu-family-manor_zhujia_front_cavalry_left",
          "name": "祝家荘前衛騎馬隊甲",
          "shortName": "騎",
          "martial": 56,
          "command": 55,
          "intelligence": 34,
          "charisma": 30,
          "portraitKey": "zhujia_cavalry_young_strong",
          "alias": "祝家荘騎馬隊",
          "combatSkills": [
            "騎乗戦闘"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zhujia_front_cavalry_right",
        "characterId": "zhu-family-manor_zhujia_front_cavalry_right",
        "army": "ENEMY",
        "position": {
          "x": 6,
          "y": 11
        },
        "move": 4,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "zhu-family-manor_zhujia_front_cavalry_right",
          "name": "祝家荘前衛騎馬隊乙",
          "shortName": "騎",
          "martial": 56,
          "command": 55,
          "intelligence": 34,
          "charisma": 30,
          "portraitKey": "zhujia_cavalry_older_strong",
          "alias": "祝家荘騎馬隊",
          "combatSkills": [
            "騎乗戦闘"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "manor5",
        "characterId": "zhu-family-manor_manor5",
        "army": "ENEMY",
        "position": {
          "x": 0,
          "y": 5
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "zhu-family-manor_manor5",
          "name": "祝家荘弓兵甲",
          "shortName": "弓",
          "martial": 42,
          "command": 42,
          "intelligence": 36,
          "charisma": 20,
          "portraitKey": "zhujia_bow_older_strong",
          "alias": "祝家荘弓兵",
          "combatSkills": [
            "弓弩術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "慎重",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "manor6",
        "characterId": "zhu-family-manor_manor6",
        "army": "ENEMY",
        "position": {
          "x": 7,
          "y": 5
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "zhu-family-manor_manor6",
          "name": "祝家荘弓兵乙",
          "shortName": "弩",
          "martial": 42,
          "command": 42,
          "intelligence": 36,
          "charisma": 20,
          "portraitKey": "zhujia_bow_older_strong",
          "alias": "祝家荘弓兵",
          "combatSkills": [
            "弓弩術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "慎重",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "manor7",
        "characterId": "zhu-family-manor_manor7",
        "army": "ENEMY",
        "position": {
          "x": 2,
          "y": 5
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "zhu-family-manor_manor7",
          "name": "祝家荘弓兵丙",
          "shortName": "弓",
          "martial": 42,
          "command": 42,
          "intelligence": 36,
          "charisma": 20,
          "portraitKey": "zhujia_bow_young_strong",
          "alias": "祝家荘弓兵",
          "combatSkills": [
            "弓弩術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "慎重",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "manor8",
        "characterId": "zhu-family-manor_manor8",
        "army": "ENEMY",
        "position": {
          "x": 5,
          "y": 5
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "zhu-family-manor_manor8",
          "name": "祝家荘弓兵丁",
          "shortName": "弩",
          "martial": 42,
          "command": 42,
          "intelligence": 36,
          "charisma": 20,
          "portraitKey": "zhujia_bow_young_strong",
          "alias": "祝家荘弓兵",
          "combatSkills": [
            "弓弩術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "慎重",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zhujia_rear_crossbow_left",
        "characterId": "zhu-family-manor_zhujia_rear_crossbow_left",
        "army": "ENEMY",
        "position": {
          "x": 1,
          "y": 0
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "zhu-family-manor_zhujia_rear_crossbow_left",
          "name": "祝家荘後衛弩隊甲",
          "shortName": "弩",
          "martial": 44,
          "command": 46,
          "intelligence": 40,
          "charisma": 24,
          "portraitKey": "zhujia_bow_older_strong",
          "alias": "祝家荘弩隊",
          "combatSkills": [
            "弓弩術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "慎重・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zhujia_rear_crossbow_right",
        "characterId": "zhu-family-manor_zhujia_rear_crossbow_right",
        "army": "ENEMY",
        "position": {
          "x": 6,
          "y": 0
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "zhu-family-manor_zhujia_rear_crossbow_right",
          "name": "祝家荘後衛弩隊乙",
          "shortName": "弩",
          "martial": 44,
          "command": 46,
          "intelligence": 40,
          "charisma": 24,
          "portraitKey": "zhujia_bow_older_strong",
          "alias": "祝家荘弩隊",
          "combatSkills": [
            "弓弩術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "慎重・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "manor_adviser",
        "characterId": "zhu-family-manor_manor_adviser",
        "army": "ENEMY",
        "position": {
          "x": 4,
          "y": 2
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "zhu-family-manor_manor_adviser",
          "name": "祝家荘参謀甲",
          "shortName": "謀",
          "martial": 24,
          "command": 52,
          "intelligence": 90,
          "charisma": 44,
          "portraitKey": "mob_adviser_master_geography",
          "alias": "祝家荘参謀",
          "combatSkills": [
            "なし"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "冷静・策謀的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zhujia_water_soldier1",
        "characterId": "zhu-family-manor_zhujia_water_soldier1",
        "army": "ENEMY",
        "position": {
          "x": 4,
          "y": 7
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "zhu-family-manor_zhujia_water_soldier1",
          "name": "祝家荘水軍甲",
          "shortName": "水",
          "martial": 48,
          "command": 52,
          "intelligence": 34,
          "charisma": 26,
          "portraitKey": "zhujia_infantry_older_strong",
          "alias": "祝家荘水軍",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "水軍適正"
          ],
          "personality": "実直・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zhujia_water_soldier2",
        "characterId": "zhu-family-manor_zhujia_water_soldier2",
        "army": "ENEMY",
        "position": {
          "x": 5,
          "y": 7
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "zhu-family-manor_zhujia_water_soldier2",
          "name": "祝家荘水軍乙",
          "shortName": "水",
          "martial": 48,
          "command": 52,
          "intelligence": 34,
          "charisma": 26,
          "portraitKey": "zhujia_infantry_young_strong",
          "alias": "祝家荘水軍",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "水軍適正"
          ],
          "personality": "実直・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zhujia_infantry1",
        "characterId": "zhu-family-manor_zhujia_infantry1",
        "army": "ENEMY",
        "position": {
          "x": 0,
          "y": 8
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "zhu-family-manor_zhujia_infantry1",
          "name": "祝家荘歩兵隊甲",
          "shortName": "歩",
          "martial": 48,
          "command": 52,
          "intelligence": 34,
          "charisma": 26,
          "portraitKey": "zhujia_infantry_older_strong",
          "alias": "祝家荘歩兵隊",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "実直・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zhujia_infantry2",
        "characterId": "zhu-family-manor_zhujia_infantry2",
        "army": "ENEMY",
        "position": {
          "x": 7,
          "y": 8
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "zhu-family-manor_zhujia_infantry2",
          "name": "祝家荘歩兵隊乙",
          "shortName": "歩",
          "martial": 48,
          "command": 52,
          "intelligence": 34,
          "charisma": 26,
          "portraitKey": "zhujia_infantry_older_strong",
          "alias": "祝家荘歩兵隊",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "実直・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zhujia_infantry3",
        "characterId": "zhu-family-manor_zhujia_infantry3",
        "army": "ENEMY",
        "position": {
          "x": 2,
          "y": 9
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "zhu-family-manor_zhujia_infantry3",
          "name": "祝家荘歩兵隊丙",
          "shortName": "歩",
          "martial": 50,
          "command": 54,
          "intelligence": 35,
          "charisma": 27,
          "portraitKey": "zhujia_infantry_young_strong",
          "alias": "祝家荘歩兵隊",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "実直・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zhujia_infantry4",
        "characterId": "zhu-family-manor_zhujia_infantry4",
        "army": "ENEMY",
        "position": {
          "x": 5,
          "y": 9
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "zhu-family-manor_zhujia_infantry4",
          "name": "祝家荘歩兵隊丁",
          "shortName": "歩",
          "martial": 50,
          "command": 54,
          "intelligence": 35,
          "charisma": 27,
          "portraitKey": "zhujia_infantry_older_strong",
          "alias": "祝家荘歩兵隊",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "実直・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zhujia_front_adviser_left",
        "characterId": "zhu-family-manor_zhujia_front_adviser_left",
        "army": "ENEMY",
        "position": {
          "x": 0,
          "y": 12
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "zhu-family-manor_zhujia_front_adviser_left",
          "name": "祝家荘前衛参謀甲",
          "shortName": "謀",
          "martial": 24,
          "command": 54,
          "intelligence": 88,
          "charisma": 44,
          "portraitKey": "mob_adviser_military_frontline",
          "alias": "祝家荘参謀",
          "combatSkills": [
            "なし"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "冷静・策謀的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zhujia_fire_captain_left",
        "characterId": "zhu-family-manor_zhujia_fire_captain_left",
        "army": "ENEMY",
        "position": {
          "x": 1,
          "y": 12
        },
        "move": 3,
        "facing": "SOUTH",
        "overrides": {
          "maxStrategyUses": 1,
          "specialTacticDamageRate": 0.75,
          "zhujiaMobTacticAi": true
        },
        "mobCharacter": {
          "id": "zhu-family-manor_zhujia_fire_captain_left",
          "name": "祝家荘隊長丙",
          "shortName": "将",
          "martial": 62,
          "command": 68,
          "intelligence": 46,
          "charisma": 34,
          "portraitKey": "mob_captain_high_trust_young",
          "alias": "祝家荘隊長",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "火計・山野適正"
          ],
          "personality": "実直・指揮的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zhujia_fire_captain_right",
        "characterId": "zhu-family-manor_zhujia_fire_captain_right",
        "army": "ENEMY",
        "position": {
          "x": 6,
          "y": 12
        },
        "move": 3,
        "facing": "SOUTH",
        "overrides": {
          "maxStrategyUses": 1,
          "specialTacticDamageRate": 0.75,
          "zhujiaMobTacticAi": true
        },
        "mobCharacter": {
          "id": "zhu-family-manor_zhujia_fire_captain_right",
          "name": "祝家荘隊長丁",
          "shortName": "将",
          "martial": 62,
          "command": 68,
          "intelligence": 46,
          "charisma": 34,
          "portraitKey": "mob_captain_high_trust_middle",
          "alias": "祝家荘隊長",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "火計・山野適正"
          ],
          "personality": "実直・指揮的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zhujia_front_adviser_right",
        "characterId": "zhu-family-manor_zhujia_front_adviser_right",
        "army": "ENEMY",
        "position": {
          "x": 7,
          "y": 12
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "zhu-family-manor_zhujia_front_adviser_right",
          "name": "祝家荘前衛参謀乙",
          "shortName": "謀",
          "martial": 24,
          "command": 54,
          "intelligence": 88,
          "charisma": 44,
          "portraitKey": "mob_adviser_military_scout",
          "alias": "祝家荘参謀",
          "combatSkills": [
            "なし"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "冷静・策謀的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zhujia_infantry5",
        "characterId": "zhu-family-manor_zhujia_infantry5",
        "army": "ENEMY",
        "position": {
          "x": 1,
          "y": 13
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "zhu-family-manor_zhujia_infantry5",
          "name": "祝家荘歩兵隊戊",
          "shortName": "歩",
          "martial": 52,
          "command": 56,
          "intelligence": 36,
          "charisma": 28,
          "portraitKey": "zhujia_infantry_older_strong",
          "alias": "祝家荘歩兵隊",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "実直・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zhujia_infantry6",
        "characterId": "zhu-family-manor_zhujia_infantry6",
        "army": "ENEMY",
        "position": {
          "x": 6,
          "y": 13
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "zhu-family-manor_zhujia_infantry6",
          "name": "祝家荘歩兵隊己",
          "shortName": "歩",
          "martial": 52,
          "command": 56,
          "intelligence": 36,
          "charisma": 28,
          "portraitKey": "zhujia_infantry_young_strong",
          "alias": "祝家荘歩兵隊",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "実直・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zhujia_cavalry5",
        "characterId": "zhu-family-manor_zhujia_cavalry5",
        "army": "ENEMY",
        "position": {
          "x": 2,
          "y": 12
        },
        "move": 4,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "zhu-family-manor_zhujia_cavalry5",
          "name": "祝家荘騎馬隊戊",
          "shortName": "騎",
          "martial": 62,
          "command": 60,
          "intelligence": 40,
          "charisma": 34,
          "portraitKey": "zhujia_cavalry_very_strong",
          "alias": "祝家荘騎馬隊",
          "combatSkills": [
            "騎乗戦闘"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zhujia_cavalry6",
        "characterId": "zhu-family-manor_zhujia_cavalry6",
        "army": "ENEMY",
        "position": {
          "x": 5,
          "y": 12
        },
        "move": 4,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "zhu-family-manor_zhujia_cavalry6",
          "name": "祝家荘騎馬隊己",
          "shortName": "騎",
          "martial": 62,
          "command": 60,
          "intelligence": 40,
          "charisma": 34,
          "portraitKey": "zhujia_cavalry_very_strong",
          "alias": "祝家荘騎馬隊",
          "combatSkills": [
            "騎乗戦闘"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zhujia_archer5",
        "characterId": "zhu-family-manor_zhujia_archer5",
        "army": "ENEMY",
        "position": {
          "x": 0,
          "y": 14
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "zhu-family-manor_zhujia_archer5",
          "name": "祝家荘弓兵戊",
          "shortName": "弓",
          "martial": 44,
          "command": 46,
          "intelligence": 40,
          "charisma": 24,
          "portraitKey": "zhujia_bow_older_strong",
          "alias": "祝家荘弓兵",
          "combatSkills": [
            "弓弩術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "慎重・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zhujia_archer6",
        "characterId": "zhu-family-manor_zhujia_archer6",
        "army": "ENEMY",
        "position": {
          "x": 7,
          "y": 14
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "zhu-family-manor_zhujia_archer6",
          "name": "祝家荘弓兵己",
          "shortName": "弓",
          "martial": 44,
          "command": 46,
          "intelligence": 40,
          "charisma": 24,
          "portraitKey": "zhujia_bow_older_strong",
          "alias": "祝家荘弓兵",
          "combatSkills": [
            "弓弩術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "慎重・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zhujia_archer7",
        "characterId": "zhu-family-manor_zhujia_archer7",
        "army": "ENEMY",
        "position": {
          "x": 2,
          "y": 14
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "zhu-family-manor_zhujia_archer7",
          "name": "祝家荘弓兵庚",
          "shortName": "弓",
          "martial": 45,
          "command": 47,
          "intelligence": 41,
          "charisma": 25,
          "portraitKey": "zhujia_bow_young_strong",
          "alias": "祝家荘弓兵",
          "combatSkills": [
            "弓弩術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "慎重・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zhujia_archer8",
        "characterId": "zhu-family-manor_zhujia_archer8",
        "army": "ENEMY",
        "position": {
          "x": 5,
          "y": 14
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "zhu-family-manor_zhujia_archer8",
          "name": "祝家荘弓兵辛",
          "shortName": "弓",
          "martial": 45,
          "command": 47,
          "intelligence": 41,
          "charisma": 25,
          "portraitKey": "zhujia_bow_young_strong",
          "alias": "祝家荘弓兵",
          "combatSkills": [
            "弓弩術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "慎重・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zhujia_crossbow3",
        "characterId": "zhu-family-manor_zhujia_crossbow3",
        "army": "ENEMY",
        "position": {
          "x": 1,
          "y": 4
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "zhu-family-manor_zhujia_crossbow3",
          "name": "祝家荘弩兵丙",
          "shortName": "弩",
          "martial": 46,
          "command": 48,
          "intelligence": 42,
          "charisma": 26,
          "portraitKey": "zhujia_bow_older_strong",
          "alias": "祝家荘弩兵",
          "combatSkills": [
            "弓弩術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "慎重・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zhujia_crossbow4",
        "characterId": "zhu-family-manor_zhujia_crossbow4",
        "army": "ENEMY",
        "position": {
          "x": 6,
          "y": 4
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "zhu-family-manor_zhujia_crossbow4",
          "name": "祝家荘弩兵丁",
          "shortName": "弩",
          "martial": 46,
          "command": 48,
          "intelligence": 42,
          "charisma": 26,
          "portraitKey": "zhujia_bow_older_strong",
          "alias": "祝家荘弩兵",
          "combatSkills": [
            "弓弩術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "慎重・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zhujia_crossbow5",
        "characterId": "zhu-family-manor_zhujia_crossbow5",
        "army": "ENEMY",
        "position": {
          "x": 3,
          "y": 5
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "zhu-family-manor_zhujia_crossbow5",
          "name": "祝家荘弩兵戊",
          "shortName": "弩",
          "martial": 48,
          "command": 50,
          "intelligence": 44,
          "charisma": 28,
          "portraitKey": "zhujia_bow_very_strong",
          "alias": "祝家荘弩兵",
          "combatSkills": [
            "弓弩術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "慎重・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zhujia_crossbow6",
        "characterId": "zhu-family-manor_zhujia_crossbow6",
        "army": "ENEMY",
        "position": {
          "x": 4,
          "y": 5
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "zhu-family-manor_zhujia_crossbow6",
          "name": "祝家荘弩兵己",
          "shortName": "弩",
          "martial": 48,
          "command": 50,
          "intelligence": 44,
          "charisma": 28,
          "portraitKey": "zhujia_bow_very_strong",
          "alias": "祝家荘弩兵",
          "combatSkills": [
            "弓弩術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "慎重・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zhujia_elite1",
        "characterId": "zhu-family-manor_zhujia_elite1",
        "army": "ENEMY",
        "position": {
          "x": 1,
          "y": 9
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "zhu-family-manor_zhujia_elite1",
          "name": "祝家荘精鋭兵甲",
          "shortName": "精",
          "martial": 62,
          "command": 66,
          "intelligence": 42,
          "charisma": 34,
          "portraitKey": "zhujia_infantry_older_strong",
          "alias": "祝家荘精鋭兵",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zhujia_elite2",
        "characterId": "zhu-family-manor_zhujia_elite2",
        "army": "ENEMY",
        "position": {
          "x": 6,
          "y": 9
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "zhu-family-manor_zhujia_elite2",
          "name": "祝家荘精鋭兵乙",
          "shortName": "精",
          "martial": 62,
          "command": 66,
          "intelligence": 42,
          "charisma": 34,
          "portraitKey": "zhujia_infantry_older_strong",
          "alias": "祝家荘精鋭兵",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zhujia_elite3",
        "characterId": "zhu-family-manor_zhujia_elite3",
        "army": "ENEMY",
        "position": {
          "x": 3,
          "y": 10
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "zhu-family-manor_zhujia_elite3",
          "name": "祝家荘精鋭兵丙",
          "shortName": "精",
          "martial": 64,
          "command": 68,
          "intelligence": 44,
          "charisma": 36,
          "portraitKey": "zhujia_infantry_very_strong",
          "alias": "祝家荘精鋭兵",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zhujia_elite4",
        "characterId": "zhu-family-manor_zhujia_elite4",
        "army": "ENEMY",
        "position": {
          "x": 4,
          "y": 10
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "zhu-family-manor_zhujia_elite4",
          "name": "祝家荘精鋭兵丁",
          "shortName": "精",
          "martial": 64,
          "command": 68,
          "intelligence": 44,
          "charisma": 36,
          "portraitKey": "zhujia_infantry_very_strong",
          "alias": "祝家荘精鋭兵",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zhujia_captain1",
        "characterId": "zhu-family-manor_zhujia_captain1",
        "army": "ENEMY",
        "position": {
          "x": 2,
          "y": 8
        },
        "move": 4,
        "facing": "SOUTH",
        "overrides": {
          "maxStrategyUses": 1,
          "specialTacticDamageRate": 0.75,
          "zhujiaMobTacticAi": true
        },
        "mobCharacter": {
          "id": "zhu-family-manor_zhujia_captain1",
          "name": "祝家荘隊長甲",
          "shortName": "将",
          "martial": 68,
          "command": 70,
          "intelligence": 50,
          "charisma": 40,
          "portraitKey": "zhujia_captain",
          "alias": "祝家荘隊長",
          "combatSkills": [
            "騎乗戦闘"
          ],
          "specialAbilities": [
            "水計・水軍適正"
          ],
          "personality": "冷静・勇猛",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zhujia_captain2",
        "characterId": "zhu-family-manor_zhujia_captain2",
        "army": "ENEMY",
        "position": {
          "x": 5,
          "y": 8
        },
        "move": 4,
        "facing": "SOUTH",
        "overrides": {
          "maxStrategyUses": 1,
          "specialTacticDamageRate": 0.75,
          "zhujiaMobTacticAi": true
        },
        "mobCharacter": {
          "id": "zhu-family-manor_zhujia_captain2",
          "name": "祝家荘隊長乙",
          "shortName": "将",
          "martial": 68,
          "command": 70,
          "intelligence": 50,
          "charisma": 40,
          "portraitKey": "zhujia_captain",
          "alias": "祝家荘隊長",
          "combatSkills": [
            "騎乗戦闘"
          ],
          "specialAbilities": [
            "水計・水軍適正"
          ],
          "personality": "冷静・勇猛",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "manor_adviser2",
        "characterId": "zhu-family-manor_manor_adviser2",
        "army": "ENEMY",
        "position": {
          "x": 3,
          "y": 3
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "zhu-family-manor_manor_adviser2",
          "name": "祝家荘参謀乙",
          "shortName": "謀",
          "martial": 24,
          "command": 56,
          "intelligence": 92,
          "charisma": 46,
          "portraitKey": "mob_adviser_master_strategy",
          "alias": "祝家荘参謀",
          "combatSkills": [
            "なし"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "冷静・策謀的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "sun_li_zhujia",
        "characterId": "sun_li",
        "army": "ENEMY",
        "position": {
          "x": 0,
          "y": 6
        },
        "move": 4,
        "facing": "SOUTH"
      },
      {
        "id": "sun_xin_zhujia",
        "characterId": "sun_xin",
        "army": "ENEMY",
        "position": {
          "x": 1,
          "y": 6
        },
        "move": 3,
        "facing": "SOUTH"
      },
      {
        "id": "gu_dasao_zhujia",
        "characterId": "gu_dasao",
        "army": "ENEMY",
        "position": {
          "x": 2,
          "y": 6
        },
        "move": 3,
        "facing": "SOUTH"
      },
      {
        "id": "yue_he_zhujia",
        "characterId": "yue_he",
        "army": "ENEMY",
        "position": {
          "x": 3,
          "y": 6
        },
        "move": 3,
        "facing": "SOUTH"
      },
      {
        "id": "xie_zhen_zhujia",
        "characterId": "xie_zhen",
        "army": "ENEMY",
        "position": {
          "x": 0,
          "y": 7
        },
        "move": 4,
        "facing": "SOUTH"
      },
      {
        "id": "xie_bao_zhujia",
        "characterId": "xie_bao",
        "army": "ENEMY",
        "position": {
          "x": 1,
          "y": 7
        },
        "move": 4,
        "facing": "SOUTH"
      },
      {
        "id": "zou_yuan_zhujia",
        "characterId": "zou_yuan",
        "army": "ENEMY",
        "position": {
          "x": 2,
          "y": 7
        },
        "move": 3,
        "facing": "SOUTH"
      },
      {
        "id": "zou_run_zhujia",
        "characterId": "zou_run",
        "army": "ENEMY",
        "position": {
          "x": 3,
          "y": 7
        },
        "move": 3,
        "facing": "SOUTH"
      }
    ],
    "intro": [
      {
        "unitId": "song_jiang_zhujia",
        "text": "祝家荘との長い戦いも、ここで決着をつける。敵は大軍だ。隊列を崩さず、一歩ずつ進もう。"
      },
      {
        "unitId": "wu_yong_zhujia",
        "text": "祝朝奉は荘中の兵を総動員しました。正面だけを見ず、左右の道を使って敵陣を分断しましょう。孫提轄らには、すでに別の役目を託してあります。"
      },
      {
        "unitId": "ma_lin_zhujia",
        "text": "敵は多いが、こちらも梁山泊の精鋭だ。俺が右翼を支える。皆でこの大陣を崩そう！"
      },
      {
        "unitId": "zhu_chaofeng",
        "text": "梁山泊の賊どもめ！　我が祝家荘の兵は尽きぬ。荘を踏みにじろうとしたことを後悔させてくれる！"
      },
      {
        "unitId": "luan_tingyu",
        "text": "各隊、持ち場を守れ。梁山泊の勢いに呑まれるな。前衛で削り、後衛の弓弩で仕留めるのだ！"
      },
      {
        "unitId": "sun_li_zhujia",
        "text": "登州の孫立、援軍として参った。皆はここで陣を保ち、戦況が動くまで軽々しく動くな。"
      }
    ],
    "victory": [
      {
        "unitId": "song_jiang_zhujia",
        "text": "祝家荘は落ちた。時遷を救い出し、長き戦いにもようやく決着がついた。"
      },
      {
        "unitId": "lin_chong_zhujia",
        "text": "敵の守りは見事だった。だが皆で力を合わせ、ついに荘を破ったな。"
      }
    ]
  },
  {
    "id": "gaotang-prefecture",
    "chapterNumber": 7,
    "title": "第七章　高唐州・飛天妖術陣",
    "description": "高唐州遠征軍の総力を結集し、高廉の飛天兵と妖術陣を突破して柴進を救出する。",
    "leader": "song_jiang_gaotang",
    "turnLimit": 18,
    "escape": null,
    "objectiveText": "勝利：高廉を含む高唐州軍を全滅<br>敗北：宋江が敗走<br><br><b>特殊ルール：</b>高廉は公孫勝が3マス以内にいない場合、自身から3マス以内へ広域幻術を使用し、使用回数を消費しない。公孫勝が3マス以内にいる間は広域幻術を封じ、通常幻術のみ使用する。",
    "requiredSurvivors": [],
    "sorcery": {
      "actorUnitId": "gao_lian",
      "suppressorUnitId": "gongsun_sheng_gaotang",
      "suppressionRange": 3,
      "trapZones": [
        {
          "kind": "normal",
          "label": "中盤前方",
          "count": 2,
          "candidates": [
            [
              0,
              11
            ],
            [
              3,
              11
            ],
            [
              4,
              11
            ],
            [
              7,
              11
            ]
          ]
        },
        {
          "kind": "spell",
          "label": "中盤後方",
          "count": 2,
          "candidates": [
            [
              2,
              13
            ],
            [
              5,
              13
            ],
            [
              0,
              14
            ],
            [
              7,
              14
            ],
            [
              0,
              15
            ],
            [
              7,
              15
            ]
          ]
        }
      ],
      "warning": [
        {
          "unitId": "gao_lian",
          "text": "ククク……そこも我が妖陣の内よ。足を踏み入れた時点で、すでに我が術中に落ちておるわ！"
        },
        {
          "unitId": "gongsun_sheng_gaotang",
          "text": "地脈に妖符が仕込まれています！　皆、平地とて油断せず、足元に注意してください！"
        }
      ]
    },
    "units": [
      {
        "id": "bai_sheng_gaotang",
        "characterId": "bai_sheng",
        "army": "PLAYER",
        "position": {
          "x": 0,
          "y": 19
        },
        "move": 3,
        "facing": "NORTH"
      },
      {
        "id": "lu_fang_gaotang",
        "characterId": "lu_fang",
        "army": "PLAYER",
        "position": {
          "x": 1,
          "y": 19
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "song_jiang_gaotang",
        "characterId": "song_jiang",
        "army": "PLAYER",
        "position": {
          "x": 2,
          "y": 19
        },
        "move": 3,
        "facing": "NORTH"
      },
      {
        "id": "wu_yong_gaotang",
        "characterId": "wu_yong",
        "army": "PLAYER",
        "position": {
          "x": 3,
          "y": 19
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "gongsun_sheng_gaotang",
        "characterId": "gongsun_sheng",
        "army": "PLAYER",
        "position": {
          "x": 4,
          "y": 19
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "zhu_tong_gaotang",
        "characterId": "zhu_tong",
        "army": "PLAYER",
        "position": {
          "x": 5,
          "y": 19
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "guo_sheng_gaotang",
        "characterId": "guo_sheng",
        "army": "PLAYER",
        "position": {
          "x": 6,
          "y": 19
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "dai_zong_gaotang",
        "characterId": "dai_zong",
        "army": "PLAYER",
        "position": {
          "x": 7,
          "y": 19
        },
        "move": 6,
        "facing": "NORTH"
      },
      {
        "id": "li_jun_gaotang",
        "characterId": "li_jun",
        "army": "PLAYER",
        "position": {
          "x": 0,
          "y": 18
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "deng_fei_gaotang",
        "characterId": "deng_fei",
        "army": "PLAYER",
        "position": {
          "x": 1,
          "y": 18
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "lin_chong_gaotang",
        "characterId": "lin_chong",
        "army": "PLAYER",
        "position": {
          "x": 2,
          "y": 18
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "hua_rong_gaotang",
        "characterId": "hua_rong",
        "army": "PLAYER",
        "position": {
          "x": 3,
          "y": 18
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "li_kui_gaotang",
        "characterId": "li_kui",
        "army": "PLAYER",
        "position": {
          "x": 4,
          "y": 18
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "qin_ming_gaotang",
        "characterId": "qin_ming",
        "army": "PLAYER",
        "position": {
          "x": 5,
          "y": 18
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "ou_peng_gaotang",
        "characterId": "ou_peng",
        "army": "PLAYER",
        "position": {
          "x": 6,
          "y": 18
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "zhang_shun_gaotang",
        "characterId": "zhang_shun",
        "army": "PLAYER",
        "position": {
          "x": 7,
          "y": 18
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "zhang_heng_gaotang",
        "characterId": "zhang_heng",
        "army": "PLAYER",
        "position": {
          "x": 0,
          "y": 17
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "yang_lin_gaotang",
        "characterId": "yang_lin",
        "army": "PLAYER",
        "position": {
          "x": 1,
          "y": 17
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "ma_lin_gaotang",
        "characterId": "ma_lin",
        "army": "PLAYER",
        "position": {
          "x": 2,
          "y": 17
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "lei_heng_gaotang",
        "characterId": "lei_heng",
        "army": "PLAYER",
        "position": {
          "x": 3,
          "y": 17
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "shi_xiu_gaotang",
        "characterId": "shi_xiu",
        "army": "PLAYER",
        "position": {
          "x": 4,
          "y": 17
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "yang_xiong_gaotang",
        "characterId": "yang_xiong",
        "army": "PLAYER",
        "position": {
          "x": 5,
          "y": 17
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "sun_li_gaotang",
        "characterId": "sun_li",
        "army": "PLAYER",
        "position": {
          "x": 6,
          "y": 17
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "gao_lian",
        "characterId": "gao_lian",
        "army": "ENEMY",
        "position": {
          "x": 4,
          "y": 0
        },
        "move": 3,
        "facing": "SOUTH"
      },
      {
        "id": "xue_yuanhui_gaotang",
        "characterId": "xue_yuanhui",
        "army": "ENEMY",
        "position": {
          "x": 4,
          "y": 4
        },
        "move": 4,
        "facing": "SOUTH"
      },
      {
        "id": "yu_zhi_gaotang",
        "characterId": "yu_zhi",
        "army": "ENEMY",
        "position": {
          "x": 2,
          "y": 6
        },
        "move": 4,
        "facing": "SOUTH"
      },
      {
        "id": "wen_wenbao_gaotang",
        "characterId": "wen_wenbao",
        "army": "ENEMY",
        "position": {
          "x": 5,
          "y": 6
        },
        "move": 4,
        "facing": "SOUTH"
      },
      {
        "id": "feitian_divine1",
        "characterId": "gaotang-prefecture_feitian_divine1",
        "army": "ENEMY",
        "position": {
          "x": 3,
          "y": 1
        },
        "move": 4,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "gaotang-prefecture_feitian_divine1",
          "name": "飛天神兵甲",
          "shortName": "神",
          "martial": 78,
          "command": 74,
          "intelligence": 65,
          "charisma": 50,
          "portraitKey": "feitian_divine",
          "alias": "飛天神兵",
          "combatSkills": [
            "なし"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛・寡黙",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "feitian_divine2",
        "characterId": "gaotang-prefecture_feitian_divine2",
        "army": "ENEMY",
        "position": {
          "x": 4,
          "y": 2
        },
        "move": 4,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "gaotang-prefecture_feitian_divine2",
          "name": "飛天神兵乙",
          "shortName": "神",
          "martial": 78,
          "command": 74,
          "intelligence": 65,
          "charisma": 50,
          "portraitKey": "feitian_divine",
          "alias": "飛天神兵",
          "combatSkills": [
            "なし"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛・寡黙",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "feitian_divine3",
        "characterId": "gaotang-prefecture_feitian_divine3",
        "army": "ENEMY",
        "position": {
          "x": 5,
          "y": 1
        },
        "move": 4,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "gaotang-prefecture_feitian_divine3",
          "name": "飛天神兵丙",
          "shortName": "神",
          "martial": 78,
          "command": 74,
          "intelligence": 65,
          "charisma": 50,
          "portraitKey": "feitian_divine",
          "alias": "飛天神兵",
          "combatSkills": [
            "なし"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛・寡黙",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "feitian_archer1",
        "characterId": "gaotang-prefecture_feitian_archer1",
        "army": "ENEMY",
        "position": {
          "x": 1,
          "y": 3
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "gaotang-prefecture_feitian_archer1",
          "name": "飛天弩兵甲",
          "shortName": "弩",
          "martial": 63,
          "command": 56,
          "intelligence": 46,
          "charisma": 24,
          "portraitKey": "feitian_archer",
          "alias": "飛天弩兵",
          "combatSkills": [
            "弓弩術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "冷静・慎重",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "feitian_archer2",
        "characterId": "gaotang-prefecture_feitian_archer2",
        "army": "ENEMY",
        "position": {
          "x": 6,
          "y": 3
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "gaotang-prefecture_feitian_archer2",
          "name": "飛天弩兵乙",
          "shortName": "弩",
          "martial": 63,
          "command": 56,
          "intelligence": 46,
          "charisma": 24,
          "portraitKey": "feitian_archer",
          "alias": "飛天弩兵",
          "combatSkills": [
            "弓弩術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "冷静・慎重",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "feitian_infantry1",
        "characterId": "gaotang-prefecture_feitian_infantry1",
        "army": "ENEMY",
        "position": {
          "x": 1,
          "y": 5
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "gaotang-prefecture_feitian_infantry1",
          "name": "飛天歩兵甲",
          "shortName": "飛",
          "martial": 67,
          "command": 64,
          "intelligence": 38,
          "charisma": 24,
          "portraitKey": "feitian_infantry",
          "alias": "飛天歩兵",
          "combatSkills": [
            "なし"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛・実直",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "feitian_infantry2",
        "characterId": "gaotang-prefecture_feitian_infantry2",
        "army": "ENEMY",
        "position": {
          "x": 6,
          "y": 5
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "gaotang-prefecture_feitian_infantry2",
          "name": "飛天歩兵乙",
          "shortName": "飛",
          "martial": 67,
          "command": 64,
          "intelligence": 38,
          "charisma": 24,
          "portraitKey": "feitian_infantry",
          "alias": "飛天歩兵",
          "combatSkills": [
            "なし"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛・実直",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "feitian_infantry3",
        "characterId": "gaotang-prefecture_feitian_infantry3",
        "army": "ENEMY",
        "position": {
          "x": 2,
          "y": 8
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "gaotang-prefecture_feitian_infantry3",
          "name": "飛天歩兵丙",
          "shortName": "飛",
          "martial": 67,
          "command": 64,
          "intelligence": 38,
          "charisma": 24,
          "portraitKey": "feitian_infantry",
          "alias": "飛天歩兵",
          "combatSkills": [
            "なし"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛・実直",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "feitian_infantry4",
        "characterId": "gaotang-prefecture_feitian_infantry4",
        "army": "ENEMY",
        "position": {
          "x": 5,
          "y": 8
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "gaotang-prefecture_feitian_infantry4",
          "name": "飛天歩兵丁",
          "shortName": "飛",
          "martial": 67,
          "command": 64,
          "intelligence": 38,
          "charisma": 24,
          "portraitKey": "feitian_infantry",
          "alias": "飛天歩兵",
          "combatSkills": [
            "なし"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛・実直",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "feitian_cavalry1",
        "characterId": "gaotang-prefecture_feitian_cavalry1",
        "army": "ENEMY",
        "position": {
          "x": 1,
          "y": 9
        },
        "move": 4,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "gaotang-prefecture_feitian_cavalry1",
          "name": "飛天騎兵甲",
          "shortName": "騎",
          "martial": 73,
          "command": 62,
          "intelligence": 40,
          "charisma": 26,
          "portraitKey": "feitian_cavalry",
          "alias": "飛天騎兵",
          "combatSkills": [
            "騎乗戦闘"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛・好戦的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "feitian_cavalry2",
        "characterId": "gaotang-prefecture_feitian_cavalry2",
        "army": "ENEMY",
        "position": {
          "x": 6,
          "y": 9
        },
        "move": 4,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "gaotang-prefecture_feitian_cavalry2",
          "name": "飛天騎兵乙",
          "shortName": "騎",
          "martial": 73,
          "command": 62,
          "intelligence": 40,
          "charisma": 26,
          "portraitKey": "feitian_cavalry",
          "alias": "飛天騎兵",
          "combatSkills": [
            "騎乗戦闘"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛・好戦的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "feitian_cavalry3",
        "characterId": "gaotang-prefecture_feitian_cavalry3",
        "army": "ENEMY",
        "position": {
          "x": 2,
          "y": 11
        },
        "move": 4,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "gaotang-prefecture_feitian_cavalry3",
          "name": "飛天騎兵丙",
          "shortName": "騎",
          "martial": 73,
          "command": 62,
          "intelligence": 40,
          "charisma": 26,
          "portraitKey": "feitian_cavalry",
          "alias": "飛天騎兵",
          "combatSkills": [
            "騎乗戦闘"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛・好戦的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "feitian_cavalry4",
        "characterId": "gaotang-prefecture_feitian_cavalry4",
        "army": "ENEMY",
        "position": {
          "x": 5,
          "y": 11
        },
        "move": 4,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "gaotang-prefecture_feitian_cavalry4",
          "name": "飛天騎兵丁",
          "shortName": "騎",
          "martial": 73,
          "command": 62,
          "intelligence": 40,
          "charisma": 26,
          "portraitKey": "feitian_cavalry",
          "alias": "飛天騎兵",
          "combatSkills": [
            "騎乗戦闘"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛・好戦的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "gaotang_infantry1",
        "characterId": "gaotang-prefecture_gaotang_infantry1",
        "army": "ENEMY",
        "position": {
          "x": 1,
          "y": 13
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "gaotang-prefecture_gaotang_infantry1",
          "name": "高唐州歩兵甲",
          "shortName": "歩",
          "martial": 48,
          "command": 50,
          "intelligence": 32,
          "charisma": 24,
          "portraitKey": "mob_infantry_young_normal_b",
          "alias": "高唐州歩兵",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "実直",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "gaotang_infantry2",
        "characterId": "gaotang-prefecture_gaotang_infantry2",
        "army": "ENEMY",
        "position": {
          "x": 6,
          "y": 13
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "gaotang-prefecture_gaotang_infantry2",
          "name": "高唐州歩兵乙",
          "shortName": "歩",
          "martial": 48,
          "command": 50,
          "intelligence": 32,
          "charisma": 24,
          "portraitKey": "mob_infantry_older_normal_a",
          "alias": "高唐州歩兵",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "実直",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "gaotang_infantry3",
        "characterId": "gaotang-prefecture_gaotang_infantry3",
        "army": "ENEMY",
        "position": {
          "x": 2,
          "y": 14
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "gaotang-prefecture_gaotang_infantry3",
          "name": "高唐州歩兵丙",
          "shortName": "歩",
          "martial": 48,
          "command": 50,
          "intelligence": 32,
          "charisma": 24,
          "portraitKey": "mob_infantry_young_normal_a",
          "alias": "高唐州歩兵",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "実直",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "gaotang_infantry4",
        "characterId": "gaotang-prefecture_gaotang_infantry4",
        "army": "ENEMY",
        "position": {
          "x": 5,
          "y": 14
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "gaotang-prefecture_gaotang_infantry4",
          "name": "高唐州歩兵丁",
          "shortName": "歩",
          "martial": 48,
          "command": 50,
          "intelligence": 32,
          "charisma": 24,
          "portraitKey": "mob_infantry_older_normal_b",
          "alias": "高唐州歩兵",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "実直",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "gaotang_cavalry1",
        "characterId": "gaotang-prefecture_gaotang_cavalry1",
        "army": "ENEMY",
        "position": {
          "x": 1,
          "y": 11
        },
        "move": 4,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "gaotang-prefecture_gaotang_cavalry1",
          "name": "高唐州騎兵甲",
          "shortName": "騎",
          "martial": 58,
          "command": 56,
          "intelligence": 36,
          "charisma": 28,
          "portraitKey": "mob_cavalry_older_normal_a",
          "alias": "高唐州騎兵",
          "combatSkills": [
            "騎乗戦闘"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "gaotang_cavalry2",
        "characterId": "gaotang-prefecture_gaotang_cavalry2",
        "army": "ENEMY",
        "position": {
          "x": 6,
          "y": 11
        },
        "move": 4,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "gaotang-prefecture_gaotang_cavalry2",
          "name": "高唐州騎兵乙",
          "shortName": "騎",
          "martial": 58,
          "command": 56,
          "intelligence": 36,
          "charisma": 28,
          "portraitKey": "mob_cavalry_older_normal_b",
          "alias": "高唐州騎兵",
          "combatSkills": [
            "騎乗戦闘"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "gaotang_archer1",
        "characterId": "gaotang-prefecture_gaotang_archer1",
        "army": "ENEMY",
        "position": {
          "x": 1,
          "y": 10
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "gaotang-prefecture_gaotang_archer1",
          "name": "高唐州弩兵甲",
          "shortName": "弩",
          "martial": 46,
          "command": 48,
          "intelligence": 42,
          "charisma": 24,
          "portraitKey": "mob_bow_older_normal_a",
          "alias": "高唐州弩兵",
          "combatSkills": [
            "弓弩術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "慎重",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "gaotang_archer2",
        "characterId": "gaotang-prefecture_gaotang_archer2",
        "army": "ENEMY",
        "position": {
          "x": 6,
          "y": 10
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "gaotang-prefecture_gaotang_archer2",
          "name": "高唐州弩兵乙",
          "shortName": "弩",
          "martial": 46,
          "command": 48,
          "intelligence": 42,
          "charisma": 24,
          "portraitKey": "mob_bow_older_normal_b",
          "alias": "高唐州弩兵",
          "combatSkills": [
            "弓弩術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "慎重",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "gaotang_adviser1",
        "characterId": "gaotang-prefecture_gaotang_adviser1",
        "army": "ENEMY",
        "position": {
          "x": 2,
          "y": 2
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "gaotang-prefecture_gaotang_adviser1",
          "name": "高唐州参謀甲",
          "shortName": "謀",
          "martial": 24,
          "command": 56,
          "intelligence": 92,
          "charisma": 46,
          "portraitKey": "mob_adviser_military_frontline",
          "alias": "高唐州参謀",
          "combatSkills": [
            "なし"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "冷静・策謀的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "gaotang_adviser2",
        "characterId": "gaotang-prefecture_gaotang_adviser2",
        "army": "ENEMY",
        "position": {
          "x": 6,
          "y": 2
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "gaotang-prefecture_gaotang_adviser2",
          "name": "高唐州参謀乙",
          "shortName": "謀",
          "martial": 24,
          "command": 54,
          "intelligence": 88,
          "charisma": 44,
          "portraitKey": "mob_adviser_civil_logistics",
          "alias": "高唐州参謀",
          "combatSkills": [
            "なし"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "冷静・策謀的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "gaotang_adviser3",
        "characterId": "gaotang-prefecture_gaotang_adviser3",
        "army": "ENEMY",
        "position": {
          "x": 3,
          "y": 4
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "gaotang-prefecture_gaotang_adviser3",
          "name": "高唐州参謀丙",
          "shortName": "謀",
          "martial": 26,
          "command": 58,
          "intelligence": 95,
          "charisma": 48,
          "portraitKey": "mob_adviser_military_formation",
          "alias": "高唐州参謀",
          "combatSkills": [
            "なし"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "冷静・策謀的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "gaotang_sorcerer1",
        "characterId": "gaotang-prefecture_gaotang_sorcerer1",
        "army": "ENEMY",
        "position": {
          "x": 0,
          "y": 2
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "gaotang-prefecture_gaotang_sorcerer1",
          "name": "高廉食客・術士甲",
          "shortName": "術",
          "martial": 24,
          "command": 44,
          "intelligence": 75,
          "charisma": 35,
          "portraitKey": "mob_sorcerer",
          "alias": "高廉食客・術士",
          "combatSkills": [
            "なし"
          ],
          "specialAbilities": [
            "幻術"
          ],
          "personality": "冷静・策謀的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "gaotang_sorcerer2",
        "characterId": "gaotang-prefecture_gaotang_sorcerer2",
        "army": "ENEMY",
        "position": {
          "x": 7,
          "y": 2
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "gaotang-prefecture_gaotang_sorcerer2",
          "name": "高廉食客・術士乙",
          "shortName": "術",
          "martial": 24,
          "command": 44,
          "intelligence": 65,
          "charisma": 35,
          "portraitKey": "mob_sorcerer_low",
          "alias": "高廉食客・術士",
          "combatSkills": [
            "なし"
          ],
          "specialAbilities": [
            "幻術"
          ],
          "personality": "冷静・策謀的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "gaotang_sorcerer3",
        "characterId": "gaotang-prefecture_gaotang_sorcerer3",
        "army": "ENEMY",
        "position": {
          "x": 0,
          "y": 5
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "gaotang-prefecture_gaotang_sorcerer3",
          "name": "高廉食客・術士丙",
          "shortName": "術",
          "martial": 26,
          "command": 46,
          "intelligence": 55,
          "charisma": 36,
          "portraitKey": "mob_sorcerer_low",
          "alias": "高廉食客・術士",
          "combatSkills": [
            "なし"
          ],
          "specialAbilities": [
            "幻術"
          ],
          "personality": "冷静・策謀的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "gaotang_sorcerer4",
        "characterId": "gaotang-prefecture_gaotang_sorcerer4",
        "army": "ENEMY",
        "position": {
          "x": 7,
          "y": 5
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "gaotang-prefecture_gaotang_sorcerer4",
          "name": "高廉食客・術士丁",
          "shortName": "術",
          "martial": 24,
          "command": 44,
          "intelligence": 75,
          "charisma": 35,
          "portraitKey": "mob_sorcerer",
          "alias": "高廉食客・術士",
          "combatSkills": [
            "なし"
          ],
          "specialAbilities": [
            "幻術"
          ],
          "personality": "冷静・策謀的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "gaotang_sorcerer5",
        "characterId": "gaotang-prefecture_gaotang_sorcerer5",
        "army": "ENEMY",
        "position": {
          "x": 0,
          "y": 8
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "gaotang-prefecture_gaotang_sorcerer5",
          "name": "高廉食客・術士戊",
          "shortName": "術",
          "martial": 24,
          "command": 44,
          "intelligence": 65,
          "charisma": 35,
          "portraitKey": "mob_sorcerer_low",
          "alias": "高廉食客・術士",
          "combatSkills": [
            "なし"
          ],
          "specialAbilities": [
            "幻術"
          ],
          "personality": "冷静・策謀的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "gaotang_sorcerer6",
        "characterId": "gaotang-prefecture_gaotang_sorcerer6",
        "army": "ENEMY",
        "position": {
          "x": 7,
          "y": 8
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "gaotang-prefecture_gaotang_sorcerer6",
          "name": "高廉食客・術士己",
          "shortName": "術",
          "martial": 26,
          "command": 46,
          "intelligence": 55,
          "charisma": 36,
          "portraitKey": "mob_sorcerer_low",
          "alias": "高廉食客・術士",
          "combatSkills": [
            "なし"
          ],
          "specialAbilities": [
            "幻術"
          ],
          "personality": "冷静・策謀的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "gaotang_sorcerer7",
        "characterId": "gaotang-prefecture_gaotang_sorcerer7",
        "army": "ENEMY",
        "position": {
          "x": 3,
          "y": 7
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "gaotang-prefecture_gaotang_sorcerer7",
          "name": "高廉食客・術士庚",
          "shortName": "術",
          "martial": 24,
          "command": 44,
          "intelligence": 75,
          "charisma": 35,
          "portraitKey": "mob_sorcerer",
          "alias": "高廉食客・術士",
          "combatSkills": [
            "なし"
          ],
          "specialAbilities": [
            "幻術"
          ],
          "personality": "冷静・策謀的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "gaotang_sorcerer8",
        "characterId": "gaotang-prefecture_gaotang_sorcerer8",
        "army": "ENEMY",
        "position": {
          "x": 4,
          "y": 10
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "gaotang-prefecture_gaotang_sorcerer8",
          "name": "高廉食客・術士辛",
          "shortName": "術",
          "martial": 24,
          "command": 44,
          "intelligence": 65,
          "charisma": 35,
          "portraitKey": "mob_sorcerer_low",
          "alias": "高廉食客・術士",
          "combatSkills": [
            "なし"
          ],
          "specialAbilities": [
            "幻術"
          ],
          "personality": "冷静・策謀的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "gaotang_sorcerer9",
        "characterId": "gaotang-prefecture_gaotang_sorcerer9",
        "army": "ENEMY",
        "position": {
          "x": 1,
          "y": 1
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "gaotang-prefecture_gaotang_sorcerer9",
          "name": "高廉食客・術士壬",
          "shortName": "術",
          "martial": 24,
          "command": 44,
          "intelligence": 75,
          "charisma": 35,
          "portraitKey": "mob_sorcerer",
          "alias": "高廉食客・術士",
          "combatSkills": [
            "なし"
          ],
          "specialAbilities": [
            "幻術"
          ],
          "personality": "冷静・策謀的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "gaotang_sorcerer10",
        "characterId": "gaotang-prefecture_gaotang_sorcerer10",
        "army": "ENEMY",
        "position": {
          "x": 6,
          "y": 1
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "gaotang-prefecture_gaotang_sorcerer10",
          "name": "高廉食客・術士癸",
          "shortName": "術",
          "martial": 24,
          "command": 44,
          "intelligence": 65,
          "charisma": 35,
          "portraitKey": "mob_sorcerer_low",
          "alias": "高廉食客・術士",
          "combatSkills": [
            "なし"
          ],
          "specialAbilities": [
            "幻術"
          ],
          "personality": "冷静・策謀的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      }
    ],
    "intro": [
      {
        "unitId": "song_jiang_gaotang",
        "text": "柴進殿を救うため、高唐州へ総攻撃をかける。敵兵の数に惑わされず、妖術陣を一つずつ崩すぞ。"
      },
      {
        "unitId": "gongsun_sheng_gaotang",
        "text": "高廉は私が3マス以内にいない間、自身の周囲3マスへ広域幻術を放ちます。しかもその間は術力が高まり、広域幻術では使用回数を消費しません。私が3マス以内へ入れば広域幻術を封じ、通常幻術だけにできます。"
      },
      {
        "unitId": "wu_yong_gaotang",
        "text": "公孫勝殿が敗走しても戦いは続きますが、高廉の広域幻術を封じる手段を失います。飛天兵と術士を崩しつつ、公孫勝殿を高廉へ近づけるのが要です。"
      },
      {
        "unitId": "gao_lian",
        "text": "飛天神兵よ、妖気をまといて梁山泊の賊どもを打ち砕け！　この高唐州から一人も帰すな！"
      },
      {
        "unitId": "lei_heng_gaotang",
        "text": "妖術で仲間を苦しめる高廉め。俺たち全員でその妖陣を踏み破ってやる！"
      }
    ],
    "victory": [
      {
        "unitId": "lei_heng_gaotang",
        "text": "高廉、討ち取った！　妖術に頼った報いだ！"
      },
      {
        "speakerName": "柴進",
        "text": "宋江殿……これほど多くの仲間が来てくれるとは。皆の恩は忘れぬ。"
      },
      {
        "unitId": "song_jiang_gaotang",
        "text": "柴進殿を救い出した。高唐州の妖術陣は破れた。皆、梁山泊へ戻ろう。"
      }
    ]
  },
  {
    "id": "daming-prison-break",
    "chapterNumber": 8,
    "title": "第八章　大名府・獄門脱出",
    "description": "城内の追捕隊と城外の待ち伏せを突破し、川を越えて盧俊義と石秀を南の脱出地点へ導く。敵軍を全滅させても勝利となる。",
    "leader": "wu_yong_daming",
    "turnLimit": 20,
    "escape": {
      "destination": {
        "x": 3,
        "y": 15
      },
      "radius": 1,
      "unitIds": [
        "lu_junyi_daming",
        "shi_xiu_daming"
      ]
    },
    "objectiveText": "勝利：盧俊義と石秀を南の旗へ脱出、または敵軍を全滅<br>敗北：呉用・盧俊義・石秀のいずれかが敗走",
    "requiredSurvivors": [
      "lu_junyi_daming",
      "shi_xiu_daming"
    ],
    "pursuit": {
      "unitIds": [
        "liang_zhongshu",
        "li_cheng",
        "wen_da",
        "daming_captain",
        "daming_guard3",
        "daming_guard4",
        "daming_cavalry7",
        "daming_cavalry8",
        "daming_inner_cavalry1",
        "daming_inner_cavalry3",
        "daming_inner_archer1",
        "daming_inner_archer2",
        "daming_inner_cavalry4",
        "daming_inner_cavalry5"
      ],
      "gateColumns": [
        3,
        4
      ],
      "insideMaximumRow": 3,
      "outsideRow": 4,
      "candidateMinimumRow": 1,
      "priorityActorIds": [
        "daming_reinforcement_infantry_left",
        "daming_reinforcement_infantry_right"
      ]
    },
    "units": [
      {
        "id": "wu_yong_daming",
        "characterId": "wu_yong",
        "army": "PLAYER",
        "position": {
          "x": 4,
          "y": 15
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "lin_chong_daming",
        "characterId": "lin_chong",
        "army": "PLAYER",
        "position": {
          "x": 1,
          "y": 14
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "hua_rong_daming",
        "characterId": "hua_rong",
        "army": "PLAYER",
        "position": {
          "x": 2,
          "y": 14
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "qin_ming_daming",
        "characterId": "qin_ming",
        "army": "PLAYER",
        "position": {
          "x": 5,
          "y": 14
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "yang_zhi_daming",
        "characterId": "yang_zhi",
        "army": "PLAYER",
        "position": {
          "x": 6,
          "y": 14
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "dai_zong_daming",
        "characterId": "dai_zong",
        "army": "PLAYER",
        "position": {
          "x": 7,
          "y": 15
        },
        "move": 6,
        "facing": "NORTH"
      },
      {
        "id": "guan_sheng_daming",
        "characterId": "guan_sheng",
        "army": "PLAYER",
        "position": {
          "x": 0,
          "y": 15
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "sun_li_daming",
        "characterId": "sun_li",
        "army": "PLAYER",
        "position": {
          "x": 1,
          "y": 15
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "lu_junyi_daming",
        "characterId": "lu_junyi",
        "army": "PLAYER",
        "position": {
          "x": 3,
          "y": 4
        },
        "move": 4,
        "facing": "SOUTH"
      },
      {
        "id": "shi_xiu_daming",
        "characterId": "shi_xiu",
        "army": "PLAYER",
        "position": {
          "x": 4,
          "y": 4
        },
        "move": 4,
        "facing": "SOUTH"
      },
      {
        "id": "yan_qing_daming",
        "characterId": "yan_qing",
        "army": "PLAYER",
        "position": {
          "x": 2,
          "y": 4
        },
        "move": 4,
        "facing": "SOUTH"
      },
      {
        "id": "cai_fu_daming",
        "characterId": "cai_fu",
        "army": "PLAYER",
        "position": {
          "x": 1,
          "y": 4
        },
        "move": 3,
        "facing": "SOUTH"
      },
      {
        "id": "cai_qing_daming",
        "characterId": "cai_qing",
        "army": "PLAYER",
        "position": {
          "x": 5,
          "y": 4
        },
        "move": 3,
        "facing": "SOUTH"
      },
      {
        "id": "chai_jin_daming",
        "characterId": "chai_jin",
        "army": "PLAYER",
        "position": {
          "x": 0,
          "y": 4
        },
        "move": 3,
        "facing": "SOUTH"
      },
      {
        "id": "yue_he_daming",
        "characterId": "yue_he",
        "army": "PLAYER",
        "position": {
          "x": 6,
          "y": 4
        },
        "move": 3,
        "facing": "SOUTH"
      },
      {
        "id": "kong_ming_daming",
        "characterId": "kong_ming",
        "army": "PLAYER",
        "position": {
          "x": 0,
          "y": 5
        },
        "move": 3,
        "facing": "SOUTH"
      },
      {
        "id": "kong_liang_daming",
        "characterId": "kong_liang",
        "army": "PLAYER",
        "position": {
          "x": 1,
          "y": 5
        },
        "move": 3,
        "facing": "SOUTH"
      },
      {
        "id": "zou_yuan_daming",
        "characterId": "zou_yuan",
        "army": "PLAYER",
        "position": {
          "x": 6,
          "y": 5
        },
        "move": 3,
        "facing": "SOUTH"
      },
      {
        "id": "zou_run_daming",
        "characterId": "zou_run",
        "army": "PLAYER",
        "position": {
          "x": 7,
          "y": 5
        },
        "move": 3,
        "facing": "SOUTH"
      },
      {
        "id": "liang_zhongshu",
        "characterId": "liang_zhongshu",
        "army": "ENEMY",
        "position": {
          "x": 4,
          "y": 0
        },
        "move": 2,
        "facing": "SOUTH"
      },
      {
        "id": "li_cheng",
        "characterId": "li_cheng",
        "army": "ENEMY",
        "position": {
          "x": 3,
          "y": 3
        },
        "move": 4,
        "facing": "SOUTH"
      },
      {
        "id": "wen_da",
        "characterId": "wen_da",
        "army": "ENEMY",
        "position": {
          "x": 4,
          "y": 3
        },
        "move": 4,
        "facing": "SOUTH"
      },
      {
        "id": "daming_captain",
        "characterId": "daming-prison-break_daming_captain",
        "army": "ENEMY",
        "position": {
          "x": 3,
          "y": 0
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "daming-prison-break_daming_captain",
          "name": "大名府隊長",
          "shortName": "将",
          "martial": 62,
          "command": 68,
          "intelligence": 46,
          "charisma": 34,
          "portraitKey": "mob_captain_high_trust_middle",
          "alias": "大名府隊長",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "威圧的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "daming_archer1",
        "characterId": "daming-prison-break_daming_archer1",
        "army": "ENEMY",
        "position": {
          "x": 1,
          "y": 6
        },
        "move": 3,
        "facing": "NORTH",
        "mobCharacter": {
          "id": "daming-prison-break_daming_archer1",
          "name": "大名府弩兵甲",
          "shortName": "弩",
          "martial": 48,
          "command": 50,
          "intelligence": 44,
          "charisma": 24,
          "portraitKey": "mob_bow_older_normal_a",
          "alias": "大名府弩兵",
          "combatSkills": [
            "弓弩術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "慎重",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "daming_archer2",
        "characterId": "daming-prison-break_daming_archer2",
        "army": "ENEMY",
        "position": {
          "x": 6,
          "y": 6
        },
        "move": 3,
        "facing": "NORTH",
        "mobCharacter": {
          "id": "daming-prison-break_daming_archer2",
          "name": "大名府弩兵乙",
          "shortName": "弩",
          "martial": 48,
          "command": 50,
          "intelligence": 44,
          "charisma": 24,
          "portraitKey": "mob_bow_older_normal_b",
          "alias": "大名府弩兵",
          "combatSkills": [
            "弓弩術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "慎重",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "daming_guard1",
        "characterId": "daming-prison-break_daming_guard1",
        "army": "ENEMY",
        "position": {
          "x": 3,
          "y": 5
        },
        "move": 3,
        "facing": "NORTH",
        "mobCharacter": {
          "id": "daming-prison-break_daming_guard1",
          "name": "獄門守備兵甲",
          "shortName": "守",
          "martial": 52,
          "command": 60,
          "intelligence": 36,
          "charisma": 26,
          "portraitKey": "mob_infantry_older_normal_a",
          "alias": "大名府守備兵",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "慎重",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "daming_guard2",
        "characterId": "daming-prison-break_daming_guard2",
        "army": "ENEMY",
        "position": {
          "x": 4,
          "y": 5
        },
        "move": 3,
        "facing": "NORTH",
        "mobCharacter": {
          "id": "daming-prison-break_daming_guard2",
          "name": "獄門守備兵乙",
          "shortName": "守",
          "martial": 52,
          "command": 60,
          "intelligence": 36,
          "charisma": 26,
          "portraitKey": "mob_infantry_older_normal_b",
          "alias": "大名府守備兵",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "慎重",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "daming_guard3",
        "characterId": "daming-prison-break_daming_guard3",
        "army": "ENEMY",
        "position": {
          "x": 0,
          "y": 1
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "daming-prison-break_daming_guard3",
          "name": "城内守備兵甲",
          "shortName": "守",
          "martial": 52,
          "command": 60,
          "intelligence": 36,
          "charisma": 26,
          "portraitKey": "mob_infantry_older_normal_a",
          "alias": "大名府守備兵",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "慎重",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "daming_guard4",
        "characterId": "daming-prison-break_daming_guard4",
        "army": "ENEMY",
        "position": {
          "x": 7,
          "y": 1
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "daming-prison-break_daming_guard4",
          "name": "城内守備兵乙",
          "shortName": "守",
          "martial": 52,
          "command": 60,
          "intelligence": 36,
          "charisma": 26,
          "portraitKey": "mob_infantry_older_normal_b",
          "alias": "大名府守備兵",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "慎重",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "daming_cavalry7",
        "characterId": "daming-prison-break_daming_cavalry7",
        "army": "ENEMY",
        "position": {
          "x": 2,
          "y": 0
        },
        "move": 4,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "daming-prison-break_daming_cavalry7",
          "name": "大名府精鋭騎馬隊甲",
          "shortName": "精",
          "martial": 64,
          "command": 62,
          "intelligence": 38,
          "charisma": 32,
          "portraitKey": "mob_cavalry_young_strong",
          "alias": "大名府精鋭騎馬隊",
          "combatSkills": [
            "騎乗戦闘"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "daming_cavalry8",
        "characterId": "daming-prison-break_daming_cavalry8",
        "army": "ENEMY",
        "position": {
          "x": 5,
          "y": 0
        },
        "move": 4,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "daming-prison-break_daming_cavalry8",
          "name": "大名府精鋭騎馬隊乙",
          "shortName": "精",
          "martial": 63,
          "command": 61,
          "intelligence": 37,
          "charisma": 31,
          "portraitKey": "mob_cavalry_older_strong",
          "alias": "大名府精鋭騎馬隊",
          "combatSkills": [
            "騎乗戦闘"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "daming_inner_cavalry1",
        "characterId": "daming-prison-break_daming_inner_cavalry1",
        "army": "ENEMY",
        "position": {
          "x": 2,
          "y": 1
        },
        "move": 4,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "daming-prison-break_daming_inner_cavalry1",
          "name": "城内騎馬隊甲",
          "shortName": "騎",
          "martial": 60,
          "command": 60,
          "intelligence": 38,
          "charisma": 28,
          "portraitKey": "mob_cavalry_young_strong",
          "alias": "大名府騎馬隊",
          "combatSkills": [
            "騎乗戦闘"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "daming_inner_cavalry3",
        "characterId": "daming-prison-break_daming_inner_cavalry3",
        "army": "ENEMY",
        "position": {
          "x": 3,
          "y": 1
        },
        "move": 4,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "daming-prison-break_daming_inner_cavalry3",
          "name": "城内騎馬隊丙",
          "shortName": "騎",
          "martial": 60,
          "command": 60,
          "intelligence": 38,
          "charisma": 28,
          "portraitKey": "mob_cavalry_young_strong",
          "alias": "大名府騎馬隊",
          "combatSkills": [
            "騎乗戦闘"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "daming_inner_cavalry5",
        "characterId": "daming-prison-break_daming_inner_cavalry5",
        "army": "ENEMY",
        "position": {
          "x": 4,
          "y": 1
        },
        "move": 4,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "daming-prison-break_daming_inner_cavalry5",
          "name": "城内騎馬隊戊",
          "shortName": "騎",
          "martial": 60,
          "command": 60,
          "intelligence": 38,
          "charisma": 28,
          "portraitKey": "mob_cavalry_older_normal_b",
          "alias": "大名府騎馬隊",
          "combatSkills": [
            "騎乗戦闘"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "daming_inner_cavalry4",
        "characterId": "daming-prison-break_daming_inner_cavalry4",
        "army": "ENEMY",
        "position": {
          "x": 5,
          "y": 1
        },
        "move": 4,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "daming-prison-break_daming_inner_cavalry4",
          "name": "城内騎馬隊丁",
          "shortName": "騎",
          "martial": 60,
          "command": 60,
          "intelligence": 38,
          "charisma": 28,
          "portraitKey": "mob_cavalry_older_normal_b",
          "alias": "大名府騎馬隊",
          "combatSkills": [
            "騎乗戦闘"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "daming_inner_archer1",
        "characterId": "daming-prison-break_daming_inner_archer1",
        "army": "ENEMY",
        "position": {
          "x": 3,
          "y": 2
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "daming-prison-break_daming_inner_archer1",
          "name": "門内弩隊甲",
          "shortName": "弩",
          "martial": 48,
          "command": 50,
          "intelligence": 44,
          "charisma": 24,
          "portraitKey": "mob_bow_young_normal_a",
          "alias": "大名府門内弩隊",
          "combatSkills": [
            "弓弩術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "慎重・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "daming_inner_archer2",
        "characterId": "daming-prison-break_daming_inner_archer2",
        "army": "ENEMY",
        "position": {
          "x": 4,
          "y": 2
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "daming-prison-break_daming_inner_archer2",
          "name": "門内弩隊乙",
          "shortName": "弩",
          "martial": 48,
          "command": 50,
          "intelligence": 44,
          "charisma": 24,
          "portraitKey": "mob_bow_older_normal_b",
          "alias": "大名府門内弩隊",
          "combatSkills": [
            "弓弩術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "慎重・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "daming_guard5",
        "characterId": "daming-prison-break_daming_guard5",
        "army": "ENEMY",
        "position": {
          "x": 3,
          "y": 6
        },
        "move": 3,
        "facing": "NORTH",
        "mobCharacter": {
          "id": "daming-prison-break_daming_guard5",
          "name": "大名府守備兵丙",
          "shortName": "守",
          "martial": 54,
          "command": 62,
          "intelligence": 38,
          "charisma": 28,
          "portraitKey": "mob_infantry_young_strong",
          "alias": "大名府守備兵",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "実直・慎重",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "daming_guard6",
        "characterId": "daming-prison-break_daming_guard6",
        "army": "ENEMY",
        "position": {
          "x": 4,
          "y": 6
        },
        "move": 3,
        "facing": "NORTH",
        "mobCharacter": {
          "id": "daming-prison-break_daming_guard6",
          "name": "大名府守備兵丁",
          "shortName": "守",
          "martial": 54,
          "command": 62,
          "intelligence": 38,
          "charisma": 28,
          "portraitKey": "mob_infantry_older_strong",
          "alias": "大名府守備兵",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "実直・慎重",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "daming_captain2",
        "characterId": "daming-prison-break_daming_captain2",
        "army": "ENEMY",
        "position": {
          "x": 3,
          "y": 7
        },
        "move": 3,
        "facing": "NORTH",
        "mobCharacter": {
          "id": "daming-prison-break_daming_captain2",
          "name": "大名府隊長乙",
          "shortName": "将",
          "martial": 62,
          "command": 68,
          "intelligence": 46,
          "charisma": 34,
          "portraitKey": "mob_captain_high_trust_middle",
          "alias": "大名府隊長",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "威圧的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "daming_captain3",
        "characterId": "daming-prison-break_daming_captain3",
        "army": "ENEMY",
        "position": {
          "x": 4,
          "y": 7
        },
        "move": 3,
        "facing": "NORTH",
        "mobCharacter": {
          "id": "daming-prison-break_daming_captain3",
          "name": "大名府隊長丙",
          "shortName": "将",
          "martial": 62,
          "command": 68,
          "intelligence": 46,
          "charisma": 34,
          "portraitKey": "mob_captain_standard_middle",
          "alias": "大名府隊長",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "実直・指揮的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "daming_adviser2",
        "characterId": "daming-prison-break_daming_adviser2",
        "army": "ENEMY",
        "position": {
          "x": 3,
          "y": 8
        },
        "move": 3,
        "facing": "NORTH",
        "mobCharacter": {
          "id": "daming-prison-break_daming_adviser2",
          "name": "大名府参謀乙",
          "shortName": "謀",
          "martial": 24,
          "command": 58,
          "intelligence": 92,
          "charisma": 46,
          "portraitKey": "mob_adviser_civil_negotiation",
          "alias": "大名府参謀",
          "combatSkills": [
            "なし"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "冷静・策謀的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "daming_adviser",
        "characterId": "daming-prison-break_daming_adviser",
        "army": "ENEMY",
        "position": {
          "x": 4,
          "y": 8
        },
        "move": 3,
        "facing": "NORTH",
        "mobCharacter": {
          "id": "daming-prison-break_daming_adviser",
          "name": "大名府参謀",
          "shortName": "謀",
          "martial": 24,
          "command": 58,
          "intelligence": 92,
          "charisma": 46,
          "portraitKey": "mob_adviser_civil_negotiation",
          "alias": "大名府参謀",
          "combatSkills": [
            "なし"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "冷静・策謀的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "daming_archer3",
        "characterId": "daming-prison-break_daming_archer3",
        "army": "ENEMY",
        "position": {
          "x": 1,
          "y": 8
        },
        "move": 3,
        "facing": "NORTH",
        "mobCharacter": {
          "id": "daming-prison-break_daming_archer3",
          "name": "大名府弩兵丙",
          "shortName": "弩",
          "martial": 48,
          "command": 50,
          "intelligence": 44,
          "charisma": 24,
          "portraitKey": "mob_bow_young_normal_a",
          "alias": "大名府弩兵",
          "combatSkills": [
            "弓弩術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "慎重",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "daming_archer4",
        "characterId": "daming-prison-break_daming_archer4",
        "army": "ENEMY",
        "position": {
          "x": 7,
          "y": 8
        },
        "move": 3,
        "facing": "NORTH",
        "mobCharacter": {
          "id": "daming-prison-break_daming_archer4",
          "name": "大名府弩兵丁",
          "shortName": "弩",
          "martial": 48,
          "command": 50,
          "intelligence": 44,
          "charisma": 24,
          "portraitKey": "mob_bow_young_normal_b",
          "alias": "大名府弩兵",
          "combatSkills": [
            "弓弩術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "慎重",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "daming_soldier1",
        "characterId": "daming-prison-break_daming_soldier1",
        "army": "ENEMY",
        "position": {
          "x": 3,
          "y": 10
        },
        "move": 3,
        "facing": "NORTH",
        "mobCharacter": {
          "id": "daming-prison-break_daming_soldier1",
          "name": "大名府官兵甲",
          "shortName": "甲",
          "martial": 50,
          "command": 54,
          "intelligence": 34,
          "charisma": 24,
          "portraitKey": "mob_infantry_young_normal_a",
          "alias": "大名府官兵",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "実直",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "daming_soldier2",
        "characterId": "daming-prison-break_daming_soldier2",
        "army": "ENEMY",
        "position": {
          "x": 4,
          "y": 10
        },
        "move": 3,
        "facing": "NORTH",
        "mobCharacter": {
          "id": "daming-prison-break_daming_soldier2",
          "name": "大名府官兵乙",
          "shortName": "乙",
          "martial": 50,
          "command": 54,
          "intelligence": 34,
          "charisma": 24,
          "portraitKey": "mob_infantry_young_normal_b",
          "alias": "大名府官兵",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "実直",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "daming_cavalry1",
        "characterId": "daming-prison-break_daming_cavalry1",
        "army": "ENEMY",
        "position": {
          "x": 2,
          "y": 9
        },
        "move": 4,
        "facing": "NORTH",
        "mobCharacter": {
          "id": "daming-prison-break_daming_cavalry1",
          "name": "大名府騎兵甲",
          "shortName": "騎",
          "martial": 60,
          "command": 60,
          "intelligence": 38,
          "charisma": 28,
          "portraitKey": "mob_cavalry_older_normal_b",
          "alias": "大名府騎兵",
          "combatSkills": [
            "騎乗戦闘"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "daming_cavalry2",
        "characterId": "daming-prison-break_daming_cavalry2",
        "army": "ENEMY",
        "position": {
          "x": 5,
          "y": 9
        },
        "move": 4,
        "facing": "NORTH",
        "mobCharacter": {
          "id": "daming-prison-break_daming_cavalry2",
          "name": "大名府騎兵乙",
          "shortName": "騎",
          "martial": 60,
          "command": 60,
          "intelligence": 38,
          "charisma": 28,
          "portraitKey": "mob_cavalry_young_strong",
          "alias": "大名府騎兵",
          "combatSkills": [
            "騎乗戦闘"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "daming_front_infantry_left",
        "characterId": "daming-prison-break_daming_front_infantry_left",
        "army": "ENEMY",
        "position": {
          "x": 1,
          "y": 10
        },
        "move": 3,
        "facing": "NORTH",
        "mobCharacter": {
          "id": "daming-prison-break_daming_front_infantry_left",
          "name": "大名府前衛歩兵隊甲",
          "shortName": "歩",
          "martial": 50,
          "command": 54,
          "intelligence": 34,
          "charisma": 24,
          "portraitKey": "mob_infantry_young_normal_a",
          "alias": "大名府前衛歩兵隊",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "実直",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "daming_front_infantry_right",
        "characterId": "daming-prison-break_daming_front_infantry_right",
        "army": "ENEMY",
        "position": {
          "x": 6,
          "y": 10
        },
        "move": 3,
        "facing": "NORTH",
        "mobCharacter": {
          "id": "daming-prison-break_daming_front_infantry_right",
          "name": "大名府前衛歩兵隊乙",
          "shortName": "歩",
          "martial": 50,
          "command": 54,
          "intelligence": 34,
          "charisma": 24,
          "portraitKey": "mob_infantry_older_normal_a",
          "alias": "大名府前衛歩兵隊",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "実直",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "daming_gate_ambush_left",
        "characterId": "daming-prison-break_daming_gate_ambush_left",
        "army": "ENEMY",
        "position": {
          "x": 1,
          "y": 7
        },
        "move": 3,
        "facing": "NORTH",
        "mobCharacter": {
          "id": "daming-prison-break_daming_gate_ambush_left",
          "name": "大名府歩兵隊丙",
          "shortName": "歩",
          "martial": 50,
          "command": 56,
          "intelligence": 34,
          "charisma": 24,
          "portraitKey": "mob_infantry_young_normal_b",
          "alias": "大名府歩兵隊",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "実直",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "daming_gate_ambush_right",
        "characterId": "daming-prison-break_daming_gate_ambush_right",
        "army": "ENEMY",
        "position": {
          "x": 6,
          "y": 7
        },
        "move": 3,
        "facing": "NORTH",
        "mobCharacter": {
          "id": "daming-prison-break_daming_gate_ambush_right",
          "name": "大名府歩兵隊丁",
          "shortName": "歩",
          "martial": 50,
          "command": 56,
          "intelligence": 34,
          "charisma": 24,
          "portraitKey": "mob_infantry_older_normal_b",
          "alias": "大名府歩兵隊",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "実直",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "daming_street_blocker_left",
        "characterId": "daming-prison-break_daming_street_blocker_left",
        "army": "ENEMY",
        "position": {
          "x": 2,
          "y": 8
        },
        "move": 3,
        "facing": "NORTH",
        "mobCharacter": {
          "id": "daming-prison-break_daming_street_blocker_left",
          "name": "大名府歩兵隊戊",
          "shortName": "歩",
          "martial": 52,
          "command": 58,
          "intelligence": 34,
          "charisma": 24,
          "portraitKey": "mob_infantry_young_normal_a",
          "alias": "大名府歩兵隊",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "慎重",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "daming_street_blocker_right",
        "characterId": "daming-prison-break_daming_street_blocker_right",
        "army": "ENEMY",
        "position": {
          "x": 5,
          "y": 8
        },
        "move": 3,
        "facing": "NORTH",
        "mobCharacter": {
          "id": "daming-prison-break_daming_street_blocker_right",
          "name": "大名府歩兵隊己",
          "shortName": "歩",
          "martial": 52,
          "command": 58,
          "intelligence": 34,
          "charisma": 24,
          "portraitKey": "mob_infantry_older_normal_a",
          "alias": "大名府歩兵隊",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "慎重",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "daming_reinforcement_infantry_left",
        "characterId": "daming-prison-break_daming_reinforcement_infantry_left",
        "army": "ENEMY",
        "position": {
          "x": 0,
          "y": 9
        },
        "move": 3,
        "facing": "NORTH",
        "mobCharacter": {
          "id": "daming-prison-break_daming_reinforcement_infantry_left",
          "name": "大名府歩兵隊庚",
          "shortName": "歩",
          "martial": 50,
          "command": 54,
          "intelligence": 34,
          "charisma": 24,
          "portraitKey": "mob_infantry_young_normal_b",
          "alias": "大名府歩兵隊",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "実直",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "daming_reinforcement_infantry_right",
        "characterId": "daming-prison-break_daming_reinforcement_infantry_right",
        "army": "ENEMY",
        "position": {
          "x": 7,
          "y": 9
        },
        "move": 3,
        "facing": "NORTH",
        "mobCharacter": {
          "id": "daming-prison-break_daming_reinforcement_infantry_right",
          "name": "大名府歩兵隊辛",
          "shortName": "歩",
          "martial": 50,
          "command": 54,
          "intelligence": 34,
          "charisma": 24,
          "portraitKey": "mob_infantry_older_normal_b",
          "alias": "大名府歩兵隊",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "実直",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      }
    ],
    "intro": [
      {
        "speakerName": "物語",
        "text": "高唐州攻略後、梁山泊は勢力を広げた。だが曾頭市との戦いで晁蓋は凶矢に倒れ、帰らぬ人となった。"
      },
      {
        "speakerName": "物語",
        "text": "晁蓋の遺志を継ぐため、宋江と呉用は河北の豪傑・盧俊義を迎えようとした。しかし盧俊義は大名府で捕らえられ、石秀とともに処刑を待つ身となっていた――。"
      },
      {
        "unitId": "wu_yong_daming",
        "text": "宋江殿は傷を養っておられます。今宵、時遷が翠雲楼に火を放すのを合図に城内外から攻め、盧員外と石秀を救い出します。"
      },
      {
        "speakerName": "物語",
        "text": "呼延灼・李逵ら別路の軍勢も、各門と街道で官軍を引きつけている。獄門前では、脱出隊と外部救援隊が合流を目指していた。"
      },
      {
        "unitId": "shi_xiu_daming",
        "text": "盧員外、今こそ獄門を破る時です。川向こうに梁山泊の旗が見えます！"
      },
      {
        "unitId": "lu_junyi_daming",
        "text": "皆の恩に報いるためにも、必ずこの包囲を抜けて梁山泊へ向かう。"
      },
      {
        "unitId": "yan_qing_daming",
        "text": "私は水門側から潜り込みました。城門外の街道には伏兵がいます。左右へ回り、川を越えましょう。"
      },
      {
        "unitId": "liang_zhongshu",
        "text": "梁山泊の賊を一人も逃がすな！　李成、聞達、城門と橋を固めよ！"
      }
    ],
    "victory": [
      {
        "unitId": "yan_qing_daming",
        "text": "主人、石秀殿、ここまで来れば追手を振り切れます。"
      },
      {
        "unitId": "lu_junyi_daming",
        "text": "この命、今後は梁山泊のために使おう。宋江殿にも、皆にも、必ず恩を返す。"
      },
      {
        "unitId": "wu_yong_daming",
        "text": "救出は成功です。追手が集まる前に大名府を離れ、梁山泊へ戻りましょう。"
      },
      {
        "speakerName": "物語",
        "text": "こうして盧俊義は梁山泊へ迎えられ、晁蓋の仇・史文恭との決戦へ向かうことになる。"
      }
    ]
  },
  {
    "id": "zengtou-fortress",
    "chapterNumber": 9,
    "title": "第九章　曾頭市・宿命の決戦",
    "description": "曾頭市軍を寨外の広い平地へ引き出し、北西・北・北東と南方に展開した梁山泊軍を再結集しながら敵大軍を殲滅する総力戦。",
    "leader": "song_jiang_zengtou",
    "turnLimit": 20,
    "escape": null,
    "objectiveText": "勝利：曾頭市軍を全滅<br>敗北：宋江または盧俊義が敗走",
    "requiredSurvivors": [
      "lu_junyi_zengtou"
    ],
    "defection": {
      "turn": 6,
      "unitIds": [
        "yu_baosi"
      ],
      "arrival": [
        {
          "unitId": "yu_baosi",
          "text": "曾頭市にはこれ以上従えぬ。郁保四、これより梁山泊へ加勢する！",
          "actionLabel": "寝返り"
        },
        {
          "unitId": "wu_yong_zengtou",
          "text": "よし。その位置から敵陣を乱してくれ。本隊も呼応して押し上げる。"
        }
      ]
    },
    "relief": {
      "requiredDefeatedUnitIds": [
        "qin_ming_zengtou"
      ],
      "arrival": [
        {
          "unitId": "song_jiang_zengtou",
          "text": "秦明は重傷を負い戦線を離れた。だが梁山泊から新たな援軍が到着したぞ！"
        },
        {
          "unitId": "guan_sheng_zengtou",
          "text": "関勝、救援に参った。秦明の分までこの戦線を支える。",
          "actionLabel": "味方救援"
        },
        {
          "unitId": "xu_ning_zengtou",
          "text": "徐寧も参戦する。敵の騎兵は私に任せてもらおう。"
        },
        {
          "unitId": "shan_tinggui_zengtou",
          "text": "単廷珪、到着した。水計を使う機会があれば崩してみせよう。"
        },
        {
          "unitId": "wei_dingguo_zengtou",
          "text": "魏定国も来たぞ。火計で敵陣を焼き崩してやる。"
        }
      ]
    },
    "units": [
      {
        "id": "yang_zhi_zengtou",
        "characterId": "yang_zhi",
        "army": "PLAYER",
        "position": {
          "x": 3,
          "y": 0
        },
        "move": 4,
        "facing": "SOUTH"
      },
      {
        "id": "shi_jin_zengtou",
        "characterId": "shi_jin",
        "army": "PLAYER",
        "position": {
          "x": 4,
          "y": 0
        },
        "move": 4,
        "facing": "SOUTH"
      },
      {
        "id": "yang_chun_zengtou",
        "characterId": "yang_chun",
        "army": "PLAYER",
        "position": {
          "x": 3,
          "y": 1
        },
        "move": 4,
        "facing": "SOUTH"
      },
      {
        "id": "chen_da_zengtou",
        "characterId": "chen_da",
        "army": "PLAYER",
        "position": {
          "x": 4,
          "y": 1
        },
        "move": 4,
        "facing": "SOUTH"
      },
      {
        "id": "lu_junyi_zengtou",
        "characterId": "lu_junyi",
        "army": "PLAYER",
        "position": {
          "x": 0,
          "y": 0
        },
        "move": 4,
        "facing": "SOUTH"
      },
      {
        "id": "yan_qing_zengtou",
        "characterId": "yan_qing",
        "army": "PLAYER",
        "position": {
          "x": 0,
          "y": 1
        },
        "move": 4,
        "facing": "SOUTH"
      },
      {
        "id": "zhu_tong_zengtou",
        "characterId": "zhu_tong",
        "army": "PLAYER",
        "position": {
          "x": 1,
          "y": 1
        },
        "move": 4,
        "facing": "EAST"
      },
      {
        "id": "lei_heng_zengtou",
        "characterId": "lei_heng",
        "army": "PLAYER",
        "position": {
          "x": 2,
          "y": 1
        },
        "move": 4,
        "facing": "EAST"
      },
      {
        "id": "zou_yuan_zengtou",
        "characterId": "zou_yuan",
        "army": "PLAYER",
        "position": {
          "x": 1,
          "y": 2
        },
        "move": 3,
        "facing": "EAST"
      },
      {
        "id": "zou_run_zengtou",
        "characterId": "zou_run",
        "army": "PLAYER",
        "position": {
          "x": 2,
          "y": 2
        },
        "move": 3,
        "facing": "EAST"
      },
      {
        "id": "lu_zhishen_zengtou",
        "characterId": "lu_zhishen",
        "army": "PLAYER",
        "position": {
          "x": 5,
          "y": 1
        },
        "move": 3,
        "facing": "WEST"
      },
      {
        "id": "wu_song_zengtou",
        "characterId": "wu_song",
        "army": "PLAYER",
        "position": {
          "x": 6,
          "y": 1
        },
        "move": 4,
        "facing": "WEST"
      },
      {
        "id": "kong_ming_zengtou",
        "characterId": "kong_ming",
        "army": "PLAYER",
        "position": {
          "x": 5,
          "y": 2
        },
        "move": 3,
        "facing": "WEST"
      },
      {
        "id": "kong_liang_zengtou",
        "characterId": "kong_liang",
        "army": "PLAYER",
        "position": {
          "x": 6,
          "y": 2
        },
        "move": 3,
        "facing": "WEST"
      },
      {
        "id": "hua_rong_zengtou",
        "characterId": "hua_rong",
        "army": "PLAYER",
        "position": {
          "x": 2,
          "y": 15
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "qin_ming_zengtou",
        "characterId": "qin_ming",
        "army": "PLAYER",
        "position": {
          "x": 3,
          "y": 15
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "ma_lin_zengtou",
        "characterId": "ma_lin",
        "army": "PLAYER",
        "position": {
          "x": 4,
          "y": 15
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "deng_fei_zengtou",
        "characterId": "deng_fei",
        "army": "PLAYER",
        "position": {
          "x": 5,
          "y": 15
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "lu_fang_zengtou",
        "characterId": "lu_fang",
        "army": "PLAYER",
        "position": {
          "x": 2,
          "y": 17
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "guo_sheng_zengtou",
        "characterId": "guo_sheng",
        "army": "PLAYER",
        "position": {
          "x": 3,
          "y": 17
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "xie_zhen_zengtou",
        "characterId": "xie_zhen",
        "army": "PLAYER",
        "position": {
          "x": 4,
          "y": 17
        },
        "move": 3,
        "facing": "NORTH"
      },
      {
        "id": "xie_bao_zengtou",
        "characterId": "xie_bao",
        "army": "PLAYER",
        "position": {
          "x": 5,
          "y": 17
        },
        "move": 3,
        "facing": "NORTH"
      },
      {
        "id": "dai_zong_zengtou",
        "characterId": "dai_zong",
        "army": "PLAYER",
        "position": {
          "x": 1,
          "y": 18
        },
        "move": 6,
        "facing": "NORTH"
      },
      {
        "id": "shi_qian_zengtou",
        "characterId": "shi_qian",
        "army": "PLAYER",
        "position": {
          "x": 2,
          "y": 18
        },
        "move": 5,
        "facing": "NORTH"
      },
      {
        "id": "song_jiang_zengtou",
        "characterId": "song_jiang",
        "army": "PLAYER",
        "position": {
          "x": 3,
          "y": 18
        },
        "move": 3,
        "facing": "NORTH"
      },
      {
        "id": "wu_yong_zengtou",
        "characterId": "wu_yong",
        "army": "PLAYER",
        "position": {
          "x": 4,
          "y": 18
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "gongsun_sheng_zengtou",
        "characterId": "gongsun_sheng",
        "army": "PLAYER",
        "position": {
          "x": 5,
          "y": 18
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "li_kui_zengtou",
        "characterId": "li_kui",
        "army": "PLAYER",
        "position": {
          "x": 2,
          "y": 19
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "fan_rui_zengtou",
        "characterId": "fan_rui",
        "army": "PLAYER",
        "position": {
          "x": 3,
          "y": 19
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "xiang_chong_zengtou",
        "characterId": "xiang_chong",
        "army": "PLAYER",
        "position": {
          "x": 4,
          "y": 19
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "li_gun_zengtou",
        "characterId": "li_gun",
        "army": "PLAYER",
        "position": {
          "x": 5,
          "y": 19
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "zeng_nong",
        "characterId": "zeng_nong",
        "army": "ENEMY",
        "position": {
          "x": 4,
          "y": 5
        },
        "move": 2,
        "facing": "SOUTH"
      },
      {
        "id": "su_ding",
        "characterId": "su_ding",
        "army": "ENEMY",
        "position": {
          "x": 3,
          "y": 6
        },
        "move": 4,
        "facing": "SOUTH"
      },
      {
        "id": "zeng_tu",
        "characterId": "zeng_tu",
        "army": "ENEMY",
        "position": {
          "x": 2,
          "y": 7
        },
        "move": 4,
        "facing": "SOUTH"
      },
      {
        "id": "zeng_mi",
        "characterId": "zeng_mi",
        "army": "ENEMY",
        "position": {
          "x": 5,
          "y": 7
        },
        "move": 4,
        "facing": "SOUTH"
      },
      {
        "id": "zeng_kui",
        "characterId": "zeng_kui",
        "army": "ENEMY",
        "position": {
          "x": 6,
          "y": 8
        },
        "move": 4,
        "facing": "WEST"
      },
      {
        "id": "zeng_suo",
        "characterId": "zeng_suo",
        "army": "ENEMY",
        "position": {
          "x": 1,
          "y": 8
        },
        "move": 4,
        "facing": "EAST"
      },
      {
        "id": "zeng_sheng",
        "characterId": "zeng_sheng",
        "army": "ENEMY",
        "position": {
          "x": 4,
          "y": 9
        },
        "move": 4,
        "facing": "NORTH"
      },
      {
        "id": "yu_baosi",
        "characterId": "yu_baosi",
        "army": "ENEMY",
        "position": {
          "x": 3,
          "y": 10
        },
        "move": 3,
        "facing": "NORTH"
      },
      {
        "id": "shi_wengong",
        "characterId": "shi_wengong",
        "army": "ENEMY",
        "position": {
          "x": 4,
          "y": 12
        },
        "move": 4,
        "facing": "SOUTH"
      },
      {
        "id": "zengtou_field_01",
        "characterId": "zengtou-fortress_zengtou_field_01",
        "army": "ENEMY",
        "position": {
          "x": 2,
          "y": 4
        },
        "move": 4,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "zengtou-fortress_zengtou_field_01",
          "name": "曾頭市精鋭騎兵01",
          "shortName": "精",
          "martial": 70,
          "command": 72,
          "intelligence": 46,
          "charisma": 36,
          "portraitKey": "zengtou_cavalry_very_strong",
          "alias": "曾頭市精鋭騎兵",
          "combatSkills": [
            "騎乗戦闘"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zengtou_field_02",
        "characterId": "zengtou-fortress_zengtou_field_02",
        "army": "ENEMY",
        "position": {
          "x": 3,
          "y": 4
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "zengtou-fortress_zengtou_field_02",
          "name": "曾頭市歩兵隊02",
          "shortName": "歩",
          "martial": 58,
          "command": 64,
          "intelligence": 40,
          "charisma": 32,
          "portraitKey": "zengtou_infantry_older_strong",
          "alias": "曾頭市歩兵",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zengtou_field_03",
        "characterId": "zengtou-fortress_zengtou_field_03",
        "army": "ENEMY",
        "position": {
          "x": 4,
          "y": 4
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "zengtou-fortress_zengtou_field_03",
          "name": "曾頭市弩兵隊03",
          "shortName": "弩",
          "martial": 56,
          "command": 60,
          "intelligence": 52,
          "charisma": 30,
          "portraitKey": "zengtou_bow_older_strong",
          "alias": "曾頭市弩兵",
          "combatSkills": [
            "弓弩術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zengtou_field_04",
        "characterId": "zengtou-fortress_zengtou_field_04",
        "army": "ENEMY",
        "position": {
          "x": 7,
          "y": 4
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "zengtou-fortress_zengtou_field_04",
          "name": "曾頭市歩兵隊04",
          "shortName": "歩",
          "martial": 58,
          "command": 64,
          "intelligence": 40,
          "charisma": 32,
          "portraitKey": "zengtou_infantry_older_strong",
          "alias": "曾頭市歩兵",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zengtou_field_05",
        "characterId": "zengtou-fortress_zengtou_field_05",
        "army": "ENEMY",
        "position": {
          "x": 1,
          "y": 5
        },
        "move": 4,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "zengtou-fortress_zengtou_field_05",
          "name": "曾頭市精鋭騎兵05",
          "shortName": "精",
          "martial": 70,
          "command": 72,
          "intelligence": 46,
          "charisma": 36,
          "portraitKey": "zengtou_cavalry_very_strong",
          "alias": "曾頭市精鋭騎兵",
          "combatSkills": [
            "騎乗戦闘"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zengtou_field_06",
        "characterId": "zengtou-fortress_zengtou_field_06",
        "army": "ENEMY",
        "position": {
          "x": 2,
          "y": 5
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "zengtou-fortress_zengtou_field_06",
          "name": "曾頭市歩兵隊06",
          "shortName": "歩",
          "martial": 58,
          "command": 64,
          "intelligence": 40,
          "charisma": 32,
          "portraitKey": "zengtou_infantry_older_strong",
          "alias": "曾頭市歩兵",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zengtou_field_07",
        "characterId": "zengtou-fortress_zengtou_field_07",
        "army": "ENEMY",
        "position": {
          "x": 3,
          "y": 5
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "zengtou-fortress_zengtou_field_07",
          "name": "曾頭市弩兵隊07",
          "shortName": "弩",
          "martial": 56,
          "command": 60,
          "intelligence": 52,
          "charisma": 30,
          "portraitKey": "zengtou_bow_older_strong",
          "alias": "曾頭市弩兵",
          "combatSkills": [
            "弓弩術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zengtou_field_08",
        "characterId": "zengtou-fortress_zengtou_field_08",
        "army": "ENEMY",
        "position": {
          "x": 5,
          "y": 5
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "zengtou-fortress_zengtou_field_08",
          "name": "曾頭市歩兵隊08",
          "shortName": "歩",
          "martial": 58,
          "command": 64,
          "intelligence": 40,
          "charisma": 32,
          "portraitKey": "zengtou_infantry_older_strong",
          "alias": "曾頭市歩兵",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zengtou_field_09",
        "characterId": "zengtou-fortress_zengtou_field_09",
        "army": "ENEMY",
        "position": {
          "x": 6,
          "y": 5
        },
        "move": 4,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "zengtou-fortress_zengtou_field_09",
          "name": "曾頭市騎兵隊09",
          "shortName": "騎",
          "martial": 64,
          "command": 68,
          "intelligence": 42,
          "charisma": 34,
          "portraitKey": "zengtou_cavalry_young_strong",
          "alias": "曾頭市騎兵",
          "combatSkills": [
            "騎乗戦闘"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zengtou_field_10",
        "characterId": "zengtou-fortress_zengtou_field_10",
        "army": "ENEMY",
        "position": {
          "x": 1,
          "y": 6
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "zengtou-fortress_zengtou_field_10",
          "name": "曾頭市歩兵隊10",
          "shortName": "歩",
          "martial": 58,
          "command": 64,
          "intelligence": 40,
          "charisma": 32,
          "portraitKey": "zengtou_infantry_older_strong",
          "alias": "曾頭市歩兵",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zengtou_field_11",
        "characterId": "zengtou-fortress_zengtou_field_11",
        "army": "ENEMY",
        "position": {
          "x": 2,
          "y": 6
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "zengtou-fortress_zengtou_field_11",
          "name": "曾頭市弩兵隊11",
          "shortName": "弩",
          "martial": 56,
          "command": 60,
          "intelligence": 52,
          "charisma": 30,
          "portraitKey": "zengtou_bow_older_strong",
          "alias": "曾頭市弩兵",
          "combatSkills": [
            "弓弩術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zengtou_field_12",
        "characterId": "zengtou-fortress_zengtou_field_12",
        "army": "ENEMY",
        "position": {
          "x": 4,
          "y": 6
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "zengtou-fortress_zengtou_field_12",
          "name": "曾頭市歩兵隊12",
          "shortName": "歩",
          "martial": 58,
          "command": 64,
          "intelligence": 40,
          "charisma": 32,
          "portraitKey": "zengtou_infantry_older_strong",
          "alias": "曾頭市歩兵",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zengtou_field_13",
        "characterId": "zengtou-fortress_zengtou_field_13",
        "army": "ENEMY",
        "position": {
          "x": 5,
          "y": 6
        },
        "move": 4,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "zengtou-fortress_zengtou_field_13",
          "name": "曾頭市騎兵隊13",
          "shortName": "騎",
          "martial": 64,
          "command": 68,
          "intelligence": 42,
          "charisma": 34,
          "portraitKey": "zengtou_cavalry_young_strong",
          "alias": "曾頭市騎兵",
          "combatSkills": [
            "騎乗戦闘"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zengtou_field_14",
        "characterId": "zengtou-fortress_zengtou_field_14",
        "army": "ENEMY",
        "position": {
          "x": 6,
          "y": 6
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "zengtou-fortress_zengtou_field_14",
          "name": "曾頭市歩兵隊14",
          "shortName": "歩",
          "martial": 58,
          "command": 64,
          "intelligence": 40,
          "charisma": 32,
          "portraitKey": "zengtou_infantry_older_strong",
          "alias": "曾頭市歩兵",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zengtou_field_15",
        "characterId": "zengtou-fortress_zengtou_field_15",
        "army": "ENEMY",
        "position": {
          "x": 0,
          "y": 7
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "zengtou-fortress_zengtou_field_15",
          "name": "曾頭市弩兵隊15",
          "shortName": "弩",
          "martial": 56,
          "command": 60,
          "intelligence": 52,
          "charisma": 30,
          "portraitKey": "zengtou_bow_older_strong",
          "alias": "曾頭市弩兵",
          "combatSkills": [
            "弓弩術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zengtou_field_16",
        "characterId": "zengtou-fortress_zengtou_field_16",
        "army": "ENEMY",
        "position": {
          "x": 1,
          "y": 7
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "zengtou-fortress_zengtou_field_16",
          "name": "曾頭市歩兵隊16",
          "shortName": "歩",
          "martial": 58,
          "command": 64,
          "intelligence": 40,
          "charisma": 32,
          "portraitKey": "zengtou_infantry_older_strong",
          "alias": "曾頭市歩兵",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zengtou_field_17",
        "characterId": "zengtou-fortress_zengtou_field_17",
        "army": "ENEMY",
        "position": {
          "x": 3,
          "y": 7
        },
        "move": 4,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "zengtou-fortress_zengtou_field_17",
          "name": "曾頭市騎兵隊17",
          "shortName": "騎",
          "martial": 64,
          "command": 68,
          "intelligence": 42,
          "charisma": 34,
          "portraitKey": "zengtou_cavalry_young_strong",
          "alias": "曾頭市騎兵",
          "combatSkills": [
            "騎乗戦闘"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zengtou_field_18",
        "characterId": "zengtou-fortress_zengtou_field_18",
        "army": "ENEMY",
        "position": {
          "x": 4,
          "y": 7
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "zengtou-fortress_zengtou_field_18",
          "name": "曾頭市歩兵隊18",
          "shortName": "歩",
          "martial": 58,
          "command": 64,
          "intelligence": 40,
          "charisma": 32,
          "portraitKey": "zengtou_infantry_older_strong",
          "alias": "曾頭市歩兵",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zengtou_field_19",
        "characterId": "zengtou-fortress_zengtou_field_19",
        "army": "ENEMY",
        "position": {
          "x": 6,
          "y": 7
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "zengtou-fortress_zengtou_field_19",
          "name": "曾頭市弩兵隊19",
          "shortName": "弩",
          "martial": 56,
          "command": 60,
          "intelligence": 52,
          "charisma": 30,
          "portraitKey": "zengtou_bow_older_strong",
          "alias": "曾頭市弩兵",
          "combatSkills": [
            "弓弩術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zengtou_field_20",
        "characterId": "zengtou-fortress_zengtou_field_20",
        "army": "ENEMY",
        "position": {
          "x": 7,
          "y": 7
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "zengtou-fortress_zengtou_field_20",
          "name": "曾頭市歩兵隊20",
          "shortName": "歩",
          "martial": 58,
          "command": 64,
          "intelligence": 40,
          "charisma": 32,
          "portraitKey": "zengtou_infantry_older_strong",
          "alias": "曾頭市歩兵",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zengtou_field_21",
        "characterId": "zengtou-fortress_zengtou_field_21",
        "army": "ENEMY",
        "position": {
          "x": 0,
          "y": 8
        },
        "move": 4,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "zengtou-fortress_zengtou_field_21",
          "name": "曾頭市精鋭騎兵21",
          "shortName": "精",
          "martial": 70,
          "command": 72,
          "intelligence": 46,
          "charisma": 36,
          "portraitKey": "zengtou_cavalry_very_strong",
          "alias": "曾頭市精鋭騎兵",
          "combatSkills": [
            "騎乗戦闘"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zengtou_field_22",
        "characterId": "zengtou-fortress_zengtou_field_22",
        "army": "ENEMY",
        "position": {
          "x": 2,
          "y": 8
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "zengtou-fortress_zengtou_field_22",
          "name": "曾頭市歩兵隊22",
          "shortName": "歩",
          "martial": 58,
          "command": 64,
          "intelligence": 40,
          "charisma": 32,
          "portraitKey": "zengtou_infantry_older_strong",
          "alias": "曾頭市歩兵",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zengtou_field_23",
        "characterId": "zengtou-fortress_zengtou_field_23",
        "army": "ENEMY",
        "position": {
          "x": 3,
          "y": 8
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "zengtou-fortress_zengtou_field_23",
          "name": "曾頭市弩兵隊23",
          "shortName": "弩",
          "martial": 56,
          "command": 60,
          "intelligence": 52,
          "charisma": 30,
          "portraitKey": "zengtou_bow_older_strong",
          "alias": "曾頭市弩兵",
          "combatSkills": [
            "弓弩術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zengtou_field_24",
        "characterId": "zengtou-fortress_zengtou_field_24",
        "army": "ENEMY",
        "position": {
          "x": 4,
          "y": 8
        },
        "move": 3,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "zengtou-fortress_zengtou_field_24",
          "name": "曾頭市歩兵隊24",
          "shortName": "歩",
          "martial": 58,
          "command": 64,
          "intelligence": 40,
          "charisma": 32,
          "portraitKey": "zengtou_infantry_older_strong",
          "alias": "曾頭市歩兵",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zengtou_field_25",
        "characterId": "zengtou-fortress_zengtou_field_25",
        "army": "ENEMY",
        "position": {
          "x": 5,
          "y": 8
        },
        "move": 4,
        "facing": "SOUTH",
        "mobCharacter": {
          "id": "zengtou-fortress_zengtou_field_25",
          "name": "曾頭市精鋭騎兵25",
          "shortName": "精",
          "martial": 70,
          "command": 72,
          "intelligence": 46,
          "charisma": 36,
          "portraitKey": "zengtou_cavalry_very_strong",
          "alias": "曾頭市精鋭騎兵",
          "combatSkills": [
            "騎乗戦闘"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zengtou_left_infantry",
        "characterId": "zengtou-fortress_zengtou_left_infantry",
        "army": "ENEMY",
        "position": {
          "x": 0,
          "y": 9
        },
        "move": 3,
        "facing": "NORTH",
        "mobCharacter": {
          "id": "zengtou-fortress_zengtou_left_infantry",
          "name": "曾頭市左翼歩兵隊",
          "shortName": "歩",
          "martial": 58,
          "command": 64,
          "intelligence": 40,
          "charisma": 32,
          "portraitKey": "zengtou_infantry_older_strong",
          "alias": "曾頭市歩兵",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zengtou_left_adviser",
        "characterId": "zengtou-fortress_zengtou_left_adviser",
        "army": "ENEMY",
        "position": {
          "x": 0,
          "y": 10
        },
        "move": 3,
        "facing": "NORTH",
        "mobCharacter": {
          "id": "zengtou-fortress_zengtou_left_adviser",
          "name": "曾頭市左翼参謀",
          "shortName": "謀",
          "martial": 24,
          "command": 54,
          "intelligence": 88,
          "charisma": 44,
          "portraitKey": "mob_adviser_military_formation",
          "alias": "曾頭市参謀",
          "combatSkills": [
            "なし"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "冷静・策謀的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zengtou_left_archer",
        "characterId": "zengtou-fortress_zengtou_left_archer",
        "army": "ENEMY",
        "position": {
          "x": 0,
          "y": 11
        },
        "move": 3,
        "facing": "NORTH",
        "mobCharacter": {
          "id": "zengtou-fortress_zengtou_left_archer",
          "name": "曾頭市左翼弩兵隊",
          "shortName": "弩",
          "martial": 56,
          "command": 60,
          "intelligence": 52,
          "charisma": 30,
          "portraitKey": "zengtou_bow_older_strong",
          "alias": "曾頭市弩兵",
          "combatSkills": [
            "弓弩術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "慎重・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zengtou_right_infantry",
        "characterId": "zengtou-fortress_zengtou_right_infantry",
        "army": "ENEMY",
        "position": {
          "x": 7,
          "y": 9
        },
        "move": 3,
        "facing": "NORTH",
        "mobCharacter": {
          "id": "zengtou-fortress_zengtou_right_infantry",
          "name": "曾頭市右翼歩兵隊",
          "shortName": "歩",
          "martial": 58,
          "command": 64,
          "intelligence": 40,
          "charisma": 32,
          "portraitKey": "zengtou_infantry_older_strong",
          "alias": "曾頭市歩兵",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zengtou_right_adviser",
        "characterId": "zengtou-fortress_zengtou_right_adviser",
        "army": "ENEMY",
        "position": {
          "x": 7,
          "y": 10
        },
        "move": 3,
        "facing": "NORTH",
        "mobCharacter": {
          "id": "zengtou-fortress_zengtou_right_adviser",
          "name": "曾頭市右翼参謀",
          "shortName": "謀",
          "martial": 24,
          "command": 54,
          "intelligence": 88,
          "charisma": 44,
          "portraitKey": "mob_adviser_military_scout",
          "alias": "曾頭市参謀",
          "combatSkills": [
            "なし"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "冷静・策謀的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zengtou_right_archer",
        "characterId": "zengtou-fortress_zengtou_right_archer",
        "army": "ENEMY",
        "position": {
          "x": 7,
          "y": 11
        },
        "move": 3,
        "facing": "NORTH",
        "mobCharacter": {
          "id": "zengtou-fortress_zengtou_right_archer",
          "name": "曾頭市右翼弩兵隊",
          "shortName": "弩",
          "martial": 56,
          "command": 60,
          "intelligence": 52,
          "charisma": 30,
          "portraitKey": "zengtou_bow_older_strong",
          "alias": "曾頭市弩兵",
          "combatSkills": [
            "弓弩術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "慎重・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zengtou_left_captain",
        "characterId": "zengtou-fortress_zengtou_left_captain",
        "army": "ENEMY",
        "position": {
          "x": 1,
          "y": 12
        },
        "move": 3,
        "facing": "NORTH",
        "mobCharacter": {
          "id": "zengtou-fortress_zengtou_left_captain",
          "name": "曾頭市左翼隊長",
          "shortName": "将",
          "martial": 62,
          "command": 68,
          "intelligence": 46,
          "charisma": 34,
          "portraitKey": "mob_captain_high_trust_middle",
          "alias": "曾頭市隊長",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "実直・指揮的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zengtou_right_captain",
        "characterId": "zengtou-fortress_zengtou_right_captain",
        "army": "ENEMY",
        "position": {
          "x": 6,
          "y": 12
        },
        "move": 3,
        "facing": "NORTH",
        "mobCharacter": {
          "id": "zengtou-fortress_zengtou_right_captain",
          "name": "曾頭市右翼隊長",
          "shortName": "将",
          "martial": 62,
          "command": 68,
          "intelligence": 46,
          "charisma": 34,
          "portraitKey": "mob_captain_high_trust_young",
          "alias": "曾頭市隊長",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "実直・指揮的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zengtou_field_26",
        "characterId": "zengtou-fortress_zengtou_field_26",
        "army": "ENEMY",
        "position": {
          "x": 1,
          "y": 9
        },
        "move": 3,
        "facing": "NORTH",
        "mobCharacter": {
          "id": "zengtou-fortress_zengtou_field_26",
          "name": "曾頭市歩兵隊26",
          "shortName": "歩",
          "martial": 58,
          "command": 64,
          "intelligence": 40,
          "charisma": 32,
          "portraitKey": "zengtou_infantry_older_strong",
          "alias": "曾頭市歩兵",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zengtou_field_27",
        "characterId": "zengtou-fortress_zengtou_field_27",
        "army": "ENEMY",
        "position": {
          "x": 2,
          "y": 9
        },
        "move": 3,
        "facing": "NORTH",
        "mobCharacter": {
          "id": "zengtou-fortress_zengtou_field_27",
          "name": "曾頭市弩兵隊27",
          "shortName": "弩",
          "martial": 56,
          "command": 60,
          "intelligence": 52,
          "charisma": 30,
          "portraitKey": "zengtou_bow_older_strong",
          "alias": "曾頭市弩兵",
          "combatSkills": [
            "弓弩術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zengtou_field_28",
        "characterId": "zengtou-fortress_zengtou_field_28",
        "army": "ENEMY",
        "position": {
          "x": 3,
          "y": 9
        },
        "move": 3,
        "facing": "NORTH",
        "mobCharacter": {
          "id": "zengtou-fortress_zengtou_field_28",
          "name": "曾頭市歩兵隊28",
          "shortName": "歩",
          "martial": 58,
          "command": 64,
          "intelligence": 40,
          "charisma": 32,
          "portraitKey": "zengtou_infantry_older_strong",
          "alias": "曾頭市歩兵",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zengtou_field_29",
        "characterId": "zengtou-fortress_zengtou_field_29",
        "army": "ENEMY",
        "position": {
          "x": 5,
          "y": 9
        },
        "move": 4,
        "facing": "NORTH",
        "mobCharacter": {
          "id": "zengtou-fortress_zengtou_field_29",
          "name": "曾頭市騎兵隊29",
          "shortName": "騎",
          "martial": 64,
          "command": 68,
          "intelligence": 42,
          "charisma": 34,
          "portraitKey": "zengtou_cavalry_young_strong",
          "alias": "曾頭市騎兵",
          "combatSkills": [
            "騎乗戦闘"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zengtou_field_30",
        "characterId": "zengtou-fortress_zengtou_field_30",
        "army": "ENEMY",
        "position": {
          "x": 6,
          "y": 9
        },
        "move": 3,
        "facing": "NORTH",
        "mobCharacter": {
          "id": "zengtou-fortress_zengtou_field_30",
          "name": "曾頭市歩兵隊30",
          "shortName": "歩",
          "martial": 58,
          "command": 64,
          "intelligence": 40,
          "charisma": 32,
          "portraitKey": "zengtou_infantry_older_strong",
          "alias": "曾頭市歩兵",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zengtou_field_31",
        "characterId": "zengtou-fortress_zengtou_field_31",
        "army": "ENEMY",
        "position": {
          "x": 1,
          "y": 10
        },
        "move": 3,
        "facing": "NORTH",
        "mobCharacter": {
          "id": "zengtou-fortress_zengtou_field_31",
          "name": "曾頭市弩兵隊31",
          "shortName": "弩",
          "martial": 56,
          "command": 60,
          "intelligence": 52,
          "charisma": 30,
          "portraitKey": "zengtou_bow_older_strong",
          "alias": "曾頭市弩兵",
          "combatSkills": [
            "弓弩術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zengtou_field_32",
        "characterId": "zengtou-fortress_zengtou_field_32",
        "army": "ENEMY",
        "position": {
          "x": 2,
          "y": 10
        },
        "move": 3,
        "facing": "NORTH",
        "mobCharacter": {
          "id": "zengtou-fortress_zengtou_field_32",
          "name": "曾頭市歩兵隊32",
          "shortName": "歩",
          "martial": 58,
          "command": 64,
          "intelligence": 40,
          "charisma": 32,
          "portraitKey": "zengtou_infantry_older_strong",
          "alias": "曾頭市歩兵",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zengtou_field_33",
        "characterId": "zengtou-fortress_zengtou_field_33",
        "army": "ENEMY",
        "position": {
          "x": 4,
          "y": 10
        },
        "move": 4,
        "facing": "NORTH",
        "mobCharacter": {
          "id": "zengtou-fortress_zengtou_field_33",
          "name": "曾頭市騎兵隊33",
          "shortName": "騎",
          "martial": 64,
          "command": 68,
          "intelligence": 42,
          "charisma": 34,
          "portraitKey": "zengtou_cavalry_young_strong",
          "alias": "曾頭市騎兵",
          "combatSkills": [
            "騎乗戦闘"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zengtou_field_34",
        "characterId": "zengtou-fortress_zengtou_field_34",
        "army": "ENEMY",
        "position": {
          "x": 5,
          "y": 10
        },
        "move": 3,
        "facing": "NORTH",
        "mobCharacter": {
          "id": "zengtou-fortress_zengtou_field_34",
          "name": "曾頭市歩兵隊34",
          "shortName": "歩",
          "martial": 58,
          "command": 64,
          "intelligence": 40,
          "charisma": 32,
          "portraitKey": "zengtou_infantry_older_strong",
          "alias": "曾頭市歩兵",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zengtou_field_35",
        "characterId": "zengtou-fortress_zengtou_field_35",
        "army": "ENEMY",
        "position": {
          "x": 1,
          "y": 11
        },
        "move": 3,
        "facing": "NORTH",
        "mobCharacter": {
          "id": "zengtou-fortress_zengtou_field_35",
          "name": "曾頭市弩兵隊35",
          "shortName": "弩",
          "martial": 56,
          "command": 60,
          "intelligence": 52,
          "charisma": 30,
          "portraitKey": "zengtou_bow_older_strong",
          "alias": "曾頭市弩兵",
          "combatSkills": [
            "弓弩術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zengtou_field_36",
        "characterId": "zengtou-fortress_zengtou_field_36",
        "army": "ENEMY",
        "position": {
          "x": 2,
          "y": 11
        },
        "move": 3,
        "facing": "NORTH",
        "mobCharacter": {
          "id": "zengtou-fortress_zengtou_field_36",
          "name": "曾頭市歩兵隊36",
          "shortName": "歩",
          "martial": 58,
          "command": 64,
          "intelligence": 40,
          "charisma": 32,
          "portraitKey": "zengtou_infantry_older_strong",
          "alias": "曾頭市歩兵",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zengtou_field_37",
        "characterId": "zengtou-fortress_zengtou_field_37",
        "army": "ENEMY",
        "position": {
          "x": 5,
          "y": 11
        },
        "move": 4,
        "facing": "NORTH",
        "mobCharacter": {
          "id": "zengtou-fortress_zengtou_field_37",
          "name": "曾頭市騎兵隊37",
          "shortName": "騎",
          "martial": 64,
          "command": 68,
          "intelligence": 42,
          "charisma": 34,
          "portraitKey": "zengtou_cavalry_young_strong",
          "alias": "曾頭市騎兵",
          "combatSkills": [
            "騎乗戦闘"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zengtou_field_38",
        "characterId": "zengtou-fortress_zengtou_field_38",
        "army": "ENEMY",
        "position": {
          "x": 6,
          "y": 11
        },
        "move": 3,
        "facing": "NORTH",
        "mobCharacter": {
          "id": "zengtou-fortress_zengtou_field_38",
          "name": "曾頭市歩兵隊38",
          "shortName": "歩",
          "martial": 58,
          "command": 64,
          "intelligence": 40,
          "charisma": 32,
          "portraitKey": "zengtou_infantry_older_strong",
          "alias": "曾頭市歩兵",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zengtou_field_39",
        "characterId": "zengtou-fortress_zengtou_field_39",
        "army": "ENEMY",
        "position": {
          "x": 2,
          "y": 12
        },
        "move": 3,
        "facing": "NORTH",
        "mobCharacter": {
          "id": "zengtou-fortress_zengtou_field_39",
          "name": "曾頭市弩兵隊39",
          "shortName": "弩",
          "martial": 56,
          "command": 60,
          "intelligence": 52,
          "charisma": 30,
          "portraitKey": "zengtou_bow_older_strong",
          "alias": "曾頭市弩兵",
          "combatSkills": [
            "弓弩術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zengtou_field_40",
        "characterId": "zengtou-fortress_zengtou_field_40",
        "army": "ENEMY",
        "position": {
          "x": 3,
          "y": 12
        },
        "move": 3,
        "facing": "NORTH",
        "mobCharacter": {
          "id": "zengtou-fortress_zengtou_field_40",
          "name": "曾頭市歩兵隊40",
          "shortName": "歩",
          "martial": 58,
          "command": 64,
          "intelligence": 40,
          "charisma": 32,
          "portraitKey": "zengtou_infantry_older_strong",
          "alias": "曾頭市歩兵",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zengtou_field_41",
        "characterId": "zengtou-fortress_zengtou_field_41",
        "army": "ENEMY",
        "position": {
          "x": 5,
          "y": 12
        },
        "move": 4,
        "facing": "NORTH",
        "mobCharacter": {
          "id": "zengtou-fortress_zengtou_field_41",
          "name": "曾頭市精鋭騎兵41",
          "shortName": "精",
          "martial": 70,
          "command": 72,
          "intelligence": 46,
          "charisma": 36,
          "portraitKey": "zengtou_cavalry_very_strong",
          "alias": "曾頭市精鋭騎兵",
          "combatSkills": [
            "騎乗戦闘"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zengtou_field_42",
        "characterId": "zengtou-fortress_zengtou_field_42",
        "army": "ENEMY",
        "position": {
          "x": 3,
          "y": 13
        },
        "move": 3,
        "facing": "NORTH",
        "mobCharacter": {
          "id": "zengtou-fortress_zengtou_field_42",
          "name": "曾頭市歩兵隊42",
          "shortName": "歩",
          "martial": 58,
          "command": 64,
          "intelligence": 40,
          "charisma": 32,
          "portraitKey": "zengtou_infantry_older_strong",
          "alias": "曾頭市歩兵",
          "combatSkills": [
            "槍術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "zengtou_field_43",
        "characterId": "zengtou-fortress_zengtou_field_43",
        "army": "ENEMY",
        "position": {
          "x": 4,
          "y": 13
        },
        "move": 3,
        "facing": "NORTH",
        "mobCharacter": {
          "id": "zengtou-fortress_zengtou_field_43",
          "name": "曾頭市弩兵隊43",
          "shortName": "弩",
          "martial": 56,
          "command": 60,
          "intelligence": 52,
          "charisma": 30,
          "portraitKey": "zengtou_bow_older_strong",
          "alias": "曾頭市弩兵",
          "combatSkills": [
            "弓弩術"
          ],
          "specialAbilities": [
            "なし"
          ],
          "personality": "勇猛・規律的",
          "historical": "ゲーム用仮設定",
          "source": "ゲーム用仮設定"
        }
      },
      {
        "id": "guan_sheng_zengtou",
        "characterId": "guan_sheng",
        "army": "PLAYER",
        "position": {
          "x": 0,
          "y": 18
        },
        "move": 4,
        "facing": "NORTH",
        "reserve": true
      },
      {
        "id": "xu_ning_zengtou",
        "characterId": "xu_ning",
        "army": "PLAYER",
        "position": {
          "x": 7,
          "y": 18
        },
        "move": 4,
        "facing": "NORTH",
        "reserve": true
      },
      {
        "id": "shan_tinggui_zengtou",
        "characterId": "shan_tinggui",
        "army": "PLAYER",
        "position": {
          "x": 0,
          "y": 19
        },
        "move": 4,
        "facing": "NORTH",
        "reserve": true
      },
      {
        "id": "wei_dingguo_zengtou",
        "characterId": "wei_dingguo",
        "army": "PLAYER",
        "position": {
          "x": 7,
          "y": 19
        },
        "move": 4,
        "facing": "NORTH",
        "reserve": true
      }
    ],
    "intro": [
      {
        "unitId": "song_jiang_zengtou",
        "text": "曾頭市軍は寨外へ出た。北側の各隊は互いに呼応し、南の本隊と挟み込め。敵兵は多い、孤立だけはするな。"
      },
      {
        "unitId": "wu_yong_zengtou",
        "text": "包囲の形にこだわりすぎてはいけません。敵の厚い所を避け、二つ三つの隊を合わせて局地的な優勢を作りましょう。"
      },
      {
        "unitId": "qin_ming_zengtou",
        "text": "史文恭め、前へ出てきたな！　霹靂火・秦明が相手をしてやる！"
      },
      {
        "unitId": "lu_junyi_zengtou",
        "text": "私は燕青と北の退路を押さえる。史文恭が逃げれば、ここで受け止めよう。"
      },
      {
        "unitId": "shi_wengong",
        "text": "四方から囲んだつもりか。曾頭市の兵を甘く見るな。梁山泊の包囲を正面から破ってくれる！"
      },
      {
        "unitId": "zeng_nong",
        "text": "各隊、平地へ押し出せ！　兵数はこちらが上だ。梁山泊の薄い戦線を一つずつ潰せ！"
      }
    ],
    "victory": [
      {
        "unitId": "song_jiang_zengtou",
        "text": "曾頭市軍は潰えた。これでこの戦いは終わりだ。晁蓋殿への弔いを果たし、寨へ帰ろう。"
      },
      {
        "unitId": "lu_junyi_zengtou",
        "text": "各方面の敵は討ち果たした。史文恭ももはや戦場には立てまい。"
      },
      {
        "unitId": "wu_yong_zengtou",
        "text": "大軍を相手に各戦線をつなぎ直し、最後まで敵戦力を削り切ったことが勝因です。"
      }
    ]
  }
]);
