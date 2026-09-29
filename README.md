# Isaac's Birthday Mystery Adventure

A little pixel-art mystery adventure made for Isaac's 8th birthday.
Find the clues, follow the trail, and solve the mystery!

**Play:** https://blainebooher.com/isaacs-birthday-mystery-adventure/

**How we built it (spoilers!):** https://blainebooher.com/isaacs-birthday-mystery-adventure/report.html

- Works on phones (touch buttons), laptops (arrow keys + space) and USB/Bluetooth game controllers.
- Your progress and high scores are saved in the browser.

## For grown-ups
- Plain HTML/JS, no build step. Run locally with `python3 -m http.server` and open http://localhost:8000.
- Names and the final message live in `js/config.js`.
- Fresh start on a device (wipes saved progress): add `?reset` to the URL once.
- Dev shortcuts: `?stage=room|yard|hood|skate|river|pool|newhouse`, `?scene=batting|freida|catfish|sunny|tramp`, `?unlock`.
- `dev/pad.html` is a controller test page.
- All art is drawn in code; all sound and music is synthesized with Web Audio
  ("Take Me Out to the Ball Game" and "Happy Birthday to You" are public domain).
