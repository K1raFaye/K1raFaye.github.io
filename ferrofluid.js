/**
 * Ferrofluid — Vanilla JS WebGL fluid simulation background
 * Dependencies: THREE.js (loaded globally via CDN)
 *
 * Ported from React Bits Ferrofluid component (originally ogl-based)
 */
(function () {
  const MAX_COLORS = 8;

  /* ── helpers ── */

  function hexToRGB(hex) {
    const c = hex.replace('#', '').padEnd(6, '0');
    return [
      parseInt(c.slice(0, 2), 16) / 255,
      parseInt(c.slice(2, 4), 16) / 255,
      parseInt(c.slice(4, 6), 16) / 255,
    ];
  }

  function prepColors(input) {
    const base = (
      input && input.length ? input : ['#4F46E5', '#06B6D4', '#E0F2FE']
    ).slice(0, MAX_COLORS);
    const count = base.length;
    const arr = [];
    for (let i = 0; i < MAX_COLORS; i++) {
      arr.push(hexToRGB(base[Math.min(i, base.length - 1)]));
    }
    const avg = [0, 0, 0];
    for (let i = 0; i < count; i++) {
      avg[0] += arr[i][0];
      avg[1] += arr[i][1];
      avg[2] += arr[i][2];
    }
    avg[0] /= count;
    avg[1] /= count;
    avg[2] /= count;
    return { arr, count, avg };
  }

  function flowVec(d) {
    switch (d) {
      case 'up':    return [0, 1];
      case 'down':  return [0, -1];
      case 'left':  return [-1, 0];
      case 'right': return [1, 0];
      default:      return [0, -1];
    }
  }

  /* ── shaders ── */

  const VERTEX_SRC = /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position, 1.0);
    }
  `;

  const FRAGMENT_SRC = /* glsl */ `
    precision highp float;

    uniform vec3  iResolution;
    uniform vec2  iMouse;
    uniform float iTime;

    uniform vec3  uColor0;
    uniform vec3  uColor1;
    uniform vec3  uColor2;
    uniform vec3  uColor3;
    uniform vec3  uColor4;
    uniform vec3  uColor5;
    uniform vec3  uColor6;
    uniform vec3  uColor7;
    uniform int   uColorCount;

    uniform vec3  uMouseColor;
    uniform vec2  uFlow;
    uniform float uSpeed;
    uniform float uScale;
    uniform float uTurbulence;
    uniform float uFluidity;
    uniform float uRimWidth;
    uniform float uSharpness;
    uniform float uShimmer;
    uniform float uGlow;
    uniform float uOpacity;
    uniform float uMouseEnabled;
    uniform float uMouseStrength;
    uniform float uMouseRadius;

    varying vec2 vUv;

    #define PI 3.14159265

    vec3 palette(float h) {
      int count = uColorCount;
      if (count < 1) count = 1;
      int idx = int(floor(clamp(h, 0.0, 0.999999) * float(count)));
      if (idx <= 0) return uColor0;
      if (idx == 1) return uColor1;
      if (idx == 2) return uColor2;
      if (idx == 3) return uColor3;
      if (idx == 4) return uColor4;
      if (idx == 5) return uColor5;
      if (idx == 6) return uColor6;
      return uColor7;
    }

    float hash(vec3 p3) {
      p3 = fract(p3 * 0.1031);
      p3 += dot(p3, p3.zyx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }

    float smin(float a, float b, float k) {
      float r = exp2(-a / k) + exp2(-b / k);
      return -k * log2(r);
    }

    float sinlerp(float a, float b, float w) {
      return mix(a, b, (sin(w * PI - PI / 2.0) + 1.0) / 2.0);
    }

    float vn(vec2 p, float s, float seed) {
      vec2 cellp = floor(p / s);
      vec2 relp = mod(p, s);
      float g1 = hash(vec3(cellp, seed));
      float g2 = hash(vec3(cellp.x + 1.0, cellp.y, seed));
      float g3 = hash(vec3(cellp.x + 1.0, cellp.y + 1.0, seed));
      float g4 = hash(vec3(cellp.x, cellp.y + 1.0, seed));
      float bx = sinlerp(g1, g2, relp.x / s);
      float tx = sinlerp(g4, g3, relp.x / s);
      return sinlerp(bx, tx, relp.y / s);
    }

    float dbn(vec2 p, float s, float seed) {
      float o = s / 2.0;
      float n0 = vn(p, s, seed);
      float n1 = vn(p + vec2(o, o), s, seed + 0.1);
      float n2 = vn(p + vec2(-o, o), s, seed + 0.2);
      float n3 = vn(p + vec2(o, -o), s, seed + 0.3);
      float n4 = vn(p + vec2(-o, -o), s, seed + 0.4);
      return (2.0 * n0 + 1.5 * n1 + 1.25 * n2 + 1.125 * n3 + n4) / 7.0;
    }

    void mainImage(out vec4 fragColor, in vec2 fragCoord) {
      float ref = 700.0 / max(uScale, 0.05);
      vec2 p = fragCoord / iResolution.y * ref;

      float spd = 200.0 * uSpeed;
      float t = iTime;

      vec2 dir = uFlow;
      vec2 perp = vec2(-dir.y, dir.x);

      float distort1 = vn(p + perp * (t * spd), 60.0, 10.0) * 50.0 * uTurbulence;
      float distort2 = vn(p - perp * (t * spd), 120.0, 15.0) * 100.0 * uTurbulence;

      float peaks = dbn(p + distort1 + dir * (t * spd * 0.5), 40.0, 1.0);
      float peaks2 = dbn(p + distort2 - dir * (t * spd * 0.5), 40.0, 0.0);

      float mapeaks = smin(peaks, peaks2, max(uFluidity, 0.001));

      float mGlow = 0.0;
      if (uMouseEnabled > 0.5) {
        vec2 mp = iMouse / iResolution.y * ref;
        float md = length(p - mp) / ref;
        float rr = max(uMouseRadius, 0.02);
        mGlow = exp(-md * md / (rr * rr)) * uMouseStrength;
      }

      float band = (uRimWidth - abs((mapeaks - 0.4) * 2.0)) * 5.0;
      float ltn = clamp(band - vn(p + dir * (t * spd * 0.5), 60.0, 12.0) * uShimmer, 0.0, 1.0);
      ltn = pow(ltn, uSharpness) * uGlow;
      ltn *= clamp(1.0 - mGlow, 0.0, 1.0);

      float h = clamp(0.5 + (peaks - peaks2) * 0.8, 0.0, 1.0);
      vec3 col = palette(h);

      vec3 outc = col * ltn;
      float a = clamp(max(outc.r, max(outc.g, outc.b)), 0.0, 1.0);
      fragColor = vec4(outc, a * uOpacity);
    }

    void main() {
      vec4 color;
      mainImage(color, vUv * iResolution.xy);
      gl_FragColor = color;
    }
  `;

  /* ── class ── */

  class Ferrofluid {
    constructor(container, options = {}) {
      this.container =
        typeof container === 'string'
          ? document.querySelector(container)
          : container;
      if (!this.container)
        throw new Error('Ferrofluid: container element not found');

      this.options = {
        colors: ['#ffffff', '#ffffff', '#ffffff'],
        backgroundColor: null,
        speed: 0.3,
        scale: 1.6,
        turbulence: 1,
        fluidity: 0.1,
        rimWidth: 0.2,
        sharpness: 2.5,
        shimmer: 1.5,
        glow: 1.5,
        flowDirection: 'down',
        opacity: 0.6,
        mouseInteraction: true,
        mouseStrength: 1,
        mouseRadius: 0.35,
        mouseDampening: 0.15,
        paused: false,
        dpr: Math.min(window.devicePixelRatio || 1, 3),
        mixBlendMode: undefined,
        ...options,
      };

      this.visible = true;
      this._raf = 0;
      this._refs = null;
      this._mouseTarget = [0, 0];
      this._lastTime = 0;

      this._init();
    }

    _init() {
      const opts = this.options;
      const canvas = document.createElement('canvas');
      const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      });
      renderer.setPixelRatio(opts.dpr);
      renderer.domElement.style.cssText =
        'width:100%;height:100%;display:block;';
      if (opts.mixBlendMode) {
        renderer.domElement.style.mixBlendMode = opts.mixBlendMode;
      }
      this.container.appendChild(renderer.domElement);

      if (opts.backgroundColor) {
        renderer.setClearColor(new THREE.Color(opts.backgroundColor), 1);
      } else {
        renderer.setClearAlpha(0);
      }

      /* prep colors */
      const { arr, count, avg } = prepColors(opts.colors);

      /* uniforms */
      const uniforms = {
        iResolution: { value: new THREE.Vector3(
          renderer.domElement.width,
          renderer.domElement.height,
          1
        )},
        iMouse: { value: new THREE.Vector2(0, 0) },
        iTime: { value: 0 },
        uColor0: { value: new THREE.Vector3(...arr[0]) },
        uColor1: { value: new THREE.Vector3(...arr[1]) },
        uColor2: { value: new THREE.Vector3(...arr[2]) },
        uColor3: { value: new THREE.Vector3(...arr[3]) },
        uColor4: { value: new THREE.Vector3(...arr[4]) },
        uColor5: { value: new THREE.Vector3(...arr[5]) },
        uColor6: { value: new THREE.Vector3(...arr[6]) },
        uColor7: { value: new THREE.Vector3(...arr[7]) },
        uColorCount: { value: count },
        uMouseColor: { value: new THREE.Vector3(...avg) },
        uFlow: { value: new THREE.Vector2(
          ...flowVec(opts.flowDirection)
        )},
        uSpeed: { value: opts.speed },
        uScale: { value: opts.scale },
        uTurbulence: { value: opts.turbulence },
        uFluidity: { value: opts.fluidity },
        uRimWidth: { value: opts.rimWidth },
        uSharpness: { value: opts.sharpness },
        uShimmer: { value: opts.shimmer },
        uGlow: { value: opts.glow },
        uOpacity: { value: opts.opacity },
        uMouseEnabled: { value: opts.mouseInteraction ? 1 : 0 },
        uMouseStrength: { value: opts.mouseStrength },
        uMouseRadius: { value: opts.mouseRadius },
      };

      /* scene */
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const material = new THREE.ShaderMaterial({
        vertexShader: VERTEX_SRC,
        fragmentShader: FRAGMENT_SRC,
        uniforms,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      });
      const quad = new THREE.Mesh(
        new THREE.PlaneGeometry(2, 2),
        material
      );
      scene.add(quad);

      /* sizing */
      const setSize = () => {
        const w = this.container.clientWidth || 1;
        const h = this.container.clientHeight || 1;
        renderer.setSize(w, h, false);
        uniforms.iResolution.value.set(
          renderer.domElement.width,
          renderer.domElement.height,
          1
        );
      };
      setSize();
      const ro = new ResizeObserver(setSize);
      ro.observe(this.container);

      /* mouse — 监听 document 确保不受 CSS pointer-events 影响 */
      const dpr = opts.dpr;
      const onPointerMove = (e) => {
        const rect = renderer.domElement.getBoundingClientRect();
        const x = (e.clientX - rect.left) * dpr;
        const y = (rect.height - (e.clientY - rect.top)) * dpr;
        this._mouseTarget = [x, y];
        if (opts.mouseDampening <= 0) {
          uniforms.iMouse.value.set(x, y);
        }
      };
      if (opts.mouseInteraction) {
        document.addEventListener('pointermove', onPointerMove, {
          passive: true,
        });
      }

      /* visibility */
      const onVisChange = () => {
        this.visible = document.visibilityState === 'visible';
      };
      document.addEventListener('visibilitychange', onVisChange);

      /* loop */
      const animate = (t) => {
        this._raf = requestAnimationFrame(animate);
        if (!this.visible || opts.paused) return;

        uniforms.iTime.value = t * 0.001;

        /* mouse dampening */
        if (opts.mouseDampening > 0) {
          if (!this._lastTime) this._lastTime = t;
          const dt = (t - this._lastTime) / 1000;
          this._lastTime = t;
          const tau = Math.max(1e-4, opts.mouseDampening);
          let factor = 1 - Math.exp(-dt / tau);
          if (factor > 1) factor = 1;
          const target = this._mouseTarget;
          const cur = uniforms.iMouse.value;
          cur.x += (target[0] - cur.x) * factor;
          cur.y += (target[1] - cur.y) * factor;
        } else {
          this._lastTime = t;
        }

        renderer.render(scene, camera);
      };
      this._raf = requestAnimationFrame(animate);

      this._refs = {
        renderer,
        scene,
        camera,
        material,
        ro,
        uniforms,
        quad,
        onPointerMove,
        onVisChange,
        animate,
        setSize,
      };
    }

    /* ─── public API ─── */

    setOptions(opts) {
      Object.assign(this.options, opts);
      const r = this._refs;
      if (!r) return;
      const u = r.uniforms;

      if (opts.speed !== undefined) u.uSpeed.value = opts.speed;
      if (opts.scale !== undefined) u.uScale.value = opts.scale;
      if (opts.turbulence !== undefined)
        u.uTurbulence.value = opts.turbulence;
      if (opts.fluidity !== undefined)
        u.uFluidity.value = opts.fluidity;
      if (opts.rimWidth !== undefined)
        u.uRimWidth.value = opts.rimWidth;
      if (opts.sharpness !== undefined)
        u.uSharpness.value = opts.sharpness;
      if (opts.shimmer !== undefined)
        u.uShimmer.value = opts.shimmer;
      if (opts.glow !== undefined) u.uGlow.value = opts.glow;
      if (opts.flowDirection !== undefined)
        u.uFlow.value.set(...flowVec(opts.flowDirection));
      if (opts.opacity !== undefined)
        u.uOpacity.value = opts.opacity;
      if (opts.mouseInteraction !== undefined)
        u.uMouseEnabled.value = opts.mouseInteraction ? 1 : 0;
      if (opts.mouseStrength !== undefined)
        u.uMouseStrength.value = opts.mouseStrength;
      if (opts.mouseRadius !== undefined)
        u.uMouseRadius.value = opts.mouseRadius;

      if (opts.colors !== undefined) {
        const { arr, count, avg } = prepColors(opts.colors);
        for (let i = 0; i < 8; i++) {
          u['uColor' + i].value.set(...arr[i]);
        }
        u.uColorCount.value = count;
        u.uMouseColor.value.set(...avg);
      }
    }

    setPointerEvents(enabled) {
      const el = this._refs?.renderer?.domElement;
      if (el) el.style.pointerEvents = enabled ? 'auto' : 'none';
    }

    getCanvas() {
      return this._refs?.renderer?.domElement || null;
    }

    destroy() {
      const r = this._refs;
      if (!r) return;
      cancelAnimationFrame(this._raf);
      r.ro?.disconnect();
      document.removeEventListener('visibilitychange', r.onVisChange);
      if (this.options.mouseInteraction) {
        document.removeEventListener(
          'pointermove',
          r.onPointerMove
        );
      }
      r.quad?.geometry?.dispose();
      r.material?.dispose();
      r.renderer?.dispose();
      r.renderer?.forceContextLoss();
      if (
        r.renderer?.domElement?.parentElement === this.container
      ) {
        this.container.removeChild(r.renderer.domElement);
      }
      this._refs = null;
    }
  }

  window.Ferrofluid = Ferrofluid;
})();
