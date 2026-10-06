/**
 * ECHELON — Tactile Interaction & Foley Audio Engine
 * Official interactive runtime for Echelon web portal.
 * Provides app-grade micro-interactions, mechanical foley sound FX,
 * live phone simulator sandbox, optical proof capture, and safety deadbolt.
 */

(function () {
  'use strict';

  // =========================================================================
  // 1. FOLEY ACOUSTIC ENGINE (App-matched WAV synthesis & playback)
  // =========================================================================
  class FoleyEngine {
    constructor() {
      this.ctx = null;
      this.buffers = {};
      this.audioElements = {};
      this.isMuted = false;
      this.isInitialized = false;
      this.lastTickTime = 0;

      this.sounds = {
        click: 'audio/click_mechanical.wav',
        tick: 'audio/tick_micro.wav',
        shutter: 'audio/shutter_snap.wav',
        solenoid: 'audio/solenoid_heavy.wav',
        latch: 'audio/bolt_latch.wav'
      };

      // Fallback HTMLAudioElement pools
      Object.keys(this.sounds).forEach((name) => {
        const a = new Audio(this.sounds[name]);
        a.preload = 'auto';
        this.audioElements[name] = a;
      });
    }

    init() {
      if (this.isInitialized) return;
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          this.ctx = new AudioContextClass();
          this.loadBuffers();
        }
      } catch (err) {
        console.warn('Web Audio API not supported, using HTML5 Audio fallback', err);
      }
      this.isInitialized = true;
      this.updateUi();
    }

    async loadBuffers() {
      if (!this.ctx) return;
      for (const [name, path] of Object.entries(this.sounds)) {
        try {
          const res = await fetch(path);
          const arrayBuffer = await res.arrayBuffer();
          this.buffers[name] = await this.ctx.decodeAudioData(arrayBuffer);
        } catch (_) {
          // Fallback pool will be used
        }
      }
    }

    play(name, volume = 1.0) {
      if (this.isMuted) return;
      if (!this.isInitialized) this.init();

      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }

      // Web Audio Buffer playback
      if (this.ctx && this.buffers[name]) {
        try {
          const source = this.ctx.createBufferSource();
          source.buffer = this.buffers[name];
          const gainNode = this.ctx.createGain();
          gainNode.gain.value = Math.min(1.0, Math.max(0.0, volume));
          source.connect(gainNode);
          gainNode.connect(this.ctx.destination);
          source.start(0);
          return;
        } catch (_) {}
      }

      // Fallback element clone
      try {
        const original = this.audioElements[name];
        if (original) {
          const clone = original.cloneNode();
          clone.volume = Math.min(1.0, Math.max(0.0, volume));
          clone.play().catch(() => {});
        }
      } catch (_) {}
    }

    playTick() {
      const now = performance.now();
      if (now - this.lastTickTime < 45) return; // Throttle escapement clicks
      this.lastTickTime = now;
      this.play('tick', 0.65);
    }

    playClick() {
      this.play('click', 0.85);
    }

    playShutter() {
      this.play('shutter', 1.0);
    }

    playSolenoid() {
      this.play('solenoid', 1.0);
    }

    playLatch() {
      this.play('latch', 1.0);
    }

    toggleMute() {
      this.isMuted = !this.isMuted;
      if (!this.isMuted) {
        this.init();
        this.playClick();
      }
      this.updateUi();
      return this.isMuted;
    }

    updateUi() {
      const btn = document.getElementById('sfx-toggle');
      if (!btn) return;
      if (this.isMuted) {
        btn.classList.add('is-muted');
        btn.setAttribute('aria-label', 'Unmute tactile sound effects');
        btn.innerHTML = `<span class="sfx-icon">&#128263;</span><span class="sfx-text">SFX OFF</span>`;
      } else {
        btn.classList.remove('is-muted');
        btn.setAttribute('aria-label', 'Mute tactile sound effects');
        btn.innerHTML = `<span class="sfx-icon">&#128266;</span><span class="sfx-text">SFX ON</span>`;
      }
    }
  }

  const foley = new FoleyEngine();
  window.echelonFoley = foley;

  // Initialize on first interaction anywhere
  const unlockAudio = () => {
    foley.init();
    window.removeEventListener('pointerdown', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
  };
  window.addEventListener('pointerdown', unlockAudio, { passive: true });
  window.addEventListener('keydown', unlockAudio, { passive: true });

  // =========================================================================
  // 2. CONFETTI & CELEBRATION MODAL SYSTEM
  // =========================================================================
  class CelebrationManager {
    constructor() {
      this.modal = document.getElementById('xp-modal');
      this.canvas = document.getElementById('xp-confetti-canvas');
      this.counter = document.getElementById('xp-animated-counter');
      this.tierLabel = document.getElementById('xp-tier-label');
      this.particles = [];
      this.animId = null;
      this.activeXp = 0;

      const dismissBtn = document.getElementById('xp-dismiss-btn');
      if (dismissBtn) {
        dismissBtn.addEventListener('click', () => {
          foley.playClick();
          this.hide();
        });
      }

      if (this.modal) {
        this.modal.addEventListener('click', (e) => {
          if (e.target === this.modal) {
            foley.playClick();
            this.hide();
          }
        });
      }
    }

    show(amount = 50, title = 'PROTOCOL CONFIRMED', tier = 'ROOKIE // CADRE-01') {
      if (!this.modal) return;
      this.activeXp = amount;
      if (this.tierLabel) this.tierLabel.textContent = tier;

      const titleEl = document.getElementById('xp-modal-title');
      if (titleEl) titleEl.textContent = title;

      this.modal.classList.add('is-active');
      document.body.style.overflow = 'hidden';

      // Play decisive clank
      foley.playSolenoid();

      // Count up animation
      if (this.counter) {
        this.counter.textContent = '+0 XP';
        let current = 0;
        const duration = 1100;
        const start = performance.now();
        const updateCounter = (time) => {
          const progress = Math.min((time - start) / duration, 1);
          const ease = 1 - Math.pow(1 - progress, 3); // easeOutCubic
          current = Math.floor(ease * amount);
          this.counter.textContent = `+${current} XP`;
          if (progress < 1) {
            requestAnimationFrame(updateCounter);
          } else {
            this.counter.textContent = `+${amount} XP`;
          }
        };
        requestAnimationFrame(updateCounter);
      }

      this.startConfetti();
    }

    hide() {
      if (!this.modal) return;
      this.modal.classList.remove('is-active');
      document.body.style.overflow = '';
      if (this.animId) {
        cancelAnimationFrame(this.animId);
        this.animId = null;
      }
      if (this.canvas) {
        const ctx = this.canvas.getContext('2d');
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      }
    }

    startConfetti() {
      if (!this.canvas) return;
      const ctx = this.canvas.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      this.canvas.width = window.innerWidth * dpr;
      this.canvas.height = window.innerHeight * dpr;
      ctx.scale(dpr, dpr);

      const colors = ['#C9A84C', '#C0392B', '#F7F2E8', '#E8A320', '#1A5FA8'];
      this.particles = [];
      const count = window.innerWidth < 768 ? 45 : 80;

      for (let i = 0; i < count; i++) {
        this.particles.push({
          x: window.innerWidth * 0.5 + (Math.random() - 0.5) * 80,
          y: window.innerHeight * 0.45,
          vx: (Math.random() - 0.5) * 14,
          vy: (Math.random() - 1.2) * 16,
          size: Math.random() * 8 + 4,
          color: colors[Math.floor(Math.random() * colors.length)],
          rotation: Math.random() * 360,
          vRot: (Math.random() - 0.5) * 12,
          gravity: 0.38,
          alpha: 1.0
        });
      }

      const loop = () => {
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        let alive = false;

        this.particles.forEach((p) => {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += p.gravity;
          p.vx *= 0.98;
          p.rotation += p.vRot;
          p.alpha -= 0.008;

          if (p.alpha > 0) {
            alive = true;
            ctx.save();
            ctx.globalAlpha = Math.max(0, p.alpha);
            ctx.translate(p.x, p.y);
            ctx.rotate((p.rotation * Math.PI) / 180);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
            ctx.restore();
          }
        });

        if (alive) {
          this.animId = requestAnimationFrame(loop);
        }
      };

      if (this.animId) cancelAnimationFrame(this.animId);
      this.animId = requestAnimationFrame(loop);
    }
  }

  const celebration = new CelebrationManager();
  window.echelonCelebration = celebration;

  // =========================================================================
  // 3. PLAYABLE PHONE SIMULATOR SANDBOX
  // =========================================================================
  const GESTURE_CHALLENGES = [
    { text: 'GESTURE: TWO FINGERS UP ✌️', limit: '00:04' },
    { text: 'GESTURE: TOUCH LEFT EAR 👂', limit: '00:03' },
    { text: 'GESTURE: THUMBS UP DIRECT 👍', limit: '00:05' },
    { text: 'GESTURE: CLENCHED FIST ✊', limit: '00:04' },
    { text: 'GESTURE: TOUCH CHIN 🖐️', limit: '00:03' }
  ];

  class PhoneSimulator {
    constructor() {
      this.currentMode = 'arena';
      this.gestureIdx = 0;
      this.isCapturing = false;
      this.isVerified = false;

      // Habit goals state
      this.goalStates = [true, true, false, false];

      this.tabs = document.querySelectorAll('.sandbox-tab');
      this.screens = document.querySelectorAll('.phone-screen-view');
      this.details = document.querySelectorAll('.mode-detail-pane');

      this.initEventListeners();
      this.updateClock();
      setInterval(() => this.updateClock(), 30000);
    }

    initEventListeners() {
      // Tab switcher clicks
      this.tabs.forEach((tab) => {
        tab.addEventListener('click', () => {
          const mode = tab.dataset.mode;
          if (mode && mode !== this.currentMode) {
            foley.playClick();
            this.switchMode(mode);
          }
        });
      });

      // External mode card triggers
      document.querySelectorAll('.q-card').forEach((card) => {
        card.addEventListener('click', (e) => {
          // If click wasn't on a direct link
          if (e.target.tagName !== 'A') {
            const mode = card.dataset.mode;
            if (mode) {
              foley.playClick();
              this.switchMode(mode);
              const sandboxEl = document.getElementById('sandbox');
              if (sandboxEl) {
                sandboxEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }
          }
        });
      });

      // Proof capture open trigger
      const triggerCamBtn = document.getElementById('sim-log-trigger');
      if (triggerCamBtn) {
        triggerCamBtn.addEventListener('click', () => {
          foley.playClick();
          this.openViewfinder();
        });
      }

      // Shutter button trigger
      const shutterBtn = document.getElementById('sim-shutter-btn');
      if (shutterBtn) {
        shutterBtn.addEventListener('click', () => {
          this.snapProof();
        });
      }

      // Back to arena from viewfinder
      const cancelProofBtn = document.getElementById('sim-cancel-proof');
      if (cancelProofBtn) {
        cancelProofBtn.addEventListener('click', () => {
          foley.playClick();
          this.closeViewfinder();
        });
      }

      // Goal item checkboxes inside phone
      document.querySelectorAll('.sim-goal-row').forEach((row, idx) => {
        row.addEventListener('click', () => {
          foley.playClick();
          this.toggleGoal(idx, row);
        });
      });

      // Duel challenge issue button
      const duelBtn = document.getElementById('sim-duel-challenge-btn');
      if (duelBtn) {
        duelBtn.addEventListener('click', () => {
          foley.playClick();
          this.issueDuelChallenge(duelBtn);
        });
      }

      // Touch swipe gestures on phone screen for mobile fluidity
      const phoneScreen = document.querySelector('.phone-screen');
      if (phoneScreen) {
        let touchStartX = 0;
        let touchEndX = 0;
        phoneScreen.addEventListener('touchstart', (e) => {
          touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });

        phoneScreen.addEventListener('touchend', (e) => {
          touchEndX = e.changedTouches[0].screenX;
          const diff = touchEndX - touchStartX;
          if (Math.abs(diff) > 50) {
            const modes = ['arena', 'duels', 'goals', 'gold'];
            const currentIndex = modes.indexOf(this.currentMode);
            if (diff < 0 && currentIndex < modes.length - 1) {
              foley.playClick();
              this.switchMode(modes[currentIndex + 1]);
            } else if (diff > 0 && currentIndex > 0) {
              foley.playClick();
              this.switchMode(modes[currentIndex - 1]);
            }
          }
        }, { passive: true });
      }
    }

    switchMode(mode) {
      this.currentMode = mode;

      // Update tabs
      this.tabs.forEach((tab) => {
        tab.classList.toggle('active', tab.dataset.mode === mode);
      });

      // Update phone screens
      this.screens.forEach((screen) => {
        screen.classList.toggle('active', screen.dataset.mode === mode);
      });

      // Update side detail pane
      this.details.forEach((pane) => {
        pane.classList.toggle('active', pane.dataset.mode === mode);
      });

      // Reset viewfinder state if leaving arena
      if (mode !== 'arena') {
        this.closeViewfinder();
      }
    }

    openViewfinder() {
      const arenaHome = document.getElementById('sim-arena-home');
      const viewfinder = document.getElementById('sim-viewfinder');
      if (!arenaHome || !viewfinder) return;

      this.gestureIdx = (this.gestureIdx + 1) % GESTURE_CHALLENGES.length;
      const challenge = GESTURE_CHALLENGES[this.gestureIdx];

      const gesturePrompt = document.getElementById('sim-gesture-prompt');
      if (gesturePrompt) gesturePrompt.textContent = challenge.text;

      const countdownEl = document.getElementById('sim-gesture-timer');
      if (countdownEl) countdownEl.textContent = challenge.limit;

      arenaHome.style.display = 'none';
      viewfinder.style.display = 'flex';

      // Reset status badge
      const statusBadge = document.getElementById('sim-proof-status');
      if (statusBadge) {
        statusBadge.textContent = 'READY TO SUBMIT';
        statusBadge.className = 'sim-status-badge status-ready';
      }

      const watermark = document.getElementById('sim-watermark');
      if (watermark) {
        const now = new Date();
        const timeStr = now.toISOString().slice(11, 19);
        watermark.textContent = `#CADRE-01 · ${timeStr} UTC`;
      }
    }

    closeViewfinder() {
      const arenaHome = document.getElementById('sim-arena-home');
      const viewfinder = document.getElementById('sim-viewfinder');
      if (!arenaHome || !viewfinder) return;

      viewfinder.style.display = 'none';
      arenaHome.style.display = 'flex';
      this.isCapturing = false;
    }

    snapProof() {
      if (this.isCapturing) return;
      this.isCapturing = true;

      // 1. Shutter sound
      foley.playShutter();

      // 2. Optical flash overlay
      const flash = document.getElementById('sim-optical-flash');
      if (flash) {
        flash.classList.add('flash-active');
        setTimeout(() => flash.classList.remove('flash-active'), 250);
      }

      // 3. Stamping cryptographic checksum
      const watermark = document.getElementById('sim-watermark');
      if (watermark) {
        const hash = Math.random().toString(16).substring(2, 8).toUpperCase();
        watermark.textContent = `#CADRE-01 · VERIFIED · SIG:${hash}`;
      }

      const statusBadge = document.getElementById('sim-proof-status');
      if (statusBadge) {
        statusBadge.textContent = 'VERIFYING WITH AGON AI...';
        statusBadge.className = 'sim-status-badge status-verifying';
      }

      // 4. Verification delay matching mobile app
      setTimeout(() => {
        if (statusBadge) {
          statusBadge.textContent = '✓ CRYPTOGRAPHICALLY CONFIRMED';
          statusBadge.className = 'sim-status-badge status-verified';
        }
        foley.playLatch();

        setTimeout(() => {
          this.closeViewfinder();
          celebration.show(50, 'DAILY ARENA PROOF CONFIRMED', 'ARENA PROTOCOL 01');
          this.isCapturing = false;
        }, 600);
      }, 1200);
    }

    toggleGoal(index, row) {
      this.goalStates[index] = !this.goalStates[index];
      const check = row.querySelector('.sim-check-box');
      if (check) {
        check.classList.toggle('checked', this.goalStates[index]);
        check.innerHTML = this.goalStates[index] ? '&#10003;' : '';
      }

      // Compute progress
      const completed = this.goalStates.filter(Boolean).length;
      const total = this.goalStates.length;
      const pct = Math.round((completed / total) * 100);

      const pctEl = document.getElementById('sim-goal-percent');
      if (pctEl) pctEl.textContent = `${pct}%`;

      const ring = document.getElementById('sim-goal-progress-ring');
      if (ring) {
        const circumference = 2 * Math.PI * 45; // r=45
        const offset = circumference - (pct / 100) * circumference;
        ring.style.strokeDashoffset = offset;
      }

      if (completed === total) {
        setTimeout(() => {
          celebration.show(25, 'ALL DAILY PROTOCOLS COMPLETE', 'SOLO DISCIPLINE');
        }, 300);
      }
    }

    issueDuelChallenge(btn) {
      btn.disabled = true;
      btn.textContent = 'TRANSMITTING CHALLENGE...';

      const radar = document.getElementById('sim-duel-radar-wave');
      if (radar) radar.classList.add('radar-active');

      setTimeout(() => {
        btn.textContent = 'CHALLENGE ACCEPTED BY IRONSIDE_88';
        btn.style.background = 'var(--accent-green)';
        foley.playSolenoid();

        const commsMsg = document.getElementById('sim-duel-last-msg');
        if (commsMsg) {
          commsMsg.textContent = '"IRONSIDE_88: Stakes accepted (Dinner on loser). Day 01 begins now."';
          commsMsg.style.color = '#F7F2E8';
        }

        setTimeout(() => {
          celebration.show(30, 'DUEL STAKES LOCKED · REWARD AT RISK', '1V1 COMBATANT VS IRONSIDE_88');
          btn.disabled = false;
          btn.textContent = 'ISSUE 1V1 CHALLENGE';
          btn.style.background = '';
          if (radar) radar.classList.remove('radar-active');
        }, 1200);
      }, 1400);
    }

    updateClock() {
      const now = new Date();
      const h = String(now.getUTCHours()).padStart(2, '0');
      const m = String(now.getUTCMinutes()).padStart(2, '0');
      const clockEl = document.getElementById('sim-phone-clock');
      if (clockEl) clockEl.textContent = `${h}:${m}`;
    }
  }

  // =========================================================================
  // 4. MECHANICAL SAFETY DEADBOLT SLIDE-TO-CONFIRM
  // =========================================================================
  class DeadboltSlider {
    constructor() {
      this.track = document.getElementById('deadbolt-track');
      this.knob = document.getElementById('deadbolt-knob');
      this.fill = document.getElementById('deadbolt-fill');
      this.label = document.getElementById('deadbolt-label');

      if (!this.track || !this.knob) return;

      this.isDragging = false;
      this.isLocked = false;
      this.startX = 0;
      this.currentX = 0;
      this.maxDrag = 0;
      this.lastStep = 0;

      this.initEvents();
    }

    initEvents() {
      const onStart = (e) => {
        if (this.isLocked) return;
        this.isDragging = true;
        this.startX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
        this.maxDrag = this.track.clientWidth - this.knob.clientWidth - 8;
        this.knob.classList.add('dragging');
        this.track.classList.add('active');
        foley.playTick();
        e.preventDefault();
      };

      const onMove = (e) => {
        if (!this.isDragging || this.isLocked) return;
        const clientX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
        const delta = clientX - this.startX;
        this.currentX = Math.max(0, Math.min(delta, this.maxDrag));

        // Update knob and progress track
        this.knob.style.transform = `translateX(${this.currentX}px)`;
        if (this.fill) {
          const pct = (this.currentX / this.maxDrag) * 100;
          this.fill.style.width = `${pct}%`;
        }

        // Ratcheting tick sound every 10%
        const step = Math.floor((this.currentX / this.maxDrag) * 10);
        if (step !== this.lastStep) {
          foley.playTick();
          this.lastStep = step;
        }

        if (this.label) {
          if (this.currentX / this.maxDrag > 0.8) {
            this.label.textContent = 'RELEASE TO ENGAGE DEADBOLT';
            this.label.style.opacity = '1';
          } else {
            this.label.textContent = 'SLIDE TO ENTER THE ARENA';
            this.label.style.opacity = '0.7';
          }
        }
      };

      const onEnd = () => {
        if (!this.isDragging || this.isLocked) return;
        this.isDragging = false;
        this.knob.classList.remove('dragging');
        this.track.classList.remove('active');

        // Check if dragged over 85%
        if (this.currentX >= this.maxDrag * 0.85) {
          this.lockConfirmed();
        } else {
          // Snap back with spring recoil
          this.knob.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.9, 0.3, 1.2)';
          this.knob.style.transform = 'translateX(0px)';
          if (this.fill) {
            this.fill.style.transition = 'width 0.3s cubic-bezier(0.2, 0.9, 0.3, 1.2)';
            this.fill.style.width = '0%';
          }
          if (this.label) this.label.textContent = 'SLIDE TO ENTER THE ARENA';
          setTimeout(() => {
            this.knob.style.transition = '';
            if (this.fill) this.fill.style.transition = '';
          }, 300);
          this.currentX = 0;
        }
      };

      this.knob.addEventListener('mousedown', onStart);
      this.knob.addEventListener('touchstart', onStart, { passive: false });

      window.addEventListener('mousemove', onMove);
      window.addEventListener('touchmove', onMove, { passive: false });

      window.addEventListener('mouseup', onEnd);
      window.addEventListener('touchend', onEnd);
    }

    lockConfirmed() {
      this.isLocked = true;
      this.knob.style.transform = `translateX(${this.maxDrag}px)`;
      if (this.fill) this.fill.style.width = '100%';

      this.track.classList.add('confirmed');
      if (this.label) {
        this.label.textContent = '✓ ACCESS GRANTED // DEADBOLT LOCKED';
        this.label.style.color = 'var(--text-primary)';
      }

      // 1. Play heavy deadbolt latch & electromagnetic solenoid slam
      foley.playLatch();
      setTimeout(() => foley.playSolenoid(), 80);

      // 2. Trigger Celebration modal (+100 XP) and route to beta access
      setTimeout(() => {
        celebration.show(100, 'DEADBOLT LATCHED · ACCESS GRANTED', 'BETA COHORT TESTER');
      }, 400);
    }
  }

  // =========================================================================
  // 5. GYROSCOPIC 3D TILT EFFECT (Hardware Physical Specular Sheen)
  // =========================================================================
  function init3DTilt() {
    if (window.innerWidth < 992) return; // Desktop only
    const cards = document.querySelectorAll('.q-card, .phone-mockup');

    cards.forEach((card) => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const rotateX = ((y - centerY) / centerY) * -5.5;
        const rotateY = ((x - centerX) / centerX) * 5.5;

        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.01, 1.01, 1.01)`;
        card.style.setProperty('--mouse-x', `${x}px`);
        card.style.setProperty('--mouse-y', `${y}px`);
      });

      card.addEventListener('mouseleave', () => {
        card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
        card.style.transition = 'transform 0.4s ease';
      });

      card.addEventListener('mouseenter', () => {
        card.style.transition = 'none';
      });
    });
  }

  // =========================================================================
  // 6. INITIALIZATION & GLOBAL BINDINGS
  // =========================================================================
  document.addEventListener('DOMContentLoaded', () => {
    // SFX toggle button in header
    const sfxBtn = document.getElementById('sfx-toggle');
    if (sfxBtn) {
      sfxBtn.addEventListener('click', () => {
        foley.toggleMute();
      });
    }

    // Attach click Foley sound to all standard CTA buttons
    document.querySelectorAll('.btn, .nav-cta-btn, .mobile-link, .ticker-link').forEach((btn) => {
      btn.addEventListener('click', () => {
        foley.playClick();
      });
    });

    // Initialize systems
    window.phoneSimulator = new PhoneSimulator();
    window.deadboltSlider = new DeadboltSlider();
    init3DTilt();
  });
})();
