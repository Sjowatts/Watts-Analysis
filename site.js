/* Watts Analysis — shared behaviour.
   Everything here is progressive: with JS off, or if anything below
   throws, the page renders at full opacity. Content is never left
   hidden waiting on a callback. */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* --- Sticky header: soften the edge only once content is behind it. --- */
  var header = document.querySelector(".site-header");
  if (header) {
    var ticking = false;
    var sync = function () {
      ticking = false;
      header.classList.toggle("is-scrolled", window.scrollY > 8);
    };
    window.addEventListener(
      "scroll",
      function () {
        if (!ticking) {
          ticking = true;
          window.requestAnimationFrame(sync);
        }
      },
      { passive: true }
    );
    sync();
  }

  /* --- Reveal below-fold sections as they arrive, never the hero. --- */
  if (reduceMotion.matches || !("IntersectionObserver" in window)) return;

  var pending = [];
  var clear = function () {
    pending.forEach(function (section) {
      section.classList.remove("reveal");
    });
    pending = [];
  };

  try {
    pending = Array.prototype.slice
      .call(document.querySelectorAll("main > section"))
      .filter(function (section, index) {
        if (index === 0) return false; // the hero must be there immediately
        return section.getBoundingClientRect().top > window.innerHeight * 0.9;
      });

    if (!pending.length) return;

    pending.forEach(function (section) {
      section.classList.add("reveal");
    });

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -12% 0px" }
    );

    pending.forEach(function (section) {
      observer.observe(section);
    });

    /* Safety net: if the observer never delivers — a frozen tab, a
       throttled background render, anything unforeseen — show the
       content outright rather than leaving the page blank. */
    window.setTimeout(function () {
      pending
        .filter(function (section) {
          return !section.classList.contains("is-visible");
        })
        .forEach(function (section) {
          section.classList.remove("reveal");
        });
    }, 2500);

    window.addEventListener("beforeprint", clear);
  } catch (err) {
    clear();
  }
})();
