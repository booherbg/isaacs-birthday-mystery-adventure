# Isaac's Birthday Mystery Adventure

A little pixel-art mystery adventure made for Isaac's 8th birthday.
Find the clues, follow the trail, and solve the mystery!

**Play:** https://blainebooher.com/isaacs-birthday-mystery-adventure/

**How we built it (spoilers!):** https://blainebooher.com/isaacs-birthday-mystery-adventure/report.html

- Works on phones (touch buttons), laptops (arrow keys + space, or WASD) and USB/Bluetooth game controllers.
- Your progress and high scores are saved in the browser.
- Solve the mystery to unlock extras on the title screen: the Cannonball Contest, and the Soundtrack Explorer
  (every song in the game, plus *Restitution*, a bonus track Claude wrote in its free time).
- Look around Isaac's room: there's a Toniebox to play, and a tennis ball Sunny will fetch as many times as you throw it.

## For grown-ups
- Plain HTML/JS, no build step. Run locally with `python3 -m http.server` and open http://localhost:8000.
- Names and the final message live in `js/config.js`.
- Fresh start on a device (wipes saved progress): add `?reset` to the URL once.
- Dev shortcuts: `?stage=room|yard|hood|skate|river|pool|newhouse`, `?scene=batting|dive|freida|catfish|sunny|tramp`, `?unlock`.
- `dev/pad.html` is a controller test page.
- The faint text at the bottom right of the title screen is the build (commit + time), stamped by the deploy workflow.
- All art is drawn in code; all sound and music is synthesized with Web Audio
  ("Take Me Out to the Ball Game", "Happy Birthday to You" and "Twinkle Twinkle Little Star" are public domain).
