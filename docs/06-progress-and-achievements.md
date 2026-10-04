# 06. Progress and Achievements

The Journal is for enjoyment. It shows a player what they did, and the achievement
system gives it structure. Where the game has achievements, we mirror them. Where it
does not (Classic Era), we reconstruct the set Blizzard built for that content in
Wrath of the Lich King. We do not gamify the wiki itself: no "catalogued 500 NPCs"
achievements.

## Blizzard's model, which we copy

- **Categories** in a tree: General, Quests, Exploration, Player vs. Player, Dungeons &
  Raids, Professions, Reputation, World Events, Feats of Strength, with subcategories
  (per zone, per instance, per expansion).
- **Achievements** have id, name, description, icon, points (5/10/20/25/50; Feats are
  0), optional reward text (title, item, mount, tabard), and flags (account-wide vs.
  character, counter-type, hidden until earned).
- **Criteria**: each achievement has one or more criteria of a type (kill creature,
  complete quest, explore area, reach reputation standing, win battleground, learn
  recipe, reach skill, loot item, complete achievement) with a required quantity.
  Meta-achievements require other achievements.
- **Statistics**: a separate tree of counters (deaths, kills, gold looted, flight
  paths taken, largest hit) with no points.
- **Progress display**: progress bars for counters, checklists for multi-criteria,
  "earned on date by character".

## Where in-game achievements exist (Mists, Retail, Anniversary from Wrath)

The add-on dumps the catalog and the character's state. We:

- Store the catalog in the wiki per flavor and build (achievements are entities).
- Store completion and criteria progress in the Journal.
- Display exactly what the game shows, grouped the same way, with the same points.
- Account-wide achievements are shown at account level; character-specific ones per
  character.

Nothing is reconstructed in these flavors except where the add-on can observe
progress the game does not expose (none known).

## Classic Era: reconstruction

Classic Era has no achievements. Wrath of the Lich King introduced achievements that
cover the old world as it existed then. We rebuild the ones achievable in Classic Era
content, with Era-appropriate numbers, as **Compendium achievements**. They have the
same shape as Blizzard's so one evaluation engine serves all flavors.

### Catalog, first pass

**General**: Level 10/20/30/40/50/60. Learn riding (Journeyman at 40, Expert... Era
has Apprentice 40 and Journeyman 60). "Stable Keeper" (hunter pets), "Did Somebody
Order a Knuckle Sandwich?", "Going Down?" (fall without dying, measurable from
`PLAYER_DAMAGE_DONE_MODS`? no; use falling damage from combat log `ENVIRONMENTAL_DAMAGE`
with large amount and survival), "Fast and Furious"? (not in Era: no 100% mount
speed... Era has epic mounts at 60: yes). "Well Read" (read lore books: our lore
module makes this one real), "Represent", "Safe Deposit" (bank slots), "Friends In
High Places"? (needs other players; skip), "Can I Keep Him?" (companion pets exist in
Era as items).

**Quests**: "N Quests Completed" ladder (50, 100, 250, 500, 1000, 1500, 3000).
"Loremaster of Eastern Kingdoms", "Loremaster of Kalimdor", "Loremaster" meta. Per-zone
quest achievements as Cataclysm did ("Elwynn Forest Quests": complete N quests in
zone). "A Simple Re-Quest" style dailies do not exist in Era. "The Loremaster" title
is a cosmetic hook (deferred).

**Exploration**: "Explore <zone>" for every Era zone, "Explore Eastern Kingdoms",
"Explore Kalimdor", "World Explorer" meta. Also "Medium Rare" / rare-spawn
achievements: "Bloody Rare" and "Frostbitten" are Outland/Northrend; the Era
equivalent is a reconstruction over Era rare spawns, which our wiki discovers over
time, so this one is **computed against the wiki's confirmed rare list** and is marked
"growing" until an admin freezes the list.

**Dungeons & Raids**: "Classic Dungeonmaster" (Ragefire Chasm through Scholomance,
Stratholme, Dire Maul, Upper Blackrock Spire), per-dungeon achievements with the final
boss, "Classic Raider" (Onyxia, Molten Core, Blackwing Lair, Zul'Gurub, Ruins of
Ahn'Qiraj, Temple of Ahn'Qiraj, Naxxramas), per-boss first kills as statistics.

**Player vs. PvP**: honorable kill ladder (100 to 100,000), per-battleground
victories (Warsong Gulch, Arathi Basin, Alterac Valley), "Duel-icious" (10 duels won),
"That Takes Class" (kill each class), "Know Thy Enemy" (kill each race), rank
achievements for the Era honor system ranks (Private through Grand Marshal /
High Warlord) observed from `UnitPVPName`/rank API.

**Professions**: Journeyman/Expert/Artisan ladders for each profession to 300,
"Professional Grand Master" does not exist in Era; cap is Artisan. Cooking, Fishing,
First Aid secondary ladders. "The Cake Is Not A Lie" style recipe achievements
reconstructed from Era recipes. "Old Man Barlowned" (Outland) skipped. Fishing: catch
counts, "Mr. Pinchy" skipped, "Old Crafty"/"Old Ironjaw" are Era fish: real.

**Reputation**: Exalted ladder (5, 10, 15, 20, 25), "The Argent Dawn", "Timbermaw
Hold", "Brood of Nozdormu", "Cenarion Circle", "Thorium Brotherhood", "Hydraxian
Waterlords", "Zandalar Tribe", "Darkmoon Faire", "Bloodsail Buccaneers" (feat),
"Ambassador" (all home cities exalted), "Diplomat" (Timbermaw, Sporeggar, Kurenai: Era
version is Timbermaw only plus Bloodsail → use "Diplomat" as Timbermaw Hold +
Ravenholdt + Darkmoon Faire; decision needed, see `10`).

