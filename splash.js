/**
 * Splash Screen Orchestration
 *
 * Sequence:
 *   1. Ferrofluid WebGL background starts immediately
 *   2. 400ms 后 DecryptedText 逐字揭示 "CQB Mapping Tool"
 *   3. 揭示完成后 → 切换为 ShinyText 渐变流光 + TextType 打字 "By KiraFaye"
 *   4. 用户左键点击任意位置 → 关闭启动画面，进入主界面
 *
 * Dependencies (must be loaded before this script):
 *   - THREE.js           (CDN) — window.THREE
 *   - GSAP               (CDN) — window.gsap
 *   - ferrofluid.js             — window.Ferrofluid
 *   - decrypted-text.js        — window.DecryptedText
 *   - text-type.js             — window.TextType
 */
(function () {
  function waitForDeps(cb) {
    if (
      window.THREE &&
      window.Ferrofluid &&
      window.DecryptedText &&
      window.TextType
    ) {
      cb();
    } else {
      setTimeout(function () { waitForDeps(cb); }, 50);
    }
  }

  function init() {
    /* ── 1. Ferrofluid background ── */
    var bg = new window.Ferrofluid('#pixelBlastBg', {
      colors: ['#ffffff'],
      backgroundColor: '#000000',
      speed: 0.3,
      scale: 1.6,
      turbulence: 1,
      fluidity: 0.1,
      rimWidth: 0.2,
      sharpness: 2.5,
      shimmer: 1.5,
      glow: 1.5,
      flowDirection: 'down',
      opacity: 1,
      mouseInteraction: false,
    });

    var splashScreen = document.getElementById('splashScreen');
    var mainApp = document.getElementById('mainApp');
    var splashTitle = document.getElementById('splashTitle');
    var splashSubtitle = document.getElementById('splashSubtitle');

    /* ── 2. DecryptedText 揭示 → 切换 ShinyText 流光 ── */
    var decrypted = new window.DecryptedText(splashTitle, {
      text: 'CQB Mapping Tool',
      speed: 55,
      sequential: true,
      revealDirection: 'start',
      characters:
        'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*',
      encryptedClass: 'decrypted-encrypted',
      revealedClass: 'decrypted-revealed',
      onComplete: function () {
        /* 揭示完成 → 叠加 ShinyText 渐变流光 */
        splashTitle.classList.add('shiny-text');

        /* ── 3. TextType 副标题 ── */
        setTimeout(function () {
          var typed = new window.TextType(splashSubtitle, {
            text: ['By KiraFaye'],
            typingSpeed: 75,
            initialDelay: 200,
            pauseDuration: 1200,
            loop: false,
            showCursor: true,
            cursorCharacter: '|',
            cursorBlinkDuration: 0.5,
          });
          typed.start();
        }, 250);
      },
    });

    setTimeout(function () {
      decrypted.start();
    }, 400);

    /* ── 4. 左键点击关闭 ── */
    var splashDone = false;
    function finishSplash() {
      if (splashDone) return;
      splashDone = true;

      splashScreen.classList.add('fade-out');
      bg.setPointerEvents(false);
      var pixelBg = document.getElementById('pixelBlastBg');
      pixelBg.classList.add('inactive', 'fade-out');

      mainApp.style.display = '';

      if (typeof window.initCQBApp === 'function') {
        window.initCQBApp();
      }

      setTimeout(function () {
        if (splashScreen.parentElement) {
          splashScreen.style.display = 'none';
        }
        if (pixelBg.parentElement) {
          pixelBg.style.display = 'none';
        }
      }, 800);
    }

    splashScreen.addEventListener('click', function () {
      finishSplash();
    });
  }

  if (
    document.readyState === 'complete' ||
    document.readyState === 'interactive'
  ) {
    waitForDeps(init);
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      waitForDeps(init);
    });
  }
})();
