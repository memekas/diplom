"use client";

// Client leaf for the playoff bracket (UI-08). Owns:
//  - the champion banner (NAME ONLY — no score)
//  - the L→R round columns + full-name match cards with derived set-tally
//  - the per-set games popover (.sd-pop, position:fixed) revealed on hover
//    (desktop) / tap (mobile), placed against the trigger's bounding rect,
//    dismissed on outside click, scroll, and pointer-leave
//  - measured elbow connectors between rounds (DEGRADABLE — purely decorative;
//    the columns lay out fine without them via justify-content:space-around).
//
// Receives a fully-serializable payload from the BracketView Server Component —
// no prisma, no business logic. There is NO final score anywhere and no inline
// per-set games; games appear only inside the popover.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export type BracketSlot = {
  name: string | null;
  tally: number | null;
  isWinner: boolean;
};
export type BracketMatchView = {
  id: string;
  isFinal: boolean;
  slotA: BracketSlot;
  slotB: BracketSlot;
  sets: { a: number; b: number }[];
};
export type BracketRound = {
  label: string;
  isFinal: boolean;
  count: number;
  matches: BracketMatchView[];
};

const winMark = (
  <svg
    className="winmark"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

function Slot({ slot, seed }: { slot: BracketSlot; seed: number }) {
  if (slot.name === null) {
    return (
      <div className="slot tbd">
        <span className="seed">{seed}</span>
        <span className="sl-name">Победитель пары</span>
      </div>
    );
  }
  return (
    <div className={`slot ${slot.isWinner ? "win" : ""}`}>
      <span className="seed">{seed}</span>
      <span className="sl-name">{slot.name}</span>
      {slot.tally !== null && <span className="sl-tally">{slot.tally}</span>}
      {winMark}
    </div>
  );
}

export function BracketScrollClient({
  rounds,
  championName,
}: {
  rounds: BracketRound[];
  championName: string | null;
}) {
  const bracketRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  // active match (its per-set games) + whether the popover is pinned (tap)
  const [active, setActive] = useState<BracketMatchView | null>(null);
  const pinnedRef = useRef(false);
  const triggerRef = useRef<HTMLElement | null>(null);

  const placePopover = useCallback(() => {
    const trigger = triggerRef.current;
    const pop = popRef.current;
    if (!trigger || !pop) return;
    const r = trigger.getBoundingClientRect();
    const pr = pop.getBoundingClientRect();
    const left = Math.max(
      8,
      Math.min(r.left + r.width / 2 - pr.width / 2, window.innerWidth - pr.width - 8),
    );
    let top = r.top - pr.height - 10;
    if (top < 8) top = r.bottom + 10; // flip below if no room above
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
  }, []);

  // (re)place the popover whenever its contents change
  useLayoutEffect(() => {
    if (active) placePopover();
  }, [active, placePopover]);

  const show = (match: BracketMatchView, el: HTMLElement) => {
    if (pinnedRef.current) return;
    triggerRef.current = el;
    setActive(match);
  };
  const hide = () => {
    if (pinnedRef.current) return;
    triggerRef.current = null;
    setActive(null);
  };
  const toggle = (e: React.MouseEvent, match: BracketMatchView, el: HTMLElement) => {
    e.stopPropagation();
    if (pinnedRef.current && triggerRef.current === el) {
      pinnedRef.current = false;
      triggerRef.current = null;
      setActive(null);
      return;
    }
    pinnedRef.current = true;
    triggerRef.current = el;
    setActive(match);
  };

  // dismiss a pinned popover on any outside click; dismiss on scroll always
  useEffect(() => {
    const onDocClick = () => {
      if (pinnedRef.current) {
        pinnedRef.current = false;
        triggerRef.current = null;
        setActive(null);
      }
    };
    const onScroll = () => {
      pinnedRef.current = false;
      triggerRef.current = null;
      setActive(null);
    };
    document.addEventListener("click", onDocClick);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("click", onDocClick);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, []);

  // ---- measured elbow connectors (degradable, decorative) ----
  const positionConnectors = useCallback(() => {
    const root = bracketRef.current;
    if (!root) return;
    const roundEls = Array.from(root.querySelectorAll(".round"));
    const matchesByRound = roundEls.map((rd) =>
      Array.from(rd.querySelectorAll<HTMLElement>(".match")),
    );

    const centerY = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      return r.top + r.height / 2;
    };

    // pass 1: vertically center each next-round card on the midpoint of its two
    // feeders (cascades L→R; feeders already centered when read).
    for (let rr = 1; rr < matchesByRound.length; rr++) {
      const prev = matchesByRound[rr - 1];
      const cur = matchesByRound[rr];
      for (let i = 0; i < cur.length; i++) {
        const fTop = prev[i * 2];
        const fBot = prev[i * 2 + 1];
        if (!fTop || !fBot) continue;
        const target = (centerY(fTop) + centerY(fBot)) / 2;
        cur[i].style.transform = "none"; // measure natural position first
        const delta = target - centerY(cur[i]);
        cur[i].style.transform = `translateY(${delta}px)`;
      }
    }

    // pass 2: stretch each elbow to bridge its two feeders, aligning the
    // outgoing stub to the actual next-round match center.
    root.querySelectorAll<HTMLElement>(".connectors").forEach((col) => {
      const gap = Number(col.getAttribute("data-gap"));
      const feeders = matchesByRound[gap];
      const nextRound = matchesByRound[gap + 1];
      const colTop = col.getBoundingClientRect().top;
      col.querySelectorAll<HTMLElement>(".elbow").forEach((elbow, e) => {
        const topM = feeders[e * 2];
        const botM = feeders[e * 2 + 1];
        if (!topM || !botM) return;
        const tc = topM.getBoundingClientRect();
        const bc = botM.getBoundingClientRect();
        const yTop = tc.top + tc.height / 2 - colTop;
        const yBot = bc.top + bc.height / 2 - colTop;
        elbow.style.top = `${yTop}px`;
        elbow.style.height = `${yBot - yTop}px`;
        const nextM = nextRound && nextRound[e];
        const out = elbow.querySelector<HTMLElement>(".out");
        if (nextM && out) {
          const nc = nextM.getBoundingClientRect();
          out.style.top = `${nc.top + nc.height / 2 - colTop - yTop}px`;
        }
      });
    });
  }, []);

  useLayoutEffect(() => {
    // double-rAF: measure once layout settles, then again to catch reflow.
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      positionConnectors();
      raf2 = requestAnimationFrame(positionConnectors);
    });
    // re-measure once webfonts swap (Oswald changes card metrics → drift).
    if (typeof document !== "undefined" && document.fonts?.ready) {
      document.fonts.ready.then(() => positionConnectors());
    }
    window.addEventListener("resize", positionConnectors);
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      window.removeEventListener("resize", positionConnectors);
    };
  }, [positionConnectors, rounds]);

  return (
    <div className="cq">
      {championName && (
        <div className="champ-banner">
          <div className="champ-trophy">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M6 4h12v3a6 6 0 0 1-12 0V4Z" />
              <path d="M6 5H3v2a3 3 0 0 0 3 3" />
              <path d="M18 5h3v2a3 3 0 0 1-3 3" />
              <path d="M9 14.5h6" />
              <path d="M10 20h4" />
              <path d="M12 17v3" />
            </svg>
          </div>
          <div>
            <div className="ch-label">Чемпион турнира</div>
            <div className="ch-name">{championName}</div>
          </div>
        </div>
      )}

      <div className="bracket-scroll">
        <div className="bracket" ref={bracketRef}>
          {rounds.map((round, idx) => {
            const isFinalRound = idx === rounds.length - 1;
            const nextCount = isFinalRound ? 0 : rounds[idx + 1].matches.length;
            let seed = 1;
            return (
              <div key={`r-${idx}`} style={{ display: "contents" }}>
                <div
                  className={`round ${round.isFinal ? "is-final" : ""}`}
                  data-round={idx}
                >
                  <div className="round-label">
                    {round.label}
                    {round.count > 1 && (
                      <span className="rcount"> ×{round.count}</span>
                    )}
                  </div>
                  {round.matches.map((m) => {
                    const seedTop = seed;
                    const seedBot = seed + 1;
                    seed += 2;
                    const isDim =
                      m.slotA.name === null && m.slotB.name === null;
                    const hasDetail = m.sets.length > 0;
                    return (
                      <div
                        key={m.id}
                        className={`match${isDim ? " dim" : ""}${
                          hasDetail ? " has-detail" : ""
                        }`}
                        tabIndex={hasDetail ? 0 : undefined}
                        onMouseEnter={
                          hasDetail
                            ? (e) => show(m, e.currentTarget)
                            : undefined
                        }
                        onMouseLeave={hasDetail ? hide : undefined}
                        onClick={
                          hasDetail
                            ? (e) => toggle(e, m, e.currentTarget)
                            : undefined
                        }
                      >
                        <Slot slot={m.slotA} seed={seedTop} />
                        <Slot slot={m.slotB} seed={seedBot} />
                      </div>
                    );
                  })}
                </div>
                {!isFinalRound && (
                  <div className="connectors" data-gap={idx}>
                    {Array.from({ length: nextCount }).map((_, e) => {
                      const fTop = round.matches[e * 2];
                      const fBot = round.matches[e * 2 + 1];
                      const live =
                        !!fTop &&
                        !!fBot &&
                        !(fTop.slotA.name === null && fTop.slotB.name === null) &&
                        !(fBot.slotA.name === null && fBot.slotB.name === null);
                      return (
                        <div
                          key={`e-${e}`}
                          className={`elbow${live ? " live" : ""}`}
                          data-pair={e}
                        >
                          <span className="spine" />
                          <span className="out" />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div
        ref={popRef}
        className={`sd-pop${active ? " show" : ""}`}
        role="tooltip"
      >
        {active && (
          <div className="sd-grid">
            {active.sets.map((s, i) => (
              <div className="sd-col" key={`s-${i}`}>
                <span className="sd-h">С{i + 1}</span>
                <b className={s.a > s.b ? "w" : ""}>{s.a}</b>
                <b className={s.b > s.a ? "w" : ""}>{s.b}</b>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
