# Aperture rotation support for the v4 renderer

This fork keeps the v4 renderer and implements Gerber LR (load rotation) in the
parser, plotter, and SVG output. Apertures rotate about each flash point; macro
clear regions rotate with the rest of the aperture. The Gerber input and the
source board geometry are not rewritten.

The repository root exposes the converter as a Git-installable package. Its
entry point and type declarations reference the parser and plotter in this
same checkout, so installing a pinned commit cannot silently pick up unfixed
registry copies of those packages. No generated bundle or install script is
required. The original workspace layout and upstream license are retained.

Consumers can install `gerber-to-svg` using a full Git commit hash from this
fork. The package remains private to avoid accidentally publishing over any
upstream package. The integration PR in tscircuit/check-shorts pins the tested
commit and removes its old orthogonal-pad normalization.