**World Events**: Hallow's End, Winter Veil, Love is in the Air (Era version), Lunar
Festival, Midsummer, Harvest Festival, Darkmoon Faire, Children's Week, Brewfest (not
in Era), Noblegarden (Era version), Fishing Extravaganza (Stranglethorn), Scourge
Invasion (Naxx launch event; only on some realms/phases). Criteria from quests
completed and items looted during the event window (realm phase timeline gives the
window).

**Feats of Strength**: Hardcore specific: "Survivor" (reach 60 on Hardcore),
"Immortal <zone>"? (reach level milestones without dying is implicit in Hardcore).
Realm-first style feats need leaderboards (below). "Insane in the Membrane" Era
reconstruction (Bloodsail, Ravenholdt, Darkmoon, Shen'dralar... Shen'dralar was
removed in Cata; it exists in Era, so the Era Insane includes it). "Scarab Lord"
(Qiraji resonating crystal... observed by the mount or quest completion).

**Fun additions** (keep few, keep tasteful): "Death by Murloc" (die to 10 distinct
murloc creatures), "Hogger Hunter" (kill Hogger at every level bracket), "Inn Crowd"
(rest in every inn: detect `IsResting` zone changes), "Frequent Flyer" (ride every
flight path), "Bookworm" (read every lore text in a zone), "Tour Guide" (visit every
subzone of a zone). These replace nothing; they are extra and marked as Compendium
originals.

### The Era list is authored content (D-0032)

Era has no achievements in the client. The team writes the Era list as versioned
content in `packages/achievements/catalogs/era/`, modeled on Wrath's achievements,
and the owner reviews it in chat before release. Once released, criteria never
change; new achievements may be added. Every quest, area, creature, faction, or
instance a criterion names gets a wiki page at once, carrying only that name and a
"named by achievement, not yet observed" label until a player observes it. Nothing
is ever measured against a moving target and no administrator freezes anything.

### Loremaster design

Wrath's Loremaster used fixed quest counts per continent. We do the same: Loremaster
of Eastern Kingdoms at 550 quests, Loremaster of Kalimdor at 700, and the Loremaster
meta. Quest-to-continent attribution uses the quest's observed zone (quest giver's
position, falling back to the quest log header); quests without an observed zone
count toward neither until observed. No per-zone quest achievements exist in the Era
list, matching Wrath.

### Exploration design

"Explore <zone>" lists the subzones of that zone explicitly in the authored catalog,
as Wrath's did. Progress is the count of listed subzones the character has
discovered (`area_discovered` events, matched by name per locale, with
`C_MapExplorationInfo` overlay data as a second signal where available). World
Explorer and the continent metas are metas over the zone achievements.

## Evaluation engine (`packages/achievements`)

Pure functions. Input: a character's state (completed quest set, explored areas,
reputations, skills, known recipes, kills by npcID, deaths, encounters cleared, items
looted, zones visited, inns rested, flight paths taken, honorable kills, battleground
results, event participation) and the catalog for the flavor and build. Output:
per-achievement progress (criteria with current/required), earned flag, earned
timestamp (the server time of the event that completed it, so retroactive evaluation
yields correct dates), and points.

Criteria types (initial): `quest_complete(set|count|zone)`, `area_explore(set)`,
`creature_kill(id|set|count)`, `encounter_clear(id|set)`, `reputation(faction,
standing)`, `reputation_count(standing, n)`, `skill(line, rank)`, `recipe_known(set)`,
`item_looted(id|count)`, `level(n)`, `hk_count(n)`, `bg_win(bg, n)`, `duel_win(n)`,
`death_to(set, n)`, `rest_in(set)`, `taxi_node_visited(set)`, `lore_read(set)`,
`achievement(set)` (meta), `event_quest(event, set)`.

The engine runs on ingest for affected characters and can be rerun for all characters
when the catalog changes. Catalog changes are versioned and audited like overrides.

## Account level

Account-wide roll-up: total points (highest per achievement across characters, like
Blizzard's account-wide rules), account achievements (earned by any character), and
account statistics. Characters keep their own earned lists.

## Leaderboards

Opt-in per account (`07`). Boards are per flavor and optionally per realm, faction,
class, or Hardcore:

- Achievement points.
- Loremaster progress (quests completed), exploration percentage.
- Level speed (played time to 60), Hardcore survivors by level and played time.
- Kills, deaths (fun), fish caught, flight paths taken, gold looted lifetime.
- Boss first kills by date (realm-first style, based on server time of the encounter
  end).

Boards are recomputed on a schedule, identify players by BattleTag (D-0031) with the
character's name and class as detail on character-scoped boards, and exclude accounts
with trust below threshold.

## Cosmetics and titles (deferred, schema only)

`account_achievements` and `achievement_progress` carry `reward_json`. Reward kinds
`title`, `badge`, `frame`, `theme` are reserved. The profile page has a slot for a
chosen title and badge. No rewards are defined in the first release.

### Zones visited and flight paths known

The character page lists the zones a character has entered (from `zone_enter`
events) and the flight paths it can use (`character_state` kind `taxi`, recorded
from the flight map's current and reachable nodes). Both are Journal data only;
the wiki's flight paths come from routes, never from who knows them (D-0045).

