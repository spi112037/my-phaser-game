import { HAND_LIMIT } from "../config/constants";

export default class CardSystem {
  constructor(rng = Math.random) {
    this.rng = typeof rng === "function" ? rng : Math.random;
  }

  setRng(rng) {
    this.rng = typeof rng === "function" ? rng : Math.random;
  }

  shuffle(deck) {
    for (let i = deck.length - 1; i > 0; i -= 1) {
      const j = Math.floor(this.rng() * (i + 1));
      const t = deck[i];
      deck[i] = deck[j];
      deck[j] = t;
    }
  }

  draw(hero, count) {
    for (let i = 0; i < count; i += 1) {
      if (hero.ready.length >= HAND_LIMIT) return;

      if (hero.deck.length === 0) {
        if (hero.grave.length === 0) return;
        hero.deck = hero.grave.splice(0, hero.grave.length);
        this.shuffle(hero.deck);
      }

      const c = hero.deck.shift();
      if (!c) return;

      const baseCost = Number(c.baseCost ?? c.cost ?? 0);
      c.baseCost = baseCost;
      c.cost = baseCost;

      hero.ready.push(c);
    }
  }

  discard(hero, card) {
    hero.grave.push(card);
  }

  removeFromReady(hero, card) {
    const idx = hero.ready.indexOf(card);
    if (idx >= 0) hero.ready.splice(idx, 1);
  }
}
