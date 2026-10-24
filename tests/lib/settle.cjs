// Waits for the page's finite CSS animations (entrance fades, staggered cards) to finish, so checks such as
// axe colour contrast measure the settled page rather than a half-faded frame. Looping animations
// (spinners, skeleton pulse) are ignored.
const settleAnimations = (page) =>
  page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => {
          const t = a.effect && a.effect.getComputedTiming ? a.effect.getComputedTiming() : null;
          return t && Number.isFinite(t.endTime);
        })
        .map((a) => a.finished.catch(() => {}))
    )
  );

module.exports = { settleAnimations };
