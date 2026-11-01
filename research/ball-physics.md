# Ball physics for a 2D screen-space tennis/pickleball effect

Tags: [V] fetched and quoted; [S] search snippet only, page not fetched; [C] computed here from cited inputs; [U] unverified or engineering guess.

## Ball specs
- Tennis mass 56-59.4 g (ITF approval) [V] https://tennisserver.com/wildcards/wildcards_03_10.html
- Tennis diameter 6.54-6.86 cm [S] https://m.itftennis.com/media/2100/balls-ball-approval-tests.pdf
- Tennis rebound 135-147 cm from a 254 cm drop onto concrete [S] same ITF PDF (retailer summary); Tennis Warehouse gives 53-58 in [S] https://twu.tennis-warehouse.com/learning_center/balltesting.php
- Tennis COR on hard court [C]: sqrt(135/254) to sqrt(147/254) = 0.73-0.76. Cross-check: USTA 100 in to 55 in drop gives 0.74 [V] https://van.physics.illinois.edu/ask/listing/11700
- Pickleball mass 22.1-26.5 g, diameter 7.29-7.54 cm, bounce 30-34 in from 78 in (2020 rulebook) [S] https://teamsideline.com/Assets/881/2020-Pickleball%20Rulebook.pdf (dated; check current USA Pickleball manual)
- Pickleball COR [C]: sqrt(30/78) to sqrt(34/78) = 0.62-0.66, midpoint 0.64.

## Drag
- Tennis Cd: Mehta reports 0.6-0.7 for new balls [S] (source page not confirmed). The 0.55 figure was not found [U].
- Pickleball Cd, free flight: 26-hole mean 0.45, 40-hole mean 0.33 [V] https://twu.tennis-warehouse.com/learning_center/pickleball/pickleball_aerodynamics.php
- Same paper: launch speeds 5-13 m/s [V] (same URL). Steyn et al. 0.30 +/- 0.02 [S]. No pickleball wind-tunnel study found.

## Speed ratio and launch angle
- Struck-ball speed: Vh = ACOR x Vinc + (1 + ACOR) x VR [V] https://tennisserver.com/wildcards/wildcards_03_10.html
- ACOR is defined as Vrebound/Vincident, with no numeric value given [V] https://www.tennisserver.com/set/set_05_01.html
- Ball-racquet COR about 0.85 (Brody, quoted) [V] https://van.physics.illinois.edu/ask/listing/11700
- Example estimate: 100 mph racket gives about 63 mph ball, a ratio of 0.63 [V, estimate] https://van.physics.illinois.edu/ask/listing/11700. This conflicts with the formula above, which gives about 1.85 for a stationary ball at ACOR 0.85. Unresolved.
- Forehand speed ratio 1.2-1.5 [U]. Not verified.
- Launch angle off the racket: no direct measurement found [U].
- Racquet face angle at impact 14-33 deg, mean 21 deg [S] https://www.jssm.org/jssm-16-505.xml-Fulltext
- Topspin racket path about 0.48 rad (about 27 deg) upward [S, conversion mine] https://arch.neicon.ru/xmlui/handle/123456789/3739266

## Recommended parameters (engineering guidance unless tagged)
- Restitution: tennis 0.74 [C], pickleball 0.64 [C].
- Gravity at 720p: px/m = 400 / 1.75 = 228.6. g = 9.81 x 228.6 = 2243 px/s^2 (about 2240) [C]. Tune down for feel.
- Speed ratio: launch speed = 1.2 x tracked racket-head speed [U].
- Launch angle clamp: min 3 deg, max 15 deg above horizontal [U]. Reject negative vertical velocity unless the ball is bouncing.
- Linear drag (per-frame, units-independent): v *= exp(-k dt).
  - Tennis: k = 0.45 /s [C]. Uses A = pi(0.0335 m)^2, m = 0.057 kg, rho = 1.2 kg/m^3, Cd = 0.6, and the linear equivalent at 20 m/s [U assumption].
  - Pickleball: k = 0.44 /s [C]. Uses A = pi(0.0375 m)^2, m = 0.0243 kg, Cd = 0.40, at 10 m/s [U assumption].
  - Quadratic form: k_q = rho Cd A / (2m) per metre, then multiply by speed in m/s.
- Integrator: vy += g dt (px units); v *= exp(-k dt); pos += v dt.
- Wrist-velocity smoothing: EMA alpha about 0.3 per frame, take peak over a sliding window of about 100 ms [U].
