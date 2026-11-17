# 🕷️ Spider-Man: New York Libero

Gioco 3D open-world nel browser, costruito con **Three.js** (nessuna dipendenza da installare).

## Come giocare

Serve un piccolo server locale (i moduli ES non sempre funzionano da `file://`):

```bash
cd spiderman-city
python3 -m http.server 8080
```

Poi apri http://localhost:8080 e clicca **GIOCA**.

## Comandi

| Tasto | Azione |
|---|---|
| `WASD` | Movimento |
| `SHIFT` | Corsa (consuma energia) |
| `SPAZIO` | Salto / doppio salto ragno |
| `Click SX` (tieni premuto) | Lancia e usa la ragnatela per oscillare |
| `W` mentre oscilli | Ritira la ragnatela (più velocità) |
| `Click DX` / `E` | Traino rapido verso il punto mirato |
| `F` | Interagisci (missioni, fast food) |
| `T` | Armadio dei costumi |
| `C` | Cambio costume rapido |
| `ESC` | Pausa |

## Cosa c'è nel gioco

- **Città 3D procedurale**: grattacieli con finestre illuminate, parchi, strade con traffico, pedoni, lampioni, nuvole e ciclo giorno/notte
- **Ragnatele con fisica reale**: pendolo con conservazione dello slancio, arrampicata sui tetti, traino rapido
- **5 costumi**: Classico (gratis), Symbiote, Miles Morales, Scarlet Spider, Iron Spider — si sbloccano con i soldi guadagnati
- **4 tipi di missione**: inseguimento a checkpoint, raccolta ragni d'oro, arresto criminali, consegne urgenti
- **3 fast food**: Burger Ragno, Pizza Planeta, Kebab King — mangia per recuperare vita ed energia
- **HUD completo**: vita, energia, denaro, minimappa, bussola missioni, orologio
- **Salvataggio automatico** dei progressi (localStorage)
