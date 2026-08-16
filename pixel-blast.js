/**
 * PixelBlast — Vanilla JS WebGL Bayer dithering background
 * Dependencies: THREE.js (loaded globally via CDN)
 *
 * Ported from React Bits PixelBlast component
 * Original: github.com/zavalit/bayer-dithering-webgl-demo
 */
(function () {
  const SHAPE_MAP = { square: 0, circle: 1, triangle: 2, diamond: 3 };
  const MAX_CLICKS = 10;

  const VERTEX_SRC = /* glsl */ `
    void main() {
      gl_Position = vec4(position, 1.0);
    }
  `;

  const FRAGMENT_SRC = /* glsl */ `
    precision highp float;

    uniform vec3  uColor;
    uniform vec2  uResolution;
    uniform float uTime;
    uniform float uPixelSize;
    uniform float uScale;
    uniform float uDensity;
    uniform float uPixelJitter;
    uniform int   uEnableRipples;
    uniform float uRippleSpeed;
    uniform float uRippleThickness;
    uniform float uRippleIntensity;
    uniform float uEdgeFade;

    uniform int   uShapeType;
    const int SHAPE_SQUARE   = 0;
    const int SHAPE_CIRCLE   = 1;
    const int SHAPE_TRIANGLE = 2;
    const int SHAPE_DIAMOND  = 3;

    const int   MAX_CLICKS = 10;

    uniform vec2  uClickPos  [MAX_CLICKS];
    uniform float uClickTimes[MAX_CLICKS];

    out vec4 fragColor;

    float Bayer2(vec2 a) {
      a = floor(a);
      return fract(a.x / 2. + a.y * a.y * .75);
    }
    #define Bayer4(a) (Bayer2(.5*(a))*0.25 + Bayer2(a))
    #define Bayer8(a) (Bayer4(.5*(a))*0.25 + Bayer2(a))

    #define FBM_OCTAVES     5
    #define FBM_LACUNARITY  1.25
    #define FBM_GAIN        1.0

    float hash11(float n){ return fract(sin(n)*43758.5453); }

    float vnoise(vec3 p){
      vec3 ip = floor(p);
      vec3 fp = fract(p);
      float n000 = hash11(dot(ip + vec3(0.0,0.0,0.0), vec3(1.0,57.0,113.0)));
      float n100 = hash11(dot(ip + vec3(1.0,0.0,0.0), vec3(1.0,57.0,113.0)));
      float n010 = hash11(dot(ip + vec3(0.0,1.0,0.0), vec3(1.0,57.0,113.0)));
      float n110 = hash11(dot(ip + vec3(1.0,1.0,0.0), vec3(1.0,57.0,113.0)));
      float n001 = hash11(dot(ip + vec3(0.0,0.0,1.0), vec3(1.0,57.0,113.0)));
      float n101 = hash11(dot(ip + vec3(1.0,0.0,1.0), vec3(1.0,57.0,113.0)));
      float n011 = hash11(dot(ip + vec3(0.0,1.0,1.0), vec3(1.0,57.0,113.0)));
      float n111 = hash11(dot(ip + vec3(1.0,1.0,1.0), vec3(1.0,57.0,113.0)));
      vec3 w = fp*fp*fp*(fp*(fp*6.0-15.0)+10.0);
      float x00 = mix(n000, n100, w.x);
      float x10 = mix(n010, n110, w.x);
      float x01 = mix(n001, n101, w.x);
      float x11 = mix(n011, n111, w.x);
      float y0  = mix(x00, x10, w.y);
      float y1  = mix(x01, x11, w.y);
      return mix(y0, y1, w.z) * 2.0 - 1.0;
    }

    float fbm2(vec2 uv, float t){
      vec3 p = vec3(uv * uScale, t);
      float amp = 1.0;
      float freq = 1.0;
      float sum = 1.0;
      for (int i = 0; i < FBM_OCTAVES; ++i){
        sum  += amp * vnoise(p * freq);
        freq *= FBM_LACUNARITY;
        amp  *= FBM_GAIN;
      }
      return sum * 0.5 + 0.5;
    }

    float maskCircle(vec2 p, float cov){
      float r = sqrt(cov) * .25;
      float d = length(p - 0.5) - r;
      float aa = 0.5 * fwidth(d);
      return cov * (1.0 - smoothstep(-aa, aa, d * 2.0));
    }

    float maskTriangle(vec2 p, vec2 id, float cov){
      bool flip = mod(id.x + id.y, 2.0) > 0.5;
      if (flip) p.x = 1.0 - p.x;
      float r = sqrt(cov);
      float d  = p.y - r*(1.0 - p.x);
      float aa = fwidth(d);
      return cov * clamp(0.5 - d/aa, 0.0, 1.0);
    }

    float maskDiamond(vec2 p, float cov){
      float r = sqrt(cov) * 0.564;
      return step(abs(p.x - 0.49) + abs(p.y - 0.49), r);
    }

    void main(){
      float pixelSize = uPixelSize;
      vec2 fragCoord = gl_FragCoord.xy - uResolution * .5;
      float aspectRatio = uResolution.x / uResolution.y;

      vec2 pixelId = floor(fragCoord / pixelSize);
      vec2 pixelUV = fract(fragCoord / pixelSize);

      float cellPixelSize = 8.0 * pixelSize;
      vec2 cellId = floor(fragCoord / cellPixelSize);
      vec2 cellCoord = cellId * cellPixelSize;
      vec2 uv = cellCoord / uResolution * vec2(aspectRatio, 1.0);

      float base = fbm2(uv, uTime * 0.05);
      base = base * 0.5 - 0.65;

      float feed = base + (uDensity - 0.5) * 0.3;

      float speed     = uRippleSpeed;
      float thickness = uRippleThickness;
      const float dampT     = 1.0;
      const float dampR     = 10.0;

      if (uEnableRipples == 1) {
        for (int i = 0; i < MAX_CLICKS; ++i){
          vec2 pos = uClickPos[i];
          if (pos.x < 0.0) continue;
          float cellPixelSize2 = 8.0 * pixelSize;
          vec2 cuv = (((pos - uResolution * .5 - cellPixelSize2 * .5) / (uResolution))) * vec2(aspectRatio, 1.0);
          float t = max(uTime - uClickTimes[i], 0.0);
          float r = distance(uv, cuv);
          float waveR = speed * t;
          float ring  = exp(-pow((r - waveR) / thickness, 2.0));
          float atten = exp(-dampT * t) * exp(-dampR * r);
          feed = max(feed, ring * atten * uRippleIntensity);
        }
      }

      float bayer = Bayer8(fragCoord / uPixelSize) - 0.5;
      float bw = step(0.5, feed + bayer);

      float h = fract(sin(dot(floor(fragCoord / uPixelSize), vec2(127.1, 311.7))) * 43758.5453);
      float jitterScale = 1.0 + (h - 0.5) * uPixelJitter;
      float coverage = bw * jitterScale;
      float M;
      if      (uShapeType == SHAPE_CIRCLE)   M = maskCircle (pixelUV, coverage);
      else if (uShapeType == SHAPE_TRIANGLE) M = maskTriangle(pixelUV, pixelId, coverage);
      else if (uShapeType == SHAPE_DIAMOND)  M = maskDiamond(pixelUV, coverage);
      else                                   M = coverage;

      if (uEdgeFade > 0.0) {
        vec2 norm = gl_FragCoord.xy / uResolution;
        float edge = min(min(norm.x, norm.y), min(1.0 - norm.x, 1.0 - norm.y));
        float fade = smoothstep(0.0, uEdgeFade, edge);
        M *= fade;
      }

      vec3 color = uColor;

      vec3 srgbColor = mix(
        color * 12.92,
        1.055 * pow(color, vec3(1.0 / 2.4)) - 0.055,
        step(0.0031308, color)
      );

      fragColor = vec4(srgbColor, M);
    }
  `;

  class PixelBlast {
    constructor(container, options = {}) {
      this.container =
        typeof container === 'string'
          ? document.querySelector(container)
          : container;
      if (!this.container)
        throw new Error('PixelBlast: container element not found');

      this.options = {
        variant: 'circle',
        pixelSize: 4,
        color: '#5B8DEF',
        patternScale: 2,
        patternDensity: 1,
        pixelSizeJitter: 0,
        enableRipples: true,
        rippleSpeed: 0.3,
        rippleThickness: 0.1,
        rippleIntensityScale: 1,
        speed: 0.5,
        edgeFade: 0.25,
        transparent: true,
        autoPauseOffscreen: true,
        ...options,
      };

      this.visible = true;
      this._raf = 0;
      this._clickIx = 0;
      this._refs = null;

      this._init();
    }

    /* ─── internal init ─── */

    _init() {
      const opts = this.options;
      const canvas = document.createElement('canvas');
      const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      });
      renderer.domElement.style.cssText =
        'width:100%;height:100%;display:block;';
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.container.appendChild(renderer.domElement);

      if (opts.transparent) renderer.setClearAlpha(0);
      else renderer.setClearColor(0x000000, 1);

      /* uniforms */
      const uniforms = {
        uResolution: { value: new THREE.Vector2(0, 0) },
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(opts.color) },
        uClickPos: {
          value: Array.from({ length: MAX_CLICKS }, () =>
            new THREE.Vector2(-1, -1)
          ),
        },
        uClickTimes: { value: new Float32Array(MAX_CLICKS) },
        uShapeType: { value: SHAPE_MAP[opts.variant] ?? 0 },
        uPixelSize: { value: opts.pixelSize * renderer.getPixelRatio() },
        uScale: { value: opts.patternScale },
        uDensity: { value: opts.patternDensity },
        uPixelJitter: { value: opts.pixelSizeJitter },
        uEnableRipples: { value: opts.enableRipples ? 1 : 0 },
        uRippleSpeed: { value: opts.rippleSpeed },
        uRippleThickness: { value: opts.rippleThickness },
        uRippleIntensity: { value: opts.rippleIntensityScale },
        uEdgeFade: { value: opts.edgeFade },
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
        glslVersion: THREE.GLSL3,
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
        uniforms.uResolution.value.set(
          renderer.domElement.width,
          renderer.domElement.height
        );
        uniforms.uPixelSize.value =
          opts.pixelSize * renderer.getPixelRatio();
      };
      setSize();
      const ro = new ResizeObserver(setSize);
      ro.observe(this.container);

      /* visibility */
      const onVisChange = () => {
        this.visible = document.visibilityState === 'visible';
      };
      if (opts.autoPauseOffscreen) {
        document.addEventListener('visibilitychange', onVisChange);
      }

      /* time */
      const timeOffset = Math.random() * 1000;
      const clock = new THREE.Clock();

      /* click ripples */
      const mapToPixels = (e) => {
        const rect = renderer.domElement.getBoundingClientRect();
        const sx = renderer.domElement.width / rect.width;
        const sy = renderer.domElement.height / rect.height;
        return {
          fx: (e.clientX - rect.left) * sx,
          fy: (rect.height - (e.clientY - rect.top)) * sy,
        };
      };

      const onPointerDown = (e) => {
        if (!this.options.enableRipples) return;
        const { fx, fy } = mapToPixels(e);
        const ix = this._clickIx;
        uniforms.uClickPos.value[ix].set(fx, fy);
        uniforms.uClickTimes.value[ix] = uniforms.uTime.value;
        this._clickIx = (ix + 1) % MAX_CLICKS;
      };
      renderer.domElement.addEventListener('pointerdown', onPointerDown, {
        passive: true,
      });

      /* loop */
      const animate = () => {
        if (opts.autoPauseOffscreen && !this.visible) {
          this._raf = requestAnimationFrame(animate);
          return;
        }
        uniforms.uTime.value =
          timeOffset + clock.getElapsedTime() * opts.speed;
        renderer.render(scene, camera);
        this._raf = requestAnimationFrame(animate);
      };
      this._raf = requestAnimationFrame(animate);

      this._refs = {
        renderer,
        scene,
        camera,
        material,
        clock,
        ro,
        uniforms,
        quad,
        timeOffset,
        onPointerDown,
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
      if (opts.variant !== undefined)
        u.uShapeType.value = SHAPE_MAP[opts.variant] ?? 0;
      if (opts.pixelSize !== undefined)
        u.uPixelSize.value =
          opts.pixelSize * r.renderer.getPixelRatio();
      if (opts.color !== undefined) u.uColor.value.set(opts.color);
      if (opts.patternScale !== undefined)
        u.uScale.value = opts.patternScale;
      if (opts.patternDensity !== undefined)
        u.uDensity.value = opts.patternDensity;
      if (opts.pixelSizeJitter !== undefined)
        u.uPixelJitter.value = opts.pixelSizeJitter;
      if (opts.enableRipples !== undefined)
        u.uEnableRipples.value = opts.enableRipples ? 1 : 0;
      if (opts.rippleSpeed !== undefined)
        u.uRippleSpeed.value = opts.rippleSpeed;
      if (opts.rippleThickness !== undefined)
        u.uRippleThickness.value = opts.rippleThickness;
      if (opts.rippleIntensityScale !== undefined)
        u.uRippleIntensity.value = opts.rippleIntensityScale;
      if (opts.edgeFade !== undefined)
        u.uEdgeFade.value = opts.edgeFade;
      if (opts.speed !== undefined) {
        /* speed picked up in animate loop via this.options.speed */
      }
      if (opts.transparent !== undefined) {
        if (opts.transparent) r.renderer.setClearAlpha(0);
        else r.renderer.setClearColor(0x000000, 1);
      }
    }

    getCanvas() {
      return this._refs?.renderer?.domElement || null;
    }

    setPointerEvents(enabled) {
      const el = this._refs?.renderer?.domElement;
      if (el) el.style.pointerEvents = enabled ? 'auto' : 'none';
    }

    destroy() {
      const r = this._refs;
      if (!r) return;
      cancelAnimationFrame(this._raf);
      r.ro?.disconnect();
      if (this.options.autoPauseOffscreen) {
        document.removeEventListener(
          'visibilitychange',
          r.onVisChange
        );
      }
      r.renderer.domElement.removeEventListener(
        'pointerdown',
        r.onPointerDown
      );
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

  /* export */
  window.PixelBlast = PixelBlast;
})();
