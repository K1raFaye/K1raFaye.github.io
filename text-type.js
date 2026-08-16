/**
 * TextType — Vanilla JS typewriter text effect
 * Dependencies: GSAP (loaded globally via CDN) for cursor blink
 *
 * Ported from React Bits TextType component.
 */
(function () {
  class TextType {
    /**
     * @param {string|HTMLElement} container
     * @param {object} options
     * @param {string|string[]} options.text           - Text(s) to type out
     * @param {number} options.typingSpeed             - ms per character typed
     * @param {number} options.initialDelay            - ms before typing starts
     * @param {number} options.pauseDuration           - ms to hold after typing
     * @param {number} options.deletingSpeed           - ms per character deleted
     * @param {boolean} options.loop                   - loop through text array
     * @param {boolean} options.showCursor             - show blinking cursor
     * @param {string} options.cursorCharacter         - cursor character
     * @param {string} options.cursorClassName         - CSS class for cursor
     * @param {number} options.cursorBlinkDuration     - gsap blink duration
     * @param {function} options.onComplete            - callback when done
     */
    constructor(container, options = {}) {
      this.container =
        typeof container === 'string'
          ? document.querySelector(container)
          : container;
      if (!this.container)
        throw new Error('TextType: container not found');

      this.options = {
        text: [],
        typingSpeed: 50,
        initialDelay: 0,
        pauseDuration: 2000,
        deletingSpeed: 30,
        loop: false,
        showCursor: true,
        cursorCharacter: '|',
        cursorClassName: '',
        cursorBlinkDuration: 0.5,
        onComplete: null,
        ...options,
      };

      this._textArray = Array.isArray(this.options.text)
        ? this.options.text
        : [this.options.text];

      this._currentTextIndex = 0;
      this._currentCharIndex = 0;
      this._isDeleting = false;
      this._displayedText = '';
      this._timeout = null;
      this._cursorEl = null;
      this._contentEl = null;

      this._buildDOM();
    }

    /* ─── DOM ─── */

    _buildDOM() {
      this.container.innerHTML = '';
      this.container.className =
        'text-type ' + (this.container.className || '');

      this._contentEl = document.createElement('span');
      this._contentEl.className = 'text-type__content';
      this.container.appendChild(this._contentEl);

      if (this.options.showCursor) {
        this._cursorEl = document.createElement('span');
        this._cursorEl.className =
          'text-type__cursor ' +
          (this.options.cursorClassName || '');
        this._cursorEl.textContent = this.options.cursorCharacter;
        this.container.appendChild(this._cursorEl);

        /* GSAP blink */
        if (typeof gsap !== 'undefined') {
          gsap.set(this._cursorEl, { opacity: 1 });
          gsap.to(this._cursorEl, {
            opacity: 0,
            duration: this.options.cursorBlinkDuration,
            repeat: -1,
            yoyo: true,
            ease: 'power2.inOut',
          });
        }
      }
    }

    _updateContent(text) {
      this._contentEl.textContent = text;
    }

    /* ─── typing logic ─── */

    start() {
      this._currentTextIndex = 0;
      this._currentCharIndex = 0;
      this._isDeleting = false;
      this._displayedText = '';
      this._updateContent('');
      this._scheduleNext(this.options.initialDelay);
    }

    _scheduleNext(delay) {
      this._timeout = setTimeout(() => this._tick(), delay);
    }

    _tick() {
      const currentFullText = this._textArray[this._currentTextIndex];

      if (this._isDeleting) {
        if (this._displayedText === '') {
          /* done deleting */
          this._isDeleting = false;

          if (
            this._currentTextIndex === this._textArray.length - 1 &&
            !this.options.loop
          ) {
            /* finished all texts, no loop */
            if (this.options.onComplete)
              this.options.onComplete();
            return;
          }

          this._currentTextIndex =
            (this._currentTextIndex + 1) % this._textArray.length;
          this._currentCharIndex = 0;
          this._scheduleNext(this.options.pauseDuration);
        } else {
          this._displayedText = this._displayedText.slice(0, -1);
          this._updateContent(this._displayedText);
          this._scheduleNext(this.options.deletingSpeed);
        }
      } else {
        if (this._currentCharIndex < currentFullText.length) {
          this._displayedText +=
            currentFullText[this._currentCharIndex];
          this._currentCharIndex++;
          this._updateContent(this._displayedText);
          this._scheduleNext(this.options.typingSpeed);
        } else {
          /* done typing current text */
          if (
            !this.options.loop &&
            this._currentTextIndex === this._textArray.length - 1
          ) {
            if (this.options.onComplete)
              this.options.onComplete();
            return;
          }

          if (this._textArray.length > 1 || this.options.loop) {
            this._scheduleNext(this.options.pauseDuration);
            this._isDeleting = true;
          } else if (this.options.onComplete) {
            this.options.onComplete();
          }
        }
      }
    }

    /* ─── visibility control ─── */

    hideCursor() {
      if (this._cursorEl)
        this._cursorEl.classList.add('text-type__cursor--hidden');
    }

    showCursor() {
      if (this._cursorEl)
        this._cursorEl.classList.remove('text-type__cursor--hidden');
    }

    /* ─── cleanup ─── */

    destroy() {
      if (this._timeout) clearTimeout(this._timeout);
      if (this._cursorEl && typeof gsap !== 'undefined') {
        gsap.killTweensOf(this._cursorEl);
      }
      this.container.innerHTML = '';
    }
  }

  window.TextType = TextType;
})();
