/**
 * DecryptedText — Vanilla JS text scramble / reveal effect
 *
 * Ported from React Bits DecryptedText component.
 * No framework dependencies — pure JS with DOM manipulation.
 */
(function () {
  class DecryptedText {
    /**
     * @param {string|HTMLElement} container
     * @param {object} options
     * @param {string} options.text          - The text to reveal
     * @param {number} options.speed         - ms between each scramble iteration
     * @param {number} options.maxIterations - max random iterations (non-seq mode)
     * @param {boolean} options.sequential   - reveal one character at a time
     * @param {'start'|'end'|'center'} options.revealDirection
     * @param {string} options.characters    - pool of random chars for scramble
     * @param {string} options.encryptedClass - CSS class for scrambled chars
     * @param {string} options.revealedClass  - CSS class for revealed chars
     * @param {function} options.onComplete   - callback when reveal finishes
     * @param {boolean} options.autoStart     - start immediately
     * @param {number} options.startDelay     - delay before auto-start (ms)
     */
    constructor(container, options = {}) {
      this.container =
        typeof container === 'string'
          ? document.querySelector(container)
          : container;
      if (!this.container)
        throw new Error('DecryptedText: container not found');

      this.options = {
        text: '',
        speed: 50,
        maxIterations: 10,
        sequential: false,
        revealDirection: 'start',
        characters:
          'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!@#$%^&*()_+',
        encryptedClass: 'decrypted-encrypted',
        revealedClass: 'decrypted-revealed',
        onComplete: null,
        autoStart: false,
        startDelay: 0,
        ...options,
      };

      this.revealedIndices = new Set();
      this.isAnimating = false;
      this.isDecrypted = false;
      this._intervalRef = null;
      this._direction = 'forward';
      this._iterationCount = 0;
      this._orderRef = [];
      this._pointerRef = 0;
      this._spans = [];

      this._availableChars = this.options.characters.split('');
      this._buildDOM();

      if (this.options.autoStart) {
        setTimeout(() => this.start(), this.options.startDelay);
      }
    }

    /* ─── DOM ─── */

    _buildDOM() {
      this.container.innerHTML = '';
      this._spans = [];
      const text = this.options.text;
      /* 初始显示乱码，不提前暴露原文 */
      for (let i = 0; i < text.length; i++) {
        const span = document.createElement('span');
        if (text[i] === ' ') {
          span.textContent = ' ';
        } else {
          span.textContent =
            this._availableChars[
              Math.floor(Math.random() * this._availableChars.length)
            ];
        }
        span.className = this.options.encryptedClass;
        this.container.appendChild(span);
        this._spans.push(span);
      }
      /* 保存初始乱码文本供后续使用 */
      this._displayText = Array.from(this._spans).map(s => s.textContent).join('');
    }

    _updateDOM() {
      const text = this.options.text;
      for (let i = 0; i < this._spans.length; i++) {
        const isRevealed =
          this.revealedIndices.has(i) ||
          (!this.isAnimating && this.isDecrypted);
        this._spans[i].textContent = this._displayText[i] || ' ';
        this._spans[i].className = isRevealed
          ? this.options.revealedClass
          : this.options.encryptedClass;
      }
    }

    /* ─── helpers ─── */

    _shuffleText(currentRevealed) {
      const text = this.options.text;
      return text
        .split('')
        .map((char, i) => {
          if (char === ' ') return ' ';
          if (currentRevealed.has(i)) return text[i];
          return this._availableChars[
            Math.floor(Math.random() * this._availableChars.length)
          ];
        })
        .join('');
    }

    _computeOrder(len) {
      const order = [];
      if (len <= 0) return order;
      const dir = this.options.revealDirection;

      if (dir === 'start') {
        for (let i = 0; i < len; i++) order.push(i);
      } else if (dir === 'end') {
        for (let i = len - 1; i >= 0; i--) order.push(i);
      } else {
        /* center */
        const middle = Math.floor(len / 2);
        let offset = 0;
        while (order.length < len) {
          if (offset % 2 === 0) {
            const idx = middle + offset / 2;
            if (idx >= 0 && idx < len) order.push(idx);
          } else {
            const idx = middle - Math.ceil(offset / 2);
            if (idx >= 0 && idx < len) order.push(idx);
          }
          offset++;
        }
      }
      return order.slice(0, len);
    }

    _getNextIndex(revealedSet) {
      const textLength = this.options.text.length;
      const dir = this.options.revealDirection;

      if (dir === 'start') return revealedSet.size;
      if (dir === 'end') return textLength - 1 - revealedSet.size;

      /* center */
      const middle = Math.floor(textLength / 2);
      const offset = Math.floor(revealedSet.size / 2);
      const nextIndex =
        revealedSet.size % 2 === 0
          ? middle + offset
          : middle - offset - 1;

      if (
        nextIndex >= 0 &&
        nextIndex < textLength &&
        !revealedSet.has(nextIndex)
      ) {
        return nextIndex;
      }

      for (let i = 0; i < textLength; i++) {
        if (!revealedSet.has(i)) return i;
      }
      return 0;
    }

    /* ─── public API ─── */

    start() {
      if (this.isAnimating) return;
      this.isAnimating = true;
      this.isDecrypted = false;
      this.revealedIndices = new Set();
      this._direction = 'forward';
      this._iterationCount = 0;
      this._pointerRef = 0;

      const text = this.options.text;

      if (this.options.sequential) {
        this._orderRef = this._computeOrder(text.length);
      }

      this._intervalRef = setInterval(() => {
        if (this.options.sequential) {
          /* ── Sequential forward ── */
          if (this._pointerRef < this._orderRef.length) {
            const idx = this._orderRef[this._pointerRef++];
            this.revealedIndices.add(idx);
            this._displayText = this._shuffleText(
              this.revealedIndices
            );
            this._updateDOM();
          } else {
            this._finish(text);
          }
        } else {
          /* ── Non-sequential ── */
          this._displayText = this._shuffleText(
            this.revealedIndices
          );
          this._updateDOM();
          this._iterationCount++;
          if (this._iterationCount >= this.options.maxIterations) {
            this._finish(text);
          }
        }
      }, this.options.speed);
    }

    _finish(text) {
      clearInterval(this._intervalRef);
      this._intervalRef = null;
      this.isAnimating = false;
      this.isDecrypted = true;
      this._displayText = text;
      /* mark all as revealed */
      for (let i = 0; i < text.length; i++)
        this.revealedIndices.add(i);
      this._updateDOM();
      if (this.options.onComplete) this.options.onComplete();
    }

    reset() {
      if (this._intervalRef) {
        clearInterval(this._intervalRef);
        this._intervalRef = null;
      }
      this.isAnimating = false;
      this.isDecrypted = false;
      this.revealedIndices = new Set();
      this._displayText = this.options.text;
      this._buildDOM();
    }

    destroy() {
      if (this._intervalRef) clearInterval(this._intervalRef);
      this.container.innerHTML = this.options.text;
    }
  }

  window.DecryptedText = DecryptedText;
})();
