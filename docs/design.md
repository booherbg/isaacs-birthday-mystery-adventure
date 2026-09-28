# Isaac's Birthday Mystery Adventure — design note (2026-09-28)

Birthday game for Isaac (turning 8). Reveals the trampoline coming to the new house.

## Intent (from Blaine)
- Simple, silly, nostalgic, < 5 min, easy on phone + laptop, GitHub Pages (tinyurl'd).
- Character side-scroller: Isaac (blond curly hair), Sunny (7-month red mini poodle), Mom (Amanda), Dad (Blaine).
- Loves: Pokémon (the card game most), baseball, Minecraft, Mario Wonder, Wii Sports.
- Ending: find the trampoline in the new backyard and jump on it. Then a repeatable mode.
- USB game controller support.

## Assumptions (flagged, cheap to change in `js/config.js`)
- Pup is spelled "Sunny".
- The house is drawn as pixel art, not the photo (the photo shows the house number; the site is public).
- No spoilers before the reveal: title, URL, menus never say "trampoline".

## Shape (revised after Blaine's follow-ups: Freida the calico, scooter, skate park / Red River, Big Bunny)
A moving-day journey from the current house to the new house. Family members are the hint-giving NPCs.
  0. Home: birthday morning in Isaac's room (Big Bunny rides in his backpack). Mom sets up the mystery.
     "A wild FREIDA appeared!" TCG-style gag (PET / TREAT / RUN) → Clue 1 "It's BIG!"
  1. Neighborhood on his green/black scooter: collect cards, toy-car track ramps → Dad at Brunsdale Fields,
     Wii-Sports-style batting → Clue 2 "It's BOUNCY!" → Dad offers a path choice.
  2a. Skate Park (scooter): ramps + air tricks → mega-ramp grabs Clue 3 "It's in the BACKYARD!"
  2b. Red River Trail (bike): geese, pelicans, jumping fish → fishing with Mom, catfish has Clue 3.
  3. New house: walk to the backyard → unwrap giant present → TRAMPOLINE → first bounce round → birthday card.
Cameos instead of whole worlds: diamonds, cards, unlockable hats (Spidey mask, ball cap, diamond helmet, pup fire helmet, Big Bunny ears).
- Replay: Trampoline Time — 60s rounds, time the landing for higher bounces, flips, collect sky goodies up to space, high score + hat unlocks.
- No fail states. Tap / A / Space advances text. Progress saved in localStorage.

## Tech
- Static site, no build: `index.html` + ES modules in `js/`. Canvas 256×144 pixel art (sprites authored as strings), DOM for text/menus (crisp, readable).
- Web Audio synth for all SFX + chiptune music (Take Me Out to the Ball Game + Happy Birthday are public domain).
- Input: keyboard, touch pad, Gamepad API (standard + common generic USB mappings incl. hat axis).
- Dev: `?stage=N` jumps to a story stage, `?unlock` unlocks everything.
