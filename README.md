# Strudel TalkIt
A saw wave-based function for text-to-speech in Strudel.

## Importing Strudel TalkIt
Paste this line to the top of your sketch:

```bash
await import('https://cdn.jsdelivr.net/gh/emisavage03/strudel-talkit@v1.0.0/talkit.js')
```

## Using Strudel TalkIt
Getting this out of the way first: I have little formalized knowledge of TTS synthesizers, so I used Claude to write the code. 
<img width="600" height="250" alt="elephant in the room" src="https://github.com/user-attachments/assets/6b1bee80-3492-46e5-89c8-e4169a4202d6" />

### Here's how it works:
Each event (note/section of notes) speaks one chunk of text on that event’s pitch, so you write one syllable or word per note. The text goes through simple English spelling rules into phonemes. A source oscillator runs through formant filters, with noise for s/sh/f and stop bursts, and the vowels stretch to fill the note.

### Controls:
.tract(ratio) scales the vocal tract (below 1 sounds bigger, above 1 smaller). 

.breath(0..1) adds breathiness. 

vib, vibmod, gain, attack, decay, sustain, release etc also work. (adsr envelope lowkey sounds bad lol)

### Fixing pronunciation: 

Force exact phonemes with colon-joined [ARPAbet] (https://en.wikipedia.org/wiki/ARPABET), e.g. "HH:EH:L:OW".

And/or, teach it words: talkWords({ strudel: "s t r uw d ax l" })

### Try it out!

Paste this at the top of a Strudel REPL pattern (or load it as a module):

```bash
note("c3 e3 g3 c4").talk("hel lo wor ld")
note("<c3 g2>*4").talk("ah").tract(0.8)
```
