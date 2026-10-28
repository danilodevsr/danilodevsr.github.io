/* GSAP-DEMO:scrubbed-bento-gallery v1 | Source: GreenSock (https://codepen.io/GreenSock/pen/vYMzKZx) */
/* GSAP-DEMO:rolling-text v1 | Source: GreenSock (https://codepen.io/GreenSock/pen/dPMjJWv) */
/* GSAP-DEMO:curve-swipe v1 | Source: GreenSock (https://codepen.io/GreenSock/pen/EaKpEpJ) */
/* GSAP-DEMO:pinned-panels-with-overscroll v1 | Source: GreenSock (https://codepen.io/GreenSock/pen/bGRdvMy) */
/* GSAP-DEMO:easereverse-ui-interactions v1 | Source: GreenSock (https://demos.gsap.com/demo/easereverse-ui-interactions/) */
/* Adapted for Xbox Next Gen Showcase */

gsap.registerPlugin(ScrollTrigger, Flip, SplitText, MorphSVGPlugin);

// ==========================================
// SECTION 1: HERO GALLERY (Flip + ScrollTrigger)
// ==========================================
let flipCtx;

const initHeroGallery = () => {
  const galleryElement = document.querySelector("#gallery-hero");
  if (!galleryElement) return;

  const galleryItems = galleryElement.querySelectorAll(".gallery__item");

  if (flipCtx) flipCtx.revert();
  galleryElement.classList.remove("gallery--final");

  flipCtx = gsap.context(() => {
    galleryElement.classList.add("gallery--final");
    const flipState = Flip.getState(galleryItems);
    galleryElement.classList.remove("gallery--final");

    const flip = Flip.to(flipState, {
      simple: true,
      ease: "expoScale(1, 5)"
    });

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: galleryElement,
        start: "center center",
        end: "+=120%",
        scrub: 1,
        pin: galleryElement.parentNode,
        invalidateOnRefresh: true
      }
    });

    tl.add(flip);

    return () => gsap.set(galleryItems, { clearProps: "all" });
  });
};

// ==============================================================
// SECTION 2: ROLLING TEXT + CURVE SWIPE (FUSED MONOCHROME BLOCK)
// ==============================================================
let titleSwipeCtx;

const initTitleAndSwipe = () => {
  const section = document.querySelector("#product-title-section");
  const path = document.querySelector(".swipe-path");
  const rollingContainer = document.querySelector(".rolling-container");
  const lines = document.querySelectorAll(".tube .line");

  if (!section || !path || !rollingContainer || lines.length === 0) return;

  if (titleSwipeCtx) titleSwipeCtx.revert();

  titleSwipeCtx = gsap.context(() => {
    gsap.set(rollingContainer, { visibility: "visible" });

    const splitLines = Array.from(lines).map(line =>
      new SplitText(line, { type: "chars", charsClass: "char" })
    );

    const depth = -Math.min(window.innerWidth, 1400) / 10;
    const transformOrigin = `50% 50% ${depth}px`;

    gsap.set(lines, { perspective: 900, transformStyle: "preserve-3d" });

    splitLines.forEach(split => {
      gsap.set(split.chars, { rotationX: -90, transformOrigin });
    });

    const startCurve = "M 0 100 V 50 Q 50 0 100 50 V 100 z";
    const endCurve = "M 0 100 V 0 Q 50 0 100 0 V 100 z";

    const mainTl = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: "top top",
        end: "+=160%",
        pin: true,
        scrub: 1,
        invalidateOnRefresh: true
      }
    });

    mainTl.to(path, {
      morphSVG: startCurve,
      ease: "power2.inOut",
      duration: 1
    })
    .to(path, {
      morphSVG: endCurve,
      ease: "power2.inOut",
      duration: 1
    }, "-=0.15");

    const animDuration = 1.2;
    splitLines.forEach((split, index) => {
      mainTl.to(
        split.chars,
        {
          rotationX: 90,
          stagger: 0.035,
          duration: animDuration,
          ease: "none",
          transformOrigin
        },
        0.35 + index * 0.35
      );
    });

    return () => {
      splitLines.forEach(split => split.revert());
      gsap.set(path, { clearProps: "all" });
    };
  });
};

// ==============================================================
// SECTION 3: PINNED PANELS WITH OVERSCROLL (TECHNICAL SPECS)
// ==============================================================
let panelsCtx;

const initPinnedPanels = () => {
  const panels = gsap.utils.toArray(".spec-panel");
  if (panels.length === 0) return;

  if (panelsCtx) panelsCtx.revert();

  panelsCtx = gsap.context(() => {
    const animatedPanels = panels.slice(0, -1);

    animatedPanels.forEach((panel) => {
      const innerpanel = panel.querySelector(".spec-panel-inner");
      if (!innerpanel) return;

      const panelHeight = innerpanel.offsetHeight;
      const windowHeight = window.innerHeight;
      const difference = panelHeight - windowHeight;

      const fakeScrollRatio = difference > 0 ? (difference / (difference + windowHeight)) : 0;

      if (fakeScrollRatio) {
        panel.style.marginBottom = panelHeight * fakeScrollRatio + "px";
      }

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: panel,
          start: "bottom bottom",
          end: () => fakeScrollRatio ? `+=${innerpanel.offsetHeight}` : "bottom top",
          pinSpacing: false,
          pin: true,
          scrub: true,
          invalidateOnRefresh: true
        }
      });

      if (fakeScrollRatio) {
        tl.to(innerpanel, {
          yPercent: -100,
          y: window.innerHeight,
          duration: 1 / (1 - fakeScrollRatio) - 1,
          ease: "none"
        });
      }

      tl.fromTo(panel, { scale: 1, opacity: 1 }, { scale: 0.85, opacity: 0.4, duration: 0.9 })
        .to(panel, { opacity: 0, duration: 0.1 });
    });
  });
};

// ==============================================================
// SECTION 4: CTA BUTTON HOVER (DEMO-12: easereverse-ui-interactions)
// ==============================================================
let btnTl;

const initCtaButton = () => {
  const buyBtn = document.querySelector("#xboxBuyBtn");
  if (!buyBtn) return;

  if (btnTl) btnTl.kill();
  gsap.set(buyBtn, { clearProps: "all" });

  // Elastic scale enter with smooth power2.out easeReverse
  btnTl = gsap.timeline({ paused: true })
    .to(buyBtn, {
      scale: 1.16,
      duration: 1.1,
      ease: "elastic.out(1.2, 0.3)",
      easeReverse: "power2.out"
    }, 0);

  buyBtn.addEventListener("mouseenter", () => {
    btnTl.timeScale(1).play();
  });

  buyBtn.addEventListener("mouseleave", () => {
    // Exit speed acceleration as demonstrated in DEMO-12
    btnTl.timeScale(2.5).reverse();
  });
};

// ==========================================
// Initialization on Load & Resize
// ==========================================
const initAll = () => {
  initHeroGallery();
  initTitleAndSwipe();
  initPinnedPanels();
  initCtaButton();
  ScrollTrigger.refresh();
};

window.addEventListener("load", initAll);
window.addEventListener("resize", () => {
  initAll();
});
